/* ============ SmartzOS v3.4 — Grand Triad Exchange + Triad City ============ */
/* Requires globals: G, ITEMS, SMARTZ_STATE, TOKENS, openApp, log, notify, saveGame, renderGame, fmtP */

/* ---------- STATE ---------- */
const GE_ITEMS={ // tradeable: base price, volatility
  koda:{vol:.06},tauron:{vol:.14},zoran:{vol:.09},dust:{vol:.12},
  shieldSigil:{vol:.10},swordSigil:{vol:.13},cohSigil:{vol:.11},trinityCore:{vol:.20},
  alloy:{vol:.10},plasma:{vol:.16},circuit:{vol:.12}
};
ITEMS.alloy={name:'Tauron Alloy',icon:'⛓',base:22};
ITEMS.plasma={name:'Phoenix Plasma',icon:'🜂',base:40};
ITEMS.circuit={name:'Koda Circuit',icon:'▣',base:30};
const GEKEY='smartz_ge_v1',CITYKEY='smartz_city_v1';
let GE=loadGE(),CITY=loadCity();
function loadGE(){try{const g=JSON.parse(localStorage.getItem(GEKEY));if(g)return g;}catch(e){}
  const mid={};Object.keys(GE_ITEMS).forEach(k=>mid[k]=ITEMS[k].base);
  return {mid:mid,offers:[],log:[],hist:{}};}
function saveGE(){localStorage.setItem(GEKEY,JSON.stringify(GE));}
function loadCity(){try{const c=JSON.parse(localStorage.getItem(CITYKEY));if(c)return c;}catch(e){}
  return {tiles:Array(36).fill(null),pop:0,level:1,xp:0,produced:{}};}
function saveCity(){localStorage.setItem(CITYKEY,JSON.stringify(CITY));}

