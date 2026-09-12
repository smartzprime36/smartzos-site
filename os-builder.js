/* ============ SmartzOS v5.0 — The Builder Mesh ============ */
/* Builder Sandbox · Dual-Track Academy + Architect Rank · Learning/Live Firewall ·
   Project Gallery · Resonance Build-Mentors. SMC credits = compute gas. */

const BKEY='smartz_builder_v1';
let BLD=loadBld();
function loadBld(){try{const b=JSON.parse(localStorage.getItem(BKEY));if(b)return b;}catch(e){}
  return {projects:[],shipped:[],execs:0};}
function saveBld(){localStorage.setItem(BKEY,JSON.stringify(BLD));}

/* ================= ZORAN SANDBOX API (what bots can call) ================= */
function makeZoranAPI(proj){
  return {
    prices:()=>Object.assign({},EXT.prices),
    geMid:k=>GE.mid[k],
    credits:()=>G.credits,
    rank:()=>SMARTZ_STATE.rank,
    whale:()=>(typeof whaleFeed==='function'?whaleFeed()[0]:null),
    paperPositions:()=>Object.keys(PT.pos),
    log:m=>projLog(proj,m),
    notify:(t,m)=>notify('🤖 '+proj.name,m||t,'ok'),
    chg:sym=>EXT.chg[sym]||0
  };
}
function projLog(p,m){
  p.logs=p.logs||[];p.logs.unshift(new Date().toLocaleTimeString()+' '+m);
  p.logs=p.logs.slice(0,40);saveBld();
  if(document.getElementById('win-builder').classList.contains('open'))renderBuilder();
}

/* ================= BOT TEMPLATES ================= */
const TEMPLATES=[
 {id:'whale',name:'🐋 Whale Alerter Bot',desc:'Watches the Whale Watch feed and pings you on high-severity pool movement.',gas:1,
  code:'// Whale Alerter — runs every tick\nconst w = Z.whale();\nif(w && w.level === "high"){\n  Z.notify("WHALE", "High-severity movement: " + w.txt);\n} else {\n  Z.log("scan: calm waters");\n}'},
 {id:'momo',name:'📈 Momentum Strategy Bot',desc:'Signals when a triad token\'s 24h momentum crosses your threshold.',gas:1,
  code:'// Momentum signal — edit threshold to taste\nconst THRESH = 10; // % 24h\n["SMRT","SMF","SMC"].forEach(s=>{\n  const c = Z.chg(s);\n  if(c > THRESH) Z.log("SIGNAL: " + s + " momentum +" + c.toFixed(1) + "% — watch for entry");\n  if(c < -THRESH) Z.log("SIGNAL: " + s + " dumping " + c.toFixed(1) + "% — risk check");\n});'},
 {id:'dca',name:'🛡 Auto-DCA Bot',desc:'Logs a disciplined accumulation plan against live prices each cycle.',gas:2,
  code:'// Auto-DCA planner\nconst px = Z.prices();\n["SMRT","SMF","SMC"].forEach(s=>{\n  if(px[s]) Z.log("DCA quote: 0.1 SOL ≈ " + (0.1*px.SOL/px[s]).toFixed(2) + " " + s);\n});'},
 {id:'spread',name:'⚖ Spread Watcher',desc:'Reads Grand Exchange mids and flags assets trading far from base value.',gas:1,
  code:'// GE spread watcher\n["koda","tauron","zoran","dust"].forEach(k=>{\n  const m = Z.geMid(k);\n  Z.log("mid " + k + ": " + m + " cr");\n});'},
 {id:'custom',name:'⚒ Blank Canvas',desc:'Empty bot — write your own logic against the Zoran API.',gas:1,
  code:'// Your bot. Available calls:\n// Z.prices() Z.geMid(k) Z.chg(sym) Z.whale()\n// Z.credits() Z.rank() Z.log(msg) Z.notify(title,msg)\nZ.log("hello from my custom bot — rank: " + Z.rank());'},
];

