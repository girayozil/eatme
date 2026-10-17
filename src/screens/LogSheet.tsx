import { useMemo, useRef, useState } from 'react'
import type { DiaryEntry, Food, Meal } from '../lib/types'
import { actions, useData } from '../lib/store'
import {
  byRecentUse,
  calcNutrition,
  defaultAmount,
  fmtInt,
  lastAmountFor,
  matchesQuery,
  parseNum,
  perLabel,
  TYPE_TAG,
  uid,
} from '../lib/logic'
import { Sheet } from '../components/Sheet'
import { AmountPanel, MealChips, NumberField, Switch } from '../components/Controls'
import { CheckIcon, ChevronLeft, ChevronRight, PlusIcon } from '../components/Icons'

interface Props {
  open: boolean
  date: string
  meal: Meal
  onClose: () => void
  onExited: () => void
  onAddFood: () => void
}

export function LogSheet({ open, date, meal: initialMeal, onClose, onExited, onAddFood }: Props) {
  const data = useData()
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [mode, setMode] = useState<'menu' | 'quick'>('menu')
  const [query, setQuery] = useState('')
  const [foodId, setFoodId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [quickAdded, setQuickAdded] = useState(0)

  const food = data.foods.find((f) => f.id === foodId) ?? null
  const foods = useMemo(() => data.foods.filter((f) => matchesQuery(f.name, query)).sort(byRecentUse), [data.foods, query])
  const amountNum = parseNum(amount)
  const nutrition = food && amountNum ? calcNutrition(food, amountNum) : null

  const choose = (f: Food) => {
    setFoodId(f.id)
    setAmount(String(lastAmountFor(data.entries, f.id) ?? defaultAmount(f.servingType)))
  }

  const addFromMenu = () => {
    if (!food || !amountNum || !nutrition) return
    const entry: DiaryEntry = {
      id: uid(),
      date,
      meal,
      foodId: food.id,
      name: food.name,
      amount: amountNum,
      servingType: food.servingType,
      unitName: food.unitName,
      unitCalories: food.caloriesPerUnit,
      unitProtein: food.proteinPerUnit,
      calories: nutrition.calories,
      protein: nutrition.protein,
      createdAt: Date.now(),
    }
    actions.addEntry(entry)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title="Log food"
      closeLabel={quickAdded ? 'Done' : 'Cancel'}
      plainFooter
      footer={
        mode === 'menu' ? (
          <>
            {food && (
              <AmountPanel
                key={food.id}
                servingType={food.servingType}
                unitName={food.unitName}
                value={amount}
                onChange={setAmount}
                nutrition={nutrition}
              />
            )}
            <button type="button" className="primary-btn" disabled={!food || !amountNum} onClick={addFromMenu}>
              {food ? `Add to ${meal}` : 'Choose a food'}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="eyebrow">Meal</div>
      <div className="mt8">
        <MealChips value={meal} onChange={setMeal} />
      </div>

      {mode === 'menu' ? (
        <>
          <div className="eyebrow mt16">Food</div>
          <label htmlFor="log-search" className="sr-only">
            Search your menu
          </label>
          <input
            id="log-search"
            type="search"
            className="input search mt8"
            placeholder="Search your menu"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt6" style={{ display: 'flex', flexDirection: 'column' }}>
            {foods.map((f) => (
              <button key={f.id} type="button" className="food-row" aria-pressed={f.id === foodId} onClick={() => choose(f)}>
                <span className="main">
                  <span className="name">{f.name}</span>
                  <span className="sub">
                    {fmtInt(f.caloriesPerUnit)} kcal per {perLabel(f)}
                  </span>
                </span>
                <span className="tag">{TYPE_TAG[f.servingType]}</span>
                {f.id === foodId && (
                  <span style={{ color: 'var(--accent)', display: 'flex' }}>
                    <CheckIcon />
                  </span>
                )}
              </button>
            ))}
            {data.foods.length === 0 && (
              <div className="empty-state">
                Your menu is empty. Add the foods you eat often and logging them takes a few taps.
                <button type="button" className="secondary-btn mt12" onClick={onAddFood}>
                  Add a food to your menu
                </button>
              </div>
            )}
            {data.foods.length > 0 && foods.length === 0 && <div className="empty-state">Nothing on your menu matches “{query.trim()}”.</div>}
          </div>
          <button type="button" className="dashed-row mt8" onClick={() => setMode('quick')}>
            <PlusIcon size={20} />
            <span>Not on your menu? Enter it yourself</span>
            <span style={{ flex: 'none', color: 'var(--muted)', display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
        </>
      ) : (
        <QuickEntry
          date={date}
          meal={meal}
          initialName={query.trim()}
          onBack={() => setMode('menu')}
          onAdded={() => setQuickAdded((n) => n + 1)}
        />
      )}
    </Sheet>
  )
}

/** For restaurant meals: name, calories and optional protein. Each item is entered separately. */
function QuickEntry({
  date,
  meal,
  initialName,
  onBack,
  onAdded,
}: {
  date: string
  meal: Meal
  initialName: string
  onBack: () => void
  onAdded: () => void
}) {
  const data = useData()
  const [name, setName] = useState(initialName)
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [save, setSave] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const already = data.entries.filter((e) => e.date === date && e.meal === meal).sort((a, b) => a.createdAt - b.createdAt)
  const kcalNum = parseNum(kcal)
  const proteinNum = parseNum(protein)
  const valid = name.trim() !== '' && kcalNum != null

  const add = () => {
    if (!valid || kcalNum == null) return
    const now = Date.now()
    const cleanName = name.trim()
    const calories = Math.round(kcalNum)
    let foodId: string | null = null
    if (save) {
      // Saved one-offs become a normal piece food at the typed calories.
      foodId = uid()
      actions.addFood({
        id: foodId,
        name: cleanName,
        servingType: 'piece',
        caloriesPerUnit: calories,
        proteinPerUnit: proteinNum,
        carbsPerUnit: null,
        fatPerUnit: null,
        unitName: null,
        createdAt: now,
        lastUsedAt: now,
      })
    }
    actions.addEntry({
      id: uid(),
      date,
      meal,
      foodId,
      name: cleanName,
      amount: save ? 1 : null,
      servingType: save ? 'piece' : null,
      unitName: null,
      unitCalories: save ? calories : null,
      unitProtein: save ? proteinNum : null,
      calories,
      protein: proteinNum,
      createdAt: now,
    })
    setName('')
    setKcal('')
    setProtein('')
    setSave(false)
    onAdded()
    nameRef.current?.focus()
  }

  return (
    <>
      <button type="button" className="back-link mt6" onClick={onBack}>
        <ChevronLeft size={22} />
        Back to your menu
      </button>
      <div className="eyebrow mt4">Enter it yourself</div>
      {already.length > 0 && (
        <div className="info-strip mt8" aria-live="polite">
          <strong>Already added to {meal}:</strong> {already.map((e) => `${e.name}, ${fmtInt(e.calories)} kcal`).join('; ')}
        </div>
      )}

      <label htmlFor="quick-name" className="field-label mt16">
        What did you eat?
      </label>
      <input
        id="quick-name"
        ref={nameRef}
        className="input mt6"
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="next"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="input-row mt16">
        <NumberField id="quick-kcal" label="Calories" unit="kcal" value={kcal} onChange={setKcal} />
        <NumberField id="quick-protein" label="Protein" optional unit="g" decimal placeholder="-" value={protein} onChange={setProtein} />
      </div>
      <p className="small mt8">Use the number on the restaurant's menu or website for the whole thing you ate.</p>

      <div className="toggle-row mt12">
        <span className="text">
          <span style={{ fontWeight: 600 }}>Also save to my menu</span>
          <span className="small">Leave off for one-off meals</span>
        </span>
        <Switch checked={save} onChange={setSave} label="Also save to my menu" />
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" className="primary-btn mt16" disabled={!valid} onClick={add}>
        Add to {meal}
      </button>
    </>
  )
}
