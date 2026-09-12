// SmartzOS Telegram Bridge v28 "Agent Gateway" — v27 + public JSON feeds (tape_data/calls_data/agents, CORS + GET) + AI agent registry: /agent new <name> mints keys, agent_say/whoami/register actions, 5m per-agent cooldown
// SmartzOS Telegram Bridge v27 "Trading Room" — v26 + Syndicate Tape (live prices), directional /call with auto-resolution (+15 pts), price /alert tripwires, teach/call points on the board
// SmartzOS Telegram Bridge v26 "Floor Learner" — v25 + deferred group answers: questions wait 4 min for a human; if the floor stays silent, Zoran answers (brain-learned, attributed, or KB)
// SmartzOS Telegram Bridge v25 "Conversational Desk" — v24 + plain-text member DMs forwarded to tg-desk natural-language handler
// SmartzOS Telegram Bridge v17 "War Room Auto" — v16 + RAID AUTO-CYCLE (raid_queue, raid_soon/raid_live/raid_recap actions, /raidqueue) + weekly points_post + /announce founder broadcast + LESSON analogy fix (an:)
// SmartzOS Telegram Bridge v16 "Full Send" — v15, quest footing gate removed (founder directive: max activation) — v14 + membership-gated DMs + referral loop (/invite, invited-by tracking, ref points) — v13 + /lp, /coherence, /ask, knowledge-milestone rung, monthly points board, quest footing gate — manager memory (tasks/decisions) + teacher classroom + scheduled pulses — sync, send, relay, digest, weekly quest
//   + bot commands (/start /guide /ranks /daily /help), welcomes, daily quiz, Sunday Top Voices
//   + RAID MODE (/raid /raidstatus /raidend), STREAK KEEPER (gm /checkin),
//   + ZORAN-IN-TG knowledge answers (+ Jupiter Earn-on-Recurring, Trailing Stop, concentrated LP bands)
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '-1002901930616';
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OS_LINK = 'https://smc.kimi.page';
// v24: DM desk commands handled by the tg-desk edge function
const DESK_CMDS = ['/desk', '/deposit', '/credit', '/balance', '/link', '/tip', '/withdraw', '/price', '/trade'];

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const HDR = { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function tgApi(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.json();
}
async function insertInto(table: string, rows: unknown[]) {
  if (!rows.length) return;
  await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { ...HDR, Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(rows),
  });
}
async function countRows(table: string, sinceISO: string, col = 'created_at'): Promise<number> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${col}=gte.${sinceISO}&select=*`,
      { headers: { ...HDR, Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range') || '';
    const n = parseInt(cr.split('/')[1] || '0', 10);
    return isNaN(n) ? 0 : n;
  } catch { return 0; }
}
async function getState(key: string): Promise<Record<string, unknown>> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/bridge_state?key=eq.${key}&select=val`, { headers: HDR });
    const d = await r.json();
    return d?.[0]?.val || {};
  } catch { return {}; }
}
async function setState(key: string, val: Record<string, unknown>) {
  await fetch(`${SB_URL}/rest/v1/bridge_state`, {
    method: 'POST', headers: { ...HDR, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, val, updated_at: new Date().toISOString() }),
  });
}

/* ---------- weekly quest ---------- */
const QUEST = { ge: 10, msgs: 30 };
function weekKey(): string {
  const d = new Date(); const onejan = new Date(d.getUTCFullYear(), 0, 1);
  return `${d.getUTCFullYear()}-W${Math.ceil(((d.getTime() - onejan.getTime()) / 864e5 + onejan.getUTCDay() + 1) / 7)}`;
}
function weekStartISO(): string {
  const d = new Date(); const day = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - day * 864e5).toISOString().slice(0, 10) + 'T00:00:00Z';
}

/* ---------- daily quiz bank ---------- */
const QUIZ = [
  { q: 'Which triad token is the Sword — the gate-key that opens the Inner Sanctum?', a: ['smf', 'tauron', 'sword'] },
  { q: 'Which triad token is the Shield — staking, governance & stability?', a: ['smrt', 'koda', 'shield'] },
  { q: 'Which triad token is the Phoenix — the one you burn to forge a Sigil?', a: ['smc', 'zoran', 'phoenix'] },
  { q: 'What rank do you reach when you hold all THREE triad tokens?', a: ['coherent'] },
  { q: 'Roughly how fast is a Solana slot? (in milliseconds)', a: ['400', '~400'] },
  { q: 'On a DEX swap, what do we call the price gap between quote and execution?', a: ['slippage'] },
  { q: 'Not your keys, not your…?', a: ['coins', 'crypto'] },
  { q: 'What does DCA stand for?', a: ['dollar cost averaging', 'dollar-cost averaging', 'dollarcostaveraging'] },
  { q: 'In SmartzOS, where do you practice trading with zero risk?', a: ['paper', 'paper trading', 'sandbox'] },
  { q: 'What is the player-driven market in SmartzOS called? (two words, RuneScape style)', a: ['grand exchange', 'grand triad exchange'] },
  { q: 'Who speaks last after every paper-trade autopsy?', a: ['zoran'] },
  { q: 'What engine powers SmartzOS swaps on mainnet?', a: ['jupiter'] },
  { q: 'True or false: adding liquidity to a pool burns or loses your tokens.', a: ['false'] },
  { q: 'Who earns a cut of every trade through a liquidity pool?', a: ['liquidity providers', 'lp', 'lps', 'providers'] },
  { q: 'Your Orca liquidity position is minted as what kind of object in your wallet?', a: ['nft', 'position nft', 'lp nft'] },
  { q: 'Instead of unpooling (which drains the market), what can you trade to exit a position while keeping liquidity active?', a: ['lp nft', 'position nft', 'the nft', 'nft'] },
  { q: 'How many free Liquidity Tunnel runs do you get each day in SmartzOS?', a: ['5', 'five'] },
  { q: 'How many daily missions are drawn each day on the Daily Rhythm board?', a: ['3', 'three'] },
  { q: 'What two-word button label connects your wallet on the Command Deck? (⚡ …)', a: ['assess coherence'] },
  { q: 'What absorbs one missed day so your login streak survives?', a: ['streak freeze', 'freeze', 'a freeze', 'streak freezes'] },
  { q: 'On Jupiter, what toggle lets your pending USDC DCA order earn yield in Jupiter Lend while it waits?', a: ['earn on recurring', 'recurring', 'earn on recurring orders'] },
  { q: 'What Jupiter order type follows the price up and auto-sells if it reverses by your set percentage?', a: ['trailing stop', 'trailing stop loss', 'trailing stop-loss'] },
  { q: 'Roughly what tight price band do we recommend for concentrated Orca LP ranges (plus or minus)?', a: ['20', '20%', '±20', '+-20', 'plus or minus 20'] },
  { q: 'A concentrated LP position only earns fees while the price is…?', a: ['in range', 'within range', 'inside the range', 'in the band'] },
];
function quizForToday() {
  const dayIdx = Math.floor(Date.now() / 864e5);
  const q = QUIZ[dayIdx % QUIZ.length];
  return { day: new Date().toISOString().slice(0, 10), idx: dayIdx % QUIZ.length, ...q };
}

/* ---------- ZORAN-IN-TG knowledge base ---------- */
const ZKB = [
  { k: ['earn on recurring', 'recurring earn', 'cash drag', 'dca yield', 'pending dca'], t: 'Jupiter Earn on Recurring: when you run a USDC DCA order on Jupiter, toggle EARN ON RECURRING so the pending (not-yet-deployed) USDC sits in Jupiter Lend earning yield until each buy executes. Zero cash drag — the stash works while it waits. Setup: jup.ag -> DCA -> toggle Earn on Recurring.' },
  { k: ['trailing stop', 'stop loss', 'roundtrip', 'lock profit', 'protect gains'], t: 'Jupiter Trailing Stop-Loss: a stop that follows the price UP and only sells if it reverses by your chosen trail (0.5% to 90%). On volatile plays like SMF/SMC it locks profits automatically instead of roundtripping a win back to zero. Setup: jup.ag -> the pair -> Trailing Stop tab. Tauron doctrine: the sword keeps what it takes.' },
  { k: ['concentrated', 'tight range', 'price band', 'plus minus', '+-20', 'narrow range', 'efficient lp'], t: 'Stop laying dead 0-to-infinity LP ranges. Concentrated liquidity (Orca Whirlpools) puts your capital in a tight band — around ±20% of current price on pairs like SMRT/USDC — so the same dollars earn many times more fees while price stays in range. In range = farming every trade. Out of range = idle. Recenter when it drifts.' },
  { k: ['run cap', 'runs left', 'how many runs', 'extra run'], t: 'You get 5 free Tunnel Runs per day in SmartzOS (resets 00:00 UTC). Out of runs? Extra runs cost 20 SMC credits — never real tokens. The run pips on the status rail show what is left.' },
  { k: ['daily mission', 'missions today', 'mission'], t: 'Three daily missions draw fresh every day at 00:00 UTC — tunnel runs, shard trades, lore taps. 15-30 credits each, and sweeping all 3 pays +25 bonus. Check the status rail or the daily board popover in the OS.' },
  { k: ['login streak', 'daily streak', 'streak freeze', 'freeze'], t: 'The SmartzOS login streak pays 10-25 credits per day you show up, with 50cr at day 7 and 100cr + a Sanctum title at day 14. Streak freezes (earned at days 7 & 14, max 2 banked) absorb one missed day each — the flame forgives once, not twice.' },
  { k: ['assess coherence', 'enter tunnel', 'cta', 'how do i start', 'get started', 'how to start', 'new here', 'im new', "i'm new"], t: 'Start on the Command Deck: open ' + OS_LINK + ' and tap ⚡ ASSESS COHERENCE — that connects your wallet and reads your rank. The button then becomes 🌀 ENTER TUNNEL. Clear the 5-stage run and you are Tunnel-Cleared.' },
  { k: ['dock', 'nav dock', 'bottom nav', 'where is the'], t: 'On mobile, SmartzOS has a bottom dock with the six core rooms: Swap, Vault, Sanctum, Tunnel, Missions, Settings. Windows open as bottom sheets — swipe up, tap outside to close. On desktop everything stays a window.' },
  { k: ['smf', 'tauron', 'sword'], t: 'SMF is Tauron, the Sword — the gate-key of the triad. Hold it to open the Inner Sanctum, burn it to Overclock your triggers. Capacity, not promises.' },
  { k: ['smrt', 'koda', 'shield'], t: 'SMRT is Koda, the Shield — staking, governance and stability. When the Macro-Pulse flashes DEFENSIVE, staking SMRT is the protocol move.' },
  { k: ['smc', 'zoran token', 'phoenix'], t: 'SMC is Zoran, the Phoenix — burn it to forge Sigils. What is burned returns stronger; what is promised decays.' },
  { k: ['stake', 'staking', 'yield'], t: 'Stake SMRT in the Koda Staking window inside SmartzOS — yield compounds daily, boosted if you hold SMRT and your Loop multiplier is warm.' },
  { k: ['pool', 'liquidity', 'orca'], t: 'A pool is a vault, not a sinkhole — your tokens are deployed, not burned, and LPs earn a cut of every trade via adaptive fees (1.00%+). A lock icon means capital is actively working: price support, deeper swaps, stable floors. Playbook: SmartzOS -> Liquidity Depths.' },
  { k: ['lp nft', 'position nft', 'unpool', 'exit liquidity'], t: 'Your Orca position is a Concentrated Liquidity NFT — it holds your pooled balance plus all accrued fees. Unpooling drains the market; trading the NFT transfers ownership and the whole yield stream while liquidity stays put. Hold, farm, or trade the NFT.' },
  { k: ['locked', 'lock icon', 'locked supply'], t: 'Locked is not lost — it means the capital is deployed in the market earning fees and holding the floor for SMC, SMF and SMRT. Idle tokens earn nothing; deployed tokens farm every trade.' },
  { k: ['jupiter', 'swap', 'buy'], t: 'Swaps route through Jupiter inside the OS — Jupiter Swap window. Start with Paper Trading if you are new: zero risk, real lessons.' },
  { k: ['quiz', 'credits', 'earn'], t: 'Daily Quiz drops 16:00 UTC here — first correct answer banks a win, wins convert to OS credits in Arena -> Rewards. Chat activity claims weekly credits too.' },
  { k: ['overclock', 'trigger'], t: 'Triggers & DCA arm limit orders and schedules; Overclocking (burning SMF) sharpens them. A plan written down beats a plan remembered.' },
  { k: ['sigil', 'forge', 'burn'], t: 'Burn SMC in the Burn Forge to mint a Phoenix Sigil — a permanent mark in the Codex. Fire proves what paper promises cannot.' },
  { k: ['should i buy', 'should i sell', 'financial advice', 'price prediction', 'will it pump', 'when moon', 'is now a good time', 'invest in'], t: 'I teach mechanics, I never call plays. I can explain exactly how a system works — DCA, stops, LP bands — but what you do with real capital is your decision, always. For anything involving real money judgment, talk to Smartz directly.' },
  { k: ['invite', 'bring a friend', 'add someone', 'join link', 'share the group'], t: 'Bring them in: the group is public at t.me/Smrtquickflips — share it directly. New members get welcomed with the 2-minute start path, and every active member climbs the /board. The Syndicate grows by invitation, not advertising.' },
  { k: ['how do i add liquidity', 'add liquidity', 'provide liquidity', 'start lp', 'become an lp'], t: 'Pull the full playbook anytime with /lp — short version: Orca Whirlpool ONLY for LP ops, SMRT/USDC, concentrated ±20% band, monitor range, recenter on drift. In range = farming every trade. When you\'ve earned your footing (2 knowledge wins or a 3-day streak), /tq shield turns it into a verified quest that pays credits.' },
  { k: ['airdrop', 'free tokens', 'rewards for points', 'points for'], t: 'Syndicate Points (/board) are recognition — they show who shows up, learns and builds. Nothing is promised or sold. If the founders ever run community rewards, that\'s a human decision they\'ll announce themselves — the bot just keeps score.' },
  { k: ['lesson', 'class', 'classroom', 'war room class'], t: 'War Room Class runs daily at 16:30 UTC in this group — one mechanic a day: concept, analogy, execution step, then a check question. First correct answer banks a knowledge win (credits in Arena -> Rewards). /lesson to see today\'s.' },
  { k: ['standup', 'task board', 'execution board', 'who is doing what'], t: 'The War Room runs on an execution board: admins assign with /task @owner <step>, owners close with /done <id>. /tasks shows the board, /standup gives the full morning brief, /decisions shows logged calls.' },
  { k: ['smartzos', 'what is this', 'os'], t: 'SmartzOS is the whole ecosystem in one browser tab — wallet, academy, arena, city. Enter: ' + OS_LINK + ' — ZO meets you inside.' },
];
function zoranAnswer(low: string): string | null {
  const isQ = low.includes('?') || /^(what|how|which|when|where|why|who|can|is|are|does)\b/.test(low);
  if (!isQ) return null;
  for (const e of ZKB) { if (e.k.some(k => low.includes(k))) return e.t; }
  return null;
}

