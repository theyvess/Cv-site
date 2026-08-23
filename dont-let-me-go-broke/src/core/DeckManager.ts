import type { GameCard, PlayerStats } from './types.ts'

/** Supplies the randomness for shuffling and drawing. Injectable for tests. */
export type RandomSource = () => number

/**
 * Owns the card library and decides what the player sees next.
 *
 * Draw/discard piles keep the deck feeling shuffled rather than random: every
 * eligible card gets played before any card repeats. Eligibility is evaluated
 * at draw time against live stats, so a card gated on being broke only shows
 * up once you actually are.
 */
export class DeckManager {
  private readonly library: GameCard[]
  private drawPile: GameCard[]
  private discardPile: GameCard[]
  private lastCardId: string | null
  private readonly random: RandomSource

  constructor(cards: GameCard[], random: RandomSource = Math.random) {
    this.library = [...cards]
    this.drawPile = []
    this.discardPile = []
    this.lastCardId = null
    this.random = random
    this.reset()
  }

  /**
   * Whether a card's gates all pass against the given stats.
   *
   * Absent conditions mean "always eligible". Each present bound is checked
   * strictly and independently, and bounds are inclusive: `minMoney: 0` admits
   * exactly £0, `maxEnergy: 20` admits exactly 20.
   */
  isCardEligible(card: GameCard, stats: PlayerStats): boolean {
    const c = card.conditions
    if (!c) return true

    if (c.minMoney !== undefined && stats.money < c.minMoney) return false
    if (c.maxMoney !== undefined && stats.money > c.maxMoney) return false
    if (c.minEnergy !== undefined && stats.energy < c.minEnergy) return false
    if (c.maxEnergy !== undefined && stats.energy > c.maxEnergy) return false
    if (c.minSanity !== undefined && stats.sanity < c.minSanity) return false
    if (c.maxSanity !== undefined && stats.sanity > c.maxSanity) return false
    if (c.minWeek !== undefined && stats.week < c.minWeek) return false
    if (c.maxWeek !== undefined && stats.week > c.maxWeek) return false

    if (c.requiresFlag !== undefined && !stats.flags.includes(c.requiresFlag)) {
      return false
    }
    if (c.excludeFlag !== undefined && stats.flags.includes(c.excludeFlag)) {
      return false
    }

    return true
  }

  /**
   * Draws the next card, or null when the library has nothing legal to show.
   *
   * Runs a fixed three-stage escalation rather than retrying until something
   * turns up — with stat-gated content it is genuinely possible for nothing to
   * qualify, and a retry loop would hang the game instead of saying so:
   *
   *   1. an eligible card from the draw pile that isn't the one just played;
   *   2. same, after folding the discard pile back in and reshuffling;
   *   3. same, but allowing an immediate repeat — better one card twice than a
   *      dead screen.
   *
   * Returning null is a real outcome the caller must handle (end the run, or
   * widen the deck); it is not an error.
   */
  draw(stats: PlayerStats): GameCard | null {
    let candidates = this.eligibleFromDrawPile(stats, true)

    if (candidates.length === 0) {
      this.recycleDiscardPile()
      candidates = this.eligibleFromDrawPile(stats, true)
    }

    if (candidates.length === 0) {
      candidates = this.eligibleFromDrawPile(stats, false)
    }

    if (candidates.length === 0) return null

    const card = candidates[Math.floor(this.random() * candidates.length)]!
    this.commitDraw(card)
    return card
  }

  /** Cards in the library that would be legal right now, ignoring pile state. */
  countEligible(stats: PlayerStats): number {
    return this.library.filter((card) => this.isCardEligible(card, stats)).length
  }

  /** Cards left to play before the deck recycles. */
  getDrawPileSize(): number {
    return this.drawPile.length
  }

  /** Reshuffles the whole library and forgets what was played. */
  reset(): void {
    this.drawPile = this.shuffle([...this.library])
    this.discardPile = []
    this.lastCardId = null
  }

  /** Eligible draw-pile cards, optionally excluding the card just played. */
  private eligibleFromDrawPile(
    stats: PlayerStats,
    blockRepeat: boolean,
  ): GameCard[] {
    return this.drawPile.filter((card) => {
      if (blockRepeat && card.id === this.lastCardId) return false
      return this.isCardEligible(card, stats)
    })
  }

  /** Moves a drawn card to the discard pile and records it as the last played. */
  private commitDraw(card: GameCard): void {
    const index = this.drawPile.indexOf(card)
    if (index !== -1) this.drawPile.splice(index, 1)
    this.discardPile.push(card)
    this.lastCardId = card.id
  }

  /**
   * Folds the discard pile back into the draw pile and reshuffles.
   *
   * Keeps whatever is still in the draw pile — those cards were skipped for
   * being ineligible, not for being played, and may qualify later.
   */
  private recycleDiscardPile(): void {
    if (this.discardPile.length === 0) return
    this.drawPile = this.shuffle([...this.drawPile, ...this.discardPile])
    this.discardPile = []
  }

  /** In-place Fisher-Yates. */
  private shuffle(cards: GameCard[]): GameCard[] {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      const a = cards[i]!
      const b = cards[j]!
      cards[i] = b
      cards[j] = a
    }
    return cards
  }
}
