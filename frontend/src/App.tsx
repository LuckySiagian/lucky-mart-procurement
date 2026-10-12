import { Link, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import { useI18n } from './i18n/useI18n'
import AccountPage from './pages/AccountPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import OrderDetailPage from './pages/OrderDetailPage'
import OrderFormPage from './pages/OrderFormPage'
import OrdersPage from './pages/OrdersPage'
import SuppliersPage from './pages/SuppliersPage'

function NotFound() {
  const { t } = useI18n()
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold">{t('notFound.title')}</p>
      <Link to="/" className="mt-2 inline-block text-emerald-700 hover:underline">
        {t('notFound.back')}
      </Link>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen justify-center">
        <Spinner />
      </div>
    )
  }
  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<OrderFormPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="orders/:id/edit" element={<OrderFormPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
