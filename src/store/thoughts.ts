import { create } from 'zustand'
import type { Signal } from '../lib/ai'
import { fmtPrice } from '../lib/format'
import { useBot } from './bot'
import { useMarket } from './market'

export type Stage = 'DATA' | 'EXPERT' | 'ENSEMBLE' | 'FORECAST' | 'DECISION' | 'BOT' | 'EXECUTE'
export type Tone = 'bull' | 'bear' | 'neutral' | 'warn'

export interface Thought {
  id: number
  t: number
  stage: Stage
  text: string
  tone: Tone
}

export const PIPELINE: Stage[] = ['DATA', 'EXPERT', 'ENSEMBLE', 'FORECAST', 'DECISION']

interface S {
  items: Thought[]
  stage: Stage
  cycle: number
}

export const useThoughts = create<S>(() => ({ items: [], stage: 'DATA', cycle: 0 }))

let id = 0
export function think(stage: Stage, text: string, tone: Tone = 'neutral') {
  useThoughts.setState((s) => ({
    items: [{ id: ++id, t: Date.now(), stage, text, tone }, ...s.items].slice(0, 60),
    stage: PIPELINE.includes(stage) ? stage : s.stage,
  }))
}

const toneOf = (v: number): Tone => (v > 0.15 ? 'bull' : v < -0.15 ? 'bear' : 'neutral')

/** Builds one reasoning cycle (data → experts → ensemble → forecast → decision) from the current signal. */
function cycleSteps(sig: Signal): [Stage, string, Tone][] {
  const m = useMarket.getState()
  const bot = useBot.getState()
  const steps: [Stage, string, Tone][] = []
  steps.push([
    'DATA',
    `Ingested ${m.candles.length} × ${m.interval} candles, ${m.trades.length} live trades and a ${m.book?.bids.length ?? 0}-level order book · SOL ${fmtPrice(sig.price)}`,
    'neutral',
  ])
  const ranked = [...sig.factors].sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight))
  for (const f of ranked.slice(0, 3)) {
    const w = f.value > 0.15 ? 'bullish' : f.value < -0.15 ? 'bearish' : 'neutral'
    steps.push(['EXPERT', `${f.label} expert votes ${w} (${f.value > 0 ? '+' : ''}${(f.value * 100).toFixed(0)}) — ${f.detail}`, toneOf(f.value)])
  }
  const agree = sig.factors.filter((f) => Math.sign(f.value) === Math.sign(sig.score)).length
  steps.push([
    'ENSEMBLE',
    `Weighted ensemble → score ${sig.score > 0 ? '+' : ''}${sig.score.toFixed(0)}, ${agree}/9 experts agree, confidence ${sig.confidence}% · regime: ${sig.regime.toLowerCase()}`,
    toneOf(sig.score / 100),
  ])
  const last = sig.forecast.at(-1)!
  const ch = ((last.value - sig.price) / sig.price) * 100
  steps.push([
    'FORECAST',
    `Projected ${sig.forecast.length - 1} bars ahead: ${fmtPrice(last.value)} (${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%), 80% band ${fmtPrice(last.lower)} – ${fmtPrice(last.upper)}`,
    ch > 0.1 ? 'bull' : ch < -0.1 ? 'bear' : 'neutral',
  ])
  const th = bot.threshold
  const decision =
    sig.score > th
      ? `Score above +${th} → LONG setup · entry ${fmtPrice(sig.price)}${sig.plan ? `, SL ${fmtPrice(sig.plan.stop)}, TP ${fmtPrice(sig.plan.take)}` : ''}`
      : sig.score < -th
        ? `Score below −${th} → SHORT setup · entry ${fmtPrice(sig.price)}${sig.plan ? `, SL ${fmtPrice(sig.plan.stop)}, TP ${fmtPrice(sig.plan.take)}` : ''}`
        : `|score| ${Math.abs(sig.score).toFixed(0)} < ${th} threshold → HOLD, waiting for a stronger edge`
  steps.push(['DECISION', decision, sig.score > th ? 'bull' : sig.score < -th ? 'bear' : 'neutral'])
  return steps
}

let queue: [Stage, string, Tone][] = []

/** Drip-feeds reasoning steps so the user can watch the model think. Call ~every 900 ms. */
export function thinkTick(sig: Signal | null) {
  if (!sig) return
  if (!queue.length) {
    queue = cycleSteps(sig)
    useThoughts.setState((s) => ({ cycle: s.cycle + 1 }))
  }
  const [stage, text, tone] = queue.shift()!
  think(stage, text, tone)
}
