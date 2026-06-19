# 🍯 토닥곰 미니게임 설계 — "꿀단지 받기" (Honey Catch)

- **날짜:** 2026-06-19
- **표면:** 웹 (GitHub Pages, `docs/play/`)
- **단계:** 곰 우주 게임 로드맵 1/3 (① 미니게임 → ② 다마고치 → ③ Phaser)
- **상태:** 설계 승인됨, 구현 계획 대기

## 1. 목적 / 한 줄 요약

곰을 좌우로 움직여 하늘에서 떨어지는 **꿀단지(+1)·별(+5)** 을 받는 캐주얼 받기 게임.
"혼내지 않고 토닥이는" 곰 우주 톤을 게임에서도 유지한다 — 실패해도 곰이 안아준다.

## 2. 핵심 규칙 (확정)

| 항목 | 결정 |
|---|---|
| 조작 | PC `←`/`→` 키, 모바일 화면 좌/우 절반 탭&홀드 + (선택) 곰 드래그 |
| 받는 것 | 🍯 꿀단지 +1 (일반), ⭐ 별 +5 (가끔 등장·반짝). **피할 것 없음** |
| 미스 | 놓치면 하트 1개 감소(♥♥♥), 0이 되면 곰이 포옥 안아주고 재시작 |
| 곰 표현 | 기존 포즈 PNG 재사용 — 평소 `content` / 받음 `cheer`(짧게) / 게임오버 `hug` |
| 난이도 | 시간(`elapsed`)에 따라 낙하 속도·생성 빈도 완만히 증가 |
| 대상 | 웹 (PC + 모바일), 서명·설치·의존성 0 |

## 3. 구현 접근

**순수 HTML + Canvas + requestAnimationFrame (바닐라 JS, 의존성 0, 빌드 없음).**
현재 곰 우주 스택과 일치하고, 받기 게임은 캔버스의 가장 단순한 예제 수준이며,
순수 게임 루프를 한 번 직접 만들어보는 것이 ③ Phaser 학습의 디딤돌이 된다.

대안으로 검토 후 제외:
- **DOM 엘리먼트 방식:** 아이템 많아지면 캔버스보다 버벅임, 좌표·충돌 로직은 어차피 필요.
- **지금 Phaser 도입:** ③단계로 의도적으로 미룸. 받기 게임 하나에 게임엔진은 과함(YAGNI).

## 4. 모듈 구조 (관심사 분리)

곰 우주 철학(코어 1개, 표면 다수)에 맞춰 순수 로직 / 렌더 / 입력 / 셸을 분리한다.
핵심은 게임 로직을 DOM·캔버스에서 떼어 **노드에서 단위 테스트 가능**하게 만드는 것.

```
docs/play/
├ honey-catch.html      ← 셸: 캔버스 + rAF 루프 배선 + UI 오버레이
├ game-core.js          ← 순수 로직 (DOM 없음): tick·spawn·충돌·점수·라이프
├ renderer.js           ← 캔버스 그리기 + 곰 포즈 교체
├ input.js              ← 키보드(←/→) + 터치 → 의도(left/right/none)
├ build.js              ← bear-core·포즈를 assets로 복사 (build-dist.js와 동일 패턴)
└ assets/
   ├ todak.js           ← packages/bear-core 복사본 (대사·팔레트 재사용)
   └ poses/             ← content·cheer·hug.png (압축본 3장만)
```

| 모듈 | 하는 일 | 의존 | 인터페이스 |
|---|---|---|---|
| `game-core` | 상태 1개 받아 다음 상태 반환. 순수 함수 | 없음 | `createState(opts)`, `tick(state, intent, dt)`, `reset(state)` |
| `renderer` | 상태 → 캔버스. 곰 포즈 교체 | poses, canvas ctx | `draw(ctx, state)`, `preload()` |
| `input` | 키/터치 → 의도 | DOM 이벤트 | `attach(el)`, `read() -> 'left'|'right'|null` |
| `honey-catch.html` | rAF 루프로 셋을 배선 + 시작/게임오버 오버레이 | 위 셋 + todak.js | — |

