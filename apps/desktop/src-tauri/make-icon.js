// 의존성 없이 512x512 단색(허니) PNG 아이콘 생성 → `tauri icon` 의 소스로 사용.
// (임시 아이콘. 나중에 곰 일러스트로 교체 가능)
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 512, H = 512;
const [r, g, b] = [0xE8, 0xA3, 0x3D]; // honey

// 각 스캔라인 앞에 필터 바이트(0) + RGB 픽셀
const raw = Buffer.alloc(H * (1 + W * 3));
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0;
  for (let x = 0; x < W; x++) { raw[o++] = r; raw[o++] = g; raw[o++] = b; }
}
const idat = zlib.deflateSync(raw);

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8bit, color type 2 (truecolor RGB)

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, 'icon-src.png');
fs.writeFileSync(out, png);
console.log('🐻 wrote', out, png.length, 'bytes');
