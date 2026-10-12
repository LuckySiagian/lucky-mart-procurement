import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import type { MessageKey } from '../i18n/en'
import { useI18n } from '../i18n/useI18n'
import { LanguageSwitcher } from './ui'

const NAV: { to: string; label: MessageKey; end: boolean }[] = [
  { to: '/', label: 'nav.dashboard', end: true },
  { to: '/orders', label: 'nav.orders', end: false },
  { to: '/suppliers', label: 'nav.suppliers', end: false },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span>
              Lucky Mart <span className="font-medium text-emerald-700">{t('app.procurement')}</span>
            </span>
          </NavLink>

          <nav className="hidden gap-1 md:flex" aria-label={t('nav.main')}>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            <Link to="/account" className="rounded-lg px-2 py-1 text-right text-sm leading-tight hover:bg-slate-100">
              <div className="font-semibold text-slate-800">{user?.full_name}</div>
              <div className="text-xs text-slate-500">{user && t(`role.${user.role}`)}</div>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {t('nav.logout')}
            </button>
          </div>

          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{t('nav.menu')}</span>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" className="border-t border-slate-200 px-4 py-3 md:hidden" aria-label={t('nav.main')}>
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navClass}
                  onClick={() => setOpen(false)}
                >
                  {t(item.label)}
                </NavLink>
              ))}
              <NavLink to="/account" className={navClass} onClick={() => setOpen(false)}>
                {t('nav.account')}
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t('nav.logout')} ({user?.username})
              </button>
              <LanguageSwitcher className="mt-2 self-start" />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
