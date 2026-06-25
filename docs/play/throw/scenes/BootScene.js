'use strict';
// 토닥곰 던지기 — 에셋 로드 씬. 로드 실패해도 도형 폴백으로 진행.
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  preload() {
    this.load.image('bear', 'assets/poses/baby_content.png');
    this.load.image('bear_happy', 'assets/poses/baby_happy.png');
    // 꿀단지·항아리·장애물 전용 에셋이 없으면 도형으로 그림 → 로드 실패 무시
    this.load.on('loaderror', () => { /* 폴백은 GameScene에서 도형으로 처리 */ });
  }
  create() {
    const levelId = this.registry.get('levelId') || 1;
    this.scene.start('GameScene', { levelId });
  }
}
if (typeof window !== 'undefined') window.BootScene = BootScene;
