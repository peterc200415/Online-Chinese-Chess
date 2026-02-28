<template>
  <div class="board-container">
    <svg :viewBox="`0 0 ${boardWidth} ${boardHeight}`" class="board-svg" :style="{ background: '#C18A4E', width: boardWidth + 'px', height: 'auto' }">
      <!-- Grid lines -->
      <g stroke="#FFFFFF" stroke-width="2">
        <line v-for="i in 10" :key="'h'+i" :x1="margin" :y1="margin + (i-1)*cellSize" :x2="boardWidth - margin" :y2="margin + (i-1)*cellSize" />
        <line v-for="i in 9" :key="'v1'+i" :x1="margin + (i-1)*cellSize" :y1="margin" :x2="margin + (i-1)*cellSize" :y2="margin + 4*cellSize" />
        <line v-for="i in 9" :key="'v2'+i" :x1="margin + (i-1)*cellSize" :y1="margin + 5*cellSize" :x2="margin + (i-1)*cellSize" :y2="margin + 9*cellSize" />
        <!-- River edges -->
        <line :x1="margin" :y1="margin + 4*cellSize" :x2="boardWidth - margin" :y2="margin + 4*cellSize" />
        <line :x1="margin" :y1="margin + 5*cellSize" :x2="boardWidth - margin" :y2="margin + 5*cellSize" />
        <!-- River closure lines -->
        <line :x1="margin" :y1="margin + 4*cellSize" :x2="margin" :y2="margin + 5*cellSize" />
        <line :x1="boardWidth - margin" :y1="margin + 4*cellSize" :x2="boardWidth - margin" :y2="margin + 5*cellSize" />
        <!-- Palace diagonals -->
        <line :x1="margin + 3*cellSize" :y1="margin" :x2="margin + 5*cellSize" :y2="margin + 2*cellSize" />
        <line :x1="margin + 5*cellSize" :y1="margin" :x2="margin + 3*cellSize" :y2="margin + 2*cellSize" />
        <line :x1="margin + 3*cellSize" :y1="margin + 9*cellSize" :x2="margin + 5*cellSize" :y2="margin + 7*cellSize" />
        <line :x1="margin + 5*cellSize" :y1="margin + 9*cellSize" :x2="margin + 3*cellSize" :y2="margin + 7*cellSize" />
      </g>
      <text :x="margin + 2 * cellSize" :y="boardHeight / 2" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" :font-size="cellSize * 0.5" font-weight="bold" opacity="0.6">
        楚河
      </text>
      <text :x="boardWidth - (margin + 2 * cellSize)" :y="boardHeight / 2" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" :font-size="cellSize * 0.5" font-weight="bold" opacity="0.6">
        漢界
      </text>

      <!-- Interactive cells -->
      <g v-for="(row, r) in board" :key="'row'+r">
        <g v-for="(piece, c) in row" :key="'cell'+r+c" 
           @click="handleSquareClick(r, c)"
           style="cursor: pointer">
          
          <!-- Hitbox -->
          <rect :x="c*cellSize" :y="r*cellSize" :width="cellSize" :height="cellSize" fill="transparent" />
          
          <!-- Selection Highlight -->
          <circle v-if="selected && selected[0]===r && selected[1]===c" 
                  :cx="c*cellSize + cellSize/2" :cy="r*cellSize + cellSize/2" :r="cellSize * 0.44" 
                  fill="rgba(59, 130, 246, 0.5)" />

          <!-- Piece -->
          <g v-if="piece">
            <circle :cx="c*cellSize + cellSize/2" :cy="r*cellSize + cellSize/2" :r="cellSize * 0.4" 
                    fill="#fdf6e3" stroke="#d4a373" :stroke-width="cellSize * 0.04" />
            <text :x="c*cellSize + cellSize/2" :y="r*cellSize + cellSize * 0.66" text-anchor="middle" 
                  :fill="piece[0] === 'r' ? '#ef4444' : '#000000'"
                  :font-size="cellSize * 0.44" font-weight="bold">
              {{ getPieceName(piece) }}
            </text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps(['board', 'turn', 'myColor', 'size']);
const emit = defineEmits(['move']);

const selected = ref(null);

const cellSize = computed(() => props.size || 50);
const boardWidth = computed(() => cellSize.value * 9);
const boardHeight = computed(() => cellSize.value * 10);
const margin = computed(() => cellSize.value / 2);

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
