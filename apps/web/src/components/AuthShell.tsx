import Link from 'next/link';
import { GitBranch, Search, Sparkles } from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

const POINTS = [
  { Icon: GitBranch, title: 'Map any repository', text: 'Import from GitHub or a ZIP and get a full architecture graph.' },
  { Icon: Search, title: 'Find code instantly', text: 'Search functions, classes and files, then jump straight to them.' },
  { Icon: Sparkles, title: 'Ask the AI', text: 'Get answers grounded in your own codebase.' },
];

// Sign-in / sign-up frame: product story on the sky, form in a glass card
export default function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        <Link href="/"><Logo inverted /></Link>
        <ThemeToggle />
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 pb-12 grid lg:grid-cols-2 gap-12 items-center">
        <aside className="hidden lg:block text-white">
          <h2 className="text-4xl font-semibold tracking-tight leading-tight max-w-md [text-shadow:0_2px_24px_rgba(2,6,23,0.5)]">
            Understand any codebase in minutes.
          </h2>
          <ul className="mt-10 space-y-6 stagger max-w-md">
            {POINTS.map(({ Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center text-indigo-200">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-slate-300 mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="w-full max-w-md mx-auto lg:ml-auto">
          <div className="card p-8 sm:p-10 stagger">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500 mt-1.5 mb-8">{subtitle}</p>
            {children}
            <p className="mt-8 text-sm text-slate-500">{footer}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
