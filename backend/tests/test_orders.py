import pytest

pytestmark = pytest.mark.django_db


def test_create_order_generates_number_and_total(create_order):
    order = create_order()

    assert order["number"].startswith("PO-")
    assert order["status"] == "DRAFT"
    assert order["total_amount"] == "862500.00"  # 10 x 68,000 + 5 x 36,500
    assert [e["action"] for e in order["events"]] == ["CREATED"]


def test_order_needs_items(staff_api, supplier):
    resp = staff_api.post(
        "/api/purchase-orders/", {"supplier": supplier.id, "items": []}, format="json"
    )
    assert resp.status_code == 400
    assert "items" in resp.data


def test_inactive_supplier_is_rejected(staff_api, order_payload, supplier):
    supplier.is_active = False
    supplier.save()
    resp = staff_api.post("/api/purchase-orders/", order_payload, format="json")
    assert resp.status_code == 400
    assert "supplier" in resp.data


def test_list_shows_totals(staff_api, create_order):
    create_order()
    create_order()
    resp = staff_api.get("/api/purchase-orders/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2
    assert {o["total_amount"] for o in resp.data["results"]} == {"862500.00"}


def test_draft_can_be_edited_and_items_replaced(staff_api, create_order, supplier):
    order = create_order()
    resp = staff_api.put(
        f"/api/purchase-orders/{order['id']}/",
        {
            "supplier": supplier.id,
            "notes": "Changed",
            "items": [{"product_name": "Gula 1kg", "quantity": 20, "unit_price": "17000"}],
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["notes"] == "Changed"
    assert len(resp.data["items"]) == 1
    assert resp.data["total_amount"] == "340000.00"


def test_other_staff_cannot_edit_someone_elses_draft(other_staff_api, create_order):
    order = create_order()
    resp = other_staff_api.patch(
        f"/api/purchase-orders/{order['id']}/", {"notes": "hijack"}, format="json"
    )
    assert resp.status_code == 403


def test_full_approval_flow(staff_api, owner_api, create_order):
    order = create_order()

    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")
    assert resp.status_code == 200
    assert resp.data["status"] == "SUBMITTED"

    # Submitted orders are locked for editing.
    resp = staff_api.patch(f"/api/purchase-orders/{order['id']}/", {"notes": "x"}, format="json")
    assert resp.status_code == 403

    resp = owner_api.post(f"/api/purchase-orders/{order['id']}/approve/", {"note": "OK"})
    assert resp.status_code == 200
    assert resp.data["status"] == "APPROVED"
    assert resp.data["approved_by"] == "owner"
    assert [e["action"] for e in resp.data["events"]] == ["CREATED", "SUBMITTED", "APPROVED"]


def test_staff_cannot_approve(staff_api, create_order):
    order = create_order()
    staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")
    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/approve/")
    assert resp.status_code == 403


def test_owner_cannot_approve_own_order(owner_api, order_payload):
    order = owner_api.post("/api/purchase-orders/", order_payload, format="json").data
    owner_api.post(f"/api/purchase-orders/{order['id']}/submit/")
    resp = owner_api.post(f"/api/purchase-orders/{order['id']}/approve/")
    assert resp.status_code == 403


def test_cannot_approve_a_draft(owner_api, create_order):
    order = create_order()
    resp = owner_api.post(f"/api/purchase-orders/{order['id']}/approve/")
    assert resp.status_code == 400


def test_reject_needs_reason(staff_api, owner_api, create_order):
    order = create_order()
    staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")

    resp = owner_api.post(f"/api/purchase-orders/{order['id']}/reject/", {"reason": "  "})
    assert resp.status_code == 400

    resp = owner_api.post(
        f"/api/purchase-orders/{order['id']}/reject/", {"reason": "Price too high"}
    )
    assert resp.status_code == 200
    assert resp.data["status"] == "REJECTED"
    assert resp.data["rejection_reason"] == "Price too high"


def test_cancel_by_creator(staff_api, create_order):
    order = create_order()
    resp = staff_api.post(f"/api/purchase-orders/{order['id']}/cancel/", {"note": "Duplicate"})
    assert resp.status_code == 200
    assert resp.data["status"] == "CANCELLED"


def test_filter_by_status(staff_api, create_order):
    first = create_order()
    create_order()
    staff_api.post(f"/api/purchase-orders/{first['id']}/submit/")

    resp = staff_api.get("/api/purchase-orders/?status=SUBMITTED")
    assert [o["id"] for o in resp.data["results"]] == [first["id"]]


def test_requires_authentication(client, db):
    assert client.get("/api/purchase-orders/").status_code == 401


def test_other_staff_cannot_submit_someone_elses_draft(other_staff_api, create_order):
    order = create_order()
    resp = other_staff_api.post(f"/api/purchase-orders/{order['id']}/submit/")
    assert resp.status_code == 403


def test_page_size_param(staff_api, supplier):
    resp = staff_api.get("/api/suppliers/?page_size=100")
    assert resp.status_code == 200
    assert resp.data["count"] == 1
