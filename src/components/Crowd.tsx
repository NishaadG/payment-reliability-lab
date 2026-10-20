import { motion } from 'framer-motion'
import type { World } from '../scenarios/types'

export function Crowd({ world }: { world: World }) {
  const load = world.load!
  const paid = load.clients.filter((c) => c.state === 'paid').length
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-line bg-panel p-5">
      <div className="text-center">
        <div className="font-mono text-[clamp(40px,8vh,72px)] leading-none font-semibold tabular-nums">
          {paid}
          <span className="text-faint">/{load.clients.length}</span>
        </div>
        <div className="mt-1.5 text-xs tracking-wide text-muted uppercase">customers paid</div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {load.clients.map((c, i) => (
          <motion.span
            key={i}
            animate={{ scale: c.state === 'trying' ? 1.12 : 1 }}
            transition={{ duration: 0.15 }}
            title={`customer ${i + 1}: ${c.state}, ${c.attempts} attempts`}
            className={`size-8 rounded-full border-[3px] transition-colors duration-200 ${
              c.state === 'paid' ? 'border-good bg-good' : c.state === 'waiting' ? 'border-warn bg-warn-bg' : 'border-ink bg-ink'
            }`}
          />
        ))}
      </div>
      <div className="flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink" />
          sending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-warn bg-warn-bg" />
          waiting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-good" />
          paid
        </span>
      </div>
      <button
        onClick={world.start}
        disabled={world.started()}
        className="nudge h-11 w-full max-w-60 rounded-xl bg-ink text-[14px] font-semibold text-white transition-colors hover:bg-black disabled:bg-line-strong disabled:text-muted"
      >
        {world.startLabel}
      </button>
    </div>
  )
}
