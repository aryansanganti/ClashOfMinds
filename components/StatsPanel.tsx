import React, { useState } from 'react';
import { PlayerStats, TopicStats } from '../types';
import {
    clearMissedQuestions,
    deleteTopic,
    formatTime,
    formatDate,
    clearStats
} from '../services/statsService';
import {
    TrashIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

interface StatsPanelProps {
    stats: PlayerStats;
    onStatsChange: (stats: PlayerStats) => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, onStatsChange }) => {
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const winRate = stats.totalGamesPlayed > 0
        ? Math.round((stats.totalGamesWon / stats.totalGamesPlayed) * 100)
        : 0;

    const turnAccuracy = (stats.totalTurnsWon + stats.totalTurnsLost) > 0
        ? Math.round((stats.totalTurnsWon / (stats.totalTurnsWon + stats.totalTurnsLost)) * 100)
        : 0;

    const handleClearMissed = (topicName: string) => {
        const newStats = clearMissedQuestions(topicName);
        onStatsChange(newStats);
    };

    const handleDeleteTopic = (topicName: string) => {
        const newStats = deleteTopic(topicName);
        onStatsChange(newStats);
        setExpandedTopic(null);
    };

    const handleClearAll = () => {
        clearStats();
        onStatsChange({
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            totalGamesLost: 0,
            totalTurnsWon: 0,
            totalTurnsLost: 0,
            totalTimePlayedMs: 0,
            longestStreak: 0,
            topics: []
        });
        setShowClearConfirm(false);
    };

    const getTopicAccuracy = (topic: TopicStats) => {
        const total = topic.turnsWon + topic.turnsLost;
        return total > 0 ? Math.round((topic.turnsWon / total) * 100) : 0;
    };

    return (
        <div className="space-y-6 animate-fadeIn mt-10">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2">Player Stats</h3>

            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="text-3xl font-black">{stats.totalGamesPlayed}</div>
                    <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Games Played</div>
                </div>
                <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="text-3xl font-black">{winRate}%</div>
                    <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Win Rate</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="text-3xl font-black">{stats.longestStreak}</div>
                    <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Best Streak</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="text-3xl font-black">{formatTime(stats.totalTimePlayedMs)}</div>
                    <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Time Played</div>
                </div>
            </div>

            {/* Detailed Stats */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Questions Answered</span>
                    <span className="text-sm font-black text-slate-700">{stats.totalTurnsWon + stats.totalTurnsLost}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Correct Answers</span>
                    <span className="text-sm font-black text-green-600">{stats.totalTurnsWon}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Wrong Answers</span>
                    <span className="text-sm font-black text-red-500">{stats.totalTurnsLost}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Accuracy</span>
                    <span className="text-sm font-black text-sky-600">{turnAccuracy}%</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Games Won</span>
                    <span className="text-sm font-black text-green-600">{stats.totalGamesWon}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Games Lost</span>
                    <span className="text-sm font-black text-red-500">{stats.totalGamesLost}</span>
                </div>
            </div>

            {/* Topics Section */}
            {stats.topics.length > 0 && (
                <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Topics Studied ({stats.topics.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {stats.topics.map((topic) => (
                            <div key={topic.topicName} className="bg-slate-50 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setExpandedTopic(expandedTopic === topic.topicName ? null : topic.topicName)}
                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex-1 text-left">
                                        <div className="font-bold text-slate-700 text-sm truncate max-w-[200px]">
                                            {topic.topicName.length > 30 ? topic.topicName.substring(0, 30) + '...' : topic.topicName}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold">
                                            {topic.gamesPlayed} games • {getTopicAccuracy(topic)}% accuracy
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {topic.missedQuestions.length > 0 && (
                                            <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {topic.missedQuestions.length} to review
                                            </span>
                                        )}
                                        {expandedTopic === topic.topicName ? (
                                            <ChevronUpIcon className="w-4 h-4 text-slate-400" />
                                        ) : (
                                            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                                        )}
                                    </div>
                                </button>

                                {expandedTopic === topic.topicName && (
                                    <div className="px-3 pb-3 space-y-3 border-t border-slate-200">
                                        {/* Topic Details */}
                                        <div className="grid grid-cols-2 gap-2 pt-3">
                                            <div className="text-[10px]">
                                                <span className="text-slate-400 font-bold">First played:</span>
                                                <span className="text-slate-600 font-bold ml-1">{formatDate(topic.firstPlayed)}</span>
                                            </div>
                                            <div className="text-[10px]">
                                                <span className="text-slate-400 font-bold">Last played:</span>
                                                <span className="text-slate-600 font-bold ml-1">{formatDate(topic.lastPlayed)}</span>
                                            </div>
                                            <div className="text-[10px]">
                                                <span className="text-slate-400 font-bold">Time spent:</span>
                                                <span className="text-slate-600 font-bold ml-1">{formatTime(topic.totalTimeMs)}</span>
                                            </div>
                                            <div className="text-[10px]">
                                                <span className="text-slate-400 font-bold">Correct/Wrong:</span>
                                                <span className="text-green-600 font-bold ml-1">{topic.turnsWon}</span>
                                                <span className="text-slate-400 font-bold">/</span>
                                                <span className="text-red-500 font-bold">{topic.turnsLost}</span>
                                            </div>
                                        </div>

                                        {/* Missed Questions */}
                                        {topic.missedQuestions.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-red-500 uppercase">Questions to Review</span>
                                                    <button
                                                        onClick={() => handleClearMissed(topic.topicName)}
                                                        className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700"
                                                    >
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                        Clear All
                                                    </button>
                                                </div>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {topic.missedQuestions.slice(-5).map((q, idx) => (
                                                        <div key={idx} className="bg-white rounded-lg p-2 text-[10px]">
                                                            <div className="font-bold text-slate-700 mb-1">{q.question}</div>
                                                            <div className="flex gap-2">
                                                                <span className="text-red-500">Your answer: {q.playerAnswer}</span>
                                                                <span className="text-green-600">Correct: {q.correctAnswer}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Delete Topic */}
                                        <button
                                            onClick={() => handleDeleteTopic(topic.topicName)}
                                            className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-600 py-1"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                            Delete Topic Data
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No Stats Yet */}
            {stats.totalGamesPlayed === 0 && (
                <div className="text-center py-8">
                    <div className="text-4xl mb-2">🎮</div>
                    <div className="text-slate-400 font-bold text-sm">No games played yet!</div>
                    <div className="text-slate-300 text-xs">Start a battle to track your progress</div>
                </div>
            )}

            {/* Clear All Data */}
            {stats.totalGamesPlayed > 0 && (
                <div className="pt-2">
                    {showClearConfirm ? (
                        <div className="bg-red-50 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-red-600">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                <span className="font-bold text-sm">Delete all stats?</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleClearAll}
                                    className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-xs transition-all"
                                >
                                    Yes, Delete
                                </button>
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowClearConfirm(true)}
                            className="w-full py-2 text-red-400 hover:text-red-500 font-bold text-xs transition-colors"
                        >
                            Clear All Stats
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
