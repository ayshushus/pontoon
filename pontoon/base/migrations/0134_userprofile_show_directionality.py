from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("base", "0133_alter_locale_script"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="show_directionality",
            field=models.BooleanField(default=False),
        ),
    ]
