/* SmartzOS v5.19 — Arena: knowledge PvP duels, TG activity rewards, credit shop
   In-game credits only. Server (arena edge fn) arbitrates every duel. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb=null, tab='duels', quiz=null, quizT0=0, quizTimer=null;

function cfg(){try{return window.SMARTZ_SITE_CONFIG&&SMARTZ_SITE_CONFIG.supabase?SMARTZ_SITE_CONFIG.supabase:null}catch(e){return null}}
function myName(){
  try{if(window.walletKey){const r=window.computeRank?computeRank():'';
    return (r&&r!=='Unverified'?r.split('-')[0].toUpperCase()+'·':'')+walletKey.slice(0,4)+'…'+walletKey.slice(-4)}}catch(e){}
  let n=localStorage.getItem('smartz_chat_name');
  if(!n){n='VOYAGER·'+Math.random().toString(36).slice(2,6).toUpperCase();localStorage.setItem('smartz_chat_name',n)}
  return n;
}
function credits(){try{return G.credits||0}catch(e){return 0}}
function grant(n){try{G.credits+=n;saveGame();paintCredits()}catch(e){}}
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

/* ================= SHOP (credit sink — utility for being active) ================= */
const ITEMS=[
 {id:'streak_shield',g:'🛡️',t:'Streak Shield',d:'One missed day won\'t break your Daily Drop streak. Consumed on use.',cost:150},
 {id:'prism_badge',g:'🌈',t:'Prism Badge',d:'A rainbow sigil on your Voice chip in Mesh Chat. Permanent flex.',cost:100},
 {id:'free_entry',g:'🎟️',t:'Free Arena Entry',d:'Your next duel costs 0 credits. One use.',cost:60},
 {id:'oracle_frame',g:'🔮',t:'Oracle Frame',d:'Gold frame on your Voice chip — visible to the whole mesh.',cost:250},
];
const SKEY='smartz_shop_v1';
let OWNED=[];try{OWNED=JSON.parse(localStorage.getItem(SKEY))||[]}catch(e){}
window.SHOP={
  has:id=>OWNED.includes(id),
  use:id=>{const i=OWNED.indexOf(id);if(i<0)return false;OWNED.splice(i,1);localStorage.setItem(SKEY,JSON.stringify(OWNED));return true},
};
function buy(id){
  const it=ITEMS.find(x=>x.id===id);if(!it||OWNED.includes(id))return;
  if(credits()<it.cost){window.notify&&notify('Shop','Need '+it.cost+' credits — earn them in chat, duels, quests and the Daily Drop.','warn');return}
  grant(-it.cost);OWNED.push(id);localStorage.setItem(SKEY,JSON.stringify(OWNED));
  window.notify&&notify(it.g+' '+it.t+' acquired',it.d,'ok');paintShop();
}

/* ================= WINDOW ================= */
function buildWin(){
  if($('win-arena'))return;
  const w=document.createElement('div');w.className='win';w.id='win-arena';
  window.zTop=(window.zTop||100)+1;
  w.style.cssText='top:55px;left:110px;width:560px;height:590px;z-index:'+window.zTop;
  w.innerHTML='<div class="win-title"><span>⚔️ The Arena — knowledge PvP</span>'+
    '<span><button class="tbtn" onclick="maxWin(\'win-arena\')">□</button><button class="tbtn" onclick="closeApp(\'arena\')">✕</button></span></div>'+
    '<div class="win-body ar-body">'+
    '<div class="ar-tabs"><button class="ar-tab on" data-t="duels">⚔ Duels</button>'+
    '<button class="ar-tab" data-t="rewards">🏆 Rewards & Shop</button>'+
    '<span class="ar-credits" id="arCredits"></span></div>'+
    '<div id="arDuels"></div><div id="arRewards" style="display:none"></div>'+
    '<div class="ar-quiz" id="arQuiz"></div></div>';
  document.body.appendChild(w);
  w.addEventListener('mousedown',()=>{window.zTop=(window.zTop||100)+1;w.style.zIndex=window.zTop});
  w.querySelectorAll('.ar-tab').forEach(b=>b.onclick=()=>{
    tab=b.dataset.t;w.querySelectorAll('.ar-tab').forEach(x=>x.classList.toggle('on',x===b));
    $('arDuels').style.display=tab==='duels'?'':'none';
    $('arRewards').style.display=tab==='rewards'?'':'none';
    if(tab==='rewards')paintRewards();
  });
}
function paintCredits(){const el=$('arCredits');if(el)el.textContent='● '+credits()+' cr'}

