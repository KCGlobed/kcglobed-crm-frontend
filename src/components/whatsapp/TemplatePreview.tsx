import { Copy, ExternalLink, FileText, Image, List, MapPin, Phone, Reply, Video } from 'lucide-react'
import { orderWaButtons } from '../../lib/whatsappFormat'
import { cn } from '../../lib/utils'
import type { MessageTemplate } from '../../types/models'
import { WhatsAppText } from './WhatsAppText'

const BUTTON_ICONS: Record<string, typeof Reply> = { QUICK_REPLY: Reply, URL: ExternalLink, PHONE_NUMBER: Phone, OTP: Copy, COPY_CODE: Copy }

interface Props {
  headerFormat?: string
  headerText?: string
  /** an image header's picture (the uploaded sample); a placeholder without it */
  headerImageUrl?: string
  headerFileName?: string
  body: string
  footer?: string | null
  buttons?: { type: string; text: string }[]
  className?: string
}

/** A saved template's message (the send dialogs): its header, footer and buttons around the text as it goes out. */
export function WhatsAppTemplateMessage({ template, body, className }: { template: MessageTemplate; body: string; className?: string }) {
  const spec = template.waSpec
  const format = spec?.header.format
  return (
    <WhatsAppTemplatePreview
      headerFormat={format}
      headerText={spec?.header.text}
      headerImageUrl={format === 'IMAGE' ? template.waHeaderAsset?.url : undefined}
      headerFileName={format === 'DOCUMENT' ? template.waHeaderAsset?.name : undefined}
      body={body}
      footer={spec?.footer}
      buttons={spec?.auth ? [{ type: 'OTP', text: spec.auth.copyCodeText }] : spec?.buttons}
      className={className}
    />
  )
}

/**
 * A template message the way the lead's phone shows it (WhatsApp's chat colours, as in WhatsAppChat): header,
 * body with its formatting, grey footer and the buttons under it — more than three fold into "See all options".
 */
export function WhatsAppTemplatePreview({ headerFormat, headerText, headerImageUrl, headerFileName, body, footer, buttons = [], className }: Props) {
  const ordered = orderWaButtons(buttons)
  const shown = ordered.length > 3 ? ordered.slice(0, 2) : ordered
  return (
    <div className={cn('rounded-xl bg-[#efeae2] p-3', className)}>
      <div className="max-w-[320px] overflow-hidden rounded-lg rounded-tl-none bg-white text-slate-900 shadow-sm">
        {headerFormat === 'IMAGE' && (
          <div className="p-1">
            {headerImageUrl ? (
              <img src={headerImageUrl} alt="" className="aspect-[1.91/1] w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-md bg-slate-200 text-slate-400">
                <Image className="h-8 w-8" />
              </div>
            )}
          </div>
        )}
        {headerFormat === 'DOCUMENT' && (
          <div className="m-1 flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-2">
            <FileText className="h-7 w-7 shrink-0 text-red-500" />
            <span className="truncate text-xs text-slate-700">{headerFileName || 'document.pdf'}</span>
          </div>
        )}
        {(headerFormat === 'VIDEO' || headerFormat === 'LOCATION') && (
          <div className="m-1 flex aspect-[1.91/1] items-center justify-center gap-1.5 rounded-md bg-slate-200 text-xs text-slate-500">
            {headerFormat === 'VIDEO' ? <Video className="h-5 w-5" /> : <MapPin className="h-5 w-5" />} {headerFormat === 'VIDEO' ? 'Video' : 'Location'}
          </div>
        )}
        <div className="px-2.5 pb-1.5 pt-2 text-[13.5px] leading-snug">
          {headerFormat === 'TEXT' && headerText && <p className="mb-1 font-semibold">{headerText}</p>}
          {body ? <WhatsAppText text={body} /> : <span className="text-slate-400">Message text…</span>}
          {footer && <p className="mt-1 text-[12px] text-slate-500">{footer}</p>}
          <p className="mt-0.5 text-right text-[10px] text-slate-400">12:00</p>
        </div>
        {shown.map((b, i) => {
          const Icon = BUTTON_ICONS[b.type]
          return (
            <div key={i} className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-2 py-2 text-[13px] font-medium text-[#027eb5]">
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{b.text || 'Button'}</span>
            </div>
          )
        })}
        {ordered.length > 3 && (
          <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2 text-[13px] font-medium text-[#027eb5]">
            <List className="h-3.5 w-3.5" /> See all options
          </div>
        )}
      </div>
    </div>
  )
}
