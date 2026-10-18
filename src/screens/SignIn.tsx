import { useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'

function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match. Check them, or reset your password below."
    case 'auth/invalid-email':
      return 'That email address looks incomplete.'
    case 'auth/email-already-in-use':
      return 'There is already an account with this email. Sign in instead.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/missing-password':
      return 'Enter your password.'
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'No connection. Signing in needs the internet the first time.'
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'New accounts are switched off for this app.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function SignIn() {
  const [mode, setMode] = useState<'signIn' | 'create'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async () => {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signIn') await signInWithEmailAndPassword(auth, email.trim(), password)
      else await createUserWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setError('')
    setInfo('')
    if (!email.trim()) return setError('Enter your email above first, then tap “Forgot password” again.')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo(`If there is an account for ${email.trim()}, a reset link is on its way. Check your email.`)
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <main className="screen" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 24 }}>
        <img src="apple-touch-icon.png" alt="" width={88} height={88} style={{ borderRadius: 22 }} />
        <h1 className="screen-title">Calorie Diary</h1>
        <p className="small" style={{ textAlign: 'center', fontSize: '0.882rem', maxWidth: 320 }}>
          {mode === 'signIn'
            ? 'Sign in to see your diary. It stays in sync and safe even if you change phones.'
            : 'Create your account. Your diary is private to you and kept safe online.'}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          className="input mt6"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password" className="field-label mt16">
          Password
        </label>
        <input
          id="password"
          className="input mt6"
          type="password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === 'create' && <p className="small mt6">At least 6 characters.</p>}

        {error && (
          <p className="info-strip mt16" role="alert" style={{ background: 'var(--amber-soft)' }}>
            {error}
          </p>
        )}
        {info && (
          <p className="info-strip mt16" role="status">
            {info}
          </p>
        )}

        <button type="submit" className="primary-btn mt18" disabled={busy || !email.trim() || !password}>
          {busy ? 'One moment…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: -8 }}>
        {mode === 'signIn' && (
          <button type="button" className="text-btn" onClick={reset}>
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setMode(mode === 'signIn' ? 'create' : 'signIn')
            setError('')
            setInfo('')
          }}
        >
          {mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  )
}
