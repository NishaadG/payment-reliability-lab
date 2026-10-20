interface P {
  className?: string
}

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const CheckIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 8.5l3.2 3.2L13 4.8" />
  </svg>
)

export const CrossIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

export const AlertIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M8 2.5l6 10.5H2L8 2.5zM8 6.5v3M8 11.3v.1" />
  </svg>
)

export const DotIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
  </svg>
)

export const PlayIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor" />
  </svg>
)

export const PauseIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M5.5 3.5v9M10.5 3.5v9" />
  </svg>
)

export const ResetIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" />
  </svg>
)

export const SpinnerIcon = ({ className }: P) => (
  <svg {...base} className={`spin ${className ?? ''}`} aria-hidden>
    <path d="M8 2a6 6 0 1 0 6 6" />
  </svg>
)

export const ChevronIcon = ({ className, dir = 'right' }: P & { dir?: 'left' | 'right' }) => (
  <svg {...base} className={className} aria-hidden>
    <path d={dir === 'right' ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'} />
  </svg>
)

export type IconName = 'server' | 'bank' | 'ledger' | 'box' | 'truck' | 'hub' | 'card' | 'gate'

const NODE_PATHS: Record<IconName, React.ReactNode> = {
  server: (
    <>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </>
  ),
  bank: <path d="M3 9l9-5 9 5H3zM5.5 9v9M9.8 9v9M14.2 9v9M18.5 9v9M3 20.5h18" />,
  ledger: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  box: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  truck: (
    <>
      <path d="M2 6h11v10H2zM13 9h4l3 3v4h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  gate: <path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />,
}

export const NodeIcon = ({ name, className }: { name: IconName; className?: string }) => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {NODE_PATHS[name]}
  </svg>
)
