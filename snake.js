// ═══════════════════════════════════════════
//  SNAKE RETRO  —  Enhanced Edition
// ═══════════════════════════════════════════

const isFS = new URLSearchParams(location.search).get('fs') === '1';
if (isFS) document.body.classList.add('fs-mode');

const COLS = 24, ROWS = 20;
const CELL = isFS ? 30 : 20;
const W = COLS * CELL, H = ROWS * CELL;
const DPR = Math.max(1, window.devicePixelRatio || 1);
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = W * DPR;
canvas.height = H * DPR;
canvas.style.width  = W + 'px';
canvas.style.height = H + 'px';
ctx.scale(DPR, DPR);

const gridCanvas = document.createElement('canvas');
gridCanvas.width = W * DPR; gridCanvas.height = H * DPR;
const gctx = gridCanvas.getContext('2d');
gctx.scale(DPR, DPR);
gctx.fillStyle = '#07070f'; gctx.fillRect(0, 0, W, H);
gctx.fillStyle = '#111128';
for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++)
  gctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

const scoreEl       = document.getElementById('score');
const bestEl        = document.getElementById('best');
const levelEl       = document.getElementById('level');
const livesEl       = document.getElementById('lives');
const powerUpLabel  = document.getElementById('powerUpLabel');
const finalScoreEl  = document.getElementById('finalScore');
const finalBestEl   = document.getElementById('finalBest');
const startScreen   = document.getElementById('startScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const pauseScreen   = document.getElementById('pauseScreen');
const mainHint      = document.getElementById('mainHint');
const themeRow      = document.getElementById('themeRow');
const initialsRow   = document.getElementById('initialsRow');
const initialsInput = document.getElementById('initialsInput');
const hsList        = document.getElementById('hsList');

function localizeHtmlPage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const message = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (message) el.innerHTML = message;
  });
}
localizeHtmlPage();

// ─── Estadísticas, Modos y RNG Semilla ────────
let STATE = 'IDLE';
let best = 0, totalGames = 0, totalApples = 0;

chrome.storage.local.get(['snakeBest', 'totalGames', 'totalApples'], (res) => {
  best = res.snakeBest || 0;
  totalGames = res.totalGames || 0;
  totalApples = res.totalApples || 0;
  bestEl.textContent = pad(best);
});

let isClassicMode = false;
let isDailyMode = false;
let currentSeed = 1;

document.getElementById('btnModeClassic')?.addEventListener('click', (e) => {
  isClassicMode = !isClassicMode;
  e.target.textContent = isClassicMode ? 'MODO: CLÁSICO' : 'MODO: NORMAL';
  e.target.style.color = isClassicMode ? '#ffb300' : 'var(--green)';
  e.target.style.borderColor = isClassicMode ? '#ffb300' : 'var(--green)';
});

document.getElementById('btnModeDaily')?.addEventListener('click', (e) => {
  isDailyMode = !isDailyMode;
  e.target.textContent = isDailyMode ? 'RETO: DIARIO' : 'RETO: LIBRE';
  e.target.style.color = isDailyMode ? '#00cfff' : 'var(--green)';
  e.target.style.borderColor = isDailyMode ? '#00cfff' : 'var(--green)';
});

