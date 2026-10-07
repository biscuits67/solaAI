import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { STRATEGIES, type StrategyId } from '../lib/ai'
import { fmtDuration, fmtPct, fmtPrice, fmtSigned, fmtTime, fmtUsd } from '../lib/format'
import { useBot } from '../store/bot'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { PIPELINE, useThoughts, type Stage } from '../store/thoughts'
import { equityOf, START_BALANCE, upnl, useTrading } from '../store/trading'
import { toast, useUI } from '../store/ui'
import { AnimatedNumber } from './AnimatedNumber'
import { Gauge, NeuralCore, Ring, Spark } from './canvas'
import { Power, Range } from './Controls'
import { Panel } from './Glass'
import { MIN_REAL_USD } from './Shell'

const DIR = { LONG: 'LONG', SHORT: 'SHORT', NEUTRAL: 'HOLD' }

const STAGE_LABEL: Record<Stage, string> = {
  DATA: 'Market data',
  EXPERT: '9 experts',
  ENSEMBLE: 'Ensemble',
  FORECAST: 'Forecast',
  DECISION: 'Decision',
  BOT: 'Bot',
  EXECUTE: 'Execution',
}

/* ───────────── Pipeline strip ───────────── */

export function Pipeline() {
  const stage = useThoughts((s) => s.stage)
  const cycle = useThoughts((s) => s.cycle)
  const idx = PIPELINE.indexOf(stage)
  return (
    <div className="pipeline">
      {PIPELINE.map((st, i) => (
        <div key={st} className={`pl-step ${i < idx ? 'done' : ''} ${i === idx ? 'on' : ''}`}>
          <div className="pl-node">
            {i === idx && <motion.span layoutId="pl-glow" className="pl-glow" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
            <span className="pl-n">{i + 1}</span>
          </div>
          <span className="pl-label">{STAGE_LABEL[st]}</span>
          {i < PIPELINE.length - 1 && (
            <div className="pl-bar">
              <motion.div className="pl-fill" animate={{ width: i < idx ? '100%' : '0%' }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          )}
        </div>
      ))}
      <span className="pl-cycle mono">cycle #{cycle}</span>
    </div>
  )
}

/* ───────────── Neural core panel ───────────── */

export function NeuralPanel({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const inputs = useMemo(
    () => signal?.factors.map((f) => ({ label: f.label, value: Math.round(f.value * 50) / 50 })) ?? [],
    [signal?.factors.map((f) => Math.round(f.value * 50)).join()],
  )
  const score = Math.round(signal?.score ?? 0)
  return (
    <Panel
      delay={delay}
      className="neural-panel"
      title={
        <>
          <span className="pulse-dot" /> Live AI reasoning
        </>
      }
      k="9 → 5 → 1"
      right={<Pipeline />}
    >
      {signal ? (
        <NeuralCore inputs={inputs} score={score} label={DIR[signal.direction]} height={400} />
      ) : (
        <div className="boot">
          <div className="orb lg" />
          <div className="eyebrow">Booting neural engine…</div>
        </div>
      )}
    </Panel>
  )
}

/* ───────────── Signal card ───────────── */

export function SignalCard({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const interval = useMarket((s) => s.interval)
  if (!signal)
    return (
      <Panel title="AI signal" k={interval} delay={delay}>
        <div className="skeleton" style={{ height: 380 }} />
      </Panel>
    )
  const col = signal.direction === 'LONG' ? 'var(--long)' : signal.direction === 'SHORT' ? 'var(--short)' : 'var(--amber)'
  const agree = signal.factors.filter((f) => Math.sign(f.value) === Math.sign(signal.score)).length
  return (
    <Panel title="AI signal" k={interval} delay={delay} right={<span className="eyebrow">{signal.regime}</span>}>
      <Gauge value={signal.score} height={170} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, color: col, textShadow: `0 0 30px ${col}` }}>
            <AnimatedNumber value={signal.score} format={(v) => (v > 0 ? '+' : '') + v.toFixed(0)} />
          </div>
          <div className="eyebrow" style={{ marginTop: 6 }}>
            AI score
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={signal.direction}
            className={`signal-badge ${signal.direction}`}
            initial={{ opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <i />
            {DIR[signal.direction]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="conf-row">
        <Ring value={signal.confidence / 100} size={52} color={signal.confidence > 65 ? '#2ff3b3' : signal.confidence > 45 ? '#ffbe55' : '#ff4f80'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Model confidence</div>
          <div className="dim" style={{ fontSize: 11.5 }}>
            {agree}/9 experts agree with the direction
          </div>
        </div>
      </div>
      {signal.plan ? (
        <div style={{ marginTop: 16 }}>
          <PlanBar entry={signal.plan.entry} stop={signal.plan.stop} take={signal.plan.take} />
        </div>
      ) : (
        <div className="dim" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
          No trade plan — the model waits until |score| is above 18 before proposing an entry.
        </div>
      )}
    </Panel>
  )
}

export function PlanBar({ entry, stop, take }: { entry: number; stop: number; take: number }) {
  const lo = Math.min(stop, take)
  const hi = Math.max(stop, take)
  const pos = ((entry - lo) / (hi - lo)) * 100
  const long = take > entry
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="eyebrow">AI trade plan</span>
        <span className="mono dim" style={{ fontSize: 11 }}>
          R:R 1:{(Math.abs(take - entry) / Math.abs(entry - stop)).toFixed(2)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pos}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: long ? 'linear-gradient(90deg,#ff4f80,rgba(255,79,128,0.3))' : 'linear-gradient(90deg,#2ff3b3,rgba(47,243,179,0.3))' }}
        />
        <div style={{ flex: 1, background: long ? 'linear-gradient(90deg,rgba(47,243,179,0.3),#2ff3b3)' : 'linear-gradient(90deg,rgba(255,79,128,0.3),#ff4f80)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5 }} className="mono">
        <span className={long ? 'down' : 'up'}>
          {long ? 'SL' : 'TP'} {fmtPrice(lo)}
        </span>
        <span>Entry {fmtPrice(entry)}</span>
        <span className={long ? 'up' : 'down'}>
          {long ? 'TP' : 'SL'} {fmtPrice(hi)}
        </span>
      </div>
    </div>
  )
}

/* ───────────── Thinking feed ───────────── */

export function ThinkingFeed({ delay = 0 }: { delay?: number }) {
  const items = useThoughts((s) => s.items)
  return (
    <Panel title="AI thought stream" k="live" delay={delay} className="feed-panel" right={<span className="live-dot" />}>
      <div className="feed">
        {!items.length && <div className="dim" style={{ fontSize: 12.5 }}>Waiting for the first analysis cycle…</div>}
        <AnimatePresence initial={false}>
          {items.slice(0, 18).map((it, i) => (
            <motion.div
              key={it.id}
              layout
              className={`thought ${it.tone} ${it.stage === 'EXECUTE' ? 'exec' : ''}`}
              initial={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
              animate={{ opacity: Math.max(0.25, 1 - i * 0.05), y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="th-meta">
                <span className={`th-stage s-${it.stage}`}>{STAGE_LABEL[it.stage]}</span>
                <time>{fmtTime(it.t)}</time>
              </div>
              <div className="th-text">
                {i === 0 ? <Typed text={it.text} /> : it.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Panel>
  )
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    let i = 0
    const t = setInterval(() => {
      i += 3
      setN(i)
      if (i >= text.length) clearInterval(t)
    }, 14)
    return () => clearInterval(t)
  }, [text])
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="caret" />}
    </>
  )
}

/* ───────────── Forecast ───────────── */

export function ForecastCard({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const interval = useMarket((s) => s.interval)
  if (!signal)
    return (
      <Panel title="AI forecast" delay={delay}>
        <div className="skeleton" style={{ height: 150 }} />
      </Panel>
    )
  const last = signal.forecast.at(-1)!
  const ch = ((last.value - signal.price) / signal.price) * 100
  const lo = Math.min(last.lower, signal.price) * 0.999
  const hi = Math.max(last.upper, signal.price) * 1.001
  const P = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <Panel title="AI forecast" k={`24 × ${interval}`} delay={delay}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div className="mono" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em' }}>
          <AnimatedNumber value={last.value} format={(v) => fmtPrice(v)} />
        </div>
        <span className={`mono ${ch >= 0 ? 'up' : 'down'}`}>{fmtPct(ch)}</span>
      </div>
      <div style={{ position: 'relative', height: 30, marginTop: 14 }}>
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
        <motion.div
          animate={{ left: P(last.lower), width: `calc(${P(last.upper)} - ${P(last.lower)})` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', top: 12, height: 6, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,79,128,0.6), rgba(157,107,255,0.8), rgba(47,243,179,0.6))', boxShadow: '0 0 16px rgba(157,107,255,0.5)' }}
        />
        <motion.div animate={{ left: P(last.value) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'absolute', top: 6, width: 2, height: 18, marginLeft: -1, background: '#fff', borderRadius: 2, boxShadow: '0 0 10px #fff' }} />
        <motion.div animate={{ left: P(signal.price) }} style={{ position: 'absolute', top: 9, width: 12, height: 12, marginLeft: -6, borderRadius: '50%', border: '2px solid var(--amber)', background: 'var(--bg)' }} />
      </div>
      <div className="mono dim" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
        <span>{fmtPrice(last.lower)}</span>
        <span style={{ color: 'var(--amber)' }}>now {fmtPrice(signal.price)}</span>
        <span>{fmtPrice(last.upper)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
        <Mini label="ATR" value={signal.atr.toFixed(3)} />
        <Mini label="Vol / bar" value={`${signal.volatility.toFixed(2)}%`} />
        <Mini label="RSI" value={signal.rsi.toFixed(1)} />
      </div>
    </Panel>
  )
}

export function Mini({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="mini">
      <div className="eyebrow" style={{ fontSize: 9.5 }}>
        {label}
      </div>
      <div className={`mono ${cls}`} style={{ fontSize: 14, marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

/* ───────────── AI bot control ───────────── */

export function BotControl({ delay = 0 }: { delay?: number }) {
  const bot = useBot()
  const { mode, setWalletOpen } = useUI()
  const price = useMarket((s) => s.price)
  const { history, positions } = useTrading()
  const trades = history.filter((h) => h.source === 'bot')
  const open = positions.filter((p) => p.source === 'bot')
  const pnl = trades.reduce((s, t) => s + t.pnl, 0) + open.reduce((s, p) => s + upnl(p, price), 0)
  const wins = trades.filter((t) => t.pnl > 0).length
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <Panel
      delay={delay}
      className={`bot-panel ${bot.enabled ? 'running' : ''}`}
      title="AI trading bot"
      k={mode === 'demo' ? 'DEMO' : 'REAL'}
      right={
        <Power
          on={bot.enabled && mode === 'demo'}
          onClick={() => (mode === 'real' ? toast('Connect a wallet first', `Minimum balance $${MIN_REAL_USD}`, 'error') : bot.toggle())}
        />
      }
    >
      <div className="bot-status">
        <span className={`bs-dot ${bot.enabled ? 'on' : ''}`} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{bot.enabled ? 'Trading autonomously' : 'Bot is idle'}</div>
          <div className="dim" style={{ fontSize: 11.5 }}>
            {bot.enabled ? `running for ${fmtDuration(Date.now() - (bot.startedAt ?? Date.now()))} · ${STRATEGIES[bot.strategy].name}` : 'Turn it on and the AI opens & manages trades itself'}
          </div>
        </div>
      </div>

      <div className="strat-row">
        {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
          <button key={id} className={`strat-chip ${bot.strategy === id ? 'on' : ''}`} style={{ ['--h' as any]: STRATEGIES[id].hue }} onClick={() => bot.set({ strategy: id })} title={STRATEGIES[id].desc}>
            <i />
            {STRATEGIES[id].name}
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>
          <span>Risk per trade</span>
          <span className="mono" style={{ color: 'var(--ink)' }}>
            {bot.riskPct}% · x{bot.leverage}
          </span>
        </label>
        <Range value={bot.riskPct} min={0.5} max={5} step={0.5} onChange={(v) => bot.set({ riskPct: v })} />
      </div>
      <div className="field" style={{ marginTop: 6 }}>
        <label>
          <span>Entry threshold</span>
          <span className="mono" style={{ color: 'var(--ink)' }}>
            |score| ≥ {bot.threshold}
          </span>
        </label>
        <Range value={bot.threshold} min={15} max={70} step={5} onChange={(v) => bot.set({ threshold: v })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
        <Mini label="Bot PnL" value={`${fmtSigned(pnl)}$`} cls={pnl >= 0 ? 'up' : 'down'} />
        <Mini label="Trades" value={`${trades.length}${open.length ? ` +${open.length}` : ''}`} />
        <Mini label="Win rate" value={trades.length ? `${((wins / trades.length) * 100).toFixed(0)}%` : '—'} />
      </div>

      {mode === 'real' && (
        <div className="locked">
          <div className="orb" style={{ width: 50, height: 50 }} />
          <div className="display" style={{ fontSize: 15, fontWeight: 500 }}>
            Wallet required
          </div>
          <div className="muted" style={{ fontSize: 12.5, maxWidth: 260 }}>
            In Real mode the AI bot trades only with wallets holding at least <b style={{ color: 'var(--ink)' }}>${MIN_REAL_USD}</b>.
          </div>
          <button className="btn btn-primary" onClick={() => setWalletOpen(true)}>
            Connect wallet
          </button>
        </div>
      )}
    </Panel>
  )
}

/* ───────────── Equity mini ───────────── */

export function EquityCard({ delay = 0 }: { delay?: number }) {
  const price = useMarket((s) => s.price)
  const t = useTrading()
  const eq = equityOf(t, price)
  const pnl = eq - START_BALANCE
  const data = useMemo(() => [...t.equityCurve.map((p) => p.v).slice(-120), eq], [t.equityCurve.length, Math.round(eq)])
  return (
    <Panel title="Demo equity" k="USDT" delay={delay}>
      <div className="mono" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em' }}>
        <AnimatedNumber value={eq} format={(v) => fmtUsd(v)} />
      </div>
      <div className={`mono ${pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 12.5, marginTop: 2 }}>
        {fmtSigned(pnl)} $ · {fmtPct((pnl / START_BALANCE) * 100)}
      </div>
      <div style={{ marginTop: 12 }}>
        <Spark data={data.length > 1 ? data : [START_BALANCE, eq]} height={70} baseline={START_BALANCE} />
      </div>
    </Panel>
  )
}

/* ───────────── Copilot chat ───────────── */

interface Msg {
  role: 'user' | 'ai'
  text: string
}

const SUGGEST = ['What is your forecast?', 'Why?', 'Buy $300 x5', 'Key levels', 'Start the bot', 'Close all']

export function Copilot({ delay = 0 }: { delay?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: 'Hi! I’m the Solana AI copilot. Ask me for a forecast, levels or risk — or give a command: “buy $200 x3”, “short 1.5 sol”, “close all”.' },
  ])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroll.current?.scrollTo({ top: 1e6, behavior: 'smooth' })
  }, [msgs, typing])

  const send = (t: string) => {
    const q = t.trim()
    if (!q || typing) return
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setText('')
    setTyping(true)
    setTimeout(() => {
      setMsgs((m) => [...m, { role: 'ai', text: answer(q) }])
      setTyping(false)
    }, 550 + Math.random() * 500)
  }

  return (
    <Panel title="AI copilot" k="chat" delay={delay} right={<span className="live-dot" />}>
      <div className="chat">
        <div className="chat-scroll" ref={scroll}>
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} className={`msg ${m.role}`} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
                {m.text}
              </motion.div>
            ))}
            {typing && (
              <motion.div className="msg ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="chip-row" style={{ margin: '8px 0' }}>
          {SUGGEST.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault()
            send(text)
          }}
        >
          <div className="input">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or give a command…" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!text.trim() || typing}>
            Send
          </button>
        </form>
      </div>
    </Panel>
  )
}

function answer(q: string): string {
  const s = q.toLowerCase().replace(',', '.')
  const sig = useSignal.getState().signal
  const { price } = useMarket.getState()
  const tr = useTrading.getState()
  const mode = useUI.getState().mode
  const has = (...w: string[]) => w.some((x) => s.includes(x))

  const lev = +(s.match(/x\s?(\d{1,2})/)?.[1] ?? 1)
  const usd = s.match(/\$\s?(\d+(?:\.\d+)?)/)?.[1] ?? s.match(/(\d+(?:\.\d+)?)\s?(?:\$|usdt|usd|dollars?)/)?.[1]
  const sol = s.match(/(\d+(?:\.\d+)?)\s?sol/)?.[1]
  const isBuy = has('buy', 'long')
  const isSell = has('sell', 'short')

  if ((isBuy || isSell) && !s.includes('?')) {
    if (mode === 'real') return `You are in Real mode — connect a wallet (min. $${MIN_REAL_USD}) and I can place orders. In Demo mode I execute instantly.`
    const L = Math.max(1, Math.min(20, lev))
    let margin = usd ? +usd : sol ? (+sol * price) / L : 0
    if (!margin) margin = Math.round(tr.balance * 0.05)
    const side = isBuy ? 'long' : 'short'
    const A = sig?.atr ?? price * 0.006
    const d = side === 'long' ? 1 : -1
    const p = tr.openMarket({ side, margin, leverage: L, sl: price - d * A * 1.6, tp: price + d * A * 2.8, source: 'copilot' }, price)
    if (!p) return 'Could not open the position — not enough demo balance.'
    const agree = sig && ((side === 'long' && sig.direction === 'LONG') || (side === 'short' && sig.direction === 'SHORT'))
    return `Done ✓ ${side === 'long' ? 'Long' : 'Short'} ${p.size.toFixed(3)} SOL at ${fmtPrice(price)}, leverage x${L}.\nSL ${fmtPrice(p.sl!)} · TP ${fmtPrice(p.tp!)} (ATR-based).\n${
      sig ? (agree ? `This matches the model's signal (score ${sig.score.toFixed(0)}).` : `Heads up: the model is currently ${sig.direction === 'NEUTRAL' ? 'neutral' : 'against this trade'} (score ${sig.score.toFixed(0)}).`) : ''
    }`
  }
  if (has('close', 'exit')) {
    const n = tr.positions.length
    if (!n) return 'There are no open positions.'
    tr.closeAll(price)
    return `Closed ${n} position(s) at market ${fmtPrice(price)}.`
  }
  if (has('bot', 'autopilot')) {
    const b = useBot.getState()
    if (has('start', 'run', 'enable', 'turn on') && !b.enabled) {
      if (mode === 'real') return `The bot needs a connected wallet with at least $${MIN_REAL_USD} in Real mode.`
      b.toggle()
      return `AI bot started: “${STRATEGIES[b.strategy].name}”, ${b.riskPct}% risk per trade, x${b.leverage} leverage. Watch its decisions in the thought stream.`
    }
    if (has('stop', 'disable', 'turn off') && b.enabled) {
      b.toggle()
      return 'AI bot stopped. Positions it opened stay open — you can close them manually.'
    }
    return `The AI bot is ${b.enabled ? 'running' : 'off'} · strategy “${STRATEGIES[b.strategy].name}”.`
  }
  if (!sig) return 'The model is still loading candle history — try again in a couple of seconds.'
  if (has('level', 'support', 'resistance'))
    return `Resistance: ${sig.resistance.map((l) => fmtPrice(l.price)).join(', ') || '—'}\nSupport: ${sig.support.map((l) => fmtPrice(l.price)).join(', ') || '—'}\nPrice now ${fmtPrice(price)}.`
  if (has('balance', 'portfolio', 'equity', 'pnl')) {
    const eq = equityOf(tr, price)
    return `Equity: ${fmtUsd(eq)} (${fmtPct(((eq - START_BALANCE) / START_BALANCE) * 100)})\nFree: ${fmtUsd(tr.balance)}\nOpen positions: ${tr.positions.length}, closed trades: ${tr.history.length}.`
  }
  if (has('risk', 'stop', 'plan', 'entry'))
    return sig.plan
      ? `Plan (${sig.direction}): entry ${fmtPrice(sig.plan.entry)}, stop ${fmtPrice(sig.plan.stop)}, target ${fmtPrice(sig.plan.take)}. R:R 1:${sig.plan.rr.toFixed(2)}. Risk no more than 1–2% of equity per trade.`
      : 'No clear setup right now — the model is neutral. Better to wait for a breakout.'
  if (has('why', 'rsi', 'macd', 'indicator', 'expert'))
    return sig.factors.map((f) => `${f.label}: ${f.value > 0 ? '+' : ''}${(f.value * 100).toFixed(0)} — ${f.detail}`).join('\n')
  if (has('forecast', 'predict', 'signal', 'analys', 'think', 'where', 'go up', 'go down'))
    return sig.summary.join('\n')
  if (has('hello', 'hi', 'hey')) return 'Hi! How can I help? I can forecast, find levels or open a demo trade.'
  return 'Try: “forecast”, “why”, “levels”, “risk”, “balance”, “buy $200 x3”, “short 2 sol x5”, “close all”, “start the bot”.'
}
