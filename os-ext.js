/* ============ SmartzOS v3.2 — Advanced Extension Pack ============ */
/* Requires globals from index.html: TOKENS, SOL_MINT, SMARTZ_STATE, G, ITEMS,
   openApp, closeApp, maxWin, quickBuy, connectWallet, log, pushTelemetry, saveGame, renderGame */

/* ---------- BOOT SPLASH ---------- */
(function(){
  const msgs=['Booting SmartzOS kernel…','Loading Trinity Doctrine…','Arming Jupiter swap routing…','Waking Koda 🐻 · Tauron 🐂 · Zoran 🔥…','Syncing Zoran mesh…','Launch sequence complete.'];
  let i=0;
  const fill=document.getElementById('sp-fill'),lg=document.getElementById('sp-log');
  const iv=setInterval(()=>{
    fill.style.width=((i+1)/msgs.length*100)+'%';
    lg.textContent=msgs[i];
    i++;
    if(i>=msgs.length){clearInterval(iv);
      setTimeout(()=>{document.getElementById('splash').classList.add('hide');
        setTimeout(()=>document.getElementById('splash').remove(),900);
        notify('Launch sequence complete','The Smart Triad Ecosystem is online.','ok');
      },400);}
  },450);
})();

/* ---------- TOASTS ---------- */
function notify(title,body,type){
  const c=document.getElementById('toasts');if(!c)return;
  const t=document.createElement('div');
  t.className='toast '+(type||'');
  t.innerHTML='<div class="tt">'+title+'</div><div>'+body+'</div>';
  c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(()=>t.remove(),400)},4200);
}

/* ---------- INJECT ADVANCED WINDOWS ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-advisor" style="top:70px;left:180px;width:560px;height:560px">
  <div class="titlebar"><span>🧠</span><span class="ttl">Smartz Advisor — Triad Counsel Engine</span>
    <button class="tbtn" onclick="maxWin('win-advisor')">□</button><button class="tbtn" onclick="closeApp('advisor')">✕</button></div>
  <div class="win-body">
    <div class="banner" style="padding:10px 14px;font-size:12px">Zoran reads your telemetry — wallet, market, and game state — and issues counsel. <button class="btn ghost" style="float:right;font-size:10px;padding:4px 10px" onclick="renderAdvisor()">↻ Re-analyze</button></div>
    <div id="advisorFeed"></div>
  </div>
</div>

<div class="win" id="win-portfolio" style="top:90px;left:260px;width:560px;height:540px">
  <div class="titlebar"><span>💼</span><span class="ttl">Portfolio — Live Valuation</span>
    <button class="tbtn" onclick="maxWin('win-portfolio')">□</button><button class="tbtn" onclick="closeApp('portfolio')">✕</button></div>
  <div class="win-body">
    <div class="card" style="display:flex;gap:16px;align-items:center">
      <div><div style="font-size:10px;color:var(--dim)">TOTAL VALUE (USD)</div><div class="bigstat" id="pf-total">$0.00</div></div>
      <div style="flex:1">
        <div style="font-size:10px;color:var(--dim);margin-bottom:4px">TRINITY ALIGNMENT — how close you are to holding the full Triad</div>
        <div class="trinity-meter"><div id="pf-trinity" style="width:0%"></div></div>
        <div style="font-size:10px;color:var(--dim);margin-top:4px" id="pf-trinity-txt">0 / 3 tokens held</div>
      </div>
    </div>
    <div class="card">
      <h4>Holdings (on-chain × live price) <button class="btn ghost" style="float:right;font-size:10px;padding:4px 10px" onclick="renderPortfolio()">↻</button></h4>
      <div class="alloc-bar" id="pf-alloc"></div>
      <div id="pf-rows"><div style="color:var(--dim)">Connect wallet to valuate holdings.</div></div>
    </div>
    <div class="card">
      <h4>Achievements</h4>
      <div class="achv" id="achv"></div>
    </div>
  </div>
</div>

<div class="win" id="win-cli" style="top:110px;left:340px;width:600px;height:480px">
  <div class="titlebar"><span>⌨️</span><span class="ttl">Zoran Shell — Command Interface</span>
    <button class="tbtn" onclick="maxWin('win-cli')">□</button><button class="tbtn" onclick="closeApp('cli')">✕</button></div>
  <div class="win-body">
    <div class="cli">
      <div class="cli-out" id="cli-out"><div class="c-dim">Zoran Shell v3.2 — type <b>help</b></div></div>
      <div class="cli-in"><span class="prompt">zoran&gt;</span><input id="cli-input" placeholder="type a command…" autocomplete="off"></div>
    </div>
  </div>
</div>`);

/* desktop icons + start menu for new apps */
[['advisor','Advisor','🧠'],['portfolio','Portfolio','💼'],['cli','Zoran Shell','⌨️']].forEach(([id,name,icon])=>{
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">'+icon+'</div><div class="lbl">'+name+'</div>';
  d.onclick=()=>openApp(id);document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>'+icon+'</span><span>'+name+'</span>';
  s.onclick=()=>{openApp(id);document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
});
/* make injected windows draggable + frontable */
document.querySelectorAll('#win-advisor,#win-portfolio,#win-cli').forEach(w=>{
  w.addEventListener('mousedown',()=>w.style.zIndex=++zTop);
  const bar=w.querySelector('.titlebar');
  bar.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('tbtn')||w.classList.contains('max'))return;
    const r=w.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
    const mv=ev=>{w.style.left=(ev.clientX-ox)+'px';w.style.top=Math.max(0,ev.clientY-oy)+'px'};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
});

