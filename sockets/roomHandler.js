const { randomUUID } = require('crypto');

// Temporary in-memory state for active rooms instead of constantly hitting DB for moves
const activeRooms = {};

module.exports = (io, db) => {
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Join or create room
        socket.on('join_room', ({ roomId, user }) => {
            socket.join(roomId);
            if (!activeRooms[roomId]) {
                activeRooms[roomId] = {
                    players: [],
                    moves: [],
                    status: 'waiting'
                };
            }

            const room = activeRooms[roomId];
            // prevent multiple joins from same user overriding side
            if (room.players.length < 2 && !room.players.find(p => p.id === user.id)) {
                // First player is red, second is black
                const color = room.players.length === 0 ? 'red' : 'black';
                room.players.push({ ...user, color, socketId: socket.id });
            }

            if (room.players.length === 2 && room.status === 'waiting') {
                room.status = 'playing';
                io.to(roomId).emit('game_start', { players: room.players });
            }

            io.to(roomId).emit('room_update', room);
        });

        // Make a move
        socket.on('make_move', ({ roomId, move }) => {
            socket.to(roomId).emit('move_made', move);
            if (activeRooms[roomId]) {
                activeRooms[roomId].moves.push(move);
            }
        });

        // End game and save to DB
        socket.on('game_end', ({ roomId, winner }) => {
            const room = activeRooms[roomId];
            if (room && room.status === 'playing') {
                room.status = 'done';
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
                io.to(roomId).emit('room_update', room);
                if (room.players.length === 0) {
                    delete activeRooms[roomId];
                }
            }
        });

        socket.on('disconnect', () => {
            // Find room user was in and remove them
            for (const roomId in activeRooms) {
                const room = activeRooms[roomId];
                const idx = room.players.findIndex(p => p.socketId === socket.id);
                if (idx !== -1) {
                    room.players.splice(idx, 1);
                    io.to(roomId).emit('player_disconnected', socket.id);
                    io.to(roomId).emit('room_update', room);
                    if (room.players.length === 0) {
                        delete activeRooms[roomId];
                    }
                }
            }
        });
    });
};
