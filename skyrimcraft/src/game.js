/* =====================================================================
   SKYRIMCRAFT — справжній 3D action-RPG (Three.js)
   Гладкий ландшафт, шейдерна вода, low-poly 3D дерева/каміння/руда,
   інстансована трава з вітром, округлі 3D істоти, магія, день/ніч, погода.
   ===================================================================== */
(() => {
"use strict";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(e0,e1,x)=>{ const t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
const TAU=Math.PI*2;

/* ============================= АУДІО ============================= */
const Audio={ctx:null,master:null,
  init(){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.master=this.ctx.createGain(); this.master.gain.value=Settings.vol; this.master.connect(this.ctx.destination);}catch(e){} },
  blip(f,d,t,v,sl){ if(!this.ctx)return; const c=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=t||'square'; o.frequency.setValueAtTime(f,c); if(sl)o.frequency.exponentialRampToValueAtTime(Math.max(40,f*sl),c+d);
    g.gain.setValueAtTime(v||0.3,c); g.gain.exponentialRampToValueAtTime(0.001,c+d); o.connect(g); g.connect(this.master); o.start(c); o.stop(c+d); },
  noise(d,v,fl){ if(!this.ctx)return; const n=Math.floor(this.ctx.sampleRate*d),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),da=b.getChannelData(0);
    for(let i=0;i<n;i++)da[i]=(Math.random()*2-1)*(1-i/n); const s=this.ctx.createBufferSource(); s.buffer=b;
    const g=this.ctx.createGain(); g.gain.value=v||0.3; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fl||800;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(); },
  chop(){ this.noise(0.12,0.25,1400); this.blip(160,0.1,'square',0.15,0.5); },
  mine(){ this.noise(0.14,0.28,900); },
  place(){ this.blip(200,0.08,'square',0.25); },
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
  shoutReady:0,kills:0,harvested:0,startTime:0,time:0.30,seed:12345,
  weapon:'iron_sword',armorItem:null,hasBow:false,defense:0,
  food:100,foodMax:100,onFire:0,weather:'clear',weatherT:25,
  dragonSpawned:false,dragonDead:false};
const SHOUT_CD_BASE=6000;
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
  {name:'Лук',   icon:'🏹',type:'bow'},
  {name:'Факел', icon:'🔥',type:'torch'},
  {name:'Зілля', icon:'🧪',type:'potion'},
];

/* ============================= ПРЕДМЕТИ ============================= */
const ITEMS={
  wood:{n:'Деревина',i:'🪵'}, stick:{n:'Палиця',i:'🥢'}, stone:{n:'Камінь',i:'🪨'},
  coal:{n:'Вугілля',i:'⚫'}, iron:{n:'Залізо',i:'🔩'}, goldore:{n:'Золота руда',i:'🟡'}, gem:{n:'Самоцвіт',i:'💎'}, obsidian:{n:'Обсидіан',i:'🟪'},
  fiber:{n:'Волокно',i:'🌾'}, flower:{n:'Квіти',i:'🌸'}, mushroom:{n:'Гриб',i:'🍄'},
  meat:{n:'Сире м\'ясо',i:'🥩'}, cookedmeat:{n:'Печеня',i:'🍖'}, hide:{n:'Шкура',i:'🟤'}, feather:{n:'Перо',i:'🪶'}, bone:{n:'Кістка',i:'🦴'},
  torch:{n:'Факел',i:'🔥'}, arrow:{n:'Стріли',i:'➶'}, health_potion:{n:'Зілля',i:'🧪'}, mana_potion:{n:'Зілля мани',i:'🔮'},
  wood_sword:{n:'Дерев\'яний меч',i:'🗡️',weapon:18}, stone_sword:{n:'Кам\'яний меч',i:'⚔️',weapon:30},
  iron_sword:{n:'Залізний меч',i:'⚔️',weapon:44}, gem_sword:{n:'Самоцвітний меч',i:'🔪',weapon:64},
  war_axe:{n:'Бойова сокира',i:'🪓',weapon:82}, obsidian_sword:{n:'Обсидіановий меч',i:'🗡️',weapon:96},
  bow:{n:'Лук',i:'🏹',bow:true},
  leather_armor:{n:'Шкіряна броня',i:'🦺',armor:0.18}, iron_armor:{n:'Залізна броня',i:'🛡️',armor:0.35},
  gem_armor:{n:'Самоцвітна броня',i:'🛡️',armor:0.50}, obsidian_armor:{n:'Обсидіанова броня',i:'🛡️',armor:0.62},
};
const INV={};
function addItem(id,n){ INV[id]=(INV[id]||0)+(n||1); }
function itemCount(id){ return INV[id]||0; }
function hasItems(r){ for(const k in r)if((INV[k]||0)<r[k])return false; return true; }
function takeItems(r){ for(const k in r)INV[k]=(INV[k]||0)-r[k]; }
const RECIPES=[
  {out:'stick',n:4,req:{wood:1}},
  {out:'torch',n:4,req:{stick:1,coal:1}},
  {out:'cookedmeat',n:1,req:{meat:1,coal:1}},
  {out:'health_potion',n:1,req:{mushroom:2,flower:1}},
  {out:'mana_potion',n:1,req:{flower:2,gem:1}},
  {out:'arrow',n:6,req:{stick:1,feather:1,coal:1}},
  {out:'stone_sword',n:1,req:{stone:3,stick:1},gear:true},
  {out:'iron_sword',n:1,req:{iron:3,stick:1},gear:true},
  {out:'gem_sword',n:1,req:{gem:2,iron:2,stick:1},gear:true},
  {out:'war_axe',n:1,req:{iron:4,stick:2},gear:true},
  {out:'obsidian_sword',n:1,req:{obsidian:3,gem:1,stick:1},gear:true},
  {out:'bow',n:1,req:{stick:3,fiber:3},gear:true},
  {out:'leather_armor',n:1,req:{hide:5},gear:true},
  {out:'iron_armor',n:1,req:{iron:6,hide:2},gear:true},
  {out:'gem_armor',n:1,req:{gem:3,iron:3},gear:true},
  {out:'obsidian_armor',n:1,req:{obsidian:6,iron:2},gear:true},
];

/* ============================= НАЛАШТУВАННЯ / ЗБЕРЕЖЕННЯ ============================= */
const Settings={sens:1.0,vol:0.35,fov:75,view:170};
function loadSettings(){ try{ const s=JSON.parse(localStorage.getItem('skyrimcraft.settings')); if(s)Object.assign(Settings,s);}catch(e){} }
function saveSettings(){ try{ localStorage.setItem('skyrimcraft.settings',JSON.stringify(Settings)); }catch(e){} }
loadSettings();
function saveGame(){ try{ localStorage.setItem('skyrimcraft.save',JSON.stringify({
  level:G.level,xp:G.xp,xpNext:G.xpNext,gold:G.gold,perks:G.perks,hpMax:G.hpMax,mpMax:G.mpMax,spMax:G.spMax,
  kills:G.kills,seed:G.seed,dragonDead:G.dragonDead,perkLevels:{...PERK},inv:{...INV},
  weapon:G.weapon,armorItem:G.armorItem,hasBow:G.hasBow,defense:G.defense,food:G.food})); }catch(e){} }
function loadSave(){ try{ return JSON.parse(localStorage.getItem('skyrimcraft.save')); }catch(e){ return null; } }
function hasSave(){ return !!loadSave(); }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ============================= РЕНДЕР ============================= */
const canvas=document.getElementById('game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.96;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x9fc0e0,0.0042);
const camera=new THREE.PerspectiveCamera(Settings.fov,innerWidth/innerHeight,0.1,1200);

const vmScene=new THREE.Scene();
const vmCam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.01,10);
vmScene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.2));
const vmLight=new THREE.DirectionalLight(0xffffff,0.8); vmLight.position.set(1,2,2); vmScene.add(vmLight);

let composer=null,bloomPass=null;
function setupComposer(){ if(typeof THREE.EffectComposer!=='function'||typeof THREE.UnrealBloomPass!=='function'){console.warn('no bloom');return;}
  composer=new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene,camera));
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.5,0.55,0.9);
  bloomPass.renderToScreen=true; composer.addPass(bloomPass);
  composer.setSize(innerWidth,innerHeight); }

/* ---- світло ---- */
const sun=new THREE.DirectionalLight(0xfff1d4,1.1); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.near=1; sun.shadow.camera.far=260;
const SHR=70; sun.shadow.camera.left=-SHR; sun.shadow.camera.right=SHR; sun.shadow.camera.top=SHR; sun.shadow.camera.bottom=-SHR;
sun.shadow.bias=-0.0005; scene.add(sun); scene.add(sun.target);
const hemi=new THREE.HemisphereLight(0xbfe0ff,0x5a6a3a,0.85); scene.add(hemi);
const ambient=new THREE.AmbientLight(0xffffff,0.25); scene.add(ambient);
const moonLight=new THREE.DirectionalLight(0x9fb6e0,0); scene.add(moonLight);
const lantern=new THREE.PointLight(0xffcf8a,0,26,2); scene.add(lantern);

/* ============================= НЕБО ============================= */
const skyU={ top:{value:new THREE.Color(0x2f72c0)}, bottom:{value:new THREE.Color(0xcfe6ff)},
  sunDir:{value:new THREE.Vector3(0,1,0)}, sunCol:{value:new THREE.Color(0xfff2d6)} };
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,28,18), new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyU,
  vertexShader:`varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec3 vP; uniform vec3 top,bottom,sunDir,sunCol;
    void main(){ vec3 d=normalize(vP); float h=clamp(d.y*0.5+0.5,0.0,1.0); vec3 c=mix(bottom,top,pow(h,0.6));
      float s=clamp(dot(d,normalize(sunDir)),0.0,1.0); c+=sunCol*pow(s,520.0)*1.6; c+=sunCol*pow(s,9.0)*0.16; gl_FragColor=vec4(c,1.0);}`}));
scene.add(sky);
const moon=new THREE.Mesh(new THREE.SphereGeometry(16,18,18),new THREE.MeshBasicMaterial({color:0xdfe6f5,fog:false})); scene.add(moon);
const starGeo=new THREE.BufferGeometry(); { const N=900,a=new Float32Array(N*3);
  for(let i=0;i<N;i++){ const u=Math.random()*2-1,th=Math.random()*TAU,r=Math.sqrt(1-u*u);
    a[i*3]=r*Math.cos(th)*760; a[i*3+1]=Math.abs(u)*620+40; a[i*3+2]=r*Math.sin(th)*760; }
  starGeo.setAttribute('position',new THREE.BufferAttribute(a,3)); }
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xffffff,size:2.2,transparent:true,opacity:0,fog:false})); scene.add(stars);
const cloudTex=(()=>{ const s=64,c=document.createElement('canvas'); c.width=c.height=s; const x=c.getContext('2d');
  for(let i=0;i<46;i++){ const r=rand(6,16),px=rand(r,s-r),py=rand(r,s-r),g=x.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,TAU); x.fill(); }
  return new THREE.CanvasTexture(c); })();
