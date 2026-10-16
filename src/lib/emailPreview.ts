/** Helpers shared by the email designer, the send dialogs and the previews. */

/** A pasted emailer is a whole page (doctype / <html>); a visually edited body is a fragment. */
export const isHtmlDocument = (html: string) => /<!doctype\s+html/i.test(html) || /<html[\s>]/i.test(html)

/** What the designer's preview shows for each placeholder; the server fills the real lead at send time. */
export const SAMPLE_VALUES: Record<string, string> = {
  first_name: 'Asha',
  last_name: 'Rao',
  full_name: 'Asha Rao',
  lead_id: 'GCCSCH-2026-0000123',
  mobile: '98765 43210',
  alt_mobile: '98765 43211',
  email: 'asha.rao@example.com',
  city: 'Faridabad',
  state: 'Haryana',
  country: 'India',
  program_interest: 'Executive MBA',
  cohort: 'Jan 2027',
  stage: 'Interested',
  sub_stage: 'Brochure sent',
  source: 'Google Ads',
  first_source: 'Website',
  last_disposition: 'Call back',
  counsellor_name: 'Priya Nair',
  counsellor_mobile: '98765 00000',
  counsellor_email: 'priya@gccschool.com',
  created_date: '16 Oct 2026',
  lead_score: '72',
}

const PLACEHOLDER_RE = /\{([A-Za-z_]\w*)\}/g

/** Placeholders → sample values (custom fields show as [their key]; anything unknown stays as typed). */
export function fillSamplePlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, (m, key: string) => SAMPLE_VALUES[key] ?? (key.startsWith('custom_') ? `[${key.slice(7)}]` : m))
}

const BASE_CSS =
  'body{margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;background:#fff}img{max-width:100%;height:auto}a{color:#4f46e5}'

/** The document an <iframe srcdoc> renders: a whole emailer as it is, a fragment inside a plain mail-like page. */
export function previewDocument(html: string): string {
  if (isHtmlDocument(html)) return html
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${BASE_CSS}</style></head><body>${html}</body></html>`
}

/** A bulletproof call-to-action button (table-based, so Outlook renders it too). */
export function buttonHtml(text: string, url: string, color = '#4f46e5'): string {
  const safeText = text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string)
  const safeUrl = url.replace(/"/g, '%22')
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0"><tr>` +
    `<td style="background:${color};border-radius:6px"><a href="${safeUrl}" target="_blank" ` +
    `style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${safeText}</a></td>` +
    `</tr></table>`
  )
}

export const dividerHtml = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />'

export const imageHtml = (url: string, alt = '') =>
  `<img src="${url.replace(/"/g, '%22')}" alt="${alt.replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;display:block" />`

/** Wraps a fragment in the standard 600 px centred layout mail clients render consistently. */
export function wrapInEmailLayout(fragment: string): string {
  if (isHtmlDocument(fragment)) return fragment
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GCC School</title>
<style>
  body { margin: 0; padding: 0; background: #f3f4f6; }
  .wrapper { width: 100%; background: #f3f4f6; padding: 24px 0; }
  .container { width: 600px; max-width: 100%; margin: 0 auto; background: #ffffff; border-radius: 8px; }
  .content { padding: 32px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; }
  .footer { padding: 16px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #888888; text-align: center; }
  img { max-width: 100%; height: auto; }
  @media (max-width: 620px) { .content { padding: 20px !important; } }
</style>
</head>
<body>
<table role="presentation" class="wrapper" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
<table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0"><tr><td class="content">
${fragment}
</td></tr>
<tr><td class="footer">GCC School · This email was sent to {email}</td></tr>
</table>
</td></tr></table>
</body>
</html>`
}
