import { create } from 'zustand'

export type Mode = 'demo' | 'real'
export type Tab = 'terminal' | 'ai' | 'autopilot' | 'backtest' | 'portfolio' | 'guide'
export type ToastKind = 'info' | 'long' | 'short' | 'error'

export interface Toast {
  id: number
  title: string
  body?: string
  kind: ToastKind
}

interface UIState {
  mode: Mode
  tab: Tab
  walletOpen: boolean
  toasts: Toast[]
  setMode: (m: Mode) => void
  setTab: (t: Tab) => void
  setWalletOpen: (v: boolean) => void
  dismiss: (id: number) => void
}

const read = <T extends string>(k: string, d: T): T => {
  try {
    return (localStorage.getItem(k) as T) || d
  } catch {
    return d
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {}
}

export const useUI = create<UIState>((set) => ({
  mode: read<Mode>('sola.mode', 'demo'),
  tab: read<Tab>('sola.tab', 'terminal'),
  walletOpen: false,
  toasts: [],
  setMode: (mode) => {
    write('sola.mode', mode)
    set({ mode })
  },
  setTab: (tab) => {
    write('sola.tab', tab)
    set({ tab })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
  setWalletOpen: (walletOpen) => set({ walletOpen }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

let tid = 0
export function toast(title: string, body?: string, kind: ToastKind = 'info') {
  const id = ++tid
  useUI.setState((s) => ({ toasts: [...s.toasts, { id, title, body, kind }].slice(-4) }))
  setTimeout(() => useUI.getState().dismiss(id), 4200)
}
