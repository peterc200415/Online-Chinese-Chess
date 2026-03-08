# Online Chinese Chess Platform | 線上中國象棋平台

Web-based Xiangqi platform with real-time multiplayer, spectator mode, single-player AI, bilingual UI, and production deployment support.

線上中國象棋平台，提供即時多人對戰、觀戰、單機 AI、中英文介面，以及實際部署支援。

## Overview | 專案概覽

This project is a full-stack Xiangqi platform built with Node.js, Express, Socket.IO, Vue 3, and SQLite. It supports online rooms, spectators, single-player AI, authentication, and reverse-proxy deployment.

本專案是使用 Node.js、Express、Socket.IO、Vue 3 與 SQLite 建置的全端象棋平台，支援線上房間、觀戰、單機 AI、登入驗證，以及反向代理部署。

## Features | 功能

- User registration and login
- Real-time 1v1 online matches
- Spectator mode with live board sync
- Single-player mode against AI
- Full Xiangqi rules
- Move validation and win detection
- Game history and room flow
- Chinese / English UI support
- Domain or LAN deployment support

- 使用者註冊與登入
- 即時 1v1 線上對戰
- 觀戰模式與即時棋盤同步
- 單機 AI 對戰
- 完整象棋規則
- 合法走子與勝負判定
- 對局流程與房間管理
- 中英文介面支援
- 支援網域或區網部署

## Tech Stack | 技術棧

- Frontend: Vue 3, Vite
- Backend: Node.js, Express
- Realtime: Socket.IO
- Database: SQLite3
- Auth: JWT, bcrypt
- AI: Minimax with alpha-beta pruning, Ollama fallback/assist
- Process management: `systemd --user`
- Reverse proxy: Nginx / Nginx Proxy Manager

- 前端：Vue 3、Vite
- 後端：Node.js、Express
- 即時通訊：Socket.IO
- 資料庫：SQLite3
- 驗證：JWT、bcrypt
- AI：Minimax + alpha-beta pruning，並支援 Ollama 輔助
- 服務管理：`systemd --user`
- 反向代理：Nginx / Nginx Proxy Manager

## Project Structure | 專案結構

```text
/home/peterc20/opencode/chinese-chcess
├─ database.js
├─ server.js
├─ chess-server.service
├─ chess-frontend.service
├─ routes/
├─ sockets/
├─ frontend/
│  ├─ src/
│  │  ├─ App.vue
│  │  ├─ components/ChessBoard.vue
│  │  └─ engine/
│  │     ├─ GameLogic.js
│  │     ├─ MinimaxAI.js
│  │     └─ OllamaAI.js
│  └─ vite.config.js
└─ README.md
```

## Runtime Ports | 執行埠

| Service | Port | Description |
|---|---:|---|
| Backend API / Socket.IO | `3000` | Express + Socket.IO server |
| Frontend preview/dev | `5173` | Vite frontend |

| 服務 | 埠號 | 說明 |
|---|---:|---|
| 後端 API / Socket.IO | `3000` | Express + Socket.IO |
| 前端 preview/dev | `5173` | Vite 前端 |

## AI Engine | AI 引擎

### 1. Minimax AI

The built-in engine uses minimax with alpha-beta pruning, iterative deepening, transposition table caching, and quiescence search for tactical stability.

內建 AI 使用 minimax、alpha-beta pruning、iterative deepening、transposition table 快取，以及 quiescence search 來提高戰術穩定性。

### 2. Ollama-assisted AI

The frontend can request the backend to proxy an Ollama move suggestion. If Ollama times out or returns an invalid move, the app falls back to Minimax automatically.

前端可透過 backend 轉送 Ollama 的落子建議；若 Ollama timeout 或回傳非法走法，系統會自動 fallback 到 Minimax。

Current safeguards:

- backend Ollama proxy timeout: `10s`
- frontend Ollama request timeout: `8s`
- invalid AI move fallback to Minimax
- AI thinking state cleanup on timeout

目前的保護機制：

- backend Ollama proxy timeout：`10s`
- frontend Ollama request timeout：`8s`
- 非法 AI 走法會 fallback 到 Minimax
- timeout 後會正確清除 AI thinking 狀態

## Local Development | 本機開發

