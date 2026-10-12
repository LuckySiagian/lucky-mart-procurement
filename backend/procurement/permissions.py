from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import PurchaseOrder


class CanEditOrder(BasePermission):
    """Orders can only be edited while they are drafts, by their creator or the owner."""

    message = "Only drafts can be edited, by their creator or the owner."

    def has_object_permission(self, request, view, order):
        if request.method in SAFE_METHODS:
            return True
        if view.action not in ("update", "partial_update"):
            return True
        return order.status == PurchaseOrder.Status.DRAFT and (
            order.created_by_id == request.user.id or request.user.is_owner
        )
