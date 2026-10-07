import type {
  Candle,
  ExchangeAdapter,
  ExchangeId,
  FeedHandlers,
  Interval,
  OrderBook,
  Trade,
} from './types'
import { INTERVAL_SEC } from './types'

/* ───────────────────────── helpers ───────────────────────── */

async function getJSON<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()) as T
  } finally {
    clearTimeout(t)
  }
}

async function firstOk<T>(urls: string[]): Promise<T> {
  let err: unknown
  for (const u of urls) {
    try {
      return await getJSON<T>(u)
    } catch (e) {
      err = e
    }
  }
  throw err
}

interface SocketOpts {
  urls: string[]
  onOpen?: (ws: WebSocket) => void
  onMessage: (data: any) => void
  ping?: { every: number; payload: string }
  onStatus: FeedHandlers['onStatus']
}

/** Reconnecting websocket with url fallback and keepalive. */
function socket(o: SocketOpts): () => void {
  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let pingTimer: number | undefined
  let retryTimer: number | undefined

  const open = () => {
    if (closed) return
    const url = o.urls[attempt % o.urls.length]
    o.onStatus(attempt === 0 ? 'connecting' : 'reconnecting')
    ws = new WebSocket(url)
    ws.onopen = () => {
      attempt = 0
      o.onStatus('live')
      o.onOpen?.(ws!)
      if (o.ping) {
        pingTimer = window.setInterval(() => ws?.readyState === 1 && ws.send(o.ping!.payload), o.ping.every)
      }
    }
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string' || ev.data === 'pong') return
      try {
        o.onMessage(JSON.parse(ev.data))
      } catch {
        /* ignore malformed frame */
      }
    }
    ws.onclose = () => {
      clearInterval(pingTimer)
      if (closed) return
      attempt++
      o.onStatus(attempt > 6 ? 'error' : 'reconnecting')
      retryTimer = window.setTimeout(open, Math.min(1000 * 2 ** Math.min(attempt, 5), 20000))
    }
    ws.onerror = () => ws?.close()
  }
  open()
  return () => {
    closed = true
    clearInterval(pingTimer)
    clearTimeout(retryTimer)
    ws?.close()
  }
}

const num = (v: unknown) => Number(v)

/** Maintains an L2 book from snapshot + delta messages. */
class LocalBook {
  bids = new Map<number, number>()
  asks = new Map<number, number>()
  reset() {
    this.bids.clear()
    this.asks.clear()
  }
  apply(side: 'b' | 'a', levels: [string, string][]) {
    const m = side === 'b' ? this.bids : this.asks
    for (const [p, s] of levels) {
      const price = +p
      const size = +s
      if (size === 0) m.delete(price)
      else m.set(price, size)
    }
  }
  snapshot(depth = 25): OrderBook {
    const bids = [...this.bids].sort((a, b) => b[0] - a[0]).slice(0, depth)
    const asks = [...this.asks].sort((a, b) => a[0] - b[0]).slice(0, depth)
    return {
      bids: bids.map(([price, size]) => ({ price, size })),
      asks: asks.map(([price, size]) => ({ price, size })),
      ts: Date.now(),
    }
  }
}

/* ───────────────────────── Binance ───────────────────────── */

const BINANCE_REST = ['https://api.binance.com', 'https://data-api.binance.vision']
const BINANCE_WS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision']

