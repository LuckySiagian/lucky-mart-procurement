"""Purchase order lifecycle.

All status changes go through these functions so the rules live in one place:
who may do what, in which status, and what gets written to the audit trail.
"""

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from . import luckymart
from .metrics import ORDER_TRANSITIONS, STOCK_SYNC
from .models import PurchaseOrder, PurchaseOrderEvent, PurchaseOrderItem

logger = logging.getLogger(__name__)

Status = PurchaseOrder.Status
SyncStatus = PurchaseOrderItem.SyncStatus


def _lock(order):
    return PurchaseOrder.objects.select_for_update().get(pk=order.pk)


def _require_status(order, *allowed):
    if order.status not in allowed:
        raise ValidationError(
            {"status": f"Not allowed while the order is {order.get_status_display().lower()}."}
        )


def _record(order, user, action, note=""):
    PurchaseOrderEvent.objects.create(order=order, actor=user, action=action, note=note)
    ORDER_TRANSITIONS.labels(action=action).inc()


@transaction.atomic
def submit(order, user):
    order = _lock(order)
    _require_status(order, Status.DRAFT)
    if not order.items.exists():
        raise ValidationError({"items": "Add at least one item before submitting."})
    order.status = Status.SUBMITTED
    order.submitted_at = timezone.now()
    order.save(update_fields=["status", "submitted_at", "updated_at"])
    _record(order, user, "SUBMITTED")
    return order


@transaction.atomic
def approve(order, user, note=""):
    order = _lock(order)
    _require_status(order, Status.SUBMITTED)
    if order.created_by_id == user.id:
        # Segregation of duties: nobody approves their own order.
        raise PermissionDenied("You cannot approve an order you created.")
    order.status = Status.APPROVED
    order.approved_by = user
    order.decided_at = timezone.now()
    order.save(update_fields=["status", "approved_by", "decided_at", "updated_at"])
    _record(order, user, "APPROVED", note)
    return order


@transaction.atomic
def reject(order, user, reason):
    if not reason.strip():
        raise ValidationError({"reason": "Please give a reason for rejecting the order."})
    order = _lock(order)
    _require_status(order, Status.SUBMITTED)
    order.status = Status.REJECTED
    order.rejection_reason = reason.strip()
    order.decided_at = timezone.now()
    order.save(update_fields=["status", "rejection_reason", "decided_at", "updated_at"])
    _record(order, user, "REJECTED", reason.strip())
    return order


@transaction.atomic
def cancel(order, user, reason=""):
    order = _lock(order)
    _require_status(order, Status.DRAFT, Status.SUBMITTED)
    if order.created_by_id != user.id and not user.is_owner:
        raise PermissionDenied("Only the creator or the owner can cancel this order.")
    order.status = Status.CANCELLED
    order.save(update_fields=["status", "updated_at"])
    _record(order, user, "CANCELLED", reason)
    return order


def receive(order, user, received=None, note=""):
    """Record delivered goods, then push the stock to Lucky Mart.

    `received` maps item id -> delivered quantity. Items not listed are assumed
    to be delivered in full.
    """
    received = received or {}
    with transaction.atomic():
        order = _lock(order)
        _require_status(order, Status.APPROVED)
        items = list(order.items.all())
        unknown = set(received) - {item.id for item in items}
        if unknown:
            raise ValidationError({"items": f"Unknown item ids: {sorted(unknown)}"})
        for item in items:
            qty = received.get(item.id, item.quantity)
            if qty < 0 or qty > item.quantity:
                raise ValidationError(
                    {"items": f"{item.product_name}: received quantity must be 0-{item.quantity}."}
                )
            item.received_quantity = qty
            item.save(update_fields=["received_quantity"])
        order.status = Status.RECEIVED
        order.received_at = timezone.now()
        order.save(update_fields=["status", "received_at", "updated_at"])
        _record(order, user, "RECEIVED", note)

    # The HTTP calls run outside the transaction, so a slow or failing Lucky Mart
    # never rolls back the receipt. Failed lines can be retried with sync_stock().
    sync_stock(order, user)
    return order


def sync_stock(order, user=None):
    """Send received quantities to Lucky Mart for every line not synced yet."""
    if order.status != Status.RECEIVED:
        raise ValidationError({"status": "Only received orders can be synced."})

    pending = order.items.exclude(sync_status__in=[SyncStatus.SYNCED, SyncStatus.SKIPPED])
    try:
        client = luckymart.get_client()
    except luckymart.LuckyMartNotConfigured as exc:
        pending.update(sync_status=SyncStatus.FAILED, sync_error=str(exc))
        STOCK_SYNC.labels(result="not_configured").inc()
        return order

    synced = failed = 0
    for item in pending:
        if not item.lucky_mart_product_unit_id or not item.received_quantity:
            item.sync_status, item.sync_error = SyncStatus.SKIPPED, ""
        else:
            try:
                client.add_stock(
                    item.lucky_mart_product_unit_id,
                    item.received_quantity,
                    reference=order.number,
                    notes=f"Received from {order.supplier.name} ({order.number})",
                )
                item.sync_status, item.sync_error = SyncStatus.SYNCED, ""
                synced += 1
            except luckymart.LuckyMartError as exc:
                logger.warning("Stock sync failed for %s item %s: %s", order.number, item.id, exc)
                item.sync_status, item.sync_error = SyncStatus.FAILED, str(exc)
                failed += 1
        item.save(update_fields=["sync_status", "sync_error"])

    if synced:
        STOCK_SYNC.labels(result="synced").inc(synced)
    if failed:
        STOCK_SYNC.labels(result="failed").inc(failed)
    if synced or failed:
        _record(order, user, "STOCK_SYNC", f"{synced} synced, {failed} failed")
    return order
