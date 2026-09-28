// SmartzOS tg-desk v56 "Genesis Drop" — v55 + onboarding faucet: first /start creates the member's
// wallet instantly and credits a one-time Genesis Drop (5,000 SMC, desk-ledger from treasury,
// receipted in chainlog). New member = holder in the first minute. faucet_grants state = one per uid.
// SmartzOS tg-desk v55 "The Fund" — v54 + Syndicate Fund: NAV-priced shared capital (deposit any house token → shares at USD NAV,
// pro-rata liquid withdrawals, 10% performance fee → revenue, /fund deploy|harvest|drop admin ops, pending-settlement queue)
// SmartzOS tg-desk v54 "Sovereignty" — v53 + member key sovereignty: /link address validation + /unlink,
// /backup <passphrase> (AES-GCM encrypted keypair blob, offline-decryptable), backup nag ladder, wallet_req linked/backed_up
// SmartzOS tg-desk v53 "Two Venues" — v52 + /pools live pool board (DexScreener, both venues, 10-min cache) + LP school lesson 6 (Raydium CLMM/CPMM vs Orca Whirlpools)
// SmartzOS tg-desk v52 "The Desk" — v51 + THE DESK retheme: /farm engine copy is
// now a trading seat (capital/tiers/P&L) instead of a miner (rigs/hash/mining)
// game layer over LP Desk shares (power, hourly SMC yield, 10% maintenance, 5 levels)
// SmartzOS tg-desk v46 "Vault Wire" — v45 + wallet_req app action (ledger balances + deposited/withdrawn + KP + LP shares + member P2P address) powering the Mini App vault panel
// SmartzOS tg-desk v18 "Open Quote" — v17 + pair with ANY token:
// - /launch quote= accepts any desk token, any Syndicate token, or any raw Solana mint
// - every launch auto-queues a SIDE LP (Raydium CPMM: new token vs SMRT) — /lp shows the queue
// Called by tg-bridge (v34+) for desk commands and plain conversation.
//
// v15: /launch queues member tokens on StonkFun (Raydium LaunchLab, permissionless
// — no StonkFun API key needed). Launches are paired against a Syndicate quote
// token (default SMRT) so every trade routes through Syndicate liquidity. The
// local launcher worker (solana-tools/smartz_launcher.mjs, run by Kimi) drains
// the queue: creates mint + metadata, calls raydium.launchpad.createLaunchpad,
// writes launch_results back; the desk registers the mint as a dynamic token
// (desk_tokens kv) so it is instantly tradeable/tippable/quotable, and awards
// +25 Kill Points.
//
// Custody model (v11): FULL P2P. Every member gets a desk-generated Solana wallet
// (keys XOR-obfuscated with the desk shared key in bridge_state). Tips and swap
// settlements move wallet-to-wallet on-chain, signed by the members' own keys.
// The desk also operates a BANK wallet (BANK_KEY) that quotes two-way prices to
// the chat and will market-make via scheduled sweeps. The legacy shared tip hot
// wallet (TG_TIP_KEY) remains only as a ledger-settlement fallback.
//
// v10 "Vault": hardening — shared-secret auth (x-desk-key), per-tx caps, daily
// caps, kill switch (desk_halt), desk_chainlog, live Jupiter trades behind
// CONFIRM codes.
//
// v3: natural-language DM handler + zoran_brain learning engine.
//
// v2: env-only. Deploy tooling injects the token at deploy time from a
// local secrets file (never committed). Set TELEGRAM_BOT_TOKEN secret to override.
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
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
/* v51: ZK rain whitelist — Tokenkeg in-house tokens only. ZK compression cannot
   mint Token-2022 (TUNNEL), so it can never be rained on-chain. */
const ZRAIN_TOKENS: Record<string, string> = { SMRT: DESK_TOKENS.SMRT, SMF: DESK_TOKENS.SMF, SMC: DESK_TOKENS.SMC };
const ZRAIN_MAX_RECIPIENTS = 500; // kit hard cap is 1000; keep single-tx batches sane
const MIN_WITHDRAW: Record<string, number> = { SOL: 0.005, SMRT: 1000, SMF: 50000, SMC: 100, TUNNEL: 100 };
const DAILY_SOL_CAP = 0.05;
/* ---------- v10 "Vault": hardening + live trading ---------- */
const PER_TX_CAP: Record<string, number> = { SOL: 0.02, SMRT: 1_000_000, SMF: 20_000_000, SMC: 20_000_000, TUNNEL: 100_000 };
const DAILY_WD_COUNT = 5;
const DESK_AUTH = Deno.env.get('DESK_SHARED_KEY') || '';
async function deskHalted(): Promise<boolean> {
  try { const st = await getState('desk_halt'); return st.on === true; } catch { return false; }
}
async function chainLog(entry: Record<string, unknown>): Promise<void> {
  try {
    const st: any = await getState('desk_chainlog');
    const list: any[] = Array.isArray(st.items) ? st.items : [];
    list.push({ ts: Date.now(), ...entry });
    await setState('desk_chainlog', { items: list.slice(-500) });
  } catch { /* logging best-effort */ }
}

/* ---------- v25 "Revenue": fee ledger + owner payout ---------- */
const TRADE_FEE_BPS = 100; // 1% desk fee on executed trades, taken from the output side
async function recordRevenue(source: string, token: string, amount: number, ref: string): Promise<void> {
  try {
    const st: any = await getState('revenue_ledger');
    const list: any[] = Array.isArray(st.items) ? st.items : [];
    list.push({ ts: Date.now(), source, token, amount, ref });
    await setState('revenue_ledger', { items: list.slice(-1000) });
  } catch { /* ledger best-effort */ }
}
async function revenueSummary(): Promise<{ total: number; sincePayout: number; paidOut: number }> {
  const st: any = await getState('revenue_ledger');
  const items: any[] = Array.isArray(st.items) ? st.items : [];
  const log: any = await getState('payout_log');
  const lastPayTs: number = log.lastTs || 0;
  const paidOut: number = log.totalPaid || 0;
  const total = items.reduce((s: number, i: any) => s + (i.token === 'SOL' ? i.amount : 0), 0);
  const sincePayout = items.filter((i: any) => i.ts > lastPayTs).reduce((s: number, i: any) => s + (i.token === 'SOL' ? i.amount : 0), 0);
  return { total, sincePayout, paidOut };
}
const RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];

/* ---------- v11 "P2P Floor": member wallets + bank ---------- */
const BANK_RAW = Deno.env.get('BANK_KEY') || '';
let BANK_KP: any = null;
function obfKey(arr: number[]): number[] {
  // XOR-obfuscate a 64-byte keypair with bytes of the desk shared key (defense in depth at rest)
  const seedHex = DESK_AUTH.replace(/^dsk_/, '');
  const seed: number[] = [];
  for (let i = 0; i + 1 < seedHex.length; i += 2) seed.push(parseInt(seedHex.slice(i, i + 2), 16));
  if (!seed.length) return arr;
  return arr.map((b, i) => b ^ seed[i % seed.length]);
}
async function getP2P(): Promise<Record<string, { addr: string; key: number[]; created: number }>> {
  const st: any = await getState('p2p_wallets');
  return (st && typeof st.w === 'object' && st.w) || {};
}
async function saveP2P(w: Record<string, unknown>): Promise<void> {
  await setState('p2p_wallets', { w });
}
async function initBank(): Promise<boolean> {
  if (BANK_KP) return true;
  if (!BANK_RAW) return false;
  try {
    const arr = JSON.parse(BANK_RAW);
    if (!Array.isArray(arr) || arr.length < 64) return false;
    BANK_KP = { secret: arr.slice(0, 64) };
    return true;
  } catch { return false; }
}
async function bankAddress(): Promise<string> {
  if (!(await initBank())) return '';
  if (!BANK_KP.pub && WEB3) BANK_KP.pub = WEB3.Keypair.fromSecretKey(new Uint8Array(BANK_KP.secret)).publicKey.toBase58();
  return BANK_KP.pub || '';
}
async function ensureWeb3(): Promise<boolean> {
  if (WEB3) return true;
  try {
    WEB3 = await import('./npm__at_solana_web3.js_at_1.95.3.mjs');
    return true;
  } catch { return false; }
}
/* vlib: hand-rolled SPL-token primitives (keeps the vendored graph small — no spl-token pkg).
   ATA program takes empty instruction data; token Transfer is discriminator 3 + u64 LE amount. */
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
async function getAta(mint: any, owner: any): Promise<any> {
  const [addr] = await WEB3.PublicKey.findProgramAddress(
    [owner.toBuffer(), new WEB3.PublicKey(TOKEN_PROGRAM_ID).toBuffer(), mint.toBuffer()],
    new WEB3.PublicKey(ATA_PROGRAM_ID));
  return addr;
}
function createAtaIx(payer: any, ata: any, owner: any, mint: any): any {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: WEB3.SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: new WEB3.PublicKey(TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
    { pubkey: WEB3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new WEB3.TransactionInstruction({ programId: new WEB3.PublicKey(ATA_PROGRAM_ID), data: new Uint8Array(0), keys });
}
function createTransferIx(source: any, dest: any, owner: any, amount: number): any {
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint8(0, 3); // TokenInstruction::Transfer
  dv.setBigUint64(1, BigInt(Math.round(amount)), true);
  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: dest, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new WEB3.TransactionInstruction({ programId: new WEB3.PublicKey(TOKEN_PROGRAM_ID), data, keys });
}
/* v28 Vault: delegation primitives — approve = disc 4 + u64 amount, revoke = disc 5, no data.
   The BANK becomes delegate on the member's ATA: it can trade up to the approved amount
   via transferFrom, but tokens never leave the member's account until a trade executes,
   and the member can revoke at any time. No pooling, no custody sweep. */
function createApproveIx(source: any, delegate: any, owner: any, amount: number): any {
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint8(0, 4); // TokenInstruction::Approve
  dv.setBigUint64(1, BigInt(Math.round(amount)), true);
  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: delegate, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new WEB3.TransactionInstruction({ programId: new WEB3.PublicKey(TOKEN_PROGRAM_ID), data, keys });
}
function createRevokeIx(source: any, delegate: any, owner: any): any {
  const data = new Uint8Array([5]); // TokenInstruction::Revoke
  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: delegate, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new WEB3.TransactionInstruction({ programId: new WEB3.PublicKey(TOKEN_PROGRAM_ID), data, keys });
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(bin);
}
async function myWallet(uid: string): Promise<{ addr: string; kp: any } | null> {
  if (!(await ensureWeb3())) return null;
  const all = await getP2P();
  let rec = all[uid];
  if (!rec) {
    const kp = WEB3.Keypair.generate();
    rec = { addr: kp.publicKey.toBase58(), key: obfKey(Array.from(kp.secretKey)), created: Date.now() };
    all[uid] = rec;
    await saveP2P(all);
  }
  const kp = WEB3.Keypair.fromSecretKey(new Uint8Array(obfKey(rec.key.slice())));
  return { addr: rec.addr, kp };
}
async function chainBalances(addr: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const bal: any = await rpcCall('getBalance', [addr, { commitment: 'confirmed' }]);
    out.SOL = (bal.value || 0) / 1e9;
    const atas: any = await rpcCall('getTokenAccountsByOwner', [addr, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }]);
    const atas22: any = await rpcCall('getTokenAccountsByOwner', [addr, { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' }, { encoding: 'jsonParsed' }]);
    const extra = await extraTokens();
    const mints: Record<string, string> = {};
    for (const [t, m] of Object.entries({ ...DESK_TOKENS, ...extra })) mints[m] = t;
    for (const it of [...(atas.value || []), ...(atas22.value || [])]) {
      const info = it.account?.data?.parsed?.info;
      if (!info) continue;
      const mint: string = info.mint;
      const tok = mints[mint];
      if (tok) out[tok] = (info.tokenAmount?.uiAmount || 0);
    }
  } catch { /* best-effort */ }
  return out;
}
async function sendSPL(fromKp: any, toAddr: string, mintB58: string, amt: number): Promise<string> {
  const mint = new WEB3.PublicKey(mintB58);
  const dec = await tokenDecimals(mintB58);
  const fromAta = await getAta(mint, fromKp.publicKey);
  const toWallet = new WEB3.PublicKey(toAddr);
  const toAta = await getAta(mint, toWallet);
  const toInfo: any = await rpcCall('getAccountInfo', [toAta.toBase58(), { encoding: 'base64' }]);
  const tx = new WEB3.Transaction();
  if (!toInfo?.value) tx.add(createAtaIx(fromKp.publicKey, toAta, toWallet, mint));
  tx.add(createTransferIx(fromAta, toAta, fromKp.publicKey, Math.round(amt * 10 ** dec)));
  const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  tx.recentBlockhash = bh.blockhash;
  tx.feePayer = fromKp.publicKey;
  tx.sign(fromKp);
  return await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed' }]) as string;
}
async function sendSOL(fromKp: any, toAddr: string, amt: number): Promise<string> {
  const tx = new WEB3.Transaction().add(WEB3.SystemProgram.transfer({
    fromPubkey: fromKp.publicKey, toPubkey: new WEB3.PublicKey(toAddr), lamports: Math.round(amt * 1e9) }));
  const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  tx.recentBlockhash = bh.blockhash;
  tx.feePayer = fromKp.publicKey;
  tx.sign(fromKp);
  return await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed' }]) as string;
}

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
let TIP_KP: any = null;
let TIP_ADDRESS = '';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(data: number[]): string {
  let n = 0n; for (const b of data) n = n * 256n + BigInt(b);
  let out = ''; while (n > 0n) { const r = n % 58n; out = B58[Number(r)] + out; n /= 58n; }
  let pad = 0; for (const b of data) { if (b === 0) pad++; else break; }
  return '1'.repeat(pad) + out;
}
async function initDesk(): Promise<boolean> {
  if (TIP_KP) return true;
  const raw = Deno.env.get('TG_TIP_KEY') || '';
  if (!raw) return false;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length < 64) return false;
    TIP_KP = { secret: arr.slice(0, 64) };  // keypair materialized lazily in loadChainLibs
    TIP_ADDRESS = b58encode(arr.slice(32, 64));
    return true;
  } catch { return false; }
}
/* v8: chain libs loaded ONLY on on-chain ops (withdraw/credit) — web3.js without ?dts
   keeps the isolate under the Supabase memory ceiling; health/tips/trades stay light. */
async function loadChainLibs(): Promise<boolean> {
  if (!TIP_KP) return false;
  if (TIP_KP.publicKey) return true;
  try {
    if (!(await ensureWeb3())) return false;
    TIP_KP = WEB3.Keypair.fromSecretKey(new Uint8Array(TIP_KP.secret));
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
function isGroup(m: any): boolean {
  return m?.chat?.type != null && m.chat.type !== 'private';
}
async function cmdStart(chatId: number | string, m: any) {
  const name = m?.from?.first_name ? ', ' + m.from.first_name : '';
  const uid = uidOf(m);
  let walletBlock = '';
  if (uid && !isGroup(m)) {
    const w = await myWallet(uid);
    const drop = await faucetGrant(uid);
    if (w) walletBlock = `\n\n<b>Your Solana wallet is live:</b>\n<code>${w.addr}</code>\nYour keys, your funds — the desk never holds them.`;
    if (drop > 0) walletBlock += `\n\n🪂 <b>GENESIS DROP: +${drop.toLocaleString()} SMC</b> — you're a holder now. /balance to see it, /withdraw to move it on-chain anytime.`;
    else if (drop === 0 && w) walletBlock += `\n\nDesk balance: /balance`;
  }
  await reply(chatId,
    `Welcome to the Syndicate floor${name}. I'm the desk — I hold nothing for you, everything runs from your own wallet.` +
    walletBlock +
    `\n\n📜 How we got here (60 seconds): https://x.com/Smartzprime/status/2100265249765023756` +
    `\n\n<b>Next, in order:</b>\n` +
    `1️⃣ /checkin — first daily SMC, streaks multiply\n` +
    `2️⃣ /ads — click sponsor ads, earn per verified click\n` +
    `3️⃣ /lpdesk — pool SMC, earn LP harvests\n\n` +
    `Type /menu anytime. Ask me anything in plain words — no commands needed.`);
}
/* v56 "Genesis Drop": one-time onboarding faucet. Desk-ledger SMC from treasury
   (no on-chain cost, no ATA rent), receipted in chainlog. One per uid forever. */
const FAUCET_SMC = 5000;
async function faucetGrant(uid: string): Promise<number> {
  if (!uid) return 0;
  try {
    const g: any = (await getState('faucet_grants')) || {};
    if (g[uid]) return 0;
    if (!(await creditTreasury(uid, FAUCET_SMC, 'SMC'))) return -1;
    g[uid] = { ts: Date.now(), amt: FAUCET_SMC };
    await setState('faucet_grants', g);
    await chainLog({ kind: 'faucet', uid, tok: 'SMC', amt: FAUCET_SMC });
    return FAUCET_SMC;
  } catch { return -1; }
}
async function cmdDesk(chatId: number | string, m?: any) {
  const on = await initDesk();
  const bankOn = await initBank();
  if (m && isGroup(m)) {
    // group chats get the short version — detail lives in DM
    await reply(chatId,
      `<b>SMARTZ DESK</b> — quick commands here, DM me for the full menu.\n` +
      `/wallet — your address · /offers — the floor · /points — leaderboard · /price SMRT — live quote\n` +
      `/rain 100 SMRT — tip the whole active floor · /zrain 5000 SMC — bank-funded on-chain rain to LP holders (admin) · /watch SMRT above 0.001 — price alerts\n` +
      `/flip 10 heads — Kill Points coin toss · /duel @name 20 — winner-take-all vs a member\n` +
      `/ref — your invite code (+25 pts per join) · /launch — make your own token · DM me anything in plain words.`);
    return;
  }
  await reply(chatId,
    `<b>YOUR STUFF</b>\n` +
    `/wallet — your own Solana address + what it holds\n` +
    `/tip 100 SMRT @name — send tokens to a member\n` +
    `/balance — desk ledger balance (legacy)\n\n` +
    `<b>TRADE</b>\n` +
    `/price SMRT — live price · /quote SMRT — Bank buy/sell prices\n` +
    `/offers — open deals · /take BGOY — accept one\n` +
    `/offer sell 100000 SMRT 0.00005 — post your own deal\n` +
    `/bank — the Bank's public books\n\n` +
    `<b>CREATE</b>\n` +
    `/launch MOON Moon Rocket quote=SMRT — your token, paired with ANY token\n` +
    `/lp — side LP queue (new tokens get a second pool vs SMRT)\n` +
    `/pools — live pool board, both venues (Raydium + Orca)\n` +
    `/agentwallet zoran — an AI agent's wallet\n\n` +
    `<b>COMPETE</b>\n` +
    `/points — today's Kill Points board · /ref — invite code (+25 per join, ranks to CANON)\n\n` +
    `<b>FLOOR ENGINE</b>\n` +
    `/rain 100 SMRT — split a tip across the active floor\n` +
    `/zrain 5000 SMC — bank ZK-airdrops to every LP Desk share holder (admin)\n` +
    `/flip 10 heads — Kill Points coin toss (stake 1–25, daily win cap)\n` +
    `/duel @name 20 — challenge a member, winner takes the stake (zero-sum)\n` +
    `/watch SMRT above 0.001 — price alert · /watches · /unwatch\n` +
    `/drop — post today's floor drop to the channel\n\n` +
    `<b>ADVANCED (desk ledger)</b>\n` +
    `/trade buy SMRT 0.01 · /withdraw 50 SMRT · /deposit · /link &lt;addr&gt; (self-custody) · /backup &lt;passphrase&gt; · /unlink\n\n` +
    `<b>EARN (DM me)</b>\n` +
    `/ads — paying ad campaigns · /ad CODE — click & earn (75% of per-click price)\n` +
    `/visit — scout the sponsor posts, earn SMC (streaks up to 2x) · /scouts — weekly board\n` +
    `/checkin — daily SMC check-in, streaks to 3x, day 30 = Vesting Chest · /boost — referral earn multiplier\n` +
    `/lpdesk — group LP desk: pool desk tokens, earn pro-rata LP harvests (DM)\n` +
    `/fund — Syndicate Fund: deposit tokens, own shares, the bank works the capital (DM)\n` +
    `/adsponsor TOKEN BUDGET [pcc=N] [link=URL] | text — run your own per-click campaign (links auto-detect, first line = headline)\n` +
    `/adstats — your campaign stats · /adstop CODE — stop & refund unspent · /adedit CODE | new text — edit a live ad\n\n` +
    `Bank: <b>${bankOn ? 'online' : 'starting up'}</b> · Desk treasury: <b>${on ? 'online' : 'offline'}</b>\n` +
    `Confused? Just ask me in plain words. Full story: ${OS_LINK}`);
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
    await reply(chatId, 'Confirm a deposit: /credit SOL 0.05 5KdD...xyz\n(the tx signature from your wallet after sending to the /deposit address)');
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
    await reply(chatId, 'One-time setup: /link YOUR_SOLANA_ADDRESS\n(Your Phantom/Solflare address — withdrawals settle on-chain to YOUR keys.)');
    return;
  }
  if (!(await ensureWeb3())) { await reply(chatId, 'Chain libraries warming up — try again in a few seconds.'); return; }
  try { new WEB3.PublicKey(addr); } catch {
    await reply(chatId, 'That does not parse as a Solana address — check every character and try again.');
    return;
  }
  const w = await loadWallets();
  walletOf(w, uid).linked = addr;
  await saveWallets(w);
  await reply(chatId,
    `✅ <b>SELF-CUSTODY SET</b>\nWithdrawals now settle on-chain to YOUR keys:\n<code>${addr}</code>\n\n` +
    `The desk hot wallet never holds more than float for you. Lost your Telegram? Your funds are at that address — you always had the keys.\n` +
    `Change it anytime: /link &lt;new&gt; · remove: /unlink`);
}

async function cmdUnlink(chatId: number | string, uid: string) {
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if (!me.linked) { await reply(chatId, 'No withdrawal address is set. Set one: /link &lt;address&gt;'); return; }
  delete me.linked;
  await saveWallets(w);
  await reply(chatId, 'Withdrawal address removed. Set a new one anytime: /link &lt;address&gt;');
}

/* ---------------- v54 "Sovereignty": encrypted key backup ----------------
   The member's custodial P2P keypair is AES-256-GCM encrypted with a key derived
   from THEIR passphrase (SHA-256 of a domain-separated string). The desk stores
   only the ciphertext blob — worthless without the passphrase. The blob decrypts
   OFFLINE (no Telegram, no desk) into the 64-byte secret key, base58-importable
   into Phantom/Solflare. Blob format: smartzbk1.<b64 iv>.<b64 ciphertext> */
const B64ENC = (u8: Uint8Array) => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
async function backupKey(pass: string, u8: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('smartz-backup-v1::' + pass));
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, u8 as BufferSource));
  return `smartzbk1.${B64ENC(iv)}.${B64ENC(ct)}`;
}

async function cmdBackup(chatId: number | string, uid: string, parts: string[]) {
  const pass = (parts[1] || '').trim();
  if (!pass || pass.length < 8) {
    await reply(chatId, 'Lock your wallet key behind a passphrase (8+ characters, no spaces):\n<code>/backup MyLongPassphrase123</code>\n\nI hand you an encrypted blob. Save it anywhere — email, notes, paper. It opens ONLY with your passphrase, and it works even if this bot and your Telegram account are both gone.');
    return;
  }
  if (/\s/.test(pass)) { await reply(chatId, 'Passphrase must be one word, 8+ characters — no spaces. Pick something only you know: /backup &lt;passphrase&gt;'); return; }
  if (!(await ensureWeb3())) { await reply(chatId, 'Chain libraries warming up — try again in a few seconds.'); return; }
  const mw = await myWallet(uid);
  if (!mw) { await reply(chatId, 'Wallet system unavailable — try again shortly.'); return; }
  const blob = await backupKey(pass, mw.kp.secretKey);
  const st: any = await getState('backup_blobs');
  st[uid] = { blob, at: Date.now() };
  await setState('backup_blobs', st);
  await reply(chatId,
    `🔐 <b>ENCRYPTED WALLET BACKUP</b>\nSave this blob somewhere safe NOW:\n\n<code>${blob}</code>\n\n` +
    `• Opens only with your passphrase — the desk cannot peek inside\n` +
    `• Recover without Telegram: ${OS_LINK}/backup-decrypt.html (or offline — recipe in the file)\n` +
    `• Import the decoded key into Phantom/Solflare = your funds, your keys, always\n\n` +
    `I keep only the ciphertext so you can re-download it in /wallet. The passphrase lives only in your head.`);
}

/* Nag ladder: DM a one-time "secure your keys" nudge when SMC holdings cross a
   tier and the member has neither a linked address nor a backup blob. */
