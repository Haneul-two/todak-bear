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

function care(state, type) {
  const key = ACTIONS[type];
  if (!key) return false;
  if (state.cooldown[type] > 0) return false;
  state.stats[key] = clamp(state.stats[key] + CARE_AMOUNT, 0, MAX);
  state.flash = FLASH;
  state.cooldown[type] = COOLDOWN;
  return true;
}

function tick(state, dt) {
  const dec = DECAY_PER_HOUR * (dt / 3600);
  for (const k of STAT_KEYS) state.stats[k] = clamp(state.stats[k] - dec, 0, MAX);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
  for (const t of ACTION_KEYS) if (state.cooldown[t] > 0) state.cooldown[t] = Math.max(0, state.cooldown[t] - dt);
  return state;
}

function applyElapsed(state, ms) {
  if (!(ms > 0)) return state;
  const dec = DECAY_PER_HOUR * (ms / 3600000);
  for (const k of STAT_KEYS) state.stats[k] = clamp(state.stats[k] - dec, 0, MAX);
  return state;
}

function growthStage(state, nowMs) {
  const days = (nowMs - state.bornAt) / DAY_MS;
  if (days < STAGE_DAYS.child) return 'baby';
  if (days < STAGE_DAYS.adult) return 'child';
  if (days < STAGE_DAYS.elder) return 'adult';
  return 'elder';
}

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

const tamaCoreApi = {
  WIDTH, HEIGHT, MAX, DECAY_PER_HOUR, CARE_AMOUNT, COOLDOWN, FLASH,
  SLEEP_BAND, NEED_BAND, HAPPY_AVG, DAY_MS, STAGE_DAYS, ACTIONS, STAT_KEYS, ACTION_KEYS,
  BUTTONS, STATS,
  clamp, createState, care, tick, applyElapsed, growthStage, poseFor, BUBBLE_EMOJI, bubbleFor,
  serialize, deserialize,
};
if (typeof module !== 'undefined' && module.exports) module.exports = tamaCoreApi;
if (typeof window !== 'undefined') window.TodakTama = tamaCoreApi;
