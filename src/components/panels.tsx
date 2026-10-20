import { useEffect, useRef } from 'react'
import { fmtTime } from '../engine/sim'
import type { Tone } from '../engine/sim'
import type { CheckoutView, Concept, OptionDef, Opts, Outcome, World } from '../scenarios/types'
import { AlertIcon, CheckIcon, CrossIcon, DotIcon, SpinnerIcon } from './icons'

export function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {title && <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>}
      {children}
    </section>
  )
}

export function Checkout({ view, label, onPay, disabled }: { view: CheckoutView; label: string; onPay: () => void; disabled: boolean }) {
  const tone =
    view.status === 'success' ? 'text-good' : view.status === 'failed' ? 'text-bad' : 'text-muted'
  return (
    <Panel title="Checkout">
      <div className="px-4 py-4">
        <div className="text-xs text-muted">{view.heading}</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="font-medium">{view.item}</div>
          <div className="font-mono text-lg font-medium tabular-nums">{view.amount}</div>
        </div>
        <button
          onClick={onPay}
          disabled={disabled}
          className="mt-4 h-10 w-full rounded-md bg-ink text-sm font-medium text-white transition-colors hover:bg-black disabled:bg-line-strong disabled:text-muted"
        >
          {label}
        </button>
        <div className={`mt-3 flex min-h-5 items-start gap-2 text-[13px] ${tone}`} aria-live="polite">
          {view.status === 'processing' && <SpinnerIcon className="mt-0.5 shrink-0" />}
          {view.status === 'success' && <CheckIcon className="mt-0.5 shrink-0" />}
          {view.status === 'failed' && <CrossIcon className="mt-0.5 shrink-0" />}
          <span>{view.message}</span>
        </div>
      </div>
    </Panel>
  )
}

export function Options({ defs, values, onChange }: { defs: OptionDef[]; values: Opts; onChange: (key: string, v: boolean | string) => void }) {
  if (!defs.length) return null
  return (
    <Panel title="Scenario">
      <div className="divide-y divide-line">
        {defs.map((d) => (
          <div key={d.key} className="px-4 py-3">
            {d.kind === 'toggle' ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium">{d.label}</span>
                <button
                  role="switch"
                  aria-checked={values[d.key] === true}
                  onClick={() => onChange(d.key, values[d.key] !== true)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${values[d.key] === true ? 'bg-ink' : 'bg-line-strong'}`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${values[d.key] === true ? 'left-[18px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
            ) : (
              <>
                <div className="mb-2 text-[13px] font-medium">{d.label}</div>
                <div className="flex flex-wrap gap-1 rounded-md bg-canvas p-0.5">
                  {d.choices?.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => onChange(d.key, c.value)}
                      aria-pressed={values[d.key] === c.value}
                      className={`flex-1 rounded px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                        values[d.key] === c.value ? 'bg-panel text-ink shadow-[0_0_0_1px_var(--color-line-strong)]' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {d.hint && <p className="mt-1.5 text-xs leading-snug text-muted">{d.hint}</p>}
          </div>
        ))}
      </div>
    </Panel>
  )
}

const OUTCOME_STYLE: Record<Outcome['tone'], { bar: string; bg: string; text: string }> = {
  neutral: { bar: 'bg-line-strong', bg: 'bg-panel', text: 'text-ink' },
  good: { bar: 'bg-good', bg: 'bg-good-bg', text: 'text-good' },
  bad: { bar: 'bg-bad', bg: 'bg-bad-bg', text: 'text-bad' },
  warn: { bar: 'bg-warn', bg: 'bg-warn-bg', text: 'text-warn' },
}

export function OutcomeCard({ outcome }: { outcome: Outcome }) {
  const s = OUTCOME_STYLE[outcome.tone]
  const Icon = outcome.tone === 'good' ? CheckIcon : outcome.tone === 'bad' ? CrossIcon : outcome.tone === 'warn' ? AlertIcon : DotIcon
  return (
    <section className={`relative overflow-hidden rounded-lg border border-line ${s.bg}`} aria-live="polite">
      <div className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} />
      <div className="py-3 pr-4 pl-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Outcome</div>
        <div className={`mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold ${s.text}`}>
          <Icon className="shrink-0" />
          {outcome.title}
        </div>
        <p className="mt-1 text-xs leading-snug text-muted">{outcome.detail}</p>
      </div>
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
