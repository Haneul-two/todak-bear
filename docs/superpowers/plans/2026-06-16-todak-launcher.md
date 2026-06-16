# 토닥곰 업무 런처 (v1 — 만족도) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토닥곰 우클릭 메뉴에서 만족도 자동화 Streamlit 앱을 실행·중지하고, 포트 도달 여부로 상태를 표시한다.

**Architecture:** 순수 로직(도구 정의 파싱·커맨드 조립·뷰 변환)은 새 Rust 모듈 `tools.rs`에 두고 단위 테스트한다. 부수효과(프로세스 spawn/kill, TCP 포트 점검, 브라우저 열기)는 `main.rs`의 새 Tauri command에 두고 기존 AppState/command 패턴을 그대로 확장한다. 프런트는 기존 `#ctxmenu`에 "🛠 도구" 그룹을 동적 렌더하고 클릭 시 command를 invoke한다. 도구 목록은 코드 밖 `~/.todak/tools.json`(없으면 만족도 시드 자동 생성)에서 읽는다.

**Tech Stack:** Tauri 2 (Rust), `std::process::Command`(spawn/taskkill), `std::net::TcpStream`(상태), serde/serde_json, 바닐라 JS(ui/index.html). 테스트: `cargo test`. 빌드/실행: `node build-dist.js` → `npm run dev`(=`tauri dev`).

**작업 위치:** `apps/desktop/` (브랜치 `feat/todak-launcher`)

---

## File Structure

- **Create** `apps/desktop/src-tauri/src/tools.rs` — 도구 순수 로직: `Tool`/`ToolView`/`CommandSpec` 타입, `parse_tools`, `build_command`, `SEED_TOOLS_JSON`, `Tool::to_view`. 단위 테스트 포함.
- **Modify** `apps/desktop/src-tauri/src/main.rs` — `mod tools;` 선언, `tools_path`/`load_tools_from`/`load_tools`/`is_port_open`/`kill_all` 헬퍼, `AppState.running` 필드, command `list_tools`/`tool_status`/`launch_tool`/`stop_tool`, `quit` 종료 시 자식 정리, `invoke_handler` 등록. 파일 끝에 `#[cfg(test)] mod tests`.
- **Modify** `apps/desktop/ui/index.html` — `#ctxmenu`에 "🛠 도구" 그룹 HTML + CSS, 메뉴 열 때 `renderTools()`로 동적 렌더, 클릭 시 `launch_tool`/`stop_tool` invoke + 곰 반응.

> 빌드 주의: dev는 `dist/`를 정적 서빙한다. `ui/index.html` 수정은 `node build-dist.js`로 `dist/`에 반영해야 화면에 보인다.

---

## Task 1: 도구 정의 모듈 + 파싱 (tools.rs)

**Files:**
- Create: `apps/desktop/src-tauri/src/tools.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs` (상단에 `mod tools;` 추가)

- [ ] **Step 1: tools.rs에 타입과 실패하는 테스트 작성**

`apps/desktop/src-tauri/src/tools.rs` 생성:

```rust
//! 업무 런처 도구 정의 — 순수 로직(파싱·조립·뷰 변환).
//! 부수효과(spawn/kill/tcp/browser)는 main.rs가 담당한다.
use serde::{Deserialize, Serialize};

/// tools.json의 도구 한 개.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Tool {
    pub id: String,
    pub label: String,
    pub cwd: String,
    pub command: String,
    pub args: Vec<String>,
    pub port: u16,
    pub url: String,
}

/// tools.json 본문 → 도구 목록. 선행 BOM 허용.
pub fn parse_tools(raw: &str) -> Result<Vec<Tool>, serde_json::Error> {
    serde_json::from_str(raw.trim_start_matches('\u{feff}'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_basic_tool() {
        let raw = r#"[{"id":"x","label":"엑스","cwd":"C:/tmp","command":"streamlit","args":["run","app.py"],"port":8503,"url":"http://localhost:8503/"}]"#;
        let tools = parse_tools(raw).unwrap();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].id, "x");
        assert_eq!(tools[0].port, 8503);
        assert_eq!(tools[0].args, vec!["run", "app.py"]);
    }

    #[test]
    fn parses_empty_array() {
        assert_eq!(parse_tools("[]").unwrap().len(), 0);
    }

    #[test]
    fn rejects_broken_json() {
        assert!(parse_tools("{ not json").is_err());
    }

    #[test]
    fn tolerates_leading_bom() {
        assert_eq!(parse_tools("\u{feff}[]").unwrap().len(), 0);
    }
}
```

