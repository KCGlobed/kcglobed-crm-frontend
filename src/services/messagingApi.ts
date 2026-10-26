import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  AutomationBody,
  AutomationRow,
  CampaignPreview,
  CampaignRecipient,
  CampaignRow,
  FilterCondition,
  LeadMessage,
  MessageAsset,
  MessagePreview,
  MessageTemplate,
  MetaEventRow,
  SavedText,
  MetaFormMappingRow,
  ScheduledSend,
  StaffAlertBody,
  StaffAlertRow,
  StaffAlertTestResult,
  StaffAlertsResponse,
  WhatsAppChat,
  WhatsAppChatMessage,
} from '../types/models'

export interface MessagingOptions {
  placeholders: string[]
  triggers: { value: string; label: string; channels: string[] }[]
  channels: { value: string; label: string }[]
  /** Automation tab: when a rule runs, how a schedule repeats, and the day labels (Monday = 0) */
  triggerTypes?: { value: string; label: string }[]
  recurrences?: { value: string; label: string }[]
  weekdays?: { value: number; label: string }[]
  bulkWindow: string
  bulkMax: number
  /** "meta" when the WhatsApp Cloud API is connected (template sync available); "console" only logs */
  whatsappProvider?: string
  /** the WhatsApp builder's choices: Meta's language codes and template categories */
  whatsappLanguages?: { value: string; label: string }[]
  whatsappCategories?: { value: string; label: string }[]
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
    /** Super Admin only; refused while campaigns or automations still use the template. */
    deleteMessageTemplate: build.mutation<ApiResponse<{ _id: string; name: string }>, string>({
      query: (id) => ({ url: `/messaging/templates/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['MessageTemplates', 'Automations']),
    }),
    /** Saved texts for template variables (Communication → Texts); active=true is what the send dialogs offer. */
    listSavedTexts: build.query<ApiResponse<SavedText[]>, { active?: boolean } | void>({
      query: (arg) => ({ url: '/messaging/texts', params: arg && arg.active ? { active: 'true' } : {} }),
      providesTags: ['SavedTexts'],
    }),
    saveSavedText: build.mutation<ApiResponse<SavedText>, { id?: string; body: { name: string; text: string; isActive: boolean } }>({
      query: ({ id, body }) => ({ url: id ? `/messaging/texts/${id}` : '/messaging/texts', method: id ? 'PUT' : 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['SavedTexts']),
    }),
    deleteSavedText: build.mutation<ApiResponse<{ _id: string }>, string>({
      query: (id) => ({ url: `/messaging/texts/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['SavedTexts']),
    }),
    /** Images for emailers: uploaded into the CRM, served publicly so mail clients can load them. */
    listMessageAssets: build.query<ApiResponse<MessageAsset[]>, void>({
      query: () => '/messaging/assets',
      providesTags: ['MessageAssets'],
    }),
    uploadMessageAsset: build.mutation<ApiResponse<MessageAsset>, FormData>({
      query: (body) => ({ url: '/messaging/assets', method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['MessageAssets']),
    }),
    deleteMessageAsset: build.mutation<ApiResponse<{ _id: string }>, string>({
      query: (id) => ({ url: `/messaging/assets/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['MessageAssets']),
    }),
    /** Files attached to emails (PDF, Office, images), uploaded into the CRM. */
    uploadMessageAttachment: build.mutation<ApiResponse<MessageAsset>, FormData>({
      query: (body) => ({ url: '/messaging/attachments', method: 'POST', body }),
    }),
    /** The email designer's draft to the signed-in user's own inbox. */
    sendTestEmail: build.mutation<ApiResponse<{ to: string; status: string; provider?: string }>, { subject: string; body: string; attachments?: string[] }>({
      query: (body) => ({ url: '/messaging/templates/test-email', method: 'POST', body }),
    }),
    /** Communication → Automation: the rules that send a template on a lead event or a schedule. */
    listAutomations: build.query<ApiResponse<AutomationRow[]>, void>({
      query: () => '/messaging/automations',
      providesTags: ['Automations'],
    }),
    createAutomation: build.mutation<ApiResponse<AutomationRow>, AutomationBody>({
      query: (body) => ({ url: '/messaging/automations', method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['Automations']),
    }),
    /** Edits the fields sent; `{ isActive }` alone switches the automation on or off. */
    updateAutomation: build.mutation<ApiResponse<AutomationRow>, { id: string; body: AutomationBody }>({
      query: ({ id, body }) => ({ url: `/messaging/automations/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['Automations', 'Campaigns']),
    }),
    deleteAutomation: build.mutation<ApiResponse<{ _id: string; name: string; channel: string; cancelled: number }>, string>({
      query: (id) => ({ url: `/messaging/automations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Automations', 'Campaigns']),
    }),
    /** How many leads the conditions reach right now on the channel (the form's live count). */
    previewAutomationAudience: build.mutation<
      ApiResponse<{ matching: number; final: number; excluded: { optedOut: number; invalid: number; duplicate: number } }>,
      { channel: string; conditions: FilterCondition[] }
    >({
      query: (body) => ({ url: '/messaging/automations/preview', method: 'POST', body }),
    }),
    /** Communication → Automation → Counsellor alerts: the three staff-facing alerts' wording, channels and windows. */
    listStaffAlerts: build.query<ApiResponse<StaffAlertsResponse>, void>({
      query: () => '/notifications/alerts',
      providesTags: ['StaffAlerts'],
    }),
    /** Edits the fields sent; `{ isActive }` alone switches the alert on or off. */
    updateStaffAlert: build.mutation<ApiResponse<StaffAlertRow>, { trigger: string; body: StaffAlertBody }>({
      query: ({ trigger, body }) => ({ url: `/notifications/alerts/${trigger}`, method: 'PUT', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['StaffAlerts']),
    }),
    /** The draft on screen (or the saved alert) to the signed-in user with sample values, on every channel it has on. */
    /** Team alerts → Add alert: a new alert on a lead event. */
    createStaffAlert: build.mutation<ApiResponse<StaffAlertRow>, StaffAlertBody>({
      query: (body) => ({ url: '/notifications/alerts', method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['StaffAlerts']),
    }),
    /** An added alert only (the built-in ones are switched off instead); `key` is its id. */
    deleteStaffAlert: build.mutation<ApiResponse<{ _id: string; name: string }>, string>({
      query: (key) => ({ url: `/notifications/alerts/${key}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['StaffAlerts']),
    }),
    testStaffAlert: build.mutation<ApiResponse<StaffAlertTestResult>, { trigger: string; body: StaffAlertBody }>({
      query: ({ trigger, body }) => ({ url: `/notifications/alerts/${trigger}/test`, method: 'POST', body }),
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
    /** Cancels a scheduled bulk send, or Stops one that is sending / paused (what is still queued never goes out). */
    cancelCampaign: build.mutation<ApiResponse<CampaignRow>, string>({
      query: (id) => ({ url: `/messaging/campaigns/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['Campaigns'],
    }),
    pauseCampaign: build.mutation<ApiResponse<CampaignRow>, string>({
      query: (id) => ({ url: `/messaging/campaigns/${id}/pause`, method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Campaigns']),
    }),
    /** A paused bulk send, or one a server restart left stalled: sends only the recipients still queued. */
    resumeCampaign: build.mutation<ApiResponse<CampaignRow>, string>({
      query: (id) => ({ url: `/messaging/campaigns/${id}/resume`, method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Campaigns']),
    }),
    /** Pulls the templates approved in WhatsApp Manager into the Templates tab. */
    syncWhatsAppTemplates: build.mutation<ApiResponse<{ total: number; created: number; updated: number; approved: number; skipped: number; removed: number }>, void>({
      query: () => ({ url: '/messaging/whatsapp/sync-templates', method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['MessageTemplates', 'Automations']),
    }),
    /** WhatsApp builder → "Submit for review": the draft goes to Meta; its verdict arrives on the webhook. */
    submitWhatsAppTemplate: build.mutation<ApiResponse<MessageTemplate>, string>({
      query: (id) => ({ url: `/messaging/whatsapp/templates/${id}/submit`, method: 'POST' }),
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
  useDeleteMessageTemplateMutation,
  useListSavedTextsQuery,
  useSaveSavedTextMutation,
  useDeleteSavedTextMutation,
  useListMessageAssetsQuery,
  useUploadMessageAssetMutation,
  useDeleteMessageAssetMutation,
  useUploadMessageAttachmentMutation,
  useSendTestEmailMutation,
  useListAutomationsQuery,
  useCreateAutomationMutation,
  useUpdateAutomationMutation,
  useDeleteAutomationMutation,
  usePreviewAutomationAudienceMutation,
  useListStaffAlertsQuery,
  useUpdateStaffAlertMutation,
  useCreateStaffAlertMutation,
  useDeleteStaffAlertMutation,
  useTestStaffAlertMutation,
  useListCampaignsQuery,
  useGetCampaignQuery,
  useCampaignRecipientsQuery,
  useCreateCampaignMutation,
  useCancelCampaignMutation,
  usePauseCampaignMutation,
  useResumeCampaignMutation,
  useSyncWhatsAppTemplatesMutation,
  useSubmitWhatsAppTemplateMutation,
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
