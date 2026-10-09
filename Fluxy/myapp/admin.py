from datetime import timedelta
import json

from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.admin import UserAdmin
from django.core.exceptions import PermissionDenied

from django.db.models import Count
from django.db.models.functions import ExtractIsoWeekDay, TruncWeek
from django.shortcuts import render
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

    # --- Bulk cleanup: superuser-only mass removal of history rows ---
    # The log is normally permanent and staff cannot delete from it; this
    # deliberate exception exists so a superuser can purge demo/test rows.
    actions = ['mass_delete_history']
    actions_on_bottom = True

    @admin.action(description='Mass delete selected history rows')
    def mass_delete_history(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(
                request,
                'Only superusers can mass delete assignment history rows.',
                level=messages.ERROR,
            )
            return
        if request.POST.get('post') != 'yes':
            # Intermediate confirmation page, like the built-in delete action.
            context = {
                **self.admin_site.each_context(request),
                'title': 'Are you sure?',
                'opts': self.model._meta,
                'queryset': queryset,
                'count': queryset.count(),
                'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
            }
            return render(
                request,
                'admin/myapp/assignmenthistory/mass_delete_confirmation.html',
                context,
            )
        count = queryset.count()
        queryset.delete()
        self.message_user(
            request,
            f'Mass deleted {count} assignment history row(s).',
            level=messages.SUCCESS,
        )

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
        weeks_back = {'3m': 13, '6m': 26, '1y': 52}.get(range_key)

        today = timezone.localdate()

        def week_start(d):
            """Monday of the week containing d."""
            return d - timedelta(days=d.weekday())

        def week_label(d):
            """e.g. 'Feb 3' — avoids %-d, which is not portable."""
            return f"{d.strftime('%b')} {d.day}"

        # Exactly one 'created' row exists per assignment, and it carries a
        # snapshot of the assignment's own start_date. Bucketing by that date
        # (not by changed_at) shows when the work is actually for.
        created = AssignmentHistory.objects.filter(
            action='created', start_date__isnull=False,
        )

        if weeks_back is None:  # all time
            earliest = (
                created.order_by('start_date')
                .values_list('start_date', flat=True).first()
            )
            range_start = week_start(earliest) if earliest else week_start(today)
        else:
            range_start = week_start(today) - timedelta(weeks=weeks_back - 1)

        in_range = created.filter(start_date__gte=range_start)

        # Chart runs from range_start through the current week, extended
        # forward to include planned (future-dated) assignments — capped at
        # 12 weeks ahead so one far-future date can't stretch the axis.
        current_week = week_start(today)
        latest = (
            in_range.order_by('-start_date')
            .values_list('start_date', flat=True).first()
        )
        chart_end = current_week
        if latest is not None and week_start(latest) > chart_end:
            chart_end = min(week_start(latest), current_week + timedelta(weeks=12))

        week_rows = (
            in_range.annotate(wk=TruncWeek('start_date'))
            .values('wk').annotate(total=Count('id'))
        )
        week_map = {r['wk']: r['total'] for r in week_rows}

        labels, weekly_data = [], []
        cursor = range_start
        last_year = None
        while cursor <= chart_end:
            lbl = week_label(cursor)
            if range_start.year != chart_end.year and cursor.year != last_year:
                lbl = f"{lbl} '{cursor.strftime('%y')}"
            last_year = cursor.year
            labels.append(lbl)
            weekly_data.append(week_map.get(cursor, 0))
            cursor += timedelta(weeks=1)

        weekday_rows = (
            in_range.annotate(wd=ExtractIsoWeekDay('start_date'))
            .values('wd').annotate(total=Count('id'))
        )
        wd_map = {r['wd']: r['total'] for r in weekday_rows}
        weekday_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        weekday_data = [wd_map.get(i, 0) for i in range(1, 8)]

        # --- Headline numbers ---
        total_created = AssignmentHistory.objects.filter(action='created').count()
        in_range_total = in_range.count()
        n_weeks = max((chart_end - range_start).days // 7 + 1, 1)

        ACCENT = '#2563eb'

        def bar_dataset(data, max_thickness):
            return [{
                'label': 'Assignments',
                'data': data,
                'backgroundColor': ACCENT,
                'hoverBackgroundColor': '#1d4ed8',
                'borderWidth': 0,
                'borderRadius': 3,
                'maxBarThickness': max_thickness,
                'categoryPercentage': 0.75,
            }]

        datasets = bar_dataset(weekly_data, 30)
        weekday_datasets = bar_dataset(weekday_data, 36)

        context = {
            **self.admin_site.each_context(request),
            'title': 'Assignment Stats',
            'opts': self.model._meta,
            'range_key': range_key,
            'range_options': range_options,
            'chart_labels': json.dumps(labels),
            'chart_datasets': json.dumps(datasets),
            'weekday_labels': json.dumps(weekday_labels),
            'weekday_datasets': json.dumps(weekday_datasets),
            'total_created': total_created,
            'range_created': in_range_total,
            'avg_per_week': round(in_range_total / n_weeks, 1),
        }
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
