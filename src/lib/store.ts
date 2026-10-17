import { useSyncExternalStore } from 'react'
import type { AppData, DiaryEntry, Food, Settings } from './types'
import { DEFAULT_SETTINGS, emptyData } from './types'

// The whole diary lives in memory and is written to IndexedDB as one record after each change.
// A year of daily logging is well under a megabyte, so this stays fast and simple.

const DB_NAME = 'calorie-diary'
const STORE = 'kv'
const KEY = 'data'
const FALLBACK_KEY = 'calorie-diary-data'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let data: AppData = emptyData()
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Fills in anything missing so older or hand-edited backups still load. */
export function normalize(raw: unknown): AppData {
  const d = (raw ?? {}) as Partial<AppData>
  return {
    version: 1,
    foods: Array.isArray(d.foods) ? d.foods : [],
    entries: Array.isArray(d.entries) ? d.entries : [],
    notes: d.notes && typeof d.notes === 'object' ? d.notes : {},
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
  }
}

export async function loadData(): Promise<void> {
  try {
    const stored = await idbGet<AppData>(KEY)
    if (stored) data = normalize(stored)
  } catch {
    try {
      const s = localStorage.getItem(FALLBACK_KEY)
      if (s) data = normalize(JSON.parse(s))
    } catch {
      // Private browsing or storage blocked: start empty, nothing to recover.
    }
  }
  loaded = true
  emit()
  // Ask the browser not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {})
}

let saving: Promise<void> = Promise.resolve()

function persist() {
  const snapshot = data
  saving = saving.then(() =>
    idbSet(KEY, snapshot).catch(() => {
      try {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot))
      } catch {
        // Nothing more we can do; the in-memory copy is still intact for this session.
      }
    }),
  )
}

function update(fn: (d: AppData) => AppData) {
  data = fn(data)
  emit()
  persist()
}

export function useData(): AppData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => data,
  )
}

export function useLoaded(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => loaded,
  )
}

export function getData(): AppData {
  return data
}

// ---------- Actions ----------

export const actions = {
  addFood(food: Food) {
    update((d) => ({ ...d, foods: [...d.foods, food] }))
  },
  updateFood(id: string, patch: Partial<Food>) {
    update((d) => ({ ...d, foods: d.foods.map((f) => (f.id === id ? { ...f, ...patch, servingType: f.servingType } : f)) }))
  },
  /** Past diary entries keep their copied name and numbers. */
  deleteFood(id: string) {
    update((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }))
  },
  addEntry(entry: DiaryEntry) {
    update((d) => ({
      ...d,
      entries: [...d.entries, entry],
      foods: entry.foodId ? d.foods.map((f) => (f.id === entry.foodId ? { ...f, lastUsedAt: entry.createdAt } : f)) : d.foods,
    }))
  },
  updateEntry(id: string, patch: Partial<DiaryEntry>) {
    update((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  },
  deleteEntry(id: string) {
    update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))
  },
  setNote(date: string, text: string) {
    update((d) => {
      const notes = { ...d.notes }
      if (text.trim()) notes[date] = text
      else delete notes[date]
      return { ...d, notes }
    })
  },
  updateSettings(patch: Partial<Settings>) {
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  },
  replaceAll(next: AppData) {
    update(() => normalize(next))
  },
}
