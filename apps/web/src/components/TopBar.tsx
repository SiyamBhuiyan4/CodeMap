'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu, { useCurrentUser } from './UserMenu';
import Logo from './Logo';

// Pages that have their own full-screen chrome or are for signed-out visitors
const HIDDEN = [/^\/$/, /^\/login$/, /^\/register$/, /^\/projects\/[^/]+\/architecture$/];

export default function TopBar() {
  const pathname = usePathname() || '/';
  const { hasToken } = useCurrentUser();
  if (!hasToken || HIDDEN.some((re) => re.test(pathname))) return null;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/projects" aria-label="CodeAtlas home">
          <Logo />
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
