import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

// Health check endpoint for hosting services
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Clash of Minds Multiplayer Server' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', rooms: rooms.size });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins (configure specific origins in production)
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7 // 10 MB for large images
});

// Use PORT from environment (for cloud hosting) or default to 3001
const PORT = process.env.PORT || 3001;
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] User Connected: ${socket.id}`);

    // Join Room
    socket.on('join_room', (data) => {
        const { roomId, player } = data;

        if (!player || !roomId) {
            console.error('Invalid join_room data:', data);
            socket.emit('error', { message: 'Invalid room data' });
            return;
        }

        socket.join(roomId);

        let room = rooms.get(roomId);
        if (!room) {
            room = {
                id: roomId,
                host: player,
                opponent: null,
                createdAt: Date.now()
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
        console.log(`[${new Date().toISOString()}] User Disconnected:`, socket.id);
    });
});

// Cleanup old rooms every 30 minutes
setInterval(() => {
    const now = Date.now();
    const OLD_ROOM_THRESHOLD = 60 * 60 * 1000; // 1 hour

    for (const [roomId, room] of rooms.entries()) {
        if (now - room.createdAt > OLD_ROOM_THRESHOLD) {
            rooms.delete(roomId);
            console.log(`Cleaned up old room: ${roomId}`);
        }
    }
}, 30 * 60 * 1000);

httpServer.listen(PORT, () => {
    console.log(`🚀 Clash of Minds Multiplayer Server running on port ${PORT}`);
});
