/** Motion system: a few durations and curves used everywhere. */
export const DUR = { micro: 0.12, ui: 0.2, panel: 0.32, story: 0.6 } as const
export const EASE = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.22, 1, 0.36, 1] as const,
}
export const SPRING = { type: 'spring', stiffness: 420, damping: 36 } as const

/** The staggered blur entrance plays once per visit; later page switches are quick crossfades. */
let introDone = false
export const isIntro = () => !introDone
export function finishIntro() {
  if (!introDone) setTimeout(() => (introDone = true), 1600)
}
