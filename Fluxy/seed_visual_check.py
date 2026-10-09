import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from myapp.models import AssignmentHistory

User = get_user_model()
if not User.objects.filter(username='demo').exists():
    User.objects.create_superuser('demo', 'demo@fluxy.app', 'demo12345!')

AssignmentHistory.objects.all().delete()

classes = ['Algebra II', 'AP Biology', 'World History', 'English 10', 'Spanish II', None]
users = ['mia', 'liam', 'ava', 'noah']
emails = {u: f'{u}@fluxy.app' for u in users}

today = timezone.localdate()
this_monday = today - timedelta(days=today.weekday())
random.seed(7)

pk = 1000
for w in range(14, -7, -1):  # 14 weeks back .. 6 weeks ahead
    monday = this_monday - timedelta(weeks=w)
    n = random.choice([2, 3, 4, 5, 6, 7, 9, 11, 13])
    for i in range(n):
        day_offset = random.choice([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6])
        d = monday + timedelta(days=day_offset)
        cls = random.choice(classes)
        usr = random.choice(users)
        pk += 1
        AssignmentHistory.objects.create(
            action='created',
            assignment_pk=pk,
            class_name=cls,
            user_pk=1,
            username=usr,
            user_email=emails[usr],
            title=f'Worksheet {abs(w)}-{i}',
            start_date=d,
            end_date=d + timedelta(days=2),
            completed=False,
        )

print('seeded rows:', AssignmentHistory.objects.count())
