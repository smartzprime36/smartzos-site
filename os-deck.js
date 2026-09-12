/* SmartzOS v5.1 — Trader Command Deck: reorganized navigation + unified trader view */
(function(){
'use strict';
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const $=id=>document.getElementById(id);
const fmt$=n=>'$'+(+n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const fmtP=n=>{n=+n||0;return n>=1?'$'+n.toFixed(3):'$'+n.toPrecision(3)};
const pct=n=>((+n||0)>=0?'+':'')+(+n||0).toFixed(1)+'%';

/* ---------- App registry: grouped like a trader thinks ---------- */
const NAV=[
 {cat:'Trade',items:[
  {id:'deck',    icon:'📊',name:'Command Deck', desc:'Your whole desk at a glance'},
  {id:'swap',    icon:'⚡',name:'Jupiter Swap', desc:'Real mainnet swaps'},
  {id:'paper',   icon:'📝',name:'Paper Trading',desc:'Practice with zero risk'},
  {id:'trig',    icon:'⏰',name:'Triggers & DCA',desc:'Automate entries & exits'},
  {id:'ge',      icon:'🏦',name:'Grand Exchange',desc:'Player-driven market'},
  {id:'whale',   icon:'🐋',name:'Whale Watch',  desc:'On-chain flow alerts'},
  {id:'arena',   icon:'⚔️',name:'The Arena',   desc:'Knowledge PvP · rewards · shop'},
  {id:'terminal',icon:'📡',name:'Tactical Terminal',desc:'Raid clock · contract vault · KP board'},
 ]},
 {cat:'Portfolio',items:[
  {id:'vault',   icon:'🪙',name:'Token Vault',  desc:'Holdings & balances'},
  {id:'port',    icon:'📈',name:'Portfolio',    desc:'Value & risk view'},
  {id:'stake',   icon:'🐻',name:'Koda Staking', desc:'Earn on SMRT'},
  {id:'orca',    icon:'🌊',name:'Liquidity Depths',desc:'Orca pools — provide & earn'},
  {id:'forge',   icon:'🔥',name:'Burn Forge',   desc:'SMC burn-to-forge'},
 ]},
 {cat:'Build & Earn',items:[
  {id:'builder', icon:'🛠️',name:'Builder Sandbox',desc:'Code trading bots'},
  {id:'gallery', icon:'🏛️',name:'Project Gallery',desc:'Shipped builds'},
  {id:'city',    icon:'🏙️',name:'Triad City',   desc:'Build your district'},
  {id:'missions',icon:'🎯',name:'Missions',     desc:'Earn SMC credits'},
  {id:'board',   icon:'🏆',name:'Leaderboard',  desc:'Bracketed ranks'},
  {id:'envoy',   icon:'🤝',name:'Envoy Program',desc:'Referrals'},
  {id:'bugs',    icon:'🐞',name:'Bug Bounty',   desc:'Report issues, earn credits'},
 ]},
 {cat:'Learn',items:[
  {id:'path',    icon:'🧭',name:'The Path',      desc:'Your journey to Architect'},
  {id:'academy', icon:'🎓',name:'Academy',      desc:'Solana & token tracks'},
  {id:'game',    icon:'🌀',name:'Liquidity Tunnel',desc:'Learn by playing'},
  {id:'buddy',   icon:'💠',name:'ZO Buddy',     desc:'Personal assistant'},
 ]},
 {cat:'Intelligence',items:[
  {id:'hive',    icon:'🧠',name:'Hive Bridge',   desc:'Regime engine · SOL overseer · workers'},
 ]},
 {cat:'Community',items:[
  {id:'chat',    icon:'💠',name:'Mesh Chat',    desc:'Talk to the Syndicate live'},
  {id:'tg',      icon:'✈️',name:'Telegram Bridge',desc:'Chat with t.me/Smrtquickflips from the OS'},
  {id:'synhub',icon:'🛰️',name:'Syndicate Hub', desc:'Live desk · graded calls · AI agent gate'},
 ]},
 {cat:'System',items:[
  {id:'hq',      icon:'🏛️',name:'Syndicate HQ', desc:'The original console'},
  {id:'gov',     icon:'⚖️',name:'Governance Hall',desc:'Proposals & votes'},
  {id:'members', icon:'👥',name:'Inner Sanctum',desc:'Rank & council'},
  {id:'settings',icon:'⚙️',name:'Settings',     desc:'Config & mesh sync'},
 ]},
];

/* ---------- Launchpad (grouped start menu replacement) ---------- */
function buildLaunchpad(){
  if($('launchpad'))return;
  const lp=document.createElement('div');lp.id='launchpad';
  lp.innerHTML='<div class="lp-panel"><input class="lp-search" id="lpSearch" placeholder="Search apps… ( / )"><div id="lpBody"></div></div>';
  document.body.appendChild(lp);
  lp.addEventListener('click',e=>{if(e.target===lp)lp.classList.remove('open')});
  $('lpSearch').addEventListener('input',renderLP);
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();openLP()}
    if(e.key==='Escape')lp.classList.remove('open');
  });
  renderLP();
}
function renderLP(){
  const q=($('lpSearch').value||'').toLowerCase(), body=$('lpBody');body.innerHTML='';
  NAV.forEach(g=>{
    const items=g.items.filter(a=>!q||a.name.toLowerCase().includes(q)||a.desc.toLowerCase().includes(q));
    if(!items.length)return;
    const c=document.createElement('div');c.className='lp-cat';c.textContent=g.cat;body.appendChild(c);
    const grid=document.createElement('div');grid.className='lp-apps';
    items.forEach(a=>{
      const d=document.createElement('div');d.className='lp-app';
      d.setAttribute('data-app',a.id);
      d.innerHTML='<span class="li">'+a.icon+'</span><span>'+a.name+'<span class="ld">'+a.desc+'</span></span>';
      d.onclick=()=>{$('launchpad').classList.remove('open');openApp(a.id)};
      grid.appendChild(d);
    });
    body.appendChild(grid);
  });
}
function openLP(){buildLaunchpad();$('launchpad').classList.add('open');setTimeout(()=>$('lpSearch').focus(),40)}
window.buildLaunchpad=buildLaunchpad;

