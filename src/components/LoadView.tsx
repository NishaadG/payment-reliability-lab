import { fmtTime } from '../engine/sim'
import { compareBackoff } from '../scenarios/backoff'
import type { LoadData } from '../scenarios/types'

const CW = 720
const CH = 250
const ML = 38
const MB = 26
const MT = 14

export function Chart({ load }: { load: LoadData }) {
  const windows = Math.max(14, load.buckets.length + 1)
  const peak = Math.max(20, ...load.buckets.map((b) => b.served + b.rejected + b.refused))
  const bw = (CW - ML - 8) / windows
  const y = (v: number) => CH - MB - (v / peak) * (CH - MB - MT)
  const outageW = (load.outageEnd / load.windowMs) * bw

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" role="img" aria-label="Requests arriving at the payment API per half-second window">
      <rect x={ML} y={MT} width={outageW} height={CH - MB - MT} fill="var(--color-line)" opacity={0.55} />

      {[0, 5, 10, 15, 20, 25, 30].filter((v) => v <= peak).map((v) => (
        <g key={v}>
          <line x1={ML} x2={CW - 8} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={0.7} />
          <text x={ML - 6} y={y(v) + 3} textAnchor="end" fontSize={9.5} className="font-mono" fill="var(--color-faint)">
            {v}
          </text>
        </g>
      ))}

      {Array.from({ length: windows }, (_, i) => {
        const b = load.buckets[i]
        const bx = ML + i * bw + bw * 0.14
        const w = bw * 0.72
        const served = b?.served ?? 0
        const rejected = b?.rejected ?? 0
        const refused = b?.refused ?? 0
        return (
          <g key={i}>
            <rect x={bx} y={y(served)} width={w} height={y(0) - y(served)} fill="var(--color-good)" />
            <rect x={bx} y={y(served + rejected)} width={w} height={y(served) - y(served + rejected)} fill="var(--color-bad)" />
            <rect x={bx} y={y(served + rejected + refused)} width={w} height={y(served + rejected) - y(served + rejected + refused)} fill="var(--color-faint)" />
            {i % 2 === 0 && (
              <text x={ML + i * bw + bw / 2} y={CH - 9} textAnchor="middle" fontSize={9.5} className="font-mono" fill="var(--color-faint)">
                {(i * load.windowMs) / 1000}s
              </text>
            )}
          </g>
        )
      })}

      {Array.from({ length: windows }, (_, i) => {
        const cap = load.buckets[i]?.cap ?? load.capacity
        const x0 = ML + i * bw
        return (
          <line
            key={i}
            x1={x0 + 1}
            x2={x0 + bw - 1}
            y1={y(cap)}
            y2={y(cap)}
            stroke={cap < load.capacity ? 'var(--color-bad)' : 'var(--color-ink)'}
            strokeWidth={1.8}
          />
        )
      })}
            <text x={CW - 10} y={MT + 12} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-muted)">
        bar = requests, tick = capacity this window
      </text>
    </svg>
  )
}

export function Legend() {
  const items = [
    ['var(--color-good)', 'served'],
    ['var(--color-bad)', 'rejected (over capacity)'],
    ['var(--color-faint)', 'refused (API down)'],
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  )
}

export function CompareTable({ strategy }: { strategy: string }) {
  const rows = compareBackoff()
  return (
    <div>
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] text-faint">
          <tr>
            <th className="py-1 font-medium">Strategy</th>
            <th className="px-2 py-1 text-right font-medium">Requests</th>
            <th className="px-2 py-1 text-right font-medium">Wasted</th>
            <th className="py-1 text-right font-medium">Finished</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((r) => (
            <tr key={r.strategy} className={r.strategy === strategy ? 'bg-canvas' : ''}>
              <td className="py-1.5 pl-2 font-sans font-medium">{r.label}</td>
              <td className="px-2 py-1.5 text-right">{r.total}</td>
              <td className="px-2 py-1.5 text-right text-bad">{r.wasted}</td>
              <td className="py-1.5 pr-2 text-right">{fmtTime(r.doneAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] leading-snug text-faint">All three run on the same random seed, so the rows are directly comparable.</p>
    </div>
  )
}
