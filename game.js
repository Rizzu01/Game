(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const menu = document.getElementById('menu');
  const pause = document.getElementById('pause');
  const victory = document.getElementById('victory');
  const hud = document.getElementById('hud');
  const mobile = document.getElementById('mobile-controls');
  const modeLabel = document.getElementById('mode-label');
  const objectiveLabel = document.getElementById('objective-label');
  const hpBar = document.getElementById('hp-bar');
  const shadowBar = document.getElementById('shadow-bar');
  const rewindBar = document.getElementById('rewind-bar');
  const toast = document.getElementById('toast');

  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const W = () => innerWidth;
  const H = () => innerHeight;
  let running = false, paused = false, levelComplete = false;
  let last = 0, shake = 0, toastTimer = 0;
  let camera = { x: 0, y: 0, zoom: 1 };
  const world = { w: 5400, h: 980, groundY: 820 };
  const keys = new Set();
  const touch = { left: false, right: false, jump: false, dash: false, switch: false, rewind: false, interact: false };

  const courier = {
    x: 280, y: 650, vx: 0, vy: 0, w: 34, h: 70, hp: 100, onGround: false, facing: 1,
    dash: 0, dashCd: 0, attack: 0, coyote: 0, invuln: 0
  };
  const shadow = {
    x: 220, y: 660, vx: 0, vy: 0, w: 30, h: 62, energy: 100, rewindCd: 0,
    history: [], active: false, intangible: false, onGround: false
  };
  let playerMode = 'courier';

  const platforms = [
    {x:0,y:820,w:1050,h:180,type:'solid'}, {x:1100,y:820,w:700,h:180,type:'solid'},
    {x:1850,y:820,w:820,h:180,type:'solid'}, {x:2740,y:820,w:650,h:180,type:'solid'},
    {x:3470,y:820,w:920,h:180,type:'solid'}, {x:4470,y:820,w:930,h:180,type:'solid'},
    {x:420,y:670,w:180,h:26,type:'solid'}, {x:780,y:585,w:190,h:26,type:'solid'},
    {x:1250,y:650,w:200,h:26,type:'solid'}, {x:1590,y:560,w:180,h:26,type:'solid'},
    {x:2050,y:650,w:190,h:26,type:'solid'}, {x:2420,y:535,w:200,h:26,type:'solid'},
    {x:3010,y:630,w:180,h:26,type:'solid'}, {x:3210,y:510,w:170,h:26,type:'solid'},
    {x:3650,y:640,w:220,h:26,type:'solid'}, {x:4050,y:550,w:180,h:26,type:'solid'},
    {x:4630,y:650,w:190,h:26,type:'solid'}, {x:5000,y:540,w:210,h:26,type:'solid'}
  ];
  const shadowWalls = [
    {x:1010,y:380,w:54,h:440},{x:1788,y:420,w:54,h:400},{x:2665,y:350,w:54,h:470},
    {x:3388,y:360,w:54,h:460},{x:4388,y:330,w:54,h:490},{x:4900,y:350,w:54,h:470}
  ];
  const switches = [
    {x:955,y:540,w:24,h:45,active:false,linked:0},
    {x:1740,y:515,w:24,h:45,active:false,linked:1},
    {x:2600,y:490,w:24,h:45,active:false,linked:2},
    {x:3375,y:450,w:24,h:45,active:false,linked:3}
  ];
  const doors = [
    {x:1032,y:575,w:58,h:245,open:false,t:0},
    {x:1810,y:575,w:58,h:245,open:false,t:0},
    {x:2690,y:575,w:58,h:245,open:false,t:0},
    {x:3415,y:575,w:58,h:245,open:false,t:0}
  ];
  const enemies = [
    {x:1320,y:760,w:32,h:54,vx:0,base:1320,range:110,dir:1,type:'guard',hp:2,state:'patrol',hit:0},
    {x:2280,y:760,w:32,h:54,vx:0,base:2280,range:130,dir:-1,type:'hunter',hp:2,state:'patrol',hit:0},
    {x:3020,y:576,w:32,h:54,vx:0,base:3020,range:100,dir:1,type:'guard',hp:2,state:'patrol',hit:0}
  ];
  const boss = {x:4960,y:640,w:110,h:150,hp:10,maxHp:10,active:false,mirroring:false,attack:0,flash:0};

  let particles = [];
  let fragments = 0;
  let objective = 0;

  function resize() { canvas.width = Math.floor(W()*DPR); canvas.height = Math.floor(H()*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); }
  addEventListener('resize', resize); resize();

  function isDown(k){ return keys.has(k); }
  function pressed(k){ const v = keys.has(k); keys.delete(k); return v; }
  function consumeTouches(){ const t={...touch}; touch.jump=touch.dash=touch.switch=touch.rewind=touch.interact=false; return t; }

  addEventListener('keydown', e => {
    const k=e.key.toLowerCase();
    if([' ','arrowleft','arrowright','arrowup'].includes(e.key.toLowerCase())) e.preventDefault();
    if(k==='escape'){ if(running) togglePause(); return; }
    keys.add(k);
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  function toastMsg(text){ toast.textContent=text; toast.classList.add('toast-show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('toast-show'),1600); }

  function reset(){
    Object.assign(courier,{x:280,y:650,vx:0,vy:0,hp:100,onGround:false,facing:1,dash:0,dashCd:0,attack:0,coyote:0,invuln:0});
    Object.assign(shadow,{x:220,y:660,vx:0,vy:0,energy:100,rewindCd:0,history:[],active:false,intangible:false,onGround:false});
    playerMode='courier'; objective=0; fragments=0;
    switches.forEach(s=>s.active=false); doors.forEach(d=>{d.open=false;d.t=0});
    enemies.splice(0,enemies.length,
      {x:1320,y:760,w:32,h:54,vx:0,base:1320,range:110,dir:1,type:'guard',hp:2,state:'patrol',hit:0},
      {x:2280,y:760,w:32,h:54,vx:0,base:2280,range:130,dir:-1,type:'hunter',hp:2,state:'patrol',hit:0},
      {x:3020,y:576,w:32,h:54,vx:0,base:3020,range:100,dir:1,type:'guard',hp:2,state:'patrol',hit:0}
    );
    Object.assign(boss,{x:4960,y:640,w:110,h:150,hp:10,maxHp:10,active:false,mirroring:false,attack:0,flash:0});
    particles=[]; camera={x:0,y:0,zoom:1}; levelComplete=false;
    setObjective('Reach the security checkpoint');
  }

  function setObjective(text){ objectiveLabel.textContent=text; }
  function start(){ reset(); running=true; paused=false; menu.classList.remove('visible'); pause.classList.remove('visible'); victory.classList.remove('visible'); hud.style.display='block'; if(matchMedia('(pointer:coarse)').matches) mobile.style.display='block'; toastMsg('Courier link established'); }
  function togglePause(){ if(levelComplete) return; paused=!paused; pause.classList.toggle('visible',paused); }
  document.getElementById('start-btn').onclick=start;
  document.getElementById('resume-btn').onclick=togglePause;
  document.getElementById('restart-btn').onclick=()=>{paused=false;start()};
  document.getElementById('again-btn').onclick=start;
  document.getElementById('pause-btn').onclick=togglePause;

  document.querySelectorAll('[data-action]').forEach(btn=>{
    const action=btn.dataset.action;
    const on=()=>{touch[action]=true};
    btn.addEventListener('pointerdown',e=>{e.preventDefault();on()},{passive:false});
  });
  const joy=document.getElementById('joy'); const stick=joy.querySelector('.stick'); let joyId=null;
  joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(joyId); updateJoy(e)});
  joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)updateJoy(e)});
  joy.addEventListener('pointerup',()=>{joyId=null;touch.left=touch.right=false;stick.style.transform='translate(0,0)'});
  function updateJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=Math.min(r.width*.36,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);const x=Math.cos(a)*m,y=Math.sin(a)*m;stick.style.transform=`translate(${x}px,${y}px)`;touch.left=dx<-14;touch.right=dx>14;}

  function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function collision(entity, dx,dy, allowShadow=false){
    let hit=false;
    entity.x+=dx;
    for(const p of platforms){ if(rectHit(entity,p)){ if(dx>0) entity.x=p.x-entity.w; else if(dx<0) entity.x=p.x+p.w; hit=true; entity.vx=0; }}
    for(const d of doors){ if(!d.open && rectHit(entity,d) && !(allowShadow && entity===shadow)){ if(dx>0) entity.x=d.x-entity.w; else if(dx<0) entity.x=d.x+d.w; hit=true; entity.vx=0; }}
    entity.y+=dy;
    entity.onGround=false;
    for(const p of platforms){ if(rectHit(entity,p)){ if(dy>0){entity.y=p.y-entity.h;entity.vy=0;entity.onGround=true;} else if(dy<0){entity.y=p.y+p.h;entity.vy=0;} hit=true; }}
    for(const d of doors){ if(!d.open && rectHit(entity,d) && !(allowShadow && entity===shadow)){ if(dy>0){entity.y=d.y-entity.h;entity.vy=0;entity.onGround=true;} else {entity.y=d.y+d.h;entity.vy=0;} hit=true; }}
    return hit;
  }

  function moveCourier(dt,t){
    const left=isDown('a')||isDown('arrowleft')||touch.left, right=isDown('d')||isDown('arrowright')||touch.right;
    const dir=(right?1:0)-(left?1:0); const accel=1450, max=300;
    courier.vx += dir*accel*dt; courier.vx *= Math.pow(.0008,dt); courier.vx=Math.max(-max,Math.min(max,courier.vx)); if(dir) courier.facing=dir;
    const jump=pressed(' ')||pressed('w')||touch.jump; if(jump && (courier.onGround||courier.coyote>0)){courier.vy=-610;courier.onGround=false;courier.coyote=0;burst(courier.x+15,courier.y+courier.h,10,'#f7d51d')}
    const dash=pressed('shift')||touch.dash; if(dash&&courier.dashCd<=0){courier.dash=.15;courier.dashCd=.75;courier.vx=900*courier.facing;courier.vy*=.25;burst(courier.x,courier.y+30,14,'#5ee7ff');shake=5}
    if(courier.dash>0){courier.dash-=dt; courier.vx*=.985}else{courier.vy+=1450*dt}
    if(courier.attack>0)courier.attack-=dt; if(pressed('e')||touch.interact){interact()}
    courier.coyote=Math.max(0,courier.coyote-dt); courier.dashCd=Math.max(0,courier.dashCd-dt); courier.invuln=Math.max(0,courier.invuln-dt);
    const wasGround=courier.onGround; collision(courier,courier.vx*dt, courier.vy*dt); if(wasGround&&!courier.onGround)courier.coyote=.08;
    if(pressed('q')||touch.switch)switchMode();
    if(courier.y>1100) damage(25);
    updateAttack(t);
  }

  function moveShadow(dt){
    const left=isDown('a')||isDown('arrowleft')||touch.left,right=isDown('d')||isDown('arrowright')||touch.right;
    const dir=(right?1:0)-(left?1:0); const max=330; shadow.vx += dir*1250*dt; shadow.vx*=Math.pow(.0015,dt); shadow.vx=Math.max(-max,Math.min(max,shadow.vx));
    if(dir) shadow.facing=dir;
    const jump=pressed(' ')||pressed('w')||touch.jump; if(jump&&shadow.onGround){shadow.vy=-570;shadow.onGround=false;burst(shadow.x+12,shadow.y+60,8,'#9a7bff')}
    shadow.vy+=980*dt;
    const before={x:shadow.x,y:shadow.y};
    collision(shadow,shadow.vx*dt,shadow.vy*dt,true);
    if(shadow.intangible){
      for(const wall of shadowWalls){if(rectHit(shadow,wall)){shadow.x+=shadow.vx*dt*.65;shadow.y+=shadow.vy*dt*.65}}
      shadow.y=Math.max(200,Math.min(790,shadow.y));
    }
    shadow.history.push({x:before.x,y:before.y}); if(shadow.history.length>180)shadow.history.shift();
    if(shadow.energy<100)shadow.energy=Math.min(100,shadow.energy+7*dt);
    shadow.rewindCd=Math.max(0,shadow.rewindCd-dt);
    if(pressed('r')||touch.rewind)rewindShadow();
    if(pressed('e')||touch.interact)interact();
    if(pressed('q')||touch.switch)switchMode();
  }

  function switchMode(){ if(!running||paused||levelComplete)return; playerMode=playerMode==='courier'?'shadow':'courier'; shadow.active=playerMode==='shadow'; burst(playerMode==='shadow'?shadow.x:courier.x,playerMode==='shadow'?shadow.y:courier.y,18,playerMode==='shadow'?'#9a7bff':'#f7d51d'); shake=3; toastMsg(playerMode==='shadow'?'SHADOW LINK':'COURIER LINK'); }
  function rewindShadow(){ if(playerMode!=='shadow'||shadow.rewindCd>0||shadow.history.length<10||shadow.energy<25)return; const n=Math.min(90,shadow.history.length-1); const target=shadow.history[shadow.history.length-1-n]; shadow.x=target.x;shadow.y=target.y;shadow.vx=0;shadow.vy=0;shadow.history.length=Math.max(0,shadow.history.length-1-n);shadow.energy-=25;shadow.rewindCd=1.4;burst(shadow.x,shadow.y+30,28,'#9a7bff');shake=7;toastMsg('3 SECOND REWIND');}

  function interact(){
    const actor=playerMode==='shadow'?shadow:courier;
    for(const s of switches){ if(Math.abs((actor.x+actor.w/2)-s.x)<70&&Math.abs((actor.y+actor.h/2)-s.y)<90){s.active=true;const d=doors[s.linked];d.open=true;d.t=3.8;toastMsg('SHADOW SWITCH // DOOR OPEN');burst(s.x,s.y,20,'#5ee7ff');objective=Math.max(objective,s.linked+1);updateObjective();}}
    if(playerMode==='courier'){for(const e of enemies){if(Math.abs(actor.x-e.x)<72&&Math.abs(actor.y-e.y)<90){courier.attack=.22;e.hp--;e.hit=.2;burst(e.x,e.y,10,'#f7d51d');shake=4;if(e.hp<=0)e.dead=true;}}}
  }
  function updateAttack(t){ if(courier.attack<=0)return; for(const e of enemies){if(e.dead)continue; if(Math.abs((courier.x+17)-e.x)<65 && Math.abs((courier.y+35)-e.y)<65){e.hp-=.02;e.hit=.15; if(e.hp<=0)e.dead=true;} } }
  function damage(n){if(courier.invuln>0)return;courier.hp=Math.max(0,courier.hp-n);courier.invuln=.75;shake=10;burst(courier.x,courier.y+30,18,'#ff405a');if(courier.hp<=0){toastMsg('SIGNAL LOST — RESTARTING');setTimeout(()=>{if(running)reset()},900)}}

  function updateEnemies(dt){
    for(const e of enemies){ if(e.dead)continue; e.hit=Math.max(0,e.hit-dt); const target= e.type==='hunter'&&playerMode==='shadow'?shadow:courier; const dist=Math.abs((target.x+target.w/2)-(e.x+e.w/2));
      if(dist<310 && Math.abs(target.y-e.y)<130 && !(target===shadow&&shadow.intangible)){e.state='chase';e.dir=target.x<e.x?-1:1;}
      else {e.state='patrol';if(Math.abs(e.x-e.base)>e.range)e.dir*=-1;}
      e.vx += e.dir*(e.state==='chase'?600:420)*dt; e.vx*=Math.pow(.02,dt); e.vx=Math.max(-e.state==='chase'?100:65,Math.min(e.state==='chase'?100:65,e.vx));
      e.x += e.vx*dt;
      if(dist<45&&Math.abs(target.y-e.y)<70 && target===courier)damage(.45);
    }
  }

  function updateBoss(dt){
    if(courier.x<4540){boss.active=false;return} boss.active=true;
    setObjective('Face The Mirror — use both bodies');
    if(boss.hp<=0){if(!levelComplete){levelComplete=true;setTimeout(()=>showVictory(),500)}return}
    const target=playerMode==='shadow'?shadow:courier; const dx=target.x-boss.x; boss.mirroring=Math.abs(dx)<620;
    if(boss.mirroring){boss.x += Math.sign(dx)*95*dt;boss.y=world.groundY-boss.h;boss.attack-=dt;
      if(boss.attack<=0&&Math.abs(dx)<135){boss.attack=.85;damage(6);burst(boss.x+50,boss.y+60,18,'#9a7bff');shake=8}
      if(playerMode==='courier'&&courier.attack>0&&Math.abs(dx)<130){boss.hp-=1;boss.flash=.12;burst(boss.x+50,boss.y+70,16,'#f7d51d');shake=9}
      if(playerMode==='shadow'&&shadow.active&&Math.abs(dx)<130){boss.hp-=.45;boss.flash=.12;burst(boss.x+50,boss.y+70,10,'#5ee7ff')}
    }
    boss.flash=Math.max(0,boss.flash-dt);
  }

  function updateDoors(dt){for(const d of doors){if(d.t>0){d.t-=dt;if(d.t<=0)d.open=false}}}
  function updateObjective(){if(objective>=4)setObjective('Reach the Mirror arena');else if(objective>=2)setObjective('Push deeper through the facility');else if(objective>=1)setObjective('Find the next security switch')}
  function showVictory(){running=false;hud.style.display='none';mobile.style.display='none';victory.classList.add('visible');document.getElementById('victory-stats').textContent=`Neon Slums secured. Switches: ${switches.filter(s=>s.active).length}/4 · Memory fragments: ${fragments}`}

  function burst(x,y,count,color){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*260;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:.35+Math.random()*.45,color,r:1+Math.random()*2})}}
  function updateParticles(dt){particles=particles.filter(p=>(p.l-=dt)>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;p.vx*=.98}}

  function draw(t){
    const w=W(),h=H(); ctx.clearRect(0,0,w,h);
    const sx=(Math.random()-.5)*shake,sy=(Math.random()-.5)*shake; shake*=.88;
    const target=playerMode==='shadow'?shadow:courier; camera.x+=(target.x- w*.45-camera.x)*.08; camera.y+=(target.y-h*.52-camera.y)*.06;
    camera.x=Math.max(0,Math.min(world.w-w,camera.x));camera.y=Math.max(0,Math.min(world.h-h,camera.y));
    ctx.save();ctx.translate(sx,sy);ctx.translate(-camera.x,-camera.y);
    drawSky(t);drawBackBuildings();drawPlatforms();drawDoors();drawSwitches(t);drawEnemies();drawBoss();drawShadow();drawCourier(t);drawParticles();ctx.restore();
  }
  function drawSky(t){ctx.fillStyle='#07080c';ctx.fillRect(camera.x,camera.y,W(),H());const grd=ctx.createLinearGradient(0,0,0,world.h);grd.addColorStop(0,'#0a0f19');grd.addColorStop(.65,'#07080c');grd.addColorStop(1,'#04050a');ctx.fillStyle=grd;ctx.fillRect(camera.x,0,W(),world.h);for(let i=0;i<30;i++){const x=(i*197)%world.w,y=100+(i*89)%500;ctx.fillStyle=i%3===0?'rgba(94,231,255,.35)':'rgba(247,213,29,.18)';ctx.fillRect(x,y,2,2)} }
  function drawBackBuildings(){for(let i=0;i<42;i++){const x=i*145-40;const bh=150+(i*71)%360;ctx.fillStyle=i%2?'#0d121c':'#0a0e16';ctx.fillRect(x,world.groundY-bh,120,bh);for(let r=0;r<5;r++)for(let c=0;c<2;c++){if((r+c+i)%3!==0){ctx.fillStyle=(i+r)%4===0?'rgba(94,231,255,.35)':'rgba(247,213,29,.22)';ctx.fillRect(x+16+c*42,world.groundY-bh+22+r*48,13,20)}}}ctx.fillStyle='rgba(154,123,255,.06)';ctx.fillRect(0,0,world.w,world.groundY)}
  function drawPlatforms(){for(const p of platforms){ctx.fillStyle='#111722';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='rgba(94,231,255,.28)';ctx.lineWidth=2;ctx.strokeRect(p.x,p.y,p.w,2);ctx.fillStyle='rgba(247,213,29,.06)';ctx.fillRect(p.x,p.y,p.w,8)}}
  function drawDoors(){for(const d of doors){if(d.open){ctx.strokeStyle='rgba(94,231,255,.55)';ctx.strokeRect(d.x+11,d.y,36,d.h);continue}ctx.fillStyle='#161b25';ctx.fillRect(d.x,d.y,d.w,d.h);ctx.fillStyle='#f7d51d';ctx.globalAlpha=.12;ctx.fillRect(d.x+9,d.y+12,4,d.h-24);ctx.fillRect(d.x+d.w-13,d.y+12,4,d.h-24);ctx.globalAlpha=1;}}
  function drawSwitches(t){for(const s of switches){const pulse=1+Math.sin(t*5+s.x)*.1;ctx.save();ctx.translate(s.x,s.y);ctx.scale(pulse,pulse);ctx.fillStyle=s.active?'#5ee7ff':'#202633';ctx.fillRect(-10,-21,20,38);ctx.strokeStyle=s.active?'#5ee7ff':'#525b6e';ctx.strokeRect(-10,-21,20,38);ctx.fillStyle=s.active?'#f7d51d':'#6a7384';ctx.fillRect(-4,-13,8,21);ctx.restore();}}
  function drawEnemies(){for(const e of enemies){if(e.dead)continue;ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle=e.hit>0?'#fff':'#191e2a';ctx.fillRect(0,0,e.w,e.h);ctx.fillStyle=e.type==='hunter'?'#9a7bff':'#f7d51d';ctx.fillRect(5,12,22,6);ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(7,28,18,3);ctx.restore()}}
  function drawBoss(){if(!boss.active)return;ctx.save();ctx.translate(boss.x,boss.y);ctx.fillStyle=boss.flash>0?'#fff':'#11151f';ctx.shadowBlur=22;ctx.shadowColor='#9a7bff';ctx.fillRect(0,0,boss.w,boss.h);ctx.shadowBlur=0;ctx.strokeStyle='#9a7bff';ctx.lineWidth=3;ctx.strokeRect(4,4,boss.w-8,boss.h-8);ctx.fillStyle='#f7d51d';ctx.fillRect(27,38,56,8);ctx.fillStyle='#5ee7ff';ctx.fillRect(22,70,66,5);ctx.restore();ctx.save();ctx.translate(boss.x,boss.y-20);ctx.fillStyle='rgba(7,8,12,.88)';ctx.fillRect(0,0,boss.w,8);ctx.fillStyle='#9a7bff';ctx.fillRect(0,0,boss.w*(boss.hp/boss.maxHp),8);ctx.restore()}
  function drawCourier(t){ctx.save();ctx.translate(courier.x,courier.y);if(courier.invuln>0&&Math.floor(t*18)%2===0)ctx.globalAlpha=.45;ctx.fillStyle='#11151d';ctx.fillRect(5,18,24,45);ctx.fillStyle='#f7d51d';ctx.fillRect(8,8,18,18);ctx.fillStyle='#0b0d12';ctx.fillRect(courier.facing>0?21:7,13,5,3);ctx.fillStyle='#5ee7ff';ctx.fillRect(7,57,9,12);ctx.fillRect(19,57,9,12);if(courier.attack>0){ctx.strokeStyle='#f7d51d';ctx.lineWidth=5;ctx.beginPath();ctx.arc(courier.facing>0?31:3,35,24,courier.facing>0?-0.9:Math.PI+0.2,courier.facing>0?0.9:Math.PI-.2);ctx.stroke()}ctx.restore()}
  function drawShadow(){ctx.save();ctx.translate(shadow.x,shadow.y);ctx.globalAlpha=playerMode==='shadow'?1:.58;ctx.shadowBlur=18;ctx.shadowColor='#9a7bff';ctx.fillStyle='#05060a';ctx.beginPath();ctx.roundRect(3,10,24,48,12);ctx.fill();ctx.fillStyle='#9a7bff';ctx.fillRect(7,6,16,12);ctx.fillStyle='#5ee7ff';ctx.fillRect(8,29,14,3);ctx.shadowBlur=0;ctx.restore()}
  function drawParticles(){for(const p of particles){ctx.globalAlpha=Math.max(0,p.l);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r)}ctx.globalAlpha=1}

  function updateHud(){modeLabel.textContent=playerMode==='courier'?'COURIER':'SHADOW';hpBar.style.width=`${courier.hp}%`;shadowBar.style.width=`${shadow.energy}%`;rewindBar.style.width=`${Math.max(0,100-shadow.rewindCd/1.4*100)}%`}

  function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;if(running&&!paused){if(playerMode==='courier')moveCourier(dt,t/1000);else moveShadow(dt);updateEnemies(dt);updateBoss(dt);updateDoors(dt);updateParticles(dt);updateHud();}draw(t/1000);requestAnimationFrame(loop)}requestAnimationFrame(loop);
})();
