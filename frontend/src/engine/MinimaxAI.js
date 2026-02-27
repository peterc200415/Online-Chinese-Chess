import { generateAllMoves, applyMove, evaluateBoard, isKingInCheck } from './GameLogic.js';

const PIECE_VALUES = { 'K': 10000, 'R': 1000, 'C': 500, 'N': 450, 'B': 200, 'A': 200, 'P': 100 };
const MAX_DEPTH = 5;
const ID_TIME_LIMIT = 4000;

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

function orderMoves(board, moves, ttMove = null) {
    if (ttMove) {
        const idx = moves.findIndex(m =>
            m.start[0] === ttMove.start[0] && m.start[1] === ttMove.start[1] &&
            m.end[0] === ttMove.end[0] && m.end[1] === ttMove.end[1]
        );
        if (idx > 0) {
            moves.unshift(moves.splice(idx, 1)[0]);
        }
    }
    return moves.sort((a, b) => {
        const capA = board[a.end[0]][a.end[1]];
        const capB = board[b.end[0]][b.end[1]];
        const valA = capA ? (PIECE_VALUES[capA[1]] || 0) : 0;
        const valB = capB ? (PIECE_VALUES[capB[1]] || 0) : 0;
        return valB - valA;
    });
}

function evaluateEnhanced(board, color) {
    let score = 0;
    const myPrefix = color[0];
    const oppPrefix = color === 'red' ? 'b' : 'r';
    
    let myKingPos = null;
    let oppKingPos = null;
    let myPieces = [];
    let oppPieces = [];
    
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p) {
                const val = PIECE_VALUES[p[1]] || 0;
                const isMine = p[0] === myPrefix;
                
                if (p[1] === 'K') {
                    if (isMine) myKingPos = [r, c];
                    else oppKingPos = [r, c];
                }
                
                if (isMine) {
                    myPieces.push([r, c, p[1]]);
                    score += val;
                } else {
                    oppPieces.push([r, c, p[1]]);
                    score -= val;
                }
            }
        }
    }
    
    if (myKingPos) {
        const myKingSafety = evaluateKingSafety(board, myKingPos, myPrefix);
        score += myKingSafety;
    }
    
    if (oppKingPos) {
        const oppKingSafety = evaluateKingSafety(board, oppKingPos, oppPrefix);
        score -= oppKingSafety;
    }
    
    score += evaluatePieceCoordination(board, myPieces, myPrefix);
    score -= evaluatePieceCoordination(board, oppPieces, oppPrefix);
    
    const myCentral = evaluateCentralControl(board, myPrefix);
    const oppCentral = evaluateCentralControl(board, oppPrefix);
    score += myCentral - oppCentral;
    
    return score;
}

function evaluateKingSafety(board, kingPos, color) {
    const [r, c] = kingPos;
    let safety = 0;
    const palace = color === 'r' ? [[9,3],[9,4],[9,5],[8,3],[8,4],[8,5],[7,3],[7,4],[7,5]] 
                         : [[0,3],[0,4],[0,5],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5]];
    
    const defendMap = color === 'r' ? 
        { 'A': 15, 'B': 5, 'C': 10, 'N': 5, 'R': 5, 'P': 3 } :
        { 'A': 15, 'B': 5, 'C': 10, 'N': 5, 'R': 5, 'P': 3 };
    
    for (const [pr, pc] of palace) {
        const piece = board[pr][pc];
        if (piece && piece[0] === color) {
            safety += defendMap[piece[1]] || 0;
        }
    }
    
    const threats = countKingThreats(board, [r, c], color);
    safety -= threats * 20;
    
    return safety;
}

function countKingThreats(board, kingPos, color) {
    const [r, c] = kingPos;
    let threats = 0;
    const oppColor = color === 'r' ? 'b' : 'r';
    
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                const piece = board[nr][nc];
                if (piece && piece[0] === oppColor && (piece[1] === 'R' || piece[1] === 'C' || piece[1] === 'N')) {
                    threats++;
                }
            }
        }
    }
    return threats;
}

function evaluatePieceCoordination(board, pieces, color) {
    let coord = 0;
    
    for (const [r, c, type] of pieces) {
        if (type === 'P') {
            const row = color === 'r' ? r : 9 - r;
            if (row >= 4) coord += row * 3;
        }
        
        if (type === 'C') {
            let attacks = 0;
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                let jumped = false;
                for (let i = 1; i < 10; i++) {
                    const nr = r + dr * i, nc = c + dc * i;
                    if (nr < 0 || nr >= 10 || nc < 0 || nc >= 9) break;
                    if (!jumped && board[nr][nc] === '') {
                        attacks++;
                    } else if (board[nr][nc] !== '') {
                        jumped = true;
                    }
                }
            }
            coord += attacks * 2;
        }
        
        if (type === 'N') {
            let mobility = 0;
            const horseMoves = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
            for (const [dr, dc] of horseMoves) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                    if (board[r + dr/2][c + dc/2] === '') {
                        mobility++;
                    }
                }
            }
            coord += mobility * 3;
        }
    }
    
    return coord;
}

