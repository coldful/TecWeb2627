"use strict";

const SIZE = 5;
const WHITE = "white";
const BLACK = "black";
const HUMAN = WHITE;
const COMPUTER = BLACK;

const opponent = color => (color === WHITE ? BLACK : WHITE);
const byId = id => document.getElementById(id);

class AlquerqueGame {
  constructor() {
    this.start(HUMAN);
  }

  start(firstPlayer) {
    this.board = [
      BLACK, BLACK, BLACK, BLACK, BLACK,
      BLACK, BLACK, BLACK, BLACK, BLACK,
      BLACK, BLACK, null, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE, WHITE,
      WHITE, WHITE, WHITE, WHITE, WHITE
    ];
    this.turn = firstPlayer;
    this.selected = null;
    this.chainVisited = new Set();
    this.blowable = new Set();
    this.finished = false;
  }

  index(row, col) {
    return row * SIZE + col;
  }

  position(index) {
    return [Math.floor(index / SIZE), index % SIZE];
  }

  connected(from, to) {
    const [row1, col1] = this.position(from);
    const [row2, col2] = this.position(to);
    const rowDistance = Math.abs(row2 - row1);
    const colDistance = Math.abs(col2 - col1);

    return rowDistance + colDistance === 1 ||
      (rowDistance === 1 && colDistance === 1 && (row1 + col1) % 2 === 0);
  }

  apply(move) {
    this.board[move.to] = this.board[move.from];
    this.board[move.from] = null;
    if (move.capture !== null) this.board[move.capture] = null;
  }
}

const game = new AlquerqueGame();
let computerThinking = false;
let chainTimer = null;
const MULTI_CAPTURE_TIME = 6000;

function destinationsOn(board, from, captureOnly = false, visited = new Set()) {
  const piece = board[from];
  if (!piece) return [];

  const [row, col] = game.position(from);
  const moves = [];

  for (let rowStep = -1; rowStep <= 1; rowStep++) {
    for (let colStep = -1; colStep <= 1; colStep++) {
      if (!rowStep && !colStep) continue;

      const adjacentRow = row + rowStep;
      const adjacentCol = col + colStep;
      if (
        adjacentRow < 0 || adjacentRow >= SIZE ||
        adjacentCol < 0 || adjacentCol >= SIZE
      ) continue;

      const adjacent = game.index(adjacentRow, adjacentCol);
      if (!game.connected(from, adjacent)) continue;

      if (board[adjacent] === opponent(piece)) {
        const landingRow = row + 2 * rowStep;
        const landingCol = col + 2 * colStep;
        if (
          landingRow < 0 || landingRow >= SIZE ||
          landingCol < 0 || landingCol >= SIZE
        ) continue;

        const landing = game.index(landingRow, landingCol);
        if (
          game.connected(adjacent, landing) &&
          !board[landing] &&
          !visited.has(landing)
        ) moves.push({ to: landing, capture: adjacent });
      } else if (!captureOnly && !board[adjacent]) {
        const canMoveForward = piece === WHITE ? rowStep <= 0 : rowStep >= 0;
        const finalRow = piece === WHITE ? row === 0 : row === SIZE - 1;
        if (finalRow ? rowStep === 0 : canMoveForward) {
          moves.push({ to: adjacent, capture: null });
        }
      }
    }
  }

  return moves;
}

function destinations(from, captureOnly = false) {
  return destinationsOn(game.board, from, captureOnly, game.chainVisited);
}

function allMoves(color) {
  return game.board.flatMap((piece, from) =>
    piece === color
      ? destinations(from).map(move => ({ from, ...move }))
      : []
  );
}

function allCaptures(color) {
  return game.board.flatMap((piece, from) =>
    piece === color
      ? destinations(from, true).map(move => ({ from, ...move }))
      : []
  );
}

function legalMovesForSelected() {
  if (game.selected === null) return [];
  return game.chainVisited.size
    ? destinations(game.selected, true)
    : destinations(game.selected);
}