const binance: ExchangeAdapter = {
  id: 'binance',
  name: 'Binance',
  pair: 'SOL/USDT',
  async loadCandles(interval, limit) {
    const raw = await firstOk<any[][]>(
      BINANCE_REST.map((b) => `${b}/api/v3/klines?symbol=SOLUSDT&interval=${interval}&limit=${limit}`),
    )
    return raw.map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: +k[1],
      high: +k[2],
      low: +k[3],
      close: +k[4],
      volume: +k[5],
    }))
  },
  async loadTicker() {
    const t = await firstOk<any>(BINANCE_REST.map((b) => `${b}/api/v3/ticker/24hr?symbol=SOLUSDT`))
    return {
      last: +t.lastPrice,
      open24h: +t.openPrice,
      high24h: +t.highPrice,
      low24h: +t.lowPrice,
      volume24h: +t.volume,
      quoteVolume24h: +t.quoteVolume,
      changePct: +t.priceChangePercent,
    }
  },
  connect(interval, h) {
    const streams = [`solusdt@kline_${interval}`, 'solusdt@depth20@100ms', 'solusdt@aggTrade', 'solusdt@miniTicker']
    return socket({
      urls: BINANCE_WS.map((b) => `${b}/stream?streams=${streams.join('/')}`),
      onStatus: h.onStatus,
      onMessage: (msg) => {
        const d = msg.data
        const s: string = msg.stream ?? ''
        if (!d) return
        if (s.includes('@kline')) {
          const k = d.k
          h.onCandle({ time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v })
        } else if (s.includes('@depth')) {
          h.onBook({
            bids: d.bids.map((l: string[]) => ({ price: +l[0], size: +l[1] })),
            asks: d.asks.map((l: string[]) => ({ price: +l[0], size: +l[1] })),
            ts: Date.now(),
          })
        } else if (s.includes('@aggTrade')) {
          h.onTrades([{ id: String(d.a), price: +d.p, size: +d.q, side: d.m ? 'sell' : 'buy', time: d.T }])
        } else if (s.includes('@miniTicker')) {
          const o = +d.o
          h.onTicker({
            last: +d.c,
            open24h: o,
            high24h: +d.h,
            low24h: +d.l,
            volume24h: +d.v,
            quoteVolume24h: +d.q,
            changePct: ((+d.c - o) / o) * 100,
          })
        }
      },
    })
  },
}

/* ───────────────────────── Bybit ───────────────────────── */

const BYBIT_IV: Record<Interval, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' }

