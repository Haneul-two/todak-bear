# 토닥곰 던지기 (honey-throw) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 곰이 꿀단지를 드래그 새총으로 던져 위쪽 꿀항아리에 넣는 세로형 앵그리버드류 물리 게임을 Phaser+Matter.js로 구현한다.

**Architecture:** 순수 로직(레벨 데이터·별점/진행도·궤적 수학)은 Phaser 비의존 모듈로 분리해 Node 단위테스트한다(①② 패턴 동일). 물리·렌더·입력은 Phaser 3 + Matter.js 씬(Boot/Game/UI)으로 구현하고 브라우저 스모크로 검증한다. 레벨은 선언적 데이터로 정의하고 GameScene이 읽어 바디를 생성한다.

**Tech Stack:** Phaser 3 (로컬 벤더링 `vendor/phaser.min.js`), Matter.js(Phaser 내장), 바닐라 ES5/ES6 모듈(빌드 없음), node:test, Playwright(스모크).

## Global Constraints

- 표면: 웹 `docs/play/`, GitHub Pages 정적 서빙, **빌드·번들러·npm 의존 없음**.
- 순수 모듈 파일은 `'use strict';`로 시작, 하단에서 `if (typeof module !== 'undefined' && module.exports) module.exports = api;` 그리고 `if (typeof window !== 'undefined') window.X = api;` 둘 다 노출(①② 동일).
- 테스트: `node:test` + `node:assert`, 파일 `docs/play/throw/throw-core.test.js`, 실행 `node throw-core.test.js`(cwd=`docs/play/throw`).
- 논리 해상도: **360×640**(세로). 좌표 원점 좌상단.
- localStorage 저장 키: **`todak.throw.v1`**. 진행도 객체 버전 필드 `v: 1`.
- 곰 가이드 톤: 크림 배경 `#FBF3E4`, 따뜻·둥글·안심. 화난 표정·텍스트 금지. 곰 스프라이트는 기존 `docs/play/assets/poses/` 재사용(예: `baby_content.png` 또는 `content` 계열).
- 별점: 1발 클리어=⭐⭐⭐, 2발=⭐⭐, 3발=⭐.
- 레벨당 꿀단지(시도) 3개. 레벨 6개 고정.
- 작업 브랜치: `feat/honey-throw` (이미 생성됨, spec 커밋 8bcb69e 위에 쌓음).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `docs/play/throw/trajectory.js` | [순수] 당김벡터→발사속도 변환, 최대당김 클램프, 궤적 미리보기 점 |
| `docs/play/throw/scoring.js` | [순수] 별점 계산, 진행도 객체·기록·직렬화/역직렬화 |
| `docs/play/throw/levels.js` | [순수] 레벨 6개 데이터 + `validateLevel` + `getLevel` |
| `docs/play/throw/throw-core.test.js` | [순수 모듈 Node 테스트] |
| `docs/play/throw/scenes/BootScene.js` | 에셋 로드(곰·꿀단지·항아리·장애물), 로드 실패 도형 폴백 |
| `docs/play/throw/scenes/GameScene.js` | Matter 월드 생성·새총·발사·충돌·넣기 판정·상태머신 |
| `docs/play/throw/scenes/UIScene.js` | 상단바(레벨·별점·남은단지)·결과 오버레이·재시작/레벨선택·힌트 |
| `docs/play/honey-throw.html` | 진입점: Phaser config·씬 등록·진행도 로드/저장 배선 |
| `docs/play/vendor/phaser.min.js` | 벤더링한 Phaser 3 |
| `docs/index.html` | 랜딩 진입 링크 `cta_throw` 추가(ko/en) |

---

## Task 1: 순수 모듈 — trajectory.js (당김→발사·궤적)

**Files:**
- Create: `docs/play/throw/trajectory.js`
- Test: `docs/play/throw/throw-core.test.js` (이 태스크에서 신규 생성)

**Interfaces:**
- Produces:
  - 상수 `MAX_PULL = 120`(최대 당김 px), `LAUNCH_SCALE = 0.18`(당김px당 속도), `LOGICAL = { W: 360, H: 640 }`
  - `clamp(v, lo, hi) -> number`
  - `pullVector(ox, oy, px, py) -> { dx, dy, dist }` — 발사방향 벡터 = (원점 − 포인터), 크기는 MAX_PULL로 클램프. dist는 클램프 후 크기.
  - `launchVelocity(pull) -> { vx, vy }` — `vx = pull.dx * LAUNCH_SCALE`, `vy = pull.dy * LAUNCH_SCALE`
  - `trajectoryPoints(ox, oy, vx, vy, gravity, steps, dt) -> Array<{x,y}>` — 포물선 샘플: `x = ox + vx*t`, `y = oy + vy*t + 0.5*gravity*t*t`, t = i*dt, i=1..steps

- [ ] **Step 1: 실패 테스트 작성** — `docs/play/throw/throw-core.test.js` 신규 생성

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('./trajectory.js');

test('trajectory: 상수 노출', () => {
  assert.strictEqual(T.MAX_PULL, 120);
  assert.strictEqual(T.LAUNCH_SCALE, 0.18);
  assert.deepStrictEqual(T.LOGICAL, { W: 360, H: 640 });
});

test('trajectory: clamp', () => {
  assert.strictEqual(T.clamp(150, 0, 100), 100);
  assert.strictEqual(T.clamp(-5, 0, 100), 0);
  assert.strictEqual(T.clamp(42, 0, 100), 42);
});

test('pullVector: 발사방향 = 원점-포인터, 짧으면 그대로', () => {
  // 원점(70,560), 포인터를 아래-왼쪽(40,620)으로 당김 → 발사는 위-오른쪽
  const p = T.pullVector(70, 560, 40, 620);
  assert.strictEqual(p.dx, 30);   // 70-40
  assert.strictEqual(p.dy, -60);  // 560-620
  assert.ok(Math.abs(p.dist - Math.hypot(30, 60)) < 1e-9);
});

