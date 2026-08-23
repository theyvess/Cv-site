import type { EventConditions, GameEvent, GameState } from './types.ts'

/** How many recent draws are held back before an event may repeat. */
const REPEAT_COOLDOWN = 5

/** Pure predicate — exported so eligibility can be checked without a deck instance. */
export function matchesConditions(conditions: EventConditions, state: GameState): boolean {
  const { week, money, energy, sanity } = state

  if (conditions.minWeek !== undefined && week < conditions.minWeek) return false
  if (conditions.maxWeek !== undefined && week > conditions.maxWeek) return false
  if (conditions.minMoney !== undefined && money < conditions.minMoney) return false
  if (conditions.maxMoney !== undefined && money > conditions.maxMoney) return false
  if (conditions.minEnergy !== undefined && energy < conditions.minEnergy) return false
  if (conditions.maxEnergy !== undefined && energy > conditions.maxEnergy) return false
  if (conditions.minSanity !== undefined && sanity < conditions.minSanity) return false
  if (conditions.maxSanity !== undefined && sanity > conditions.maxSanity) return false

  return true
}

/**
 * Holds the deck and decides what comes next.
 *
 * Draw order is a weighted random pick over the events whose conditions the
 * current state satisfies, with recently seen events held back so the same
 * card does not come round twice in a row.
 */
export class DeckManager {
  private readonly events: readonly GameEvent[]
  private readonly rng: () => number
  private readonly drawn = new Set<string>()
  private recent: string[] = []

  constructor(events: readonly GameEvent[], rng: () => number = Math.random) {
    this.events = events
    this.rng = rng
  }

  /**
   * The next eligible event, or `null` when the current state gates everything
   * out. Marks the returned event as drawn.
   */
  draw(state: GameState): GameEvent | null {
    const eligible = this.events.filter((event) => this.isEligible(event, state))
    if (eligible.length === 0) return null

    // Prefer cards outside the cooldown window; fall back to the full set when
    // the eligible pool is smaller than the window itself.
    const fresh = eligible.filter((event) => !this.recent.includes(event.id))
    const pool = fresh.length > 0 ? fresh : eligible

    const picked = this.weightedPick(pool)

    this.drawn.add(picked.id)
    this.recent.push(picked.id)
    if (this.recent.length > REPEAT_COOLDOWN) this.recent.shift()

    return picked
  }

  /** How many events could be drawn right now — useful for debugging a stuck deck. */
  eligibleCount(state: GameState): number {
    return this.events.filter((event) => this.isEligible(event, state)).length
  }

  reset(): void {
    this.drawn.clear()
    this.recent = []
  }

  private isEligible(event: GameEvent, state: GameState): boolean {
    if (event.once && this.drawn.has(event.id)) return false
    return matchesConditions(event.conditions, state)
  }

  private weightedPick(pool: readonly GameEvent[]): GameEvent {
    const total = pool.reduce((sum, event) => sum + Math.max(0, event.weight), 0)
    if (total <= 0) return pool[Math.floor(this.rng() * pool.length)] ?? pool[0]

    let roll = this.rng() * total
    for (const event of pool) {
      roll -= Math.max(0, event.weight)
      if (roll <= 0) return event
    }

    return pool[pool.length - 1]
  }
}
