/* ============ SmartzOS v4.1 — Smartz Academy + Token Forge + Comfort ============ */
/* Learn Solana & token building. Tuition = triad holdings. ZORAN speaks last. */

/* ---------- LESSON TRACKS ---------- */
/* gate: none | SMF (Bladebearer) | SMRT (Sentinel) | TRIAD (Coherent) */
const TRACKS=[
 {name:'Track 1 · Solana Foundations',gate:null,lessons:[
  {t:'What is Solana?',d:'A high-speed blockchain: ~400ms blocks, fees under a cent. Unlike Ethereum, Solana runs accounts-based state with Proof of History ordering. Everything you will build — tokens, NFTs, DeFi — lives in accounts.',
   q:'What orders transactions on Solana?',o:['Proof of Work','Proof of History','Round-robin validators'],a:1,xp:20},
  {t:'Wallets & Keypairs',d:'Your wallet is a keypair: a public key (address, safe to share) and a secret key (never share). Phantom/Solflare hold these for you and sign transactions when you approve.',
   q:'What must you NEVER share?',o:['Public key','Secret/recovery phrase','Transaction ID'],a:1,xp:20},
  {t:'Accounts & Rent',d:'Solana stores everything in accounts, and accounts pay rent in SOL. Every token you hold lives in an Associated Token Account (ATA) owned by your wallet.',
   q:'Where do your SPL tokens actually live?',o:['Inside the mint','In an ATA owned by your wallet','In the wallet app on your phone'],a:1,xp:25},
  {t:'Transactions & Fees',d:'Transactions are bundles of instructions signed by your keypair. You need a little SOL for fees — always keep ~0.02 SOL reserve so swaps never stall.',
   q:'Why keep a SOL reserve?',o:['Staking rewards','Transaction fees','It makes tokens faster'],a:1,xp:20},
 ]},
 {name:'Track 2 · Token Anatomy (🐂 SMF required)',gate:'SMF',lessons:[
  {t:'What is an SPL Token?',d:'A token is a Mint account: supply, decimals, and authorities. SMRT, SMF, and SMC are all SPL tokens — the same standard you will build with.',
   q:'What defines a token on Solana?',o:['A Mint account','A website','A validator vote'],a:0,xp:30},
  {t:'Mint & Freeze Authority',d:'Mint authority can create new supply — renounce it for a fixed supply. Freeze authority can lock accounts — renounce it so holders trust you. The triad tokens renounced theirs.',
   q:'Why renounce mint authority?',o:['Lower fees','Proves supply is fixed','Faster transfers'],a:1,xp:30},
  {t:'Decimals & Supply',d:'Decimals decide divisibility (9 is standard). 1,000,000,000 base units with 9 decimals = 1 whole token. Getting this wrong at launch is permanent.',
   q:'With 9 decimals, 1 token equals:',o:['1,000 base units','1,000,000,000 base units','9 base units'],a:1,xp:30},
  {t:'Metadata (Name, Symbol, Image)',d:'Metaplex metadata attaches your name, symbol, and image to the mint. This is what wallets and Jupiter display — SMRT\'s bear, SMF\'s bull, SMC\'s phoenix all live here.',
   q:'Which standard attaches name/symbol/image?',o:['Metaplex','SPL-2022 only','Serum'],a:0,xp:30},
 ]},
 {name:'Track 3 · Liquidity & Listing (🐻 SMRT required)',gate:'SMRT',lessons:[
  {t:'Liquidity Pools',d:'A pool pairs your token with SOL/USDC. Price = ratio of the two sides. Add liquidity and your token becomes tradable; remove it and trading dies. This is the pool Whale Watch monitors.',
   q:'In a pool, price comes from:',o:['The token website','The ratio of both sides','Jupiter admin'],a:1,xp:35},
  {t:'Jupiter Routing',d:'Jupiter does not hold liquidity — it routes across every pool to find your best price. That is why the SmartzOS terminal can swap anything into the triad.',
   q:'Jupiter is a:',o:['Liquidity pool','DEX aggregator/router','Token mint'],a:1,xp:35},
  {t:'Slippage & Price Impact',d:'Big orders move the pool ratio — that movement is your cost. The Liquidity Tunnel and the Exchange taught you this; now you know the mechanics underneath.',
   q:'Price impact grows when:',o:['Order is big vs pool depth','Fees are low','Decimals are 9'],a:0,xp:35},
  {t:'Pools Are Vaults, Not Sinkholes',d:'Adding liquidity to a pair like SMC/USDC does not burn or lose your tokens — it deploys them into an automated market-making vault that executes swaps for every buyer and seller. And the vault pays you: every trade through the pool automatically routes a cut of the volume to liquidity providers via adaptive trading fees (1.00%+). When you see a lock icon on Orca or Jupiter, read it correctly — that capital is not frozen or gone, it is ACTIVELY WORKING: providing price support, enabling bigger swaps, and stabilizing market caps across SMC, SMF and SMRT. Idle tokens in a wallet earn nothing; deployed tokens farm the whole market.',
   q:'A lock icon on an Orca position means the capital is:',o:['Gone forever','Actively deployed providing liquidity and earning fees','Frozen by Jupiter admins'],a:1,xp:35},
  {t:'LP Position NFTs — Exit Without Draining',d:'On modern Solana AMMs, your liquidity position is minted as a Concentrated Liquidity NFT in your wallet. That NFT IS the position: it represents your pooled token balance plus all real-time accrued trading fees. This creates two very different exits. The destructive one: unpooling — withdrawing your tokens pulls depth out of the market, weakening the price floor for everyone. The value-preserving one: transfer or trade the LP NFT itself — ownership of the position (and its entire passive yield stream) changes hands while NOT ONE CENT of liquidity leaves the pool. The floor stays solid, trades keep executing, the buyer takes over the income. Hold, farm the volume, or trade the NFT — just keep liquidity active and let volume build the yield.',
   q:'Trading your LP NFT instead of unpooling:',o:['Drains the pool but pays more','Keeps all liquidity in the market while transferring ownership of the position and its yield','Is not possible on Solana'],a:1,xp:35},
  {t:'The Impossible Triangle & Soft-Money Decays',d:'Every monetary system — nation or protocol — faces the trilemma: you cannot simultaneously fix the exchange rate, allow free capital flow, and run sovereign monetary policy. Pick two, sacrifice one. Soft-money regimes paper over it by printing: capacity looks funded, but currency strength decays and savings flee toward hard utility. The triad is engineered as the answer: SMRT anchors stability (the Shield — staking and governance, a reason to hold through storms), SMF builds capacity (the Sword — utility, burns, execution speed), and SMC routes value between them (Coherence). The lesson underneath the lore: assets that DO something cannot be printed into worthlessness. Hold utility, not promises.',
   q:'The Impossible Triangle says no system can have all three of:',o:['Fixed exchange rate, free capital flow, sovereign monetary policy','Speed, low fees and unlimited supply','Staking, burning and routing'],a:0,xp:25,kp:25},
 ]},
 {name:'Track 4 · Token Forge Mastery (◈ full triad required)',gate:'TRIAD',lessons:[
  {t:'Deploy Your Token (Real Steps)',d:'The real build path, exactly as the Syndicate did it:',
   code:'# 1. Create the mint\nspl-token create-token --decimals 9\n\n# 2. Create your token account\nspl-token create-account <MINT>\n\n# 3. Mint the supply\nspl-token mint <MINT> 1000000000\n\n# 4. Renounce authorities (trust)\nspl-token authorize <MINT> mint --disable\nspl-token authorize <MINT> freeze --disable\n\n# 5. Attach metadata (name/symbol/image)\n# via Metaplex: metaboss or token metadata program',
   q:'Which command fixes supply forever?',o:['create-account','authorize mint --disable','mint'],a:1,xp:50},
  {t:'Launch Checklist',d:'Before your token meets the world: supply fixed, authorities renounced, metadata live, pool seeded with locked LP, community briefed. Then — and only then — route through Jupiter. The Forge simulator below walks you through it hands-on.',
   q:'What comes LAST in a launch?',o:['Renounce authorities','Seed + lock liquidity','List on a website'],a:1,xp:50},
 ]},
];
const ACKEY='smartz_academy_v1';
let AC=loadAC();
function loadAC(){try{const a=JSON.parse(localStorage.getItem(ACKEY));if(a)return a;}catch(e){}return {done:{},xp:0};}
function saveAC(){localStorage.setItem(ACKEY,JSON.stringify(AC));}
function gateOpen(gate){
  if(!gate)return true;
  const b=SMARTZ_STATE.balances;
  if(gate==='SMF')return b.SMF>0;
  if(gate==='SMRT')return b.SMRT>0;
  if(gate==='TRIAD')return b.SMF>0&&b.SMRT>0&&b.SMC>0;
  return true;
}
function gateLabel(g){
  return {'SMF':'🐂 SMF holders (Bladebearer)','SMRT':'🐻 SMRT holders (Sentinel)','TRIAD':'◈ Full Triad (Coherent)'}[g];
}

