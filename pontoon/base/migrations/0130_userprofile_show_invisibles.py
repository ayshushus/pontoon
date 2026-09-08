from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("base", "0129_rename_gpt_transform_machinery_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="show_invisibles",
            field=models.BooleanField(default=False),
        ),
    ]
