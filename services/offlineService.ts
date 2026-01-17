import { InitGameParams, FullGameManifest, OfflineBattlePack } from '../types';
import { initializeGame } from './geminiService';

const STORAGE_KEY = 'battlenotes_offline_battles';



export const saveBattleForOffline = async (params: InitGameParams): Promise<void> => {
    try {
        // 1. Generate the game fully (online req)
        const manifest = await initializeGame(params);

        // 2. Create the pack (Questions ONLY)
        const pack: OfflineBattlePack = {
            id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            topic: params.topic || 'Unknown Topic',
            difficulty: params.difficulty,
            manifest: manifest
        };

        // 3. Save to LocalStorage
        const existing = getOfflineBattles();
        existing.push(pack);

        // Compress/Limit check? For now just save. 
        // Note: extensive Base64 images might hit storage limits (5-10MB).
        // Real app should use IndexedDB, but localStorage is requested/simpler for MVP.
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        } catch (e) {
            console.error("Storage Quota Exceeded", e);
            throw new Error("Phone memory full! Delete old battles first.");
        }

    } catch (e) {
        console.error("Failed to save offline battle", e);
        throw e;
    }
};

export const getOfflineBattles = (): OfflineBattlePack[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("Failed to load offline battles", e);
        return [];
    }
};

export const deleteOfflineBattle = (id: string): void => {
    const existing = getOfflineBattles();
    const updated = existing.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const clearAllOfflineBattles = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};
