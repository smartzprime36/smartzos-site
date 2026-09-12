/* SmartzOS v5.18 — Voice Ranks: chat gamification
   Every message builds your Voice: XP, credits (daily-capped), titles, streaks.
   Title-ups broadcast to the Telegram group — the loudest voices get famous. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const VKEY='smartz_voice_v1';
let V={n:0,xp:0,day:'',dayCredits:0,lastDay:'',streak:0,title:''};
try{Object.assign(V,JSON.parse(localStorage.getItem(VKEY))||{})}catch(e){}
const save=()=>{try{localStorage.setItem(VKEY,JSON.stringify(V))}catch(e){}};

const TITLES=[
 {min:1,  t:'Whisperer',g:'🌬️',desc:'first words on the mesh'},
 {min:10, t:'Voice',    g:'🗣️',desc:'10 messages — the mesh knows your name'},
 {min:50, t:'Herald',   g:'📣',desc:'50 messages — a pillar of the conversation'},
 {min:200,t:'Oracle',   g:'🔮',desc:'200 messages — the Syndicate listens when you speak'},
];
function titleFor(n){let cur=null;TITLES.forEach(t=>{if(n>=t.min)cur=t});return cur}
function todayUTC(){return new Date().toISOString().slice(0,10)}

/* called by os-chat on every successful send (hooked below) */
function onChatSent(){
  const today=todayUTC();
  if(V.day!==today){V.day=today;V.dayCredits=0}
  V.n++;
  // streak: consecutive days with at least one message
  const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  if(V.lastDay!==today){V.streak=(V.lastDay===y)?V.streak+1:1;V.lastDay=today}
  // rewards: +2 XP always, +2 credits capped 40/day (in-game credits only)
  try{if(window.AC){AC.xp+=2;saveAC&&saveAC()}}catch(e){}
  let cr=0;
  if(V.dayCredits<40){cr=2;V.dayCredits+=2;try{G.credits+=2;saveGame()}catch(e){}}
  const t=titleFor(V.n);
  const isNew=t&&t.t!==V.title;
  if(isNew){
    V.title=t.t;
    try{window.notify&&notify(t.g+' Voice rank up — '+t.t,'You are now a '+t.t+' of the mesh ('+V.n+' messages). '+t.desc+'.','ok')}catch(e){}
    // tell the group — voices get famous
    try{
      const c=window.SMARTZ_SITE_CONFIG&&SMARTZ_SITE_CONFIG.supabase;
      if(c&&window.supabase&&window.supabase.createClient){
        window.supabase.createClient(c.url,c.anonKey).functions.invoke('tg-bridge',
          {body:{action:'send',name:'MESH·🎖',text:'A Syndicate member just became '+t.g+' '+t.t+' ('+V.n+' messages on the mesh). Say something: https://smc.kimi.page'}}).catch(()=>{});
      }
    }catch(e){}
  }
  if(cr||V.n%10===0)paintVoice();
  save();
}

/* voice chip inside the Mesh Chat window */
function paintVoice(){
  const w=$('win-chat');if(!w)return;
  let chip=$('voiceChip');
  if(!chip){
    const body=w.querySelector('.win-body');if(!body)return;
    chip=document.createElement('div');chip.id='voiceChip';
    chip.style.cssText='font-size:10px;color:#8b93a5;padding:4px 10px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:10px;flex-wrap:wrap';
    body.insertBefore(chip,body.firstChild);
  }
  const t=titleFor(V.n),next=TITLES.find(x=>x.min>V.n);
  const badge=(window.SHOP&&SHOP.has('prism_badge'))?' 🌈':'';
  const frame=(window.SHOP&&SHOP.has('oracle_frame'))?'border:1px solid rgba(232,180,120,.6);border-radius:8px;padding:1px 7px;background:rgba(232,180,120,.08)':'';
  chip.innerHTML='<span style="'+frame+'">'+(t?t.g+' <b style="color:#e8b478">'+t.t+'</b>':'🌱 No voice yet')+badge+'</span>'+
    '<span>💬 '+V.n+' msgs</span><span>🔥 '+V.streak+'d streak</span>'+
    (next?'<span style="margin-left:auto">→ '+next.g+' '+next.t+' at '+next.min+'</span>':'<span style="margin-left:auto">max rank 🔮</span>');
}

/* hook os-chat: patch its sender. The chat pack posts via fetch in sendMsg —
   we listen for the local echo instead: watch the chat log DOM for own messages. */
function hookChat(){
  const w=$('win-chat');if(!w)return false;
  const logEl=w.querySelector('#chatLog');if(!logEl)return false;
  if(logEl._voiceHook)return true;logEl._voiceHook=true;
  let armed=Date.now();
  new MutationObserver(muts=>{
    if(Date.now()-armed<500)return;
    let fresh=0;
    muts.forEach(mu=>mu.addedNodes.forEach(nd=>{
      if(nd.nodeType===1&&nd.classList&&nd.classList.contains('me'))fresh++;
    }));
    // batches >2 = history load (fetchMsgs appends many at once); 1-2 = real sends
    if(fresh>0&&fresh<=2)onChatSent();
    else if(fresh>2)armed=Date.now(); // re-arm after bulk loads
  }).observe(logEl,{childList:true});
  // history loads add many .me at once — re-arm briefly when log gets big batches
  paintVoice();
  return true;
}
let tries=0;
const iv=setInterval(()=>{
  if(hookChat()||++tries>30)clearInterval(iv);
},1000);
/* chat window is built on first open — re-hook on openApp */
const _openApp=window.openApp;
window.openApp=function(id){_openApp(id);if(id==='chat')setTimeout(()=>{hookChat();paintVoice()},300)};
log('v5.18 Voice Ranks — chat gamification live (XP, credits, titles, streaks)','ok');
})();
