export const STARTING_BOARD = [
    ['bR', 'bN', 'bB', 'bA', 'bK', 'bA', 'bB', 'bN', 'bR'],
    ['', '', '', '', '', '', '', '', ''],
    ['', 'bC', '', '', '', '', '', 'bC', ''],
    ['bP', '', 'bP', '', 'bP', '', 'bP', '', 'bP'],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['rP', '', 'rP', '', 'rP', '', 'rP', '', 'rP'],
    ['', 'rC', '', '', '', '', '', 'rC', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['rR', 'rN', 'rB', 'rA', 'rK', 'rA', 'rB', 'rN', 'rR']
];

function inBounds(r, c) { return r >= 0 && r <= 9 && c >= 0 && c <= 8; }

// Generate moves for a specific piece (fast, per-piece-type)
function pieceMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const moves = [];

    function tryAdd(er, ec) {
        if (!inBounds(er, ec)) return false;
        const target = board[er][ec];
        if (target && target[0] === color) return false; // own piece
        moves.push({ start: [r, c], end: [er, ec] });
        return !target; // return true if empty (can continue sliding)
    }

    if (type === 'R') {
        // Rook: slide in 4 directions
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            for (let i = 1; i < 10; i++) {
                if (!tryAdd(r + dr * i, c + dc * i)) break;
            }
        }
    }
    else if (type === 'C') {
        // Cannon: slide for moving, jump over 1 piece for capturing
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            let jumped = false;
            for (let i = 1; i < 10; i++) {
                const nr = r + dr * i, nc = c + dc * i;
                if (!inBounds(nr, nc)) break;
                const target = board[nr][nc];
                if (!jumped) {
                    if (target === '') {
                        moves.push({ start: [r, c], end: [nr, nc] });
                    } else {
                        jumped = true; // found the platform
                    }
                } else {
                    if (target !== '') {
                        if (target[0] !== color) {
                            moves.push({ start: [r, c], end: [nr, nc] });
                        }
                        break; // stop after capturing or hitting own piece
                    }
                }
            }
        }
    }
    else if (type === 'N') {
        // Horse: L-shape with blocking leg
        const horseMoves = [
            [-2, -1, -1, 0], [-2, 1, -1, 0],
            [2, -1, 1, 0], [2, 1, 1, 0],
            [-1, -2, 0, -1], [-1, 2, 0, 1],
            [1, -2, 0, -1], [1, 2, 0, 1]
        ];
        for (const [dr, dc, br, bc] of horseMoves) {
            const nr = r + dr, nc = c + dc;
            if (inBounds(nr, nc) && board[r + br][c + bc] === '') {
                const target = board[nr][nc];
                if (!target || target[0] !== color) {
                    moves.push({ start: [r, c], end: [nr, nc] });
                }
            }
        }
    }
    else if (type === 'B') {
        // Bishop/Elephant: diagonal 2 steps, blocked by eye, cannot cross river
        for (const [dr, dc] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
            const nr = r + dr, nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            if (color === 'r' && nr < 5) continue; // cannot cross river
            if (color === 'b' && nr > 4) continue;
            if (board[r + dr / 2][c + dc / 2] !== '') continue; // eye blocked
            const target = board[nr][nc];
            if (!target || target[0] !== color) {
                moves.push({ start: [r, c], end: [nr, nc] });
            }
        }
    }
    else if (type === 'A') {
        // Advisor: diagonal 1 step within palace
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (nc < 3 || nc > 5) continue;
            if (color === 'r' && (nr < 7 || nr > 9)) continue;
            if (color === 'b' && (nr < 0 || nr > 2)) continue;
            const target = board[nr][nc];
            if (!target || target[0] !== color) {
                moves.push({ start: [r, c], end: [nr, nc] });
            }
        }
    }
    else if (type === 'K') {
        // King: orthogonal 1 step within palace
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nr = r + dr, nc = c + dc;
            if (nc < 3 || nc > 5) continue;
            if (color === 'r' && (nr < 7 || nr > 9)) continue;
            if (color === 'b' && (nr < 0 || nr > 2)) continue;
            const target = board[nr][nc];
            if (!target || target[0] !== color) {
                moves.push({ start: [r, c], end: [nr, nc] });
            }
        }
        // Flying General: if two kings face each other on the same column with nothing in between
        const oppKing = color === 'r' ? 'bK' : 'rK';
        for (let dr = (color === 'r' ? -1 : 1); color === 'r' ? (r + dr >= 0) : (r + dr <= 9);
            dr += (color === 'r' ? -1 : 1)) {
            const nr = r + dr;
            if (board[nr][c] !== '') {
                if (board[nr][c] === oppKing) {
                    moves.push({ start: [r, c], end: [nr, c] });
                }
                break;
            }
        }
    }
    else if (type === 'P') {
        // Pawn: forward only before crossing river, forward/left/right after
        if (color === 'r') {
            // Red moves upward (decreasing row)
            tryAdd(r - 1, c); // forward
            if (r <= 4) { // crossed river
                tryAdd(r, c - 1);
                tryAdd(r, c + 1);
            }
        } else {
            // Black moves downward (increasing row)
            tryAdd(r + 1, c);
            if (r >= 5) { // crossed river
                tryAdd(r, c - 1);
                tryAdd(r, c + 1);
            }
        }
    }

    return moves;
}


export function applyMove(board, move) {
    const newBoard = board.map(row => [...row]);
    const { start, end } = move;
    newBoard[end[0]][end[1]] = newBoard[start[0]][start[1]];
    newBoard[start[0]][start[1]] = '';
    return newBoard;
}

