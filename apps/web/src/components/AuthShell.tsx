import Link from 'next/link';
import { GitBranch, Search, Sparkles } from 'lucide-react';
import Logo from './Logo';

const POINTS = [
  { Icon: GitBranch, title: 'Map any repository', text: 'Import from GitHub or a ZIP and get a full architecture graph.' },
  { Icon: Search, title: 'Find code instantly', text: 'Search functions, classes and files, then jump straight to them.' },
  { Icon: Sparkles, title: 'Ask the AI', text: 'Get answers grounded in your own codebase.' },
];

// Split-screen frame for the sign-in and sign-up pages
export default function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <aside className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12">
        <Link href="/"><Logo inverted /></Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Understand any codebase in minutes.
          </h2>
          <ul className="mt-10 space-y-6 stagger">
            {POINTS.map(({ Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-indigo-300">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} CodeAtlas</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-12 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-sm stagger">
          <Link href="/" className="lg:hidden inline-block mb-10"><Logo /></Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1.5 mb-8">{subtitle}</p>
          {children}
          <p className="mt-8 text-sm text-slate-500">{footer}</p>
        </div>
      </main>
    </div>
  );
}
