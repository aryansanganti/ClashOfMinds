import React, { useState, useEffect, useRef } from 'react';
import { CompetitionRoomState, TurnContent, GameState, GameStatus } from '../types';
import { Timer, Swords } from 'lucide-react';
import { XMarkIcon, CheckIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { useSoundManager } from '../hooks/useSoundManager';
import { TransparentImage } from './TransparentImage';

interface CompetitionGameProps {
    roomState: CompetitionRoomState;
    gameState: GameState;
    allTurns: TurnContent[];
    onGameEnd: (winnerId: string, playerScore: number, opponentScore: number) => void;
    onBack: () => void;
    multiplayer: any;
}

export const CompetitionGameScreen: React.FC<CompetitionGameProps> = ({ roomState, gameState, allTurns, onGameEnd, onBack, multiplayer }) => {
    // --- GAME STATE ---
    const [timeLeft, setTimeLeft] = useState(roomState.timeLimitSeconds);
    const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
    const [playerScore, setPlayerScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [gameStatus, setGameStatus] = useState<'PLAYING' | 'FINISHED'>('PLAYING');

    // --- VISUAL STATE (From GameScreen) ---
    const [showNarrative, setShowNarrative] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);
    const [showEnemy, setShowEnemy] = useState(false);
    const [showQuestion, setShowQuestion] = useState(false);
    const [showAnswers, setShowAnswers] = useState(false);

    // Animation States
    const [attackingPlayer, setAttackingPlayer] = useState(false);
    const [attackingEnemy, setAttackingEnemy] = useState(false);
    const [playerShaking, setPlayerShaking] = useState(false);
    const [enemyShaking, setEnemyShaking] = useState(false);
    const [enemyFlyingAway, setEnemyFlyingAway] = useState(false);
    const [wasWrong, setWasWrong] = useState(false);
    const [shakeWrong, setShakeWrong] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Typewriter
    const [typewriterText, setTypewriterText] = useState('');
    const [typewriterComplete, setTypewriterComplete] = useState(false);

    // Chat State
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);

    // Refs
    const playerRef = useRef<HTMLDivElement>(null);
    const enemyRef = useRef<HTMLDivElement>(null);
    const [attackDistance, setAttackDistance] = useState<number>(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const botInterval = useRef<NodeJS.Timeout | null>(null);

    const soundManager = useSoundManager();
    const activeTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Current Content
    const safeIndex = currentTurnIndex % (allTurns?.length || 1);
    const currentTurn = allTurns?.[safeIndex] || gameState.current_turn;

    // Helper for timeouts
    const safeTimeout = (callback: () => void, delay: number) => {
        const id = setTimeout(() => {
            activeTimeouts.current = activeTimeouts.current.filter(t => t !== id);
            callback();
        }, delay);
        activeTimeouts.current.push(id);
        return id;
    };

    useEffect(() => {
        return () => {
            activeTimeouts.current.forEach(clearTimeout);
            if (botInterval.current) clearInterval(botInterval.current);
        };
    }, []);

    // --- SOCKET LOGIC ---
    useEffect(() => {
        if (multiplayer.socket) {
            multiplayer.socket.on('score_update', (data: any) => {
                if (data.playerId !== multiplayer.socket.id) {
                    setOpponentScore(data.score);
                }
            });
        }
        return () => {
            if (multiplayer.socket) multiplayer.socket.off('score_update');
        };
    }, [multiplayer.socket]);

    // --- TIMERS & BOT ---
    useEffect(() => {
        // TIMER
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 0) return 0;
                return prev - 1;
            });
        }, 1000);

        // BOT
        if (roomState.opponent?.is_bot) {
            const difficultyInterval = roomState.difficulty === 'HARD' ? 3000 : roomState.difficulty === 'EASY' ? 8000 : 5000;
            botInterval.current = setInterval(() => {
                if (Math.random() > 0.3) setOpponentScore(prev => prev + 10);
            }, difficultyInterval);
        }

        return () => clearInterval(timer);
    }, []); // Run once on mount

    // --- TURN ANIMATION LOOP ---
    // Trigger animations when turn index changes
    useEffect(() => {
        if (timeLeft === 0 && gameStatus === 'PLAYING') {
            handleGameOver();
        }
    }, [timeLeft, gameStatus]);

    useEffect(() => {
        runTurnIntro();
    }, [currentTurnIndex]);

    const runTurnIntro = () => {
        // Reset states
        setShowNarrative(false);
        setShowPlayer(false);
        setShowEnemy(false);
        setShowQuestion(false);
        setShowAnswers(false);
        setEnemyFlyingAway(false);
        setAttackingPlayer(false);
        setAttackingEnemy(false);
        setTypewriterText('');
        setTypewriterComplete(false);

        // Narrative / Typewriter
        const narr = `Round ${currentTurnIndex + 1}: Fight!`;
        setShowNarrative(true);

        // Typewriter Effect
        let i = 0;
        const typeInt = setInterval(() => {
            if (i < narr.length) {
                setTypewriterText(narr.substring(0, i + 1));
                i++;
            } else {
                clearInterval(typeInt);
                setTypewriterComplete(true);
            }
        }, 50);

        const baseDelay = 500;
        safeTimeout(() => { setShowPlayer(true); soundManager.playAppearCharacter(); }, baseDelay);
        safeTimeout(() => { setShowEnemy(true); soundManager.playAppearCharacter(); }, baseDelay + 400);
        safeTimeout(() => { setShowQuestion(true); soundManager.playAppearUI(); }, baseDelay + 800);
        safeTimeout(() => { setShowAnswers(true); }, baseDelay + 1200);

        return () => clearInterval(typeInt);
    };

    // --- GAMEPLAY HANDLERS ---
    const handleAction = (answer: string) => {
        if (gameStatus !== 'PLAYING' || isProcessing) return;
        setIsProcessing(true);
        setSelectedOption(answer);

        const isCorrect = answer === currentTurn.correct_answer;

        if (isCorrect) {
            soundManager.playCorrectAnswer();

            // Hold green
            safeTimeout(() => {
                // Calculate Distance
                if (playerRef.current && enemyRef.current) {
                    const pRect = playerRef.current.getBoundingClientRect();
                    const eRect = enemyRef.current.getBoundingClientRect();
                    const dist = (eRect.left + (eRect.width * 0.2)) - pRect.right;
                    setAttackDistance(dist + (pRect.width * 0.4));
                }

                // Attack Sequence
                setAttackingPlayer(true);
                soundManager.playPlayerAttack();

                safeTimeout(() => {
                    setAttackingPlayer(false);
                    setEnemyShaking(true);
                    soundManager.playEnemyDamage();
                }, 600);

                safeTimeout(() => {
                    setEnemyShaking(false);
                    setEnemyFlyingAway(true); // "Defeated" for this turn
                }, 1200);

                safeTimeout(() => {
                    // Update Score & Next
                    setPlayerScore(prev => {
                        const newScore = prev + 10;
                        multiplayer.updateScore(roomState.roomId, multiplayer.socket?.id, newScore);
                        return newScore;
                    });

                    nextQuestion();
                }, 2000);

            }, 1000);
        } else {
            soundManager.playWrongAnswer();
            setWasWrong(true);
            setShakeWrong(true);
            safeTimeout(() => setShakeWrong(false), 500);

            safeTimeout(() => {
                // Calculate Distance
                if (playerRef.current && enemyRef.current) {
                    const pRect = playerRef.current.getBoundingClientRect();
                    const eRect = enemyRef.current.getBoundingClientRect();
                    // Enemy to Player
                    const overlap = eRect.width * 0.4;
                    const dist = (pRect.right - overlap) - eRect.left;
                    setAttackDistance(dist);
                }

                setAttackingEnemy(true);
                soundManager.playEnemyAttack();

                safeTimeout(() => {
                    setAttackingEnemy(false);
                    setPlayerShaking(true);
                    soundManager.playPlayerDamage();
                }, 600);

                safeTimeout(() => {
                    setPlayerShaking(false);
                    nextQuestion();
                }, 1500);

            }, 1000);
        }
    };

    const nextQuestion = () => {
        // Reset Logic
        setIsProcessing(false);
        setSelectedOption(null);
        setWasWrong(false);

        setCurrentTurnIndex(prev => prev + 1); // Triggers useEffect for Intro
    };

    const [showResults, setShowResults] = useState(false);

    const handleGameOver = () => {
        setGameStatus('FINISHED');
        setShowResults(true);
    };

    const confirmGameEnd = () => {
        // Correct logic: host wins if their score >= opponent score.
        // If it's a tie, host wins by default logic or you can handle draws.
        // For simplicity here: Host wins ties.
        const hostIsWinner = playerScore >= opponentScore;
        const winnerId = hostIsWinner ? roomState.host.id : (roomState.opponent?.id || 'opponent');

        onGameEnd(winnerId, playerScore, opponentScore);
    };

    // Chat
    useEffect(() => {
        if (showChat) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnreadCount(0);
        } else {
            const lastMsg = multiplayer.messages[multiplayer.messages.length - 1];
            if (lastMsg && lastMsg.playerId !== multiplayer.socket?.id) {
                setUnreadCount(prev => prev + 1);
            }
        }
    }, [multiplayer.messages, showChat]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        multiplayer.sendChat(roomState.roomId, multiplayer.socket?.id, chatInput);
        setChatInput('');
    };


    // --- RENDERS ---
    const renderAnswers = () => {
        const { options } = currentTurn;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {options?.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    let btnClass = "bg-white/95 border-slate-200 text-slate-700 hover:scale-[1.02]";

                    if (isSelected) {
                        if (wasWrong) btnClass = "bg-red-500 border-red-600 text-white animate-shake";
                        else btnClass = "bg-gradient-to-br from-green-400 to-green-500 border-green-600 text-white scale-105 ring-4 ring-green-300";
                    } else if (isProcessing) {
                        btnClass = "opacity-40 grayscale";
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleAction(opt)}
                            disabled={isProcessing}
                            style={{
                                opacity: showAnswers ? 1 : 0,
                                transform: showAnswers ? 'translateY(0)' : 'translateY(20px)',
                                transition: `all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.1}s`
                            }}
                            className={`
                               relative p-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-lg text-center
                               border-b-4 shadow-lg backdrop-blur-sm transition-all duration-200 active:scale-95 active:border-b-0 active:translate-y-1
                               ${btnClass}
                           `}
                        >
                            {opt}
                        </button>
                    )
                })}
            </div>
        );
    };

    if (showResults) {
        const iWon = playerScore >= opponentScore;
        const winnerName = iWon ? "You" : (roomState.opponent?.name || "Opponent");
        const winnerAvatar = iWon ? (roomState.host.avatar || '🧙‍♂️') : (roomState.opponent?.avatar || '👾');
        const hostSolved = Math.floor(playerScore / 10);
        const opponentSolved = Math.floor(opponentScore / 10);

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fadeIn p-4">
                <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl text-center relative overflow-hidden border-4 border-indigo-500">

                    {/* Confetti / BG Effects */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-slideBg"></div>
                    {iWon && <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-yellow-300/40 to-transparent pointer-events-none" />}

                    {/* Result Header */}
                    <div className="relative z-10 mb-8">
                        <h2 className={`text-6xl font-black uppercase tracking-tighter mb-2 ${iWon ? 'text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-orange-500' : 'text-slate-400'}`}>
                            {iWon ? 'VICTORY!' : 'DEFEAT'}
                        </h2>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
                            {iWon ? 'You dominated the arena!' : 'Better luck next time!'}
                        </p>
                    </div>

                    {/* Winner Avatar */}
                    <div className="relative z-10 mb-8 flex justify-center">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center text-7xl bg-gradient-to-br ${iWon ? 'from-indigo-500 to-purple-600 shadow-purple-500/50' : 'from-slate-200 to-slate-300'} shadow-2xl border-4 border-white ring-4 ${iWon ? 'ring-yellow-400' : 'ring-slate-300'}`}>
                            {winnerAvatar}
                        </div>
                        {iWon && <div className="absolute -top-6 text-6xl animate-bounce">👑</div>}
                    </div>

                    {/* Score Comparison */}
                    <div className="grid grid-cols-2 gap-4 mb-8 bg-slate-50 rounded-2xl p-4 border border-slate-200 relative z-10">
                        <div className="text-center border-r border-slate-200">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">YOU</p>
                            <div className="text-4xl font-black text-indigo-600">{playerScore}</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1">{hostSolved} Solved</div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{roomState.opponent?.name || 'OPPONENT'}</p>
                            <div className="text-4xl font-black text-slate-600">{opponentScore}</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1">{opponentSolved} Solved</div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={confirmGameEnd}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-500/30 relative z-10"
                    >
                        Rankings & Exit
                    </button>

                </div>
            </div>
        );
    }

    if (gameStatus === 'FINISHED') return null; // Fallback, though should be caught by showResults above

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 overflow-hidden">

            {/* BACKGROUND ACCENTS */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/20 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 blur-[100px] rounded-full" />
            </div>

            {/* TOP HUD (Battle Specific) */}
            <div className="absolute top-4 left-0 right-0 z-50 px-4">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-black/60 backdrop-blur-md rounded-2xl p-2 pr-6 border border-indigo-500/30 flex items-center gap-3">
                            <div className={`text-4xl transition-transform ${attackingPlayer ? 'scale-125' : ''}`}>
                                {roomState.host.avatar || '🧙‍♂️'}
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-indigo-300 uppercase">You</div>
                                <div className="text-3xl font-black text-white leading-none">{playerScore}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="bg-black/80 rounded-full px-5 py-2 border border-white/10 flex items-center gap-2 shadow-xl mb-2">
                            <Timer className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-500' : 'text-sky-400'}`} />
                            <span className={`font-mono font-black text-xl ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                        <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{roomState.topic || 'Battle'}</div>
                    </div>

                    <div className="flex items-center gap-4 justify-end">
                        <div className="bg-black/60 backdrop-blur-md rounded-2xl p-2 pl-6 border border-red-500/30 flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-red-300 uppercase">{roomState.opponent?.name || 'Opponent'}</div>
                                <div className="text-3xl font-black text-white leading-none">{opponentScore}</div>
                            </div>
                            <div className={`text-4xl transition-transform ${attackingEnemy ? 'scale-125' : ''}`}>
                                {roomState.opponent?.avatar || '👾'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NARRATIVE */}
            <div className={`absolute top-32 left-0 right-0 z-30 flex justify-center transition-all duration-500 ${showNarrative && !selectedOption ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
                    <p className="text-white font-bold italic text-lg text-center">
                        <span className="text-yellow-400 mr-2">✦</span>
                        {typewriterText}
                        {!typewriterComplete && <span className="animate-pulse">|</span>}
                        <span className="text-yellow-400 ml-2">✦</span>
                    </p>
                </div>
            </div>

            {/* QUESTION CARD (Center) */}
            <div className="absolute top-[20%] left-0 right-0 z-40 flex justify-center pointer-events-none">
                <div className={`w-full max-w-2xl px-4 transition-all duration-700 ${(showQuestion && !isProcessing) ? 'pointer-events-auto opacity-100 translate-y-0 scale-100' : 'pointer-events-none opacity-0 translate-y-10 scale-95'}`}>
                    <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-6 md:p-10 shadow-2xl border-b-8 border-slate-200">
                        <p className="text-center text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Question {currentTurnIndex + 1}</p>
                        <h2 className="text-xl md:text-3xl font-black text-slate-800 text-center mb-8 leading-tight">
                            {currentTurn.question}
                        </h2>
                        {renderAnswers()}
                    </div>
                </div>
            </div>

            {/* BATTLE ARENA (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-[40vh] z-20 pointer-events-none">
                <div className="max-w-6xl mx-auto h-full relative px-8 flex justify-between items-end pb-8">

                    {/* PLAYER */}
                    <div
                        ref={playerRef}
                        style={{ transform: attackingPlayer ? `translateX(${attackDistance}px)` : undefined }}
                        className={`transition-all duration-500 ease-out origin-bottom-left
                                ${playerShaking ? 'animate-shake brightness-200 saturate-0' : ''}
                                ${showPlayer ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-32'}
                           `}
                    >
                        <div className="w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 relative">
                            {roomState.host.imageUrl ? (
                                <TransparentImage
                                    src={roomState.host.imageUrl}
                                    alt="Player"
                                    className="w-full h-full object-contain drop-shadow-2xl animate-[float_3s_ease-in-out_infinite]"
                                />
                            ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-[10rem] md:text-[12rem] lg:text-[14rem] drop-shadow-2xl filter hover:brightness-110 transition-all cursor-crosshair">
                                    {roomState.host.avatar || '🧙‍♂️'}
                                </span>
                            )}
                            {/* Shadow */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-black/40 blur-xl rounded-full" />
                        </div>
                    </div>

                    {/* OPPONENT */}
                    <div
                        ref={enemyRef}
                        style={{ transform: attackingEnemy ? `translateX(${attackDistance}px)` : undefined }}
                        className={`transition-all duration-500 ease-out origin-bottom-right
                                ${enemyShaking ? 'animate-shake brightness-200 saturate-0' : ''}
                                ${enemyFlyingAway ? 'opacity-0 translate-x-32 -rotate-45 scale-75' : ''}
                                ${showEnemy && !enemyFlyingAway ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-32'}
                           `}
                    >
                        <div className="w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 relative">
                            {roomState.opponent?.imageUrl ? (
                                <TransparentImage
                                    src={roomState.opponent.imageUrl}
                                    alt="Opponent"
                                    className="w-full h-full object-contain drop-shadow-2xl animate-[float_3s_ease-in-out_infinite_0.5s] transform scale-x-[-1]"
                                />
                            ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-[10rem] md:text-[12rem] lg:text-[14rem] drop-shadow-2xl transform scale-x-[-1] filter grayscale-[0.2]">
                                    {roomState.opponent?.avatar || '👾'}
                                </span>
                            )}
                            {/* Shadow */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-black/40 blur-xl rounded-full" />
                        </div>
                    </div>

                </div>
            </div>

            {/* CHAT OVERLAY */}
            <div className="absolute left-6 bottom-6 z-50">
                <div className="relative">
                    {showChat && (
                        <div className="absolute bottom-20 left-0 w-80 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl flex flex-col h-96 animate-slideUp origin-bottom-left">
                            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2">
                                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-black uppercase text-white tracking-widest">Trash Talk</span>
                                </div>
                                <button
                                    onClick={() => setShowChat(false)}
                                    className="text-white/40 hover:text-white"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 custom-scrollbar">
                                {multiplayer.messages.map((msg: any, i: number) => {
                                    const isMe = msg.playerId === multiplayer.socket?.id;
                                    return (
                                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm font-bold break-words shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                                                {msg.message}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Say something..."
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500 focus:bg-black/60 transition-all font-bold"
                                />
                                <button
                                    type="submit"
                                    disabled={!chatInput.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-white disabled:opacity-0 transition-all"
                                >
                                    <PaperAirplaneIcon className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    )}

                    <button
                        onClick={() => setShowChat(!showChat)}
                        className={`
                             group p-4 rounded-full shadow-2xl border-4 transition-all duration-300
                             ${showChat ? 'bg-white text-indigo-600 border-indigo-100 rotate-90 scale-90' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 hover:scale-110'}
                         `}
                    >
                        {showChat ? <XMarkIcon className="w-8 h-8" /> : <ChatBubbleLeftRightIcon className="w-8 h-8" />}

                        {unreadCount > 0 && !showChat && (
                            <span className="absolute -top-1 -right-1 flex h-6 w-6">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500 text-white text-[10px] font-bold items-center justify-center border-2 border-slate-900">
                                    {unreadCount}
                                </span>
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                  0%, 100% { transform: translateX(0); }
                  20% { transform: translateX(-15px) rotate(-5deg); }
                  40% { transform: translateX(15px) rotate(5deg); }
                  60% { transform: translateX(-10px) rotate(-3deg); }
                  80% { transform: translateX(10px) rotate(3deg); }
                }
                .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
             `}</style>
        </div>
    );
};
