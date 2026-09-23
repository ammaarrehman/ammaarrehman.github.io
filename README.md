# ammaarrehman.github.io

Personal ePortfolio of **Ammaar Rehman** — Information Systems student (Maryland),
AWS Certified Cloud Practitioner. Homelab and projects documented at
[github.com/ammaarrehman/homelab](https://github.com/ammaarrehman/homelab).

Hand-rolled design system: strict monochrome UI and ASCII art that carries
all the color, over a faint living network that drifts behind the page. Type is all open source (SIL OFL): Instrument Serif for section
headings, Geist for prose, JetBrains Mono for the UI and the ASCII marks.
Paper light mode follows the OS, with a ◐ toggle in the nav.

## Structure

```
index.html        single page
css/styles.css    the design system
js/pi.js          pi — the resident pixel critter + his floor of stations
js/skills.js      skills tabs (vanilla, no framework)
js/site.js        theme toggle, scroll reveal, nav scrollspy, card spotlight
js/net.js         the neural network canvas (hero + contact)
js/field.js       the page background: a sparse living network, fixed behind everything
tools/marks.py    ASCII brand toolchain (wordmarks, crescent, favicon)
assets/           favicon + app icons, photo, resume, og.png (link preview card)
404.html          lost-page screen (GitHub Pages serves it for any bad URL)
robots.txt, sitemap.xml, site.webmanifest   search + install metadata
```

## pi

First visit: an egg sits center-screen and slowly cracks — tapping speeds
it up. pi hatches, plops onto his floating island, and the camera zooms out
into the site.

The hero is that island — a pixel diorama with a desk + PC, a MacBook,
a homelab rack, a drink, the leftover eggshell, and a live sky: drifting
bit-clouds, a crescent moon, radar waypoints, pterodactyls with dotted
ATC tracks, and rex (a chrome-dino homage — click him, he hops).
pi wanders on his own: codes at the desk, closes tickets when a rack LED
goes red, sips the drink for a speed boost, runs design review on the
MacBook. Drag him onto anything to trigger it; tap him for commentary.
The blueprint marks around the frame are an homage to calligraphy
construction diagrams.

Behind the island runs the net: a multilayer neural network in the radar
palette. Nodes drift, layers undulate, weighted connections sway, and
signals fire input to output, lighting each node they reach. Three depth
planes parallax against the pointer. A smaller one runs at the contact
section, and a color pulse sweeps across the ASCII name every few seconds.

Reduced motion: no hatch intro, no auto-walk, the network holds still, no sweep, no
scroll reveals. pi stays visible and grabbable.
The hatch plays once per browser session (sessionStorage).

## Regenerating the marks

```
pip install pillow pyfiglet
python3 tools/marks.py            # prints wordmark + crescent HTML
python3 tools/marks.py favicon    # writes assets/favicon.png
```

© 2026 Ammaar Rehman
