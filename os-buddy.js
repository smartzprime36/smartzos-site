/* ============ SmartzOS v4.3 — ZO Buddy + Guided Tours ============ */
/* ZO: Zoran Operator Envoy — personal assistant, action executor, context tips */

/* ---------- UI ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div id="buddyFab" onclick="toggleBuddy()">🔥<span class="dot"></span></div>
<div id="buddyPanel">
  <div class="bp-head">
    <div class="av">🔥</div>
    <div><div class="nm">ZO — Operator Envoy</div><div class="st">● online · routed through Zoran</div></div>
    <button class="tbtn" style="margin-left:auto" onclick="toggleBuddy()">✕</button>
  </div>
  <div class="bp-tabs">
    <div class="bp-tab on" id="bt-chat" onclick="bpTab('chat')">💬 Chat</div>
    <div class="bp-tab" id="bt-tours" onclick="bpTab('tours')">🗺 Tours</div>
    <div class="bp-tab" id="bt-tips" onclick="bpTab('tips')">💡 Tips</div>
  </div>
  <div class="bp-body" id="bp-chat"></div>
  <div class="bp-body" id="bp-tours" style="display:none"></div>
  <div class="bp-body" id="bp-tips" style="display:none"></div>
  <div class="bp-quick" id="bp-quick"></div>
  <div class="bp-in"><input id="bp-input" placeholder="Ask ZO anything…" autocomplete="off"><button onclick="bpSend()">➤</button></div>
</div>
<div id="tourVeil"></div><div id="tourTip"></div>`);

function toggleBuddy(){
  const p=document.getElementById('buddyPanel');
  p.classList.toggle('open');
  if(p.classList.contains('open')){document.getElementById('buddyFab').classList.remove('has-tip');bpScroll();}
}
function bpTab(t){
  ['chat','tours','tips'].forEach(x=>{
    document.getElementById('bp-'+x).style.display=x===t?'block':'none';
    document.getElementById('bt-'+x).classList.toggle('on',x===t);
  });
  if(t==='tours')renderTours();
  if(t==='tips')renderTips();
}
function bpScroll(){const c=document.getElementById('bp-chat');c.scrollTop=c.scrollHeight;}
function zoSay(html){
  const c=document.getElementById('bp-chat');
  c.insertAdjacentHTML('beforeend','<div class="bmsg"><div class="bav">🔥</div><div class="bt">'+html+'</div></div>');
  bpScroll();
}
function userSay(t){
  const c=document.getElementById('bp-chat');
  c.insertAdjacentHTML('beforeend','<div class="bmsg user"><div class="bav">👤</div><div class="bt">'+t+'</div></div>');
  bpScroll();
}
function zoTip(html){ // proactive bubble
  zoSay(html);
  if(!document.getElementById('buddyPanel').classList.contains('open'))
    document.getElementById('buddyFab').classList.add('has-tip');
}
const QUICK=['How do I start?','Buy SMF','Open Exchange','What is slippage?','How to rank up?','Build my token'];
document.getElementById('bp-quick').innerHTML=QUICK.map(q=>'<span class="q" onclick="bpAsk(\''+q.replace(/'/g,"\\'")+'\')">'+q+'</span>').join('');

/* ---------- KNOWLEDGE BASE ---------- */
const KB=[
 {k:['start','begin','new here','how do i start','first','beginner'],t:'Welcome aboard. The proven path: <b>1)</b> run the Liquidity Tunnel to learn swaps risk-free, <b>2)</b> connect your wallet, <b>3)</b> study at the Academy, <b>4)</b> hold the triad to unlock everything. Want a guided tour?',a:{l:'▶ Start HQ Tour',f:"startTour('hq')"}},
 {k:['buy smf','get smf','smf','sword'],t:'🐂 SMF — Tauron the Sword — is the gate-key: holding even a little opens the Inner Sanctum and lifts you to Bladebearer (8 GE slots, 1.5× Academy XP). I can arm the terminal now.',a:{l:'⚔ Buy SMF',f:"quickBuy('SMF')"}},
 {k:['buy smrt','get smrt','smrt','bear'],t:'🐻 SMRT — Koda the Shield — governance & stability. Hold 10k+ for Sentinel rank (city discounts). Paired with SMF and SMC it makes you Coherent — the top of the ladder.',a:{l:'🛡 Buy SMRT',f:"quickBuy('SMRT')"}},
 {k:['buy smc','get smc','smc','phoenix'],t:'🔥 SMC — Zoran\'s Coherence layer. It routes the whole economy, and you can burn 100 SMC in the Fusion Lab for a verifiable on-chain Phoenix Sigil.',a:{l:'🔥 Buy SMC',f:"quickBuy('SMC')"}},
 {k:['connect','wallet','phantom','solflare','link'],t:'Your wallet is a Solana keypair — Phantom or Solflare. Connect from the taskbar and I\'ll check your triad balances, assign rank, and open gates automatically.',a:{l:'🔗 Connect Wallet',f:'connectWallet()'}},
 {k:['slippage','price impact'],t:'Slippage = the gap between expected and actual fill price. On Solana pools, price is the pool ratio — big orders move it against you. Lesson: trade smaller clips, or set limit triggers in the Trigger Terminal instead of chasing.',a:{l:'⚔ Open Triggers',f:"openApp('trigger')"}},
 {k:['rank','level up','climb','tier'],t:'The ladder: Unverified → <b>Tunnel-Cleared</b> (connect or finish a run) → <b>Bladebearer</b> (hold SMF) → <b>Sentinel</b> (10k+ SMRT) → <b>Coherent</b> (all three). Each rank unlocks real perks — check the Synergy Mesh.',a:{l:'◈ See Perks',f:"openApp('economy')"}},
 {k:['exchange','grand exchange','ge','market'],t:'The Grand Triad Exchange works like RuneScape\'s GE: place buy/sell offers at your price, the mesh order-flow fills them, and your trades move the mid price. Your rank grants extra offer slots.',a:{l:'🏦 Open Exchange',f:"openApp('ge')"}},
 {k:['city','build','triad city','district'],t:'Triad City is your production engine: habitats grow population, plants make power, vaults/forges/relays mint shards every tick, and same-type neighbors boost each other ×1.5. Credits in, tokens out.',a:{l:'🏙 Open City',f:"openApp('city')"}},
 {k:['token','make token','create token','forge','launch','spl'],t:'Ready to build your own SPL token? The Academy teaches the full path — mints, authorities, metadata, liquidity — and the Token Forge walks you through a simulated launch with the real CLI commands. Advanced tracks need triad holdings (the tuition).',a:{l:'⚒ Open Forge',f:"openApp('academy');acTab('forge')"}},
 {k:['academy','learn','tutorial','lesson','school'],t:'The Academy teaches Solana from zero to token launches. Track 1 is free; deeper tracks open for SMF / SMRT / full-triad holders. Quizzes pay XP and credits.',a:{l:'🎓 Open Academy',f:"openApp('academy')"}},
 {k:['paper','practice','sandbox'],t:'Paper Trading gives you 100 practice SOL at live prices — zero risk, real learning. Every closed trade gets a full Resonance autopsy, and ZORAN always speaks last.',a:{l:'🎓 Open Sandbox',f:"openApp('paper')"}},
 {k:['dca','limit','trigger','automate'],t:'The Trigger Terminal sets limit orders and DCA schedules ("Sentinel\'s Discipline"). When price hits your target, the Jupiter terminal arms — your wallet signs, nothing moves without you.',a:{l:'⚔ Open Triggers',f:"openApp('trigger')"}},
 {k:['burn','attestation','phoenix sigil'],t:'Burn-to-Forge sacrifices 100 real SMC on-chain (irreversible!) and records a Solscan-verifiable Phoenix Sigil attestation — worth +300 leaderboard score and a +10% city production aura.',a:{l:'🔥 Open Fusion Lab',f:"openApp('game');gameTab('fuse')"}},
 {k:['whale','alert','whales'],t:'Whale Watch polls all three triad pools every 60s — price shocks over 5%, volume surges, liquidity shifts — and alerts you before the crowd sees it.',a:{l:'🐋 Open Whale Watch',f:"openApp('whale')"}},
 {k:['leaderboard','score','rank points'],t:'Score = credits + artifacts×100 + runs×50 + rank bonus + attestations×300. Boards bracket by rank tier, so you compete with peers, not whales.',a:{l:'🏆 Open Leaderboard',f:"openApp('board')"}},
 {k:['solana','what is solana','blockchain'],t:'Solana is a high-speed chain: ~400ms blocks, sub-cent fees, Proof of History ordering. Everything — tokens, NFTs, DeFi — lives in accounts that pay rent in SOL. Track 1 of the Academy covers it properly.',a:{l:'📚 Track 1',f:"openApp('academy')"}},
 {k:['gas','fee','fees'],t:'Solana fees are paid in SOL (fractions of a cent). Keep ~0.02 SOL reserve so swaps never stall mid-route. KODA-7 calls this "fuel discipline".'},
 {k:['liquidity','pool','lp'],t:'A liquidity pool pairs a token with SOL/USDC. Price = the ratio of both sides. Big trade vs shallow pool = big price impact. That\'s what Whale Watch monitors on the triad pools.'},
 {k:['circuit','quest','full circuit'],t:'The Full Circuit is a 6-step journey across every system — swap, tunnel, lesson, trade, city, forge — worth 500 credits and the Circuit Master badge. Your progress auto-tracks on the Synergy Bus.',a:{l:'⛓ View Circuit',f:"openApp('economy');ecTab('quest')"}},
 {k:['tour','guide','walkthrough','show me'],t:'I run guided spotlight tours for every major app. Pick one from my Tours tab, or say "tour exchange" / "tour city" and we\'ll walk it together.',a:{l:'🗺 See Tours',f:"bpTab('tours')"}},
];
function bpAsk(q){document.getElementById('bp-input').value=q;bpSend();}
function bpSend(){
  const inp=document.getElementById('bp-input'),q=inp.value.trim();
  if(!q)return;inp.value='';
  userSay(q);
  setTimeout(()=>zoAnswer(q.toLowerCase()),350);
}
function zoAnswer(q){
  // tour shortcuts
  const tm=q.match(/tour (hq|exchange|ge|city|swap|game|tunnel|academy)/);
  if(tm){const map={hq:'hq',exchange:'ge',ge:'ge',city:'city',swap:'swap',game:'game',tunnel:'game',academy:'academy'};
    zoSay('On it — follow the flame. 🗺');startTour(map[tm[1]]);return;}
  // action shortcuts
  if(/open (the )?(\w+)/.test(q)){
    const m=q.match(/open (?:the )?(\w+)/)[1];
    const ids={exchange:'ge',ge:'ge',city:'city',swap:'swap',vault:'vault',game:'game',tunnel:'game',academy:'academy',members:'sanctum',sanctum:'members',advisor:'advisor',portfolio:'portfolio',shell:'cli',cli:'cli',board:'board',leaderboard:'board',whale:'whale',paper:'paper',triggers:'trigger',economy:'economy',mesh:'economy',resonance:'resonance',missions:'missions',hq:'hq',settings:'settings'};
    if(ids[m]){zoSay('Opening '+m+' for you. Anything else?');openApp(ids[m]);return;}
  }
  for(const e of KB){
    if(e.k.some(k=>q.includes(k))){
      zoSay(e.t+(e.a?'<span class="act"><button onclick="'+e.a.f+'">'+e.a.l+'</button></span>':''));
      return;
    }
  }
  // context fallback
  const b=SMARTZ_STATE.balances;
  let fallback='I route questions through the whole mesh. Try asking about <b>buying SMF</b>, <b>slippage</b>, <b>ranking up</b>, <b>building a token</b>, or say <b>"tour city"</b>.';
  if(!walletKey)fallback=' First move I\'d suggest: connect your wallet so I can see your triad balances — or run the Liquidity Tunnel if you\'re brand new.';
  else if(b.SMF<=0)fallback+=' By the way — you hold no SMF yet. The Inner Sanctum gate needs the Sword.';
  zoSay(fallback);
}
document.getElementById('bp-input').addEventListener('keydown',e=>{if(e.key==='Enter')bpSend();});

