import { PlayerStats, TopicStats, MissedQuestion } from '../types';

const STATS_KEY = 'battlenotes_player_stats';

const defaultStats: PlayerStats = {
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    totalGamesLost: 0,
    totalTurnsWon: 0,
    totalTurnsLost: 0,
    totalTimePlayedMs: 0,
    longestStreak: 0,
    topics: []
};

export const loadStats = (): PlayerStats => {
    try {
        const stored = localStorage.getItem(STATS_KEY);
        if (stored) {
            return JSON.parse(stored) as PlayerStats;
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
    return { ...defaultStats };
};

export const saveStats = (stats: PlayerStats): void => {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('Failed to save stats:', e);
    }
};

export const clearStats = (): void => {
    localStorage.removeItem(STATS_KEY);
};

// Get or create topic stats
const getOrCreateTopic = (stats: PlayerStats, topicName: string): TopicStats => {
    let topic = stats.topics.find(t => t.topicName === topicName);
    if (!topic) {
        topic = {
            topicName,
            firstPlayed: Date.now(),
            lastPlayed: Date.now(),
            gamesPlayed: 0,
            turnsWon: 0,
            turnsLost: 0,
            totalTimeMs: 0,
            missedQuestions: []
        };
        stats.topics.push(topic);
    }
    return topic;
};

// Record game start
export const recordGameStart = (topicName: string): PlayerStats => {
    const stats = loadStats();
    stats.totalGamesPlayed++;

    const topic = getOrCreateTopic(stats, topicName);
    topic.gamesPlayed++;
    topic.lastPlayed = Date.now();

    saveStats(stats);
    return stats;
};

// Record turn result
export const recordTurnResult = (
    topicName: string,
    won: boolean,
    currentStreak: number,
    question?: string,
    correctAnswer?: string,
    playerAnswer?: string
): PlayerStats => {
    const stats = loadStats();

    if (won) {
        stats.totalTurnsWon++;
    } else {
        stats.totalTurnsLost++;
    }

    // Update longest streak
    if (currentStreak > stats.longestStreak) {
        stats.longestStreak = currentStreak;
    }

    const topic = getOrCreateTopic(stats, topicName);
    if (won) {
        topic.turnsWon++;
    } else {
        topic.turnsLost++;
        // Record missed question
        if (question && correctAnswer && playerAnswer) {
            topic.missedQuestions.push({
                question,
                correctAnswer,
                playerAnswer,
                timestamp: Date.now()
            });
            // Keep only last 50 missed questions per topic
            if (topic.missedQuestions.length > 50) {
                topic.missedQuestions = topic.missedQuestions.slice(-50);
            }
        }
    }

    saveStats(stats);
    return stats;
};

// Record game end
export const recordGameEnd = (topicName: string, won: boolean, timePlayedMs: number): PlayerStats => {
    const stats = loadStats();

    if (won) {
        stats.totalGamesWon++;
    } else {
        stats.totalGamesLost++;
    }

    stats.totalTimePlayedMs += timePlayedMs;

    const topic = getOrCreateTopic(stats, topicName);
    topic.totalTimeMs += timePlayedMs;

    saveStats(stats);
    return stats;
};

// Clear missed questions for a topic
export const clearMissedQuestions = (topicName: string): PlayerStats => {
    const stats = loadStats();
    const topic = stats.topics.find(t => t.topicName === topicName);
    if (topic) {
        topic.missedQuestions = [];
        saveStats(stats);
    }
    return stats;
};

// Delete a topic entirely
export const deleteTopic = (topicName: string): PlayerStats => {
    const stats = loadStats();
    stats.topics = stats.topics.filter(t => t.topicName !== topicName);
    saveStats(stats);
    return stats;
};

// Format time for display
export const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
};

// Format date for display
export const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
};
