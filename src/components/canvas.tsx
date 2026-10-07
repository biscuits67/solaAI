import { useEffect, useRef } from 'react'

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => boolean | void

/**
 * Hi-DPI canvas that redraws on resize and runs an rAF loop while `draw` returns true
 * (used for eased transitions). `deps` restart the loop.
 */
export function useCanvas(draw: Draw, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const kick = useRef<() => void>(() => {})

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    let w = 0
    let h = 0
    const loop = (t: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const more = drawRef.current(ctx, w, h, t)
      raf = more ? requestAnimationFrame(loop) : 0
    }
    kick.current = () => {
      if (!raf && w && h) raf = requestAnimationFrame(loop)
    }
    ;(cv as any).__kick = () => kick.current()
    const ro = new ResizeObserver(([e]) => {
      w = e.contentRect.width
      h = e.contentRect.height
      kick.current()
    })
    ro.observe(cv)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => kick.current(), deps)
  return ref
}

/** Exponential approach helper: returns [next, stillMoving]. */
export function approach(cur: number, target: number, k = 0.12): [number, boolean] {
  const d = target - cur
  if (Math.abs(d) < 1e-4) return [target, false]
  return [cur + d * k, true]
}

const LONG = '#2ff3b3'
const SHORT = '#ff4f80'
const AMBER = '#ffbe55'
const VIOLET = '#9d6bff'

/* ───────────── Gauge ───────────── */

export function Gauge({ value, height = 190 }: { value: number; height?: number }) {
  const cur = useRef(0)
  const ref = useCanvas(
    (ctx, w, h, t) => {
      const [v] = approach(cur.current, value, 0.08)
      cur.current = v
      const cx = w / 2
      const cy = h - 18
      const r = Math.min(w / 2 - 16, h - 34)
      const a0 = Math.PI
      const a1 = 2 * Math.PI

      // track
      ctx.lineCap = 'round'
      ctx.lineWidth = 14
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath()
      ctx.arc(cx, cy, r, a0, a1)
      ctx.stroke()

      // gradient arc
      const g = ctx.createConicGradient(Math.PI, cx, cy)
      g.addColorStop(0, SHORT)
      g.addColorStop(0.25, AMBER)
      g.addColorStop(0.5, LONG)
      g.addColorStop(1, LONG)
      ctx.strokeStyle = g
      ctx.globalAlpha = 0.28
      ctx.beginPath()
      ctx.arc(cx, cy, r, a0, a1)
      ctx.stroke()
      ctx.globalAlpha = 1

      // active segment from centre to value
      const av = a0 + ((v + 100) / 200) * Math.PI
      const mid = a0 + Math.PI / 2
      ctx.shadowColor = v >= 0 ? LONG : SHORT
      ctx.shadowBlur = 22
      ctx.strokeStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, Math.min(mid, av), Math.max(mid, av))
      ctx.stroke()
      ctx.shadowBlur = 0

      // ticks
      for (let i = 0; i <= 40; i++) {
        const a = a0 + (i / 40) * Math.PI
        const major = i % 10 === 0
        const r1 = r - 18
        const r2 = r - (major ? 28 : 23)
        ctx.strokeStyle = major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'
        ctx.lineWidth = major ? 1.5 : 1
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
        ctx.stroke()
      }

      // needle
      const nr = r - 36
      const pulse = 1 + Math.sin(t / 400) * 0.15
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.shadowColor = '#fff'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(av) * nr, cy + Math.sin(av) * nr)
      ctx.stroke()
      ctx.shadowBlur = 0
      // tip on arc
      ctx.fillStyle = '#fff'
      ctx.shadowColor = v >= 0 ? LONG : SHORT
      ctx.shadowBlur = 20 * pulse
      ctx.beginPath()
      ctx.arc(cx + Math.cos(av) * r, cy + Math.sin(av) * r, 6.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      // hub
      const hg = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 12)
      hg.addColorStop(0, '#fff')
      hg.addColorStop(1, '#5a4b8a')
      ctx.fillStyle = hg
      ctx.beginPath()
      ctx.arc(cx, cy, 9, 0, Math.PI * 2)
      ctx.fill()

      ctx.font = '500 10px "JetBrains Mono Variable", monospace'
      ctx.fillStyle = 'rgba(232,230,255,0.38)'
      ctx.textAlign = 'left'
      ctx.fillText('SHORT', cx - r - 6, cy + 16)
      ctx.textAlign = 'right'
      ctx.fillText('LONG', cx + r + 6, cy + 16)
      return true // keep pulsing
    },
    [value],
  )
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

