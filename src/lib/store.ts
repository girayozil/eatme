import { useSyncExternalStore } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  terminate,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import type { AppData, DiaryEntry, Food, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'
import { addDays, todayKey } from './logic'
import { auth, db } from './firebase'

// Data lives in Firestore under users/{uid}: foods, entries, notes (one doc per date) and meta/settings.
// Firestore's offline cache makes writes show up at once and sync when online.
//
// Only recent days are kept live, so opening the app reads a few hundred documents at most,
// well inside the free tier. Older days are loaded when you navigate to them, and exports
// fetch everything once.

const RECENT_DAYS = 45

type AuthState = 'loading' | 'signedOut' | 'signedIn'

interface State {
  auth: AuthState
  email: string | null
  loaded: boolean
  data: AppData
}

let state: State = {
  auth: 'loading',
  email: null,
  loaded: false,
  data: { version: 1, foods: [], entries: [], notes: {}, settings: { ...DEFAULT_SETTINGS } },
}

const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

// ---------- Error reporting ----------

const errorListeners = new Set<(message: string) => void>()
export function onSyncError(l: (message: string) => void) {
  errorListeners.add(l)
  return () => {
    errorListeners.delete(l)
  }
}
function reportError(err: unknown) {
  console.error(err)
  const code = (err as { code?: string })?.code ?? ''
  const message = code === 'permission-denied' ? "Couldn't save: no permission. Try signing out and in again." : "Couldn't save that change. Please try again."
  for (const l of errorListeners) l(message)
}
/** Writes resolve only once the server confirms, which never happens offline, so we don't await them. */
function fire(p: Promise<unknown>) {
  p.catch(reportError)
}

// ---------- Live data ----------

let uid: string | null = null
let unsubs: Unsubscribe[] = []
const dayUnsubs = new Map<string, Unsubscribe[]>()
let cutoff = ''

let foods = new Map<string, Food>()
let recentEntries = new Map<string, DiaryEntry>()
let recentNotes: Record<string, string> = {}
const dayEntries = new Map<string, Map<string, DiaryEntry>>()
const dayNotes = new Map<string, string>()
let settings: Settings = { ...DEFAULT_SETTINGS }
const ready = { foods: false, entries: false, notes: false, settings: false }

const userCol = (name: string) => collection(db, 'users', uid!, name)
const userDoc = (name: string, id: string) => doc(db, 'users', uid!, name, id)
const settingsRef = () => doc(db, 'users', uid!, 'meta', 'settings')

function rebuild() {
  const entries = new Map(recentEntries)
  for (const m of dayEntries.values()) for (const [id, e] of m) entries.set(id, e)
  const notes: Record<string, string> = { ...recentNotes }
  for (const [date, text] of dayNotes) if (text) notes[date] = text
  setState({
    loaded: ready.foods && ready.entries && ready.notes && ready.settings,
    data: { version: 1, foods: [...foods.values()], entries: [...entries.values()], notes, settings },
  })
}

function startSync(userId: string) {
  uid = userId
  cutoff = addDays(todayKey(), -RECENT_DAYS)
  unsubs = [
    onSnapshot(userCol('foods'), (s) => {
      foods = new Map(s.docs.map((d) => [d.id, d.data() as Food]))
      ready.foods = true
      rebuild()
    }, reportError),
    onSnapshot(query(userCol('entries'), where('date', '>=', cutoff)), (s) => {
      recentEntries = new Map(s.docs.map((d) => [d.id, d.data() as DiaryEntry]))
      ready.entries = true
      rebuild()
    }, reportError),
    onSnapshot(query(userCol('notes'), where('date', '>=', cutoff)), (s) => {
      recentNotes = Object.fromEntries(s.docs.map((d) => [d.id, (d.data().text as string) ?? '']))
      ready.notes = true
      rebuild()
    }, reportError),
    onSnapshot(settingsRef(), (s) => {
      settings = { ...DEFAULT_SETTINGS, ...((s.data() as Partial<Settings> | undefined) ?? {}) }
      ready.settings = true
      rebuild()
    }, reportError),
  ]
}

function stopSync() {
  for (const u of unsubs) u()
  for (const list of dayUnsubs.values()) for (const u of list) u()
  unsubs = []
  dayUnsubs.clear()
  dayEntries.clear()
  dayNotes.clear()
  foods = new Map()
  recentEntries = new Map()
  recentNotes = {}
  settings = { ...DEFAULT_SETTINGS }
  ready.foods = ready.entries = ready.notes = ready.settings = false
  uid = null
}

/** Load a day older than the live window, for when Today is moved back in time. */
export function ensureDay(date: string) {
  if (!uid || date >= cutoff || dayUnsubs.has(date)) return
  dayUnsubs.set(date, [
    onSnapshot(query(userCol('entries'), where('date', '==', date)), (s) => {
      dayEntries.set(date, new Map(s.docs.map((d) => [d.id, d.data() as DiaryEntry])))
      rebuild()
    }, reportError),
    onSnapshot(userDoc('notes', date), (s) => {
      dayNotes.set(date, (s.data()?.text as string) ?? '')
      rebuild()
    }, reportError),
  ])
}

onAuthStateChanged(auth, (user: User | null) => {
  stopSync()
  if (user) {
    setState({ auth: 'signedIn', email: user.email, loaded: false })
    startSync(user.uid)
    migrateLocalData(user.uid).catch(reportError)
  } else {
    setState({ auth: 'signedOut', email: null, loaded: false })
  }
})

// ---------- Hooks ----------

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => state.data)
}
export function useLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => state.loaded)
}
export function useAuth(): { state: AuthState; email: string | null } {
  const s = useSyncExternalStore(subscribe, () => state.auth)
  const email = useSyncExternalStore(subscribe, () => state.email)
  return { state: s, email }
}

