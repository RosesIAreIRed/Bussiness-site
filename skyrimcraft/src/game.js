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
  dragonSpawned:false,dragonDead:false,startTime:0,time:0.28,seed:12345,
  weapon:'iron_sword',armorItem:null,hasBow:false,defense:0,
  food:100,foodMax:100,onFire:0,weather:'clear',weatherT:20};
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
  {name:'Зброя', icon:'⚔️',type:'weapon'},
  {name:'Камінь',icon:'🧱',type:'block',block:3,res:'stone'},
  {name:'Земля', icon:'🟫',type:'block',block:1,res:'dirt'},
  {name:'Дерево',icon:'🪵',type:'block',block:5,res:'wood'},
  {name:'Факел', icon:'🔥',type:'block',block:8,res:'torch'},
  {name:'Зілля', icon:'🧪',type:'potion'},
];

/* ============================= ПРЕДМЕТИ / ІНВЕНТАР ============================= */
const ITEMS={
  wood:{n:'Деревина',i:'🪵'}, plank:{n:'Дошки',i:'🟫'}, stick:{n:'Палиця',i:'🥢'},
  stone:{n:'Камінь',i:'🪨'}, dirt:{n:'Земля',i:'🟫'}, sand:{n:'Пісок',i:'🟨'}, snow:{n:'Сніг',i:'❄️'},
  coal:{n:'Вугілля',i:'⚫'}, iron:{n:'Залізо',i:'🔩'}, goldore:{n:'Золота руда',i:'🟡'}, gem:{n:'Самоцвіт',i:'💎'},
  leaves:{n:'Листя',i:'🍃'}, fiber:{n:'Волокно',i:'🌾'}, flower:{n:'Квіти',i:'🌸'}, mushroom:{n:'Гриб',i:'🍄'},
  meat:{n:'Сире м\'ясо',i:'🥩'}, cookedmeat:{n:'Печеня',i:'🍖'}, hide:{n:'Шкура',i:'🟤'}, feather:{n:'Перо',i:'🪶'}, bone:{n:'Кістка',i:'🦴'},
  glass:{n:'Скло',i:'🪟'}, brick:{n:'Цегла',i:'🧱'}, torch:{n:'Факел',i:'🔥'},
  arrow:{n:'Стріли',i:'➶'}, health_potion:{n:'Зілля',i:'🧪'},
  obsidian:{n:'Обсидіан',i:'🟪'}, glowstone:{n:'Світлокамінь',i:'💡'}, clay:{n:'Глина',i:'🟫'}, ice:{n:'Лід',i:'🧊'}, ash:{n:'Попіл',i:'🌫️'},
  mana_potion:{n:'Зілля мани',i:'🔮'},
  obsidian_sword:{n:'Обсидіановий меч',i:'🗡️',weapon:90},
  obsidian_armor:{n:'Обсидіанова броня',i:'🛡️',armor:0.60},
  wood_sword:{n:'Дерев\'яний меч',i:'🗡️',weapon:18},
  stone_sword:{n:'Кам\'яний меч',i:'⚔️',weapon:30},
  iron_sword:{n:'Залізний меч',i:'⚔️',weapon:44},
  gem_sword:{n:'Самоцвітний меч',i:'🔪',weapon:64},
  war_axe:{n:'Бойова сокира',i:'🪓',weapon:82},
  bow:{n:'Лук',i:'🏹',bow:true},
  leather_armor:{n:'Шкіряна броня',i:'🦺',armor:0.18},
  iron_armor:{n:'Залізна броня',i:'🛡️',armor:0.35},
  gem_armor:{n:'Самоцвітна броня',i:'🛡️',armor:0.50},
};
const INV={};
function addItem(id,n){ INV[id]=(INV[id]||0)+(n||1); }
function itemCount(id){ return INV[id]||0; }
function hasItems(req){ for(const k in req)if((INV[k]||0)<req[k])return false; return true; }
function takeItems(req){ for(const k in req)INV[k]=(INV[k]||0)-req[k]; }

// що випадає з блоку при видобутку
const DROP={1:'dirt',3:'stone',4:'sand',5:'wood',6:'leaves',9:'snow',
  11:'coal',12:'iron',13:'goldore',14:'gem',15:'plank',16:'fiber',17:'flower',18:'glass',19:'brick',
  21:'wood',22:'leaves',23:'wood',24:'leaves',
  26:'obsidian',27:'stone',28:'dirt',29:'ice',30:'glowstone',31:'stone',32:'clay'};

/* ---- рецепти крафту ---- */
const RECIPES=[
  {out:'plank',n:4,req:{wood:1}},
  {out:'stick',n:4,req:{plank:2}},
  {out:'torch',n:4,req:{stick:1,coal:1}},
  {out:'glass',n:2,req:{sand:2}},
  {out:'brick',n:2,req:{stone:3}},
  {out:'cookedmeat',n:1,req:{meat:1,coal:1}},
  {out:'health_potion',n:1,req:{mushroom:2,flower:1}},
  {out:'arrow',n:6,req:{stick:1,feather:1,coal:1}},
  {out:'wood_sword',n:1,req:{plank:2,stick:1},gear:true},
  {out:'stone_sword',n:1,req:{stone:3,stick:1},gear:true},
  {out:'iron_sword',n:1,req:{iron:3,stick:1},gear:true},
  {out:'gem_sword',n:1,req:{gem:2,iron:2,stick:1},gear:true},
  {out:'war_axe',n:1,req:{iron:4,stick:2},gear:true},
  {out:'bow',n:1,req:{stick:3,fiber:3},gear:true},
  {out:'leather_armor',n:1,req:{hide:5},gear:true},
  {out:'iron_armor',n:1,req:{iron:6,hide:2},gear:true},
  {out:'gem_armor',n:1,req:{gem:3,iron:3},gear:true},
  {out:'obsidian_sword',n:1,req:{obsidian:3,gem:1,stick:1},gear:true},
  {out:'obsidian_armor',n:1,req:{obsidian:6,iron:2},gear:true},
  {out:'mana_potion',n:1,req:{glowstone:1,flower:1},potion:'mana'},
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
  dragonDead:G.dragonDead,perkLevels:{...PERK},
  inv:{...INV},weapon:G.weapon,armorItem:G.armorItem,hasBow:G.hasBow,defense:G.defense,
  food:G.food,foodMax:G.foodMax})); }catch(e){} }
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

/* ---- постпроцесинг: bloom ---- */
let composer=null, bloomPass=null, fxaaPass=null;
function setupComposer(){
  if(typeof THREE.EffectComposer!=='function'||typeof THREE.UnrealBloomPass!=='function'){ console.warn('Bloom недоступний'); return; }
  composer=new THREE.EffectComposer(renderer);
  const rp=new THREE.RenderPass(scene,camera); composer.addPass(rp);
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.55,0.5,0.84);
  bloomPass.renderToScreen=true; composer.addPass(bloomPass);
  composer.setSize(innerWidth,innerHeight);
}
function resizeFXAA(){ if(!fxaaPass)return; const pr=renderer.getPixelRatio();
  fxaaPass.material.uniforms.resolution.value.set(1/(innerWidth*pr),1/(innerHeight*pr)); }

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
function noiseTex(base,spread,size,noBevel){
  size=size||32; const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const b=new THREE.Color(base);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let n=(Math.random()-0.5)*spread;
    if(!noBevel){ const e=3;                       // фаска для об'ємного вигляду
      if(x<e||y<e)n+=0.07; if(x>=size-e||y>=size-e)n-=0.07; }
    const col=new THREE.Color(clamp(b.r+n,0,1),clamp(b.g+n,0,1),clamp(b.b+n,0,1));
    px(ctx,x,y,'#'+col.getHexString());
  }
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.LinearMipmapLinearFilter;
  t.anisotropy=4; t.generateMipmaps=true; t.encoding=THREE.sRGBEncoding;
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
  const mk=tex=>{ const m=new THREE.MeshStandardMaterial({map:tex,roughness:opts.rough!=null?opts.rough:0.92,metalness:opts.metal||0});
    if(opts.emissive){ m.emissive=new THREE.Color(opts.emissive); m.emissiveIntensity=opts.ei||0.8; m.emissiveMap=tex; }
    if(opts.transparent){ m.transparent=true; m.opacity=opts.opacity||0.75; }
    return m; };
  const s=mk(side),tp=mk(top),bt=mk(bottom);
  // порядок груп BoxGeometry: +x,-x,+y(top),-y(bottom),+z,-z
  return [s,s,tp,bt,s,s];
}

function texFinish(c){ const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.encoding=THREE.sRGBEncoding; return t; }
// руда: кам'яна основа + вкраплення мінералу
function oreTex(spec){ const s=16,c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const b=new THREE.Color(0x8f8f8f);
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){ const n=(Math.random()-0.5)*0.12;
    px(ctx,x,y,'#'+new THREE.Color(clamp(b.r+n,0,1),clamp(b.g+n,0,1),clamp(b.b+n,0,1)).getHexString()); }
  const sc=new THREE.Color(spec);
  for(let i=0;i<14;i++){ const x=randi(1,14),y=randi(1,14),n=(Math.random()-0.5)*0.15;
    px(ctx,x,y,'#'+new THREE.Color(clamp(sc.r+n,0,1),clamp(sc.g+n,0,1),clamp(sc.b+n,0,1)).getHexString());
    if(Math.random()<0.5)px(ctx,x+1,y,'#'+sc.getHexString()); }
  return texFinish(c); }
function plankTex(){ const s=16,c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){ const n=(Math.random()-0.5)*0.08; const dark=(y%5===0)?-0.12:0;
    px(ctx,x,y,'#'+new THREE.Color(clamp(0.62+n+dark,0,1),clamp(0.46+n+dark,0,1),clamp(0.28+n+dark,0,1)).getHexString()); }
  return texFinish(c); }
