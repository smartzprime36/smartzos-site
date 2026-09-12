/* SmartzOS v5.16 — Journey layer
   One spine, beginner → master: the home screen now knows who you are.
   - Reads The Path (12 steps) as the single source of progression truth
   - Maps progress → 5 trader stages (Initiate → Apprentice → Trader → Coherent → Architect)
   - Powers the home "Next Step" widget with stage, progress, mentor voice
   - Re-orders home folders to match your stage (Learn first when new, Trade first when seasoned)
   - Coach strip: one rotating contextual line that always points at the next action */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- STAGE MODEL ---------- */
const STAGES=[
 {min:0, glyph:'🌱',name:'Initiate',  sub:'Getting armed — identity, first steps, first token',
  folders:['Learn','Community','System','Build & Earn','Portfolio','Intelligence','Trade'],
  coach:[
   {t:'Welcome to the Syndicate. The Path is your curriculum — 12 steps from first click to Architect.',act:"openApp('path')"},
   {t:'The Liquidity Tunnel is a 5-minute game that teaches swaps by doing. Zero risk.',act:"openApp('game')"},
   {t:'Lost? ZO Buddy answers questions and can open any app for you.',act:"openApp('buddy')"}]},
 {min:3, glyph:'📚',name:'Apprentice',sub:'Learning to trade — paper first, plans written down',
  folders:['Learn','Trade','Portfolio','Community','Intelligence','Build & Earn','System'],
  coach:[
   {t:'Paper Trading gives you 100 practice SOL at live prices. Feel a win and a loss with zero risk.',act:"openApp('paper')"},
   {t:'A plan written down beats a plan remembered — arm your first trigger or DCA.',act:"openApp('trig')"},
   {t:'The Academy tracks lessons and pays XP for each one you finish.',act:"openApp('academy')"}]},
 {min:6, glyph:'⚔️',name:'Trader',    sub:'Real positions — staking, liquidity, the forge',
  folders:['Trade','Portfolio','Intelligence','Learn','Build & Earn','Community','System'],
  coach:[
   {t:'Staking SMRT earns while you learn — and 10k+ makes you Sentinel.',act:"openApp('stake')"},
   {t:'Orca LPs earn swap fees and deepen the triad. Small size, full range, first time.',act:"openApp('orca')"},
   {t:'Arm a price alert in the Signal Center 🔔 — let the mesh tap you when price moves.',act:"document.getElementById('sigBell')&&sigBell.click()"}]},
 {min:9, glyph:'🔺',name:'Coherent',  sub:'System thinker — the triad recognizes its own',
  folders:['Intelligence','Trade','Build & Earn','Portfolio','Community','Learn','System'],
  coach:[
   {t:'The Hive reads regime shifts across the mesh — check it before sizing positions.',act:"openApp('hive')"},
   {t:'Bots multiply attention. The Sandbox has Whale Alerter and Auto-DCA templates ready.',act:"openApp('builder')"},
   {t:'Governance Hall is open to the coherent — treasury decisions need your voice.',act:"openApp('gov')"}]},
 {min:11,glyph:'👑',name:'Architect', sub:'Master of the mesh — earned by shipping, never bought',
  folders:['Build & Earn','Intelligence','Trade','Portfolio','Community','System','Learn'],
  coach:[
   {t:'Shipped beats perfect. Pass the mentor reviews and join the Gallery.',act:"openApp('gallery')"},
   {t:'Mentor the next wave in Mesh Chat — teaching is the final lesson.',act:"openApp('chat')"},
   {t:'The system ascends because you built it. What ships next?',act:"openApp('builder')"}]},
];
function stageIdx(){
  let n=0;try{n=window.PATH?PATH.progress():0}catch(e){}
  let idx=0;STAGES.forEach((s,i)=>{if(n>=s.min)idx=i});
  return idx;
}

/* ---------- 1. POWER THE "NEXT STEP" HOME WIDGET ---------- */
function paintJourney(){
  const body=$('ohPathBody');if(!body)return;
  const card=body.closest('.ohw');const ttl=card&&card.querySelector('.ohw-t');
  if(ttl)ttl.textContent='🧭 Your Journey';
  let n=0,next=null;
  try{n=window.PATH?PATH.progress():0;next=window.PATH?PATH.nextStep():null}catch(e){}
  const st=STAGES[stageIdx()];
  const total=window.STEPS?STEPS.length:12;
  if(!next){
    body.innerHTML='<div class="jny-stage"><div class="jny-glyph">👑</div><div><div class="jny-name">Architect</div>'+
      '<div class="jny-sub">Path complete — '+total+'/'+total+'</div></div></div>'+
      '<div class="jny-bar"><div class="jny-fill" style="width:100%"></div></div>'+
      '<div class="jny-done">You walked the whole road. Now teach it — mentor in Mesh Chat, ship, govern.</div>'+
      v8HTML();
    return;
  }
  body.innerHTML=
   '<div class="jny-stage"><div class="jny-glyph">'+st.glyph+'</div>'+
    '<div><div class="jny-name">'+st.name+'</div><div class="jny-sub">'+esc(st.sub)+'</div></div>'+
    '<div class="jny-count">'+n+'/'+total+'</div></div>'+
   '<div class="jny-bar"><div class="jny-fill" style="width:'+Math.round(n/total*100)+'%"></div></div>'+
   '<div class="jny-next" id="jnyGo"><span class="jn-ic">'+next.icon+'</span>'+
    '<span><div class="jn-t">'+esc(next.t)+' <span style="color:#ffb347;font-size:9.5px">+'+next.kp+' KP</span></div>'+
    '<div class="jn-d">'+esc(next.d)+'</div></span>'+
    '<span class="jn-go">GO →</span></div>'+
   '<div class="jny-mentor">'+esc(next.mentor||'')+'</div>'+v8HTML();
  const go=$('jnyGo');
  if(go)go.onclick=()=>{try{eval(next.act)}catch(e){try{openApp('path')}catch(e2){}}};
}

