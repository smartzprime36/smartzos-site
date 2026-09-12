/* ============ SmartzOS v5.28 — Hamiltonian Protocol ============
   1. Token Vault: HARD UTILITY LOCK badge + held/staked vs paper-trade split
   2. Macro-Pulse desktop widget: DEFENSIVE (Koda Guard) / AGGRESSIVE (Tauron Blade)
================================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);

/* ---------- 1. VAULT: HARD UTILITY LOCK ---------- */
function readTrades(){ try{return JSON.parse(localStorage.getItem('smartz_pt_v1')||'{"trades":[]}')}catch(e){return{trades:[]}} }
function readInit(){ try{return JSON.parse(localStorage.getItem('smartz_init_v1')||'{}')}catch(e){return{}} }

function paintVaultMacro(){
  const win=$('win-vault'); if(!win) return;
  const bal=(window.SMARTZ_STATE&&SMARTZ_STATE.balances)||{};
  const held=(bal.SMRT||0)+(bal.SMF||0)+(bal.SMC||0);
  const init=readInit();
  const staked=(init.staked||0);
  const trades=readTrades().trades||[];
  const paper=trades.filter(t=>!t.closed).reduce((s,t)=>s+(t.amount||t.size||0),0);
  const allThree=(bal.SMRT||0)>0&&(bal.SMF||0)>0&&(bal.SMC||0)>0;
  const utility=held+staked;

  /* badge */
  let badge=$('hulBadge');
  if(!badge){
    badge=document.createElement('div'); badge.id='hulBadge'; badge.className='hul-badge';
    const anchor=win.querySelector('.win-body')||win;
    const codex=win.querySelector('.tc-card, .codex, .vault-card');
    if(codex&&codex.parentNode) codex.parentNode.insertBefore(badge,codex.nextSibling);
    else anchor.appendChild(badge);
  }
  badge.className='hul-badge'+(allThree?'':' off');
  badge.innerHTML='<span class="hul-dot"></span><b>'+(allThree?'HARD UTILITY LOCK':'UTILITY LOCK — INCOMPLETE')+'</b><span>'
    +(allThree?'Full triad held — Shield · Sword · Phoenix in vault':'Hold all three triad tokens to seal the lock')+'</span>';

  /* utility vs paper split */
  let ups=$('upsCard');
  if(!ups){
    ups=document.createElement('div'); ups.id='upsCard'; ups.className='ups-card';
    badge.parentNode.insertBefore(ups,badge.nextSibling);
  }
  const tot=utility+paper||1;
  const uPct=Math.round(utility/tot*100);
  ups.innerHTML='<div class="ups-title">UTILITY vs PAPER</div>'
    +'<div class="ups-row"><span>💠 Held triad</span><b>'+held.toLocaleString()+'</b></div>'
    +'<div class="ups-row"><span>🔒 Staked SMRT</span><b>'+staked.toLocaleString()+'</b></div>'
    +'<div class="ups-row paper"><span>📄 Paper-trade exposure</span><b>'+paper.toLocaleString()+'</b></div>'
    +'<div class="ups-bar"><i class="u" style="width:'+uPct+'%"></i><i class="p" style="width:'+(100-uPct)+'%"></i></div>'
    +'<div class="ups-note">Hard utility compounds at the user\'s hand. Paper positions teach — they do not anchor.</div>';
}

/* ---------- 2. MACRO-PULSE WIDGET ---------- */
const STATES={
  VOLATILITY:{cls:'agg',label:'AGGRESSIVE — TAURON BLADE',rec:'Volume surging. Forge capacity — run SMF Overclock triggers and tighten entries.'},
  STABILITY:{cls:'def',label:'DEFENSIVE — KODA GUARD',rec:'Volatility contained. Anchor value — stake SMRT and let the shield compound.'},
  NEUTRAL:{cls:'neu',label:'BALANCED — TRIAD SYNC',rec:'No dominant regime. Hold formation: rebalance triad, run paper drills.'}
};

function paintPulse(){
  const w=$('macroPulse'); if(!w) return;
  const R=(window.REGIME&&REGIME.name)||'NEUTRAL';
  const s=STATES[R]||STATES.NEUTRAL;
  const why=(window.REGIME&&REGIME.why)||'Awaiting market telemetry…';
  w.className=s.cls;
  w.innerHTML='<div class="mp-head"><span>📡</span><b>MACRO-PULSE</b><span class="mp-state">'+s.label+'</span></div>'
    +'<div class="mp-why">'+why+'</div>'
    +'<div class="mp-rec"><b>PROTOCOL RECOMMENDATION</b>'+s.rec+'</div>';
}

function buildPulse(){
  if($('macroPulse')) { paintPulse(); return; }
  const home=$('win-home')||document.querySelector('.oh-wrap');
  const grid=(home&&home.querySelector('.oh-widgets'))||document.querySelector('.oh-widgets');
  if(!grid) return;
  const w=document.createElement('div'); w.id='macroPulse';
  grid.prepend(w);
  paintPulse();
}

/* ---------- boot ---------- */
function boot(){
  buildPulse();
  setInterval(paintPulse,30000);
  /* vault injection: re-paint whenever vault opens */
  const _open=window.openApp;
  if(_open&&!window.__macroWrapped){
    window.__macroWrapped=true;
    window.openApp=function(id){
      const r=_open.apply(this,arguments);
      if(id==='vault') setTimeout(paintVaultMacro,120);
      if(id==='home') setTimeout(buildPulse,120);
      return r;
    };
  }
  if(document.querySelector('#win-vault.open,#win-vault.active')) paintVaultMacro();
  setInterval(()=>{ const v=$('win-vault'); if(v&&(v.classList.contains('open')||v.style.display==='block'||v.offsetParent)) paintVaultMacro(); },15000);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));
else setTimeout(boot,600);
})();