const clouds=[]; for(let i=0;i<16;i++){ const s=rand(60,140), m=new THREE.Mesh(new THREE.PlaneGeometry(s,s*0.6),
  new THREE.MeshBasicMaterial({map:cloudTex,transparent:true,opacity:0.55,depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(rand(-400,400),rand(120,180),rand(-400,400)); scene.add(m); clouds.push(m); }
const glowTex=(()=>{ const s=64,c=document.createElement('canvas'); c.width=c.height=s; const x=c.getContext('2d');
  const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.4,'rgba(255,255,255,.5)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,s,s); return new THREE.CanvasTexture(c); })();
function makeGlow(col,sz){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true})); sp.scale.setScalar(sz||2); return sp; }

/* ============================= ШУМ / ЛАНДШАФТ ============================= */
let RNG=Math.random, NSEED=12345;
function ihash(x,z){ let n=(x|0)*374761393+(z|0)*668265263+NSEED*982451653; n=(n^(n>>>13))>>>0; n=Math.imul(n,1274126177); return ((n^(n>>>16))>>>0)/4294967296; }
function vnoise(x,z){ const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
  const u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  const a=ihash(xi,zi),b=ihash(xi+1,zi),c=ihash(xi,zi+1),d=ihash(xi+1,zi+1);
  return lerp(lerp(a,b,u),lerp(c,d,u),v); }
function fbm(x,z){ let s=0,amp=0.5,f=1; for(let o=0;o<4;o++){ s+=vnoise(x*f,z*f)*amp; f*=2; amp*=0.5; } return s; }
const WORLD_R=110, SEA=0;
// спеціальні зони
let volcano=[0,0], swampC=[0,0];
function terrainHeight(x,z){
  const d=Math.hypot(x,z);
  let h=(fbm(x*0.012+10,z*0.012+10)-0.42)*46;          // пагорби
  h+=Math.pow(clamp(fbm(x*0.0055-30,z*0.0055-30),0,1),2.2)*70;  // гори
  h-=smooth(WORLD_R*0.72,WORLD_R*1.08,d)*70;            // береги тонуть → острів
  // вулкан: конус
  const vd=Math.hypot(x-volcano[0],z-volcano[1]);
  if(vd<34){ h+=smooth(34,6,vd)*46; if(vd<5)h-=smooth(5,0,vd)*10; }   // кратер
  // болото: западина
  const sd=Math.hypot(x-swampC[0],z-swampC[1]);
  if(sd<30)h-=smooth(30,8,sd)*8;
  // рівний центр (вівтар)
  if(d<16)h=lerp(h,6,smooth(16,3,d));
  return h;
}
function surfaceY(x,z){ return terrainHeight(x,z); }
function biomeAt(x,z){
  const d=Math.hypot(x,z); if(Math.hypot(x-volcano[0],z-volcano[1])<26)return 'volcano';
  if(Math.hypot(x-swampC[0],z-swampC[1])<24)return 'swamp';
  const h=terrainHeight(x,z);
  if(h<SEA+1.2)return 'beach'; if(h>34)return 'snow';
  const m=fbm(x*0.02+99,z*0.02+99);
  if(m>0.58)return 'forest'; if(m<0.36)return 'desert'; return d<46&&m>0.5?'meadow':'plains';
}

/* ---- детальна текстура ґрунту ---- */
function detailTex(){ const s=128,c=document.createElement('canvas'); c.width=c.height=s; const x=c.getContext('2d');
  const img=x.createImageData(s,s),dt=img.data;
  // субтильна варіація навколо ~0.82 (трохи затемнює й додає фактуру, без вибілювання)
  for(let i=0;i<s*s;i++){ const n=185+Math.random()*40; dt[i*4]=dt[i*4+1]=dt[i*4+2]=n; dt[i*4+3]=255; }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(60,60); return t; }

/* ---- кольори біомів (для вершинних кольорів) ---- */
const C={ sand:new THREE.Color(0xcdb98a), grass:new THREE.Color(0x5f9e44), grassDry:new THREE.Color(0x9aa055),
  rock:new THREE.Color(0x7d7468), snow:new THREE.Color(0xeef4fb), swamp:new THREE.Color(0x4a5a38),
  ash:new THREE.Color(0x423a40), meadow:new THREE.Color(0x6db84a), deep:new THREE.Color(0x355e7a) };
const _c1=new THREE.Color(),_c2=new THREE.Color();
function colorAt(x,z,h,slope){
  _c1.set(0,0,0);
  if(h<SEA-3){ _c1.copy(C.deep); return _c1; }
  if(h<SEA+1.4){ _c1.copy(C.sand); return _c1; }
  // вулкан
  if(Math.hypot(x-volcano[0],z-volcano[1])<26){ _c1.copy(C.ash); _c1.lerp(new THREE.Color(0x2a242a),clamp(slope,0,1)); return _c1; }
  if(Math.hypot(x-swampC[0],z-swampC[1])<24){ _c1.copy(C.swamp); return _c1; }
  const m=fbm(x*0.02+99,z*0.02+99);
  _c1.copy(C.grass).lerp(C.grassDry,clamp((0.5-m)*2,0,1));
  if(m>0.6)_c1.lerp(C.meadow,0.4);
  _c1.lerp(C.rock,smooth(0.45,0.8,slope));            // схили — скеля
  if(h>30)_c1.lerp(C.snow,smooth(30,40,h)*(1-smooth(0.6,0.9,slope)*0.5));
  // легка варіація
  const v=(vnoise(x*0.3,z*0.3)-0.5)*0.08; _c1.r=clamp(_c1.r+v,0,1); _c1.g=clamp(_c1.g+v,0,1); _c1.b=clamp(_c1.b+v,0,1);
  return _c1;
}

/* ---- меш ландшафту ---- */
let terrain=null;
const TSIZE=300, TSEG=190;
function buildTerrain(){
  if(terrain){ scene.remove(terrain); terrain.geometry.dispose(); }
  const g=new THREE.PlaneGeometry(TSIZE,TSIZE,TSEG,TSEG); g.rotateX(-Math.PI/2);
  const pos=g.attributes.position, n=pos.count;
  for(let i=0;i<n;i++){ const x=pos.getX(i),z=pos.getZ(i); pos.setY(i,terrainHeight(x,z)); }
  g.computeVertexNormals();
  const colors=new Float32Array(n*3), nrm=g.attributes.normal;
  for(let i=0;i<n;i++){ const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i); const slope=1-nrm.getY(i);
    const col=colorAt(x,z,y,slope); colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b; }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.96,metalness:0,
    map:detailTex()}); mat.map.encoding=THREE.LinearEncoding;
  terrain=new THREE.Mesh(g,mat); terrain.receiveShadow=true; terrain.castShadow=false; scene.add(terrain);
}

/* ============================= ВОДА ============================= */
let water=null, waterU=null;
function buildWater(){
  if(water)scene.remove(water);
  waterU={ uTime:{value:0}, uSun:{value:new THREE.Vector3()}, uShallow:{value:new THREE.Color(0x4db0c8)}, uDeep:{value:new THREE.Color(0x14506e)}, uCam:{value:new THREE.Vector3()} };
  const mat=new THREE.ShaderMaterial({ transparent:true, uniforms:waterU,
    vertexShader:`uniform float uTime; varying vec3 vW; varying vec3 vN;
      void main(){ vec3 p=position;
        float w=sin(p.x*0.12+uTime*1.2)*0.35+cos(p.z*0.15+uTime*1.5)*0.3+sin((p.x+p.z)*0.07+uTime)*0.25;
        p.z+=w; // площина повернута, z = висота
        vec4 wp=modelMatrix*vec4(p,1.0); vW=wp.xyz;
        float dx=cos(p.x*0.12+uTime*1.2)*0.12*0.35; float dz=-sin(p.z*0.15+uTime*1.5)*0.15*0.3;
        vN=normalize(vec3(-dx,1.0,-dz));
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`uniform vec3 uSun,uShallow,uDeep,uCam; varying vec3 vW; varying vec3 vN;
      void main(){ vec3 V=normalize(uCam-vW); float fres=pow(1.0-max(dot(V,vN),0.0),3.0);
        vec3 col=mix(uDeep,uShallow,clamp(fres+0.25,0.0,1.0));
        vec3 H=normalize(normalize(uSun)+V); float spec=pow(max(dot(vN,H),0.0),120.0);
        col+=vec3(1.0,0.96,0.85)*spec*1.4;
        gl_FragColor=vec4(col,0.82); }`});
  const g=new THREE.PlaneGeometry(TSIZE*1.4,TSIZE*1.4,80,80); g.rotateX(-Math.PI/2);
  water=new THREE.Mesh(g,mat); water.position.y=SEA-0.15; scene.add(water);
}

/* ============================= РОСЛИННІСТЬ / РЕСУРСИ ============================= */
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.9,metalness:0},o||{}));
const nodes=[];                       // дерева/каміння/руда (рубати)
const gathers=[];                     // квіти/гриби (збір E)
// дерево
function makeTree(kind){
  const g=new THREE.Group();
  if(kind==='pine'){ const th=rand(5,8);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.35,th,7),M(0x6b4a2c)); trunk.position.y=th/2; trunk.castShadow=true; g.add(trunk);
    for(let i=0;i<4;i++){ const r=2.2-i*0.45, hc=2.0; const cn=new THREE.Mesh(new THREE.ConeGeometry(r,hc,9),M(0x2f6a40)); cn.position.y=th*0.5+i*1.2; cn.castShadow=true; g.add(cn); } }
  else if(kind==='birch'){ const th=rand(6,8);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,th,7),M(0xe6e2d4)); trunk.position.y=th/2; trunk.castShadow=true; g.add(trunk);
    const f=new THREE.Mesh(new THREE.IcosahedronGeometry(2.0,0),M(0x8fc24a)); f.position.y=th; f.scale.y=1.3; f.castShadow=true; g.add(f); }
  else { const th=rand(4,6);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.45,th,7),M(0x7a5535)); trunk.position.y=th/2; trunk.castShadow=true; g.add(trunk);
    for(let i=0;i<3;i++){ const f=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.8,2.5),0),M(0x4f9e3e));
      f.position.set(rand(-1,1),th+rand(-0.3,1),rand(-1,1)); f.castShadow=true; g.add(f); } }
  return g;
}
function makeRock(){ const g=new THREE.Group(); const r=rand(0.8,1.7);
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),M(0x7d7468,{flatShading:true,roughness:1})); m.position.y=r*0.5; m.rotation.set(rand(0,3),rand(0,3),rand(0,3)); m.castShadow=true; g.add(m); return g; }
function makeOre(type){ const g=makeRock();
  const col={coal:0x2a2a2a,iron:0xc89878,gem:0x4fd0e0,goldore:0xe8c24a,obsidian:0x3a2f50}[type]||0xffffff;
  for(let i=0;i<5;i++){ const cr=new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.18,0.32),0),
      new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.5,roughness:0.4,metalness:0.4}));
    cr.position.set(rand(-0.7,0.7),rand(0.3,1.1),rand(-0.7,0.7)); g.add(cr); }
  g.add(makeGlow(col,1.4)); return g;
}
function addNode(type,x,z,kind){ const y=terrainHeight(x,z); const isTree=type==='tree';
  const mesh=type==='tree'?makeTree(kind):type==='ore'?makeOre(kind):makeRock();
  mesh.position.set(x,y,z); mesh.rotation.y=rand(0,TAU); scene.add(mesh);
  nodes.push({type,kind,mesh,x,z,y,hp:isTree?3:type==='ore'?4:2,maxhp:isTree?3:type==='ore'?4:2,dead:false,respawn:0,shake:0,baseRot:mesh.rotation.y}); }
// квіти/гриби (збір)
function makeFlower(col){ const g=new THREE.Group();
  const st=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.4,4),M(0x3f8a3a)); st.position.y=0.2; g.add(st);
  const h=new THREE.Mesh(new THREE.IcosahedronGeometry(0.13,0),M(col)); h.position.y=0.42; g.add(h); return g; }
function makeMushroom(){ const g=new THREE.Group();
  const st=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,0.25,5),M(0xe8e0d0)); st.position.y=0.12; g.add(st);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6,0,TAU,0,Math.PI/2),M(0xc0392b)); cap.position.y=0.24; g.add(cap); return g; }
function addGather(type,x,z){ const y=terrainHeight(x,z);
  const mesh=type==='mushroom'?makeMushroom():makeFlower(type==='flower_y'?0xe8c24a:0xd23b3b);
  mesh.position.set(x,y,z); scene.add(mesh);
  gathers.push({type:type==='mushroom'?'mushroom':'flower',mesh,x,z,dead:false}); }

/* ---- трава (інстанс + вітер) ---- */
let grass=null; const windU=[];
function buildGrass(){
  if(grass)scene.remove(grass);
  const blade=new THREE.PlaneGeometry(0.5,0.7); blade.translate(0,0.35,0);
  const geo=new THREE.BufferGeometry();
  // хрест із двох площин
  const g2=blade.clone(); g2.rotateY(Math.PI/2);
  const merged=mergeGeo([blade,g2]);
  const mat=new THREE.MeshStandardMaterial({color:0x5fa83e,side:THREE.DoubleSide,roughness:1,
    alphaTest:0.4,transparent:true,map:bladeTex()});
  mat.onBeforeCompile=(sh)=>{ sh.uniforms.uTime={value:0}; windU.push(sh.uniforms.uTime);
    sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float ph=instanceMatrix[3][0]*0.5+instanceMatrix[3][2]*0.5;
       float sway=sin(uTime*1.6+ph)*0.12*position.y;
       transformed.x+=sway; transformed.z+=sway*0.5;`); };
  const N=4200; const im=new THREE.InstancedMesh(merged,mat,N); im.receiveShadow=true;
  const mtx=new THREE.Matrix4(); let cnt=0;
  for(let i=0;i<N;i++){ const a=Math.random()*TAU,r=Math.sqrt(Math.random())*WORLD_R*0.95;
    const x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z); if(y<SEA+1)continue;
    const bm=biomeAt(x,z); if(bm==='snow'||bm==='volcano'||bm==='desert'||bm==='beach')continue;
    const s=rand(0.7,1.4); mtx.makeRotationY(rand(0,TAU)); mtx.scale(new THREE.Vector3(s,s,s)); mtx.setPosition(x,y,z);
    im.setMatrixAt(cnt++,mtx); }
  im.count=cnt; im.instanceMatrix.needsUpdate=true; grass=im; scene.add(im);
}
function bladeTex(){ const w=16,h=16,c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d');
  x.clearRect(0,0,w,h); for(let i=0;i<w;i++){ const tall=h-Math.floor(Math.random()*4); x.fillStyle=Math.random()<0.5?'#5aa83a':'#6cb84a';
    x.fillRect(i,h-tall,1,tall); } const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; return t; }
