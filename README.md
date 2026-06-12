# ammaarrehman.github.io

Personal ePortfolio of **Ammaar Rehman** — Information Systems student (Maryland),
AWS Certified Cloud Practitioner, founder of [NIGHTFALL](https://nightstarlabs.github.io/nightstar-labs-site/).

Built in the NIGHTFALL design system: strict monochrome UI, JetBrains Mono everywhere,
and ASCII art that carries all the color.

## Structure

```
index.html        single page
css/styles.css    the design system
js/pi.js          pi — the resident pixel critter + his floor of stations
js/skills.js      skills section (Vue 3)
tools/marks.py    ASCII brand toolchain (wordmarks, crescent, favicon)
assets/           favicon, photo, resume
```

## pi

The hero is pi's room — a pixel diorama with a desk + PC, a MacBook,
a homelab rack, a drink, a green film poster, and a window with the moon.
pi wanders the room on his own: he codes at the desk, closes tickets when a
rack LED goes red, sips the drink for a speed boost, and does design review
on the MacBook. Drag him onto anything to trigger it; tap him for commentary.
The blueprint marks around the frame are an homage to calligraphy
construction diagrams.

Reduced motion: pi stays visible and grabbable, but doesn't auto-walk.

## Regenerating the marks

```
pip install pillow pyfiglet
python3 tools/marks.py            # prints wordmark + crescent HTML
python3 tools/marks.py favicon    # writes assets/favicon.png
```

© 2026 Ammaar Rehman
