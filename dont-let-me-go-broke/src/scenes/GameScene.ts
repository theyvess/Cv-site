import Phaser from 'phaser'
import { DeckManager } from '../core/DeckManager.ts'
import { StateEngine } from '../core/StateEngine.ts'
import type { Choice, GameCard, GameOverState, StatDelta } from '../core/types.ts'
import eventsData from '../data/events.json'
import {
  COLORS,
  FONTS,
  avatarColorFor,
  categoryColorFor,
  drawPanel,
} from '../ui/theme.ts'

const GAME_W = 720
const GAME_H = 1280

/* Card geometry, in the container's local space (origin at its centre). */
const CARD_W = 610
const CARD_H = 670
const CARD_HALF_W = CARD_W / 2
const CARD_HALF_H = CARD_H / 2
const CARD_PAD = 40
const CARD_HOME_X = GAME_W / 2
const CARD_HOME_Y = 700

/* Swipe feel. */
const SWIPE_THRESHOLD = 120
/** Movement under this counts as a tap on a button rather than a swipe. */
const TAP_SLOP = 12
/** Radians of tilt at full stretch — a lean, not a spin. */
const MAX_TILT = 0.2
/** Higher divisor = lazier rotation relative to horizontal travel. */
const TILT_DIVISOR = 1500
/** The card trails the finger vertically at this fraction, so it feels hinged. */
const VERTICAL_DRAG_FACTOR = 0.4

/* Choice buttons, local space. */
const BTN_W = 255
const BTN_H = 120
const BTN_Y = 220
const BTN_LEFT_X = -CARD_HALF_W + CARD_PAD + BTN_W / 2
const BTN_RIGHT_X = -BTN_LEFT_X

/* HUD geometry. */
const HUD_TOP = 132
const STAT_BOX_W = 202
const STAT_BOX_H = 88
const STAT_GAP = 17
const STAT_MARGIN = (GAME_W - (STAT_BOX_W * 3 + STAT_GAP * 2)) / 2

const HIGH_SCORE_KEY = 'dlmgb_highscore'

type StatKey = 'money' | 'energy' | 'sanity'

const STAT_DEFS: ReadonlyArray<{ key: StatKey; icon: string; label: string }> = [
  { key: 'money', icon: '💰', label: 'MONEY' },
  { key: 'energy', icon: '⚡', label: 'ENERGY' },
  { key: 'sanity', icon: '🧠', label: 'SANITY' },
]

/** Centre x of a stat box, by column index. */
function statBoxX(index: number): number {
  return STAT_MARGIN + index * (STAT_BOX_W + STAT_GAP) + STAT_BOX_W / 2
}

function formatStatValue(key: StatKey, value: number): string {
  if (key !== 'money') return `${value}`
  /* Debt reads as -£500, never £-500. */
  return value < 0 ? `-£${Math.abs(value)}` : `£${value}`
}

function formatDelta(key: StatKey, value: number): string {
  const sign = value > 0 ? '+' : '-'
  const magnitude = Math.abs(value)
  return key === 'money' ? `${sign}£${magnitude}` : `${sign}${magnitude}`
}

/**
 * localStorage throws outright in some privacy modes, so every access is
 * guarded — a blocked read must cost the player their high score, not the game.
 */
function readHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_KEY)
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

function writeHighScore(weeks: number): void {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(weeks))
  } catch {
    /* Nothing to do — the run still counts, it just will not be remembered. */
  }
}

/**
 * The playable screen: HUD, swipeable card, and the feedback that ties a choice
 * to its consequences.
 *
 * All game rules live in StateEngine and DeckManager; this scene only reads
 * state and animates what the engine reports.
 */
export class GameScene extends Phaser.Scene {
  private engine!: StateEngine
  private deck!: DeckManager

  private weekText!: Phaser.GameObjects.Text
  private statValues!: Record<StatKey, Phaser.GameObjects.Text>

  private card!: Phaser.GameObjects.Container
  private avatarBg!: Phaser.GameObjects.Graphics
  private avatarText!: Phaser.GameObjects.Text
  private senderText!: Phaser.GameObjects.Text
  private badgeBg!: Phaser.GameObjects.Graphics
  private badgeText!: Phaser.GameObjects.Text
  private promptText!: Phaser.GameObjects.Text
  private buttonHighlight!: Phaser.GameObjects.Graphics
  private leftLabel!: Phaser.GameObjects.Text
  private rightLabel!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text

