import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from './ui'

export type Side = 'long' | 'short'
export type Source = 'manual' | 'bot' | 'copilot'

export interface Position {
  id: string
  side: Side
  entry: number
  size: number // SOL
  margin: number // USDT
  leverage: number
  sl: number | null
  tp: number | null
  liq: number
  openedAt: number
  source: Source
}

export interface LimitOrder {
  id: string
  side: Side
  price: number
  margin: number
  leverage: number
  sl: number | null
  tp: number | null
  createdAt: number
  source: Source
}

export interface ClosedTrade {
  id: string
  side: Side
  entry: number
  exit: number
  size: number
  leverage: number
  pnl: number
  fees: number
  reason: string
  openedAt: number
  closedAt: number
  source: Source
}

export const START_BALANCE = 10_000
const TAKER = 0.0005
const MAKER = 0.0002
const MMR = 0.005

interface OpenArgs {
  side: Side
  margin: number
  leverage: number
  sl?: number | null
  tp?: number | null
  source?: Source
}

interface TradingState {
  balance: number
  positions: Position[]
  orders: LimitOrder[]
  history: ClosedTrade[]
  equityCurve: { t: number; v: number }[]
  lastPrice: number
  openMarket: (a: OpenArgs, price: number) => Position | null
  placeLimit: (a: OpenArgs & { price: number }) => void
  cancelOrder: (id: string) => void
  closePosition: (id: string, price: number, reason?: string) => void
  closeAll: (price: number) => void
  setStops: (id: string, sl: number | null, tp: number | null) => void
  tick: (price: number) => void
  reset: (balance?: number) => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

export const liqPrice = (side: Side, entry: number, lev: number) =>
  side === 'long' ? entry * (1 - 1 / lev + MMR) : entry * (1 + 1 / lev - MMR)

export const upnl = (p: Position, price: number) => (price - p.entry) * p.size * (p.side === 'long' ? 1 : -1)

export function equityOf(s: Pick<TradingState, 'balance' | 'positions' | 'orders'>, price: number) {
  return (
    s.balance +
    s.positions.reduce((a, p) => a + p.margin + upnl(p, price), 0) +
    s.orders.reduce((a, o) => a + o.margin, 0)
  )
}

const sideRu = (s: Side) => (s === 'long' ? 'Long' : 'Short')

export const useTrading = create<TradingState>()(
  persist(
    (set, get) => ({
      balance: START_BALANCE,
      positions: [],
      orders: [],
      history: [],
      equityCurve: [],
      lastPrice: 0,

      openMarket: ({ side, margin, leverage, sl = null, tp = null, source = 'manual' }, price) => {
        const s = get()
        const notional = margin * leverage
        const fee = notional * TAKER
        if (margin <= 0 || !price) return null
        if (margin + fee > s.balance + 1e-9) {
          toast('Insufficient funds', `Need ${(margin + fee).toFixed(2)} USDT`, 'error')
          return null
        }
        const pos: Position = {
          id: uid(),
          side,
          entry: price,
          size: notional / price,
          margin,
          leverage,
          sl,
          tp,
          liq: liqPrice(side, price, leverage),
          openedAt: Date.now(),
          source,
        }
        set({ balance: s.balance - margin - fee, positions: [pos, ...s.positions] })
        toast(
          `${sideRu(side)} opened`,
          `${pos.size.toFixed(3)} SOL at ${price.toFixed(2)} · x${leverage}`,
          side === 'long' ? 'long' : 'short',
        )
        return pos
      },

      placeLimit: ({ side, margin, leverage, price, sl = null, tp = null, source = 'manual' }) => {
        const s = get()
        if (margin > s.balance) {
          toast('Insufficient funds', `Need ${margin.toFixed(2)} USDT`, 'error')
          return
        }
        const o: LimitOrder = { id: uid(), side, price, margin, leverage, sl, tp, createdAt: Date.now(), source }
        set({ balance: s.balance - margin, orders: [o, ...s.orders] })
        toast('Limit order placed', `${sideRu(side)} at ${price.toFixed(2)}`, 'info')
      },

      cancelOrder: (id) => {
        const s = get()
        const o = s.orders.find((x) => x.id === id)
        if (!o) return
        set({ balance: s.balance + o.margin, orders: s.orders.filter((x) => x.id !== id) })
        toast('Order cancelled', `${sideRu(o.side)} at ${o.price.toFixed(2)}`, 'info')
      },

      closePosition: (id, price, reason = 'Manual') => {
        const s = get()
        const p = s.positions.find((x) => x.id === id)
        if (!p) return
        const fee = p.size * price * TAKER
        const gross = reason === 'Liquidation' ? -p.margin : upnl(p, price)
        const pnl = gross - fee
        const back = Math.max(0, p.margin + pnl)
        const tr: ClosedTrade = {
          id: p.id,
          side: p.side,
          entry: p.entry,
          exit: price,
          size: p.size,
          leverage: p.leverage,
          pnl,
          fees: fee + p.size * p.entry * TAKER,
          reason,
          openedAt: p.openedAt,
          closedAt: Date.now(),
          source: p.source,
        }
        set({
          balance: s.balance + back,
          positions: s.positions.filter((x) => x.id !== id),
          history: [tr, ...s.history].slice(0, 300),
        })
        toast(
          `${reason}: ${sideRu(p.side).toLowerCase()} closed`,
          `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`,
          pnl >= 0 ? 'long' : 'short',
        )
      },

      closeAll: (price) => {
        for (const p of get().positions) get().closePosition(p.id, price)
      },

      setStops: (id, sl, tp) =>
        set({ positions: get().positions.map((p) => (p.id === id ? { ...p, sl, tp } : p)) }),

      tick: (price) => {
        if (!price) return
        const s = get()
        // fill limit orders
        for (const o of s.orders) {
          const hit = o.side === 'long' ? price <= o.price : price >= o.price
          if (!hit) continue
          const st = get()
          const notional = o.margin * o.leverage
          const fee = notional * MAKER
          const pos: Position = {
            id: o.id,
            side: o.side,
            entry: o.price,
            size: notional / o.price,
            margin: o.margin,
            leverage: o.leverage,
            sl: o.sl,
            tp: o.tp,
            liq: liqPrice(o.side, o.price, o.leverage),
            openedAt: Date.now(),
            source: o.source,
          }
          set({
            balance: st.balance - fee,
            orders: st.orders.filter((x) => x.id !== o.id),
            positions: [pos, ...st.positions],
          })
          toast('Limit order filled', `${sideRu(o.side)} ${pos.size.toFixed(3)} SOL at ${o.price.toFixed(2)}`, o.side)
        }
        // triggers
        for (const p of get().positions) {
          const long = p.side === 'long'
          if (long ? price <= p.liq : price >= p.liq) get().closePosition(p.id, p.liq, 'Liquidation')
          else if (p.sl != null && (long ? price <= p.sl : price >= p.sl)) get().closePosition(p.id, price, 'Stop loss')
          else if (p.tp != null && (long ? price >= p.tp : price <= p.tp)) get().closePosition(p.id, price, 'Take profit')
        }
        // equity sampling (every 20s)
        const st = get()
        const last = st.equityCurve.at(-1)
        const now = Date.now()
        const patch: Partial<TradingState> = { lastPrice: price }
        if (!last || now - last.t > 20_000)
          patch.equityCurve = [...st.equityCurve, { t: now, v: equityOf(st, price) }].slice(-720)
        set(patch)
      },

      reset: (balance = START_BALANCE) => {
        set({ balance, positions: [], orders: [], history: [], equityCurve: [{ t: Date.now(), v: balance }] })
        toast('Demo account reset', `Balance ${balance.toLocaleString('en-US')} USDT`, 'info')
      },
    }),
    { name: 'sola.demo.v1', partialize: (s) => ({ ...s, lastPrice: 0 }) },
  ),
)
