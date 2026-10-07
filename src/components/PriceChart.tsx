import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Candle } from '../data/types'
import { bollinger, ema, rsi } from '../lib/indicators'
import type { Signal } from '../lib/ai'
import type { Position } from '../store/trading'

export interface Overlays {
  ema: boolean
  bb: boolean
  forecast: boolean
  levels: boolean
  markers: boolean
  score: boolean
  rsi: boolean
  positions: boolean
}

export const DEFAULT_OVERLAYS: Overlays = {
  ema: true,
  bb: false,
  forecast: true,
  levels: true,
  markers: true,
  score: true,
  rsi: false,
  positions: true,
}

const TZ = -new Date().getTimezoneOffset() * 60
const T = (s: number) => (s + TZ) as UTCTimestamp

const C = {
  long: '#2ff3b3',
  short: '#ff4f80',
  violet: '#9d6bff',
  violet2: '#c4a6ff',
  cyan: '#52c8ff',
  amber: '#ffbe55',
  ink3: 'rgba(232,230,255,0.42)',
}

interface Props {
  candles: Candle[]
  signal: Signal | null
  overlays: Overlays
  positions?: Position[]
  height?: number | string
  tradeMarkers?: SeriesMarker<Time>[]
  equity?: { time: number; value: number }[]
}

