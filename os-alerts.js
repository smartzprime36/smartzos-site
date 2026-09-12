/* SmartzOS v5.15 — Signals layer
   OS dev:      notification center + quick settings (the missing shell surfaces)
   Game dev:    daily check-in streak (in-game credits only — no real-capital loops)
   Trader:      one-shot price alerts on the live mesh feed                        */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ============ 1. NOTIFICATION CENTER ============ */
const NKEY='smartz_notifs_v1', SKEY='smartz_settings_v1';
let NOTIFS=[]; try{NOTIFS=JSON.parse(localStorage.getItem(NKEY))||[]}catch(e){}
let SET={sound:true,notifs:true}; try{Object.assign(SET,JSON.parse(localStorage.getItem(SKEY))||{})}catch(e){}
function saveN(){try{localStorage.setItem(NKEY,JSON.stringify(NOTIFS.slice(0,50)))}catch(e){}}
function saveS(){try{localStorage.setItem(SKEY,JSON.stringify(SET))}catch(e){}}
let unread=0, tab='notes';

function iconFor(t){t=(t||'').toLowerCase();
  if(/alert|price|trigger|stop|fill|whale/.test(t))return'📈';
  if(/chat|mesh|mention/.test(t))return'💬';
  if(/streak|check-in|reward|credit/.test(t))return'🔥';
  if(/error|fail|warn|stale/.test(t))return'⚠️';
  return'◈';}

function pushNote(title,body,kind){
  if(!SET.notifs)return;
  NOTIFS.unshift({t:Date.now(),title:String(title||'SmartzOS'),body:String(body||''),kind:kind||''});
  if(NOTIFS.length>50)NOTIFS.pop(); saveN();
  unread++; paintBell(); if($('sigPanel')&&$('sigPanel').classList.contains('open'))paintBody();
}
function paintBell(){const b=$('sigBell');if(!b)return;
  b.classList.toggle('has-unread',unread>0);
  const bd=b.querySelector('.sig-badge');if(bd)bd.textContent=unread>9?'9+':unread;}

/* capture every toast the OS already emits */
function hookNotify(){
  if(typeof window.notify!=='function'||window.notify._sig)return;
  const old=window.notify;
  const wrapped=function(title,body,type){
    pushNote(title,body,type);
    if(!SET.sound)return; // muted = silent center, no toast storm
    return old.apply(this,arguments);
  };
  wrapped._sig=true; window.notify=wrapped;
}
/* capture bus events that never toast */
function hookBus(){
  try{if(!window.SMARTZ_BUS||!SMARTZ_BUS.on)return;
    SMARTZ_BUS.on('*',(ev,data)=>{
      if(/^(ge\.fill|trade\.fill|trig\.fire|whale\.move|regime\.shift|build\.ship|forge)$/.test(ev))
        pushNote('⚡ '+ev.replace('.',' · '), data?JSON.stringify(data).slice(0,90):'bus event', 'bus');
    });
  }catch(e){}
}

