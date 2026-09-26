# ammaarrehman.github.io

Personal ePortfolio of **Ammaar Rehman** — Information Systems student (Maryland),
AWS Certified Cloud Practitioner. Homelab and projects documented at
[github.com/ammaarrehman/homelab](https://github.com/ammaarrehman/homelab).

Hand-rolled design system: strict monochrome UI and ASCII art that carries
all the color, over ascii hands that reach for each other as you scroll. Type is all open source (SIL OFL): Instrument Serif for section
headings, Geist for prose, Cascadia Mono for the UI and the terminal.
Paper light mode follows the OS, with a ◐ toggle in the nav.

## Structure

```
index.html        single page
css/styles.css    the design system
js/head.js        runs before first paint: the site switches, js on, saved theme, whether the boot screen plays
js/theme.js       the 404 page's saved theme
js/skills.js      skills tabs (vanilla, no framework)
js/site.js        theme toggle, scroll reveal, nav scrollspy, card spotlight
js/windows.js     working traffic lights: minimize to the dock, maximize, restore
js/boot.js        vintage BIOS startup screen: first visit per session, and the footer's ↻ reboot
js/orb.js         the pink dot orb in the neofetch hero (+ a small one at contact)
js/world.js       pi's island (loaded on demand): warp, map, landmarks, dinos, the BMW, the helicopter, the cave terminal, day/night, the orb fight
js/audio.js       every sound, synthesized with Web Audio: sfx, ambience loops, a small music sequencer
js/face.js        hover the headshot and it decodes into terminal ascii
js/hands.js       the page background: ascii hands that reach as you scroll
tools/marks.py    ASCII brand toolchain (wordmarks, crescent, favicon)
assets/           ensō favicon (svg + png) + app icons, photo, resume, og.png (link preview card)
assets/work/      project screenshots, copied in from the project repos
assets/hands.json the ascii hands, as a character grid
404.html          lost-page screen (GitHub Pages serves it for any bad URL)
robots.txt, sitemap.xml, site.webmanifest   search + install metadata
.well-known/security.txt   how to report a security issue (.nojekyll makes Pages serve it)
```

## the orb and pi's island

The hero is a grayscale terminal window running `neofetch`: a profile
readout on the right, and on the left the orb (`js/orb.js`), a fluid AI orb
made of ~10k dots in two layers, drifting and breathing in pinks. It's a button. Click it and the page warps into
**pi's island** (`js/world.js`): a top-down pixel island you walk around as
pi. Every landmark is a piece of the portfolio: the rack is the homelab, the
desk is the Claude triage project, the uplink is the Terraform AWS build,
the watchtower is monitoring, the lighthouse is the security work, the
tablet is the academic record, the mailbox is contact. The boat sails back.
It's a jurassic island, built like a level in three terraces. The highland across the
north holds the volcano, the watchtower, the cave and an old shrine. A cliff band drops to
the meadows: the brachio meadow and the river in the west, the t-rex paddock, the clearing
where the trails meet, the raptor pen, the koi garden, and a headland with the lighthouse.
A second cliff band drops to the lowland on the south shore: the harbour village with the
dock, the helipad, the herd plain, and the outpost. The only ways up or down a cliff are
the stairs where a trail climbs it, so the trails are the chokepoints. The river rises on
the highland, falls off both cliffs and runs out to sea. The cliffs are tall rock faces with
cracks, ledges and hanging vines; forests are solid masses with ferns along their edges,
meadows stay open with tall grass and flowers, and trees and buildings cast baked, dithered
shadows. The volcano is rendered once as a lit heightfield, with a live lava lake and flows.

The creatures are pixel sprites in one sheet (`assets/island/dinos.png`), drawn in the
style of the pterosaur Ammaar supplied (that one is used pixel for pixel): flat tone bands,
dark along the back and light on the belly, a dark outline that goes near black underneath,
a few speckles. Each species is built from hand-placed silhouette curves and posed per
frame, with proportions from current reconstructions: a horizontal t-rex, a high-hipped
stegosaurus with two rows of plates, a brachiosaurus rising from long forelimbs, feathered
raptors, a sail-backed spinosaurus fishing the river. The cast: t-rex, raptors,
brachiosaurus, stegosaurus, triceratops, ankylosaurus, parasaurolophus, spinosaurus,
dilophosaurus (it fans its frill when it calls), a pair of head-butting pachycephalosaurs, a
skittish gallimimus herd, a flock of compys, babies by the nests, and pterosaurs round the
volcano (a twelve-frame wingbeat made by hinging the supplied sprite's wing at the shoulder,
three strokes then a long sinking glide, eyes open, the odd blink). They walk with
six-frame gaits, breathe, blink, graze and call, and big feet thud. Sizes follow one scale,
about 6 px to the metre (what pi and the robots already were), bent only where a true size
would be unreadable (compys, raptors) or would swallow the screen. pi is the little white
one it always was; evolved, pi becomes Middle Path: a small grey kaiju about pi's size,
spikes down its back and a stubby tail, drawn side on, facing the camera, and walking away.

A robot crew runs the place: cargo bots haul crates from the dock to the supply depot and
the visitor centre, drones fly parcels out to the landmarks, a welder patches the raptor
pen, and a gardener waters the ferns. The tech lives at an off-grid outpost in the
southwest: sandbag walls, a radio mast, solar panels, a generator, a campfire, and a bunker.
Some buildings open up: walk to the door and press e to go inside the bunker (the homelab
rack and the triage desk are in there), the visitor centre, or the depot. Trees and
buildings turn see-through when pi walks behind them.

His BMW M3 is parked on the coast road and a
helicopter sits on the helipad: walk up, press e, and drive or fly. The M3 has a drive and a
reverse gear (s or down when it's stopped), a torque curve, brakes that bite, and grip that
lets go on the handbrake (shift) so the back steps out and lays rubber. The island keeps real
time in Ellicott City (America/New_York), with sunrise and sunset worked out for the date.
`?islandhour=22` previews any hour.

Each landmark holds a log (its card). A log counts once its card has been open a second
and a half, and eight pips in the HUD fill as they're found. Four logs wake the terminal's
`evolve` command. The old shrine is sealed until all eight: then the camera cuts to it as the
seal breaks. The first time a winner is crowned, a short credits roll ends on a contact card
(email, LinkedIn, the résumé), and after that everything is open. Progress lives in one
versioned save in this browser (the logs, whether pi evolved, where pi was, the comfort
settings, who holds the core); a bad or unknown save just starts fresh.

Find all eight landmarks and the island asks first (it says the fight is loud and flashes,
with the flash switch right there), then the orbs fall out of the sky and fight for control
of the site; the winner recolours the hero orb until the page reloads, and a restore site
button in the HUD puts everything back at any point. Every clash tears
reality open from the point of impact and the island underneath is somewhere else: the
jurassic island, a neon future city (every tree a lit tower, roads of light, flying
traffic), or chaos (ink on paper, a black nervous system of strands and spheres, flickering
neural connections, grain everywhere), and the tear closes when a winner is crowned. The
orbs range over the whole clearing and each fights its own way: eclipse charges, bone binds
its target into a death spiral like a binary star, halo fires beams, fog blinks out and
unfolds beside its target, and void opens a gravity well and drags it in. Every hit is two
stars colliding: the screen whites out, a fireball swells from the impact, a field of
pressure rolls out across the island, embers scatter, the ground is scorched, and a killing
blow is a supernova. When the orbs wake the island goes silent: no surf, no birds, no music.
Then a score of pure dread creeps in (a sub drone, a cluster that slowly opens, a heartbeat
that quickens with the fight, a tolling bell, something groaning a long way off) and it
never turns into a tune.

Up on the highland, at the end of a trail from the brachio meadow, there's an old shrine
(the gardener bot won't go near it). Step through and the island turns side-on: a painted
sky that sinks into a starry dark as you climb, and at the top the first orb, which turns
through violent colours and splits into copies of itself as you close in. There's
also a terminal left logged in, in a cave at the foot of the volcano (a robot will
tell you). It has `help`, `ls`, `cat`, `neofetch`, `census`, `goto`, `time`,
`feed koi` and more, and the hidden files explain how to summon the fight early.

It plays like a small top-down game: pi reaches its pace in about a tenth of a second,
squashes as it sets off and stretches as it stops, shift runs, the camera follows the same at
any frame rate and leads a tile and a half ahead, footsteps land on the walk cycle and kick up
dust and prints, ferns rustle, birds scatter, and a minimap (bottom right on wide screens)
marks the landmarks you've found. Doors, fast travel, the shrine and landing all close and
open an iris on pi while the music is swept down to a muffle and back. The world notices pi:
compys scatter, the raptors pace their fence to keep level, the brachiosaurus lowers its head
if pi stands beside it, dinosaurs doze at night (fireflies come out over the meadow), and the
bots turn and say where the nearest log is, pass on a rumour, or tell a joke. Twelve secrets
are kept in one table: each pops a toast when found, and the terminal's `secrets` lists
them. Every special move in the fight is telegraphed for 150 ms, and each hit freezes for 70. The
dinosaurs have six-frame walks (a four-beat gait for the quadrupeds), breathing idles,
blinks, grazing, and a roar.

Sound is all synthesized in the browser (`js/audio.js`): footsteps that change with the
ground, surf, insects, the volcano's rumble, the rotor and the M3's engine, the t-rex, the
orb fight, a little chiptune loop for each terrace (crossfading as pi climbs, slower and
darker at night, ducked under an open card), and dark scores for the shrine and the fight. It starts on the click into the island, `m` or the ♪ button mutes it, and the ⚙
settings panel has levels for the master, music, effects and ambience, a button that
restarts the sound engine, and comfort switches for screen shake, bright flashes and the
minimap. Everything is remembered in this browser.

- keyboard: wasd / arrows to walk (by key position, so AZERTY works), shift to run, e / space / enter to use, m for the map, p or esc for the menu (the ♪ button mutes)
- one verb: whatever is in reach gets a single prompt, [E] read · experience or [E] drive, and on touch the prompt is the button (getting out of a vehicle beats a door, a door beats a landmark, a landmark beats an animal)
- the map (m) is the whole island with every found landmark named; pick one to travel there
- first steps: the first landing has a landmark on screen, a walk hint sits beside pi until it moves, and if 20 seconds pass without a new log a chevron at the screen edge points at the nearest one. on touch, dragging anywhere makes a joystick
- pointer: tap anywhere to walk there (breadth-first pathing), tap a landmark to walk up and look
- the menu lists all eight landmarks (pick one and pi goes there with its card open), the tour, settings, and back to portfolio
- the tour (HUD or menu) visits every section in about a minute: space skips, esc stops, it ends on the contact card. on a phone the title card offers it first
- `#island` in the URL opens it directly, `#island/experience` (or any landmark or section name) opens that card, `#island/tour` starts the tour
- every landmark card is named twice (the lighthouse · experience) and its facts are the main page's own words
- `?debug=1` shows frame time, particles, audio voices, canvases, state and the save; `?seed=n` makes the fight repeat exactly
- first visit per session: pi hatches from an egg in the village square

The background (`js/hands.js`) is two ASCII hands after the Sistine ceiling,
rendered from `assets/hands.json`. They reach toward each other as you
scroll and spark at the bottom of the page.

Reduced motion: no warp (a plain cut), still orb and hands, no typing effect, and on the
island no shake and no flashes by default. Every flash goes through one gate: at most three
a second, and with bright flashes off a whiteout is soft and nothing inverts the screen.
Screen readers get the cards whole, the canvas is a labelled application, and a polite live
region names the landmark pi is next to and each log found. The island runs on a fixed 60 Hz
step and pauses when the tab is hidden.

Glows are sprites drawn once and stretched rather than gradients built every frame, the
fight's particles sit in a capped pool, a quality tier sheds the heaviest effects if frames
run long, and the other realities' art is let go once the tear closes.

The pages send a strict Content-Security-Policy (`script-src 'self'`, no inline scripts or
styles), and every link that opens a new tab has `noopener noreferrer`.

## sections

Below the hero every section is a terminal pane: the title sits in the
border, a command line shows what "printed" it (`cat about.md`,
`git log --format=career`, `ls -la ~/projects`), then the output. Grayscale
throughout; pink is reserved for the orb and for things that are live or in
progress. Project cards are small windows whose screenshots stay grayscale
until hovered.

## Running, switches and deploying

- Run locally: `python3 -m http.server 8000` in the repo, then open http://localhost:8000.
- `js/head.js` holds the site switches. `GITHUB_LINKS_ENABLED` is false while the GitHub account
  is flagged (repo buttons hide, other github links read as plain text); set it to true to bring
  them back.
- Scripts and the stylesheet carry `?v=YYYYMMDD` in `index.html` (and the island's own paths in
  `js/site.js` and `js/world.js`). Bump it everywhere together whenever a script or the CSS
  changes, so returning visitors get the new files.
- Deploying to ammaarrehman.com: `node tools/deploy.mjs` (`--dry-run` only builds and checks;
  `--check` only runs the live checks). Everything about hosting, including the one-time Cloudflare and GoDaddy steps and how
  to undo them, is in `docs/hosting.md`. `wrangler.jsonc` and `_headers` are the Cloudflare
  config. `AUDIT.md` tracks the site audit.
- Hosting split: the main site is on Cloudflare, not the Pi, so a home outage only takes down
  `lab.ammaarrehman.com`. Moving the whole site onto the Pi later would take two changes: point
  the tunnel's public hostname for the apex at the Pi, and remove the Worker's custom domain.
  Not planned.

## Regenerating the marks

```
pip install pillow pyfiglet
python3 tools/marks.py            # prints wordmark + crescent HTML
python3 tools/marks.py favicon    # writes assets/favicon.png
```

© 2026 Ammaar Rehman