export function PriceChart({ candles, signal, overlays, positions = [], tradeMarkers, equity }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const legend = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const s = useRef<Record<string, ISeriesApi<any>>>({})
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const plines = useRef<IPriceLine[]>([])
  const first = useRef<number>(0)
  const count = useRef(0)
  const [ready, setReady] = useState(0)

  const paneKey = `${overlays.score}-${overlays.rsi}-${!!equity}`

  /* build chart (re-built only when the pane layout changes) */
  useEffect(() => {
    const c = createChart(el.current!, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: C.ink3,
        fontFamily: '"JetBrains Mono Variable", monospace',
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: 'rgba(255,255,255,0.06)', separatorHoverColor: 'rgba(157,107,255,0.25)', enableResize: true },
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.025)' },
        horzLines: { color: 'rgba(255,255,255,0.035)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(196,166,255,0.35)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#2a2147' },
        horzLine: { color: 'rgba(196,166,255,0.35)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#2a2147' },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.18 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
      handleScale: { axisPressedMouseMove: true },
      localization: { locale: 'ru-RU' },
    })
    chart.current = c
    const ser: Record<string, ISeriesApi<any>> = {}
    ser.candle = c.addSeries(CandlestickSeries, {
      upColor: C.long,
      downColor: C.short,
      wickUpColor: 'rgba(47,243,179,0.7)',
      wickDownColor: 'rgba(255,79,128,0.7)',
      borderVisible: false,
      priceLineColor: 'rgba(196,166,255,0.6)',
      priceLineStyle: LineStyle.Dotted,
    })
    ser.vol = c.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
    const line = (color: string, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid) =>
      c.addSeries(LineSeries, {
        color,
        lineWidth: width,
        lineStyle: style,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      })
    ser.e21 = line(C.violet2, 2)
    ser.e50 = line(C.cyan, 2)
    ser.bbU = line('rgba(255,190,85,0.55)', 1, LineStyle.Dotted)
    ser.bbL = line('rgba(255,190,85,0.55)', 1, LineStyle.Dotted)
    ser.bbM = line('rgba(255,190,85,0.25)', 1, LineStyle.Dashed)
    ser.fU = line('rgba(157,107,255,0.5)', 1, LineStyle.Dashed)
    ser.fL = line('rgba(157,107,255,0.5)', 1, LineStyle.Dashed)
    ser.fM = c.addSeries(LineSeries, {
      color: '#e6dbff',
      lineWidth: 2,
      lineStyle: LineStyle.LargeDashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: 'AI',
    })
    let pane = 1
    if (equity) {
      ser.eq = c.addSeries(
        AreaSeries,
        {
          lineColor: C.violet2,
          topColor: 'rgba(157,107,255,0.35)',
          bottomColor: 'rgba(157,107,255,0)',
          lineWidth: 2,
          priceLineVisible: false,
        },
        pane++,
      )
    }
    if (overlays.score) {
      ser.score = c.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: true, title: 'AI score' }, pane++)
    }
    if (overlays.rsi) {
      ser.rsi = c.addSeries(LineSeries, { color: C.amber, lineWidth: 1, priceLineVisible: false, title: 'RSI' }, pane++)
      ser.rsi.createPriceLine({ price: 70, color: 'rgba(255,79,128,0.4)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false })
      ser.rsi.createPriceLine({ price: 30, color: 'rgba(47,243,179,0.4)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false })
    }
    const panes = c.panes()
    for (let i = 1; i < panes.length; i++) panes[i].setHeight(equity && i === 1 ? 150 : 90)

    markers.current = createSeriesMarkers(ser.candle, [])
    s.current = ser
    count.current = 0
    first.current = 0

    c.subscribeCrosshairMove((p) => {
      const lg = legend.current
      if (!lg) return
      const d = p.seriesData.get(ser.candle) as any
      if (!d) {
        lg.dataset.hover = ''
        return
      }
      const ch = ((d.close - d.open) / d.open) * 100
      lg.dataset.hover = '1'
      lg.innerHTML = `<span>O <b>${d.open.toFixed(2)}</b></span><span>H <b>${d.high.toFixed(2)}</b></span><span>L <b>${d.low.toFixed(2)}</b></span><span>C <b style="color:${ch >= 0 ? C.long : C.short}">${d.close.toFixed(2)}</b></span><span style="color:${ch >= 0 ? C.long : C.short}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span>`
    })
    setReady((r) => r + 1)
    return () => {
      c.remove()
      chart.current = null
    }
  }, [paneKey])

  const ind = useMemo(() => {
    const close = candles.map((c) => c.close)
    return { e21: ema(close, 21), e50: ema(close, 50), bb: bollinger(close), r: rsi(close) }
  }, [candles.length, candles[0]?.time, Math.floor((candles.at(-1)?.close ?? 0) * 100)])

  /* candles + indicators */
  useEffect(() => {
    const ser = s.current
    if (!chart.current || !candles.length) return
    const toLine = (arr: (number | null)[]) =>
      arr.map((v, i) => (v == null ? { time: T(candles[i].time) } : { time: T(candles[i].time), value: v }))
    const volBar = (c: Candle) => ({
      time: T(c.time),
      value: c.volume,
      color: c.close >= c.open ? 'rgba(47,243,179,0.22)' : 'rgba(255,79,128,0.22)',
    })
    const reset = candles[0].time !== first.current || Math.abs(candles.length - count.current) > 1
    if (reset) {
      ser.candle.setData(candles.map((c) => ({ ...c, time: T(c.time) })))
      ser.vol.setData(candles.map(volBar))
      ser.e21.setData(toLine(ind.e21))
      ser.e50.setData(toLine(ind.e50))
      ser.bbU.setData(toLine(ind.bb.upper))
      ser.bbL.setData(toLine(ind.bb.lower))
      ser.bbM.setData(toLine(ind.bb.mid))
      ser.rsi?.setData(toLine(ind.r))
      if (!first.current) chart.current.timeScale().scrollToRealTime()
    } else {
      const last = candles.at(-1)!
      const i = candles.length - 1
      ser.candle.update({ ...last, time: T(last.time) })
      ser.vol.update(volBar(last))
      const up = (k: string, v: number | null) => v != null && ser[k]?.update({ time: T(last.time), value: v })
      up('e21', ind.e21[i])
      up('e50', ind.e50[i])
      up('bbU', ind.bb.upper[i])
      up('bbL', ind.bb.lower[i])
      up('bbM', ind.bb.mid[i])
      up('rsi', ind.r[i])
    }
    first.current = candles[0].time
    count.current = candles.length
  }, [candles, ind, ready])

  /* AI layers */
  useEffect(() => {
    const ser = s.current
    if (!chart.current || !signal || !candles.length) return
    const fc = signal.forecast
    ser.fM.setData(fc.map((p) => ({ time: T(p.time), value: p.value })))
    ser.fU.setData(fc.map((p) => ({ time: T(p.time), value: p.upper })))
    ser.fL.setData(fc.map((p) => ({ time: T(p.time), value: p.lower })))
    if (ser.score) {
      ser.score.setData(
        signal.history.map((v, i) => ({
          time: T(candles[i]?.time ?? 0),
          value: v,
          color: v >= 0 ? `rgba(47,243,179,${0.15 + Math.min(Math.abs(v) / 100, 1) * 0.75})` : `rgba(255,79,128,${0.15 + Math.min(Math.abs(v) / 100, 1) * 0.75})`,
        })).filter((d) => d.time > TZ),
      )
    }
  }, [signal, ready])

  /* markers + levels + positions */
  useEffect(() => {
    const ser = s.current
    if (!chart.current) return
    const mk: SeriesMarker<Time>[] = []
    if (signal && overlays.markers && !tradeMarkers) {
      let last = -99
      const h = signal.history
      for (let i = 51; i < h.length; i++) {
        if (i - last < 6) continue
        if (h[i] > 40 && h[i - 1] <= 40) {
          mk.push({ time: T(candles[i].time), position: 'belowBar', shape: 'arrowUp', color: C.long, text: 'AI', size: 1 })
          last = i
        } else if (h[i] < -40 && h[i - 1] >= -40) {
          mk.push({ time: T(candles[i].time), position: 'aboveBar', shape: 'arrowDown', color: C.short, text: 'AI', size: 1 })
          last = i
        }
      }
    }
    markers.current?.setMarkers(tradeMarkers ?? mk)

    for (const pl of plines.current) ser.candle.removePriceLine(pl)
    plines.current = []
    if (signal && overlays.levels) {
      for (const l of signal.support)
        plines.current.push(
          ser.candle.createPriceLine({ price: l.price, color: 'rgba(47,243,179,0.45)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: `S·${l.touches}` }),
        )
      for (const l of signal.resistance)
        plines.current.push(
          ser.candle.createPriceLine({ price: l.price, color: 'rgba(255,79,128,0.45)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: `R·${l.touches}` }),
        )
    }
    if (overlays.positions)
      for (const p of positions) {
        const col = p.side === 'long' ? C.long : C.short
        plines.current.push(ser.candle.createPriceLine({ price: p.entry, color: col, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: p.side === 'long' ? 'LONG' : 'SHORT' }))
        if (p.sl) plines.current.push(ser.candle.createPriceLine({ price: p.sl, color: 'rgba(255,79,128,0.8)', lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: 'SL' }))
        if (p.tp) plines.current.push(ser.candle.createPriceLine({ price: p.tp, color: 'rgba(47,243,179,0.8)', lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: 'TP' }))
      }
  }, [signal?.history.length, signal?.support[0]?.price, signal?.resistance[0]?.price, overlays.markers, overlays.levels, overlays.positions, positions, tradeMarkers, ready])

  /* equity pane (backtest) */
  useEffect(() => {
    if (equity && s.current.eq) s.current.eq.setData(equity.map((p) => ({ time: T(p.time), value: p.value })))
  }, [equity, ready])

  /* visibility toggles */
  useEffect(() => {
    const ser = s.current
    if (!chart.current) return
    for (const k of ['e21', 'e50']) ser[k].applyOptions({ visible: overlays.ema })
    for (const k of ['bbU', 'bbL', 'bbM']) ser[k].applyOptions({ visible: overlays.bb })
    for (const k of ['fU', 'fL', 'fM']) ser[k].applyOptions({ visible: overlays.forecast })
  }, [overlays, ready])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={legend} className="chart-legend" />
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
