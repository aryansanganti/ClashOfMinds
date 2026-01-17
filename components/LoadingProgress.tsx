import React from 'react';
import { LoadingProgress as LoadingProgressType } from '../types';

interface LoadingProgressProps {
    progress: LoadingProgressType;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ progress }) => {
    return (
        <div className="w-full mt-4 animate-fadeIn">
            {/* Progress Bar Container */}
            <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                {/* Animated Background Gradient */}
                <div
                    className="absolute inset-0 bg-gradient-to-r from-sky-400 via-emerald-400 to-sky-400 transition-all duration-300 ease-out"
                    style={{
                        width: `${progress.percentage}%`,
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2s linear infinite'
                    }}
                />
                {/* Shine Effect */}
                <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{
                        width: `${progress.percentage}%`,
                        animation: 'shine 1.5s ease-in-out infinite'
                    }}
                />
            </div>

            {/* Progress Text */}
            <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-bold text-slate-500 truncate max-w-[70%]">
                    {progress.step}
                </span>
                <span className="text-sm font-black text-sky-600">
                    {Math.round(progress.percentage)}%
                </span>
            </div>

            {/* Step Counter */}
            <div className="text-center mt-1">
                <span className="text-xs font-bold text-slate-400">
                    {progress.current} / {progress.total} steps
                </span>
            </div>

            {/* Inline Keyframe Styles */}
            <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes shine {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
        </div>
    );
};