// проста злийка геометрій (позиції+uv+нормалі)
function mergeGeo(list){ let vc=0,ic=0; for(const g of list){ vc+=g.attributes.position.count; ic+=g.index?g.index.count:g.attributes.position.count; }
  const pos=new Float32Array(vc*3),uv=new Float32Array(vc*2),nor=new Float32Array(vc*3),idx=new Uint16Array(ic);
  let vo=0,io=0; for(const g of list){ const p=g.attributes.position,u=g.attributes.uv,nn=g.attributes.normal,id=g.index;
    for(let i=0;i<p.count;i++){ pos[(vo+i)*3]=p.getX(i); pos[(vo+i)*3+1]=p.getY(i); pos[(vo+i)*3+2]=p.getZ(i);
      uv[(vo+i)*2]=u.getX(i); uv[(vo+i)*2+1]=u.getY(i); nor[(vo+i)*3]=nn.getX(i); nor[(vo+i)*3+1]=nn.getY(i); nor[(vo+i)*3+2]=nn.getZ(i); }
    if(id){ for(let i=0;i<id.count;i++)idx[io+i]=vo+id.getX(i); io+=id.count; } vo+=p.count; }
  const G2=new THREE.BufferGeometry(); G2.setAttribute('position',new THREE.BufferAttribute(pos,3));
  G2.setAttribute('uv',new THREE.BufferAttribute(uv,2)); G2.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  G2.setIndex(new THREE.BufferAttribute(idx,1)); return G2; }

/* ============================= ГЕНЕРАЦІЯ СВІТУ ============================= */
const chests=[];
function makeChest(x,z){ const y=terrainHeight(x,z),g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.55,0.55),M(0x6a4a28)); base.position.y=0.28; base.castShadow=true;
  const lid=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.2,0.57),M(0x7a5a32)); lid.position.y=0.62;
  const lock=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.18,0.06),M(0xe8c66a)); lock.position.set(0,0.45,0.29);
  g.add(base,lid,lock,makeGlow(0xe8c66a,1.1)); g.position.set(x,y,z); g.rotation.y=rand(0,TAU); scene.add(g);
  chests.push({mesh:g,lid,taken:false,gold:randi(40,110)}); }
let altar=null, towerGroup=null;
function buildLandmarks(){
  // вежа-кільце
  towerGroup=new THREE.Group();
  for(let a=0;a<TAU;a+=0.5){ const r=4.5,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z);
    const hgt=rand(3,6),p=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,hgt,6),M(0x8a8278,{roughness:1})); p.position.set(x,y+hgt/2,z); p.castShadow=true; towerGroup.add(p); }
  scene.add(towerGroup);
  const ay=terrainHeight(0,0); altar=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.7,1.0,8),M(0x6a6258,{roughness:1})); base.position.y=0.5; base.castShadow=true; altar.add(base);
  const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.5,1),new THREE.MeshStandardMaterial({color:0xffb24a,emissive:0xff7a1a,emissiveIntensity:1.4,roughness:0.3}));
  orb.position.y=1.6; altar.add(orb); altar.add(makeGlow(0xffaa44,3)); altar.userData.orb=orb; altar.position.set(0,ay,0); scene.add(altar);
}
function generateWorld(){
  // спецзони (подалі від центру)
  const far=()=>{ let x,z; do{ const a=RNG()*TAU,r=rand(WORLD_R*0.45,WORLD_R*0.8); x=Math.cos(a)*r; z=Math.sin(a)*r; }while(Math.hypot(x,z)<36); return [Math.round(x),Math.round(z)]; };
  volcano=far(); swampC=far();
  buildTerrain(); buildWater(); buildLandmarks(); buildGrass();
  // дерева
  for(let i=0;i<420;i++){ const a=RNG()*TAU,r=Math.sqrt(RNG())*WORLD_R*0.95,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z);
    if(y<SEA+1||Math.hypot(x,z)<14)continue; const bm=biomeAt(x,z); if(bm==='beach'||bm==='desert'||bm==='volcano')continue;
    if(bm==='snow'&&RNG()>0.5)continue;
    const kind=bm==='snow'?'pine':(RNG()<0.3?'birch':(RNG()<0.5?'pine':'oak')); addNode('tree',x,z,kind); }
  // каміння
  for(let i=0;i<150;i++){ const a=RNG()*TAU,r=Math.sqrt(RNG())*WORLD_R*0.95,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z);
    if(y<SEA+0.5||Math.hypot(x,z)<12)continue; addNode('rock',x,z); }
  // руда
  const ores=['coal','iron','iron','gem','goldore','obsidian'];
  for(let i=0;i<60;i++){ const a=RNG()*TAU,r=Math.sqrt(RNG())*WORLD_R*0.92,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z);
    if(y<SEA+0.5||Math.hypot(x,z)<14)continue; let kind=ores[(RNG()*ores.length)|0];
    if(biomeAt(x,z)==='volcano'&&RNG()<0.6)kind='obsidian'; addNode('ore',x,z,kind); }
  // квіти/гриби
  for(let i=0;i<260;i++){ const a=RNG()*TAU,r=Math.sqrt(RNG())*WORLD_R*0.9,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z);
    if(y<SEA+1)continue; const bm=biomeAt(x,z); if(bm==='beach'||bm==='desert'||bm==='snow')continue;
    const ty=bm==='forest'||bm==='swamp'?(RNG()<0.5?'mushroom':'flower_r'):(RNG()<0.5?'flower_r':'flower_y'); addGather(ty,x,z); }
  // скрині
  for(let i=0;i<8;i++){ const a=RNG()*TAU,r=rand(20,WORLD_R*0.85),x=Math.cos(a)*r,z=Math.sin(a)*r; if(terrainHeight(x,z)>SEA+1)makeChest(x,z); }
}
function clearWorld(){
  for(const n of nodes)scene.remove(n.mesh); nodes.length=0;
  for(const g of gathers)scene.remove(g.mesh); gathers.length=0;
  for(const c of chests)scene.remove(c.mesh); chests.length=0;
  if(trader){scene.remove(trader.mesh);trader=null;}
  for(const c of critters){scene.remove(c.mesh); removeBar(c);} critters.length=0;
}
function regenerateWorld(seed){ G.seed=seed; NSEED=seed|0; RNG=mulberry32(seed); clearWorld(); generateWorld(); }

/* ============================= ГРАВЕЦЬ ============================= */
const player={pos:new THREE.Vector3(0,20,12),vel:new THREE.Vector3(),onGround:false,yaw:Math.PI,pitch:0,eye:1.7};
function lookDir(){ return new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ')).normalize(); }
let viewmodel,swordSwing=0,walkPhase=0;
function buildViewmodel(){ viewmodel=new THREE.Group();
  const hand=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.5,10),M(0xc9a98a)); hand.rotation.x=1.4; hand.position.set(0.32,-0.28,-0.55); viewmodel.add(hand);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.75),new THREE.MeshStandardMaterial({color:0xcfd6dd,roughness:0.25,metalness:0.85})); blade.position.set(0.32,-0.16,-0.98);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.05,0.06),M(0x8a6a3a)); guard.position.set(0.32,-0.2,-0.62);
  viewmodel.swordParts=[blade,guard]; viewmodel.add(blade,guard); viewmodel.hand=hand; vmScene.add(viewmodel); }
function updateViewmodel(){ if(!viewmodel)return; const showSword=HOTBAR[G.slot].type==='weapon'; viewmodel.swordParts.forEach(p=>p.visible=showSword);
  const bob=Math.sin(walkPhase)*0.02; let sw=swordSwing>0?Math.sin((1-swordSwing)*Math.PI)*1.4:0;
  viewmodel.rotation.set(sw*0.6,-sw*0.4,0); viewmodel.position.set(0,bob,0); }

/* ============================= ВВІД ============================= */
const keys={}; let pointerLocked=false;
addEventListener('keydown',e=>{ keys[e.code]=true; if(e.code==='Escape'){ if(G.started&&!G.over)togglePause(); return; }
  if(!G.started||G.over||G.paused)return;
  if(e.code>='Digit1'&&e.code<='Digit4')selectSlot(+e.code.slice(5)-1);
  if(e.code==='KeyQ')doShout(); if(e.code==='KeyF')castFire(); if(e.code==='KeyR')castFrost();
  if(e.code==='KeyV')castLightning(); if(e.code==='KeyH')castHeal(); if(e.code==='KeyZ')whirlwind();
  if(e.code==='KeyG')shootBow(); if(e.code==='KeyE')interact(); if(e.code==='KeyP')toggleSkills(); if(e.code==='KeyC')toggleCraft(); });
addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('click',()=>{ if(G.started&&!G.over&&!G.paused&&!pointerLocked)canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===canvas);
document.addEventListener('mousemove',e=>{ if(!pointerLocked)return; const s=0.0022*Settings.sens; player.yaw-=e.movementX*s; player.pitch=clamp(player.pitch-e.movementY*s,-1.5,1.5); });
document.addEventListener('mousedown',e=>{ if(!G.started||G.over||G.paused||!pointerLocked)return; if(e.button===0)primary(); if(e.button===2)placeTorch(); });
addEventListener('contextmenu',e=>e.preventDefault());

/* ============================= ДІЇ / ЗБІР ============================= */
function nearestInFront(list,reach,dotMin){ const dir=lookDir(); let best=null,bd=reach;
  for(const o of list){ if(o.dead)continue; const m=o.mesh.position; const to=new THREE.Vector3(m.x,m.y+1,m.z).sub(camera.position); const d=to.length();
    if(d>reach)continue; to.normalize(); if(to.dot(dir)>dotMin&&d<bd){bd=d;best=o;} } return best; }
function primary(){ if(HOTBAR[G.slot].type==='weapon'){ // спершу ворог, інакше рубаємо ноду
    const en=targetEnemy(3.6); if(en){ swingSword(en); return; } }
  const n=nearestInFront(nodes,4.2,0.5); if(n){ harvest(n); return; }
  if(HOTBAR[G.slot].type==='weapon')swingSword(null); }
function harvest(n){ if(n.dead)return; swordSwing=1; n.shake=0.3; n.hp--; Audio[n.type==='tree'?'chop':'mine']();
  spawnChips(n.mesh.position, n.type==='tree'?0x6b4a2c:0x8a8278);
  if(n.hp<=0){ n.dead=true; n.mesh.visible=false; n.respawn=35+Math.random()*25; G.harvested++;
    const p=n.mesh.position.clone(); p.y+=1; const f=1+0.25*PERK.fortune;
    if(n.type==='tree'){ gotItem('wood',randi(2,4),p); if(Math.random()<0.3)gotItem('fiber',1); gainXP(6); }
    else if(n.type==='rock'){ gotItem('stone',randi(2,4),p); if(Math.random()<0.4)gotItem('coal',1); gainXP(6); }
    else { const drop=n.kind==='goldore'?'goldore':n.kind; gotItem(drop,randi(1,3),p); if(n.kind==='goldore'){const g=randi(8,18);G.gold+=g;floatText(p,'+'+g+'💰','#e8c66a');} gainXP(14); }
    questProgress('harvest'); } }
function placeTorch(){ if(itemCount('torch')<=0){ toast('Немає факелів (крафт C)'); return; }
  takeItems({torch:1}); const dir=lookDir(); const p=camera.position.clone().add(dir.multiplyScalar(2.2)); p.y=terrainHeight(p.x,p.z);
  const g=new THREE.Group(); const st=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,1.0,6),M(0x6a4a2c)); st.position.y=0.5;
  const fl=new THREE.Mesh(new THREE.IcosahedronGeometry(0.2,0),new THREE.MeshStandardMaterial({color:0xffb24a,emissive:0xff7a1a,emissiveIntensity:1.6})); fl.position.y=1.05;
  const lt=new THREE.PointLight(0xffb060,1.4,12,2); lt.position.y=1.1; g.add(st,fl,lt,makeGlow(0xffaa44,1.6)); g.position.copy(p); scene.add(g);
  Audio.place(); buildHotbar(); updateResStrip(); }
function gotItem(id,n,p){ addItem(id,n||1); if(p)floatText(p,'+'+(n||1)+' '+(ITEMS[id]?ITEMS[id].i:''),'#cfe6a0'); updateResStrip(); }
function interact(){
  if(trader&&trader.mesh.position.distanceTo(camera.position)<3.4){ toggleTrade(); return; }
  for(const g of gathers){ if(g.dead)continue; if(g.mesh.position.distanceTo(camera.position)<2.6){ g.dead=true; scene.remove(g.mesh);
    gotItem(g.type==='mushroom'?'mushroom':'flower',1,g.mesh.position.clone().add(new THREE.Vector3(0,1,0))); questProgress('gather'); return; } }
  for(const c of chests){ if(c.taken)continue; if(c.mesh.position.distanceTo(camera.position)<3){ c.taken=true; c.lid.rotation.x=-1.1;
    const g=Math.round(c.gold*(1+0.25*PERK.fortune)); G.gold+=g; Audio.gold(); gainXP(20);
    floatText(c.mesh.position.clone().add(new THREE.Vector3(0,1.2,0)),'Скарб: +'+g+'💰','#e8c66a'); toast('Знайдено скарб!'); return; } }
  if(!G.dragonSpawned&&Math.hypot(player.pos.x,player.pos.z)<6){ if(G.level>=3)summonDragon(); else toast('Вівтар мовчить. Потрібен 3 рівень.'); }
}

/* ============================= БІЙ / МАГІЯ ============================= */
function targetEnemy(reach){ const dir=lookDir(); let best=null,bd=reach;
  for(const en of enemies.concat(critters)){ if(en.dead)continue; const to=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.5:1,0)).sub(camera.position);
    const d=to.length(); if(d>reach)continue; to.normalize(); if(to.dot(dir)>0.5&&d<bd){bd=d;best=en;} } return best; }
