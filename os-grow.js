/* ============ SmartzOS v4.5 — Compliant Growth Pack ============ */
/* Built per architecture compliance review. Rejected by design: forced pairing,
   pre-launch OTC, pay-to-recruit. Everything here is opt-in, listed-only, disclosed. */

const GROWKEY='smartz_grow_v1';
let GROW=loadGrow();
function loadGrow(){try{const g=JSON.parse(localStorage.getItem(GROWKEY));if(g)return g;}catch(e){}
  return {treasury:0,feesCollected:0,bountiesDone:{},pairChoice:null};}
function saveGrow(){localStorage.setItem(GROWKEY,JSON.stringify(GROW));}

/* ================= 1. MEMO-ATTESTED STAKING ================= */
/* Real on-chain attestation: Solana Memo program records the stake commitment.
   Mesh ledger remains the accounting layer (clearly labeled simulated yield). */
const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
async function attestStakeOnChain(amount){
  if(!walletKey||!window.solanaWeb3)return null;
  try{
    const conn=new solanaWeb3.Connection(RPC,'confirmed');
    const owner=new solanaWeb3.PublicKey(walletKey);
    const memoIx=new solanaWeb3.TransactionInstruction({
      keys:[{pubkey:owner,isSigner:true,isWritable:false}],
      programId:new solanaWeb3.PublicKey(MEMO_PROGRAM),
      data:Buffer.from('SMARTZOS:STAKE:'+amount+':SMRT:'+Date.now(),'utf8')
    });
    const tx=new solanaWeb3.Transaction().add(memoIx);
    tx.feePayer=owner;tx.recentBlockhash=(await conn.getLatestBlockhash()).blockhash;
    const signed=await wallet.signTransaction(tx);
    const sig=await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction(sig,'confirmed');
    return sig;
  }catch(e){log('Stake attestation failed: '+(e.message||e),'err');return null;}
}
const _stakeSMRT=window.stakeSMRT;
window.stakeSMRT=async function(){
  const amt=parseInt(document.getElementById('stk-in').value);
  if(!amt||amt<100){notify('Koda Vault','Minimum post: 100 SMRT.','warn');return;}
  if(SMARTZ_STATE.balances.SMRT<amt){notify('Koda Vault','On-chain check: you hold '+SMARTZ_STATE.balances.SMRT+' SMRT.','warn');quickBuy('SMRT');return;}
  _stakeSMRT();
  const sig=await attestStakeOnChain(amt);
  if(sig){
    const el=document.getElementById('stk-status');
    el.innerHTML='✓ Post seasoned — <a href="https://solscan.io/tx/'+sig+'" target="_blank">on-chain attestation '+sig.slice(0,12)+'…</a>';
    log('🛡 Stake attested on-chain: '+sig.slice(0,16)+'…','ok');
    awardKP(15,'On-chain stake attestation signed');
  }
};
/* label staking ledger honestly */
(function(){
  const box=document.querySelector('.stake-box p');if(box)box.insertAdjacentHTML('beforeend',
    '<br><span class="disc-label disc-sim">SIMULATED YIELD</span> <span class="disc-label disc-chain">ON-CHAIN MEMO ATTESTATION</span>');
})();

/* ================= 2. FEE TRANSPARENCY DASHBOARD ================= */
/* Disclosed 2% fee on game exchange trades → visible Syndicate Treasury.
   Destination & distribution disclosed. In-game credits only. */
const GAME_FEE=0.02;
const _buyItemG=window.buyItem,_sellItemG=window.sellItem;
window.buyItem=function(k){
  _buyItemG(k);
  const fee=Math.max(1,Math.floor(Math.ceil(G.prices[k])*GAME_FEE));
  G.credits=Math.max(0,G.credits-fee);GROW.treasury+=fee;GROW.feesCollected+=fee;
  saveGrow();saveGame();
};
window.sellItem=function(k){
  _sellItemG(k);
  const fee=Math.max(1,Math.floor(Math.floor(G.prices[k])*GAME_FEE));
  G.credits=Math.max(0,G.credits-fee);GROW.treasury+=fee;GROW.feesCollected+=fee;
  saveGrow();saveGame();
};
/* inject treasury panel into Economy flow pane */
function injectTreasury(){
  const pane=document.getElementById('pane-ec-flow');if(!pane||document.getElementById('treas-box'))return;
  pane.insertAdjacentHTML('afterbegin',
   `<div class="treas-box" id="treas-box" style="margin-bottom:12px">
      <h4>🏛 SYNDICATE TREASURY — fee transparency</h4>
      <div class="fee-row"><span>Game exchange fee (disclosed)</span><b>2% per trade</b></div>
      <div class="fee-row"><span>Collected all-time</span><b id="treas-col">0 cr</b></div>
      <div class="fee-row"><span>Treasury balance</span><b id="treas-bal">0 cr</b></div>
      <div class="fee-row"><span>Destination</span><b>Community reward pool (missions, bounties, flash events)</b></div>
      <div class="fee-row"><span>Scope</span><b><span class="disc-label disc-sim">IN-GAME CREDITS ONLY — no real assets</span></b></div>
      <div style="font-size:10px;color:var(--dim);margin-top:6px">CONCOURSE: "Fees disclosed are fees trusted. The system ascends."</div>
    </div>`);
}
const _renderEconomy=window.renderEconomy;
window.renderEconomy=function(){
  _renderEconomy();injectTreasury();
  const c=document.getElementById('treas-col'),b=document.getElementById('treas-bal');
  if(c)c.textContent=GROW.feesCollected+' cr';
  if(b)b.textContent=GROW.treasury+' cr';
};

