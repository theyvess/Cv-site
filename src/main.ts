import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, Palette } from './config/GameConfig';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

/**
 * Portrait 720x1280 virtual canvas, letterboxed onto whatever the device
 * actually has. Every scene lays out against those numbers, never against
 * `window.innerWidth`.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: Palette.backgroundCss,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  input: {
    activePointers: 2,
    touch: { capture: true }
  },
  render: {
    // Crisp vector art without the cost of full antialiasing on low-end GPUs.
    antialias: true,
    roundPixels: true,
    powerPreference: 'high-performance'
  },
  // No physics engine: obstacles are pooled sprites moved by hand and tested
  // with circle overlaps, which is cheaper and fully deterministic.
  scene: [BootScene, MenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);

// Dev-only debug handle for the console and for automated smoke tests.
// Stripped from production builds by Vite's `import.meta.env.DEV` constant.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
