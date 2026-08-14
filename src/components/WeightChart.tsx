import { useMemo, useState } from 'react'
import type { WeightEntry } from '@/types/weight'

interface Props {
  entries: WeightEntry[]
}

const W = 340
const H = 180
const PAD_X = 14
const PAD_TOP = 18
const PAD_BOTTOM = 26

export default function WeightChart({ entries }: Props) {
  const [active, setActive] = useState<number | null>(null)

  const { points, labels } = useMemo(() => {
    if (entries.length === 0) {
      return { points: [] as { x: number; y: number }[], labels: [] as string[] }
    }
    const weights = entries.map((e) => e.weight)
    let min = Math.min(...weights)
    let max = Math.max(...weights)
    if (max - min < 1) {
      max += 0.5
      min -= 0.5
    } else {
      const pad = (max - min) * 0.15
      max += pad
      min -= pad
    }
    const innerW = W - PAD_X * 2
    const innerH = H - PAD_TOP - PAD_BOTTOM
    const pts = entries.map((e, i) => ({
      x: entries.length === 1 ? W / 2 : PAD_X + (i / (entries.length - 1)) * innerW,
      y: PAD_TOP + (1 - (e.weight - min) / (max - min)) * innerH,
    }))
    const fmt = (iso: string) => {
      const [, m, d] = iso.split('-')
      return `${Number(m)}/${Number(d)}`
    }
    return { points: pts, labels: entries.map((e) => fmt(e.date)) }
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-white/50">
        还没有数据，点击下方按钮记录第一笔重量
      </div>
    )
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x},${H - PAD_BOTTOM} L${points[0].x},${H - PAD_BOTTOM} Z`
      : ''

  const activeIdx = active !== null && active < entries.length ? active : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerLeave={() => setActive(null)}
        onPointerMove={(ev) => {
          if (points.length === 0) return
          const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((ev.clientX - rect.left) / rect.width) * W
          let best = 0
          let bestDist = Infinity
          points.forEach((p, i) => {
            const d = Math.abs(p.x - px)
            if (d < bestDist) {
              bestDist = d
              best = i
            }
          })
          setActive(best)
        }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="100%" stopColor="#f0abfc" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {[0.25, 0.5, 0.75].map((t) => {
          const y = PAD_TOP + t * (H - PAD_TOP - PAD_BOTTOM)
          return (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="3 5"
            />
          )
        })}

        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={activeIdx === i ? 5 : 3}
            fill={activeIdx === i ? '#fff' : 'rgba(255,255,255,0.85)'}
            stroke={activeIdx === i ? '#7c3aed' : 'none'}
            strokeWidth="2"
          />
        ))}

        {/* x labels: show up to ~6 */}
        {labels.map((lab, i) => {
          const step = Math.ceil(labels.length / 6)
          if (i % step !== 0 && i !== labels.length - 1) return null
          return (
            <text
              key={i}
              x={points[i].x}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.55)"
            >
              {lab}
            </text>
          )
        })}

        {/* 数据点数值标注：点少时全标；点多时只标最高/最低/最新 */}
        {(() => {
          const n = entries.length
          const weights = entries.map((e) => e.weight)
          const minIdx = weights.indexOf(Math.min(...weights))
          const maxIdx = weights.indexOf(Math.max(...weights))
          return points.map((p, i) => {
            const show = n <= 10 || i === minIdx || i === maxIdx || i === n - 1
            if (!show || activeIdx === i) return null
            const anchor = i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'
            return (
              <text
                key={i}
                x={p.x}
                y={p.y - 10}
                textAnchor={anchor}
                fontSize="9"
                fontWeight="600"
                fill="rgba(255,255,255,0.8)"
              >
                {entries[i].weight.toFixed(1)}
              </text>
            )
          })
        })()}
      </svg>

      {activeIdx !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-xs font-semibold leading-tight text-slate-800 shadow-lg backdrop-blur">
          {labels[activeIdx]} · {entries[activeIdx].weight.toFixed(1)} kg
        </div>
      )}
    </div>
  )
}
