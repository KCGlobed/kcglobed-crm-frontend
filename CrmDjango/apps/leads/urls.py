from django.urls import path

from apps.integrations.views import MetaWebhookView
from apps.messaging.views import LeadMessagePreviewView, LeadMessagesView

from . import views

# Static paths before <lead_id>.
lead_urls = [
    path('capture', views.CaptureView.as_view()),
    path('check-duplicate', views.CheckDuplicateView.as_view()),
    path('filter-fields', views.FilterFieldsView.as_view()),
    path('saved-filters', views.SavedFilterListView.as_view()),
    path('saved-filters/<str:filter_id>', views.SavedFilterDetailView.as_view()),
    path('search', views.GlobalSearchView.as_view()),
    path('my-day', views.MyDayView.as_view()),
    path('disposition-options', views.DispositionOptionsView.as_view()),
    path('profile-options', views.ProfileOptionsView.as_view()),
    path('export', views.LeadExportView.as_view()),
    path('exports/<str:export_id>', views.ExportJobView.as_view()),
    path('exports/<str:export_id>/download', views.ExportDownloadView.as_view()),
    path('import/template', views.ImportTemplateView.as_view()),
    path('import/preview', views.ImportPreviewView.as_view()),
    path('import/errors/<str:name>', views.ImportErrorFileView.as_view()),
    path('bulk-upload', views.LeadBulkUploadView.as_view()),
    path('bulk-assign', views.BulkAssignView.as_view()),
    path('', views.LeadListView.as_view()),
    path('<str:lead_id>', views.LeadDetailView.as_view()),
    path('<str:lead_id>/assign', views.LeadAssignView.as_view()),
    path('<str:lead_id>/disposition', views.LeadDispositionView.as_view()),
    path('<str:lead_id>/calls', views.LeadCallsView.as_view()),
    path('<str:lead_id>/notes', views.LeadNotesView.as_view()),
    path('<str:lead_id>/notes/<str:note_id>', views.LeadNoteDetailView.as_view()),
    path('<str:lead_id>/timeline', views.LeadTimelineView.as_view()),
    path('<str:lead_id>/history', views.LeadHistoryView.as_view()),
    path('<str:lead_id>/discussion', views.LeadDiscussionView.as_view()),
    path('<str:lead_id>/documents', views.LeadDocumentsView.as_view()),
    path('<str:lead_id>/documents/<str:document_id>/download', views.LeadDocumentDownloadView.as_view()),
    path('<str:lead_id>/messages', LeadMessagesView.as_view()),
    path('<str:lead_id>/messages/preview', LeadMessagePreviewView.as_view()),
    # Student profile (Go-live GL-14)
    path('<str:lead_id>/profile', views.ProfileView.as_view()),
    path('<str:lead_id>/profile/personal', views.ProfilePersonalView.as_view()),
    path('<str:lead_id>/profile/academic', views.ProfileAcademicView.as_view()),
    path('<str:lead_id>/profile/work', views.ProfileWorkView.as_view()),
    path('<str:lead_id>/profile/declaration', views.ProfileDeclarationView.as_view()),
    path('<str:lead_id>/profile/unlock', views.ProfileUnlockView.as_view()),
]

webhook_urls = [
    path('meta-leads', MetaWebhookView.as_view()),
    path('google-leads', views.GoogleWebhookView.as_view()),
]
