/* SmartzOS v5.11.1 — Consolidation: one icon per app, aliased windows, no boot overlap */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};

/* ============ 1. ALIASES — NAV ids → real window ids (kills broken/duplicate links) ============ */
const ALIAS={port:'portfolio',trig:'trigger',envoy:'refer',forge:'game'};
function resolve(id){
  if(ALIAS[id])return ALIAS[id];
  if(id==='buddy'){const f=$('buddyFab');f&&f.click();return null}
  return id;
}
const _openApp25=window.openApp;
window.openApp=function(id){const r=resolve(id);if(r==null)return;_openApp25(r)};
window.closeApp=(function(f){return function(id){const w=$('win-'+resolve(id));w&&w.classList.remove('open')}})(window.closeApp);

/* ============ 2. DESKTOP REBUILD — single canonical icon set from the Launchpad registry ============ */
const ORDER=['deck','path','swap','paper','trig','ge','orca','whale','vault','port','stake','forge','builder','gallery','city','missions','board','envoy','academy','game','buddy','chat','hive','hq','gov','members','settings'];
function canonicalApps(){
  // scrape the launchpad (built from NAV) — it is the single source of truth
  const items=[];
  document.querySelectorAll('.lp-app').forEach(a=>{
    // v5.31: launchpad apps carry data-app + JS-closure onclick (no HTML attribute) — read data-app first
    const da=a.getAttribute('data-app');
    const m=da?null:(a.getAttribute('onclick')||'').match(/openApp\('([a-z-]+)'\)/);
    const id=da||(m&&m[1]);
    const name=(a.querySelector('span:nth-child(2)')||{}).childNodes;
    if(id)items.push({id:id,icon:(a.querySelector('.li')||{}).textContent||'▦',name:(name[0]&&name[0].textContent)||id});
  });
  return items;
}
function rebuildDesktop(){
  const desk=$('desktop');if(!desk)return;
  desk.innerHTML=''; // wipe every pack-injected icon — duplicates die here
  let apps=canonicalApps();
  if(!apps.length)return setTimeout(rebuildDesktop,1000); // launchpad not ready yet
  apps.sort((a,b)=>ORDER.indexOf(a.id)-ORDER.indexOf(b.id));
  const seen=new Set();
  apps.forEach(a=>{
    if(seen.has(a.id))return;seen.add(a.id);
    const d=document.createElement('div');d.className='desk-icon';
    d.dataset.tier='1';
    d.innerHTML='<div class="glyph">'+a.icon+'</div><div class="lbl">'+a.name+'</div>';
    d.onclick=()=>openApp(a.id);
    desk.appendChild(d);
  });
  log('🖥 Desktop consolidated — '+seen.size+' canonical apps, duplicates removed','ok');
}
setTimeout(rebuildDesktop,2500);

/* ============ 3. NO BOOT OVERLAP — only the Deck may be open after startup (all screens) ============ */
setTimeout(()=>{
  document.querySelectorAll('.win.open').forEach(w=>{if(w.id!=='win-deck')w.classList.remove('open')});
  const d=$('win-deck');if(d)d.classList.add('open');
},2200);
// v5.31: the Deck window can be built later than the 2.2s sweep — re-assert it so the OS never lands on an empty screen
setTimeout(()=>{
  if(!document.querySelector('.win.open')&&window.openApp)try{openApp('deck')}catch(e){}
},4200);

/* ============ 4. DUPLICATE SURFACE FLAGS — collapse legacy standalone panels into pointers ============ */
// Zoran Shell (win-cli) + Advisor (win-advisor) duplicate ZO Buddy's job: keep windows but remove from stray menus
// (they remain openable via launchpad only if registered — rebuildDesktop already dropped unregistered icons)
log('v5.11.1 Consolidation — aliases fixed, desktop deduplicated, boot overlap removed','ok');
})();