function brickTex(){ const s=16,c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  ctx.fillStyle='#7a3a2a'; ctx.fillRect(0,0,s,s); ctx.fillStyle='#9a9a9a';
  for(let y=0;y<s;y+=4){ ctx.fillRect(0,y,s,1); const off=(y/4)%2?2:0; for(let x=off;x<s;x+=8)ctx.fillRect(x,y,1,4); }
  return texFinish(c); }
function logTopTex(base){ const s=16,c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const b=new THREE.Color(base); for(let y=0;y<s;y++)for(let x=0;x<s;x++){ const d=Math.hypot(x-8,y-8);
    const ring=Math.sin(d*1.6)*0.06,n=(Math.random()-0.5)*0.05;
    px(ctx,x,y,'#'+new THREE.Color(clamp(b.r+ring+n,0,1),clamp(b.g+ring+n,0,1),clamp(b.b+ring+n,0,1)).getHexString()); }
  return texFinish(c); }

const BLOCKS={
  1:{name:'трава', mats:()=>faceMats(noiseTex(0x7a5a32,0.1),grassTopTex(),noiseTex(0x6e5630,0.08))},
  2:{name:'каменина',mats:()=>faceMats(noiseTex(0x7c7c7c,0.1),noiseTex(0x8a8a8a,0.1),noiseTex(0x6e6e6e,0.1))},
  3:{name:'камінь', mats:()=>faceMats(noiseTex(0x888888,0.12),noiseTex(0x9a9a9a,0.12),noiseTex(0x777777,0.12))},
  4:{name:'пісок',  mats:()=>faceMats(noiseTex(0xd6c98f,0.07),noiseTex(0xded3a0,0.07),noiseTex(0xc9bc80,0.07))},
  5:{name:'дуб',    mats:()=>faceMats(noiseTex(0x7a5d36,0.09),logTopTex(0x9a7b4f),noiseTex(0x6a4f2c,0.07))},
  6:{name:'листя',  mats:()=>faceMats(noiseTex(0x376e2d,0.13),noiseTex(0x3f7d34,0.13),noiseTex(0x2f5f27,0.13))},
  7:{name:'вода',   mats:()=>faceMats(noiseTex(0x2f6fb0,0.05,32,true),noiseTex(0x357ec0,0.05,32,true),noiseTex(0x255f9a,0.05,32,true),{transparent:true,opacity:0.8,rough:0.08,metal:0.25})},
  8:{name:'факел',  mats:()=>faceMats(noiseTex(0xffb23a,0.1),noiseTex(0xffcf5a,0.1),noiseTex(0xff9a2a,0.1),{emissive:0xffaa33,ei:1.2})},
  9:{name:'сніг',   mats:()=>faceMats(noiseTex(0xdfe8f2,0.05),noiseTex(0xeef4fb,0.05),noiseTex(0xd0dbe8,0.05))},
  11:{name:'вугільна руда',mats:()=>{const t=oreTex(0x2a2a2a);return faceMats(t,t,t);}},
  12:{name:'залізна руда', mats:()=>{const t=oreTex(0xc89878);return faceMats(t,t,t);}},
  13:{name:'золота руда',  mats:()=>{const t=oreTex(0xe8c24a);return faceMats(t,t,t);}},
  14:{name:'самоцвітна руда',mats:()=>{const t=oreTex(0x4fd0e0);return faceMats(t,t,t,{emissive:0x1a4a55,ei:0.4});}},
  15:{name:'дошки', mats:()=>{const t=plankTex();return faceMats(t,t,t);}},
  16:{name:'кактус',mats:()=>faceMats(noiseTex(0x3f8a4a,0.08),noiseTex(0x4f9a5a,0.08),noiseTex(0x357a40,0.08))},
  18:{name:'скло',  mats:()=>faceMats(noiseTex(0xbfe6f0,0.03),noiseTex(0xcfeefa,0.03),noiseTex(0xbfe6f0,0.03),{transparent:true,opacity:0.45,rough:0.05})},
  19:{name:'цегла', mats:()=>{const t=brickTex();return faceMats(t,t,t);}},
  21:{name:'сосна', mats:()=>faceMats(noiseTex(0x5a4630,0.08),logTopTex(0x6a5638),noiseTex(0x4a3826,0.07))},
  22:{name:'хвоя',  mats:()=>faceMats(noiseTex(0x244f33,0.1),noiseTex(0x2a5a3a,0.1),noiseTex(0x1e4530,0.1))},
  23:{name:'береза',mats:()=>faceMats(noiseTex(0xe6e2d8,0.06),logTopTex(0xd8cdb0),noiseTex(0xd0ccc0,0.06))},
  24:{name:'березове листя',mats:()=>faceMats(noiseTex(0x6a9a3a,0.12),noiseTex(0x7aac46,0.12),noiseTex(0x5e8a33,0.12))},
  25:{name:'лава',  mats:()=>faceMats(noiseTex(0xff5a1a,0.18),noiseTex(0xff7a2a,0.2),noiseTex(0xd83a10,0.18),{emissive:0xff5a1a,ei:1.6})},
  26:{name:'обсидіан',mats:()=>faceMats(noiseTex(0x241f30,0.06),noiseTex(0x2c2640,0.06),noiseTex(0x1c1828,0.06),{rough:0.25,emissive:0x140a22,ei:0.3})},
  27:{name:'базальт',mats:()=>faceMats(noiseTex(0x3a3a40,0.08),noiseTex(0x44444a,0.08),noiseTex(0x303036,0.08))},
  28:{name:'багно', mats:()=>faceMats(noiseTex(0x4a3a2a,0.08),noiseTex(0x52422e,0.08),noiseTex(0x40321f,0.08))},
  29:{name:'лід',   mats:()=>faceMats(noiseTex(0xaad6f0,0.05),noiseTex(0xc0e4fa,0.05),noiseTex(0x9ac8e8,0.05),{transparent:true,opacity:0.78,rough:0.05})},
  30:{name:'світлокамінь',mats:()=>faceMats(noiseTex(0xffe07a,0.1),noiseTex(0xffe88a,0.1),noiseTex(0xf0c85a,0.1),{emissive:0xffd24a,ei:1.4})},
  31:{name:'мох-камінь',mats:()=>faceMats(noiseTex(0x6a7a4a,0.12),noiseTex(0x5a6a3a,0.12),noiseTex(0x7a7a72,0.1))},
  32:{name:'глина', mats:()=>faceMats(noiseTex(0x9a8a7a,0.05),noiseTex(0xa49484,0.05),noiseTex(0x8a7a6a,0.05))},
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
  for(let i=0;i<d.list.length;i++){ const p=d.list[i];
    _m.makeTranslation(p[0]+0.5,p[1]+0.5,p[2]+0.5); im.setMatrixAt(i,_m); }
  im.count=d.list.length; im.instanceMatrix.needsUpdate=true; }
function addBlock(x,y,z,t,defer){ const k=key(x,y,z); if(WORLD.has(k))return;
  WORLD.set(k,t); const d=instData[t]; d.map.set(k,d.list.length); d.list.push([x,y,z]); if(!defer)refreshInstance(t); }
function removeBlock(x,y,z){ const k=key(x,y,z); const t=WORLD.get(k); if(!t)return 0;
  WORLD.delete(k); const d=instData[t]; const idx=d.map.get(k); const last=d.list.length-1;
  if(idx!==last){ const mv=d.list[last]; d.list[idx]=mv; d.map.set(key(mv[0],mv[1],mv[2]),idx); }
  d.list.pop(); d.map.delete(k); refreshInstance(t); return t; }

/* ============================= ФЛОРА (хрест-спрайти) ============================= */
function plantTexBase(){ const c=document.createElement('canvas'); c.width=c.height=16; return c; }
function plantTexFinish(c){ const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.encoding=THREE.sRGBEncoding; return t; }
function flowerTex(petal){ const c=plantTexBase(),ctx=c.getContext('2d');
  ctx.fillStyle='#3f8a3a'; for(let y=8;y<16;y++)ctx.fillRect(7,y,2,1);
  ctx.fillStyle=petal; ctx.fillRect(6,4,4,4); ctx.fillRect(5,5,6,2); ctx.fillStyle='#ffe34a'; ctx.fillRect(7,5,2,2);
  return plantTexFinish(c); }
function grassPlantTex(){ const c=plantTexBase(),ctx=c.getContext('2d');
  for(let i=0;i<7;i++){ const x=randi(2,13); ctx.fillStyle=Math.random()<0.5?'#4f9a3a':'#5fae44'; for(let y=randi(6,10);y<16;y++)ctx.fillRect(x,y,1,1); }
  return plantTexFinish(c); }
function mushroomTex(){ const c=plantTexBase(),ctx=c.getContext('2d');
  ctx.fillStyle='#e8e0d0'; ctx.fillRect(7,9,2,6); ctx.fillStyle='#c0392b'; ctx.fillRect(5,5,6,4); ctx.fillRect(6,4,4,1);
  ctx.fillStyle='#fff'; ctx.fillRect(6,6,1,1); ctx.fillRect(9,7,1,1); return plantTexFinish(c); }
function deadbushTex(){ const c=plantTexBase(),ctx=c.getContext('2d'); ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=1;
  for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(8,15); ctx.lineTo(randi(3,13),randi(5,11)); ctx.stroke(); } return plantTexFinish(c); }

