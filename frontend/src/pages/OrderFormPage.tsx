import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLowStock, useOrder, useSaveOrder, useSuppliers } from '../api/hooks'
import type { LowStockItem, OrderItemInput, PurchaseOrder } from '../api/types'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, inputClass } from '../components/ui'
import { formatRupiah } from '../lib/format'
import { itemFromLowStock } from '../lib/orderItems'

const emptyItem = (): OrderItemInput => ({
  product_name: '',
  sku: '',
  unit_name: '',
  lucky_mart_product_unit_id: null,
  quantity: 1,
  unit_price: '',
})

function itemsFromOrder(order: PurchaseOrder): OrderItemInput[] {
  return order.items.map((item) => ({
    product_name: item.product_name,
    sku: item.sku,
    unit_name: item.unit_name,
    lucky_mart_product_unit_id: item.lucky_mart_product_unit_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
  }))
}

function LowStockPicker({ onPick, picked }: { onPick: (row: LowStockItem) => void; picked: Set<string> }) {
  const { data, isLoading, error } = useLowStock()
  if (isLoading) return <Spinner label="Loading low-stock products…" />
  if (error) return <p className="text-sm text-slate-500">Low-stock list unavailable: {error.message}</p>
  if (!data?.length) return <p className="text-sm text-slate-500">No products are low on stock.</p>
  return (
    <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
      {data.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{row.product_name}</span>{' '}
            <span className="text-slate-500">
              ({row.current_stock} left, min {row.min_stock_alert})
            </span>
          </span>
          <Button variant="secondary" disabled={picked.has(row.product_unit_id)} onClick={() => onPick(row)}>
            {picked.has(row.product_unit_id) ? 'Added' : 'Add'}
          </Button>
        </li>
      ))}
    </ul>
  )
}

interface FormValues {
  supplier: string
  notes: string
  expectedDate: string
  items: OrderItemInput[]
}

/** Loads whatever the form starts from, then renders it once with that initial state. */
export default function OrderFormPage() {
  const { id } = useParams()
  const orderId = id ? Number(id) : undefined
  const [params] = useSearchParams()
  const fromLowStock = !orderId && params.get('from') === 'low-stock'

  const existing = useOrder(orderId)
  const lowStock = useLowStock()

  if (orderId) {
    if (existing.isLoading) return <Spinner />
    if (existing.error || !existing.data) return <ErrorBox error={existing.error ?? new Error('Order not found.')} />
    if (existing.data.status !== 'DRAFT') {
      return <ErrorBox error={new Error('Only draft orders can be edited.')} />
    }
    const order = existing.data
    return (
      <OrderForm
        order={order}
        initial={{
          supplier: String(order.supplier),
          notes: order.notes,
          expectedDate: order.expected_date ?? '',
          items: itemsFromOrder(order),
        }}
      />
    )
  }

  // "Reorder" from the dashboard starts with every low-stock product.
  if (fromLowStock && lowStock.isLoading) return <Spinner label="Loading low-stock products…" />
  const startItems = fromLowStock && lowStock.data?.length ? lowStock.data.map(itemFromLowStock) : [emptyItem()]
  return (
    <OrderForm
      initial={{ supplier: '', notes: '', expectedDate: '', items: startItems }}
      showLowStock={fromLowStock}
    />
  )
}

function OrderForm({
  order,
  initial,
  showLowStock = false,
}: {
  order?: PurchaseOrder
  initial: FormValues
  showLowStock?: boolean
}) {
  const navigate = useNavigate()
  const suppliers = useSuppliers(true)
  const save = useSaveOrder(order?.id)

  const [supplier, setSupplier] = useState(initial.supplier)
  const [notes, setNotes] = useState(initial.notes)
  const [expectedDate, setExpectedDate] = useState(initial.expectedDate)
  const [items, setItems] = useState<OrderItemInput[]>(initial.items)
  const [showPicker, setShowPicker] = useState(showLowStock)

  const linked = new Set(items.map((i) => i.lucky_mart_product_unit_id).filter((v): v is string => !!v))
  const total = items.reduce((sum, i) => sum + i.quantity * (Number(i.unit_price) || 0), 0)

  function updateItem(index: number, patch: Partial<OrderItemInput>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addFromLowStock(row: LowStockItem) {
    setItems((current) => [...current.filter((i) => i.product_name.trim()), itemFromLowStock(row)])
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate(
      {
        supplier: Number(supplier),
        notes,
        expected_date: expectedDate || null,
        items: items.filter((i) => i.product_name.trim()),
      },
      { onSuccess: (saved) => navigate(`/orders/${saved.id}`) },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title={order ? `Edit ${order.number}` : 'New purchase order'}
        subtitle="Saved as a draft. Submit it for the owner's approval when it's ready."
        actions={
          <>
            <Link to={order ? `/orders/${order.id}` : '/orders'}>
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <ErrorBox error={save.error} />

        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Supplier">
            <select
              className={inputClass}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              required
            >
              <option value="">Choose a supplier…</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected delivery" hint="Optional">
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </Field>
          <Field label="Notes" hint="Optional">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. weekly restock" />
          </Field>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Items</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowPicker((v) => !v)} aria-expanded={showPicker}>
                {showPicker ? 'Hide low stock' : 'Add from low stock'}
              </Button>
              <Button variant="secondary" onClick={() => setItems((c) => [...c, emptyItem()])}>
                Add item
              </Button>
            </div>
          </div>

          {showPicker && (
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <LowStockPicker onPick={addFromLowStock} picked={linked} />
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <div key={index} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_7rem_10rem_8rem_auto] sm:items-end">
                <Field label="Product">
                  <Input
                    value={item.product_name}
                    onChange={(e) => updateItem(index, { product_name: e.target.value })}
                    placeholder="e.g. Beras Premium 5kg"
                    required
                  />
                </Field>
                <Field label="Quantity">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                    required
                  />
                </Field>
                <Field label="Buying price (Rp)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, { unit_price: e.target.value })}
                    required
                  />
                </Field>
                <div className="pb-2 text-right text-sm tabular-nums text-slate-700">
                  {formatRupiah(item.quantity * (Number(item.unit_price) || 0))}
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${item.product_name || 'item'}`}
                  disabled={items.length === 1}
                  onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
                {item.lucky_mart_product_unit_id && (
                  <p className="text-xs text-emerald-700 sm:col-span-5">
                    Linked to Lucky Mart{item.sku && ` (${item.sku})`}: stock is added automatically when received.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-slate-100 px-5 py-4 text-sm">
            <span className="text-slate-600">Total</span>
            <span className="ml-4 font-bold tabular-nums">{formatRupiah(total)}</span>
          </div>
        </Card>
      </div>
    </form>
  )
}
