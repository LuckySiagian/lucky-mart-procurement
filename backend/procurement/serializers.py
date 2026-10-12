from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import PurchaseOrder, PurchaseOrderEvent, PurchaseOrderItem, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_name",
            "phone",
            "email",
            "address",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "product_name",
            "sku",
            "unit_name",
            "lucky_mart_product_unit_id",
            "quantity",
            "unit_price",
            "subtotal",
            "received_quantity",
            "sync_status",
            "sync_error",
        ]
        read_only_fields = ["received_quantity", "sync_status", "sync_error"]

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError(_("Quantity must be at least 1."))
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError(_("Price cannot be negative."))
        return value


class PurchaseOrderEventSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderEvent
        fields = ["id", "action", "note", "actor", "created_at"]

    def get_actor(self, event):
        return str(event.actor) if event.actor else "System"


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    created_by_id = serializers.IntegerField(read_only=True)
    approved_by = serializers.StringRelatedField(read_only=True)
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "number",
            "supplier",
            "supplier_name",
            "status",
            "notes",
            "expected_date",
            "items",
            "total_amount",
            "created_by",
            "created_by_id",
            "approved_by",
            "rejection_reason",
            "created_at",
            "submitted_at",
            "decided_at",
            "received_at",
        ]
        read_only_fields = [
            "number",
            "status",
            "rejection_reason",
            "created_at",
            "submitted_at",
            "decided_at",
            "received_at",
        ]

    def get_total_amount(self, order):
        # List views annotate the total in SQL (see views.py); fall back for fresh objects.
        total = getattr(order, "total_value", None)
        if total is None:
            total = order.total_amount
        return f"{total:.2f}"

    def validate_supplier(self, supplier):
        if not supplier.is_active:
            raise serializers.ValidationError(_("This supplier is inactive."))
        return supplier

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError(_("Add at least one item."))
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        order = PurchaseOrder.objects.create(number="", **validated_data)
        order.number = f"PO-{order.created_at:%Y%m}-{order.pk:05d}"
        order.save(update_fields=["number"])
        PurchaseOrderItem.objects.bulk_create(
            PurchaseOrderItem(order=order, **item) for item in items
        )
        PurchaseOrderEvent.objects.create(order=order, actor=order.created_by, action="CREATED")
        return order

    @transaction.atomic
    def update(self, order, validated_data):
        # Drafts are edited as a whole: the item list sent replaces the old one.
        items = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(order, field, value)
        order.save()
        if items is not None:
            order.items.all().delete()
            PurchaseOrderItem.objects.bulk_create(
                PurchaseOrderItem(order=order, **item) for item in items
            )
        return order


class PurchaseOrderDetailSerializer(PurchaseOrderSerializer):
    events = PurchaseOrderEventSerializer(many=True, read_only=True)

    class Meta(PurchaseOrderSerializer.Meta):
        fields = PurchaseOrderSerializer.Meta.fields + ["events"]


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField()


class ReceivedItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    received_quantity = serializers.IntegerField(min_value=0)


class ReceiveSerializer(serializers.Serializer):
    items = ReceivedItemSerializer(many=True, required=False, default=list)
    note = serializers.CharField(required=False, allow_blank=True, default="")
