import { Sim, fmtTime } from '../engine/sim'
import type { LoadData, ScenarioDef, World } from './types'

const CLIENTS = 20
const WINDOW = 500
const CAPACITY = 4
const OUTAGE_END = 1500
const OVERLOAD = 12
const DEGRADED = 1
const LEG = 100
const BASE = 200
const CAP = 4000

type Strategy = 'fixed' | 'exp' | 'jitter'

const LABEL: Record<Strategy, string> = {
  fixed: 'Fixed 500 ms',
  exp: 'Exponential',
  jitter: 'Exponential + jitter',
}

function build(strategy: Strategy): World {
  const sim = new Sim(5)
  sim.addNode({ id: 'api', name: 'Shop server', role: 'Rate limited', chips: () => [] })

  const load: LoadData = {
    clients: Array.from({ length: CLIENTS }, () => ({ state: 'trying' as const, attempts: 0 })),
    windowMs: WINDOW,
    capacity: CAPACITY,
    outageEnd: OUTAGE_END,
    buckets: [],
    stats: { total: 0, rejected: 0, refused: 0, doneAt: null },
  }
  let started = false
  let paid = 0
  const served = new Map<number, number>()
  const lastWindowLogged = { v: -1 }

  const bucket = (t: number) => {
    const i = Math.floor(t / WINDOW)
    while (load.buckets.length <= i) load.buckets.push({ served: 0, rejected: 0, refused: 0, cap: CAPACITY })
    return { i, b: load.buckets[i] }
  }

  const delay = (failures: number) => {
    if (strategy === 'fixed') return 500
    const ceiling = Math.min(CAP, BASE * 2 ** (failures - 1))
    return strategy === 'exp' ? ceiling : Math.round(sim.rand() * ceiling)
  }

  const request = (c: number) => {
    const client = load.clients[c]
    client.state = 'trying'
    client.attempts++
    load.stats.total++
    sim.at(LEG, () => arrive(c))
  }

  const arrive = (c: number) => {
    const { i, b } = bucket(sim.t)
    if (i !== lastWindowLogged.v) {
      lastWindowLogged.v = i
      if (i > 0) {
        const prev = load.buckets[i - 1]
        if (prev) {
          const n = prev.served + prev.rejected + prev.refused
          sim.log(
            'api',
            `window ${i - 1}: ${n} requests, ${prev.served} served, ${prev.rejected + prev.refused} turned away`,
            prev.rejected + prev.refused > prev.served ? 'warn' : 'info',
          )
        }
      }
    }
    if (sim.t < OUTAGE_END) {
      b.refused++
      load.stats.refused++
      sim.at(LEG, () => fail(c))
      return
    }
    const prev = load.buckets[i - 1]
    if (prev && prev.served + prev.rejected > OVERLOAD) b.cap = DEGRADED
    const used = served.get(i) ?? 0
    if (used < b.cap) {
      served.set(i, used + 1)
      b.served++
      sim.at(LEG, () => succeed(c))
    } else {
      b.rejected++
      load.stats.rejected++
      sim.at(LEG, () => fail(c))
    }
  }

  const fail = (c: number) => {
    const client = load.clients[c]
    client.state = 'waiting'
    sim.at(delay(client.attempts), () => request(c))
  }

  const succeed = (c: number) => {
    load.clients[c].state = 'paid'
    paid++
    if (paid === CLIENTS) {
      load.stats.doneAt = sim.t
      sim.log('api', `all ${CLIENTS} payments confirmed after ${load.stats.total} requests`, 'ok')
    }
  }

  return {
    sim,
    say: () => {
      if (!started) return { text: 'Tap Start. The payment API is down. 20 customers keep retrying, and how long they wait decides how fast everyone gets through.' }
      const wasted = load.stats.rejected + load.stats.refused
      if (paid === CLIENTS) return { text: `Finished. ${wasted} of ${load.stats.total} requests were wasted. Switch the strategy below and compare.` }
      if (sim.t < OUTAGE_END) return { text: 'The API is down, so every request fails. Each customer waits a bit, then tries again.' }
      if (strategy === 'fixed') return { text: 'Everyone retries at the same moment, so the recovering API is flooded and turns most of them away.' }
      if (strategy === 'exp') return { text: 'Customers wait longer after every failure, but they still retry in sync with each other.' }
      return { text: 'Each customer waits a random time, so the load spreads out and the API keeps up.' }
    },
    view: 'load',
    canCutNetwork: false,
    startLabel: 'Start flash sale',
    started: () => started,
    start: () => {
      started = true
      sim.log('api', `${CLIENTS} customers pay at once, API is down until ${fmtTime(OUTAGE_END)}`, 'warn')
      for (let c = 0; c < CLIENTS; c++) request(c)
      sim.touch()
    },
    checkout: () => ({
      heading: 'Flash sale checkout',
      item: `${CLIENTS} customers, 1 payment API`,
      amount: `${paid}/${CLIENTS}`,
      status: !started ? 'idle' : paid === CLIENTS ? 'success' : 'processing',
      message: !started ? '' : paid === CLIENTS ? 'All payments confirmed' : `${paid} paid, ${CLIENTS - paid} retrying`,
    }),
    outcome: () => {
      if (!started) return { tone: 'neutral', title: 'Not started', detail: `Capacity is ${CAPACITY} requests per ${WINDOW} ms.` }
      const s = load.stats
      if (paid < CLIENTS)
        return { tone: 'neutral', title: `${paid} of ${CLIENTS} paid`, detail: `${s.total} requests sent so far, ${s.rejected + s.refused} turned away.` }
      const wasted = s.rejected + s.refused
      return {
        tone: wasted > CLIENTS * 1.5 ? 'warn' : 'good',
        title: `Done in ${fmtTime(s.doneAt ?? 0)}, ${wasted} wasted`,
        detail: `${s.total} requests for ${CLIENTS} payments, ${wasted} wasted.`,
      }
    },
    load,
  }
}

