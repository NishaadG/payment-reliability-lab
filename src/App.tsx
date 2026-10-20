import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { LoadView } from './components/LoadView'
import { Sequence } from './components/Sequence'
import { PauseIcon, PlayIcon, ResetIcon } from './components/icons'
import { Checkout, ConceptCard, LogPanel, OutcomeCard, Options, TimeReadout } from './components/panels'
import { SCENARIOS } from './scenarios'
import type { Opts, World } from './scenarios/types'

const SPEEDS = [0.5, 1, 2, 4]

function useWorldClock(world: World) {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      world.sim.tick(Math.min(now - last, 100))
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [world])
  useSyncExternalStore(world.sim.subscribe, world.sim.getVersion)
}

function Toolbar({ world, onReset }: { world: World; onReset: () => void }) {
  const sim = world.sim
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2">
      {world.canCutNetwork && (
        <button
          onClick={() => sim.setNet(!sim.netUp)}
          aria-pressed={!sim.netUp}
          className={`h-8 rounded-md border px-3 text-[13px] font-medium transition-colors ${
            sim.netUp ? 'border-line-strong hover:border-bad hover:text-bad' : 'border-bad bg-bad text-white'
          }`}
        >
          {sim.netUp ? 'Cut network' : 'Restore network'}
        </button>
      )}
      <button
        onClick={() => {
          sim.paused = !sim.paused
          sim.touch()
        }}
        className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[13px] font-medium hover:bg-canvas"
      >
        {sim.paused ? <PlayIcon /> : <PauseIcon />}
        {sim.paused ? 'Resume' : 'Pause'}
      </button>
      <div className="flex rounded-md bg-canvas p-0.5" role="group" aria-label="Simulation speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => {
              sim.speed = s
              sim.touch()
            }}
            aria-pressed={sim.speed === s}
            className={`rounded px-2 py-1 font-mono text-xs transition-colors ${
              sim.speed === s ? 'bg-panel text-ink shadow-[0_0_0_1px_var(--color-line-strong)]' : 'text-muted hover:text-ink'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <TimeReadout t={sim.t} />
        <button onClick={onReset} className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[13px] font-medium hover:bg-canvas">
          <ResetIcon />
          Reset
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState(() => (import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('tab') ?? 0) : 0))
  const [optsById, setOptsById] = useState<Record<string, Opts>>(() => Object.fromEntries(SCENARIOS.map((s) => [s.id, s.defaults])))
  const [run, setRun] = useState(0)

  const scenario = SCENARIOS[tab]
  const opts = optsById[scenario.id]
  const world = useMemo(() => scenario.create(opts), [scenario, opts, run])
  useWorldClock(world)

  // dev-only: ?auto=1&ff=<ms> starts the run and fast-forwards it, handy for screenshots
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (import.meta.env.DEV && q.has('auto') && !world.started()) {
      world.start()
      world.sim.tick(Number(q.get('ff') ?? 0))
    }
  }, [world])

  const setOpt = (key: string, v: boolean | string) => setOptsById((m) => ({ ...m, [scenario.id]: { ...m[scenario.id], [key]: v } }))

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line bg-panel px-5 py-2.5">
        <div>
          <h1 className="text-[15px] leading-tight font-semibold">Payment reliability lab</h1>
          <p className="text-xs text-muted">Distributed Computing Systems, FA2 case study 7</p>
        </div>
        <nav className="flex flex-wrap gap-1" aria-label="Scenarios">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setTab(i)}
              aria-current={i === tab}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                i === tab ? 'bg-ink text-white' : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              <span className="mr-1.5 font-mono text-[11px] opacity-60">{i + 1}</span>
              {s.tab}
            </button>
          ))}
        </nav>
        <p className="ml-auto hidden text-xs text-muted xl:block">{scenario.title}</p>
      </header>

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[272px_minmax(0,1fr)_316px]">
        <div className="scroll-thin flex min-h-0 flex-col gap-3 overflow-y-auto">
          <Checkout view={world.checkout()} label={world.startLabel} onPay={world.start} disabled={world.started()} />
          <Options defs={scenario.options} values={opts} onChange={setOpt} />
          <OutcomeCard outcome={world.outcome()} />
        </div>

        <div className="flex min-h-[520px] min-w-0 flex-col gap-3 lg:min-h-0">
          <Toolbar world={world} onReset={() => setRun((r) => r + 1)} />
          {world.view === 'sequence' ? <Sequence sim={world.sim} /> : <LoadView load={world.load!} strategy={String(opts.strategy)} />}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <ConceptCard concept={scenario.concept} />
          <LogPanel world={world} />
        </div>
      </main>
    </div>
  )
}
