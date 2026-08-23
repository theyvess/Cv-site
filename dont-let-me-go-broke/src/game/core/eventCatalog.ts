import rawEvents from '../data/events.json'
import type { Choice, EventConditions, Effects, GameEvent, StatKey } from './types.ts'
import { STAT_KEYS } from './types.ts'

/**
 * Turns the authored JSON into typed, fully-defaulted `GameEvent`s.
 *
 * Validation happens once at load so a typo in the deck fails loudly here
 * rather than as `undefined` halfway through a run.
 */

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(source: Json, key: string, where: string): string {
  const value = source[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`events.json: ${where} is missing a non-empty "${key}"`)
  }
  return value
}

/** "Marcus Bell" -> "MB", "Depop" -> "DE". */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function parseEffects(value: unknown, where: string): Effects {
  if (value === undefined) return {}
  if (!isObject(value)) throw new Error(`events.json: ${where} has a non-object "effects"`)

  const effects: Effects = {}
  for (const [key, amount] of Object.entries(value)) {
    if (!STAT_KEYS.includes(key as StatKey)) {
      throw new Error(`events.json: ${where} references unknown stat "${key}"`)
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`events.json: ${where} has a non-numeric effect for "${key}"`)
    }
    effects[key as StatKey] = amount
  }
  return effects
}

function parseChoice(value: unknown, where: string): Choice {
  if (!isObject(value)) throw new Error(`events.json: ${where} is missing`)

  const result = value.result
  if (result !== undefined && typeof result !== 'string') {
    throw new Error(`events.json: ${where} has a non-string "result"`)
  }

  return {
    label: requireString(value, 'label', where),
    effects: parseEffects(value.effects, where),
    result,
  }
}

function parseConditions(value: unknown, where: string): EventConditions {
  if (value === undefined) return {}
  if (!isObject(value)) throw new Error(`events.json: ${where} has a non-object "conditions"`)

  const allowed = [
    'minWeek', 'maxWeek',
    'minMoney', 'maxMoney',
    'minEnergy', 'maxEnergy',
    'minSanity', 'maxSanity',
  ]

  const conditions: EventConditions = {}
  for (const [key, bound] of Object.entries(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`events.json: ${where} has unknown condition "${key}"`)
    }
    if (typeof bound !== 'number' || !Number.isFinite(bound)) {
      throw new Error(`events.json: ${where} has a non-numeric condition "${key}"`)
    }
    conditions[key as keyof EventConditions] = bound
  }
  return conditions
}

export function parseEvents(raw: unknown): GameEvent[] {
  if (!Array.isArray(raw)) throw new Error('events.json: expected an array of events')

  const seen = new Set<string>()

  return raw.map((entry, index) => {
    const where = `event #${index}`
    if (!isObject(entry)) throw new Error(`events.json: ${where} is not an object`)

    const id = requireString(entry, 'id', where)
    if (seen.has(id)) throw new Error(`events.json: duplicate event id "${id}"`)
    seen.add(id)

    const sender = requireString(entry, 'sender', `${where} (${id})`)
    const initials = typeof entry.initials === 'string' && entry.initials.trim() !== ''
      ? entry.initials.toUpperCase()
      : initialsFrom(sender)

    return {
      id,
      sender,
      initials,
      context: requireString(entry, 'context', `${where} (${id})`),
      prompt: requireString(entry, 'prompt', `${where} (${id})`),
      leftChoice: parseChoice(entry.leftChoice, `${id}.leftChoice`),
      rightChoice: parseChoice(entry.rightChoice, `${id}.rightChoice`),
      weight: typeof entry.weight === 'number' && entry.weight > 0 ? entry.weight : 1,
      once: entry.once === true,
      conditions: parseConditions(entry.conditions, id),
    }
  })
}

/** The deck the game ships with. */
export const EVENT_DECK: GameEvent[] = parseEvents(rawEvents)
