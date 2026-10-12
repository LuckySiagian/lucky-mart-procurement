import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { Button, ErrorBox, Field, Input } from '../components/ui'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Lucky Mart Procurement</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to manage purchase orders.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <ErrorBox error={error} />
          <Field label="Username">
            <Input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
