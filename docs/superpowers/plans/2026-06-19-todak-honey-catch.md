# 토닥곰 미니게임 "꿀단지 받기" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 곰을 좌우로 움직여 떨어지는 꿀단지(+1)·별(+5)을 받는 웹 캐주얼 게임을 `docs/play/`에 만든다.

**Architecture:** 순수 HTML+Canvas+requestAnimationFrame(바닐라 JS). 게임 로직(`game-core.js`)을 DOM·캔버스에서 분리해 Node에서 단위 테스트하고, 렌더(`renderer.js`)·입력(`input.js`)·셸(`honey-catch.html`)이 그 위에 배선된다. 캐릭터는 기존 `bear-core`(todak.js)와 포즈 PNG를 복사해 재사용한다.

**Tech Stack:** 바닐라 JavaScript (런타임 의존성 0), Node `node:test`(테스트), `sharp`(에셋 압축 — devDependency, 런타임 미포함), GitHub Pages(`docs/`).

## Global Constraints

- 런타임 의존성 0. 빌드 도구는 에셋 압축용 `sharp`만(devDependency, 산출물 PNG만 커밋).
- 순수 로직은 DOM/canvas 비의존, Node+브라우저 공용 (`module.exports` + `window.HoneyCatch` 전역).
- 좌표계: 캔버스 논리좌표 **360×480 (3:4)**, 단위 CSS px. 모든 아이템·곰 좌표 동일계.
- 곰 톤: 혼내지 않음. 게임오버 문구도 위로조 ("괜찮아, 다시 해보자 🐾").
- 포즈 3종만 사용: `content`(평소)·`cheer`(받음)·`hug`(게임오버). 각 ~100KB 이하.
- 저장: `localStorage['todak.honeycatch.best']`, 실패 시 try/catch로 메모리 폴백.
- 위치: `docs/play/`. GitHub Pages가 `docs/`를 그대로 서빙하므로 모든 참조는 `docs/` 내부 상대경로.
- 조작: PC `←`/`→`, 모바일 화면 좌/우 절반 탭&홀드.

## File Structure

```
docs/play/
├ honey-catch.html      ← 셸: 캔버스(DPR) + rAF 루프 + 오버레이 + localStorage
├ game-core.js          ← 순수 로직: createState/tick/reset/caught/poseFor + 상수
├ game-core.test.js     ← node:test 단위 테스트
├ renderer.js           ← createRenderer(core, basePath).draw(ctx, state) + 포즈 폴백
├ input.js              ← createInput().read() + attach(input, el) (키보드/터치)
├ build.js              ← bear-core 복사 + 포즈 3종 sharp 압축 → assets/
└ assets/
   ├ todak.js           ← packages/bear-core/todak.js 복사본(빌드 산출)
   └ poses/             ← content.png·cheer.png·hug.png (압축본, 빌드 산출)
```

---

### Task 1: 빌드 스크립트 + 에셋 다이어트

곰 코어와 포즈 3종을 `docs/play/assets/`로 가져오고, 무거운 PNG(특히 hug 1.8MB)를 압축한다. 이 산출물이 없으면 게임이 곰을 못 그리므로 최우선.

**Files:**
- Create: `docs/play/build.js`
- Create: `docs/play/.gitignore`
- Modify: `.gitignore` (루트 — `docs/play/node_modules/` 추가)
- Produces (빌드 산출, 커밋 대상): `docs/play/assets/todak.js`, `docs/play/assets/poses/{content,cheer,hug}.png`

**Interfaces:**
- Consumes: `packages/bear-core/todak.js`, `apps/desktop/ui/poses/{content,cheer,hug}.png`
- Produces: `docs/play/assets/todak.js`(브라우저에서 `window.Todak` 노출), `docs/play/assets/poses/*.png`

- [ ] **Step 1: 루트 .gitignore에 빌드 의존성 제외 추가**

`.gitignore` 끝에 한 줄 추가:

```
docs/play/node_modules/
```

- [ ] **Step 2: docs/play/.gitignore 생성**

`docs/play/.gitignore`:

```
node_modules/
package.json
package-lock.json
```

(sharp는 devDependency라 산출 PNG/JS만 커밋하고 npm 부산물은 무시.)

