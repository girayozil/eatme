export type ServingType = 'weight' | 'portion' | 'piece'

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Other'] as const
export type Meal = (typeof MEALS)[number]

/** A menu item. Values are per 100 g, per portion or per piece. */
export interface Food {
  id: string
  name: string
  servingType: ServingType
  caloriesPerUnit: number
  /** null means "not entered", never zero. */
  proteinPerUnit: number | null
  carbsPerUnit: number | null
  fatPerUnit: number | null
  /** Piece foods only, like "cup" or "slice". */
  unitName: string | null
  createdAt: number
  lastUsedAt: number | null
}

/** One logged item. Nutrition is copied at logging time so editing a food never rewrites history. */
export interface DiaryEntry {
  id: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  meal: Meal
  /** Link to a Food, or null for a one-off entry. */
  foodId: string | null
  name: string
  /** Grams, portions or pieces. null for one-offs. */
  amount: number | null
  servingType: ServingType | null
  unitName: string | null
  /** The food's values at logging time, so the amount can be edited later without touching the food. */
  unitCalories: number | null
  unitProtein: number | null
  calories: number
  protein: number | null
  createdAt: number
}

export type Appearance = 'light' | 'dark' | 'auto'

export interface Settings {
  calorieTarget: number
  proteinTarget: number | null
  /** HH:MM, used for the calendar reminder. */
  reminderTime: string
  appearance: Appearance
}

export interface AppData {
  version: 1
  foods: Food[]
  entries: DiaryEntry[]
  /** Day notes keyed by YYYY-MM-DD. */
  notes: Record<string, string>
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  calorieTarget: 2000,
  proteinTarget: null,
  reminderTime: '20:00',
  appearance: 'auto',
}

export function emptyData(): AppData {
  return { version: 1, foods: [], entries: [], notes: {}, settings: { ...DEFAULT_SETTINGS } }
}