/* ================= ZO LIVE COMMANDS (mesh parity with the Telegram bot) ================= */
const ZO_MINTS=(typeof TOKENS!=='undefined')?Object.fromEntries(TOKENS.map(t=>[t.sym,t.mint])):{
 SMRT:'BkDKvbUQpr17c5w3zZzEA1VvpirgWcKuMEHtiYGEaP1c',
 SMF:'2mEtt2musbjuRcsyyG29xjeTqJX4ehXBQdFLmZd9dG6N',
 SMC:'5aEQU6za19QDn8LFHpL5xRzvAgPP2kzFbCviP6pWt63N'};
const ZO_SUPA_URL='https://dezhsrzymylqpzdtymij.supabase.co';
const ZO_SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlemhzcnp5bXlscXB6ZHR5bWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjkwMTIsImV4cCI6MjA4OTQ0NTAxMn0.N3PvKyT-SGBaxw95VAllLGuKHGcxXctnzDJ-5469yvs';
const ZO_RANKS=[[1000,'SOVEREIGN 👑'],[600,'STRATEGIST 🧭'],[250,'OPERATOR ⚡'],[0,'INITIATE 🌱']];
function zoJupLink(mint){const ref=(window.SMARTZ_SITE_CONFIG||{}).jupiterRef;return ref?ref:'https://jup.ag/tokens/'+mint;}
function zoRankFor(kp){for(const [min,name] of ZO_RANKS)if(kp>=min)return name;return 'INITIATE 🌱';}
function zoTyping(){
  const c=document.getElementById('bp-chat');
  c.insertAdjacentHTML('beforeend','<div class="bmsg" id="zo-typing"><div class="bav">🔥</div><div class="bt zb-typing">ZO is scanning…<span class="zb-dots"><i>.</i><i>.</i><i>.</i></span></div></div>');
  bpScroll();
}
function zoUntype(){const t=document.getElementById('zo-typing');if(t)t.remove();}
function zoFail(){zoUntype();zoSay('⚠ Feed unreachable — the mesh didn\'t answer. Try again in a moment.');}
function zoFmtNum(n){n=Number(n)||0;if(n>=1e9)return (n/1e9).toFixed(2)+'B';if(n>=1e6)return (n/1e6).toFixed(2)+'M';if(n>=1e3)return (n/1e3).toFixed(1)+'K';return n.toFixed(2);}
function zoFmtPrice(p){p=Number(p)||0;return p<0.01?Number(p).toPrecision(4):p.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6});}

