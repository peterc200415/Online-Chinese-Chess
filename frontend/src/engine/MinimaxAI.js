import { generateAllMoves, applyMove, evaluateBoard } from './GameLogic.js';

// Minimax with Alpha-Beta Pruning + Quiescence Search
const PIECE_VALUES = { 'K': 10000, 'R': 1000, 'C': 500, 'N': 450, 'B': 200, 'A': 200, 'P': 100 };

function orderMoves(board, moves) {
    return moves.sort((a, b) => {
        const capA = board[a.end[0]][a.end[1]];
        const capB = board[b.end[0]][b.end[1]];
        const valA = capA ? (PIECE_VALUES[capA[1]] || 0) : 0;
        const valB = capB ? (PIECE_VALUES[capB[1]] || 0) : 0;
        return valB - valA; // best captures first
    });
}

// Quiescence search: only look at captures at leaf nodes to avoid horizon effect
function quiescence(board, alpha, beta, myColor, oppColor, isMaximizing, depth) {
    const standPat = evaluateBoard(board, myColor);
    if (depth <= 0) return standPat;

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        const color = myColor;
        const moves = generateAllMoves(board, color);
        // Only look at captures
        const captures = moves.filter(m => {
            const t = board[m.end[0]][m.end[1]];
            return t && t[0] !== color[0];
        });

        for (const move of captures) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return 99999;
            const newBoard = applyMove(board, move);
            const score = quiescence(newBoard, alpha, beta, myColor, oppColor, false, depth - 1);
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;

        const color = oppColor;
        const moves = generateAllMoves(board, color);
        const captures = moves.filter(m => {
            const t = board[m.end[0]][m.end[1]];
            return t && t[0] !== color[0];
        });

        for (const move of captures) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return -99999;
            const newBoard = applyMove(board, move);
            const score = quiescence(newBoard, alpha, beta, myColor, oppColor, true, depth - 1);
            if (score <= alpha) return alpha;
            if (score < beta) beta = score;
        }
        return beta;
    }
}

function minimax(board, depth, alpha, beta, isMaximizing, myColor, oppColor) {
    if (depth === 0) {
        return quiescence(board, alpha, beta, myColor, oppColor, isMaximizing, 3);
    }

    const color = isMaximizing ? myColor : oppColor;
    let moves = generateAllMoves(board, color);
    if (moves.length === 0) return isMaximizing ? -99999 : 99999;

    moves = orderMoves(board, moves);

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return 99999;

            const newBoard = applyMove(board, move);
            const eval_ = minimax(newBoard, depth - 1, alpha, beta, false, myColor, oppColor);
            maxEval = Math.max(maxEval, eval_);
            alpha = Math.max(alpha, eval_);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return -99999;

            const newBoard = applyMove(board, move);
            const eval_ = minimax(newBoard, depth - 1, alpha, beta, true, myColor, oppColor);
            minEval = Math.min(minEval, eval_);
            beta = Math.min(beta, eval_);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

export function getBestMove(board, depth, color) {
    const myColor = color;
    const oppColor = color === 'red' ? 'black' : 'red';
    let moves = generateAllMoves(board, myColor);
    if (moves.length === 0) return null;

    moves = orderMoves(board, moves);

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of moves) {
        const captured = board[move.end[0]][move.end[1]];
        if (captured && captured[1] === 'K') return move; // instant win

        const newBoard = applyMove(board, move);
        const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, myColor, oppColor);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}
