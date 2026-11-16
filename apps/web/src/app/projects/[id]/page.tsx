'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, GitBranch, FileArchive, UploadCloud, FolderGit2, ExternalLink, Clock, CalendarDays, Download, RefreshCw } from 'lucide-react';
import AnalysisSummary from '@/components/AnalysisSummary';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Job = {
  id: string;
  status: string;
  stage: string | null;
  progress: number;
  error_message: string | null;
  source: string;
  source_type: string;
  completed_at?: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  DOWNLOADING: 'Downloading repository',
  EXTRACTING: 'Extracting ZIP archive',
  QUEUED: 'Preparing analysis',
  SCANNING: 'Scanning files',
  PARSING: 'Parsing source code',
  GRAPH_BUILDING: 'Building dependency graph',
  DETECTING_PATTERNS: 'Detecting patterns & dead code',
  COMPLETED: 'Done',
};

const isActive = (job: Job | null) => !!job && ['PENDING', 'QUEUED', 'RUNNING'].includes(job.status);

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState<'github' | 'zip'>('github');
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [tracking, setTracking] = useState(false);
  const ignoreJobId = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLatestJob = useCallback(async (): Promise<Job | null> => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/api/analysis/projects/${params.id}/latest-job`, {
        headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, [params.id]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  // Poll the latest job once a second until it finishes. Jobs older than the
  // current import (ignoreJobId) are skipped so a previous result never flashes up.
  const startPolling = useCallback(() => {
    stopPolling();
    const tick = async () => {
      const latest = await fetchLatestJob();
      if (!latest || latest.id === ignoreJobId.current) return;
      setJob((prev) => (prev && prev.id === latest.id && prev.progress > latest.progress && isActive(latest)) ? prev : latest);
      if (!isActive(latest)) {
        stopPolling();
        setTracking(false);
        setLoading(false);
      }
    };
    tick();
    pollTimer.current = setInterval(tick, 1000);
  }, [fetchLatestJob, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // On page load, resume showing progress if an analysis is already running,
  // or show the "ready to view" card for the last completed one.
  useEffect(() => {
    (async () => {
      const latest = await fetchLatestJob();
      if (!latest) return;
      setJob(latest);
      if (latest.source_type === 'github') setGithubUrl((u) => u || latest.source);
      if (isActive(latest)) {
        setTracking(true);
        setLoading(true);
        startPolling();
      }
    })();
  }, [fetchLatestJob, startPolling]);

  const beginTracking = () => {
    ignoreJobId.current = job?.id ?? null;
    setJob(null);
    setTracking(true);
    startPolling();
  };

  const finishRequest = async (ok: boolean, message?: string) => {
    if (!ok) {
      stopPolling();
      setTracking(false);
      setLoading(false);
      setError(message || 'Analysis failed');
      return;
    }
    // Inline mode: the request returns once analysis is done; queue mode: keep polling.
    const latest = await fetchLatestJob();
    if (latest && latest.id !== ignoreJobId.current) {
      setJob(latest);
      if (!isActive(latest)) {
        stopPolling();
        setTracking(false);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const fetchProject = async () => {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');
      
      const res = await fetch(`${API}/api/projects/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProject(await res.json());
      else router.push('/projects');
    };
    fetchProject();
  }, [params.id, router]);

  const handleGithubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    beginTracking();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/api/projects/${params.id}/repositories/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url: githubUrl })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Import failed');
      await finishRequest(true);
    } catch (err: any) {
      await finishRequest(false, err.message);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Only ZIP files are supported');
      return;
    }

    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');

    const formData = new FormData();
    formData.append('file', file);

    beginTracking();
    try {
      const res = await fetch(`${API}/api/projects/${params.id}/repositories/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (res.status === 413 ? 'ZIP is too large (max 4.5 MB). Import from GitHub instead.' : 'Upload failed'));

      setUploadedFile(file.name);
      await finishRequest(true);
    } catch (err: any) {
      await finishRequest(false, err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  // GitHub projects download GitHub's own archive (every file, no size limit);
  // ZIP-upload projects download the analysed files stored by the API.
  const downloadZip = async () => {
    if (!job) return;
    if (job.source_type === 'github') {
      const repo = job.source.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
      window.location.href = `https://github.com/${repo}/archive/HEAD.zip`;
      return;
    }
    setDownloading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/projects/${params.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Download failed');
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'project.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (!project) {
    return (
      <div className="page">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="card overflow-hidden mt-6">
          <div className="skeleton h-24 rounded-none" />
          <div className="p-8 space-y-3"><div className="skeleton h-7 w-56 rounded" /><div className="skeleton h-4 w-40 rounded" /></div>
        </div>
      </div>
    );
  }

  const analyzing = tracking && (!job || isActive(job));
  const completed = job?.status === 'COMPLETED' && !analyzing;
  const failed = job?.status === 'FAILED' && !analyzing;
  const repoLabel = job?.source ? job.source.replace(/^https?:\/\/(www\.)?github\.com\//, '') : null;
  const fmtDate = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v}Z`);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const status = analyzing
    ? { label: `Analyzing · ${job?.progress ?? 0}%`, cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500 animate-ping' }
    : completed
    ? { label: 'Analyzed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' }
    : failed
    ? { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' }
    : { label: 'Not analyzed', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };

  return (
    <div className="page max-w-5xl space-y-6 stagger">
      <nav className="breadcrumb !mb-0" aria-label="Breadcrumb">
        <Link href="/projects" className="inline-flex items-center gap-1"><ArrowLeft size={14} /> Projects</Link>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="text-slate-900 font-medium truncate">{project.name}</span>
      </nav>

      <header className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#141d4a] via-[#2a2f7a] to-[#3d3a8c] animate-gradient relative">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 88% 30%, rgba(243,223,162,0.35), transparent 45%)' }} />
          <div
            className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)', backgroundSize: '22px 22px' }}
          />
        </div>
        <div className="px-6 sm:px-8 pb-6">
          {/* Only the icon overlaps the banner; the text sits fully below it */}
          <span className="relative z-10 -mt-10 w-20 h-20 rounded-2xl bg-white ring-4 ring-white shadow-md border border-slate-200 text-indigo-600 flex items-center justify-center">
            <FolderGit2 size={34} strokeWidth={1.75} />
          </span>

          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 break-words">{project.name}</h1>
                <span className={`badge ring-1 ring-inset ${status.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{project.description || 'No description'}</p>
            </div>
            {completed && (
              <div className="flex flex-wrap gap-2.5 shrink-0 self-start md:self-auto">
                <button onClick={downloadZip} disabled={downloading} className="btn btn-secondary" title="Download all files of this project as a ZIP">
                  <Download size={16} /> {downloading ? 'Preparing…' : 'Download ZIP'}
                </button>
                <Link href={`/projects/${params.id}/architecture`} className="btn btn-primary group">
                  View architecture map <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </div>
            )}
          </div>

          <dl className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Repository</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-slate-900 min-w-0">
                <GitBranch size={14} className="text-slate-400 shrink-0" />
                {repoLabel ? (
                  job?.source_type === 'github' ? (
                    <a href={job!.source} target="_blank" rel="noopener noreferrer" className="truncate hover:text-indigo-600 inline-flex items-center gap-1" title={job!.source}>
                      {repoLabel} <ExternalLink size={12} className="shrink-0 text-slate-400" />
                    </a>
                  ) : (
                    <span className="truncate" title={repoLabel}>{repoLabel}</span>
                  )
                ) : (
                  <span className="text-slate-400">Not imported yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Last analyzed</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-slate-900">
                <Clock size={14} className="text-slate-400" />
                {fmtDate(job?.completed_at) || <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Created</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-slate-900">
                <CalendarDays size={14} className="text-slate-400" />
                {fmtDate(project.created_at) || <span className="text-slate-400">—</span>}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {(analyzing || failed) && (
        <section className="card card-body">
          {analyzing ? (
            <div>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="card-title">Analyzing repository</h2>
                  <p className="card-subtitle">{STAGE_LABELS[job?.stage || ''] || 'Starting'}…</p>
                </div>
                <span className="text-3xl font-semibold tabular-nums text-slate-900">{job?.progress ?? 0}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={job?.progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full bar-accent rounded-full transition-[width] duration-700 ease-out progress-sheen"
                  style={{ width: `${Math.max(2, job?.progress ?? 0)}%` }}
                />
              </div>
              {job?.source && <p className="mt-3 text-xs text-slate-500 truncate" title={job.source}>{job.source}</p>}
            </div>
          ) : job?.status === 'FAILED' ? (
            <div className="flex items-center gap-4">
              <span className="w-11 h-11 shrink-0 rounded-full bg-red-50 text-red-600 ring-1 ring-red-200 flex items-center justify-center">
                <AlertCircle size={22} />
              </span>
              <div>
                <h2 className="card-title">Analysis failed</h2>
                <p className="text-sm text-red-600">{job.error_message || 'Something went wrong. Try importing again.'}</p>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {job?.status === 'COMPLETED' && !tracking && (
        <AnalysisSummary projectId={params.id} refreshKey={job.id} />
      )}

      <section className="card overflow-hidden">
        <div className="px-6 sm:px-8 pt-6 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {job?.status === 'COMPLETED' ? <RefreshCw size={18} /> : <UploadCloud size={18} />}
            </span>
            <div>
              <h2 className="card-title">{job?.status === 'COMPLETED' ? 'Re-analyze repository' : 'Import a repository'}</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {job?.status === 'COMPLETED'
                  ? 'Pushed new code? Run the analysis again to refresh the map and summary.'
                  : 'Bring in your code from GitHub or a ZIP archive to start the analysis.'}
              </p>
            </div>
          </div>
          <div className="inline-flex p-1 rounded-lg bg-slate-100 border border-slate-200 self-start sm:self-auto" role="tablist" aria-label="Import source">
            {([['github', 'GitHub', GitBranch], ['zip', 'ZIP upload', FileArchive]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={importMode === key}
                onClick={() => setImportMode(key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  importMode === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6">
          {error && <div className="alert-error mb-5">{error}</div>}

          {importMode === 'github' ? (
            <form onSubmit={handleGithubImport} className="animate-fade-in">
              <label htmlFor="github-url" className="label">Repository URL</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <GitBranch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="github-url"
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className="input pl-10"
                    required
                    disabled={loading}
                  />
                </div>
                <button disabled={loading} className="btn btn-primary sm:w-48">
                  {loading ? 'Processing…' : job?.status === 'COMPLETED' ? 'Re-analyze' : 'Import & analyze'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2.5">Public GitHub repositories. The default branch is analyzed.</p>
            </form>
          ) : uploadedFile ? (
            <div className="animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-800">Uploaded</p>
                  <p className="text-xs text-emerald-700 truncate">{uploadedFile}</p>
                </div>
              </div>
              <button onClick={() => setUploadedFile(null)} className="btn btn-secondary text-xs px-3 py-1.5">Upload another</button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              className={`animate-fade-in rounded-xl border-2 border-dashed px-6 py-10 text-center transition cursor-pointer flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UploadCloud size={20} />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-700">
                {loading ? 'Uploading…' : isDragging ? 'Drop the ZIP file here' : <>Click to upload <span className="font-normal text-slate-500">or drag and drop</span></>}
              </p>
              <p className="text-xs text-slate-500 mt-1">.zip archive, up to 4.5 MB</p>
              <input type="file" accept=".zip" ref={fileInputRef} onChange={handleZipUpload} className="hidden" disabled={loading} />
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
