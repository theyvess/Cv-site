import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys, TextureKeys, Tuning } from '../config/GameConfig';
import { TextButton } from '../objects/TextButton';

/** Top strip reserved for the HUD; taps there never steer the ship. */
const HUD_HEIGHT = 170;

/** Payload used both for a fresh run and for continuing after a revive. */
export interface GameSceneData {
  revived?: boolean;
  resumeScore?: number;
  resumeCoins?: number;
  resumeElapsedMs?: number;
  /** Coins from this run already credited to the wallet before a revive. */
  bankedCoins?: number;
}

/**
 * Main loop.
 *
 * Everything that recurs — obstacles, coins, hit sparks — comes out of a pool
 * created in `create()`. `update()` allocates nothing: it moves, recycles and
 * distance-tests objects that already exist.
 */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private obstacles!: Phaser.GameObjects.Group;
  private coins!: Phaser.GameObjects.Group;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;

  private score = 0;
  private coinsCollected = 0;
  private bankedCoins = 0;
  private elapsedMs = 0;
  private spawnTimerMs = 0;
  private spawnDelayMs: number = Tuning.spawnStartDelay;
  private fallSpeed: number = Tuning.obstacleStartSpeed;

  private targetX: number = GAME_WIDTH / 2;
  private invulnerableUntilMs = 0;
  private isPaused = false;
  private isGameOver = false;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: GameSceneData): void {
    // Reset every field: Phaser reuses the scene instance across restarts.
    this.score = data.resumeScore ?? 0;
    this.coinsCollected = data.resumeCoins ?? 0;
    this.bankedCoins = data.bankedCoins ?? 0;
    this.elapsedMs = data.resumeElapsedMs ?? 0;
    this.spawnTimerMs = 0;
    this.spawnDelayMs = this.spawnDelayFor(this.elapsedMs);
    this.fallSpeed = this.fallSpeedFor(this.elapsedMs);
    this.targetX = GAME_WIDTH / 2;
    this.isPaused = false;
    this.isGameOver = false;
    // Invulnerability is measured on the same clock as `elapsedMs`, which a
    // revive carries over from the previous run.
    this.invulnerableUntilMs =
      data.revived === true ? this.elapsedMs + Tuning.reviveInvulnerabilityMs : 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.backgroundCss);
    this.cameras.main.fadeIn(180, 11, 16, 38);

    this.createStarfield();

    this.player = this.add
      .image(GAME_WIDTH / 2, Tuning.playerY, TextureKeys.Player)
      .setDepth(10);

    this.obstacles = this.add.group({
      classType: Phaser.GameObjects.Image,
      maxSize: Tuning.poolSize.obstacles
    });
    this.coins = this.add.group({
      classType: Phaser.GameObjects.Image,
      maxSize: Tuning.poolSize.coins
    });

    this.sparks = this.add.particles(0, 0, TextureKeys.Spark, {
      speed: { min: 90, max: 260 },
      lifespan: 420,
      scale: { start: 0.9, end: 0 },
      quantity: 0,
      emitting: false
    });
    this.sparks.setDepth(20);

    this.createHud();
    this.createPauseOverlay();
    this.bindInput();

    if (this.invulnerableUntilMs > this.elapsedMs) {
      this.flashPlayer();
    }
  }

  override update(_time: number, delta: number): void {
    if (this.isPaused || this.isGameOver) {
      return;
    }

    // A backgrounded WebView can hand back a huge delta on resume; clamping
    // stops objects from teleporting through the player.
    const dtMs = Math.min(delta, 50);
    const dt = dtMs / 1000;

    this.elapsedMs += dtMs;
    this.updatePlayer(dtMs);
    this.updateDifficulty();
    this.updateSpawns(dtMs);
    this.updateObstacles(dt);
    this.updateCoins(dt);
    this.updateScore();
  }

  // --- update steps -------------------------------------------------------

  private updatePlayer(dtMs: number): void {
    // Frame-rate independent lerp toward the last pointer x.
    const t = 1 - Math.pow(1 - Tuning.playerFollowLerp, dtMs / (1000 / 60));
    const nextX = Phaser.Math.Linear(this.player.x, this.targetX, t);
    this.player.x = Phaser.Math.Clamp(
      nextX,
      Tuning.playerEdgePadding,
      GAME_WIDTH - Tuning.playerEdgePadding
    );
    // Bank into the movement for a bit of feel.
    this.player.setRotation(Phaser.Math.Clamp((this.targetX - this.player.x) / 900, -0.35, 0.35));
  }

  private updateDifficulty(): void {
    this.fallSpeed = this.fallSpeedFor(this.elapsedMs);
    this.spawnDelayMs = this.spawnDelayFor(this.elapsedMs);
  }

  private updateSpawns(dtMs: number): void {
    this.spawnTimerMs += dtMs;
    if (this.spawnTimerMs < this.spawnDelayMs) {
      return;
    }
    this.spawnTimerMs = 0;
    this.spawnObstacle();
    if (Math.random() < Tuning.coinSpawnChance) {
      this.spawnCoin();
    }
  }

  private updateObstacles(dt: number): void {
    const children = this.obstacles.getChildren();
    const hitRadius = Tuning.playerRadius * 0.72 + Tuning.obstacleRadius * 0.82;

    for (let i = 0; i < children.length; i += 1) {
      const obstacle = children[i] as Phaser.GameObjects.Image;
      if (!obstacle.active) {
        continue;
      }

      obstacle.y += this.fallSpeed * dt;
      obstacle.rotation += dt;

      if (obstacle.y - Tuning.obstacleRadius > GAME_HEIGHT) {
        this.recycle(this.obstacles, obstacle);
        continue;
      }

      if (this.elapsedMs < this.invulnerableUntilMs) {
        continue;
      }

      if (this.isOverlapping(obstacle, hitRadius)) {
        this.handleCrash(obstacle);
        return;
      }
    }
  }

  private updateCoins(dt: number): void {
    const children = this.coins.getChildren();
    const pickupRadius = Tuning.playerRadius + Tuning.coinRadius;

    for (let i = 0; i < children.length; i += 1) {
      const coin = children[i] as Phaser.GameObjects.Image;
      if (!coin.active) {
        continue;
      }

      coin.y += this.fallSpeed * 0.85 * dt;

      if (coin.y - Tuning.coinRadius > GAME_HEIGHT) {
        this.recycle(this.coins, coin);
        continue;
      }

      if (this.isOverlapping(coin, pickupRadius)) {
        this.collectCoin(coin);
      }
    }
  }

  private updateScore(): void {
    const survival = Math.floor((this.elapsedMs / 1000) * Tuning.survivalScorePerSecond);
    const next = survival + this.coinsCollected * Tuning.coinScore;
    if (next !== this.score) {
      this.score = next;
      this.scoreText.setText(String(this.score));
    }
  }

  // --- pooling ------------------------------------------------------------

  private spawnObstacle(): void {
    const x = Phaser.Math.Between(
      Tuning.obstacleRadius + 20,
      GAME_WIDTH - Tuning.obstacleRadius - 20
    );
    const obstacle = this.obstacles.get(x, -Tuning.obstacleRadius, TextureKeys.Obstacle) as
      | Phaser.GameObjects.Image
      | null;
    if (!obstacle) {
      // Pool exhausted — skipping a spawn is better than growing it mid-run.
      return;
    }
    obstacle.setTexture(TextureKeys.Obstacle);
    obstacle.setPosition(x, -Tuning.obstacleRadius);
    obstacle.setActive(true).setVisible(true).setRotation(0).setScale(1).setAlpha(1);
  }

  private spawnCoin(): void {
    const x = Phaser.Math.Between(Tuning.coinRadius + 20, GAME_WIDTH - Tuning.coinRadius - 20);
    const coin = this.coins.get(x, -Tuning.coinRadius, TextureKeys.Coin) as
      | Phaser.GameObjects.Image
      | null;
    if (!coin) {
      return;
    }
    coin.setTexture(TextureKeys.Coin);
    coin.setPosition(x, -Tuning.coinRadius);
    coin.setActive(true).setVisible(true).setScale(1).setAlpha(1);
  }

  private recycle(group: Phaser.GameObjects.Group, child: Phaser.GameObjects.Image): void {
    child.setActive(false).setVisible(false);
    // Park it off-screen so a stale position cannot register a hit next spawn.
    child.setPosition(-200, -200);
    group.killAndHide(child);
  }

  // --- interactions -------------------------------------------------------

  /** Circle test against the player; no vectors allocated. */
  private isOverlapping(target: Phaser.GameObjects.Image, radius: number): boolean {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  private collectCoin(coin: Phaser.GameObjects.Image): void {
    this.coinsCollected += 1;
    this.coinText.setText(String(this.coinsCollected));
    this.sparks.setParticleTint(Palette.coin);
    this.sparks.explode(8, coin.x, coin.y);
    this.recycle(this.coins, coin);
  }

  private handleCrash(obstacle: Phaser.GameObjects.Image): void {
    this.isGameOver = true;
    this.sparks.setParticleTint(Palette.obstacle);
    this.sparks.explode(24, this.player.x, this.player.y);
    this.recycle(this.obstacles, obstacle);

    this.player.setVisible(false);
    this.cameras.main.shake(220, 0.012);

    this.time.delayedCall(520, () => {
      this.scene.start(SceneKeys.GameOver, {
        score: this.score,
        coins: this.coinsCollected,
        bankedCoins: this.bankedCoins,
        elapsedMs: this.elapsedMs
      });
    });
  }

  // --- setup helpers ------------------------------------------------------

  private spawnDelayFor(elapsedMs: number): number {
    const seconds = elapsedMs / 1000;
    return Math.max(Tuning.spawnMinDelay, Tuning.spawnStartDelay - seconds * Tuning.spawnDelayRamp);
  }

  private fallSpeedFor(elapsedMs: number): number {
    const seconds = elapsedMs / 1000;
    return Math.min(
      Tuning.obstacleMaxSpeed,
      Tuning.obstacleStartSpeed + seconds * Tuning.obstacleSpeedRamp
    );
  }

  /** Static backdrop drawn once into a single Graphics object. */
  private createStarfield(): void {
    const graphics = this.add.graphics().setDepth(-10);
    graphics.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 60; i += 1) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      graphics.fillCircle(x, y, Phaser.Math.Between(1, 3));
    }
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(40, 60, String(this.score), {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '64px',
        color: Palette.text
      })
      .setDepth(30);

    this.coinText = this.add
      .text(GAME_WIDTH - 40, 74, String(this.coinsCollected), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '40px',
        color: Palette.coinCss
      })
      .setOrigin(1, 0)
      .setDepth(30);

    this.add
      .image(GAME_WIDTH - 132, 92, TextureKeys.Coin)
      .setScale(0.8)
      .setDepth(30);

    new TextButton(this, GAME_WIDTH / 2, 80, 'II', () => this.setPaused(true), {
      width: 96,
      height: 88,
      fontSize: 34
    }).setDepth(30);
  }

  private createPauseOverlay(): void {
    const shade = this.add.graphics();
    shade.fillStyle(0x0b1026, 0.86);
    shade.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);

    const title = this.add
      .text(0, -180, 'PAUSED', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '72px',
        color: Palette.text
      })
      .setOrigin(0.5);

    this.pauseOverlay = this.add
      .container(GAME_WIDTH / 2, GAME_HEIGHT / 2, [shade, title])
      .setDepth(40)
      .setVisible(false);

    // Buttons add themselves to the scene, so re-parent them into the overlay.
    const resume = new TextButton(this, 0, 0, 'RESUME', () => this.setPaused(false), {
      fill: 0x2a3f7a
    });
    const quit = new TextButton(this, 0, 150, 'QUIT', () => this.scene.start(SceneKeys.Menu));
    this.pauseOverlay.add([resume, quit]);
  }

  private bindInput(): void {
    // Pointer only: drag or tap anywhere to steer. No keyboard bindings, which
    // would not exist on a phone anyway.
    const steer = (pointer: Phaser.Input.Pointer): void => {
      // Ignore the HUD strip so pressing pause does not also yank the ship.
      if (this.isPaused || pointer.worldY < HUD_HEIGHT) {
        return;
      }
      this.targetX = pointer.worldX;
    };

    this.input.on(Phaser.Input.Events.POINTER_DOWN, steer);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        steer(pointer);
      }
    });

    // Pause when the app is backgrounded so a phone call is not a death.
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.input.removeAllListeners();
    });
  }

  private onBlur(): void {
    if (!this.isGameOver) {
      this.setPaused(true);
    }
  }

  private setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.pauseOverlay.setVisible(paused);
  }

  private flashPlayer(): void {
    this.tweens.add({
      targets: this.player,
      alpha: 0.25,
      duration: 180,
      yoyo: true,
      repeat: Math.floor(Tuning.reviveInvulnerabilityMs / 360),
      onComplete: () => this.player.setAlpha(1)
    });
  }
}
