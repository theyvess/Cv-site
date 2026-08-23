import * as Phaser from 'phaser'
import { GameScene } from './scenes/GameScene.ts'
import { colors, GAME_HEIGHT, GAME_WIDTH } from './theme.ts'

/**
 * Fixed portrait stage at 720×1280, letterboxed to fit whatever screen it
 * lands on. Every coordinate in the game is written against that stage, so
 * layout never has to react to the real viewport size.
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: colors.paperCss,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    autoRound: true,
  },
  render: {
    antialias: true,
  },
  scene: [GameScene],
}