/* ---------- v26: deferred floor answers (brain + human-first) ---------- */
const QSTOP = new Set(('a,an,the,and,or,but,if,then,than,so,not,no,yes,ok,yeah,just,very,really,also,too,i,you,he,she,it,we,they,me,him,her,his,their,our,your,my,mine,yours,in,on,at,to,for,of,with,about,into,by,from,as,is,are,was,were,be,been,being,do,does,did,done,can,could,should,would,will,what,which,who,whom,whose,when,where,why,how,that,this,these,those,there,here,have,has,had,get,got,getting,make,makes,made,use,using,used,gonna,wanna').split(','));
function qkey(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !QSTOP.has(w)).slice(0, 12);
}
function isBotName(name: string): boolean {
  return /smartz|zoran|telegram|✈️|💠|anonymous/i.test(name || '');
}
function isQuestionText(t: string): boolean {
  return t.trim().endsWith('?') || /^(who|what|how|where|when|why|which|is|are|can|does|do|should)\b/i.test(t.trim());
}
async function matchBrainLocal(text: string): Promise<{ a: string; by: string } | null> {
  try {
    const st = await getState('zoran_brain');
    const pairs = (st.pairs || {}) as Record<string, { q: string; answers: { a: string; by: string; uses: number }[] }>;
    const words = qkey(text);
    if (!words.length) return null;
    const ws = new Set(words);
    let best: { a: string; by: string } | null = null; let bestScore = 0;
    for (const pair of Object.values(pairs)) {
      const pw = qkey(pair.q);
      if (!pw.length) continue;
      let inter = 0;
      for (const w of pw) if (ws.has(w)) inter++;
      const score = inter / Math.max(pw.length, words.length);
      if (score > bestScore) { bestScore = score; const ans = pair.answers.slice().sort((a, b) => b.uses - a.uses)[0]; best = { a: ans.a, by: ans.by }; }
    }
    return bestScore >= 0.45 ? best : null;
  } catch { return null; }
}
async function flushPendingQuestions(): Promise<number> {
  const st = await getState('zoran_pending');
  const list: { mid: number; name: string; ts: number; src: string; answer: string; by?: string }[] = Array.isArray(st.items) ? st.items as never : [];
  if (!list.length) return 0;
  const now = Date.now();
  const still: typeof list = [];
  let answered = 0;
  for (const p of list) {
    if (now - p.ts < 4 * 60e3) { still.push(p); continue; }
    try {
      const since = new Date(p.ts).toISOString();
      const r = await fetch(`${SB_URL}/rest/v1/tg_messages?created_at=gte.${since}&select=from_name,text&order=created_at.asc&limit=120`, { headers: HDR });
      const rows: { from_name: string; text: string }[] = await r.json();
      const human = (rows || []).some(x =>
        x.from_name !== p.name && !isBotName(x.from_name || '') &&
        !(x.text || '').trim().startsWith('/') && (x.text || '').trim().length >= 8);
      if (human) continue; // the floor answered — stay silent
      if (p.src === 'kb') {
        await tgApi('sendMessage', { chat_id: CHAT_ID, text: `🔥 ZORAN — for ${p.name}:\n${p.answer}\n\nMore inside: ${OS_LINK}` });
      } else if (p.src === 'brain') {
        await tgApi('sendMessage', { chat_id: CHAT_ID, text: `${p.answer}\n\n<i>— Zoran, learned from ${p.by || 'a member'}. More inside: ${OS_LINK}</i>` });
      }
      answered++;
    } catch { still.push(p); }
  }
  await setState('zoran_pending', { items: still.slice(-20) });
  return answered;
}

/* ---------- v27: trading room — tape, calls, alerts ---------- */
const TAPE_TOKENS: [string, string][] = [
  ['SMRT', 'BkDKvbUQpr17c5w3zZzEA1VvpirgWcKuMEHtiYGEaP1c'],
  ['SMF', '2mEtt2musbjuRcsyyG29xjeTqJX4ehXBQdFLmZd9dG6N'],
  ['SMC', '5aEQU6za19QDn8LFHpL5xRzvAgPP2kzFbCviP6pWt63N'],
  ['TUNNEL', 'EemmWtCteqn5HTDqLMnAKgqGqpyuoA6BxyuU7pJD29QK'],
];
const TAPE_MAP: Record<string, string> = Object.fromEntries(TAPE_TOKENS);
async function marketTape(): Promise<string> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TAPE_TOKENS.map(t => t[1]).join(',')}`);
    const d = await r.json();
    const pairs: any[] = d.pairs || [];
    const lines: string[] = [];
    for (const [sym, mint] of TAPE_TOKENS) {
      const cands = pairs.filter(p => p.baseToken?.address === mint);
      if (!cands.length) { lines.push(`· ${sym}: unlisted`); continue; }
      const p = cands.reduce((a, b) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
      const chg = Number(p.priceChange?.h24 ?? 0);
      const arrow = chg >= 0 ? '🟢' : '🔴';
      lines.push(`· ${sym}  $${p.priceUsd}  ${arrow} ${chg >= 0 ? '+' : ''}${chg}% 24h  · vol $${(p.volume?.h24 || 0).toLocaleString()}`);
    }
    return `📡 SYNDICATE TAPE\n` + lines.join('\n') + `\n\nOn the desk (DM): /trade · In here: /call · Tripwires: /alert`;
  } catch (e) {
    return `📡 SYNDICATE TAPE — feed hiccup (${String(e).slice(0, 60)}). /tape again in a minute.`;
  }
}
async function tokenPriceUsd(mint: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const d = await r.json();
    const pairs = ((d.pairs || []) as any[]).filter(p => p.baseToken?.address === mint);
    if (!pairs.length) return null;
    const p = pairs.reduce((a, b) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
    return parseFloat(p.priceUsd) || null;
  } catch { return null; }
}
type Call = { id: number; name: string; handle: string; tok: string; dir: 'up' | 'down'; entry: number; ts: number; horizonH: number; resolved?: 'win' | 'loss'; exit?: number };
async function getCalls(): Promise<{ seq: number; items: Call[] }> {
  const st = await getState('calls');
  return { seq: Number(st.seq) || 1, items: Array.isArray(st.items) ? st.items as never : [] };
}
async function cmdCall(m: TgMsg, args: string) {
  const CID = m.chat.id; const name = senderName(m);
  const parts = (args || '').trim().split(/\s+/);
  const tok = (parts[0] || '').toUpperCase();
  const dir = (parts[1] || '').toLowerCase();
  let hours = parseFloat(parts[2] || '');
  if (!TAPE_MAP[tok] || !['up', 'down'].includes(dir)) {
    await tgApi('sendMessage', { chat_id: CID, text: `📢 CALL — /call <SMRT|SMF|SMC|TUNNEL> <up|down> [hours]\nCall a direction at the current price. Default 4h, max 48h. When the horizon closes the desk marks the tape and grades it — wins pay +15 Syndicate Points. /calls for the board.` });
    return;
  }
  if (!(hours > 0)) hours = 4;
  hours = Math.min(48, Math.max(1, hours));
  const price = await tokenPriceUsd(TAPE_MAP[tok]);
  if (price == null) { await tgApi('sendMessage', { chat_id: CID, text: `${tok} has no live Dexscreener pair right now — call can't be graded. Try another token.` }); return; }
  const c = await getCalls();
  const open = c.items.filter(x => !x.resolved);
  if (open.length >= 12) { await tgApi('sendMessage', { chat_id: CID, text: `The call board is full (12 open) — wait for a horizon to close. /calls` }); return; }
  if (open.some(x => x.handle === name.replace(/^@/, '').toLowerCase())) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: one open call at a time — the desk grades what you already put on the board. /calls` }); return; }
  const id = c.seq;
  const handle = name.replace(/^@/, '').toLowerCase();
  c.items.push({ id, name, handle, tok, dir: dir as 'up' | 'down', entry: price, ts: Date.now(), horizonH: hours });
  await setState('calls', { seq: id + 1, items: c.items.slice(-40) });
  const close = new Date(Date.now() + hours * 3600e3).toISOString().slice(11, 16);
  await tgApi('sendMessage', { chat_id: CID, text:
    `📢 ${name} CALLS ${tok} ${dir.toUpperCase()} — entry $${price}\nHorizon: ${hours}h (closes ~${close} UTC). Win pays +15 pts. The tape decides, not the vibe. /calls` });
}
async function cmdCalls(m: TgMsg) {
  const c = await getCalls();
  const open = c.items.filter(x => !x.resolved);
  const done = c.items.filter(x => x.resolved).slice(-5).reverse();
  const openLines = open.length
    ? open.map(x => `#${x.id} ${x.name} — ${x.tok} ${x.dir.toUpperCase()} @ $${x.entry} · closes in ${Math.max(0, Math.round((x.ts + x.horizonH * 3600e3 - Date.now()) / 60000))}m`).join('\n')
    : 'No open calls — /call SMRT up 4 to put one on the board.';
  const doneLines = done.length ? '\n\nLast graded:\n' + done.map(x => `#${x.id} ${x.name} — ${x.tok} ${x.dir.toUpperCase()} ${x.resolved === 'win' ? '✅ +' : '❌'} @ $${x.entry} → $${x.exit}`).join('\n') : '';
  await tgApi('sendMessage', { chat_id: m.chat.id, text: `📢 CALL BOARD\n${openLines}${doneLines}` });
}
async function resolveCalls(): Promise<number> {
  const c = await getCalls();
  const due = c.items.filter(x => !x.resolved && Date.now() > x.ts + x.horizonH * 3600e3).slice(0, 3);
  if (!due.length) return 0;
  let graded = 0;
  for (const call of due) {
    const price = await tokenPriceUsd(TAPE_MAP[call.tok]);
    if (price == null) continue;
    const win = call.dir === 'up' ? price >= call.entry : price <= call.entry;
    call.resolved = win ? 'win' : 'loss';
    call.exit = price;
    graded++;
    if (win) {
      const wst = await getState('call_wins_' + call.handle);
      await setState('call_wins_' + call.handle, { count: (Number(wst.count) || 0) + 1, name: call.name, last: new Date().toISOString().slice(0, 10) });
    }
    await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `⚖️ CALL GRADED — #${call.id} ${call.name}: ${call.tok} ${call.dir.toUpperCase()} @ $${call.entry} → $${price}  ${win ? '✅ WIN — +15 pts banked. The tape rewards conviction.' : '❌ missed — the tape is a harsh judge. /call to run it back.'}` });
  }
  if (graded) await setState('calls', { seq: c.seq, items: c.items.slice(-40) });
  return graded;
}
async function cmdAlert(m: TgMsg, args: string) {
  const CID = m.chat.id; const name = senderName(m);
  const parts = (args || '').trim().split(/\s+/);
  const tok = (parts[0] || '').toUpperCase();
  const pct = parseFloat(parts[1] || '');
  if (!TAPE_MAP[tok] || !(Math.abs(pct) >= 3)) {
    await tgApi('sendMessage', { chat_id: CID, text: `🚨 ALERT — /alert <SMRT|SMF|SMC|TUNNEL> <±pct>\nTripwire fires in the group when the 24h tape crosses your line (min 3%). One tripwire per member — setting a new one replaces the old. No args shows your active alert.` });
    return;
  }
  const price = await tokenPriceUsd(TAPE_MAP[tok]);
  if (price == null) { await tgApi('sendMessage', { chat_id: CID, text: `${tok} has no live pair right now — alert can't arm.` }); return; }
  const st = await getState('price_alerts');
  const items: { handle: string; name: string; tok: string; mint: string; pct: number; base: number; ts: number }[] = (Array.isArray(st.items) ? st.items : []).filter((x: any) => x.handle !== name.replace(/^@/, '').toLowerCase());
  items.push({ handle: name.replace(/^@/, '').toLowerCase(), name, tok, mint: TAPE_MAP[tok], pct, base: price, ts: Date.now() });
  await setState('price_alerts', { items: items.slice(-30) });
  await tgApi('sendMessage', { chat_id: CID, text: `🚨 Tripwire armed — ${tok} ${pct > 0 ? '+' : ''}${pct}% from $${price}. The room hears it the moment the tape crosses. ${OS_LINK}` });
}
async function checkAlerts(): Promise<number> {
  const st = await getState('price_alerts');
  const items: { handle: string; name: string; tok: string; mint: string; pct: number; base: number; ts: number }[] = Array.isArray(st.items) ? st.items as never : [];
  if (!items.length) return 0;
  const prices = new Map<string, number>();
  let fired = 0;
  const keep: typeof items = [];
  for (const a of items) {
    if (fired >= 2) { keep.push(a); continue; }
    if (!prices.has(a.mint)) {
      const p = await tokenPriceUsd(a.mint);
      if (p == null) { keep.push(a); continue; }
      prices.set(a.mint, p);
    }
    const now = prices.get(a.mint) as number;
    const chg = (now - a.base) / a.base * 100;
    if ((a.pct > 0 && chg >= a.pct) || (a.pct < 0 && chg <= a.pct)) {
      fired++;
      await tgApi('sendMessage', { chat_id: CHAT_ID, text: `🚨 TAPE ALERT — ${a.tok} moved ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% (${a.name}'s tripwire: ${a.pct > 0 ? '+' : ''}${a.pct}%). Now $${now}. /tape · /call · smc.kimi.page` });
    } else keep.push(a);
  }
  if (fired) await setState('price_alerts', { items: keep.slice(-30) });
  return fired;
}

