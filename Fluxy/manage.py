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
    # Create superuser first
    try:
        import django
        from django.contrib.auth import get_user_model
        
        django.setup()
        User = get_user_model()

        admin_username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
        admin_email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
        admin_password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "admin123")

        # Show existing superusers
        existing_superusers = User.objects.filter(is_superuser=True)
        print(f"Found {existing_superusers.count()} existing superusers:")
        for user in existing_superusers:
            print(f"  - Username: {user.username}, Email: {user.email}")

        # Delete ALL users (nuclear option)
        all_deleted = User.objects.all().delete()[0]
        print(f"Deleted ALL {all_deleted} users from database")
        
        # Create new superuser
        User.objects.create_superuser(admin_username, admin_email, admin_password)
        print(f"Created superuser: {admin_username} ({admin_email})")
    except:
        pass
    
    # Then run normal Django management
    main()