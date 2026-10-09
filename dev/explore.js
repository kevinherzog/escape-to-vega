/* Random-play explorer for Escape to Vega.
 *
 *   node dev/explore.js [runs] [difficulty|all] [ship|all]
 *   node dev/explore.js 5000 0 all
 *
 * Plays with deliberately unopinionated bots — random node choices, random
 * purchases, random event answers — so the results are not shaped by anyone's
 * theory of how the game should be played. Then it asks which things correlate
 * with winning.
 *
 * THE TRAP THIS AVOIDS: in a roguelite, everything you accumulate correlates
 * with surviving longer, because surviving longer is how you accumulate it.
 * Counting what winners *finished* with therefore tells you almost nothing —
 * relics, crew and upgrades would all look brilliant. So every correlation here
 * is measured against a SNAPSHOT TAKEN AT THE END OF SECTOR 1, long before the
 * run is decided, and compared only among runs that got that far. That makes it
 * a question about a starting position rather than about survival time.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var HTML = path.join(__dirname, '..', 'index.html');
var html = fs.readFileSync(HTML, 'utf8');
var scripts = [];
html.replace(/<script>([\s\S]*?)<\/script>/g, function (_, body) { scripts.push(body); return ''; });
var TMP = path.join(require('os').tmpdir(), 'etv-explore-logic.js');
fs.writeFileSync(TMP, scripts[0]);
var L = require(TMP);

var RUNS = parseInt(process.argv[2], 10) || 2000;
var DIFF_ARG = process.argv[3] === undefined ? '0' : process.argv[3];
var SHIP_ARG = process.argv[4] || 'all';
var SHIP_KEYS = L.LOADOUTS.map(function (l) { return l.key; });

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function chance(p) { return Math.random() < p; }

/* ---------------------------------------------------------------- the bot
   Not a strategy — a random walk that still interacts with every system, so
   that every part of the game gets exercised. */
function spendRandomly(s) {
  var guard = 40;
  while (guard-- > 0) {
    var acts = [];
    s.shop.forEach(function (o, i) {
      if (!o.sold && s.scrap >= L.crewPrice(s) && L.canRecruit(s, o.role, o.origin)) acts.push(['crew', i]);
      if (!o.sold && L.mergeBuyPlan(s, o.role, o.origin)) acts.push(['merge', i]);
    });
    ['shield', 'engine', 'cap'].forEach(function (w) {
      var c = L.upgradeCost(s, w);
      if (c != null && s.scrap >= c) acts.push(['upg', w]);
    });
    // one reroll entry against many buy entries, so a random walk still mostly buys
    if (s.scrap >= L.rerollPrice(s) && chance(0.15)) acts.push(['reroll', 0]);
    if (!acts.length) return;
    // stop early sometimes, so runs vary in how much they bank
    if (chance(0.12)) return;
    var a = pick(acts);
    if (a[0] === 'crew') L.buyCrew(s, a[1]);
    else if (a[0] === 'merge') { var o = s.shop[a[1]]; L.buyMerge(s, o.role, o.origin); }
    else if (a[0] === 'upg') L.upgrade(s, a[1]);
    else L.reroll(s);
  }
}
function worstWeapon(s) {
  var w = 0;
  for (var i = 1; i < s.weapons.length; i++) {
    var A = L.WEAPONS[s.weapons[i]], B = L.WEAPONS[s.weapons[w]];
    if (A.shots * A.dmg / A.charge < B.shots * B.dmg / B.charge) w = i;
  }
  return w;
}
function doShop(s) {
  var st = L.makeStore(s), guard = 20;
  while (guard-- > 0) {
    var acts = [];
    st.offers.forEach(function (o, i) { if (!o.sold && s.scrap >= o.price) acts.push(['w', i]); });
    if (st.relic && !st.relic.sold && s.scrap >= st.relic.price) acts.push(['r', 0]);
    if (s.scrap >= L.repairPrice(s) && s.hull < L.maxHull(s)) acts.push(['fix', 0]);
    if (s.slots < 4 && s.scrap >= L.C.SLOT_COST) acts.push(['slot', 0]);
    if (!acts.length || chance(0.2)) return;
    var a = pick(acts);
    if (a[0] === 'w') { var r = L.storeBuy(s, st, a[1]); if (r && r.replace) L.replaceWeapon(s, worstWeapon(s), r.replace); }
    else if (a[0] === 'r') L.storeBuyRelic(s, st);
    else if (a[0] === 'fix') L.repair(s);
    else L.buySlot(s);
  }
}
function doBroker(s) {
  var st = L.makeBroker(s);
  st.offers.forEach(function (o, i) { if (!o.sold && s.scrap >= o.price && chance(0.7)) L.brokerBuy(s, st, i); });
}
function fight(s, type, opts) {
  var c = L.startCombat(s, type, opts || {});
  var guard = 400000;
  while (!c.over && guard-- > 0) {
    L.stepCombat(c, 0.05);
    if (c.canFlee && c.flee >= 1 && chance(0.002)) { L.flee(c); break; }
  }
  return L.endCombat(s, c);
}
function snapshot(s) {
  var cnt = L.counts(s);
  var syn = {};
  L.ROLE_KEYS.concat(L.ORIGIN_KEYS).forEach(function (k) { syn[k] = L.tierOf(cnt, k); });
  return {
    syn: syn,
    relics: (s.relics || []).slice(),
    weapons: s.weapons.slice(),
    crewN: s.crew.length,
    stars: s.crew.reduce(function (a, m) { return a + m.stars; }, 0),
    shieldLv: s.shieldLv, engineLv: s.engineLv, slots: s.slots, cap: s.cap,
    hullFrac: s.hull / L.maxHull(s),
    scrap: s.scrap
  };
}

