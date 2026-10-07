import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EXCHANGES } from '../data/exchanges'
import type { ExchangeId } from '../data/types'
import { fmtCompact, fmtPct, fmtPrice, fmtUsd } from '../lib/format'
import { useBot } from '../store/bot'
import { useMarket } from '../store/market'
import { equityOf, START_BALANCE, useTrading } from '../store/trading'
import { useUI, type Tab } from '../store/ui'
import { AnimatedNumber } from './AnimatedNumber'
import { Spark } from './canvas'
import { Segmented } from './Controls'

export const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'terminal', label: 'Терминал', short: 'Терминал' },
  { id: 'ai', label: 'AI-аналитика', short: 'AI' },
  { id: 'autopilot', label: 'Автопилот', short: 'Бот' },
  { id: 'backtest', label: 'Бэктест', short: 'Тест' },
  { id: 'portfolio', label: 'Портфель', short: 'Портфель' },
  { id: 'guide', label: 'Как это работает', short: 'Гид' },
]

export function Sidebar() {
  const { tab, setTab, mode } = useUI()
  const botOn = useBot((s) => s.enabled)
  return (
    <motion.aside
      className="glass side"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="brand">
        <div className="orb" />
        <div>
          <div className="brand-name">
            Sola <span>AI</span>
          </div>
          <div className="brand-sub">Neural trading · SOL</div>
        </div>
      </div>
      <nav className="nav">
        {TABS.map((t, i) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {tab === t.id && (
              <motion.div layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="n">0{i + 1}</span>
            <span className="l">{t.label}</span>
            {t.id === 'autopilot' && botOn && mode === 'demo' && <span className="badge">ON</span>}
          </button>
        ))}
      </nav>
      <div className="side-foot">{mode === 'demo' ? <MiniEquity /> : <RealSideCard />}</div>
    </motion.aside>
  )
}

function MiniEquity() {
  const price = useMarket((s) => s.price)
  const t = useTrading()
  const eq = equityOf(t, price)
  const pnl = eq - START_BALANCE
  const data = useMemo(() => [...t.equityCurve.map((p) => p.v).slice(-80), eq], [t.equityCurve, Math.round(eq)])
  return (
    <div className="mini-equity">
      <div className="eyebrow">Демо-капитал</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 6 }}>
        <AnimatedNumber value={eq} format={(v) => fmtUsd(v)} />
      </div>
      <div className={`mono ${pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 12, marginTop: 2 }}>
        {pnl >= 0 ? '+' : ''}
        {fmtPrice(pnl)} · {fmtPct((pnl / START_BALANCE) * 100)}
      </div>
      <div style={{ marginTop: 10 }}>
        <Spark data={data.length > 1 ? data : [START_BALANCE, eq]} height={44} baseline={START_BALANCE} />
      </div>
    </div>
  )
}

function RealSideCard() {
  const open = useUI((s) => s.setWalletOpen)
  return (
    <div className="mini-equity">
      <div className="eyebrow">Реальный режим</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', margin: '8px 0 12px', lineHeight: 1.5 }}>
        Подключите Solana-кошелёк, чтобы торговать реальными средствами.
      </div>
      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => open(true)}>
        Подключить кошелёк
      </button>
    </div>
  )
}

export function MobileNav() {
  const { tab, setTab } = useUI()
  return (
    <nav className="glass mobile-nav">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
          {tab === t.id && <motion.div layoutId="mnav" className="nav-pill" style={{ borderRadius: 16 }} />}
          <span>{t.short}</span>
        </button>
      ))}
    </nav>
  )
}

const VENUES: { id: ExchangeId; hue: string }[] = [
  { id: 'binance', hue: '#f3ba2f' },
  { id: 'bybit', hue: '#f7a600' },
  { id: 'okx', hue: '#e8e8e8' },
  { id: 'sim', hue: '#9d6bff' },
]

function VenuePicker() {
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
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} style={{ gap: 10 }}>
        <span className={`live-dot ${dot}`} />
        {EXCHANGES[source].name}
        {source !== exchange && <span className="dim" style={{ fontWeight: 400 }}>(резерв)</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="dim" style={{ fontSize: 9 }}>
          ▼
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="glass"
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 230, padding: 8, borderRadius: 18, zIndex: 50, background: 'rgba(20,16,36,0.85)' }}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="eyebrow" style={{ padding: '6px 10px 8px', position: 'relative', zIndex: 2 }}>
              Источник данных
            </div>
            {VENUES.map((v) => (
              <button
                key={v.id}
                className="wallet-opt"
                style={{ padding: '10px 12px', marginBottom: 4, border: 0, background: v.id === exchange ? 'rgba(255,255,255,0.07)' : 'transparent', position: 'relative', zIndex: 2 }}
                onClick={() => {
                  setExchange(v.id)
                  setOpen(false)
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 3, background: v.hue, boxShadow: `0 0 10px ${v.hue}` }} />
                <span style={{ flex: 1, fontSize: 13 }}>{EXCHANGES[v.id].name}</span>
                <span className="dim mono" style={{ fontSize: 10 }}>
                  {v.id === 'sim' ? 'offline' : 'WS · REST'}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function TopBar() {
  const { price, ticker, lastDir } = useMarket()
  const { mode, setMode, setWalletOpen } = useUI()
  const t = useTrading()
  const eq = equityOf(t, price)
  const ch = ticker?.changePct ?? 0
  return (
    <motion.header
      className="glass topbar"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pair">
        <div className="coin" />
        <div>
          <div className="pair-name">SOL / USDT</div>
          <div className="pair-venue">Solana · Spot</div>
        </div>
      </div>
      <div style={{ marginLeft: 6 }}>
        <div className={`big-price ${lastDir > 0 ? 'up' : lastDir < 0 ? 'down' : ''}`}>
          {price ? <AnimatedNumber value={price} format={(v) => fmtPrice(v, 2)} duration={0.35} /> : <span className="skeleton" style={{ display: 'inline-block', width: 110, height: 26 }} />}
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="eyebrow">24ч</div>
          <div className={`v ${ch >= 0 ? 'up' : 'down'}`}>{fmtPct(ticker?.changePct)}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">Макс</div>
          <div className="v">{fmtPrice(ticker?.high24h)}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">Мин</div>
          <div className="v">{fmtPrice(ticker?.low24h)}</div>
        </div>
        <div className="stat hide-md">
          <div className="eyebrow">Объём SOL</div>
          <div className="v">{fmtCompact(ticker?.volume24h)}</div>
        </div>
        <div className="stat hide-md">
          <div className="eyebrow">Оборот $</div>
          <div className="v">{fmtCompact(ticker?.quoteVolume24h)}</div>
        </div>
      </div>
      <div className="top-right">
        <VenuePicker />
        <Segmented
          className="mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'demo', label: 'Демо' },
            { value: 'real', label: 'Реал' },
          ]}
          thumbClass={(v) => v}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === 'real' ? (
            <motion.button
              key="w"
              className="btn btn-primary wallet-btn"
              onClick={() => setWalletOpen(true)}
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
            >
              <span className="dot" />
              <span className="lbl">Подключить кошелёк</span>
            </motion.button>
          ) : (
            <motion.div
              key="d"
              className="btn btn-ghost btn-sm mono"
              style={{ cursor: 'default' }}
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
            >
              <span className="live-dot" />
              <AnimatedNumber value={eq} format={(v) => fmtUsd(v)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}

const WALLETS = [
  { name: 'Phantom', grad: 'linear-gradient(135deg,#ab9ff2,#534bb1)', l: 'P', tag: 'Популярный' },
  { name: 'Solflare', grad: 'linear-gradient(135deg,#ffd35c,#fc7d2c)', l: 'S', tag: '' },
  { name: 'Backpack', grad: 'linear-gradient(135deg,#ff6b6b,#c0283d)', l: 'B', tag: '' },
  { name: 'Ledger', grad: 'linear-gradient(135deg,#5b5b66,#1c1c22)', l: 'L', tag: 'Аппаратный' },
]

export function WalletModal() {
  const { walletOpen, setWalletOpen } = useUI()
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => {
    if (!walletOpen) setPicked(null)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setWalletOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [walletOpen])
  return (
    <AnimatePresence>
      {walletOpen && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWalletOpen(false)}>
          <motion.div
            className="glass modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 30, scale: 0.94, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.96, filter: 'blur(10px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="eyebrow">Реальный режим</div>
                <h3 className="display" style={{ fontSize: 22, fontWeight: 500, marginTop: 8 }}>
                  Подключение кошелька
                </h3>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setWalletOpen(false)}>
                Esc
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: '10px 0 20px' }}>
              Выберите кошелёк Solana. Sola AI никогда не получает доступ к вашим приватным ключам.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {WALLETS.map((w, i) => (
                <motion.button
                  key={w.name}
                  className="wallet-opt"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
                  onClick={() => setPicked(w.name)}
                >
                  <span className="wallet-logo" style={{ background: w.grad }}>
                    {w.l}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{w.name}</span>
                    <span className="dim" style={{ fontSize: 11.5 }}>
                      {picked === w.name ? 'Интеграция появится в следующем релизе' : w.tag || 'Solana wallet'}
                    </span>
                  </span>
                  <span className="dim mono" style={{ fontSize: 11 }}>
                    {picked === w.name ? 'скоро' : '→'}
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="notice violet" style={{ marginTop: 18, fontSize: 12 }}>
              Реальная торговля в разработке. Пока используйте демо-режим — он работает на живых котировках.
            </div>
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