/* ---------- Command Deck window ---------- */
function buildDeck(){
  if($('win-deck'))return;
  const w=document.createElement('div');w.className='win open';w.id='win-deck';
  window.zTop=(window.zTop||100)+1;
  w.style.cssText='top:30px;left:40px;width:780px;height:620px;z-index:'+window.zTop;
  w.innerHTML=
   '<div class="win-title"><span>📊 Command Deck</span><span><button class="tbtn" onclick="maxWin(\'win-deck\')">□</button><button class="tbtn" onclick="closeApp(\'deck\')">✕</button></span></div>'+
   '<div class="win-body"><div class="deck-grid">'+
     '<div class="dcard deck-hero"><div class="pv" id="dkPV">$0.00<small>Total desk value</small></div>'+
       '<div><div class="pnl" id="dkPNL">—</div><div style="font-size:10px;color:var(--dim)">paper P&L · <span id="dkRank">—</span></div></div>'+
       '<div style="margin-left:auto;text-align:right;font-size:11px;color:var(--dim)"><div id="dkWallet">No wallet</div><div id="dkPerks"></div></div></div>'+
     '<div class="dcard span4"><h5>🪙 Triad Markets <span class="go" onclick="openApp(\'swap\')">Trade →</span></h5><div id="dkTri"></div></div>'+
     '<div class="dcard span4"><h5>⏰ Automation <span class="go" onclick="openApp(\'trig\')">Manage →</span></h5><div id="dkAuto"></div></div>'+
     '<div class="dcard span4"><h5>🛠️ Active Bots <span class="go" onclick="openApp(\'builder\')">Build →</span></h5><div id="dkBots"></div></div>'+
     '<div class="dcard span6"><h5>🏦 Exchange Desk <span class="go" onclick="openApp(\'ge\')">Open GE →</span></h5><div id="dkGE"></div></div>'+
     '<div class="dcard span6"><h5>📝 Paper Positions <span class="go" onclick="openApp(\'paper\')">Trade →</span></h5><div id="dkPT"></div></div>'+
     '<div class="dcard span12"><h5>⚡ Quick Actions</h5><div class="qa-row" id="dkQA"></div></div>'+
     '<div class="dcard span12"><h5>📡 Desk Feed — everything happening, newest first</h5><div class="feed" id="dkFeed"></div></div>'+
   '</div></div>';
  document.body.appendChild(w);
  w.addEventListener('mousedown',()=>{window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop});
  // quick actions
  const QA=[
    ['🌀','Enter Tunnel',"openApp('game')"],['🧭','The Path',"openApp('path')"],['📝','Paper trade',"openApp('paper')"],
    ['🎓','Learn',"openApp('academy')"],['🏦','GE order',"openApp('ge')"],['🐻','Stake SMRT',"openApp('stake')"],
    ['⚡','Buy SMRT',"quickBuy('SMRT')"],['🐂','Buy SMF',"quickBuy('SMF')"],['🔥','Buy SMC',"quickBuy('SMC')"],
  ];
  $('dkQA').innerHTML=QA.map(q=>'<div class="qa" onclick="'+q[2]+'"><span class="qi">'+q[0]+'</span>'+q[1]+'</div>').join('');
}

