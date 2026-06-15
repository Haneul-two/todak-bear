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
- **Windows 설치 파일:** [최신 릴리즈 다운로드](https://github.com/Haneul-two/todak-bear/releases/latest/download/todak-bear_0.1.0_x64-setup.exe) (약 8&nbsp;MB) — 실행 시 SmartScreen 경고가 뜨면 `추가 정보 → 실행`(아직 코드서명 전 단계)
- **무결성 검증:** 다운로드 후 `Get-FileHash todak-bear_0.1.0_x64-setup.exe -Algorithm SHA256` 결과가 릴리즈의 [`.sha256` 체크섬](https://github.com/Haneul-two/todak-bear/releases/latest/download/todak-bear_0.1.0_x64-setup.exe.sha256)과 같은지 확인하세요 (`344ac433…7d876a02`).

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

# #1 데스크톱 곰 (지금 당장: 브라우저로)
node apps/desktop/build-dist.js
#   → apps/desktop/dist/index.html 을 브라우저로 열기

# #1 진짜 바탕화면 펫 (Rust 필요)
#   1) https://rustup.rs 로 Rust 설치
#   2) cd apps/desktop && npm install && node build-dist.js && npm run dev
```

## 상태

| 표면 | 상태 |
|---|---|
| bear-core | ✅ 완성·검증 (8기분 렌더 확인) |
| #2 터미널 | ✅ 완성·검증 (성공/실패/영어 확인) |
| #3 GitHub | ✅ 완성·검증 (카드 3종 + Action 워크플로) |
| #1 데스크톱 | ✅ **v0.1.0 출시** — Tauri 빌드·NSIS 설치 파일 [Release](https://github.com/Haneul-two/todak-bear/releases) 게시 |
| 🌐 랜딩 | ✅ [GitHub Pages 라이브](https://haneul-two.github.io/todak-bear/) (KO/EN) |

## License
MIT
