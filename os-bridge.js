/* SmartzOS v5.17 — Telegram Bridge: chat with t.me/Smrtquickflips from inside the OS
   Flow: OS → edge fn (bot token server-side) → Telegram group → edge fn sync → tg_messages → realtime → OS */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seen=new Set();
let sbClient=null,rtChan=null,configured=true,lastSync=0;

function cfg(){try{return window.SMARTZ_SITE_CONFIG&&SMARTZ_SITE_CONFIG.supabase?SMARTZ_SITE_CONFIG.supabase:null}catch(e){return null}}
function myName(){
  try{
    if(window.walletKey){
      const r=window.computeRank?computeRank():'';
      return (r&&r!=='Unverified'?r.split('-')[0].toUpperCase()+'·':'')+walletKey.slice(0,4)+'…'+walletKey.slice(-4);
    }
  }catch(e){}
  let n=localStorage.getItem('smartz_chat_name');
  if(!n){n='VOYAGER·'+Math.random().toString(36).slice(2,6).toUpperCase();localStorage.setItem('smartz_chat_name',n)}
  return n;
}
function sigil(u){
  if(/KODA|SMRT/i.test(u))return'🐻';if(/TAURON|SMF/i.test(u))return'🐂';if(/ZORAN|SMC|SYSTEM/i.test(u))return'🔥';
  const icons={SENTINEL:'🐻',BLADEBEARER:'🐂',COHERENT:'🔺',ARCHITECT:'👑',VOYAGER:'🛰️'};
  for(const k in icons)if(u.indexOf(k)===0)return icons[k];
  return'✈️';
}

/* ---------- window ---------- */
function buildWin(){
  if($('win-tg'))return;
  const w=document.createElement('div');w.className='win';w.id='win-tg';
  window.zTop=(window.zTop||100)+1;
  w.style.cssText='top:60px;left:120px;width:520px;height:560px;z-index:'+window.zTop;
  w.innerHTML='<div class="win-title"><span>✈️ Telegram Bridge <span class="sys-badge on" style="margin-left:8px">t.me/Smrtquickflips</span></span>'+
    '<span><button class="tbtn" onclick="maxWin(\'win-tg\')">□</button><button class="tbtn" onclick="closeApp(\'tg\')">✕</button></span></div>'+
    '<div class="win-body tg-body">'+
    '<div class="tg-status" id="tgStatus">Connecting to the bridge…</div>'+
    '<div class="chat-log tg-log" id="tgLog"></div>'+
    '<div class="tg-composer"><input id="tgInput" maxlength="500" placeholder="Message the group as '+esc(myName())+'…">'+
    '<button class="btn" id="tgSend" style="font-size:11px">Send ✈️</button></div>'+
    '<div class="tg-foot"><a href="https://t.me/Smrtquickflips" target="_blank" rel="noopener" style="color:#4fc9ff;font-size:10px">Open in Telegram ↗</a>'+
    '<span id="tgHint" style="font-size:9.5px;color:#6d7688"></span></div></div>';
  document.body.appendChild(w);
  w.addEventListener('mousedown',()=>{window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop});
  $('tgSend').onclick=send;
  $('tgInput').addEventListener('keydown',e=>{if(e.key==='Enter')send()});
}

