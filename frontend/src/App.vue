<template>
  <div class="app-container">
    <!-- Language Toggle (always visible) -->
    <button class="lang-toggle" @click="toggleLang">{{ lang === 'zh' ? 'EN' : '中' }}</button>

    <div v-if="view === 'lobby'" class="lobby-container">
      <!-- Logo/Title Section -->
      <div class="lobby-header">
        <div class="logo">♟</div>
        <h1 class="title">{{ t('title') }}</h1>
        <p class="subtitle">線上象棋對戰平台</p>
      </div>
      
      <div v-if="!user" class="auth-card glass-panel">
        <div class="auth-header">
          <span class="auth-icon">👤</span>
          <h2>{{ t('loginOrRegister') }}</h2>
        </div>
        
        <div class="input-group">
          <input v-model="email" :placeholder="t('email')" class="modern-input" />
          <input v-model="password" type="password" :placeholder="t('password')" class="modern-input" />
          <input v-model="nickname" :placeholder="t('nickname')" class="modern-input" />
        </div>
        
        <div class="auth-buttons">
          <button @click="login" class="btn-primary">
            <span>🔑</span> {{ t('login') }}
          </button>
          <button @click="register" class="btn-secondary">
            <span>✏️</span> {{ t('register') }}
          </button>
        </div>
        
        <div class="divider">
          <span>OR</span>
        </div>
        
        <button @click="startSP" class="btn-ai">
          <span>🤖</span> {{ t('playAI') }}
          <span class="btn-badge">單機</span>
        </button>
      </div>

      <div v-else class="room-card glass-panel">
        <!-- User Info -->
        <div class="user-info">
          <div class="avatar">👤</div>
          <div class="user-details">
            <span class="welcome-text">{{ t('welcome') }}</span>
            <span class="nickname">{{ user.nickname }}</span>
          </div>
          <button @click="user = null" class="logout-btn">登出</button>
        </div>
        
        <!-- Quick Actions -->
        <div class="quick-actions">
          <button @click="startSP" class="action-btn ai-btn">
            <span class="action-icon">🤖</span>
            <span class="action-text">{{ t('playAI') }}</span>
          </button>
        </div>
        
        <!-- Room Controls -->
        <div class="room-controls">
          <input v-model="roomIdInput" :placeholder="t('roomId')" class="modern-input room-input" />
          <div class="room-buttons">
            <button @click="joinRoom" class="btn-primary">
              <span>🚪</span> {{ t('joinRoom') }}
            </button>
            <button @click="createRoom" class="btn-purple">
              <span>➕</span> {{ t('newRoom') }}
            </button>
          </div>
        </div>

        <!-- Room List -->
        <div class="room-list-section">
          <h4 class="section-title">
            <span>🎮</span> {{ t('availableRooms') }}
            <span class="room-count">{{ rooms.length }}</span>
          </h4>
          
          <div v-if="rooms.length > 0" class="room-grid">
            <div v-for="room in rooms" :key="room.id" class="room-item">
              <div class="room-header">
                <span class="room-id">{{ room.id.slice(0, 8) }}</span>
                <span :class="['status-badge', room.status]">
                  {{ room.status === 'waiting' ? '⏳ 等待中' : '♟ 對戰中' }}
                </span>
              </div>
              <div class="room-players">
                <div v-for="p in room.players" :key="p.nickname" class="player-chip" :class="p.color">
                  <span class="player-color-dot"></span>
                  {{ p.nickname }}
                </div>
                <div v-if="room.playerCount < 2" class="player-chip empty">
                  待加入
                </div>
              </div>
              <div class="room-actions">
                <button v-if="room.playerCount < 2" @click="joinRoomById(room.id)" class="join-btn">
                  加入
                </button>
                <button @click="watchRoom(room.id)" class="watch-btn">
                  👁 觀戰
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-rooms">
            <span class="empty-icon">🎴</span>
            <span>{{ t('noRooms') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Waiting Room -->
    <div v-else-if="view === 'waiting'" class="glass-panel lobby" style="text-align: center">
      <h2>{{ t('waitingTitle') }}</h2>
      <p style="color: #94a3b8">{{ t('roomId') }}: <strong style="color: #fbbf24; font-size: 20px; user-select: all">{{ currentRoomId }}</strong></p>
      <p style="color: #94a3b8">{{ t('waitingMsg') }}</p>
      <div class="spinner"></div>
      <button @click="leaveWaiting" style="margin-top: 20px">{{ t('cancel') }}</button>
    </div>

    <div v-else-if="view === 'game'" class="game-view flex-col" style="align-items: center">
      <!-- 遊戲資訊欄 -->
      <div class="game-header glass-panel">
        <div class="game-info-row">
          <!-- 房間/模式資訊 -->
          <div class="info-block mode-info">
            <span class="info-icon">🎮</span>
            <span class="info-label">{{ isSinglePlayer ? '單機對戰' : '多人房間' }}</span>
            <span v-if="!isSinglePlayer" class="room-id">{{ currentRoomId }}</span>
          </div>
          
          <!-- 回合指示 -->
          <div class="info-block turn-indicator" :class="turn">
            <span class="turn-dot"></span>
            <span class="turn-text">{{ colorName(turn) }}回合</span>
          </div>
          
          <!-- 玩家顏色 -->
          <div v-if="!isSpectator" class="info-block player-color" :class="myColor">
            <span class="color-badge">{{ colorName(myColor) }}</span>
            <span class="info-label">你是</span>
          </div>
          
          <!-- AI思考中 -->
          <div v-if="aiThinking" class="info-block ai-thinking">
            <span class="thinking-icon">🤔</span>
            <span>AI 思考中...</span>
          </div>
        </div>
        
        <!-- 控制列 -->
        <div class="control-row">
          <div class="board-size-control">
            <span class="control-label">📐 棋盤大小</span>
            <input type="range" v-model="boardSize" min="35" max="70" step="5" class="size-slider">
            <span class="size-value">{{ boardSize }}</span>
          </div>
          <button @click="leave" class="leave-btn">
            <span>🚪</span> {{ t('leaveGame') }}
          </button>
        </div>
        
        <!-- 觀戰提示 -->
        <div v-if="isSpectator" class="spectator-badge">
          👁 你正在觀戰 - {{ currentRoomId }}
        </div>
      </div>
      
      <ChessBoard 
        :board="board"
        :turn="turn"
        :myColor="myColor"
        :size="boardSize"
        @move="handleMove"
        style="margin-top: 20px"
      />

      <!-- Victory Overlay -->
      <div v-if="winner" class="victory-overlay" @click="closeVictory">
        <div class="victory-modal">
          <div class="victory-icon">🏆</div>
          <h1 class="victory-title">{{ winner === 'draw' ? t('stalemate') : (winner === myColor ? t('victory') : t('defeat')) }}</h1>
          <p class="victory-sub">{{ winMessage }}</p>
          <button @click="closeVictory" class="victory-btn">{{ t('backToLobby') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { io } from 'socket.io-client';
import ChessBoard from './components/ChessBoard.vue';
import { STARTING_BOARD, applyMove, isValidMove, getGameStatus } from './engine/GameLogic.js';
import { getOllamaMove } from './engine/OllamaAI.js';

// ==================== i18n ====================
const lang = ref('zh');

const i18n = {
  zh: {
    title: '象棋對戰平台',
    loginOrRegister: '登入或註冊',
    email: '電子郵件',
    password: '密碼',
    nickname: '暱稱（僅註冊時需要）',
    login: '登入',
    register: '註冊',
    playAI: '單機對戰 AI',
    welcome: '歡迎',
    roomId: '房間 ID',
    joinRoom: '加入房間',
    newRoom: '建立新房間',
    singlePlayer: '單機對戰 AI',
    room: '房間',
    color: '持棋',
    turnLabel: '輪到',
    red: '紅方',
    black: '黑方',
    aiThinking: 'AI 思考中...',
    leaveGame: '離開遊戲',
    victory: '勝利！',
    defeat: '敗北',
    backToLobby: '返回大廳',
    waitingTitle: '等待對手加入...',
    waitingMsg: '請將上方房間 ID 分享給對手，對手加入後遊戲將自動開始！',
    cancel: '取消',
    winCapture: (c) => `${c}吃掉了對方的將帥，獲得勝利！`,
    aiWinCapture: (c) => `AI（${c}）吃掉了你的將帥！`,
    aiNoMoves: 'AI 已無棋可走，你獲得勝利！',
    checkmateWin: '對手被將死，你獲得勝利！',
    stalemate: '困斃！雙方平手！',
    aiCheckmateWin: 'AI 將死你，你输了！',
    registerSuccess: '註冊成功！請登入。',
    gameSaved: '對局結束並已儲存！',
    needLogin: '請先登入或註冊帳號！',
    enterRoomId: '請輸入房間 ID！',
    availableRooms: '可用房間',
    waiting: '等待中',
    playing: '對戰中',
    joinable: '可加入',
    noRooms: '目前沒有房間，建立一個吧！',
    watch: '觀戰',
    spectating: '觀戰中',
    spectatorHint: '你正在觀看此對局，無法操作棋子',
  },
  en: {
    title: 'Chinese Chess Online',
    loginOrRegister: 'Login or Register',
    email: 'Email',
    password: 'Password',
    nickname: 'Nickname (register only)',
    login: 'Login',
    register: 'Register',
    playAI: 'Play vs AI',
    welcome: 'Welcome',
    roomId: 'Room ID',
    joinRoom: 'Join Room',
    newRoom: 'New Room',
    singlePlayer: 'Single Player vs AI',
    room: 'Room',
    color: 'Color',
    turnLabel: 'Turn',
    red: 'Red',
    black: 'Black',
    aiThinking: 'AI is thinking...',
    leaveGame: 'Leave Game',
    victory: 'Victory!',
    defeat: 'Defeat',
    backToLobby: 'Back to Lobby',
    waitingTitle: 'Waiting for opponent...',
    waitingMsg: 'Share the Room ID above with your opponent. Game starts when they join!',
    cancel: 'Cancel',
    winCapture: (c) => `${c} captured the General and wins!`,
    aiWinCapture: (c) => `AI (${c}) captured your General!`,
    aiNoMoves: 'AI has no moves left. You win!',
    checkmateWin: 'Checkmate! You win!',
    stalemate: 'Stalemate! Draw!',
    aiCheckmateWin: 'Checkmate! AI wins!',
    registerSuccess: 'Registered! Please login.',
    gameSaved: 'Game ended and saved!',
    needLogin: 'Please login or register first!',
    enterRoomId: 'Please enter a Room ID!',
    availableRooms: 'Available Rooms',
    waiting: 'Waiting',
    playing: 'Playing',
    joinable: 'Open',
    noRooms: 'No rooms yet. Create one!',
    watch: 'Watch',
    spectating: 'Spectating',
    spectatorHint: 'You are watching this game. You cannot move pieces.',
  }
};

function t(key) { return i18n[lang.value][key]; }
function colorName(c) { return c === 'red' ? t('red') : t('black'); }
function toggleLang() { lang.value = lang.value === 'zh' ? 'en' : 'zh'; }

// ==================== State ====================
// If accessed via domain (nginx proxy), use same origin; otherwise use port 3000
const isProxied = !window.location.port || window.location.port === '80' || window.location.port === '443';
const API = isProxied ? '' : `http://${window.location.hostname}:3000`;
const SOCKET_URL = isProxied ? window.location.origin : `http://${window.location.hostname}:3000`;
let socket;

const view = ref('lobby');
const user = ref(null);
const email = ref('');
const password = ref('');
const nickname = ref('');
const roomIdInput = ref('');

const board = ref([]);
const turn = ref('red');
const myColor = ref('red');
const isSinglePlayer = ref(false);
const currentRoomId = ref('');
const winner = ref(null);
const winMessage = ref('');
const aiThinking = ref(false);
const rooms = ref([]);
const isSpectator = ref(false);
const boardSize = ref(50);

function closeVictory() {
  winner.value = null;
  winMessage.value = '';
  view.value = 'lobby';
}

function resetBoard() {
  board.value = STARTING_BOARD.map(row => [...row]);
  turn.value = 'red';
}

function applyServerState(state) {
  if (state.board) board.value = state.board.map(row => [...row]);
  if (state.turn) turn.value = state.turn;
}

function resetGameState() {
  winner.value = null;
  winMessage.value = '';
  aiThinking.value = false;
}

function showMultiplayerResult(result, winnerColor) {
  winner.value = winnerColor;
  if (result === 'stalemate') {
    winMessage.value = t('stalemate');
    return;
  }
  if (result === 'checkmate') {
    winMessage.value = winnerColor === myColor.value ? t('checkmateWin') : t('aiCheckmateWin');
    return;
  }
  winMessage.value = winnerColor === myColor.value
    ? t('winCapture')(colorName(winnerColor))
    : t('aiWinCapture')(colorName(winnerColor));
}

async function login() {
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email.value, password: password.value})
    });
    const data = await res.json();
    if (data.token) {
      user.value = data.user;
      initSocket();
    } else alert(data.error);
  } catch(e) { alert('Server connection failed'); }
}