/* ───────────── Radar ───────────── */

export function Radar({ items, height = 280 }: { items: { label: string; value: number }[]; height?: number }) {
  const cur = useRef<number[]>([])
  const ref = useCanvas(
    (ctx, w, h, t) => {
      const n = items.length
      if (!n) return
      cur.current = items.map((it, i) => approach(cur.current[i] ?? 0, (it.value + 1) / 2, 0.08)[0])
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2 - 38
      const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2

      // rings
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          const a = ang(i % n)
          const rr = (R * k) / 4
          const x = cx + Math.cos(a) * rr
          const y = cy + Math.sin(a) * rr
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        }
        ctx.strokeStyle = k === 2 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'
        ctx.setLineDash(k === 2 ? [3, 4] : [])
        ctx.stroke()
      }
      ctx.setLineDash([])
      // spokes + labels
      ctx.font = '500 10.5px "Onest Variable", sans-serif'
      items.forEach((it, i) => {
        const a = ang(i)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
        ctx.stroke()
        const lx = cx + Math.cos(a) * (R + 20)
        const ly = cy + Math.sin(a) * (R + 16)
        ctx.textAlign = Math.abs(Math.cos(a)) < 0.2 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = it.value > 0.15 ? 'rgba(47,243,179,0.9)' : it.value < -0.15 ? 'rgba(255,79,128,0.9)' : 'rgba(232,230,255,0.5)'
        ctx.fillText(it.label, lx, ly)
      })

      // polygon
      const pts = cur.current.map((v, i) => {
        const a = ang(i)
        const rr = R * (0.08 + v * 0.92)
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]
      })
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0, 'rgba(157,107,255,0.05)')
      g.addColorStop(1, 'rgba(82,200,255,0.35)')
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = 'rgba(196,166,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.shadowColor = VIOLET
      ctx.shadowBlur = 16
      ctx.stroke()
      ctx.shadowBlur = 0
      pts.forEach(([x, y], i) => {
        ctx.fillStyle = items[i].value >= 0 ? LONG : SHORT
        ctx.beginPath()
        ctx.arc(x, y, 3 + Math.sin(t / 500 + i) * 0.6, 0, Math.PI * 2)
        ctx.fill()
      })
      return true
    },
    [items],
  )
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

/* ───────────── Depth chart ───────────── */

export function DepthChart({
  bids,
  asks,
  height = 150,
}: {
  bids: { price: number; size: number }[]
  asks: { price: number; size: number }[]
  height?: number
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!bids.length || !asks.length) return
      const cb: [number, number][] = []
      const ca: [number, number][] = []
      let s = 0
      for (const l of bids) cb.push([l.price, (s += l.size)])
      s = 0
      for (const l of asks) ca.push([l.price, (s += l.size)])
      const minP = cb.at(-1)![0]
      const maxP = ca.at(-1)![0]
      const maxV = Math.max(cb.at(-1)![1], ca.at(-1)![1])
      const pad = 4
      const X = (p: number) => pad + ((p - minP) / (maxP - minP || 1)) * (w - pad * 2)
      const Y = (v: number) => h - 16 - (v / maxV) * (h - 28)

      const area = (pts: [number, number][], color: string, dir: 1 | -1) => {
        ctx.beginPath()
        ctx.moveTo(X(pts[0][0]), h - 16)
        let prevY = h - 16
        for (const [p, v] of pts) {
          ctx.lineTo(X(p), prevY)
          ctx.lineTo(X(p), Y(v))
          prevY = Y(v)
        }
        ctx.lineTo(dir === -1 ? pad : w - pad, prevY)
        ctx.lineTo(dir === -1 ? pad : w - pad, h - 16)
        ctx.closePath()
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, color + '55')
        g.addColorStop(1, color + '05')
        ctx.fillStyle = g
        ctx.fill()
        ctx.beginPath()
        prevY = h - 16
        ctx.moveTo(X(pts[0][0]), h - 16)
        for (const [p, v] of pts) {
          ctx.lineTo(X(p), prevY)
          ctx.lineTo(X(p), Y(v))
          prevY = Y(v)
        }
        ctx.lineTo(dir === -1 ? pad : w - pad, prevY)
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.shadowColor = color
        ctx.shadowBlur = 10
        ctx.stroke()
        ctx.shadowBlur = 0
      }
      area(cb, LONG, -1)
      area(ca, SHORT, 1)
      const mid = (bids[0].price + asks[0].price) / 2
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(X(mid), 6)
      ctx.lineTo(X(mid), h - 16)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '500 10px "JetBrains Mono Variable", monospace'
      ctx.fillStyle = 'rgba(232,230,255,0.4)'
      ctx.textAlign = 'left'
      ctx.fillText(minP.toFixed(2), pad, h - 3)
      ctx.textAlign = 'right'
      ctx.fillText(maxP.toFixed(2), w - pad, h - 3)
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(232,230,255,0.75)'
      ctx.fillText(mid.toFixed(2), X(mid), h - 3)
    },
    [bids, asks],
  )
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

