import type {
  Choice,
  DecisionOutcome,
  Effects,
  GameOver,
  GameState,
  StatKey,
} from './types.ts'
import { STAT_KEYS } from './types.ts'

/** Tunable run parameters. Everything balance-related lives here or in the deck JSON. */
export const RULES = {
  startingMoney: 900,
  startingEnergy: 72,
  startingSanity: 80,
  /** Decisions per week — the HUD renders one dot per day. */
  daysPerWeek: 5,
  /** Survive past this week and the run is won. */
  finalWeek: 8,
} as const

/** Bills land, and the weekend gives a little back. Applied on every week rollover. */
export const WEEKLY_UPKEEP: Effects = { money: -240, energy: 22, sanity: 4 }

/** Money is allowed to go negative — that is how a run ends. Moods are not. */
const STAT_BOUNDS: Record<StatKey, { min: number; max: number }> = {
  money: { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY },
  energy: { min: 0, max: 100 },
  sanity: { min: 0, max: 100 },
}

export function statBounds(key: StatKey): { min: number; max: number } {
  return STAT_BOUNDS[key]
}

function freshState(): GameState {
  return {
    week: 1,
    dayInWeek: 1,
    money: RULES.startingMoney,
    energy: RULES.startingEnergy,
    sanity: RULES.startingSanity,
    decisions: 0,
  }
}

/**
 * Owns the run: stat values, the calendar, and the verdict.
 *
 * The scene never mutates state directly — it hands a `Choice` to
 * `applyChoice()` and renders the returned outcome.
 */
export class StateEngine {
  private state: GameState

  constructor(initial?: Partial<GameState>) {
    this.state = { ...freshState(), ...initial }
  }

  /** A copy, so callers cannot mutate the run by accident. */
  getState(): GameState {
    return { ...this.state }
  }

  reset(): void {
    this.state = freshState()
  }

  /**
   * Apply a decision: stat effects, calendar advance, weekly upkeep, and the
   * game-over check — in that order. Game over is evaluated after every
   * decision, so the scene only has to look at `outcome.gameOver`.
   */
  applyChoice(choice: Choice): DecisionOutcome {
    const deltas = this.applyEffects(choice.effects)

    this.state.decisions += 1
    this.state.dayInWeek += 1

    let upkeep: Effects | null = null
    let weekAdvanced = false

    if (this.state.dayInWeek > RULES.daysPerWeek) {
      this.state.dayInWeek = 1
      this.state.week += 1
      weekAdvanced = true
      upkeep = this.applyEffects(WEEKLY_UPKEEP)
      for (const key of STAT_KEYS) {
        const change = upkeep[key]
        if (change !== undefined) deltas[key] = (deltas[key] ?? 0) + change
      }
    }

    return {
      choice,
      deltas,
      upkeep,
      weekAdvanced,
      state: this.getState(),
      gameOver: this.evaluateGameOver(),
    }
  }

  /** Used when the deck cannot produce an eligible card — the copy lives here, not in the scene. */
  outOfEvents(): GameOver {
    return {
      reason: 'outOfEvents',
      title: 'A quiet week',
      message: 'Nothing else is asking anything of you. Take the pause — you earned it.',
    }
  }

  /** Applies effects and reports the change that actually landed after clamping. */
  private applyEffects(effects: Effects): Effects {
    const applied: Effects = {}

    for (const key of STAT_KEYS) {
      const amount = effects[key]
      if (amount === undefined || amount === 0) continue

      const before = this.state[key]
      const bounds = STAT_BOUNDS[key]
      this.state[key] = Math.min(bounds.max, Math.max(bounds.min, before + amount))

      const change = this.state[key] - before
      if (change !== 0) applied[key] = change
    }

    return applied
  }

  private evaluateGameOver(): GameOver | null {
    const { money, energy, sanity, week } = this.state

    if (money < 0) {
      return {
        reason: 'broke',
        title: 'Overdrawn',
        message: 'The card declined at the worst possible moment. That is the run.',
      }
    }

    if (energy <= 0) {
      return {
        reason: 'burnout',
        title: 'Running on empty',
        message: 'You slept through Thursday and most of Friday. The body sent an invoice.',
      }
    }

    if (sanity <= 0) {
      return {
        reason: 'breakdown',
        title: 'Phone face down',
        message: 'You stopped opening the messages. Everything else kept arriving anyway.',
      }
    }

    if (week > RULES.finalWeek) {
      return {
        reason: 'survived',
        title: 'Still standing',
        message: `${RULES.finalWeek} weeks, solvent, and still answering the group chat. Rare.`,
      }
    }

    return null
  }
}
