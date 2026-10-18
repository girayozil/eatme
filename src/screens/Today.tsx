import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiaryEntry, Meal } from '../lib/types'
import { MEALS } from '../lib/types'
import { actions, ensureDay, useData } from '../lib/store'
import { addDays, dayTitle, entryAmountLabel, fmtInt, fmtProtein, longDate, summarizeDay, todayKey } from '../lib/logic'
import { ChevronLeft, ChevronRight, CloseIcon, PlusIcon, SettingsIcon } from '../components/Icons'
import { ProteinText } from '../components/Controls'

interface Props {
  date: string
  setDate: (d: string) => void
  onSettings: () => void
  onLog: (meal: Meal) => void
  onEdit: (entry: DiaryEntry) => void
}

export function Today({ date, setDate, onSettings, onLog, onEdit }: Props) {
  const data = useData()
  const today = todayKey()
  useEffect(() => ensureDay(date), [date])
  const dayEntries = useMemo(() => data.entries.filter((e) => e.date === date), [data.entries, date])
  const s = summarizeDay(dayEntries)
  const target = data.settings.calorieTarget
  const proteinTarget = data.settings.proteinTarget
  const over = s.calories > target
  const left = target - s.calories

  return (
    <main className="screen">
      <div className="title-row">
        <h1 className="screen-title">{dayTitle(date, today)}</h1>
        <button type="button" className="icon-btn outline" aria-label="Settings" onClick={onSettings}>
          <SettingsIcon />
        </button>
      </div>

      <div className="date-nav">
        <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft />
        </button>
        <button
          type="button"
          className="date"
          onClick={() => setDate(today)}
          aria-label={date === today ? longDate(date) : `${longDate(date)}. Go to today`}
          disabled={date === today}
          style={{ color: 'var(--text)', opacity: 1 }}
        >
          {longDate(date)}
          {date !== today && <div className="small" style={{ fontWeight: 600 }}>Back to today</div>}
        </button>
        <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight />
        </button>
      </div>

      <InstallHint />

      <section aria-label="Daily summary" className="summary">
        <div className="summary-top">
          <div>
            <div className="eaten">{fmtInt(s.calories)}</div>
            <div className="small mt6" style={{ fontSize: '0.824rem' }}>
              kcal eaten
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={`left${over ? ' over' : ''}`}>{over ? `${fmtInt(-left)} over` : `${fmtInt(left)} left`}</div>
            <div className="small" style={{ fontSize: '0.824rem', marginTop: 2 }}>
              of {fmtInt(target)} kcal
            </div>
          </div>
        </div>
        <div
          className={`progress${over ? ' over' : ''}`}
          role="progressbar"
          aria-label="Calories eaten"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={s.calories}
        >
          <div style={{ width: `${Math.min(100, (s.calories / Math.max(1, target)) * 100)}%` }} />
        </div>
        <div className="rule" />
        <div className="protein-line">
          <div className="label">
            <span className="dot" />
            <span>Protein</span>
            <span style={{ fontWeight: 600 }}>{fmtProtein(s.protein)} g</span>
          </div>
          {proteinTarget != null && <div className="small" style={{ fontSize: '0.824rem' }}>of {fmtInt(proteinTarget)} g</div>}
        </div>
        {proteinTarget != null && (
          <div className="progress thin" role="progressbar" aria-label="Protein eaten" aria-valuemin={0} aria-valuemax={proteinTarget} aria-valuenow={s.protein}>
            <div style={{ width: `${Math.min(100, (s.protein / Math.max(1, proteinTarget)) * 100)}%` }} />
          </div>
        )}
        <div className="small">
          {s.entryCount === 0 ? 'Nothing logged yet' : `Counted from ${s.proteinCounted} of ${s.entryCount} ${s.entryCount === 1 ? 'food' : 'foods'}`}
        </div>
      </section>

      {MEALS.map((meal) => (
        <section key={meal} aria-label={meal}>
          <div className="meal-band">
            <h2>{meal}</h2>
            {s.byMeal[meal].length > 0 && <div className="subtotal">{fmtInt(s.mealCalories[meal])} kcal</div>}
            <button type="button" className="icon-btn dark" aria-label={`Add food to ${meal}`} onClick={() => onLog(meal)}>
              <PlusIcon />
            </button>
          </div>
          {s.byMeal[meal].length === 0 ? (
            <button type="button" className="empty-meal" onClick={() => onLog(meal)}>
              Nothing yet. Add {meal === 'Other' ? 'something' : meal.toLowerCase()}
            </button>
          ) : (
            s.byMeal[meal].map((e) => (
              <button key={e.id} type="button" className="entry-row" onClick={() => onEdit(e)}>
                <span className="main">
                  <span className="name">{e.name}</span>
                  <span className="sub">{entryAmountLabel(e) ?? 'Entered yourself'}</span>
                </span>
                <span className="nums">
                  <span className="kcal">{fmtInt(e.calories)} kcal</span>
                  <span className={`prot${e.protein == null ? ' none' : ''}`}>
                    <ProteinText protein={e.protein} />
                  </span>
                </span>
              </button>
            ))
          )}
        </section>
      ))}

      <DayNote key={date} date={date} />
    </main>
  )
}

function DayNote({ date }: { date: string }) {
  const stored = useData().notes[date] ?? ''
  const [text, setText] = useState(stored)
  const ref = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(text)
  latest.current = text

  const flush = () => {
    if (pending.current) clearTimeout(pending.current)
    pending.current = null
    actions.setNote(date, latest.current)
  }

  // Save anything still waiting when the note goes away (day change or tab switch).
  useEffect(
    () => () => {
      if (pending.current) flush()
    },
    [],
  )

  // Pick up outside changes, like restoring a backup, unless the note is being typed in.
  useEffect(() => {
    if (document.activeElement !== ref.current && !pending.current) setText(stored)
  }, [stored])

  // Grow with the text instead of scrolling inside the box.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [text])

  return (
    <section aria-label="Day note">
      <h2 className="note-title">
        <label htmlFor="day-note">Day note</label>
      </h2>
      <textarea
        id="day-note"
        ref={ref}
        className="input"
        placeholder="How did today go?"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (pending.current) clearTimeout(pending.current)
          pending.current = setTimeout(flush, 500)
        }}
        onBlur={flush}
      />
    </section>
  )
}

const HINT_KEY = 'calorie-diary-install-hint-dismissed'

/** In Safari (not yet on the Home Screen), suggest adding it: the app works offline and its storage is kept. */
function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1'
    } catch {
      return false
    }
  })
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  if (dismissed || standalone || !ios) return null
  return (
    <div className="banner" role="note">
      <p>
        <strong>Add to your Home Screen.</strong> Tap the Share button, then “Add to Home Screen”. It opens full screen, like an app.
      </p>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss tip"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(HINT_KEY, '1')
          } catch {
            // Ignore: it just shows again next time.
          }
        }}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
