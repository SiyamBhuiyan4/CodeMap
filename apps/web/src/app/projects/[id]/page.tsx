'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, CheckCircle2, AlertCircle, ArrowRight, GitBranch, FileArchive, UploadCloud } from 'lucide-react';
import ChatWidget from '@/components/ChatWidget';
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

  if (!project) {
    return (
      <div className="page">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-8 w-64 bg-slate-200 rounded mt-4 animate-pulse" />
        <div className="card h-32 mt-8 animate-pulse" />
      </div>
    );
  }

  const analyzing = tracking && (!job || isActive(job));

  return (
    <div className="page max-w-5xl space-y-6">
      <div>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/projects">Projects</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 truncate">{project.name}</span>
        </nav>
        <h1 className="page-title">{project.name}</h1>
        <p className="page-subtitle">{project.description || 'No description'}</p>
      </div>

      {(tracking || job) && (
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
                  className="h-full bg-indigo-600 rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(2, job?.progress ?? 0)}%` }}
                />
              </div>
              {job?.source && <p className="mt-3 text-xs text-slate-500 truncate" title={job.source}>{job.source}</p>}
            </div>
          ) : job?.status === 'COMPLETED' ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <span className="w-11 h-11 shrink-0 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 flex items-center justify-center">
                  <CheckCircle2 size={22} />
                </span>
                <div className="min-w-0">
                  <h2 className="card-title">Analysis complete</h2>
                  <p className="text-sm text-slate-500 truncate" title={job.source}>{job.source}</p>
                </div>
              </div>
              <Link href={`/projects/${params.id}/architecture`} className="btn btn-primary">
                View architecture map <ArrowRight size={16} />
              </Link>
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

      <section className="card card-body">
        <div className="mb-6">
          <h2 className="card-title">{job?.status === 'COMPLETED' ? 'Re-analyze repository' : 'Import a repository'}</h2>
          <p className="card-subtitle">
            {job?.status === 'COMPLETED'
              ? 'Pushed new code? Import again to refresh the map and summary.'
              : 'Import from GitHub or upload a ZIP archive to analyze the code.'}
          </p>
        </div>
        {error && <div className="alert-error mb-6">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleGithubImport} className="flex flex-col">
            <label htmlFor="github-url" className="label flex items-center gap-2"><GitBranch size={16} /> GitHub repository</label>
            <input
              id="github-url"
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="input"
              required
              disabled={loading}
            />
            <p className="text-xs text-slate-500 mt-2">Public repositories only.</p>
            <button disabled={loading} className="btn btn-primary w-full mt-6">
              {loading ? 'Processing…' : 'Import & analyze'}
            </button>
          </form>

          <div className="flex flex-col">
            <span className="label flex items-center gap-2"><FileArchive size={16} /> ZIP archive</span>
            {uploadedFile ? (
              <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center flex flex-col items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-600" />
                <p className="mt-2 text-sm font-medium text-emerald-800">Uploaded</p>
                <p className="text-xs text-emerald-700 mt-0.5 truncate max-w-full">{uploadedFile}</p>
                <button onClick={() => setUploadedFile(null)} className="mt-3 text-xs font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-4">
                  Upload another file
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                className={`flex-1 rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <span className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                  <UploadCloud size={20} />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {loading ? 'Uploading…' : isDragging ? 'Drop the ZIP file here' : <>Click to upload <span className="font-normal text-slate-500">or drag and drop</span></>}
                </p>
                <p className="text-xs text-slate-500 mt-1">.zip up to 4.5 MB</p>
                <input type="file" accept=".zip" ref={fileInputRef} onChange={handleZipUpload} className="hidden" disabled={loading} />
              </div>
            )}
          </div>
        </div>
      </section>

      <ChatWidget projectId={params.id} />
    </div>
  );
}
