import { GameState, PreloadedTurn } from '../types';

export interface SavedGameData {
    gameState: GameState;
    preloadedTurns: PreloadedTurn[];
    timestamp: number;
    userId: string;
    // Images are NOT saved - they will be regenerated on resume to avoid quota issues
}

const SAVE_KEY_PREFIX = 'clash_of_minds_save_';

/**
 * Save the current game state to localStorage
 */
export const saveGameState = (userId: string, data: SavedGameData): void => {
    try {
        const key = `${SAVE_KEY_PREFIX}${userId}`;
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        console.log('[SaveService] Game saved successfully');
    } catch (error) {
        console.error('[SaveService] Error saving game:', error);
        // If storage quota exceeded, clear old saves
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn('[SaveService] Storage quota exceeded, clearing old saves');
            clearAllSaves();
            // Try again
            try {
                const key = `${SAVE_KEY_PREFIX}${userId}`;
                localStorage.setItem(key, JSON.stringify(data));
            } catch (retryError) {
                console.error('[SaveService] Still failed after clearing:', retryError);
            }
        }
    }
};

/**
 * Load saved game state from localStorage
 */
export const loadGameState = (userId: string): SavedGameData | null => {
    try {
        const key = `${SAVE_KEY_PREFIX}${userId}`;
        const serialized = localStorage.getItem(key);

        if (!serialized) {
            return null;
        }

        const data: SavedGameData = JSON.parse(serialized);

        // Validate that the save belongs to this user
        if (data.userId !== userId) {
            console.warn('[SaveService] Save data user mismatch, clearing');
            clearSavedGame(userId);
            return null;
        }

        console.log('[SaveService] Game loaded successfully');
        return data;
    } catch (error) {
        console.error('[SaveService] Error loading game:', error);
        return null;
    }
};

/**
 * Clear saved game for a specific user
 */
export const clearSavedGame = (userId: string): void => {
    try {
        const key = `${SAVE_KEY_PREFIX}${userId}`;
        localStorage.removeItem(key);
        console.log('[SaveService] Game save cleared');
    } catch (error) {
        console.error('[SaveService] Error clearing save:', error);
    }
};

/**
 * Check if a saved game exists for a user
 */
export const hasSavedGame = (userId: string): boolean => {
    try {
        const key = `${SAVE_KEY_PREFIX}${userId}`;
        return localStorage.getItem(key) !== null;
    } catch (error) {
        console.error('[SaveService] Error checking for save:', error);
        return false;
    }
};

/**
 * Clear all game saves (used when quota exceeded)
 */
const clearAllSaves = (): void => {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(SAVE_KEY_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[SaveService] Cleared ${keysToRemove.length} old saves`);
    } catch (error) {
        console.error('[SaveService] Error clearing all saves:', error);
    }
};
