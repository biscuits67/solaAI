export const fmtPrice = (v: number | null | undefined, d = 2) =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fmtUsd = (v: number | null | undefined, d = 2) =>
  v == null || !isFinite(v) ? '—' : `$${fmtPrice(v, d)}`

export const fmtPct = (v: number | null | undefined, d = 2) =>
  v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`

export const fmtSigned = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

export const fmtCompact = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(2)
}

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}с`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}м ${s % 60}с`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч ${m % 60}м`
  return `${Math.floor(h / 24)}д ${h % 24}ч`
}

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
