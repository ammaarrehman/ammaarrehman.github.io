# pi's island: game design

The source of truth for the island game. It combines handoff 2 Part D with handoff 3's changes
(Parts E to J) and Ammaar's decisions. Update it whenever something here is built or decided.
Status marks: **built**, **partly built**, **planned**.

## Pillars

1. **Respect the visitor.** Portfolio content is never gated, and everything can be skipped. pi can be
   "ended" only by lava and by falling in the Climb; it respawns at the last checkpoint with nothing lost.
2. **A tiny hero in a big, busy world.** pi is small; the world is dense with life.
3. **Real skills as game verbs.** Scan, segment, patch, rotate credentials, fail over.
4. **Curiosity pays.** Every detour has a reward.

Game text may say nothing about Ammaar beyond approved site copy (AUDIT.md). No em dashes. Nothing from
any film or franchise: no names, quotes, iconic scenes or creature designs.

## The setting: Mossgate Reserve

A dinosaur reserve that robots run; pi is its newest intern. The home island holds the core game and
its habitats; the other regions are separate islands, each its own habitat, and reaching one is earned
with a tool, a repair or a quest. All eight portfolio logs stay on the home island. The cyber metaphor lives only in NPC dialogue (regions are network
segments, crossings are gateways, the Field Guide is an asset inventory).

World plan (MAP-B r2.1, approved by Ammaar 2026-10-03). Its B1 blockout is complete as staged data in
`tools/` (2026-10-07; "Technical", MAP-B B1), not runtime-active and not deployed. The home
island becomes "Harbour Crescent", about 138 x 103 tiles of island on a 150 x 120 map, with the south
harbour as the reserve's transport hub. It has exactly three exits: the south harbour, a restricted
service jetty in the west, and the north-west rope bridge to Ashpine. The satellites are conceptual:
no satellite maps, ferries, boats or map switching exist. Production still runs the original 100 x 80
home island.

| Region | Where | Habitat | Crossing | Signature moment | Status |
|---|---|---|---|---|---|
| Home island | the core | Harbour Crescent: harbour, village, ops, commons, riverlands and delta, koi garden and lighthouse headland, research, highland and volcano | none | the portfolio | built as the original 100 x 80 island; the 150 x 120 redesign is approved and blocked out as staged data (B1), not in the game |
| Cinder Reach | the home island's volcano, expanded | lava, basalt, steam vents | a switchback trail from the highland hub | the summit view; vents launch pi to ledges | planned |
| Hornfield | north-east satellite, core reserve | large-herbivore savanna | public ferry from the south harbour | a herd crossing at dawn | planned |
| Reedmarsh | east / south-east satellite, core reserve | wetland, boardwalks | public ferry from the south harbour | the Parasaurolophus chorus at dusk | planned |
| Ashpine Heights | north-west, an adjacent mountain extension over a gorge | cold conifer forest, mist | a rope bridge from the north-west cape, mended after the Edge | T. rex footsteps you feel first | planned |
| Ironwood Keep | south-west satellite, restricted reserve | predator keep, high security, research; the future main home of the large predators | a restricted service barge from the west jetty | the containment breach (Phase 17) | planned |
| Server Key and the reef | remote, far south; restricted, late game | data center, reef, wreck | a restricted line from the south harbour | the CTF, the live homelab wall, diving | planned |

Until Ironwood exists, the T. rex stays on the home island (in the redesign, a small holding paddock).
Open sea is kept to the east, west and north for later islands.

Secret crossing: at a narrow bend a Brachiosaurus lowers its neck to eat a cycad frond from pi, and pi
walks across along its neck. Once, and it counts as a secret.

## Mechanics

