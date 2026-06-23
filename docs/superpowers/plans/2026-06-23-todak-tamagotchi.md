# 토닥곰 다마고치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토닥곰을 밥·놀이·토닥·재우기로 돌보며 아기→노년까지 키우는 웹 다마고치를 `docs/play/`에 추가한다.

**Architecture:** 꿀단지게임(①)에서 검증된 "순수 코어 + 렌더 + 입력 + 셸" 분리 패턴 그대로. 게임 로직은 DOM/캔버스 비의존 순수 모듈(`tama-core.js`)로 만들어 노드에서 단위 테스트하고, 캔버스 렌더·버튼 입력·rAF 루프·localStorage는 얇은 셸이 배선한다. 시간은 오프라인 실시간(접속 간 경과시간 일괄 차감).

**Tech Stack:** 바닐라 JS(ES2017), HTML5 Canvas, requestAnimationFrame, localStorage. 빌드·번들러·의존성 0. 테스트는 `node:test`/`node:assert`.

## Global Constraints

- 의존성 0 · 빌드 없음 · 순수 바닐라 JS (코어는 Node+브라우저 공용; `module.exports`와 `window.*` 양쪽 노출).
- 논리 좌표계 고정: `WIDTH=360`, `HEIGHT=480` (3:4 세로). 모든 좌표·히트박스는 이 논리좌표 기준.
- 스탯 4종 키: `hunger`(🍯 배부름), `fun`(⚽ 즐거움), `heart`(💗 마음), `energy`(😴 기력). 각 0~100.
- 행동→스탯 매핑: `feed→hunger`, `play→fun`, `pat→heart`, `sleep→energy`.
- 수치(verbatim): 감소 `DECAY_PER_HOUR=6`(시간당), 돌봄 `CARE_AMOUNT=35`, 쿨다운 `COOLDOWN=1.5`초, 행복연출 `FLASH=1.5`초, 졸림밴드 `SLEEP_BAND=25`, 욕구밴드 `NEED_BAND=30`, 행복평균 `HAPPY_AVG=85`, 상한 `MAX=100`.
- 성장(실제 경과일): 아기 `<1`, 소년 `<3`, 어른 `<7`, 노년 `≥7`. `DAY_MS=86400000`.
- 스프라이트: `assets/poses/${stage}_${pose}.png` (stage=baby|child|adult|elder, pose=content|sad|sleep|happy) — 이미 16종 배치됨.
- 저장 키: `localStorage['todak.tama.v1']`. 막힘/깨짐 시 조용히 폴백(새 곰).
- 톤: 위로/응원만. 절대 혼내지 않음. 한국어 UI.
- 테스트 실행: `docs/play/`에서 `node --test tama-core.test.js`.
- 커밋: 작고 잦게. 기존 honey-catch 파일(`game-core.js` 등)·에셋은 건드리지 않음.

---

## File Structure

```
docs/play/
├ tamagotchi.html       ← (신규) 셸: 캔버스 + rAF + localStorage + 성장 토스트 배선
├ tama-core.js          ← (신규) 순수 로직: 상태·돌봄·감소·성장·표정·말풍선·직렬화·상수
├ tama-core.test.js     ← (신규) node:test 단위 테스트
├ tama-renderer.js      ← (신규) 캔버스 렌더: 스탯바·곰·말풍선·버튼
├ tama-input.js         ← (신규) 버튼 히트테스트 입력
└ assets/poses/         ← (기존) 16 스프라이트 사용
docs/index.html         ← (수정) 다마고치 진입 링크 + i18n 키
```

| 모듈 | 책임 | 의존 | 핵심 인터페이스 |
|---|---|---|---|
| `tama-core` | 상태 1개 → 다음 상태(순수). 상수·표정·말풍선·직렬화 | 없음 | `createState`, `care`, `tick`, `applyElapsed`, `growthStage`, `poseFor`, `bubbleFor`, `serialize`, `deserialize`, 상수 `WIDTH/HEIGHT/BUTTONS/STATS/...` |
| `tama-input` | 포인터/터치 → 버튼 의도 | DOM, core 상수 | `createInput()`, `attach(input, el, core)`, `hitTest(buttons, lx, ly)` |
| `tama-renderer` | 상태 → 캔버스. 단계+표정 스프라이트 | core, ctx, poses | `createRenderer(core, base)`, `draw(ctx, state, nowMs)` |
| `tamagotchi.html` | rAF 루프 배선 + 저장/복원 + 오프라인경과 + 토스트 | 위 셋 + todak.js | — |

---

## Task 1: tama-core 기초 — 상수 + clamp + createState

**Files:**
- Create: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Produces: 상수 `WIDTH=360, HEIGHT=480, MAX=100, DECAY_PER_HOUR=6, CARE_AMOUNT=35, COOLDOWN=1.5, FLASH=1.5, SLEEP_BAND=25, NEED_BAND=30, HAPPY_AVG=85, DAY_MS=86400000, STAGE_DAYS={child:1,adult:3,elder:7}, ACTIONS={feed:'hunger',play:'fun',pat:'heart',sleep:'energy'}`; `clamp(v,lo,hi)`; `createState(opts) -> {name,bornAt,lastSeen,stats:{hunger,fun,heart,energy},flash,cooldown:{feed,play,pat,sleep}}`.

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./tama-core.js');

