from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """A portal user. Staff prepare and receive orders; owners approve them."""

    class Role(models.TextChoices):
        STAFF = "STAFF", "Staff"
        OWNER = "OWNER", "Owner"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)

    @property
    def is_owner(self):
        return self.role == self.Role.OWNER

    def __str__(self):
        return self.get_full_name() or self.username
