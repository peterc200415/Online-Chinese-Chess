const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./database');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    console.log('Restarting server in 3 seconds...');
    setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Proxy Ollama so frontend doesn't get strict CORS blocked
app.post('/api/ai_move', async (req, res) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const olRes = await fetch('http://10.10.10.191:11435/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
            signal: controller.signal
        });

        const data = await olRes.json();
        if (!olRes.ok) {
            return res.status(olRes.status).json(data);
        }

        res.json(data);
    } catch (err) {
        const status = err.name === 'AbortError' ? 504 : 500;
        res.status(status).json({ error: err.name === 'AbortError' ? 'Ollama request timed out' : err.message });
    } finally {
        clearTimeout(timeoutId);
    }
});

const authRoutes = require('./routes/auth');
const gamesRoutes = require('./routes/games');
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling'],
    perMessageDeflate: false
});

const MAX_CONNECTIONS = 100;
let connectionCount = 0;

io.use((socket, next) => {
    if (connectionCount >= MAX_CONNECTIONS) {
        return next(new Error('Server full'));
    }
    connectionCount++;
    socket.on('disconnect', () => connectionCount--);
    next();
});

// Delegate socket events to roomHandler
require('./sockets/roomHandler')(io, db);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
    console.log(`[Health] Server OK, connections: ${connectionCount}`);
}, 60000);
