const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./database'); // Initialize DB

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
    try {
        const olRes = await fetch('http://10.10.10.191:11435/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await olRes.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
    }
});

// Delegate socket events to roomHandler
require('./sockets/roomHandler')(io, db);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