/* ---------- WINDOW ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-academy" style="top:60px;left:160px;width:620px;height:640px">
  <div class="titlebar"><span>🎓</span><span class="ttl">Smartz Academy — Learn Solana, Build Tokens</span>
    <button class="tbtn" onclick="maxWin('win-academy')">□</button><button class="tbtn" onclick="closeApp('academy')">✕</button></div>
  <div class="win-body">
    <div class="banner" style="padding:10px 14px;font-size:12px">
      The Academy teaches Solana from zero to launching your own SPL token.
      <b style="color:#e8c15a">Tuition is paid in triad holdings</b> — advanced tracks open only to SMF / SMRT / full-triad holders.
      <span style="float:right;color:#2ee6a8;font-weight:800" id="ac-xp">0 XP</span>
    </div>
    <div class="tabs">
      <div class="tab active" id="tab-ac-learn" onclick="acTab('learn')">📚 Lessons</div>
      <div class="tab" id="tab-ac-forge" onclick="acTab('forge')">⚒ Token Forge</div>
    </div>
    <div id="pane-ac-learn"><div id="acLessons"></div></div>
    <div id="pane-ac-forge" style="display:none">
      <div id="forgeWrap"></div>
    </div>
  </div>
</div>`);
(function(){
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">🎓</div><div class="lbl">Academy</div>';
  d.onclick=()=>openApp('academy');document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>🎓</span><span>Smartz Academy</span>';
  s.onclick=()=>{openApp('academy');document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
  const w=document.getElementById('win-academy');
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
function acTab(t){
  ['learn','forge'].forEach(x=>{
    document.getElementById('pane-ac-'+x).style.display=x===t?'block':'none';
    document.getElementById('tab-ac-'+x).classList.toggle('active',x===t);
  });
  if(t==='forge')renderForge();
}
function renderAcademy(){
  document.getElementById('ac-xp').textContent=AC.xp+' XP';
  const el=document.getElementById('acLessons');if(!el)return;
  let html='';
  TRACKS.forEach((tr,ti)=>{
    const open=gateOpen(tr.gate);
    html+='<div class="track-h">'+tr.name+(open?' <span class="badge">OPEN</span>':' <span class="badge locked">🔒 '+gateLabel(tr.gate)+'</span>')+'</div>';
    tr.lessons.forEach((l,li)=>{
      const id=ti+'-'+li,done=AC.done[id];
      if(!open){
        html+='<div class="lesson locked"><div class="lh">🔒 '+l.t+'</div><div class="ld">This lesson is still in the Tunnel. Hold '+(tr.gate==='TRIAD'?'the full triad':tr.gate)+' to unlock — the tuition keeps the Syndicate strong.</div></div>';
        return;
      }
      html+='<div class="lesson" id="les-'+id+'"><div class="lh">'+(done?'✅ ':'📖 ')+l.t+' <span class="xp" style="margin-left:auto">+'+l.xp+' XP</span></div>'+
        '<div class="ld">'+l.d+'</div>'+(l.code?'<div class="code-block">'+l.code+'</div>':'');
      if(!done){
        html+='<div class="lq"><div style="font-size:11px;color:#e8c15a;font-weight:700">CHECK: '+l.q+'</div>'+
          l.o.map((o,oi)=>'<button class="quiz-opt" onclick="answer(\''+id+'\','+oi+','+l.a+','+l.xp+')">'+o+'</button>').join('')+'</div>';
      }
      html+='</div>';
    });
  });
  el.innerHTML=html;
}
function answer(id,choice,correct,xp){
  const les=document.getElementById('les-'+id);if(!les||AC.done[id])return;
  const btns=les.querySelectorAll('.quiz-opt');
  if(choice===correct){
    btns[choice].classList.add('right');
    AC.done[id]=true;AC.xp+=xp;
    G.credits+=xp; // XP pays in game credits too
    saveAC();saveGame();renderGame();
    notify('🎓 Academy','Correct — +'+xp+' XP (+'+xp+' credits). '+(AC.xp>=100?'SYLK-9 notes your discipline.':''),'ok');
    log('Academy lesson complete: +'+xp+' XP (total '+AC.xp+')','ok');
    if(AC.xp===200)notify('🎓 Milestone','Solana Foundations cleared. KODA-7: "Depth over complexity. You begin well."','ok');
    // Hamiltonian lesson: +KP and the Zoran lore log
    TRACKS.forEach((tr,ti)=>tr.lessons.forEach((l,li)=>{
      if((ti+'-'+li)===id&&l.kp){
        try{window.awardKP?awardKP(l.kp,'The Impossible Triangle — macro doctrine absorbed'):null}catch(e){}
        setTimeout(()=>notify('🔥 ZORAN — lore log unlocked','"Paper promises decay at the printer\'s whim. Hard utility compounds at the user\'s hand. The triad holds no promises — only function. You understand now why the Shield, the Sword and the Phoenix cannot be printed away."','ok'),1600);
      }
    }));
    setTimeout(renderAcademy,900);
  }else{
    btns[choice].classList.add('wrong');
    notify('Academy','Not quite — re-read the lesson and try again.','err');
    setTimeout(()=>btns[choice].classList.remove('wrong'),1200);
  }
}

/* ================= TOKEN FORGE SIMULATOR ================= */
/* Hands-on token launch walkthrough — gated to TRIAD holders for the final steps */
const FORGE_STEPS=[
  {t:'Name your token',d:'Every token starts with identity. SMRT chose the Bear; SMF the Bull; SMC the Phoenix. Choose yours.',field:'name',ph:'e.g. Nova Coin'},
  {t:'Symbol & mascot',d:'3–5 letters, plus an emoji mascot. This is your flag across wallets and Jupiter.',field:'symbol',ph:'e.g. NOVA'},
  {t:'Supply & decimals',d:'Standard is 9 decimals. Supply is minted once — plan it before launch, it cannot change after authority is renounced.',field:'supply',ph:'e.g. 1000000000'},
  {t:'Mint the supply',d:'The forge executes: create-token → create-account → mint. Watch the exact commands:',code:null},
  {t:'Renounce authorities',d:'The trust ritual. Disable mint + freeze authority — holders must know you can never inflate or freeze them out.',code:null},
  {t:'Attach metadata',d:'Name, symbol, and image bound to the mint via Metaplex — this is what wallets display.',code:null},
  {t:'Seed liquidity',d:'Pair your token with SOL. Price is born from the ratio. Lock the LP — unlocked LP is how rugs happen.',code:null},
  {t:'Route through Jupiter',d:'Final step: get indexed so the aggregator can route trades. Your token is live. The system ascends.',code:null},
];
let FORGE={step:0,name:'',symbol:'',supply:'',deployed:false};
function forgeCmds(f){
  return '# Your launch script ('+(f.symbol||'TOKEN')+')\n'+
  'spl-token create-token --decimals 9\n'+
  '# → mint address: '+fakeMint(f)+'\n'+
  'spl-token create-account '+fakeMint(f).slice(0,12)+'…\n'+
  'spl-token mint '+fakeMint(f).slice(0,12)+'… '+(f.supply||'SUPPLY')+'\n'+
  'spl-token authorize '+fakeMint(f).slice(0,12)+'… mint --disable\n'+
  'spl-token authorize '+fakeMint(f).slice(0,12)+'… freeze --disable';
}
function fakeMint(f){
  let s=(f.symbol||'SMARTZ')+'forge';
  let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  const alpha='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out='';for(let i=0;i<32;i++){out+=alpha[(h+i*7)%alpha.length];}
  return out;
}
function renderForge(){
  const el=document.getElementById('forgeWrap');if(!el)return;
  const triad=gateOpen('TRIAD');
  let html='<div class="card" style="font-size:12px;color:var(--dim)">⚒ A hands-on launch rehearsal — configure, mint, renounce, seed, and list a token the exact way the Syndicate did. '+
    (triad?'<b style="color:#2ee6a8">Coherent operator — full forge access.</b>':'<b style="color:#e8c15a">Steps 7–8 (liquidity & listing) require full triad holdings — the tuition.</b>')+'</div>';
  FORGE_STEPS.forEach((s,i)=>{
    const locked=i>=6&&!triad;
    const state=i<FORGE.step?'done':i===FORGE.step?'cur':'';
    html+='<div class="forge-step '+state+'"><div class="fs-t">'+(i<FORGE.step?'✅ ':locked?'🔒 ':'▶ ')+(i+1)+'. '+s.t+'</div>'+
      '<div class="fs-d">'+s.d+'</div>';
    if(locked)html+='<div class="fs-d" style="color:#e8c15a;margin-top:4px">Hold SMRT + SMF + SMC to unlock launch-critical steps.</div>';
    else if(i===FORGE.step){
      if(s.field){
        html+='<input class="forge-in" id="forge-field" placeholder="'+s.ph+'" value="'+(FORGE[s.field]||'')+'">'+
          '<button class="btn" style="margin-top:8px" onclick="forgeNext()">Confirm →</button>';
      }else{
        html+='<div class="code-block">'+forgeCmds(FORGE)+'</div>'+
          '<button class="btn" style="margin-top:4px" onclick="forgeNext()">Execute step →</button>';
      }
    }
    html+='</div>';
  });
  if(FORGE.step>=FORGE_STEPS.length){
    if(!FORGE.deployed){
      FORGE.deployed=true;G.credits+=200;G.inv.dust=(G.inv.dust||0)+5;saveGame();renderGame();
      notify('⚒ TOKEN FORGED',''+FORGE.symbol+' launched (simulated). +200 credits, +5 Coherence Dust. The system ascends.','ok');
      log('Academy Forge: '+FORGE.name+' ('+FORGE.symbol+') launched in simulation','ok');
    }
    html+='<div class="banner" style="text-align:center"><b style="color:#e8c15a">⚒ '+FORGE.name+' ('+FORGE.symbol+') — LAUNCH COMPLETE</b><br>'+
      '<span style="font-size:11px;color:var(--dim)">You now know every step of a real SPL launch. When you build for real, the triad ecosystem routes for you — list beside SMRT, SMF, and SMC.</span><br>'+
      '<button class="btn ghost" style="margin-top:8px" onclick="FORGE={step:0,name:\'\',symbol:\'\',supply:\'\',deployed:false};renderForge()">↻ Forge another</button></div>';
  }
  el.innerHTML=html;
}
function forgeNext(){
  const s=FORGE_STEPS[FORGE.step];
  if(s.field){
    const v=document.getElementById('forge-field').value.trim();
    if(!v){notify('Token Forge','Fill in the field to continue.','warn');return;}
    FORGE[s.field]=v;
  }
  FORGE.step++;renderForge();
}

