'use strict';
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create(data) {
    this.add.text(180, 320, '게임 로딩됨 (lv ' + (data && data.levelId) + ')',
      { color: '#5a4a36', fontSize: '16px' }).setOrigin(0.5);
  }
}
if (typeof window !== 'undefined') window.GameScene = GameScene;
