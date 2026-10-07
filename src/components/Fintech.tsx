import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Interval } from '../data/types'
import { STRATEGIES, type StrategyId } from '../lib/ai'
import { fmtPrice, fmtSigned, fmtUsd } from '../lib/format'
import { action, confidenceWord, headline, mood, plainFactor } from '../lib/plain'
import { useBot } from '../store/bot'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { equityOf, START_BALANCE, upnl, useTrading, type Side } from '../store/trading'
import { toast, useUI, type Tab } from '../store/ui'
import { AnimatedNumber } from './AnimatedNumber'
import { PriceLine } from './canvas'
import { MIN_REAL_USD, ModeSwitch, VenuePicker } from './Shell'
import { SolanaLogo } from './SolanaLogo'
import { SessionLive, SessionSheet, Sol } from './Session'
import { useSession } from '../store/session'

const EASE = [0.22, 1, 0.36, 1] as const

export const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'activity', label: 'Activity' },
  { id: 'performance', label: 'Performance' },
  { id: 'how', label: 'How AI decides' },
]

/* ───────────── primitives ───────────── */

export function Card({
  children,
  className = '',
  delay = 0,
  title,
  right,
  style,
}: {
  children: ReactNode
  className?: string
  delay?: number
  title?: ReactNode
  right?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <motion.section
      className={`card ${className}`}
      style={style}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {(title || right) && (
        <div className="card-h">
          <div className="card-t">{title}</div>
          {right}
        </div>
      )}
      {children}
    </motion.section>
  )
}

/* ───────────── header ───────────── */

export function Header() {
  const { tab, setTab } = useUI()
  return (
    <motion.header className="fx-top" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
      <div className="fx-logo">
        <SolanaLogo size={36} />
        Solana AI
      </div>
      <nav className="fx-nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.div layoutId="fx-nav" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="fx-right">
        <VenuePicker />
        <ModeSwitch />
      </div>
    </motion.header>
  )
}