  private currentCard: GameCard | null = null
  private dragging = false
  private pointerStartX = 0
  private pointerStartY = 0
  /** True from the moment a choice is committed until the next card is live. */
  private resolving = false

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg)

    this.engine = new StateEngine()
    this.deck = new DeckManager(eventsData as GameCard[])

    this.currentCard = null
    this.dragging = false
    this.resolving = false

    this.buildHud()
    this.buildCard()
    this.buildHint()
    this.attachInput()

    this.refreshHud()
    this.dealNextCard()
  }

  /* ---------------------------------------------------------------- HUD -- */

  private buildHud(): void {
    this.add
      .text(GAME_W / 2, 54, "DON'T LET ME GO BROKE", {
        fontFamily: FONTS.display,
        fontSize: '30px',
        fontStyle: 'bold',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    this.weekText = this.add
      .text(GAME_W / 2, 96, 'WEEK 1', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: COLORS.inkMuted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)

    const boxes = this.add.graphics()
    const values = {} as Record<StatKey, Phaser.GameObjects.Text>

    STAT_DEFS.forEach((def, index) => {
      const centreX = statBoxX(index)
      drawPanel(
        boxes,
        centreX - STAT_BOX_W / 2,
        HUD_TOP,
        STAT_BOX_W,
        STAT_BOX_H,
        16,
        COLORS.panelInt,
        COLORS.borderInt,
      )

      this.add
        .text(centreX, HUD_TOP + 24, `${def.icon} ${def.label}`, {
          fontFamily: `${FONTS.emoji}, ${FONTS.display}`,
          fontSize: '14px',
          color: COLORS.inkSoft,
        })
        .setOrigin(0.5)
        .setLetterSpacing(1)

      values[def.key] = this.add
        .text(centreX, HUD_TOP + 60, '', {
          fontFamily: FONTS.display,
          fontSize: '26px',
          fontStyle: 'bold',
          color: COLORS.ink,
        })
        .setOrigin(0.5)
    })

    this.statValues = values
  }

  private refreshHud(): void {
    const stats = this.engine.getStats()
    this.weekText.setText(`WEEK ${stats.week}`)
    for (const def of STAT_DEFS) {
      this.statValues[def.key].setText(formatStatValue(def.key, stats[def.key]))
    }
  }

  /* --------------------------------------------------------------- Card -- */

  private buildCard(): void {
    this.card = this.add.container(CARD_HOME_X, CARD_HOME_Y).setAlpha(0)

    const surface = this.add.graphics()
    /* Faint drop shadow, offset down, to lift the card off the paper. */
    surface.fillStyle(0x000000, 0.05)
    surface.fillRoundedRect(-CARD_HALF_W, -CARD_HALF_H + 8, CARD_W, CARD_H, 26)
    drawPanel(
      surface,
      -CARD_HALF_W,
      -CARD_HALF_H,
      CARD_W,
      CARD_H,
      26,
      COLORS.panelInt,
      COLORS.borderInt,
    )

    const avatarX = -CARD_HALF_W + CARD_PAD + 34
    const avatarY = -CARD_HALF_H + CARD_PAD + 34
    this.avatarBg = this.add.graphics()
    this.avatarText = this.add
      .text(avatarX, avatarY, '', {
        fontFamily: `${FONTS.display}, ${FONTS.emoji}`,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    const textX = avatarX + 34 + 20
    this.senderText = this.add
      .text(textX, avatarY - 7, '', {
        fontFamily: FONTS.display,
        fontSize: '24px',
        fontStyle: 'bold',
        color: COLORS.ink,
      })
      .setOrigin(0, 1)

    this.badgeBg = this.add.graphics()
    this.badgeText = this.add
      .text(textX + 10, avatarY + 20, '', {
        fontFamily: FONTS.display,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
      .setLetterSpacing(2)

    /* Hairline under the header, the way a masthead sits over body copy. */
    const rule = this.add.graphics()
    rule.lineStyle(1, COLORS.borderInt, 1)
    rule.lineBetween(-CARD_HALF_W + CARD_PAD, -192, CARD_HALF_W - CARD_PAD, -192)

    this.promptText = this.add
      .text(0, -16, '', {
        fontFamily: FONTS.serif,
        fontSize: '30px',
        color: '#2b2b2b',
        align: 'left',
        wordWrap: { width: CARD_W - CARD_PAD * 2 },
        lineSpacing: 10,
      })
      .setOrigin(0.5)

    const buttons = this.add.graphics()
    for (const x of [BTN_LEFT_X, BTN_RIGHT_X]) {
      drawPanel(
        buttons,
        x - BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        14,
        COLORS.creamInt,
        COLORS.borderInt,
      )
    }

    this.buttonHighlight = this.add.graphics()

    const arrowStyle = {
      fontFamily: FONTS.display,
      fontSize: '22px',
      fontStyle: 'bold',
      color: COLORS.accent,
    }
    const leftArrow = this.add
      .text(BTN_LEFT_X, BTN_Y - 36, '←', arrowStyle)
      .setOrigin(0.5)
    const rightArrow = this.add
      .text(BTN_RIGHT_X, BTN_Y - 36, '→', arrowStyle)
      .setOrigin(0.5)

    const labelStyle = {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: COLORS.inkSoft,
      align: 'center',
      wordWrap: { width: BTN_W - 36 },
      lineSpacing: 4,
    }
    this.leftLabel = this.add
      .text(BTN_LEFT_X, BTN_Y + 14, '', labelStyle)
      .setOrigin(0.5)
    this.rightLabel = this.add
      .text(BTN_RIGHT_X, BTN_Y + 14, '', labelStyle)
      .setOrigin(0.5)

    this.card.add([
      surface,
      this.avatarBg,
      this.avatarText,
      this.senderText,
      this.badgeBg,
      this.badgeText,
      rule,
      this.promptText,
      buttons,
      this.buttonHighlight,
      leftArrow,
      rightArrow,
      this.leftLabel,
      this.rightLabel,
    ])
  }

  private buildHint(): void {
    this.hintText = this.add
      .text(GAME_W / 2, CARD_HOME_Y + CARD_HALF_H + 48, 'swipe the card, or tap a choice', {
        fontFamily: FONTS.display,
        fontSize: '17px',
        color: COLORS.inkMuted,
      })
      .setOrigin(0.5)
  }

  private renderCard(card: GameCard): void {
    const avatarX = -CARD_HALF_W + CARD_PAD + 34
    const avatarY = -CARD_HALF_H + CARD_PAD + 34

    this.avatarBg.clear()
    this.avatarBg.fillStyle(avatarColorFor(card.sender), 1)
    this.avatarBg.fillCircle(avatarX, avatarY, 34)
    this.avatarText.setText(card.avatarText)

    this.senderText.setText(card.sender)

    this.badgeText.setText(card.category)
    const badgeX = this.badgeText.x - 10
    const badgeW = this.badgeText.width + 20
    this.badgeBg.clear()
    drawPanel(
      this.badgeBg,
      badgeX,
      this.badgeText.y - 12,
      badgeW,
      24,
      12,
      categoryColorFor(card.category),
    )

    this.promptText.setText(card.prompt)
    this.fitPromptText()

    this.leftLabel.setText(card.leftChoice.text)
    this.rightLabel.setText(card.rightChoice.text)
    this.buttonHighlight.clear()
  }

  /**
   * Shrinks an over-long prompt until it clears the choice buttons. Card copy is
   * hand-authored, so one wordy scenario should reflow rather than overlap.
   */
  private fitPromptText(): void {
    const available = BTN_Y - BTN_H / 2 - -192 - 40
    let size = 30
    this.promptText.setFontSize(size)
    while (this.promptText.height > available && size > 20) {
      size -= 2
      this.promptText.setFontSize(size)
    }
  }

  /* -------------------------------------------------------------- Input -- */

  private attachInput(): void {
    this.card.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_HALF_W, -CARD_HALF_H, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains,
    )
    this.card.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)

    /* Scene restart tears the plugin down, but be explicit rather than lucky. */
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', this.onPointerMove, this)
      this.input.off('pointerup', this.onPointerUp, this)
    })
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.resolving || this.currentCard === null) return
    this.dragging = true
    this.pointerStartX = pointer.x
    this.pointerStartY = pointer.y
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return
    const dx = pointer.x - this.pointerStartX
    const dy = pointer.y - this.pointerStartY

    this.card.x = CARD_HOME_X + dx
    this.card.y = CARD_HOME_Y + dy * VERTICAL_DRAG_FACTOR
    this.card.rotation = Phaser.Math.Clamp(dx / TILT_DIVISOR, -MAX_TILT, MAX_TILT)
    this.updateSwipeFeedback(dx)
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return
    this.dragging = false

    const dx = pointer.x - this.pointerStartX
    const dy = pointer.y - this.pointerStartY

    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      this.commitChoice(dx < 0 ? 'left' : 'right')
      return
    }

    /* A near-stationary release is a tap: hit-test the two buttons directly. */
    if (Math.hypot(dx, dy) <= TAP_SLOP) {
      const side = this.buttonAt(pointer.x - this.card.x, pointer.y - this.card.y)
      if (side !== null) {
        this.commitChoice(side)
        return
      }
    }

    this.returnCardHome()
  }

  /** Which choice button contains a point in the card's local space, if any. */
  private buttonAt(localX: number, localY: number): 'left' | 'right' | null {
    if (Math.abs(localY - BTN_Y) > BTN_H / 2) return null
    if (Math.abs(localX - BTN_LEFT_X) <= BTN_W / 2) return 'left'
    if (Math.abs(localX - BTN_RIGHT_X) <= BTN_W / 2) return 'right'
    return null
  }

  /** Warms the button you are swiping towards, so the commit is never a surprise. */
  private updateSwipeFeedback(dx: number): void {
    this.buttonHighlight.clear()
    if (dx === 0) return
    const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1)
    const x = dx < 0 ? BTN_LEFT_X : BTN_RIGHT_X
    this.buttonHighlight.fillStyle(COLORS.accentInt, progress * 0.18)
    this.buttonHighlight.fillRoundedRect(
      x - BTN_W / 2,
      BTN_Y - BTN_H / 2,
      BTN_W,
      BTN_H,
      14,
    )
  }

  private returnCardHome(): void {
    this.buttonHighlight.clear()
    this.tweens.add({
      targets: this.card,
      x: CARD_HOME_X,
      y: CARD_HOME_Y,
      rotation: 0,
      duration: 300,
      ease: 'Back.easeOut',
    })
  }

  /* --------------------------------------------------------------- Loop -- */

  private commitChoice(side: 'left' | 'right'): void {
    if (this.resolving || this.currentCard === null) return

    const card = this.currentCard
    const choice: Choice = side === 'left' ? card.leftChoice : card.rightChoice

    this.resolving = true
    this.dragging = false
    this.currentCard = null
    this.buttonHighlight.clear()

    const direction = side === 'left' ? -1 : 1
    this.tweens.add({
      targets: this.card,
      x: CARD_HOME_X + direction * 900,
      y: this.card.y + 80,
      rotation: direction * 0.45,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => this.resolveChoice(choice),
    })
  }

  private resolveChoice(choice: Choice): void {
    const result = this.engine.applyChoiceEffects(choice.effects)
    this.refreshHud()
    this.spawnDeltas(result.deltas)

    const proceed = (): void => {
      const gameOver = this.engine.checkGameOver()
      if (gameOver.isGameOver) this.showGameOver(gameOver)
      else this.dealNextCard()
    }

    /* Rent is its own beat, so the player reads the hit before the next card. */
    if (result.rentDeducted) this.showRentOverlay(result.rentAmount, proceed)
    else this.time.delayedCall(280, proceed)
  }

  private dealNextCard(): void {
    const next = this.deck.draw(this.engine.getStats())
    if (next === null) {
      this.showOutOfEvents()
      return
    }

    this.currentCard = next
    this.renderCard(next)

    this.card
      .setPosition(CARD_HOME_X, CARD_HOME_Y + 40)
      .setRotation(0)
      .setScale(0.94)
      .setAlpha(0)

    this.tweens.add({
      targets: this.card,
      y: CARD_HOME_Y,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })

    this.resolving = false
  }

  /**
   * The deck legitimately runs dry when nothing in the library is eligible for
   * the current stats — a content gap, not a crash. Say so and stop.
   */
  private showOutOfEvents(): void {
    this.hintText.setVisible(false)
    this.add
      .text(GAME_W / 2, CARD_HOME_Y, 'Out of events!', {
        fontFamily: FONTS.serif,
        fontSize: '38px',
        color: COLORS.inkSoft,
      })
      .setOrigin(0.5)
  }

  /* ----------------------------------------------------------- Feedback -- */

  /** Floats each non-zero change up out of its own stat box. */
  private spawnDeltas(deltas: StatDelta): void {
    STAT_DEFS.forEach((def, index) => {
      const value = deltas[def.key]
      if (value === 0) return

      const label = this.add
        .text(statBoxX(index), HUD_TOP + 60, formatDelta(def.key, value), {
          fontFamily: FONTS.display,
          fontSize: '24px',
          fontStyle: 'bold',
          color: value > 0 ? COLORS.positive : COLORS.negative,
        })
        .setOrigin(0.5)
        .setDepth(20)

      this.tweens.add({
        targets: label,
        y: HUD_TOP - 14,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => label.destroy(),
      })
    })
  }

  /** Full-screen rent notice: 200ms in, 1.1s hold, 200ms out. */
  private showRentOverlay(amount: number, done: () => void): void {
    const layer = this.add.container(0, 0).setDepth(40).setAlpha(0)
    const scrim = this.add
      .rectangle(0, 0, GAME_W, GAME_H, COLORS.inkInt, 0.86)
      .setOrigin(0)
    const heading = this.add
      .text(GAME_W / 2, GAME_H / 2 - 56, 'RENT WEEK', {
        fontFamily: FONTS.display,
        fontSize: '26px',
        fontStyle: 'bold',
        color: COLORS.bg,
      })
      .setOrigin(0.5)
      .setLetterSpacing(6)
    const figure = this.add
      .text(GAME_W / 2, GAME_H / 2 + 22, `-£${amount}`, {
        fontFamily: FONTS.serif,
        fontSize: '76px',
        color: '#e8a08a',
      })
      .setOrigin(0.5)

    layer.add([scrim, heading, figure])

    this.tweens.add({
      targets: layer,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.time.delayedCall(1100, () => {
          this.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              layer.destroy()
              done()
            },
          })
        })
      },
    })
  }

  /* ------------------------------------------------------------ Endgame -- */

  private showGameOver(state: GameOverState): void {
    const weeks = state.weeksSurvived
    const previousBest = readHighScore()
    const isBest = weeks > previousBest
    if (isBest) writeHighScore(weeks)
    const best = Math.max(weeks, previousBest)

    this.hintText.setVisible(false)

    const layer = this.add.container(0, 0).setDepth(60).setAlpha(0)
    layer.add(
      this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.inkInt, 0.97).setOrigin(0),
    )
    layer.add(
      this.add
        .text(GAME_W / 2, 380, 'GAME OVER', {
          fontFamily: FONTS.display,
          fontSize: '46px',
          fontStyle: 'bold',
          color: COLORS.bg,
        })
        .setOrigin(0.5)
        .setLetterSpacing(6),
    )
    layer.add(
      this.add
        .text(GAME_W / 2, 476, state.message, {
          fontFamily: FONTS.serif,
          fontSize: '27px',
          color: '#d8cec4',
          align: 'center',
          wordWrap: { width: 520 },
          lineSpacing: 8,
        })
        .setOrigin(0.5),
    )
    layer.add(
      this.add
        .text(GAME_W / 2, 640, `You survived ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`, {
          fontFamily: FONTS.serif,
          fontSize: '40px',
          color: COLORS.bg,
        })
        .setOrigin(0.5),
    )
    layer.add(
      this.add
        .text(
          GAME_W / 2,
          710,
          isBest ? 'NEW PERSONAL BEST' : `Best: ${best} ${best === 1 ? 'week' : 'weeks'}`,
          {
            fontFamily: FONTS.display,
            fontSize: '17px',
            fontStyle: 'bold',
            color: isBest ? '#e8a08a' : COLORS.inkMuted,
          },
        )
        .setOrigin(0.5)
        .setLetterSpacing(3),
    )

    const button = this.add
      .rectangle(GAME_W / 2, 856, 320, 76, COLORS.bgInt)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    button.once('pointerup', () => {
      this.engine.reset()
      this.deck.reset()
      this.scene.restart()
    })
    layer.add(button)
    layer.add(
      this.add
        .text(GAME_W / 2, 856, 'TRY AGAIN', {
          fontFamily: FONTS.display,
          fontSize: '20px',
          fontStyle: 'bold',
          color: COLORS.ink,
        })
        .setOrigin(0.5)
        .setLetterSpacing(3),
    )

    this.tweens.add({ targets: layer, alpha: 1, duration: 320 })
  }
}
