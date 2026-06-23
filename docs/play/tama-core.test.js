'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./tama-core.js');
const I = require('./tama-input.js');

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

test('tick: 1시간이면 각 스탯 -6', () => {
  const s = C.createState();           // 모두 80
  C.tick(s, 3600);                     // 1시간
  for (const k of C.STAT_KEYS) assert.ok(Math.abs(s.stats[k] - 74) < 1e-6, k);
});

test('tick: 0 하한 클램프', () => {
  const s = C.createState();
  s.stats.hunger = 2;
  C.tick(s, 3600);                     // -6 시도
  assert.strictEqual(s.stats.hunger, 0);
});

test('tick: flash·쿨다운이 dt만큼 줄어 0에서 멈춘다', () => {
  const s = C.createState();
  s.flash = 1.0; s.cooldown.feed = 1.0;
  C.tick(s, 0.4);
  assert.ok(Math.abs(s.flash - 0.6) < 1e-6);
  assert.ok(Math.abs(s.cooldown.feed - 0.6) < 1e-6);
  C.tick(s, 5);
  assert.strictEqual(s.flash, 0);
  assert.strictEqual(s.cooldown.feed, 0);
});

test('applyElapsed: 6시간이면 -36', () => {
  const s = C.createState();           // 80
  C.applyElapsed(s, 6 * 3600 * 1000);
  for (const k of C.STAT_KEYS) assert.ok(Math.abs(s.stats[k] - 44) < 1e-6, k);
});

test('applyElapsed: 아주 오래면 0 수렴, 음수 무변화', () => {
  const s = C.createState();
  C.applyElapsed(s, 1000 * 3600 * 1000); // 1000시간
  for (const k of C.STAT_KEYS) assert.strictEqual(s.stats[k], 0);
  const s2 = C.createState();
  C.applyElapsed(s2, -5);
  assert.strictEqual(s2.stats.hunger, 80);
});

test('growthStage: 경계 1·3·7일', () => {
  const born = 1000000;
  const s = C.createState({ bornAt: born });
  const at = (days) => C.growthStage(s, born + days * C.DAY_MS);
  assert.strictEqual(at(0), 'baby');
  assert.strictEqual(at(0.99), 'baby');
  assert.strictEqual(at(1), 'child');
  assert.strictEqual(at(2.9), 'child');
  assert.strictEqual(at(3), 'adult');
  assert.strictEqual(at(6.9), 'adult');
  assert.strictEqual(at(7), 'elder');
  assert.strictEqual(at(30), 'elder');
});

test('poseFor: 우선순위 happy>sleep>sad>content', () => {
  const s = C.createState();
  assert.strictEqual(C.poseFor(s), 'content');          // 80 평균
  s.stats = { hunger: 90, fun: 90, heart: 90, energy: 90 };
  assert.strictEqual(C.poseFor(s), 'happy');            // 평균>=85
  s.stats = { hunger: 20, fun: 80, heart: 80, energy: 80 };
  assert.strictEqual(C.poseFor(s), 'sad');              // 하나<30
  s.stats = { hunger: 80, fun: 80, heart: 80, energy: 10 };
  assert.strictEqual(C.poseFor(s), 'sleep');            // 기력<25
  s.flash = 1.0;
  assert.strictEqual(C.poseFor(s), 'happy');            // flash 최우선
});

test('bubbleFor: 최소 욕구 이모지 / 돌봄직후 하트 / 평온 null', () => {
  const s = C.createState();
  assert.strictEqual(C.bubbleFor(s), null);
  s.stats.hunger = 12;
  assert.strictEqual(C.bubbleFor(s), '🍯');
  s.stats.energy = 5;                                   // 더 낮음
  assert.strictEqual(C.bubbleFor(s), '😴');
  s.flash = 1.0;
  assert.strictEqual(C.bubbleFor(s), '❤️');
});

test('serialize→deserialize 라운드트립', () => {
  const s = C.createState({ name: '꿀곰', bornAt: 5000 });
  s.lastSeen = 9000; s.stats.hunger = 33; s.flash = 1.2; s.cooldown.feed = 0.5;
  const back = C.deserialize(C.serialize(s));
  assert.strictEqual(back.name, '꿀곰');
  assert.strictEqual(back.bornAt, 5000);
  assert.strictEqual(back.lastSeen, 9000);
  assert.strictEqual(back.stats.hunger, 33);
  assert.strictEqual(back.flash, 0);        // transient 초기화
  assert.strictEqual(back.cooldown.feed, 0);
});

test('deserialize: 깨진 입력은 null', () => {
  assert.strictEqual(C.deserialize('not json'), null);
  assert.strictEqual(C.deserialize('{}'), null);
  assert.strictEqual(C.deserialize(JSON.stringify({ v: 2, bornAt: 1, stats: {} })), null);
});

test('deserialize: 범위 벗어난 스탯은 80으로 보정', () => {
  const back = C.deserialize(JSON.stringify({ v: 1, name: 'x', bornAt: 0, lastSeen: 0, stats: { hunger: 999, fun: 'bad', heart: 50, energy: -3 } }));
  assert.strictEqual(back.stats.hunger, 80);
  assert.strictEqual(back.stats.fun, 80);
  assert.strictEqual(back.stats.heart, 50);
  assert.strictEqual(back.stats.energy, 80);
});

test('BUTTONS·STATS 상수 형태', () => {
  assert.strictEqual(C.BUTTONS.length, 4);
  assert.deepStrictEqual(C.BUTTONS.map(b => b.type), ['feed', 'play', 'pat', 'sleep']);
  for (const b of C.BUTTONS) {
    assert.ok(b.x >= 0 && b.x + b.w <= C.WIDTH, 'x 범위');
    assert.ok(b.y >= 0 && b.y + b.h <= C.HEIGHT, 'y 범위');
  }
  assert.deepStrictEqual(C.STATS.map(s => s.key), ['hunger', 'fun', 'heart', 'energy']);
});

test('hitTest: 버튼 안/밖', () => {
  const feed = C.BUTTONS[0];
  const cx = feed.x + feed.w / 2, cy = feed.y + feed.h / 2;
  assert.strictEqual(I.hitTest(C.BUTTONS, cx, cy), 'feed');
  assert.strictEqual(I.hitTest(C.BUTTONS, 5, 5), null); // 상단 빈 영역
});

test('createInput: push 후 read 1회 소비', () => {
  const inp = I.createInput();
  assert.strictEqual(inp.read(), null);
  inp.push('play');
  assert.strictEqual(inp.read(), 'play');
  assert.strictEqual(inp.read(), null);
});
