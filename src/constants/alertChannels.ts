import { BellOff, BellRing, Mail, MailX, MessageSquareOff, MessageSquareText, type LucideIcon } from 'lucide-react'
import type { MyAlerts } from '../types/models'

/** The three alert channels a user can switch off (Users & Access form, a Super Admin's profile menu). */
export const ALERT_CHANNELS: { key: keyof MyAlerts; label: string; on: LucideIcon; off: LucideIcon }[] = [
  { key: 'email', label: 'Email', on: Mail, off: MailX },
  { key: 'sms', label: 'SMS', on: MessageSquareText, off: MessageSquareOff },
  { key: 'push', label: 'Push', on: BellRing, off: BellOff },
]
