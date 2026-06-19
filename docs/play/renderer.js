'use strict';
// 렌더: 상태 → 캔버스(논리좌표). 곰 포즈 교체, 로드 실패 시 ASCII 폴백.

function createRenderer(core, posesBasePath) {
  const FACES = { content: '•ᴥ•', cheer: '≧ᴥ≦', hug: 'ᴗᴥᴗ' };
  const poses = {};
  const ok = {};
  for (const key of ['content', 'cheer', 'hug']) {
    const img = new Image();
    img.onload = () => { ok[key] = true; };
    img.onerror = () => { ok[key] = false; };
    img.src = posesBasePath + key + '.png';
    poses[key] = img;
  }

  function draw(ctx, state) {
    const { w, h } = state;
    ctx.fillStyle = '#FBF3E4';
    ctx.fillRect(0, 0, w, h);

    // 아이템 (이모지)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = core.ITEM_H + 'px serif';
    for (const it of state.items) {
      ctx.fillText(it.type === 'star' ? '⭐' : '🍯', it.x, it.y);
    }

    // 곰
    const key = core.poseFor(state);
    const bx = state.bearX - core.BEAR_W / 2;
    const by = core.BEAR_Y - core.BEAR_H / 2;
    if (ok[key] && poses[key].complete && poses[key].naturalWidth > 0) {
      ctx.drawImage(poses[key], bx, by, core.BEAR_W, core.BEAR_H);
    } else {
      ctx.fillStyle = '#C8A06A';
      ctx.beginPath();
      ctx.arc(state.bearX, core.BEAR_Y, core.BEAR_W / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b2f23';
      ctx.font = '18px monospace';
      ctx.fillText(FACES[key] || FACES.content, state.bearX, core.BEAR_Y);
    }

    // HUD
    ctx.fillStyle = '#5a4a36';
    ctx.font = 'bold 18px sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('점수 ' + state.score, 12, 12);
    ctx.textAlign = 'right';
    ctx.fillText('최고 ' + state.best, w - 12, 12);
    ctx.textAlign = 'center';
    const hearts = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, core.START_LIVES - state.lives));
    ctx.fillText(hearts, w / 2, 12);
  }

  return { draw };
}

const api = { createRenderer };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.HoneyRenderer = api;