/* ================= DUELS ================= */
async function paintDuels(){
  const el=$('arDuels');if(!el)return;paintCredits();
  const s=await client();if(!s){el.innerHTML='<div class="ar-empty">Mesh offline.</div>';return}
  const {data:duels}=await s.from('pvp_duels').select('*').order('created_at',{ascending:false}).limit(30);
  const mine=myName(),list=duels||[];
  const open=list.filter(d=>d.status==='open');
  const active=list.filter(d=>d.status==='active'&&(d.creator===mine||d.acceptor===mine));
  const hist=list.filter(d=>d.status==='resolved').slice(0,10);
  // claim payouts locally (server decided winner; credits live client-side)
  hist.forEach(d=>{
    if(d.winner===mine&&!claimed(d.id)){
      markClaimed(d.id);grant(d.payout||0);
      window.notify&&notify('⚔️ Duel won!','+'+(d.payout||0)+' credits from the Arena pot.','ok');
    }else if(d.winner==='draw'&&(d.creator===mine||d.acceptor===mine)&&!claimed(d.id)){
      markClaimed(d.id);grant(d.payout||d.entry);
    }
  });
  el.innerHTML=
   '<div class="ar-card"><h6>⚔ CHALLENGE THE MESH — 5 questions · Solana + the triad · most correct wins, fastest breaks ties</h6>'+
    '<div class="ar-row"><span style="font-size:11px;color:#8b93a5">Entry:</span>'+
    '<select id="arEntry"><option>10</option><option>25</option><option>50</option><option>100</option></select>'+
    '<span style="font-size:10px;color:#6d7688">credits · winner takes 90% of the pot, 10% burned</span>'+
    '<button class="ar-btn" id="arCreate">Create Duel</button></div></div>'+
   (active.length?'<div class="ar-card"><h6>🔥 YOUR ACTIVE DUELS</h6>'+active.map(d=>{
     const answered=(d.creator===mine?d.c_score!=null:d.a_score!=null);
     const foe=d.creator===mine?d.acceptor:d.creator;
     return'<div class="ar-duel"><span>⚔</span><span>you <span class="vs">vs</span> '+esc(foe||'?')+'</span>'+
      '<span class="st">'+d.entry+' cr pot</span>'+
      (answered?'<span class="st">answers in — waiting for '+esc(foe||'foe')+'</span>':
        '<button class="ar-btn" data-play="'+d.id+'">▶ Play</button>')+'</div>'}).join('')+'</div>':'')+
   '<div class="ar-card"><h6>🌐 OPEN CHALLENGES</h6>'+
    (open.length?open.map(d=>'<div class="ar-duel"><span>⚔</span><span>'+esc(d.creator)+'</span>'+
      '<span class="st">'+d.entry+' cr entry</span>'+
      (d.creator===mine?'<button class="ar-btn ghost" data-cancel="'+d.id+'">Cancel</button>':
        '<button class="ar-btn" data-accept="'+d.id+'">Accept</button>')+'</div>').join(''):
      '<div class="ar-empty">No open challenges — create one and the mesh will see it.</div>')+'</div>'+
   '<div class="ar-card"><h6>📜 RECENT RESULTS</h6>'+
    (hist.length?hist.map(d=>{
      const youIn=d.creator===mine||d.acceptor===mine;
      const tag=d.winner==='draw'?'<span class="st">draw</span>':
        youIn?(d.winner===mine?'<span class="win-tag">WON +'+d.payout+'</span>':'<span class="lose-tag">lost</span>'):
        '<span class="st">'+esc(d.winner||'')+' won</span>';
      return'<div class="ar-duel"><span>⚔</span><span>'+esc(d.creator)+' <span class="vs">vs</span> '+esc(d.acceptor||'?')+'</span>'+
       '<span class="st">'+(d.c_score??'—')+'–'+(d.a_score??'—')+'</span>'+tag+'</div>'}).join(''):
      '<div class="ar-empty">No duels yet — be the first legend.</div>')+'</div>';
  $('arCreate').onclick=createDuel;
  el.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>acceptDuel(+b.dataset.accept));
  el.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{await act({action:'cancel',id:+b.dataset.cancel,name:mine});paintDuels()});
  el.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>startQuiz(+b.dataset.play));
}
const CKEY='smartz_arena_claimed';
function claimed(id){try{return(JSON.parse(localStorage.getItem(CKEY))||[]).includes(id)}catch(e){return false}}
function markClaimed(id){try{const a=JSON.parse(localStorage.getItem(CKEY))||[];a.push(id);localStorage.setItem(CKEY,JSON.stringify(a.slice(-100)))}catch(e){}}
async function createDuel(){
  const entry=+$('arEntry').value||10;
  let free=false;
  if(window.SHOP&&SHOP.has('free_entry')&&confirm('Use your 🎟️ Free Entry for this duel?')){SHOP.use('free_entry');free=true}
  if(!free&&credits()<entry){window.notify&&notify('Arena','Not enough credits for a '+entry+' cr entry.','warn');return}
  const r=await act({action:'create',name:myName(),entry});
  if(!r.ok){window.notify&&notify('Arena','Could not create duel: '+(r.error||'?'),'warn');return}
  if(!free)grant(-entry);
  window.notify&&notify('⚔️ Duel created','The mesh can see your challenge. First to accept fights you.','ok');
  try{SMARTZ_BUS&&SMARTZ_BUS.emit&&SMARTZ_BUS.emit('ge.offer',{side:'DUEL',item:'quiz',qty:entry,price:'arena'})}catch(e){}
  paintDuels();
}
async function acceptDuel(id){
  // read the duel's entry, confirm the stake, then accept
  const s=await client();let entry=10;
  try{const {data}=await s.from('pvp_duels').select('entry,creator').eq('id',id).single();if(data)entry=data.entry}catch(e){}
  if(credits()<entry){window.notify&&notify('Arena','This duel costs '+entry+' cr to accept — earn more first.','warn');return}
  if(!confirm('Accept this duel for '+entry+' credits? 5 questions, most correct wins '+(Math.round(entry*2*0.9))+' cr.'))return;
  const d=await act({action:'accept',id,name:myName()});
  if(!d.ok){window.notify&&notify('Arena',d.error==='not_open'?'That duel was just taken.':'Accept failed.','warn');paintDuels();return}
  grant(-entry);
  paintDuels();startQuiz(id);
}

