import { motion, type HTMLMotionProps } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

interface Props extends Omit<HTMLMotionProps<'div'>, 'title'> {
  title?: ReactNode
  k?: string
  right?: ReactNode
  pad?: boolean
  delay?: number
  children?: ReactNode
}

/** Glass panel with cursor spotlight and staggered entrance. */
export function Panel({ title, k, right, pad = true, delay = 0, className = '', children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <motion.div
      ref={ref}
      className={`glass spot ${pad ? 'panel' : ''} ${className}`}
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      {...rest}
    >
      {(title || right) && (
        <div className="panel-head">
          <div className="panel-title">
            {title}
            {k && <span className="k">{k}</span>}
          </div>
          {right}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </motion.div>
  )
}
