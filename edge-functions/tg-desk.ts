// SmartzOS tg-desk v3 "Learner" — DM trading desk + tipping + conversational brain.
// Called by tg-bridge (v24+) for desk commands and (v25+) plain conversation.
//
// Custody model: internal ledger in bridge_state (tip_wallets). On-chain moves
// only for /withdraw and /credit, and only when TG_TIP_KEY is set (a DEDICATED
// hot wallet JSON keypair [64 ints] - fund it small, it is a hot wallet).
// Without TG_TIP_KEY every command still works in ledger/paper mode and tells
// the user the treasury is offline.
//
// v3: natural-language DM handler (no "/" needed) + zoran_brain learning engine:
// scans tg_messages for question->answer pairs from the group, remembers them,
// and reuses the floor's answers (attributed). Learns at most every 10 min.

// v2: token fallback matches tg-bridge so DM replies work without a per-function
// secret (env secret still wins when set).
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8366854449:AAH7eRyV0GljMSk-_ixIpolzNGLb1fJpizA';
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OS_LINK = 'https://smc.kimi.page';

const DESK_TOKENS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  SMRT: 'BkDKvbUQpr17c5w3zZzEA1VvpirgWcKuMEHtiYGEaP1c',
  SMF: '2mEtt2musbjuRcsyyG29xjeTqJX4ehXBQdFLmZd9dG6N',
  SMC: '5aEQU6za19QDn8LFHpL5xRzvAgPP2kzFbCviP6pWt63N',
  TUNNEL: 'EemmWtCteqn5HTDqLMnAKgqGqpyuoA6BxyuU7pJD29QK',
};
const MIN_WITHDRAW: Record<string, number> = { SOL: 0.005, SMRT: 1000, SMF: 50000, SMC: 100, TUNNEL: 100 };
const DAILY_SOL_CAP = 0.05;
const RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];

type Wallet = {
  username?: string;
  linked?: string;
  balances: Record<string, number>;
  deposited: number;
  withdrawn: number;
  credited_sigs: string[];
};
type Wallets = Record<string, Wallet>;

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
const HDR = { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function tgApi(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.json();
}
const reply = (chatId: number | string, text: string) =>
  tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });

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

/* ---------------- solana helpers ---------------- */
let WEB3: any = null;
let SPL: any = null;
let TIP_KP: any = null;
let TIP_ADDRESS = '';