export function getData(): AppData {
  return state.data
}

/** Runs once, the first time a signed-in account's data has loaded. */
export function onReady(fn: () => void) {
  const check = () => {
    if (!state.loaded) return
    listeners.delete(check)
    fn()
  }
  listeners.add(check)
}

/** Everything, including days outside the live window. For exports and backups. */
export async function fetchAll(): Promise<AppData> {
  if (!uid) return state.data
  const [f, e, n, s] = await Promise.all([getDocs(userCol('foods')), getDocs(userCol('entries')), getDocs(userCol('notes')), getDoc(settingsRef())])
  return {
    version: 1,
    foods: f.docs.map((d) => d.data() as Food),
    entries: e.docs.map((d) => d.data() as DiaryEntry),
    notes: Object.fromEntries(n.docs.map((d) => [d.id, (d.data().text as string) ?? ''])),
    settings: { ...DEFAULT_SETTINGS, ...((s.data() as Partial<Settings> | undefined) ?? {}) },
  }
}

/** Fills in anything missing so older or hand-edited backups still load. */
export function normalize(raw: unknown): AppData {
  const d = (raw ?? {}) as Partial<AppData>
  return {
    version: 1,
    foods: Array.isArray(d.foods) ? d.foods : [],
    entries: Array.isArray(d.entries) ? d.entries.map((e) => ({ ...e, unitCalories: e.unitCalories ?? null, unitProtein: e.unitProtein ?? null })) : [],
    notes: d.notes && typeof d.notes === 'object' ? d.notes : {},
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
  }
}

// ---------- Batched writes ----------

type Op = { ref: DocumentReference; data?: object }

/** Firestore batches hold up to 500 writes. */
async function commitOps(ops: Op[]) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 450)) {
      if (op.data) batch.set(op.ref, op.data)
      else batch.delete(op.ref)
    }
    await batch.commit()
  }
}

function dataOps(d: AppData): Op[] {
  return [
    ...d.foods.map((f) => ({ ref: userDoc('foods', f.id), data: f })),
    ...d.entries.map((e) => ({ ref: userDoc('entries', e.id), data: e })),
    ...Object.entries(d.notes)
      .filter(([, text]) => text.trim())
      .map(([date, text]) => ({ ref: userDoc('notes', date), data: { date, text } })),
  ]
}

// ---------- Moving data from the earlier on-phone version ----------

const LEGACY_DB = 'calorie-diary'
const LEGACY_FALLBACK = 'calorie-diary-data'

