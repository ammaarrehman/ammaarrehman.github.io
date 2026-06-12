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

The 30px critter on the floor. He walks, blinks, studies at his desk, closes
server tickets, drinks coffee, and pushes packages. Drag him onto the rocket
and he'll orbit the moon. Tap him for commentary.

Reduced motion: pi stays visible and grabbable, but doesn't auto-walk.

## Regenerating the marks

```
pip install pillow pyfiglet
python3 tools/marks.py            # prints wordmark + crescent HTML
python3 tools/marks.py favicon    # writes assets/favicon.png
```

© 2026 Ammaar Rehman