function setDailySeed() {
  const d = new Date();
  currentSeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function gameRandom() {
  if (!isDailyMode) return Math.random();
  currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
  return currentSeed / 4294967296;
}

// ─── Game vars ──────────────────────────────
let snake, dir, inputQueue;
let foods = [], obstacles = [];
let particles = [], floaties = [];
let score, level, speed, gameLoop;
let lives, combo, lastEatTime, comboTimer;
let activePowerUp, powerUpTimeLeft, baseSpeed;
let shakeFrames = 0, shakeIntensity = 0;
let frameCount  = 0;
let rainbowMode = false;
let newBestFlashUntil = 0;
let konamiIdx   = 0;
let startBest   = 0;
let pausedAt    = 0;

// Variables para interpolación suave
let lastTickTime = 0;
let poppedTail = null;
let ateThisTick = false;

// ─── Temas visuales ──────────────────────────
let themeRGB = [57, 255, 20];
function refreshThemeColors() {
  const c = getComputedStyle(document.body).getPropertyValue('--green').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  if (m) { const n = parseInt(m[1], 16); themeRGB = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
}
function applyTheme(name) {
  document.body.setAttribute('data-theme', name === 'classic' ? '' : name);
  refreshThemeColors();
  localStorage.setItem('snakeTheme', name);
  if (themeRow) {
    [...themeRow.children].forEach(d => d.classList.toggle('active', d.dataset.theme === name));
  }
}
applyTheme(localStorage.getItem('snakeTheme') || 'classic');
themeRow?.addEventListener('click', e => {
  const dot = e.target.closest('.theme-dot');
  if (dot) applyTheme(dot.dataset.theme);
});

// ─── Tabla de puntuaciones ───────────────────
const HS_KEY = 'snakeHighScores';
function loadHighScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch (e) { return []; }
}
function saveHighScores(list) { localStorage.setItem(HS_KEY, JSON.stringify(list)); }
function qualifiesForHighScore(s) {
  const list = loadHighScores();
  return s > 0 && (list.length < 5 || s > list[list.length - 1].score);
}
function addHighScore(name, s) {
  const list = loadHighScores();
  list.push({ name: ((name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)) || 'AAA', score: s });
  list.sort((a, b) => b.score - a.score);
  list.splice(5);
  saveHighScores(list);
  return list;
}
function renderHighScores(highlightScore = null) {
  const list = loadHighScores();
  if (!list.length) { hsList.innerHTML = ''; return; }
  let marked = false;
  hsList.innerHTML = list.map((e, i) => {
    const me = !marked && e.score === highlightScore;
    if (me) marked = true;
    const name = String(e.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 3);
    return `<div class="hs-row${me ? ' me' : ''}"><span class="hs-rank">${i + 1}.</span><span>${name}</span><span>${pad(Number(e.score) || 0)}</span></div>`;
  }).join('');
}

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

const FOODS = {
  NORMAL: { color:'#ff2244', glow:'#ff0033', hi:'rgba(255,160,170,0.7)', w:65, pts:10, label:null,  pu:null    },
  GOLDEN: { color:'#ffd700', glow:'#cc8800', hi:'rgba(255,255,190,0.8)', w:15, pts:25, label:'★',   pu:'DOUBLE'},
  ICE:    { color:'#00cfff', glow:'#0088cc', hi:'rgba(180,240,255,0.7)', w:12, pts:15, label:'❄',   pu:'SLOW'  },
  GHOST:  { color:'#bb88ff', glow:'#7744cc', hi:'rgba(210,190,255,0.7)', w: 8, pts:20, label:'◈',   pu:'GHOST' },
};

const POWER_UPS = {
  DOUBLE: { name: chrome.i18n.getMessage("puDoubleName") || '✦ DOBLE PUNTOS ✦', color:'#ffd700', dur:6000 },
  SLOW:   { name: chrome.i18n.getMessage("puSlowName") || '❄ CÁMARA LENTA ❄', color:'#00cfff', dur:5000 },
  GHOST:  { name: chrome.i18n.getMessage("puGhostName") || '◈ MODO FANTASMA ◈', color:'#bb88ff', dur:7000 },
};

// ─── Audio ──────────────────────────────────
let audioCtx, masterGain;
let muted = localStorage.getItem('snakeMuted') === '1';

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function updateMuteBtn() {
  const b = document.getElementById('muteBtn');
  if (b) b.textContent = muted ? '🔇' : '🔊';
}
function setMuted(m) {
  muted = m;
  localStorage.setItem('snakeMuted', m ? '1' : '0');
  if (masterGain) masterGain.gain.value = m ? 0 : 1;
  updateMuteBtn();
}

function beep(freq, type, dur, vol = 0.12, attack = 0, freqEnd = null) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = type; o.frequency.value = freq;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + dur);
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur + 0.01);
  } catch(e) {}
}

function playEat()     { beep(440,'square',0.12,0.1,0,880); }
function playPowerUp() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,'sine',0.15,0.1),i*70)); }
function playDie()     { beep(220,'sawtooth',0.5,0.15,0,40); setTimeout(()=>beep(180,'square',0.3,0.08),100); }
function playLevelUp() { [392,494,587,784].forEach((f,i)=>setTimeout(()=>beep(f,'square',0.18,0.09),i*80)); }
function playCombo(n)  { beep(330+n*110,'triangle',0.1,0.08); }
function playLife()    { beep(300,'sawtooth',0.5,0.12,0,50); }
function playRainbow() { [523,659,784,880,1047].forEach((f,i)=>setTimeout(()=>beep(f,'sine',0.2,0.08),i*60)); }

const MELODY_A = [659,0,523,659, 784,659,523,440, 523,0,440,523, 659,523,440,392];
const MELODY_B = [880,0,784,880, 784,659,523,659, 784,0,659,784, 880,784,659,523];
const BASS_SEQ = [110,0,0,110,   82,0,0,82,        98,0,0,98,   110,0,0,110];

