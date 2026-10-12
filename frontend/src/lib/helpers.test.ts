import { describe, expect, it } from 'vitest'
import { describeError } from '../api/client'
import { formatRupiah } from './format'
import { itemFromLowStock } from './orderItems'

describe('describeError', () => {
  it('reads DRF detail messages', () => {
    expect(describeError({ detail: 'Only the store owner can do this.' })).toBe(
      'Only the store owner can do this.',
    )
  })

  it('joins field errors', () => {
    expect(describeError({ supplier: ['This supplier is inactive.'], items: ['Add at least one item.'] })).toBe(
      'supplier: This supplier is inactive. items: Add at least one item.',
    )
  })

  it('handles nested item errors and non-field errors', () => {
    expect(describeError({ non_field_errors: ['Bad request.'] })).toBe('Bad request.')
    expect(describeError({ items: [{}, { quantity: ['Quantity must be at least 1.'] }] })).toBe(
      'items: quantity: Quantity must be at least 1.',
    )
  })
})

describe('formatRupiah', () => {
  it('formats without decimals', () => {
    expect(formatRupiah('862500.00').replace(/\s/g, ' ')).toBe('Rp 862.500')
  })
})

describe('itemFromLowStock', () => {
  const row = {
    id: 'inv-1',
    product_unit_id: 'unit-1',
    product_name: 'Gula 1kg',
    sku: 'GL-1',
    unit_name: 'pack',
    current_stock: 3,
    min_stock_alert: 10,
    retail_price: 18000,
  }

  it('suggests restocking to twice the minimum and links the Lucky Mart unit', () => {
    expect(itemFromLowStock(row)).toMatchObject({
      product_name: 'Gula 1kg',
      lucky_mart_product_unit_id: 'unit-1',
      quantity: 17,
      unit_price: '',
    })
  })

  it('always orders at least one', () => {
    expect(itemFromLowStock({ ...row, current_stock: 50 }).quantity).toBe(1)
  })
})
