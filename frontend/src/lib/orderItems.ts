import type { LowStockItem, OrderItemInput } from '../api/types'

/** Suggest enough to get back to twice the minimum stock. */
export function itemFromLowStock(row: LowStockItem): OrderItemInput {
  return {
    product_name: row.product_name,
    sku: row.sku,
    unit_name: row.unit_name,
    lucky_mart_product_unit_id: row.product_unit_id,
    quantity: Math.max(row.min_stock_alert * 2 - row.current_stock, 1),
    unit_price: '',
  }
}
