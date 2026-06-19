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