function weaponDamage(){ const w=ITEMS[G.weapon]; return ((w&&w.weapon||18)+G.level*3)*(1+0.2*PERK.might); }
function swingSword(target){ if(G.sp<8)return; G.sp-=8; swordSwing=1; Audio.sword();
  const en=target||targetEnemy(3.6); if(en){ damageEnemy(en,weaponDamage()); hitSpark(en.mesh.position); Audio.hit(); } }
function shootBow(){ if(!G.hasBow){toast('Скрафти лук (C)');return;} if(itemCount('arrow')<=0){toast('Немає стріл');return;}
  takeItems({arrow:1}); updateResStrip(); Audio.sword(); const dir=lookDir(),o=camera.position.clone();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,5),M(0x8a6a3a)); m.rotation.x=Math.PI/2; m.position.copy(o); scene.add(m);
  projectiles.push({pos:o,vel:dir.clone().multiplyScalar(46),life:2.5,dmg:(28+G.level*5)*(1+0.2*PERK.might),friendly:true,kind:'arrow',mesh:m}); }
function ensureMana(c){ if(G.mp>=c)return true; if(itemCount('mana_potion')>0){ takeItems({mana_potion:1}); G.mp=clamp(G.mp+70,0,G.mpMax); buildHotbar(); updateResStrip(); floatText(camera.position,'+70 🔮','#9fb6ff'); return G.mp>=c; } toast('Недостатньо мани'); return false; }
function makeOrb(p,col){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.25,10,10),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.3,roughness:0.4})); m.add(makeGlow(col,2.2)); m.position.copy(p); scene.add(m); return m; }
function castFire(){ const c=Math.round(20*(1-0.1*PERK.destruction)); if(!ensureMana(c))return; G.mp-=c; Audio.fire(); const d=lookDir(),o=camera.position.clone();
  projectiles.push({pos:o,vel:d.clone().multiplyScalar(32),life:1.6,dmg:(30+G.level*5)*(1+0.2*PERK.destruction),friendly:true,kind:'fire',mesh:makeOrb(o,0xff7722)}); subtitle("Yol! — Полум'я"); }
function castFrost(){ const c=Math.round(18*(1-0.1*PERK.destruction)); if(!ensureMana(c))return; G.mp-=c; Audio.frost(); const d=lookDir(),o=camera.position.clone();
  projectiles.push({pos:o,vel:d.clone().multiplyScalar(36),life:1.5,dmg:(20+G.level*4)*(1+0.2*PERK.destruction),friendly:true,kind:'frost',slow:true,mesh:makeOrb(o,0x88ddff)}); subtitle('Fo! — Лід'); }
function castLightning(){ const c=Math.round(28*(1-0.1*PERK.destruction)); if(!ensureMana(c))return; G.mp-=c; Audio.blip(1200,0.2,'sawtooth',0.3,0.4); Audio.noise(0.2,0.2,3000);
  const dmg=(26+G.level*5)*(1+0.2*PERK.destruction); const dir=lookDir(); let from=camera.position.clone(); const hit=[]; const pool=enemies.concat(critters).filter(e=>!e.dead);
  for(let n=0;n<3;n++){ let best=null,bd=20; for(const en of pool){ if(hit.includes(en))continue; const to=en.mesh.position.clone().add(new THREE.Vector3(0,1,0)).sub(from); const d=to.length();
    if(d<bd&&(n>0||to.clone().normalize().dot(dir)>0.4)){bd=d;best=en;} } if(!best)break; hit.push(best); const tp=best.mesh.position.clone().add(new THREE.Vector3(0,1,0)); bolt(from,tp); damageEnemy(best,dmg*(1-n*0.2)); hitSpark(best.mesh.position); from=tp; }
  if(!hit.length)bolt(camera.position.clone(),camera.position.clone().add(dir.clone().multiplyScalar(14))); subtitle('Strun! — Блискавка'); flash('rgba(160,200,255,.4)'); }
function bolt(a,b){ const mid=a.clone().add(b).multiplyScalar(0.5),len=a.distanceTo(b); const m=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,len),new THREE.MeshBasicMaterial({color:0xcfe0ff})); m.position.copy(mid); m.lookAt(b); m.add(makeGlow(0xaaccff,1.6)); scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(),life:0.15,grav:false}); }
function castHeal(){ const c=Math.round(30*(1-0.1*PERK.destruction)); if(!ensureMana(c))return; if(G.hp>=G.hpMax){toast('Здоров\'я повне');return;} G.mp-=c; const amt=40+G.level*4; G.hp=clamp(G.hp+amt,0,G.hpMax); G.onFire=0; Audio.gold(); floatText(camera.position,'+'+amt+' ♥','#7af0a0'); subtitle('Grah! — Лікування'); updateHUD();
  for(let i=0;i<8;i++){ const m=makeGlow(0x7af0a0,0.4); m.position.set(camera.position.x+rand(-.5,.5),camera.position.y+rand(-1,.5),camera.position.z+rand(-.5,.5)); scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(0,1.5,0),life:0.6,grav:false}); } }
let sprintReady=0;
function whirlwind(){ if(performance.now()<sprintReady){toast('Ривок перезаряджається');return;} if(G.sp<25){toast('Замало витривалості');return;} G.sp-=25; sprintReady=performance.now()+4000;
  const d=lookDir(); d.y=0; d.normalize(); player.vel.x+=d.x*26; player.vel.z+=d.z*26; player.vel.y=4; Audio.shout(); subtitle('WULD! — Ривок'); flash('rgba(180,220,255,.35)'); }
function doShout(){ const cd=SHOUT_CD_BASE-PERK.thuum*1000; if(performance.now()<G.shoutReady){toast('Крик ще не готовий');return;} G.shoutReady=performance.now()+cd; Audio.shout(); subtitle('FUS RO DAH!'); flash('rgba(80,140,220,.55)');
  const dir=lookDir(); for(const en of enemies){ if(en.dead)continue; const to=en.mesh.position.clone().sub(camera.position); const d=to.length(); if(d<16&&to.clone().normalize().dot(dir)>0.35){ en.vel.add(to.normalize().multiplyScalar(20)); en.vel.y=9; damageEnemy(en,16); } } }
function drinkPotion(){ if(itemCount('health_potion')>0){ takeItems({health_potion:1}); G.hp=clamp(G.hp+60,0,G.hpMax); Audio.gold(); toast('+60 ♥'); floatText(camera.position,'+60 ♥','#37c46b'); buildHotbar(); updateResStrip(); return; }
  if(itemCount('cookedmeat')>0){ takeItems({cookedmeat:1}); G.hp=clamp(G.hp+30,0,G.hpMax); G.food=clamp(G.food+45,0,G.foodMax); Audio.gold(); toast('+30 ♥ / +45 ситості'); buildHotbar(); updateResStrip(); return; }
  if(itemCount('meat')>0){ takeItems({meat:1}); G.food=clamp(G.food+20,0,G.foodMax); G.hp=clamp(G.hp+6,0,G.hpMax); Audio.gold(); toast('+20 ситості'); updateResStrip(); return; }
  toast('Немає їжі/зілля (C)'); }

/* ============================= ІСТОТИ ============================= */
const enemies=[],critters=[];
function lowHumanoid(col,headCol){ const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.34,1.1,12),M(col)); body.position.y=1.0; body.castShadow=true;
  const chest=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,10),M(col)); chest.position.y=1.4; chest.castShadow=true; g.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,12,10),M(headCol||0xc9a98a)); head.position.y=1.75; head.castShadow=true;
  const ag=new THREE.CylinderGeometry(0.09,0.09,0.6,8);
  const la=new THREE.Mesh(ag,M(col)); la.position.set(-0.4,1.15,0); const ra=new THREE.Mesh(ag,M(col)); ra.position.set(0.4,1.15,0);
  const lg=new THREE.CylinderGeometry(0.11,0.1,0.7,7);
  const ll=new THREE.Mesh(lg,M(0x3a3330)); ll.position.set(-0.15,0.4,0); const rl=new THREE.Mesh(lg,M(0x3a3330)); rl.position.set(0.15,0.4,0);
  [body,head,la,ra,ll,rl].forEach(p=>{p.castShadow=true;g.add(p);}); g.userData={limbs:{la,ra,ll,rl},body}; return g; }
function lowBeast(col,o){ o=o||{}; const s=o.size||1; const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.32*s,0.32*s,1.1*s,10),M(col)); body.rotation.z=Math.PI/2; body.position.y=0.62*s; body.castShadow=true; g.add(body);
  const rump=new THREE.Mesh(new THREE.SphereGeometry(0.34*s,10,8),M(col)); rump.position.set(0,0.62*s,-0.5*s); g.add(rump);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.28*s,10,8),M(o.head||col)); head.position.set(0,0.78*s,0.62*s); head.castShadow=true; g.add(head);
  const lg=new THREE.CylinderGeometry(0.08*s,0.07*s,0.5*s,6); const legs=[];
  [[-.18,.4],[.18,.4],[-.18,-.35],[.18,-.35]].forEach(p=>{ const l=new THREE.Mesh(lg,M(o.leg||col)); l.position.set(p[0]*s,0.25*s,p[1]*s); g.add(l); legs.push(l); });
  if(o.antlers)[-.12,.12].forEach(xx=>{ const an=new THREE.Mesh(new THREE.ConeGeometry(0.05*s,0.4*s,4),M(0x6a4a28)); an.position.set(xx*s,1.0*s,0.55*s); g.add(an); });
  if(o.ears)[-.1,.1].forEach(xx=>{ const e=new THREE.Mesh(new THREE.ConeGeometry(0.07*s,0.28*s,5),M(o.head||col)); e.position.set(xx*s,0.96*s,0.55*s); g.add(e); });
  g.userData={legs,body}; return g; }
function lowBird(col){ const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8),M(col)); body.position.y=0.35; body.scale.z=1.3; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8),M(col)); head.position.set(0,0.58,0.16); g.add(head);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,5),M(0xe8a23a)); beak.rotation.x=Math.PI/2; beak.position.set(0,0.57,0.34); g.add(beak);
  const lg=new THREE.CylinderGeometry(0.03,0.03,0.2,5),legs=[]; [-.08,.08].forEach(xx=>{ const l=new THREE.Mesh(lg,M(0xe8a23a)); l.position.set(xx,0.1,0); g.add(l); legs.push(l); });
  g.userData={legs,body}; return g; }
const ENEMY={ bandit:{name:'Бандит',col:0x6b3a2a,hp:45,dmg:8,xp:25,gold:12,speed:2.9},
  draugr:{name:'Дроуг',col:0x4a5a40,head:0x9aa48a,hp:65,dmg:11,xp:38,gold:16,speed:2.4},
  skeleton:{name:'Скелет-маг',col:0xb9b6a8,head:0xe8e4d6,hp:42,dmg:14,xp:42,gold:20,speed:2.1,ranged:true},
  wraith:{name:'Крижана примара',col:0x6fb0d0,head:0xbfeaff,hp:55,dmg:12,xp:48,gold:24,speed:3.3,frost:true},
  wolf:{name:'Вовк',col:0x6a6a6a,hp:50,dmg:10,xp:35,gold:0,speed:4.0,beast:true,drops:{meat:1,hide:1}},
  troll:{name:'Гірський троль',col:0x5a6a4a,head:0x6a7a55,hp:300,dmg:26,xp:200,gold:150,speed:2.4,big:true,drops:{hide:3,bone:2,gem:1}} };
function spawnEnemy(type,x,z){ const d=ENEMY[type],y=terrainHeight(x,z); const mesh=d.beast?lowBeast(d.col,{leg:0x4a4a4a,head:0x5a5a5a}):lowHumanoid(d.col,d.head);
  if(d.big)mesh.scale.setScalar(1.9); mesh.position.set(x,y,z); scene.add(mesh); const sc=1+(G.level-1)*0.08;
  const en={type,name:d.name,mesh,hp:d.hp*sc,hpMax:d.hp*sc,dmg:d.dmg*sc,xp:d.xp,gold:d.gold,speed:d.speed,ranged:d.ranged,frost:d.frost,drops:d.drops,
    vel:new THREE.Vector3(),dead:false,atkCd:rand(0,1),anim:0,boss:false,slowT:0,flash:0}; enemies.push(en); makeBar(en); }
const CRIT={ deer:{name:'Олень',hp:30,xp:18,speed:3.2,drops:{meat:2,hide:1},b:()=>lowBeast(0x9a6a3a,{size:1.15,antlers:true,head:0xa6764a,leg:0x6a4a28})},
  rabbit:{name:'Кролик',hp:12,xp:8,speed:3.8,drops:{meat:1,hide:1},b:()=>lowBeast(0xdcdcd0,{size:0.6,ears:true,head:0xeeeee2})},
  chicken:{name:'Курка',hp:10,xp:6,speed:2.6,drops:{meat:1,feather:2},b:()=>lowBird(0xf0ece0)},
  boar:{name:'Кабан',hp:45,xp:22,speed:3.0,drops:{meat:2,hide:1,bone:1},b:()=>lowBeast(0x4a3a2e,{size:1.1,head:0x5a4636,leg:0x322620})} };
