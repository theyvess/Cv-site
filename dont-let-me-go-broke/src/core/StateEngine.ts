import type {
  ChoiceResult,
  GameOverState,
  PlayerStats,
  StatModifiers,
} from './types.ts'

/** Stats the player opens a run with (see CLAUDE.md). */
export const STARTING_STATS: Readonly<Omit<PlayerStats, 'flags'>> = {
  money: 1000,
  energy: 100,
  sanity: 100,
  week: 1,
}

/** Rent comes out once a week. */
export const RENT_AMOUNT = 250

/** Turns in a week — rent lands on every 4th resolved choice. */
export const TURNS_PER_WEEK = 4

/** Energy and sanity live in this range; money deliberately does not. */
export const STAT_MIN = 0
export const STAT_MAX = 100

/** Debt past this point ends the run. */
export const BANKRUPTCY_THRESHOLD = -500

const CAUSE_MESSAGES = {
  broke: 'You ran out of money and the overdraft ran out of patience.',
  burnout: 'You ran out of energy. You are asleep and not getting up.',
  breakdown: 'You ran out of sanity. You have completely lost the plot.',
} as const

/**
 * Coerces a value from card JSON into a usable number.
 *
 * Card content is authored by hand and loaded at runtime, so a missing key or a
 * typo'd string must not be able to turn a stat into NaN — once NaN is in the
 * stats every comparison silently goes false and the run can never end.
 */
function toFiniteNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Clamps to the 0–100 stat band. */
function clampStat(value: number): number {
  return Math.min(Math.max(value, STAT_MIN), STAT_MAX)
}

/** Builds a fresh stats object. Always returns a new flags array. */
export function createStartingStats(
  overrides: Partial<PlayerStats> = {},
): PlayerStats {
  return {
    money: overrides.money ?? STARTING_STATS.money,
    energy: overrides.energy ?? STARTING_STATS.energy,
    sanity: overrides.sanity ?? STARTING_STATS.sanity,
    week: overrides.week ?? STARTING_STATS.week,
    flags: overrides.flags ? [...overrides.flags] : [],
  }
}

/**
 * Owns the player's stats and the rules that move them.
 *
 * Headless by design: no Phaser, no DOM, no timers. The UI drives it one call
 * at a time and reads the returned {@link ChoiceResult} to decide what to
 * animate.
 */
export class StateEngine {
  private stats: PlayerStats
  private turnsTaken: number

  constructor(initial: Partial<PlayerStats> = {}) {
    this.stats = createStartingStats(initial)
    this.turnsTaken = 0
  }

  /**
   * Current stats as a defensive copy — callers cannot reach in and mutate the
   * run by holding onto the returned object.
   */
  getStats(): PlayerStats {
    return { ...this.stats, flags: [...this.stats.flags] }
  }

  /** Choices resolved so far this run. */
  getTurnsTaken(): number {
    return this.turnsTaken
  }

  /** Turns remaining until the next rent day. */
  getTurnsUntilRent(): number {
    return TURNS_PER_WEEK - (this.turnsTaken % TURNS_PER_WEEK)
  }

  /** Whether a flag has been set this run. */
  hasFlag(flag: string): boolean {
    return this.stats.flags.includes(flag)
  }

  /**
   * Resolves one choice: applies its stat deltas, records any flag, then
   * settles rent if this turn closed out a week.
   *
   * Energy and sanity are clamped to 0–100, so the reported deltas are what
   * actually landed — spending 20 energy at 10 energy reports -10, not -20.
   * Money is not clamped in either direction; debt is a loss condition, not a
   * floor. Rent is kept out of `deltas` and reported separately so the UI can
   * animate the choice and the rent hit as two distinct beats.
   */
  applyChoiceEffects(effects: StatModifiers): ChoiceResult {
    const before = {
      money: this.stats.money,
      energy: this.stats.energy,
      sanity: this.stats.sanity,
    }

    this.stats.money = before.money + toFiniteNumber(effects.money)
    this.stats.energy = clampStat(before.energy + toFiniteNumber(effects.energy))
    this.stats.sanity = clampStat(before.sanity + toFiniteNumber(effects.sanity))

    let flagAdded: string | null = null
    if (effects.addFlag && !this.stats.flags.includes(effects.addFlag)) {
      this.stats.flags.push(effects.addFlag)
      flagAdded = effects.addFlag
    }

    this.turnsTaken += 1

    const rentDeducted = this.turnsTaken % TURNS_PER_WEEK === 0
    if (rentDeducted) {
      this.stats.week += 1
      this.stats.money -= RENT_AMOUNT
    }

    return {
      deltas: {
        money: this.stats.money - before.money + (rentDeducted ? RENT_AMOUNT : 0),
        energy: this.stats.energy - before.energy,
        sanity: this.stats.sanity - before.sanity,
      },
      flagAdded,
      rentDeducted,
      rentAmount: rentDeducted ? RENT_AMOUNT : 0,
      turn: this.turnsTaken,
      stats: this.getStats(),
    }
  }

  /**
   * Evaluates the loss conditions from CLAUDE.md: money at or below -£500,
   * energy at 0, sanity at 0.
   *
   * Checked in that order, so a turn that trips more than one reports money
   * first. Safe to call at any time; returns `isGameOver: false` while alive.
   */
  checkGameOver(): GameOverState {
    const weeksSurvived = Math.max(0, this.stats.week - 1)

    if (this.stats.money <= BANKRUPTCY_THRESHOLD) {
      return {
        isGameOver: true,
        cause: 'broke',
        message: CAUSE_MESSAGES.broke,
        weeksSurvived,
      }
    }
    if (this.stats.energy <= STAT_MIN) {
      return {
        isGameOver: true,
        cause: 'burnout',
        message: CAUSE_MESSAGES.burnout,
        weeksSurvived,
      }
    }
    if (this.stats.sanity <= STAT_MIN) {
      return {
        isGameOver: true,
        cause: 'breakdown',
        message: CAUSE_MESSAGES.breakdown,
        weeksSurvived,
      }
    }

    return { isGameOver: false, cause: null, message: '', weeksSurvived }
  }

  /** Returns the engine to a fresh run. */
  reset(initial: Partial<PlayerStats> = {}): void {
    this.stats = createStartingStats(initial)
    this.turnsTaken = 0
  }
}
