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
  Both done in B3c1.

MAP-B B3c1, preview modes and the first two buildings (2026-10-14; staged only, not deployed):
- Modes and systems (`js/world.js`): `TERRAIN_ONLY` is gone. `PREVIEW_MODE` names the mode once: null (production),
  `"terrain"` (the B2 terrain preview) or `"content"` (the content preview). `STAGED_PREVIEW` (either preview) carries
  what every preview keeps: no storage read or written, the badge, no completeness wall. `SYS` says which home systems
  run: buildings, stations, creatures, rex, birds, koi, bots, car, rift, volcano, hatch. Each system's code checks its
  own entry, never the mode. Production runs them all, in the same order as before. The terrain preview runs none (the
  helicopter apart, as in B2e). The content preview runs only `buildings`. A later batch turns a system on by authoring
  its content and setting its entry. `?debug=1`'s `preview()` gives `previewMode`, `stagedPreview`, `sys`, and
  `terrainOnly`, which now means the terrain preview only.
- Content (`tools/maps/home.content.mjs`), two building records, each on its approved B1e footprint with the whole
  footprint solid (D1 as modified: the placeholder art covers all of it):
  - `visitor`: reserve `visitor-centre`, 80,69 to 88,73 (9 x 5, 45 tiles). Door 84,74, on the plaza's paving; the B1d
    door stub (85,74 to 85,75) is beside it. Room `visitor`.
  - `depot`: reserve `ranger-hq-depot`, 101,73 to 107,76 (7 x 4, 28 tiles). Door 104,77, on grass; the depot spur
    starts right below it at 104,78. Room `depot`.
  - Both doors are the B3a doorsteps (the middle of the front). In all: 73 solid tiles, 0 foot pixels.
- Schema additions:
  - `art`: required on a building. The only kind so far is `"placeholder"`; a real sprite later is a new art kind, with
    no change to the footprint, the door or the collision.
  - `room`: optional on a building; one of the game's rooms.
  - A new compile rule, `buildings`:
    - the building has art;
    - its solid is one full rectangle;
    - placeholder art is one box exactly as wide as the footprint, standing on its front edge (it may rise above it,
      never below or beside it);
    - a building naming a reserve fills that reserve exactly;
    - a building with a room has exactly one door, right in front of the footprint (every B1e front is south), and
      pi's feet in that doorway are clear of the terrain's foot-blocking pixels.
  - `decodeMap2` checks the same things on its own, and refuses art or a room on anything but a building.
- Runtime:
  - Format 1 builds `BUILDINGS` from `MAP.buildings` exactly as before. The content preview builds them from the
    building records: the footprint from the tiles, plus the authored door, the room and the art box.
  - The doorway is `doorX(bd)` on the footprint's front edge. In format 1 that's the middle of the front, as before; for
    a content building it's the middle of its door tile. The prompt, going in, coming out, the room build-ahead and the
    debug state all read it.
  - Placeholder art is drawn in the object layer, y-sorted with everything else, never on the ground canvas, so both
    painter digests stay exact. It fills the art box with fully opaque pixels: a roof, a front wall, windows, a name
    plate in a 3 x 5 pixel font, and the door over the door tile. The door is hinged for the visitor centre and a roller
    for the depot, animated by the existing door code. At night the windows light and the doorway has a lamp; the
    visitor centre has its banners and the depot its roof beacon.
  - The static part is drawn once into a canvas.
- Kept from format 1:
  - [E] (or, on touch, the prompt) at the doorway goes in, with the same iris and door animation.
  - The rooms are format 1's own `ROOMS.visitor` and `ROOMS.depot`, with the same items, words, sizes and doors.
  - Walking out through the room's door lands on the doorway, facing out.
  - Each building keeps its name and words, and tapping one walks pi beside it, as in format 1 (there's no tap target
    on a building).
- Not migrated in this batch (each waits for its own system's content):
  - the cargo bots' stops at both doorways;
  - the drones' pad on the depot roof (its offset is tied to format 1's 48 px sprite; B3a section 4);
  - the depot crates and the lamps (props);
  - the visitor centre's map wall: its pins are the eight landmarks, which aren't migrated, so it shows none for now.
