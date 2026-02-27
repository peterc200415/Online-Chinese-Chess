# ♟ Online Chinese Chess Platform (象棋對戰平台)

A web-based multiplayer Chinese Chess (Xiangqi) platform featuring **Real-Time PvP** matches, **Spectator Mode**, a hybrid **Minimax + LLM AI** engine, and a premium SVG-rendered game board with **Chinese/English i18n** support.

---

## Features

### 🎮 Game Modes
| Mode | Description |
|------|-------------|
| **Single Player vs AI** | Hybrid engine: Minimax (depth 4 + quiescence) + optional Ollama LLM advisor |
| **1v1 Real-Time Multiplayer** | Create rooms, share Room IDs, play against friends over WebSocket |
| **👁 Spectator Mode** | Watch any ongoing game in real-time without participating |

### 🧠 AI Engine (Hybrid Architecture)
| Layer | Role | Details |
|-------|------|---------|
| **Minimax + α-β Pruning** | Core decision engine | 4-ply search + 3-ply quiescence for captures |
| **Piece-Square Tables** | Positional awareness | Pawns prefer crossing the river, Rooks prefer central files |
| **MVV-LVA Move Ordering** | Search efficiency | Prioritizes capturing high-value pieces first |
| **Ollama LLM** *(optional)* | Strategic advisor | Sends board state to `llama3.1:8b` via backend proxy |

### ♟ Complete Xiangqi Rules
- Per-piece move generation: 車(Rook), 馬(Knight), 炮(Cannon), 象(Bishop), 士(Advisor), 將/帥(King), 兵/卒(Pawn)
- Blocking rules: Horse leg (卡馬腿), Elephant eye (塞象眼), Cannon platform (炮打隔山)
- Palace restrictions, river crossing, Flying General (飛將)
- Win detection on King capture with animated victory overlay

### 🌐 UI & UX
- **i18n**: Full Chinese ↔ English toggle (floating button, instant switch)
- **Room List**: Browse all active rooms with status, players, and spectator count
- **Spectator Mode**: Watch games live with real-time board sync + move replay
- **Victory Overlay**: Glassmorphism modal with 🏆 animation
- **AI Thinking Indicator**: `🤔 AI 思考中...` during AI computation
- **Waiting Room**: Spinner + Room ID display while waiting for opponent
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
| AI (local) | Minimax with α-β Pruning |
| AI (LLM) | Ollama API (`llama3.1:8b`) |

---

## Project Structure

```
chinese-chcess/
├── server.js                  # Express + Socket.io backend + Ollama proxy
├── database.js                # SQLite schema & connection
├── routes/
│   ├── auth.js                # Login & register API
│   └── games.js               # Game history API
├── sockets/
│   └── roomHandler.js         # Room management + spectator logic
└── frontend/
    ├── vite.config.js         # Dev server proxy (/api → 3000)
    └── src/
        ├── App.vue            # Main app (lobby, rooms, spectator, i18n)
        ├── assets/
        │   └── style.css      # Global styles + responsive + animations
        ├── components/
        │   └── ChessBoard.vue # SVG board renderer
        └── engine/
            ├── GameLogic.js   # Full Xiangqi rules & evaluation
            ├── MinimaxAI.js   # Minimax + quiescence search
            └── OllamaAI.js   # Hybrid Ollama + Minimax bridge
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- *(Optional)* [Ollama](https://ollama.ai/) running `llama3.1:8b` for LLM advisor mode

### 1. Start Backend
```bash
npm install
node server.js
```
Backend runs on `http://localhost:3000`.

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`. API requests are auto-proxied to port 3000.

### 3. LAN / Domain Access
- **LAN**: Other devices connect via `http://<your-ip>:5173`
- **Domain**: Configure nginx to reverse proxy to port 5173 (Vite auto-proxies `/api` and `/socket.io` to backend)

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

## License
MIT
