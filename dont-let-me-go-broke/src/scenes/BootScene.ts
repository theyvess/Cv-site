import Phaser from 'phaser'

/**
 * Pass-through boot step. Nothing is loaded here yet — card data is imported as
 * a module rather than fetched — but keeping the scene means future preloading
 * (fonts, audio, sprite atlases) has an obvious home that does not disturb the
 * menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    this.scene.start('MenuScene')
  }
}
