import { motion } from 'framer-motion'
import { useId } from 'react'

interface SegProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
  thumbClass?: (v: T) => string
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', className = '', thumbClass }: SegProps<T>) {
  const id = useId()
  return (
    <div className={`seg ${size === 'sm' ? 'sm' : ''} ${className}`}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.div
              layoutId={`seg-${id}`}
              className={`thumb ${thumbClass?.(o.value) ?? ''}`}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

interface RangeProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  ticks?: number
}

export function Range({ value, min, max, step = 1, onChange, ticks = 0 }: RangeProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="range">
      <div className="track">
        <motion.div className="fill" animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
      </div>
      {ticks > 0 && (
        <div className="ticks">
          {Array.from({ length: ticks }, (_, i) => (
            <i key={i} style={{ opacity: (i / (ticks - 1)) * 100 <= pct ? 1 : 0.5 }} />
          ))}
        </div>
      )}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  )
}

export function Power({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`power ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <motion.div className="knob" animate={{ x: on ? 28 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </button>
  )
}

export function NumInput({
  value,
  onChange,
  unit,
  step = 1,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  unit?: string
  step?: number
  placeholder?: string
}) {
  return (
    <div className="input">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}
