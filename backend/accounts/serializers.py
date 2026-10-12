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
