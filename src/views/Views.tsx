import { motion } from 'framer-motion'
import { Fragment, useMemo, useState } from 'react'
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts'
import { BotControl, Copilot, EquityCard, ForecastCard, NeuralPanel, SignalCard, ThinkingFeed } from '../components/AIWidgets'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Ring, Spark } from '../components/canvas'
import { ChartPanel } from '../components/ChartPanel'
import { NumInput, Range, Segmented } from '../components/Controls'
import { Panel } from '../components/Glass'
import { DEFAULT_OVERLAYS, PriceChart } from '../components/PriceChart'
import { CrossExchange, Empty, PositionsPanel, TradePanel } from '../components/TradeWidgets'
import { EXCHANGES } from '../data/exchanges'
import { INTERVALS, type Candle, type Interval } from '../data/types'
import { backtest, STRATEGIES, type BtParams, type BtResult, type StrategyId } from '../lib/ai'
import { fmtDate, fmtPct, fmtPrice, fmtSigned, fmtUsd } from '../lib/format'
import { useMarket } from '../store/market'
import { equityOf, START_BALANCE, useTrading } from '../store/trading'
import { toast, useUI } from '../store/ui'

/* ───────────── AI Brain (home) ───────────── */

export function BrainView() {
  return (
    <>
      <div className="grid g-hero">
        <NeuralPanel delay={0.05} />
        <SignalCard delay={0.12} />
      </div>
      <div className="grid g-side">
        <ChartPanel delay={0.18} />
        <ThinkingFeed delay={0.24} />
      </div>
      <div className="grid g-3">
        <BotControl delay={0.28} />
        <div className="stack">
          <ForecastCard delay={0.32} />
          <EquityCard delay={0.36} />
        </div>
        <Copilot delay={0.4} />
      </div>
    </>
  )
}

/* ───────────── Trades ───────────── */

