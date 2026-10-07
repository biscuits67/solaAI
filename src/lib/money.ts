/** One money format everywhere: `$` first, en-US grouping, real minus sign. */
export function money(v: number | null | undefined, opts: { sign?: boolean; d?: number } = {}) {
  if (v == null || !isFinite(v)) return '—'
  const d = opts.d ?? 2
  const a = Math.abs(v) < 0.005 ? 0 : v
  const body = `$${Math.abs(a).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
  if (a < 0) return `−${body}`
  return opts.sign && a > 0 ? `+${body}` : body
}

export function pct(v: number | null | undefined, d = 2) {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v) < 0.005 ? 0 : v
  return `${a > 0 ? '+' : a < 0 ? '−' : ''}${Math.abs(a).toFixed(d)}%`
}

/** Colour class for a value: zero is always neutral, never "profit". */
export const tone = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.005 ? 'flat' : v > 0 ? 'up' : 'down')
