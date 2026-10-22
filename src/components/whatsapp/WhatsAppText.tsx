import { parseWhatsApp } from '../../lib/whatsappFormat'
import { cn } from '../../lib/utils'

/** Text as WhatsApp shows it: *bold*, _italic_, ~strike~, ```monospace``` and line breaks. */
export function WhatsAppText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {parseWhatsApp(text).map((s, i) => (
        <span key={i} className={cn(s.bold && 'font-semibold', s.italic && 'italic', s.strike && 'line-through', s.mono && 'font-mono text-[0.92em]')}>
          {s.text}
        </span>
      ))}
    </span>
  )
}