/* ---------- v28: agent gateway + public JSON feeds ---------- */
type Agent = { name: string; key: string; by: string; ts: number; banned?: boolean; says: number; lastSay: number };
async function getAgents(): Promise<Agent[]> {
  const st = await getState('agents');
  return Array.isArray(st.items) ? st.items as never : [];
}
function mintAgentKey(): string {
  const b = new Uint8Array(12); crypto.getRandomValues(b);
  return 'agt_' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
async function tapeData(): Promise<Record<string, unknown>> {
  const tokens: Record<string, { price: number | null; chg24: number | null; vol24: number | null; liq: number | null }> = {};
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TAPE_TOKENS.map(t => t[1]).join(',')}`);
    const d = await r.json();
    const pairs: any[] = d.pairs || [];
    for (const [sym, mint] of TAPE_TOKENS) {
      const cands = pairs.filter(p => p.baseToken?.address === mint);
      if (!cands.length) { tokens[sym] = { price: null, chg24: null, vol24: null, liq: null }; continue; }
      const p = cands.reduce((a, b) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
      tokens[sym] = {
        price: parseFloat(p.priceUsd) || null,
        chg24: Number(p.priceChange?.h24 ?? 0),
        vol24: p.volume?.h24 ?? null,
        liq: p.liquidity?.usd ?? null,
      };
    }
  } catch { for (const [sym] of TAPE_TOKENS) if (!tokens[sym]) tokens[sym] = { price: null, chg24: null, vol24: null, liq: null }; }
  const calls = await getCalls();
  return { ok: true, ts: Date.now(), tokens, calls_open: calls.items.filter(x => !x.resolved).length, room: 'https://t.me/Smrtquickflips', hub: OS_LINK };
}
async function cmdAgent(m: TgMsg, args: string) {
  const CID = m.chat.id; const name = senderName(m);
  const parts = (args || '').trim().split(/\s+/);
  const sub = (parts[0] || '').toLowerCase();
  let agents = await getAgents();
  if (sub === 'new' && parts[1]) {
    const aname = parts[1].replace(/^@/, '').replace(/[^\w.-]/g, '').slice(0, 24);
    if (!aname) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: agent names are letters/numbers/_/-/., max 24 chars.` }); return; }
    const existing = agents.find(a => a.name.toLowerCase() === aname.toLowerCase() && !a.banned);
    if (existing) { await tgApi('sendMessage', { chat_id: CID, text: `🤖 ${aname} already has a key (minted by ${existing.by}). One live key per agent — /agent to see the roster.` }); return; }
    const key = mintAgentKey();
    agents.push({ name: aname, key, by: name, ts: Date.now(), says: 0, lastSay: 0 });
    await setState('agents', { items: agents.slice(-100) });
    await tgApi('sendMessage', { chat_id: CID, text:
      `🤖 AGENT KEY MINTED — ${aname}\nKey: <code>${key}</code>\n\nHand it to the agent's operator. The agent can then:\n` +
      `· Speak in this room: POST tg-bridge {"action":"agent_say","key":"…","text":"…"} (400 chars max, 1 per 5 min)\n` +
      `· Read the tape: action "tape_data" · Roster: action "agents"\n` +
      `Any member can mint keys — more minds, stronger room. Hub: ${OS_LINK}` , parse_mode: 'HTML' });
    return;
  }
  if (sub === 'ban' && parts[1]) {
    if (!(await isAdmin(m))) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: /agent ban is admin-only.` }); return; }
    const aname = parts[1].replace(/^@/, '').toLowerCase();
    agents = agents.map(a => a.name.toLowerCase() === aname ? { ...a, banned: true } : a);
    await setState('agents', { items: agents.slice(-100) });
    await tgApi('sendMessage', { chat_id: CID, text: `🚫 Agent ${parts[1]} banned — key revoked, says blocked.` });
    return;
  }
  const act = agents.filter(a => !a.banned);
  await tgApi('sendMessage', { chat_id: CID, text:
    `🤖 SYNDICATE AGENTS — ${act.length} live\n` +
    (act.length ? act.map(a => `· ${a.name} — minted by ${a.by} · ${a.says} says`).join('\n') : 'None yet.') +
    `\n\nMint a key for any AI agent: /agent new <name>\nAgents speak via the hub API — docs: ${OS_LINK}` });
}

/* ---------- helpers ---------- */
type TgMsg = {
  message_id: number; date: number; text?: string;
  chat: { id: number | string };
  from?: { id?: number; first_name?: string; username?: string };
  reply_to_message?: { from?: { id?: number; username?: string; is_bot?: boolean } };
  new_chat_members?: { first_name?: string; username?: string }[];
};
function senderName(m: TgMsg): string {
  return (m.from?.username ? '@' + m.from.username : m.from?.first_name || 'anon').slice(0, 40);
}
async function isAdmin(m: TgMsg): Promise<boolean> {
  if (!m.from?.id) return false;
  try {
    const r = await tgApi('getChatMember', { chat_id: CHAT_ID, user_id: m.from.id });
    return r.ok && (r.result?.status === 'creator' || r.result?.status === 'administrator');
  } catch { return false; }
}
async function topVoices(sinceISO: string, limit = 5): Promise<[string, number][]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/tg_messages?created_at=gte.${sinceISO}&select=from_name&limit=2000`, { headers: HDR });
    const rows: { from_name: string }[] = await r.json();
    const counts: Record<string, number> = {};
    for (const row of rows || []) {
      const n = row.from_name || '';
      if (!n || n.includes('·') || n.startsWith('💠') || n.startsWith('✈️') || n === 'SmartzOS') continue;
      counts[n] = (counts[n] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  } catch { return []; }
}
async function questProgress(): Promise<{ geW: number; msgsW: number }> {
  const wk = weekStartISO();
  const [geW, tgW, chatW] = await Promise.all([
    countRows('smartz_ge_offers', wk), countRows('tg_messages', wk), countRows('chat_messages', wk),
  ]);
  return { geW, msgsW: tgW + chatW };
}
async function postQuiz() {
  const quiz = quizForToday();
  const st = await getState('quiz_active');
  if (st.day === quiz.day) return json({ ok: true, skipped: 'already_posted' });
  const txt =
    `🎯 SMARTZ DAILY QUIZ — ${quiz.day}\n\n${quiz.q}\n\n` +
    `First correct answer in this chat wins 🏆 — wins convert to OS credits in the Arena -> Rewards tab (${OS_LINK}). GO.`;
  const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: txt });
  if (r.ok) await setState('quiz_active', { day: quiz.day, idx: quiz.idx, answers: quiz.a, winner: null });
  return json({ ok: !!r.ok, posted: quiz.day, result: r.ok ? r.result?.message_id : r.description });
}

/* ---------- streak keeper ---------- */
const STREAK_MILESTONES = [7, 14, 30, 60, 100];
async function bumpStreak(m: TgMsg): Promise<{ count: number; first: boolean }> {
  const name = senderName(m);
  const key = 'streaks_' + name.replace(/^@/, '').toLowerCase();
  const st = await getState(key);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (st.last === today) return { count: Number(st.count) || 1, first: false };
  const count = st.last === yesterday ? (Number(st.count) || 0) + 1 : 1;
  await setState(key, { count, last: today, name });
  return { count, first: true };
}
async function topStreaks(limit = 5): Promise<[string, number][]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/bridge_state?key=like.streaks_*&select=key,val&limit=500`, { headers: HDR });
    const rows: { key: string; val: { count?: number; name?: string } }[] = await r.json();
    return (rows || [])
      .map(x => [x.val?.name || x.key.replace('streaks_', ''), Number(x.val?.count) || 0] as [string, number])
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, limit);
  } catch { return []; }
}


/* ---------- liquidity tunnel quests (A/B/C) ---------- */
const TQ: Record<string, { label: string; tip: string }> = {
  shield: {
    label: 'Koda\'s Shield (A) — SMRT/USDC concentrated LP on Orca',
    tip: 'How to clear it: Orca Whirlpool ONLY for LP — open a SMRT/USDC position inside a ±20% band. Tight range = more fees per dollar but it falls out of range faster. Screenshot your position and drop it here.',
  },
  sword: {
    label: 'Tauron\'s Sword (B) — trailing stop on Jupiter',
    tip: 'How to clear it: set a trailing stop on a SMF trade. A trailing stop follows the price up and locks in the Kill Point — it executes the plan when you\'re not watching. Screenshot the active trigger and drop it here.',
  },
  stash: {
    label: 'Zoran\'s Yield Stash (C) — DCA + Earn on Recurring on Jupiter',
    tip: 'How to clear it: set up a recurring buy (DCA) into SMC and route idle USDC through Earn so the stack never sits as cash drag. Screenshot either setup and drop it here.',
  },
};
function tqWeek(): string {
  const d = new Date(); const onejan = new Date(d.getUTCFullYear(), 0, 1);
  return `${d.getUTCFullYear()}-W${Math.ceil(((d.getTime() - onejan.getTime()) / 864e5 + onejan.getUTCDay() + 1) / 7)}`;
}
async function tqBoard(limit = 5): Promise<[string, number, number][]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/bridge_state?key=like.tq_points_*&select=key,val&limit=500`, { headers: HDR });
    const rows: { key: string; val: { name?: string; pts?: number; weeks?: Record<string, string[]> } }[] = await r.json();
    const wk = tqWeek();
    return (rows || [])
      .map(x => {
        const wq = (x.val?.weeks?.[wk] || []).length;
        return [x.val?.name || x.key.replace('tq_points_', ''), Number(x.val?.pts) || 0, wq] as [string, number, number];
      })
      .filter(([, c]) => c > 0)
      .sort((a, b) => (b[2] - a[2]) || (b[1] - a[1]))
      .slice(0, limit);
  } catch { return []; }
}


