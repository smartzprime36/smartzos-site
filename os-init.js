/* ============ SmartzOS v4.4 — Initiation Protocol ============ */
/* Kill Points · Koda Staking Vault · Tauron Overclock · Triad Resonance state ·
   Whale flash-missions · Streaks · Action-driven onboarding */

/* ================= KILL POINTS ================= */
const INITKEY='smartz_init_v1';
let INIT=loadInit();
function loadInit(){try{const s=JSON.parse(localStorage.getItem(INITKEY));if(s)return s;}catch(e){}
  return {kp:0,streak:0,lastLogin:null,staked:0,stakeSince:0,overclock:false,flash:null,flashDone:0};}
function saveInit(){localStorage.setItem(INITKEY,JSON.stringify(INIT));}
function awardKP(n,why){
  INIT.kp+=n;saveInit();updateHUD2();
  notify('☠ +'+n+' Kill Points',why,'ok');
  log('☠ +'+n+' KP — '+why,'warn');
  if(typeof SMARTZ_BUS!=='undefined')SMARTZ_BUS.emit('kp',{n:n,why:why});
}
/* daily streak */
(function(){
  const today=new Date().toDateString();
  if(INIT.lastLogin!==today){
    const y=new Date(Date.now()-864e5).toDateString();
    INIT.streak=(INIT.lastLogin===y)?INIT.streak+1:1;
    INIT.lastLogin=today;saveInit();
    if(INIT.streak>1){awardKP(INIT.streak*5,'Daily breach streak ×'+INIT.streak);}
  }
})();
/* KP sources — wire to bus */
if(typeof SMARTZ_BUS!=='undefined'){
  SMARTZ_BUS.on('tunnel.clear',()=>awardKP(50,'TUNNEL BREACHED'));
  SMARTZ_BUS.on('academy.lesson',d=>awardKP(15,'Gauntlet lesson survived'));
  SMARTZ_BUS.on('forge',d=>awardKP(d.out==='trinityCore'?200:40,'Forge execution: '+(ITEMS[d.out]?ITEMS[d.out].name:'artifact')));
  SMARTZ_BUS.on('tour.done',()=>awardKP(20,'Orientation tour cleared'));
  SMARTZ_BUS.on('trade',()=>awardKP(5,'Market execution'));
}
const _ptAutopsy=window.ptAutopsy;
window.ptAutopsy=function(sym,pnl,proceeds,cost){
  _ptAutopsy(sym,pnl,proceeds,cost);
  if(pnl>0)awardKP(25,'Winning paper trade — execution proven');
};

/* ================= HUD v2 (KP + streak) ================= */
const _updateHUD=window.updateHUD;
window.updateHUD=function(){
  _updateHUD();
  const el=document.getElementById('hud');if(!el)return;
  el.insertAdjacentHTML('beforeend','<span class="sep">|</span><span class="kp-chip">☠ <b>'+INIT.kp+'</b> KP</span>'+
    '<span class="streak-badge">🔥 '+INIT.streak+'d</span>');
};
function updateHUD2(){updateHUD();}

/* ================= TRIAD RESONANCE STATE ================= */
function checkResonance(){
  const b=SMARTZ_STATE.balances;
  const coherent=b.SMF>0&&b.SMRT>0&&b.SMC>0;
  const chip=document.getElementById('rankChip');
  if(coherent){
    chip.classList.add('verified');chip.textContent='◈ VERIFIED — COHERENT';
    document.querySelectorAll('.desk-icon .lbl').forEach(l=>{
      if(l.textContent==='Resonance')l.parentElement.classList.add('resonating');
    });
  }else{
    chip.classList.remove('verified');
    document.querySelectorAll('.desk-icon').forEach(d=>d.classList.remove('resonating'));
  }
  return coherent;
}
/* GE revenue share for Coherent — 1% of fill volume routed as credits */
if(typeof geTick==='function'){
  const _geTick=geTick;
  window.geTick=function(){
    const before=G.credits;
    _geTick();
    if(checkResonance()&&G.credits>before){
      const share=Math.max(1,Math.floor((G.credits-before)*0.05));
      G.credits+=share;MESH.stats.earned+=share;
    }
  };
}
setInterval(checkResonance,8000);

