import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRightLeft,
  Bell,
  CalendarClock,
  Download,
  Hourglass,
  Inbox,
  Languages,
  MessageCircle,
  PhoneIncoming,
  PhoneMissed,
  PlugZap,
  Repeat,
  Send,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { authorizedDownload } from '../../lib/download'
import type { Notification as CrmNotification } from '../../types/models'

/** Shared by the bell and the Notifications page: each alert type's icon and tint. */
export const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; className: string }> = {
  lead_assigned: { icon: UserPlus, className: 'bg-brand-50 text-brand-600' },
  lead_reassigned: { icon: ArrowRightLeft, className: 'bg-amber-50 text-amber-700' },
  task_due: { icon: CalendarClock, className: 'bg-amber-50 text-amber-700' },
  task_overdue: { icon: AlarmClock, className: 'bg-red-50 text-red-600' },
  re_enquiry: { icon: Repeat, className: 'bg-sky-50 text-sky-700' },
  unassigned_pool: { icon: Inbox, className: 'bg-amber-50 text-amber-700' },
  untouched: { icon: Hourglass, className: 'bg-amber-50 text-amber-700' },
  language_barrier: { icon: Languages, className: 'bg-pink-50 text-pink-600' },
  bulk_done: { icon: Send, className: 'bg-emerald-50 text-emerald-700' },
  whatsapp_reply: { icon: MessageCircle, className: 'bg-emerald-50 text-emerald-700' },
  team_alert: { icon: Bell, className: 'bg-brand-50 text-brand-600' },
  whatsapp_unknown: { icon: MessageCircle, className: 'bg-amber-50 text-amber-700' },
  whatsapp_template: { icon: MessageCircle, className: 'bg-emerald-50 text-emerald-700' },
  export_ready: { icon: Download, className: 'bg-emerald-50 text-emerald-700' },
  integration_error: { icon: PlugZap, className: 'bg-red-50 text-red-600' },
  incoming_call: { icon: PhoneIncoming, className: 'bg-emerald-50 text-emerald-700' },
  missed_call: { icon: PhoneMissed, className: 'bg-red-50 text-red-600' },
  system: { icon: Sparkles, className: 'bg-slate-100 text-slate-500' },
}

/** Where a click on a notification goes: the lead, a filtered list, or a file. */
export function useOpenNotification() {
  const navigate = useNavigate()
  return useCallback(
    (n: CrmNotification) => {
      // a WhatsApp reply opens the lead's chat; a message from a number not in the CRM, its Activity Log entries
      if (n.type === 'whatsapp_reply' && n.data?.leadId) navigate(`/app/leads/${n.data.leadId}?tab=whatsapp`)
      else if (n.type === 'whatsapp_unknown') navigate('/app/admin/audit?tab=communications&action=whatsapp_unknown_reply')
      // a dialer call: the lead page opens its outcome drawer once the call has ended
      else if (n.data?.leadId && n.data?.callId) navigate(`/app/leads/${n.data.leadId}?disposition=${n.data.callId}`)
      else if (n.data?.leadId) navigate(`/app/leads/${n.data.leadId}`)
      else if (n.data?.smart) navigate(`/app/leads?smart=${n.data.smart}`)
      else if (n.data?.templateId) navigate(`/app/admin/messaging/whatsapp/${n.data.templateId}`)
      else if (n.data?.url)
        authorizedDownload(n.data.url, 'leads-export.xlsx').catch(() => toast.error('This download link has expired'))
      else if (n.data?.errorFile)
        authorizedDownload(`/leads/import/errors/${n.data.errorFile}`, 'upload-errors.xlsx').catch(() =>
          toast.error('Error file not found')
        )
      else if (n.type === 'integration_error') navigate('/app/admin/integrations')
    },
    [navigate]
  )
}
