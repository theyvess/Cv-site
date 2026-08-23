import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys, TextureKeys, Tuning } from '../config/GameConfig';
import { SaveManager } from '../managers/SaveManager';
import { AdService } from '../services/AdService';
import { IAPService } from '../services/IAPService';

/** Source size of the stretchable block texture. */
const BLOCK_TEXTURE_SIZE = 16;

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
    this.makeBlockTexture();
    this.makeGroundTexture();
    this.makeCircleTexture(TextureKeys.Coin, Tuning.coinRadius, Palette.coin, 0xfff3b0);
    this.makeCircleTexture(TextureKeys.Spark, 8, 0xffffff);
  }

  /** The player: a rounded square with a face-like highlight. */
  private makePlayerTexture(): void {
    const size = Tuning.playerSize;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(Palette.player, 1);
    graphics.fillRoundedRect(0, 0, size, size, 18);

    graphics.fillStyle(Palette.playerAccent, 0.92);
    graphics.fillCircle(size * 0.34, size * 0.38, size * 0.09);
    graphics.fillCircle(size * 0.66, size * 0.38, size * 0.09);

    graphics.generateTexture(TextureKeys.Player, size, size);
    graphics.destroy();
  }

  /**
   * A plain white block. Obstacles vary in size, so this is stretched with
   * `setDisplaySize` and tinted per spawn rather than being redrawn — one
   * texture keeps the whole pool in a single draw batch.
   */
  private makeBlockTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE);
    graphics.generateTexture(TextureKeys.Obstacle, BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE);
    graphics.destroy();
  }

  /**
   * One tile of the floor. It is tiled across a TileSprite whose
   * `tilePositionX` is scrolled, so the ground moves without any per-frame
   * object churn.
   */
  private makeGroundTexture(): void {
    const size = 64;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x121a3a, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.fillStyle(0x1f2a54, 1);
    graphics.fillRect(0, 0, 10, size);
    graphics.generateTexture(TextureKeys.Ground, size, size);
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
