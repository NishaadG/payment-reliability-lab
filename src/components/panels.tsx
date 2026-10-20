import { useEffect, useRef } from 'react'
import { fmtTime } from '../engine/sim'
import type { Tone } from '../engine/sim'
import type { Concept, World } from '../scenarios/types'

export function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {title && <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>}
      {children}
    </section>
  )
}

export function ConceptCard({ concept }: { concept: Concept }) {
  return (
    <Panel title="Concept">
      <div className="px-4 py-3">
        <h3 className="text-[15px] font-semibold leading-snug">{concept.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{concept.body}</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-snug">
          {concept.points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-faint" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {concept.syllabus.map((s) => (
            <span key={s} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
              {s}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  )
}

const TONE_TEXT: Record<Tone, string> = {
  info: 'text-ink',
  ok: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  fault: 'text-bad italic',
}

export function LogPanel({ world }: { world: World }) {
  const sim = world.sim
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  })

  const name = (id: string) => (id === 'network' ? 'Network' : (sim.nodes.get(id)?.name ?? id))

  return (
    <Panel title="Event log" className="flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        className="scroll-thin min-h-40 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed"
      >
        {sim.logs.length === 0 && <div className="py-6 text-center font-sans text-xs text-faint">Nothing has happened yet.</div>}
        {sim.logs.map((l) => (
          <div key={l.id} className="grid grid-cols-[46px_1fr] gap-x-2 py-0.5">
            <span className="text-faint tabular-nums">{(l.t / 1000).toFixed(2)}</span>
            <span className={TONE_TEXT[l.tone]}>
              <span className="font-semibold text-muted">{name(l.node)}</span> {l.text}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function TimeReadout({ t }: { t: number }) {
  return <span className="font-mono text-xs text-muted tabular-nums">t = {fmtTime(t)}</span>
}
