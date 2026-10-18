import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { getData, onReady } from './lib/store'
import './styles.css'

// Keep sheets sized to the visible area when the iPhone keyboard is up.
const vv = window.visualViewport
if (vv) {
  const sync = () => {
    document.documentElement.style.setProperty('--vv-height', `${vv.height}px`)
    document.documentElement.style.setProperty('--vv-top', `${vv.offsetTop}px`)
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
  sync()
}

// In development only, ?demo fills an empty account with sample data for a first look.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
  onReady(async () => {
    if (getData().foods.length === 0 && getData().entries.length === 0) {
      const { loadDemo } = await import('./lib/demo')
      loadDemo()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
