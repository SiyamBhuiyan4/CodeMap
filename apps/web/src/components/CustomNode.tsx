import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Code2, Folder, FileCode2, Layers } from 'lucide-react';

const CustomNode = ({ data, selected }: any) => {
  const isFolder = data.type === 'folder';
  const isFile = data.type === 'file';
  const isModule = data.type === 'module';
  const isClass = data.type === 'class';
  
  let gradient = 'from-[#8a74e8] to-[#b49cf5]';
  let shadow = 'shadow-[0_0_15px_rgba(180,156,245,0.35)]';
  let Icon = Code2;
  
  if (isFolder) {
    gradient = 'from-[#c9a85a] to-[#f3dfa2]';
    shadow = 'shadow-[0_0_15px_rgba(243,223,162,0.35)]';
    Icon = Folder;
  } else if (isFile) {
    gradient = 'from-[#2fa89a] to-[#5fd4c4]';
    shadow = 'shadow-[0_0_15px_rgba(95,212,196,0.35)]';
    Icon = FileCode2;
  } else if (isModule) {
    gradient = 'from-[#5a5ee8] to-[#8187ff]';
    shadow = 'shadow-[0_0_15px_rgba(129,135,255,0.35)]';
    Icon = Layers;
  } else if (isClass) {
    gradient = 'from-[#3f8fd6] to-[#7cc4f5]';
    shadow = 'shadow-[0_0_15px_rgba(124,196,245,0.35)]';
    Icon = Box;
  }

  return (
    <div className={`relative px-4 py-3 rounded-xl bg-[#0d1430] border border-white/10 ${selected ? 'ring-2 ring-[#a8adff] ' + shadow : 'hover:border-white/25'} w-[220px] h-[64px]`}>
      
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-gray-800 border-2 border-gray-400 rounded-full" 
      />

      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {data.type}
          </span>
          <span className="text-sm font-semibold text-slate-100 truncate w-[140px]" title={data.name}>
            {data.name}
          </span>
        </div>
      </div>

      <div className="absolute top-2 right-2 flex space-x-1">
        {!isFolder && !isFile && !isModule && <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-gray-800 border-2 border-gray-400 rounded-full" 
      />
    </div>
  );
};

export default memo(CustomNode);
