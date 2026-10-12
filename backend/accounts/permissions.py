from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    message = "Only the store owner can do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_owner)
