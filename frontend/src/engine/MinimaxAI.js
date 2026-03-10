import { generateAllMoves, applyMove, isKingInCheck } from './GameLogic.js';

const PIECE_VALUES = { K: 10000, R: 1000, C: 520, N: 460, B: 210, A: 210, P: 120 };
const MAX_DEPTH = 6;
const ID_TIME_LIMIT = 2500;
const CHECK_EXTENSION = 1;

const tt = new Map();
const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

function getTTKey(board, depth, alpha, beta) {
    return board.flat().join(',') + `|${depth}|${alpha}|${beta}`;
}

function storeTT(board, depth, alpha, beta, bestMove, result) {
    const key = getTTKey(board, depth, alpha, beta);
    let flag = TT_EXACT;
    if (result <= alpha) flag = TT_UPPER;
    else if (result >= beta) flag = TT_LOWER;
    tt.set(key, { depth, flag, result, bestMove });
}

function probeTT(board, depth, alpha, beta) {
    const key = getTTKey(board, depth, alpha, beta);
    const entry = tt.get(key);
    if (entry && entry.depth >= depth) {
        if (entry.flag === TT_EXACT) return { found: true, move: entry.bestMove, value: entry.result };
        if (entry.flag === TT_LOWER && entry.result >= beta) return { found: true, value: beta };
        if (entry.flag === TT_UPPER && entry.result <= alpha) return { found: true, value: alpha };
    }
    return { found: false };
}

function getCaptureValue(board, move) {
    const captured = board[move.end[0]][move.end[1]];
    const attacker = board[move.start[0]][move.start[1]];
    const capturedValue = captured ? (PIECE_VALUES[captured[1]] || 0) : 0;
    const attackerValue = attacker ? (PIECE_VALUES[attacker[1]] || 0) : 0;
    return capturedValue * 10 - attackerValue;
}

function moveGivesCheck(board, move, color) {
    const nextBoard = applyMove(board, move);
    const oppColor = color === 'red' ? 'black' : 'red';
    return isKingInCheck(nextBoard, oppColor);
}

function orderMoves(board, moves, color, ttMove = null) {
    if (ttMove) {
        const idx = moves.findIndex(m =>
            m.start[0] === ttMove.start[0] && m.start[1] === ttMove.start[1] &&
            m.end[0] === ttMove.end[0] && m.end[1] === ttMove.end[1]
        );
        if (idx > 0) moves.unshift(moves.splice(idx, 1)[0]);
    }

    return moves.sort((a, b) => {
        const scoreA = scoreMove(board, a, color);
        const scoreB = scoreMove(board, b, color);
        return scoreB - scoreA;
    });
}

function scoreMove(board, move, color) {
    const captured = board[move.end[0]][move.end[1]];
    let score = captured ? 5000 + getCaptureValue(board, move) : 0;
    if (moveGivesCheck(board, move, color)) score += 3000;

    const piece = board[move.start[0]][move.start[1]];
    if (piece?.[1] === 'P') {
        const forwardProgress = color === 'red' ? (9 - move.end[0]) : move.end[0];
        score += forwardProgress * 8;
    }
    if (piece?.[1] === 'R') score += 40;
    if (piece?.[1] === 'C') score += 25;

    const centerBias = Math.abs(4 - move.end[1]);
    score += 20 - centerBias * 4;
    return score;
}

function evaluateEnhanced(board, color) {
    let score = 0;
    const myPrefix = color[0];
    const oppPrefix = color === 'red' ? 'b' : 'r';
    let myKingPos = null;
    let oppKingPos = null;
    let myMaterial = 0;
    let oppMaterial = 0;

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (!p) continue;

            const value = PIECE_VALUES[p[1]] || 0;
            const isMine = p[0] === myPrefix;
            if (p[1] === 'K') {
                if (isMine) myKingPos = [r, c];
                else oppKingPos = [r, c];
            }

            const positional = evaluatePiece(board, r, c, p);
            if (isMine) {
                myMaterial += value;
                score += value + positional;
            } else {
                oppMaterial += value;
                score -= value + positional;
            }
        }
    }

    score += evaluateKingSafety(board, myKingPos, myPrefix);
    score -= evaluateKingSafety(board, oppKingPos, oppPrefix);
    score += evaluateMobility(board, color) * 3;
    score -= evaluateMobility(board, color === 'red' ? 'black' : 'red') * 3;

    if (isKingInCheck(board, color)) score -= 180;
    if (isKingInCheck(board, color === 'red' ? 'black' : 'red')) score += 180;

    if (myMaterial < 2200 || oppMaterial < 2200) {
        score += evaluateEndgamePressure(board, color);
    }

    return score;
}

function evaluatePiece(board, r, c, piece) {
    const type = piece[1];
    const color = piece[0];
    let score = 0;

    if (type === 'P') {
        const progress = color === 'r' ? (9 - r) : r;
        score += progress * 14;
        if ((color === 'r' && r <= 4) || (color === 'b' && r >= 5)) score += 40;
        score += (4 - Math.abs(4 - c)) * 6;
    }

    if (type === 'R') score += (4 - Math.abs(4 - c)) * 12;
    if (type === 'C') score += (4 - Math.abs(4 - c)) * 8;
    if (type === 'N') score += evaluateKnightMobility(board, r, c) * 10;
    if (type === 'A' || type === 'B') score += 12;

    return score;
}

