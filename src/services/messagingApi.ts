import { api } from './api'
import type {
  ApiResponse,
  AutomationRuleRow,
  CampaignPreview,
  CampaignRow,
  LeadMessage,
  MessagePreview,
  MessageTemplate,
  MetaEventRow,
  MetaFormMappingRow,
} from '../types/models'

export interface MessagingOptions {
  placeholders: string[]
  triggers: { value: string; label: string; channels: string[] }[]
  channels: { value: string; label: string }[]
  bulkWindow: string
  bulkMax: number
}

export interface CampaignBody {
  channel: 'sms' | 'email'
  template: string
  name?: string
  scheduledAt?: string
  preview?: boolean
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
    createCampaign: build.mutation<ApiResponse<CampaignPreview>, CampaignBody>({
      query: (body) => ({ url: '/messaging/campaigns', method: 'POST', body }),
      invalidatesTags: (_r, error, { preview }) => (error || preview ? [] : ['Campaigns', 'Notifications']),
    }),
    cancelCampaign: build.mutation<ApiResponse<CampaignRow>, string>({
      query: (id) => ({ url: `/messaging/campaigns/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['Campaigns'],
    }),
    leadMessages: build.query<ApiResponse<LeadMessage[]>, string>({
      query: (id) => `/leads/${id}/messages`,
      providesTags: ['LeadMessages'],
    }),
    previewLeadMessage: build.mutation<ApiResponse<MessagePreview>, { id: string; template: string }>({
      query: ({ id, template }) => ({ url: `/leads/${id}/messages/preview`, method: 'POST', body: { template } }),
    }),
    sendLeadMessage: build.mutation<ApiResponse<LeadMessage>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/leads/${id}/messages`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : ['LeadMessages', { type: 'LeadTimeline', id }, { type: 'Lead', id }]),
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
  useCreateCampaignMutation,
  useCancelCampaignMutation,
  useLeadMessagesQuery,
  usePreviewLeadMessageMutation,
  useSendLeadMessageMutation,
  useMetaFormsQuery,
  useSaveMetaFormMutation,
  useMetaEventsQuery,
  useRetryMetaEventMutation,
  useMetaDailyCheckQuery,
} = messagingApi