/* ============ 2. PANEL (notes / alerts / settings) ============ */
function buildPanel(){
  if($('sigPanel'))return;
  document.body.insertAdjacentHTML('beforeend',
   '<div id="sigPanel"><div class="sig-head"><b>◈ SIGNALS</b><div class="sig-tabs">'+
   '<button class="sig-tab on" data-t="notes">Feed</button>'+
   '<button class="sig-tab" data-t="alerts">Alerts</button>'+
   '<button class="sig-tab" data-t="settings">Settings</button></div></div>'+
   '<div class="sig-body" id="sigBody"></div></div>');
  document.querySelectorAll('#sigPanel .sig-tab').forEach(b=>b.onclick=()=>{
    tab=b.dataset.t;
    document.querySelectorAll('#sigPanel .sig-tab').forEach(x=>x.classList.toggle('on',x===b));
    paintBody();});
  document.addEventListener('mousedown',e=>{
    const p=$('sigPanel');if(p&&p.classList.contains('open')&&!p.contains(e.target)&&!$('sigBell').contains(e.target))p.classList.remove('open');
  });
}
function paintBody(){
  const el=$('sigBody');if(!el)return;
  if(tab==='notes'){
    el.innerHTML=NOTIFS.length?NOTIFS.map(n=>{
      const d=new Date(n.t),ts=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
      return'<div class="sig-note"><span class="n-ic">'+iconFor(n.title+' '+n.kind)+'</span><span><div class="n-t">'+esc(n.title)+
        '</div><div class="n-b">'+esc(n.body)+'</div></span><span class="n-ts">'+ts+'</span></div>';
    }).join(''):'<div class="sig-empty">No signals yet — alerts, fills, streaks and mesh events land here.</div>';
    if(NOTIFS.length)el.innerHTML+='<button class="sig-clear" id="sigClear">Clear all</button>';
    const c=$('sigClear');if(c)c.onclick=()=>{NOTIFS=[];saveN();paintBody()};
  }
  else if(tab==='alerts'){
    el.innerHTML='<div class="qs-row" style="border:none;background:none;padding:2px"><span style="font-size:10.5px;color:#8b93a5">One-shot price alerts on the live mesh feed — fires once, then clears.</span></div>'+
     '<div class="pa-form"><select id="paSym"><option>SMRT</option><option>SMF</option><option>SMC</option></select>'+
     '<select id="paDir"><option value="above">rises above</option><option value="below">drops below</option></select>'+
     '<input id="paPx" type="number" step="any" placeholder="price $"><button class="qs-btn" id="paAdd">+ Arm</button></div>'+
     '<div id="paList"></div>';
    $('paAdd').onclick=addAlert; paintAlerts();
  }
  else{ // settings
    const rpc=(window.RPC_URL||window.SOLANA_RPC||'solana-rpc.publicnode.com');
    el.innerHTML=
     '<div class="qs-row"><span class="qs-l">🔔 Notifications into the center</span><div class="qs-tog '+(SET.notifs?'on':'')+'" id="qsNotif"></div></div>'+
     '<div class="qs-row"><span class="qs-l">🍞 Toast popups (visual + sound)</span><div class="qs-tog '+(SET.sound?'on':'')+'" id="qsSound"></div></div>'+
     '<div class="qs-row"><span class="qs-l">🛰 Price mesh<br><span style="font-size:9.5px;color:#6d7688">'+esc(String(rpc))+'</span></span><button class="qs-btn" id="qsSync">↻ Resync</button></div>'+
     '<div class="qs-row"><span class="qs-l">📶 Shell</span><button class="qs-btn" id="qsHome">⌂ Home</button></div>';
    $('qsNotif').onclick=e=>{SET.notifs=!SET.notifs;saveS();e.target.classList.toggle('on',SET.notifs)};
    $('qsSound').onclick=e=>{SET.sound=!SET.sound;saveS();e.target.classList.toggle('on',SET.sound)};
    $('qsSync').onclick=()=>{try{window.extFetchPrices&&extFetchPrices()}catch(e){}try{window.notify&&notify('Mesh','Price resync requested.','ok')}catch(e){}};
    $('qsHome').onclick=()=>{const p=$('sigPanel');if(p)p.classList.remove('open');try{document.querySelectorAll('.win.open').forEach(w=>w.classList.remove('open'))}catch(e){}};
  }
}

/* ============ 3. PRICE ALERTS (trader) ============ */
const AKEY='smartz_price_alerts_v1';
let ALERTS=[]; try{ALERTS=JSON.parse(localStorage.getItem(AKEY))||[]}catch(e){}
function saveA(){try{localStorage.setItem(AKEY,JSON.stringify(ALERTS))}catch(e){}}
function livePx(sym){try{return (window.EXT&&EXT.prices)?EXT.prices[sym]:null}catch(e){return null}}
function addAlert(){
  const sym=$('paSym').value,dir=$('paDir').value,px=+$('paPx').value;
  if(!px||px<=0){window.notify&&notify('Alerts','Enter a valid target price.','warn');return}
  ALERTS.push({sym,dir,px,armed:Date.now()});saveA();paintAlerts();
  window.notify&&notify('📈 Alert armed',sym+' '+dir+' '+px,'ok');
}
function paintAlerts(){const el=$('paList');if(!el)return;
  el.innerHTML=ALERTS.length?ALERTS.map((a,i)=>{
    const live=livePx(a.sym);
    return'<div class="pa-row"><span>'+(a.dir==='above'?'▲':'▼')+' <b>'+a.sym+'</b> '+(a.dir==='above'?'above':'below')+' $'+a.px+'</span>'+
     '<span style="font-size:9.5px;color:#6d7688">live '+(live?('$'+(+live).toPrecision(4)):'—')+'</span>'+
     '<span class="pa-x" data-i="'+i+'">✕</span></div>';
  }).join(''):'<div class="sig-empty">No alerts armed.</div>';
  el.querySelectorAll('.pa-x').forEach(x=>x.onclick=()=>{ALERTS.splice(+x.dataset.i,1);saveA();paintAlerts()});
}
setInterval(()=>{
  if(!ALERTS.length)return; let fired=false;
  ALERTS=ALERTS.filter(a=>{
    const p=livePx(a.sym); if(p==null)return true;
    const hit=a.dir==='above'?p>=a.px:p<=a.px;
    if(hit){fired=true;
      pushNote('📈 Price alert — '+a.sym,a.sym+' crossed '+(a.dir==='above'?'above':'below')+' $'+a.px+' (live $'+(+p).toPrecision(4)+')','alert');
      try{window.notify&&SET.sound&&notify('📈 '+a.sym+' alert hit','Target $'+a.px+' — live $'+(+p).toPrecision(4),'ok')}catch(e){}
      return false;}
    return true;});
  if(fired){saveA();paintAlerts()}
},25000);

