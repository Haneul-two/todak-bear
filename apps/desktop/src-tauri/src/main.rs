// 🐻 토닥곰 데스크톱 펫 — Tauri v2 엔트리.
// 투명·항상위·작업표시줄 숨김 창에 ui/index.html(토닥곰)을 띄운다.
// 백엔드는 ~/.todak/state.json(신호원들이 기록)을 주기적으로 읽어 프런트로 emit.
// 곰의 기분 판단(deriveSignals/pickMood)은 프런트(JS 코어)가 담당 → 로직 한 곳에만 존재.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tools;

use std::collections::HashMap;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, WindowEvent};
use tools::{build_command, parse_tools, Tool, ToolView, SEED_TOOLS_JSON};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(unix)]
use std::os::unix::process::CommandExt as _;

fn state_path() -> PathBuf {
    // 신호원(state.js)과 동일 위치: $TODAK_HOME 우선, 없으면 홈/.todak
    if let Ok(dir) = std::env::var("TODAK_HOME") {
        return PathBuf::from(dir).join("state.json");
    }
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".todak").join("state.json")
}

// 창 위치 기억: 신호 상태와 별도 파일(window.json)에 마지막 위치를 저장/복원
fn window_state_path() -> PathBuf {
    if let Ok(dir) = std::env::var("TODAK_HOME") {
        return PathBuf::from(dir).join("window.json");
    }
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".todak").join("window.json")
}

// tools.json 경로 — state_path()/window_state_path()와 동일한 TODAK_HOME 규칙.
fn tools_path() -> PathBuf {
    if let Ok(dir) = std::env::var("TODAK_HOME") {
        return PathBuf::from(dir).join("tools.json");
    }
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".todak").join("tools.json")
}

// 파일이 있으면 파싱, 없으면 시드를 써 두고 시드를 반환. 깨진 파일은 빈 목록.
fn load_tools_from(path: &std::path::Path) -> Vec<Tool> {
    match std::fs::read_to_string(path) {
        Ok(s) => parse_tools(&s).unwrap_or_default(),
        Err(_) => {
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(path, SEED_TOOLS_JSON);
            parse_tools(SEED_TOOLS_JSON).unwrap_or_default()
        }
    }
}

fn load_tools() -> Vec<Tool> {
    load_tools_from(&tools_path())
}

// 해당 포트(127.0.0.1)에 짧은 타임아웃으로 연결되면 '켜짐'으로 본다.
fn is_port_open(port: u16) -> bool {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

fn save_window_pos(x: i32, y: i32) {
    let p = window_state_path();
    if let Some(dir) = p.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(&p, format!("{{\"x\":{},\"y\":{}}}", x, y));
}

fn load_window_pos() -> Option<(i32, i32)> {
    let s = std::fs::read_to_string(window_state_path()).ok()?;
    let v: serde_json::Value = serde_json::from_str(s.trim_start_matches('\u{feff}')).ok()?;
    Some((v.get("x")?.as_i64()? as i32, v.get("y")?.as_i64()? as i32))
}

// ── 배회(산책) — 가끔 home(사용자가 둔 자리) 주변을 천천히 좌우로 거닐고 돌아온다 ──
// 부드럽고 드물게. 배회 이동은 흔들림/위치저장에서 제외(스스로 어지럽거나 home을 덮지 않게).
fn walk_to(win: &tauri::WebviewWindow, from: (i32, i32), to: (i32, i32)) {
    let steps = 48;
    for i in 1..=steps {
        let t = i as f64 / steps as f64;
        let e = if t < 0.5 { 2.0 * t * t } else { 1.0 - (-2.0 * t + 2.0).powi(2) / 2.0 }; // ease-in-out
        let x = from.0 as f64 + (to.0 - from.0) as f64 * e;
        let y = from.1 as f64 + (to.1 - from.1) as f64 * e;
        let _ = win.set_position(tauri::PhysicalPosition::new(x.round() as i32, y.round() as i32));
        std::thread::sleep(std::time::Duration::from_millis(18));
    }
}

fn wander_loop(win: tauri::WebviewWindow, wandering: Arc<AtomicBool>, home: Arc<Mutex<(i32, i32)>>, enabled: Arc<AtomicBool>) {
    // 가벼운 의사난수(xorshift64, 시드=현재시각)
    let mut seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(88172645463325252);
    let mut rng = move || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        seed
    };
    // 화면 폭·창 폭(화면 밖으로 안 나가게 클램프)
    let mon_w = win.current_monitor().ok().flatten().map(|m| m.size().width as i32).unwrap_or(1920);
    let win_w = win.outer_size().map(|s| s.width as i32).unwrap_or(300);
    let max_x = (mon_w - win_w - 8).max(8);

    loop {
        if !enabled.load(Ordering::Relaxed) {
            // 산책 꺼짐(우클릭 메뉴) → 잠깐 자고 다시 확인
            std::thread::sleep(std::time::Duration::from_secs(3));
            continue;
        }
        let wait = 45 + (rng() % 46); // 45~90초마다 한 번
        std::thread::sleep(std::time::Duration::from_secs(wait));

        let cur = match win.outer_position() {
            Ok(p) => (p.x, p.y),
            Err(_) => continue,
        };
        let (hx, hy) = *home.lock().unwrap();
        let dist = 90 + (rng() % 121) as i32; // 90~210px
        let dir = if rng() % 2 == 0 { 1 } else { -1 };
        let target = ((hx + dir * dist).clamp(8, max_x), hy); // 수평 산책

        wandering.store(true, Ordering::Relaxed);
        let _ = win.emit("todak://walk", serde_json::json!({ "moving": true, "dir": dir }));
        walk_to(&win, cur, target);
        let _ = win.emit("todak://walk", serde_json::json!({ "moving": false }));
        std::thread::sleep(std::time::Duration::from_secs(3 + (rng() % 4))); // 잠깐 머무름
        let cur2 = match win.outer_position() {
            Ok(p) => (p.x, p.y),
            Err(_) => target,
        };
        let _ = win.emit("todak://walk", serde_json::json!({ "moving": true, "dir": -dir }));
        walk_to(&win, cur2, (hx, hy)); // 집으로 복귀
        let _ = win.emit("todak://walk", serde_json::json!({ "moving": false }));
        // Moved 이벤트는 비동기로 늦게 도착 → 유예시간 동안 계속 억제해야
        // 배회 위치가 home/window.json 으로 새지 않는다.
        std::thread::sleep(std::time::Duration::from_millis(800));
        wandering.store(false, Ordering::Relaxed);
    }
}

