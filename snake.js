// ═══════════════════════════════════════════
//  SNAKE RETRO  —  Enhanced Edition
// ═══════════════════════════════════════════

// ─── Modo ventana completa ───────────────────
const isFS = new URLSearchParams(location.search).get('fs') === '1';
if (isFS) document.body.classList.add('fs-mode');

const COLS = 24, ROWS = 20;
const CELL = isFS ? 30 : 20;  // Celdas más grandes en ventana completa

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

// ─── DOM refs ───────────────────────────────
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

// ─── State machine ──────────────────────────
let STATE = 'IDLE';

// ─── Game vars ──────────────────────────────
let snake, dir, inputQueue;
let foods = [], obstacles = [];
let particles = [], floaties = [];
let score, best, level, speed, gameLoop;
let lives, combo, lastEatTime, comboTimer;
let activePowerUp, powerUpTimeLeft, baseSpeed;
let shakeFrames = 0, shakeIntensity = 0;
let frameCount  = 0;
let rainbowMode = false;
let newBestFlashUntil = 0;  // timestamp hasta cuando parpadea el récord
let konamiIdx   = 0;

best = parseInt(localStorage.getItem('snakeBest') || '0');
bestEl.textContent = pad(best);

// ─── Temas visuales ──────────────────────────
function applyTheme(name) {
  document.body.setAttribute('data-theme', name === 'classic' ? '' : name);
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

// ─── Tabla de puntuaciones (top 5) ───────────
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
  list.push({ name: (name || 'AAA').toUpperCase().slice(0, 3), score: s });
  list.sort((a, b) => b.score - a.score);
  list.splice(5);
  saveHighScores(list);
  return list;
}
function renderHighScores(highlightScore = null) {
  const list = loadHighScores();
  if (!list.length) { hsList.innerHTML = ''; return; }
  hsList.innerHTML = list.map((e, i) => `
    <div class="hs-row${e.score === highlightScore ? ' me' : ''}">
      <span class="hs-rank">${i + 1}.</span><span>${e.name}</span><span>${pad(e.score)}</span>
    </div>`).join('');
}

// ─── Konami code ────────────────────────────
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown',
                'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

// ─── Food definitions ─────────────────────────
const FOODS = {
  NORMAL: { color:'#ff2244', glow:'#ff0033', hi:'rgba(255,160,170,0.7)', w:65, pts:10, label:null,  pu:null    },
  GOLDEN: { color:'#ffd700', glow:'#cc8800', hi:'rgba(255,255,190,0.8)', w:15, pts:25, label:'★',   pu:'DOUBLE'},
  ICE:    { color:'#00cfff', glow:'#0088cc', hi:'rgba(180,240,255,0.7)', w:12, pts:15, label:'❄',   pu:'SLOW'  },
  GHOST:  { color:'#bb88ff', glow:'#7744cc', hi:'rgba(210,190,255,0.7)', w: 8, pts:20, label:'◈',   pu:'GHOST' },
};

const POWER_UPS = {
  DOUBLE: { name:'✦ DOBLE PUNTOS ✦', color:'#ffd700', dur:6000 },
  SLOW:   { name:'❄ CÁMARA LENTA ❄', color:'#00cfff', dur:5000 },
  GHOST:  { name:'◈ MODO FANTASMA ◈', color:'#bb88ff', dur:7000 },
};

// ─── Audio (Web Audio API) ──────────────────
let audioCtx;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq, type, dur, vol = 0.12, attack = 0, freqEnd = null) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
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

// ─── Chiptune Music Engine ───────────────────
const MELODY_A = [659,0,523,659, 784,659,523,440, 523,0,440,523, 659,523,440,392];
const MELODY_B = [880,0,784,880, 784,659,523,659, 784,0,659,784, 880,784,659,523];
const BASS_SEQ = [110,0,0,110,   82,0,0,82,        98,0,0,98,   110,0,0,110];

