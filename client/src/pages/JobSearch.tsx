import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Briefcase, MapPin, DollarSign, ExternalLink,
  ChevronRight, AlertCircle, Loader2, X, Wand2,
  CheckCircle2, XCircle, Zap, RefreshCw, Building2,
  Wifi, WifiOff, Globe,
} from 'lucide-react'
import { jobApi, proposalApi, type Job, type FitReport } from '../api/axios'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (!min && !max) return null
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'AUD' ? 'A$' : ''
  const fmt  = (n: number) => n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const SOURCE_LABELS: Record<string, string> = {
  adzuna:   'Adzuna',
  remotive: 'Remotive',
  remoteok: 'RemoteOK',
}

const LOCATION_ICONS: Record<string, React.ReactNode> = {
  remote:  <Globe  className="w-3 h-3" />,
  onsite:  <WifiOff className="w-3 h-3" />,
  hybrid:  <Wifi   className="w-3 h-3" />,
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius      = 36
  const circumference = 2 * Math.PI * radius
  const offset      = circumference - (score / 100) * circumference
  const color       = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="text-center">
        <p className="text-xl font-bold text-slate-100">{score}</p>
        <p className="text-[10px] text-slate-500 font-medium">/ 100</p>
      </div>
    </div>
  )
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, isSelected, onClick }: {
  job: Job; isSelected: boolean; onClick: () => void
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency)
  const score  = job.matchPercent ?? 0

  return (
    <button
      onClick={onClick}
      className={`w-full text-left glass p-4 transition-all duration-150 group ${
        isSelected
          ? 'border-violet-500/50 bg-violet-500/10'
          : 'hover:bg-white/[0.05] hover:border-white/10'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2 group-hover:text-violet-300 transition-colors">
            {job.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            {job.company}
          </p>
        </div>
        {/* Match badge */}
        {score > 0 && (
          <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
            score >= 70
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : score >= 40
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              : 'bg-slate-500/15 text-slate-400 border border-white/5'
          }`}>
            {score}%
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          {LOCATION_ICONS[job.locationType]}
          {job.location}
        </span>
        {salary && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {salary}
          </span>
        )}
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {timeAgo(job.postedAt)}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-600 text-[10px]">
          {SOURCE_LABELS[job.source] ?? job.source}
        </span>
      </div>
    </button>
  )
}

