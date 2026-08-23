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
  Ground: 'tex-ground',
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
  /** Y of the ground surface; the player rests and obstacles slide on this. */
  groundY: 1010,
  groundThickness: 8,

  /** The player is a square parked at a fixed x while the world scrolls past. */
  playerX: 200,
  playerSize: 84,
  /** Collision box is shrunk slightly so near-misses read as misses. */
  playerHitboxScale: 0.86,

  /** Downward acceleration, px/s^2. */
  gravity: 3200,
  /** Upward velocity applied on tap, px/s (negative is up). */
  jumpVelocity: -1180,
  /** Terminal fall speed so a long drop stays readable. */
  maxFallSpeed: 1900,
  /** Fraction of impact speed kept when landing, giving the square its bounce. */
  groundRestitution: 0.34,
  /** Below this landing speed the square settles instead of micro-bouncing. */
  restingSpeedThreshold: 220,
  /** Ceiling: the square cannot be tapped above this line. */
  ceilingY: 200,

  /** Obstacles scroll right-to-left; this is the world speed. */
  scrollStartSpeed: 430,
  scrollMaxSpeed: 1020,
  /** Extra px/s of scroll speed added per second survived. */
  scrollSpeedRamp: 11,

  obstacleMinWidth: 58,
  obstacleMaxWidth: 104,
  obstacleMinHeight: 70,
  obstacleMaxHeight: 172,

  spawnStartDelay: 1150,
  spawnMinDelay: 430,
  /** ms shaved off the spawn interval per second survived. */
  spawnDelayRamp: 12,

  coinRadius: 22,
  coinSpawnChance: 0.4,
  coinScore: 5,
  /** Coins float in this band above the ground, reachable mid-bounce. */
  coinMinHeight: 170,
  coinMaxHeight: 430,

  /** Points awarded per second survived. */
  survivalScorePerSecond: 10,
  /** Bonus for each obstacle cleared. */
  obstacleClearedScore: 25,

  /** Grace period after a revive during which collisions are ignored. */
  reviveInvulnerabilityMs: 1800,

  poolSize: {
    obstacles: 16,
    coins: 12
  }
} as const;
