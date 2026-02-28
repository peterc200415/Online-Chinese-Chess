# ♟ Online Chinese Chess Platform (象棋對戰平台)

A web-based multiplayer Chinese Chess (Xiangqi) platform featuring **Real-Time PvP** matches, **Spectator Mode**, an enhanced **Minimax AI** engine, and a premium SVG-rendered game board with **Chinese/English i18n** support.

---

## Features

### 🎮 Game Modes
| Mode | Description |
|------|-------------|
| **Single Player vs AI** | Enhanced Minimax AI with transposition table, iterative deepening, and advanced evaluation |
| **1v1 Real-Time Multiplayer** | Create rooms, share Room IDs, play against friends over WebSocket |
| **👁 Spectator Mode** | Watch any ongoing game in real-time without participating |

### 🧠 AI Engine (Enhanced)
| Layer | Role | Details |
|-------|------|---------|
| **Minimax + α-β Pruning** | Core decision engine | 5-ply search with iterative deepening |
| **Transposition Table** | Search optimization | Avoids re-computing identical positions |
| **Quiescence Search** | Stability | 3-ply capture evaluation to prevent horizon effect |
| **Enhanced Evaluation** | Positional awareness | King safety, piece coordination, central control, PST for all pieces |
| **Piece-Square Tables** | Positional awareness | Pawns prefer crossing the river, Rooks prefer central files |

### ♟ Complete Xiangqi Rules
- Per-piece move generation: 車(Rook), 馬(Knight), 炮(Cannon), 象(Bishop), 士(Advisor), 將/帥(King), 兵/卒(Pawn)
- Blocking rules: Horse leg (卡馬腿), Elephant eye (塞象眼), Cannon platform (炮打隔山)
- Palace restrictions, river crossing, Flying General (飛將)
- **Check & Checkmate detection**: Cannot move into check, stalemate detection
- Win detection on King capture with animated victory overlay

### 🌐 UI & UX
- **i18n**: Full Chinese ↔ English toggle (floating button, instant switch)
- **Room List**: Browse all active rooms with status, players, and spectator count
- **Spectator Mode**: Watch games live with real-time board sync + move replay
- **Victory Overlay**: Glassmorphism modal with 🏆 animation
- **AI Thinking Indicator**: Animated glow effect during AI computation
- **Board Size Slider**: Adjustable board size (35-70) in real-time
- **Modern Lobby UI**: Floating logo animation, gradient buttons, player chips
- **Responsive Design**: Mobile-first layout, auto-scaling SVG board
- **SVG Board**: Wood-grain background, white grid, traditional piece names

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vue 3 + Vite |
| Backend API | Node.js + Express |
| Real-Time | Socket.io |
| Database | SQLite3 |
| Auth | JWT + bcrypt |
| Process Manager | PM2 |
| AI | Enhanced Minimax with transposition table |

---

## Project Structure

```
chinese-chcess/
├── server.js                  # Express + Socket.io backend
├── database.js                # SQLite schema & connection
├── routes/
│   ├── auth.js               # Login & register API
│   └── games.js              # Game history API
├── sockets/
│   └── roomHandler.js        # Room management + spectator logic
├── chess-server.service       # systemd service file
├── chess-frontend.service    # systemd service file
└── frontend/
    ├── vite.config.js        # Dev server proxy (/api → 3000)
    └── src/
        ├── App.vue            # Main app (lobby, rooms, spectator, i18n)
        ├── style.css         # Global styles + animations
        ├── components/
        │   └── ChessBoard.vue # SVG board renderer with dynamic size
        └── engine/
            ├── GameLogic.js   # Full Xiangqi rules & evaluation
            ├── MinimaxAI.js   # Enhanced Minimax + TT + quiescence
            └── OllamaAI.js    # Hybrid Ollama + Minimax bridge
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- *(Optional)* [PM2](https://pm2.keymetrics.io/) for production process management

### Development Mode

#### 1. Start Backend
```bash
npm install
node server.js
```
Backend runs on `http://localhost:3000`.

#### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`. API requests are auto-proxied to port 3000.

### Production Mode (Recommended)

#### 1. Build Frontend
```bash
cd frontend
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

#### 2. Run with PM2
```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start server.js --name chinese-chess-api

# Start frontend (after building)
pm2 start npm --name chinese-chess-frontend -- run preview --prefix frontend -- --host 0.0.0.0 --port 5173

# Save process list for auto-restart
pm2 save
```

### 3. LAN / Domain Access
- **LAN**: Other devices connect via `http://<your-ip>:5173`
- **Domain**: Configure nginx to reverse proxy to port 5173

---

## Multiplayer Guide
1. Open the app in **two browser windows**
2. **Register & Login** in both
3. Window A: Click **New Room** → enters waiting room → copy Room ID
4. Window B: Paste Room ID → click **Join Room**
5. Game starts automatically!

## Spectator Guide
1. **Login** and check the room list in the lobby
2. Click **👁 Watch** on any room card
3. The current board state is replayed instantly — watch moves in real-time!

---

## Board Customization
- Use the **board size slider** in game view to adjust the board size (35-70)
- Changes apply in real-time

---

## License
MIT
