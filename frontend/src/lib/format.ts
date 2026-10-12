import type { OrderStatus } from '../api/types'

// Rupiah is written the same way in both languages: "Rp 862.500".
const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatRupiah(value: string | number) {
  return rupiah.format(Number(value))
}

export function formatDateTime(value: string | null | undefined, locale = 'en-GB') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDate(value: string | null | undefined, locale = 'en-GB') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-300',
  SUBMITTED: 'bg-amber-50 text-amber-800 ring-amber-300',
  APPROVED: 'bg-sky-50 text-sky-800 ring-sky-300',
  REJECTED: 'bg-rose-50 text-rose-800 ring-rose-300',
  RECEIVED: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  CANCELLED: 'bg-slate-50 text-slate-500 ring-slate-200',
}