const PLANT_DEF={
  flower_red:{tex:()=>flowerTex('#d23b3b'),drop:'flower',h:0.7},
  flower_yellow:{tex:()=>flowerTex('#e8c24a'),drop:'flower',h:0.7},
  tall_grass:{tex:()=>grassPlantTex(),drop:'fiber',h:0.8},
  mushroom:{tex:()=>mushroomTex(),drop:'mushroom',h:0.6},
  deadbush:{tex:()=>deadbushTex(),drop:'fiber',h:0.7},
};
function makeCrossGeo(h){
  const g=new THREE.BufferGeometry(); const a=0.45;
  const pos=[ -a,0,-a, a,0,a, a,h,a, -a,h,-a,   -a,0,a, a,0,-a, a,h,-a, -a,h,a ];
  const uv=[ 0,0, 1,0, 1,1, 0,1,  0,0, 1,0, 1,1, 0,1 ];
  const idx=[0,1,2,0,2,3, 4,5,6,4,6,7];
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const plantMeshes={}, plantData={}, plantAt=new Map();   // key -> {type,index}
const MAX_PLANT=8000;
function buildPlantMeshes(){
  for(const t in PLANT_DEF){ const def=PLANT_DEF[t];
    const mat=new THREE.MeshLambertMaterial({map:def.tex(),transparent:true,alphaTest:0.5,side:THREE.DoubleSide});
    const im=new THREE.InstancedMesh(makeCrossGeo(def.h),mat,MAX_PLANT); im.count=0; im.frustumCulled=false; im.receiveShadow=true;
    scene.add(im); plantMeshes[t]=im; plantData[t]={list:[],map:new Map()}; }
}
function refreshPlant(t){ const im=plantMeshes[t],d=plantData[t];
  for(let i=0;i<d.list.length;i++){ const p=d.list[i]; _m.makeTranslation(p[0]+0.5,p[1],p[2]+0.5); im.setMatrixAt(i,_m); }
  im.count=d.list.length; im.instanceMatrix.needsUpdate=true; }
function addPlant(type,x,y,z,defer){ const k=key(x,y,z); if(plantAt.has(k))return;
  const d=plantData[type]; plantAt.set(k,{type,index:d.list.length}); d.map.set(k,d.list.length); d.list.push([x,y,z]); if(!defer)refreshPlant(type); }
function removePlantAt(k){ const rec=plantAt.get(k); if(!rec)return null; const {type}=rec; const d=plantData[type];
  const idx=d.map.get(k),last=d.list.length-1;
  if(idx!==last){ const mv=d.list[last]; d.list[idx]=mv; d.map.set(key(mv[0],mv[1],mv[2]),idx); plantAt.get(key(mv[0],mv[1],mv[2])).index=idx; }
  d.list.pop(); d.map.delete(k); plantAt.delete(k); refreshPlant(type); return PLANT_DEF[type].drop; }
function clearPlants(){ for(const t in plantData){ plantData[t].list.length=0; plantData[t].map.clear(); plantMeshes[t].count=0; plantMeshes[t].instanceMatrix.needsUpdate=true; } plantAt.clear(); }

const WSIZE=54;
function genHeight(x,z){
  return Math.round(6 + Math.sin(x*0.12)*2.5 + Math.cos(z*0.11)*2.5
    + Math.sin((x+z)*0.05)*3 + Math.sin(x*0.31)*Math.cos(z*0.27)*1.5);
}
// спеціальні осередки біомів (вибираються за сідом у generateWorld)
let volcanoCenters=[], swampCenters=[];
function nearCenter(list,x,z,r){ for(const c of list){ if(Math.hypot(x-c[0],z-c[1])<r)return true; } return false; }
// біом: desert | plains | forest | snow | volcano | swamp | meadow
function biomeAt(x,z){
  if(nearCenter(volcanoCenters,x,z,12)) return 'volcano';
  const h=genHeight(x,z);
  if(nearCenter(swampCenters,x,z,14)&&h<=7) return 'swamp';
  if(h<=4) return 'desert';
  if(h>=11) return 'snow';
  const m=Math.sin(x*0.045)*Math.cos(z*0.05)+Math.sin((x-z)*0.03);
  if(m>0.15) return 'forest';
  const f=Math.sin(x*0.08+1.7)*Math.cos(z*0.07-0.6);
  return f>0.45?'meadow':'plains';
}
function buildTree(x,h,z,kind){
  if(kind==='pine'){ const th=5+Math.floor(RNG()*3);
    for(let i=1;i<=th;i++)addBlock(x,h+i,z,21,true);
    for(let lvl=0;lvl<4;lvl++){ const r=3-lvl; const yy=h+th-3+lvl;
      for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++) if(Math.abs(dx)+Math.abs(dz)<=r && !(dx===0&&dz===0)) addBlock(x+dx,yy,z+dz,22,true); }
    addBlock(x,h+th+1,z,22,true);
  } else if(kind==='birch'){ const th=5+Math.floor(RNG()*2);
    for(let i=1;i<=th;i++)addBlock(x,h+i,z,23,true);
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=2;dy++)
      if(Math.abs(dx)+Math.abs(dz)+dy<=3&&!(dx===0&&dz===0&&dy===0))addBlock(x+dx,h+th+dy,z+dz,24,true);
  } else { const th=4+Math.floor(RNG()*3);     // дуб
    for(let i=1;i<=th;i++)addBlock(x,h+i,z,5,true);
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=2;dy++)
      if(Math.abs(dx)+Math.abs(dz)+dy<=3&&!(dx===0&&dz===0&&dy===0))addBlock(x+dx,h+th+dy,z+dz,6,true);
  }
}
function generateWorld(onProgress){
  // осередки спеціальних біомів
  volcanoCenters=[]; swampCenters=[];
  const farPoint=()=>{ let x,z; do{ x=Math.round(RNG()*WSIZE*1.6-WSIZE*0.8); z=Math.round(RNG()*WSIZE*1.6-WSIZE*0.8); }while(Math.hypot(x,z)<30); return [x,z]; };
  for(let i=0;i<2;i++)volcanoCenters.push(farPoint());
  for(let i=0;i<3;i++)swampCenters.push(farPoint());
  for(let x=-WSIZE;x<=WSIZE;x++)for(let z=-WSIZE;z<=WSIZE;z++){
    const h=genHeight(x,z), bm=biomeAt(x,z);
    for(let y=h;y>h-4;y--){
      let t=(y===h)?1:2;
      if(bm==='desert'&&y>=h-1)t=4;
      if(bm==='snow'&&y===h)t=9;
      if(bm==='swamp'&&y>=h-1)t=28;            // багно
      if(bm==='volcano'){ t=(y===h)?27:27; if(RNG()<0.15)t=26; } // базальт/обсидіан
      if(y<h-1&&RNG()<0.07){ const r=RNG();   // руди глибше
        t = r<0.4?11 : r<0.68?12 : r<0.86?13 : r<0.95?14 : 30; }
      addBlock(x,y,z,t,true);
    }
    if(bm==='swamp'){ for(let y=h+1;y<=6;y++)addBlock(x,y,z,7,true); }    // темна вода болота
    else if(h<4){ for(let y=h+1;y<=4;y++)addBlock(x,y,z,7,true); }
    if(bm==='volcano'){
      // лавові западини
      const vc=volcanoCenters.reduce((a,c)=>{const d=Math.hypot(x-c[0],z-c[1]);return d<a.d?{d,c}:a;},{d:1e9}).c;
      if(vc&&Math.hypot(x-vc[0],z-vc[1])<4)addBlock(x,h,z,25,true);     // лавове озеро в центрі
      else if(RNG()<0.03)addBlock(x,h+1,z,30,true);                     // світлокамінь
      else if(RNG()<0.02){ const ch=1+Math.floor(RNG()*3); for(let i=1;i<=ch;i++)addBlock(x,h+i,z,26,true); } // обсидіанові шпилі
      continue;
    }
    if(h<=4&&bm!=='swamp') continue;
    // дерева за біомом
    const tp=bm==='forest'?0.06:bm==='plains'?0.012:bm==='swamp'?0.04:bm==='meadow'?0.008:0;
    if(tp>0&&RNG()<tp){
      if(bm==='swamp'){ const th=4+Math.floor(RNG()*3); for(let i=1;i<=th;i++)addBlock(x,h+i,z,5,true);
        if(RNG()<0.5)addBlock(x,h+th+1,z,6,true); }                     // сухі дерева болота
      else { const kind=bm==='snow'?'pine':(RNG()<0.3?'birch':(RNG()<0.5?'pine':'oak')); buildTree(x,h,z,kind); }
    }
    else if(bm==='snow'&&RNG()<0.03){ buildTree(x,h,z,'pine'); }
    else { const top=getBlock(x,h,z);
      const fd = bm==='meadow'?0.45 : 0.16;          // густе різнотрав'я на лугах
      if(top===1){ const r=RNG();
        if(r<fd*0.6)addPlant('tall_grass',x,h+1,z,true);
        else if(r<fd*0.78)addPlant('flower_red',x,h+1,z,true);
        else if(r<fd*0.95)addPlant('flower_yellow',x,h+1,z,true);
        else if((bm==='forest'||bm==='swamp')&&r<fd+0.04)addPlant('mushroom',x,h+1,z,true);
      } else if(bm==='swamp'&&top===28&&RNG()<0.06){ addPlant('tall_grass',x,h+1,z,true);
      } else if(bm==='desert'&&RNG()<0.015){ const ch=1+Math.floor(RNG()*2); for(let i=1;i<=ch;i++)addBlock(x,h+i,z,16,true);
      } else if(bm==='desert'&&RNG()<0.02){ addPlant('deadbush',x,h+1,z,true); }
    }
  }
  // валуни-орієнтири
  for(let i=0;i<16;i++){ const x=Math.floor(RNG()*WSIZE*2-WSIZE),z=Math.floor(RNG()*WSIZE*2-WSIZE),h=genHeight(x,z);
    if(h>4&&h<11)for(let dx=0;dx<2;dx++)for(let dz=0;dz<2;dz++)for(let dy=1;dy<=1+Math.floor(RNG()*2);dy++)addBlock(x+dx,h+dy,z+dz,3,true); }
  // центральна вежа-вівтар
  for(let y=0;y<8;y++)for(let a=0;a<TAU;a+=0.45){
    const rx=Math.round(Math.cos(a)*3.2),rz=Math.round(Math.sin(a)*3.2);
    if(y%6!==5||RNG()<0.6)addBlock(rx,genHeight(rx,rz)+1+y,rz,3,true);
  }
  addBlock(0,genHeight(0,0)+1,0,8,true);
  for(const t in instData)refreshInstance(+t);
  for(const t in plantData)refreshPlant(t);
  // скрині зі скарбами
  for(let i=0;i<7;i++){ const a=RNG()*TAU,r=rand(16,WSIZE-6);
    const x=Math.round(Math.cos(a)*r),z=Math.round(Math.sin(a)*r); if(genHeight(x,z)>4)makeChest(x,z); }
  if(onProgress)onProgress(1);
}
function surfaceY(x,z){ let y=22; while(y>-6&&getBlock(x,y,z)===0)y--; return y; }
function clearWorld(){
  WORLD.clear();
  for(const t in instData){ instData[t].list.length=0; instData[t].map.clear(); instMeshes[t].count=0; instMeshes[t].instanceMatrix.needsUpdate=true; }
  clearPlants();
  for(const c of chests)scene.remove(c.mesh); chests.length=0;
  for(const an of critters)scene.remove(an.mesh); critters.length=0;
}
function regenerateWorld(seed){ G.seed=seed; RNG=mulberry32(seed); clearWorld(); generateWorld(()=>{}); }

