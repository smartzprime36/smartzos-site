/* ============ SmartzOS v3.3 — On-Chain Pack ============ */
/* Burn-to-Forge · Syndicate Leaderboard · Whale Watch */
/* Requires globals: TOKENS, RPC, SMARTZ_STATE, G, ITEMS, walletKey/provider via connectWallet, wallet,
   openApp, log, notify, quickBuy, renderGame, saveGame, rpcCall */

/* ---------- INJECT WINDOWS ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-board" style="top:80px;left:200px;width:540px;height:560px">
  <div class="titlebar"><span>🏆</span><span class="ttl">Syndicate Leaderboard</span>
    <button class="tbtn" onclick="maxWin('win-board')">□</button><button class="tbtn" onclick="closeApp('board')">✕</button></div>
  <div class="win-body">
    <div class="card">
      <h4>Scoring — credits + artifacts×100 + runs×50 + rank bonus</h4>
      <div id="lbList"></div>
      <button class="btn" onclick="publishScore()">⬆ Publish My Score</button>
      <button class="btn ghost" onclick="renderBoard()">↻ Refresh</button>
      <div style="font-size:10px;color:var(--dim);margin-top:8px" id="lbStatus">Offline mode — add Supabase credentials in Settings to sync the live Syndicate board.</div>
    </div>
    <div class="card">
      <h4>My Standing</h4>
      <div id="lbMe" style="font-size:12px;color:var(--dim)"></div>
    </div>
  </div>
</div>

<div class="win" id="win-whale" style="top:100px;left:280px;width:560px;height:540px">
  <div class="titlebar"><span>🐋</span><span class="ttl">Whale Watch — Triad Surveillance</span>
    <button class="tbtn" onclick="maxWin('win-whale')">□</button><button class="tbtn" onclick="closeApp('whale')">✕</button></div>
  <div class="win-body">
    <div class="card" style="display:flex;gap:14px;align-items:center;padding:10px 14px">
      <div style="font-size:11px;color:var(--dim)">Zoran mesh polls DexScreener every 60s across SMRT · SMF · SMC.<br>Alerts: price shock &gt;5% · volume surge &gt;30% · liquidity shift.</div>
      <button class="btn ghost" style="margin-left:auto" onclick="whaleScan(true)">Scan Now</button>
    </div>
    <div class="card"><h4>Movement Feed</h4><div id="whaleFeed"><div style="color:var(--dim);font-size:12px">Baseline scan pending…</div></div></div>
  </div>
</div>`);

[['board','Leaderboard','🏆'],['whale','Whale Watch','🐋']].forEach(([id,name,icon])=>{
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">'+icon+'</div><div class="lbl">'+name+'</div>';
  d.onclick=()=>openApp(id);document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>'+icon+'</span><span>'+name+'</span>';
  s.onclick=()=>{openApp(id);document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
});
document.querySelectorAll('#win-board,#win-whale').forEach(w=>{
  w.addEventListener('mousedown',()=>w.style.zIndex=++zTop);
  const bar=w.querySelector('.titlebar');
  bar.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('tbtn')||w.classList.contains('max'))return;
    const r=w.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
    const mv=ev=>{w.style.left=(ev.clientX-ox)+'px';w.style.top=Math.max(0,ev.clientY-oy)+'px'};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
});

/* ---------- BURN-TO-FORGE (real SPL burn → on-chain attestation) ---------- */
const BURN_COST=100; // SMC
function injectForge(){
  const fuse=document.getElementById('pane-fuse');if(!fuse||document.getElementById('forge-onchain'))return;
  fuse.insertAdjacentHTML('beforeend',
   `<div class="forge-onchain" id="forge-onchain">
      <h4>🔥 Burn-to-Forge — ON-CHAIN</h4>
      <p style="font-size:12px;color:var(--dim);line-height:1.6;margin:8px 0">
      Sacrifice <b style="color:#ff9a3c">${BURN_COST} SMC</b> to Zoran's routing layer — a real SPL token burn, signed by your wallet on Solana mainnet.
      In return the mesh mints your <b style="color:#2ee6a8">Phoenix Sigil attestation</b>: verifiable proof, forever on-chain.</p>
      <div id="attestStatus" style="margin-bottom:8px"></div>
      <button class="btn" style="background:linear-gradient(135deg,#b35c12,#8a3a0f);box-shadow:0 0 12px rgba(255,154,60,.4)" onclick="burnForge()">🔥 Burn ${BURN_COST} SMC &amp; Forge</button>
      <div style="font-size:10px;color:var(--dim);margin-top:8px">Requires connected wallet holding ≥ ${BURN_COST} SMC + a little SOL for fees. This is a real irreversible burn.</div>
    </div>`);
  renderAttestation();
}
function getAttestations(){try{return JSON.parse(localStorage.getItem('smartz_attest')||'[]')}catch(e){return[]}}
function renderAttestation(){
  const el=document.getElementById('attestStatus');if(!el)return;
  const a=getAttestations();
  el.innerHTML=a.length?a.map(x=>'<span class="att-badge">🔥 Phoenix Sigil · <a href="https://solscan.io/tx/'+x.sig+'" target="_blank" style="color:#2ee6a8">'+x.sig.slice(0,12)+'…</a></span>').join(' ')
    :'<span style="font-size:11px;color:var(--dim)">No attestations yet.</span>';
}
async function burnForge(){
  if(!walletKey||!wallet){notify('Burn-to-Forge','Connect your wallet first.','warn');connectWallet();return;}
  const smc=TOKENS.find(t=>t.sym==='SMC');
  try{
    if(!window.solanaWeb3||!window.splToken)throw new Error('web3 libs not loaded');
    const conn=new solanaWeb3.Connection(RPC,'confirmed');
    const owner=new solanaWeb3.PublicKey(walletKey);
    const mint=new solanaWeb3.PublicKey(smc.mint);
    const res=await rpcCall('getTokenAccountsByOwner',[walletKey,{mint:smc.mint},{encoding:'jsonParsed'}]);
    if(!res.value.length)throw new Error('No SMC token account found in this wallet');
    // pick account with largest balance
    res.value.sort((a,b)=>b.account.data.parsed.info.tokenAmount.uiAmount-a.account.data.parsed.info.tokenAmount.uiAmount);
    const acct=res.value[0],info=acct.account.data.parsed.info.tokenAmount;
    if(info.uiAmount<BURN_COST)throw new Error('Insufficient SMC — you hold '+info.uiAmount+', need '+BURN_COST);
    const raw=BigInt(BURN_COST)*BigInt(10)**BigInt(info.decimals);
    const ix=window.splToken.createBurnInstruction(new solanaWeb3.PublicKey(acct.pubkey),mint,owner,raw);
    const tx=new solanaWeb3.Transaction().add(ix);
    tx.feePayer=owner;
    tx.recentBlockhash=(await conn.getLatestBlockhash()).blockhash;
    notify('Burn-to-Forge','Approve the burn in your wallet…','warn');
    const signed=await wallet.signTransaction(tx);
    const sig=await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction(sig,'confirmed');
    const a=getAttestations();a.push({sig:sig,ts:Date.now(),sym:'SMC',amt:BURN_COST});
    localStorage.setItem('smartz_attest',JSON.stringify(a));
    G.inv.cohSigil=(G.inv.cohSigil||0)+1;G.artifacts++;saveGame();renderGame();
    log('🔥 ON-CHAIN FORGE: '+BURN_COST+' SMC burned — attestation '+sig.slice(0,16)+'…','ok');
    notify('🔥 Phoenix Sigil Forged','Burn confirmed on-chain. Coherence Sigil granted in-game.','ok');
    renderAttestation();
  }catch(e){
    log('Burn-to-forge failed: '+(e.message||e),'err');
    notify('Forge failed',String(e.message||e),'err');
  }
}
/* hook forge card into game render */
if(typeof renderGame==='function'){
  const _rg=renderGame;
  window.renderGame=function(){_rg();injectForge();};
}
injectForge();

