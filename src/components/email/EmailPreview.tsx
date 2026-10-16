import { cn } from '../../lib/utils'
import { fillSamplePlaceholders, previewDocument } from '../../lib/emailPreview'

/**
 * An email as a mail client would show it: rendered inside a sandboxed iframe, so the emailer's own CSS
 * applies and nothing in it can run or touch the CRM page. `sample` fills the placeholders with sample
 * values (the designer); the send dialogs show the body as rendered for the lead.
 */
export function EmailPreview({
  html,
  sample = false,
  height = '24rem',
  width,
  className,
}: {
  html: string
  sample?: boolean
  /** CSS height of the frame */
  height?: string
  /** CSS width of the page inside the frame (e.g. 375px for a phone); full width by default */
  width?: string
  className?: string
}) {
  const doc = previewDocument(sample ? fillSamplePlaceholders(html) : html)
  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-200 bg-slate-100', className)} style={{ height }}>
      <iframe title="Email preview" sandbox="" srcDoc={doc} className="mx-auto block h-full bg-white" style={{ width: width ?? '100%' }} />
    </div>
  )
}
