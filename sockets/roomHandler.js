const { randomUUID } = require('crypto');

// Temporary in-memory state for active rooms instead of constantly hitting DB for moves
const activeRooms = {};

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
                activeRooms[roomId] = {
                    players: [],
                    spectators: [],
                    moves: [],
                    status: 'waiting'
                };
            }

            const room = activeRooms[roomId];
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
            // Send current game state: replay all moves so spectator sees current board
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