function createBoard() {
  const board = byId("board");
  board.replaceChildren();

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const addLine = (row1, col1, row2, col2) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", `${col1 * 25}%`);
    line.setAttribute("y1", `${row1 * 25}%`);
    line.setAttribute("x2", `${col2 * 25}%`);
    line.setAttribute("y2", `${row2 * 25}%`);
    svg.append(line);
  };

  for (let index = 0; index < SIZE; index++) {
    addLine(index, 0, index, 4);
    addLine(0, index, 4, index);
  }
  [[0,0,4,4], [0,4,4,0], [0,2,2,0], [0,2,2,4], [2,0,4,2], [2,4,4,2]]
    .forEach(line => addLine(...line));
  board.append(svg);

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const point = document.createElement("button");
      point.type = "button";
      point.className = "point";
      point.style.left = `${col * 25}%`;
      point.style.top = `${row * 25}%`;
      point.dataset.index = game.index(row, col);
      point.addEventListener("click", onPointClick);
      board.append(point);
    }
  }
}

function setMessage(text, type = "info") {
  const message = byId("message");
  message.textContent = text;
  message.className = `message ${type}`;
}

function render() {
  const legalDestinations = new Set(legalMovesForSelected().map(move => move.to));
  document.querySelectorAll(".point").forEach(point => {
    const index = Number(point.dataset.index);
    const piece = game.board[index];
    point.classList.toggle("selected", index === game.selected);
    point.classList.toggle("legal", legalDestinations.has(index));
    point.classList.toggle("blowable", game.blowable.has(index));
    point.disabled = game.finished || computerThinking || game.turn === COMPUTER;
    point.replaceChildren();

    if (piece) {
      const stone = document.createElement("span");
      stone.className = `piece ${piece}-piece`;
      stone.setAttribute("aria-hidden", "true");
      point.append(stone);
    }
  });
}

function clearChainTimer() {
  if (chainTimer !== null) clearTimeout(chainTimer);
  chainTimer = null;
}

function changeTurn(blowable = [], note = null) {
  clearChainTimer();
  game.selected = null;
  game.chainVisited.clear();
  game.blowable = new Set(blowable);
  game.turn = opponent(game.turn);

  if (!allMoves(game.turn).length && !game.blowable.size) {
    finish("sem movimentos", opponent(game.turn));
    return;
  }

  if (game.turn === COMPUTER) {
    computerThinking = true;
    setMessage(note || "O computador está a pensar…", note ? "warning" : "info");
    render();
    window.setTimeout(computerMove, note ? 1800 : 400);
    return;
  }

  setMessage(note || "A sua vez. Selecione uma peça.", note ? "warning" : "info");
  render();
}

function computerMove() {
  if (game.blowable.size) {
    game.board[game.blowable.values().next().value] = null;
    game.blowable.clear();
  }

  const difficulty = byId("difficulty").value;
  if (difficulty === "easy") {
    const moves = allMoves(COMPUTER);
    if (!moves.length) return finish("sem movimentos", HUMAN);
    const capturers = new Set(allCaptures(COMPUTER).map(move => move.from));
    const move = moves[Math.floor(Math.random() * moves.length)];
    game.apply(move);
    computerThinking = false;

    if (move.capture === null && capturers.size) {
      const blowable = [...capturers].map(from =>
        from === move.from ? move.to : from
      );
      changeTurn(
        blowable,
        "O computador não capturou: uma peça pode ser soprada."
      );
    } else {
      changeTurn();
    }
    return;
  }

  const move = AlquerqueAI.chooseMove({
    board: game.board,
    computer: COMPUTER,
    human: HUMAN,
    depth: difficulty === "hard" ? 5 : 3,
    destinations: destinationsOn
  });
  move.steps.forEach(step => game.apply(step));
  computerThinking = false;
  changeTurn();
}

function onPointClick(event) {
  const index = Number(event.currentTarget.dataset.index);
  if (game.finished || computerThinking || game.turn !== HUMAN) return;

  if (game.blowable.has(index) && !game.chainVisited.size) {
    game.board[index] = null;
    game.blowable.clear();
    setMessage("Peça soprada! Continue o seu turno.", "success");
    render();
    return;
  }

  const move = legalMovesForSelected().find(item => item.to === index);
  if (game.selected !== null && move) {
    clearChainTimer();
    move.from = game.selected;
    const capturers = new Set(allCaptures(HUMAN).map(item => item.from));
    game.blowable.clear();
    game.apply(move);

    if (move.capture !== null) {
      game.chainVisited.add(move.from);
      game.chainVisited.add(move.to);
      game.selected = move.to;

      if (destinations(game.selected, true).length) {
        setMessage("Captura feita! Tem 6 segundos para continuar.", "warning");
        render();
        chainTimer = window.setTimeout(() => {
          if (game.selected !== null) {
            changeTurn([game.selected], "Captura múltipla não concluída: a peça pode ser soprada.");
          }
        }, MULTI_CAPTURE_TIME);
        return;
      }
    }

    if (move.capture === null && capturers.size) {
      const blowable = [...capturers].map(from =>
        from === move.from ? move.to : from
      );
      changeTurn(
        blowable,
        "Não capturou: o computador pode soprar uma peça."
      );
    } else {
      changeTurn();
    }
    return;
  }

  if (game.chainVisited.size) {
    setMessage("Continue a sequência com a mesma peça.", "warning");
    return;
  }
  if (game.board[index] !== HUMAN) {
    setMessage("Selecione uma peça clara.", "warning");
    return;
  }

  game.selected = index;
  setMessage(
    legalMovesForSelected().length
      ? "Escolha um ponto destacado."
      : "Esta peça não tem movimentos possíveis."
  );
  render();
}

