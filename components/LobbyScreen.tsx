import React, { useState } from 'react';
import { UserGroupIcon, PlusIcon, PlayIcon, TrashIcon } from '@heroicons/react/24/solid';

interface LobbyScreenProps {
    topic: string;
    onStartRaid: (friends: string[]) => void;
    onBack: () => void;
    isLoading?: boolean;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ topic, onStartRaid, onBack, isLoading = false }) => {
    const [friends, setFriends] = useState<string[]>([]);
    const [newFriendName, setNewFriendName] = useState('');

    const handleAddFriend = () => {
        if (!newFriendName.trim()) return;
        setFriends([...friends, newFriendName.trim()]);
        setNewFriendName('');
    };

    const removeFriend = (index: number) => {
        setFriends(friends.filter((_, i) => i !== index));
    };

    const handleStart = () => {
        if (friends.length === 0) {
            alert("Invite at least one friend to start a Raid!");
            return;
        }
        onStartRaid(friends);
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-lg bg-white rounded-[2rem] border-b-8 border-slate-200 p-6 md:p-8 shadow-xl relative animate-fadeIn">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-block p-4 rounded-3xl bg-purple-500 text-white mb-4 shadow-lg rotate-3">
                        <UserGroupIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Raid Lobby</h2>
                    <p className="text-slate-500 font-bold">
                        Topic: <span className="text-purple-600">{topic || "Unknown Topic"}</span>
                    </p>
                </div>

                {/* Friend List */}
                <div className="mb-8">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                        Your Party ({friends.length + 1}/4)
                    </label>

                    <div className="space-y-3">
                        {/* User Card */}
                        <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl border-2 border-slate-200 opacity-70">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-xl">
                                👤
                            </div>
                            <div className="font-bold text-slate-700">You (Leader)</div>
                        </div>

                        {/* Friends */}
                        {friends.map((friend, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border-2 border-slate-100 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl font-black">
                                        {friend.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="font-bold text-slate-700">{friend}</div>
                                </div>
                                <button
                                    onClick={() => removeFriend(idx)}
                                    className="text-slate-300 hover:text-red-400 transition-colors"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ))}

                        {/* Add Friend Input */}
                        {friends.length < 3 && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newFriendName}
                                    onChange={(e) => setNewFriendName(e.target.value)}
                                    placeholder="Enter friend's name..."
                                    className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 focus:border-purple-400 outline-none transition-colors"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                                />
                                <button
                                    onClick={handleAddFriend}
                                    disabled={!newFriendName.trim()}
                                    className="p-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 transition-colors"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white border-b-4 border-indigo-800 rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg transition-all active:border-b-0 active:translate-y-1 disabled:opacity-70 disabled:grayscale disabled:pointer-events-none"
                    >
                        <div className="flex items-center justify-center gap-2">
                            {isLoading ? (
                                <>
                                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Starting Raid...</span>
                                </>
                            ) : (
                                <>
                                    <PlayIcon className="w-6 h-6" />
                                    <span>Start Raid</span>
                                </>
                            )}
                        </div>
                    </button>

                    <button
                        onClick={onBack}
                        className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                    >
                        Back to Menu
                    </button>
                </div>

            </div>
        </div>
    );
};