function zoCmdPrice(sym){
  const syms=sym?([sym.toUpperCase()]):Object.keys(ZO_MINTS);
  for(const s of syms){
    const mint=ZO_MINTS[s];
    if(!mint){zoSay('Unknown token <b>'+s+'</b> — try <span class="zb-mono">/price SMRT</span>, <span class="zb-mono">SMF</span> or <span class="zb-mono">SMC</span>.');continue;}
    fetch('https://api.dexscreener.com/latest/dex/tokens/'+mint)
      .then(r=>r.json())
      .then(d=>{
        const pairs=(d.pairs||[]).filter(p=>p.chainId==='solana');
        if(!pairs.length)throw new Error('no pairs');
        pairs.sort((a,b)=>((b.liquidity||{}).usd||0)-((a.liquidity||{}).usd||0));
        zoUntype();
        const p=pairs[0],chg=(p.priceChange||{}).h24||0,up=chg>=0;
        zoSay('<div class="zb-head">'+s+' · live price</div>'+
          '<div class="zb-mono">$'+zoFmtPrice(p.priceUsd)+' <span class="'+(up?'zb-up':'zb-dn')+'">'+(up?'▲':'▼')+' '+Math.abs(chg).toFixed(2)+'% 24h</span></div>'+
          '<div class="zb-mono">liq $'+zoFmtNum((p.liquidity||{}).usd)+' · vol $'+zoFmtNum((p.volume||{}).h24)+'</div>'+
          '<a class="zb-link" href="'+zoJupLink(mint)+'" target="_blank" rel="noopener">Trade '+s+' on Jupiter ↗</a>');
      })
      .catch(()=>zoFail());
  }
}
function zoCmdRank(w){
  if(!w)w=(typeof walletKey!=='undefined'&&walletKey)?walletKey:null;
  if(!w){zoSay('No wallet linked and none given. Use <span class="zb-mono">/rank &lt;wallet&gt;</span> or connect your wallet first.');return;}
  fetch(ZO_SUPA_URL+'/rest/v1/kp_ledger?wallet=eq.'+encodeURIComponent(w)+'&select=kp_total&order=created_at.desc&limit=1',
    {headers:{apikey:ZO_SUPA_KEY,Authorization:'Bearer '+ZO_SUPA_KEY}})
    .then(r=>r.json())
    .then(rows=>{
      zoUntype();
      const kp=(rows&&rows.length&&rows[0].kp_total)||0;
      zoSay('<div class="zb-head">KP ledger · '+w.slice(0,4)+'…'+w.slice(-4)+'</div>'+
        '<div class="zb-mono">KP <span class="zb-up">'+kp+'</span> · rank '+zoRankFor(kp)+'</div>'+
        '<div class="zb-dim">next rungs: ⚡250 · 🧭600 · 👑1000</div>');
    })
    .catch(()=>zoFail());
}
function zoCmdJourney(){
  zoSay('<div class="zb-head">The KP journey</div>'+
    '<div class="zb-mono">🌱 INITIATE — 0 KP</div>'+
    '<div class="zb-mono">⚡ OPERATOR — 250 KP</div>'+
    '<div class="zb-mono">🧭 STRATEGIST — 600 KP</div>'+
    '<div class="zb-mono">👑 SOVEREIGN — 1000 KP</div>'+
    '<div class="zb-dim">Earn KP by running the Tunnel, finishing Academy lessons, trading on the Exchange, building your city, and forging sigils. Every action on the mesh feeds your ledger.</div>');
}
function zoCmdHelp(){
  zoSay('<div class="zb-head">ZO commands</div>'+
    '<div class="zb-mono">/price [SMRT|SMF|SMC] — live triad prices</div>'+
    '<div class="zb-mono">/rank &lt;wallet&gt; — KP &amp; rank (uses linked wallet)</div>'+
    '<div class="zb-mono">/journey — rank ladder &amp; how to earn</div>'+
    '<div class="zb-mono">/help — this list</div>'+
    '<div class="zb-dim">…or just ask me anything in plain words.</div>');
}
function zoCommand(q){
  const m=q.match(/^\/(\w+)(?:\s+(.+))?$/);
  if(!m)return false;
  const cmd=m[1].toLowerCase(),arg=(m[2]||'').trim();
  if(['price','rank','journey','help'].includes(cmd))zoTyping();
  switch(cmd){
    case 'price':zoCmdPrice(arg);break;
    case 'rank':zoCmdRank(arg);break;
    case 'journey':zoUntype();zoCmdJourney();break;
    case 'help':zoUntype();zoCmdHelp();break;
    default:zoSay('Unknown command <span class="zb-mono">/'+cmd+'</span> — try <span class="zb-mono">/help</span> for what I can run.');
  }
  return true;
}
/* route slash commands before normal intent parsing */
const _bpSend=bpSend;
bpSend=function(){
  const inp=document.getElementById('bp-input'),q=inp.value.trim();
  if(!q)return;
  if(q.startsWith('/')){inp.value='';userSay(q);setTimeout(()=>zoCommand(q),200);return;}
  _bpSend();
};
/* quick-command chips */
document.getElementById('bp-quick').insertAdjacentHTML('beforebegin',
 '<div class="bp-quick zb-cmds">'+['/price','/rank','/journey','/help'].map(c=>'<span class="q zb-chip" onclick="bpAsk(\''+c+'\')">'+c+'</span>').join('')+'</div>');