/* ---------- PRICE CACHE + TICKER ---------- */
const EXT={prices:{},chg:{}};
async function extFetchPrices(){
  for(const t of TOKENS){
    try{
      const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+t.mint);
      const j=await r.json();
      const pairs=(j.pairs||[]).sort((a,b)=>((b.liquidity&&b.liquidity.usd)||0)-((a.liquidity&&a.liquidity.usd)||0));
      const p=pairs[0];
      if(p){EXT.prices[t.sym]=Number(p.priceUsd);EXT.chg[t.sym]=(p.priceChange&&p.priceChange.h24)||0;}
    }catch(e){}
  }
  renderTicker();
}
function fmtP(v){return v>=1?'$'+v.toFixed(2):v>=0.001?'$'+v.toPrecision(4):'$'+v.toExponential(2)}
function renderTicker(){
  const el=document.getElementById('ticker-txt');if(!el)return;
  let s='THE SMART TRIAD ◈ LAUNCH SEQUENCE ACTIVE &nbsp;&nbsp;·&nbsp;&nbsp; ';
  TOKENS.forEach(t=>{
    const p=EXT.prices[t.sym],c=EXT.chg[t.sym]||0;
    s+=p?('<b>'+t.glyph+' '+t.sym+'</b> '+fmtP(p)+' <span class="'+(c>=0?'tk-up':'tk-dn')+'">'+(c>=0?'▲':'▼')+Math.abs(c).toFixed(1)+'%</b></span> &nbsp;·&nbsp; '):('');
  });
  s+='🐻 KODA WATCHES &nbsp;·&nbsp; 🐂 TAURON CUTS &nbsp;·&nbsp; 🔥 ZORAN ROUTES &nbsp;·&nbsp; ';
  el.innerHTML=s;
}
extFetchPrices();setInterval(extFetchPrices,45000);

