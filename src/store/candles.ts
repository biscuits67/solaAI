import { useEffect, useMemo, useState } from 'react'
import { EXCHANGES } from '../data/exchanges'
import type { Candle, Interval } from '../data/types'
import { INTERVAL_SEC } from '../data/types'
import { AI_INTERVAL, useMarket } from './market'

/**
 * Candles for a chart timeframe. Uses the live AI feed for the AI interval,
 * otherwise loads history over REST (refreshed every minute) and keeps the
 * last candle in sync with the live price.
 */
export function useCandles(iv: Interval, bars: number): { candles: Candle[]; loading: boolean } {
  const live = useMarket((s) => s.candles)
  const source = useMarket((s) => s.source)
  const price = useMarket((s) => s.price)
  const [hist, setHist] = useState<{ iv: Interval; c: Candle[] } | null>(null)

  useEffect(() => {
    if (iv === AI_INTERVAL) return
    let alive = true
    const load = () =>
      EXCHANGES[source]
        .loadCandles(iv, Math.min(1000, Math.max(bars + 60, 200)))
        .then((c) => alive && setHist({ iv, c }))
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [iv, source, bars])

  return useMemo(() => {
    if (iv === AI_INTERVAL) return { candles: live.slice(-bars), loading: !live.length }
    if (!hist || hist.iv !== iv) return { candles: [], loading: true }
    const c = hist.c.slice(-bars)
    const last = c.at(-1)
    if (last && price) {
      const step = INTERVAL_SEC[iv]
      const now = Math.floor(Date.now() / 1000 / step) * step
      if (now > last.time) c.push({ time: now, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price, volume: 0 })
      else c[c.length - 1] = { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) }
    }
    return { candles: c, loading: false }
  }, [iv, live, hist, price, bars])
}