`apps/desktop/src-tauri/src/main.rs` 최상단(파일 첫 줄 `#![cfg_attr...]` 바로 아래)에 모듈 선언 추가:

```rust
mod tools;
```

- [ ] **Step 2: 테스트가 실패(혹은 컴파일 에러)하는지 확인**

Run: `cd apps/desktop/src-tauri && cargo test tools::`
Expected: 컴파일/통과. (이 단계에서는 타입과 `parse_tools`가 모두 정의돼 있어 PASS가 정상이다. 만약 오타로 실패하면 메시지를 보고 고친다.)

- [ ] **Step 3: 구현 확인**

위 코드가 곧 구현이다. 추가 코드 없음.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/desktop/src-tauri && cargo test tools::`
Expected: `parses_a_basic_tool`, `parses_empty_array`, `rejects_broken_json`, `tolerates_leading_bom` 4개 PASS.

- [ ] **Step 5: 커밋**

```bash
cd ~/Projects/todak-bear
git add apps/desktop/src-tauri/src/tools.rs apps/desktop/src-tauri/src/main.rs
git commit -m "feat(launcher): Tool 타입 + tools.json 파서 추가"
```

---

## Task 2: 만족도 시드 + 커맨드 조립 + 뷰 변환 (tools.rs)

**Files:**
- Modify: `apps/desktop/src-tauri/src/tools.rs`

- [ ] **Step 1: 실패하는 테스트 작성**

`tools.rs`의 `mod tests` 안에 테스트 4개 추가:

```rust
    #[test]
    fn seed_has_satisfaction_tool() {
        let tools = parse_tools(SEED_TOOLS_JSON).unwrap();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].id, "satisfaction");
        assert_eq!(tools[0].port, 8503);
        assert_eq!(tools[0].cwd, "C:\\Users\\caring\\Projects\\satisfaction_automaiton");
    }

    #[test]
    fn build_command_copies_fields() {
        let t = parse_tools(SEED_TOOLS_JSON).unwrap().remove(0);
        let spec = build_command(&t);
        assert_eq!(spec.program, "streamlit");
        assert_eq!(spec.args[0], "run");
        assert_eq!(spec.cwd, "C:\\Users\\caring\\Projects\\satisfaction_automaiton");
    }

    #[test]
    fn to_view_keeps_display_fields() {
        let t = parse_tools(SEED_TOOLS_JSON).unwrap().remove(0);
        let v = t.to_view();
        assert_eq!(v.id, "satisfaction");
        assert_eq!(v.label, "만족도 자동화");
        assert_eq!(v.port, 8503);
        assert_eq!(v.url, "http://localhost:8503/");
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/desktop/src-tauri && cargo test tools::`
Expected: FAIL — `SEED_TOOLS_JSON`, `build_command`, `to_view`, `ToolView`, `CommandSpec` 미정의로 컴파일 에러.

- [ ] **Step 3: 구현 추가**

`tools.rs`의 `Tool` 정의 아래, `mod tests` 위에 추가:

```rust
/// 프런트로 보낼 최소 정보(실행 명령은 숨긴다).
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ToolView {
    pub id: String,
    pub label: String,
    pub port: u16,
    pub url: String,
}

/// 실행에 필요한 조립된 커맨드.
#[derive(Debug, Clone, PartialEq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
}

