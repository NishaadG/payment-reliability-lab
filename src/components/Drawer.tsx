import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { fmtTime } from '../engine/sim'
import type { Outcome, ScenarioDef, World } from '../scenarios/types'
import { CompareTable } from './LoadView'
import { Sequence } from './Sequence'
import { ConceptCard, LogPanel } from './panels'
import { CrossIcon } from './icons'

type TabId = 'about' | 'log' | 'timeline' | 'compare'

export function Drawer({
  open,
  onClose,
  scenario,
  world,
  outcome,
  strategy,
}: {
  open: boolean
  onClose: () => void
  scenario: ScenarioDef
  world: World
  outcome: Outcome
  strategy: string
}) {
  const [tab, setTab] = useState<TabId>('about')
  const tabs: { id: TabId; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'log', label: 'Event log' },
    world.view === 'sequence' ? { id: 'timeline', label: 'Timeline' } : { id: 'compare', label: 'Compare' },
  ]
  const active = tabs.some((t) => t.id === tab) ? tab : 'about'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-20 bg-ink/15"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            className="fixed top-0 right-0 bottom-0 z-30 flex w-[min(520px,100vw)] flex-col border-l border-line bg-canvas shadow-[-16px_0_40px_-24px_rgba(22,24,29,0.4)]"
            aria-label="Details"
          >
            <div className="flex items-center gap-1 border-b border-line bg-panel px-3 py-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-pressed={active === t.id}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${active === t.id ? 'bg-ink text-white' : 'text-muted hover:bg-canvas hover:text-ink'}`}
                >
                  {t.label}
                </button>
              ))}
              <span className="ml-auto font-mono text-xs text-muted tabular-nums">t = {fmtTime(world.sim.t)}</span>
              <button onClick={onClose} aria-label="Close details" className="grid size-8 place-items-center rounded-md hover:bg-canvas">
                <CrossIcon />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {active === 'about' && (
                <div className="scroll-thin space-y-3 overflow-y-auto">
                  <div className="rounded-lg border border-line bg-panel px-4 py-3">
                    <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">What happened</div>
                    <div className="mt-1 text-[15px] font-semibold">{outcome.title}</div>
                    <p className="mt-1 text-[13px] leading-snug text-muted">{outcome.detail}</p>
                  </div>
                  <ConceptCard concept={scenario.concept} />
                </div>
              )}
              {active === 'log' && <LogPanel world={world} />}
              {active === 'timeline' && <Sequence sim={world.sim} />}
              {active === 'compare' && (
                <div className="rounded-lg border border-line bg-panel px-4 py-3">
                  <CompareTable strategy={strategy} />
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
