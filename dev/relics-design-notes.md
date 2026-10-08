# Relic system — integration notes

Code: `patches/relics.js`. Target: `flucht-nach-vega/index.html`, verified against the
**1890-line file as of the German→English translation pass landing** (index.html changed
under me mid-task; Section E was rebased onto the translated UI, so the replacement
functions below carry the current English strings, not the old German ones).

Line numbers are a convenience — **match on the function name**, since the translation is
still in flight and may shift things. The whole patch was re-applied to a freshly extracted
copy of the live logic module after the translation landed and produced identical results.
All new player-facing text is English.

---

## 1. Logic module (first `<script>`, the `VEGA` closure)

| # | Patch section | What to do | Where in index.html |
|---|---|---|---|
| 1 | A: `RELICS` … `relicCombat()` | **Insert** the whole block | after the `WEAPONS` table (ends L551), before `var NODES = {` (L553) |
| 2 | B: `derive()` | **Replace** entire function | L600–634 |
| 3 | B: `newRun()` | **Replace** entire function | L645–667 |
| 4 | C: `side()` | **Replace** entire function | L836–848 |
| 5 | C: `startCombat()` | **Replace** entire function | L849–865 |
| 6 | C: `damage()` | **Replace** (one new line) | L867 |
| 7 | C: `dodged()`, `shieldBroke()`, `jamWeapon()` | **Insert** all three | directly after `damage()` |
| 8 | C: `fire()` | **Replace** entire function | L868–874 |
| 9 | C: `land()` | **Replace** entire function | L875–895 |
| 10 | C: `tickSide()` | **Replace** entire function | L896–923 |
| 11 | C: `endCombat()` | **Replace** entire function | L946–963 |
| 12 | D: `makeLoot()` | **Replace** entire function | L966–973 |
| 13 | D: `takeLoot()` | **Replace** entire function | L974–984 |
| 14 | D: `makeStore()` | **Replace** entire function | L987–990 |
| 15 | D: `storeBuyRelic()` | **Insert** | directly after `storeBuy()` (ends L996) |
| 16 | D: `RELIC_EVENT` | **Append** the object literal as the last element of the `EVENTS` array | before the closing `]` on L1155 — i.e. add a comma after the `guild` event and paste the object body. `EVENT_BY_ID` (L1156) picks it up automatically. |
| 17 | D: `RELIC_EXPORTS` | **Merge** its 8 keys into the module's returned object | L1181–1194 |

`storeBuy()` itself needs no change.

### What changed in each replaced function

- **`derive`** — unchanged for a relic-less run (verified byte-identical outputs). Adds a
  relic block before the `return`, plus two new return fields: `repairAmt` (int, Weld Drone)
  and `relic` (flag bag read by the combat hooks). Nothing else in the return changed.
- **`side`** — three new fields: `jam: 0` on each weapon, `repairAmt`, `rel` + `casCD`.
  Enemies get `rel: null`, so every hook is null-guarded via `a.rel || {}`.
- **`startCombat`** — forwards `d.repairAmt` and `d.relic` into the player side; adds `c.dealt = 0`.
- **`damage`** — accumulates `c.dealt` when the target is `'e'` (Salvage Lathe). Counts overkill.
- **`fire`** — doubles beam shot count under Prism Lens; staggers the twin beams'
  travel (0.35 / 0.60) so they don't render on top of each other.
- **`land`** — Phase Veil beam dodge, Prism Lens shield pierce, `shieldBroke()` on every
  shield-loss path, `jamWeapon()` on the two ion paths that actually strip a layer.
- **`tickSide`** — Coil Spring regen override for layer 1 only, jam countdown that skips
  charging, `repairAmt` on the repair tick. `heatFactor(c)` is now hoisted into `heat`
  (same value, called once instead of three times).
- **`endCombat`** — Salvage Lathe + Syndicate Ledger payouts, both inside the existing
  `c.type !== 'boss'` guard. Ledger is computed on `s.scrap` *before* the fight payout.
- **`makeLoot` / `makeStore`** — relic offers, Black Box extras. `makeStore` now returns
  `{ offers: [...], relic: null | {k, sold, price} }`; the extra key is additive.

---

## 2. UI module (second `<script>`)

