import { animate, useMotionValue } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface Props {
  value: number
  format?: (v: number) => string
  duration?: number
  className?: string
  flash?: boolean
}

/** Smoothly tweens between numeric values; optionally flashes green/red on change. */
export function AnimatedNumber({ value, format = (v) => v.toFixed(2), duration = 0.6, className = '', flash = false }: Props) {
  const mv = useMotionValue(value)
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (flash && el && value !== prev.current) {
      el.animate(
        [{ color: value > prev.current ? '#2ff3b3' : '#ff4f80', textShadow: `0 0 18px ${value > prev.current ? '#2ff3b3' : '#ff4f80'}` }, { color: '', textShadow: 'none' }],
        { duration: 900, easing: 'cubic-bezier(0.22,1,0.36,1)' },
      )
    }
    prev.current = value
    const c = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] })
    return c.stop
  }, [value])

  useEffect(() => mv.on('change', (v) => ref.current && (ref.current.textContent = format(v))), [format])

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}

/** Live price: no rolling digits, just a short colour flash on change. */
export function Ticker({ value, format, className = '' }: { value: number; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (el && value !== prev.current) {
      const c = value > prev.current ? 'var(--long)' : 'var(--short)'
      el.animate([{ color: c }, { color: '' }], { duration: 700, easing: 'cubic-bezier(0.2,0,0,1)' })
    }
    prev.current = value
  }, [value])
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
