"use strict";

const SIZE=5, WHITE="white", BLACK="black", HUMAN=WHITE, COMPUTER=BLACK;
const opponent=color=>color===WHITE?BLACK:WHITE;
const byId=id=>document.getElementById(id);
class AlquerqueGame {
  constructor(){this.start(HUMAN);}
  start(first){this.board=[BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,BLACK,null,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE];this.turn=first;this.selected=null;this.chainVisited=new Set();this.finished=false;}
  index(row,col){return row*SIZE+col;}
  position(index){return[Math.floor(index/SIZE),index%SIZE];}
  connected(from,to){const[r1,c1]=this.position(from),[r2,c2]=this.position(to),dr=Math.abs(r2-r1),dc=Math.abs(c2-c1);return dr+dc===1||(dr===1&&dc===1&&(r1+c1)%2===0);}
  destinations(from,captureOnly=false){return destinationsOn(this.board,from,captureOnly,this.chainVisited);}
  allCaptures(color){return this.board.flatMap((piece,from)=>piece===color?this.destinations(from,true).map(move=>({from,...move})):[]);}
  allMoves(color){const captures=this.allCaptures(color);return captures.length?captures:this.board.flatMap((piece,from)=>piece===color?this.destinations(from).map(move=>({from,...move})):[]);}
  apply(move){const piece=this.board[move.from];this.board[move.to]=piece;this.board[move.from]=null;if(move.capture!==null)this.board[move.capture]=null;}
}
const game=new AlquerqueGame();
let computerThinking=false;