/* ---------- SMARTZ ADVISOR ---------- */
function renderAdvisor(){
  const el=document.getElementById('advisorFeed');if(!el)return;
  const b=SMARTZ_STATE.balances,adv=[];
  const held=[ 'SMRT','SMF','SMC'].filter(s=>b[s]>0);
  if(!walletKey){
    adv.push({i:'🔌',t:'Connect a wallet — you are still outside the Loop',pri:'high',
      b:'No telemetry flows from an unlinked operator. Connecting unlocks rank, valuation, and the SMF firewall check.',
      a:'<button class="btn" onclick="connectWallet()">Connect Wallet</button>'});
    if(!SMARTZ_STATE.tunnelCleared)adv.push({i:'🌀',t:'Run the Liquidity Tunnel first',pri:'med',
      b:'The game layer teaches the exact muscle memory you need for live swaps — slippage, volatility, firewall checks — with zero real funds at risk.',
      a:'<button class="btn ghost" onclick="openApp(\'game\')">Open Liquidity Tunnel</button>'});
  }else{
    if(b.SMF<=0)adv.push({i:'🐂',t:'Arm yourself: acquire SMF (Tauron)',pri:'high',
      b:'The Inner Sanctum firewall only opens for the Sword. Even a small SMF position clears the Tunnel and lifts you to <b>Bladebearer</b>.'+(EXT.prices.SMF?(' Live price: '+fmtP(EXT.prices.SMF)+'.'):''),
      a:'<button class="btn" onclick="quickBuy(\'SMF\')">Quick-Buy SMF</button>'});
    if(b.SMRT<=0)adv.push({i:'🐻',t:'Take post: acquire SMRT (Koda)',pri:'med',
      b:'SMRT holders are Sentinels of the Loop — governance and stability. Hold SMRT alongside SMF to reach <b>Coherent</b>, the top of the ladder.',
      a:'<button class="btn" onclick="quickBuy(\'SMRT\')">Quick-Buy SMRT</button>'});
    if(b.SMF>0&&b.SMRT>0)adv.push({i:'◈',t:'You are Coherent — Shield and Sword as one',pri:'low',
      b:'Full Triad alignment detected. Counsel: keep positions balanced, watch Tauron\'s volatility, and forge the Trinity Core in-game to complete the Doctrine on both layers.'});
    if(b.SOL<0.01)adv.push({i:'⛽',t:'Low SOL for gas',pri:'med',
      b:'Swaps on Jupiter need SOL for fees. Keep at least ~0.02 SOL reserve so transactions never stall mid-route.'});
    const chgSMF=EXT.chg.SMF||0;
    if(Math.abs(chgSMF)>15)adv.push({i:'📊',t:'Tauron is moving — '+chgSMF.toFixed(1)+'% (24h)',pri:'med',
      b:'High volatility on the Sword. Koda\'s counsel: size entries small; Tauron\'s counsel: velocity rewards the decisive. Zoran routes either way.'});
  }
  if(G.artifacts===0)adv.push({i:'⚗️',t:'Forge your first sigil',pri:'low',
    b:'The Fusion Lab converts 3 matching shards into sigils. Three sigils → the Trinity Core 💠 (+150 credits). Shards come from Tunnel runs and the Trading Post.',
    a:'<button class="btn ghost" onclick="openApp(\'game\')">Open Fusion Lab</button>'});
  if(G.runs>=1&&held.length===3)adv.push({i:'💠',t:'Doctrine candidate: Trinity Core run',pri:'low',
    b:'You hold the full Triad on-chain and have cleared the Tunnel. Complete the set by forging the Trinity Core in the Lab.'});
  el.innerHTML=adv.length?adv.map(a=>
    '<div class="adv-card adv-pri-'+a.pri+'"><div class="ah">'+a.i+' '+a.t+'<span class="pri pri-'+a.pri+'">'+a.pri.toUpperCase()+'</span></div>'+
    '<div class="ab">'+a.b+'</div>'+(a.a?'<div class="act">'+a.a+'</div>':'')+'</div>').join('')
    :'<div style="color:var(--dim)">Zoran has no counsel — you are fully aligned. ◈</div>';
}