/* ================= QUIZ ================= */
async function startQuiz(id){
  const r=await act({action:'get_quiz',id,name:myName()});
  if(!r.ok){window.notify&&notify('Arena',r.error==='not_active'?'Duel not active.':'Cannot load quiz.','warn');return}
  quiz={id,qs:r.quiz,answers:{}};quizT0=Date.now();
  const q=$('arQuiz');q.classList.add('open');
  q.innerHTML='<div class="ar-timer" id="arTimer">0:00</div>'+
    r.quiz.map((x,i)=>'<div class="ar-q"><div class="qq">'+(i+1)+'. '+esc(x.q)+'</div>'+
      x.c.map((c,ci)=>'<span class="ar-opt" data-q="'+x.id+'" data-c="'+ci+'">'+esc(c)+'</span>').join('')+'</div>').join('')+
    '<button class="ar-btn" id="arSubmit" style="align-self:center;padding:10px 26px">Submit Answers ⚔</button>';
  q.querySelectorAll('.ar-opt').forEach(o=>o.onclick=()=>{
    quiz.answers[o.dataset.q]=+o.dataset.c;
    q.querySelectorAll('.ar-opt[data-q="'+o.dataset.q+'"]').forEach(x=>x.classList.toggle('sel',x===o));
  });
  $('arSubmit').onclick=submitQuiz;
  quizTimer=setInterval(()=>{const t=$('arTimer');if(!t)return;
    const s=Math.floor((Date.now()-quizT0)/1000);t.textContent=Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0')},1000);
}
async function submitQuiz(){
  if(Object.keys(quiz.answers).length<quiz.qs.length){
    if(!confirm('Unanswered questions count as wrong. Submit anyway?'))return;
  }
  clearInterval(quizTimer);
  const ms=Date.now()-quizT0;
  const r=await act({action:'answer',id:quiz.id,name:myName(),ms,answers:quiz.answers});
  const q=$('arQuiz');
  if(!r.ok){q.classList.remove('open');window.notify&&notify('Arena','Submit failed — '+(r.error||'?'),'err');return}
  q.innerHTML='<div style="margin:auto;text-align:center;padding:30px">'+
    '<div style="font-size:42px">'+(r.score>=4?'🏆':r.score>=2?'⚔️':'📚')+'</div>'+
    '<div style="font-size:18px;font-weight:800;color:#e8b478;margin:10px 0">'+r.score+' / '+r.total+' correct</div>'+
    '<div style="font-size:11px;color:#8b93a5">'+(r.waiting?'Waiting for your opponent… the Arena resolves when they answer.':'Duel resolved — check results!')+'</div>'+
    '<button class="ar-btn" id="arQuizDone" style="margin-top:16px">Back to the Arena</button></div>';
  $('arQuizDone').onclick=()=>{q.classList.remove('open');paintDuels()};
  try{window.notify&&notify('⚔️ Answers locked in',r.score+'/'+r.total+' correct'+(r.waiting?' — waiting for opponent':' — duel resolved'),'ok')}catch(e){}
}

/* ================= REWARDS & SHOP ================= */
function paintRewards(){
  const el=$('arRewards');if(!el)return;
  el.innerHTML=
   '<div class="ar-card"><h6>✈️ TELEGRAM VOICE — earn for being active in the group</h6>'+
    '<div style="font-size:10.5px;color:#8b93a5;margin-bottom:8px">10 msgs/wk = 25 cr · 30 = 75 cr · 100 = 200 cr. Counted server-side from t.me/Smrtquickflips, claimable once per week.</div>'+
    '<div class="ar-row"><input id="arTgHandle" placeholder="Your Telegram @handle" style="flex:1;min-width:150px">'+
    '<button class="ar-btn" id="arTgClaim">Claim</button></div><div id="arTgMsg" style="font-size:10px;margin-top:6px;color:#8b93a5"></div></div>'+
   '<div class="ar-card"><h6>🎯 KNOWLEDGE WINS — quiz + class wins banked in the group, cashed here</h6>'+
    '<div style="font-size:10.5px;color:#8b93a5;margin-bottom:8px">Daily Quiz 16:00 UTC and War Room Class 16:30 UTC in t.me/Smrtquickflips. First correct answer in either banks a knowledge win — each win = 40 cr here.</div>'+
    '<div class="ar-row"><input id="arQuizHandle" placeholder="Your Telegram @handle" style="flex:1;min-width:150px">'+
    '<button class="ar-btn" id="arQuizClaim">Convert wins</button></div><div id="arQuizMsg" style="font-size:10px;margin-top:6px;color:#8b93a5"></div></div>'+
   '<div class="ar-card"><h6>🔥 STREAK KEEPER — show up daily in the group, get paid for the flame</h6>'+
    '<div style="font-size:10.5px;color:#8b93a5;margin-bottom:8px">Say "gm" or /checkin once a day in t.me/Smrtquickflips. Each new streak day = 2 cr here (max 60/claim). Miss a day, the flame resets.</div>'+
    '<div class="ar-row"><input id="arStreakHandle" placeholder="Your Telegram @handle" style="flex:1;min-width:150px">'+
    '<button class="ar-btn" id="arStreakClaim">Claim streak</button></div><div id="arStreakMsg" style="font-size:10px;margin-top:6px;color:#8b93a5"></div></div>'+
   '<div class="ar-card"><h6>🌀 TUNNEL QUESTS — on-chain missions, verified in the group</h6>'+
    '<div style="font-size:10.5px;color:#8b93a5;margin-bottom:8px">Three quests in t.me/Smrtquickflips: /tq shield (Orca ±20% LP), /tq sword (Jupiter trailing stop), /tq stash (DCA + Earn on Recurring). Each verified quest = 40 cr — clear all three in a week for the +150 cr TUNNEL SWEEP.</div>'+
    '<div class="ar-row"><input id="arQuestHandle" placeholder="Your Telegram @handle" style="flex:1;min-width:150px">'+
    '<button class="ar-btn" id="arQuestClaim">Quest claim</button></div><div id="arQuestMsg" style="font-size:10px;margin-top:6px;color:#8b93a5"></div></div>'+
   '<div class="ar-card"><h6>🛒 SYNDICATE SHOP — spend the credits you earn</h6><div class="ar-shop">'+
    ITEMS.map(it=>{const owned=OWNED.includes(it.id);
      return'<div class="ar-item'+(owned?' owned':'')+'"><div class="it-g">'+it.g+'</div><div class="it-t">'+it.t+'</div>'+
       '<div class="it-d">'+it.d+'</div>'+
       (owned?'<button class="ar-btn it-b owned" disabled>OWNED</button>':
        '<button class="ar-btn it-b" data-buy="'+it.id+'">'+it.cost+' cr</button>')+'</div>'}).join('')+'</div></div>';
  $('arTgClaim').onclick=async()=>{
    const h=$('arTgHandle').value.trim();if(!h)return;
    const m=$('arTgMsg');m.textContent='Checking your group activity…';
    const r=await act({action:'claim_tg',handle:h});
    if(r.ok){grant(r.granted);m.innerHTML='<span style="color:#2ee6a8">+'+r.granted+' credits claimed ('+r.count+' messages this week)!</span>';
      window.notify&&notify('✈️ Telegram Voice','+'+r.granted+' credits for group activity.','ok');
      try{SMARTZ_BUS&&SMARTZ_BUS.emit&&SMARTZ_BUS.emit('build.ship',{name:'TG Voice claim +'+r.granted+'cr'})}catch(e){}}
    else if(r.error==='already_claimed')m.textContent='Already claimed this week — new claim opens Monday.';
    else if(r.error==='not_enough_activity')m.textContent=r.count+' messages this week — need 10 for the first tier. Keep talking!';
    else m.textContent='Claim failed — try again.';
  };
  $('arQuizClaim').onclick=async()=>{
    const h=$('arQuizHandle').value.trim();if(!h)return;
    const m=$('arQuizMsg');m.textContent='Checking your banked quiz wins…';
    const r=await act({action:'claim_quiz',handle:h});
    if(r.ok){grant(r.granted);m.innerHTML='<span style="color:#2ee6a8">+'+r.granted+' credits ('+r.wins+' quiz win'+(r.wins>1?'s':'')+' converted)!</span>';
      window.notify&&notify('🎯 Quiz Champion','+'+r.granted+' credits for Daily Quiz wins.','ok');}
    else if(r.error==='no_wins')m.textContent='No banked wins — first correct answer at 16:00 UTC in the group banks one.';
    else m.textContent='Claim failed — try again.';
  };
  $('arStreakClaim').onclick=async()=>{
    const h=$('arStreakHandle').value.trim();if(!h)return;
    const m=$('arStreakMsg');m.textContent='Checking your streak…';
    const r=await act({action:'claim_streak',handle:h});
    if(r.ok){grant(r.granted);m.innerHTML='<span style="color:#2ee6a8">+'+r.granted+' credits ('+r.delta+' new streak day'+(r.delta>1?'s':'')+' — '+r.streak+'-day flame)!</span>';
      window.notify&&notify('🔥 Streak Keeper','+'+r.granted+' credits for daily check-ins.','ok');
      try{SMARTZ_BUS&&SMARTZ_BUS.emit&&SMARTZ_BUS.emit('build.ship',{name:'Streak claim +'+r.granted+'cr'})}catch(e){}}
    else if(r.error==='no_streak')m.textContent='No streak yet — say "gm" or /checkin in the group today.';
    else if(r.error==='nothing_new')m.textContent='Streak '+r.streak+' days — fully claimed. Come back after tomorrow\'s check-in.';
    else m.textContent='Claim failed — try again.';
  };
  $('arQuestClaim').onclick=async()=>{
    const h=$('arQuestHandle').value.trim();if(!h)return;
    const m=$('arQuestMsg');m.textContent='Checking your verified quests…';
    const r=await act({action:'claim_quest',handle:h});
    if(r.ok){grant(r.granted);m.innerHTML='<span style="color:#2ee6a8">+'+r.granted+' credits ('+r.delta+' quest point'+(r.delta>1?'s':'')+(r.sweep?' + 🌀 TUNNEL SWEEP +'+r.sweep+'cr':'')+')!</span>';
      window.notify&&notify('🌀 Tunnel Quest','+'+r.granted+' credits for verified quests.','ok');
      try{SMARTZ_BUS&&SMARTZ_BUS.emit&&SMARTZ_BUS.emit('build.ship',{name:'Quest claim +'+r.granted+'cr'})}catch(e){}}
    else if(r.error==='no_points')m.textContent='No verified quests yet — /tq shield in the group, then an admin verifies.';
    else if(r.error==='nothing_new')m.textContent='All quest points claimed — clear another quest this week.';
    else m.textContent='Claim failed — try again.';
  };
  el.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));
}
function paintShop(){if(tab==='rewards')paintRewards()}

/* ================= WIRE ================= */
const _openApp=window.openApp;
window.openApp=function(id){_openApp(id);
  if(id==='arena'){buildWin();const w=$('win-arena');w&&w.classList.add('open');paintDuels()}};
setInterval(()=>{const w=$('win-arena');if(w&&w.classList.contains('open')&&tab==='duels')paintDuels()},20000);
log('v5.19 The Arena — knowledge PvP, TG rewards, credit shop','ok');
})();
