import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EXCHANGES } from '../data/exchanges'
import type { Interval } from '../data/types'
import { STRATEGIES, type StrategyId } from '../lib/ai'
import { money, pct, tone } from '../lib/money'
import { DUR, EASE, isIntro, SPRING } from '../lib/motion'
import { action, confidenceWord, headline, mood, plainFactor } from '../lib/plain'
import { useBot } from '../store/bot'
import { useCandles } from '../store/candles'
import { useMarket } from '../store/market'
import { sessionPlan, useSession } from '../store/session'
import { useSignal } from '../store/signal'
import { equityOf, START_BALANCE, upnl, useTrading, type Side } from '../store/trading'
import { toast, useUI, type Tab } from '../store/ui'
import { AnimatedNumber, Ticker } from './AnimatedNumber'
import { PriceLine } from './canvas'
import { Icon, type IconName } from './Icon'
import { SessionLive, Sol } from './Session'
import { MIN_REAL_USD, ModeSwitch, VenuePicker } from './Shell'
import { SolanaLogo } from './SolanaLogo'

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
  const intro = isIntro()
  return (
    <motion.section
      className={`card ${className}`}
      style={style}
      initial={intro ? { opacity: 0, y: 18, filter: 'blur(6px)' } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={intro ? { duration: 0.7, delay, ease: EASE.emphasized } : { duration: DUR.ui, ease: EASE.standard }}
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

/** Small (?) bubble that explains a term on hover / tap. */
export function Hint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [open])
  return (
    <span ref={ref} className="hint" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="hint-q" aria-label="What does this mean?" onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            className="hint-pop"
            role="tooltip"
            initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: DUR.ui, ease: EASE.standard }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export const TERMS = {
  confidence: 'How sure the AI is about its call, from 0 to 100%. Above 70% is high. It is never a guarantee.',
  target: 'The price where the AI takes profit automatically.',
  stop: 'The price where the AI exits automatically to limit a loss. It protects your balance if the market goes the other way.',
  expected: 'Where the AI expects SOL to be in 6 hours, based on its forecast.',
  sell: '“Sell” means a short position: you make money if the price goes down — you do not need to own SOL.',
  boost: 'Boost (leverage) multiplies the position size. 2x means a 1% price move becomes a 2% gain or loss on the money you put in.',
  session: 'A session lets the AI trade on its own for a fixed time. It ends automatically and shows you a report.',
  maxLoss: 'If the session loses this much, the AI stops trading immediately.',
  mood: 'A one-word summary of the AI score: from very cautious to very optimistic.',
}

/* ───────────── header & status ───────────── */

export function Header() {
  const { tab, setTab, setSheet } = useUI()
  return (
    <header className="fx-top">
      <div className="fx-logo">
        <SolanaLogo size={36} />
        Solana AI
        <span className="ver">BETA</span>
      </div>
      <nav className="fx-nav" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            {tab === t.id && <motion.div layoutId="fx-nav" className="pill" transition={SPRING} />}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="fx-right">
        <button className="icon-btn" aria-label="Help" onClick={() => setSheet('help')}>
          ?
        </button>
        <VenuePicker />
        <ModeSwitch />
      </div>
    </header>
  )
}

export function StatusBar() {
  const { price, ticker, source, status } = useMarket()
  const mode = useUI((s) => s.mode)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ch = ticker?.changePct ?? 0
  const offline = source === 'sim'
  const live = status === 'live'
  return (
    <div className="fx-status">
      <span className={`state ${offline ? 'warn' : live ? 'ok' : 'warn'}`}>
        <i />
        {offline ? 'Offline simulator · exchanges unreachable from your network' : live ? `Live · ${EXCHANGES[source].name}` : 'Connecting…'}
      </span>
      <span className="sep" />
      <span>
        SOL <Ticker className="num" value={price} format={(v) => money(v)} /> <b className={tone(ch)}>{pct(ch)}</b>
      </span>
      <span className="sep hide-sm" />
      <span className="hide-sm">
        24h volume <b>{ticker ? `$${(ticker.quoteVolume24h / 1e6).toFixed(1)}M` : '—'}</b>
      </span>
      <div className="right">
        {mode === 'real' && <span className="state real">Real mode · wallet required (min ${MIN_REAL_USD})</span>}
        <span>
          <b>{new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b>
        </span>
      </div>
    </div>
  )
}

export function MobileNav() {
  const { tab, setTab } = useUI()
  return (
    <nav className="fx-mnav" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
          {tab === t.id && <motion.div layoutId="fx-mnav" className="pill" transition={SPRING} />}
          <span>{t.id === 'how' ? 'How AI' : t.label}</span>
        </button>
      ))}
    </nav>
  )
}