/* ================= GUIDED TOURS ================= */
const TOURS={
 hq:{name:'🏛 HQ Orientation',desc:'Your command center in 4 steps',xp:30,steps:[
  {sel:'#win-hq .banner',t:'This is SmartzOS — THE SMART TRIAD ECOSYSTEM. Everything boots from here.'},
  {sel:'#win-hq .grid2',t:'Live vitals: SOL balance, SOL price, your Syndicate rank, and game credits. All update in real time.'},
  {sel:'#win-hq #rankLadder',t:'The rank ladder is the single source of truth — connect a wallet, hold triad tokens, and climb: Tunnel-Cleared → Bladebearer → Sentinel → Coherent.'},
  {sel:'#win-hq #hqlog',t:'The status feed narrates everything the mesh does. Watch this when you swap, forge, or trade — the system talks back.'}]},
 game:{name:'🌀 Tunnel Run',desc:'Learn swaps risk-free',xp:30,steps:[
  {sel:'#win-game .tabs',t:'Three wings: Tunnel Run (learn), Trading Post (market practice), Fusion Lab (combining shards into sigils).'},
  {sel:'#pane-run .card',t:'Advance through 5 stages. Volatility storms cost integrity; cleared stages pay shards and credits. Finish a run and a wallet path opens.'},
  {sel:'#g-credits',t:'These SMC game credits are the universal currency — earned everywhere, spent in the City, Exchange, and Forge.'}]},
 ge:{name:'🏦 Exchange Mastery',desc:'Offer-driven trading',xp:40,steps:[
  {sel:'#geList',t:'Pick any asset — shards, sigils, city materials. Prices move with real trade pressure, narrated by SYLK-9.'},
  {sel:'#win-ge .tabs',t:'Market = place offers. My Offers = your 6+ escrow slots (rank grants more). P2P = member-to-member mesh board.'},
  {sel:'#geTrade',t:'Set quantity and YOUR price. Competitive offers fill faster. Every fill carries AEGIS-5 clearance — trust is built in.'}]},
 city:{name:'🏙 City Builder',desc:'Production engine basics',xp:40,steps:[
  {sel:'#win-city .city-meta',t:'Level, population, power, governance harmony, and credit rate per tick. Power shortages halve output — build plants first.'},
  {sel:'#cityGrid',t:'Tap any empty plot to build. Same-type neighbors boost each other ×1.5 — plan your districts like a real city.'},
  {sel:'#ct-syn',t:'Hold triad tokens on-chain and matching buildings produce ×1.25. Your wallet literally powers your city.'}]},
 swap:{name:'⚡ First Real Swap',desc:'Jupiter terminal walkthrough',xp:40,steps:[
  {sel:'#win-swap .card',t:'Quick-launch buttons route the terminal to SMRT, SMF, or SMC instantly. This is real Solana mainnet.'},
  {sel:'#integrated-terminal',t:'Inside the terminal: connect your wallet, set the amount, review the route Jupiter finds, and sign. Fees are fractions of a cent — keep 0.02 SOL reserve.'},
  {sel:'#jup-note',t:'Every swap you arm feeds the Synergy Bus — rank perks, quests, and the Advisor all react. Practice first in Paper Trading if you want zero risk.'}]},
 academy:{name:'🎓 Academy Path',desc:'From zero to token launch',xp:30,steps:[
  {sel:'#win-academy .banner',t:'Tuition is paid in triad holdings — deeper tracks open for SMF, SMRT, and full-triad holders.'},
  {sel:'#acLessons',t:'Each lesson ends with a check. Correct answers pay XP and credits — rank multiplies the XP.'},
  {sel:'#tab-ac-forge',t:'The Token Forge tab is a hands-on launch rehearsal with real Solana CLI commands. Graduate here and you can launch for real.'}]},
};
const TOURKEY='smartz_tours_v1';
let tourDone=JSON.parse(localStorage.getItem(TOURKEY)||'{}');
let tour=null;
function renderTours(){
  const el=document.getElementById('bp-tours');
  el.innerHTML='<div style="font-size:11px;color:var(--dim);margin-bottom:10px">Guided spotlight walkthroughs — finish each for XP &amp; credits.</div>'+
    Object.keys(TOURS).map(k=>{
      const t=TOURS[k],done=tourDone[k];
      return '<div class="tour-item '+(done?'done':'')+'" onclick="startTour(\''+k+'\')">'+
        '<span style="font-size:18px">'+(done?'✅':t.name.split(' ')[0])+'</span>'+
        '<span class="ti"><b>'+t.name+'</b><div class="tt2">'+t.desc+' · +'+t.xp+' XP</div></span>'+
        '<span style="color:#ff9a3c">▶</span></div>';
    }).join('');
}
function startTour(key){
  const t=TOURS[key];if(!t)return;
  openApp(key==='hq'?'hq':key);
  toggleBuddy(); // close panel
  tour={key:key,steps:t.steps,i:0};
  document.getElementById('tourVeil').style.display='block';
  setTimeout(()=>tourStep(),400);
}
function tourStep(){
  document.querySelectorAll('.spotlight').forEach(e=>e.classList.remove('spotlight'));
  const tip=document.getElementById('tourTip');
  if(tour.i>=tour.steps.length){endTour(true);return;}
  const s=tour.steps[tour.i];
  const el=document.querySelector(s.sel);
  if(!el){tour.i++;tourStep();return;}
  el.classList.add('spotlight');
  if(el.scrollIntoView)el.scrollIntoView({block:'center',behavior:'smooth'});
  const r=el.getBoundingClientRect();
  tip.style.display='block';
  let left=Math.min(Math.max(10,r.left),window.innerWidth-300);
  let top=r.bottom+12;if(top+140>window.innerHeight)top=Math.max(10,r.top-160);
  tip.style.left=left+'px';tip.style.top=top+'px';
  tip.innerHTML='<div class="tt-step">'+TOURS[tour.key].name+' — '+(tour.i+1)+'/'+tour.steps.length+'</div>'+
    '<div>'+s.t+'</div><div class="tt-btns">'+
    '<button onclick="endTour(false)">Skip</button>'+
    '<button class="primary" onclick="tour.i++;tourStep()">'+(tour.i===tour.steps.length-1?'Finish ✓':'Next →')+'</button></div>';
}
function endTour(finish){
  document.querySelectorAll('.spotlight').forEach(e=>e.classList.remove('spotlight'));
  document.getElementById('tourTip').style.display='none';
  document.getElementById('tourVeil').style.display='none';
  if(finish&&tour){
    const key=tour.key,xp=TOURS[key].xp;
    if(!tourDone[key]){
      tourDone[key]=true;localStorage.setItem(TOURKEY,JSON.stringify(tourDone));
      AC.xp+=xp;G.credits+=xp;saveAC();saveGame();renderGame();
      notify('🗺 Tour complete',TOURS[key].name+' — +'+xp+' XP & credits','ok');
      log('Guided tour completed: '+TOURS[key].name,'ok');
      if(typeof SMARTZ_BUS!=='undefined')SMARTZ_BUS.emit('tour.done',{tour:key});
    }
    zoTip('Tour finished — nicely done. Want another? I have '+Object.keys(TOURS).filter(k=>!tourDone[k]).length+' left in the archive.');
  }
  tour=null;
}

