from django.contrib import admin

# Register your models here.

from django.contrib.auth.admin import UserAdmin
from .models import CustomUser
from .models import CalendarEvent
from .models import TodoTask

admin.site.register(CalendarEvent)
admin.site.register(TodoTask)
admin.site.register(CustomUser, UserAdmin,)