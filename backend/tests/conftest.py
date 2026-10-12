import pytest
from rest_framework.test import APIClient

from accounts.models import User
from procurement import luckymart
from procurement.models import Supplier

LUCKY_MART_URL = "http://luckymart.test"


def make_user(username, role):
    return User.objects.create_user(username=username, password="test-pass-123", role=role)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def owner(db):
    return make_user("owner", User.Role.OWNER)


@pytest.fixture
def staff(db):
    return make_user("staff", User.Role.STAFF)


@pytest.fixture
def other_staff(db):
    return make_user("staff2", User.Role.STAFF)


@pytest.fixture
def owner_api(owner):
    return client_for(owner)


@pytest.fixture
def staff_api(staff):
    return client_for(staff)


@pytest.fixture
def other_staff_api(other_staff):
    return client_for(other_staff)


@pytest.fixture
def supplier(db):
    return Supplier.objects.create(name="CV Sumber Beras Toba", phone="0811-0000-0001")


@pytest.fixture(autouse=True)
def lucky_mart_settings(settings):
    settings.LUCKY_MART = {
        "API_URL": LUCKY_MART_URL,
        "PHONE_NUMBER": "081100000000",
        "PASSWORD": "service-pass",
        "TIMEOUT_SECONDS": 2,
    }
    luckymart.reset_client()
    yield
    luckymart.reset_client()


@pytest.fixture
def order_payload(supplier):
    return {
        "supplier": supplier.id,
        "notes": "Weekly restock",
        "items": [
            {
                "product_name": "Beras Premium 5kg",
                "sku": "BRS-5KG",
                "unit_name": "sack",
                "lucky_mart_product_unit_id": "6f1c1f3e-3c1a-4c55-9a59-2f3f1d6d1a01",
                "quantity": 10,
                "unit_price": "68000.00",
            },
            {
                "product_name": "Minyak Goreng 2L",
                "quantity": 5,
                "unit_price": "36500.00",
            },
        ],
    }


@pytest.fixture
def create_order(staff_api, order_payload):
    def _create(**overrides):
        resp = staff_api.post(
            "/api/purchase-orders/", {**order_payload, **overrides}, format="json"
        )
        assert resp.status_code == 201, resp.data
        return resp.data

    return _create