/* ============================= ГРАВЕЦЬ ============================= */
const player={pos:new THREE.Vector3(0,25,8),vel:new THREE.Vector3(),onGround:false,
  yaw:Math.PI,pitch:0,height:1.7,radius:0.3};
function solidAt(x,y,z){ const b=getBlock(Math.floor(x),Math.floor(y),Math.floor(z)); return b!==0&&b!==7&&b!==8&&b!==25; }
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
  if(e.code==='KeyC')toggleCraft();
  if(e.code==='KeyG')shootBow();
  if(e.code==='KeyV')castLightning();
  if(e.code==='KeyH')castHeal();
  if(e.code==='KeyZ')whirlwindSprint();
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

function gotItem(id,n,pos){ addItem(id,n||1);
  if(pos)floatText(pos,'+'+(n||1)+' '+(ITEMS[id]?ITEMS[id].i:''),'#cfe6a0'); updateResStrip(); }
function mineBlock(){ const hit=raycastVoxel(6); if(!hit)return; const t=getBlock(hit.x,hit.y,hit.z); if(t===7)return;
  const pos=new THREE.Vector3(hit.x+.5,hit.y+1,hit.z+.5);
  // зібрати рослину, що стоїть зверху
  const drop=removePlantAt(key(hit.x,hit.y+1,hit.z)); if(drop)gotItem(drop,1,pos);
  removeBlock(hit.x,hit.y,hit.z); G.blocksMined++; Audio.mine(); spawnBlockParticles(hit.x,hit.y,hit.z,t);
  const res=DROP[t]; if(res){ gotItem(res, (res==='gem')?1:randi(1,2), pos); }
  if(t===1&&RNG()<0.25)gotItem('fiber',1);          // з трави інколи волокно
  if(t===13){ const g=randi(6,14); G.gold+=g; floatText(pos,'+'+g+'💰','#e8c66a'); }
  questProgress('mine'); }

function placeBlock(){ const it=HOTBAR[G.slot]; if(it.type!=='block')return; const hit=raycastVoxel(6); if(!hit)return;
  if(it.res && itemCount(it.res)<=0){ toast('Немає ресурсу: '+(ITEMS[it.res]?ITEMS[it.res].n:it.res)); return; }
  const nx=hit.x+hit.face[0],ny=hit.y+hit.face[1],nz=hit.z+hit.face[2];
  const aX=Math.floor(player.pos.x-0.3),bX=Math.floor(player.pos.x+0.3),aZ=Math.floor(player.pos.z-0.3),bZ=Math.floor(player.pos.z+0.3),
        aY=Math.floor(player.pos.y),bY=Math.floor(player.pos.y+player.height);
  if(nx>=aX&&nx<=bX&&nz>=aZ&&nz<=bZ&&ny>=aY&&ny<=bY)return;
  addBlock(nx,ny,nz,it.block); if(it.res)takeItems({[it.res]:1});
  G.blocksPlaced++; Audio.place(); buildHotbar(); updateResStrip(); questProgress('build'); }

function block(){ /* щит-блок поки декоративний */ }

/* ---- бій ---- */
let swordSwing=0;
function weaponDamage(){ const w=ITEMS[G.weapon]; return ((w&&w.weapon||18)+G.level*3)*(1+0.2*PERK.might); }
function swingSword(){
  if(G.sp<8)return; G.sp-=8; swordSwing=1; Audio.sword();
  const reach=3.6, dir=lookDir(); let best=null,bd=reach;
  for(const en of enemies.concat(critters)){ if(en.dead)continue;
    const to=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.5:1,0)).sub(camera.position);
    const dist=to.length(); if(dist>reach)continue; to.normalize();
    if(to.dot(dir)>0.5&&dist<bd){bd=dist;best=en;} }
  if(best){ damageEnemy(best,weaponDamage()); hitSpark(best.mesh.position); Audio.hit(); }
}
function shootBow(){
  if(!G.hasBow){ toast('Спершу скрафти лук (C)'); return; }
  if(itemCount('arrow')<=0){ toast('Немає стріл'); return; }
  takeItems({arrow:1}); updateResStrip(); Audio.sword();
  const dir=lookDir(), o=camera.position.clone();
  const dmg=(28+G.level*5)*(1+0.2*PERK.might);
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.5),new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:0.8}));
  m.position.copy(o); scene.add(m);
  projectiles.push({pos:o,vel:dir.clone().multiplyScalar(42),life:2.5,dmg,friendly:true,kind:'arrow',arrow:true,mesh:m}); }
function ensureMana(cost){ if(G.mp>=cost)return true;
  if(itemCount('mana_potion')>0){ takeItems({mana_potion:1}); G.mp=clamp(G.mp+70,0,G.mpMax); buildHotbar(); updateResStrip(); floatText(camera.position,'+70 🔮','#9fb6ff'); return G.mp>=cost; }
  toast('Недостатньо мани'); return false; }
function castFire(){ const cost=Math.round(20*(1-0.1*PERK.destruction)); if(!ensureMana(cost))return;
  G.mp-=cost; Audio.fire(); const dir=lookDir(), o=camera.position.clone();
  const dmg=(30+G.level*5)*(1+0.2*PERK.destruction);
  projectiles.push({pos:o,vel:dir.clone().multiplyScalar(30),life:1.5,dmg,friendly:true,kind:'fire',mesh:makeOrb(o,0xff7722,0x441100)});
  subtitle("Yol! — Полум'я"); }
function castFrost(){ const cost=Math.round(18*(1-0.1*PERK.destruction)); if(!ensureMana(cost))return;
  G.mp-=cost; Audio.frost(); const dir=lookDir(), o=camera.position.clone();
  const dmg=(20+G.level*4)*(1+0.2*PERK.destruction);
  projectiles.push({pos:o,vel:dir.clone().multiplyScalar(34),life:1.4,dmg,friendly:true,kind:'frost',slow:true,mesh:makeOrb(o,0x88ddff,0x113344)});
  subtitle('Fo! — Крижаний подих'); }
function castLightning(){ const cost=Math.round(28*(1-0.1*PERK.destruction)); if(!ensureMana(cost))return;
  G.mp-=cost; Audio.blip(1200,0.2,'sawtooth',0.3,0.4); Audio.noise(0.2,0.2,3000);
  const dmg=(26+G.level*5)*(1+0.2*PERK.destruction);
  // ланцюг до 3 найближчих ворогів попереду
  const dir=lookDir(); let from=camera.position.clone(); const hit=[];
  let pool=enemies.concat(critters).filter(e=>!e.dead);
  for(let n=0;n<3;n++){ let best=null,bd=18;
    for(const en of pool){ if(hit.includes(en))continue;
      const to=en.mesh.position.clone().add(new THREE.Vector3(0,1,0)).sub(from); const d=to.length();
      if(d<bd && (n>0 || to.clone().normalize().dot(dir)>0.4)){ bd=d; best=en; } }
    if(!best)break; hit.push(best); const tp=best.mesh.position.clone().add(new THREE.Vector3(0,1,0));
    boltLine(from,tp); damageEnemy(best,dmg*(1-n*0.2)); hitSpark(best.mesh.position); from=tp; }
  if(!hit.length)boltLine(camera.position.clone(),camera.position.clone().add(dir.clone().multiplyScalar(12)));
  subtitle('Strun! — Блискавка'); shoutFlashColor('rgba(160,200,255,.4)'); }
function boltLine(a,b){ const mid=a.clone().add(b).multiplyScalar(0.5); const len=a.distanceTo(b);
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,len),new THREE.MeshBasicMaterial({color:0xcfe0ff}));
  m.position.copy(mid); m.lookAt(b); m.add(makeGlow(0xaaccff,1.5)); scene.add(m);
  particles.push({mesh:m,vel:new THREE.Vector3(0,0,0),life:0.15,grav:false}); }