/* ---------- PORTFOLIO ---------- */
async function renderPortfolio(){
  const rows=document.getElementById('pf-rows'),alloc=document.getElementById('pf-alloc');
  if(!EXT.prices.SMRT)await extFetchPrices();
  const b=SMARTZ_STATE.balances;
  const entries=[{sym:'SOL',v:b.SOL*(EXT.prices.SOL||0),icon:'◎',col:'#9aa7ff',amt:b.SOL},
    {sym:'SMRT',v:b.SMRT*(EXT.prices.SMRT||0),icon:'🐻',col:'#4fc9ff',amt:b.SMRT},
    {sym:'SMF',v:b.SMF*(EXT.prices.SMF||0),icon:'🐂',col:'#e04fff',amt:b.SMF},
    {sym:'SMC',v:b.SMC*(EXT.prices.SMC||0),icon:'🔥',col:'#ff9a3c',amt:b.SMC}];
  const total=entries.reduce((s,e)=>s+e.v,0);
  document.getElementById('pf-total').textContent='$'+total.toLocaleString(undefined,{maximumFractionDigits:2});
  if(walletKey){
    rows.innerHTML=entries.map(e=>'<div class="pf-row"><span style="color:'+e.col+'">'+e.icon+' <b>'+e.sym+'</b></span>'+
      '<span style="color:var(--dim);font-size:11px">'+e.amt.toLocaleString(undefined,{maximumFractionDigits:4})+'</span>'+
      '<span class="pv">$'+e.v.toLocaleString(undefined,{maximumFractionDigits:2})+'<br><span style="font-size:10px;color:var(--dim)">'+(total>0?(e.v/total*100).toFixed(1):0)+'%</span></span></div>').join('');
    alloc.innerHTML=entries.filter(e=>e.v>0).map(e=>'<div style="width:'+(e.v/total*100)+'%;background:'+e.col+'"></div>').join('')||'<div style="width:100%;background:#16203a"></div>';
  }else{
    rows.innerHTML='<div style="color:var(--dim)">Connect wallet to valuate holdings. <button class="btn" style="margin-left:8px" onclick="connectWallet()">Connect</button></div>';
  }
  const held=['SMRT','SMF','SMC'].filter(s=>b[s]>0).length;
  document.getElementById('pf-trinity').style.width=(held/3*100)+'%';
  document.getElementById('pf-trinity-txt').textContent=held+' / 3 tokens held'+(held===3?' — FULL TRIAD ◈':'');
  renderAchv();
}
/* achievements */
function renderAchv(){
  const b=SMARTZ_STATE.balances;
  const A=[
    ['🔗 Linked',!!walletKey],['🌀 Tunnel-Cleared',SMARTZ_STATE.tunnelCleared],
    ['🐂 Bladebearer',b.SMF>0],['🐻 Sentinel',b.SMRT>=10000],
    ['◈ Coherent',b.SMF>0&&b.SMRT>0],['⚗️ First Forge',G.artifacts>0],
    ['💠 Trinity Core',(G.inv.trinityCore||0)>0],['📈 Trader',G.credits>=200]
  ];
  document.getElementById('achv').innerHTML=A.map(([n,on])=>'<span class="a '+(on?'un':'')+'">'+n+'</span>').join('');
}

