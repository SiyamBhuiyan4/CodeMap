'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, MarkerType, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Code, GitMerge, FileText, ArrowLeft, Terminal, Cpu, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import CustomNode from '@/components/CustomNode';
import UserMenu from '@/components/UserMenu';
import ChatWidget from '@/components/ChatWidget';
import GraphSearch, { SearchItem } from '@/components/GraphSearch';

const NODE_W = 220;
const NODE_H = 64;
const GAP_X = 40;
const GAP_Y = 70;

type Box = { w: number; h: number; place: (x: number, y: number, out: Record<string, { x: number; y: number }>) => void };

// Packs child boxes into wrapped rows so the whole graph stays close to screen proportions
// (a plain top-to-bottom tree becomes an extremely wide strip once a repo has hundreds of entities).
const packRows = (boxes: Box[]) => {
  const area = boxes.reduce((a, b) => a + (b.w + GAP_X) * (b.h + GAP_Y), 0);
  const widest = boxes.reduce((m, b) => Math.max(m, b.w), 0);
  const targetW = Math.max(widest, Math.sqrt(area * 2.6));
  const rows: { items: Box[]; w: number; h: number }[] = [];
  let row = { items: [] as Box[], w: 0, h: 0 };
  boxes.forEach((b) => {
    const nextW = row.items.length ? row.w + GAP_X + b.w : b.w;
    if (row.items.length && nextW > targetW) {
      rows.push(row);
      row = { items: [], w: 0, h: 0 };
    }
    row.w = row.items.length ? row.w + GAP_X + b.w : b.w;
    row.h = Math.max(row.h, b.h);
    row.items.push(b);
  });
  if (row.items.length) rows.push(row);
  const w = rows.reduce((m, r) => Math.max(m, r.w), 0);
  const h = rows.reduce((t, r, i) => t + r.h + (i ? GAP_Y : 0), 0);
  const place = (x: number, y: number, out: Record<string, { x: number; y: number }>) => {
    let cy = y;
    rows.forEach((r) => {
      let cx = x + (w - r.w) / 2;
      r.items.forEach((b) => {
        b.place(cx, cy, out);
        cx += b.w + GAP_X;
      });
      cy += r.h + GAP_Y;
    });
  };
  return { w, h, place };
};

// Lays out the containment hierarchy (folder > file > module > function/class) only.
// Call and import edges are drawn on top but never distort the layout.
const getLayoutedNodes = (nodes: any[], edges: any[]) => {
  const children: Record<string, string[]> = {};
  const hasParent = new Set<string>();
  const ids = new Set(nodes.map((n) => n.id));
  edges.forEach((e) => {
    if (e.type !== 'containment' || !ids.has(e.source) || !ids.has(e.target) || hasParent.has(e.target)) return;
    (children[e.source] ||= []).push(e.target);
    hasParent.add(e.target);
  });

  const visiting = new Set<string>();
  const boxFor = (id: string): Box => {
    visiting.add(id);
    const kids = (children[id] || []).filter((k) => !visiting.has(k));
    const self = (x: number, y: number, out: Record<string, { x: number; y: number }>) => { out[id] = { x, y }; };
    if (!kids.length) {
      visiting.delete(id);
      return { w: NODE_W, h: NODE_H, place: self };
    }
    const block = packRows(kids.map(boxFor));
    visiting.delete(id);
    const w = Math.max(NODE_W, block.w);
    return {
      w,
      h: NODE_H + GAP_Y + block.h,
      place: (x, y, out) => {
        self(x + (w - NODE_W) / 2, y, out);
        block.place(x + (w - block.w) / 2, y + NODE_H + GAP_Y, out);
      },
    };
  };

  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => boxFor(n.id));
  const positions: Record<string, { x: number; y: number }> = {};
  packRows(roots).place(0, 0, positions);
  // Explicit size lets the minimap and fitView work for nodes that are not rendered yet
  return nodes.map((n) => ({ ...n, width: NODE_W, height: NODE_H, position: positions[n.id] || { x: 0, y: 0 } }));
};

const EDGE_COLORS: Record<string, string> = { call: '#06b6d4', dependency: '#f59e0b', containment: '#a855f7' };

const MINIMAP_COLORS: Record<string, string> = {
  folder: '#f59e0b', file: '#10b981', module: '#6366f1', class: '#38bdf8',
};

