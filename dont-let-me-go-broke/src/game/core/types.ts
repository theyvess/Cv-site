/**
 * Shared contracts for the game core.
 *
 * Nothing in `core/` imports Phaser: the rules are plain TypeScript so they can
 * be reasoned about (and tested) without a renderer attached.
 */

export type StatKey = 'money' | 'energy' | 'sanity'

export const STAT_KEYS: readonly StatKey[] = ['money', 'energy', 'sanity']

/** A partial set of stat changes, e.g. `{ money: -650, sanity: 6 }`. */
export type Effects = Partial<Record<StatKey, number>>

export type ChoiceSide = 'left' | 'right'

export interface Choice {
  /** Button copy. Kept short — it doubles as the swipe stamp. */
  label: string
  effects: Effects
  /** One line of consequence shown briefly after the decision. */
  result?: string
}

/** Gates that decide whether an event may be drawn in the current state. */
export interface EventConditions {
  minWeek?: number
  maxWeek?: number
  minMoney?: number
  maxMoney?: number
  minEnergy?: number
  maxEnergy?: number
  minSanity?: number
  maxSanity?: number
}

export interface GameEvent {
  id: string
  /** Who the card is from, e.g. "Marcus". */
  sender: string
  /** Avatar initials, derived from `sender` unless the data overrides it. */
  initials: string
  /** Small line under the sender, e.g. "Housing · now". */
  context: string
  prompt: string
  leftChoice: Choice
  rightChoice: Choice
  /** Relative draw likelihood among eligible events. */
  weight: number
  /** When true the event is retired after it has been drawn once. */
  once: boolean
  conditions: EventConditions
}

export interface GameState {
  week: number
  /** 1-based day within the current week. */
  dayInWeek: number
  money: number
  energy: number
  sanity: number
  /** Total decisions taken this run. */
  decisions: number
}

export type GameOverReason = 'broke' | 'burnout' | 'breakdown' | 'survived' | 'outOfEvents'

export interface GameOver {
  reason: GameOverReason
  title: string
  message: string
}

/** Everything the scene needs to render the fallout of one decision. */
export interface DecisionOutcome {
  choice: Choice
  /** Stat changes actually applied, after clamping — choice plus any upkeep. */
  deltas: Effects
  /** Set only on the decision that rolled the week over. */
  upkeep: Effects | null
  weekAdvanced: boolean
  state: GameState
  /** Non-null ends the run. Evaluated after every decision. */
  gameOver: GameOver | null
}
