import { AnimatePresence, motion } from 'framer-motion'
import type { World } from '../scenarios/types'
import { CheckIcon, CrossIcon, SpinnerIcon } from './icons'

function Badge({ kind }: { kind: 'success' | 'failed' }) {
  const good = kind === 'success'
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={`grid size-16 place-items-center rounded-full text-white ${good ? 'bg-good' : 'bg-bad'}`}
    >
      {good ? <CheckIcon className="size-8" /> : <CrossIcon className="size-8" />}
    </motion.div>
  )
}

export function Phone({ world }: { world: World }) {
  const v = world.checkout()
  const started = world.started()
  return (
    <div className="relative min-h-0 flex-1 [container-type:size]">
      <div
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[34px] border-[9px] border-ink bg-panel shadow-[0_24px_48px_-20px_rgba(22,24,29,0.45)]"
        style={{ height: 'min(100cqh, 560px)', aspectRatio: '9 / 17.5', maxWidth: '100cqw' }}
      >
        <div className="mx-auto mt-1.5 h-4 w-20 shrink-0 rounded-full bg-ink" />
        <div className="flex shrink-0 items-center justify-between px-5 pt-1 pb-3 text-[11px] font-semibold text-muted">
          <span>9:41</span>
          <span>Keys &amp; Co.</span>
        </div>

        <div className="mx-4 shrink-0 rounded-xl bg-canvas px-3.5 py-3">
          <div className="text-[11px] text-muted">{v.heading}</div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-[13px] leading-tight font-medium">{v.item}</span>
            <span className="font-mono text-[17px] font-semibold tabular-nums">{v.amount}</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={v.status + (v.status === 'processing' ? v.message : '')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center gap-3"
              aria-live="polite"
            >
              {v.status === 'idle' && <div className="text-[13px] text-faint">Ready to pay</div>}
              {v.status === 'processing' && (
                <>
                  <SpinnerIcon className="size-11 text-ink" />
                  <div className={`text-[14px] font-medium ${v.message.includes('attempt') ? 'text-warn' : 'text-ink'}`}>{v.message}</div>
                </>
              )}
              {v.status === 'success' && (
                <>
                  <Badge kind="success" />
                  <div className="text-[15px] font-semibold text-good">{v.message}</div>
                </>
              )}
              {v.status === 'failed' && (
                <>
                  <Badge kind="failed" />
                  <div className="text-[13px] leading-snug font-medium text-bad">{v.message}</div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <button
            onClick={world.start}
            disabled={started}
            className="nudge h-11 w-full rounded-xl bg-ink text-[14px] font-semibold text-white transition-colors hover:bg-black disabled:bg-line-strong disabled:text-muted"
          >
            {world.startLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
