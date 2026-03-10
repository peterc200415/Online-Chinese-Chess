import { generateAllMoves } from './GameLogic.js';
import { getBestMove } from './MinimaxAI.js';

export async function getOllamaMove(board, color) {
    const moves = generateAllMoves(board, color);
    if (moves.length === 0) return null;

    console.log('Using engine-first AI move.');
    return getBestMove(board, 0, color) || moves[0];
}
