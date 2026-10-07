import { motion } from 'framer-motion'
import { Fragment, useMemo, useState } from 'react'
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts'
import { Commentary, Copilot, FactorsPanel, ForecastCard, LevelsCard, Mini, RadarPanel, SignalCard } from '../components/AIWidgets'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Ring, Spark } from '../components/canvas'
import { ChartPanel } from '../components/ChartPanel'
import { NumInput, Power, Range, Segmented } from '../components/Controls'
import { Panel } from '../components/Glass'
import { DEFAULT_OVERLAYS, PriceChart } from '../components/PriceChart'
import { CrossExchange, DepthPanel, Empty, OrderBookPanel, PositionsPanel, PosTable, TradePanel, TradesPanel } from '../components/TradeWidgets'
import { EXCHANGES } from '../data/exchanges'
import { INTERVALS, type Candle, type Interval } from '../data/types'
import { backtest, STRATEGIES, type BtParams, type BtResult, type StrategyId } from '../lib/ai'
import { fmtDate, fmtDuration, fmtPct, fmtPrice, fmtSigned, fmtTime, fmtUsd } from '../lib/format'
import { useBot } from '../store/bot'
import { useMarket } from '../store/market'
import { equityOf, START_BALANCE, useTrading } from '../store/trading'
import { toast, useUI } from '../store/ui'

/* ───────────── Terminal ───────────── */

export function TerminalView() {
  return (
    <>
      <div className="grid g-terminal">
        <ChartPanel delay={0.05} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <SignalCard delay={0.12} compact />
          <TradePanel delay={0.18} />
        </div>
      </div>
      <div className="grid g-terminal-bottom">
        <PositionsPanel delay={0.22} />
        <OrderBookPanel delay={0.26} />
        <TradesPanel delay={0.3} />
      </div>
      <div className="grid g-2">
        <DepthPanel delay={0.32} />
        <CrossExchange delay={0.36} />
      </div>
    </>
  )
}

/* ───────────── AI analytics ───────────── */

export function AIView() {
  return (
    <>
      <div className="grid g-ai">
        <SignalCard delay={0.05} />
        <ChartPanel delay={0.1} height={460} />
      </div>
      <div className="grid g-3">
        <FactorsPanel delay={0.15} />
        <RadarPanel delay={0.2} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <ForecastCard delay={0.25} />
          <LevelsCard delay={0.3} />
        </div>
      </div>
      <div className="grid g-side">
        <Commentary delay={0.3} />
        <Copilot delay={0.35} />
      </div>
    </>
  )
}

/* ───────────── Autopilot ───────────── */