/* ---------- 2. STAGE-ADAPTIVE FOLDER ORDER ---------- */
function rankFolders(){
  const wrap=document.querySelector('#osHome .oh-folders');if(!wrap)return;
  const order=STAGES[stageIdx()].folders;
  const tiles=[...wrap.children];
  let changed=false;
  order.forEach(cat=>{
    const t=tiles.find(x=>{const l=x.querySelector('.fold-name');return l&&l.textContent.trim()===cat});
    if(t&&wrap.firstElementChild!==t){wrap.insertBefore(t,wrap.firstChild);changed=true}
  });
  if(changed)log('Journey: folders re-ranked for stage '+STAGES[stageIdx()].name,'ok');
}

/* ---------- 3. COACH STRIP ---------- */
let coachI=0;
function buildCoach(){
  const home=$('osHome');if(!home||$('coachStrip'))return;
  const widgets=home.querySelector('.oh-widgets');
  const bar=document.createElement('div');bar.id='coachStrip';
  if(widgets&&widgets.nextSibling)home.insertBefore(bar,widgets.nextSibling);
  else home.appendChild(bar);
  paintCoach();
}
function paintCoach(){
  const bar=$('coachStrip');if(!bar)return;
  const st=STAGES[stageIdx()];
  const c=st.coach[coachI%st.coach.length];coachI++;
  bar.innerHTML='<span class="c-ava">'+st.glyph+'</span><span>'+esc(c.t)+'</span><span class="c-arrow">→</span>';
  bar.onclick=()=>{try{eval(c.act)}catch(e){}};
}

/* ---------- 4. V8 TEST FLIGHT QUEST (Initiate track) ----------
   Rewards members for field-testing the new v8 systems. Steps are read
   defensively from localStorage flags set by other modules:
     sz_v8test_cmd  — ran /price or /rank in the ZO buddy (set by os-buddy.js)
     sz_v8test_feed — viewed the live TG / mesh feed (manual MARK DONE fallback)
     sz_v8test_pack — opened the v8 update panel (auto via .v8-panel / banner, MARK DONE fallback)
   Completion: +75 KP — written to the mesh (kp_ledger) when a wallet is
   connected; falls back to the local KP award with a "mesh sync pending"
   note if the write is blocked. Idempotent via local flag + server key. */
