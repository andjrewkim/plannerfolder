# myapp/urls.py
from django.urls import path
from . import views
from .views_api import CalendarEventCreate

urlpatterns = [
    path('', views.home, name='home'),  # Home page route
    path("calendar/", views.calendar_view, name="calendar"),  # Calendar page
    path('api/events/', CalendarEventCreate.as_view(), name='create_event'),  # API route for creating events
]