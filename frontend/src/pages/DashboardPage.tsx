import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useDashboard, useLowStock } from '../api/hooks'
import { useAuth } from '../auth/useAuth'
import { Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { formatRupiah } from '../lib/format'

function Stat({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const body = (
    <>
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </>
  )
  return (
    <Card className="p-5">
      {to ? (
        <Link to={to} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  )
}

function LowStockCard() {
  const { data, isLoading, error } = useLowStock()

  let content
  if (isLoading) content = <Spinner label="Checking Lucky Mart stock…" />
  else if (error instanceof ApiError && error.status === 503)
    content = (
      <EmptyState title="Lucky Mart is not connected">
        Set the Lucky Mart service account in <code>.env</code> to see low-stock products here.
      </EmptyState>
    )
  else if (error)
    content = (
      <div className="p-5">
        <ErrorBox error={error} />
      </div>
    )
  else if (!data?.length) content = <EmptyState title="All products are above their minimum stock." />
  else
    content = (
      <ul className="divide-y divide-slate-100">
        {data.slice(0, 8).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <div>
              <div className="font-medium text-slate-900">{item.product_name}</div>
              <div className="text-xs text-slate-500">
                {item.sku} · {item.unit_name}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-rose-700">{item.current_stock} left</div>
              <div className="text-xs text-slate-500">min {item.min_stock_alert}</div>
            </div>
          </li>
        ))}
      </ul>
    )

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Low stock in Lucky Mart</h2>
        {!!data?.length && (
          <Link to="/orders/new?from=low-stock" className="text-sm font-semibold text-emerald-700 hover:underline">
            Reorder →
          </Link>
        )}
      </div>
      {content}
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading, error } = useDashboard()

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.full_name}`}
        subtitle="Restocking overview for the store."
        actions={
          <Link to="/orders/new">
            <Button>New purchase order</Button>
          </Link>
        }
      />

      <ErrorBox error={error} />
      {isLoading && <Spinner />}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Waiting for approval" value={data.waiting_for_approval} to="/orders?status=SUBMITTED" />
          <Stat label="Approved, not received" value={data.orders_by_status.APPROVED} to="/orders?status=APPROVED" />
          <Stat label="Received this month" value={formatRupiah(data.received_this_month)} />
          <Stat
            label="Failed stock syncs"
            value={data.failed_stock_syncs}
            to={data.failed_stock_syncs ? '/orders?status=RECEIVED' : undefined}
          />
        </div>
      )}

      <div className="mt-6">
        <LowStockCard />
      </div>
    </>
  )
}
