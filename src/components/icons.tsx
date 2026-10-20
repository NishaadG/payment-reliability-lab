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

export const LinkIcon = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M2 8h12M2 8l2.5-2.5M2 8l2.5 2.5M14 8l-2.5-2.5M14 8l-2.5 2.5" />
  </svg>
)
