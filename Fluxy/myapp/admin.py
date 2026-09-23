from datetime import timedelta
import json

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.core.exceptions import PermissionDenied
from datetime import date, datetime, time as dtime

from django.db.models import Count
from django.db.models.functions import TruncMonth
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

        range_key = request.GET.get('range', '3m')
        range_options = [
            ('3m', 'Last 3 Months'),
            ('6m', 'Last 6 Months'),
            ('1y', 'Last 12 Months'),
            ('all', 'All Time'),
        ]
        months_back = {'3m': 3, '6m': 6, '1y': 12}.get(range_key)

        today = timezone.localdate()

        def month_start(d, back):
            """First day of the month `back` months from d (negative = forward)."""
            total = d.year * 12 + (d.month - 1) - back
            y, m = divmod(total, 12)
            return date(y, m + 1, 1)

        if months_back is None:  # all time
            earliest = (
                AssignmentHistory.objects.order_by('changed_at')
                .values_list('changed_at', flat=True).first()
            )
            if earliest is None:
                start = month_start(today, 0)
            else:
                e = timezone.localtime(earliest).date()
                span = (today.year - e.year) * 12 + (today.month - e.month)
                start = month_start(today, max(span, 0))
        else:
            start = month_start(today, months_back - 1)

        def per_month(action):
            start_dt = timezone.make_aware(datetime.combine(start, dtime.min))
            rows = (
                AssignmentHistory.objects
                .filter(action=action, changed_at__gte=start_dt)
                .annotate(month=TruncMonth('changed_at'))
                .values('month')
                .annotate(total=Count('id'))
            )
            return {r['month'].date().replace(day=1): r['total'] for r in rows}

        created_map = per_month('created')
        completed_map = per_month('completed')

        labels, created_data, completed_data = [], [], []
        cursor = start
        while cursor <= today:
            labels.append(cursor.strftime('%b %Y'))
            created_data.append(created_map.get(cursor, 0))
            completed_data.append(completed_map.get(cursor, 0))
            cursor = month_start(cursor, -1)

        datasets = [
            {
                'label': 'Created',
                'data': created_data,
                'backgroundColor': '#22c55e',
                'borderWidth': 0,
            },
            {
                'label': 'Completed',
                'data': completed_data,
                'backgroundColor': '#64748b',
                'borderWidth': 0,
            },
        ]

        total_created = AssignmentHistory.objects.filter(action='created').count()

        context = {
            **self.admin_site.each_context(request),
            'title': 'Assignment Stats',
            'opts': self.model._meta,
            'range_key': range_key,
            'range_options': range_options,
            'chart_labels': json.dumps(labels),
            'chart_datasets': json.dumps(datasets),
            'total_created': total_created,
            'range_created': sum(created_data),
            'range_completed': sum(completed_data),
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
