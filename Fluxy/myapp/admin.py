from django.contrib import admin

# Register your models here.

from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, PlannerClass, Assignment, CalendarEvent, TodoTask, UserSettings, NoteTab


admin.site.register(CalendarEvent)
admin.site.register(TodoTask)
admin.site.register(CustomUser, UserAdmin,)
admin.site.register(UserSettings)
admin.site.register(PlannerClass)
admin.site.register(Assignment)
admin.site.register(NoteTab)