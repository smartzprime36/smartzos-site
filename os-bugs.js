/* SmartzOS v5.20 — Bug Bounty: members hunt issues, earn credits, founder moderates
   Auto-captures JS errors so reports arrive with evidence attached. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb=null;

/* ---------- 1. ERROR NET: capture runtime errors for evidence ---------- */
const ERRLOG=[];
window.addEventListener('error',e=>{
  try{ERRLOG.unshift((e.message||'?')+' @ '+String(e.filename||'').split('/').pop()+':'+(e.lineno||''));
    if(ERRLOG.length>8)ERRLOG.pop()}catch(_){}
});
window.addEventListener('unhandledrejection',e=>{
  try{ERRLOG.unshift('promise: '+String(e.reason||'').slice(0,140));if(ERRLOG.length>8)ERRLOG.pop()}catch(_){}
});

function cfg(){try{return window.SMARTZ_SITE_CONFIG&&SMARTZ_SITE_CONFIG.supabase?SMARTZ_SITE_CONFIG.supabase:null}catch(e){return null}}
function myName(){
  try{if(window.walletKey){const r=window.computeRank?computeRank():'';
    return (r&&r!=='Unverified'?r.split('-')[0].toUpperCase()+'·':'')+walletKey.slice(0,4)+'…'+walletKey.slice(-4)}}catch(e){}
  let n=localStorage.getItem('smartz_chat_name');
  if(!n){n='VOYAGER·'+Math.random().toString(36).slice(2,6).toUpperCase();localStorage.setItem('smartz_chat_name',n)}
  return n;
}
async function client(){
  if(sb)return sb;
  if(!(window.supabase&&window.supabase.createClient)){
    await new Promise(res=>{const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload=res;s.onerror=res;document.head.appendChild(s)});
  }
  const c=cfg();if(!c||!window.supabase)return null;
  sb=window.supabase.createClient(c.url,c.anonKey);return sb;
}
async function act(body){
  const s=await client();if(!s)return{ok:false,error:'offline'};
  try{const {data,error}=await s.functions.invoke('arena',{body});return error?{ok:false,error:error.message}:data}
  catch(e){return{ok:false,error:String(e)}}
}

