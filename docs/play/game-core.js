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

function spawnInterval(elapsed) {            // 1.1s → 최소 0.45s
  return Math.max(0.45, 1.1 - elapsed * 0.012);
}
function fallSpeed(elapsed) {                // 120 → 최대 300 px/s
  return Math.min(300, 120 + elapsed * 3);
}

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

  return state;
}

function caught(state, it) {
  const bx = state.bearX - BEAR_W / 2, by = BEAR_Y - BEAR_H / 2;
  const ix = it.x - ITEM_W / 2, iy = it.y - ITEM_H / 2;
  return bx < ix + ITEM_W && bx + BEAR_W > ix && by < iy + ITEM_H && by + BEAR_H > iy;
}

function poseFor(state) {
  if (state.over) return 'hug';
  if (state.flash > 0) return 'cheer';
  return 'content';
}

function reset(state) {
  const best = state.best;
  Object.assign(state, createState({ best, seed: (Date.now() & 0xffff) + 1 }));
  return state;
}

const api = {
  WIDTH, HEIGHT, BEAR_W, BEAR_H, BEAR_Y, BEAR_SPEED, ITEM_W, ITEM_H, START_LIVES,
  makeRng, createState, tick, caught, reset, poseFor,
  spawnInterval, fallSpeed,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.HoneyCatch = api;
