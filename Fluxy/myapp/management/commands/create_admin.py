from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        User = get_user_model()
        username = "admin"
        email = "vexr0264@gmail.com"
        password = "Horosny1414!"

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write("✅ Superuser created.")
        else:
            self.stdout.write("⚠️ Superuser already exists.")
