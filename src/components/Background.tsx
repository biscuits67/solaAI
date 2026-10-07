import { useMemo } from 'react'

/** Ambient backdrop: drifting light blobs, masked grid and canvas-generated film grain. */
export function Background() {
  const grain = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 160
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(160, 160)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return c.toDataURL('image/png')
  }, [])
  return (
    <div className="backdrop" aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="gridlines" />
      <div className="grain" style={{ backgroundImage: `url(${grain})` }} />
    </div>
  )
}
