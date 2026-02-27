<template>
  <div class="app-container">
    <!-- Language Toggle (always visible) -->
    <button class="lang-toggle" @click="toggleLang">{{ lang === 'zh' ? 'EN' : '中' }}</button>

    <div v-if="view === 'lobby'" class="glass-panel lobby">
      <h1>♟ {{ t('title') }}</h1>
      
      <div v-if="!user" class="auth-box flex-col">
        <h3>{{ t('loginOrRegister') }}</h3>
        <input v-model="email" :placeholder="t('email')" />
        <input v-model="password" type="password" :placeholder="t('password')" />
        <input v-model="nickname" :placeholder="t('nickname')" />
        <div style="display:flex; gap: 10px">
          <button @click="login">{{ t('login') }}</button>
          <button @click="register">{{ t('register') }}</button>
        </div>
        <hr style="width:100%; border-color: rgba(255,255,255,0.1)" />
        <button @click="startSP" style="background: #10b981">{{ t('playAI') }}</button>
      </div>

      <div v-else class="room-box flex-col">
        <h3>{{ t('welcome') }}, {{ user.nickname }}!</h3>
        <input v-model="roomIdInput" :placeholder="t('roomId')" />
        <div style="display:flex; gap: 10px">
          <button @click="joinRoom" style="flex:1">{{ t('joinRoom') }}</button>
          <button @click="createRoom" style="flex:1; background: #8b5cf6">{{ t('newRoom') }}</button>
        </div>

        <!-- Room List -->
        <div v-if="rooms.length > 0" class="room-list">
          <h4 style="margin: 12px 0 8px; color: #94a3b8">{{ t('availableRooms') }}</h4>
          <div v-for="room in rooms" :key="room.id" class="room-card">
            <div class="room-card-info">
              <span class="room-card-id">{{ room.id }}</span>
              <span :class="['room-status', room.status]">{{ room.status === 'waiting' ? t('waiting') : t('playing') }}</span>
            </div>
            <div class="room-card-players">
              <span v-for="p in room.players" :key="p.nickname" :style="{color: p.color === 'red' ? '#ef4444' : '#94a3b8'}">{{ p.nickname }}</span>
              <span v-if="room.spectatorCount > 0" style="color: #64748b">👁 {{ room.spectatorCount }}</span>
            </div>
            <div style="display:flex; gap: 8px; margin-top: 8px">
              <button v-if="room.playerCount < 2" @click="joinRoomById(room.id)" style="flex:1; font-size:13px; padding:6px">{{ t('joinRoom') }}</button>
              <button @click="watchRoom(room.id)" style="flex:1; font-size:13px; padding:6px; background: #6366f1">👁 {{ t('watch') }}</button>
            </div>
          </div>
        </div>
        <div v-else style="color: #475569; text-align: center; margin: 12px 0; font-size: 14px">{{ t('noRooms') }}</div>

        <button @click="startSP" style="background: #10b981; margin-top:8px">{{ t('playAI') }}</button>
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
      <div class="header glass-panel" style="width: 100%; text-align: center">
        <h2 v-if="isSpectator">👁 {{ t('spectating') }} — {{ currentRoomId }}</h2>
        <h2 v-else>{{ isSinglePlayer ? t('singlePlayer') : t('room') + ': ' + currentRoomId }}</h2>
        <div>{{ t('turnLabel') }}: <span :style="{color: turn === 'red' ? '#ef4444' : '#94a3b8'}">{{ colorName(turn) }}</span></div>
        <div v-if="!isSpectator">{{ t('color') }}: <span :style="{color: myColor === 'red' ? '#ef4444' : '#94a3b8'}">{{ colorName(myColor) }}</span></div>
        <div v-if="isSpectator" style="color: #6366f1; margin-top: 4px">{{ t('spectatorHint') }}</div>
        <div v-if="aiThinking" style="color: #fbbf24; margin-top: 6px">🤔 {{ t('aiThinking') }}</div>
        <button @click="leave" style="margin-top: 10px">{{ t('leaveGame') }}</button>
      </div>
      
      <ChessBoard 
        :board="board"
        :turn="turn"
        :myColor="myColor"
        @move="handleMove"
        style="margin-top: 20px"
      />

      <!-- Victory Overlay -->
      <div v-if="winner" class="victory-overlay" @click="closeVictory">
        <div class="victory-modal">
          <div class="victory-icon">🏆</div>
          <h1 class="victory-title">{{ winner === myColor ? t('victory') : t('defeat') }}</h1>
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
import { STARTING_BOARD, applyMove, isValidMove } from './engine/GameLogic.js';
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

function closeVictory() {
  winner.value = null;
  winMessage.value = '';
  view.value = 'lobby';
}

function resetBoard() {
  board.value = STARTING_BOARD.map(row => [...row]);
  turn.value = 'red';
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
    resetBoard();
    const me = data.players.find(p => p.id === user.value.id);
    if (me) myColor.value = me.color;
    view.value = 'game';
  });
  
  socket.on('move_made', (move) => {
    board.value = applyMove(board.value, move);
    turn.value = turn.value === 'red' ? 'black' : 'red';
  });
  
  socket.on('game_saved', () => {
    alert(t('gameSaved'));
    view.value = 'lobby';
  });

  socket.on('room_update', (room) => {
    console.log('Room update:', room);
  });

  socket.on('player_disconnected', () => {
    alert(t('gameSaved'));
    view.value = 'lobby';
  });

  socket.on('room_list', (list) => {
    rooms.value = list;
  });

  socket.on('watch_start', (data) => {
    resetBoard();
    // Replay all moves to get current board state
    for (const move of data.moves) {
      board.value = applyMove(board.value, move);
    }
    turn.value = data.moves.length % 2 === 0 ? 'red' : 'black';
    isSpectator.value = true;
    myColor.value = 'red'; // doesn't matter for spectator, just for display
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
  isSinglePlayer.value = true;
  currentRoomId.value = '';
  myColor.value = 'red';
  resetBoard();
  view.value = 'game';
}

async function handleMove(move) {
  if (isSpectator.value) return; // spectators can't move
  if (!isValidMove(board.value, move.start, move.end, myColor.value)) return;
  
  const targetPiece = board.value[move.end[0]][move.end[1]];
  board.value = applyMove(board.value, move);
  
  if (targetPiece && targetPiece[1] === 'K') {
    winner.value = myColor.value;
    winMessage.value = t('winCapture')(colorName(myColor.value));
    return;
  }

  turn.value = turn.value === 'red' ? 'black' : 'red';
  
  if (isSinglePlayer.value) {
    aiThinking.value = true;
    setTimeout(async () => {
      const aiColor = myColor.value === 'red' ? 'black' : 'red';
      const best = await getOllamaMove(board.value, aiColor);
      aiThinking.value = false;
      if (best) {
        const aiTarget = board.value[best.end[0]][best.end[1]];
        board.value = applyMove(board.value, best);
        if (aiTarget && aiTarget[1] === 'K') {
          winner.value = aiColor;
          winMessage.value = t('aiWinCapture')(colorName(aiColor));
          return;
        }
        turn.value = myColor.value;
      } else {
        winner.value = myColor.value;
        winMessage.value = t('aiNoMoves');
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
