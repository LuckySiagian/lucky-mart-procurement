import os

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from procurement.models import Supplier

SUPPLIERS = [
    {"name": "CV Sumber Beras Toba", "contact_name": "Pak Simanjuntak", "phone": "0811-0000-0001"},
    {"name": "UD Minyak Makmur", "contact_name": "Bu Sinaga", "phone": "0811-0000-0002"},
    {
        "name": "PT Gula Nusantara Distribusi",
        "contact_name": "Pak Hutapea",
        "phone": "0811-0000-0003",
    },
]


class Command(BaseCommand):
    help = "Create demo users (owner + staff) and sample suppliers. Safe to run more than once."

    def handle(self, *args, **options):
        password = os.environ.get("DEMO_PASSWORD")
        if not password:
            raise CommandError("Set DEMO_PASSWORD to choose the demo users' password.")

        for username, first_name, role in [
            ("owner", "Store Owner", User.Role.OWNER),
            ("staff", "Warehouse Staff", User.Role.STAFF),
        ]:
            user, created = User.objects.get_or_create(
                username=username, defaults={"first_name": first_name, "role": role}
            )
            if created:
                user.set_password(password)
                user.save()
            self.stdout.write(f"{'Created' if created else 'Exists '} user {username} ({role})")

        for data in SUPPLIERS:
            _, created = Supplier.objects.get_or_create(name=data["name"], defaults=data)
            self.stdout.write(f"{'Created' if created else 'Exists '} supplier {data['name']}")
