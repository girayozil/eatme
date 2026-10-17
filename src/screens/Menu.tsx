import { useMemo, useRef, useState } from 'react'
import type { Food } from '../lib/types'
import { useData } from '../lib/store'
import { byName, foodSummary, matchesQuery } from '../lib/logic'
import { ChevronRight, PlusIcon } from '../components/Icons'

interface Props {
  onAdd: () => void
  onEdit: (food: Food) => void
  onDelete: (food: Food) => void
}

export function Menu({ onAdd, onEdit, onDelete }: Props) {
  const { foods } = useData()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useMemo(() => foods.filter((f) => matchesQuery(f.name, query)).sort(byName), [foods, query])

  return (
    <main className="screen tight">
      <div className="title-row">
        <h1 className="screen-title">Menu</h1>
        <button type="button" className="icon-btn filled" aria-label="Add a food to the menu" onClick={onAdd}>
          <PlusIcon />
        </button>
      </div>

      {foods.length > 0 && (
        <>
          <label htmlFor="menu-search" className="sr-only">
            Search your menu
          </label>
          <input
            id="menu-search"
            type="search"
            className="input search"
            placeholder="Search your menu"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: -6 }}>
        {list.map((f) => (
          <SwipeRow
            key={f.id}
            food={f}
            open={openId === f.id}
            setOpen={(o) => setOpenId(o ? f.id : null)}
            onEdit={() => onEdit(f)}
            onDelete={() => {
              setOpenId(null)
              onDelete(f)
            }}
          />
        ))}
      </div>

      {foods.length === 0 ? (
        <div className="empty-state">
          <p>Your menu is empty.</p>
          <p className="mt8">Add the foods you eat often, like your usual breakfast or a favourite soup. Then logging them takes a few taps.</p>
          <button type="button" className="primary-btn mt16" onClick={onAdd}>
            Add your first food
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state">Nothing on your menu matches “{query.trim()}”.</div>
      ) : (
        <div className="small" style={{ textAlign: 'center' }}>
          {foods.length} {foods.length === 1 ? 'food' : 'foods'}. Swipe a row to delete it.
        </div>
      )}
    </main>
  )
}

const REVEAL = 96

function SwipeRow({
  food,
  open,
  setOpen,
  onEdit,
  onDelete,
}: {
  food: Food
  open: boolean
  setOpen: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [dx, setDx] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number; base: number; decided: boolean; horizontal: boolean } | null>(null)
  const swallowClick = useRef(false)
  const offset = dx ?? (open ? -REVEAL : 0)

  return (
    <div className="swipe">
      <button type="button" className="delete" onClick={onDelete} tabIndex={open ? 0 : -1} aria-hidden={!open}>
        Delete
      </button>
      <button
        type="button"
        className={`row${dx != null ? ' dragging' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          start.current = { x: e.clientX, y: e.clientY, base: open ? -REVEAL : 0, decided: false, horizontal: false }
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          const mx = e.clientX - s.x
          const my = e.clientY - s.y
          if (!s.decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
            s.decided = true
            s.horizontal = Math.abs(mx) > Math.abs(my)
            if (s.horizontal) e.currentTarget.setPointerCapture(e.pointerId)
          }
          if (s.horizontal) setDx(Math.max(-REVEAL - 20, Math.min(0, s.base + mx)))
        }}
        onPointerUp={() => {
          const s = start.current
          start.current = null
          if (s?.horizontal) {
            swallowClick.current = true
            setOpen((dx ?? 0) < -REVEAL / 2)
            setDx(null)
          }
        }}
        onPointerCancel={() => {
          start.current = null
          setDx(null)
        }}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false
            return
          }
          if (open) setOpen(false)
          else onEdit()
        }}
        aria-label={`${food.name}. ${foodSummary(food)}. Edit`}
      >
        <span className="main">
          <span className="name">{food.name}</span>
          <span className="sub">{foodSummary(food)}</span>
        </span>
        <span style={{ color: 'var(--muted)', display: 'flex' }}>
          <ChevronRight size={22} />
        </span>
      </button>
    </div>
  )
}
