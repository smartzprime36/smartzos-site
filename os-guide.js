/* ============================================================
 * SmartzOS — os-guide.js (v5.34: Orientation Pack)
 * 1) 'NEW HERE? 1-2-3' deck card (#ogStart) — first card in the deck grid
 * 2) First-run 'START HERE' dock chip (<=1024px, mobile only)
 * 3) Lock screen one-liner under the tap line
 * Pure injection — never edits os-deck / os-dock / os-launcher internals.
 * ============================================================ */
(function () {
  'use strict';

  function safe(fn) { try { return fn(); } catch (e) { if (window.console && console.warn) console.warn('[guide]', e); } }
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var mq1024 = window.matchMedia('(max-width:1024px)');
  function isDockWidth() { return safe(function () { return mq1024.matches; }) || false; }

  /* ---------- shared state reads (mirrors os-dock.js / os-path.js) ---------- */
  function walletConnected() {
    var ok = false;
    // index.html declares `let walletKey` (script-global) while os-wallet sets window.walletKey — read both
    try { ok = !!(window.walletKey || (typeof walletKey !== 'undefined' && walletKey)); } catch (e) { try { ok = !!window.walletKey; } catch (e2) {} }
    return ok;
  }
  function tunnelCleared() {
    var ok = false;
    try { ok = !!(window.SMARTZ_STATE && SMARTZ_STATE.tunnelCleared); } catch (e) {}
    if (!ok) {
      // same detection os-path.js uses for its 'tunnel' step
      try {
        ok = !!lsGet('smartz_tunnel');
        if (!ok) { var g = JSON.parse(lsGet('smartz_game_v1') || '{}'); ok = !!g.cleared; }
      } catch (e) {}
    }
    return ok;
  }
  function pathProgress() {
    var n = 0;
    try { if (window.PATH && typeof PATH.progress === 'function') return PATH.progress() || 0; } catch (e) {}
    // fallback: count the first two steps from localStorage if PATH isn't loaded
    try { if (walletConnected()) n++; if (tunnelCleared()) n++; } catch (e) {}
    return n;
  }
  function goApp(app) {
    safe(function () { if (typeof window.openApp === 'function') window.openApp(app); });
  }

  /* ============================================================
   * Feature 1 — NEW HERE? 1-2-3 deck card (#ogStart)
   * ============================================================ */
  var STEPS = [
    { n: '①', label: '⚡ Assess Coherence', why: 'connect a wallet so the OS can read your rank', app: 'swap', connect: true },
    { n: '②', label: '🌀 Enter the Tunnel', why: 'clear 5 stages, zero risk, first credits', app: 'game' },
    { n: '③', label: '🧭 Walk The Path', why: '12 guided steps from wallet to Architect', app: 'path' }
  ];
  function stepDone(i) {
    if (i === 0) return walletConnected();
    if (i === 1) return tunnelCleared();
    return pathProgress() > 0;
  }

  function renderStartCard() {
    safe(function () {
      var card = $('ogStart');
      if (!card) return;
      var done = [stepDone(0), stepDone(1), stepDone(2)];
      /* auto-collapse: steps 1+2 done → slim row, never fully disappears */
      if (done[0] && done[1]) {
        card.classList.add('og-slim');
        card.innerHTML = '<button class="og-slim-btn" type="button" id="ogSlimGo">✅ Onboarded — The Path continues →</button>';
        var slim = $('ogSlimGo');
        if (slim) slim.onclick = function () { goApp('path'); };
        return;
      }
      card.classList.remove('og-slim');
      var nextIdx = -1;
      for (var i = 0; i < 3; i++) { if (!done[i]) { nextIdx = i; break; } }
      var h = '<h5>🧭 NEW HERE? START IN ORDER</h5>' +
        '<div class="og-sub">the 10-minute path every Syndicate member takes</div>';
      STEPS.forEach(function (s, i) {
        h += '<div class="og-row' + (done[i] ? ' og-done' : '') + (i === nextIdx ? ' og-next' : '') + '">' +
          '<span class="og-chip">' + (done[i] ? '✓' : s.n) + '</span>' +
          '<span class="og-txt"><span class="og-label">' + s.label + '</span>' +
          '<span class="og-why">' + s.why + '</span></span>' +
          '<button class="og-go" type="button" data-og="' + i + '">GO</button></div>';
      });
      card.innerHTML = h;
      Array.prototype.forEach.call(card.querySelectorAll('.og-go'), function (b) {
        b.addEventListener('click', function () {
          var i = +b.getAttribute('data-og');
          safe(function () {
            if (STEPS[i].connect && typeof window.connectWallet === 'function') window.connectWallet();
            else goApp(STEPS[i].app);
          });
        });
      });
    });
  }

  function injectStartCard() {
    var tries = 0;
    (function attempt() {
      if ($('ogStart')) { renderStartCard(); return; }
      if (++tries > 24) return; /* ~12s of retries */
      safe(function () {
        var grid = document.querySelector('#win-deck .deck-grid');
        if (grid) {
          var c = document.createElement('div');
          c.className = 'dcard span12 og-card';
          c.id = 'ogStart';
          grid.insertBefore(c, grid.firstChild); /* before #nextCard */
          renderStartCard();
        }
      });
      if (!$('ogStart')) setTimeout(attempt, 500);
    })();
  }

  /* ============================================================
   * Feature 2 — first-run 'START HERE' dock chip (<=1024px)
   * ============================================================ */
  function isNewcomer() {
    var fresh = false;
    try { fresh = !lsGet('smartz_shell_v1') || pathProgress() === 0; } catch (e) {}
    return fresh;
  }
  function chipAllowed() {
    return isNewcomer() && !tunnelCleared() && lsGet('og_startchip_off') !== '1';
  }
  function removeChip() {
    safe(function () { var c = document.querySelector('.sd-item.og-startchip'); if (c) c.remove(); });
  }
  function injectChip() {
    safe(function () {
      if (!isDockWidth()) { removeChip(); return; } /* desktop: no chip */
      if (!chipAllowed()) { removeChip(); return; }
      var items = document.querySelector('#syndicateDock .sd-items');
      if (!items) return; /* retried by the 5s sweep */
      if (items.querySelector('.og-startchip')) return;
      var b = document.createElement('div');
      b.className = 'sd-item og-startchip';
      b.setAttribute('data-app', 'game');
      b.innerHTML = '<span class="sd-ic">🌀</span><span class="sd-lb">Start</span>';
      b.addEventListener('click', function () { goApp('game'); });
      /* dismissal: double-tap or long-press hides the chip permanently */
      b.addEventListener('dblclick', function () { lsSet('og_startchip_off', '1'); removeChip(); });
      var lpTimer = null;
      b.addEventListener('touchstart', function () {
        lpTimer = setTimeout(function () { lpTimer = null; lsSet('og_startchip_off', '1'); removeChip(); }, 650);
      }, { passive: true });
      ['touchend', 'touchcancel', 'touchmove'].forEach(function (ev) {
        b.addEventListener(ev, function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });
      });
      items.insertBefore(b, items.firstChild);
    });
  }

  /* ============================================================
   * Feature 3 — lock screen one-liner
   * ============================================================ */
  function injectLockSub() {
    var tries = 0;
    (function attempt() {
      if ($('ogLockSub')) return;
      if (++tries > 20) return; /* ~10s of retries */
      safe(function () {
        var tap = document.querySelector('#lockScreen .lk-enter'); /* pure text node built by os-launcher */
        if (tap) {
          var d = document.createElement('div');
          d.className = 'og-lock-sub';
          d.id = 'ogLockSub';
          d.textContent = 'SmartzOS — the Smart Triad ecosystem: trade, learn, earn in one browser OS.';
          tap.parentNode.insertBefore(d, tap.nextSibling);
        }
      });
      if (!$('ogLockSub')) setTimeout(attempt, 500);
    })();
  }

  /* ---------- boot ---------- */
  function boot() {
    safe(injectStartCard);
    safe(injectChip);
    safe(injectLockSub);
    /* periodic re-evaluation: step states, chip lifecycle, card collapse */
    setInterval(function () {
      safe(renderStartCard);
      safe(function () {
        if (isDockWidth() && chipAllowed()) injectChip();
        else removeChip(); /* gone permanently once tunnel cleared (or dismissed) */
      });
    }, 5000);
    /* media change: chip is mobile-only */
    safe(function () {
      var onCh = function () { safe(injectChip); };
      if (mq1024.addEventListener) mq1024.addEventListener('change', onCh);
      else if (mq1024.addListener) mq1024.addListener(onCh);
    });
  }
  function deferred() { setTimeout(function () { safe(boot); }, 1900); }
  if (document.readyState === 'complete') deferred();
  else window.addEventListener('load', deferred);
})();