class ChiptuneEngine {
  constructor() {
    this._playing = false; this._step = 0; this._timer = null; this._gain = null; this.noteLen = 210;
  }
  _setup() {
    if (!audioCtx) return false;
    if (!this._gain) {
      this._gain = audioCtx.createGain(); this._gain.gain.value = 0.055; this._gain.connect(masterGain);
    }
    return true;
  }
  _note(freq, type, dur, vol) {
    if (!freq || !audioCtx || !this._gain) return;
    try {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(this._gain);
      o.type = type; o.frequency.value = freq;
      const t = audioCtx.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.setValueAtTime(vol*0.85, t+dur*0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur*0.9);
      o.start(t); o.stop(t+dur);
    } catch(e) {}
  }
  _hihat(vol=0.03) {
    if (!audioCtx || !this._gain) return;
    for (let i=0;i<4;i++) {
      try {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(this._gain);
        o.type='square'; o.frequency.value=7000+Math.random()*5000;
        const t=audioCtx.currentTime;
        g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.022);
        o.start(t); o.stop(t+0.025);
      } catch(e) {}
    }
  }
  _tick() {
    if (!this._playing || !this._setup()) return;
    const s = this._step % 16, bar = Math.floor(this._step/16), dur = (this.noteLen/1000)*0.86;
    const mel = (bar%4<2) ? MELODY_A : MELODY_B;
    if (mel[s])      this._note(mel[s],'square',dur,0.25);
    if (BASS_SEQ[s]) this._note(BASS_SEQ[s],'square',dur*1.7,0.32);
    if (s===0||s===8) this._note(52,'sine',0.09,0.55);
    if      (s%4===0) this._hihat(0.042);
    else if (s%2===0) this._hihat(0.018);
    this._step++; this._timer = setTimeout(()=>this._tick(), this.noteLen);
  }
  start()  { if(!this._setup())return; this.stop(); this._playing=true; this._step=0; this._tick(); }
  stop()   { this._playing=false; clearTimeout(this._timer); }
  pause()  { this.stop(); }
  resume() { if(!this._playing){this._playing=true;this._tick();} }
  setTempo(gameSpeedMs) { this.noteLen=Math.max(80,Math.round(gameSpeedMs*1.4)); }
}

const music = new ChiptuneEngine();

function pad(n, len=3) { return String(n).padStart(len,'0'); }

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x+r,y);
  cx.lineTo(x+w-r,y); cx.quadraticCurveTo(x+w,y,x+w,y+r);
  cx.lineTo(x+w,y+h-r); cx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  cx.lineTo(x+r,y+h); cx.quadraticCurveTo(x,y+h,x,y+h-r);
  cx.lineTo(x,y+r); cx.quadraticCurveTo(x,y,x+r,y);
  cx.closePath();
}

function randomCell(exclude=[]) {
  let p, tries=0;
  do {
    p = { x: Math.floor(gameRandom() * COLS), y: Math.floor(gameRandom() * ROWS) };
    tries++;
  } while (tries<200 && exclude.some(e=>e.x===p.x&&e.y===p.y));
  return p;
}

function occupied() { return [...snake,...foods,...obstacles]; }

