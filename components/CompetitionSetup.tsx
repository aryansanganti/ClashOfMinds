import React, { useState, useEffect } from 'react';
import { PlayerProfile, CompetitionRoomState, Difficulty } from '../types';
import { UserIcon, ClipboardDocumentIcon, PlayIcon, ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { Swords } from 'lucide-react';
import { useSoundManager } from '../hooks/useSoundManager';
import { generateGameImage } from '../services/geminiService';

interface CompetitionSetupProps {
    onGameStart: (roomState: CompetitionRoomState) => void;
    onBack: () => void;
    multiplayer: any;
    isRaid?: boolean;
}

const AVATAR_PROMPTS: Record<string, string> = {
    '🧙‍♂️': 'Cute 3d cartoon wizard character, holding a magical staff, wearing a starry blue hat and robe',
    '🦸‍♀️': 'Cute 3d cartoon superhero character, wearing a cape and mask, heroic pose',
    '🤖': 'Cute 3d cartoon friendly robot, shiny metal, glowing eyes, futuristic',
    '👽': 'Cute 3d cartoon alien, green skin, large eyes, space suit',
    '🦊': 'Cute 3d cartoon fox warrior, holding a small sword, adventurous outfit',
    '🦁': 'Cute 3d cartoon lion king, wearing a crown and royal cape',
    '🦄': 'Cute 3d cartoon unicorn, rainbow mane, magical aura',
    '💀': 'Cute 3d cartoon skeleton, wearing a pirate hat, funny and not scary',
    '🤡': 'Cute 3d cartoon clown, colorful outfit, juggling balls, happy expression',
    '🤠': 'Cute 3d cartoon cowboy, wearing a hat and sheriff badge, holding a lasso'
};

export const CompetitionSetup: React.FC<CompetitionSetupProps> = ({ onGameStart, onBack, multiplayer, isRaid = false }) => {
    const [step, setStep] = useState<1 | 2>(1); // 1: Profile, 2: Lobby
    const [mode, setMode] = useState<'HOST' | 'JOIN'>('HOST');

    // Profile State
    const [name, setName] = useState('');
    const [avatar, setAvatar] = useState('🧙‍♂️');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    // Lobby State
    const [joinCode, setJoinCode] = useState('');
    const [roomId, setRoomId] = useState('');
    const [opponent, setOpponent] = useState<PlayerProfile | null>(null);

    // Host Settings
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');

    const soundManager = useSoundManager();

    // --- SOCKET LISTENERS ---
    useEffect(() => {
        if (!multiplayer.socket) return;

        const handleRoomUpdate = (data: any) => {
            if (mode === 'HOST') {
                setOpponent(data.opponent);
            } else {
                setOpponent(data.host);
            }
        };

        const handleGameStart = (data: any) => {
            const currentTopic = mode === 'HOST' ? topic : data.config.topic;
            const currentDifficulty = mode === 'HOST' ? difficulty : data.config.difficulty;

            // If I am Host: hostProfile is ME.
            // If I am Joiner: hostProfile is THE OPPONENT.
            // We need to construct the state such that 'host' is always the ROOM HOST.

            // HOWEVER, CompetitionGameScreen expects:
            // 'host' = The player (YOU) ?? 
            // No, in standard logic 'host' is the room owner.
            // But visuals need to know "Which one is ME?" 
            // Let's pass the raw room state and let GameScreen sort it out via IDs.

            // For simplicity:
            // Host: host=Me, opponent=Them
            // Joiner: host=Me, opponent=Them (We swap them locally?)
            // Let's swap them for the Joiner so that "Host" prop in GameComponent usually means "Player 1 (Left/You)"

            let localHostProfile, localOpponentProfile;

            if (mode === 'HOST') {
                localHostProfile = {
                    id: multiplayer.socket.id,
                    name,
                    avatar,
                    imageUrl: generatedImageUrl || undefined,
                    is_bot: false,
                    score: 0,
                    progress: 0
                };
                localOpponentProfile = data.config.opponentProfile || { id: 'opp', name: 'Opponent', avatar: '👤', is_bot: false, score: 0, progress: 0 };
                // data.config might not have opponentProfile fully if it was just joined
                // Actually, the Server 'game_start' should ideally pass full profiles.
                // But we have `opponent` state here.
                if (opponent) localOpponentProfile = opponent;
            } else {
                // Joiner
                // "Host" (Left Side / You) = Me
                localHostProfile = {
                    id: multiplayer.socket.id,
                    name,
                    avatar,
                    imageUrl: generatedImageUrl || undefined,
                    is_bot: false,
                    score: 0,
                    progress: 0
                };
                // "Opponent" (Right Side / Them) = The Room Host
                localOpponentProfile = data.config.hostProfile || opponent;
            }

            const roomState: CompetitionRoomState = {
                roomId: roomId || joinCode,
                host: localHostProfile,
                opponent: localOpponentProfile,
                topic: currentTopic,
                difficulty: currentDifficulty,
                timeLimitSeconds: 60,
                gameMode: isRaid ? 'RAID' : 'BATTLE',
                bossHp: isRaid ? 100 : undefined,
                bossMaxHp: isRaid ? 100 : undefined,
                status: 'PLAYING'
            };

            onGameStart(roomState);
        };

        multiplayer.socket.on('room_update', handleRoomUpdate);
        multiplayer.socket.on('game_start', handleGameStart);

        return () => {
            multiplayer.socket.off('room_update', handleRoomUpdate);
            multiplayer.socket.off('game_start', handleGameStart);
        };
    }, [multiplayer.socket, mode, roomId, joinCode, topic, difficulty, opponent, name, avatar, generatedImageUrl]);


    const handleProfileSubmit = async () => {
        if (!name) return;
        soundManager.playButtonClick();
        setIsGenerating(true);

        let imgUrl = null;
        try {
            const prompt = AVATAR_PROMPTS[avatar] || `Cute 3d cartoon character representing ${avatar}`;
            // Generate player facing RIGHT
            imgUrl = await generateGameImage(prompt, false, 'right');
            setGeneratedImageUrl(imgUrl);
        } catch (e) {
            console.error("Failed to generate avatar image", e);
        }

        setIsGenerating(false);
        setStep(2);

        const myProfile = {
            id: `player_${Math.random().toString(36).substr(2, 9)}`,
            name,
            avatar,
            imageUrl: imgUrl || undefined,
            is_bot: false,
            score: 0,
            progress: 0
        };

        if (mode === 'HOST') {
            const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            setRoomId(newRoomId);
            // Join as Host
            multiplayer.joinRoom(newRoomId, myProfile, isRaid ? 'RAID' : 'BATTLE');
        }
    };

    const handleJoinRoom = () => {
        if (!joinCode) return;
        soundManager.playButtonClick();
        setRoomId(joinCode);

        const myProfile = {
            id: `player_${Math.random().toString(36).substr(2, 9)}`,
            name,
            avatar,
            imageUrl: generatedImageUrl || undefined,
            is_bot: false,
            score: 0,
            progress: 0
        };
        multiplayer.joinRoom(joinCode, myProfile, isRaid ? 'RAID' : 'BATTLE');
    };

    const handleStartGameHost = () => {
        if (!multiplayer.socket) return;
        soundManager.playButtonClick();

        // We need to send MY profile and THE OPPONENT'S profile to the game start config
        // so the other player knows who is who.
        // Actually the server broadcast sends it to everyone.

        const hostProfile = {
            id: multiplayer.socket?.id,
            name,
            avatar,
            imageUrl: generatedImageUrl || undefined,
            is_bot: false,
            score: 0,
            progress: 0
        };

        const config = {
            topic,
            difficulty,
            hostProfile,
            opponentProfile: opponent
        };

        multiplayer.socket.emit('start_game_request', { roomId, gameConfig: config });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-lg w-full relative border-b-8 border-slate-200">

                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="absolute top-6 left-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>

                <div className="text-center mb-8 mt-4">
                    <div className="inline-block p-4 rounded-3xl bg-red-100 text-red-500 mb-4 rotate-3 shadow-lg">
                        <Swords className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">
                        {step === 1 ? 'Setup Profile' : (mode === 'HOST' ? (isRaid ? 'Host Raid' : 'Lobby Host') : (isRaid ? 'Join Raid' : 'Join Lobby'))}
                    </h2>
                </div>

                {step === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Mode Select */}
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                            <button
                                onClick={() => setMode('HOST')}
                                className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all ${mode === 'HOST' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Host Game
                            </button>
                            <button
                                onClick={() => setMode('JOIN')}
                                className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all ${mode === 'JOIN' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Join Game
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name..."
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-12 pr-4 font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 outline-none transition-all"
                                />
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Choose Avatar</label>
                            <div className="grid grid-cols-5 gap-2">
                                {['🧙‍♂️', '🦸‍♀️', '🤖', '👽', '🦊', '🦁', '🦄', '💀', '🤡', '🤠'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => setAvatar(emoji)}
                                        className={`text-2xl py-3 rounded-xl border-2 transition-all ${avatar === emoji ? 'bg-indigo-50 border-indigo-500 scale-110' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleProfileSubmit}
                            disabled={!name || isGenerating}
                            className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white border-b-4 border-indigo-700 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <SparklesIcon className="w-5 h-5 animate-spin" />
                                    Generating Character...
                                </>
                            ) : (
                                'Next'
                            )}
                        </button>
                    </div>
                )}

                {step === 2 && mode === 'HOST' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center bg-slate-800 text-white p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">{isRaid ? 'Raid Code' : 'Room Code'}</p>
                            <p className="text-5xl font-black font-mono tracking-widest text-indigo-400 select-all">{roomId}</p>
                            <button
                                onClick={() => navigator.clipboard.writeText(roomId)}
                                className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                                title="Copy Code"
                            >
                                <ClipboardDocumentIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Game Settings */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Topic</label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="General Knowledge..."
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Difficulty</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDifficulty(d)}
                                            className={`py-2 rounded-lg font-bold text-xs border-2 ${difficulty === d ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Waiting Status */}
                        <div className="border-t-2 border-slate-100 pt-6">
                            {opponent ? (
                                <div className="flex items-center gap-4 bg-green-50 p-4 rounded-xl border-2 border-green-100 animate-slideUp">
                                    <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center text-2xl overflow-hidden shadow-inner">
                                        {opponent.imageUrl ? (
                                            <img src={opponent.imageUrl} alt="Opponent" className="w-full h-full object-cover" />
                                        ) : (
                                            opponent.avatar
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-700">{opponent.name}</p>
                                        <p className="text-xs font-bold text-green-600 uppercase">{isRaid ? 'Teammate Ready!' : 'Ready to battle!'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border-2 border-slate-100 text-slate-400">
                                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center animate-pulse">
                                        ⏳
                                    </div>
                                    <div>
                                        <p className="font-bold">{isRaid ? 'Waiting for teammates...' : 'Waiting for opponent...'}</p>
                                        <p className="text-xs">Share the code above</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleStartGameHost}
                            disabled={!topic || !opponent}
                            className="w-full py-4 bg-green-500 hover:bg-green-400 text-white border-b-4 border-green-700 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:grayscale"
                        >
                            Start {isRaid ? 'Raid' : 'Battle'}
                        </button>
                    </div>
                )}

                {step === 2 && mode === 'JOIN' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Enter Room Code</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="XXXXXX"
                                maxLength={6}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-4 px-4 font-black text-3xl text-center text-slate-700 tracking-widest uppercase focus:border-indigo-500 outline-none placeholder:text-slate-200"
                            />
                        </div>

                        {!opponent ? (
                            <button
                                onClick={handleJoinRoom}
                                disabled={joinCode.length < 3}
                                className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white border-b-4 border-indigo-700 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1 disabled:opacity-50"
                            >
                                Join Room
                            </button>
                        ) : (
                            <div className="bg-slate-50 p-6 rounded-2xl text-center border-2 border-slate-100">
                                <p className="text-sm font-bold text-slate-400 uppercase mb-4">Connected to Lobby</p>
                                <div className="flex justify-center items-center gap-6 mb-4">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-3xl mb-2 mx-auto overflow-hidden shadow-inner border-2 border-indigo-300">
                                            {generatedImageUrl ? (
                                                <img src={generatedImageUrl} alt="You" className="w-full h-full object-cover" />
                                            ) : (
                                                avatar
                                            )}
                                        </div>
                                        <p className="font-bold text-slate-700 text-sm">You</p>
                                    </div>
                                    <div className="text-2xl font-black text-slate-300">{isRaid ? '+' : 'VS'}</div>
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mb-2 mx-auto overflow-hidden shadow-inner border-2 border-red-300">
                                            {opponent.imageUrl ? (
                                                <img src={opponent.imageUrl} alt="Opponent" className="w-full h-full object-cover" />
                                            ) : (
                                                opponent.avatar
                                            )}
                                        </div>
                                        <p className="font-bold text-slate-700 text-sm">{opponent.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-indigo-500 font-bold bg-indigo-50 py-2 rounded-xl animate-pulse">
                                    <span>Waiting for host to start...</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};