const BACKUP_NAG_TIERS = [50000, 250000, 1000000];
async function maybeBackupNag(uid: string) {
  try {
    const w = await loadWallets();
    const me = walletOf(w, uid);
    if (me.linked) return;
    const bk: any = await getState('backup_blobs');
    if (bk[uid]) return;
    const smc = (me.balances && me.balances.SMC) || 0;
    if (smc < BACKUP_NAG_TIERS[0]) return;
    const nags: any = await getState('backup_nags');
    const mine = nags[uid] || {};
    let fired = false;
    for (const t of BACKUP_NAG_TIERS) { if (smc >= t && !mine['t' + t]) { mine['t' + t] = Date.now(); fired = true; } }
    if (!fired) return;
    nags[uid] = mine;
    await setState('backup_nags', nags);
    await reply(uid,
      `🔐 <b>You're holding ${Math.round(smc).toLocaleString()} SMC — time to own your keys.</b>\n\n` +
      `Two moves, two minutes:\n` +
      `1️⃣ <code>/link &lt;your-solana-address&gt;</code> — withdrawals settle to YOUR wallet (Phantom/Solflare)\n` +
      `2️⃣ <code>/backup &lt;passphrase&gt;</code> — encrypted key blob you can open even if this bot and Telegram vanish\n\n` +
      `Not your keys, not your coins. The desk hot wallet is for float, not fortunes.`);
  } catch { /* a nag must never break the floor */ }
}

/* ---------------- v55 "The Fund": Syndicate Fund — NAV-priced shared capital ----------------
   Members deposit any house token from their desk ledger → shares at USD NAV (DexScreener
   marks, 10-min cache). The bank deploys fund capital into in-house LP / capped treasury
   ops via /fund deploy (admin); on-chain execution stays manual + owner-gated (house rules).
   Harvests credit back via /fund harvest. Withdrawals pay pro-rata of LIQUID holdings;
   shortfalls (deployed capital) queue as pending and auto-settle on the next inflow.
   Performance fee 10% of realized profit at withdrawal → revenue ledger (75/15/10). */
const FUND_FEE_BPS = 1000;
const FUND_PX_TTL = 10 * 60e3;
async function fundPrice(tok: string): Promise<number> {
  const px: any = await getState('fund_px');
  const c = px[tok];
  if (c && Date.now() - c.ts < FUND_PX_TTL && c.usd > 0) return c.usd;
  const mint = DESK_TOKENS[tok];
  if (!mint) return 0;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const d = await r.json();
    const pairs = (d.pairs || []).filter((p: any) => p.chainId === 'solana');
    if (!pairs.length) return 0;
    const p = pairs.reduce((a: any, b: any) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
    const usd = parseFloat(p.priceUsd) || 0;
    if (usd > 0) { px[tok] = { usd, ts: Date.now() }; await setState('fund_px', px); }
    return usd;
  } catch { return 0; }
}
async function fundState(): Promise<any> {
  const st: any = await getState('fund_pool');
  return { holdings: st.holdings || {}, deployed: st.deployed || {}, totalShares: st.totalShares || 0, members: st.members || {}, pending: st.pending || {}, log: st.log || [] };
}
async function fundSave(f: any): Promise<void> {
  await setState('fund_pool', { holdings: f.holdings, deployed: f.deployed, totalShares: f.totalShares, members: f.members, pending: f.pending, log: (f.log || []).slice(-100) });
}
async function fundNAV(f: any): Promise<{ nav: number; liquid: number; deployedUsd: number; px: Record<string, number> }> {
  let nav = 0, liquid = 0, deployedUsd = 0;
  const px: Record<string, number> = {};
  const toks = new Set([...Object.keys(f.holdings || {}), ...Object.keys(f.deployed || {})]);
  for (const tok of toks) {
    const p = await fundPrice(tok);
    px[tok] = p;
    const h = (f.holdings || {})[tok] || 0, dp = (f.deployed || {})[tok] || 0;
    nav += (h + dp) * p;
    liquid += h * p;
    deployedUsd += dp * p;
  }
  return { nav, liquid, deployedUsd, px };
}
function fundLog(f: any, kind: string, ref: string, extra: any): void {
  f.log = f.log || [];
  f.log.push({ ts: Date.now(), kind, ref, ...extra });
}
async function fundSettlePending(f: any, navInfo: any): Promise<void> {
  const pend = f.pending || {};
  const uids = Object.keys(pend).filter((u) => (pend[u].usd || 0) > 0.005);
  if (!uids.length || !(navInfo.liquid > 0)) return;
  const total = uids.reduce((s: number, u) => s + pend[u].usd, 0);
  const slice = Math.min(total, navInfo.liquid);
  const w = await loadWallets();
  for (const u of uids) {
    const payUsd = slice * (pend[u].usd / total);
    const frac = payUsd / navInfo.liquid;
    let paid = 0;
    for (const [t, bal0] of Object.entries(f.holdings)) {
      const bal = bal0 as number;
      const tokOut = bal * frac;
      if (!(tokOut > 0)) continue;
      f.holdings[t] = bal - tokOut;
      const mw = walletOf(w, u);
      mw.balances[t] = (mw.balances[t] || 0) + tokOut;
      paid += tokOut * (navInfo.px[t] || 0);
    }
    pend[u].usd = Math.max(0, (pend[u].usd || 0) - paid);
    if (pend[u].usd <= 0.005) delete pend[u];
  }
  await saveWallets(w);
  f.pending = pend;
}
function fundFmt(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
async function fundCard(f: any, uid: string): Promise<string> {
  const navInfo = await fundNAV(f);
  const nps = f.totalShares > 0 ? navInfo.nav / f.totalShares : 1;
  const hLines = Object.entries(f.holdings).filter(([, a]) => (a as number) > 0)
    .map(([t, a]) => `• ${fundFmt(a as number)} ${t} — $${((a as number) * (navInfo.px[t] || 0)).toFixed(2)}`);
  const dLines = Object.entries(f.deployed).filter(([, a]) => (a as number) > 0)
    .map(([t, a]) => `• ${fundFmt(a as number)} ${t} — $${((a as number) * (navInfo.px[t] || 0)).toFixed(2)}`);
  const m = (f.members || {})[uid];
  const myVal = m ? m.shares * nps : 0;
  const pend = ((f.pending || {})[uid]?.usd) || 0;
  return `🏦 <b>THE SYNDICATE FUND</b> — the bank works, you own the book\n` +
    `NAV <b>$${navInfo.nav.toFixed(2)}</b> · share price <b>$${nps.toFixed(4)}</b> · ${fundFmt(f.totalShares)} shares outstanding\n\n` +
    `<b>Liquid holdings</b>\n${hLines.length ? hLines.join('\n') : '· nothing liquid yet'}\n` +
    (dLines.length ? `\n<b>Deployed (working capital)</b>\n${dLines.join('\n')}\n` : '') +
    `\n<b>You</b>: ${m ? fundFmt(m.shares) + ' shares — $' + myVal.toFixed(2) : 'not in yet'}` +
    (pend > 0.005 ? `\n⏳ pending settlement: $${pend.toFixed(2)} (deployed capital — settles on next harvest)` : '') +
    `\n\nStrategy: in-house liquidity + capped treasury ops, bank-managed, receipts posted. Performance fee 10% of realized profit.\n` +
    `In: <code>/fund deposit SMC 50000</code> · out: <code>/fund withdraw all</code>`;
}
async function cmdFund(chatId: number | string, uid: string, parts: string[]) {
  const sub = (parts[1] || '').toLowerCase();
  const f = await fundState();
  if (!sub || sub === 'status') {
    await reply(chatId, await fundCard(f, uid));
    return;
  }
  if (sub === 'deposit') {
    const tok = (parts[2] || '').toUpperCase();
    const amt = parseFloat(parts[3] || '');
    if (!DESK_TOKENS[tok] || !(amt > 0)) { await reply(chatId, 'Deposit like this: /fund deposit SMC 50000 — SMRT SMF SMC TUNNEL SOL. Minimums apply.'); return; }
    if (amt < (MIN_WITHDRAW[tok] || 0)) { await reply(chatId, `Minimum fund deposit for ${tok}: ${(MIN_WITHDRAW[tok] || 0).toLocaleString()}`); return; }
    const w = await loadWallets();
    const me = walletOf(w, uid);
    if ((me.balances[tok] || 0) < amt) { await reply(chatId, `Insufficient ${tok}. Balance: ${fmtBal(me.balances)}\nEarn first (check-ins, ads, tips) or deposit: /deposit`); return; }
    const px = await fundPrice(tok);
    if (!(px > 0)) { await reply(chatId, `No live ${tok} price right now — the fund marks at DexScreener prices. Try in a few minutes.`); return; }
    const valueUsd = amt * px;
    const navInfo = await fundNAV(f);
    const navPerShare = f.totalShares > 0 ? navInfo.nav / f.totalShares : 1;
    if (!(navPerShare > 0)) { await reply(chatId, 'Fund NAV is momentarily unmarked — try in a few minutes.'); return; }
    const shares = valueUsd / navPerShare;
    me.balances[tok] = (me.balances[tok] || 0) - amt;
    await saveWallets(w);
    f.holdings[tok] = (f.holdings[tok] || 0) + amt;
    const m = f.members[uid] || { shares: 0, basis_usd: 0, in_usd: 0, out_usd: 0 };
    m.shares += shares;
    m.basis_usd = (m.basis_usd || 0) + valueUsd;
    m.in_usd = (m.in_usd || 0) + valueUsd;
    f.members[uid] = m;
    f.totalShares += shares;
    fundLog(f, 'deposit', uid, { tok, amt, valueUsd: +valueUsd.toFixed(6), shares: +shares.toFixed(6) });
    await fundSave(f);
    const nav2 = await fundNAV(f);
    await fundSettlePending(f, nav2);
    await fundSave(f);
    await reply(chatId, `🏦 <b>FUND DEPOSIT BOOKED</b>\n${fundFmt(amt)} ${tok} → <b>${fundFmt(shares)} shares</b> at $${navPerShare.toFixed(4)}/share (mark $${px.toPrecision(3)})\nYour stake: $${(m.shares * navPerShare).toFixed(2)} of $${nav2.nav.toFixed(2)} NAV\n\nThe bank puts fund capital to work in-house; receipts land in the channel. /fund for the live book.`);
    return;
  }
  if (sub === 'withdraw') {
    const m = (f.members || {})[uid];
    if (!m || !(m.shares > 0)) { await reply(chatId, 'You have no fund shares. In: /fund deposit SMC 50000'); return; }
    let sharesOut = 0;
    const mode = (parts[2] || '').toLowerCase();
    if (mode === 'all') sharesOut = m.shares;
    else if (mode === 'percent') sharesOut = m.shares * ((parseFloat(parts[3] || '0') || 0) / 100);
    else sharesOut = parseFloat(parts[2] || '');
    if (!(sharesOut > 0) || sharesOut > m.shares + 1e-9) { await reply(chatId, `Withdraw like this: /fund withdraw all · /fund withdraw 12.5 · /fund withdraw percent 25\nYou hold ${fundFmt(m.shares)} shares.`); return; }
    sharesOut = Math.min(sharesOut, m.shares);
    const navInfo = await fundNAV(f);
    const navPerShare = f.totalShares > 0 ? navInfo.nav / f.totalShares : 0;
    const valueUsd = sharesOut * navPerShare;
    const fracOfMember = sharesOut / m.shares;
    const basisRelease = (m.basis_usd || 0) * fracOfMember;
    m.shares -= sharesOut;
    m.basis_usd = (m.basis_usd || 0) - basisRelease;
    f.totalShares -= sharesOut;
    const profit = Math.max(0, valueUsd - basisRelease);
    const feeUsd = profit * (FUND_FEE_BPS / 10000);
    const feeFrac = valueUsd > 0 ? feeUsd / valueUsd : 0;
    const w = await loadWallets();
    const me = walletOf(w, uid);
    const totalBefore = f.totalShares + sharesOut;
    const ownership = totalBefore > 0 ? sharesOut / totalBefore : 0;
    let paidGrossUsd = 0;
    const feeToks: Record<string, number> = {};
    for (const [t, bal0] of Object.entries(f.holdings)) {
      const bal = bal0 as number;
      const grossTok = bal * ownership;
      if (!(grossTok > 0)) continue;
      const feeTok = grossTok * feeFrac;
      const netTok = grossTok - feeTok;
      f.holdings[t] = bal - grossTok;
      me.balances[t] = (me.balances[t] || 0) + netTok;
      paidGrossUsd += grossTok * (navInfo.px[t] || 0);
      if (feeTok > 0) feeToks[t] = feeTok;
    }
    for (const [t, ft] of Object.entries(feeToks)) { try { recordRevenue('fund', t, ft as number, 'perf:' + uid); } catch { /* ledger best-effort */ } }
    const paidUsd = paidGrossUsd * (1 - feeFrac);
    const shortfall = Math.max(0, valueUsd - paidGrossUsd);
    if (shortfall > 0.01) {
      const p = f.pending[uid] || { usd: 0 };
      p.usd = (p.usd || 0) + shortfall;
      f.pending[uid] = p;
    }
    m.out_usd = (m.out_usd || 0) + paidUsd;
    f.members[uid] = m;
    await saveWallets(w);
    fundLog(f, 'withdraw', uid, { shares: +sharesOut.toFixed(6), valueUsd: +valueUsd.toFixed(6), feeUsd: +feeUsd.toFixed(6), paidUsd: +paidUsd.toFixed(6), shortfall: +shortfall.toFixed(6) });
    await fundSave(f);
    await reply(chatId,
      `🏦 <b>FUND WITHDRAWAL SETTLED</b>\n${fundFmt(sharesOut)} shares → $${valueUsd.toFixed(2)} gross` +
      (feeUsd > 0.005 ? `\nPerformance fee 10% of $${profit.toFixed(2)} profit: $${feeUsd.toFixed(2)} → revenue ledger` : '\nNo performance fee (no profit vs your basis).') +
      `\nPaid to your desk ledger now: <b>$${paidUsd.toFixed(2)}</b> (${fmtBal(me.balances)})` +
      (shortfall > 0.01 ? `\n⏳ $${shortfall.toFixed(2)} is deployed capital — auto-settles to your ledger on the next harvest.` : '') +
      `\n/fund for the live book.`);
    return;
  }
  if (sub === 'deploy' || sub === 'harvest') {
    if (!(await isGroupAdmin(uid))) { await reply(chatId, `⛔ /fund ${sub} is admin-only — the bank moves fund capital (dry-first, owner-gated).`); return; }
    const tok = (parts[2] || '').toUpperCase();
    const amt = parseFloat(parts[3] || '');
    if (!DESK_TOKENS[tok] || !(amt > 0)) { await reply(chatId, `Admin: /fund ${sub} TOKEN AMOUNT — ${sub === 'deploy' ? 'earmark liquid capital for on-chain deployment' : 'credit a harvest back into the fund'}`); return; }
    if (sub === 'deploy') {
      if ((f.holdings[tok] || 0) < amt) { await reply(chatId, `Fund holds ${fundFmt(f.holdings[tok] || 0)} ${tok} liquid — can't earmark ${fundFmt(amt)}.`); return; }
      f.holdings[tok] = (f.holdings[tok] || 0) - amt;
      f.deployed[tok] = (f.deployed[tok] || 0) + amt;
    } else {
      f.holdings[tok] = (f.holdings[tok] || 0) + amt;
      fundLog(f, 'harvest', uid, { tok, amt });
      await fundSave(f);
      const navH = await fundNAV(f);
      await fundSettlePending(f, navH);
      await reply(chatId, `🏦 <b>HARVEST CREDITED</b> — ${fundFmt(amt)} ${tok} back into the fund ($${(amt * (navH.px[tok] || 0)).toFixed(2)}). Pending settlements swept. /fund for the book.`);
      return;
    }
    fundLog(f, sub, uid, { tok, amt });
    await fundSave(f);
    await reply(chatId, `🏦 <b>CAPITAL ${sub === 'deploy' ? 'DEPLOYED' : 'MOVED'}</b> — ${fundFmt(amt)} ${tok}. On-chain execution runs through the bank's existing tools (dry-first, desk_halt-aware). /fund for the book.`);
    return;
  }
  if (sub === 'drop') {
    if (!(await isGroupAdmin(uid))) { await reply(chatId, '⛔ /fund drop is admin-only.'); return; }
    const ok = await postToChannel(await fundCard(f, uid));
    await reply(chatId, ok ? 'Fund receipt posted to the channel. 🏦' : 'Channel post failed — check bot admin rights in the channel.');
    return;
  }
  await reply(chatId, '<b>THE SYNDICATE FUND</b>\n/fund — the live book\n/fund deposit SMC 50000 — in (SMRT SMF SMC TUNNEL SOL)\n/fund withdraw all — out (pro-rata of holdings, 10% performance fee on profit)\nStrategy: in-house liquidity + capped treasury ops, bank-managed.');
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
    await reply(chatId, 'Tip like this: /tip 100 SMRT @koda\n(or reply to their message with /tip 100 SMRT) — SMRT SMF SMC TUNNEL SOL');
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
  /* v11: prefer true P2P on-chain tip from the sender's own wallet */
  try {
    if (await ensureWeb3()) {
      const fromW = await myWallet(uidOf(m));
      const toW = await myWallet(targetUid);
      if (fromW && toW) {
        const bals = await chainBalances(fromW.addr);
        const needFee = 0.0002;
        if ((bals[tok] || 0) >= amt && (bals.SOL || 0) >= needFee) {
          const code = Math.random().toString(36).slice(2, 8).toUpperCase();
          const pend: any = await getState('tip_pending');
          pend[code] = { uid: uidOf(m), kind: 'ptip', to: targetUid, toAddr: toW.addr, tok, amt, exp: Date.now() + 10 * 60e3 };
          await setState('tip_pending', pend);
          await reply(chatId,
            `<b>P2P TIP</b> ${amt.toLocaleString()} ${tok} → wallet <code>${toW.addr.slice(0, 8)}…${toW.addr.slice(-6)}</code>\n` +
            `Settles on-chain from YOUR wallet. To execute within 10 minutes, reply:\n<code>CONFIRM ${code}</code>`);
          return;
        }
      }
    }
  } catch { /* fall through to ledger tip */ }
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
    await reply(chatId, 'Withdraw like this: /withdraw 50 SMRT');
    return;
  }
  if (!(await initDesk())) { await reply(chatId, 'Treasury offline — withdrawals unavailable.'); return; }
  if (!(await loadChainLibs())) { await reply(chatId, 'Chain libraries warming up — try again in a few seconds.'); return; }
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
  if (await deskHalted()) { await reply(chatId, '⛔ On-chain sends are halted by admin. Try again later.'); return; }
  const cap = PER_TX_CAP[p.tok];
  if (cap != null && p.amt > cap) { await reply(chatId, `Per-transaction cap for ${p.tok} is ${cap.toLocaleString()}. Split into smaller amounts.`); return; }
  const day = new Date().toISOString().slice(0, 10);
  const cnt: any = await getState('tip_wd_count');
  if (cnt.day !== day) { cnt.day = day; cnt.n = {}; }
  if ((cnt.n[p.uid] || 0) >= DAILY_WD_COUNT) { await reply(chatId, `Daily withdrawal limit (${DAILY_WD_COUNT}) reached. Back tomorrow.`); return; }
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
      const sent: any = await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
      sig = sent;
    } else {
      const mint = new WEB3.PublicKey(await mintOf(p.tok));
      const dec = await tokenDecimals(await mintOf(p.tok));
      const fromAta = await getAta(mint, TIP_KP.publicKey);
      const toWallet = new WEB3.PublicKey(me.linked);
      const toAta = await getAta(mint, toWallet);
      const toAtaInfo: any = await rpcCall('getAccountInfo', [toAta.toBase58(), { encoding: 'base64' }]);
      const tx = new WEB3.Transaction();
      if (!toAtaInfo?.value) {
        tx.add(createAtaIx(TIP_KP.publicKey, toAta, toWallet, mint));
      }
      tx.add(createTransferIx(fromAta, toAta, TIP_KP.publicKey, Math.round(p.amt * 10 ** dec)));
      const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = TIP_KP.publicKey;
      tx.sign(TIP_KP);
      const sent: any = await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
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
    cnt.n[p.uid] = (cnt.n[p.uid] || 0) + 1;
    await setState('tip_wd_count', cnt);
    await saveWallets(w);
    await chainLog({ kind: 'withdraw', uid: p.uid, tok: p.tok, amt: p.amt, sig });
    await addPoints(p.uid, 1);
    await reply(chatId, `✅ Withdrew <b>${p.amt.toLocaleString()} ${p.tok}</b>\nTx: <code>${sig}</code>\nBalance: ${fmtBal(me.balances)}`);
  } catch (e) {
    await reply(chatId, `Withdrawal failed: ${String(e).slice(0, 140)}\nNo balance was deducted.`);
  }
}

async function execTrade(chatId: number | string, p: any) {
  if (await deskHalted()) { await reply(chatId, '⛔ Trading is halted by admin. Order discarded.'); return; }
  const w = await loadWallets();
  const me = walletOf(w, p.uid);
  const spendTok = p.side === 'buy' ? 'SOL' : p.tok;
  const gainTok = p.side === 'buy' ? p.tok : 'SOL';
  if ((me.balances[spendTok] || 0) < p.amt) { await reply(chatId, 'Balance changed — order cancelled.'); return; }
  try {
    await loadChainLibs();
    const sd: any = await (await fetch('https://lite-api.jup.ag/swap/v1/swap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse: p.quote, userPublicKey: TIP_ADDRESS, wrapUnwrapSOL: true }),
    })).json();
    if (!sd.swapTransaction) throw new Error(sd.error || 'Jupiter did not return a swap transaction');
    const txBytes = Uint8Array.from(atob(sd.swapTransaction), (c: string) => c.charCodeAt(0));
    const tx = WEB3.VersionedTransaction.deserialize(txBytes);
    tx.sign([TIP_KP]);
    const sent: any = await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }]);
    const ok = await confirmTx(sent);
    if (!ok) { await reply(chatId, `Swap submitted but not confirmed in time: ${sent}\nAdmin will reconcile manually.`); return; }
    const decs: any = { SOL: 9, SMRT: 9, SMF: 9, SMC: 9, TUNNEL: 9 };
    const outAmt = parseInt(p.quote.outAmount || '0', 10) / 10 ** (decs[gainTok] || 9);
    const fee = Math.max(outAmt * TRADE_FEE_BPS / 10000, 0);
    const netOut = outAmt - fee;
    me.balances[spendTok] = (me.balances[spendTok] || 0) - p.amt;
    me.balances[gainTok] = (me.balances[gainTok] || 0) + netOut;
    if (fee > 0) await recordRevenue('trade_fee', gainTok, fee, `${p.side} ${p.tok} ${p.amt}`);
    if (spendTok === 'SOL') { const usage: any = await getState('tip_wd_usage'); usage.sol = (usage.sol || 0) + p.amt; await setState('tip_wd_usage', usage); }
    await saveWallets(w);
    await chainLog({ kind: 'trade', uid: p.uid, side: p.side, tok: p.tok, amt: p.amt, out: netOut, fee, sig: sent });
    await addPoints(p.uid, 5);
    await reply(chatId, `✅ ${p.side.toUpperCase()} filled: <b>${p.amt.toLocaleString()} ${spendTok}</b> → <b>${netOut.toLocaleString()} ${gainTok}</b>\nDesk fee (1%): ${fee.toLocaleString()} ${gainTok}\nTx: <code>${sent}</code>\nBalance: ${fmtBal(me.balances)}`);
  } catch (e) {
    await reply(chatId, `Trade failed: ${String(e).slice(0, 140)}\nNo balance was moved.`);
  }
}