async function register() {
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email.value, password: password.value, nickname: nickname.value})
    });
    const data = await res.json();
    if (data.message) alert(t('registerSuccess'));
    else alert(data.error);
  } catch(e) { alert('Server connection failed'); }
}

function initSocket() {
  if (socket) return; // prevent double init
  socket = io(SOCKET_URL);
  
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('game_start', (data) => {
    resetGameState();
    isSinglePlayer.value = false;
    isSpectator.value = false;
    applyServerState(data);
    const me = data.players.find(p => p.id === user.value.id);
    if (me) myColor.value = me.color;
    view.value = 'game';
  });
  
  socket.on('move_made', (data) => {
    applyServerState(data);
  });
  
  socket.on('game_over', (data) => {
    applyServerState(data);
    showMultiplayerResult(data.result, data.winner);
  });

  socket.on('room_update', (room) => {
    console.log('Room update:', room);
  });

  socket.on('room_error', (message) => {
    alert(message);
  });

  socket.on('player_disconnected', () => {
    resetGameState();
    alert('Player disconnected');
    view.value = 'lobby';
  });

  socket.on('room_list', (list) => {
    rooms.value = list;
  });

  socket.on('watch_start', (data) => {
    resetGameState();
    applyServerState(data);
    isSinglePlayer.value = false;
    isSpectator.value = true;
    myColor.value = 'red';
    view.value = 'game';
  });
}

