import type { OptionDef, Opts } from '../scenarios/types'
import { ResetIcon } from './icons'

function Segment({ def, value, onChange }: { def: OptionDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3" title={def.hint}>
      <span className="text-[15px] font-medium">{def.label}</span>
      <div className="flex rounded-xl bg-line p-1" role="group" aria-label={def.label}>
        {def.choices?.map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            aria-pressed={value === c.value}
            className={`rounded-lg px-4 py-2 text-[15px] font-semibold whitespace-nowrap transition-colors ${
              value === c.value ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Switch({ def, on, onChange }: { def: OptionDef; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} title={def.hint} className="flex items-center gap-3">
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-good' : 'bg-line-strong'}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white transition-all ${on ? 'left-7' : 'left-1'}`} />
      </span>
      <span className="text-[16px] font-semibold">
        {def.label}: <span className={on ? 'text-good' : 'text-bad'}>{on ? 'ON' : 'OFF'}</span>
      </span>
    </button>
  )
}

export function Controls({
  defs,
  values,
  onChange,
  onReset,
}: {
  defs: OptionDef[]
  values: Opts
  onChange: (key: string, v: boolean | string) => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {defs.map((d) =>
        d.kind === 'toggle' ? (
          <Switch key={d.key} def={d} on={values[d.key] === true} onChange={(v) => onChange(d.key, v)} />
        ) : (
          <Segment key={d.key} def={d} value={String(values[d.key])} onChange={(v) => onChange(d.key, v)} />
        ),
      )}
      <button onClick={onReset} className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-panel px-4 text-[14px] font-semibold hover:bg-canvas">
        <ResetIcon />
        Play again
      </button>
    </div>
  )
}
