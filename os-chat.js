/* SmartzOS v5.4→v5.12 — Community mesh chat (chat_messages table + Supabase Realtime live push) */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const CHANNELS=[{id:'global',name:'🌐 Global'},{id:'trade',name:'📈 Trade Floor'},{id:'builders',name:'🛠️ Builders'},{id:'war-room',name:'⚔️ War Room'}];
let chan='global', lastId=0, poll=null;
const seen=new Set();

function sb(){try{const c=JSON.parse(localStorage.getItem('smartz_sb')||'null');return(c&&c.url&&c.key)?c:null}catch(e){return null}}
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
  return'💠';
}
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* --- v5.13: PRESENCE — online operatives panel (players table, 60s poll) --- */
const SB_FALLBACK={url:'https://dezhsrzymylqpzdtymij.supabase.co',key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlemhzcnp5bXlscXB6ZHR5bWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjkwMTIsImV4cCI6MjA4OTQ0NTAxMn0.N3PvKyT-SGBaxw95VAllLGuKHGcxXctnzDJ-5469yvs'};
let opsPoll=null;
function opsCfg(){const c=sb();return c||SB_FALLBACK}
function relTime(ts){
  const s=Math.max(0,(Date.now()-new Date(ts).getTime())/1000);
  if(s<60)return'1m';
  const m=Math.floor(s/60);if(m<60)return m+'m';
  const h=Math.floor(m/60);if(h<24)return h+'h';
  return Math.floor(h/24)+'d';
}
async function fetchOps(){
  const panel=$('chatOps');if(!panel)return;
  const c=opsCfg();
  try{
    const r=await fetch(c.url.replace(/\/$/,'')+'/rest/v1/players?select=username,level,last_seen&order=last_seen.desc&limit=12',{
      headers:{apikey:c.key,Authorization:'Bearer '+c.key}});
    if(!r.ok)throw new Error('http '+r.status);
    const rows=await r.json();
    renderOps(Array.isArray(rows)?rows:[]);
  }catch(e){panel.style.display='none'} /* fail silently — chat unaffected */
}
function renderOps(rows){
  const panel=$('chatOps');if(!panel)return;
  panel.style.display='';
  const now=Date.now(),M15=15*60*1000,H1=60*60*1000;
  let live=0;
  const list=$('chatOpsList');
  if(!rows.length){
    $('chatOpsTitle').innerHTML='ONLINE — OPERATIVES';
    list.innerHTML='<div class="chat-ops-empty">NO OPERATIVES VISIBLE</div>';
    return;
  }
  list.innerHTML=rows.map(p=>{
    const age=now-new Date(p.last_seen).getTime();
    const cls=age<M15?'on':(age<H1?'warm':'off');
    if(age<M15)live++;
    return '<div class="chat-op"><span class="op-dot '+cls+'"></span>'+
      '<span class="op-name">'+esc(p.username||'UNKNOWN')+'</span>'+
      '<span class="op-lv">Lv '+(p.level==null?1:p.level)+'</span>'+
      '<span class="op-time">'+relTime(p.last_seen)+'</span></div>';
  }).join('');
  $('chatOpsTitle').innerHTML=(live?'<span class="op-live">● '+live+'</span> ':'')+'ONLINE — OPERATIVES';
}
function buildChat(){
  if($('win-chat'))return;
  const w=document.createElement('div');w.className='win';w.id='win-chat';
  window.zTop=(window.zTop||100)+1;
  w.style.cssText='top:70px;left:120px;width:460px;height:560px;z-index:'+window.zTop;
  w.innerHTML='<div class="win-title"><span>💠 Mesh Chat <span class="sys-badge on" style="margin-left:8px">LIVE MESH</span></span>'+
    '<span><button class="tbtn" onclick="maxWin(\'win-chat\')">□</button><button class="tbtn" onclick="closeApp(\'chat\')">✕</button></span></div>'+
    '<div class="win-body">'+
    '<div class="chat-chans">'+CHANNELS.map(c=>'<div class="chat-chan'+(c.id===chan?' on':'')+'" data-ch="'+c.id+'">'+c.name+'</div>').join('')+'</div>'+
    '<div class="chat-presence"><span class="dot"></span><span id="chatStat">connecting to the mesh…</span></div>'+
    '<div class="chat-ops" id="chatOps"><div class="chat-ops-title" id="chatOpsTitle">ONLINE — OPERATIVES</div><div class="chat-ops-list" id="chatOpsList"><div class="chat-ops-empty">SCANNING THE MESH…</div></div></div>'+
    '<div class="chat-log" id="chatLog"></div>'+
    '<div class="chat-input"><input id="chatBox" maxlength="280" placeholder="Speak to the Syndicate…"><button class="btn" id="chatSend" style="font-size:12px">Send</button></div>'+
    '<div style="font-size:9.5px;color:var(--dim);margin-top:6px">You appear as <b id="chatMe"></b> · ranks show automatically with a connected wallet · be excellent to each other</div>'+
    '</div>';
  document.body.appendChild(w);
  w.addEventListener('mousedown',()=>{window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop});
  w.querySelectorAll('.chat-chan').forEach(b=>b.onclick=()=>{chan=b.dataset.ch;lastId=0;seen.clear();
    w.querySelectorAll('.chat-chan').forEach(x=>x.classList.toggle('on',x.dataset.ch===chan));
    $('chatLog').innerHTML='';fetchMsgs(true);startRealtime()});
  $('chatSend').onclick=sendMsg;
  $('chatBox').addEventListener('keydown',e=>{if(e.key==='Enter')sendMsg()});
  $('chatMe').textContent=myName();
}
function addMsg(m){
  const logEl=$('chatLog');if(!logEl)return;
  if(seen.has(m.id))return;seen.add(m.id);lastId=Math.max(lastId,m.id);
  const mine=(window.walletKey&&m.wallet_address===walletKey)||m.username===myName();
  const d=document.createElement('div');d.className='chat-msg'+(mine?' me':'');
  const t=new Date(m.created_at),ts=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
  d.innerHTML='<div class="ava">'+sigil(m.username)+'</div><div class="cbub"><div class="cwho">'+esc(m.username)+'<span class="ctime">'+ts+'</span></div><div class="ctext">'+esc(m.message)+'</div></div>';
  logEl.appendChild(d);
  logEl.scrollTop=logEl.scrollHeight;
}
async function fetchMsgs(full){
  const c=sb();const stat=$('chatStat');if(!stat)return;
  if(!c){stat.textContent='mesh offline — Supabase not configured';return}
  try{
    const r=await fetch(c.url.replace(/\/$/,'')+'/rest/v1/chat_messages?select=*&channel=eq.'+chan+'&order=id.asc&limit=60',{
      headers:{apikey:c.key,Authorization:'Bearer '+c.key}});
    if(!r.ok)throw new Error('http '+r.status);
    const rows=await r.json();
    rows.forEach(addMsg);
    stat.textContent=rows.length+' messages · #'+chan+(rtLive?' · ⚡ LIVE':' · live');
  }catch(e){stat.textContent='mesh sync issue — retrying…'}
}
/* --- v5.12: Supabase Realtime — live push, poll demoted to heartbeat --- */
let sbClient=null, rtChan=null, rtLive=false;
function loadSbJs(){return new Promise(res=>{
  if(window.supabase&&window.supabase.createClient)return res(true);
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload=()=>res(true);s.onerror=()=>res(false);
  document.head.appendChild(s);
})}
async function startRealtime(){
  const c=sb();if(!c)return;
  if(!await loadSbJs())return;
  try{
    if(!sbClient)sbClient=window.supabase.createClient(c.url.replace(/\/$/,''),c.key);
    if(rtChan){sbClient.removeChannel(rtChan);rtChan=null}
    rtChan=sbClient.channel('mesh-chat-'+chan)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages',filter:'channel=eq.'+chan},
        p=>{if(p&&p.new){addMsg(p.new)}})
      .subscribe(st=>{
        rtLive=(st==='SUBSCRIBED');
        const stat=$('chatStat');
        if(stat&&rtLive)stat.textContent='⚡ LIVE · #'+chan+' · realtime push active';
      });
  }catch(e){rtLive=false}
}
async function sendMsg(){
  const c=sb();const box=$('chatBox');const txt=(box.value||'').trim();
  if(!txt)return;if(!c){return}
  box.value='';
  try{
    const body={username:myName(),message:txt,channel:chan};
    if(window.walletKey)body.wallet_address=walletKey;
    const r=await fetch(c.url.replace(/\/$/,'')+'/rest/v1/chat_messages',{
      method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(body)});
    if(!r.ok)throw new Error('http '+r.status);
    fetchMsgs();
    try{window.feed&&feed('💠 You spoke to the mesh (#'+chan+')','b')}catch(e){}
  }catch(e){box.value=txt;log('Chat send failed','warn')}
}
buildChat();
const _openApp16=window.openApp;
window.openApp=function(id){_openApp16(id);
  if(id==='chat'){fetchMsgs(true);startRealtime();if(!poll)poll=setInterval(fetchMsgs,30000);
    fetchOps();if(!opsPoll)opsPoll=setInterval(fetchOps,60000)}
  else if(poll&&id!=='chat'&&!$('win-chat').classList.contains('open')){clearInterval(poll);poll=null;
    if(opsPoll){clearInterval(opsPoll);opsPoll=null}}
};
log('v5.12 Mesh Chat — realtime push live (heartbeat 30s fallback)','ok');
})();
