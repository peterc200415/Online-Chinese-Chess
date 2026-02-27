<template>
  <div class="board-container">
    <svg viewBox="0 0 450 500" class="board-svg" style="background: #C18A4E; width: 100%; height: auto; max-width: 450px;">
      <!-- Grid lines -->
      <g stroke="#FFFFFF" stroke-width="2">
        <line v-for="i in 10" :key="'h'+i" x1="25" :y1="i*50 - 25" x2="425" :y2="i*50 - 25" />
        <line v-for="i in 9" :key="'v1'+i" :x1="i*50 - 25" y1="25" :x2="i*50 - 25" y2="225" />
        <line v-for="i in 9" :key="'v2'+i" :x1="i*50 - 25" y1="275" :x2="i*50 - 25" y2="475" />
        <!-- River edges -->
        <line x1="25" y1="225" x2="25" y2="275" />
        <line x1="425" y1="225" x2="425" y2="275" />
        <!-- Palace diagonals -->
        <line x1="175" y1="25" x2="275" y2="125" />
        <line x1="275" y1="25" x2="175" y2="125" />
        <line x1="175" y1="475" x2="275" y2="375" />
        <line x1="275" y1="475" x2="175" y2="375" />
      </g>
      <text x="225" y="260" text-anchor="middle" fill="#FFFFFF" font-size="24" font-weight="bold" opacity="0.5">
        楚河 漢界
      </text>

      <!-- Interactive cells -->
      <g v-for="(row, r) in board" :key="'row'+r">
        <g v-for="(piece, c) in row" :key="'cell'+r+c" 
           @click="handleSquareClick(r, c)"
           style="cursor: pointer">
           
          <!-- Hitbox -->
          <rect :x="c*50" :y="r*50" width="50" height="50" fill="transparent" />
          
          <!-- Selection Highlight -->
          <circle v-if="selected && selected[0]===r && selected[1]===c" 
                  :cx="c*50 + 25" :cy="r*50 + 25" r="22" 
                  fill="rgba(59, 130, 246, 0.5)" />

          <!-- Piece -->
          <g v-if="piece">
            <circle :cx="c*50 + 25" :cy="r*50 + 25" r="20" 
                    fill="#fdf6e3" stroke="#d4a373" stroke-width="2" />
            <text :x="c*50 + 25" :y="r*50 + 33" text-anchor="middle" 
                  :fill="piece[0] === 'r' ? '#ef4444' : '#000000'"
                  font-size="22" font-weight="bold">
              {{ getPieceName(piece) }}
            </text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps(['board', 'turn', 'myColor']);
const emit = defineEmits(['move']);

const selected = ref(null);

const pieceNames = {
  'rK': '帥', 'rA': '仕', 'rB': '相', 'rN': '傌', 'rR': '俥', 'rC': '炮', 'rP': '兵',
  'bK': '將', 'bA': '士', 'bB': '象', 'bN': '馬', 'bR': '車', 'bC': '砲', 'bP': '卒'
};

function getPieceName(code) {
  return pieceNames[code] || '';
}

function handleSquareClick(r, c) {
  const piece = props.board[r][c];
  const isMyPiece = piece && piece[0] === (props.myColor === 'red' ? 'r' : 'b');

  // Need to be your turn
  if (props.turn !== props.myColor) return;

  if (selected.value) {
    if (isMyPiece) {
      selected.value = [r, c]; // change selection
    } else {
      // execute move
      emit('move', { start: selected.value, end: [r, c] });
      selected.value = null;
    }
  } else {
    if (isMyPiece) {
      selected.value = [r, c];
    }
  }
}
</script>

<style scoped>
.board-container {
  border: 4px solid var(--line-color);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 15px 35px rgba(0,0,0,0.6);
}
</style>
