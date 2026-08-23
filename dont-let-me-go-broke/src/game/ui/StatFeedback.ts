import * as Phaser from 'phaser'
import type { Effects, StatKey } from '../core/types.ts'
import { STAT_KEYS } from '../core/types.ts'
import { colors, layout, statColors, statLabels } from '../theme.ts'
import { addEyebrow, drawPanel, formatDelta, formatMoneyDelta, sans, serif } from './primitives.ts'

const CHIP_HEIGHT = 46
const CHIP_GAP = 12
const HOLD_MS = 1250

/**
 * The strip under the card: what the choice cost you, in a line of prose and a
 * row of chips. Shown briefly after each decision, then faded out.
 */
export class StatFeedback extends Phaser.GameObjects.Container {
  private readonly resultLine: Phaser.GameObjects.Text
  private readonly chips: Phaser.GameObjects.Container
  private readonly note: Phaser.GameObjects.Text
  private fadeEvent?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    this.resultLine = scene.add
      .text(0, 0, '', serif(26, colors.mutedCss, { weight: 'italic', align: 'center', wrap: 600 }))
      .setOrigin(0.5)

    this.chips = scene.add.container(0, 58)
    this.note = addEyebrow(scene, 0, 112, '', colors.mutedCss, 16).setOrigin(0.5).setAlpha(0)

    this.add([this.resultLine, this.chips, this.note])
    scene.add.existing(this)
  }

  /**
   * @param deltas    stat changes that actually landed
   * @param result    one line of consequence from the chosen option
   * @param note      optional aside, e.g. the week rolling over
   */
  show(deltas: Effects, result?: string, note?: string): void {
    this.fadeEvent?.remove()
    this.scene.tweens.killTweensOf(this)
    this.setAlpha(1)

    this.resultLine.setText(result ?? '')
    this.note.setText((note ?? '').toUpperCase()).setAlpha(note ? 1 : 0)

    this.chips.removeAll(true)

    const built = STAT_KEYS
      .filter((key) => (deltas[key] ?? 0) !== 0)
      .map((key) => this.buildChip(key, deltas[key] as number))

    const total = built.reduce((sum, chip) => sum + chip.width, 0) + CHIP_GAP * Math.max(0, built.length - 1)
    let cursor = -total / 2

    built.forEach((chip, index) => {
      chip.container.setPosition(cursor + chip.width / 2, 0)
      this.chips.add(chip.container)
      cursor += chip.width + CHIP_GAP

      chip.container.setAlpha(0)
      this.scene.tweens.add({
        targets: chip.container,
        alpha: 1,
        y: { from: 14, to: 0 },
        duration: 220,
        delay: index * 70,
        ease: 'Sine.easeOut',
      })
    })

    this.fadeEvent = this.scene.time.delayedCall(HOLD_MS, () => {
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 320, ease: 'Sine.easeIn' })
    })
  }

  clear(): void {
    this.fadeEvent?.remove()
    this.chips.removeAll(true)
    this.resultLine.setText('')
    this.note.setText('')
  }

  private buildChip(key: StatKey, value: number): { container: Phaser.GameObjects.Container; width: number } {
    const label = key === 'money'
      ? formatMoneyDelta(value)
      : `${formatDelta(value)} ${statLabels[key]}`

    const caption = this.scene.add
      .text(0, 0, label, sans(25, value > 0 ? colors.positiveCss : colors.negativeCss, { weight: '600' }))
      .setOrigin(0.5)

    const width = caption.width + 44
    const background = this.scene.add.graphics()
    drawPanel(background, width, CHIP_HEIGHT, layout.radius.chip, statColors[key].value, 0.11)

    const container = this.scene.add.container(0, 0, [background, caption])
    return { container, width }
  }
}
