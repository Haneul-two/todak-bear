'use strict';
// 입력 → 버튼 의도. hitTest/createInput은 DOM 비의존(테스트 가능), attach만 DOM 배선.

function hitTest(buttons, lx, ly) {
  for (const b of buttons) {
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return b.type;
  }
  return null;
}

function createInput() {
  let q = null;
  return {
    push(type) { q = type; },
    read() { const t = q; q = null; return t; },
  };
}

function attach(input, el, core) {
  const handle = (clientX, clientY) => {
    const rect = el.getBoundingClientRect();
    const lx = (clientX - rect.left) / rect.width * core.WIDTH;
    const ly = (clientY - rect.top) / rect.height * core.HEIGHT;
    const type = hitTest(core.BUTTONS, lx, ly);
    if (type) input.push(type);
  };
  el.addEventListener('click', (e) => handle(e.clientX, e.clientY));
  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (t) handle(t.clientX, t.clientY);
    e.preventDefault();           // 터치 후 click 중복 방지
  }, { passive: false });
}

const inputApi = { hitTest, createInput, attach };
if (typeof module !== 'undefined' && module.exports) module.exports = inputApi;
if (typeof window !== 'undefined') window.TodakTamaInput = inputApi;
