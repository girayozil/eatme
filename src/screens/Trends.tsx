import { useMemo, useState } from 'react'
import { MEALS } from '../lib/types'
import { useData } from '../lib/store'
import { computeTrends, fmtInt, fmtProtein, fromKey, todayKey, type TrendDay } from '../lib/logic'
import { Segmented } from '../components/Controls'

const weekday = (key: string, style: 'short' | 'long' = 'short') => fromKey(key).toLocaleDateString('en-GB', { weekday: style })
const shortDate = (key: string) => fromKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function Trends() {
  const data = useData()
  const [period, setPeriod] = useState<'7' | '30'>('7')
  const today = todayKey()
  const length = Number(period)
  const t = useMemo(() => computeTrends(data.entries, today, length), [data.entries, today, length])
  const [selected, setSelected] = useState(today)
  const sel = t.days.find((d) => d.date === selected) ?? t.days[t.days.length - 1]
  const { calorieTarget, proteinTarget } = data.settings

  const gaps = t.days.filter((d) => d.calories == null)
  const gapText =
    gaps.length === 0
      ? ''
      : gaps.length === length
        ? ''
        : length === 7 && gaps.length <= 2
          ? ` ${gaps.map((d) => weekday(d.date, 'long')).join(' and ')} ${gaps.length === 1 ? 'has' : 'have'} no entries, so ${gaps.length === 1 ? 'it is' : 'they are'} left out of the average.`
          : ` ${gaps.length} days have no entries, so they are left out of the averages.`

  const maxShare = Math.max(...MEALS.map((m) => t.mealShare[m]), 0.0001)

  return (
    <main className="screen">
      <h1 className="screen-title">Trends</h1>

      <Segmented
        label="Period"
        value={period}
        onChange={(p) => {
          setPeriod(p)
          setSelected(today)
        }}
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
        ]}
      />

      <section aria-label="Averages" className="averages">
        <div>
          <div className="num">{t.avgCalories == null ? '–' : fmtInt(t.avgCalories)}</div>
          <div className="lbl">kcal a day</div>
        </div>
        <div>
          <div className="num">{t.avgProtein == null ? '–' : `${fmtInt(t.avgProtein)} g`}</div>
          <div className="lbl">protein a day</div>
        </div>
        <div>
          <div className="num">
            {t.daysLogged} of {length}
          </div>
          <div className="lbl">days logged</div>
        </div>
      </section>

      {t.daysLogged === 0 ? (
        <div className="empty-state">Nothing logged in the last {length} days yet. Your charts appear here once you log some food.</div>
      ) : (
        <>
          <section aria-label="Calories by day">
            <h2 className="section-title">Calories</h2>
            <BarChart
              days={t.days}
              value={(d) => d.calories}
              target={calorieTarget}
              height={150}
              selected={sel.date}
              onSelect={setSelected}
              format={(n) => fmtInt(n)}
              unit="kcal"
              ariaLabel={`Bar chart of calories for the last ${length} days. ${describe(t.days, (d) => d.calories, (n) => fmtInt(n))} Target ${fmtInt(calorieTarget)}.`}
            />
            <p className="small mt8">
              The dashed line is your {fmtInt(calorieTarget)} kcal target.{gapText}
            </p>
          </section>

          <section aria-label="Protein by day">
            <h2 className="section-title">Protein</h2>
            <BarChart
              days={t.days}
              value={(d) => d.protein}
              target={proteinTarget}
              height={110}
              selected={sel.date}
              onSelect={setSelected}
              format={(n) => `${fmtInt(n)} g`}
              unit="protein"
              protein
              ariaLabel={`Bar chart of protein for the last ${length} days. ${describe(t.days, (d) => d.protein, (n) => `${fmtProtein(n)} grams`)}${proteinTarget != null ? ` Target ${fmtInt(proteinTarget)} grams.` : ''}`}
            />
            <p className="small mt8">Protein only counts foods where you entered it.</p>
          </section>

          <section aria-label="Calories by meal">
            <h2 className="section-title">Where your calories come from</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MEALS.map((m) => (
                <div key={m} className="share-row">
                  <div className="lbl">{m}</div>
                  <div className="track">
                    <div style={{ width: `${(t.mealShare[m] / maxShare) * 85}%` }} />
                  </div>
                  <div className="pct">{Math.round(t.mealShare[m] * 100)}%</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function describe(days: TrendDay[], value: (d: TrendDay) => number | null, fmt: (n: number) => string): string {
  return (
    days
      .map((d) => {
        const v = value(d)
        return `${days.length > 7 ? shortDate(d.date) : weekday(d.date, 'long')} ${v == null ? 'not logged' : fmt(v)}`
      })
      .join(', ') + '.'
  )
}

function BarChart({
  days,
  value,
  target,
  height,
  selected,
  onSelect,
  format,
  unit,
  protein,
  ariaLabel,
}: {
  days: TrendDay[]
  value: (d: TrendDay) => number | null
  target: number | null
  height: number
  selected: string
  onSelect: (d: string) => void
  format: (n: number) => string
  unit: string
  protein?: boolean
  ariaLabel: string
}) {
  const dense = days.length > 7
  const values = days.map(value)
  const max = Math.max(target != null ? target * 1.2 : 0, ...values.map((v) => (v ?? 0) * 1.08), protein ? 10 : 100)
  const sel = days.find((d) => d.date === selected)
  const selVal = sel ? value(sel) : null
  return (
    <div>
      {dense && sel && (
        <div className="readout" aria-hidden="true">
          <strong>{shortDate(sel.date)}</strong>
          <span className="muted"> · {selVal == null ? 'nothing logged' : `${format(selVal)}${unit === 'protein' ? ' protein' : ` ${unit}`}`}</span>
        </div>
      )}
      <div role="img" aria-label={ariaLabel}>
        <div className={`chart${protein ? ' protein' : ''}${dense ? ' dense' : ''}`} style={{ height, gap: dense ? 3 : 8 }}>
          {target != null && <div className="target" style={{ bottom: (target / max) * height }} />}
          {days.map((d, i) => {
            const v = values[i]
            return (
              <button
                key={d.date}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="col"
                aria-pressed={d.date === selected}
                onClick={() => onSelect(d.date)}
              >
                {v == null ? <div className="gap" /> : <div className="bar" style={{ height: Math.max(2, (v / max) * height) }} />}
              </button>
            )
          })}
        </div>
        {dense ? (
          <div className="chart-labels" aria-hidden="true" style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: 'none', textAlign: 'left' }} className="day">
              {shortDate(days[0].date)}
            </div>
            <div style={{ flex: 'none', textAlign: 'right' }} className="day">
              Today
            </div>
          </div>
        ) : (
          <div className="chart-labels" aria-hidden="true" style={{ gap: 8 }}>
            {days.map((d, i) => {
              const v = values[i]
              return (
                <div key={d.date} className={d.date === selected ? 'sel' : ''}>
                  <div className="day">{weekday(d.date)}</div>
                  {v == null ? <div className="none">none</div> : <div className="val">{format(v)}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
