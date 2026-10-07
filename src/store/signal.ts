import { create } from 'zustand'
import { analyze, type Signal } from '../lib/ai'
import { INTERVAL_SEC } from '../data/types'
import { useMarket } from './market'

export const useSignal = create<{ signal: Signal | null }>(() => ({ signal: null }))

export function computeSignal() {
  const { candles, book, trades, interval } = useMarket.getState()
  useSignal.setState({ signal: analyze(candles, book, trades.slice(0, 60), 24, INTERVAL_SEC[interval]) })
}
