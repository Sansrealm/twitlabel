// Runs inside the X page itself so lookups use the signed-in session,
// exactly as X's own "About this account" screen does.
// It talks to content.js through window.postMessage.
(() => {
  const DEFAULT_QID = 'XRqGa7EeokUU5kppkh13EA';
  // X's public web-client token (the same one the site sends for every visitor).
  const FALLBACK_BEARER =
    'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const origFetch = window.fetch.bind(window);
  let bearer = null;
  let liveQid = null;
  let scanPromise = null;

  const post = (msg) => window.postMessage({ __alienAccount: true, ...msg }, location.origin);

  // If X itself ever calls the lookup (e.g. you open someone's About page),
  // remember the ID it used. This lets the extension heal itself when X changes it.
  const noteUrl = (url) => {
    const m = /\/graphql\/([\w-]+)\/AboutAccountQuery/.exec(String(url));
    if (m && m[1] !== liveQid) {
      liveQid = m[1];
      post({ kind: 'qid', qid: liveQid });
    }
  };
  const noteAuth = (name, value) => {
    if (String(name).toLowerCase() === 'authorization' && /^Bearer /.test(String(value))) {
      bearer = String(value);
    }
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { noteUrl(url); } catch (e) {}
    return xhrOpen.apply(this, arguments);
  };
  const xhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try { noteAuth(name, value); } catch (e) {}
    return xhrSetHeader.apply(this, arguments);
  };
  window.fetch = function (input, init) {
    try {
      noteUrl(typeof input === 'string' ? input : input && input.url);
      const h = init && init.headers;
      if (h) {
        if (typeof h.forEach === 'function') h.forEach((v, k) => noteAuth(k, v));
        else Object.keys(h).forEach((k) => noteAuth(k, h[k]));
      }
    } catch (e) {}
    return origFetch(input, init);
  };

  const cookie = (name) => {
    const m = new RegExp('(?:^|; )' + name + '=([^;]*)').exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : null;
  };

  // Last resort when the known ID stops working: look for the current one in X's own scripts.
  const scanForQid = () => {
    if (!scanPromise) {
      scanPromise = (async () => {
        const srcs = Array.from(document.scripts)
          .map((s) => s.src)
          .filter((s) => /twimg\.com\/.+\.js/.test(s));
        for (const src of srcs) {
          try {
            const text = await (await origFetch(src)).text();
            const m =
              /queryId:"([\w-]+)",operationName:"AboutAccountQuery"/.exec(text) ||
              /operationName:"AboutAccountQuery"[^}]{0,200}?queryId:"([\w-]+)"/.exec(text);
            if (m) return m[1];
          } catch (e) {}
        }
        return null;
      })();
    }
    return scanPromise;
  };

  const request = async (screenName, qid) => {
    const csrf = cookie('ct0');
    if (!csrf) return { ok: false, error: 'logged-out' };
    const url =
      location.origin + '/i/api/graphql/' + qid + '/AboutAccountQuery?variables=' +
      encodeURIComponent(JSON.stringify({ screenName }));
    const res = await origFetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        authorization: bearer || FALLBACK_BEARER,
        'x-csrf-token': csrf,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'content-type': 'application/json',
      },
    });
    const remainingH = res.headers.get('x-rate-limit-remaining');
    const resetH = res.headers.get('x-rate-limit-reset');
    const out = {
      status: res.status,
      remaining: remainingH === null ? null : Number(remainingH),
      resetAt: resetH ? Number(resetH) * 1000 : null,
    };
    if (res.status === 429) return { ...out, ok: false, error: 'rate' };
    if (res.status === 401 || res.status === 403) return { ...out, ok: false, error: 'auth' };
    if (res.status === 400 || res.status === 404) return { ...out, ok: false, error: 'query-changed' };
    if (!res.ok) return { ...out, ok: false, error: 'http' };
    const json = await res.json();
    const result = json && json.data && json.data.user_result_by_screen_name &&
      json.data.user_result_by_screen_name.result;
    const about = result && result.about_profile;
    return {
      ...out,
      ok: true,
      country: (about && about.account_based_in) || null,
      accurate: !(about && about.location_accurate === false),
    };
  };

  const lookup = async (screenName, storedQid) => {
    let qid = liveQid || storedQid || DEFAULT_QID;
    let r = await request(screenName, qid);
    if (r.error === 'query-changed') {
      const found = await scanForQid();
      if (found && found !== qid) {
        liveQid = found;
        post({ kind: 'qid', qid: found });
        r = await request(screenName, found);
      }
    }
    return r;
  };

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || d.__alienAccount !== true || d.kind !== 'req') return;
    let r;
    try {
      r = await lookup(d.screenName, d.qid);
    } catch (e) {
      r = { ok: false, error: 'network' };
    }
    post({ kind: 'res', id: d.id, ...r });
  });
})();
