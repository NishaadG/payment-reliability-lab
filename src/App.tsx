import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Controls } from './components/Controls'
import { Crowd } from './components/Crowd'
import { Drawer } from './components/Drawer'
import { Guide } from './components/Guide'
import { Chart, Legend } from './components/LoadView'
import { OutcomeBanner } from './components/OutcomeBanner'
import { Phone } from './components/Phone'
import { Stage } from './components/Stage'
import { ChevronIcon } from './components/icons'
import { SCENARIOS } from './scenarios'
import type { Opts, World } from './scenarios/types'

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

export default function App() {
  const [tab, setTab] = useState(() => (import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('tab') ?? 0) : 0))
  const [optsById, setOptsById] = useState<Record<string, Opts>>(() => Object.fromEntries(SCENARIOS.map((s) => [s.id, s.defaults])))
  const [run, setRun] = useState(0)
  const [drawer, setDrawer] = useState(false)

  const scenario = SCENARIOS[tab]
  const opts = optsById[scenario.id]
  const world = useMemo(() => scenario.create(opts), [scenario, opts, run])
  useWorldClock(world)

  // changing an option or pressing restart replays the run straight away, so the effect of the change is visible
  const replay = useRef(false)
  useEffect(() => {
    if (replay.current && !world.started()) world.start()
    replay.current = false
  }, [world])

  // dev-only: ?auto=1&ff=<ms> starts the run and fast-forwards it, handy for screenshots
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (import.meta.env.DEV && q.has('auto') && !world.started()) {
      world.start()
      world.sim.tick(Number(q.get('ff') ?? 0))
    }
  }, [world])

  const go = useCallback((d: number) => setTab((t) => Math.min(SCENARIOS.length - 1, Math.max(0, t + d))), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const setOpt = (key: string, v: boolean | string) => {
    replay.current = world.started()
    setOptsById((m) => ({ ...m, [scenario.id]: { ...m[scenario.id], [key]: v } }))
  }
  const outcome = world.outcome()

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-3 px-6 pt-3 pb-4">
      <header className="flex items-center gap-6">
        <div className="text-[13px] font-semibold tracking-tight">Payment reliability lab</div>
        <nav className="mx-auto flex items-center gap-3" aria-label="Scenarios">
          <button
            onClick={() => go(-1)}
            disabled={tab === 0}
            aria-label="Previous scenario"
            className="grid size-8 place-items-center rounded-full border border-line-strong bg-panel hover:bg-canvas disabled:opacity-30"
          >
            <ChevronIcon dir="left" />
          </button>
          <div className="flex items-center gap-1.5">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setTab(i)}
                aria-label={s.tab}
                aria-current={i === tab}
                className={`h-2.5 rounded-full transition-all ${i === tab ? 'w-8 bg-ink' : 'w-2.5 bg-line-strong hover:bg-faint'}`}
              />
            ))}
          </div>
          <span className="w-40 text-[13px] font-medium">
            <span className="font-mono text-muted">
              {tab + 1}/{SCENARIOS.length}
            </span>{' '}
            {scenario.tab}
          </span>
          <button
            onClick={() => go(1)}
            disabled={tab === SCENARIOS.length - 1}
            aria-label="Next scenario"
            className="grid size-8 place-items-center rounded-full border border-line-strong bg-panel hover:bg-canvas disabled:opacity-30"
          >
            <ChevronIcon />
          </button>
        </nav>
        <button onClick={() => setDrawer(true)} className="h-8 rounded-lg border border-line-strong bg-panel px-3 text-[13px] font-medium hover:bg-canvas">
          Details
        </button>
      </header>

      <h1 key={scenario.id} className="text-[clamp(22px,4vh,38px)] leading-tight font-semibold tracking-tight">
        {scenario.headline}
      </h1>

      <Guide world={world} tone={outcome.tone} />

      <main className="flex min-h-0 flex-1 gap-5">
        <div className="flex w-[30%] min-w-[220px] flex-col">{world.view === 'sequence' ? <Phone world={world} /> : <Crowd world={world} />}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          {world.view === 'sequence' ? (
            <Stage world={world} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center rounded-2xl border border-line bg-panel p-4">
              <Chart load={world.load!} />
              <Legend />
            </div>
          )}
        </div>
      </main>

      <OutcomeBanner outcome={outcome} />
      <Controls world={world} defs={scenario.options} values={opts} onChange={setOpt} onReset={() => {
          replay.current = world.started()
          setRun((r) => r + 1)
        }} />

      <Drawer open={drawer} onClose={() => setDrawer(false)} scenario={scenario} world={world} outcome={outcome} strategy={String(opts.strategy)} />
    </div>
  )
}
