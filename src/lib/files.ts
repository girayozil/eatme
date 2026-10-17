import type { AppData } from './types'
import { byName, perLabel, toKey } from './logic'

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function diaryCsv(data: AppData): string {
  const mealOrder = { Breakfast: 0, Lunch: 1, Dinner: 2, Other: 3 }
  const entries = [...data.entries].sort(
    (a, b) => a.date.localeCompare(b.date) || mealOrder[a.meal] - mealOrder[b.meal] || a.createdAt - b.createdAt,
  )
  const unitFor = (e: (typeof entries)[number]) =>
    e.servingType === 'weight' ? 'g' : e.servingType === 'portion' ? 'portion' : e.servingType === 'piece' ? e.unitName || 'piece' : ''
  const rows: unknown[][] = [['Date', 'Meal', 'Food', 'Amount', 'Unit', 'Calories (kcal)', 'Protein (g)', 'On menu', 'Day note']]
  const notedDays = new Set<string>()
  for (const e of entries) {
    const note = notedDays.has(e.date) ? '' : (data.notes[e.date] ?? '')
    notedDays.add(e.date)
    rows.push([e.date, e.meal, e.name, e.amount ?? '', unitFor(e), e.calories, e.protein ?? '', e.foodId ? 'yes' : 'no', note])
  }
  // Notes on days with no food still belong in the export.
  for (const [date, note] of Object.entries(data.notes).sort()) {
    if (!notedDays.has(date)) rows.push([date, '', '', '', '', '', '', '', note])
  }
  return csv(rows)
}

export function menuCsv(data: AppData): string {
  const typeName = { weight: 'By weight', portion: 'By portion', piece: 'By piece' }
  const rows: unknown[][] = [['Food', 'Measured', 'Per', 'Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)']]
  for (const f of [...data.foods].sort(byName)) {
    rows.push([f.name, typeName[f.servingType], perLabel(f), f.caloriesPerUnit, f.proteinPerUnit ?? '', f.carbsPerUnit ?? '', f.fatPerUnit ?? ''])
  }
  return csv(rows)
}

/** On iPhone the share sheet is the friendliest way to save a file; elsewhere fall back to a download. */
export async function deliverFiles(files: File[]): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files })
      return
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

export async function exportCsv(data: AppData) {
  const stamp = toKey(new Date())
  await deliverFiles([
    new File([diaryCsv(data)], `calorie-diary-${stamp}.csv`, { type: 'text/csv' }),
    new File([menuCsv(data)], `calorie-menu-${stamp}.csv`, { type: 'text/csv' }),
  ])
}

export async function exportBackup(data: AppData) {
  const stamp = toKey(new Date())
  await deliverFiles([
    new File([JSON.stringify(data, null, 1)], `calorie-diary-backup-${stamp}.json`, { type: 'application/json' }),
  ])
}

export function looksLikeBackup(raw: unknown): raw is AppData {
  const d = raw as Partial<AppData> | null
  return !!d && typeof d === 'object' && Array.isArray(d.foods) && Array.isArray(d.entries)
}

/** A repeating calendar event with an alert. Web apps can't schedule local notifications on iPhone. */
export function reminderIcs(time: string, appUrl: string, now = new Date()): string {
  const [h, m] = time.split(':')
  const start = `${toKey(now).replace(/-/g, '')}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calorie Diary//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:calorie-diary-reminder-${stamp}@calorie-diary`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Log your food in Calorie Diary',
    'DESCRIPTION:A nudge to log dinner and add a note about your day.',
    `URL:${appUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Log your food in Calorie Diary',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function openReminder(time: string) {
  const ics = reminderIcs(time, location.href.split('#')[0])
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos) {
    // Opening (not downloading) the file makes iOS show its calendar preview with "Add All".
    location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)
    return
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'calorie-diary-reminder.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