/* ================= 3. OPT-IN PAIRING COUNSEL (post-Forge) ================= */
/* Replaces forced pairing. Presents options openly; triad pairing is one OPTION
   with disclosed incentives. No deployment rights are gated. Ever. */
const _renderForge=window.renderForge;
window.renderForge=function(){
  _renderForge();
  if(FORGE.step>=FORGE_STEPS.length&&!document.getElementById('pair-counsel')){
    document.getElementById('forgeWrap').insertAdjacentHTML('beforeend',
     `<div class="card" id="pair-counsel">
        <h4>⚖ Pairing Counsel — your liquidity, your choice</h4>
        <p style="font-size:11px;color:var(--dim);line-height:1.6;margin-bottom:10px">
        Your token is yours. Pair it against whatever you choose — nothing in this OS gates your deployment.
        Below are the common routes, with the Syndicate's incentives for triad pairing disclosed openly:</p>
        <div class="pair-opt"><div class="po-t">◎ Pair vs SOL</div><div class="po-d">The standard rail. Deepest liquidity, easiest Jupiter indexing. No strings.</div>
          <button class="btn ghost" style="margin-top:6px;font-size:10px" onclick="choosePair('SOL')">Choose SOL pairing</button></div>
        <div class="pair-opt"><div class="po-t">$ Pair vs USDC</div><div class="po-d">Stable denomination — easier price discovery for holders.</div>
          <button class="btn ghost" style="margin-top:6px;font-size:10px" onclick="choosePair('USDC')">Choose USDC pairing</button></div>
        <div class="pair-opt rec"><div class="po-t">◈ Pair vs the Triad <span class="disc-label disc-chain">SYNDICATE INCENTIVE — OPTIONAL</span></div>
          <div class="po-d">Pairing against SMRT/SMF routes your token through the Syndicate mesh: <b>+150 KP bonus</b>, Whale Watch coverage of your pair, and a slot on the P2P board. This is an incentive, not a requirement.</div>
          <button class="btn green" style="margin-top:6px;font-size:10px" onclick="choosePair('TRIAD')">Choose triad pairing (+150 KP)</button></div>
        <div id="pair-result" style="margin-top:8px;font-size:12px"></div>
      </div>`);
  }
  if(GROW.pairChoice){
    const r=document.getElementById('pair-result');
    if(r)r.innerHTML='✓ Counsel recorded: <b style="color:#2ee6a8">'+GROW.pairChoice+' pairing</b> selected for '+(FORGE.symbol||'your token')+'.';
  }
};
function choosePair(p){
  GROW.pairChoice=p;saveGrow();
  if(p==='TRIAD'){
    awardKP(150,'Triad pairing chosen (opt-in incentive)');
    notify('◈ Pairing Counsel','Triad route selected — Whale Watch will cover your pair. Thank you for routing with the Syndicate.','ok');
  }else{
    awardKP(25,'Pairing counsel completed');
    notify('Pairing Counsel',p+' route selected. Clean choice — Jupiter will index it fine.','ok');
  }
  renderForge();
}

/* ================= 4. LISTED-ONLY P2P ENFORCEMENT ================= */
/* Structurally impossible to list unindexed assets: publishOffer validates
   against the known-asset registry (game assets + triad tokens with live pairs). */
const _publishOffer=window.publishOffer;
window.publishOffer=async function(i){
  const o=GE.offers[i];if(!o)return;
  if(!ITEMS[o.item]){notify('AEGIS-5','Asset not in the indexed registry — listing denied. Only publicly indexed assets trade on this board.','err');return;}
  _publishOffer(i);
};
/* disclosure label on P2P pane */
(function(){
  const p=document.getElementById('pane-ge-p2p');if(p)p.insertAdjacentHTML('beforeend',
    '<div style="font-size:10px;color:var(--dim);margin-top:8px">🛡 AEGIS-5 policy: only publicly indexed assets may trade here. No pre-launch or unlisted tokens — that is a hard rule, not a preference.</div>');
})();

