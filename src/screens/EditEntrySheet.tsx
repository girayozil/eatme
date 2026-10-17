import { useState } from 'react'
import type { DiaryEntry, Meal } from '../lib/types'
import { actions } from '../lib/store'
import { calcNutrition, fmtAmount, fmtProtein, parseNum } from '../lib/logic'
import { Sheet } from '../components/Sheet'
import { AmountPanel, MealChips, NumberField } from '../components/Controls'

interface Props {
  open: boolean
  entry: DiaryEntry
  onClose: () => void
  onExited: () => void
  onDeleted: (entry: DiaryEntry) => void
}

/** Edit or remove a logged item. Uses the numbers stored on the entry, never the current menu food. */
export function EditEntrySheet({ open, entry, onClose, onExited, onDeleted }: Props) {
  const scalable = entry.amount != null && entry.servingType != null && entry.unitCalories != null
  const [meal, setMeal] = useState<Meal>(entry.meal)
  const [amount, setAmount] = useState(entry.amount != null ? String(entry.amount) : '')
  const [name, setName] = useState(entry.name)
  const [kcal, setKcal] = useState(String(entry.calories))
  const [protein, setProtein] = useState(entry.protein != null ? fmtProtein(entry.protein).replace(/,/g, '') : '')

  const amountNum = parseNum(amount)
  const nutrition =
    scalable && amountNum
      ? calcNutrition({ servingType: entry.servingType!, caloriesPerUnit: entry.unitCalories!, proteinPerUnit: entry.unitProtein }, amountNum)
      : null
  const kcalNum = parseNum(kcal)
  const valid = scalable ? !!amountNum : name.trim() !== '' && kcalNum != null

  const save = () => {
    if (!valid) return
    if (scalable && nutrition) {
      actions.updateEntry(entry.id, { meal, amount: amountNum, calories: nutrition.calories, protein: nutrition.protein })
    } else {
      actions.updateEntry(entry.id, { meal, name: name.trim(), calories: Math.round(kcalNum ?? 0), protein: parseNum(protein) })
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={scalable ? entry.name : 'Edit entry'}
      plainFooter
      footer={
        <>
          {scalable && (
            <AmountPanel servingType={entry.servingType!} unitName={entry.unitName} value={amount} onChange={setAmount} nutrition={nutrition} />
          )}
          <button type="button" className="primary-btn" disabled={!valid} onClick={save}>
            Save
          </button>
          <button
            type="button"
            className="secondary-btn danger"
            onClick={() => {
              actions.deleteEntry(entry.id)
              onDeleted(entry)
              onClose()
            }}
          >
            Remove from diary
          </button>
        </>
      }
    >
      <div className="eyebrow">Meal</div>
      <div className="mt8">
        <MealChips value={meal} onChange={setMeal} />
      </div>

      {scalable ? (
        <p className="small mt16">
          Logged at{' '}
          {entry.servingType === 'weight'
            ? `${fmtAmount(entry.unitCalories!)} kcal per 100 g`
            : `${fmtAmount(entry.unitCalories!)} kcal each`}
          {entry.unitProtein != null ? `, ${fmtProtein(entry.unitProtein)} g protein` : ', no protein entered'}. Changing the menu food later does not
          change this entry.
        </p>
      ) : (
        <>
          <label htmlFor="edit-name" className="field-label mt16">
            What did you eat?
          </label>
          <input id="edit-name" className="input mt6" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="input-row mt16">
            <NumberField id="edit-kcal" label="Calories" unit="kcal" value={kcal} onChange={setKcal} />
            <NumberField id="edit-protein" label="Protein" optional unit="g" decimal placeholder="-" value={protein} onChange={setProtein} />
          </div>
        </>
      )}
    </Sheet>
  )
}
