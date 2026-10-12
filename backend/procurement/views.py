from django.db import connection
from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsOwner

from . import luckymart, workflow
from .models import PurchaseOrder, Supplier
from .permissions import CanEditOrder
from .serializers import (
    NoteSerializer,
    PurchaseOrderDetailSerializer,
    PurchaseOrderSerializer,
    ReceiveSerializer,
    RejectSerializer,
    SupplierSerializer,
)

MONEY = DecimalField(max_digits=16, decimal_places=2)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filterset_fields = ["is_active"]
    search_fields = ["name", "contact_name", "phone"]
    ordering_fields = ["name", "created_at"]

    def perform_destroy(self, supplier):
        # Suppliers with order history are deactivated instead of deleted.
        if supplier.orders.exists():
            supplier.is_active = False
            supplier.save(update_fields=["is_active", "updated_at"])
        else:
            supplier.delete()


class PurchaseOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = viewsets.GenericViewSet.permission_classes + [CanEditOrder]
    filterset_fields = ["status", "supplier"]
    search_fields = ["number", "supplier__name"]
    ordering_fields = ["created_at", "number", "status"]

    def get_queryset(self):
        return (
            PurchaseOrder.objects.select_related("supplier", "created_by", "approved_by")
            .prefetch_related("items")
            .annotate(
                total_value=Coalesce(
                    Sum(F("items__quantity") * F("items__unit_price"), output_field=MONEY),
                    Value(0, output_field=MONEY),
                )
            )
            # Aggregating drops Meta.ordering, so order explicitly for stable pagination.
            .order_by("-created_at", "-id")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseOrderSerializer
        return PurchaseOrderDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _respond(self, order, status_code=status.HTTP_200_OK):
        # Re-read the order so totals, items and events reflect the change.
        fresh = self.get_queryset().prefetch_related("events__actor").get(pk=order.pk)
        return Response(PurchaseOrderDetailSerializer(fresh).data, status=status_code)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return self._respond(serializer.instance, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        order = self.get_object()
        serializer = self.get_serializer(order, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self._respond(order)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._respond(workflow.submit(self.get_object(), request.user))

    @action(detail=True, methods=["post"], permission_classes=[IsOwner])
    def approve(self, request, pk=None):
        data = NoteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = workflow.approve(self.get_object(), request.user, data.validated_data["note"])
        return self._respond(order)

    @action(detail=True, methods=["post"], permission_classes=[IsOwner])
    def reject(self, request, pk=None):
        data = RejectSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = workflow.reject(self.get_object(), request.user, data.validated_data["reason"])
        return self._respond(order)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        data = NoteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = workflow.cancel(self.get_object(), request.user, data.validated_data["note"])
        return self._respond(order)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        data = ReceiveSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        received = {row["id"]: row["received_quantity"] for row in data.validated_data["items"]}
        order = workflow.receive(
            self.get_object(), request.user, received, data.validated_data["note"]
        )
        return self._respond(order)

    @action(detail=True, methods=["post"], url_path="sync-stock")
    def sync_stock(self, request, pk=None):
        return self._respond(workflow.sync_stock(self.get_object(), request.user))


@api_view(["GET"])
def low_stock(request):
    """Lucky Mart products that need restocking, used to pre-fill new orders."""
    try:
        items = luckymart.get_client().low_stock_items()
    except luckymart.LuckyMartNotConfigured as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except luckymart.LuckyMartError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response(items)


@api_view(["GET"])
def dashboard(request):
    month_start = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    counts = dict(
        PurchaseOrder.objects.order_by()
        .values("status")
        .annotate(n=Count("id"))
        .values_list("status", "n")
    )
    spend = PurchaseOrder.objects.filter(
        status=PurchaseOrder.Status.RECEIVED, received_at__gte=month_start
    ).aggregate(
        total=Coalesce(
            Sum(F("items__received_quantity") * F("items__unit_price"), output_field=MONEY),
            Value(0, output_field=MONEY),
        )
    )["total"]
    return Response(
        {
            "orders_by_status": {s: counts.get(s, 0) for s in PurchaseOrder.Status.values},
            "waiting_for_approval": counts.get(PurchaseOrder.Status.SUBMITTED, 0),
            "received_this_month": f"{spend:.2f}",
            "failed_stock_syncs": PurchaseOrder.objects.filter(Q(items__sync_status="FAILED"))
            .distinct()
            .count(),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:  # noqa: BLE001 - any DB failure means "unhealthy"
        return Response({"status": "error", "database": "down"}, status=503)
    return Response({"status": "ok", "database": "up"})
