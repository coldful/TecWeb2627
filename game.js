"use strict";

const SIZE = 5;
const WHITE = "white";
const BLACK = "black";
const opponent = color => color === WHITE ? BLACK : WHITE;
const byId = id => document.getElementById(id);

class AlquerqueGame {
  constructor() { this.start(WHITE); }
  start(first) {
    this.board = [BLACK,BLACK,BLACK,BLACK,BLACK, BLACK,BLACK,BLACK,BLACK,BLACK, BLACK,BLACK,null,WHITE,WHITE, WHITE,WHITE,WHITE,WHITE,WHITE, WHITE,WHITE,WHITE,WHITE,WHITE];
    this.turn = first; this.selected = null; this.chainVisited = new Set(); this.finished = false;
  }
  index(row, col) { return row * SIZE + col; }
  position(index) { return [Math.floor(index / SIZE), index % SIZE]; }
  connected(from, to) {
    const [r1,c1] = this.position(from), [r2,c2] = this.position(to);
    const dr = Math.abs(r2-r1), dc = Math.abs(c2-c1);
    if (dr + dc === 1) return true;
    return dr === 1 && dc === 1 && (r1 + c1) % 2 === 0;
  }
  destinations(from, captureOnly = false) {
    const piece = this.board[from]; if (!piece) return [];
    const [row,col] = this.position(from), moves = [];
    for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
      if (!dr && !dc) continue;
      const adjacentRow=row+dr, adjacentCol=col+dc;
      if (adjacentRow<0||adjacentRow>=SIZE||adjacentCol<0||adjacentCol>=SIZE) continue;
      const adjacent=this.index(adjacentRow,adjacentCol);
      if (!this.connected(from,adjacent)) continue;
      if (this.board[adjacent] === opponent(piece)) {
        const jumpRow=row+2*dr, jumpCol=col+2*dc;
        if (jumpRow>=0&&jumpRow<SIZE&&jumpCol>=0&&jumpCol<SIZE) {
          const landing=this.index(jumpRow,jumpCol);
          if (this.connected(adjacent,landing) && !this.board[landing] && !this.chainVisited.has(landing)) moves.push({to:landing,capture:adjacent});
        }
      } else if (!captureOnly && !this.board[adjacent]) {
        const forward = piece === WHITE ? dr < 0 : dr > 0;
        const finalRow = piece === WHITE ? row === 0 : row === SIZE-1;
        if ((finalRow && dr === 0) || (!finalRow && forward)) moves.push({to:adjacent,capture:null});
      }
    }
    return moves;
  }
  allCaptures(color) { return this.board.flatMap((p,index) => p === color ? this.destinations(index,true).map(move => ({from:index,...move})) : []); }
  allMoves(color) { const captures=this.allCaptures(color); return captures.length ? captures : this.board.flatMap((p,index) => p === color ? this.destinations(index).map(move => ({from:index,...move})) : []); }
  apply(move) { const piece=this.board[move.from]; this.board[move.to]=piece; this.board[move.from]=null; if(move.capture!==null) this.board[move.capture]=null; }
  count(color) { return this.board.filter(piece => piece === color).length; }
}

const game = new AlquerqueGame();
let messageKind = "info";

