import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../auth/AuthContext'
import { staff } from '../test/fixtures'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('login', () => {
  it('shows an error for wrong credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ detail: 'No active account' }, 401))
    renderApp()

    await userEvent.type(screen.getByLabelText('Username'), 'staff')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
  })

  it('signs in, stores the tokens and shows the dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/login/')) return json({ access: 'a', refresh: 'r' })
      if (url.endsWith('/auth/me/')) return json(staff)
      if (url.endsWith('/dashboard/'))
        return json({
          orders_by_status: { DRAFT: 0, SUBMITTED: 2, APPROVED: 1, REJECTED: 0, RECEIVED: 0, CANCELLED: 0 },
          waiting_for_approval: 2,
          received_this_month: '0.00',
          failed_stock_syncs: 0,
        })
      return json({ detail: 'Lucky Mart integration is not configured.' }, 503)
    })
    renderApp()

    await userEvent.type(screen.getByLabelText('Username'), 'staff')
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Hello, Warehouse Staff' })).toBeInTheDocument()
    expect(localStorage.getItem('procurement.access')).toBe('a')
    expect(await screen.findByText('Waiting for approval')).toBeInTheDocument()
    expect(await screen.findByText('Lucky Mart is not connected')).toBeInTheDocument()
  })
})
