import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import AIOrb from '../components/AIOrb'

type Mode = 'login' | 'register'

export default function Login() {
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { theme, toggleTheme, isDark } = useTheme()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Listen to query parameters to toggle starting view (login vs register)
  useEffect(() => {
    const initialMode = searchParams.get('mode')
    if (initialMode === 'register' || initialMode === 'login') {
      setMode(initialMode)
    }
  }, [searchParams])

  // Already authenticated
  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-[var(--color-bg)]">
      {/* ── Left Side Panel (Visual Section - Desktop Only) ──────────────── */}
      <div className="hidden lg:flex lg:w-3/5 flex-col justify-between p-12 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] relative overflow-hidden select-none">
        {/* Soft decorative visual orb blob behind */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand/Branding */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text">JobSync AI</span>
        </div>

        {/* Central interactive AIOrb visual representation */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <AIOrb size={320} isDark={isDark} />
          <div className="text-center mt-8 space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-[var(--color-text)]">Analyze Job Listings Instantly</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Let AI matching evaluate your capabilities, uncover requirements gaps, and build tailored freelance proposals.
            </p>
          </div>
        </div>

        {/* Footer info inside split-screen */}
        <div className="text-xs text-[var(--color-text-muted)] relative z-10">
          Powered by GPT-4o-mini • 6 active job sources synced.
        </div>
      </div>

      {/* ── Right Side Panel (Form Section) ─────────────────────────────── */}
      <div className="w-full lg:w-2/5 flex flex-col justify-between p-8 relative">
        {/* Top bar with Theme Toggle */}
        <div className="flex justify-between items-center lg:justify-end">
          {/* Brand for mobile screen width */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm tracking-tight gradient-text">JobSync AI</span>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Main interactive Card / Form */}
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-2 text-center lg:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] font-medium">
                {mode === 'login' ? 'Sign in to access your dashboard' : 'Sign up to match jobs and generate proposals'}
              </p>
            </div>

            {/* Selector switch tabs */}
            <div className="flex rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-1">
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null) }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 capitalize ${
                    mode === m
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="input pl-10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error messages */}
              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit CTA button */}
              <button
                type="submit"
                id="auth-submit-btn"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer info for mobile screens */}
        <p className="text-center text-xs text-[var(--color-text-muted)] lg:hidden">
          Powered by GPT-4o-mini
        </p>
      </div>
    </div>
  )
}
