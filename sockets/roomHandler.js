const { randomUUID } = require('crypto');

const activeRooms = {};
const ROOM_CLEANUP_DELAY = 5 * 60 * 1000;
const MAX_ROOMS = 50;
const MAX_MOVES_HISTORY = 500;

function cleanupOldRooms() {
    const now = Date.now();
    for (const [roomId, room] of Object.entries(activeRooms)) {
        if (room.status === 'done' || room.status === 'waiting') {
            const lastActivity = room.lastActivity || 0;
            if (now - lastActivity > ROOM_CLEANUP_DELAY && room.players.length === 0) {
                delete activeRooms[roomId];
                console.log(`Cleaned up room: ${roomId}`);
            }
        }
    }
    if (Object.keys(activeRooms).length > MAX_ROOMS) {
        const sorted = Object.entries(activeRooms)
            .filter(([, r]) => r.players.length === 0)
            .sort((a, b) => (a[1].lastActivity || 0) - (b[1].lastActivity || 0));
        const toDelete = sorted.slice(0, Object.keys(activeRooms).length - MAX_ROOMS);
        toDelete.forEach(([id]) => delete activeRooms[id]);
    }
}
setInterval(cleanupOldRooms, 60000);

module.exports = (io, db) => {
    // Helper: build room list for clients
    function getRoomList() {
        return Object.entries(activeRooms).map(([id, room]) => ({
            id,
            playerCount: room.players.length,
            spectatorCount: room.spectators ? room.spectators.length : 0,
            status: room.status,
            players: room.players.map(p => ({ nickname: p.nickname, color: p.color }))
        }));
    }

    function broadcastRoomList() {
        io.emit('room_list', getRoomList());
    }

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.emit('room_list', getRoomList());

        socket.on('get_rooms', () => {
            socket.emit('room_list', getRoomList());
        });

        // Join or create room (as player)
        socket.on('join_room', ({ roomId, user }) => {
            socket.join(roomId);
            if (!activeRooms[roomId]) {
                if (Object.keys(activeRooms).length >= MAX_ROOMS) {
                    socket.emit('room_error', 'Server full, try again later');
                    return;
                }
                activeRooms[roomId] = {
                    players: [],
                    spectators: [],
                    moves: [],
                    status: 'waiting',
                    lastActivity: Date.now()
                };
            }

            const room = activeRooms[roomId];
            room.lastActivity = Date.now();
            if (room.players.length < 2 && !room.players.find(p => p.id === user.id)) {
                const color = room.players.length === 0 ? 'red' : 'black';
                room.players.push({ ...user, color, socketId: socket.id });
            }

            if (room.players.length === 2 && room.status === 'waiting') {
                room.status = 'playing';
                io.to(roomId).emit('game_start', { players: room.players });
            }

            io.to(roomId).emit('room_update', room);
            broadcastRoomList();
        });

        // Watch room (as spectator)
        socket.on('watch_room', ({ roomId }) => {
            socket.join(roomId);
            const room = activeRooms[roomId];
            if (!room) {
                socket.emit('watch_error', 'Room not found');
                return;
            }
            if (!room.spectators) room.spectators = [];
            if (!room.spectators.includes(socket.id)) {
                room.spectators.push(socket.id);
            }
            room.lastActivity = Date.now();
            socket.emit('watch_start', {
                players: room.players,
                moves: room.moves,
                status: room.status
            });
            broadcastRoomList();
        });

        // Make a move
        socket.on('make_move', ({ roomId, move }) => {
            socket.to(roomId).emit('move_made', move);
            if (activeRooms[roomId]) {
                const room = activeRooms[roomId];
                room.moves.push(move);
                room.lastActivity = Date.now();
                if (room.moves.length > MAX_MOVES_HISTORY) {
                    room.moves = room.moves.slice(-MAX_MOVES_HISTORY);
                }
            }
        });

        // End game and save to DB
        socket.on('game_end', ({ roomId, winner }) => {
            const room = activeRooms[roomId];
            if (room && room.status === 'playing') {
                room.status = 'done';
                room.lastActivity = Date.now();
                const gameId = randomUUID();
                const movesJson = JSON.stringify(room.moves);

                db.run('INSERT INTO games (game_id, room_id, winner, moves) VALUES (?, ?, ?, ?)',
                    [gameId, roomId, winner, movesJson],
                    (err) => {
                        if (err) console.error('Failed to save game', err);
                        io.to(roomId).emit('game_saved', { gameId });
                    }
                );
            }
        });

        // Leave room
        socket.on('leave_room', (roomId) => {
            socket.leave(roomId);
            const room = activeRooms[roomId];
            if (room) {
                room.players = room.players.filter(p => p.socketId !== socket.id);
                room.lastActivity = Date.now();
                io.to(roomId).emit('room_update', room);
                if (room.players.length === 0) {
                    delete activeRooms[roomId];
                }
                broadcastRoomList();
            }
        });

        socket.on('disconnect', () => {
            for (const roomId in activeRooms) {
                const room = activeRooms[roomId];
                // Remove as player
                const idx = room.players.findIndex(p => p.socketId === socket.id);
                if (idx !== -1) {
                    room.players.splice(idx, 1);
                    io.to(roomId).emit('player_disconnected', socket.id);
                    io.to(roomId).emit('room_update', room);
                }
                // Remove as spectator
                if (room.spectators) {
                    room.spectators = room.spectators.filter(id => id !== socket.id);
                }
                if (room.players.length === 0 && (!room.spectators || room.spectators.length === 0)) {
                    delete activeRooms[roomId];
                }
            }
            broadcastRoomList();
        });
    });
};
