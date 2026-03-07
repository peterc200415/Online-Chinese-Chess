const { randomUUID } = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');

const activeRooms = {};
const ROOM_CLEANUP_DELAY = 5 * 60 * 1000;
const MAX_ROOMS = 50;
const MAX_MOVES_HISTORY = 500;

let gameLogicPromise;

function loadGameLogic() {
    if (!gameLogicPromise) {
        const gameLogicUrl = pathToFileURL(path.resolve(__dirname, '../frontend/src/engine/GameLogic.js')).href;
        gameLogicPromise = import(gameLogicUrl);
    }
    return gameLogicPromise;
}

function cloneBoard(board) {
    return board.map(row => [...row]);
}

async function createInitialBoard() {
    const { STARTING_BOARD } = await loadGameLogic();
    return cloneBoard(STARTING_BOARD);
}

async function resetRoomState(room, status = 'waiting') {
    room.moves = [];
    room.board = await createInitialBoard();
    room.turn = 'red';
    room.status = status;
    room.winner = null;
}

function serializeState(room) {
    return {
        board: cloneBoard(room.board),
        turn: room.turn,
        status: room.status,
        moves: room.moves.slice(),
        winner: room.winner || null,
    };
}

async function finalizeGame(io, db, roomId, room, winner, result) {
    room.status = 'done';
    room.winner = winner;
    room.lastActivity = Date.now();

    const gameId = randomUUID();
    const movesJson = JSON.stringify(room.moves);

    db.run(
        'INSERT INTO games (game_id, room_id, winner, moves) VALUES (?, ?, ?, ?)',
        [gameId, roomId, winner, movesJson],
        (err) => {
            if (err) console.error('Failed to save game', err);
            io.to(roomId).emit('game_over', {
                gameId,
                winner,
                result,
                ...serializeState(room),
            });
        }
    );
}

function cleanupOldRooms() {
    const now = Date.now();
    for (const [roomId, room] of Object.entries(activeRooms)) {
        if ((room.status === 'done' || room.status === 'waiting') && room.players.length === 0) {
            const lastActivity = room.lastActivity || 0;
            if (now - lastActivity > ROOM_CLEANUP_DELAY) {
                delete activeRooms[roomId];
                console.log(`Cleaned up room: ${roomId}`);
            }
        }
    }

    if (Object.keys(activeRooms).length > MAX_ROOMS) {
        const sorted = Object.entries(activeRooms)
            .filter(([, room]) => room.players.length === 0)
            .sort((a, b) => (a[1].lastActivity || 0) - (b[1].lastActivity || 0));
        const toDelete = sorted.slice(0, Object.keys(activeRooms).length - MAX_ROOMS);
        toDelete.forEach(([roomId]) => delete activeRooms[roomId]);
    }
}
setInterval(cleanupOldRooms, 60000);

