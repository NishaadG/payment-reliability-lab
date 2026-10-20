import { Sim, inr } from '../engine/sim'
import type { ScenarioDef, World } from './types'

const CLIENT = 'client'
const GATEWAY = 'gateway'
const BANK = 'bank'

const AMOUNT = 1499
const OPENING = 5000
const TIMEOUT = 2500
const MAX_ATTEMPTS = 3
const KEY = 'idem_ord4021'

export const doubleCharge: ScenarioDef = {
  id: 'double-charge',
  tab: 'Double charge',
  title: 'Network drop after the bank has debited',
  headline: 'The bank took the money. The reply never arrived.',
  defaults: { idempotency: false, loseReply: true },
  options: [
    {
      key: 'idempotency',
      kind: 'toggle',
      label: 'Duplicate protection (idempotency key)',
      hint: 'The client sends the same key on every retry. The bank remembers it and replays the stored result.',
    },
    {
      key: 'loseReply',
      kind: 'toggle',
      label: 'Lose the bank\'s reply',
      hint: 'Drops the first response coming back from the bank. The debit has already happened.',
    },
  ],
  concept: {
    title: 'Why a timeout is not a failure',
    body: 'When a reply never arrives, the client cannot tell whether the request was lost, the server crashed, or only the response was lost. Retrying is the right reaction, but only if repeating the request is safe.',
    points: [
      'At-least-once delivery plus a non-idempotent operation gives duplicate charges.',
      'An idempotency key turns the retry into a lookup: same key, same result, one debit.',
      'The key must be generated once by the client and stored by the server with the result.',
    ],
    syllabus: ['RPC semantics', 'Failure models', 'Fault tolerance'],
  },
  create(opts): World {
    const sim = new Sim(11)
    const useKey = opts.idempotency === true

    let balance = OPENING
    const charges: { txn: string; attempt: number }[] = []
    const processed = new Map<string, string>()
    let attempts = 0
    let forwarded = 0
    let status: 'idle' | 'processing' | 'success' | 'failed' = 'idle'
    const pending: number[] = []

    const clearPending = () => {
      pending.forEach((id) => sim.cancel(id))
      pending.length = 0
    }

    sim.addNode({
      id: CLIENT,
      name: 'Customer app',
      role: 'Browser / mobile',
      chips: () => [
        { label: 'attempts', value: String(attempts), tone: attempts > 1 ? 'warn' : 'neutral' },
        { label: 'idem key', value: useKey ? KEY.slice(0, 8) + '..' : 'none', tone: useKey ? 'ok' : 'neutral' },
      ],
      onMessage: (p) => {
        if (p.label !== 'HTTP 200') return
        if (status !== 'processing') {
          sim.log(CLIENT, 'late response ignored, payment already resolved', 'info')
          return
        }
        status = 'success'
        clearPending()
        sim.log(CLIENT, 'response received, showing "payment successful"', 'ok', 'success')
      },
    })

    sim.addNode({
      id: GATEWAY,
      name: 'Payment API',
      role: 'Stateless gateway',
      chips: () => [{ label: 'forwarded', value: String(forwarded) }],
      onMessage: (p) => {
        if (p.label === 'POST /charge') {
          forwarded++
          sim.log(GATEWAY, 'forwarding DEBIT to bank', 'info')
          sim.send(GATEWAY, BANK, 'DEBIT', p.payload, { sub: p.sub })
        } else if (p.label === 'OK') {
          sim.send(GATEWAY, CLIENT, 'HTTP 200', p.payload, { channel: 'res' })
        }
      },
    })

    sim.addNode({
      id: BANK,
      name: 'Bank',
      role: 'Account ledger',
      chips: () => [
        { label: 'balance', value: inr(balance), tone: balance < OPENING - AMOUNT ? 'bad' : 'neutral' },
        { label: 'debits', value: String(charges.length), tone: charges.length > 1 ? 'bad' : 'neutral' },
      ],
      onMessage: (p) => {
        if (p.label !== 'DEBIT') return
        const req = p.payload as { key?: string; attempt: number }
        if (req.key && processed.has(req.key)) {
          sim.log(BANK, `DEBIT key=${req.key} already applied, replaying stored result`, 'ok', 'duplicate ignored')
          sim.send(BANK, GATEWAY, 'OK', { txn: processed.get(req.key) }, { channel: 'res' })
          return
        }
        balance -= AMOUNT
        const txn = `txn_${100 + charges.length + 1}`
        charges.push({ txn, attempt: req.attempt })
        if (req.key) processed.set(req.key, txn)
        const again = charges.length > 1
        sim.log(
          BANK,
          again
            ? `DEBIT ${AMOUNT} applied again as ${txn}, nothing marks it as a retry`
            : `DEBIT ${AMOUNT} applied as ${txn}, balance ${balance}`,
          again ? 'bad' : 'ok',
          `debit ${AMOUNT}`,
        )
        sim.send(BANK, GATEWAY, 'OK', { txn }, { channel: 'res' })
      },
    })

    if (opts.loseReply === true) {
      sim.armDrop((p) => p.from === BANK && p.label === 'OK')
    }

    const attempt = () => {
      if (status !== 'processing') return
      attempts++
      const retry = attempts > 1
      sim.log(
        CLIENT,
        `${retry ? `retry ${attempts - 1}: ` : ''}POST /charge amount=${AMOUNT}${useKey ? ` key=${KEY}` : ''}`,
        'info',
      )
      sim.send(CLIENT, GATEWAY, 'POST /charge', { amount: AMOUNT, key: useKey ? KEY : undefined, attempt: attempts }, {
        sub: useKey ? 'with key' : undefined,
      })
      pending.push(sim.timer(CLIENT, TIMEOUT, onTimeout))
    }

    const onTimeout = () => {
      if (status !== 'processing') return
      sim.mark(CLIENT, 'timeout', 'timeout')
      sim.log(CLIENT, `no response after ${TIMEOUT} ms, outcome unknown`, 'warn')
      if (attempts < MAX_ATTEMPTS) {
        pending.push(sim.timer(CLIENT, 300, attempt))
      } else {
        status = 'failed'
        sim.log(CLIENT, 'giving up, showing "payment failed"', 'bad', 'shows failure')
      }
    }

    return {
      sim,
      say: () => {
        const n = charges.length
        if (status === 'idle') return { text: 'Tap Pay on the phone, then watch the servers on the right handle the payment.' }
        if (n > 1) return { text: `The bank charged again. It cannot tell this is the same payment, so the customer is billed ${n} times.` }
        if (status === 'success')
          return {
            text:
              useKey && attempts > 1
                ? 'The bank recognised the same key, so it did not charge again. It just repeated its answer. Paid once.'
                : 'The reply arrived and the payment is confirmed. Charged once.',
          }
        if (status === 'failed')
          return { text: n === 1 ? 'The phone gave up and showed an error, but the bank did take the money.' : 'The phone gave up. Nothing was charged.' }
        if (attempts > 1)
          return {
            text: useKey
              ? 'No answer, so the phone asks again, with the same key as before.'
              : 'No answer, so the phone asks again. The bank has no way to know this is a repeat.',
          }
        if (n === 1 && opts.loseReply === true) return { text: 'The bank has taken the money, but its reply got lost on the way back. The phone is still waiting.' }
        return { text: 'The phone sends the payment through the Payment API to the bank.' }
      },
      view: 'sequence',
      layout: {
        nodes: {
          [CLIENT]: { x: -110, y: 280, icon: 'server', hidden: true },
          [GATEWAY]: { x: 380, y: 280, icon: 'gate', big: 'forwarded' },
          [BANK]: { x: 810, y: 280, icon: 'bank', big: 'balance' },
        },
        links: [
          [CLIENT, GATEWAY],
          [GATEWAY, BANK],
        ],
      },
      canCutNetwork: true,
      startLabel: `Pay ${inr(AMOUNT)}`,
      started: () => status !== 'idle',
      start: () => {
        status = 'processing'
        attempt()
        sim.touch()
      },
      checkout: () => ({
        heading: 'Order #4021',
        item: 'Mechanical keyboard',
        amount: inr(AMOUNT),
        status,
        message:
          status === 'idle'
            ? ''
            : status === 'processing'
              ? attempts > 1
                ? `Still working on it (attempt ${attempts})`
                : 'Processing payment'
              : status === 'success'
                ? 'Payment successful'
                : 'Payment failed. Please try again.',
      }),
      outcome: () => {
        const n = charges.length
        if (status === 'idle') return { tone: 'neutral', title: 'Not started', detail: 'Press Pay to place the order.' }
        if (n > 1)
          return {
            tone: 'bad',
            title: `Charged ${n} times`,
            detail: `The customer paid ${inr(AMOUNT * n)} for a ${inr(AMOUNT)} order. Balance is ${inr(balance)}.`,
          }
        if (n === 1 && status === 'success')
          return { tone: 'good', title: 'Charged exactly once', detail: `One debit of ${inr(AMOUNT)}. Balance is ${inr(balance)}.` }
        if (n === 1 && status === 'failed')
          return {
            tone: 'warn',
            title: 'Charged, but shown as failed',
            detail: 'The bank debited once, yet the customer saw an error. Money moved without a confirmation.',
          }
        if (status === 'failed') return { tone: 'neutral', title: 'No charge', detail: 'Payment failed and nothing was debited.' }
        return { tone: 'neutral', title: 'In progress', detail: 'Waiting for the bank to respond.' }
      },
    }
  },
}
