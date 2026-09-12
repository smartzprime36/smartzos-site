/* SmartzOS v5.5 — Hive Bridge: ports syndicate-core's strategist + SOL engine + hive monitor into the OS */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};

/* ============ 1. REGIME ENGINE — port of strategist.py ============
   Reads triad market telemetry (EXT.chg + EXT.meta from os-sync),
   detects the dominant regime, formulates capital strategy. */
const REGIME={name:'NEUTRAL',strat:'NEUTRAL_MONITORING',why:'Awaiting market convergence…',ts:0};
window.REGIME=REGIME;
function detectRegime(){
  const chg=(window.EXT&&EXT.chg)||{},meta=(window.EXT&&EXT.meta)||{};
  const syms=(window.TOKENS||[]).map(t=>t.sym);
  let absChg=0,volSum=0,liqSum=0,n=0;
  syms.forEach(s=>{absChg+=Math.abs(chg[s]||0);volSum+=(meta[s]||{}).vol24||0;liqSum+=(meta[s]||{}).liq||0;n++});
  if(!n||(!absChg&&!volSum))return;
  const avgAbs=absChg/n;
  const prev=REGIME._vol||0;REGIME._vol=volSum;
  const volRising=prev>0&&volSum>prev*1.2;
  let name,strat,why;
  if(avgAbs>=5||volRising){
    name='VOLATILITY';strat='AGGRESSIVE_ACCUMULATION';
    why='avg |24h| '+avgAbs.toFixed(1)+'%'+(volRising?' · volume expanding':'')+' — Tauron regime. Momentum plays favored; mind position size.';
  }else if(avgAbs<=2){
    name='STABILITY';strat='DEFENSIVE_STAKING';
    why='avg |24h| '+avgAbs.toFixed(1)+'% — Koda regime. The Shield approves: staking + DCA conditions.';
  }else{
    name='NEUTRAL';strat='NEUTRAL_MONITORING';
    why='avg |24h| '+avgAbs.toFixed(1)+'% — standard loop activity. Watch the edges.';
  }
  const changed=name!==REGIME.name;
  REGIME.name=name;REGIME.strat=strat;REGIME.why=why;REGIME.ts=Date.now();
  if(changed){
    log('🧠 STRATEGIST: regime → '+name+' · '+strat,'info');
    try{window.feed&&feed('🧠 Regime shift: '+name+' → '+strat,name==='VOLATILITY'?'y':'b')}catch(e){}
    try{window.SMARTZ_BUS&&SMARTZ_BUS.emit&&SMARTZ_BUS.emit('regime.shift',{regime:name,strategy:strat})}catch(e){}
  }
  renderRegime();
}
function renderRegime(){
  const el=$('hiveRegime');if(!el)return;
  const cls=REGIME.name==='VOLATILITY'?'regime-vol':REGIME.name==='STABILITY'?'regime-stab':'regime-neutral';
  el.className='hive-regime '+cls;
  el.innerHTML='<div class="regime-name">'+REGIME.name+'</div>'+
    '<div class="regime-strat">STRATEGY: '+REGIME.strat+'</div>'+
    '<div class="regime-why">'+REGIME.why+'</div>';
}
setInterval(detectRegime,60000);setTimeout(detectRegime,5000);

/* ============ 2. SOL OVERSEER — port of sol_engine.py ============
   Doctrine monitoring: feed freshness, mesh connectivity, wallet path.
   P0 escalations surface in feed + SOL log. */
const SOL_LOG=[];
function solLog(msg,cls){SOL_LOG.unshift({msg,cls:cls||'',ts:Date.now()});if(SOL_LOG.length>40)SOL_LOG.pop();renderSol()}
function renderSol(){
  const el=$('solLog');if(!el)return;
  el.innerHTML=SOL_LOG.map(l=>'<div class="'+l.cls+'">['+new Date(l.ts).toTimeString().slice(0,8)+'] '+l.msg+'</div>').join('')||'<div>Overseer idle.</div>';
}
function solCycle(){
  // 1. Feed freshness doctrine
  const age=window._lastSync?(Date.now()-_lastSync)/1000:999;
  if(age>120){solLog('P0: market feed stale ('+Math.round(age)+'s) — doctrine violation: STALE_INTELLIGENCE','p0');
    try{window.feed&&feed('⚠️ SOL OVERSEER: market feed stale — prices may be outdated','r')}catch(e){}}
  // 2. Mesh connectivity doctrine
  try{const c=JSON.parse(localStorage.getItem('smartz_sb')||'null');
    if(c&&c.url)solLog('mesh link: CONNECTED','ok');else solLog('mesh link: LOCAL-ONLY (Supabase not configured)')}catch(e){}
  // 3. Wallet path doctrine (informational)
  solLog('wallet path: '+(window.walletKey?'ARMED':'unlinked'),window.walletKey?'ok':'');
}
setInterval(solCycle,45000);setTimeout(solCycle,9000);

