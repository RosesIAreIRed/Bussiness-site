/* =====================================================================
   SKYRIMCRAFT — воксельна RPG (Skyrim × Minecraft), рушій Three.js
   Покращене видання: тіні, шейдерне небо, день/ніч, текстури, звук,
   дерево навичок, кілька типів ворогів, бос-дракон.
   ===================================================================== */
(() => {
"use strict";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;

/* ============================= АУДІО ============================= */
const Audio={ctx:null,master:null,
  init(){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.master=this.ctx.createGain(); this.master.gain.value=Settings.vol; this.master.connect(this.ctx.destination);
  }catch(e){} },
  blip(freq,dur,type,vol,slide){ if(!this.ctx) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(freq,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*slide),t+dur);
    g.gain.setValueAtTime((vol||0.3),t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur); },
  noise(dur,vol,filt){ if(!this.ctx) return;
    const t=this.ctx.currentTime, n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const g=this.ctx.createGain(); g.gain.value=vol||0.3;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filt||800;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); },
  mine(){ this.noise(0.12,0.25,1200); },
  place(){ this.blip(180,0.08,'square',0.25); },
  sword(){ this.noise(0.1,0.3,3000); this.blip(420,0.08,'sawtooth',0.15,0.6); },
  hit(){ this.blip(140,0.12,'square',0.3,0.5); },
  fire(){ this.blip(220,0.3,'sawtooth',0.25,1.6); this.noise(0.3,0.18,900); },
  frost(){ this.blip(900,0.3,'sine',0.2,0.5); },
  shout(){ this.blip(90,0.6,'sawtooth',0.4,2.2); this.noise(0.5,0.3,400); },
  hurt(){ this.blip(160,0.18,'square',0.35,0.4); },
  gold(){ this.blip(880,0.07,'square',0.25); this.blip(1180,0.09,'square',0.2); },
  level(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.blip(f,0.18,'triangle',0.3),i*90)); },
  roar(){ this.blip(70,1.0,'sawtooth',0.5,1.5); this.noise(0.9,0.35,300); },
};

/* ============================= СТАН ============================= */
const G={started:false,over:false,paused:false,
  hp:100,hpMax:100,mp:100,mpMax:100,sp:100,spMax:100,
  level:1,xp:0,xpNext:100,gold:0,perks:0,slot:0,
  shoutReady:0,kills:0,blocksMined:0,blocksPlaced:0,
  dragonSpawned:false,dragonDead:false,startTime:0,time:0.28,seed:12345};
const SHOUT_CD_BASE=6000;
// перки (рівні)
const PERK={might:0,destruction:0,vitality:0,swift:0,thuum:0,fortune:0};
const PERK_DEF=[
  {id:'might',name:'Майстер клинка',max:5,desc:'+20% урону мечем за рівень.'},
  {id:'destruction',name:'Школа Руйнування',max:5,desc:'+20% урону магії, -10% витрат мани.'},
  {id:'vitality',name:'Витривалість',max:5,desc:'+25 макс. здоров\'я за рівень.'},
  {id:'swift',name:'Спритність',max:3,desc:'+12% швидкості руху за рівень.'},
  {id:'thuum',name:'Сила Ту\'ум',max:3,desc:'-1с перезарядки Крику за рівень.'},
  {id:'fortune',name:'Удача',max:5,desc:'+25% золота з ворогів за рівень.'},
];

const HOTBAR=[
  {name:'Меч',   icon:'⚔️',type:'weapon'},
  {name:'Камінь',icon:'🧱',type:'block',block:3},
  {name:'Земля', icon:'🟫',type:'block',block:1},
  {name:'Дерево',icon:'🪵',type:'block',block:5},
  {name:'Факел', icon:'🔥',type:'block',block:8},
  {name:'Зілля', icon:'🧪',type:'potion'},
];

/* ============================= НАЛАШТУВАННЯ ============================= */
const Settings={sens:1.0,vol:0.35,fov:74,view:150};
function loadSettings(){ try{ const s=JSON.parse(localStorage.getItem('skyrimcraft.settings')); if(s)Object.assign(Settings,s);}catch(e){} }
function saveSettings(){ try{ localStorage.setItem('skyrimcraft.settings',JSON.stringify(Settings)); }catch(e){} }
loadSettings();

/* ---- збереження прогресу ---- */
function saveGame(){ try{ localStorage.setItem('skyrimcraft.save',JSON.stringify({
  level:G.level,xp:G.xp,xpNext:G.xpNext,gold:G.gold,perks:G.perks,
  hpMax:G.hpMax,mpMax:G.mpMax,spMax:G.spMax,kills:G.kills,seed:G.seed,
  dragonDead:G.dragonDead,perkLevels:{...PERK}})); }catch(e){} }
function loadSave(){ try{ return JSON.parse(localStorage.getItem('skyrimcraft.save')); }catch(e){ return null; } }
function hasSave(){ return !!loadSave(); }

/* ---- сід-генератор (для відтворюваного світу) ---- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
let RNG=Math.random;

/* ============================= РЕНДЕР ============================= */
const canvas=document.getElementById('game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x8fb6d9,Settings.view*0.35,Settings.view);

const camera=new THREE.PerspectiveCamera(Settings.fov,innerWidth/innerHeight,0.06,600);

// окрема сцена для viewmodel (зброя в руках), щоб не обрізалась
const vmScene=new THREE.Scene();
const vmCam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.01,10);
vmScene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.1));
const vmLight=new THREE.DirectionalLight(0xffffff,0.7); vmLight.position.set(1,2,2); vmScene.add(vmLight);

/* ---- освітлення ---- */
const sun=new THREE.DirectionalLight(0xfff2d6,1.0);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1; sun.shadow.camera.far=160;
const SHR=46;
sun.shadow.camera.left=-SHR; sun.shadow.camera.right=SHR;
sun.shadow.camera.top=SHR; sun.shadow.camera.bottom=-SHR;
sun.shadow.bias=-0.0006;
scene.add(sun); scene.add(sun.target);
const hemi=new THREE.HemisphereLight(0xbfe0ff,0x55502f,0.7); scene.add(hemi);
const ambient=new THREE.AmbientLight(0xffffff,0.18); scene.add(ambient);
const moonLight=new THREE.DirectionalLight(0x9fb6e0,0.0); scene.add(moonLight);
const lantern=new THREE.PointLight(0xffcf8a,0.0,22,2); scene.add(lantern);

/* ============================= НЕБО ============================= */
const skyUniforms={
  top:{value:new THREE.Color(0x2a6bb0)},
  bottom:{value:new THREE.Color(0xbfe0ff)},
  sunDir:{value:new THREE.Vector3(0,1,0)},
  sunColor:{value:new THREE.Color(0xfff2d6)},
};
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false, uniforms:skyUniforms,
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader:`varying vec3 vP; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor;
    void main(){ vec3 d=normalize(vP); float h=clamp(d.y*0.5+0.5,0.0,1.0);
      vec3 col=mix(bottom,top,pow(h,0.7));
      float s=clamp(dot(d,normalize(sunDir)),0.0,1.0);
      col+=sunColor*pow(s,180.0)*1.2;          // диск сонця
      col+=sunColor*pow(s,8.0)*0.18;           // гало
      gl_FragColor=vec4(col,1.0);} `
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(400,24,16),skyMat);
scene.add(sky);

// зорі
const starGeo=new THREE.BufferGeometry();
{ const N=600,arr=new Float32Array(N*3);
  for(let i=0;i<N;i++){ const u=Math.random()*2-1, th=Math.random()*TAU, r=Math.sqrt(1-u*u);
    const v=new THREE.Vector3(r*Math.cos(th),u,r*Math.sin(th)).multiplyScalar(380);
    arr[i*3]=v.x; arr[i*3+1]=Math.abs(v.y)*0.8+20; arr[i*3+2]=v.z; }
  starGeo.setAttribute('position',new THREE.BufferAttribute(arr,3)); }
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xffffff,size:1.4,transparent:true,opacity:0}));
scene.add(stars);

// місяць
const moon=new THREE.Mesh(new THREE.SphereGeometry(8,16,16),new THREE.MeshBasicMaterial({color:0xdfe6f5,fog:false}));
scene.add(moon);

// хмари
const cloudTex=makeCloudTexture();
const clouds=[];
for(let i=0;i<14;i++){
  const s=rand(30,70);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(s,s*0.6),
    new THREE.MeshBasicMaterial({map:cloudTex,transparent:true,opacity:0.55,depthWrite:false,fog:true}));
  m.rotation.x=-Math.PI/2;
  m.position.set(rand(-160,160),rand(58,86),rand(-160,160));
  scene.add(m); clouds.push(m);
}

/* ---- світіння (fake bloom через адитивні спрайти) ---- */
const glowTex=(()=>{ const s=64,c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.4,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,s,s); return new THREE.CanvasTexture(c); })();
function makeGlow(color,size){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color,
  blending:THREE.AdditiveBlending,depthWrite:false,transparent:true})); sp.scale.setScalar(size||1.5); return sp; }