function castHeal(){ const cost=Math.round(30*(1-0.1*PERK.destruction)); if(!ensureMana(cost))return;
  if(G.hp>=G.hpMax){ toast('Здоров\'я повне'); return; }
  G.mp-=cost; const amt=40+G.level*4; G.hp=clamp(G.hp+amt,0,G.hpMax); G.onFire=0; Audio.gold();
  floatText(camera.position,'+'+amt+' ♥','#7af0a0'); subtitle('Grah! — Лікування'); updateHUD();
  for(let i=0;i<8;i++){ const m=makeGlow(0x7af0a0,0.4); m.position.set(camera.position.x+rand(-.5,.5),camera.position.y+rand(-1,.5),camera.position.z+rand(-.5,.5));
    scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(0,1.5,0),life:0.6,grav:false}); } }
let sprintReady=0;
function whirlwindSprint(){ if(performance.now()<sprintReady){ toast('Ривок перезаряджається'); return; }
  if(G.sp<25){ toast('Замало витривалості'); return; } G.sp-=25; sprintReady=performance.now()+4000;
  const dir=lookDir(); dir.y=0; dir.normalize();
  player.vel.x+=dir.x*26; player.vel.z+=dir.z*26; player.vel.y=4;
  Audio.shout(); subtitle('WULD NAH KEST! — Ривок'); shoutFlashColor('rgba(180,220,255,.35)'); }
function doShout(){ const cd=SHOUT_CD_BASE-PERK.thuum*1000;
  if(performance.now()<G.shoutReady){toast('Крик ще не готовий');return;}
  G.shoutReady=performance.now()+cd; Audio.shout(); subtitle('FUS RO DAH!'); shoutFlash();
  const dir=lookDir();
  for(const en of enemies){ if(en.dead)continue;
    const to=en.mesh.position.clone().sub(camera.position); const dist=to.length();
    if(dist<15&&to.clone().normalize().dot(dir)>0.35){ en.vel.add(to.normalize().multiplyScalar(20)); en.vel.y=9; damageEnemy(en,16); } } }
function drinkPotion(){
  if(itemCount('health_potion')>0){ takeItems({health_potion:1}); G.hp=clamp(G.hp+60,0,G.hpMax); Audio.gold();
    toast('+60 здоров\'я'); floatText(camera.position,'+60 ♥','#37c46b'); buildHotbar(); updateResStrip(); return; }
  if(itemCount('cookedmeat')>0){ takeItems({cookedmeat:1}); G.hp=clamp(G.hp+30,0,G.hpMax); G.food=clamp(G.food+45,0,G.foodMax); Audio.gold();
    toast('+30 ♥ / +45 ситості (печеня)'); floatText(camera.position,'+30 ♥','#37c46b'); buildHotbar(); updateResStrip(); return; }
  if(itemCount('meat')>0){ takeItems({meat:1}); G.food=clamp(G.food+20,0,G.foodMax); G.hp=clamp(G.hp+6,0,G.hpMax); Audio.gold();
    toast('+20 ситості (сире м\'ясо)'); updateResStrip(); return; }
  if(G.gold>=25){ G.gold-=25; G.hp=clamp(G.hp+50,0,G.hpMax); Audio.gold(); toast('+50 здоров\'я (за золото)'); floatText(camera.position,'+50','#37c46b'); return; }
  toast('Немає їжі/зілля. Скрафти або вполюй (C)'); }
function interact(){
  if(trader&&trader.mesh.position.distanceTo(camera.position)<3.2){ toggleTrade(); return; }
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
// чотириногий (вовк/олень/кролик)
function makeBeast(bodyCol,opt){ opt=opt||{}; const g=new THREE.Group(); const s=opt.size||1;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.5*s,0.45*s,1.0*s),M(bodyCol)); body.position.y=0.5*s; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.4*s,0.4*s,0.4*s),M(opt.headCol||bodyCol)); head.position.set(0,0.62*s,0.6*s); head.castShadow=true; g.add(head);
  const lg=new THREE.BoxGeometry(0.14*s,0.45*s,0.14*s);
  const legs=[]; [[-.18,.4],[.18,.4],[-.18,-.35],[.18,-.35]].forEach(p=>{ const l=new THREE.Mesh(lg,M(opt.legCol||bodyCol));
    l.position.set(p[0]*s,0.22*s,p[1]*s); g.add(l); legs.push(l); });
  if(opt.ears){ const e=new THREE.BoxGeometry(0.1*s,0.3*s,0.06*s);
    [-.12,.12].forEach(x=>{ const m=new THREE.Mesh(e,M(opt.headCol||bodyCol)); m.position.set(x*s,0.9*s,0.6*s); g.add(m); }); }
  if(opt.antlers){ const a=new THREE.BoxGeometry(0.05*s,0.35*s,0.05*s);
    [-.13,.13].forEach(x=>{ const m=new THREE.Mesh(a,M(0x6a4a28)); m.position.set(x*s,0.95*s,0.55*s); g.add(m); }); }
  if(opt.tail){ const tl=new THREE.Mesh(new THREE.BoxGeometry(0.12*s,0.12*s,0.4*s),M(opt.tailCol||bodyCol)); tl.position.set(0,0.55*s,-0.6*s); g.add(tl); }
  g.userData.legs=legs; g.userData.body=body; return g;
}
function makeBird(bodyCol){ const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.3,0.4),M(bodyCol)); body.position.y=0.35; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,0.24),M(bodyCol)); head.position.set(0,0.6,0.18); g.add(head);
  const beak=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.1),M(0xe8a23a)); beak.position.set(0,0.58,0.35); g.add(beak);
  const comb=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.1,0.12),M(0xc0392b)); comb.position.set(0,0.74,0.16); g.add(comb);
  const lg=new THREE.BoxGeometry(0.06,0.2,0.06); const legs=[];
  [-.08,.08].forEach(x=>{ const l=new THREE.Mesh(lg,M(0xe8a23a)); l.position.set(x,0.1,0); g.add(l); legs.push(l); });
  g.userData.legs=legs; g.userData.body=body; return g;
}
const ENEMY_TYPES={
  bandit:{name:'Бандит',col:0x6b3a2a,hp:45,dmg:8,xp:25,gold:12,speed:2.8,ranged:false},
  draugr:{name:'Дроуг',col:0x4a5a40,head:0x9aa48a,hp:65,dmg:11,xp:38,gold:16,speed:2.3,ranged:false},
  skeleton:{name:'Скелет-маг',col:0xb9b6a8,head:0xe8e4d6,hp:40,dmg:14,xp:42,gold:20,speed:2.0,ranged:true},
  wraith:{name:'Крижана примара',col:0x6fb0d0,head:0xbfeaff,hp:55,dmg:12,xp:48,gold:24,speed:3.3,ranged:false,frost:true},
  wolf:{name:'Вовк',col:0x6a6a6a,hp:50,dmg:10,xp:35,gold:0,speed:4.0,ranged:false,beast:true,drops:{meat:1,hide:1}},
  troll:{name:'Гірський троль',col:0x5a6a4a,head:0x6a7a55,hp:300,dmg:26,xp:200,gold:150,speed:2.4,big:true,drops:{hide:3,bone:2,gem:1}},
};
function spawnEnemy(type,x,z){
  const def=ENEMY_TYPES[type]; const y=surfaceY(Math.floor(x),Math.floor(z))+1;
  const mesh=def.beast?makeBeast(def.col,{size:1.0,tail:true,legCol:0x4a4a4a,headCol:0x5a5a5a}):humanoid(def.col,def.head);
  if(def.big)mesh.scale.setScalar(1.9);
  mesh.position.set(x,y,z); scene.add(mesh);
  const scale=1+(G.level-1)*0.08;
  enemies.push({type,name:def.name,mesh,hp:def.hp*scale,hpMax:def.hp*scale,dmg:def.dmg*scale,
    xp:def.xp,gold:def.gold,speed:def.speed,ranged:def.ranged,frost:def.frost,beast:def.beast,drops:def.drops,
    vel:new THREE.Vector3(),dead:false,onGround:false,atkCd:rand(0,1),anim:0,boss:false,slowT:0,flash:0});
  createEnemyBar(enemies[enemies.length-1]);
}
function damageEnemy(en,amount){ if(en.dead)return;
  if(en.boss&&en.state==='land')amount*=1.6;            // дракон вразливіший на землі
  en.hp-=amount; en.flash=6; if(en.passive)en.fleeT=8;
  floatText(en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?2.5:1.8,0)),Math.round(amount),en.boss?'#ff8a5a':'#ffd34a');
  if(en.boss)updateBossBar(); if(en.hp<=0)killEnemy(en); }
function killEnemy(en){ en.dead=true; scene.remove(en.mesh); removeEnemyBar(en); gainXP(en.xp||10);
  const lootPos=en.mesh.position.clone().add(new THREE.Vector3(0,1,0));
  if(en.drops)for(const id in en.drops){ const n=en.drops[id]+(Math.random()<0.4?1:0); if(n>0)gotItem(id,n,lootPos); }
  if(en.gold)dropGold(en.mesh.position,Math.round(en.gold*(1+0.25*PERK.fortune)));
  if(!en.passive){ G.kills++; if(Math.random()<0.15)dropPotion(en.mesh.position); questProgress('kill'); }
  if(en.boss){G.dragonDead=true;victory();} }

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