/* ---------- 2. WINDOW: report form + live tracker ---------- */
const APPS=['general','deck','swap','paper','chat','arena','bridge','path','academy','hive','ge','wallet','launcher'];
function buildWin(){
  if($('win-bugs'))return;
  const w=document.createElement('div');w.classList.add('win');w.id='win-bugs';
  window.zTop=(window.zTop||100)+1;
  w.style.cssText='top:65px;left:130px;width:540px;height:580px;z-index:'+window.zTop;
  w.innerHTML='<div class="win-title"><span>🐞 Bug Bounty — hunt issues, earn credits</span>'+
    '<span><button class="tbtn" onclick="maxWin(\'win-bugs\')">□</button><button class="tbtn" onclick="closeApp(\'bugs\')">✕</button></span></div>'+
    '<div class="win-body ar-body">'+
    '<div class="ar-card"><h6>🎯 REPORT AN ISSUE — accepted reports earn 25–200 credits</h6>'+
     '<div class="ar-row" style="margin-bottom:7px"><select id="bugApp">'+APPS.map(a=>'<option>'+a+'</option>').join('')+'</select>'+
     '<select id="bugSev"><option value="low">🟢 low</option><option value="normal" selected>🟡 normal</option>'+
     '<option value="high">🟠 high</option><option value="critical">🔴 critical</option></select></div>'+
     '<div class="ar-row" style="margin-bottom:7px"><input id="bugTitle" maxlength="80" placeholder="What broke? (one line)" style="flex:1;min-width:200px"></div>'+
     '<div class="ar-row"><input id="bugDetail" maxlength="800" placeholder="Steps to reproduce — what did you tap, what happened?" style="flex:1;min-width:200px"></div>'+
     '<div class="ar-row" style="margin-top:8px"><button class="ar-btn" id="bugSend">Submit Report 🐞</button>'+
     '<span style="font-size:9.5px;color:#6d7688">Recent JS errors attach automatically as evidence</span></div></div>'+
    '<div class="ar-card"><h6>📋 LIVE TRACKER — every report, every status, transparent</h6><div id="bugList"></div></div>'+
    '</div>';
  document.body.appendChild(w);
  w.addEventListener('mousedown',()=>{window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop});
  $('bugSend').onclick=submit;
}
const SEV_G={low:'🟢',normal:'🟡',high:'🟠',critical:'🔴'};
const ST_C={open:'#ffb347',accepted:'#4fc9ff',resolved:'#2ee6a8',rejected:'#e86a5f'};
async function paintList(){
  const el=$('bugList');if(!el)return;
  const s=await client();if(!s){el.innerHTML='<div class="ar-empty">Mesh offline.</div>';return}
  const {data}=await s.from('bug_reports').select('*').order('created_at',{ascending:false}).limit(25);
  const list=data||[],mine=myName();
  if(!list.length){el.innerHTML='<div class="ar-empty">No reports yet — first bug hunter gets the glory.</div>';return}
  el.innerHTML=list.map(b=>{
    const claimable=b.reporter===mine&&(b.status==='accepted'||b.status==='resolved')&&!b.reward_claimed&&b.reward>0;
    return'<div class="ar-duel"><span>'+ (SEV_G[b.severity]||'🟡')+'</span><span>#'+b.id+' '+esc(b.title)+
     '<div style="font-size:9px;color:#6d7688">'+esc(b.reporter)+' · '+esc(b.app)+'</div></span>'+
     '<span class="st" style="color:'+(ST_C[b.status]||'#888')+'">'+b.status.toUpperCase()+(b.reward?' · '+b.reward+'cr':'')+'</span>'+
     (claimable?'<button class="ar-btn" data-claim="'+b.id+'">Claim '+b.reward+' cr</button>':'')+'</div>';
  }).join('');
  el.querySelectorAll('[data-claim]').forEach(btn=>btn.onclick=async()=>{
    const r=await act({action:'bug_claim',id:+btn.dataset.claim,name:mine});
    if(r.ok){try{G.credits+=r.reward;saveGame()}catch(e){}
      window.notify&&notify('🐞 Bounty claimed','+'+r.reward+' credits — thank you for hunting.','ok');paintList()}
    else window.notify&&notify('Claim failed',r.error||'?','warn');
  });
}
async function submit(){
  const title=$('bugTitle').value.trim(),detail=$('bugDetail').value.trim();
  if(title.length<4){window.notify&&notify('Bug Bounty','Give the bug a one-line title.','warn');return}
  const r=await act({action:'bug_report',name:myName(),title,detail,
    app:$('bugApp').value,severity:$('bugSev').value,
    auto_log:ERRLOG.slice(0,5).join(' | ')+' | v'+(window.SMARTZ_VERSION||'?')});
  if(r.ok){
    $('bugTitle').value='';$('bugDetail').value='';
    window.notify&&notify('🐞 Report #'+r.id+' filed','It\'s on the tracker and in the Telegram group. Accepted = credits.','ok');
    paintList();
  }else if(r.error==='too_many_open'){
    window.notify&&notify('Bug Bounty','You have 5 open reports — wait for review before filing more.','warn');
  }else window.notify&&notify('Bug Bounty','Report failed — '+(r.error||'?'),'err');
}

/* ---------- 3. TASKBAR BUTTON + NAV ---------- */
function addTaskbarBtn(){
  const right=document.querySelector('#taskbar .tb-right');if(!right||$('bugBtn'))return;
  const b=document.createElement('button');b.className='tb-home';b.id='bugBtn';b.title='Bug Bounty — report an issue, earn credits';
  b.textContent='🐞';b.onclick=()=>openApp('bugs');
  right.insertBefore(b,right.firstChild);
}
const _openApp=window.openApp;
window.openApp=function(id){_openApp(id);
  if(id==='bugs'){buildWin();const w=$('win-bugs');w&&w.classList.add('open');paintList()}};
let tries=0;const iv=setInterval(()=>{addTaskbarBtn();if($('bugBtn')||++tries>20)clearInterval(iv)},900);
setInterval(()=>{const w=$('win-bugs');if(w&&w.classList.contains('open'))paintList()},25000);
log('v5.20 Bug Bounty — community QA with credit rewards, error net active','ok');
})();