impl Tool {
    pub fn to_view(&self) -> ToolView {
        ToolView {
            id: self.id.clone(),
            label: self.label.clone(),
            port: self.port,
            url: self.url.clone(),
        }
    }
}

pub fn build_command(tool: &Tool) -> CommandSpec {
    CommandSpec {
        program: tool.command.clone(),
        args: tool.args.clone(),
        cwd: tool.cwd.clone(),
    }
}

/// 파일이 없을 때 생성할 기본 시드(만족도 한 도구).
/// JSON 문자열 안의 `\\`는 Windows 경로의 백슬래시 한 개를 뜻한다.
pub const SEED_TOOLS_JSON: &str = r#"[
  {
    "id": "satisfaction",
    "label": "만족도 자동화",
    "cwd": "C:\\Users\\caring\\Projects\\satisfaction_automaiton",
    "command": "streamlit",
    "args": ["run", "app.py", "--server.port", "8503", "--server.headless", "true"],
    "port": 8503,
    "url": "http://localhost:8503/"
  }
]
"#;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/desktop/src-tauri && cargo test tools::`
Expected: 이전 4개 + 신규 3개 모두 PASS (총 7개).

- [ ] **Step 5: 커밋**

```bash
cd ~/Projects/todak-bear
git add apps/desktop/src-tauri/src/tools.rs
git commit -m "feat(launcher): 만족도 시드 + build_command + ToolView"
```

---

## Task 3: 도구 로딩 + 포트 점검 헬퍼 (main.rs)

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: 실패하는 테스트 작성**

`main.rs` 맨 끝에 테스트 모듈 추가:

```rust
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

        assert_eq!(tools.len(), 1, "시드가 생성되어 한 도구가 반환돼야 함");
        assert_eq!(tools[0].id, "satisfaction");
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/desktop/src-tauri && cargo test launcher_tests`
Expected: FAIL — `load_tools_from`, `is_port_open` 미정의 컴파일 에러.

- [ ] **Step 3: 헬퍼 구현**

`main.rs`의 `use` 묶음에 추가(파일 상단 use 구역):

```rust
use std::collections::HashMap;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;
use tools::{build_command, parse_tools, Tool, ToolView, SEED_TOOLS_JSON};
```

`window_state_path()` 함수 아래에 헬퍼 추가:

```rust
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/desktop/src-tauri && cargo test launcher_tests`
Expected: `load_tools_seeds_when_file_missing`, `detects_open_then_closed_port` PASS.

> 참고: 이 시점엔 `Tool`/`ToolView`/`build_command` 등 일부 import가 아직 미사용이라 `unused import` 경고가 날 수 있다. Task 4에서 사용하므로 경고는 무시한다.

- [ ] **Step 5: 커밋**

```bash
cd ~/Projects/todak-bear
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(launcher): tools.json 로딩 + 포트 점검 헬퍼"
```

---

## Task 4: AppState 확장 + 조회 command(list_tools, tool_status)

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: AppState에 running 필드 추가**

기존 `struct AppState { ... }`를 다음으로 교체:

```rust
// 우클릭 메뉴가 invoke 하는 커맨드 + 공유 상태.
struct AppState {
    home: Arc<Mutex<(i32, i32)>>,
    wander_enabled: Arc<AtomicBool>,
    // 곰이 띄운 도구 프로세스(중지용). key = tool id.
    running: Mutex<HashMap<String, std::process::Child>>,
}
```

`fn main()` 안의 `let app_state = AppState { ... };` 초기화도 교체:

```rust
    let app_state = AppState {
        home: home.clone(),
        wander_enabled: wander_enabled.clone(),
        running: Mutex::new(HashMap::new()),
    };
```

- [ ] **Step 2: 조회 command 추가**

`#[tauri::command] fn toggle_wander(...)` 아래에 추가:

```rust
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
```

- [ ] **Step 3: invoke_handler에 등록**

`.invoke_handler(tauri::generate_handler![quit, hide_window, reset_pos, toggle_wander])` 를 다음으로 교체:

