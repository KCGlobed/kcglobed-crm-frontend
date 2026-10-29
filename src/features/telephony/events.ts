/** The window event the popover fires so the lead page opens the outcome drawer for a call without a navigation. */
export const OPEN_DISPOSITION_EVENT = 'crm:open-disposition'

export interface OpenDispositionDetail {
  callId: string
  leadId: string
}

export function requestOpenDisposition(detail: OpenDispositionDetail) {
  window.dispatchEvent(new CustomEvent<OpenDispositionDetail>(OPEN_DISPOSITION_EVENT, { detail }))
}

/** The window event that opens / closes the Dialer drawer (DialerPanel) from anywhere — the header button. */
export const DIALER_TOGGLE_EVENT = 'crm:dialer-toggle'

export function toggleDialer(open?: boolean) {
  window.dispatchEvent(new CustomEvent<boolean | undefined>(DIALER_TOGGLE_EVENT, { detail: open }))
}

/** The window event that starts the dialer session — the leads list's "Progressive call". The Dialer drawer stays as
 * it is: the run shows in the Progressive calling panel. */
export const DIALER_START_EVENT = 'crm:dialer-start'

export function startDialer() {
  window.dispatchEvent(new Event(DIALER_START_EVENT))
}
