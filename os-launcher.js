/* SmartzOS v5.13 — Launcher shell
   Lock screen → status bar → desktop home (folders + widgets) → taskbar/start.
   Registry source: the launchpad DOM (built from NAV in os-deck.js). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- registry: scrape launchpad (NAV is IIFE-private) ---------- */
function registry(){
  let body=$('lpBody');
  if(!body&&window.buildLaunchpad){buildLaunchpad();body=$('lpBody')}
  if(!body)return[];
  const cats=[];let cur=null;
  body.childNodes.forEach(n=>{
    if(n.classList&&n.classList.contains('lp-cat')){cur={cat:n.textContent,items:[]};cats.push(cur)}
    else if(cur&&n.classList&&n.classList.contains('lp-apps')){
      n.querySelectorAll('.lp-app').forEach(a=>{
        const appId=a.getAttribute('data-app');
        const m=appId?[0,appId]:(a.getAttribute('onclick')||'').match(/openApp\('([a-z-]+)'\)/);
        if(!m||!m[1])return;
        const icon=(a.querySelector('.li')||{}).textContent||'▦';
        const nameNode=a.querySelector('span:nth-child(2)');
        const name=nameNode?nameNode.childNodes[0].textContent:m[1];
        const desc=(a.querySelector('.ld')||{}).textContent||'';
        cur.items.push({id:m[1],icon,name,desc});
      });
    }
  });
  return cats;
}

/* ---------- LOCK SCREEN ---------- */
function buildLock(){
  if($('lockScreen'))return;
  const l=document.createElement('div');l.id='lockScreen';
  l.innerHTML='<div class="lk-sigil">💠</div>'+
    '<div class="lk-os">SmartzOS</div>'+
    '<div class="lk-clock" id="lkClock">--:--</div>'+
    '<div class="lk-date" id="lkDate"></div>'+
    '<div class="lk-tri"><span>🐻 SMRT</span><span>🐂 SMF</span><span>🔥 SMC</span></div>'+
    '<div class="lk-enter">Tap anywhere to enter the Syndicate</div>'+
    '<div class="lk-ver">SMARTZ SYNDICATE · '+(window.SMARTZ_VERSION||'')+' · MAINNET</div>';
  document.body.appendChild(l);
  const tick=()=>{const c=$('lkClock'),d=$('lkDate');if(!c)return;
    const t=new Date();
    c.textContent=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
    d.textContent=t.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});};
  tick();const iv=setInterval(()=>{if(!$('lkClock'))clearInterval(iv);else tick()},5000);
  l.onclick=()=>{l.classList.add('away');sessionStorage.setItem('smartz_unlocked','1');
    setTimeout(()=>l.remove(),700);log('💠 Shell unlocked — welcome to the desktop','ok')};
}

