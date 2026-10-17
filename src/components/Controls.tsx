import type { ReactNode } from 'react'
import type { Meal, ServingType } from '../lib/types'
import { MEALS } from '../lib/types'
import { fmtAmount, fmtInt, fmtProtein, parseNum, pluralize, snap, STEP, unitWord, type Nutrition } from '../lib/logic'
import { MinusIcon, PlusIcon } from './Icons'

export function MealChips({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <div className="chips" role="group" aria-label="Meal">
      {MEALS.map((m) => (
        <button key={m} type="button" className="chip" aria-pressed={m === value} onClick={() => onChange(m)}>
          {m}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
}

export function ProteinText({ protein }: { protein: number | null }) {
  if (protein == null) return <span className="muted" style={{ fontStyle: 'italic' }}>no protein entered</span>
  return (
    <>
      <span className="dot" />
      {fmtProtein(protein)} g protein
    </>
  )
}

/** Weight is typed in grams; portions and pieces use a stepper (quarters and halves). */
export function AmountPanel({
  servingType,
  unitName,
  value,
  onChange,
  nutrition,
}: {
  servingType: ServingType
  unitName: string | null
  value: string
  onChange: (v: string) => void
  nutrition: Nutrition | null
}) {
  let control: ReactNode
  if (servingType === 'weight') {
    control = (
      <>
        <label htmlFor="grams" className="field-label" style={{ marginBottom: 6 }}>
          Weight
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="grams"
            className="grams"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
          />
          <span style={{ fontSize: '1.176rem', fontWeight: 600 }}>g</span>
        </div>
      </>
    )
  } else {
    const step = STEP[servingType]
    const n = parseNum(value) ?? step
    const word = servingType === 'portion' ? 'portion' : unitWord(unitName)
    const stepWord = servingType === 'portion' ? 'A quarter' : 'Half a'
    const label = pluralize(word)
    control = (
      <>
        <div className="field-label" style={{ marginBottom: 6 }} id="amount-label">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </div>
        <div className="stepper" role="group" aria-labelledby="amount-label">
          <button
            type="button"
            aria-label={`${stepWord} ${word} less`}
            disabled={n <= step}
            onClick={() => onChange(String(snap(n - step, servingType)))}
          >
            <MinusIcon />
          </button>
          <div className="value" aria-live="polite">
            {fmtAmount(n)}
          </div>
          <button type="button" className="plus" aria-label={`${stepWord} ${word} more`} onClick={() => onChange(String(snap(n + step, servingType)))}>
            <PlusIcon />
          </button>
        </div>
        <div className="small mt6">Goes up in {servingType === 'portion' ? 'quarters' : 'halves'}</div>
      </>
    )
  }
  return (
    <div className="amount-panel">
      <div>{control}</div>
      <div className="live" aria-live="polite">
        <div className="kcal">{nutrition ? fmtInt(nutrition.calories) : '–'} kcal</div>
        <div className="prot">
          <ProteinText protein={nutrition?.protein ?? null} />
        </div>
      </div>
    </div>
  )
}

/** A labelled number input with a unit after it. */
export function NumberField({
  id,
  label,
  optional,
  unit,
  value,
  onChange,
  decimal,
  placeholder,
}: {
  id: string
  label: string
  optional?: boolean
  unit: string
  value: string
  onChange: (v: string) => void
  decimal?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label} {optional && <span className="opt">(optional)</span>}
      </label>
      <div className="with-unit">
        <input
          id={id}
          className="input big"
          inputMode={decimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '').slice(0, 7))}
        />
        <span className="unit">{unit}</span>
      </div>
    </div>
  )
}