export function Footer() {
  const setSheet = useUI((s) => s.setSheet)
  return (
    <footer className="fx-slim">
      <span>© {new Date().getFullYear()} Solana AI · Beta</span>
      <span className="links">
        <a onClick={() => setSheet('help')}>Help & glossary</a>
        <a onClick={() => useUI.getState().setTab('how')}>Methodology</a>
        <a onClick={() => useUI.getState().setTutorialOpen(true)}>Tutorial</a>
      </span>
      <span>Charts by TradingView Lightweight Charts™ · Trading involves risk. Not financial advice.</span>
    </footer>
  )
}

/* ───────────── helpers ───────────── */

export function useEquity() {
  const price = useMarket((s) => s.price)
  const t = useTrading()
  return equityOf(t, price)
}

export function useGuard() {
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

/* ───────────── HERO: signal + start ───────────── */

const DURATIONS = [1, 5, 10]

export function Hero({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const interval = useMarket((s) => s.interval)
  const mode = useUI((s) => s.mode)
  const session = useSession()
  const bot = useBot()
  const eq = useEquity()
  const guard = useGuard()
  const [minutes, setMinutes] = useState(1)
  const dir = signal?.direction ?? 'NEUTRAL'
  const running = mode === 'demo' && (!!session.active || bot.enabled)
  const plan = sessionPlan(minutes, eq, bot.riskPct)
  const segs = signal ? Math.max(1, Math.round(signal.confidence / 20)) : 0
  const sp = signal?.plan
  const inSession = !!session.active && mode === 'demo'
  const title = inSession ? 'AI is trading' : signal ? action(signal) : 'Reading the market…'

  // brief ring burst when the AI changes its mind
  const prevDir = useRef(dir)
  const [flip, setFlip] = useState(0)
  useEffect(() => {
    if (signal && prevDir.current !== dir) setFlip((f) => f + 1)
    prevDir.current = dir
  }, [dir, signal])

  return (
    <Card className={`hero sig-card ${inSession ? 'LONG' : dir}`} delay={delay}>
      <AnimatePresence>
        {flip > 0 && (
          <motion.span
            key={flip}
            className="flip-ring"
            initial={{ opacity: 0.6, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 1.1, ease: EASE.emphasized }}
          />
        )}
      </AnimatePresence>
      <div className="hero-grid">
        <div className="hero-main">
          <span className="pill-live">
            <span className="live-dot" style={{ background: '#fff' }} /> AI signal · updated every second
          </span>
          <AnimatePresence mode="wait">
            <motion.h1
              key={title}
              className="big-num sig-title"
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
              transition={{ duration: DUR.panel, ease: EASE.emphasized }}
            >
              {title}
            </motion.h1>
          </AnimatePresence>
          <p className="sig-text">
            {inSession
              ? `Your ${session.active!.minutes}-minute session is running. The AI opens and closes positions on its own, each with a safety stop — you can end it at any time.`
              : signal
                ? headline(signal, interval)
                : 'The AI is analysing live SOL data. This takes a few seconds.'}
          </p>
          {dir === 'SHORT' && !inSession && (
            <p className="sig-note">
              <Icon name="down" size={13} /> Sell = you profit if SOL goes down. You don’t need to own SOL.
            </p>
          )}
          {!inSession && (
          <div className="hero-metrics">
            <div>
              <span>
                Confidence <Hint>{TERMS.confidence}</Hint>
              </span>
              <b>{signal ? `${signal.confidence}%` : '—'}</b>
              <div className="meter">
                {Array.from({ length: 5 }, (_, i) => (
                  <i key={i} className={i < segs ? 'on' : ''} />
                ))}
              </div>
              <small>{signal ? confidenceWord(signal.confidence) : ''}</small>
            </div>
            <div>
              <span>
                {sp ? 'Target' : 'Expected in 6h'} <Hint>{sp ? TERMS.target : TERMS.expected}</Hint>
              </span>
              <b>{signal ? money(sp ? sp.take : signal.forecast.at(-1)!.value) : '—'}</b>
              <small>{signal ? pct(sp ? ((sp.take - sp.entry) / sp.entry) * 100 : signal.expectedPct) : ''}</small>
            </div>
            <div>
              <span>
                Safety stop <Hint>{TERMS.stop}</Hint>
              </span>
              <b>{sp ? money(sp.stop) : 'No trade'}</b>
              <small>{sp ? pct(((sp.stop - sp.entry) / sp.entry) * 100) : 'nothing to protect'}</small>
            </div>
          </div>
          )}
        </div>

        <div className="hero-side">
          <AnimatePresence mode="wait" initial={false}>
            {session.active && mode === 'demo' ? (
              <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DUR.panel, ease: EASE.standard }}>
                <SessionLive />
              </motion.div>
            ) : (
              <motion.div key="start" className="start-box" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DUR.panel, ease: EASE.standard }}>
                <div className="sb-h">
                  Let the AI trade for you <Hint>{TERMS.session}</Hint>
                </div>
                <div className="dur-row" role="radiogroup" aria-label="Session length">
                  {DURATIONS.map((m) => (
                    <button key={m} role="radio" aria-checked={minutes === m} className={minutes === m ? 'on' : ''} onClick={() => setMinutes(m)}>
                      {minutes === m && <motion.span layoutId="dur-pill" className="pill" transition={SPRING} />}
                      <span>{m} min</span>
                    </button>
                  ))}
                </div>
                <dl className="risk">
                  <div>
                    <dt>Uses up to</dt>
                    <dd>
                      {mode === 'demo' ? money(plan.uses, { d: 0 }) : '—'} <small>{plan.usesPct}% of balance</small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      Max loss <Hint>{TERMS.maxLoss}</Hint>
                    </dt>
                    <dd>{mode === 'demo' ? money(plan.maxLoss, { d: 0 }) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Est. fees</dt>
                    <dd>{mode === 'demo' ? `~${money(plan.fees)}` : '—'}</dd>
                  </div>
                </dl>
                {running ? (
                  <button className="btn-white stop" onClick={() => bot.toggle()}>
                    <i className="g-stop" style={{ width: 11, height: 11 }} /> Stop AI bot
                  </button>
                ) : (
                  <button className="btn-white" onClick={() => guard(() => session.start(minutes))}>
                    <i className="g-play sm" /> Start {minutes}-minute session
                  </button>
                )}
                <div className="sb-foot">{mode === 'demo' ? 'Demo money · stop any time' : `Requires a wallet with at least $${MIN_REAL_USD}`}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  )
}

/* ───────────── balance + actions + activity ───────────── */

export function BalanceCard({ delay = 0 }: { delay?: number }) {
  const mode = useUI((s) => s.mode)
  const setSheet = useUI((s) => s.setSheet)
  const setTab = useUI((s) => s.setTab)
  const setWalletOpen = useUI((s) => s.setWalletOpen)
  const eq = useEquity()
  const pnl = eq - START_BALANCE
  const guard = useGuard()
  const whole = Math.floor(eq)
  const cents = Math.round((eq - whole) * 100) % 100

  // glow when the balance changes noticeably after a trade
  const prev = useRef(eq)
  const [glow, setGlow] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    const d = eq - prev.current
    prev.current = eq
    if (Math.abs(d) > 5) {
      setGlow(d > 0 ? 'up' : 'down')
      const t = setTimeout(() => setGlow(null), 1200)
      return () => clearTimeout(t)
    }
  }, [Math.round(eq)])

  return (
    <Card delay={delay} className={glow ? `glow-${glow}` : ''}>
      <div className="lab">{mode === 'demo' ? 'Demo balance' : 'Wallet balance'}</div>
      {mode === 'demo' ? (
        <>
          <div className="big-num bal">
            <AnimatedNumber value={whole} format={(v) => `$${Math.round(v).toLocaleString('en-US')}`} duration={0.9} />
            <small>.{String(cents).padStart(2, '0')}</small>
          </div>
          <div className="bal-sub">
            <span className={`chip-${tone(pnl)}`}>
              {money(pnl, { sign: true })} · {pct((pnl / START_BALANCE) * 100)}
            </span>
            <Sol usd={eq} />
          </div>
        </>
      ) : (
        <>
          <div className="big-num bal" style={{ color: 'var(--ink-4)' }}>
            $—
          </div>
          <button className="btn-violet" style={{ marginTop: 14 }} onClick={() => setWalletOpen(true)}>
            Connect wallet
          </button>
        </>
      )}

      <div className="acts">
        <ActBtn icon="up" label="Buy" onClick={() => guard(() => setSheet('buy'))} />
        <ActBtn icon="down" label="Sell" onClick={() => guard(() => setSheet('sell'))} />
        <ActBtn icon="clock" label="History" onClick={() => setTab('activity')} />
        <ActBtn icon="dots" label="Settings" onClick={() => setSheet('settings')} />
      </div>

      <div className="sub-h">
        <span>Recent activity</span>
        <button className="link" onClick={() => setTab('activity')}>
          See all
        </button>
      </div>
      <ActivityRows limit={4} compact />
    </Card>
  )
}