/* ============================= ФАУНА (мирні тварини) ============================= */
const critters=[];
const CRITTER_TYPES={
  deer:{name:'Олень',hp:30,xp:18,speed:3.2,drops:{meat:2,hide:1},build:()=>makeBeast(0x9a6a3a,{size:1.15,antlers:true,tail:true,headCol:0xa6764a,legCol:0x6a4a28})},
  rabbit:{name:'Кролик',hp:12,xp:8,speed:3.8,drops:{meat:1,hide:1},build:()=>makeBeast(0xdcdcd0,{size:0.55,ears:true,tail:true,headCol:0xeeeee2})},
  chicken:{name:'Курка',hp:10,xp:6,speed:2.6,drops:{meat:1,feather:2},build:()=>makeBird(0xf0ece0)},
  boar:{name:'Кабан',hp:45,xp:22,speed:3.0,drops:{meat:2,hide:1,bone:1},build:()=>makeBeast(0x4a3a2e,{size:1.1,tail:true,headCol:0x5a4636,legCol:0x322620})},
};
function spawnCritter(type,x,z){ const def=CRITTER_TYPES[type]; const y=surfaceY(Math.floor(x),Math.floor(z))+1;
  const mesh=def.build(); mesh.position.set(x,y,z); scene.add(mesh);
  const c={type,name:def.name,mesh,hp:def.hp,hpMax:def.hp,xp:def.xp,speed:def.speed,drops:def.drops,passive:true,
    vel:new THREE.Vector3(),dead:false,anim:0,flash:0,fleeT:0,wanderT:rand(0,2),dir:rand(0,TAU),boss:false};
  critters.push(c); createEnemyBar(c); }
let critterTimer=2;
function maybeSpawnCritters(dt){ critterTimer-=dt; const alive=critters.filter(c=>!c.dead).length;
  if(critterTimer<=0&&alive<10){ critterTimer=rand(3,6);
    const a=Math.random()*TAU,d=rand(14,30),x=player.pos.x+Math.cos(a)*d,z=player.pos.z+Math.sin(a)*d;
    if(Math.abs(x)<WSIZE-2&&Math.abs(z)<WSIZE-2&&genHeight(Math.floor(x),Math.floor(z))>4){
      const bm=biomeAt(Math.floor(x),Math.floor(z)); const r=Math.random();
      let type = bm==='snow'?(r<0.6?'rabbit':'deer') : bm==='desert'?(r<0.6?'boar':'rabbit')
               : (r<0.35?'deer':r<0.6?'rabbit':r<0.8?'chicken':'boar');
      spawnCritter(type,x,z); } } }
function updateCritters(dt){ for(const c of critters){ if(c.dead)continue;
  c.vel.y-=24*dt; c.fleeT=Math.max(0,c.fleeT-dt); c.wanderT-=dt;
  const toP=new THREE.Vector3(player.pos.x-c.mesh.position.x,0,player.pos.z-c.mesh.position.z); const distP=toP.length();
  let mvx=0,mvz=0;
  if(c.fleeT>0||distP<4){ // тікати від гравця
    const away=toP.clone().multiplyScalar(-1).normalize(); mvx=away.x*c.speed*1.3; mvz=away.z*c.speed*1.3;
    c.mesh.rotation.y=Math.atan2(-toP.x,-toP.z); c.anim+=dt*12;
  } else { if(c.wanderT<=0){ c.wanderT=rand(1.5,4); c.dir=rand(0,TAU); if(Math.random()<0.4){mvx=mvz=0;} }
    mvx=Math.cos(c.dir)*c.speed*0.5; mvz=Math.sin(c.dir)*c.speed*0.5;
    if(mvx||mvz){ c.mesh.rotation.y=Math.atan2(mvx,mvz); c.anim+=dt*7; } }
  c.mesh.position.x+=mvx*dt; c.mesh.position.z+=mvz*dt; c.mesh.position.y+=c.vel.y*dt;
  c.mesh.position.x=clamp(c.mesh.position.x,-WSIZE+1,WSIZE-1); c.mesh.position.z=clamp(c.mesh.position.z,-WSIZE+1,WSIZE-1);
  const gy=surfaceY(Math.floor(c.mesh.position.x),Math.floor(c.mesh.position.z))+1;
  if(c.mesh.position.y<gy){ c.mesh.position.y=gy; c.vel.y=0; }
  const legs=c.mesh.userData.legs; if(legs){ const s=Math.sin(c.anim)*0.5; legs.forEach((l,i)=>l.rotation.x=(i%2?s:-s)); }
  if(c.flash>0){ c.flash--; if(c.mesh.userData.body)c.mesh.userData.body.material.emissive.setHex(0x661111); }
  else if(c.mesh.userData.body)c.mesh.userData.body.material.emissive.setHex(0x000000);
} }

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
    if(p.friendly){ let hitOne=false; for(const en of enemies.concat(critters)){ if(en.dead)continue;
        const c=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.2:1,0));
        if(p.pos.distanceTo(c)<(en.boss?2.6:1.1)){ damageEnemy(en,p.dmg); if(p.slow)en.slowT=2.5; hitSpark(en.mesh.position); p.dead=true; scene.remove(p.mesh); hitOne=true; break; } }
      if(hitOne)continue; }
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

/* ============================= ТОРГОВЕЦЬ ============================= */
let trader=null;
const BUY=[
  {id:'health_potion',n:1,price:40},{id:'mana_potion',n:1,price:40},{id:'arrow',n:10,price:20},
  {id:'iron',n:3,price:35},{id:'wood',n:8,price:16},{id:'iron_sword',n:1,price:130,gear:true},
  {id:'iron_armor',n:1,price:160,gear:true},
];
const SELL=[
  {id:'hide',price:8},{id:'meat',price:5},{id:'bone',price:7},{id:'feather',price:3},
  {id:'gem',price:45},{id:'goldore',price:18},{id:'obsidian',price:12},{id:'coal',price:4},
];
function spawnTrader(){ const x=8,z=-3,y=surfaceY(x,z)+1;
  const mesh=humanoid(0x3a4a6a,0xc9b79a); mesh.position.set(x,y,z);
  const hat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.18,0.5),M(0x2a2a3a)); hat.position.y=1.82; mesh.add(hat);
  mesh.add(makeGlow(0xe8c66a,0.9)); scene.add(mesh);
  trader={mesh,x,z}; }
let tradeOpen=false;
function toggleTrade(){ tradeOpen=!tradeOpen; const p=document.getElementById('tradePanel');
  if(tradeOpen){ renderTrade(); p.classList.remove('hidden'); document.exitPointerLock(); }
  else { p.classList.add('hidden'); if(G.started&&!G.over)canvas.requestPointerLock(); } }
function renderTrade(){ document.getElementById('tradeGold').textContent=G.gold;
  const bl=document.getElementById('buyList'); bl.innerHTML='';
  for(const b of BUY){ const ok=G.gold>=b.price; const d=document.createElement('div'); d.className='recipe'+(ok?'':' cant');
    d.innerHTML=`<div><div class="rn">${ITEMS[b.id].i} ${ITEMS[b.id].n}${b.n>1?' ×'+b.n:''}</div><div class="rc">💰 ${b.price}</div></div><div class="ro">🛒</div>`;
    d.onclick=()=>{ if(G.gold<b.price){toast('Замало золота');return;} G.gold-=b.price; addItem(b.id,b.n); if(b.gear)equip(b.id);
      Audio.gold(); renderTrade(); updateHUD(); updateResStrip(); buildHotbar(); }; bl.appendChild(d); }
  const sl=document.getElementById('sellList'); sl.innerHTML='';
  for(const s of SELL){ const have=itemCount(s.id); const d=document.createElement('div'); d.className='recipe'+(have>0?'':' cant');
    d.innerHTML=`<div><div class="rn">${ITEMS[s.id].i} ${ITEMS[s.id].n} <span style="color:#bcb6a4">×${have}</span></div><div class="rc">+💰 ${s.price}</div></div><div class="ro">💱</div>`;
    d.onclick=()=>{ if(itemCount(s.id)<=0){toast('Немає що продати');return;} takeItems({[s.id]:1}); G.gold+=s.price;
      Audio.gold(); renderTrade(); updateHUD(); updateResStrip(); }; sl.appendChild(d); }
}

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

/* ---- погода: листя в лісі / сніг у горах ---- */
function updateWeather(dt){
  const bm=biomeAt(Math.floor(player.pos.x),Math.floor(player.pos.z));
  if(bm==='snow'&&Math.random()<0.5){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.08),new THREE.MeshBasicMaterial({color:0xffffff}));
    m.position.set(player.pos.x+rand(-14,14),player.pos.y+rand(6,12),player.pos.z+rand(-14,14)); scene.add(m);
    particles.push({mesh:m,vel:new THREE.Vector3(rand(-.3,.3),-1.4,rand(-.3,.3)),life:3,grav:false}); }
  else if(bm==='forest'&&Math.random()<0.12){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.04,0.12),M(0x6a8a3a));
    m.position.set(player.pos.x+rand(-12,12),player.pos.y+rand(5,10),player.pos.z+rand(-12,12)); scene.add(m);
    particles.push({mesh:m,vel:new THREE.Vector3(rand(-.5,.5),-0.8,rand(-.5,.5)),life:4,grav:false}); }
}

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
function updateEnemyBars(){ for(const en of enemies.concat(critters)){ if(en.dead||!en.bar)continue;
  if(en.passive&&en.hp>=en.hpMax){ en.bar.style.display='none'; continue; }  // цілим тваринам бар не показуємо
  _v.copy(en.mesh.position); _v.y+=en.boss?5.2:(en.passive?1.5:2.1); _v.project(camera);
  if(_v.z>1||_v.z<-1){ en.bar.style.display='none'; continue; }
  const dist=en.mesh.position.distanceTo(camera.position);
  if(dist>(en.boss?80:24)){ en.bar.style.display='none'; continue; }
  en.bar.style.display='block';
  en.bar.style.left=(_v.x*0.5+0.5)*innerWidth+'px'; en.bar.style.top=(-_v.y*0.5+0.5)*innerHeight+'px';
  en.barFill.style.width=clamp(en.hp/en.hpMax*100,0,100)+'%'; } }