```rust
        .invoke_handler(tauri::generate_handler![
            quit,
            hide_window,
            reset_pos,
            toggle_wander,
            list_tools,
            tool_status
        ])
```

- [ ] **Step 4: 컴파일/실행 확인**

Run: `cd apps/desktop/src-tauri && cargo build`
Expected: 빌드 성공(에러 없음). 경고는 허용.

- [ ] **Step 5: 커밋**

```bash
cd ~/Projects/todak-bear
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(launcher): list_tools/tool_status command + running 상태"
```

---

## Task 5: 실행/중지 command(launch_tool, stop_tool) + 종료 시 정리

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Windows 콘솔 숨김 import 추가**

`main.rs` use 구역에 추가:

```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;
```

- [ ] **Step 2: launch_tool / stop_tool / kill_all 구현**

`tool_status` command 아래에 추가:

```rust
// CREATE_NO_WINDOW — streamlit 콘솔 창이 뜨지 않게.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

    let child = cmd
        .spawn()
        .map_err(|e| format!("{} 실행 실패: {e}", spec.program))?;
    state.running.lock().unwrap().insert(id, child);

    // 서버 기동을 기다리지 않고 바로 브라우저를 연다(탭이 잠깐 로딩될 수 있음).
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", &tool.url])
        .spawn();
    Ok(())
}

#[tauri::command]
fn stop_tool(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let mut map = state.running.lock().unwrap();
    match map.remove(&id) {
        Some(mut child) => {
            // streamlit 런처는 python 자식을 띄우므로 프로세스 트리째 종료.
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &child.id().to_string()])
                .output();
            let _ = child.wait();
            Ok(())
        }
        None => Err("내가 띄운 게 아니라 끌 수 없어".into()),
    }
}

// 곰이 띄운 모든 도구 프로세스를 트리째 종료.
fn kill_all(state: &tauri::State<AppState>) {
    let mut map = state.running.lock().unwrap();
    for child in map.values_mut() {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &child.id().to_string()])
            .output();
    }
    map.clear();
}
```

- [ ] **Step 3: quit가 자식을 정리하도록 수정**

기존 `quit` command를 교체:

```rust
#[tauri::command]
fn quit(app: tauri::AppHandle, state: tauri::State<AppState>) {
    kill_all(&state);
    app.exit(0);
}
```

- [ ] **Step 4: invoke_handler에 launch_tool/stop_tool 등록**

`generate_handler!`를 다음으로 교체:

```rust
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
```

- [ ] **Step 5: 빌드 + 커밋**

Run: `cd apps/desktop/src-tauri && cargo build`
Expected: 빌드 성공.

```bash
cd ~/Projects/todak-bear
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(launcher): launch_tool/stop_tool + 종료 시 프로세스 정리"
```

---

## Task 6: 프런트 — 메뉴에 도구 그룹 + CSS

**Files:**
- Modify: `apps/desktop/ui/index.html`

- [ ] **Step 1: 도구 그룹 HTML 추가**

`#ctxmenu` 블록에서 산책 항목과 첫 `<div class="sep">` 사이에 도구 그룹을 끼운다. 다음 부분:

```html
    <div class="mi" data-act="wander" id="mi-wander">🚶 산책 끄기</div>
    <div class="sep"></div>
    <div class="mi" data-act="reset">📍 위치 초기화</div>
```

를 다음으로 교체:

```html
    <div class="mi" data-act="wander" id="mi-wander">🚶 산책 끄기</div>
    <div class="sep"></div>
    <div class="mi tools-head">🛠 도구</div>
    <div id="tools-list"></div>
    <div class="sep"></div>
    <div class="mi" data-act="reset">📍 위치 초기화</div>
```

- [ ] **Step 2: CSS 추가**

`#ctxmenu .sep { ... }` 규칙 아래(`</style>` 직전)에 추가:

