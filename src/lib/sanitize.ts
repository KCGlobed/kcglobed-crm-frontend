import DOMPurify from 'dompurify'

/**
 * Email/template bodies interpolate lead data (Meta Lead Ads, bulk uploads —
 * untrusted), so every string that reaches dangerouslySetInnerHTML goes
 * through DOMPurify first. Keeps normal formatting markup, strips scripts,
 * event handlers and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