/* ---------- STATUS BAR ---------- */
function fmtP(p){if(!p)return'—';if(p>=1)return'$'+p.toFixed(2);if(p>=0.01)return'$'+p.toFixed(3);return'$'+p.toPrecision(2)}
function buildStatus(){
  if($('statusBar'))return;
  const b=document.createElement('div');b.id='statusBar';
  b.innerHTML='<div class="sb-brand" id="sbBrand"><b>💠</b>SMARTZ</div>'+
    '<div class="sb-mid" id="sbTick"></div>'+
    '<div class="sb-right">'+
    '<span class="sb-chip" id="sbNet" title="Solana RPC + price mesh"><span class="sb-dot" id="sbDot"></span><span id="sbNetTxt">SYNC</span></span>'+
    '<span class="sb-chip sb-wallet" id="sbWallet">🔑 Connect</span>'+
    '<span class="sb-clock" id="sbClock"></span></div>';
  document.body.appendChild(b);
  $('sbBrand').onclick=()=>goHome();
  $('sbWallet').onclick=()=>{try{openApp('wallet')}catch(e){try{connectWallet()}catch(e2){}}};
  setInterval(()=>{const c=$('sbClock');if(!c)return;const t=new Date();
    c.textContent=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0')},4000);
  setInterval(paintStatus,7000);setTimeout(paintStatus,2600);
}
function paintStatus(){
  // wallet chip
  const w=$('sbWallet');if(w){w.textContent=window.walletKey?('🔑 '+window.walletKey.slice(0,4)+'…'+window.walletKey.slice(-4)):'🔑 Connect'}
  // net dot: price sync within 2min = healthy
  const dot=$('sbDot'),nt=$('sbNetTxt');
  if(dot){const ok=window._lastSync&&(Date.now()-window._lastSync<120000);
    dot.classList.toggle('off',!ok);if(nt)nt.textContent=ok?'SYNC':'STALE'}
  // ticker chips
  const t=$('sbTick');if(!t)return;
  const P=window.EXT&&EXT.prices?EXT.prices:{},C=window.EXT&&EXT.chg?EXT.chg:{};
  t.innerHTML=['SMRT','SMF','SMC'].map(s=>{
    const ch=C[s],cls=ch==null?'':(ch>=0?'up':'dn');
    return'<span class="sb-chip">'+s+' <b>'+fmtP(P[s])+'</b>'+(ch==null?'':' <span class="'+cls+'">'+(ch>=0?'+':'')+ch.toFixed(1)+'%</span>')+'</span>';
  }).join('');
}

/* ---------- DESKTOP HOME ---------- */
const FOLDER_META={
  'Trade':{glyphs:['⚡','📊','📝','⏰'],blurb:'Live swaps, paper practice, automation and the player market'},
  'Portfolio':{glyphs:['🪙','📈','🐻','🌊'],blurb:'Holdings, staking, Orca pools and the Burn Forge'},
  'Build & Earn':{glyphs:['🛠️','🏙️','🎯','🏆'],blurb:'Ship bots, grow Triad City, climb the brackets'},
  'Learn':{glyphs:['🧭','🎓','🌀','💠'],blurb:'The Path, Academy tracks and ZO at your side'},
  'Intelligence':{glyphs:['🧠','🐋'],blurb:'Regime engine, SOL overseer, hive workers'},
  'Community':{glyphs:['💠','🤝'],blurb:'Live mesh chat with the whole Syndicate'},
  'System':{glyphs:['🏛️','⚖️','👥','⚙️'],blurb:'HQ console, governance, council and configuration'}
};
let homeCats=[];
function buildHome(){
  if($('osHome'))return;
  const h=document.createElement('div');h.id='osHome';
  h.innerHTML='<div class="oh-widgets">'+
    '<div class="ohw" id="ohwTri"><div class="ohw-t">Triad Pulse</div><div class="tri-row" id="ohTriRow"></div></div>'+
    '<div class="ohw" id="ohwPath"><div class="ohw-t">Next Step on The Path</div><div class="ohw-b" id="ohPathBody">Open The Path to begin your journey to Architect.</div></div>'+
    '<div class="ohw" id="ohwDrop"><div class="ohw-t">Daily Drop</div><div class="ohw-b" id="ohDropBody">Check the Command Deck each day — the drop resets at UTC midnight.</div></div>'+
    '</div>'+
    '<div class="oh-folders" id="ohFolders"></div>';
  document.body.appendChild(h);
  $('ohwPath').onclick=()=>openApp('path');
  $('ohwDrop').onclick=()=>openApp('deck');
  // folder sheet
  if(!$('foldSheet')){
    const fs=document.createElement('div');fs.id='foldSheet';
    fs.innerHTML='<div class="fs-panel"><div class="fs-head"><span class="fs-title" id="fsTitle"></span>'+
      '<button class="fs-x" onclick="document.getElementById(\'foldSheet\').classList.remove(\'open\')">✕</button></div>'+
      '<div class="fs-grid" id="fsGrid"></div></div>';
    document.body.appendChild(fs);
    fs.addEventListener('click',e=>{if(e.target===fs)fs.classList.remove('open')});
  }
}
function renderFolders(){
  const wrap=$('ohFolders');if(!wrap)return;
  const cats=registry();
  if(!cats.length)return setTimeout(renderFolders,1200);
  homeCats=cats;
  wrap.innerHTML='';
  cats.forEach(c=>{
    const meta=FOLDER_META[c.cat]||{glyphs:c.items.slice(0,4).map(i=>i.icon),blurb:''};
    const f=document.createElement('div');f.className='oh-fold';
    const gl=meta.glyphs.slice(0,4);while(gl.length<4)gl.push('▦');
    f.innerHTML='<div class="fold-tile">'+gl.map(g=>'<span>'+g+'</span>').join('')+'</div>'+
      '<div class="fold-name">'+esc(c.cat)+'</div>';
    f.onclick=()=>openFolder(c,meta);
    wrap.appendChild(f);
  });
  log('🖥 Home screen — '+cats.length+' folders, '+cats.reduce((n,c)=>n+c.items.length,0)+' apps organized','ok');
}
function openFolder(c,meta){
  const fs=$('foldSheet');if(!fs)return;
  $('fsTitle').textContent=c.cat;
  const g=$('fsGrid');g.innerHTML='';
  c.items.forEach(a=>{
    const d=document.createElement('div');d.className='oh-app';
    d.innerHTML='<div class="app-tile">'+a.icon+'</div><div class="app-name">'+esc(a.name)+'</div>';
    d.onclick=()=>{fs.classList.remove('open');openApp(a.id)};
    g.appendChild(d);
  });
  if(meta.blurb){const b=document.createElement('div');b.className='fs-desc';b.textContent=meta.blurb;g.appendChild(b)}
  fs.classList.add('open');
}
function paintWidgets(){
  const row=$('ohTriRow');
  if(row){const P=window.EXT&&EXT.prices?EXT.prices:{},C=window.EXT&&EXT.chg?EXT.chg:{};
    row.innerHTML=[['SMRT','🐻'],['SMF','🐂'],['SMC','🔥']].map(([s,g])=>{
      const ch=C[s],cls=ch==null?'':(ch>=0?'up':'dn');
      return'<div class="tri-p"><div class="s">'+g+' '+s+'</div><div class="p">'+fmtP(P[s])+'</div>'+
        '<div class="c '+cls+'">'+(ch==null?'—':(ch>=0?'+':'')+ch.toFixed(1)+'%')+'</div></div>';
    }).join('')}
  const pb=$('ohPathBody');
  if(pb){try{
    const steps=window.STEPS||[];
    const next=steps.find(s=>{try{return!s.done()}catch(e){return false}});
    if(next)pb.innerHTML='<b>'+esc(next.t||next.name||'Next step')+'</b><br><span style="font-size:11px;color:var(--dim)">'+esc(next.hint||next.desc||'')+' · +'+(next.kp||'')+' KP</span>';
  }catch(e){}}
}

/* ---------- TASKBAR ---------- */
const TB_NAME={}; // filled from registry
function buildTaskbar(){
  // reuse the legacy #taskbar element — its old children stay in the DOM
  // (other packs still write to them) but are hidden via os-launcher.css
  let t=$('taskbar');
  if(!t){t=document.createElement('div');t.id='taskbar';document.body.appendChild(t)}
  if($('tbStart'))return;
  t.insertAdjacentHTML('afterbegin',
    '<div class="tb-start" id="tbStart">💠 <span class="tb-lbl">START</span></div>'+
    '<div class="tb-runs" id="tbRuns"></div>');
  t.insertAdjacentHTML('beforeend',
    '<div class="tb-right"><button class="tb-home" id="tbHome" title="Home — minimize all windows">⌂</button>'+
    '<div class="tb-clock" id="tbClock"></div></div>');
  $('tbStart').onclick=openStart;  // Start = the existing searchable launchpad
  $('tbHome').onclick=goHome;
  setInterval(()=>{const c=$('tbClock');if(!c)return;const d=new Date();
    c.innerHTML='<b>'+d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+'</b><br>'+
    d.toLocaleDateString(undefined,{month:'short',day:'numeric'})},5000);
  setInterval(paintRuns,1200);
}
function winIcon(id){
  for(const c of homeCats){const f=c.items.find(i=>i.id===id);if(f)return f.icon}
  return'▦';
}
function winName(id,w){
  for(const c of homeCats){const f=c.items.find(i=>i.id===id);if(f)return f.name}
  const t=w&&w.querySelector('.win-title span');return t?t.textContent.slice(0,18):id;
}
function paintRuns(){
  const wrap=$('tbRuns');if(!wrap)return;
  const openWins=[...document.querySelectorAll('.win.open')];
  document.body.classList.toggle('os-home',openWins.length===0);
  const key=openWins.map(w=>w.id).join('|');
  if(wrap.dataset.key===key){ // just refresh focus state
    const top=topWin();
    wrap.querySelectorAll('.tb-run').forEach(b=>b.classList.toggle('focus',b.dataset.win===top));
    return;
  }
  wrap.dataset.key=key;wrap.innerHTML='';
  const top=topWin();
  openWins.forEach(w=>{
    const id=w.id.replace(/^win-/,'');
    const b=document.createElement('div');b.className='tb-run'+(w.id===top?' focus':'');
    b.dataset.win=w.id;
    b.innerHTML='<span class="g">'+winIcon(id)+'</span>'+esc(winName(id,w));
    b.onclick=()=>toggleWinFocus(w);
    wrap.appendChild(b);
  });
}
function topWin(){let top=null,z=-1;
  document.querySelectorAll('.win.open').forEach(w=>{const zz=+w.style.zIndex||0;if(zz>z){z=zz;top=w.id}});
  return top}
function toggleWinFocus(w){
  if(topWin()===w.id){w.classList.remove('open')} // tap focused app = minimize
  else{w.classList.add('open');window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop}
  paintRuns();
}
function goHome(){
  document.querySelectorAll('.win.open').forEach(w=>w.classList.remove('open'));
  const fs=$('foldSheet');if(fs)fs.classList.remove('open');
  paintRuns();
}

/* Start menu = the deck's launchpad, invoked through its own '/' hotkey */
function openStart(hidden){
  try{
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}));
    if(hidden){const lp=$('launchpad');if(lp)lp.classList.remove('open')}
  }catch(e){}
}

/* ---------- BOOT SEQUENCE ---------- */
function boot(){
  buildLock();buildStatus();buildHome();buildTaskbar();
  // registry comes from launchpad — build it hidden first so we can scrape
  openStart(true);
  setTimeout(renderFolders,1600);
  setInterval(paintWidgets,9000);setTimeout(paintWidgets,3200);
  // shell owns the boot: home screen only, no auto-open windows
  setTimeout(()=>{
    const unlocked=sessionStorage.getItem('smartz_unlocked');
    if(unlocked){const l=$('lockScreen');if(l)l.remove()}
    goHome();
    // v5.31.1: never strand the operator on a blank screen — boot lands on the Command Deck
    try{if(window.openApp)openApp('deck')}catch(e){}
  },3400);
  // re-render folders if the deck rebuilds the launchpad later
  setTimeout(renderFolders,4000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));
else setTimeout(boot,600);
log('v5.13 Launcher shell — lock screen, status bar, desktop folders, taskbar','ok');
})();
