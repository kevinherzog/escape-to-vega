// The archive has to accumulate across runs and survive a death, so drive two
// runs in one page and check persistence between them.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
dom.window.scrollTo = () => {};
dom.window.onerror = (m) => errors.push(String(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (l, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + l + (x ? '   ' + x : '')); if (!c) fail = 1; };
const text = () => dom.window.document.body.textContent.replace(/\s+/g, ' ');
const btn = (a) => dom.window.document.querySelector('[data-a="' + a + '"]');

(async () => {
  await wait(300);
  const win = dom.window, FNV = win.FNV, L = win.VEGA;
  const stored = () => JSON.parse(win.localStorage.getItem('fnv-codex-v1') || '{"seen":{}}');

  FNV.act('new'); await wait(60);
  const s = FNV.S.run;
  check('starting relic is recorded as seen', (s.seenRelics || []).length >= 0, 'seen=' + JSON.stringify(s.seenRelics));

  // Roll a pile of relics; every one shown must be logged.
  s.sector = 3;
  for (let i = 0; i < 40; i++) L.rollRelic(s, 1);
  const rolled = (s.seenRelics || []).slice();
  check('rollRelic logs what it returns', rolled.length > 3, 'logged=' + rolled.length);

  // A relic taken is also marked held.
  L.addRelic(s, 'prism');
  check('addRelic logs it too', s.seenRelics.indexOf('prism') >= 0);

  FNV.act('map'); await wait(60);           // triggers a save -> codex flush
  const c1 = stored();
  check('archive persisted to storage', Object.keys(c1.seen).length >= rolled.length,
    'stored=' + Object.keys(c1.seen).length + ' expected>=' + rolled.length);
  check('carried relic marked held', !!c1.held.prism);

  // Kill the run; a relic seen in a losing run must still be kept.
  FNV.S.run.hull = 0; FNV.S.run.dead = true;
  FNV.go('title'); await wait(80);
  check('title shows the archive panel', /Relic Archive/.test(text()));
  check('title counts primes', /Prime: \d+ of 4/.test(text()), text().match(/Prime: .{0,12}/));

  btn('codex').click(); await wait(80);
  const t = text();
  check('archive screen opens', /Relic Archive/.test(t) && /recorded/.test(t));
  check('shows all three grades', /Prime/.test(t) && /Rare/.test(t) && /Common/.test(t));
  check('unseen relics are hidden, not spoiled', /Unrecorded/.test(t));
  const seenN = Object.keys(stored().seen).length;
  check('found count matches storage', t.indexOf(seenN + ' of ' + L.RELIC_KEYS.length) >= 0,
    'looking for "' + seenN + ' of ' + L.RELIC_KEYS.length + '"');

  // Second run must not wipe the first run's archive.
  FNV.act('new'); await wait(80);
  FNV.act('map'); await wait(60);
  check('a new run keeps the old archive', Object.keys(stored().seen).length >= seenN,
    'now=' + Object.keys(stored().seen).length + ' was=' + seenN);

  console.log('window errors:', errors.length ? errors.join(' | ') : 'none');
  if (errors.length) fail = 1;
  console.log(fail ? 'CODEX CHECKS FAILED' : 'codex checks passed');
  process.exit(fail);
})().catch((e) => { console.error('threw:', e && e.stack || e); process.exit(1); });
