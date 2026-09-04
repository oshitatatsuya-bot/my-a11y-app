const WIDTH = 240
const HEIGHT = 40

/**
 * Sparkline of scan scores over time. The accessible name carries the same
 * information for anyone who cannot see the line.
 */
export function ScoreTrend({
  scores,
  label,
}: {
  scores: number[]
  label: string
}) {
  if (scores.length < 2) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        A trend line appears once this site has been scanned twice.
      </p>
    )
  }

  const step = WIDTH / (scores.length - 1)
  const points = scores
    .map((score, index) => {
      const x = index * step
      const y = HEIGHT - (Math.max(0, Math.min(100, score)) / 100) * HEIGHT
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg
      role="img"
      aria-label={`${label}: ${scores.join(", ")}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mt-3 h-10 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
