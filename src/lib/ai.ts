import type { Candle, OrderBook, Trade } from '../data/types'
import { atr, bollinger, ema, levels, macd, obv, rsi, slope, stoch, vwap } from './indicators'

/**
 * Sola AI signal engine.
 * An ensemble of normalised market "experts" whose votes are weighted and
 * blended into a single score (-100…100) with a confidence estimate.
 * Everything runs in the browser on live exchange data.
 */

export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL'

export interface Factor {
  key: string
  label: string
  value: number // -1 … 1 (bearish … bullish)
  weight: number
  detail: string
}

export interface ForecastPoint {
  time: number
  value: number
  upper: number
  lower: number
}

export interface Signal {
  score: number
  direction: Direction
  expectedPct: number
  waitReason: 'weak' | 'small-move' | null
  confidence: number
  factors: Factor[]
  forecast: ForecastPoint[]
  target: number
  price: number
  atr: number
  rsi: number
  volatility: number // % per bar
  regime: string
  support: { price: number; touches: number }[]
  resistance: { price: number; touches: number }[]
  plan: { entry: number; stop: number; take: number; rr: number } | null
  summary: string[]
  history: number[] // per-bar score (candle-only experts)
}

/** Round-trip taker fees (0.1%) + spread/slippage buffer. */
export const MIN_EDGE_PCT = 0.25

const tanh = Math.tanh
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

export interface Ctx {
  c: Candle[]
  close: number[]
  e9: (number | null)[]
  e21: (number | null)[]
  e50: (number | null)[]
  e200: (number | null)[]
  r: (number | null)[]
  m: ReturnType<typeof macd>
  bb: ReturnType<typeof bollinger>
  a: (number | null)[]
  st: (number | null)[]
  ob: number[]
}

export function buildCtx(c: Candle[]): Ctx {
  const close = c.map((x) => x.close)
  return {
    c,
    close,
    e9: ema(close, 9),
    e21: ema(close, 21),
    e50: ema(close, 50),
    e200: ema(close, 200),
    r: rsi(close, 14),
    m: macd(close),
    bb: bollinger(close, 20, 2),
    a: atr(c, 14),
    st: stoch(c, 14),
    ob: obv(c),
  }
}

/** Candle-based experts evaluated at bar i. */
export function expertsAt(x: Ctx, i: number) {
  const px = x.close[i]
  const A = x.a[i] ?? px * 0.005
  const e21 = x.e21[i] ?? px
  const e50 = x.e50[i] ?? px
  const e200 = x.e200[i] ?? e50

  const trend = tanh(((e21 - e50) / A) * 0.9) * 0.75 + tanh(((px - e200) / A) * 0.25) * 0.25
  const hist = x.m.hist[i] ?? 0
  const prevHist = x.m.hist[i - 1] ?? hist
  const momentum = tanh((hist / A) * 4) * 0.7 + tanh(((hist - prevHist) / A) * 12) * 0.3

  const R = x.r[i] ?? 50
  const rsiV = R > 70 ? -tanh((R - 70) / 8) : R < 30 ? tanh((30 - R) / 8) : ((R - 50) / 20) * 0.45

  const up = x.bb.upper[i]
  const lo = x.bb.lower[i]
  const pb = up != null && lo != null && up !== lo ? (px - lo) / (up - lo) : 0.5
  const bands = pb > 1 ? -0.8 : pb < 0 ? 0.8 : -(pb - 0.5) * 0.9

  const j0 = Math.max(0, i - 20)
  const vol = x.c.slice(j0, i + 1).reduce((s, k) => s + k.volume, 0) || 1
  const volume = tanh(((x.ob[i] - x.ob[j0]) / vol) * 2.2)

  const reg = slope(x.close.slice(0, i + 1), 30)
  const regression = tanh((reg / (A / px)) * 8)

  const S = x.st[i] ?? 50
  const osc = S > 85 ? -0.6 : S < 15 ? 0.6 : ((S - 50) / 50) * 0.3

  return { trend, momentum, rsi: rsiV, bands, volume, regression, osc, R, A, pb, S, reg }
}

const W = { trend: 1.4, momentum: 1.2, rsi: 0.9, bands: 0.7, volume: 0.8, regression: 1.1, osc: 0.5, book: 0.9, flow: 0.9 }

export function scoreAt(x: Ctx, i: number) {
  const e = expertsAt(x, i)
  const s =
    (e.trend * W.trend +
      e.momentum * W.momentum +
      e.rsi * W.rsi +
      e.bands * W.bands +
      e.volume * W.volume +
      e.regression * W.regression +
      e.osc * W.osc) /
    (W.trend + W.momentum + W.rsi + W.bands + W.volume + W.regression + W.osc)
  return clamp(s * 160, -100, 100)
}