- [ ] **Step 3: build.js 작성**

`docs/play/build.js`:

```js
#!/usr/bin/env node
// bear-core(todak.js) 복사 + 포즈 3종 압축 → docs/play/assets/
// 런타임 의존성 아님: 이 스크립트는 에셋을 한 번 만들고, 산출물(PNG/JS)만 커밋된다.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const here = __dirname;                       // docs/play
const repoRoot = path.join(here, '..', '..'); // todak-bear/
const assets = path.join(here, 'assets');
const posesOut = path.join(assets, 'poses');
const posesSrc = path.join(repoRoot, 'apps/desktop/ui/poses');

fs.mkdirSync(posesOut, { recursive: true });

// 1) bear-core 복사 (브라우저에서 window.Todak 사용)
fs.copyFileSync(
  path.join(repoRoot, 'packages/bear-core/todak.js'),
  path.join(assets, 'todak.js'),
);

// 2) 포즈 3종 압축: 긴 변 256px 이내, PNG 최대 압축
(async () => {
  for (const key of ['content', 'cheer', 'hug']) {
    await sharp(path.join(posesSrc, key + '.png'))
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path.join(posesOut, key + '.png'));
    const kb = (fs.statSync(path.join(posesOut, key + '.png')).size / 1024).toFixed(0);
    console.log(`${key}.png → ${kb}KB`);
  }
  console.log('🐻 assets 빌드 완료');
})();
```

- [ ] **Step 4: sharp 설치 후 빌드 실행**

Run (Git Bash 기준):
```bash
cd docs/play && npm init -y >/dev/null && npm pkg set private=true >/dev/null && npm i -D sharp && node build.js
```
Expected 출력 예:
```
content.png → 40KB
cheer.png → 45KB
hug.png → 60KB
🐻 assets 빌드 완료
```

- [ ] **Step 5: 산출물 검증 (모두 존재 + hug < 150KB)**

Run:
```bash
node -e "const fs=require('fs');for(const k of['content','cheer','hug']){const s=fs.statSync('docs/play/assets/poses/'+k+'.png').size;if(s>150000)throw new Error(k+' too big: '+s);}fs.statSync('docs/play/assets/todak.js');console.log('OK')"
```
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add .gitignore docs/play/.gitignore docs/play/build.js docs/play/assets
git commit -m "build: 미니게임 에셋 파이프라인 + 포즈 압축(에셋 다이어트)"
```

---

### Task 2: game-core — 상태 생성 + 곰 이동

순수 로직 모듈의 뼈대와 곰 좌우 이동(경계 클램프)을 TDD로 만든다.

**Files:**
- Create: `docs/play/game-core.js`
- Test: `docs/play/game-core.test.js`

**Interfaces:**
- Produces:
  - 상수 `WIDTH=360, HEIGHT=480, BEAR_W=64, BEAR_H=64, BEAR_Y=HEIGHT-72, BEAR_SPEED=320, ITEM_W=28, ITEM_H=28, START_LIVES=3`
  - `makeRng(seed) -> () => number`  // 0~1 결정적 난수
  - `createState({best?, seed?}) -> state`
  - `tick(state, intent, dt) -> state`  // intent: 'left'|'right'|null, dt: 초
  - `caught(state, item) -> boolean`
  - `reset(state) -> state`
  - `poseFor(state) -> 'content'|'cheer'|'hug'`
  - state 모양: `{ w, h, bearX, items:[{x,y,vy,type}], score, best, lives, over, elapsed, spawnTimer, flash, rng }`

- [ ] **Step 1: 실패 테스트 작성 (상태 생성 + 이동/클램프)**

`docs/play/game-core.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./game-core.js');

test('createState 기본값', () => {
  const s = C.createState();
  assert.strictEqual(s.lives, C.START_LIVES);
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.over, false);
  assert.strictEqual(s.bearX, C.WIDTH / 2);
  assert.deepStrictEqual(s.items, []);
});

test('tick: 오른쪽 의도면 곰이 오른쪽으로', () => {
  const s = C.createState();
  const x0 = s.bearX;
  C.tick(s, 'right', 0.1);
  assert.ok(s.bearX > x0);
});