/* ---------- data ---------- */
function addMsg(m){
  const logEl=$('tgLog');if(!logEl)return;
  if(seen.has(m.tg_message_id))return;seen.add(m.tg_message_id);
  const mine=m.from_name===myName();
  const d=document.createElement('div');d.className='chat-msg tg-msg'+(mine?' me':'');
  const t=new Date(m.created_at),ts=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
  d.innerHTML='<div class="ava">'+sigil(m.from_name)+'</div><div class="cbub"><div class="cwho">'+esc(m.from_name)+
    '<span class="ctime">'+ts+'</span></div><div class="ctext">'+esc(m.text)+'</div></div>';
  logEl.appendChild(d);logEl.scrollTop=logEl.scrollHeight;
}
async function ensureClient(){
  if(sbClient)return sbClient;
  if(!(window.supabase&&window.supabase.createClient)){
    await new Promise(res=>{const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload=res;s.onerror=res;document.head.appendChild(s)});
  }
  const c=cfg();if(!c||!window.supabase)return null;
  sbClient=window.supabase.createClient(c.url,c.anonKey);
  return sbClient;
}
async function fetchRecent(){
  const sb=await ensureClient();if(!sb)return;
  const {data}=await sb.from('tg_messages').select('*').order('created_at',{ascending:false}).limit(60);
  (data||[]).reverse().forEach(addMsg);
}
async function syncNow(force){
  if(Date.now()-lastSync<15000&&!force)return;
  lastSync=Date.now();
  const sb=await ensureClient();if(!sb)return;
  try{
    const {data,error}=await sb.functions.invoke('tg-bridge',{body:{action:'sync'}});
    if(data&&data.configured===false){configured=false;paintStatus()}
    else if(!error){configured=true;paintStatus();fetchRecent()}
  }catch(e){}
}
function startRealtime(){
  ensureClient().then(sb=>{
    if(!sb||rtChan)return;
    rtChan=sb.channel('tg-bridge-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'tg_messages'},p=>{if(p&&p.new)addMsg(p.new)})
      .subscribe();
  });
}
async function send(){
  const inp=$('tgInput');if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  inp.value='';
  const sb=await ensureClient();if(!sb){paintStatus('Bridge offline — Supabase config missing');return}
  const {data,error}=await sb.functions.invoke('tg-bridge',{body:{action:'send',name:myName(),text}});
  if(error||(data&&data.ok===false)){
    paintStatus((data&&data.configured===false)?'Bridge not configured yet — founder must add the bot token':'Send failed — try again');
  }else{
    paintStatus();setTimeout(fetchRecent,1500);
    try{window.feed&&feed('✈️ You spoke to the Telegram group','b')}catch(e){}
  }
}
function paintStatus(msg){
  const el=$('tgStatus');if(!el)return;
  if(msg){el.textContent=msg;el.className='tg-status warn';return}
  el.className='tg-status '+(configured?'ok':'warn');
  el.textContent=configured
    ?'● Bridge live — messages sync both ways every 20s (realtime push when open)'
    :'⚠ Bridge deployed but not configured — founder: add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID secrets, then add the bot to the group';
  const h=$('tgHint');if(h)h.textContent=configured?'':'Setup guide in Settings';
}

/* ---------- SYNDICATE BROADCASTER: OS events → Telegram group ----------
   Keeps the group alive with real mesh activity. Whitelisted, rate-limited,
   one broadcast per event type per 5 minutes, silent on failure. */
const BCAST_LIMIT=5*60*1000; const bcastLast={};
const BCAST={
  'ge.offer':  d=>'🏦 New Grand Exchange offer — '+(d.side||'')+' '+(d.qty||'')+' '+(d.item||'')+' @ '+(d.price||'?'),
  'ge.fill':   d=>'🤝 GE order filled — '+(d.item||d.sym||'')+' '+(d.qty||''),
  'forge':     d=>'🔥 Phoenix Sigil forged on-chain — '+(d.out||'sigil')+' minted',
  'build.ship':d=>'🏛️ Build shipped to the Gallery — "'+(d.name||'untitled')+'" passed mentor review',
  'build.deploy':d=>'🛠️ New bot deployed — "'+(d.name||'bot')+'" is running on the mesh',
  'regime.shift':d=>'🧠 Hive regime shift — '+(d.regime||'new regime')+(d.strategy?' → '+d.strategy:''),
  'whale.move':d=>d.raw?('🐋 '+d.raw):('🐋 Whale movement detected'+(d.sym?' in '+d.sym:'')+(d.usd?' (~$'+d.usd+')':'')),
};
function broadcast(ev,data){
  const fmt=BCAST[ev];if(!fmt)return;
  const now=Date.now();
  if(now-(bcastLast[ev]||0)<BCAST_LIMIT)return;
  bcastLast[ev]=now;
  ensureClient().then(sb=>{
    if(!sb)return;
    let msg;try{msg=fmt(data||{})}catch(e){msg='⚡ '+ev}
    sb.functions.invoke('tg-bridge',{body:{action:'send',name:'MESH·📡',text:msg.slice(0,300)}})
      .then(()=>{try{window.feed&&feed('📡 Broadcast to Telegram: '+msg.slice(0,60),'b')}catch(e){}})
      .catch(()=>{});
  }).catch(()=>{});
}
/* rank-ups: watch SMARTZ_STATE.rank transitions */
let lastRank=null;
setInterval(()=>{
  try{
    const r=window.SMARTZ_STATE&&SMARTZ_STATE.rank;
    if(lastRank&&r&&r!==lastRank&&r!=='Unverified')
      broadcast('rank.up',{rank:r});
    lastRank=r||lastRank;
  }catch(e){}
},15000);
BCAST['rank.up']=d=>'🎖 Rank up in the Syndicate — a member just reached '+(d.rank||'a new rank');
function hookBusBroadcast(){
  try{if(!window.SMARTZ_BUS||!SMARTZ_BUS.on)return;
    SMARTZ_BUS.on('*',(ev,data)=>{if(BCAST[ev])broadcast(ev,data)});
  }catch(e){}
}
hookBusBroadcast();

/* ---------- MESH → TELEGRAM relay: #global chat appears in the group ---------- */
const relayLast={};
function hookChatRelay(){
  ensureClient().then(sb=>{
    if(!sb)return;
    sb.channel('mesh-to-tg-relay')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},p=>{
        const m=p&&p.new;if(!m)return;
        if(m.tg_message_id)return;                 // came FROM telegram — don't echo back
        if(/^✈️/.test(m.username||''))return;      // relayed origin marker
        if(m.channel!=='global')return;            // global only — trade/builders stay in-house
        const u=m.username||'anon',now=Date.now();
        if(now-(relayLast[u]||0)<60000)return;     // 1 relay/min/user anti-spam
        relayLast[u]=now;
        sb.functions.invoke('tg-bridge',{body:{action:'send',name:'💠 '+u,text:String(m.message||'').slice(0,400)}}).catch(()=>{});
      }).subscribe();
  }).catch(()=>{});
}
hookChatRelay();

/* ---------- WHALE WATCH → group (direct, not just bus) ---------- */
function hookWhaleNotify(){
  if(typeof window.notify!=='function'||window.notify._whaleHook)return;
  const old=window.notify;
  const wrapped=function(title,body,type){
    try{if(/🐋|whale/i.test(String(title)))broadcast('whale.move',{sym:'',usd:'',raw:String(body).slice(0,120)})}catch(e){}
    return old.apply(this,arguments);
  };
  wrapped._whaleHook=true;if(old._sig)wrapped._sig=true;
  window.notify=wrapped;
}
hookWhaleNotify();

/* ---------- wire ---------- */
const _openApp=window.openApp;
window.openApp=function(id){_openApp(id);
  if(id==='tg'){buildWin();const w=$('win-tg');w&&w.classList.add('open');
    fetchRecent();syncNow(true);startRealtime();paintStatus()}};
setInterval(()=>{const w=$('win-tg');if(w&&w.classList.contains('open'))syncNow()},20000);
/* any open client keeps the group↔OS pipe warm, window open or not */
setInterval(()=>syncNow(),45000);
log('v5.17 Telegram Bridge — t.me/Smrtquickflips wired into the OS','ok');
})();
