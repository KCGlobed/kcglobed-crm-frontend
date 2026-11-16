// a lead's own page (/app/leads/<id>), not the list or the bulk import
const LEAD_PAGE = /^\/app\/leads\/(?!import$)[^/]+$/

/**
 * Options for opening a lead's page from the calling UI: from one lead's page to another's, the new lead takes the
 * old one's place in the browser history, so Back goes to where the counsellor was before the leads (not lead by
 * lead through every one opened).
 */
export const leadNavOptions = () => ({ replace: LEAD_PAGE.test(window.location.pathname) })
