import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Header, MobileNav, Sheets } from './components/Fintech'
import { Toasts, WalletModal, WelcomeModal } from './components/Shell'
import { botStep } from './store/bot'
import { startFeed, useMarket } from './store/market'
import { computeSignal, useSignal } from './store/signal'
import { thinkTick } from './store/thoughts'
import { useTrading } from './store/trading'
import { useUI } from './store/ui'
import { ActivityView, HomeView, HowView, PerformanceView } from './views/Views'

const VIEWS = { home: HomeView, activity: ActivityView, performance: PerformanceView, how: HowView }

export default function App() {
  const tab = useUI((s) => s.tab)
  const mode = useUI((s) => s.mode)
  const notice = useMarket((s) => s.notice)

  useEffect(() => {
    startFeed()
    const sig = setInterval(computeSignal, 1000)
    const thoughts = setInterval(() => thinkTick(useSignal.getState().signal), 1100)
    const bot = setInterval(() => useUI.getState().mode === 'demo' && botStep(), 3000)
    const unsub = useMarket.subscribe((s, p) => s.price !== p.price && useTrading.getState().tick(s.price))
    return () => {
      clearInterval(sig)
      clearInterval(thoughts)
      clearInterval(bot)
      unsub()
    }
  }, [])

  const View = VIEWS[tab]
  return (
    <>
      <div className="fx-glow" />
      <div className="fx-shell">
        <Header />
        <AnimatePresence>
          {notice && (
            <motion.div key="n" className="notice" style={{ marginBottom: 20, borderRadius: 999 }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <span className="live-dot warn" />
              {notice}
            </motion.div>
          )}
          {mode === 'real' && (
            <motion.div key="real" className="notice violet" style={{ marginBottom: 20, borderRadius: 999 }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <span className="live-dot" style={{ background: 'var(--violet)' }} />
              Real mode · connect a wallet with at least $50 to let the AI trade. Analytics stay fully live.
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.main key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <View />
          </motion.main>
        </AnimatePresence>
        <footer className="lab" style={{ fontSize: 12, textAlign: 'center', padding: '40px 0 0' }}>
          Solana AI · market data from Binance / Bybit / OKX · charts by TradingView Lightweight Charts™ · not financial advice
        </footer>
      </div>
      <MobileNav />
      <Sheets />
      <WelcomeModal />
      <WalletModal />
      <Toasts />
    </>
  )
}
