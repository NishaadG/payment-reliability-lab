import type { OptionDef, Opts, World } from '../scenarios/types'
import { PauseIcon, PlayIcon, ResetIcon } from './icons'

const SPEEDS = [0.5, 1, 2, 4]

function Segment({ def, value, onChange }: { def: OptionDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2" title={def.hint}>
      <span className="text-[12px] font-medium text-muted">{def.label}</span>
      <div className="flex rounded-lg bg-canvas p-0.5" role="group" aria-label={def.label}>
        {def.choices?.map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            aria-pressed={value === c.value}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
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
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} title={def.hint} className="flex items-center gap-2">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-good' : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className="text-[13px] font-medium">{def.label}</span>
    </button>
  )
}

export function Controls({
  world,
  defs,
  values,
  onChange,
  onReset,
}: {
  world: World
  defs: OptionDef[]
  values: Opts
  onChange: (key: string, v: boolean | string) => void
  onReset: () => void
}) {
  const sim = world.sim
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {world.canCutNetwork && (
        <button
          onClick={() => sim.setNet(!sim.netUp)}
          aria-pressed={!sim.netUp}
          className={`h-9 rounded-lg border px-4 text-[13px] font-semibold transition-colors ${
            sim.netUp ? 'border-ink bg-panel hover:bg-ink hover:text-white' : 'border-bad bg-bad text-white'
          }`}
        >
          {sim.netUp ? 'Cut network' : 'Restore network'}
        </button>
      )}

      {defs.map((d) =>
        d.kind === 'toggle' ? (
          <Switch key={d.key} def={d} on={values[d.key] === true} onChange={(v) => onChange(d.key, v)} />
        ) : (
          <Segment key={d.key} def={d} value={String(values[d.key])} onChange={(v) => onChange(d.key, v)} />
        ),
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-lg bg-canvas p-0.5" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                sim.speed = s
                sim.touch()
              }}
              aria-pressed={sim.speed === s}
              className={`rounded-md px-2 py-1 font-mono text-[12px] transition-colors ${sim.speed === s ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
            >
              {s}x
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            sim.paused = !sim.paused
            sim.touch()
          }}
          aria-label={sim.paused ? 'Resume' : 'Pause'}
          className="grid size-9 place-items-center rounded-lg border border-line-strong bg-panel hover:bg-canvas"
        >
          {sim.paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button onClick={onReset} aria-label="Restart" className="grid size-9 place-items-center rounded-lg border border-line-strong bg-panel hover:bg-canvas">
          <ResetIcon />
        </button>
      </div>
    </div>
  )
}
