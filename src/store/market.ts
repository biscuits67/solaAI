import { create } from 'zustand'
import { EXCHANGES, LIVE_EXCHANGES } from '../data/exchanges'
import type { Candle, ExchangeId, Interval, OrderBook, Ticker, Trade } from '../data/types'

type Status = 'idle' | 'loading' | 'connecting' | 'live' | 'reconnecting' | 'error'

interface MarketState {
  exchange: ExchangeId // requested
  source: ExchangeId // actually serving data
  interval: Interval
  status: Status
  candles: Candle[]
  book: OrderBook | null
  trades: Trade[]
  ticker: Ticker | null
  price: number
  lastDir: 1 | -1 | 0
  notice: string | null
  setExchange: (e: ExchangeId) => void
  setInterval: (i: Interval) => void
}

export const useMarket = create<MarketState>(() => ({
  exchange: (localStorage.getItem('sola.exchange') as ExchangeId) || 'binance',
  source: 'binance',
  interval: (localStorage.getItem('sola.interval') as Interval) || '15m',
  status: 'idle',
  candles: [],
  book: null,
  trades: [],
  ticker: null,
  price: 0,
  lastDir: 0,
  notice: null,
  setExchange: (exchange) => {
    try {
      localStorage.setItem('sola.exchange', exchange)
    } catch {}
    useMarket.setState({ exchange })
    startFeed()
  },
  setInterval: (interval) => {
    try {
      localStorage.setItem('sola.interval', interval)
    } catch {}
    useMarket.setState({ interval })
    startFeed()
  },
}))

let stop: (() => void) | null = null
let session = 0

/** Starts (or restarts) the live feed with automatic exchange fallback. */
export async function startFeed() {
  stop?.()
  stop = null
  const my = ++session
  const { exchange, interval } = useMarket.getState()
  useMarket.setState({ status: 'loading', book: null, trades: [], notice: null })

  const order: ExchangeId[] =
    exchange === 'sim' ? ['sim'] : [exchange, ...LIVE_EXCHANGES.filter((e) => e !== exchange), 'sim']

  for (const id of order) {
    const ad = EXCHANGES[id]
    try {
      const candles = await ad.loadCandles(interval, 500)
      if (my !== session) return
      if (!candles.length) throw new Error('empty')
      let ticker: Ticker | null = null
      try {
        ticker = await ad.loadTicker()
      } catch {
        /* ticker will arrive via stream */
      }
      if (my !== session) return
      const notice =
        id === exchange
          ? null
          : id === 'sim'
            ? 'Exchanges are unreachable from your network — offline market simulator is on'
            : `${EXCHANGES[exchange].name} is unavailable — streaming from ${ad.name}`
      useMarket.setState({
        source: id,
        candles,
        ticker,
        price: ticker?.last ?? candles.at(-1)!.close,
        status: 'connecting',
        notice,
      })
      attach(id, interval, my)
      return
    } catch {
      /* try next venue */
    }
  }
  useMarket.setState({ status: 'error' })
}

function attach(id: ExchangeId, interval: Interval, my: number) {
  let pendingBook: OrderBook | null = null
  let pendingTrades: Trade[] = []
  const flush = window.setInterval(() => {
    if (my !== session) return
    const patch: Partial<MarketState> = {}
    if (pendingBook) {
      patch.book = pendingBook
      pendingBook = null
    }
    if (pendingTrades.length) {
      patch.trades = [...pendingTrades.reverse(), ...useMarket.getState().trades].slice(0, 80)
      pendingTrades = []
    }
    if (patch.book || patch.trades) useMarket.setState(patch)
  }, 220)

  const off = EXCHANGES[id].connect(interval, {
    onStatus: (s) => my === session && useMarket.setState({ status: s }),
    onCandle: (c) => {
      if (my !== session) return
      const st = useMarket.getState()
      const arr = st.candles
      const last = arr.at(-1)
      let candles: Candle[]
      if (last && c.time === last.time) candles = [...arr.slice(0, -1), c]
      else if (!last || c.time > last.time) candles = [...arr.slice(-999), c]
      else return
      const dir = c.close > st.price ? 1 : c.close < st.price ? -1 : st.lastDir
      useMarket.setState({ candles, price: c.close, lastDir: dir })
    },
    onBook: (b) => (pendingBook = b),
    onTrades: (t) => pendingTrades.push(...t),
    onTicker: (t) => {
      if (my !== session) return
      const prev = useMarket.getState().ticker
      useMarket.setState({ ticker: { ...(prev ?? ({} as Ticker)), ...t } as Ticker })
    },
  })
  stop = () => {
    clearInterval(flush)
    off()
  }
}
