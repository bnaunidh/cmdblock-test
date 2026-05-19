/* ── CMDBLOCK REDESIGN — Core App ─────────────────────────
 * Replaces the old app.js. Adds:
 *   · v1→v2 localStorage migration (carries existing users over)
 *   · Old role system (NOOBIE→OWNER, multi-role support, auto-promotion)
 *   · Smoother auth flow (inline validation, loading, success transition, welcome-back)
 *   · Confetti on signup success
 *   · Modal focus-trap + animated open/close
 * ────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── Maintenance mode ───────────────────────────────────
  // Set MAINTENANCE_UNTIL to an ISO timestamp to lock the site behind a
  // countdown overlay until that time. Set to '' to disable.
  // Examples:
  //   '2026-05-19T17:00:00-07:00'   ← 5:00 PM Pacific (PDT)
  //   '2026-12-01T17:00:00-08:00'   ← 5:00 PM Pacific (PST, winter)
  //   ''                            ← maintenance off, site loads normally
  const MAINTENANCE_UNTIL = '2026-05-19T17:00:00-07:00';
  const MAINTENANCE_LABEL = 'Returning May 19 · 5:00 PM PST';
  const MAINTENANCE_BLURB = "cmdblock.org is getting an upgrade. We'll be live again at 5:00 PM PST.";

  (function initMaintenance() {
    if (!MAINTENANCE_UNTIL) return;
    const until = new Date(MAINTENANCE_UNTIL);
    if (isNaN(+until) || until <= new Date()) return;

    const css = `
      html.cb-maint-on, html.cb-maint-on body { overflow: hidden !important; }
      #cb-maintenance {
        position: fixed; inset: 0; z-index: 2147483647;
        background: radial-gradient(ellipse at top, #0a1410 0%, #07080B 60%, #050608 100%);
        color: #E6E7EA;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        padding: 32px 24px; text-align: center; overflow: hidden;
        animation: cbMaintFade 0.5s ease-out;
      }
      @keyframes cbMaintFade { from { opacity: 0; } to { opacity: 1; } }
      #cb-maintenance::before {
        content: ''; position: absolute; inset: -40px;
        background-image:
          linear-gradient(rgba(85,255,85,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(85,255,85,0.05) 1px, transparent 1px);
        background-size: 42px 42px;
        -webkit-mask-image: radial-gradient(ellipse at center, black 25%, transparent 75%);
                mask-image: radial-gradient(ellipse at center, black 25%, transparent 75%);
        pointer-events: none;
      }
      #cb-maintenance > * { position: relative; z-index: 1; }
      #cb-maintenance .cb-mlogo {
        font-family: 'Silkscreen', monospace;
        font-size: 0.8rem; letter-spacing: 3px;
        color: #6F7178; margin-bottom: 36px;
      }
      #cb-maintenance .cb-mlogo .green { color: #55FF55; }
      #cb-maintenance h1 {
        font-family: 'Silkscreen', monospace;
        font-size: clamp(2.2rem, 7vw, 4.5rem);
        color: #55FF55;
        margin: 0 0 16px;
        letter-spacing: 4px;
        text-shadow: 0 0 30px rgba(85,255,85,0.45), 0 0 70px rgba(85,255,85,0.2);
        line-height: 1;
      }
      #cb-maintenance .cb-msub {
        color: #9A9CA3;
        font-size: clamp(0.95rem, 1.5vw, 1.1rem);
        max-width: 540px; line-height: 1.6;
        margin: 0 0 48px;
      }
      #cb-maintenance .cb-countdown {
        display: inline-flex; gap: 12px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-weight: 600;
      }
      #cb-maintenance .cb-unit {
        background: rgba(85,255,85,0.05);
        border: 1px solid rgba(85,255,85,0.22);
        border-radius: 12px;
        padding: 16px 18px 12px;
        min-width: 88px;
        display: flex; flex-direction: column; align-items: center;
      }
      #cb-maintenance .cb-unit .n {
        font-size: clamp(1.8rem, 4.5vw, 2.6rem);
        color: #E6E7EA; line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      #cb-maintenance .cb-unit .l {
        font-family: 'Silkscreen', monospace;
        font-size: 0.62rem; letter-spacing: 2px;
        color: #6F7178; margin-top: 8px;
      }
      #cb-maintenance .cb-eta {
        margin-top: 32px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 0.74rem; letter-spacing: 2px;
        color: #6F7178; text-transform: uppercase;
      }
      #cb-maintenance .cb-eta .dot {
        display: inline-block; width: 6px; height: 6px; border-radius: 50%;
        background: #55FF55; margin-right: 8px; vertical-align: middle;
        box-shadow: 0 0 8px #55FF55;
        animation: cbDot 1.6s ease-in-out infinite;
      }
      @keyframes cbDot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      @media (max-width: 520px) {
        #cb-maintenance .cb-countdown { gap: 6px; }
        #cb-maintenance .cb-unit { min-width: 64px; padding: 12px 8px 10px; }
        #cb-maintenance .cb-unit .l { font-size: 0.55rem; letter-spacing: 1px; }
      }
    `;

    const html = `
      <div id="cb-maintenance" role="dialog" aria-label="Site under maintenance">
        <div class="cb-mlogo">CMD<span class="green">BLOCK</span></div>
        <h1>BE RIGHT BACK</h1>
        <p class="cb-msub">${MAINTENANCE_BLURB}</p>
        <div class="cb-countdown" id="cb-countdown" aria-live="polite">
          <div class="cb-unit"><span class="n" data-k="d">--</span><span class="l">DAYS</span></div>
          <div class="cb-unit"><span class="n" data-k="h">--</span><span class="l">HOURS</span></div>
          <div class="cb-unit"><span class="n" data-k="m">--</span><span class="l">MIN</span></div>
          <div class="cb-unit"><span class="n" data-k="s">--</span><span class="l">SEC</span></div>
        </div>
        <div class="cb-eta"><span class="dot"></span>${MAINTENANCE_LABEL}</div>
      </div>
    `;

    let timerId = 0;
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      const ms = +until - Date.now();
      if (ms <= 0) {
        document.getElementById('cb-maintenance')?.remove();
        document.getElementById('cb-maintenance-style')?.remove();
        document.documentElement.classList.remove('cb-maint-on');
        if (timerId) clearInterval(timerId);
        return;
      }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const root = document.getElementById('cb-countdown');
      if (!root) return;
      const setN = (k, v) => { const el = root.querySelector(`[data-k="${k}"]`); if (el) el.textContent = pad(v); };
      setN('d', d); setN('h', h); setN('m', m); setN('s', s);
    }
    function show() {
      if (document.getElementById('cb-maintenance')) return;
      const style = document.createElement('style');
      style.id = 'cb-maintenance-style';
      style.textContent = css;
      document.head.appendChild(style);
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      document.body.appendChild(wrap.firstElementChild);
      document.documentElement.classList.add('cb-maint-on');
      tick();
      timerId = setInterval(tick, 1000);
    }
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
  })();

  // ── Config ─────────────────────────────────────────────
  // Paste your Google Apps Script web-app URL here to log signups to a Sheet.
  // Setup: see scripts/google-sheets-template.gs and deploy it as a Web App
  // (Execute as: Me · Who has access: Anyone). Then paste the deployment URL here.
  const SHEETS_URL = '';  // e.g. 'https://script.google.com/macros/s/AKfycby.../exec'

  // ── Storage keys ───────────────────────────────────────
  const ACCOUNT_KEY = 'cmdblock-account-v2';
  const PROGRESS_KEY = 'cmdblock-progress-v2';
  const PREFS_KEY = 'cmdblock-prefs-v2';
  const KNOWN_USER_KEY = 'cmdblock-known-user-v2';
  const MIGRATED_FLAG = 'cmdblock-migrated-v1-v2';
  const SHEETS_SENT_KEY = 'cmdblock-sheets-sent-v2';

  // ── Google Sheets push (fire-and-forget) ───────────────
  function pushToSheet(payload) {
    if (!SHEETS_URL) return;
    try {
      // Send once per email
      const sent = JSON.parse(localStorage.getItem(SHEETS_SENT_KEY) || '[]');
      if (payload.email && sent.includes(payload.email)) return;
      // no-cors so Apps Script accepts the request without CORS preflight
      fetch(SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          name: payload.name || '',
          email: payload.email || '',
          source: location.host || 'cmdblock',
          ts: new Date().toISOString(),
          ua: navigator.userAgent.slice(0, 200),
        }),
      }).catch(() => {});
      if (payload.email) {
        sent.push(payload.email);
        localStorage.setItem(SHEETS_SENT_KEY, JSON.stringify(sent.slice(-50)));
      }
    } catch (e) { /* best-effort */ }
  }

  // ── Firebase cloud (optional — activates if firebase-config.js is filled in)
  // Local-first: localStorage is always the source of truth in the page.
  // When Firebase is configured + signed in, every write also mirrors to Firestore
  // and a real-time listener mirrors cloud changes back into localStorage.
  let cloud = null;        // namespace with imported SDK fns + { auth, db }
  let cloudUser = null;    // current Firebase auth user
  let cloudUnsub = null;   // Firestore onSnapshot unsubscriber

  function cloudReady() { return !!(cloud && cloudUser); }

  function humanizeAuthError(err) {
    const code = err?.code || '';
    const map = {
      'auth/email-already-in-use': 'That email is already registered. Try signing in.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password is too weak — pick something at least 6 characters.',
      'auth/user-not-found': 'No account with that email — create one instead?',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many tries. Wait a minute and retry.',
      'auth/popup-closed-by-user': 'Sign-in window closed.',
      'auth/popup-blocked': 'Pop-up was blocked. Allow pop-ups and try again.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] || err?.message || 'Something went wrong';
  }

  async function initCloud() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg?.apiKey) return;  // not configured → stay local-only
    try {
      const FB_VER = '10.13.0';
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`),
      ]);

      const app = appMod.initializeApp(cfg);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      cloud = { app, auth, db, ...appMod, ...authMod, ...fsMod };

      authMod.onAuthStateChanged(auth, async (user) => {
        if (cloudUnsub) { try { cloudUnsub(); } catch {} cloudUnsub = null; }
        cloudUser = user || null;
        if (!user) {
          // Signed out — keep whatever's in localStorage as-is
          updateAccountCtaUI();
          window.dispatchEvent(new CustomEvent('cmdblock:account', { detail: { account: getAccount() } }));
          return;
        }

        // Signed in: hydrate from cloud, creating the doc on first sign-in
        const ref = fsMod.doc(db, 'users', user.uid);
        let snap;
        try { snap = await fsMod.getDoc(ref); } catch (e) { console.warn(e); return; }
        let data = snap.exists() ? snap.data() : null;
        if (!data) {
          // First time — seed from any existing local data
          const localProgress = getProgress();
          const localAcc = getAccount();
          data = {
            name: localAcc?.name || user.displayName || (user.email || '').split('@')[0] || 'Player',
            email: user.email || localAcc?.email || '',
            since: localAcc?.since || new Date().toISOString(),
            roles: localAcc?.roles || ['NOOBIE'],
            progress: localProgress,
          };
          try { await fsMod.setDoc(ref, data); } catch (e) { console.warn(e); }
        }

        // Mirror to localStorage and notify the UI
        applyCloudData(data);

        // Real-time sync: any cloud change → localStorage + event
        cloudUnsub = fsMod.onSnapshot(ref, (s) => {
          const d = s.data();
          if (d) applyCloudData(d);
        });
      });
    } catch (e) {
      console.warn('[cmdblock] cloud init failed, staying local-only:', e);
      cloud = null;
    }
  }

  function applyCloudData(d) {
    const acc = { name: d.name, email: d.email, since: d.since, roles: d.roles };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(d.progress || {}));
    if (acc.email) localStorage.setItem(KNOWN_USER_KEY, JSON.stringify({ name: acc.name, email: acc.email }));
    updateAccountCtaUI();
    window.dispatchEvent(new CustomEvent('cmdblock:account', { detail: { account: acc } }));
  }

  async function cloudWrite(patch) {
    if (!cloudReady()) return;
    try {
      const ref = cloud.doc(cloud.db, 'users', cloudUser.uid);
      await cloud.setDoc(ref, patch, { merge: true });
    } catch (e) { console.warn('[cmdblock] cloud write failed:', e); }
  }

  // ── One-shot v1 migration ──────────────────────────────
  (function migrate() {
    try {
      if (localStorage.getItem(MIGRATED_FLAG)) return;
      const oldAcc = localStorage.getItem('cmdblock-account');
      if (oldAcc && !localStorage.getItem(ACCOUNT_KEY)) {
        const parsed = JSON.parse(oldAcc);
        if (parsed && (parsed.email || parsed.name)) {
          localStorage.setItem(ACCOUNT_KEY, JSON.stringify({
            name: parsed.name || (parsed.email ? parsed.email.split('@')[0] : 'Player'),
            email: parsed.email || '',
            since: parsed.since || parsed.created || new Date().toISOString(),
            roles: Array.isArray(parsed.roles) ? parsed.roles : (parsed.role ? [parsed.role] : ['NOOBIE']),
          }));
        }
      }
      const oldProg = localStorage.getItem('cmdblock-progress');
      if (oldProg && !localStorage.getItem(PROGRESS_KEY)) {
        const parsed = JSON.parse(oldProg);
        if (parsed && typeof parsed === 'object') {
          localStorage.setItem(PROGRESS_KEY, JSON.stringify(parsed));
        }
      }
      localStorage.setItem(MIGRATED_FLAG, '1');
    } catch (e) { /* best-effort */ }
  })();

  // ── Storage helpers ────────────────────────────────────
  function getAccount() { try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || null; } catch { return null; } }
  function setAccount(a) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    if (a?.email) localStorage.setItem(KNOWN_USER_KEY, JSON.stringify({ name: a.name, email: a.email }));
    updateAccountCtaUI();
    window.dispatchEvent(new CustomEvent('cmdblock:account', { detail: { account: a } }));
    // Mirror to cloud
    cloudWrite({ name: a?.name, roles: a?.roles, since: a?.since });
  }
  function clearAccount() {
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    updateAccountCtaUI();
    window.dispatchEvent(new CustomEvent('cmdblock:account', { detail: { account: null } }));
    // Sign out of Firebase too if signed in
    if (cloudReady()) { try { cloud.signOut(cloud.auth); } catch {} }
  }
  function getKnownUser() { try { return JSON.parse(localStorage.getItem(KNOWN_USER_KEY)) || null; } catch { return null; } }
  function getProgress() { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; } }
  function setProgress(p) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    cloudWrite({ progress: p });
  }
  function getPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || { edition: 'bedrock' }; } catch { return { edition: 'bedrock' }; } }
  function setPrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

  // ── Role system (matches old site) ─────────────────────
  // NOOBIE → FRESHMAN → JUNIOR → SENIOR · TINKERER (project earner) · OWNER (admin)
  const ROLES = {
    NOOBIE:   { color: '#8B5E3C', label: 'Noobie',   weight: 0 },
    FRESHMAN: { color: '#5D9B3C', label: 'Freshman', weight: 1 },
    JUNIOR:   { color: '#2EAAA0', label: 'Junior',   weight: 2 },
    SENIOR:   { color: '#9B59B6', label: 'Senior',   weight: 3 },
    TINKERER: { color: '#E67E22', label: 'Tinkerer', weight: 4 },
    OWNER:    { color: '#E74C3C', label: 'Owner',    weight: 5 },
    MEMBER:   { color: '#55FF55', label: 'Member',   weight: 0 },
  };

  // Auto-promote based on lesson completion (does NOT remove explicit roles like OWNER, TINKERER)
  function computeRoles(account, progress) {
    const explicit = (account?.roles || []).filter(r => typeof r === 'string').map(r => r.toUpperCase());
    const total = Object.values(progress || {}).reduce((s, p) => s + (p?.completed || 0), 0);
    const projTotal = ['projects-easy', 'projects-medium', 'projects-hard'].reduce((s, k) => s + (progress?.[k]?.completed || 0), 0);

    // Auto-leveled role from total lessons
    let level = 'NOOBIE';
    if (total >= 26) level = 'SENIOR';
    else if (total >= 11) level = 'JUNIOR';
    else if (total >= 1)  level = 'FRESHMAN';

    // Tinkerer if they've shipped any project
    const out = new Set(explicit.length ? explicit : []);
    out.add(level);
    if (projTotal >= 4) out.add('TINKERER');

    // Sort by weight desc so primary role is the highest
    return [...out].sort((a, b) => (ROLES[b]?.weight || 0) - (ROLES[a]?.weight || 0));
  }

  function roleBadgeHTML(role, opts = {}) {
    const r = ROLES[role] || ROLES.MEMBER;
    const sz = opts.size === 'sm'
      ? 'font-size:0.55rem;padding:2px 7px;'
      : 'font-size:0.62rem;padding:3px 10px;';
    return `<span class="role-badge" style="background:${r.color};color:#fff;font-family:'Silkscreen',monospace;letter-spacing:1px;border-radius:999px;${sz};text-transform:uppercase;display:inline-block;">${r.label.toUpperCase()}</span>`;
  }

  // ── Active nav highlight ───────────────────────────────
  function highlightActiveNav() {
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase().split('?')[0];
      if (href && (href === path || (path === '' && href === 'index.html'))) a.classList.add('active');
    });
  }

  // ── Mobile nav ────────────────────────────────────────
  function bindMobileNav() {
    const btn = document.getElementById('menuBtn');
    const nav = document.getElementById('mobileNav');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  // ── Reveal on scroll ──────────────────────────────────
  // Bulletproof: CSS defaults .reveal to opacity:1 (always visible if JS fails).
  // JS opts in-viewport items into the fade-up animation by adding .reveal-pending,
  // then .visible to play the transition. Below-fold items just stay visible.
  function bindReveal() {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    const vh = window.innerHeight;
    // Mark in-viewport items pending BEFORE first paint to avoid a visible flash.
    const inViewport = els.filter(el => {
      const r = el.getBoundingClientRect();
      return r.top < vh - 40 && r.bottom > 0;
    });
    inViewport.forEach(el => el.classList.add('reveal-pending'));
    // Next frame: trigger fade-up.
    requestAnimationFrame(() => {
      inViewport.forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), Math.min(i * 60, 240));
      });
    });
  }

  // ── Modals (smooth) ───────────────────────────────────
  let lastFocus = null;
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first input for smooth keyboard flow
    requestAnimationFrame(() => {
      const inp = m.querySelector('input:not([type=hidden]), button.modal-submit, button.btn-primary');
      inp?.focus({ preventScroll: true });
    });
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('closing');
    setTimeout(() => {
      m.classList.remove('open', 'closing');
      document.body.style.overflow = '';
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }, 180);
  }
  function bindModals() {
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(m => closeModal(m.id));
    });
  }

  // ── Confetti ──────────────────────────────────────────
  function confetti(origin) {
    if (getPrefs().reduceMotion) return;
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(c);
    const colors = ['#55FF55','#FFE94A','#4AEDD9','#B266FF','#FF5C5C','#77FF77'];
    const N = 60;
    for (let i = 0; i < N; i++) {
      const p = document.createElement('span');
      const sz = 6 + Math.random() * 6;
      const ang = Math.random() * Math.PI * 2;
      const vel = 140 + Math.random() * 180;
      const dx = Math.cos(ang) * vel;
      const dy = Math.sin(ang) * vel - 80;
      p.style.cssText = `position:absolute;left:${origin.x}px;top:${origin.y}px;width:${sz}px;height:${sz}px;background:${colors[i%colors.length]};border-radius:${Math.random()<0.4?'50%':'2px'};transform:translate(-50%,-50%);transition:transform 900ms cubic-bezier(0.18,0.8,0.32,1),opacity 900ms ease-out;`;
      c.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy + 200}px)) rotate(${Math.random()*720}deg)`;
        p.style.opacity = '0';
      });
    }
    setTimeout(() => c.remove(), 1100);
  }

  // ── Toast system (replaces alert()) ───────────────────
  function ensureToastHost() {
    let host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }
  function toast(message, opts = {}) {
    const host = ensureToastHost();
    const variant = opts.variant || 'info';
    const t = document.createElement('div');
    t.className = `toast toast-${variant}`;
    const ICONS = {
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    };
    t.innerHTML = `<span class="toast-icon">${ICONS[variant] || ICONS.info}</span><span class="toast-msg">${message}</span><button class="toast-close" aria-label="Dismiss"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    function dismiss() {
      t.classList.remove('in');
      t.classList.add('out');
      setTimeout(() => t.remove(), 240);
    }
    t.querySelector('.toast-close').addEventListener('click', dismiss);
    if (opts.duration !== 0) setTimeout(dismiss, opts.duration || 3600);
    return { dismiss };
  }

  // ── Custom confirm (replaces window.confirm) ──────────
  function confirmDialog(message, opts = {}) {
    return new Promise((resolve) => {
      const m = document.createElement('div');
      m.className = 'modal open';
      m.id = 'confirmDialog_' + Math.random().toString(36).slice(2, 8);
      const isDanger = !!opts.danger;
      m.innerHTML = `
        <div class="modal-card" style="max-width:420px;">
          <h2 style="font-size:0.95rem;">${opts.title || 'CONFIRM'}</h2>
          <p class="modal-sub" style="margin-bottom:22px;">${message}</p>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-ghost" data-act="cancel" style="flex:1;justify-content:center;padding:12px;">${opts.cancelLabel || 'Cancel'}</button>
            <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" data-act="ok" style="flex:1;justify-content:center;padding:12px;">${opts.okLabel || (isDanger ? 'Delete' : 'Confirm')}</button>
          </div>
        </div>`;
      document.body.appendChild(m);
      document.body.style.overflow = 'hidden';
      function finish(result) {
        m.classList.add('closing');
        setTimeout(() => { m.remove(); document.body.style.overflow = ''; resolve(result); }, 180);
      }
      m.addEventListener('click', (e) => {
        if (e.target === m) finish(false);
        const b = e.target.closest('[data-act]');
        if (b) finish(b.dataset.act === 'ok');
      });
      const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); finish(false); }
        if (e.key === 'Enter') { document.removeEventListener('keydown', onKey); finish(true); }
      };
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => m.querySelector('[data-act=ok]').focus());
    });
  }

  // ── Custom prompt (replaces window.prompt) ────────────
  function promptDialog(message, defaultValue = '', opts = {}) {
    return new Promise((resolve) => {
      const m = document.createElement('div');
      m.className = 'modal open';
      m.innerHTML = `
        <div class="modal-card" style="max-width:420px;">
          <h2 style="font-size:0.95rem;">${opts.title || 'INPUT'}</h2>
          <p class="modal-sub">${message}</p>
          <input class="input" type="text" value="${(defaultValue || '').replace(/"/g, '&quot;')}" maxlength="${opts.maxlength || 64}" data-prompt-input style="margin:8px 0 18px;">
          <div style="display:flex;gap:10px;">
            <button class="btn btn-ghost" data-act="cancel" style="flex:1;justify-content:center;padding:12px;">Cancel</button>
            <button class="btn btn-primary" data-act="ok" style="flex:1;justify-content:center;padding:12px;">${opts.okLabel || 'Save'}</button>
          </div>
        </div>`;
      document.body.appendChild(m);
      document.body.style.overflow = 'hidden';
      const input = m.querySelector('[data-prompt-input]');
      function finish(result) {
        m.classList.add('closing');
        setTimeout(() => { m.remove(); document.body.style.overflow = ''; resolve(result); }, 180);
      }
      m.addEventListener('click', (e) => {
        if (e.target === m) finish(null);
        const b = e.target.closest('[data-act]');
        if (b) finish(b.dataset.act === 'ok' ? input.value : null);
      });
      const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); finish(null); }
        if (e.key === 'Enter') { document.removeEventListener('keydown', onKey); finish(input.value); }
      };
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    });
  }

  // ── Password reveal toggles (auto-wired) ──────────────
  function bindPasswordReveal() {
    document.querySelectorAll('input[type=password]').forEach(input => {
      if (input.dataset.revealBound) return;
      input.dataset.revealBound = '1';
      // Wrap in a div so the eye button can sit absolutely positioned
      const wrap = document.createElement('div');
      wrap.className = 'password-wrap';
      // Preserve flex/grid layout: copy the input's flex class context by giving the wrap flex:1
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'password-reveal';
      btn.setAttribute('aria-label', 'Show password');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
      wrap.appendChild(btn);
      btn.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        btn.innerHTML = showing
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
      });
    });
  }

  // ── Inline validation helpers ──────────────────────────
  function setFieldError(input, msg) {
    const wrap = input.closest('.field') || input.parentElement;
    let err = wrap?.querySelector('.field-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'field-error';
      input.insertAdjacentElement('afterend', err);
    }
    err.textContent = msg || '';
    input.classList.toggle('error', !!msg);
  }
  function clearFieldError(input) { setFieldError(input, ''); }

  // ── Smooth form submit (loading → success) ─────────────
  function smoothSubmit(form, handler) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const errEl = form.querySelector('.modal-error');
      if (errEl) errEl.textContent = '';
      const originalHTML = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-spinner"></span> Please wait…';
      }
      try {
        const res = await Promise.resolve(handler(form));
        if (res?.ok) {
          if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> ' + (res.label || 'Done');
          if (res.confetti) {
            const r = btn?.getBoundingClientRect();
            if (r) confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          setTimeout(() => res.after?.(), 600);
        } else {
          if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          if (errEl) errEl.textContent = res?.error || 'Something went wrong';
        }
      } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        if (errEl) errEl.textContent = err?.message || 'Something went wrong';
      }
    });
  }

  // ── Auth flow ─────────────────────────────────────────
  function bindAuthForms() {
    // Signup
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.querySelectorAll('input').forEach(i => i.addEventListener('input', () => clearFieldError(i)));
      smoothSubmit(signupForm, async (f) => {
        const name = f.querySelector('[name=name]')?.value.trim();
        const email = f.querySelector('[name=email]')?.value.trim();
        const pass = f.querySelector('[name=password]')?.value;
        const confirm = f.querySelector('[name=confirm]')?.value;
        if (!name) return { error: 'Name is required' };
        if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please enter a valid email' };
        if (!pass || pass.length < 6) return { error: 'Password must be at least 6 characters' };
        if (pass !== confirm) return { error: 'Passwords don\'t match' };

        // If Firebase is configured, use real auth
        if (cloud) {
          try {
            const cred = await cloud.createUserWithEmailAndPassword(cloud.auth, email, pass);
            await cloud.updateProfile(cred.user, { displayName: name });
            // onAuthStateChanged will create/sync the user doc
          } catch (err) {
            return { error: humanizeAuthError(err) };
          }
        } else {
          setAccount({ name, email, since: new Date().toISOString(), roles: ['NOOBIE'] });
        }
        pushToSheet({ name, email });
        return {
          ok: true,
          label: 'Welcome!',
          confetti: true,
          after: () => {
            closeModal('signupModal');
            f.reset();
            toast(`Welcome to cmdblock, ${name}! Your progress is saved${cloud ? ' to the cloud and syncs across devices.' : ' automatically.'}`, { variant: 'success', duration: 5000 });
          },
        };
      });
    }

    // Signin
    const signinForm = document.getElementById('signinForm');
    if (signinForm) {
      signinForm.querySelectorAll('input').forEach(i => i.addEventListener('input', () => clearFieldError(i)));
      smoothSubmit(signinForm, async (f) => {
        const email = f.querySelector('[name=email]')?.value.trim();
        const pass = f.querySelector('[name=password]')?.value || '';
        if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please enter a valid email' };

        if (cloud) {
          try {
            await cloud.signInWithEmailAndPassword(cloud.auth, email, pass);
          } catch (err) {
            return { error: humanizeAuthError(err) };
          }
        } else {
          const known = getKnownUser();
          const name = known?.email === email ? known.name : email.split('@')[0];
          const existing = getAccount();
          setAccount({ name, email, since: existing?.since || new Date().toISOString(), roles: existing?.roles || ['NOOBIE'] });
        }
        return {
          ok: true,
          label: 'Signed in',
          after: () => {
            closeModal('signinModal');
            f.reset();
            const name = getAccount()?.name || email.split('@')[0];
            toast(`Welcome back, ${name}!`, { variant: 'success' });
          },
        };
      });
    }

    injectGoogleSignIn();
  }

  // Inject "Continue with Google" button into both auth modals when cloud is ready
  function injectGoogleSignIn() {
    const tryInject = () => {
      if (!cloud) return;
      ['signupForm', 'signinForm'].forEach(formId => {
        const form = document.getElementById(formId);
        if (!form || form.dataset.googleInjected) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost google-btn';
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        `;
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const orig = btn.innerHTML;
          btn.innerHTML = '<span class="btn-spinner"></span> Opening Google…';
          try {
            const provider = new cloud.GoogleAuthProvider();
            await cloud.signInWithPopup(cloud.auth, provider);
            closeModal(formId === 'signupForm' ? 'signupModal' : 'signinModal');
            toast('Signed in with Google', { variant: 'success' });
          } catch (err) {
            const errEl = form.querySelector('.modal-error');
            if (errEl) errEl.textContent = humanizeAuthError(err);
            btn.disabled = false;
            btn.innerHTML = orig;
          }
        });
        // Build a small "or" divider
        const divider = document.createElement('div');
        divider.className = 'auth-divider';
        divider.innerHTML = '<span>or</span>';
        // Insert at the top of the form (before first input)
        form.insertBefore(divider, form.firstChild);
        form.insertBefore(btn, form.firstChild);
        form.dataset.googleInjected = '1';
      });
    };
    // Cloud loads asynchronously — retry shortly after page load
    tryInject();
    let tries = 0;
    const iv = setInterval(() => {
      tryInject();
      tries++;
      if (cloud || tries > 20) clearInterval(iv);
    }, 250);
  }

  // ── Welcome-back modal ────────────────────────────────
  function maybeShowWelcomeBack() {
    if (getAccount()) return; // already signed in
    const known = getKnownUser();
    if (!known?.email) return;
    if (sessionStorage.getItem('cmdblock-wb-shown')) return; // once per session
    sessionStorage.setItem('cmdblock-wb-shown', '1');
    // Build welcome-back modal if missing
    let m = document.getElementById('welcomeBackModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'welcomeBackModal';
      m.className = 'modal';
      m.innerHTML = `
        <div class="modal-card" style="text-align:center;">
          <button class="modal-close" onclick="cmdblock.closeModal('welcomeBackModal')" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style="width:56px;height:56px;border-radius:14px;background:rgba(85,255,85,0.08);border:1px solid rgba(85,255,85,0.18);display:inline-flex;align-items:center;justify-content:center;color:var(--cmd-green);margin-bottom:14px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2>WELCOME BACK</h2>
          <p class="modal-sub">Sign in as <strong style="color:var(--cmd-green);">${known.name || known.email}</strong>?</p>
          <button class="btn btn-primary" style="width:100%;justify-content:center;padding:13px;margin-bottom:8px;" onclick="cmdblock.quickSignIn()">Yes, sign in</button>
          <button class="btn btn-ghost" style="width:100%;justify-content:center;padding:12px;" onclick="cmdblock.closeModal('welcomeBackModal')">Not now</button>
        </div>`;
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m) closeModal('welcomeBackModal'); });
    }
    setTimeout(() => openModal('welcomeBackModal'), 700);
  }

  function quickSignIn() {
    const known = getKnownUser();
    if (!known?.email) { closeModal('welcomeBackModal'); return; }
    const existing = getAccount();
    setAccount({ name: known.name, email: known.email, since: existing?.since || new Date().toISOString(), roles: existing?.roles || ['NOOBIE'] });
    closeModal('welcomeBackModal');
  }

  // ── Account CTA ───────────────────────────────────────
  function updateAccountCtaUI() {
    const account = getAccount();
    document.querySelectorAll('[data-account-cta]').forEach(el => {
      if (account?.email) {
        el.innerHTML = '';
        el.textContent = account.name || 'Profile';
        el.href = 'profile.html';
        el.classList.add('signed-in');
        el.onclick = null;
      } else {
        el.textContent = 'Sign Up';
        el.href = '#';
        el.classList.remove('signed-in');
        el.onclick = (e) => { e.preventDefault(); openModal('signupModal'); };
      }
    });
  }

  // ── Marquee duplication ───────────────────────────────
  function bindMarquee() {
    const m = document.getElementById('marquee');
    if (m && !m.dataset.dupe) { m.innerHTML = m.innerHTML + m.innerHTML; m.dataset.dupe = '1'; }
  }

  // ── Bento spotlight ───────────────────────────────────
  function bindBentoSpotlight() {
    document.querySelectorAll('.bento-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  // ── Animated counters ─────────────────────────────────
  function bindCounters() {
    const els = document.querySelectorAll('.stat-num[data-count], .stat-num[data-text]');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.text) { el.textContent = el.dataset.text; io.unobserve(el); return; }
          const target = parseFloat(el.dataset.count);
          const suffix = el.dataset.suffix || '';
          const dur = 1400;
          const start = performance.now();
          (function tick(now) {
            const t = Math.min((now - start) / dur, 1);
            const v = Math.round(target * (1 - Math.pow(1 - t, 3)));
            el.textContent = v + suffix;
            if (t < 1) requestAnimationFrame(tick);
          })(start);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    els.forEach(el => io.observe(el));
  }

  // ── Public API ─────────────────────────────────────────
  window.cmdblock = {
    getAccount, setAccount, clearAccount,
    getProgress, setProgress,
    getPrefs, setPrefs,
    getKnownUser,
    computeRoles, roleBadgeHTML, ROLES,
    openModal, closeModal, quickSignIn,
    confetti,
    toast,
    confirm: confirmDialog,
    prompt: promptDialog,
    pushToSheet,
    isCloudReady: () => !!cloud,
  };
  window.openModal = openModal;
  window.closeModal = closeModal;

  // ── Init ───────────────────────────────────────────────
  function init() {
    bindMobileNav();
    bindReveal();
    bindModals();
    bindAuthForms();
    bindMarquee();
    bindBentoSpotlight();
    bindCounters();
    bindPasswordReveal();
    highlightActiveNav();
    updateAccountCtaUI();
    maybeShowWelcomeBack();
    // Kick off Firebase init in the background (no await — UI doesn't block)
    initCloud().catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
