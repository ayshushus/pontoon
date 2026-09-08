from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("base", "0130_userprofile_show_invisibles"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="show_directionality",
            field=models.BooleanField(default=False),
        ),
    ]
