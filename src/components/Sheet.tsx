import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

let openSheets = 0

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** Text for the top-right button. Defaults to Cancel. */
  closeLabel?: string
  children: ReactNode
  footer?: ReactNode
  plainFooter?: boolean
  /** Called after the slide-out finishes, so the parent can drop the sheet's state. */
  onExited?: () => void
}

/** A bottom sheet that slides up like an iOS sheet. Drag the top down to dismiss it. */
export function Sheet({ open, onClose, title, closeLabel = 'Cancel', children, footer, plainFooter, onExited }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onExitedRef = useRef(onExited)
  onExitedRef.current = onExited

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    setDrag(0)
    const t = setTimeout(() => {
      setMounted(false)
      onExitedRef.current?.()
    }, 320)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    openSheets++
    document.body.classList.add('locked')
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.focus({ preventScroll: true })
    return () => {
      openSheets--
      if (openSheets === 0) document.body.classList.remove('locked')
      previous?.focus?.({ preventScroll: true })
    }
  }, [mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div className={`sheet-layer${shown ? ' open' : ''}`}>
      <div className="scrim" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`sheet${drag ? ' dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={shown && drag ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div
          className="sheet-head"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            dragStart.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (dragStart.current == null) return
            setDrag(Math.max(0, e.clientY - dragStart.current))
          }}
          onPointerUp={() => {
            if (dragStart.current == null) return
            dragStart.current = null
            if (drag > 90) onClose()
            else setDrag(0)
          }}
          onPointerCancel={() => {
            dragStart.current = null
            setDrag(0)
          }}
        >
          <div className="handle" />
          <div className="title-row">
            <h1 id={titleId} className="sheet-title">
              {title}
            </h1>
            <button type="button" className="text-btn" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className={`sheet-foot${plainFooter ? ' plain' : ''}`}>{footer}</div>}
      </div>
    </div>
  )
}
