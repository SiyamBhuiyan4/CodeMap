'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Trie } from '@/lib/trie';

export type SearchItem = { id: string; name: string; type: string };

const TYPE_STYLES: Record<string, string> = {
  folder: 'bg-[#f3dfa2]/15 text-[#f3dfa2]',
  file: 'bg-[#5fd4c4]/15 text-[#5fd4c4]',
  module: 'bg-[#8187ff]/15 text-[#a8adff]',
  class: 'bg-[#7cc4f5]/15 text-[#7cc4f5]',
  function: 'bg-[#b49cf5]/15 text-[#c4b2f7]',
};

// Search box for the architecture map, backed by a trie so results update instantly
// even on graphs with thousands of nodes.
export default function GraphSearch({ items, onPick }: { items: SearchItem[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trie = useMemo(() => {
    const t = new Trie<SearchItem>((i) => i.id);
    items.forEach((item) => t.insert(item.name, item));
    return t;
  }, [items]);

  const results = useMemo(() => trie.search(query, 12, (i) => i.name), [trie, query]);

  useEffect(() => setActive(0), [query]);

  // "/" focuses the search box, like many developer tools
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const pick = (item: SearchItem) => {
    onPick(item.id);
    setQuery(item.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-[#8187ff]">
        <Search size={16} className="text-gray-500 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="Search functions, classes, files…"
          className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500 min-w-0"
          aria-label="Search the architecture map"
        />
        {query ? (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-gray-500 hover:text-gray-300" aria-label="Clear search">
            <X size={14} />
          </button>
        ) : (
          <kbd className="hidden md:block text-[10px] text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">/</kbd>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 mt-2 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No matches for “{query}”</p>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
              {results.map((item, idx) => (
                <li key={item.id} role="option" aria-selected={idx === active}>
                  <button
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => pick(item)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm ${idx === active ? 'bg-gray-800 text-white' : 'text-gray-300'}`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_STYLES[item.type] || 'bg-gray-800 text-gray-400'}`}>
                      {item.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-800">↑↓ to move · Enter to open · Esc to close</p>
        </div>
      )}
    </div>
  );
}
