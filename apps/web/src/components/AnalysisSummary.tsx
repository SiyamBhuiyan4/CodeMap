'use client';

import { useEffect, useState } from 'react';
import { FileCode2, Layers, Box, Code2, GitMerge, Link2, Info, RefreshCcw, ChevronDown } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Summary = {
  analyzed_at: string;
  files: number;
  modules: number;
  classes: number;
  functions: number;
  calls: number;
  imports: number;
  languages: { language: string; files: number }[];
  finding_counts: Record<string, number>;
  findings: { id: string; type: string; severity: string; description: string }[];
};

const FINDING_META: Record<string, { label: string; tone: string; Icon: typeof Info }> = {
  CIRCULAR_DEPENDENCY: { label: 'Circular dependency', tone: 'bg-red-50 text-red-700 border-red-200', Icon: RefreshCcw },
  DEAD_CODE: { label: 'Possibly unused', tone: 'bg-slate-50 text-slate-700 border-slate-200', Icon: Info },
};

const LANG_COLORS: Record<string, string> = {
  python: 'bg-sky-500', typescript: 'bg-blue-600', javascript: 'bg-yellow-400',
};

// Postgres returns "...+00:00", SQLite returns a naive timestamp (UTC); handle both
const parseServerDate = (value: string) => {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return isNaN(d.getTime()) ? null : d;
};

const LANG_NAMES: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python', unknown: 'Other', other: 'Other',
};
const langName = (l: string) => LANG_NAMES[l] || l.charAt(0).toUpperCase() + l.slice(1);

const EXPANDED_KEY = 'codeatlas.summary.expanded';

// Overview of the latest completed analysis: totals, language mix and findings.
export default function AnalysisSummary({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hoverLang, setHoverLang] = useState<string | null>(null);

  // Remember the open/closed choice for this browser
  useEffect(() => {
    try { setExpanded(localStorage.getItem(EXPANDED_KEY) === '1'); } catch { /* storage blocked */ }
  }, []);
  const toggle = () => {
    setExpanded((v) => {
      try { localStorage.setItem(EXPANDED_KEY, v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/api/analysis/projects/${projectId}/summary`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [projectId, refreshKey]);

  if (!summary) return null;

  const stats = [
    { label: 'Files', value: summary.files, Icon: FileCode2 },
    { label: 'Modules', value: summary.modules, Icon: Layers },
    { label: 'Classes', value: summary.classes, Icon: Box },
    { label: 'Functions', value: summary.functions, Icon: Code2 },
    { label: 'Calls', value: summary.calls, Icon: Link2 },
    { label: 'Imports', value: summary.imports, Icon: GitMerge },
  ];
  const totalLangFiles = summary.languages.reduce((a, l) => a + l.files, 0) || 1;
  const findings = summary.findings.filter((f) => !filter || f.type === filter);
  const visible = showAll ? findings : findings.slice(0, 6);

  return (
    <section className="card card-body space-y-8">
      <div className="flex items-baseline justify-between">
        <h2 className="card-title">Analysis summary</h2>
        <span className="text-xs text-slate-400">
          {parseServerDate(summary.analyzed_at)?.toLocaleString() ?? ''}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium"><Icon size={14} /> {label}</div>
            <div className="text-2xl font-semibold text-slate-900 mt-2 tabular-nums">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {summary.languages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Languages</h3>
          <div className="relative pt-1" onMouseLeave={() => setHoverLang(null)}>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {summary.languages.map((l) => (
                <div
                  key={l.language}
                  onMouseEnter={() => setHoverLang(l.language)}
                  onClick={() => setHoverLang((h) => (h === l.language ? null : l.language))}
                  className={`h-full cursor-pointer transition-opacity ${LANG_COLORS[l.language] || 'bg-gray-300'} ${hoverLang && hoverLang !== l.language ? 'opacity-40' : ''}`}
                  style={{ width: `${(l.files / totalLangFiles) * 100}%` }}
                  aria-label={`${langName(l.language)}: ${l.files} files`}
                />
              ))}
            </div>
            {(() => {
              // Tooltip for the hovered language segment
              let offset = 0;
              for (const l of summary.languages) {
                const width = (l.files / totalLangFiles) * 100;
                if (l.language === hoverLang) {
                  // Arrow points at the exact centre of the segment; near the card edges
                  // only the label box slides inward so it never gets cut off.
                  const center = offset + width / 2;
                  const align = center > 85 ? 'right' : center < 15 ? 'left' : 'center';
                  const pct = ((l.files / totalLangFiles) * 100).toFixed(1).replace(/\.0$/, '');
                  return (
                    <div className="absolute bottom-full mb-1 pointer-events-none z-10" style={{ left: `${center}%` }}>
                      <div
                        className={`absolute bottom-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap ${
                          align === 'right' ? 'right-0 translate-x-3' : align === 'left' ? 'left-0 -translate-x-3' : 'left-0 -translate-x-1/2'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <span className={`w-2.5 h-2.5 rounded-full ${LANG_COLORS[l.language] || 'bg-gray-300'}`} />
                          {langName(l.language)}
                        </div>
                        <div className="text-slate-300 mt-0.5">{l.files} files · {pct}%</div>
                      </div>
                      <div className="absolute bottom-1 left-0 -translate-x-1/2 w-2.5 h-2.5 bg-gray-900 rotate-45" />
                    </div>
                  );
                }
                offset += width;
              }
              return null;
            })()}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-slate-600">
            {summary.languages.map((l) => (
              <span
                key={l.language}
                onMouseEnter={() => setHoverLang(l.language)}
                onMouseLeave={() => setHoverLang(null)}
                className={`flex items-center gap-2 cursor-default transition-opacity ${hoverLang && hoverLang !== l.language ? 'opacity-40' : ''}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${LANG_COLORS[l.language] || 'bg-gray-300'}`} />
                <span>{langName(l.language)}</span>
                <span className="text-slate-400">{l.files}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls="summary-details"
        className="btn btn-secondary w-full"
      >
        {expanded
          ? 'Hide details'
          : `Show details${summary.findings.length ? ` · ${summary.findings.length} finding${summary.findings.length === 1 ? '' : 's'}` : ''}`}
        <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
      <div id="summary-details">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-medium text-slate-700">Findings</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.finding_counts).map(([type, count]) => {
              const meta = FINDING_META[type];
              const on = filter === type;
              return (
                <button
                  key={type}
                  onClick={() => { setFilter(on ? null : type); setShowAll(false); }}
                  className={`text-xs px-3 py-1 rounded-full border transition ${on ? 'bg-gray-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                >
                  {meta?.label || type} · {count}
                </button>
              );
            })}
          </div>
        </div>

        {summary.findings.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">No issues found. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((f) => {
              const meta = FINDING_META[f.type] || { label: f.type, tone: 'bg-slate-50 text-slate-700 border-slate-200', Icon: Info };
              return (
                <li key={f.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${meta.tone}`}>
                  <meta.Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium">{meta.label}</span>
                    <p className="opacity-80 break-words">{f.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {findings.length > 6 && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm text-slate-600 hover:text-slate-900">
            {showAll ? 'Show less' : `Show all ${findings.length}`}
          </button>
        )}
      </div>
      )}
    </section>
  );
}
