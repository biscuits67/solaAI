export type IconName = 'up' | 'down' | 'clock' | 'dots' | 'check' | 'chevron' | 'spark'

/** Minimal CSS-drawn icon set (no image or SVG assets). */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <span className={`ic ic-${name}`} style={{ width: size, height: size }}>
      {name === 'dots' && (
        <>
          <i />
          <i />
          <i />
        </>
      )}
      {name === 'clock' && <i />}
    </span>
  )
}
