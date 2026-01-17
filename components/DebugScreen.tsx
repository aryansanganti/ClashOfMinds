
import React from 'react';
import { DebugState } from '../types';
import { TransparentImage } from './TransparentImage';
import { ArrowDownTrayIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';

interface DebugScreenProps {
  debugState: DebugState;
  onBack: () => void;
}

export const DebugScreen: React.FC<DebugScreenProps> = ({
  debugState,
  onBack,
}) => {
  const downloadImage = (base64: string | null, filename: string) => {
    if (!base64) return;
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { theme, playerImage, backgroundImage, turns } = debugState;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 font-sans overflow-y-auto">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur z-20 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
            <button 
                onClick={onBack}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full transition-colors"
            >
                <ArrowLeftIcon className="w-6 h-6" />
            </button>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider">Debug Gallery</h1>
                <p className="text-slate-400 text-sm font-mono">Total Turns: {turns.length}</p>
            </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">

        {/* --- SECTION 1: STATIC ASSETS --- */}
        <section>
            <h2 className="text-xl font-bold text-sky-400 mb-6 uppercase tracking-widest border-b border-slate-700 pb-2">Base Assets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Player */}
                <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col gap-4">
                    <div className="text-sm font-bold text-slate-400 uppercase text-center">Player Character</div>
                    <div className="aspect-square bg-slate-900/50 rounded-xl overflow-hidden relative flex items-center justify-center">
                        {playerImage ? (
                            <TransparentImage src={playerImage} alt="Player" className="w-full h-full object-contain" />
                        ) : <span className="text-slate-600">No Image</span>}
                    </div>
                    <div className="text-xs text-slate-500 font-mono break-words leading-tight h-16 overflow-y-auto bg-slate-900 p-2 rounded">
                        {theme.player_visual_prompt}
                    </div>
                    <button 
                        onClick={() => downloadImage(playerImage, 'player_asset.png')}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" /> Download
                    </button>
                </div>

                 {/* Background */}
                 <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col gap-4">
                    <div className="text-sm font-bold text-slate-400 uppercase text-center">Environment</div>
                    <div className="aspect-square bg-slate-900/50 rounded-xl overflow-hidden relative flex items-center justify-center group">
                        {backgroundImage ? (
                            <img src={backgroundImage} alt="Background" className="w-full h-full object-cover" />
                        ) : <span className="text-slate-600">No Image</span>}
                    </div>
                    <div className="text-xs text-slate-500 font-mono break-words leading-tight h-16 overflow-y-auto bg-slate-900 p-2 rounded">
                        {theme.background_visual_prompt}
                    </div>
                    <button 
                         onClick={() => downloadImage(backgroundImage, 'background_asset.png')}
                         className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" /> Download
                    </button>
                </div>

            </div>
        </section>

        {/* --- SECTION 2: TURNS --- */}
        <section>
            <h2 className="text-xl font-bold text-green-400 mb-6 uppercase tracking-widest border-b border-slate-700 pb-2">Game Loop ({turns.length} Turns)</h2>
            
            <div className="space-y-12">
                {turns.map((turn, index) => (
                    <div key={index} className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-slate-700 text-white font-black px-3 py-1 rounded-lg text-sm">TURN {turn.turn_number}</span>
                            <span className="text-slate-500 text-xs font-mono">{turn.content.challenge_type}</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left: Visual */}
                            <div className="lg:col-span-1 flex flex-col gap-2">
                                <div className="aspect-square bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-600 shadow-xl">
                                    {/* Mock Game Visual */}
                                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none', backgroundSize: 'cover' }}></div>
                                    <div className="absolute inset-0 flex items-center justify-center p-4">
                                        {/* Player Small */}
                                        <div className="w-1/2 h-full flex items-center justify-center">
                                            {playerImage && <TransparentImage src={playerImage} alt="Player" className="max-h-full max-w-full" />}
                                        </div>
                                        {/* Boss Small - Flipped */}
                                        <div className="w-1/2 h-full flex items-center justify-center">
                                            {turn.bossImage && <TransparentImage src={turn.bossImage} alt="Boss" className="max-h-full max-w-full scale-x-[-1]" />}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => downloadImage(turn.bossImage, `turn_${turn.turn_number}_boss.png`)}
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                                >
                                    <ArrowDownTrayIcon className="w-3 h-3" /> Download Boss
                                </button>
                                <div className="text-[10px] text-slate-500 font-mono bg-slate-900 p-2 rounded h-20 overflow-y-auto">
                                    {turn.content.new_boss_visual_prompt || theme.boss_visual_prompt}
                                </div>
                            </div>

                            {/* Right: Logic & UI */}
                            <div className="lg:col-span-2 flex flex-col justify-center">
                                {/* Mock UI Card */}
                                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner">
                                    
                                    {/* Narrative */}
                                    <div className="bg-white px-6 py-4 rounded-xl shadow-sm text-center border-b-4 border-slate-200 mb-6 transform -rotate-1">
                                        <p className="text-lg font-black text-slate-800 leading-tight">
                                            "{turn.content.narrative_setup}"
                                        </p>
                                    </div>

                                    {/* Question */}
                                    <div className="flex flex-col items-center gap-4">
                                        <h2 className="text-white text-center font-bold text-lg bg-slate-900 px-4 py-2 rounded-lg border border-white/10">
                                            {turn.content.question}
                                        </h2>

                                        {/* Options */}
                                        {turn.content.challenge_type === 'TEXT_INPUT' ? (
                                            <div className="w-full bg-slate-700 h-12 rounded-lg border-b-4 border-slate-900 flex items-center px-4 text-slate-400 font-mono">
                                                User types answer here...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                                                {(turn.content.options || ['TRUE', 'FALSE']).map((opt, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className={`
                                                            relative w-full p-3 rounded-lg font-black text-sm text-center uppercase tracking-wide shadow border-b-4 bg-white border-slate-200 text-slate-800
                                                            ${opt === turn.content.correct_answer ? 'bg-green-100 border-green-300 text-green-900' : ''}
                                                        `}
                                                    >
                                                        {opt}
                                                        {opt === turn.content.correct_answer && <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full">CORRECT</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>

      </div>
    </div>
  );
};
