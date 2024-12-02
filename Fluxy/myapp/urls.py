from django.urls import path
from . import views
from .views_api import CalendarEventCreate  # Import your view for handling events

urlpatterns = [
    path('', views.home, name='home'),  # Home page route
    path("calendar/", views.calendar_view, name="calendar"),  # Calendar page
    path('api/events/', CalendarEventCreate.as_view(), name='create_event'),
    # Handle DELETE for deleting a specific event
    path('api/events/<int:event_id>/', CalendarEventCreate.as_view(), name='delete_event')
]