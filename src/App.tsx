import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryEntry, Food, Meal } from './lib/types'
import { actions, onMigrated, onSyncError, useAuth, useData, useLoaded } from './lib/store'
import { mealForTime, todayKey } from './lib/logic'
import { MenuIcon, TodayIcon, TrendsIcon } from './components/Icons'
import { Today } from './screens/Today'
import { Menu } from './screens/Menu'
import { Trends } from './screens/Trends'
import { Settings } from './screens/Settings'
import { LogSheet } from './screens/LogSheet'
import { EditEntrySheet } from './screens/EditEntrySheet'
import { FoodSheet } from './screens/FoodSheet'
import { SignIn } from './screens/SignIn'

type Tab = 'today' | 'menu' | 'trends'

type SheetState =
  | { kind: 'log'; meal: Meal }
  | { kind: 'entry'; entry: DiaryEntry }
  | { kind: 'food'; food: Food | null }

interface Toast {
  id: number
  message: string
  undo?: () => void
}

export function App() {
  const loaded = useLoaded()
  const auth = useAuth()
  const { settings } = useData()
  const [tab, setTab] = useState<Tab>('today')
  const [showSettings, setShowSettings] = useState(false)
  const [date, setDate] = useState(todayKey)
  const [sheet, setSheet] = useState<(SheetState & { key: number }) | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const sheetKey = useRef(0)

  const openSheet = useCallback((s: SheetState) => {
    sheetKey.current++
    setSheet({ ...s, key: sheetKey.current })
    setSheetOpen(true)
  }, [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const clearSheet = useCallback(() => setSheet((s) => (sheetOpen ? s : null)), [sheetOpen])

  const showToast = useCallback((message: string, undo?: () => void) => setToast({ id: Date.now(), message, undo }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => onSyncError((message) => showToast(message)), [showToast])
  useEffect(
    () =>
      onMigrated((entries, foods) =>
        showToast(`Moved ${entries} diary ${entries === 1 ? 'entry' : 'entries'} and ${foods} ${foods === 1 ? 'food' : 'foods'} from this phone into your account`),
      ),
    [showToast],
  )

  // Appearance: Light, Dark or Auto (follows the phone).
  useEffect(() => {
    const root = document.documentElement
    if (settings.appearance === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.appearance
    const apply = () => {
      const dark = settings.appearance === 'dark' || (settings.appearance === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('content', dark ? '#152415' : '#F0E0D3')
        m.removeAttribute('media')
      })
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.appearance])

  // If the app stays open past midnight, roll "today" forward when it comes back to the front.
  const lastToday = useRef(todayKey())
  useEffect(() => {
    const check = () => {
      const now = todayKey()
      if (now !== lastToday.current) {
        setDate((d) => (d === lastToday.current ? now : d))
        lastToday.current = now
      }
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  // Home Screen shortcut: ?log opens the log sheet with the meal guessed from the time of day.
  useEffect(() => {
    if (!loaded) return
    const params = new URLSearchParams(location.search)
    if (params.has('log')) {
      openSheet({ kind: 'log', meal: mealForTime() })
      history.replaceState(null, '', location.pathname)
    }
  }, [loaded, openSheet])

  const goTab = (t: Tab) => {
    if (t === tab && !showSettings) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setTab(t)
    setShowSettings(false)
    window.scrollTo(0, 0)
  }

  const deleteFood = (food: Food) => {
    actions.deleteFood(food.id)
    showToast(`Deleted ${food.name}`, () => actions.addFood(food))
  }

  if (auth.state === 'loading') return null
  if (auth.state === 'signedOut') return <SignIn />
  if (!loaded) return null

  return (
    <>
      {/* Everything behind an open sheet is hidden from VoiceOver and taps. */}
      <div inert={sheet != null}>
      {tab === 'today' && !showSettings && (
        <Today
          date={date}
          setDate={setDate}
          onSettings={() => {
            setShowSettings(true)
            window.scrollTo(0, 0)
          }}
          onLog={(meal) => openSheet({ kind: 'log', meal })}
          onEdit={(entry) => openSheet({ kind: 'entry', entry })}
        />
      )}
      {tab === 'today' && showSettings && (
        <Settings
          onBack={() => {
            setShowSettings(false)
            window.scrollTo(0, 0)
          }}
          toast={showToast}
        />
      )}
      {tab === 'menu' && (
        <Menu onAdd={() => openSheet({ kind: 'food', food: null })} onEdit={(food) => openSheet({ kind: 'food', food })} onDelete={deleteFood} />
      )}
      {tab === 'trends' && <Trends />}

      <nav className="tabbar" aria-label="Main">
        <button type="button" aria-current={tab === 'today' ? 'page' : undefined} onClick={() => goTab('today')}>
          <TodayIcon />
          Today
        </button>
        <button type="button" aria-current={tab === 'menu' ? 'page' : undefined} onClick={() => goTab('menu')}>
          <MenuIcon />
          Menu
        </button>
        <button type="button" aria-current={tab === 'trends' ? 'page' : undefined} onClick={() => goTab('trends')}>
          <TrendsIcon />
          Trends
        </button>
      </nav>
      </div>

      {sheet?.kind === 'log' && (
        <LogSheet
          key={sheet.key}
          open={sheetOpen}
          date={date}
          meal={sheet.meal}
          onClose={closeSheet}
          onExited={clearSheet}
          onAddFood={() => openSheet({ kind: 'food', food: null })}
        />
      )}
      {sheet?.kind === 'entry' && (
        <EditEntrySheet
          key={sheet.key}
          open={sheetOpen}
          entry={sheet.entry}
          onClose={closeSheet}
          onExited={clearSheet}
          onDeleted={(entry) => showToast(`Removed ${entry.name}`, () => actions.addEntry(entry))}
        />
      )}
      {sheet?.kind === 'food' && (
        <FoodSheet
          key={sheet.key}
          open={sheetOpen}
          food={sheet.food}
          onClose={closeSheet}
          onExited={clearSheet}
          onDelete={(food) => {
            closeSheet()
            deleteFood(food)
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  )
}