/* ============ 4. DAILY STREAK (game layer — in-game credits only) ============ */
const STKEY='smartz_streak_v1';
let ST={n:0,last:''}; try{Object.assign(ST,JSON.parse(localStorage.getItem(STKEY))||{})}catch(e){}
function saveST(){try{localStorage.setItem(STKEY,JSON.stringify(ST))}catch(e){}}
function todayUTC(){return new Date().toISOString().slice(0,10)}
function canClaim(){return ST.last!==todayUTC()}
function streakReward(){return Math.min(25+15*(ST.n),150)}
function claimStreak(){
  if(!canClaim())return;
  const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  if(ST.last!==y&&ST.last&&window.SHOP&&SHOP.has('streak_shield')){
    // missed at least one day — the shield takes the hit
    SHOP.use('streak_shield');
    ST.n++;ST.last=todayUTC();saveST();
    pushNote('🛡️ Streak Shield consumed','Your '+ST.n+'-day streak survived a missed day.','streak');
    try{window.notify&&notify('🛡️ Shield saved your streak','Day '+ST.n+' continues. The shield is consumed.','ok')}catch(e){}
    paintStreak();return;
  }
  ST.n=(ST.last===y)?ST.n+1:1; ST.last=todayUTC(); saveST();
  const r=streakReward();
  try{G.credits+=r;saveGame()}catch(e){}
  pushNote('🔥 Daily check-in','Day '+ST.n+' streak — +'+r+' credits claimed.','streak');
  try{window.notify&&notify('🔥 Streak day '+ST.n,'+'+r+' credits landed in your vault.','ok')}catch(e){}
  paintStreak();
}
function paintStreak(){
  // power the launcher's existing "Daily Drop" widget (ohDropBody) — no duplicate cards
  let w=$('streakW');
  if(!w){
    const host=$('ohDropBody');if(!host)return;
    const t=host.closest('.ohw');const ttl=t&&t.querySelector('.ohw-t');
    if(ttl)ttl.textContent='🔥 Daily Drop — Check-in Streak';
    host.innerHTML='<div id="streakW"></div>'; w=$('streakW');
  }
  w.innerHTML='<span class="st-fl">🔥</span><span><div class="st-n">'+ST.n+' day'+(ST.n===1?'':'s')+'</div>'+
    '<div class="st-s">'+(canClaim()?('Claim +'+Math.min(25+15*ST.n,150)+' credits'):'Claimed — come back tomorrow')+'</div></span>'+
    (canClaim()?'<button class="qs-btn" id="stClaim">Claim</button>':'');
  const b=$('stClaim');if(b)b.onclick=claimStreak;
}

/* ============ 5. STATUS BAR BELL + BOOT ============ */
function buildBell(){
  const right=document.querySelector('#statusBar .sb-right');if(!right||$('sigBell'))return;
  const b=document.createElement('span');b.className='sb-chip';b.id='sigBell';b.title='Signals — notifications, alerts, settings';
  b.innerHTML='🔔<span class="sig-badge"></span>';
  right.insertBefore(b,right.firstChild);
  b.onclick=()=>{const p=$('sigPanel');if(!p)return;
    const open=p.classList.toggle('open');
    if(open){unread=0;paintBell();paintBody()}};
}
function boot(){
  buildPanel();hookNotify();hookBus();
  // status bar is built by os-launcher — wait for it
  let tries=0;const iv=setInterval(()=>{
    buildBell();paintStreak();
    if(($('sigBell')&&$('streakW'))||++tries>20)clearInterval(iv);
  },800);
  setInterval(paintStreak,30000);
  log('v5.15 Signals — notification center, quick settings, price alerts, daily streak','ok');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));
else setTimeout(boot,900);
})();
