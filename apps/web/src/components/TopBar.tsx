'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu, { useCurrentUser } from './UserMenu';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

// Pages that have their own full-screen chrome or are for signed-out visitors
const HIDDEN = [/^\/$/, /^\/login$/, /^\/register$/, /^\/projects\/[^/]+\/architecture$/];

export default function TopBar() {
  const pathname = usePathname() || '/';
  const { hasToken } = useCurrentUser();
  if (!hasToken || HIDDEN.some((re) => re.test(pathname))) return null;

  return (
    <header className="sticky top-0 z-40 glass-bar border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/projects" aria-label="CodeAtlas home">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
