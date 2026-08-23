import * as Phaser from 'phaser'
import type { GameOver, GameState } from '../core/types.ts'
import { colors, GAME_HEIGHT, GAME_WIDTH, layout } from '../theme.ts'
import { addEyebrow, drawPanel, drawSoftShadow, fitText, formatMoney, PillButton, sans, serif } from './primitives.ts'

const SHEET_WIDTH = 616
const SHEET_HEIGHT = 540

/** The end-of-run sheet: verdict, a short recap, and a way back in. */
export class GameOverPanel extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, info: GameOver, state: GameState, onRestart: () => void) {
    super(scene, 0, 0)

    const scrim = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, colors.ink, 0.55)
      .setInteractive()
    this.add(scrim)

    const sheet = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)

    const shadow = scene.add.graphics()
    drawSoftShadow(shadow, SHEET_WIDTH, SHEET_HEIGHT, layout.radius.card, 10, 5, 14)
    sheet.add(shadow)

    const face = scene.add.graphics()
    drawPanel(face, SHEET_WIDTH, SHEET_HEIGHT, layout.radius.card, colors.card, 1, colors.cardEdge, 1)
    sheet.add(face)

    const isWin = info.reason === 'survived' || info.reason === 'outOfEvents'
    sheet.add(
      addEyebrow(scene, 0, -206, isWin ? 'Run complete' : 'Run over', colors.mutedCss, 18).setOrigin(0.5),
    )

    const title = scene.add
      .text(0, -150, info.title, serif(58, colors.inkCss, { align: 'center' }))
      .setOrigin(0.5)
    fitText(title, SHEET_WIDTH - 96, 34)
    sheet.add(title)

    sheet.add(
      scene.add
        .text(0, -62, info.message, sans(25, colors.mutedCss, { align: 'center', wrap: SHEET_WIDTH - 120 }))
        .setOrigin(0.5)
        .setLineSpacing(8),
    )

    const rule = scene.add.graphics()
    rule.fillStyle(colors.hairline, 1)
    rule.fillRect(-SHEET_WIDTH / 2 + 48, 12, SHEET_WIDTH - 96, 1)
    sheet.add(rule)

    this.addRecap(scene, sheet, -132, 'Weeks', String(state.week))
    this.addRecap(scene, sheet, 132, 'Left over', formatMoney(state.money))

    const button = new PillButton(scene, 0, 190, 320, 88, 'Start over', 'solid')
    sheet.add(button)

    const hit = scene.add
      .rectangle(0, 190, 320, 88, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => button.setPressed(true))
    hit.on('pointerout', () => button.setPressed(false))
    hit.on('pointerup', () => {
      button.setPressed(false)
      onRestart()
    })
    sheet.add(hit)

    this.add(sheet)
    scene.add.existing(this)

    // Settle in rather than snapping — the run just ended, let it land.
    scrim.setAlpha(0)
    sheet.setAlpha(0).setScale(0.92)
    scene.tweens.add({ targets: scrim, alpha: 1, duration: 260, ease: 'Sine.easeOut' })
    scene.tweens.add({
      targets: sheet,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 380,
      delay: 90,
      ease: 'Back.easeOut',
    })
  }

  private addRecap(
    scene: Phaser.Scene,
    sheet: Phaser.GameObjects.Container,
    x: number,
    label: string,
    value: string,
  ): void {
    sheet.add(addEyebrow(scene, x, 52, label, colors.mutedCss, 16).setOrigin(0.5))

    const text = scene.add
      .text(x, 92, value, sans(38, colors.inkCss, { weight: '600', align: 'center' }))
      .setOrigin(0.5)
    fitText(text, 240, 22)
    sheet.add(text)
  }
}
