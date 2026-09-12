/* SmartzOS v5.8 — DeFi Resilience: RPC failover, Jupiter fallback, network status */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};

/* ============ 1. RPC FAILOVER — public mainnet endpoint is rate-limited/blocked in wallet browsers ============ */
const RPCS=[
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
];
let rpcIdx=0, rpcHealthy=false;
window.activeRPC=()=>RPCS[rpcIdx];
async function rpcTry(method,params){
  for(let i=0;i<RPCS.length;i++){
    const url=RPCS[(rpcIdx+i)%RPCS.length];
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params})});
      if(!r.ok)throw new Error('http '+r.status);
      const j=await r.json();
      if(j.error)throw new Error(j.error.message||'rpc error');
      rpcIdx=(rpcIdx+i)%RPCS.length;rpcHealthy=true;
      return j.result;
    }catch(e){/* try next */}
  }
  rpcHealthy=false;
  throw new Error('All RPC endpoints unreachable');
}
// replace the core rpcCall everywhere (balances, burns, staking all ride this)
window.rpcCall=rpcTry;

/* ============ 2. JUPITER RESILIENCE — detect blocked terminal, offer jup.ag fallback ============ */
const _initJupiter=window.initJupiter;
window.initJupiter=function(outMint){
  if(!window.Jupiter||!window.Jupiter.init){
    // terminal script blocked (CSP/ad-block/strict wallet browser) — graceful fallback
    jupInited=true;
    const wrap=$('jup-wrap');
    const t=(window.TOKENS||[]).find(x=>x.mint===outMint)||{sym:'',glyph:''};
    if(wrap)wrap.innerHTML='<div style="text-align:center;padding:34px 18px">'+
      '<div style="font-size:15px;font-weight:700;margin-bottom:8px">⚡ Swap Terminal unavailable here</div>'+
      '<div style="font-size:12px;color:var(--dim);line-height:1.6;margin-bottom:16px">The embedded Jupiter widget was blocked by this browser. You can still swap instantly on jup.ag — same wallet, one tap:</div>'+
      '<a class="btn" style="display:inline-block;padding:12px 22px;text-decoration:none" href="'+((window.SMARTZ_SITE_CONFIG||{}).jupiterRef||'https://jup.ag')+'" target="_blank">Open SOL → '+t.sym+' on Jupiter ↗</a>'+
      '<div style="margin-top:14px"><button class="btn ghost" style="font-size:11px" onclick="retryJupiter(\''+outMint+'\')">↻ Retry embedded terminal</button></div>'+
      '<div style="font-size:10px;color:var(--dim);margin-top:14px">Tip: Phantom/Solflare in-app browsers allow the embedded terminal — some stricter browsers block third-party widgets.</div></div>';
    log('Jupiter widget blocked — jup.ag fallback armed','warn');
    return;
  }
  _initJupiter(outMint);
};
window.retryJupiter=function(outMint){
  jupInited=false;
  const s=document.createElement('script');s.src='https://terminal.jup.ag/main-v3.js';
  s.onload=()=>{log('Jupiter script loaded on retry','ok');window.initJupiter(outMint)};
  s.onerror=()=>{log('Jupiter script still blocked','err');jupInited=true};
  document.head.appendChild(s);
  setTimeout(()=>{if(window.Jupiter&&window.Jupiter.init)window.initJupiter(outMint)},2500);
};
// flag if the initial script tag failed (some browsers block it outright)
setTimeout(()=>{if(!window.Jupiter)log('Jupiter terminal script not detected — fallback ready','warn')},6000);

/* ============ 3. NETWORK STATUS — visible on the Deck hero ============ */
async function netStatus(){
  const el=$('dkWallet');if(!el)return;
  let badge=$('rpcBadge');
  if(!badge){badge=document.createElement('div');badge.id='rpcBadge';badge.style.cssText='font-size:9px;margin-top:3px';el.after(badge)}
  try{
    const t0=Date.now();
    await rpcTry('getHealth',[]);
    badge.innerHTML='<span class="sys-badge on" style="font-size:8px">SOLANA: CONNECTED · '+activeRPC().replace('https://','').split('/')[0]+' · '+(Date.now()-t0)+'ms</span>';
  }catch(e){
    badge.innerHTML='<span class="sys-badge" style="font-size:8px;color:#ff5d7a;border-color:rgba(255,93,122,.5)">SOLANA: RPC UNREACHABLE — balances/swaps degraded</span>';
  }
}
setInterval(()=>{const w=$('win-deck');if(w&&w.classList.contains('open'))netStatus()},20000);
setTimeout(netStatus,4000);

/* ============ 4. BALANCE REFRESH after RPC fix ============ */
setTimeout(()=>{if(window.walletKey){try{loadBalances()}catch(e){}}},5000);

log('v5.8 DeFi resilience — RPC failover (3 endpoints), Jupiter fallback, network status','ok');
})();
