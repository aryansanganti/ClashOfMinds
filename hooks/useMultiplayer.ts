import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PlayerProfile } from '../types';

// Explicit connection to backend server
const SERVER_URL = 'http://localhost:3001';

export const useMultiplayer = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<{ playerId: string, message: string }[]>([]);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const s = io(SERVER_URL, {
            transports: ['websocket', 'polling'], // Try websocket first
        });
        socketRef.current = s;
        setSocket(s);

        s.on('connect', () => {
            console.log('Connected to socket server:', s.id);
            setIsConnected(true);
        });

        s.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        s.on('disconnect', () => {
            console.log('Disconnected from socket server');
            setIsConnected(false);
        });

        s.on('chat_message', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        return () => {
            s.disconnect();
        };
    }, []);

    const joinRoom = (roomId: string, player: PlayerProfile, gameMode: 'BATTLE' | 'RAID' = 'BATTLE') => {
        socketRef.current?.emit('join_room', { roomId, player, gameMode });
    };

    const updateScore = (roomId: string, playerId: string, score: number) => {
        socketRef.current?.emit('score_update', { roomId, playerId, score });
    };

    const damageBoss = (roomId: string, playerId: string, damage: number) => {
        socketRef.current?.emit('boss_damage', { roomId, playerId, damage });
    };

    const sendChat = (roomId: string, playerId: string, message: string) => {
        socketRef.current?.emit('chat_message', { roomId, playerId, message });
    };

    return {
        socket,
        isConnected,
        messages,
        joinRoom,
        updateScore,
        damageBoss,
        sendChat
    };
};