/* ============================= ТЕКСТУРИ ============================= */
function px(ctx,x,y,c){ ctx.fillStyle=c; ctx.fillRect(x,y,1,1); }
function noiseTex(base,spread,size){
  size=size||16; const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const b=new THREE.Color(base);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const n=(Math.random()-0.5)*spread;
    const col=new THREE.Color(clamp(b.r+n,0,1),clamp(b.g+n,0,1),clamp(b.b+n,0,1));
    px(ctx,x,y,'#'+col.getHexString());
  }
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.encoding=THREE.sRGBEncoding;
  return t;
}
function grassTopTex(){ const t=noiseTex(0x6fae3d,0.12); return t; }
function makeCloudTexture(){
  const s=64,c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  ctx.clearRect(0,0,s,s);
  for(let i=0;i<40;i++){ const r=rand(6,16),x=rand(r,s-r),y=rand(r,s-r);
    const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }
  const t=new THREE.CanvasTexture(c); return t;
}
function faceMats(side,top,bottom,opts){
  opts=opts||{};
  const mk=tex=>{ const m=new THREE.MeshStandardMaterial({map:tex,roughness:opts.rough!=null?opts.rough:0.92,metalness:0});
    if(opts.emissive){ m.emissive=new THREE.Color(opts.emissive); m.emissiveIntensity=opts.ei||0.8; m.emissiveMap=tex; }
    if(opts.transparent){ m.transparent=true; m.opacity=opts.opacity||0.75; }
    return m; };
  const s=mk(side),tp=mk(top),bt=mk(bottom);
  // порядок груп BoxGeometry: +x,-x,+y(top),-y(bottom),+z,-z
  return [s,s,tp,bt,s,s];
}

const BLOCKS={
  1:{name:'трава', mats:()=>faceMats(noiseTex(0x7a5a32,0.1),grassTopTex(),noiseTex(0x6e5630,0.08))},
  2:{name:'каменина',mats:()=>faceMats(noiseTex(0x7c7c7c,0.1),noiseTex(0x8a8a8a,0.1),noiseTex(0x6e6e6e,0.1))},
  3:{name:'камінь', mats:()=>faceMats(noiseTex(0x888888,0.12),noiseTex(0x9a9a9a,0.12),noiseTex(0x777777,0.12))},
  4:{name:'пісок',  mats:()=>faceMats(noiseTex(0xd6c98f,0.07),noiseTex(0xded3a0,0.07),noiseTex(0xc9bc80,0.07))},
  5:{name:'дерево', mats:()=>faceMats(noiseTex(0x7a5d36,0.09),noiseTex(0x9a7b4f,0.07),noiseTex(0x6a4f2c,0.07))},
  6:{name:'листя',  mats:()=>faceMats(noiseTex(0x376e2d,0.13),noiseTex(0x3f7d34,0.13),noiseTex(0x2f5f27,0.13))},
  7:{name:'вода',   mats:()=>faceMats(noiseTex(0x2f6fb0,0.05),noiseTex(0x357ec0,0.05),noiseTex(0x255f9a,0.05),{transparent:true,opacity:0.72,rough:0.2})},
  8:{name:'факел',  mats:()=>faceMats(noiseTex(0xffb23a,0.1),noiseTex(0xffcf5a,0.1),noiseTex(0xff9a2a,0.1),{emissive:0xffaa33,ei:1.2})},
  9:{name:'сніг',   mats:()=>faceMats(noiseTex(0xdfe8f2,0.05),noiseTex(0xeef4fb,0.05),noiseTex(0xd0dbe8,0.05))},
  10:{name:'руда',  mats:()=>faceMats(noiseTex(0x8a8a8a,0.1),noiseTex(0x8a8a8a,0.1),noiseTex(0x8a8a8a,0.1),{emissive:0x4477aa,ei:0.25})},
};

/* ============================= СВІТ ============================= */
const WORLD=new Map();
const key=(x,y,z)=>x+','+y+','+z;
const getBlock=(x,y,z)=>WORLD.get(key(x,y,z))||0;

const blockGeo=new THREE.BoxGeometry(1,1,1);
const instMeshes={}, instData={};
const MAX_INST=90000;
function buildInstancedMeshes(){
  for(const t in BLOCKS){
    const im=new THREE.InstancedMesh(blockGeo,BLOCKS[t].mats(),MAX_INST);
    im.count=0; im.frustumCulled=false;
    im.castShadow=false; im.receiveShadow=true;       // світ приймає тіні
    if(t==7){ im.material.forEach(mt=>{ if(mt.map){ mt.map.wrapS=mt.map.wrapT=THREE.RepeatWrapping; } }); }
    scene.add(im); instMeshes[t]=im; instData[t]={list:[],map:new Map()};
  }
}
const _m=new THREE.Matrix4();
function refreshInstance(t){ const im=instMeshes[t],d=instData[t];
  for(let i=0;i<d.list.length;i++){ const p=d.list[i]; _m.makeTranslation(p[0]+0.5,p[1]+0.5,p[2]+0.5); im.setMatrixAt(i,_m); }
  im.count=d.list.length; im.instanceMatrix.needsUpdate=true; }
function addBlock(x,y,z,t,defer){ const k=key(x,y,z); if(WORLD.has(k))return;
  WORLD.set(k,t); const d=instData[t]; d.map.set(k,d.list.length); d.list.push([x,y,z]); if(!defer)refreshInstance(t); }
function removeBlock(x,y,z){ const k=key(x,y,z); const t=WORLD.get(k); if(!t)return 0;
  WORLD.delete(k); const d=instData[t]; const idx=d.map.get(k); const last=d.list.length-1;
  if(idx!==last){ const mv=d.list[last]; d.list[idx]=mv; d.map.set(key(mv[0],mv[1],mv[2]),idx); }
  d.list.pop(); d.map.delete(k); refreshInstance(t); return t; }

const WSIZE=54;
function genHeight(x,z){
  return Math.round(6 + Math.sin(x*0.12)*2.5 + Math.cos(z*0.11)*2.5
    + Math.sin((x+z)*0.05)*3 + Math.sin(x*0.31)*Math.cos(z*0.27)*1.5);
}
function generateWorld(onProgress){
  const cols=[]; for(let x=-WSIZE;x<=WSIZE;x++)for(let z=-WSIZE;z<=WSIZE;z++)cols.push([x,z]);
  for(const [x,z] of cols){
    const h=genHeight(x,z);
    for(let y=h;y>h-4;y--){
      let t=(y===h)?1:2;
      if(h<=4&&y===h)t=4;
      if(h>=11&&y===h)t=9;
      if(y<h-1&&RNG()<0.05)t=10;     // руда глибше
      addBlock(x,y,z,t,true);
    }
    if(h<4){ for(let y=h+1;y<=4;y++)addBlock(x,y,z,7,true); }
    if(h>4&&h<11&&RNG()<0.013){
      const th=4+Math.floor(RNG()*3);
      for(let i=1;i<=th;i++)addBlock(x,h+i,z,5,true);
      for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=2;dy++)
        if(Math.abs(dx)+Math.abs(dz)+dy<=3&&!(dx===0&&dz===0&&dy===0))addBlock(x+dx,h+th+dy,z+dz,6,true);
    }
  }
  // розкидані валуни-орієнтири
  for(let i=0;i<14;i++){ const x=Math.floor(RNG()*WSIZE*2-WSIZE),z=Math.floor(RNG()*WSIZE*2-WSIZE),h=genHeight(x,z);
    if(h>4&&h<11)for(let dx=0;dx<2;dx++)for(let dz=0;dz<2;dz++)for(let dy=1;dy<=1+Math.floor(RNG()*2);dy++)addBlock(x+dx,h+dy,z+dz,3,true); }
  // центральна вежа-вівтар
  for(let y=0;y<8;y++)for(let a=0;a<TAU;a+=0.45){
    const rx=Math.round(Math.cos(a)*3.2),rz=Math.round(Math.sin(a)*3.2);
    if(y%6!==5||RNG()<0.6)addBlock(rx,genHeight(rx,rz)+1+y,rz,3,true);
  }
  addBlock(0,genHeight(0,0)+1,0,8,true);
  for(const t in instData)refreshInstance(+t);
  // скрині зі скарбами по світу
  for(let i=0;i<6;i++){ const a=RNG()*TAU,r=rand(16,WSIZE-6);
    const x=Math.round(Math.cos(a)*r),z=Math.round(Math.sin(a)*r); if(genHeight(x,z)>4)makeChest(x,z); }
  if(onProgress)onProgress(1);
}
function surfaceY(x,z){ let y=22; while(y>-6&&getBlock(x,y,z)===0)y--; return y; }
function clearWorld(){
  WORLD.clear();
  for(const t in instData){ instData[t].list.length=0; instData[t].map.clear(); instMeshes[t].count=0; instMeshes[t].instanceMatrix.needsUpdate=true; }
  for(const c of chests)scene.remove(c.mesh); chests.length=0;
}
function regenerateWorld(seed){ G.seed=seed; RNG=mulberry32(seed); clearWorld(); generateWorld(()=>{}); }

