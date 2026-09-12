/* ============================================================
 * SmartzOS — os-dock.js (Stage 0: Syndicate Shell)
 * Nav dock (<=1024px), single dynamic deck CTA, mobile bottom
 * sheets (<=768px), viewport hardening. Defensive: never break host.
 * ============================================================ */
(function () {
  'use strict';

  function safe(fn) { try { return fn(); } catch (e) { if (window.console && console.warn) console.warn('[dock]', e); } }
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }

  var mq768 = window.matchMedia('(max-width:768px)');
  var mq1024 = window.matchMedia('(max-width:1024px)');
  function isSheet() { return safe(function () { return mq768.matches; }) || false; }
  function isDock() { return safe(function () { return mq1024.matches; }) || false; }

  /* ---------- Feature 1: nav dock ---------- */
  var ENTRIES = [
    { icon: '⚡', label: 'Swap', app: 'swap' },
    { icon: '🪙', label: 'Vault', app: 'vault' },
    { icon: '👥', label: 'Sanctum', app: 'members' },
    { icon: '🌀', label: 'Tunnel', app: 'game' },
    { icon: '🎯', label: 'Missions', app: 'missions' },
    { icon: '⚙️', label: 'Settings', app: 'settings' }
  ];
  var dock = null, railSlot = null, backdrop = null;

  function buildDock() {
    safe(function () {
      if ($('syndicateDock')) { dock = $('syndicateDock'); return; }
      dock = document.createElement('div');
      dock.id = 'syndicateDock';
      railSlot = document.createElement('div');
      railSlot.className = 'sd-rail-slot';
      var items = document.createElement('div');
      items.className = 'sd-items';
      ENTRIES.forEach(function (en) {
        var b = document.createElement('div');
        b.className = 'sd-item';
        b.setAttribute('data-app', en.app);
        b.innerHTML = '<span class="sd-ic">' + en.icon + '</span><span class="sd-lb">' + en.label + '</span>';
        b.addEventListener('click', function () {
          safe(function () { if (typeof window.openApp === 'function') window.openApp(en.app); });
        });
        items.appendChild(b);
      });
      dock.appendChild(railSlot);
      dock.appendChild(items);
      document.body.appendChild(dock);
    });
  }

  /* active-state refresh — runs in a timer, never inside the observer callback */
  function refreshActive() {
    safe(function () {
      if (!dock) return;
      Array.prototype.forEach.call(dock.querySelectorAll('.sd-item'), function (b) {
        var w = $('win-' + b.getAttribute('data-app'));
        b.classList.toggle('on', !!(w && w.classList.contains('open')));
      });
    });
    refreshBackdrop();
  }

  var refreshTimer = null;
  function scheduleRefresh() {
    /* read-only: only schedules work, so the MutationObserver callback never
       mutates DOM (avoids observer-loop bugs) */
    if (refreshTimer) return;
    refreshTimer = setTimeout(function () { refreshTimer = null; refreshActive(); }, 150);
  }

  function watchWindows() {
    safe(function () {
      if (!window.MutationObserver) return;
      var mo = new MutationObserver(function (muts) {
        var hit = false;
        for (var i = 0; i < muts.length && !hit; i++) {
          var t = muts[i].target;
          if (t && t.classList && t.classList.contains('win')) hit = true;
        }
        if (hit) scheduleRefresh();
      });
      mo.observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- rail relocation (<=768px: chip moves into the dock) ---------- */
  function relocateRail() {
    safe(function () {
      var rail = $('dailyRail');
      if (!rail || !dock || !railSlot) return;
      if (isSheet()) {
        if (rail.parentNode !== railSlot) railSlot.appendChild(rail);
      } else if (rail.parentNode !== document.body) {
        document.body.appendChild(rail);
      }
    });
  }

  /* ---------- body mode classes ---------- */
  function syncMode() {
    safe(function () {
      document.body.classList.toggle('sd-dock', isDock());
      document.body.classList.toggle('sd-sheet', isSheet());
      // small screens: never let the buddy panel auto-cover the sheet/CTA surface
      // v5.34: but NEVER kill ZO's first-run welcome card — it is the best orientation surface on mobile
      var zwelcomed = false; try { zwelcomed = !!localStorage.getItem('smartz_zoran_welcomed_v1'); } catch (e) {}
      if (isSheet() && zwelcomed) { var bp = document.getElementById('buddyPanel'); if (bp && bp.classList.contains('open') && !bp.querySelector('.zo-welcome')) bp.classList.remove('open'); }
      relocateRail();
      scheduleRefresh();
    });
  }
  function onMedia(fn) {
    safe(function () {
      if (mq768.addEventListener) mq768.addEventListener('change', fn);
      else if (mq768.addListener) mq768.addListener(fn);
      if (mq1024.addEventListener) mq1024.addEventListener('change', fn);
      else if (mq1024.addListener) mq1024.addListener(fn);
    });
  }

  /* ---------- Feature 2: single dynamic CTA ---------- */
  function ctaState() {
    var connected = false;
    // index.html declares `let walletKey` (script-global, NOT on window) while os-wallet sets window.walletKey — read both
    try { connected = !!(window.walletKey || (typeof walletKey !== 'undefined' && walletKey)); } catch (e) { try { connected = !!window.walletKey; } catch (e2) {} }
    if (!connected) {
      return { label: '⚡ Assess Coherence', sub: 'connect to verify rank', act: 'connect' };
    }
    return { label: '🌀 Enter Tunnel', sub: 'the Liquidity Tunnel awaits', act: 'tunnel' };
  }

  function renderCta() {
    safe(function () {
      var cta = $('sdCta');
      if (!cta) return;
      var st = ctaState();
      cta.innerHTML = '<span class="sd-main">' + st.label + '</span><span class="sd-sub">' + st.sub + '</span>';
      cta.onclick = function () {
        safe(function () {
          if (st.act === 'connect') {
            if (typeof window.connectWallet === 'function') window.connectWallet();
          } else if (typeof window.openApp === 'function') window.openApp('game');
        });
      };
    });
  }

  function injectCta() {
    var tries = 0;
    (function attempt() {
      if ($('sdCta')) return;
      if (++tries > 24) return; /* ~12s of retries */
      safe(function () {
        var hero = document.querySelector('#win-deck .deck-hero');
        if (hero) {
          var cta = document.createElement('button');
          cta.id = 'sdCta';
          cta.type = 'button';
          hero.appendChild(cta);
          renderCta();
        }
      });
      if (!$('sdCta')) setTimeout(attempt, 500);
    })();
  }

  function wrapConnect() {
    safe(function () {
      if (typeof window.connectWallet !== 'function' || window.connectWallet.__sdWrapped) return;
      var orig = window.connectWallet;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        safe(function () {
          if (r && typeof r.finally === 'function') r.finally(function () { renderCta(); });
          else setTimeout(renderCta, 800);
        });
        return r;
      };
      wrapped.__sdWrapped = true;
      window.connectWallet = wrapped;
    });
  }

  function subscribeBus() {
    safe(function () {
      var bus = window.SMARTZ_BUS;
      if (!bus || typeof bus.on !== 'function') return;
      ['build.ship', 'rank', 'wallet'].forEach(function (ev) {
        safe(function () { bus.on(ev, function () { renderCta(); }); });
      });
    });
  }

  /* ---------- Feature 3: mobile bottom sheets ---------- */
  function buildBackdrop() {
    safe(function () {
      if ($('sdBackdrop')) { backdrop = $('sdBackdrop'); return; }
      backdrop = document.createElement('div');
      backdrop.id = 'sdBackdrop';
      backdrop.addEventListener('click', function () {
        safe(function () {
          var open = document.querySelectorAll('.win.open');
          var top = null, z = -1;
          Array.prototype.forEach.call(open, function (w) {
            var wz = parseInt(window.getComputedStyle(w).zIndex, 10) || 0;
            if (wz >= z) { z = wz; top = w; }
          });
          if (top) top.classList.remove('open');
        });
      });
      document.body.appendChild(backdrop);
    });
  }

  function refreshBackdrop() {
    safe(function () {
      if (!backdrop) return;
      var any = isSheet() && !!document.querySelector('.win.open:not(.sd-nosheet)');
      backdrop.classList.toggle('on', any);
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    safe(buildDock);
    safe(buildBackdrop);
    safe(watchWindows);
    safe(wrapConnect);
    safe(subscribeBus);
    safe(injectCta);
    syncMode();
    onMedia(syncMode);
    window.addEventListener('resize', function () { safe(syncMode); });
    setTimeout(relocateRail, 2200); /* rail is built ~1.5s after load */
    setInterval(function () { safe(renderCta); }, 5000); /* fallback re-eval */
    setInterval(function () { safe(relocateRail); }, 5000); /* rail may rebuild */
    /* buddy panel may auto-open after boot on small screens — sweep it shut once the user is past first-run (never kill ZO's welcome) */
    [4000, 8000, 14000].forEach(function (ms) {
      setTimeout(function () {
        safe(function () {
          var zw = false; try { zw = !!localStorage.getItem('smartz_zoran_welcomed_v1'); } catch (e) {}
          if (isSheet() && zw) { var bp = document.getElementById('buddyPanel'); if (bp && bp.classList.contains('open') && !bp.querySelector('.zo-welcome')) bp.classList.remove('open'); }
        });
      }, ms);
    });
  }
  function deferred() { setTimeout(function () { safe(boot); }, 1800); }
  if (document.readyState === 'complete') deferred();
  else window.addEventListener('load', deferred);
})();
