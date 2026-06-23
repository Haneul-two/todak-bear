'use strict';
// 렌더: 상태 → 캔버스(논리좌표). 곰 단계+표정 스프라이트, 스탯바, 말풍선, 버튼.

function createRenderer(core, posesBasePath) {
  const STAGES = ['baby', 'child', 'adult', 'elder'];
  const POSES = ['content', 'sad', 'sleep', 'happy'];
  const FALLBACK_FACE = { content: '•ᴥ•', sad: '•︵•', sleep: '-ᴥ-', happy: '≧ᴥ≦' };
  const imgs = {}; const ok = {};
  for (const st of STAGES) for (const po of POSES) {
    const key = st + '_' + po;
    const img = new Image();
    img.onload = () => { ok[key] = true; };
    img.onerror = () => { ok[key] = false; };
    img.src = posesBasePath + key + '.png';
    imgs[key] = img;
  }
  const SCALE = { baby: 0.72, child: 0.85, adult: 1.0, elder: 1.0 };
  const BEAR_BASE_H = 200;          // 어른 기준 높이(논리px)
  const BEAR_BASELINE = 356;        // 발 닿는 y

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(ctx, state, nowMs) {
    const W = core.WIDTH, H = core.HEIGHT;
    // 배경
    ctx.fillStyle = '#FBF3E4';
    ctx.fillRect(0, 0, W, H);

    // 상단: 이름 · 단계 · 나이
    const stage = core.growthStage(state, nowMs);
    const stageKo = { baby: '아기', child: '소년', adult: '어른', elder: '노년' }[stage];
    const ageDays = Math.floor((nowMs - state.bornAt) / core.DAY_MS) + 1;
    ctx.fillStyle = '#5a4a36';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`🐻 ${state.name} · ${stageKo}`, 12, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`Day ${ageDays}`, W - 12, 12);

    // 스탯바 4개 (2×2)
    const barX = [12, 188], barY = [40, 68];
    const barW = 160, barH = 18;
    core.STATS.forEach((meta, i) => {
      const x = barX[i % 2], y = barY[(i / 2) | 0];
      const v = state.stats[meta.key];
      ctx.fillStyle = '#EADBC2';
      roundRect(ctx, x + 22, y, barW - 22, barH, 9); ctx.fill();
      ctx.fillStyle = (v < core.NEED_BAND) ? '#D2683E' : meta.color;
      const fillW = Math.max(0, (barW - 22) * v / core.MAX);
      if (fillW > 0) { roundRect(ctx, x + 22, y, fillW, barH, 9); ctx.fill(); }
      ctx.font = '14px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(meta.emoji, x, y + barH / 2);
    });

    // 곰 스프라이트 (단계+표정)
    const pose = core.poseFor(state);
    const key = stage + '_' + pose;
    const img = imgs[key];
    if (ok[key] && img.complete && img.naturalWidth > 0) {
      const h = BEAR_BASE_H * SCALE[stage];
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, (W - w) / 2, BEAR_BASELINE - h, w, h);
    } else {
      ctx.fillStyle = '#C8A06A';
      ctx.beginPath(); ctx.arc(W / 2, BEAR_BASELINE - 60, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2f23'; ctx.font = '22px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(FALLBACK_FACE[pose] || FALLBACK_FACE.content, W / 2, BEAR_BASELINE - 60);
    }

    // 말풍선 (현재 욕구/반응)
    const bubble = core.bubbleFor(state);
    if (bubble) {
      const bx = W / 2 + 56, by = BEAR_BASELINE - BEAR_BASE_H * SCALE[stage] + 6;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, bx - 4, by - 22, 44, 40, 12); ctx.fill();
      ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(bubble, bx + 18, by - 2);
    }

    // 하단 버튼 4개
    core.BUTTONS.forEach((b) => {
      ctx.fillStyle = '#E8A33D';
      roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
      ctx.fillStyle = '#3b2f23';
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${b.emoji} ${b.label}`, b.x + b.w / 2, b.y + b.h / 2);
    });
  }

  return { draw };
}

const rendererApi = { createRenderer };
if (typeof module !== 'undefined' && module.exports) module.exports = rendererApi;
if (typeof window !== 'undefined') window.TodakTamaRenderer = rendererApi;
