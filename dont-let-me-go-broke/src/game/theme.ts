import type { StatKey } from './core/types.ts'

/**
 * Design tokens for the whole game.
 *
 * The look is editorial rather than arcade: warm paper ground, one crisp white
 * card, a serif for the writing and a system sans for the interface furniture.
 * Phaser needs colours as numbers, the DOM and text styles need them as
 * strings, so both forms live here side by side.
 */

export const GAME_WIDTH = 720
export const GAME_HEIGHT = 1280

export const colors = {
  paperTop: 0xf9f5f0,
  paperBottom: 0xeae1d6,
  paperCss: '#f4ede4',

  ink: 0x1a1613,
  inkCss: '#1a1613',
  muted: 0x8d8377,
  mutedCss: '#8d8377',
  hairline: 0xded4c7,

  card: 0xffffff,
  cardCss: '#ffffff',
  cardEdge: 0xe7ded2,
  cream: 0xfbf8f4,
  creamCss: '#fbf8f4',

  money: 0x2f6b4f,
  moneyCss: '#2f6b4f',
  energy: 0xbf7a2b,
  energyCss: '#bf7a2b',
  sanity: 0x7a5ea4,
  sanityCss: '#7a5ea4',

  positive: 0x2f6b4f,
  positiveCss: '#2f6b4f',
  negative: 0xb2402f,
  negativeCss: '#b2402f',
} as const

export const statColors: Record<StatKey, { value: number; css: string }> = {
  money: { value: colors.money, css: colors.moneyCss },
  energy: { value: colors.energy, css: colors.energyCss },
  sanity: { value: colors.sanity, css: colors.sanityCss },
}

export const statLabels: Record<StatKey, string> = {
  money: 'Balance',
  energy: 'Energy',
  sanity: 'Sanity',
}

/**
 * System stacks only — no webfont request, so text is never held up by the
 * network and the build stays dependency-free.
 */
export const fonts = {
  sans: '"Inter", "SF Pro Text", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
} as const

export const layout = {
  safeX: 52,
  card: {
    width: 616,
    height: 700,
    centerY: 664,
  },
  radius: {
    card: 44,
    pill: 46,
    tile: 26,
    chip: 22,
  },
} as const
