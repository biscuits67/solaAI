import { create } from 'zustand'
import { useBot } from './bot'
import { useMarket } from './market'
import { think } from './thoughts'
import { equityOf, useTrading, type Side } from './trading'
import { toast, toastMute } from './ui'

/**
 * Timed AI trading sessions (1 / 5 / 10 min).
 * Demo sessions are simulated: a series of trades spread over the session,
 * each one a win or a loss, so a session can end in profit or in loss. Longer
 * sessions trade more, so their results move further in either direction.
 */

export interface SessionResult {
  minutes: number
  startedAt: number
  endedAt: number
  startEquity: number
  endEquity: number
  pnl: number
  trades: number
  wins: number
  best: number
  fees: number
  realised: number
  stoppedByLimit: boolean
  samples: { t: number; v: number }[]
  price: number
}

interface Planned {
  openAt: number
  closeAt: number
  side: Side
  profit: number
  posId?: string
  done?: boolean
}

interface Active {
  minutes: number
  startedAt: number
  endsAt: number
  startEquity: number
  scripted: boolean
  plan: Planned[]
  samples: { t: number; v: number }[]
  prevThreshold: number
  maxLoss: number
}

interface S {
  active: Active | null
  result: SessionResult | null
  start: (minutes: number) => void
  stop: () => void
  dismiss: () => void
}

const eq = () => equityOf(useTrading.getState(), useMarket.getState().price)

export const useSession = create<S>((set, get) => ({
  active: null,
  result: null,

  start: (minutes) => {
    if (get().active) return
    const now = Date.now()
    const startEquity = eq()
    const scripted = true
    const bot = useBot.getState()
    const plan = buildPlan(minutes, now, startEquity, sessionPlan(minutes, startEquity, bot.riskPct).maxLoss)
    set({
      active: {
        minutes,
        startedAt: now,
        endsAt: now + minutes * 60_000,
        startEquity,
        scripted,
        plan,
        samples: [{ t: now, v: startEquity }],
        prevThreshold: bot.threshold,
        maxLoss: sessionPlan(minutes, startEquity, bot.riskPct).maxLoss,
      },
      result: null,
    })
    toastMute.bot = true
    if (!bot.enabled) bot.toggle(true)
    toast(`${minutes}-minute AI session started`, 'You can end it at any time', 'long')
    think('BOT', `AI session started for ${minutes} minute${minutes > 1 ? 's' : ''}.`, 'bull')
  },

  stop: () => finish(false),
  dismiss: () => set({ result: null }),
}))

function finish(byLimit = false) {
  const s = useSession.getState().active
  if (!s) return
  const tr = useTrading.getState()
  const price = useMarket.getState().price
  // close anything the bot still holds
  for (const p of tr.positions.filter((p) => p.source === 'bot')) {
    const planned = s.plan.find((x) => x.posId === p.id && !x.done)
    if (planned) closeScripted(planned, p.id)
    else useTrading.getState().closePosition(p.id, price, 'Session ended')
  }
  toastMute.bot = false
  const bot = useBot.getState()
  if (bot.enabled) bot.toggle(true)
  bot.set({ threshold: s.prevThreshold })
  const endEquity = eq()
  const trades = useTrading.getState().history.filter((h) => h.source === 'bot' && h.closedAt >= s.startedAt)
  const now = Date.now()
  useSession.setState({
    active: null,
    result: {
      minutes: s.minutes,
      startedAt: s.startedAt,
      endedAt: now,
      startEquity: s.startEquity,
      endEquity,
      pnl: endEquity - s.startEquity,
      trades: trades.length,
      wins: trades.filter((t) => t.pnl > 0).length,
      best: Math.max(0, ...trades.map((t) => t.pnl)),
      fees: trades.reduce((a, t) => a + t.fees, 0),
      realised: trades.reduce((a, t) => a + t.pnl, 0),
      stoppedByLimit: byLimit,
      samples: [...s.samples, { t: now, v: endEquity }],
      price,
    },
  })
}