- Tests: `tools/mapb-buildings.mjs`. In Node: the records against the approved coordinates and the B1e source, and 18
  malformed records, each caught by its rule. In Chromium and WebKit, the game:
  - the three modes, and save isolation through both buildings;
  - both painter digests with the buildings drawn;
  - the content layer exactly the footprints, every footprint pixel blocking and every pixel round it answering as the
    terrain does;
  - the art: opaque, drawn at the footprint, and visible on screen over every footprint pixel;
  - the doors: reachable from the spawn on the update loop; in and out of each room, with an item inside answering;
  - walls met flush on all four sides; paths round both buildings; no trapped tile within 3 of either;
  - an off-centre door (synthetic) used as authored;
  - phones (the prompt as the button, a tap by the room's door walking out);
  - format 1's buildings and rooms as before;
  - 12 decoder refusals and 6 code mutations;
  - the live-loop frame work and door transitions.
  `tools/mapb-content.mjs` follows the schema change (its synthetic hut has `art`); its checks are otherwise the same.
- Approved by Ammaar on review (2026-10-14):
  - keep both placeholders, the footprints, doors, interactions and interiors, and the name "the supply depot";
  - the map wall stays without pins until the landmarks move;
  - deferred to their own batches: the drone landing spot, the cargo stops, the crates and lamps, roof refinements,
    and the phone's first-use hint covering the name plate;
  - real walls, fences and props come only with visible art and matching collision;
  - the 8 unassigned building footprints stay reserved.

MAP-B B3c2, the outpost bunker (2026-10-15; staged only, not deployed; approved by Ammaar and committed as `9e9a634`):
- Content (`tools/maps/home.content.mjs`), one more building record, the same way as B3c1's:
  - `bunker`: reserve `bunker`, 113,79 to 119,82 (7 x 4, 28 tiles), the whole footprint solid, placeholder art over it
    exactly. Door 116,83, on grass: the B3a doorstep (the middle of the front) and the B1e log site `rack-desk-bunker`.
    Room `bunker`. In all: 3 records, 101 solid tiles, 0 foot pixels.
  - It stands in the bunker compound's reserve (109,76 to 124,89, walled later, gates 109,84 to 109,86), which stays
    planning metadata: no wall, gate, kit or uplink is placed. The footprint is clear of the compound's wall line by 3
    tiles to the west, 2 to the north, 4 to the east, and 5 rows below the door.
- Compound compatibility, checked with the future wall ring (the box's edge less the 3 gates: 53 tiles, all open
  terrain) made solid in memory only, with and without B3a's proposed outpost kit and uplink: the door is 8, 9 and 10
  steps from the three gates over open grass with no foot-blocking pixels, 43 from the spawn through the gates, and no
  ground inside the compound is cut off. Today, with nothing built, it is 41 steps from the spawn. The ops road's paving
  ends at the gates (109,84 and 109,85); inside the compound is grass, so the door's approach is grass.
- Art: the placeholder renderer gains a bunker style in the same frame (no new rendering system). It keeps format 1's
  look: a concrete slab with three rows of sandbags and a radio mast (its red light) on the roof, the name plate, a
  concrete block wall, slit windows, a ribbed steel door (format 1's door colour) under hazard stripes, and the door
  lamp. At night the windows light, as the others'. The visitor centre's and the depot's art are pixel for pixel as
  approved (checked against B3c1 in Chromium and WebKit).
- Kept from format 1: the room is `ROOMS.bunker`, unchanged: the rack and the desk (the two bunker logs), the monitors,
  the shelf, the cot, the map table, the UPS bank and the radio (whose display carries the Radio Static payload). [E] (or
  the touch prompt) at the doorway goes in with the same iris and hinged door; walking out lands on the doorway facing
  out. Every item answers as in format 1: the same prompt, dialog title, words and links.
- One runtime change the bunker needed: the rack and the desk are landmarks (`STATIONS`), which the content preview
  doesn't run (`SYS.stations`), so in B3c1's code the bunker room crashed on its first frame (it looked them up there).
  Their words now sit in `STATION_WORDS`; `STATIONS` is built from it as before, and the rooms read their own
  (`ROOM_STATIONS`, the same objects as in `STATIONS` in production). Reading the rack or the desk in the content
  preview shows its card but counts no log, since the logs belong to the landmarks system (`SYS.stations`), which isn't
  migrated (format 1 counts them as before). Not migrated: the compound's walls and gates, the outpost kit, the uplink,
  the big map's pins for the rack and desk, the tour and deep links to them.
- Tests: `tools/mapb-buildings.mjs` grows to cover the bunker: the records and the compound against B1e, the future
  compound's reachability, two more malformed records and a decoder refusal; in Chromium and WebKit the footprint and
  art, the door, the room swept item by item against format 1's, no log counted, five enter and leave cycles per
  building, all three buildings in one walk, walks from each gate to the door inside the compound, paths round it and
  its four walls, phones at 390 x 844 and 375 x 667, the live-loop frame work along all three, and two more code
  mutations (the room's stations, the log). `tools/mapb-content.mjs` expects the three buildings; the completeness list
  no longer names the buildings (all three are there) and still names everything else.
- Status: complete. All three format-1 buildings and their interiors are migrated to the content preview; the compound's
  walls, fences and gates are not implemented yet. B3c3 is next. MAP-B stays preview-only (loopback, no storage) and
  production is unchanged (format 1, 100 x 80, `SAVE_V` 2, cache `20261025`). The `doors.mjs` timing flake (production)
  failed once in B3c2's gate run and reproduced on a clean HEAD; it is recorded as a failure in `handoff.md`, budget
  unchanged.


MAP-B B3c3, the bunker compound's wall and its west entrance (2026-10-16; staged only, not deployed; complete, visually
and architecturally approved by Ammaar, approved for commit with two final-run failures documented, and committed as
`69520facc80f821595fa05c5979b24619c1f25b9` "Map: add MAP-B outpost compound perimeter (B3c3)"):
- Format 1, audited first: the outpost compound (17,57 to 28,65) is a ring of sandbag wall tiles (`wall`, drawn per tile
  by `drawWall`, solid in `coll`, skipped on path tiles) with its gate on the east wall: three rows left open. The gate is
  only a gap: no gate object, nothing that opens, closes or locks, no prompt, no state and no save field. Walls have no
  interaction (only the paddock fences say something). B3c3 keeps exactly that behaviour and invents no mechanic.
- Content (`tools/maps/home.content.mjs`), one wall record:
  - `bunker-compound`: kind wall, `compound: "bunker-compound"`, art placeholder, solid the ring of the B1e compound box
    109,76 to 124,89 (16 x 14) less its three gateTiles 109,84, 109,85 and 109,86: 53 solid tiles, every one on open
    terrain (the south-east corner 124,89 is shore sand with 40 foot-blocking pixels, as B3a recorded). In all: 4 records,
    154 solid tiles, 0 foot pixels.
  - The west entrance: the three gate tiles, 48 px, open ground with no foot-blocking pixel (109,84 and 109,85 are the
    ops road's paving, 109,86 grass), straight through from 108 to 110 on each row. The posts either side stand on the
    wall's own tiles 109,83 and 109,87, so they add no collision.
  - Nothing else of the compound: no outpost kit, uplink, lamps, crew or drones. B3a's proposed places for the kit and
    the uplink (and the uplink's stand 121,82) stay open, reachable ground inside, off every shortest walk from a gate to
    the bunker's door.
- Schema additions:
  - `art` is allowed on a wall as well as a building (`ART_ON`); a wall must have it.
  - `compound` (optional, on a wall only): the B1e walled compound it walls in.
  - The compiled record of a ring now lists its openings, `gapTiles` (the game draws the posts beside them).
  - A new compile rule, `walls`: the wall has art; its solid is one ring (ringOfBox or ringOfHabitat) and nothing else;
    it has no drawn box of its own (its art is its tiles, which the compile adds); every opening is open ground (no
    terrain flag, no content, no foot-blocking pixel), reachable from the spawn and never a corner; a wall naming a
    compound is the ring of that compound's box with exactly its gateTiles as openings. Closing the entrance is caught by
    the pockets rule.
  - `decodeMap2` repeats it on its own (`wallShape`): art on every solid tile and nowhere else (one drawn box per tile,
    exactly the tile), no foot boxes, openings walkable and not solid, and the tiles and openings one closed line (each
    joins at least two others), so a tile dropped from the data is refused as a hole that isn't an opening.
  - The completeness wall counts a compound wall only with its art; its list now names only the koi garden's wall.
- Runtime (`js/world.js`):
  - `WALLS`, `WALL_PIECES`, `WALLAT`: each wall record's tiles become pieces, chosen from the tile's neighbours in the
    same record: an east-west or north-south run, a corner, a post beside an opening, or a pier every fifth tile along a
    run; the south face shows where no wall tile stands below.
  - Placeholder art: one opaque 16 x 16 piece per tile, drawn once per kind of piece (`wallArt`) and then blitted, in the
    object layer, y-sorted like a building (its key the tile's bottom less 2), never on the ground canvas, so both painter
    digests stay exact. The look is format 1's outpost in the bunker's palette: courses of sandbags lit on top and
    shadowed underneath, concrete piers, concrete corner blocks, and concrete posts with hazard stripes facing the
    opening and a small lamp, lit at night. Seams fall on world pixels, so runs join without a break.
  - Collision is unchanged in kind: the wall's tiles are content collision, so movement, the planner, `STEPOK`, safe
    ground, landing and hop-out already read them through the union. No new system flag: a wall's art comes from the
    same record as its collision, so one can't be on without the other.
  - `?debug=1`: `preview().walls` (each wall's tiles, openings and pieces by kind), `wallMs` and `wallDraws`, and
    `wallArt(id)` (each piece's tile, kind, opaque pixels and where it was last drawn).
- Tests: `tools/mapb-buildings.mjs` grows to cover the wall (the record against B1e and the brief, the closed and joined
  ring, the entrance, the kit and uplink places, no ground cut off, the outside lanes; 14 malformed wall records and 10
  decoder refusals; in Chromium and WebKit the collision pixel by pixel, the art, the art on screen against the terrain
  preview, pushes from every side and into the corners, walks through each gate, across and round the compound, the
  whole visit into the bunker and back out, a walk to a wall tile, trapped ground, the helicopter, phones tapping in
  through the entrance, three code mutations, and the review screenshots in `tools/out/mapb/b3c3/`, with a labelled
  diagnostic overlay drawn by the test only). `tools/mapb-content.mjs` gives its synthetic walled room art, expects the
  four records and the koi garden's wall alone in the completeness list, and shows D1 alone on the fenced pen.
- Found by the tests while building it:
  - a hole in the wall's data wasn't refused at first (one connected line can still have a gap); the decoder now
    checks that the line closes round;
  - the outside of the compound isn't a full loop: the south-east corner meets the sea (124,90 and 125,89 are water), so
    the south and east lanes are each reached from the spawn but don't join round that corner. The shore tile 125,88 is
    the east lane's end: its middle is on the shore's foot-blocking pixels (pi can't stand there, before the wall or
    after), and pi standing where feet can stand in it walks home.
- Verification (final gate run, 2026-10-16): every gate passed with Firefox BLOCKED at launch (never counted as a pass):
  mapb-buildings 379, mapb-content 143, mapb-runtime 220, mapb-decode 76, mapb-painter 49 (both locked digests exact),
  map-parity 37/37 and b0-parity 21/21 identical in Chromium and WebKit, scenarios 98, ctf 250, map-decode 250, focus 16,
  doors all under the unchanged 16 ms budget (closest: visitor cold out 15.6 ms), the deploy guard (8), the dry run (53
  files, 41 references), deploy-args, html, CSpell (the same 19 words as HEAD) and `git diff --check`. Rerun before the
  commit: mapb-buildings, mapb-content, the guard, the dry run and `git diff --check`. That rerun had two FAILURES, kept as
  failures (not passes), which Ammaar accepted as documented qualifications:
  - mapb-buildings, Chromium: the bunker's cold door exit took 16.1 ms (budget 16 ms, unchanged). In a comparison of 9
    cold door sequences on each side, alternating, the B3c3 tree had no frame over 16 ms (worst 8.0 ms) and a clean
    HEAD (`e4e68c2`, no wall) had one at 16.8 ms: the known intermittent door-timing flake, not caused by the wall.
  - mapb-content, WebKit: the synthetic-content preview page didn't open within 60 s (no page error), so 13 checks
    didn't run (130 ok, not 143). Two focused WebKit reruns passed (86 each). Its cause is unresolved (the machine was
    loaded; Spotlight was indexing at about 210% CPU), so it is recorded as an open intermittent.
  Evidence: `tools/out/mapb/b3c3/final/` and `tools/out/mapb/b3c3/doordiag/FINDINGS.md` (local).
- Approved by Ammaar on review (2026-10-16): the compound overhead, the west entrance, the south-east shoreline corner,
  the night view, the 390 px phone entrance and the diagnostic overlay. Locked: the wall's art and collision as built;
  the entrance an open three-tile gap, as in format 1; the hazard-striped posts and their night lamps; the south-east
  corner meeting the shore (B1 geography unchanged); no separate `SYS` switch for walls (art and collision stay coupled);
  fence and park-gate art in their own batches; B3a's kit and uplink places kept clear; no lock, animated gate, security
  system or new compound gameplay.
- Status: complete. B3c3 implements the outpost's visible perimeter and its open west entrance. The three original
  buildings and their interiors stay migrated. Still future work: the outpost kit, the uplink, NPCs, dinosaurs, the
  paddock fences and the park gate's art. MAP-B stays preview-only (loopback, no storage); production is unchanged
  (format 1, 100 x 80, `SAVE_V` 2, cache `20261025`); nothing was deployed. No later B3 batch has begun. All three
  buildings and the compound wall are done; the paddock fences, the park gate, the kit and the uplink are deferred.
- For long test runs (recommendation only; the harness is unchanged): keep per-suite logs as each finishes, resume from
  the gates already done after an interruption, use bounded timeouts and targeted reruns, keep the browser suites away
  from heavy builds and indexing when possible, report assertion failures, time-budget failures, launch blocks and
  timeouts as different things, and never let a passing rerun erase an earlier failure.

MAP-B B3d1, the paddock fence and the raptor yard (2026-10-16; staged only, not deployed; complete, visually and
architecturally approved by Ammaar, committed as "Map: add MAP-B raptor enclosure fence (B3d1)",
`e80243165c499e02ba217ff683c7568655518633`):
- Format 1, audited first: the paddocks are `regions.paddocks`, a name and a box each (the t-rex paddock 27,43 to 39,54, the
  raptor pen 60,30 to 70,38), nothing more. Every land tile of the box's edge is a fence tile, solid in `coll`; there is no
  gate, opening, lock or state, so each paddock is closed all round and its inside is a pocket (not safe ground: no landing,
  no restored position, C4-2). The art (`drawFence`) is a steel post per tile with a yellow cap, three wires to the next
  post east and south, a yellow and black warning sign on some east-west tiles, and at night the wires glow and now and
  then spark; the post and wires are thin, the whole tile blocks. [E] next to a fence names the paddock with a line about
  its animals, plays a zap, and next to the t-rex's starts its roar (the `roar` secret). The raptors share one roam area
  (`roam-03`, exactly the pen's inside) and pace the inside of the fence toward pi; creatures choose targets inside their
  roam box and move with the same `move()` and collision as pi, so the fence is what holds them. The welder bot patrols
  round the outside (`routes.welder-patrol`); the goto place `raptors` is 64,40, two rows below the pen. The terminal's
  `paddocks.log`, `fence.log` (the Fence Logs CTF) and `fences` command are words only. B3d1 keeps all of it and invents
  nothing: no lock, key, gate, shock or security system.
- The enclosure, from the approved sources (not inferred from a spawn): the B1e habitat `raptor-yard` (contained, box 119,10
  to 127,17, 9 x 8) and the B3a plan (ring 30 tiles, inside 42, 120,11 to 126,16, which is also B3a's roam box for the three
  raptors). No openings: format 1's pen has none and B1e gives the yard none. All of it is open level-2 highland grass with
  no foot-blocking pixel and no path; the nearest other level is 13 tiles away (no cliff beside it) and the sea 2 tiles off
  its north-east corner; a walkable loop of 38 tiles runs all round the outside. The paddock fence walk (a trail) ends at
  118,18 to 118,19 by the south-west corner, the raptor yard walk ends at 123,22 by the raptor house reserve (121,20 to
  125,21, empty), and B3a's viewing place is 123,19, all open. When the holding paddock is fenced (a later batch) the lane
  between the two (column 118) is one tile wide at rows 12 to 15.
- Content (`tools/maps/home.content.mjs`), one fence record:
  - `raptor-yard`: kind fence, art placeholder, `encloses: true`, solid the ring round the habitat (`ringOfHabitat`): 30
    tiles, each with one opaque tile of fence art and nothing more. In all: 5 records, 184 solid tiles, 0 foot pixels.
- Schema additions:
  - `art` is allowed on a fence (`ART_ON`: building, wall, fence); a fence must have it.
  - A new compile rule, `fences`: a fence has art; its solid is one ring round a B1e habitat whose containment is
    `contained` (`ringOfHabitat`) and nothing else, and its id is that habitat's (so no fence comes from anything but the
    approved geometry); no drawn box, door, reserve or foot box of its own; openings as the walls' (open ground, reachable,
    in a straight run, never a corner); no openings means it must say `encloses`, openings mean it mustn't.
  - `decodeMap2` repeats it on its own: a fence's shape is checked as a wall's (art on every solid tile and nowhere else,
    no foot boxes, the line closed round), plus the `encloses` rule. The completeness wall counts a paddock fence only with
    its art and `encloses`; its list now names only the holding paddock's.
- Runtime (`js/world.js`):
  - The walls' piece builder is shared (`ringPieces`); walls are built exactly as in B3c3. `FENCES`, `FENCE_PIECES`,
    `FENCEAT`: one piece per fence tile, a run, a corner or a post beside an opening, the middle of each east-west run
    carrying a warning sign.
  - Placeholder art (`fenceArt`), one opaque 16 x 16 piece per tile, drawn once per kind and blitted in the object layer,
    y-sorted like the walls, never on the ground canvas (both painter digests exact). Format 1's electric fence on a concrete
    footing: an east-west run is the fence face on (a top rail, chain-link mesh on a 4 px lattice between steel posts with
    format 1's yellow caps, two live strands, a bottom rail) with the footing's south face below; a north-south run is the
    footing from above with its posts and mesh edge on along the middle; a corner is a heavier post with the footing turning
    under it. The footing is what makes the whole tile read as fence, so every blocking pixel has art and no art covers
    open ground. At night the strands glow and now and then spark, as format 1's wires do.
  - Collision is unchanged in kind: the fence tiles are content collision, so movement (pi's and the creatures' `move()`),
    the planner, `STEPOK`, safe ground, landing and hop-out read them through the union. No new system flag.
  - `?debug=1`: `preview().fences` (each fence's tiles, openings, `encloses`, pieces by kind, signs), `fenceMs` and
    `fenceDraws`, and `fenceArt(id)`.
- Not in this batch (each waits for its own): the raptors and their roam area and spawns (the format has no spawns or
  roam areas yet); the welder's patrol; the fence's [E] words (format 1's name the animals inside, which aren't there);
  the raptor house; the roof netting; the holding paddock's fence (the same renderer and rules, tested on its outline in
  memory only).
- Tests: `tools/mapb-fences.mjs` (new). In Node: the record against B1e, B3a and format 1, the ground, the ring closed
  and joined, the inside cut off and nothing else, the outside loop, the trails, route ends and viewing place, the relief,
  the holding paddock's fence beside it (synthetic), 17 malformed fence records each caught by its rule, and an opening in
  a straight run allowed. In Chromium and WebKit: both digests, the layers, the art piece by piece and on screen against the
  terrain preview, collision pixel by pixel, the tiles, pi pushed into each side and diagonally into each corner from
  outside and from inside on the update loop, the planner round, along, into and up to the fence, trapped ground, the
  helicopter (every 4 px, drifting descents, a real flight), phones, completeness, storage, 12 decoder refusals, the
  synthetic holding paddock and the lane between, performance, 4 code mutations (Chromium), and review screenshots in
  `tools/out/mapb/b3d1/` with a labelled diagnostic overlay drawn by the test only. `tools/mapb-content.mjs`'s synthetic
  fenced pen is now a fence round the holding paddock's outline (a fence must be a habitat's), and its D1 mutation uses a
  prop; `tools/mapb-buildings.mjs` expects the fence among the records and its inside as the only ground cut off, and
  `MAPB_SHOTS` keeps a later regression run's screenshots out of B3c3's folder.
- Verification (one complete regression pass on the final code, 2026-10-16, load average 2 to 7, one suite at a time,
  `tools/out/mapb/b3d1/gates/`): every browser suite passed with Firefox BLOCKED at launch (exit 2, never counted as a
  pass): mapb-fences 165, mapb-buildings 379, mapb-content 145, mapb-runtime 220, mapb-decode 76, mapb-painter 49 (both
  locked digests exact), map-parity 37/37 and b0-parity 21/21 identical with `715450d` in Chromium and WebKit, scenarios
  98, ctf 250, map-decode 250; doors (worst 3.8 ms), focus 16, map-compile, map-content and map-export `--check`, map-lint,
  the deploy guard (8), the dry run (53 files, 41 references), deploy-args (37), html and `git diff --check` passed.
  CSpell FAILED in that pass with 20 words, the 19 HEAD has plus "blitted" in a new comment; the comment was reworded
  ("copied") and CSpell rerun alone: the same 19 words as HEAD. Nothing else was rerun for that comment-only change.
  Failures while building it (development runs, `tools/out/mapb/b3d1/dev/`): one, in the new test, not the game: the
  trapped-ground scan counted the inside reaching the spawn on the terrain preview (before any fence, as it should) as
  wrong; fixed and the Chromium run repeated (102 ok), then WebKit (98 ok).
- Performance (Chromium / WebKit): one fence piece 1.0 / 0.7 us a draw; walking round the yard on the live loop, frame work
  p95 1.5 / 1.0 ms (the terrain preview's 2.5 / 1.0 in the same run); planning round the yard 1.5 to 2 ms first, 0.15 ms
  warm; decoding the staged map 3.4 / 3.6 ms with the five records (2.8 without). A walk (a tap) to the closed-in middle
  costs about 2.7 ms warm (no path, or a loose plan to the nearest side), against 0.7 ms for format 1's raptor pen on its
  smaller island; the first such plan on a fresh page takes about 12 ms, the planner's step cache filling, once.
- Approved by Ammaar on review (2026-10-16; the overhead, night, diagnostic, north-east corner, pi against the fence and
  both phone screenshots), with no visual change: the bounds 119,10 to 127,17; the closed 30-tile electric fence; all 42
  inside tiles closed in; the posts, chain-link panels, concrete footing, warning signs and night effects; no openings or
  gates (format 1's pen is closed all round); no raptors or other creatures in B3d1; the raptor interaction deferred until
  its creature systems are migrated; the north-south runs accepted as placeholder art, not redesigned now. B3d2 reuses
  this fence for the T. rex holding paddock and must test the one-tile passage between the two paddocks (column 118, rows
  12 to 15) for navigation and usability.
- Pre-commit checks (lightweight, after approval; the browser suites weren't rerun, the gate run above stands):
  map-compile and map-content `--check` current (5 records, 184 solid tiles, 0 foot pixels); the Node parts of
  mapb-fences (35), mapb-buildings (70) and mapb-content (29); the deploy guard; the dry run (53 files, 41 references);
  CSpell the same 19 words as HEAD (no new finding); `git diff --check`; production files, fixtures and the B1 source
  unchanged. The only change to `js/world.js` after the gate run is the reworded comment.
- Status: complete. The raptor yard's fence is built, closed all round as format 1's pen is; the shared fence renderer is
  ready for B3d2. Deferred: the raptors, their roam area and the fence's [E] words, the welder patrol, the raptor house and
  the roof netting. MAP-B stays preview-only (loopback, no storage); production is unchanged (format 1, 100 x 80, `SAVE_V`
  2, cache `20261025`); nothing was deployed. B3d2 (below) followed.

MAP-B B3d2, the T. rex holding paddock (2026-10-16; staged only, not deployed; complete, visually and architecturally
approved by Ammaar 2026-10-17, committed as "Map: add MAP-B T. rex holding paddock (B3d2)"):
- Read first: B1e's habitat `holding-paddock` (contained; planning labels "temporary predator holding (T. rex, until
  Ironwood)" and "double fence, high security"; an outline, a closed smooth curve through six named points: west 107,13,
  north 112,10.5, north-east 117,11, east 118,16, south 113,17.5, south-west 107,17), B3a's plan (ring 36 tiles, inside
  35, the T. rex roam box roam-02 108,11 to 116,16 with its spawn 112,14, the goto place `paddock` 112,19, the roar zone
  104,8.5 to 120,20), this file's B3d1 notes on the lane, and format 1's t-rex paddock.
- Format 1, audited: the t-rex paddock is `regions.paddocks` "t-rex paddock", the box 27,43 to 39,54 (a 46-tile ring,
  110 inside), nothing more: no gate, opening, lock or state, closed all round; its one T. rex (spawn 33,48) roams roam-02,
  exactly the inside (28,44 to 38,53), pacing the fence toward pi; `regions.zones.trex-roar` (25,41.5 to 42,56) wraps it, and
  pi strictly inside that zone and within 150 px of the T. rex makes it roar (the `roar` secret); [E] at the fence names
  the paddock, zaps and starts the roar; a bones decal lies inside; the goto place `paddock` is 41,51. The T. rex is
  85 x 45 px. B3d2 keeps all of it for later and invents nothing.
- The enclosure, from the approved sources: the ring of the B1e outline as the compiler rasters it (tile centres inside the
  curve: 71 tiles), its tiles with any of their 8 neighbours outside it. 36 fence tiles, by row: 10: 112 to 115; 11: 109,
  110, 111, 112, 115, 116; 12: 108, 109, 116, 117; 13: 107, 108, 117; 14: 106, 107, 117; 15: 106, 107, 116, 117; 16: 107,
  108, 109, 112 to 116; 17: 109 to 112 (the box 106,10 to 117,17). Inside, 35 tiles: 11: 113, 114; 12: 110 to 115; 13:
  109 to 116; 14: 108 to 116; 15: 108 to 115; 16: 110, 111 (within B3a's roam box, touching each edge; the spawn 112,14 is
  inside). The curve steps, so the ring does: 24 corner pieces and 12 runs (10 east-west, 2 north-south), a warning sign on
  the middle of each of its five east-west runs (113,10, 110,11, 108,16, 114,16, 110,17). At the west tip the raster puts a
  2 x 2 block of fence (106 to 107, 14 to 15): one line still, closed even to a diagonal step. No openings (format 1's
  paddock has none, B1e gives it none). All of it is open level-2 highland grass with no foot-blocking pixel and no path;
  the nearest other level is 13 tiles away, the sea 2 tiles off its north-west side. The 44 tiles one step out all round
  are open ground and join into one loop (the coast's 6 foot-blocking pixels on 108,10 are the only ones among them). The
  paddock fence walk (a trail, rows 18 and 19) runs along the south fence to 118,19; the viewing place 112,19 is on it.
- Not built: B1e's planning label "double fence, high security". B3a plans one ring and format 1 has one; a second ring
  would need geometry nobody has approved (and room the site doesn't have on the north-west and east). A decision for
  Ammaar (below).
- The lane between the paddocks: column 118, open from row 9 to row 18, one tile wide at rows 12 to 15 (the paddock's
  fence at x 117, the yard's at x 119), two wide at its mouths (117 to 118 at rows 10 and 11, and 16 and 17). Measured in
  Chromium and WebKit on the update loop:
  - Movement: pi's feet are 9 px wide (move()'s half-width 4) in the 16 px lane, so pi's middle has 7 px of play (x 1892
    to 1899) and its feet clear each fence by 3 to 4 px in the middle. Pushed sideways it stops flush, never on a solid
    pixel.
  - Keyboard (and the joystick, which drives the same way): going straight in from either end, pi gets through when its
    middle is in that 8 px window (8 of the 24 px across the two-tile mouth); anywhere else it stops at the end of the
    paddock's fence (row 11 or 16) and has to step sideways. Diagonally toward the yard (down and right, up and right),
    pi slides along the yard's straight west fence into the lane and through, from beside the mouth and from 4 tiles off;
    diagonally toward the paddock it stops at the paddock's step. No foot ever on a solid pixel, never through a fence.
  - Tap to walk and the planner: through it both ways, and across between the paddocks (it is the shortest way between
    the north strip and the fence walk, so the planner uses it), with no stall. On phones (390 x 844 and 375 x 667) the
    lane is 32 CSS px wide, taps in it and through it walk pi there, and the touch joystick takes pi through it (a little
    off straight down toward the yard slides in; straight down from the paddock's side stops at the fence end).
  - Visibility: pi's white body shows fully in the lane (the same light pixels on screen as on open grass, every row).
  - The helicopter: no landing anywhere in the one-tile lane (its skids would be over a fence), E there is refused in
    flight; it may land where the lane opens out, clear of both fences.
  - Assessment (approved): not a meaningful problem; no change. The lane is open, safe ground, never the only way round (the
    north strip joins the coast west of the paddock and the ground east of the yard), and every way of moving gets
    through it. The one rough edge is the 8 px window for a straight keyboard or joystick entry, the same as any one-tile
    gap in the game (move() has no corner assist). Widening it would change B1 geometry; a corner assist would be a new
    movement mechanic. Both are for Ammaar, neither is needed (below).
- Content (`tools/maps/home.content.mjs`), one fence record: `holding-paddock`, kind fence, art placeholder, `encloses: true`,
  solid the ring round the habitat (`ringOfHabitat`). In all: 6 records, 220 solid tiles, 0 foot pixels.
- Schema and runtime: unchanged. The fence schema, the `fences` compile rule, the decoder's checks, the renderer
  (`ringPieces`, `fenceArt`, the night glow and sparks) and the collision are B3d1's, used as they are; the holding paddock
  takes the yard's style (`FENCE_STYLE.other`). `js/world.js` is not changed. The completeness wall no longer lists
  paddock fences (both are there with art and `encloses`); a normal format-2 home is still refused (the koi garden's
  wall, the stations, the creatures and the rest).
- Containment (Chromium and WebKit, the update loop, move() as the creatures use it): pi walked into the fence from every
  tile touching it, inside (35) and outside (44), in every direction whose next tile is fence: 166 pushes (70 from inside,
  96 from outside), straight ones stopping flush (within 3 px), diagonal ones into all 24 corners from outside and the 22
  that face the inside from inside (106,14 and 106,15 stand behind the west tip's other two), never through, feet never
  on a solid pixel. Every fence pixel blocks; the pixels round it answer as the terrain does; inside nothing is blocked.
  The inside is not safe ground (no landing, no restored position); the outside and the lane are. The planner goes round
  and along it, never in; a walk to the middle never enters; no ground outside is cut off. The helicopter can't set down
  on it or inside it (every 4 px), descents drifting at it from each side park clear, and in flight E over the middle is
  refused and lands beside it.
- Not in this batch (each waits for its own): the T. rex, its roam area and spawn, its fence pacing and roar (the format has
  no spawns, roam areas or zones yet); the roar zone; the fence's [E] words and zap; the bones; the double fence; the
  Ironwood move (a later phase).
- Tests: `tools/mapb-paddock.mjs` (new; Node and Chromium and WebKit; review screenshots in `tools/out/mapb/b3d2/`, with a
  labelled diagnostic overlay drawn by the test only). `tools/mapb-fences.mjs`: its synthetic holding paddock is now the
  real one, the yard's west side is the lane (118,13; 117,13 is the paddock's fence now), both insides are the ground cut
  off, and `MAPB_SHOTS` keeps a later run's screenshots out of B3d1's folder. `tools/mapb-content.mjs` and
  `tools/mapb-buildings.mjs` expect the sixth record, 220 tiles and the 77 tiles closed in.
- Verification (one regression pass on the final code, 2026-10-16, one suite at a time, each log kept as it finished,
  `tools/out/mapb/b3d2/gates/`; load average 5 to 41, another process busy for part of it). Firefox BLOCKED at launch in
  every browser suite (exit 2, never counted as a pass). Passed: map-compile, map-content (6 records, 220 tiles), map-lint
  (187), map-export `--check` (50), map-decode 250, mapb-decode 76, mapb-painter 49 (both locked digests exact in Chromium
  and WebKit: terrain `8fdd2afe...`, ground `0263dc4f...`), mapb-runtime 220, map-parity 37/37 and b0-parity 21/21
  identical with `715450d` in both, scenarios 98, ctf 250, doors (worst 3.7 ms), focus 16, mapb-paddock 142,
  mapb-buildings 379, the deploy guard (8), the dry run (53 files, 41 references), deploy-args (37), html, `git diff
  --check`. CSpell exits 1 as it does at HEAD: the same 19 findings (6 words, all in `js/world.js`, which B3d2 doesn't
  touch), none new.
  FAILED in that pass, two suites, each one check in Chromium and WebKit, both in the tests B3d2 changed, not the game:
  - mapb-content (143 ok, 2 failed): the completeness list was expected to have at least 12 items; with both paddock
    fences there it has 11 (a format-2 home is still refused). The check now pins exactly 11 (stricter, not looser).
  - mapb-fences (163 ok, 2 failed): the yard's west-side helicopter descent, moved by B3d2 off the paddock's inside to
    118,10, started where the game refuses E (the skids would be over the yard's fence), and parked there. It now starts
    in the lane's two-tile south mouth (117.5,17), and every descent checks it starts where E may land.
  Both rerun alone after the fix (`*-rerun.log`): mapb-fences 165 and mapb-content 145, all passed, Firefox BLOCKED.
  After that, one wording change in mapb-fences (its decode timing said "five records"; it now counts them), checked
  with its Node part only.
  Failures while building it (development runs, `tools/out/mapb/b3d2/dev/`), all in the new test's expectations, none in
  the game: the ring is not a simple cycle (the west tip's 2 x 2 block), two fence tiles can't be walked into from inside,
  a helicopter descent started in the lane (where E is refused), part of the ring off screen at the first framing, the
  overlay's legend over the paddock, and the lane mouths (two wide) allowing landings clear of the fences.
- Performance (gate run, Chromium / WebKit): one fence piece 0.98 / 1.12 us a draw; walking round the paddock and down
  the lane on the live loop, frame work p95 1.8 / 2.0 ms (the terrain preview's 1.5 / 1.0 in the same run), max 10.1 /
  5.0 ms; planning round the paddock 1.8 / 2.0 ms first, 0.16 / 0.20 ms warm; decoding the staged map with six records
  3.7 / 4.4 ms. A walk (a tap) to the closed-in middle costs about 2.8 ms warm (11 to 12 ms the first time on a fresh
  page), against 0.6 to 0.8 ms for format 1's t-rex paddock on its smaller island; the same pattern B3d1 measured for the
  yard. In one WebKit development run under heavy load a single 84 ms frame showed up (p95 2.0 ms); the gate run's worst
  WebKit frame was 5 ms.
- Approved by Ammaar on review (2026-10-17; both paddocks day and night, the diagnostic overlay, the corners, the lane,
  collision and both phones), with no change. His decisions:
  1. The paddock keeps B1e's exact geometry: 36 fence tiles, 35 closed in. The raptor yard stays exactly as B3d1 left it.
  2. Both enclosures stay closed: no gates or openings.
  3. The existing electric fence art and renderer stay; the stepped fence and the thicker west tip are accepted as
     placeholder art.
  4. The one-tile lane (x 118, y 12 to 15) is accepted, with movement collision and path planning as they are. Its narrow
     alignment window for a straight keyboard or joystick entry (8 px of the 24 px mouth) is documented here; no global
     corner assist is added.
  5. The second, high-security ring (B1e's "double fence" label) is not built; the question stays open for a later review.
  6. No dinosaurs, creature AI, welder patrol, raptor house content or new interactions in B3d2.
  7. The T. rex's migration must prove that its body (about 85 x 45 px) can spawn, turn, move and stay contained in this
     35-tile irregular inside (9 x 6 at most), B3a's risk 4.
- Pre-commit checks (lightweight, after approval; the browser suites weren't rerun, the gate run and the two targeted reruns
  above stand; `tools/out/mapb/b3d2/final/`): map-compile and map-content `--check` current (6 records, 220 solid tiles, 0
  foot pixels); the five earlier records byte for byte as at B3d1 and the paddock's 36 tiles closed with no openings; the
  Node parts of mapb-paddock (32), mapb-fences (35), mapb-content (29) and mapb-buildings (70); the deploy guard; the dry
  run (53 files, 41 references); CSpell the same 19 findings (all in `js/world.js`); `js/`, the pages, the B1 source, the
  staged terrain, the painter fixtures and the deploy tools unchanged from HEAD (so both locked digests stand as measured).
- Status: complete. Both predator enclosures, the raptor yard and the T. rex holding paddock, are now built as structure
  (fence, collision, art), on one shared fence system; their animals and interactions come later. MAP-B stays
  preview-only (loopback, no storage); production is unchanged (format 1, 100 x 80, `SAVE_V` 2, cache `20261025`);
  nothing was deployed. B3d3 has not begun.

Still planned: a spatial hash for proximity queries; ground pre-rendered in 32 x 32-tile chunks. Canvas memory under
48 MB on desktop and 32 MB on coarse pointers. Performance: p95 frame under 16.7 ms on a mid-range laptop
and under 33 ms at 6x CPU throttle, in heavy rain at night with 40 creatures.
