import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, post } from './client'
import type {
  Dashboard,
  LowStockItem,
  OrderInput,
  OrderStatus,
  Page,
  PurchaseOrder,
  Supplier,
} from './types'

export const keys = {
  dashboard: ['dashboard'] as const,
  lowStock: ['low-stock'] as const,
  suppliers: (activeOnly: boolean) => ['suppliers', { activeOnly }] as const,
  orders: (status: OrderStatus | '', search: string, page: number) =>
    ['orders', { status, search, page }] as const,
  order: (id: number) => ['order', id] as const,
}

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/dashboard/') })
}

export function useLowStock() {
  return useQuery({
    queryKey: keys.lowStock,
    queryFn: () => api<LowStockItem[]>('/lucky-mart/low-stock/'),
    // 503 = integration not configured, 502 = Lucky Mart unreachable: don't hammer it.
    retry: (count, error) => !(error instanceof ApiError && error.status >= 500) && count < 2,
  })
}

export function useSuppliers(activeOnly = false) {
  return useQuery({
    queryKey: keys.suppliers(activeOnly),
    queryFn: () =>
      api<Page<Supplier>>(`/suppliers/?page_size=100${activeOnly ? '&is_active=true' : ''}`),
    select: (page) => page.results,
  })
}

export function useSaveSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (supplier: Partial<Supplier>) =>
      supplier.id
        ? api<Supplier>(`/suppliers/${supplier.id}/`, {
            method: 'PATCH',
            body: JSON.stringify(supplier),
          })
        : post<Supplier>('/suppliers/', supplier),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useDeactivateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/suppliers/${id}/`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useOrders(status: OrderStatus | '', search: string, page: number) {
  const params = new URLSearchParams({ page: String(page) })
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  return useQuery({
    queryKey: keys.orders(status, search, page),
    queryFn: () => api<Page<PurchaseOrder>>(`/purchase-orders/?${params}`),
    placeholderData: (previous) => previous,
  })
}

export function useOrder(id: number | undefined) {
  return useQuery({
    queryKey: keys.order(id ?? 0),
    queryFn: () => api<PurchaseOrder>(`/purchase-orders/${id}/`),
    enabled: id !== undefined,
  })
}

/** Any change to an order refreshes the order itself, the lists and the dashboard. */
function useOrderMutation<TVars>(request: (vars: TVars) => Promise<PurchaseOrder>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (order) => {
      qc.setQueryData(keys.order(order.id), order)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

export function useSaveOrder(id?: number) {
  return useOrderMutation((input: OrderInput) =>
    id
      ? api<PurchaseOrder>(`/purchase-orders/${id}/`, {
          method: 'PUT',
          body: JSON.stringify(input),
        })
      : post<PurchaseOrder>('/purchase-orders/', input),
  )
}

export type OrderAction = 'submit' | 'approve' | 'reject' | 'cancel' | 'receive' | 'sync-stock'

export function useOrderAction(id: number) {
  return useOrderMutation(({ action, body }: { action: OrderAction; body?: unknown }) =>
    post<PurchaseOrder>(`/purchase-orders/${id}/${action}/`, body ?? {}),
  )
}