```css
  #ctxmenu .mi.tools-head { color:#B7ABA0; font-size:11px; padding:4px 12px 2px; cursor:default; }
  #ctxmenu .mi.tools-head:hover { background:transparent; }
  #ctxmenu .tool .dot { display:inline-block; width:8px; height:8px; border-radius:50%;
    margin-right:8px; background:#D8CBB8; vertical-align:middle; }
  #ctxmenu .tool.on .dot { background:#7BAE7F; }
  #ctxmenu .tool .port { color:#B7ABA0; font-size:11px; margin-left:6px; }
```

- [ ] **Step 3: dist에 반영 후 메뉴 모양 확인**

Run: `cd apps/desktop && node build-dist.js && npm run dev`
Expected: 곰 창이 뜨고 우클릭 시 "🛠 도구" 헤더가 보인다(아직 항목은 비어 있음 — 다음 태스크에서 채움). 확인 후 dev 종료.

- [ ] **Step 4: 커밋**

```bash
cd ~/Projects/todak-bear
git add apps/desktop/ui/index.html
git commit -m "feat(launcher): 우클릭 메뉴에 도구 그룹 골격 + CSS"
```

---

## Task 7: 프런트 — 도구 렌더 + 실행/중지 연결

**Files:**
- Modify: `apps/desktop/ui/index.html`

- [ ] **Step 1: renderTools / handleTool 함수 추가**

`<script>` 안, `// ── 우클릭 메뉴 ──` 주석 바로 위(또는 `const ctx = ...` 직전)에 추가:

```js
    // ── 업무 런처(도구 실행/중지) ──
    // 메뉴를 열 때마다 도구 목록 + 포트 상태를 백엔드에서 받아 그린다.
    async function renderTools() {
      const list = document.getElementById('tools-list');
      if (!list || !tau || !tau.core || !tau.core.invoke) return;
      let toolList = [], status = {};
      try {
        toolList = await tau.core.invoke('list_tools');
        status = await tau.core.invoke('tool_status');
      } catch (_) { return; }
      list.innerHTML = '';
      for (const t of toolList) {
        const on = !!status[t.id];
        const el = document.createElement('div');
        el.className = 'mi tool' + (on ? ' on' : '');
        el.dataset.tool = t.id;
        el.dataset.on = on ? '1' : '0';
        el.innerHTML = '<span class="dot"></span>' + t.label +
          (on ? '<span class="port">:' + t.port + '</span>' : '');
        list.appendChild(el);
      }
    }

    async function handleTool(id, on) {
      if (!tau || !tau.core || !tau.core.invoke) return;
      try {
        if (on) {
          await tau.core.invoke('stop_tool', { id });
          say(LANG === 'en' ? 'Closed it. 🐾' : '닫았어. 🐾');
        } else {
          setMood('cheerful', { speak: false });
          say(LANG === 'en' ? 'Opening it for you! 🐾' : '열어줄게! 🐾');
          await tau.core.invoke('launch_tool', { id });
        }
      } catch (_) {
        setMood('hug', { speak: false });
        say(LANG === 'en'
          ? "Hmm, that didn't work. Let's check together. 🤗"
          : '앗, 잘 안 됐어. 같이 확인해보자 🤗');
      }
    }
```

- [ ] **Step 2: 메뉴 열 때 renderTools 호출**

기존 contextmenu 핸들러:

```js
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      ctx.classList.add('show'); // 크기 측정 위해 먼저 표시
```

를 다음으로 교체(도구를 먼저 그린 뒤 크기 측정·표시):

```js
    document.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      await renderTools();
      ctx.classList.add('show'); // 크기 측정 위해 먼저 표시
```

- [ ] **Step 3: 클릭 핸들러에서 도구 항목 처리**

기존 메뉴 클릭 핸들러:

```js
    ctx.addEventListener('click', (e) => {
      const mi = e.target.closest('.mi');
      if (!mi) return;
      e.stopPropagation();
      hideMenu();
      const act = mi.dataset.act;
      if (act === 'pat') petBear();
      else if (act === 'cycle') cycleNext();
      else sendAction({ wander: 'toggle_wander', reset: 'reset_pos', hide: 'hide_window', quit: 'quit' }[act]);
    });
```

