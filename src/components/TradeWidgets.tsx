import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { loadQuotes, type Quote } from '../data/exchanges'
import { fmtCompact, fmtDuration, fmtPct, fmtPrice, fmtSigned, fmtTime, fmtUsd } from '../lib/format'
import { useMarket } from '../store/market'
import { useSignal } from '../store/signal'
import { liqPrice, upnl, useTrading, type Position, type Side } from '../store/trading'
import { useUI } from '../store/ui'
import { DepthChart, Pressure } from './canvas'
import { NumInput, Range, Segmented } from './Controls'
import { Panel } from './Glass'

/* ───────────── Order book ───────────── */

export function OrderBookPanel({ delay = 0 }: { delay?: number }) {
  const book = useMarket((s) => s.book)
  const price = useMarket((s) => s.price)
  const lastDir = useMarket((s) => s.lastDir)
  const rows = 11
  const asks = book?.asks.slice(0, rows) ?? []
  const bids = book?.bids.slice(0, rows) ?? []
  const max = Math.max(...asks.map((l) => l.size), ...bids.map((l) => l.size), 1)
  const bidSum = bids.reduce((s, l) => s + l.size, 0)
  const askSum = asks.reduce((s, l) => s + l.size, 0)
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0
  return (
    <Panel title="Стакан" k="L2" delay={delay} right={<span className="dim mono" style={{ fontSize: 11 }}>спред {spread.toFixed(3)}</span>}>
      <div className="book">
        <div className="book-head">
          <span>Цена</span>
          <span>SOL</span>
          <span>Сумма $</span>
        </div>
        {!book &&
          Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 16, margin: '4px 8px' }} />)}
        {[...asks].reverse().map((l, i) => (
          <div key={'a' + i} className="book-row ask">
            <span className="down">{fmtPrice(l.price)}</span>
            <span>{l.size.toFixed(2)}</span>
            <span className="dim">{fmtCompact(l.price * l.size)}</span>
            <div className="bar" style={{ width: `${(l.size / max) * 100}%` }} />
          </div>
        ))}
        <div className="book-mid">
          <span className={`mono ${lastDir > 0 ? 'up' : lastDir < 0 ? 'down' : ''}`} style={{ fontSize: 17, fontWeight: 600 }}>
            {fmtPrice(price)}
          </span>
          <span className="dim" style={{ fontSize: 11 }}>
            {lastDir > 0 ? '▲' : lastDir < 0 ? '▼' : '•'} последняя
          </span>
        </div>
        {bids.map((l, i) => (
          <div key={'b' + i} className="book-row bid">
            <span className="up">{fmtPrice(l.price)}</span>
            <span>{l.size.toFixed(2)}</span>
            <span className="dim">{fmtCompact(l.price * l.size)}</span>
            <div className="bar" style={{ width: `${(l.size / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }} className="mono">
          <span className="up">B {Math.round((bidSum / (bidSum + askSum || 1)) * 100)}%</span>
          <span className="down">{Math.round((askSum / (bidSum + askSum || 1)) * 100)}% A</span>
        </div>
        <Pressure buy={bidSum / (bidSum + askSum || 1)} height={6} />
      </div>
    </Panel>
  )
}

export function DepthPanel({ delay = 0 }: { delay?: number }) {
  const book = useMarket((s) => s.book)
  return (
    <Panel title="Глубина рынка" k="Depth" delay={delay}>
      {book ? <DepthChart bids={book.bids} asks={book.asks} height={170} /> : <div className="skeleton" style={{ height: 170 }} />}
    </Panel>
  )
}

/* ───────────── Trades tape ───────────── */

export function TradesPanel({ delay = 0 }: { delay?: number }) {
  const trades = useMarket((s) => s.trades)
  const avg = useMemo(() => trades.reduce((s, t) => s + t.size, 0) / (trades.length || 1), [trades])
  const buys = trades.filter((t) => t.side === 'buy').reduce((s, t) => s + t.size, 0)
  const sells = trades.filter((t) => t.side === 'sell').reduce((s, t) => s + t.size, 0)
  return (
    <Panel title="Лента сделок" k="Live" delay={delay}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }} className="mono">
          <span className="up">Покупки {buys.toFixed(1)}</span>
          <span className="down">{sells.toFixed(1)} Продажи</span>
        </div>
        <Pressure buy={buys / (buys + sells || 1)} height={6} />
      </div>
      <div style={{ height: 330, overflow: 'hidden', maskImage: 'linear-gradient(#000 80%, transparent)', WebkitMaskImage: 'linear-gradient(#000 80%, transparent)' }}>
        {!trades.length && <div className="empty">Ожидание сделок…</div>}
        <AnimatePresence initial={false}>
          {trades.slice(0, 22).map((t) => (
            <motion.div
              key={t.id}
              className={`tape-row ${t.size > avg * 3 ? 'big' : ''}`}
              initial={{ opacity: 0, x: t.side === 'buy' ? -16 : 16, backgroundColor: t.side === 'buy' ? 'rgba(47,243,179,0.18)' : 'rgba(255,79,128,0.18)' }}
              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={t.side === 'buy' ? 'up' : 'down'}>{fmtPrice(t.price)}</span>
              <span>{t.size.toFixed(3)}</span>
              <span>{fmtTime(t.time)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Panel>
  )
}

/* ───────────── Trade panel ───────────── */

export function TradePanel({ delay = 0 }: { delay?: number }) {
  const price = useMarket((s) => s.price)
  const signal = useSignal((s) => s.signal)
  const { balance, openMarket, placeLimit } = useTrading()
  const { mode, setWalletOpen } = useUI()
  const [side, setSide] = useState<Side>('long')
  const [type, setType] = useState<'market' | 'limit'>('market')
  const [limit, setLimit] = useState('')
  const [margin, setMargin] = useState('500')
  const [lev, setLev] = useState(5)
  const [useStops, setUseStops] = useState(true)
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')

  const entry = type === 'limit' && +limit > 0 ? +limit : price
  const m = Math.max(0, +margin || 0)
  const notional = m * lev
  const size = entry ? notional / entry : 0
  const liq = entry ? liqPrice(side, entry, lev) : 0
  const fee = notional * (type === 'market' ? 0.0005 : 0.0002)
  const slN = useStops && +sl > 0 ? +sl : null
  const tpN = useStops && +tp > 0 ? +tp : null
  const dir = side === 'long' ? 1 : -1
  const risk = slN ? (slN - entry) * size * dir : null
  const reward = tpN ? (tpN - entry) * size * dir : null

  const applyAI = () => {
    if (!signal) return
    const a = signal.atr
    const s: Side = signal.direction === 'SHORT' ? 'short' : 'long'
    const d = s === 'long' ? 1 : -1
    setSide(s)
    setUseStops(true)
    setSl((price - d * a * 1.6).toFixed(2))
    setTp((price + d * a * 2.8).toFixed(2))
  }

  useEffect(() => {
    if (type === 'limit' && !limit && price) setLimit(price.toFixed(2))
  }, [type])

  const valid = m >= 1 && entry > 0 && (!slN || (slN - entry) * dir < 0) && (!tpN || (tpN - entry) * dir > 0)

  const submit = () => {
    if (!valid) return
    if (type === 'market') openMarket({ side, margin: m, leverage: lev, sl: slN, tp: tpN }, price)
    else placeLimit({ side, margin: m, leverage: lev, price: entry, sl: slN, tp: tpN })
  }

  return (
    <Panel
      title="Ордер"
      k={mode === 'demo' ? 'DEMO' : 'REAL'}
      delay={delay}
      right={
        <button className="btn btn-ghost btn-xs" onClick={applyAI} disabled={!signal}>
          ✦ AI-план
        </button>
      }
    >
      <div className="side-tabs">
        {(['long', 'short'] as Side[]).map((s) => (
          <button key={s} className={`${s} ${side === s ? 'on' : ''}`} onClick={() => setSide(s)}>
            {side === s && <motion.div layoutId="side-thumb" className={`side-thumb ${s}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span>{s === 'long' ? 'Лонг ↑' : 'Шорт ↓'}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 14px' }}>
        <Segmented
          size="sm"
          value={type}
          onChange={setType}
          options={[
            { value: 'market', label: 'Рыночный' },
            { value: 'limit', label: 'Лимитный' },
          ]}
        />
        <span className="dim mono" style={{ fontSize: 11 }}>
          {fmtUsd(balance)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AnimatePresence initial={false}>
          {type === 'limit' && (
            <motion.div className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <label>
                <span>Цена входа</span>
                <span style={{ cursor: 'pointer', color: 'var(--violet-2)' }} onClick={() => setLimit(price.toFixed(2))}>
                  по рынку
                </span>
              </label>
              <NumInput value={limit} onChange={setLimit} unit="USDT" step={0.01} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field">
          <label>
            <span>Маржа</span>
            <span>≈ {size.toFixed(3)} SOL</span>
          </label>
          <NumInput value={margin} onChange={setMargin} unit="USDT" />
          <div className="chip-row">
            {[10, 25, 50, 100].map((p) => (
              <button key={p} className="chip" style={{ flex: 1 }} onClick={() => setMargin(((balance * p) / 100 / (1 + lev * 0.0005)).toFixed(2))}>
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            <span>Плечо</span>
            <span className="mono" style={{ color: lev >= 10 ? 'var(--amber)' : 'var(--ink)' }}>
              x{lev}
            </span>
          </label>
          <Range value={lev} min={1} max={20} onChange={setLev} ticks={5} />
        </div>

        <div className="field">
          <label>
            <span style={{ cursor: 'pointer' }} onClick={() => setUseStops((v) => !v)}>
              <span className={`toggle ${useStops ? 'on' : ''}`} style={{ padding: '2px 8px', color: useStops ? 'var(--violet-2)' : undefined }}>
                <i /> TP / SL
              </span>
            </span>
            {risk != null && reward != null && risk < 0 && <span className="mono">R:R 1:{(reward / -risk).toFixed(2)}</span>}
          </label>
          <AnimatePresence initial={false}>
            {useStops && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, overflow: 'hidden' }}
              >
                <NumInput value={tp} onChange={setTp} unit="TP" step={0.01} placeholder="Тейк" />
                <NumInput value={sl} onChange={setSl} unit="SL" step={0.01} placeholder="Стоп" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="divider" />
      <div className="kv">
        <span>Объём позиции</span>
        <span>{fmtUsd(notional)}</span>
      </div>
      <div className="kv">
        <span>Цена ликвидации</span>
        <span className="down">{fmtPrice(liq)}</span>
      </div>
      <div className="kv">
        <span>Комиссия</span>
        <span>{fmtUsd(fee, 3)}</span>
      </div>
      {risk != null && (
        <div className="kv">
          <span>Риск по SL</span>
          <span className="down">{fmtSigned(risk)} $</span>
        </div>
      )}
      {reward != null && (
        <div className="kv">
          <span>Профит по TP</span>
          <span className="up">{fmtSigned(reward)} $</span>
        </div>
      )}

      <button className={`btn ${side === 'long' ? 'btn-long' : 'btn-short'}`} style={{ width: '100%', marginTop: 16, padding: 15, fontSize: 14 }} disabled={!valid} onClick={submit}>
        {type === 'market' ? (side === 'long' ? 'Открыть лонг' : 'Открыть шорт') : 'Разместить лимит'} · x{lev}
      </button>

      {mode === 'real' && (
        <div className="locked">
          <div className="orb" style={{ width: 54, height: 54 }} />
          <div className="display" style={{ fontSize: 15, fontWeight: 500 }}>
            Кошелёк не подключён
          </div>
          <div className="muted" style={{ fontSize: 12.5, maxWidth: 240 }}>
            Подключите Solana-кошелёк, чтобы отправлять реальные ордера
          </div>
          <button className="btn btn-primary" onClick={() => setWalletOpen(true)}>
            Подключить кошелёк
          </button>
        </div>
      )}
    </Panel>
  )
}

/* ───────────── Positions / orders / history ───────────── */

export function PositionsPanel({ delay = 0 }: { delay?: number }) {
  const price = useMarket((s) => s.price)
  const { positions, orders, history, closePosition, cancelOrder, closeAll } = useTrading()
  const [tab, setTab] = useState<'pos' | 'ord' | 'hist'>('pos')
  return (
    <Panel
      delay={delay}
      title={
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pos', label: `Позиции ${positions.length}` },
            { value: 'ord', label: `Ордера ${orders.length}` },
            { value: 'hist', label: `История ${history.length}` },
          ]}
        />
      }
      right={
        tab === 'pos' && positions.length > 0 ? (
          <button className="btn btn-ghost btn-xs" onClick={() => closeAll(price)}>
            Закрыть все
          </button>
        ) : null
      }
    >
      <div className="table-scroll">
        {tab === 'pos' && (positions.length ? <PosTable positions={positions} price={price} onClose={(id) => closePosition(id, price)} /> : <Empty text="Нет открытых позиций" />)}
        {tab === 'ord' &&
          (orders.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Сторона</th>
                  <th>Цена</th>
                  <th>Маржа</th>
                  <th>Плечо</th>
                  <th>До цены</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className={`side-tag ${o.side}`}>{o.side === 'long' ? 'LONG' : 'SHORT'}</span>
                    </td>
                    <td className="mono">{fmtPrice(o.price)}</td>
                    <td className="mono">{fmtUsd(o.margin)}</td>
                    <td className="mono">x{o.leverage}</td>
                    <td className="mono dim">{fmtPct(((o.price - price) / price) * 100)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => cancelOrder(o.id)}>
                        Отменить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="Нет активных лимитных ордеров" />
          ))}
        {tab === 'hist' &&
          (history.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Сторона</th>
                  <th>Вход → Выход</th>
                  <th>Размер</th>
                  <th>PnL</th>
                  <th>Причина</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 30).map((h) => (
                  <tr key={h.id + h.closedAt}>
                    <td>
                      <span className={`side-tag ${h.side}`}>{h.side === 'long' ? 'LONG' : 'SHORT'}</span> <span className="src-tag">{h.source}</span>
                    </td>
                    <td className="mono">
                      {fmtPrice(h.entry)} → {fmtPrice(h.exit)}
                    </td>
                    <td className="mono">{h.size.toFixed(3)}</td>
                    <td className={`mono ${h.pnl >= 0 ? 'up' : 'down'}`}>{fmtSigned(h.pnl)} $</td>
                    <td className="dim">{h.reason}</td>
                    <td className="mono dim">{fmtDuration(h.closedAt - h.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="Сделок пока нет" />
          ))}
      </div>
    </Panel>
  )
}

export function PosTable({ positions, price, onClose }: { positions: Position[]; price: number; onClose: (id: string) => void }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Сторона</th>
          <th>Размер</th>
          <th>Вход</th>
          <th>Ликв.</th>
          <th>TP / SL</th>
          <th>PnL</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {positions.map((p) => {
            const pnl = upnl(p, price)
            const roe = (pnl / p.margin) * 100
            return (
              <motion.tr key={p.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}>
                <td>
                  <span className={`side-tag ${p.side}`}>
                    {p.side === 'long' ? 'LONG' : 'SHORT'} x{p.leverage}
                  </span>{' '}
                  {p.source !== 'manual' && <span className="src-tag">{p.source === 'bot' ? 'бот' : 'AI'}</span>}
                </td>
                <td className="mono">{p.size.toFixed(3)} SOL</td>
                <td className="mono">{fmtPrice(p.entry)}</td>
                <td className="mono down">{fmtPrice(p.liq)}</td>
                <td className="mono dim">
                  {p.tp ? fmtPrice(p.tp) : '—'} / {p.sl ? fmtPrice(p.sl) : '—'}
                </td>
                <td className={`mono ${pnl >= 0 ? 'up' : 'down'}`}>
                  {fmtSigned(pnl)} $ <span style={{ opacity: 0.6 }}>({fmtPct(roe, 1)})</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => onClose(p.id)}>
                    Закрыть
                  </button>
                </td>
              </motion.tr>
            )
          })}
        </AnimatePresence>
      </tbody>
    </table>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div className="orbit" />
      {text}
    </div>
  )
}

/* ───────────── Cross-exchange ───────────── */

export function CrossExchange({ delay = 0 }: { delay?: number }) {
  const [q, setQ] = useState<Quote[] | null>(null)
  const price = useMarket((s) => s.price)
  const source = useMarket((s) => s.source)
  useEffect(() => {
    let alive = true
    const load = () => loadQuotes().then((r) => alive && setQ(r))
    load()
    const t = setInterval(load, 10000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  const live = (q ?? []).filter((x) => x.price != null)
  const prices = live.map((x) => x.price!)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return (
    <Panel
      title="Биржи"
      k="Арбитраж"
      delay={delay}
      right={live.length > 1 ? <span className="mono dim" style={{ fontSize: 11 }}>спред {(((max - min) / min) * 100).toFixed(3)}%</span> : null}
    >
      {!q && Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton" style={{ height: 30, marginBottom: 8 }} />)}
      {q &&
        q.map((x, i) => {
          const pos = x.price != null && max > min ? (x.price - min) / (max - min) : 0.5
          return (
            <motion.div
              key={x.venue}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ display: 'grid', gridTemplateColumns: '78px 1fr 84px 62px', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}
            >
              <span style={{ fontSize: 12.5 }}>{x.venue}</span>
              <div style={{ position: 'relative', height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }}>
                {x.price != null && (
                  <motion.div
                    animate={{ left: `${pos * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    style={{ position: 'absolute', top: -3, width: 10, height: 10, marginLeft: -5, borderRadius: '50%', background: x.price === max ? 'var(--long)' : x.price === min ? 'var(--short)' : 'var(--violet-2)', boxShadow: '0 0 10px currentColor' }}
                  />
                )}
              </div>
              <span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>
                {x.price != null ? fmtPrice(x.price) : <span className="dim">нет доступа</span>}
              </span>
              <span className={`mono ${(x.change ?? 0) >= 0 ? 'up' : 'down'}`} style={{ fontSize: 11, textAlign: 'right' }}>
                {fmtPct(x.change)}
              </span>
            </motion.div>
          )
        })}
      {q && !live.length && (
        <div className="dim" style={{ fontSize: 12, marginTop: 12 }}>
          Публичные API бирж недоступны из этой сети. Текущий источник: {source === 'sim' ? 'симулятор' : source} · {fmtPrice(price)}
        </div>
      )}
    </Panel>
  )
}