function spawnCritter(type,x,z){ const d=CRIT[type],y=terrainHeight(x,z),mesh=d.b(); mesh.position.set(x,y,z); scene.add(mesh);
  const c={type,name:d.name,mesh,hp:d.hp,hpMax:d.hp,xp:d.xp,speed:d.speed,drops:d.drops,passive:true,vel:new THREE.Vector3(),dead:false,anim:0,flash:0,fleeT:0,wanderT:rand(0,2),dir:rand(0,TAU),boss:false}; critters.push(c); makeBar(c); }
function damageEnemy(en,a){ if(en.dead)return; if(en.boss&&en.state==='land')a*=1.6; en.hp-=a; en.flash=6; if(en.passive)en.fleeT=8;
  floatText(en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?2.6:1.9,0)),Math.round(a),en.boss?'#ff8a5a':'#ffd34a'); if(en.boss)updateBoss(); if(en.hp<=0)killEnemy(en); }
function killEnemy(en){ en.dead=true; scene.remove(en.mesh); removeBar(en); gainXP(en.xp||10);
  const lp=en.mesh.position.clone().add(new THREE.Vector3(0,1,0)); if(en.drops)for(const id in en.drops){ const k=en.drops[id]+(Math.random()<0.4?1:0); if(k>0)gotItem(id,k,lp); }
  if(en.gold)dropGold(en.mesh.position,Math.round(en.gold*(1+0.25*PERK.fortune))); if(!en.passive){ G.kills++; if(Math.random()<0.15)dropPotion(en.mesh.position); questProgress('kill'); } if(en.boss){ G.dragonDead=true; victory(); } }

/* ---- дракон ---- */
let dragon=null;
function makeDragon(){ const g=new THREE.Group(); const dk=M(0x2e2a33),md=M(0x46414f),wg=M(0x5a5560,{side:THREE.DoubleSide});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.95,3.4,12),dk); body.rotation.z=Math.PI/2; body.castShadow=true; g.add(body);
  const belly=new THREE.Mesh(new THREE.SphereGeometry(0.95,12,10),dk); belly.castShadow=true; g.add(belly);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.6,1.8,8),md); neck.position.set(0,0.5,2.0); neck.rotation.x=0.5; g.add(neck);
  const head=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.4,8),dk); head.rotation.x=-Math.PI/2; head.position.set(0,0.9,3.2); g.add(head);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(0.5,3.2,8),md); tail.rotation.x=Math.PI/2; tail.position.set(0,0,-3.0); g.add(tail);
  const wgeo=new THREE.PlaneGeometry(4.2,2.2); const lw=new THREE.Mesh(wgeo,wg); lw.position.set(-2.6,0.7,0); lw.rotation.y=-0.3;
  const rw=new THREE.Mesh(wgeo,wg); rw.position.set(2.6,0.7,0); rw.rotation.y=Math.PI+0.3;
  g.add(lw,rw); const em=new THREE.MeshBasicMaterial({color:0xff5522}); [-.22,.22].forEach(xx=>{ const e=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),em); e.position.set(xx,1.05,3.7); g.add(e); });
  g.userData={wings:{lw,rw}}; g.scale.setScalar(1.7); return g; }
function summonDragon(){ G.dragonSpawned=true; const y=terrainHeight(0,0)+24; const mesh=makeDragon(); mesh.position.set(0,y,0); scene.add(mesh);
  dragon={type:'dragon',name:'Алдуїн Кубічний',mesh,hp:620+G.level*40,hpMax:620+G.level*40,dmg:18,xp:340,gold:260,speed:7,vel:new THREE.Vector3(),dead:false,boss:true,atkCd:0,anim:0,state:'fly',timer:4,orbitA:0,flash:0,swoops:0};
  enemies.push(dragon); makeBar(dragon); document.getElementById('bossbar').style.display='block'; updateBoss(); Audio.roar(); toast('СТАРОДАВНІЙ ДРАКОН ПРОБУДИВСЯ!'); subtitle("Алдуїн: «Zu'u Alduin!»"); renderQuests(); }
function updateBoss(){ if(!dragon)return; document.getElementById('bossFill').style.width=clamp(dragon.hp/dragon.hpMax*100,0,100)+'%'; document.querySelector('#bossbar .name').textContent=dragon.name.toUpperCase(); }

/* ============================= СНАРЯДИ / ЧАСТИНКИ ============================= */
const projectiles=[],particles=[],pickups=[],floaters=[];
function updateProjectiles(dt){ for(const p of projectiles){ if(p.dead)continue; p.life-=dt; p.pos.addScaledVector(p.vel,dt); p.mesh.position.copy(p.pos);
  if(p.kind!=='arrow'&&Math.random()<0.6)trail(p.pos,p.kind==='frost'?0x88ddff:(p.friendly?0xff7722:0xff3311));
  if(p.pos.y<terrainHeight(p.pos.x,p.pos.z)){ p.dead=true; scene.remove(p.mesh); continue; }
  if(p.friendly){ let hit=false; for(const en of enemies.concat(critters)){ if(en.dead)continue; const c=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.2:1,0));
    if(p.pos.distanceTo(c)<(en.boss?2.8:1.2)){ damageEnemy(en,p.dmg); if(p.slow)en.slowT=2.5; hitSpark(en.mesh.position); p.dead=true; scene.remove(p.mesh); hit=true; break; } } if(hit)continue; }
  else { if(p.pos.distanceTo(camera.position)<1){ hurtPlayer(p.dmg); if(p.slow)playerSlow=2; p.dead=true; scene.remove(p.mesh); } }
  if(p.life<=0){ p.dead=true; scene.remove(p.mesh); } } }
function spawnChips(pos,col){ for(let i=0;i<6;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1),M(col)); m.position.copy(pos); m.position.y+=1; scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-2,2),rand(2,4),rand(-2,2)),life:0.7,grav:true}); } }
function hitSpark(pos){ for(let i=0;i<6;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1),new THREE.MeshBasicMaterial({color:0xffcc44})); m.position.copy(pos); m.position.y+=1; scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-3,3),rand(1,4),rand(-3,3)),life:0.5,grav:true}); } }
function trail(pos,col){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.12,6,6),new THREE.MeshBasicMaterial({color:col})); m.position.copy(pos); scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-.4,.4),rand(-.4,.4),rand(-.4,.4)),life:0.35,grav:false}); }
function dropGold(pos,amt){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(0.22,0),new THREE.MeshStandardMaterial({color:0xe8c66a,emissive:0x4a3a10,roughness:0.4,metalness:0.6})); m.position.copy(pos); m.position.y+=0.5; scene.add(m); pickups.push({mesh:m,amount:amt,kind:'gold',dead:false,spin:0}); }
function dropPotion(pos){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8),new THREE.MeshStandardMaterial({color:0xc0392b,emissive:0x400808,roughness:0.3})); m.position.copy(pos); m.position.y+=0.4; scene.add(m); pickups.push({mesh:m,kind:'potion',dead:false,spin:0}); }
function collectPickup(p){ p.dead=true; scene.remove(p.mesh); if(p.kind==='gold'){ G.gold+=p.amount; Audio.gold(); floatText(camera.position,'+'+p.amount+'💰','#e8c66a'); } else { G.hp=clamp(G.hp+40,0,G.hpMax); Audio.gold(); floatText(camera.position,'+40 ♥','#e0594b'); } updateHUD(); }
function floatText(p3,t,col){ const el=document.createElement('div'); el.textContent=t; el.style.cssText=`position:fixed;color:${col};font-weight:bold;font-size:18px;text-shadow:0 1px 3px #000;pointer-events:none;z-index:8;`; document.body.appendChild(el); floaters.push({el,pos:p3.clone(),life:1}); }

/* ============================= ХП-СМУЖКИ / ПРИЦІЛ ============================= */
function makeBar(en){ const el=document.createElement('div'); el.className='ehp'+(en.boss?' boss':''); el.innerHTML='<i></i>'; el.style.display='none'; document.body.appendChild(el); en.bar=el; en.barFill=el.firstChild; }
function removeBar(en){ if(en.bar){ en.bar.remove(); en.bar=null; } }
const _v=new THREE.Vector3();
function updateBars(){ for(const en of enemies.concat(critters)){ if(en.dead||!en.bar)continue; if(en.passive&&en.hp>=en.hpMax){ en.bar.style.display='none'; continue; }
  _v.copy(en.mesh.position); _v.y+=en.boss?5.4:(en.passive?1.5:2.2); _v.project(camera); if(_v.z>1||_v.z<-1){ en.bar.style.display='none'; continue; }
  if(en.mesh.position.distanceTo(camera.position)>(en.boss?90:26)){ en.bar.style.display='none'; continue; }
  en.bar.style.display='block'; en.bar.style.left=(_v.x*0.5+0.5)*innerWidth+'px'; en.bar.style.top=(-_v.y*0.5+0.5)*innerHeight+'px'; en.barFill.style.width=clamp(en.hp/en.hpMax*100,0,100)+'%'; } }
function updateCrosshair(){ const dir=lookDir(); let aim=false; for(const en of enemies.concat(critters)){ if(en.dead)continue; const to=en.mesh.position.clone().add(new THREE.Vector3(0,en.boss?1.5:1,0)).sub(camera.position); if(to.length()<(en.boss?42:8)&&to.normalize().dot(dir)>0.985){aim=true;break;} } document.getElementById('crosshair').classList.toggle('target',aim); }

/* ============================= ПРОКАЧКА / HUD ============================= */
function gainXP(n){ G.xp+=n; while(G.xp>=G.xpNext){ G.xp-=G.xpNext; G.level++; G.xpNext=Math.round(G.xpNext*1.4); G.mpMax+=10; G.spMax+=10; G.perks++; G.hp=G.hpMax; G.mp=G.mpMax; G.sp=G.spMax; Audio.level(); toast('РІВЕНЬ '+G.level+'!'); subtitle('Очко навичок (P)'); questProgress('level'); saveGame(); } updateHUD(); }
function applyPerk(id){ const d=PERK_DEF.find(p=>p.id===id); if(!d||G.perks<=0||PERK[id]>=d.max)return; PERK[id]++; G.perks--; Audio.gold(); if(id==='vitality'){ G.hpMax+=25; G.hp+=25; } updateHUD(); renderSkills(); }
function updateHUD(){ const q=id=>document.getElementById(id);
  q('hpFill').style.width=clamp(G.hp/G.hpMax*100,0,100)+'%'; q('mpFill').style.width=clamp(G.mp/G.mpMax*100,0,100)+'%';
  q('spFill').style.width=clamp(G.sp/G.spMax*100,0,100)+'%'; q('foodFill').style.width=clamp(G.food/G.foodMax*100,0,100)+'%';
  q('hpTxt').textContent=Math.ceil(G.hp)+'/'+G.hpMax; q('lvlNum').textContent=G.level; q('xpFill').style.width=(G.xp/G.xpNext*100)+'%';
  q('goldNum').textContent=G.gold; q('perkNum').textContent=G.perks; updateGear(); }
function updateGear(){ document.getElementById('gearWeapon').textContent=(ITEMS[G.weapon]?ITEMS[G.weapon].n:'—')+(G.hasBow?' +🏹':''); document.getElementById('gearArmor').textContent=G.armorItem?ITEMS[G.armorItem].n:'—'; }
function updateResStrip(){ const el=document.getElementById('resStrip'); el.innerHTML=''; for(const id of ['wood','stone','iron','gem','hide','arrow']){ const n=itemCount(id); if(n>0){ const d=document.createElement('div'); d.className='res'; d.innerHTML=`${ITEMS[id].i} <b>${n}</b>`; el.appendChild(d); } } }
function buildHotbar(){ const hb=document.getElementById('hotbar'); hb.innerHTML=''; HOTBAR.forEach((it,i)=>{ const d=document.createElement('div'); d.className='slot'+(i===G.slot?' active':'');
  let icon=it.icon,cnt=''; if(it.type==='weapon'&&ITEMS[G.weapon])icon=ITEMS[G.weapon].i; if(it.type==='torch')cnt=itemCount('torch'); if(it.type==='potion')cnt=itemCount('health_potion');
  d.innerHTML=`<span class="nm">${it.type==='weapon'&&ITEMS[G.weapon]?ITEMS[G.weapon].n:it.name}</span>${icon}<small>${i+1}</small>${cnt!==''?'<b style="position:absolute;top:1px;left:3px;font-size:9px;color:#cfe6a0">'+cnt+'</b>':''}`; hb.appendChild(d); }); }
function selectSlot(i){ G.slot=clamp(i,0,HOTBAR.length-1); if(HOTBAR[G.slot].type==='potion')drinkPotion(); buildHotbar(); }
let toastT; function toast(m){ const el=document.getElementById('toast'); el.textContent=m; el.style.opacity=1; clearTimeout(toastT); toastT=setTimeout(()=>el.style.opacity=0,1800); }
let subT; function subtitle(m){ const el=document.getElementById('subtitle'); el.textContent=m; el.style.opacity=1; clearTimeout(subT); subT=setTimeout(()=>el.style.opacity=0,2600); }
function damageFlash(){ const el=document.getElementById('dmgFlash'); el.style.opacity=1; setTimeout(()=>el.style.opacity=0,120); }
function flash(col){ const el=document.getElementById('dmgFlash'); el.style.background='radial-gradient(transparent 48%, '+col+')'; el.style.opacity=1; setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.style.background='radial-gradient(transparent 52%, rgba(150,0,0,.6))',220); },160); }

