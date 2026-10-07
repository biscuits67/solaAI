import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { STRATEGIES } from '../lib/ai'
import { fmtPct, fmtPrice, fmtUsd } from '../lib/format'
import { useBot } from '../store/bot'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { equityOf, START_BALANCE, useTrading } from '../store/trading'
import { useUI } from '../store/ui'
import { AnimatedNumber } from './AnimatedNumber'
import { Gauge, Radar, Ring } from './canvas'
import { Panel } from './Glass'

const DIR_RU = { LONG: 'ЛОНГ', SHORT: 'ШОРТ', NEUTRAL: 'НЕЙТРАЛЬНО' }

export function SignalCard({ delay = 0, compact = false }: { delay?: number; compact?: boolean }) {
  const signal = useSignal((s) => s.signal)
  const interval = useMarket((s) => s.interval)
  if (!signal)
    return (
      <Panel title="AI-сигнал" k={interval} delay={delay}>
        <div className="skeleton" style={{ height: compact ? 200 : 260 }} />
      </Panel>
    )
  const col = signal.direction === 'LONG' ? 'var(--long)' : signal.direction === 'SHORT' ? 'var(--short)' : 'var(--amber)'
  return (
    <Panel title="AI-сигнал" k={interval} delay={delay} right={<span className="eyebrow">{signal.regime}</span>}>
      <Gauge value={signal.score} height={compact ? 150 : 190} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: compact ? 30 : 36, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, color: col, textShadow: `0 0 30px ${col}` }}>
            <AnimatedNumber value={signal.score} format={(v) => (v > 0 ? '+' : '') + v.toFixed(0)} />
          </div>
          <div className="eyebrow" style={{ marginTop: 6 }}>AI score</div>
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
            {DIR_RU[signal.direction]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
        <Ring value={signal.confidence / 100} size={52} color={signal.confidence > 65 ? '#2ff3b3' : signal.confidence > 45 ? '#ffbe55' : '#ff4f80'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Уверенность модели</div>
          <div className="dim" style={{ fontSize: 11.5 }}>согласие 9 экспертов · {signal.factors.filter((f) => Math.sign(f.value) === Math.sign(signal.score)).length}/9 за</div>
        </div>
      </div>
      {!compact && signal.plan && (
        <>
          <div className="divider" />
          <PlanBar entry={signal.plan.entry} stop={signal.plan.stop} take={signal.plan.take} />
        </>
      )}
    </Panel>
  )
}

/** Visual risk/reward bar: stop ← entry → take. */
export function PlanBar({ entry, stop, take }: { entry: number; stop: number; take: number }) {
  const lo = Math.min(stop, take)
  const hi = Math.max(stop, take)
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100
  const long = take > entry
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="eyebrow">План сделки</span>
        <span className="mono dim" style={{ fontSize: 11 }}>
          R:R 1:{(Math.abs(take - entry) / Math.abs(entry - stop)).toFixed(2)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${long ? pos(entry) : 100 - pos(entry)}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: long ? 'linear-gradient(90deg,#ff4f80,rgba(255,79,128,0.3))' : 'linear-gradient(90deg,#2ff3b3,rgba(47,243,179,0.3))', order: 0 }}
        />
        <div style={{ flex: 1, background: long ? 'linear-gradient(90deg,rgba(47,243,179,0.3),#2ff3b3)' : 'linear-gradient(90deg,rgba(255,79,128,0.3),#ff4f80)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5 }} className="mono">
        <span className={long ? 'down' : 'up'}>
          {long ? 'SL' : 'TP'} {fmtPrice(lo)}
        </span>
        <span>Вход {fmtPrice(entry)}</span>
        <span className={long ? 'up' : 'down'}>
          {long ? 'TP' : 'SL'} {fmtPrice(hi)}
        </span>
      </div>
    </div>
  )
}