/* ================= SANDBOX WINDOW ================= */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-builder" style="top:60px;left:140px;width:640px;height:660px">
  <div class="titlebar"><span">⚒</span><span class="ttl">Builder Sandbox — Zoran Compute Mesh</span>
    <button class="tbtn" onclick="maxWin('win-builder')">□</button><button class="tbtn" onclick="closeApp('builder')">✕</button></div>
  <div class="win-body">
    <div class="banner" style="padding:10px 14px;font-size:12px">Build bots, strategies &amp; mini-apps on the Zoran API. <b style="color:#ff9a3c">SMC credits are compute gas</b> — every execution cycle burns 1–2 credits. Ship a project to earn the <span class="arch-badge">⚒ ARCHITECT</span> rank.</div>
    <div class="tabs">
      <div class="tab active" id="tab-b-proj" onclick="bTab('proj')">🤖 My Projects</div>
      <div class="tab" id="tab-b-new" onclick="bTab('new')">➕ New Build</div>
      <div class="tab" id="tab-b-api" onclick="bTab('api')">📡 Zoran API</div>
    </div>
    <div id="pane-b-proj"></div>
    <div id="pane-b-new" style="display:none"></div>
    <div id="pane-b-api" style="display:none">
      <div class="card"><h4>Zoran API — sandbox reference</h4>
        <div class="code-block">Z.prices()        → live USD prices {SOL,SMRT,SMF,SMC}
Z.chg(sym)        → 24h % change for a token
Z.geMid(item)     → Grand Exchange mid price
Z.whale()         → latest whale alert {txt,level,ts}
Z.credits()       → your SMC credit balance
Z.rank()          → your Syndicate rank
Z.log(msg)        → write to bot log
Z.notify(t,msg)   → OS toast from your bot</div>
        <div style="font-size:11px;color:var(--dim);margin-top:8px">Sandbox bots run locally against live data. <b>Firewalled:</b> sandbox builds cannot move real funds — they observe, signal, and simulate. Crossing to live capital requires the AEGIS-5 launch checklist (see SHIP on a running project).</div>
      </div>
    </div>
  </div>
