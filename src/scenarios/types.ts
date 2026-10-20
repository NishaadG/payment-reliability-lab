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

export interface World {
  sim: Sim
  view: 'sequence' | 'load'
  canCutNetwork: boolean
  startLabel: string
  started: () => boolean
  start: () => void
  checkout: () => CheckoutView
  outcome: () => Outcome
  load?: LoadData
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
  options: OptionDef[]
  defaults: Opts
  concept: Concept
  create: (opts: Opts) => World
}