// 우클릭 메뉴가 invoke 하는 커맨드 + 공유 상태(프런트→백엔드는 이벤트보다 커맨드가 확실)
struct AppState {
    home: Arc<Mutex<(i32, i32)>>,
    wander_enabled: Arc<AtomicBool>,
    // 곰이 띄운 도구 프로세스(중지용). key = tool id.
    running: Mutex<HashMap<String, std::process::Child>>,
}

#[tauri::command]
fn quit(app: tauri::AppHandle, state: tauri::State<AppState>) {
    kill_all(&state);
    app.exit(0);
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
    let w = window.clone();
    std::thread::spawn(move || {
        // 작업표시줄 아이콘이 없어 영구 숨김 방지: 30초 뒤 다시 나타남
        std::thread::sleep(std::time::Duration::from_secs(30));
        let _ = w.show();
    });
}

#[tauri::command]
fn reset_pos(window: tauri::WebviewWindow, state: tauri::State<AppState>) {
    let _ = window.set_position(tauri::PhysicalPosition::new(1600, 720));
    *state.home.lock().unwrap() = (1600, 720);
    save_window_pos(1600, 720);
}

#[tauri::command]
fn toggle_wander(app: tauri::AppHandle, state: tauri::State<AppState>) {
    let on = !state.wander_enabled.load(Ordering::Relaxed);
    state.wander_enabled.store(on, Ordering::Relaxed);
    let _ = app.emit("todak://wander", serde_json::json!({ "enabled": on }));
}

#[tauri::command]
fn list_tools() -> Vec<ToolView> {
    load_tools().iter().map(|t| t.to_view()).collect()
}

#[tauri::command]
fn tool_status() -> HashMap<String, bool> {
    load_tools()
        .iter()
        .map(|t| (t.id.clone(), is_port_open(t.port)))
        .collect()
}

// CREATE_NO_WINDOW — streamlit 콘솔 창이 뜨지 않게(Windows).
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// 기본 브라우저로 URL 열기(OS별).
fn open_browser(url: &str) {
    #[cfg(windows)]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

// 자식 프로세스를 트리(그룹)째 종료(OS별). streamlit이 하위 프로세스를 띄우므로.
fn kill_tree(child: &mut std::process::Child) {
    #[cfg(windows)]
    {
        // streamlit.exe 런처가 python.exe를 띄우므로 /T로 트리째.
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &child.id().to_string()])
            .output();
    }
    #[cfg(unix)]
    {
        // launch 시 자기 프로세스 그룹 리더로 띄웠으므로(-pid = 그룹 전체) 그룹째 종료.
        let pid = child.id();
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &format!("-{pid}")])
            .output();
    }
    let _ = child.wait();
}

#[tauri::command]
fn launch_tool(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let tool = load_tools()
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("도구를 찾을 수 없어: {id}"))?;
    let spec = build_command(&tool);

    let mut cmd = std::process::Command::new(&spec.program);
    cmd.args(&spec.args).current_dir(&spec.cwd);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    #[cfg(unix)]
    cmd.process_group(0); // 자기 그룹 리더 → 중지 시 그룹째 종료 가능

    let child = cmd
        .spawn()
        .map_err(|e| format!("{} 실행 실패: {e}", spec.program))?;
    state.running.lock().unwrap().insert(id, child);

    // 서버 기동을 기다리지 않고 바로 브라우저를 연다(탭이 잠깐 로딩될 수 있음).
    open_browser(&tool.url);
    Ok(())
}

#[tauri::command]
fn stop_tool(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let mut map = state.running.lock().unwrap();
    match map.remove(&id) {
        Some(mut child) => {
            kill_tree(&mut child);
            Ok(())
        }
        None => Err("내가 띄운 게 아니라 끌 수 없어".into()),
    }
}