export interface CompareRow {
  strategy: Strategy
  label: string
  total: number
  wasted: number
  doneAt: number
}

let cache: CompareRow[] | null = null

/** Run all three strategies headless on the same seed, for the comparison table. */
export function compareBackoff(): CompareRow[] {
  if (cache) return cache
  cache = (['fixed', 'exp', 'jitter'] as Strategy[]).map((strategy) => {
    const w = build(strategy)
    w.start()
    w.sim.runToEnd()
    const s = w.load!.stats
    return { strategy, label: LABEL[strategy], total: s.total, wasted: s.rejected + s.refused, doneAt: s.doneAt ?? 0 }
  })
  return cache
}

export const backoff: ScenarioDef = {
  id: 'backoff',
  tab: 'Retries',
  title: 'Retry storms and exponential backoff',
  headline: 'Twenty customers retry at once after an outage.',
  defaults: { strategy: 'fixed' },
  options: [
    {
      key: 'strategy',
      kind: 'segment',
      label: 'Retry style',
      hint: 'Smart waiting is exponential backoff with jitter: wait longer each time, plus a random bit.',
      choices: [
        { value: 'fixed', label: 'All at once' },
        { value: 'jitter', label: 'Smart waiting' },
      ],
    },
  ],
  concept: {
    title: 'Retries need discipline',
    body: 'After an outage every client holds a failed request. If they all retry on the same schedule, the recovering API is hit by synchronised waves and most of the traffic is wasted.',
    points: [
      'Fixed intervals keep the clients in lockstep, so the same crowd returns every 500 ms.',
      'Exponential backoff reduces load over time but still keeps clients synchronised.',
      'Random jitter spreads the retries, so capacity is used evenly and the work finishes sooner.',
    ],
    syllabus: ['Fault tolerance', 'Load', 'Failure detection'],
  },
  create: (opts) => build((opts.strategy as Strategy) ?? 'fixed'),
}