export default function ArchitecturePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [allEdges, setAllEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Downloading graph...');
  const [showLayers, setShowLayers] = useState({ containment: true, call: false, dependency: false });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [entityDetails, setEntityDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'logic'>('overview');
  


  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  useEffect(() => {
    const fetchGraph = async () => {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');
      
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${params.id}/graph`, {
          headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store'
        });
        
        if (res.ok) {
          const data = await res.json();
          
          setLoadingStage(`Building layout for ${data.nodes.length} nodes...`);
          // Let the loading message paint before the (synchronous) layout runs
          await new Promise((r) => setTimeout(r, 30));

          const styledNodes = data.nodes.map((n: any) => ({
            ...n,
            type: 'custom',
            data: {
              ...n.data,
              type: n.data.label.split(':')[0].trim(),
              name: n.data.label.split(':')[1].trim()
            }
          }));

          setNodes(getLayoutedNodes(styledNodes, data.edges));
          setSearchItems(styledNodes.map((n: any) => ({ id: n.id, name: n.data.name, type: n.data.type })));
          setAllEdges(data.edges);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, [params.id, router, setNodes]);

  // Static (non-animated, unfiltered) edges. Calls/imports are hidden by default and always
  // shown for the selected node, which keeps large graphs readable and fast to pan/zoom.
  const edges = useMemo(() => {
    return allEdges
      .filter((e: any) => {
        const touchesSelected = selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);
        return touchesSelected || (showLayers as any)[e.type];
      })
      .map((e: any) => {
        const color = EDGE_COLORS[e.type] || EDGE_COLORS.containment;
        const highlighted = !!selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);
        const isStructure = e.type === 'containment';
        const base = isStructure ? 1 : 1.75;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type === 'containment' ? 'smoothstep' : 'default',
          markerEnd: e.type === 'containment' ? undefined : { type: MarkerType.ArrowClosed, width: 14, height: 14, color },
          style: {
            stroke: color,
            strokeWidth: highlighted ? base + 1.5 : base,
            strokeDasharray: e.type === 'dependency' ? '5,4' : undefined,
            opacity: highlighted ? 1 : selectedNodeId ? 0.15 : isStructure ? 0.35 : 0.8,
          },
          zIndex: highlighted ? 10 : 0,
        };
      });
  }, [allEdges, showLayers, selectedNodeId]);

  const onNodeClick = useCallback(async (event: any, node: any) => {
    setSelectedNodeId(node.id);
    setEntityDetails(null);
    setActiveTab('overview');
    
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${params.id}/entities/${node.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setEntityDetails(await res.json());
      }
    } catch(e) {
      console.error(e);
    }
  }, [params.id]);

  // Search result picked: zoom to the node, select it and open its details panel
  const focusNode = useCallback((id: string) => {
    const node = rf?.getNode(id);
    if (!node) return;
    rf!.setCenter(node.position.x + 110, node.position.y + 32, { zoom: 1.1, duration: 600 });
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
    onNodeClick(null, node);
  }, [rf, setNodes, onNodeClick]);

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-cyan-400 font-mono tracking-widest text-sm uppercase">{loadingStage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] flex flex-col font-sans text-gray-200 overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <header className="p-5 border-b border-gray-800/60 bg-gray-950/40 backdrop-blur-md z-10 flex justify-between items-center relative shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Cpu size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">CodeAtlas Engine</h1>
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mt-1">Live Telemetry & Topology Matrix</p>
          </div>
        </div>
        <div className="flex-1 flex justify-center px-6">
          <GraphSearch items={searchItems} onPick={focusNode} />
        </div>
        <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push(`/projects/${params.id}`)}
          className="flex items-center gap-2 text-sm font-medium text-gray-300 bg-gray-800/80 hover:bg-gray-700 hover:text-white px-4 py-2 rounded-lg transition-all border border-gray-700 shadow-sm"
        >
          <ArrowLeft size={16} /> Exit Matrix
        </button>
          <UserMenu dark />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <div className={`flex-1 relative transition-all duration-500 ease-out ${selectedNodeId ? 'w-2/3 pr-[33%]' : 'w-full'}`}>
          <ReactFlow
            proOptions={{ hideAttribution: true }}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onInit={setRf}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            fitViewOptions={{ padding: 0.05 }}
            minZoom={0.02}
            maxZoom={2}
            onlyRenderVisibleElements
            nodesConnectable={false}
            className="bg-transparent"
          >
            <Background color="#1f2937" gap={20} size={1.5} />
            <Controls position="top-left" className="bg-gray-900 border-gray-700 fill-gray-300 shadow-xl" />
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor={(n: any) => MINIMAP_COLORS[n.data?.type] || '#a855f7'}
              nodeStrokeColor={(n: any) => MINIMAP_COLORS[n.data?.type] || '#a855f7'}
              nodeStrokeWidth={60}
              maskColor="rgba(2, 6, 23, 0.6)"
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
            />
          </ReactFlow>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-gray-950/90 border border-gray-800 rounded-full px-3 py-1.5 text-xs">
            {([
              ['containment', 'Structure'],
              ['call', 'Calls'],
              ['dependency', 'Imports'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setShowLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${showLayers[key] ? 'border-gray-600 bg-gray-800 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: EDGE_COLORS[key], opacity: showLayers[key] ? 1 : 0.35 }} />
                {label}
              </button>
            ))}
            <span className="text-gray-500 pl-1 hidden md:inline">Click a node to see its links</span>
          </div>
        </div>

        <AnimatePresence>
          {selectedNodeId && (
            <motion.div 
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 w-1/3 h-full bg-gray-950/80 backdrop-blur-2xl border-l border-gray-800 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] flex flex-col z-20"
            >
              <div className="p-5 border-b border-gray-800/60 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Entity Viewer
                    </span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white break-words pr-8">
                    {entityDetails ? entityDetails.name : 'Analyzing...'}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedNodeId(null)}
                  className="text-gray-500 hover:text-white p-2 rounded-lg bg-gray-900 border border-gray-800 transition-colors hover:bg-gray-800"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex border-b border-gray-800">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === 'overview' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/10' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Activity size={16} className="inline mr-2" /> Overview
                </button>
                <button 
                  onClick={() => setActiveTab('logic')}
                  className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === 'logic' ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/10' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Terminal size={16} className="inline mr-2" /> Source Code
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                {!entityDetails ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin"></div>
                    <p className="font-mono text-sm uppercase tracking-widest text-cyan-500/70">Decoding matrix...</p>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/80 shadow-inner">
                          <div className="flex items-center gap-3 text-sm text-gray-300">
                            <FileText size={16} className="text-gray-500" />
                            <span className="font-mono bg-gray-950 px-2 py-1 rounded text-xs border border-gray-800 truncate" title={entityDetails.file_path}>
                              {entityDetails.file_path}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400 mt-3">
                            <Code size={16} className="text-gray-500" />
                            <span>Lines: <span className="text-white font-mono">{entityDetails.start_line}</span> to <span className="text-white font-mono">{entityDetails.end_line}</span></span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400 mt-3">
                            <GitMerge size={16} className="text-gray-500" />
                            <span>Type: <span className="text-white font-mono capitalize">{entityDetails.type}</span></span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div> Telemetry & Impact
                          </h4>
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-900/20 to-transparent p-4 rounded-xl border border-blue-900/40 border-l-2 border-l-blue-500 hover:bg-blue-900/30 transition-colors">
                              <span className="text-[10px] font-bold text-blue-400 uppercase block mb-2 tracking-wider">Depends On (Uses)</span>
                              <ul className="text-sm space-y-2 text-gray-300">
                                {entityDetails.callees.length === 0 ? <li className="text-gray-600 italic font-mono text-xs">No outgoing calls detected</li> :
                                  entityDetails.callees.map((c: any) => <li key={c.id} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/80"></div><span className="font-mono">{c.name}</span></li>)
                                }
                              </ul>
                            </div>
                            
                            <div className="bg-gradient-to-r from-purple-900/20 to-transparent p-4 rounded-xl border border-purple-900/40 border-l-2 border-l-purple-500 hover:bg-purple-900/30 transition-colors">
                              <span className="text-[10px] font-bold text-purple-400 uppercase block mb-2 tracking-wider">Affected By (Impact)</span>
                              <p className="text-xs text-gray-400 mb-3 leading-relaxed">Modifying this entity will affect the following dependents:</p>
                              <ul className="text-sm space-y-2 text-gray-300">
                                {entityDetails.callers.length === 0 ? <li className="text-gray-600 italic font-mono text-xs">No incoming calls detected</li> :
                                  entityDetails.callers.map((c: any) => <li key={c.id} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500/80"></div><span className="font-mono">{c.name}</span></li>)
                                }
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'logic' && (
                      <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div> Live Source Code
                          </h4>
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-800">Read-Only</span>
                        </div>
                        
                        <div className="flex-1 bg-[#0d1117] rounded-xl overflow-hidden border border-gray-800 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)]">
                          <div className="flex items-center px-4 py-2 bg-gray-900/80 border-b border-gray-800 backdrop-blur">
                            <div className="flex space-x-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                            </div>
                            <div className="mx-auto text-[10px] text-gray-500 font-mono">{entityDetails.file_path.split('/').pop()}</div>
                          </div>
                          <pre className="p-5 overflow-x-auto text-[13px] text-gray-300 font-mono leading-relaxed h-[calc(100vh-320px)] custom-scrollbar">
                            <code className="text-cyan-200">{entityDetails.source_code || "// Source code could not be loaded or analyzed"}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ChatWidget projectId={params.id} contextEntityId={selectedNodeId} />
      </div>


      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }
        .react-flow__attribution { display: none !important; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
