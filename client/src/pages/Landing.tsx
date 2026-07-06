import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Sun, Moon, Briefcase, BarChart3, Wand2, ArrowRight } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import AIOrb from '../components/AIOrb'

// Count up custom hook for stats
function useCountUp(target: number, duration: number = 2000, trigger: boolean = false) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!trigger) return
    let start = 0
    const end = target
    const totalSteps = 60
    const increment = end / totalSteps
    const stepTime = duration / totalSteps

    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, stepTime)

    return () => clearInterval(timer)
  }, [target, duration, trigger])

  return count
}

export default function Landing() {
  const { theme, toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  // Trigger counts when stats are in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (statsRef.current) {
      observer.observe(statsRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const statJobs = useCountUp(568, 1500, statsVisible)
  const statSources = useCountUp(6, 1000, statsVisible)
  const statTime = useCountUp(8, 1000, statsVisible)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] transition-colors duration-300">
      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight gradient-text">JobSync AI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--color-text-secondary)]">
            <a href="#features" className="hover:text-[var(--color-text)] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[var(--color-text)] transition-colors">How It Works</a>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all duration-200"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/login?mode=register"
              className="btn-primary"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-24">
        {/* Decorative ambient background blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Hero Content */}
          <div className="text-center lg:text-left space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-[var(--color-text)]">
              Your AI <span className="gradient-text">Career Copilot</span>
            </h1>
            <p className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto lg:mx-0 font-medium leading-relaxed">
              Aggregate jobs from LinkedIn, Indeed, and more. Get AI-powered compatibility analysis, skill gap checks, and hyper-tailored freelance proposals in seconds.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <Link to="/login?mode=register" className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base justify-center shadow-xl">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#how-it-works" className="btn-ghost border border-[var(--color-border)] w-full sm:w-auto px-8 py-3.5 text-base justify-center">
                Watch It Work
              </a>
            </div>

            {/* Platform Badges */}
            <div className="pt-8 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
                Aggregating active postings from
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 items-center opacity-85">
                {['LinkedIn', 'Indeed', 'Adzuna', 'Remotive', 'RemoteOK'].map((platform) => (
                  <span
                    key={platform}
                    className="px-3 py-1 text-xs font-semibold rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Hero Visual: AI Orb & Floating Cards */}
          <div className="relative flex items-center justify-center select-none h-[350px] md:h-[450px]">
            {/* The main rotating, morphing AI Orb */}
            <AIOrb size={window.innerWidth < 768 ? 260 : 380} isDark={isDark} />

            {/* Orbiting Glass Cards with floating CSS animation */}
            <div className="absolute top-12 left-6 md:left-12 glass px-4 py-2.5 flex items-center gap-2.5 shadow-lg border border-[var(--color-border)] animate-[bounce_4s_infinite] max-w-[170px]">
              <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">Senior Software Engineer</p>
                <p className="text-[9px] text-[var(--color-text-muted)] truncate">Indeed • 10m ago</p>
              </div>
            </div>

            <div className="absolute bottom-16 right-6 md:right-12 glass px-4 py-2.5 flex items-center gap-2.5 shadow-lg border border-[var(--color-border)] animate-[bounce_5s_infinite_1s] max-w-[170px]">
              <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">Fit Score: 85%</p>
                <p className="text-[9px] text-[var(--color-text-muted)] truncate">Python, React, Node</p>
              </div>
            </div>

            <div className="absolute top-1/2 right-4 -translate-y-1/2 glass px-4 py-2.5 flex items-center gap-2.5 shadow-lg border border-[var(--color-border)] animate-[bounce_6s_infinite_2s] max-w-[170px] hidden sm:flex">
              <div className="w-6 h-6 rounded bg-violet-500/10 flex items-center justify-center">
                <Wand2 className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">AI Proposal</p>
                <p className="text-[9px] text-[var(--color-text-muted)]">Draft generated</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Counter Bar ────────────────────────────────────────────── */}
      <section ref={statsRef} className="border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl md:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
              {statsVisible ? statJobs : 0}+
            </p>
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mt-1">
              Jobs Indexed
            </p>
          </div>
          <div>
            <p className="text-2xl md:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
              {statsVisible ? statSources : 0}
            </p>
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mt-1">
              Active Sources
            </p>
          </div>
          <div>
            <p className="text-2xl md:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
              ~{statsVisible ? statTime : 0}s
            </p>
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mt-1">
              Avg Generation
            </p>
          </div>
        </div>
      </section>

      {/* ── Features & How It Works Section ──────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 relative">
        <div id="how-it-works" className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-text)]">
              How It Works
            </h2>
            <p className="text-[var(--color-text-secondary)] max-w-xl mx-auto font-medium">
              A fully automated workflow designed to connect your skills to active listings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {/* Step 1 */}
            <div className="theme-surface p-8 relative flex flex-col justify-between h-full hover:translate-y-[-4px] transition-transform duration-300">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">1. Aggregate Jobs</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  Our scheduler checks platforms like LinkedIn, Indeed, and Adzuna, keeping a high-quality indexed list of fresh opportunities.
                </p>
              </div>
              <div className="pt-6 text-xs font-bold text-blue-500 flex items-center gap-1.5 uppercase tracking-wider">
                Platform Sync
              </div>
            </div>

            {/* Step 2 */}
            <div className="theme-surface p-8 relative flex flex-col justify-between h-full hover:translate-y-[-4px] transition-transform duration-300">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">2. AI Fit Analysis</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  We parse your CV/portfolio text against the requirements to instantly deliver a compatibility score and outline specific skill gaps.
                </p>
              </div>
              <div className="pt-6 text-xs font-bold text-emerald-500 flex items-center gap-1.5 uppercase tracking-wider">
                Precision Matching
              </div>
            </div>

            {/* Step 3 */}
            <div className="theme-surface p-8 relative flex flex-col justify-between h-full hover:translate-y-[-4px] transition-transform duration-300">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 mb-6">
                  <Wand2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">3. Smart Proposals</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  Submit to our RabbitMQ-backed generator queue to craft a contextual, high-converting Upwork/Toptal style proposal.
                </p>
              </div>
              <div className="pt-6 text-xs font-bold text-violet-500 flex items-center gap-1.5 uppercase tracking-wider">
                Instant Drafting
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-[var(--color-border)] py-8 bg-[var(--color-bg-secondary)] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-500" strokeWidth={2.5} />
            <span className="font-bold text-sm text-[var(--color-text)] tracking-tight">JobSync AI</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            © {new Date().getFullYear()} JobSync AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