module.exports = (io, db) => {
    function getRoomList() {
        return Object.entries(activeRooms).map(([id, room]) => ({
            id,
            playerCount: room.players.length,
            spectatorCount: room.spectators ? room.spectators.length : 0,
            status: room.status,
            turn: room.turn,
            players: room.players.map(player => ({ nickname: player.nickname, color: player.color })),
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

        socket.on('join_room', async ({ roomId, user }) => {
            if (!roomId || !user?.id) {
                socket.emit('room_error', 'Invalid room or user');
                return;
            }

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
                    board: await createInitialBoard(),
                    turn: 'red',
                    winner: null,
                    lastActivity: Date.now(),
                };
            }

            const room = activeRooms[roomId];
            room.lastActivity = Date.now();

            if (!room.players.find(player => player.id === user.id) && room.players.length >= 2) {
                socket.emit('room_error', 'Room is full');
                return;
            }

            const existingPlayer = room.players.find(player => player.id === user.id);
            if (existingPlayer) {
                existingPlayer.socketId = socket.id;
            } else {
                const color = room.players.length === 0 ? 'red' : 'black';
                room.players.push({ ...user, color, socketId: socket.id });
            }

            if (room.players.length === 2) {
                await resetRoomState(room, 'playing');
                io.to(roomId).emit('game_start', {
                    players: room.players,
                    ...serializeState(room),
                });
            } else {
                io.to(roomId).emit('room_update', {
                    ...serializeState(room),
                    players: room.players,
                    spectators: room.spectators,
                });
            }

            broadcastRoomList();
        });

        socket.on('watch_room', ({ roomId }) => {
            const room = activeRooms[roomId];
            if (!room) {
                socket.emit('watch_error', 'Room not found');
                return;
            }

            socket.join(roomId);
            if (!room.spectators.includes(socket.id)) {
                room.spectators.push(socket.id);
            }
            room.lastActivity = Date.now();

            socket.emit('watch_start', {
                players: room.players,
                ...serializeState(room),
            });
            broadcastRoomList();
        });

        socket.on('make_move', async ({ roomId, move }) => {
            const room = activeRooms[roomId];
            if (!room || room.status !== 'playing') {
                socket.emit('room_error', 'Game is not active');
                return;
            }

            const player = room.players.find(entry => entry.socketId === socket.id);
            if (!player) {
                socket.emit('room_error', 'Only players can move');
                return;
            }
            if (player.color !== room.turn) {
                socket.emit('room_error', 'Not your turn');
                return;
            }

            const { isValidMove, applyMove, getGameStatus } = await loadGameLogic();
            if (!isValidMove(room.board, move.start, move.end, room.turn)) {
                socket.emit('room_error', 'Illegal move');
                return;
            }

            const targetPiece = room.board[move.end[0]][move.end[1]];
            room.board = applyMove(room.board, move);
            room.moves.push(move);
            if (room.moves.length > MAX_MOVES_HISTORY) {
                room.moves = room.moves.slice(-MAX_MOVES_HISTORY);
            }
            room.lastActivity = Date.now();

            if (targetPiece && targetPiece[1] === 'K') {
                await finalizeGame(io, db, roomId, room, player.color, 'capture');
                broadcastRoomList();
                return;
            }

            const nextTurn = room.turn === 'red' ? 'black' : 'red';
            const status = getGameStatus(room.board, nextTurn);
            if (status === 'checkmate') {
                room.turn = nextTurn;
                await finalizeGame(io, db, roomId, room, player.color, 'checkmate');
                broadcastRoomList();
                return;
            }
            if (status === 'stalemate') {
                room.turn = nextTurn;
                await finalizeGame(io, db, roomId, room, 'draw', 'stalemate');
                broadcastRoomList();
                return;
            }

            room.turn = nextTurn;
            io.to(roomId).emit('move_made', {
                move,
                ...serializeState(room),
            });
            broadcastRoomList();
        });

        socket.on('leave_room', async (roomId) => {
            socket.leave(roomId);
            const room = activeRooms[roomId];
            if (!room) return;

            room.players = room.players.filter(player => player.socketId !== socket.id);
            room.spectators = room.spectators.filter(id => id !== socket.id);
            room.lastActivity = Date.now();

            if (room.players.length === 0 && room.spectators.length === 0) {
                delete activeRooms[roomId];
            } else {
                if (room.players.length < 2) {
                    await resetRoomState(room, 'waiting');
                }
                io.to(roomId).emit('room_update', {
                    ...serializeState(room),
                    players: room.players,
                    spectators: room.spectators,
                });
            }

            broadcastRoomList();
        });

        socket.on('disconnect', async () => {
            for (const [roomId, room] of Object.entries(activeRooms)) {
                const playerIndex = room.players.findIndex(player => player.socketId === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    room.lastActivity = Date.now();
                    io.to(roomId).emit('player_disconnected', socket.id);

                    if (room.players.length === 0 && (!room.spectators || room.spectators.length === 0)) {
                        delete activeRooms[roomId];
                    } else {
                        await resetRoomState(room, 'waiting');
                        io.to(roomId).emit('room_update', {
                            ...serializeState(room),
                            players: room.players,
                            spectators: room.spectators,
                        });
                    }
                }

                if (room?.spectators) {
                    room.spectators = room.spectators.filter(id => id !== socket.id);
                    if (room.players.length === 0 && room.spectators.length === 0) {
                        delete activeRooms[roomId];
                    }
                }
            }
            broadcastRoomList();
        });
    });
};