/* ============================= ГРАВЕЦЬ ============================= */
const player={pos:new THREE.Vector3(0,25,8),vel:new THREE.Vector3(),onGround:false,
  yaw:Math.PI,pitch:0,height:1.7,radius:0.3};
function solidAt(x,y,z){ const b=getBlock(Math.floor(x),Math.floor(y),Math.floor(z)); return b!==0&&b!==7&&b!==8; }
function tryMove(axis,amount){
  const p=player.pos,r=player.radius,h=player.height; p[axis]+=amount;
  const minX=Math.floor(p.x-r),maxX=Math.floor(p.x+r),minZ=Math.floor(p.z-r),maxZ=Math.floor(p.z+r),
        minY=Math.floor(p.y),maxY=Math.floor(p.y+h);
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++){
    if(solidAt(x+0.5,y+0.5,z+0.5)){
      if(axis==='y'){ if(amount>0){p.y=y-h-0.001;player.vel.y=0;} else {p.y=y+1+0.001;player.vel.y=0;player.onGround=true;} }
      else if(axis==='x'){ p.x=amount>0?x-r-0.001:x+1+r+0.001; player.vel.x=0; }
      else { p.z=amount>0?z-r-0.001:z+1+r+0.001; player.vel.z=0; }
      return;
    }
  }
}

/* ---- viewmodel (меч/рука) ---- */
let viewmodel,vmType='weapon';
function buildViewmodel(){
  viewmodel=new THREE.Group();
  // рука
  const hand=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.4),new THREE.MeshStandardMaterial({color:0xc9b79a,roughness:1}));
  hand.position.set(0.32,-0.28,-0.55); hand.rotation.x=0.3; viewmodel.add(hand);
  // меч
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.7),new THREE.MeshStandardMaterial({color:0xcfd6dd,roughness:0.3,metalness:0.8}));
  blade.position.set(0.32,-0.18,-0.95);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.05,0.06),new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:0.6}));
  guard.position.set(0.32,-0.22,-0.6);
  viewmodel.swordParts=[blade,guard]; viewmodel.add(blade); viewmodel.add(guard);
  viewmodel.hand=hand;
  vmScene.add(viewmodel);
}
function updateViewmodel(dt){
  if(!viewmodel)return;
  const sw=HOTBAR[G.slot];
  const showSword=sw.type==='weapon';
  viewmodel.swordParts.forEach(p=>p.visible=showSword);
  // погойдування
  const bob=Math.sin(walkPhase)*0.02;
  const baseX=0.32, baseY=-0.28+bob;
  let swingRot=0;
  if(swordSwing>0) swingRot=Math.sin((1-swordSwing)*Math.PI)*1.4;
  viewmodel.rotation.set(swingRot*0.6,-swingRot*0.4,0);
  viewmodel.position.set(0,bob,0);
}

/* ============================= ВВІД ============================= */
const keys={}; let pointerLocked=false;
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Escape'){ if(G.started&&!G.over)togglePause(); return; }
  if(!G.started||G.over||G.paused)return;
  if(e.code>='Digit1'&&e.code<='Digit6')selectSlot(+e.code.slice(5)-1);
  if(e.code==='KeyQ')doShout();
  if(e.code==='KeyF')castFire();
  if(e.code==='KeyR')castFrost();
  if(e.code==='KeyE')interact();
  if(e.code==='KeyP')toggleSkills();
});
addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('click',()=>{ if(G.started&&!G.over&&!G.paused&&!pointerLocked)canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===canvas);
document.addEventListener('mousemove',e=>{ if(!pointerLocked)return; const s=0.0022*Settings.sens;
  player.yaw-=e.movementX*s; player.pitch=clamp(player.pitch-e.movementY*s,-1.5,1.5); });
document.addEventListener('mousedown',e=>{ if(!G.started||G.over||G.paused||!pointerLocked)return;
  if(e.button===0)primaryAction(); if(e.button===2)secondaryAction(); });
addEventListener('contextmenu',e=>e.preventDefault());

/* ---- рейкаст DDA ---- */
function lookDir(){ return new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ')).normalize(); }
function raycastVoxel(maxDist){
  const dir=lookDir();
  const o=new THREE.Vector3(player.pos.x,player.pos.y+player.height*0.9,player.pos.z);
  let x=Math.floor(o.x),y=Math.floor(o.y),z=Math.floor(o.z);
  const sx=Math.sign(dir.x)||1,sy=Math.sign(dir.y)||1,sz=Math.sign(dir.z)||1;
  const tDX=Math.abs(1/dir.x),tDY=Math.abs(1/dir.y),tDZ=Math.abs(1/dir.z);
  let tMX=(sx>0?x+1-o.x:o.x-x)*tDX,tMY=(sy>0?y+1-o.y:o.y-y)*tDY,tMZ=(sz>0?z+1-o.z:o.z-z)*tDZ;
  let face=[0,0,0],t=0;
  while(t<maxDist){
    if(getBlock(x,y,z)!==0)return {x,y,z,face};
    if(tMX<tMY&&tMX<tMZ){x+=sx;t=tMX;tMX+=tDX;face=[-sx,0,0];}
    else if(tMY<tMZ){y+=sy;t=tMY;tMY+=tDY;face=[0,-sy,0];}
    else {z+=sz;t=tMZ;tMZ+=tDZ;face=[0,0,-sz];}
  }
  return null;
}

/* ============================= ДІЇ ============================= */
function primaryAction(){ const it=HOTBAR[G.slot]; if(it.type==='weapon')swingSword(); else if(it.type==='block')mineBlock(); else mineBlock(); }
function secondaryAction(){ const it=HOTBAR[G.slot];
  if(it.type==='block')placeBlock(); else if(it.type==='potion')drinkPotion(); else block(); }

function mineBlock(){ const hit=raycastVoxel(6); if(!hit)return; const t=getBlock(hit.x,hit.y,hit.z); if(t===7)return;
  removeBlock(hit.x,hit.y,hit.z); G.blocksMined++; Audio.mine(); spawnBlockParticles(hit.x,hit.y,hit.z,t);
  if(t===10){ const g=randi(4,10)*(1+0.25*PERK.fortune); G.gold+=Math.round(g); Audio.gold(); floatText(new THREE.Vector3(hit.x+.5,hit.y+1,hit.z+.5),'+'+Math.round(g)+'💰','#e8c66a'); }
  questProgress('mine'); }

function placeBlock(){ const it=HOTBAR[G.slot]; if(it.type!=='block')return; const hit=raycastVoxel(6); if(!hit)return;
  const nx=hit.x+hit.face[0],ny=hit.y+hit.face[1],nz=hit.z+hit.face[2];
  const aX=Math.floor(player.pos.x-0.3),bX=Math.floor(player.pos.x+0.3),aZ=Math.floor(player.pos.z-0.3),bZ=Math.floor(player.pos.z+0.3),
        aY=Math.floor(player.pos.y),bY=Math.floor(player.pos.y+player.height);
  if(nx>=aX&&nx<=bX&&nz>=aZ&&nz<=bZ&&ny>=aY&&ny<=bY)return;
  addBlock(nx,ny,nz,it.block); G.blocksPlaced++; Audio.place(); questProgress('build'); }

let blocking=false;
function block(){ /* щит-блок поки декоративний */ }

/* ---- бій ---- */
let swordSwing=0;
function swingSword(){
  if(G.sp<8)return; G.sp-=8; swordSwing=1; Audio.sword();
  const reach=3.4, dir=lookDir(); let best=null,bd=reach;
  for(const en of enemies){ if(en.dead)continue;
    const to=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.5:1,0)).sub(camera.position);
    const dist=to.length(); if(dist>reach)continue; to.normalize();
    if(to.dot(dir)>0.55&&dist<bd){bd=dist;best=en;} }
  if(best){ const dmg=(22+G.level*4)*(1+0.2*PERK.might); damageEnemy(best,dmg); hitSpark(best.mesh.position); Audio.hit(); }
}
function castFire(){ const cost=Math.round(20*(1-0.1*PERK.destruction)); if(G.mp<cost){toast('Недостатньо мани');return;}
  G.mp-=cost; Audio.fire(); const dir=lookDir(), o=camera.position.clone();
  const dmg=(30+G.level*5)*(1+0.2*PERK.destruction);
  projectiles.push({pos:o,vel:dir.clone().multiplyScalar(30),life:1.5,dmg,friendly:true,kind:'fire',mesh:makeOrb(o,0xff7722,0x441100)});
  subtitle("Yol! — Полум'я"); }
function castFrost(){ const cost=Math.round(18*(1-0.1*PERK.destruction)); if(G.mp<cost){toast('Недостатньо мани');return;}
  G.mp-=cost; Audio.frost(); const dir=lookDir(), o=camera.position.clone();
  const dmg=(20+G.level*4)*(1+0.2*PERK.destruction);
  projectiles.push({pos:o,vel:dir.clone().multiplyScalar(34),life:1.4,dmg,friendly:true,kind:'frost',slow:true,mesh:makeOrb(o,0x88ddff,0x113344)});
  subtitle('Fo! — Крижаний подих'); }
