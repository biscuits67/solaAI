import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Background } from './components/Background'
import { MobileNav, Sidebar, Toasts, TopBar, WalletModal } from './components/Shell'
import { botStep } from './store/bot'
import { startFeed, useMarket } from './store/market'
import { computeSignal } from './store/signal'
import { useTrading } from './store/trading'
import { useUI } from './store/ui'
import { AIView, AutopilotView, BacktestView, GuideView, PortfolioView, TerminalView } from './views/Views'

const VIEWS = {
  terminal: TerminalView,
  ai: AIView,
  autopilot: AutopilotView,
  backtest: BacktestView,
  portfolio: PortfolioView,
  guide: GuideView,
}

export default function App() {
  const tab = useUI((s) => s.tab)
  const mode = useUI((s) => s.mode)
  const notice = useMarket((s) => s.notice)

  useEffect(() => {
    startFeed()
    const sig = setInterval(computeSignal, 1000)
    const bot = setInterval(() => useUI.getState().mode === 'demo' && botStep(), 3000)
    // demo engine follows every price tick
    const unsub = useMarket.subscribe((s, p) => s.price !== p.price && useTrading.getState().tick(s.price))
    return () => {
      clearInterval(sig)
      clearInterval(bot)
      unsub()
    }
  }, [])

  const View = VIEWS[tab]
  return (
    <>
      <Background />
      <div className="shell">
        <Sidebar />
        <main className="main">
          <TopBar />
          <AnimatePresence>
            {notice && (
              <motion.div className="notice" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <span className="live-dot warn" />
                {notice}
              </motion.div>
            )}
            {mode === 'real' && (
              <motion.div key="real" className="notice violet" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <span className="live-dot" style={{ background: 'var(--violet)' }} />
                Реальный режим: подключение кошелька скоро станет доступно. Аналитика работает, торговля — только в демо.
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}
              className="main"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
          <footer className="dim" style={{ fontSize: 11.5, textAlign: 'center', padding: '10px 0 4px' }}>
            Sola AI · данные Binance / Bybit / OKX · графики TradingView Lightweight Charts™ · не является финансовой рекомендацией
          </footer>
        </main>
      </div>
      <MobileNav />
      <WalletModal />
      <Toasts />
    </>
  )
}
