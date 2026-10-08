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
- **Crew** have a role (gunner, pilot, technician, engineer) and an origin (human, crystalline,
  insectoid, energy being). Three identical crew merge into one with more stars.
- **Synergies** unlock at two and four of the same role *or* origin. Because every crew member
  counts toward both, stacking four of one kind pays into two tracks at once — that is where the
  genuinely broken builds come from.
- **Relics** are permanent passives from loot, trading posts and one vault event. A few are mild.
  A few, in the right build, are absurd.
- **Scrap** buys crew, weapons, repairs and upgrades, and earns interest between jumps, so sitting
  on it has a real cost and a real payoff.

## Difficulty

Five tiers, each unlocked by winning the one below: Courier, Hunted, Blockade, Purge, Nightfall.
Penalties ramp in by sector rather than applying flat, because a flat penalty turned the first
guardian — mandatory, and impossible to flee — into a wall before the player had any tools.

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
    dev/relics-design-notes.md     design and integration notes for the relic system

`index.html` holds two independent scripts: a pure game-logic module (`VEGA`) with no DOM access,
and the UI on top of it. The logic module ends with a `module.exports`, so it can be loaded
directly in Node — which is how the balance was tuned, by running whole campaigns headlessly and
measuring win rates per build.
