#!/usr/bin/env node
// 🐻 토닥곰 터미널 프롬프트 — 셸 신호(직전 종료코드·시각)에 반응하는 한 줄 곰.
// starship/oh-my-posh의 custom command 또는 PowerShell prompt 함수에서 호출.
//
// 사용:  node todak-prompt.js --status <exitcode> --duration <ms> [--lang ko|en] [--no-color]
//   --status 0 이 아니면 직전 명령 실패 → 안아주는 곰(hug)
const T = require('../../packages/bear-core/todak.js');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const status = parseInt(arg('--status', '0'), 10);
const durationMs = parseInt(arg('--duration', '0'), 10);
const lang = arg('--lang', 'ko');
const color = !process.argv.includes('--no-color');

// 셸 신호 → 토닥곰 신호로 매핑
const signals = {
  error: status !== 0,
  // 한 명령이 10분 넘게 걸렸으면 "오래 걸렸네" 토닥
  stuckMinutes: durationMs >= 10 * 60 * 1000 ? 10 : 0,
  hour: new Date().getHours(),
};
const key = T.pickMood(signals);
const m = T.getMood(key);
const c = color ? m.paletteObj.ansi : '';
const dim = color ? '\x1b[2m' : '';
const r = color ? '\x1b[0m' : '';

// 한 줄: 곰 얼굴 + 곰의 한 마디 (프롬프트라 짧게)
process.stdout.write(`${c}ʕ${m.face}ʔ${r} ${dim}${T.line(key, lang)}${r}`);
