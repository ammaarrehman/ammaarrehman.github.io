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
js/skills.js      skills tabs (vanilla, no framework)
js/site.js        theme toggle, scroll reveal, nav scrollspy, card spotlight
js/windows.js     working traffic lights: minimize to the dock, maximize, restore
js/boot.js        vintage BIOS startup screen: first visit per session, and the footer's ↻ reboot
js/orb.js         the pink dot orb in the neofetch hero (+ a small one at contact)
js/world.js       pi's island: warp, map, landmarks, dinos, the BMW, the helicopter, the cave terminal, day/night, the orb fight
js/face.js        hover the headshot and it decodes into terminal ascii
js/hands.js       the page background: ascii hands that reach as you scroll
tools/marks.py    ASCII brand toolchain (wordmarks, crescent, favicon)
assets/           ensō favicon (svg + png) + app icons, photo, resume, og.png (link preview card)
assets/work/      project screenshots, copied in from the project repos
assets/hands.json the ascii hands, as a character grid
404.html          lost-page screen (GitHub Pages serves it for any bad URL)
robots.txt, sitemap.xml, site.webmanifest   search + install metadata
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
It's a jurassic island: a volcano with a live lava crater smoking in the north,
a park gate with torches, a t-rex behind an electric fence, a raptor pen, and
brachiosaurus, triceratops, stegosaurus, ankylosaurus, parasaurolophus and babies
(by their nests) roaming the meadows, with pterosaurs circling the volcano. The
dinosaurs are drawn from shapes and shaded in code (lit backs, darker bellies,
dithered spots). Maintenance robots patrol the roads, and Ammaar's two cockatiels,
his himalayan cats jasmine and prince, and twenty koi (every one a different
variety and size; press e at the pond to feed them) live there too. The island has
height: a plateau with cliffs, stairs up to the watchtower, and the volcano's cone.
His BMW M3 is parked in the garden and a helicopter sits on the helipad: walk up,
press e, and drive or fly. The island keeps real time in Ellicott City
(America/New_York), with sunrise and sunset worked out for the date: warm dawns and
dusks, and at night the lava, torches, lamps, screens and lighthouse light up and
fireflies come out. `?islandhour=22` previews any hour.

Find all eight landmarks and the orbs fall out of the sky and fight for control
of the site; the winner runs the hero orb for the rest of the session. There's
also a terminal left logged in, in a cave in the volcano's cliff (a robot will
tell you). It has `help`, `ls`, `cat`, `neofetch`, `census`, `goto`, `time`,
`feed koi` and more, and the hidden files explain how to summon the fight early.

- keyboard: wasd / arrows to walk, e / space / enter to look, esc to leave
- pointer: tap anywhere to walk there (breadth-first pathing), tap a landmark to walk up and look
- `#island` in the URL opens it directly
- first visit per session: pi hatches from an egg on the plaza

The background (`js/hands.js`) is two ASCII hands after the Sistine ceiling,
rendered from `assets/hands.json`. They reach toward each other as you
scroll and spark at the bottom of the page.

Reduced motion: no warp (a plain cut), still orb and hands, no typing effect.

## sections

Below the hero every section is a terminal pane: the title sits in the
border, a command line shows what "printed" it (`cat about.md`,
`git log --format=career`, `ls -la ~/projects`), then the output. Grayscale
throughout; pink is reserved for the orb and for things that are live or in
progress. Project cards are small windows whose screenshots stay grayscale
until hovered.

## Regenerating the marks

```
pip install pillow pyfiglet
python3 tools/marks.py            # prints wordmark + crescent HTML
python3 tools/marks.py favicon    # writes assets/favicon.png
```

© 2026 Ammaar Rehman