function play(seed, diff, shipKey) {
  L.seed(seed);
  var s = L.newRun(diff, seed, shipKey);
  var snapS1 = null, snapS2 = null, guard = 400;
  spendRandomly(s);
  while (!s.dead && !s.won && guard-- > 0) {
    var j = L.jumpTo(s, Math.floor(Math.random() * s.beacons.length));
    if (!j) break;
    var t = j.type;
    if (t === 'shop') doShop(s);
    else if (t === 'broker') doBroker(s);
    else if (t === 'dock') L.dock(s);
    else if (t === 'event') {
      var inst = L.startEvent(s), view = L.eventView(s, inst), ok = [];
      view.choices.forEach(function (c, i) { if (c.ok) ok.push(i); });
      if (ok.length) {
        var out = L.chooseEvent(s, inst, pick(ok));
        if (out && out.combat) { if (fight(s, out.combat.type, out.combat).dead) break; }
        if (out && out.replace && chance(0.5)) L.replaceWeapon(s, worstWeapon(s), out.replace);
      }
    } else {
      var r = fight(s, t, {});
      if (r.dead) break;
      if (!r.fled && r.loot && r.loot.length) {
        var o = pick(r.loot), res = L.takeLoot(s, o);
        if (res && res.replace) L.replaceWeapon(s, worstWeapon(s), res.replace);
      }
    }
    if (s.won) break;
    var wasSector = s.sector;
    L.afterNode(s);
    if (s.sector === 2 && wasSector === 1 && !snapS1) snapS1 = snapshot(s);
    if (s.sector === 3 && wasSector === 2 && !snapS2) snapS2 = snapshot(s);
    spendRandomly(s);
  }
  var depth = (s.sector - 1) * (L.C.SECTOR_LEN + 1) + s.jump;
  return { won: !!s.won, sector: s.sector, depth: s.won ? 19 : depth, reachedS3: s.sector >= 3 || !!s.won,
           ship: shipKey, diff: diff, snapS1: snapS1, snapS2: snapS2 };
}

/* ------------------------------------------------------------- run them */
var results = [];
var t0 = Date.now();
for (var i = 0; i < RUNS; i++) {
  var d = DIFF_ARG === 'all' ? Math.floor(Math.random() * L.DIFFS.length) : parseInt(DIFF_ARG, 10);
  var sh = SHIP_ARG === 'all' ? pick(SHIP_KEYS) : SHIP_ARG;
  results.push(play(900000 + i, d, sh));
  if ((i + 1) % 500 === 0) process.stderr.write('  ...' + (i + 1) + '/' + RUNS + '\n');
}
var secs = ((Date.now() - t0) / 1000).toFixed(0);

/* ------------------------------------------------------------ aggregate */
function rate(list) { return list.length ? list.filter(function (r) { return r.won; }).length / list.length * 100 : 0; }
// Winning is too rare under random play to resolve differences, so the primary
// signal is how deep a run got. Depth runs 0-19 and every run reports one.
function depth(list) { return list.length ? list.reduce(function (a, r) { return a + r.depth; }, 0) / list.length : 0; }
function s3(list) { return list.length ? list.filter(function (r) { return r.reachedS3; }).length / list.length * 100 : 0; }
function pad(s, n) { s = String(s); return s + Array(Math.max(1, n - s.length + 1)).join(' '); }

var reachedS2 = results.filter(function (r) { return r.snapS1; });
var base = rate(reachedS2);

