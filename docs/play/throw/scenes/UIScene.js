'use strict';
class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene', active: false }); }
  create() {}
}
if (typeof window !== 'undefined') window.UIScene = UIScene;
