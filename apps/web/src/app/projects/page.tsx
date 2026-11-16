'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus, FolderGit2, Trash2, ArrowRight } from 'lucide-react';
import { Trie } from '@/lib/trie';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function ProjectsDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Trie over project names and descriptions for instant prefix search
  const trie = useMemo(() => {
    const t = new Trie<Project>((p) => p.id);
    projects.forEach((p) => {
      t.insert(p.name, p);
      if (p.description) t.insert(p.description, p);
    });
    return t;
  }, [projects]);

  const visibleProjects = useMemo(
    () => (query.trim() ? trie.search(query, 100, (p) => p.name) : projects),
    [trie, query, projects]
  );

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [router]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent card click
    
    if (!confirm('Are you sure you want to delete this project? This will remove all associated repositories and analysis data.')) {
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        // Remove from UI immediately
        setProjects(projects.filter(p => p.id !== id));
      } else {
        alert('Failed to delete project');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting project');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Each project maps one codebase. Open a project to view its architecture.</p>
        </div>
        <button onClick={() => router.push('/projects/new')} className="btn btn-primary">
          <Plus size={16} /> New project
        </button>
      </div>

      {projects.length > 0 && (
        <div className="relative max-w-md mb-6">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="input pl-10 pr-9"
            aria-label="Search projects"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-6 h-44">
              <div className="skeleton w-10 h-10 rounded-lg" />
              <div className="skeleton h-4 w-1/2 rounded mt-5" />
              <div className="skeleton h-3 w-3/4 rounded mt-3" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card card-body text-center py-16">
          <span className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FolderGit2 size={24} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No projects yet</h2>
          <p className="mt-1 text-sm text-slate-500">Create a project and import a repository to see its architecture.</p>
          <button onClick={() => router.push('/projects/new')} className="btn btn-primary mt-6">
            <Plus size={16} /> Create your first project
          </button>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="card card-body text-center text-sm text-slate-500">No projects match “{query}”.</div>
      ) : (
        <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleProjects.map((p) => (
            <div
              key={p.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/projects/${p.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/projects/${p.id}`); }}
              className="card card-hover p-6 flex flex-col cursor-pointer group hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center transition-colors duration-300 group-hover:bg-indigo-600 group-hover:text-white">
                  <FolderGit2 size={20} />
                </span>
                <button
                  onClick={(e) => handleDelete(e, p.id)}
                  className="p-2 -mr-2 -mt-2 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-600 hover:bg-red-50 transition"
                  title="Delete project"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 truncate">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2 min-h-[2.5rem]">{p.description || 'No description'}</p>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Created {new Date(p.created_at).toLocaleDateString()}</span>
                <span className="inline-flex items-center gap-1 font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                  Open <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