// 곰이 띄운 모든 도구 프로세스를 트리째 종료.
fn kill_all(state: &tauri::State<AppState>) {
    let mut map = state.running.lock().unwrap();
    for child in map.values_mut() {
        kill_tree(child);
    }
    map.clear();
}

// 창 흔들기(휘두르기) 감지용 상태
struct Shake {
    last_pos: Option<(i32, i32)>,
    last_t: Instant,
    energy: f64,
    last_dizzy: Instant,
}

fn main() {
    let shake = Mutex::new(Shake {
        last_pos: None,
        last_t: Instant::now(),
        energy: 0.0,
        last_dizzy: Instant::now() - std::time::Duration::from_secs(10),
    });
    let wandering = Arc::new(AtomicBool::new(false)); // 배회 중 플래그(흔들림/저장 억제)
    let home = Arc::new(Mutex::new((0i32, 0i32))); // 사용자가 둔 자리(배회 기준점)
    let wander_enabled = Arc::new(AtomicBool::new(std::env::var("TODAK_NO_WANDER").is_err())); // 산책 on/off(우클릭 토글)

    let wandering_ev = wandering.clone();
    let home_ev = home.clone();
    let app_state = AppState {
        home: home.clone(),
        wander_enabled: wander_enabled.clone(),
        running: Mutex::new(HashMap::new()),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            quit,
            hide_window,
            reset_pos,
            toggle_wander,
            list_tools,
            tool_status,
            launch_tool,
            stop_tool
        ])
        // 창을 잡고 격하게 휘두르면(빠른 이동 누적) 어지러움 신호 emit
        .on_window_event(move |window, event| {
            if let WindowEvent::Moved(pos) = event {
                // 배회(프로그램 이동) 중엔 흔들림·위치저장 무시(스스로 어지럽거나 home 덮지 않게)
                if wandering_ev.load(Ordering::Relaxed) {
                    return;
                }
                let mut s = shake.lock().unwrap();
                let now = Instant::now();
                let dt = now.duration_since(s.last_t).as_secs_f64();
                s.energy *= (1.0 - dt * 3.0).max(0.0); // 움직임 멈추면 빠르게 사그라듦
                if let Some((lx, ly)) = s.last_pos {
                    let d = (((pos.x - lx).pow(2) + (pos.y - ly).pow(2)) as f64).sqrt();
                    if d < 400.0 { s.energy += d; } // 한 번에 너무 큰 점프(첫 배치 등)는 무시
                }
                s.last_pos = Some((pos.x, pos.y));
                s.last_t = now;
                if s.energy > 1300.0 && now.duration_since(s.last_dizzy).as_secs_f64() > 6.0 {
                    let _ = window.emit("todak://dizzy", ());
                    s.last_dizzy = now;
                    s.energy = 0.0;
                }
                // 사용자가 옮긴 자리 → 저장 + 배회 기준점(home) 갱신
                save_window_pos(pos.x, pos.y);
                *home_ev.lock().unwrap() = (pos.x, pos.y);
            }
        })
        .setup(move |app| {
            let win = app.get_webview_window("todak");
            // 마지막 저장 위치 복원 + home 초기화
            let mut start = (1600, 720);
            if let Some(w) = &win {
                if let Some((x, y)) = load_window_pos() {
                    let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
                    start = (x, y);
                } else if let Ok(p) = w.outer_position() {
                    start = (p.x, p.y);
                }
            }
            *home.lock().unwrap() = start;

            // 2초마다 상태 파일을 읽어 원시 JSON 그대로 프런트로 전달.
            let handle = app.handle().clone();
            let path = state_path();
            std::thread::spawn(move || loop {
                let raw = std::fs::read_to_string(&path)
                    .ok()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s.trim_start_matches('\u{feff}')).ok())
                    .unwrap_or_else(|| serde_json::json!({}));
                let _ = handle.emit("todak://state", raw);
                std::thread::sleep(std::time::Duration::from_secs(2));
            });

            // 배회 스레드(항상 실행, 런타임 enabled 플래그로 on/off — 우클릭 메뉴서 토글)
            if let Some(w) = win.clone() {
                let wandering_t = wandering.clone();
                let home_t = home.clone();
                let enabled_t = wander_enabled.clone();
                std::thread::spawn(move || wander_loop(w, wandering_t, home_t, enabled_t));
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running 토닥곰");
}

#[cfg(test)]
mod launcher_tests {
    use super::*;

    #[test]
    fn load_tools_seeds_when_file_missing() {
        let mut dir = std::env::temp_dir();
        dir.push(format!("todak_launcher_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("tools.json");

        let tools = load_tools_from(&path);

        assert!(tools.is_empty(), "빈 시드이므로 도구가 없어야 함");
        assert!(path.exists(), "tools.json 파일이 디스크에 생성돼야 함");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_open_then_closed_port() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(is_port_open(port), "리스닝 중인 포트는 열림으로 판정");
        drop(listener);
        assert!(!is_port_open(port), "닫힌 포트는 닫힘으로 판정");
    }
}
