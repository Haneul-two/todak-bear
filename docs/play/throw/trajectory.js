'use strict';
// 토닥곰 던지기 — 궤적/발사 순수 수학 (Phaser 비의존, Node+브라우저 공용)

const MAX_PULL = 120;       // 최대 당김 거리(px)
const LAUNCH_SCALE = 0.32;  // 당김 px당 발사 속도 (0.22→0.32: 실드래그는 캔버스에 풀이 묶여 높은 항아리에 못 닿았음)
const LOGICAL = { W: 360, H: 640 };

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// 발사방향 벡터 = 원점 - 포인터 (새총: 뒤로 당긴 반대로 발사). 크기 MAX_PULL 클램프.
function pullVector(ox, oy, px, py) {
  let dx = ox - px, dy = oy - py;
  const d = Math.hypot(dx, dy);
  if (d > MAX_PULL && d > 0) {
    const k = MAX_PULL / d;
    dx *= k; dy *= k;
    return { dx, dy, dist: MAX_PULL };
  }
  return { dx, dy, dist: d };
}

function launchVelocity(pull) {
  return { vx: pull.dx * LAUNCH_SCALE, vy: pull.dy * LAUNCH_SCALE };
}

// 중력 적용 포물선 샘플 점들 (미리보기 점선용)
function trajectoryPoints(ox, oy, vx, vy, gravity, steps, dt) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i * dt;
    pts.push({ x: ox + vx * t, y: oy + vy * t + 0.5 * gravity * t * t });
  }
  return pts;
}

const trajectoryApi = { MAX_PULL, LAUNCH_SCALE, LOGICAL, clamp, pullVector, launchVelocity, trajectoryPoints };
if (typeof module !== 'undefined' && module.exports) module.exports = trajectoryApi;
if (typeof window !== 'undefined') window.TodakThrowTrajectory = trajectoryApi;