| Mechanic | Input (handoff 3 F4) | Spec | Status |
|---|---|---|---|
| Walk | WASD / arrows; touch joystick; left stick | | built |
| Interact | E / Enter; the prompt bubble; A | | built |
| Jump | Space; jump button; B | clears 0.5-high things and 1-tile gaps; can't jump up a level; coyote 80 ms, buffer 100 ms; the shadow stays on the landing spot | planned |
| Sprint | hold Shift (handbrake in the car); LB | 1.5x, drains stamina | planned |
| Crouch | C (hold or toggle); right stick click | 50% speed, quiet steps | planned |
| Camera | F; X | frame a species, hold 0.5 s: Field Guide entry | planned |
| Scanner | Q; Y | hidden cables, "open ports", CTF hints | planned |
| Map | M; Select | | built |
| Pause | Esc / P; Start | | built |
| Heights | map layer 0 to 5 | 3/4 view: higher ground drawn above its own cliff face; change level only by stairs, ramps, ladders, vines, vents; drop off `ledge` edges; no fall damage | planned |
| Stealth | | vision cones and hearing radii; pi's noise: sprint 6 tiles, walk 3, crouch 1, still 0; night halves sight, rain cuts hearing a third, tall grass hides a crouched pi; "?" curious, "!" aware, each with a sound | planned |
| Swim, dive, carry, push, boat | | as in handoff 2 D3 | planned |

Never bind anything that uses Ctrl or Cmd.

## Creatures

Size scale: 6 px per metre; anything under about 2 m is drawn larger than life and the Field Guide says
so. Every Field Guide fact has a source URL in a code comment beside it, and says plainly when an animal
isn't a dinosaur or when science is still debating it.

Current 14 (+ the pterosaur): T. rex, Utahraptor (feathered; renamed from the film-style raptor),
Brachiosaurus (redrawn: high shoulders, sloping back, nasal arch), Stegosaurus, Triceratops,
Parasaurolophus, Ankylosaurus, Spinosaurus, Dilophosaurus (no neck frill, no venom spit), Pachycephalosaurus,
Gallimimus, Compsognathus, two babies, and the Pteranodon-style pterosaur.

Animation (built): `tools/animate.py` rigs the hand-drawn sprites cut-out style into 12-frame walks,
12-frame breathing idles, 8-frame grazes and 6-frame calls, played at 8 to 22 fps. Soft cool shadows.

Planned (handoff 3 G2), up to about 24 species: Styracosaurus, Edmontosaurus, Protoceratops, Baryonyx,
Deinosuchus (a crocodile relative, not a dinosaur), Quetzalcoatlus, Therizinosaurus, Troodon, Microraptor.
Schedules (feed, drink, rest, sleep), weather reactions, herds following a leader, at most 40 creatures
fully simulated near the screen and the rest at 4 Hz. One synth family for every call.

## NPCs (all robots, original names)

| Name | Role | Where | Quest |
|---|---|---|---|
| Tally | cargo foreman | dock | Q1 Lost Cargo |
| Weld | welder | harbour workshop | supplies Q2's bulb |
| Lumen | lighthouse keeper | headland | Q2 Dark Lighthouse |
| Moss | gardener | koi garden | Q3 Thirsty Garden |
| Fern | dinosaur keeper | paddocks | Q4 Field Guide, Q5 Stray Herd |
| Sentry | drone captain | outpost | Q8 Signal; announces events |
| Root | sysadmin | Server Key | Q7 Root Access, the CTF, the live wall |
| Wade | ferry keeper | the Ford | Q10 The Ford |
| Heron | boardwalk keeper | Reedmarsh | Q11 Boardwalk |
| Cinder | volcano researcher | volcano trailhead | Q12 Rim Sensors |
| Pine | forester | Ashpine | Q13 Night Watch, Q14 The Keep |