export function MobileNav() {
  const { tab, setTab } = useUI()
  return (
    <nav className="fx-mnav">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
          {tab === t.id && <motion.div layoutId="fx-mnav" className="pill" />}
          <span>{t.id === 'how' ? 'How AI' : t.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ───────────── helpers ───────────── */

export function useEquity() {
  const price = useMarket((s) => s.price)
  const t = useTrading()
  return equityOf(t, price)
}

function useGuard() {
  const mode = useUI((s) => s.mode)
  const setWalletOpen = useUI((s) => s.setWalletOpen)
  return (fn: () => void) => {
    if (mode === 'real') {
      toast('Connect a wallet first', `The AI trades only with wallets holding at least $${MIN_REAL_USD}`, 'error')
      setWalletOpen(true)
      return
    }
    fn()
  }
}

/* ───────────── balance + actions + activity ───────────── */

export function BalanceCard({ delay = 0 }: { delay?: number }) {
  const mode = useUI((s) => s.mode)
  const setSheet = useUI((s) => s.setSheet)
  const setWalletOpen = useUI((s) => s.setWalletOpen)
  const bot = useBot()
  const eq = useEquity()
  const pnl = eq - START_BALANCE
  const guard = useGuard()
  const session = useSession()
  const running = (!!session.active || bot.enabled) && mode === 'demo'
  const startStop = () => (running ? (session.active ? session.stop() : bot.toggle()) : guard(() => setSheet('session')))
  const whole = Math.floor(eq)
  const cents = Math.round((eq - whole) * 100)

  return (
    <Card delay={delay}>
      <div className="lab">{mode === 'demo' ? 'Demo balance' : 'Wallet balance'}</div>
      {mode === 'demo' ? (
        <>
          <div className="big-num bal">
            <AnimatedNumber value={whole} format={(v) => `$${Math.round(v).toLocaleString('en-US')}`} />
            <small>.{String(cents).padStart(2, '0')}</small>
          </div>
          <Sol usd={eq} />
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={pnl >= 0 ? 'chip-up' : 'chip-down'}>
              {fmtSigned(pnl)} $ · {fmtSigned((pnl / START_BALANCE) * 100)}%
            </span>
            <Sol usd={pnl} signed />
          </div>
        </>
      ) : (
        <>
          <div className="big-num bal" style={{ color: 'var(--ink-4)' }}>
            $—<small>.—</small>
          </div>
          <button className="btn-violet" style={{ marginTop: 14, padding: '12px 22px', fontSize: 14 }} onClick={() => setWalletOpen(true)}>
            Connect wallet
          </button>
        </>
      )}

      <div className="acts">
        <button className={`act main ${running ? 'running' : ''}`} onClick={startStop}>
          <span className="ic">{running ? <i className="g-stop" /> : <i className="g-play" />}</span>
          {running ? 'Stop AI' : 'Start AI'}
        </button>
        <button className="act" onClick={() => guard(() => setSheet('buy'))}>
          <span className="ic">
            <i className="g-plus" />
          </span>
          Buy
        </button>
        <button className="act" onClick={() => guard(() => setSheet('sell'))}>
          <span className="ic">
            <i className="g-minus" />
          </span>
          Sell
        </button>
        <button className="act" onClick={() => setSheet('settings')}>
          <span className="ic">
            <span className="g-dots">
              <i />
              <i />
              <i />
            </span>
          </span>
          More
        </button>
      </div>

      <div className="lab" style={{ margin: '28px 0 6px' }}>
        AI activity
      </div>
      <ActivityRows limit={4} />
    </Card>
  )
}

interface Act {
  key: string
  tone: 'up' | 'down' | 'flat' | 'ai'
  glyph: string
  title: string
  sub: string
  amount?: number
  t: number
}

export function useActivity(): Act[] {
  const price = useMarket((s) => s.price)
  const { positions, history } = useTrading()
  const bot = useBot()
  return useMemo(() => {
    const src = (s: string) => (s === 'bot' ? 'AI bot' : s === 'copilot' ? 'AI copilot' : 'You')
    const time = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const items: Act[] = []
    for (const p of positions)
      items.push({
        key: 'p' + p.id,
        tone: 'ai',
        glyph: '◷',
        title: `${p.side === 'long' ? 'Holding' : 'Short'} ${p.size.toFixed(2)} SOL`,
        sub: `${src(p.source)} · opened ${time(p.openedAt)} at $${p.entry.toFixed(2)}`,
        amount: upnl(p, price),
        t: p.openedAt + 1e12,
      })
    for (const h of history.slice(0, 30))
      items.push({
        key: 'h' + h.id + h.closedAt,
        tone: h.pnl >= 0 ? 'up' : 'down',
        glyph: h.side === 'long' ? '↑' : '↓',
        title: `${h.side === 'long' ? 'Bought' : 'Sold'} ${h.size.toFixed(2)} SOL`,
        sub: `${h.reason} · ${src(h.source)} · ${time(h.closedAt)}`,
        amount: h.pnl,
        t: h.closedAt,
      })
    if (bot.enabled && !positions.some((p) => p.source === 'bot'))
      items.push({ key: 'wait', tone: 'flat', glyph: '…', title: 'Waiting for a good entry', sub: 'AI bot is watching the market', t: 2e12 })
    return items.sort((a, b) => b.t - a.t)
  }, [positions, history, bot.enabled, Math.round(price * 10)])
}

export function ActivityRows({ limit = 50 }: { limit?: number }) {
  const items = useActivity().slice(0, limit)
  if (!items.length)
    return (
      <div className="row" style={{ borderTop: 0 }}>
        <div className="ri flat">…</div>
        <div>
          <div className="rt">No activity yet</div>
          <div className="rs">Press “Start AI” and the AI will trade for you</div>
        </div>
      </div>
    )
  return (
    <div className="rows">
      <AnimatePresence initial={false}>
        {items.map((a) => (
          <motion.div key={a.key} className="row" layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            <div className={`ri ${a.tone}`}>{a.glyph}</div>
            <div style={{ minWidth: 0 }}>
              <div className="rt">{a.title}</div>
              <div className="rs">{a.sub}</div>
            </div>
            {a.amount != null && (
              <div className="ra" style={{ color: a.amount >= 0 ? 'var(--long)' : 'var(--short)' }}>
                {a.amount >= 0 ? '+' : '−'}${Math.abs(a.amount).toFixed(2)}
                <div>
                  <Sol usd={a.amount} signed />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ───────────── AI signal hero ───────────── */

export function SignalHero({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const interval = useMarket((s) => s.interval)
  const bot = useBot()
  const mode = useUI((s) => s.mode)
  const guard = useGuard()
  const dir = signal?.direction ?? 'NEUTRAL'
  const segs = signal ? Math.max(1, Math.round(signal.confidence / 20)) : 0
  const session = useSession()
  const running = (!!session.active || bot.enabled) && mode === 'demo'
  const setSheet = useUI((s) => s.setSheet)

  return (
    <Card className={`sig-card ${dir}`} delay={delay}>
      <div className="lab">
        <span className="live-dot" /> AI signal · live
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={signal ? action(signal) : 'load'}
          className="big-num sig-title"
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {signal ? action(signal) : 'Analyzing…'}
        </motion.div>
      </AnimatePresence>
      <p className="sig-text">{signal ? headline(signal, interval) : 'The AI is reading the market — this takes a few seconds.'}</p>
      <div className="meter">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < segs ? 'on' : ''} />
        ))}
      </div>
      <div style={{ fontSize: 12.5, marginTop: 8, color: 'rgba(255,255,255,0.8)' }}>
        {signal ? `Confidence ${signal.confidence}% · ${confidenceWord(signal.confidence)}` : '—'}
      </div>
      {session.active && mode === 'demo' ? (
        <SessionLive />
      ) : (
      <div className="sig-actions">
        <button className={`btn-white ${running ? 'stop' : ''}`} onClick={() => (running ? bot.toggle() : guard(() => setSheet('session')))}>
          {running ? (
            <>
              <i className="g-stop" style={{ width: 11, height: 11 }} /> Stop AI trading
            </>
          ) : (
            'Start AI trading'
          )}
        </button>
        {running && (
          <span className="ai-running">
            <span className="live-dot" style={{ background: '#fff' }} /> AI is trading for you
          </span>
        )}
      </div>
      )}
    </Card>
  )
}

/* ───────────── price card ───────────── */

const TF: { label: string; iv: Interval; bars: number }[] = [
  { label: '1H', iv: '1m', bars: 60 },
  { label: '1D', iv: '15m', bars: 96 },
  { label: '1W', iv: '1h', bars: 168 },
  { label: '1M', iv: '4h', bars: 180 },
]

export function PriceCard({ delay = 0, height = 280 }: { delay?: number; height?: number }) {
  const { candles, price, ticker, interval, setInterval } = useMarket()
  const signal = useSignal((s) => s.signal)
  const tf = TF.find((t) => t.iv === interval)
  const bars = tf?.bars ?? 120
  const points = useMemo(() => candles.slice(-bars).map((c) => ({ t: c.time, v: c.close })), [candles.length, candles[0]?.time, Math.round(price * 100), bars])
  const fc = useMemo(
    () => signal?.forecast.filter((_, i) => i % 2 === 0 || i === signal.forecast.length - 1).map((f) => ({ t: f.time, v: f.value, lo: f.lower, hi: f.upper })),
    [signal?.forecast.at(-1)?.value.toFixed(2), signal?.forecast.length],
  )
  const ch = ticker?.changePct ?? 0
  return (
    <Card delay={delay}>
      <div className="lab">Solana price</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <span className="big-num" style={{ fontSize: 32 }}>
          {price ? <AnimatedNumber value={price} format={(v) => `$${fmtPrice(v)}`} duration={0.4} /> : '—'}
        </span>
        <span style={{ color: ch >= 0 ? 'var(--long)' : 'var(--short)', fontWeight: 600 }}>
          {fmtSigned(ch)}% <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>24h</span>
        </span>
      </div>
      <div style={{ marginTop: 14 }}>
        {points.length > 2 ? <PriceLine points={points} forecast={fc} height={height} /> : <div className="skeleton" style={{ height }} />}
      </div>
      <div className="tf">
        {TF.map((t) => (
          <button key={t.label} className={interval === t.iv ? 'on' : ''} onClick={() => setInterval(t.iv)}>
            {t.label}
          </button>
        ))}
      </div>
    </Card>
  )
}

/* ───────────── insight strip ───────────── */

export function InsightStrip({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  if (!signal)
    return (
      <Card delay={delay}>
        <div className="skeleton" style={{ height: 90 }} />
      </Card>
    )
  const m = mood(signal.score)
  const plan = signal.plan
  const reasons = [...signal.factors].sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight)).slice(0, 3)
  return (
    <Card delay={delay}>
      <div className="insight">
        <div>
          <div className="lab">{plan ? 'Target price' : 'Expected price'}</div>
          <div className="v">${fmtPrice(plan ? plan.take : signal.forecast.at(-1)!.value)}</div>
        </div>
        <div>
          <div className="lab">Safety stop</div>
          <div className="v" style={plan ? undefined : { color: 'var(--ink-3)' }}>
            {plan ? `$${fmtPrice(plan.stop)}` : 'No trade'}
          </div>
        </div>
        <div>
          <div className="lab">Market mood</div>
          <div className="v" style={{ color: m.tone === 'up' ? 'var(--long)' : m.tone === 'down' ? 'var(--short)' : 'var(--ink)' }}>
            {m.word}
          </div>
        </div>
        <div className="why">
          <div className="lab" style={{ marginBottom: 6 }}>
            Why the AI thinks so
          </div>
          {reasons.map((f) => {
            const v = Math.max(-1, Math.min(1, f.value))
            return (
              <div key={f.key} className="reason">
                <span>{plainFactor(f)}</span>
                <div className="bar">
                  <motion.i
                    animate={{ width: `${Math.max(8, Math.abs(v) * 100)}%` }}
                    transition={{ duration: 0.9, ease: EASE }}
                    style={{ background: v >= 0 ? 'linear-gradient(90deg,rgba(20,241,149,.3),#14f195)' : 'linear-gradient(90deg,rgba(255,95,135,.3),#ff5f87)' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ───────────── open positions ───────────── */

export function PositionsCard({ delay = 0 }: { delay?: number }) {
  const price = useMarket((s) => s.price)
  const { positions, closePosition } = useTrading()
  if (!positions.length) return null
  return (
    <Card delay={delay} title="Open positions" right={<span className="lab">{positions.length} active</span>}>
      <AnimatePresence initial={false}>
        {positions.map((p) => {
          const pnl = upnl(p, price)
          return (
            <motion.div key={p.id} className="pos" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
              <div className={`ri ${p.side === 'long' ? 'up' : 'down'}`} style={{ width: 44, height: 44, borderRadius: 15, display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                {p.side === 'long' ? '↑' : '↓'}
              </div>
              <div>
                <div className="rt" style={{ fontWeight: 600 }}>
                  {p.side === 'long' ? 'Bought' : 'Sold'} {p.size.toFixed(2)} SOL{p.leverage > 1 ? ` · ${p.leverage}x boost` : ''}
                </div>
                <div className="rs" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  at ${fmtPrice(p.entry)} · {p.source === 'bot' ? 'AI bot' : p.source === 'copilot' ? 'AI copilot' : 'manual'}
                  {p.sl ? ` · stop $${fmtPrice(p.sl)}` : ''}
                  {p.tp ? ` · target $${fmtPrice(p.tp)}` : ''}
                </div>
              </div>
              <div className="ra" style={{ color: pnl >= 0 ? 'var(--long)' : 'var(--short)' }}>
                {pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toFixed(2)}
                <div>
                  <Sol usd={pnl} signed />
                </div>
              </div>
              <button className="btn-dark" style={{ padding: '10px 16px', fontSize: 13 }} onClick={() => closePosition(p.id, price)}>
                Close
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </Card>
  )
}

/* ───────────── sheets ───────────── */

const RISK = {
  low: { label: 'Careful', desc: 'Small positions, 1% of balance at risk per trade', riskPct: 1, leverage: 2 },
  mid: { label: 'Balanced', desc: '1.5% at risk per trade — the default', riskPct: 1.5, leverage: 3 },
  high: { label: 'Bold', desc: '3% at risk per trade, larger moves both ways', riskPct: 3, leverage: 5 },
}

export function Sheets() {
  const { sheet, setSheet } = useUI()
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <AnimatePresence>
      {sheet && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)}>
          <motion.div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {sheet === 'settings' ? <SettingsSheet /> : sheet === 'session' ? <SessionSheet /> : <TradeSheet side={sheet === 'buy' ? 'long' : 'short'} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TradeSheet({ side }: { side: Side }) {
  const setSheet = useUI((s) => s.setSheet)
  const price = useMarket((s) => s.price)
  const signal = useSignal((s) => s.signal)
  const { balance, openMarket } = useTrading()
  const [amt, setAmt] = useState('250')
  const [boost, setBoost] = useState(1)
  const [protect, setProtect] = useState(true)
  const a = Math.max(0, +amt || 0)
  const A = signal?.atr ?? price * 0.006
  const d = side === 'long' ? 1 : -1
  const sl = price - d * A * 1.6
  const tp = price + d * A * 2.8
  const size = price ? (a * boost) / price : 0
  const buy = side === 'long'
  const agrees = signal && ((buy && signal.direction === 'LONG') || (!buy && signal.direction === 'SHORT'))
  const ok = a >= 1 && a <= balance

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{buy ? 'Buy SOL' : 'Sell SOL'}</h3>
        <button className="btn-dark" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => setSheet(null)}>
          Close
        </button>
      </div>
      <p className="lab" style={{ marginTop: 6 }}>
        {buy ? 'You profit if the SOL price goes up.' : 'You profit if the SOL price goes down.'}
      </p>
      <div className="amount">
        <span>$</span>
        <input value={amt} style={{ width: `${Math.max(1, amt.length) * 0.78}em` }} inputMode="decimal" onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />
      </div>
      <div className="lab" style={{ textAlign: 'center' }}>
        ≈ {size.toFixed(3)} SOL{boost > 1 ? ` with ${boost}x boost` : ''} · available {fmtUsd(balance)} <Sol usd={balance} />
      </div>
      <div className="quick">
        {[100, 250, 500, 1000].map((v) => (
          <button key={v} className={a === v ? 'on' : ''} onClick={() => setAmt(String(v))}>
            ${v}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="lab" style={{ marginBottom: 8 }}>
          Boost (leverage)
        </div>
        <div className="quick" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
          {[1, 2, 5].map((b) => (
            <button key={b} className={boost === b ? 'on' : ''} onClick={() => setBoost(b)}>
              {b === 1 ? 'None' : `${b}x`}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="kv2" style={{ cursor: 'pointer' }} onClick={() => setProtect((p) => !p)}>
          <span>AI protection (auto stop & target)</span>
          <span style={{ color: protect ? 'var(--long)' : 'var(--ink-3)' }}>{protect ? 'On' : 'Off'}</span>
        </div>
        {protect && (
          <>
            <div className="kv2">
              <span>Safety stop</span>
              <span>${fmtPrice(sl)}</span>
            </div>
            <div className="kv2">
              <span>Target</span>
              <span>${fmtPrice(tp)}</span>
            </div>
          </>
        )}
        <div className="kv2">
          <span>AI opinion</span>
          <span style={{ color: agrees ? 'var(--long)' : 'var(--amber)' }}>{signal ? (agrees ? 'Agrees ✓' : signal.direction === 'NEUTRAL' ? 'Neutral' : 'Disagrees') : '—'}</span>
        </div>
      </div>
      <button
        className="btn-violet"
        style={{ width: '100%', marginTop: 22, background: buy ? 'var(--long)' : 'var(--short)', color: buy ? '#062016' : '#2a0612', boxShadow: 'none' }}
        disabled={!ok}
        onClick={() => {
          if (openMarket({ side, margin: a, leverage: boost, sl: protect ? sl : null, tp: protect ? tp : null }, price)) setSheet(null)
        }}
      >
        {buy ? `Buy $${a || 0} of SOL` : `Sell $${a || 0} of SOL`}
      </button>
    </>
  )
}

function SettingsSheet() {
  const setSheet = useUI((s) => s.setSheet)
  const bot = useBot()
  const reset = useTrading((s) => s.reset)
  const level = bot.riskPct <= 1 ? 'low' : bot.riskPct >= 3 ? 'high' : 'mid'
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>AI settings</h3>
        <button className="btn-dark" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => setSheet(null)}>
          Done
        </button>
      </div>
      <div className="lab" style={{ margin: '20px 0 10px' }}>
        Risk level
      </div>
      {(Object.keys(RISK) as (keyof typeof RISK)[]).map((k) => (
        <button key={k} className={`opt ${level === k ? 'on' : ''}`} onClick={() => bot.set({ riskPct: RISK[k].riskPct, leverage: RISK[k].leverage })}>
          <div>
            <div style={{ fontWeight: 600 }}>{RISK[k].label}</div>
            <div className="lab" style={{ fontSize: 12 }}>
              {RISK[k].desc}
            </div>
          </div>
          <span className="radio" />
        </button>
      ))}
      <div className="lab" style={{ margin: '20px 0 10px' }}>
        AI strategy
      </div>
      {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
        <button key={id} className={`opt ${bot.strategy === id ? 'on' : ''}`} onClick={() => bot.set({ strategy: id })}>
          <div>
            <div style={{ fontWeight: 600 }}>{STRATEGIES[id].name}</div>
            <div className="lab" style={{ fontSize: 12 }}>
              {STRATEGIES[id].desc}
            </div>
          </div>
          <span className="radio" />
        </button>
      ))}
      <button
        className="btn-dark"
        style={{ width: '100%', marginTop: 20 }}
        onClick={() => {
          setSheet(null)
          setTimeout(() => useUI.getState().setTutorialOpen(true), 300)
        }}
      >
        Show tutorial again
      </button>
      <button
        className="btn-dark"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => {
          if (confirm('Reset the demo balance to $10,000?')) reset()
        }}
      >
        Reset demo balance
      </button>
    </>
  )
}