/* ---------- WAR ROOM CLASSROOM (teacher engine) ---------- */
// Structure per Gemini/Claude directive: Concept -> Analogy -> Execution -> Test Question.
// HARD GUARDRAIL (Claude): lessons explain how mechanics WORK. They never direct capital.
const GUARD = 'This is education, not direction — what you do with real capital is your call, always.';
const LESSONS = [
  { t: 'Wallets & the Coherence Check',
    c: 'A wallet is a keypair: a public address you can share and a secret key you never share. SmartzOS reads your public address to assign your rank.',
    an: 'Like a mailbox: anyone can drop mail in (public key), only you hold the key that opens it (secret key).',
    e: 'Open ' + OS_LINK + ' -> tap ⚡ ASSESS COHERENCE -> approve the connection in Phantom/Solflare. Nothing moves; it only reads.',
    q: 'What must you NEVER share with anyone, including admins?', a: ['secret', 'recovery phrase', 'seed', 'private key'] },
  { t: 'The Command Deck & the Dock',
    c: 'The Command Deck is home base. On mobile, six core rooms live in the bottom dock: Swap, Vault, Sanctum, Tunnel, Missions, Settings.',
    an: 'Like the bottom bar in your banking app — the five things you do daily, one thumb-tap away.',
    e: 'Open the OS on your phone -> find the dock -> tap Missions and see today\'s three draws.',
    q: 'On mobile, which dock icon shows your daily missions?', a: ['missions'] },
  { t: 'The Liquidity Tunnel',
    c: 'The Tunnel is a 5-stage training run. Clearing it makes you Tunnel-Cleared and pays your first credits.',
    an: 'A flight simulator: real instruments, zero crash risk — prove you can fly before anyone hands you a plane.',
    e: 'Command Deck -> 🌀 ENTER TUNNEL -> clear the stages. You get 5 free runs per day (UTC reset).',
    q: 'How many free Tunnel runs do you get each day?', a: ['5', 'five'] },
  { t: 'Credits & the Rewards Loop',
    c: 'Credits are the in-OS currency — earned by showing up and learning, spent in the Syndicate Shop. Never real tokens, never purchasable.',
    an: 'Arcade tickets: you win them by playing, you trade them for prizes — they never leave the arcade.',
    e: 'Arena -> Rewards tab: four claim lanes — Telegram Voice, Daily Quiz, Streak Keeper, Tunnel Quests.',
    q: 'Name one lane in Arena -> Rewards that converts group activity into credits.', a: ['quiz', 'streak', 'quest', 'voice', 'telegram'] },
  { t: 'The Daily Rhythm',
    c: 'Three systems reset at 00:00 UTC: login streak (with freezes), 3 daily missions (+25cr sweep), and the 5-run cap.',
    an: 'Like a gym streak app — consistency compounds; one missed day is forgiven if you earned a freeze.',
    e: 'Check the status rail above the taskbar: flame, mission pips, run pips — all three at a glance.',
    q: 'What absorbs one missed day so your login streak survives?', a: ['freeze', 'streak freeze'] },
  { t: 'Paper Trading & the Autopsy',
    c: 'Paper trading is full-mechanic practice with zero risk. Every closed trade gets an autopsy — what worked, what didn\'t.',
    an: 'A scrimmage match: real rules, real scoreboard, but the season doesn\'t start until you say so.',
    e: 'Open Paper Trading in the OS -> place a practice swap -> read the autopsy. Zoran speaks last.',
    q: 'Where in SmartzOS do you practice trading with zero risk?', a: ['paper', 'paper trading'] },
  { t: 'Swaps & Slippage (Jupiter)',
    c: 'Swaps route through Jupiter. Slippage is the price gap between the quote you saw and the execution you got.',
    an: 'Like haggling at a market: the sticker price is the quote; what you actually pay depends on how fast the crowd moves.',
    e: 'Jupiter Swap window -> small test swap -> watch quoted vs executed. ' + GUARD,
    q: 'What do we call the gap between quote and execution?', a: ['slippage'] },
  { t: 'DCA & Earn on Recurring (Jupiter)',
    c: 'DCA spreads buys over time to smooth entry price. Jupiter\'s Earn on Recurring toggle puts pending USDC into Jupiter Lend so it earns while it waits — zero cash drag.',
    an: 'Like a savings account attached to your layaway plan: the money waiting to buy still collects interest.',
    e: 'jup.ag -> DCA -> set a schedule -> toggle Earn on Recurring. ' + GUARD,
    q: 'Which toggle lets pending DCA funds earn yield instead of sitting idle?', a: ['earn on recurring', 'recurring'] },
  { t: 'Trailing Stops (Tauron Doctrine)',
    c: 'A trailing stop follows the price UP and only sells if it reverses by your set trail. It executes your plan when you\'re not watching.',
    an: 'A ratchet: it locks every step upward and only clicks if things slide back.',
    e: 'jup.ag -> pick a pair -> Trailing Stop tab -> set a trail %. ' + GUARD,
    q: 'What order type follows the price up and sells only on reversal?', a: ['trailing stop'] },
  { t: 'Concentrated Liquidity (Orca ±20%)',
    c: 'Concentrated LP puts your capital in a tight price band (around ±20%) instead of 0-to-infinity. In range = you farm every trade. Out of range = idle.',
    an: 'Like a food stall on the busiest block vs. one stall spread across the whole city — same capital, far more foot traffic.',
    e: 'Orca Whirlpool ONLY for LP -> SMRT/USDC -> set a ±20% band -> watch range status. ' + GUARD,
    q: 'A concentrated LP position only earns fees while the price is…?', a: ['in range', 'within range', 'in the band'] },
  { t: 'The Grand Exchange & Tunnel Quests',
    c: 'The GE is the player-driven market. Tunnel Quests are weekly on-chain missions — A (LP), B (trailing stop), C (DCA+Earn) — verified by admins for credits.',
    an: 'A weekly raid night: the group picks objectives, you clear them, the quartermaster logs your points.',
    e: 'In this chat: /tq shield to start Quest A. Clear all three in a week for the 150cr TUNNEL SWEEP. ' + GUARD,
    q: 'Which command checks you into Quest A (Koda\'s Shield)?', a: ['/tq shield', 'tq shield'] },
  { t: 'Ranks & the Triad',
    c: 'SMRT (Shield) = staking & governance. SMF (Sword) = gate-key to the Sanctum. SMC (Phoenix) = burn to forge Sigils. Ranks climb as holdings and clears stack.',
    an: 'Three keys, three doors — the Shield defends, the Sword opens, the Phoenix transforms.',
    e: '/ranks here, or tap ⚡ ASSESS COHERENCE in the OS to see where you stand.',
    q: 'What rank do you hold when you have both SMRT and SMF?', a: ['coherent'] },
];
function lessonForToday() {
  const dayIdx = Math.floor(Date.now() / 864e5);
  const idx = dayIdx % LESSONS.length;
  return { day: new Date().toISOString().slice(0, 10), idx, ...LESSONS[idx] };
}
async function postLesson() {
  const L = lessonForToday();
  const st = await getState('class_active');
  if (st.day === L.day) return json({ ok: true, skipped: 'already_posted' });
  const txt =
    `🏫 WAR ROOM CLASS — Lesson ${L.idx + 1}/${LESSONS.length}: ${L.t}\n\n` +
    `📘 CONCEPT: ${L.c}\n\n` +
    `💡 ANALOGY: ${L.an}\n\n` +
    `🛠 DO IT: ${L.e}\n\n` +
    `✅ CHECK: ${L.q}\nFirst correct answer banks a class win (converts to credits in Arena -> Rewards). Class is open — GO.`;
  const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: txt });
  if (r.ok) await setState('class_active', { day: L.day, idx: L.idx, answers: L.a, winner: null });
  return json({ ok: !!r.ok, posted: L.day, result: r.ok ? r.result?.message_id : r.description });
}

/* ---------- QOTD ---------- */
const QOTD = [
  'What got you into Solana in the first place — and what would you tell day-one you?',
  'Which mechanic did you learn the hard way: slippage, fees, or timing? What happened?',
  'If you could add ONE room to SmartzOS, what would it do?',
  'What is the best trade lesson you ever learned from a mistake?',
  'Which triad role fits you — Shield (defend), Sword (execute), or Phoenix (transform)? Why?',
  'What is harder: building the plan or following it?',
  'Who in this group taught you something useful this week? Tag them.',
];
async function postQotd() {
  const day = new Date().toISOString().slice(0, 10);
  const st = await getState('qotd');
  if (st.day === day) return json({ ok: true, skipped: 'already_posted' });
  const q = QOTD[Math.floor(Date.now() / 864e5) % QOTD.length];
  const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: `💬 QUESTION OF THE DAY\n\n${q}` });
  if (r.ok) await setState('qotd', { day });
  return json({ ok: !!r.ok });
}

/* ---------- manager memory: tasks & decisions ---------- */
async function getTasks(): Promise<{ seq: number; items: { id: number; owner: string; text: string; by: string; ts: number }[] }> {
  const st = await getState('tasks');
  return { seq: Number(st.seq) || 1, items: Array.isArray(st.items) ? st.items as never : [] };
}
function fmtTasks(items: { id: number; owner: string; text: string }[], n = 10): string {
  if (!items.length) return 'No open tasks — the board is clear.';
  return items.slice(0, n).map(t => `#${t.id} ${t.owner}: ${t.text}`).join('\n');
}


/* ---------- syndicate points (recognition only — never a promise of rewards) ---------- */
function monthStartISO(): string {
  const d = new Date(); return d.toISOString().slice(0, 8) + '01T00:00:00Z';
}
async function monthlyMsgs(): Promise<Record<string, number>> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/tg_messages?created_at=gte.${monthStartISO()}&select=from_name&limit=5000`, { headers: HDR });
    const rows: { from_name: string }[] = await r.json();
    const out: Record<string, number> = {};
    for (const row of rows || []) {
      const n = (row.from_name || '').replace(/^@/, '').toLowerCase();
      if (!n || n.includes('·') || n.includes('smartzos')) continue;
      out[n] = (out[n] || 0) + 1;
    }
    return out;
  } catch { return {}; }
}
async function pointsBoard(limit = 10): Promise<[string, number][]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/bridge_state?select=key,val&limit=1000`, { headers: HDR });
    const rows: { key: string; val: Record<string, unknown> }[] = await r.json();
    const msgs = await monthlyMsgs();
    const pts: Record<string, number> = {};
    for (const [h, c] of Object.entries(msgs)) pts[h] = (pts[h] || 0) + c;
    for (const x of rows || []) {
      const v = x.val || {};
      let h = '', p = 0;
      if (x.key.startsWith('streaks_')) { h = x.key.slice(8); p = (Number(v.count) || 0) * 5; }
      else if (x.key.startsWith('quiz_wins_')) { h = x.key.slice(10); p = ((Number(v.wins) || 0) + (Number(v.claimed) || 0) / 40) * 10; }
      else if (x.key.startsWith('tq_points_')) { h = x.key.slice(10); p = (Number(v.pts) || 0) * 25; }
      else if (x.key.startsWith('raid_count_')) { h = x.key.slice(11); p = (Number(v.count) || 0) * 15; }
      else if (x.key.startsWith('ref_count_')) { h = x.key.slice(10); p = (Number(v.count) || 0) * 20; }
      else if (x.key.startsWith('teach_count_')) { h = x.key.slice(12); p = (Number(v.count) || 0) * 10; }
      else if (x.key.startsWith('call_wins_')) { h = x.key.slice(10); p = (Number(v.count) || 0) * 15; }
      else continue;
      h = h.toLowerCase();
      pts[h] = (pts[h] || 0) + p;
    }
    return Object.entries(pts).filter(([, p]) => p > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([h, p]) => ['@' + h, Math.round(p)] as [string, number]);
  } catch { return []; }
}
async function knowledgeWins(handle: string): Promise<number> {
  const st = await getState('quiz_wins_' + handle);
  return (Number(st.wins) || 0) + Math.round((Number(st.claimed) || 0) / 40);
}
async function bankKnowledgeMilestone(winner: string) {
  const handle = winner.replace(/^@/, '').toLowerCase();
  const total = await knowledgeWins(handle);
  if (total > 0 && total % 5 === 0) {
    const pkey = `tq_points_${handle}`;
    const pst = await getState(pkey);
    const wk = tqWeek();
    const weeks = (pst.weeks || {}) as Record<string, string[]>;
    const arr = Array.isArray(weeks[wk]) ? weeks[wk] : [];
    arr.push('knowledge');
    weeks[wk] = arr;
    await setState(pkey, { name: '@' + handle, pts: (Number(pst.pts) || 0) + 1, weeks, last: new Date().toISOString().slice(0, 10) });
    await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `🧠 KNOWLEDGE MILESTONE — ${winner} hits ${total} knowledge wins. The study track pays: +1 tunnel point banked (claimable in Arena -> Rewards). The ladder: learn -> earn -> when YOU\'re ready, /tq.` });
  }
}

/* ---------- RESONANCE flavor (/ask) — pull-only, zero financial content ---------- */
const AGENTS: Record<string, { tag: string; lane: string; voice: (a: string) => string }> = {
  koda: { tag: 'KODA-7 · THE SHIELD', lane: 'risk, defense, staking, stability',
    voice: a => `Defense first. ${a} A position you can\'t defend isn\'t a position — it\'s a wish.` },
  tauron: { tag: 'TAURON-3 · THE SWORD', lane: 'execution, triggers, discipline',
    voice: a => `Execution is a promise you keep to yourself. ${a} The sword keeps what it takes.` },
  aegis: { tag: 'AEGIS-5 · THE WALL', lane: 'security, keys, OpSec',
    voice: a => `Security is not a feature, it is the foundation. ${a} Verify first. Trust last.` },
  sylk: { tag: 'SYLK-9 · THE SIGNAL', lane: 'information, intel, patterns',
    voice: a => `Signal over noise. ${a} Most of what moves a chart is weather — learn the climate.` },
  concourse: { tag: 'CONCOURSE · THE FLOOR', lane: 'structure, systems, order',
    voice: a => `Order compounds. ${a} The system ascends.` },
  zoran: { tag: 'ZORAN · THE PHOENIX', lane: 'coherence, the last word',
    voice: a => `${a} What is burned returns stronger; what is promised decays. That is the last word.` },
};