/* ============================= КВЕСТИ ============================= */
const QUESTS=[ {id:'harvest',text:'Зібрати 10 ресурсів',need:10,prog:0,kind:'harvest'},
  {id:'kill',text:'Знищити 6 ворогів',need:6,prog:0,kind:'kill'},
  {id:'gather',text:'Зібрати 5 рослин',need:5,prog:0,kind:'gather'},
  {id:'level',text:'Досягти 3 рівня',need:3,prog:1,kind:'level'},
  {id:'boss',text:'Перемогти Стародавнього Дракона',need:1,prog:0,kind:'boss'} ];
function questProgress(kind){ for(const q of QUESTS){ if(q.kind!==kind||q.done)continue; if(kind==='level')q.prog=G.level; else q.prog++; if(q.prog>=q.need){ q.done=true; toast('Завдання виконано: '+q.text); gainXP(40); } } renderQuests(); if(QUESTS[3].done&&!G.dragonSpawned)subtitle('Іди до вівтаря (центр) і натисни E'); }
function renderQuests(){ const c=document.getElementById('questObjs'); c.innerHTML=''; for(const q of QUESTS){ if(q.id==='boss'&&!G.dragonSpawned&&!QUESTS[3].done)continue; const d=document.createElement('div'); d.className='obj'+(q.done?' done':''); const cnt=q.kind==='boss'?'':' ('+Math.min(q.prog,q.need)+'/'+q.need+')'; d.textContent=(q.done?'✓ ':'• ')+q.text+cnt; c.appendChild(d); } }

/* ============================= ПАНЕЛІ ============================= */
function renderSkills(){ document.getElementById('perkAvail').textContent=G.perks; const grid=document.getElementById('perkGrid'); grid.innerHTML='';
  for(const d of PERK_DEF){ const lvl=PERK[d.id],mx=lvl>=d.max; const el=document.createElement('div'); el.className='perk'+(mx?' maxed':''); el.innerHTML=`<div class="pn">${d.name} ${'◆'.repeat(lvl)}${'◇'.repeat(d.max-lvl)}</div><div class="pd">${d.desc}</div><div class="pl">Рівень ${lvl}/${d.max}${mx?' — макс.':' · клік'}</div>`; if(!mx)el.onclick=()=>applyPerk(d.id); grid.appendChild(el); } }
let skillsOpen=false; function toggleSkills(){ skillsOpen=!skillsOpen; const p=document.getElementById('skillsPanel'); if(skillsOpen){ renderSkills(); p.classList.remove('hidden'); document.exitPointerLock(); } else { p.classList.add('hidden'); if(G.started&&!G.over)canvas.requestPointerLock(); } }
let craftOpen=false; function toggleCraft(){ craftOpen=!craftOpen; const p=document.getElementById('craftPanel'); if(craftOpen){ renderCraft(); p.classList.remove('hidden'); document.exitPointerLock(); } else { p.classList.add('hidden'); if(G.started&&!G.over)canvas.requestPointerLock(); } }
function renderCraft(){ const g=document.getElementById('invGrid'); g.innerHTML=''; const ids=Object.keys(ITEMS).filter(id=>itemCount(id)>0);
  if(!ids.length)g.innerHTML='<div style="grid-column:1/-1;color:#8a8474;font-size:13px">Порожньо — рубай ліс, копай руду, полюй.</div>';
  for(const id of ids){ const d=document.createElement('div'); d.className='invslot'; d.innerHTML=`<span class="tip">${ITEMS[id].n}</span>${ITEMS[id].i}<small>${itemCount(id)}</small>`; g.appendChild(d); }
  const list=document.getElementById('recipeList'); list.innerHTML=''; for(const r of RECIPES){ const ok=hasItems(r.req); const d=document.createElement('div'); d.className='recipe'+(ok?'':' cant');
    const rt=Object.keys(r.req).map(k=>`${ITEMS[k].i}${ITEMS[k].n}×${r.req[k]}`).join(', '); d.innerHTML=`<div><div class="rn">${ITEMS[r.out].i} ${ITEMS[r.out].n}${r.n>1?' ×'+r.n:''}</div><div class="rc">${rt}${r.gear?' · одягнеться':''}</div></div><div class="ro">${ok?'🔨':'🔒'}</div>`; d.onclick=()=>craft(r); list.appendChild(d); } }
function craft(r){ if(!hasItems(r.req)){toast('Недостатньо ресурсів');return;} takeItems(r.req); addItem(r.out,r.n); Audio.place(); if(r.gear)equip(r.out); toast('Створено: '+ITEMS[r.out].n); renderCraft(); updateResStrip(); buildHotbar(); }
function equip(id){ const it=ITEMS[id]; if(it.weapon!=null){G.weapon=id;toast('Озброєно: '+it.n);} if(it.bow){G.hasBow=true;toast('Лук готовий (G)');} if(it.armor!=null){G.armorItem=id;G.defense=it.armor;toast('Вдягнено: '+it.n);} updateGear(); }
function togglePause(){ if(skillsOpen){toggleSkills();return;} if(craftOpen){toggleCraft();return;} if(tradeOpen){toggleTrade();return;} G.paused=!G.paused; const p=document.getElementById('pauseMenu'); if(G.paused){ p.classList.remove('hidden'); document.exitPointerLock(); } else { p.classList.add('hidden'); canvas.requestPointerLock(); } }

/* ============================= ТОРГОВЕЦЬ ============================= */
let trader=null;
const BUY=[ {id:'health_potion',n:1,price:40},{id:'mana_potion',n:1,price:40},{id:'arrow',n:10,price:20},{id:'iron',n:3,price:35},{id:'iron_sword',n:1,price:130,gear:true},{id:'iron_armor',n:1,price:160,gear:true} ];
const SELL=[ {id:'hide',price:8},{id:'meat',price:5},{id:'bone',price:7},{id:'feather',price:3},{id:'gem',price:45},{id:'goldore',price:18},{id:'obsidian',price:12},{id:'coal',price:4},{id:'wood',price:2},{id:'stone',price:2} ];
function spawnTrader(){ const x=9,z=-4,y=terrainHeight(x,z),mesh=lowHumanoid(0x3a4a6a,0xc9a98a);
  const hat=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.4,8),M(0x2a2a3a)); hat.position.y=1.95; mesh.add(hat); mesh.add(makeGlow(0xe8c66a,1.1)); mesh.position.set(x,y,z); scene.add(mesh); trader={mesh,x,z}; }
let tradeOpen=false; function toggleTrade(){ tradeOpen=!tradeOpen; const p=document.getElementById('tradePanel'); if(tradeOpen){ renderTrade(); p.classList.remove('hidden'); document.exitPointerLock(); } else { p.classList.add('hidden'); if(G.started&&!G.over)canvas.requestPointerLock(); } }
function renderTrade(){ document.getElementById('tradeGold').textContent=G.gold; const bl=document.getElementById('buyList'); bl.innerHTML='';
  for(const b of BUY){ const ok=G.gold>=b.price; const d=document.createElement('div'); d.className='recipe'+(ok?'':' cant'); d.innerHTML=`<div><div class="rn">${ITEMS[b.id].i} ${ITEMS[b.id].n}${b.n>1?' ×'+b.n:''}</div><div class="rc">💰 ${b.price}</div></div><div class="ro">🛒</div>`; d.onclick=()=>{ if(G.gold<b.price){toast('Замало золота');return;} G.gold-=b.price; addItem(b.id,b.n); if(b.gear)equip(b.id); Audio.gold(); renderTrade(); updateHUD(); updateResStrip(); buildHotbar(); }; bl.appendChild(d); }
  const sl=document.getElementById('sellList'); sl.innerHTML=''; for(const s of SELL){ const have=itemCount(s.id); const d=document.createElement('div'); d.className='recipe'+(have>0?'':' cant'); d.innerHTML=`<div><div class="rn">${ITEMS[s.id].i} ${ITEMS[s.id].n} <span style="color:#bcb6a4">×${have}</span></div><div class="rc">+💰 ${s.price}</div></div><div class="ro">💱</div>`; d.onclick=()=>{ if(itemCount(s.id)<=0){toast('Немає що продати');return;} takeItems({[s.id]:1}); G.gold+=s.price; Audio.gold(); renderTrade(); updateHUD(); updateResStrip(); }; sl.appendChild(d); } }

/* ============================= СПАВН ВОРОГІВ / ТВАРИН ============================= */
let spawnTimer=3,critterTimer=2,miniTimer=90,miniActive=false,miniRef=null,playerSlow=0;
function maybeSpawn(dt){ spawnTimer-=dt; const alive=enemies.filter(e=>!e.dead&&!e.boss).length;
  if(spawnTimer<=0&&alive<7&&!G.dragonDead){ spawnTimer=rand(3,5); const a=Math.random()*TAU,d=rand(16,30),x=player.pos.x+Math.cos(a)*d,z=player.pos.z+Math.sin(a)*d;
    if(Math.hypot(x,z)<WORLD_R&&terrainHeight(x,z)>SEA+0.5){ const r=Math.random(); let t='bandit'; if(G.level>=2&&r<0.35)t='draugr'; if(G.level>=3&&r<0.2)t='skeleton'; if(G.level>=4&&r<0.12)t='wraith'; if(r<0.12)t='wolf'; spawnEnemy(t,x,z); } } }
function maybeCritters(dt){ critterTimer-=dt; const alive=critters.filter(c=>!c.dead).length;
  if(critterTimer<=0&&alive<10){ critterTimer=rand(3,6); const a=Math.random()*TAU,d=rand(14,30),x=player.pos.x+Math.cos(a)*d,z=player.pos.z+Math.sin(a)*d;
    if(Math.hypot(x,z)<WORLD_R&&terrainHeight(x,z)>SEA+1){ const bm=biomeAt(x,z),r=Math.random(); let t=bm==='snow'?(r<0.6?'rabbit':'deer'):bm==='desert'?(r<0.6?'boar':'rabbit'):(r<0.35?'deer':r<0.6?'rabbit':r<0.8?'chicken':'boar'); spawnCritter(t,x,z); } } }
function updateMini(dt){ if(G.dragonDead)return; if(miniActive){ if(!miniRef||miniRef.dead){ miniActive=false; miniRef=null; miniTimer=rand(80,120); } return; }
  miniTimer-=dt; if(miniTimer<=0&&G.level>=2){ const a=Math.random()*TAU,d=rand(16,24),x=clamp(player.pos.x+Math.cos(a)*d,-WORLD_R,WORLD_R),z=clamp(player.pos.z+Math.sin(a)*d,-WORLD_R,WORLD_R); spawnEnemy('troll',x,z); miniRef=enemies[enemies.length-1]; miniActive=true; Audio.roar(); toast('ГІРСЬКИЙ ТРОЛЬ НАБЛИЖАЄТЬСЯ!'); } }

/* ============================= УРОН / СМЕРТЬ ============================= */
function hurtPlayer(a){ if(G.over)return; a*=(1-(G.defense||0)); G.hp-=a; damageFlash(); Audio.hurt(); updateHUD(); if(G.hp<=0)die(); }
let dotF=0; function hurtDOT(a){ if(G.over)return; G.hp-=a*(1-(G.defense||0)*0.5); dotF-=a; if(dotF<-6){ dotF=0; damageFlash(); } if(G.hp<=0)die(); }
function die(){ G.over=true; document.exitPointerLock(); document.getElementById('deathPanel').classList.remove('hidden'); }
function victory(){ G.over=true; saveGame(); document.exitPointerLock(); document.getElementById('bossbar').style.display='none'; const t=((performance.now()-G.startTime)/1000)|0; document.getElementById('winStats').textContent=`Рівень ${G.level} · Вбивств: ${G.kills} · Золота: ${G.gold} · Час: ${(t/60|0)}хв ${t%60}с`; document.getElementById('winPanel').classList.remove('hidden'); }