/* ---------- Feed: unified desk activity ---------- */
const FEED=[]; // {t, msg, dot}
function feed(msg,dot){FEED.unshift({t:Date.now(),msg,dot:dot||'b'});if(FEED.length>60)FEED.pop();if($('dkFeed'))renderFeed()}
function renderFeed(){
  $('dkFeed').innerHTML=FEED.length?FEED.map(f=>{
    const d=new Date(f.t),ts=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
    return '<div class="fi"><span class="ft">'+ts+'</span><span><span class="dot '+f.dot+'"></span>'+f.msg+'</span></div>';
  }).join(''):'<div class="empty-hint">Quiet desk. Activity from swaps, fills, triggers, bots and whales lands here.</div>';
}
// tap into the OS log stream
try{
  const _rlog=window.rlog;
  if(typeof _rlog==='function'&&!window._deckLogged){
    window._deckLogged=true;
    window.rlog=function(m,k){_rlog(m,k);
      const dot=k==='err'?'r':k==='warn'?'y':k==='ok'?'g':'b';
      feed(String(m).replace(/<[^>]+>/g,''),dot)};
  }
}catch(e){}
// SMARTZ_BUS events → feed
try{window.SMARTZ_BUS&&SMARTZ_BUS.on&&SMARTZ_BUS.on('*',(ev,data)=>{feed('⚡ '+ev+(data?' — '+JSON.stringify(data).slice(0,80):''),'b')})}catch(e){}

/* ---------- Renderers (defensive: work even if a pack is absent) ---------- */
function prices(){try{if(window.prices)return window.prices}catch(e){}
  // fall back to the live mesh feed (os-sync / os-ext populate EXT.prices + EXT.chg)
  const out={};try{const P=window.EXT&&EXT.prices?EXT.prices:{},C=window.EXT&&EXT.chg?EXT.chg:{};
    (window.TOKENS||[]).forEach(t=>{out[t.sym]={price:P[t.sym],chg24:C[t.sym]}})}catch(e){}
  return out}