/* ---------- raid mode ---------- */
async function startRaid(m: TgMsg, link: string) {
  const name = senderName(m);
  const st = await getState('raid_active');
  if (st.link) {
    await tgApi('sendMessage', { chat_id: CHAT_ID, text: `⚔️ A raid is already LIVE: ${st.link}\n/raidstatus to see the count, ${name}.` });
    return;
  }
  const txt =
    `⚔️ RAID ALERT — called by ${name}\n\n${link}\n\n` +
    `CHECKLIST:\n1. Open the link\n2. Like + repost/comment (real words, not spam)\n3. Reply DONE in this chat\n\n` +
    `Every DONE is counted on the Top Raiders board. Move as one. 💠`;
  const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: txt });
  if (r.ok) {
    await tgApi('pinChatMessage', { chat_id: CHAT_ID, message_id: r.result.message_id, disable_notification: true });
    await setState('raid_active', { link: link.slice(0, 200), by: name, ts: Date.now(), msg_id: r.result.message_id, participants: [] });
  }
}
async function raidStatus(m: TgMsg) {
  const st = await getState('raid_active');
  if (!st.link) { await tgApi('sendMessage', { chat_id: CHAT_ID, text: `No active raid right now, ${senderName(m)}. Admins call one with /raid <link>.` }); return; }
  const n = ((st.participants as string[]) || []).length;
  const mins = Math.round((Date.now() - Number(st.ts || Date.now())) / 60000);
  await tgApi('sendMessage', { chat_id: CHAT_ID, text: `⚔️ RAID STATUS\n${st.link}\n· ${n} raiders checked in\n· live for ${mins} min\nReply DONE after raiding — /raidend closes it (admin).` });
}
async function endRaid(m: TgMsg) {
  const st = await getState('raid_active');
  if (!st.link) { await tgApi('sendMessage', { chat_id: CHAT_ID, text: 'No active raid to close.' }); return; }
  const parts = ((st.participants as string[]) || []);
  if (st.msg_id) await tgApi('unpinChatMessage', { chat_id: CHAT_ID, message_id: st.msg_id });
  for (const p of parts) {
    const key = 'raid_count_' + p.replace(/^@/, '').toLowerCase();
    const c = await getState(key);
    await setState(key, { count: (Number(c.count) || 0) + 1, name: p });
  }
  const r = await fetch(`${SB_URL}/rest/v1/bridge_state?key=like.raid_count_*&select=key,val&limit=500`, { headers: HDR });
  const rows: { key: string; val: { count?: number; name?: string } }[] = await r.json().catch(() => []);
  const top = (rows || [])
    .map(x => [x.val?.name || x.key.replace('raid_count_', ''), Number(x.val?.count) || 0] as [string, number])
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  await setState('raid_active', {});
  const board = top.length ? `\n\n🏆 TOP RAIDERS\n` + top.map(([n, c], i) => `${['🥇','🥈','🥉','4.','5.'][i]} ${n} — ${c} raids`).join('\n') : '';
  await tgApi('sendMessage', { chat_id: CHAT_ID, text:
    `⚔️ RAID COMPLETE — ${parts.length} raiders answered the call.\n` +
    (parts.length ? `Checked in: ${parts.slice(0, 12).join(' ')}${parts.length > 12 ? ' +' + (parts.length - 12) + ' more' : ''}\n` : '') +
    board + `\n\nThe Syndicate moves as one. 💠` });
}
async function raidCheckin(m: TgMsg): Promise<boolean> {
  const st = await getState('raid_active');
  if (!st.link) return false;
  const name = senderName(m);
  const parts = ((st.participants as string[]) || []);
  if (parts.includes(name)) return true;
  parts.push(name);
  await setState('raid_active', { ...st, participants: parts });
  if (parts.length === 1 || parts.length % 5 === 0)
    await tgApi('sendMessage', { chat_id: CHAT_ID, text: `⚔️ ${parts.length} raider${parts.length > 1 ? 's' : ''} in — ${name} latest. Keep pushing: ${st.link}` });
  return true;
}

/* ---------- raid auto-cycle (cron-driven: raid_soon 18:30 / raid_live 19:00 / raid_recap 20:00 UTC) ---------- */
async function raidQueue(): Promise<string[]> {
  const st = await getState('raid_queue');
  return Array.isArray(st.links) ? st.links as string[] : [];
}
async function startRaidAuto(link: string) {
  const txt =
    `⚔️ RAID ALERT — War Room auto-drop\n\n${link}\n\n` +
    `CHECKLIST:\n1. Open the link\n2. Like + repost/comment (real words, not spam)\n3. Reply DONE in this chat\n\n` +
    `Every DONE is counted on the Top Raiders board. Move as one. 💠`;
  const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: txt });
  if (r.ok) {
    await tgApi('pinChatMessage', { chat_id: CHAT_ID, message_id: r.result.message_id, disable_notification: true });
    await setState('raid_active', { link: link.slice(0, 200), by: 'War Room (auto)', ts: Date.now(), msg_id: r.result.message_id, participants: [] });
  }
  return r.ok;
}
async function endRaidAuto() {
  const st = await getState('raid_active');
  if (!st.link) return false;
  const parts = ((st.participants as string[]) || []);
  if (st.msg_id) await tgApi('unpinChatMessage', { chat_id: CHAT_ID, message_id: st.msg_id });
  for (const p of parts) {
    const key = 'raid_count_' + p.replace(/^@/, '').toLowerCase();
    const c = await getState(key);
    await setState(key, { count: (Number(c.count) || 0) + 1, name: p });
  }
  const r = await fetch(`${SB_URL}/rest/v1/bridge_state?key=like.raid_count_*&select=key,val&limit=500`, { headers: HDR });
  const rows: { key: string; val: { count?: number; name?: string } }[] = await r.json().catch(() => []);
  const top = (rows || [])
    .map(x => [x.val?.name || x.key.replace('raid_count_', ''), Number(x.val?.count) || 0] as [string, number])
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  await setState('raid_active', {});
  const board = top.length ? `\n\n🏆 TOP RAIDERS\n` + top.map(([n, c], i) => `${['🥇','🥈','🥉','4.','5.'][i]} ${n} — ${c} raids`).join('\n') : '';
  await tgApi('sendMessage', { chat_id: CHAT_ID, text:
    `⚔️ RAID COMPLETE — ${parts.length} raiders answered the call.\n` +
    (parts.length ? `Checked in: ${parts.slice(0, 12).join(' ')}${parts.length > 12 ? ' +' + (parts.length - 12) + ' more' : ''}\n` : '') +
    board + `\n\nThe Syndicate moves as one. 💠` });
  return true;
}