class ChiptuneEngine {
  constructor() {
    this._playing = false;
    this._step    = 0;
    this._timer   = null;
    this._gain    = null;
    this.noteLen  = 210;
  }
  _setup() {
    if (!audioCtx) return false;
    if (!this._gain) {
      this._gain = audioCtx.createGain();
      this._gain.gain.value = 0.055;
      this._gain.connect(audioCtx.destination);
    }
    return true;
  }
  _note(freq, type, dur, vol) {
    if (!freq || !audioCtx || !this._gain) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
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
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(this._gain);
        o.type='square'; o.frequency.value=7000+Math.random()*5000;
        const t=audioCtx.currentTime;
        g.gain.setValueAtTime(vol,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.022);
        o.start(t); o.stop(t+0.025);
      } catch(e) {}
    }
  }
  _tick() {
    if (!this._playing || !this._setup()) return;
    const s   = this._step % 16;
    const bar = Math.floor(this._step/16);
    const dur = (this.noteLen/1000)*0.86;
    const mel = (bar%4<2) ? MELODY_A : MELODY_B;
    if (mel[s])      this._note(mel[s],'square',dur,0.25);
    if (BASS_SEQ[s]) this._note(BASS_SEQ[s],'square',dur*1.7,0.32);
    if (s===0||s===8) this._note(52,'sine',0.09,0.55);
    if      (s%4===0) this._hihat(0.042);
    else if (s%2===0) this._hihat(0.018);
    this._step++;
    this._timer = setTimeout(()=>this._tick(), this.noteLen);
  }
  start()  { if(!this._setup())return; this.stop(); this._playing=true; this._step=0; this._tick(); }
  stop()   { this._playing=false; clearTimeout(this._timer); }
  pause()  { this.stop(); }
  resume() { if(!this._playing){this._playing=true;this._tick();} }
  setTempo(gameSpeedMs) { this.noteLen=Math.max(80,Math.round(gameSpeedMs*1.4)); }
}

const music = new ChiptuneEngine();

// ─── Helpers ─────────────────────────────────
function pad(n, len=3) { return String(Math.min(n,999)).padStart(len,'0'); }

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
    p={x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)};
    tries++;
  } while (tries<200 && exclude.some(e=>e.x===p.x&&e.y===p.y));
  return p;
}

function occupied() { return [...snake,...foods,...obstacles]; }

// ─── Particles ───────────────────────────────
class Particle {
  constructor(x, y, color, big=false) {
    this.x=x; this.y=y;
    const angle=Math.random()*Math.PI*2;
    const spd  =big ? 2+Math.random()*5 : 1+Math.random()*4;
    this.vx=Math.cos(angle)*spd; this.vy=Math.sin(angle)*spd;
    this.life=1;
    this.decay=big ? 0.025+Math.random()*0.025 : 0.035+Math.random()*0.04;
    this.color=color;
    this.size =big ? 3+Math.random()*3 : 2+Math.random()*2;
    this.gravity=0.08;
  }
  update() {
    this.x+=this.vx; this.y+=this.vy;
    this.vy+=this.gravity; this.vx*=0.95;
    this.life-=this.decay;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha=Math.max(0,this.life);
    ctx.fillStyle=this.color; ctx.shadowColor=this.color; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0, this.size*this.life), 0, Math.PI*2);
    ctx.fill();
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
    ctx.save();
    ctx.globalAlpha=Math.max(0,this.life);
    ctx.fillStyle=this.color; ctx.shadowColor=this.color; ctx.shadowBlur=10;
    ctx.font="bold 7px 'Press Start 2P',monospace";
    ctx.textAlign='center';
    ctx.fillText(this.text,this.x,this.y);
    ctx.restore();
  }
}

// ─── Init ────────────────────────────────────
function init() {
  snake     =[{x:12,y:10},{x:11,y:10},{x:10,y:10}];
  dir       ={x:1,y:0}; inputQueue=[];
  score=0; level=1; baseSpeed=150; speed=150;
  lives=3; combo=0; lastEatTime=0; comboTimer=0;
  activePowerUp=null; powerUpTimeLeft=0;
  shakeFrames=0; particles=[]; floaties=[];
  foods=[]; obstacles=[];
  rainbowMode=false; newBestFlashUntil=0;
  STATE='PLAYING';
  scoreEl.textContent=pad(0); levelEl.textContent='1';
  updateLives(); hidePowerUp();
  placeNormalFood();
}

