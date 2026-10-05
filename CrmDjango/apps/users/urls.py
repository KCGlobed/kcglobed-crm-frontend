from django.urls import path

from . import views

user_urls = [
    path('options', views.UserOptionsView.as_view()),
    path('', views.UserListView.as_view()),
    path('<str:user_id>', views.UserDetailView.as_view()),
    path('<str:user_id>/permissions', views.UserPermissionsView.as_view()),
    path('<str:user_id>/reactivate', views.UserReactivateView.as_view()),
    path('<str:user_id>/resend-credentials', views.ResendCredentialsView.as_view()),
]

template_urls = [
    path('', views.TemplateListView.as_view()),
    path('<str:template_id>', views.TemplateDetailView.as_view()),
]