/* ============================= ОНОВЛЕННЯ ІСТОТ ============================= */
function groundClamp(o,foot){ const gy=terrainHeight(o.mesh.position.x,o.mesh.position.z)+foot; if(o.mesh.position.y<gy){ o.mesh.position.y=gy; o.vel.y=0; } }
function updateEnemies(dt){ for(const en of enemies){ if(en.dead)continue; if(en.boss){ updateDragon(en,dt); flashUpd(en); continue; }
  en.slowT=Math.max(0,en.slowT-dt); const sp=en.speed*(en.slowT>0?0.4:1); en.vel.y-=24*dt;
  const to=new THREE.Vector3(player.pos.x-en.mesh.position.x,0,player.pos.z-en.mesh.position.z); const dist=to.length();
  if(en.ranged){ if(dist>10){ to.normalize(); en.vel.x=to.x*sp; en.vel.z=to.z*sp; en.anim+=dt*8; } else { en.vel.x*=0.7; en.vel.z*=0.7; en.atkCd-=dt; if(en.atkCd<=0){ en.atkCd=2; const d=new THREE.Vector3(player.pos.x-en.mesh.position.x,(player.pos.y+1)-(en.mesh.position.y+1.4),player.pos.z-en.mesh.position.z).normalize(); const o=en.mesh.position.clone().add(new THREE.Vector3(0,1.4,0)); projectiles.push({pos:o,vel:d.multiplyScalar(16),life:3,dmg:en.dmg,friendly:false,kind:'fire',mesh:makeOrb(o,0xaa66ff)}); } } if(dist>0.1)en.mesh.rotation.y=Math.atan2(player.pos.x-en.mesh.position.x,player.pos.z-en.mesh.position.z); }
  else { if(dist>1.6){ to.normalize(); en.vel.x=to.x*sp; en.vel.z=to.z*sp; en.mesh.rotation.y=Math.atan2(to.x,to.z); en.anim+=dt*8; } else { en.vel.x=0; en.vel.z=0; en.atkCd-=dt; if(en.atkCd<=0){ en.atkCd=1.1; hurtPlayer(en.dmg); if(en.frost)playerSlow=1.5; en.anim+=2; } } }
  en.mesh.position.x+=en.vel.x*dt; en.mesh.position.z+=en.vel.z*dt; en.mesh.position.y+=en.vel.y*dt; groundClamp(en,0);
  const L=en.mesh.userData.limbs; if(L){ const s=Math.sin(en.anim)*0.6; L.la.rotation.x=s; L.ra.rotation.x=-s; L.ll.rotation.x=-s; L.rl.rotation.x=s; } flashUpd(en); } }
function flashUpd(en){ const b=en.mesh.userData.body; if(!b||!b.material||!b.material.emissive)return; if(en.flash>0){ en.flash--; b.material.emissive.setHex(0x661111); } else b.material.emissive.setHex(0x000000); }
function updateCritters(dt){ for(const c of critters){ if(c.dead)continue; c.vel.y-=24*dt; c.fleeT=Math.max(0,c.fleeT-dt); c.wanderT-=dt;
  const toP=new THREE.Vector3(player.pos.x-c.mesh.position.x,0,player.pos.z-c.mesh.position.z); const dp=toP.length(); let mx=0,mz=0;
  if(c.fleeT>0||dp<4){ const aw=toP.clone().multiplyScalar(-1).normalize(); mx=aw.x*c.speed*1.3; mz=aw.z*c.speed*1.3; c.mesh.rotation.y=Math.atan2(-toP.x,-toP.z); c.anim+=dt*12; }
  else { if(c.wanderT<=0){ c.wanderT=rand(1.5,4); c.dir=rand(0,TAU); } mx=Math.cos(c.dir)*c.speed*0.5; mz=Math.sin(c.dir)*c.speed*0.5; if(mx||mz){ c.mesh.rotation.y=Math.atan2(mx,mz); c.anim+=dt*7; } }
  c.mesh.position.x+=mx*dt; c.mesh.position.z+=mz*dt; c.mesh.position.y+=c.vel.y*dt;
  c.mesh.position.x=clamp(c.mesh.position.x,-WORLD_R,WORLD_R); c.mesh.position.z=clamp(c.mesh.position.z,-WORLD_R,WORLD_R); groundClamp(c,0);
  const L=c.mesh.userData.legs; if(L){ const s=Math.sin(c.anim)*0.5; L.forEach((l,i)=>l.rotation.x=(i%2?s:-s)); } flashUpd(c); } }
function updateDragon(d,dt){ d.timer-=dt; d.anim+=dt; const w=d.mesh.userData.wings; if(w){ const f=Math.sin(d.anim*6)*0.5; w.lw.rotation.z=f; w.rw.rotation.z=-f; }
  const toP=camera.position.clone().sub(d.mesh.position); const dist=toP.length(); d.mesh.rotation.y=Math.atan2(toP.x,toP.z);
  if(d.state==='fly'){ d.orbitA+=dt*0.6; const r=20,cy=terrainHeight(0,0)+17; const tx=Math.cos(d.orbitA)*r,tz=Math.sin(d.orbitA)*r; d.mesh.position.x+=(tx-d.mesh.position.x)*dt*0.9; d.mesh.position.z+=(tz-d.mesh.position.z)*dt*0.9; d.mesh.position.y+=(cy-d.mesh.position.y)*dt*0.9; d.atkCd-=dt; if(d.atkCd<=0){ d.atkCd=2.2; breathe(d); } if(d.timer<=0){ d.state='swoop'; d.timer=3.2; subtitle('Дракон пікірує!'); } }
  else if(d.state==='swoop'){ const dir=toP.clone().normalize(); d.mesh.position.addScaledVector(dir,d.speed*dt*1.7); if(dist<4){ hurtPlayer(d.dmg); d.swoops++; nextPhase(d); } if(d.timer<=0){ d.swoops++; nextPhase(d); } }
  else { const gx=clamp(player.pos.x+Math.cos(d.orbitA)*6,-WORLD_R,WORLD_R),gz=clamp(player.pos.z+Math.sin(d.orbitA)*6,-WORLD_R,WORLD_R),gy=terrainHeight(gx,gz)+3; d.mesh.position.x+=(gx-d.mesh.position.x)*dt*2; d.mesh.position.z+=(gz-d.mesh.position.z)*dt*2; d.mesh.position.y+=(gy-d.mesh.position.y)*dt*3; d.atkCd-=dt; if(dist<6&&d.atkCd<=0){ d.atkCd=1.4; hurtPlayer(d.dmg*0.8); } if(d.timer<=0){ d.state='fly'; d.timer=4.5; subtitle('Дракон злітає!'); Audio.roar(); } } }
function nextPhase(d){ if(d.swoops>=2){ d.swoops=0; d.state='land'; d.timer=4.5; d.orbitA=Math.random()*TAU; subtitle('Дракон приземлився — атакуй!'); Audio.roar(); } else { d.state='fly'; d.timer=4; } }
function breathe(d){ const dir=camera.position.clone().sub(d.mesh.position).normalize(),o=d.mesh.position.clone().add(dir.clone().multiplyScalar(3)); Audio.fire(); for(let i=0;i<4;i++){ const s=dir.clone().add(new THREE.Vector3(rand(-.12,.12),rand(-.12,.12),rand(-.12,.12))).normalize(); projectiles.push({pos:o.clone(),vel:s.multiplyScalar(24),life:2.4,dmg:14,friendly:false,kind:'fire',mesh:makeOrb(o,0xff3311)}); } subtitle('Алдуїн: «Yol Toor Shul!»'); }

/* ============================= EXTRAS / ПОГОДА / ЧАС ============================= */
function updateExtras(dt){ for(const pa of particles){ if(pa.dead)continue; pa.life-=dt; if(pa.grav)pa.vel.y-=18*dt; pa.mesh.position.addScaledVector(pa.vel,dt); pa.mesh.scale.setScalar(clamp(pa.life/0.5,0,1)); if(pa.life<=0){ pa.dead=true; scene.remove(pa.mesh); } }
  for(const p of pickups){ if(p.dead)continue; p.spin+=dt*3; p.mesh.rotation.y=p.spin; if(p.mesh.position.distanceTo(camera.position)<1.9)collectPickup(p); }
  for(const f of floaters){ if(f.dead)continue; f.life-=dt; f.pos.y+=dt*1.2; const v=f.pos.clone().project(camera); if(v.z>1){ f.el.style.display='none'; } else { f.el.style.display='block'; f.el.style.left=(v.x*0.5+0.5)*innerWidth+'px'; f.el.style.top=(-v.y*0.5+0.5)*innerHeight+'px'; f.el.style.opacity=clamp(f.life,0,1); } if(f.life<=0){ f.dead=true; f.el.remove(); } }
  // нодові респавни / тряска
  for(const n of nodes){ if(n.shake>0){ n.shake-=dt; n.mesh.rotation.z=Math.sin(n.shake*40)*0.05; } else if(n.mesh.rotation.z)n.mesh.rotation.z=0;
    if(n.dead){ n.respawn-=dt; if(n.respawn<=0){ n.dead=false; n.hp=n.maxhp; n.mesh.visible=true; } } } }
function cleanup(){ for(const a of [enemies,critters]) for(let i=a.length-1;i>=0;i--) if(a[i].dead){ removeBar(a[i]); a.splice(i,1); } for(const a of [projectiles,particles,pickups,floaters]) for(let i=a.length-1;i>=0;i--) if(a[i].dead)a.splice(i,1); }
const DIRS=['Пн','ПнСх','Сх','ПдСх','Пд','ПдЗх','Зх','ПнЗх'];
function updateCompass(){ let a=((-player.yaw)%TAU+TAU)%TAU; document.getElementById('compassDir').textContent=DIRS[Math.round(a/(TAU/8))%8]; }
const mm=document.getElementById('minimapCanvas'),mmx=mm.getContext('2d'); const MMR=80,MMRANGE=70;
function mdot(wx,wz,col,sz){ const dx=wx-player.pos.x,dz=wz-player.pos.z,ca=Math.cos(player.yaw),sa=Math.sin(player.yaw); let rx=dx*ca-dz*sa,rz=dx*sa+dz*ca; const sc=MMR/MMRANGE,px=MMR+rx*sc,py=MMR+rz*sc; if(Math.hypot(px-MMR,py-MMR)>MMR-3)return; mmx.fillStyle=col; mmx.beginPath(); mmx.arc(px,py,sz||3,0,TAU); mmx.fill(); }
function drawMinimap(){ mmx.clearRect(0,0,160,160); mmx.fillStyle='rgba(40,60,40,.25)'; mmx.beginPath(); mmx.arc(MMR,MMR,MMR-2,0,TAU); mmx.fill();
  mdot(0,0,'#e8c66a',4); if(trader)mdot(trader.mesh.position.x,trader.mesh.position.z,'#5ad0ff',4);
  for(const c of chests){ if(!c.taken)mdot(c.mesh.position.x,c.mesh.position.z,'#caa24a',3); }
  for(const c of critters){ if(!c.dead)mdot(c.mesh.position.x,c.mesh.position.z,'#8fd06a',2); }
  for(const en of enemies){ if(en.dead)continue; mdot(en.mesh.position.x,en.mesh.position.z,en.boss?'#ff7a3a':'#e0594b',en.boss?6:3); }
  mmx.fillStyle='#9ec4e8'; mmx.beginPath(); mmx.moveTo(MMR,MMR-6); mmx.lineTo(MMR-4,MMR+5); mmx.lineTo(MMR+4,MMR+5); mmx.closePath(); mmx.fill(); }
function updateDayNight(dt){ G.time=(G.time+dt/150)%1; const ang=G.time*TAU,sx=Math.cos(ang),sy=Math.sin(ang);
  sun.position.set(player.pos.x+sx*120,sy*140,player.pos.z+60); sun.target.position.copy(player.pos); sun.target.updateMatrixWorld();
  moon.position.set(player.pos.x-sx*200,-sy*200+player.pos.y,player.pos.z-50);
  const day=clamp(sy,0,1); sun.intensity=lerp(0.05,1.25,day); hemi.intensity=lerp(0.3,0.95,day); ambient.intensity=lerp(0.16,0.32,day); moonLight.intensity=lerp(0.35,0,day); moonLight.position.copy(moon.position);
  lantern.intensity=lerp(1.6,0,clamp(day*1.5,0,1)); lantern.position.copy(camera.position);
  const dayTop=new THREE.Color(0x2f72c0),nightTop=new THREE.Color(0x05080f),dayBot=new THREE.Color(0xcfe6ff),nightBot=new THREE.Color(0x0f1622),dusk=new THREE.Color(0xe89a5a);
  const du=clamp(1-Math.abs(sy)*3,0,1)*clamp(sy+0.4,0,1);
  skyU.top.value.copy(nightTop).lerp(dayTop,day); skyU.bottom.value.copy(nightBot).lerp(dayBot,day).lerp(dusk,du*0.6);
  skyU.sunDir.value.set(sx,sy,0.3).normalize(); skyU.sunCol.value.setHex(0xfff2d6).lerp(new THREE.Color(0xff8a4a),du);
  scene.fog.color.copy(skyU.bottom.value); stars.material.opacity=clamp(1-day*2.2,0,1);
  if(waterU){ waterU.uSun.value.copy(sun.position).normalize(); }
  // погода
  G.weatherT-=dt; if(G.weatherT<=0){ const r=Math.random(); G.weather=r<0.6?'clear':r<0.85?'rain':'storm'; G.weatherT=G.weather==='clear'?rand(40,80):rand(20,45); if(G.weather!=='clear')subtitle(G.weather==='storm'?'Насувається гроза…':'Починається дощ…'); }
  if(G.weather!=='clear'){ const k=G.weather==='storm'?0.6:0.4; sun.intensity*=(1-k); hemi.intensity*=(1-k*0.5); skyU.top.value.lerp(new THREE.Color(0x4a525c),k); skyU.bottom.value.lerp(new THREE.Color(0x6a727c),k); scene.fog.color.copy(skyU.bottom.value); scene.fog.density=0.0042*(G.weather==='storm'?1.7:1.3);
    for(let i=0;i<(G.weather==='storm'?5:3);i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.5,0.03),new THREE.MeshBasicMaterial({color:0x9fb6d0,transparent:true,opacity:0.5})); m.position.set(player.pos.x+rand(-16,16),player.pos.y+rand(7,14),player.pos.z+rand(-16,16)); scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(rand(-1,1),-24,rand(-1,1)),life:0.7,grav:false}); }
    if(G.weather==='storm'){ lightT-=dt; if(lightT<=0){ lightT=rand(3,8); lightning(); } } }
  else scene.fog.density=0.0042;
  const hour=Math.floor(((G.time*24)+6)%24); const wi=G.weather==='storm'?'⛈️ Гроза':G.weather==='rain'?'🌧️ Дощ':(day>0.15?'☀️ День':'🌙 Ніч');
  document.getElementById('clockTxt').textContent=wi+' '+(hour<10?'0':'')+hour+':00'; document.getElementById('clock').firstChild.textContent=''; }
