# Team Wordmarks

Transparent SVG wordmark assets for background production. These are text-only assets with no background.

- `crimson.svg` uses `#ff2d78`
- `nova.svg` uses `#7c3aff`
- `golden.svg` uses `#ffd700`

The live site renders team names with `Black Ops One`, then falls back to `Bebas Neue` / sans-serif. These SVGs are outlined from `Black Ops One` so the stencil cuts are preserved without requiring the destination app to load the font. They mirror the live `.team-name` treatment: team color text, thin dark stroke, and dark shadow.

If the destination app has trouble importing SVG filters, use the PNG files.