function evaluateCentralControl(board, color) {
    let control = 0;
    const centerSquares = [[3,3],[3,4],[3,5],[4,3],[4,4],[4,5],[5,3],[5,4],[5,5],[6,3],[6,4],[6,5]];
    
    for (const [r, c] of centerSquares) {
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                    if (board[nr][nc] && board[nr][nc][0] === color) {
                        const dist = Math.abs(dr) + Math.abs(dc);
                        control += Math.max(0, 6 - dist);
                    }
                }
            }
        }
    }
    return control;
}

function quiescence(board, alpha, beta, myColor, oppColor, isMaximizing, depth) {
    const standPat = evaluateEnhanced(board, myColor);
    if (depth <= 0) return standPat;

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        const moves = generateAllMoves(board, myColor);
        const captures = moves.filter(m => {
            const t = board[m.end[0]][m.end[1]];
            return t && t[0] !== myColor[0];
        }).sort((a, b) => {
            const capA = board[a.end[0]][a.end[1]];
            const capB = board[b.end[0]][b.end[1]];
            return (PIECE_VALUES[capB?.[1]] || 0) - (PIECE_VALUES[capA?.[1]] || 0);
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

        const moves = generateAllMoves(board, oppColor);
        const captures = moves.filter(m => {
            const t = board[m.end[0]][m.end[1]];
            return t && t[0] !== oppColor[0];
        }).sort((a, b) => {
            const capA = board[a.end[0]][a.end[1]];
            const capB = board[b.end[0]][b.end[1]];
            return (PIECE_VALUES[capB?.[1]] || 0) - (PIECE_VALUES[capA?.[1]] || 0);
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

function minimax(board, depth, alpha, beta, isMaximizing, myColor, oppColor, ttMove = null) {
    const ttResult = probeTT(board, depth, alpha, beta);
    if (ttResult.found) return ttResult;

    if (depth === 0) {
        const score = quiescence(board, alpha, beta, myColor, oppColor, isMaximizing, 3);
        storeTT(board, depth, alpha, beta, null, score);
        return score;
    }

    const color = isMaximizing ? myColor : oppColor;
    let moves = generateAllMoves(board, color);
    if (moves.length === 0) {
        const score = isMaximizing ? -99999 : 99999;
        storeTT(board, depth, alpha, beta, null, score);
        return score;
    }

    moves = orderMoves(board, moves, ttMove);
    let bestMove = null;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') {
                storeTT(board, depth, alpha, beta, move, 99999);
                return 99999;
            }

            const newBoard = applyMove(board, move);
            const eval_ = minimax(newBoard, depth - 1, alpha, beta, false, myColor, oppColor);
            
            if (eval_ > maxEval) {
                maxEval = eval_;
                bestMove = move;
            }
            alpha = Math.max(alpha, eval_);
            if (beta <= alpha) break;
        }
        storeTT(board, depth, alpha, beta, bestMove, maxEval);
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') {
                storeTT(board, depth, alpha, beta, move, -99999);
                return -99999;
            }

            const newBoard = applyMove(board, move);
            const eval_ = minimax(newBoard, depth - 1, alpha, beta, true, myColor, oppColor);
            
            if (eval_ < minEval) {
                minEval = eval_;
                bestMove = move;
            }
            beta = Math.min(beta, eval_);
            if (beta <= alpha) break;
        }
        storeTT(board, depth, alpha, beta, bestMove, minEval);
        return minEval;
    }
}

function getBestMoveIterative(board, color, startDepth, maxTime) {
    const myColor = color;
    const oppColor = color === 'red' ? 'black' : 'red';
    let bestMove = null;
    const startTime = Date.now();

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        if (Date.now() - startTime > maxTime) break;
        
        let moves = generateAllMoves(board, myColor);
        if (moves.length === 0) return null;
        
        moves = orderMoves(board, moves);
        let currentBest = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            const captured = board[move.end[0]][move.end[1]];
            if (captured && captured[1] === 'K') return move;

            const newBoard = applyMove(board, move);
            const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, myColor, oppColor);

            if (score > bestScore) {
                bestScore = score;
                currentBest = move;
            }
        }

        if (currentBest) {
            bestMove = currentBest;
            console.log(`Depth ${depth}: bestScore = ${bestScore}, move = ${bestMove.start}->${bestMove.end}`);
        }
    }

    return bestMove;
}

export function getBestMove(board, depth, color) {
    tt.clear();
    return getBestMoveIterative(board, color, depth, ID_TIME_LIMIT);
}

export function getBestMoveQuick(board, color) {
    return getBestMove(board, 4, color);
}
