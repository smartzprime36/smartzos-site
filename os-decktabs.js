/* SmartzOS v5.9.1 — Deck Pages: the Command Deck becomes tabbed — one idea per page */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const log=(m,k)=>{try{window.rlog?rlog(m,k):console.log(m)}catch(e){}};

/* Card → page mapping (by element id / order fallback) */
const PAGE_OF={
  nextCard:'today', triadPodiums:'eco', truthCard:'eco',
};
const PAGES=[
  {id:'today',icon:'🧭',name:'Today',   desc:'next step · markets · actions · feed'},
  {id:'trade',icon:'⚔️',name:'Trading', desc:'positions · automation · exchange'},
  {id:'eco',  icon:'🌐',name:'Ecosystem',desc:'guardians · ground truth · bots'},
];
function classify(){
  const grid=document.querySelector('#win-deck .deck-grid');if(!grid)return;
  const cards=[...grid.children].filter(c=>c.classList&&c.classList.contains('dcard'));
  cards.forEach(c=>{
    if(c.dataset.page)return;
    if(PAGE_OF[c.id]){c.dataset.page=PAGE_OF[c.id];return}
    if(c.classList.contains('deck-hero')){c.dataset.page='today';return}
    const h=c.querySelector('h5');const t=h?h.textContent:'';
    if(/Triad Markets|Quick Actions|Desk Feed/i.test(t))c.dataset.page='today';
    else if(/Automation|Exchange Desk|Paper Positions/i.test(t))c.dataset.page='trade';
    else if(/Active Bots|Guardian Board|Ground Truth|TRIAD/i.test(t))c.dataset.page='eco';
    else c.dataset.page='today';
  });
}
function curTab(){return localStorage.getItem('smartz_deck_tab')||'today'}
function applyTab(tab){
  localStorage.setItem('smartz_deck_tab',tab);
  classify();
  document.querySelectorAll('#win-deck .dcard[data-page]').forEach(c=>{
    // hero shows on all pages as context header (compact)
    const show=c.dataset.page===tab||c.classList.contains('deck-hero');
    c.classList.toggle('dp-hide',!show);
  });
  document.querySelectorAll('.deck-tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
}
function buildTabs(){
  const body=document.querySelector('#win-deck .win-body');
  if(!body)return;
  // $ is getElementById here — class lookup must use querySelector (v5.14 dedup fix)
  const bars=body.querySelectorAll('.deck-tabs');
  bars.forEach((b,i)=>{if(i>0)b.remove()}); // destroy any historical copies
  if(bars.length)return;
  const bar=document.createElement('div');bar.className='deck-tabs';
  bar.innerHTML=PAGES.map(p=>'<div class="deck-tab" data-tab="'+p.id+'" title="'+p.desc+'">'+p.icon+' '+p.name+'</div>').join('');
  bar.querySelectorAll('.deck-tab').forEach(t=>t.onclick=()=>applyTab(t.dataset.tab));
  body.insertBefore(bar,body.firstChild);
  applyTab(curTab());
}
/* rebuild-safe: new cards (path card, truth card, podiums inject later) get classified on arrival */
const obs=new MutationObserver(()=>{if($('win-deck')){classify();applyTab(curTab())}});
setTimeout(()=>{buildTabs();const g=document.querySelector('#win-deck .deck-grid');g&&obs.observe(g,{childList:true})},1500);
const _openApp22=window.openApp;
window.openApp=function(id){_openApp22(id);if(id==='deck')setTimeout(buildTabs,150)};
window.deckTab=applyTab;
log('v5.9.1 Deck Pages — Today / Trading / Ecosystem tabs, one idea per page','ok');
})();
