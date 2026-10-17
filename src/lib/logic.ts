import type { DiaryEntry, Food, Meal, ServingType } from './types'
import { MEALS } from './types'

// ---------- Dates ----------

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses a YYYY-MM-DD key as local noon, which keeps day arithmetic safe across DST changes. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function todayKey(now = new Date()): string {
  return toKey(now)
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return toKey(d)
}

export function longDate(key: string): string {
  return fromKey(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function dayTitle(key: string, today = todayKey()): string {
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  return fromKey(key).toLocaleDateString('en-GB', { weekday: 'long' })
}

/** Default meal from the time of day: before 11 breakfast, 11 to 15 lunch, 15 to 21 dinner, otherwise Other. */
export function mealForTime(now = new Date()): Meal {
  const h = now.getHours()
  if (h < 11) return 'Breakfast'
  if (h >= 11 && h < 15) return 'Lunch'
  if (h >= 15 && h < 21) return 'Dinner'
  return 'Other'
}

// ---------- Numbers ----------

const intFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const oneDp = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const twoDp = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })

export const fmtInt = (n: number) => intFmt.format(Math.round(n))
export const fmtProtein = (n: number) => oneDp.format(n)
export const fmtAmount = (n: number) => twoDp.format(n)

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Parses a user-typed number. Empty or invalid gives null. Accepts a comma as decimal separator. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// ---------- Serving types ----------

export const STEP: Record<ServingType, number> = { weight: 1, portion: 0.25, piece: 0.5 }

export const TYPE_TAG: Record<ServingType, string> = { weight: 'Weight', portion: 'Portion', piece: 'Piece' }

export function pluralize(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + 'es'
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'
  return word + 's'
}

export function unitWord(unitName: string | null): string {
  return unitName?.trim() || 'piece'
}

/** "100 g", "portion", "banana". */
export function perLabel(food: Pick<Food, 'servingType' | 'unitName'>): string {
  if (food.servingType === 'weight') return '100 g'
  if (food.servingType === 'portion') return 'portion'
  return unitWord(food.unitName)
}

/** "250 g", "1 banana", "1.5 portions". */
export function amountLabel(amount: number, servingType: ServingType, unitName: string | null): string {
  if (servingType === 'weight') return `${fmtInt(amount)} g`
  const word = servingType === 'portion' ? 'portion' : unitWord(unitName)
  return `${fmtAmount(amount)} ${amount === 1 ? word : pluralize(word)}`
}

export function entryAmountLabel(e: DiaryEntry): string | null {
  if (e.amount == null || e.servingType == null) return null
  return amountLabel(e.amount, e.servingType, e.unitName)
}

/** "105 kcal, 1 g protein per banana" or "590 kcal per 100 g, no protein entered". */
export function foodSummary(food: Food): string {
  const per = perLabel(food)
  if (food.proteinPerUnit == null) return `${fmtInt(food.caloriesPerUnit)} kcal per ${per}, no protein entered`
  return `${fmtInt(food.caloriesPerUnit)} kcal, ${fmtProtein(food.proteinPerUnit)} g protein per ${per}`
}

export function defaultAmount(type: ServingType): number {
  return type === 'weight' ? 100 : 1
}

/** Snaps a stepper value to its step and keeps it at least one step. */
export function snap(amount: number, type: ServingType): number {
  const step = STEP[type]
  return Math.max(step, Math.round(amount / step) * step)
}

// ---------- Calculation ----------

export interface Nutrition {
  calories: number
  protein: number | null
}

/** Calories shown for an amount: per 100 g × grams ÷ 100, or per unit × units. */
export function calcNutrition(food: Pick<Food, 'servingType' | 'caloriesPerUnit' | 'proteinPerUnit'>, amount: number): Nutrition {
  const factor = food.servingType === 'weight' ? amount / 100 : amount
  return {
    calories: Math.round(food.caloriesPerUnit * factor),
    protein: food.proteinPerUnit == null ? null : round1(food.proteinPerUnit * factor),
  }
}

export interface DaySummary {
  calories: number
  protein: number
  proteinCounted: number
  entryCount: number
  byMeal: Record<Meal, DiaryEntry[]>
  mealCalories: Record<Meal, number>
}

export function summarizeDay(entries: DiaryEntry[]): DaySummary {
  const byMeal = Object.fromEntries(MEALS.map((m) => [m, [] as DiaryEntry[]])) as Record<Meal, DiaryEntry[]>
  const mealCalories = Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<Meal, number>
  let calories = 0
  let protein = 0
  let proteinCounted = 0
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt)
  for (const e of sorted) {
    byMeal[e.meal].push(e)
    mealCalories[e.meal] += e.calories
    calories += e.calories
    if (e.protein != null) {
      protein += e.protein
      proteinCounted++
    }
  }
  return { calories, protein: round1(protein), proteinCounted, entryCount: sorted.length, byMeal, mealCalories }
}

// ---------- Trends ----------

export interface TrendDay {
  date: string
  calories: number | null
  protein: number | null
}

export interface Trends {
  days: TrendDay[]
  avgCalories: number | null
  avgProtein: number | null
  daysLogged: number
  mealShare: Record<Meal, number>
}

/** Days with nothing logged are gaps (null) and are left out of the averages. */
export function computeTrends(entries: DiaryEntry[], endKey: string, length: number): Trends {
  const startKey = addDays(endKey, -(length - 1))
  const inRange = entries.filter((e) => e.date >= startKey && e.date <= endKey)
  const byDate = new Map<string, DiaryEntry[]>()
  for (const e of inRange) {
    const list = byDate.get(e.date)
    if (list) list.push(e)
    else byDate.set(e.date, [e])
  }

  const days: TrendDay[] = []
  for (let i = 0; i < length; i++) {
    const date = addDays(startKey, i)
    const list = byDate.get(date)
    if (!list) {
      days.push({ date, calories: null, protein: null })
      continue
    }
    const withProtein = list.filter((e) => e.protein != null)
    days.push({
      date,
      calories: list.reduce((s, e) => s + e.calories, 0),
      protein: withProtein.length ? round1(withProtein.reduce((s, e) => s + (e.protein ?? 0), 0)) : null,
    })
  }

  const logged = days.filter((d) => d.calories != null)
  const proteinDays = days.filter((d) => d.protein != null)
  const mealTotals = Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<Meal, number>
  for (const e of inRange) mealTotals[e.meal] += e.calories
  const total = MEALS.reduce((s, m) => s + mealTotals[m], 0)
  const mealShare = Object.fromEntries(MEALS.map((m) => [m, total ? mealTotals[m] / total : 0])) as Record<Meal, number>

  return {
    days,
    avgCalories: logged.length ? logged.reduce((s, d) => s + (d.calories ?? 0), 0) / logged.length : null,
    avgProtein: proteinDays.length ? proteinDays.reduce((s, d) => s + (d.protein ?? 0), 0) / proteinDays.length : null,
    daysLogged: logged.length,
    mealShare,
  }
}

// ---------- Search and ordering ----------

export function matchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || name.toLowerCase().includes(q)
}

export const byName = (a: Food, b: Food) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

/** Most recently logged first, then alphabetical, so everyday foods sit at the top of the log sheet. */
export const byRecentUse = (a: Food, b: Food) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || byName(a, b)

export function lastAmountFor(entries: DiaryEntry[], foodId: string): number | null {
  let best: DiaryEntry | null = null
  for (const e of entries) {
    if (e.foodId === foodId && e.amount != null && (!best || e.createdAt > best.createdAt)) best = e
  }
  return best?.amount ?? null
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
