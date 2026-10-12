import json

import pytest
import requests
import responses

from .conftest import LUCKY_MART_URL

pytestmark = pytest.mark.django_db

LOGIN_URL = f"{LUCKY_MART_URL}/api/v1/auth/login"
ADJUST_URL = f"{LUCKY_MART_URL}/api/v1/inventory/adjust"
LOW_STOCK_URL = f"{LUCKY_MART_URL}/api/v1/inventory/low-stock"


def mock_login(token="token-1"):
    responses.post(LOGIN_URL, json={"success": True, "data": {"access_token": token}})


def approved_order(create_order, staff_api, owner_api):
    order = create_order()
    staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")
    owner_api.post(f"/api/purchase-orders/{order['id']}/approve/")
    return order


@responses.activate
def test_receive_adds_stock_in_lucky_mart(create_order, staff_api, owner_api):
    mock_login()
    responses.post(ADJUST_URL, json={"success": True, "data": {}})
    order = approved_order(create_order, staff_api, owner_api)
    beras = order["items"][0]

    resp = staff_api.post(
        f"/api/purchase-orders/{order['id']}/receive/",
        {"items": [{"id": beras["id"], "received_quantity": 8}], "note": "2 sacks damaged"},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "RECEIVED"
    items = {i["product_name"]: i for i in resp.data["items"]}
    assert items["Beras Premium 5kg"]["received_quantity"] == 8
    assert items["Beras Premium 5kg"]["sync_status"] == "SYNCED"
    # No Lucky Mart product linked, so nothing to send.
    assert items["Minyak Goreng 2L"]["sync_status"] == "SKIPPED"

    adjust_calls = [c for c in responses.calls if c.request.url == ADJUST_URL]
    assert len(adjust_calls) == 1
    body = json.loads(adjust_calls[0].request.body)
    assert body == {
        "product_unit_id": beras["lucky_mart_product_unit_id"],
        "adjustment_type": "STOCK_IN",
        "quantity_changed": 8,
        "reference_number": order["number"],
        "notes": f"Received from CV Sumber Beras Toba ({order['number']})",
    }
    assert adjust_calls[0].request.headers["Authorization"] == "Bearer token-1"


def test_cannot_receive_before_approval(create_order, staff_api):
    order = create_order()
    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/receive/", {}, format="json")
    assert resp.status_code == 400


def test_received_quantity_cannot_exceed_ordered(create_order, staff_api, owner_api):
    order = approved_order(create_order, staff_api, owner_api)
    item = order["items"][0]
    resp = staff_api.post(
        f"/api/purchase-orders/{order['id']}/receive/",
        {"items": [{"id": item["id"], "received_quantity": 11}]},
        format="json",
    )
    assert resp.status_code == 400


@responses.activate
def test_failed_sync_keeps_receipt_and_can_be_retried(create_order, staff_api, owner_api):
    mock_login()
    responses.post(ADJUST_URL, status=500, json={"success": False, "message": "db down"})
    order = approved_order(create_order, staff_api, owner_api)

    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/receive/", {}, format="json")
    assert resp.data["status"] == "RECEIVED"
    assert resp.data["items"][0]["sync_status"] == "FAILED"
    assert "db down" in resp.data["items"][0]["sync_error"]

    responses.replace(responses.POST, ADJUST_URL, json={"success": True, "data": {}})
    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/sync-stock/")
    assert resp.data["items"][0]["sync_status"] == "SYNCED"

    # Retrying again sends nothing new: synced lines are never sent twice.
    calls_before = len(responses.calls)
    staff_api.post(f"/api/purchase-orders/{order['id']}/sync-stock/")
    assert len(responses.calls) == calls_before


@responses.activate
def test_expired_token_triggers_one_relogin(create_order, staff_api, owner_api):
    responses.post(LOGIN_URL, json={"data": {"access_token": "old"}})
    responses.post(LOGIN_URL, json={"data": {"access_token": "new"}})
    responses.post(ADJUST_URL, status=401, json={"message": "expired"})
    responses.post(ADJUST_URL, json={"success": True, "data": {}})
    order = approved_order(create_order, staff_api, owner_api)

    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/receive/", {}, format="json")

    assert resp.data["items"][0]["sync_status"] == "SYNCED"
    adjust_calls = [c for c in responses.calls if c.request.url == ADJUST_URL]
    assert adjust_calls[-1].request.headers["Authorization"] == "Bearer new"


@responses.activate
def test_low_stock_proxies_lucky_mart(staff_api):
    mock_login()
    responses.get(
        LOW_STOCK_URL,
        json={"success": True, "data": [{"product_name": "Beras Premium 5kg", "current_stock": 2}]},
    )
    resp = staff_api.get("/api/lucky-mart/low-stock/")
    assert resp.status_code == 200
    assert resp.data[0]["product_name"] == "Beras Premium 5kg"


@responses.activate
def test_low_stock_when_lucky_mart_is_down(staff_api):
    responses.post(LOGIN_URL, body=requests.ConnectionError("refused"))
    resp = staff_api.get("/api/lucky-mart/low-stock/")
    assert resp.status_code == 502


def test_low_stock_when_not_configured(staff_api, settings):
    settings.LUCKY_MART = {**settings.LUCKY_MART, "API_URL": ""}
    resp = staff_api.get("/api/lucky-mart/low-stock/")
    assert resp.status_code == 503


def test_unlinked_items_are_skipped_even_without_lucky_mart(
    create_order, staff_api, owner_api, supplier, settings
):
    settings.LUCKY_MART = {**settings.LUCKY_MART, "API_URL": ""}
    order = create_order(
        items=[{"product_name": "Telur 1 tray", "quantity": 3, "unit_price": "52000"}]
    )
    staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")
    owner_api.post(f"/api/purchase-orders/{order['id']}/approve/")

    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/receive/", {}, format="json")

    assert resp.data["items"][0]["sync_status"] == "SKIPPED"


def test_linked_items_fail_when_lucky_mart_is_not_configured(
    create_order, staff_api, owner_api, settings
):
    settings.LUCKY_MART = {**settings.LUCKY_MART, "API_URL": ""}
    order = approved_order(create_order, staff_api, owner_api)

    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/receive/", {}, format="json")

    statuses = {i["product_name"]: i["sync_status"] for i in resp.data["items"]}
    assert statuses == {"Beras Premium 5kg": "FAILED", "Minyak Goreng 2L": "SKIPPED"}
