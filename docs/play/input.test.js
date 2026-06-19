'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createInput } = require('./input.js');

test('read: 아무것도 안 누르면 null', () => {
  const i = createInput();
  assert.strictEqual(i.read(), null);
});

test('read: 왼쪽만 누르면 left', () => {
  const i = createInput();
  i.setLeft(true);
  assert.strictEqual(i.read(), 'left');
});

test('read: 둘 다 누르면 null (상쇄)', () => {
  const i = createInput();
  i.setLeft(true); i.setRight(true);
  assert.strictEqual(i.read(), null);
});
