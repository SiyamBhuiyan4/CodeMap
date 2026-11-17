'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FolderGit2, Search } from 'lucide-react';
import { Trie, tokenize } from '@/lib/trie';

export type ProjectOption = { id: string; name: string };

// Bold the part of `name` that matches the query (whole name or start of any word)
function Highlight({ name, query }: { name: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{name}</>;
  const lower = name.toLowerCase();
  let at = lower.startsWith(q) ? 0 : -1;
  if (at < 0) {
    // find a word inside the name that starts with the query
    let pos = 0;
    for (const word of tokenize(name)) {
      const i = lower.indexOf(word, pos);
      if (i >= 0 && word.startsWith(q)) { at = i; break; }
      if (i >= 0) pos = i + word.length;
    }
  }
  if (at < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <span className="text-white font-semibold">{name.slice(at, at + q.length)}</span>
      {name.slice(at + q.length)}
    </>
  );
}

// Searchable project selector backed by the shared trie (lib/trie.ts)
export default function ProjectPicker({ projects, value, onChange }: {
  projects: ProjectOption[]; value: string | null; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const trie = useMemo(() => {
    const t = new Trie<ProjectOption>((p) => p.id);
    projects.forEach((p) => t.insert(p.name, p));
    return t;
  }, [projects]);

  const results = useMemo(
    () => (query.trim() ? trie.search(query, 50, (p) => p.name) : projects),
    [trie, query, projects]
  );
  const selected = projects.find((p) => p.id === value) || null;

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = Math.max(0, projects.findIndex((p) => p.id === value));
    setActive(idx);
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the highlighted row in view while using the arrow keys
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (p: ProjectOption) => { onChange(p.id); setOpen(false); };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm text-left transition-colors bg-gray-950 ${
          open ? 'border-[#8187ff] ring-2 ring-[#8187ff]/20' : 'border-gray-700 hover:border-gray-500'
        }`}
      >
        <FolderGit2 size={15} className="text-[#a8adff] shrink-0" />
        <span className="flex-1 truncate text-gray-100">{selected ? selected.name : 'Choose a project'}</span>
        <ChevronDown size={15} className={`text-gray-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-10 rounded-xl border border-white/10 bg-[#0b1128] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.85)] overflow-hidden animate-scale-in" style={{ transformOrigin: 'top' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08]">
            <Search size={14} className="text-gray-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
                else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
              }}
              placeholder="Search projects…"
              className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500 min-w-0"
              aria-label="Search projects"
              role="combobox"
              aria-expanded="true"
              aria-controls="project-picker-list"
            />
            <span className="text-[10px] text-gray-500 tabular-nums">{results.length}/{projects.length}</span>
          </div>
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500 text-center">No projects match “{query}”</p>
          ) : (
            <ul id="project-picker-list" ref={listRef} role="listbox" className="max-h-52 overflow-y-auto p-1">
              {results.map((p, idx) => (
                <li key={p.id} data-index={idx} role="option" aria-selected={p.id === value}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(p)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
                      idx === active ? 'bg-[#8187ff]/15 text-gray-100' : 'text-gray-300'
                    }`}
                  >
                    <FolderGit2 size={14} className={idx === active ? 'text-[#a8adff]' : 'text-gray-500'} />
                    <span className="flex-1 truncate"><Highlight name={p.name} query={query} /></span>
                    {p.id === value && <Check size={14} className="text-[#a8adff] shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