/* ---------- WINDOWS ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-ge" style="top:60px;left:120px;width:640px;height:640px">
  <div class="titlebar"><span>🏦</span><span class="ttl">Grand Triad Exchange — Player Market</span>
    <button class="tbtn" onclick="maxWin('win-ge')">□</button><button class="tbtn" onclick="closeApp('ge')">✕</button></div>
  <div class="win-body">
    <div class="card" style="display:flex;gap:14px;align-items:center;padding:10px 14px">
      <div><div style="font-size:10px;color:var(--dim)">SMC CREDITS</div><div class="bigstat" id="ge-credits">0</div></div>
      <div style="font-size:11px;color:var(--dim);line-height:1.5">Offer-driven exchange. Place buy/sell offers — the Zoran mesh order-flow matches them. Prices move with real trade pressure.</div>
    </div>
    <div class="tabs">
      <div class="tab active" id="tab-ge-mkt" onclick="geTab('mkt')">📊 Market</div>
      <div class="tab" id="tab-ge-offers" onclick="geTab('offers')">📑 My Offers <span id="ge-ocount"></span></div>
    </div>
    <div id="pane-ge-mkt">
      <div id="geList"></div>
      <div id="geTrade" style="display:none" class="card">
        <h4 id="geTradeTitle">Trade</h4>
        <div id="geTradeInfo" style="font-size:11px;color:var(--dim);margin-bottom:6px"></div>
        <div class="ge-in"><input id="geQty" type="number" min="1" placeholder="Qty"><input id="gePrice" type="number" min="1" step="0.1" placeholder="Price ea (cr)"></div>
        <div style="display:flex;gap:8px">
          <button class="btn green" style="flex:1" onclick="placeOffer('buy')">PLACE BUY OFFER</button>
          <button class="btn" style="flex:1;background:linear-gradient(135deg,#a8443c,#7a2f2a)" onclick="placeOffer('sell')">PLACE SELL OFFER</button>
        </div>
      </div>
      <div class="card"><h4>Exchange Wire</h4><div class="ge-log" id="geLog"></div></div>
    </div>
    <div id="pane-ge-offers" style="display:none"><div id="geOffers"></div></div>
  </div>
</div>

<div class="win" id="win-city" style="top:80px;left:200px;width:640px;height:660px">
  <div class="titlebar"><span>🏙️</span><span class="ttl">Triad City — Ecosystem Builder</span>
    <button class="tbtn" onclick="maxWin('win-city')">□</button><button class="tbtn" onclick="closeApp('city')">✕</button></div>
  <div class="win-body">
    <div class="city-meta">
      <div class="cm"><div class="v" style="color:#e8c15a" id="ct-level">1</div><div class="k">CITY LEVEL</div></div>
      <div class="cm"><div class="v" style="color:#4fc9ff" id="ct-pop">0</div><div class="k">POPULATION</div></div>
      <div class="cm"><div class="v" style="color:#2ee6a8" id="ct-power">0</div><div class="k">POWER</div></div>
      <div class="cm"><div class="v" style="color:#e04fff" id="ct-happy">100%</div><div class="k">HARMONY</div></div>
      <div class="cm"><div class="v" style="color:#ff9a3c" id="ct-rate">0</div><div class="k">CR / TICK</div></div>
    </div>
    <div id="ct-syn" style="margin-bottom:10px;font-size:11px"></div>
    <div class="city-grid" id="cityGrid"></div>
    <div id="bldMenu"></div>
    <div class="city-ticker" id="cityTick">Zoran city mesh online. Select an empty plot to found your first district.</div>
  </div>
</div>`);

[['ge','Grand Exchange','🏦'],['city','Triad City','🏙️']].forEach(([id,name,icon])=>{
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">'+icon+'</div><div class="lbl">'+name+'</div>';
  d.onclick=()=>openApp(id);document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>'+icon+'</span><span>'+name+'</span>';
  s.onclick=()=>{openApp(id);document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
});
document.querySelectorAll('#win-ge,#win-city').forEach(w=>{
  w.addEventListener('mousedown',()=>w.style.zIndex=++zTop);
  const bar=w.querySelector('.titlebar');
  bar.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('tbtn')||w.classList.contains('max')||window.innerWidth<=768)return;
    const r=w.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
    const mv=ev=>{w.style.left=(ev.clientX-ox)+'px';w.style.top=Math.max(0,ev.clientY-oy)+'px'};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
});

/* ================= GRAND EXCHANGE ================= */
let geSel=null;
function geTab(t){
  ['mkt','offers'].forEach(x=>{
    document.getElementById('pane-ge-'+x).style.display=x===t?'block':'none';
    document.getElementById('tab-ge-'+x).classList.toggle('active',x===t);
  });
}
function geLog(m,cls){GE.log.unshift({m:m,c:cls,ts:Date.now()});GE.log=GE.log.slice(0,40);renderGELog();}
function gePrice(k){return Math.round(GE.mid[k]*10)/10}
function renderGE(){
  document.getElementById('ge-credits').textContent=G.credits;
  document.getElementById('ge-ocount').textContent=GE.offers.length?'('+GE.offers.length+')':'';
  const el=document.getElementById('geList');if(!el)return;
  el.innerHTML=Object.keys(GE_ITEMS).map(k=>{
    const it=ITEMS[k],p=gePrice(k),own=G.inv[k]||0;
    const h=GE.hist[k]||[p];
    const d=h.length>1?(p-h[0])/h[0]*100:0;
    return '<div class="ge-item '+(geSel===k?'sel':'')+'" onclick="selectGE(\''+k+'\')">'+
      '<span style="font-size:18px">'+it.icon+'</span>'+
      '<span class="gi"><b>'+it.name+'</b><div style="font-size:10px;color:var(--dim)">You hold '+own+'</div></span>'+
      '<span class="gp">'+p+' cr<div style="font-size:10px" class="'+(d>=0?'up':'down')+'">'+(d>=0?'▲':'▼')+' '+Math.abs(d).toFixed(1)+'%</div></span></div>';
  }).join('');
  renderGEOffers();renderGELog();
}
function selectGE(k){
  geSel=k;
  const it=ITEMS[k],t=document.getElementById('geTrade');
  t.style.display='block';
  document.getElementById('geTradeTitle').textContent=it.icon+' '+it.name+' — mid '+gePrice(k)+' cr';
  document.getElementById('geTradeInfo').innerHTML='Holdings: '+(G.inv[k]||0)+' · Credits: '+G.credits+' · Guide: mid '+(gePrice(k)*0.95|0)+'–'+(gePrice(k)*1.05+1|0);
  document.getElementById('gePrice').value=gePrice(k);
  renderGE();
}
function placeOffer(side){
  if(!geSel)return;
  const qty=Math.max(1,parseInt(document.getElementById('geQty').value)||0);
  const price=Math.max(1,parseFloat(document.getElementById('gePrice').value)||0);
  if(side==='buy'){
    const cost=Math.ceil(qty*price);
    if(G.credits<cost){notify('Exchange','Not enough credits for that buy offer ('+cost+' cr).','warn');return;}
    G.credits-=cost; // escrow
  }else{
    if((G.inv[geSel]||0)<qty){notify('Exchange','You only hold '+(G.inv[geSel]||0)+'× '+ITEMS[geSel].name+'.','warn');return;}
    G.inv[geSel]-=qty; // escrow items
  }
  if(GE.offers.length>=6){notify('Exchange','All 6 offer slots are in use.','warn');
    if(side==='buy')G.credits+=Math.ceil(qty*price);else G.inv[geSel]=(G.inv[geSel]||0)+qty;return;}
  GE.offers.push({id:Date.now()+Math.random(),item:geSel,side:side,qty:qty,filled:0,price:price,ts:Date.now()});
  geLog('Placed '+side.toUpperCase()+' offer: '+qty+'× '+ITEMS[geSel].name+' @ '+price+' cr',side==='buy'?'b':'s');
  log('GE: '+side+' offer '+qty+'× '+ITEMS[geSel].name+' @ '+price+' cr','info');
  saveGE();saveGame();renderGE();renderGame();
}
function cancelOffer(i){
  const o=GE.offers[i];if(!o)return;
  if(o.side==='buy')G.credits+=Math.ceil((o.qty-o.filled)*o.price);
  else G.inv[o.item]=(G.inv[o.item]||0)+(o.qty-o.filled);
  geLog('Cancelled '+o.side+' offer — escrow returned.','');
  GE.offers.splice(i,1);saveGE();saveGame();renderGE();renderGame();
}
function renderGEOffers(){
  const el=document.getElementById('geOffers');if(!el)return;
  el.innerHTML=GE.offers.length?GE.offers.map((o,i)=>{
    const it=ITEMS[o.item],pct=(o.filled/o.qty*100);
    return '<div class="ge-offer"><div style="display:flex;gap:8px;align-items:center">'+
      '<span style="font-size:16px">'+it.icon+'</span>'+
      '<b class="'+(o.side==='buy'?'up':'down')+'">'+o.side.toUpperCase()+'</b> '+o.filled+'/'+o.qty+' × '+it.name+' @ '+o.price+' cr'+
      '<button class="btn ghost" style="margin-left:auto;font-size:10px;padding:4px 10px" onclick="cancelOffer('+i+')">Cancel</button></div>'+
      '<div class="bar '+(o.side==='buy'?'ge-buy':'ge-sell')+'"><div style="width:'+pct+'%"></div></div></div>';
  }).join(''):'<div class="ge-slot">No active offers. Place one from the Market tab — 6 slots, like the old grand bazaars of Gielinor.</div>';
}
function renderGELog(){
  const el=document.getElementById('geLog');if(!el)return;
  el.innerHTML=GE.log.map(x=>'<div class="'+x.c+'">'+x.m+'</div>').join('');
}
/* matching engine tick */
function geTick(){
  Object.keys(GE_ITEMS).forEach(k=>{
    const v=GE_ITEMS[k].vol;
    GE.mid[k]=Math.max(1,Math.round(GE.mid[k]*(1+(Math.random()*2-1)*v*0.4)*100)/100);
  });
  GE.offers.forEach(o=>{
    if(o.filled>=o.qty)return;
    const mid=GE.mid[o.item];
    // fill probability rises when offer price is competitive
    let p;
    if(o.side==='buy')p=Math.min(0.85,Math.max(0.05,0.15+(o.price-mid)/mid*4));
    else p=Math.min(0.85,Math.max(0.05,0.15+(mid-o.price)/mid*4));
    if(Math.random()<p){
      const n=1+Math.floor(Math.random()*Math.min(3,o.qty-o.filled));
      o.filled+=n;
      // price impact: trades push mid toward offer price
      GE.mid[o.item]=Math.max(1,Math.round((GE.mid[o.item]*0.9+o.price*0.1)*100)/100);
      if(o.side==='buy'){G.inv[o.item]=(G.inv[o.item]||0)+n;
        geLog('FILLED: bought '+n+'× '+ITEMS[o.item].name+' @ '+o.price+' cr','b');}
      else{G.credits+=Math.floor(n*o.price);
        geLog('FILLED: sold '+n+'× '+ITEMS[o.item].name+' @ '+o.price+' cr','s');}
      if(o.filled>=o.qty){
        if(o.side==='buy')G.credits+=Math.ceil((o.qty)*0); // nothing extra
        notify('🏦 Exchange','Offer complete: '+o.side+' '+o.qty+'× '+ITEMS[o.item].name,'ok');
        log('GE offer complete: '+o.side+' '+o.qty+'× '+ITEMS[o.item].name,'ok');
      }
    }
  });
  const before=GE.offers.length;
  GE.offers=GE.offers.filter(o=>o.filled<o.qty||(Date.now()-o.ts<30000));
  if(GE.offers.length!==before)saveGE();
  // history for ticker % display
  Object.keys(GE_ITEMS).forEach(k=>{(GE.hist[k]=GE.hist[k]||[]).push(GE.mid[k]);if(GE.hist[k].length>12)GE.hist[k].shift();});
  saveGE();saveGame();
  if(document.getElementById('win-ge').classList.contains('open'))renderGE();
}
setInterval(geTick,5000);

