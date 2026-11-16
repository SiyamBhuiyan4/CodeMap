import { Network } from 'lucide-react';

// Brand mark used in the top bar, auth screens and landing page
export default function Logo({ size = 'md', inverted = false }: { size?: 'sm' | 'md' | 'lg'; inverted?: boolean }) {
  const box = size === 'lg' ? 'w-10 h-10 rounded-xl' : size === 'sm' ? 'w-7 h-7 rounded-md' : 'w-8 h-8 rounded-lg';
  const icon = size === 'lg' ? 22 : size === 'sm' ? 15 : 18;
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${box} bg-indigo-600 text-white flex items-center justify-center shadow-sm`}>
        <Network size={icon} strokeWidth={2.25} />
      </span>
      <span className={`${text} font-semibold tracking-tight ${inverted ? 'text-white' : 'text-slate-900'}`}>
        CodeAtlas
      </span>
    </span>
  );
}
