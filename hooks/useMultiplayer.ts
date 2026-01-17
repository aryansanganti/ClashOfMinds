import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PlayerProfile } from '../types';

// Use environment variable for server URL, fallback to localhost for dev
const SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';

export const useMultiplayer = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<{ playerId: string, message: string }[]>([]);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        console.log('[Multiplayer] Connecting to:', SERVER_URL);
        const s = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
        });
        socketRef.current = s;
        setSocket(s);

        s.on('connect', () => {
            console.log('[Multiplayer] Connected:', s.id);
            setIsConnected(true);
        });

        s.on('connect_error', (err) => {
            console.error('[Multiplayer] Connection error:', err.message);
        });

        s.on('disconnect', () => {
            console.log('[Multiplayer] Disconnected');
            setIsConnected(false);
        });

        s.on('chat_message', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        return () => {
            s.disconnect();
        };
    }, []);

    const joinRoom = (roomId: string, player: PlayerProfile) => {
        socketRef.current?.emit('join_room', { roomId, player });
    };

    const updateScore = (roomId: string, playerId: string, score: number) => {
        socketRef.current?.emit('score_update', { roomId, playerId, score });
    };

    const sendChat = (roomId: string, playerId: string, message: string) => {
        socketRef.current?.emit('chat_message', { roomId, playerId, message });
    };

    const requestGameStart = (roomId: string, gameConfig: any) => {
        socketRef.current?.emit('start_game_request', { roomId, gameConfig });
    };

    return {
        socket,
        isConnected,
        messages,
        joinRoom,
        updateScore,
        sendChat,
        requestGameStart
    };
};