## 5. 데이터 흐름 (게임 루프)

```
requestAnimationFrame(dt)
   → intent = input.read()                       // 'left' | 'right' | null
   → state  = gameCore.tick(state, intent, dt)   // 순수
   → renderer.draw(ctx, state)
   → state.over? → 오버레이(hug 포즈 + "괜찮아, 다시 해보자 🐾" + "다시 하기")
```

**상태 모양 (단일 객체):**
```js
{
  bearX,            // 곰 가로 위치 — 캔버스 논리 좌표(CSS px) 기준
  items: [ { x, y, type: 'honey' | 'star', vy } ],  // 모두 같은 논리 좌표계
  score, best,
  lives,            // 3에서 시작
  over,             // boolean
  elapsed,          // 누적 시간(난이도용)
  spawnTimer        // 다음 생성까지 남은 시간
}
```

- **받음:** 곰과 아이템 사각형 겹침(AABB) → honey +1 / star +5, 곰 잠깐 `cheer` 포즈
- **놓침:** 아이템이 바닥 통과 → `lives--`, 0이면 `over=true` → `hug` 포즈 + 위로 대사
- **난이도:** `elapsed` 증가에 따라 낙하 속도·생성 빈도 완만히 상승. 별은 낮은 확률·반짝임

## 6. 상태·저장 / 캐릭터 연동

- **최고점수:** `localStorage['todak.honeycatch.best']` (없으면 0)
- 곰 대사·팔레트는 `assets/todak.js`(bear-core 복사본)에서 가져와 톤 일관성 유지
- 게임이 쓰는 포즈는 3종(`content`, `cheer`, `hug`)뿐

## 7. 반응형 / 모바일

- 캔버스는 컨테이너에 맞춰 크기 조정, **세로형 비율(3:4)** 로 폰에 자연스럽게
- `devicePixelRatio` 반영해 또렷하게 렌더
- 입력: PC `←`/`→`, 모바일 화면 좌/우 절반 탭&홀드 + (선택) 곰 드래그
- 탭 전환 시 `visibilitychange`로 일시정지 (dt 폭주 방지)

## 8. 에러 처리 (조용히 견디기)

- `localStorage` 막힘(시크릿 모드) → try/catch, 메모리 최고점으로 폴백
- **포즈 이미지 로드 실패** → `todak.js`의 ASCII 얼굴(`ʕ•ᴥ•ʔ`)·색 원으로 폴백 → 그래도 플레이 가능
- 첫 프레임 dt 튐 방지(상한 클램프, 예: 최대 50ms)

## 9. 테스트

- **순수 로직(`game-core`)**: 노드에서 프레임워크 없이 검증
  - 꿀 받으면 +1, 별 받으면 +5
  - 놓치면 라이프 −1, 0에서 `over=true`
  - 시드 RNG로 생성 결정성 (재현 가능한 테스트)
- **수동**: 브라우저에서 플레이. 원하면 Playwright로 스모크 테스트

## 10. 선행 작업 (필수): 에셋 다이어트

게임이 쓰는 포즈는 3장뿐(content·cheer·hug). 이 중 `hug.png`가 1.8MB라 웹 로딩에 치명적.
→ **3장을 각 ~100KB 이하로 압축**해 `docs/play/assets/poses/`에 배치. 나머지 포즈는 이 게임엔 불필요.

## 11. 범위 밖 (YAGNI)

- 게임엔진(Phaser) — ③단계
- 번들러/TypeScript/테스트 프레임워크 — 토이 단계엔 과함
- 온라인 랭킹/서버 — 최고점은 로컬 저장만
- 사운드 — 1차 범위 밖 (추후 옵션)

## 12. 재활용 가치

`game-core`의 "상태 1개 → tick → render" 패턴과 rAF 루프는
② 다마고치, ③ Phaser 단계에서 그대로 재활용 가능.
같은 곰(bear-core·poses)을 공유해 표면 간 캐릭터 일관성 유지.
