import type { DiaryEntry, Food, Meal } from './types'
import { actions } from './store'
import { addDays, calcNutrition, todayKey, uid } from './logic'

const food = (name: string, servingType: Food['servingType'], kcal: number, protein: number | null, unitName: string | null = null): Food => ({
  id: uid(),
  name,
  servingType,
  caloriesPerUnit: kcal,
  proteinPerUnit: protein,
  carbsPerUnit: null,
  fatPerUnit: null,
  unitName,
  createdAt: Date.now(),
  lastUsedAt: null,
})

/** Sample menu and two weeks of entries, matching the design mockups. */
export function loadDemo() {
  const f = {
    banana: food('Banana', 'piece', 105, 1, 'banana'),
    chicken: food('Chicken with mushrooms', 'portion', 320, 38),
    choc: food('Dark chocolate', 'weight', 590, null),
    lasagna: food('Lasagna', 'weight', 160, 8),
    latte: food('Latte', 'piece', 130, 7, 'cup'),
    soup: food('Lentil soup', 'weight', 70, 5),
    porridge: food('Porridge with milk', 'weight', 82, 4),
    rye: food('Rye bread', 'piece', 80, 2.5, 'slice'),
  }
  const today = todayKey()
  const entries: DiaryEntry[] = []
  let t = Date.now() - 20 * 86400000
  const log = (date: string, meal: Meal, item: Food, amount: number) => {
    const n = calcNutrition(item, amount)
    entries.push({
      id: uid(),
      date,
      meal,
      foodId: item.id,
      name: item.name,
      amount,
      servingType: item.servingType,
      unitName: item.unitName,
      unitCalories: item.caloriesPerUnit,
      unitProtein: item.proteinPerUnit,
      calories: n.calories,
      protein: n.protein,
      createdAt: (t += 60000),
    })
  }
  for (let i = 13; i >= 1; i--) {
    if (i === 2 || i === 9) continue
    const d = addDays(today, -i)
    log(d, 'Breakfast', f.porridge, 250 + (i % 3) * 30)
    log(d, 'Breakfast', f.banana, 1)
    log(d, 'Lunch', f.soup, 350)
    log(d, 'Lunch', f.rye, 2)
    log(d, 'Dinner', i % 2 ? f.chicken : f.lasagna, i % 2 ? 1.5 : 400)
    log(d, 'Other', f.latte, 1)
    if (i % 3 === 0) log(d, 'Other', f.choc, 20 + i)
  }
  log(today, 'Breakfast', f.porridge, 250)
  log(today, 'Breakfast', f.banana, 1)
  log(today, 'Lunch', f.soup, 350)
  log(today, 'Lunch', f.rye, 2)
  log(today, 'Other', f.choc, 20)
  log(today, 'Other', f.latte, 1)
  const foods = Object.values(f).map((x) => ({ ...x, lastUsedAt: entries.filter((e) => e.foodId === x.id).at(-1)?.createdAt ?? null }))
  actions.replaceAll({
    version: 1,
    foods,
    entries,
    notes: { [today]: 'Slow morning, hungry by three. The lentil soup was really good, make it again this week.' },
    settings: { calorieTarget: 2000, proteinTarget: 100, reminderTime: '20:00', appearance: 'auto' },
  })
}
