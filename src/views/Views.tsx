import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, useMemo, useState } from 'react'
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts'
import { Copilot } from '../components/AIWidgets'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { NeuralCore, PriceLine, Ring } from '../components/canvas'
import { ChartPanel } from '../components/ChartPanel'
import { NumInput, Range, Segmented } from '../components/Controls'
import { ActivityRows, BalanceCard, Card, InsightStrip, PositionsCard, PriceCard, SignalHero, useEquity } from '../components/Fintech'
import { DEFAULT_OVERLAYS, PriceChart } from '../components/PriceChart'
import { Sol } from '../components/Session'
import { Icon } from '../components/Icon'
import { CrossExchange, Empty } from '../components/TradeWidgets'
import { EXCHANGES } from '../data/exchanges'
import { INTERVALS, type Candle, type Interval } from '../data/types'
import { backtest, STRATEGIES, type BtParams, type BtResult, type StrategyId } from '../lib/ai'
import { fmtDate, fmtPct, fmtPrice, fmtSigned, fmtUsd } from '../lib/format'
import { EXPERT_INFO, plainFactor } from '../lib/plain'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { PIPELINE, useThoughts, type Stage } from '../store/thoughts'
import { START_BALANCE, useTrading } from '../store/trading'
import { toast } from '../store/ui'

const EASE = [0.22, 1, 0.36, 1] as const

/* ───────────── Home ───────────── */

export function HomeView() {
  return (
    <div className="fx-page">
      <div className="fx-grid home-top">
        <BalanceCard delay={0.04} />
        <SignalHero delay={0.1} />
        <PriceCard delay={0.16} />
      </div>
      <InsightStrip delay={0.22} />
      <PositionsCard delay={0.26} />
    </div>
  )
}

/* ───────────── Activity ───────────── */

const STAGE_NAME: Record<Stage, string> = {
  DATA: 'Reading the market',
  EXPERT: 'Model vote',
  ENSEMBLE: 'Combining votes',
  FORECAST: 'Forecast',
  DECISION: 'Decision',
  BOT: 'AI bot',
  EXECUTE: 'Trade executed',
}