/* ---- підсвічування прицілу на цілі ---- */
function updateCrosshair(){ const dir=lookDir(); let aim=false;
  for(const en of enemies.concat(critters)){ if(en.dead)continue;
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
  document.getElementById('foodFill').style.width=clamp(G.food/G.foodMax*100,0,100)+'%';
  document.getElementById('hpTxt').textContent=Math.ceil(G.hp)+'/'+G.hpMax;
  document.getElementById('lvlNum').textContent=G.level;
  document.getElementById('xpFill').style.width=(G.xp/G.xpNext*100)+'%';
  document.getElementById('goldNum').textContent=G.gold;
  document.getElementById('perkNum').textContent=G.perks;
  updateGear();
}
function updateGear(){ document.getElementById('gearWeapon').textContent=(ITEMS[G.weapon]?ITEMS[G.weapon].n:'—')+(G.hasBow?' +🏹':'');
  document.getElementById('gearArmor').textContent=G.armorItem?ITEMS[G.armorItem].n:'—'; }
function updateResStrip(){ const el=document.getElementById('resStrip'); el.innerHTML='';
  for(const id of ['wood','stone','iron','gem','hide','arrow']){ const n=itemCount(id);
    if(n>0){ const d=document.createElement('div'); d.className='res'; d.innerHTML=`${ITEMS[id].i} <b>${n}</b>`; el.appendChild(d); } } }
function buildHotbar(){ const hb=document.getElementById('hotbar'); hb.innerHTML='';
  HOTBAR.forEach((it,i)=>{ const d=document.createElement('div'); d.className='slot'+(i===G.slot?' active':'');
    let icon=it.icon, cnt='';
    if(it.type==='weapon'&&ITEMS[G.weapon])icon=ITEMS[G.weapon].i;
    if(it.res)cnt=itemCount(it.res); if(it.type==='potion')cnt=itemCount('health_potion');
    d.innerHTML=`<span class="nm">${it.type==='weapon'&&ITEMS[G.weapon]?ITEMS[G.weapon].n:it.name}</span>${icon}<small>${i+1}</small>${cnt!==''?'<b style="position:absolute;top:1px;left:3px;font-size:9px;color:#cfe6a0">'+cnt+'</b>':''}`;
    hb.appendChild(d); }); }
function selectSlot(i){ G.slot=clamp(i,0,HOTBAR.length-1); buildHotbar(); }
let toastT; function toast(m){ const el=document.getElementById('toast'); el.textContent=m; el.style.opacity=1;
  clearTimeout(toastT); toastT=setTimeout(()=>el.style.opacity=0,1800); }
let subT; function subtitle(m){ const el=document.getElementById('subtitle'); el.textContent=m; el.style.opacity=1;
  clearTimeout(subT); subT=setTimeout(()=>el.style.opacity=0,2600); }
function damageFlash(){ const el=document.getElementById('dmgFlash'); el.style.opacity=1; setTimeout(()=>el.style.opacity=0,120); }
function shoutFlash(){ shoutFlashColor('rgba(80,140,220,.55)'); }
function shoutFlashColor(col){ const el=document.getElementById('dmgFlash');
  el.style.background='radial-gradient(transparent 48%, '+col+')'; el.style.opacity=1;
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
function togglePause(){ if(skillsOpen){toggleSkills();return;} if(craftOpen){toggleCraft();return;} if(tradeOpen){toggleTrade();return;}
  G.paused=!G.paused; const p=document.getElementById('pauseMenu');
  if(G.paused){ p.classList.remove('hidden'); document.exitPointerLock(); } else { p.classList.add('hidden'); canvas.requestPointerLock(); } }

/* ============================= КРАФТ ============================= */
let craftOpen=false;
function toggleCraft(){ craftOpen=!craftOpen; const p=document.getElementById('craftPanel');
  if(craftOpen){ renderCraft(); p.classList.remove('hidden'); document.exitPointerLock(); }
  else { p.classList.add('hidden'); if(G.started&&!G.over)canvas.requestPointerLock(); } }
function renderCraft(){ renderInventory(); renderRecipes(); }
function renderInventory(){ const g=document.getElementById('invGrid'); g.innerHTML='';
  const ids=Object.keys(ITEMS).filter(id=>itemCount(id)>0);
  if(!ids.length){ g.innerHTML='<div style="grid-column:1/-1;color:#8a8474;font-size:13px">Порожньо — видобувай ресурси та полюй.</div>'; }
  for(const id of ids){ const d=document.createElement('div'); d.className='invslot';
    d.innerHTML=`<span class="tip">${ITEMS[id].n}</span>${ITEMS[id].i}<small>${itemCount(id)}</small>`; g.appendChild(d); } }
function reqText(req){ return Object.keys(req).map(k=>`${ITEMS[k].i}${ITEMS[k].n} ×${req[k]}`).join(', '); }
function renderRecipes(){ const list=document.getElementById('recipeList'); list.innerHTML='';
  for(const r of RECIPES){ const ok=hasItems(r.req); const d=document.createElement('div'); d.className='recipe'+(ok?'':' cant');
    const equipNote=r.gear?' · одягнеться':'';
    d.innerHTML=`<div><div class="rn">${ITEMS[r.out].i} ${ITEMS[r.out].n}${r.n>1?' ×'+r.n:''}</div>
      <div class="rc">${reqText(r.req)}${equipNote}</div></div><div class="ro">${ok?'🔨':'🔒'}</div>`;
    d.onclick=()=>craft(r); list.appendChild(d); } }
function craft(r){ if(!hasItems(r.req)){ toast('Недостатньо ресурсів'); return; }
  takeItems(r.req); addItem(r.out,r.n); Audio.place();
  if(r.gear)equip(r.out);
  toast('Створено: '+ITEMS[r.out].n); renderCraft(); updateResStrip(); buildHotbar(); }
function equip(id){ const it=ITEMS[id];
  if(it.weapon!=null){ G.weapon=id; toast('Озброєно: '+it.n); }
  if(it.bow){ G.hasBow=true; toast('Лук готовий (G — стріляти)'); }
  if(it.armor!=null){ G.armorItem=id; G.defense=it.armor; toast('Вдягнено: '+it.n); }
  updateGear(); }

/* ============================= СПАВН ============================= */
let spawnTimer=3;
function maybeSpawn(dt){ spawnTimer-=dt; const alive=enemies.filter(e=>!e.dead&&!e.boss).length;
  if(spawnTimer<=0&&alive<7&&!G.dragonDead){ spawnTimer=rand(3,5);
    const a=Math.random()*TAU,d=rand(15,28),x=player.pos.x+Math.cos(a)*d,z=player.pos.z+Math.sin(a)*d;
    if(Math.abs(x)<WSIZE-2&&Math.abs(z)<WSIZE-2){
      const r=Math.random(); let type='bandit';
      if(G.level>=2&&r<0.35)type='draugr'; if(G.level>=3&&r<0.2)type='skeleton'; if(G.level>=4&&r<0.12)type='wraith';
      spawnEnemy(type,x,z); } } }

/* ---- міні-бос ---- */
let miniBossTimer=90, miniBossActive=false, miniBossRef=null;
function updateMiniBoss(dt){ if(G.dragonDead)return;
  if(miniBossActive){ if(!miniBossRef||miniBossRef.dead){ miniBossActive=false; miniBossRef=null; miniBossTimer=rand(80,120); } return; }
  miniBossTimer-=dt;
  if(miniBossTimer<=0&&G.level>=2){ const a=Math.random()*TAU,d=rand(16,24);
    const x=clamp(player.pos.x+Math.cos(a)*d,-WSIZE+2,WSIZE-2),z=clamp(player.pos.z+Math.sin(a)*d,-WSIZE+2,WSIZE-2);
    spawnEnemy('troll',x,z); miniBossRef=enemies[enemies.length-1]; miniBossActive=true;
    Audio.roar(); toast('ГІРСЬКИЙ ТРОЛЬ НАБЛИЖАЄТЬСЯ!'); subtitle('Сильний ворог поряд — будь обережний!'); } }

/* ============================= УРОН/СМЕРТЬ ============================= */
let playerSlow=0;
function hurtPlayer(a){ if(G.over)return; a*=(1-(G.defense||0)); G.hp-=a; damageFlash(); Audio.hurt(); updateHUD(); if(G.hp<=0)die(); }
let dotFlash=0;
function hurtPlayerDOT(a){ if(G.over)return; G.hp-=a*(1-(G.defense||0)*0.5); dotFlash-=a;
  if(dotFlash<-6){ dotFlash=0; damageFlash(); } if(G.hp<=0)die(); }
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
function cleanup(){ for(const a of [enemies,critters]) for(let i=a.length-1;i>=0;i--) if(a[i].dead){ removeEnemyBar(a[i]); a.splice(i,1); }
  for(const a of [projectiles,particles,pickups,floaters]) for(let i=a.length-1;i>=0;i--) if(a[i].dead)a.splice(i,1); }

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
  if(trader)dot(trader.mesh.position.x,trader.mesh.position.z,'#5ad0ff',4);
  for(const c of critters){ if(!c.dead)dot(c.mesh.position.x,c.mesh.position.z,'#8fd06a',2); }
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
  sun.intensity=lerp(0.08,1.2,day);
  hemi.intensity=lerp(0.32,1.05,day);
  ambient.intensity=lerp(0.16,0.38,day);
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
  // вплив погоди на освітлення/туман
  if(G.weather!=='clear'){ const k=G.weather==='storm'?0.6:0.4;
    sun.intensity*=(1-k); hemi.intensity*=(1-k*0.6); ambient.intensity*=(1-k*0.3);
    const grey=new THREE.Color(0x4a525c);
    skyUniforms.top.value.lerp(grey,k); skyUniforms.bottom.value.lerp(new THREE.Color(0x6a727c),k);
    scene.fog.color.copy(skyUniforms.bottom.value); scene.fog.far=Settings.view*(G.weather==='storm'?0.55:0.78);
    lantern.intensity=Math.max(lantern.intensity,0.6);
  } else scene.fog.far=Settings.view;
  // годинник UI
  const hour=Math.floor(((G.time*24)+6)%24);
  const wIcon=G.weather==='storm'?'⛈️ Гроза':G.weather==='rain'?'🌧️ Дощ':(day>0.15?'☀️ День':'🌙 Ніч');
  document.getElementById('clockTxt').textContent=wIcon+' '+(hour<10?'0':'')+hour+':00';
  document.getElementById('clock').firstChild.textContent='';
}

/* ============================= ПОГОДА ============================= */
let lightningT=0;
function updateWeatherSystem(dt){
  G.weatherT-=dt;
  if(G.weatherT<=0){ const r=Math.random();
    G.weather = r<0.55?'clear' : r<0.85?'rain':'storm';
    G.weatherT = G.weather==='clear'?rand(40,80):rand(20,45);
    if(G.weather!=='clear')subtitle(G.weather==='storm'?'Насувається гроза…':'Починається дощ…');
  }
  if(G.weather!=='clear'){
    for(let i=0;i<(G.weather==='storm'?5:3);i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.5,0.03),
      new THREE.MeshBasicMaterial({color:0x9fb6d0,transparent:true,opacity:0.5}));
      m.position.set(player.pos.x+rand(-16,16),player.pos.y+rand(7,14),player.pos.z+rand(-16,16)); scene.add(m);
      particles.push({mesh:m,vel:new THREE.Vector3(rand(-1,1),-22,rand(-1,1)),life:0.7,grav:false}); }
  }
  if(G.weather==='storm'){ lightningT-=dt;
    if(lightningT<=0){ lightningT=rand(3,8); lightningFlash(); } }
}
function lightningFlash(){ const el=document.getElementById('dmgFlash');
  el.style.background='radial-gradient(rgba(255,255,255,.5), rgba(200,220,255,.25))'; el.style.opacity=1;
  setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>{ el.style.opacity=1; setTimeout(()=>{ el.style.opacity=0;
    el.style.background='radial-gradient(transparent 52%, rgba(150,0,0,.6))'; },80); },70); },60);
  Audio.blip(60,0.7,'sawtooth',0.4,1.5); Audio.noise(0.6,0.3,500);
  // удар блискавки поряд (візуальний стовп світла)
  if(Math.random()<0.6){ const lx=player.pos.x+rand(-20,20),lz=player.pos.z+rand(-20,20),gy=surfaceY(Math.floor(lx),Math.floor(lz));
    const bolt=new THREE.Mesh(new THREE.BoxGeometry(0.3,30,0.3),new THREE.MeshBasicMaterial({color:0xcfe0ff}));
    bolt.position.set(lx,gy+15,lz); bolt.add(makeGlow(0xaaccff,4)); scene.add(bolt);
    particles.push({mesh:bolt,vel:new THREE.Vector3(0,0,0),life:0.18,grav:false}); }
}