/* ---------- CLI ---------- */
function cliPrint(s,cls){const o=document.getElementById('cli-out');o.innerHTML+='<div class="'+(cls||'')+'">'+s+'</div>';o.scrollTop=o.scrollHeight;}
function cliExec(cmd){
  const p=cmd.trim().split(/\s+/),c=(p[0]||'').toLowerCase(),arg=(p[1]||'').toUpperCase();
  cliPrint('zoran&gt; '+cmd,'c-cmd');
  switch(c){
    case 'help':cliPrint('commands: rank · balance · prices · buy &lt;SMRT|SMF|SMC&gt; · open &lt;app&gt; · connect · game · advice · missions · whoami · clear');break;
    case 'rank':cliPrint('Rank: '+SMARTZ_STATE.rank+' | Gate: '+(SMARTZ_STATE.gateOpen?'OPEN':'SEALED'));break;
    case 'balance':{const b=SMARTZ_STATE.balances;cliPrint('SOL '+b.SOL.toFixed(4)+' · SMRT '+b.SMRT+' · SMF '+b.SMF+' · SMC '+b.SMC);break;}
    case 'prices':TOKENS.forEach(t=>cliPrint(t.glyph+' '+t.sym+': '+(EXT.prices[t.sym]?fmtP(EXT.prices[t.sym])+' ('+((EXT.chg[t.sym]||0).toFixed(1))+'%)':'no feed')));break;
    case 'buy':if(['SMRT','SMF','SMC'].includes(arg)){quickBuy(arg);cliPrint('Quick-launch armed: '+arg);}else cliPrint('usage: buy SMRT|SMF|SMC','c-err');break;
    case 'open':openApp((p[1]||'').toLowerCase());cliPrint('opening '+(p[1]||'?'));break;
    case 'connect':connectWallet();cliPrint('requesting wallet link…');break;
    case 'game':openApp('game');cliPrint('entering the Liquidity Tunnel…');break;
    case 'advice':openApp('advisor');renderAdvisor();cliPrint('counsel rendered.');break;
    case 'missions':openApp('missions');cliPrint('mission board opened.');break;
    case 'whoami':cliPrint(walletKey?('Operator '+walletKey.slice(0,8)+'… — '+SMARTZ_STATE.rank):'Unverified operator — still in the Tunnel.');break;
    case 'clear':document.getElementById('cli-out').innerHTML='';break;
    case '':break;
    default:cliPrint('unknown command: '+c+' — try help','c-err');
  }
}
document.getElementById('cli-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){cliExec(e.target.value);e.target.value='';}
});

/* ---------- MARKET SPARKLINES (wrap game render) ---------- */
const HIST={koda:[],tauron:[],zoran:[],dust:[]};
if(typeof renderMarket==='function'){
  const _rm=renderMarket;
  renderMarket=function(){
    ['koda','tauron','zoran','dust'].forEach(k=>{HIST[k].push(G.prices[k]);if(HIST[k].length>24)HIST[k].shift();});
    _rm();
    ['koda','tauron','zoran','dust'].forEach((k,i)=>{
      const row=document.querySelectorAll('#market .mkt-row')[i];if(!row||row.querySelector('canvas'))return;
      const cv=document.createElement('canvas');cv.className='spark';cv.width=70;cv.height=24;
      row.insertBefore(cv,row.querySelector('.bs'));drawSpark(cv,HIST[k],ITEMS[k].base);
    });
  };
}
function drawSpark(cv,h,base){
  const x=cv.getContext('2d');x.clearRect(0,0,70,24);
  if(h.length<2)return;
  const mn=Math.min(...h)*0.98,mx=Math.max(...h)*1.02;
  x.beginPath();
  h.forEach((v,i)=>{const px=i/(h.length-1)*66+2,py=22-((v-mn)/(mx-mn||1))*20;i?x.lineTo(px,py):x.moveTo(px,py);});
  x.strokeStyle=h[h.length-1]>=base?'#2ee6a8':'#ff5c6a';x.lineWidth=1.5;x.stroke();
}

/* ---------- NOTIFY HOOKS ---------- */
if(typeof log==='function'){
  const _log=log;
  window.log=function(m,c){_log(m,c);
    if(c==='err')notify('Alert',m,'err');
    else if(m.startsWith('⚔')||m.indexOf('TRINITY')>-1||m.indexOf('Swap confirmed')>-1)notify('SmartzOS',m,'ok');
  };
}

/* auto-render on open */
const _openApp=openApp;
window.openApp=function(id){_openApp(id);
  if(id==='advisor')renderAdvisor();
  if(id==='portfolio')renderPortfolio();
};
log('v3.2 extension pack loaded: Advisor · Portfolio · Zoran Shell · Ticker · Toasts','info');