/* ---------- LEADERBOARD ---------- */
const COUNCIL=[
  {name:'Koda 🐻',tag:'Sentinel Prime',score:2450},
  {name:'Tauron 🐂',tag:'Blade Marshal',score:1980},
  {name:'Zoran 🔥',tag:'Coherence Router',score:1660},
  {name:'Gemini (Mother AI)',tag:'Architect',score:1420},
  {name:'Claude (Codex Scribe)',tag:'Lorekeeper',score:980},
];
function myScore(){
  const rankBonus={'Coherent':1000,'Sentinel':600,'Bladebearer':400,'Tunnel-Cleared':150,'Unverified':0}[SMARTZ_STATE.rank]||0;
  const attest=getAttestations().length*300;
  return G.credits+G.artifacts*100+G.runs*50+rankBonus+attest;
}
function myName(){return walletKey?('Operator '+walletKey.slice(0,4)+'…'+walletKey.slice(-4)):'Operator (unverified)'}
async function fetchRemoteBoard(){
  const cfg=JSON.parse(localStorage.getItem('smartz_sb')||'null');
  if(!cfg||!cfg.url||!cfg.key)return null;
  try{
    const r=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/smartz_leaderboard?select=name,tag,score&order=score.desc&limit=20',
      {headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key}});
    if(!r.ok)return null;
    return await r.json();
  }catch(e){return null}
}
async function renderBoard(){
  let rows=COUNCIL.slice();
  const remote=await fetchRemoteBoard();
  if(remote)rows=rows.concat(remote.map(r=>({name:r.name,tag:r.tag||'Syndicate',score:r.score,remote:true})));
  rows.push({name:myName(),tag:SMARTZ_STATE.rank,score:myScore(),me:true});
  rows.sort((a,b)=>b.score-a.score);
  document.getElementById('lbList').innerHTML=rows.slice(0,12).map((r,i)=>
    '<div class="lb-row '+(r.me?'me':'')+'"><span class="lb-pos '+(i===0?'p1':i===1?'p2':i===2?'p3':'')+'">'+(i+1)+'</span>'+
    '<span class="lb-name"><b>'+r.name+'</b>'+(r.remote?' <span class="badge" style="font-size:8px">MESH</span>':'')+'<div class="lb-ranktag">'+r.tag+'</div></span>'+
    '<span class="lb-score">'+r.score.toLocaleString()+'</span></div>').join('');
  document.getElementById('lbStatus').textContent=remote?'Live mesh sync active — Supabase board merged.':'Offline mode — add Supabase credentials in Settings to sync the live Syndicate board.';
  document.getElementById('lbMe').innerHTML='Score components — credits '+G.credits+' · artifacts ×100 ('+G.artifacts+') · runs ×50 ('+G.runs+') · rank bonus · attestations ×300 ('+getAttestations().length+')';
}
async function publishScore(){
  const cfg=JSON.parse(localStorage.getItem('smartz_sb')||'null');
  if(!cfg||!cfg.url||!cfg.key){notify('Leaderboard','Offline mode — set Supabase URL + anon key in Settings, then publish.','warn');openApp('settings');return;}
  try{
    const r=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/smartz_leaderboard',{
      method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify({name:myName(),tag:SMARTZ_STATE.rank,score:myScore()})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    notify('Leaderboard','Score published to the Syndicate mesh.','ok');
    renderBoard();
  }catch(e){notify('Publish failed',String(e.message||e),'err');}
}
/* settings fields for Supabase */
(function(){
  const set=document.querySelector('#win-settings .win-body');if(!set)return;
  const cfg=JSON.parse(localStorage.getItem('smartz_sb')||'null')||{url:'',key:''};
  set.insertAdjacentHTML('beforeend',
   `<div class="card"><h4>Live Leaderboard Sync (Supabase)</h4>
    <input class="set-field" id="sb-url" placeholder="https://xxxx.supabase.co" value="${cfg.url}">
    <input class="set-field" id="sb-key" placeholder="anon public key" value="${cfg.key}">
    <button class="btn ghost" onclick="saveSb()">Save Sync Config</button>
    <div style="font-size:10px;color:var(--dim);margin-top:6px">Table: <b>leaderboard</b> (name text pk, tag text, score int8). Anon insert/select policies required.</div></div>`);
})();
function saveSb(){
  localStorage.setItem('smartz_sb',JSON.stringify({url:document.getElementById('sb-url').value,key:document.getElementById('sb-key').value}));
  notify('Settings','Leaderboard sync config saved.','ok');renderBoard();
}

