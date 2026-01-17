import React, { createContext, useContext, useEffect, useState } from 'react';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { MissedQuestion } from '../../types';

interface KnowledgeContextType {
    shards: MissedQuestion[];
    loading: boolean;
    addShard: (shard: MissedQuestion) => Promise<void>;
    markShardResolved: (shardId: string) => Promise<void>;
    refreshShards: () => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

export const useKnowledge = () => {
    const context = useContext(KnowledgeContext);
    if (!context) {
        throw new Error('useKnowledge must be used within a KnowledgeProvider');
    }
    return context;
};

export const KnowledgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [shards, setShards] = useState<MissedQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const db = getFirestore();

    const refreshShards = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            const q = query(collection(db, `users/${currentUser.uid}/shards`));
            const querySnapshot = await getDocs(q);
            const fetchedShards: MissedQuestion[] = [];
            querySnapshot.forEach((doc) => {
                fetchedShards.push({ id: doc.id, ...doc.data() } as MissedQuestion);
            });
            console.log(`[KnowledgeContext] Loaded ${fetchedShards.length} shards`);
            setShards(fetchedShards);
        } catch (error) {
            console.error("[KnowledgeContext] Error fetching shards:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            refreshShards();
        } else {
            setShards([]);
        }
    }, [currentUser]);

    const addShard = async (shard: MissedQuestion) => {
        if (!currentUser) return;

        // Check if duplicate exists (simple check by question text)
        if (shards.some(s => s.question === shard.question)) {
            console.log("[KnowledgeContext] Duplicate shard ignored:", shard.question);
            return;
        }

        try {
            // Add timestamp if missing
            const newShard = {
                ...shard,
                timestamp: shard.timestamp || Date.now()
            };

            await addDoc(collection(db, `users/${currentUser.uid}/shards`), newShard);
            console.log("[KnowledgeContext] Shard added:", newShard.question);
            // Refresh local state without full fetch for speed
            setShards(prev => [...prev, newShard]);
        } catch (error) {
            console.error("[KnowledgeContext] Error adding shard:", error);
        }
    };

    const markShardResolved = async (shardId: string) => {
        if (!currentUser) return;
        try {
            if (shardId) {
                await deleteDoc(doc(db, `users/${currentUser.uid}/shards`, shardId));
                setShards(prev => prev.filter(s => (s as any).id !== shardId));
                console.log("[KnowledgeContext] Shard resolved:", shardId);
            }
        } catch (error) {
            console.error("[KnowledgeContext] Error resolving shard:", error);
        }
    };

    const value = {
        shards,
        loading,
        addShard,
        markShardResolved,
        refreshShards
    };

    return (
        <KnowledgeContext.Provider value={value}>
            {children}
        </KnowledgeContext.Provider>
    );
};