function doShout(){ const cd=SHOUT_CD_BASE-PERK.thuum*1000;
  if(performance.now()<G.shoutReady){toast('Крик ще не готовий');return;}
  G.shoutReady=performance.now()+cd; Audio.shout(); subtitle('FUS RO DAH!'); shoutFlash();
  const dir=lookDir();
  for(const en of enemies){ if(en.dead)continue;
    const to=en.mesh.position.clone().sub(camera.position); const dist=to.length();
    if(dist<15&&to.clone().normalize().dot(dir)>0.35){ en.vel.add(to.normalize().multiplyScalar(20)); en.vel.y=9; damageEnemy(en,16); } } }
function drinkPotion(){ if(G.gold<25){toast('Потрібно 25 золота');return;} G.gold-=25; G.hp=clamp(G.hp+50,0,G.hpMax); Audio.gold(); toast('+50 здоров\'я'); floatText(camera.position,'+50','#37c46b'); }
function interact(){
  for(const p of pickups){ if(!p.dead&&p.mesh.position.distanceTo(camera.position)<2.6)collectPickup(p); }
  if(tryOpenChest())return;
  if(!G.dragonSpawned&&Math.hypot(player.pos.x,player.pos.z)<5){
    if(G.level>=3)summonDragon(); else toast('Вівтар мовчить. Потрібен 3 рівень.');
  }
}

/* ============================= ВОРОГИ ============================= */
const enemies=[];
const M=c=>new THREE.MeshStandardMaterial({color:c,roughness:0.85});
function humanoid(color,headCol){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.8,0.35),M(color)); body.position.y=0.9;
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.45,0.45),M(headCol||0xc9b79a)); head.position.y=1.55;
  const ag=new THREE.BoxGeometry(0.18,0.7,0.18);
  const la=new THREE.Mesh(ag,M(color)); la.position.set(-0.4,0.95,0);
  const ra=new THREE.Mesh(ag,M(color)); ra.position.set(0.4,0.95,0);
  const lg=new THREE.BoxGeometry(0.22,0.7,0.22);
  const ll=new THREE.Mesh(lg,M(0x333333)); ll.position.set(-0.16,0.35,0);
  const rl=new THREE.Mesh(lg,M(0x333333)); rl.position.set(0.16,0.35,0);
  [body,head,la,ra,ll,rl].forEach(p=>{p.castShadow=true;g.add(p);});
  g.userData.limbs={la,ra,ll,rl}; g.userData.body=body;
  return g;
}
const ENEMY_TYPES={
  bandit:{name:'Бандит',col:0x6b3a2a,hp:45,dmg:8,xp:25,gold:12,speed:2.8,ranged:false},
  draugr:{name:'Дроуг',col:0x4a5a40,head:0x9aa48a,hp:65,dmg:11,xp:38,gold:16,speed:2.3,ranged:false},
  skeleton:{name:'Скелет-маг',col:0xb9b6a8,head:0xe8e4d6,hp:40,dmg:14,xp:42,gold:20,speed:2.0,ranged:true},
  wraith:{name:'Крижана примара',col:0x6fb0d0,head:0xbfeaff,hp:55,dmg:12,xp:48,gold:24,speed:3.3,ranged:false,frost:true},
};
function spawnEnemy(type,x,z){
  const def=ENEMY_TYPES[type]; const y=surfaceY(Math.floor(x),Math.floor(z))+1;
  const mesh=humanoid(def.col,def.head); mesh.position.set(x,y,z); scene.add(mesh);
  const scale=1+(G.level-1)*0.08;
  enemies.push({type,name:def.name,mesh,hp:def.hp*scale,hpMax:def.hp*scale,dmg:def.dmg*scale,
    xp:def.xp,gold:def.gold,speed:def.speed,ranged:def.ranged,frost:def.frost,
    vel:new THREE.Vector3(),dead:false,onGround:false,atkCd:rand(0,1),anim:0,boss:false,slowT:0,flash:0});
  createEnemyBar(enemies[enemies.length-1]);
}
function damageEnemy(en,amount){ if(en.dead)return;
  if(en.boss&&en.state==='land')amount*=1.6;            // дракон вразливіший на землі
  en.hp-=amount; en.flash=6;
  floatText(en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?2.5:1.8,0)),Math.round(amount),en.boss?'#ff8a5a':'#ffd34a');
  if(en.boss)updateBossBar(); if(en.hp<=0)killEnemy(en); }
function killEnemy(en){ en.dead=true; scene.remove(en.mesh); removeEnemyBar(en); G.kills++; gainXP(en.xp);
  dropGold(en.mesh.position,Math.round(en.gold*(1+0.25*PERK.fortune)));
  if(Math.random()<0.2)dropPotion(en.mesh.position);
  if(en.boss){G.dragonDead=true;victory();} questProgress('kill'); }

/* ---- дракон ---- */
let dragon=null;
function makeDragon(){
  const g=new THREE.Group(); const dark=M(0x2e2a33),mid=M(0x46414f),wing=M(0x5a5560);
  const parts=[];
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.2,3.4),dark); parts.push(body);
  const neck=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,1.6),mid); neck.position.set(0,0.4,2.2); parts.push(neck);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.8,1.2),dark); head.position.set(0,0.7,3.3); parts.push(head);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,2.6),mid); tail.position.set(0,0,-2.6); parts.push(tail);
  const wg=new THREE.BoxGeometry(3.6,0.16,1.9);
  const lw=new THREE.Mesh(wg,wing); lw.position.set(-2.5,0.6,0);
  const rw=new THREE.Mesh(wg,wing); rw.position.set(2.5,0.6,0); parts.push(lw,rw);
  const eyeM=new THREE.MeshBasicMaterial({color:0xff5522});
  const e1=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.05),eyeM); e1.position.set(-0.3,0.85,3.9);
  const e2=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.05),eyeM); e2.position.set(0.3,0.85,3.9);
  parts.forEach(p=>{p.castShadow=true;g.add(p);}); g.add(e1); g.add(e2);
  g.userData.wings={lw,rw}; g.scale.setScalar(1.6); return g;
}
function summonDragon(){
  G.dragonSpawned=true; const y=surfaceY(0,0)+22; const mesh=makeDragon(); mesh.position.set(0,y,0); scene.add(mesh);
  dragon={type:'dragon',name:'Алдуїн Кубічний',mesh,hp:600+G.level*40,hpMax:600+G.level*40,dmg:18,xp:320,gold:250,
    speed:6,vel:new THREE.Vector3(),dead:false,boss:true,atkCd:0,anim:0,state:'fly',timer:4,orbitA:0,flash:0,swoops:0,landT:0};
  enemies.push(dragon); createEnemyBar(dragon);
  document.getElementById('bossbar').style.display='block'; updateBossBar();
  Audio.roar(); toast('СТАРОДАВНІЙ ДРАКОН ПРОБУДИВСЯ!'); subtitle("Алдуїн: «Zu'u Alduin, Thuri!»");
  renderQuests();
}
function updateBossBar(){ if(!dragon)return;
  document.getElementById('bossFill').style.width=clamp(dragon.hp/dragon.hpMax*100,0,100)+'%';
  document.querySelector('#bossbar .name').textContent=dragon.name.toUpperCase(); }

/* ============================= СНАРЯДИ ============================= */
const projectiles=[];
function makeOrb(pos,col,emis){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.25,10,10),
  new THREE.MeshStandardMaterial({color:col,emissive:emis||col,emissiveIntensity:1.2,roughness:0.4}));
  m.add(makeGlow(col,2.2)); m.position.copy(pos); scene.add(m); return m; }
function updateProjectiles(dt){
  for(const p of projectiles){ if(p.dead)continue; p.life-=dt; p.pos.addScaledVector(p.vel,dt); p.mesh.position.copy(p.pos);
    // слід
    if(Math.random()<0.6)trailParticle(p.pos,p.kind==='frost'?0x88ddff:(p.friendly?0xff7722:0xff3311));
    if(getBlock(Math.floor(p.pos.x),Math.floor(p.pos.y),Math.floor(p.pos.z))!==0){ p.dead=true; scene.remove(p.mesh); continue; }
    if(p.friendly){ for(const en of enemies){ if(en.dead)continue;
        const c=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.2:1,0));
        if(p.pos.distanceTo(c)<(en.boss?2.6:1.1)){ damageEnemy(en,p.dmg); if(p.slow)en.slowT=2.5; hitSpark(en.mesh.position); p.dead=true; scene.remove(p.mesh); break; } } }
    else { if(p.pos.distanceTo(camera.position)<1){ hurtPlayer(p.dmg); if(p.slow)playerSlow=2; p.dead=true; scene.remove(p.mesh); } }
    if(p.life<=0){ p.dead=true; scene.remove(p.mesh); } }
}

