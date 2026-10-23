/** The window event the popover fires so the lead page opens the outcome drawer for a call without a navigation. */
export const OPEN_DISPOSITION_EVENT = 'crm:open-disposition'

export interface OpenDispositionDetail {
  callId: string
  leadId: string
}

export function requestOpenDisposition(detail: OpenDispositionDetail) {
  window.dispatchEvent(new CustomEvent<OpenDispositionDetail>(OPEN_DISPOSITION_EVENT, { detail }))
}
