'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./tama-core.js');

test('createState 기본값', () => {
  const s = C.createState({ bornAt: 1000 });
  assert.strictEqual(s.name, '토닥곰');
  assert.strictEqual(s.bornAt, 1000);
  assert.strictEqual(s.lastSeen, 1000);
  assert.deepStrictEqual(s.stats, { hunger: 80, fun: 80, heart: 80, energy: 80 });
  assert.strictEqual(s.flash, 0);
  assert.deepStrictEqual(s.cooldown, { feed: 0, play: 0, pat: 0, sleep: 0 });
});

test('clamp 동작', () => {
  assert.strictEqual(C.clamp(150, 0, 100), 100);
  assert.strictEqual(C.clamp(-5, 0, 100), 0);
  assert.strictEqual(C.clamp(42, 0, 100), 42);
});

test('상수 노출', () => {
  assert.strictEqual(C.WIDTH, 360);
  assert.strictEqual(C.HEIGHT, 480);
  assert.strictEqual(C.DECAY_PER_HOUR, 6);
  assert.deepStrictEqual(C.ACTIONS, { feed: 'hunger', play: 'fun', pat: 'heart', sleep: 'energy' });
});
