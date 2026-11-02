"use strict";

window.AlquerqueAI = (() => {
  function applyMove(board, move) {
    const next = board.slice();
    next[move.to] = next[move.from];
    next[move.from] = null;

    if (move.capture !== null) next[move.capture] = null;
    return next;
  }

  function boardAfter(board, move) {
    return move.steps.reduce(applyMove, board);
  }

  function getTurnMoves(board, color, destinations) {
    const firstCaptures = [];

    board.forEach((piece, from) => {
      if (piece !== color) return;
      destinations(board, from, true).forEach(move => {
        firstCaptures.push({ from, ...move });
      });
    });

    if (!firstCaptures.length) {
      return board.flatMap((piece, from) => {
        if (piece !== color) return [];
        return destinations(board, from).map(move => ({
          steps: [{ from, ...move }],
          captures: 0
        }));
      });
    }

    const completeMoves = [];

    function followCaptures(boardState, step, steps, visited) {
      const nextBoard = applyMove(boardState, step);
      const nextVisited = new Set(visited);
      nextVisited.add(step.from);
      nextVisited.add(step.to);

      const following = destinations(nextBoard, step.to, true, nextVisited);
      if (!following.length) {
        completeMoves.push({
          steps: [...steps, step],
          captures: steps.length + 1
        });
        return;
      }

      following.forEach(move => {
        followCaptures(
          nextBoard,
          { from: step.to, ...move },
          [...steps, step],
          nextVisited
        );
      });
    }

    firstCaptures.forEach(move => followCaptures(board, move, [], new Set()));
    return completeMoves;
  }

  function chooseMove({ board, computer, human, depth, destinations }) {
    const movesFor = (state, color) =>
      getTurnMoves(state, color, destinations);

    function evaluate(state) {
      const computerPieces = state.filter(piece => piece === computer).length;
      const humanPieces = state.filter(piece => piece === human).length;
      const mobility = movesFor(state, computer).length - movesFor(state, human).length;
      return (computerPieces - humanPieces) * 100 + mobility;
    }

    function minimax(state, color, remainingDepth, alpha, beta) {
      const moves = movesFor(state, color);

      if (!moves.length) {
        return { score: color === computer ? -100000 : 100000 };
      }

      if (remainingDepth === 0) return { score: evaluate(state) };

      let bestMove = null;
      let bestScore = color === computer ? -Infinity : Infinity;

      for (const move of moves) {
        const score = minimax(
          boardAfter(state, move),
          color === computer ? human : computer,
          remainingDepth - 1,
          alpha,
          beta
        ).score;

        if (
          (color === computer && score > bestScore) ||
          (color === human && score < bestScore)
        ) {
          bestScore = score;
          bestMove = move;
        }

        if (color === computer) alpha = Math.max(alpha, bestScore);
        else beta = Math.min(beta, bestScore);
        if (beta <= alpha) break;
      }

      return { score: bestScore, move: bestMove };
    }

    return minimax(board, computer, depth, -Infinity, Infinity).move;
  }

  return { getTurnMoves, chooseMove };
})();
