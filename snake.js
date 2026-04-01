
const COLS = 24, ROWS = 20, CELL = 24;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

// Screens
const startScreen   = document.getElementById('startScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const pauseScreen   = document.getElementById('pauseScreen');
const scoreEl  = document.getElementById('score');
const bestEl   = document.getElementById('best');
const levelEl  = document.getElementById('level');
const finalScoreEl = document.getElementById('finalScore');

let snake, dir, nextDir, food, score, best, level, speed, loop, paused, running;

best = parseInt(localStorage.getItem('snakeBest') || '0');
bestEl.textContent = String(best).padStart(3,'0');

function init() {
  snake = [{x:12,y:10},{x:11,y:10},{x:10,y:10}];
  dir   = {x:1,y:0};
  nextDir = {x:1,y:0};
  score = 0; level = 1; speed = 150;
  paused = false; running = true;
  scoreEl.textContent = '000';
  levelEl.textContent = '1';
  placeFood();
}

function placeFood() {
  let pos;
  do {
    pos = {x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS)};
  } while (snake.some(s => s.x===pos.x && s.y===pos.y));
  food = pos;
}

// --- Drawing ---
function draw() {
  // Clear
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Grid dots
  ctx.fillStyle = '#16162a';
  for (let x=0;x<COLS;x++) for (let y=0;y<ROWS;y++) {
    ctx.fillRect(x*CELL+CELL/2-1, y*CELL+CELL/2-1, 2, 2);
  }

  // Food – pulsing circle
  const pulse = 0.85 + 0.15 * Math.sin(Date.now()/200);
  const fx = food.x*CELL+CELL/2, fy = food.y*CELL+CELL/2, fr = CELL*0.38*pulse;
  ctx.save();
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ff2244';
  ctx.beginPath(); ctx.arc(fx,fy,fr,0,Math.PI*2); ctx.fill();
  // Inner highlight
  ctx.fillStyle = 'rgba(255,160,170,0.7)';
  ctx.beginPath(); ctx.arc(fx-fr*0.25,fy-fr*0.3,fr*0.3,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Snake
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const t = i / snake.length;
    const green = Math.floor(255 - t*80);
    ctx.save();
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = isHead ? 18 : 8;
    ctx.fillStyle = isHead ? '#39ff14' : `rgb(${Math.floor(t*30)},${green},${Math.floor(t*10)})`;
    const pad = isHead ? 2 : 3;
    const r = isHead ? 4 : 3;
    roundRect(ctx, seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2, r);
    ctx.fill();

    // Eyes on head
    if (isHead) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0a0f';
      const ex = dir.x, ey = dir.y;
      const cx = seg.x*CELL+CELL/2, cy = seg.y*CELL+CELL/2;
      const eyeOff = 4, fwdOff = 5;
      ctx.beginPath();
      ctx.arc(cx + ex*fwdOff + ey*eyeOff, cy + ey*fwdOff - ex*eyeOff, 2.5, 0, Math.PI*2);
      ctx.arc(cx + ex*fwdOff - ey*eyeOff, cy + ey*fwdOff + ex*eyeOff, 2.5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// --- Game tick ---
function tick() {
  if (!running || paused) return;
  dir = {...nextDir};

  const head = {x: snake[0].x+dir.x, y: snake[0].y+dir.y};

  // Wall collision
  if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS) return gameOver();
  // Self collision
  if (snake.some(s=>s.x===head.x&&s.y===head.y)) return gameOver();

  snake.unshift(head);

  if (head.x===food.x && head.y===food.y) {
    score += 10 * level;
    scoreEl.textContent = String(score).padStart(3,'0');
    if (score > best) { best = score; bestEl.textContent = String(best).padStart(3,'0'); localStorage.setItem('snakeBest',best); }
    // Level up every 50pts
    const newLevel = Math.min(10, 1 + Math.floor(score/50));
    if (newLevel !== level) { level = newLevel; speed = Math.max(60, 150 - (level-1)*15); levelEl.textContent = level; resetLoop(); }
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

function gameOver() {
  running = false;
  clearInterval(loop);
  finalScoreEl.textContent = `PUNTUACIÓN: ${score}`;
  gameOverScreen.style.display = 'flex';
  mainHint.style.display = 'none';
}

function resetLoop() {
  clearInterval(loop);
  loop = setInterval(tick, speed);
}

// Render loop for food animation
function renderLoop() {
  if (running && !paused) draw();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// --- Controls ---
const DIRS = {
  ArrowUp:{x:0,y:-1}, w:{x:0,y:-1}, W:{x:0,y:-1},
  ArrowDown:{x:0,y:1}, s:{x:0,y:1}, S:{x:0,y:1},
  ArrowLeft:{x:-1,y:0}, a:{x:-1,y:0}, A:{x:-1,y:0},
  ArrowRight:{x:1,y:0}, d:{x:1,y:0}, D:{x:1,y:0},
};

document.addEventListener('keydown', e => {
  if (!running) return;
  if ((e.key==='p'||e.key==='P') && running) {
    paused = !paused;
    pauseScreen.style.display = paused ? 'flex' : 'none';
    return;
  }
  const d = DIRS[e.key];
  if (d) {
    // Prevent 180° turns
    if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d;
    e.preventDefault();
  }
});

// Mobile swipe
let tx=0,ty=0;
canvas.addEventListener('touchstart', e=>{ tx=e.touches[0].clientX; ty=e.touches[0].clientY; },{passive:true});
canvas.addEventListener('touchend', e=>{
  const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
  let d;
  if (Math.abs(dx)>Math.abs(dy)) d = dx>0 ? {x:1,y:0} : {x:-1,y:0};
  else d = dy>0 ? {x:0,y:1} : {x:0,y:-1};
  if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d;
},{passive:true});

// Buttons
const mainHint = document.getElementById('mainHint');
document.getElementById('startBtn').addEventListener('click', ()=>{
  startScreen.style.display='none';
  mainHint.style.display='block';
  init(); draw(); resetLoop();
});
document.getElementById('restartBtn').addEventListener('click', ()=>{
  gameOverScreen.style.display='none';
  mainHint.style.display='block';
  init(); draw(); resetLoop();
});

// Draw empty grid on load
draw();
