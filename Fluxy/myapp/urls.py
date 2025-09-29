# urls.py
from django.urls import path, include
from . import views
from . import views_settings
from .views_api import CalendarEventCreate  # Import your view for handling events
from .views_todo import TodoTaskCreate
from myapp.views_user import register_user
from myapp.views_user import login_user
from myapp.views_logout import logout_view
from myapp.views_check_login import check_login
from .view_dispatcher import ScheduleInputDispatcher, ScheduleInputParser  # Import the missing views
from myapp.views_llm_text import llm_text
from .views_notes import NoteTabListCreateView, NoteTabDetailView
from . import views_user
from .views_no_work import delete_no_work_day, no_work_days_list_create

from .user_settings import UserSettingsView
from rest_framework.routers import DefaultRouter
from . import views_planner

router = DefaultRouter()
router.register(r'planner/classes', views_planner.PlannerClassViewSet, basename='planner-classes')
router.register(r'planner/assignments', views_planner.AssignmentViewSet, basename='planner-assignments')



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
    path('api/auth/google/', views_user.google_auth, name='google_auth'),

    path('api/check-login/', check_login),
    path('api/schedule/parse/', ScheduleInputParser.as_view(), name='schedule-parser'),
    #path('parse/', views.parse_time, name='parse_time'),
    path('api/llm-text/', llm_text, name='llm_text'),  # Endpoint for LLM chat text
    path('api/user-settings/', UserSettingsView.as_view(), name='user-settings'),
    path('api/', include(router.urls)),
    path('api/user-settings/', UserSettingsView.as_view(), name='user-settings'),
    
    path('api/notes/', NoteTabListCreateView.as_view(), name='note-list-create'),
    path('api/notes/<int:pk>/', NoteTabDetailView.as_view(), name='note-detail'),
    
    path('api/planner/no-work-days/', no_work_days_list_create, name='no-work-days-list-create'),
    path('api/planner/no-work-days/<int:pk>/', delete_no_work_day, name='delete-no-work-day'),
    
    
]