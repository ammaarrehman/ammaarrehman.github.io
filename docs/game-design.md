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

A dinosaur reserve that robots run; pi is its newest intern. Rivers split the land into small regions,
each its own habitat. Crossing a river is earned with a tool, a repair or a quest. All eight portfolio
logs stay on the home island. The cyber metaphor lives only in NPC dialogue (regions are network
segments, crossings are gateways, the Field Guide is an asset inventory).

| Region | Where | Habitat | Crossing | Signature moment | Status |
|---|---|---|---|---|---|
| Home island | existing | three terraces | none | the portfolio | built (art test area in the new style) |
| Cinder Reach | the volcano, expanded | lava, basalt, steam vents | a switchback trail from the highland hub | the summit view; vents launch pi to ledges | planned |
| Hornfield | south-west, across the Ford | fern savanna | wade the Ford (slow) or its stepping stones | a herd crossing at dawn | planned |
| Reedmarsh | east, across the delta | wetland, boardwalks | push a fallen log across the gap | the Parasaurolophus chorus at dusk | planned |
| Ashpine Heights | north, over a gorge | cold conifer forest, mist | a rope bridge, mended after the Edge | T. rex footsteps you feel first | planned |
| Server Key and the reef | offshore | data center, reef, wreck | boat | the CTF, the live homelab wall, diving | planned |

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
or short string), `flags` and `tools` (maps from an id to a boolean), and `edgeSeen` (a boolean). Ids are
lowercase with hyphens, up to 32 characters, at most 64 per map. A v1 save migrates on load with nothing
lost (`tools/scenarios.mjs` tests it); a newer version is never written over. The fullest possible save
is about 27 KB, under the 50 KB budget. A later phase that needs a richer value adds a v3 migration.

Map layers (built 2026-09-30, Phase 8 D11-B): three typed arrays, one value per tile at `y * 100 + x`.
`GROUND` (Uint8) holds the tile codes; `HEIGHT` (Uint8) the level, 0 to 5 (the home island uses the
three terraces, 0 to 2); `COLL` (Uint16) collision bits: `solid` 1, `shallow` 2 (sea shallows, the
pond, the river), `deep` 4, `low` 8, `ledge` N/E/S/W 16/32/64/128, `lava` 256, `climbable` 512. A tile
can be walked when none of solid, shallow, deep or lava is set. `low`, the ledges and `climbable` are
reserved for Phase 11 and unset. The builder writes the layers directly, and they are the only record of
the map at runtime. Props stay a list; spawns and triggers come with the Phase 12 map export.

Still planned: a spatial hash for proximity queries; ground pre-rendered in 32 x 32-tile chunks. Canvas memory under
48 MB on desktop and 32 MB on coarse pointers. Performance: p95 frame under 16.7 ms on a mid-range laptop
and under 33 ms at 6x CPU throttle, in heavy rain at night with 40 creatures.
