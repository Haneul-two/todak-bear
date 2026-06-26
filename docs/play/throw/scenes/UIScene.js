'use strict';
// 토닥곰 던지기 — UI 오버레이 씬
class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  create() {
    this.game.scene.keys.GameScene.events.on('level-init', this.onInit, this);
    this.game.scene.keys.GameScene.events.on('jars-changed', this.onJars, this);
    this.game.scene.keys.GameScene.events.on('cleared', this.onCleared, this);
    this.game.scene.keys.GameScene.events.on('failed', this.onFailed, this);
    this.events.once('shutdown', this.cleanup, this);
  }

  // 씬 종료 시 GameScene 이벤트 리스너 해제(레벨 전환 반복 시 누수·중복 방지)
  cleanup() {
    const gs = this.game.scene.keys.GameScene;
    if (!gs) return;
    gs.events.off('level-init', this.onInit, this);
    gs.events.off('jars-changed', this.onJars, this);
    gs.events.off('cleared', this.onCleared, this);
    gs.events.off('failed', this.onFailed, this);
  }

  onInit({ level, jarsLeft }) {
    this.level = level; this.jarsLeft = jarsLeft;
    const prog = this.registry.get('progress');
    const best = (prog.stars && prog.stars[level.id]) || 0;
    if (this.bar) this.bar.destroy();
    this.bar = this.add.container(0, 0);
    this.bar.add(this.add.text(12, 10, 'Lv ' + level.id, { color: '#5a4a36', fontSize: '18px', fontStyle: 'bold' }));
    this.bar.add(this.add.text(120, 12, '★'.repeat(best) + '☆'.repeat(3 - best), { color: '#e8a33d', fontSize: '16px' }));
    this.jarText = this.add.text(225, 12, '🍯'.repeat(jarsLeft), { fontSize: '16px' }).setOrigin(0, 0);
    this.bar.add(this.jarText);
    // 현재 레벨 재시작 버튼(별점 갱신용 재도전 — 단지 소진 없이 즉시 다시). registry.levelId=현재 레벨 유지.
    const restart = this.add.text(348, 12, '↺ 다시', { color: '#8a5a36', fontSize: '15px' }).setOrigin(1, 0).setInteractive();
    restart.on('pointerdown', () => { this.scene.stop('UIScene'); this.scene.start('BootScene'); });
    this.bar.add(restart);
    if (level.hint) {
      this.hint = this.add.text(180, 600, level.hint, { color: '#5a4a36', fontSize: '13px' }).setOrigin(0.5);
    }
  }

  onJars({ jarsLeft }) { if (this.jarText) this.jarText.setText('🍯'.repeat(Math.max(0, jarsLeft))); }

  onCleared({ levelId, jarsUsed }) {
    const Scoring = window.TodakThrowScoring;
    const prog = this.registry.get('progress');
    Scoring.recordClear(prog, levelId, jarsUsed);
    try { localStorage.setItem(this.registry.get('saveKey'), Scoring.serialize(prog)); } catch (e) {}
    const stars = Scoring.starsForAttempt(jarsUsed);
    this.showOverlay('성공! ' + '⭐'.repeat(stars), levelId < Scoring.TOTAL_LEVELS ? '다음 레벨' : '처음으로', () => {
      const next = levelId < Scoring.TOTAL_LEVELS ? levelId + 1 : 1;
      this.registry.set('levelId', next);
      this.scene.stop('UIScene');
      this.scene.start('BootScene');
    });
  }

  onFailed() {
    this.showOverlay('괜찮아, 다시 해볼까요? 🐻', '다시', () => {
      this.scene.stop('UIScene');
      this.scene.start('BootScene');
    });
  }

  showOverlay(msg, btnLabel, onBtn) {
    const g = this.add.container(0, 0);
    g.add(this.add.rectangle(180, 320, 360, 640, 0x2b2622, 0.55));
    g.add(this.add.text(180, 280, msg, { color: '#fff', fontSize: '22px', fontStyle: 'bold', padding: { top: 6, bottom: 2 } }).setOrigin(0.5));
    const btn = this.add.text(180, 360, '  ' + btnLabel + '  ', { color: '#5a4a36', backgroundColor: '#FBF3E4', fontSize: '18px', padding: { x: 14, y: 8 } }).setOrigin(0.5).setInteractive();
    btn.on('pointerdown', onBtn);
    g.add(btn);
  }
}
if (typeof window !== 'undefined') window.UIScene = UIScene;
