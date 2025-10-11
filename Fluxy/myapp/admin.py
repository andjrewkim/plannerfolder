from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import (
    TodoTask, UserSettings, NoteTab, NoWorkDay
)

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser

    list_display = (
        'email', 'username', 'created_at',
        'has_seen_onboarding', 'has_unlocked_features', 'is_staff',
    )
    search_fields = ('email', 'username')
    ordering = ('email',)

    readonly_fields = ('created_at',)  # ✅ Add this line

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

# Other models
admin.site.register(CalendarEvent)
admin.site.register(TodoTask)
admin.site.register(UserSettings)
admin.site.register(PlannerClass)
admin.site.register(Assignment)
admin.site.register(NoteTab)
admin.site.register(NoWorkDay)
