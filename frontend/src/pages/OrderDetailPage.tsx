import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOrder, useOrderAction } from '../api/hooks'
import type { OrderAction } from '../api/hooks'
import type { PurchaseOrder, SyncStatus } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, StatusBadge } from '../components/ui'
import type { MessageKey } from '../i18n/en'
import { useI18n } from '../i18n/useI18n'
import { formatDate, formatDateTime, formatRupiah } from '../lib/format'
import { availableActions } from '../lib/orderActions'

const SYNC_STYLE: Record<SyncStatus, string> = {
  NOT_SYNCED: 'text-slate-500',
  SYNCED: 'text-emerald-700',
  FAILED: 'text-rose-700',
  SKIPPED: 'text-slate-400',
}

function ReceiveForm({
  order,
  busy,
  onSubmit,
  onCancel,
}: {
  order: PurchaseOrder
  busy: boolean
  onSubmit: (body: unknown) => void
  onCancel: () => void
}) {
  const [received, setReceived] = useState<Record<number, number>>(
    Object.fromEntries(order.items.map((i) => [i.id, i.quantity])),
  )
  const [note, setNote] = useState('')
  const { t } = useI18n()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      items: Object.entries(received).map(([id, qty]) => ({ id: Number(id), received_quantity: qty })),
      note,
    })
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="font-semibold">{t('detail.receiveTitle')}</h2>
          <p className="text-sm text-slate-600">{t('detail.receiveHelp')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {order.items.map((item) => (
            <Field key={item.id} label={t('detail.ordered', { name: item.product_name, count: item.quantity })}>
              <Input
                type="number"
                min={0}
                max={item.quantity}
                value={received[item.id]}
                onChange={(e) => setReceived((r) => ({ ...r, [item.id]: Number(e.target.value) }))}
                required
              />
            </Field>
          ))}
        </div>
        <Field label={t('detail.receiveNote')} hint={t('detail.receiveNoteHint')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? t('common.saving') : t('detail.confirmReceipt')}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.back')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function RejectForm({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  const { t } = useI18n()
  return (
    <Card className="mb-6 p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(reason)
        }}
        className="space-y-4"
      >
        <Field label={t('detail.rejectReason')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="danger" disabled={busy || !reason.trim()}>
            {t('detail.rejectSubmit')}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.back')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function OrderDetailPage() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const { data: order, isLoading, error } = useOrder(id)
  const mutation = useOrderAction(id)
  const [panel, setPanel] = useState<'receive' | 'reject' | null>(null)

  if (isLoading) return <Spinner />
  if (error || !order || !user) return <ErrorBox error={error ?? new Error(t('form.notFound'))} />

  const actions = availableActions(order, user)
  const eventLabel = (action: string) => {
    const key = `event.${action}` as MessageKey
    const label = t(key)
    return label === key ? action : label
  }
  const run = (action: OrderAction, body?: unknown) =>
    mutation.mutate({ action, body }, { onSuccess: () => setPanel(null) })

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.number} <StatusBadge status={order.status} />
          </span>
        }
        subtitle={
          <>
            <Link to="/orders" className="text-emerald-700 hover:underline">
              {t('detail.breadcrumb')}
            </Link>{' '}
            · {order.supplier_name} ·{' '}
            {t('detail.createdBy', { name: order.created_by, date: formatDate(order.created_at, locale) })}
          </>
        }
        actions={
          <>
            {actions.includes('edit') && (
              <Link to={`/orders/${order.id}/edit`}>
                <Button variant="secondary">{t('common.edit')}</Button>
              </Link>
            )}
            {actions.includes('cancel') && (
              <Button
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => window.confirm(t('detail.confirmCancel', { number: order.number })) && run('cancel')}
              >
                {t('detail.cancelOrder')}
              </Button>
            )}
            {actions.includes('submit') && (
              <Button disabled={mutation.isPending} onClick={() => run('submit')}>
                {t('detail.submit')}
              </Button>
            )}
            {actions.includes('reject') && (
              <Button variant="secondary" onClick={() => setPanel('reject')}>
                {t('detail.reject')}
              </Button>
            )}
            {actions.includes('approve') && (
              <Button disabled={mutation.isPending} onClick={() => run('approve')}>
                {t('detail.approve')}
              </Button>
            )}
            {actions.includes('receive') && panel !== 'receive' && (
              <Button onClick={() => setPanel('receive')}>{t('detail.receive')}</Button>
            )}
            {actions.includes('retry-sync') && (
              <Button disabled={mutation.isPending} onClick={() => run('sync-stock')}>
                {t('detail.retrySync')}
              </Button>
            )}
          </>
        }
      />

      {order.status === 'SUBMITTED' && order.created_by_id === user.id && user.role === 'OWNER' && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {t('detail.ownOrder')}
        </p>
      )}

      <div className="mb-6">
        <ErrorBox error={mutation.error} />
      </div>

      {panel === 'receive' && (
        <ReceiveForm order={order} busy={mutation.isPending} onSubmit={(body) => run('receive', body)} onCancel={() => setPanel(null)} />
      )}
      {panel === 'reject' && (
        <RejectForm busy={mutation.isPending} onSubmit={(reason) => run('reject', { reason })} onCancel={() => setPanel(null)} />
      )}

      {order.status === 'REJECTED' && (
        <p className="mb-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200">
          <strong>{t('detail.rejected')}</strong> {order.rejection_reason}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t('detail.col.product')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('detail.col.qty')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('detail.col.price')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('detail.col.subtotal')}</th>
                  {order.status === 'RECEIVED' && <th className="px-5 py-3 font-semibold">{t('detail.col.received')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{item.product_name}</div>
                      {(item.sku || item.unit_name) && (
                        <div className="text-xs text-slate-500">{[item.sku, item.unit_name].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">{formatRupiah(item.unit_price)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">{formatRupiah(item.subtotal)}</td>
                    {order.status === 'RECEIVED' && (
                      <td className="px-5 py-3">
                        <div className="tabular-nums">{item.received_quantity}</div>
                        <div className={`text-xs ${SYNC_STYLE[item.sync_status]}`} title={item.sync_error || undefined}>
                          {t(`sync.${item.sync_status}`)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-right font-semibold">
                    {t('common.total')}
                  </td>
                  <td className="px-5 py-3 text-right font-bold whitespace-nowrap tabular-nums">
                    {formatRupiah(order.total_amount)}
                  </td>
                  {order.status === 'RECEIVED' && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <dl className="space-y-3">
              <div>
                <dt className="text-slate-500">{t('detail.expected')}</dt>
                <dd className="font-medium">{formatDate(order.expected_date, locale)}</dd>
              </div>
              {order.approved_by && (
                <div>
                  <dt className="text-slate-500">{t('detail.approvedBy')}</dt>
                  <dd className="font-medium">{order.approved_by}</dd>
                </div>
              )}
              {order.notes && (
                <div>
                  <dt className="text-slate-500">{t('detail.notes')}</dt>
                  <dd className="font-medium">{order.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold">{t('detail.history')}</h2>
            <ol className="space-y-4 border-l border-slate-200 pl-4 text-sm">
              {order.events?.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.3rem] h-2 w-2 rounded-full bg-emerald-600" />
                  <div className="font-medium text-slate-900">{eventLabel(event.action)}</div>
                  <div className="text-xs text-slate-500">
                    {event.actor === 'System' ? t('event.system') : event.actor} · {formatDateTime(event.created_at, locale)}
                  </div>
                  {event.note && <div className="mt-1 text-slate-700">{event.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