Each has day, night and rain routines between a home spot and a work spot (walked, never teleported),
greets pi, has its own chirp, three hint lines and one line on its region's Field Guide progress.
Dialogue is data-driven. Status: planned (today's bots have barks only).

## Quests

Q1 Lost Cargo, Q2 Dark Lighthouse, Q3 Thirsty Garden, Q4 Field Guide, Q5 Stray Herd, Q6 Nest Egg,
Q7 Root Access, Q8 Signal, Q9 The Wreck (handoff 2 D6); Q10 The Ford, Q11 Boardwalk, Q12 Rim Sensors,
Q13 Night Watch, Q14 The Keep (handoff 3 H3). A Quests tab in the pause menu. One Playwright scenario per
quest. Status: planned.

## The CTF (Phase 9, handoff 2 E1)

One reusable engine with six flag slots (`js/world.js`, "the ctf"). Each flag is data: a stable id
(`ctf-<slug>`, never renamed or reused), its slot, when it is open, a SHA-256 hash of its answer,
hints and a write-up. A guess is normalized (case, spaces, hyphens and underscores, an optional
`flag{...}`) and hashed with the flag's id through Web Crypto. The hash only keeps answers out of plain
sight in the source: this is a game in the browser, so anyone reading the code can still work every
flag out. No backend, no leaderboard, no network call.

The cave terminal is an early access point to the engine, not the CTF's narrative home. Its `ctf` (or
`flags`) board shows all six slots, open or offline; `submit`, `hint <n>` and `writeup <n>` work on
them. Any later terminal (Root's, at Server Key) calls the same engine, with no migration.

A solve is `save.flags["ctf-<slug>"] = true` in save v2, so no save-version bump was needed. Hints and
write-ups are data. A hint or a flag can wait on a condition (`tool:`, `flag:`, `secret:`, `log:`,
`island:`); the Phase 11 Scanner opens or unlocks things by setting `tools.scanner` or a story flag,
without changing the CTF's data model. Answers are never written into the repo: `tools/ctfhash.mjs`
makes a flag's hash from an answer typed at a prompt that doesn't echo it.

| Slot | Flag | Phase | Status |
|---|---|---|---|
| 1 | Fence Logs | 9 | built: `fence.log` in the cave terminal, a fence controller's log using only RFC 5737 documentation addresses. The player correlates the successful sessions with three unscheduled fence tests, past a noisy source that only fails to log in. One hint, always available. The write-up teaches correlating time and source, and not being drawn by the loudest line. |
| 2 | Radio Static | 9 | built: the bunker radio's display shows a Base64 payload; the terminal decodes it with `echo <text> \| base64 -d` (or `--decode`), a deliberately narrow path with no encode mode and no general pipes. One hint, always available. The write-up teaches that Base64 is encoding, not encryption. |
| 3 | reserved | 11 | planned, with the Scanner |
| 4 | reserved | 12 | planned, with the cave's tunnel and chamber |
| 5, 6 | reserved | 18 | planned, at Server Key with Root, the CTF's full narrative home and any reward for all six |

The answers are not documented anywhere. Status: slots 1 and 2 built and deployed 2026-10-02 (cache `20261022`); slots 3 to 6 offline until their phases.

## Weather and events (handoff 3 Part I)

Open-Meteo (Ellicott City town centre, 39.27, -76.80, rounded; never the visitor's location), at most one
request per visitor per 15 minutes, cached; NOAA SWPC Kp for an aurora at Kp 5 or higher, only if the
endpoint sends CORS headers. Both credited; both added to `connect-src`. A failed fetch falls back to a
seeded seasonal default and never shows an error. The events director: one event at a time, checked once a
minute, from real conditions, the calendar (full moon, meteor showers, seasons, holidays) and the game.
Weather never blocks a quest or touches the portfolio cards. Status: planned.

## The Climb (handoff 3 Part J; replaces the old secret scene)

The shrine (8/8 logs plus the confirm) leads to a side-view climb in five sections (Willow Hollow, Root
Stair, the Old Aqueduct, Windward Ridge, the Chimney), then the Edge (a calm vista, composition from
ref-1, all drawn original), then the orb: a black dot rises behind the ruined relay tower, the world goes
dark layer by layer, far to near, and pi last. Nothing flashes. Dialogue in the black, variant A:

1. "You climbed a long way to see this."
2. "Everything below was drawn by someone. He is not here."
3. "The signs you read down there are true. That is the one rule of this place."
4. "Go back to where you started."
5. "He is there."

Then 2 s of silence and the reboot. Afterwards `edgeSeen`, the Ashpine bridge is mended, and the shrine
offers "Return to the edge". Skip options and assist settings throughout. Audio per handoff 3 J7 on
handoff 2 C3's dread engine. Status: planned (the old side-scroller scene is still in place).

## Middle Path, the kaiju

pi's evolved form, from a drawing by Ammaar and his friends. Option A (built): the same grey, pi's
rounded head and round eyes, soft rounded back bumps (no plates or spikes), a small smile, and circuit
lines on the tail that glow after dark; its own synth growl. It can drop but not jump, lands with a stomp,
and may wade lava-edge tiles but not deep lava.

## Art direction (handoff 3 Part D)

One master palette (`art/palette.json`): cool blue-violet shadows, warm yellow highlights, no pure black.
Light from the top left; every prop and creature casts one soft pre-rendered shadow to the lower right at
about 35%. Rock 4 to 5 tones, foliage 4 plus a highlight, wood 3 to 4, water 4 plus a light rim. Outlines
in each material's own darkest tone. Tall things show a lit top above a darker front. Clusters, not
scatter. Edges wander off the tile grid. Water: lighter shallows, a light rim, clustered reeds and lily
pads, stones under the surface, subtle sparkles, foam under falls. Cliffs: vertical stone slabs darkening
toward the foot, grass hanging over the lip. Tiles are 16 px.

Status: Ammaar approved the test area on 2026-09-28 and the whole home island is converted. One ground
painter for the map: the coast follows `coast()`, the river and roads their curves, the cliffs the
terraces' smooth edges (`hiEdge`, `midEdge`) and the coast where raised ground meets the beach. Grass
has four kinds per terrace (lowland: short, lush, dry, sandy scrub; meadows: short, lush, dry, fern
floor; highland: moss, short, heath, fern floor). Trees per terrace: lowland palm, buttressed fig,
tall tree fern; meadows oak, birch, ginkgo, the odd monkey-puzzle; highland monkey-puzzle, dawn
redwood, ginkgo. Undergrowth, tall grass, rocks and nests come from `img/atlas/env.png`; buildings,
landmarks and man-made props from `img/atlas/props.png` (`tools/atlas.mjs`), still in their older
drawn look apart from recoloured outlines. The cave entrance is built; its tunnel and chamber are not.

## Technical

Saves: `island-save` in localStorage, v2 (built 2026-09-30, Phase 8 D11-A). v2 adds `island` (the id
of the island pi is on, `"home"`), `quests`, `dex` and `cosmetics` (maps from an id to a boolean, number
or short string), `flags` and `tools` (maps from an id to a boolean; CTF solves are `flags` entries named
`ctf-<slug>`), and `edgeSeen` (a boolean). Ids are
lowercase with hyphens, up to 32 characters, at most 64 per map. A v1 save migrates on load with nothing
lost (`tools/scenarios.mjs` tests it); a newer version is never written over. The fullest possible save
is about 27 KB, under the 50 KB budget. A later phase that needs a richer value adds a v3 migration.

Map layers (built 2026-09-30, Phase 8 D11-B): three typed arrays, one value per tile at `y * w + x`.
`GROUND` (Uint8) holds the tile codes; `HEIGHT` (Uint8) the level, 0 to 5 (the home island uses the
three terraces, 0 to 2); `COLL` (Uint16) collision bits: `solid` 1, `shallow` 2 (sea shallows, the
pond, the river), `deep` 4, `low` 8, `ledge` N/E/S/W 16/32/64/128, `lava` 256, `climbable` 512. A tile
can be walked when none of solid, shallow, deep or lava is set. `low`, the ledges and `climbable` are
reserved for Phase 11 and unset.

Map data (MAP-A, 2026-10-02; live since 2026-10-03, cache `20261023`, the same island as before): the home island's geography is authored data, `js/maps/home.js`, and
that file is its source of truth; nothing generates the island any more. Format 1. It loads
synchronously just before the island (`audio.js`, then `js/maps/home.js`, then `world.js`, all with the
same `?v=`) and registers `window.ISLAND_MAPS.home`. `decodeMap()` in `world.js` checks a map and returns
the game's own copies (it never changes the registry); a map it refuses stops the island with a message
naming the field, and the orb says the island didn't load (a retry works).

- What the file holds: `id`, `source` (the commit it came from), `tile` (16), `w` and `h` (tiles, at most
  256 x 256); the layers as one row string per tile row: `ground` (a hex digit per tile), `height` (0 to
  5), `coll` (the final collision flags per tile, a base-36 index into `coll.values`); `footBlock`, extra
  pixels where feet stop on tiles `coll` lets them onto, `[py, x0, n, x0, n, ...]` per pixel row, rows going
  up, runs in order with gaps between them, inside the map and never on a tile `coll` already blocks
  (decoded to one bit per pixel); `props`, every prop with its fields in order; `shapes`, what the ground
  is painted from (coast, terrace edges, pond, plaza, river and road curves, volcano, woods) and
  `decals` (bones, footprints); `buildings` (footprint, room), `stations` (outdoor landmarks' places; their
  words stay in code), `anchors` (spawn in world px, helipad, dock, gate) and `regions` (paddocks, the
  outpost compound).
- Placements (B0, 2026-10-03; live since 2026-10-03, cache `20261024`): where things start and roam, in tiles, also in
  `home.js`, so no exterior home position is duplicated in `world.js`:
  - `spawns`, the 33 creatures in order (kind, start tile, roam id), and `regions.roamAreas`, one record
    per roam area. Creatures naming the same id share one area object (the herd follows its leader by
    that identity: the raptors share one, the herd plain's four another); two ids are two objects even
    when their boxes match, so 28 records for 33 creatures, 12 of them repeating a box.
  - `routes` (the welder's patrol: start and stops); `anchors.car`, `rex`, `gardener`, `firstVisit` and
    `arena`.
  - `places`, the goto spots with a fixed tile, in listing order. `heli` and `helipad` stay goto names
    but have no spot: goto sends pi to wherever the helicopter is parked.
  - `regions.zones`: `trex-roar` (pi strictly inside; edges may be fractional, 41.5), `rex-meadow`,
    `gardener-beds` and `cockatiel-trees` (whole tiles, both edges in), `fireflies` (spread over the box).
    Each system reads its zone's edges its own way; the format has no shared edge rule.
  - Derived, not stored: the cargo stops are the depot's and visitor centre's doorways
    (`floor(x0 + w / 2), y0 + h`), each one object the cargo legs compare by identity; the drone pad is the
    depot's roof (its middle, top row + 6 px, 30 px up). The big map is 3 px a tile, so 300 x 240 now.
  - Optional in the format (`decodeMap()` accepts a map without them), required by the home island: it
    stops with a message naming what's missing (spawns, roam areas, the welder's route, the actor
    anchors, places, the arena, core-approach and first-visit anchors, the five zones).
- Not in it: prose, creature kinds and behaviour, quests, the CTF, saves, station-backed goto names, and
  offsets and art constants (the car's heading, the drone roof height, the orb field).
- The core approach (fixed after B0; live since 2026-10-03, cache `20261025`): through B0, tapping the core after the orb fight sent
  pi toward 36,25 / 36,26 (where the arena used to be, before it moved to 48,43 in `a28541f`), and the
  path ended at 36,27, nowhere near the fight. Now the tap plans toward `anchors.coreApproach`, 48,44,
  the authored target: one row south of the arena, the side the core has always been used from, on open
  grass. It's optional in the format, required by the home island, and `decodeMap()` refuses one that
  can't be walked or isn't on or next to the arena, so the arena can't move without it. The tap still
  plans loosely, as for every landmark: pi stops wherever that planner validly stops, on the target or a
  tile next to it (not necessarily on 48,44). `CX` / `CY` in `world.js` are dead (only the tools read
  them); removing them is later cleanup.
- Collision: gameplay collision = authored `coll` + authored `footBlock`. Feet stop where the tile's
  `COLL` blocks or the pixel's `footBlock` bit is set, and nowhere else. The painted ground (`GK`) is a
  picture only; it never decides where pi can stand (`tools/map-parity.mjs` repaints it and checks that
  no blocked pixel, step, safe tile, landing or route moves).
- Derived at runtime, not source: `GK` and the painter's noise, the woods' shade (`FO`), the water
  distance, `FOAM`, the curve samples and their grid, `FALLS`, `DEPTH`, the fence and wall tiles, the
  nests list, the minimap and full map, `STEPOK`, `SAFE`, `landTile` and `canLand`.
- Consistency `decodeMap()` checks, the old generator's own rules: building footprints solid and their
  doorways walkable; outdoor landmarks on land solid (the boat stands in the water); spawn on a tile pi can
  walk; the helipad on a pad tile; the 2 x 4 dock tiles below the dock anchor; the gate's two posts solid;
  paddock fences and the compound's walls solid where there's land; trees, nests, lamps, the outpost's kit
  and crates on solid tiles; every tile under the volcano's cone solid. Cliff rims aren't checked:
  Phase 11's ledges change that model.
- Legacy shapes: the shape types (harmonic-blob, sine-edge, wobble-ellipse, disc, the curves) exist to
  reproduce the original procedural island exactly. The redesigned 150 x 120 island is not bound to them.
- More islands: the registry and format can hold others (`hornfield`, `ironwood`, `server-key` in the
  masterplan), but only `home` exists, and the game doesn't switch maps.
- Provenance: `tools/map-export.mjs` exported `home.js` from `js/world.js` at
  `715450d4c6efca6a24f7cf21e64fdd25ad38eaba`, the last revision that generated the island (`--check`
  compares a fresh export with the file). The tests: `tools/map-parity.mjs` (`715450d` against the working
  tree, every layer, pixel, picture, cache and seeded behaviour; planted mutations of `home.js`; art apart
  from collision; the load failing and recovering), `tools/map-decode.mjs` (`decodeMap()` on synthetic
  maps, a 150 x 120 one among them, and every way of getting one wrong), and `tools/map-baseline.mjs
  --rev=<rev> --check` (any revision against the D11-B fixture).
- B0's tests: `tools/b0-parity.mjs` (`715450d` against the working tree: every placement, the roam-area
  identity graph, the cargo-stop identities, the drone pad, a 3,000-step seeded run, goto with the
  helicopter parked in three places, the roar zone on a 4 px grid, rex's wander, the gardener's beds, the
  core tap; 19 planted mutations, 18 of `home.js` and 1 of `world.js`, goto heli). The core tap is checked
  against `anchors.coreApproach`, not the reference, with its own regression (four sides, the approach moved,
  the arena moved alone, no literal left in `world.js`).
- Saves: `SAVE_V` is still 2. MAP-A and B0 changed no save field and migrated nothing.
- Geography: production is still the original 100 x 80 island (`js/maps/home.js`, format 1). The
  150 x 120 MAP-B island exists only as the staged B1 blockout below; the game doesn't read it.

MAP-B B1, the staged blockout (2026-10-07; complete, not runtime-active, not deployed):
- Pipeline: `tools/maps/home.src.mjs` (the authored source: named coast points, levels, water, corridors,
  planning metadata) goes through the deterministic compiler `tools/map-compile.mjs` (helpers in
  `tools/maps/geom.mjs`) to `tools/maps/staged/home.js`, a format-2 draft that registers
  `window.ISLAND_MAPS_STAGED.home` with `runtimeSupported: false`, never `ISLAND_MAPS`. The compiler
  refuses to write under `js/`. `tools/map-lint.mjs` checks it (71 checks and 82 deliberate-break
  self-tests, 153 in all) against five frozen fixtures, never rewritten: `tools/fixtures/mapb-r21.json`
  (coast), `mapb-r21-levels.json`, `mapb-r21-water.json`, `mapb-r21-infra.json` and `mapb-r21-plan.json`;
  `mapb-staged.json` holds the accepted builds (`map-lint --accept --reason=...`). Coordinates are tile
  space; every rectangle is an inclusive `...Box` `{x0, y0, x1, y1}`.
- Production still loads `js/maps/home.js`, the 100 x 80 format-1 island, which B1 never overwrote. The
  staged files live under `tools/`, which the deploy bundle excludes. B2 teaches the game to read and
  draw the staged island locally; switching production over is a separate, approved release later.
- Geography (locked, Harbour Crescent r2.1): 150 x 120 tiles; 10,257 land tiles, x 6 to 143, y 5 to 107;
  80 named coast control points; 0 drift from the frozen r2.1 coast.
- Elevation: level 0 3,413 tiles, level 1 4,111, level 2 2,225, level 3 508; exactly 8 ramps (main path,
  park gate, shrine stairs, service road lower and upper, headland stairs, lantern-cove steps,
  riverlands-delta trail); levels change only inside a ramp.
- Water and volcano: the main river 260 tiles, the delta branch 39, the koi pond 52, the tarn 11, the
  delta lagoon 20, the reed marsh 31 (the only water that meets the sea); exactly 2 river mouths and 2
  waterfalls (level 2 to 1 and 1 to 0). The volcano's cone, scree and crater (160, 246, 20 tiles) are
  sealed, solid, for Cinder Reach later.
- Infrastructure: exactly 3 bridges (upper, brachio, delta) and 2 dock structures (the south harbour quay
  and ferry pier; the west Ironwood service jetty); the north-west Ashpine bridgehead; the helipad.
  9,194 walkable tiles, one connected piece.
- Districts (8): harbour-arrival, village-services, ops-security, meadow-commons, riverlands-delta,
  koi-garden-headland, research-security, highland-volcano-cave.
- Exits (3, future): the south harbour; the west restricted jetty to Ironwood; the north-west bridgehead
  to Ashpine. No east pier and no south-east slip. The satellite islands aren't built, and no ferry or
  map-switch logic exists.
- Planning reserves (metadata only; no tile comes from them): footprints for the visitor centre 9 x 5,
  ferry terminal 6 x 4, ranger HQ and depot 7 x 4, bunker 7 x 4 inside the bunker compound, research
  station 8 x 4, raptor house 5 x 2, workshop 6 x 4, post office 5 x 4, cafe 5 x 3, keeper cottage 4 x 2,
  koi pavilion 4 x 3, lighthouse base 2 x 2 and tower base 3 x 3; the cottage-row reserve; the koi-garden
  compound; the rift-arena clear space (191 tiles); markers for the cave approach, the volcano trailhead,
  the park gate and the research gate.
- The shrine is a planning marker only: marker `[14,19]`, approach `[14,20]`. The study's old 3 x 3 base
  conflicts with B1b's stricter cliff geometry, and the nearby clean alternative would cover the approved
  route endpoint. B3 decides the shrine's final structure and footprint.
- Habitats (11, planning metadata only; no runtime fences, roam areas, creature spawns or containment):
  the temporary T. rex holding paddock and the raptor yard (both to be contained, in research), the
  riverlands range, brachio meadow, spino reach, delta wetland, galli meadow, pachy heath, dilo strip, the
  koi garden (walled) and the village gardens. Herbivore areas stay relatively open and natural; predator
  and research areas are contained later. The T. rex's holding paddock on the main island is temporary;
  its long-term principal habitat is Ironwood.
- Scale (planning and sanity metrics, not gameplay guarantees): the all-logs tour between the 7 planning
  log sites is 333 tiles, about 92 s walking and 57 s running; the longest route from the arrival is 134
  tiles, about 37 s walking.
- Projected solids: 9,194 walkable now; with every B1e reserve made solid, 8,725 walkable and 8,638
  reachable. The difference from the study's historical 8,693 is understood (the approved smaller visitor
  centre, depot and lighthouse footprints, later landmark station solids, the shrine footprint left
  unresolved, the stricter cliffs). 8,693 is not an implementation target; don't force it.
- B2 (next; runtime format, painter and local preview): runtime support for the new format with format 1
  intact; a generalized painter (the coast, four levels, several water bodies, the river and its two
  derived falls, cliffs dropping into the sea, ramps) whose pictures line up with the collision; corridors
  drawn from the authored lines, checking that the thin diagonal trails draw as continuous strokes where
  their tiles meet only at corners; the `footBlock` and shoreline decision; a dev-only staged loader;
  Chromium and WebKit screenshots; performance, memory and ground-paint cost at 150 x 120; the big map at
  450 x 360 and at a 390 px viewport. B2 doesn't switch production to MAP-B and doesn't start B3
  (buildings and content).

MAP-B B3b, the content architecture (2026-10-09; staged only, not deployed; no content migrated):
- The B3a decisions it follows: D1 as modified (a building keeps its whole B1e footprint reserved, but its collision is
  never larger than what it draws; placeholder art comes with each building), D2 to D11 as proposed (vegetation with
  explicit performance and accessibility limits, its own batch), D12 (the old saved position) deferred to B4; the park
  gate's place is provisional until it passes real collision and navigation tests.
- Data: content has its own authored source, `tools/maps/home.content.mjs` (schema `mapb-content-1`; empty in B3b), its
  own compiler, `tools/map-content.mjs` (rules in `tools/maps/content.mjs`), and its own staged file,
  `tools/maps/staged/home.content.js` (`window.ISLAND_MAPS_STAGED_CONTENT`), bound to the terrain it was placed on by
  `terrainSha256`. The terrain source, its compiler, its staged file and every B1/B2 fixture are untouched.
- A record is `{ id, kind, drawnPxBoxes, solid, doorTiles?, reserve?, encloses? }`; kinds building, landmark, station,
  wall, fence, gate, prop. Solid is whole tiles (tile boxes, tile lists, a ring round a box or a B1e habitat outline,
  with gaps) and foot boxes (pixels where feet stop on a tile that stays walkable, for posts and bases smaller than a
  tile). The compiled record lists every solid tile, so the game knows no shapes.
- The compile's rules, each named and each caught alone by a test: schema; terrain (open ground only, never water, a
  rim, a bridge, a dock or the pad); spawn (its tile and pi's feet stay clear); drawn (D1: no collision outside what's
  drawn); overlap; foot (foot boxes only on tiles that stay walkable); reserve (a record stays in the footprint it names,
  and nothing else enters one); open-space (the rift arena's clear field); doors (walkable, next to their solid,
  reachable); route-ends (all 17 still reachable); pockets (no ground cut off unless an `encloses` record encloses it).
- Runtime (`js/world.js`): two collision layers for a staged format-2 map with content. The terrain's (`TCOLL`, `TFOOT`,
  B2a's) is the only one the ground painter and its reports read, so content can't change a painted pixel; gameplay
  (movement, the planner and `STEPOK`, `SAFE`, landing, hop-out, the car, creatures) reads the union, `COLL` and `FOOT`,
  built once before anything uses them. Content only adds blocking. Format 1 and a map without content keep one layer
  (the same arrays as before). `decodeMap2` checks the content again on its own (bounds, kinds, ids, open terrain, D1,
  foot boxes, doors, the spawn, the totals, the terrain binding).
- Preview: two modes on loopback only. `mapb-staged` is the terrain preview, exactly as before, and refuses content;
  `mapb-content` (`node tools/mapb-preview.mjs --content`) needs the content layer and decodes it. Both keep every home
  system off for now, read and write no storage, and show a badge naming the mode. The deploy guard also refuses the
  content registry and the content wrapper (8 self-test cases).
- Completeness: a format-2 home outside the staged preview must carry every building, landmark base, station, the park
  gate, both paddock fences, both compound walls, the koi pond, and the sections not yet in the format (rooms, anchors,
  spawns and roam areas, the welder's route, places, zones, props), checked from the decoded data, never from a claim
  in it; until then it stops with the list. The decoder still refuses any non-staged format-2 map; that is B4's to lift.
  `?debug=1` gives `completeness()`.
- Tests: `tools/mapb-content.mjs` (the compiler, every rule, and in Chromium and WebKit the two modes, both locked
  painter digests with synthetic content present, gameplay through a walled room's door, a fenced pen cut off, a post's
  foot box, paths round a hut, 22 decoder refusals, the loopback and flag walls, and 7 code mutations of `js/world.js`).
- B3c follow-ups (required): replace the overloaded `TERRAIN_ONLY` flag with explicit mode and per-system controls;
  every solid building footprint gets visible placeholder art covering it (no invisible large building hitboxes).

Still planned: a spatial hash for proximity queries; ground pre-rendered in 32 x 32-tile chunks. Canvas memory under
48 MB on desktop and 32 MB on coarse pointers. Performance: p95 frame under 16.7 ms on a mid-range laptop
and under 33 ms at 6x CPU throttle, in heavy rain at night with 40 creatures.