/* ───────────── Sparkline / area ───────────── */

export function Spark({
  data,
  height = 56,
  color,
  fill = true,
  baseline,
}: {
  data: number[]
  height?: number
  color?: string
  fill?: boolean
  baseline?: number
}) {
  const prog = useRef(0)
  const ref = useCanvas(
    (ctx, w, h) => {
      if (data.length < 2) return
      const [p, moving] = approach(prog.current, 1, 0.06)
      prog.current = p
      const min = Math.min(...data, baseline ?? Infinity)
      const max = Math.max(...data, baseline ?? -Infinity)
      const c = color ?? (data.at(-1)! >= data[0] ? LONG : SHORT)
      const X = (i: number) => (i / (data.length - 1)) * w
      const Y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (h - 8)
      const n = Math.max(2, Math.floor(data.length * p))
      ctx.beginPath()
      for (let i = 0; i < n; i++) i ? ctx.lineTo(X(i), Y(data[i])) : ctx.moveTo(X(i), Y(data[i]))
      ctx.strokeStyle = c
      ctx.lineWidth = 1.6
      ctx.lineJoin = 'round'
      ctx.shadowColor = c
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.shadowBlur = 0
      if (fill) {
        ctx.lineTo(X(n - 1), h)
        ctx.lineTo(0, h)
        ctx.closePath()
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, c + '40')
        g.addColorStop(1, c + '00')
        ctx.fillStyle = g
        ctx.fill()
      }
      if (baseline != null) {
        ctx.setLineDash([2, 4])
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.beginPath()
        ctx.moveTo(0, Y(baseline))
        ctx.lineTo(w, Y(baseline))
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(X(n - 1), Y(data[n - 1]), 3, 0, Math.PI * 2)
      ctx.fill()
      return moving
    },
    [data, color],
  )
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

/* ───────────── Ring (donut progress) ───────────── */

export function Ring({ value, size = 96, color = LONG, label }: { value: number; size?: number; color?: string; label?: string }) {
  const cur = useRef(0)
  const ref = useCanvas(
    (ctx, w, h) => {
      const [v, moving] = approach(cur.current, Math.max(0, Math.min(1, value)), 0.07)
      cur.current = v
      const r = Math.min(w, h) / 2 - 8
      const cx = w / 2
      const cy = h / 2
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#f5f4fc'
      ctx.font = `600 ${Math.round(size / 5)}px "JetBrains Mono Variable", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label ?? `${Math.round(v * 100)}%`, cx, cy + 1)
      return moving
    },
    [value, color, label],
  )
  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} />
}

/* ───────────── Pressure bar (buy vs sell) ───────────── */

export function Pressure({ buy, height = 10 }: { buy: number; height?: number }) {
  const cur = useRef(0.5)
  const ref = useCanvas(
    (ctx, w, h, t) => {
      const [v] = approach(cur.current, buy, 0.08)
      cur.current = v
      const x = w * v
      const r = h / 2
      const rr = (x0: number, x1: number) => {
        ctx.beginPath()
        ctx.roundRect(x0, 0, Math.max(0, x1 - x0), h, r)
      }
      const g1 = ctx.createLinearGradient(0, 0, x, 0)
      g1.addColorStop(0, LONG + '30')
      g1.addColorStop(1, LONG)
      rr(0, x - 2)
      ctx.fillStyle = g1
      ctx.fill()
      const g2 = ctx.createLinearGradient(x, 0, w, 0)
      g2.addColorStop(0, SHORT)
      g2.addColorStop(1, SHORT + '30')
      rr(x + 2, w)
      ctx.fillStyle = g2
      ctx.fill()
      // shimmer
      const sx = ((t / 12) % (w + 80)) - 40
      const sg = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0)
      sg.addColorStop(0, 'rgba(255,255,255,0)')
      sg.addColorStop(0.5, 'rgba(255,255,255,0.35)')
      sg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = sg
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      return true
    },
    [buy],
  )
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

/* ───────────── Neural core: live visualisation of the ensemble ───────────── */

interface Particle {
  i: number // input index
  j: number // hidden index
  p: number // progress 0..2 (0-1 input→hidden, 1-2 hidden→output)
  s: number // speed
  c: string
}

const W_SEED = Array.from({ length: 9 * 5 }, (_, k) => Math.sin(k * 12.9898 + 4.1414) * 0.9)

export function NeuralCore({
  inputs,
  score,
  label,
  height = 380,
}: {
  inputs: { label: string; value: number }[]
  score: number
  label: string
  height?: number
}) {
  const cur = useRef<number[]>([])
  const sc = useRef(0)
  const parts = useRef<Particle[]>([])
  const last = useRef(0)
  const ref = useCanvas(
    (ctx, w, h, t) => {
      const dt = Math.min(50, t - (last.current || t))
      last.current = t
      const n = inputs.length
      if (!n) return true
      cur.current = inputs.map((it, i) => approach(cur.current[i] ?? 0, it.value, 0.06)[0])
      sc.current = approach(sc.current, score, 0.06)[0]
      const compact = w < 560
      const xi = compact ? 96 : 150
      const xo = w - (compact ? 56 : 110)
      const xh = (xi + xo) / 2
      const pad = 26
      const yi = (i: number) => pad + (i / (n - 1)) * (h - pad * 2)
      const H = 5
      const yh = (j: number) => h / 2 + (j - (H - 1) / 2) * Math.min(62, (h - 80) / (H - 1))
      const yo = h / 2
      const hid = Array.from({ length: H }, (_, j) => Math.tanh(cur.current.reduce((s, v, i) => s + v * (0.6 + W_SEED[i * H + j]), 0) / 2.2))
      const outCol = sc.current > 18 ? LONG : sc.current < -18 ? SHORT : AMBER
      const col = (v: number) => (v >= 0 ? LONG : SHORT)

      // bezier helper
      const pt = (x0: number, y0: number, x1: number, y1: number, u: number) => {
        const cx = (x0 + x1) / 2
        const a = (1 - u) ** 3
        const b = 3 * (1 - u) ** 2 * u
        const c = 3 * (1 - u) * u * u
        const d = u ** 3
        return [a * x0 + b * cx + c * cx + d * x1, a * y0 + b * y0 + c * y1 + d * y1]
      }
      const curve = (x0: number, y0: number, x1: number, y1: number) => {
        const cx = (x0 + x1) / 2
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1)
      }

      // edges
      for (let i = 0; i < n; i++)
        for (let j = 0; j < H; j++) {
          const v = cur.current[i]
          curve(xi, yi(i), xh, yh(j))
          ctx.strokeStyle = v >= 0 ? `rgba(47,243,179,${0.03 + Math.abs(v) * 0.14})` : `rgba(255,79,128,${0.03 + Math.abs(v) * 0.14})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      for (let j = 0; j < H; j++) {
        curve(xh, yh(j), xo, yo)
        const v = hid[j]
        ctx.strokeStyle = v >= 0 ? `rgba(47,243,179,${0.08 + Math.abs(v) * 0.3})` : `rgba(255,79,128,${0.08 + Math.abs(v) * 0.3})`
        ctx.lineWidth = 1 + Math.abs(v) * 1.5
        ctx.stroke()
      }

      // spawn particles
      for (let i = 0; i < n; i++) {
        const v = cur.current[i]
        if (Math.random() < Math.abs(v) * 0.09 * (dt / 16) + 0.004)
          parts.current.push({ i, j: Math.floor(Math.random() * H), p: 0, s: 0.0006 + Math.random() * 0.0005, c: col(v) })
      }
      if (parts.current.length > 260) parts.current.splice(0, parts.current.length - 260)
      ctx.globalCompositeOperation = 'lighter'
      parts.current = parts.current.filter((q) => {
        q.p += q.s * dt
        if (q.p >= 2) return false
        const [x, y] = q.p < 1 ? pt(xi, yi(q.i), xh, yh(q.j), q.p) : pt(xh, yh(q.j), xo, yo, q.p - 1)
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6)
        g.addColorStop(0, q.c)
        g.addColorStop(1, q.c + '00')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        return true
      })
      ctx.globalCompositeOperation = 'source-over'

      // input nodes + labels
      ctx.textBaseline = 'middle'
      for (let i = 0; i < n; i++) {
        const v = cur.current[i]
        const y = yi(i)
        const c = Math.abs(v) < 0.08 ? 'rgba(232,230,255,0.5)' : col(v)
        ctx.shadowColor = c
        ctx.shadowBlur = 8 + Math.abs(v) * 14
        ctx.fillStyle = '#0d0b18'
        ctx.beginPath()
        ctx.arc(xi, y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = c
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(xi, y, 2.5 + Math.abs(v) * 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.textAlign = 'right'
        ctx.font = `500 ${compact ? 10.5 : 12}px "Onest Variable", sans-serif`
        ctx.fillStyle = 'rgba(245,244,252,0.85)'
        ctx.fillText(inputs[i].label, xi - 16, y - (compact ? 0 : 6))
        if (!compact) {
          ctx.font = '500 10.5px "JetBrains Mono Variable", monospace'
          ctx.fillStyle = c
          ctx.fillText(`${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}`, xi - 16, y + 8)
        }
      }

      // hidden nodes
      for (let j = 0; j < H; j++) {
        const v = hid[j]
        const r = 9 + Math.abs(v) * 4 + Math.sin(t / 300 + j) * 0.8
        const g = ctx.createRadialGradient(xh - 2, yh(j) - 2, 1, xh, yh(j), r)
        g.addColorStop(0, '#fff')
        g.addColorStop(0.4, v >= 0 ? 'rgba(47,243,179,0.8)' : 'rgba(255,79,128,0.8)')
        g.addColorStop(1, 'rgba(157,107,255,0.15)')
        ctx.shadowColor = col(v)
        ctx.shadowBlur = 18 * Math.abs(v)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(xh, yh(j), r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // output node
      const R = compact ? 34 : 46
      const pulse = 1 + Math.sin(t / 380) * 0.05
      for (let k = 3; k >= 1; k--) {
        ctx.strokeStyle = outCol
        ctx.globalAlpha = 0.12 / k
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(xo, yo, R * pulse + k * 12 + ((t / 30) % 12), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      const og = ctx.createRadialGradient(xo - R * 0.3, yo - R * 0.3, 2, xo, yo, R)
      og.addColorStop(0, 'rgba(255,255,255,0.35)')
      og.addColorStop(0.5, '#1a1530')
      og.addColorStop(1, '#0d0b18')
      ctx.shadowColor = outCol
      ctx.shadowBlur = 40
      ctx.fillStyle = og
      ctx.beginPath()
      ctx.arc(xo, yo, R * pulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.lineWidth = 2
      ctx.strokeStyle = outCol
      ctx.stroke()
      // score arc
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(xo, yo, R * pulse + 6, -Math.PI / 2, -Math.PI / 2 + (Math.abs(sc.current) / 100) * Math.PI * 2 * Math.sign(sc.current || 1), sc.current < 0)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${compact ? 17 : 22}px "JetBrains Mono Variable", monospace`
      ctx.fillText(`${sc.current > 0 ? '+' : ''}${sc.current.toFixed(0)}`, xo, yo - 4)
      ctx.font = `600 ${compact ? 8.5 : 10}px "Unbounded", sans-serif`
      ctx.fillStyle = outCol
      ctx.fillText(label, xo, yo + (compact ? 13 : 16))

      // column captions
      if (!compact) {
        ctx.font = '500 9.5px "JetBrains Mono Variable", monospace'
        ctx.fillStyle = 'rgba(232,230,255,0.3)'
        ctx.textAlign = 'center'
        ctx.fillText('HIDDEN LAYER', xh, h - 6)
        ctx.fillText('OUTPUT', xo, h - 6)
      }
      return true
    },
    [inputs, score, label],
  )
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

/* ───────────── Price line with AI forecast (fintech style) ───────────── */

export function PriceLine({
  points,
  forecast,
  height = 240,
  color = '#7c5cff',
}: {
  points: { t: number; v: number }[]
  forecast?: { t: number; v: number; lo: number; hi: number }[]
  height?: number
  color?: string
}) {
  const prog = useRef(0)
  const hover = useRef<number | null>(null)
  const ref = useCanvas(
    (ctx, w, h) => {
      if (points.length < 2) return
      const [p, moving] = approach(prog.current, 1, 0.07)
      prog.current = p
      const fc = forecast ?? []
      const n = points.length + Math.max(0, fc.length - 1)
      const vals = [...points.map((x) => x.v), ...fc.flatMap((f) => [f.lo, f.hi])]
      const mn = Math.min(...vals)
      const mx = Math.max(...vals)
      const pad = (mx - mn) * 0.08 || 1
      const top = 8
      const bot = h - 22
      const X = (i: number) => (i / (n - 1)) * (w - 8)
      const Y = (v: number) => bot - ((v - mn + pad) / (mx - mn + pad * 2)) * (bot - top)
      const k = Math.max(2, Math.floor(points.length * p))

      // forecast band + line
      if (fc.length > 1 && p > 0.98) {
        const o = points.length - 1
        ctx.beginPath()
        fc.forEach((f, i) => (i ? ctx.lineTo(X(o + i), Y(f.hi)) : ctx.moveTo(X(o), Y(f.hi))))
        for (let i = fc.length - 1; i >= 0; i--) ctx.lineTo(X(o + i), Y(fc[i].lo))
        ctx.closePath()
        const bg = ctx.createLinearGradient(X(o), 0, w, 0)
        bg.addColorStop(0, 'rgba(20,241,149,0.02)')
        bg.addColorStop(1, 'rgba(20,241,149,0.14)')
        ctx.fillStyle = bg
        ctx.fill()
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        fc.forEach((f, i) => (i ? ctx.lineTo(X(o + i), Y(f.v)) : ctx.moveTo(X(o), Y(f.v))))
        ctx.strokeStyle = '#14f195'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = '600 10.5px "Onest Variable", sans-serif'
        ctx.fillStyle = '#14f195'
        ctx.textAlign = 'right'
        ctx.fillText('AI forecast', w - 8, Y(fc.at(-1)!.hi) - 8)
      }

      // area
      const g = ctx.createLinearGradient(0, top, 0, bot)
      g.addColorStop(0, color + '44')
      g.addColorStop(1, color + '00')
      ctx.beginPath()
      for (let i = 0; i < k; i++) i ? ctx.lineTo(X(i), Y(points[i].v)) : ctx.moveTo(X(i), Y(points[i].v))
      ctx.lineTo(X(k - 1), bot)
      ctx.lineTo(0, bot)
      ctx.closePath()
      ctx.fillStyle = g
      ctx.fill()
      ctx.beginPath()
      for (let i = 0; i < k; i++) i ? ctx.lineTo(X(i), Y(points[i].v)) : ctx.moveTo(X(i), Y(points[i].v))
      ctx.strokeStyle = color
      ctx.lineWidth = 2.2
      ctx.lineJoin = 'round'
      ctx.stroke()

      // live dot
      const lx = X(k - 1)
      const ly = Y(points[k - 1].v)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = color + '55'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(lx, ly, 8, 0, Math.PI * 2)
      ctx.stroke()

      // hover
      const hx = hover.current
      if (hx != null && p > 0.98) {
        const i = Math.max(0, Math.min(points.length - 1, Math.round((hx / (w - 8)) * (n - 1))))
        const x = X(i)
        const y = Y(points[i].v)
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x, bot)
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
        const d = new Date(points[i].t * 1000)
        const label = `$${points[i].v.toFixed(2)} · ${d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        ctx.font = '600 11px "Onest Variable", sans-serif'
        const tw = ctx.measureText(label).width + 18
        const bx = Math.min(Math.max(x - tw / 2, 0), w - tw)
        ctx.fillStyle = '#f4f5f7'
        ctx.beginPath()
        ctx.roundRect(bx, top, tw, 24, 12)
        ctx.fill()
        ctx.fillStyle = '#0c0d12'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, bx + 9, top + 12.5)
        ctx.textBaseline = 'alphabetic'
      }

      // time axis
      ctx.font = '500 10px "Onest Variable", sans-serif'
      ctx.fillStyle = 'rgba(139,141,152,0.8)'
      ctx.textAlign = 'center'
      for (let j = 0; j < 4; j++) {
        const i = Math.floor((j / 3) * (points.length - 1))
        const d = new Date(points[i].t * 1000)
        const span = points.at(-1)!.t - points[0].t
        const txt = span > 2 * 86400 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        ctx.textAlign = j === 0 ? 'left' : j === 3 ? 'right' : 'center'
        ctx.fillText(txt, X(i), h - 4)
      }
      return moving
    },
    [points, forecast, color],
  )
  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height, display: 'block', cursor: 'crosshair' }}
      onPointerMove={(e) => {
        hover.current = e.clientX - e.currentTarget.getBoundingClientRect().left
        ;(e.currentTarget as any).__kick?.()
      }}
      onPointerLeave={(e) => {
        hover.current = null
        ;(e.currentTarget as any).__kick?.()
      }}
    />
  )
}
