import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys, TextureKeys, Tuning } from '../config/GameConfig';
import { SaveManager } from '../managers/SaveManager';
import { AdService } from '../services/AdService';
import { IAPService } from '../services/IAPService';

/**
 * Boots the game: draws a loading bar, generates the placeholder art as
 * canvas textures (no binary assets yet, per the prototype guidelines) and
 * initialises the monetization services before handing off to the menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    this.createLoadingBar();
    // Real assets go here later:
    // this.load.atlas(...); this.load.audio(...);
  }

  create(): void {
    this.generateTextures();

    // Sound preference is owned by SaveManager; apply it before any scene plays audio.
    this.sound.mute = !SaveManager.isSoundEnabled();

    // Fire and forget: neither service may block the first playable frame.
    void AdService.initialize();
    void IAPService.initialize();

    this.scene.start(SceneKeys.Menu);
  }

  private createLoadingBar(): void {
    const barWidth = GAME_WIDTH * 0.6;
    const barHeight = 14;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2;

    this.cameras.main.setBackgroundColor(Palette.backgroundCss);

    const frame = this.add.graphics();
    frame.lineStyle(2, 0xffffff, 0.25);
    frame.strokeRoundedRect(x - 2, y - 2, barWidth + 4, barHeight + 4, 8);

    const fill = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      fill.clear();
      fill.fillStyle(Palette.player, 1);
      fill.fillRoundedRect(x, y, Math.max(barWidth * progress, 1), barHeight, 6);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      fill.destroy();
      frame.destroy();
    });
  }

  /**
   * Vector placeholder art baked into textures once at boot. Baking beats
   * drawing Graphics per object: pooled sprites can then share one texture and
   * the renderer batches them.
   */
  private generateTextures(): void {
    this.makePlayerTexture();
    this.makeCircleTexture(TextureKeys.Obstacle, Tuning.obstacleRadius, Palette.obstacle, 0xffffff);
    this.makeCircleTexture(TextureKeys.Coin, Tuning.coinRadius, Palette.coin, 0xfff3b0);
    this.makeCircleTexture(TextureKeys.Spark, 8, 0xffffff);
  }

  /** A rounded triangle ship pointing up. */
  private makePlayerTexture(): void {
    const r = Tuning.playerRadius;
    const size = r * 2;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(Palette.player, 1);
    graphics.beginPath();
    graphics.moveTo(r, 0);
    graphics.lineTo(size, size);
    graphics.lineTo(r, size * 0.76);
    graphics.lineTo(0, size);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(Palette.playerAccent, 0.9);
    graphics.fillCircle(r, size * 0.55, r * 0.22);

    graphics.generateTexture(TextureKeys.Player, size, size);
    graphics.destroy();
  }

  private makeCircleTexture(key: string, radius: number, color: number, highlight?: number): void {
    const size = radius * 2;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);

    if (highlight !== undefined) {
      graphics.fillStyle(highlight, 0.55);
      graphics.fillCircle(radius * 0.68, radius * 0.62, radius * 0.28);
    }

    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