export function AutopilotView() {
  const bot = useBot()
  const mode = useUI((s) => s.mode)
  const price = useMarket((s) => s.price)
  const { positions, history, closePosition } = useTrading()
  const mine = positions.filter((p) => p.source === 'bot')
  const trades = history.filter((h) => h.source === 'bot')
  const pnl = trades.reduce((s, t) => s + t.pnl, 0)
  const wins = trades.filter((t) => t.pnl > 0).length
  const curve = useMemo(() => {
    let s = 0
    return [0, ...[...trades].reverse().map((t) => (s += t.pnl))]
  }, [trades.length])
  const disabled = mode === 'real'

  return (
    <>
      <Panel delay={0.05} pad={false} className="hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <motion.div animate={{ scale: bot.enabled ? [1, 1.06, 1] : 1 }} transition={{ repeat: bot.enabled ? Infinity : 0, duration: 2.4 }}>
            <div className="orb lg" style={{ filter: bot.enabled ? 'none' : 'grayscale(0.8) brightness(0.7)' }} />
          </motion.div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="eyebrow">{bot.enabled ? `Работает ${fmtDuration(Date.now() - (bot.startedAt ?? Date.now()))}` : 'Автопилот'}</div>
            <h1 style={{ fontSize: 'clamp(26px,3vw,40px)', marginTop: 10 }}>
              {bot.enabled ? (
                <>
                  ИИ торгует <em>за вас</em>
                </>
              ) : (
                <>
                  Запустите <em>AI-автопилот</em>
                </>
              )}
            </h1>
            <p style={{ marginTop: 10 }}>
              Бот анализирует каждую свечу, открывает и сопровождает позиции со стоп-лоссом и тейк-профитом по ATR. Работает, пока открыта вкладка.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="display" style={{ fontSize: 14, color: bot.enabled ? 'var(--mint)' : 'var(--ink-3)' }}>
              {bot.enabled ? 'ВКЛ' : 'ВЫКЛ'}
            </span>
            <Power on={bot.enabled} onClick={() => (disabled ? toast('Только в демо-режиме', 'Переключитесь в «Демо»', 'error') : bot.toggle())} />
          </div>
        </div>
      </Panel>

      <div className="grid g-4">
        <Kpi label="PnL бота" value={pnl} fmt={(v) => `${fmtSigned(v)} $`} cls={pnl >= 0 ? 'up' : 'down'} delay={0.1} spark={curve} />
        <Kpi label="Сделок" value={trades.length} fmt={(v) => v.toFixed(0)} sub={`${mine.length} открыто`} delay={0.14} />
        <Kpi label="Win rate" value={trades.length ? (wins / trades.length) * 100 : 0} fmt={(v) => `${v.toFixed(1)}%`} delay={0.18} ring={trades.length ? wins / trades.length : 0} />
        <Kpi label="Риск / сделка" value={bot.riskPct} fmt={(v) => `${v.toFixed(1)}%`} sub={`плечо x${bot.leverage}`} delay={0.22} />
      </div>

      <Panel title="Стратегия" k="Strategy" delay={0.2}>
        <div className="grid g-4" style={{ gap: 14 }}>
          {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => {
            const s = STRATEGIES[id]
            return (
              <button key={id} className={`strat ${bot.strategy === id ? 'on' : ''}`} style={{ ['--h' as any]: s.hue }} onClick={() => bot.set({ strategy: id })}>
                <div className="glyph" />
                <h4>{s.name}</h4>
                <div className="tag">{s.tag}</div>
                <p>{s.desc}</p>
              </button>
            )
          })}
        </div>
      </Panel>

      <div className="grid g-side">
        <Panel title="Журнал решений" k="Log" delay={0.25} right={bot.enabled ? <span className="live-dot" /> : null}>
          <div className="log">
            {bot.logs.length === 0 && <Empty text="Журнал пуст — включите автопилот" />}
            {bot.logs.map((l, i) => (
              <motion.div key={l.t + '-' + i} className={`log-row ${l.kind}`} initial={i === 0 ? { opacity: 0, x: -10 } : false} animate={{ opacity: 1, x: 0 }}>
                <time>{fmtTime(l.t)}</time>
                <i />
                <span>{l.text}</span>
              </motion.div>
            ))}
          </div>
          {mine.length > 0 && (
            <>
              <div className="divider" />
              <div className="table-scroll">
                <PosTable positions={mine} price={price} onClose={(id) => closePosition(id, price)} />
              </div>
            </>
          )}
        </Panel>
        <Panel title="Параметры риска" k="Risk" delay={0.3}>
          <ParamRange label="Риск на сделку" value={bot.riskPct} min={0.5} max={5} step={0.5} fmt={(v) => `${v}%`} onChange={(v) => bot.set({ riskPct: v })} />
          <ParamRange label="Плечо" value={bot.leverage} min={1} max={10} step={1} fmt={(v) => `x${v}`} onChange={(v) => bot.set({ leverage: v })} />
          <ParamRange label="Стоп-лосс (ATR)" value={bot.slAtr} min={0.5} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => bot.set({ slAtr: v })} />
          <ParamRange label="Тейк-профит (ATR)" value={bot.tpAtr} min={0.5} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => bot.set({ tpAtr: v })} />
          <ParamRange label="Порог AI score" value={bot.threshold} min={15} max={70} step={5} fmt={(v) => `±${v}`} onChange={(v) => bot.set({ threshold: v })} />
          <div className="notice violet" style={{ marginTop: 10, fontSize: 12 }}>
            R:R = 1 : {(bot.tpAtr / bot.slAtr).toFixed(2)} · Безубыточный win rate ≈ {((bot.slAtr / (bot.slAtr + bot.tpAtr)) * 100).toFixed(0)}%
          </div>
        </Panel>
      </div>
    </>
  )
}

