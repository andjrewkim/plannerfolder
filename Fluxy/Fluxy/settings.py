# Fluxy/settings.py

import os

PORT = os.getenv('PORT', 8080)


from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-o$6dky9m&k81lced^&l+93@g4bgsjh&&#6thp$_%w#63)@4@e&'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['flux-qcj2.onrender.com', '127.0.0.1', 'localhost']

# settings.py
CSRF_COOKIE_NAME = "csrftoken"  # This will be the name of the CSRF token in the cookie
CSRF_COOKIE_SECURE = False  # Only for development, set to True in production with HTTPS
CSRF_TRUSTED_ORIGINS = ['http://localhost:8000']  # Add your local or production domain

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",  # Example: Frontend running locally
    "http://127.0.0.1:8000",
    "https://flux-qcj2.onrender.com",
]
CORS_ALLOW_CREDENTIALS = True



# settings.py
CORS_ALLOW_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'myapp',
    'whitenoise.runserver_nostatic',  # For development purposes

    
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
]

STATIC_URL = 'myapp/static/'


ROOT_URLCONF = 'Fluxy.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


#blank comment
#WSGI_APPLICATION = 'Fluxy.wsgi.application'

# Database
# For SQLite (default)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATICFILES_DIRS = [
    BASE_DIR / "myapp/static",  # This includes your project-level static files
    os.path.join(BASE_DIR, "myapp", "static"),  # This includes your app-level static files
]

# If you're using Django's default static file storage
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# Directory where static files are collected (for production)
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')  # Make sure this path is correct


# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