function ActBtn({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="act" onClick={onClick}>
      <span className="ic">
        <Icon name={icon} size={18} />
      </span>
      {label}
    </button>
  )
}

interface Act {
  key: string
  tone: 'up' | 'down' | 'flat' | 'ai'
  glyph: IconName
  title: string
  sub: string
  amount?: number
  t: number
}

export function useActivity(): Act[] {
  const price = useMarket((s) => s.price)
  const { positions, history } = useTrading()
  const bot = useBot()
  const session = useSession((s) => s.active)
  return useMemo(() => {
    const src = (s: string) => (s === 'bot' ? 'AI' : s === 'copilot' ? 'AI copilot' : 'You')
    const time = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const boost = (l: number) => (l > 1 ? ` · ${l}x boost` : '')
    const items: Act[] = []
    for (const p of positions)
      items.push({
        key: 'p' + p.id,
        tone: 'ai',
        glyph: 'clock',
        title: `${p.side === 'long' ? 'Buy' : 'Sell'} position open`,
        sub: `${money(p.margin, { d: 0 })}${boost(p.leverage)} · ${src(p.source)} · ${time(p.openedAt)}`,
        amount: upnl(p, price),
        t: p.openedAt + 1e12,
      })
    for (const h of history.slice(0, 40))
      items.push({
        key: 'h' + h.id + h.closedAt,
        tone: h.pnl > 0.005 ? 'up' : h.pnl < -0.005 ? 'down' : 'flat',
        glyph: h.side === 'long' ? 'up' : 'down',
        title: `${h.side === 'long' ? 'Buy' : 'Sell'} · ${h.reason.toLowerCase()}`,
        sub: `${money((h.size * h.entry) / h.leverage, { d: 0 })}${boost(h.leverage)} · ${src(h.source)} · ${time(h.closedAt)}`,
        amount: h.pnl,
        t: h.closedAt,
      })
    if ((bot.enabled || session) && !positions.some((p) => p.source === 'bot'))
      items.push({ key: 'wait', tone: 'flat', glyph: 'dots', title: 'Waiting for a good entry', sub: 'The AI is watching the market', t: 2e12 })
    return items.sort((a, b) => b.t - a.t)
  }, [positions, history, bot.enabled, session, Math.round(price * 10)])
}

