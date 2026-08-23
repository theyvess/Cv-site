import Phaser from 'phaser'
import { COLORS, FONTS, drawPanel } from '../ui/theme.ts'

const GAME_W = 720
const GAME_H = 1280
const HIGH_SCORE_KEY = 'dlmgb_highscore'

/** Guarded read: blocked storage should cost the score, not the title screen. */
function readHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_KEY)
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

/** Title screen: the promise, the all-time best, and one way in. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg)

    this.add
      .text(GAME_W / 2, 360, "DON'T\nLET ME\nGO BROKE", {
        fontFamily: FONTS.display,
        fontSize: '76px',
        fontStyle: 'bold',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)

    const rule = this.add.graphics()
    rule.lineStyle(1, COLORS.borderInt, 1)
    rule.lineBetween(GAME_W / 2 - 120, 540, GAME_W / 2 + 120, 540)

    this.add
      .text(
        GAME_W / 2,
        620,
        'How long can you survive adulthood\nwithout going broke, burning out\nor completely losing the plot?',
        {
          fontFamily: FONTS.serif,
          fontSize: '28px',
          color: COLORS.inkSoft,
          align: 'center',
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5)

    const best = readHighScore()
    this.add
      .text(
        GAME_W / 2,
        810,
        best > 0
          ? `BEST RUN — ${best} ${best === 1 ? 'WEEK' : 'WEEKS'}`
          : 'NO RUNS YET',
        {
          fontFamily: FONTS.display,
          fontSize: '17px',
          fontStyle: 'bold',
          color: COLORS.inkMuted,
        },
      )
      .setOrigin(0.5)
      .setLetterSpacing(4)

    const buttonW = 380
    const buttonH = 88
    const buttonY = 940
    const buttonBg = this.add.graphics()
    drawPanel(
      buttonBg,
      GAME_W / 2 - buttonW / 2,
      buttonY - buttonH / 2,
      buttonW,
      buttonH,
      18,
      COLORS.inkInt,
    )

    this.add
      .text(GAME_W / 2, buttonY, 'START ADULTHOOD', {
        fontFamily: FONTS.display,
        fontSize: '21px',
        fontStyle: 'bold',
        color: COLORS.bg,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    /* An invisible zone over the drawn button keeps hit area and art separate. */
    this.add
      .zone(GAME_W / 2, buttonY, buttonW, buttonH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .once('pointerup', () => this.scene.start('GameScene'))

    this.add
      .text(GAME_W / 2, GAME_H - 90, 'Rent is due every four decisions.', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: COLORS.inkMuted,
      })
      .setOrigin(0.5)
  }
}
