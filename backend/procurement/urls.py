from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("purchase-orders", views.PurchaseOrderViewSet, basename="purchase-order")

urlpatterns = [
    path("health/", views.health, name="health"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("lucky-mart/low-stock/", views.low_stock, name="low-stock"),
    path("", include(router.urls)),
]