const fmt = (v: number) => v.toFixed(v > 100 ? 2 : 3)

export function analyze(c: Candle[], book: OrderBook | null, trades: Trade[], horizon = 24, step = 60): Signal | null {
  if (c.length < 60) return null
  const x = buildCtx(c)
  const i = c.length - 1
  const e = expertsAt(x, i)
  const px = x.close[i]

  // live micro-structure experts
  let bookV = 0
  let bookDetail = 'no order book data'
  if (book && book.bids.length && book.asks.length) {
    const bs = book.bids.slice(0, 20).reduce((s, l) => s + l.size, 0)
    const as = book.asks.slice(0, 20).reduce((s, l) => s + l.size, 0)
    bookV = clamp(((bs - as) / (bs + as)) * 1.6, -1, 1)
    bookDetail = `bids ${Math.round((bs / (bs + as)) * 100)}% / asks ${Math.round((as / (bs + as)) * 100)}%`
  }
  let flowV = 0
  let flowDetail = 'waiting for trades'
  if (trades.length > 5) {
    const b = trades.filter((t) => t.side === 'buy').reduce((s, t) => s + t.size, 0)
    const s = trades.filter((t) => t.side === 'sell').reduce((s2, t) => s2 + t.size, 0)
    flowV = clamp(((b - s) / (b + s || 1)) * 1.4, -1, 1)
    flowDetail = `buys ${Math.round((b / (b + s || 1)) * 100)}% of last ${trades.length} trades`
  }

  const factors: Factor[] = [
    { key: 'trend', label: 'Trend', value: e.trend, weight: W.trend, detail: `EMA21 ${fmt(x.e21[i] ?? px)} vs EMA50 ${fmt(x.e50[i] ?? px)}` },
    { key: 'momentum', label: 'Momentum', value: e.momentum, weight: W.momentum, detail: `MACD hist ${(x.m.hist[i] ?? 0).toFixed(4)}` },
    { key: 'rsi', label: 'RSI', value: e.rsi, weight: W.rsi, detail: `RSI(14) = ${e.R.toFixed(1)}` },
    { key: 'bands', label: 'Bollinger', value: e.bands, weight: W.bands, detail: `%B = ${(e.pb * 100).toFixed(0)}%` },
    { key: 'volume', label: 'Volume', value: e.volume, weight: W.volume, detail: 'OBV slope, 20 bars' },
    { key: 'regression', label: 'Regression', value: e.regression, weight: W.regression, detail: `slope ${(e.reg * 1e4).toFixed(2)} bp/bar` },
    { key: 'osc', label: 'Stochastic', value: e.osc, weight: W.osc, detail: `%K = ${e.S.toFixed(0)}` },
    { key: 'book', label: 'Order book', value: bookV, weight: W.book, detail: bookDetail },
    { key: 'flow', label: 'Trade flow', value: flowV, weight: W.flow, detail: flowDetail },
  ]

  const wsum = factors.reduce((s, f) => s + f.weight, 0)
  const raw = factors.reduce((s, f) => s + f.value * f.weight, 0) / wsum
  const score = clamp(raw * 160, -100, 100)
  let dir: Direction = score > 18 ? 'LONG' : score < -18 ? 'SHORT' : 'NEUTRAL'
  const sign = Math.sign(score) || 1
  const agree = factors.reduce((s, f) => s + (Math.sign(f.value) === sign ? f.weight * Math.abs(f.value) : 0), 0)
  const total = factors.reduce((s, f) => s + f.weight * Math.abs(f.value), 0) || 1
  const confidence = clamp(Math.round(30 + (agree / total) * 45 + Math.abs(score) * 0.25), 12, 97)

  const A = e.A
  const volPct = (A / px) * 100

  // forecast cone: regression drift blended with ensemble bias
  const sd = A / px / 1.6
  const drift = e.reg * 0.6 + (score / 100) * sd * 0.18
  const lastT = c[i].time
  const forecast: ForecastPoint[] = [{ time: lastT, value: px, upper: px, lower: px }]
  for (let t = 1; t <= horizon; t++) {
    const mid = px * Math.exp(drift * t)
    const band = 1.28 * sd * Math.sqrt(t)
    forecast.push({ time: lastT + t * step, value: mid, upper: mid * Math.exp(band), lower: mid * Math.exp(-band) })
  }
  const target = forecast.at(-1)!.value
  const expectedPct = ((target - px) / px) * 100
  // only trade when the expected move clearly beats fees + spread, and agrees with the score
  let waitReason: Signal['waitReason'] = dir === 'NEUTRAL' ? 'weak' : null
  if (dir !== 'NEUTRAL' && (Math.abs(expectedPct) < MIN_EDGE_PCT || Math.sign(expectedPct) !== Math.sign(score))) {
    dir = 'NEUTRAL'
    waitReason = 'small-move'
  }

  const lv = levels(c.slice(-200))
  const trendStr = Math.abs(e.trend)
  const regime =
    volPct > 1.2 && trendStr < 0.3
      ? 'High volatility'
      : trendStr > 0.5
        ? e.trend > 0
          ? 'Uptrend'
          : 'Downtrend'
        : 'Range / accumulation'

  let plan: Signal['plan'] = null
  if (dir !== 'NEUTRAL') {
    // stops sized to volatility, never tighter than normal market noise
    const sDist = Math.max(A * 1.6, px * 0.006)
    const tDist = Math.max(A * 2.8, sDist * 1.75, Math.abs(target - px))
    const stop = dir === 'LONG' ? px - sDist : px + sDist
    const take = dir === 'LONG' ? px + tDist : px - tDist
    plan = { entry: px, stop, take, rr: tDist / sDist }
  }

  const sorted = [...factors].sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight))
  const top = sorted.slice(0, 3)
  const word = (v: number) => (v > 0.15 ? 'bullish' : v < -0.15 ? 'bearish' : 'neutral')
  const summary = [
    dir === 'NEUTRAL'
      ? `No clear edge: score ${score.toFixed(0)}. Market regime: ${regime.toLowerCase()}.`
      : `The ensemble leans ${dir === 'LONG' ? 'long' : 'short'} with ${confidence}% confidence. Regime: ${regime.toLowerCase()}.`,
    `Key drivers: ${top.map((f) => `${f.label.toLowerCase()} (${word(f.value)})`).join(', ')}.`,
    `${horizon}-bar forecast: ${target > px ? 'up' : 'down'} to ${target.toFixed(2)} (${(((target - px) / px) * 100).toFixed(2)}%), 80% band ${forecast.at(-1)!.lower.toFixed(2)} – ${forecast.at(-1)!.upper.toFixed(2)}.`,
    lv.support[0] || lv.resistance[0]
      ? `Nearest levels: support ${lv.support[0]?.price.toFixed(2) ?? '—'}, resistance ${lv.resistance[0]?.price.toFixed(2) ?? '—'}.`
      : 'No significant levels near price.',
  ]

  const history = c.map((_, k) => (k < 50 ? 0 : scoreAt(x, k)))

  return {
    score,
    direction: dir,
    expectedPct,
    waitReason,
    confidence,
    factors,
    forecast,
    target,
    price: px,
    atr: A,
    rsi: e.R,
    volatility: volPct,
    regime,
    support: lv.support,
    resistance: lv.resistance,
    plan,
    summary,
    history,
  }
}