/* ============================= СКРИНІ ============================= */
const chests=[];
function makeChest(x,z){
  const y=surfaceY(Math.floor(x),Math.floor(z))+1;
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.5,0.5),M(0x6a4a28)); base.position.y=0.25; base.castShadow=true;
  const lid=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.18,0.52),M(0x7a5a32)); lid.position.y=0.58;
  const lock=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.18,0.06),M(0xe8c66a)); lock.position.set(0,0.42,0.27);
  g.add(base); g.add(lid); g.add(lock); g.add(makeGlow(0xe8c66a,1.0));
  g.position.set(x,y,z); scene.add(g);
  chests.push({mesh:g,lid,taken:false,gold:randi(30,90),x,z});
}
function tryOpenChest(){
  for(const c of chests){ if(c.taken)continue;
    if(c.mesh.position.distanceTo(camera.position)<2.4){ c.taken=true; c.lid.rotation.x=-1.1;
      const g=Math.round(c.gold*(1+0.25*PERK.fortune)); G.gold+=g; Audio.gold(); gainXP(20);
      floatText(c.mesh.position.clone().add(new THREE.Vector3(0,1.2,0)),'Скриня: +'+g+'💰','#e8c66a');
      toast('Знайдено скарб!'); return true; } }
  return false;
}

/* ============================= ПІДБІРНІ ============================= */
const pickups=[];
function dropGold(pos,amount){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),
  new THREE.MeshStandardMaterial({color:0xe8c66a,emissive:0x4a3a10,roughness:0.4,metalness:0.6}));
  m.position.copy(pos); m.position.y+=0.5; scene.add(m); pickups.push({mesh:m,amount,kind:'gold',dead:false,spin:0}); }
function dropPotion(pos){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.4,0.25),
  new THREE.MeshStandardMaterial({color:0xc0392b,emissive:0x400808,roughness:0.3})); m.position.copy(pos); m.position.y+=0.4;
  scene.add(m); pickups.push({mesh:m,kind:'potion',dead:false,spin:0}); }
function collectPickup(p){ p.dead=true; scene.remove(p.mesh);
  if(p.kind==='gold'){ G.gold+=p.amount; Audio.gold(); floatText(camera.position,'+'+p.amount+'💰','#e8c66a'); }
  else { G.hp=clamp(G.hp+40,0,G.hpMax); Audio.gold(); floatText(camera.position,'+40 ♥','#e0594b'); } updateHUD(); }

/* ============================= ЧАСТИНКИ ============================= */
const particles=[];
function spawnBlockParticles(x,y,z,t){ const c=BLOCKS[t]?0x999999:0x999999;
  let col=0x8a8a8a; const map={1:0x6fae3d,3:0x9a9a9a,4:0xded3a0,5:0x9a7b4f,6:0x3f7d34,9:0xeef4fb,10:0x4477aa};
  col=map[t]||0x8a8a8a;
  for(let i=0;i<7;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12),M(col)); m.position.set(x+0.5,y+0.5,z+0.5);
    scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-2,2),rand(2,5),rand(-2,2)),life:0.8,grav:true}); } }
function hitSpark(pos){ for(let i=0;i<6;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1),
  new THREE.MeshBasicMaterial({color:0xffcc44})); m.position.copy(pos); m.position.y+=1; scene.add(m);
  particles.push({mesh:m,vel:new THREE.Vector3(rand(-3,3),rand(1,4),rand(-3,3)),life:0.5,grav:true}); } }
function trailParticle(pos,col){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12),new THREE.MeshBasicMaterial({color:col}));
  m.position.copy(pos); scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-.4,.4),rand(-.4,.4),rand(-.4,.4)),life:0.35,grav:false}); }

/* ============================= СПЛИВ. ТЕКСТ ============================= */
const floaters=[];
function floatText(pos3,text,color){ const el=document.createElement('div'); el.textContent=text;
  el.style.cssText=`position:fixed;color:${color};font-weight:bold;font-size:18px;text-shadow:0 1px 3px #000;pointer-events:none;z-index:8;`;
  document.body.appendChild(el); floaters.push({el,pos:pos3.clone(),life:1}); }

/* ---- смужки здоров'я ворогів ---- */
function createEnemyBar(en){ const el=document.createElement('div'); el.className='ehp'+(en.boss?' boss':'');
  el.innerHTML='<i></i>'; el.style.display='none'; document.body.appendChild(el); en.bar=el; en.barFill=el.firstChild; }
function removeEnemyBar(en){ if(en.bar){ en.bar.remove(); en.bar=null; } }
const _v=new THREE.Vector3();
function updateEnemyBars(){ for(const en of enemies){ if(en.dead||!en.bar)continue;
  _v.copy(en.mesh.position); _v.y+=en.boss?5.2:2.1; _v.project(camera);
  if(_v.z>1||_v.z<-1){ en.bar.style.display='none'; continue; }
  const dist=en.mesh.position.distanceTo(camera.position);
  if(dist>(en.boss?80:24)){ en.bar.style.display='none'; continue; }
  en.bar.style.display='block';
  en.bar.style.left=(_v.x*0.5+0.5)*innerWidth+'px'; en.bar.style.top=(-_v.y*0.5+0.5)*innerHeight+'px';
  en.barFill.style.width=clamp(en.hp/en.hpMax*100,0,100)+'%'; } }

/* ---- підсвічування прицілу на ворогові ---- */
function updateCrosshair(){ const dir=lookDir(); let aim=false;
  for(const en of enemies){ if(en.dead)continue;
    const to=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.5:1,0)).sub(camera.position);
    if(to.length()<(en.boss?40:8)&&to.normalize().dot(dir)>0.985){ aim=true; break; } }
  document.getElementById('crosshair').classList.toggle('target',aim); }

/* ============================= ПРОКАЧКА ============================= */
function gainXP(n){ G.xp+=n;
  while(G.xp>=G.xpNext){ G.xp-=G.xpNext; G.level++; G.xpNext=Math.round(G.xpNext*1.4);
    G.hpMax+=20+PERK.vitality*25*0; G.mpMax+=10; G.spMax+=10; G.perks++;
    G.hp=G.hpMax; G.mp=G.mpMax; G.sp=G.spMax; Audio.level();
    toast('РІВЕНЬ '+G.level+'!'); subtitle('Ти отримав очко навичок (P)'); questProgress('level'); saveGame(); }
  updateHUD(); }
function applyPerk(id){ const def=PERK_DEF.find(d=>d.id===id); if(!def||G.perks<=0||PERK[id]>=def.max)return;
  PERK[id]++; G.perks--; Audio.gold();
  if(id==='vitality'){ G.hpMax+=25; G.hp+=25; }
  updateHUD(); renderSkills(); }

/* ============================= HUD ============================= */
function updateHUD(){
  document.getElementById('hpFill').style.width=clamp(G.hp/G.hpMax*100,0,100)+'%';
  document.getElementById('mpFill').style.width=clamp(G.mp/G.mpMax*100,0,100)+'%';
  document.getElementById('spFill').style.width=clamp(G.sp/G.spMax*100,0,100)+'%';
  document.getElementById('hpTxt').textContent=Math.ceil(G.hp)+'/'+G.hpMax;
  document.getElementById('lvlNum').textContent=G.level;
  document.getElementById('xpFill').style.width=(G.xp/G.xpNext*100)+'%';
  document.getElementById('goldNum').textContent=G.gold;
  document.getElementById('perkNum').textContent=G.perks;
}
function buildHotbar(){ const hb=document.getElementById('hotbar'); hb.innerHTML='';
  HOTBAR.forEach((it,i)=>{ const d=document.createElement('div'); d.className='slot'+(i===G.slot?' active':'');
    d.innerHTML=`<span class="nm">${it.name}</span>${it.icon}<small>${i+1}</small>`; hb.appendChild(d); }); }
function selectSlot(i){ G.slot=clamp(i,0,HOTBAR.length-1); buildHotbar(); }
let toastT; function toast(m){ const el=document.getElementById('toast'); el.textContent=m; el.style.opacity=1;
  clearTimeout(toastT); toastT=setTimeout(()=>el.style.opacity=0,1800); }
let subT; function subtitle(m){ const el=document.getElementById('subtitle'); el.textContent=m; el.style.opacity=1;
  clearTimeout(subT); subT=setTimeout(()=>el.style.opacity=0,2600); }
function damageFlash(){ const el=document.getElementById('dmgFlash'); el.style.opacity=1; setTimeout(()=>el.style.opacity=0,120); }
function shoutFlash(){ const el=document.getElementById('dmgFlash');
  el.style.background='radial-gradient(transparent 48%, rgba(80,140,220,.55))'; el.style.opacity=1;
  setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.style.background='radial-gradient(transparent 52%, rgba(150,0,0,.6))',220); },160); }