const bybit: ExchangeAdapter = {
  id: 'bybit',
  name: 'Bybit',
  pair: 'SOL/USDT',
  async loadCandles(interval, limit) {
    const r = await getJSON<any>(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=SOLUSDT&interval=${BYBIT_IV[interval]}&limit=${Math.min(limit, 1000)}`,
    )
    return (r.result.list as string[][])
      .map((k) => ({
        time: Math.floor(+k[0] / 1000),
        open: +k[1],
        high: +k[2],
        low: +k[3],
        close: +k[4],
        volume: +k[5],
      }))
      .reverse()
  },
  async loadTicker() {
    const r = await getJSON<any>('https://api.bybit.com/v5/market/tickers?category=spot&symbol=SOLUSDT')
    const t = r.result.list[0]
    return {
      last: +t.lastPrice,
      open24h: +t.prevPrice24h,
      high24h: +t.highPrice24h,
      low24h: +t.lowPrice24h,
      volume24h: +t.volume24h,
      quoteVolume24h: +t.turnover24h,
      changePct: +t.price24hPcnt * 100,
    }
  },
  connect(interval, h) {
    const book = new LocalBook()
    return socket({
      urls: ['wss://stream.bybit.com/v5/public/spot'],
      onStatus: h.onStatus,
      ping: { every: 18000, payload: JSON.stringify({ op: 'ping' }) },
      onOpen: (ws) => {
        book.reset()
        ws.send(
          JSON.stringify({
            op: 'subscribe',
            args: [`kline.${BYBIT_IV[interval]}.SOLUSDT`, 'orderbook.50.SOLUSDT', 'publicTrade.SOLUSDT', 'tickers.SOLUSDT'],
          }),
        )
      },
      onMessage: (msg) => {
        const topic: string = msg.topic ?? ''
        if (!topic) return
        if (topic.startsWith('kline')) {
          for (const k of msg.data)
            h.onCandle({
              time: Math.floor(k.start / 1000),
              open: +k.open,
              high: +k.high,
              low: +k.low,
              close: +k.close,
              volume: +k.volume,
            })
        } else if (topic.startsWith('orderbook')) {
          if (msg.type === 'snapshot') book.reset()
          book.apply('b', msg.data.b)
          book.apply('a', msg.data.a)
          h.onBook(book.snapshot())
        } else if (topic.startsWith('publicTrade')) {
          h.onTrades(
            (msg.data as any[]).map((t) => ({
              id: String(t.i),
              price: +t.p,
              size: +t.v,
              side: t.S === 'Buy' ? 'buy' : 'sell',
              time: +t.T,
            })),
          )
        } else if (topic.startsWith('tickers')) {
          const t = msg.data
          h.onTicker({
            last: num(t.lastPrice),
            open24h: num(t.prevPrice24h),
            high24h: num(t.highPrice24h),
            low24h: num(t.lowPrice24h),
            volume24h: num(t.volume24h),
            quoteVolume24h: num(t.turnover24h),
            changePct: num(t.price24hPcnt) * 100,
          })
        }
      },
    })
  },
}

/* ───────────────────────── OKX ───────────────────────── */

const OKX_IV: Record<Interval, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1Dutc' }

const okx: ExchangeAdapter = {
  id: 'okx',
  name: 'OKX',
  pair: 'SOL/USDT',
  async loadCandles(interval, limit) {
    const r = await getJSON<any>(
      `https://www.okx.com/api/v5/market/candles?instId=SOL-USDT&bar=${OKX_IV[interval]}&limit=${Math.min(limit, 300)}`,
    )
    return (r.data as string[][])
      .map((k) => ({
        time: Math.floor(+k[0] / 1000),
        open: +k[1],
        high: +k[2],
        low: +k[3],
        close: +k[4],
        volume: +k[5],
      }))
      .reverse()
  },
  async loadTicker() {
    const r = await getJSON<any>('https://www.okx.com/api/v5/market/ticker?instId=SOL-USDT')
    const t = r.data[0]
    const o = +t.open24h
    return {
      last: +t.last,
      open24h: o,
      high24h: +t.high24h,
      low24h: +t.low24h,
      volume24h: +t.vol24h,
      quoteVolume24h: +t.volCcy24h,
      changePct: ((+t.last - o) / o) * 100,
    }
  },
  connect(interval, h) {
    const offPublic = socket({
      urls: ['wss://ws.okx.com:8443/ws/v5/public'],
      onStatus: h.onStatus,
      ping: { every: 20000, payload: 'ping' },
      onOpen: (ws) =>
        ws.send(
          JSON.stringify({
            op: 'subscribe',
            args: ['books5', 'trades', 'tickers'].map((channel) => ({ channel, instId: 'SOL-USDT' })),
          }),
        ),
      onMessage: (msg) => {
        const ch: string = msg.arg?.channel
        if (!msg.data || !ch) return
        if (ch === 'books5') {
          const b = msg.data[0]
          h.onBook({
            bids: b.bids.map((l: string[]) => ({ price: +l[0], size: +l[1] })),
            asks: b.asks.map((l: string[]) => ({ price: +l[0], size: +l[1] })),
            ts: Date.now(),
          })
        } else if (ch === 'trades') {
          h.onTrades(
            (msg.data as any[]).map((t) => ({
              id: String(t.tradeId),
              price: +t.px,
              size: +t.sz,
              side: t.side,
              time: +t.ts,
            })),
          )
        } else if (ch === 'tickers') {
          const t = msg.data[0]
          const o = +t.open24h
          h.onTicker({
            last: +t.last,
            open24h: o,
            high24h: +t.high24h,
            low24h: +t.low24h,
            volume24h: +t.vol24h,
            quoteVolume24h: +t.volCcy24h,
            changePct: ((+t.last - o) / o) * 100,
          })
        }
      },
    })
    const offBusiness = socket({
      urls: ['wss://ws.okx.com:8443/ws/v5/business'],
      onStatus: () => {},
      ping: { every: 20000, payload: 'ping' },
      onOpen: (ws) =>
        ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: `candle${OKX_IV[interval]}`, instId: 'SOL-USDT' }] })),
      onMessage: (msg) => {
        if (!msg.data || !String(msg.arg?.channel).startsWith('candle')) return
        for (const k of msg.data as string[][])
          h.onCandle({
            time: Math.floor(+k[0] / 1000),
            open: +k[1],
            high: +k[2],
            low: +k[3],
            close: +k[4],
            volume: +k[5],
          })
      },
    })
    return () => {
      offPublic()
      offBusiness()
    }
  },
}