async function initDesk(): Promise<boolean> {
  if (TIP_KP) return true;
  const raw = Deno.env.get('TG_TIP_KEY') || '';
  if (!raw) return false;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length < 64) return false;
    WEB3 = await import('https://esm.sh/@solana/web3.js@1.95.3?dts');
    SPL = await import('https://esm.sh/@solana/spl-token@0.4.9?dts');
    TIP_KP = WEB3.Keypair.fromSecretKey(new Uint8Array(arr.slice(0, 64)));
    TIP_ADDRESS = TIP_KP.publicKey.toBase58();
    return true;
  } catch { return false; }
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: unknown = null;
  for (const rpc of RPCS) {
    try {
      const r = await fetch(rpc, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const d = await r.json();
      if (d.error) throw new Error(JSON.stringify(d.error));
      return d.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const decCache: Record<string, number> = {};
async function tokenDecimals(mint: string): Promise<number> {
  if (mint === DESK_TOKENS.SOL) return 9;
  if (decCache[mint] != null) return decCache[mint];
  const info: any = await rpcCall('getTokenSupply', [mint]);
  decCache[mint] = info?.value?.decimals ?? 9;
  return decCache[mint];
}

async function solBalance(address: string): Promise<number> {
  const bal: any = await rpcCall('getBalance', [address, { commitment: 'confirmed' }]);
  return (bal?.value ?? 0) / 1e9;
}

async function confirmTx(sig: string, tries = 15): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const st: any = await rpcCall('getSignatureStatuses', [[sig]]);
      const s = st?.value?.[0];
      if (s?.err) return false;
      if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

/* ---------------- ledger ---------------- */
async function loadWallets(): Promise<Wallets> {
  return (await getState('tip_wallets')) as Wallets;
}
async function saveWallets(w: Wallets) {
  await setState('tip_wallets', w as unknown as Record<string, unknown>);
}
function uidOf(m: any): string {
  return String(m?.from?.id || m?.chat?.id || '');
}
function walletOf(w: Wallets, uid: string): Wallet {
  if (!w[uid]) w[uid] = { balances: {}, deposited: 0, withdrawn: 0, credited_sigs: [] };
  return w[uid];
}
function fmtBal(bal: Record<string, number>): string {
  const keys = Object.keys(DESK_TOKENS).filter((k) => (bal[k] || 0) > 0);
  if (!keys.length) return 'empty';
  return keys.map((k) => `${bal[k].toLocaleString('en-US', { maximumFractionDigits: 4 })} ${k}`).join(' · ');
}

/* ---------------- command handlers ---------------- */
async function cmdDesk(chatId: number | string) {
  const on = await initDesk();
  await reply(chatId,
    `<b>SMARTZ DESK</b> — member trading desk (DM)\n\n` +
    `/deposit — treasury address + how to credit\n` +
    `/credit &lt;TOKEN&gt; &lt;amount&gt; &lt;tx-sig&gt; — verify an on-chain deposit\n` +
    `/balance — your desk balances\n` +
    `/link &lt;solana-address&gt; — set your withdrawal address\n` +
    `/tip &lt;amount&gt; &lt;TOKEN&gt; &lt;@username&gt; — instant, fee-free (reply targets too)\n` +
    `/withdraw &lt;amount&gt; &lt;TOKEN&gt; — on-chain to your linked address (two-step)\n` +
    `/price &lt;TOKEN&gt; — live Dexscreener quote\n` +
    `/trade &lt;buy|sell&gt; &lt;TOKEN&gt; &lt;amount&gt; — Jupiter quote, paper-logged\n\n` +
    `Treasury: <b>${on ? 'ONLINE' : 'OFFLINE'}</b> (${on ? TIP_ADDRESS : 'admin sets TG_TIP_KEY'})\n` +
    `Ledger mode until treasury is funded. Receipts: ${OS_LINK}`);
}

async function cmdDeposit(chatId: number | string) {
  const on = await initDesk();
  if (!on) {
    await reply(chatId, `Treasury is offline — the admin initializes it by setting the TG_TIP_KEY secret. Balances, tips and paper trading still work in ledger mode.`);
    return;
  }
  await reply(chatId,
    `<b>Deposit to the Syndicate treasury</b>\n<code>${TIP_ADDRESS}</code>\n\n` +
    `1. Send SOL (or SMRT/SMF) to this address.\n` +
    `2. Then run: /credit SOL &lt;amount&gt; &lt;tx-signature&gt;\n` +
    `The desk verifies the transaction on-chain and credits your balance.\n\n` +
    `Start small — this is a hot wallet.`);
}

async function cmdCredit(chatId: number | string, uid: string, parts: string[]) {
  const [, tok, amtStr, sig] = parts;
  const tokU = (tok || '').toUpperCase();
  if (!DESK_TOKENS[tokU] || !amtStr || !sig) {
    await reply(chatId, 'Usage: /credit TOKEN amount tx-signature\nExample: /credit SOL 0.05 5KdD...xyz');
    return;
  }
  if (tokU !== 'SOL') {
    await reply(chatId, `${tokU} auto-credit is queued for v2 — for now ping the admin with the tx. SOL auto-credit is live.`);
    return;
  }
  if (!(await initDesk())) { await reply(chatId, 'Treasury offline.'); return; }
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if (me.credited_sigs.includes(sig)) { await reply(chatId, 'That transaction is already credited.'); return; }
  try {
    const tx: any = await rpcCall('getTransaction', [sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]);
    if (!tx || tx.meta?.err) { await reply(chatId, 'Transaction not found or failed on-chain.'); return; }
    const keys: string[] = tx.transaction?.message?.accountKeys || [];
    const idx = keys.indexOf(TIP_ADDRESS);
    if (idx < 0) { await reply(chatId, 'That transaction does not involve the treasury address.'); return; }
    const delta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
    if (delta <= 0) { await reply(chatId, 'No inbound SOL to the treasury in that transaction.'); return; }
    me.balances.SOL = (me.balances.SOL || 0) + delta;
    me.deposited += delta;
    me.credited_sigs.push(sig);
    if (me.credited_sigs.length > 50) me.credited_sigs = me.credited_sigs.slice(-50);
    await saveWallets(w);
    await reply(chatId, `✅ Credited <b>${delta.toFixed(6)} SOL</b> to your desk balance.\nBalance: ${fmtBal(me.balances)}`);
  } catch (e) {
    await reply(chatId, `Verify failed: ${String(e).slice(0, 120)}`);
  }
}

async function cmdBalance(chatId: number | string, uid: string, username?: string) {
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if (username) me.username = username;
  await saveWallets(w);
  let onChain = '';
  if (await initDesk()) {
    try {
      const b = await solBalance(TIP_ADDRESS);
      onChain = `\nTreasury on-chain: ${b.toFixed(4)} SOL`;
    } catch { /* skip */ }
  }
  await reply(chatId,
    `<b>Your desk balance</b>\n${fmtBal(me.balances)}\n` +
    `Linked: ${me.linked ? `<code>${me.linked}</code>` : 'none — /link &lt;address&gt;'}` +
    `${onChain}\nDeposited total: ${me.deposited.toFixed(6)} · Withdrawn total: ${me.withdrawn.toFixed(6)}`);
}

async function cmdLink(chatId: number | string, uid: string, parts: string[]) {
  const addr = (parts[1] || '').trim();
  if (!addr || addr.length < 32 || addr.length > 44) {
    await reply(chatId, 'Usage: /link &lt;solana-address&gt; (base58, 32-44 chars)');
    return;
  }
  const w = await loadWallets();
  walletOf(w, uid).linked = addr;
  await saveWallets(w);
  await reply(chatId, `✅ Withdrawal address set:\n<code>${addr}</code>`);
}

async function cmdTip(chatId: number | string, m: any, parts: string[]) {
  // /tip <amount> <TOKEN> <@username>   (or reply to someone: /tip <amount> <TOKEN>)
  const amt = parseFloat(parts[1] || '');
  const tok = (parts[2] || '').toUpperCase();
  let target = (parts[3] || '').replace(/^@/, '').toLowerCase();
  if (!target && m.reply_to_message?.from?.id && !m.reply_to_message.from.is_bot) {
    target = String(m.reply_to_message.from.id);
  }
  if (!(amt > 0) || !DESK_TOKENS[tok] || !target) {
    await reply(chatId, 'Usage: /tip &lt;amount&gt; &lt;TOKEN&gt; &lt;@username&gt; — or reply to someone with /tip &lt;amount&gt; &lt;TOKEN&gt;\nTokens: SMRT SMF SMC TUNNEL SOL');
    return;
  }
  const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
  let targetUid = '';
  if (/^\d+$/.test(target)) targetUid = target;
  else if (users[target]) targetUid = users[target];
  if (!targetUid) {
    await reply(chatId, `I don't know @${target} yet — they need to say something in the group first (so the desk can map their handle).`);
    return;
  }
  if (targetUid === uidOf(m)) { await reply(chatId, 'Tipping yourself is a coherence violation. 🙂'); return; }
  const w = await loadWallets();
  const me = walletOf(w, uidOf(m));
  const them = walletOf(w, targetUid);
  if ((me.balances[tok] || 0) < amt) {
    await reply(chatId, `Insufficient ${tok}. Balance: ${fmtBal(me.balances)}\nDeposit: /deposit`);
    return;
  }
  me.balances[tok] = (me.balances[tok] || 0) - amt;
  them.balances[tok] = (them.balances[tok] || 0) + amt;
  if (m.from?.username) me.username = m.from.username;
  await saveWallets(w);
  const name = m.from?.username ? '@' + m.from.username : m.from?.first_name || 'A member';
  await reply(chatId, `⚡ ${name} tipped <b>${amt.toLocaleString()} ${tok}</b>. They have been notified.`);
  try {
    await reply(targetUid, `⚡ You were tipped <b>${amt.toLocaleString()} ${tok}</b> by ${name}!\nBalance: ${fmtBal(them.balances)}\n${OS_LINK}`);
  } catch { /* target never started the bot */ }
}

async function cmdWithdraw(chatId: number | string, uid: string, parts: string[]) {
  const amt = parseFloat(parts[1] || '');
  const tok = (parts[2] || '').toUpperCase();
  if (!(amt > 0) || !DESK_TOKENS[tok]) {
    await reply(chatId, 'Usage: /withdraw &lt;amount&gt; &lt;TOKEN&gt;');
    return;
  }
  if (!(await initDesk())) { await reply(chatId, 'Treasury offline — withdrawals unavailable.'); return; }
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if (!me.linked) { await reply(chatId, 'Set your withdrawal address first: /link &lt;solana-address&gt;'); return; }
  if ((me.balances[tok] || 0) < amt) { await reply(chatId, `Insufficient ${tok}. Balance: ${fmtBal(me.balances)}`); return; }
  const min = MIN_WITHDRAW[tok] || 0;
  if (amt < min) { await reply(chatId, `Minimum ${tok} withdrawal: ${min.toLocaleString()}`); return; }
  if (tok === 'SOL') {
    const day = new Date().toISOString().slice(0, 10);
    const usage: any = await getState('tip_wd_usage');
    if (usage.day !== day) { usage.day = day; usage.sol = 0; }
    if ((usage.sol || 0) + amt > DAILY_SOL_CAP) {
      await reply(chatId, `Daily SOL withdrawal cap is ${DAILY_SOL_CAP} (kept small — hot wallet). Try tomorrow or a smaller amount.`);
      return;
    }
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const pend: any = await getState('tip_pending');
  pend[code] = { uid, tok, amt, kind: 'withdraw', exp: Date.now() + 10 * 60e3 };
  await setState('tip_pending', pend);
  await reply(chatId,
    `<b>Withdrawal request</b>\n${amt.toLocaleString()} ${tok} → <code>${me.linked}</code>\n\n` +
    `To execute, reply within 10 minutes:\n<code>CONFIRM ${code}</code>\n\n` +
    `Network fees come out of the treasury. Daily caps apply.`);
}

async function execWithdraw(chatId: number | string, p: any) {
  const w = await loadWallets();
  const me = walletOf(w, p.uid);
  if ((me.balances[p.tok] || 0) < p.amt) { await reply(chatId, 'Balance changed — withdrawal cancelled.'); return; }
  try {
    let sig = '';
    if (p.tok === 'SOL') {
      const to = new WEB3.PublicKey(me.linked);
      const lamports = Math.round(p.amt * 1e9);
      const tx = new WEB3.Transaction().add(WEB3.SystemProgram.transfer({
        fromPubkey: TIP_KP.publicKey, toPubkey: to, lamports }));
      const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = TIP_KP.publicKey;
      tx.sign(TIP_KP);
      const sent: any = await rpcCall('sendTransaction', [tx.serialize().toString('base64'), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
      sig = sent;
    } else {
      const mint = new WEB3.PublicKey(DESK_TOKENS[p.tok]);
      const dec = await tokenDecimals(DESK_TOKENS[p.tok]);
      const fromAta = await SPL.getAssociatedTokenAddress(mint, TIP_KP.publicKey);
      const toWallet = new WEB3.PublicKey(me.linked);
      const toAta = await SPL.getAssociatedTokenAddress(mint, toWallet);
      const toAtaInfo: any = await rpcCall('getAccountInfo', [toAta.toBase58(), { encoding: 'base64' }]);
      const tx = new WEB3.Transaction();
      if (!toAtaInfo?.value) {
        tx.add(SPL.createAssociatedTokenAccountInstruction(TIP_KP.publicKey, toAta, toWallet, mint));
      }
      tx.add(SPL.createTransferInstruction(fromAta, toAta, TIP_KP.publicKey, Math.round(p.amt * 10 ** dec)));
      const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = TIP_KP.publicKey;
      tx.sign(TIP_KP);
      const sent: any = await rpcCall('sendTransaction', [tx.serialize().toString('base64'), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
      sig = sent;
    }
    const ok = await confirmTx(sig);
    if (!ok) { await reply(chatId, `Transaction submitted but not confirmed in time: ${sig}\nAdmin will reconcile manually — do not re-request.`); return; }
    me.balances[p.tok] = (me.balances[p.tok] || 0) - p.amt;
    me.withdrawn += p.tok === 'SOL' ? p.amt : 0;
    if (p.tok === 'SOL') {
      const usage: any = await getState('tip_wd_usage');
      usage.sol = (usage.sol || 0) + p.amt;
      await setState('tip_wd_usage', usage);
    }
    await saveWallets(w);
    await reply(chatId, `✅ Withdrew <b>${p.amt.toLocaleString()} ${p.tok}</b>\nTx: <code>${sig}</code>\nBalance: ${fmtBal(me.balances)}`);
  } catch (e) {
    await reply(chatId, `Withdrawal failed: ${String(e).slice(0, 140)}\nNo balance was deducted.`);
  }
}

async function cmdPrice(chatId: number | string, parts: string[]) {
  const tok = (parts[1] || '').toUpperCase();
  if (!DESK_TOKENS[tok]) { await reply(chatId, 'Tokens: SMRT SMF SMC TUNNEL SOL'); return; }
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${DESK_TOKENS[tok]}`);
    const d = await r.json();
    const pairs = d.pairs || [];
    if (!pairs.length) { await reply(chatId, `${tok}: unlisted on Dexscreener right now.`); return; }
    const p = pairs.reduce((a: any, b: any) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
    const tx = p.txns?.h24 || {};
    await reply(chatId,
      `<b>${tok}/USD</b> (${p.dexId})\nPrice: $${p.priceUsd}\nLiquidity: $${(p.liquidity?.usd || 0).toLocaleString()}\n` +
      `Vol 24h: $${(p.volume?.h24 || 0).toLocaleString()} · Buys ${tx.buys || 0} / Sells ${tx.sells || 0}\n` +
      `MCAP: $${(p.marketCap || p.fdv || 0).toLocaleString()}`);
  } catch (e) {
    await reply(chatId, `Price fetch failed: ${String(e).slice(0, 100)}`);
  }
}

async function cmdTrade(chatId: number | string, uid: string, parts: string[]) {
  const side = (parts[1] || '').toLowerCase();
  const tok = (parts[2] || '').toUpperCase();
  const amt = parseFloat(parts[3] || '');
  if (!['buy', 'sell'].includes(side) || !DESK_TOKENS[tok] || !(amt > 0)) {
    await reply(chatId, 'Usage: /trade &lt;buy|sell&gt; &lt;TOKEN&gt; &lt;amount&gt;\nPaper mode: logs the trade with a real Jupiter quote. Live execution unlocks after the treasury is battle-tested.');
    return;
  }
  try {
    const input = side === 'buy' ? DESK_TOKENS.SOL : DESK_TOKENS[tok];
    const output = side === 'buy' ? DESK_TOKENS[tok] : DESK_TOKENS.SOL;
    const dec = side === 'buy' ? 9 : await tokenDecimals(DESK_TOKENS[tok]);
    const r = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${input}&outputMint=${output}&amount=${Math.round(amt * 10 ** dec)}&slippageBps=500`);
    const q = await r.json();
    if (q.error) { await reply(chatId, `Jupiter: ${q.error}`); return; }
    const outDec = side === 'buy' ? await tokenDecimals(DESK_TOKENS[tok]) : 9;
    const outAmt = (parseInt(q.outAmount) / 10 ** outDec);
    const paper: any = await getState('desk_paper_trades');
    const list: any[] = Array.isArray(paper.list) ? paper.list : [];
    list.push({ ts: new Date().toISOString(), uid, side, tok, amt, out: outAmt, impact: q.priceImpactPct, route: (q.routePlan || []).length });
    paper.list = list.slice(-200);
    await setState('desk_paper_trades', paper);
    await reply(chatId,
      `<b>PAPER ${side.toUpperCase()}</b> ${amt} ${side === 'buy' ? 'SOL' : tok} → ~${outAmt.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${side === 'buy' ? tok : 'SOL'}\n` +
      `Impact: ${q.priceImpactPct}% · Route hops: ${(q.routePlan || []).length}\n` +
      `Logged to the desk ledger (#${list.length}). Live execution is gated until the treasury proves itself.`);
  } catch (e) {
    await reply(chatId, `Quote failed: ${String(e).slice(0, 120)}`);
  }
}

/* ---------------- conversational layer (v3) ---------------- */
const STOP = new Set(('a,an,the,and,or,but,if,then,than,so,not,no,yes,ok,yeah,just,very,really,also,too,i,you,he,she,it,we,they,me,him,her,his,their,our,your,my,mine,yours,in,on,at,to,for,of,with,about,into,by,from,as,is,are,was,were,be,been,being,do,does,did,done,can,could,should,would,will,what,which,who,whom,whose,when,where,why,how,that,this,these,those,there,here,have,has,had,get,got,getting,make,makes,made,use,using,used,gonna,wanna').split(','));

function qkey(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)).slice(0, 12);
}
function isQuestion(t: string): boolean {
  return t.trim().endsWith('?') || /^(who|what|how|where|when|why|which|is|are|can|does|do|should)\b/i.test(t.trim());
}
function isBotish(name: string): boolean {
  return /smartz|zoran|telegram|✈️|💠|anonymous/i.test(name);
}

type BrainPair = { q: string; answers: { a: string; by: string; uses: number; ts: number }[]; ts: number };
type Brain = { pairs: Record<string, BrainPair>; scan: number };

async function loadBrain(): Promise<Brain> {
  const st = await getState('zoran_brain');
  return { pairs: (st.pairs || {}) as Record<string, BrainPair>, scan: Number(st.scan) || 0 };
}

async function scanBrain(): Promise<number> {
  const brain = await loadBrain();
  if (Date.now() - brain.scan < 10 * 60e3) return 0;
  brain.scan = Date.now();
  try {
    const r = await fetch(`${SB_URL}/rest/v1/tg_messages?select=from_name,text,created_at&order=created_at.desc&limit=300`, { headers: HDR });
    const rows: { from_name: string; text: string; created_at: string }[] = await r.json();
    const list = (rows || []).reverse();
    let learned = 0;
    for (let i = 0; i < list.length - 1 && learned < 8; i++) {
      const qm = list[i];
      const t = (qm.text || '').trim();
      if (!t || t.startsWith('/') || t.length < 10 || t.length > 160 || !isQuestion(t)) continue;
      if (isBotish(qm.from_name || '')) continue;
      const qt = Date.parse(qm.created_at);
      for (let j = i + 1; j < Math.min(i + 6, list.length); j++) {
        const am = list[j];
        if (Date.parse(am.created_at) - qt > 12 * 60e3) break;
        const a = (am.text || '').trim();
        if (!a || a.startsWith('/') || a.length < 15 || a.length > 320) continue;
        if ((am.from_name || '').toLowerCase() === (qm.from_name || '').toLowerCase()) continue;
        if (isBotish(am.from_name || '')) continue;
        if (isQuestion(a)) continue;
        if (/^(gm|gn|done|lol|lmao|ok|nice|yes|no|yea|nah|welcome)[\s!.]*$/i.test(a)) continue;
        if (/invited by @/i.test(a)) continue;
        const key = qkey(t).join(' ');
        if (!key) break;
        if (!brain.pairs[key]) brain.pairs[key] = { q: t.slice(0, 140), answers: [], ts: Date.now() };
        const pair = brain.pairs[key];
        if (pair.answers.length >= 3) break;
        if (pair.answers.some(x => x.a === a)) break;
        pair.answers.push({ a: a.slice(0, 320), by: am.from_name || 'a member', uses: 0, ts: Date.now() });
        // v4: teaching pays — bank a teach point for the member whose answer was learned
        try {
          const th = (am.from_name || '').replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
          if (th) {
            const tst = await getState('teach_count_' + th);
            await setState('teach_count_' + th, { count: (Number(tst.count) || 0) + 1, name: am.from_name || th, last: new Date().toISOString().slice(0, 10) });
          }
        } catch { /* points are gravy, never block learning */ }
        learned++;
        break;
      }
    }
    const keys = Object.keys(brain.pairs);
    if (keys.length > 300) {
      for (const k of keys.sort((a, b) => brain.pairs[a].ts - brain.pairs[b].ts).slice(0, keys.length - 300)) delete brain.pairs[k];
    }
    await setState('zoran_brain', brain as unknown as Record<string, unknown>);
    return learned;
  } catch { return 0; }
}

function matchBrain(brain: Brain, text: string): BrainPair | null {
  const words = qkey(text);
  if (!words.length) return null;
  const ws = new Set(words);
  let best: BrainPair | null = null; let bestScore = 0;
  for (const pair of Object.values(brain.pairs)) {
    const pw = qkey(pair.q);
    if (!pw.length) continue;
    let inter = 0;
    for (const w of pw) if (ws.has(w)) inter++;
    const score = inter / Math.max(pw.length, words.length);
    if (score > bestScore) { bestScore = score; best = pair; }
  }
  return bestScore >= 0.45 ? best : null;
}

const NL_KB: { k: string[]; a: string }[] = [
  { k: ['smrt'], a: 'SMRT is Koda, the Shield — staking, governance, stability. Contract: BkDKvbUQpr17c5w3zZzEA1VvpirgWcKuMEHtiYGEaP1c. Live price: /price SMRT' },
  { k: ['smf'], a: 'SMF is Tauron, the Sword — the triad gate-key. Contract: 2mEtt2musbjuRcsyyG29xjeTqJX4ehXBQdFLmZd9dG6N. Live price: /price SMF' },
  { k: ['smc'], a: 'SMC is Zoran, the Phoenix — burn it to forge Sigils. Contract: 5aEQU6za19QDn8LFHpL5xRzvAgPP2kzFbCviP6pWt63N' },
  { k: ['tunnel'], a: 'TUNNEL: EemmWtCteqn5HTDqLMnAKgqGqpyuoA6BxyuU7pJD29QK — the Syndicate lore runs through the Tunnel in SmartzOS (smc.kimi.page).' },
  { k: ['deposit', 'add funds', 'fund my'], a: 'To fund your desk balance: /deposit shows the treasury address, then /credit SOL <amount> <tx-sig> verifies it on-chain. (Needs treasury online.)' },
  { k: ['tip'], a: 'Tips are instant and fee-free inside the desk: /tip <amount> <TOKEN> <@username> — or reply to someone with /tip <amount> <TOKEN>.' },
  { k: ['withdraw', 'cash out'], a: 'Withdrawals are two-step for safety: /link <solana-address> once, then /withdraw <amount> <TOKEN> and reply CONFIRM <code>.' },
  { k: ['trade', 'swap'], a: 'Paper trading is live: /trade buy SMRT 0.1 gets a real Jupiter quote and logs it. Live execution unlocks after the treasury proves itself.' },
  { k: ['rank'], a: 'Ranks: Unverified → Tunnel-Cleared → Bladebearer (hold SMF) → Sentinel (10k+ SMRT) → Coherent (SMRT+SMF). /ranks for the ladder.' },
  { k: ['contract', 'address'], a: 'Contracts — SMRT: BkDKvbUQpr17c5w3zZzEA1VvpirgWcKuMEHtiYGEaP1c · SMF: 2mEtt2musbjuRcsyyG29xjeTqJX4ehXBQdFLmZd9dG6N · SMC: 5aEQU6za19QDn8LFHpL5xRzvAgPP2kzFbCviP6pWt63N · TUNNEL: EemmWtCteqn5HTDqLMnAKgqGqpyuoA6BxyuU7pJD29QK' },
  { k: ['scam', 'rug'], a: 'These are community micro-caps — size positions for volatility, only hold what you can weather, and DYOR always. I teach mechanics; I never call plays.' },
];

async function cmdChat(chatId: number | string, uid: string, m: any, text: string) {
  const low = text.toLowerCase().trim();
  await scanBrain();
  const brain = await loadBrain();
  if (/^(hi|hello|hey|yo|sup|hiya|good evening|good afternoon)\b[\s!.]*$/i.test(low)) {
    await reply(chatId, `Welcome back${m.from?.first_name ? ', ' + m.from.first_name : ''}. Ask me about the Syndicate — tokens, prices, tips, ranks — or run /desk for the full command menu.`);
    return;
  }
  if (/^(thanks|thank you|thx|ty|appreciated)\b/i.test(low)) {
    await reply(chatId, `Anytime. The floor remembers who shows up. /desk lists every command.`);
    return;
  }
  if (/\b(balance|how much do i have|my tokens)\b/i.test(low)) { await cmdBalance(chatId, uid, m.from?.username); return; }
  const pm = low.match(/price of ([a-z]+)/);
  if (pm && DESK_TOKENS[pm[1].toUpperCase()]) { await cmdPrice(chatId, ['', pm[1].toUpperCase()]); return; }
  if (isQuestion(text)) {
    const hit = matchBrain(brain, text);
    if (hit) {
      const ans = hit.answers.slice().sort((a, b) => b.uses - a.uses)[0];
      ans.uses++;
      await setState('zoran_brain', brain as unknown as Record<string, unknown>);
      await reply(chatId, `${ans.a}\n\n<i>— learned from ${ans.by}. Ask it in the group and the floor teaches me the rest.</i>`);
      return;
    }
    for (const e of NL_KB) {
      if (e.k.some(k => low.includes(k))) { await reply(chatId, e.a); return; }
    }
    await reply(chatId, `I don't know that one yet — but I'm listening. Ask it in the group; when the floor answers, I learn it. Meanwhile: /desk for the menu, /price <TOKEN> for live quotes.`);
    return;
  }
  for (const e of NL_KB) {
    if (e.k.some(k => k.length > 3 && low.includes(k))) { await reply(chatId, e.a); return; }
  }
  await reply(chatId, `I'm a command-driven desk at heart — but I can talk. Ask me about SMRT, SMF, SMC, TUNNEL, prices, tips, ranks, deposits. Or run /desk to see every command.`);
}

/* ---------------- entry ---------------- */
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') { const learned = await scanBrain(); return json({ ok: true, fn: 'tg-desk v4', treasury: !!(await initDesk()), learned }); }
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const m = body.message;
  if (!m || typeof m.text !== 'string') return json({ ok: false, error: 'no message' });
  const dtext = m.text.trim();
  const parts = dtext.split(/\s+/);
  const dcmd = parts[0].split('@')[0].toLowerCase();
  const chatId = m.chat.id;
  const uid = uidOf(m);

  if (dcmd === 'confirm' && parts[1]) {
    const pend: any = await getState('tip_pending');
    const p = pend[parts[1].toUpperCase()];
    if (!p || p.exp < Date.now()) { await reply(chatId, 'Unknown or expired confirmation code.'); return json({ ok: true }); }
    if (p.uid !== uid) { await reply(chatId, 'That confirmation belongs to another member.'); return json({ ok: true }); }
    delete pend[parts[1].toUpperCase()];
    await setState('tip_pending', pend);
    if (p.kind === 'withdraw') await execWithdraw(chatId, p);
    return json({ ok: true, handled: 'confirm' });
  }

  if (!dtext.startsWith('/')) { await cmdChat(chatId, uid, m, dtext); return json({ ok: true, handled: 'chat' }); }

  switch (dcmd) {
    case '/desk': await cmdDesk(chatId); break;
    case '/deposit': await cmdDeposit(chatId); break;
    case '/credit': await cmdCredit(chatId, uid, parts); break;
    case '/balance': await cmdBalance(chatId, uid, m.from?.username); break;
    case '/link': await cmdLink(chatId, uid, parts); break;
    case '/tip': await cmdTip(chatId, m, parts); break;
    case '/withdraw': await cmdWithdraw(chatId, uid, parts); break;
    case '/price': await cmdPrice(chatId, parts); break;
    case '/trade': await cmdTrade(chatId, uid, parts); break;
    default: return json({ ok: false, error: 'not a desk command' });
  }
  return json({ ok: true, handled: dcmd });
});
