'use strict';
// 입력 → 의도. 코어(createInput)는 DOM 비의존(테스트 가능), attach만 DOM 배선.

function createInput() {
  const st = { left: false, right: false };
  return {
    setLeft(v) { st.left = !!v; },
    setRight(v) { st.right = !!v; },
    read() {
      if (st.left && !st.right) return 'left';
      if (st.right && !st.left) return 'right';
      return null;
    },
  };
}

function attach(input, el) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') input.setLeft(true);
    if (e.key === 'ArrowRight') input.setRight(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') input.setLeft(false);
    if (e.key === 'ArrowRight') input.setRight(false);
  });

  const onTouch = (e) => {
    input.setLeft(false); input.setRight(false);
    const rect = el.getBoundingClientRect();
    for (const t of e.touches) {
      const rel = (t.clientX - rect.left) / rect.width;
      if (rel < 0.5) input.setLeft(true); else input.setRight(true);
    }
    e.preventDefault();
  };
  el.addEventListener('touchstart', onTouch, { passive: false });
  el.addEventListener('touchmove', onTouch, { passive: false });
  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.touches.length === 0) { input.setLeft(false); input.setRight(false); }
  }, { passive: false });
}

const api = { createInput, attach };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.HoneyInput = api;