let lightT=0; function lightning(){ flash('rgba(255,255,255,.5)'); Audio.blip(60,0.7,'sawtooth',0.4,1.5); Audio.noise(0.6,0.3,500); }

/* ============================= ОНОВЛЕННЯ / ЦИКЛ ============================= */
let saveAccum=0;
function update(dt){ G.sp=clamp(G.sp+18*dt,0,G.spMax); G.mp=clamp(G.mp+8*dt,0,G.mpMax); G.food=clamp(G.food-0.45*dt,0,G.foodMax);
  const fed=G.food>15; if(G.hp<G.hpMax&&fed)G.hp=clamp(G.hp+2*dt,0,G.hpMax); else if(!fed)G.hp=clamp(G.hp-0.7*dt,0,G.hpMax); playerSlow=Math.max(0,playerSlow-dt);
  // лава
  if(biomeAt(player.pos.x,player.pos.z)==='volcano'&&Math.hypot(player.pos.x-volcano[0],player.pos.z-volcano[1])<5)G.onFire=Math.max(G.onFire,1.4);
  if(G.onFire>0){ G.onFire-=dt; hurtDOT(15*dt); if(Math.random()<0.5){ const m=makeGlow(0xff6622,0.5); m.position.set(camera.position.x+rand(-.4,.4),camera.position.y+rand(-.5,.3),camera.position.z+rand(-.4,.4)); scene.add(m); particles.push({mesh:m,vel:new THREE.Vector3(0,1.2,0),life:0.5,grav:false}); } }
  // рух
  const running=(keys['ShiftLeft']||keys['ShiftRight'])&&G.sp>1; let speed=(running?7.4:4.7)*(1+0.12*PERK.swift)*(playerSlow>0?0.5:1);
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw)),mv=new THREE.Vector3();
  if(keys['KeyW'])mv.add(fwd); if(keys['KeyS'])mv.sub(fwd); if(keys['KeyD'])mv.add(right); if(keys['KeyA'])mv.sub(right);
  const moving=mv.lengthSq()>0; if(moving)mv.normalize().multiplyScalar(speed); player.vel.x=mv.x; player.vel.z=mv.z;
  if(running&&moving){ G.sp=clamp(G.sp-8*dt,0,G.spMax); G.food=clamp(G.food-0.4*dt,0,G.foodMax); } if(moving)walkPhase+=dt*(running?14:9);
  player.vel.y-=26*dt; if(keys['Space']&&player.onGround){ player.vel.y=9; player.onGround=false; }
  player.pos.x+=player.vel.x*dt; player.pos.z+=player.vel.z*dt; player.pos.y+=player.vel.y*dt;
  player.pos.x=clamp(player.pos.x,-WORLD_R+2,WORLD_R-2); player.pos.z=clamp(player.pos.z,-WORLD_R+2,WORLD_R-2);
  const gy=terrainHeight(player.pos.x,player.pos.z); player.onGround=false; if(player.pos.y<=gy+0.02){ player.pos.y=gy; player.vel.y=0; player.onGround=true; }
  const inWater=gy<SEA; if(inWater&&player.pos.y<SEA){ player.pos.y=Math.max(player.pos.y,gy); } // не тонемо нижче дна
  // камера
  const bob=moving&&player.onGround?Math.sin(walkPhase)*0.05:0; camera.position.set(player.pos.x,player.pos.y+player.eye+bob,player.pos.z); camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
  sky.position.copy(camera.position); stars.position.copy(camera.position); if(water)water.position.set(camera.position.x,SEA-0.15,camera.position.z);
  if(waterU){ waterU.uTime.value+=dt; waterU.uCam.value.copy(camera.position); }
  for(const u of windU)u.value+=dt;
  maybeSpawn(dt); maybeCritters(dt); updateMini(dt); updateEnemies(dt); updateCritters(dt); updateProjectiles(dt); updateExtras(dt); cleanup();
  updateCompass(); updateDayNight(dt); drawMinimap(); updateBars(); updateCrosshair();
  if(altar)altar.userData.orb.rotation.y+=dt; for(const c of clouds){ c.position.x+=dt*1.5; if(c.position.x>440)c.position.x=-440; }
  if(swordSwing>0)swordSwing=Math.max(0,swordSwing-dt*4); updateViewmodel();
  const cd=G.shoutReady-performance.now(); document.getElementById('shoutCd').textContent=cd>0?`Крик: ${(cd/1000).toFixed(1)}с`:'Крик готовий (Q)';
  saveAccum+=dt; if(saveAccum>10){ saveAccum=0; saveGame(); } updateHUD(); }
let last=0;
function loop(now){ requestAnimationFrame(loop); const dt=Math.min((now-last)/1000||0,0.05); last=now;
  if(G.started&&!G.over&&!G.paused&&!skillsOpen&&!craftOpen&&!tradeOpen)update(dt);
  if(composer)composer.render(); else renderer.render(scene,camera);
  renderer.autoClear=false; renderer.clearDepth(); if(G.started&&!G.over)renderer.render(vmScene,vmCam); renderer.autoClear=true; }

/* ============================= РЕСАЙЗ ============================= */
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); vmCam.aspect=innerWidth/innerHeight; vmCam.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); if(composer)composer.setSize(innerWidth,innerHeight); });

/* ============================= СТАРТ ============================= */
function findSpawn(){ for(let r=0;r<40;r+=3)for(let a=0;a<TAU;a+=0.6){ const x=Math.cos(a)*r,z=Math.sin(a)*r; if(terrainHeight(x,z)>SEA+1.5&&Math.hypot(x,z)>8)return [x,z]; } return [10,10]; }
function resetRun(){ for(const en of enemies)removeBar(en); for(const c of critters)removeBar(c);
  for(const a of [enemies,critters,projectiles,particles,pickups]) for(const o of a) if(o.mesh)scene.remove(o.mesh); for(const f of floaters)f.el.remove();
  enemies.length=critters.length=projectiles.length=particles.length=pickups.length=floaters.length=0; dragon=null;
  Object.assign(G,{started:true,over:false,paused:false,hp:100,hpMax:100,mp:100,mpMax:100,sp:100,spMax:100,level:1,xp:0,xpNext:100,gold:0,perks:0,slot:0,shoutReady:0,kills:0,harvested:0,startTime:performance.now(),time:0.30,weapon:'iron_sword',armorItem:null,hasBow:false,defense:0,food:100,foodMax:100,onFire:0,weather:'clear',weatherT:25,dragonSpawned:false,dragonDead:false});
  for(const k in PERK)PERK[k]=0; for(const k in INV)delete INV[k];
  addItem('torch',5); addItem('health_potion',1); addItem('wood',4);
  QUESTS.forEach(q=>{q.done=false;q.prog=q.kind==='level'?1:0;});
  const [sx,sz]=findSpawn(); player.pos.set(sx,terrainHeight(sx,sz)+0.1,sz); player.vel.set(0,0,0); player.yaw=Math.atan2(-sx,-sz); player.pitch=0;
  playerSlow=0; spawnTimer=3; critterTimer=2; miniTimer=90; miniActive=false; saveAccum=0;
  document.getElementById('bossbar').style.display='none'; buildHotbar(); renderQuests(); updateHUD(); updateResStrip(); updateGear();
  if(trader){scene.remove(trader.mesh);trader=null;} spawnTrader();
  spawnEnemy('bandit',sx+10,sz); spawnCritter('deer',sx-6,sz-6); spawnCritter('rabbit',sx+5,sz-4); }
function applySave(sv){ G.level=sv.level; G.xp=sv.xp; G.xpNext=sv.xpNext; G.gold=sv.gold; G.perks=sv.perks; G.hpMax=sv.hpMax; G.mpMax=sv.mpMax; G.spMax=sv.spMax; G.kills=sv.kills||0; G.dragonDead=!!sv.dragonDead; Object.assign(PERK,sv.perkLevels||{}); G.hp=G.hpMax; G.mp=G.mpMax; G.sp=G.spMax; if(sv.inv){ for(const k in INV)delete INV[k]; Object.assign(INV,sv.inv); } G.weapon=sv.weapon||'iron_sword'; G.armorItem=sv.armorItem||null; G.hasBow=!!sv.hasBow; G.defense=sv.defense||0; G.food=sv.food!=null?sv.food:100; buildHotbar(); renderQuests(); updateHUD(); updateResStrip(); updateGear(); }
function beginPlay(){ if(Audio.ctx&&Audio.ctx.state==='suspended')Audio.ctx.resume(); ['startMenu','deathPanel','winPanel','pauseMenu','skillsPanel','settingsPanel','craftPanel','tradePanel'].forEach(id=>document.getElementById(id).classList.add('hidden')); skillsOpen=craftOpen=tradeOpen=false; canvas.requestPointerLock(); }
function newGame(){ Audio.init(); regenerateWorld((Math.random()*1e9)|0); resetRun(); beginPlay(); saveGame(); toast('Прокинься, Довакіне!'); subtitle('Досліджуй світ. Поклич дракона біля вежі.'); }
function continueGame(){ Audio.init(); const sv=loadSave(); if(!sv){newGame();return;} resetRun(); applySave(sv); beginPlay(); toast('З поверненням!'); }
function respawn(){ resetRun(); beginPlay(); toast('Відродження'); }
function quitToMenu(){ G.started=false; G.over=false; G.paused=false; document.getElementById('pauseMenu').classList.add('hidden'); document.getElementById('continueBtn').style.display=hasSave()?'block':'none'; document.getElementById('startMenu').classList.remove('hidden'); document.exitPointerLock(); }

/* ---- налаштування ---- */
function applyAllSettings(){ if(Audio.master)Audio.master.gain.value=Settings.vol; camera.fov=Settings.fov; camera.updateProjectionMatrix(); scene.fog.density=0.7/Settings.view; }
function syncSet(){ const q=id=>document.getElementById(id); q('setSens').value=Settings.sens; q('setVol').value=Settings.vol; q('setFov').value=Settings.fov; q('setView').value=Settings.view; q('setSensV').textContent=Settings.sens.toFixed(1); q('setVolV').textContent=Math.round(Settings.vol*100)+'%'; q('setFovV').textContent=Settings.fov; q('setViewV').textContent=Settings.view; }
function openSettings(){ syncSet(); document.getElementById('settingsPanel').classList.remove('hidden'); }
function closeSettings(){ document.getElementById('settingsPanel').classList.add('hidden'); saveSettings(); }
const sS=document.getElementById('setSens'),sV=document.getElementById('setVol'),sF=document.getElementById('setFov'),sW=document.getElementById('setView');
sS.oninput=()=>{Settings.sens=+sS.value;syncSet();}; sV.oninput=()=>{Settings.vol=+sV.value;applyAllSettings();syncSet();}; sF.oninput=()=>{Settings.fov=+sF.value;applyAllSettings();syncSet();}; sW.oninput=()=>{Settings.view=+sW.value;applyAllSettings();syncSet();};
document.getElementById('startBtn').onclick=newGame; document.getElementById('continueBtn').onclick=continueGame; document.getElementById('respawnBtn').onclick=respawn; document.getElementById('winBtn').onclick=newGame; document.getElementById('resumeBtn').onclick=togglePause; document.getElementById('quitBtn').onclick=quitToMenu; document.getElementById('closeSkills').onclick=toggleSkills; document.getElementById('settingsBtn').onclick=openSettings; document.getElementById('closeSettings').onclick=closeSettings; document.getElementById('closeCraft').onclick=toggleCraft; document.getElementById('closeTrade').onclick=toggleTrade;

/* ============================= ІНІЦІАЛІЗАЦІЯ ============================= */
function init(){ setupComposer(); applyAllSettings(); document.getElementById('loadFill').style.width='25%';
  setTimeout(()=>{ const sv=loadSave(); const seed=sv?sv.seed:((Math.random()*1e9)|0); G.seed=seed; NSEED=seed|0; RNG=mulberry32(seed); generateWorld();
    document.getElementById('loadFill').style.width='80%'; buildViewmodel(); buildHotbar(); renderQuests();
    document.getElementById('continueBtn').style.display=sv?'block':'none'; document.getElementById('loadFill').style.width='100%';
    setTimeout(()=>document.getElementById('loadingOverlay').classList.add('hidden'),250); requestAnimationFrame(loop); },40); }
setTimeout(init,60);
})();