/* ================= 5. CONTRIBUTION BOUNTIES (not recruitment) ================= */
const BOUNTIES=[
  {id:'guide',t:'✍ Write a community guide',d:'Draft a how-to for any SmartzOS system (Exchange strategy, city layouts, token launch lessons). Share it with the Syndicate council.',r:'+200 cr · +60 KP'},
  {id:'art',t:'🎨 Create triad fan art',d:'Koda, Tauron, or Zoran artwork for the community gallery. Lore-consistent pieces get featured on the Resonance board.',r:'+150 cr · +40 KP'},
  {id:'teach',t:'🎓 Mentor an Initiate',d:'Walk one new member through the Tunnel and their first Academy lesson — inside the OS, at their pace.',r:'+250 cr · +80 KP'},
  {id:'audit',t:'🛡 AEGIS community audit',d:'Review any system and report a bug, exploit, or unclear disclosure to the council. Integrity reports are the highest-paid work in the Syndicate.',r:'+300 cr · +100 KP'},
];
(function(){
  const body=document.querySelector('#win-missions .win-body');if(!body)return;
  body.insertAdjacentHTML('beforeend',
   `<div class="card"><h4>🤝 Contribution Bounties — build the Syndicate, get paid</h4>
    <div style="font-size:10px;color:var(--dim);margin-bottom:8px">Rewards are for <b>creating value</b> — guides, art, mentoring, audits. Funded by the disclosed treasury fee pool.</div>
    <div id="bountyList"></div></div>`);
})();
function renderBounties(){
  const el=document.getElementById('bountyList');if(!el)return;
  el.innerHTML=BOUNTIES.map(b=>
    '<div class="bounty"><div class="bt">'+b.t+'</div><div class="bd">'+b.d+'</div>'+
    '<div class="br"><span class="xp">'+b.r+'</span>'+
    (GROW.bountiesDone[b.id]?'<span class="badge">CLAIMED ✓</span>'
      :'<button class="btn ghost" style="font-size:10px;padding:5px 12px" onclick="claimBounty(\''+b.id+'\')">Mark Complete</button>')+
    '</div></div>').join('');
}
function claimBounty(id){
  if(GROW.bountiesDone[id])return;
  const b=BOUNTIES.find(x=>x.id===id);
  GROW.bountiesDone[id]=true;
  const cr=parseInt(b.r.match(/\+(\d+) cr/)[1]),kp=parseInt(b.r.match(/\+(\d+) KP/)[1]);
  G.credits+=cr;MESH.stats.earned+=cr;
  GROW.treasury=Math.max(0,GROW.treasury-cr); // paid FROM treasury pool
  saveGrow();saveGame();saveMesh();renderGame();
  awardKP(kp,'Contribution bounty: '+b.t);
  notify('🤝 Bounty paid from Treasury','+'+cr+' credits. The council logs your contribution.','ok');
  log('Bounty claimed: '+b.t+' (treasury −'+cr+' cr)','ok');
  renderBounties();renderEconomy();
}
const _renderMissions2=window.renderMissions;
window.renderMissions=function(){_renderMissions2();renderBounties();};

/* ================= 6. COMPLIANCE & TRANSPARENCY CARD ================= */
(function(){
  const set=document.querySelector('#win-settings .win-body');if(!set)return;
  set.insertAdjacentHTML('beforeend',
   `<div class="card"><h4>⚖ Transparency & Disclosures</h4>
    <div class="compliance">
    <b>Simulated vs on-chain:</b> game credits, city production, GE matching, and paper trading are <span class="disc-label disc-sim">SIMULATED</span>.
    Jupiter swaps, SMC/SMF burns, and stake memo attestations are <span class="disc-label disc-chain">REAL ON-CHAIN</span> and irreversible.<br><br>
    <b>Fees:</b> 2% on game-exchange trades (in-game credits only) → disclosed Syndicate Treasury pool, funding missions & bounties.<br><br>
    <b>Your assets:</b> nothing in this OS custody-locks real tokens. Burns are voluntary and disclosed. Pairing choices after the Token Forge are always yours.<br><br>
    <b>Risk:</b> crypto assets are volatile. Nothing here is financial advice. KODA-7's rule: depth over complexity — size positions you understand.</div></div>`);
})();

/* hooks */
const _openApp10=window.openApp;
window.openApp=function(id){_openApp10(id);
  if(id==='economy')renderEconomy();
  if(id==='missions')renderBounties();
};
renderBounties();
log('v4.5 Compliant Growth loaded — memo-attested staking · fee transparency · opt-in pairing · contribution bounties','info');
log('📡 Hard stops honored: no forced pairing, no unlisted OTC, no pay-to-recruit. Growth with clean hands. — CONCOURSE','info');
