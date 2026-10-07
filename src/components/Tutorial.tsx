import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { useUI } from '../store/ui'
import { MIN_REAL_USD } from './Shell'
import { SolanaLogo } from './SolanaLogo'
import { Icon } from './Icon'

const EASE = [0.22, 1, 0.36, 1] as const

/* tiny CSS illustrations for each step */

function ArtWelcome() {
  return (
    <div className="tut-art center">
      <div className="tut-rings">
        <i />
        <i />
        <i />
      </div>
      <SolanaLogo size={78} />
    </div>
  )
}
function ArtBalance({ real }: { real: boolean }) {
  return (
    <div className="tut-art">
      <div className="tut-card">
        <div className="lab">{real ? 'Wallet balance' : 'Demo balance'}</div>
        <div className="big-num" style={{ fontSize: 34, marginTop: 6 }}>
          {real ? '$ —' : '$10,000'}
          <small style={{ fontSize: 18, color: 'var(--ink-3)' }}>.00</small>
        </div>
        <span className="sol-hint">{real ? `min. $${MIN_REAL_USD} to trade` : '≈ 59.4 SOL'}</span>
        <div className="tut-acts">
          {['Buy', 'Sell', 'History', 'Settings'].map((t, i) => (
            <span key={t} className={i === -1 ? 'hl' : ''}>
              <i />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
function ArtSignal() {
  const [k, setK] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setK((x) => (x + 1) % 3), 1600)
    return () => clearInterval(t)
  }, [])
  const s = [
    { t: 'Buy SOL', c: 'LONG', d: 'expects +1.8% in 6 hours' },
    { t: 'Wait', c: 'NEUTRAL', d: 'no clear direction yet' },
    { t: 'Sell SOL', c: 'SHORT', d: 'expects −1.2% in 6 hours' },
  ][k]
  return (
    <div className="tut-art">
      <div className={`tut-card sig-card ${s.c}`} style={{ minHeight: 0 }}>
        <div className="lab" style={{ color: 'rgba(255,255,255,.75)' }}>
          AI signal · live
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={s.t} className="big-num" style={{ fontSize: 34, marginTop: 8 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {s.t}
          </motion.div>
        </AnimatePresence>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>The AI {s.d}</div>
        <div className="meter" style={{ marginTop: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={i < (k === 1 ? 2 : 4) ? 'on' : ''} />
          ))}
        </div>
      </div>
    </div>
  )
}
function ArtSession() {
  return (
    <div className="tut-art">
      <div className="tut-card">
        <div style={{ display: 'flex', gap: 10 }}>
          {[1, 5, 10].map((m, i) => (
            <div key={m} className={`tut-dur ${i === 0 ? 'on' : ''}`}>
              <b>{m}</b>
              <span>min</span>
            </div>
          ))}
        </div>
        <div className="tut-btn">Start 1-minute session</div>
      </div>
    </div>
  )
}
function ArtResult() {
  return (
    <div className="tut-art">
      <div className="tut-card" style={{ overflow: 'hidden', position: 'relative' }}>
        <div className="result-glow up" style={{ top: -200 }} />
        <div style={{ position: 'relative' }}>
          <div className="lab">You earned</div>
          <div className="big-num" style={{ fontSize: 38, color: 'var(--long)', marginTop: 6 }}>
            +$1,284.50
          </div>
          <span className="sol-hint">≈ +7.62 SOL</span>
          <div className="tut-bars">
            {[30, 42, 38, 55, 61, 58, 74, 88, 96].map((h, i) => (
              <motion.i key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.6, ease: EASE }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Step {
  title: string
  text: ReactNode
  art: ReactNode
}

export function Tutorial() {
  const { tutorialOpen, setTutorialOpen, mode, setSheet, setTab } = useUI()
  const [i, setI] = useState(0)
  const [never, setNever] = useState(false)
  const real = mode === 'real'
  useEffect(() => {
    if (tutorialOpen) setI(0)
  }, [tutorialOpen])

  const steps: Step[] = [
    {
      title: 'Welcome to Solana AI',
      text: 'An AI that watches the SOL market every second and trades for you. Here is how to get started in four quick steps.',
      art: <ArtWelcome />,
    },
    {
      title: real ? 'Connect your wallet' : 'This is your balance',
      text: real ? (
        <>
          In Real mode the AI trades from your Solana wallet. You need at least <b>${MIN_REAL_USD}</b> in it. Every dollar amount also shows how much it is in SOL.
        </>
      ) : (
        <>
          You start with <b>$10,000</b> of virtual money — nothing is at risk. Every dollar amount also shows how much it is in SOL.
        </>
      ),
      art: <ArtBalance real={real} />,
    },
    {
      title: 'Read the AI signal',
      text: 'The big card tells you what the AI thinks right now — Buy, Sell or Wait — and how confident it is. Tap any (?) to see what a word means.',
      art: <ArtSignal />,
    },
    {
      title: 'Start an AI session',
      text: 'In the big card at the top, pick 1, 5 or 10 minutes and press Start. Before you start, you see how much the AI may use and the most it can lose. You can end it any time.',
      art: <ArtSession />,
    },
    {
      title: 'See your results',
      text: 'When the session ends you get a report: profit, trades and how your balance moved. Want to know why the AI acted? Open “How AI decides”.',
      art: <ArtResult />,
    },
  ]
  const last = i === steps.length - 1
  const close = () => {
    try {
      if (never) localStorage.setItem('sola.tutorial.skip', '1')
    } catch {}
    setTutorialOpen(false)
  }
  const finish = () => {
    close()
    setTab('home')
    setTimeout(() => setSheet('session'), 350)
  }

  return (
    <AnimatePresence>
      {tutorialOpen && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="glass modal tut"
            initial={{ opacity: 0, y: 40, scale: 0.94, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.96, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="tut-top">
              <span className="demo-pill choose" style={{ padding: '6px 12px' }}>
                STEP {i + 1} / {steps.length}
              </span>
              <button className="btn btn-ghost btn-xs" onClick={close}>
                Skip
              </button>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: EASE }}>
                {steps[i].art}
                <h2 className="display welcome-title" style={{ marginTop: 22, fontSize: 26 }}>
                  {steps[i].title}
                </h2>
                <p className="muted welcome-text">{steps[i].text}</p>
              </motion.div>
            </AnimatePresence>
            <div className="tut-dots">
              {steps.map((_, k) => (
                <button key={k} className={k === i ? 'on' : k < i ? 'done' : ''} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} />
              ))}
            </div>
            <div className="tut-foot">
              <label className="agree" style={{ marginTop: 0, fontSize: 12.5 }} onClick={() => setNever((v) => !v)}>
                <span className={`check ${never ? 'on' : ''}`}>{never ? <Icon name="check" size={12} /> : null}</span>
                Don’t show again
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {i > 0 && (
                  <button className="btn btn-ghost" onClick={() => setI(i - 1)}>
                    Back
                  </button>
                )}
                {last && real ? (
                  <button className="btn btn-primary">Connect</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => (last ? finish() : setI(i + 1))}>
                    {last ? 'Start my first session' : 'Next'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
