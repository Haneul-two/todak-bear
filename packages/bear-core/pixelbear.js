// 🐻 토닥곰 픽셀 스프라이트 — 둥글둥글 갈색곰. 기하학(원·타원 레이어)으로 그려
// 손 픽셀 없이 둥근 곰을 만들고, 기분은 눈·입·볼터치로 표현. 의존성 없음(브라우저/노드 공용).
// grid(moodKey) -> 2D 배열(각 칸 '#rrggbb' 또는 null=투명). 캔버스/ PNG 양쪽에서 사용.
'use strict';
(function () { // 전역 오염 방지: 일반 <script>로 로드돼도 다른 코어와 const 충돌 안 나게

const W = 17, H = 16;

// 색 (둥글둥글 갈색곰 팔레트)
const C = {
  out:   '#5E3E27', // 외곽선 진한 갈색
  body:  '#B07A4E', // 몸통 갈색
  hi:    '#C28A5C', // 하이라이트
  cream: '#ECD8BB', // 주둥이/귀안 크림
  nose:  '#2E2018', // 코
  eye:   '#2A1C12', // 눈
  shine: '#FFFFFF', // 눈 반짝
  blush: '#E89A9A', // 볼터치
};

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);
const inEllipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1;

// 기분 → 눈 모양 + 입 모양 + 볼터치 여부 (토닥곰 8기분과 동일 키)
const FACE = {
  cheerful: { eye: 'happy',  mouth: 'smile',  blush: true  },
  content:  { eye: 'open',   mouth: 'neutral', blush: false },
  cozy:     { eye: 'closed', mouth: 'smile',  blush: true  },
  pat:      { eye: 'closed', mouth: 'soft',   blush: true  },
  cheer:    { eye: 'happy',  mouth: 'open',   blush: true  },
  sleepy:   { eye: 'sleep',  mouth: 'neutral', blush: false },
  worried:  { eye: 'wide',   mouth: 'o',      blush: false },
  hug:      { eye: 'closed', mouth: 'smile',  blush: true  },
};

// 눈 중심 (위로 올림, 정수 좌표). 좌/우 간격 6칸.
const EYES = [[5, 7], [11, 7]];

function paintEye(set, state, cx, cy) {
  const D = C.eye, S = C.shine;
  if (state === 'open') {            // 동그란 눈 + 반짝
    [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]].forEach(([x, y]) => set(cx + x, cy + y, D));
    set(cx - 1, cy - 1, S);
  } else if (state === 'wide') {     // 걱정: 크게 뜬 눈
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(cx + x, cy + y, D);
    set(cx - 1, cy - 1, S);
  } else if (state === 'happy') {    // ^ 웃는 눈
    set(cx, cy - 1, D); set(cx - 1, cy, D); set(cx + 1, cy, D);
  } else if (state === 'closed') {   // ‿ 편안히 감음
    set(cx - 1, cy, D); set(cx, cy + 1, D); set(cx + 1, cy, D);
  } else if (state === 'sleep') {    // — 졸린 일자
    set(cx - 1, cy, D); set(cx, cy, D); set(cx + 1, cy, D);
  }
}

function paintMouth(set, kind) {
  const cx = 8, cy = 12, N = C.nose;
  if (kind === 'smile' || kind === 'soft') {   // ‿ 미소
    set(cx - 1, cy, N); set(cx, cy + 1, N); set(cx + 1, cy, N);
  } else if (kind === 'open') {                 // 활짝
    set(cx - 1, cy, N); set(cx + 1, cy, N); set(cx, cy + 1, N); set(cx, cy, '#9A5A5A');
  } else if (kind === 'o') {                     // 걱정 (작은 입)
    set(cx, cy, N);
  } else {                                       // neutral 살짝 웃음
    set(cx - 1, cy, N); set(cx + 1, cy, N);
  }
}

// moodKey → 색 그리드(2D). 모르는 키는 content.
function grid(moodKey) {
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const face = FACE[moodKey] || FACE.content;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // 귀: 외곽선 원 + 크림 안쪽
      const earL = dist(x, y, 3.5, 3), earR = dist(x, y, 13, 3);
      // 머리: 큰 원
      const head = dist(x, y, 8.5, 8.5);
      let c = null;
      if (earL <= 2.8 || earR <= 2.8) { c = C.out;
        if (earL <= 1.6 || earR <= 1.6) c = C.cream; }
      if (head <= 7) { c = C.out; if (head <= 6) c = C.body; }
      if (c) set(x, y, c);
    }
  }
  // 주둥이(크림 타원)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (g[y][x] === C.body || g[y][x] === C.hi) {
      if (inEllipse(x, y, 8.5, 11, 3.3, 2.4)) set(x, y, C.cream);
    }
  // 볼터치 (2x2 둥근 분홍, 몸통 위에만)
  if (face.blush) {
    [[4, 9], [13, 9]].forEach(([bx, by]) => {
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => {
        const xx = bx + dx, yy = by + dy;
        if (g[yy]?.[xx] === C.body) set(xx, yy, C.blush);
      });
    });
  }
  // 코
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (inEllipse(x, y, 8.5, 10.1, 1.4, 1.0)) set(x, y, C.nose);
  // 눈
  EYES.forEach(([cx, cy]) => paintEye(set, face.eye, cx, cy));
  // 입
  paintMouth(set, face.mouth);
  return g;
}

// 캔버스에 그리기 (데스크톱 UI용)
function drawToCanvas(canvas, moodKey, scale = 8) {
  const g = grid(moodKey);
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g[y][x]; if (!c) continue;
    ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale);
  }
}

const api = { W, H, C, grid, drawToCanvas, FACE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.PixelBear = api;

})();
