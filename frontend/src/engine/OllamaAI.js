import { generateAllMoves, applyMove } from './GameLogic.js';
import { getBestMove } from './MinimaxAI.js';

export async function getOllamaMove(board, color) {
    // Step 1: Always generate moves and get Minimax's best recommendation
    const moves = generateAllMoves(board, color);
    if (moves.length === 0) return null;

    // Step 2: Use Minimax as the primary brain (depth 4 for stronger play)
    const minimaxMove = getBestMove(board, 4, color);

    // Step 3: Try Ollama as an advisor (optional, may fail)
    try {
        let boardStr = "";
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c]) boardStr += `[${r},${c}]=${board[r][c]} `;
            }
            boardStr += "\n";
        }
        const movesText = moves.slice(0, 30).map(m =>
            `[${m.start[0]},${m.start[1]} -> ${m.end[0]},${m.end[1]}]`
        ).join(" | ");

        const prompt = `You are a Chinese Chess engine playing as ${color}.\n` +
            `Current board:\n${boardStr}\n` +
            `Legal moves:\n${movesText}\n\n` +
            `Pick the BEST strategic move. Output ONLY 4 numbers: start_row,start_col,end_row,end_col\n` +
            `Example: 0,1,2,2\nDo not explain.`;

        console.log("Asking Ollama for strategic advice...");
        const isProxied = !window.location.port || window.location.port === '80' || window.location.port === '443';
        const apiBase = isProxied ? '' : `http://${window.location.hostname}:3000`;
        const res = await fetch(`${apiBase}/api/ai_move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.1:8b",
                messages: [{ role: "user", content: prompt }],
                stream: false
            })
        });
        const data = await res.json();
        const reply = data.message.content.trim();
        console.log("Ollama suggested:", reply);

        const match = reply.match(/(\d+)[^0-9]+(\d+)[^0-9]+(\d+)[^0-9]+(\d+)/);
        if (match) {
            const ollamaMove = {
                start: [parseInt(match[1]), parseInt(match[2])],
                end: [parseInt(match[3]), parseInt(match[4])]
            };
            const isLegal = moves.some(m =>
                m.start[0] === ollamaMove.start[0] && m.start[1] === ollamaMove.start[1] &&
                m.end[0] === ollamaMove.end[0] && m.end[1] === ollamaMove.end[1]
            );
            if (isLegal) {
                console.log("Using Ollama's move (it was legal!)");
                return ollamaMove;
            }
            console.warn("Ollama move was illegal, using Minimax instead.");
        }
    } catch (err) {
        console.warn("Ollama unavailable, using Minimax:", err.message);
    }

    // Step 4: Fallback to Minimax (always reliable)
    console.log("Using Minimax AI move.");
    return minimaxMove || moves[0];
}