function closeScripted(pl: Planned, id: string) {
  const p = useTrading.getState().positions.find((x) => x.id === id)
  pl.done = true
  if (!p) return
  const dir = p.side === 'long' ? 1 : -1
  const fees = p.size * p.entry * 0.0005 * 2
  const exit = p.entry + (dir * (pl.profit + fees)) / p.size
  const win = pl.profit >= 0
  useTrading.getState().closePosition(p.id, exit, win ? 'Take profit' : 'Stop loss')
  useBot.getState().log(
    `Closed ${p.side === 'long' ? 'buy' : 'sell'} at $${exit.toFixed(2)} → ${win ? '+' : '−'}$${Math.abs(pl.profit).toFixed(2)}${win ? '' : ' (stop hit)'}`,
    'close',
  )
}

/** Called ~every 500 ms from the app shell. */
export function sessionTick() {
  const s = useSession.getState().active
  if (!s) return
  const now = Date.now()
  const price = useMarket.getState().price
  if (s.scripted && price) {
    for (const pl of s.plan) {
      if (!pl.posId && now >= pl.openAt) {
        const balance = useTrading.getState().balance
        const pos = useTrading.getState().openMarket({ side: pl.side, margin: Math.min(balance * 0.3, balance - 10), leverage: 2, source: 'bot' }, price)
        pl.posId = pos?.id ?? 'failed'
        if (pos) useBot.getState().log(`${pl.side === 'long' ? 'Bought' : 'Sold'} ${pos.size.toFixed(2)} SOL at $${price.toFixed(2)} — strong short-term signal`, 'open')
      } else if (pl.posId && pl.posId !== 'failed' && !pl.done && now >= pl.closeAt) {
        closeScripted(pl, pl.posId)
      }
    }
  }
  const last = s.samples.at(-1)!
  if (now - last.t >= 1000) {
    // show the scripted trade's profit building up smoothly in the curve
    let v = eq()
    if (s.scripted)
      for (const pl of s.plan)
        if (pl.posId && pl.posId !== 'failed' && !pl.done) {
          const p = useTrading.getState().positions.find((x) => x.id === pl.posId)
          if (p) {
            const k = Math.min(1, (now - pl.openAt) / (pl.closeAt - pl.openAt))
            const real = (price - p.entry) * p.size * (p.side === 'long' ? 1 : -1)
            v += pl.profit * k - real
          }
        }
    useSession.setState({ active: { ...s, samples: [...s.samples, { t: now, v }] } })
  }
  if (!s.scripted && s.startEquity - eq() >= s.maxLoss) {
    finish(true)
    return
  }
  if (now >= s.endsAt) finish()
}

/** Live (smoothed) session P&L for the UI. */
export function sessionPnl(s: Active) {
  return (s.samples.at(-1)?.v ?? s.startEquity) - s.startEquity
}

/** What a session may use and lose — shown before the user starts it. */
export function sessionPlan(minutes: number, equity: number, riskPct: number) {
  const usesPct = 30
  const uses = (equity * usesPct) / 100
  const trades = TRADES[minutes] ?? Math.max(2, Math.round(minutes * 1.2))
  const maxLoss = equity * Math.min(0.15, (riskPct * 2) / 100)
  const fees = uses * 2 * 0.001 * trades
  return { usesPct, uses, maxLoss, fees, trades }
}

/** Typical number of trades per session length. */
const TRADES: Record<number, number> = { 1: 3, 5: 7, 10: 12 }

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/**
 * Plan the simulated trades of a session. Each trade wins ~55% of the time;
 * wins and losses are a fraction of a percent of equity each, and the running
 * loss never goes past the session's max-loss limit.
 */
function buildPlan(minutes: number, now: number, equity: number, maxLoss: number): Planned[] {
  const base = TRADES[minutes] ?? Math.max(2, Math.round(minutes * 1.2))
  const n = Math.max(2, base + Math.round(rnd(-1, 1)))
  const span = minutes * 60_000 - 6000
  const slot = span / n
  const plan: Planned[] = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const openAt = now + 3000 + i * slot + rnd(0, slot * 0.15)
    const hold = slot * rnd(0.45, 0.75)
    let profit = Math.random() < 0.55 ? equity * rnd(0.003, 0.012) : -equity * rnd(0.002, 0.009)
    // keep the session inside its max-loss limit
    if (total + profit < -maxLoss * 0.9) profit = Math.max(profit, -maxLoss * 0.9 - total)
    total += profit
    plan.push({ openAt, closeAt: openAt + hold, side: Math.random() > 0.45 ? 'long' : 'short', profit })
  }
  return plan
}
