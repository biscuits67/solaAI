import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts'
import { Copilot } from '../components/Copilot'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { NeuralCore, PriceLine, Ring } from '../components/canvas'
import { ActivityRows, BalanceCard, Card, Hero, Hint, PositionsCard, PriceCard, useEquity, WhyCard } from '../components/Fintech'
import { Icon } from '../components/Icon'
import type { Overlays } from '../components/PriceChart'
import { Sol } from '../components/Session'
import { EXCHANGES, loadQuotes, type Quote } from '../data/exchanges'
import type { Candle, Interval } from '../data/types'
import { backtest, buildCtx, scoreAt, STRATEGIES, type BtResult, type StrategyId } from '../lib/ai'
import { fmtDate } from '../lib/format'
import { money, pct, tone } from '../lib/money'
import { DUR, EASE, SPRING } from '../lib/motion'
import { EXPERT_INFO, plainFactor } from '../lib/plain'
import { useCandles } from '../store/candles'
import { AI_INTERVAL, useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { PIPELINE, useThoughts, type Stage } from '../store/thoughts'
import { START_BALANCE, useTrading } from '../store/trading'
import { toast, useUI } from '../store/ui'

// the trading chart library is heavy — load it only when a page needs it
const PriceChart = lazy(() => import('../components/PriceChart').then((m) => ({ default: m.PriceChart })))

const ChartFallback = ({ h }: { h: number }) => <div className="skeleton" style={{ height: h }} />

/* ───────────── Home ───────────── */

export function HomeView() {
  return (
    <div className="fx-page">
      <Hero delay={0.04} />
      <PositionsCard />
      <div className="fx-grid home-row">
        <BalanceCard delay={0.1} />
        <PriceCard delay={0.16} />
        <WhyCard delay={0.22} />
      </div>
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
  EXECUTE: 'Trade',
}

function Thoughts({ limit = 12 }: { limit?: number }) {
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
            initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.panel, ease: EASE.emphasized }}
          >
            <div className="th-meta">
              <span className="th-stage">{STAGE_NAME[it.stage]}</span>
              <time>{new Date(it.t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time>
            </div>
            <div className="th-text">{it.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-head">
      <h1 className="page-title">{title}</h1>
      <p className="intro">{sub}</p>
    </div>
  )
}

export function ActivityView() {
  return (
    <div className="fx-page">
      <PageHead title="Activity" sub="Every trade the AI makes and every thought behind it — in real time." />
      <div className="fx-grid g-main-side top">
        <div className="stack">
          <Card title="Your trades" delay={0.05}>
            <ActivityRows />
          </Card>
          <Copilot delay={0.12} />
        </div>
        <div className="stack">
          <Card title="What the AI is thinking" right={<span className="lab">live</span>} delay={0.08}>
            <Thoughts />
          </Card>
          <ExchangesCard />
        </div>
      </div>
    </div>
  )
}

function ExchangesCard() {
  const [q, setQ] = useState<Quote[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => loadQuotes().then((r) => alive && setQ(r))
    load()
    const t = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  const live = (q ?? []).filter((x) => x.price != null)
  const prices = live.map((x) => x.price!)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return (
    <Card title="SOL across exchanges" right={live.length > 1 ? <span className="lab">spread {(((max - min) / min) * 100).toFixed(3)}%</span> : null} delay={0.16}>
      {!q && <div className="skeleton" style={{ height: 120 }} />}
      {q && !live.length && <div className="lab">Exchange prices are not reachable from your network right now.</div>}
      {live.map((x) => (
        <div key={x.venue} className="xrow">
          <span>{x.venue}</span>
          <b className="num">{money(x.price)}</b>
          <span className={tone(x.change)}>{pct(x.change)}</span>
        </div>
      ))}
    </Card>
  )
}

/* ───────────── Performance ───────────── */

function Stat({
  label,
  value,
  fmt,
  sub,
  cls = '',
  ring,
  delay = 0,
  sol,
  hint,
  empty,
}: {
  label: string
  value: number
  fmt: (v: number) => string
  sub?: string
  cls?: string
  ring?: number
  delay?: number
  sol?: boolean
  hint?: string
  empty?: boolean
}) {
  return (
    <Card delay={delay}>
      <div className="stat-row">
        <div style={{ minWidth: 0 }}>
          <div className="lab">
            {label} {hint && <Hint>{hint}</Hint>}
          </div>
          <div className={`big-num stat-v ${empty ? 'flat' : cls}`}>{empty ? '—' : <AnimatedNumber value={value} format={fmt} />}</div>
          {sol && !empty && <Sol usd={value} signed={value < 0} />}
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
        {ring != null && !empty && <Ring value={ring} size={60} color={ring >= 0.5 ? '#19fb9b' : '#ffbe55'} />}
      </div>
    </Card>
  )
}

export function PerformanceView() {
  const t = useTrading()
  const eq = useEquity()
  const setTab = useUI((s) => s.setTab)
  const pnl = eq - START_BALANCE
  const n = t.history.length
  const wins = t.history.filter((h) => h.pnl > 0).length
  const fees = t.history.reduce((s, h) => s + h.fees, 0)
  const curve = useMemo(() => {
    const pts = t.equityCurve.map((p) => ({ t: p.t / 1000, v: p.v }))
    pts.push({ t: Date.now() / 1000, v: eq })
    return pts
  }, [t.equityCurve.length, Math.round(eq)])
  const bySource = (['bot', 'copilot', 'manual'] as const).map((s) => ({
    s,
    pnl: t.history.filter((h) => h.source === s).reduce((a, h) => a + h.pnl, 0),
    n: t.history.filter((h) => h.source === s).length,
  }))
  const maxAbs = Math.max(1, ...bySource.map((b) => Math.abs(b.pnl)))

  return (
    <div className="fx-page">
      <PageHead title="Performance" sub="How your balance and the AI have done so far." />
      <div className="fx-grid g4">
        <Stat label="Balance" value={eq} fmt={(v) => money(v)} delay={0.04} sol />
        <Stat label="Total profit" value={pnl} fmt={(v) => money(v, { sign: true })} cls={tone(pnl)} sub={`${pct((pnl / START_BALANCE) * 100)} since start`} delay={0.08} />
        <Stat label="Winning trades" value={n ? (wins / n) * 100 : 0} fmt={(v) => `${v.toFixed(0)}%`} ring={n ? wins / n : undefined} sub={n ? `${wins} of ${n} trades` : 'no trades yet'} delay={0.12} empty={!n} />
        <Stat label="Fees paid" value={fees} fmt={(v) => money(v)} sub={n ? `${n} trades` : 'no trades yet'} delay={0.16} empty={!n} />
      </div>

      {n === 0 ? (
        <Card delay={0.2} className="empty-hero">
          <div className="eh-icon">
            <Icon name="spark" size={22} />
          </div>
          <h3>Your stats will appear here</h3>
          <p>Run your first AI session — it takes one minute. Your balance chart, win rate and best hours to trade will fill in automatically.</p>
          <button className="btn-violet" onClick={() => setTab('home')}>
            Go to Home and start a session
          </button>
        </Card>
      ) : (
        <>
          <Card title="Balance over time" delay={0.2}>
            {curve.length > 2 ? <PriceLine points={curve} height={260} color="#19fb9b" axis /> : <div className="lab">The chart fills in as your balance changes (a point every 20 seconds).</div>}
          </Card>
          <div className="fx-grid g2 top">
            <Card title="Who made the money" delay={0.24}>
              {bySource.map((b) => (
                <div key={b.s} className="src-row">
                  <div>
                    <div className="rt">{b.s === 'manual' ? 'You' : b.s === 'bot' ? 'AI sessions' : 'AI copilot'}</div>
                    <div className="rs">{b.n} trades</div>
                  </div>
                  <div className="bar">
                    <motion.i initial={{ width: 0 }} animate={{ width: `${(Math.abs(b.pnl) / maxAbs) * 100}%` }} transition={{ duration: DUR.story, ease: EASE.emphasized }} className={tone(b.pnl)} />
                  </div>
                  <span className={`num ${tone(b.pnl)}`}>{money(b.pnl, { sign: true })}</span>
                </div>
              ))}
            </Card>
            {n >= 10 ? (
              <Heatmap />
            ) : (
              <Card title="Best hours to trade" delay={0.28}>
                <div className="lab" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Unlocks after 10 trades — you have {n}. It shows which hours of the week made you the most money.
                </div>
                <div className="unlock">
                  <motion.i initial={{ width: 0 }} animate={{ width: `${(n / 10) * 100}%` }} transition={{ duration: DUR.story, ease: EASE.emphasized }} />
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      <TrackRecord />
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
      <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(24, minmax(0, 1fr))', gap: 3 }}>
        {cells.map((row, d) => (
          <Fragment key={d}>
            <span className="lab" style={{ fontSize: 12, alignSelf: 'center' }}>
              {days[d]}
            </span>
            {row.map((v, h) => {
              const a = Math.abs(v) / max
              return (
                <div
                  key={h}
                  title={`${days[d]} ${h}:00 · ${money(v, { sign: true })}`}
                  style={{ aspectRatio: '1', borderRadius: 4, background: v === 0 ? 'var(--card-3)' : v > 0 ? `rgba(25,251,155,${0.2 + a * 0.8})` : `rgba(255,92,122,${0.2 + a * 0.8})` }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </Card>
  )
}

/** Honest hit-rate of past AI signals on the loaded history. */
function TrackRecord() {
  const candles = useMarket((s) => s.candles)
  const key = candles.length ? `${candles[0].time}-${candles.length}-${Math.floor(candles.at(-1)!.time / 900)}` : ''
  const data = useMemo(() => {
    if (candles.length < 120) return null
    const x = buildCtx(candles)
    const H = 8 // 2 hours on 15-minute candles
    const out: { t: number; side: 1 | -1; entry: number; move: number; hit: boolean }[] = []
    let last = -99
    for (let i = 51; i < candles.length - H; i++) {
      if (i - last < 6) continue
      const s = scoreAt(x, i)
      const p = scoreAt(x, i - 1)
      const side: 1 | -1 | 0 = s > 35 && p <= 35 ? 1 : s < -35 && p >= -35 ? -1 : 0
      if (!side) continue
      last = i
      const entry = candles[i].close
      const move = ((candles[i + H].close - entry) / entry) * 100 * side
      out.push({ t: candles[i].time, side, entry, move, hit: move > 0.25 })
    }
    const hits = out.filter((o) => o.hit).length
    return { list: out.reverse(), hits, total: out.length, avg: out.reduce((a, o) => a + o.move, 0) / (out.length || 1) }
  }, [key])

  return (
    <Card
      title={
        <>
          AI track record <Hint>Every strong AI signal on the last ~5 days of 15-minute data, checked 2 hours later. Losses are included — this is the honest picture.</Hint>
        </>
      }
      right={<span className="lab">last ~5 days · checked after 2h</span>}
      delay={0.3}
    >
      {!data && <div className="skeleton" style={{ height: 160 }} />}
      {data && (
        <div className="tr-grid">
          <div className="tr-sum">
            <div>
              <span>Signals</span>
              <b>{data.total}</b>
            </div>
            <div>
              <span>Correct</span>
              <b className={data.total ? (data.hits / data.total >= 0.5 ? 'up' : 'down') : ''}>{data.total ? `${Math.round((data.hits / data.total) * 100)}%` : '—'}</b>
            </div>
            <div>
              <span>Avg. move</span>
              <b className={tone(data.avg)}>{data.total ? pct(data.avg) : '—'}</b>
            </div>
          </div>
          <div className="tr-list">
            {!data.list.length && <div className="lab">No strong signals in this period — the AI mostly waited.</div>}
            {data.list.slice(0, 6).map((o) => (
              <div key={o.t} className="tr-row">
                <span className={`ri ${o.side === 1 ? 'up' : 'down'}`}>
                  <Icon name={o.side === 1 ? 'up' : 'down'} size={14} />
                </span>
                <span>
                  <b>{o.side === 1 ? 'Buy' : 'Sell'}</b> at {money(o.entry)}
                  <small>{fmtDate(o.t * 1000)}</small>
                </span>
                <span className={`num ${tone(o.move)}`}>{pct(o.move)}</span>
                <span className={`verdict ${o.hit ? 'up' : 'down'}`}>{o.hit ? 'Correct' : 'Missed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

const PERIODS: { label: string; iv: Interval }[] = [
  { label: 'Last 10 days', iv: '15m' },
  { label: 'Last 40 days', iv: '1h' },
  { label: 'Last 5 months', iv: '4h' },
]

function Backtest() {
  const source = useMarket((s) => s.source)
  const [strategy, setStrategy] = useState<StrategyId>('ai')
  const [period, setPeriod] = useState(PERIODS[0])
  const [res, setRes] = useState<{ r: BtResult; c: Candle[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const c = await EXCHANGES[source].loadCandles(period.iv, 1000)
      await new Promise((r) => setTimeout(r, 400))
      setRes({ r: backtest(c, { strategy, capital: 10000, riskPct: 1.5, slAtr: 1.6, tpAtr: 2.8, leverage: 3, threshold: 35, fee: 0.0005 }), c })
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
        { time: (t.entryTime + tz) as UTCTimestamp, position: t.side === 1 ? 'belowBar' : 'aboveBar', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', color: t.side === 1 ? '#19fb9b' : '#ff5c7a', text: t.side === 1 ? 'Buy' : 'Sell' } as SeriesMarker<Time>,
        { time: (t.exitTime + tz) as UTCTimestamp, position: 'inBar', shape: 'circle', color: t.pnl >= 0 ? '#a99aff' : '#ffbe55', size: 0.6 } as SeriesMarker<Time>,
      ])
      .sort((a, b) => (a.time as number) - (b.time as number))
  }, [res])

  const r = res?.r
  return (
    <>
      <Card title="Test a strategy on past data" right={<span className="lab">starting with {money(10000, { d: 0 })}</span>} delay={0.34}>
        <div className="bt-bar">
          <div className="bt-field">
            <span className="lab">Strategy</span>
            <div className="chip-set">
              {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
                <button key={id} className={strategy === id ? 'on' : ''} onClick={() => setStrategy(id)}>
                  {STRATEGIES[id].name}
                </button>
              ))}
            </div>
          </div>
          <div className="bt-field">
            <span className="lab">Period</span>
            <div className="chip-set">
              {PERIODS.map((p) => (
                <button key={p.label} className={period.label === p.label ? 'on' : ''} onClick={() => setPeriod(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-violet" onClick={run} disabled={busy}>
            {busy ? 'Testing…' : r ? 'Run again' : 'Run test'}
          </button>
        </div>
        <p className="lab bt-desc">{STRATEGIES[strategy].desc}</p>
      </Card>

      <AnimatePresence mode="wait">
        {busy && (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <div className="skeleton" style={{ height: 240 }} />
            </Card>
          </motion.div>
        )}
        {!busy && r && res && (
          <motion.div key="res" className="fx-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: DUR.panel, ease: EASE.standard }}>
            <div className="fx-grid g4">
              <Stat label="Result" value={r.totalReturn} fmt={(v) => pct(v)} cls={tone(r.totalReturn)} sub={`Just holding SOL: ${pct(r.buyHold)}`} />
              <Stat label="Worst dip" value={-r.maxDrawdown} fmt={(v) => pct(v, 1)} cls="down" sub="largest drop from a peak" />
              <Stat label="Winning trades" value={r.winRate} fmt={(v) => `${v.toFixed(0)}%`} ring={r.winRate / 100} sub={`${r.trades.length} trades`} empty={!r.trades.length} />
              <Stat label="Won per $1 lost" value={isFinite(r.profitFactor) ? r.profitFactor : 99} fmt={(v) => money(v)} sub="profit factor" empty={!r.trades.length} />
            </div>
            <Card title="Trades on the chart">
              <div className="chart-wrap" style={{ height: 520 }}>
                <Suspense fallback={<ChartFallback h={520} />}>
                  <PriceChart
                    candles={res.c}
                    signal={null}
                    overlays={{ ema: true, bb: false, forecast: false, levels: false, markers: false, score: false, rsi: false, positions: false }}
                    tradeMarkers={markers}
                    equity={r.equity}
                  />
                </Suspense>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ───────────── How AI decides ───────────── */

const STEPS: Record<string, [string, string]> = {
  DATA: ['Read the market', 'Live prices, the order book and every new trade from the exchange.'],
  EXPERT: ['9 models vote', 'Each model looks at one thing — trend, momentum, buyers vs sellers — and votes.'],
  ENSEMBLE: ['Combine votes', 'Votes are weighted and merged into one score from −100 to +100.'],
  FORECAST: ['Forecast 6 hours', 'The AI projects where the price is likely to be, with a range.'],
  DECISION: ['Decide', 'Trade only if the expected move beats fees. Otherwise, wait.'],
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
      <PageHead title="How the AI decides" sub="Every second, nine independent models vote on whether SOL is likely to go up or down. Their votes become one decision — watch it happen live." />
      <div className="step-cards">
        {PIPELINE.map((st, i) => (
          <div key={st} className={`step-card ${i === idx ? 'on' : ''} ${i < idx ? 'done' : ''}`}>
            <div className="n">{i < idx ? <Icon name="check" size={12} /> : i + 1}</div>
            <h4>{STEPS[st][0]}</h4>
            <p>{STEPS[st][1]}</p>
          </div>
        ))}
      </div>
      <Card title="Live neural network" right={<span className="lab">9 models → hidden layer → decision</span>} delay={0.1}>
        {signal ? <NeuralCore inputs={inputs} score={Math.round(signal.score)} label={dirLabel} height={440} /> : <div className="skeleton" style={{ height: 440 }} />}
      </Card>
      <div className="fx-grid g-main-side top">
        <Card title="The 9 models and their votes" delay={0.14}>
          {signal?.factors.map((f) => {
            const v = Math.max(-1, Math.min(1, f.value))
            const w = Math.abs(v) * 50
            const tn = tone(Math.abs(v) < 0.05 ? 0 : v)
            return (
              <div key={f.key} className="expert">
                <div>
                  <div className="en">
                    {f.label} <span className="ep">· {plainFactor(f)}</span>
                  </div>
                  <div className="ed">{EXPERT_INFO[f.key]}</div>
                </div>
                <div className="vote">
                  <i style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%` }} className={tn} />
                </div>
                <div className={`num ${tn}`} style={{ textAlign: 'right' }}>
                  {v > 0.05 ? '+' : ''}
                  {(v * 100).toFixed(0)}
                </div>
              </div>
            )
          })}
        </Card>
        <Card title="Live reasoning" right={<span className="lab">live</span>} delay={0.18}>
          <Thoughts limit={9} />
        </Card>
      </div>
      <div className="fx-grid g3 top">
        <Card title="What the AI is" delay={0.2}>
          <ul className="ticks">
            <li>A statistical model that reads live SOL market data every second.</li>
            <li>Nine simple, transparent models whose votes you can see above.</li>
            <li>Trades only when the expected move is larger than fees.</li>
          </ul>
        </Card>
        <Card title="What it is not" delay={0.24}>
          <ul className="ticks no">
            <li>Not a guarantee of profit — it loses trades too.</li>
            <li>Not financial advice or a licensed adviser.</li>
            <li>Not aware of news, hacks or announcements.</li>
          </ul>
        </Card>
        <Card title="Your protection" delay={0.28}>
          <ul className="ticks">
            <li>Every AI trade has a safety stop.</li>
            <li>Sessions stop at the max loss you see before starting.</li>
            <li>You can end a session at any time.</li>
          </ul>
        </Card>
      </div>
      <ProChart />
    </div>
  )
}

const PRO_TF: { label: string; iv: Interval }[] = [
  { label: '1m', iv: '1m' },
  { label: '15m', iv: '15m' },
  { label: '1h', iv: '1h' },
  { label: '4h', iv: '4h' },
]

const OVERLAY_LABELS: { k: keyof Overlays; label: string; aiOnly?: boolean }[] = [
  { k: 'ema', label: 'Moving averages' },
  { k: 'bb', label: 'Bollinger bands' },
  { k: 'forecast', label: 'AI forecast', aiOnly: true },
  { k: 'levels', label: 'Support / resistance', aiOnly: true },
  { k: 'markers', label: 'AI signals', aiOnly: true },
  { k: 'score', label: 'AI score', aiOnly: true },
  { k: 'rsi', label: 'RSI' },
]

function ProChart() {
  const signal = useSignal((s) => s.signal)
  const positions = useTrading((s) => s.positions)
  const [tf, setTf] = useState(PRO_TF[1])
  const [ov, setOv] = useState<Overlays>({ ema: true, bb: false, forecast: true, levels: true, markers: true, score: true, rsi: false, positions: true })
  const { candles } = useCandles(tf.iv, 500)
  const aiTf = tf.iv === AI_INTERVAL
  const eff: Overlays = aiTf ? ov : { ...ov, forecast: false, markers: false, score: false, levels: false }
  return (
    <Card
      title={
        <>
          Pro chart <Hint>For experienced traders: candles, indicators and the AI’s own overlays. AI overlays work on the 15m chart — the timeframe the AI analyses.</Hint>
        </>
      }
      right={
        <div className="tf">
          {PRO_TF.map((t) => (
            <button key={t.label} className={tf.label === t.label ? 'on' : ''} onClick={() => setTf(t)}>
              {tf.label === t.label && <motion.span layoutId="pro-tf" className="pill" transition={SPRING} />}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      }
      delay={0.3}
    >
      <div className="chip-set" style={{ marginBottom: 16 }}>
        {OVERLAY_LABELS.map((o) => (
          <button key={o.k} className={eff[o.k] ? 'on' : ''} disabled={o.aiOnly && !aiTf} onClick={() => setOv((s) => ({ ...s, [o.k]: !s[o.k] }))}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="chart-wrap" style={{ height: 520 }}>
        {candles.length ? (
          <Suspense fallback={<ChartFallback h={520} />}>
            <PriceChart key={tf.label + (aiTf ? 'ai' : '') + eff.score + eff.rsi} candles={candles} signal={aiTf ? signal : null} overlays={eff} positions={positions} />
          </Suspense>
        ) : (
          <ChartFallback h={520} />
        )}
      </div>
    </Card>
  )
}
