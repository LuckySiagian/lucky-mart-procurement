import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDeactivateSupplier, useSaveSupplier, useSuppliers } from '../api/hooks'
import type { Supplier } from '../api/types'
import { Button, Card, EmptyState, ErrorBox, Field, Input, PageHeader, Spinner } from '../components/ui'

type Draft = Pick<Supplier, 'name' | 'contact_name' | 'phone' | 'email' | 'address'> & { id?: number }

const blank: Draft = { name: '', contact_name: '', phone: '', email: '', address: '' }

function SupplierForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [draft, setDraft] = useState(initial)
  const save = useSaveSupplier()
  const set = (key: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate(draft, { onSuccess: onDone })
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="font-semibold">{draft.id ? `Edit ${initial.name}` : 'New supplier'}</h2>
        <ErrorBox error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={draft.name} onChange={set('name')} required autoFocus />
          </Field>
          <Field label="Contact person">
            <Input value={draft.contact_name} onChange={set('contact_name')} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={draft.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.email} onChange={set('email')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <Input value={draft.address} onChange={set('address')} />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save supplier'}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function SuppliersPage() {
  const { data, isLoading, error } = useSuppliers()
  const deactivate = useDeactivateSupplier()
  const [editing, setEditing] = useState<Draft | null>(null)

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Who the store buys stock from."
        actions={!editing && <Button onClick={() => setEditing(blank)}>Add supplier</Button>}
      />

      {editing && <SupplierForm key={editing.id ?? 'new'} initial={editing} onDone={() => setEditing(null)} />}

      <ErrorBox error={error ?? deactivate.error} />
      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState title="No suppliers yet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className={s.is_active ? '' : 'opacity-50'}>
                  <div className="font-semibold text-slate-900">
                    {s.name}
                    {!s.is_active && <span className="ml-2 text-xs font-medium text-slate-500">(inactive)</span>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                  {s.is_active && (
                    <Button
                      variant="ghost"
                      disabled={deactivate.isPending}
                      onClick={() => window.confirm(`Remove ${s.name}?`) && deactivate.mutate(s.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Suppliers with order history are kept as inactive instead of being deleted.
      </p>
    </>
  )
}
