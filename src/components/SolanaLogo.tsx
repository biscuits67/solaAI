/** Solana mark built from three CSS parallelograms (no image / SVG assets). */
export function SolanaLogo({ size = 34, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <span className={`sol-logo ${tile ? 'tile' : ''}`} style={{ width: size, height: size }}>
      <span className="sol-bars">
        <i className="b1" />
        <i className="b2" />
        <i className="b3" />
      </span>
    </span>
  )
}
