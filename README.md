# Online Chinese Chess Platform

A web-based Chinese Chess (Xiangqi) platform with real-time multiplayer, spectator mode, single-player AI, bilingual UI, and LAN/domain deployment support.

## Features

### Game Modes
- Single Player vs AI
- 1v1 real-time multiplayer over Socket.IO
- Spectator mode with live move replay

### AI Engine
- Minimax with alpha-beta pruning
- Iterative deepening and transposition table caching
- Quiescence search for tactical stability
- Ollama-assisted move suggestion with timeout-safe fallback to Minimax
- Frontend timeout handling so the "AI thinking" state always clears

### Gameplay
- Full Xiangqi move rules
- Check, checkmate, stalemate, and king-capture win detection
- Room list, room join/create flow, and spectator sync
- Adjustable board size and responsive SVG board UI
- Chinese / English language toggle

## Stack

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Realtime: Socket.IO
- Database: SQLite3
- Auth: JWT + bcrypt
- AI: Ollama + Minimax fallback
- Process management: `systemd --user`
- Reverse proxy: Nginx Proxy Manager / Nginx

## Project Structure

```text
chinese-chcess/
??? server.js
??? database.js
??? chess-server.service
??? chess-frontend.service
??? routes/
??? sockets/
??? frontend/
    ??? src/
    ?   ??? App.vue
    ?   ??? components/ChessBoard.vue
    ?   ??? engine/
    ?       ??? GameLogic.js
    ?       ??? MinimaxAI.js
    ?       ??? OllamaAI.js
    ??? vite.config.js
```

## Local Development

### Prerequisites
- Node.js 18+
- npm
- Optional: Ollama-compatible API reachable by the backend

### Backend

```bash
npm install
node server.js
```

Backend listens on `http://localhost:3000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend listens on `http://localhost:5173`.

In development, `vite.config.js` proxies `/api` and `/socket.io` to port `3000`.

## Production Deployment

### Backend and frontend services

This project is deployed in production with user-level systemd services.

Backend service:

```bash
systemctl --user status chess-server.service
journalctl --user -u chess-server.service -n 100 --no-pager
```

Frontend service:

```bash
systemctl --user status chess-frontend.service
journalctl --user -u chess-frontend.service -n 100 --no-pager
```

Service behavior:
- `chess-server.service` runs Node on port `3000`
- `chess-frontend.service` builds the Vite app and runs `vite preview` on port `5173`
- both services auto-restart on failure

### Reverse proxy requirements

When using a domain behind Nginx or Nginx Proxy Manager:
- `/` should proxy to `http://<app-host>:5173`
- `/api/` should proxy to `http://<app-host>:3000`
- `/socket.io/` should proxy to `http://<app-host>:3000`
- WebSocket upgrade headers must be enabled for `/socket.io/`

If you proxy only `/` to port `5173`, the homepage may load while login, history, or multiplayer features fail.

## AI Flow

Single-player AI works like this:
1. The frontend asks the backend to query Ollama.
2. The backend proxies the request to the Ollama host.
3. If Ollama times out or returns an unusable move, the frontend falls back to Minimax.

Current safeguards:
- backend Ollama proxy timeout: 10 seconds
- frontend Ollama request timeout: 8 seconds
- fallback to `getBestMoveQuick()` if Ollama is unavailable or returns an illegal move

## Multiplayer Guide

1. Open the app in two browser windows.
2. Register and login in both.
3. In window A, create a new room.
4. In window B, join using the room ID.
5. The game starts automatically when both players are present.

## Spectator Guide

1. Login.
2. Open the room list in the lobby.
3. Click `Watch` on an active room.
4. The current board state is replayed and then updated live.

## Operations Checklist

If the site stops working, check in this order:

```bash
systemctl --user status chess-server.service chess-frontend.service
ss -ltnp | grep -E ':3000|:5173'
curl http://127.0.0.1:3000/health
journalctl --user -u chess-server.service -n 100 --no-pager
journalctl --user -u chess-frontend.service -n 100 --no-pager
```

If the homepage works but API or multiplayer does not, inspect the reverse proxy rules for `/api/` and `/socket.io/`.

## License

MIT