test('pullVector: 최대 당김 거리로 클램프', () => {
  // 원점(0,0)에서 포인터(-300,0) → 거리 300 > 120 → dx=120, dy=0
  const p = T.pullVector(0, 0, -300, 0);
  assert.ok(Math.abs(p.dist - 120) < 1e-9);
  assert.ok(Math.abs(p.dx - 120) < 1e-9);
  assert.ok(Math.abs(p.dy - 0) < 1e-9);
});

test('launchVelocity: 당김 * 배율', () => {
  const v = T.launchVelocity({ dx: 100, dy: -50, dist: 111.8 });
  assert.ok(Math.abs(v.vx - 18) < 1e-9);   // 100*0.18
  assert.ok(Math.abs(v.vy - -9) < 1e-9);   // -50*0.18
});

test('trajectoryPoints: 포물선 샘플 개수·첫 점', () => {
  const pts = T.trajectoryPoints(0, 0, 10, -10, 1, 5, 1);
  assert.strictEqual(pts.length, 5);
  // t=1: x=10, y=-10 + 0.5*1*1 = -9.5
  assert.ok(Math.abs(pts[0].x - 10) < 1e-9);
  assert.ok(Math.abs(pts[0].y - -9.5) < 1e-9);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: FAIL — `Cannot find module './trajectory.js'`

- [ ] **Step 3: trajectory.js 구현**

```js
'use strict';
// 토닥곰 던지기 — 궤적/발사 순수 수학 (Phaser 비의존, Node+브라우저 공용)

const MAX_PULL = 120;       // 최대 당김 거리(px)
const LAUNCH_SCALE = 0.18;  // 당김 px당 발사 속도
const LOGICAL = { W: 360, H: 640 };

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// 발사방향 벡터 = 원점 - 포인터 (새총: 뒤로 당긴 반대로 발사). 크기 MAX_PULL 클램프.
function pullVector(ox, oy, px, py) {
  let dx = ox - px, dy = oy - py;
  const d = Math.hypot(dx, dy);
  if (d > MAX_PULL && d > 0) {
    const k = MAX_PULL / d;
    dx *= k; dy *= k;
    return { dx, dy, dist: MAX_PULL };
  }
  return { dx, dy, dist: d };
}

function launchVelocity(pull) {
  return { vx: pull.dx * LAUNCH_SCALE, vy: pull.dy * LAUNCH_SCALE };
}

// 중력 적용 포물선 샘플 점들 (미리보기 점선용)
function trajectoryPoints(ox, oy, vx, vy, gravity, steps, dt) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i * dt;
    pts.push({ x: ox + vx * t, y: oy + vy * t + 0.5 * gravity * t * t });
  }
  return pts;
}

const api = { MAX_PULL, LAUNCH_SCALE, LOGICAL, clamp, pullVector, launchVelocity, trajectoryPoints };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.TodakThrowTrajectory = api;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: PASS — trajectory 관련 6 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add docs/play/throw/trajectory.js docs/play/throw/throw-core.test.js
git commit -m "feat(throw): 궤적·발사 순수 수학(trajectory)"
```

---

## Task 2: 순수 모듈 — scoring.js (별점·진행도)

**Files:**
- Create: `docs/play/throw/scoring.js`
- Test: `docs/play/throw/throw-core.test.js` (추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `TOTAL_LEVELS = 6`
  - `starsForAttempt(jarsUsed) -> 1|2|3` — `clamp(4 - jarsUsed, 1, 3)`
  - `createProgress() -> { v:1, maxLevel:1, stars:{} }` — maxLevel=해금된 최고 레벨 id(1부터)
  - `recordClear(progress, levelId, jarsUsed) -> progress` — `stars[levelId] = max(기존, starsForAttempt)`, `maxLevel = clamp(max(maxLevel, levelId+1), 1, TOTAL_LEVELS)`
  - `serialize(progress) -> string`
  - `deserialize(str) -> progress|null` — `v===1`·타입 검증 실패 시 null

- [ ] **Step 1: 실패 테스트 추가** — `throw-core.test.js` 하단에 추가

```js
const S = require('./scoring.js');

test('scoring: 시도수→별점 (1발=3, 2발=2, 3발=1, 그 이상=1)', () => {
  assert.strictEqual(S.starsForAttempt(1), 3);
  assert.strictEqual(S.starsForAttempt(2), 2);
  assert.strictEqual(S.starsForAttempt(3), 1);
  assert.strictEqual(S.starsForAttempt(4), 1);
});

test('scoring: createProgress 기본값', () => {
  const p = S.createProgress();
  assert.strictEqual(p.v, 1);
  assert.strictEqual(p.maxLevel, 1);
  assert.deepStrictEqual(p.stars, {});
});

test('scoring: recordClear 별점 갱신·해금', () => {
  const p = S.createProgress();
  S.recordClear(p, 1, 2);          // 레벨1, 2발 → ⭐⭐
  assert.strictEqual(p.stars[1], 2);
  assert.strictEqual(p.maxLevel, 2);
  S.recordClear(p, 1, 1);          // 레벨1 재도전 1발 → ⭐⭐⭐ (max)
  assert.strictEqual(p.stars[1], 3);
  S.recordClear(p, 1, 3);          // 더 나쁜 점수는 무시
  assert.strictEqual(p.stars[1], 3);
});

test('scoring: maxLevel은 TOTAL_LEVELS로 클램프', () => {
  const p = S.createProgress();
  S.recordClear(p, 6, 1);
  assert.strictEqual(p.maxLevel, 6);
});

test('scoring: serialize/deserialize 라운드트립', () => {
  const p = S.createProgress();
  S.recordClear(p, 1, 1);
  const r = S.deserialize(S.serialize(p));
  assert.deepStrictEqual(r, p);
});

test('scoring: 깨진/구버전 데이터는 null', () => {
  assert.strictEqual(S.deserialize('{bad'), null);
  assert.strictEqual(S.deserialize(JSON.stringify({ v: 2 })), null);
  assert.strictEqual(S.deserialize(JSON.stringify({ v: 1 })), null); // stars 없음
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: FAIL — `Cannot find module './scoring.js'`

- [ ] **Step 3: scoring.js 구현**

```js
'use strict';
// 토닥곰 던지기 — 별점·진행도 순수 로직

const TOTAL_LEVELS = 6;
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function starsForAttempt(jarsUsed) { return clamp(4 - jarsUsed, 1, 3); }

function createProgress() { return { v: 1, maxLevel: 1, stars: {} }; }

function recordClear(progress, levelId, jarsUsed) {
  const earned = starsForAttempt(jarsUsed);
  const prev = progress.stars[levelId] || 0;
  if (earned > prev) progress.stars[levelId] = earned;
  progress.maxLevel = clamp(Math.max(progress.maxLevel, levelId + 1), 1, TOTAL_LEVELS);
  return progress;
}

function serialize(progress) {
  return JSON.stringify({ v: 1, maxLevel: progress.maxLevel, stars: progress.stars });
}

function deserialize(str) {
  try {
    const o = JSON.parse(str);
    if (!o || o.v !== 1 || typeof o.maxLevel !== 'number' || typeof o.stars !== 'object' || o.stars === null) return null;
    return { v: 1, maxLevel: clamp(o.maxLevel, 1, TOTAL_LEVELS), stars: o.stars };
  } catch (e) { return null; }
}

const api = { TOTAL_LEVELS, clamp, starsForAttempt, createProgress, recordClear, serialize, deserialize };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.TodakThrowScoring = api;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: PASS — trajectory + scoring 테스트 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add docs/play/throw/scoring.js docs/play/throw/throw-core.test.js
git commit -m "feat(throw): 별점·진행도 순수 로직(scoring)"
```

---

## Task 3: 순수 모듈 — levels.js (레벨 데이터·검증)

**Files:**
- Create: `docs/play/throw/levels.js`
- Test: `docs/play/throw/throw-core.test.js` (추가)

**Interfaces:**
- Consumes: `trajectory.LOGICAL`(360×640) 좌표 범위 검증에 사용 — 단, 의존 없이 상수 360/640 직접 사용
- Produces:
  - `LEVELS` — 길이 6 배열, 각 원소 `{ id, bear:{x,y}, pot:{x,y,r}, jars, obstacles:[{type,x,y,w,h,static}], hint }`
  - `OBSTACLE_TYPES = ['log','box','rock']`
  - `getLevel(id) -> level | undefined`
  - `validateLevel(lv) -> boolean` — 필수 필드 존재, 좌표 0..360/0..640 내, jars≥1, 모든 obstacle.type ∈ OBSTACLE_TYPES, 곰과 항아리 중심 거리 > pot.r(겹침 방지)

- [ ] **Step 1: 실패 테스트 추가** — `throw-core.test.js` 하단에 추가

```js
const L = require('./levels.js');

test('levels: 6개 고정, id 1..6 순서', () => {
  assert.strictEqual(L.LEVELS.length, 6);
  L.LEVELS.forEach((lv, i) => assert.strictEqual(lv.id, i + 1));
});

test('levels: 모든 레벨이 validateLevel 통과', () => {
  for (const lv of L.LEVELS) assert.strictEqual(L.validateLevel(lv), true, `레벨 ${lv.id} 검증 실패`);
});

test('levels: getLevel', () => {
  assert.strictEqual(L.getLevel(1).id, 1);
  assert.strictEqual(L.getLevel(99), undefined);
});

test('levels: 레벨1은 장애물 없음, 모든 jars=3', () => {
  assert.strictEqual(L.LEVELS[0].obstacles.length, 0);
  for (const lv of L.LEVELS) assert.strictEqual(lv.jars, 3);
});

test('validateLevel: 화면 밖 좌표 거부', () => {
  const bad = { id: 1, bear: { x: -5, y: 560 }, pot: { x: 250, y: 120, r: 36 }, jars: 3, obstacles: [] };
  assert.strictEqual(L.validateLevel(bad), false);
});

test('validateLevel: 곰과 항아리 겹치면 거부', () => {
  const bad = { id: 1, bear: { x: 250, y: 120 }, pot: { x: 250, y: 120, r: 36 }, jars: 3, obstacles: [] };
  assert.strictEqual(L.validateLevel(bad), false);
});

test('validateLevel: 알 수 없는 장애물 타입 거부', () => {
  const bad = { id: 1, bear: { x: 70, y: 560 }, pot: { x: 250, y: 120, r: 36 }, jars: 3,
    obstacles: [{ type: 'bomb', x: 100, y: 300, w: 40, h: 40, static: true }] };
  assert.strictEqual(L.validateLevel(bad), false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: FAIL — `Cannot find module './levels.js'`

- [ ] **Step 3: levels.js 구현**

```js
'use strict';
// 토닥곰 던지기 — 레벨 데이터(선언적) + 검증. 좌표계 360×640, 원점 좌상단.

const W = 360, H = 640;
const OBSTACLE_TYPES = ['log', 'box', 'rock'];

// 곰은 아래쪽, 항아리는 위쪽(살짝 대각). 한 기믹씩 난이도 상승.
const LEVELS = [
  { id: 1, bear: { x: 70, y: 560 }, pot: { x: 250, y: 120, r: 38 }, jars: 3,
    obstacles: [], hint: '곰을 당겼다 놓아 꿀단지를 항아리에 넣어요' },
  { id: 2, bear: { x: 60, y: 560 }, pot: { x: 280, y: 130, r: 36 }, jars: 3,
    obstacles: [ { type: 'rock', x: 180, y: 360, w: 44, h: 44, static: true } ],
    hint: '바위를 비껴 던져요' },
  { id: 3, bear: { x: 60, y: 560 }, pot: { x: 270, y: 120, r: 36 }, jars: 3,
    obstacles: [ { type: 'log', x: 190, y: 380, w: 100, h: 24, static: false } ],
    hint: '통나무를 맞춰 밀어내요' },
  { id: 4, bear: { x: 60, y: 560 }, pot: { x: 260, y: 130, r: 34 }, jars: 3,
    obstacles: [
      { type: 'box', x: 250, y: 300, w: 44, h: 44, static: false },
      { type: 'box', x: 250, y: 256, w: 44, h: 44, static: false } ],
    hint: '쌓인 상자를 무너뜨려요' },
  { id: 5, bear: { x: 55, y: 560 }, pot: { x: 285, y: 120, r: 32 }, jars: 3,
    obstacles: [
      { type: 'rock', x: 200, y: 380, w: 44, h: 44, static: true },
      { type: 'box',  x: 250, y: 300, w: 44, h: 44, static: false },
      { type: 'box',  x: 250, y: 256, w: 44, h: 44, static: false } ],
    hint: '복합 벽을 정확히 뚫어요' },
  { id: 6, bear: { x: 60, y: 560 }, pot: { x: 70, y: 120, r: 30 }, jars: 3,
    obstacles: [
      { type: 'rock', x: 150, y: 260, w: 44, h: 120, static: true },
      { type: 'log',  x: 120, y: 430, w: 110, h: 24, static: false } ],
    hint: '좁은 틈으로 대각 항아리에 넣어요' },
];

function getLevel(id) { return LEVELS.find(function (lv) { return lv.id === id; }); }

function inBounds(x, y) { return x >= 0 && x <= W && y >= 0 && y <= H; }

function validateLevel(lv) {
  if (!lv || !lv.bear || !lv.pot || !Array.isArray(lv.obstacles)) return false;
  if (typeof lv.jars !== 'number' || lv.jars < 1) return false;
  if (!inBounds(lv.bear.x, lv.bear.y)) return false;
  if (!inBounds(lv.pot.x, lv.pot.y) || typeof lv.pot.r !== 'number' || lv.pot.r <= 0) return false;
  // 곰과 항아리 겹침 방지
  if (Math.hypot(lv.bear.x - lv.pot.x, lv.bear.y - lv.pot.y) <= lv.pot.r) return false;
  for (const o of lv.obstacles) {
    if (OBSTACLE_TYPES.indexOf(o.type) === -1) return false;
    if (!inBounds(o.x, o.y)) return false;
    if (typeof o.w !== 'number' || typeof o.h !== 'number') return false;
  }
  return true;
}

const api = { LEVELS, OBSTACLE_TYPES, getLevel, validateLevel };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.TodakThrowLevels = api;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: PASS — trajectory + scoring + levels 전체 통과

- [ ] **Step 5: 커밋**

```bash
git add docs/play/throw/levels.js docs/play/throw/throw-core.test.js
git commit -m "feat(throw): 레벨 데이터 6개 + validateLevel(levels)"
```

---

## Task 4: Phaser 벤더링 + 진입점 + BootScene (빈 게임 부팅)

**Files:**
- Create: `docs/play/vendor/phaser.min.js` (다운로드)
- Create: `docs/play/honey-throw.html`
- Create: `docs/play/throw/scenes/BootScene.js`

**Interfaces:**
- Produces:
  - 전역 `BootScene`(Phaser.Scene 서브클래스) — `preload()`에서 곰·꿀단지·항아리·장애물 텍스처 로드(실패 무시), `create()`에서 `this.scene.start('GameScene', { levelId: this.registry.get('levelId') || 1 })`
  - `honey-throw.html` — Phaser 게임 인스턴스 생성, config에 360×640·matter 중력 y:1·씬 배열 `[BootScene, GameScene, UIScene]`
  - registry 키: `levelId`(현재 레벨), `progress`(scoring 진행도 객체)

- [ ] **Step 1: Phaser 벤더링**

Run:
```bash
mkdir -p docs/play/vendor && curl -sL https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js -o docs/play/vendor/phaser.min.js && ls -la docs/play/vendor/phaser.min.js
```
Expected: 약 1.1MB 파일 생성. (버전 3.80.1 고정 — 재현성)

검증: `head -c 80 docs/play/vendor/phaser.min.js` 에 Phaser 배너 주석이 보이면 정상.

- [ ] **Step 2: BootScene.js 작성**

```js
'use strict';
// 토닥곰 던지기 — 에셋 로드 씬. 로드 실패해도 도형 폴백으로 진행.
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  preload() {
    this.load.image('bear', 'assets/poses/baby_content.png');
    this.load.image('bear_happy', 'assets/poses/baby_happy.png');
    // 꿀단지·항아리·장애물 전용 에셋이 없으면 도형으로 그림 → 로드 실패 무시
    this.load.on('loaderror', () => { /* 폴백은 GameScene에서 도형으로 처리 */ });
  }
  create() {
    const levelId = this.registry.get('levelId') || 1;
    this.scene.start('GameScene', { levelId });
  }
}
if (typeof window !== 'undefined') window.BootScene = BootScene;
```

- [ ] **Step 3: GameScene·UIScene 임시 스텁 작성** (다음 태스크에서 채움 — 부팅만 통과시키기 위한 최소 스텁)

`docs/play/throw/scenes/GameScene.js`:
```js
'use strict';
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create(data) {
    this.add.text(180, 320, '게임 로딩됨 (lv ' + (data && data.levelId) + ')',
      { color: '#5a4a36', fontSize: '16px' }).setOrigin(0.5);
  }
}
if (typeof window !== 'undefined') window.GameScene = GameScene;
```

`docs/play/throw/scenes/UIScene.js`:
```js
'use strict';
class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene', active: false }); }
  create() {}
}
if (typeof window !== 'undefined') window.UIScene = UIScene;
```

- [ ] **Step 4: honey-throw.html 작성**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>🐻 토닥곰 던지기</title>
<style>
  html, body { margin: 0; height: 100%; background: #2b2622;
    display: flex; align-items: center; justify-content: center; overscroll-behavior: none;
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
  #wrap { width: min(92vw, 360px); aspect-ratio: 360 / 640; }
  canvas { border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  #fallback { color: #f3e9d8; text-align: center; }
</style>
</head>
<body>
  <div id="wrap"><div id="fallback" hidden>게임을 불러오지 못했어요 🐻</div></div>
  <script src="vendor/phaser.min.js"
    onerror="document.getElementById('fallback').hidden=false"></script>
  <script src="throw/trajectory.js"></script>
  <script src="throw/scoring.js"></script>
  <script src="throw/levels.js"></script>
  <script src="throw/scenes/BootScene.js"></script>
  <script src="throw/scenes/GameScene.js"></script>
  <script src="throw/scenes/UIScene.js"></script>
  <script>
    if (window.Phaser) {
      const SAVE_KEY = 'todak.throw.v1';
      let progress = null;
      try { const raw = localStorage.getItem(SAVE_KEY); progress = raw ? window.TodakThrowScoring.deserialize(raw) : null; }
      catch (e) {}
      if (!progress) progress = window.TodakThrowScoring.createProgress();

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'wrap',
        width: 360, height: 640,
        backgroundColor: '#FBF3E4',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'matter', matter: { gravity: { y: 1 }, debug: false } },
        scene: [BootScene, GameScene, UIScene],
      });
      game.registry.set('progress', progress);
      game.registry.set('levelId', progress.maxLevel || 1);
      game.registry.set('saveKey', SAVE_KEY);
    }
  </script>
</body>
</html>
```

- [ ] **Step 5: 브라우저 스모크 — 부팅 확인**

로컬 서버: `cd docs && python -m http.server 8755` (백그라운드)
Playwright로 `http://localhost:8755/play/honey-throw.html` 접속.
Expected: 크림색 캔버스에 "게임 로딩됨 (lv 1)" 텍스트. 콘솔 에러는 favicon 404만.

- [ ] **Step 6: 커밋**

```bash
git add docs/play/vendor/phaser.min.js docs/play/honey-throw.html docs/play/throw/scenes/
git commit -m "feat(throw): Phaser 벤더링·진입점·BootScene 부팅"
```

---

## Task 5: GameScene — 레벨 데이터로 Matter 월드 생성

**Files:**
- Modify: `docs/play/throw/scenes/GameScene.js` (스텁 → 월드 빌더)

**Interfaces:**
- Consumes: `window.TodakThrowLevels.getLevel(id)`, 레벨 스키마(`bear/pot/obstacles/jars`)
- Produces:
  - `GameScene.create(data)` — `this.level = Levels.getLevel(data.levelId)`; 바닥·좌우 벽(정적), 곰 스프라이트, 항아리(정적 센서 `this.potSensor`), 장애물 바디 생성
  - 멤버: `this.potSensor`(Matter 바디, label `'pot'`), `this.bearPos`({x,y}), `this.jarsLeft`(=level.jars)
  - 장애물 생성 헬퍼 `buildObstacle(o)` — type별 색·정적/동적

- [ ] **Step 1: GameScene 월드 빌더 구현** (스텁 전체 교체)

```js
'use strict';
// 토닥곰 던지기 — 게임 씬: Matter 월드·새총·발사·판정
const OBSTACLE_STYLE = {
  log:  { color: 0xb07a3c, isStatic: false },
  box:  { color: 0xd9a45b, isStatic: false },
  rock: { color: 0x9a8e80, isStatic: true },
};

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create(data) {
    const Levels = window.TodakThrowLevels;
    this.level = Levels.getLevel((data && data.levelId) || 1);
    this.jarsLeft = this.level.jars;
    this.bearPos = { x: this.level.bear.x, y: this.level.bear.y };

    // 경계: 바닥·좌우 벽 (정적)
    this.matter.world.setBounds(0, 0, 360, 640, 32, true, true, false, true);

    // 곰 스프라이트(물리 없음, 시각용)
    this.bearImg = this.textures.exists('bear')
      ? this.add.image(this.bearPos.x, this.bearPos.y, 'bear').setScale(0.18)
      : this.add.circle(this.bearPos.x, this.bearPos.y, 22, 0xc8a06a);

    // 항아리: 정적 센서 (충돌 X, 진입 감지만)
    const pot = this.level.pot;
    this.add.circle(pot.x, pot.y, pot.r, 0xe8a33d, 0.25); // 시각 표시
    this.add.circle(pot.x, pot.y + pot.r * 0.4, pot.r * 0.7, 0x8a5a1d, 0.0); // 입구 가이드(투명)
    this.potSensor = this.matter.add.circle(pot.x, pot.y, pot.r * 0.6,
      { isStatic: true, isSensor: true, label: 'pot' });

    // 장애물
    this.obstacles = this.level.obstacles.map((o) => this.buildObstacle(o));

    // 시작 시 UIScene 띄우고 레벨 정보 전달
    this.scene.launch('UIScene');
    this.events.emit('level-init', { level: this.level, jarsLeft: this.jarsLeft });
  }

  buildObstacle(o) {
    const st = OBSTACLE_STYLE[o.type];
    const isStatic = o.static !== undefined ? o.static : st.isStatic;
    const rect = this.add.rectangle(o.x, o.y, o.w, o.h, st.color);
    this.matter.add.gameObject(rect, { isStatic, label: o.type, restitution: 0.2, friction: 0.6 });
    return rect;
  }
}
if (typeof window !== 'undefined') window.GameScene = GameScene;
```

- [ ] **Step 2: 브라우저 스모크 — 월드 렌더 확인**

서버 재시작 후 Playwright로 `honey-throw.html` 접속, 레벨1·레벨3을 registry로 확인(`localStorage` 비운 상태=레벨1).
Expected: 아래 곰(원/스프라이트), 위 항아리(주황 반투명 원), 레벨3이면 통나무 사각형 표시. 콘솔 에러 없음(favicon 제외).

스크린샷으로 곰·항아리 위치 확인.

- [ ] **Step 3: 커밋**

```bash
git add docs/play/throw/scenes/GameScene.js
git commit -m "feat(throw): 레벨 데이터로 Matter 월드 생성(곰·항아리센서·장애물)"
```

---

## Task 6: GameScene — 드래그 새총 조준·궤적 미리보기·발사

**Files:**
- Modify: `docs/play/throw/scenes/GameScene.js`

**Interfaces:**
- Consumes: `window.TodakThrowTrajectory`(`pullVector`/`launchVelocity`/`trajectoryPoints`/`MAX_PULL`)
- Produces:
  - `this.state` 문자열 머신: `'AIMING' | 'FLYING' | 'SETTLED' | 'CLEARED' | 'FAILED'`
  - `this.jar`(현재 장전된 꿀단지 Matter 이미지/원), `this.aimGfx`(궤적 점선 Graphics)
  - 포인터 핸들러: down→drag→up. up 시 `launchJar(vx, vy)` 호출 → state `'FLYING'`
  - `spawnJar()` — 곰 위치에 정적 꿀단지 생성, state `'AIMING'`

- [ ] **Step 1: 조준·발사 로직 추가** (create 끝에 `this.spawnJar()` 호출 + 메서드 추가)

`create(data)` 마지막 줄에 추가:
```js
    this.state = 'AIMING';
    this.aimGfx = this.add.graphics();
    this.GRAV_PX = 0.5; // 궤적 미리보기용 중력 근사(시각 전용 튜닝값)
    this.spawnJar();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
```

GameScene 클래스에 메서드 추가:
```js
  spawnJar() {
    if (this.jar) this.jar.destroy();
    this.jar = this.add.circle(this.bearPos.x, this.bearPos.y, 12, 0xe8a33d);
    this.matter.add.gameObject(this.jar, { shape: 'circle', restitution: 0.4, friction: 0.5, label: 'jar' });
    this.jar.body.gameObject = this.jar;
    this.matter.body.setStatic(this.jar.body, true); // 발사 전 고정
    this.state = 'AIMING';
    this.dragging = false;
  }

  onDown(p) {
    if (this.state !== 'AIMING') return;
    const d = Phaser.Math.Distance.Between(p.x, p.y, this.bearPos.x, this.bearPos.y);
    if (d < 60) this.dragging = true;
  }

  onMove(p) {
    if (!this.dragging || this.state !== 'AIMING') return;
    const T = window.TodakThrowTrajectory;
    const pull = T.pullVector(this.bearPos.x, this.bearPos.y, p.x, p.y);
    // 장전 꿀단지를 당긴 위치로(시각), 발사 미리보기 점선
    this.matter.body.setPosition(this.jar.body, { x: this.bearPos.x - pull.dx, y: this.bearPos.y - pull.dy });
    const v = T.launchVelocity(pull);
    const pts = T.trajectoryPoints(this.bearPos.x, this.bearPos.y, v.vx * 12, v.vy * 12, this.GRAV_PX, 10, 1);
    this.aimGfx.clear().fillStyle(0x8a5a1d, 0.5);
    pts.forEach((pt) => this.aimGfx.fillCircle(pt.x, pt.y, 3));
  }

  onUp(p) {
    if (!this.dragging || this.state !== 'AIMING') return;
    this.dragging = false;
    this.aimGfx.clear();
    const T = window.TodakThrowTrajectory;
    const pull = T.pullVector(this.bearPos.x, this.bearPos.y, p.x, p.y);
    if (pull.dist < 8) { this.spawnJar(); return; } // 너무 짧으면 취소·재장전
    const v = T.launchVelocity(pull);
    this.matter.body.setPosition(this.jar.body, { x: this.bearPos.x, y: this.bearPos.y });
    this.matter.body.setStatic(this.jar.body, false);
    this.matter.body.setVelocity(this.jar.body, { x: v.vx, y: v.vy });
    this.state = 'FLYING';
  }
```

- [ ] **Step 2: 브라우저 스모크 — 발사 확인**

Playwright로 레벨1 접속. 곰(아래)에서 마우스 down→위로 드래그→up.
Expected: 드래그 중 점선 궤적 표시, 놓으면 꿀단지가 포물선으로 위로 날아감. (넣기 판정은 다음 태스크)
`browser_evaluate`로 발사 후 `game.scene.keys.GameScene.state === 'FLYING'` 확인.

- [ ] **Step 3: 커밋**

```bash
git add docs/play/throw/scenes/GameScene.js
git commit -m "feat(throw): 드래그 새총 조준·궤적 미리보기·발사"
```

---

## Task 7: GameScene — 충돌·넣기 판정·정지·상태 전이

**Files:**
- Modify: `docs/play/throw/scenes/GameScene.js`

**Interfaces:**
- Consumes: Matter `collisionstart` 이벤트, `this.potSensor`
- Produces:
  - 항아리 센서에 꿀단지 진입(아래방향 속도) → `onCleared()` → state `'CLEARED'`, `this.events.emit('cleared', {jarsUsed})`
  - 정지/이탈 → `onSettled()` → `jarsLeft--`; 남으면 `spawnJar()`, 0이면 state `'FAILED'`·`this.events.emit('failed')`
  - `update()` — FLYING 중 꿀단지 속도 임계·화면밖 검사

- [ ] **Step 1: 판정 로직 추가** — create에 충돌 리스너, 클래스에 메서드·update 추가

`create(data)` 끝에 추가:
```js
    this.settleTimer = 0;
    this.matter.world.on('collisionstart', (ev) => {
      for (const pair of ev.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.indexOf('pot') !== -1 && labels.indexOf('jar') !== -1 && this.state === 'FLYING') {
          // 아래 방향 속도일 때만 인정(위로 튕겨 통과 방지)
          if (this.jar.body.velocity.y > -0.5) this.onCleared();
        }
      }
    });
```

클래스 메서드 추가:
```js
  update(time, dt) {
    if (this.state !== 'FLYING') return;
    const b = this.jar.body;
    // 화면 밖(아래/좌우 멀리) → 실패
    if (this.jar.y > 680 || this.jar.x < -40 || this.jar.x > 400) { this.onSettled(); return; }
    const speed = Math.hypot(b.velocity.x, b.velocity.y);
    if (speed < 0.4) { this.settleTimer += dt; if (this.settleTimer > 700) this.onSettled(); }
    else this.settleTimer = 0;
  }

  onCleared() {
    if (this.state === 'CLEARED') return;
    this.state = 'CLEARED';
    const jarsUsed = this.level.jars - this.jarsLeft + 1;
    if (this.textures.exists('bear_happy')) this.bearImg.setTexture && this.bearImg.setTexture('bear_happy');
    this.events.emit('cleared', { levelId: this.level.id, jarsUsed });
  }

  onSettled() {
    this.settleTimer = 0;
    this.jarsLeft -= 1;
    this.events.emit('jars-changed', { jarsLeft: this.jarsLeft });
    if (this.jarsLeft > 0) { this.spawnJar(); }
    else { this.state = 'FAILED'; this.events.emit('failed', { levelId: this.level.id }); }
  }
```

- [ ] **Step 2: 브라우저 스모크 — 넣기/실패 판정**

레벨1에서 항아리를 겨냥해 발사 → 들어가면 `state==='CLEARED'`, `cleared` 이벤트.
일부러 빗나가게 3번 발사 → `state==='FAILED'`.
`browser_evaluate`로 상태·jarsLeft 확인.

- [ ] **Step 3: 커밋**

```bash
git add docs/play/throw/scenes/GameScene.js
git commit -m "feat(throw): 넣기·정지·실패 판정 + 상태머신"
```

---

## Task 8: UIScene — 상단바·결과 오버레이·재시작/레벨선택

**Files:**
- Modify: `docs/play/throw/scenes/UIScene.js` (스텁 → 본체)

**Interfaces:**
- Consumes: GameScene 이벤트(`level-init`/`jars-changed`/`cleared`/`failed`), registry `progress`/`saveKey`
- Produces:
  - 상단바: `Lv N`, 별점(현재 레벨 best), 남은 단지 아이콘
  - `cleared` → 별점 연출 오버레이 + [다음 레벨] 버튼(registry.levelId 증가 후 BootScene 재시작)
  - `failed` → 위로 톤 오버레이 + [다시] 버튼(현재 레벨 재시작)
  - 진행도 저장: `cleared` 시 `scoring.recordClear` → `serialize` → localStorage(try/catch)

- [ ] **Step 1: UIScene 본체 구현** (스텁 전체 교체)

```js
'use strict';
// 토닥곰 던지기 — UI 오버레이 씬
class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  create() {
    this.game.scene.keys.GameScene.events.on('level-init', this.onInit, this);
    this.game.scene.keys.GameScene.events.on('jars-changed', this.onJars, this);
    this.game.scene.keys.GameScene.events.on('cleared', this.onCleared, this);
    this.game.scene.keys.GameScene.events.on('failed', this.onFailed, this);
  }

  onInit({ level, jarsLeft }) {
    this.level = level; this.jarsLeft = jarsLeft;
    const prog = this.registry.get('progress');
    const best = (prog.stars && prog.stars[level.id]) || 0;
    if (this.bar) this.bar.destroy();
    this.bar = this.add.container(0, 0);
    this.bar.add(this.add.text(12, 10, 'Lv ' + level.id, { color: '#5a4a36', fontSize: '18px', fontStyle: 'bold' }));
    this.bar.add(this.add.text(120, 12, '★'.repeat(best) + '☆'.repeat(3 - best), { color: '#e8a33d', fontSize: '16px' }));
    this.jarText = this.add.text(348, 12, '🍯'.repeat(jarsLeft), { fontSize: '16px' }).setOrigin(1, 0);
    this.bar.add(this.jarText);
    if (level.hint) {
      this.hint = this.add.text(180, 600, level.hint, { color: '#5a4a36', fontSize: '13px' }).setOrigin(0.5);
    }
  }

  onJars({ jarsLeft }) { if (this.jarText) this.jarText.setText('🍯'.repeat(Math.max(0, jarsLeft))); }

  onCleared({ levelId, jarsUsed }) {
    const Scoring = window.TodakThrowScoring;
    const prog = this.registry.get('progress');
    Scoring.recordClear(prog, levelId, jarsUsed);
    try { localStorage.setItem(this.registry.get('saveKey'), Scoring.serialize(prog)); } catch (e) {}
    const stars = Scoring.starsForAttempt(jarsUsed);
    this.showOverlay('성공! ' + '⭐'.repeat(stars), levelId < Scoring.TOTAL_LEVELS ? '다음 레벨' : '처음으로', () => {
      const next = levelId < Scoring.TOTAL_LEVELS ? levelId + 1 : 1;
      this.registry.set('levelId', next);
      this.scene.stop('UIScene');
      this.scene.start('BootScene');
    });
  }

  onFailed() {
    this.showOverlay('괜찮아, 다시 해볼까요? 🐻', '다시', () => {
      this.scene.stop('UIScene');
      this.scene.start('BootScene');
    });
  }

  showOverlay(msg, btnLabel, onBtn) {
    const g = this.add.container(0, 0);
    g.add(this.add.rectangle(180, 320, 360, 640, 0x2b2622, 0.55));
    g.add(this.add.text(180, 280, msg, { color: '#fff', fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5));
    const btn = this.add.text(180, 360, '  ' + btnLabel + '  ', { color: '#5a4a36', backgroundColor: '#FBF3E4', fontSize: '18px', padding: { x: 14, y: 8 } }).setOrigin(0.5).setInteractive();
    btn.on('pointerdown', onBtn);
    g.add(btn);
  }
}
if (typeof window !== 'undefined') window.UIScene = UIScene;
```

- [ ] **Step 2: GameScene launch 타이밍 보정** — `level-init` 이벤트가 UIScene `create` 이후 오도록

GameScene `create`에서 `this.scene.launch('UIScene')` 직후 한 프레임 뒤 emit 보장:
```js
    this.scene.launch('UIScene');
    this.time.delayedCall(0, () => this.events.emit('level-init', { level: this.level, jarsLeft: this.jarsLeft }));
```
(Task 5에서 넣은 즉시 emit 줄을 이 delayedCall 버전으로 교체)

- [ ] **Step 3: 브라우저 스모크 — UI 전체 흐름**

레벨1 클리어 → "성공! ⭐⭐⭐" 오버레이·[다음 레벨] → 클릭 시 레벨2 로드. 상단바 Lv·별점·🍯 표시. 실패 시 위로 오버레이·[다시].
`browser_evaluate`로 `localStorage['todak.throw.v1']`에 진행도 저장 확인.

- [ ] **Step 4: 커밋**

```bash
git add docs/play/throw/scenes/UIScene.js docs/play/throw/scenes/GameScene.js
git commit -m "feat(throw): UI 상단바·결과 오버레이·진행도 저장·레벨 진행"
```

---

## Task 9: 랜딩 진입 링크 + 전체 회귀 확인

**Files:**
- Modify: `docs/index.html` (히어로 .cta에 `cta_throw` 링크 추가)

**Interfaces:**
- Consumes: 기존 `cta_game`(honey-catch)·`cta_tama`(다마고치) 링크 패턴
- Produces: `cta_throw` 진입 링크(ko/en), `play/honey-throw.html`로 이동

- [ ] **Step 1: 기존 CTA 패턴 확인**

Run: `grep -n "cta_tama\|cta_game" docs/index.html`
Expected: 기존 두 진입 링크의 마크업·data-t 속성 패턴 확인.

- [ ] **Step 2: cta_throw 링크 추가**

기존 `cta_tama` 링크 블록 바로 뒤에 동일 패턴으로 추가(href=`play/honey-throw.html`, data-t `cta_throw`, ko="🍯 꿀단지 던지기" / en="Honey Throw"). 기존 i18n 사전(ko/en 객체)에도 `cta_throw` 키 추가.

- [ ] **Step 3: 순수 모듈 회귀 + 부팅 회귀**

Run: `cd docs/play/throw && node throw-core.test.js`
Expected: PASS (trajectory+scoring+levels 전체).
Run: `cd docs/play && node tama-core.test.js && node game-core.test.js && node input.test.js`
Expected: 기존 ②① 테스트 전부 PASS(회귀 없음).

- [ ] **Step 4: 커밋**

```bash
git add docs/index.html
git commit -m "feat(throw): 랜딩에 꿀단지 던지기 진입 링크(cta_throw)"
```

---

## Task 10: 브라우저 스모크 — 전체 플로우 검증 (Playwright)

**Files:** 없음(검증 전용). 발견된 버그·튜닝은 해당 파일 수정 후 별도 커밋.

**Interfaces:** 없음

- [ ] **Step 1: 로컬 서버 + 전체 플레이스루**

`cd docs && python -m http.server 8755`(백그라운드).
Playwright 시나리오:
1. `http://localhost:8755/play/honey-throw.html` 접속(localStorage 비운 상태) → 레벨1.
2. 곰 드래그→발사로 항아리에 넣기 → "성공" 오버레이·별점.
3. [다음 레벨] → 레벨2 로드, 상단바 Lv2.
4. 새로고침 → 진행도 유지(레벨2부터, 레벨1 별점 표시).
5. 콘솔 에러 = favicon 404만.

- [ ] **Step 2: 물리 난이도 튜닝(필요 시)**

발사가 너무 약/세거나 항아리에 안 들어가면 `trajectory.js`의 `LAUNCH_SCALE`, GameScene의 중력(config `gravity.y`)·항아리 센서 반경(`pot.r*0.6`)을 조정. "3발 안에 들어갈 만한" 난이도로.
조정 시: 순수값은 `throw-core.test.js` 기대값도 함께 갱신 → `node throw-core.test.js` 재통과.

- [ ] **Step 3: 스모크 결과 기록·커밋(튜닝 있었다면)**

```bash
git add -A
git commit -m "fix(throw): 스모크 기반 물리 난이도 튜닝"
```

- [ ] **Step 4: 진행 원장 갱신**

`.superpowers/sdd/progress.md`(gitignore, 로컬)에 ③ 완료 요약 append. 이후 최종 리뷰(requesting-code-review) → finishing-a-development-branch로 main 병합·게시(별도 단계).

---

## Self-Review (작성자 체크)

**1. Spec coverage:**
- §3 파일구조 → Task 1~9 전부 생성. ✅
- §4 게임플레이/상태머신(AIMING/FLYING/SETTLED/CLEARED/FAILED) → Task 6·7. ✅
- §4 별점 1/2/3발 → Task 2 `starsForAttempt` + Task 8 표시. ✅
- §4 저장 `todak.throw.v1` → Task 4 로드 + Task 8 저장. ✅
- §5 Matter 물리·세로형·드래그새총·센서판정 → Task 5·6·7. ✅
- §5 세로 보완(수직적층·대각) → Task 3 레벨 데이터(4·5 적층, 6 대각). 카메라 워크는 §5 "연출용"으로 명시했고 YAGNI 차원에서 1차 미구현(필요 시 Task 10 튜닝에서 추가) — 의도된 축소. ✅
- §6 레벨 6개·3타입·validateLevel → Task 3. ✅
- §7 UI 상단바·오버레이·힌트·에러처리 → Task 8 + Task 4(phaser/localStorage 폴백). 스프라이트 로드 실패 도형 폴백 → Task 4 BootScene + Task 5 `textures.exists` 분기. ✅
- §8 순수 Node 테스트 + Playwright 스모크 → Task 1~3 + Task 10. ✅

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "적절한 에러처리" 류 추상 표현 없음. ✅

**3. Type consistency:** `pullVector→{dx,dy,dist}`, `launchVelocity({dx,dy})→{vx,vy}`, `recordClear(progress,levelId,jarsUsed)`, 이벤트명 `level-init`/`jars-changed`/`cleared`/`failed`, 바디 label `'pot'`/`'jar'`/타입명 — Task 간 일관. ✅

**남은 튜닝 리스크(인정):** 물리 수치(LAUNCH_SCALE·gravity·센서반경)는 브라우저에서 손튜닝 필요 → Task 10에 명시.
