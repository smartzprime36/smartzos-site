/* ============ SmartzOS v5.26 — Loop Hardening ============
   1. Overclock Status Panel — Sanctum becomes alive: engagement multiplier, decay timer
   2. War Room ticker — taskbar ticker rotates prices ↔ live operator events
   3. Quick-launch dock — Swap / Builder / Chat / Tunnel one tap from home
   4. Kill Streak perks — 3+ day streak boosts Koda staking yield ×1.25 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LKEY='smartz_loop_v1';

/* ================= ENGAGEMENT MULTIPLIER ================= */
let L={mult:1.0,last:0};
try{Object.assign(L,JSON.parse(localStorage.getItem(LKEY)||'{}'))}catch(e){}
function saveL(){localStorage.setItem(LKEY,JSON.stringify(L))}
function decay(){ // 0.1x per 24h idle, floor 1.0
  if(!L.last)return;
  const days=(Date.now()-L.last)/864e5;
  L.mult=Math.max(1.0,Math.min(1.5,L.mult-Math.floor(days)*0.1));
}
function bump(n){
  decay();
  L.mult=Math.min(1.5,+(L.mult+n).toFixed(2));
  L.last=Date.now();saveL();paintPanel();
}
function streakDays(){try{return JSON.parse(localStorage.getItem('smartz_init_v1')||'{}').streak||0}catch(e){return 0}}
window.LOOP={
  mult(){decay();const s=streakDays()>=3?0.25:0;return +(Math.min(1.75,L.mult+s)).toFixed(2)},
  engage:bump,
};

function bus(){return window.SMARTZ_BUS||(typeof SMARTZ_BUS!=='undefined'?SMARTZ_BUS:null)}
/* engagement events feed the multiplier */
function armBus(){
  const B=bus();if(!B)return setTimeout(armBus,800);
  ['trade','tunnel.clear','forge','build.ship','ge.offer','ge.fill'].forEach(ev=>{
    try{B.on(ev,()=>bump(0.1))}catch(e){}
  });
}
/* KP awards ride the multiplier too */
function armKP(){
  if(!window.awardKP)return setTimeout(armKP,800);
  if(window._loopKP)return;window._loopKP=1;
  const raw=window.awardKP;
  window.awardKP=function(n,why){
    const m=window.LOOP?LOOP.mult():1;
    return raw.call(this,Math.round(n*m),why+(m>1?' (×'+m.toFixed(2)+' loop)':''));
  };
}

/* ================= 1. OVERCLOCK STATUS PANEL ================= */
function buildPanel(){
  const s=$('sanctum');if(!s)return setTimeout(buildPanel,900);
  if($('loopPanel'))return;
  const p=document.createElement('div');p.id='loopPanel';p.className='loop-panel';
  s.insertBefore(p,s.children[1]||null); // right under the banner
  paintPanel();setInterval(paintPanel,30000);
}
function fmtCountdown(){
  if(!L.last||L.mult<=1.0)return '—';
  const left=Math.max(0,864e5-(Date.now()-L.last));
  const h=Math.floor(left/36e5),m=Math.floor(left%36e5/6e4);
  return h+'h '+m+'m';
}
function paintPanel(){
  const p=$('loopPanel');if(!p)return;
  decay();
  const s=streakDays(),sm=s>=3;
  const oc=(function(){try{return JSON.parse(localStorage.getItem('smartz_init_v1')||'{}').overclock}catch(e){return false}})();
  const mult=LOOP.mult();
  const decayPct=L.mult>1.0?Math.max(0,100-(Date.now()-L.last)/864e5*100):0;
  p.innerHTML='<h4>⚔ Overclock Status — execution loop</h4>'+
   '<div class="lp-grid">'+
    '<div class="lp-cell"><div class="l">Loop multiplier</div><div class="v hot">×'+mult.toFixed(2)+'</div></div>'+
    '<div class="lp-cell"><div class="l">Decays in</div><div class="v cool">'+fmtCountdown()+'</div></div>'+
    '<div class="lp-cell"><div class="l">Tauron overclock</div><div class="v" style="color:'+(oc?'#e04fff':'#8aa')+'">'+(oc?'3× SPEED':'standard')+'</div></div>'+
    '<div class="lp-cell"><div class="l">Kill streak</div><div class="v" style="color:'+(sm?'#ff9a3c':'#8aa')+'">'+s+' day'+(s===1?'':'s')+'</div></div>'+
   '</div>'+
   '<div class="lp-decay"><div style="width:'+decayPct+'%"></div></div>'+
   '<span class="lp-streak'+(sm?'':' off')+'">'+(sm?'🔥 STREAK PERK ACTIVE — Koda yield ×1.25':'🔥 Clear 3 days in a row → Koda yield ×1.25')+'</span>'+
   '<div class="lp-note">Every trade, tunnel clear, forge, GE offer and shipped build feeds the loop (max ×1.5). Idle 24h and it decays −0.1. The loop multiplies your KP awards.</div>';
}

/* ================= 2. WAR ROOM TICKER ================= */
const EVENTS=[];
function pushEvent(icon,txt){
  EVENTS.unshift(icon+' '+String(txt).slice(0,90));
  if(EVENTS.length>8)EVENTS.pop();
}
function armEvents(){
  const B=bus();if(!B)return setTimeout(armEvents,800);
  const map={'ge.offer':'🏦','ge.fill':'💱','forge':'🔥','build.ship':'🛠','build.deploy':'🚀','tunnel.clear':'🌀','trade':'⚡','whale.move':'🐋','rank.up':'🎖'};
  Object.entries(map).forEach(([ev,ic])=>{
    try{B.on(ev,d=>pushEvent(ic,(d&&(d.name||d.why||d.txt||ev))+' — '+ev.replace('.',' ')))}catch(e){}
  });
}
function armTicker(){
  const tt=$('ticker-txt');
  if(!tt)return setTimeout(armTicker,900);
  if(tt.dataset.loop)return;tt.dataset.loop='1';
  let tick=0;
  setInterval(()=>{
    tick++;
    if(tick%3!==2||!EVENTS.length)return; // 2 of 3 rotations stay prices
    const priceLine=tt.dataset.prices||(tt.dataset.prices=tt.innerHTML);
    tt.innerHTML='⚔ WAR ROOM — '+EVENTS.join(' &nbsp;·&nbsp; ');
    setTimeout(()=>{tt.innerHTML=tt.dataset.prices},9000);
  },9000);
}

/* ================= 3. QUICK-LAUNCH DOCK ================= */
function buildDock(){
  const home=$('osHome');if(!home)return setTimeout(buildDock,900);
  if($('qlDock'))return;
  const bar=$('zoHomeBar');
  const d=document.createElement('div');d.id='qlDock';
  d.innerHTML=[['⚡','Swap','swap'],['🛠️','Builder','builder'],['⚔️','Arena','arena'],['💠','Chat','chat'],['🌀','Tunnel','game']]
    .map(x=>'<button class="ql" onclick="openApp(\''+x[2]+'\')"><span class="qi">'+x[0]+'</span>'+x[1]+'</button>').join('');
  home.insertBefore(d,bar?bar.nextSibling:home.firstChild);
}

armBus();armKP();armEvents();armTicker();
buildPanel();buildDock();
})();
