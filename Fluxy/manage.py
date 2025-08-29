#!/usr/bin/env python
"""Script to create Django superuser from environment variables."""
import os
import django

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Fluxy.settings")
django.setup()

from django.contrib.auth import get_user_model

def create_superuser():
    """Create superuser if it doesn't exist."""
    User = get_user_model()

    admin_username = os.getenv("DJANGO_SUPERUSER_USERNAME")
    admin_email = os.getenv("DJANGO_SUPERUSER_EMAIL")
    admin_password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

    # Validate environment variables
    if not all([admin_username, admin_email, admin_password]):
        print("Error: Missing required environment variables:")
        print("- DJANGO_SUPERUSER_USERNAME")
        print("- DJANGO_SUPERUSER_EMAIL") 
        print("- DJANGO_SUPERUSER_PASSWORD")
        return False

    # Check if user already exists
    if User.objects.filter(email=admin_email).exists():
        print(f"Superuser with email '{admin_email}' already exists.")
        return True
    
    if User.objects.filter(username=admin_username).exists():
        print(f"Superuser with username '{admin_username}' already exists.")
        return True

    # Create superuser
    try:
        User.objects.create_superuser(
            username=admin_username,
            email=admin_email,
            password=admin_password
        )
        print(f"Superuser '{admin_username}' created successfully!")
        return True
    except Exception as e:
        print(f"Error creating superuser: {e}")
        return False

if __name__ == '__main__':
    create_superuser()