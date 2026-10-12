import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useDashboard, useLowStock } from '../api/hooks'
import { useAuth } from '../auth/useAuth'
import { Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { useI18n } from '../i18n/useI18n'
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
  const { t } = useI18n()
  const { data, isLoading, error } = useLowStock()

  let content
  if (isLoading) content = <Spinner label={t('dashboard.checkingStock')} />
  else if (error instanceof ApiError && error.status === 503)
    content = <EmptyState title={t('dashboard.notConnected')}>{t('dashboard.notConnectedHelp')}</EmptyState>
  else if (error)
    content = (
      <div className="p-5">
        <ErrorBox error={error} />
      </div>
    )
  else if (!data?.length) content = <EmptyState title={t('dashboard.allStocked')} />
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
              <div className="font-semibold text-rose-700">{t('dashboard.left', { count: item.current_stock })}</div>
              <div className="text-xs text-slate-500">{t('dashboard.min', { count: item.min_stock_alert })}</div>
            </div>
          </li>
        ))}
      </ul>
    )

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{t('dashboard.lowStock')}</h2>
        {!!data?.length && (
          <Link to="/orders/new?from=low-stock" className="text-sm font-semibold text-emerald-700 hover:underline">
            {t('dashboard.reorder')}
          </Link>
        )}
      </div>
      {content}
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { data, isLoading, error } = useDashboard()

  return (
    <>
      <PageHeader
        title={t('dashboard.hello', { name: user?.full_name ?? '' })}
        subtitle={t('dashboard.subtitle')}
        actions={
          <Link to="/orders/new">
            <Button>{t('dashboard.newOrder')}</Button>
          </Link>
        }
      />

      <ErrorBox error={error} />
      {isLoading && <Spinner />}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('dashboard.waiting')} value={data.waiting_for_approval} to="/orders?status=SUBMITTED" />
          <Stat
            label={t('dashboard.approvedNotReceived')}
            value={data.orders_by_status.APPROVED}
            to="/orders?status=APPROVED"
          />
          <Stat label={t('dashboard.receivedThisMonth')} value={formatRupiah(data.received_this_month)} />
          <Stat
            label={t('dashboard.failedSyncs')}
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