export function isKingInCheck(board, color) {
    const prefix = color[0];
    let kingPos = null;
    
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p && p[0] === prefix && p[1] === 'K') {
                kingPos = [r, c];
                break;
            }
        }
        if (kingPos) break;
    }
    
    if (!kingPos) return false;
    
    const oppPrefix = prefix === 'r' ? 'b' : 'r';
    const oppMoves = generateAllMoves(board, oppPrefix === 'r' ? 'red' : 'black');
    
    return oppMoves.some(m => m.end[0] === kingPos[0] && m.end[1] === kingPos[1]);
}

export function hasLegalMoves(board, color) {
    const moves = generateAllMoves(board, color);
    for (const move of moves) {
        const tempBoard = applyMove(board, move);
        if (!isKingInCheck(tempBoard, color)) {
            return true;
        }
    }
    return false;
}

export function generateAllMoves(board, color) {
    const prefix = color[0];
    let moves = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] && board[r][c][0] === prefix) {
                const pm = pieceMoves(board, r, c);
                for (const m of pm) moves.push(m);
            }
        }
    }
    return moves;
}

export function getGameStatus(board, turn) {
    const inCheck = isKingInCheck(board, turn);
    const hasMoves = hasLegalMoves(board, turn);
    
    if (!hasMoves) {
        return inCheck ? 'checkmate' : 'stalemate';
    }
    return inCheck ? 'check' : 'playing';
}

// --- Evaluation ---
const PIECE_VALUES = { 'K': 10000, 'R': 1000, 'C': 500, 'N': 450, 'B': 200, 'A': 200, 'P': 100 };

// Piece-square tables (bonus by position) for red; mirror for black
const PST_PAWN_RED = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 6, 12, 18, 18, 18, 12, 6, 2],
    [6, 12, 18, 30, 30, 30, 18, 12, 6],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const PST_KNIGHT = [
    [4, 8, 16, 12, 4, 12, 16, 8, 4],
    [4, 10, 28, 16, 8, 16, 28, 10, 4],
    [12, 14, 16, 20, 18, 20, 16, 14, 12],
    [8, 24, 18, 24, 20, 24, 18, 24, 8],
    [6, 16, 14, 18, 16, 18, 14, 16, 6],
    [6, 16, 14, 18, 16, 18, 14, 16, 6],
    [8, 24, 18, 24, 20, 24, 18, 24, 8],
    [12, 14, 16, 20, 18, 20, 16, 14, 12],
    [4, 10, 28, 16, 8, 16, 28, 10, 4],
    [4, 8, 16, 12, 4, 12, 16, 8, 4],
];

const PST_ROOK = [
    [6, 8, 6, 14, 14, 14, 6, 8, 6],
    [8, 12, 10, 14, 16, 14, 10, 12, 8],
    [4, 6, 8, 12, 14, 12, 8, 6, 4],
    [6, 8, 8, 12, 14, 12, 8, 8, 6],
    [6, 8, 6, 8, 12, 8, 6, 8, 6],
    [6, 8, 6, 8, 12, 8, 6, 8, 6],
    [6, 8, 8, 12, 14, 12, 8, 8, 6],
    [4, 6, 8, 12, 14, 12, 8, 6, 4],
    [8, 12, 10, 14, 16, 14, 10, 12, 8],
    [6, 8, 6, 14, 14, 14, 6, 8, 6],
];

const PST_CANNON = [
    [0, 0, 2, 6, 6, 6, 2, 0, 0],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [4, 0, 8, 6, 10, 6, 8, 0, 4],
    [0, 0, 0, 2, 4, 2, 0, 0, 0],
    [2, 2, 0, 0, 0, 0, 0, 2, 2],
    [2, 2, 0, 0, 0, 0, 0, 2, 2],
    [0, 0, 0, 2, 4, 2, 0, 0, 0],
    [4, 0, 8, 6, 10, 6, 8, 0, 4],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 0, 2, 6, 6, 6, 2, 0, 0],
];

const PST_BISHOP = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 0, 4, 0, 6, 0, 4, 0, 4],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const PST_ADVISOR = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 2, 0, 4, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 2, 0, 4, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function getPST(type, color, r, c) {
    if (type === 'P') {
        const row = color === 'r' ? r : (9 - r);
        return PST_PAWN_RED[row][c];
    }
    if (type === 'N') return PST_KNIGHT[r][c];
    if (type === 'R') return PST_ROOK[r][c];
    if (type === 'C') return PST_CANNON[r][c];
    if (type === 'B') {
        const row = color === 'r' ? r : (9 - r);
        return PST_BISHOP[row][c];
    }
    if (type === 'A') {
        const row = color === 'r' ? r : (9 - r);
        return PST_ADVISOR[row][c];
    }
    return 0;
}

export function isValidMove(board, start, end, turn) {
    const [sr, sc] = start;
    const [er, ec] = end;
    if (!inBounds(sr, sc) || !inBounds(er, ec)) return false;
    if (sr === er && sc === ec) return false;
    const piece = board[sr][sc];
    if (!piece || piece[0] !== (turn === 'red' ? 'r' : 'b')) return false;
    const target = board[er][ec];
    if (target && target[0] === piece[0]) return false;

    const validMoves = pieceMoves(board, sr, sc);
    if (!validMoves.some(m => m.end[0] === er && m.end[1] === ec)) return false;

    const tempBoard = applyMove(board, { start, end });
    if (isKingInCheck(tempBoard, turn)) return false;

    return true;
}

export function evaluateBoard(board, color) {
    let score = 0;
    const myPrefix = color[0];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p) {
                const val = PIECE_VALUES[p[1]] || 0;
                const pst = getPST(p[1], p[0], r, c);
                if (p[0] === myPrefix) {
                    score += val + pst;
                } else {
                    score -= val + pst;
                }
            }
        }
    }
    return score;
}