| # | Patch section | What to do | Where |
|---|---|---|---|
| 18 | E: `RELIC_IC`, `RELIC_TIER`, `relicBadge()` | **Insert** | next to `NODE_IC` (L1235) |
| 19 | E: `panelRelics()` | **Insert** | after `panelSynergies()` (ends L1369) |
| 20 | E: `viewHangar()` | **Replace** | L1411–1416 (only change: `panelRelics(s)` added between synergies and recruit) |
| 21 | E: `lootButton()` | **Replace** | L1608–1619 |
| 22 | E: `describeTaken()` | **Replace** | L1632–1637 |
| 23 | E: `viewStore()` | **Replace** | L1658–1675 |
| 24 | E: `RELIC_ACTION` | **Merge** the `'sbuyrel'` key into the `ACTIONS` object | L1756–1846 |
| 25 | E: `spawnFx` cases | **Add** `case 'salvo': text = 'Free salvo'; cls = 'blk'; break;` before `default:` | inside `spawnFx()`'s switch, L1546–1554 |
| 26 | F: CSS | **Append** the 6 rules | in `<style>`, after the `.syn` rules (L205–219) |
| 27 | optional | `panelShip()` "Repair" row → show `d.repairAmt` | L1315 |

HTML output of every new/replaced UI function was tag-balance checked. Steps 20–23 differ
from the live file in **only** the lines marked `// NEW` (plus `panelRelics(s)` in
`viewHangar`) — diff before pasting if the translation has moved on again.

---

## Risks / things to watch

1. **Step 25 is not optional in practice.** Cascade Capacitor emits a new fx kind `'salvo'`.
   `spawnFx()`'s `default:` branch renders `'+' + f.amt`, so without the new case the player
   sees a stray **"+0"** float on every cascade trigger. Ion Spike deliberately reuses the
   existing `'ionw'` kind ("Weapons disrupted") so it needs no new case.
2. **Save compatibility.** `s.relics` is a new field and `savedRun()` still gates on
   `r.v === 1`, so an in-flight save from the old build loads with `s.relics === undefined`.
   Every read goes through `hasRelic()` / `(s.relics || [])`, and `addRelic()` lazily creates
   the array — verified by running a full combat + `endCombat` on a state with `relics`
   deleted. If you'd rather hard-cut old saves, bump `newRun`'s `v: 1` → `v: 2` **and** the
   two UI checks at L1223 (`savedRun`) and L1868 (`start`).
3. **Hoard Reactor reads `s.scrap` at `derive()` time**, so the hangar's shield count and the
   combat start-charge visibly change the moment the player crosses 40 scrap. That is the
   intended tension, but it is the only relic whose displayed stats move while shopping —
   worth a line in the help panel if it confuses people.
4. **Shield pip count can get long.** `shieldLv 4 + tech×4 + Chorus + Reactor` = 9 real
   layers + 5 spark bonus = 14 pips in `pipsHtml()`. `.spips` already has `flex-wrap: wrap`,
   so it wraps rather than overflowing, but it eats two lines on a phone.
5. **A jammed enemy weapon has no UI tell** — its charge bar simply freezes. The `'ionw'`
   float fires on the hit, which is probably enough, but a `.wc[data-jam]` style would read better.
6. **Black Box can push loot to 6 options.** `.loot` is a single-column grid, so the reward
   screen just gets taller. Fine on a phone, but it is the longest screen in the game.
7. **`RELIC_EVENT.setup` calls `rollRelic(s)` and can return `k: null`** when the player owns
   all 12. The first choice is then disabled with "The vault is already stripped" — handled,
   but it is the one event whose primary option can be dead on arrival.
8. **No regression for relic-less runs** — `derive()` returns byte-identical output over
   4000 generated states (modulo the two additive keys), and 1500 seeded fights resolve to
   identical winner / duration / end hull. If a run never picks up a relic, nothing changes.
9. **Balance notes from tuning** (all numbers in the task report):
   - Ion Spike originally jammed *the enemy weapon closest to firing*. That was an outright
     lockout (70 % less damage taken, 53 % → 100 % win). It now jams a **random** un-jammed
     weapon **and only when the ion actually strips a layer**, which also stops stacked ion
     cannons from scaling — measured jam uptime is ~10 % whether you run one ion or two.
   - Cascade Capacitor zeroes the fired weapon's charge (fires *early*, not *extra*). Without
     that it was a flat +50 % damage on any ship, which is not what a build relic should be.
   - The repair tick is throttled by the existing `heatFactor` ramp, which is what keeps
     Weld Drone + engineer×4 from being literally unkillable past ~60 s. Don't remove that
     divisor from `tickSide`.
