import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  AutomationRuleRow,
  CampaignPreview,
  CampaignRecipient,
  CampaignRow,
  LeadMessage,
  MessagePreview,
  MessageTemplate,
  MetaEventRow,
  MetaFormMappingRow,
  ScheduledSend,
  WhatsAppChat,
  WhatsAppChatMessage,
} from '../types/models'

export interface MessagingOptions {
  placeholders: string[]
  triggers: { value: string; label: string; channels: string[] }[]
  channels: { value: string; label: string }[]
  bulkWindow: string
  bulkMax: number
  /** "meta" when the WhatsApp Cloud API is connected (template sync available); "console" only logs */
  whatsappProvider?: string
  /** what a {#var#} value may name instead of typed text ("{first_name}"), incl. active custom lead fields */
  leadFields: { value: string; label: string }[]
}

export interface CampaignBody {
  channel: 'sms' | 'email' | 'whatsapp'
  template: string
  name?: string
  scheduledAt?: string
  preview?: boolean
  /** SMS: the {#var#} values typed for the template, in order — the same for every recipient */
  variables?: string[]
  audience: { leadIds?: string[]; selectAll?: boolean; filters?: Record<string, unknown> }
}

/** SMS / email (GL-21..25) and the Meta integration screens (GL-09). */
export const messagingApi = api.injectEndpoints({
  endpoints: (build) => ({
    messagingOptions: build.query<ApiResponse<MessagingOptions>, void>({
      query: () => '/messaging/options',
    }),
    listMessageTemplates: build.query<ApiResponse<MessageTemplate[]>, { channel?: string; active?: boolean }>({
      query: ({ channel, active }) => ({
        url: '/messaging/templates',
        params: { ...(channel ? { channel } : {}), ...(active ? { active: 'true' } : {}) },
      }),
      providesTags: ['MessageTemplates'],
    }),
    saveMessageTemplate: build.mutation<ApiResponse<MessageTemplate>, { id?: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: id ? `/messaging/templates/${id}` : '/messaging/templates', method: id ? 'PUT' : 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['MessageTemplates', 'Automations']),
    }),
    listAutomations: build.query<ApiResponse<AutomationRuleRow[]>, void>({
      query: () => '/messaging/automations',
      providesTags: ['Automations'],
    }),
    updateAutomation: build.mutation<ApiResponse<AutomationRuleRow>, { id: string; body: { isActive?: boolean; template?: string | null } }>({
      query: ({ id, body }) => ({ url: `/messaging/automations/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['Automations']),
    }),
    listCampaigns: build.query<ApiResponse<CampaignRow[]>, void>({
      query: () => '/messaging/campaigns',
      providesTags: ['Campaigns'],
    }),
    getCampaign: build.query<ApiResponse<CampaignRow>, string>({
      query: (id) => `/messaging/campaigns/${id}`,
      providesTags: ['Campaigns'],
    }),
    /** Who a bulk send went to, one row per recipient with the live status (the Activity Log drill-down). */
    campaignRecipients: build.query<
      ApiListResponse<CampaignRecipient>,
      { id: string; page?: number; page_size?: number; status?: string; search?: string }
    >({
      query: ({ id, ...params }) => ({
        url: `/messaging/campaigns/${id}/recipients`,
        params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')),
      }),
      providesTags: ['Campaigns'],
    }),
    createCampaign: build.mutation<ApiResponse<CampaignPreview>, CampaignBody>({
      query: (body) => ({ url: '/messaging/campaigns', method: 'POST', body }),
      invalidatesTags: (_r, error, { preview }) => (error || preview ? [] : ['Campaigns', 'Notifications']),
    }),
    cancelCampaign: build.mutation<ApiResponse<CampaignRow>, string>({
      query: (id) => ({ url: `/messaging/campaigns/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['Campaigns'],
    }),
    /** Pulls the templates approved in WhatsApp Manager into the Templates tab. */
    syncWhatsAppTemplates: build.mutation<ApiResponse<{ total: number; created: number; updated: number; approved: number; skipped: number }>, void>({
      query: () => ({ url: '/messaging/whatsapp/sync-templates', method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['MessageTemplates', 'Automations']),
    }),
    leadMessages: build.query<ApiResponse<LeadMessage[]>, string>({
      query: (id) => `/leads/${id}/messages`,
      providesTags: ['LeadMessages'],
    }),
    previewLeadMessage: build.mutation<ApiResponse<MessagePreview>, { id: string; template: string; variables?: string[] }>({
      query: ({ id, template, variables }) => ({ url: `/leads/${id}/messages/preview`, method: 'POST', body: { template, variables } }),
    }),
    /** Sends now, or with `scheduledAt` in the body puts the message on the clock (status scheduled). */
    sendLeadMessage: build.mutation<ApiResponse<LeadMessage>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/leads/${id}/messages`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) =>
        error ? [] : ['LeadMessages', 'Campaigns', { type: 'LeadTimeline', id }, { type: 'Lead', id }, { type: 'WhatsAppChat', id }],
    }),
    /** Activity Log → Scheduled: bulk sends and single messages waiting for their time, in one list. */
    scheduledSends: build.query<ApiListResponse<ScheduledSend>, Record<string, unknown>>({
      query: (params) => ({
        url: '/messaging/scheduled',
        params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')),
      }),
      providesTags: ['Campaigns'],
    }),
    cancelScheduledMessage: build.mutation<ApiResponse<LeadMessage>, string>({
      query: (id) => ({ url: `/messaging/messages/${id}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Campaigns', 'LeadMessages', 'LeadTimeline']),
    }),
    sendScheduledMessageNow: build.mutation<ApiResponse<LeadMessage>, string>({
      query: (id) => ({ url: `/messaging/messages/${id}/send-now`, method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Campaigns', 'LeadMessages', 'LeadTimeline']),
    }),
    sendCampaignNow: build.mutation<ApiResponse<CampaignRow>, string>({
      query: (id) => ({ url: `/messaging/campaigns/${id}/send-now`, method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Campaigns']),
    }),
    /** The lead's WhatsApp thread, both directions; fetching it marks the lead's replies as read. */
    whatsAppChat: build.query<ApiResponse<WhatsAppChat>, string>({
      query: (id) => `/leads/${id}/whatsapp/chat`,
      providesTags: (_r, _e, id) => [{ type: 'WhatsAppChat', id }],
    }),
    /** A typed reply — accepted only inside the 24-hour window after the lead's last message. */
    sendWhatsAppText: build.mutation<ApiResponse<WhatsAppChatMessage>, { id: string; text: string }>({
      query: ({ id, text }) => ({ url: `/leads/${id}/whatsapp/chat`, method: 'POST', body: { text } }),
      invalidatesTags: (_r, error, { id }) =>
        error ? [] : [{ type: 'WhatsAppChat', id }, 'LeadMessages', { type: 'LeadTimeline', id }, { type: 'Lead', id }],
    }),

    metaForms: build.query<ApiResponse<{ fields: { value: string; label: string }[]; forms: MetaFormMappingRow[] }>, void>({
      query: () => '/integrations/meta/forms',
      providesTags: ['MetaIntegration'],
    }),
    saveMetaForm: build.mutation<ApiResponse<MetaFormMappingRow>, { formId: string; body: Record<string, unknown> }>({
      query: ({ formId, body }) => ({ url: `/integrations/meta/forms/${encodeURIComponent(formId)}`, method: 'PUT', body }),
      invalidatesTags: ['MetaIntegration'],
    }),
    metaEvents: build.query<ApiResponse<MetaEventRow[]>, string | void>({
      query: (status) => ({ url: '/integrations/meta/events', params: status ? { status } : {} }),
      providesTags: ['MetaIntegration'],
    }),
    retryMetaEvent: build.mutation<ApiResponse<MetaEventRow & { outcome: string }>, string>({
      query: (id) => ({ url: `/integrations/meta/events/${id}/retry`, method: 'POST' }),
      invalidatesTags: ['MetaIntegration', { type: 'Leads', id: 'LIST' }],
    }),
    metaDailyCheck: build.query<
      ApiResponse<{ date: string; forms: { formId: string; formName?: string; metaCount: number | null; crmCount: number; newLeads: number; match: boolean }[] }>,
      string | void
    >({
      query: (date) => ({ url: '/integrations/meta/daily-check', params: date ? { date } : {} }),
      providesTags: ['MetaIntegration'],
    }),
  }),
})

export const {
  useMessagingOptionsQuery,
  useListMessageTemplatesQuery,
  useSaveMessageTemplateMutation,
  useListAutomationsQuery,
  useUpdateAutomationMutation,
  useListCampaignsQuery,
  useGetCampaignQuery,
  useCampaignRecipientsQuery,
  useCreateCampaignMutation,
  useCancelCampaignMutation,
  useSyncWhatsAppTemplatesMutation,
  useWhatsAppChatQuery,
  useSendWhatsAppTextMutation,
  useLeadMessagesQuery,
  usePreviewLeadMessageMutation,
  useSendLeadMessageMutation,
  useScheduledSendsQuery,
  useCancelScheduledMessageMutation,
  useSendScheduledMessageNowMutation,
  useSendCampaignNowMutation,
  useMetaFormsQuery,
  useSaveMetaFormMutation,
  useMetaEventsQuery,
  useRetryMetaEventMutation,
  useMetaDailyCheckQuery,
} = messagingApi
