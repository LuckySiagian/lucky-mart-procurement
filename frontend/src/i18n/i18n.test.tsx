import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { json, renderApp } from '../test/render'
import { en } from './en'
import { id } from './id'
import { interpolate } from './useI18n'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  it('has an Indonesian text for every English key, with the same placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(id[key], key).toBeTruthy()
      expect(placeholders(id[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(interpolate('Hello, {name}', { name: 'Lewi' })).toBe('Hello, Lewi')
    expect(interpolate('{count} left', { count: 3 })).toBe('3 left')
    expect(interpolate('Edit {number}')).toBe('Edit {number}')
  })
})

describe('language switcher', () => {
  it('switches the login page to Indonesian and remembers it', async () => {
    renderApp()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ID' }))

    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nama pengguna')).toBeInTheDocument()
    expect(localStorage.getItem('procurement.language')).toBe('id')
    expect(document.documentElement.lang).toBe('id')
  })

  it('starts in the saved language and asks the API for the same language', async () => {
    localStorage.setItem('procurement.language', 'id')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ detail: 'x' }, 401))
    renderApp()

    await userEvent.type(screen.getByLabelText('Nama pengguna'), 'staff')
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'salah')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Nama pengguna atau kata sandi salah.')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('Accept-Language')).toBe('id')
  })
})