test('tick: 경계를 넘지 않음(클램프)', () => {
  const s = C.createState();
  for (let i = 0; i < 100; i++) C.tick(s, 'left', 0.1);
  assert.ok(s.bearX >= C.BEAR_W / 2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play && node --test game-core.test.js`
Expected: FAIL — `Cannot find module './game-core.js'`

- [ ] **Step 3: game-core.js 최소 구현**

`docs/play/game-core.js`:

```js
'use strict';
// 토닥곰 꿀단지 받기 — 순수 게임 로직 (DOM/canvas 비의존, Node+브라우저 공용)

const WIDTH = 360, HEIGHT = 480;
const BEAR_W = 64, BEAR_H = 64, BEAR_Y = HEIGHT - 72;
const BEAR_SPEED = 320;            // px/s
const ITEM_W = 28, ITEM_H = 28;
const START_LIVES = 3;

// 결정적 RNG (mulberry32) — 시드로 재현 가능한 테스트
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createState(opts = {}) {
  return {
    w: WIDTH, h: HEIGHT,
    bearX: WIDTH / 2,
    items: [],
    score: 0,
    best: opts.best || 0,
    lives: START_LIVES,
    over: false,
    elapsed: 0,
    spawnTimer: 0,
    flash: 0,               // >0 이면 방금 받음 → cheer 포즈
    rng: makeRng(opts.seed || 1),
  };
}

function tick(state, intent, dt) {
  if (state.over) return state;
  if (intent === 'left')  state.bearX -= BEAR_SPEED * dt;
  if (intent === 'right') state.bearX += BEAR_SPEED * dt;
  const half = BEAR_W / 2;
  state.bearX = Math.max(half, Math.min(state.w - half, state.bearX));
  return state;
}

function caught() { return false; }     // Task 4에서 구현
function reset(state) { return state; } // Task 7 직전 보강
function poseFor(state) { return state.over ? 'hug' : 'content'; } // Task 4에서 cheer 추가

const api = {
  WIDTH, HEIGHT, BEAR_W, BEAR_H, BEAR_Y, BEAR_SPEED, ITEM_W, ITEM_H, START_LIVES,
  makeRng, createState, tick, caught, reset, poseFor,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.HoneyCatch = api;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play && node --test game-core.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add docs/play/game-core.js docs/play/game-core.test.js
git commit -m "feat(game): game-core 상태 생성 + 곰 이동/클램프"
```

---

### Task 3: game-core — 아이템 생성(spawn) + 낙하

시간 경과에 따라 꿀/별이 생성되고 떨어지게 한다. 난이도(생성 간격·낙하 속도)는 `elapsed`에 따라 완만히 상승.

**Files:**
- Modify: `docs/play/game-core.js`
- Test: `docs/play/game-core.test.js`

**Interfaces:**
- Produces:
  - `spawnInterval(elapsed) -> number`(초), `fallSpeed(elapsed) -> number`(px/s)
  - `tick`가 `spawnTimer` 소진 시 `items`에 `{x, y:-ITEM_H, vy, type:'honey'|'star'}` 추가, 매 틱 `y += vy*dt`

- [ ] **Step 1: 실패 테스트 추가**

`docs/play/game-core.test.js` 끝에 추가:

```js
test('tick: 시간이 지나면 아이템이 생성된다', () => {
  const s = C.createState({ seed: 7 });
  for (let i = 0; i < 30; i++) C.tick(s, null, 0.1); // 3초
  assert.ok(s.items.length > 0, '아이템이 생성되어야 함');
});

test('tick: 아이템은 아래로 떨어진다', () => {
  const s = C.createState({ seed: 7 });
  C.tick(s, null, 0.1);
  s.items.push({ x: 100, y: 0, vy: 100, type: 'honey' });
  const y0 = s.items[s.items.length - 1].y;
  C.tick(s, null, 0.1);
  const it = s.items.find((i) => i.x === 100);
  assert.ok(it && it.y > y0, 'y가 증가해야 함');
});

test('난이도: 시간이 지날수록 생성 간격이 짧아진다', () => {
  assert.ok(C.spawnInterval(0) > C.spawnInterval(40));
});

test('난이도: 시간이 지날수록 낙하가 빨라진다', () => {
  assert.ok(C.fallSpeed(40) > C.fallSpeed(0));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play && node --test game-core.test.js`
Expected: FAIL — `C.spawnInterval is not a function` 등

- [ ] **Step 3: game-core.js에 생성·낙하 구현**

`game-core.js`에 난이도 함수 추가(상수 아래):

```js
function spawnInterval(elapsed) {            // 1.1s → 최소 0.45s
  return Math.max(0.45, 1.1 - elapsed * 0.012);
}
function fallSpeed(elapsed) {                // 120 → 최대 300 px/s
  return Math.min(300, 120 + elapsed * 3);
}
```

`tick` 함수를 다음으로 교체:

```js
function tick(state, intent, dt) {
  if (state.over) return state;
  state.elapsed += dt;
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);

  // 1) 곰 이동
  if (intent === 'left')  state.bearX -= BEAR_SPEED * dt;
  if (intent === 'right') state.bearX += BEAR_SPEED * dt;
  const half = BEAR_W / 2;
  state.bearX = Math.max(half, Math.min(state.w - half, state.bearX));

  // 2) 생성
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = spawnInterval(state.elapsed);
    const isStar = state.rng() < 0.15;
    const x = ITEM_W / 2 + state.rng() * (state.w - ITEM_W);
    state.items.push({ x, y: -ITEM_H, vy: fallSpeed(state.elapsed), type: isStar ? 'star' : 'honey' });
  }

  // 3) 낙하
  for (const it of state.items) it.y += it.vy * dt;

  return state;
}
```

`api` 객체에 `spawnInterval, fallSpeed` 추가:

```js
const api = {
  WIDTH, HEIGHT, BEAR_W, BEAR_H, BEAR_Y, BEAR_SPEED, ITEM_W, ITEM_H, START_LIVES,
  makeRng, createState, tick, caught, reset, poseFor,
  spawnInterval, fallSpeed,
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play && node --test game-core.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add docs/play/game-core.js docs/play/game-core.test.js
git commit -m "feat(game): 아이템 생성·낙하 + 난이도 곡선"
```

---

### Task 4: game-core — 충돌/점수/라이프/게임오버 + 포즈

받기(점수)·놓침(라이프)·게임오버, 그리고 `poseFor`의 cheer 반영까지 완성한다.

**Files:**
- Modify: `docs/play/game-core.js`
- Test: `docs/play/game-core.test.js`

**Interfaces:**
- Produces:
  - `caught(state, item) -> boolean` (AABB: 곰 64×64 @ (bearX, BEAR_Y) vs 아이템 28×28)
  - `tick`: 받으면 honey +1 / star +5 후 제거 + `flash=0.25`; 바닥 통과면 `lives--`, 0이면 `over=true`, `best` 갱신
  - `poseFor`: over→'hug', flash>0→'cheer', else 'content'
  - `reset(state)`: best 유지하고 새 게임 상태로 초기화

- [ ] **Step 1: 실패 테스트 추가**

`docs/play/game-core.test.js` 끝에 추가:

```js
test('caught: 곰과 겹친 아이템은 true', () => {
  const s = C.createState();
  const it = { x: s.bearX, y: C.BEAR_Y, vy: 0, type: 'honey' };
  assert.strictEqual(C.caught(s, it), true);
});

test('caught: 멀리 있는 아이템은 false', () => {
  const s = C.createState();
  const it = { x: s.bearX, y: 0, vy: 0, type: 'honey' };
  assert.strictEqual(C.caught(s, it), false);
});

test('받기: 꿀 +1, 별 +5', () => {
  const s = C.createState();
  s.items = [{ x: s.bearX, y: C.BEAR_Y, vy: 0, type: 'honey' }];
  s.spawnTimer = 99; // 이 틱엔 새 생성 막기
  C.tick(s, null, 0.001);
  assert.strictEqual(s.score, 1);

  const s2 = C.createState();
  s2.items = [{ x: s2.bearX, y: C.BEAR_Y, vy: 0, type: 'star' }];
  s2.spawnTimer = 99;
  C.tick(s2, null, 0.001);
  assert.strictEqual(s2.score, 5);
});

test('놓침: 바닥 통과하면 라이프 감소, 0이면 게임오버', () => {
  const s = C.createState();
  s.spawnTimer = 99;
  s.items = [{ x: 10, y: s.h + 100, vy: 0, type: 'honey' }];
  C.tick(s, null, 0.001);
  assert.strictEqual(s.lives, C.START_LIVES - 1);

  const s2 = C.createState();
  s2.lives = 1; s2.spawnTimer = 99;
  s2.items = [{ x: 10, y: s2.h + 100, vy: 0, type: 'honey' }];
  C.tick(s2, null, 0.001);
  assert.strictEqual(s2.lives, 0);
  assert.strictEqual(s2.over, true);
});

test('poseFor: 받은 직후 cheer, 게임오버 hug, 평소 content', () => {
  const s = C.createState();
  assert.strictEqual(C.poseFor(s), 'content');
  s.flash = 0.2;
  assert.strictEqual(C.poseFor(s), 'cheer');
  s.over = true;
  assert.strictEqual(C.poseFor(s), 'hug');
});

test('reset: best는 유지하고 새 게임', () => {
  const s = C.createState();
  s.score = 30; s.best = 30; s.over = true; s.lives = 0;
  C.reset(s);
  assert.strictEqual(s.best, 30);
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.lives, C.START_LIVES);
  assert.strictEqual(s.over, false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play && node --test game-core.test.js`
Expected: FAIL (caught가 항상 false, 점수/라이프 미반영)

- [ ] **Step 3: 충돌/점수/라이프/포즈/reset 구현**

`caught` 함수를 교체:

```js
function caught(state, it) {
  const bx = state.bearX - BEAR_W / 2, by = BEAR_Y - BEAR_H / 2;
  const ix = it.x - ITEM_W / 2, iy = it.y - ITEM_H / 2;
  return bx < ix + ITEM_W && bx + BEAR_W > ix && by < iy + ITEM_H && by + BEAR_H > iy;
}
```

`tick`의 "3) 낙하" 블록을 다음으로 교체:

```js
  // 3) 낙하 + 받기/놓침
  const kept = [];
  for (const it of state.items) {
    it.y += it.vy * dt;
    if (caught(state, it)) {
      state.score += it.type === 'star' ? 5 : 1;
      state.flash = 0.25;
      continue;                          // 받음 → 제거
    }
    if (it.y - ITEM_H / 2 > state.h) {   // 바닥 통과 → 놓침
      state.lives -= 1;
      if (state.lives <= 0) { state.lives = 0; state.over = true; }
      continue;
    }
    kept.push(it);
  }
  state.items = kept;
  if (state.over && state.score > state.best) state.best = state.score;
```

`poseFor` 교체:

```js
function poseFor(state) {
  if (state.over) return 'hug';
  if (state.flash > 0) return 'cheer';
  return 'content';
}
```

`reset` 교체:

```js
function reset(state) {
  const best = state.best;
  Object.assign(state, createState({ best, seed: (Date.now() & 0xffff) + 1 }));
  return state;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play && node --test game-core.test.js`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add docs/play/game-core.js docs/play/game-core.test.js
git commit -m "feat(game): 충돌·점수·라이프·게임오버 + 포즈/reset 완성"
```

---

### Task 5: input — 키보드 + 터치

입력을 의도(`'left'|'right'|null`)로 바꾸는 모듈. 상태머신 코어는 DOM 없이 테스트, `attach`만 DOM 이벤트에 배선.

**Files:**
- Create: `docs/play/input.js`
- Test: `docs/play/input.test.js`

**Interfaces:**
- Consumes: (DOM `window`, 캔버스 `el`) — 브라우저에서만
- Produces:
  - `createInput() -> { setLeft(bool), setRight(bool), read() -> 'left'|'right'|null }`
  - `attach(input, el)` — 키보드(←/→)·터치(좌/우 절반 탭&홀드)를 input에 연결

- [ ] **Step 1: 실패 테스트 작성**

`docs/play/input.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createInput } = require('./input.js');

test('read: 아무것도 안 누르면 null', () => {
  const i = createInput();
  assert.strictEqual(i.read(), null);
});

test('read: 왼쪽만 누르면 left', () => {
  const i = createInput();
  i.setLeft(true);
  assert.strictEqual(i.read(), 'left');
});

test('read: 둘 다 누르면 null (상쇄)', () => {
  const i = createInput();
  i.setLeft(true); i.setRight(true);
  assert.strictEqual(i.read(), null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play && node --test input.test.js`
Expected: FAIL — `Cannot find module './input.js'`

- [ ] **Step 3: input.js 구현**

`docs/play/input.js`:

```js
'use strict';
// 입력 → 의도. 코어(createInput)는 DOM 비의존(테스트 가능), attach만 DOM 배선.

function createInput() {
  const st = { left: false, right: false };
  return {
    setLeft(v) { st.left = !!v; },
    setRight(v) { st.right = !!v; },
    read() {
      if (st.left && !st.right) return 'left';
      if (st.right && !st.left) return 'right';
      return null;
    },
  };
}

function attach(input, el) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') input.setLeft(true);
    if (e.key === 'ArrowRight') input.setRight(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') input.setLeft(false);
    if (e.key === 'ArrowRight') input.setRight(false);
  });

  const onTouch = (e) => {
    input.setLeft(false); input.setRight(false);
    const rect = el.getBoundingClientRect();
    for (const t of e.touches) {
      const rel = (t.clientX - rect.left) / rect.width;
      if (rel < 0.5) input.setLeft(true); else input.setRight(true);
    }
    e.preventDefault();
  };
  el.addEventListener('touchstart', onTouch, { passive: false });
  el.addEventListener('touchmove', onTouch, { passive: false });
  el.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) { input.setLeft(false); input.setRight(false); }
  });
}

const api = { createInput, attach };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.HoneyInput = api;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play && node --test input.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add docs/play/input.js docs/play/input.test.js
git commit -m "feat(game): 입력 모듈(키보드/터치 → 의도)"
```

---

### Task 6: renderer — 캔버스 그리기 + 포즈 폴백

상태를 캔버스에 그린다. 곰 포즈는 `core.poseFor`로 고르고, 이미지 로드 실패 시 ASCII 얼굴로 폴백. 캔버스 전용이라 단위 테스트 대신 셸(Task 7)에서 시각 검증한다.

**Files:**
- Create: `docs/play/renderer.js`

**Interfaces:**
- Consumes: `game-core`(`poseFor`, 상수들), 포즈 PNG(`assets/poses/*.png`)
- Produces: `createRenderer(core, posesBasePath) -> { draw(ctx, state) }`

- [ ] **Step 1: renderer.js 구현**

`docs/play/renderer.js`:

```js
'use strict';
// 렌더: 상태 → 캔버스(논리좌표). 곰 포즈 교체, 로드 실패 시 ASCII 폴백.

function createRenderer(core, posesBasePath) {
  const FACES = { content: '•ᴥ•', cheer: '≧ᴥ≦', hug: 'ᴗᴥᴗ' };
  const poses = {};
  const ok = {};
  for (const key of ['content', 'cheer', 'hug']) {
    const img = new Image();
    img.onload = () => { ok[key] = true; };
    img.onerror = () => { ok[key] = false; };
    img.src = posesBasePath + key + '.png';
    poses[key] = img;
  }

  function draw(ctx, state) {
    const { w, h } = state;
    ctx.fillStyle = '#FBF3E4';
    ctx.fillRect(0, 0, w, h);

    // 아이템 (이모지)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = core.ITEM_H + 'px serif';
    for (const it of state.items) {
      ctx.fillText(it.type === 'star' ? '⭐' : '🍯', it.x, it.y);
    }

    // 곰
    const key = core.poseFor(state);
    const bx = state.bearX - core.BEAR_W / 2;
    const by = core.BEAR_Y - core.BEAR_H / 2;
    if (ok[key] && poses[key].complete && poses[key].naturalWidth > 0) {
      ctx.drawImage(poses[key], bx, by, core.BEAR_W, core.BEAR_H);
    } else {
      ctx.fillStyle = '#C8A06A';
      ctx.beginPath();
      ctx.arc(state.bearX, core.BEAR_Y, core.BEAR_W / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b2f23';
      ctx.font = '18px monospace';
      ctx.fillText(FACES[key] || FACES.content, state.bearX, core.BEAR_Y);
    }

    // HUD
    ctx.fillStyle = '#5a4a36';
    ctx.font = 'bold 18px sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('점수 ' + state.score, 12, 12);
    ctx.textAlign = 'right';
    ctx.fillText('최고 ' + state.best, w - 12, 12);
    ctx.textAlign = 'center';
    const hearts = '♥'.repeat(state.lives) + '♡'.repeat(core.START_LIVES - state.lives);
    ctx.fillText(hearts, w / 2, 12);
  }

  return { draw };
}

const api = { createRenderer };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.HoneyRenderer = api;
```

- [ ] **Step 2: 구문 오류 없는지 로드 확인**

Run: `cd docs/play && node -e "require('./renderer.js'); console.log('OK')"`
Expected: `OK` (브라우저 전용 API는 호출 안 하므로 require만으로 구문 검증)

- [ ] **Step 3: Commit**

```bash
git add docs/play/renderer.js
git commit -m "feat(game): 캔버스 렌더러 + 포즈 폴백"
```

---

### Task 7: honey-catch.html — 셸 배선 + 루프 + 오버레이 + 저장

모든 모듈을 rAF 루프로 배선하고, 시작/게임오버 오버레이·localStorage 최고점·DPR 캔버스·탭 전환 일시정지를 붙인다. 완성 후 브라우저에서 직접 플레이 검증.

**Files:**
- Create: `docs/play/honey-catch.html`

**Interfaces:**
- Consumes: `game-core.js`(`window.HoneyCatch`), `input.js`(`window.HoneyInput`), `renderer.js`(`window.HoneyRenderer`), `assets/todak.js`(`window.Todak`), `assets/poses/*.png`

- [ ] **Step 1: honey-catch.html 작성**

`docs/play/honey-catch.html`:

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>🍯 토닥곰 꿀단지 받기</title>
<style>
  html, body { margin: 0; height: 100%; background: #2b2622; color: #f3e9d8;
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    display: flex; align-items: center; justify-content: center; overscroll-behavior: none; }
  #wrap { position: relative; width: min(92vw, 360px); aspect-ratio: 3 / 4; touch-action: none; }
  canvas { width: 100%; height: 100%; border-radius: 16px; display: block;
    box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  .overlay { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px; text-align: center;
    background: rgba(43,38,34,.78); border-radius: 16px; backdrop-filter: blur(2px); }
  .overlay.hidden { display: none; }
  .overlay h1 { font-size: 22px; margin: 0; }
  .overlay p { margin: 0; opacity: .85; font-size: 15px; line-height: 1.5; }
  button { font: inherit; font-weight: 700; color: #3b2f23; background: #E8A33D;
    border: 0; border-radius: 999px; padding: 12px 26px; cursor: pointer; }
  button:active { transform: translateY(1px); }
  .hint { font-size: 12px; opacity: .7; }
</style>
</head>
<body>
  <div id="wrap">
    <canvas id="game"></canvas>

    <div id="startOverlay" class="overlay">
      <h1>🍯 꿀단지 받기</h1>
      <p>곰을 움직여 떨어지는 꿀과 별을 받아요.<br/>괜찮아, 천천히 해보자 🐾</p>
      <button id="startBtn">시작하기</button>
      <p class="hint">PC: ← → · 모바일: 화면 좌/우 누르기</p>
    </div>

    <div id="overOverlay" class="overlay hidden">
      <h1 id="overTitle">포옥 🤗</h1>
      <p id="overScore"></p>
      <button id="restartBtn">다시 하기</button>
    </div>
  </div>

  <script src="assets/todak.js"></script>
  <script src="game-core.js"></script>
  <script src="input.js"></script>
  <script src="renderer.js"></script>
  <script>
    const C = window.HoneyCatch;
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('wrap');

    // DPR 대응: 백킹 스토어 = 논리크기 × DPR, 좌표는 논리크기로 통일
    function fitCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = C.WIDTH * dpr;
      canvas.height = C.HEIGHT * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    const BEST_KEY = 'todak.honeycatch.best';
    function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }
    function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 시크릿 모드 등 무시 */ } }

    const input = window.HoneyInput.createInput();
    window.HoneyInput.attach(input, canvas);
    const renderer = window.HoneyRenderer.createRenderer(C, 'assets/poses/');

    let state = C.createState({ best: loadBest(), seed: (Date.now() & 0xffff) + 1 });
    let started = false, running = true, last = 0;

    const startOverlay = document.getElementById('startOverlay');
    const overOverlay = document.getElementById('overOverlay');
    const overScore = document.getElementById('overScore');

    function frame(ts) {
      if (!running) return;
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
      last = ts;
      if (started && !state.over) {
        C.tick(state, input.read(), dt);
        if (state.over) {
          saveBest(state.best);
          overScore.textContent = `점수 ${state.score} · 최고 ${state.best}\n괜찮아, 다시 해보자 🐾`;
          overScore.style.whiteSpace = 'pre-line';
          overOverlay.classList.remove('hidden');
        }
      }
      renderer.draw(ctx, state);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // 탭 전환 시 일시정지(dt 폭주 방지)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; }
      else { running = true; last = 0; requestAnimationFrame(frame); }
    });

    document.getElementById('startBtn').addEventListener('click', () => {
      started = true; last = 0;
      startOverlay.classList.add('hidden');
    });
    document.getElementById('restartBtn').addEventListener('click', () => {
      C.reset(state);
      overOverlay.classList.add('hidden');
      started = true; last = 0;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: 로컬 서버로 실행**

Run (Git Bash):
```bash
cd docs && python -m http.server 8765
```
브라우저에서 `http://localhost:8765/play/honey-catch.html` 열기.
(python 없으면 `npx -y serve docs -l 8765` 후 `/play/honey-catch.html`.)

- [ ] **Step 3: 수동 플레이 검증 (체크리스트)**

확인:
- 시작 화면 → "시작하기" → 꿀/별이 떨어지고 곰이 ← → 로 움직임
- 받으면 점수 +1(별 +5), 곰이 잠깐 활짝(cheer)
- 놓치면 하트 감소(♥♥♥ → ♥♥♡)
- 하트 0 → hug 곰 + "괜찮아, 다시 해보자" 오버레이 → "다시 하기"로 재시작
- 최고점이 새로고침 후에도 유지(localStorage)
- 모바일/좁은 창에서 화면 좌·우 터치로 이동

- [ ] **Step 4: Commit**

```bash
git add docs/play/honey-catch.html
git commit -m "feat(game): 셸 배선(루프·오버레이·DPR·저장·일시정지)"
```

---

### Task 8: 진입점 연결 + 전체 테스트 마무리

랜딩(`docs/index.html`)에서 게임으로 가는 링크를 추가하고, 전체 테스트를 한 번에 돌려 마무리한다.

**Files:**
- Modify: `docs/index.html` (게임 링크 추가)

**Interfaces:**
- Consumes: `docs/play/honey-catch.html`

- [ ] **Step 1: 랜딩에 게임 링크 추가**

`docs/index.html`에서 다운로드/소개 섹션 근처에 진입 링크를 추가한다. 페이지의 기존 마크업 패턴(클래스·버튼 스타일)을 따라 다음 의미의 링크를 삽입:

```html
<a href="play/honey-catch.html">🍯 토닥곰 미니게임 — 꿀단지 받기</a>
```

(정확한 위치·스타일은 `docs/index.html`의 기존 섹션 구조에 맞춰 배치. 새 클래스 추가 없이 기존 버튼/링크 스타일 재사용.)

- [ ] **Step 2: 전체 단위 테스트 실행**

Run: `cd docs/play && node --test`
Expected: PASS (game-core 13 + input 3 = 16 tests, 0 fail)

- [ ] **Step 3: 게임 링크 동작 확인**

로컬 서버에서 `http://localhost:8765/index.html` → 추가한 링크 클릭 → 게임 로드 확인.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "feat(game): 랜딩에서 미니게임 진입 링크 연결"
```

---

## 실행 후

- private 저장소(`private/main`)에 푸시: `git push`
- GitHub Pages는 기존 공개 repo(`origin`)에서 서빙되므로, 공개 게시하려면 `git push origin main` 별도 필요 (현재 기본 업스트림은 private).
```
