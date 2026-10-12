import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { ApiError, describeError } from '../api/client'
import type { OrderStatus } from '../api/types'
import type { MessageKey } from '../i18n/en'
import { LANGUAGES, useI18n } from '../i18n/useI18n'
import { STATUS_STYLE } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-700/50',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 disabled:bg-rose-700/50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  // The hint sits outside <label> so it doesn't become part of the field's accessible name.
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:outline-none'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${STATUS_STYLE[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n()
  if (!error) return null
  // API errors are re-described at render time so field names follow the current language.
  const fieldLabel = (field: string) => {
    const key = `field.${field}` as MessageKey
    const label = t(key)
    return label === key ? field : label
  }
  const message =
    error instanceof ApiError
      ? describeError(error.data, fieldLabel) || error.message
      : error instanceof Error
        ? error.message
        : String(error)
  return (
    <div role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
      {message}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
      {label ?? t('common.loading')}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={`inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold ${className}`}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          lang={lang.code}
          title={lang.label}
          aria-pressed={language === lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            language === lang.code ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {lang.short}
        </button>
      ))}
    </div>
  )
}
