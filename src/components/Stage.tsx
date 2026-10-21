import { motion } from 'framer-motion'
import type { Packet } from '../engine/sim'
import type { Layout, World } from '../scenarios/types'
import { NodeIcon } from './icons'

const VW = 1000
const VH = 560
const HW = 122
const HH = 70
const LANE = 17

const COLOR = {
  req: 'var(--color-req)',
  res: 'var(--color-res)',
  ctl: 'var(--color-ctl)',
}
const UNDO = new Set(['RELEASE', 'REFUND', 'CANCEL'])

/** everyday wording for the message pills */
const FRIENDLY: Record<string, string> = {
  'POST /charge': 'Pay',
  DEBIT: 'Take money',
  OK: 'Done',
  FAIL: 'Failed',
  'HTTP 200': 'Paid',
  PREPARE: 'Ready?',
  VOTE_YES: 'Yes',
  VOTE_NO: 'No',
  COMMIT: 'Do it',
  ABORT: 'Cancel',
  ACK: 'Got it',
  WHAT_DECISION: 'What now?',
  RESERVE: 'Reserve stock',
  CHARGE: 'Charge card',
  BOOK: 'Book delivery',
  RELEASE: 'Free stock',
  REFUND: 'Refund',
  CANCEL: 'Cancel delivery',
}

const TONE_TEXT = {
  neutral: 'text-ink',
  ok: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
} as const

const TONE_BORDER = {
  neutral: 'border-line-strong',
  ok: 'border-good',
  warn: 'border-warn',
  bad: 'border-bad',
} as const

function exitFrac(dx: number, dy: number) {
  const a = dx === 0 ? Infinity : HW / Math.abs(dx)
  const b = dy === 0 ? Infinity : HH / Math.abs(dy)
  return Math.min(a, b)
}

/** Segment between two node cards, trimmed to the card edges, optionally pushed into a lane. */
function geom(layout: Layout, from: string, to: string, lane: number) {
  const a = layout.nodes[from]
  const b = layout.nodes[to]
  if (!a || !b) return null
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const u0 = a.hidden ? 0 : exitFrac(dx, dy) + 0.012
  const u1 = 1 - (b.hidden ? 0 : exitFrac(dx, dy) + 0.012)
  const px = (-dy / len) * lane
  const py = (dx / len) * lane
  return {
    x1: a.x + dx * u0 + px,
    y1: a.y + dy * u0 + py,
    x2: a.x + dx * u1 + px,
    y2: a.y + dy * u1 + py,
  }
}

function Pill({ p, layout, t }: { p: Packet; layout: Layout; t: number }) {
  const g = geom(layout, p.from, p.to, LANE)
  if (!g) return null
  const lost = p.status === 'lost'
  const span = Math.max(1, p.arriveAt - p.sentAt)
  const frac = lost ? Math.min(1, ((p.lostAt ?? t) - p.sentAt) / span) : Math.min(1, Math.max(0, (t - p.sentAt) / span))
  const x = g.x1 + (g.x2 - g.x1) * frac
  const y = g.y1 + (g.y2 - g.y1) * frac
  const text = (FRIENDLY[p.label] ?? p.label) + (p.sub ? ' + ID' : '')
  const w = text.length * 7.4 + 22 + (lost ? 16 : 0)
  const color = lost ? 'var(--color-bad)' : UNDO.has(p.label) ? 'var(--color-ink)' : COLOR[p.channel]
  const fade = lost ? Math.max(0, 1 - (t - (p.lostAt ?? t)) / 1600) : 1
  return (
    <g transform={`translate(${x} ${y})`} opacity={fade} style={{ pointerEvents: 'none' }}>
      <rect x={-w / 2} y={-13} width={w} height={26} rx={13} fill={lost ? 'var(--color-panel)' : color} stroke={lost ? color : 'none'} strokeWidth={1.8} />
      <text x={lost ? -8 : 0} y={4.5} textAnchor="middle" fontSize={13} fontWeight={600} className="font-mono" fill={lost ? color : '#fff'}>
        {text}
      </text>
      {lost && <path d={`M${w / 2 - 17} -4l7 7M${w / 2 - 10} -4l-7 7`} stroke={color} strokeWidth={2} strokeLinecap="round" />}
    </g>
  )
}

