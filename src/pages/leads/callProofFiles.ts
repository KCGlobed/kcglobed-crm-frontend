import type { CallProofFile } from '../../types/models'

/** What the proof dialogs need of a call: the lead's call list and the Attendance "Call Proofs" list both carry it. */
export interface ProofCall {
  _id: string
  source?: string
  durationSeconds?: number | null
  stage?: string | null
  subStage?: string | null
  screenshot?: CallProofFile | null
  screenshots?: CallProofFile[]
  recording?: CallProofFile | null
}

/** The protected file of a call's screenshot or recording (inline; `?download=1` downloads it). */
export const proofPath = (callId: string, proof: CallProofFile) => `/calls/${callId}/proofs/${proof._id}`

/** Every screenshot of a call, in upload order (older rows carry only the first one). */
export const callScreenshots = (call: ProofCall): CallProofFile[] =>
  call.screenshots?.length ? call.screenshots : call.screenshot ? [call.screenshot] : []
