from django.db import models

# Create your models here.
# models.py
from django.db import models

class Event(models.Model):
    title = models.CharField(max_length=100)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
