import { useState } from 'react'
import type { FormEvent } from 'react'
import { useChangePassword } from '../api/hooks'
import { useAuth } from '../auth/useAuth'
import { Button, Card, ErrorBox, Field, Input, LanguageSwitcher, PageHeader } from '../components/ui'
import { useI18n } from '../i18n/useI18n'

function ChangePasswordForm() {
  const { t } = useI18n()
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [done, setDone] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    if (next !== repeat) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    change.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setRepeat('')
          setDone(true)
        },
      },
    )
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="font-semibold">{t('account.changePassword')}</h2>
        {done && (
          <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {t('account.passwordChanged')}
          </div>
        )}
        <ErrorBox error={mismatch ? new Error(t('account.mismatch')) : change.error} />
        <Field label={t('account.currentPassword')}>
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field label={t('account.newPassword')} hint={t('account.newPasswordHint')}>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </Field>
        <Field label={t('account.confirmPassword')}>
          <Input
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? t('common.saving') : t('account.savePassword')}
        </Button>
      </form>
    </Card>
  )
}

export default function AccountPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  if (!user) return null

  return (
    <>
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <ChangePasswordForm />

        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="mb-4 font-semibold">{t('account.profile')}</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-slate-500">{t('account.name')}</dt>
                <dd className="font-medium">{user.full_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('account.username')}</dt>
                <dd className="font-medium">{user.username}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('account.role')}</dt>
                <dd className="font-medium">{t(`role.${user.role}`)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5 text-sm">
            <h2 className="mb-2 font-semibold">{t('common.language')}</h2>
            <p className="mb-3 text-slate-600">{t('account.languageHelp')}</p>
            <LanguageSwitcher />
          </Card>
        </div>
      </div>
    </>
  )
}
