/* ============================================================
 * SmartzOS — os-daily.js (Track 2: Daily Engagement Mechanics)
 * Login streak, daily missions, run cap, status rail UI.
 * Self-contained vanilla JS. Defensive: never break host.
 * ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'smartz_daily_v1';
  var GAME_KEY = 'smartz_game_v1';
  var FREE_RUNS = 5;
  var EXTRA_COST = 20;

  function safe(fn) { try { return fn(); } catch (e) { if (window.console && console.warn) console.warn('[daily]', e); } }
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function note(t, m, ty) { try { if (typeof window.notify === 'function') window.notify(t, m, ty || 'info'); } catch (e) {} }
  function bus(ev, data) { try { if (window.SMARTZ_BUS && typeof window.SMARTZ_BUS.emit === 'function') window.SMARTZ_BUS.emit(ev, data); } catch (e) {} }

  /* ---------- day helpers ---------- */
  function dayKey(d) {
    var x = d || new Date();
    return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2);
  }
  function yesterdayKey() { return dayKey(new Date(Date.now() - 864e5)); }

  /* ---------- state ---------- */
  function blank() {
    return { streak: { count: 0, last: '', freezes: 0, notifiedDay: '' }, missions: { day: '', drawn: [], done: [], claimedBonus: false }, runs: { day: '', used: 0, extra: 0 }, cosmetics: [], voiceSeen: {}, prev: null };
  }
  function load() {
    try {
      var raw = lsGet(LS_KEY);
      if (!raw) return blank();
      var s = JSON.parse(raw);
      var b = blank();
      for (var k in b) if (!(k in s)) s[k] = b[k];
      s.streak = s.streak || b.streak; s.missions = s.missions || b.missions; s.runs = s.runs || b.runs;
      s.cosmetics = s.cosmetics || []; s.voiceSeen = s.voiceSeen || {};
      return s;
    } catch (e) { return blank(); }
  }
  var S = load();
  function save() { lsSet(LS_KEY, JSON.stringify(S)); }

  /* ---------- game snapshot ---------- */
  function gameSnap() {
    try {
      var g = null;
      try { if (typeof G !== 'undefined' && G) g = G; } catch (e) {}
      if (!g && window.G) g = window.G;
      if (!g) { var raw = lsGet(GAME_KEY); if (raw) g = JSON.parse(raw); }
      if (!g) return null;
      return { credits: g.credits | 0, runs: g.runs | 0, artifacts: g.artifacts | 0, inv: JSON.parse(JSON.stringify(g.inv || {})), prices: JSON.parse(JSON.stringify(g.prices || {})) };
    } catch (e) { return null; }
  }
  function grant(n) {
    safe(function () {
      var done = false;
      try { if (typeof G !== 'undefined' && G) { G.credits += n; done = true; } } catch (e) {}
      if (!done && window.G) { window.G.credits += n; done = true; }
      if (typeof window.saveGame === 'function') window.saveGame();
      if (typeof window.renderGame === 'function') window.renderGame();
      if (!done) {
        var raw = lsGet(GAME_KEY);
        if (raw) { var g = JSON.parse(raw); g.credits = (g.credits | 0) + n; lsSet(GAME_KEY, JSON.stringify(g)); }
      }
    });
  }
  function invTotal(inv) { var t = 0; for (var k in (inv || {})) t += inv[k] | 0; return t; }

  /* ---------- seeded PRNG ---------- */
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- voice lines ---------- */
  var VOICE = {
    KODA: ['The perimeter holds. Day N banked.', 'Shield steady. Another cycle survived.', 'I watch the walls so you can build. N days strong.', 'Nothing gets past me. Streak secured.'],
    TAURON: ['Blade sharp, streak sharper. Day N falls to us.', 'Another day claimed by force. Onward.', 'I cut through the noise — day N is ours.', 'Discipline is a weapon. You wield it daily.'],
    ZORAN: ['Coherence achieved. Day N aligns with the pattern.', 'Calm minds compound. Your streak confirms the model.', 'Order emerges from repetition. Day N noted.', 'The ledger of days balances in your favor.'],
    SYLK: ['The pattern repeats — day N woven into the weave.', 'I traced the thread. It loops back stronger each day.', 'Signals align. Your rhythm matches the shard song.', 'A motif emerges: you, returning. Day N complete.']
  };
  function voiceLine(agent, n) {
    return safe(function () {
      var lines = VOICE[agent] || VOICE.KODA;
      var last = S.voiceSeen[agent];
      var i;
      do { i = Math.floor(Math.random() * lines.length); } while (lines.length > 1 && i === last);
      S.voiceSeen[agent] = i; save();
      return agent + '-7 · ' + lines[i].replace(/N/g, String(n));
    }) || '';
  }
  function voiceFor(cat, n) {
    var map = { run: 'TAURON', eco: 'KODA', lore: 'ZORAN', streak: 'ZORAN', freeze: 'KODA', bonus: 'SYLK' };
    var line = voiceLine(map[cat] || 'SYLK', n);
    if (line) note('◈ ' + (map[cat] || 'SYLK'), line, 'info');
  }

  /* ---------- streak ---------- */
  function streakReward(c) {
    if (c >= 21 && c % 7 === 0) return 150 + 50 * ((c - 21) / 7);
    if (c === 14) return 100;
    if (c >= 15) return 25;
    if (c >= 8) return 20;
    if (c === 7) return 50;
    if (c >= 4) return 15;
    return 10;
  }
  function nextMilestone(c) {
    var ms = [7, 14, 21, 28, 35];
    for (var i = 0; i < ms.length; i++) if (ms[i] > c) return ms[i];
    return c + (7 - (c % 7));
  }
  function evalStreak() {
    safe(function () {
      var today = dayKey(), yest = yesterdayKey(), st = S.streak;
      if (st.last === today) return;
      var frozen = false;
      if (st.last === yest) { st.count = (st.count | 0) + 1; }
      else if (st.last && st.last < yest) {
        if ((st.freezes | 0) > 0) { st.freezes--; frozen = true; }
        else st.count = 1;
      } else st.count = 1;
      st.last = today;
      if (st.count === 7 || st.count === 14) st.freezes = Math.min(2, (st.freezes | 0) + 1);
      var r = streakReward(st.count);
      grant(r);
      if (st.count === 14 && S.cosmetics.indexOf('sanctum-title') < 0) S.cosmetics.push('sanctum-title');
      completeMission('streak-claim', true);
      if (st.notifiedDay !== today) {
        st.notifiedDay = today;
        note('🔥 Streak Day ' + st.count, '+' + r + ' SMC banked' + (st.count === 14 ? ' · Sanctum title unlocked' : '') + (st.count === 7 || st.count === 14 ? ' · +1 streak freeze' : ''), 'gold');
        voiceFor('streak', st.count);
      }
      if (frozen) { note('❄ Streak Freeze Consumed', 'A missed day was forgiven — streak intact.', 'warn'); voiceFor('freeze', st.count); }
      save();
      bus('daily.streak', { count: st.count, reward: r, frozen: frozen });
    });
  }

  /* ---------- missions ---------- */
  var MISSIONS = [
    { id: 'run1', cat: 'run', t: 'Clear 1 Tunnel Run', d: 'Complete a Liquidity Tunnel run.', xp: 25, check: function (p, c) { return c.runs > p.runs; } },
    { id: 'run2', cat: 'run', t: 'Clear 2 Tunnel Runs', d: 'Complete two Liquidity Tunnel runs.', xp: 30, check: function (p, c) { return c.runs >= p.runs + 2; } },
    { id: 'survive', cat: 'run', t: 'Integrity Intact', d: 'Finish a run without losing credits.', xp: 25, check: function (p, c) { return c.runs > p.runs && c.credits >= p.credits; } },
    { id: 'trade2', cat: 'eco', t: 'Trade 2 Shards', d: 'Move 2+ shards through the Trading Post.', xp: 20, check: function (p, c) { return Math.abs(invTotal(c.inv) - invTotal(p.inv)) >= 2; } },
    { id: 'fuse1', cat: 'eco', t: 'Fuse 1 Artifact', d: 'Fuse an artifact in the Fusion Lab.', xp: 25, check: function (p, c) { return c.artifacts > p.artifacts; } },
    { id: 'hold-koda', cat: 'eco', t: 'Hold a Koda Shard', d: 'Keep a Koda shard through a price cycle.', xp: 15, check: function (p, c) { return (p.inv.koda | 0) > 0 && (c.inv.koda | 0) > 0 && p.prices.koda !== c.prices.koda; } },
    { id: 'earn100', cat: 'eco', t: 'Earn 100 Credits', d: 'Gain 100+ credits today.', xp: 30, check: function (p, c) { return c.credits - p.credits >= 100; } },
    { id: 'buy1', cat: 'eco', t: 'Buy Any Shard', d: 'Purchase a shard at the Post.', xp: 15, check: function (p, c) { return invTotal(c.inv) > invTotal(p.inv); } },
    { id: 'feed', cat: 'lore', t: 'Sanctum Feed Briefing', d: 'Read this week\u2019s Sanctum briefing.', xp: 15, check: null, manual: true },
    { id: 'resonance', cat: 'lore', t: 'RESONANCE Transmission', d: 'Attune to a RESONANCE transmission.', xp: 15, check: null, manual: true },
    { id: 'deck-check', cat: 'lore', t: 'Open the Command Deck', d: 'Visit the Command Deck.', xp: 15, check: null, app: 'deck' },
    { id: 'vault-check', cat: 'lore', t: 'Check the Token Vault', d: 'Inspect the Token Vault.', xp: 15, check: null, app: 'vault' },
    { id: 'academy', cat: 'lore', t: 'Open Smartz Academy', d: 'Pay the Academy a visit.', xp: 15, check: null, app: 'academy' },
    { id: 'streak-claim', cat: 'lore', t: 'Claim Login Streak', d: 'Claim today\u2019s login streak reward.', xp: 20, check: null, auto: true }
  ];
  function missionById(id) { for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i]; return null; }

  function drawMissions() {
    safe(function () {
      var today = dayKey();
      if (S.missions.day === today && S.missions.drawn.length === 3) return;
      var rng = mulberry32(hashStr('smartz-daily-' + today));
      var ids = MISSIONS.map(function (m) { return m.id; });
      var drawn = [];
      while (drawn.length < 3 && ids.length) drawn.push(ids.splice(Math.floor(rng() * ids.length), 1)[0]);
      S.missions = { day: today, drawn: drawn, done: [], claimedBonus: false };
      S.prev = gameSnap();
      save();
    });
  }
  function completeMission(id, silent) {
    safe(function () {
      if (S.missions.drawn.indexOf(id) < 0 || S.missions.done.indexOf(id) >= 0) return;
      var m = missionById(id);
      if (!m) return;
      S.missions.done.push(id);
      grant(m.xp);
      if (!silent) { note('✅ Mission Complete', m.t + ' — +' + m.xp + ' SMC', 'gold'); voiceFor(m.cat, S.missions.done.length); }
      if (S.missions.done.length === 3 && !S.missions.claimedBonus) {
        S.missions.claimedBonus = true;
        grant(25);
        note('🌟 Daily Triad Complete', 'All 3 missions done — +25 SMC bonus.', 'gold');
        voiceFor('bonus', S.streak.count);
      }
      save();
      bus('daily.mission', { id: id, done: S.missions.done.slice() });
      renderRail(); renderPop();
    });
  }
  function pollMissions() {
    safe(function () {
      var cur = gameSnap();
      if (!cur) return;
      var prev = S.prev || cur;
      S.missions.drawn.forEach(function (id) {
        if (S.missions.done.indexOf(id) >= 0) return;
        var m = missionById(id);
        if (m && typeof m.check === 'function' && safe(function () { return m.check(prev, cur); })) completeMission(id);
      });
      S.prev = cur; save();
    });
  }
  function wrapOpenApp() {
    var tries = 0;
    (function attempt() {
      safe(function () {
        if (typeof window.openApp !== 'function') { if (++tries < 20) setTimeout(attempt, 500); return; }
        if (window.openApp.__dailyWrapped) return;
        var orig = window.openApp;
        var wrapped = function (id) {
          safe(function () {
            ['deck', 'vault', 'academy'].forEach(function (app) {
              // academy mission id is plain 'academy'; deck/vault use '-check' suffix
              var mid = app === 'academy' ? 'academy' : app + '-check';
              if (id === app && S.missions.drawn.indexOf(mid) >= 0) completeMission(mid);
            });
          });
          return orig.apply(this, arguments);
        };
        wrapped.__dailyWrapped = true;
        window.openApp = wrapped;
      });
      if (typeof window.openApp !== 'function' && ++tries < 20) setTimeout(attempt, 500);
    })();
  }

  /* ---------- run cap ---------- */
  function resetRuns() {
    safe(function () {
      var today = dayKey();
      if (S.runs.day !== today) { S.runs = { day: today, used: 0, extra: 0 }; save(); }
    });
  }
  function runsRemaining() { return Math.max(0, FREE_RUNS - (S.runs.used | 0)) + (S.runs.extra | 0); }
  function buyExtra() {
    safe(function () {
      var cur = gameSnap();
      if (!cur || cur.credits < EXTRA_COST) { note('⚠ Not Enough Credits', 'You need ' + EXTRA_COST + ' SMC for an extra run.', 'warn'); return; }
      grant(-EXTRA_COST);
      S.runs.extra = (S.runs.extra | 0) + 1;
      save();
      note('🌀 Extra Run Purchased', '-20 SMC · one more tunnel run unlocked.', 'gold');
      renderRail(); renderPop();
    });
  }
  function wrapStartRun() {
    var tries = 0;
    (function attempt() {
      safe(function () {
        if (typeof window.startRun !== 'function') { if (++tries < 20) setTimeout(attempt, 500); return; }
        if (window.startRun.__dailyWrapped) return;
        var orig = window.startRun;
        var wrapped = function () {
          try {
            resetRuns();
            if (runsRemaining() <= 0) {
              note('🌀 Tunnel Runs Depleted', '5 free runs/day — buy an extra run for 20 credits', 'warn');
              renderPop(); openPop();
              return;
            }
            if (FREE_RUNS - S.runs.used > 0) S.runs.used++;
            else if (S.runs.extra > 0) { S.runs.extra--; S.runs.used++; }
            save();
            renderRail();
          } catch (e) {}
          return orig.apply(this, arguments);
        };
        wrapped.__dailyWrapped = true;
        window.startRun = wrapped;
      });
      if (typeof window.startRun !== 'function' && ++tries < 20) setTimeout(attempt, 500);
    })();
  }

  /* ---------- gameTab modal continuity ---------- */
  function wrapGameTab() {
    var tries = 0;
    (function attempt() {
      safe(function () {
        if (typeof window.gameTab !== 'function') { if (++tries < 20) setTimeout(attempt, 500); return; }
        if (window.gameTab.__dailyWrapped) return;
        var orig = window.gameTab;
        var wrapped = function (t) {
          var r = orig.apply(this, arguments);
          safe(function () {
            var pane = $('pane-' + t);
            if (pane) { pane.classList.remove('dl-pane-in'); void pane.offsetWidth; pane.classList.add('dl-pane-in'); }
          });
          return r;
        };
        wrapped.__dailyWrapped = true;
        window.gameTab = wrapped;
      });
      if (typeof window.gameTab !== 'function' && ++tries < 20) setTimeout(attempt, 500);
    })();
  }

  /* ---------- status rail UI ---------- */
  var rail = null, pop = null;
  function pips(n, total, full, empty) {
    var s = '';
    for (var i = 0; i < total; i++) s += i < n ? full : empty;
    return s;
  }
  function renderRail() {
    safe(function () {
      if (!rail) return;
      var done = S.missions.done.length;
      var st = S.streak;
      var html =
        '<span class="dl-chip dl-c-streak" title="Login streak">🔥 ' + (st.count | 0) + (st.freezes > 0 ? ' <i class="dl-frz">❄×' + st.freezes + '</i>' : '') + '</span>' +
        '<span class="dl-chip dl-c-mis" title="Daily missions">' + pips(done, 3, '●', '○') + ' ' + done + '/3</span>' +
        '<span class="dl-chip dl-c-runs" title="Tunnel runs left">' + pips(runsRemaining(), FREE_RUNS, '▮', '▯') + '</span>' +
        (done === 3 ? '<span class="dl-chip dl-c-bonus">🌟</span>' : '') +
        '<span class="dl-glyph g1">🛡</span><span class="dl-glyph g2">⚔</span><span class="dl-glyph g3">◈</span>';
      rail.innerHTML = html;
      var rc = $('rankChip');
      if (rc) {
        var near = nextMilestone(st.count) - st.count <= 2;
        rc.classList.toggle('dl-pulse', near);
      }
    });
  }
  function renderPop() {
    safe(function () {
      if (!pop) return;
      var h = '<div class="dl-pop-h">◈ Daily Rhythm — ' + dayKey() + ' (UTC)<span class="dl-pop-x" id="dlPopX">✕</span></div>';
      h += '<div class="dl-sec"><b>Missions</b>';
      S.missions.drawn.forEach(function (id) {
        var m = missionById(id);
        if (!m) return;
        var done = S.missions.done.indexOf(id) >= 0;
        h += '<div class="dl-mi' + (done ? ' done' : '') + '"><span class="dl-mi-t">' + (done ? '✅' : '▫') + ' ' + m.t + '</span>' +
          '<span class="dl-mi-d">' + m.d + '</span><span class="dl-mi-x">+' + m.xp + 'cr</span>';
        if (!done && id === 'feed') h += '<button class="dl-btn" data-dl-m="feed">📜 Mark read</button>';
        if (!done && id === 'resonance') h += '<button class="dl-btn" data-dl-m="resonance">⚡ Attune</button>';
        h += '</div>';
      });
      if (S.missions.claimedBonus) h += '<div class="dl-bonus-row">🌟 Triad bonus claimed (+25cr)</div>';
      h += '</div>';
      var st = S.streak, nm = nextMilestone(st.count);
      h += '<div class="dl-sec"><b>Streak Board</b>' +
        '<div class="dl-row">Day <b>' + (st.count | 0) + '</b> · next milestone: day ' + nm + ' (+' + streakReward(nm) + 'cr) · freezes banked: ❄×' + (st.freezes | 0) + '</div>' +
        '<div class="dl-hint">d1-3:10 · d4-6:15 · d7:50+❄ · d8-13:20 · d14:100+title+❄ · d15+:25 · every 7th past 21: spike</div></div>';
      h += '<div class="dl-sec"><b>Tunnel Runs</b><div class="dl-row">' + runsRemaining() + ' remaining (' + FREE_RUNS + ' free/day' + (S.runs.extra ? ' · +' + S.runs.extra + ' extra' : '') + ')</div>';
      if (runsRemaining() <= 0) h += '<button class="dl-btn dl-buy" id="dlBuyRun">🌀 Buy extra run (20cr)</button>';
      h += '</div>';
      pop.innerHTML = h;
      var x = $('dlPopX'); if (x) x.onclick = function () { pop.classList.remove('open'); };
      var buy = $('dlBuyRun'); if (buy) buy.onclick = function () { buyExtra(); };
      Array.prototype.forEach.call(pop.querySelectorAll('[data-dl-m]'), function (b) {
        b.onclick = function () { completeMission(b.getAttribute('data-dl-m')); };
      });
    });
  }
  function openPop() { safe(function () { if (pop) { renderPop(); pop.classList.add('open'); } }); }
  function buildUI() {
    safe(function () {
      if ($('dailyRail')) return;
      rail = el('div', '', ''); rail.id = 'dailyRail';
      pop = el('div', '', ''); pop.id = 'dailyPop';
      document.body.appendChild(rail);
      document.body.appendChild(pop);
      rail.onclick = function () { safe(function () { if (pop.classList.contains('open')) pop.classList.remove('open'); else openPop(); }); };
      renderRail();
      setInterval(function () { safe(renderRail); }, 15000);
    });
  }

  /* ---------- time-of-day skin ---------- */
  function skinDay() {
    safe(function () {
      var h = (Date.now() % 864e5) / 36e5;
      var c = h < 6 ? 'dl-day-fresh' : h < 16 ? 'dl-day-mid' : 'dl-day-late';
      document.body.classList.remove('dl-day-fresh', 'dl-day-mid', 'dl-day-late');
      document.body.classList.add(c);
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    safe(resetRuns);
    safe(drawMissions);
    safe(evalStreak);
    safe(buildUI);
    safe(skinDay);
    safe(wrapOpenApp);
    safe(wrapStartRun);
    safe(wrapGameTab);
    setInterval(function () { safe(pollMissions); }, 3000);
    setInterval(skinDay, 600000);
  }
  function deferred() { setTimeout(boot, 1500); }
  if (document.readyState === 'complete') deferred();
  else window.addEventListener('load', deferred);
})();
