// Controlled measurement of in-combat repair.
//
// Varying the crew to vary repair is confounded: engineers carry origins, and an
// engineer/rock flips the Crystalline +8 max hull synergy, so the "no engineer"
// ship is also a smaller ship. Instead this builds ONE ship and overrides the
// repair fields on the combat side directly, so the only difference between
// variants is the repair rate itself.
// Usage: node repair-probe.js [trials]
var fs = require('fs');
var path = require('path');
var os = require('os');

var html = fs.readFileSync('/tmp/etv-repo/index.html', 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>/);
var TMP = path.join(os.tmpdir(), 'repair-probe-logic.js');
fs.writeFileSync(TMP, m[1]);
var L = require(TMP);

var TRIALS = +(process.argv[2] || 400);

// The user's Needle as it met the Leviathan, crew fixed for every variant.
function mkShip() {
  var s = L.newRun(4, 12345, 'needle');
  s.crew = []; s.bench = [];
  s.cap = 6; s.slots = 3; s.engineLv = 4;
  s.weapons = ['beam', 'mining', 'buckshot'];
  s.relics = ['gyro', 'loader'];
  L.addCrew(s, 'pilot', 'spark', 2);
  L.addCrew(s, 'engineer', 'rock', 3);
  L.addCrew(s, 'pilot', 'rock', 3);
  L.addCrew(s, 'gunner', 'spark', 1);
  L.addCrew(s, 'gunner', 'bug', 1);
  L.addCrew(s, 'engineer', 'bug', 1);
  L.syncHull(s);
  s.hull = L.maxHull(s);
  s.sector = 3; s.jump = 6;
  return s;
}

function duel(s, type, seed, every, amt) {
  L.seed(seed);
  var c = L.startCombat(s, type, {});
  c.p.repairEvery = every;      // null = no repair at all
  c.p.repairAmt = amt;
  c.p.repairT = 0;
  var repaired = 0, prev = c.p.hull, guard = 200000;
  while (!c.over && guard-- > 0) {
    L.stepCombat(c, 0.05);
    if (c.p.hull > prev) repaired += c.p.hull - prev;
    prev = c.p.hull;
  }
  return { won: c.winner === 'p', repaired: repaired, t: c.t, maxHull: c.p.maxHull };
}

// Reachable repair configurations, from the crew/relic maths.
var variants = [
  ['no repair at all', null, 1],
  ['-- BEFORE --', null, 1],
  ['  Weld Drone alone', 14, 2],
  ['  1 eng 3*', 4, 1],
  ['  2 eng 3*+1*', 3.111, 1],
  ['  2 eng + drone  (user run)', 3.111, 2],
  ['  4 eng 3* + drone (ceiling)', 0.947, 2],
  ['-- AFTER --', null, 1],
  ['  Weld Drone alone', 7.00, 1],
  ['  1 eng 3*', 7.00, 1],
  ['  2 eng 3*+1*', 4.67, 1],
  ['  2 eng + drone  (user run)', 2.80, 1],
  ['  4 eng 3* + drone (ceiling)', 1.30, 1]
];

['boss', 'elite'].forEach(function (type) {
  var base = mkShip();
  console.log('\n=== ' + type.toUpperCase() + ' · Nightfall · Needle ' + L.maxHull(base) + ' hull · ' + TRIALS + ' identical seeds ===');
  console.log('repair build'.padEnd(30) + 'hull/s'.padStart(8) + 'win%'.padStart(8) + 'healed'.padStart(8) + '  vs hull pool');
  variants.forEach(function (v) {
    var wins = 0, rep = 0, mh = 0;
    for (var i = 0; i < TRIALS; i++) {
      var r = duel(mkShip(), type, 9000 + i, v[1], v[2]);
      if (r.won) wins++;
      rep += r.repaired; mh = r.maxHull;
    }
    var hps = v[1] ? v[2] / v[1] : 0;
    console.log(v[0].padEnd(30) + hps.toFixed(2).padStart(8) +
      (wins / TRIALS * 100).toFixed(1).padStart(8) + (rep / TRIALS).toFixed(1).padStart(8) +
      '   ' + (rep / TRIALS / mh * 100).toFixed(0) + '%');
  });
});
