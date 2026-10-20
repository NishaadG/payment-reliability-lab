# Payment reliability lab

Interactive simulation for the Distributed Computing Systems FA2 case study:
**Reliable Online Payment Processing During Network Failures**.

Everything runs in the browser. A small discrete-event engine (`src/engine/sim.ts`) simulates nodes,
an unreliable network, crashes, timers and durable logs. Four scenarios sit on top of it:

1. **Double charge** - the bank debits, the reply is lost, the client retries. Idempotency keys fix it.
2. **Retries** - fixed, exponential and jittered retry after an outage, compared on the same seed.
3. **Two-phase commit** - prepare, decide, commit, with coordinator crashes at each phase and log recovery.
4. **Saga** - local transactions with compensating refunds when a later step fails.

Controls: cut or restore the network at any moment, crash or restart any node from its card, pause, change speed.

## Run

```
npm install
npm run dev
```

`npm run build` produces a static site in `dist/`.
