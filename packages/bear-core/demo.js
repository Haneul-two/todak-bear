const T = require('./todak.js');
const scns = [
  { t: '평소(낮)',     s: { usage: 30, hour: 14 } },
  { t: '완료',         s: { done: true } },
  { t: '10분째 막힘',  s: { stuckMinutes: 12 } },
  { t: '에러',         s: { error: true } },
  { t: '한도 92%',     s: { usage: 92 } },
  { t: '새벽 3시',     s: { hour: 3 } },
  { t: '한도 75%',     s: { usage: 75 } },
];
console.log(`🐻 ${T.TODAK.name.ko} — ${T.TODAK.tagline.ko}`);
for (const { t, s } of scns) {
  const k = T.pickMood(s);
  console.log(`\n[${t}] -> ${k}`);
  console.log(T.renderAscii(k));
  console.log(`  "${T.line(k, 'ko')}"`);
}
