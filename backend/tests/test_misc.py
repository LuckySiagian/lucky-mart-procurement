import pytest

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_login_returns_tokens_with_role(client):
    User.objects.create_user(username="owner", password="test-pass-123", role=User.Role.OWNER)
    resp = client.post(
        "/api/auth/login/",
        {"username": "owner", "password": "test-pass-123"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert {"access", "refresh"} <= resp.json().keys()


def test_me(staff_api):
    resp = staff_api.get("/api/auth/me/")
    assert resp.data["username"] == "staff"
    assert resp.data["role"] == "STAFF"


def test_health_is_public(client):
    resp = client.get("/api/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "up"}


def test_metrics_endpoint(client):
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert b"django_http_requests" in resp.content


def test_supplier_with_orders_is_deactivated_not_deleted(staff_api, create_order, supplier):
    create_order()
    resp = staff_api.delete(f"/api/suppliers/{supplier.id}/")
    assert resp.status_code == 204
    supplier.refresh_from_db()
    assert supplier.is_active is False


def test_dashboard_counts(staff_api, create_order):
    order = create_order()
    create_order()
    staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")

    resp = staff_api.get("/api/dashboard/")
    assert resp.data["orders_by_status"]["DRAFT"] == 1
    assert resp.data["waiting_for_approval"] == 1
