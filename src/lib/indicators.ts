import type { Candle } from '../data/types'

export type Series = (number | null)[]

export function sma(v: number[], n: number): Series {
  const out: Series = new Array(v.length).fill(null)
  let s = 0
  for (let i = 0; i < v.length; i++) {
    s += v[i]
    if (i >= n) s -= v[i - n]
    if (i >= n - 1) out[i] = s / n
  }
  return out
}

export function ema(v: number[], n: number): Series {
  const out: Series = new Array(v.length).fill(null)
  if (v.length < n) return out
  const k = 2 / (n + 1)
  let prev = v.slice(0, n).reduce((a, b) => a + b, 0) / n
  out[n - 1] = prev
  for (let i = n; i < v.length; i++) {
    prev = v[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function rsi(v: number[], n = 14): Series {
  const out: Series = new Array(v.length).fill(null)
  if (v.length <= n) return out
  let g = 0
  let l = 0
  for (let i = 1; i <= n; i++) {
    const d = v[i] - v[i - 1]
    if (d > 0) g += d
    else l -= d
  }
  g /= n
  l /= n
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]
    g = (g * (n - 1) + Math.max(d, 0)) / n
    l = (l * (n - 1) + Math.max(-d, 0)) / n
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return out
}

export function macd(v: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(v, fast)
  const s = ema(v, slow)
  const line: Series = v.map((_, i) => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null))
  const start = line.findIndex((x) => x != null)
  const sig: Series = new Array(v.length).fill(null)
  if (start >= 0) {
    const e = ema(line.slice(start) as number[], signal)
    e.forEach((x, i) => (sig[start + i] = x))
  }
  const hist: Series = line.map((x, i) => (x != null && sig[i] != null ? x - sig[i]! : null))
  return { line, signal: sig, hist }
}

export function bollinger(v: number[], n = 20, k = 2) {
  const mid = sma(v, n)
  const upper: Series = new Array(v.length).fill(null)
  const lower: Series = new Array(v.length).fill(null)
  for (let i = n - 1; i < v.length; i++) {
    const m = mid[i]!
    let s = 0
    for (let j = i - n + 1; j <= i; j++) s += (v[j] - m) ** 2
    const sd = Math.sqrt(s / n)
    upper[i] = m + k * sd
    lower[i] = m - k * sd
  }
  return { mid, upper, lower }
}

export function atr(c: Candle[], n = 14): Series {
  const tr = c.map((x, i) =>
    i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)),
  )
  const out: Series = new Array(c.length).fill(null)
  if (c.length < n) return out
  let prev = tr.slice(0, n).reduce((a, b) => a + b, 0) / n
  out[n - 1] = prev
  for (let i = n; i < c.length; i++) {
    prev = (prev * (n - 1) + tr[i]) / n
    out[i] = prev
  }
  return out
}

export function stoch(c: Candle[], n = 14): Series {
  return c.map((x, i) => {
    if (i < n - 1) return null
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - n + 1; j <= i; j++) {
      hi = Math.max(hi, c[j].high)
      lo = Math.min(lo, c[j].low)
    }
    return hi === lo ? 50 : ((x.close - lo) / (hi - lo)) * 100
  })
}

export function obv(c: Candle[]): number[] {
  let s = 0
  return c.map((x, i) => {
    if (i > 0) s += x.close > c[i - 1].close ? x.volume : x.close < c[i - 1].close ? -x.volume : 0
    return s
  })
}

export function vwap(c: Candle[]): number {
  let pv = 0
  let v = 0
  for (const x of c) {
    pv += ((x.high + x.low + x.close) / 3) * x.volume
    v += x.volume
  }
  return v ? pv / v : c.at(-1)?.close ?? 0
}

/** Least-squares slope of the last n values, normalised by their mean (per bar). */
export function slope(v: number[], n: number): number {
  const s = v.slice(-n)
  const m = s.length
  if (m < 3) return 0
  const xm = (m - 1) / 2
  const ym = s.reduce((a, b) => a + b, 0) / m
  let num = 0
  let den = 0
  s.forEach((y, x) => {
    num += (x - xm) * (y - ym)
    den += (x - xm) ** 2
  })
  return ym === 0 ? 0 : num / den / Math.abs(ym)
}

/** Swing pivots → clustered support / resistance levels. */
export function levels(c: Candle[], lookback = 5, maxLevels = 4) {
  const piv: { price: number; kind: 'hi' | 'lo' }[] = []
  for (let i = lookback; i < c.length - lookback; i++) {
    let isHi = true
    let isLo = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (c[j].high > c[i].high) isHi = false
      if (c[j].low < c[i].low) isLo = false
    }
    if (isHi) piv.push({ price: c[i].high, kind: 'hi' })
    if (isLo) piv.push({ price: c[i].low, kind: 'lo' })
  }
  const last = c.at(-1)?.close ?? 0
  const tol = last * 0.004
  const clusters: { price: number; touches: number }[] = []
  for (const p of piv) {
    const cl = clusters.find((x) => Math.abs(x.price - p.price) < tol)
    if (cl) {
      cl.price = (cl.price * cl.touches + p.price) / (cl.touches + 1)
      cl.touches++
    } else clusters.push({ price: p.price, touches: 1 })
  }
  const sup = clusters
    .filter((x) => x.price < last)
    .sort((a, b) => b.price - a.price)
    .slice(0, maxLevels / 2)
  const res = clusters
    .filter((x) => x.price > last)
    .sort((a, b) => a.price - b.price)
    .slice(0, maxLevels / 2)
  return { support: sup, resistance: res }
}
