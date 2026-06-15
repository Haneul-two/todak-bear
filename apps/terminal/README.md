# 🐻 토닥곰 터미널 프롬프트

셸의 **직전 명령 종료코드**와 **시각**에 반응하는 한 줄 곰. 명령이 실패하면 혼내는 대신 안아줍니다.

```
~/project on  main
ʕᴗᴥᴗʔ 에러 났구나. 자, 안아줄게. 다시 가보자. 🤗
$
```

## Starship (권장, 크로스 셸)

`~/.config/starship.toml` 에 추가:

```toml
[custom.todak]
command = "node /path/to/todak-bear/apps/terminal/todak-prompt.js --status $status"
when = true
format = "$output\n"
```

> Starship은 `$status`(직전 종료코드)를 그대로 넘겨줍니다. `--lang en` 으로 영어 곰도 가능.

## PowerShell

`$PROFILE` 에 추가:

```powershell
function prompt {
  $code = if ($?) { 0 } else { 1 }
  $bear = node "C:\path\to\todak-bear\apps\terminal\todak-prompt.js" --status $code
  "$bear`nPS $($executionContext.SessionState.Path.CurrentLocation)> "
}
```

## Bash / Zsh

`~/.bashrc` 또는 `~/.zshrc`:

```bash
todak_prompt() {
  local code=$?
  node /path/to/todak-bear/apps/terminal/todak-prompt.js --status $code
  echo
}
PROMPT_COMMAND=todak_prompt   # bash
# zsh: precmd() { todak_prompt }
```

## 옵션
- `--status <code>` 직전 종료코드 (0 아니면 위로 곰)
- `--duration <ms>` 명령 소요시간 (10분↑이면 토닥)
- `--lang ko|en` 언어
- `--no-color` 색 끄기
