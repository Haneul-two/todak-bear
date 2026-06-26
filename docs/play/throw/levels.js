'use strict';
// 토닥곰 던지기 — 레벨 데이터(선언적) + 검증. 좌표계 360×640, 원점 좌상단.

const W = 360, H = 640;
const OBSTACLE_TYPES = ['log', 'box', 'rock'];

// 곰은 아래쪽, 항아리는 위쪽(살짝 대각). 한 기믹씩 난이도 상승.
const LEVELS = [
  { id: 1, bear: { x: 70, y: 500 }, pot: { x: 250, y: 120, r: 38 }, jars: 3,
    obstacles: [], hint: '곰을 당겼다 놓아 꿀단지를 항아리에 넣어요' },
  { id: 2, bear: { x: 60, y: 500 }, pot: { x: 280, y: 130, r: 36 }, jars: 3,
    obstacles: [ { type: 'rock', x: 180, y: 360, w: 44, h: 44, static: true } ],
    hint: '바위를 비껴 던져요' },
  { id: 3, bear: { x: 60, y: 500 }, pot: { x: 270, y: 120, r: 36 }, jars: 3,
    obstacles: [ { type: 'log', x: 190, y: 380, w: 100, h: 24, static: true } ],
    hint: '통나무를 맞춰 밀어내요' },
  { id: 4, bear: { x: 60, y: 500 }, pot: { x: 260, y: 130, r: 34 }, jars: 3,
    obstacles: [
      { type: 'box', x: 250, y: 300, w: 44, h: 44, static: true },
      { type: 'box', x: 250, y: 256, w: 44, h: 44, static: true } ],
    hint: '쌓인 상자를 무너뜨려요' },
  { id: 5, bear: { x: 55, y: 500 }, pot: { x: 285, y: 120, r: 32 }, jars: 3,
    obstacles: [
      { type: 'rock', x: 200, y: 380, w: 44, h: 44, static: true },
      { type: 'box',  x: 250, y: 300, w: 44, h: 44, static: true },
      { type: 'box',  x: 250, y: 256, w: 44, h: 44, static: true } ],
    hint: '복합 벽을 정확히 뚫어요' },
  { id: 6, bear: { x: 60, y: 500 }, pot: { x: 70, y: 120, r: 30 }, jars: 3,
    obstacles: [
      { type: 'rock', x: 150, y: 260, w: 44, h: 120, static: true },
      { type: 'log',  x: 120, y: 430, w: 110, h: 24, static: true } ],
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

const levelsApi = { LEVELS, OBSTACLE_TYPES, getLevel, validateLevel };
if (typeof module !== 'undefined' && module.exports) module.exports = levelsApi;
if (typeof window !== 'undefined') window.TodakThrowLevels = levelsApi;