/* ================= COMFORT LAYER ================= */
(function(){
  /* settings toggles */
  const set=document.querySelector('#win-settings .win-body');
  if(set)set.insertAdjacentHTML('beforeend',
   `<div class="card"><h4>🛋 Comfort</h4>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:8px;cursor:pointer">
      <input type="checkbox" id="cf-comfort" onchange="setComfort(this.checked)"> Comfort Mode — larger text, calmer glow, easier reading</label>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;cursor:pointer">
      <input type="checkbox" id="cf-calm" onchange="document.body.classList.toggle('calm',this.checked)"> Calm Mode — minimal color intensity</label>
    <div style="font-size:10px;color:var(--dim);margin-top:8px">Comfort settings save automatically.</div></div>`);
  const saved=JSON.parse(localStorage.getItem('smartz_comfort')||'{}');
  if(saved.comfort){document.body.classList.add('comfort');const c=document.getElementById('cf-comfort');if(c)c.checked=true;}
  if(saved.calm){document.body.classList.add('calm');const c2=document.getElementById('cf-calm');if(c2)c2.checked=true;}
})();
function setComfort(on){
  document.body.classList.toggle('comfort',on);
  const s=JSON.parse(localStorage.getItem('smartz_comfort')||'{}');s.comfort=on;
  localStorage.setItem('smartz_comfort',JSON.stringify(s));
}
/* help hints on desktop icons */
const HINTS={'Syndicate HQ':'Your command center — rank, stats, live status feed',
 'Liquidity Tunnel':'The rite-of-passage game. Learn swaps risk-free, earn shards',
 'Jupiter Swap':'Real swaps on Solana via Jupiter — quick-buy SMRT/SMF/SMC',
 'Token Vault':'Live prices and lore for the triad tokens',
 'Inner Sanctum':'Members-only zone. Needs SMF in your wallet',
 'Missions':'Earn SMC credits for learning-by-doing',
 'Grand Exchange':'Player market — place buy/sell offers like a pro',
 'Triad City':'Build districts that produce tokens & materials',
 'Advisor':'Zoran reads your telemetry and gives next-step counsel',
 'Portfolio':'Live USD value of your holdings + achievements',
 'Zoran Shell':'Command-line control of the whole OS',
 'Leaderboard':'Rank-bracketed standings — every tier competes',
 'Whale Watch':'Alerts when big money moves the triad pools',
 'Resonance':'Meet the six agents who run the system',
 'Paper Trading':'Practice trading at real prices with fake SOL',
 'Triggers & DCA':'Limit orders and auto-buys — advanced tools',
 'Academy':'Learn Solana & build your own token'};
