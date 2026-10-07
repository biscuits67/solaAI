import type { Factor, Signal } from './ai'
import { INTERVAL_SEC, type Interval } from '../data/types'

/** Human-friendly wording for the AI's output — no trader jargon. */

export const action = (s: Signal) => (s.direction === 'LONG' ? 'Buy SOL' : s.direction === 'SHORT' ? 'Sell SOL' : 'Wait')

export const confidenceWord = (c: number) => (c >= 70 ? 'High' : c >= 50 ? 'Medium' : 'Low')

export function mood(score: number): { word: string; tone: 'up' | 'down' | 'flat' } {
  if (score > 35) return { word: 'Very optimistic', tone: 'up' }
  if (score > 12) return { word: 'Optimistic', tone: 'up' }
  if (score < -35) return { word: 'Very cautious', tone: 'down' }
  if (score < -12) return { word: 'Cautious', tone: 'down' }
  return { word: 'Neutral', tone: 'flat' }
}

export function horizon(interval: Interval, bars = 24) {
  const s = INTERVAL_SEC[interval] * bars
  if (s < 3600) return `${Math.round(s / 60)} minutes`
  if (s < 86400 * 2) return `${Math.round(s / 3600)} hours`
  return `${Math.round(s / 86400)} days`
}

export function headline(s: Signal, interval: Interval) {
  const last = s.forecast.at(-1)!
  const ch = ((last.value - s.price) / s.price) * 100
  const agree = s.factors.filter((f) => Math.sign(f.value) === Math.sign(s.score)).length
  const dir = ch >= 0 ? 'rise' : 'drop'
  if (s.direction === 'NEUTRAL')
    return `No clear direction right now. The AI expects SOL to stay around $${last.value.toFixed(2)} over the next ${horizon(interval)} and waits for a better moment.`
  return `The AI expects SOL to ${dir} about ${Math.abs(ch).toFixed(1)}% in the next ${horizon(interval)}. ${agree} of 9 models agree.`
}

const PLAIN: Record<string, [string, string, string]> = {
  // key: [bullish, bearish, neutral]
  trend: ['Trend is rising', 'Trend is falling', 'No clear trend'],
  momentum: ['Momentum is building', 'Momentum is fading', 'Momentum is flat'],
  rsi: ['Price has room to grow', 'Price looks stretched', 'Price is fairly valued'],
  bands: ['Near the bottom of its range', 'Near the top of its range', 'Mid-range'],
  volume: ['Volume backs the move up', 'Volume backs the move down', 'Volume is quiet'],
  regression: ['Steady climb', 'Steady slide', 'Sideways drift'],
  osc: ['Recently oversold', 'Recently overbought', 'Balanced'],
  book: ['More buy orders waiting', 'More sell orders waiting', 'Order book is balanced'],
  flow: ['Buyers are stronger', 'Sellers are stronger', 'Buyers and sellers even'],
}

export const plainFactor = (f: Factor) => PLAIN[f.key]?.[f.value > 0.12 ? 0 : f.value < -0.12 ? 1 : 2] ?? f.label

export const EXPERT_INFO: Record<string, string> = {
  trend: 'Compares short and long moving averages to see where the price is heading.',
  momentum: 'Measures whether the move is speeding up or slowing down (MACD).',
  rsi: 'Checks if SOL has moved too far, too fast — overbought or oversold (RSI).',
  bands: 'Looks at where the price sits inside its normal volatility range (Bollinger).',
  volume: 'Checks whether trading volume confirms the price move (OBV).',
  regression: 'Fits a line through recent prices to find the underlying drift.',
  osc: 'Compares the close to the recent high/low range (Stochastic).',
  book: 'Reads the live order book — are more people waiting to buy or to sell?',
  flow: 'Watches the last trades — are buyers or sellers more aggressive right now?',
}
