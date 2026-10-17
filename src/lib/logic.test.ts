import { describe, expect, it } from 'vitest'
import type { DiaryEntry } from './types'
import { addDays, amountLabel, calcNutrition, computeTrends, foodSummary, mealForTime, parseNum, pluralize, snap, summarizeDay } from './logic'
import { diaryCsv, reminderIcs } from './files'
import { emptyData } from './types'

const entry = (p: Partial<DiaryEntry>): DiaryEntry => ({
  id: Math.random().toString(),
  date: '2026-10-17',
  meal: 'Lunch',
  foodId: null,
  name: 'x',
  amount: null,
  servingType: null,
  unitName: null,
  unitCalories: null,
  unitProtein: null,
  calories: 100,
  protein: null,
  createdAt: 1,
  ...p,
})

describe('logging rules', () => {
  it('weight is per 100 g', () => {
    expect(calcNutrition({ servingType: 'weight', caloriesPerUnit: 70, proteinPerUnit: 5 }, 350)).toEqual({ calories: 245, protein: 17.5 })
  })
  it('portion and piece multiply, missing protein stays missing', () => {
    expect(calcNutrition({ servingType: 'portion', caloriesPerUnit: 320, proteinPerUnit: 38 }, 1.5)).toEqual({ calories: 480, protein: 57 })
    expect(calcNutrition({ servingType: 'piece', caloriesPerUnit: 590, proteinPerUnit: null }, 2)).toEqual({ calories: 1180, protein: null })
  })
  it('steppers snap to quarters and halves, never below one step', () => {
    expect(snap(1.3, 'portion')).toBe(1.25)
    expect(snap(0, 'piece')).toBe(0.5)
  })
  it('guesses the meal from the time of day', () => {
    const at = (h: number) => mealForTime(new Date(2026, 9, 17, h))
    expect([at(7), at(10), at(11), at(14), at(15), at(20), at(21), at(23)]).toEqual([
      'Breakfast', 'Breakfast', 'Lunch', 'Lunch', 'Dinner', 'Dinner', 'Other', 'Other',
    ])
  })
})

describe('labels', () => {
  it('formats amounts and plurals', () => {
    expect(amountLabel(250, 'weight', null)).toBe('250 g')
    expect(amountLabel(1, 'piece', 'banana')).toBe('1 banana')
    expect(amountLabel(2, 'piece', 'glass')).toBe('2 glasses')
    expect(amountLabel(1.5, 'portion', null)).toBe('1.5 portions')
    expect(pluralize('berry')).toBe('berries')
  })
  it('summarises foods like the mockup', () => {
    const base = { id: '', name: '', carbsPerUnit: null, fatPerUnit: null, createdAt: 0, lastUsedAt: null }
    expect(foodSummary({ ...base, servingType: 'portion', caloriesPerUnit: 320, proteinPerUnit: 38, unitName: null })).toBe(
      '320 kcal, 38 g protein per portion',
    )
    expect(foodSummary({ ...base, servingType: 'weight', caloriesPerUnit: 590, proteinPerUnit: null, unitName: null })).toBe(
      '590 kcal per 100 g, no protein entered',
    )
  })
  it('parses typed numbers', () => {
    expect(parseNum('')).toBeNull()
    expect(parseNum('2,5')).toBe(2.5)
    expect(parseNum('abc')).toBeNull()
  })
})

describe('totals', () => {
  it('counts protein only from entries that have it', () => {
    const s = summarizeDay([entry({ protein: 10 }), entry({ protein: null }), entry({ protein: 5, meal: 'Dinner' })])
    expect(s.calories).toBe(300)
    expect(s.protein).toBe(15)
    expect(s.proteinCounted).toBe(2)
    expect(s.entryCount).toBe(3)
    expect(s.mealCalories.Lunch).toBe(200)
  })
  it('leaves empty days out of trend averages', () => {
    const end = '2026-10-17'
    const t = computeTrends(
      [entry({ date: end, calories: 1000, protein: 50 }), entry({ date: addDays(end, -2), calories: 2000 }), entry({ date: '2026-01-01' })],
      end,
      7,
    )
    expect(t.days).toHaveLength(7)
    expect(t.daysLogged).toBe(2)
    expect(t.avgCalories).toBe(1500)
    expect(t.avgProtein).toBe(50)
    expect(t.days[5].calories).toBeNull()
  })
  it('date arithmetic crosses month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
  })
})

describe('files', () => {
  it('escapes CSV and includes notes', () => {
    const d = emptyData()
    d.entries = [entry({ name: 'Soup, "best"', calories: 245 })]
    d.notes = { '2026-10-17': 'Good day', '2026-10-16': 'No food' }
    const csv = diaryCsv(d)
    expect(csv).toContain('"Soup, ""best"""')
    expect(csv).toContain('Good day')
    expect(csv).toContain('2026-10-16,,,,,,,,No food')
  })
  it('builds a daily repeating calendar reminder', () => {
    const ics = reminderIcs('20:00', 'https://example.com/', new Date(2026, 9, 17, 9))
    expect(ics).toContain('DTSTART:20261017T200000')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('BEGIN:VALARM')
  })
})
