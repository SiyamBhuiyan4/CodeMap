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

export default function UserMenu({ dark = false }: { dark?: boolean }) {
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
        className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border transition ${
          dark
            ? 'border-gray-700 bg-gray-900/80 text-gray-200 hover:bg-gray-800'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-sm">
          {initial}
        </span>
        <span className="hidden sm:block max-w-[180px] truncate text-sm">{email || 'Account'}</span>
        <ChevronDown size={16} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-lg overflow-hidden z-50 ${
            dark ? 'bg-gray-950 border-gray-800 text-gray-200' : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className={`px-4 py-3 border-b ${dark ? 'border-gray-800' : 'border-gray-100'}`}>
            <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Signed in as</p>
            <p className="text-sm font-medium truncate" title={email}>{email || '…'}</p>
          </div>
          <Link
            href="/projects"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 text-sm ${dark ? 'hover:bg-gray-900' : 'hover:bg-gray-50'}`}
          >
            <FolderKanban size={16} /> My Projects
          </Link>
          <button
            role="menuitem"
            onClick={() => logout(router)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 ${dark ? 'hover:bg-gray-900 text-red-400' : 'hover:bg-red-50'}`}
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
