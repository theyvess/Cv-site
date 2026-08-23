import Phaser from 'phaser'
import './style.css'
import { BootScene } from './scenes/BootScene.ts'
import { GameScene } from './scenes/GameScene.ts'
import { MenuScene } from './scenes/MenuScene.ts'

/**
 * Fixed 720x1280 portrait stage, scaled to fit whatever screen it lands on.
 * FIT preserves the aspect ratio and letterboxes rather than distorting, so
 * every layout constant in the scenes can be written against that one size.
 */
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#f7f3ef',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  scene: [BootScene, MenuScene, GameScene],
})
