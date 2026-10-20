import { Sim, inr } from '../engine/sim'
import type { Chip } from '../engine/sim'
import type { ScenarioDef, World } from './types'

const COORD = 'coord'
const BANK = 'bank'
const MERCHANT = 'merchant'
const LEDGER = 'ledger'
const PARTS = [BANK, MERCHANT, LEDGER]

const AMOUNT = 1499
const OPENING = 5000
const VOTE_TIMEOUT = 2500
const ACK_TIMEOUT = 3000
const DOUBT_TIMEOUT = 4000

type PState = 'idle' | 'prepared' | 'committed' | 'aborted'

interface Part {
  state: PState
  wal: string[]
  doubtAsks: number
}

const EFFECT: Record<string, string> = {
  [BANK]: `debit ${AMOUNT}`,
  [MERCHANT]: 'order confirmed',
  [LEDGER]: 'entry posted',
}

export const twoPhase: ScenarioDef = {
  id: 'two-phase',
  tab: 'Two-phase commit',
  title: 'Atomic payment across three services',
  defaults: { stock: 'in', crashAt: 'none' },
  options: [
    {
      key: 'crashAt',
      kind: 'segment',
      label: 'Crash the coordinator',
      hint: 'Where the coordinator process dies. You can also crash or restart any node from its card.',
      choices: [
        { value: 'none', label: 'Never' },
        { value: 'beforeDecision', label: 'Before decision' },
        { value: 'afterDecision', label: 'After decision' },
        { value: 'midCommit', label: 'Mid broadcast' },
      ],
    },
    {
      key: 'stock',
      kind: 'segment',
      label: 'Merchant stock',
      hint: 'If the item is out of stock the merchant votes no and everything must roll back.',
      choices: [
        { value: 'in', label: 'In stock' },
        { value: 'out', label: 'Out of stock' },
      ],
    },
  ],
  concept: {
    title: 'All or nothing, at a price',
    body: 'The coordinator asks every participant to prepare, collects the votes, writes the decision to its log, and only then tells everyone to commit or abort. The logged decision is the commit point.',
    points: [
      'A prepared participant has promised to commit and keeps its locks. It cannot decide alone.',
      'If the coordinator dies after the votes, participants are blocked until it restarts.',
      'On restart the coordinator reads its log: a logged decision is re-sent, no decision means abort.',
    ],
    syllabus: ['Distributed commit', 'Write-ahead log', 'Recovery techniques'],
  },
  create(opts): World {
    const sim = new Sim(23)
    const crashAt = String(opts.crashAt)
    const outOfStock = opts.stock === 'out'

    let began = false
    let crashFired = false
    const coordLog: string[] = []
    let votes = new Map<string, boolean>()
    let acks = new Set<string>()
    let ackRetries = 0
    let voteTimer: number | null = null
    let ackTimer: number | null = null

    const parts: Record<string, Part> = {
      [BANK]: { state: 'idle', wal: [], doubtAsks: 0 },
      [MERCHANT]: { state: 'idle', wal: [], doubtAsks: 0 },
      [LEDGER]: { state: 'idle', wal: [], doubtAsks: 0 },
    }
    let balance = OPENING
    let stock = 10
    let entries = 0

    const decision = () => (coordLog.includes('COMMIT') ? 'COMMIT' : coordLog.includes('ABORT') ? 'ABORT' : null)
    const finished = () => coordLog.includes('END')

    const crashCoord = (why: string) => {
      crashFired = true
      sim.log(COORD, why, 'bad')
      sim.crash(COORD)
    }

    const broadcast = (d: 'COMMIT' | 'ABORT') => {
      let sent = 0
      for (const p of PARTS) {
        if (acks.has(p)) continue
        sim.send(COORD, p, d, null, { channel: 'ctl' })
        sent++
        if (crashAt === 'midCommit' && d === 'COMMIT' && !crashFired && sent === 1) {
          crashCoord('crashed after sending COMMIT to only one participant')
          return
        }
      }
      sim.cancel(ackTimer)
      ackTimer = sim.timer(COORD, ACK_TIMEOUT, () => {
        if (finished() || ackRetries >= 3) return
        ackRetries++
        sim.log(COORD, `missing ACKs, re-sending ${d}`, 'warn')
        broadcast(d)
      })
    }

    const decide = (d: 'COMMIT' | 'ABORT') => {
      if (decision()) return
      sim.cancel(voteTimer)
      coordLog.push(d)
      sim.log(COORD, `force-write ${d} to log, this is the commit point`, d === 'COMMIT' ? 'ok' : 'warn', `${d} logged`)
      if (crashAt === 'afterDecision' && d === 'COMMIT' && !crashFired) {
        crashCoord('crashed right after logging COMMIT, before telling anyone')
        return
      }
      broadcast(d)
    }

    const askCoordinator = (id: string) => {
      sim.send(id, COORD, 'WHAT_DECISION', null, { channel: 'ctl' })
    }

    const armDoubt = (id: string) => {
      sim.timer(id, DOUBT_TIMEOUT, () => {
        const p = parts[id]
        if (p.state !== 'prepared') return
        sim.mark(id, 'in doubt', 'timeout')
        sim.log(id, 'voted yes but no decision yet. Cannot commit or abort alone, locks stay held', 'warn', 'in doubt')
        if (p.doubtAsks < 2) {
          p.doubtAsks++
          askCoordinator(id)
          armDoubt(id)
        }
      })
    }

    const apply = (id: string, d: 'COMMIT' | 'ABORT') => {
      const p = parts[id]
      if (d === 'COMMIT') {
        if (p.state === 'committed') return
        p.state = 'committed'
        p.wal.push('COMMIT')
        if (id === BANK) balance -= AMOUNT
        if (id === MERCHANT) stock -= 1
        if (id === LEDGER) entries += 1
        sim.log(id, `COMMIT applied, ${EFFECT[id]}, locks released`, 'ok', 'committed')
      } else {
        if (p.state === 'aborted') return
        p.state = 'aborted'
        p.wal.push('ABORT')
        sim.log(id, 'ABORT applied, changes rolled back, locks released', 'info', 'aborted')
      }
    }

    const coordHandle = (from: string, label: string) => {
      if (label === 'VOTE_YES' || label === 'VOTE_NO') {
        if (decision()) return
        votes.set(from, label === 'VOTE_YES')
        if (label === 'VOTE_NO') {
          sim.log(COORD, `${from} voted no, aborting`, 'warn')
          decide('ABORT')
        } else if (votes.size === PARTS.length && [...votes.values()].every(Boolean)) {
          sim.log(COORD, 'all participants voted yes', 'info')
          if (crashAt === 'beforeDecision' && !crashFired) {
            crashCoord('crashed after collecting votes, before logging a decision')
            return
          }
          decide('COMMIT')
        }
      } else if (label === 'ACK') {
        acks.add(from)
        if (acks.size === PARTS.length && !finished()) {
          coordLog.push('END')
          sim.cancel(ackTimer)
          sim.log(COORD, 'all ACKs received, transaction complete', 'ok', 'END')
        }
      } else if (label === 'WHAT_DECISION') {
        const d = decision()
        if (d) sim.send(COORD, from, d, null, { channel: 'ctl' })
      }
    }

    sim.addNode({
      id: COORD,
      name: 'Coordinator',
      role: 'Payment service',
      chips: () => {
        const d = decision()
        const chips: Chip[] = [
          { label: 'log', value: coordLog.length ? coordLog[coordLog.length - 1] : 'empty' },
          {
            label: 'decision',
            value: d ?? 'none',
            tone: d === 'COMMIT' ? 'ok' : d === 'ABORT' ? 'warn' : 'neutral',
          },
        ]
        return chips
      },
      onMessage: (p) => coordHandle(p.from, p.label),
      onCrash: () => {
        votes = new Map()
        acks = new Set()
      },
      onRecover: () => {
        if (!began || finished()) return
        sim.log(COORD, `recovering, log = [${coordLog.join(', ')}]`, 'info')
        const d = decision()
        if (d) {
          sim.log(COORD, `found ${d}, re-sending to participants`, 'ok')
          ackRetries = 0
          broadcast(d)
        } else {
          sim.log(COORD, 'no decision in log, presumed abort', 'warn')
          decide('ABORT')
        }
      },
    })

    const partNode = (id: string, name: string, role: string, extra: () => Chip[]) => {
      sim.addNode({
        id,
        name,
        role,
        chips: () => {
          const p = parts[id]
          const tone = p.state === 'prepared' ? 'warn' : p.state === 'committed' ? 'ok' : 'neutral'
          return [
            { label: 'state', value: p.state, tone },
            { label: 'lock', value: p.state === 'prepared' ? 'held' : 'free', tone: p.state === 'prepared' ? 'warn' : 'neutral' },
            ...extra(),
          ]
        },
        onMessage: (m) => {
          const p = parts[id]
          if (m.label === 'PREPARE') {
            if (p.state === 'prepared') {
              sim.send(id, COORD, 'VOTE_YES', null, { channel: 'res' })
              return
            }
            if (p.state !== 'idle') return
            if (id === MERCHANT && outOfStock) {
              p.state = 'aborted'
              p.wal.push('ABORT')
              sim.log(id, 'item out of stock, voting no', 'warn', 'vote no')
              sim.send(id, COORD, 'VOTE_NO', null, { channel: 'res' })
              return
            }
            p.state = 'prepared'
            p.wal.push('PREPARED')
            sim.log(id, 'force-write PREPARED, resources locked, voting yes', 'info', 'PREPARED')
            sim.send(id, COORD, 'VOTE_YES', null, { channel: 'res' })
            armDoubt(id)
          } else if (m.label === 'COMMIT' || m.label === 'ABORT') {
            apply(id, m.label)
            sim.send(id, COORD, 'ACK', null, { channel: 'res' })
          }
        },
        onRecover: () => {
          const p = parts[id]
          if (p.state === 'prepared') {
            sim.log(id, 'recovering, log shows PREPARED, asking coordinator for the outcome', 'warn')
            p.doubtAsks = 0
            askCoordinator(id)
            armDoubt(id)
          }
        },
      })
    }

    partNode(BANK, 'Bank', 'Holds the funds', () => [{ label: 'balance', value: inr(balance), tone: balance < OPENING ? 'ok' : 'neutral' }])
    partNode(MERCHANT, 'Order service', 'Reserves stock', () => [{ label: 'stock', value: String(stock) }])
    partNode(LEDGER, 'Ledger', 'Audit trail', () => [{ label: 'entries', value: String(entries) }])

    const states = () => PARTS.map((p) => parts[p].state)

    return {
      sim,
      view: 'sequence',
      canCutNetwork: true,
      startLabel: `Pay ${inr(AMOUNT)}`,
      started: () => began,
      start: () => {
        began = true
        coordLog.push('BEGIN')
        sim.log(COORD, 'BEGIN T1, sending PREPARE to all participants', 'info')
        for (const p of PARTS) sim.send(COORD, p, 'PREPARE', null, { channel: 'ctl' })
        voteTimer = sim.timer(COORD, VOTE_TIMEOUT, () => {
          if (!decision()) {
            sim.log(COORD, 'vote timeout, missing votes count as no', 'warn')
            decide('ABORT')
          }
        })
        sim.touch()
      },
      checkout: () => {
        const s = states()
        const committed = s.every((x) => x === 'committed')
        const aborted = s.some((x) => x === 'aborted') && !s.includes('prepared')
        return {
          heading: 'Order #4021',
          item: 'Mechanical keyboard',
          amount: inr(AMOUNT),
          status: !began ? 'idle' : committed ? 'success' : aborted ? 'failed' : 'processing',
          message: !began
            ? ''
            : committed
              ? 'Payment successful'
              : aborted
                ? outOfStock
                  ? 'Item out of stock. You were not charged.'
                  : 'Payment could not be completed. You were not charged.'
                : 'Processing payment',
        }
      },
      outcome: () => {
        if (!began) return { tone: 'neutral', title: 'Not started', detail: 'Press Pay to run one transaction.' }
        const s = states()
        const prepared = s.filter((x) => x === 'prepared').length
        const committed = s.filter((x) => x === 'committed').length
        const aborted = s.filter((x) => x === 'aborted').length
        if (committed && aborted)
          return { tone: 'bad', title: 'Inconsistent', detail: 'Some participants committed and others aborted.' }
        if (committed === 3) return { tone: 'good', title: 'Committed everywhere', detail: 'Bank, order service and ledger all applied the payment.' }
        if (aborted && !prepared)
          return { tone: 'good', title: 'Aborted everywhere', detail: 'Nothing was applied. The customer was not charged.' }
        const stuck = prepared > 0 && (!sim.nodes.get(COORD)!.up || sim.idle)
        if (stuck)
          return {
            tone: 'warn',
            title: `Blocked: ${prepared} in doubt`,
            detail: 'Prepared participants hold locks and cannot decide alone. They wait for the coordinator.',
          }
        return { tone: 'neutral', title: 'In progress', detail: 'Protocol is running.' }
      },
    }
  },
}
