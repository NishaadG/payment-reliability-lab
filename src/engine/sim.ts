// Discrete-event simulator for a handful of nodes talking over an unreliable network.
// Time is virtual (milliseconds) and only advances while there is work queued.

export type Tone = 'info' | 'ok' | 'warn' | 'bad' | 'fault'
export type Channel = 'req' | 'res' | 'ctl'

export interface LogEntry {
  id: number
  t: number
  node: string
  text: string
  tone: Tone
}

export interface Packet {
  id: number
  from: string
  to: string
  label: string
  sub?: string
  channel: Channel
  sentAt: number
  arriveAt: number
  status: 'flight' | 'delivered' | 'lost'
  lostAt?: number
  payload: unknown
}

export interface Mark {
  id: number
  t: number
  node: string
  label: string
  kind: 'crash' | 'recover' | 'timeout'
}

export interface Note {
  id: number
  t: number
  node: string
  text: string
  tone: Tone
}

export interface Band {
  from: number
  to?: number
  label: string
}

export interface Chip {
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
}

export interface SimNode {
  id: string
  name: string
  role: string
  up: boolean
  epoch: number
  chips: () => Chip[]
  onMessage?: (p: Packet) => void
  onCrash?: () => void
  onRecover?: () => void
}

interface Ev {
  at: number
  seq: number
  id: number
  fn: () => void
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Sim {
  t = 0
  version = 0
  paused = false
  speed = 1
  netUp = true
  baseLatency = 350

  nodes = new Map<string, SimNode>()
  order: string[] = []
  packets: Packet[] = []
  logs: LogEntry[] = []
  marks: Mark[] = []
  notes: Note[] = []
  bands: Band[] = []

  private queue: Ev[] = []
  private seq = 0
  private ids = 0
  private drops: { id: number; match: (p: Packet) => boolean }[] = []
  private listeners = new Set<() => void>()
  readonly rand: () => number

  constructor(seed = 7) {
    this.rand = mulberry32(seed)
  }

  // --- subscription -------------------------------------------------------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getVersion = () => this.version

  touch() {
    this.version++
    this.listeners.forEach((fn) => fn())
  }

  // --- scheduling ---------------------------------------------------------
  get idle() {
    return this.queue.length === 0
  }

  at(delay: number, fn: () => void): number {
    const id = ++this.ids
    const ev: Ev = { at: this.t + delay, seq: ++this.seq, id, fn }
    let i = this.queue.length
    while (i > 0 && this.queue[i - 1].at > ev.at) i--
    this.queue.splice(i, 0, ev)
    return id
  }

  /** A timer owned by a node: it is dropped if the node crashes before it fires. */
  timer(nodeId: string, delay: number, fn: () => void): number {
    const node = this.nodes.get(nodeId)!
    const epoch = node.epoch
    return this.at(delay, () => {
      if (node.up && node.epoch === epoch) fn()
    })
  }

  cancel(id: number | null | undefined) {
    if (id == null) return
    const i = this.queue.findIndex((e) => e.id === id)
    if (i >= 0) this.queue.splice(i, 1)
  }

  private runNext() {
    const ev = this.queue.shift()!
    this.t = ev.at
    ev.fn()
  }

  /** Advance by a real-time delta. Returns true when something changed. */
  tick(dtMs: number): boolean {
    if (this.paused || this.queue.length === 0) return false
    const target = this.t + dtMs * this.speed
    while (this.queue.length && this.queue[0].at <= target) this.runNext()
    if (this.queue.length) this.t = target
    this.touch()
    return true
  }

  runToEnd(limitMs = 120_000) {
    while (this.queue.length && this.t < limitMs) this.runNext()
  }

  // --- nodes --------------------------------------------------------------
  addNode(spec: Omit<SimNode, 'up' | 'epoch'>) {
    this.nodes.set(spec.id, { ...spec, up: true, epoch: 0 })
    this.order.push(spec.id)
  }

  crash(id: string) {
    const n = this.nodes.get(id)
    if (!n || !n.up) return
    n.up = false
    n.epoch++
    this.marks.push({ id: ++this.ids, t: this.t, node: id, label: 'crash', kind: 'crash' })
    this.log(id, 'process crashed, volatile state lost', 'bad')
    n.onCrash?.()
    this.touch()
  }

  recover(id: string) {
    const n = this.nodes.get(id)
    if (!n || n.up) return
    n.up = true
    this.marks.push({ id: ++this.ids, t: this.t, node: id, label: 'restart', kind: 'recover' })
    this.log(id, 'process restarted', 'ok')
    n.onRecover?.()
    this.touch()
  }

  // --- network ------------------------------------------------------------
  setNet(up: boolean) {
    if (this.netUp === up) return
    this.netUp = up
    if (!up) {
      this.bands.push({ from: this.t, label: 'network cut' })
      this.log('network', 'link cut, in-flight packets are lost', 'fault')
      for (const p of this.packets) {
        if (p.status === 'flight') {
          p.status = 'lost'
          p.lostAt = this.t
        }
      }
    } else {
      const open = this.bands[this.bands.length - 1]
      if (open && open.to === undefined) open.to = this.t
      this.log('network', 'link restored', 'ok')
    }
    this.touch()
  }

  /** Drop the next packet that matches, once. */
  armDrop(match: (p: Packet) => boolean) {
    this.drops.push({ id: ++this.ids, match })
  }

  send(
    from: string,
    to: string,
    label: string,
    payload: unknown = null,
    opts: { channel?: Channel; sub?: string; latency?: number } = {},
  ): Packet | null {
    const src = this.nodes.get(from)
    if (!src || !src.up) return null
    const lat = opts.latency ?? Math.round(this.baseLatency + (this.rand() - 0.5) * 100)
    const p: Packet = {
      id: ++this.ids,
      from,
      to,
      label,
      sub: opts.sub,
      channel: opts.channel ?? 'req',
      sentAt: this.t,
      arriveAt: this.t + lat,
      status: 'flight',
      payload,
    }
    this.packets.push(p)

    if (!this.netUp) {
      this.lose(p, Math.round(lat * 0.4))
      return p
    }
    const di = this.drops.findIndex((d) => d.match(p))
    if (di >= 0) {
      this.drops.splice(di, 1)
      this.lose(p, Math.round(lat * 0.7))
      this.log('network', `${label} (${from} -> ${to}) dropped in transit`, 'fault')
      return p
    }
    this.at(lat, () => this.deliver(p))
    return p
  }

  private lose(p: Packet, after: number) {
    this.at(after, () => {
      if (p.status === 'flight') {
        p.status = 'lost'
        p.lostAt = this.t
      }
    })
  }

  private deliver(p: Packet) {
    if (p.status !== 'flight') return
    const dest = this.nodes.get(p.to)
    if (!dest || !dest.up) {
      p.status = 'lost'
      p.lostAt = this.t
      this.log(p.to, `${p.label} from ${p.from} arrived while down, ignored`, 'warn')
      return
    }
    p.status = 'delivered'
    dest.onMessage?.(p)
  }

  // --- annotations --------------------------------------------------------
  log(node: string, text: string, tone: Tone = 'info', note?: string) {
    this.logs.push({ id: ++this.ids, t: this.t, node, text, tone })
    if (note) this.notes.push({ id: ++this.ids, t: this.t, node, text: note, tone })
  }

  mark(node: string, label: string, kind: Mark['kind']) {
    this.marks.push({ id: ++this.ids, t: this.t, node, label, kind })
  }
}

export function fmtTime(ms: number) {
  return (ms / 1000).toFixed(2) + 's'
}

export function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}
