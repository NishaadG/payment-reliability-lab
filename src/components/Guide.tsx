import { motion } from 'framer-motion'
import type { Outcome, World } from '../scenarios/types'

const BAR: Record<Outcome['tone'], string> = {
  neutral: 'border-ink',
  good: 'border-good',
  bad: 'border-bad',
  warn: 'border-warn',
}

/** One plain-English sentence about what is happening right now, with a one-click fix when something is down. */
export function Guide({ world, tone }: { world: World; tone: Outcome['tone'] }) {
  const say = world.say()
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-l-[5px] border-line bg-panel px-5 py-3 ${BAR[tone]}`} aria-live="polite">
      <motion.p
        key={say.text}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="min-w-0 flex-1 text-[clamp(15px,2.3vh,20px)] leading-snug font-medium"
      >
        {say.text}
      </motion.p>
      {say.action && (
        <button onClick={say.action.run} className="nudge h-10 shrink-0 rounded-lg bg-ink px-4 text-[14px] font-semibold text-white hover:bg-black">
          {say.action.label}
        </button>
      )}
    </div>
  )
}
