# urls.py
from django.urls import path, include
from . import views
from . import views_settings
from .views_api import CalendarEventCreate  # Import your view for handling events
from .views_todo import TodoTaskCreate
from .view_dispatcher import ScheduleInputDispatcher
from myapp.views_user import register_user
from myapp.views_user import login_user
from myapp.views_logout import logout_view
from myapp.views_check_login import check_login
from .view_dispatcher import ScheduleInputDispatcher, ScheduleInputParser  # Import the missing views
from myapp.views_llm_text import llm_text
from .user_settings import UserSettingsView


urlpatterns = [
    path('', views.home, name='home'),  # Home page route
    path('settings/', views_settings.settings, name='settings'),  # Add the settings URL pattern
    path('api/events/', CalendarEventCreate.as_view(), name='create_event'),
    path('api/events/<int:event_id>/', CalendarEventCreate.as_view(), name='delete_event'),
    path('api/tasks/', TodoTaskCreate.as_view(), name='create_task'),  # Added trailing slash
    path('api/tasks/<int:task_id>/', TodoTaskCreate.as_view(), name='update_task'),
    path('api/schedule/', ScheduleInputDispatcher.as_view(), name='schedule-dispatcher'),
    path('api/get-csrf-token/', views.get_csrf_token),
    path('api/logout/', logout_view),
    path('api/register/', register_user),
    path('api/login/', login_user),
    
    path('api/check-login/', check_login),
    
    path('api/schedule/', ScheduleInputDispatcher.as_view(), name='schedule-dispatcher'),
    path('api/schedule/parse/', ScheduleInputParser.as_view(), name='schedule-parser'),
    #path('parse/', views.parse_time, name='parse_time'),
    
    path('api/llm-text/', llm_text, name='llm_text'),  # Endpoint for LLM chat text
    
    path('api/user-settings/', UserSettingsView.as_view(), name='user-settings'),

]
 