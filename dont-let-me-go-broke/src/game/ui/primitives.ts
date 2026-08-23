import * as Phaser from 'phaser'
import { colors, fonts, layout } from '../theme.ts'

/**
 * Small drawing and typography helpers shared by the HUD, the card and the
 * end-of-run sheet. Presentation only — nothing here knows the rules.
 */

/**
 * The stage is 720 wide but is usually upscaled past that on a phone, so text
 * is rendered at up to 2× and downsampled instead of being stretched soft.
 */
const TEXT_RESOLUTION = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)))

interface TextOptions {
  weight?: string
  align?: 'left' | 'center' | 'right'
  wrap?: number
  lineSpacing?: number
}

export function sans(
  size: number,
  color: string,
  options: TextOptions = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: fonts.sans,
    fontSize: `${size}px`,
    fontStyle: options.weight ?? '400',
    color,
    align: options.align ?? 'left',
    resolution: TEXT_RESOLUTION,
    ...(options.wrap ? { wordWrap: { width: options.wrap, useAdvancedWrap: true } } : {}),
  }
}

export function serif(
  size: number,
  color: string,
  options: TextOptions = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: fonts.serif,
    fontSize: `${size}px`,
    fontStyle: options.weight ?? '400',
    color,
    align: options.align ?? 'left',
    resolution: TEXT_RESOLUTION,
    ...(options.wrap ? { wordWrap: { width: options.wrap, useAdvancedWrap: true } } : {}),
  }
}

/** Small, letter-spaced, upper-case label — the section markers of the layout. */
export function addEyebrow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  color: string = colors.mutedCss,
  size = 19,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, content.toUpperCase(), sans(size, color, { weight: '600' }))
    .setLetterSpacing(2.4)
}

/** Shrinks a text object until it fits `maxWidth`, down to `minSize`. */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number, minSize: number): void {
  let size = Number.parseFloat(String(text.style.fontSize))
  while (text.width > maxWidth && size > minSize) {
    size -= 1
    text.setFontSize(size)
  }
}

/**
 * Canvas has no blur, so a shadow is stacked translucent rounded rectangles
 * spreading outwards and downwards. Cheap, and soft enough to read as depth.
 */
export function drawSoftShadow(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  radius: number,
  layers = 8,
  spread = 4,
  offsetY = 10,
): void {
  for (let i = layers; i >= 1; i--) {
    const grow = i * spread
    graphics.fillStyle(colors.ink, 0.018)
    graphics.fillRoundedRect(
      -width / 2 - grow,
      -height / 2 - grow + offsetY,
      width + grow * 2,
      height + grow * 2,
      radius + grow,
    )
  }
}

/** Rounded rectangle centred on the graphics origin, with an optional hairline edge. */
export function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  radius: number,
  fill: number,
  fillAlpha = 1,
  stroke?: number,
  strokeWidth = 1,
): void {
  graphics.fillStyle(fill, fillAlpha)
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius)

  if (stroke !== undefined) {
    graphics.lineStyle(strokeWidth, stroke, 1)
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius)
  }
}

export type PillVariant = 'solid' | 'outline'

/**
 * A decision button.
 *
 * Deliberately *not* interactive: the card owns all pointer input so that a
 * swipe started on top of a button still drags the card. The card hit-tests
 * `bounds` (parent-space) on tap and calls `setPressed()` for feedback.
 */
export class PillButton extends Phaser.GameObjects.Container {
  readonly bounds: Phaser.Geom.Rectangle

  private readonly background: Phaser.GameObjects.Graphics
  private readonly caption: Phaser.GameObjects.Text
  private readonly variant: PillVariant
  private readonly pillWidth: number
  private readonly pillHeight: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    variant: PillVariant,
  ) {
    super(scene, x, y)

    this.variant = variant
    this.pillWidth = width
    this.pillHeight = height
    this.bounds = new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height)

    this.background = scene.add.graphics()
    this.add(this.background)

    this.caption = scene.add
      .text(
        0,
        0,
        label,
        sans(27, variant === 'solid' ? colors.creamCss : colors.inkCss, {
          weight: '600',
          align: 'center',
        }),
      )
      .setOrigin(0.5)
    fitText(this.caption, width - 44, 19)
    this.add(this.caption)

    this.redraw(false)
    scene.add.existing(this)
  }

  setPressed(pressed: boolean): void {
    this.redraw(pressed)
    this.setScale(pressed ? 0.97 : 1)
  }

  private redraw(pressed: boolean): void {
    const { pillWidth: w, pillHeight: h } = this
    const radius = layout.radius.pill

    this.background.clear()

    if (this.variant === 'solid') {
      drawPanel(this.background, w, h, radius, colors.ink, pressed ? 0.82 : 1)
    } else {
      drawPanel(
        this.background,
        w,
        h,
        radius,
        colors.ink,
        pressed ? 0.06 : 0,
        colors.ink,
        2,
      )
    }
  }
}

const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

/** `£1,240`, or `−£120` with a typographic minus. */
export function formatMoney(value: number): string {
  const formatted = currency.format(Math.abs(Math.round(value)))
  return value < 0 ? `−${formatted}` : formatted
}

/** Always-signed money, for stat changes: `+£420` / `−£85`. */
export function formatMoneyDelta(value: number): string {
  const formatted = currency.format(Math.abs(Math.round(value)))
  return `${value < 0 ? '−' : '+'}${formatted}`
}

/** Always-signed plain number: `+12` / `−8`. */
export function formatDelta(value: number): string {
  return `${value < 0 ? '−' : '+'}${Math.abs(Math.round(value))}`
}
