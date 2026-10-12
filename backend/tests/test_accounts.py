import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

URL = "/api/auth/change-password/"


def test_change_password(staff, staff_api):
    resp = staff_api.post(
        URL,
        {"current_password": "test-pass-123", "new_password": "Kopi-Toba-2026"},
        format="json",
    )
    assert resp.status_code == 204

    staff.refresh_from_db()
    assert staff.check_password("Kopi-Toba-2026")

    login = APIClient().post(
        "/api/auth/login/",
        {"username": "staff", "password": "Kopi-Toba-2026"},
        format="json",
    )
    assert login.status_code == 200


def test_wrong_current_password(staff, staff_api):
    resp = staff_api.post(
        URL, {"current_password": "nope", "new_password": "Kopi-Toba-2026"}, format="json"
    )
    assert resp.status_code == 400
    assert "current_password" in resp.data
    staff.refresh_from_db()
    assert staff.check_password("test-pass-123")


@pytest.mark.parametrize("weak", ["12345678", "short", "password123", "staff"])
def test_weak_passwords_are_rejected(staff_api, weak):
    resp = staff_api.post(
        URL, {"current_password": "test-pass-123", "new_password": weak}, format="json"
    )
    assert resp.status_code == 400
    assert "new_password" in resp.data


def test_new_password_must_differ(staff_api):
    resp = staff_api.post(
        URL, {"current_password": "test-pass-123", "new_password": "test-pass-123"}, format="json"
    )
    assert resp.status_code == 400


def test_owner_can_change_own_password(owner, owner_api):
    resp = owner_api.post(
        URL,
        {"current_password": "test-pass-123", "new_password": "Pemilik-Toko-77"},
        format="json",
    )
    assert resp.status_code == 204
    owner.refresh_from_db()
    assert owner.check_password("Pemilik-Toko-77")


def test_requires_login(db):
    resp = APIClient().post(URL, {}, format="json")
    assert resp.status_code == 401


def test_errors_follow_accept_language(staff_api, create_order):
    order = create_order()
    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/approve/", HTTP_ACCEPT_LANGUAGE="id")
    assert resp.status_code == 403
    assert resp.data["detail"] == "Hanya pemilik toko yang dapat melakukan ini."

    resp = staff_api.post(
        URL,
        {"current_password": "nope", "new_password": "Kopi-Toba-2026"},
        format="json",
        HTTP_ACCEPT_LANGUAGE="id",
    )
    assert resp.data["current_password"] == ["Password Anda saat ini salah."]


def test_english_is_the_default(staff_api, create_order):
    order = create_order()
    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/approve/")
    assert resp.data["detail"] == "Only the store owner can do this."
