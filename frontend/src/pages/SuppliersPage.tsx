import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDeactivateSupplier, useSaveSupplier, useSuppliers } from '../api/hooks'
import type { Supplier } from '../api/types'
import { Button, Card, EmptyState, ErrorBox, Field, Input, PageHeader, Spinner } from '../components/ui'
import { useI18n } from '../i18n/useI18n'

type Draft = Pick<Supplier, 'name' | 'contact_name' | 'phone' | 'email' | 'address'> & { id?: number }

const blank: Draft = { name: '', contact_name: '', phone: '', email: '', address: '' }

function SupplierForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [draft, setDraft] = useState(initial)
  const save = useSaveSupplier()
  const { t } = useI18n()
  const set = (key: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate(draft, { onSuccess: onDone })
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="font-semibold">{draft.id ? t('suppliers.editTitle', { name: initial.name }) : t('suppliers.new')}</h2>
        <ErrorBox error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('suppliers.name')}>
            <Input value={draft.name} onChange={set('name')} required autoFocus />
          </Field>
          <Field label={t('suppliers.contact')}>
            <Input value={draft.contact_name} onChange={set('contact_name')} />
          </Field>
          <Field label={t('suppliers.phone')}>
            <Input type="tel" value={draft.phone} onChange={set('phone')} />
          </Field>
          <Field label={t('suppliers.email')}>
            <Input type="email" value={draft.email} onChange={set('email')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('suppliers.address')}>
              <Input value={draft.address} onChange={set('address')} />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('suppliers.save')}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function SuppliersPage() {
  const { data, isLoading, error } = useSuppliers()
  const deactivate = useDeactivateSupplier()
  const { t } = useI18n()
  const [editing, setEditing] = useState<Draft | null>(null)

  return (
    <>
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        actions={!editing && <Button onClick={() => setEditing(blank)}>{t('suppliers.add')}</Button>}
      />

      {editing && <SupplierForm key={editing.id ?? 'new'} initial={editing} onDone={() => setEditing(null)} />}

      <ErrorBox error={error ?? deactivate.error} />
      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState title={t('suppliers.empty')} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className={s.is_active ? '' : 'opacity-50'}>
                  <div className="font-semibold text-slate-900">
                    {s.name}
                    {!s.is_active && <span className="ml-2 text-xs font-medium text-slate-500">{t('suppliers.inactive')}</span>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || t('suppliers.noContact')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(s)}>
                    {t('common.edit')}
                  </Button>
                  {s.is_active && (
                    <Button
                      variant="ghost"
                      disabled={deactivate.isPending}
                      onClick={() => window.confirm(t('suppliers.confirmRemove', { name: s.name })) && deactivate.mutate(s.id)}
                    >
                      {t('common.remove')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        {t('suppliers.keptNote')}
      </p>
    </>
  )
}
