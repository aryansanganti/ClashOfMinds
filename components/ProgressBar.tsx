
import React from 'react';

interface ProgressBarProps {
  current: number;
  max: number;
  label: string;
  colorClass: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, max, label, colorClass }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  
  return (
    <div className="w-full">
      <div className="w-full bg-slate-200 h-6 rounded-full overflow-hidden border-2 border-slate-300 relative">
        {/* Shine effect */}
        <div className="absolute top-1 left-2 right-2 h-1 bg-white/30 rounded-full z-10"></div>
        
        <div 
          className={`h-full ${colorClass} transition-all duration-500 ease-out flex items-center justify-end px-2`}
          style={{ width: `${percentage}%` }}
        >
             <span className="text-[10px] font-black text-white/90">{current}</span>
        </div>
      </div>
    </div>
  );
};
