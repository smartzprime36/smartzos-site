/* ============ SmartzOS v4.2 — Synergy Mesh ============ */
/* One nervous system: event bus, global HUD, economy flow, rank perks, chained quest */

/* ================= EVENT BUS ================= */
const SMARTZ_BUS={
  subs:{},
  on(ev,fn){(this.subs[ev]=this.subs[ev]||[]).push(fn);},
  emit(ev,data){
    (this.subs[ev]||[]).forEach(fn=>{try{fn(data||{})}catch(e){}});
    (this.subs['*']||[]).forEach(fn=>{try{fn(ev,data||{})}catch(e){}});
    MESH.events.unshift({ev:ev,ts:Date.now(),data:data||{}});
    MESH.events=MESH.events.slice(0,50);
    updateHUD();
  }
};
const MESHKEY='smartz_mesh_v1';
let MESH=loadMesh();
function loadMesh(){try{const m=JSON.parse(localStorage.getItem(MESHKEY));if(m)return m;}catch(e){}
  return {events:[],stats:{earned:0,spent:0,geTrades:0,cityProd:0,academyXp:0,questStep:0,questDone:false}};}
function saveMesh(){localStorage.setItem(MESHKEY,JSON.stringify(MESH));}

/* ================= GLOBAL HUD ================= */
document.body.insertAdjacentHTML('afterbegin','<div id="hud"></div>');
document.body.classList.add('hud-on');
function updateHUD(){
  const b=SMARTZ_STATE.balances,el=document.getElementById('hud');if(!el)return;
  el.innerHTML='<span>◈ <b>SMARTZOS</b></span><span class="sep">|</span>'+
    '<span class="h-cr">● <b>'+G.credits+'</b> cr</span>'+
    '<span class="h-xp">🎓 <b>'+(AC?AC.xp:0)+'</b> XP</span>'+
    '<span>🏙 Lv<b>'+(CITY?CITY.level:1)+'</b></span>'+
    '<span class="h-rank">'+SMARTZ_STATE.rank.toUpperCase()+'</span>'+
    '<span class="sep">|</span>'+
    '<span class="hud-bal">🐻 '+fmtBal(b.SMRT)+'</span><span class="hud-bal">🐂 '+fmtBal(b.SMF)+'</span><span class="hud-bal">🔥 '+fmtBal(b.SMC)+'</span>'+
    '<span class="sep">|</span><span style="margin-left:auto;color:#2ee6a8">MESH SYNCED</span>';
}
function fmtBal(v){return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':(v||0);}
setInterval(updateHUD,5000);setTimeout(updateHUD,1500);

/* ================= RANK PERKS (consulted everywhere) ================= */
function perks(){
  const r=SMARTZ_STATE.rank;
  return {
    geSlots:r==='Coherent'?10:r==='Bladebearer'||r==='Sentinel'?8:6,
    cityDiscount:r==='Sentinel'||r==='Coherent'?0.85:1,   // Sentinel: 15% off upgrades
    xpBoost:r==='Coherent'?2:r==='Bladebearer'?1.5:1,       // Coherent: 2x Academy XP
    paperBonus:r==='Coherent'?2:1,
    label:{
      'Unverified':'No perks yet — connect & climb',
      'Tunnel-Cleared':'Base access: 6 GE slots',
      'Bladebearer':'8 GE slots · 1.5× Academy XP',
      'Sentinel':'8 GE slots · 15% city discount · 1.5× XP',
      'Coherent':'10 GE slots · 15% city discount · 2× XP · 2× paper P&L badge'
    }[r]
  };
}
/* apply GE slot perk */
const _placeOffer=window.placeOffer;
window.placeOffer=function(side){
  if(geSel&&GE.offers.length>=perks().geSlots){
    // temporarily bypass the hardcoded 6-slot block by allowing if perk grants more
    if(perks().geSlots>6){
      const qty=Math.max(1,parseInt(document.getElementById('geQty').value)||0);
      const price=Math.max(1,parseFloat(document.getElementById('gePrice').value)||0);
      if(side==='buy'){const cost=Math.ceil(qty*price);if(G.credits<cost){notify('Exchange','Not enough credits.','warn');return;}G.credits-=cost;}
      else{if((G.inv[geSel]||0)<qty){notify('Exchange','Insufficient items.','warn');return;}G.inv[geSel]-=qty;}
      GE.offers.push({id:Date.now()+Math.random(),item:geSel,side:side,qty:qty,filled:0,price:price,ts:Date.now()});
      geLog('Placed '+side.toUpperCase()+' offer (rank slot '+(GE.offers.length)+'/'+perks().geSlots+')',side==='buy'?'b':'s');
      saveGE();saveGame();renderGE();renderGame();
      SMARTZ_BUS.emit('ge.offer',{side:side,item:geSel,qty:qty,price:price});
      return;
    }
  }
  _placeOffer(side);
  SMARTZ_BUS.emit('ge.offer',{side:side,item:geSel});
};
/* city discount perk */
const _upgradeTile=window.upgradeTile;
window.upgradeTile=function(i){
  const t=CITY.tiles[i];if(!t)return;
  const base=Math.ceil(50*t.lv*1.5),disc=Math.ceil(base*perks().cityDiscount);
  if(G.credits<disc){notify('Triad City','Need '+disc+' credits.','warn');return;}
  G.credits-=disc;t.lv++;CITY.xp+=15;checkLevel();
  MESH.stats.spent+=disc;
  saveCity();saveGame();renderCity();renderGame();
  notify('Triad City',BUILDINGS[t.type].name+' → Lv'+t.lv+(perks().cityDiscount<1?' (Sentinel discount applied)':''),'ok');
  SMARTZ_BUS.emit('city.upgrade',{type:t.type,lv:t.lv});
};
const _build2=window.build;
window.build=function(type){
  const bd=BUILDINGS[type];
  if(!canAfford(bd.cost)||selTile===null)return;
  _build2(type);
  MESH.stats.spent+=(bd.cost.credits||0);
  SMARTZ_BUS.emit('city.build',{type:type});
};
/* academy XP perk + stats */
const _answer=window.answer;
window.answer=function(id,choice,correct,xp){
  const wasDone=AC.done[id];
  const boosted=Math.round(xp*perks().xpBoost);
  // grant boosted xp by adjusting after base answer if correct
  _answer(id,choice,correct,xp);
  if(!wasDone&&AC.done[id]&&perks().xpBoost>1){
    AC.xp+=(boosted-xp);G.credits+=(boosted-xp);saveAC();saveGame();
    notify('◈ Rank Perk','+'+(boosted-xp)+' bonus XP ('+perks().xpBoost+'× multiplier)','ok');
  }
  if(!wasDone&&AC.done[id]){
    MESH.stats.academyXp+=boosted;MESH.stats.earned+=boosted;
    SMARTZ_BUS.emit('academy.lesson',{id:id,xp:boosted});
  }
};
/* economy stats: wraps for GE fills & credits */
const _buyItem=window.buyItem,_sellItem=window.sellItem;
window.buyItem=function(k){const p=Math.ceil(G.prices[k]);_buyItem(k);MESH.stats.spent+=p;MESH.stats.geTrades++;SMARTZ_BUS.emit('trade',{act:'buy',item:k});};
window.sellItem=function(k){const p=Math.floor(G.prices[k]);_sellItem(k);MESH.stats.earned+=p;MESH.stats.geTrades++;SMARTZ_BUS.emit('trade',{act:'sell',item:k});};
const _fuse=window.fuse;
window.fuse=function(i){const before=G.artifacts;_fuse(i);if(G.artifacts>before){SMARTZ_BUS.emit('forge',{out:RECIPES[i].out});}};
const _startRun=window.startRun;
window.startRun=function(){_startRun();SMARTZ_BUS.emit('tunnel.start',{});};
/* tunnel clear detection via rank flag change */
setInterval(()=>{
  if(SMARTZ_STATE.tunnelCleared&&!MESH._tunnelEmitted){MESH._tunnelEmitted=true;SMARTZ_BUS.emit('tunnel.clear',{});}
},3000);
const _quickBuy=window.quickBuy;
window.quickBuy=function(sym){_quickBuy(sym);SMARTZ_BUS.emit('swap.arm',{sym:sym});};

/* ================= ECONOMY FLOW WINDOW ================= */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-economy" style="top:70px;left:180px;width:600px;height:640px">
  <div class="titlebar"><span">◈</span><span class="ttl">Synergy Mesh — Economy Flow & Perks</span>
    <button class="tbtn" onclick="maxWin('win-economy')">□</button><button class="tbtn" onclick="closeApp('economy')">✕</button></div>
  <div class="win-body">
    <div class="tabs">
      <div class="tab active" id="tab-ec-flow" onclick="ecTab('flow')">◈ Flow</div>
      <div class="tab" id="tab-ec-perks" onclick="ecTab('perks')">⚡ Rank Perks</div>
      <div class="tab" id="tab-ec-quest" onclick="ecTab('quest')">⛓ Full Circuit</div>
      <div class="tab" id="tab-ec-events" onclick="ecTab('events')">📡 Live Bus</div>
    </div>
    <div id="pane-ec-flow"></div>
    <div id="pane-ec-perks" style="display:none"></div>
    <div id="pane-ec-quest" style="display:none"></div>
    <div id="pane-ec-events" style="display:none"></div>
  </div>
</div>`);
(function(){
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">◈</div><div class="lbl">Synergy Mesh</div>';
  d.onclick=()=>openApp('economy');document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>◈</span><span>Synergy Mesh</span>';
  s.onclick=()=>{openApp('economy');document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
  const w=document.getElementById('win-economy');
  w.addEventListener('mousedown',()=>w.style.zIndex=++zTop);
  const bar=w.querySelector('.titlebar');
  bar.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('tbtn')||w.classList.contains('max')||window.innerWidth<=768)return;
    const r=w.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
    const mv=ev=>{w.style.left=(ev.clientX-ox)+'px';w.style.top=Math.max(0,ev.clientY-oy)+'px'};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
})();
function ecTab(t){
  ['flow','perks','quest','events'].forEach(x=>{
    document.getElementById('pane-ec-'+x).style.display=x===t?'block':'none';
    document.getElementById('tab-ec-'+x).classList.toggle('active',x===t);
  });
  renderEconomy();
}
const FLOW_NODES=[
  {i:'🌀',n:'Liquidity Tunnel',app:'game',role:'FAUCET — shards & credits for learning',stat:()=>G.runs+' runs cleared'},
  {i:'🎓',n:'Smartz Academy',app:'academy',role:'FAUCET — XP converts to credits',stat:()=>MESH.stats.academyXp+' XP earned'},
  {i:'📈',n:'Trading Post',app:'game',role:'EXCHANGE — shards ⇄ credits',stat:()=>MESH.stats.geTrades+' trades'},
  {i:'🏦',n:'Grand Exchange',app:'ge',role:'EXCHANGE — offer-driven price discovery',stat:()=>GE.offers.length+' live offers'},
  {i:'🏙',n:'Triad City',app:'city',role:'SINK & ENGINE — credits → districts → production',stat:()=>'Level '+CITY.level+' · '+CITY.pop+' pop'},
  {i:'⚗',n:'Fusion Lab',app:'game',role:'SINK — shards → sigils → Trinity Core',stat:()=>G.artifacts+' artifacts forged'},
  {i:'🔥',n:'Burn-to-Forge',app:'game',role:'ON-CHAIN SINK — real SMC burned for attestation',stat:()=>getAttestations().length+' attestations'},
  {i:'⚡',n:'Jupiter Swap',app:'swap',role:'ON-RAMP — SOL → SMRT/SMF/SMC, fuels rank & perks',stat:()=>SMARTZ_STATE.rank},
];
function renderEconomy(){
  const p=perks();
  document.getElementById('pane-ec-flow').innerHTML=
    '<div class="card" style="display:flex;gap:14px;padding:10px 14px">'+
    '<div><div style="font-size:10px;color:var(--dim)">EARNED (all-time)</div><div class="bigstat flow-in" style="font-size:18px">+'+MESH.stats.earned+'</div></div>'+
    '<div><div style="font-size:10px;color:var(--dim)">DEPLOYED</div><div class="bigstat flow-out" style="font-size:18px">−'+MESH.stats.spent+'</div></div>'+
    '<div><div style="font-size:10px;color:var(--dim)">NET FLOW</div><div class="bigstat" style="font-size:18px;color:'+(MESH.stats.earned-MESH.stats.spent>=0?'#2ee6a8':'#ff5c6a')+'">'+(MESH.stats.earned-MESH.stats.spent>=0?'+':'')+(MESH.stats.earned-MESH.stats.spent)+'</div></div></div>'+
    '<div class="flow-map">'+FLOW_NODES.map((n,i)=>
      (i?'<div class="flow-arrow">▼</div>':'')+
      '<div class="flow-node" onclick="openApp(\''+n.app+'\')"><span class="fi">'+n.i+'</span>'+
      '<span class="fn"><b>'+n.n+'</b><div style="font-size:10px;color:var(--dim)">'+n.role+'</div></span>'+
      '<span class="fs">'+n.stat()+'</span></div>').join('')+'</div>';
  document.getElementById('pane-ec-perks').innerHTML=
    '<div class="card"><h4>Your rank: <span style="color:#e04fff">'+SMARTZ_STATE.rank+'</span></h4>'+
    '<div style="font-size:12px;color:var(--dim);margin-bottom:10px">'+p.label+'</div>'+
    [['geSlots','GE offer slots',p.geSlots],['xpBoost','Academy XP multiplier',p.xpBoost+'×'],
     ['cityDiscount','City upgrade cost',(p.cityDiscount*100)+'%'],['paperBonus','Paper P&L badge',p.paperBonus+'×']].map(([k,n,v])=>
    '<div class="perk-row '+(String(v)!==String({geSlots:6,xpBoost:'1×',cityDiscount:'100%',paperBonus:'1×'}[k])?'on':'')+'">'+
    '<span>'+n+'</span><span class="pk '+(String(v)!==String({geSlots:6,xpBoost:'1×',cityDiscount:'100%',paperBonus:'1×'}[k])?'up':'')+'">'+v+'</span></div>').join('')+
    '<div style="font-size:11px;color:var(--dim);margin-top:8px">Perks apply instantly across every app when your on-chain balances change. Climb the ladder: hold SMF → SMRT stake → full triad.</div></div>';
  renderQuest();renderEvents();
}
/* ---- FULL CIRCUIT QUEST ---- */
const QUEST=[
  {ev:'swap.arm',t:'Arm a Jupiter swap',d:'Route SOL toward the triad in the live terminal'},
  {ev:'tunnel.clear',t:'Clear the Liquidity Tunnel',d:'Finish a full 5-stage run'},
  {ev:'academy.lesson',t:'Pass an Academy lesson',d:'Convert knowledge into XP & credits'},
  {ev:'trade',t:'Trade at the Exchange or Trading Post',d:'Put your shards to work in the market'},
  {ev:'city.build',t:'Raise a district in Triad City',d:'Deploy credits into production'},
  {ev:'forge',t:'Forge in the Fusion Lab',d:'Combine shards into a sigil'},
];
function renderQuest(){
  const el=document.getElementById('pane-ec-quest');
  const step=MESH.stats.questStep;
  el.innerHTML='<div class="card"><h4>⛓ The Full Circuit — one token journey through every system</h4>'+
    '<div style="font-size:11px;color:var(--dim);margin-bottom:10px">Complete all six in order. Reward: <b style="color:#e8c15a">500 credits + Circuit Master badge</b>. Progress saves.</div>'+
    QUEST.map((q,i)=>{
      const st=i<step?'done':i===step?'cur':'';
      return '<div class="quest-step '+st+'"><span class="qn">'+(i<step?'✓':i+1)+'</span>'+
        '<div><b>'+q.t+'</b><div style="font-size:10px;color:var(--dim)">'+q.d+'</div></div></div>';
    }).join('')+
    (MESH.stats.questDone?'<div class="banner" style="text-align:center;margin-top:10px"><b style="color:#e8c15a">⛓ CIRCUIT MASTER — the loop knows your name.</b></div>':'')+'</div>';
}
SMARTZ_BUS.on('*',(ev)=>{
  if(MESH.stats.questDone)return;
  const step=MESH.stats.questStep;
  if(step<QUEST.length&&QUEST[step].ev===ev){
    MESH.stats.questStep++;saveMesh();
    notify('⛓ Full Circuit','Step '+(step+1)+'/6 complete: '+QUEST[step].t,'ok');
    log('Circuit quest: '+QUEST[step].t+' ✓','ok');
    if(MESH.stats.questStep>=QUEST.length){
      MESH.stats.questDone=true;G.credits+=500;saveMesh();saveGame();renderGame();
      notify('⛓ CIRCUIT COMPLETE','+500 credits. CONCOURSE: "Every system touched. The loop recognizes its operator. The system ascends."','ok');
      log('⛓ FULL CIRCUIT COMPLETE — +500 credits','warn');
    }
    if(document.getElementById('win-economy').classList.contains('open'))renderQuest();
  }
});
/* ---- LIVE BUS FEED ---- */
function renderEvents(){
  const el=document.getElementById('pane-ec-events');
  el.innerHTML='<div class="card"><h4>📡 Synergy Bus — every system talking</h4>'+
    '<div class="log" style="height:380px">'+MESH.events.map(e=>
      '<div><span style="color:var(--dim)">['+new Date(e.ts).toLocaleTimeString()+']</span> <span style="color:#2ee6a8">'+e.ev+'</span></div>').join('')+
    '</div><div style="font-size:10px;color:var(--dim);margin-top:6px">Every action in every app emits here. Systems react to each other — quests, perks, stats, and the Advisor all listen on this bus.</div></div>';
}
/* Advisor reacts to mesh */
SMARTZ_BUS.on('*',(ev)=>{
  if(document.getElementById('win-advisor')&&document.getElementById('win-advisor').classList.contains('open')
     &&['ge.offer','city.build','forge','academy.lesson','tunnel.clear'].includes(ev))renderAdvisor();
});
/* hooks */
const _openApp7=window.openApp;
window.openApp=function(id){_openApp7(id);
  if(id==='economy')renderEconomy();
};
setInterval(saveMesh,30000);
renderEconomy();updateHUD();
log('v4.2 Synergy Mesh loaded — all systems linked on one bus','info');
