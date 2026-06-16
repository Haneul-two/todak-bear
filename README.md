# 🐻 토닥곰 (Todak) — 혼내지 않고 토닥이는 곰

터미널·GitHub·바탕화면을 **한 마리 곰**이 따라다니는 곰 우주.
경쟁작 펫이 "잘못하면 화내는" 다그치는 캐릭터라면, 토닥곰은 정반대 —
막히면 토닥이고, 새벽이면 재워주고, 에러 나면 안아줍니다.

```
 ∩─────∩
ʕ  ᵔᴥᵔ  ʔ   "괜찮아, 막힐 수도 있지. 같이 해보자. 🐾"
 ( ╹ ╹ )
```

## 구조 — 코어 하나, 표면 셋

```
packages/bear-core/todak.js   🫀 단일 캐릭터 스펙 (표정·기분·이름·팔레트·대사)
        │  같은 곰을 셋이 그대로 가져감 → 어느 표면에서나 동일 캐릭터
   ┌────┼──────────────────┬─────────────────────┐
apps/terminal          apps/github-profile     apps/desktop
한 줄 프롬프트 곰         프로필 SVG 카드 곰        Tauri 데스크톱 펫
(직전 종료코드·시각 반응)  (이번 주 커밋 → 기분)     (떠다니는 위로 곰)
```

기존 `claude-code-bear-statusline`(이미 보유)이 이 우주의 네 번째 표면 — statusline 곰입니다.

## 🌐 웹사이트 · 다운로드

- **소개 페이지:** https://haneul-two.github.io/todak-bear/ (한국어/English)
- **Windows 설치 파일:** [최신 릴리즈 다운로드](https://github.com/Haneul-two/todak-bear/releases/latest/download/todak-bear_0.2.0_x64-setup.exe) (약 8&nbsp;MB) — 실행 시 SmartScreen 경고가 뜨면 `추가 정보 → 실행`(아직 코드서명 전 단계)
- **macOS 설치 파일:** [최신 릴리즈](https://github.com/Haneul-two/todak-bear/releases/latest)에서 칩에 맞는 `.dmg`를 받으세요 — Apple Silicon(M1~)은 `_aarch64.dmg`, Intel은 `_x64.dmg`. 미서명이라 `.dmg`에서 `todak-bear`를 `응용 프로그램`으로 드래그한 뒤, 터미널에서 `xattr -dr com.apple.quarantine /Applications/todak-bear.app`을 한 번 실행하면 열립니다(“`todak-bear`은(는) 손상되었기 때문에…” 경고는 앱 문제가 아니라 macOS 격리 표시 때문이에요. Apple 공증 전 단계). (맥/윈도우 설치 파일은 [`release-desktop` 워크플로](.github/workflows/release.yml)가 `v*` 태그 푸시 시 자동 빌드)
- **무결성 검증:** 설치 파일마다 같은 이름의 `.sha256` 파일이 릴리즈에 함께 올라갑니다. 다운로드 후 Windows는 `Get-FileHash …setup.exe -Algorithm SHA256`, macOS는 `shasum -a 256 …dmg` 결과가 `.sha256` 내용과 같은지 확인하세요.

## 기분 사전 (위로 톤)

| 상황 | 기분 | 곰의 한 마디 |
|---|---|---|
| 활발 | cheerful `◕ᴥ◕` | 좋아, 오늘 컨디션 최고야! 🐾 |
| 꾸준 | content `•ᴥ•` | 잘 가고 있어, 천천히 가자. |
| 한도 70%↑ | cozy `˘ᴥ˘` | 따뜻한 차 한 잔 어때? ☕ |
| 10분↑ 막힘 | pat `ᵔᴥᵔ` | 괜찮아, 막힐 수도 있지. 같이 해보자. 🐾 |
| 완료 | cheer `≧ᴥ≦` | 해냈다! 정말 잘했어! 👏 |
| 새벽 1~6시 | sleepy `-ᴥ-` | 늦었네… 이제 자도 괜찮아. 🌙 |
| 한도 90%↑ | worried `ᵕᴥᵕ` | 조금만 아껴 쓰자, 무리하지 말고. 💛 |
| 에러 | hug `ᴗᴥᴗ` | 에러 났구나. 자, 안아줄게. 다시 가보자. 🤗 |

## 빠른 체험

```bash
# 코어 데모 (모든 기분 한 번에)
node packages/bear-core/demo.js

# #2 터미널 곰
node apps/terminal/todak-prompt.js --status 1     # 실패 → 안아주는 곰

# #3 GitHub 카드
node apps/github-profile/generate.js --commits 12 --out card.svg

# #1 데스크톱 곰 — ① 가장 쉬운 방법: 설치 파일 다운로드 (빌드 불필요)
#   → 위 "웹사이트·다운로드"의 todak-bear_x64-setup.exe 받아 실행

# #1 데스크톱 곰 — ② 설치 없이 브라우저로 미리보기 (Rust 불필요)
node apps/desktop/build-dist.js
#   → apps/desktop/dist/index.html 을 브라우저로 열기

# #1 데스크톱 곰 — ③ 소스에서 직접 빌드·실행 (Rust 필요)
#   1) https://rustup.rs 로 Rust 설치
#   2) cd apps/desktop && npm install && node build-dist.js && npm run dev
#   3) 설치 파일 만들기: npm run build → src-tauri/target/release/bundle/nsis/
```

## 상태

| 표면 | 상태 |
|---|---|
| bear-core | ✅ 완성·검증 (8기분 렌더 확인) |
| #2 터미널 | ✅ 완성·검증 (성공/실패/영어 확인) |
| #3 GitHub | ✅ 완성·검증 (카드 3종 + Action 워크플로) |
| #1 데스크톱 | ✅ **v0.1.0 출시** — Tauri 빌드·NSIS(.exe) 설치 파일 [Release](https://github.com/Haneul-two/todak-bear/releases) 게시 · 맥(.dmg)/윈도우 멀티 OS 자동 빌드 CI 추가 |
| 🌐 랜딩 | ✅ [GitHub Pages 라이브](https://haneul-two.github.io/todak-bear/) (KO/EN) |

## License
MIT
