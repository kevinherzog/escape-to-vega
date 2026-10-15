// How often does a player actually SEE a tier-3 relic, and how many runs does it
// take to see all four? Counts every relic the player is *offered* (loot, shops,
// broker, events), not just the ones taken.
var fs = require('fs'), path = require('path'), os = require('os');
var html = fs.readFileSync('/tmp/etv-repo/index.html', 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>/);
var TMP = path.join(os.tmpdir(), 'relic-probe-logic.js');
fs.writeFileSync(TMP, m[1]);
var L = require(TMP);

var RUNS = +(process.argv[2] || 20000);
var T3 = Object.keys(L.RELICS).filter(function (k) { return L.RELICS[k].tier === 3; });

// Per-roll tier odds, straight from the weights, for each sector and floor.
console.log('=== per-roll odds of a tier-3 relic ===');
[1, 2, 3].forEach(function (sec) {
  [1, 2].forEach(function (floor) {
    var s = { sector: sec, relics: [] };
    var n = 20000, hits = 0;
    L.seed(sec * 100 + floor);
    for (var i = 0; i < n; i++) {
      var k = L.rollRelic(s, floor);
      if (k && L.RELICS[k].tier === 3) hits++;
    }
    console.log('  sector ' + sec + ', min tier ' + floor + ': ' + (hits / n * 100).toFixed(2) + '%');
  });
});

// Now the thing that matters: a whole run's worth of exposure.
// Relic sources per run, from the code paths that call rollRelic:
//   - fight/elite loot (minTier 1), guardian/boss loot (minTier 2)
//   - trading post relic shelf (minTier 1)
//   - relic broker, sector 2+ (minTier 2)
//   - three events (minTier 1, 1, 2)
// The bot in explore.js already walks real campaigns; here we just count offers.
function runOnce(seed) {
  L.seed(seed);
  var s = L.newRun(4, seed, 'albatross');
  var seen = {};
  // Walk 18 jumps' worth of plausible relic offers at the right sector numbers.
  for (var jump = 1; jump <= 18; jump++) {
    s.sector = Math.min(3, Math.ceil(jump / 6));
    var isGate = (jump % 6 === 0);
    // one loot roll per combat node (~60% of nodes are fights)
    if (Math.random() < 0.60) {
      var k1 = L.rollRelic(s, isGate ? 2 : 1);
      if (k1) seen[k1] = true;
    }
    // a trading post or broker roughly every third jump
    if (jump % 3 === 0) {
      var k2 = L.rollRelic(s, s.sector >= 2 ? 2 : 1);
      if (k2) seen[k2] = true;
    }
    // a relic event now and then
    if (Math.random() < 0.12) {
      var k3 = L.rollRelic(s, 1);
      if (k3) seen[k3] = true;
    }
  }
  return Object.keys(seen);
}

var runsWithAnyT3 = 0, t3Counts = {}, offersTotal = 0;
T3.forEach(function (k) { t3Counts[k] = 0; });
for (var i = 0; i < RUNS; i++) {
  var seen = runOnce(5000 + i);
  offersTotal += seen.length;
  var any = false;
  seen.forEach(function (k) {
    if (L.RELICS[k].tier === 3) { t3Counts[k]++; any = true; }
  });
  if (any) runsWithAnyT3++;
}

console.log('\n=== over ' + RUNS + ' simulated runs ===');
console.log('distinct relics offered per run: ' + (offersTotal / RUNS).toFixed(1));
console.log('runs showing at least one tier-3: ' + (runsWithAnyT3 / RUNS * 100).toFixed(1) + '%');
console.log('  -> roughly 1 run in ' + Math.round(RUNS / runsWithAnyT3));
T3.forEach(function (k) {
  var p = t3Counts[k] / RUNS;
  console.log('  ' + L.RELICS[k].name.padEnd(18) + (p * 100).toFixed(2) + '% of runs  (1 in ' + Math.round(1 / p) + ')');
});

// Coupon-collector: expected runs to have seen all four at least once.
var p = t3Counts[T3[0]] / RUNS;
var exp = 0;
for (var j = 1; j <= T3.length; j++) exp += 1 / (j * p);
console.log('\nexpected runs to see ALL FOUR at least once: ~' + Math.round(exp));
