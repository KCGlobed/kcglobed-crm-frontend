from django.urls import path

from . import views

messaging_urls = [
    path('options', views.MessagingOptionsView.as_view()),
    path('templates', views.TemplateListView.as_view()),
    path('templates/<str:template_id>', views.TemplateDetailView.as_view()),
    path('automations', views.AutomationListView.as_view()),
    path('automations/<str:rule_id>', views.AutomationDetailView.as_view()),
    path('campaigns', views.CampaignListView.as_view()),
    path('campaigns/<str:campaign_id>', views.CampaignDetailView.as_view()),
    path('campaigns/<str:campaign_id>/cancel', views.CampaignCancelView.as_view()),
]

messaging_webhook_urls = [
    path('messaging/status', views.DeliveryStatusWebhook.as_view()),
    path('messaging/inbound-sms', views.InboundSmsWebhook.as_view()),
]