async function cmdPrice(chatId: number | string, parts: string[]) {
  const tok = (parts[1] || '').toUpperCase();
  const mint = await mintOf(tok);
  if (!mint) { await reply(chatId, 'Tokens: SMRT SMF SMC TUNNEL SOL + launched tokens'); return; }
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
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
  const tokMint = await mintOf(tok);
  if (!['buy', 'sell'].includes(side) || !tokMint || tok === 'SOL' || !(amt > 0)) {
    await reply(chatId, 'Trade like this: /trade buy SMRT 0.01\nLive Jupiter quote — desk executes after you confirm.');
    return;
  }
  try {
    const input = side === 'buy' ? DESK_TOKENS.SOL : tokMint;
    const output = side === 'buy' ? tokMint : DESK_TOKENS.SOL;
    const dec = side === 'buy' ? 9 : await tokenDecimals(tokMint);
    const r = await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${input}&outputMint=${output}&amount=${Math.round(amt * 10 ** dec)}&slippageBps=500`);
    const q = await r.json();
    if (q.error) { await reply(chatId, `Jupiter: ${q.error}`); return; }
    const outDec = side === 'buy' ? await tokenDecimals(tokMint) : 9;
    const outAmt = (parseInt(q.outAmount) / 10 ** outDec);
    const paper: any = await getState('desk_paper_trades');
    const list: any[] = Array.isArray(paper.list) ? paper.list : [];
    list.push({ ts: new Date().toISOString(), uid, side, tok, amt, out: outAmt, impact: q.priceImpactPct, route: (q.routePlan || []).length, mode: 'live-quoted' });
    paper.list = list.slice(-200);
    await setState('desk_paper_trades', paper);
    const liveReady = (await initDesk()) && (await loadChainLibs());
    const spendTok = side === 'buy' ? 'SOL' : tok;
    const spendCap = side === 'buy' ? PER_TX_CAP.SOL : PER_TX_CAP[tok];
    if (!liveReady) {
      await reply(chatId,
        `<b>PAPER ${side.toUpperCase()}</b> ${amt} ${spendTok} → ~${outAmt.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${side === 'buy' ? tok : 'SOL'}\n` +
        `Impact: ${q.priceImpactPct}% · Route hops: ${(q.routePlan || []).length}\n` +
        `Logged to the desk ledger (#${list.length}). Live execution unlocks after the treasury is funded.`);
      return;
    }
    if (await deskHalted()) {
      await reply(chatId, `⛔ Trading is halted — order logged as paper only.\nQuoted: ${amt} ${spendTok} → ~${outAmt.toLocaleString()} ${side === 'buy' ? tok : 'SOL'}`);
      return;
    }
    const w = await loadWallets();
    const me = walletOf(w, uid);
    if ((me.balances[spendTok] || 0) < amt) { await reply(chatId, `Insufficient ${spendTok}. Balance: ${fmtBal(me.balances)}`); return; }
    if (spendCap != null && amt > spendCap) { await reply(chatId, `Per-order cap for ${spendTok} is ${spendCap.toLocaleString()}. Split into smaller orders.`); return; }
    if (spendTok === 'SOL') {
      const day = new Date().toISOString().slice(0, 10);
      const usage: any = await getState('tip_wd_usage');
      if (usage.day !== day) { usage.day = day; usage.sol = 0; }
      if ((usage.sol || 0) + amt > DAILY_SOL_CAP) {
        await reply(chatId, `Daily SOL spend cap is ${DAILY_SOL_CAP} (hot-wallet discipline). Back tomorrow or size down.`);
        return;
      }
    }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const pend: any = await getState('tip_pending');
    pend[code] = { uid, kind: 'trade', side, tok, amt, quote: q, exp: Date.now() + 10 * 60e3 };
    await setState('tip_pending', pend);
    await reply(chatId,
      `<b>LIVE ORDER — ${side.toUpperCase()} ${tok}</b>\nSpend: ${amt.toLocaleString()} ${spendTok}\nQuoted receive: ~${outAmt.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${side === 'buy' ? tok : 'SOL'}\n` +
      `Impact: ${q.priceImpactPct}% · Route hops: ${(q.routePlan || []).length}\n\n` +
      `To execute within 10 minutes, reply:\n<code>CONFIRM ${code}</code>`);
  } catch (e) {
    await reply(chatId, `Quote failed: ${String(e).slice(0, 120)}`);
  }
}

/* ---------------- v11: P2P floor commands ---------------- */
async function cmdWallet(chatId: number | string, uid: string) {
  if (!(await ensureWeb3())) { await reply(chatId, 'Chain libraries unavailable right now — try again in a few seconds.'); return; }
  const w = await myWallet(uid);
  if (!w) { await reply(chatId, 'Wallet creation failed — try again shortly.'); return; }
  const bals = await chainBalances(w.addr);
  const extra = await extraTokens();
  const allT = { ...DESK_TOKENS, ...extra };
  const lines = Object.keys(allT).map(t => `  ${t}: ${(bals[t] || 0).toLocaleString()}`).join('\n');
  await reply(chatId,
    `<b>Your P2P wallet</b>\n<code>${w.addr}</code>\n\n` +
    `On-chain balances:\n${lines}\n\n` +
    `Fund it by sending SOL or SMRT/SMF/SMC/TUNNEL to this address from any wallet (Phantom, exchange, the Bank).\n` +
    `Keep a dust of SOL (~0.001) for network fees — tips and swaps sign from YOUR keys, desk never holds your funds.`);
}

async function execPTip(chatId: number | string, p: any) {
  if (await deskHalted()) { await reply(chatId, '⛔ On-chain sends are halted by admin. Try again later.'); return; }
  try {
    if (!(await ensureWeb3())) throw new Error('chain libraries unavailable');
    const fromW = await myWallet(p.uid);
    if (!fromW) throw new Error('sender wallet missing');
    const mint = await mintOf(p.tok);
    if (!mint) throw new Error('unknown token ' + p.tok);
    const sig = await sendSPL(fromW.kp, p.toAddr, mint, p.amt);
    const ok = await confirmTx(sig);
    if (!ok) { await reply(chatId, `Tip submitted but not confirmed in time: ${sig}`); return; }
    await chainLog({ kind: 'ptip', from: p.uid, to: p.to, tok: p.tok, amt: p.amt, sig });
    await addPoints(p.uid, 2);
    await reply(chatId, `⚡ P2P tip settled on-chain: <b>${p.amt.toLocaleString()} ${p.tok}</b>\nTx: <code>${sig}</code>`);
    try { await reply(p.to, `⚡ You were tipped <b>${p.amt.toLocaleString()} ${p.tok}</b> on-chain!\nTx: ${sig}\n${OS_LINK}`); } catch { /* dm closed */ }
  } catch (e) {
    await reply(chatId, `P2P tip failed: ${String(e).slice(0, 140)}\nNo funds moved.`);
  }
}

async function cmdQuote(chatId: number | string, parts: string[]) {
  const tok = (parts[1] || '').toUpperCase();
  const qMint = await mintOf(tok);
  if (!qMint || tok === 'SOL') { await reply(chatId, 'Try: /quote SMRT — shows what the Bank pays (bid) and charges (ask)'); return; }
  const SPREAD = 0.03; // bank quotes 3% wide each side of mid
  try {
    const dec = await tokenDecimals(qMint);
    const unit = Math.round(1 * 10 ** dec);
    const qBuy = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${DESK_TOKENS.SOL}&outputMint=${qMint}&amount=100000000&slippageBps=300`)).json();
    const qSell = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${qMint}&outputMint=${DESK_TOKENS.SOL}&amount=${unit}&slippageBps=300`)).json();
    if (qBuy.error || qSell.error) { await reply(chatId, `${tok}: thin route right now — Jupiter could not quote both sides.`); return; }
    const pxPerToken = 0.1 / (parseInt(qBuy.outAmount) / 10 ** dec); // SOL per 1 token
    const pxSell = (parseInt(qSell.outAmount) / 1e9);                 // SOL received per 1 token
    const mid = (pxPerToken + pxSell) / 2;
    const bid = mid * (1 - SPREAD), ask = mid * (1 + SPREAD);
    const bank = (await bankAddress()) || '(bank initializing)';
    await reply(chatId,
      `<b>BANK QUOTE — ${tok}/SOL</b>\n` +
      `  WE BUY (your sell): ${bid.toExponential(4)} SOL/token\n` +
      `  WE SELL (your buy): ${ask.toExponential(4)} SOL/token\n` +
      `Mid (Jupiter): ${mid.toExponential(4)} · Spread 6%\n` +
      `Valid ~60s. Trade against the Bank: /offer sell &lt;amt&gt; ${tok} &lt;price SOL&gt; or /offer buy &lt;amt&gt; ${tok} &lt;price SOL&gt;\n` +
      `Bank desk: <code>${bank}</code>`);
  } catch (e) {
    await reply(chatId, `Quote failed: ${String(e).slice(0, 120)}`);
  }
}

type P2POffer = { id: string; by: string; side: 'sell' | 'buy'; tok: string; amt: number; price: number; exp: number; ts: number };
async function getOffers(): Promise<P2POffer[]> {
  const st: any = await getState('p2p_offers');
  const list: P2POffer[] = Array.isArray(st.list) ? st.list : [];
  const now = Date.now();
  return list.filter(o => o.exp > now);
}
async function cmdOffer(chatId: number | string, uid: string, m: any, parts: string[]) {
  // /offer sell 100000 SMRT 0.00005   (= sell 100k SMRT at 0.00005 SOL each)
  const side = (parts[1] || '').toLowerCase();
  const amt = parseFloat(parts[2] || '');
  const tok = (parts[3] || '').toUpperCase();
  const price = parseFloat(parts[4] || '');
  if (!['sell', 'buy'].includes(side) || !(amt > 0) || !(await mintOf(tok)) || tok === 'SOL' || !(price > 0)) {
    await reply(chatId, 'Post a deal like this: /offer sell 100000 SMRT 0.00005\nSells 100k SMRT at 0.00005 SOL each. Floor or Bank can take it. Deals expire in 2h.');
    return;
  }
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  const st: any = await getState('p2p_offers');
  const list: P2POffer[] = Array.isArray(st.list) ? st.list : [];
  list.push({ id, by: uid, side: side as 'sell' | 'buy', tok, amt, price, exp: Date.now() + 2 * 3600e3, ts: Date.now() });
  await setState('p2p_offers', { list: list.slice(-100) });
  const who = m.from?.username ? '@' + m.from.username : (m.from?.first_name || uid);
  const total = amt * price;
  await reply(chatId,
    `<b>OFFER ${id}</b> — ${who}\n${side.toUpperCase()} ${amt.toLocaleString()} ${tok} @ ${price} SOL each\n` +
    `Total: ${total.toFixed(4)} SOL\nTake it: /take ${id}`);
}

async function cmdOffers(chatId: number | string) {
  const list = await getOffers();
  if (!list.length) { await reply(chatId, 'No open offers. Be the first: /offer sell 100000 SMRT 0.00005'); return; }
  const lines = list.slice(-12).map(o => `  ${o.id} · ${o.side.toUpperCase()} ${o.amt.toLocaleString()} ${o.tok} @ ${o.price} SOL (${(o.amt * o.price).toFixed(4)} SOL total)`);
  await reply(chatId, `<b>Open P2P offers</b>\n${lines.join('\n')}\n\nTake one: /take &lt;ID&gt;`);
}

async function cmdTake(chatId: number | string, uid: string, parts: string[]) {
  const id = (parts[1] || '').toUpperCase();
  if (!id) { await reply(chatId, 'Take a deal like this: /take BGOY — the ID is shown in /offers'); return; }
  const list = await getOffers();
  const o = list.find(x => x.id === id);
  if (!o) { await reply(chatId, `Offer ${id} not found or expired. /offers lists open ones.`); return; }
  if (o.by === uid) { await reply(chatId, 'You cannot take your own offer.'); return; }
  if (!(await ensureWeb3())) { await reply(chatId, 'Chain libraries unavailable — try again shortly.'); return; }
  const makerW = await myWallet(o.by);
  const takerW = await myWallet(uid);
  if (!makerW || !takerW) { await reply(chatId, 'Wallet resolution failed.'); return; }
  const total = o.amt * o.price;
  const takerBals = await chainBalances(takerW.addr);
  const makerBals = await chainBalances(makerW.addr);
  const takerNeeds = o.side === 'sell' ? { SOL: total } : { [o.tok]: o.amt };
  const makerNeeds = o.side === 'sell' ? { [o.tok]: o.amt } : { SOL: total };
  const have = (b: Record<string, number>, need: Record<string, number>) => Object.entries(need).every(([t, a]) => (b[t] || 0) >= a * 1.02);
  if (!have(takerBals, takerNeeds) || !have(makerBals, makerNeeds)) {
    await reply(chatId, `Offer ${id} cannot settle — one side lacks on-chain funds (checked both wallets).`);
    return;
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const pend: any = await getState('tip_pending');
  pend[code] = { uid, kind: 'ptake', offer: o, exp: Date.now() + 10 * 60e3 };
  await setState('tip_pending', pend);
  await reply(chatId,
    `<b>TAKE ${id}</b> — settle P2P on-chain\nYou ${o.side === 'sell' ? 'receive ' + o.amt.toLocaleString() + ' ' + o.tok + ' for ' + total.toFixed(4) + ' SOL' : 'pay ' + o.amt.toLocaleString() + ' ' + o.tok + ' for ' + total.toFixed(4) + ' SOL'}\n` +
    `Two wallet-to-wallet transactions, desk escrows the sequence. To execute within 10 minutes, reply:\n<code>CONFIRM ${code}</code>`);
}

async function execPTake(chatId: number | string, p: any) {
  if (await deskHalted()) { await reply(chatId, '⛔ On-chain sends are halted by admin.'); return; }
  const o: P2POffer = p.offer;
  try {
    if (!(await ensureWeb3())) throw new Error('chain libraries unavailable');
    // remove offer from board first (idempotent-ish)
    const st: any = await getState('p2p_offers');
    await setState('p2p_offers', { list: (Array.isArray(st.list) ? st.list : []).filter((x: P2POffer) => x.id !== o.id) });
    const makerW = await myWallet(o.by);
    const takerW = await myWallet(p.uid);
    if (!makerW || !takerW) throw new Error('wallet resolution failed');
    const total = o.amt * o.price;
    const makerIsSeller = o.side === 'sell';
    const sellerW = makerIsSeller ? makerW : takerW;
    const buyerW = makerIsSeller ? takerW : makerW;
    const sig1 = await sendSOL(buyerW.kp, sellerW.addr, total);
    const ok1 = await confirmTx(sig1);
    if (!ok1) throw new Error(`payment tx unconfirmed: ${sig1}`);
    const sig2 = await sendSPL(sellerW.kp, buyerW.addr, await mintOf(o.tok), o.amt);
    await chainLog({ kind: 'ptake', offer: o.id, buyer: buyerW.addr, seller: sellerW.addr, tok: o.tok, amt: o.amt, sol: total, sig_pay: sig1, sig_fill: sig2 });
    await addPoints(p.uid, 10);
    await addPoints(o.by, 5);
    await reply(chatId, `✅ P2P settlement complete\nPayment: <code>${sig1}</code>\nFill: <code>${sig2}</code>`);
    try { await reply(o.by, `Your offer ${o.id} was taken and settled.\nPayment: ${sig1}\nFill: ${sig2}`); } catch { /* dm closed */ }
  } catch (e) {
    await chainLog({ kind: 'ptake_fail', offer: o.id, err: String(e).slice(0, 200) });
    await reply(chatId, `Settlement problem: ${String(e).slice(0, 160)}\nAdmins see it in the chainlog — do not re-take until this is reviewed.`);
  }
}

async function cmdBank(chatId: number | string) {
  const addr = await bankAddress();
  if (!addr) { await reply(chatId, 'The Bank is initializing (admin sets BANK_KEY). It will quote and market-make SMRT/SMF/SMC/TUNNEL here soon.'); return; }
  await ensureWeb3();
  if (WEB3 && BANK_KP && !BANK_KP.kp) BANK_KP.kp = WEB3.Keypair.fromSecretKey(new Uint8Array(BANK_KP.secret));
  const bals = await chainBalances(addr);
  const lines = Object.keys(DESK_TOKENS).map(t => `  ${t}: ${(bals[t] || 0).toLocaleString()}`).join('\n');
  await reply(chatId,
    `<b>Smartz Bank</b>\n<code>${addr}</code>\nInventory:\n${lines}\n\n` +
    `The Bank quotes two-way prices (/quote) and takes P2P offers when they beat its book. ` +
    `Its keys are admin-held; its books are public.`);
}

/* ---------------- v14: Kill Points + Bank cycle + agent wallets ---------------- */
async function addPoints(uid: string, pts: number): Promise<void> {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const st: any = await getState('kill_points');
    if (st.day !== day) { st.day = day; st.pts = {}; }
    st.pts[uid] = (st.pts[uid] || 0) + pts;
    await setState('kill_points', st);
  } catch { /* points are gravy */ }
}
async function cmdPoints(chatId: number | string, uid: string) {
  const st: any = await getState('kill_points');
  const pts: Record<string, number> = st.pts || {};
  const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
  const inv: Record<string, string> = {};
  for (const [u, id] of Object.entries(users)) inv[id] = u;
  const board = Object.entries(pts).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10);
  const lines = board.length
    ? board.map(([id, p], i) => `  ${i + 1}. @${inv[id] || id} — ${p} pts`).join('\n')
    : '  No points yet today — first blood is worth double bragging rights.';
  const mine = pts[uid] || 0;
  await reply(chatId,
    `<b>KILL POINTS — today</b>\n${lines}\n\nYour score: <b>${mine}</b>\n` +
    `Earn: tip +2 · settle an offer +10 · get bank-taken +5 · desk trade +5 · withdraw +1`);
}

/* ---------------- v23: Duel — member-vs-member Kill Points flips ---------------- */
const DUEL_MAX_STAKE = 25;
const DUEL_EXP_MS = 5 * 60e3;

async function kpBal(uid: string): Promise<number> {
  try {
    const kp: any = await getState('kill_points');
    return ((kp.pts || {})[uid]) || 0;
  } catch { return 0; }
}

async function kpTransfer(fromUid: string, toUid: string, amt: number): Promise<void> {
  const kp: any = await getState('kill_points');
  const pts: Record<string, number> = kp.pts || {};
  pts[fromUid] = (pts[fromUid] || 0) - amt;
  pts[toUid] = (pts[toUid] || 0) + amt;
  kp.pts = pts;
  await setState('kill_points', kp);
}

async function openDuels(): Promise<any[]> {
  const st: any = await getState('duels');
  const list: any[] = Array.isArray(st.list) ? st.list : [];
  const now = Date.now();
  const open = list.filter(d => now - d.ts < DUEL_EXP_MS);
  if (open.length !== list.length) await setState('duels', { list: open });
  return open;
}

async function cmdDuel(chatId: number | string, m: any, uid: string, parts: string[]) {
  const sub = (parts[1] || '').toLowerCase();
  if (sub === 'accept') return cmdDuelAccept(chatId, uid);
  if (sub === 'decline') return cmdDuelDecline(chatId, uid);
  /* /duel @name 20 — issue a challenge */
  const target = (parts[1] || '').replace(/^@/, '').toLowerCase();
  const stake = Math.floor(parseFloat(parts[2] || ''));
  if (!target || !(stake >= 1) || stake > DUEL_MAX_STAKE) {
    await reply(chatId, `Duel like this: /duel @koda 20\nThey accept with /duel accept (5 min window). Winner takes the stake — zero-sum, the desk mints nothing. Stake 1–${DUEL_MAX_STAKE} Kill Points.`);
    return;
  }
  const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
  const toUid = users[target] || (/^\d+$/.test(target) ? target : '');
  if (!toUid) { await reply(chatId, `I don't know @${target} yet — they need to say something in the group first.`); return; }
  if (toUid === uid) { await reply(chatId, 'Dueling yourself is a coherence violation. 🙂'); return; }
  const open = await openDuels();
  if (open.some(d => d.by === uid || d.to === uid)) { await reply(chatId, 'You already have an open duel — settle it first. /duel accept or /duel decline'); return; }
  if (open.some(d => d.by === toUid || d.to === toUid)) { await reply(chatId, `@${target} is already locked in another duel. Wait for the coin to land.`); return; }
  if (await kpBal(uid) < stake) { await reply(chatId, `You need ${stake} Kill Points to stake that — you have ${await kpBal(uid)}.`); return; }
  if (await kpBal(toUid) < stake) { await reply(chatId, `@${target} only has ${await kpBal(toUid)} Kill Points — lower the stake.`); return; }
  open.push({ id: Math.random().toString(36).slice(2, 10), by: uid, byU: m.from?.username || '', to: toUid, toU: target, stake, ts: Date.now() });
  await setState('duels', { list: open });
  await reply(chatId,
    `⚔️ <b>DUEL</b> — @${m.from?.username || uid} challenges <b>@${target}</b> for <b>${stake} Kill Points</b>.\n` +
    `@${target}: accept with <code>/duel accept</code> or walk with <code>/duel decline</code>. 5 minutes. One coin, one winner.`);
}

async function cmdDuelAccept(chatId: number | string, uid: string) {
  const open = await openDuels();
  const d = open.find(x => x.to === uid);
  if (!d) { await reply(chatId, 'No open duel against you. Challenge someone: /duel @name 20'); return; }
  /* re-validate stakes at the moment of the flip */
  const byBal = await kpBal(d.by), toBal = await kpBal(uid);
  const rest = open.filter(x => x.id !== d.id);
  await setState('duels', { list: rest });
  if (byBal < d.stake || toBal < d.stake) {
    await reply(chatId, `⚔️ Duel void — a stake changed hands before the coin landed. No points moved. Challenge again.`);
    return;
  }
  const challengerWins = Math.random() < 0.5;
  const winner = challengerWins ? d.by : uid;
  const loser = challengerWins ? uid : d.by;
  await kpTransfer(loser, winner, d.stake);
  const winName = challengerWins ? ('@' + d.byU || d.by) : ('@' + (await nameOf(uid)) || uid);
  const loseName = challengerWins ? ('@' + (await nameOf(uid)) || uid) : ('@' + d.byU || d.by);
  await reply(chatId,
    `🪙⚔️ <b>HEADS.</b>\n<b>${winName}</b> takes <b>+${d.stake}</b> from ${loseName}. Zero-sum — the desk minted nothing, the floor rebalanced.\n` +
    `Run it back: /duel @${challengerWins ? (await nameOf(uid)) || 'them' : d.byU || 'them'} ${d.stake}`);
}

async function cmdDuelDecline(chatId: number | string, uid: string) {
  const open = await openDuels();
  const d = open.find(x => x.to === uid);
  if (!d) { await reply(chatId, 'No open duel against you to decline.'); return; }
  await setState('duels', { list: open.filter(x => x.id !== d.id) });
  await reply(chatId, `⚔️ @${(await nameOf(uid)) || uid} walks. The coin stays in its sheath. No points moved.`);
}

/* ---------------- v22: Flip — Kill Points coin toss ---------------- */
const FLIP_MAX_STAKE = 25;
const FLIP_DAILY_GAIN_CAP = 100;
const FLIP_COOLDOWN_MS = 20e3;

