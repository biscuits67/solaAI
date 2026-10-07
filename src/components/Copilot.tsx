import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { STRATEGIES } from '../lib/ai'
import { fmtPct, fmtPrice, fmtUsd } from '../lib/format'
import { useBot } from '../store/bot'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { equityOf, START_BALANCE, useTrading } from '../store/trading'
import { useUI } from '../store/ui'
import { Card } from './Fintech'
import { MIN_REAL_USD } from './Shell'

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
    <Card title="AI copilot" delay={delay} right={<span className="lab">ask anything</span>}>
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
    </Card>
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
