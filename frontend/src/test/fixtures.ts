import type { OrderItem, PurchaseOrder, User } from '../api/types'

export const staff: User = { id: 1, username: 'staff', full_name: 'Warehouse Staff', email: '', role: 'STAFF' }
export const owner: User = { id: 2, username: 'owner', full_name: 'Store Owner', email: '', role: 'OWNER' }

export function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 1,
    product_name: 'Beras Premium 5kg',
    sku: 'BRS-5KG',
    unit_name: 'sack',
    lucky_mart_product_unit_id: null,
    quantity: 10,
    unit_price: '68000.00',
    subtotal: '680000.00',
    received_quantity: null,
    sync_status: 'NOT_SYNCED',
    sync_error: '',
    ...overrides,
  }
}

export function makeOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 1,
    number: 'PO-202610-00001',
    supplier: 1,
    supplier_name: 'CV Sumber Beras Toba',
    status: 'DRAFT',
    notes: '',
    expected_date: null,
    items: [makeItem()],
    total_amount: '680000.00',
    created_by: 'Warehouse Staff',
    created_by_id: staff.id,
    approved_by: null,
    rejection_reason: '',
    created_at: '2026-10-12T09:00:00+07:00',
    submitted_at: null,
    decided_at: null,
    received_at: null,
    ...overrides,
  }
}
