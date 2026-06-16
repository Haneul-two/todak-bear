# 토닥곰 업무 런처 (v1 — 만족도 자동화)

- 날짜: 2026-06-16
- 대상: `apps/desktop` (Tauri 2 데스크톱 펫)
- 범위: 우클릭 메뉴에서 로컬 업무 도구(Streamlit 앱)를 실행·중지하고 상태를 표시. v1은 만족도 자동화 한 도구만.

## 배경

토닥곰은 `bear-core` 단일 캐릭터를 여러 표면(terminal / github / desktop)이 공유하는 "위로 펫"이다. 데스크톱 표면은 신호 패턴(`signals/*` → `~/.todak/state.json` → Rust가 2초마다 읽어 `todak://state` emit → bear-core JS가 기분 결정)으로 코딩 세션 이벤트에 **수동적으로** 반응한다.

이번 작업은 곰을 **능동적 런처**로 확장한다: 곰에게 일을 부탁하면 이미 만들어 둔 로컬 도구를 띄워 준다. 새 AI 기능이 아니라 기존 자산의 "진입점" 역할이다.

## 목표 / 비목표

목표
- 우클릭 메뉴에서 만족도 자동화 Streamlit 앱을 한 번에 실행(서버 기동 + 브라우저 열기)한다.
- 도구가 켜져 있는지(포트 도달 여부)를 메뉴에 표시한다.
- 켜진 도구를 메뉴에서 중지한다.
- 도구 목록을 코드 수정 없이 늘릴 수 있게 외부 설정(`tools.json`)으로 둔다.

비목표 (v1)
- 작업 완료 알림(만족도 발송목록 생성됨 등) — 추후 watcher/notifier 연동.
- CRM 분류기·발송 추출기 등 다른 도구 — tools.json에 한 줄 추가로 확장 가능하나 v1 구현·검증 대상 아님.
- 좌클릭 런처 패널(접근 B), 트레이 메뉴(접근 C).

## UX

우클릭 → 기존 `#ctxmenu`에 구분선 아래 "🛠 도구" 그룹 추가. v1 항목 하나:

```
ʕ•ᴥ•ʔ  ← 우클릭
┌─────────────────┐
│ 🛠 도구           │
│ ○ 만족도 자동화    │  ← 꺼짐: 클릭=실행 + 브라우저
├─────────────────┤
│ 산책 끄기          │
│ 숨기기 / 종료       │
└─────────────────┘
```

- 꺼짐(`○`): 클릭 → `launch_tool("satisfaction")` → Streamlit 서버 기동 + 브라우저로 `http://localhost:8503/` 열기. 곰이 잠깐 `열어줄게! 🐾` 반응.
- 켜짐(`● 만족도 자동화 :8503`): 클릭 → `stop_tool("satisfaction")` → 서버 중지.
- 상태는 **포트 도달 여부**(해당 `port`로 짧은 타임아웃 TCP 연결)로 판정 → 곰이 띄우지 않은 서버도 정확히 반영.

## 도구 설정 — `~/.todak/tools.json`

데이터 주도. 파일이 없으면 만족도 시드로 자동 생성. (`TODAK_HOME` 환경변수 우선, 없으면 `~/.todak`)

```json
[
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
```

필드: `id`(고유), `label`(메뉴 표시), `cwd`(작업 디렉터리), `command`+`args`(spawn할 명령), `port`(상태 판정용), `url`(브라우저로 열 주소). 도구 추가 = 배열에 객체 한 개 추가, 메뉴 자동 반영.

## 백엔드 (Rust, `src-tauri/src/main.rs`)

기존 command/AppState 패턴 그대로 확장.

- 새 command:
  - `list_tools() -> Vec<ToolView>`: tools.json 읽어 `{id, label, port, url}` 반환.
  - `launch_tool(id)`: 해당 도구를 `cwd`에서 `command`+`args`로 `std::process::Command` spawn → `running` 맵에 `Child` 보관. 이어 브라우저 `cmd /c start "" <url>` 실행. 성공/실패를 결과로 반환.
  - `stop_tool(id)`: `running` 맵의 `Child`를 kill하고 제거.
  - `tool_status() -> HashMap<id, bool>`: 각 도구 `port`에 `TcpStream::connect_timeout`(예: 300ms) 시도 → 도달하면 true.
- `AppState`에 `running: Mutex<HashMap<String, std::process::Child>>` 추가.
- `quit` command 및 앱 종료 시 `running`의 모든 자식 프로세스 kill.
- tools.json 경로 헬퍼는 기존 `state_path()` / `window_state_path()`와 동일한 `TODAK_HOME` 규칙을 따른다.

순수 로직은 부수효과에서 분리:
- `parse_tools(&str) -> Result<Vec<Tool>, _>` (JSON 파싱)
- `build_command(&Tool) -> (program, args, cwd)` (커맨드 조립)
- 상태 판정 입력을 "포트 도달 여부 함수"로 주입 가능하게 분리 (테스트에서 가짜 prober 사용)

## 프런트 (`apps/desktop/ui/index.html`)

기존 `#ctxmenu` 스타일·동작 재사용.

- 우클릭으로 메뉴를 열 때 `list_tools` + `tool_status`를 invoke → "🛠 도구" 그룹 항목을 동적 렌더(상태 점 `●/○`, 켜짐이면 `:port` 표기).
- 항목 클릭 → 켜짐이면 `stop_tool(id)`, 꺼짐이면 `launch_tool(id)` invoke → 짧은 지연 후 `tool_status` 재조회로 갱신.
- 실행 직후엔 서버 기동에 시간이 걸리므로 즉시 켜짐으로 안 바뀔 수 있음 → 메뉴를 닫지 않고 1~2초 후 상태를 한 번 더 폴링하거나, 다음 메뉴 열림에서 반영.

## 권한 / 빌드

- 실행은 JS 셸 플러그인이 아니라 Rust `std::process`로 수행 → 새 Tauri JS capability 불필요. 새 command만 `invoke_handler`에 등록.
- 전제: `streamlit`이 시스템 PATH에 있어야 함(venv 없음, 전역 설치 확인됨). PATH에서 못 찾으면 오류 처리로 안내.

## 오류 처리 (위로 톤)

- `streamlit` 실행 파일 없음 / `cwd` 폴더 없음 / spawn 실패 → 곰이 `hug` 무드로 한 마디(예: `앗, 만족도 앱을 못 찾았어. 같이 확인해보자 🤗`) + 메뉴 항목에 에러 표시. 앱은 크래시하지 않는다.
- 포트가 이미 점유(다른 프로세스) → 상태는 켜짐으로 보이되, 곰이 띄운 자식이 없으면 `stop_tool`은 "내가 띄운 게 아니라 끌 수 없어" 안내.

## 테스트

- Rust 단위 테스트: `parse_tools`(정상/깨진 JSON/빈 배열), `build_command`(필드 → program/args/cwd), 상태 판정(가짜 prober로 true/false).
- 수동 스모크: 메뉴에서 만족도 실행 → 브라우저 열림·포트 도달 확인 → 중지 → 포트 끊김 확인. 곰 종료 시 자식 정리 확인.

## 확장 경로 (참고, v1 비범위)

- CRM 분류기·발송 추출기: tools.json에 항목 추가.
- 완료 알림: 기존 `signals/`처럼 도구가 `state.json`/별도 신호를 쓰면 곰이 팝업 반응(접근 "실행 + 완료 알림").
