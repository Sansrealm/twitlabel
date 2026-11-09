// Finds usernames on X, looks up where each account is based, and adds the
// "Alien account" pill to the ones outside the home country.
(() => {
  const PILL_TEXT = 'Alien account';
  const FOUND_TTL = 30 * 24 * 60 * 60 * 1000;   // remember a known location for 30 days
  const EMPTY_TTL = 3 * 24 * 60 * 60 * 1000;    // re-check accounts with no location after 3 days
  const MAX_CACHE = 5000;
  const GAP_MS = 350;                           // pause between lookups, to stay polite to X
  const DEFAULT_PAUSE = 5 * 60 * 1000;

  let settings = { enabled: true, homeCountry: 'United States' };
  let cache = {};            // handle -> { c: country|null, a: accurate, t: time }
  let qid = null;
  let pausedUntil = 0;
  let working = false;
  let saveTimer = null;
  let reqSeq = 0;
  const queue = [];          // handles waiting for a lookup (newest last)
  const queued = new Set();
  const waiting = new Map(); // request id -> resolve

  // ---------- storage ----------
  const saveCacheSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const keys = Object.keys(cache);
      if (keys.length > MAX_CACHE) {
        keys.sort((a, b) => cache[a].t - cache[b].t)
          .slice(0, keys.length - MAX_CACHE)
          .forEach((k) => delete cache[k]);
      }
      chrome.storage.local.set({ cache });
    }, 800);
  };
  const setStatus = (status) => chrome.storage.local.set({ status: { ...status, at: Date.now() } });

  const fresh = (entry) =>
    entry && Date.now() - entry.t < (entry.c ? FOUND_TTL : EMPTY_TTL);

  // ---------- talking to page.js ----------
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || d.__alienAccount !== true) return;
    if (d.kind === 'qid' && d.qid) {
      qid = d.qid;
      chrome.storage.local.set({ qid });
    } else if (d.kind === 'res' && waiting.has(d.id)) {
      waiting.get(d.id)(d);
      waiting.delete(d.id);
    }
  });

  const ask = (screenName) =>
    new Promise((resolve) => {
      const id = ++reqSeq;
      waiting.set(id, resolve);
      window.postMessage({ __alienAccount: true, kind: 'req', id, screenName, qid }, location.origin);
      setTimeout(() => {
        if (waiting.has(id)) { waiting.delete(id); resolve({ ok: false, error: 'timeout' }); }
      }, 20000);
    });

  // ---------- lookup queue ----------
  const enqueue = (handle) => {
    if (queued.has(handle) || fresh(cache[handle])) return;
    queued.add(handle);
    queue.push(handle);
    pump();
  };

  const pump = async () => {
    if (working) return;
    working = true;
    try {
      while (queue.length && settings.enabled) {
        const wait = pausedUntil - Date.now();
        if (wait > 0) { setTimeout(pump, Math.min(wait + 500, 60000)); return; }
        const handle = queue.pop();               // newest first: what you're looking at now
        if (!document.querySelector('[data-alien-handle="' + handle + '"]')) {
          queued.delete(handle);                  // scrolled away before its turn
          continue;
        }
        const r = await ask(handle);
        queued.delete(handle);
        if (r.ok) {
          cache[handle] = { c: r.country, a: r.accurate, t: Date.now() };
          saveCacheSoon();
          paint(handle);
          if (r.remaining === 0 && r.resetAt) {
            pausedUntil = r.resetAt;
            setStatus({ state: 'paused', until: pausedUntil });
          } else {
            setStatus({ state: 'ok' });
          }
        } else if (r.error === 'rate') {
          pausedUntil = r.resetAt && r.resetAt > Date.now() ? r.resetAt : Date.now() + DEFAULT_PAUSE;
          queued.add(handle); queue.push(handle); // try this one again after the pause
          setStatus({ state: 'paused', until: pausedUntil });
        } else if (r.error === 'timeout' || r.error === 'network' || r.error === 'http') {
          setStatus({ state: 'error', error: r.error });
        } else {
          // logged out, blocked, or X changed its lookup: stop asking for a while
          pausedUntil = Date.now() + DEFAULT_PAUSE;
          queued.add(handle); queue.push(handle);
          setStatus({ state: 'error', error: r.error });
        }
        await new Promise((res) => setTimeout(res, GAP_MS));
      }
    } finally {
      working = false;
    }
  };

  // ---------- the pill ----------
  const MAYBE_TEXT = 'Possibly alien';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const cautionIcon = () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'alienacct-icon');
    for (const d of ['M12 3 2 20h20L12 3z', 'M12 10v4', 'M12 17.2v.1']) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  };

  // Which pill an account gets:
  //   'alien' = based outside the home country
  //   'maybe' = outside the home country, but X has tagged the location unreliable
  //   null    = no pill
  const kindOf = (entry) => {
    if (!entry || !settings.enabled) return null;
    if (!alienClassify(entry.c, settings.homeCountry).alien) return null;
    return entry.a === false ? 'maybe' : 'alien';
  };

  const makePill = (handle, kind) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.dataset.alienFor = handle;
    pill.dataset.alienKind = kind;
    if (kind === 'maybe') {
      pill.className = 'alienacct-pill alienacct-pill-maybe' + (isDark() ? ' alienacct-on-dark' : '');
      pill.appendChild(cautionIcon());
      const label = document.createElement('span');
      label.textContent = MAYBE_TEXT;
      pill.appendChild(label);
      pill.setAttribute('aria-label', MAYBE_TEXT + ': show where this account may be based');
    } else {
      pill.className = 'alienacct-pill';
      pill.textContent = PILL_TEXT;
      pill.setAttribute('aria-label', PILL_TEXT + ': show where this account is based');
    }
    pill.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePopover(pill, handle);
    });
    // keep X from treating a press on the pill as a press on the post
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown'].forEach((t) =>
      pill.addEventListener(t, (ev) => ev.stopPropagation()));
    return pill;
  };

  // Where the pill goes. In the feed, name and handle sit on one line, so the pill follows them.
  // On a post's detail page and on profiles they are stacked, so the pill goes beside the name.
  const placePill = (el, pill) => {
    if (getComputedStyle(el).flexDirection === 'column') {
      let row = el.firstElementChild;
      let found = false;
      for (let i = 0; row && i < 4; i++) {
        if (row.tagName === 'A') break;
        const cs = getComputedStyle(row);
        if (cs.display.includes('flex') && cs.flexDirection === 'row') { found = true; break; }
        row = row.childElementCount === 1 ? row.firstElementChild : null;
      }
      if (found) { row.appendChild(pill); return; }
      pill.classList.add('alienacct-stacked');
    }
    el.appendChild(pill);
  };

  const paintEl = (el, handle) => {
    const kind = kindOf(cache[handle]);
    let existing = el.querySelector('.alienacct-pill');
    if (existing && (existing.dataset.alienKind !== kind || existing.dataset.alienFor !== handle)) {
      existing.remove();
      existing = null;
    }
    if (kind && !existing) placePill(el, makePill(handle, kind));
  };

  const paint = (handle) =>
    document.querySelectorAll('[data-alien-handle="' + handle + '"]').forEach((el) => paintEl(el, handle));

  // ---------- the pop-up shown when a pill is clicked ----------
  let pop = null;
  let popOwner = null;
  const closePopover = () => {
    if (pop) { pop.remove(); pop = null; popOwner = null; }
  };
  const isDark = () => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor || '');
    return m ? (Number(m[1]) * 299 + Number(m[2]) * 587 + Number(m[3]) * 114) / 1000 < 128 : false;
  };
  const togglePopover = (pill, handle) => {
    if (popOwner === pill) { closePopover(); return; }
    closePopover();
    const entry = cache[handle];
    if (!entry || !entry.c) return;
    const maybe = pill.dataset.alienKind === 'maybe';

    pop = document.createElement('div');
    pop.className = 'alienacct-pop' + (isDark() ? ' alienacct-dark' : '');
    pop.setAttribute('role', 'dialog');

    const main = document.createElement('div');
    main.className = 'alienacct-pop-main';
    main.append(maybe ? 'This user may be based in ' : 'This user is based in ');
    const strong = document.createElement('strong');
    strong.textContent = entry.c;
    main.append(strong, '.');
    pop.appendChild(main);

    const note = document.createElement('div');
    note.className = 'alienacct-pop-note';
    note.textContent = maybe ? 'X has tagged this location as unreliable.' : 'Location pulled from X.';
    pop.appendChild(note);

    document.body.appendChild(pop);
    popOwner = pill;
    const r = pill.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  };
  document.addEventListener('click', (ev) => {
    if (pop && !pop.contains(ev.target)) closePopover();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closePopover(); });
  window.addEventListener('scroll', closePopover, true);

  // ---------- finding usernames on the page ----------
  const HANDLE_RE = /^@([A-Za-z0-9_]{1,15})$/;
  const handleOf = (el) => {
    for (const span of el.querySelectorAll('span')) {
      const m = HANDLE_RE.exec((span.textContent || '').trim());
      if (m) return m[1].toLowerCase();
    }
    return null;
  };

  // only look an account up once its post is actually on screen
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      const handle = e.target.dataset.alienHandle;
      if (handle) enqueue(handle);
    }
  }, { rootMargin: '200px' });

  const scan = () => {
    if (!settings.enabled) return;
    const els = document.querySelectorAll(
      'article [data-testid="User-Name"], [data-testid="UserName"], [data-testid="UserCell"] [data-testid="User-Name"]');
    for (const el of els) {
      const handle = handleOf(el);
      if (!handle) continue;
      if (el.dataset.alienHandle !== handle) {
        el.dataset.alienHandle = handle;         // X reuses these elements as you scroll
        const old = el.querySelector('.alienacct-pill');
        if (old) old.remove();
      }
      if (fresh(cache[handle])) paintEl(el, handle);
      else seen.observe(el);
    }
  };

  let scanTimer = null;
  const scanSoon = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 250);
  };

  const repaintAll = () => {
    closePopover();
    document.querySelectorAll('[data-alien-handle]').forEach((el) => {
      if (!settings.enabled) {
        const p = el.querySelector('.alienacct-pill');
        if (p) p.remove();
      } else {
        paintEl(el, el.dataset.alienHandle);
      }
    });
    if (settings.enabled) { scan(); pump(); }
  };

  // ---------- start ----------
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      settings = { ...settings, ...(changes.settings.newValue || {}) };
      repaintAll();
    }
    if (changes.cache && !changes.cache.newValue) {   // "Clear saved locations" was pressed
      cache = {};
      document.querySelectorAll('[data-alien-handle]').forEach((el) => { delete el.dataset.alienHandle; });
      document.querySelectorAll('.alienacct-pill').forEach((p) => p.remove());
      scan();
    }
  });

  chrome.storage.local.get(['settings', 'cache', 'qid'], (stored) => {
    if (stored.settings) {
      settings = { ...settings, ...stored.settings };
    } else {
      // first run: set the home country from the computer's time zone
      const home = alienDetectHome();
      if (home) {
        settings = { ...settings, homeCountry: home, auto: true };
        chrome.storage.local.set({ settings });
      }
    }
    cache = stored.cache || {};
    qid = stored.qid || null;
    new MutationObserver(scanSoon).observe(document.body, { childList: true, subtree: true });
    scan();
  });
})();
