import { useState } from 'react'
import type { Food, ServingType } from '../lib/types'
import { actions } from '../lib/store'
import { parseNum, uid, unitWord } from '../lib/logic'
import { Sheet } from '../components/Sheet'
import { NumberField, Segmented } from '../components/Controls'
import { ChevronRight } from '../components/Icons'

interface Props {
  open: boolean
  /** Editing an existing food, or null to add a new one. */
  food: Food | null
  onClose: () => void
  onExited: () => void
  onDelete: (food: Food) => void
}

const numStr = (n: number | null) => (n == null ? '' : String(n))

export function FoodSheet({ open, food, onClose, onExited, onDelete }: Props) {
  const [name, setName] = useState(food?.name ?? '')
  const [type, setType] = useState<ServingType>(food?.servingType ?? 'weight')
  const [unitName, setUnitName] = useState(food?.unitName ?? '')
  const [kcal, setKcal] = useState(numStr(food?.caloriesPerUnit ?? null))
  const [protein, setProtein] = useState(numStr(food?.proteinPerUnit ?? null))
  const [carbs, setCarbs] = useState(numStr(food?.carbsPerUnit ?? null))
  const [fat, setFat] = useState(numStr(food?.fatPerUnit ?? null))
  const [more, setMore] = useState(food != null && (food.carbsPerUnit != null || food.fatPerUnit != null))

  const kcalNum = parseNum(kcal)
  const valid = name.trim() !== '' && kcalNum != null
  const per = type === 'weight' ? 'per 100 g' : type === 'portion' ? 'per portion' : `per ${unitWord(unitName)}`

  const submit = () => {
    if (!valid || kcalNum == null) return
    const fields = {
      name: name.trim(),
      caloriesPerUnit: kcalNum,
      proteinPerUnit: parseNum(protein),
      carbsPerUnit: parseNum(carbs),
      fatPerUnit: parseNum(fat),
      unitName: type === 'piece' && unitName.trim() ? unitName.trim().toLowerCase() : null,
    }
    if (food) actions.updateFood(food.id, fields)
    else actions.addFood({ id: uid(), servingType: type, createdAt: Date.now(), lastUsedAt: null, ...fields })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={food ? 'Edit food' : 'Add food'}
      plainFooter
      footer={
        <>
          <button type="button" className="primary-btn" disabled={!valid} onClick={submit}>
            {food ? 'Save changes' : 'Add to menu'}
          </button>
          {food && (
            <button type="button" className="secondary-btn danger" onClick={() => onDelete(food)}>
              Delete from menu
            </button>
          )}
        </>
      }
    >
      <label htmlFor="food-name" className="field-label">
        Name
      </label>
      <input
        id="food-name"
        className="input mt6"
        autoComplete="off"
        autoCapitalize="sentences"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="field-label mt18">How do you measure it?</div>
      <div className="mt6">
        <Segmented
          label="Serving type"
          value={type}
          onChange={setType}
          disabled={food != null}
          options={[
            { value: 'weight', label: 'By weight' },
            { value: 'portion', label: 'By portion' },
            { value: 'piece', label: 'By piece' },
          ]}
        />
      </div>
      <p className="small mt6">
        {food
          ? 'This is fixed once a food is created. To log it another way, add it again (for example “Lasagna” by weight and “Lasagna slice” by piece).'
          : 'Weight: you enter grams, like 350 g of lasagna. Portion: one serving you eat in one go, like a bowl of soup. Piece: things you count, like 2 bananas.'}
      </p>

      {type === 'piece' && (
        <>
          <label htmlFor="food-unit" className="field-label mt18">
            What is one piece called? <span className="opt">(optional)</span>
          </label>
          <input
            id="food-unit"
            className="input mt6"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="cup, slice, banana"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value.slice(0, 24))}
          />
        </>
      )}

      <div className="input-row mt18">
        <NumberField id="food-kcal" label="Calories" unit="kcal" decimal value={kcal} onChange={setKcal} />
        <NumberField id="food-protein" label="Protein" optional unit="g" decimal placeholder="-" value={protein} onChange={setProtein} />
      </div>
      <p className="small mt8">Both are {per}. Leave protein blank if you don't know it. It counts as not entered, not as zero.</p>

      <button type="button" className="disclosure mt18" aria-expanded={more} onClick={() => setMore(!more)}>
        <span>More nutrients</span>
        <span className="hint">
          Carbs and fat
          <ChevronRight size={20} />
        </span>
      </button>
      {more && (
        <div className="input-row mt12">
          <NumberField id="food-carbs" label="Carbs" optional unit="g" decimal placeholder="-" value={carbs} onChange={setCarbs} />
          <NumberField id="food-fat" label="Fat" optional unit="g" decimal placeholder="-" value={fat} onChange={setFat} />
        </div>
      )}
    </Sheet>
  )
}
