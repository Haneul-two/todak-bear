'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('./trajectory.js');

test('trajectory: 상수 노출', () => {
  assert.strictEqual(T.MAX_PULL, 120);
  assert.strictEqual(T.LAUNCH_SCALE, 0.32);
  assert.deepStrictEqual(T.LOGICAL, { W: 360, H: 640 });
});

test('trajectory: clamp', () => {
  assert.strictEqual(T.clamp(150, 0, 100), 100);
  assert.strictEqual(T.clamp(-5, 0, 100), 0);
  assert.strictEqual(T.clamp(42, 0, 100), 42);
});

test('pullVector: 발사방향 = 원점-포인터, 짧으면 그대로', () => {
  // 원점(70,560), 포인터를 아래-왼쪽(40,620)으로 당김 → 발사는 위-오른쪽
  const p = T.pullVector(70, 560, 40, 620);
  assert.strictEqual(p.dx, 30);   // 70-40
  assert.strictEqual(p.dy, -60);  // 560-620
  assert.ok(Math.abs(p.dist - Math.hypot(30, 60)) < 1e-9);
});

test('pullVector: 최대 당김 거리로 클램프', () => {
  // 원점(0,0)에서 포인터(-300,0) → 거리 300 > 120 → dx=120, dy=0
  const p = T.pullVector(0, 0, -300, 0);
  assert.ok(Math.abs(p.dist - 120) < 1e-9);
  assert.ok(Math.abs(p.dx - 120) < 1e-9);
  assert.ok(Math.abs(p.dy - 0) < 1e-9);
});

test('launchVelocity: 당김 * 배율', () => {
  const v = T.launchVelocity({ dx: 100, dy: -50, dist: 111.8 });
  assert.ok(Math.abs(v.vx - 32) < 1e-9);   // 100*0.32
  assert.ok(Math.abs(v.vy - -16) < 1e-9);  // -50*0.32
});

test('trajectoryPoints: 포물선 샘플 개수·첫 점', () => {
  const pts = T.trajectoryPoints(0, 0, 10, -10, 1, 5, 1);
  assert.strictEqual(pts.length, 5);
  // t=1: x=10, y=-10 + 0.5*1*1 = -9.5
  assert.ok(Math.abs(pts[0].x - 10) < 1e-9);
  assert.ok(Math.abs(pts[0].y - -9.5) < 1e-9);
});

const S = require('./scoring.js');

test('scoring: 시도수→별점 (1발=3, 2발=2, 3발=1, 그 이상=1)', () => {
  assert.strictEqual(S.starsForAttempt(1), 3);
  assert.strictEqual(S.starsForAttempt(2), 2);
  assert.strictEqual(S.starsForAttempt(3), 1);
  assert.strictEqual(S.starsForAttempt(4), 1);
});

test('scoring: createProgress 기본값', () => {
  const p = S.createProgress();
  assert.strictEqual(p.v, 1);
  assert.strictEqual(p.maxLevel, 1);
  assert.deepStrictEqual(p.stars, {});
});

test('scoring: recordClear 별점 갱신·해금', () => {
  const p = S.createProgress();
  S.recordClear(p, 1, 2);          // 레벨1, 2발 → ⭐⭐
  assert.strictEqual(p.stars[1], 2);
  assert.strictEqual(p.maxLevel, 2);
  S.recordClear(p, 1, 1);          // 레벨1 재도전 1발 → ⭐⭐⭐ (max)
  assert.strictEqual(p.stars[1], 3);
  S.recordClear(p, 1, 3);          // 더 나쁜 점수는 무시
  assert.strictEqual(p.stars[1], 3);
});

test('scoring: maxLevel은 TOTAL_LEVELS로 클램프', () => {
  const p = S.createProgress();
  S.recordClear(p, 6, 1);
  assert.strictEqual(p.maxLevel, 6);
});

test('scoring: serialize/deserialize 라운드트립', () => {
  const p = S.createProgress();
  S.recordClear(p, 1, 1);
  const r = S.deserialize(S.serialize(p));
  assert.deepStrictEqual(r, p);
});

test('scoring: 깨진/구버전 데이터는 null', () => {
  assert.strictEqual(S.deserialize('{bad'), null);
  assert.strictEqual(S.deserialize(JSON.stringify({ v: 2 })), null);
  assert.strictEqual(S.deserialize(JSON.stringify({ v: 1 })), null); // stars 없음
});

test('scoring: 변조된 별점 값은 0~3으로 위생처리, 비정상값은 버림', () => {
  const r = S.deserialize(JSON.stringify({ v: 1, maxLevel: 2, stars: { 1: 99, 2: -5, 3: 2.4, 4: 'x', 5: NaN } }));
  assert.strictEqual(r.stars['1'], 3);   // 99 → 3
  assert.strictEqual(r.stars['2'], 0);   // -5 → 0
  assert.strictEqual(r.stars['3'], 2);   // 2.4 → 2(반올림)
  assert.strictEqual('4' in r.stars, false); // 'x' 버림
  assert.strictEqual('5' in r.stars, false); // NaN 버림
});

const L = require('./levels.js');

test('levels: 6개 고정, id 1..6 순서', () => {
  assert.strictEqual(L.LEVELS.length, 6);
  L.LEVELS.forEach((lv, i) => assert.strictEqual(lv.id, i + 1));
});

test('levels: 모든 레벨이 validateLevel 통과', () => {
  for (const lv of L.LEVELS) assert.strictEqual(L.validateLevel(lv), true, `레벨 ${lv.id} 검증 실패`);
});

test('levels: getLevel', () => {
  assert.strictEqual(L.getLevel(1).id, 1);
  assert.strictEqual(L.getLevel(99), undefined);
});

test('levels: 레벨1은 장애물 없음, 모든 jars=3', () => {
  assert.strictEqual(L.LEVELS[0].obstacles.length, 0);
  for (const lv of L.LEVELS) assert.strictEqual(lv.jars, 3);
});

test('validateLevel: 화면 밖 좌표 거부', () => {
  const bad = { id: 1, bear: { x: -5, y: 560 }, pot: { x: 250, y: 120, r: 36 }, jars: 3, obstacles: [] };
  assert.strictEqual(L.validateLevel(bad), false);
});

test('validateLevel: 곰과 항아리 겹치면 거부', () => {
  const bad = { id: 1, bear: { x: 250, y: 120 }, pot: { x: 250, y: 120, r: 36 }, jars: 3, obstacles: [] };
  assert.strictEqual(L.validateLevel(bad), false);
});

test('validateLevel: 알 수 없는 장애물 타입 거부', () => {
  const bad = { id: 1, bear: { x: 70, y: 560 }, pot: { x: 250, y: 120, r: 36 }, jars: 3,
    obstacles: [{ type: 'bomb', x: 100, y: 300, w: 40, h: 40, static: true }] };
  assert.strictEqual(L.validateLevel(bad), false);
});