export function TradesView() {
  const price = useMarket((s) => s.price)
  const t = useTrading()
  const mode = useUI((s) => s.mode)
  const eq = equityOf(t, price)
  const pnl = eq - START_BALANCE
  const wins = t.history.filter((h) => h.pnl > 0)
  const fees = t.history.reduce((s, h) => s + h.fees, 0)
  const curve = useMemo(() => [...t.equityCurve.map((p) => p.v), eq], [t.equityCurve.length, Math.round(eq)])
  const bySource = (['bot', 'copilot', 'manual'] as const).map((s) => ({
    s,
    pnl: t.history.filter((h) => h.source === s).reduce((a, h) => a + h.pnl, 0),
  }))
  const maxAbs = Math.max(1, ...bySource.map((b) => Math.abs(b.pnl)))

  return (
    <>
      <div className="grid g-4">
        <Kpi label={mode === 'demo' ? 'Demo equity' : 'Equity'} value={eq} fmt={(v) => fmtUsd(v)} sub={`${fmtSigned(pnl)} $ · ${fmtPct((pnl / START_BALANCE) * 100)}`} delay={0.05} spark={curve.length > 1 ? curve : undefined} />
        <Kpi label="Closed trades" value={t.history.length} fmt={(v) => v.toFixed(0)} sub={`${t.positions.length} open now`} delay={0.09} />
        <Kpi label="Win rate" value={t.history.length ? (wins.length / t.history.length) * 100 : 0} fmt={(v) => `${v.toFixed(1)}%`} ring={t.history.length ? wins.length / t.history.length : 0} delay={0.13} />
        <Kpi label="Fees paid" value={fees} fmt={(v) => `${v.toFixed(2)} $`} sub="0.05% taker · 0.02% maker" delay={0.17} />
      </div>
      <div className="grid g-side" style={{ alignItems: 'start' }}>
        <PositionsPanel delay={0.2} />
        <TradePanel delay={0.24} />
      </div>
      <div className="grid g-3">
        <Panel
          title="PnL by source"
          k="who traded"
          delay={0.28}
          right={
            <button className="btn btn-ghost btn-xs" onClick={() => confirm('Reset the demo account to 10,000 USDT?') && t.reset()}>
              Reset demo
            </button>
          }
        >
          {bySource.map((b) => (
            <div key={b.s} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 80px', gap: 10, alignItems: 'center', padding: '9px 0' }}>
              <span style={{ fontSize: 12.5 }}>{b.s === 'manual' ? 'Manual' : b.s === 'bot' ? 'AI bot' : 'Copilot'}</span>
              <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(b.pnl) / maxAbs) * 100}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  style={{ height: '100%', borderRadius: 6, background: b.pnl >= 0 ? 'var(--long)' : 'var(--short)', boxShadow: `0 0 10px ${b.pnl >= 0 ? 'var(--long)' : 'var(--short)'}` }}
                />
              </div>
              <span className={`mono ${b.pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 12, textAlign: 'right' }}>
                {fmtSigned(b.pnl)}
              </span>
            </div>
          ))}
        </Panel>
        <PnlHeatmap />
        <CrossExchange delay={0.36} />
      </div>
    </>
  )
}

function Kpi({
  label,
  value,
  fmt,
  sub,
  cls = '',
  delay = 0,
  spark,
  ring,
}: {
  label: string
  value: number
  fmt: (v: number) => string
  sub?: string
  cls?: string
  delay?: number
  spark?: number[]
  ring?: number
}) {
  return (
    <Panel pad={false} className="kpi" delay={delay}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{label}</div>
          <div className={`v ${cls}`}>
            <AnimatedNumber value={value} format={fmt} />
          </div>
          {sub && <div className="s">{sub}</div>}
        </div>
        {ring != null && <Ring value={ring} size={56} color={ring >= 0.5 ? '#2ff3b3' : '#ffbe55'} />}
      </div>
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <Spark data={spark} height={36} />
        </div>
      )}
    </Panel>
  )
}

function PnlHeatmap() {
  const history = useTrading((s) => s.history)
  const cells = useMemo(() => {
    const a = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[])
    for (const h of history) {
      const d = new Date(h.closedAt)
      a[(d.getDay() + 6) % 7][d.getHours()] += h.pnl
    }
    return a
  }, [history.length])
  const max = Math.max(1, ...cells.flat().map(Math.abs))
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <Panel title="PnL heatmap" k="day × hour" delay={0.32}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(24, minmax(0, 1fr))', gap: 3 }}>
        {cells.map((row, d) => (
          <Fragment key={d}>
            <span className="dim" style={{ fontSize: 10, alignSelf: 'center' }}>
              {days[d]}
            </span>
            {row.map((v, h) => {
              const a = Math.abs(v) / max
              return (
                <motion.div
                  key={h}
                  title={`${days[d]} ${h}:00 · ${v.toFixed(2)} $`}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (d * 24 + h) * 0.002 }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 3,
                    background: v === 0 ? 'rgba(255,255,255,0.035)' : v > 0 ? `rgba(47,243,179,${0.15 + a * 0.85})` : `rgba(255,79,128,${0.15 + a * 0.85})`,
                  }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="dim mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginTop: 8, paddingLeft: 33 }}>
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </Panel>
  )
}

/* ───────────── Backtest ───────────── */

export function BacktestView() {
  const source = useMarket((s) => s.source)
  const liveInterval = useMarket((s) => s.interval)
  const [interval, setIv] = useState<Interval>(liveInterval)
  const [p, setP] = useState<BtParams>({ strategy: 'ai', capital: 10000, riskPct: 1.5, slAtr: 1.6, tpAtr: 2.8, leverage: 5, threshold: 35, fee: 0.0005 })
  const [res, setRes] = useState<{ r: BtResult; c: Candle[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const c = await EXCHANGES[source].loadCandles(interval, 1000)
      await new Promise((r) => setTimeout(r, 450))
      setRes({ r: backtest(c, p), c })
    } catch {
      toast('Could not load history', EXCHANGES[source].name, 'error')
    }
    setBusy(false)
  }

  const markers = useMemo<SeriesMarker<Time>[] | undefined>(() => {
    if (!res) return undefined
    const tz = -new Date().getTimezoneOffset() * 60
    return res.r.trades
      .flatMap((t) => [
        { time: (t.entryTime + tz) as UTCTimestamp, position: t.side === 1 ? 'belowBar' : 'aboveBar', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', color: t.side === 1 ? '#2ff3b3' : '#ff4f80', text: t.side === 1 ? 'L' : 'S' } as SeriesMarker<Time>,
        { time: (t.exitTime + tz) as UTCTimestamp, position: 'inBar', shape: 'circle', color: t.pnl >= 0 ? '#c4a6ff' : '#ffbe55', size: 0.6 } as SeriesMarker<Time>,
      ])
      .sort((a, b) => (a.time as number) - (b.time as number))
  }, [res])

  const r = res?.r
  return (
    <>
      <Panel title="Strategy backtest" k="history" delay={0.05} right={<span className="dim" style={{ fontSize: 12 }}>up to 1000 candles · {EXCHANGES[source].name}</span>}>
        <div className="strat-row" style={{ marginBottom: 18 }}>
          {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
            <button key={id} className={`strat-chip ${p.strategy === id ? 'on' : ''}`} style={{ ['--h' as any]: STRATEGIES[id].hue }} onClick={() => setP({ ...p, strategy: id })}>
              <i />
              {STRATEGIES[id].name}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 18 }}>
          {STRATEGIES[p.strategy].desc}
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div className="field">
            <label>Timeframe</label>
            <Segmented<Interval> size="sm" value={interval} onChange={setIv} options={INTERVALS.map((i) => ({ value: i, label: i }))} />
          </div>
          <div className="field">
            <label>Capital</label>
            <NumInput value={String(p.capital)} onChange={(v) => setP({ ...p, capital: Math.max(100, +v || 0) })} unit="USDT" />
          </div>
          <div className="field">
            <label>
              <span>Risk / trade</span>
              <span className="mono">{p.riskPct}%</span>
            </label>
            <Range value={p.riskPct} min={0.5} max={5} step={0.5} onChange={(v) => setP({ ...p, riskPct: v })} />
          </div>
          <div className="field">
            <label>
              <span>Take profit (ATR)</span>
              <span className="mono">{p.tpAtr.toFixed(1)}×</span>
            </label>
            <Range value={p.tpAtr} min={0.5} max={6} step={0.1} onChange={(v) => setP({ ...p, tpAtr: v })} />
          </div>
          <button className="btn btn-primary" style={{ height: 46 }} onClick={run} disabled={busy}>
            {busy ? 'Simulating…' : r ? 'Run again' : 'Run backtest'}
          </button>
        </div>
      </Panel>

      {busy && (
        <Panel delay={0}>
          <div className="boot" style={{ height: 300 }}>
            <div className="orb lg" />
            <div className="eyebrow">Replaying the strategy over history…</div>
          </div>
        </Panel>
      )}

      {!busy && !r && (
        <Panel delay={0.1}>
          <Empty text="Pick a strategy and press “Run backtest” — the AI replays it over real candle history" />
        </Panel>
      )}

      {!busy && r && res && (
        <>
          <div className="grid g-4">
            <Kpi label="Return" value={r.totalReturn} fmt={(v) => fmtPct(v)} cls={r.totalReturn >= 0 ? 'up' : 'down'} sub={`Buy & hold ${fmtPct(r.buyHold)}`} delay={0.05} spark={r.equity.filter((_, i) => i % 5 === 0).map((e) => e.value)} />
            <Kpi label="Max drawdown" value={-r.maxDrawdown} fmt={(v) => `${v.toFixed(2)}%`} cls="down" delay={0.1} />
            <Kpi label="Win rate" value={r.winRate} fmt={(v) => `${v.toFixed(1)}%`} sub={`${r.trades.length} trades`} delay={0.15} ring={r.winRate / 100} />
            <Kpi label="Profit factor" value={isFinite(r.profitFactor) ? r.profitFactor : 99} fmt={(v) => v.toFixed(2)} sub={`Sharpe ${r.sharpe.toFixed(2)}`} delay={0.2} />
          </div>
          <Panel title="Trades on chart & equity curve" k={interval} delay={0.15}>
            <div className="chart-wrap" style={{ height: 600 }}>
              <PriceChart candles={res.c} signal={null} overlays={{ ...DEFAULT_OVERLAYS, score: false, levels: false, forecast: false, positions: false }} tradeMarkers={markers} equity={r.equity} />
            </div>
          </Panel>
          <Panel title="Trade log" k={`${r.trades.length}`} delay={0.2}>
            <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Side</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Change</th>
                    <th>PnL</th>
                    <th>Reason</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trades.map((t, i) => (
                    <tr key={i}>
                      <td className="mono dim">{i + 1}</td>
                      <td>
                        <span className={`side-tag ${t.side === 1 ? 'long' : 'short'}`}>{t.side === 1 ? 'LONG' : 'SHORT'}</span>
                      </td>
                      <td className="mono">{fmtPrice(t.entry)}</td>
                      <td className="mono">{fmtPrice(t.exit)}</td>
                      <td className={`mono ${t.pnlPct >= 0 ? 'up' : 'down'}`}>{fmtPct(t.pnlPct)}</td>
                      <td className={`mono ${t.pnl >= 0 ? 'up' : 'down'}`}>{fmtSigned(t.pnl)} $</td>
                      <td className="dim">{t.reason}</td>
                      <td className="mono dim">{fmtDate(t.entryTime * 1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!r.trades.length && <Empty text="No entries found in this period — try another timeframe" />}
            </div>
          </Panel>
        </>
      )}
    </>
  )
}
