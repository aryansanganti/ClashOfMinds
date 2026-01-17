import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7 // 10 MB for large images
});

const PORT = 3001;
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Join Room - accepts { roomId, player, gameMode } from client
    socket.on('join_room', (data) => {
        // data.gameMode should be 'BATTLE' or 'RAID' (only used by creator)
        const { roomId, player, gameMode } = data;

        if (!player || !roomId) {
            console.error('Invalid join_room data:', data);
            return;
        }

        socket.join(roomId);

        let room = rooms.get(roomId);
        if (!room) {
            room = {
                id: roomId,
                host: player,
                opponent: null, // In Raid, this is Player 2
                gameMode: gameMode || 'BATTLE',
                bossHp: 100, // Default Boss HP for Raid
                bossMaxHp: 100
            };
            rooms.set(roomId, room);
            console.log(`Room ${roomId} created by ${player.name} in ${room.gameMode} mode`);
        } else {
            if (room.host && room.host.id !== player.id && !room.opponent) {
                room.opponent = player;
                console.log(`${player.name} joined room ${roomId}`);
            }
        }

        io.to(roomId).emit('room_update', room);
    });

    // Start Game Request
    socket.on('start_game_request', (data) => {
        console.log(`Game starting in room ${data.roomId}`);
        // If Raid, reset Boss HP? Or set it based on difficulty?
        // We'll let client handle visuals, server just tracks value if needed.
        io.to(data.roomId).emit('game_start', { config: data.gameConfig });
    });

    // Score Update (Battle Mode)
    socket.on('score_update', (data) => {
        io.to(data.roomId).emit('score_update', data);
    });

    // Boss Damage (Raid Mode)
    socket.on('boss_damage', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.gameMode === 'RAID') {
            room.bossHp = Math.max(0, room.bossHp - data.damage);
            io.to(data.roomId).emit('boss_update', { bossHp: room.bossHp, damage: data.damage, attackerId: data.playerId });

            if (room.bossHp <= 0) {
                io.to(data.roomId).emit('raid_victory', { finalHitBy: data.playerId });
            }
        }
    });

    // Chat Message
    socket.on('chat_message', (data) => {
        io.to(data.roomId).emit('chat_message', data);
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
});
