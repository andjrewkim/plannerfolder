from django.db import migrations, models

def copy_old_date(apps, schema_editor):
    Assignment = apps.get_model('myapp', 'Assignment')
    for assignment in Assignment.objects.all():
        # Copy data from old 'date' field
        assignment.start_date = assignment.date
        assignment.end_date = assignment.date
        assignment.save()

class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0016_auto_20251109_1926'),  # your last migration
    ]

    operations = [
        # Step 1: Copy existing data to new fields
        migrations.RunPython(copy_old_date),
        # Step 2: Make the new fields required
        migrations.AlterField(
            model_name='assignment',
            name='start_date',
            field=models.DateField(),
        ),
        migrations.AlterField(
            model_name='assignment',
            name='end_date',
            field=models.DateField(),
        ),
        # Step 3: Remove the old field
        migrations.RemoveField(
            model_name='assignment',
            name='date',
        ),
    ]
