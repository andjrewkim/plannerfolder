#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Fluxy.settings')

import builtins

DEBUG = True

if not DEBUG:
    builtins.print = lambda *args, **kwargs: None


def main():
    """Run administrative tasks."""
    #!/os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Fluxy.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
    main()




# Add this near the bottom of manage.py or wsgi.py — right before the main execution starts

import django
from django.contrib.auth import get_user_model

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Fluxy.settings")
django.setup()

User = get_user_model()
if not User.objects.filter(username="admin").exists():
    User.objects.create_superuser("admin", "vexr0265@gmail.com", "Horosny1414!")
