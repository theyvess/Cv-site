/**
 * Central tuning + layout constants.
 *
 * Everything is authored against the 720x1280 virtual resolution; Phaser's
 * FIT scale mode letterboxes that onto the real device screen, so no runtime
 * code should ever read `window.innerWidth` directly.
 */

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const SceneKeys = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  GameOver: 'GameOverScene'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/** Texture keys generated procedurally in BootScene (no image assets yet). */
export const TextureKeys = {
  Player: 'tex-player',
  Obstacle: 'tex-obstacle',
  Coin: 'tex-coin',
  Spark: 'tex-spark'
} as const;

export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const Palette = {
  background: 0x0b1026,
  backgroundCss: '#0b1026',
  player: 0x4cc9f0,
  playerAccent: 0xffffff,
  obstacle: 0xf72585,
  coin: 0xffd166,
  text: '#f8f9fa',
  textMuted: '#8d99ae',
  accent: '#4cc9f0',
  coinCss: '#ffd166',
  danger: '#f72585'
} as const;

/** Gameplay tuning. Kept in one place so balancing never means hunting scenes. */
export const Tuning = {
  /** Player is a fixed distance up from the bottom of the play field. */
  playerY: GAME_HEIGHT - 260,
  playerRadius: 34,
  /** Horizontal lerp factor per frame at 60fps; the player chases the pointer. */
  playerFollowLerp: 0.18,
  playerEdgePadding: 60,

  obstacleRadius: 40,
  obstacleStartSpeed: 380,
  obstacleMaxSpeed: 900,
  /** Extra px/s of fall speed added per second survived. */
  obstacleSpeedRamp: 9,

  spawnStartDelay: 900,
  spawnMinDelay: 320,
  /** ms shaved off the spawn interval per second survived. */
  spawnDelayRamp: 11,

  coinRadius: 22,
  coinSpawnChance: 0.35,
  coinScore: 5,

  /** Points awarded per second survived. */
  survivalScorePerSecond: 10,

  /** Grace period after a revive during which collisions are ignored. */
  reviveInvulnerabilityMs: 1800,

  poolSize: {
    obstacles: 24,
    coins: 12
  }
} as const;
