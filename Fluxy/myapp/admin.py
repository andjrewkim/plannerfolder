from datetime import timedelta
import json

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.core.exceptions import PermissionDenied
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.urls import path
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from .models import (
    CustomUser, PlannerClass, Assignment, CalendarEvent,
    TodoTask, UserSettings, NoteTab, NoWorkDay, UserStreak,
    AssignmentHistory
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

@admin.register(AssignmentHistory)
class AssignmentHistoryAdmin(admin.ModelAdmin):
    """
    Permanent, append-only audit log of every assignment ever created.
    Rows can only be written by signals / the backfill command — never
    edited or deleted from the admin.
    """

    list_display = (
        'changed_at', 'action', 'title', 'class_name',
        'username', 'user_email', 'start_date', 'end_date', 'completed',
    )
    list_filter = ('action', 'changed_at')
    search_fields = ('title', 'class_name', 'username', 'user_email')
    date_hierarchy = 'changed_at'
    list_per_page = 50
    readonly_fields = [f.name for f in AssignmentHistory._meta.get_fields()]

    # --- Make the log truly permanent: no editing from the admin ---
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    # --- Analytics dashboard ---
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                'analytics/',
                self.admin_site.admin_view(self.analytics_view),
                name='myapp_assignmenthistory_analytics',
            ),
        ]
        return custom + urls

    def analytics_view(self, request):
        if not request.user.has_perm('myapp.view_assignmenthistory'):
            raise PermissionDenied

        days = 30
        start = (timezone.now() - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        per_day_rows = (
            AssignmentHistory.objects
            .filter(changed_at__gte=start)
            .annotate(day=TruncDate('changed_at'))
            .values('day', 'action')
            .annotate(total=Count('id'))
        )
        row_map = {(r['day'], r['action']): r['total'] for r in per_day_rows}

        day_list = [start.date() + timedelta(days=i) for i in range(days)]
        action_labels = dict(AssignmentHistory.ACTION_CHOICES)
        action_colors = {
            'created': '#22c55e',
            'updated': '#3b82f6',
            'completed': '#14b8a6',
            'uncompleted': '#f97316',
            'deleted': '#ef4444',
            'purged_by_class_deletion': '#991b1b',
        }

        datasets = []
        for action, label in AssignmentHistory.ACTION_CHOICES:
            datasets.append({
                'label': label,
                'data': [row_map.get((d, action), 0) for d in day_list],
                'backgroundColor': action_colors.get(action, '#94a3b8'),
                'stack': 'events',
            })

        totals_by_action = {
            row['action']: row['total']
            for row in AssignmentHistory.objects.values('action').annotate(total=Count('id'))
        }

        context = {
            **self.admin_site.each_context(request),
            'title': 'Assignment Analytics (last 30 days)',
            'opts': self.model._meta,
            'chart_labels': json.dumps([d.strftime('%b %d') for d in day_list]),
            'chart_datasets': json.dumps(datasets),
            'totals_by_action': [
                (label, totals_by_action.get(action, 0), action_colors.get(action, '#94a3b8'))
                for action, label in AssignmentHistory.ACTION_CHOICES
            ],
            'total_events': AssignmentHistory.objects.count(),
            'total_created': totals_by_action.get('created', 0),
            'recent': AssignmentHistory.objects.all()[:15],
        }
        from django.shortcuts import render
        return render(request, 'admin/myapp/assignmenthistory/analytics.html', context)


# Other models
admin.site.register(CalendarEvent)
admin.site.register(TodoTask)
admin.site.register(UserSettings)
admin.site.register(PlannerClass)
admin.site.register(Assignment)
admin.site.register(NoteTab)
admin.site.register(NoWorkDay)
admin.site.register(UserStreak)