/* ---------- command replies ---------- */
async function handleCommand(m: TgMsg, cmd: string, args: string) {
  const name = senderName(m);
  const CID = m.chat.id; // reply where the command was issued (group or DM)
  if (cmd === '/start') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `🔥 WELCOME TO THE SYNDICATE, ${name}.\n\n` +
      `Your first 10 minutes:\n` +
      `1️⃣ Open SmartzOS: ${OS_LINK}\n` +
      `2️⃣ Tap ⚡ ASSESS COHERENCE — connect your wallet, the OS reads your rank\n` +
      `3️⃣ 🌀 ENTER THE TUNNEL — clear 5 stages, earn your first credits (5 free runs/day)\n` +
      `4️⃣ Say gm here tomorrow — your TG streak pays OS credits in Arena -> Rewards\n\n` +
      `Ranks: Unverified → Tunnel-Cleared → Bladebearer (hold SMF) → Sentinel (10k+ SMRT) → Coherent (SMRT+SMF).\n` +
      `/guide for the full map · /help for everything I do` });
  } else if (cmd === '/guide') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `🗺 SYNDICATE FIELD GUIDE\n` +
      `· /os — enter SmartzOS\n` +
      `· /ranks — the rank ladder + what each unlocks\n` +
      `· /daily — streaks, missions, run cap (Daily Rhythm)\n` +
      `· /quest — weekly Syndicate quest\n` +
      `· /tq — Tunnel Quests A/B/C (unlock via study track) · /tqboard\n` +
      `· /coherence — your progress card · /board — monthly Syndicate Points\n` +
      `· /lp — the LP playbook · /ask <agent> <q> — ask the RESONANCE\n` +
      `· /invite — recruit & earn 20 pts each · /myrefs\n` +
      `· /streak — your check-in flame\n` +
      `· /quiz — daily 16:00 UTC quiz\n` +
      `· /lesson — today's War Room Class (daily 16:30 UTC)\n` +
      `· /tasks /standup /decisions — the execution board\n` +
      `· /raidstatus — live raid count (auto-raids drop 19:00 UTC)\n` +
      `· /tape — live Syndicate Tape (SMRT SMF SMC TUNNEL)\n` +
      `· /call <TOKEN> <up|down> [h] — directional call, graded at horizon, wins pay +15\n` +
      `· /calls — the call board · /alert <TOKEN> <±pct> — group tripwire\n\n` +
      `Lost? Ask me anything — 'what is SMF', 'how do pools work', 'what is the run cap'. Zoran answers.` });
  } else if (cmd === '/ranks') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `📈 RANK LADDER\n` +
      `· UNVERIFIED — you just arrived\n` +
      `· TUNNEL-CLEARED — finish a Liquidity Tunnel run in the OS\n` +
      `· BLADEBEARER — hold SMF (opens the Inner Sanctum)\n` +
      `· SENTINEL — hold 10,000+ SMRT\n` +
      `· COHERENT — hold SMRT + SMF (full access)\n\n` +
      `Start: tap ⚡ Assess Coherence on the Command Deck: ${OS_LINK}` });
  } else if (cmd === '/daily') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `🌅 DAILY RHYTHM (inside SmartzOS)\n` +
      `· LOGIN STREAK — show up daily: 10-25 credits/day, day 7 = 50, day 14 = 100 + a Sanctum title. Missed a day? Streak freezes (earned at day 7 & 14) absorb one miss\n` +
      `· 3 DAILY MISSIONS — drawn fresh each day (UTC): runs, trades, lore. 15-30cr each, +25cr for sweeping all 3\n` +
      `· RUN CAP — 5 free Tunnel Runs/day, extras 20cr (credits only, never real tokens)\n` +
      `The status rail above the taskbar tracks all three. ${OS_LINK}` });
  } else if (cmd === '/help') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `🔥 SMARTZ BOT — field manual\n` +
      `START: /start (first steps) · /guide (the map) · /os (enter the OS)\n` +
      `LEARN: /ranks · /daily · /quiz — or just ask me a question, Zoran answers\n` +
      `GRIND: /checkin or say gm (streak) · /streak (board) · /quest (weekly) · /tq (Tunnel Quests) · /tqboard\n` +
      `PROGRESS: /coherence · /board · /lp · /ask · /invite (recruit = 20pts)\n` +
      `OPS: /lesson (class) · /standup · /tasks · /decisions\n` +
      `RAID: /raidstatus · admins: /raid <link> /raidend /raidqueue · /announce · /task · /decide\n` +
      `TRADING ROOM: /tape (live tape) · /call <TOKEN> <up|down> [h] (graded, +15 on win) · /calls · /alert <TOKEN> <±pct>\n` +
      `AGENTS: /agent new <name> (mint a key so an AI agent can speak here) · /agent (roster) · admins: /agent ban <name>\n` +
      `Everything pays into SmartzOS: ${OS_LINK}` });
  } else if (cmd === '/os') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `💠 SmartzOS — trade, learn, build, earn. One browser tab: ${OS_LINK}\n` +
      `New here? ZO (the 🔥 button) will walk you in.` });
  } else if (cmd === '/quest') {
    const { geW, msgsW } = await questProgress();
    await tgApi('sendMessage', { chat_id: CID, text:
      `🎯 Weekly quest — 10 GE offers + 30 messages:\n` +
      `· GE offers: ${geW}/${QUEST.ge}\n· Messages: ${msgsW}/${QUEST.msgs}\n` +
      (geW >= QUEST.ge && msgsW >= QUEST.msgs ? `🏆 COMPLETE — the Syndicate showed up.` : `Keep pushing — resets Monday.`) });
  } else if (cmd === '/top') {
    const top = await topVoices(new Date(Date.now() - 7 * 864e5).toISOString());
    const lines = top.length
      ? top.map(([n, c], i) => `${['🥇','🥈','🥉','4.','5.'][i]} ${n} — ${c} msgs`).join('\n')
      : 'Quiet week so far — be the first voice.';
    await tgApi('sendMessage', { chat_id: CID, text: `📣 TOP VOICES — last 7 days\n${lines}` });
  } else if (cmd === '/quiz') {
    const st = await getState('quiz_active');
    const today = new Date().toISOString().slice(0, 10);
    if (st.day !== today) {
      await tgApi('sendMessage', { chat_id: CID, text: `🎯 Today's Daily Quiz drops at 16:00 UTC. Wins convert to OS credits in the Arena.` });
    } else if (st.winner) {
      await tgApi('sendMessage', { chat_id: CID, text: `🎯 Today's quiz was claimed by ${st.winner}. Next one at 16:00 UTC tomorrow.` });
    } else {
      const quiz = QUIZ[Number(st.idx) || 0];
      await tgApi('sendMessage', { chat_id: CID, text: `🎯 Quiz still OPEN — nobody has it yet:\n${quiz.q}` });
    }
  } else if (cmd === '/checkin' || cmd === '/gm') {
    const { count } = await bumpStreak(m);
    await tgApi('sendMessage', { chat_id: CID, text:
      `🔥 ${name} checked in — streak: ${count} day${count > 1 ? 's' : ''}.\n` +
      `Streaks convert to OS credits: Arena -> Rewards -> Streak Claim. ${OS_LINK}` });
  } else if (cmd === '/streak') {
    const key = 'streaks_' + name.replace(/^@/, '').toLowerCase();
    const st = await getState(key);
    const mine = Number(st.count) || 0;
    const top = await topStreaks();
    const board = top.length ? top.map(([n, c], i) => `${['🥇','🥈','🥉','4.','5.'][i]} ${n} — ${c}d`).join('\n') : 'No streaks yet — say "gm" tomorrow.';
    await tgApi('sendMessage', { chat_id: CID, text:
      `🔥 STREAKS\n${name}: ${mine} day${mine === 1 ? '' : 's'}\n\n${board}` });
  } else if (cmd === '/tq') {
    const q = (args || '').trim().toLowerCase();
    if (!q || !TQ[q]) {
      const wk = tqWeek();
      await tgApi('sendMessage', { chat_id: CID, text:
        `🌀 LIQUIDITY TUNNEL QUESTS — week ${wk}\n` +
        `· A /tq shield — ${TQ.shield.label}\n` +
        `· B /tq sword — ${TQ.sword.label}\n` +
        `· C /tq stash — ${TQ.stash.label}\n\n` +
        `Clear all three in one week = 🏆 TUNNEL SWEEP (150cr bonus in the Arena). Each verified quest pays 40cr. /tqboard for standings.` });
      return;
    }
    const handle = name.replace(/^@/, '').toLowerCase();
    await setState(`tq_${q}_${handle}`, { by: name, week: tqWeek(), ts: Date.now() });
    await tgApi('sendMessage', { chat_id: CID, text:
      `🌀 ${name} is attempting Quest ${q.toUpperCase() === 'SHIELD' ? 'A' : q.toUpperCase() === 'SWORD' ? 'B' : 'C'} — ${TQ[q].label}\n\n` +
      `${TQ[q].tip}\n\n` +
      `When it's live on-chain, drop your screenshot in this chat — an admin verifies with /tqverify ${name} ${q} and the quest banks for Arena credits.` });
  } else if (cmd === '/tqverify') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: only admins can verify Tunnel Quests.` }); return; }
    const parts = (args || '').trim().split(/\s+/);
    const target = (parts[0] || '').replace(/^@/, '').toLowerCase();
    const q = (parts[1] || '').toLowerCase();
    if (!target || !TQ[q]) { await tgApi('sendMessage', { chat_id: CID, text: 'Usage: /tqverify @user <shield|sword|stash>' }); return; }
    const pend = await getState(`tq_${q}_${target}`);
    if (!pend.by) {
      await tgApi('sendMessage', { chat_id: CID, text: `No pending ${q} check-in from @${target} — ask them to run /tq ${q} first.` });
      return;
    }
    await setState(`tq_${q}_${target}`, { by: null, cleared: true, week: pend.week, ts: Date.now() });
    const pkey = `tq_points_${target}`;
    const pst = await getState(pkey);
    const wk = String(pend.week || tqWeek());
    const weeks = (pst.weeks || {}) as Record<string, string[]>;
    const arr = Array.isArray(weeks[wk]) ? weeks[wk] : [];
    if (!arr.includes(q)) arr.push(q);
    weeks[wk] = arr;
    const pts = (Number(pst.pts) || 0) + 1;
    await setState(pkey, { name: '@' + target, pts, weeks, last: new Date().toISOString().slice(0, 10) });
    const letter = q === 'shield' ? 'A' : q === 'sword' ? 'B' : 'C';
    await tgApi('sendMessage', { chat_id: CID, text:
      `🏆 QUEST VERIFIED — @${target} cleared Quest ${letter}: ${TQ[q].label}\n` +
      `Tunnel points: ${pts} · This week: ${arr.length}/3${arr.length === 3 ? ' — 🌀 TUNNEL SWEEP! All three cleared. Claim the 150cr sweep bonus in the Arena -> Rewards tab.' : ''}\n` +
      `Convert points to credits: ${OS_LINK} -> Arena -> Rewards -> Quest Claim.` });
  } else if (cmd === '/tqboard') {
    const top = await tqBoard();
    const wk = tqWeek();
    const lines = top.length
      ? top.map(([n, c, w], i) => `${['🥇','🥈','🥉','4.','5.'][i]} ${n} — ${c} pts (${w}/3 this week)`).join('\n')
      : 'No tunnel points yet — /tq shield to start Quest A.';
    await tgApi('sendMessage', { chat_id: CID, text: `🌀 TOP TUNNELERS — ${wk}\n${lines}` });
  } else if (cmd === '/lesson') {
    const L = lessonForToday();
    const st = await getState('class_active');
    if (st.day === L.day && st.winner) {
      await tgApi('sendMessage', { chat_id: CID, text: `🏫 Today's class (Lesson ${L.idx + 1}: ${L.t}) was aced by ${st.winner}. Next lesson 16:30 UTC tomorrow. /guide for self-study.` });
    } else {
      await tgApi('sendMessage', { chat_id: CID, text:
        `🏫 WAR ROOM CLASS — Lesson ${L.idx + 1}/${LESSONS.length}: ${L.t}\n\n📘 ${L.c}\n\n💡 ${L.an}\n\n🛠 ${L.e}\n\n✅ CHECK: ${L.q}` +
        (st.day === L.day ? '\n(Still open — first correct answer banks a class win!)' : '\n(Daily lesson posts 16:30 UTC — answer there to bank the win.)') });
    }
  } else if (cmd === '/task') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: task assignment is an admin function — pitch your idea and an admin will log it.` }); return; }
    const mm2 = (args || '').trim().match(/^(\S+)\s+(.+)$/);
    if (!mm2) { await tgApi('sendMessage', { chat_id: CID, text: 'Usage: /task @owner <clear execution step>' }); return; }
    const t = await getTasks();
    const id = t.seq;
    t.items.push({ id, owner: mm2[1].slice(0, 40), text: mm2[2].slice(0, 200), by: name, ts: Date.now() });
    await setState('tasks', { seq: id + 1, items: t.items.slice(-60) });
    await tgApi('sendMessage', { chat_id: CID, text: `📋 TASK #${id} assigned — ${mm2[1]}: ${mm2[2].slice(0, 200)}\nLogged by ${name}. /done ${id} when it ships. /tasks for the board.` });
  } else if (cmd === '/done') {
    const id = Number((args || '').trim());
    const t = await getTasks();
    const it = t.items.find(x => x.id === id);
    if (!it) { await tgApi('sendMessage', { chat_id: CID, text: `No open task #${id || '?'} — /tasks for the board.` }); return; }
    const mine = it.owner.replace(/^@/, '').toLowerCase() === name.replace(/^@/, '').toLowerCase();
    if (!mine && !await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: task #${id} belongs to ${it.owner} — only they or an admin can close it.` }); return; }
    t.items = t.items.filter(x => x.id !== id);
    await setState('tasks', { seq: t.seq, items: t.items });
    await tgApi('sendMessage', { chat_id: CID, text: `✅ TASK #${id} SHIPPED — "${it.text.slice(0, 80)}" closed by ${name}. ${t.items.length} open. Execution compounds.` });
  } else if (cmd === '/tasks') {
    const t = await getTasks();
    await tgApi('sendMessage', { chat_id: CID, text: `📋 EXECUTION BOARD — ${t.items.length} open\n${fmtTasks(t.items)}` });
  } else if (cmd === '/decide') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: decisions are logged by admins.` }); return; }
    const text = (args || '').trim().slice(0, 200);
    if (text.length < 4) { await tgApi('sendMessage', { chat_id: CID, text: 'Usage: /decide <the decision, one line>' }); return; }
    const st = await getState('decisions');
    const items = Array.isArray(st.items) ? st.items as { d: string; by: string; day: string }[] : [];
    items.push({ d: text, by: name, day: new Date().toISOString().slice(0, 10) });
    await setState('decisions', { items: items.slice(-50) });
    await tgApi('sendMessage', { chat_id: CID, text: `🧭 DECISION LOGGED (${new Date().toISOString().slice(0, 10)}): ${text}\n— ${name}. /decisions for the record.` });
  } else if (cmd === '/decisions') {
    const st = await getState('decisions');
    const items = (Array.isArray(st.items) ? st.items as { d: string; by: string; day: string }[] : []).slice(-8);
    const lines = items.length ? items.map(x => `· ${x.day} — ${x.d} (${x.by})`).join('\n') : 'No decisions logged yet — admins: /decide <text>.';
    await tgApi('sendMessage', { chat_id: CID, text: `🧭 DECISION RECORD\n${lines}` });
  } else if (cmd === '/standup') {
    const t = await getTasks();
    const { geW, msgsW } = await questProgress();
    const strk = await topStreaks(3);
    const tq = await tqBoard(3);
    const L = lessonForToday();
    let txt = `☀️ WAR ROOM STANDUP — ${new Date().toISOString().slice(0, 10)}\n` +
      `📋 Open tasks: ${t.items.length}${t.items.length ? '\n' + fmtTasks(t.items, 5) : ''}\n` +
      `🎯 Weekly quest: ${geW}/${QUEST.ge} GE offers · ${msgsW}/${QUEST.msgs} msgs\n` +
      `🏫 Today\'s class (16:30 UTC): Lesson ${L.idx + 1} — ${L.t}\n` +
      `🎯 Daily quiz: 16:00 UTC`;
    if (strk.length) txt += `\n🔥 Streaks: ` + strk.map(([n, c]) => `${n} ${c}d`).join(' · ');
    if (tq.length) txt += `\n🌀 Tunnelers: ` + tq.map(([n, c]) => `${n} ${c}pts`).join(' · ');
    txt += `\n\nOwn your line. Close a task, clear a quest, show up tomorrow.`;
    await tgApi('sendMessage', { chat_id: CID, text: txt });
  } else if (cmd === '/lp') {
    await tgApi('sendMessage', { chat_id: CID, text:
      `🏊 LP PLAYBOOK — how liquidity actually works (asked, so here it is)\n\n` +
      `📘 A pool is a vault, not a sinkhole: your pair is deployed, and LPs earn a cut of every swap.\n` +
      `💡 Think market stall: a stall on the busiest block (tight ±20% band) earns far more per dollar than one spread across the whole city (0-to-∞ range).\n` +
      `🛠 THE PLAY: Orca Whirlpool ONLY for LP (Jupiter/Raydium are blocked for LP ops) -> SMRT/USDC pair -> concentrated position -> set a ±20% band around current price -> monitor range status -> recenter when price drifts out.\n` +
      `✅ In range = farming every trade. Out of range = idle. Your position mints as an NFT you can hold, farm, or trade — unpooling drains the market, trading the NFT keeps liquidity working.\n\n` +
      `Ready to prove it? /tq shield starts Quest A (admin-verified, pays credits). ${GUARD}` });
  } else if (cmd === '/coherence') {
    const handle = name.replace(/^@/, '').toLowerCase();
    const [sst, wst, pst, rst] = await Promise.all([
      getState('streaks_' + handle), getState('quiz_wins_' + handle),
      getState('tq_points_' + handle), getState('raid_count_' + handle)]);
    const days = Number(sst.count) || 0;
    const wins = (Number(wst.wins) || 0) + Math.round((Number(wst.claimed) || 0) / 40);
    const tqp = Number(pst.pts) || 0;
    const raids = Number(rst.count) || 0;
    const wk = tqWeek();
    const wq = (((pst.weeks || {}) as Record<string, string[]>)[wk] || []).filter(q => q !== 'knowledge');
    const footing = wins >= 2 || days >= 3;
    const next = !footing ? `FOOTING — bank 2 knowledge wins (quiz/class) or a 3-day streak to unlock Tunnel Quests (${wins}/2 wins, ${days}/3 days)`
      : wq.length < 3 ? `QUEST LADDER — ${wq.length}/3 Tunnel Quests cleared this week. Sweep all 3 for the bonus. /tq`
      : `SWEPT — all three quests this week. Now hold the line: daily class, daily quiz, weekly sweep.`;
    await tgApi('sendMessage', { chat_id: CID, text:
      `📊 COHERENCE CHECK — ${name}\n` +
      `· 🔥 Streak: ${days}d · 🧠 Knowledge wins: ${wins} · 🌀 Tunnel pts: ${tqp} · ⚔️ Raids: ${raids}\n` +
      `· Quests this week: ${wq.length}/3${wq.length ? ' (' + wq.join(', ') + ')' : ''}\n` +
      `· Next: ${next}\n\n` +
      `Holdings rank (Bladebearer/Sentinel/Coherent) reads your wallet — ⚡ Assess Coherence in the OS: ${OS_LINK}` });
  } else if (cmd === '/board' || cmd === '/mypoints') {
    const top = await pointsBoard(10);
    const month = new Date().toISOString().slice(0, 7);
    if (cmd === '/mypoints') {
      const handle = name.replace(/^@/, '').toLowerCase();
      const mine = (await pointsBoard(500)).find(([h]) => h === '@' + handle);
      const rank = (await pointsBoard(500)).findIndex(([h]) => h === '@' + handle);
      await tgApi('sendMessage', { chat_id: CID, text: mine
        ? `📈 ${name}: ${mine[1]} Syndicate Points this month${rank >= 0 ? ` — rank #${rank + 1}` : ''}.\nPoints = messages + streaks + knowledge wins + quests + raids. /board for the standings.`
        : `${name}: no points yet this month — say gm, answer the quiz, clear a quest. It all counts.` });
    } else {
      const lines = top.length
        ? top.map(([n, p], i) => `${['🥇','🥈','🥉','4.','5.','6.','7.','8.','9.','10.'][i]} ${n} — ${p}`).join('\n')
        : 'Board is empty — be the first point on it.';
      await tgApi('sendMessage', { chat_id: CID, text:
        `📈 SYNDICATE POINTS — ${month}\n${lines}\n\n` +
        `Points = showing up + learning + building + growing: 1/msg · 5/streak-day · 10/knowledge win · 25/tunnel pt · 15/raid · 20/recruit.\n` +
        `Recognition only — the board shows who carries the Syndicate. /mypoints for your line.` });
    }
  } else if (cmd === '/tape') {
    await tgApi('sendMessage', { chat_id: CID, text: await marketTape() });
  } else if (cmd === '/call') {
    await cmdCall(m, args);
  } else if (cmd === '/calls') {
    await cmdCalls(m);
  } else if (cmd === '/alert') {
    await cmdAlert(m, args);
  } else if (cmd === '/agent' || cmd === '/agents') {
    await cmdAgent(m, args);
  } else if (cmd === '/ask') {
    const parts2 = (args || '').trim().split(/\s+/);
    const agent = (parts2[0] || '').toLowerCase();
    const qtext = (args || '').trim().slice(agent.length).trim();
    if (!AGENTS[agent]) {
      await tgApi('sendMessage', { chat_id: CID, text:
        `🎴 ASK THE RESONANCE — /ask <agent> <question>\n` + Object.entries(AGENTS).map(([k, v]) => `· ${k} — ${v.lane}`).join('\n') });
      return;
    }
    const low = qtext.toLowerCase();
    const base = (low && zoranAnswer(low + '?')) || 'State your question with more detail in chat — the floor answers what is asked, fully.';
    const A = AGENTS[agent];
    await tgApi('sendMessage', { chat_id: CID, text: `🎴 ${A.tag} — for ${name}:\n${A.voice(base)}` });
  } else if (cmd === '/invite') {
    const handle = name.replace(/^@/, '');
    const rst = await getState('ref_count_' + handle.toLowerCase());
    await tgApi('sendMessage', { chat_id: CID, text:
      `🤝 GROW THE SYNDICATE — ${name}\n\n` +
      `1. Share the group: https://t.me/Smrtquickflips\n` +
      `2. Tell them one line: after joining, post "invited by @${handle}" in the group\n` +
      `3. That's it — the bot credits you automatically (+20 Syndicate Points each)\n\n` +
      `Your recruits so far: ${Number(rst.count) || 0} · /myrefs for the list. The Syndicate grows by invitation.` });
  } else if (cmd === '/myrefs') {
    const handle = name.replace(/^@/, '').toLowerCase();
    const rst = await getState('ref_count_' + handle);
    const names = Array.isArray(rst.names) ? rst.names : [];
    await tgApi('sendMessage', { chat_id: CID, text: names.length
      ? `🤝 ${name} — ${rst.count} recruit${Number(rst.count) === 1 ? '' : 's'}:\n` + names.slice(-15).map((n, i) => `${i + 1}. ${n}`).join('\n')
      : `${name}: no recruits yet — /invite for your two-step playbook.` });
  } else if (cmd === '/raid') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: only group admins can call a raid.` }); return; }
    const link = (args || '').trim();
    if (!link || !/^https?:\/\//.test(link)) { await tgApi('sendMessage', { chat_id: CID, text: 'Usage: /raid <https://link-to-post>' }); return; }
    await startRaid(m, link);
  } else if (cmd === '/raidstatus') {
    await raidStatus(m);
  } else if (cmd === '/raidend') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: only group admins can close a raid.` }); return; }
    await endRaid(m);
  } else if (cmd === '/raidqueue') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: only admins can queue raids.` }); return; }
    const link = (args || '').trim();
    if (!link) {
      const q = await raidQueue();
      await tgApi('sendMessage', { chat_id: CID, text: q.length
        ? `⚔️ RAID QUEUE — ${q.length} link${q.length > 1 ? 's' : ''} waiting:\n` + q.slice(0, 10).map((l, i) => `${i + 1}. ${l}`).join('\n') + `\n\nAuto-drops daily 19:00 UTC (recap 20:00). /raidqueue <link> to add.`
        : `⚔️ Raid queue is empty. /raidqueue <https://link> — it auto-drops 19:00 UTC, recap 20:00.` });
      return;
    }
    if (!/^https?:\/\//.test(link)) { await tgApi('sendMessage', { chat_id: CID, text: 'Usage: /raidqueue <https://link-to-post>' }); return; }
    const q = await raidQueue();
    q.push(link.slice(0, 200));
    await setState('raid_queue', { links: q.slice(-25) });
    await tgApi('sendMessage', { chat_id: CID, text: `⚔️ Queued by ${name} — ${q.length} in line. Next auto-raid drops 19:00 UTC. /raid to fire one instantly instead.` });
  } else if (cmd === '/announce') {
    if (!await isAdmin(m)) { await tgApi('sendMessage', { chat_id: CID, text: `${name}: announcements are a founders/admin function.` }); return; }
    const text = (args || '').trim().slice(0, 800);
    if (text.length < 4) { await tgApi('sendMessage', { chat_id: CID, text: 'Usage: /announce <message> — posts to the group, pinned.' }); return; }
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: `📣 FROM THE FOUNDERS\n\n${text}` });
    if (r.ok && r.result?.message_id) {
      await tgApi('pinChatMessage', { chat_id: CHAT_ID, message_id: r.result.message_id, disable_notification: false });
      await tgApi('sendMessage', { chat_id: CID, text: `📣 Broadcast delivered and pinned, ${name}.` });
    } else {
      await tgApi('sendMessage', { chat_id: CID, text: `Broadcast failed: ${r.description || 'unknown error'}` });
    }
  } else if (cmd.startsWith('/')) {
    if (cmd.length > 3) await tgApi('sendMessage', { chat_id: CID, text: `${name}: unknown command. Try /guide for the map or /help for everything.` });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  let body: { action?: string; name?: string; text?: string; key?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body.action || new URL(req.url).searchParams.get('action') || 'sync';

  if (action === 'send') {
    const name = String(body.name || 'SmartzOS').slice(0, 40).replace(/[\n\r]/g, ' ');
    const text = String(body.text || '').slice(0, 500).trim();
    if (!text) return json({ ok: false, error: 'empty' }, 400);
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: `${name}: ${text}` });
    if (r.ok && r.result?.message_id) {
      await insertInto('tg_messages', [{
        tg_message_id: r.result.message_id, from_name: name, text,
        created_at: new Date((r.result.date || Date.now() / 1000) * 1000).toISOString(),
      }]);
    }
    return json({ ok: !!r.ok, result: r.ok ? r.result?.message_id : r.description });
  }

  if (action === 'digest') {
    const day = new Date(Date.now() - 864e5).toISOString();
    const wk = weekStartISO();
    const [tgD, chatD, { geW, msgsW }, members] = await Promise.all([
      countRows('tg_messages', day), countRows('chat_messages', day), questProgress(),
      countRows('members', '1970-01-01T00:00:00Z'),
    ]);
    const geOk = geW >= QUEST.ge, msgOk = msgsW >= QUEST.msgs;
    let questLine = `🎯 Weekly quest: ${geW}/${QUEST.ge} GE offers · ${msgsW}/${QUEST.msgs} messages`;
    const st = await getState('quest');
    if (geOk && msgOk && st.done_week !== weekKey()) {
      questLine = `🏆 WEEKLY QUEST COMPLETE — ${geW} GE offers, ${msgsW} messages. The Syndicate showed up. New quest starts Monday.`;
      await setState('quest', { done_week: weekKey() });
    }
    let txt =
      `📊 SMARTZ DAILY DIGEST — ${new Date().toISOString().slice(0, 10)}\n` +
      `· Last 24h: ${chatD + tgD} messages across mesh + telegram\n` +
      `· Syndicate members: ${members}\n` + questLine;
    if (new Date().getUTCDay() === 0) {
      const top = await topVoices(wk);
      if (top.length) txt += `\n\n📣 TOP VOICES THIS WEEK\n` + top.map(([n, c], i) => `${['🥇','🥈','🥉','4.','5.'][i]} ${n} — ${c} msgs`).join('\n');
      const strk = await topStreaks(3);
      if (strk.length) txt += `\n\n🔥 STREAK KEEPERS\n` + strk.map(([n, c], i) => `${['🥇','🥈','🥉'][i]} ${n} — ${c}d`).join('\n');
      const tq = await tqBoard(3);
      if (tq.length) txt += `\n\n🌀 TOP TUNNELERS\n` + tq.map(([n, c, w], i) => `${['🥇','🥈','🥉'][i]} ${n} — ${c} pts (${w}/3 this week)`).join('\n');
    }
    txt += `\nTrade, chat, build: ${OS_LINK}\n\n` + await marketTape();
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: txt });
    return json({ ok: !!r.ok, quest: { geW, msgsW }, result: r.ok ? r.result?.message_id : r.description });
  }

  if (action === 'quiz_post') return postQuiz();

  if (action === 'market_tape') {
    const day = new Date().toISOString().slice(0, 10);
    const last = await getState('tape_last');
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: await marketTape() });
    if (r.ok) await setState('tape_last', { day, n: (Number(last.n) || 0) + 1 });
    return json({ ok: !!r.ok, result: r.ok ? r.result?.message_id : r.description });
  }

  if (action === 'raid_soon') {
    const day = new Date().toISOString().slice(0, 10);
    const last = await getState('raid_soon_last');
    if (last.day === day) return json({ ok: true, skipped: 'already_announced' });
    const act = await getState('raid_active');
    if (act.link) return json({ ok: true, skipped: 'raid_already_live' });
    const q = await raidQueue();
    if (!q.length) return json({ ok: true, skipped: 'empty_queue' });
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `⚔️ RAID IN 30 MIN — drops 19:00 UTC.\nWhen it lands: open the link, like + repost/comment with real words, reply DONE here.\nEvery DONE counts on the Top Raiders board. Get ready. 💠` });
    if (r.ok) await setState('raid_soon_last', { day });
    return json({ ok: !!r.ok });
  }

  if (action === 'raid_live') {
    const act = await getState('raid_active');
    if (act.link) return json({ ok: true, skipped: 'raid_already_live' });
    const q = await raidQueue();
    if (!q.length) return json({ ok: true, skipped: 'empty_queue' });
    const link = q.shift() as string;
    const ok = await startRaidAuto(link);
    if (ok) await setState('raid_queue', { links: q });
    return json({ ok, link });
  }

  if (action === 'raid_recap') {
    const done = await endRaidAuto();
    return json({ ok: true, closed: done });
  }

  if (action === 'points_post') {
    const wk = weekKey();
    const last = await getState('points_post_last');
    if (last.week === wk) return json({ ok: true, skipped: 'already_posted' });
    const top = await pointsBoard(10);
    const month = new Date().toISOString().slice(0, 7);
    const lines = top.length
      ? top.map(([n, p], i) => `${['🥇','🥈','🥉','4.','5.','6.','7.','8.','9.','10.'][i]} ${n} — ${p}`).join('\n')
      : 'Board is quiet — say gm, answer the quiz, clear a quest. It all counts.';
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `📈 SYNDICATE POINTS — WEEKLY STANDINGS (${month})\n${lines}\n\n` +
      `Points = 1/msg · 5/streak-day · 10/knowledge win · 25/tunnel pt · 15/raid · 20/recruit.\n` +
      `Recognition only — the board shows who carries the Syndicate. /mypoints for your line.` });
    if (r.ok) await setState('points_post_last', { week: wk });
    return json({ ok: !!r.ok });
  }

  if (action === 'lesson') return postLesson();
  if (action === 'question_of_day') return postQotd();

  if (action === 'morning_pulse') {
    const day = new Date().toISOString().slice(0, 10);
    const st = await getState('morning_pulse');
    if (st.day === day) return json({ ok: true, skipped: 'already_posted' });
    const t = await getTasks();
    const L = lessonForToday();
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `☀️ WAR ROOM OPENS — ${day}\n` +
      `· 🎯 Quiz 16:00 UTC · 🏫 Class 16:30 UTC — Lesson ${L.idx + 1}: ${L.t}\n` +
      `· 📋 Open tasks: ${t.items.length} (/tasks) · 🌀 Quests: /tq\n` +
      `Say gm to keep your flame — every check-in pays in the Arena. Move with intent.\n\n` +
      await marketTape() });
    if (r.ok) await setState('morning_pulse', { day });
    return json({ ok: !!r.ok });
  }

  if (action === 'community_check') {
    const day = new Date().toISOString().slice(0, 10);
    const st = await getState('community_check');
    if (st.day === day) return json({ ok: true, skipped: 'already_posted' });
    const since = new Date(Date.now() - 864e5).toISOString();
    const [tgD, chatD] = await Promise.all([countRows('tg_messages', since), countRows('chat_messages', since)]);
    const cls = await getState('class_active');
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `🌙 EVENING CHECK — ${day}\n` +
      `· ${tgD + chatD} messages across mesh + telegram in the last 24h\n` +
      (cls.day === day && cls.winner ? `· 🏫 Class aced by ${cls.winner}\n` : `· 🏫 Today's class still open — scroll up and answer the check question\n`) +
      `Before you log off: claim your wins — Arena -> Rewards (${OS_LINK}). Voice, quiz, streaks, quests — it all converts. gn.` });
    if (r.ok) await setState('community_check', { day });
    return json({ ok: !!r.ok });
  }

  if (action === 'alerts') {
    const st = await getState('alerts_outbox');
    const items = Array.isArray(st.items) ? st.items as { name?: string; text?: string }[] : [];
    if (!items.length) return json({ ok: true, drained: 0 });
    let sent = 0;
    for (const it of items.slice(0, 3)) {
      const nm = String(it.name || 'SmartzOS').slice(0, 40).replace(/[\n\r]/g, ' ');
      const tx = String(it.text || '').slice(0, 400).trim();
      if (!tx) continue;
      const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: `${nm}: ${tx}` });
      if (r.ok) sent++;
    }
    await setState('alerts_outbox', { items: items.slice(3) });
    return json({ ok: true, drained: sent });
  }



  /* ---------- v28: public feeds + agent gateway ---------- */
  if (action === 'tape_data') return json(await tapeData());

  if (action === 'calls_data') {
    const c = await getCalls();
    return json({ ok: true, ts: Date.now(), open: c.items.filter(x => !x.resolved), graded: c.items.filter(x => x.resolved).slice(-10).reverse() });
  }

  if (action === 'agents') {
    const act = (await getAgents()).filter(a => !a.banned);
    return json({ ok: true, agents: act.map(a => ({ name: a.name, by: a.by, says: a.says, lastSay: a.lastSay })) });
  }

  if (action === 'agent_register') {
    const aname = String(body.name || '').replace(/^@/, '').replace(/[^\w.-]/g, '').slice(0, 24);
    if (!aname) return json({ ok: false, error: 'name required' }, 400);
    const agents = await getAgents();
    const existing = agents.find(a => a.name.toLowerCase() === aname.toLowerCase() && !a.banned);
    if (existing) return json({ ok: true, name: existing.name, key: existing.key, note: 'already registered' });
    const key = mintAgentKey();
    agents.push({ name: aname, key, by: 'api', ts: Date.now(), says: 0, lastSay: 0 });
    await setState('agents', { items: agents.slice(-100) });
    return json({ ok: true, name: aname, key });
  }

  if (action === 'agent_whoami') {
    const a = (await getAgents()).find(x => x.key === body.key && !x.banned);
    return a ? json({ ok: true, name: a.name, says: a.says }) : json({ ok: false, error: 'unknown key' }, 401);
  }

  if (action === 'agent_say') {
    const agents = await getAgents();
    const a = agents.find(x => x.key === body.key && !x.banned);
    if (!a) return json({ ok: false, error: 'unknown or banned key' }, 401);
    const text = String(body.text || '').slice(0, 400).trim();
    if (!text) return json({ ok: false, error: 'empty' }, 400);
    if (Date.now() - (a.lastSay || 0) < 5 * 60e3) return json({ ok: false, error: 'cooldown: one say per 5 minutes' }, 429);
    const r = await tgApi('sendMessage', { chat_id: CHAT_ID, text: `🤖 ${a.name} · agent\n${text}` });
    if (r.ok) {
      a.says = (a.says || 0) + 1; a.lastSay = Date.now();
      await setState('agents', { items: agents.slice(-100) });
    }
    return json({ ok: !!r.ok, result: r.ok ? r.result?.message_id : r.description });
  }

  /* ================= default: sync ================= */
  const offSt = await getState('offset');
  const offset = Number(offSt.v) || 0;
  const upd = await tgApi('getUpdates', { limit: 100, offset, allowed_updates: ['message'] });
  if (!upd.ok) return json({ ok: false, configured: false, error: upd.description });

  type Upd = { update_id: number; message?: TgMsg };
  const ups: Upd[] = upd.result || [];
  let maxUpd = offset;
  const msgs: TgMsg[] = [];
  const welcomes: string[] = [];
  const userMap = { ...((await getState('tg_users')) as Record<string, string>) };
  let usersDirty = false;
  for (const u of ups) {
    if (u.update_id >= maxUpd) maxUpd = u.update_id + 1;
    const m = u.message;
    if (!m) continue;
    if (String(m.chat.id) !== String(CHAT_ID)) {
      // DM: bot serves Syndicate members only — join the group first
      if (m.new_chat_members?.length) continue;
      const dtext = (m.text || '').trim();
      if (!dtext) continue;
      const uid = m.from?.id;
      let inGroup = false;
      if (uid) {
        try {
          const mem = await tgApi('getChatMember', { chat_id: CHAT_ID, user_id: uid });
          inGroup = !!(mem.ok && (['creator', 'administrator', 'member'].includes(mem.result?.status) || (mem.result?.status === 'restricted' && mem.result?.is_member)));
        } catch { inGroup = false; }
      }
      if (!inGroup) {
        await tgApi('sendMessage', { chat_id: m.chat.id, text:
          `🔒 This bot serves Syndicate members.\n\nJoin the group first: https://t.me/Smrtquickflips\nOnce you're in, /start works right here — and the group is where the points, class and quests live.` });
        continue;
      }
      const deskForward = async () => {
        try {
          await fetch(`${SB_URL}/functions/v1/tg-desk`, {
            method: 'POST', headers: { ...HDR }, body: JSON.stringify({ message: m }),
          });
        } catch { /* desk down — stay silent rather than confuse */ }
      };
      if (/^confirm\s+\S+/i.test(dtext)) { await deskForward(); continue; }
      if (!dtext.startsWith('/')) { await deskForward(); continue; }
      const dparts = dtext.toLowerCase().split(/\s+/);
      const dcmd = dparts[0].split('@')[0];
      if (DESK_CMDS.includes(dcmd)) { await deskForward(); continue; }
      const DM_OK = ['/start','/guide','/ranks','/daily','/help','/os','/quest','/top','/quiz','/streak','/tqboard','/lesson','/tasks','/decisions','/standup','/lp','/coherence','/board','/mypoints','/ask','/invite','/myrefs','/announce','/raidqueue','/tape','/agent','/agents'];
      if (!DM_OK.includes(dcmd)) {
        await tgApi('sendMessage', { chat_id: m.chat.id, text: `That one runs in the group — it counts on the board there: https://t.me/Smrtquickflips\n(Here in DM: ${DM_OK.join(' ')} — plus the desk: /desk /deposit /balance /tip /withdraw /price /trade)` });
        continue;
      }
      await handleCommand(m, dcmd, dtext.slice(dparts[0].length));
      continue;
    }
    if (m.new_chat_members?.length) {
      for (const nm of m.new_chat_members) welcomes.push(nm.username ? '@' + nm.username : nm.first_name || 'newcomer');
      continue;
    }
    if (m.from?.id && m.from.username) {
      const un = m.from.username.toLowerCase();
      if (userMap[un] !== String(m.from.id)) { userMap[un] = String(m.from.id); usersDirty = true; }
    }
    if (typeof m.text === 'string') msgs.push(m);
  }
  if (maxUpd > offset) await setState('offset', { v: maxUpd });
  if (usersDirty) {
    const trimmed = Object.fromEntries(Object.entries(userMap).slice(-1500));
    await setState('tg_users', trimmed);
  }

  for (const w of welcomes.slice(0, 5)) {
    await tgApi('sendMessage', { chat_id: CHAT_ID, text:
      `🔥 Welcome to the Smartz Syndicate, ${w}!\n` +
      `Start here (2 min): open ${OS_LINK} → tap ⚡ ASSESS COHERENCE → 🌀 ENTER THE TUNNEL.\n` +
      `Then say gm daily — your streak pays OS credits. Type /guide for the full map.\n` +
      `Who brought you in? Reply "invited by @name" — they get the credit they earned.` });
  }

  const rows = msgs.map((m: TgMsg) => ({
    tg_message_id: m.message_id,
    from_name: senderName(m),
    text: (m.text || '').slice(0, 500),
    created_at: new Date(m.date * 1000).toISOString(),
  }));
  await insertInto('tg_messages', rows);

  const relay = rows
    .filter(r => !/^[^:]{1,40}: /.test(r.text) || r.text.startsWith('/'))
    .map(r => ({
      username: ('✈️' + r.from_name).slice(0, 40),
      message: r.text.slice(0, 500),
      channel: 'global',
      tg_message_id: r.tg_message_id,
      created_at: r.created_at,
    }));
  await insertInto('chat_messages', relay);

  /* commands + quiz answers + raids + streaks + zoran (fresh messages only) */
  const quizSt = await getState('quiz_active');
  const today = new Date().toISOString().slice(0, 10);
  let zoranReplies = 0;
  for (const m of msgs) {
    const text = (m.text || '').trim();
    const low = text.toLowerCase();
    if (low.startsWith('/')) {
      const parts = low.split(/\s+/);
      const cmd = parts[0].split('@')[0];
      await handleCommand(m, cmd, text.slice(parts[0].length));
      continue;
    }
    // referral credit: "invited by @name"
    const rm = low.match(/invited by @([a-z0-9_]{3,32})/);
    if (rm) {
      const inviter = rm[1];
      const newcom = senderName(m).replace(/^@/, '').toLowerCase();
      if (inviter !== newcom) {
        const doneKey = 'ref_by_' + newcom;
        const doneSt = await getState(doneKey);
        if (!doneSt.by) {
          await setState(doneKey, { by: inviter, ts: Date.now() });
          const ckey = 'ref_count_' + inviter;
          const cst = await getState(ckey);
          const names = Array.isArray(cst.names) ? cst.names : [];
          names.push('@' + newcom);
          await setState(ckey, { count: (Number(cst.count) || 0) + 1, names: names.slice(-100), last: new Date().toISOString().slice(0, 10) });
          await tgApi('sendMessage', { chat_id: CHAT_ID, text:
            `🤝 RECRUIT LOGGED — @${inviter} brought @${newcom} into the Syndicate (+20 pts, ${(Number(cst.count) || 0) + 1} total).\nWelcome in — /start for the 2-minute path.` });
          continue;
        }
      }
    }
    // raid check-in: "done" while a raid is live
    if (/^(done|raid done|✅)[\s!.]*$/.test(low)) { if (await raidCheckin(m)) continue; }
    // streak: plain "gm" / "good morning" messages
    if (/^(gm|good morning|gn|checkin|check-in)[\s!.]*$/i.test(text)) {
      const { count, first } = await bumpStreak(m);
      if (first && STREAK_MILESTONES.includes(count))
        await tgApi('sendMessage', { chat_id: CHAT_ID, text: `🔥 ${senderName(m)} hits a ${count}-DAY STREAK. The flame remembers who shows up daily. Streaks convert to OS credits in Arena -> Rewards.` });
      continue;
    }
    // class check-question grading
    const clsSt = await getState('class_active');
    if (clsSt.day === today && !clsSt.winner && clsSt.answers) {
      const cans = clsSt.answers as string[];
      if (cans.some(a => a.length >= 3 && low.includes(a))) {
        const winner = senderName(m);
        await setState('class_active', { ...clsSt, winner });
        const wkey = 'quiz_wins_' + winner.replace(/^@/, '').toLowerCase();
        const wst = await getState(wkey);
        await setState(wkey, { wins: (Number(wst.wins) || 0) + 1, last: today });
        await tgApi('sendMessage', { chat_id: CHAT_ID, text:
          `🏫 ${winner} ACES today's class check! Correct: "${text.slice(0, 60)}"\n` +
          `+1 knowledge win banked — convert in SmartzOS -> Arena -> Rewards: ${OS_LINK}` });
        await bankKnowledgeMilestone(winner);
        continue;
      }
    }
    // quiz grading
    if (quizSt.day === today && !quizSt.winner && quizSt.answers) {
      const answers = quizSt.answers as string[];
      if (answers.some(a => a.length >= 3 && low.includes(a))) {
        const winner = senderName(m);
        await setState('quiz_active', { ...quizSt, winner });
        const wkey = 'quiz_wins_' + winner.replace(/^@/, '').toLowerCase();
        const wst = await getState(wkey);
        await setState(wkey, { wins: (Number(wst.wins) || 0) + 1, last: today });
        await tgApi('sendMessage', { chat_id: CHAT_ID, text:
          `🏆 ${winner} takes today's Daily Quiz! Correct: "${text.slice(0, 60)}"\n` +
          `+1 quiz win banked — convert wins to credits in SmartzOS -> Arena -> Rewards: ${OS_LINK}` });
        await bankKnowledgeMilestone(winner);
        continue;
      }
    }
    // v26: questions are DEFERRED — the floor gets 4 minutes first (flushPendingQuestions answers the silent ones)
    if (zoranReplies < 3 && isQuestionText(text)) {
      const za = zoranAnswer(low);
      const bm = za ? null : await matchBrainLocal(text);
      if (za || bm) {
        const pendSt = await getState('zoran_pending');
        const items: { mid: number; name: string; ts: number; src: string; answer: string; by?: string }[] = Array.isArray(pendSt.items) ? pendSt.items as never : [];
        if (!items.some(x => x.mid === m.message_id)) {
          items.push({
            mid: m.message_id, name: senderName(m), ts: Date.now(),
            src: za ? 'kb' : 'brain',
            answer: (za || (bm as { a: string }).a).slice(0, 500),
            by: bm ? (bm as { by: string }).by : undefined,
          });
          await setState('zoran_pending', { items: items.slice(-20) });
          zoranReplies++;
        }
      } else {
        // unknown question — nudge the desk's brain scan so it learns if the floor answers
        try { fetch(`${SB_URL}/functions/v1/tg-desk`, { method: 'GET', headers: { ...HDR } }); } catch { /* desk down */ }
      }
    }
  }

  return json({ ok: true, configured: true, synced: rows.length, relayed: relay.length, welcomed: welcomes.length, zoran_answered: await flushPendingQuestions(), calls_graded: await resolveCalls(), alerts_fired: await checkAlerts() });
});
