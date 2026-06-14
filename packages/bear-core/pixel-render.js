// 픽셀곰 grid → PNG (RGBA, 투명배경). 의존성 없음(zlib만). 시각 확인·아이콘 소스용.
const zlib = require('zlib');
const fs = require('fs');
const PB = require('./pixelbear.js');

function hexToRGBA(c) {
  if (!c) return [0, 0, 0, 0];
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
}

// 여러 grid를 가로로 이어붙여 하나의 RGBA 매트릭스로 (gap=투명 칸)
function composite(grids, gap = 1) {
  const h = PB.H, w = PB.W;
  const cols = grids.length * w + (grids.length - 1) * gap;
  const m = Array.from({ length: h }, () => Array(cols).fill(null));
  grids.forEach((g, i) => {
    const ox = i * (w + gap);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y][ox + x] = g[y][x];
  });
  return m;
}

function toPNG(matrix, scale, outPath) {
  const h = matrix.length, w = matrix[0].length;
  const W = w * scale, Hh = h * scale;
  const raw = Buffer.alloc(Hh * (1 + W * 4));
  let o = 0;
  for (let y = 0; y < Hh; y++) {
    raw[o++] = 0;
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = hexToRGBA(matrix[Math.floor(y / scale)][Math.floor(x / scale)]);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(Hh, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  return { W, Hh };
}

module.exports = { composite, toPNG };

// 직접 실행 시: 모든 기분 컨택트 시트 + 단일 아이콘 소스 출력
if (require.main === module) {
  const moods = ['content', 'cheerful', 'cheer', 'cozy', 'pat', 'hug', 'worried', 'sleepy'];
  const sheet = composite(moods.map((m) => PB.grid(m)), 1);
  const a = toPNG(sheet, 8, __dirname + '/pixel-sheet.png');

  // 앱 아이콘: cheerful 곰을 정사각형 중앙 배치(여백 포함)
  const g = PB.grid('cheerful');
  const side = 21, ox = Math.floor((side - PB.W) / 2), oy = Math.floor((side - PB.H) / 2);
  const sq = Array.from({ length: side }, () => Array(side).fill(null));
  for (let y = 0; y < PB.H; y++) for (let x = 0; x < PB.W; x++) sq[y + oy][x + ox] = g[y][x];
  const b = toPNG(sq, 26, __dirname + '/pixel-icon-src.png');
  console.log('🐻 sheet', a.W + 'x' + a.Hh, '| icon', b.W + 'x' + b.Hh, '|', moods.join(' '));
}
