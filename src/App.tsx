import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Background } from './components/Background'
import { MobileNav, Toasts, TopBar, WalletModal, WelcomeModal } from './components/Shell'
import { botStep } from './store/bot'
import { startFeed, useMarket } from './store/market'
import { computeSignal, useSignal } from './store/signal'
import { thinkTick } from './store/thoughts'
import { useTrading } from './store/trading'
import { useUI } from './store/ui'
import { BacktestView, BrainView, TradesView } from './views/Views'

const VIEWS = { brain: BrainView, trades: TradesView, backtest: BacktestView }

export default function App() {
  const tab = useUI((s) => s.tab)
  const mode = useUI((s) => s.mode)
  const notice = useMarket((s) => s.notice)

  useEffect(() => {
    startFeed()
    const sig = setInterval(computeSignal, 1000)
    const thoughts = setInterval(() => thinkTick(useSignal.getState().signal), 1100)
    const bot = setInterval(() => useUI.getState().mode === 'demo' && botStep(), 3000)
    // demo engine follows every price tick
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
      <Background />
      <div className="shell">
        <TopBar />
        <AnimatePresence>
          {notice && (
            <motion.div key="n" className="notice" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <span className="live-dot warn" />
              {notice}
            </motion.div>
          )}
          {mode === 'real' && (
            <motion.div key="real" className="notice violet" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <span className="live-dot" style={{ background: 'var(--violet)' }} />
              Real mode · the AI bot trades only with connected wallets holding at least $50. Analytics stay fully live.
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            className="main"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <View />
          </motion.main>
        </AnimatePresence>
        <footer className="dim" style={{ fontSize: 11.5, textAlign: 'center', padding: '10px 0 4px' }}>
          Solana AI · market data from Binance / Bybit / OKX · charts by TradingView Lightweight Charts™ · not financial advice
        </footer>
      </div>
      <MobileNav />
      <WelcomeModal />
      <WalletModal />
      <Toasts />
    </>
  )
}