export function FactorsPanel({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  return (
    <Panel title="Голоса экспертов" k="Ensemble" delay={delay}>
      {!signal && <div className="skeleton" style={{ height: 300 }} />}
      {signal?.factors.map((f, i) => {
        const v = Math.max(-1, Math.min(1, f.value))
        const w = Math.abs(v) * 50
        return (
          <motion.div key={f.key} className="factor" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + i * 0.04 }}>
            <div className="name">
              {f.label}
              <small title={f.detail}>{f.detail}</small>
            </div>
            <div className="meter">
              <div
                className="f"
                style={{
                  left: v >= 0 ? '50%' : `${50 - w}%`,
                  width: `${w}%`,
                  background: v >= 0 ? 'linear-gradient(90deg, rgba(47,243,179,0.3), #2ff3b3)' : 'linear-gradient(90deg, #ff4f80, rgba(255,79,128,0.3))',
                  boxShadow: `0 0 12px ${v >= 0 ? 'rgba(47,243,179,0.5)' : 'rgba(255,79,128,0.5)'}`,
                }}
              />
            </div>
            <div className={`val ${v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'dim'}`}>
              {v > 0 ? '+' : ''}
              {(v * 100).toFixed(0)}
            </div>
          </motion.div>
        )
      })}
    </Panel>
  )
}

