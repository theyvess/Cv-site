import Phaser from 'phaser';

import { GAME_WIDTH, Palette, SceneKeys, TextureKeys } from '../config/GameConfig';
import { SaveManager } from '../managers/SaveManager';
import { TextButton } from '../objects/TextButton';

/** Title screen: high score, start button and the sound toggle. */
export class MenuScene extends Phaser.Scene {
  private soundButton!: TextButton;
  private isStarting = false;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.isStarting = false;
    this.input.enabled = true;
    this.cameras.main.setBackgroundColor(Palette.backgroundCss);

    this.add
      .text(GAME_WIDTH / 2, 300, 'SKY DODGE', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '96px',
        color: Palette.accent
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 384, 'tap to bounce · clear the blocks', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '30px',
        color: Palette.textMuted
      })
      .setOrigin(0.5);

    const ship = this.add.image(GAME_WIDTH / 2, 560, TextureKeys.Player).setScale(1.6);
    this.tweens.add({
      targets: ship,
      y: 590,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add
      .text(GAME_WIDTH / 2, 730, `BEST  ${SaveManager.getHighScore()}`, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '42px',
        color: Palette.text
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 782, `COINS  ${SaveManager.getCoins()}`, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '30px',
        color: Palette.coinCss
      })
      .setOrigin(0.5);

    new TextButton(this, GAME_WIDTH / 2, 920, 'PLAY', () => this.startGame(), {
      fill: 0x2a3f7a,
      fontSize: 48
    });

    this.soundButton = new TextButton(
      this,
      GAME_WIDTH / 2,
      1050,
      this.soundLabel(),
      () => this.toggleSound(),
      { width: 320, height: 88, fontSize: 32 }
    );

    // The whole screen starts the game too — fewer precise taps on small phones.
    // `on`, not `once`: a tap that lands on the sound toggle must not consume
    // the handler and leave empty space dead for the rest of the screen.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.input.hitTestPointer(pointer).length === 0) {
        this.startGame();
      }
    });
  }

  private soundLabel(): string {
    return SaveManager.isSoundEnabled() ? 'SOUND: ON' : 'SOUND: OFF';
  }

  private toggleSound(): void {
    const enabled = SaveManager.toggleSound();
    this.sound.mute = !enabled;
    this.soundButton.setLabel(this.soundLabel());
  }

  private startGame(): void {
    if (this.isStarting) {
      return;
    }
    this.isStarting = true;
    this.input.enabled = false;
    this.cameras.main.fadeOut(180, 11, 16, 38);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Game);
    });
  }
}
