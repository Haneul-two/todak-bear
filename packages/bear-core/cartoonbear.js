// 🐻 토닥곰 카툰 스프라이트 — 굵은 검은 외곽선의 통통 곰돌이(앉아서 발바닥 보이는 포즈).
// 레퍼런스(크라우드픽풍 곰) 스타일의 오리지널. buildSVG(moodKey,{laptop}).
// 기분별 눈/입/볼터치 변형. 깜빡임=SVG 내장 CSS. 앞발(.paw-l/.paw-r)=타이핑(노트북 모드).
'use strict';
(function () {

const COL = {
  out:  '#1B1512', fur: '#9C6B43', cream: '#F4E2C6', nose: '#1B1512',
  eye:  '#1B1512', blush: '#E89A9A', white: '#FFFFFF',
  screen:'#3A3A44', deck: '#5C5C66', mark: '#D9D2C4',
};
const SW = 4.5, SWt = 3;
const O  = `stroke="${COL.out}" stroke-width="${SW}" stroke-linejoin="round"`;
const Ot = `stroke="${COL.out}" stroke-width="${SWt}" stroke-linejoin="round"`;

const FACE = {
  cheerful: { eye: 'open',   mouth: 'smile', blush: true,  brow: null },
  content:  { eye: 'open',   mouth: 'w',     blush: false, brow: null },
  cozy:     { eye: 'arc',    mouth: 'smile', blush: true,  brow: null },
  pat:      { eye: 'arc',    mouth: 'w',     blush: true,  brow: null },
  cheer:    { eye: 'arc',    mouth: 'open',  blush: true,  brow: null },
  sleepy:   { eye: 'sleepy', mouth: 'w',     blush: false, brow: null },
  worried:  { eye: 'wide',   mouth: 'o',     blush: false, brow: 'worried' },
  hug:      { eye: 'arc',    mouth: 'smile', blush: true,  brow: null },
};

function eye(cx, cy, state) {
  const E = COL.eye, W = COL.white;
  if (state === 'open' || state === 'wide') {
    const rx = state === 'wide' ? 6 : 5, ry = state === 'wide' ? 8 : 6.8;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${E}"/>` +
           `<circle cx="${cx - 1.6}" cy="${cy - 2.3}" r="1.6" fill="${W}"/>`;
  }
  if (state === 'arc')
    return `<path d="M${cx - 5.5},${cy + 1.5} Q${cx},${cy - 5} ${cx + 5.5},${cy + 1.5}" stroke="${E}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  if (state === 'sleepy')
    return `<path d="M${cx - 5.5},${cy} Q${cx},${cy + 3} ${cx + 5.5},${cy}" stroke="${E}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  return '';
}

// 코 아래 인중선 + 입 (레퍼런스의 ᴥ 입)
function mouth(kind) {
  const M = COL.nose;
  const line = `<path d="M65,60 v3" stroke="${M}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if (kind === 'w') // ‿‿ 기본
    return line + `<path d="M58,64 Q61.5,68 65,64.5" stroke="${M}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
                  `<path d="M65,64.5 Q68.5,68 72,64" stroke="${M}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if (kind === 'smile')
    return line + `<path d="M57,64 Q65,73 73,64" stroke="${M}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  if (kind === 'open')
    return line + `<path d="M58,64 Q65,62 72,64 Q67,75 65,75 Q63,75 58,64 Z" fill="${M}"/>`;
  if (kind === 'o')
    return line + `<ellipse cx="65" cy="68" rx="3" ry="3.8" fill="${M}"/>`;
  return line;
}

function brows(kind) {
  if (kind === 'worried')
    return `<path d="M40,37 Q47,33 54,37" stroke="${COL.out}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
           `<path d="M76,37 Q83,33 90,37" stroke="${COL.out}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return '';
}

// 앞으로 펼친 발 — 큰 발도장(큰 패드 + 발가락 콩 3개)
function foot(cx) {
  const { fur, cream } = COL;
  return `<ellipse cx="${cx}" cy="124" rx="20" ry="15" fill="${fur}" ${O}/>` +
    `<ellipse cx="${cx}" cy="127" rx="10" ry="8" fill="${cream}" ${Ot}/>` +
    `<ellipse cx="${cx - 9}" cy="116" rx="3" ry="3.6" fill="${cream}" ${Ot}/>` +
    `<ellipse cx="${cx}" cy="114" rx="3" ry="3.6" fill="${cream}" ${Ot}/>` +
    `<ellipse cx="${cx + 9}" cy="116" rx="3" ry="3.6" fill="${cream}" ${Ot}/>`;
}

function buildSVG(moodKey, opts) {
  const f = FACE[moodKey] || FACE.content;
  const C = COL;
  const laptop = opts && opts.laptop === true; // 기본은 발바닥 보이는 포즈(노트북 없음)
  const blush = f.blush
    ? `<ellipse cx="40" cy="57" rx="8" ry="4.5" fill="${C.blush}" opacity="0.6"/>` +
      `<ellipse cx="90" cy="57" rx="8" ry="4.5" fill="${C.blush}" opacity="0.6"/>`
    : '';
  return `<svg viewBox="0 0 130 144" xmlns="http://www.w3.org/2000/svg">
  <style>
    .eyes { transform-box: fill-box; transform-origin: center; animation: blink 4.2s infinite; }
    @keyframes blink { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
  </style>
  <!-- 귀 -->
  <circle cx="30" cy="28" r="19" fill="${C.fur}" ${O}/>
  <circle cx="100" cy="28" r="19" fill="${C.fur}" ${O}/>
  <ellipse cx="32" cy="30" rx="9" ry="10" fill="${C.cream}" ${Ot}/>
  <ellipse cx="98" cy="30" rx="9" ry="10" fill="${C.cream}" ${Ot}/>
  <!-- 몸 + 배 -->
  <ellipse cx="65" cy="104" rx="43" ry="34" fill="${C.fur}" ${O}/>
  <ellipse cx="65" cy="110" rx="23" ry="24" fill="${C.cream}"/>
  <!-- 팔 -->
  <ellipse cx="24" cy="100" rx="12" ry="18" fill="${C.fur}" ${O}/>
  <ellipse cx="106" cy="100" rx="12" ry="18" fill="${C.fur}" ${O}/>
  <!-- 머리 -->
  <ellipse cx="65" cy="48" rx="46" ry="43" fill="${C.fur}" ${O}/>
  <!-- 주둥이 -->
  <ellipse cx="65" cy="63" rx="20" ry="14" fill="${C.cream}"/>
  ${blush}
  ${brows(f.brow)}
  <g class="eyes">${eye(47, 46, f.eye)}${eye(83, 46, f.eye)}</g>
  <!-- 코 -->
  <ellipse cx="65" cy="56" rx="5.5" ry="4.2" fill="${C.nose}"/>
  ${mouth(f.mouth)}
  <!-- 발 (앞으로 펼침) -->
  ${foot(34)}${foot(96)}
  ${laptop ? `<rect x="43" y="100" width="44" height="18" rx="3" fill="${C.screen}" ${Ot}/>
  <text x="65" y="112" font-size="7" fill="${C.mark}" text-anchor="middle" font-family="monospace">&lt;/&gt;</text>
  <ellipse class="paw-l" cx="49" cy="120" rx="9" ry="7" fill="${C.fur}" ${O}/>
  <ellipse class="paw-r" cx="81" cy="120" rx="9" ry="7" fill="${C.fur}" ${O}/>` : ''}
</svg>`;
}

const api = { buildSVG, FACE, COL };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.CartoonBear = api;

})();