function createRoom() {
  if (!user.value) { alert(t('needLogin')); return; }
  const id = Math.random().toString(36).substring(2, 8);
  currentRoomId.value = id;
  if (!socket) initSocket();
  socket.emit('join_room', { roomId: id, user: user.value });
  view.value = 'waiting';
}

function joinRoom() {
  if (!user.value) { alert(t('needLogin')); return; }
  if (!roomIdInput.value.trim()) { alert(t('enterRoomId')); return; }
  joinRoomById(roomIdInput.value.trim());
}

function joinRoomById(id) {
  if (!user.value) { alert(t('needLogin')); return; }
  currentRoomId.value = id;
  if (!socket) initSocket();
  socket.emit('join_room', { roomId: id, user: user.value });
  view.value = 'waiting';
}

function leaveWaiting() {
  if (socket && currentRoomId.value) {
    socket.emit('leave_room', currentRoomId.value);
  }
  currentRoomId.value = '';
  view.value = 'lobby';
}

function watchRoom(roomId) {
  currentRoomId.value = roomId;
  isSinglePlayer.value = false;
  isSpectator.value = true;
  if (!socket) initSocket();
  socket.emit('watch_room', { roomId });
}

function startSP() {
  resetGameState();
  isSinglePlayer.value = true;
  isSpectator.value = false;
  currentRoomId.value = '';
  myColor.value = 'red';
  resetBoard();
  view.value = 'game';
}