function Thoughts({ limit = 14 }: { limit?: number }) {
  const items = useThoughts((s) => s.items)
  return (
    <div className="thought-list">
      {!items.length && <div className="lab">The AI is starting up…</div>}
      <AnimatePresence initial={false}>
        {items.slice(0, limit).map((it) => (
          <motion.div
            key={it.id}
            layout
            className={`thought ${it.tone} ${it.stage === 'EXECUTE' ? 'exec' : ''}`}
            initial={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="th-meta">
              <span className={`th-stage s-${it.stage}`}>{STAGE_NAME[it.stage]}</span>
              <time>{new Date(it.t).toLocaleTimeString('en-US')}</time>
            </div>
            <div className="th-text">{it.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function ActivityView() {
  return (
    <div className="fx-page">
      <div>
        <div className="page-title">Activity</div>
        <p className="intro" style={{ marginTop: 8 }}>
          Every trade the AI makes and every thought behind it — in real time.
        </p>
      </div>
      <div className="fx-grid g-main-side">
        <Card title="Your trades" delay={0.05}>
          <ActivityRows />
        </Card>
        <Card title="What the AI is thinking" right={<span className="live-dot" />} delay={0.1}>
          <Thoughts />
        </Card>
      </div>
      <div className="fx-grid g-main-side">
        <Copilot delay={0.15} />
        <CrossExchange delay={0.2} />
      </div>
    </div>
  )
}

/* ───────────── Performance ───────────── */

function Stat({ label, value, fmt, sub, color, ring, delay = 0, sol }: { label: string; value: number; fmt: (v: number) => string; sub?: string; color?: string; ring?: number; delay?: number; sol?: boolean }) {
  return (
    <Card delay={delay}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="lab">{label}</div>
          <div className="big-num" style={{ fontSize: 28, marginTop: 10, color }}>
            <AnimatedNumber value={value} format={fmt} />
          </div>
          {sol && <Sol usd={value} signed={value < 0} />}
          {sub && (
            <div className="lab" style={{ fontSize: 12, marginTop: 6 }}>
              {sub}
            </div>
          )}
        </div>
        {ring != null && <Ring value={ring} size={60} color={ring >= 0.5 ? '#14f195' : '#ffbe55'} />}
      </div>
    </Card>
  )
}

export function PerformanceView() {
  const t = useTrading()
  const eq = useEquity()
  const pnl = eq - START_BALANCE
  const wins = t.history.filter((h) => h.pnl > 0).length
  const curve = useMemo(() => {
    const pts = t.equityCurve.map((p) => ({ t: p.t / 1000, v: p.v }))
    pts.push({ t: Date.now() / 1000, v: eq })
    return pts.length > 1 ? pts : [{ t: Date.now() / 1000 - 60, v: START_BALANCE }, ...pts]
  }, [t.equityCurve.length, Math.round(eq)])
  const bySource = (['bot', 'copilot', 'manual'] as const).map((s) => ({
    s,
    pnl: t.history.filter((h) => h.source === s).reduce((a, h) => a + h.pnl, 0),
    n: t.history.filter((h) => h.source === s).length,
  }))
  const maxAbs = Math.max(1, ...bySource.map((b) => Math.abs(b.pnl)))

  return (
    <div className="fx-page">
      <div className="page-title">Performance</div>
      <div className="fx-grid g4">
        <Stat label="Balance" value={eq} fmt={(v) => fmtUsd(v)} delay={0.04} sol />
        <Stat label="Total profit" value={pnl} fmt={(v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`} color={pnl >= 0 ? 'var(--long)' : 'var(--short)'} sub={`${fmtSigned((pnl / START_BALANCE) * 100)}% since start`} delay={0.08} sol />
        <Stat label="Winning trades" value={t.history.length ? (wins / t.history.length) * 100 : 0} fmt={(v) => `${v.toFixed(0)}%`} ring={t.history.length ? wins / t.history.length : 0} delay={0.12} />
        <Stat label="Trades made" value={t.history.length} fmt={(v) => v.toFixed(0)} sub={`${t.positions.length} open now`} delay={0.16} />
      </div>
      <Card title="Balance over time" delay={0.2} right={<span className="lab">updated every 20s</span>}>
        <PriceLine points={curve} height={260} color="#14f195" />
      </Card>
      <div className="fx-grid g2">
        <Card title="Who made the money" delay={0.24}>
          {bySource.map((b) => (
            <div key={b.s} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 14, alignItems: 'center', padding: '12px 0' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{b.s === 'manual' ? 'You' : b.s === 'bot' ? 'AI bot' : 'AI copilot'}</div>
                <div className="lab" style={{ fontSize: 12 }}>
                  {b.n} trades
                </div>
              </div>
              <div style={{ height: 8, borderRadius: 8, background: 'var(--card-3)' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(Math.abs(b.pnl) / maxAbs) * 100}%` }} transition={{ duration: 1, ease: EASE }} style={{ height: '100%', borderRadius: 8, background: b.pnl >= 0 ? 'var(--long)' : 'var(--short)' }} />
              </div>
              <span className="mono" style={{ textAlign: 'right', color: b.pnl >= 0 ? 'var(--long)' : 'var(--short)' }}>
                {b.pnl >= 0 ? '+' : '−'}${Math.abs(b.pnl).toFixed(2)}
                <div>
                  <Sol usd={b.pnl} signed />
                </div>
              </span>
            </div>
          ))}
        </Card>
        <Heatmap />
      </div>
      <Backtest />
    </div>
  )
}

function Heatmap() {
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
    <Card title="Best hours to trade" delay={0.28} right={<span className="lab">profit by day & hour</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(24, minmax(0, 1fr))', gap: 3 }}>
        {cells.map((row, d) => (
          <Fragment key={d}>
            <span className="lab" style={{ fontSize: 11, alignSelf: 'center' }}>
              {days[d]}
            </span>
            {row.map((v, h) => {
              const a = Math.abs(v) / max
              return (
                <div
                  key={h}
                  title={`${days[d]} ${h}:00 · ${v.toFixed(2)} $`}
                  style={{ aspectRatio: '1', borderRadius: 4, background: v === 0 ? 'var(--card-3)' : v > 0 ? `rgba(20,241,149,${0.2 + a * 0.8})` : `rgba(255,95,135,${0.2 + a * 0.8})` }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="lab" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8, paddingLeft: 35 }}>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </Card>
  )
}

function Backtest() {
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
        { time: (t.entryTime + tz) as UTCTimestamp, position: t.side === 1 ? 'belowBar' : 'aboveBar', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', color: t.side === 1 ? '#14f195' : '#ff5f87', text: t.side === 1 ? 'Buy' : 'Sell' } as SeriesMarker<Time>,
        { time: (t.exitTime + tz) as UTCTimestamp, position: 'inBar', shape: 'circle', color: t.pnl >= 0 ? '#a28bff' : '#ffbe55', size: 0.6 } as SeriesMarker<Time>,
      ])
      .sort((a, b) => (a.time as number) - (b.time as number))
  }, [res])

  const r = res?.r
  return (
    <>
      <Card title="Test the AI on past data" delay={0.3} right={<span className="lab">up to 1000 candles · {EXCHANGES[source].name}</span>}>
        <p className="lab" style={{ fontSize: 14, marginBottom: 18 }}>
          See how a strategy would have performed historically. {STRATEGIES[p.strategy].desc}
        </p>
        <div className="strat-row" style={{ marginTop: 0, marginBottom: 20 }}>
          {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
            <button key={id} className={`strat-chip ${p.strategy === id ? 'on' : ''}`} style={{ ['--h' as any]: STRATEGIES[id].hue }} onClick={() => setP({ ...p, strategy: id })}>
              <i />
              {STRATEGIES[id].name}
            </button>
          ))}
        </div>
        <div className="fx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18, alignItems: 'end' }}>
          <div className="field">
            <label>Period per candle</label>
            <Segmented<Interval> size="sm" value={interval} onChange={setIv} options={INTERVALS.map((i) => ({ value: i, label: i }))} />
          </div>
          <div className="field">
            <label>Starting balance</label>
            <NumInput value={String(p.capital)} onChange={(v) => setP({ ...p, capital: Math.max(100, +v || 0) })} unit="USD" />
          </div>
          <div className="field">
            <label>
              <span>Risk per trade</span>
              <span className="mono">{p.riskPct}%</span>
            </label>
            <Range value={p.riskPct} min={0.5} max={5} step={0.5} onChange={(v) => setP({ ...p, riskPct: v })} />
          </div>
          <button className="btn-violet" onClick={run} disabled={busy}>
            {busy ? 'Testing…' : r ? 'Run again' : 'Run test'}
          </button>
        </div>
      </Card>

      {busy && (
        <Card>
          <div className="boot" style={{ height: 260 }}>
            <div className="orb lg" />
            <div className="lab">Replaying the strategy over history…</div>
          </div>
        </Card>
      )}

      {!busy && r && res && (
        <>
          <div className="fx-grid g4">
            <Stat label="Result" value={r.totalReturn} fmt={(v) => fmtPct(v)} color={r.totalReturn >= 0 ? 'var(--long)' : 'var(--short)'} sub={`Just holding SOL: ${fmtPct(r.buyHold)}`} />
            <Stat label="Worst dip" value={-r.maxDrawdown} fmt={(v) => `${v.toFixed(1)}%`} color="var(--short)" sub="largest drop from a peak" />
            <Stat label="Winning trades" value={r.winRate} fmt={(v) => `${v.toFixed(0)}%`} ring={r.winRate / 100} sub={`${r.trades.length} trades`} />
            <Stat label="Profit factor" value={isFinite(r.profitFactor) ? r.profitFactor : 99} fmt={(v) => v.toFixed(2)} sub="$ won per $1 lost" />
          </div>
          <Card title="Trades on the chart">
            <div className="chart-wrap" style={{ height: 560 }}>
              <PriceChart candles={res.c} signal={null} overlays={{ ...DEFAULT_OVERLAYS, score: false, levels: false, forecast: false, positions: false }} tradeMarkers={markers} equity={r.equity} />
            </div>
          </Card>
          <Card title={`Trade log · ${r.trades.length}`}>
            <div className="table-scroll" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Result</th>
                    <th>Why it closed</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trades.map((t, i) => (
                    <tr key={i}>
                      <td className="mono dim">{i + 1}</td>
                      <td>
                        <span className={`side-tag ${t.side === 1 ? 'long' : 'short'}`}>{t.side === 1 ? 'Buy' : 'Sell'}</span>
                      </td>
                      <td className="mono">${fmtPrice(t.entry)}</td>
                      <td className="mono">${fmtPrice(t.exit)}</td>
                      <td className={`mono ${t.pnl >= 0 ? 'up' : 'down'}`}>{fmtSigned(t.pnl)} $</td>
                      <td className="dim">{t.reason}</td>
                      <td className="mono dim">{fmtDate(t.entryTime * 1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!r.trades.length && <Empty text="No trades in this period — try another candle period" />}
            </div>
          </Card>
        </>
      )}
    </>
  )
}

/* ───────────── How AI decides ───────────── */

const STEPS: Record<string, [string, string]> = {
  DATA: ['Read the market', 'Live prices, the order book and every new trade from the exchange.'],
  EXPERT: ['9 models vote', 'Each model looks at one thing — trend, momentum, buyers vs sellers — and votes.'],
  ENSEMBLE: ['Combine votes', 'Votes are weighted and merged into one score from −100 to +100.'],
  FORECAST: ['Forecast', 'The AI projects where the price is likely to go, with a range.'],
  DECISION: ['Decide', 'Strong score → buy or sell with an automatic stop and target. Otherwise wait.'],
}

export function HowView() {
  const signal = useSignal((s) => s.signal)
  const stage = useThoughts((s) => s.stage)
  const idx = PIPELINE.indexOf(stage)
  const inputs = useMemo(
    () => signal?.factors.map((f) => ({ label: f.label, value: Math.round(f.value * 50) / 50 })) ?? [],
    [signal?.factors.map((f) => Math.round(f.value * 50)).join()],
  )
  const dirLabel = signal ? (signal.direction === 'LONG' ? 'BUY' : signal.direction === 'SHORT' ? 'SELL' : 'WAIT') : ''

  return (
    <div className="fx-page">
      <div>
        <div className="page-title">How the AI decides</div>
        <p className="intro" style={{ marginTop: 8 }}>
          Solana AI runs a full analysis every second. Nine independent models each vote on whether SOL is likely to go up or down; their votes are combined into one decision. Watch it happen live below.
        </p>
      </div>
      <div className="step-cards">
        {PIPELINE.map((st, i) => (
          <motion.div key={st} className={`step-card ${i === idx ? 'on' : ''} ${i < idx ? 'done' : ''}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06, duration: 0.6, ease: EASE }}>
            <div className="n">{i < idx ? <Icon name="check" size={12} /> : i + 1}</div>
            <h4>{STEPS[st][0]}</h4>
            <p>{STEPS[st][1]}</p>
          </motion.div>
        ))}
      </div>
      <Card title="Live neural network" right={<span className="lab">9 models → hidden layer → decision</span>} delay={0.15}>
        {signal ? (
          <NeuralCore inputs={inputs} score={Math.round(signal.score)} label={dirLabel} height={420} />
        ) : (
          <div className="boot">
            <div className="orb lg" />
          </div>
        )}
      </Card>
      <div className="fx-grid g-main-side">
        <Card title="The 9 models and their votes" delay={0.2}>
          {signal?.factors.map((f) => {
            const v = Math.max(-1, Math.min(1, f.value))
            const w = Math.abs(v) * 50
            return (
              <div key={f.key} className="expert">
                <div>
                  <div className="en">
                    {f.label} <span className="lab" style={{ fontWeight: 400 }}>· {plainFactor(f)}</span>
                  </div>
                  <div className="ed">{EXPERT_INFO[f.key]}</div>
                </div>
                <div className="vote">
                  <i style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? 'var(--long)' : 'var(--short)' }} />
                </div>
                <div className="mono" style={{ textAlign: 'right', color: v > 0.05 ? 'var(--long)' : v < -0.05 ? 'var(--short)' : 'var(--ink-3)' }}>
                  {v > 0 ? '+' : ''}
                  {(v * 100).toFixed(0)}
                </div>
              </div>
            )
          })}
        </Card>
        <Card title="Live reasoning" right={<span className="live-dot" />} delay={0.25}>
          <Thoughts limit={10} />
        </Card>
      </div>
      <div>
        <div className="card-t" style={{ fontSize: 18, margin: '10px 0 14px' }}>
          Pro chart
        </div>
        <ChartPanel delay={0.3} />
      </div>
    </div>
  )
}
