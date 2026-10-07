import { create } from 'zustand'
import { useBot } from './bot'
import { useMarket } from './market'
import { think } from './thoughts'
import { equityOf, useTrading, type Side } from './trading'
import { toast } from './ui'

/**
 * Timed AI trading sessions (1 / 5 / 10 min).
 * NOTE (demo only, temporary): the 1-minute session is scripted to show a
 * fast, large profit. 5/10-minute sessions use the real AI bot logic.
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
    const scripted = minutes === 1
    const bot = useBot.getState()
    const plan: Planned[] = []
    if (scripted) {
      // demo: 5 quick winning trades worth ~12–18% of equity in total
      const target = startEquity * (0.12 + Math.random() * 0.06)
      const w = Array.from({ length: 5 }, () => 0.6 + Math.random())
      const ws = w.reduce((a, b) => a + b, 0)
      for (let i = 0; i < 5; i++) {
        const openAt = now + 3000 + i * 10500
        plan.push({ openAt, closeAt: openAt + 6500 + Math.random() * 1500, side: Math.random() > 0.35 ? 'long' : 'short', profit: (target * w[i]) / ws })
      }
    }
    set({
      active: { minutes, startedAt: now, endsAt: now + minutes * 60_000, startEquity, scripted, plan, samples: [{ t: now, v: startEquity }], prevThreshold: bot.threshold },
      result: null,
    })
    if (!scripted) bot.set({ threshold: Math.min(bot.threshold, 20) })
    if (!bot.enabled) bot.toggle()
    think('BOT', `AI session started for ${minutes} minute${minutes > 1 ? 's' : ''}.`, 'bull')
  },

  stop: () => finish(),
  dismiss: () => set({ result: null }),
}))

function finish() {
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
  const bot = useBot.getState()
  if (bot.enabled) bot.toggle()
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
  useTrading.getState().closePosition(p.id, exit, 'Take profit')
  useBot.getState().log(`Closed ${p.side === 'long' ? 'buy' : 'sell'} at $${exit.toFixed(2)} → +$${pl.profit.toFixed(2)}`, 'close')
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
        const pos = useTrading.getState().openMarket({ side: pl.side, margin: Math.min(balance * 0.25, balance - 10), leverage: 5, source: 'bot' }, price)
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
  if (now >= s.endsAt) {
    finish()
    toast('Session complete', 'See your results', 'long')
  }
}

/** Live (smoothed) session P&L for the UI. */
export function sessionPnl(s: Active) {
  return (s.samples.at(-1)?.v ?? s.startEquity) - s.startEquity
}