class Particle {
  constructor(x, y, color, big=false) {
    this.x=x; this.y=y;
    const angle=Math.random()*Math.PI*2;
    const spd  =big ? 2+Math.random()*5 : 1+Math.random()*4;
    this.vx=Math.cos(angle)*spd; this.vy=Math.sin(angle)*spd;
    this.life=1; this.decay=big ? 0.025+Math.random()*0.025 : 0.035+Math.random()*0.04;
    this.color=color; this.size =big ? 3+Math.random()*3 : 2+Math.random()*2; this.gravity=0.08;
  }
  update() { this.x+=this.vx; this.y+=this.vy; this.vy+=this.gravity; this.vx*=0.95; this.life-=this.decay; }
  draw() {
    ctx.save(); ctx.globalAlpha=Math.max(0,this.life);
    ctx.fillStyle=this.color; ctx.shadowColor=this.color; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0, this.size*this.life), 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function burst(x, y, color, n=10, big=false) {
  for (let i=0;i<n;i++) particles.push(new Particle(x,y,color,big));
}

class Floaty {
  constructor(x,y,text,color){this.x=x;this.y=y;this.text=text;this.color=color;this.life=1;this.vy=-0.8;}
  update(){this.y+=this.vy;this.life-=0.025;}
  draw(){
    ctx.save(); ctx.globalAlpha=Math.max(0,this.life);
    ctx.fillStyle=this.color; ctx.shadowColor=this.color; ctx.shadowBlur=10;
    ctx.font="bold 7px 'Press Start 2P',monospace"; ctx.textAlign='center';
    ctx.fillText(this.text,this.x,this.y); ctx.restore();
  }
}

// ─── Init ────────────────────────────────────
function init() {
  if (isDailyMode) setDailySeed();
  snake     =[{x:12,y:10},{x:11,y:10},{x:10,y:10}];
  dir       ={x:1,y:0}; inputQueue=[];
  score=0; level=1; baseSpeed=150; speed=150;
  lives=3; combo=0; lastEatTime=0; comboTimer=0;
  activePowerUp=null; powerUpTimeLeft=0;
  shakeFrames=0; particles=[]; floaties=[];
  foods=[]; obstacles=[];
  rainbowMode=false; newBestFlashUntil=0; startBest=best;
  lastTickTime=Date.now(); poppedTail=null; ateThisTick=false;
  STATE='PLAYING';
  scoreEl.textContent=pad(0); levelEl.textContent='1';
  updateLives(); hidePowerUp();
  placeNormalFood();
}

function placeNormalFood() {
  if (!foods.some(f=>f.type==='NORMAL')) {
    const pos = randomCell(occupied());
    foods.push({...pos, type:'NORMAL', born:Date.now()});
  }
}

function maybeSpawnSpecial() {
  if (isClassicMode) return;
  if (foods.some(f=>f.type!=='NORMAL')) return;
  if (gameRandom() > 0.28) return;
  const total = FOODS.GOLDEN.w + FOODS.ICE.w + FOODS.GHOST.w;
  let r = gameRandom() * total, type;
  if      (r<FOODS.GOLDEN.w) type='GOLDEN';
  else if (r<FOODS.GOLDEN.w+FOODS.ICE.w) type='ICE';
  else type='GHOST';
  const pos = randomCell(occupied());
  foods.push({...pos, type, born:Date.now(), ttl:8000});
}

function buildObstacles() {
  obstacles = [];
  if (isClassicMode) return;
  const count = Math.min((level-2)*2, 16);
  if (count <= 0) return;
  const head = snake[0], d = dir||{x:1,y:0};
  const safe = [...snake,...foods];
  for (let k=-1; k<=5; k++) for (let w=-1; w<=1; w++)
    safe.push({x:head.x+d.x*k+d.y*w, y:head.y+d.y*k+d.x*w});
  for (let i=0; i<count; i++) obstacles.push(randomCell([...safe,...obstacles]));
}

function updateLives() {
  livesEl.textContent='♥'.repeat(lives)+'♡'.repeat(Math.max(0,3-lives));
}
function showPowerUp(key) {
  const pu=POWER_UPS[key];
  powerUpLabel.textContent=pu.name; powerUpLabel.style.color=pu.color;
  powerUpLabel.style.textShadow=`0 0 12px ${pu.color}`; powerUpLabel.style.opacity='1';
}
function hidePowerUp() {
  powerUpLabel.style.opacity='0'; powerUpLabel.textContent='';
}

// ─── Drawing ─────────────────────────────────
function draw() {
  if (!snake) return;
  frameCount++;
  const now = Date.now();

  let sx=0, sy=0;
  if (shakeFrames>0) {
    sx=(Math.random()-0.5)*shakeIntensity; sy=(Math.random()-0.5)*shakeIntensity;
    shakeFrames--; if (!shakeFrames) shakeIntensity=0;
  }

  ctx.save();
  ctx.translate(sx,sy);

  ctx.fillStyle='#07070f';
  ctx.fillRect(-20,-20,W+40,H+40);
  ctx.drawImage(gridCanvas,0,0,W,H);

  obstacles.forEach(o=>{
    const cx2=o.x*CELL, cy2=o.y*CELL;
    ctx.save(); ctx.shadowColor='#ff6600'; ctx.shadowBlur=10;
    ctx.fillStyle='#2a1000'; ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5;
    roundRect(ctx,cx2+3,cy2+3,CELL-6,CELL-6,2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0; ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(cx2+5,cy2+5); ctx.lineTo(cx2+CELL-5,cy2+CELL-5);
    ctx.moveTo(cx2+CELL-5,cy2+5); ctx.lineTo(cx2+5,cy2+CELL-5); ctx.stroke();
    ctx.restore();
  });

  foods.forEach(food=>{
    const ft=FOODS[food.type];
    const age=now-food.born;
    const pulse=0.88+0.12*Math.sin(now/180+(food.type==='NORMAL'?0:Math.PI));
    const fx=food.x*CELL+CELL/2, fy=food.y*CELL+CELL/2, fr=CELL*0.38*pulse;
    ctx.save(); ctx.shadowColor=ft.glow; ctx.shadowBlur=food.type==='NORMAL'?18:28;
    ctx.fillStyle=ft.color; ctx.beginPath(); ctx.arc(fx,fy,fr,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=ft.hi; ctx.beginPath(); ctx.arc(fx-fr*0.25,fy-fr*0.3,fr*0.32,0,Math.PI*2); ctx.fill();
    if (ft.label){
      ctx.shadowBlur=0; ctx.fillStyle='#000'; ctx.font=`bold ${CELL*0.42}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ft.label,fx,fy+0.5);
    }
    if (food.ttl){
      const frac=1-age/food.ttl;
      if (frac>0){
        ctx.shadowBlur=0; ctx.strokeStyle=ft.color; ctx.lineWidth=1.5; ctx.globalAlpha=0.55*frac;
        ctx.beginPath(); ctx.arc(fx,fy,CELL*0.47,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); ctx.stroke();
      } else { food._expired=true; }
    }
    ctx.restore();
  });
  foods=foods.filter(f=>!f._expired);

  const t = (STATE === 'PLAYING') ? Math.min(1, (now - lastTickTime) / speed) : 1;

  snake.forEach((seg, i)=>{
    const isHead=i===0;
    const gradT=i/Math.max(snake.length-1,1);
    
    let prevX = seg.x, prevY = seg.y;
    if (STATE === 'PLAYING') {
      if (i < snake.length - 1) {
        prevX = snake[i + 1].x;
        prevY = snake[i + 1].y;
      } else if (!ateThisTick && poppedTail) {
        prevX = poppedTail.x;
        prevY = poppedTail.y;
      }
    }
    
    // Desactiva interpolación en saltos largos (Modo Fantasma atravesando paredes)
    let visX = seg.x, visY = seg.y;
    if (STATE === 'PLAYING' && Math.abs(seg.x - prevX) <= 1 && Math.abs(seg.y - prevY) <= 1) {
      visX = prevX + (seg.x - prevX) * t;
      visY = prevY + (seg.y - prevY) * t;
    }

    ctx.save();
    let fillColor;
    if (rainbowMode) {
      fillColor=`hsl(${(frameCount*2+i*16)%360},100%,58%)`; ctx.shadowColor=fillColor;
    } else if (activePowerUp==='GHOST') {
      fillColor=`rgba(187,136,255,${0.5+0.5*Math.sin(now/90+i*0.4)})`; ctx.shadowColor='#aa66ff';
    } else if (activePowerUp==='SLOW') {
      fillColor=isHead?'#00cfff':`rgb(0,${Math.floor(160*(1-gradT))},${Math.floor(200-gradT*70)})`;
      ctx.shadowColor='#00cfff';
    } else {
      const k=1-gradT*0.35, [tr,tg,tb]=themeRGB;
      fillColor=isHead?`rgb(${tr},${tg},${tb})`:`rgb(${tr*k|0},${tg*k|0},${tb*k|0})`;
      ctx.shadowColor=`rgb(${tr},${tg},${tb})`;
    }
    
    ctx.shadowBlur=isHead?22:(activePowerUp?14:8); ctx.fillStyle=fillColor;
    const pad2=isHead?1:3, r=isHead?5:3;
    roundRect(ctx, visX*CELL+pad2, visY*CELL+pad2, CELL-pad2*2, CELL-pad2*2, r); ctx.fill();
    
    if (isHead||i<3){
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.shadowBlur=0; ctx.save(); ctx.clip();
      roundRect(ctx, visX*CELL+pad2, visY*CELL+pad2, CELL-pad2*2, (CELL-pad2*2)*0.4, r); ctx.fill();
      ctx.restore();
    }
    if (isHead){
      ctx.shadowBlur=0;
      const ex=dir.x, ey=dir.y, hx=visX*CELL+CELL/2, hy=visY*CELL+CELL/2;
      const eo=3.5, fo=4.5;
      ctx.fillStyle='#050510'; ctx.beginPath();
      ctx.arc(hx+ex*fo+ey*eo, hy+ey*fo-ex*eo, 2.5, 0, Math.PI*2);
      ctx.arc(hx+ex*fo-ey*eo, hy+ey*fo+ex*eo, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.beginPath();
      ctx.arc(hx+ex*fo+ey*eo+0.8, hy+ey*fo-ex*eo-0.8, 1.1, 0, Math.PI*2);
      ctx.arc(hx+ex*fo-ey*eo+0.8, hy+ey*fo+ex*eo-0.8, 1.1, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });

  particles.forEach(p=>p.update());
  particles=particles.filter(p=>p.life>0);
  particles.forEach(p=>p.draw());

  floaties=floaties.filter(f=>f.life>0);
  floaties.forEach(f=>{f.update();f.draw();});

  if (combo>=2&&comboTimer>0){
    ctx.save(); ctx.globalAlpha=Math.min(1,comboTimer/400);
    ctx.font="bold 8px 'Press Start 2P',monospace"; ctx.fillStyle='#ffd700';
    ctx.shadowColor='#ffaa00'; ctx.shadowBlur=16; ctx.textAlign='center';
    ctx.fillText(`${combo}× COMBO!`,W/2,24); ctx.restore();
  }

  if (activePowerUp&&powerUpTimeLeft>0){
    const def=POWER_UPS[activePowerUp], frac=powerUpTimeLeft/def.dur, bw=W*0.65, bx=(W-bw)/2, by=H-12;
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(ctx,bx-2,by-6,bw+4,11,4); ctx.fill();
    ctx.fillStyle=def.color; ctx.shadowColor=def.color; ctx.shadowBlur=10;
    roundRect(ctx,bx,by-4,Math.max(bw*frac,0),7,3); ctx.fill(); ctx.restore();
  }

  if (newBestFlashUntil>0 && now<newBestFlashUntil && frameCount%30<15){
    ctx.save(); ctx.font="bold 7px 'Press Start 2P',monospace"; ctx.fillStyle='#ffd700';
    ctx.shadowColor='#ffd700'; ctx.shadowBlur=20; ctx.textAlign='right';
    ctx.fillText(chrome.i18n.getMessage("newBestFlash") || '★ NUEVO RÉCORD',W-8,16); ctx.restore();
  }

  ctx.restore();
}

// ─── Tick (game logic) ───────────────────────
function tick() {
  if (STATE!=='PLAYING') return;
  const now=Date.now();

  if (comboTimer>0){ comboTimer-=speed; if(comboTimer<=0) combo=0; }
  if (activePowerUp){ powerUpTimeLeft-=speed; if(powerUpTimeLeft<=0) deactivatePowerUp(); }

  foods=foods.filter(f=>{ if(!f.ttl)return true; return (now-f.born)<f.ttl; });

  dir = inputQueue.length ? inputQueue.shift() : dir;
  let hx=snake[0].x+dir.x, hy=snake[0].y+dir.y;

  if (activePowerUp==='GHOST'){
    hx=((hx%COLS)+COLS)%COLS; hy=((hy%ROWS)+ROWS)%ROWS;
  } else {
    if (hx<0||hx>=COLS||hy<0||hy>=ROWS) return handleDeath();
  }

  const head={x:hx,y:hy};
  const willEat=foods.some(f=>f.x===hx&&f.y===hy);
  const body=willEat?snake:snake.slice(0,-1);
  if (body.some(s=>s.x===head.x&&s.y===head.y)) return handleDeath();
  if (obstacles.some(o=>o.x===head.x&&o.y===head.y)) return handleDeath();

  snake.unshift(head);

  const fi=foods.findIndex(f=>f.x===head.x&&f.y===head.y);
  ateThisTick = (fi !== -1);

  if (ateThisTick){
    const eaten=foods.splice(fi,1)[0];
    const ft=FOODS[eaten.type];
    if (eaten.type === 'NORMAL') totalApples++;

    combo=(now-lastEatTime<2800)?Math.min(combo+1,8):1;
    lastEatTime=now; comboTimer=1600;

    const mult=(activePowerUp==='DOUBLE')?2:1;
    const gained=ft.pts*level*mult*(combo>=2?combo:1);
    score+=gained;
    scoreEl.textContent=pad(score);

    const fx2=eaten.x*CELL+CELL/2, fy2=eaten.y*CELL+CELL/2;
    floaties.push(new Floaty(fx2,fy2,`+${gained}${combo>=2?' ×'+combo:''}`,ft.color));
    burst(fx2,fy2,ft.color,eaten.type==='NORMAL'?8:18,eaten.type!=='NORMAL');

    if (score>best){
      best=score;
      bestEl.textContent=pad(best);
      chrome.storage.local.set({ snakeBest: best });
      if (startBest>0) newBestFlashUntil=now+5000;
    }

    if (!rainbowMode&&score>=500){ rainbowMode=true; playRainbow(); }

    if (ft.pu) activatePowerUp(ft.pu);
    else       combo>=2?playCombo(combo):playEat();

    const newLvl=Math.min(10,1+Math.floor(score/60));
    if (newLvl!==level){
      level=newLvl;
      baseSpeed=Math.max(55,150-(level-1)*13);
      levelEl.textContent=level;
      buildObstacles(); recomputeSpeed();
      playLevelUp();
    }

    placeNormalFood(); maybeSpawnSpecial();
  } else {
    poppedTail = snake.pop();
  }
  
  lastTickTime = Date.now();
}

function recomputeSpeed(){
  const s=(activePowerUp==='SLOW')?(baseSpeed*1.7|0):baseSpeed;
  if (s===speed) return;
  speed=s; resetLoop();
  try{music.setTempo(speed);}catch(e){}
}

function activatePowerUp(key){
  const def=POWER_UPS[key];
  activePowerUp=key; powerUpTimeLeft=def.dur;
  showPowerUp(key); playPowerUp(); recomputeSpeed();
}

function deactivatePowerUp(){
  activePowerUp=null; powerUpTimeLeft=0; hidePowerUp(); recomputeSpeed();
}

function handleDeath(){
  totalGames++;
  chrome.storage.local.set({ snakeBest: best, totalGames: totalGames, totalApples: totalApples });
  
  snake.forEach(seg=>{
    const c=rainbowMode?`hsl(${Math.random()*360},100%,60%)`:`rgb(${themeRGB.join(',')})`;
    burst(seg.x*CELL+CELL/2,seg.y*CELL+CELL/2,c,3);
  });
  if(!REDUCED_MOTION){shakeFrames=18; shakeIntensity=9;}
  playDie(); try{music.stop();}catch(e){}
  lives--; updateLives(); clearInterval(gameLoop);

  if (lives<=0){
    STATE='DYING';
    setTimeout(()=>{
      STATE='DEAD';
      finalScoreEl.textContent=`${chrome.i18n.getMessage("scoreText") || 'PUNTUACIÓN: '}${score}`;
      finalBestEl.textContent =`${chrome.i18n.getMessage("bestText") || 'RÉCORD: '}${best}`;
      gameOverScreen.style.display='flex';
      mainHint.style.display='none';
      if (qualifiesForHighScore(score)) {
        initialsRow.style.display='flex'; initialsInput.value='';
        renderHighScores(null); setTimeout(()=>initialsInput.focus(),50);
      } else {
        initialsRow.style.display='none'; renderHighScores(null);
      }
    },900);
  } else {
    STATE='DYING'; playLife();
    setTimeout(()=>{
      snake=[{x:12,y:10},{x:11,y:10},{x:10,y:10}];
      dir={x:1,y:0}; inputQueue=[]; foods=[]; activePowerUp=null; powerUpTimeLeft=0;
      speed=baseSpeed; combo=0; comboTimer=0;
      hidePowerUp(); buildObstacles(); placeNormalFood();
      STATE='PLAYING'; lastTickTime=Date.now(); poppedTail=null; ateThisTick=false;
      resetLoop(); try{music.setTempo(speed);music.start();}catch(e){}
      if (!document.hasFocus()) togglePause();
    },1000);
  }
}

function resetLoop(){ clearInterval(gameLoop); gameLoop=setInterval(tick,speed); }

let gpPrev={dir:null,st:false,a:false};
function pollGamepad(){
  if (!navigator.getGamepads) return;
  const gp=[...navigator.getGamepads()].find(Boolean);
  if (!gp) return;
  const b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed);
  let dn=null;
  if (b(12)||gp.axes[1]<-0.6) dn='U';
  else if (b(13)||gp.axes[1]>0.6) dn='D';
  else if (b(14)||gp.axes[0]<-0.6) dn='L';
  else if (b(15)||gp.axes[0]>0.6) dn='R';
  if (dn&&dn!==gpPrev.dir) tryDir({U:{x:0,y:-1},D:{x:0,y:1},L:{x:-1,y:0},R:{x:1,y:0}}[dn]);
  gpPrev.dir=dn;
  const st=b(9), a=b(0);
  const go=()=>{
    if (STATE==='IDLE') document.getElementById('startBtn').click();
    else if (STATE==='DEAD'&&initialsRow.style.display!=='flex') document.getElementById('restartBtn').click();
    else return false;
    return true;
  };
  if (st&&!gpPrev.st){ if (!go()) togglePause(); } else if (a&&!gpPrev.a){ go(); }
  gpPrev.st=st; gpPrev.a=a;
}

function renderLoop(){
  try{pollGamepad();}catch(e){}
  if (STATE==='PLAYING'||STATE==='DYING') try{draw();}catch(e){console.error('draw error:',e);}
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

const DIR_MAP={
  ArrowUp:{x:0,y:-1},w:{x:0,y:-1},W:{x:0,y:-1},
  ArrowDown:{x:0,y:1},s:{x:0,y:1},S:{x:0,y:1},
  ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},A:{x:-1,y:0},
  ArrowRight:{x:1,y:0},d:{x:1,y:0},D:{x:1,y:0},
};

function tryDir(d){
  if (!d||STATE!=='PLAYING') return;
  const last = inputQueue.length ? inputQueue[inputQueue.length-1] : dir;
  if (inputQueue.length>=2) return;
  if (d.x===last.x&&d.y===last.y) return;
  if (d.x===-last.x&&d.y===-last.y) return;
  inputQueue.push(d);
}

document.addEventListener('keydown',e=>{
  if (e.target&&e.target.tagName==='INPUT') return;
  if (e.key==='m'||e.key==='M'){ setMuted(!muted); return; }
  if (e.key===KONAMI[konamiIdx]){
    konamiIdx++; if (konamiIdx>=KONAMI.length){ konamiIdx=0; rainbowMode=!rainbowMode; playRainbow(); }
  } else { konamiIdx=0; }
  if (STATE==='IDLE'||STATE==='DEAD'){
    if (e.key==='Enter'||e.key===' '){
      if (STATE==='DEAD'&&initialsRow.style.display==='flex') return;
      e.preventDefault(); document.getElementById(STATE==='IDLE'?'startBtn':'restartBtn').click();
    }
    return;
  }
  if (e.key==='p'||e.key==='P'||e.key==='Escape'){ togglePause(); return; }
  const d=DIR_MAP[e.key];
  if (d){ if (STATE==='PLAYING') tryDir(d); e.preventDefault(); }
});

let tx=0,ty=0;
canvas.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
canvas.addEventListener('touchmove',e=>{e.preventDefault();},{passive:false});
canvas.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
  if (Math.max(Math.abs(dx),Math.abs(dy))<24) return;
  tryDir(Math.abs(dx)>Math.abs(dy)?(dx>0?{x:1,y:0}:{x:-1,y:0}):(dy>0?{x:0,y:1}:{x:0,y:-1}));
},{passive:true});

document.getElementById('btnUp')   ?.addEventListener('click',()=>tryDir({x:0,y:-1}));
document.getElementById('btnDown') ?.addEventListener('click',()=>tryDir({x:0,y:1}));
document.getElementById('btnLeft') ?.addEventListener('click',()=>tryDir({x:-1,y:0}));
document.getElementById('btnRight')?.addEventListener('click',()=>tryDir({x:1,y:0}));

function togglePause(){
  if (STATE==='PLAYING'){
    STATE='PAUSED'; pausedAt=Date.now(); clearInterval(gameLoop); try{music.pause();}catch(e){}
    pauseScreen.style.display='flex';
  } else if (STATE==='PAUSED'){
    const d=Date.now()-pausedAt;
    foods.forEach(f=>{ f.born+=d; }); lastEatTime+=d; lastTickTime+=d;
    if (newBestFlashUntil) newBestFlashUntil+=d;
    STATE='PLAYING'; pauseScreen.style.display='none';
    resetLoop(); try{music.resume();}catch(e){}
  }
}
document.getElementById('btnPause')?.addEventListener('click',togglePause);

document.getElementById('saveInitialsBtn')?.addEventListener('click',()=>{
  addHighScore(initialsInput.value, score); initialsRow.style.display='none'; renderHighScores(score);
});
initialsInput?.addEventListener('keydown',e=>{ if (e.key==='Enter') document.getElementById('saveInitialsBtn').click(); });

document.getElementById('fsBtn')?.addEventListener('click',()=>{
  window.open(location.href.split('?')[0]+'?fs=1','_blank','width=800,height=720,menubar=no,toolbar=no,location=no,scrollbars=no,resizable=yes');
});

document.getElementById('startBtn').addEventListener('click',()=>{
  initAudio(); startScreen.style.display='none'; mainHint.style.display='block';
  init(); draw(); resetLoop(); try{music.setTempo(speed);music.start();}catch(e){}
});
document.getElementById('restartBtn').addEventListener('click',()=>{
  initAudio(); gameOverScreen.style.display='none'; mainHint.style.display='block';
  init(); draw(); resetLoop(); try{music.setTempo(speed);music.start();}catch(e){}
});

document.getElementById('muteBtn')?.addEventListener('click',e=>{ setMuted(!muted); e.currentTarget.blur(); }); updateMuteBtn();
function autoPause(){ if (STATE==='PLAYING') togglePause(); }
window.addEventListener('blur',autoPause);
document.addEventListener('visibilitychange',()=>{ if (document.hidden) autoPause(); });
initialsInput?.addEventListener('input',()=>{ initialsInput.value=initialsInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });