'use strict';
// 토닥곰 모음시트 → 개별 투명 스프라이트 추출
// 4분할 → 흰/연회색 배경 플러드필 투명화 → 최대 덩어리만 유지(라벨·% 제거) → 트림
const sharp = require('sharp');
const path = require('path');

const POSES = 'C:/Users/caring/Projects/todak-bear/docs/play/assets/poses';
const OUT = process.argv[2] || POSES; // 출력 폴더
const SAMPLE = process.argv.includes('--sample');

// 시트 → 표정
const SHEETS = [
  { file: '기본.jpg', expr: 'content' },
  { file: '시무룩.jpg', expr: 'sad' },
  { file: '졸림.jpg', expr: 'sleep' },
  { file: '행복.jpg', expr: 'happy' },
];
// 사분면 → 단계 (TL,TR,BL,BR)
const QUAD = [
  { stage: 'baby',  qx: 0, qy: 0 },
  { stage: 'child', qx: 1, qy: 0 },
  { stage: 'adult', qx: 0, qy: 1 },
  { stage: 'elder', qx: 1, qy: 1 },
];

function isBg(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx >= 232 && (mx - mn) <= 20;   // 거의 흰색 + 저채도(연회색 그림자 포함)
}

// 사분면 안에서 라벨(위)·%(아래)·카드테두리(옆) 제거용 inset 비율
const TOP = 0.15, BOT = 0.12, SIDE = 0.06;

async function extractCell(buf, W, H, ch, qx, qy) {
  // 사분면 경계 (절반씩) + inset
  const qw = W / 2, qh = H / 2;
  const x0 = Math.floor(qx * qw + qw * SIDE), x1 = Math.floor((qx + 1) * qw - qw * SIDE);
  const y0 = Math.floor(qy * qh + qh * TOP),  y1 = Math.floor((qy + 1) * qh - qh * BOT);
  const cw = x1 - x0, cwh = y1 - y0;
  // 로컬 RGBA 버퍼
  const a = new Uint8Array(cw * cwh * 4);
  for (let y = 0; y < cwh; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * ch;
      const di = (y * cw + x) * 4;
      a[di] = buf[si]; a[di + 1] = buf[si + 1]; a[di + 2] = buf[si + 2]; a[di + 3] = 255;
    }
  }
  // 1) 가장자리에서 배경 플러드필 → alpha 0
  const visited = new Uint8Array(cw * cwh);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cw || y >= cwh) return;
    const p = y * cw + x; if (visited[p]) return; visited[p] = 1; stack.push(p);
  };
  for (let x = 0; x < cw; x++) { push(x, 0); push(x, cwh - 1); }
  for (let y = 0; y < cwh; y++) { push(0, y); push(cw - 1, y); }
  while (stack.length) {
    const p = stack.pop(); const x = p % cw, y = (p - x) / cw; const di = p * 4;
    if (!isBg(a[di], a[di + 1], a[di + 2])) continue;
    a[di + 3] = 0; // 배경
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // 2) 남은 불투명 픽셀의 연결요소 → 최대 덩어리만 유지 (라벨/% 글자 제거)
  const comp = new Int32Array(cw * cwh).fill(-1);
  let best = -1, bestSize = 0, cid = 0;
  for (let p = 0; p < cw * cwh; p++) {
    if (a[p * 4 + 3] === 0 || comp[p] !== -1) continue;
    let size = 0; const st = [p]; comp[p] = cid;
    while (st.length) {
      const q = st.pop(); size++;
      const x = q % cw, y = (q - x) / cw;
      const nb = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= cw || ny >= cwh) continue;
        const np = ny * cw + nx;
        if (a[np * 4 + 3] !== 0 && comp[np] === -1) { comp[np] = cid; st.push(np); }
      }
    }
    if (size > bestSize) { bestSize = size; best = cid; }
    cid++;
  }
  // 최대 덩어리 외 제거
  for (let p = 0; p < cw * cwh; p++) if (comp[p] !== best) a[p * 4 + 3] = 0;
  // 3) bbox 트림
  let minx = cw, miny = cwh, maxx = 0, maxy = 0;
  for (let y = 0; y < cwh; y++) for (let x = 0; x < cw; x++) {
    if (a[(y * cw + x) * 4 + 3] !== 0) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  const pad = 6;
  minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad);
  maxx = Math.min(cw - 1, maxx + pad); maxy = Math.min(cwh - 1, maxy + pad);
  const bw = maxx - minx + 1, bh = maxy - miny + 1;
  const out = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const si = ((miny + y) * cw + (minx + x)) * 4, di = (y * bw + x) * 4;
    out[di] = a[si]; out[di+1] = a[si+1]; out[di+2] = a[si+2]; out[di+3] = a[si+3];
  }
  return { out, bw, bh };
}

(async () => {
  const targets = SAMPLE ? [SHEETS[0]] : SHEETS;
  for (const sheet of targets) {
    const { data, info } = await sharp(path.join(POSES, sheet.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const quads = SAMPLE ? [QUAD[0]] : QUAD;
    for (const q of quads) {
      const { out, bw, bh } = await extractCell(data, info.width, info.height, info.channels, q.qx, q.qy);
      const name = `${q.stage}_${sheet.expr}.png`;
      await sharp(out, { raw: { width: bw, height: bh, channels: 4 } }).png().toFile(path.join(OUT, name));
      console.log(`${name.padEnd(20)} ${bw}x${bh}`);
    }
  }
})();