/* ───────────────────────── strategies (bot + backtest) ───────────────────────── */

export type StrategyId = 'ai' | 'trend' | 'revert' | 'breakout'

export const STRATEGIES: Record<StrategyId, { name: string; tag: string; desc: string; hue: number }> = {
  ai: {
    name: 'Neural Ensemble',
    tag: 'AI · 9 experts',
    desc: 'Nine models vote on trend, momentum, oscillators, volume and regression. Enters when the score crosses the threshold.',
    hue: 268,
  },
  trend: {
    name: 'Trend Rider',
    tag: 'Trend · EMA',
    desc: 'Follows the trend: EMA9/EMA21 cross in the direction of EMA50, confirmed by MACD.',
    hue: 160,
  },
  revert: {
    name: 'Mean Reversion',
    tag: 'Counter-trend · RSI',
    desc: 'Fades overbought / oversold moves at the Bollinger bands, exits at the mid line.',
    hue: 200,
  },
  breakout: {
    name: 'Breakout Scout',
    tag: 'Breakout · Donchian',
    desc: 'Enters on a break of the 20-bar high/low with a volume filter.',
    hue: 32,
  },
}

/** Returns +1 (long), -1 (short) or 0 for an entry decision at bar i. */
export function strategySignal(x: Ctx, i: number, id: StrategyId, threshold = 40): number {
  if (i < 50) return 0
  const px = x.close[i]
  switch (id) {
    case 'ai': {
      const s = scoreAt(x, i)
      const p = scoreAt(x, i - 1)
      if (s > threshold && p <= threshold) return 1
      if (s < -threshold && p >= -threshold) return -1
      return 0
    }
    case 'trend': {
      const a = x.e9[i]!
      const b = x.e21[i]!
      const pa = x.e9[i - 1]!
      const pb = x.e21[i - 1]!
      const t = x.e50[i]!
      const h = x.m.hist[i] ?? 0
      if (pa <= pb && a > b && px > t && h > 0) return 1
      if (pa >= pb && a < b && px < t && h < 0) return -1
      return 0
    }
    case 'revert': {
      const R = x.r[i] ?? 50
      const lo = x.bb.lower[i]
      const up = x.bb.upper[i]
      if (lo != null && R < 30 && px < lo) return 1
      if (up != null && R > 70 && px > up) return -1
      return 0
    }
    case 'breakout': {
      const w = x.c.slice(i - 20, i)
      const hi = Math.max(...w.map((k) => k.high))
      const lo = Math.min(...w.map((k) => k.low))
      const avgV = w.reduce((s, k) => s + k.volume, 0) / w.length
      const v = x.c[i].volume
      if (px > hi && v > avgV * 1.2) return 1
      if (px < lo && v > avgV * 1.2) return -1
      return 0
    }
  }
}