function setMessage(text, kind="info") { byId("message").textContent=text; byId("message").className=`message ${kind}`; messageKind=kind; }
function playerName(color) { return color === WHITE ? "Claras" : "Escuras"; }
function createBoard() {
  const board=byId("board"); board.replaceChildren();
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  const addLine=(r1,c1,r2,c2) => { const line=document.createElementNS("http://www.w3.org/2000/svg","line"); line.setAttribute("x1",`${c1*25}%`); line.setAttribute("y1",`${r1*25}%`); line.setAttribute("x2",`${c2*25}%`); line.setAttribute("y2",`${r2*25}%`); svg.append(line); };
  for(let i=0;i<SIZE;i++){ addLine(i,0,i,4); addLine(0,i,4,i); }
  [[0,0,4,4],[0,4,4,0],[0,2,2,0],[0,2,2,4],[2,0,4,2],[2,4,4,2]].forEach(line=>addLine(...line));
  board.append(svg);
  for(let row=0;row<SIZE;row++) for(let col=0;col<SIZE;col++) {
    const index=game.index(row,col), point=document.createElement("button"); point.type="button"; point.className="point"; point.style.left=`${col*25}%`; point.style.top=`${row*25}%`; point.dataset.index=index; point.setAttribute("role","gridcell"); point.setAttribute("aria-label",`posição ${row+1}, ${col+1}`); point.addEventListener("click",onPointClick); board.append(point);
  }
}
function legalMovesForSelected() { if(game.selected === null) return []; const captures=game.destinations(game.selected,true); return captures.length ? captures : (game.chainVisited.size ? [] : game.destinations(game.selected)); }
function render() {
  byId("white-count").textContent=`${game.count(WHITE)} peças`; byId("black-count").textContent=`${game.count(BLACK)} peças`;
  const turnCard=byId("turn-card"); turnCard.innerHTML=`<span class="turn-dot ${game.turn}"></span><span>${game.finished ? "Partida terminada" : `${playerName(game.turn)} jogam`}</span>`;
  const legal=new Map(legalMovesForSelected().map(move=>[move.to,move]));
  document.querySelectorAll(".point").forEach(point=>{ const index=Number(point.dataset.index), piece=game.board[index]; point.classList.toggle("selected",index===game.selected); point.classList.toggle("legal",legal.has(index)); point.disabled=game.finished; point.replaceChildren(); if(piece){const stone=document.createElement("span"); stone.className=`piece ${piece}-piece`; stone.setAttribute("aria-hidden","true"); point.append(stone); point.setAttribute("aria-label",`${piece===WHITE?"peça clara":"peça escura"}, posição ${Math.floor(index/5)+1}, ${index%5+1}`);} });
}
function finish(result,winner=null) { game.finished=true; const record={result,winner:winner?playerName(winner):"—",date:new Date().toLocaleDateString("pt-PT")}; const scores=JSON.parse(localStorage.getItem("alquerque-scores")||"[]"); scores.unshift(record); localStorage.setItem("alquerque-scores",JSON.stringify(scores.slice(0,12))); setMessage(winner?`${playerName(winner)} vencem!`:"Empate acordado.","success"); render(); }
function changeTurn() { game.selected=null; game.chainVisited.clear(); game.turn=opponent(game.turn); const moves=game.allMoves(game.turn); if(!moves.length) { finish("sem movimentos",opponent(game.turn)); return; } setMessage(`${playerName(game.turn)} jogam. ${game.allCaptures(game.turn).length ? "Há uma captura obrigatória." : "Selecione uma peça."}`); render(); }
function onPointClick(event) {
  const index=Number(event.currentTarget.dataset.index); if(game.finished) return;
  if(game.selected !== null) { const move=legalMovesForSelected().find(item=>item.to===index); if(move) { move.from=game.selected; game.apply(move); if(move.capture!==null) { game.selected=move.to; game.chainVisited.add(move.to); const more=game.destinations(game.selected,true); if(more.length) { setMessage("Captura feita. Continue a sequência com a mesma peça.","success"); render(); return; } setMessage("Sequência de capturas concluída.","success"); } changeTurn(); return; } }
  if(game.board[index] !== game.turn) { setMessage(`Selecione uma peça ${game.turn===WHITE?"clara":"escura"}.`,"warning"); return; }
  const captures=game.allCaptures(game.turn); const ownCaptures=game.destinations(index,true); if(captures.length && !ownCaptures.length) { setMessage("Existe uma captura obrigatória com outra peça.","warning"); return; }
  game.selected=index; const options=legalMovesForSelected(); setMessage(options.length ? (ownCaptures.length ? "Escolha onde capturar." : "Escolha um ponto destacado.") : "Esta peça não tem movimentos possíveis.",options.length?"info":"warning"); render();
}
function openDialog(id) { byId(id).showModal(); }
function renderScores() { const scores=JSON.parse(localStorage.getItem("alquerque-scores")||"[]"); const body=byId("scores-body"); body.replaceChildren(); if(!scores.length){const row=body.insertRow();const cell=row.insertCell();cell.colSpan=3;cell.textContent="Ainda não há partidas terminadas.";return;} scores.forEach(score=>{const row=body.insertRow(); [score.result,score.winner,score.date].forEach(value=>row.insertCell().textContent=value);}); }
byId("settings-form").addEventListener("submit",event=>{event.preventDefault(); game.start(document.querySelector('input[name="first-player"]:checked').value); createBoard(); setMessage(`${playerName(game.turn)} começam. Selecione uma peça.`); render();});
byId("rules-button").addEventListener("click",()=>openDialog("rules-dialog")); byId("rules-inline-button").addEventListener("click",()=>openDialog("rules-dialog"));
byId("draw-button").addEventListener("click",()=>{if(!game.finished)openDialog("draw-dialog");}); byId("accept-draw").addEventListener("click",()=>{byId("draw-dialog").close();finish("empate");});
byId("resign-button").addEventListener("click",()=>{if(!game.finished&&window.confirm(`${playerName(game.turn)} desistem da partida?`))finish("desistência",opponent(game.turn));});
byId("scores-button").addEventListener("click",()=>{renderScores();openDialog("scores-dialog");});
byId("login-button").addEventListener("click",()=>setMessage("A autenticação estará disponível numa próxima entrega.","info"));
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>byId(button.dataset.close).close()));
createBoard(); render();
