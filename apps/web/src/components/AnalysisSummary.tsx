'use client';

import { useEffect, useState } from 'react';
import { FileCode2, Layers, Box, Code2, GitMerge, Link2, AlertTriangle, Info, RefreshCcw } from 'lucide-react';

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
  GOD_COMPONENT: { label: 'Oversized component', tone: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle },
  DEAD_CODE: { label: 'Possibly unused', tone: 'bg-gray-50 text-gray-700 border-gray-200', Icon: Info },
};

const LANG_COLORS: Record<string, string> = {
  python: 'bg-sky-500', typescript: 'bg-blue-600', javascript: 'bg-yellow-400',
};

// Overview of the latest completed analysis: totals, language mix and findings.
export default function AnalysisSummary({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

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
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 space-y-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-medium">Analysis Summary</h2>
        <span className="text-xs text-gray-400">
          {new Date(summary.analyzed_at + (summary.analyzed_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs"><Icon size={14} /> {label}</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {summary.languages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Languages</h3>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
            {summary.languages.map((l) => (
              <div
                key={l.language}
                className={LANG_COLORS[l.language] || 'bg-gray-300'}
                style={{ width: `${(l.files / totalLangFiles) * 100}%` }}
                title={`${l.language}: ${l.files} files`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-gray-600">
            {summary.languages.map((l) => (
              <span key={l.language} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${LANG_COLORS[l.language] || 'bg-gray-300'}`} />
                <span className="capitalize">{l.language === 'unknown' ? 'Other' : l.language}</span>
                <span className="text-gray-400">{l.files}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-medium text-gray-700">Findings</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.finding_counts).map(([type, count]) => {
              const meta = FINDING_META[type];
              const on = filter === type;
              return (
                <button
                  key={type}
                  onClick={() => { setFilter(on ? null : type); setShowAll(false); }}
                  className={`text-xs px-3 py-1 rounded-full border transition ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {meta?.label || type} · {count}
                </button>
              );
            })}
          </div>
        </div>

        {summary.findings.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">No issues found. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((f) => {
              const meta = FINDING_META[f.type] || { label: f.type, tone: 'bg-gray-50 text-gray-700 border-gray-200', Icon: Info };
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
          <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm text-gray-600 hover:text-gray-900">
            {showAll ? 'Show less' : `Show all ${findings.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