/* ============================= КВЕСТИ ============================= */
const QUESTS=[
  {id:'mine',text:'Видобути 12 блоків',need:12,prog:0,kind:'mine'},
  {id:'kill',text:'Знищити 6 ворогів',need:6,prog:0,kind:'kill'},
  {id:'build',text:'Поставити 5 блоків',need:5,prog:0,kind:'build'},
  {id:'level',text:'Досягти 3 рівня',need:3,prog:1,kind:'level'},
  {id:'boss',text:'Перемогти Стародавнього Дракона',need:1,prog:0,kind:'boss'},
];
function questProgress(kind){ for(const q of QUESTS){ if(q.kind!==kind||q.done)continue;
    if(kind==='level')q.prog=G.level; else q.prog++;
    if(q.prog>=q.need){ q.done=true; toast('Завдання виконано: '+q.text); gainXP(40); } }
  renderQuests(); if(QUESTS[3].done&&!G.dragonSpawned)subtitle('Іди до вівтаря у вежі (центр) і натисни E'); }
function renderQuests(){ const c=document.getElementById('questObjs'); c.innerHTML='';
  for(const q of QUESTS){ if(q.id==='boss'&&!G.dragonSpawned&&!QUESTS[3].done)continue;
    const d=document.createElement('div'); d.className='obj'+(q.done?' done':'');
    const cnt=q.kind==='boss'?'':' ('+Math.min(q.prog,q.need)+'/'+q.need+')';
    d.textContent=(q.done?'✓ ':'• ')+q.text+cnt; c.appendChild(d); } }

/* ============================= СКІЛИ / ПАУЗА ============================= */
function renderSkills(){ document.getElementById('perkAvail').textContent=G.perks;
  const grid=document.getElementById('perkGrid'); grid.innerHTML='';
  for(const def of PERK_DEF){ const lvl=PERK[def.id]; const maxed=lvl>=def.max;
    const d=document.createElement('div'); d.className='perk'+(maxed?' maxed':'');
    d.innerHTML=`<div class="pn">${def.name} ${'◆'.repeat(lvl)}${'◇'.repeat(def.max-lvl)}</div>
      <div class="pd">${def.desc}</div><div class="pl">Рівень ${lvl}/${def.max}${maxed?' — макс.':' · клік щоб вкласти'}</div>`;
    if(!maxed)d.onclick=()=>applyPerk(def.id); grid.appendChild(d); } }
let skillsOpen=false;
function toggleSkills(){ skillsOpen=!skillsOpen; const p=document.getElementById('skillsPanel');
  if(skillsOpen){ renderSkills(); p.classList.remove('hidden'); document.exitPointerLock(); }
  else { p.classList.add('hidden'); if(G.started&&!G.over)canvas.requestPointerLock(); } }
function togglePause(){ if(skillsOpen){toggleSkills();return;}
  G.paused=!G.paused; const p=document.getElementById('pauseMenu');
  if(G.paused){ p.classList.remove('hidden'); document.exitPointerLock(); } else { p.classList.add('hidden'); canvas.requestPointerLock(); } }

/* ============================= СПАВН ============================= */
let spawnTimer=3;
function maybeSpawn(dt){ spawnTimer-=dt; const alive=enemies.filter(e=>!e.dead&&!e.boss).length;
  if(spawnTimer<=0&&alive<7&&!G.dragonDead){ spawnTimer=rand(3,5);
    const a=Math.random()*TAU,d=rand(15,28),x=player.pos.x+Math.cos(a)*d,z=player.pos.z+Math.sin(a)*d;
    if(Math.abs(x)<WSIZE-2&&Math.abs(z)<WSIZE-2){
      const r=Math.random(); let type='bandit';
      if(G.level>=2&&r<0.35)type='draugr'; if(G.level>=3&&r<0.2)type='skeleton'; if(G.level>=4&&r<0.12)type='wraith';
      spawnEnemy(type,x,z); } } }

/* ============================= УРОН/СМЕРТЬ ============================= */
let playerSlow=0;
function hurtPlayer(a){ if(G.over)return; G.hp-=a; damageFlash(); Audio.hurt(); updateHUD(); if(G.hp<=0)die(); }
function die(){ G.over=true; document.exitPointerLock(); document.getElementById('deathPanel').classList.remove('hidden'); }
function victory(){ G.over=true; saveGame(); document.exitPointerLock(); document.getElementById('bossbar').style.display='none';
  const t=((performance.now()-G.startTime)/1000)|0;
  document.getElementById('winStats').textContent=`Рівень ${G.level} · Вбивств: ${G.kills} · Золота: ${G.gold} · Час: ${(t/60|0)}хв ${t%60}с`;
  document.getElementById('winPanel').classList.remove('hidden'); }

/* ============================= ОНОВЛЕННЯ ВОРОГІВ ============================= */
function updateEnemies(dt){ for(const en of enemies){ if(en.dead)continue;
  if(en.boss){ updateDragon(en,dt); flashUpdate(en); continue; }
  en.slowT=Math.max(0,en.slowT-dt); const sp=en.speed*(en.slowT>0?0.4:1);
  en.vel.y-=24*dt;
  const to=new THREE.Vector3(player.pos.x-en.mesh.position.x,0,player.pos.z-en.mesh.position.z); const dist=to.length();
  if(en.ranged){
    if(dist>10){ to.normalize(); en.vel.x=to.x*sp; en.vel.z=to.z*sp; en.anim+=dt*8; }
    else { en.vel.x*=0.7; en.vel.z*=0.7; en.atkCd-=dt;
      if(en.atkCd<=0){ en.atkCd=2; const dir=new THREE.Vector3(player.pos.x-en.mesh.position.x,(player.pos.y+1)-(en.mesh.position.y+1.4),player.pos.z-en.mesh.position.z).normalize();
        const o=en.mesh.position.clone().add(new THREE.Vector3(0,1.4,0));
        projectiles.push({pos:o,vel:dir.multiplyScalar(16),life:3,dmg:en.dmg,friendly:false,kind:'fire',mesh:makeOrb(o,0xaa66ff,0x330066)}); } }
    if(dist>0.1)en.mesh.rotation.y=Math.atan2(player.pos.x-en.mesh.position.x,player.pos.z-en.mesh.position.z);
  } else {
    if(dist>1.6){ to.normalize(); en.vel.x=to.x*sp; en.vel.z=to.z*sp; en.mesh.rotation.y=Math.atan2(to.x,to.z); en.anim+=dt*8; }
    else { en.vel.x=0; en.vel.z=0; en.atkCd-=dt;
      if(en.atkCd<=0){ en.atkCd=1.1; hurtPlayer(en.dmg); if(en.frost)playerSlow=1.5; en.anim+=2; } }
  }
  en.mesh.position.x+=en.vel.x*dt; en.mesh.position.z+=en.vel.z*dt; en.mesh.position.y+=en.vel.y*dt;
  const gy=surfaceY(Math.floor(en.mesh.position.x),Math.floor(en.mesh.position.z))+1;
  if(en.mesh.position.y<gy){ en.mesh.position.y=gy; en.vel.y=0; }
  const L=en.mesh.userData.limbs; if(L){ const s=Math.sin(en.anim)*0.6; L.la.rotation.x=s; L.ra.rotation.x=-s; L.ll.rotation.x=-s; L.rl.rotation.x=s; }
  flashUpdate(en);
} }
function flashUpdate(en){ const body=en.mesh.userData.body||en.mesh.children[0];
  if(!body||!body.material||!body.material.emissive)return;
  if(en.flash>0){ en.flash--; body.material.emissive.setHex(0x661111); } else body.material.emissive.setHex(0x000000); }

