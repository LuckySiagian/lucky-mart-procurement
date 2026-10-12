import { Link, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import OrderDetailPage from './pages/OrderDetailPage'
import OrderFormPage from './pages/OrderFormPage'
import OrdersPage from './pages/OrdersPage'
import SuppliersPage from './pages/SuppliersPage'

function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold">Page not found.</p>
      <Link to="/" className="mt-2 inline-block text-emerald-700 hover:underline">
        Back to the dashboard
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
