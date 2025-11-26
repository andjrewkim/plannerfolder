import csv
import os
import django

# setup Django environment manually
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Fluxy.settings")
django.setup()

from django.contrib.auth.models import User

with open("users.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["email", "first_name", "last_name"])
    for u in User.objects.all():
        writer.writerow([u.email, u.first_name, u.last_name])
