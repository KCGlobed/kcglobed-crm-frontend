from django.urls import path

from . import views

urlpatterns = [
    path('bootstrap', views.BootstrapView.as_view()),
    path('<str:type_key>', views.MasterListView.as_view()),
    path('<str:type_key>/<str:object_id>', views.MasterDetailView.as_view()),
]
