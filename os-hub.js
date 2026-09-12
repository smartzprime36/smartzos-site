/* ============ SmartzOS v5.25 — Hub Layer ============
   26 windows → 5 hub "pages". Every window in a hub carries a tab strip;
   switching tabs swaps content in place (position inherited) so it feels
   like ONE organized page per area, fully loaded underneath.
   Hubs: Trade · Wallet · Earn · Learn · Community  (+System stays a folder) */
(function(){
'use strict';
const $=id=>document.getElementById(id);

const HUBS=[
 {cat:'Trade',     apps:['deck','swap','paper','trig','ge','whale','arena','hive']},
 {cat:'Wallet',    apps:['vault','port','stake','orca','forge']},
 {cat:'Earn',      apps:['missions','board','envoy','bugs','builder','gallery','city']},
 {cat:'Learn',     apps:['path','academy','game','buddy']},
 {cat:'Community', apps:['chat','tg']},
];
const APP_HUB={};HUBS.forEach(h=>h.apps.forEach(a=>APP_HUB[a]=h.cat));
const RENAME={'Portfolio':'Wallet','Build & Earn':'Earn'};
/* nav id → real window id (mirrors os-consolidate ALIAS) so aliased entries
   (envoy→refer, forge→game, trig→trigger, port→portfolio) still get tabs */
const WID={port:'portfolio',trig:'trigger',envoy:'refer',forge:'game'};
const winOf=id=>'win-'+(WID[id]||id);

/* ---------- app metadata (icon/name) scraped from the launchpad ---------- */
let META={};
function scrapeMeta(){
  META={};
  document.querySelectorAll('#lpBody .lp-app').forEach(a=>{
    const id=a.getAttribute('data-app');if(!id)return;
    const icon=(a.querySelector('.li')||{}).textContent||'▦';
    const nn=a.querySelector('span:nth-child(2)');
    META[id]={icon,name:nn?nn.childNodes[0].textContent.trim():id};
  });
}

/* ---------- restructure the launchpad: 7 cats → 5 hubs ----------
   registry() (home folders) reads this same DOM, so folders follow. */
function mergeCats(){
  const body=$('lpBody');if(!body)return;
  scrapeMeta();
  const cats=[...body.querySelectorAll('.lp-cat')];
  const byName={};
  cats.forEach(c=>{const grid=c.nextElementSibling;if(grid&&grid.classList.contains('lp-apps'))byName[c.textContent]={c,grid}});
  // renames
  Object.entries(RENAME).forEach(([old,nw])=>{if(byName[old])byName[old].c.textContent=nw});
  // Intelligence → Trade
  if(byName['Intelligence']&&byName['Trade']){
    [...byName['Intelligence'].grid.children].forEach(ch=>byName['Trade'].grid.appendChild(ch));
    byName['Intelligence'].c.remove();byName['Intelligence'].grid.remove();
  }
  // reorder: Trade, Wallet, Earn, Learn, Community, System
  const order=['Trade','Wallet','Earn','Learn','Community','System'];
  const desired=[];
  order.forEach(name=>{
    const entry=Object.values(byName).find(e=>e.c.isConnected&&e.c.textContent===name);
    if(entry){desired.push(entry.c,entry.grid)}
  });
  // preserve any other children (unlisted categories) in place at the end
  [...body.children].forEach(ch=>{if(!desired.includes(ch))desired.push(ch)});
  // v5.31.1: only touch the DOM when order actually differs — appendChild mutations
  // were retriggering our own childList observer in an endless microtask loop (main-thread freeze)
  const cur=[...body.children];
  const same=cur.length===desired.length&&cur.every((n,i)=>n===desired[i]);
  if(!same)desired.forEach(n=>body.appendChild(n));
}
function armMerge(){
  const body=$('lpBody');
  if(!body)return setTimeout(armMerge,700);
  mergeCats();
  if(!body.dataset.hubObs){
    body.dataset.hubObs='1';
    new MutationObserver(()=>mergeCats()).observe(body,{childList:true});
  }
}

/* ---------- hub tab strip ---------- */
function injectTabs(id){
  const cat=APP_HUB[id];if(!cat)return;
  const w=$(winOf(id));if(!w)return;
  const hub=HUBS.find(h=>h.cat===cat);
  const old=w.querySelector('.hub-tabs');if(old)old.remove();
  const bar=document.createElement('div');bar.className='hub-tabs';
  hub.apps.forEach(a=>{
    const m=META[a]||{icon:'▦',name:a};
    const t=document.createElement('div');t.className='hub-tab'+(a===id?' on':'');
    t.innerHTML='<span class="hi">'+m.icon+'</span>'+m.name;
    t.onclick=()=>hubJump(id,a);
    bar.appendChild(t);
  });
  // insert right under the titlebar (either flavor)
  const tb=w.querySelector('.win-title')||w.querySelector('.titlebar');
  if(tb&&tb.nextSibling)tb.parentNode.insertBefore(bar,tb.nextSibling);
  else if(tb)tb.parentNode.appendChild(bar);
  else w.insertBefore(bar,w.firstChild);
}
window.hubJump=function(fromId,toId){
  if(fromId===toId)return;
  const from=$(winOf(fromId)),to=$(winOf(toId));
  if(from&&to){
    // inherit geometry → feels like the same page swapping content
    to.style.left=from.style.left;to.style.top=from.style.top;
    to.style.width=from.style.width;to.style.height=from.style.height;
    to.classList.add('hub-jump');
    setTimeout(()=>to.classList.remove('hub-jump'),250);
  }
  if(toId==='buddy'){ // buddy is a floating panel, not a window — keep current window open
    if(window.openApp)openApp(toId);return;
  }
  if(window.closeApp)try{closeApp(fromId)}catch(e){}
  if(window.openApp)openApp(toId);
};

/* ---------- wire into openApp (chain-safe) ---------- */
function arm(){
  if(!window.openApp)return setTimeout(arm,500);
  if(window._hubArmed)return;window._hubArmed=1;
  const _open=window.openApp;
  window.openApp=function(id){
    const r=_open.apply(this,arguments);
    setTimeout(()=>injectTabs(id),80);
    return r;
  };
}
arm();
armMerge();
})();
