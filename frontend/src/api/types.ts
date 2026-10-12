export type Role = 'STAFF' | 'OWNER'

export interface User {
  id: number
  username: string
  full_name: string
  email: string
  role: Role
}

export interface Supplier {
  id: number
  name: string
  contact_name: string
  phone: string
  email: string
  address: string
  is_active: boolean
  created_at: string
}

export type OrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'CANCELLED'

export type SyncStatus = 'NOT_SYNCED' | 'SYNCED' | 'FAILED' | 'SKIPPED'

export interface OrderItem {
  id: number
  product_name: string
  sku: string
  unit_name: string
  lucky_mart_product_unit_id: string | null
  quantity: number
  unit_price: string
  subtotal: string
  received_quantity: number | null
  sync_status: SyncStatus
  sync_error: string
}

export interface OrderEvent {
  id: number
  action: string
  note: string
  actor: string
  created_at: string
}

export interface PurchaseOrder {
  id: number
  number: string
  supplier: number
  supplier_name: string
  status: OrderStatus
  notes: string
  expected_date: string | null
  items: OrderItem[]
  total_amount: string
  created_by: string
  created_by_id: number
  approved_by: string | null
  rejection_reason: string
  created_at: string
  submitted_at: string | null
  decided_at: string | null
  received_at: string | null
  events?: OrderEvent[]
}

export interface OrderItemInput {
  product_name: string
  sku: string
  unit_name: string
  lucky_mart_product_unit_id: string | null
  quantity: number
  unit_price: string
}

export interface OrderInput {
  supplier: number
  notes: string
  expected_date: string | null
  items: OrderItemInput[]
}

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Dashboard {
  orders_by_status: Record<OrderStatus, number>
  waiting_for_approval: number
  received_this_month: string
  failed_stock_syncs: number
}

/** A row from Lucky Mart's GET /inventory/low-stock. */
export interface LowStockItem {
  id: string
  product_unit_id: string
  product_name: string
  sku: string
  unit_name: string
  current_stock: number
  min_stock_alert: number
  retail_price: number
}
