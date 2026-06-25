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

const scoringApi = { TOTAL_LEVELS, clamp, starsForAttempt, createProgress, recordClear, serialize, deserialize };
if (typeof module !== 'undefined' && module.exports) module.exports = scoringApi;
if (typeof window !== 'undefined') window.TodakThrowScoring = scoringApi;
