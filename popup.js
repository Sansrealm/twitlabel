const $ = (id) => document.getElementById(id);

const ERROR_TEXT = {
  'logged-out': 'Sign in to X in this browser so locations can be looked up.',
  'auth': 'X refused the lookup. Reload the X tab and try again.',
  'query-changed': "X changed how locations are looked up. Open any profile's \"About this account\" page once, then reload.",
  'network': 'A lookup failed (network). It will retry as you scroll.',
  'timeout': 'A lookup timed out. It will retry as you scroll.',
  'http': 'X returned an error. It will retry as you scroll.',
};

// Saved settings, or (first run) the home country worked out from the time zone.
const resolveSettings = (stored) => {
  if (stored.settings) return { enabled: true, homeCountry: 'United States', ...stored.settings };
  const home = alienDetectHome();
  const fresh = { enabled: true, homeCountry: home || 'United States', auto: Boolean(home) };
  chrome.storage.local.set({ settings: fresh });
  return fresh;
};

const render = (stored) => {
  const settings = resolveSettings(stored);
  $('enabled').checked = settings.enabled;
  $('home').value = settings.homeCountry;
  $('homehint').hidden = !settings.auto;

  const all = Object.values(stored.cache || {});
  const outside = all.filter((e) => alienClassify(e.c, settings.homeCountry).alien);
  const maybe = outside.filter((e) => e.a === false).length;
  $('count').textContent = all.length
    ? all.length + ' accounts checked: ' + (outside.length - maybe) + ' alien, ' + maybe + ' possibly alien.'
    : 'No accounts checked yet. Open X and scroll.';

  const s = stored.status;
  const el = $('status');
  el.className = '';
  if (s && s.state === 'paused' && s.until > Date.now()) {
    el.className = 'warn';
    el.textContent = 'X limits how many lookups it allows. Resuming at ' +
      new Date(s.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.';
  } else if (s && s.state === 'error' && Date.now() - s.at < 10 * 60 * 1000) {
    el.className = 'warn';
    el.textContent = ERROR_TEXT[s.error] || 'A lookup failed. It will retry as you scroll.';
  } else {
    el.textContent = '';
  }
};

const load = () => chrome.storage.local.get(['settings', 'cache', 'status'], render);

// Any manual change makes the choice yours, so the "set from time zone" hint goes away.
const save = (auto) => {
  chrome.storage.local.set({
    settings: { enabled: $('enabled').checked, homeCountry: $('home').value, auto },
  }, load);
};

for (const name of ALIEN_ALL_COUNTRIES) {
  const o = document.createElement('option');
  o.value = name;
  o.textContent = name;
  $('home').appendChild(o);
}
$('enabled').addEventListener('change', () => save(!$('homehint').hidden));
$('home').addEventListener('change', () => save(false));
$('clear').addEventListener('click', () => chrome.storage.local.remove(['cache', 'status'], load));
load();
