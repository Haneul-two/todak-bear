#!/usr/bin/env node
// 🐻 신호원 ②: Claude Code 훅 → 곰 이벤트.
// settings.json 의 hooks 에서 호출. 어떤 훅이냐에 따라 --event 를 다르게 넘긴다.
//   Stop 훅           → --event done   (작업 끝 → 박수곰)
//   PostToolUse 훅     → --event activity (도구 썼다 → 막힘 타이머 리셋 = 토닥 해제)
//   SubagentStop/에러   → --event error  (→ 안아주는 곰)
//
// 훅이 stdin으로 주는 JSON은 굳이 안 읽어도 동작하지만, tool 실패 감지를 위해 살짝 본다.
const state = require('../../../packages/bear-core/state.js');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
let event = arg('--event', 'activity');

let buf = '';
process.stdin.on('data', (c) => (buf += c));
process.stdin.on('end', () => run());
// 훅이 stdin을 안 닫는 환경 대비: 입력 없으면 바로 진행
if (process.stdin.isTTY) run();

// tool 응답이 "진짜 실패"인지 구조화된 필드로만 판단.
// (substring 휴리스틱은 오탐 多 — grep 결과·파일 내용에 'error'란 단어만 있어도
//  곰이 안아주는 문제가 있어 제거했다. 명시적 실패 플래그만 신뢰한다.)
function looksLikeError(resp) {
  if (!resp || typeof resp !== 'object') return false;
  if (resp.is_error === true || resp.success === false || resp.interrupted === true) return true;
  if (typeof resp.error === 'string' && resp.error.trim()) return true;
  return false;
}

let done = false;
function run() {
  if (done) return; done = true;
  try {
    const j = JSON.parse(buf.replace(/^﻿/, '').trim());
    // PostToolUse 인데 tool 결과가 명시적 에러면 error 로 승격 → 안아주는 곰
    if (event === 'activity' && looksLikeError(j.tool_response || j.tool_result)) event = 'error';
  } catch {}

  if (event === 'done' || event === 'error') {
    state.markEvent(event);
  } else {
    // activity: 도구를 짧은 간격으로 연달아 쓰면 '신남(high)' → cheerful,
    // 띄엄띄엄이면 '차분(low)' → content. (직전 활동과의 간격으로 판단)
    // 실시간 신호원 중 실제 사용자 작업을 뜻하는 건 도구 호출뿐이라 여기서만 set.
    const prev = state.readState();
    const gap = prev.lastActivityAt ? Date.now() - prev.lastActivityAt : Infinity;
    state.touchActivity(gap < 25000 ? 'high' : 'low');
  }
  // 훅은 stdout으로 제어 JSON을 기대할 수 있으니 빈 객체 반환(통과)
  process.stdout.write('{}');
}
