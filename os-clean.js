/* SmartzOS v5.7.2 — Cleanup: one unified first-run (merges onboard + welcome), dedupe pass */
(function(){
'use strict';
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};

/* ---- 1. Kill the legacy academy onboarding overlay — the welcome absorbs it ---- */
localStorage.getItem('smartz_onboarded')||localStorage.setItem('smartz_onboarded','pending');
function killLegacyOnboard(){
  const ob=document.getElementById('onboard');
  if(ob){ob.classList.remove('show');ob.style.display='none'}
  // neutralize its auto-show timer path by satisfying its flag
  if(localStorage.getItem('smartz_onboarded')==='pending')localStorage.setItem('smartz_onboarded','1');
}
setTimeout(killLegacyOnboard,500);
setInterval(killLegacyOnboard,3000); // catch late injections

/* ---- 2. Welcome is now wallet-first (v5.24) — the 4-moves block is retired; ZO guides instead ---- */
function upgradeWelcome(){
  const go=document.getElementById('wcGo');
  if(go&&!go.dataset.ob){go.dataset.ob='1';const f=go.onclick;go.onclick=()=>{localStorage.setItem('smartz_onboarded','1');f&&f()}}
}
const wObs=new MutationObserver(()=>{if(document.getElementById('welcome'))upgradeWelcome()});
wObs.observe(document.body,{childList:true,subtree:true});
setTimeout(upgradeWelcome,1200);

/* ---- 3. Dedupe: Board window pulls from the same guardian source as the deck card ---- */
// (deck card already reads guardians; ensure the full board window refreshes when opened — handled by os-ext2 renderBoard + os-truth fetchGuardianBoard)

/* ---- 4. Combine HUD + wallet awareness: clicking HUD rank with no wallet opens wallet bridge ---- */
setTimeout(()=>{
  const hr=document.getElementById('hudRank');
  if(hr&&!hr.dataset.smart){hr.dataset.smart='1';hr.onclick=()=>{window.walletKey?openApp('members'):connectWallet()}}
},1500);

log('v5.7.2 Cleanup — one unified first-run, legacy popups merged away','ok');
})();
