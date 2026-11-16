'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create project');
      
      router.push('/projects');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page max-w-2xl">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900">New project</span>
      </nav>
      <div className="page-header">
        <div>
          <h1 className="page-title">Create a project</h1>
          <p className="page-subtitle">A project holds one codebase. You&apos;ll import the repository on the next screen.</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body space-y-6">
          {error && <div className="alert-error">{error}</div>}
          <div>
            <label htmlFor="name" className="label">Project name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Storefront web app" required />
          </div>
          <div>
            <label htmlFor="description" className="label">Description <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="input resize-none" placeholder="What is this codebase about?" rows={3} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => router.push('/projects')} className="btn btn-secondary mt-4">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary mt-4">
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
