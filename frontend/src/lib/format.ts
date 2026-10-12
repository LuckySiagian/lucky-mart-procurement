import type { OrderStatus, SyncStatus } from '../api/types'

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatRupiah(value: string | number) {
  return rupiah.format(Number(value))
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateOnly = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : '—'
}

export function formatDate(value: string | null | undefined) {
  return value ? dateOnly.format(new Date(value)) : '—'
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-300',
  SUBMITTED: 'bg-amber-50 text-amber-800 ring-amber-300',
  APPROVED: 'bg-sky-50 text-sky-800 ring-sky-300',
  REJECTED: 'bg-rose-50 text-rose-800 ring-rose-300',
  RECEIVED: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  CANCELLED: 'bg-slate-50 text-slate-500 ring-slate-200',
}

export const SYNC_LABEL: Record<SyncStatus, string> = {
  NOT_SYNCED: 'Not synced',
  SYNCED: 'Added to Lucky Mart',
  FAILED: 'Sync failed',
  SKIPPED: 'Not linked',
}

export const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Created the order',
  SUBMITTED: 'Submitted for approval',
  APPROVED: 'Approved the order',
  REJECTED: 'Rejected the order',
  CANCELLED: 'Cancelled the order',
  RECEIVED: 'Received the goods',
  STOCK_SYNC: 'Sent stock to Lucky Mart',
}
