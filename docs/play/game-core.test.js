'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./game-core.js');

test('createState 기본값', () => {
  const s = C.createState();
  assert.strictEqual(s.lives, C.START_LIVES);
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.over, false);
  assert.strictEqual(s.bearX, C.WIDTH / 2);
  assert.deepStrictEqual(s.items, []);
});

test('tick: 오른쪽 의도면 곰이 오른쪽으로', () => {
  const s = C.createState();
  const x0 = s.bearX;
  C.tick(s, 'right', 0.1);
  assert.ok(s.bearX > x0);
});

test('tick: 경계를 넘지 않음(클램프)', () => {
  const s = C.createState();
  for (let i = 0; i < 100; i++) C.tick(s, 'left', 0.1);
  assert.ok(s.bearX >= C.BEAR_W / 2);
});

test('tick: 시간이 지나면 아이템이 생성된다', () => {
  const s = C.createState({ seed: 7 });
  for (let i = 0; i < 30; i++) C.tick(s, null, 0.1); // 3초
  assert.ok(s.items.length > 0, '아이템이 생성되어야 함');
});

test('tick: 아이템은 아래로 떨어진다', () => {
  const s = C.createState({ seed: 7 });
  C.tick(s, null, 0.1);
  s.items.push({ x: 100, y: 0, vy: 100, type: 'honey' });
  const y0 = s.items[s.items.length - 1].y;
  C.tick(s, null, 0.1);
  const it = s.items.find((i) => i.x === 100);
  assert.ok(it && it.y > y0, 'y가 증가해야 함');
});

test('난이도: 시간이 지날수록 생성 간격이 짧아진다', () => {
  assert.ok(C.spawnInterval(0) > C.spawnInterval(40));
});

test('난이도: 시간이 지날수록 낙하가 빨라진다', () => {
  assert.ok(C.fallSpeed(40) > C.fallSpeed(0));
});
