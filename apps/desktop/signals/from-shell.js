#!/usr/bin/env node
// 🐻 신호원 ③: 셸 직전 종료코드 → 곰 이벤트. (#2 터미널 프롬프트에서 같이 호출 가능)
//   node from-shell.js --status 1   → error (안아주는 곰)
//   node from-shell.js --status 0   → activity (살아있음, 막힘 타이머 리셋)
const state = require('../../../packages/bear-core/state.js');
const i = process.argv.indexOf('--status');
const code = i >= 0 ? parseInt(process.argv[i + 1], 10) : 0;
if (code !== 0) state.markEvent('error');
else state.touchActivity();
