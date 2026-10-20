import { motion } from 'framer-motion'
import type { Outcome } from '../scenarios/types'
import { AlertIcon, CheckIcon, CrossIcon, DotIcon } from './icons'

const STYLE: Record<Outcome['tone'], string> = {
  neutral: 'bg-panel text-ink border-line',
  good: 'bg-good text-white border-good',
  bad: 'bg-bad text-white border-bad',
  warn: 'bg-warn text-white border-warn',
}

export function OutcomeBanner({ outcome }: { outcome: Outcome }) {
  const Icon = outcome.tone === 'good' ? CheckIcon : outcome.tone === 'bad' ? CrossIcon : outcome.tone === 'warn' ? AlertIcon : DotIcon
  return (
    <div className={`flex items-center gap-4 overflow-hidden rounded-2xl border px-6 py-3 transition-colors duration-300 ${STYLE[outcome.tone]}`} aria-live="polite">
      <Icon className="size-[clamp(24px,4vh,38px)] shrink-0" />
      <motion.div
        key={outcome.title}
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="text-[clamp(24px,4.6vh,44px)] leading-tight font-semibold tracking-tight"
      >
        {outcome.title}
      </motion.div>
    </div>
  )
}