function Card({ id, world }: { id: string; world: World }) {
  const sim = world.sim
  const spec = world.layout!.nodes[id]
  const node = sim.nodes.get(id)!
  const chips = node.chips()
  const chip = chips.find((c) => c.label === spec.big) ?? chips[0]
  const tone = node.up ? (chip?.tone ?? 'neutral') : 'bad'
  const pulsed = sim.packets.some((p) => p.to === id && p.status === 'delivered' && sim.t - p.arriveAt >= 0 && sim.t - p.arriveAt < 260)
  return (
    <button
      onClick={() => (node.up ? sim.crash(id) : sim.recover(id))}
      aria-label={`${node.name}, ${node.up ? 'running' : 'crashed'}. Click to ${node.up ? 'crash' : 'restart'}.`}
      className={`absolute flex flex-col items-center justify-center rounded-2xl border-2 text-center transition-[transform,border-color,background-color] duration-150 ${TONE_BORDER[tone]} ${
        node.up ? 'bg-panel hover:border-ink' : 'bg-bad-bg'
      }`}
      style={{
        left: `${(spec.x / VW) * 100}%`,
        top: `${(spec.y / VH) * 100}%`,
        width: `${((HW * 2) / VW) * 100}%`,
        height: `${((HH * 2) / VH) * 100}%`,
        transform: `translate(-50%, -50%) scale(${pulsed ? 1.035 : 1})`,
        boxShadow: pulsed ? '0 0 0 5px color-mix(in srgb, var(--color-ink) 8%, transparent)' : 'none',
      }}
    >
      <div className="flex items-center gap-2 text-ink">
        <NodeIcon name={spec.icon} className={node.up ? '' : 'text-bad'} />
        <span className="text-[clamp(14px,1.7vh,19px)] leading-none font-semibold">{node.name}</span>
      </div>
      {node.up ? (
        <>
          <motion.div
            key={chip?.value}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            className={`mt-2 font-mono text-[clamp(20px,3.2vh,32px)] leading-none font-semibold tabular-nums ${TONE_TEXT[tone]}`}
          >
            {chip?.value}
          </motion.div>
          <div className="mt-1.5 text-[11px] tracking-wide text-faint uppercase">{chip?.label}</div>
        </>
      ) : (
        <>
          <div className="mt-2 text-[clamp(18px,2.8vh,28px)] leading-none font-semibold text-bad">Crashed</div>
          <div className="mt-1.5 text-[11px] tracking-wide text-bad/70 uppercase">click to restart</div>
        </>
      )}
    </button>
  )
}

export function Stage({ world }: { world: World }) {
  const sim = world.sim
  const layout = world.layout!
  const live = sim.packets.filter((p) => p.status === 'flight' || (p.status === 'lost' && sim.t - (p.lostAt ?? sim.t) < 1600))

  return (
    <div className="relative min-h-0 flex-1 [container-type:size]">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: `min(100cqw, calc(100cqh * ${VW / VH}))`, aspectRatio: `${VW} / ${VH}` }}
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label="Payment system diagram">
          {layout.links.map(([a, b]) => {
            const g = geom(layout, a, b, 0)
            if (!g) return null
            return sim.netUp ? (
              <line key={a + b} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="var(--color-line)" strokeWidth={LANE * 2 + 4} strokeLinecap="round" />
            ) : (
              <line key={a + b} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="var(--color-bad)" strokeOpacity={0.45} strokeWidth={3} strokeDasharray="7 9" strokeLinecap="round" />
            )
          })}
          {live.map((p) => (
            <Pill key={p.id} p={p} layout={layout} t={sim.t} />
          ))}
        </svg>

        {Object.entries(layout.nodes).map(([id, spec]) => (spec.hidden ? null : <Card key={id} id={id} world={world} />))}

        {!sim.netUp && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-bad px-4 py-1.5 text-[13px] font-semibold tracking-wide text-white uppercase">
            Network down
          </div>
        )}
        <div className="absolute right-1 bottom-0 text-[11px] text-faint">Pills are messages. Click any server to crash it.</div>
      </div>
    </div>
  )
}