const V8_KP=75;
const V8_CLAIM_KEY='sz_v8test_claimed';
const V8_PEND_KEY='sz_v8test_pending';
const SB_URL='https://dezhsrzymylqpzdtymij.supabase.co';
const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlemhzcnp5bXlscXB6ZHR5bWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjkwMTIsImV4cCI6MjA4OTQ0NTAxMn0.N3PvKyT-SGBaxw95VAllLGuKHGcxXctnzDJ-5469yvs';
function v8flag(k){try{return!!localStorage.getItem(k)}catch(e){return false}}
function v8set(k){try{localStorage.setItem(k,'1')}catch(e){}}
function v8Wallet(){return window.walletKey||(window.SMARTZ_STATE&&SMARTZ_STATE.wallet)||null}
function v8steps(){
  return [
   {id:'cmd', icon:'🤖',t:'Run /price or /rank in the ZO buddy', manual:false, done:v8flag('sz_v8test_cmd')},
   {id:'feed',icon:'📡',t:'View the live TG / mesh feed',       manual:true,  done:v8flag('sz_v8test_feed')},
   {id:'pack',icon:'🧩',t:'Open the v8 update panel',           manual:true,  done:v8flag('sz_v8test_pack')||!!document.querySelector('.v8-panel')},
  ];
}
/* defensive auto-hook: interacting with the v8 panel / update banner counts */
document.addEventListener('click',e=>{
  try{
    const t=e.target&&e.target.closest?e.target.closest('.v8-panel, #v8Banner, .v8-banner, [data-v8pack]'):null;
    if(t){v8set('sz_v8test_pack');v8MaybeAward()}
  }catch(_){}
},true);
window.v8MarkDone=function(id){v8set('sz_v8test_'+id);paintJourney();v8MaybeAward()};
function v8HTML(){
  const steps=v8steps(),n=steps.filter(s=>s.done).length,doneAll=n===steps.length,claimed=v8flag(V8_CLAIM_KEY);
  let h='<div class="v8q">'+
    '<div class="v8q-head"><span class="v8q-badge">🧪 v8 TEST FLIGHT</span><span class="v8q-kp">+'+V8_KP+' KP</span></div>'+
    '<div class="v8q-desc">Field-test the new systems: run the ZO bot, check the live mesh, open the update panel.</div>';
  steps.forEach(s=>{
    h+='<div class="v8q-step'+(s.done?' done':'')+'"><span class="v8q-ic">'+s.icon+'</span>'+
       '<span class="v8q-t">'+esc(s.t)+'</span>'+
       (s.done?'<span class="v8q-chk">✓</span>'
        :(s.manual?'<span class="v8q-mark" onclick="v8MarkDone(\''+s.id+'\');event.stopPropagation()">MARK DONE</span>'
        :'<span class="v8q-pend">PENDING</span>'))+
       '</div>';
  });
  h+='<div class="v8q-foot"><div class="v8q-bar"><div class="v8q-fill" style="width:'+Math.round(n/steps.length*100)+'%"></div></div>';
  if(claimed){
    h+='<div class="v8q-state ok">✓ FLIGHT LOGGED — +'+V8_KP+' KP EARNED</div>';
    if(v8flag(V8_PEND_KEY))h+='<div class="v8q-note">mesh sync pending — KP held locally, will post when the mesh accepts the wallet</div>';
  }else if(doneAll){
    h+='<div class="v8q-state go">SYNCHRONIZING REWARD…</div>';
  }else{
    h+='<div class="v8q-state">'+n+'/'+steps.length+' SYSTEMS TESTED</div>';
  }
  h+='</div></div>';
  return h;
}
async function v8MeshPost(wallet){
  const H={apikey:SB_ANON,'Authorization':'Bearer '+SB_ANON,'Content-Type':'application/json'};
  let prev=0;
  try{
    const r=await fetch(SB_URL+'/rest/v1/kp_ledger?wallet=eq.'+encodeURIComponent(wallet)+'&select=kp_total&order=created_at.desc&limit=1',{headers:H});
    if(r.ok){const a=await r.json();if(a&&a.length&&a[0].kp_total!=null)prev=+a[0].kp_total||0}
  }catch(e){}
  const res=await fetch(SB_URL+'/rest/v1/kp_ledger',{method:'POST',
    headers:Object.assign({},H,{Prefer:'return=minimal'}),
    body:JSON.stringify({wallet:wallet,event:'v8_test_flight',kp_delta:V8_KP,kp_total:prev+V8_KP,
      memo:'v8 test flight completed',idempotency_key:wallet+'_v8tf'})});
  if(res.status===409)return 'dup';            // already claimed on the mesh
  if(!res.ok)throw new Error('mesh http '+res.status);
  return 'ok';
}
let v8Busy=false;
async function v8MaybeAward(){
  if(v8Busy||v8flag(V8_CLAIM_KEY))return;
  if(!v8steps().every(s=>s.done))return;
  v8Busy=true;
  const wallet=v8Wallet();
  let mesh='skip';
  if(wallet){try{mesh=await v8MeshPost(wallet)}catch(e){mesh='fail'}}
  v8set(V8_CLAIM_KEY);
  if(mesh==='dup'){
    log('v8 Test Flight: already claimed on mesh — no double award','info');
  }else{
    if(mesh!=='ok')v8set(V8_PEND_KEY);
    try{if(typeof awardKP==='function')awardKP(V8_KP,'v8 TEST FLIGHT — new systems field-tested')}catch(e){}
    if(mesh==='ok')log('v8 Test Flight: +75 KP written to mesh ('+String(wallet).slice(0,8)+'…)','ok');
    else if(wallet)log('v8 Test Flight: mesh write blocked — local KP awarded, sync pending','warn');
  }
  v8Busy=false;
  paintJourney();
}

/* ---------- BOOT ---------- */
let lastStage=-1;
function tick(){
  paintJourney();
  v8MaybeAward();
  const s=stageIdx();
  if(s!==lastStage){lastStage=s;rankFolders();paintCoach()}
}
function boot(){
  let tries=0;const iv=setInterval(()=>{
    buildCoach();tick();
    if(($('jnyGo')||$('coachStrip'))&&++tries>3)clearInterval(iv);
    if(++tries>25)clearInterval(iv);
  },1000);
  setInterval(tick,15000);          // stage can advance while the OS is open
  setInterval(paintCoach,45000);    // rotate coach lines
  log('v5.16 Journey — stage-aware home: '+STAGES[stageIdx()].name+' online','ok');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1200));
else setTimeout(boot,1200);
})();
