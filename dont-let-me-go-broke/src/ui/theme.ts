/**
 * Shared visual language: an off-white editorial palette, a serif for prose and
 * a grotesque for interface furniture. Kept in one place so the three scenes
 * cannot drift apart.
 *
 * Colours are declared twice because Phaser wants CSS strings for text styles
 * and packed integers for Graphics fills.
 */
export const COLORS = {
  bg: '#f7f3ef',
  bgInt: 0xf7f3ef,
  ink: '#1f1b18',
  inkInt: 0x1f1b18,
  inkSoft: '#6b625b',
  inkMuted: '#9c928a',
  panel: '#ffffff',
  panelInt: 0xffffff,
  cream: '#faf7f3',
  creamInt: 0xfaf7f3,
  border: '#e6ded4',
  borderInt: 0xe6ded4,
  accent: '#c2643f',
  accentInt: 0xc2643f,
  positive: '#2f7d4f',
  negative: '#b1442f',
} as const

export const FONTS = {
  /** Interface furniture: HUD, badges, buttons. */
  display: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  /** Card prose. The game is meant to read like a letter, not a dashboard. */
  serif: 'Georgia, "Times New Roman", Times, serif',
  /** Emoji need their own stack or they fall back to tofu on Linux. */
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
} as const

/** Avatar fills, picked deterministically from the sender's name. */
export const AVATAR_COLORS = [
  0xc2643f, 0x4f6d7a, 0x7a6248, 0x5c7a5c, 0x8a5a72, 0x476a8a,
] as const

/** Category badge tints, keyed by the card's category label. */
export const CATEGORY_COLORS: Record<string, number> = {
  HOUSING: 0xc2643f,
  WORK: 0x4f6d7a,
  SOCIAL: 0x8a5a72,
  FAMILY: 0x7a6248,
  MONEY: 0x5c7a5c,
}

/** Stable colour choice for a sender, so the same person looks the same. */
export function avatarColorFor(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}

/** Badge tint for a category, falling back to the neutral ink tone. */
export function categoryColorFor(category: string): number {
  return CATEGORY_COLORS[category] ?? 0x6b625b
}

/** Rounded panel with an optional hairline border, from its top-left corner. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: number,
  stroke?: number,
  lineWidth = 2,
): void {
  g.fillStyle(fill, 1)
  g.fillRoundedRect(x, y, w, h, radius)
  if (stroke !== undefined) {
    g.lineStyle(lineWidth, stroke, 1)
    g.strokeRoundedRect(x, y, w, h, radius)
  }
}