function destinationsOn(board,from,captureOnly=false,visited=new Set()){
  const piece=board[from];if(!piece)return[];
  const[row,col]=game.position(from),moves=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;const ar=row+dr,ac=col+dc;
    if(ar<0||ar>=SIZE||ac<0||ac>=SIZE)continue;const adjacent=game.index(ar,ac);
    if(!game.connected(from,adjacent))continue;
    if(board[adjacent]===opponent(piece)){
      const jr=row+2*dr,jc=col+2*dc;
      if(jr>=0&&jr<SIZE&&jc>=0&&jc<SIZE){const landing=game.index(jr,jc);if(game.connected(adjacent,landing)&&!board[landing]&&!visited.has(landing))moves.push({to:landing,capture:adjacent});}
    }else if(!captureOnly&&!board[adjacent]){
      const forward=piece===WHITE?dr<0:dr>0,finalRow=piece===WHITE?row===0:row===SIZE-1;
      if((finalRow&&dr===0)||(!finalRow&&forward))moves.push({to:adjacent,capture:null});
    }
  }return moves;
}
function applyOn(board,move){const next=board.slice(),piece=next[move.from];next[move.to]=piece;next[move.from]=null;if(move.capture!==null)next[move.capture]=null;return next;}
function boardAfter(board,move){return move.steps.reduce((state,step)=>applyOn(state,step),board);}
// One AI move includes the entire compulsory capture sequence.
function turnMoves(board,color){
  const first=[];board.forEach((piece,from)=>{if(piece===color)destinationsOn(board,from,true).forEach(move=>first.push({from,...move}));});
  if(!first.length)return board.flatMap((piece,from)=>piece===color?destinationsOn(board,from).map(move=>({steps:[{from,...move}],captures:0})):[]);
  const complete=[];
  const explore=(state,step,steps,visited)=>{const next=applyOn(state,step),nextVisited=new Set(visited);nextVisited.add(step.to);const following=destinationsOn(next,step.to,true,nextVisited);if(!following.length){complete.push({steps:[...steps,step],captures:steps.length+1});return;}following.forEach(move=>explore(next,{from:step.to,...move},[...steps,step],nextVisited));};
  first.forEach(move=>explore(board,move,[],new Set()));return complete;
}
function evaluate(board){const cp=board.filter(p=>p===COMPUTER).length,hp=board.filter(p=>p===HUMAN).length,mobility=turnMoves(board,COMPUTER).length-turnMoves(board,HUMAN).length,progress=board.reduce((score,piece,index)=>piece===COMPUTER?score+Math.floor(index/SIZE):piece===HUMAN?score-(SIZE-1-Math.floor(index/SIZE)):score,0);return(cp-hp)*100+mobility*3+progress;}
function minimax(board,color,depth,alpha=-Infinity,beta=Infinity){
  const moves=turnMoves(board,color);if(!moves.length)return{score:color===COMPUTER?-100000-depth:100000+depth};if(depth===0)return{score:evaluate(board)};moves.sort((a,b)=>b.captures-a.captures);let best=null;
  if(color===COMPUTER){let score=-Infinity;for(const move of moves){const value=minimax(boardAfter(board,move),HUMAN,depth-1,alpha,beta).score;if(value>score){score=value;best=move;}alpha=Math.max(alpha,score);if(beta<=alpha)break;}return{score,move:best};}
  let score=Infinity;for(const move of moves){const value=minimax(boardAfter(board,move),COMPUTER,depth-1,alpha,beta).score;if(value<score){score=value;best=move;}beta=Math.min(beta,score);if(beta<=alpha)break;}return{score,move:best};
}
function setMessage(text,kind="info"){byId("message").textContent=text;byId("message").className=`message ${kind}`;}
function playerName(color){return color===WHITE?"Claras":"Escuras";}
function createBoard(){
  const board=byId("board");board.replaceChildren();const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),addLine=(r1,c1,r2,c2)=>{const line=document.createElementNS("http://www.w3.org/2000/svg","line");line.setAttribute("x1",`${c1*25}%`);line.setAttribute("y1",`${r1*25}%`);line.setAttribute("x2",`${c2*25}%`);line.setAttribute("y2",`${r2*25}%`);svg.append(line);};
  for(let i=0;i<SIZE;i++){addLine(i,0,i,4);addLine(0,i,4,i);}[[0,0,4,4],[0,4,4,0],[0,2,2,0],[0,2,2,4],[2,0,4,2],[2,4,4,2]].forEach(line=>addLine(...line));board.append(svg);
  for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){const index=game.index(row,col),point=document.createElement("button");point.type="button";point.className="point";point.style.left=`${col*25}%`;point.style.top=`${row*25}%`;point.dataset.index=index;point.setAttribute("role","gridcell");point.addEventListener("click",onPointClick);board.append(point);}
}
function legalMovesForSelected(){if(game.selected===null)return[];const captures=game.destinations(game.selected,true);return captures.length?captures:(game.chainVisited.size?[]:game.destinations(game.selected));}
function render(){
  byId("turn-card").innerHTML=`<span class="turn-dot ${game.turn}"></span><span>${game.finished?"Partida terminada":game.turn===HUMAN?"A sua vez":"Computador joga"}</span>`;const legal=new Map(legalMovesForSelected().map(move=>[move.to,move]));
  document.querySelectorAll(".point").forEach(point=>{const index=Number(point.dataset.index),piece=game.board[index];point.classList.toggle("selected",index===game.selected);point.classList.toggle("legal",legal.has(index));point.disabled=game.finished||computerThinking||game.turn===COMPUTER;point.replaceChildren();if(piece){const stone=document.createElement("span");stone.className=`piece ${piece}-piece`;stone.setAttribute("aria-hidden","true");point.append(stone);point.setAttribute("aria-label",`${piece===WHITE?"peça clara":"peça escura"}, posição ${Math.floor(index/5)+1}, ${index%5+1}`);}});
}
function finish(result,winner=null){game.finished=true;computerThinking=false;const record={result,winner:winner?playerName(winner):"—",date:new Date().toLocaleDateString("pt-PT")},scores=JSON.parse(localStorage.getItem("alquerque-scores")||"[]");scores.unshift(record);localStorage.setItem("alquerque-scores",JSON.stringify(scores.slice(0,12)));setMessage(winner?`${winner===HUMAN?"Venceu":"O computador venceu"}!`:"Empate acordado.","success");render();}
function computerMove(){const moves=turnMoves(game.board,COMPUTER);if(!moves.length){finish("sem movimentos",HUMAN);return;}const difficulty=byId("difficulty").value;let chosen;if(difficulty==="easy"){const captures=moves.filter(move=>move.captures),pool=captures.length?captures:moves;chosen=pool[Math.floor(Math.random()*pool.length)];}else chosen=minimax(game.board.slice(),COMPUTER,difficulty==="hard"?5:3).move;chosen.steps.forEach(step=>game.apply(step));computerThinking=false;setMessage(`O computador jogou${chosen.captures?` e capturou ${chosen.captures} peça${chosen.captures>1?"s":""}`:""}.`,"success");changeTurn();}
function changeTurn(){game.selected=null;game.chainVisited.clear();game.turn=opponent(game.turn);const moves=game.allMoves(game.turn);if(!moves.length){finish("sem movimentos",opponent(game.turn));return;}if(game.turn===COMPUTER){computerThinking=true;setMessage("O computador está a pensar…");render();window.setTimeout(computerMove,250);return;}setMessage(`A sua vez. ${game.allCaptures(game.turn).length?"Há uma captura obrigatória.":"Selecione uma peça."}`);render();}
function onPointClick(event){
  const index=Number(event.currentTarget.dataset.index);if(game.finished||computerThinking||game.turn!==HUMAN)return;
  if(game.selected!==null){const move=legalMovesForSelected().find(item=>item.to===index);if(move){move.from=game.selected;game.apply(move);if(move.capture!==null){game.selected=move.to;game.chainVisited.add(move.to);const more=game.destinations(game.selected,true);if(more.length){setMessage("Captura feita. Continue a sequência com a mesma peça.","success");render();return;}setMessage("Sequência de capturas concluída.","success");}changeTurn();return;}}
  if(game.board[index]!==HUMAN){setMessage("Selecione uma peça clara.","warning");return;}const captures=game.allCaptures(HUMAN),ownCaptures=game.destinations(index,true);if(captures.length&&!ownCaptures.length){setMessage("Existe uma captura obrigatória com outra peça.","warning");return;}game.selected=index;const options=legalMovesForSelected();setMessage(options.length?(ownCaptures.length?"Escolha onde capturar.":"Escolha um ponto destacado."):"Esta peça não tem movimentos possíveis.",options.length?"info":"warning");render();
}
function openDialog(id){byId(id).showModal();}
function renderScores(){const scores=JSON.parse(localStorage.getItem("alquerque-scores")||"[]"),body=byId("scores-body");body.replaceChildren();if(!scores.length){const row=body.insertRow(),cell=row.insertCell();cell.colSpan=3;cell.textContent="Ainda não há partidas terminadas.";return;}scores.forEach(score=>{const row=body.insertRow();[score.result,score.winner,score.date].forEach(value=>row.insertCell().textContent=value);});}
byId("settings-form").addEventListener("submit",event=>{event.preventDefault();computerThinking=false;game.start(HUMAN);createBoard();setMessage("A sua vez. Selecione uma peça.");render();});
byId("rules-button").addEventListener("click",()=>openDialog("rules-dialog"));
byId("draw-button").addEventListener("click",()=>{if(!game.finished)openDialog("draw-dialog");});byId("accept-draw").addEventListener("click",()=>{byId("draw-dialog").close();finish("empate");});
byId("resign-button").addEventListener("click",()=>{if(!game.finished&&window.confirm("Desiste da partida?"))finish("desistência",COMPUTER);});
byId("scores-button").addEventListener("click",()=>{renderScores();openDialog("scores-dialog");});
byId("login-button").addEventListener("click",()=>setMessage("A autenticação estará disponível numa próxima entrega.","info"));
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>byId(button.dataset.close).close()));
createBoard();render();
