import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys, TextureKeys, Tuning } from '../config/GameConfig';
import { TextButton } from '../objects/TextButton';

/** Top strip reserved for the HUD; taps there never bounce the player. */
const HUD_HEIGHT = 170;

/**
 * Pooled obstacle. `cleared` marks the ones already scored so a single block
 * cannot award its bonus twice while it finishes scrolling off-screen.
 */
type PooledObstacle = Phaser.GameObjects.Image & { cleared?: boolean };

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
 * Main loop: a tap-to-bounce square over a scrolling floor of obstacles.
 *
 * The player holds a fixed x while the world moves past it. Everything that
 * recurs — obstacles, coins, sparks — comes out of a pool built in `create()`,
 * and `update()` allocates nothing: it integrates, recycles and box-tests
 * objects that already exist.
 */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private ground!: Phaser.GameObjects.TileSprite;
  private obstacles!: Phaser.GameObjects.Group;
  private coins!: Phaser.GameObjects.Group;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;

  private score = 0;
  private clearedBonus = 0;
  private coinsCollected = 0;
  private bankedCoins = 0;
  private elapsedMs = 0;
  private spawnTimerMs = 0;
  private spawnDelayMs: number = Tuning.spawnStartDelay;
  private scrollSpeed: number = Tuning.scrollStartSpeed;

  /** Vertical state of the player square; x never changes. */
  private velocityY = 0;
  private playerY: number = Tuning.groundY - Tuning.playerSize / 2;

  private invulnerableUntilMs = 0;
  private isPaused = false;
  private isGameOver = false;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: GameSceneData): void {
    // Reset every field: Phaser reuses the scene instance across restarts.
    this.score = data.resumeScore ?? 0;
    this.clearedBonus = 0;
    this.coinsCollected = data.resumeCoins ?? 0;
    this.bankedCoins = data.bankedCoins ?? 0;
    this.elapsedMs = data.resumeElapsedMs ?? 0;
    this.spawnTimerMs = 0;
    this.spawnDelayMs = this.spawnDelayFor(this.elapsedMs);
    this.scrollSpeed = this.scrollSpeedFor(this.elapsedMs);

    this.velocityY = 0;
    this.playerY = Tuning.groundY - Tuning.playerSize / 2;
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
    this.createGround();

    this.player = this.add
      .image(Tuning.playerX, this.playerY, TextureKeys.Player)
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
    // stops the square from tunnelling through the floor or an obstacle.
    const dtMs = Math.min(delta, 50);
    const dt = dtMs / 1000;

    this.elapsedMs += dtMs;
    this.updatePlayer(dt);
    this.updateDifficulty();
    this.updateGround(dt);
    this.updateSpawns(dtMs);
    this.updateObstacles(dt);
    this.updateCoins(dt);
    this.updateScore();
  }

  // --- update steps -------------------------------------------------------

  /** Semi-implicit Euler integration plus ground/ceiling response. */
  private updatePlayer(dt: number): void {
    this.velocityY = Math.min(this.velocityY + Tuning.gravity * dt, Tuning.maxFallSpeed);
    this.playerY += this.velocityY * dt;

    const half = Tuning.playerSize / 2;
    const floor = Tuning.groundY - half;
    const ceiling = Tuning.ceilingY + half;

    if (this.playerY >= floor) {
      this.playerY = floor;
      if (this.velocityY > Tuning.restingSpeedThreshold) {
        // Bounce, keeping a fraction of the impact speed.
        this.velocityY = -this.velocityY * Tuning.groundRestitution;
        this.squash();
      } else {
        this.velocityY = 0;
      }
    } else if (this.playerY <= ceiling) {
      this.playerY = ceiling;
      this.velocityY = 0;
    }

    this.player.y = this.playerY;
    // Tilt with vertical speed, and ease the landing squash back out. Both are
    // direct property writes — a tween per landing would allocate every bounce.
    this.player.setRotation(Phaser.Math.Clamp(this.velocityY / 4200, -0.3, 0.3));
    this.player.scaleX = Phaser.Math.Linear(this.player.scaleX, 1, 0.2);
    this.player.scaleY = Phaser.Math.Linear(this.player.scaleY, 1, 0.2);
  }

  private updateDifficulty(): void {
    this.scrollSpeed = this.scrollSpeedFor(this.elapsedMs);
    this.spawnDelayMs = this.spawnDelayFor(this.elapsedMs);
  }

  /** The floor is one TileSprite; scrolling it is a texture offset, not motion. */
  private updateGround(dt: number): void {
    this.ground.tilePositionX += this.scrollSpeed * dt;
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
    const playerHalf = (Tuning.playerSize * Tuning.playerHitboxScale) / 2;
    const invulnerable = this.elapsedMs < this.invulnerableUntilMs;

    for (let i = 0; i < children.length; i += 1) {
      const obstacle = children[i] as PooledObstacle;
      if (!obstacle.active) {
        continue;
      }

      obstacle.x -= this.scrollSpeed * dt;
      const halfWidth = obstacle.displayWidth / 2;

      if (obstacle.x + halfWidth < -20) {
        this.recycle(this.obstacles, obstacle);
        continue;
      }

      // Cleared once its trailing edge is behind the player's leading edge.
      if (!obstacle.cleared && obstacle.x + halfWidth < Tuning.playerX - playerHalf) {
        obstacle.cleared = true;
        this.clearedBonus += Tuning.obstacleClearedScore;
      }

      if (invulnerable) {
        continue;
      }

      if (this.overlapsPlayer(obstacle, playerHalf)) {
        this.handleCrash(obstacle);
        return;
      }
    }
  }

  private updateCoins(dt: number): void {
    const children = this.coins.getChildren();
    const playerHalf = (Tuning.playerSize * Tuning.playerHitboxScale) / 2;

    for (let i = 0; i < children.length; i += 1) {
      const coin = children[i] as Phaser.GameObjects.Image;
      if (!coin.active) {
        continue;
      }

      coin.x -= this.scrollSpeed * dt;

      if (coin.x + Tuning.coinRadius < -20) {
        this.recycle(this.coins, coin);
        continue;
      }

      if (this.circleHitsPlayer(coin.x, coin.y, Tuning.coinRadius, playerHalf)) {
        this.collectCoin(coin);
      }
    }
  }

  private updateScore(): void {
    const survival = Math.floor((this.elapsedMs / 1000) * Tuning.survivalScorePerSecond);
    const next = survival + this.clearedBonus + this.coinsCollected * Tuning.coinScore;
    if (next !== this.score) {
      this.score = next;
      this.scoreText.setText(String(this.score));
    }
  }

  // --- pooling ------------------------------------------------------------

  private spawnObstacle(): void {
    const width = Phaser.Math.Between(Tuning.obstacleMinWidth, Tuning.obstacleMaxWidth);
    const height = Phaser.Math.Between(Tuning.obstacleMinHeight, Tuning.obstacleMaxHeight);
    const x = GAME_WIDTH + width;
    const y = Tuning.groundY - height / 2;

    const obstacle = this.obstacles.get(x, y, TextureKeys.Obstacle) as PooledObstacle | null;
    if (!obstacle) {
      // Pool exhausted — skipping a spawn beats growing it mid-run.
      return;
    }

    obstacle.setTexture(TextureKeys.Obstacle);
    obstacle.setPosition(x, y);
    obstacle.setDisplaySize(width, height);
    obstacle.setTint(Palette.obstacle);
    obstacle.setActive(true).setVisible(true).setAlpha(1);
    obstacle.cleared = false;
  }

  private spawnCoin(): void {
    const x = GAME_WIDTH + Tuning.coinRadius;
    const y = Tuning.groundY - Phaser.Math.Between(Tuning.coinMinHeight, Tuning.coinMaxHeight);

    const coin = this.coins.get(x, y, TextureKeys.Coin) as Phaser.GameObjects.Image | null;
    if (!coin) {
      return;
    }
    coin.setTexture(TextureKeys.Coin);
    coin.setPosition(x, y);
    coin.setActive(true).setVisible(true).setScale(1).setAlpha(1);
  }

  private recycle(group: Phaser.GameObjects.Group, child: Phaser.GameObjects.Image): void {
    child.setActive(false).setVisible(false);
    // Park it off-screen so a stale position cannot register a hit next spawn.
    child.setPosition(-500, -500);
    group.killAndHide(child);
  }

  // --- collision ----------------------------------------------------------

  /** Axis-aligned box test between the player square and a block. */
  private overlapsPlayer(obstacle: Phaser.GameObjects.Image, playerHalf: number): boolean {
    const dx = Math.abs(obstacle.x - Tuning.playerX);
    const dy = Math.abs(obstacle.y - this.playerY);
    return (
      dx < obstacle.displayWidth / 2 + playerHalf && dy < obstacle.displayHeight / 2 + playerHalf
    );
  }

  /** Circle vs. the player square, via the closest point on the box. */
  private circleHitsPlayer(cx: number, cy: number, radius: number, playerHalf: number): boolean {
    const nearestX = Phaser.Math.Clamp(cx, Tuning.playerX - playerHalf, Tuning.playerX + playerHalf);
    const nearestY = Phaser.Math.Clamp(cy, this.playerY - playerHalf, this.playerY + playerHalf);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  // --- interactions -------------------------------------------------------

  /** Tap handler: an upward impulse, allowed mid-air so the game stays kind. */
  private bounce(): void {
    this.velocityY = Tuning.jumpVelocity;
    this.player.scaleX = 0.86;
    this.player.scaleY = 1.16;
  }

  private squash(): void {
    this.player.scaleX = 1.18;
    this.player.scaleY = 0.82;
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

  private scrollSpeedFor(elapsedMs: number): number {
    const seconds = elapsedMs / 1000;
    return Math.min(
      Tuning.scrollMaxSpeed,
      Tuning.scrollStartSpeed + seconds * Tuning.scrollSpeedRamp
    );
  }

  /** Static backdrop drawn once into a single Graphics object. */
  private createStarfield(): void {
    const graphics = this.add.graphics().setDepth(-10);
    graphics.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 60; i += 1) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, Tuning.groundY);
      graphics.fillCircle(x, y, Phaser.Math.Between(1, 3));
    }
  }

  private createGround(): void {
    const bandHeight = GAME_HEIGHT - Tuning.groundY;
    this.ground = this.add
      .tileSprite(0, Tuning.groundY, GAME_WIDTH, bandHeight, TextureKeys.Ground)
      .setOrigin(0, 0)
      .setDepth(-5);

    const surface = this.add.graphics().setDepth(-4);
    surface.fillStyle(Palette.player, 0.85);
    surface.fillRect(0, Tuning.groundY - Tuning.groundThickness, GAME_WIDTH, Tuning.groundThickness);
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
    // Pointer only: tap anywhere in the play field to bounce. No keyboard
    // bindings, which would not exist on a phone anyway.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // Ignore the HUD strip so pressing pause does not also launch the player.
      if (this.isPaused || this.isGameOver || pointer.worldY < HUD_HEIGHT) {
        return;
      }
      this.bounce();
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