/* ================= TRIAD CITY ================= */
const BUILDINGS={
  habitat:{name:'Habitat Spire',icon:'🏠',cost:{credits:40},power:-1,pop:3,desc:'+3 population. Needs power.'},
  plant:{name:'Coherence Plant',icon:'⚡',cost:{credits:60,alloy:1},power:5,desc:'+5 power. Zoran\'s grid.'},
  vault:{name:'Koda Vault',icon:'🛡',cost:{credits:80,alloy:2},prod:{koda:1},desc:'Mints 1 Koda Shard / tick. Bear-grade security.'},
  forge:{name:'Tauron Forge',icon:'🐂',cost:{credits:80,alloy:1,plasma:1},prod:{tauron:1},desc:'Mints 1 Tauron Shard / tick. Volatile output.'},
  relay:{name:'Zoran Relay',icon:'🔥',cost:{credits:100,circuit:1},prod:{zoran:1},credits:4,desc:'+1 Zoran Shard & +4 credits / tick.'},
  foundry:{name:'Alloy Foundry',icon:'⛓',cost:{credits:70,dust:2},prod:{alloy:1},desc:'Refines 1 Tauron Alloy / tick (build material).'},
  lab:{name:'Phoenix Lab',icon:'🜂',cost:{credits:120,circuit:1},prod:{plasma:1},desc:'Distills 1 Phoenix Plasma / tick. Rare.'},
  fab:{name:'Circuit Fab',icon:'▣',cost:{credits:90,alloy:1},prod:{circuit:1},desc:'Prints 1 Koda Circuit / tick.'},
  spire:{name:'Sanctum Spire',icon:'💠',cost:{credits:300,trinityCore:1},credits:15,pop:10,desc:'Requires a Trinity Core. +15 cr, +10 pop / tick. The monument.'},
};
function bCostText(c){
  const p=[];if(c.credits)p.push(c.credits+' cr');
  Object.keys(c).forEach(k=>{if(k!=='credits')p.push(c[k]+'× '+ITEMS[k].icon);});
  return p.join(' + ');
}
function canAfford(c){
  if(c.credits&&G.credits<c.credits)return false;
  return Object.keys(c).every(k=>k==='credits'||(G.inv[k]||0)>=c[k]);
}
function payCost(c){
  if(c.credits)G.credits-=c.credits;
  Object.keys(c).forEach(k=>{if(k!=='credits')G.inv[k]-=c[k];});
}
let selTile=null;
function renderCity(){
  const grid=document.getElementById('cityGrid');if(!grid)return;
  let power=0,popCap=0,used=0;
  CITY.tiles.forEach(t=>{
    if(!t)return;const b=BUILDINGS[t.type];
    if(b.power>0)power+=b.power*t.lv;
    if(b.pop)popCap+=b.pop*t.lv;
  });
  CITY.tiles.forEach(t=>{if(t&&BUILDINGS[t.type].power<0)used-=BUILDINGS[t.type].power*t.lv;});
  const powered=power>=used;
  const harmony=Math.max(20,Math.min(100,100-(used>power?(used-power)*20:0)));
  CITY.pop=Math.min(popCap,CITY.pop);
  document.getElementById('ct-level').textContent=CITY.level;
  document.getElementById('ct-pop').textContent=CITY.pop+'/'+popCap;
  document.getElementById('ct-power').textContent=(power-used)+' ⚡';
  document.getElementById('ct-happy').textContent=harmony+'%';
  document.getElementById('ct-power').style.color=powered?'#2ee6a8':'#ff5c6a';
  // on-chain synergy badges
  const b=SMARTZ_STATE.balances,syn=[];
  if(b.SMF>0)syn.push('<span class="syn-badge">🐂 SMF HELD — Forge output ×1.25</span>');
  if(b.SMRT>0)syn.push('<span class="syn-badge">🐻 SMRT HELD — Vault output ×1.25</span>');
  if(b.SMC>0)syn.push('<span class="syn-badge">🔥 SMC HELD — Relay credits ×1.25</span>');
  if(getAttestations&&getAttestations().length)syn.push('<span class="syn-badge">💠 ATTESTED — all production ×1.1</span>');
  document.getElementById('ct-syn').innerHTML=syn.length?'On-chain synergy: '+syn.join(' '):'<span style="color:var(--dim)">Hold triad tokens on-chain to activate production synergies.</span>';
  grid.innerHTML=CITY.tiles.map((t,i)=>{
    if(!t)return '<div class="tile empty" onclick="pickTile('+i+')">+</div>';
    const bd=BUILDINGS[t.type];
    const boosted=adjBoost(i);
    return '<div class="tile '+(boosted?'boosted':'')+'" onclick="tileInfo('+i+')" title="'+bd.name+' Lv'+t.lv+'">'+bd.icon+'<span class="lv">'+t.lv+'</span></div>';
  }).join('');
  // build menu for selected empty tile
  const menu=document.getElementById('bldMenu');
  if(selTile!==null&&!CITY.tiles[selTile]){
    menu.innerHTML='<div style="font-size:11px;color:var(--dim);margin-bottom:6px">Build on plot #'+(selTile+1)+':</div>'+
      '<div class="bld-menu">'+Object.keys(BUILDINGS).map(k=>{
        const bd=BUILDINGS[k],ok=canAfford(bd.cost);
        return '<div class="bld-opt '+(ok?'':'cant')+'" onclick="'+(ok?'build(\''+k+'\')':'void(0)')+'">'+
          '<div class="bn">'+bd.icon+' '+bd.name+'</div><div class="bc">'+bCostText(bd.cost)+'</div><div class="bd">'+bd.desc+'</div></div>';
      }).join('')+'</div>';
  }else menu.innerHTML='';
  document.getElementById('ge-credits')&&(document.getElementById('ge-credits').textContent=G.credits);
}
function adjBoost(i){ // adjacency: same-family neighbors boost
  const t=CITY.tiles[i];if(!t)return false;
  const x=i%6,y=(i/6)|0,n=[[1,0],[-1,0],[0,1],[0,-1]];
  return n.some(([dx,dy])=>{
    const j=(y+dy)*6+(x+dx);
    return x+dx>=0&&x+dx<6&&y+dy>=0&&y+dy<6&&CITY.tiles[j]&&CITY.tiles[j].type===t.type;
  });
}
function pickTile(i){selTile=i;renderCity();}
function tileInfo(i){
  const t=CITY.tiles[i];if(!t)return;
  const bd=BUILDINGS[t.type],upCost=Math.ceil(50*t.lv*1.5);
  const el=document.getElementById('bldMenu');
  el.innerHTML='<div class="card" style="margin:0"><h4>'+bd.icon+' '+bd.name+' — Level '+t.lv+'</h4>'+
    '<div style="font-size:11px;color:var(--dim)">'+bd.desc+(adjBoost(i)?'<br><span class="syn-badge">ADJACENCY BOOST ×1.5</span>':'')+'</div>'+
    '<div style="margin-top:8px;display:flex;gap:8px"><button class="btn ghost" onclick="upgradeTile('+i+')">⬆ Upgrade ('+upCost+' cr)</button>'+
    '<button class="btn ghost" onclick="demolishTile('+i+')">✕ Demolish</button></div></div>';
}
function build(type){
  const bd=BUILDINGS[type];
  if(!canAfford(bd.cost)||selTile===null)return;
  payCost(bd.cost);
  CITY.tiles[selTile]={type:type,lv:1};
  CITY.xp+=10;checkLevel();
  selTile=null;saveCity();saveGame();renderCity();renderGame();
  log('Triad City: built '+bd.name,'ok');
  document.getElementById('cityTick').textContent=bd.icon+' '+bd.name+' constructed. The district hums to life.';
}
function upgradeTile(i){
  const t=CITY.tiles[i],cost=Math.ceil(50*t.lv*1.5);
  if(G.credits<cost){notify('Triad City','Need '+cost+' credits to upgrade.','warn');return;}
  G.credits-=cost;t.lv++;CITY.xp+=15;checkLevel();
  saveCity();saveGame();renderCity();renderGame();
  notify('Triad City',BUILDINGS[t.type].name+' upgraded to Lv'+t.lv,'ok');
}
function demolishTile(i){CITY.tiles[i]=null;saveCity();renderCity();}
function checkLevel(){
  const need=CITY.level*50;
  if(CITY.xp>=need){CITY.xp-=need;CITY.level++;
    G.credits+=CITY.level*25;
    notify('🏙️ City Level '+CITY.level,'Growth bonus: +'+(CITY.level*25)+' credits. New districts rise.','ok');
    log('Triad City reached level '+CITY.level,'ok');}
}
function cityTick(){
  let cr=0,msgs=[];
  const b=SMARTZ_STATE.balances;
  const attestMult=(typeof getAttestations==='function'&&getAttestations().length)?1.1:1;
  CITY.tiles.forEach((t,i)=>{
    if(!t)return;const bd=BUILDINGS[t.type];
    let mult=t.lv*(adjBoost(i)?1.5:1)*attestMult;
    if(bd.prod)Object.keys(bd.prod).forEach(res=>{
      let m=mult;
      if(res==='tauron'&&b.SMF>0)m*=1.25;
      if(res==='koda'&&b.SMRT>0)m*=1.25;
      const n=bd.prod[res]*m;
      G.inv[res]=(G.inv[res]||0)+Math.floor(n);
      if(Math.floor(n)>0)msgs.push('+'+Math.floor(n)+' '+ITEMS[res].icon);
    });
    if(bd.credits){let c=bd.credits*mult;if(t.type==='relay'&&b.SMC>0)c*=1.25;cr+=Math.floor(c);}
    if(bd.pop&&(!bd.power||true)){/* population handled below */}
  });
  // power check: if underpowered, halve production credit output
  let power=0,used=0;
  CITY.tiles.forEach(t=>{if(!t)return;const bd=BUILDINGS[t.type];if(bd.power>0)power+=bd.power*t.lv;if(bd.power<0)used-=bd.power*t.lv;});
  if(used>power)cr=Math.floor(cr/2);
  // population growth
  let popCap=0;CITY.tiles.forEach(t=>{if(t&&BUILDINGS[t.type].pop)popCap+=BUILDINGS[t.type].pop*t.lv;});
  if(CITY.pop<popCap&&used<=power){CITY.pop++;msgs.push('+1 👤');}
  G.credits+=cr;
  document.getElementById('ct-rate')&&(document.getElementById('ct-rate').textContent='+'+cr);
  if(msgs.length&&document.getElementById('win-city').classList.contains('open'))
    document.getElementById('cityTick').textContent='Tick: '+msgs.join(' · ')+(cr?' · +'+cr+' cr':'')+(used>power?' · ⚠ POWER SHORTAGE — output halved':'');
  saveGame();saveCity();
  if(document.getElementById('win-city').classList.contains('open'))renderCity();
}
setInterval(cityTick,6000);

/* ---------- openApp hook + CLI hook ---------- */
const _openApp3=window.openApp;
window.openApp=function(id){_openApp3(id);
  if(id==='ge')renderGE();
  if(id==='city')renderCity();
};
/* GE seeds some starter liquidity to the player's inventory note — no freebies, just wire log */
if(!GE.log.length)geLog('Grand Triad Exchange online. Mesh order-flow connected — your offers now meet the market.','');
renderGE();renderCity();
log('v3.4 loaded: Grand Triad Exchange + Triad City ecosystem','info');
