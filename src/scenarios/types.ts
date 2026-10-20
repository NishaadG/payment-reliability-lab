import type { IconName } from '../components/icons'
import type { Sim } from '../engine/sim'

export type OptValue = boolean | string
export type Opts = Record<string, OptValue>

export interface OptionDef {
  key: string
  label: string
  hint?: string
  kind: 'toggle' | 'segment'
  choices?: { value: string; label: string }[]
}

export interface CheckoutView {
  heading: string
  item: string
  amount: string
  status: 'idle' | 'processing' | 'success' | 'failed'
  message: string
}

export interface Outcome {
  tone: 'neutral' | 'good' | 'bad' | 'warn'
  title: string
  detail: string
}

export interface LoadData {
  clients: { state: 'trying' | 'waiting' | 'paid'; attempts: number }[]
  windowMs: number
  capacity: number
  outageEnd: number
  buckets: { served: number; rejected: number; refused: number; cap: number }[]
  stats: { total: number; rejected: number; refused: number; doneAt: number | null }
}

export interface NodeLayout {
  x: number
  y: number
  icon: IconName
  /** chip label shown large on the card; defaults to the first chip */
  big?: string
  /** anchor only, no card is drawn (used for the customer's phone) */
  hidden?: boolean
}

export interface Layout {
  nodes: Record<string, NodeLayout>
  links: [string, string][]
}

export interface Say {
  /** plain-English sentence about what is happening right now */
  text: string
  /** optional one-click fix shown next to the sentence, e.g. restart a crashed node */
  action?: { label: string; run: () => void }
}

export interface World {
  sim: Sim
  say: () => Say
  view: 'sequence' | 'load'
  canCutNetwork: boolean
  startLabel: string
  started: () => boolean
  start: () => void
  checkout: () => CheckoutView
  outcome: () => Outcome
  load?: LoadData
  layout?: Layout
}

export interface Concept {
  title: string
  body: string
  points: string[]
  syllabus: string[]
}

export interface ScenarioDef {
  id: string
  tab: string
  title: string
  headline: string
  options: OptionDef[]
  defaults: Opts
  concept: Concept
  create: (opts: Opts) => World
}
