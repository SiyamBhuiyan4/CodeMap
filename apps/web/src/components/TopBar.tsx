'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu, { useCurrentUser } from './UserMenu';

// Pages that have their own full-screen chrome or are for signed-out visitors
const HIDDEN = [/^\/$/, /^\/login$/, /^\/register$/, /^\/projects\/[^/]+\/architecture$/];

export default function TopBar() {
  const pathname = usePathname() || '/';
  const { hasToken } = useCurrentUser();
  if (!hasToken || HIDDEN.some((re) => re.test(pathname))) return null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/projects" className="text-xl text-gray-900 tracking-tight">
            Code<span className="font-bold">Atlas</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <Link
              href="/projects"
              className={`px-3 py-2 rounded-lg ${pathname.startsWith('/projects') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Projects
            </Link>
          </nav>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