### Prerequisites | 前置需求

- Node.js 18+
- npm
- Optional: reachable Ollama-compatible API

- Node.js 18+
- npm
- 可選：可連線的 Ollama API

### Backend | 後端

```bash
npm install
node server.js
```

Backend listens on `http://localhost:3000`.

後端預設執行於 `http://localhost:3000`。

### Frontend | 前端

```bash
cd frontend
npm install
npm run dev
```

Frontend listens on `http://localhost:5173`.

前端預設執行於 `http://localhost:5173`。

In development, `vite.config.js` proxies `/api` and `/socket.io` to port `3000`.

在開發模式下，`vite.config.js` 會將 `/api` 與 `/socket.io` 代理到 `3000`。

## Production Deployment | 正式部署

This project is currently managed by user-level systemd services.

此專案目前使用 user-level systemd services 管理。

### Service Units | 服務名稱

- `chess-server.service`
- `chess-frontend.service`

### Common Commands | 常用指令

```bash
systemctl --user status chess-server.service
systemctl --user status chess-frontend.service
systemctl --user restart chess-server.service
systemctl --user restart chess-frontend.service
journalctl --user -u chess-server.service -n 100 --no-pager
journalctl --user -u chess-frontend.service -n 100 --no-pager
```

### Service Behavior | 服務行為

- `chess-server.service` runs Node on port `3000`
- `chess-frontend.service` runs the frontend on port `5173`
- both services auto-restart on failure

- `chess-server.service` 執行 Node 後端，使用 `3000`
- `chess-frontend.service` 執行前端服務，使用 `5173`
- 兩個服務都會在異常時自動重啟

## Reverse Proxy | 反向代理

When deployed behind Nginx or Nginx Proxy Manager, the following routes are required:

使用 Nginx 或 Nginx Proxy Manager 部署時，至少需要以下代理規則：

- `/` -> `http://<app-host>:5173`
- `/api/` -> `http://<app-host>:3000`
- `/socket.io/` -> `http://<app-host>:3000`

WebSocket upgrade must be enabled for `/socket.io/`.

`/socket.io/` 必須啟用 WebSocket upgrade。

If only `/` is proxied to the frontend, the homepage may load while login, room list, history, or multiplayer features fail.

如果只把 `/` 代理到前端，首頁可能能打開，但登入、房間列表、歷史對局與多人連線功能會失效。

## Gameplay Flow | 對戰流程

### Multiplayer | 多人對戰

1. Open the app in two browser windows.
2. Register and login on both clients.
3. Create a room in client A.
4. Join the room in client B.
5. The game starts when both players are ready.

1. 用兩個瀏覽器視窗打開網站。
2. 兩邊都完成註冊與登入。
3. A 建立房間。
4. B 加入房間。
5. 兩位玩家到齊後自動開始對局。

### Spectator Mode | 觀戰模式

1. Login.
2. Open the room list.
3. Click `Watch` on an active room.
4. The current board state is restored and then updated live.

1. 先登入。
2. 打開房間列表。
3. 對進行中的房間按 `Watch`。
4. 系統會先還原目前棋局，再持續即時同步。

## Operational Checklist | 維運檢查

If the site stops working, check in this order:

如果網站異常，建議依序檢查：

```bash
systemctl --user status chess-server.service chess-frontend.service
ss -ltnp | grep -E ':3000|:5173'
curl http://127.0.0.1:3000/health
journalctl --user -u chess-server.service -n 100 --no-pager
journalctl --user -u chess-frontend.service -n 100 --no-pager
```

If the homepage works but API or multiplayer does not, inspect reverse proxy rules for `/api/` and `/socket.io/`.

如果首頁正常但 API 或多人功能失效，優先檢查 `/api/` 與 `/socket.io/` 的反向代理規則。

## Known Behavior | 已知行為

- Ollama requests are timeout-protected.
- The app falls back to Minimax when Ollama is unavailable.
- Frontend timeout handling prevents the AI thinking state from staying stuck forever.

- Ollama 請求有 timeout 保護。
- Ollama 無法使用時，系統會 fallback 到 Minimax。
- 前端已處理 timeout，避免 AI thinking 狀態卡住不消失。

## License

MIT