// ── Fit Panel ─────────────────────────────────────────────────────────────────
function FitPanel({ job, onClose, onGenerateProposal }: {
  job: Job & { description?: string }
  onClose: () => void
  onGenerateProposal: (job: Job, fit: FitReport) => void
}) {
  const [fit,          setFit]          = useState<FitReport | null>(null)
  const [fitLoading,   setFitLoading]   = useState(false)
  const [fitError,     setFitError]     = useState('')
  const [fullJob,      setFullJob]      = useState<(Job & { description: string }) | null>(null)
  const [generating,   setGenerating]   = useState(false)
  const [genSuccess,   setGenSuccess]   = useState(false)

  // Fetch full job details + fit report
  useEffect(() => {
    let cancelled = false
    setFit(null)
    setFitError('')
    setFitLoading(true)
    setFullJob(null)

    Promise.all([
      jobApi.getById(job.id),
      jobApi.getFitReport(job.id),
    ]).then(([jobRes, fitRes]) => {
      if (cancelled) return
      setFullJob(jobRes.data.data.job)
      setFit(fitRes.data.data)
    }).catch((err: unknown) => {
      if (cancelled) return
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to load fit report.'
      setFitError(msg)
    }).finally(() => {
      if (!cancelled) setFitLoading(false)
    })

    return () => { cancelled = true }
  }, [job.id])

  const handleGenerate = async () => {
    if (!fit || !fullJob) return
    setGenerating(true)
    try {
      await proposalApi.generate({
        jobTitle:       fullJob.title,
        jobDescription: fullJob.description,
        jobSource:      fullJob.source,
        fitScore:       fit.score,
        matchingSkills: fit.matchingSkills,
        missingSkills:  fit.missingSkills,
        fitReasoning:   fit.reasoning,
      })
      setGenSuccess(true)
      onGenerateProposal(job, fit)
    } catch {
      setFitError('Failed to queue proposal. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency)

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-start justify-between p-5 border-b border-white/5 flex-shrink-0">
        <div className="min-w-0 pr-4">
          <h2 className="text-base font-bold text-slate-100 leading-snug">{job.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{job.company} · {job.location}</p>
          {salary && <p className="text-sm text-emerald-400 mt-1 font-medium">{salary}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {fitLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
            <p className="text-sm text-slate-500">Analysing your fit with AI…</p>
          </div>
        )}

        {fitError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {fitError}
          </div>
        )}

        {fit && !fitLoading && (
          <>
            {/* Score */}
            <div className="glass p-4 flex items-center gap-5">
              <ScoreRing score={fit.score} />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Fit Score</p>
                <p className="text-sm text-slate-300 leading-relaxed">{fit.reasoning}</p>
              </div>
            </div>

            {/* Matching skills */}
            {fit.matchingSkills.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  You Have ({fit.matchingSkills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {fit.matchingSkills.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] font-medium text-emerald-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing skills */}
            {fit.missingSkills.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Gap Detected ({fit.missingSkills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {fit.missingSkills.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] font-medium text-red-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Job description snippet */}
            {fullJob?.description && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Job Description</p>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-6">
                  {fullJob.description.replace(/<[^>]*>/g, '').substring(0, 600)}…
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-5 border-t border-white/5 flex-shrink-0 space-y-2">
        {genSuccess ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            Proposal queued! Go to the Generator to view it.
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!fit || fitLoading || generating}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Generate Proposal</>
            )}
          </button>
        )}
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost w-full flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          View Original Posting
        </a>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type Filter = 'both' | 'remote_only' | 'onsite_only'

export default function JobSearch() {
  const navigate = useNavigate()
  const [jobs,         setJobs]         = useState<Job[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [emptyMsg,     setEmptyMsg]     = useState('')
  const [filter,       setFilter]       = useState<Filter>('both')
  const [selectedJob,  setSelectedJob]  = useState<Job | null>(null)
  const [searchQuery,  setSearchQuery]  = useState('')

  const fetchJobs = useCallback(async (pref: Filter) => {
    setLoading(true)
    setError('')
    setEmptyMsg('')
    try {
      const res = await jobApi.search(pref !== 'both' ? pref : undefined)
      const { jobs: fetched, message } = res.data.data
      setJobs(fetched)
      if (message) setEmptyMsg(message)
    } catch {
      setError('Failed to load jobs. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs(filter) }, [filter, fetchJobs])

  const filteredJobs = jobs.filter((j) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q)
  })

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: Job list ──────────────────────────────────────────── */}
      <div className={`flex flex-col ${selectedJob ? 'hidden lg:flex lg:w-[420px]' : 'w-full'} border-r border-white/5 flex-shrink-0`}>

        {/* Toolbar */}
        <div className="p-4 border-b border-white/5 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-violet-400" />
              Find Jobs
            </h1>
            <button
              onClick={() => fetchJobs(filter)}
              disabled={loading}
              className="btn-ghost p-2"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by title or company…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          {/* Location filter */}
          <div className="flex gap-1.5">
            {([
              { value: 'both',        label: 'All',      icon: <Globe   className="w-3 h-3" /> },
              { value: 'remote_only', label: 'Remote',   icon: <Wifi    className="w-3 h-3" /> },
              { value: 'onsite_only', label: 'On-site',  icon: <WifiOff className="w-3 h-3" /> },
            ] as const).map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  filter === value
                    ? 'bg-violet-600/25 text-violet-300 border-violet-500/40'
                    : 'text-slate-500 border-white/5 hover:border-white/10 hover:text-slate-300'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
              <p className="text-sm text-slate-500">Finding your matches…</p>
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="flex items-start gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            </div>
          ) : emptyMsg ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Zap className="w-7 h-7 text-violet-400" />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{emptyMsg}</p>
              <button onClick={() => navigate('/cv-upload')} className="btn-primary flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Your CV
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-6">
              <Search className="w-8 h-8 text-slate-600" />
              <p className="text-sm text-slate-500">No jobs match your filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && filteredJobs.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 flex-shrink-0">
            <p className="text-[11px] text-slate-600">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} matched your profile
            </p>
          </div>
        )}
      </div>

      {/* ── Right panel: Fit report ───────────────────────────────────────── */}
      {selectedJob && (
        <div className="flex-1 min-w-0 bg-zinc-950/40">
          <FitPanel
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onGenerateProposal={(_job, _fit) => {
              // Could navigate to generator — for now the success state handles it
            }}
          />
        </div>
      )}

      {/* Desktop empty-right-panel placeholder */}
      {!selectedJob && (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <ChevronRight className="w-8 h-8 text-violet-400" />
          </div>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            Select a job from the list to view your Fit-Gap report and generate a tailored proposal.
          </p>
        </div>
      )}
    </div>
  )
}

// Fix missing import for Upload in empty state
function Upload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}