function updateDragon(d,dt){ d.timer-=dt; d.anim+=dt;
  const w=d.mesh.userData.wings; if(w){ const f=Math.sin(d.anim*6)*0.5; w.lw.rotation.z=f; w.rw.rotation.z=-f; }
  const toP=camera.position.clone().sub(d.mesh.position); const dist=toP.length();
  d.mesh.rotation.y=Math.atan2(toP.x,toP.z);
  if(d.state==='fly'){ d.orbitA+=dt*0.6; const r=18,cy=surfaceY(0,0)+15;
    const tx=Math.cos(d.orbitA)*r,tz=Math.sin(d.orbitA)*r;
    d.mesh.position.x+=(tx-d.mesh.position.x)*dt*0.9; d.mesh.position.z+=(tz-d.mesh.position.z)*dt*0.9; d.mesh.position.y+=(cy-d.mesh.position.y)*dt*0.9;
    d.atkCd-=dt; if(d.atkCd<=0){ d.atkCd=2.2; breathFire(d); }
    if(d.timer<=0){ d.state='swoop'; d.timer=3.2; subtitle('Дракон пікірує!'); }
  } else if(d.state==='swoop'){ const dir=toP.clone().normalize(); d.mesh.position.addScaledVector(dir,d.speed*dt*1.7);
    if(dist<3.5){ hurtPlayer(d.dmg); d.swoops++; nextDragonPhase(d); }
    if(d.timer<=0){ d.swoops++; nextDragonPhase(d); }
  } else { // 'land' — приземлений, вразливий
    const gx=clamp(player.pos.x+Math.cos(d.orbitA)*6,-WSIZE+2,WSIZE-2);
    const gz=clamp(player.pos.z+Math.sin(d.orbitA)*6,-WSIZE+2,WSIZE-2);
    const gy=surfaceY(Math.floor(gx),Math.floor(gz))+2;
    d.mesh.position.x+=(gx-d.mesh.position.x)*dt*2; d.mesh.position.z+=(gz-d.mesh.position.z)*dt*2;
    d.mesh.position.y+=(gy-d.mesh.position.y)*dt*3;
    d.atkCd-=dt; if(dist<5&&d.atkCd<=0){ d.atkCd=1.4; hurtPlayer(d.dmg*0.8); }
    if(d.timer<=0){ d.state='fly'; d.timer=4.5; subtitle('Дракон знову злітає!'); Audio.roar(); }
  }
}
function nextDragonPhase(d){
  if(d.swoops>=2){ d.swoops=0; d.state='land'; d.timer=4.5; d.orbitA=Math.random()*TAU;
    subtitle('Дракон приземлився — атакуй його!'); Audio.roar(); }
  else { d.state='fly'; d.timer=4; }
}
function breathFire(d){ const dir=camera.position.clone().sub(d.mesh.position).normalize();
  const o=d.mesh.position.clone().add(dir.clone().multiplyScalar(3)); Audio.fire();
  for(let i=0;i<4;i++){ const s=dir.clone().add(new THREE.Vector3(rand(-.12,.12),rand(-.12,.12),rand(-.12,.12))).normalize();
    projectiles.push({pos:o.clone(),vel:s.multiplyScalar(22),life:2.4,dmg:14,friendly:false,kind:'fire',mesh:makeOrb(o,0xff3311,0x551100)}); }
  subtitle('Алдуїн: «Yol Toor Shul!»'); }

/* ============================= EXTRAS ============================= */
function updateExtras(dt){
  for(const pa of particles){ if(pa.dead)continue; pa.life-=dt; if(pa.grav)pa.vel.y-=18*dt;
    pa.mesh.position.addScaledVector(pa.vel,dt); pa.mesh.scale.setScalar(clamp(pa.life/0.5,0,1));
    if(pa.life<=0){ pa.dead=true; scene.remove(pa.mesh); } }
  for(const p of pickups){ if(p.dead)continue; p.spin+=dt*3; p.mesh.rotation.y=p.spin;
    if(p.mesh.position.distanceTo(camera.position)<1.9)collectPickup(p); }
  for(const f of floaters){ if(f.dead)continue; f.life-=dt; f.pos.y+=dt*1.2;
    const v=f.pos.clone().project(camera);
    if(v.z>1){ f.el.style.display='none'; } else { f.el.style.display='block';
      f.el.style.left=(v.x*0.5+0.5)*innerWidth+'px'; f.el.style.top=(-v.y*0.5+0.5)*innerHeight+'px'; f.el.style.opacity=clamp(f.life,0,1); }
    if(f.life<=0){ f.dead=true; f.el.remove(); } }
}
function cleanup(){ for(const a of [enemies,projectiles,particles,pickups,floaters]) for(let i=a.length-1;i>=0;i--) if(a[i].dead)a.splice(i,1); }

/* ============================= КОМПАС / ЧАС ============================= */
const DIRS=['Пн','ПнСх','Сх','ПдСх','Пд','ПдЗх','Зх','ПнЗх'];
function updateCompass(){ let a=((-player.yaw)%TAU+TAU)%TAU; const idx=Math.round(a/(TAU/8))%8;
  document.getElementById('compassDir').textContent=DIRS[idx]; }

/* ---- мінікарта ---- */
const mmCanvas=document.getElementById('minimapCanvas'), mmCtx=mmCanvas.getContext('2d');
const MM_R=80, MM_RANGE=60;        // піксельний радіус / світовий радіус
function dot(wx,wz,col,size){
  const dx=wx-player.pos.x, dz=wz-player.pos.z;
  // повертаємо так, щоб напрямок гравця був угорі
  const ca=Math.cos(player.yaw), sa=Math.sin(player.yaw);
  let rx=dx*ca - dz*sa, rz=dx*sa + dz*ca;
  const sc=MM_R/MM_RANGE; let px=MM_R+rx*sc, py=MM_R+rz*sc;
  if(Math.hypot(px-MM_R,py-MM_R)>MM_R-3) return;   // поза колом
  mmCtx.fillStyle=col; mmCtx.beginPath(); mmCtx.arc(px,py,size||3,0,TAU); mmCtx.fill();
}
function drawMinimap(){
  mmCtx.clearRect(0,0,160,160);
  // сітка-фон
  mmCtx.fillStyle='rgba(40,60,40,.25)'; mmCtx.beginPath(); mmCtx.arc(MM_R,MM_R,MM_R-2,0,TAU); mmCtx.fill();
  dot(0,0,'#e8c66a',4);                                   // вівтар (центр світу)
  for(const c of chests){ if(!c.taken)dot(c.mesh.position.x,c.mesh.position.z,'#caa24a',3); }
  for(const en of enemies){ if(en.dead)continue;
    dot(en.mesh.position.x,en.mesh.position.z,en.boss?'#ff7a3a':'#e0594b',en.boss?6:3); }
  // гравець (стрілка вгору)
  mmCtx.fillStyle='#9ec4e8'; mmCtx.beginPath(); mmCtx.moveTo(MM_R,MM_R-6); mmCtx.lineTo(MM_R-4,MM_R+5); mmCtx.lineTo(MM_R+4,MM_R+5); mmCtx.closePath(); mmCtx.fill();
}

function updateDayNight(dt){
  G.time=(G.time+dt/120)%1;                       // повний цикл ~2 хв
  const ang=G.time*TAU;                            // 0=схід
  const sx=Math.cos(ang), sy=Math.sin(ang);
  sun.position.set(player.pos.x+sx*80, sy*90, player.pos.z+40);
  sun.target.position.copy(player.pos); sun.target.updateMatrixWorld();
  moon.position.set(player.pos.x-sx*120,-sy*120+player.pos.y, player.pos.z-30);
  const day=clamp(sy,0,1);                          // 0 ніч .. 1 полудень
  sun.intensity=lerp(0.05,1.15,day);
  hemi.intensity=lerp(0.18,0.7,day);
  ambient.intensity=lerp(0.08,0.2,day);
  moonLight.intensity=lerp(0.35,0,day);
  moonLight.position.copy(moon.position);
  lantern.intensity=lerp(1.7,0,clamp(day*1.5,0,1));
  lantern.position.copy(camera.position);
  // нічні іскри-світлячки
  if(day<0.2&&Math.random()<0.25){ const a=Math.random()*TAU,r=rand(3,12);
    const m=makeGlow(0xffcc66,0.4); m.position.set(player.pos.x+Math.cos(a)*r,player.pos.y+rand(0.5,3),player.pos.z+Math.sin(a)*r);
    scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-.2,.2),rand(.2,.6),rand(-.2,.2)),life:rand(1.2,2.2),grav:false}); }
  // кольори
  const dayTop=new THREE.Color(0x2a6bb0), nightTop=new THREE.Color(0x05080f);
  const dayBot=new THREE.Color(0xcfe6ff), nightBot=new THREE.Color(0x101826);
  const duskBot=new THREE.Color(0xe89a5a);
  const dusk=clamp(1-Math.abs(sy)*3,0,1)*clamp(sy+0.4,0,1);
  skyUniforms.top.value.copy(nightTop).lerp(dayTop,day);
  skyUniforms.bottom.value.copy(nightBot).lerp(dayBot,day).lerp(duskBot,dusk*0.6);
  skyUniforms.sunDir.value.set(sx,sy,0.3).normalize();
  skyUniforms.sunColor.value.setHex(0xfff2d6).lerp(new THREE.Color(0xff8a4a),dusk);
  scene.fog.color.copy(skyUniforms.bottom.value);
  stars.material.opacity=clamp(1-day*2.2,0,1);
  // годинник UI
  const hour=Math.floor(((G.time*24)+6)%24);
  document.getElementById('clockTxt').textContent=(day>0.15?'☀️ День ':'🌙 Ніч ')+(hour<10?'0':'')+hour+':00';
  document.getElementById('clock').firstChild.textContent='';
}

