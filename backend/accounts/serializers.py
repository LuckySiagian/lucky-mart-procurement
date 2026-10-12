from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "role"]

    def get_full_name(self, user):
        return user.get_full_name() or user.username


class PortalTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds the user's role to the access token so the frontend can adapt its UI."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role
        return token


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError(_("Your current password is wrong."))
        return value

    def validate(self, data):
        if data["new_password"] == data["current_password"]:
            raise serializers.ValidationError(
                {"new_password": _("The new password must be different from the current one.")}
            )
        # Django's validators: minimum length, not common, not all digits, not like the username.
        try:
            validate_password(data["new_password"], self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)}) from exc
        return data

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