document.addEventListener('mouseover',e=>{
  const ic=e.target.closest&&e.target.closest('.desk-icon');
  document.querySelectorAll('.hint-bubble').forEach(b=>b.remove());
  if(!ic)return;
  const name=ic.querySelector('.lbl').textContent;
  const hint=HINTS[name];if(!hint)return;
  const r=ic.getBoundingClientRect();
  const b=document.createElement('div');b.className='hint-bubble';
  b.textContent=hint;b.style.left=Math.min(r.left,window.innerWidth-230)+'px';
  b.style.top=(r.top>60?r.top-44:r.bottom+8)+'px';
  document.body.appendChild(b);
  setTimeout(()=>b.remove(),2600);
});
/* first-run onboarding */
document.body.insertAdjacentHTML('beforeend',`
<div id="onboard"><div class="ob-card">
  <h3>◈ Welcome to the Smart Triad Ecosystem</h3>
  <div style="font-size:12px;color:var(--dim);margin-bottom:10px">Four steps from newcomer to token-builder. Every system here teaches real Solana mechanics.</div>
  <div class="ob-step" onclick="onboardGo('game')"><span class="n">1</span><div><b>Run the Liquidity Tunnel</b><div style="color:var(--dim)">Learn swaps, slippage & firewalls — zero risk</div></div></div>
  <div class="ob-step" onclick="onboardGo('wallet')"><span class="n">2</span><div><b>Connect a Solana wallet</b><div style="color:var(--dim)">Phantom or Solflare — your keypair, your rank</div></div></div>
  <div class="ob-step" onclick="onboardGo('academy')"><span class="n">3</span><div><b>Study at the Academy</b><div style="color:var(--dim)">Solana from zero to SPL token launches</div></div></div>
  <div class="ob-step" onclick="onboardGo('academy-forge')"><span class="n">4</span><div><b>Forge your own token</b><div style="color:var(--dim)">Hands-on launch rehearsal — triad holders unlock full access</div></div></div>
  <button class="btn" style="width:100%;margin-top:10px" onclick="document.getElementById('onboard').classList.remove('show');localStorage.setItem('smartz_onboarded','1')">Enter SmartzOS →</button>
</div></div>`);
function onboardGo(step){
  document.getElementById('onboard').classList.remove('show');
  localStorage.setItem('smartz_onboarded','1');
  if(step==='wallet')connectWallet();
  else if(step==='academy-forge'){openApp('academy');acTab('forge');}
  else openApp(step);
}
setTimeout(()=>{
  if(!localStorage.getItem('smartz_onboarded'))
    setTimeout(()=>document.getElementById('onboard').classList.add('show'),4200); // after splash
},500);

/* hooks */
const _openApp6=window.openApp;
window.openApp=function(id){_openApp6(id);
  if(id==='academy'){renderAcademy();}
  if(id==='members'||id==='swap'||id==='hq')setTimeout(renderAcademy,500); // gates may change
};
renderAcademy();
log('v4.1 loaded: Smartz Academy · Token Forge · Comfort layer','info');
