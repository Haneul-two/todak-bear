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

test('care: 해당 스탯 +35, flash·쿨다운 설정', () => {
  const s = C.createState();
  s.stats.hunger = 40;
  const ok = C.care(s, 'feed');
  assert.strictEqual(ok, true);
  assert.strictEqual(s.stats.hunger, 75);
  assert.strictEqual(s.flash, C.FLASH);
  assert.strictEqual(s.cooldown.feed, C.COOLDOWN);
});

test('care: 상한 100 클램프', () => {
  const s = C.createState();
  s.stats.heart = 80;
  C.care(s, 'pat');
  assert.strictEqual(s.stats.heart, 100);
});

test('care: 쿨다운 중이면 무효(false)', () => {
  const s = C.createState();
  s.stats.fun = 10;
  C.care(s, 'play');           // 첫 회 성공 → 45
  const again = C.care(s, 'play'); // 쿨다운 중
  assert.strictEqual(again, false);
  assert.strictEqual(s.stats.fun, 45);
});

test('care: 알 수 없는 타입은 false', () => {
  const s = C.createState();
  assert.strictEqual(C.care(s, 'dance'), false);
});
