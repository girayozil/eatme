import { useRef, useState } from 'react'
import type { Appearance } from '../lib/types'
import { actions, getData, normalize, useData } from '../lib/store'
import { fmtInt, parseNum } from '../lib/logic'
import { exportBackup, exportCsv, looksLikeBackup, openReminder } from '../lib/files'
import { Segmented, NumberField } from '../components/Controls'
import { ChevronLeft, ChevronRight } from '../components/Icons'
import { Sheet } from '../components/Sheet'

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

type Editing = 'calories' | 'protein' | null

export function Settings({ onBack, toast }: { onBack: () => void; toast: (msg: string) => void }) {
  const { settings } = useData()
  const [editing, setEditing] = useState<Editing>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const edit = (what: Editing) => {
    setEditing(what)
    setSheetOpen(true)
  }

  const restore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!looksLikeBackup(parsed)) throw new Error('not a backup')
      const next = normalize(parsed)
      const ok = window.confirm(
        `Replace everything in the app with this backup? It has ${next.foods.length} foods and ${next.entries.length} diary entries. What is in the app now will be lost.`,
      )
      if (!ok) return
      actions.replaceAll(next)
      toast('Backup restored')
    } catch {
      window.alert("That file doesn't look like a Calorie Diary backup.")
    }
  }

  return (
    <main className="screen" style={{ gap: 22 }}>
      <div>
        <button type="button" className="back-link" onClick={onBack}>
          <ChevronLeft />
          Today
        </button>
        <h1 className="screen-title mt4">Settings</h1>
      </div>

      <section aria-label="Targets" className="settings-section">
        <h2 className="eyebrow">Targets</h2>
        <div className="group">
          <button type="button" className="group-row" onClick={() => edit('calories')}>
            <span className="text">Daily calories</span>
            <span className="value">{fmtInt(settings.calorieTarget)} kcal</span>
            <span className="muted" style={{ display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
          <button type="button" className="group-row" onClick={() => edit('protein')}>
            <span className="text">
              Daily protein
              <span className="small">Optional</span>
            </span>
            <span className="value">{settings.proteinTarget == null ? 'Not set' : `${fmtInt(settings.proteinTarget)} g`}</span>
            <span className="muted" style={{ display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
        </div>
      </section>

      <section aria-label="Reminder" className="settings-section">
        <h2 className="eyebrow">Reminder</h2>
        <div className="group">
          <label className="group-row" htmlFor="reminder-time">
            <span className="text">Time</span>
            <input
              id="reminder-time"
              type="time"
              value={settings.reminderTime}
              onChange={(e) => e.target.value && actions.updateSettings({ reminderTime: e.target.value })}
            />
          </label>
          <button type="button" className="group-row" onClick={() => openReminder(settings.reminderTime)}>
            <span className="text">
              Add daily reminder to Calendar
              <span className="small">Every day at {formatTime(settings.reminderTime)}</span>
            </span>
            <span className="muted" style={{ display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
        </div>
        <p className="small">
          A nudge to log dinner and add a note about your day. Web apps can't send their own alerts on iPhone, so this adds a repeating event with an
          alert to your Calendar. To change or stop it later, edit the event in Calendar.
        </p>
      </section>

      <section aria-label="Appearance" className="settings-section">
        <h2 className="eyebrow">Appearance</h2>
        <Segmented<Appearance>
          label="Appearance"
          value={settings.appearance}
          onChange={(appearance) => actions.updateSettings({ appearance })}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        <p className="small">Auto follows your phone's light or dark setting.</p>
      </section>

      <section aria-label="Your data" className="settings-section">
        <h2 className="eyebrow">Your data</h2>
        <div className="group">
          <button type="button" className="group-row" style={{ minHeight: 64 }} onClick={() => exportCsv(getData())}>
            <span className="text">
              Export diary and menu
              <span className="small">Saves spreadsheet files (CSV) you can keep</span>
            </span>
            <span className="muted" style={{ display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
          <button type="button" className="group-row" style={{ minHeight: 64 }} onClick={() => exportBackup(getData())}>
            <span className="text">
              Save a backup
              <span className="small">One file with everything, for restoring later</span>
            </span>
            <span className="muted" style={{ display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
          <button type="button" className="group-row" style={{ minHeight: 64 }} onClick={() => fileRef.current?.click()}>
            <span className="text">
              Restore from a backup
              <span className="small">Replaces what is in the app now</span>
            </span>
            <span className="muted" style={{ display: 'flex' }}>
              <ChevronRight size={20} />
            </span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) restore(f)
          }}
        />
        <p className="small">
          Your diary and menu live only on this iPhone, inside this app. There is no account and nothing is sent anywhere. They are not part of your
          iCloud backup, so save a backup to Files now and then.
        </p>
      </section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onExited={() => setEditing(null)}
        title={editing === 'protein' ? 'Daily protein' : 'Daily calories'}
      >
        {editing && <TargetEditor key={editing} what={editing} onDone={() => setSheetOpen(false)} />}
      </Sheet>
    </main>
  )
}

function TargetEditor({ what, onDone }: { what: 'calories' | 'protein'; onDone: () => void }) {
  const { settings } = useData()
  const initial = what === 'calories' ? settings.calorieTarget : settings.proteinTarget
  const [value, setValue] = useState(initial == null ? '' : String(initial))
  const n = parseNum(value)
  const valid = what === 'protein' ? true : n != null && n > 0

  const save = () => {
    if (!valid) return
    if (what === 'calories') actions.updateSettings({ calorieTarget: Math.round(n!) })
    else actions.updateSettings({ proteinTarget: n == null || n === 0 ? null : Math.round(n) })
    onDone()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <NumberField
        id="target"
        label={what === 'calories' ? 'Calories a day' : 'Protein a day'}
        optional={what === 'protein'}
        unit={what === 'calories' ? 'kcal' : 'g'}
        value={value}
        onChange={setValue}
        placeholder={what === 'protein' ? 'Not set' : undefined}
      />
      <p className="small">
        {what === 'calories'
          ? 'Going over shows in a calm amber, never red.'
          : 'Leave it blank if you just want to see how much protein you eat, without a target.'}
      </p>
      <button type="submit" className="primary-btn" disabled={!valid}>
        Save
      </button>
      {what === 'protein' && settings.proteinTarget != null && (
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            actions.updateSettings({ proteinTarget: null })
            onDone()
          }}
        >
          Remove protein target
        </button>
      )}
    </form>
  )
}
