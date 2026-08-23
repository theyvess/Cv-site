/**
 * Core data contracts for DON'T LET ME GO BROKE.
 *
 * This module is types only — no runtime values — so it erases completely at
 * build time and can be imported from anywhere (engine, UI, content tooling)
 * without pulling in behaviour.
 */

/** Everything that describes a run in progress. */
export interface PlayerStats {
  /** Pounds in the bank. Unclamped: going negative is how you lose. */
  money: number
  /** 0–100. Hits 0 and the run ends in burnout. */
  energy: number
  /** 0–100. Hits 0 and the run ends in a breakdown. */
  sanity: number
  /** 1-based week counter. Advances on rent day. */
  week: number
  /** Sticky memory of past choices, used to gate future cards. */
  flags: string[]
}

/** The stat changes a single choice applies. */
export interface StatModifiers {
  money: number
  energy: number
  sanity: number
  /** Optional flag written into {@link PlayerStats.flags} when this is picked. */
  addFlag?: string
}

/** The change a choice actually produced, after clamping. */
export interface StatDelta {
  money: number
  energy: number
  sanity: number
}

/** One side of a card — the text on the button and what it costs you. */
export interface Choice {
  text: string
  effects: StatModifiers
}

/**
 * Gates on when a card may be drawn. Every field is optional; an omitted field
 * is not a constraint. All present fields must pass for the card to be eligible.
 */
export interface GameCardConditions {
  minMoney?: number
  maxMoney?: number
  minEnergy?: number
  maxEnergy?: number
  minSanity?: number
  maxSanity?: number
  minWeek?: number
  maxWeek?: number
  /** Card only appears once this flag is set. */
  requiresFlag?: string
  /** Card is suppressed once this flag is set. */
  excludeFlag?: string
}

/** A single scenario card: who is asking, what they want, and the two ways out. */
export interface GameCard {
  id: string
  /** Display name of whoever is contacting you. */
  sender: string
  /** Initials rendered inside the avatar circle, e.g. "MW". */
  avatarText: string
  /** Badge label, e.g. "WORK", "FAMILY", "RENT". */
  category: string
  /** The scenario body text. */
  prompt: string
  /** Resolved by swiping left. */
  leftChoice: Choice
  /** Resolved by swiping right. */
  rightChoice: Choice
  /** Omit entirely for a card that is always eligible. */
  conditions?: GameCardConditions
}

/** Which loss condition ended the run. */
export type GameOverCause = 'broke' | 'burnout' | 'breakdown'

/** Result of a game-over check. Safe to read even while the run is alive. */
export interface GameOverState {
  isGameOver: boolean
  /** null while the run is alive. */
  cause: GameOverCause | null
  /** Player-facing cause of death; empty string while the run is alive. */
  message: string
  /** Fully completed weeks. A run that ends in week 1 survived 0. */
  weeksSurvived: number
}

/** Everything the UI needs to animate one resolved turn. */
export interface ChoiceResult {
  /** Change actually applied per stat, after clamping. Excludes rent. */
  deltas: StatDelta
  /** Flag this choice wrote, or null if it wrote none (or it was already set). */
  flagAdded: string | null
  /** True when this turn crossed a week boundary and rent came out. */
  rentDeducted: boolean
  /** Rent charged this turn; 0 when {@link rentDeducted} is false. */
  rentAmount: number
  /** 1-based index of the turn just resolved. */
  turn: number
  /** Snapshot of stats after the choice and any rent settled. */
  stats: PlayerStats
}