async function cmdFlip(chatId: number | string, uid: string, parts: string[]) {
  const stake = Math.floor(parseFloat(parts[1] || ''));
  const call = (parts[2] || '').toLowerCase();
  if (!(stake >= 1) || stake > FLIP_MAX_STAKE || !['heads', 'tails'].includes(call)) {
    await reply(chatId, `Flip like this: /flip 10 heads\nStake 1–${FLIP_MAX_STAKE} Kill Points. Win → +stake, lose → −stake. ${FLIP_DAILY_GAIN_CAP} pts/day cap from flips, 20s cooldown. Zero money — pure floor cred.`);
    return;
  }
  const cd: any = await getState('flip_cooldown');
  const now = Date.now();
  if (cd[uid] && now - cd[uid] < FLIP_COOLDOWN_MS) {
    await reply(chatId, 'The coin is still spinning — 20s between flips.');
    return;
  }
  const kp: any = await getState('kill_points');
  const pts: Record<string, number> = kp.pts || {};
  if ((pts[uid] || 0) < stake) {
    await reply(chatId, `You need ${stake} Kill Points to flip that — you have ${pts[uid] || 0}. Earn: tip +2 · settle offers +10 · trades +5 · /ref joins +25.`);
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  const gain: any = await getState('flip_daily_gain');
  if (gain.day !== day) { gain.day = day; gain.pts = {}; }
  const landed = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = landed === call;
  cd[uid] = now;
  await setState('flip_cooldown', cd);
  if (won) {
    if ((gain.pts[uid] || 0) + stake > FLIP_DAILY_GAIN_CAP) {
      await reply(chatId, `Daily flip-win cap (${FLIP_DAILY_GAIN_CAP} pts) reached — the floor wants skill, not just luck. Back tomorrow.`);
      return;
    }
    gain.pts[uid] = (gain.pts[uid] || 0) + stake;
    await setState('flip_daily_gain', gain);
    await addPoints(uid, stake);
    await reply(chatId, `🪙 <b>${landed.toUpperCase()}</b> — it came up ${landed}. @${(await nameOf(uid)) || uid} takes <b>+${stake}</b>. The floor respects a clean call.`);
  } else {
    /* subtract directly — points must be losable or flips mean nothing */
    kp.pts[uid] = (pts[uid] || 0) - stake;
    await setState('kill_points', kp);
    await reply(chatId, `🪙 <b>${landed.toUpperCase()}</b> — you called ${call}. <b>−${stake}</b> Kill Points. The coin keeps what it takes. /points to see the board.`);
  }
}

async function nameOf(uid: string): Promise<string> {
  try {
    const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
    for (const [u, id] of Object.entries(users)) if (id === uid) return u;
  } catch { /* fall through */ }
  return '';
}

/* ---------------- v21: Floor Engine — rain, watches, referrals, channel ---------------- */
async function trackActivity(m: any): Promise<void> {
  try {
    const st: any = await getState('floor_activity');
    const uid = uidOf(m);
    const prev = st[uid] || { t: 0 };
    const now = Date.now();
    if (now - (prev.t || 0) < 5 * 60e3) return; // throttle state writes
    st[uid] = { t: now, u: m.from?.username || '' };
    const keys = Object.keys(st);
    if (keys.length > 500) { // keep the floor roster bounded
      keys.sort((a, b) => (st[b].t || 0) - (st[a].t || 0));
      for (const k of keys.slice(500)) delete st[k];
    }
    await setState('floor_activity', st);
  } catch { /* activity is best-effort */ }
}

async function recentMembers(excludeUid: string, hours = 24, limit = 10): Promise<{ uid: string; u: string }[]> {
  const st: any = await getState('floor_activity');
  const cutoff = Date.now() - hours * 3600e3;
  return Object.entries(st)
    .filter(([id, v]: [string, any]) => id !== excludeUid && (v.t || 0) >= cutoff)
    .sort((a: any, b: any) => b[1].t - a[1].t)
    .slice(0, limit)
    .map(([id, v]: [string, any]) => ({ uid: id, u: v.u || '' }));
}

async function cmdRain(chatId: number | string, m: any, parts: string[]) {
  // /rain 100 SMRT — split a tip across the last 24h active floor members
  const amt = parseFloat(parts[1] || '');
  const tok = (parts[2] || '').toUpperCase();
  if (!(amt > 0) || !DESK_TOKENS[tok]) {
    await reply(chatId, 'Rain like this: /rain 100 SMRT — splits across the members who were active in the last 24h (max 10). SMRT SMF SMC TUNNEL SOL');
    return;
  }
  const uid = uidOf(m);
  const targets = await recentMembers(uid);
  if (targets.length < 2) { await reply(chatId, 'The floor is quiet — need at least 2 active members in the last 24h to rain. Bring people in with /ref.'); return; }
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if ((me.balances[tok] || 0) < amt) { await reply(chatId, `Insufficient ${tok}. Balance: ${fmtBal(me.balances)}\nDeposit: /deposit`); return; }
  const share = Math.floor((amt / targets.length) * 1e6) / 1e6;
  me.balances[tok] = (me.balances[tok] || 0) - amt;
  if (m.from?.username) me.username = m.from.username;
  const names: string[] = [];
  for (const t of targets) {
    const tw = walletOf(w, t.uid);
    tw.balances[tok] = (tw.balances[tok] || 0) + share;
    if (t.u) tw.username = t.u;
    names.push('@' + (t.u || t.uid));
    await addPoints(t.uid, 1);
  }
  await saveWallets(w);
  await addPoints(uid, 2);
  await reply(chatId, `🌧 <b>RAIN</b> — <b>${amt.toLocaleString()} ${tok}</b> split ${share.toLocaleString()} × ${targets.length}:\n${names.join(' ')}\n\nRain makers get +2 Kill Points. The floor remembers who makes it rain.`);
}

/* ---------------- v51: Holder Layer — /zrain on-chain ZK rain + holder flare ---------------- */
/* /zrain 5000 SMC — the BANK airdrops 5,000 SMC per LP Desk share holder via ZK
   compression (one compressed tx for the whole holder set). Admin-only: the bank
   funds it. Eligibility = LP Desk shares (any pool). TUNNEL excluded (Token-2022). */
async function cmdZrain(chatId: number | string, uid: string, m: any, parts: string[]) {
  const amt = parseFloat(parts[1] || '');
  const tok = (parts[2] || '').toUpperCase();
  if (!(amt > 0) || !ZRAIN_TOKENS[tok]) {
    await reply(chatId, 'On-chain rain like this: /zrain 5000 SMC — the bank ZK-airdrops 5,000 SMC to every LP Desk share holder. Tokens: SMRT SMF SMC (TUNNEL is Token-2022, compression can\'t mint it). Admin only.');
    return;
  }
  if (!(await isGroupAdmin(uid))) { await reply(chatId, '⛔ /zrain is admin-only — the bank funds it, so HQ decides when it rains.'); return; }
  if (!(await ensureWeb3())) { await reply(chatId, 'Chain libs are warming up — try /zrain again in a minute.'); return; }
  const pools = await lpdPools();
  const holderUids = new Set<string>();
  for (const k of Object.keys(pools)) {
    const sh = pools[k].shares || {};
    for (const [id, v] of Object.entries(sh)) if (Number(v) > 0) holderUids.add(String(id));
  }
  if (!holderUids.size) { await reply(chatId, 'No LP Desk share holders yet — /zrain needs holders. Pool first: /lpdesk deposit SMC 50000'); return; }
  const recipients: string[] = [];
  for (const id of holderUids) {
    try {
      const mw = await myWallet(id);
      if (mw && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mw.addr)) recipients.push(mw.addr);
    } catch { /* member's wallet pending — skip */ }
  }
  if (!recipients.length) { await reply(chatId, 'Holders found, but none have on-chain addresses yet — addresses mint when a member opens the Vault (Desk app). Have them open 🚀 Desk once, then /zrain.'); return; }
  if (recipients.length > ZRAIN_MAX_RECIPIENTS) recipients.length = ZRAIN_MAX_RECIPIENTS;
  const amountEach = Math.floor(amt * 1e6) / 1e6;
  await cmdAgentkit(chatId, uid, 'rain', { mint: ZRAIN_TOKENS[tok], tok, decimals: 9, amount_each: String(amountEach), recipients });
}

/* Holder flare — LP Desk share holders earn a reaction on their group messages.
   Identity loop for the farm: everyone sees who pools. Throttled to one flare per
   member per 15 min; pools cached 60s so the group isn't hammering the DB. */
let flarePoolsCache: { at: number; pools: any } = { at: 0, pools: {} };
const flareLast: Record<string, number> = {};
async function maybeHolderFlare(chatId: number | string, m: any, uid: string) {
  try {
    if (!uid || m.from?.is_bot) return;
    const text = String(m.text || '').trim();
    if (!text || text.startsWith('/')) return;
    if (Date.now() - (flareLast[uid] || 0) < 15 * 60e3) return;
    if (Date.now() - flarePoolsCache.at > 60e3) flarePoolsCache = { at: Date.now(), pools: await lpdPools() };
    let shares = 0;
    for (const k of Object.keys(flarePoolsCache.pools)) shares += Number((flarePoolsCache.pools[k].shares || {})[uid] || 0);
    if (!(shares > 0)) return;
    flareLast[uid] = Date.now();
    const emoji = shares >= 1000000 ? '🔥' : '💼'; // 1M+ shares = whale tier · 💼 = on the desk
    await tgApi('setMessageReaction', { chat_id: chatId, message_id: m.message_id, reaction: [{ type: 'emoji', emoji }] });
  } catch { /* flare is decorative — never block the floor */ }
}

async function cmdWatch(chatId: number | string, m: any, uid: string, parts: string[]) {
  // /watch SMRT above 0.001  (price in USD from DexScreener)
  const tok = (parts[1] || '').toUpperCase();
  const dir = (parts[2] || '').toLowerCase();
  const price = parseFloat(parts[3] || '');
  if (!await mintOf(tok) || !['above', 'below'].includes(dir) || !(price > 0)) {
    await reply(chatId, 'Watch like this: /watch SMRT above 0.001\nI check the board every cycle and ping you + the floor when it crosses. /watches lists yours, /unwatch clears them.');
    return;
  }
  const st: any = await getState('price_watches');
  const list: any[] = Array.isArray(st.list) ? st.list : [];
  const mine = list.filter(x => x.uid === uid);
  if (mine.length >= 5) { await reply(chatId, 'Max 5 watches per member — /unwatch first.'); return; }
  list.push({ uid, u: m.from?.username || '', tok, dir, price, ts: Date.now() });
  st.list = list.slice(-100);
  await setState('price_watches', st);
  await reply(chatId, `👁 Watch set: <b>${tok}</b> ${dir} <b>$${price}</b>. The desk checks every cycle (~30 min) and alerts on cross.`);
}

async function cmdWatches(chatId: number | string, uid: string) {
  const st: any = await getState('price_watches');
  const list: any[] = (Array.isArray(st.list) ? st.list : []).filter(x => x.uid === uid);
  if (!list.length) { await reply(chatId, 'No active watches. Set one: /watch SMF below 0.00001'); return; }
  await reply(chatId, '<b>YOUR WATCHES</b>\n' + list.map((x, i) => `  ${i + 1}. ${x.tok} ${x.dir} $${x.price}`).join('\n') + '\n\n/unwatch clears them all.');
}

async function cmdUnwatch(chatId: number | string, uid: string) {
  const st: any = await getState('price_watches');
  st.list = (Array.isArray(st.list) ? st.list : []).filter(x => x.uid !== uid);
  await setState('price_watches', st);
  await reply(chatId, 'Watches cleared. Set a new one anytime: /watch SMRT above 0.001');
}