// ─── Food ────────────────────────────────────
function placeNormalFood() {
  if (!foods.some(f=>f.type==='NORMAL')) {
    const pos=randomCell(occupied());
    foods.push({...pos,type:'NORMAL',born:Date.now()});
  }
}

function maybeSpawnSpecial() {
  if (foods.some(f=>f.type!=='NORMAL')) return;
  if (Math.random()>0.28) return;
  const total=FOODS.GOLDEN.w+FOODS.ICE.w+FOODS.GHOST.w;
  let r=Math.random()*total, type;
  if      (r<FOODS.GOLDEN.w) type='GOLDEN';
  else if (r<FOODS.GOLDEN.w+FOODS.ICE.w) type='ICE';
  else type='GHOST';
  const pos=randomCell(occupied());
  foods.push({...pos,type,born:Date.now(),ttl:8000});
}

// ─── Obstacles ───────────────────────────────
function buildObstacles() {
  const count=Math.min((level-2)*2,16);
  obstacles=[];
  for (let i=0;i<count;i++) {
    const pos=randomCell([...snake,...obstacles,
      {x:12,y:10},{x:11,y:10},{x:10,y:10},{x:13,y:10},{x:12,y:9},{x:12,y:11}]);
    obstacles.push(pos);
  }
}

// ─── HUD ─────────────────────────────────────
function updateLives() {
  livesEl.textContent='♥'.repeat(lives)+'♡'.repeat(Math.max(0,3-lives));
}
function showPowerUp(key) {
  const pu=POWER_UPS[key];
  powerUpLabel.textContent=pu.name;
  powerUpLabel.style.color=pu.color;
  powerUpLabel.style.textShadow=`0 0 12px ${pu.color}`;
  powerUpLabel.style.opacity='1';
}
function hidePowerUp() {
  powerUpLabel.style.opacity='0';
  powerUpLabel.textContent='';
}