/* ============ 3. HIVE MONITOR — live view of hive_workers / hive_status ============ */
function sb(){try{const c=JSON.parse(localStorage.getItem('smartz_sb')||'null');return(c&&c.url&&c.key)?c:null}catch(e){return null}}
async function fetchHive(){
  const el=$('hiveWorkers');if(!el)return;
  const c=sb();
  if(!c){el.innerHTML='<div class="empty-hint">Mesh offline — hive tables unreachable.</div>';return}
  try{
    const [w,s]=await Promise.all([
      fetch(c.url.replace(/\/$/,'')+'/rest/v1/hive_workers?select=*&limit=20',{headers:{apikey:c.key,Authorization:'Bearer '+c.key}}).then(r=>r.ok?r.json():[]),
      fetch(c.url.replace(/\/$/,'')+'/rest/v1/hive_status?select=*&limit=20',{headers:{apikey:c.key,Authorization:'Bearer '+c.key}}).then(r=>r.ok?r.json():[]),
    ]);
    const rows=[].concat(w||[],s||[]);
    if(!rows.length){el.innerHTML='<div class="empty-hint">No hive workers reporting yet. When syndicate-core agents come online (Redis linkers, snapshot managers, strategists), they appear here in real time.</div>';return}
    el.innerHTML=rows.map(r=>{
      const name=r.name||r.worker||r.agent||r.id||'worker';
      const status=r.status||r.state||r.last_seen||'reporting';
      const alive=/run|online|active|ok|alive/i.test(String(status));
      return '<div class="hive-worker"><span class="hw-dot" style="background:'+(alive?'#3ddc97':'#ffc857')+'"></span>'+
        '<span class="hw-name">'+String(name)+'</span><span class="hw-status">'+String(status).slice(0,40)+'</span></div>';
    }).join('');
  }catch(e){el.innerHTML='<div class="empty-hint">Hive read failed — check RLS policies on hive tables.</div>'}
}

/* ============ 4. WINDOW ============ */
function buildHive(){
  if($('win-hive'))return;
  const w=document.createElement('div');w.className='win';w.id='win-hive';
  window.zTop=(window.zTop||100)+1;
  w.style.cssText='top:90px;left:200px;width:560px;height:520px;z-index:'+window.zTop;
  w.innerHTML='<div class="win-title"><span>🧠 Hive Bridge <span class="sys-badge on" style="margin-left:8px">STRATEGIST ONLINE</span></span>'+
    '<span><button class="tbtn" onclick="maxWin(\'win-hive\')">□</button><button class="tbtn" onclick="closeApp(\'hive\')">✕</button></span></div>'+
    '<div class="win-body">'+
    '<div class="rune-line">⟨ MARKET REGIME ⟩</div>'+
    '<div class="hive-regime regime-neutral" id="hiveRegime"><div class="regime-name">SCANNING</div><div class="regime-strat">—</div></div>'+
    '<div class="rune-line">⟨ HIVE WORKERS ⟩</div>'+
    '<div class="hive-workers" id="hiveWorkers"></div>'+
    '<div class="rune-line">⟨ SOL OVERSEER ⟩</div>'+
    '<div class="sol-log" id="solLog"></div>'+
    '</div>';
  document.body.appendChild(w);
  w.addEventListener('mousedown',()=>{window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop});
}
buildHive();
const _openApp17=window.openApp;
window.openApp=function(id){_openApp17(id);if(id==='hive'){renderRegime();fetchHive();renderSol()}};
setInterval(()=>{const w=$('win-hive');if(w&&w.classList.contains('open'))fetchHive()},10000);
log('v5.5 Hive Bridge — strategist regime engine, SOL overseer, hive monitor ported from syndicate-core','ok');
})();
