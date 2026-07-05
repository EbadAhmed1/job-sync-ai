import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, Briefcase, X, Sparkles, ChevronRight,
} from 'lucide-react'
import { cvApi, type CVUploadResult } from '../api/axios'

// ── Accepted formats ─────────────────────────────────────────────────────────
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTS = ['.pdf', '.docx']
const MAX_SIZE_MB   = 5

// ── Helper ────────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export default function CVUpload() {
  const navigate = useNavigate()
  const inputRef  = useRef<HTMLInputElement>(null)

  const [dragOver,   setDragOver]   = useState(false)
  const [file,       setFile]       = useState<File | null>(null)
  const [state,      setState]      = useState<UploadState>('idle')
  const [progress,   setProgress]   = useState(0)
  const [result,     setResult]     = useState<CVUploadResult | null>(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [preference, setPreference] = useState<'both' | 'remote_only' | 'onsite_only'>('both')

  // ── File validation ───────────────────────────────────────────────────────
  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !ACCEPTED_EXTS.some((e) => f.name.toLowerCase().endsWith(e))) {
      return 'Only PDF and DOCX files are accepted.'
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large (${formatBytes(f.size)}). Maximum size is ${MAX_SIZE_MB} MB.`
    }
    return null
  }

  const selectFile = (f: File) => {
    const err = validateFile(f)
    if (err) { setErrorMsg(err); setState('error'); return }
    setFile(f)
    setState('idle')
    setErrorMsg('')
    setResult(null)
    setProgress(0)
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }, [])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return
    setState('uploading')
    setProgress(0)
    setErrorMsg('')

    try {
      // Save preference first
      await cvApi.updatePreference(preference)

      // Upload CV
      const res = await cvApi.upload(file, setProgress)
      setResult(res.data.data)
      setState('success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Upload failed. Please try again.'
      setErrorMsg(msg)
      setState('error')
    }
  }

  const reset = () => {
    setFile(null)
    setState('idle')
    setResult(null)
    setErrorMsg('')
    setProgress(0)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto animate-fade-in">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Upload Your <span className="gradient-text">CV / Résumé</span>
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          We'll extract your skills and find the best-matching full-time jobs for you.
        </p>
      </div>

      {/* ── Job Preference ──────────────────────────────────────────────── */}
      <div className="glass p-5 mb-6">
        <p className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-violet-400" />
          Job Location Preference
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'both',        label: '🌐 Both (Remote & On-site)' },
            { value: 'remote_only', label: '🏠 Remote Only' },
            { value: 'onsite_only', label: '🏢 On-site Only' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPreference(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
                preference === value
                  ? 'bg-violet-600/25 text-violet-300 border-violet-500/40'
                  : 'text-slate-400 border-white/10 hover:border-white/20 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Drop Zone ───────────────────────────────────────────────────── */}
      {state !== 'success' && (
        <div
          className={`glass border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
            dragOver
              ? 'border-violet-500/70 bg-violet-500/10'
              : file
              ? 'border-violet-500/40 bg-violet-500/5'
              : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !file && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
          />

          {file ? (
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-violet-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); reset() }}
                className="ml-2 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                Drag & drop your CV here
              </p>
              <p className="text-xs text-slate-500 mb-3">or click to browse</p>
              <p className="text-[11px] text-slate-600">PDF or DOCX · Max {MAX_SIZE_MB} MB</p>
            </>
          )}
        </div>
      )}

      {/* ── Upload progress ──────────────────────────────────────────────── */}
      {state === 'uploading' && (
        <div className="glass p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            <p className="text-sm text-slate-300 font-medium">
              {progress < 100 ? `Uploading… ${progress}%` : 'Extracting skills with AI…'}
            </p>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${progress < 100 ? progress : 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {state === 'error' && errorMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* ── Success result ────────────────────────────────────────────────── */}
      {state === 'success' && result && (
        <div className="glass p-6 mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">CV parsed successfully!</p>
              <p className="text-xs text-slate-500">
                {result.charCount.toLocaleString()} characters · {result.skillCount} skills extracted
              </p>
            </div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                AI Summary
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Extracted skills */}
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Detected Skills ({result.skillCount})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.extractedSkills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/15 text-[12px] font-medium text-violet-300"
                >
                  {skill}
                </span>
              ))}
              {result.skillCount === 0 && (
                <span className="text-sm text-slate-500">No skills detected. Your portfolio text has been saved — you can still search for jobs.</span>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/jobs')}
              className="btn-primary flex items-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              Find Matching Jobs
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={reset} className="btn-ghost">
              Upload Another CV
            </button>
          </div>
        </div>
      )}

      {/* ── Upload button ─────────────────────────────────────────────────── */}
      {file && state !== 'uploading' && state !== 'success' && (
        <button
          onClick={handleUpload}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          <Sparkles className="w-4 h-4" />
          Extract Skills & Save CV
        </button>
      )}
    </div>
  )
}
