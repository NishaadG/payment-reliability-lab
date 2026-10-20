import { useEffect, useRef } from 'react'
import type { Packet, Sim, SimNode, Tone } from '../engine/sim'

const W = 760
const PX = 0.16
const TOP = 12

const CHANNEL_COLOR = {
  req: 'var(--color-req)',
  res: 'var(--color-res)',
  ctl: 'var(--color-ctl)',
}

const TONE_FILL: Record<Tone, string> = {
  info: 'var(--color-muted)',
  ok: 'var(--color-good)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  fault: 'var(--color-bad)',
}

function NodeCard({ node, onCrash, onRecover }: { node: SimNode; onCrash: () => void; onRecover: () => void }) {
  return (
    <div className={`rounded-md border px-2.5 py-2 ${node.up ? 'border-line bg-panel' : 'border-bad/40 bg-bad-bg'}`}>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold leading-tight">{node.name}</div>
        <div className="truncate text-[11px] text-muted">{node.role}</div>
      </div>
      <dl className="mt-1.5 space-y-0.5 font-mono text-[11px]">
        {node.chips().map((c) => (
          <div key={c.label} className="flex justify-between gap-2">
            <dt className="text-faint">{c.label}</dt>
            <dd
              className={`truncate font-medium ${
                c.tone === 'ok' ? 'text-good' : c.tone === 'warn' ? 'text-warn' : c.tone === 'bad' ? 'text-bad' : 'text-ink'
              }`}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
      <button
        onClick={node.up ? onCrash : onRecover}
        className={`mt-2 w-full rounded border py-0.5 text-[11px] font-medium transition-colors ${
          node.up ? 'border-line-strong text-muted hover:border-bad hover:text-bad' : 'border-good text-good hover:bg-good-bg'
        }`}
      >
        {node.up ? 'Crash' : 'Restart'}
      </button>
    </div>
  )
}

function Arrow({ p, x, y, t }: { p: Packet; x: (id: string) => number; y: (t: number) => number; t: number }) {
  const span = Math.max(1, p.arriveAt - p.sentAt)
  const lost = p.status === 'lost'
  const frac = lost ? Math.min(1, ((p.lostAt ?? t) - p.sentAt) / span) : Math.min(1, Math.max(0, (t - p.sentAt) / span))
  const x1 = x(p.from)
  const y1 = y(p.sentAt)
  const x2 = x1 + (x(p.to) - x1) * frac
  const y2 = y(p.sentAt + span * frac)
  const color = lost ? 'var(--color-bad)' : CHANNEL_COLOR[p.channel]
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g>
      <title>{`${p.label}  ${p.from} -> ${p.to}${p.sub ? `  (${p.sub})` : ''}${lost ? '  LOST' : ''}`}</title>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={1.6}
        strokeDasharray={lost ? '4 3' : undefined}
        markerEnd={lost ? undefined : 'url(#head)'}
        style={{ color }}
      />
      {lost && (
        <path d={`M${x2 - 4} ${y2 - 4}l8 8M${x2 + 4} ${y2 - 4}l-8 8`} stroke="var(--color-bad)" strokeWidth={2} strokeLinecap="round" />
      )}
      {y2 - y1 > 10 && (
        <text x={mx} y={my - 3} textAnchor="middle" className="halo font-mono" fontSize={10.5} fontWeight={500} fill={color}>
          {p.label}
        </text>
      )}
    </g>
  )
}

export function Sequence({ sim }: { sim: Sim }) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const ids = sim.order
  const n = ids.length
  const x = (id: string) => (W * (ids.indexOf(id) + 0.5)) / n
  const y = (t: number) => TOP + t * PX
  const height = Math.max(340, y(sim.t) + 70)

  useEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  })

  // down intervals per node, derived from crash / restart marks
  const down: { node: string; from: number; to: number }[] = []
  for (const id of ids) {
    let from: number | null = null
    for (const m of sim.marks) {
      if (m.node !== id) continue
      if (m.kind === 'crash') from = m.t
      else if (m.kind === 'recover' && from !== null) {
        down.push({ node: id, from, to: m.t })
        from = null
      }
    }
    if (from !== null) down.push({ node: id, from, to: sim.t })
  }

  const seconds = Math.ceil((height - TOP) / PX / 1000)

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
      className="scroll-thin relative min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-panel"
    >
      <div className="sticky top-0 z-10 border-b border-line bg-panel/95 backdrop-blur-[2px]">
        <div className="grid gap-2 p-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {ids.map((id) => {
            const node = sim.nodes.get(id)!
            return (
              <NodeCard
                key={id}
                node={node}
                onCrash={() => {
                  sim.crash(id)
                }}
                onRecover={() => {
                  sim.recover(id)
                }}
              />
            )
          })}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Message sequence diagram">
        <defs>
          <marker id="head" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M1 1.5L9 5L1 8.5z" fill="context-stroke" />
          </marker>
        </defs>

        {Array.from({ length: seconds + 1 }, (_, s) => (
          <g key={s}>
            <line x1={0} x2={W} y1={y(s * 1000)} y2={y(s * 1000)} stroke="var(--color-line)" strokeWidth={0.6} />
            <text x={5} y={y(s * 1000) - 3} fontSize={9.5} className="font-mono" fill="var(--color-faint)">
              {s}s
            </text>
          </g>
        ))}

        {sim.bands.map((b, i) => {
          const y1 = y(b.from)
          const y2 = y(b.to ?? sim.t)
          return (
            <g key={i}>
              <rect x={0} y={y1} width={W} height={Math.max(2, y2 - y1)} fill="var(--color-bad)" opacity={0.07} />
              <text x={W - 6} y={y1 + 12} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-bad)">
                {b.label}
              </text>
            </g>
          )
        })}

        {ids.map((id) => (
          <line key={id} x1={x(id)} x2={x(id)} y1={0} y2={height} stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="3 4" />
        ))}

        {down.map((d, i) => (
          <rect key={i} x={x(d.node) - 3} y={y(d.from)} width={6} height={Math.max(2, y(d.to) - y(d.from))} rx={1.5} fill="var(--color-bad)" opacity={0.85} />
        ))}

        {sim.packets.map((p) => (
          <Arrow key={p.id} p={p} x={x} y={y} t={sim.t} />
        ))}

        {sim.marks.map((m) => {
          const cx = x(m.node)
          const right = ids.indexOf(m.node) === n - 1
          const color = m.kind === 'crash' ? 'var(--color-bad)' : m.kind === 'recover' ? 'var(--color-good)' : 'var(--color-warn)'
          return (
            <g key={m.id}>
              <circle cx={cx} cy={y(m.t)} r={4} fill={m.kind === 'timeout' ? 'var(--color-panel)' : color} stroke={color} strokeWidth={1.6} />
              <text x={right ? cx + 9 : cx - 9} y={y(m.t) + 3.5} textAnchor={right ? 'start' : 'end'} className="halo font-mono" fontSize={10} fontWeight={600} fill={color}>
                {m.label}
              </text>
            </g>
          )
        })}

        {sim.notes.map((m) => {
          const cx = x(m.node)
          const right = ids.indexOf(m.node) < n - 1
          return (
            <text
              key={m.id}
              x={right ? cx + 9 : cx - 9}
              y={y(m.t) + 15}
              textAnchor={right ? 'start' : 'end'}
              className="halo font-mono"
              fontSize={10}
              fontWeight={600}
              fill={TONE_FILL[m.tone]}
            >
              {m.text}
            </text>
          )
        })}

        <line x1={0} x2={W} y1={y(sim.t)} y2={y(sim.t)} stroke="var(--color-ink)" strokeWidth={0.8} opacity={0.35} />
      </svg>
    </div>
  )
}
