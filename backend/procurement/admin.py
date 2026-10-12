from django.contrib import admin

from .models import PurchaseOrder, PurchaseOrderEvent, PurchaseOrderItem, Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "contact_name", "phone", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "contact_name"]


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0


class PurchaseOrderEventInline(admin.TabularInline):
    model = PurchaseOrderEvent
    extra = 0
    readonly_fields = ["action", "actor", "note", "created_at"]
    can_delete = False


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ["number", "supplier", "status", "created_by", "created_at"]
    list_filter = ["status", "supplier"]
    search_fields = ["number", "supplier__name"]
    inlines = [PurchaseOrderItemInline, PurchaseOrderEventInline]