test('createState 기본값', () => {
  const s = C.createState({ bornAt: 1000 });
  assert.strictEqual(s.name, '토닥곰');
  assert.strictEqual(s.bornAt, 1000);
  assert.strictEqual(s.lastSeen, 1000);
  assert.deepStrictEqual(s.stats, { hunger: 80, fun: 80, heart: 80, energy: 80 });
  assert.strictEqual(s.flash, 0);
  assert.deepStrictEqual(s.cooldown, { feed: 0, play: 0, pat: 0, sleep: 0 });
});

test('clamp 동작', () => {
  assert.strictEqual(C.clamp(150, 0, 100), 100);
  assert.strictEqual(C.clamp(-5, 0, 100), 0);
  assert.strictEqual(C.clamp(42, 0, 100), 42);
});

test('상수 노출', () => {
  assert.strictEqual(C.WIDTH, 360);
  assert.strictEqual(C.HEIGHT, 480);
  assert.strictEqual(C.DECAY_PER_HOUR, 6);
  assert.deepStrictEqual(C.ACTIONS, { feed: 'hunger', play: 'fun', pat: 'heart', sleep: 'energy' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `Cannot find module './tama-core.js'`

- [ ] **Step 3: Write minimal implementation**

Create `docs/play/tama-core.js`:

```js
'use strict';
// 토닥곰 다마고치 — 순수 로직 (DOM/canvas 비의존, Node+브라우저 공용)

const WIDTH = 360, HEIGHT = 480, MAX = 100;
const DECAY_PER_HOUR = 6;          // 스탯 시간당 감소
const CARE_AMOUNT = 35;            // 돌봄 1회 회복
const COOLDOWN = 1.5;              // 행동 쿨다운(초)
const FLASH = 1.5;                 // 돌봄 직후 행복 연출(초)
const SLEEP_BAND = 25, NEED_BAND = 30, HAPPY_AVG = 85;
const DAY_MS = 86400000;
const STAGE_DAYS = { child: 1, adult: 3, elder: 7 };
const ACTIONS = { feed: 'hunger', play: 'fun', pat: 'heart', sleep: 'energy' };
const STAT_KEYS = ['hunger', 'fun', 'heart', 'energy'];
const ACTION_KEYS = ['feed', 'play', 'pat', 'sleep'];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function createState(opts = {}) {
  const now = opts.bornAt || 0;
  return {
    name: opts.name || '토닥곰',
    bornAt: now,
    lastSeen: now,
    stats: { hunger: 80, fun: 80, heart: 80, energy: 80 },
    flash: 0,
    cooldown: { feed: 0, play: 0, pat: 0, sleep: 0 },
  };
}

const tamaCoreApi = {
  WIDTH, HEIGHT, MAX, DECAY_PER_HOUR, CARE_AMOUNT, COOLDOWN, FLASH,
  SLEEP_BAND, NEED_BAND, HAPPY_AVG, DAY_MS, STAGE_DAYS, ACTIONS, STAT_KEYS, ACTION_KEYS,
  clamp, createState,
};
if (typeof module !== 'undefined' && module.exports) module.exports = tamaCoreApi;
if (typeof window !== 'undefined') window.TodakTama = tamaCoreApi;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): 코어 기초 — 상수·clamp·createState"
```

---

## Task 2: care() — 돌봄 + 쿨다운

**Files:**
- Modify: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Consumes: `createState`, `ACTIONS`, `CARE_AMOUNT`, `COOLDOWN`, `FLASH`, `MAX`, `clamp`.
- Produces: `care(state, type) -> boolean` — 쿨다운 중이면 무효(false), 아니면 해당 스탯 +CARE_AMOUNT(상한 클램프), `flash=FLASH`, `cooldown[type]=COOLDOWN`, true 반환.

- [ ] **Step 1: Write the failing test**

```js
test('care: 해당 스탯 +35, flash·쿨다운 설정', () => {
  const s = C.createState();
  s.stats.hunger = 40;
  const ok = C.care(s, 'feed');
  assert.strictEqual(ok, true);
  assert.strictEqual(s.stats.hunger, 75);
  assert.strictEqual(s.flash, C.FLASH);
  assert.strictEqual(s.cooldown.feed, C.COOLDOWN);
});

test('care: 상한 100 클램프', () => {
  const s = C.createState();
  s.stats.heart = 80;
  C.care(s, 'pat');
  assert.strictEqual(s.stats.heart, 100);
});

test('care: 쿨다운 중이면 무효(false)', () => {
  const s = C.createState();
  s.stats.fun = 10;
  C.care(s, 'play');           // 첫 회 성공 → 45
  const again = C.care(s, 'play'); // 쿨다운 중
  assert.strictEqual(again, false);
  assert.strictEqual(s.stats.fun, 45);
});

test('care: 알 수 없는 타입은 false', () => {
  const s = C.createState();
  assert.strictEqual(C.care(s, 'dance'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `C.care is not a function`

- [ ] **Step 3: Write minimal implementation**

`tama-core.js`에 추가하고 export에 `care` 등록:

```js
function care(state, type) {
  const key = ACTIONS[type];
  if (!key) return false;
  if (state.cooldown[type] > 0) return false;
  state.stats[key] = clamp(state.stats[key] + CARE_AMOUNT, 0, MAX);
  state.flash = FLASH;
  state.cooldown[type] = COOLDOWN;
  return true;
}
```

export 객체에 `care,` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): care() 돌봄·쿨다운"
```

---

## Task 3: tick() — 시간 감소 + flash/쿨다운 카운트다운

**Files:**
- Modify: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Consumes: `DECAY_PER_HOUR`, `STAT_KEYS`, `ACTION_KEYS`, `clamp`, `MAX`.
- Produces: `tick(state, dt) -> state` — dt(초) 동안 각 스탯 `-= DECAY_PER_HOUR*(dt/3600)`(0 클램프), `flash`·`cooldown[*]` 각각 dt만큼 감소(0 하한).

- [ ] **Step 1: Write the failing test**

```js
test('tick: 1시간이면 각 스탯 -6', () => {
  const s = C.createState();           // 모두 80
  C.tick(s, 3600);                     // 1시간
  for (const k of C.STAT_KEYS) assert.ok(Math.abs(s.stats[k] - 74) < 1e-6, k);
});

test('tick: 0 하한 클램프', () => {
  const s = C.createState();
  s.stats.hunger = 2;
  C.tick(s, 3600);                     // -6 시도
  assert.strictEqual(s.stats.hunger, 0);
});

test('tick: flash·쿨다운이 dt만큼 줄어 0에서 멈춘다', () => {
  const s = C.createState();
  s.flash = 1.0; s.cooldown.feed = 1.0;
  C.tick(s, 0.4);
  assert.ok(Math.abs(s.flash - 0.6) < 1e-6);
  assert.ok(Math.abs(s.cooldown.feed - 0.6) < 1e-6);
  C.tick(s, 5);
  assert.strictEqual(s.flash, 0);
  assert.strictEqual(s.cooldown.feed, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `C.tick is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function tick(state, dt) {
  const dec = DECAY_PER_HOUR * (dt / 3600);
  for (const k of STAT_KEYS) state.stats[k] = clamp(state.stats[k] - dec, 0, MAX);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
  for (const t of ACTION_KEYS) if (state.cooldown[t] > 0) state.cooldown[t] = Math.max(0, state.cooldown[t] - dt);
  return state;
}
```

export에 `tick,` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): tick() 시간 감소·연출 카운트다운"
```

---

## Task 4: applyElapsed() — 오프라인 경과 일괄 감소

**Files:**
- Modify: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Consumes: `DECAY_PER_HOUR`, `STAT_KEYS`, `clamp`, `MAX`.
- Produces: `applyElapsed(state, ms) -> state` — `ms` 밀리초 경과만큼 각 스탯 `-= DECAY_PER_HOUR*(ms/3600000)`(0 클램프). `ms<=0`이면 무변화. flash/cooldown은 건드리지 않음.

- [ ] **Step 1: Write the failing test**

```js
test('applyElapsed: 6시간이면 -36', () => {
  const s = C.createState();           // 80
  C.applyElapsed(s, 6 * 3600 * 1000);
  for (const k of C.STAT_KEYS) assert.ok(Math.abs(s.stats[k] - 44) < 1e-6, k);
});

test('applyElapsed: 아주 오래면 0 수렴, 음수 무변화', () => {
  const s = C.createState();
  C.applyElapsed(s, 1000 * 3600 * 1000); // 1000시간
  for (const k of C.STAT_KEYS) assert.strictEqual(s.stats[k], 0);
  const s2 = C.createState();
  C.applyElapsed(s2, -5);
  assert.strictEqual(s2.stats.hunger, 80);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `C.applyElapsed is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function applyElapsed(state, ms) {
  if (!(ms > 0)) return state;
  const dec = DECAY_PER_HOUR * (ms / 3600000);
  for (const k of STAT_KEYS) state.stats[k] = clamp(state.stats[k] - dec, 0, MAX);
  return state;
}
```

export에 `applyElapsed,` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): applyElapsed() 오프라인 경과 감소"
```

---

## Task 5: growthStage() — 경과일 기준 단계

**Files:**
- Modify: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Consumes: `STAGE_DAYS`, `DAY_MS`.
- Produces: `growthStage(state, nowMs) -> 'baby'|'child'|'adult'|'elder'` — `(nowMs-bornAt)/DAY_MS` 일수로 단계 반환.

- [ ] **Step 1: Write the failing test**

```js
test('growthStage: 경계 1·3·7일', () => {
  const born = 1000000;
  const s = C.createState({ bornAt: born });
  const at = (days) => C.growthStage(s, born + days * C.DAY_MS);
  assert.strictEqual(at(0), 'baby');
  assert.strictEqual(at(0.99), 'baby');
  assert.strictEqual(at(1), 'child');
  assert.strictEqual(at(2.9), 'child');
  assert.strictEqual(at(3), 'adult');
  assert.strictEqual(at(6.9), 'adult');
  assert.strictEqual(at(7), 'elder');
  assert.strictEqual(at(30), 'elder');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `C.growthStage is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function growthStage(state, nowMs) {
  const days = (nowMs - state.bornAt) / DAY_MS;
  if (days < STAGE_DAYS.child) return 'baby';
  if (days < STAGE_DAYS.adult) return 'child';
  if (days < STAGE_DAYS.elder) return 'adult';
  return 'elder';
}
```

export에 `growthStage,` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): growthStage() 경과일 단계"
```

---

## Task 6: poseFor() + bubbleFor() — 표정·말풍선

**Files:**
- Modify: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Consumes: `SLEEP_BAND`, `NEED_BAND`, `HAPPY_AVG`.
- Produces:
  - `poseFor(state) -> 'happy'|'sleep'|'sad'|'content'` — 우선순위: flash>0→happy; energy<SLEEP_BAND→sleep; min(4스탯)<NEED_BAND→sad; 평균≥HAPPY_AVG→happy; 그 외 content.
  - `bubbleFor(state) -> string|null` — flash>0→'❤️'; 아니면 NEED_BAND 미만 스탯 중 최소값의 이모지(hunger🍯/fun⚽/heart💗/energy😴); 없으면 null.

- [ ] **Step 1: Write the failing test**

```js
test('poseFor: 우선순위 happy>sleep>sad>content', () => {
  const s = C.createState();
  assert.strictEqual(C.poseFor(s), 'content');          // 80 평균
  s.stats = { hunger: 90, fun: 90, heart: 90, energy: 90 };
  assert.strictEqual(C.poseFor(s), 'happy');            // 평균>=85
  s.stats = { hunger: 20, fun: 80, heart: 80, energy: 80 };
  assert.strictEqual(C.poseFor(s), 'sad');              // 하나<30
  s.stats = { hunger: 80, fun: 80, heart: 80, energy: 10 };
  assert.strictEqual(C.poseFor(s), 'sleep');            // 기력<25
  s.flash = 1.0;
  assert.strictEqual(C.poseFor(s), 'happy');            // flash 최우선
});

test('bubbleFor: 최소 욕구 이모지 / 돌봄직후 하트 / 평온 null', () => {
  const s = C.createState();
  assert.strictEqual(C.bubbleFor(s), null);
  s.stats.hunger = 12;
  assert.strictEqual(C.bubbleFor(s), '🍯');
  s.stats.energy = 5;                                   // 더 낮음
  assert.strictEqual(C.bubbleFor(s), '😴');
  s.flash = 1.0;
  assert.strictEqual(C.bubbleFor(s), '❤️');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `C.poseFor is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function poseFor(state) {
  if (state.flash > 0) return 'happy';
  const { hunger, fun, heart, energy } = state.stats;
  if (energy < SLEEP_BAND) return 'sleep';
  if (Math.min(hunger, fun, heart, energy) < NEED_BAND) return 'sad';
  if ((hunger + fun + heart + energy) / 4 >= HAPPY_AVG) return 'happy';
  return 'content';
}

const BUBBLE_EMOJI = { hunger: '🍯', fun: '⚽', heart: '💗', energy: '😴' };
function bubbleFor(state) {
  if (state.flash > 0) return '❤️';
  let best = null;
  for (const k of STAT_KEYS) {
    if (state.stats[k] < NEED_BAND && (best === null || state.stats[k] < state.stats[best])) best = k;
  }
  return best ? BUBBLE_EMOJI[best] : null;
}
```

export에 `poseFor, bubbleFor,` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): poseFor·bubbleFor 표정·말풍선"
```

---

## Task 7: serialize/deserialize — 저장 직렬화

**Files:**
- Modify: `docs/play/tama-core.js`
- Test: `docs/play/tama-core.test.js`

**Interfaces:**
- Consumes: `createState`, `STAT_KEYS`, `MAX`.
- Produces:
  - `serialize(state) -> string` — `{v:1,name,bornAt,lastSeen,stats}` JSON.
  - `deserialize(str) -> state|null` — 유효하면 새 상태(transient인 flash/cooldown은 0 초기화), 깨졌거나 버전 불일치면 null.

- [ ] **Step 1: Write the failing test**

```js
test('serialize→deserialize 라운드트립', () => {
  const s = C.createState({ name: '꿀곰', bornAt: 5000 });
  s.lastSeen = 9000; s.stats.hunger = 33; s.flash = 1.2; s.cooldown.feed = 0.5;
  const back = C.deserialize(C.serialize(s));
  assert.strictEqual(back.name, '꿀곰');
  assert.strictEqual(back.bornAt, 5000);
  assert.strictEqual(back.lastSeen, 9000);
  assert.strictEqual(back.stats.hunger, 33);
  assert.strictEqual(back.flash, 0);        // transient 초기화
  assert.strictEqual(back.cooldown.feed, 0);
});

test('deserialize: 깨진 입력은 null', () => {
  assert.strictEqual(C.deserialize('not json'), null);
  assert.strictEqual(C.deserialize('{}'), null);
  assert.strictEqual(C.deserialize(JSON.stringify({ v: 2, bornAt: 1, stats: {} })), null);
});

test('deserialize: 범위 벗어난 스탯은 80으로 보정', () => {
  const back = C.deserialize(JSON.stringify({ v: 1, name: 'x', bornAt: 0, lastSeen: 0, stats: { hunger: 999, fun: 'bad', heart: 50, energy: -3 } }));
  assert.strictEqual(back.stats.hunger, 80);
  assert.strictEqual(back.stats.fun, 80);
  assert.strictEqual(back.stats.heart, 50);
  assert.strictEqual(back.stats.energy, 80);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `C.serialize is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function serialize(state) {
  return JSON.stringify({ v: 1, name: state.name, bornAt: state.bornAt, lastSeen: state.lastSeen, stats: state.stats });
}

function deserialize(str) {
  try {
    const o = JSON.parse(str);
    if (!o || o.v !== 1 || typeof o.bornAt !== 'number' || !o.stats) return null;
    const s = createState({ name: o.name, bornAt: o.bornAt });
    s.lastSeen = typeof o.lastSeen === 'number' ? o.lastSeen : o.bornAt;
    for (const k of STAT_KEYS) {
      const v = o.stats[k];
      s.stats[k] = (typeof v === 'number' && v >= 0 && v <= MAX) ? v : 80;
    }
    return s;
  } catch (e) { return null; }
}
```

export에 `serialize, deserialize,` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-core.test.js
git commit -m "feat(tama): serialize·deserialize 저장 직렬화"
```

---

## Task 8: 레이아웃 상수(BUTTONS·STATS) + tama-input(hitTest)

**Files:**
- Modify: `docs/play/tama-core.js` (BUTTONS·STATS 상수 추가)
- Create: `docs/play/tama-input.js`
- Test: `docs/play/tama-core.test.js` (hitTest는 input의 순수 함수지만 코어 테스트 파일에서 함께 검증)

**Interfaces:**
- Produces (core):
  - `BUTTONS` = 4개 `{type,label,emoji,x,y,w,h}` (논리좌표). type=feed|play|pat|sleep.
  - `STATS` = 4개 `{key,label,emoji,color}` (렌더용 메타).
- Produces (input):
  - `hitTest(buttons, lx, ly) -> type|null`
  - `createInput() -> {push(type), read()->type|null}` (read는 큐 1개 소비 후 비움)
  - `attach(input, el, core)` — click·touchstart를 논리좌표로 변환해 hitTest→push.

- [ ] **Step 1: Write the failing test**

`tama-core.test.js`에 추가 (상단에 input 로드 추가):

```js
const I = require('./tama-input.js');

test('BUTTONS·STATS 상수 형태', () => {
  assert.strictEqual(C.BUTTONS.length, 4);
  assert.deepStrictEqual(C.BUTTONS.map(b => b.type), ['feed', 'play', 'pat', 'sleep']);
  for (const b of C.BUTTONS) {
    assert.ok(b.x >= 0 && b.x + b.w <= C.WIDTH, 'x 범위');
    assert.ok(b.y >= 0 && b.y + b.h <= C.HEIGHT, 'y 범위');
  }
  assert.deepStrictEqual(C.STATS.map(s => s.key), ['hunger', 'fun', 'heart', 'energy']);
});

test('hitTest: 버튼 안/밖', () => {
  const feed = C.BUTTONS[0];
  const cx = feed.x + feed.w / 2, cy = feed.y + feed.h / 2;
  assert.strictEqual(I.hitTest(C.BUTTONS, cx, cy), 'feed');
  assert.strictEqual(I.hitTest(C.BUTTONS, 5, 5), null); // 상단 빈 영역
});

test('createInput: push 후 read 1회 소비', () => {
  const inp = I.createInput();
  assert.strictEqual(inp.read(), null);
  inp.push('play');
  assert.strictEqual(inp.read(), 'play');
  assert.strictEqual(inp.read(), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: FAIL — `Cannot find module './tama-input.js'`

- [ ] **Step 3: Write minimal implementation**

(a) `tama-core.js`에 상수 추가하고 export에 등록:

```js
// 하단 2×2 돌봄 버튼 (논리좌표)
const BUTTONS = [
  { type: 'feed',  label: '밥주기',   emoji: '🍯', x: 12,  y: 372, w: 163, h: 43 },
  { type: 'play',  label: '놀아주기', emoji: '⚽', x: 185, y: 372, w: 163, h: 43 },
  { type: 'pat',   label: '토닥이기', emoji: '💗', x: 12,  y: 425, w: 163, h: 43 },
  { type: 'sleep', label: '재우기',   emoji: '😴', x: 185, y: 425, w: 163, h: 43 },
];
// 상단 스탯바 메타
const STATS = [
  { key: 'hunger', label: '배부름', emoji: '🍯', color: '#E8A33D' },
  { key: 'fun',    label: '즐거움', emoji: '⚽', color: '#6FB36F' },
  { key: 'heart',  label: '마음',   emoji: '💗', color: '#D98AAE' },
  { key: 'energy', label: '기력',   emoji: '😴', color: '#6FA8C7' },
];
```

export 객체에 `BUTTONS, STATS,` 추가.

(b) `docs/play/tama-input.js` 생성:

```js
'use strict';
// 입력 → 버튼 의도. hitTest/createInput은 DOM 비의존(테스트 가능), attach만 DOM 배선.

function hitTest(buttons, lx, ly) {
  for (const b of buttons) {
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return b.type;
  }
  return null;
}

function createInput() {
  let q = null;
  return {
    push(type) { q = type; },
    read() { const t = q; q = null; return t; },
  };
}

function attach(input, el, core) {
  const handle = (clientX, clientY) => {
    const rect = el.getBoundingClientRect();
    const lx = (clientX - rect.left) / rect.width * core.WIDTH;
    const ly = (clientY - rect.top) / rect.height * core.HEIGHT;
    const type = hitTest(core.BUTTONS, lx, ly);
    if (type) input.push(type);
  };
  el.addEventListener('click', (e) => handle(e.clientX, e.clientY));
  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (t) handle(t.clientX, t.clientY);
    e.preventDefault();           // 터치 후 click 중복 방지
  }, { passive: false });
}

const inputApi = { hitTest, createInput, attach };
if (typeof module !== 'undefined' && module.exports) module.exports = inputApi;
if (typeof window !== 'undefined') window.TodakTamaInput = inputApi;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/play/tama-core.js docs/play/tama-input.js docs/play/tama-core.test.js
git commit -m "feat(tama): 레이아웃 상수 + 입력 hitTest"
```

---

## Task 9: tama-renderer — 캔버스 렌더

**Files:**
- Create: `docs/play/tama-renderer.js`

**Interfaces:**
- Consumes: core(`WIDTH/HEIGHT/STATS/BUTTONS/MAX/NEED_BAND/growthStage/poseFor/bubbleFor`), poses base path.
- Produces: `createRenderer(core, posesBasePath) -> { draw(ctx, state, nowMs) }`. 16 스프라이트 `${stage}_${pose}.png` 프리로드, 로드 실패 시 ASCII 얼굴 폴백.

(렌더러는 캔버스 의존이라 단위테스트 대신 Task 13 브라우저 스모크로 검증.)

- [ ] **Step 1: Create the renderer**

`docs/play/tama-renderer.js`:

```js
'use strict';
// 렌더: 상태 → 캔버스(논리좌표). 곰 단계+표정 스프라이트, 스탯바, 말풍선, 버튼.

function createRenderer(core, posesBasePath) {
  const STAGES = ['baby', 'child', 'adult', 'elder'];
  const POSES = ['content', 'sad', 'sleep', 'happy'];
  const FALLBACK_FACE = { content: '•ᴥ•', sad: '•︵•', sleep: '-ᴥ-', happy: '≧ᴥ≦' };
  const imgs = {}; const ok = {};
  for (const st of STAGES) for (const po of POSES) {
    const key = st + '_' + po;
    const img = new Image();
    img.onload = () => { ok[key] = true; };
    img.onerror = () => { ok[key] = false; };
    img.src = posesBasePath + key + '.png';
    imgs[key] = img;
  }
  const SCALE = { baby: 0.72, child: 0.85, adult: 1.0, elder: 1.0 };
  const BEAR_BASE_H = 200;          // 어른 기준 높이(논리px)
  const BEAR_BASELINE = 356;        // 발 닿는 y

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(ctx, state, nowMs) {
    const W = core.WIDTH, H = core.HEIGHT;
    // 배경
    ctx.fillStyle = '#FBF3E4';
    ctx.fillRect(0, 0, W, H);

    // 상단: 이름 · 단계 · 나이
    const stage = core.growthStage(state, nowMs);
    const stageKo = { baby: '아기', child: '소년', adult: '어른', elder: '노년' }[stage];
    const ageDays = Math.floor((nowMs - state.bornAt) / core.DAY_MS) + 1;
    ctx.fillStyle = '#5a4a36';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`🐻 ${state.name} · ${stageKo}`, 12, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`Day ${ageDays}`, W - 12, 12);

    // 스탯바 4개 (2×2)
    const barX = [12, 188], barY = [40, 68];
    const barW = 160, barH = 18;
    core.STATS.forEach((meta, i) => {
      const x = barX[i % 2], y = barY[(i / 2) | 0];
      const v = state.stats[meta.key];
      ctx.fillStyle = '#EADBC2';
      roundRect(ctx, x + 22, y, barW - 22, barH, 9); ctx.fill();
      ctx.fillStyle = (v < core.NEED_BAND) ? '#D2683E' : meta.color;
      const fillW = Math.max(0, (barW - 22) * v / core.MAX);
      if (fillW > 0) { roundRect(ctx, x + 22, y, fillW, barH, 9); ctx.fill(); }
      ctx.font = '14px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(meta.emoji, x, y + barH / 2);
    });

    // 곰 스프라이트 (단계+표정)
    const pose = core.poseFor(state);
    const key = stage + '_' + pose;
    const img = imgs[key];
    if (ok[key] && img.complete && img.naturalWidth > 0) {
      const h = BEAR_BASE_H * SCALE[stage];
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, (W - w) / 2, BEAR_BASELINE - h, w, h);
    } else {
      ctx.fillStyle = '#C8A06A';
      ctx.beginPath(); ctx.arc(W / 2, BEAR_BASELINE - 60, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2f23'; ctx.font = '22px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(FALLBACK_FACE[pose] || FALLBACK_FACE.content, W / 2, BEAR_BASELINE - 60);
    }

    // 말풍선 (현재 욕구/반응)
    const bubble = core.bubbleFor(state);
    if (bubble) {
      const bx = W / 2 + 56, by = BEAR_BASELINE - BEAR_BASE_H * SCALE[stage] + 6;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, bx - 4, by - 22, 44, 40, 12); ctx.fill();
      ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(bubble, bx + 18, by - 2);
    }

    // 하단 버튼 4개
    core.BUTTONS.forEach((b) => {
      ctx.fillStyle = '#E8A33D';
      roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
      ctx.fillStyle = '#3b2f23';
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${b.emoji} ${b.label}`, b.x + b.w / 2, b.y + b.h / 2);
    });
  }

  return { draw };
}

const rendererApi = { createRenderer };
if (typeof module !== 'undefined' && module.exports) module.exports = rendererApi;
if (typeof window !== 'undefined') window.TodakTamaRenderer = rendererApi;
```

- [ ] **Step 2: Syntax check**

Run: `cd docs/play && node -e "require('./tama-renderer.js'); console.log('renderer OK')"`
Expected: `renderer OK` (Image는 브라우저 전용이지만 createRenderer 호출 전이라 모듈 로드만 검증)

- [ ] **Step 3: Commit**

```bash
git add docs/play/tama-renderer.js
git commit -m "feat(tama): 캔버스 렌더러(스탯바·곰·말풍선·버튼)"
```

---

## Task 10: tamagotchi.html — 셸 배선

**Files:**
- Create: `docs/play/tamagotchi.html`

**Interfaces:**
- Consumes: `window.TodakTama`(core), `window.TodakTamaInput`, `window.TodakTamaRenderer`, `assets/todak.js`.
- Produces: 동작하는 페이지. 저장키 `todak.tama.v1`.

- [ ] **Step 1: Create the shell**

`docs/play/tamagotchi.html`:

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>🐻 토닥곰 키우기</title>
<style>
  html, body { margin: 0; height: 100%; background: #2b2622; color: #f3e9d8;
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    display: flex; align-items: center; justify-content: center; overscroll-behavior: none; }
  #wrap { position: relative; width: min(92vw, 360px); aspect-ratio: 3 / 4; touch-action: none; }
  canvas { width: 100%; height: 100%; border-radius: 16px; display: block;
    box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  #toast { position: absolute; left: 50%; top: 18%; transform: translateX(-50%);
    background: rgba(255,255,255,.95); color: #5a4a36; font-weight: 700;
    padding: 10px 18px; border-radius: 999px; font-size: 15px; opacity: 0;
    transition: opacity .4s; pointer-events: none; white-space: nowrap; }
  #toast.show { opacity: 1; }
</style>
</head>
<body>
  <div id="wrap">
    <canvas id="game"></canvas>
    <div id="toast"></div>
  </div>

  <script src="assets/todak.js"></script>
  <script src="tama-core.js"></script>
  <script src="tama-input.js"></script>
  <script src="tama-renderer.js"></script>
  <script>
    const C = window.TodakTama;
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const toastEl = document.getElementById('toast');

    function fitCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = C.WIDTH * dpr;
      canvas.height = C.HEIGHT * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    const SAVE_KEY = 'todak.tama.v1';
    function load() {
      try { const raw = localStorage.getItem(SAVE_KEY); return raw ? C.deserialize(raw) : null; }
      catch (e) { return null; }
    }
    function save(state) {
      try { state.lastSeen = Date.now(); localStorage.setItem(SAVE_KEY, C.serialize(state)); }
      catch (e) { /* 시크릿 모드 등 무시 */ }
    }

    // 상태 복원 + 오프라인 경과 반영
    let state = load() || C.createState({ bornAt: Date.now() });
    C.applyElapsed(state, Date.now() - state.lastSeen);

    const input = window.TodakTamaInput.createInput();
    window.TodakTamaInput.attach(input, canvas, C);
    const renderer = window.TodakTamaRenderer.createRenderer(C, 'assets/poses/');

    let lastStage = C.growthStage(state, Date.now());
    let last = 0, running = true, rafId, hiddenAt = 0, saveAcc = 0;

    const STAGE_KO = { baby: '아기곰', child: '소년곰', adult: '어른곰', elder: '노년곰' };
    function toast(msg) {
      toastEl.textContent = msg; toastEl.classList.add('show');
      setTimeout(() => toastEl.classList.remove('show'), 2200);
    }

    function frame(ts) {
      if (!running) return;
      const now = Date.now();
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
      last = ts;

      const intent = input.read();
      if (intent) C.care(state, intent);
      C.tick(state, dt);

      const stage = C.growthStage(state, now);
      if (stage !== lastStage) { lastStage = stage; toast(`⭐ ${STAGE_KO[stage]}이 되었어요!`); }

      renderer.draw(ctx, state, now);

      saveAcc += dt;
      if (saveAcc > 2) { saveAcc = 0; save(state); }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    // 탭 전환: 일시정지 + 복귀 시 경과시간 일괄 반영
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        running = false; cancelAnimationFrame(rafId); hiddenAt = Date.now(); save(state);
      } else {
        C.applyElapsed(state, Date.now() - hiddenAt);
        running = true; last = 0; rafId = requestAnimationFrame(frame);
      }
    });
    window.addEventListener('pagehide', () => save(state));
  </script>
</body>
</html>
```

- [ ] **Step 2: Local sanity (manual)**

Run: `cd docs/play && python -m http.server 8765` (또는 동등 정적 서버) → 브라우저로 `http://localhost:8765/tamagotchi.html` 접속해 곰·스탯바·버튼이 보이는지 확인. (자동 검증은 Task 13.)

- [ ] **Step 3: Commit**

```bash
git add docs/play/tamagotchi.html
git commit -m "feat(tama): 셸 배선(rAF·저장·오프라인경과·성장토스트)"
```

---

## Task 11: 랜딩 진입 링크 + i18n

**Files:**
- Modify: `docs/index.html` (링크 1줄 + ko/en 키 각 1개)

**Interfaces:**
- Consumes: 기존 `data-t` i18n 패턴(`cta_game` 인접).

- [ ] **Step 1: 링크 추가**

`docs/index.html:169` 의 `cta_game` 앵커 **바로 다음 줄**에 추가:

```html
      <a class="btn btn-ghost" href="play/tamagotchi.html" data-t="cta_tama">🐻 토닥곰 키우기 — 다마고치</a>
```

- [ ] **Step 2: i18n 키 추가**

`docs/index.html` ko 사전(약 327행 `cta_game:` 줄 끝)에 추가:

```js
      cta_tama:'🐻 토닥곰 키우기 — 다마고치',
```

en 사전(약 363행 `cta_game:` 줄 끝)에 추가:

```js
      cta_tama:'🐻 Raise Todak — Tamagotchi',
```

- [ ] **Step 3: 확인**

Run: `cd docs && grep -n "cta_tama" index.html`
Expected: 3개 매치(앵커 1 + ko 1 + en 1)

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "feat(tama): 랜딩에서 다마고치 진입 링크 연결"
```

---

## Task 12: 전체 코어 테스트 재확인 + 정리

**Files:**
- 없음(검증 단계)

- [ ] **Step 1: 전체 코어 테스트**

Run: `cd docs/play && node --test tama-core.test.js`
Expected: 전부 PASS, fail 0.

- [ ] **Step 2: 기존 honey-catch 회귀 확인**

Run: `cd docs/play && node --test game-core.test.js input.test.js`
Expected: 전부 PASS (다마고치 추가가 기존 게임을 깨지 않았는지).

- [ ] **Step 3: Commit (변경 없으면 생략)**

테스트만 돌렸으면 커밋 불필요.

---

## Task 13: 브라우저 스모크 검증 (Playwright)

**Files:**
- 없음(수동/자동 검증)

플레이라이트 MCP가 있으면 자동, 없으면 수동 체크리스트로 대체.

- [ ] **Step 1: 정적 서버 + 페이지 로드**

`docs/play/`에서 정적 서버 실행 후 `tamagotchi.html` 로드. 콘솔 에러 0 확인.

- [ ] **Step 2: 기능 체크리스트**

- 곰 스프라이트(현재 단계+표정)·스탯바 4개·버튼 4개가 보인다.
- "밥주기" 클릭 → 배부름 바 증가 + 곰 happy + ❤️ 말풍선(1.5초).
- 같은 버튼 즉시 재클릭 → 변화 없음(쿨다운).
- 스탯을 코드로 낮춰(콘솔 `state` 접근 불가하면 시간 경과로) 표정이 sad/sleep로 바뀌는지(또는 단위테스트로 갈음).
- 새로고침 → 곰 상태 유지(localStorage).
- DevTools로 시스템시간/`lastSeen` 점프 시 오프라인 감소 반영(또는 applyElapsed 단위테스트로 갈음).

- [ ] **Step 3: 결과 기록**

스모크 통과 여부를 `.superpowers/sdd/progress.md`(있으면) 또는 커밋 메시지에 남긴다. 버그 발견 시 별도 수정 태스크.

---

## Self-Review (작성자 점검 완료)

- **스펙 커버리지:** 철학(하이브리드·오프라인)=Task4/10, 스탯4=Task1‑3, 돌봄/쿨다운=Task2, 성장=Task5/10(토스트), 표정 상태머신=Task6, 말풍선=Task6/9, 레이아웃=Task8/9, 모듈구조=Task1‑10, 저장/에러=Task7/10, 테스트=Task1‑8·12, 진입링크=Task11, 스모크=Task13. ✅
- **플레이스홀더:** 없음(모든 코드 스텝 실제 코드 포함). ✅
- **타입 일관성:** `care/tick/applyElapsed/growthStage/poseFor/bubbleFor/serialize/deserialize/hitTest/createInput/attach/createRenderer/draw` 시그니처가 태스크 간 일치. 상수 키(`hunger/fun/heart/energy`, `feed/play/pat/sleep`)·스프라이트 네이밍(`${stage}_${pose}`) 전체 통일. ✅
```
