'use strict';
// 토닥곰 던지기 — 게임 씬: Matter 월드·새총·발사·판정
const OBSTACLE_STYLE = {
  log:  { color: 0xb07a3c, isStatic: false },
  box:  { color: 0xd9a45b, isStatic: false },
  rock: { color: 0x9a8e80, isStatic: true },
};

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create(data) {
    const Levels = window.TodakThrowLevels;
    this.level = Levels.getLevel((data && data.levelId) || 1) || Levels.getLevel(1);
    this.jarsLeft = this.level.jars;
    this.bearPos = { x: this.level.bear.x, y: this.level.bear.y };

    // 경계: 바닥·좌우 벽 (정적)
    this.matter.world.setBounds(0, 0, 360, 640, 32, true, true, false, true);

    // 곰 스프라이트(물리 없음, 시각용)
    this.bearImg = this.textures.exists('bear')
      ? this.add.image(this.bearPos.x, this.bearPos.y, 'bear').setScale(0.18)
      : this.add.circle(this.bearPos.x, this.bearPos.y, 22, 0xc8a06a);

    // 항아리: 정적 센서 (충돌 X, 진입 감지만)
    const pot = this.level.pot;
    this.add.circle(pot.x, pot.y, pot.r, 0xe8a33d, 0.25); // 시각 표시
    this.add.circle(pot.x, pot.y + pot.r * 0.4, pot.r * 0.7, 0x8a5a1d, 0.0); // 입구 가이드(투명)
    this.potSensor = this.matter.add.circle(pot.x, pot.y, pot.r * 0.6,
      { isStatic: true, isSensor: true, label: 'pot' });

    // 장애물
    this.obstacles = this.level.obstacles.map((o) => this.buildObstacle(o));

    // 시작 시 UIScene 띄우고 레벨 정보 전달
    this.scene.launch('UIScene');
    this.events.emit('level-init', { level: this.level, jarsLeft: this.jarsLeft });

    this.state = 'AIMING';
    this.aimGfx = this.add.graphics();
    this.GRAV_PX = 0.5; // 궤적 미리보기용 중력 근사(시각 전용 튜닝값)
    this.spawnJar();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
  }

  spawnJar() {
    if (this.jar) this.jar.destroy();
    this.jar = this.add.circle(this.bearPos.x, this.bearPos.y, 12, 0xe8a33d);
    this.matter.add.gameObject(this.jar, { shape: 'circle', restitution: 0.4, friction: 0.5, label: 'jar' });
    this.jar.body.gameObject = this.jar;
    this.matter.body.setStatic(this.jar.body, true); // 발사 전 고정
    this.state = 'AIMING';
    this.dragging = false;
  }

  onDown(p) {
    if (this.state !== 'AIMING') return;
    const d = Phaser.Math.Distance.Between(p.x, p.y, this.bearPos.x, this.bearPos.y);
    if (d < 60) this.dragging = true;
  }

  onMove(p) {
    if (!this.dragging || this.state !== 'AIMING') return;
    const T = window.TodakThrowTrajectory;
    const pull = T.pullVector(this.bearPos.x, this.bearPos.y, p.x, p.y);
    // 장전 꿀단지를 당긴 위치로(시각), 발사 미리보기 점선
    this.matter.body.setPosition(this.jar.body, { x: this.bearPos.x - pull.dx, y: this.bearPos.y - pull.dy });
    const v = T.launchVelocity(pull);
    const pts = T.trajectoryPoints(this.bearPos.x, this.bearPos.y, v.vx * 12, v.vy * 12, this.GRAV_PX, 10, 1);
    this.aimGfx.clear().fillStyle(0x8a5a1d, 0.5);
    pts.forEach((pt) => this.aimGfx.fillCircle(pt.x, pt.y, 3));
  }

  onUp(p) {
    if (!this.dragging || this.state !== 'AIMING') return;
    this.dragging = false;
    this.aimGfx.clear();
    const T = window.TodakThrowTrajectory;
    const pull = T.pullVector(this.bearPos.x, this.bearPos.y, p.x, p.y);
    if (pull.dist < 8) { this.spawnJar(); return; } // 너무 짧으면 취소·재장전
    const v = T.launchVelocity(pull);
    this.matter.body.setPosition(this.jar.body, { x: this.bearPos.x, y: this.bearPos.y });
    this.matter.body.setStatic(this.jar.body, false);
    this.matter.body.setVelocity(this.jar.body, { x: v.vx, y: v.vy });
    this.state = 'FLYING';
  }

  buildObstacle(o) {
    const st = OBSTACLE_STYLE[o.type];
    const isStatic = o.static !== undefined ? o.static : st.isStatic;
    const rect = this.add.rectangle(o.x, o.y, o.w, o.h, st.color);
    this.matter.add.gameObject(rect, { isStatic, label: o.type, restitution: 0.2, friction: 0.6 });
    return rect;
  }
}
if (typeof window !== 'undefined') window.GameScene = GameScene;