</div>`);
function bTab(t){
  ['proj','new','api'].forEach(x=>{
    document.getElementById('pane-b-'+x).style.display=x===t?'block':'none';
    document.getElementById('tab-b-'+x).classList.toggle('active',x===t);
  });
  if(t==='proj')renderBuilder();
  if(t==='new')renderTemplates();
}
function renderTemplates(){
  document.getElementById('pane-b-new').innerHTML=
    '<div style="font-size:11px;color:var(--dim);margin-bottom:8px">Pick a template — edit the code, name it, deploy. Deploy costs <b style="color:#e8c15a">50 credits</b>.</div>'+
    TEMPLATES.map(t=>'<div class="tpl-card" onclick="newProject(\''+t.id+'\')"><div class="tp-t">'+t.name+'</div><div class="tp-d">'+t.desc+' · gas: '+t.gas+' cr/cycle</div></div>').join('');
}
function newProject(tid){
  const t=TEMPLATES.find(x=>x.id===tid);
  const name=prompt('Name your build:',t.name.replace(/[^\w ]/g,'').trim());
  if(!name)return;
  if(G.credits<50){notify('Builder','Deploy costs 50 credits (compute escrow).','warn');return;}
  G.credits-=50;MESH.stats.spent+=50;
  BLD.projects.push({id:Date.now(),name:name,tpl:tid,code:t.code,gas:t.gas,status:'draft',execs:0,logs:['Build created — '+t.name]});
  saveBld();saveGame();renderGame();
  awardKP(15,'Build deployed to sandbox: '+name);
  log('⚒ Sandbox build: '+name+' ('+t.name+')','info');
  if(typeof SMARTZ_BUS!=='undefined')SMARTZ_BUS.emit('build.deploy',{name:name});
  bTab('proj');
}
function renderBuilder(){
  const el=document.getElementById('pane-b-proj');if(!el)return;
  el.innerHTML=BLD.projects.length?BLD.projects.map((p,i)=>{
    const st=p.status==='running'?'status-run':p.status==='stopped'?'status-stop':'status-draft';
    return '<div class="proj"><div class="pj-t"><span class="status-dot '+st+'"></span> '+p.name+
      '<span style="margin-left:auto;font-size:10px;color:var(--dim)">'+p.status.toUpperCase()+'</span></div>'+
      '<div class="pj-stats"><span>executions: <b>'+p.execs+'</b></span><span>gas: '+p.gas+' cr/cycle</span></div>'+
      '<textarea class="code-editor" style="height:110px;margin-top:8px" onchange="BLD.projects['+i+'].code=this.value;saveBld()">'+p.code.replace(/</g,'&lt;')+'</textarea>'+
      '<div class="bot-log" style="margin-top:6px">'+(p.logs||[]).slice(0,8).map(l=>'<div>'+l+'</div>').join('')+'</div>'+
      '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'+
      (p.status!=='running'?'<button class="btn green" style="font-size:10px" onclick="startBot('+i+')">▶ RUN</button>'
        :'<button class="btn" style="font-size:10px;background:#a8443c" onclick="stopBot('+i+')">⏸ STOP</button>')+
      '<button class="btn ghost" style="font-size:10px" onclick="mentorReview('+i+',\'sylk\')">🕸 SYLK-9 logic review</button>'+
      '<button class="btn ghost" style="font-size:10px" onclick="mentorReview('+i+',\'aegis\')">🛡 AEGIS-5 audit</button>'+
      (p.status==='running'?'<button class="btn" style="font-size:10px;background:linear-gradient(135deg,#b8912f,#8a6d1f)" onclick="shipProject('+i+')">🚀 SHIP</button>':'')+
      '<button class="btn ghost" style="font-size:10px" onclick="BLD.projects.splice('+i+',1);saveBld();renderBuilder()">✕</button></div>'+
      '<div id="mentor-'+i+'"></div></div>';
  }).join(''):'<div style="color:var(--dim);font-size:12px">No builds yet — open the New Build tab and deploy your first bot. KODA-7: "Depth over complexity. Start small, ship working."</div>';
}
/* ================= BOT ENGINE ================= */
let botTimer=null;
function startBot(i){
  const p=BLD.projects[i];p.status='running';saveBld();renderBuilder();
  projLog(p,'Bot started — gas '+p.gas+' cr/cycle');
  ensureEngine();
}
function stopBot(i){BLD.projects[i].status='stopped';saveBld();renderBuilder();}
function ensureEngine(){
  if(botTimer)return;
  botTimer=setInterval(()=>{
    let any=false;
    BLD.projects.forEach(p=>{
      if(p.status!=='running')return;any=true;
      if(G.credits<p.gas){p.status='stopped';projLog(p,'⛽ Out of gas — earn more SMC credits to resume');notify('🤖 '+p.name,'Out of compute gas. Top up credits to resume.','warn');return;}
      G.credits-=p.gas;p.execs++;BLD.execs++;
      try{new Function('Z',p.code)(makeZoranAPI(p));}
      catch(e){projLog(p,'ERROR: '+e.message);}
    });
    if(any){saveBld();saveGame();
      if(document.getElementById('win-builder').classList.contains('open'))renderBuilder();}
  },10000);
}
ensureEngine();

/* ================= RESONANCE BUILD-MENTORS ================= */
function mentorReview(i,who){
  const p=BLD.projects[i],el=document.getElementById('mentor-'+i);if(!el)return;
  const c=p.code.toLowerCase();
  let out='';
  if(who==='sylk'){
    const notes=[];
    if(!c.includes('thresh')&&!c.includes('limit')&&!c.includes('stop'))notes.push('No threshold or guard condition found — a signal without a boundary is noise. Define what "too far" means.');
    if(c.includes('forall')||c.includes('.foreach'))notes.push('Loop coverage looks fine. SYLK reads clean iteration.');
    if(c.includes('notify'))notes.push('Alerting wired. Pattern acknowledged — bots that speak get watched, bots that stay silent get forgotten.');
    if(p.execs<5)notes.push('Few executions logged — patterns need reps before they mean anything. Let it run.');
    if(!notes.length)notes.push('Logic reads disciplined. Thresholds present, output routed. Wealth = discipline.');
    out='<div class="mentor-reply">🕸 <b style="color:#2ee6a8">SYLK-9 — logic review:</b><br>'+notes.join('<br>')+'</div>';
  }else{
    const flags=[];
    if(c.includes('signtransaction')||c.includes('sendraw'))flags.push('⛔ BLOCKER: live transaction signing detected. Sandbox builds must never touch real funds — this stays firewalled.');
    if(c.includes('secret')||c.includes('privatekey')||c.includes('seed'))flags.push('⛔ BLOCKER: key material referenced. Never place secrets in bot code. Ever.');
    if(c.includes('eval('))flags.push('⚠ eval() detected — code that writes code invites code you didn\'t write.');
    if(!c.includes('try')&&!flags.length)flags.push('⚠ No error handling — one bad tick crashes the loop. Wrap risky calls.');
    if(!flags.length)flags.push('✓ No integrity flags. AEGIS CLEARANCE — this build respects the perimeter.');
    out='<div class="mentor-reply aegis">🛡 <b style="color:#ff5c6a">AEGIS-5 — security audit:</b><br>'+flags.join('<br>')+'</div>';
  }
  el.innerHTML=out;
  awardKP(5,'Mentor review requested — builders who review, ship');
}

/* ================= SHIP PROJECT (firewall: badge, not live capital) ================= */
function shipProject(i){
  const p=BLD.projects[i];
  // AEGIS launch checklist — automated gate
  const c=p.code.toLowerCase();
  const checks=[
    ['Runs 10+ execution cycles',p.execs>=10],
    ['No live transaction signing',!c.includes('signtransaction')&&!c.includes('sendraw')],
    ['No key material in code',!c.includes('secret')&&!c.includes('privatekey')&&!c.includes('seed')],
    ['Error handling present',c.includes('try')||p.execs>20],
    ['Gas budget sustainable (≥20 cr)',G.credits>=20],
  ];
  const pass=checks.every(x=>x[1]);
  const el=document.getElementById('mentor-'+i);
  el.innerHTML='<div class="card" style="margin-top:8px"><h4>🚀 AEGIS-5 Launch Checklist</h4>'+
    checks.map(x=>'<div class="check-row"><span>'+x[0]+'</span><span class="cs" style="color:'+(x[1]?'#2ee6a8':'#ff5c6a')+'">'+(x[1]?'✓':'✗')+'</span></div>').join('')+
    (pass?'<button class="btn green" style="width:100%;margin-top:6px" onclick="doShip('+i+')">🚀 SHIP TO GALLERY</button>'
      :'<div style="font-size:11px;color:#ff5c6a;margin-top:6px">Checklist incomplete. The firewall holds — fix the flagged items and resubmit.</div>')+'</div>';
  renderBuilder && null;
}
function doShip(i){
  const p=BLD.projects[i];
  const badge={name:p.name,tpl:p.tpl,execs:p.execs,by:myName?myName():'Operator',ts:Date.now(),adoption:1+Math.floor(Math.random()*3)};
  BLD.shipped.unshift(badge);saveBld();
  awardKP(150,'PROJECT SHIPPED: '+p.name+' — Architect path');
  notify('🚀 SHIPPED','"'+p.name+'" is live in the Project Gallery. ARCHITECT progress recorded.','ok');
  log('🚀 Project shipped: '+p.name+' by '+badge.by,'ok');
  if(typeof SMARTZ_BUS!=='undefined')SMARTZ_BUS.emit('build.ship',{name:p.name});
  checkArchitect();renderGallery();renderBuilder();
  zoTip&&zoTip('🚀 You shipped. That\'s the Architect path — earned, never bought. CONCOURSE will announce it.');
}
/* ================= ARCHITECT RANK (earned only) ================= */
function checkArchitect(){
  const coherent=SMARTZ_STATE.balances.SMF>0&&SMARTZ_STATE.balances.SMRT>0&&SMARTZ_STATE.balances.SMC>0;
  if(BLD.shipped.length>0&&coherent){
    SMARTZ_STATE.rank='Architect';
    document.getElementById('rankChip').textContent='⚒ ARCHITECT';
    document.getElementById('rankChip').classList.add('verified');
    log('⚒ ARCHITECT rank achieved — earned by shipping, not holding','warn');
  }
}
const _computeRankB=window.computeRank;
window.computeRank=function(){
  const r=_computeRankB();
  checkArchitect();
  return r;
};
checkArchitect();

/* ================= PROJECT GALLERY ================= */
document.body.insertAdjacentHTML('beforeend',`
<div class="win" id="win-gallery" style="top:80px;left:220px;width:560px;height:600px">
  <div class="titlebar"><span">🖼</span><span class="ttl">Project Gallery — Shipped by the Syndicate</span>
    <button class="tbtn" onclick="maxWin('win-gallery')">□</button><button class="tbtn" onclick="closeApp('gallery')">✕</button></div>
  <div class="win-body">
    <div class="card" style="display:flex;gap:14px;padding:10px 14px">
      <div><div style="font-size:10px;color:var(--dim)">PROJECTS SHIPPED</div><div class="bigstat" id="gal-count">0</div></div>
      <div><div style="font-size:10px;color:var(--dim)">TOTAL EXECUTIONS</div><div class="bigstat" id="gal-exec" style="color:#2ee6a8">0</div></div>
      <div style="margin-left:auto;font-size:10px;color:var(--dim);text-align:right">Status through output,<br>not portfolio size.</div>
    </div>
    <div id="galList"></div>
  </div>
