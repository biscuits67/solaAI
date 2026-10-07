import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildCtx, scoreAt, strategySignal, STRATEGIES, type StrategyId } from '../lib/ai'
import { useMarket } from './market'
import { useTrading } from './trading'
import { useSession } from './session'
import { useSignal } from './signal'
import { think } from './thoughts'
import { toast } from './ui'

export interface BotLog {
  t: number
  text: string
  kind: 'think' | 'open' | 'close' | 'info'
}

export interface BotConfig {
  strategy: StrategyId
  riskPct: number
  leverage: number
  slAtr: number
  tpAtr: number
  threshold: number
}

interface BotState extends BotConfig {
  enabled: boolean
  startedAt: number | null
  logs: BotLog[]
  lastBar: number
  set: (p: Partial<BotConfig>) => void
  toggle: (silent?: boolean) => void
  log: (text: string, kind?: BotLog['kind']) => void
}

export const useBot = create<BotState>()(
  persist(
    (set, get) => ({
      enabled: false,
      startedAt: null,
      strategy: 'ai',
      riskPct: 1.5,
      leverage: 3,
      slAtr: 1.6,
      tpAtr: 2.8,
      threshold: 35,
      logs: [],
      lastBar: 0,
      set: (p) => set(p),
      toggle: (silent = false) => {
        const on = !get().enabled
        set({ enabled: on, startedAt: on ? Date.now() : null, lastBar: 0 })
        get().log(on ? `AI bot started · ${STRATEGIES[get().strategy].name}` : 'AI bot stopped', 'info')
        if (!silent) toast(on ? 'AI bot started' : 'AI bot stopped', STRATEGIES[get().strategy].name, on ? 'long' : 'info')
      },
      log: (text, kind = 'think') => {
        set({ logs: [{ t: Date.now(), text, kind }, ...get().logs].slice(0, 120) })
        think(kind === 'open' || kind === 'close' ? 'EXECUTE' : 'BOT', text, kind === 'open' ? 'bull' : kind === 'close' ? 'warn' : 'neutral')
      },
    }),
    { name: 'sola.bot.v1', partialize: ({ logs, lastBar, set: _s, toggle: _t, log: _l, ...rest }) => ({ ...rest, logs: logs.slice(0, 40) }) },
  ),
)

let lastEntryBar = 0

/** One autopilot evaluation. Called periodically from the app shell. */
export function botStep() {
  const bot = useBot.getState()
  if (!bot.enabled || useSession.getState().active?.scripted) return
  const { candles, price } = useMarket.getState()
  if (candles.length < 80 || !price) return
  const tr = useTrading.getState()
  const x = buildCtx(candles)
  const i = candles.length - 1
  const closed = i - 1
  const barTime = candles[i].time
  const newBar = barTime !== bot.lastBar
  const A = x.a[i] ?? price * 0.005
  const score = scoreAt(x, i)
  const mine = tr.positions.filter((p) => p.source === 'bot')

  let sig = 0
  if (bot.strategy === 'ai') {
    // follow the published AI signal (it already filters out moves smaller than fees)
    const d = useSignal.getState().signal?.direction
    sig = d === 'LONG' && score > bot.threshold ? 1 : d === 'SHORT' && score < -bot.threshold ? -1 : 0
  }
  else if (newBar) sig = strategySignal(x, closed, bot.strategy, bot.threshold)

  if (newBar) {
    useBot.setState({ lastBar: barTime })
    bot.log(
      `New candle checked — ${sig === 1 ? 'buy signal' : sig === -1 ? 'sell signal' : 'no trade yet'} (score ${score.toFixed(0)})`,
    )
  }

  // exit on opposite signal
  for (const p of mine) {
    const dir = p.side === 'long' ? 1 : -1
    if (sig === -dir) {
      tr.closePosition(p.id, price, 'AI bot signal')
      bot.log(`Closed the ${p.side === 'long' ? 'buy' : 'sell'} position at $${price.toFixed(2)} — the signal reversed`, 'close')
    }
  }

  if (sig !== 0 && barTime !== lastEntryBar && useTrading.getState().positions.filter((p) => p.source === 'bot').length === 0) {
    const equity = useTrading.getState().balance
    const stopDist = A * bot.slAtr
    const qty = (equity * (bot.riskPct / 100)) / stopDist
    const margin = Math.min((qty * price) / bot.leverage, equity * 0.5)
    if (margin < 5) return
    const side = sig === 1 ? 'long' : 'short'
    const sl = price - sig * stopDist
    const tp = price + sig * A * bot.tpAtr
    const p = useTrading.getState().openMarket({ side, margin, leverage: bot.leverage, sl, tp, source: 'bot' }, price)
    if (p) lastEntryBar = barTime
    if (p)
      bot.log(
        `${side === 'long' ? 'Bought' : 'Sold'} ${p.size.toFixed(2)} SOL at $${price.toFixed(2)} · safety stop $${sl.toFixed(2)} · target $${tp.toFixed(2)}`,
        'open',
      )
  }
}
