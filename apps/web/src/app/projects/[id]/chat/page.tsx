'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Send, Sparkles } from 'lucide-react';

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [messages, setMessages] = useState<{role: string, content: string, sources?: string[]}[]>([
    { role: 'assistant', content: 'Hello! I am grounded on this repository. Ask me anything about the architecture or code.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!input.trim()) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${params.id}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage })
      });
      
      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.reply ?? data.response ?? 'No answer was returned.',
        sources: data.sources 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to the AI server.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page max-w-4xl flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link>
        <ChevronRight size={14} />
        <Link href={`/projects/${params.id}`}>Project</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900">AI assistant</span>
      </nav>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Sparkles size={20} /></span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">AI assistant</h1>
          <p className="text-sm text-slate-500">Answers are grounded in this repository.</p>
        </div>
      </div>

      <div className="card flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                    <span className="font-semibold">Sources:</span> {m.sources.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100 text-slate-500 text-sm animate-pulse">Thinking…</div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-slate-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="input flex-1"
            placeholder="Ask about the codebase…"
            aria-label="Message"
          />
          <button disabled={loading || !input.trim()} className="btn btn-primary">
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