async function handleMove(move) {
  if (isSpectator.value) return;
  if (!isValidMove(board.value, move.start, move.end, myColor.value)) return;
  
  const targetPiece = board.value[move.end[0]][move.end[1]];
  board.value = applyMove(board.value, move);
  
  if (targetPiece && targetPiece[1] === 'K') {
    winner.value = myColor.value;
    winMessage.value = t('winCapture')(colorName(myColor.value));
    return;
  }

  const nextTurn = turn.value === 'red' ? 'black' : 'red';
  const status = getGameStatus(board.value, nextTurn);
  
  if (status === 'checkmate') {
    winner.value = myColor.value;
    winMessage.value = t('checkmateWin');
    return;
  } else if (status === 'stalemate') {
    winner.value = 'draw';
    winMessage.value = t('stalemate');
    return;
  }
  
  turn.value = nextTurn;
  
  if (isSinglePlayer.value) {
    aiThinking.value = true;
    setTimeout(async () => {
      const aiColor = myColor.value === 'red' ? 'black' : 'red';

      try {
        const best = await getOllamaMove(board.value, aiColor);
        if (best) {
          const aiTarget = board.value[best.end[0]][best.end[1]];
          board.value = applyMove(board.value, best);
          if (aiTarget && aiTarget[1] === 'K') {
            winner.value = aiColor;
            winMessage.value = t('aiWinCapture')(colorName(aiColor));
            return;
          }

          const playerStatus = getGameStatus(board.value, myColor.value);
          if (playerStatus === 'checkmate') {
            winner.value = aiColor;
            winMessage.value = t('aiCheckmateWin');
            return;
          } else if (playerStatus === 'stalemate') {
            winner.value = 'draw';
            winMessage.value = t('stalemate');
            return;
          }

          turn.value = myColor.value;
        } else {
          winner.value = myColor.value;
          winMessage.value = t('aiNoMoves');
        }
      } finally {
        aiThinking.value = false;
      }
    }, 100);
  } else {
    socket.emit('make_move', { roomId: currentRoomId.value, move });
  }
}

function leave() {
  isSpectator.value = false;
  if (isSinglePlayer.value) {
    view.value = 'lobby';
  } else {
    socket.emit('leave_room', currentRoomId.value);
    view.value = 'lobby';
  }
}
</script>
