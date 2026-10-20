import { backoff } from './backoff'
import { doubleCharge } from './doubleCharge'
import { saga } from './saga'
import { twoPhase } from './twoPhase'
import type { ScenarioDef } from './types'

export const SCENARIOS: ScenarioDef[] = [doubleCharge, backoff, twoPhase, saga]