function finish(result, winner = null) {
  clearChainTimer();
  game.finished = true;
  game.blowable.clear();
  computerThinking = false;
  const scores = JSON.parse(localStorage.getItem("alquerque-scores") || "[]");
  scores.unshift({
    result,
    winner: winner === null ? "—" : winner === HUMAN ? "Claras" : "Escuras",
    date: new Date().toLocaleDateString("pt-PT")
  });
  localStorage.setItem("alquerque-scores", JSON.stringify(scores.slice(0, 12)));
  setMessage(winner ? `${winner === HUMAN ? "Venceu" : "O computador venceu"}!` : "Empate acordado.", "success");
  render();
}

function computerAcceptsDraw() {
  const computerPieces = game.board.filter(piece => piece === COMPUTER).length;
  const humanPieces = game.board.filter(piece => piece === HUMAN).length;
  const computerMoves = AlquerqueAI.getTurnMoves(
    game.board,
    COMPUTER,
    destinationsOn
  ).length;
  const humanMoves = AlquerqueAI.getTurnMoves(
    game.board,
    HUMAN,
    destinationsOn
  ).length;

  const positionScore =
    (computerPieces - humanPieces) * 10 + computerMoves - humanMoves;
  return positionScore <= 0;
}

function openDialog(id) {
  byId(id).showModal();
}

function selectAccountTab(tabName) {
  const history = tabName === "history";
  byId("history-tab").classList.toggle("active", history);
  byId("history-tab").setAttribute("aria-selected", history);
  byId("register-tab").classList.toggle("active", !history);
  byId("register-tab").setAttribute("aria-selected", !history);
  byId("history-panel").hidden = !history;
  byId("register-panel").hidden = history;
}

function renderScores() {
  const scores = JSON.parse(localStorage.getItem("alquerque-scores") || "[]");
  const body = byId("scores-body");
  body.replaceChildren();
  byId("scores-empty").hidden = scores.length > 0;
  byId("scores-table").hidden = scores.length === 0;

  scores.forEach(score => {
    const row = body.insertRow();
    [score.result, score.winner, score.date].forEach(value => {
      row.insertCell().textContent = value;
    });
  });
}

byId("settings-form").addEventListener("submit", event => {
  event.preventDefault();
  game.start(HUMAN);
  createBoard();
  setMessage("A sua vez. Selecione uma peça.");
  render();
});
byId("rules-button").addEventListener("click", () => openDialog("rules-dialog"));
byId("account-button").addEventListener("click", () => {
  renderScores();
  selectAccountTab("history");
  openDialog("account-dialog");
});
byId("history-tab").addEventListener("click", () => {
  renderScores();
  selectAccountTab("history");
});
byId("register-tab").addEventListener("click", () => selectAccountTab("register"));
byId("login-form").addEventListener("submit", event => {
  event.preventDefault();
  setMessage("A autenticação estará disponível numa próxima entrega.");
});
byId("draw-button").addEventListener("click", () => !game.finished && openDialog("draw-dialog"));
byId("accept-draw").addEventListener("click", () => {
  byId("draw-dialog").close();
  if (computerAcceptsDraw()) {
    finish("empate");
  } else {
    setMessage("O computador recusou o empate.", "warning");
  }
});
byId("resign-button").addEventListener("click", () => {
  if (!game.finished && window.confirm("Desiste da partida?")) {
    finish("desistência", COMPUTER);
  }
});
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => byId(button.dataset.close).close());
});

createBoard();
render();