export function RadarPanel({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const items = useMemo(
    () => signal?.factors.map((f) => ({ label: f.label, value: Math.round(f.value * 20) / 20 })) ?? [],
    [signal?.factors.map((f) => Math.round(f.value * 20)).join()],
  )
  return (
    <Panel title="Карта рынка" k="Radar" delay={delay}>
      {signal ? <Radar items={items} height={300} /> : <div className="skeleton" style={{ height: 300 }} />}
    </Panel>
  )
}

export function Commentary({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const key = signal ? `${signal.direction}${Math.round(signal.score / 20)}` : ''
  const full = useMemo(() => signal?.summary ?? [], [key])
  const [shown, setShown] = useState(0)
  const total = full.join('\n').length
  useEffect(() => {
    setShown(0)
    let i = 0
    const t = setInterval(() => {
      i += 2
      setShown(i)
      if (i >= total) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [key])
  let left = shown
  return (
    <Panel title="Комментарий модели" k="NLG" delay={delay} right={<span className="live-dot" />}>
      <div className="ai-text">
        {!signal && <div className="skeleton" style={{ height: 120 }} />}
        {full.map((line, i) => {
          const take = Math.max(0, Math.min(line.length, left))
          left -= line.length + 1
          if (take === 0 && i > 0) return null
          return (
            <p key={i}>
              {line.slice(0, take)}
              {take < line.length && <span className="caret" />}
            </p>
          )
        })}
      </div>
    </Panel>
  )
}

export function ForecastCard({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  const interval = useMarket((s) => s.interval)
  if (!signal) return <Panel title="Прогноз" delay={delay}><div className="skeleton" style={{ height: 120 }} /></Panel>
  const last = signal.forecast.at(-1)!
  const ch = ((last.value - signal.price) / signal.price) * 100
  return (
    <Panel title="Прогноз" k={`24 × ${interval}`} delay={delay}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div className="mono" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em' }}>
          <AnimatedNumber value={last.value} format={(v) => fmtPrice(v)} />
        </div>
        <span className={`mono ${ch >= 0 ? 'up' : 'down'}`}>{fmtPct(ch)}</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <ConeBar lower={last.lower} upper={last.upper} mid={last.value} now={signal.price} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        <Mini label="ATR" value={signal.atr.toFixed(3)} />
        <Mini label="Волат./бар" value={`${signal.volatility.toFixed(2)}%`} />
        <Mini label="RSI" value={signal.rsi.toFixed(1)} />
      </div>
    </Panel>
  )
}

function ConeBar({ lower, upper, mid, now }: { lower: number; upper: number; mid: number; now: number }) {
  const lo = Math.min(lower, now) * 0.999
  const hi = Math.max(upper, now) * 1.001
  const P = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div>
      <div style={{ position: 'relative', height: 30 }}>
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
        <motion.div
          animate={{ left: P(lower), width: `calc(${P(upper)} - ${P(lower)})` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', top: 12, height: 6, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,79,128,0.6), rgba(157,107,255,0.8), rgba(47,243,179,0.6))', boxShadow: '0 0 16px rgba(157,107,255,0.5)' }}
        />
        <motion.div animate={{ left: P(mid) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'absolute', top: 6, width: 2, height: 18, marginLeft: -1, background: '#fff', borderRadius: 2, boxShadow: '0 0 10px #fff' }} />
        <motion.div animate={{ left: P(now) }} style={{ position: 'absolute', top: 9, width: 12, height: 12, marginLeft: -6, borderRadius: '50%', border: '2px solid var(--amber)', background: 'var(--bg)' }} />
      </div>
      <div className="mono dim" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
        <span>{fmtPrice(lower)}</span>
        <span style={{ color: 'var(--amber)' }}>сейчас {fmtPrice(now)}</span>
        <span>{fmtPrice(upper)}</span>
      </div>
    </div>
  )
}

export function Mini({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
      <div className="eyebrow" style={{ fontSize: 9.5 }}>
        {label}
      </div>
      <div className={`mono ${cls}`} style={{ fontSize: 14, marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

export function LevelsCard({ delay = 0 }: { delay?: number }) {
  const signal = useSignal((s) => s.signal)
  if (!signal) return <Panel title="Уровни" delay={delay}><div className="skeleton" style={{ height: 160 }} /></Panel>
  const rows = [
    ...signal.resistance.map((l) => ({ ...l, kind: 'R' as const })).reverse(),
    { price: signal.price, touches: 0, kind: 'P' as const },
    ...signal.support.map((l) => ({ ...l, kind: 'S' as const })),
  ]
  return (
    <Panel title="Ключевые уровни" k="S/R" delay={delay}>
      {rows.map((r, i) => (
        <motion.div
          key={r.kind + i}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            marginBottom: 6,
            borderRadius: 12,
            background: r.kind === 'P' ? 'rgba(157,107,255,0.12)' : 'rgba(255,255,255,0.025)',
            border: `1px solid ${r.kind === 'P' ? 'rgba(157,107,255,0.4)' : 'var(--line)'}`,
          }}
        >
          <span className="mono" style={{ width: 22, fontSize: 11, color: r.kind === 'R' ? 'var(--short)' : r.kind === 'S' ? 'var(--long)' : 'var(--violet-2)' }}>
            {r.kind === 'P' ? '●' : r.kind}
          </span>
          <span className="mono" style={{ flex: 1 }}>
            {fmtPrice(r.price)}
          </span>
          <span className="dim mono" style={{ fontSize: 11 }}>
            {r.kind === 'P' ? 'цена' : `${fmtPct(((r.price - signal.price) / signal.price) * 100)} · ${r.touches}×`}
          </span>
        </motion.div>
      ))}
      {rows.length === 1 && <div className="dim" style={{ fontSize: 12 }}>Недостаточно истории для поиска уровней</div>}
    </Panel>
  )
}

/* ───────────── Copilot chat ───────────── */

interface Msg {
  role: 'user' | 'ai'
  text: string
}

const SUGGEST = ['Какой прогноз?', 'Купи на 300$ x5', 'Покажи уровни', 'Мой баланс', 'Включи автопилот', 'Закрой все']

export function Copilot({ delay = 0 }: { delay?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: 'Привет! Я AI-копилот Sola. Спросите про прогноз, уровни, риск — или дайте команду: «купи на 200$ x3», «шорт 1.5 sol», «закрой все».' },
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
    <Panel title="AI-копилот" k="Chat" delay={delay} right={<span className="live-dot" />}>
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
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Спросите или дайте команду…" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!text.trim() || typing}>
            Отправить
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

  const lev = +(s.match(/(?:x|х)\s?(\d{1,2})/)?.[1] ?? 1)
  const usd = s.match(/(\d+(?:\.\d+)?)\s?(?:\$|usdt|usd|долл|бакс)/)?.[1] ?? s.match(/на\s(\d+(?:\.\d+)?)/)?.[1]
  const sol = s.match(/(\d+(?:\.\d+)?)\s?(?:sol|сол)/)?.[1]
  const isBuy = has('купи', 'лонг', 'long', 'buy', 'покуп')
  const isSell = has('продай', 'шорт', 'short', 'sell')

  if ((isBuy || isSell) && !has('?')) {
    if (mode === 'real') return 'Вы в реальном режиме — подключите кошелёк, чтобы я мог отправлять ордера. В демо-режиме исполню сразу.'
    const L = Math.max(1, Math.min(20, lev))
    let margin = usd ? +usd : sol ? (+sol * price) / L : 0
    if (!margin) margin = Math.round(tr.balance * 0.05)
    const side = isBuy ? 'long' : 'short'
    const A = sig?.atr ?? price * 0.006
    const d = side === 'long' ? 1 : -1
    const p = tr.openMarket({ side, margin, leverage: L, sl: price - d * A * 1.6, tp: price + d * A * 2.8, source: 'copilot' }, price)
    if (!p) return 'Не удалось открыть позицию — не хватает средств на демо-счёте.'
    const agree = sig && ((side === 'long' && sig.direction === 'LONG') || (side === 'short' && sig.direction === 'SHORT'))
    return `Готово ✓ ${side === 'long' ? 'Лонг' : 'Шорт'} ${p.size.toFixed(3)} SOL по ${fmtPrice(price)} с плечом x${L}.\nSL ${fmtPrice(p.sl!)} · TP ${fmtPrice(p.tp!)} (по ATR).\n${
      sig ? (agree ? `Сделка совпадает с сигналом модели (score ${sig.score.toFixed(0)}).` : `Внимание: модель сейчас ${sig.direction === 'NEUTRAL' ? 'нейтральна' : 'против'} (score ${sig.score.toFixed(0)}).`) : ''
    }`
  }
  if (has('закрой', 'close', 'выйди')) {
    const n = tr.positions.length
    if (!n) return 'Открытых позиций нет.'
    tr.closeAll(price)
    return `Закрыл ${n} поз. по рынку ${fmtPrice(price)}.`
  }
  if (has('автопилот', 'бот', 'bot')) {
    const b = useBot.getState()
    if (has('включ', 'запус', 'старт') && !b.enabled) {
      b.toggle()
      return `Автопилот запущен: стратегия «${STRATEGIES[b.strategy].name}», риск ${b.riskPct}% на сделку, плечо x${b.leverage}. Логи — во вкладке «Автопилот».`
    }
    if (has('выключ', 'останов', 'стоп') && b.enabled) {
      b.toggle()
      return 'Автопилот остановлен. Открытые им позиции остались — можно закрыть вручную.'
    }
    return `Автопилот ${b.enabled ? 'работает' : 'выключен'} · стратегия «${STRATEGIES[b.strategy].name}».`
  }
  if (!sig) return 'Модель ещё загружает историю свечей, попробуйте через пару секунд.'
  if (has('уров', 'поддерж', 'сопрот', 'level'))
    return `Сопротивления: ${sig.resistance.map((l) => fmtPrice(l.price)).join(', ') || '—'}\nПоддержки: ${sig.support.map((l) => fmtPrice(l.price)).join(', ') || '—'}\nЦена сейчас ${fmtPrice(price)}.`
  if (has('баланс', 'портф', 'счёт', 'счет', 'pnl')) {
    const eq = equityOf(tr, price)
    return `Капитал: ${fmtUsd(eq)} (${fmtPct(((eq - START_BALANCE) / START_BALANCE) * 100)})\nСвободно: ${fmtUsd(tr.balance)}\nПозиций: ${tr.positions.length}, сделок в истории: ${tr.history.length}.`
  }
  if (has('риск', 'стоп', 'план', 'вход'))
    return sig.plan
      ? `План (${sig.direction}): вход ${fmtPrice(sig.plan.entry)}, стоп ${fmtPrice(sig.plan.stop)}, тейк ${fmtPrice(sig.plan.take)}. R:R 1:${sig.plan.rr.toFixed(2)}. Рекомендую рисковать не более 1–2% капитала.`
      : 'Сейчас явного сетапа нет — модель нейтральна. Лучше подождать пробоя уровней.'
  if (has('rsi', 'macd', 'индикат', 'эксперт', 'почему'))
    return sig.factors.map((f) => `${f.label}: ${f.value > 0 ? '+' : ''}${(f.value * 100).toFixed(0)} — ${f.detail}`).join('\n')
  if (has('прогноз', 'куда', 'сигнал', 'анализ', 'что думаешь', 'вырастет', 'упадёт', 'упадет'))
    return sig.summary.join('\n')
  if (has('привет', 'hello', 'hi')) return 'Привет! Чем помочь? Могу дать прогноз, найти уровни или открыть демо-сделку.'
  return 'Я понимаю команды: «прогноз», «уровни», «риск», «почему», «баланс», «купи на 200$ x3», «шорт 2 sol x5», «закрой все», «включи автопилот».'
}