function evaluateKnightMobility(board, r, c) {
    const horseMoves = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [-1, 2, 0, 1],
        [1, -2, 0, -1], [1, 2, 0, 1],
    ];
    let mobility = 0;
    for (const [dr, dc, lr, lc] of horseMoves) {
        const nr = r + dr, nc = c + dc;
        const legR = r + lr, legC = c + lc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9 && board[legR][legC] === '') mobility++;
    }
    return mobility;
}

function evaluateKingSafety(board, kingPos, color) {
    if (!kingPos) return -5000;
    const [r, c] = kingPos;
    const palace = color === 'r'
        ? [[9,3],[9,4],[9,5],[8,3],[8,4],[8,5],[7,3],[7,4],[7,5]]
        : [[0,3],[0,4],[0,5],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5]];
    let safety = 0;

    for (const [pr, pc] of palace) {
        const piece = board[pr][pc];
        if (piece && piece[0] === color) safety += { A: 35, B: 20, R: 8, C: 10, N: 8, P: 4 }[piece[1]] || 0;
    }

    const opp = color === 'r' ? 'b' : 'r';
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                const p = board[nr][nc];
                if (p && p[0] === opp) safety -= 18;
            }
        }
    }
    return safety;
}

function evaluateMobility(board, color) {
    return generateAllMoves(board, color).length;
}

function evaluateEndgamePressure(board, color) {
    const oppColor = color === 'red' ? 'black' : 'red';
    let score = 0;
    const myMoves = generateAllMoves(board, color);
    const oppMoves = generateAllMoves(board, oppColor);
    score += (myMoves.length - oppMoves.length) * 6;
    return score;
}

function quiescence(board, alpha, beta, myColor, oppColor, isMaximizing, depth) {
    const standPat = evaluateEnhanced(board, myColor);
    if (depth <= 0) return standPat;

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;
        const captures = orderMoves(board, generateAllMoves(board, myColor).filter(move => board[move.end[0]][move.end[1]]), myColor);
        for (const move of captures) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return 99999;
            const score = quiescence(applyMove(board, move), alpha, beta, myColor, oppColor, false, depth - 1);
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }

    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
    const captures = orderMoves(board, generateAllMoves(board, oppColor).filter(move => board[move.end[0]][move.end[1]]), oppColor);
    for (const move of captures) {
        const captured = board[move.end[0]][move.end[1]];
        if (captured && captured[1] === 'K') return -99999;
        const score = quiescence(applyMove(board, move), alpha, beta, myColor, oppColor, true, depth - 1);
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
    }
    return beta;
}

function minimax(board, depth, alpha, beta, isMaximizing, myColor, oppColor, ttMove = null) {
    const ttResult = probeTT(board, depth, alpha, beta);
    if (ttResult.found) return ttResult.value;

    const sideToMove = isMaximizing ? myColor : oppColor;
    const inCheck = isKingInCheck(board, sideToMove);
    const effectiveDepth = inCheck && depth > 0 ? depth + CHECK_EXTENSION : depth;

    if (effectiveDepth === 0) {
        const score = quiescence(board, alpha, beta, myColor, oppColor, isMaximizing, 4);
        storeTT(board, depth, alpha, beta, null, score);
        return score;
    }

    let moves = generateAllMoves(board, sideToMove);
    if (moves.length === 0) {
        const score = isMaximizing ? -99999 : 99999;
        storeTT(board, depth, alpha, beta, null, score);
        return score;
    }

    moves = orderMoves(board, moves, sideToMove, ttMove);
    let bestMove = null;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') {
                storeTT(board, depth, alpha, beta, move, 99999);
                return 99999;
            }
            const evalScore = minimax(applyMove(board, move), effectiveDepth - 1, alpha, beta, false, myColor, oppColor);
            if (evalScore > maxEval) {
                maxEval = evalScore;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        storeTT(board, depth, alpha, beta, bestMove, maxEval);
        return maxEval;
    }

    let minEval = Infinity;
    for (const move of moves) {
        const captured = board[move.end[0]][move.end[1]];
        if (captured && captured[1] === 'K') {
            storeTT(board, depth, alpha, beta, move, -99999);
            return -99999;
        }
        const evalScore = minimax(applyMove(board, move), effectiveDepth - 1, alpha, beta, true, myColor, oppColor);
        if (evalScore < minEval) {
            minEval = evalScore;
            bestMove = move;
        }
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
    }
    storeTT(board, depth, alpha, beta, bestMove, minEval);
    return minEval;
}

function getBestMoveIterative(board, color, maxTime) {
    const myColor = color;
    const oppColor = color === 'red' ? 'black' : 'red';
    let bestMove = null;
    const startTime = Date.now();

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        if (Date.now() - startTime > maxTime) break;
        let moves = generateAllMoves(board, myColor);
        if (moves.length === 0) return null;

        moves = orderMoves(board, moves, myColor, bestMove);
        let currentBest = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            if (Date.now() - startTime > maxTime) break;
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return move;
            const score = minimax(applyMove(board, move), depth - 1, -Infinity, Infinity, false, myColor, oppColor);
            if (score > bestScore) {
                bestScore = score;
                currentBest = move;
            }
        }

        if (currentBest) {
            bestMove = currentBest;
            console.log(`Depth ${depth}: score=${bestScore} move=${bestMove.start}->${bestMove.end}`);
        }
    }

    return bestMove;
}

export function getBestMove(board, _depth, color) {
    tt.clear();
    return getBestMoveIterative(board, color, ID_TIME_LIMIT);
}

export function getBestMoveQuick(board, color) {
    tt.clear();
    return getBestMoveIterative(board, color, 1200);
}
