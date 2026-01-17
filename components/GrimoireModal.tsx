import React from 'react';
import { XMarkIcon, CheckCircleIcon, BookOpenIcon, ClockIcon } from '@heroicons/react/24/solid';
import { useKnowledge } from '../src/context/KnowledgeContext';
import { useSoundManager } from '../hooks/useSoundManager';
import { formatDate } from '../services/statsService';

interface GrimoireModalProps {
    onClose: () => void;
}

export const GrimoireModal: React.FC<GrimoireModalProps> = ({ onClose }) => {
    const { shards, markShardResolved, loading } = useKnowledge();
    const soundManager = useSoundManager();

    const handleMastered = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        soundManager.playVictory(); // Mini victory
        markShardResolved(id);
    };

    return (
        <div className="fixed inset-0 z[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn p-4 z-50">
            <div className="bg-slate-50 rounded-3xl w-full max-w-4xl h-[80vh] shadow-2xl flex flex-col overflow-hidden border-4 border-purple-500/30 relative">

                {/* Header */}
                <div className="bg-purple-900 p-6 flex items-center justify-between shrink-0 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-purple-700 rounded-2xl shadow-inner border border-purple-500/50">
                            <BookOpenIcon className="w-8 h-8 text-purple-200" />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                                Grimoire of Remembrance
                            </h2>
                            <p className="text-purple-200 font-bold text-sm">
                                {shards.length} Knowledge Shards to Master
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors relative z-10"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[url('https://www.transparenttextures.com/patterns/paper.png')]">

                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                        </div>
                    ) : shards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                            <BookOpenIcon className="w-24 h-24 text-slate-300 mb-4" />
                            <h3 className="text-xl font-bold text-slate-500">The Grimoire is Empty</h3>
                            <p className="text-slate-400">You have mastered all your past failures... for now.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {shards.map((shard: any) => (
                                <div
                                    key={shard.id}
                                    className="bg-white rounded-xl p-5 shadow-lg border-b-4 border-slate-200 hover:border-purple-300 transition-all hover:-translate-y-1 group relative"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                            <ClockIcon className="w-3 h-3" />
                                            {formatDate(shard.timestamp)}
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-slate-800 text-lg mb-4 leading-snug">
                                        {shard.question}
                                    </h4>

                                    <div className="space-y-2 mb-4">
                                        <div className="p-2 bg-red-50 border border-red-100 rounded-lg">
                                            <p className="text-[10px] uppercase font-black text-red-400 mb-0.5">You Answered</p>
                                            <p className="text-sm font-bold text-red-600 line-through decoration-2 opacity-70">
                                                {shard.playerAnswer}
                                            </p>
                                        </div>
                                        <div className="p-2 bg-green-50 border border-green-100 rounded-lg">
                                            <p className="text-[10px] uppercase font-black text-green-500 mb-0.5">Correct Answer</p>
                                            <p className="text-sm font-black text-green-700">
                                                {shard.correctAnswer}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => handleMastered(shard.id, e)}
                                        className="w-full py-2 bg-purple-100 text-purple-600 hover:bg-purple-600 hover:text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
                                    >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Mark as Mastered
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
