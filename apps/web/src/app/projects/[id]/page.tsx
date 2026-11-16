'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatWidget from '@/components/ChatWidget';

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
  const [showIngest, setShowIngest] = useState(false);
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
      if (isActive(latest)) {
        setTracking(true);
        setLoading(true);
        startPolling();
      }
    })();
  }, [fetchLatestJob, startPolling]);

  const beginTracking = () => {
    ignoreJobId.current = job?.id ?? null;
    setShowIngest(false);
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

  if (!project) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <Link href="/projects" className="text-sm text-gray-400 hover:text-gray-700 mb-2 inline-block">← Back to Projects</Link>
            <h1 className="text-3xl font-medium text-gray-900">{project.name}</h1>
            <p className="text-gray-500 mt-2">{project.description || 'No description'}</p>
          </div>
        </header>

        {(tracking || job) && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200">
            {(tracking && (!job || isActive(job))) ? (
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-xl font-medium">Analyzing repository…</h2>
                  <span className="text-2xl font-semibold tabular-nums text-gray-900">{job?.progress ?? 0}%</span>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(2, job?.progress ?? 0)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-3 text-sm text-gray-500">
                  <span>{STAGE_LABELS[job?.stage || ''] || 'Starting'}…</span>
                  {job?.source && <span className="truncate max-w-[50%]" title={job.source}>{job.source}</span>}
                </div>
              </div>
            ) : job?.status === 'COMPLETED' ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl">✓</div>
                  <div>
                    <h2 className="text-xl font-medium">Analysis complete</h2>
                    <p className="text-sm text-gray-500 truncate max-w-md" title={job.source}>{job.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {!showIngest && (
                    <button onClick={() => { setShowIngest(true); if (job?.source_type === 'github') setGithubUrl(job.source); }} className="text-sm text-gray-500 hover:text-gray-900 underline-offset-4 hover:underline">
                      Re-analyze
                    </button>
                  )}
                  <Link href={`/projects/${params.id}/architecture`} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition text-center">
                    View Architecture Map
                  </Link>
                </div>
              </div>
            ) : job?.status === 'FAILED' ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl">!</div>
                <div>
                  <h2 className="text-xl font-medium">Analysis failed</h2>
                  <p className="text-sm text-red-600">{job.error_message || 'Something went wrong. Try importing again.'}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {(showIngest || !(job?.status === 'COMPLETED' || (tracking && (!job || isActive(job))))) && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium">{job?.status === 'COMPLETED' ? 'Re-analyze Repository' : 'Ingest Repository'}</h2>
            {showIngest && (
              <button onClick={() => setShowIngest(false)} className="text-sm text-gray-500 hover:text-gray-900">Cancel</button>
            )}
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <form onSubmit={handleGithubImport} className="space-y-4">
              <h3 className="font-medium text-gray-700">Import from GitHub</h3>
              <input 
                type="text" 
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required 
                disabled={loading}
              />
              <button disabled={loading} className="w-full py-3 bg-yellow-400 text-gray-900 font-medium rounded-xl hover:bg-yellow-500 transition disabled:opacity-50">
                {loading ? 'Processing...' : 'Import & Analyze'}
              </button>
            </form>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-700">Upload ZIP Archive</h3>
              
              {uploadedFile ? (
                <div className="border-2 border-green-300 bg-green-50 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                  <span className="text-3xl mb-2">✅</span>
                  <p className="font-medium text-green-800">File Uploaded</p>
                  <p className="text-sm text-green-600 mt-1">{uploadedFile}</p>
                  <button 
                    onClick={() => setUploadedFile(null)}
                    className="mt-4 text-sm text-green-700 underline hover:text-green-900"
                  >
                    Upload another file
                  </button>
                </div>
              ) : (
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center relative overflow-hidden ${
                    isDragging ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <span className="text-3xl mb-2">{isDragging ? '📥' : '📁'}</span>
                  <p className="font-medium text-gray-700">
                    {loading ? 'Uploading...' : isDragging ? 'Drop ZIP file here' : 'Click or Drag & Drop ZIP'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Extracts and analyzes code automatically</p>
                  
                  <input 
                    type="file" 
                    accept=".zip" 
                    ref={fileInputRef}
                    onChange={handleZipUpload}
                    className="hidden"
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
      <ChatWidget projectId={params.id} />
    </div>
  );
}
