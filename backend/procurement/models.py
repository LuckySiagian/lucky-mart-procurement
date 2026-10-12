from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F, Sum
from django.utils.translation import gettext_lazy as _


class Supplier(models.Model):
    name = models.CharField(max_length=150, unique=True)
    contact_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PurchaseOrder(models.Model):
    """An order for stock from a supplier.

    Lifecycle: DRAFT -> SUBMITTED -> APPROVED -> RECEIVED, with REJECTED and
    CANCELLED as the other end states. Transitions live in procurement.workflow.
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Draft")
        SUBMITTED = "SUBMITTED", _("Waiting for approval")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")
        RECEIVED = "RECEIVED", _("Received")
        CANCELLED = "CANCELLED", _("Cancelled")

    number = models.CharField(max_length=20, unique=True, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    expected_date = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_orders"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_orders",
    )
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return self.number

    @property
    def total_amount(self):
        total = self.items.aggregate(total=Sum(F("quantity") * F("unit_price")))["total"]
        return total or Decimal("0")


class PurchaseOrderItem(models.Model):
    """One product line. Products live in Lucky Mart, so we keep their IDs plus a name snapshot."""

    class SyncStatus(models.TextChoices):
        NOT_SYNCED = "NOT_SYNCED", "Not synced"
        SYNCED = "SYNCED", "Synced to Lucky Mart"
        FAILED = "FAILED", "Sync failed"
        SKIPPED = "SKIPPED", "No Lucky Mart product"

    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product_name = models.CharField(max_length=200)
    sku = models.CharField(max_length=60, blank=True)
    unit_name = models.CharField(max_length=40, blank=True)
    lucky_mart_product_unit_id = models.UUIDField(null=True, blank=True)

    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    received_quantity = models.PositiveIntegerField(null=True, blank=True)

    sync_status = models.CharField(
        max_length=10, choices=SyncStatus.choices, default=SyncStatus.NOT_SYNCED
    )
    sync_error = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"

    @property
    def subtotal(self):
        return self.quantity * self.unit_price


class PurchaseOrderEvent(models.Model):
    """Audit trail: who did what to an order, and when."""

    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    action = models.CharField(max_length=20)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.order.number}: {self.action}"
