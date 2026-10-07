import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { fmtUsd } from '../lib/format'
import { useMarket } from '../store/market'
import { sessionPnl, useSession } from '../store/session'
import { useUI } from '../store/ui'
import { AnimatedNumber } from './AnimatedNumber'
import { PriceLine, useCanvas } from './canvas'
import { SolanaLogo } from './SolanaLogo'

const EASE = [0.22, 1, 0.36, 1] as const

/** Small "≈ 1.23 SOL" hint shown next to dollar amounts. */
export function Sol({ usd, signed = false, className = '' }: { usd: number; signed?: boolean; className?: string }) {
  const price = useMarket((s) => s.price)
  if (!price || !isFinite(usd)) return null
  const v = usd / price
  const a = Math.abs(v)
  const txt = a >= 100 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a.toFixed(3)
  return (
    <span className={`sol-hint ${className}`}>
      ≈ {signed ? (v >= 0 ? '+' : '−') : ''}
      {txt} SOL
    </span>
  )
}

const OPTIONS = [
  { min: 1, title: '1 minute', desc: 'A quick burst — the AI trades aggressively on short-term moves.', tag: 'Fast' },
  { min: 5, title: '5 minutes', desc: 'Balanced session with a few well-chosen trades.', tag: 'Popular' },
  { min: 10, title: '10 minutes', desc: 'More time for the AI to wait for strong setups.', tag: 'Patient' },
]

export function SessionSheet() {
  const setSheet = useUI((s) => s.setSheet)
  const start = useSession((s) => s.start)
  const [pick, setPick] = useState(1)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Start AI session</h3>
        <button className="btn-dark" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => setSheet(null)}>
          Close
        </button>
      </div>
      <p className="lab" style={{ marginTop: 6 }}>
        Choose how long the AI should trade for you. You’ll get a full report at the end.
      </p>
      <div style={{ marginTop: 20 }}>
        {OPTIONS.map((o) => (
          <button key={o.min} className={`opt ${pick === o.min ? 'on' : ''}`} onClick={() => setPick(o.min)}>
            <div className="dur">
              <b>{o.min}</b>
              <span>min</span>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>
                {o.title} <span className="mini-tag">{o.tag}</span>
              </div>
              <div className="lab" style={{ fontSize: 12 }}>
                {o.desc}
              </div>
            </div>
            <span className="radio" />
          </button>
        ))}
      </div>
      <button
        className="btn-violet"
        style={{ width: '100%', marginTop: 22 }}
        onClick={() => {
          start(pick)
          setSheet(null)
        }}
      >
        Start {pick}-minute session
      </button>
    </>
  )
}

/** Live countdown + P&L shown while a session runs. */
export function SessionLive() {
  const active = useSession((s) => s.active)
  const stop = useSession((s) => s.stop)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 250)
    return () => clearInterval(t)
  }, [])
  if (!active) return null
  const total = active.endsAt - active.startedAt
  const left = Math.max(0, active.endsAt - Date.now())
  const k = 1 - left / total
  const pnl = sessionPnl(active)
  const mm = Math.floor(left / 60000)
  const ss = Math.floor((left % 60000) / 1000)
  return (
    <motion.div className="sess-live" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <div className="sess-ring" style={{ ['--k' as any]: k }}>
        <span>
          {mm}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>{active.minutes}-min session · profit so far</div>
        <div className="big-num" style={{ fontSize: 26, marginTop: 4 }}>
          <AnimatedNumber value={pnl} format={(v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`} duration={0.8} />
        </div>
        <Sol usd={pnl} signed className="on-dark" />
      </div>
      <button className="btn-white stop" style={{ padding: '12px 18px', fontSize: 13 }} onClick={stop}>
        End now
      </button>
    </motion.div>
  )
}

/* ───────────── result modal ───────────── */

function Confetti() {
  const parts = useRef(
    Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: -Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 0.004,
      vy: 0.003 + Math.random() * 0.005,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      c: ['#14f195', '#7c5cff', '#03e1ff', '#dc1fff', '#ffffff', '#ffbe55'][Math.floor(Math.random() * 6)],
      s: 5 + Math.random() * 6,
    })),
  )
  const ref = useCanvas((ctx, w, h) => {
    let alive = false
    for (const p of parts.current) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.00006
      p.r += p.vr
      if (p.y < 1.1) alive = true
      ctx.save()
      ctx.translate(p.x * w, p.y * h)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2)
      ctx.restore()
    }
    return alive
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }} />
}

export function SessionResult() {
  const result = useSession((s) => s.result)
  const dismiss = useSession((s) => s.dismiss)
  const setSheet = useUI((s) => s.setSheet)
  const r = result
  const win = (r?.pnl ?? 0) >= 0
  const pct = r ? (r.pnl / r.startEquity) * 100 : 0
  const dur = r ? Math.round((r.endedAt - r.startedAt) / 1000) : 0
  return (
    <AnimatePresence>
      {r && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="sheet result"
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {win && r.pnl > 0 && <Confetti />}
            <div className={`result-glow ${win ? 'up' : 'down'}`} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SolanaLogo size={42} />
                <div>
                  <div className="lab">AI session complete</div>
                  <div style={{ fontWeight: 600 }}>
                    {r.minutes}-minute session · {Math.floor(dur / 60)}m {dur % 60}s
                  </div>
                </div>
              </div>
              <div className="lab" style={{ marginTop: 26 }}>
                {win ? 'You earned' : 'Session result'}
              </div>
              <div className="big-num" style={{ fontSize: 54, marginTop: 6, color: win ? 'var(--long)' : 'var(--short)' }}>
                <AnimatedNumber value={r.pnl} format={(v) => `${v >= 0 ? '+' : '−'}${fmtUsd(Math.abs(v))}`} duration={1.6} />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span className={win ? 'chip-up' : 'chip-down'}>
                  {pct >= 0 ? '+' : ''}
                  {pct.toFixed(2)}%
                </span>
                <span className="sol-hint" style={{ fontSize: 13 }}>
                  ≈ {r.pnl >= 0 ? '+' : '−'}
                  {Math.abs(r.pnl / r.price).toFixed(3)} SOL
                </span>
              </div>
              <div style={{ marginTop: 18 }}>
                <PriceLine points={r.samples.map((s) => ({ t: s.t / 1000, v: s.v }))} height={130} color={win ? '#14f195' : '#ff5f87'} />
              </div>
              <div className="res-grid">
                <div>
                  <div className="lab">Start balance</div>
                  <b>{fmtUsd(r.startEquity)}</b>
                </div>
                <div>
                  <div className="lab">End balance</div>
                  <b>{fmtUsd(r.endEquity)}</b>
                  <Sol usd={r.endEquity} />
                </div>
                <div>
                  <div className="lab">Trades</div>
                  <b>
                    {r.trades} · {r.trades ? Math.round((r.wins / r.trades) * 100) : 0}% won
                  </b>
                </div>
                <div>
                  <div className="lab">Best trade</div>
                  <b style={{ color: 'var(--long)' }}>+{fmtUsd(r.best)}</b>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button className="btn-dark" style={{ flex: 1 }} onClick={dismiss}>
                  Close
                </button>
                <button
                  className="btn-violet"
                  style={{ flex: 1.4 }}
                  onClick={() => {
                    dismiss()
                    setSheet('session')
                  }}
                >
                  Run another session
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