/* ───────────────────────── Simulator (offline fallback) ───────────────────────── */

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}
function gauss(r: () => number) {
  const u = Math.max(r(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

const sim = (() => {
  let history: Candle[] = []
  let simInterval: Interval = '1m'
  const r = rng(42)

  const gen = (interval: Interval, limit: number) => {
    const step = INTERVAL_SEC[interval]
    const now = Math.floor(Date.now() / 1000 / step) * step
    let p = 148
    let vol = 0.004 * Math.sqrt(step / 60)
    const out: Candle[] = []
    for (let i = limit - 1; i >= 0; i--) {
      vol = Math.max(0.0015, vol * (0.96 + r() * 0.08))
      const drift = Math.sin(i / 40) * vol * 0.25
      const o = p
      const c = o * (1 + drift + gauss(r) * vol)
      const hi = Math.max(o, c) * (1 + Math.abs(gauss(r)) * vol * 0.6)
      const lo = Math.min(o, c) * (1 - Math.abs(gauss(r)) * vol * 0.6)
      out.push({ time: now - i * step, open: o, high: hi, low: lo, close: c, volume: 2000 + r() * 9000 })
      p = c
    }
    return out
  }

  const adapter: ExchangeAdapter = {
    id: 'sim',
    name: 'Simulator',
    pair: 'SOL/USDT',
    async loadCandles(interval, limit) {
      simInterval = interval
      history = gen(interval, limit)
      return history
    },
    async loadTicker() {
      const last = history.at(-1)?.close ?? 148
      const day = history.slice(-Math.ceil(86400 / INTERVAL_SEC[simInterval]))
      const o = day[0]?.open ?? last
      return {
        last,
        open24h: o,
        high24h: Math.max(...day.map((c) => c.high)),
        low24h: Math.min(...day.map((c) => c.low)),
        volume24h: day.reduce((s, c) => s + c.volume, 0),
        quoteVolume24h: day.reduce((s, c) => s + c.volume * c.close, 0),
        changePct: ((last - o) / o) * 100,
      }
    },
    connect(interval, h) {
      h.onStatus('live')
      const step = INTERVAL_SEC[interval]
      let cur = { ...(history.at(-1) ?? { time: 0, open: 148, high: 148, low: 148, close: 148, volume: 0 }) }
      let tid = 0
      const timer = window.setInterval(() => {
        const t = Math.floor(Date.now() / 1000 / step) * step
        if (t > cur.time) cur = { time: t, open: cur.close, high: cur.close, low: cur.close, close: cur.close, volume: 0 }
        const px = cur.close * (1 + gauss(r) * 0.00045)
        const size = +(Math.abs(gauss(r)) * 12 + 0.05).toFixed(3)
        cur.close = px
        cur.high = Math.max(cur.high, px)
        cur.low = Math.min(cur.low, px)
        cur.volume += size
        h.onCandle({ ...cur })
        h.onTrades([{ id: `s${tid++}`, price: px, size, side: r() > 0.5 ? 'buy' : 'sell', time: Date.now() }])
        const tick = 0.01
        const mk = (dir: 1 | -1) =>
          Array.from({ length: 20 }, (_, i) => ({
            price: +(px + dir * (i + 1) * tick * (1 + r() * 2)).toFixed(2),
            size: +(Math.abs(gauss(r)) * 60 + 5 + i * 3).toFixed(2),
          }))
        h.onBook({ bids: mk(-1).sort((a, b) => b.price - a.price), asks: mk(1).sort((a, b) => a.price - b.price), ts: Date.now() })
        h.onTicker({ last: px })
      }, 450)
      return () => clearInterval(timer)
    },
  }
  return adapter
})()

export const EXCHANGES: Record<ExchangeId, ExchangeAdapter> = { binance, bybit, okx, sim }
export const LIVE_EXCHANGES: ExchangeId[] = ['binance', 'bybit', 'okx']

/* ───────────────────────── cross-exchange quotes ───────────────────────── */

export interface Quote {
  venue: string
  price: number | null
  change: number | null
}

const QUOTE_SOURCES: { venue: string; get: () => Promise<{ price: number; change: number }> }[] = [
  { venue: 'Binance', get: async () => binance.loadTicker().then((t) => ({ price: t.last, change: t.changePct })) },
  { venue: 'Bybit', get: async () => bybit.loadTicker().then((t) => ({ price: t.last, change: t.changePct })) },
  { venue: 'OKX', get: async () => okx.loadTicker().then((t) => ({ price: t.last, change: t.changePct })) },
  {
    venue: 'Coinbase',
    get: async () => {
      const s = await getJSON<any>('https://api.exchange.coinbase.com/products/SOL-USD/stats')
      return { price: +s.last, change: ((+s.last - +s.open) / +s.open) * 100 }
    },
  },
  {
    venue: 'Kraken',
    get: async () => {
      const r = await getJSON<any>('https://api.kraken.com/0/public/Ticker?pair=SOLUSD')
      const t: any = Object.values(r.result)[0]
      return { price: +t.c[0], change: ((+t.c[0] - +t.o) / +t.o) * 100 }
    },
  },
]

export async function loadQuotes(): Promise<Quote[]> {
  const res = await Promise.allSettled(QUOTE_SOURCES.map((s) => s.get()))
  return res.map((r, i) => ({
    venue: QUOTE_SOURCES[i].venue,
    price: r.status === 'fulfilled' ? r.value.price : null,
    change: r.status === 'fulfilled' ? r.value.change : null,
  }))
}

export type { Trade }