async function checkWatches(gid: number | string | undefined): Promise<void> {
  const st: any = await getState('price_watches');
  const list: any[] = Array.isArray(st.list) ? st.list : [];
  if (!list.length) return;
  const remaining: any[] = [];
  for (const w of list) {
    try {
      const mint = await mintOf(w.tok);
      if (!mint) continue;
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      const d = await r.json();
      const pairs = d.pairs || [];
      if (!pairs.length) { remaining.push(w); continue; }
      const p = pairs.reduce((a: any, b: any) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
      const px = parseFloat(p.priceUsd || '0');
      const hit = w.dir === 'above' ? px >= w.price : px <= w.price;
      if (!hit) { remaining.push(w); continue; }
      if (gid) await reply(gid, `🔔 <b>WATCH HIT</b> — @${w.u || w.uid}'s call: <b>${w.tok}</b> is $${p.priceUsd} (${w.dir} $${w.price}). The floor sees you.`);
      try { await reply(w.uid, `🔔 Your watch fired: ${w.tok} ${w.dir} $${w.price} — now $${p.priceUsd}.`); } catch { /* no DM */ }
    } catch { remaining.push(w); }
  }
  if (remaining.length !== list.length) await setState('price_watches', { list: remaining.slice(-100) });
}

function refCode(uid: string): string {
  return 'SMC' + parseInt(uid, 10).toString(36).toUpperCase().slice(-5);
}

async function cmdRef(chatId: number | string, m: any, uid: string) {
  const code = refCode(uid);
  const counts: any = await getState('referral_counts');
  const joined = counts[uid] || 0;
  await reply(chatId,
    `<b>YOUR INVITE</b>\nCode: <code>${code}</code>\nLink: https://t.me/Smrtquickflips\n\n` +
    `New members bind your code once with:\n<code>/refby ${code}</code>\n` +
    `Both sides get <b>+25 Kill Points</b> on the bind. Members joined via you so far: <b>${joined}</b>\n` +
    `Ranks: 3 joins → Runner · 10 → Scout · 25 → Operator · 50 → Fixer · 100 → Canon.`);
}

async function cmdRefBy(chatId: number | string, m: any, uid: string, parts: string[]) {
  const code = (parts[1] || '').toUpperCase().trim();
  if (!/^SMC[0-9A-Z]{3,6}$/.test(code)) { await reply(chatId, 'Bind a referral like this: /refby SMC12AB — get a code from any member with /ref'); return; }
  if (refCode(uid) === code) { await reply(chatId, 'Binding your own code is a coherence violation. 🙂'); return; }
  const st: any = await getState('referrals');
  if (st[uid]) { await reply(chatId, `You're already bound to a code. The floor keeps its ledger.`); return; }
  const activity: any = await getState('floor_activity');
  const inviter = Object.keys(activity).find(id => refCode(id) === code);
  if (!inviter) { await reply(chatId, 'That code matches no member I know — check it with whoever gave it to you.'); return; }
  st[uid] = { by: inviter, code, ts: Date.now() };
  await setState('referrals', st);
  try { const rs: any = await getState('ref_sessions'); if (!rs[uid]) { rs[uid] = { by: inviter, sessions: 0, qualified: false, ts: Date.now() }; await setState('ref_sessions', rs); } } catch { /* best-effort */ }
  const counts: any = await getState('referral_counts');
  counts[inviter] = (counts[inviter] || 0) + 1;
  await setState('referral_counts', counts);
  await addPoints(uid, 25);
  await addPoints(inviter, 25);
  const n = counts[inviter];
  const rank = n >= 100 ? 'CANON' : n >= 50 ? 'FIXER' : n >= 25 ? 'OPERATOR' : n >= 10 ? 'SCOUT' : n >= 3 ? 'RUNNER' : 'PROSPECT';
  await reply(chatId, `⚡ Bound to code <b>${code}</b>. Both sides +25 Kill Points.\nYour inviter now has <b>${n}</b> join${n === 1 ? '' : 's'} (${rank}). Bring three and you make Runner.`);
}

async function getChannelId(): Promise<number | string | null> {
  const ch: any = await getState('desk_channel');
  return ch && ch.id ? ch.id : null;
}

async function postToChannel(text: string): Promise<boolean> {
  const cid = await getChannelId();
  if (!cid) return false;
  try {
    await tgApi('sendMessage', { chat_id: cid, text, parse_mode: 'HTML', disable_web_page_preview: true });
    return true;
  } catch { return false; }
}

async function buildDailyDrop(): Promise<string> {
  const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
  const inv: Record<string, string> = {};
  for (const [u, id] of Object.entries(users)) inv[id] = u;
  const kp: any = await getState('kill_points');
  const board = Object.entries(kp.pts || {}).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3)
    .map(([id, p], i) => `${i + 1}. @${inv[id] || id} — ${p}`).join(' · ') || 'board open — first blood today';
  const gateLines: string[] = [];
  for (const name of ['SMRT', 'SMF']) {
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${DESK_TOKENS[name]}`);
      const d = await r.json();
      const pairs = d.pairs || [];
      if (!pairs.length) { gateLines.push(`${name}: unlisted`); continue; }
      const p = pairs.reduce((a: any, b: any) => ((a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b));
      gateLines.push(`${name} $${p.priceUsd} · liq $${(p.liquidity?.usd || 0).toLocaleString()}`);
    } catch { gateLines.push(`${name}: n/a`); }
  }
  return `⚡ SMARTZ SYNDICATE — FLOOR DROP ⚡\n` +
    `${new Date().toISOString().slice(5, 10)} · receipts only, no promised returns\n\n` +
    `${gateLines.join('\n')}\nKill Points: ${board}\n\n` +
    `Trade the floor: /offers · Make your own token: /launch · Earn: /ref\n` +
    `Hub: ${OS_LINK} · Floor: https://t.me/Smrtquickflips`;
}

async function cmdDrop(chatId: number | string) {
  const text = await buildDailyDrop();
  const ok = await postToChannel(text);
  if (ok) {
    await reply(chatId, 'Daily drop posted to the channel. ⚡');
    await setState('channel_last_drop', { day: new Date().toISOString().slice(0, 10) });
  } else {
    await reply(chatId, 'Channel post failed — make sure the bot is an <b>admin</b> in the channel (it was added, but needs post rights). The drop text is safe to repost manually.');
  }
}

const BANK_CYCLE_MS = 30 * 60e3;
const BANK_MAX_NOTIONAL = 0.02; // SOL per take — bank stays small while it proves itself
const BANK_EDGE = 0.015;        // only trade when the offer beats Jupiter mid by 1.5%+
async function bankCycle(): Promise<void> {
  try {
    const cs: any = await getState('bank_cycle');
    const now = Date.now();
    if (cs.last && now - cs.last < BANK_CYCLE_MS) return;
    cs.last = now;
    await setState('bank_cycle', cs);
    if (await deskHalted()) return;
    if (!(await initBank()) || !(await ensureWeb3())) return;
    if (!BANK_KP.kp) BANK_KP.kp = WEB3.Keypair.fromSecretKey(new Uint8Array(BANK_KP.secret));
    const bankAddr: string = BANK_KP.kp.publicKey.toBase58();
    const offers = await getOffers();
    const group: any = await getState('desk_last_group');
    const gid = group.id as number | string | undefined;
    const acted: string[] = [];
    for (const o of offers) {
      try {
        const total = o.amt * o.price;
        if (total > BANK_MAX_NOTIONAL) continue;
        const dec = await tokenDecimals(await mintOf(o.tok));
        const qSide = o.side === 'sell'
          ? `inputMint=${await mintOf(o.tok)}&outputMint=${DESK_TOKENS.SOL}&amount=${Math.round(1 * 10 ** dec)}`
          : `inputMint=${DESK_TOKENS.SOL}&outputMint=${await mintOf(o.tok)}&amount=100000000`;
        const q: any = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?${qSide}&slippageBps=300`)).json();
        if (q.error) continue;
        const midPerToken = o.side === 'sell'
          ? parseInt(q.outAmount) / 1e9
          : 0.1 / (parseInt(q.outAmount) / 10 ** dec);
        const bankBuysToken = o.side === 'sell';
        const edgeOk = bankBuysToken ? o.price <= midPerToken * (1 - BANK_EDGE) : o.price >= midPerToken * (1 + BANK_EDGE);
        if (!edgeOk) continue;
        const makerW = await myWallet(o.by);
        if (!makerW) continue;
        const bankBals = await chainBalances(bankAddr);
        const makerBals = await chainBalances(makerW.addr);
        let sig1 = '', sig2 = '';
        if (bankBuysToken) {
          if ((bankBals.SOL || 0) < total * 1.02 || (makerBals[o.tok] || 0) < o.amt * 1.02) continue;
          sig1 = await sendSOL(BANK_KP.kp, makerW.addr, total);
          if (!(await confirmTx(sig1))) continue;
          sig2 = await sendSPL(makerW.kp, bankAddr, await mintOf(o.tok), o.amt);
          acted.push(`bought ${o.amt.toLocaleString()} ${o.tok} for ${total.toFixed(4)} SOL (offer ${o.id})`);
        } else {
          if ((bankBals[o.tok] || 0) < o.amt * 1.02 || (makerBals.SOL || 0) < total * 1.02) continue;
          sig1 = await sendSOL(makerW.kp, bankAddr, total);
          if (!(await confirmTx(sig1))) continue;
          sig2 = await sendSPL(BANK_KP.kp, makerW.addr, await mintOf(o.tok), o.amt);
          acted.push(`sold ${o.amt.toLocaleString()} ${o.tok} for ${total.toFixed(4)} SOL (offer ${o.id})`);
        }
        await chainLog({ kind: 'bank_take', offer: o.id, tok: o.tok, amt: o.amt, sol: total, sig_pay: sig1, sig_fill: sig2 });
        const st: any = await getState('p2p_offers');
        await setState('p2p_offers', { list: (Array.isArray(st.list) ? st.list : []).filter((x: P2POffer) => x.id !== o.id) });
        await addPoints(o.by, 5);
        break; // one take per cycle — the Bank is disciplined
      } catch { /* offer unparsable — try next */ }
    }
    // daily Kill Points board post (yesterday's final standings, once per day)
    const today = new Date().toISOString().slice(0, 10);
    const kp: any = await getState('kill_points');
    const lp: any = await getState('kp_last_post');
    if (gid && lp.day !== today && kp.pts && Object.keys(kp.pts).length) {
      await setState('kp_last_post', { day: today });
      const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
      const inv: Record<string, string> = {};
      for (const [u, id] of Object.entries(users)) inv[id] = u;
      const board = Object.entries(kp.pts).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5)
        .map(([id, p], i) => `  ${i + 1}. @${inv[id] || id} — ${p} pts`).join('\n');
      await reply(gid, `<b>SYNDICATE KILL POINTS — final board</b>\n${board}\n\nEarn today: tip +2 · settle offers +10 · get bank-taken +5 · desk trade +5. The floor remembers.`);
      await setState('kill_points', { day: today, pts: {} });
    }
    if (gid && acted.length) {
      const bals = await chainBalances(bankAddr);
      const invLine = Object.keys(DESK_TOKENS).map(t => `${t} ${(bals[t] || 0).toLocaleString()}`).join(' · ');
      await reply(gid, `<b>BANK CYCLE</b>\n${acted.map(a => '  • ' + a).join('\n')}\nInventory: ${invLine}`);
    }
    await awardLaunchPoints();
    /* v21: watch alerts ride the same 30-min cycle */
    await checkWatches(gid);
    /* v21: once-daily floor drop to the Syndicate channel */
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cd: any = await getState('channel_last_drop');
      if (cd.day !== today && await getChannelId()) {
        const text = await buildDailyDrop();
        if (await postToChannel(text)) await setState('channel_last_drop', { day: today });
      }
    } catch { /* channel drop is best-effort */ }
    /* v28: once-daily billboard drop to the promo channel (SMARTZcapital Market Ideas).
       Channels are broadcast-only — no commands flow from there — so the funnel is
       content + CTA on a schedule, not a reply trigger. */
    try {
      const today = new Date().toISOString().slice(0, 10);
      const pd: any = await getState('promo_last_drop');
      if (pd.day !== today) {
        const text = await buildDailyDrop();
        const ok2 = await tgApi('sendMessage', { chat_id: PROMO_CHANNEL_ID, parse_mode: 'HTML', disable_web_page_preview: true, text: text + `\n\n⚡ Full desk — launches, flips, duels, vault, the floor:\n<b>${MAIN_GROUP_LINK}</b>` }).then(() => true).catch(() => false);
        if (ok2) await setState('promo_last_drop', { day: today });
      }
    } catch { /* promo drop is best-effort */ }
  } catch { /* the cycle is best-effort — never break message handling for it */ }
}
async function cmdAgentWallet(chatId: number | string, parts: string[]) {
  const name = (parts[1] || '').replace(/^@/, '').replace(/[^\w.-]/g, '').slice(0, 24);
  if (!name) {
    await reply(chatId, "Try: /agentwallet zoran — shows the Solana wallet of that AI agent. Fund it to give the agent working capital.");
    return;
  }
  if (!(await ensureWeb3())) { await reply(chatId, 'Chain libraries warming up — try again shortly.'); return; }
  const id = 'agent:' + name.toLowerCase();
  const all = await getP2P();
  let rec = all[id];
  let minted = false;
  if (!rec) {
    const kp = WEB3.Keypair.generate();
    rec = { addr: kp.publicKey.toBase58(), key: obfKey(Array.from(kp.secretKey)), created: Date.now() };
    all[id] = rec;
    await saveP2P(all);
    minted = true;
  }
  const bals = await chainBalances(rec.addr);
  const inv = Object.keys(DESK_TOKENS).map(t => `  ${t}: ${(bals[t] || 0).toLocaleString()}`).join('\n');
  await reply(chatId,
    `<b>Agent wallet — ${name}</b>${minted ? ' (minted just now)' : ''}\n<code>${rec.addr}</code>\n\nBalances:\n${inv}\n\n` +
    `Fund this wallet to give the agent working capital. It can hold Syndicate tokens today; agent-driven trading via agent_say lands next.`);
}

/* ---------- v15: StonkFun integration — dynamic tokens + launch queue ---------- */
let EXTRA_CACHE: { t: Record<string, string>; ts: number } = { t: {}, ts: 0 };
async function extraTokens(): Promise<Record<string, string>> {
  if (Date.now() - EXTRA_CACHE.ts < 60e3) return EXTRA_CACHE.t;
  try {
    const st: any = await getState('desk_tokens');
    EXTRA_CACHE = { t: (st && typeof st.t === 'object' && st.t) || {}, ts: Date.now() };
  } catch { /* keep stale cache */ }
  return EXTRA_CACHE.t;
}
async function mintOf(tok: string): Promise<string> {
  const known = DESK_TOKENS[tok] || (await extraTokens())[tok] || '';
  if (known) return known;
  // v18: accept any raw Solana mint as a quote — validate by reading the mint account
  // (getTokenSupply is an indexed method and public RPCs gate it; layout: supply u64 @36)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tok)) {
    try {
      const info: any = await rpcCall('getAccountInfo', [tok, { encoding: 'base64' }]);
      const b64 = info?.value?.data?.[0];
      if (b64 && info.value.data[1] !== 'base58') {
        const bin = atob(b64);
        if (bin.length >= 45) {
          const dv = new DataView(new Uint8Array([...bin].map(c => c.charCodeAt(0))).buffer);
          const supply = dv.getUint32(36, true) + dv.getUint32(40, true) * 4294967296;
          if (supply > 0) return tok;
        }
      }
    } catch { /* not a mint */ }
  }
  return '';
}
const STONKFUN_COST_SOL = 0.03;  // pass-through: StonkFun/Raydium LaunchLab deployment rent
const DESK_LAUNCH_FEE_SOL = 0.05; // desk margin (owner band 0.03-0.2) — builds the bank, buys SMRT
const LAUNCH_FEE_SOL = STONKFUN_COST_SOL + DESK_LAUNCH_FEE_SOL; // 0.08 total member pays
async function getLaunches(): Promise<any[]> {
  const st: any = await getState('launch_requests');
  return Array.isArray(st.list) ? st.list : [];
}
async function cmdLaunch(chatId: number | string, uid: string, m: any, parts: string[]) {
  // /launch SYMBOL Full Token Name... [quote=SMRT|SMF|SMC|TUNNEL|SOL]
  const symbol = (parts[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let quoteTok = 'SMRT';
  const qIdx = parts.findIndex(p => p.toLowerCase().startsWith('quote='));
  if (qIdx > 0) {
    const rawQ = parts[qIdx].split('=')[1];
    // symbols are short; raw mints are 32-44 base58 chars and are case-sensitive — never uppercase a mint
    quoteTok = rawQ.length > 20 ? rawQ : rawQ.toUpperCase();
    parts.splice(qIdx, 1);
  }
  const name = parts.slice(2).join(' ').trim();
  if (!symbol || symbol.length > 10 || !name || name.length > 32) {
    await reply(chatId, 'Launch like this: /launch MOON Moon Rocket quote=SMRT\n' +
      'Pairs with ANY token — a Syndicate token (SMRT SMF SMC TUNNEL), any desk-listed token, or paste a full mint address.\n' +
      'SYMBOL ≤ 10 chars, name ≤ 32. Fee: 0.08 SOL total = 0.03 deployment (StonkFun rent) + 0.05 desk fee that builds the Syndicate bank and buys SMRT. You earn 0.5% of every trade, forever. A side LP vs SMRT is auto-queued after launch (/lp).');
    return;
  }
  const qMint = await mintOf(quoteTok);
  if (!qMint) { await reply(chatId, `I don't know a token called "${quoteTok}".\nUse a Syndicate token (SMRT SMF SMC TUNNEL), any desk-listed token, or paste the full mint address.`); return; }
  const launches = await getLaunches();
  if (launches.some(l => l.symbol === symbol && l.status !== 'failed')) {
    await reply(chatId, `${symbol} is already queued or launched. Pick another symbol.`);
    return;
  }
  // fee source: requester's own P2P wallet (auto) or Bank sponsorship (queued until funded)
  let status = 'pending_fund';
  let feeSource = 'bank';
  try {
    if (await ensureWeb3()) {
      const w = await myWallet(uid);
      if (w) {
        const bals = await chainBalances(w.addr);
        if ((bals.SOL || 0) >= LAUNCH_FEE_SOL + 0.002) { status = 'ready'; feeSource = 'member'; }
      }
    }
  } catch { /* fall back to bank queue */ }
  const id = Math.random().toString(36).slice(2, 7).toUpperCase();
  launches.push({ id, uid, symbol, name, quote: quoteTok, quoteMint: qMint, status, feeSource, created: Date.now(), by: m.from?.username || '' });
  await setState('launch_requests', { list: launches.slice(-50) });
  if (feeSource === 'member') await recordRevenue('launch_fee', 'SOL', DESK_LAUNCH_FEE_SOL, `${id} $${symbol}`);
  // v18: every launch auto-queues a SIDE LP — the new token paired vs SMRT on Raydium CPMM
  const lpQ: any = await getState('lp_requests');
  const lpList: any[] = Array.isArray(lpQ.list) ? lpQ.list : [];
  lpList.push({ id: 'LP' + id, launchId: id, symbol, pair: 'SMRT', status: 'await_launch', created: Date.now() });
  await setState('lp_requests', { list: lpList.slice(-50) });
  const who = m.from?.username ? '@' + m.from.username : uid;
  const extra = status === 'ready'
    ? `Fee source: <b>your wallet</b> (${LAUNCH_FEE_SOL} SOL = ${STONKFUN_COST_SOL} deployment + ${DESK_LAUNCH_FEE_SOL} desk fee → bank → SMRT buys). Processing on the next launcher run.`
    : `Queued for <b>Bank sponsorship</b> — it processes when the bank has ${LAUNCH_FEE_SOL} SOL budgeted for launches (incl. the desk fee, which recycles into SMRT accumulation).`;
  await reply(chatId,
    `<b>LAUNCH QUEUED — ${id}</b>\n${name} ($${symbol})\nQuote token: <b>${quoteTok}</b> (trades against ${quoteTok} on StonkFun)\nStatus: ${status}\n${extra}\n\n` +
    `Creator earns 0.5% of every trade, forever. +25 Kill Points on launch.`);
  const group: any = await getState('desk_last_group');
  if (group.id) {
    try {
      await reply(group.id, `📣 ${who} queued a launch: <b>${name}</b> ($${symbol}) paired with <b>${quoteTok}</b> [${id}]\n` +
        `On StonkFun it trades against ${quoteTok} — and a side LP vs SMRT is auto-queued for when it goes live. ${OS_LINK}`);
    } catch { /* group post best-effort */ }
  }
  await chainLog({ kind: 'launch_queued', id, uid, symbol, name, quote: quoteTok, status });
}
async function awardLaunchPoints(): Promise<void> {
  try {
    const st: any = await getState('launch_results');
    const list: any[] = Array.isArray(st.list) ? st.list : [];
    let changed = false;
    for (const r of list) {
      if (r.awarded) continue;
      r.awarded = true; changed = true;
      await addPoints(r.uid, 25);
      await registerExtraToken(r.symbol, r.mint);
      const group: any = await getState('desk_last_group');
      if (group.id && r.mint) {
        try {
          await reply(group.id, `🚀 <b>$${r.symbol} IS LIVE</b> — ${r.name}\nMint: <code>${r.mint}</code>\nPair: ${r.quote} (StonkFun / Raydium LaunchLab)\nSide LP: queued vs SMRT on Raydium CPMM — /lp for status\nTrade: https://www.stonkfun.xyz/\n+25 Kill Points to the launcher.`);
        } catch { /* best-effort */ }
      }
    }
    if (changed) await setState('launch_results', { list });
  } catch { /* best-effort */ }
}
async function registerExtraToken(symbol: string, mint: string): Promise<void> {
  try {
    const st: any = await getState('desk_tokens');
    const t: Record<string, string> = (st && typeof st.t === 'object' && st.t) || {};
    t[symbol.toUpperCase()] = mint;
    await setState('desk_tokens', { t });
    EXTRA_CACHE = { t, ts: Date.now() };
  } catch { /* best-effort */ }
}

/* ---------- v29: paid promotion — pay in-house, promote on the billboard ---------- */
/* v30: $-anchored promo prices (targets: ~$0.10 entry / ~$0.50 featured).
   Token amounts derived from live DexScreener USD prices Sep 13: SMRT $4.845e-7,
   TUNNEL $5.161e-6, SMF $9.44e-9, SMC $1.146e-8. Re-derive when prices 2x. */
const PROMO_PRICE: Record<string, number> = { SMRT: 180_000, TUNNEL: 20_000, SMF: 12_000_000, SMC: 10_000_000 }; // SMRT gets 10% loyalty discount
async function cmdPromo(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  const text = parts.slice(1).join(' ').trim();
  if (!text) {
    await reply(chatId, `Promote on the SMARTZcapital billboard channel:\n/promo SMRT Your message here\n\nPrice (~$0.10 USD equivalent, from your desk balance):\n• 180,000 SMRT (10% loyalty discount) · 20,000 TUNNEL · 12,000,000 SMF · 10,000,000 SMC\nOne message, posted as marked sponsored content. Fees split: 75% bank SOL · 15% desk LP · 10% burned. Keep it real — scams get refunded-and-banned.`);
    return;
  }
  const tok = (parts[1] || 'SMRT').toUpperCase();
  const price = PROMO_PRICE[tok];
  const body = parts.slice(2).join(' ').trim();
  if (!price || !body) { await reply(chatId, 'Usage: /promo SMRT Your message\nTokens: SMRT · TUNNEL · SMF · SMC. /balance to check funds.'); return; }
  if (body.length > 300) { await reply(chatId, 'Keep promos under 300 characters — the scroll is sacred.'); return; }
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if ((me.balances[tok] || 0) < price) {
    await reply(chatId, `Insufficient ${tok} — need ${price.toLocaleString()} (you have ${(me.balances[tok] || 0).toLocaleString()}). Fund your /wallet or desk balance, then retry.`);
    return;
  }
  me.balances[tok] = (me.balances[tok] || 0) - price;
  await saveWallets(w);
  await recordRevenue('promo_fee', tok, price, `${uid} ${body.slice(0, 40)}`);
  const who = m.from?.username ? '@' + m.from.username : 'a member';
  await tgApi('sendMessage', {
    chat_id: PROMO_CHANNEL_ID, parse_mode: 'HTML', disable_web_page_preview: false,
    text: `📣 <b>PROMOTED</b> — paid ${price.toLocaleString()} ${tok}\n\n${body.replace(/[<>]/g, '')}\n\n<i>— ${who} via the SMARTZ desk</i>`,
  }).catch(() => false);
  await reply(chatId, `✅ LIVE on the billboard. Paid ${price.toLocaleString()} ${tok}. Main floor: ${MAIN_GROUP_LINK}`);
}

/* ---------- v32+35 "Ad Marketplace": self-serve member ads, per-click billing — DM ONLY ---------- */
/* Honest note: Telegram's native sponsored ads pay the channel owner on views and expose NO
   per-member click data — so rewards can only be paid on campaigns WE can verify. Sponsors fund
   a budget in-house and set a per-click price (pcc); every verified claim charges pcc from the
   budget: 75% to the clicker, 25% desk margin. Unused budget refunds on stop/expiry. */
const MAIN_GROUP_ID = -1002901930616; // SMARTZ Syndicate HQ — membership required to claim
const AD_MEMBER_SHARE = 0.75;         // clicker keeps 75%; 25% is desk margin (recorded ad_revenue)
const AD_DAILY_CLAIM_CAP = 5;         // anti-farm: max claims per member per day
const AD_DEFAULT_CLAIMS = 10;         // default: budget funds this many clicks (pcc = budget/10)
async function genAdCode(): Promise<string> {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += abc[Math.floor(Math.random() * abc.length)];
  return code;
}
async function memberInMainGroup(uid: string): Promise<boolean> {
  try {
    const r: any = await tgApi('getChatMember', { chat_id: MAIN_GROUP_ID, user_id: Number(uid) });
    const s = r?.result?.status;
    return s === 'member' || s === 'administrator' || s === 'creator';
  } catch { return false; }
}
/* v51: /zrain gating — admin or creator of the main group */
async function isGroupAdmin(uid: string): Promise<boolean> {
  try {
    const r: any = await tgApi('getChatMember', { chat_id: MAIN_GROUP_ID, user_id: Number(uid) });
    const s = r?.result?.status;
    return s === 'administrator' || s === 'creator';
  } catch { return false; }
}
async function refundCampaign(w: any, camps: any[], c: any): Promise<number> {
  /* close a campaign and return its unspent budget to the sponsor */
  c.active = false;
  const left = c.budget_left || 0;
  if (left > 0) {
    const sp = walletOf(w, c.sponsor_uid);
    sp.balances[c.tok] = (sp.balances[c.tok] || 0) + left;
    c.budget_left = 0;
  }
  return left;
}
async function cmdAds(chatId: number | string, m: any): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Ad rewards are DM-only — message me directly and send /ads to see what pays right now.'); return; }
  const st: any = await getState('ad_campaigns');
  const camps: any[] = (Array.isArray(st.items) ? st.items : []).filter((c: any) => c.active && c.budget_left >= (c.pcc || c.reward));
  if (!camps.length) { await reply(chatId, 'No paying ads right now. New drops land on the SMARTZcapital channel — check back soon, or fund one yourself: /adsponsor'); return; }
  const lines = camps.map((c: any) => {
    const pcc = c.pcc || c.reward;
    const perClick = Math.floor(pcc * AD_MEMBER_SHARE);
    return `• <code>${c.code}</code>${c.link ? ' 🔗' : ''} — ${perClick.toLocaleString()} ${c.tok} per verified click · ${Math.floor(c.budget_left / pcc)} clicks left`;
  }).join('\n');
  await reply(chatId, `💰 <b>PAID ADS — verified clicks pay</b>\nWatch the SMARTZcapital channel, then claim here in DM:\n/ad CODE\n\n${lines}\n\n75% of each click to you · 25% builds the desk bank · one click per ad · ${AD_DAILY_CLAIM_CAP}/day cap.\nRun your own: /adsponsor TOKEN BUDGET pcc=N | text · track it: /adstats`);
}
async function cmdAd(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Claims are DM-only (keeps the floor clean). Message me directly with your code.'); return; }
  const code = (parts[1] || '').toUpperCase().trim();
  if (!code) { await reply(chatId, 'Usage: /ad CODE — the code is printed under the sponsored post in the SMARTZcapital channel.'); return; }
  const st: any = await getState('ad_campaigns');
  const camps: any[] = Array.isArray(st.items) ? st.items : [];
  const c = camps.find((x: any) => x.code === code);
  if (!c || !c.active) { await reply(chatId, 'Unknown or expired code. /ads lists what pays right now.'); return; }
  if (c.sponsor_uid === uid) { await reply(chatId, 'Sponsors can\'t click their own campaign.'); return; }
  const w = await loadWallets();
  const pcc = c.pcc || c.reward;
  if (c.budget_left < pcc) {
    const back = await refundCampaign(w, camps, c);
    await saveWallets(w);
    await setState('ad_campaigns', { items: camps });
    await reply(chatId, `That campaign just ran dry${back ? ` — ${back.toLocaleString()} ${c.tok} unspent returned to its sponsor` : ''}. /ads for the next one.`);
    return;
  }
  if ((c.claims || []).includes(uid)) { await reply(chatId, 'Already clicked this one. New ads drop regularly — watch the channel.'); return; }
  const day = new Date().toISOString().slice(0, 10);
  const myClaims: any[] = camps.flatMap((x: any) => (x.claims_log || []).filter((l: any) => l.uid === uid && l.day === day));
  if (myClaims.length >= AD_DAILY_CLAIM_CAP) { await reply(chatId, `Daily cap reached (${AD_DAILY_CLAIM_CAP}). Fresh claims open tomorrow.`); return; }
  if (!(await memberInMainGroup(uid))) { await reply(chatId, `Verified clicks are for Syndicate members. Join the floor first: ${MAIN_GROUP_LINK}`); return; }
  /* charge per click: 75% to clicker, 25% desk margin */
  const pay = Math.floor(pcc * AD_MEMBER_SHARE);
  const me = walletOf(w, uid);
  me.balances[c.tok] = (me.balances[c.tok] || 0) + pay;
  c.budget_left -= pcc;
  c.clicks = (c.clicks || 0) + 1;
  c.claims = [...(c.claims || []), uid];
  c.claims_log = [...(c.claims_log || []), { uid, day, ts: Date.now(), pay }];
  if (c.budget_left < pcc) await refundCampaign(w, camps, c);
  await saveWallets(w);
  await setState('ad_campaigns', { items: camps });
  await recordRevenue('ad_revenue', c.tok, pcc - pay, `${code} click by ${uid}`);
  await reply(chatId, `✅ Click verified — <b>+${pay.toLocaleString()} ${c.tok}</b> to your desk balance.\n${c.active ? `This campaign has ${Math.floor(c.budget_left / pcc)} clicks left. /ads for more.` : 'That was the last click on this campaign — nice timing.'}\n/balance to see funds · /ads for the next drop.`);
}
async function cmdAdstop(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Campaign management is DM-only. Message me directly.'); return; }
  const code = (parts[1] || '').toUpperCase().trim();
  if (!code) { await reply(chatId, 'Usage: /adstop CODE — stops your campaign and refunds unspent budget.'); return; }
  const st: any = await getState('ad_campaigns');
  const camps: any[] = Array.isArray(st.items) ? st.items : [];
  const c = camps.find((x: any) => x.code === code);
  if (!c) { await reply(chatId, 'Unknown code.'); return; }
  if (c.sponsor_uid !== uid) { await reply(chatId, 'Only the sponsor can stop that campaign.'); return; }
  const w = await loadWallets();
  const back = await refundCampaign(w, camps, c);
  await saveWallets(w);
  await setState('ad_campaigns', { items: camps });
  await reply(chatId, `🛑 Campaign <code>${code}</code> stopped. ${back ? `${back.toLocaleString()} ${c.tok} refunded — ` : ''}final tally: ${c.clicks || 0} verified clicks, ${((c.budget_total - (c.budget_left || 0) - back)).toLocaleString()} ${c.tok} spent. /adstats for your history.`);
}
async function cmdAdstats(chatId: number | string, uid: string, m: any): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Stats are DM-only. Message me directly.'); return; }
  const st: any = await getState('ad_campaigns');
  const camps: any[] = Array.isArray(st.items) ? st.items : [];
  const mine = camps.filter((c: any) => c.sponsor_uid === uid).slice(-5).reverse();
  const econ = camps.reduce((a: any, c: any) => {
    a.clicks += c.clicks || 0;
    a.spent += (c.budget_total || 0) - (c.budget_left || 0);
    return a;
  }, { clicks: 0, spent: 0 });
  const myLines = mine.length
    ? mine.map((c: any) => `• <code>${c.code}</code>${c.link ? ' 🔗' : ''} ${c.active ? '🟢 LIVE' : '⚫ ended'} — ${c.clicks || 0} clicks · ${(c.budget_total - c.budget_left).toLocaleString()}/${c.budget_total.toLocaleString()} ${c.tok} spent`).join('\n')
    : 'No campaigns yet. /adsponsor TOKEN BUDGET [pcc=N] [link=URL] | your text — pays clickers 75% per verified click, links become buttons.';
  await reply(chatId, `📊 <b>AD DESK STATS</b>\n<b>Yours:</b>\n${myLines}\n\n<b>Whole board (all-time):</b>\n${econ.clicks} verified clicks · ${econ.spent.toLocaleString()} tokens spent by sponsors\n\nEvery click: 75% clicker · 25% desk margin → bank/LP/burn. /ads to earn from open campaigns.`);
}
/* ---------- v36 "Rich Ads": member campaigns carry a link + structured info ----------
   link=URL arg (or auto-detect first http(s) URL in the text) → clickable link + inline button
   on the channel post. Multi-line bodies render first line as a bold headline. Campaigns
   store their text/link/post_id so sponsors can edit a live ad (/adedit). */
const AD_MAX_BODY = 300;
function sanitizeLink(raw: string): string {
  const u = (raw || '').trim().slice(0, 300);
  if (!/^https?:\/\/[^\s"<>'\\]+$/i.test(u)) return '';
  if (/^https?:\/\/(localhost|127\.|0\.|192\.168\.|10\.)/i.test(u)) return '';
  return u;
}
function linkDisplay(u: string): string {
  try {
    const p = new URL(u);
    const path = (p.pathname + p.search).replace(/\/+$/, '');
    const full = (p.host + (path && path !== '/' ? path : '')).replace(/[<>]/g, '');
    return full.length > 60 ? full.slice(0, 57) + '…' : full;
  } catch { return u.replace(/[<>]/g, '').slice(0, 60); }
}
function extractLink(head: string[], body: string): { link: string } {
  const arg = head.find((h: string) => /^link=\S+$/i.test(h));
  let link = arg ? sanitizeLink(arg.slice(5)) : '';
  if (!link) {
    const mm = body.match(/https?:\/\/[^\s<>"']+/i);
    if (mm) link = sanitizeLink(mm[0]);
  }
  return { link };
}
function renderAdPost(c: any): string {
  const pcc = c.pcc || c.reward;
  const perClick = Math.floor(pcc * AD_MEMBER_SHARE);
  const text = (c.text || '').replace(/[<>]/g, '');
  const nl = text.indexOf('\n');
  const headline = nl > 0 ? text.slice(0, nl).trim() : '';
  const rest = nl > 0 ? text.slice(nl + 1).trim() : text;
  return `📣 <b>SPONSORED — ${perClick.toLocaleString()} ${c.tok} per verified click</b>\n\n` +
    (headline ? `<b>${headline}</b>\n` : '') +
    `${rest}\n` +
    (c.link ? `\n🔗 <a href="${c.link}">${linkDisplay(c.link)}</a>\n` : '') +
    `\n💰 Verify in DM to earn: <code>/ad ${c.code}</code>\n<i>— ${c.sponsor} via the SMARTZ desk · engagement pays, scams get banned</i>`;
}
async function cmdAdsponsor(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Campaign setup is DM-only. Message me directly.'); return; }
  /* v36: /adsponsor SMF 5000000 pcc=50000 link=https://yoursite.xyz | Headline here
     More info — multi-line ok. link= optional: the desk auto-detects the first
     http(s) link in your text if you don't pass it. */
  const raw = dtextOf(m).replace(/^\/\S+\s*/, '');
  const sep = raw.indexOf('|');
  if (sep < 0) {
    await reply(chatId, 'Usage: /adsponsor TOKEN TOTAL_BUDGET [pcc=N] [link=URL] | your ad text\nExample:\n/adsponsor SMF 5000000 pcc=50000 link=https://t.me/yourgroup | New pool is live\nCheck the chart, DYOR — early is an attitude.\n\npcc = price per verified click (default = budget/10). Each click pays the member 75% of pcc; 25% is desk margin. The first line of your text becomes a bold headline; links become a clickable button. Unspent budget refunds on /adstop or when it runs dry. Edit anytime: /adedit CODE | new text.');
    return;
  }
  const head = raw.slice(0, sep).trim().split(/\s+/);
  const body = raw.slice(sep + 1).trim();
  const tok = (head[0] || '').toUpperCase();
  const budget = Math.floor(Number(head[1] || '0'));
  const pccArg = head.find((h: string) => /^pcc=\d+$/i.test(h));
  const pcc = pccArg ? Math.max(1, Math.floor(Number(pccArg.split('=')[1]))) : Math.max(1, Math.floor(budget / AD_DEFAULT_CLAIMS));
  const { link } = extractLink(head, body);
  if (pcc > budget) { await reply(chatId, `Per-click price (${pcc.toLocaleString()}) can't exceed the budget (${budget.toLocaleString()}).`); return; }
  if (!DESK_TOKENS[tok] || !(budget > 0)) { await reply(chatId, 'Need a token (' + Object.keys(DESK_TOKENS).join('/') + ') and a numeric budget. /balance to check funds.'); return; }
  if (tok === 'SOL') { await reply(chatId, 'Ad budgets are token-denominated (SMRT/TUNNEL/SMF/SMC) — rewards land in member balances as tokens.'); return; }
  if (!body || body.length > AD_MAX_BODY) { await reply(chatId, `Ad text required, max ${AD_MAX_BODY} characters (first line = headline, links auto-detected).`); return; }
  if (head.some((h: string) => /^link=/i.test(h)) && !link) { await reply(chatId, 'That link= value doesn\'t look like a valid http(s) URL — check it and retry.'); return; }
  const w = await loadWallets();
  const me = walletOf(w, uid);
  if ((me.balances[tok] || 0) < budget) { await reply(chatId, `Insufficient ${tok} — need ${budget.toLocaleString()} (you have ${(me.balances[tok] || 0).toLocaleString()}). Fund via /deposit or earn with /ads.`); return; }
  me.balances[tok] = (me.balances[tok] || 0) - budget;
  await saveWallets(w);
  const code = await genAdCode();
  const st: any = await getState('ad_campaigns');
  const camps: any[] = Array.isArray(st.items) ? st.items : [];
  const who = m.from?.username ? '@' + m.from.username : 'a member';
  const campaign: any = { code, sponsor_uid: uid, sponsor: who, tok, budget_total: budget, budget_left: budget, pcc, reward: pcc, clicks: 0, claims: [], claims_log: [], active: true, ts: Date.now(), text: body, link: link || '' };
  camps.push(campaign);
  await setState('ad_campaigns', { items: camps.slice(-100) });
  /* v36: clickable link + inline button on the channel post; remember post_id for /adedit */
  const postRes: any = await tgApi('sendMessage', {
    chat_id: PROMO_CHANNEL_ID, parse_mode: 'HTML', disable_web_page_preview: !link,
    reply_markup: link ? { inline_keyboard: [[{ text: 'Open Link ↗', url: link }]] } : undefined,
    text: renderAdPost(campaign),
  }).catch(() => false);
  const postId = postRes?.result?.message_id || 0;
  if (postId) {
    campaign.post_id = postId;
    await setState('ad_campaigns', { items: camps.slice(-100) });
  }
  const perClick = Math.floor(pcc * AD_MEMBER_SHARE);
  await reply(chatId, `✅ Campaign <code>${code}</code> LIVE on the SMARTZcapital channel${link ? ' with link button' : ''}.\nBudget: ${budget.toLocaleString()} ${tok} · price per verified click: ${pcc.toLocaleString()} (${perClick.toLocaleString()} to the clicker, ${(pcc - perClick).toLocaleString()} desk margin) · up to ${Math.floor(budget / pcc)} clicks.\nUnspent budget refunds on /adstop ${code} or auto-refund when it runs dry. Edit text/link: /adedit ${code} | new text · Track: /adstats`);
}
async function cmdAdedit(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Campaign edits are DM-only. Message me directly.'); return; }
  /* /adedit CODE [link=URL] | new ad text — updates a live campaign AND its channel post.
     Budget/price stay as funded; only text + link change. */
  const raw = dtextOf(m).replace(/^\/\S+\s*/, '');
  const sep = raw.indexOf('|');
  const head = (sep < 0 ? raw : raw.slice(0, sep)).trim().split(/\s+/);
  const code = (head[0] || '').toUpperCase();
  if (!code || sep < 0) { await reply(chatId, 'Usage: /adedit CODE [link=URL] | new ad text\nExample: /adedit X7K2M4 link=https://t.me/newroom | New headline\nFresh info — same great pool.\n\nUpdates your live campaign and edits the channel post. Budget and per-click price stay as funded.'); return; }
  const body = raw.slice(sep + 1).trim();
  if (!body || body.length > AD_MAX_BODY) { await reply(chatId, `New ad text required, max ${AD_MAX_BODY} characters.`); return; }
  const st: any = await getState('ad_campaigns');
  const camps: any[] = Array.isArray(st.items) ? st.items : [];
  const c = camps.find((x: any) => x.code === code);
  if (!c) { await reply(chatId, 'Unknown code. /adstats lists your campaigns.'); return; }
  if (c.sponsor_uid !== uid) { await reply(chatId, 'Only the sponsor can edit that campaign.'); return; }
  if (!c.active) { await reply(chatId, 'That campaign has ended — fund a fresh one with /adsponsor.'); return; }
  const { link } = extractLink(head, body);
  if (head.some((h: string) => /^link=/i.test(h)) && !link) { await reply(chatId, 'That link= value doesn\'t look like a valid http(s) URL — check it and retry.'); return; }
  c.text = body;
  if (link) c.link = link;
  await setState('ad_campaigns', { items: camps });
  let edited = false;
  if (c.post_id) {
    const r: any = await tgApi('editMessageText', {
      chat_id: PROMO_CHANNEL_ID, message_id: c.post_id, parse_mode: 'HTML',
      disable_web_page_preview: !c.link,
      reply_markup: c.link ? { inline_keyboard: [[{ text: 'Open Link ↗', url: c.link }]] } : undefined,
      text: renderAdPost(c),
    }).catch(() => false);
    edited = !!(r && r.ok);
  }
  await reply(chatId, `✏️ Campaign <code>${code}</code> updated.${edited ? ' Channel post edited.' : c.post_id ? ' (Channel post edit failed — bot may have lost post rights; new text applies to future views either way.)' : ''}\n${c.link ? `Link: ${linkDisplay(c.link)}\n` : ''}Track: /adstats`);
}
function dtextOf(m: any): string { return (m.text || '').trim(); }

/* ---------- v33 "Scout Visits": members earn SMC for checking 3rd-party sponsor ads — DM ONLY ----------
   The provider pays per click but exposes no per-user data, so proof-of-visit is honor-based —
   kept honest by economics (dust rewards) and gates: HQ membership + real floor activity within
   48h to claim. Streaks + leaderboard make it a game; the activity gate is the real loop:
   to keep earning, members must keep talking on the floor. Rewards debit the TREASURY wallet,
   which is funded by the ad-revenue share + desk margin. */
const TREASURY_UID = 'TREASURY';
const VISIT_REWARD = 25_000;          // SMC per verified visit (dust — the game is streaks/points)
const VISIT_DAILY_CAP = 10;           // claims per member per day across all spots
const VISIT_ACTIVITY_GATE_H = 48;     // must have spoken on the floor within 48h to claim
const VISIT_STREAK_MAX_MULT = 2;      // streak multiplier caps at 2x
function dayStr(ts?: number): string { return new Date(ts || Date.now()).toISOString().slice(0, 10); }
function visitStreak(uid: string, claims: any[]): { streak: number; mult: number } {
  const days = new Set(claims.filter((c: any) => c.uid === uid).map((c: any) => c.day));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayStr(cursor.getTime()))) cursor.setUTCDate(cursor.getUTCDate() - 1); // yesterday counts as in-streak
  while (days.has(dayStr(cursor.getTime()))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return { streak, mult: Math.min(VISIT_STREAK_MAX_MULT, 1 + 0.1 * Math.min(streak, 10)) };
}
async function cmdVisit(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Visit rewards are DM-only — message me directly. Check the sponsors, then claim.'); return; }
  const st: any = await getState('ad_spots');
  const spots: any[] = (Array.isArray(st.spots) ? st.spots : []).filter((s: any) => s.active);
  const log: any = await getState('visit_log');
  const claims: any[] = Array.isArray(log.claims) ? log.claims : [];
  const { streak, mult } = visitStreak(uid, claims);
  const id = (parts[1] || '').toUpperCase().trim();
  if (!id) {
    const lines = spots.map((s: any) => `• <code>${s.id}</code> — ${s.note || s.link}`).join('\n') || 'No sponsor spots open right now.';
    const myPoints = claims.filter((c: any) => c.uid === uid).length;
    await reply(chatId, `🕵️ <b>SCOUT DESK — check the sponsors, get paid</b>\n${lines}\n\n<b>Two ways to claim:</b>\n1️⃣ Public take (2x pay) — reply to today's sponsor thread in the HQ group with your honest one-liner about the ad. The desk verifies it automatically.\n2️⃣ Quiet check (1x pay) — check one out, then send here:\n/visit ID\n\nReward: ${VISIT_REWARD.toLocaleString()} SMC × streak (yours: ${mult.toFixed(1)}x, ${streak}-day streak)\nYour lifetime visits: ${myPoints}\n/scouts for the weekly board.`);
    return;
  }
  const spot = spots.find((s: any) => s.id === id);
  if (!spot) { await reply(chatId, 'Unknown spot id. /visit with no arguments lists what\'s open.'); return; }
  const today = dayStr();
  if (claims.some((c: any) => c.uid === uid && c.spot === id && c.day === today)) { await reply(chatId, 'Already logged this one today. New spots drop regularly — /visit to see what\'s open.'); return; }
  const todayClaims = claims.filter((c: any) => c.uid === uid && c.day === today).length;
  if (todayClaims >= VISIT_DAILY_CAP) { await reply(chatId, `Daily cap (${VISIT_DAILY_CAP}) reached. Back tomorrow — streak preserved.`); return; }
  if (!(await memberInMainGroup(uid))) { await reply(chatId, `Scout rewards are for Syndicate members. Join the floor: ${MAIN_GROUP_LINK}`); return; }
  const act: any = await getState('floor_activity');
  const lastT = (act[uid] || {}).t || 0;
  if (Date.now() - lastT > VISIT_ACTIVITY_GATE_H * 3600e3) {
    await reply(chatId, `Scouts stay in the conversation — say something on the floor (any message in the last ${VISIT_ACTIVITY_GATE_H}h) and your claim pays. The ads fund the group, the group funds you.`);
    return;
  }
  const w = await loadWallets();
  const treasury = walletOf(w, TREASURY_UID);
  const pay = Math.floor(VISIT_REWARD * mult);
  if ((treasury.balances.SMC || 0) < pay) { await reply(chatId, 'Reward pool is refilling — try again shortly. (Treasury SMC dry.)'); return; }
  treasury.balances.SMC -= pay;
  const me = walletOf(w, uid);
  me.balances.SMC = (me.balances.SMC || 0) + pay;
  await saveWallets(w);
  claims.push({ uid, spot: id, day: today, ts: Date.now(), pay });
  await setState('visit_log', { claims: claims.slice(-1500) });
  const { streak: newStreak, mult: newMult } = visitStreak(uid, claims);
  await reply(chatId, `✅ Visit logged — <b>+${pay.toLocaleString()} SMC</b>${mult > 1 ? ` (${mult.toFixed(1)}x streak)` : ''}\nStreak: ${newStreak} day${newStreak === 1 ? '' : 's'} → next visit pays ${newMult.toFixed(1)}x.\nKeep talking on the floor to stay eligible. /scouts for the board.`);
}
async function cmdScouts(chatId: number | string): Promise<void> {
  const log: any = await getState('visit_log');
  const claims: any[] = Array.isArray(log.claims) ? log.claims : [];
  const cutoff = Date.now() - 7 * 24 * 3600e3;
  const byUid: Record<string, number> = {};
  for (const c of claims) if (c.ts > cutoff) byUid[c.uid] = (byUid[c.uid] || 0) + 1;
  const top = Object.entries(byUid).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
  const lines = top.map(([u, n], i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${users[u] ? '@' + users[u] : 'agent ' + String(u).slice(0, 6)} — ${n} visits`).join('\n');
  await reply(chatId, `🕵️ <b>SCOUT BOARD — rolling 7 days</b>\n${lines || 'No visits yet this week. First scout sets the bar: check the sponsor posts in the channel, then /visit ID in DM.'}\n\nTop scout this week gets an SMF bonus from the desk. ${MAIN_GROUP_LINK}`);
}
/* ---------- v34: comment-verified visits — reply to the sponsor thread, get paid 2x ---------- */
const VISIT_COMMENT_MULT = 2; // a public, substantive take on the ad pays double the DM honor claim
const VISIT_COMMENT_MIN_LEN = 12;
async function maybeVisitComment(chatId: number | string, uid: string, m: any): Promise<void> {
  const th: any = await getState('sponsor_thread');
  if (!th.msg_id || m.reply_to_message.message_id !== th.msg_id) return;
  if (!th.spot) return;
  const text = (m.text || '').trim();
  if (text.length < VISIT_COMMENT_MIN_LEN) return; // too thin to count as a take
  if (/^(ok|okay|done|nice|cool|\+1|lol|lfg|checking|check)\b/i.test(text) && text.length < 20) return; // low-effort brush-off
  const log: any = await getState('visit_log');
  const claims: any[] = Array.isArray(log.claims) ? log.claims : [];
  const today = dayStr();
  const spot = String(th.spot).toUpperCase();
  if (claims.some((c: any) => c.uid === uid && c.spot === spot && c.day === today)) return; // one per spot per day
  if (claims.filter((c: any) => c.uid === uid && c.day === today).length >= VISIT_DAILY_CAP) return;
  const w = await loadWallets();
  const treasury = walletOf(w, TREASURY_UID);
  const { streak, mult } = visitStreak(uid, claims);
  const pay = Math.floor(VISIT_REWARD * mult * VISIT_COMMENT_MULT);
  if ((treasury.balances.SMC || 0) < pay) return; // pool dry — stay silent, no false promise
  treasury.balances.SMC -= pay;
  const me = walletOf(w, uid);
  me.balances.SMC = (me.balances.SMC || 0) + pay;
  await saveWallets(w);
  claims.push({ uid, spot, day: today, ts: Date.now(), pay, proof: 'comment', msg: m.message_id });
  await setState('visit_log', { claims: claims.slice(-1500) });
  const uname = m.from?.username ? '@' + m.from.username : 'scout';
  await reply(chatId, `🕵️ <b>Verified scout visit</b> — ${uname} actually read the sponsor and said so in public. +${pay.toLocaleString()} SMC (${mult.toFixed(1)}x streak ×2 proof bonus).\nYour turn: check the sponsor posts in the channel, drop your take here or DM me <code>/visit ${spot}</code>. Ads fund the floor; the floor gets paid.`);
}

/* ---------- v42 "Daily Engine" — the habit loop, Syndicate style: 24h check-in
   streaks to 3x, tiered referral EARN boosts (+7% per qualified ref, max +35%),
   rewarded-ad dust credits, a 30-day Vesting Chest, and dynamic halving as the
   Syndicate scales. Rewards are SMC dust debited from TREASURY (funded by ad
   revenue + desk margin). Referral qualification: a bound invitee checks in 3x. ---------- */
const CK_BASE = 10_000;            // SMC dust per check-in before multipliers
const CK_COOLDOWN_H = 20;          // habit timer (4h wobble tolerance inside the 24h day)
const CK_RESET_H = 36;             // silence longer than this kills the streak
const CK_MAX_STREAK_MULT = 3;      // streak multiplier cap
const ADW_REWARD = 15_000;         // SMC dust per rewarded ad
const ADW_DAILY_CAP = 5;
const ADW_COOLDOWN_S = 45;
const ADW_ACTIVITY_H = 48;         // same floor-activity gate as scout visits
const REF_QUAL_SESSIONS = 3;       // invited member must check in 3x to qualify
const REF_BOOST_PER = 0.07;        // +7% earnings per qualified ref
const REF_BOOST_MAX = 5;           // cap: +35%
const REF_QUAL_BONUS = 100_000;    // one-time SMC to the referrer on qualification
const CHEST_STREAK = 30;           // milestone
const CHEST_BONUS = 250_000;

async function ckLog(): Promise<any[]> { const s: any = await getState('checkin_log'); return Array.isArray(s.claims) ? s.claims : []; }
async function adwLog(): Promise<any[]> { const s: any = await getState('adwatch_log'); return Array.isArray(s.claims) ? s.claims : []; }
function lastByUid(claims: any[], uid: string): any { let last: any = null; for (const c of claims) if (c.uid === uid && (!last || c.ts > last.ts)) last = c; return last; }
function ckStreakOf(claims: any[], uid: string): { streak: number; lastTs: number } {
  const days = new Set(claims.filter((c: any) => c.uid === uid).map((c: any) => c.day));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayStr(cursor.getTime()))) cursor.setUTCDate(cursor.getUTCDate() - 1); // yesterday still counts
  while (days.has(dayStr(cursor.getTime()))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return { streak, lastTs: (lastByUid(claims, uid) || {}).ts || 0 };
}
async function ckHalving(): Promise<number> {
  const meta: any = await getState('checkin_meta');
  const tier = Number(meta.halving_tier || 0);
  return tier >= 2 ? 0.25 : tier === 1 ? 0.5 : 1;
}
async function ckMaybeRatchetHalving(): Promise<void> {
  const claims = await ckLog();
  const cutoff = Date.now() - 30 * 864e5;
  const n = new Set(claims.filter((c: any) => c.ts > cutoff).map((c: any) => c.uid)).size;
  const meta: any = await getState('checkin_meta');
  const tier = Number(meta.halving_tier || 0);
  const want = n >= 200 ? 2 : n >= 50 ? 1 : 0;
  if (want > tier) { meta.halving_tier = want; meta.halved_at = Date.now(); meta.participants = n; await setState('checkin_meta', meta); }
}
async function qualifiedRefCount(uid: string): Promise<number> {
  const rs: any = await getState('ref_sessions');
  let n = 0;
  for (const k of Object.keys(rs)) if (rs[k] && rs[k].by === uid && rs[k].qualified) n++;
  return n;
}
async function earnMult(uid: string, streak: number): Promise<{ mult: number; streakMult: number; boostPct: number; q: number }> {
  const q = await qualifiedRefCount(uid);
  const streakMult = Math.min(CK_MAX_STREAK_MULT, 1 + 0.1 * Math.min(streak, 20));
  const boostPct = REF_BOOST_PER * Math.min(q, REF_BOOST_MAX);
  return { mult: streakMult * (1 + boostPct), streakMult, boostPct, q };
}
async function creditTreasury(uid: string, amt: number, tok = 'SMC'): Promise<boolean> {
  const w = await loadWallets();
  const treasury = walletOf(w, TREASURY_UID);
  if ((treasury.balances[tok] || 0) < amt) return false;
  treasury.balances[tok] -= amt;
  const me = walletOf(w, uid);
  me.balances[tok] = (me.balances[tok] || 0) + amt;
  await saveWallets(w);
  return true;
}
/* invited-member session tracking: each check-in by a bound member counts toward
   the referrer's qualification; 3 sessions → qualified → +7% earnings for the referrer. */
async function ckCountRefSession(uid: string): Promise<string | null> {
  const rs: any = await getState('ref_sessions');
  const rec = rs[uid];
  if (!rec || rec.qualified) return null;
  rec.sessions = (rec.sessions || 0) + 1;
  let qualifiedRef: string | null = null;
  if (rec.sessions >= REF_QUAL_SESSIONS) { rec.qualified = true; rec.qualified_ts = Date.now(); qualifiedRef = rec.by; }
  rs[uid] = rec;
  await setState('ref_sessions', rs);
  return qualifiedRef;
}
async function engineCheckin(uid: string): Promise<any> {
  if (!(await memberInMainGroup(uid))) return { ok: false, error: 'member_gate', dm: `Daily check-ins are for Syndicate members — join the floor: ${MAIN_GROUP_LINK}` };
  const claims = await ckLog();
  const { streak: curStreak, lastTs } = ckStreakOf(claims, uid);
  const now = Date.now();
  const waitMs = CK_COOLDOWN_H * 3600e3 - (now - lastTs);
  if (lastTs && waitMs > 0) {
    const h = Math.floor(waitMs / 3600e3), mn = Math.ceil((waitMs % 3600e3) / 60e3);
    const { boostPct, q } = await earnMult(uid, curStreak);
    return { ok: false, error: 'cooldown', wait_s: Math.ceil(waitMs / 1000), streak: curStreak, boost_pct: Math.round(boostPct * 100), qualified_refs: q,
      dm: `⏳ Check-in recharges in <b>${h}h ${mn}m</b>.\nStreak alive: <b>${curStreak} day${curStreak === 1 ? '' : 's'}</b>${boostPct > 0 ? ` · referral boost +${Math.round(boostPct * 100)}% (${q} qualified)` : ''}. Don't let it die.` };
  }
  const streak = !lastTs || now - lastTs > CK_RESET_H * 3600e3 ? 1 : curStreak + 1;
  const halving = await ckHalving();
  const { streakMult, boostPct, q } = await earnMult(uid, streak);
  const pay = Math.floor(CK_BASE * halving * streakMult * (1 + boostPct));
  if (!(await creditTreasury(uid, pay))) return { ok: false, error: 'treasury_dry', dm: 'Reward pool is refilling — try again shortly. (Treasury SMC dry.)' };
  claims.push({ uid, day: dayStr(), ts: now, pay, streak });
  await setState('checkin_log', { claims: claims.slice(-2500) });
  await ckMaybeRatchetHalving();
  let refNote = '';
  const qual = await ckCountRefSession(uid);
  if (qual && (await creditTreasury(qual, REF_QUAL_BONUS))) {
    const nq = await qualifiedRefCount(qual);
    refNote = `\n⚡ Your inviter earned <b>+${REF_QUAL_BONUS.toLocaleString()} SMC</b> — you're a QUALIFIED referral now.`;
    try { await reply(qual, `⚡ <b>Referral qualified</b> — one of your invites just hit ${REF_QUAL_SESSIONS} daily check-ins. <b>+${REF_QUAL_BONUS.toLocaleString()} SMC</b>, and your earn boost is now <b>+${Math.round(Math.min(nq, REF_BOOST_MAX) * REF_BOOST_PER * 100)}%</b>. /boost for the full breakdown.`); } catch { /* no DM */ }
  }
  let chestNote = '';
  if (streak === CHEST_STREAK) {
    const chests: any = await getState('checkin_chests');
    if (!chests[uid]) {
      chests[uid] = { ts: now };
      await setState('checkin_chests', chests);
      if (await creditTreasury(uid, CHEST_BONUS)) chestNote = `\n🏆 <b>${CHEST_STREAK}-DAY VESTING CHEST: +${CHEST_BONUS.toLocaleString()} SMC.</b> Consistency is the alpha.`;
    }
  }
  const nextMult = Math.min(CK_MAX_STREAK_MULT, 1 + 0.1 * Math.min(streak + 1, 20));
  const halvingNote = halving < 1 ? `\n⚠️ Global halving ×${halving} — rates ratchet down as the Syndicate grows. Early birds eat.` : '';
  const dm = `📅 <b>CHECK-IN — DAY ${streak} — +${pay.toLocaleString()} SMC</b> (${streakMult.toFixed(1)}x streak${boostPct > 0 ? ` · +${Math.round(boostPct * 100)}% boost` : ''})\n` +
    `Next check-in pays ${nextMult.toFixed(1)}x${boostPct > 0 ? ' + boost' : ''}. Day ${CHEST_STREAK} opens the Vesting Chest.${halvingNote}${refNote}${chestNote}\n` +
    `/boost — referral multiplier · /visit — scout ads for more.`;
  return { ok: true, pay, streak, streak_mult: +streakMult.toFixed(2), boost_pct: Math.round(boostPct * 100), qualified_refs: q, halving, dm };
}
async function engineAdReward(uid: string): Promise<any> {
  if (!(await memberInMainGroup(uid))) return { ok: false, error: 'member_gate', dm: `Ad rewards are for Syndicate members — join the floor: ${MAIN_GROUP_LINK}` };
  const log = await adwLog();
  const now = Date.now();
  const last = lastByUid(log, uid);
  if (last && now - last.ts < ADW_COOLDOWN_S * 1000) return { ok: false, error: 'cooldown', wait_s: Math.ceil((ADW_COOLDOWN_S * 1000 - (now - last.ts)) / 1000), dm: '⏳ Ad slot recharges in a moment — pace yourself. The ads fund the floor.' };
  const today = dayStr();
  const todayN = log.filter((c: any) => c.uid === uid && c.day === today).length;
  if (todayN >= ADW_DAILY_CAP) return { ok: false, error: 'daily_cap', dm: `Daily ad cap (${ADW_DAILY_CAP}) reached. Back tomorrow — check-ins and scout visits still pay.` };
  const act: any = await getState('floor_activity');
  if (now - ((act[uid] || {}).t || 0) > ADW_ACTIVITY_H * 3600e3) return { ok: false, error: 'activity_gate', dm: `The ads fund the floor, so the floor eats first — say something in the group (last ${ADW_ACTIVITY_H}h) and the reward pays.` };
  const { streak } = ckStreakOf(await ckLog(), uid);
  const { boostPct } = await earnMult(uid, streak);
  const pay = Math.floor(ADW_REWARD * (1 + boostPct));
  if (!(await creditTreasury(uid, pay))) return { ok: false, error: 'treasury_dry', dm: 'Reward pool is refilling — try again shortly. (Treasury SMC dry.)' };
  log.push({ uid, day: today, ts: now, pay });
  await setState('adwatch_log', { claims: log.slice(-2500) });
  const left = ADW_DAILY_CAP - todayN - 1;
  const dm = `📺 <b>AD SUPPORTED — +${pay.toLocaleString()} SMC</b>${boostPct > 0 ? ` (+${Math.round(boostPct * 100)}% referral boost)` : ''}\nYou keep the lights on; the treasury keeps you paid. ${left} ad reward${left === 1 ? '' : 's'} left today.`;
  return { ok: true, pay, boost_pct: Math.round(boostPct * 100), left_today: left, dm };
}
async function engineStatus(uid: string): Promise<any> {
  const claims = await ckLog();
  const { streak } = ckStreakOf(claims, uid);
  const { boostPct, q } = await earnMult(uid, streak);
  const total = claims.filter((c: any) => c.uid === uid).length;
  const log = await adwLog();
  const today = dayStr();
  const counts: any = await getState('referral_counts');
  const chests: any = await getState('checkin_chests');
  const kpn: any = await getState('kill_points');
  return { ok: true, streak, checkins: total, boost_pct: Math.round(boostPct * 100), qualified_refs: q, joined_refs: counts[uid] || 0,
    ads_left: Math.max(0, ADW_DAILY_CAP - log.filter((c: any) => c.uid === uid && c.day === today).length), chest: !!chests[uid],
    kp: ((kpn.pts || {})[uid]) || 0, gate: total >= 30 || q >= 5 };
}
async function cmdCheckin(chatId: number | string, uid: string, m: any): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'Check-ins are DM-only — message me directly. One tap a day, streaks to 3x, day 30 opens the Chest.'); return; }
  const res = await engineCheckin(uid);
  await reply(chatId, res.dm || `Hmm — ${res.error || 'try again shortly'}.`);
}
async function cmdBoost(chatId: number | string, uid: string): Promise<void> {
  const claims = await ckLog();
  const { streak } = ckStreakOf(claims, uid);
  const { boostPct, q } = await earnMult(uid, streak);
  const counts: any = await getState('referral_counts');
  const joined = counts[uid] || 0;
  const nextTier = Math.min(REF_BOOST_MAX, q + 1);
  await reply(chatId, `⚡ <b>EARN BOOST</b>\nQualified referrals: <b>${q}</b> (of ${joined} joined — an invitee qualifies after ${REF_QUAL_SESSIONS} daily check-ins)\nBoost now: <b>+${Math.round(boostPct * 100)}%</b> on check-ins, ad rewards + scout visits\nNext: ${q < REF_BOOST_MAX ? `+${Math.round(nextTier * REF_BOOST_PER * 100)}% at ${nextTier} qualified — each qualification pays you ${REF_QUAL_BONUS.toLocaleString()} SMC` : 'MAXED (+35%)'}\nGet your code: /ref`);
}

/* ---------- v43 "Floor Games + LP Desk" — daily streak pulse, app-facing Flip
   (same Kill-Points rules as /flip), and the group LP Desk: members pool desk
   balances into per-token share pools; the bank deploys the pooled principal
   into LP positions (in-house pairs + outside farms like PURR-HYPE / ZCAT-ZEC);
   harvests split 70% pro-rata to share holders / 15% bank / 15% owner (bank cut
   feeds in-house token buyback per the standing plan). ---------- */
const PULSE_HOUR_UTC = 18;
async function maybeStreakPulse(): Promise<void> {
  try {
    const st: any = await getState('streak_pulse');
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (st.day === day) return;
    if (now.getUTCHours() < PULSE_HOUR_UTC) return;
    const group: any = await getState('desk_last_group');
    if (!group?.id) return;
    st.day = day;
    await setState('streak_pulse', st);
    const claims = await ckLog();
    const byUid: Record<string, { streak: number; total: number }> = {};
    for (const c of claims) { const r = byUid[c.uid] || (byUid[c.uid] = { streak: 0, total: 0 }); r.total++; }
    for (const uid of Object.keys(byUid)) byUid[uid].streak = ckStreakOf(claims, uid).streak;
    const top = Object.entries(byUid).sort((a, b) => b[1].streak - a[1].streak || b[1].total - a[1].total).slice(0, 5);
    const users: Record<string, string> = (await getState('tg_users')) as Record<string, string>;
    const nm = (u: string) => (users[u] ? '@' + users[u] : 'agent ' + String(u).slice(0, 6));
    const lines = top.map(([u, r], i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${nm(u)} — ${r.streak}d streak · ${r.total} check-ins`).join('\n');
    const rs: any = await getState('ref_sessions');
    const qualBy: Record<string, number> = {};
    for (const k of Object.keys(rs)) if (rs[k] && rs[k].qualified) qualBy[rs[k].by] = (qualBy[rs[k].by] || 0) + 1;
    const boosters = Object.entries(qualBy).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const boostLine = boosters.length ? `\n\n⚡ BOOST LEADERS\n` + boosters.map(([u, n], i) => `${['🥇', '🥈', '🥉'][i]} ${nm(u)} — +${Math.round(Math.min(n, 5) * 7)}% earn (${n} qualified ref${n === 1 ? '' : 's'})`).join('\n') : '';
    await reply(group.id, `📅 <b>DAILY STREAK BOARD — ${day}</b>\n${lines || 'No check-ins yet — DM me /checkin or tap 📅 in the Desk app.'}${boostLine}\n\n⏳ A streak dies after 36h silent. Check in, then /visit the sponsors — the ads fund this pool.`);
  } catch { /* pulse is decorative — never block the desk */ }
}

/* Flip — identical rules to /flip (Kill Points, 20s cooldown, daily win cap).
   Separate engine so the Mini App can call it without a TG message round-trip. */
async function engineFlip(uid: string, stake: number, call: string): Promise<any> {
  stake = Math.floor(stake);
  call = String(call || '').toLowerCase();
  if (!(stake >= 1) || stake > FLIP_MAX_STAKE || !['heads', 'tails'].includes(call))
    return { ok: false, error: 'usage', dm: `Flip: stake 1–${FLIP_MAX_STAKE} Kill Points, heads or tails. Win +stake, lose −stake. ${FLIP_DAILY_GAIN_CAP} pts/day win cap.` };
  const cd: any = await getState('flip_cooldown');
  const now = Date.now();
  if (cd[uid] && now - cd[uid] < FLIP_COOLDOWN_MS)
    return { ok: false, error: 'cooldown', wait_s: Math.ceil((FLIP_COOLDOWN_MS - (now - cd[uid])) / 1000), dm: 'The coin is still spinning — 20s between flips.' };
  const kp: any = await getState('kill_points');
  const pts: Record<string, number> = kp.pts || {};
  if ((pts[uid] || 0) < stake)
    return { ok: false, error: 'broke', dm: `You need ${stake} Kill Points — you have ${pts[uid] || 0}. Earn: tip +2 · settle offers +10 · trades +5 · /ref joins +25.` };
  const day = new Date().toISOString().slice(0, 10);
  const gain: any = await getState('flip_daily_gain');
  if (gain.day !== day) { gain.day = day; gain.pts = {}; }
  const landed = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = landed === call;
  cd[uid] = now;
  await setState('flip_cooldown', cd);
  if (won) {
    if ((gain.pts[uid] || 0) + stake > FLIP_DAILY_GAIN_CAP)
      return { ok: false, error: 'cap', dm: `Daily flip-win cap (${FLIP_DAILY_GAIN_CAP} pts) reached — the floor wants skill, not just luck. Back tomorrow.` };
    gain.pts[uid] = (gain.pts[uid] || 0) + stake;
    await setState('flip_daily_gain', gain);
    await addPoints(uid, stake);
  } else {
    kp.pts[uid] = (pts[uid] || 0) - stake;
    await setState('kill_points', kp);
  }
  const bal = (((await getState('kill_points')).pts || {})[uid]) || 0;
  return { ok: true, landed, won, stake, balance: bal,
    dm: won ? `🪙 <b>${landed.toUpperCase()}</b> — it came up ${landed}. <b>+${stake}</b> Kill Points (balance ${bal}).` : `🪙 <b>${landed.toUpperCase()}</b> — you called ${call}. <b>−${stake}</b> Kill Points (balance ${bal}). The coin keeps what it takes.` };
}

/* LP Desk — group-managed LP share pools (desk-ledger level). */
const LPD_TOKENS = ['SMRT', 'SMF', 'SMC', 'SOL'];
const LPD_MEMBER_CUT = 0.70;
function lpdTotalShares(p: any): number { return Object.values(p.shares || {}).reduce((a: number, b: any) => a + Number(b), 0); }
async function lpdPools(): Promise<any> { const s: any = await getState('lpdesk'); return s.pools || {}; }
async function engineLpdesk(uid: string, op: string, tok: string, amt: number): Promise<any> {
  const pools = await lpdPools();
  const t = (tok || '').toUpperCase();
  if (op === 'status') {
    const summary = LPD_TOKENS.map(k => { const p = pools[k]; return p ? `· ${k}: ${(p.principal || 0).toLocaleString()} pooled · ${p.harvests || 0} harvests · ${(p.earned || 0).toLocaleString()} paid to members` : null; }).filter(Boolean).join('\n');
    const mine: string[] = [];
    for (const k of Object.keys(pools)) { const sh = (pools[k].shares || {})[uid]; if (sh) mine.push(`· ${k}: ${sh.toLocaleString()} shares (${(100 * sh / (lpdTotalShares(pools[k]) || 1)).toFixed(2)}%)`); }
    return { ok: true, summary: summary || 'Pools not seeded yet — first deposits open them.', mine: mine.join('\n') || 'No shares yet.',
      dm: `🏦 <b>LP DESK — group LP, pro-rata payouts</b>\n${summary || 'Pools not seeded yet — first deposits open them.'}\n\n<b>Your shares:</b>\n${mine.join('\n') || 'No shares yet.'}\n\nDeposit desk balances: /lpdesk deposit SMC 50000 · withdraw: /lpdesk withdraw SMC 50000 · /lpdesk status\nPools fund group LP positions (in-house pairs + outside farms). Harvests: 70% members pro-rata · 15% bank · 15% owner.` };
  }
  if (!LPD_TOKENS.includes(t)) return { ok: false, error: 'token', dm: 'LP Desk tokens: ' + LPD_TOKENS.join(', ') };
  if (op === 'deposit') {
    amt = Math.floor(amt);
    if (!(amt >= 1)) return { ok: false, error: 'amount', dm: 'Deposit like: /lpdesk deposit SMC 50000' };
    const w = await loadWallets();
    const me = walletOf(w, uid);
    if ((me.balances[t] || 0) < amt) return { ok: false, error: 'balance', dm: `Your desk ${t} balance is ${(me.balances[t] || 0).toLocaleString()} — deposit less or earn more first (/checkin, /visit).` };
    me.balances[t] -= amt;
    const p = pools[t] || (pools[t] = { principal: 0, shares: {}, earned: 0, harvests: 0 });
    p.principal += amt;
    p.shares[uid] = (p.shares[uid] || 0) + amt;
    await saveWallets(w);
    await setState('lpdesk', { pools });
    return { ok: true, op, tok: t, amt, shares: p.shares[uid], pool: p.principal,
      dm: `🏦 LP DESK — deposited <b>${amt.toLocaleString()} ${t}</b>.\nYour ${t} shares: ${p.shares[uid].toLocaleString()} (${(100 * p.shares[uid] / (lpdTotalShares(p) || 1)).toFixed(2)}% of pool).\nThe bank deploys pooled ${t} into LP positions; harvests pay 70% pro-rata. /lpdesk status anytime.` };
  }
  if (op === 'withdraw') {
    amt = Math.floor(amt);
    const p = pools[t];
    if (!p || !(p.shares[uid] > 0)) return { ok: false, error: 'no_shares', dm: `You're not holding ${t} shares. /lpdesk status` };
    if (!(amt >= 1)) return { ok: false, error: 'amount', dm: 'Withdraw like: /lpdesk withdraw SMC 50000' };
    if (p.shares[uid] < amt) return { ok: false, error: 'shares', dm: `You hold ${p.shares[uid].toLocaleString()} ${t} shares.` };
    if (p.principal < amt) return { ok: false, error: 'illiquid', dm: 'Pool principal is deployed right now — try a smaller amount or come back after the next harvest.' };
    const w = await loadWallets();
    const me = walletOf(w, uid);
    me.balances[t] = (me.balances[t] || 0) + amt;
    p.principal -= amt;
    p.shares[uid] -= amt;
    await saveWallets(w);
    await setState('lpdesk', { pools });
    return { ok: true, op, tok: t, amt, shares: p.shares[uid],
      dm: `🏦 LP DESK — withdrew <b>${amt.toLocaleString()} ${t}</b> to your desk balance. Shares left: ${p.shares[uid].toLocaleString()}.` };
  }
  return { ok: false, error: 'usage', dm: '/lpdesk status · /lpdesk deposit TOKEN AMOUNT · /lpdesk withdraw TOKEN AMOUNT' };
}
/* Harvest — desk-key-only action: bank records LP earnings; members paid pro-rata. */
async function engineLpdeskHarvest(tok: string, earned: number, note: string): Promise<any> {
  const t = tok.toUpperCase();
  const pools = await lpdPools();
  const p = pools[t];
  if (!p) return { ok: false, error: 'no_pool' };
  const tot = lpdTotalShares(p);
  if (!tot) return { ok: false, error: 'no_shares' };
  earned = Math.floor(earned);
  if (!(earned > 0)) return { ok: false, error: 'amount' };
  const w = await loadWallets();
  const memberPool = Math.floor(earned * LPD_MEMBER_CUT);
  let paid = 0;
  for (const [uid, sh] of Object.entries(p.shares)) {
    const cut = Math.floor(memberPool * Number(sh) / tot);
    if (cut > 0) { const me = walletOf(w, uid); me.balances[t] = (me.balances[t] || 0) + cut; paid += cut; }
  }
  const bankCut = Math.floor(earned * 0.15);
  const ownerCut = earned - memberPool - bankCut;
  const treasury = walletOf(w, TREASURY_UID);
  treasury.balances[t] = (treasury.balances[t] || 0) + bankCut + ownerCut;
  await saveWallets(w);
  p.earned = (p.earned || 0) + paid;
  p.harvests = (p.harvests || 0) + 1;
  p.lastHarvest = Date.now();
  p.note = String(note || '').slice(0, 140);
  await setState('lpdesk', { pools });
  return { ok: true, tok: t, earned, memberPool: paid, bankCut, ownerCut, harvests: p.harvests };
}
/* ---------- v52 "THE DESK": your trading seat over LP Desk capital ----------
   Capital = share ownership across LP Desk pools (100% of a pool ≈ 1000 capital)
   × tier bonus (+5%/tier) × referral boost (qualified-refs engine).
   The desk earns hourly in SMC (treasury-funded now; bank trading profits add
   to the pool later — the fiction is TRUE: the bank really trades). Collects pay
   a 10% desk fee into the revenue ledger (75/15/10 pipeline). Tiers: lifetime-P&L
   milestones — Junior Trader → Analyst → Senior Trader → PM → Partner. */
const FARM_RATE_PER_POWER_DAY = 0.24;   // SMC per capital per day — tune as treasury allows
const FARM_MAINTENANCE_PCT = 0.10;
const FARM_ACCRUAL_CAP_H = 72;          // offline progress max 3 days
const FARM_LEVELS = [0, 1000, 10000, 50000, 250000]; // lifetime P&L SMC -> tier 1..5
const FARM_TIERS = ['Junior Trader', 'Analyst', 'Senior Trader', 'PM', 'Partner'];
const FARM_LEVEL_BONUS = 0.05;
async function farmState(): Promise<any> { const s: any = await getState('farm'); return s && s.users ? s : { users: {} }; }
async function engineFarm(uid: string, op: string): Promise<any> {
  const f = await farmState();
  const pools = await lpdPools();
  const u = f.users[uid] || (f.users[uid] = { total_mined: 0, last_claim: 0, level: 1 });
  /* referral boost reuses the qualified-refs engine (engineStatus computes boost_pct) */
  let refBoost = 0;
  try { const st = await engineStatus(uid); refBoost = Math.round(st.boost_pct || 0); } catch { /* boost best-effort */ }
  let bp = 0;
  for (const k of Object.keys(pools)) { const p = pools[k]; const tot = lpdTotalShares(p); if (tot > 0) bp += 10000 * ((p.shares || {})[uid] || 0) / tot; }
  const level = FARM_LEVELS.reduce((l, m, i) => ((u.total_mined || 0) >= m ? i + 1 : l), 1);
  u.level = level;
  const power = (bp / 10) * (1 + (level - 1) * FARM_LEVEL_BONUS) * (1 + refBoost / 100);
  const now = Date.now();
  const hours = u.last_claim ? Math.min((now - u.last_claim) / 3600e3, FARM_ACCRUAL_CAP_H) : 0;
  const claimable = Math.floor(power * FARM_RATE_PER_POWER_DAY * hours / 24 * 100) / 100;
  if (op === 'status' || op === '') {
    await setState('farm', f);
    return { ok: true, power: Math.round(power * 100) / 100, level, claimable: Math.round(claimable * 100) / 100,
      total_mined: Math.round((u.total_mined || 0) * 100) / 100, next_level_at: FARM_LEVELS[level] || null,
      rate_day: Math.round(power * FARM_RATE_PER_POWER_DAY * 100) / 100, rate_hour: Math.round(power * FARM_RATE_PER_POWER_DAY / 24 * 1000) / 1000,
      maintenance_pct: FARM_MAINTENANCE_PCT * 100, ref_boost: refBoost,
      dm: `💼 <b>THE DESK</b> — your trading seat\nCapital: <b>${(Math.round(power * 100) / 100).toLocaleString()}</b> buying power (${FARM_TIERS[level - 1]} · +${Math.round((level - 1) * FARM_LEVEL_BONUS * 100)}% · ref boost +${refBoost}%)\nDesk earns ~${(power * FARM_RATE_PER_POWER_DAY / 24).toFixed(2)} SMC/hour · unbooked P&L: <b>${(Math.round(claimable * 100) / 100).toLocaleString()} SMC</b>\nLifetime P&L: ${(Math.round((u.total_mined || 0) * 100) / 100).toLocaleString()} SMC${FARM_LEVELS[level] ? ` · next tier at ${FARM_LEVELS[level].toLocaleString()} (${FARM_TIERS[level]})` : ' · PARTNER DESK'}\n\nCapital comes from LP Desk shares — /lpdesk deposit SMC 50000\nCollect: /farm claim · 10% desk fee feeds the 75/15/10 pipeline` };
  }
  if (op === 'claim') {
    if (power <= 0) { await setState('farm', f); return { ok: false, error: 'no_power', dm: '💼 THE DESK — no capital working. Buying power comes from LP Desk shares: /lpdesk deposit SMC 50000' }; }
    if (claimable < 1) { await setState('farm', f); return { ok: false, error: 'nothing', dm: `💼 Nothing to book yet — your desk earns ~${(power * FARM_RATE_PER_POWER_DAY / 24).toFixed(2)} SMC/hour. /farm status to watch the P&L build.` }; }
    if (!(await creditTreasury(uid, claimable))) { await setState('farm', f); return { ok: false, error: 'treasury_dry', dm: 'The desk vault is refilling — try again shortly.' }; }
    const fee = Math.floor(claimable * FARM_MAINTENANCE_PCT * 100) / 100;
    u.last_claim = now;
    u.total_mined = Math.round(((u.total_mined || 0) + claimable) * 100) / 100;
    await recordRevenue('farm_fee', 'SMC', fee, uid);
    await setState('farm', f);
    return { ok: true, claimed: claimable, fee, power: Math.round(power * 100) / 100, level,
      dm: `💼 <b>THE DESK</b> — booked <b>${claimable.toLocaleString()} SMC</b> P&L (gross; ${fee} desk fee stays in the eco via 75/15/10).\nLifetime P&L: ${u.total_mined.toLocaleString()} SMC · ${FARM_TIERS[level - 1]}.` };
  }
  return { ok: false, error: 'usage', dm: '/farm status · /farm claim' };
}
async function cmdFarm(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'The Desk is DM-only — your capital, your book. Message me directly.'); return; }
  const res = await engineFarm(uid, (parts[1] || 'status').toLowerCase());
  await reply(chatId, res.dm || `Hmm — ${res.error || 'try again shortly'}.`);
}
async function cmdLpdesk(chatId: number | string, uid: string, m: any, parts: string[]): Promise<void> {
  if (isGroup(m)) { await reply(chatId, 'LP Desk is DM-only — message me directly. Group LP, pro-rata payouts, withdraw anytime the pool is liquid.'); return; }
  const op = (parts[1] || 'status').toLowerCase();
  const res = await engineLpdesk(uid, op === 'status' ? 'status' : op, parts[2] || '', parseFloat(parts[3] || ''));
  await reply(chatId, res.dm || `Hmm — ${res.error || 'try again shortly'}.`);
}


const PROMO_GROUP_ID = -1003628802220; // second GROUP (promo/outreach) — funnel target = main group
const PROMO_CHANNEL_ID = -1002936165843; // SMARTZcapital Market Ideas channel — daily billboard
const MAIN_GROUP_LINK = 'https://t.me/Smrtquickflips';
async function cmdVault(chatId: number | string, uid: string, parts: string[]): Promise<void> {
  const st: any = await getState('vault_members');
  const members: Record<string, any> = st.m || {};
  const mine: Record<string, any> = members[uid] || {};
  const action = (parts[1] || '').toLowerCase();

  if (action === 'join') {
    const tok = (parts[2] || '').toUpperCase();
    const amt = parseFloat(parts[3] || '');
    const mint = DESK_TOKENS[tok];
    if (!mint || !(amt > 0)) { await reply(chatId, 'Vault: /vault join SMRT 5000\nOpt in to let the Bank TRADE up to that amount of your tokens. They stay in YOUR wallet — the Bank gets delegate authority only, capped at your amount, revocable anytime with /vault exit.'); return; }
    if (mine[tok]) { await reply(chatId, `You're already vaulting ${mine[tok].amount.toLocaleString()} ${tok}. Exit first to change the amount.`); return; }
    if (!(await loadChainLibs()) || !(await initBank())) { await reply(chatId, 'Vault engine is starting up — try again in a minute.'); return; }
    const w = await myWallet(uid);
    if (!w) { await reply(chatId, 'No wallet yet — /wallet first, fund it with a dust of SOL for the approve fee, then /vault join.'); return; }
    try {
      const ata = await getAta(new WEB3.PublicKey(mint), w.kp.publicKey);
      const info: any = await rpcCall('getAccountInfo', [ata.toBase58(), { encoding: 'base64' }]);
      if (!info?.value) { await reply(chatId, `Your ${tok} token account doesn't exist yet — hold some ${tok} in your /wallet first.`); return; }
      const raw = Math.round(amt * 1e9);
      const tx = new WEB3.Transaction().add(createApproveIx(ata, BANK_KP.kp.publicKey, w.kp.publicKey, raw));
      const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = w.kp.publicKey;
      tx.sign(w.kp);
      const sig: any = await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }]);
      await confirmTx(sig);
      mine[tok] = { amount: amt, since: Date.now(), tx: sig };
      members[uid] = mine;
      await setState('vault_members', { m: members });
      await reply(chatId, `🔒 VAULTED ${amt.toLocaleString()} ${tok}\nBank can now trade up to that amount via delegate authority. Tokens stay in your wallet. Yield share activates with the first profitable bank cycle — 70% you / 15% bank / 15% owner, paid in ${tok}.\nExit anytime: /vault exit ${tok}`);
    } catch (e) {
      await reply(chatId, `Vault join failed: ${String(e).slice(0, 120)}`);
    }
    return;
  }

  if (action === 'exit') {
    const tok = (parts[2] || '').toUpperCase();
    if (!mine[tok]) { await reply(chatId, `You're not vaulting ${tok}. /vault status`); return; }
    if (await loadChainLibs() && await initBank()) {
      try {
        const w = await myWallet(uid);
        if (w) {
          const ata = await getAta(new WEB3.PublicKey(DESK_TOKENS[tok]), w.kp.publicKey);
          const tx = new WEB3.Transaction().add(createRevokeIx(ata, BANK_KP.kp.publicKey, w.kp.publicKey));
          const bh = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
          tx.recentBlockhash = bh.blockhash;
          tx.feePayer = w.kp.publicKey;
          tx.sign(w.kp);
          await rpcCall('sendTransaction', [bytesToBase64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }]);
        }
      } catch { /* revoke best-effort — state cleared regardless so desk won't trade it */ }
    }
    delete mine[tok];
    if (Object.keys(mine).length) members[uid] = mine; else delete members[uid];
    await setState('vault_members', { m: members });
    await reply(chatId, `Un-vaulted ${tok}. Delegate authority revoked — the Bank can no longer touch those tokens.`);
    return;
  }

  // status (default)
  const vaultToks = Object.keys(mine);
  const totals: Record<string, number> = {};
  for (const u of Object.keys(members)) for (const t of Object.keys(members[u])) totals[t] = (totals[t] || 0) + members[u][t].amount;
  const myLines = vaultToks.length
    ? vaultToks.map(t => `• ${mine[t].amount.toLocaleString()} ${t} — since ${new Date(mine[t].since).toISOString().slice(0, 10)}${mine[t].yield ? ` · yield ${mine[t].yield.toFixed(4)} ${t}` : ''}`).join('\n')
    : 'Not vaulting anything. /vault join SMRT 5000 to opt in.';
  const totLines = Object.keys(totals).map(t => `• ${totals[t].toLocaleString()} ${t}`).join('\n') || 'nothing yet';
  await reply(chatId,
    `<b>VAULT</b> — delegate, not custody\nYour vault:\n${myLines}\n\nFloor total vaulted:\n${totLines}\n\nTokens never leave your wallet until a trade executes. Revoke anytime: /vault exit TOKEN`);
}

