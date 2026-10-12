import type { PurchaseOrder, User } from '../api/types'

export type UiAction = 'edit' | 'submit' | 'cancel' | 'approve' | 'reject' | 'receive' | 'retry-sync'

/**
 * Which buttons to show for an order. Mirrors the backend rules in workflow.py;
 * the API still enforces them, this only keeps the UI from offering dead ends.
 */
export function availableActions(order: PurchaseOrder, user: User): UiAction[] {
  const isCreator = order.created_by_id === user.id
  const isOwner = user.role === 'OWNER'
  const actions: UiAction[] = []

  switch (order.status) {
    case 'DRAFT':
      if (isCreator || isOwner) actions.push('edit', 'submit', 'cancel')
      break
    case 'SUBMITTED':
      if (isOwner && !isCreator) actions.push('approve', 'reject')
      if (isCreator || isOwner) actions.push('cancel')
      break
    case 'APPROVED':
      actions.push('receive')
      break
    case 'RECEIVED':
      if (order.items.some((item) => item.sync_status === 'FAILED')) actions.push('retry-sync')
      break
  }
  return actions
}