function readLegacy(): Promise<AppData | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const req = indexedDB.open(LEGACY_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onerror = () => resolve(null)
    req.onsuccess = () => {
      const legacy = req.result
      try {
        const get = legacy.transaction('kv', 'readonly').objectStore('kv').get('data')
        get.onsuccess = () => {
          legacy.close()
          resolve(get.result ? normalize(get.result) : null)
        }
        get.onerror = () => {
          legacy.close()
          resolve(null)
        }
      } catch {
        legacy.close()
        resolve(null)
      }
    }
  })
}

function clearLegacy() {
  try {
    indexedDB.deleteDatabase(LEGACY_DB)
    localStorage.removeItem(LEGACY_FALLBACK)
  } catch {
    // Nothing to clear.
  }
}

/** Uploads anything kept on the phone by the earlier version. Ids are unique, so it merges with what is in the cloud. */
async function migrateLocalData(userId: string) {
  let legacy = await readLegacy()
  if (!legacy) {
    try {
      const s = localStorage.getItem(LEGACY_FALLBACK)
      if (s) legacy = normalize(JSON.parse(s))
    } catch {
      // Ignore unreadable leftovers.
    }
  }
  if (!legacy || uid !== userId) return
  const count = legacy.foods.length + legacy.entries.length + Object.keys(legacy.notes).length
  if (count === 0) return clearLegacy()
  const ops = dataOps(legacy)
  const cloudSettings = await getDoc(settingsRef())
  if (!cloudSettings.exists()) ops.push({ ref: settingsRef(), data: legacy.settings })
  await commitOps(ops)
  clearLegacy()
  for (const l of migrationListeners) l(legacy.entries.length, legacy.foods.length)
}

const migrationListeners = new Set<(entries: number, foods: number) => void>()
export function onMigrated(l: (entries: number, foods: number) => void) {
  migrationListeners.add(l)
  return () => {
    migrationListeners.delete(l)
  }
}

// ---------- Actions ----------

export const actions = {
  addFood(food: Food) {
    fire(setDoc(userDoc('foods', food.id), food))
  },
  updateFood(id: string, patch: Partial<Food>) {
    // The serving type is fixed once a food is created.
    const { servingType: _fixed, id: _id, ...rest } = patch
    fire(updateDoc(userDoc('foods', id), rest))
  },
  /** Past diary entries keep their copied name and numbers. */
  deleteFood(id: string) {
    fire(deleteDoc(userDoc('foods', id)))
  },
  addEntry(entry: DiaryEntry) {
    const batch = writeBatch(db)
    batch.set(userDoc('entries', entry.id), entry)
    if (entry.foodId && foods.has(entry.foodId)) batch.update(userDoc('foods', entry.foodId), { lastUsedAt: entry.createdAt })
    fire(batch.commit())
  },
  updateEntry(id: string, patch: Partial<DiaryEntry>) {
    const { id: _id, ...rest } = patch
    fire(updateDoc(userDoc('entries', id), rest))
  },
  deleteEntry(id: string) {
    fire(deleteDoc(userDoc('entries', id)))
  },
  setNote(date: string, text: string) {
    if (text.trim()) fire(setDoc(userDoc('notes', date), { date, text }))
    else fire(deleteDoc(userDoc('notes', date)))
  },
  updateSettings(patch: Partial<Settings>) {
    fire(setDoc(settingsRef(), patch, { merge: true }))
  },
  /** Restore from a backup: replaces everything in the account. */
  async replaceAll(next: AppData) {
    const d = normalize(next)
    const [f, e, n] = await Promise.all([getDocs(userCol('foods')), getDocs(userCol('entries')), getDocs(userCol('notes'))])
    const keep = new Set(dataOps(d).map((op) => op.ref.path))
    const deletes: Op[] = [...f.docs, ...e.docs, ...n.docs].filter((s) => !keep.has(s.ref.path)).map((s) => ({ ref: s.ref }))
    await commitOps([...deletes, ...dataOps(d), { ref: settingsRef(), data: d.settings }])
  },
  async signOut() {
    stopSync()
    await fbSignOut(auth)
    // Remove the offline copy from this phone too, then start fresh.
    try {
      await terminate(db)
      await clearIndexedDbPersistence(db)
    } catch {
      // The reload below still leaves a clean, signed-out app.
    }
    location.reload()
  },
}
