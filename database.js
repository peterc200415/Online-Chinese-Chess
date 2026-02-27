const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chess.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      nickname TEXT,
      rating INTEGER DEFAULT 1000
    )
  `);

  // Rooms table
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'waiting', -- waiting, playing, done
      player_red INTEGER,
      player_black INTEGER,
      FOREIGN KEY(player_red) REFERENCES users(id),
      FOREIGN KEY(player_black) REFERENCES users(id)
    )
  `);

  // Games table (replays)
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      room_id TEXT,
      winner TEXT, -- 'red', 'black', 'draw'
      moves TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
