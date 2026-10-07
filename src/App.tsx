import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Component, useEffect, type ReactNode } from 'react'
import { Background } from './components/Background'
import { Footer, Header, MobileNav, Sheets, StatusBar } from './components/Fintech'
import { SessionResult } from './components/Session'
import { Toasts, WelcomeModal } from './components/Shell'
import { Tutorial } from './components/Tutorial'
import { DUR, EASE, finishIntro, isIntro } from './lib/motion'
import { botStep } from './store/bot'
import { startFeed, useMarket } from './store/market'
import { sessionTick } from './store/session'
import { computeSignal, useSignal } from './store/signal'
import { thinkTick } from './store/thoughts'
import { useTrading } from './store/trading'
import { useUI } from './store/ui'
import { ActivityView, HomeView, HowView, PerformanceView } from './views/Views'

const VIEWS = { home: HomeView, activity: ActivityView, performance: PerformanceView, how: HowView }

/** Keeps one broken widget from taking the whole app down. */
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { err }
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <section className="card empty-hero">
        <h3>Something went wrong on this page</h3>
        <p>Your demo balance is safe. Reload the page to continue.</p>
        <button className="btn-violet" onClick={() => location.reload()}>
          Reload
        </button>
      </section>
    )
  }
}

export default function App() {
  const tab = useUI((s) => s.tab)

  useEffect(() => {
    startFeed()
    finishIntro()
    const sig = setInterval(computeSignal, 1000)
    const thoughts = setInterval(() => thinkTick(useSignal.getState().signal), 1100)
    const bot = setInterval(() => useUI.getState().mode === 'demo' && botStep(), 3000)
    const sess = setInterval(sessionTick, 500)
    const unsub = useMarket.subscribe((s, p) => s.price !== p.price && useTrading.getState().tick(s.price))
    return () => {
      clearInterval(sig)
      clearInterval(thoughts)
      clearInterval(bot)
      clearInterval(sess)
      unsub()
    }
  }, [])

  const View = VIEWS[tab]
  return (
    <MotionConfig reducedMotion="user">
      <div className="fx-glow" />
      <Background />
      <div className="fx-shell">
        <StatusBar />
        <Header />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={tab}
            initial={{ opacity: 0, filter: isIntro() ? 'blur(0px)' : 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: DUR.ui, ease: EASE.standard }}
          >
            <Boundary key={tab}>
              <View />
            </Boundary>
          </motion.main>
        </AnimatePresence>
        <Footer />
      </div>
      <MobileNav />
      <Sheets />
      <WelcomeModal />
      <Tutorial />
      <SessionResult />
      <Toasts />
    </MotionConfig>
  )
}
