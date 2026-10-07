import { useState } from 'react'
import { INTERVALS, type Interval } from '../data/types'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { useTrading } from '../store/trading'
import { Segmented } from './Controls'
import { Panel } from './Glass'
import { DEFAULT_OVERLAYS, PriceChart, type Overlays } from './PriceChart'

const TOGGLES: { k: keyof Overlays; label: string; color: string }[] = [
  { k: 'ema', label: 'EMA 21/50', color: '#c4a6ff' },
  { k: 'bb', label: 'Bollinger', color: '#ffbe55' },
  { k: 'forecast', label: 'AI forecast', color: '#e6dbff' },
  { k: 'levels', label: 'Levels', color: '#52c8ff' },
  { k: 'markers', label: 'AI signals', color: '#2ff3b3' },
  { k: 'positions', label: 'Positions', color: '#ff4f80' },
  { k: 'score', label: 'AI score', color: '#9d6bff' },
  { k: 'rsi', label: 'RSI', color: '#ffbe55' },
]

function loadOverlays(): Overlays {
  try {
    return { ...DEFAULT_OVERLAYS, ...JSON.parse(localStorage.getItem('sola.overlays') || '{}') }
  } catch {
    return DEFAULT_OVERLAYS
  }
}

export function ChartPanel({ delay = 0, height }: { delay?: number; height?: number }) {
  const { candles, interval, setInterval, status } = useMarket()
  const signal = useSignal((s) => s.signal)
  const positions = useTrading((s) => s.positions)
  const [ov, setOv] = useState<Overlays>(loadOverlays)
  const flip = (k: keyof Overlays) =>
    setOv((o) => {
      const n = { ...o, [k]: !o[k] }
      try {
        localStorage.setItem('sola.overlays', JSON.stringify(n))
      } catch {}
      return n
    })

  return (
    <Panel
      delay={delay}
      className="chart-panel"
      title={
        <Segmented<Interval> size="sm" value={interval} onChange={setInterval} options={INTERVALS.map((i) => ({ value: i, label: i }))} />
      }
      right={
        <div className="toggles">
          {TOGGLES.map((t) => (
            <button key={t.k} className={`toggle ${ov[t.k] ? 'on' : ''}`} style={{ color: ov[t.k] ? t.color : undefined }} onClick={() => flip(t.k)}>
              <i />
              <span style={{ color: ov[t.k] ? 'var(--ink)' : undefined }}>{t.label}</span>
            </button>
          ))}
        </div>
      }
    >
      <div className="chart-wrap" style={height ? { minHeight: height } : undefined}>
        {candles.length > 0 ? (
          <PriceChart candles={candles} signal={signal} overlays={ov} positions={positions} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="orb lg" style={{ margin: '0 auto 20px' }} />
              <div className="eyebrow">{status === 'error' ? 'No connection' : 'Loading market data…'}</div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
