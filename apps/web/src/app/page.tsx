import Link from 'next/link';
import { GitBranch, Search, Sparkles, BarChart3, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';

const FEATURES = [
  { Icon: GitBranch, title: 'Architecture map', text: 'Folders, files, modules and functions laid out as one navigable graph.' },
  { Icon: Search, title: 'Instant search', text: 'Find any function, class or file and jump straight to it.' },
  { Icon: BarChart3, title: 'Code insights', text: 'Language mix, dependency counts and findings like circular imports.' },
  { Icon: Sparkles, title: 'AI assistant', text: 'Ask questions and get answers grounded in your own repository.' },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/register" className="btn btn-primary">Get started</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="stagger max-w-6xl mx-auto px-4 sm:px-8 pt-20 pb-16 text-center">
          <span className="badge bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200">Codebase architecture intelligence</span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight text-slate-900 max-w-3xl mx-auto leading-[1.1]">
            See how your code fits together.
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            CodeAtlas analyses any repository and turns it into an interactive map, so you can understand,
            search and explain a codebase in minutes instead of days.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="btn btn-primary btn-lg">
              Create free account <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">Sign in</Link>
          </div>
        </section>

        <section className="bg-slate-50 border-t border-slate-200">
          <div className="stagger max-w-6xl mx-auto px-4 sm:px-8 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="card card-hover p-6 group">
                <span className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center transition-colors duration-300 group-hover:bg-indigo-600 group-hover:text-white">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 text-sm text-slate-500">© {new Date().getFullYear()} CodeAtlas</div>
      </footer>
    </div>
  );
}
