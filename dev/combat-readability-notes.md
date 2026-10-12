# Combat legibility pass — working notes

Working file: `/tmp/research/combat/index.html` (copy of `/tmp/etv-repo/index.html`).
Harness used: existing `preview.js` (forces specific visual states) and `shot.js` (drives a
real fight over time) in this directory, both already set up by a previous pass — reused as-is.
Viewport 390×844, `chrome-headless-shell`.

## Baseline observations (before any edits), from screenshots

- `shot_baseline_*`, `shot_boss_*`: core combat screen reads reasonably well at rest. Hull bar,
  shield pips, weapon charge bars, "ENEMY CONTACT" intro, victory screen all render correctly.
- `shot_before_allfx*`: spawning many floater kinds on one ship at once produces an illegible
  pile of overlapping text. Artificial stress test (10 fx in one frame), but multi-shot weapons
  (Buckshot=5, Flak=3) land close enough in time that some overlap happens in real play too.
- `shot_before_jam*`: a jammed weapon's charge bar is visually identical to a normal
  half-charged bar. No color, pattern, or text differentiates "charging" from "frozen because
  jammed." Confirmed this is a real gap, not just a code-reading guess.
- `shot_before_heatrage*`: "Shields overheating" / "[Boss] enraged" markers both read clearly
  (red, top corners, blinking). These two work well already; used as the template for a third
  marker added below (see Breakdown section).
- `shot_before_pipoverflow*`: zoomed-in crop (`crop_pips_zoom.png`) revealed two real bugs:
  1. The "Shields" label and the pip row share one flex container with no fixed split, so the
     pip row's available width depends on label width. At 14 pips (9 base + 5 bonus) it was
     sitting exactly at the wrap edge (332px measured container, pips fill ~330px) — this
     sandbox falls back to system fonts (Google Fonts can't load offline), so real play with the
     actual webfonts very plausibly tips this over into the two-line wrap the brief describes.
     Confirmed fragile either way.
  2. **Bonus shield pips become indistinguishable from regular shield pips once filled.**
     `.spip.bonus.on` sets `background: var(--muted)` and the pip's own border is
     `border-color: var(--muted)` (dashed) — same color for fill and border, so the dashed
     pattern that's supposed to mark "this is a bonus layer" visually disappears the moment the
     pip lights up. Only empty bonus pips show the dash. This directly contradicts the "which
     ship has what" legibility goal, since bonus shields are mechanically different (stripped
     before regular shields, recharge 4x slower) and this was the only cue. See fix below.

## Decision: hull bar as fixed-width pips — rejected, keeping the continuous bar

The brief asked me to actually try this and judge by eye rather than reason about it, so I
temporarily rewired `hullBar()` to emit one `<i>` per hull point (same visual language as the
shield pips) and screenshotted it in three places: a boss at 40/58 hull (`shot_hulltest_boss.png`),
the sticky top-bar hull readout at 55/70 (`shot_hulltest_topbar.png`), and a low-hull skiff at
6/12 (`shot_hulltest_small.png`). Conclusion: reject, for a reason that only became obvious by
looking rather than by estimating:

- Sized to stay readable as discrete units (~18px, matching the shield pips), hull pips wrap
  across many rows for anything above ~15 max hull — and most ships sit well above that (player
  hulls run 24–34 base plus up to +20 from relics/origin; the boss is 58; late guardians are
  ~55-60). This is the shield-pip overflow problem, except guaranteed rather than occasional.
- Shrunk enough to avoid wrapping (~4px, see `shot_hulltest_boss.png`), the pips stop reading as
  countable units at all — they degrade into a stippled texture that's harder to parse than the
  plain bar, not easier. And a fixed pip width means the total bar length now varies with max
  hull: a low-hull ship's bar becomes a short stub that doesn't use the row (`shot_hulltest_small.png`
  — the Rust Skiff's 12-hull bar is a third of the row width, floating next to empty space,
  looking unfinished rather than "small ship, small hull"). The current bar's constant track
  length is itself doing useful work: fraction-of-a-fixed-bar is what makes "half the enemy's
  hull is gone" readable at a glance regardless of what the max happens to be.
- Semantically, pips make sense for shields because the core rule is shot-*count* based (one
  pip = one shot stopped, full stop, regardless of damage). Hull loss is magnitude-based — a
  Railgun shot and a Mining Laser shot both remove "1 pip" worth of visual weight under a pip
  scheme despite being 5 damage vs 1, which would misrepresent the exact distinction the shield
  pips are correctly built to show. A proportional bar is the semantically correct widget for a
  magnitude pool; discrete pips are correct for a discrete count. Keeping both as they
  structurally are (bar for hull, pips for shields) is itself informative — their different
  *shapes* tell the player which kind of stat they're looking at.

Kept instead, see "Changes" below, a smaller fix: stop the hull bar's decorative tick overlay
from implying false precision, and make sure the existing ok/warn/crit color coding stays the
primary at-a-glance signal.

Experiment code was fully reverted before any real edits began; `index.html` at this point is
identical to the fresh copy plus nothing.
