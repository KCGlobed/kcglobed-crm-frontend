from django.urls import path

from . import views

# Static paths first so they are not captured by <team_id>.
urlpatterns = [
    path('options', views.TeamOptionsView.as_view()),
    path('tree', views.TeamTreeView.as_view()),
    path('', views.TeamListView.as_view()),
    path('<str:team_id>', views.TeamDetailView.as_view()),
    path('<str:team_id>/stats', views.TeamStatsView.as_view()),
    path('<str:team_id>/members', views.TeamMembersView.as_view()),
    path('<str:team_id>/members/<str:user_id>', views.TeamMemberDetailView.as_view()),
]
