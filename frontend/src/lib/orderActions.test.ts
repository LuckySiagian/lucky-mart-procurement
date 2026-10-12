import { describe, expect, it } from 'vitest'
import type { User } from '../api/types'
import { makeItem, makeOrder, owner, staff } from '../test/fixtures'
import { availableActions } from './orderActions'

const otherStaff: User = { ...staff, id: 3, username: 'staff2' }

describe('availableActions', () => {
  it('lets the creator edit, submit and cancel a draft', () => {
    expect(availableActions(makeOrder(), staff)).toEqual(['edit', 'submit', 'cancel'])
  })

  it('gives other staff nothing on someone else’s draft', () => {
    expect(availableActions(makeOrder(), otherStaff)).toEqual([])
  })

  it('lets the owner approve or reject a submitted order', () => {
    expect(availableActions(makeOrder({ status: 'SUBMITTED' }), owner)).toEqual(['approve', 'reject', 'cancel'])
  })

  it('does not let the owner approve their own order', () => {
    const order = makeOrder({ status: 'SUBMITTED', created_by_id: owner.id })
    expect(availableActions(order, owner)).toEqual(['cancel'])
  })

  it('lets anyone receive an approved order', () => {
    expect(availableActions(makeOrder({ status: 'APPROVED' }), otherStaff)).toEqual(['receive'])
  })

  it('offers a retry only when a stock sync failed', () => {
    const synced = makeOrder({ status: 'RECEIVED', items: [makeItem({ sync_status: 'SYNCED' })] })
    const failed = makeOrder({ status: 'RECEIVED', items: [makeItem({ sync_status: 'FAILED' })] })
    expect(availableActions(synced, staff)).toEqual([])
    expect(availableActions(failed, staff)).toEqual(['retry-sync'])
  })

  it('has no actions on closed orders', () => {
    for (const status of ['REJECTED', 'CANCELLED'] as const) {
      expect(availableActions(makeOrder({ status }), owner)).toEqual([])
    }
  })
})