를 다음으로 교체:

```js
    ctx.addEventListener('click', (e) => {
      const tool = e.target.closest('.tool');
      if (tool) {
        e.stopPropagation();
        hideMenu();
        handleTool(tool.dataset.tool, tool.dataset.on === '1');
        return;
      }
      const mi = e.target.closest('.mi');
      if (!mi || mi.classList.contains('tools-head')) return;
      e.stopPropagation();
      hideMenu();
      const act = mi.dataset.act;
      if (act === 'pat') petBear();
      else if (act === 'cycle') cycleNext();
      else sendAction({ wander: 'toggle_wander', reset: 'reset_pos', hide: 'hide_window', quit: 'quit' }[act]);
    });
```

- [ ] **Step 4: dist 반영 후 동작 확인 (수동 스모크)**

Run: `cd apps/desktop && node build-dist.js && npm run dev`
Expected:
1. 우클릭 → "🛠 도구" 아래 `○ 만족도 자동화` 표시.
2. 클릭 → 곰이 `열어줄게! 🐾`, 잠시 후 기본 브라우저에 `http://localhost:8503/`가 열리고 만족도 앱이 뜬다(서버 기동에 수 초 소요 가능).
3. 다시 우클릭 → `● 만족도 자동화 :8503` (켜짐, 초록 점).
4. 클릭 → 곰이 `닫았어. 🐾`, 잠시 후 우클릭하면 다시 `○`(포트 닫힘).
5. 우클릭 → ✕ 종료 → 곰 종료 후 만족도 서버 프로세스도 사라짐(작업관리자에서 streamlit/python 잔존 없음).

- [ ] **Step 5: 커밋**

```bash
cd ~/Projects/todak-bear
git add apps/desktop/ui/index.html
git commit -m "feat(launcher): 도구 목록 렌더 + 실행/중지 + 곰 반응"
```

---

## Task 8: 최종 검증 + 정리

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 전체 테스트**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: `tools::` 7개 + `launcher_tests` 2개 모두 PASS.

- [ ] **Step 2: 릴리스 빌드 점검(선택)**

Run: `cd apps/desktop && npm run build`
Expected: `node build-dist.js` 실행 후 `tauri build` 성공.

- [ ] **Step 3: 오류 경로 수동 확인**

`~/.todak/tools.json`에서 `satisfaction`의 `cwd`를 일부러 존재하지 않는 경로로 바꾼 뒤 `npm run dev`로 실행 → 도구 클릭 → 곰이 `앗, 잘 안 됐어… 🤗`(hug) 반응, 앱은 크래시하지 않음. 확인 후 `cwd` 원복(또는 파일 삭제로 시드 재생성).

- [ ] **Step 4: 브랜치 마무리**

REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`로 병합/PR 여부를 결정한다.

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지:** UX(우클릭 도구 그룹·상태점·토글)=Task 6·7 / tools.json 데이터주도+시드=Task 2·3 / 백엔드 command 4종=Task 4·5 / 포트 상태 판정=Task 3·4 / std::process 실행=Task 5 / 종료 시 정리=Task 5 / 오류 위로 톤=Task 7·8 / 테스트=Task 1·2·3·8. 누락 없음.
- **Placeholder:** TBD/“적절히 처리” 류 없음. 모든 코드 단계에 실제 코드 포함.
- **타입 일관성:** `Tool`/`ToolView`/`CommandSpec`, command `list_tools`/`tool_status`/`launch_tool`/`stop_tool`, 헬퍼 `load_tools`/`load_tools_from`/`is_port_open`/`kill_all`, 프런트 `renderTools`/`handleTool`, dataset `data-tool`/`data-on`, CSS `.tool`/`.tool.on`/`.dot`/`.port`/`.tools-head` — 태스크 간 명칭 일치 확인.
