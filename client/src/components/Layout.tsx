import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Wand2, LogOut, Zap, Menu, X, Briefcase, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/jobs',      label: 'Jobs',       icon: Briefcase },
  { to: '/generator', label: 'Generator',  icon: Wand2 },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme, isDark } = useTheme()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Automatically close sidebar drawer when navigating to a new page on mobile
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      {/* ── Mobile Header ────────────────────────────────────────────────── */}
      <header className="lg:hidden flex items-center justify-between px-6 h-16 border-b border-[var(--color-border)] bg-[var(--color-sidebar-bg)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-base tracking-tight gradient-text">JobSync AI</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -mr-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors focus:outline-none"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ── Mobile Sidebar Backdrop Overlay ─────────────────────────────── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ── Sidebar (Collapsible Drawer on Mobile, Fixed Sidebar on Desktop) ─ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo & Close Button */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-base tracking-tight gradient-text">JobSync AI</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-2 -mr-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors focus:outline-none"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-violet-500/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-300 border border-violet-500/20'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Area, Theme Switcher & Sign Out */}
        <div className="px-3 pb-4 border-t border-[var(--color-border)] pt-4 bg-[var(--color-sidebar-bg)] flex-shrink-0 space-y-2">
          {/* Theme switcher option */}
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all duration-150"
          >
            <div className="flex items-center gap-3">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              {theme}
            </span>
          </button>

          <div className="glass px-3 py-3">
            <p className="text-xs font-semibold text-[var(--color-text)] truncate">{user?.email}</p>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">Freelancer Account</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-500/10 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-150 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0 bg-[var(--color-bg-secondary)]">
        {children}
      </main>
    </div>
  )
}
