#!/usr/bin/env node
// 🐻 신호원 ①: Claude Code statusline JSON → 곰 상태(한도%·비용).
// "tee"로 동작: 받은 세션 JSON을 그대로 stdout으로 흘려보내고(렌더러가 받게),
// 동시에 한도%·비용을 state.json 에 기록한다. 그래서 statusline "앞단"에 둔다:
//   node from-statusline.js | node statusline-bear.js
// (세션 JSON은 파이프 첫 명령에만 들어오므로 순서가 중요)
const state = require('../../../packages/bear-core/state.js');

let buf = '';
process.stdin.on('data', (c) => (buf += c));
process.stdin.on('end', () => {
  process.stdout.write(buf); // 무조건 그대로 통과 (렌더러가 정상 동작하도록)
  try {
    const data = JSON.parse(buf.replace(/^﻿/, '').trim());
    const pct = data.rate_limits?.five_hour?.used_percentage;
    const cost = data.cost?.total_cost_usd;
    if (pct != null) state.setUsage(pct, cost);
    else state.touchActivity(); // 한도 정보 전이라도 "살아있음" 기록
  } catch {
    // JSON 아니면 조용히 통과만
  }
});
