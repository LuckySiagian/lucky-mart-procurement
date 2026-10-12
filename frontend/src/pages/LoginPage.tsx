import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Button, ErrorBox, Field, Input, LanguageSwitcher } from '../components/ui'
import { useI18n } from '../i18n/useI18n'

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
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
      setError(err instanceof ApiError && err.status === 401 ? new Error(t('login.wrong')) : err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('login.subtitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <ErrorBox error={error} />
          <Field label={t('login.username')}>
            <Input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label={t('login.password')}>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
