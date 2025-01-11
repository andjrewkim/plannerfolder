# urls.py
from django.urls import path
from . import views
from . import views_settings
from .views_api import CalendarEventCreate  # Import your view for handling events
from .views_todo import TodoTaskCreate
from .view_dispatcher import ScheduleInputDispatcher

urlpatterns = [
    path('', views.home, name='home'),  # Home page route
    path('settings/', views_settings.settings, name='settings'),  # Add the settings URL pattern
    path('api/events/', CalendarEventCreate.as_view(), name='create_event'),
    path('api/events/<int:event_id>/', CalendarEventCreate.as_view(), name='delete_event'),
    path('api/tasks/', TodoTaskCreate.as_view(), name='create_task'),  # Added trailing slash
    path('api/tasks/<int:task_id>/', TodoTaskCreate.as_view(), name='update_task'),
    path('api/schedule/', ScheduleInputDispatcher.as_view(), name='schedule-dispatcher'),
    path('api/get-csrf-token/', views.get_csrf_token),
]
