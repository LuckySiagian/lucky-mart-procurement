import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { staff } from '../test/fixtures'
import { json, renderApp } from '../test/render'

function mockApi(changePassword: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/auth/me/')) return json(staff)
    if (url.endsWith('/auth/change-password/')) return changePassword()
    return json({})
  })
}

async function fillPasswords(current: string, next: string, repeat: string) {
  await userEvent.type(await screen.findByLabelText('Current password'), current)
  await userEvent.type(screen.getByLabelText('New password'), next)
  await userEvent.type(screen.getByLabelText('Repeat new password'), repeat)
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('account page', () => {
  it('changes the password', async () => {
    localStorage.setItem('procurement.access', 'token')
    const fetchMock = mockApi(() => new Response(null, { status: 204 }))
    renderApp('/account')

    await fillPasswords('old-pass-1', 'Kopi-Toba-2026', 'Kopi-Toba-2026')

    expect(await screen.findByText('Your password has been changed.')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/change-password/'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      current_password: 'old-pass-1',
      new_password: 'Kopi-Toba-2026',
    })
  })

  it('checks that the new passwords match before calling the API', async () => {
    localStorage.setItem('procurement.access', 'token')
    const fetchMock = mockApi(() => new Response(null, { status: 204 }))
    renderApp('/account')

    await fillPasswords('old-pass-1', 'Kopi-Toba-2026', 'Kopi-Toba-2027')

    expect(await screen.findByRole('alert')).toHaveTextContent('The new passwords do not match.')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/change-password/'))).toBe(false)
  })

  it('shows the backend error with a translated field name', async () => {
    localStorage.setItem('procurement.access', 'token')
    mockApi(() => json({ current_password: ['Your current password is wrong.'] }, 400))
    renderApp('/account')

    await fillPasswords('nope', 'Kopi-Toba-2026', 'Kopi-Toba-2026')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Current password: Your current password is wrong.',
    )
  })
})
