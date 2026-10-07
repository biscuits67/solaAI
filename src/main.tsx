import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/onest'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/unbounded/300.css'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
import './styles/global.css'
import App from './App'

// favicon rendered on a canvas (no image assets)
function favicon() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createConicGradient(3.6, 32, 32)
  ;['#14f195', '#52c8ff', '#9d6bff', '#ff4f80', '#14f195'].forEach((col, i) => g.addColorStop(i / 4, col))
  x.fillStyle = g
  x.beginPath()
  x.arc(32, 32, 30, 0, Math.PI * 2)
  x.fill()
  const r = x.createRadialGradient(26, 24, 2, 32, 32, 26)
  r.addColorStop(0, '#fff')
  r.addColorStop(0.35, '#2a1f4d')
  r.addColorStop(1, '#0a0814')
  x.fillStyle = r
  x.beginPath()
  x.arc(32, 32, 25, 0, Math.PI * 2)
  x.fill()
  const l = document.createElement('link')
  l.rel = 'icon'
  l.href = c.toDataURL()
  document.head.appendChild(l)
}
favicon()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