/* ---------- WHALE WATCH ---------- */
let whaleBase=null;
const WFEED_KEY='smartz_whales';
function whaleFeed(){try{return JSON.parse(localStorage.getItem(WFEED_KEY)||'[]')}catch(e){return[]}}
function pushWhale(icon,txt,level){
  const f=whaleFeed();f.unshift({icon:icon,txt:txt,level:level,ts:Date.now()});
  localStorage.setItem(WFEED_KEY,JSON.stringify(f.slice(0,30)));
  renderWhaleFeed();
  notify('🐋 Whale Watch',txt,level==='high'?'err':level==='med'?'warn':'ok');
  log('🐋 '+txt,level==='high'?'err':'warn');
}
function renderWhaleFeed(){
  const el=document.getElementById('whaleFeed');if(!el)return;
  const f=whaleFeed();
  el.innerHTML=f.length?f.map(x=>'<div class="whale-row whale-'+x.level+'"><span class="wi">'+x.icon+'</span>'+
    '<div><div>'+x.txt+'</div><div class="wt">'+new Date(x.ts).toLocaleString()+'</div></div></div>').join('')
    :'<div style="color:var(--dim);font-size:12px">No movement logged yet — the mesh is listening.</div>';
}
async function whaleScan(manual){
  const snap={};
  for(const t of TOKENS){
    try{
      const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+t.mint);
      const j=await r.json();
      const pairs=(j.pairs||[]).sort((a,b)=>((b.liquidity&&b.liquidity.usd)||0)-((a.liquidity&&a.liquidity.usd)||0));
      const p=pairs[0];if(!p)continue;
      snap[t.sym]={price:Number(p.priceUsd)||0,vol:(p.volume&&p.volume.h24)||0,liq:(p.liquidity&&p.liquidity.usd)||0,
        txns:((p.txns&&p.txns.h24&&p.txns.h24.buys)||0)+((p.txns&&p.txns.h24&&p.txns.h24.sells)||0)};
    }catch(e){}
  }
  if(!whaleBase){whaleBase=snap;if(manual)notify('Whale Watch','Baseline locked. The mesh now watches the Triad.','ok');renderWhaleFeed();return;}
  for(const t of TOKENS){
    const a=whaleBase[t.sym],b=snap[t.sym];if(!a||!b||!a.price)continue;
    const dp=(b.price-a.price)/a.price*100;
    const dv=a.vol>0?(b.vol-a.vol)/a.vol*100:0;
    const dl=a.liq>0?(b.liq-a.liq)/a.liq*100:0;
    if(Math.abs(dp)>=5)pushWhale(t.glyph,t.sym+' price shock: '+(dp>0?'+':'')+dp.toFixed(1)+'% since last scan — large orders moving the pool.',Math.abs(dp)>=12?'high':'med');
    else if(dv>=30)pushWhale(t.glyph,t.sym+' volume surge: +'+dv.toFixed(0)+'% 24h volume — whales circling the pool.','med');
    else if(Math.abs(dl)>=10)pushWhale(t.glyph,t.sym+' liquidity shift: '+(dl>0?'+':'')+dl.toFixed(1)+'% — a big LP just '+(dl>0?'entered':'exited')+'.','med');
  }
  whaleBase=snap;
  if(manual)notify('Whale Watch','Scan complete.','ok');
}
setInterval(whaleScan,60000);
setTimeout(whaleScan,6000);

/* ---------- openApp hook ---------- */
const _openApp2=window.openApp;
window.openApp=function(id){_openApp2(id);
  if(id==='board')renderBoard();
  if(id==='whale'){renderWhaleFeed();whaleScan(false);}
};
log('v3.3 on-chain pack loaded: Burn-to-Forge · Leaderboard · Whale Watch','info');
