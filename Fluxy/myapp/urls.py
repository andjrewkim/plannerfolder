# urls.py
from django.urls import path, include
from . import views
from . import views_settings
from .views_api import CalendarEventCreate  # Import your view for handling events
from .views_todo import TodoTaskCreate
from myapp.views_user import register_user, login_user
from myapp.views_logout import logout_view
from myapp.views_check_login import check_login
from .view_dispatcher import ScheduleInputDispatcher, ScheduleInputParser  # Import the missing views
from myapp.views_llm_text import llm_text
from .views_notes import NoteTabListCreateView, NoteTabDetailView
from .views_user import update_feature_unlock, mark_onboarding_seen, google_auth, get_user_status
from .views_no_work import delete_no_work_day, no_work_days_list_create
from .views_unsubscribe import unsubscribe_api, unsubscribe
from .views_update_timezone import UpdateTimezoneView

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
    path('api/auth/google/', google_auth, name='google_auth'),

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
    path('api/user/onboarding/seen/', mark_onboarding_seen, name='mark_onboarding_seen'),
    path('api/user/features/unlock/', update_feature_unlock, name='update_feature_unlock'),
    path('api/user/status/', get_user_status, name='user_status'),
    path('api/update-timezone/', UpdateTimezoneView.as_view(), name='update-timezone'),
    path('unsubscribe/', unsubscribe, name='unsubscribe'),
    path('api/unsubscribe/', unsubscribe_api, name='unsubscribe_api'),  
]


from .views_friends import (
    SendFriendRequestView,
    AcceptFriendRequestView,
    DeclineFriendRequestView,
    PendingFriendRequestsView,
    UserProfileView,
    MyFriendsView,
    RemoveFriendView,
    BatchUserProfileView
)

# Friend system URLs
urlpatterns += [
    # Friend request actions
    path('api/friends/send/', SendFriendRequestView.as_view(), name='send-friend-request'),
    path('api/friends/accept/<int:request_id>/', AcceptFriendRequestView.as_view(), name='accept-friend-request'),
    path('api/friends/decline/<int:request_id>/', DeclineFriendRequestView.as_view(), name='decline-friend-request'),
    path('api/friends/pending/', PendingFriendRequestsView.as_view(), name='pending-friend-requests'),
    path('api/friends/list/', MyFriendsView.as_view(), name='my-friends'),
    path('api/friends/remove/<int:friend_id>/', RemoveFriendView.as_view(), name='remove-friend'),
    path('api/profile/<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
    path('api/profiles/batch/', BatchUserProfileView.as_view(), name='batch-user-profiles'),  # NEW

]


from .views_streaks import (
    StreakDataView,
    UpdateStreakView,
    DailyActivityView,
    StreakStatsView
)

urlpatterns += [
    path('api/streaks/', StreakDataView.as_view(), name='streak-data'),
    path('api/streaks/update/', UpdateStreakView.as_view(), name='update-streak'),
    path('api/streaks/activity/', DailyActivityView.as_view(), name='daily-activity'),
    path('api/streaks/stats/', StreakStatsView.as_view(), name='streak-stats'),
]