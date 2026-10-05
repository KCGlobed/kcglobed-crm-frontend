from django.urls import path

from . import views

integration_urls = [
    path('meta/forms', views.MetaFormsView.as_view()),
    path('meta/forms/<str:form_key>', views.MetaFormDetailView.as_view()),
    path('meta/events', views.MetaEventsView.as_view()),
    path('meta/events/<str:event_id>/retry', views.MetaEventRetryView.as_view()),
    path('meta/daily-check', views.MetaDailyCheckView.as_view()),
]