/* ---------- v25: revenue report ---------- */
async function cmdRevenue(chatId: number | string): Promise<void> {
  const s = await revenueSummary();
  const log: any = await getState('payout_log');
  const payouts: any[] = Array.isArray(log.payouts) ? log.payouts : [];
  const OWNER_RATE = 0.15; // 15% of desk profit to the owner (10-20% band)
  const pending = s.sincePayout * OWNER_RATE;
  const recent = payouts.slice(-5).reverse()
    .map((p: any) => `• ${new Date(p.ts).toISOString().slice(0, 10)} — ${p.amount?.toFixed(4)} SOL → owner (tx ${String(p.tx || '').slice(0, 12)}…)`).join('\n');
  const burnLog: any = await getState('burn_log');
  const lpRec: any = await getState('lp_receipts');
  const burned = (burnLog.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const lpPending = (lpRec.items || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
  await reply(chatId,
    `<b>DESK REVENUE</b>\n` +
    `Lifetime fees accrued: <b>${s.total.toFixed(4)} SOL</b>\n` +
    `Since last owner payout: <b>${s.sincePayout.toFixed(4)} SOL</b>\n` +
    `Owner share pending (15%): <b>${pending.toFixed(4)} SOL</b>\n` +
    `Total paid to owner: <b>${(s.paidOut || 0).toFixed(4)} SOL</b>\n` +
    `🔥 Tokens burned to date: <b>${burned}</b>\n` +
    `💧 LP accrued (pending builder): <b>${lpPending.toLocaleString('en-US', { maximumFractionDigits: 2 })} token-units</b>\n\n` +
    (recent ? `<b>RECENT PAYOUTS</b>\n${recent}` : 'No payouts yet — the sweep runs on schedule once profit accumulates.') +
    `\n\nFee sources: 1% desk fee on executed trades · 0.05 SOL desk margin per member-funded /launch (0.03 of the 0.08 is StonkFun rent — pass-through) · in-house token promo fees (75/15/10 split).\nBank recycles margin into SMRT accumulation. Owner sweep: 15% of profit, on schedule.`);
}

async function cmdLp(chatId: number | string): Promise<void> {
  const q: any = await getState('lp_requests');
  const list: any[] = (Array.isArray(q.list) ? q.list : []).slice(-10);
  if (!list.length) {
    await reply(chatId,
      'No side LPs queued yet.\nEvery /launch auto-queues one: your token paired vs SMRT in a Raydium pool, so it trades in two places from day one.\n\n' +
      '📚 New to liquidity? <code>/lpschool 1</code> — six short lessons, no jargon.');
    return;
  }
  const lines = list.map(l => `${l.status === 'done' ? '✅' : l.status === 'ready' ? '🟡' : '⏳'} $${l.symbol} vs ${l.pair} — ${l.status}${l.pool ? '\n   pool: ' + l.pool : ''}`);
  await reply(chatId, '<b>SIDE LP QUEUE</b> — launched tokens get a second home vs SMRT\n' + lines.join('\n') +
    '\n\nLPs seed the pool from the Bank so new tokens trade instantly, not just on the curve.\n📚 <code>/lpschool 1</code> to learn what that means.');
}

/* ---------------- v53: /pools — live pool board, both venues ---------------- */
async function cmdPools(chatId: number | string): Promise<void> {
  const cache: any = await getState('pools_board');
  if (cache.text && Date.now() - (cache.ts || 0) < 10 * 60 * 1000) {
    await reply(chatId, cache.text);
    return;
  }
  const lines: string[] = [];
  try {
    for (const [sym, mint] of Object.entries(DESK_TOKENS)) {
      if (sym === 'SOL') continue;
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      const d = await r.json();
      const pairs = (d.pairs || []).filter((p: any) => p.chainId === 'solana')
        .sort((a: any, b: any) => ((b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))).slice(0, 3);
      if (!pairs.length) { lines.push(`<b>$${sym}</b> — no Solana pools listed right now`); continue; }
      const rows = pairs.map((p: any) =>
        `• ${p.dexId} <b>${p.baseToken?.symbol}/${p.quoteToken?.symbol}</b> · liq $${(p.liquidity?.usd || 0).toLocaleString()} · 24h $${(p.volume?.h24 || 0).toLocaleString()} — <a href="https://dexscreener.com/solana/${p.pairAddress}">chart</a>`);
      lines.push(`<b>$${sym}</b>\n` + rows.join('\n'));
    }
    const text = '🏊 <b>LIVE POOL BOARD</b> — every venue we trade on\n' +
      'Raydium CLMM = concentrated (NFT position) · Raydium CPMM = full-range (plain LP tokens) · Orca Whirlpools = concentrated; fresh Orca pools are on the desk build list (the old ones died in the migration)\n\n' +
      lines.join('\n\n') +
      '\n\nBefore you LP or ape, read liq + 24h volume here (LP School lesson 5). 📚 <code>/lpschool 5</code>';
    await setState('pools_board', { text, ts: Date.now() });
    await reply(chatId, text);
  } catch (e) {
    await reply(chatId, `Pool board fetch failed: ${String(e).slice(0, 100)}`);
  }
}

/* ---------------- v24: LP School — teach the floor how liquidity works ---------------- */
const LP_SCHOOL: { t: string; b: string }[] = [
  {
    t: 'Lesson 1 — What LP actually is',
    b: `A liquidity pool is a two-token vending machine. To let anyone swap TOKEN ↔ SMRT instantly, someone must deposit BOTH sides — like stocking the machine with cola and coins at once.\n\nThat someone is the LP. In exchange for stocking it, every swap pays the LP a small fee (typically 0.25–1%).\n\nNo pool = no instant trades, only slow, negotiated swaps. Every token you have ever aped had a pool behind it. /lpschool 2`,
  },
  {
    t: 'Lesson 2 — How the Syndicate side-LP works',
    b: `When a member /launch es a token, the desk does two things:\n1️⃣ The launch pool (your token vs the quote you picked)\n2️⃣ A <b>side LP</b>: your token vs SMRT, seeded by the Bank — 10,000 of your token + 50 SMRT\n\nWhy the second pool? So your token trades against the community token from minute one. Two pools = more routes = tighter prices = the Bank can market-make across both.\n\nThe Bank seeds it, but the pool belongs to no one — check the pool address on /lp once it's done. /lpschool 3`,
  },
  {
    t: 'Lesson 3 — Impermanent loss (the honest part)',
    b: `LPing is not free money. If your token's price doubles vs SMRT, the pool automatically sells your winners and buys your losers — you end up with less upside than just holding.\n\nSmall example: you LP 10,000 TOKEN + 50 SMRT. TOKEN 2x's. Hold = ~200 SMRT value. LP = ~141 SMRT value. That ~30% gap is impermanent loss — it shrinks if prices come back together.\n\nFees can out-earn it in busy pools. Thin pools eat LPs alive. That is why the Bank seeds small and caps exposure. /lpschool 4`,
  },
  {
    t: 'Lesson 4 — Providing your own LP',
    b: `The Bank seed gets a token started — member liquidity makes it real.\n\nTo LP yourself (outside the desk, on Raydium):\n1️⃣ Hold BOTH sides: your token + SMRT, roughly equal value\n2️⃣ Open the pool from /lp and Add Liquidity\n3️⃣ You get LP tokens = your share of every future fee\n\nRisks, plainly: impermanent loss (lesson 3), thin-pool slippage, and never LP more than you would hold. The desk never touches member LP — it's your position, your keys. /lpschool 5`,
  },
  {
    t: 'Lesson 5 — Reading a pool before you touch it',
    b: `Five numbers before any LP or ape:\n• <b>Liquidity (TVL)</b> — pool depth; under ~$500 and your own buy moves the price (the desk calls this the gate)\n• <b>24h volume</b> — fee income; volume/liquidity > 10% daily = busy pool\n• <b>Price impact</b> — quote a $50 swap; >5% impact means thin\n• <b>Top holders</b> — one wallet over ~20% can dump through your LP\n• <b>Pool age</b> — brand-new pools carry launch risk\n\nThe desk prints the first two in /price and every daily drop. Practice reading them here before anywhere else. /lpschool 6`,
  },
  {
    t: 'Lesson 6 — Two venues: Raydium vs Orca',
    b: `Syndicate liquidity lives on two venues, and they are not the same machine:\n• <b>Raydium CLMM</b> — concentrated liquidity. You pick a price range (±20% around market is the desk default), earn more fees per dollar, but drift out of range if price runs away. Position = an NFT. Live today: SMRT/SOL.\n• <b>Raydium CPMM</b> — full-range, plain LP tokens, no range to manage. Deepest Syndicate pool: TUNNEL/SOL (~$4.8k). Start here if ranges make you nervous.\n• <b>Orca Whirlpools</b> — the same concentrated skill as CLMM (NFT position, range-based). Every old Syndicate Orca pool died in the 2024 migration, so fresh Orca pools are on the desk build list — when one lands, everything you learned on CLMM transfers 1:1.\n\nRule of thumb: check /pools before committing capital. Pick the venue with real depth, not the prettier UI. 🎓 End of course — quiz the room: which venue would you LP TUNNEL on, and at what range?`,
  },
];

async function cmdLpSchool(chatId: number | string, parts: string[]) {
  const n = Math.min(Math.max(parseInt(parts[1] || '1', 10) || 1, 1), LP_SCHOOL.length);
  const L = LP_SCHOOL[n - 1];
  await reply(chatId, `📚 <b>LP SCHOOL (${n}/${LP_SCHOOL.length}) — ${L.t.replace('Lesson ' + n + ' — ', '')}</b>\n\n${L.b}`);
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
  { k: ['tip'], a: 'Tips: /tip <amount> <TOKEN> <@username> — if your own wallet is funded it settles wallet-to-wallet on-chain; otherwise it moves on the desk ledger instantly.' },
  { k: ['wallet', 'my address', 'my wallet'], a: 'Everyone gets their own Solana wallet here: /wallet shows your address and live on-chain balances. Fund it from Phantom or any exchange — your keys, your funds. The desk never pools member money.' },
  { k: ['withdraw', 'cash out'], a: 'Ledger withdrawals are two-step for safety: /link <solana-address> once, then /withdraw <amount> <TOKEN> and reply CONFIRM <code>. Or skip the ledger entirely — keep funds in your own /wallet.' },
  { k: ['trade', 'swap'], a: 'Three ways to trade: /trade buy SMRT 0.1 = desk Jupiter order (custodial ledger); /quote SMRT = Bank two-way price, then /offer to trade P2P with the floor; /take <ID> settles an open offer on-chain wallet-to-wallet.' },
  { k: ['offer', 'buy smrt', 'sell smrt'], a: 'The floor is P2P: /offer sell 100000 SMRT 0.00005 posts your price, /offers lists open ones, /take <ID> settles on-chain. The Bank quotes first with /quote.' },
  { k: ['bank'], a: 'The Bank is the desk market maker: /bank shows its address and public inventory, /quote <TOKEN> gets its two-way price. It takes offers that beat its book and sweeps the spread.' },
  { k: ['points', 'leaderboard', 'kill points', 'score'], a: 'Kill Points score today\'s on-chain activity: tip +2, settle an offer +10, get bank-taken +5, desk trade +5, withdraw +1. /points shows the live board; the final standings post to the group daily.' },
  { k: ['agent wallet', 'agentwallet'], a: 'Every AI agent gets its own Solana wallet: /agentwallet <name> shows it (mints if new). Fund it to give the agent working capital — agent-driven trading is the next drop.' },
  { k: ['launch', 'launch token', 'stonkfun', 'create token', 'my token'], a: 'Launch your own token: /launch SYMBOL Name [quote=ANY]. Pair it with a Syndicate token, any desk-listed token, or paste any Solana mint. It deploys on StonkFun (Raydium LaunchLab, 0.03 SOL); creator earns 0.5% of every trade forever, and a side LP vs SMRT is auto-queued (/lp). +25 Kill Points.' },
  { k: ['rank'], a: 'Ranks: Unverified → Tunnel-Cleared → Bladebearer (hold SMF) → Sentinel (10k+ SMRT) → Coherent (SMRT+SMF). /ranks for the ladder.' },
  { k: ['contract', 'address'], a: 'Contracts — SMRT: BkDKvbUQpr17c5w3zZzEA1VvpirgWcKuMEHtiYGEaP1c · SMF: 2mEtt2musbjuRcsyyG29xjeTqJX4ehXBQdFLmZd9dG6N · SMC: 5aEQU6za19QDn8LFHpL5xRzvAgPP2kzFbCviP6pWt63N · TUNNEL: EemmWtCteqn5HTDqLMnAKgqGqpyuoA6BxyuU7pJD29QK' },
  { k: ['scam', 'rug'], a: 'These are community micro-caps — size positions for volatility, only hold what you can weather, and DYOR always. I teach mechanics; I never call plays.' },
];

async function cmdChat(chatId: number | string, uid: string, m: any, text: string) {
  const low = text.toLowerCase().trim();
  /* v28: promo-group learning — log tokens members promote (CA or ticker shill)
     into promo_tokens for the scanner watchlist. Quiet, never replies about it. */
  try {
    if (isGroup(m)) {
      const pg: any = await getState('promo_groups');
      const promoIds: number[] = Array.isArray(pg.ids) && pg.ids.length ? pg.ids : [PROMO_GROUP_ID];
      if (promoIds.includes(m.chat?.id)) {
        const ca = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        const tkm = low.match(/(?:ca\s*[: ]+|^\$|buy\s+|\bage\b\s+)([a-z0-9]{2,12})\b/);
        if (ca || tkm) {
          const pt: any = await getState('promo_tokens');
          const list: any[] = Array.isArray(pt.items) ? pt.items : [];
          list.push({ ts: Date.now(), group: m.chat.id, by: m.from?.username || String(uid), mint: ca ? ca[0] : '', sym: tkm ? tkm[1].toUpperCase() : '' });
          await setState('promo_tokens', { items: list.slice(-200) });
        }
      }
    }
  } catch { /* learning is best-effort */ }
  await scanBrain();
  const brain = await loadBrain();
  if (/^(hi|hello|hey|yo|sup|hiya|good evening|good afternoon)\b[\s!.]*$/i.test(low)) {
    await reply(chatId, `Welcome back${m.from?.first_name ? ', ' + m.from.first_name : ''}. Ask me anything about the Syndicate — tokens, prices, tips — or type /menu for every command.`);
    return;
  }
  if (/^(thanks|thank you|thx|ty|appreciated)\b/i.test(low)) {
    await reply(chatId, `Anytime. The floor remembers who shows up. /desk lists every command.`);
    return;
  }
  if (/\b(balance|how much do i have|my tokens)\b/i.test(low)) { await cmdBalance(chatId, uid, m.from?.username); return; }
  const pm = low.match(/price of ([a-z]+)/);
  if (pm && (DESK_TOKENS[pm[1].toUpperCase()] || (await extraTokens())[pm[1].toUpperCase()])) { await cmdPrice(chatId, ['', pm[1].toUpperCase()]); return; }
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
  await reply(chatId, `Didn't catch that as a command — but I can talk. Try asking: "what is SMRT?" or "how do I tip?"
Or type /menu for every command.`);
}

/* ---------------- entry ---------------- */
/* v49: agent-kit job queue — desk enqueues on-chain maintenance jobs into
   bridge_state (agentkit_job_<id>); the local agentkit_worker executes them
   with the bank wallet. Sweep = rent recovery from empty token accounts. */
async function cmdAgentkit(chatId: string | number, uid: string, kind: string, args: Record<string, unknown> = {}) {
  const last: any = await getState('agentkit_last_' + kind);
  if (last.ts && Date.now() - last.ts < 3600e3) { await reply(chatId, `⏳ ${kind} was queued < 1h ago — one at a time keeps the receipts clean.`); return; }
  const id = 'aj' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await setState('agentkit_job_' + id, { id, kind, args, by: String(uid), status: 'queued', attempts: 0, created_at: new Date().toISOString() });
  await setState('agentkit_last_' + kind, { ts: Date.now() });
  const label = kind === 'sweep'
    ? `🧹 Bank rent sweep queued (${id}) — reclaiming SOL locked in empty token accounts. The receipt lands when the worker confirms it on-chain.`
    : kind === 'rain'
    ? `🌧 <b>ON-CHAIN RAIN queued</b> (${id}) — bank will ZK-airdrop <b>${args.amount_each} ${args.tok}</b> × ${((args.recipients as string[]) || []).length} LP share holder(s). The worker posts the tx receipt here when it lands on-chain.`
    : `⚙️ ${kind} job queued (${id}).`;
  await reply(chatId, label);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') { const learned = await scanBrain(); return json({ ok: true, fn: 'tg-desk v56 Genesis Drop', treasury: !!(await initDesk()), bank: !!(await initBank()), learned }); }
  /* v10: only the bridge (holding the shared secret) may forward commands */
  if (!DESK_AUTH || req.headers.get('x-desk-key') !== DESK_AUTH) return json({ ok: false, error: 'unauthorized' }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  /* v14: manual/automation cycle trigger */
  if (body.desk_cycle) { await bankCycle(); return json({ ok: true, cycled: true }); }
  /* v42: Mini App engine calls, forwarded by the bridge (identity pre-validated there via initData) */
  if (body.checkin_req) { const r = body.checkin_req; const res = await engineCheckin(String(r.uid)); try { await reply(String(r.uid), res.dm); } catch { /* member hasn't DM'd the bot yet */ } return json(res); }
  if (body.ad_reward_req) { const r = body.ad_reward_req; const res = await engineAdReward(String(r.uid)); try { await reply(String(r.uid), res.dm); } catch { /* member hasn't DM'd the bot yet */ } return json(res); }
  if (body.eng_status_req) { const r = body.eng_status_req; return json(await engineStatus(String(r.uid))); }
  /* v43: app games + LP Desk */
  if (body.flip_req) { const r = body.flip_req; const res = await engineFlip(String(r.uid), Number(r.stake), String(r.call)); try { await reply(String(r.uid), res.dm); } catch { /* no DM yet */ } return json(res); }
  if (body.lpdesk_req) { const r = body.lpdesk_req; const res = await engineLpdesk(String(r.uid), String(r.op || 'status'), String(r.tok || ''), Number(r.amt || 0)); try { await reply(String(r.uid), res.dm); } catch { /* no DM yet */ } return json(res); }
  if (body.wallet_req) {
    /* v46: Mini App vault panel — ledger balances, KP, LP shares, member P2P address */
    const uid = String((body.wallet_req as any).uid);
    const w = await loadWallets();
    const me = walletOf(w, uid);
    const kpn: any = await getState('kill_points');
    const pools = await lpdPools();
    const shares: Record<string, number> = {};
    for (const k of Object.keys(pools)) { const sh = (pools[k].shares || {})[uid]; if (sh) shares[k] = sh; }
    let addr = '';
    let onchain: Record<string, number> = {};
    try { if (await ensureWeb3()) { const mw = await myWallet(uid); if (mw) { addr = mw.addr; onchain = await chainBalances(addr); } } } catch { /* chain libs unavailable — address stays empty */ }
    const bk: any = await getState('backup_blobs');
    return json({ ok: true, balances: me.balances || {}, deposited: me.deposited || 0, withdrawn: me.withdrawn || 0, kp: ((kpn.pts || {})[uid]) || 0, shares, addr, onchain, linked: me.linked || '', backed_up: !!bk[uid] });
  }
  if (body.agentkit_req) {
    /* v49: agent-kit job queue (shared-key) — bridge/Mini App enqueue; local
       agentkit_worker executes with the bank wallet (sweep now, compressed
       airdrop rains + pool creation next). */
    const r = body.agentkit_req;
    const kind = String(r.kind || '').slice(0, 24);
    if (!/^[a-z_]+$/.test(kind)) return json({ ok: false, error: 'bad_kind' }, 400);
    const id = 'aj' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await setState('agentkit_job_' + id, { id, kind, args: (r.args && typeof r.args === 'object') ? r.args : {}, by: 'api', status: 'queued', attempts: 0, created_at: new Date().toISOString() });
    return json({ ok: true, id });
  }
  if (body.payout_req) {
    /* v48: on-chain payout queue — desk enqueues into bridge_state; the local
       bulk_payout_worker executes via solworks_payout.cjs (owner-gated --live).
       kind 'sol': amount_each in lamports. kind 'spl': amount_each in raw base units. */
    const r = body.payout_req;
    const kind = String(r.kind || '') === 'spl' ? 'spl' : 'sol';
    const recipients: string[] = Array.isArray(r.recipients) ? r.recipients.map(String).slice(0, 200) : [];
    const amountEach = String(r.amount_each || '');
    const mint = kind === 'spl' ? String(r.mint || '') : '';
    const note = String(r.note || '').slice(0, 160);
    const okAddr = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
    if (!recipients.length || recipients.length > 200 || !recipients.every(okAddr)) return json({ ok: false, error: 'bad_recipients' }, 400);
    if (!/^\d+$/.test(amountEach) || BigInt(amountEach) <= 0n) return json({ ok: false, error: 'bad_amount' }, 400);
    if (kind === 'spl' && !okAddr(mint)) return json({ ok: false, error: 'bad_mint' }, 400);
    const id = 'pb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await setState('payout_batch_' + id, { id, kind, mint, recipients, amount_each: amountEach, note, status: 'queued', attempts: 0, created_at: new Date().toISOString() });
    return json({ ok: true, id, queued: recipients.length });
  }
  if (body.farm_req) { const r = body.farm_req; const res = await engineFarm(String(r.uid), String(r.op || 'status')); try { if (res.dm && String(r.op || '') !== 'status') await reply(String(r.uid), res.dm); } catch { /* no DM yet */ } return json(res); }
  if (body.lpdesk_harvest) { const r = body.lpdesk_harvest; return json(await engineLpdeskHarvest(String(r.tok), Number(r.earned), String(r.note || ''))); }
  const m = body.message;
  if (!m || typeof m.text !== 'string') return json({ ok: false, error: 'no message' });
  /* v51 fix: chatId/uid hoisted — the group branch below (sponsor visit comments,
     holder flare) used them before the const declarations → TDZ ReferenceError,
     silently swallowed by the catch, so visit-comment double pays never fired. */
  const chatId = m.chat.id;
  const uid = uidOf(m);
  /* v14: remember the last group chat so the bank/kill-points posts have an address */
  if (m.chat?.type && m.chat.type !== 'private') {
    try { await setState('desk_last_group', { id: m.chat.id }); } catch { /* best-effort */ }
    /* v21: keep the floor roster fresh for /rain + referrals */
    try { if (!m.from?.is_bot) await trackActivity(m); } catch { /* best-effort */ }
    /* v51: holder flare — LP Desk share holders get a 💎/🔥 reaction on chat messages */
    try { await maybeHolderFlare(m.chat.id, m, uidOf(m)); } catch { /* best-effort */ }
    /* v34: comment-verified sponsor visits — a substantive reply to today's sponsor thread
       pays double. Proof of attention AND group activity in one move. */
    try { if (!m.from?.is_bot && m.reply_to_message?.message_id) await maybeVisitComment(chatId, uid, m); } catch { /* best-effort */ }
    bankCycle(); // v14: self-triggered bank cycle — throttled internally to every 30 min
    try { maybeStreakPulse(); } catch { /* v43: daily streak board — day-guarded, decorative */ }
  }
  const dtext = m.text.trim();
  const parts = dtext.split(/\s+/);
  const dcmd = parts[0].split('@')[0].toLowerCase();

  if (dcmd === 'confirm' && parts[1]) {
    const pend: any = await getState('tip_pending');
    const p = pend[parts[1].toUpperCase()];
    if (!p || p.exp < Date.now()) { await reply(chatId, 'Unknown or expired confirmation code.'); return json({ ok: true }); }
    if (p.uid !== uid) { await reply(chatId, 'That confirmation belongs to another member.'); return json({ ok: true }); }
    delete pend[parts[1].toUpperCase()];
    await setState('tip_pending', pend);
    if (p.kind === 'withdraw') await execWithdraw(chatId, p);
    else if (p.kind === 'trade') await execTrade(chatId, p);
    else if (p.kind === 'ptip') await execPTip(chatId, p);
    else if (p.kind === 'ptake') await execPTake(chatId, p);
    return json({ ok: true, handled: 'confirm' });
  }

  if (!dtext.startsWith('/')) { await cmdChat(chatId, uid, m, dtext); return json({ ok: true, handled: 'chat' }); }

  switch (dcmd) {
    case '/start': await cmdStart(chatId, m); break;
    case '/desk':
    case '/menu': await cmdDesk(chatId, m); break;
    case '/deposit': await cmdDeposit(chatId); break;
    case '/credit': await cmdCredit(chatId, uid, parts); break;
    case '/balance': await cmdBalance(chatId, uid, m.from?.username); break;
    case '/link': await cmdLink(chatId, uid, parts); break;
    case '/unlink': await cmdUnlink(chatId, uid); break;
    case '/backup': await cmdBackup(chatId, uid, parts); break;
    case '/tip': await cmdTip(chatId, m, parts); break;
    case '/withdraw': await cmdWithdraw(chatId, uid, parts); break;
    case '/price': await cmdPrice(chatId, parts); break;
    case '/trade': await cmdTrade(chatId, uid, parts); break;
    case '/wallet': await cmdWallet(chatId, uid); break;
    case '/quote': await cmdQuote(chatId, parts); break;
    case '/offer': await cmdOffer(chatId, uid, m, parts); break;
    case '/offers': await cmdOffers(chatId); break;
    case '/take': await cmdTake(chatId, uid, parts); break;
    case '/bank': await cmdBank(chatId); break;
    case '/points': await cmdPoints(chatId, uid); break;
    case '/agentwallet': await cmdAgentWallet(chatId, parts); break;
    case '/launch': await cmdLaunch(chatId, uid, m, parts); break;
    case '/lp': await cmdLp(chatId); break;
    case '/pools': await cmdPools(chatId); break;
    case '/lpschool': await cmdLpSchool(chatId, parts); break;
    case '/revenue': await cmdRevenue(chatId); break;
    case '/vault': await cmdVault(chatId, uid, parts); break;
    case '/promo': await cmdPromo(chatId, uid, m, parts); break;
    /* v32/v36: Ad Rewards + Rich Ads — DM only */
    case '/ads': await cmdAds(chatId, m); break;
    case '/ad': await cmdAd(chatId, uid, m, parts); break;
    case '/adsponsor': await cmdAdsponsor(chatId, uid, m, parts); break;
    case '/adedit': await cmdAdedit(chatId, uid, m, parts); break;
    case '/adstop': await cmdAdstop(chatId, uid, m, parts); break;
    case '/adstats': await cmdAdstats(chatId, uid, m); break;
    /* v33: Scout Visits — DM only */
    case '/visit': await cmdVisit(chatId, uid, m, parts); break;
    case '/checkin': await cmdCheckin(chatId, uid, m); break;
    case '/boost': await cmdBoost(chatId, uid); break;
    case '/lpdesk': await cmdLpdesk(chatId, uid, m, parts); break;
    case '/fund': await cmdFund(chatId, uid, parts); break;
    case '/scouts': await cmdScouts(chatId); break;
    /* v50: The Farm — trading-desk miner (DM only) */
    case '/farm': await cmdFarm(chatId, uid, m, parts); break;
    /* v49: agent-kit maintenance — rent sweep etc., queued for the local worker */
    case '/sweep': await cmdAgentkit(chatId, uid, 'sweep'); break;
    /* v21: Floor Engine */
    case '/rain': await cmdRain(chatId, m, parts); break;
    /* v51: Holder Layer — bank-funded ZK rain to LP share holders (admin only) */
    case '/zrain': await cmdZrain(chatId, uid, m, parts); break;
    case '/flip': await cmdFlip(chatId, uid, parts); break;
    case '/duel': await cmdDuel(chatId, m, uid, parts); break;
    case '/watch': await cmdWatch(chatId, m, uid, parts); break;
    case '/watches': await cmdWatches(chatId, uid); break;
    case '/unwatch': await cmdUnwatch(chatId, uid); break;
    case '/ref': await cmdRef(chatId, m, uid); break;
    case '/refby': await cmdRefBy(chatId, m, uid, parts); break;
    case '/drop': await cmdDrop(chatId); break;
    default: return json({ ok: false, error: 'not a desk command' });
  }
  /* v54: backup nag — private chats only, never breaks the floor */
  if (!isGroup(m)) { try { await maybeBackupNag(uid); } catch { /* silent */ } }
  /* v28 funnel: promo groups (dynamic list, state 'promo_groups') -> rate-limited card to the main floor */
  try {
    const pg: any = await getState('promo_groups');
    const promoIds: number[] = Array.isArray(pg.ids) && pg.ids.length ? pg.ids : [PROMO_GROUP_ID];
    if (isGroup(m) && promoIds.includes(m.chat?.id)) {
      const f: any = await getState('promo_funnel');
      if ((f.ts || 0) < Date.now() - 30 * 60e3) {
        await setState('promo_funnel', { ts: Date.now() });
        await reply(chatId, `⚡ This is the outreach room — the main floor is where the desk runs live: launches, flips, duels, price calls, the vault.\n<b>SMARTZ SYNDICATE HQ → ${MAIN_GROUP_LINK}</b>\nOne tap, you're in.`);
      }
    }
  } catch { /* funnel best-effort */ }
  return json({ ok: true, handled: dcmd });
});