/* ============================= ХОДЬБА / КАМЕРА ============================= */
let walkPhase=0, saveAccum=0;
function update(dt){
  // реген
  G.sp=clamp(G.sp+18*dt,0,G.spMax); G.mp=clamp(G.mp+8*dt,0,G.mpMax);
  G.food=clamp(G.food-0.45*dt,0,G.foodMax);
  const fed=G.food>15;
  if(G.hp<G.hpMax&&fed)G.hp=clamp(G.hp+2.0*dt,0,G.hpMax);
  else if(!fed)G.hp=clamp(G.hp-0.7*dt,0,G.hpMax);          // голод шкодить
  playerSlow=Math.max(0,playerSlow-dt);
  // лава / вогонь
  const fb=getBlock(Math.floor(player.pos.x),Math.floor(player.pos.y),Math.floor(player.pos.z));
  const gb=getBlock(Math.floor(player.pos.x),Math.floor(player.pos.y-0.2),Math.floor(player.pos.z));
  if(fb===25||gb===25)G.onFire=Math.max(G.onFire,1.6);
  if(G.onFire>0){ G.onFire-=dt; hurtPlayerDOT(16*dt);
    if(Math.random()<0.5){ const m=makeGlow(0xff6622,0.5); m.position.set(camera.position.x+rand(-.4,.4),camera.position.y+rand(-.5,.3),camera.position.z+rand(-.4,.4));
      scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(0,1.2,0),life:0.5,grav:false}); } }
  updateWeatherSystem(dt);

  const running=(keys['ShiftLeft']||keys['ShiftRight'])&&G.sp>1;
  let speed=(running?7.2:4.6)*(1+0.12*PERK.swift)*(playerSlow>0?0.5:1);
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const mv=new THREE.Vector3();
  if(keys['KeyW'])mv.add(fwd); if(keys['KeyS'])mv.sub(fwd); if(keys['KeyD'])mv.add(right); if(keys['KeyA'])mv.sub(right);
  const moving=mv.lengthSq()>0;
  if(moving)mv.normalize().multiplyScalar(speed);
  player.vel.x=mv.x; player.vel.z=mv.z;
  if(running&&moving){ G.sp=clamp(G.sp-8*dt,0,G.spMax); G.food=clamp(G.food-0.4*dt,0,G.foodMax); }
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

  maybeSpawn(dt); maybeSpawnCritters(dt); updateMiniBoss(dt); updateEnemies(dt); updateCritters(dt);
  updateProjectiles(dt); updateExtras(dt); updateWeather(dt); cleanup();
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
  if(G.started&&!G.over&&!G.paused&&!skillsOpen&&!craftOpen&&!tradeOpen)update(dt);
  if(composer)composer.render(); else renderer.render(scene,camera);
  // viewmodel поверх
  renderer.autoClear=false; renderer.clearDepth();
  if(G.started&&!G.over)renderer.render(vmScene,vmCam);
  renderer.autoClear=true;
}

/* ============================= РЕСАЙЗ ============================= */
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  vmCam.aspect=innerWidth/innerHeight; vmCam.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);
  if(composer){ composer.setSize(innerWidth,innerHeight); resizeFXAA(); } });

/* ============================= СТАРТ ============================= */
function resetRun(){
  for(const en of enemies)removeEnemyBar(en); for(const c of critters)removeEnemyBar(c);
  for(const a of [enemies,critters,projectiles,particles,pickups]) for(const o of a) if(o.mesh)scene.remove(o.mesh);
  for(const f of floaters)f.el.remove();
  enemies.length=critters.length=projectiles.length=particles.length=pickups.length=floaters.length=0; dragon=null;
  Object.assign(G,{started:true,over:false,paused:false,hp:100,hpMax:100,mp:100,mpMax:100,sp:100,spMax:100,
    level:1,xp:0,xpNext:100,gold:0,perks:0,slot:0,shoutReady:0,kills:0,blocksMined:0,blocksPlaced:0,
    dragonSpawned:false,dragonDead:false,startTime:performance.now(),time:0.28,
    weapon:'iron_sword',armorItem:null,hasBow:false,defense:0,
    food:100,foodMax:100,onFire:0,weather:'clear',weatherT:25});
  for(const k in PERK)PERK[k]=0;
  for(const k in INV)delete INV[k];
  // стартові ресурси, щоб одразу можна було будувати
  addItem('stone',16); addItem('dirt',16); addItem('wood',12); addItem('torch',6); addItem('health_potion',1);
  QUESTS.forEach(q=>{q.done=false;q.prog=q.kind==='level'?1:0;});
  const sy=surfaceY(0,8)+2; player.pos.set(0,sy,8); player.vel.set(0,0,0); player.yaw=Math.PI; player.pitch=0;
  playerSlow=0; spawnTimer=3; critterTimer=2; saveAccum=0;
  document.getElementById('bossbar').style.display='none';
  buildHotbar(); renderQuests(); updateHUD(); updateResStrip(); updateGear();
  if(trader){ scene.remove(trader.mesh); trader=null; } spawnTrader();
  miniBossTimer=90; miniBossActive=false;
  spawnEnemy('bandit',10,0); spawnEnemy('draugr',-8,6);
  spawnCritter('deer',6,-6); spawnCritter('rabbit',-5,-4);
}
function applySave(sv){
  G.level=sv.level; G.xp=sv.xp; G.xpNext=sv.xpNext; G.gold=sv.gold; G.perks=sv.perks;
  G.hpMax=sv.hpMax; G.mpMax=sv.mpMax; G.spMax=sv.spMax; G.kills=sv.kills||0; G.dragonDead=!!sv.dragonDead;
  Object.assign(PERK,sv.perkLevels||{}); G.hp=G.hpMax; G.mp=G.mpMax; G.sp=G.spMax;
  if(sv.inv){ for(const k in INV)delete INV[k]; Object.assign(INV,sv.inv); }
  G.weapon=sv.weapon||'iron_sword'; G.armorItem=sv.armorItem||null; G.hasBow=!!sv.hasBow; G.defense=sv.defense||0;
  G.foodMax=sv.foodMax||100; G.food=sv.food!=null?sv.food:100;
  buildHotbar(); renderQuests(); updateHUD(); updateResStrip(); updateGear();
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
document.getElementById('closeCraft').onclick=toggleCraft;
document.getElementById('closeTrade').onclick=toggleTrade;

/* ============================= ІНІЦІАЛІЗАЦІЯ ============================= */
function init(){
  buildInstancedMeshes(); buildPlantMeshes(); setupComposer(); applyAllSettings();
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
