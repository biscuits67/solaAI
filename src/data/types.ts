export type ExchangeId = 'binance' | 'bybit' | 'okx' | 'sim'

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d']

export const INTERVAL_SEC: Record<Interval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
}

export interface Candle {
  time: number // unix seconds, open time
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface BookLevel {
  price: number
  size: number
}

export interface OrderBook {
  bids: BookLevel[] // sorted desc
  asks: BookLevel[] // sorted asc
  ts: number
}

export interface Trade {
  id: string
  price: number
  size: number
  side: 'buy' | 'sell' // aggressor side
  time: number // ms
}

export interface Ticker {
  last: number
  open24h: number
  high24h: number
  low24h: number
  volume24h: number // base
  quoteVolume24h: number
  changePct: number
}

export interface FeedHandlers {
  onCandle: (c: Candle) => void
  onBook: (b: OrderBook) => void
  onTrades: (t: Trade[]) => void
  onTicker: (t: Partial<Ticker>) => void
  onStatus: (s: 'connecting' | 'live' | 'reconnecting' | 'error') => void
}

export interface ExchangeAdapter {
  id: ExchangeId
  name: string
  pair: string
  loadCandles: (interval: Interval, limit: number) => Promise<Candle[]>
  loadTicker: () => Promise<Ticker>
  connect: (interval: Interval, h: FeedHandlers) => () => void
}
