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
