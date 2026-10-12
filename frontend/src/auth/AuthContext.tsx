import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setSessionExpiredHandler, tokens } from '../api/client'
import type { User } from '../api/types'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(tokens.access))

  const logout = useCallback(() => {
    tokens.clear()
    setUser(null)
    qc.clear()
  }, [qc])

  useEffect(() => {
    setSessionExpiredHandler(logout)
    if (!tokens.access) return
    api<User>('/auth/me/')
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  // A 401 from login means wrong credentials; the login page shows the translated message.
  const login = useCallback(async (username: string, password: string) => {
    const data = await api<{ access: string; refresh: string }>(
      '/auth/login/',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      false,
    )
    tokens.save(data.access, data.refresh)
    setUser(await api<User>('/auth/me/'))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  )
}
