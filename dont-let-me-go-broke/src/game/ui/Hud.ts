import * as Phaser from 'phaser'
import type { GameState, StatKey } from '../core/types.ts'
import { RULES, statBounds } from '../core/StateEngine.ts'
import { colors, layout, statColors, statLabels } from '../theme.ts'
import { addEyebrow, drawPanel, formatMoney, sans } from './primitives.ts'

/** Money has no ceiling, so its bar reads against a comfortable target instead. */
const MONEY_BAR_TARGET = 1500

const TILE_WIDTH = 196
const TILE_HEIGHT = 132
const TILE_GAP = 14
const TILE_TOP = 112
const BAR_WIDTH = 144
const BAR_HEIGHT = 6

/** One stat tile: label, value, and a bar showing where the value sits. */
class StatTile extends Phaser.GameObjects.Container {
  private readonly key: StatKey
  private readonly value: Phaser.GameObjects.Text
  private readonly bar: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, x: number, y: number, key: StatKey) {
    super(scene, x, y)
    this.key = key

    const frame = scene.add.graphics()
    drawPanel(frame, TILE_WIDTH, TILE_HEIGHT, layout.radius.tile, colors.card, 0.76, colors.cardEdge, 1)
    this.add(frame)

    const left = -TILE_WIDTH / 2 + 26

    this.add(addEyebrow(scene, left, -TILE_HEIGHT / 2 + 24, statLabels[key], colors.mutedCss, 16))

    this.value = scene.add.text(left, -TILE_HEIGHT / 2 + 52, '—', sans(34, colors.inkCss, { weight: '600' }))
    this.add(this.value)

    const track = scene.add.graphics()
    track.fillStyle(colors.hairline, 1)
    track.fillRoundedRect(left, TILE_HEIGHT / 2 - 30, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2)
    this.add(track)

    this.bar = scene.add.graphics()
    this.add(this.bar)

    scene.add.existing(this)
  }

  sync(state: GameState): void {
    const raw = state[this.key]
    this.value.setText(this.key === 'money' ? formatMoney(raw) : String(Math.round(raw)))

    const ratio = this.key === 'money'
      ? Phaser.Math.Clamp(raw / MONEY_BAR_TARGET, 0, 1)
      : Phaser.Math.Clamp(raw / statBounds(this.key).max, 0, 1)

    const left = -TILE_WIDTH / 2 + 26
    this.bar.clear()
    if (ratio <= 0) return

    this.bar.fillStyle(statColors[this.key].value, 1)
    this.bar.fillRoundedRect(
      left,
      TILE_HEIGHT / 2 - 30,
      Math.max(BAR_HEIGHT, BAR_WIDTH * ratio),
      BAR_HEIGHT,
      BAR_HEIGHT / 2,
    )
  }

  /** Brief lift + colour flash when this stat just moved. */
  pulse(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.value,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 140,
      yoyo: true,
      ease: 'Sine.easeOut',
    })

    this.value.setColor(statColors[this.key].css)
    scene.time.delayedCall(620, () => this.value.setColor(colors.inkCss))
  }
}

/**
 * The top bar: which week it is, how far into it you are, and the three
 * numbers the whole game is about.
 */
export class Hud extends Phaser.GameObjects.Container {
  private readonly weekLabel: Phaser.GameObjects.Text
  private readonly dayDots: Phaser.GameObjects.Graphics
  private readonly tiles: Record<StatKey, StatTile>

  constructor(scene: Phaser.Scene, state: GameState) {
    super(scene, 0, 0)

    this.weekLabel = addEyebrow(scene, layout.safeX, 62, 'Week 01')
    this.add(this.weekLabel)

    this.dayDots = scene.add.graphics()
    this.add(this.dayDots)

    const firstX = layout.safeX + TILE_WIDTH / 2
    const step = TILE_WIDTH + TILE_GAP
    const centerY = TILE_TOP + TILE_HEIGHT / 2

    this.tiles = {
      money: new StatTile(scene, firstX, centerY, 'money'),
      energy: new StatTile(scene, firstX + step, centerY, 'energy'),
      sanity: new StatTile(scene, firstX + step * 2, centerY, 'sanity'),
    }
    this.add([this.tiles.money, this.tiles.energy, this.tiles.sanity])

    const rule = scene.add.graphics()
    rule.fillStyle(colors.hairline, 1)
    rule.fillRect(layout.safeX, TILE_TOP + TILE_HEIGHT + 44, 616, 1)
    this.add(rule)

    scene.add.existing(this)
    this.sync(state)
  }

  sync(state: GameState): void {
    this.weekLabel.setText(`Week ${String(state.week).padStart(2, '0')}`)

    this.dayDots.clear()
    const right = layout.safeX + 616
    const spacing = 24
    for (let day = 1; day <= RULES.daysPerWeek; day++) {
      const x = right - (RULES.daysPerWeek - day) * spacing
      const done = day <= state.dayInWeek
      this.dayDots.fillStyle(done ? colors.ink : colors.hairline, 1)
      this.dayDots.fillCircle(x, 71, done ? 5.5 : 4.5)
    }

    this.tiles.money.sync(state)
    this.tiles.energy.sync(state)
    this.tiles.sanity.sync(state)
  }

  /** Called with the stats a decision actually moved. */
  pulse(keys: StatKey[]): void {
    for (const key of keys) this.tiles[key].pulse(this.scene)
  }
}
