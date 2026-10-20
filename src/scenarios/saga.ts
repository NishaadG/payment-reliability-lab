import { Sim, inr } from '../engine/sim'
import type { Chip } from '../engine/sim'
import type { ScenarioDef, World } from './types'

const ORCH = 'orch'
const STOCK = 'stock'
const BANK = 'bank'
const SHIP = 'ship'

const AMOUNT = 1499
const OPENING = 5000
const RETRY = 1500

type StepState = 'none' | 'done' | 'undone'

const STEPS: { k: number; node: string; doLabel: string; undoLabel: string }[] = [
  { k: 1, node: STOCK, doLabel: 'RESERVE', undoLabel: 'RELEASE' },
  { k: 2, node: BANK, doLabel: 'CHARGE', undoLabel: 'REFUND' },
  { k: 3, node: SHIP, doLabel: 'BOOK', undoLabel: 'CANCEL' },
]

export const saga: ScenarioDef = {
  id: 'saga',
  tab: 'Saga',
  title: 'Compensating transactions instead of locks',
  defaults: { fail: 'ship' },
  options: [
    {
      key: 'fail',
      kind: 'segment',
      label: 'Inject a failure',
      hint: 'The chosen step refuses to run. Earlier steps then have to be undone.',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'ship', label: 'Shipping' },
        { value: 'card', label: 'Card' },
      ],
    },
  ],
  concept: {
    title: 'Undo with a new transaction',
    body: 'A saga runs the steps one after another, each as its own local transaction. If a later step fails, the orchestrator runs a compensating step for every earlier one, newest first.',
    points: [
      'No global locks: each service commits locally, so nothing blocks if the orchestrator dies.',
      'The price is visibility: for a while the customer is charged but the order is not confirmed.',
      'Steps and compensations must be idempotent, because the orchestrator retries after timeouts and crashes.',
    ],
    syllabus: ['Recovery techniques', 'Fault tolerance', 'Consistency models'],
  },
  create(opts): World {
    const sim = new Sim(31)
    const failure = String(opts.fail)

    const olog: string[] = []
    let began = false
    let announced = false
    let current: { k: number; kind: 'do' | 'undo'; tries: number } | null = null
    let retryTimer: number | null = null

    const steps: Record<number, StepState> = { 1: 'none', 2: 'none', 3: 'none' }
    let stock = 10
    let balance = OPENING
    let shipment: 'none' | 'booked' | 'cancelled' = 'none'

    const has = (e: string) => olog.includes(e)
    const finished = () => has('DONE') || has('ABORTED')
    const failed = () => olog.some((e) => /^S\d:(fail|unknown)$/.test(e))

    const send = () => {
      const c = current!
      const step = STEPS[c.k - 1]
      c.tries++
      const label = c.kind === 'do' ? step.doLabel : step.undoLabel
      sim.log(ORCH, `${label} (step ${c.k})${c.tries > 1 ? `, attempt ${c.tries}` : ''}`, c.tries > 1 ? 'warn' : 'info')
      sim.send(ORCH, step.node, label, { k: c.k, kind: c.kind }, { channel: 'ctl' })
      sim.cancel(retryTimer)
      retryTimer = sim.timer(ORCH, RETRY, onRetry)
    }

    const onRetry = () => {
      const c = current
      if (!c) return
      sim.mark(ORCH, 'timeout', 'timeout')
      if (c.kind === 'do' && c.tries >= 3) {
        olog.push(`S${c.k}:unknown`)
        sim.log(ORCH, `step ${c.k} timed out 3 times, treating it as failed and compensating`, 'bad')
        current = null
        drive()
      } else if (c.tries >= 8) {
        sim.log(ORCH, `step ${c.k} compensation still unanswered, escalating to an operator`, 'bad')
        current = null
      } else {
        sim.log(ORCH, 'no reply, retrying the same idempotent command', 'warn')
        send()
      }
    }

    // The orchestrator is a pure function of its durable log, so it can resume after a crash.
    const drive = () => {
      if (finished()) return
      if (!failed()) {
        const next = [1, 2, 3].find((k) => !has(`S${k}:ok`))
        if (!next) {
          olog.push('DONE')
          sim.log(ORCH, 'all steps done, order confirmed', 'ok', 'DONE')
          return
        }
        current = { k: next, kind: 'do', tries: 0 }
        send()
      } else {
        const k = [3, 2, 1].find((n) => (has(`S${n}:ok`) || has(`S${n}:unknown`)) && !has(`C${n}:ok`))
        if (!k) {
          olog.push('ABORTED')
          sim.log(ORCH, 'every completed step has been compensated, saga aborted', 'warn', 'ABORTED')
          return
        }
        if (!announced) {
          announced = true
          sim.log(ORCH, 'compensating, newest step first', 'warn')
        }
        current = { k, kind: 'undo', tries: 0 }
        send()
      }
    }

    const reply = (p: { label: string; payload: unknown }) => {
      const r = p.payload as { k: number; kind: 'do' | 'undo'; ok: boolean }
      const c = current
      if (!c || c.k !== r.k || c.kind !== r.kind) {
        sim.log(ORCH, `stale reply for step ${r.k} ignored`, 'info')
        return
      }
      sim.cancel(retryTimer)
      if (r.kind === 'do') {
        olog.push(r.ok ? `S${r.k}:ok` : `S${r.k}:fail`)
        sim.log(ORCH, `step ${r.k} ${r.ok ? 'succeeded' : 'failed'}`, r.ok ? 'ok' : 'bad', r.ok ? `S${r.k} ok` : `S${r.k} failed`)
      } else {
        olog.push(`C${r.k}:ok`)
        sim.log(ORCH, `compensation for step ${r.k} confirmed`, 'ok', `C${r.k} ok`)
      }
      current = null
      drive()
    }

    sim.addNode({
      id: ORCH,
      name: 'Orchestrator',
      role: 'Saga coordinator',
      chips: () => [
        { label: 'log', value: olog.length ? olog[olog.length - 1] : 'empty' },
        { label: 'phase', value: finished() ? (has('DONE') ? 'done' : 'aborted') : failed() ? 'undoing' : began ? 'forward' : 'idle', tone: failed() ? 'warn' : 'neutral' },
      ],
      onMessage: (p) => reply(p),
      onCrash: () => {
        current = null
      },
      onRecover: () => {
        if (!began || finished()) return
        sim.log(ORCH, `recovering, log = [${olog.join(', ')}], resuming`, 'info')
        drive()
      },
    })

    const worker = (
      id: string,
      k: number,
      name: string,
      role: string,
      doIt: () => void,
      undoIt: () => void,
      chips: () => Chip[],
      failMode: string,
      reason: string,
    ) => {
      sim.addNode({
        id,
        name,
        role,
        chips,
        onMessage: (m) => {
          const req = m.payload as { k: number; kind: 'do' | 'undo' }
          if (req.kind === 'do') {
            if (steps[k] === 'done') {
              sim.log(id, `${m.label} repeated, already done, replying OK`, 'ok')
              sim.send(id, ORCH, 'OK', { k, kind: 'do', ok: true }, { channel: 'res' })
            } else if (steps[k] === 'undone' || failure === failMode) {
              sim.log(id, steps[k] === 'undone' ? `${m.label} refused, step was already cancelled` : `${m.label} refused: ${reason}`, 'bad', 'refused')
              sim.send(id, ORCH, 'FAIL', { k, kind: 'do', ok: false }, { channel: 'res' })
            } else {
              steps[k] = 'done'
              doIt()
              sim.send(id, ORCH, 'OK', { k, kind: 'do', ok: true }, { channel: 'res' })
            }
          } else {
            if (steps[k] === 'done') undoIt()
            else sim.log(id, `${m.label}: nothing to undo, recording tombstone`, 'info')
            steps[k] = 'undone'
            sim.send(id, ORCH, 'OK', { k, kind: 'undo', ok: true }, { channel: 'res' })
          }
        },
      })
    }

    worker(
      STOCK,
      1,
      'Inventory',
      'Local txn',
      () => {
        stock -= 1
        sim.log(STOCK, 'stock reserved, committed locally', 'ok', 'reserved')
      },
      () => {
        stock += 1
        sim.log(STOCK, 'reservation released', 'ok', 'released')
      },
      () => [{ label: 'stock', value: String(stock), tone: stock < 10 ? 'warn' : 'neutral' }],
      'never',
      '',
    )
    worker(
      BANK,
      2,
      'Payments',
      'Local txn',
      () => {
        balance -= AMOUNT
        sim.log(BANK, `charged ${AMOUNT}, committed locally`, 'ok', `charged ${AMOUNT}`)
      },
      () => {
        balance += AMOUNT
        sim.log(BANK, `refunded ${AMOUNT}`, 'ok', `refunded ${AMOUNT}`)
      },
      () => [{ label: 'balance', value: inr(balance), tone: balance < OPENING ? 'warn' : 'neutral' }],
      'card',
      'card declined',
    )
    worker(
      SHIP,
      3,
      'Fulfilment',
      'Local txn',
      () => {
        shipment = 'booked'
        sim.log(SHIP, 'courier booked, committed locally', 'ok', 'booked')
      },
      () => {
        shipment = 'cancelled'
        sim.log(SHIP, 'courier booking cancelled', 'ok', 'cancelled')
      },
      () => [{ label: 'shipment', value: shipment, tone: shipment === 'booked' ? 'ok' : 'neutral' }],
      'ship',
      'no courier available',
    )

    return {
      sim,
      view: 'sequence',
      canCutNetwork: true,
      startLabel: `Pay ${inr(AMOUNT)}`,
      started: () => began,
      start: () => {
        began = true
        olog.push('START')
        sim.log(ORCH, 'START order 4021: reserve stock, charge card, book courier', 'info')
        drive()
        sim.touch()
      },
      checkout: () => ({
        heading: 'Order #4021',
        item: 'Mechanical keyboard',
        amount: inr(AMOUNT),
        status: !began ? 'idle' : has('DONE') ? 'success' : has('ABORTED') ? 'failed' : 'processing',
        message: !began
          ? ''
          : has('DONE')
            ? 'Order confirmed'
            : has('ABORTED')
              ? 'Order could not be completed. Any charge has been refunded.'
              : 'Processing order',
      }),
      outcome: () => {
        if (!began) return { tone: 'neutral', title: 'Not started', detail: 'Press Pay to start the saga.' }
        if (has('DONE')) return { tone: 'good', title: 'Order completed', detail: 'All three local transactions committed.' }
        if (has('ABORTED')) {
          const clean = stock === 10 && balance === OPENING && shipment !== 'booked'
          return clean
            ? { tone: 'good', title: 'Rolled back cleanly', detail: 'Stock released and card refunded. The end state matches the start.' }
            : { tone: 'bad', title: 'Left inconsistent', detail: 'A compensation did not take effect.' }
        }
        if (balance < OPENING)
          return {
            tone: 'warn',
            title: 'Charged, order not confirmed',
            detail: 'Intermediate state is visible to others. This is the cost of having no global lock.',
          }
        return { tone: 'neutral', title: 'In progress', detail: 'Steps are running.' }
      },
    }
  },
}
