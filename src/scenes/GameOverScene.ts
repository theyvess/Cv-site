import Phaser from 'phaser';

import { GAME_WIDTH, Palette, SceneKeys } from '../config/GameConfig';
import { SaveManager } from '../managers/SaveManager';
import { TextButton } from '../objects/TextButton';
import { AdService } from '../services/AdService';
import type { GameSceneData } from './GameScene';

export interface GameOverSceneData {
  score: number;
  /** Total coins collected across the whole run, revives included. */
  coins: number;
  /** How many of those were already credited before an earlier revive. */
  bankedCoins: number;
  elapsedMs: number;
}

/** Results screen: banks the score and coins, then offers retry / revive. */
export class GameOverScene extends Phaser.Scene {
  private result: GameOverSceneData = { score: 0, coins: 0, bankedCoins: 0, elapsedMs: 0 };
  private isNewBest = false;
  /** One revive per run — the offer is not repeated after it is used. */
  private reviveUsed = false;

  constructor() {
    super(SceneKeys.GameOver);
  }

  init(data: Partial<GameOverSceneData>): void {
    this.result = {
      score: data.score ?? 0,
      coins: data.coins ?? 0,
      bankedCoins: data.bankedCoins ?? 0,
      elapsedMs: data.elapsedMs ?? 0
    };
    this.reviveUsed = false;
    this.isNewBest = SaveManager.submitScore(this.result.score);

    // Credit only what has not been credited yet: a revived run passes back
    // through this scene, and coins must not be banked twice.
    const unbanked = this.result.coins - this.result.bankedCoins;
    if (unbanked > 0) {
      SaveManager.addCoins(unbanked);
      this.result.bankedCoins = this.result.coins;
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.backgroundCss);

    this.add
      .text(GAME_WIDTH / 2, 300, this.isNewBest ? 'NEW BEST!' : 'GAME OVER', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '78px',
        color: this.isNewBest ? Palette.coinCss : Palette.danger
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 440, String(this.result.score), {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '120px',
        color: Palette.text
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 540, `BEST  ${SaveManager.getHighScore()}`, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '36px',
        color: Palette.textMuted
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 600, `+${this.result.coins} coins  ·  ${SaveManager.getCoins()} total`, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '32px',
        color: Palette.coinCss
      })
      .setOrigin(0.5);

    let y = 760;

    // Rewarded revive is strictly opt-in: a button the player chooses to press,
    // never an ad that interrupts the run.
    if (AdService.canOffer('revive')) {
      const reviveButton = new TextButton(
        this,
        GAME_WIDTH / 2,
        y,
        'WATCH AD TO REVIVE',
        () => void this.revive(reviveButton),
        { fill: 0x2c6e49, fontSize: 34 }
      );
      y += 140;
    }

    new TextButton(this, GAME_WIDTH / 2, y, 'RETRY', () => this.scene.start(SceneKeys.Game), {
      fill: 0x2a3f7a,
      fontSize: 44
    });

    new TextButton(this, GAME_WIDTH / 2, y + 140, 'MENU', () => this.scene.start(SceneKeys.Menu));
  }

  private async revive(button: TextButton): Promise<void> {
    if (this.reviveUsed) {
      return;
    }
    this.reviveUsed = true;
    button.setEnabled(false).setLabel('LOADING AD...');

    const result = await AdService.showRewarded('revive');
    if (!this.scene.isActive()) {
      return;
    }

    if (!result.completed) {
      // No reward without a completed view; let the player try once more.
      this.reviveUsed = false;
      button.setEnabled(true).setLabel('WATCH AD TO REVIVE');
      return;
    }

    const resumeData: GameSceneData = {
      revived: true,
      resumeScore: this.result.score,
      resumeCoins: this.result.coins,
      resumeElapsedMs: this.result.elapsedMs,
      bankedCoins: this.result.bankedCoins
    };
    this.scene.start(SceneKeys.Game, resumeData);
  }
}
