import * as Phaser from 'phaser'
import { DeckManager } from '../core/DeckManager.ts'
import { EVENT_DECK } from '../core/eventCatalog.ts'
import { StateEngine } from '../core/StateEngine.ts'
import type { ChoiceSide, GameEvent, GameOver, GameState, StatKey } from '../core/types.ts'
import { STAT_KEYS } from '../core/types.ts'
import { colors, GAME_HEIGHT, GAME_WIDTH, layout } from '../theme.ts'
import { EventCard } from '../ui/EventCard.ts'
import { GameOverPanel } from '../ui/GameOverPanel.ts'
import { Hud } from '../ui/Hud.ts'
import { addEyebrow, drawPanel, drawSoftShadow } from '../ui/primitives.ts'
import { StatFeedback } from '../ui/StatFeedback.ts'

const CARD_X = GAME_WIDTH / 2
const CARD_Y = layout.card.centerY

/** Beat between the old card leaving and the next one arriving. */
const DEAL_DELAY = 420

const DEPTH = {
  stack: 5,
  card: 10,
  feedback: 15,
  hud: 20,
  overlay: 30,
} as const

/**
 * Wires the game together and owns none of the rules.
 *
 * Per decision: ask `StateEngine` what the choice did, show it, then ask
 * `DeckManager` for the next eligible card — unless the engine says the run is
 * over, which it checks after every decision.
 */
export class GameScene extends Phaser.Scene {
  private engine!: StateEngine
  private deck!: DeckManager
  private hud!: Hud
  private feedback!: StatFeedback
  private hint!: Phaser.GameObjects.Text
  private busy = false

  constructor() {
    super('Game')
  }

  create(): void {
    this.engine = new StateEngine()
    this.deck = new DeckManager(EVENT_DECK)
    this.busy = false

    // A few pixels of slack so a tap on a button is never read as a drag.
    this.input.dragDistanceThreshold = 6

    this.paintBackground()
    this.paintCardStack()

    this.hud = new Hud(this, this.engine.getState())
    this.hud.setDepth(DEPTH.hud)

    this.feedback = new StatFeedback(this, GAME_WIDTH / 2, 1052)
    this.feedback.setDepth(DEPTH.feedback)

    this.hint = addEyebrow(this, GAME_WIDTH / 2, 1192, 'Swipe or tap to decide', colors.mutedCss, 17)
      .setOrigin(0.5)
      .setAlpha(0.75)

    this.dealNext()
  }

  /** Draws the next eligible card, or ends the run if the deck has nothing left. */
  private dealNext(): void {
    const event = this.deck.draw(this.engine.getState())

    if (!event) {
      this.endRun(this.engine.outOfEvents(), this.engine.getState())
      return
    }

    const card = new EventCard(this, CARD_X, CARD_Y, event)
    card.setDepth(DEPTH.card)
    card.once('decide', (side: ChoiceSide) => this.resolve(card, event, side))
    card.playIntro()

    this.busy = false
  }

  /** One decision: apply it, show the fallout, then deal on or end the run. */
  private resolve(card: EventCard, event: GameEvent, side: ChoiceSide): void {
    if (this.busy) return
    this.busy = true

    const choice = side === 'left' ? event.leftChoice : event.rightChoice
    const outcome = this.engine.applyChoice(choice)

    this.dismissHint()

    this.hud.sync(outcome.state)
    this.hud.pulse(STAT_KEYS.filter((key: StatKey) => (outcome.deltas[key] ?? 0) !== 0))

    this.feedback.show(
      outcome.deltas,
      choice.result,
      outcome.weekAdvanced ? `Week ${outcome.state.week} · bills, and a lie-in` : undefined,
    )

    card.flyOut(side, () => {
      if (outcome.gameOver) {
        this.endRun(outcome.gameOver, outcome.state)
        return
      }
      this.time.delayedCall(DEAL_DELAY, () => this.dealNext())
    })
  }

  private endRun(info: GameOver, state: GameState): void {
    this.busy = true
    this.dismissHint()
    new GameOverPanel(this, info, state, () => this.scene.restart()).setDepth(DEPTH.overlay)
  }

  private dismissHint(): void {
    if (this.hint.alpha === 0) return
    this.tweens.add({ targets: this.hint, alpha: 0, duration: 240, ease: 'Sine.easeIn' })
  }

  private paintBackground(): void {
    const paper = this.add.graphics()
    paper.fillGradientStyle(colors.paperTop, colors.paperTop, colors.paperBottom, colors.paperBottom, 1)
    paper.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    this.add
      .text(GAME_WIDTH / 2, 1244, "DON'T LET ME GO BROKE", {
        fontFamily: '"Inter", -apple-system, Helvetica, Arial, sans-serif',
        fontSize: '16px',
        color: colors.mutedCss,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.55)
  }

  /** Two static cards peeking out below the live one, so the deck reads as a deck. */
  private paintCardStack(): void {
    const stack = this.add.container(CARD_X, CARD_Y).setDepth(DEPTH.stack)

    for (const spec of [{ scale: 0.9, offset: 48, alpha: 0.4 }, { scale: 0.95, offset: 26, alpha: 0.7 }]) {
      const ghost = this.add.graphics()
      drawSoftShadow(ghost, layout.card.width, layout.card.height, layout.radius.card, 4, 4, 8)
      drawPanel(ghost, layout.card.width, layout.card.height, layout.radius.card, colors.card, 1, colors.cardEdge, 1)

      stack.add(this.add.container(0, spec.offset, [ghost]).setScale(spec.scale).setAlpha(spec.alpha))
    }
  }
}
