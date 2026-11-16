'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, FolderKanban, ChevronDown } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Me = { email: string };

export function useCurrentUser() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem('token'); } catch { /* storage blocked */ }
    setHasToken(!!token);
    if (!token) return;
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          // Expired or invalid session: clear it and send the user to log in again
          try { localStorage.removeItem('token'); } catch { /* ignore */ }
          setHasToken(false);
          router.replace('/login');
          return;
        }
        if (res.ok) setMe(await res.json());
      })
      .catch(() => { /* API unreachable: keep the menu, without the email */ });
    // Re-check on every navigation: the layout stays mounted across login/logout
  }, [router, pathname]);

  return { me, hasToken };
}

export function logout(router: ReturnType<typeof useRouter>) {
  try { localStorage.removeItem('token'); } catch { /* ignore */ }
  router.replace('/login');
}

export default function UserMenu() {
  const router = useRouter();
  const { me, hasToken } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!hasToken) return null;

  const email = me?.email || '';
  const initial = (email[0] || '?').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border border-white/10 bg-[#0d1430]/80 text-slate-200 hover:bg-[#151d45] hover:border-white/20 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8187ff] to-[#5a5ee8] text-white font-semibold flex items-center justify-center text-sm">
          {initial}
        </span>
        <span className="hidden sm:block max-w-[180px] truncate text-sm">{email || 'Account'}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 p-1.5 rounded-xl border border-white/10 bg-[#0b1128] text-slate-200 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.8)] z-50 animate-scale-in"
        >
          <div className="px-3 py-2.5 mb-1 border-b border-white/[0.08]">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-medium text-slate-100 truncate" title={email}>{email || '…'}</p>
          </div>
          <Link
            href="/projects"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-[#8187ff]/15 hover:text-white transition-colors"
          >
            <FolderKanban size={16} className="text-[#a8adff]" /> My Projects
          </Link>
          <button
            role="menuitem"
            onClick={() => logout(router)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#f9a8b8] hover:bg-[#f9a8b8]/10 hover:text-[#fcc4cf] transition-colors"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
