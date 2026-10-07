import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { EXCHANGES } from '../data/exchanges'
import type { ExchangeId } from '../data/types'
import { useMarket } from '../store/market'
import { useUI, type Mode } from '../store/ui'
import { SolanaLogo } from './SolanaLogo'
import { Icon } from './Icon'

export const MIN_REAL_USD = 50

const VENUES: { id: ExchangeId; hue: string }[] = [
  { id: 'binance', hue: '#f3ba2f' },
  { id: 'bybit', hue: '#f7a600' },
  { id: 'okx', hue: '#e8e8e8' },
  { id: 'sim', hue: '#9d6bff' },
]

export function VenuePicker() {
  const { exchange, source, status, setExchange } = useMarket()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [])
  const dot = status === 'live' ? '' : status === 'error' ? 'off' : 'warn'
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} style={{ gap: 9 }}>
        <span className={`live-dot ${dot}`} />
        {EXCHANGES[source].name}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="dim" style={{ fontSize: 8 }}>
          <Icon name="chevron" size={10} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="glass popover"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="eyebrow" style={{ padding: '6px 10px 8px' }}>
              Market data source
            </div>
            {VENUES.map((v) => (
              <button
                key={v.id}
                className={`venue ${v.id === exchange ? 'on' : ''}`}
                onClick={() => {
                  setExchange(v.id)
                  setOpen(false)
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 3, background: v.hue, boxShadow: `0 0 10px ${v.hue}` }} />
                <span style={{ flex: 1 }}>{EXCHANGES[v.id].name}</span>
                <span className="dim mono" style={{ fontSize: 10 }}>
                  {v.id === 'sim' ? 'offline' : 'live'}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ModeSwitch() {
  const { mode, setMode, setWelcomeOpen } = useUI()
  const pick = (m: Mode) => {
    if (m === mode) return
    if (m === 'real') setWelcomeOpen(true, 'warn')
    else setMode('demo')
  }
  return (
    <div className="seg mode">
      {(['demo', 'real'] as Mode[]).map((m) => (
        <button key={m} className={mode === m ? 'on' : ''} onClick={() => pick(m)}>
          {mode === m && <motion.div layoutId="mode-thumb" className={`thumb ${m}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span>{m === 'demo' ? 'Demo' : 'Real'}</span>
        </button>
      ))}
    </div>
  )
}

/* ───────────── Welcome: demo notice + mode choice ───────────── */

export function WelcomeModal() {
  const { welcomeOpen, welcomeStep, setWelcomeOpen, setMode, setTutorialOpen } = useUI()
  const [step, setStep] = useState<'choose' | 'warn'>(welcomeStep)
  const [agree, setAgree] = useState(false)
  useEffect(() => {
    setStep(welcomeStep)
    setAgree(false)
  }, [welcomeOpen, welcomeStep])

  const tutorial = () => {
    let skip = false
    try {
      skip = localStorage.getItem('sola.tutorial.skip') === '1'
    } catch {}
    if (!skip) setTimeout(() => setTutorialOpen(true), 380)
  }
  const stayDemo = () => {
    setMode('demo')
    setWelcomeOpen(false)
    tutorial()
  }

  return (
    <AnimatePresence>
      {welcomeOpen && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <motion.div
            className="glass modal welcome"
            initial={{ opacity: 0, y: 40, scale: 0.94, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.96, filter: 'blur(10px)' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {step === 'choose' ? (
                <motion.div key="choose" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="welcome-head">
                    <span className="welcome-logo"><SolanaLogo size={64} /></span>
                    <div className="demo-pill choose">
                      <span className="live-dot" /> SELECT A MODE
                    </div>
                  </div>
                  <h2 className="display welcome-title">
                    Welcome to <em>Solana AI</em>
                  </h2>
                  <p className="muted welcome-text">
                    Choose how you want to use the AI. You can switch modes at any time from the top bar.
                  </p>
                  <div className="mode-cards">
                    <motion.button className="mode-card demo" onClick={stayDemo} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                      <div className="mc-top">
                        <span className="mc-glyph demo"><Icon name="spark" size={16} /></span>
                        <span className="mc-badge">No risk</span>
                      </div>
                      <h4>Demo</h4>
                      <ul>
                        <li>$10,000 virtual balance</li>
                        <li>Live prices from top exchanges</li>
                        <li>Full AI bot, zero risk</li>
                      </ul>
                      <span className="mc-cta">Start in Demo →</span>
                    </motion.button>
                    <motion.button className="mode-card real" onClick={() => setStep('warn')} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                      <div className="mc-top">
                        <span className="mc-glyph real"><SolanaLogo size={20} tile={false} /></span>
                        <span className="mc-badge alt">Wallet</span>
                      </div>
                      <h4>Real</h4>
                      <ul>
                        <li>Connect a Solana wallet</li>
                        <li>AI trades your real funds</li>
                        <li>Min. wallet balance ${MIN_REAL_USD}</li>
                      </ul>
                      <span className="mc-cta">Switch to Real →</span>
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="warn" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="warn-icon">!</div>
                  <h2 className="display welcome-title">Real trading mode</h2>
                  <p className="muted welcome-text">Before you switch, please read carefully:</p>
                  <div className="warn-box">
                    <div className="warn-row strong">
                      <span className="wr-num">${MIN_REAL_USD}</span>
                      <span>
                        The AI bot trades in Real mode <b>only with wallets holding at least ${MIN_REAL_USD}</b>. Smaller balances can be connected but the bot will not open positions.
                      </span>
                    </div>
                    <div className="warn-row">
                      <span className="wr-dot" />
                      <span>Trades are executed with your real funds. Crypto trading — especially with leverage — can lose money.</span>
                    </div>
                    <div className="warn-row">
                      <span className="wr-dot" />
                      <span>AI signals are probabilistic estimates, not financial advice.</span>
                    </div>
                  </div>
                  <label className="agree" onClick={() => setAgree((a) => !a)}>
                    <span className={`check ${agree ? 'on' : ''}`}>{agree ? <Icon name="check" size={12} /> : null}</span>I understand the risks and the ${MIN_REAL_USD} minimum
                  </label>
                  <div className="welcome-actions">
                    <button className="btn btn-ghost" onClick={stayDemo}>
                      Stay in Demo
                    </button>
                    <button className="btn btn-primary">Connect</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toasts() {
  const { toasts, dismiss } = useUI()
  return (
    <div className="toasts">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`glass toast ${t.kind}`}
            style={{ background: 'rgba(22,18,38,0.82)' }}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={() => dismiss(t.id)}
          >
            <span className="bar" />
            <div>
              <div className="t">{t.title}</div>
              {t.body && <div className="b">{t.body}</div>}
            </div>
            <span className="progress" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