/* ================= KODA STAKING VAULT (SMRT) ================= */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-stake" style="top:80px;left:200px;width:540px;height:560px">
  <div class="titlebar"><span>🛡</span><span class="ttl">Koda Staking Vault — SMRT</span>
    <button class="tbtn" onclick="maxWin('win-stake')">□</button><button class="tbtn" onclick="closeApp('stake')">✕</button></div>
  <div class="win-body">
    <div class="stake-box">
      <h4>🛡 THE SHIELD PROTOCOL — take post</h4>
      <p style="font-size:12px;color:var(--dim);line-height:1.7;margin:8px 0">
      Staking SMRT isn't locking tokens — it's <b style="color:#4fc9ff">taking post</b> on Koda's perimeter.
      Staked operators earn <b>2% of stake per tick</b> (in credits), governance weight, and Sentinel standing.
      <br><br>⚖ <b>7-Day Rule enforced:</b> withdrawing within 7 ticks of staking forfeits 25% of yield. Depth over complexity. Conviction over haste.</p>
      <div style="display:flex;gap:10px;margin:10px 0">
        <div class="stat" style="flex:1"><div class="n" id="stk-amt">0</div><div class="l">SMRT Staked</div></div>
        <div class="stat" style="flex:1"><div class="n" id="stk-yield">0</div><div class="l">Yield Earned (cr)</div></div>
        <div class="stat" style="flex:1"><div class="n" id="stk-weight">—</div><div class="l">Gov Weight</div></div>
      </div>
      <div class="ge-in"><input id="stk-in" type="number" min="100" placeholder="SMRT amount (min 100)"></div>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;background:linear-gradient(135deg,#0e6f9e,#123a7a)" onclick="stakeSMRT()">🛡 TAKE POST (STAKE)</button>
        <button class="btn ghost" style="flex:1" onclick="unstakeSMRT()">WITHDRAW</button>
      </div>
      <div id="stk-status" style="font-size:11px;color:var(--dim);margin-top:8px"></div>
      <div style="font-size:10px;color:var(--dim);margin-top:8px">Holding real SMRT on-chain boosts yield ×1.25 (synergy). Stake ledger is mesh-tracked; on-chain program vault routes in v4.5.</div>
    </div>
  </div>
</div>`);
(function(){
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">🛡</div><div class="lbl">Stake SMRT</div>';
  d.onclick=()=>openApp('stake');document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>🛡</span><span>Stake SMRT</span>';
  s.onclick=()=>{openApp('stake');document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
  const w=document.getElementById('win-stake');
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
function stakeSMRT(){
  const amt=parseInt(document.getElementById('stk-in').value);
  if(!amt||amt<100){notify('Koda Vault','Minimum post: 100 SMRT.','warn');return;}
  if(SMARTZ_STATE.balances.SMRT<amt){notify('Koda Vault','On-chain check: you hold '+SMARTZ_STATE.balances.SMRT+' SMRT. Arm the terminal first.','warn');quickBuy('SMRT');return;}
  INIT.staked+=amt;INIT.stakeSince=CITY.ticks||0;saveInit();
  awardKP(30,'Post taken — '+amt+' SMRT staked');
  log('🛡 '+amt+' SMRT staked in Koda Vault','ok');
  renderStake();
}
function unstakeSMRT(){
  if(INIT.staked<=0){notify('Koda Vault','No stake on record.','warn');return;}
  const age=(CITY.ticks||0)-INIT.stakeSince;
  if(age<7){
    const forfeit=Math.floor((INIT.stakeYield||0)*0.25);
    G.credits=Math.max(0,G.credits-forfeit);
    CITY.harmony=Math.max(20,CITY.harmony-10);
    notify('⚖ 7-DAY RULE','Early withdrawal at tick '+age+'/7 — 25% of yield forfeited (−'+forfeit+' cr), harmony −10. Koda remembers haste.','err');
  }
  awardKP(5,'Post relieved — '+INIT.staked+' SMRT withdrawn');
  INIT.staked=0;INIT.stakeYield=0;saveInit();saveGame();saveCity();renderStake();
}
/* staking yield tick */
setInterval(()=>{
  if(INIT.staked>0){
    const mult=(SMARTZ_STATE.balances.SMRT>0?1.25:1)*(window.LOOP?LOOP.mult():1);
    const y=Math.max(1,Math.floor(INIT.staked*0.02*mult));
    INIT.stakeYield=(INIT.stakeYield||0)+y;G.credits+=y;MESH.stats.earned+=y;
    saveInit();saveGame();
    if(document.getElementById('win-stake').classList.contains('open'))renderStake();
  }
},6000);
function renderStake(){
  document.getElementById('stk-amt').textContent=(INIT.staked||0).toLocaleString();
  document.getElementById('stk-yield').textContent=(INIT.stakeYield||0).toLocaleString();
  document.getElementById('stk-weight').textContent=INIT.staked>=10000?'SENTINEL':INIT.staked>0?'POSTED':'—';
  const age=(CITY.ticks||0)-INIT.stakeSince;
  document.getElementById('stk-status').textContent=INIT.staked>0?
    (age<7?'⏳ Cooldown: '+age+'/7 ticks served. Early withdrawal forfeits 25% yield.':'✓ Post seasoned — free withdrawal. Koda salutes.'):'No active post. The perimeter awaits.';
}

/* ================= TAURON OVERCLOCK (SMF burn → execution perks) ================= */
(function(){
  const body=document.querySelector('#win-trigger .win-body');if(!body)return;
  body.insertAdjacentHTML('beforeend',`
   <div class="oc-box" style="margin-top:12px">
    <h4>⚔ TAURON OVERCLOCK — burn for speed</h4>
    <p style="font-size:12px;color:var(--dim);line-height:1.6;margin:6px 0">
    Burn <b style="color:#e04fff">50 SMF</b> on-chain to overclock your execution layer: triggers poll <b>3× faster</b>, DCA executions earn +KP bonuses, and your swaps get priority framing in the mesh. The Sword does not accumulate — it cuts.</p>
    <div id="oc-status" style="margin-bottom:8px"></div>
    <button class="btn" style="background:linear-gradient(135deg,#8a1fb0,#5a0f8a)" onclick="overclockSMF()">⚔ BURN 50 SMF — OVERCLOCK</button>
   </div>`);
  renderOC();
})();
function renderOC(){
  const el=document.getElementById('oc-status');if(!el)return;
  el.innerHTML=INIT.overclock?'<span class="att-badge" style="border-color:rgba(224,79,255,.5);color:#e04fff;background:rgba(224,79,255,.1)">⚔ OVERCLOCKED — execution layer at 3× speed</span>'
    :'<span style="font-size:11px;color:var(--dim)">Status: standard speed.</span>';
}
async function overclockSMF(){
  if(INIT.overclock){notify('Overclock','Already overclocked. The Sword stays sharp.','ok');return;}
  if(!walletKey){notify('Overclock','Connect wallet first.','warn');connectWallet();return;}
  if(SMARTZ_STATE.balances.SMF<50){notify('Overclock','You need 50 SMF. Arm the terminal.','warn');quickBuy('SMF');return;}
  try{
    if(!window.solanaWeb3||!window.splToken)throw new Error('web3 libs not loaded');
    const smf=TOKENS.find(t=>t.sym==='SMF');
    const conn=new solanaWeb3.Connection(RPC,'confirmed');
    const owner=new solanaWeb3.PublicKey(walletKey);
    const mint=new solanaWeb3.PublicKey(smf.mint);
    const res=await rpcCall('getTokenAccountsByOwner',[walletKey,{mint:smf.mint},{encoding:'jsonParsed'}]);
    if(!res.value.length)throw new Error('No SMF token account found');
    res.value.sort((a,b)=>b.account.data.parsed.info.tokenAmount.uiAmount-a.account.data.parsed.info.tokenAmount.uiAmount);
    const acct=res.value[0],info=acct.account.data.parsed.info.tokenAmount;
    if(info.uiAmount<50)throw new Error('Insufficient SMF');
    const raw=BigInt(50)*BigInt(10)**BigInt(info.decimals);
    const ix=window.splToken.createBurnInstruction(new solanaWeb3.PublicKey(acct.pubkey),mint,owner,raw);
    const tx=new solanaWeb3.Transaction().add(ix);
    tx.feePayer=owner;tx.recentBlockhash=(await conn.getLatestBlockhash()).blockhash;
    notify('Overclock','Approve the SMF burn in your wallet…','warn');
    const signed=await wallet.signTransaction(tx);
    const sig=await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction(sig,'confirmed');
    INIT.overclock=true;saveInit();
    awardKP(75,'OVERCLOCK achieved — 50 SMF burned on-chain');
    log('⚔ OVERCLOCK: 50 SMF burned — '+sig.slice(0,16)+'…','ok');
    renderOC();loadBalances(); // refresh balances → rank/gates update
  }catch(e){notify('Overclock failed',String(e.message||e),'err');log('Overclock failed: '+(e.message||e),'err');}
}
/* overclock: faster trigger polling */
setInterval(()=>{if(INIT.overclock)checkTriggers();},5000);

/* ================= WHALE FLASH-MISSIONS ================= */
const _pushWhale=window.pushWhale;
window.pushWhale=function(icon,txt,level){
  _pushWhale(icon,txt,level);
  if(level==='high'||level==='med'){
    INIT.flash={task:'trade',expires:Date.now()+10*60*1000,bounty:100,desc:'Whale movement detected — execute any Exchange/Trading Post trade within 10 minutes to claim the bounty.'};
    saveInit();
    notify('⚡ FLASH MISSION','10-minute bounty window opened in Missions!','warn');
    log('⚡ Flash mission spawned from whale alert','warn');
    if(document.getElementById('win-missions').classList.contains('open'))renderMissions();
  }
};
/* flash mission UI in Missions */
const _renderMissions=window.renderMissions;
window.renderMissions=function(){
  _renderMissions();
  const el=document.getElementById('missionList');
  if(INIT.flash&&Date.now()<INIT.flash.expires){
    el.insertAdjacentHTML('afterbegin',
      '<div class="flash-mission"><div class="fm-t">⚡ FLASH MISSION — WHALE BOUNTY</div>'+
      '<div class="fm-d">'+INIT.flash.desc+'</div>'+
      '<div class="fm-timer" id="fm-timer"></div></div>');
  }else if(INIT.flash){INIT.flash=null;saveInit();}
};
setInterval(()=>{
  const t=document.getElementById('fm-timer');
  if(t&&INIT.flash){
    const left=Math.max(0,INIT.flash.expires-Date.now());
    t.textContent='⏱ '+Math.floor(left/60000)+':'+String(Math.floor(left%60000/1000)).padStart(2,'0')+' remaining · +'+INIT.flash.bounty+' cr + 50 KP';
    if(left<=0){INIT.flash=null;saveInit();renderMissions();}
  }
},1000);
/* claim via trade */
if(typeof SMARTZ_BUS!=='undefined'){
  SMARTZ_BUS.on('trade',()=>{
    if(INIT.flash&&Date.now()<INIT.flash.expires){
      G.credits+=INIT.flash.bounty;INIT.flashDone++;
      awardKP(50,'Flash bounty claimed — you moved with the whales');
      notify('⚡ BOUNTY CLAIMED','+'+INIT.flash.bounty+' credits. TAURON-3: "Velocity rewarded."','ok');
      INIT.flash=null;saveInit();saveGame();renderGame();
      if(document.getElementById('win-missions').classList.contains('open'))renderMissions();
    }
  });
}

/* ================= ONBOARDING REBRAND (cybernetic initiation) ================= */
(function(){
  const ob=document.querySelector('.ob-card');if(!ob)return;
  ob.querySelector('h3').innerHTML='◈ CYBERNETIC INITIATION — Smart Triad';
  ob.querySelector('div').innerHTML='Four breaches. Each one pays <b style="color:#ff5c6a">Kill Points</b> and unlocks a piece of the machine. No homework. Only execution.';
  const steps=ob.querySelectorAll('.ob-step');
  const data=[
    ['<b>BREACH the Liquidity Tunnel</b>','Simulate your first execution · +50 KP',''],
    ['<b>SYNC to the Synergy Mesh</b>','Bind your on-chain rank to the OS · +30 KP',''],
    ['<b>SURVIVE the Academy Gauntlet</b>','Rapid-fire alpha extraction · +15 KP/lesson',''],
    ['<b>IGNITE the Forge</b>','Cinematic launch rehearsal · +100 KP','']
  ];
  steps.forEach((s,i)=>{
    s.querySelector('div').innerHTML=data[i][0]+'<div style="color:var(--dim)">'+data[i][1]+'</div>';
    s.insertAdjacentHTML('beforeend','<span class="kp-r">'+['+50','+30','+15','+100'][i]+' KP</span>');
  });
})();
/* KP for onboarding actions */
const _onboardGo=window.onboardGo;
window.onboardGo=function(step){
  _onboardGo(step);
  awardKP({wallet:30,game:50,academy:15,'academy-forge':100}[step]||10,'Initiation step: '+step);
};

/* hooks */
const _openApp9=window.openApp;
window.openApp=function(id){_openApp9(id);
  if(id==='stake')renderStake();
  if(id==='trigger')renderOC();
};
renderStake();checkResonance();updateHUD();
log('v4.4 Initiation Protocol loaded — KP economy · staking · overclock · flash missions','info');
log('📡 Onboarding weaponized. Homework is dead. Only execution. — CONCOURSE','info');
