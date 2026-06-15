#!/usr/bin/env node
// 🐻 토닥곰 GitHub 프로필 카드 — 이번 주 활동량(커밋 수)을 곰 기분으로 그린 SVG.
// 다른 프로필 위젯(스네이크·팩맨)과 달리 "내 상태를 위로해주는 곰" 각도.
//
// 사용:  node generate.js --commits <n> [--lang ko|en] [--out card.svg]
const fs = require('fs');
const path = require('path');
const T = require('../../packages/bear-core/todak.js');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const commits = parseInt(arg('--commits', '0'), 10);
const lang = arg('--lang', 'ko');
const out = arg('--out', path.join(__dirname, 'todak-card.svg'));

// 이번 주 활동량 → 토닥곰 기분. 활동 없어도 다그치지 않고 따뜻하게 맞아줌.
function moodForCommits(n) {
  if (n >= 30) return 'cheer';     // 폭주한 한 주 — 정말 잘했어
  if (n >= 10) return 'cheerful';  // 활발
  if (n >= 1)  return 'content';   // 꾸준
  return 'cozy';                   // 잠수 — "오랜만이야, 차 한잔 어때"
}

const key = moodForCommits(commits);
const m = T.getMood(key);
const fg = m.paletteObj.hex;
const msg = T.line(key, lang);
const name = lang.startsWith('en') ? T.TODAK.name.en : T.TODAK.name.ko;
const label = lang.startsWith('en') ? `${commits} commits this week` : `이번 주 커밋 ${commits}개`;

// 7칸 활동 점 (간단 시각화)
const filled = Math.min(7, Math.round((commits / 30) * 7));
const dots = Array.from({ length: 7 }, (_, i) =>
  `<circle cx="${20 + i * 16}" cy="150" r="5" fill="${i < filled ? fg : '#E5E0DA'}"/>`
).join('');

// XML 이스케이프 (메시지에 &, < 등 들어갈 경우 대비)
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="190" viewBox="0 0 480 190" role="img" aria-label="${esc(name)}: ${esc(msg)}">
  <defs>
    <style>
      .face { font: 700 38px ui-monospace, "Cascadia Code", Menlo, monospace; }
      .name { font: 700 20px ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
      .msg  { font: 400 16px ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
      .sub  { font: 400 12px ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
    </style>
  </defs>
  <rect x="1" y="1" width="478" height="188" rx="18" fill="#FFFDF8" stroke="${fg}" stroke-width="2"/>
  <!-- 곰 얼굴 (단일 캐릭터 스펙의 face를 그대로 사용 → 어느 표면에서나 같은 곰) -->
  <text class="face" x="36" y="78" fill="${fg}">ʕ ${esc(m.face)} ʔ</text>
  <text class="name" x="40" y="116" fill="#5A5048">${esc(name)}</text>
  <text class="msg"  x="40" y="142" fill="#5A5048">${esc(msg)}</text>
  ${dots}
  <text class="sub" x="${20 + 7 * 16 + 8}" y="154" fill="#9A9088">${esc(label)}</text>
</svg>`;

fs.writeFileSync(out, svg, 'utf8');
console.log(`🐻 wrote ${out}  (mood: ${key}, commits: ${commits})`);
