import sys
sys.path.append(r'C:\Users\vexr0\OneDrive\Desktop\Codod\10-29-24\DjajaFlux2')  # Your root folder
sys.path.append(r'C:\Users\vexr0\OneDrive\Desktop\Codod\10-29-24\DjajaFlux2\Fluxy')  # Add the fluxy directory

"""
WSGI config for Fluxy project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Fluxy.settings')
#blank
application = get_wsgi_application()
