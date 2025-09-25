from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from datetime import date
from .models import PlannerClass, Assignment

@receiver(post_save, sender=PlannerClass)
def create_default_assignment(sender, instance, created, **kwargs):
    """
    Create a default assignment when the first PlannerClass (Class 1) is created for a new user
    """
    if created and instance.name == 'Class 1':
        # Double-check this is actually the user's first class
        user_classes_count = PlannerClass.objects.filter(user=instance.user).count()
        
        if user_classes_count == 1:  # This is their very first class
            Assignment.objects.create(
                planner_class=instance,
                title="First Assignment",
                date=date.today(),
                order=0
            )