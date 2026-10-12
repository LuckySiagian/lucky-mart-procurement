import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders } from '../api/hooks'
import type { OrderStatus } from '../api/types'
import { Button, Card, EmptyState, ErrorBox, Input, PageHeader, Spinner, StatusBadge } from '../components/ui'
import { formatDate, formatRupiah, STATUS_LABEL } from '../lib/format'

const FILTERS: (OrderStatus | '')[] = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'REJECTED', 'CANCELLED']

export default function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as OrderStatus | ''
  const page = Number(params.get('page') ?? '1')
  const [search, setSearch] = useState(params.get('search') ?? '')

  const appliedSearch = params.get('search') ?? ''
  const { data, isLoading, error, isFetching } = useOrders(status, appliedSearch, page)

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => {
    if (search === appliedSearch) return
    const id = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (search) next.set('search', search)
        else next.delete('search')
        next.delete('page')
        return next
      })
    }, 300)
    return () => clearTimeout(id)
  }, [search, appliedSearch, setParams])

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Orders to suppliers, from draft to received."
        actions={
          <Link to="/orders/new">
            <Button>New purchase order</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((value) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={status === value}
              onClick={() => update('status', value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                status === value
                  ? 'bg-emerald-700 text-white ring-emerald-700'
                  : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {value ? STATUS_LABEL[value] : 'All'}
            </button>
          ))}
        </div>
        <Input
          type="search"
          placeholder="Search number or supplier…"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto sm:max-w-xs"
        />
      </div>

      <ErrorBox error={error} />
      <Card className={isFetching && !isLoading ? 'opacity-70' : ''}>
        {isLoading ? (
          <Spinner />
        ) : !data?.results.length ? (
          <EmptyState title="No purchase orders found.">
            {status || search ? 'Try another filter.' : 'Create the first one to restock the store.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Number</th>
                  <th className="px-5 py-3 font-semibold">Supplier</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.results.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-5 py-3 font-semibold whitespace-nowrap">
                      <Link to={`/orders/${order.id}`} className="text-emerald-800 hover:underline">
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{order.supplier_name}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatRupiah(order.total_amount)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(order.created_at)} · {order.created_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && (data.next || data.previous) && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>{data.count} orders</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!data.previous} onClick={() => update('page', String(page - 1))}>
              Previous
            </Button>
            <Button variant="secondary" disabled={!data.next} onClick={() => update('page', String(page + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