function tri(sym){try{return(TOKENS||[]).find(t=>t.sym===sym)||{}}catch(e){return{}}}
function renderTri(){
  const p=prices(),el=$('dkTri');if(!el)return;
  el.innerHTML=(window.TOKENS||[]).map(t=>{
    const d=p[t.sym]||{}, px=d.price!=null?d.price:d.usd, chg=d.chg24!=null?d.chg24:(d.chg!=null?d.chg:null);
    return '<div class="tri-row"><span>'+t.glyph+'</span><span class="sym" style="color:'+t.color+'">'+t.sym+'</span>'+
      '<span style="color:var(--dim);font-size:10px">'+(t.name||'').split('·')[0]+'</span>'+
      '<span class="pr">'+(px!=null?fmtP(px):'—')+'</span>'+
      (chg!=null?'<span class="chg '+(chg>=0?'pos':'neg')+'">'+pct(chg)+'</span>':'<span class="chg" style="color:var(--dim)">—</span>')+'</div>';
  }).join('')||'<div class="empty-hint">Loading markets…</div>';
}
function renderHero(){
  if(!$('dkPV'))return;
  let total=0;
  try{ // token balances × price
    const bal=window.balances||{}, p=prices();
    (window.TOKENS||[]).forEach(t=>{total+=(+bal[t.sym]||0)*((p[t.sym]||{}).price||(p[t.sym]||{}).usd||0)});
    total+=+bal.SOL||0;
    if(!total&&window.portfolioUSD)total=portfolioUSD();
  }catch(e){}
  $('dkPV').innerHTML=fmt$(total)+'<small>Total desk value</small>';
  let pnl=0,trades=0;
  try{const s=window.paperStats?paperStats():(window.PT&&PT.stats?PT.stats():null);if(s){pnl=s.pnl||s.totalPnl||0;trades=s.trades||s.n||0}}catch(e){}
  const pe=$('dkPNL');pe.textContent=(pnl>=0?'▲ ':'▼ ')+fmt$(Math.abs(pnl))+(trades?' · '+trades+' trades':' · no paper trades yet');
  pe.className='pnl '+(pnl>=0?'pos':'neg');
  try{$('dkRank').textContent='Rank: '+((window.computeRank?computeRank():null)||'—')}catch(e){}
  try{$('dkWallet').textContent=window.walletKey?('👛 '+walletKey.slice(0,4)+'…'+walletKey.slice(-4)):'No wallet connected'}catch(e){}
  try{const pr=window.perks?perks():null;$('dkPerks').textContent=pr?('Perks: '+(pr.geSlots||'—')+' GE slots · ×'+(pr.xpBoost||1)+' XP'):''}catch(e){}
}
function renderAuto(){
  const el=$('dkAuto');if(!el)return;let h='';
  try{const T=window.TRIG&&TRIG.list?TRIG.list():[];const live=T.filter(t=>t.active!==false);
    h+='<div class="kv"><span>Triggers armed</span><b>'+live.length+'</b></div>';
    live.slice(0,3).forEach(t=>h+='<div class="kv"><span style="color:var(--dim)">· '+(t.sym||'')+' '+(t.dir||t.kind||'')+' '+(t.price||t.target||'')+'</span><b class="pos">armed</b></div>');
  }catch(e){}
  try{const D=window.TRIG&&TRIG.dcas?TRIG.dcas():[];h+='<div class="kv"><span>DCA schedules</span><b>'+D.filter(d=>d.on).length+'</b></div>'}catch(e){}
  el.innerHTML=h||'<div class="empty-hint">No automation yet — arm a trigger or start a DCA.</div>';
}
function renderBots(){
  const el=$('dkBots');if(!el)return;
  try{const ps=(window.BLD&&BLD.projects)||[];const run=ps.filter(p=>p.running);
    el.innerHTML=(ps.length?('<div class="kv"><span>Projects</span><b>'+ps.length+'</b></div><div class="kv"><span>Running now</span><b class="pos">'+run.length+'</b></div>'+
      run.slice(0,3).map(p=>'<div class="kv"><span style="color:var(--dim)">· '+p.name+'</span><b>'+(p.execs||0)+' cycles</b></div>').join('')):
      '<div class="empty-hint">No bots yet — the Sandbox has templates ready.</div>');
  }catch(e){el.innerHTML='<div class="empty-hint">Builder Sandbox offline.</div>'}
}
function renderGE(){
  const el=$('dkGE');if(!el)return;
  try{const offers=(window.geMyOffers?geMyOffers():[])||[];const open=offers.filter(o=>o.status==='open'||!o.status);
    el.innerHTML='<div class="kv"><span>Open offers</span><b>'+open.length+' / '+(window.perks?perks().geSlots:6)+' slots</b></div>'+
      (open.slice(0,3).map(o=>'<div class="kv"><span style="color:var(--dim)">· '+(o.side||'')+' '+(o.qty||'')+' '+(o.item||o.sym||'')+'</span><b>@ '+(o.price||'')+'</b></div>').join('')||'<div class="empty-hint">No open orders — place your first GE offer.</div>');
  }catch(e){el.innerHTML='<div class="empty-hint">Exchange desk syncing…</div>'}
}
function renderPT(){
  const el=$('dkPT');if(!el)return;
  try{const pos=(window.PT&&PT.positions)||{};const ks=Object.keys(pos).filter(k=>(pos[k].qty||0)>0);
    el.innerHTML=ks.length?ks.map(k=>'<div class="kv"><span>'+k+'</span><b>'+(+pos[k].qty).toLocaleString()+' @ '+fmtP(pos[k].avg||0)+'</b></div>').join(''):
      '<div class="empty-hint">Flat. Take a paper position to start tracking.</div>';
  }catch(e){el.innerHTML='<div class="empty-hint">Paper desk syncing…</div>'}
}
function renderDeck(){renderHero();renderTri();renderAuto();renderBots();renderGE();renderPT();renderFeed()}

/* ---------- Taskbar: add Deck + Launchpad buttons ---------- */
function wireNav(){
  const tb=$('taskbar');if(!tb||$('deckBtn'))return;
  const startBtn=$('startBtn');
  const mk=(id,html,fn)=>{const b=document.createElement('button');b.className='btn ghost';b.id=id;b.style.fontSize='12px';b.innerHTML=html;b.onclick=fn;tb.insertBefore(b,startBtn?startBtn.nextSibling:tb.firstChild);return b};
  mk('deckBtn','📊 Deck',()=>openApp('deck'));
  mk('lpBtn','▦ Apps',openLP);
  // repoint the old start button at the Launchpad (grouped, searchable)
  if(startBtn){startBtn.onclick=openLP}
}

/* ---------- Integrate ---------- */
buildDeck();wireNav();
const _openApp13=window.openApp;
window.openApp=function(id){_openApp13(id);if(id==='deck')renderDeck()};
// close helper for dynamically added window
window.closeApp=(function(f){return function(id){const w=$('win-'+id);if(w)w.classList.remove('open');else f(id)}})(window.closeApp||function(){});
setInterval(()=>{const w=$('win-deck');if(w&&w.classList.contains('open'))renderDeck()},8000);
setTimeout(()=>{try{openApp('deck')}catch(e){}},600); // deck becomes the home screen
log('v5.1 Command Deck online — grouped launcher ( press / ), unified desk view','ok');
feed('📊 Command Deck initialized — desk reorganized for traders','g');
})();