// ─── Drawing ─────────────────────────────────
function draw() {
  if (!snake) return;
  frameCount++;
  const now=Date.now();

  let sx=0, sy=0;
  if (shakeFrames>0) {
    sx=(Math.random()-0.5)*shakeIntensity;
    sy=(Math.random()-0.5)*shakeIntensity;
    shakeFrames--;
    if (!shakeFrames) shakeIntensity=0;
  }

  ctx.save();
  ctx.translate(sx,sy);

  // Background
  ctx.fillStyle='#07070f';
  ctx.fillRect(-20,-20,canvas.width+40,canvas.height+40);

  // Grid dots
  ctx.fillStyle='#111128';
  for (let x=0;x<COLS;x++) for (let y=0;y<ROWS;y++)
    ctx.fillRect(x*CELL+CELL/2-1,y*CELL+CELL/2-1,2,2);

  // ── Obstacles ──
  obstacles.forEach(o=>{
    const cx2=o.x*CELL, cy2=o.y*CELL;
    ctx.save();
    ctx.shadowColor='#ff6600'; ctx.shadowBlur=10;
    ctx.fillStyle='#2a1000'; ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5;
    roundRect(ctx,cx2+3,cy2+3,CELL-6,CELL-6,2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0; ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(cx2+5,cy2+5); ctx.lineTo(cx2+CELL-5,cy2+CELL-5);
    ctx.moveTo(cx2+CELL-5,cy2+5); ctx.lineTo(cx2+5,cy2+CELL-5);
    ctx.stroke();
    ctx.restore();
  });

  // ── Foods ──
  foods.forEach(food=>{
    const ft=FOODS[food.type];
    const age=now-food.born;
    const pulse=0.88+0.12*Math.sin(now/180+(food.type==='NORMAL'?0:Math.PI));
    const fx=food.x*CELL+CELL/2, fy=food.y*CELL+CELL/2, fr=CELL*0.38*pulse;
    ctx.save();
    ctx.shadowColor=ft.glow; ctx.shadowBlur=food.type==='NORMAL'?18:28;
    ctx.fillStyle=ft.color;
    ctx.beginPath(); ctx.arc(fx,fy,fr,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=ft.hi;
    ctx.beginPath(); ctx.arc(fx-fr*0.25,fy-fr*0.3,fr*0.32,0,Math.PI*2); ctx.fill();
    if (ft.label){
      ctx.shadowBlur=0; ctx.fillStyle='#000';
      ctx.font=`bold ${CELL*0.42}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(ft.label,fx,fy+0.5);
    }
    if (food.ttl){
      const frac=1-age/food.ttl;
      if (frac>0){
        ctx.shadowBlur=0; ctx.strokeStyle=ft.color; ctx.lineWidth=1.5;
        ctx.globalAlpha=0.55*frac;
        ctx.beginPath();
        ctx.arc(fx,fy,CELL*0.47,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); ctx.stroke();
      } else { food._expired=true; }
    }
    ctx.restore();
  });
  foods=foods.filter(f=>!f._expired);

  // ── Snake ──
  snake.forEach((seg,i)=>{
    const isHead=i===0;
    const t=i/Math.max(snake.length-1,1);
    ctx.save();
    let fillColor;
    if (rainbowMode) {
      const hue=(frameCount*2+i*16)%360;
      fillColor=`hsl(${hue},100%,58%)`;
      ctx.shadowColor=fillColor;
    } else if (activePowerUp==='GHOST') {
      const alpha=0.5+0.5*Math.sin(now/90+i*0.4);
      fillColor=`rgba(187,136,255,${alpha})`;
      ctx.shadowColor='#aa66ff';
    } else if (activePowerUp==='SLOW') {
      const b=Math.floor(200-t*70);
      fillColor=isHead?'#00cfff':`rgb(0,${Math.floor(160*(1-t))},${b})`;
      ctx.shadowColor='#00cfff';
    } else {
      const g=Math.floor(255-t*90);
      fillColor=isHead?'#39ff14':`rgb(${Math.floor(t*40)},${g},${Math.floor(t*15)})`;
      ctx.shadowColor=isHead?'#39ff14':'#22cc00';
    }
    ctx.shadowBlur=isHead?22:(activePowerUp?14:8);
    ctx.fillStyle=fillColor;
    const pad2=isHead?1:3, r=isHead?5:3;
    roundRect(ctx,seg.x*CELL+pad2,seg.y*CELL+pad2,CELL-pad2*2,CELL-pad2*2,r);
    ctx.fill();
    if (isHead||i<3){
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.shadowBlur=0;
      ctx.save(); ctx.clip();
      roundRect(ctx,seg.x*CELL+pad2,seg.y*CELL+pad2,CELL-pad2*2,(CELL-pad2*2)*0.4,r); ctx.fill();
      ctx.restore();
    }
    if (isHead){
      ctx.shadowBlur=0;
      const ex=dir.x,ey=dir.y,hx=seg.x*CELL+CELL/2,hy=seg.y*CELL+CELL/2;
      const eo=3.5,fo=4.5;
      ctx.fillStyle='#050510';
      ctx.beginPath();
      ctx.arc(hx+ex*fo+ey*eo,hy+ey*fo-ex*eo,2.5,0,Math.PI*2);
      ctx.arc(hx+ex*fo-ey*eo,hy+ey*fo+ex*eo,2.5,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(hx+ex*fo+ey*eo+0.8,hy+ey*fo-ex*eo-0.8,1.1,0,Math.PI*2);
      ctx.arc(hx+ex*fo-ey*eo+0.8,hy+ey*fo+ex*eo-0.8,1.1,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  });

  // ── Particles ──
  particles.forEach(p=>p.update());
  particles=particles.filter(p=>p.life>0);
  particles.forEach(p=>p.draw());

  // ── Floaties ──
  floaties=floaties.filter(f=>f.life>0);
  floaties.forEach(f=>{f.update();f.draw();});

  // ── Combo banner ──
  if (combo>=2&&comboTimer>0){
    const alpha=Math.min(1,comboTimer/400);
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.font="bold 8px 'Press Start 2P',monospace";
    ctx.fillStyle='#ffd700'; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=16;
    ctx.textAlign='center';
    ctx.fillText(`${combo}× COMBO!`,canvas.width/2,24);
    ctx.restore();
  }

  // ── Power-up timer bar ──
  if (activePowerUp&&powerUpTimeLeft>0){
    const def=POWER_UPS[activePowerUp];
    const frac=powerUpTimeLeft/def.dur;
    const bw=canvas.width*0.65, bx=(canvas.width-bw)/2, by=canvas.height-12;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';
    roundRect(ctx,bx-2,by-6,bw+4,11,4); ctx.fill();
    ctx.fillStyle=def.color; ctx.shadowColor=def.color; ctx.shadowBlur=10;
    roundRect(ctx,bx,by-4,Math.max(bw*frac,0),7,3); ctx.fill();
    ctx.restore();
  }

  // ── NUEVO RÉCORD — solo parpadea 5 segundos ──
  if (newBestFlashUntil>0 && now<newBestFlashUntil && frameCount%30<15){
    ctx.save();
    ctx.font="bold 7px 'Press Start 2P',monospace";
    ctx.fillStyle='#ffd700'; ctx.shadowColor='#ffd700'; ctx.shadowBlur=20;
    ctx.textAlign='right';
    ctx.fillText('★ NUEVO RÉCORD',canvas.width-8,16);
    ctx.restore();
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
  if (snake.some(s=>s.x===head.x&&s.y===head.y)) return handleDeath();
  if (obstacles.some(o=>o.x===head.x&&o.y===head.y)) return handleDeath();

  snake.unshift(head);

  const fi=foods.findIndex(f=>f.x===head.x&&f.y===head.y);
  if (fi!==-1){
    const eaten=foods.splice(fi,1)[0];
    const ft=FOODS[eaten.type];

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
      localStorage.setItem('snakeBest',best);
      newBestFlashUntil=now+5000;  // parpadea exactamente 5 segundos
    }

    if (!rainbowMode&&score>=500){ rainbowMode=true; playRainbow(); }

    if (ft.pu) activatePowerUp(ft.pu);
    else       combo>=2?playCombo(combo):playEat();

    const newLvl=Math.min(10,1+Math.floor(score/60));
    if (newLvl!==level){
      level=newLvl;
      baseSpeed=Math.max(55,150-(level-1)*13);
      speed=(activePowerUp==='SLOW')?baseSpeed*1.7|0:baseSpeed;
      levelEl.textContent=level;
      buildObstacles(); resetLoop();
      try{music.setTempo(speed);}catch(e){}
      playLevelUp();
    }

    placeNormalFood(); maybeSpawnSpecial();
  } else {
    snake.pop();
  }
  draw();
}

// ─── Power-ups ────────────────────────────────
function activatePowerUp(key){
  const def=POWER_UPS[key];
  activePowerUp=key; powerUpTimeLeft=def.dur;
  showPowerUp(key); playPowerUp();
  if (key==='SLOW'){ speed=baseSpeed*1.7|0; resetLoop(); try{music.setTempo(speed);}catch(e){} }
}

function deactivatePowerUp(){
  const wasSlowing=activePowerUp==='SLOW';
  activePowerUp=null; powerUpTimeLeft=0; hidePowerUp();
  if (wasSlowing){ speed=baseSpeed; resetLoop(); try{music.setTempo(speed);}catch(e){} }
}

// ─── Death ────────────────────────────────────
function handleDeath(){
  snake.forEach(seg=>{
    const c=rainbowMode?`hsl(${Math.random()*360},100%,60%)`:'#39ff14';
    burst(seg.x*CELL+CELL/2,seg.y*CELL+CELL/2,c,3);
  });
  shakeFrames=18; shakeIntensity=9;
  playDie();
  try{music.stop();}catch(e){}
  lives--; updateLives();
  clearInterval(gameLoop);

  if (lives<=0){
    STATE='DYING';
    setTimeout(()=>{
      STATE='DEAD';
      finalScoreEl.textContent=`PUNTUACIÓN: ${score}`;
      finalBestEl.textContent =`RÉCORD: ${best}`;
      gameOverScreen.style.display='flex';
      mainHint.style.display='none';
      if (qualifiesForHighScore(score)) {
        initialsRow.style.display='flex';
        initialsInput.value='';
        renderHighScores(null);
        setTimeout(()=>initialsInput.focus(),50);
      } else {
        initialsRow.style.display='none';
        renderHighScores(null);
      }
    },900);
  } else {
    STATE='DYING';
    playLife();
    setTimeout(()=>{
      snake=[{x:12,y:10},{x:11,y:10},{x:10,y:10}];
      dir={x:1,y:0}; inputQueue=[];
      foods=[]; activePowerUp=null; powerUpTimeLeft=0;
      hidePowerUp(); buildObstacles(); placeNormalFood();
      STATE='PLAYING'; resetLoop();
      try{music.setTempo(speed);music.start();}catch(e){}
    },1000);
  }
}

// ─── Loop ────────────────────────────────────
function resetLoop(){
  clearInterval(gameLoop);
  gameLoop=setInterval(tick,speed);
}

function renderLoop(){
  if (STATE==='PLAYING'||STATE==='DYING'){
    try{draw();}catch(e){console.error('draw error:',e);}
  }
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// ─── Controls ────────────────────────────────
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
  if (d.x===last.x&&d.y===last.y) return;        // misma dirección, ignora
  if (d.x===-last.x&&d.y===-last.y) return;       // 180° respecto a la última encolada, ignora
  inputQueue.push(d);
}

document.addEventListener('keydown',e=>{
  if (e.key===KONAMI[konamiIdx]){
    konamiIdx++;
    if (konamiIdx>=KONAMI.length){ konamiIdx=0; rainbowMode=!rainbowMode; playRainbow(); }
  } else { konamiIdx=0; }

  if (STATE==='IDLE') return;

  if (e.key==='p'||e.key==='P'){
    togglePause();
    return;
  }
  const d=DIR_MAP[e.key];
  if (d){tryDir(d);e.preventDefault();}
});

let tx=0,ty=0;
canvas.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
canvas.addEventListener('touchmove',e=>{e.preventDefault();},{passive:false});
canvas.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
  tryDir(Math.abs(dx)>Math.abs(dy)?(dx>0?{x:1,y:0}:{x:-1,y:0}):(dy>0?{x:0,y:1}:{x:0,y:-1}));
},{passive:true});

document.getElementById('btnUp')   ?.addEventListener('click',()=>tryDir({x:0,y:-1}));
document.getElementById('btnDown') ?.addEventListener('click',()=>tryDir({x:0,y:1}));
document.getElementById('btnLeft') ?.addEventListener('click',()=>tryDir({x:-1,y:0}));
document.getElementById('btnRight')?.addEventListener('click',()=>tryDir({x:1,y:0}));

function togglePause(){
  if (STATE==='PLAYING'){
    STATE='PAUSED'; clearInterval(gameLoop);
    try{music.pause();}catch(e){}
    pauseScreen.style.display='flex';
  } else if (STATE==='PAUSED'){
    STATE='PLAYING'; pauseScreen.style.display='none';
    resetLoop(); try{music.resume();}catch(e){}
  }
}
document.getElementById('btnPause')?.addEventListener('click',togglePause);

document.getElementById('saveInitialsBtn')?.addEventListener('click',()=>{
  addHighScore(initialsInput.value, score);
  initialsRow.style.display='none';
  renderHighScores(score);
});
initialsInput?.addEventListener('keydown',e=>{
  if (e.key==='Enter') document.getElementById('saveInitialsBtn').click();
});

// ─── Botón fullscreen ──────────────────────
document.getElementById('fsBtn')?.addEventListener('click',()=>{
  const url=location.href.split('?')[0]+'?fs=1';
  window.open(url,'_blank',
    'width=800,height=720,menubar=no,toolbar=no,location=no,scrollbars=no,resizable=yes');
});

// ─── Botones Start / Restart ─────────────────
document.getElementById('startBtn').addEventListener('click',()=>{
  initAudio();
  startScreen.style.display='none';
  mainHint.style.display='block';
  init(); draw(); resetLoop();
  try{music.setTempo(speed);music.start();}catch(e){}
});

document.getElementById('restartBtn').addEventListener('click',()=>{
  initAudio();
  gameOverScreen.style.display='none';
  mainHint.style.display='block';
  init(); draw(); resetLoop();
  try{music.setTempo(speed);music.start();}catch(e){}
});