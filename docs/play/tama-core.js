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