console.log('\n=== Escape to Vega — random-play exploration ===');
console.log(RUNS + ' runs in ' + secs + 's  |  difficulty ' + DIFF_ARG + '  |  ship ' + SHIP_ARG);
console.log('overall win rate: ' + rate(results).toFixed(1) + '%   mean depth: ' + depth(results).toFixed(2) + '/19   reached sector 3: ' + s3(results).toFixed(1) + '%');
console.log('reached sector 2: ' + reachedS2.length + ' (' + (reachedS2.length / RUNS * 100).toFixed(1) + '%)');
console.log('of those: mean depth ' + depth(reachedS2).toFixed(2) + ', reached sector 3 ' + s3(reachedS2).toFixed(1) + '%, won ' + base.toFixed(1) + '%');
console.log('(lifts below are against runs that reached the same checkpoint without the feature)\n');

// A feature is scored by comparing runs that HAD it at the end of sector 1
// against runs that did not, among runs that all reached sector 1's end.
function compare(title, featuresOf) {
  var buckets = {};
  reachedS2.forEach(function (r) {
    featuresOf(r.snapS1).forEach(function (f) {
      if (!buckets[f]) buckets[f] = [];
      buckets[f].push(r);
    });
  });
  var inSet = new Set();
  var rows = Object.keys(buckets).map(function (f) {
    var withF = buckets[f];
    inSet.clear();
    withF.forEach(function (r) { inSet.add(r); });
    var without = reachedS2.filter(function (r) { return !inSet.has(r); });
    return { f: f, n: withF.length, depth: depth(withF), dLift: depth(withF) - depth(without),
             s3: s3(withF), s3Lift: s3(withF) - s3(without), win: rate(withF) };
  }).filter(function (row) { return row.n >= 40; })
    .sort(function (a, b) { return b.dLift - a.dLift; });
  if (!rows.length) return;
  console.log('--- ' + title + ' (held at end of sector 1) ---');
  console.log('    ' + pad('', 26) + pad('n', 7) + pad('depth', 8) + pad('+/-', 8) + pad('reach s3', 10) + pad('+/-', 8) + 'win%');
  rows.forEach(function (r) {
    var sign = function (x, d) { return (x >= 0 ? '+' : '') + x.toFixed(d); };
    console.log('    ' + pad(r.f, 26) + pad(r.n, 7) + pad(r.depth.toFixed(2), 8) + pad(sign(r.dLift, 2), 8) +
      pad(r.s3.toFixed(1) + '%', 10) + pad(sign(r.s3Lift, 1), 8) + r.win.toFixed(1));
  });
  console.log('');
}

compare('synergy tiers', function (s) {
  var out = [];
  Object.keys(s.syn).forEach(function (k) { if (s.syn[k] >= 1) out.push(k + ' tier' + s.syn[k]); });
  return out;
});
compare('relics', function (s) { return s.relics.map(function (k) { return L.RELICS[k] ? L.RELICS[k].name : k; }); });
compare('weapons carried', function (s) {
  var seen = {};
  return s.weapons.filter(function (k) { if (seen[k]) return false; seen[k] = true; return true; })
    .map(function (k) { return L.WEAPONS[k].name; });
});
compare('ship state', function (s) {
  return ['shields lv' + s.shieldLv, 'engine lv' + s.engineLv, 'slots ' + s.slots,
          'crew ' + s.crewN, 'stars ' + Math.min(6, s.stars)];
});

if (SHIP_ARG === 'all') {
  console.log('--- by ship (all runs) ---');
  console.log('    ' + pad('', 14) + pad('n', 7) + pad('depth', 8) + pad('reach s3', 10) + 'win%');
  SHIP_KEYS.forEach(function (k) {
    var g = results.filter(function (r) { return r.ship === k; });
    console.log('    ' + pad(k, 14) + pad(g.length, 7) + pad(depth(g).toFixed(2), 8) + pad(s3(g).toFixed(1) + '%', 10) + rate(g).toFixed(1) + '%');
  });
  console.log('');
}
if (DIFF_ARG === 'all') {
  console.log('--- by difficulty (all runs) ---');
  console.log('    ' + pad('', 14) + pad('n', 7) + pad('depth', 8) + pad('reach s3', 10) + 'win%');
  L.DIFFS.forEach(function (d) {
    var g = results.filter(function (r) { return r.diff === d.lv; });
    console.log('    ' + pad(d.lv + ' ' + d.name, 14) + pad(g.length, 7) + pad(depth(g).toFixed(2), 8) + pad(s3(g).toFixed(1) + '%', 10) + rate(g).toFixed(1) + '%');
  });
  console.log('');
}
console.log('Caveat: these are correlations from random play, not advice. A feature');
console.log('measured here is one a random walk happened to hold early; it may be');
console.log('cheap rather than strong. Treat large n and large lift together.');
