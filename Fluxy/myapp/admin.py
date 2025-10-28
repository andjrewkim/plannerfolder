from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import (
    CustomUser, PlannerClass, Assignment, CalendarEvent,
    TodoTask, UserSettings, NoteTab, NoWorkDay, UserStreak
)

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser

    list_display = (
        'email', 'username', 'first_name', 'last_name', 'created_at',
        'has_seen_onboarding', 'has_unlocked_features', 'has_friends',
    )

    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('email',)
    readonly_fields = ('created_at',)

    fieldsets = UserAdmin.fieldsets + (
        (_('Custom Fields'), {
            'fields': (
                'created_at',
                'has_seen_onboarding',
                'has_unlocked_features',
                'friends',
            ),
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (_('Custom Fields'), {
            'classes': ('wide',),
            'fields': (
                'email',
                'has_seen_onboarding',
                'has_unlocked_features',
                'friends',
            ),
        }),
    )

    def has_friends(self, obj):
        return obj.friends.exists()  # Returns True if there is at least one friend
    has_friends.boolean = True  # Displays a nice ✅/❌ in the admin
    has_friends.short_description = 'Has Friends'

# Other models
admin.site.register(CalendarEvent)
admin.site.register(TodoTask)
admin.site.register(UserSettings)
admin.site.register(PlannerClass)
admin.site.register(Assignment)
admin.site.register(NoteTab)
admin.site.register(NoWorkDay)
admin.site.register(UserStreak)