function ParamRange({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label>
        <span>{label}</span>
        <span className="mono" style={{ color: 'var(--ink)' }}>
          {fmt(value)}
        </span>
      </label>
      <Range value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  )
}

function Kpi({
  label,
  value,
  fmt,
  sub,
  cls = '',
  delay = 0,
  spark,
  ring,
}: {
  label: string
  value: number
  fmt: (v: number) => string
  sub?: string
  cls?: string
  delay?: number
  spark?: number[]
  ring?: number
}) {
  return (
    <Panel pad={false} className="kpi" delay={delay}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{label}</div>
          <div className={`v ${cls}`}>
            <AnimatedNumber value={value} format={fmt} />
          </div>
          {sub && <div className="s">{sub}</div>}
        </div>
        {ring != null && <Ring value={ring} size={56} color={ring >= 0.5 ? '#2ff3b3' : '#ffbe55'} />}
      </div>
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <Spark data={spark} height={36} baseline={0} />
        </div>
      )}
    </Panel>
  )
}

/* ───────────── Backtest ───────────── */

export function BacktestView() {
  const source = useMarket((s) => s.source)
  const liveInterval = useMarket((s) => s.interval)
  const [interval, setIv] = useState<Interval>(liveInterval)
  const [p, setP] = useState<BtParams>({ strategy: 'ai', capital: 10000, riskPct: 1.5, slAtr: 1.6, tpAtr: 2.8, leverage: 5, threshold: 35, fee: 0.0005 })
  const [res, setRes] = useState<{ r: BtResult; c: Candle[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const c = await EXCHANGES[source].loadCandles(interval, 1000)
      await new Promise((r) => setTimeout(r, 450))
      setRes({ r: backtest(c, p), c })
    } catch {
      toast('Не удалось загрузить историю', EXCHANGES[source].name, 'error')
    }
    setBusy(false)
  }

  const markers = useMemo<SeriesMarker<Time>[] | undefined>(() => {
    if (!res) return undefined
    const tz = -new Date().getTimezoneOffset() * 60
    return res.r.trades
      .flatMap((t) => [
        { time: (t.entryTime + tz) as UTCTimestamp, position: t.side === 1 ? 'belowBar' : 'aboveBar', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', color: t.side === 1 ? '#2ff3b3' : '#ff4f80', text: t.side === 1 ? 'L' : 'S' } as SeriesMarker<Time>,
        { time: (t.exitTime + tz) as UTCTimestamp, position: 'inBar', shape: 'circle', color: t.pnl >= 0 ? '#c4a6ff' : '#ffbe55', size: 0.6 } as SeriesMarker<Time>,
      ])
      .sort((a, b) => (a.time as number) - (b.time as number))
  }, [res])

  const r = res?.r
  return (
    <>
      <Panel title="Бэктест стратегии" k="Backtest" delay={0.05} right={<span className="dim" style={{ fontSize: 12 }}>до 1000 свечей · {EXCHANGES[source].name}</span>}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div className="field">
            <label>Стратегия</label>
            <select
              className="input"
              value={p.strategy}
              onChange={(e) => setP({ ...p, strategy: e.target.value as StrategyId })}
              style={{ appearance: 'none', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }}
            >
              {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => (
                <option key={id} value={id} style={{ background: '#151225' }}>
                  {STRATEGIES[id].name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Таймфрейм</label>
            <Segmented<Interval> size="sm" value={interval} onChange={setIv} options={INTERVALS.map((i) => ({ value: i, label: i }))} />
          </div>
          <div className="field">
            <label>Капитал</label>
            <NumInput value={String(p.capital)} onChange={(v) => setP({ ...p, capital: Math.max(100, +v || 0) })} unit="USDT" />
          </div>
          <div className="field">
            <label>
              <span>Риск / плечо</span>
              <span className="mono">
                {p.riskPct}% · x{p.leverage}
              </span>
            </label>
            <Range value={p.riskPct} min={0.5} max={5} step={0.5} onChange={(v) => setP({ ...p, riskPct: v })} />
          </div>
          <div className="field">
            <label>
              <span>SL / TP (ATR)</span>
              <span className="mono">
                {p.slAtr.toFixed(1)} / {p.tpAtr.toFixed(1)}
              </span>
            </label>
            <Range value={p.tpAtr} min={0.5} max={6} step={0.1} onChange={(v) => setP({ ...p, tpAtr: v })} />
          </div>
          <button className="btn btn-primary" style={{ height: 46 }} onClick={run} disabled={busy}>
            {busy ? 'Моделирование…' : r ? 'Перезапустить' : 'Запустить бэктест'}
          </button>
        </div>
      </Panel>

      {busy && (
        <Panel delay={0}>
          <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="orb lg" style={{ margin: '0 auto 20px' }} />
              <div className="eyebrow">Прогоняю стратегию по истории…</div>
            </div>
          </div>
        </Panel>
      )}

      {!busy && !r && (
        <Panel delay={0.1}>
          <Empty text="Выберите стратегию и нажмите «Запустить бэктест» — ИИ прогонит её по реальной истории свечей" />
        </Panel>
      )}

      {!busy && r && res && (
        <>
          <div className="grid g-4">
            <Kpi label="Доходность" value={r.totalReturn} fmt={(v) => fmtPct(v)} cls={r.totalReturn >= 0 ? 'up' : 'down'} sub={`Buy & Hold ${fmtPct(r.buyHold)}`} delay={0.05} spark={r.equity.filter((_, i) => i % 5 === 0).map((e) => e.value)} />
            <Kpi label="Макс. просадка" value={-r.maxDrawdown} fmt={(v) => `${v.toFixed(2)}%`} cls="down" delay={0.1} />
            <Kpi label="Win rate" value={r.winRate} fmt={(v) => `${v.toFixed(1)}%`} sub={`${r.trades.length} сделок`} delay={0.15} ring={r.winRate / 100} />
            <Kpi label="Profit factor" value={isFinite(r.profitFactor) ? r.profitFactor : 99} fmt={(v) => v.toFixed(2)} sub={`Sharpe ${r.sharpe.toFixed(2)}`} delay={0.2} />
          </div>
          <Panel title="Сделки на графике и кривая капитала" k={interval} delay={0.15}>
            <div className="chart-wrap" style={{ height: 600 }}>
              <PriceChart candles={res.c} signal={null} overlays={{ ...DEFAULT_OVERLAYS, score: false, levels: false, forecast: false, positions: false }} tradeMarkers={markers} equity={r.equity} />
            </div>
          </Panel>
          <Panel title="Журнал сделок" k={`${r.trades.length}`} delay={0.2}>
            <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Сторона</th>
                    <th>Вход</th>
                    <th>Выход</th>
                    <th>Изменение</th>
                    <th>PnL</th>
                    <th>Причина</th>
                    <th>Открыта</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trades.map((t, i) => (
                    <tr key={i}>
                      <td className="mono dim">{i + 1}</td>
                      <td>
                        <span className={`side-tag ${t.side === 1 ? 'long' : 'short'}`}>{t.side === 1 ? 'LONG' : 'SHORT'}</span>
                      </td>
                      <td className="mono">{fmtPrice(t.entry)}</td>
                      <td className="mono">{fmtPrice(t.exit)}</td>
                      <td className={`mono ${t.pnlPct >= 0 ? 'up' : 'down'}`}>{fmtPct(t.pnlPct)}</td>
                      <td className={`mono ${t.pnl >= 0 ? 'up' : 'down'}`}>{fmtSigned(t.pnl)} $</td>
                      <td className="dim">{t.reason}</td>
                      <td className="mono dim">{fmtDate(t.entryTime * 1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!r.trades.length && <Empty text="Стратегия не нашла входов на этом периоде — попробуйте другой таймфрейм" />}
            </div>
          </Panel>
        </>
      )}
    </>
  )
}

/* ───────────── Portfolio ───────────── */

export function PortfolioView() {
  const price = useMarket((s) => s.price)
  const t = useTrading()
  const mode = useUI((s) => s.mode)
  const setWalletOpen = useUI((s) => s.setWalletOpen)
  const eq = equityOf(t, price)
  const pnl = eq - START_BALANCE
  const wins = t.history.filter((h) => h.pnl > 0)
  const losses = t.history.filter((h) => h.pnl <= 0)
  const best = Math.max(0, ...t.history.map((h) => h.pnl))
  const worst = Math.min(0, ...t.history.map((h) => h.pnl))
  const fees = t.history.reduce((s, h) => s + h.fees, 0)
  const inPos = t.positions.reduce((s, p) => s + p.margin, 0)
  const curve = useMemo(() => [...t.equityCurve.map((p) => p.v), eq], [t.equityCurve.length, Math.round(eq)])
  const bySource = (['manual', 'bot', 'copilot'] as const).map((s) => ({
    s,
    pnl: t.history.filter((h) => h.source === s).reduce((a, h) => a + h.pnl, 0),
    n: t.history.filter((h) => h.source === s).length,
  }))
  const maxAbs = Math.max(1, ...bySource.map((b) => Math.abs(b.pnl)))

  if (mode === 'real')
    return (
      <Panel delay={0.05} pad={false} className="hero" style={{ textAlign: 'center' }}>
        <div className="orb lg" style={{ margin: '10px auto 26px' }} />
        <h1 style={{ margin: '0 auto' }}>
          Реальный <em>портфель</em>
        </h1>
        <p style={{ margin: '16px auto 26px' }}>Подключите кошелёк Solana, чтобы видеть балансы SPL-токенов, историю транзакций и PnL в реальном времени.</p>
        <button className="btn btn-primary" onClick={() => setWalletOpen(true)}>
          Подключить кошелёк
        </button>
      </Panel>
    )

  return (
    <>
      <div className="grid g-side">
        <Panel title="Капитал" k="Equity" delay={0.05}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div className="mono" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.05em' }}>
              <AnimatedNumber value={eq} format={(v) => fmtUsd(v)} />
            </div>
            <span className={`mono ${pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 15 }}>
              {fmtSigned(pnl)} $ · {fmtPct((pnl / START_BALANCE) * 100)}
            </span>
          </div>
          <div style={{ marginTop: 18 }}>
            <Spark data={curve.length > 1 ? curve : [START_BALANCE, eq]} height={220} baseline={START_BALANCE} />
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            Снимок капитала каждые 20 секунд · {t.equityCurve.length} точек
          </div>
        </Panel>
        <Panel title="Распределение" k="Alloc" delay={0.1} right={<button className="btn btn-ghost btn-xs" onClick={() => confirm('Сбросить демо-счёт до 10 000 USDT?') && t.reset()}>Сбросить</button>}>
          <Allocation free={t.balance} margin={inPos} upnl={eq - t.balance - inPos - t.orders.reduce((s, o) => s + o.margin, 0)} orders={t.orders.reduce((s, o) => s + o.margin, 0)} />
          <div className="divider" />
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            PnL по источнику
          </div>
          {bySource.map((b) => (
            <div key={b.s} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 80px', gap: 10, alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: 12.5 }}>{b.s === 'manual' ? 'Вручную' : b.s === 'bot' ? 'Автопилот' : 'Копилот'}</span>
              <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(b.pnl) / maxAbs) * 100}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  style={{ height: '100%', borderRadius: 6, background: b.pnl >= 0 ? 'var(--long)' : 'var(--short)', boxShadow: `0 0 10px ${b.pnl >= 0 ? 'var(--long)' : 'var(--short)'}` }}
                />
              </div>
              <span className={`mono ${b.pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 12, textAlign: 'right' }}>
                {fmtSigned(b.pnl)}
              </span>
            </div>
          ))}
        </Panel>
      </div>
      <div className="grid g-4">
        <Kpi label="Сделок закрыто" value={t.history.length} fmt={(v) => v.toFixed(0)} sub={`${wins.length} в плюс · ${losses.length} в минус`} delay={0.12} />
        <Kpi label="Win rate" value={t.history.length ? (wins.length / t.history.length) * 100 : 0} fmt={(v) => `${v.toFixed(1)}%`} ring={t.history.length ? wins.length / t.history.length : 0} delay={0.16} />
        <Kpi label="Лучшая / худшая" value={best} fmt={(v) => `+${v.toFixed(2)}`} cls="up" sub={`худшая ${worst.toFixed(2)} $`} delay={0.2} />
        <Kpi label="Комиссии" value={fees} fmt={(v) => `${v.toFixed(2)} $`} sub="0.05% тейкер · 0.02% мейкер" delay={0.24} />
      </div>
      <PnlCalendar />
      <PositionsPanel delay={0.3} />
    </>
  )
}

function Allocation({ free, margin, upnl, orders }: { free: number; margin: number; upnl: number; orders: number }) {
  const parts = [
    { l: 'Свободно', v: free, c: '#9d6bff' },
    { l: 'В позициях', v: margin, c: '#52c8ff' },
    { l: 'В ордерах', v: orders, c: '#ffbe55' },
    { l: 'Нереализ. PnL', v: Math.max(0, upnl), c: '#2ff3b3' },
  ]
  const total = parts.reduce((s, p) => s + p.v, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 10, overflow: 'hidden', gap: 3 }}>
        {parts.map((p) =>
          p.v > 0 ? (
            <motion.div key={p.l} initial={{ flexGrow: 0 }} animate={{ flexGrow: p.v / total }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} style={{ flexBasis: 0, background: p.c, boxShadow: `0 0 14px ${p.c}`, borderRadius: 4 }} />
          ) : null,
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        {parts.map((p) => (
          <div key={p.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: p.c }} />
            <span className="dim" style={{ fontSize: 11.5, flex: 1 }}>
              {p.l}
            </span>
            <span className="mono" style={{ fontSize: 12 }}>
              {fmtUsd(p.v, 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="kv" style={{ marginTop: 10 }}>
        <span>Нереализованный PnL</span>
        <span className={upnl >= 0 ? 'up' : 'down'}>{fmtSigned(upnl)} $</span>
      </div>
    </div>
  )
}

/** Hour-of-day heatmap of realised PnL. */
function PnlCalendar() {
  const history = useTrading((s) => s.history)
  const cells = useMemo(() => {
    const a = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[])
    for (const h of history) {
      const d = new Date(h.closedAt)
      a[(d.getDay() + 6) % 7][d.getHours()] += h.pnl
    }
    return a
  }, [history.length])
  const max = Math.max(1, ...cells.flat().map(Math.abs))
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  return (
    <Panel title="Тепловая карта PnL" k="день × час" delay={0.28}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(24, minmax(14px, 1fr))', gap: 4, minWidth: 520 }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="mono dim" style={{ fontSize: 9, textAlign: 'center' }}>
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          {cells.map((row, d) => (
            <Fragment key={d}>
              <span className="dim" style={{ fontSize: 10.5, alignSelf: 'center' }}>
                {days[d]}
              </span>
              {row.map((v, h) => {
                const a = Math.abs(v) / max
                return (
                  <motion.div
                    key={d + '-' + h}
                    title={`${days[d]} ${h}:00 · ${v.toFixed(2)} $`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (d * 24 + h) * 0.002 }}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 4,
                      background: v === 0 ? 'rgba(255,255,255,0.035)' : v > 0 ? `rgba(47,243,179,${0.15 + a * 0.85})` : `rgba(255,79,128,${0.15 + a * 0.85})`,
                      boxShadow: a > 0.6 ? `0 0 10px ${v > 0 ? 'rgba(47,243,179,0.6)' : 'rgba(255,79,128,0.6)'}` : 'none',
                    }}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/* ───────────── Guide ───────────── */

const STEPS = [
  { n: '01', t: 'Живые данные', d: 'WebSocket-потоки свечей, стакана и сделок SOL/USDT с Binance, Bybit и OKX с автоматическим резервом.' },
  { n: '02', t: 'Индикаторы', d: 'EMA, MACD, RSI, Боллинджер, ATR, стохастик, OBV и регрессия считаются в браузере на каждом тике.' },
  { n: '03', t: 'Ансамбль ИИ', d: 'Девять экспертов голосуют от −1 до +1. Веса объединяют голоса в AI score от −100 до +100.' },
  { n: '04', t: 'Прогноз', d: 'Конус вероятностей на 24 бара: дрейф регрессии + смещение ансамбля, ширина — по волатильности ATR.' },
  { n: '05', t: 'Исполнение', d: 'Демо-движок с плечом, лимитами, TP/SL и ликвидацией. Автопилот торгует по выбранной стратегии.' },
]

export function GuideView() {
  const setTab = useUI((s) => s.setTab)
  return (
    <>
      <Panel delay={0.05} pad={false} className="hero">
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="eyebrow">Sola AI · v0.1 · демо</div>
            <h1 style={{ marginTop: 14 }}>
              Нейросетевой терминал для торговли <em>Solana</em>
            </h1>
            <p>
              Реальные котировки централизованных бирж, ансамбль из девяти AI-экспертов, прогноз цены, копилот с командами на естественном языке и автопилот — всё в одном стеклянном интерфейсе.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setTab('terminal')}>
                Открыть терминал
              </button>
              <button className="btn btn-ghost" onClick={() => setTab('ai')}>
                Смотреть AI-аналитику
              </button>
            </div>
          </div>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }} style={{ margin: '0 auto' }}>
            <div className="orb" style={{ width: 200, height: 200 }} />
          </motion.div>
        </div>
      </Panel>
      <Panel title="Как работает модель" k="Pipeline" delay={0.12}>
        <div className="pipe">
          <div className="pipe-line" />
          {STEPS.map((s, i) => (
            <motion.div key={s.n} className="pipe-step" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <div className="num">{s.n}</div>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </motion.div>
          ))}
        </div>
      </Panel>
      <div className="grid g-3">
        <Panel title="Демо-режим" k="DEMO" delay={0.2}>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
            Виртуальные 10 000 USDT, реальные цены. Лонг и шорт с плечом до x20, рыночные и лимитные ордера, TP/SL, ликвидация и комиссии как на бирже. Состояние сохраняется в браузере.
          </p>
        </Panel>
        <Panel title="Реальный режим" k="REAL" delay={0.25}>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
            Интерфейс подключения кошелька Solana (Phantom, Solflare, Backpack, Ledger). Исполнение реальных ордеров появится в следующих версиях.
          </p>
        </Panel>
        <Panel title="Важно" k="Risk" delay={0.3}>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
            Сигналы модели — вероятностная оценка, а не финансовый совет. Торговля с плечом может привести к полной потере средств.
          </p>
        </Panel>
      </div>
      <div className="grid g-4">
        <Mini label="Экспертов в ансамбле" value="9" />
        <Mini label="Бирж-источников" value="3 + 2" />
        <Mini label="Стратегий" value="4" />
        <Mini label="Горизонт прогноза" value="24 бара" />
      </div>
    </>
  )
}