export interface BtTrade {
  side: 1 | -1
  entryTime: number
  exitTime: number
  entry: number
  exit: number
  pnl: number
  pnlPct: number
  reason: string
}

export interface BtResult {
  equity: { time: number; value: number }[]
  trades: BtTrade[]
  totalReturn: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  sharpe: number
  buyHold: number
}

export interface BtParams {
  strategy: StrategyId
  capital: number
  riskPct: number // % of equity risked per trade
  slAtr: number
  tpAtr: number
  leverage: number
  threshold: number
  fee: number // per side, fraction
}

export function backtest(c: Candle[], p: BtParams): BtResult {
  const x = buildCtx(c)
  let eq = p.capital
  const equity: BtResult['equity'] = []
  const trades: BtTrade[] = []
  let pos: { side: 1 | -1; entry: number; qty: number; sl: number; tp: number; t: number } | null = null
  let peak = eq
  let mdd = 0
  const rets: number[] = []
  let prevEq = eq

  const close = (i: number, price: number, reason: string) => {
    if (!pos) return
    const gross = (price - pos.entry) * pos.qty * pos.side
    const fees = (price + pos.entry) * pos.qty * p.fee
    const pnl = gross - fees
    eq += pnl
    trades.push({
      side: pos.side,
      entryTime: pos.t,
      exitTime: c[i].time,
      entry: pos.entry,
      exit: price,
      pnl,
      pnlPct: ((price - pos.entry) / pos.entry) * 100 * pos.side,
      reason,
    })
    pos = null
  }

  for (let i = 50; i < c.length; i++) {
    const k = c[i]
    if (pos) {
      const hitSl = pos.side === 1 ? k.low <= pos.sl : k.high >= pos.sl
      const hitTp = pos.side === 1 ? k.high >= pos.tp : k.low <= pos.tp
      if (hitSl) close(i, pos.sl, 'Stop loss')
      else if (hitTp) close(i, pos.tp, 'Take profit')
      else {
        const sig = strategySignal(x, i, p.strategy, p.threshold)
        if (sig === -pos.side) close(i, k.close, 'Signal flip')
        else if (p.strategy === 'revert' && x.bb.mid[i] != null) {
          const mid = x.bb.mid[i]!
          if ((pos.side === 1 && k.close >= mid) || (pos.side === -1 && k.close <= mid)) close(i, k.close, 'Mean reached')
        }
      }
    }
    if (!pos) {
      const sig = strategySignal(x, i, p.strategy, p.threshold)
      if (sig !== 0) {
        const A = x.a[i] ?? k.close * 0.005
        const stopDist = A * p.slAtr
        const riskUsd = eq * (p.riskPct / 100)
        const maxQty = (eq * p.leverage) / k.close
        const qty = Math.min(riskUsd / stopDist, maxQty)
        pos = {
          side: sig as 1 | -1,
          entry: k.close,
          qty,
          sl: k.close - sig * stopDist,
          tp: k.close + sig * A * p.tpAtr,
          t: k.time,
        }
      }
    }
    const mtm = pos ? eq + (k.close - pos.entry) * pos.qty * pos.side : eq
    equity.push({ time: k.time, value: mtm })
    peak = Math.max(peak, mtm)
    mdd = Math.max(mdd, (peak - mtm) / peak)
    rets.push(mtm / prevEq - 1)
    prevEq = mtm
  }
  if (pos) close(c.length - 1, c.at(-1)!.close, 'End of period')

  const wins = trades.filter((t) => t.pnl > 0)
  const gp = wins.reduce((s, t) => s + t.pnl, 0)
  const gl = -trades.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0)
  const mean = rets.reduce((s, r) => s + r, 0) / (rets.length || 1)
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length || 1))
  return {
    equity,
    trades,
    totalReturn: ((eq - p.capital) / p.capital) * 100,
    maxDrawdown: mdd * 100,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: gl ? gp / gl : gp ? Infinity : 0,
    sharpe: sd ? (mean / sd) * Math.sqrt(rets.length) : 0,
    buyHold: ((c.at(-1)!.close - c[50].close) / c[50].close) * 100,
  }
}

export { vwap }
