'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, X } from 'lucide-react';
import ProjectPicker, { ProjectOption } from './ProjectPicker';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';


// Floating AI chat: a fixed button at the bottom-right that opens a chat window.
// Mounted globally for signed-in pages (components/GlobalChat.tsx) and on the architecture map
// (where the selected node is sent as context). Without a projectId it shows a project picker.
export default function ChatWidget({ projectId = null, contextEntityId = null }: { projectId?: string | null; contextEntityId?: string | null }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const activeId = projectId ?? pickedId;
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: 'Hello! I am your CodeAtlas AI. You can ask me anything about this architecture.' }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Outside a project: load the user's projects for the picker when the chat is opened
  useEffect(() => {
    if (projectId || !isChatOpen || projects) return;
    const token = localStorage.getItem('token');
    fetch(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProjectOption[]) => {
        setProjects(list);
        if (list.length && !pickedId) setPickedId(list[0].id);
      })
      .catch(() => setProjects([]));
  }, [projectId, isChatOpen, projects, pickedId]);

  useEffect(() => {
    setChatMessages([{ role: 'ai', text: 'Hello! I am your CodeAtlas AI. You can ask me anything about this architecture.' }]);
    if (!activeId) return;
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API}/api/projects/${activeId}/chat/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const history = await res.json();
          if (history.length > 0) {
            setChatMessages(history.map((m: any) => ({
              role: m.role === 'user' ? 'user' : 'ai',
              text: m.content
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load chat history', err);
      }
    };
    fetchHistory();
  }, [activeId]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || !activeId) return;
    const newMsg = currentMessage;
    setCurrentMessage('');
    setChatMessages(prev => [...prev, { role: 'user', text: newMsg }]);
    setIsTyping(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/projects/${activeId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: newMsg, context_entity_id: contextEntityId })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, my neural link to the backend is currently offline.' }]);
      }
    } catch(e) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Connection error while contacting AI core.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chatMessages, isTyping, isChatOpen]);

  return (
    <>
      {/* Chat FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {!isChatOpen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={() => setIsChatOpen(true)}
              className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:shadow-[0_0_30px_rgba(147,51,234,0.8)] transition-all"
            >
              <Sparkles size={24} className="text-white" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Chat Window */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 w-[calc(100vw-3rem)] sm:w-96 h-[500px] max-h-[calc(100vh-3rem)] bg-gray-950/90 backdrop-blur-2xl border border-gray-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col z-50 overflow-hidden"
          >
            {/* Chat Header */}
            <div className="p-4 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">CodeAtlas AI</h3>
                  <p className="text-[10px] text-green-400 flex items-center gap-1 font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                  </p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Project picker when the chat is opened outside a project */}
            {!projectId && (
              <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-900/40">
                {projects === null ? (
                  <p className="text-xs text-gray-500">Loading projects…</p>
                ) : projects.length === 0 ? (
                  <p className="text-xs text-gray-400">Create a project first to chat about its code.</p>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="shrink-0">Project</span>
                    <ProjectPicker projects={projects} value={pickedId} onChange={setPickedId} />
                  </div>
                )}
              </div>
            )}

            {/* Chat Messages */}
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
              {chatMessages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-gray-800 bg-gray-900/50">
              <form 
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-2 bg-gray-950 border border-gray-700 rounded-full p-1 pl-4"
              >
                <input 
                  type="text" 
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder={activeId ? 'Ask about this architecture...' : 'Choose a project first'}
                  disabled={!activeId}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-200 placeholder-gray-500"
                />
                <button type="submit" disabled={!currentMessage.trim() || isTyping || !activeId} className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-full text-white transition-colors">
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