export function ActivityRows({ limit = 50, compact = false }: { limit?: number; compact?: boolean }) {
  const items = useActivity().slice(0, limit)
  if (!items.length)
    return (
      <div className={`empty-teach ${compact ? 'compact' : ''}`}>
        <div className="ri flat">
          <Icon name="spark" size={16} />
        </div>
        <div>
          <div className="rt">No trades yet</div>
          <div className="rs">Start a 1-minute AI session on the Home screen — your trades will appear here.</div>
        </div>
      </div>
    )
  return (
    <div className="rows">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((a) => (
          <motion.div
            key={a.key}
            className="row"
            layout
            initial={{ opacity: 0, x: -12, backgroundColor: 'rgba(124,92,255,0.16)' }}
            animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(124,92,255,0)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.story, ease: EASE.emphasized }}
          >
            <div className={`ri ${a.tone}`}>
              <Icon name={a.glyph} size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="rt">{a.title}</div>
              <div className="rs">{a.sub}</div>
            </div>
            {a.amount != null && (
              <div className={`ra ${tone(a.amount)}`}>
                {money(a.amount, { sign: true })}
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

/* ───────────── price card ───────────── */

const TF: { label: string; iv: Interval; bars: number; word: string }[] = [
  { label: '1H', iv: '1m', bars: 60, word: 'past hour' },
  { label: '1D', iv: '15m', bars: 96, word: 'past day' },
  { label: '1W', iv: '1h', bars: 168, word: 'past week' },
  { label: '1M', iv: '4h', bars: 180, word: 'past month' },
]

export function PriceCard({ delay = 0, height = 260 }: { delay?: number; height?: number }) {
  const { price, ticker } = useMarket()
  const signal = useSignal((s) => s.signal)
  const [tf, setTf] = useState(TF[1])
  const { candles, loading } = useCandles(tf.iv, tf.bars)
  const points = useMemo(() => candles.map((c) => ({ t: c.time, v: c.close })), [candles])
  const fc = useMemo(
    () => signal?.forecast.filter((_, i) => i % 2 === 0 || i === signal.forecast.length - 1).map((f) => ({ t: f.time, v: f.value, lo: f.lower, hi: f.upper })),
    [signal?.forecast.at(-1)?.value.toFixed(2), signal?.forecast.length],
  )
  const first = points[0]?.v
  const ch = first ? ((price - first) / first) * 100 : (ticker?.changePct ?? 0)
  return (
    <Card delay={delay}>
      <div className="price-h">
        <div>
          <div className="lab">Solana · SOL</div>
          <div className="big-num" style={{ fontSize: 34, marginTop: 6 }}>
            {price ? <Ticker value={price} format={(v) => money(v)} /> : '—'}
          </div>
          <span className={tone(ch)} style={{ fontWeight: 600, fontSize: 13.5 }}>
            {pct(ch)} <span className="muted-inline">{tf.word}</span>
          </span>
        </div>
        <div className="tf" role="tablist" aria-label="Chart period">
          {TF.map((t) => (
            <button key={t.label} role="tab" aria-selected={tf.label === t.label} className={tf.label === t.label ? 'on' : ''} onClick={() => setTf(t)}>
              {tf.label === t.label && <motion.span layoutId="tf-pill" className="pill" transition={SPRING} />}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 18, position: 'relative', height }}>
        <AnimatePresence mode="wait" initial={false}>
          {points.length > 2 && !loading ? (
            <motion.div key={'c' + tf.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.ui }}>
              <PriceLine points={points} forecast={fc} height={height} axis dataKey={tf.label} />
            </motion.div>
          ) : (
            <motion.div key="s" className="skeleton" style={{ height }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          )}
        </AnimatePresence>
      </div>
      <div className="px-stats">
        <div>
          <span>24h high</span>
          <b>{money(ticker?.high24h)}</b>
        </div>
        <div>
          <span>24h low</span>
          <b>{money(ticker?.low24h)}</b>
        </div>
        <div>
          <span>24h volume</span>
          <b>{ticker ? `$${(ticker.quoteVolume24h / 1e6).toFixed(1)}M` : '—'}</b>
        </div>
      </div>
    </Card>
  )
}

/* ───────────── why card ───────────── */

export function WhyCard({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const setTab = useUI((s) => s.setTab)
  const reasons = signal ? [...signal.factors].sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight)).slice(0, 5) : []
  const m = signal ? mood(signal.score) : null
  return (
    <Card
      delay={delay}
      title="Why the AI thinks so"
      right={
        <button className="link" onClick={() => setTab('how')}>
          How it works
        </button>
      }
    >
      {m && (
        <div className="mood">
          <span>
            Market mood <Hint>{TERMS.mood}</Hint>
          </span>
          <b className={m.tone}>{m.word}</b>
        </div>
      )}
      {!signal && <div className="skeleton" style={{ height: 180 }} />}
      {reasons.map((f) => {
        const v = Math.max(-1, Math.min(1, f.value))
        const t = tone(Math.abs(v) < 0.12 ? 0 : v)
        return (
          <div key={f.key} className="reason">
            <span className={`dot ${t}`} />
            <span className="rtxt">{plainFactor(f)}</span>
            <div className="bar">
              <motion.i animate={{ width: `${Math.max(6, Math.abs(v) * 100)}%` }} transition={{ duration: DUR.story, ease: EASE.emphasized }} className={t} />
            </div>
          </div>
        )
      })}
    </Card>
  )
}

/* ───────────── open positions ───────────── */

export function PositionsCard() {
  const price = useMarket((s) => s.price)
  const { positions, closePosition } = useTrading()
  return (
    <AnimatePresence initial={false}>
      {positions.length > 0 && (
        <motion.div
          key="pos"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: DUR.panel, ease: EASE.standard }}
          style={{ overflow: 'hidden' }}
        >
          <section className="card">
            <div className="card-h">
              <div className="card-t">Open positions</div>
              <span className="lab">{positions.length} active</span>
            </div>
            <AnimatePresence initial={false}>
              {positions.map((p) => {
                const pnl = upnl(p, price)
                return (
                  <motion.div key={p.id} className="pos" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
                    <div className={`ri ${p.side === 'long' ? 'up' : 'down'}`}>
                      <Icon name={p.side === 'long' ? 'up' : 'down'} size={16} />
                    </div>
                    <div>
                      <div className="rt">
                        {p.side === 'long' ? 'Buy' : 'Sell'} · {money(p.margin, { d: 0 })}
                        {p.leverage > 1 ? ` · ${p.leverage}x boost` : ''}
                      </div>
                      <div className="rs">
                        Entry {money(p.entry)}
                        {p.sl ? ` · stop ${money(p.sl)}` : ''}
                        {p.tp ? ` · target ${money(p.tp)}` : ''} · {p.source === 'bot' ? 'AI' : p.source === 'copilot' ? 'AI copilot' : 'You'}
                      </div>
                    </div>
                    <div className={`ra ${tone(pnl)}`}>
                      {money(pnl, { sign: true })}
                      <div>
                        <Sol usd={pnl} signed />
                      </div>
                    </div>
                    <button className="btn-dark sm" onClick={() => closePosition(p.id, price)}>
                      Close
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ───────────── sheets ───────────── */

const RISK = {
  low: { label: 'Careful', desc: 'Small positions · 1% of balance at risk per trade', riskPct: 1, leverage: 2 },
  mid: { label: 'Balanced', desc: '1.5% at risk per trade — recommended to start', riskPct: 1.5, leverage: 3 },
  high: { label: 'Bold', desc: '3% at risk per trade · bigger swings both ways', riskPct: 3, leverage: 5 },
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
            className={`sheet ${sheet === 'help' ? 'wide' : ''}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 30, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: DUR.panel, ease: EASE.emphasized }}
          >
            {sheet === 'settings' ? <SettingsSheet /> : sheet === 'help' ? <HelpSheet /> : sheet === 'session' ? <SessionPicker /> : <TradeSheet side={sheet === 'buy' ? 'long' : 'short'} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SheetHead({ title, sub }: { title: string; sub?: string }) {
  const setSheet = useUI((s) => s.setSheet)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{title}</h3>
        <button className="btn-dark sm" onClick={() => setSheet(null)}>
          Close
        </button>
      </div>
      {sub && (
        <p className="lab" style={{ marginTop: 6, fontSize: 14 }}>
          {sub}
        </p>
      )}
    </>
  )
}

function SessionPicker() {
  const setSheet = useUI((s) => s.setSheet)
  const start = useSession((s) => s.start)
  const bot = useBot()
  const eq = useEquity()
  const guard = useGuard()
  const [m, setM] = useState(1)
  const plan = sessionPlan(m, eq, bot.riskPct)
  return (
    <>
      <SheetHead title="Start AI session" sub="Choose how long the AI should trade for you. You’ll get a full report at the end." />
      <div className="dur-row big" style={{ marginTop: 20 }}>
        {DURATIONS.map((d) => (
          <button key={d} className={m === d ? 'on' : ''} onClick={() => setM(d)}>
            {m === d && <motion.span layoutId="dur-pill2" className="pill" transition={SPRING} />}
            <span>{d} min</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="kv2">
          <span>Uses up to</span>
          <span>{money(plan.uses, { d: 0 })}</span>
        </div>
        <div className="kv2">
          <span>Max loss</span>
          <span>{money(plan.maxLoss, { d: 0 })}</span>
        </div>
        <div className="kv2">
          <span>Estimated fees</span>
          <span>~{money(plan.fees)}</span>
        </div>
      </div>
      <button
        className="btn-violet"
        style={{ width: '100%', marginTop: 20 }}
        onClick={() =>
          guard(() => {
            start(m)
            setSheet(null)
          })
        }
      >
        Start {m}-minute session
      </button>
    </>
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
  const sDist = Math.max(A * 1.6, price * 0.006)
  const sl = price - d * sDist
  const tp = price + d * sDist * 1.75
  const size = price ? (a * boost) / price : 0
  const buy = side === 'long'
  const agrees = signal && ((buy && signal.direction === 'LONG') || (!buy && signal.direction === 'SHORT'))
  const ok = a >= 1 && a <= balance
  const lossAtStop = (sDist / price) * a * boost

  return (
    <>
      <SheetHead title={buy ? 'Buy SOL' : 'Sell SOL'} sub={buy ? 'You profit if the SOL price goes up.' : 'You profit if the SOL price goes down — no SOL needed.'} />
      <div className="amount">
        <span>$</span>
        <input value={amt} style={{ width: `${Math.max(1, amt.length) * 0.62}em` }} inputMode="decimal" aria-label="Amount in dollars" onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />
      </div>
      <div className="lab" style={{ textAlign: 'center' }}>
        ≈ {size.toFixed(3)} SOL · available {money(balance)}
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
          Boost <Hint>{TERMS.boost}</Hint>
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
        <div className="kv2 toggle-row" role="switch" aria-checked={protect} tabIndex={0} onClick={() => setProtect((p) => !p)} onKeyDown={(e) => e.key === 'Enter' && setProtect((p) => !p)}>
          <span>
            AI protection <Hint>{TERMS.stop}</Hint>
          </span>
          <span className={`switch ${protect ? 'on' : ''}`}>
            <i />
          </span>
        </div>
        {protect && (
          <>
            <div className="kv2">
              <span>Safety stop</span>
              <span>
                {money(sl)} <small className="dim">max loss {money(lossAtStop)}</small>
              </span>
            </div>
            <div className="kv2">
              <span>Target</span>
              <span>{money(tp)}</span>
            </div>
          </>
        )}
        <div className="kv2">
          <span>AI opinion</span>
          <span className={agrees ? 'up' : 'warn-t'}>{signal ? (agrees ? 'Agrees with this trade' : signal.direction === 'NEUTRAL' ? 'Would wait' : 'Disagrees') : '—'}</span>
        </div>
      </div>
      <button
        className={`btn-violet ${buy ? 'btn-go-long' : 'btn-go-short'}`}
        style={{ width: '100%', marginTop: 22 }}
        disabled={!ok}
        onClick={() => {
          if (openMarket({ side, margin: a, leverage: boost, sl: protect ? sl : null, tp: protect ? tp : null }, price)) setSheet(null)
        }}
      >
        {buy ? `Buy ${money(a, { d: 0 })} of SOL` : `Sell ${money(a, { d: 0 })} of SOL`}
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
      <SheetHead title="AI settings" />
      <div className="sub-h" style={{ marginTop: 20 }}>
        <span>Risk level</span>
      </div>
      {(Object.keys(RISK) as (keyof typeof RISK)[]).map((k) => (
        <button key={k} className={`opt ${level === k ? 'on' : ''}`} onClick={() => bot.set({ riskPct: RISK[k].riskPct, leverage: RISK[k].leverage })}>
          <div>
            <div className="ot">{RISK[k].label}</div>
            <div className="od">{RISK[k].desc}</div>
          </div>
          <span className="radio" />
        </button>
      ))}
      <div className="sub-h" style={{ marginTop: 20 }}>
        <span>AI strategy</span>
      </div>
      {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
        <button key={id} className={`opt ${bot.strategy === id ? 'on' : ''}`} onClick={() => bot.set({ strategy: id })}>
          <div>
            <div className="ot">{STRATEGIES[id].name}</div>
            <div className="od">{STRATEGIES[id].desc}</div>
          </div>
          <span className="radio" />
        </button>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 20 }}>
        <button
          className="btn-dark"
          onClick={() => {
            setSheet(null)
            setTimeout(() => useUI.getState().setTutorialOpen(true), 300)
          }}
        >
          Show tutorial
        </button>
        <button
          className="btn-dark"
          onClick={() => {
            if (confirm('Reset the demo balance to $10,000?')) reset()
          }}
        >
          Reset demo balance
        </button>
      </div>
    </>
  )
}

const GLOSSARY: [string, string][] = [
  ['AI signal', 'What the AI suggests right now: Buy SOL, Sell SOL or Wait.'],
  ['Confidence', TERMS.confidence],
  ['Target', TERMS.target],
  ['Safety stop', TERMS.stop],
  ['Sell (short)', TERMS.sell],
  ['Boost', TERMS.boost],
  ['Session', TERMS.session],
  ['Max loss', TERMS.maxLoss],
  ['Fees', 'Exchanges charge about 0.05% per trade. The AI only trades when the expected move is bigger than fees.'],
  ['Demo mode', 'Virtual money on live prices. Nothing you do here costs real money.'],
]

const FAQ: [string, string][] = [
  ['Is the AI always right?', 'No. It is a probability model — it wins some trades and loses others. The safety stop limits every loss.'],
  ['Where do prices come from?', 'Live data from Binance, Bybit or OKX. If they are blocked in your region, an offline simulator is used and the status bar says so.'],
  ['Can I lose more than I put in?', `No. The AI only uses the amount shown before a session, and Real mode needs a wallet with at least $${MIN_REAL_USD}.`],
  ['How do I stop the AI?', 'Press “End now” on the session panel at any time. Open positions are closed immediately.'],
]

function HelpSheet() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <>
      <SheetHead title="Help & glossary" sub="Every term on the site, in plain words." />
      <dl className="gloss">
        {GLOSSARY.map(([t, d]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <div className="sub-h" style={{ marginTop: 22 }}>
        <span>Questions</span>
      </div>
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`faq ${open === i ? 'on' : ''}`}>
          <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            {q}
            <Icon name="chevron" size={10} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: DUR.ui, ease: EASE.standard }}>
                {a}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      ))}
    </>
  )
}
