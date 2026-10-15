# Escape to Vega

A small offline roguelite for the phone. You fly the courier ship *Albatross* through three sectors
to reach the star Vega, carrying the last copy of the Star Archive. The Syndicate wants it back.

Battles fight themselves — each weapon fires the moment it finishes charging, each shield layer
soaks one hit. Your job is everything around that: which jump point to take, who to hire, what to
bolt onto the hull, and when to run.

It is one self-contained HTML file with no build step, no dependencies and no network calls after
the first load. Add it to your home screen and it works in airplane mode.

## Playing it

Open `index.html` in any browser. That is all it needs.

For the installable, offline, add-to-home-screen version it has to be served over HTTPS — see
*Hosting* below.

## How a run works

- **18 jumps**, split into three sectors. Each sector is five ordinary jumps plus a guardian that
  blocks the gate, and the third sector ends at the Leviathan.
- **A branching map** per sector, generated up front. You can see the whole sector and route
  through it — take the elite now to reach the broker two rows down, or slide left for the dock.
- **Crew** have a role (gunner, pilot, technician, engineer) and an origin (human, crystalline,
  insectoid, energy being). Three of a kind merge into a two-star member, and two of those merge
  again into three stars.
- **Synergies** unlock at two and four *distinct* crew sharing a role or an origin. A type already
  aboard counts for nothing — duplicates are merge material only.
- **The bench** is two bays holding either a crew member or a weapon. Benched things are completely
  inert — no synergy, no stats, no firing. It is storage, not capacity, so a full ship never has to
  turn down a find: the hire waits, the gun gets stowed, and you fit or sell it later. A benched
  crew member does still count toward a merge, which is the whole reason to keep a spare copy.
- **Relics** are permanent passives from loot, trading posts and the relic broker, stacking without
  limit. Most are mild. A few, lined up with the right crew, are absurd — deliberately, and rarely.
- **Sector modifiers** are weather that holds for a whole sector: an ion storm slowing every
  shield, a heavy patrol thick with elites. Most apply to the enemy too.
- **Scrap** buys crew, weapons, repairs and upgrades, and earns interest between jumps, so sitting
  on it has a real cost and a real payoff.

## Difficulty

Five tiers, each unlocked by winning the one below: Courier, Hunted, Blockade, Purge, Nightfall.
Penalties ramp in by sector rather than applying flat, because a flat penalty turned the first
guardian — mandatory, and impossible to flee — into a wall before the player had any tools.
Higher tiers also pay less salvage, so the economy tightens along with the opposition instead of
leaving a won hard run with more scrap than it could spend.

There are five ships as well, unlocked by play. Each removes a capability and overpays elsewhere
rather than shifting numbers: the Needle cannot fit a shield generator at all, the Hammerhead
carries four guns in a hull with three bunks.

## Hosting

Any static host works. All paths are relative, so a subfolder is fine.

Copy the repository contents to a directory your web server serves:

    scp -r ./* user@your-vps:/var/www/vega/

**Caddy** (fetches its own certificate), in the Caddyfile:

    vega.your-domain.com {
        root * /var/www/vega
        file_server
    }

**nginx** (HTTPS via certbot, for example), in the server block:

    location /vega/ {
        alias /var/www/vega/;
    }

Without HTTPS the game still runs in a browser, but offline mode and installing it as an app
will not work.

### Onto a phone

- **Android** (Chrome or Samsung Internet): open the page, menu, then "Install app" or
  "Add to home screen".
- **iPhone** (Safari): open the page, Share, then "Add to Home Screen".

Start it once with a connection. After that it runs offline.

### Shipping an update

Upload the new files and bump `const CACHE = 'vega-v3'` in `sw.js` (v4, v5 …). Phones pick up the
new version the next time they start online. Without the bump they keep serving the cached copy.

Saved runs from older builds still load — the relic and difficulty fields default to empty rather
than breaking the save.

## Layout

    index.html                     the entire game: logic, UI and styles
    sw.js                          service worker, offline cache
    manifest.webmanifest           PWA metadata
    icon-*.png                     home-screen icons
    dev/explore.js                 random-play balance explorer, see below
    dev/relics-design-notes.md     design and integration notes for the relic system
    dev/combat-readability-*       an unmerged prototype and its notes

`index.html` holds two independent scripts: a pure game-logic module (`VEGA`) with no DOM access,
and the UI on top of it. The logic module ends with a `module.exports`, so it can be loaded
directly in Node — which is how the balance was tuned, by running whole campaigns headlessly and
measuring win rates per build.

## Measuring the balance

    node dev/explore.js 20000 0 all

Plays 20000 random runs in about ten seconds and reports what correlates with getting further.
Two things about its method are load-bearing, and both exist because the naive version lied.

It measures from a snapshot taken at the **end of sector 1**, not from what winners finished with.
In a roguelite everything you accumulate correlates with surviving longer, because surviving
longer is how you accumulate it — tallying finishers would rate every relic as excellent.

And it **stratifies by ship and difficulty** before comparing. Pooled naively, the gunner synergy
measured strongly negative while being positive on all five ships taken separately, because two
ships start with gunners aboard and those two are independently the weakest. Simpson's paradox is
not hypothetical here; it already produced one confidently-reported wrong conclusion.
