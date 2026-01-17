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

    // Join Room - accepts { roomId, player } from client
    socket.on('join_room', (data) => {
        const { roomId, player } = data; // Changed from 'profile' to 'player'

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
                opponent: null
            };
            rooms.set(roomId, room);
            console.log(`Room ${roomId} created by ${player.name}`);
        } else {
            if (room.host && room.host.id !== player.id && !room.opponent) {
                room.opponent = player;
                console.log(`${player.name} joined room ${roomId} as opponent`);
            }
        }

        io.to(roomId).emit('room_update', room);
    });

    // Start Game Request
    socket.on('start_game_request', (data) => {
        console.log(`Game starting in room ${data.roomId}`);
        io.to(data.roomId).emit('game_start', { config: data.gameConfig });
    });

    // Score Update
    socket.on('score_update', (data) => {
        io.to(data.roomId).emit('score_update', data);
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
