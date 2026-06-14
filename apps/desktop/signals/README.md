# 🐻 토닥곰 실신호 연결

신호원들이 `~/.todak/state.json`(또는 `$TODAK_HOME/state.json`)에 기록 → Tauri 백엔드가 2초마다 읽어 곰에게 전달 → 곰이 기분을 바꿉니다. 신호원과 곰은 **파일로만** 만나서 서로 독립적이에요(하나 꺼져도 곰은 안 죽음).

```
Claude statusline JSON ─┐
Claude Code 훅 ─────────┼─► ~/.todak/state.json ─► Tauri ─IPC─► 곰
셸 종료코드 ────────────┘
```

## 1) Claude Code statusline → 한도%·비용

이미 곰 statusline을 쓰면, 그 출력을 이 writer로 한 번 더 통과시키면 됩니다(출력은 그대로 보임).
`~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline-bear.js | node /경로/todak-bear/apps/desktop/signals/from-statusline.js"
  }
}
```

> statusline만 단독으로 쓰려면 `from-statusline.js`에 세션 JSON을 직접 파이프해도 됩니다.

## 2) Claude Code 훅 → 완료·에러·활동

`~/.claude/settings.json` 의 `hooks`:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command",
        "command": "node /경로/todak-bear/apps/desktop/signals/claude-hook.js --event done" }] }
    ],
    "PostToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command",
        "command": "node /경로/todak-bear/apps/desktop/signals/claude-hook.js --event activity" }] }
    ]
  }
}
```

- **Stop** → 작업 끝 → 박수곰(`cheer`)
- **PostToolUse** → 도구 사용 기록(막힘 타이머 리셋). tool 출력에 error/traceback이 보이면 자동으로 **안아주는 곰**(`hug`)으로 승격
- 한참 도구 호출이 없으면 `stuckMinutes`가 쌓여 10분↑에 **토닥곰**(`pat`)

> Windows 경로는 `node \"C:\\path\\...\\claude-hook.js\" --event done` 처럼 따옴표·이스케이프 주의.

## 3) 셸 종료코드 → 위로

#2 터미널 프롬프트와 함께 쓰면 됩니다. PowerShell `$PROFILE` 예:

```powershell
function prompt {
  $code = if ($?) { 0 } else { 1 }
  node "C:\경로\todak-bear\apps\desktop\signals\from-shell.js" --status $code | Out-Null
  "PS $($executionContext.SessionState.Path.CurrentLocation)> "
}
```

## 상태 파일 스키마

```jsonc
{
  "usage": 92,                       // 최근 한도 % (statusline)
  "cost": 3.2,                       // 세션 비용(USD, 선택)
  "lastActivityAt": 1718...,         // 마지막 활동 epoch ms (stuckMinutes 계산)
  "event": { "type": "error", "at": 1718... }, // 순간 이벤트(8초 TTL)
  "activity": "high",                // 선택
  "updatedAt": 1718...
}
```

## 직접 검증

```bash
node apps/desktop/signals/e2e-test.js   # 신호원→파일→기분 전 경로 (격리 홈, 실파일 안 건드림)
```