</div>`);
function renderGallery(){
  const el=document.getElementById('galList');if(!el)return;
  document.getElementById('gal-count').textContent=BLD.shipped.length;
  document.getElementById('gal-exec').textContent=BLD.execs;
  const seed=[{name:'Triad Whale Sentinel',tpl:'whale',by:'ZORAN (council)',execs:1240,ts:Date.now()-86400000*3,adoption:42},
    {name:'Momentum Blade v2',tpl:'momo',by:'TAURON-3 (council)',execs:860,ts:Date.now()-86400000*2,adoption:27}];
  const all=BLD.shipped.concat(seed);
  el.innerHTML=all.length?all.map(s=>{
    const t=TEMPLATES.find(x=>x.id===s.tpl)||TEMPLATES[4];
    return '<div class="gal-card"><div class="gc-t">'+t.name.split(' ')[0]+' '+s.name+' <span class="arch-badge" style="margin-left:6px">SHIPPED</span></div>'+
      '<div class="gc-by">by '+s.by+' · '+new Date(s.ts).toLocaleDateString()+'</div>'+
      '<div class="gc-metrics"><span>executions: <b>'+(s.execs||0)+'</b></span><span>adoption: <b>'+(s.adoption||1)+'</b> operators</span><span>type: '+t.name.replace(/[^\w ]/g,'')+'</span></div></div>';
  }).join(''):'<div style="color:var(--dim);font-size:12px">Nothing shipped yet. The Gallery waits for its first Architect.</div>';
}

/* ================= BUILDER TRACK (Academy dual-track) ================= */
const BUILDER_LESSONS=[
 {t:'Reading a Solana Program',d:'Smart contracts on Solana are programs — stateless code that reads/writes accounts. Before using any protocol, find its program ID and read what authorities it holds.',
  q:'Solana programs store state in:',o:['The program binary itself','Separate accounts','Your wallet app'],a:1,xp:40},
 {t:'The Zoran API Mental Model',d:'Sandbox bots observe and signal — they read live data (prices, mids, whale alerts) and output logs/toasts. Real capital never flows through sandbox code. That firewall is deliberate: learn with signals, graduate to live only through the checklist.',
  q:'Sandbox bots can:',o:['Sign real transactions','Observe data and emit signals','Mint tokens'],a:1,xp:40},
 {t:'Ship Your First Bot',d:'Deploy a template, let it run 10+ cycles, get a SYLK-9 logic review and an AEGIS-5 audit, then pass the launch checklist. Shipping — not holding — is what makes an Architect.',
  q:'The Architect rank is earned by:',o:['Holding all three tokens','Shipping a project through the checklist','Buying SMRT'],a:1,xp:60},
];
/* inject builder track into academy render */
const _renderAcademyB=window.renderAcademy;
window.renderAcademy=function(){
  _renderAcademyB();
  const el=document.getElementById('acLessons');if(!el)return;
  let html='<div class="track-h">⚒ BUILDER TRACK — make things, don\'t just trade them '+(gateOpen('TRIAD')?'<span class="badge">OPEN</span>':'<span class="badge locked">🔒 '+gateLabel('TRIAD')+'</span>')+'</div>';
  BUILDER_LESSONS.forEach((l,li)=>{
    const id='B-'+li,done=AC.done[id];
    if(!gateOpen('TRIAD')){
      html+='<div class="lesson locked"><div class="lh">🔒 '+l.t+'</div><div class="ld">Builder Track requires full triad holdings — the tuition funds the mesh you\'ll build on.</div></div>';return;
    }
    html+='<div class="lesson" id="les-'+id+'"><div class="lh">'+(done?'✅ ':'⚒ ')+l.t+' <span class="xp" style="margin-left:auto">+'+l.xp+' XP</span></div>'+
      '<div class="ld">'+l.d+'</div>';
    if(!done)html+='<div class="lq"><div style="font-size:11px;color:#e8c15a;font-weight:700">CHECK: '+l.q+'</div>'+
      l.o.map((o,oi)=>'<button class="quiz-opt" onclick="answer(\''+id+'\','+oi+','+l.a+','+l.xp+')">'+o+'</button>').join('')+'</div>';
    html+='</div>';
  });
  el.insertAdjacentHTML('beforeend',html);
};

/* ================= wire icons/hooks ================= */
[['builder','Builder Sandbox','⚒'],['gallery','Project Gallery','🖼']].forEach(([id,name,icon])=>{
  const d=document.createElement('div');d.className='desk-icon';
  d.innerHTML='<div class="glyph">'+icon+'</div><div class="lbl">'+name+'</div>';
  d.onclick=()=>openApp(id);document.getElementById('desktop').appendChild(d);
  const s=document.createElement('div');s.className='sm-item';
  s.innerHTML='<span>'+icon+'</span><span>'+name+'</span>';
  s.onclick=()=>{openApp(id);document.getElementById('startMenu').classList.remove('open')};
  document.getElementById('startMenu').appendChild(s);
});
document.querySelectorAll('#win-builder,#win-gallery').forEach(w=>{
  w.addEventListener('mousedown',()=>w.style.zIndex=++zTop);
  const bar=w.querySelector('.titlebar');
  bar.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('tbtn')||w.classList.contains('max')||window.innerWidth<=768)return;
    const r=w.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
    const mv=ev=>{w.style.left=(ev.clientX-ox)+'px';w.style.top=Math.max(0,ev.clientY-oy)+'px'};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
});
const _openApp12=window.openApp;
window.openApp=function(id){_openApp12(id);
  if(id==='builder')renderBuilder();
  if(id==='gallery')renderGallery();
  if(id==='academy')renderAcademy();
};
/* gallery metrics react to executions */
setInterval(()=>{if(document.getElementById('win-gallery')&&document.getElementById('win-gallery').classList.contains('open'))renderGallery();},15000);
renderBuilder();renderGallery();
log('v5.0 Builder Mesh loaded — sandbox, mentors, gallery, Architect rank','info');
log('📡 The Syndicate no longer just trades. It builds. The system ascends. — CONCOURSE','info');
