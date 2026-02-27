const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

router.post('/register', async (req, res) => {
    const { email, password, nickname } = req.body;
    if (!email || !password || !nickname) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)',
            [email, hash, nickname],
            function (err) {
                if (err) return res.status(400).json({ error: 'Email already exists' });
                res.json({ message: 'User registered', id: this.lastID });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email, nickname: user.nickname }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Logged in', token, user: { id: user.id, nickname: user.nickname, rating: user.rating } });
    });
});

module.exports = router;
