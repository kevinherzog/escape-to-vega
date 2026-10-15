// Targeted jsdom test for the overflow-to-storage paths the node walk rarely reaches:
// the replace screen's stow option, the recruit shop with no free bunk, and selling
// a stowed weapon back off the bench.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
dom.window.scrollTo = () => {};
dom.window.onerror = (msg) => { errors.push(String(msg)); };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
function check(label, cond, extra) {
  console.log((cond ? '  ok   ' : '  FAIL ') + label + (extra ? '   ' + extra : ''));
  if (!cond) fail = 1;
}
function text() { return dom.window.document.body.textContent.replace(/\s+/g, ' '); }
function btnFor(a) { return dom.window.document.querySelector('[data-a="' + a + '"]'); }

(async () => {
  await wait(250);
  const win = dom.window;
  const FNV = win.FNV;
  if (!FNV) throw new Error('window.FNV missing');
  const L = win.VEGA;

  FNV.act('new');
  await wait(60);
  const s = FNV.S.run;

  // ---- 1. Replace screen offers a stow when the bench has room ----
  s.weapons = ['laser', 'burst'];
  s.slots = 2;
  s.bench = [];
  FNV.S.replace = { k: 'rail', back: 'hangar' };
  FNV.go('replace');
  await wait(60);
  check('replace screen offers "Stow"', !!btnFor('repstow'), btnFor('repstow') ? '' : text().slice(0, 160));
  check('replace screen still offers both removals', win.document.querySelectorAll('[data-a="rep"]').length === 2);

  btnFor('repstow').click();
  await wait(80);
  check('stow put the railgun on the bench', (s.bench || []).some((e) => e.kind === 'weapon' && e.k === 'rail'),
    'bench=' + JSON.stringify((s.bench || []).map((e) => e.k || e.kind)));
  check('stow kept both guns mounted', s.weapons.length === 2);
  check('stow left the replace screen', FNV.S.screen === 'hangar', 'screen=' + FNV.S.screen);

  // ---- 2. Replace screen hides the stow when the bench is loaded ----
  s.bench = [{ kind: 'weapon', k: 'rail' }, { kind: 'weapon', k: 'flak' }];
  FNV.S.replace = { k: 'lance', back: 'hangar' };
  FNV.go('replace');
  await wait(60);
  check('no stow button when the bench is loaded', !btnFor('repstow'));
  check('and it says so', /bench is full too/i.test(text()));

  // ---- 3. Selling a stowed weapon off the bench ----
  FNV.go('hangar');
  await wait(60);
  const scrapBefore = s.scrap;
  FNV.act('selbench', 0);
  await wait(40);
  const sellBtn = btnFor('benchsell');
  check('bench selection offers Sell', !!sellBtn);
  if (sellBtn) {
    sellBtn.click();
    await wait(60);
    check('selling a stowed weapon pays scrap', s.scrap > scrapBefore, scrapBefore + ' -> ' + s.scrap);
    check('and clears the bay', s.bench.length === 1, 'bench=' + s.bench.length);
  }

  // ---- 4. Recruit shop with every bunk taken ----
  s.crew = [];
  s.bench = [];
  s.cap = 2;
  s.scrap = 60;
  L.addCrew(s, 'gunner', 'bug');
  L.addCrew(s, 'pilot', 'human');
  s.shop = [{ role: 'tech', origin: 'rock', sold: false }];
  s.shopLock = false;
  FNV.go('hangar');
  await wait(80);
  check('shop warns the hire goes to the bench', /waits on the bench/i.test(text()));
  const buy = btnFor('buy');
  check('and the hire button stays live', !!buy && !buy.disabled);
  if (buy && !buy.disabled) {
    buy.click();
    await wait(80);
    check('buying with full bunks lands on the bench', s.bench.length === 1 && s.bench[0].kind === 'crew',
      'bench=' + JSON.stringify(s.bench.map((e) => e.kind)));
    check('and took no bunk', s.crew.length === 2);
  }

  // ---- 5. Everything loaded: the hire is refused, not silently charged ----
  s.bench = [{ kind: 'weapon', k: 'flak' }, { kind: 'weapon', k: 'lance' }];
  s.shop = [{ role: 'engineer', origin: 'spark', sold: false }];
  const scrapFull = s.scrap;
  FNV.go('hangar');
  await wait(80);
  const buy2 = btnFor('buy');
  check('hire button reads Full with nowhere to go', !!buy2 && buy2.disabled && /Full/.test(buy2.textContent));
  check('and no scrap was taken', s.scrap === scrapFull);

  console.log('window errors:', errors.length ? errors.join(' | ') : 'none');
  if (errors.length) fail = 1;
  console.log(fail ? 'BENCH UI CHECKS FAILED' : 'bench UI checks passed');
  process.exit(fail);
})().catch((e) => { console.error('threw:', e && e.stack || e); process.exit(1); });