/* ================= CONTEXT TIPS ================= */
const APP_TIPS={
 hq:'Welcome to HQ. The status feed on the right narrates everything — keep an eye on it as you use other apps.',
 game:'The Tunnel teaches real swap mechanics with zero risk. Pro tip: Tauron Shards are volatile — Koda Shards are stable. That lesson is free here and expensive out there.',
 ge:'Exchange tip: offers priced near mid fill fastest. Far-off offers get flagged by AEGIS-5. Watch SYLK-9\'s reads in the wire.',
 city:'City tip: power first, habitats second, production third. And never demolish inside the 7-tick window — the 7-Day Rule costs you 25 harmony.',
 swap:'This is real mainnet. Start small. If you want zero-risk practice first, I can open Paper Trading for you.',
 academy:'Quizzes pay XP and credits — and your rank multiplies XP. Bladebearer gets 1.5×, Coherent 2×.',
 paper:'Paper trades get a full Resonance autopsy when you close them. ZORAN always speaks last — read his line carefully.',
 trigger:'Set a target and walk away — the mesh watches prices so you don\'t have to. DCA is KODA-7\'s favorite discipline.',
 economy:'This is the map of the whole economy. The Full Circuit quest here pays 500 credits for touching every system.',
 vault:'These three tokens gate the whole OS. SMF opens the Sanctum, SMRT makes you Sentinel, all three make you Coherent.',
};
const seenTips=JSON.parse(localStorage.getItem('smartz_tips')||'{}');
const _openApp8=window.openApp;
window.openApp=function(id){
  _openApp8(id);
  if(APP_TIPS[id]&&!seenTips[id]){
    seenTips[id]=true;localStorage.setItem('smartz_tips',JSON.stringify(seenTips));
    setTimeout(()=>zoTip('💡 <b>'+id.toUpperCase()+' tip:</b> '+APP_TIPS[id]),800);
  }
};
function renderTips(){
  const el=document.getElementById('bp-tips');
  const b=SMARTZ_STATE.balances,tips=[];
  if(!walletKey)tips.push('🔗 Connect a wallet — half the OS sleeps until I can see your triad balances.');
  if(walletKey&&b.SMF<=0)tips.push('🐂 No SMF detected. The Inner Sanctum, Bladebearer rank, and 8 GE slots are one small buy away.');
  if(walletKey&&b.SMRT>0&&b.SMF>0&&b.SMC<=0)tips.push('🔥 You\'re one token from Coherent — SMC completes the triad and doubles your Academy XP.');
  if(G.credits>200&&CITY.tiles.filter(t=>t).length<3)tips.push('🏙 You\'re credit-rich and district-poor. Deploy into Triad City — idle credits produce nothing.');
  if(G.artifacts===0&&G.runs>0)tips.push('⚗ You have shards from runs but no sigils. The Fusion Lab combines 3-of-a-kind — that\'s where the value concentrates.');
  if(AC.xp<60)tips.push('🎓 Academy Track 1 is free and pays credits. Four lessons, twenty minutes, real Solana knowledge.');
  if(!MESH.stats.questDone)tips.push('⛓ The Full Circuit quest pays 500 credits — check your progress in the Synergy Mesh.');
  if(!tips.length)tips.push('◈ You\'re running tight, operator. Consider the weekly DCA discipline or chasing the leaderboard bracket.');
  el.innerHTML='<div style="font-size:11px;color:var(--dim);margin-bottom:10px">Personalized for your current state:</div>'+
    tips.map(t=>'<div class="bmsg"><div class="bav">🔥</div><div class="bt">'+t+'</div></div>').join('');
}
/* buddy reacts to big bus events */
if(typeof SMARTZ_BUS!=='undefined'){
  SMARTZ_BUS.on('tunnel.clear',()=>zoTip('🌀 Tunnel cleared! Next move: connect a wallet to claim on-chain rank, or hit the Academy.'));
  SMARTZ_BUS.on('forge',d=>{if(d.out==='trinityCore')zoTip('💠 TRINITY CORE forged. KODA-7 bows. ZORAN routes. Now forge it on-chain — hold the full triad.');});
  SMARTZ_BUS.on('tour.done',()=>{});
}
/* greeting on first load */
setTimeout(()=>{
  zoSay('🔥 I\'m <b>ZO</b> — your Operator Envoy, routed through Zoran. I know every system in this OS and I execute actions for you. Ask me anything, or tap a tour to learn by walking.');
  if(!localStorage.getItem('smartz_onboarded'))document.getElementById('buddyFab').classList.add('has-tip');
},6000);
log('v4.3 loaded: ZO Buddy + guided tour system','info');