/* ============================= ХОДЬБА / КАМЕРА ============================= */
let walkPhase=0, saveAccum=0;
function update(dt){
  // реген
  G.sp=clamp(G.sp+18*dt,0,G.spMax); G.mp=clamp(G.mp+8*dt,0,G.mpMax);
  if(G.hp<G.hpMax)G.hp=clamp(G.hp+2.0*dt,0,G.hpMax);
  playerSlow=Math.max(0,playerSlow-dt);

  const running=(keys['ShiftLeft']||keys['ShiftRight'])&&G.sp>1;
  let speed=(running?7.2:4.6)*(1+0.12*PERK.swift)*(playerSlow>0?0.5:1);
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const mv=new THREE.Vector3();
  if(keys['KeyW'])mv.add(fwd); if(keys['KeyS'])mv.sub(fwd); if(keys['KeyD'])mv.add(right); if(keys['KeyA'])mv.sub(right);
  const moving=mv.lengthSq()>0;
  if(moving)mv.normalize().multiplyScalar(speed);
  player.vel.x=mv.x; player.vel.z=mv.z;
  if(running&&moving)G.sp=clamp(G.sp-8*dt,0,G.spMax);
  if(moving)walkPhase+=dt*(running?14:9);

  player.vel.y-=26*dt;
  if(keys['Space']&&player.onGround){ player.vel.y=8.6; player.onGround=false; }
  player.onGround=false;
  tryMove('x',player.vel.x*dt); tryMove('z',player.vel.z*dt); tryMove('y',player.vel.y*dt);
  player.pos.x=clamp(player.pos.x,-WSIZE+1,WSIZE-1); player.pos.z=clamp(player.pos.z,-WSIZE+1,WSIZE-1);
  if(player.pos.y<-12)hurtPlayer(999);

  // камера + headbob
  const bob=moving?Math.sin(walkPhase)*0.05:0;
  camera.position.set(player.pos.x,player.pos.y+player.height+bob,player.pos.z);
  camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);

  maybeSpawn(dt); updateEnemies(dt); updateProjectiles(dt); updateExtras(dt); cleanup();
  updateCompass(); updateDayNight(dt); drawMinimap(); updateEnemyBars(); updateCrosshair();
  for(const c of clouds){ c.position.x+=dt*1.2; if(c.position.x>180)c.position.x=-180; }
  // анімація води
  const wm=instMeshes[7]; if(wm)wm.material.forEach(mt=>{ if(mt.map){ mt.map.offset.x+=dt*0.04; mt.map.offset.y+=dt*0.025; } });

  if(swordSwing>0)swordSwing=Math.max(0,swordSwing-dt*4);
  updateViewmodel(dt);

  saveAccum+=dt; if(saveAccum>10){ saveAccum=0; saveGame(); }   // автозбереження

  const cd=G.shoutReady-performance.now();
  document.getElementById('shoutCd').textContent=cd>0?`Крик: ${(cd/1000).toFixed(1)}с`:'Крик готовий (Q)';
  updateHUD();
}

/* ============================= ЦИКЛ ============================= */
let last=0;
function loop(now){ requestAnimationFrame(loop);
  const dt=Math.min((now-last)/1000||0,0.05); last=now;
  if(G.started&&!G.over&&!G.paused&&!skillsOpen)update(dt);
  renderer.render(scene,camera);
  // viewmodel поверх
  renderer.autoClear=false; renderer.clearDepth();
  if(G.started&&!G.over)renderer.render(vmScene,vmCam);
  renderer.autoClear=true;
}

/* ============================= РЕСАЙЗ ============================= */
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  vmCam.aspect=innerWidth/innerHeight; vmCam.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

/* ============================= СТАРТ ============================= */
function resetRun(){
  for(const en of enemies)removeEnemyBar(en);
  for(const a of [enemies,projectiles,particles,pickups]) for(const o of a) if(o.mesh)scene.remove(o.mesh);
  for(const f of floaters)f.el.remove();
  enemies.length=projectiles.length=particles.length=pickups.length=floaters.length=0; dragon=null;
  Object.assign(G,{started:true,over:false,paused:false,hp:100,hpMax:100,mp:100,mpMax:100,sp:100,spMax:100,
    level:1,xp:0,xpNext:100,gold:0,perks:0,slot:0,shoutReady:0,kills:0,blocksMined:0,blocksPlaced:0,
    dragonSpawned:false,dragonDead:false,startTime:performance.now(),time:0.28});
  for(const k in PERK)PERK[k]=0;
  QUESTS.forEach(q=>{q.done=false;q.prog=q.kind==='level'?1:0;});
  const sy=surfaceY(0,8)+2; player.pos.set(0,sy,8); player.vel.set(0,0,0); player.yaw=Math.PI; player.pitch=0;
  playerSlow=0; spawnTimer=3; saveAccum=0;
  document.getElementById('bossbar').style.display='none';
  buildHotbar(); renderQuests(); updateHUD();
  spawnEnemy('bandit',10,0); spawnEnemy('draugr',-8,6);
}
function applySave(sv){
  G.level=sv.level; G.xp=sv.xp; G.xpNext=sv.xpNext; G.gold=sv.gold; G.perks=sv.perks;
  G.hpMax=sv.hpMax; G.mpMax=sv.mpMax; G.spMax=sv.spMax; G.kills=sv.kills||0; G.dragonDead=!!sv.dragonDead;
  Object.assign(PERK,sv.perkLevels||{}); G.hp=G.hpMax; G.mp=G.mpMax; G.sp=G.spMax;
  buildHotbar(); renderQuests(); updateHUD();
}
function beginPlay(){ if(Audio.ctx&&Audio.ctx.state==='suspended')Audio.ctx.resume();
  ['startMenu','deathPanel','winPanel','pauseMenu','skillsPanel','settingsPanel'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  skillsOpen=false; settingsFrom='menu'; canvas.requestPointerLock(); }
function newGame(){ Audio.init(); regenerateWorld((Math.random()*1e9)|0); resetRun(); beginPlay();
  saveGame(); toast('Прокинься, Довакіне!'); subtitle('Видобувай, будуй, бийся. Поклич дракона біля вежі.'); }
function continueGame(){ Audio.init(); const sv=loadSave(); if(!sv){newGame();return;}
  resetRun(); applySave(sv); beginPlay();
  toast('З поверненням, Довакіне!'); subtitle('Твоя пригода триває.'); }
function respawn(){ resetRun(); beginPlay(); toast('Відродження'); }
function quitToMenu(){ G.started=false; G.over=false; G.paused=false;
  document.getElementById('pauseMenu').classList.add('hidden');
  document.getElementById('continueBtn').style.display=hasSave()?'block':'none';
  document.getElementById('startMenu').classList.remove('hidden'); document.exitPointerLock(); }

/* ---- меню налаштувань ---- */
let settingsFrom='menu';
function applyAllSettings(){ if(Audio.master)Audio.master.gain.value=Settings.vol;
  camera.fov=Settings.fov; camera.updateProjectionMatrix();
  scene.fog.near=Settings.view*0.35; scene.fog.far=Settings.view; }
function syncSettingsUI(){
  setSens.value=Settings.sens; setVol.value=Settings.vol; setFov.value=Settings.fov; setView.value=Settings.view;
  setSensV.textContent=Settings.sens.toFixed(1); setVolV.textContent=Math.round(Settings.vol*100)+'%';
  setFovV.textContent=Settings.fov; setViewV.textContent=Settings.view; }
function openSettings(){ settingsFrom=G.paused?'pause':'menu'; syncSettingsUI();
  document.getElementById('settingsPanel').classList.remove('hidden'); }
function closeSettings(){ document.getElementById('settingsPanel').classList.add('hidden'); saveSettings(); }
const setSens=document.getElementById('setSens'),setVol=document.getElementById('setVol'),
      setFov=document.getElementById('setFov'),setView=document.getElementById('setView'),
      setSensV=document.getElementById('setSensV'),setVolV=document.getElementById('setVolV'),
      setFovV=document.getElementById('setFovV'),setViewV=document.getElementById('setViewV');
setSens.oninput=()=>{ Settings.sens=+setSens.value; syncSettingsUI(); };
setVol.oninput=()=>{ Settings.vol=+setVol.value; applyAllSettings(); syncSettingsUI(); };
setFov.oninput=()=>{ Settings.fov=+setFov.value; applyAllSettings(); syncSettingsUI(); };
setView.oninput=()=>{ Settings.view=+setView.value; applyAllSettings(); syncSettingsUI(); };

document.getElementById('startBtn').onclick=newGame;
document.getElementById('continueBtn').onclick=continueGame;
document.getElementById('respawnBtn').onclick=respawn;
document.getElementById('winBtn').onclick=newGame;
document.getElementById('resumeBtn').onclick=togglePause;
document.getElementById('quitBtn').onclick=quitToMenu;
document.getElementById('closeSkills').onclick=toggleSkills;
document.getElementById('settingsBtn').onclick=openSettings;
document.getElementById('closeSettings').onclick=closeSettings;

/* ============================= ІНІЦІАЛІЗАЦІЯ ============================= */
function init(){
  buildInstancedMeshes(); applyAllSettings();
  document.getElementById('loadFill').style.width='30%';
  setTimeout(()=>{
    const sv=loadSave(); const seed=sv?sv.seed:((Math.random()*1e9)|0);
    G.seed=seed; RNG=mulberry32(seed); generateWorld(()=>{});
    document.getElementById('loadFill').style.width='80%';
    buildViewmodel(); buildHotbar(); renderQuests();
    document.getElementById('continueBtn').style.display=sv?'block':'none';
    document.getElementById('loadFill').style.width='100%';
    setTimeout(()=>document.getElementById('loadingOverlay').classList.add('hidden'),250);
    requestAnimationFrame(loop);
  },40);
}
setTimeout(init,60);

})();
