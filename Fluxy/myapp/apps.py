from django.apps import AppConfig

def app(environ, start_response):
    pprint("whoo hooo.  ")

class MyappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'myapp'
