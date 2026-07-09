from pathlib import Path
from xml.sax.saxutils import escape

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "public" / "assets" / "fonts" / "BlackOpsOne-Regular.ttf"
OUT_DIR = ROOT / "public" / "assets" / "teams" / "wordmarks"

TEAMS = [
    ("crimson", "CRIMSON", "#ff2d78"),
    ("nova", "NOVA", "#7c3aff"),
    ("golden", "GOLDEN", "#ffd700"),
]

FONT_SIZE = 180
LETTER_SPACING_EM = 0.04
PADDING_X = 72
PADDING_Y = 68


def cmap_for(font):
    cmap = {}
    for table in font["cmap"].tables:
        cmap.update(table.cmap)
    return cmap


def glyph_path(glyph_set, glyph_name, transform):
    pen = SVGPathPen(glyph_set)
    glyph_set[glyph_name].draw(TransformPen(pen, transform))
    return pen.getCommands()


def glyph_bounds(glyph_set, glyph_name, transform):
    pen = BoundsPen(glyph_set)
    glyph_set[glyph_name].draw(TransformPen(pen, transform))
    return pen.bounds


def union_bounds(bounds_list):
    bounds_list = [b for b in bounds_list if b]
    min_x = min(b[0] for b in bounds_list)
    min_y = min(b[1] for b in bounds_list)
    max_x = max(b[2] for b in bounds_list)
    max_y = max(b[3] for b in bounds_list)
    return min_x, min_y, max_x, max_y


def render_word(font, glyph_set, cmap, word, color):
    units_per_em = font["head"].unitsPerEm
    scale = FONT_SIZE / units_per_em
    letter_spacing = FONT_SIZE * LETTER_SPACING_EM
    hmtx = font["hmtx"].metrics

    glyph_names = [cmap[ord(ch)] for ch in word]
    total_advance = sum(hmtx[name][0] * scale for name in glyph_names)
    total_advance += letter_spacing * (len(glyph_names) - 1)
    view_w = round(total_advance + PADDING_X * 2, 3)

    x = PADDING_X
    first_pass = []
    for name in glyph_names:
        transform = (scale, 0, 0, -scale, x, 0)
        first_pass.append((name, x, glyph_bounds(glyph_set, name, transform)))
        x += hmtx[name][0] * scale + letter_spacing

    _, min_y, _, max_y = union_bounds([item[2] for item in first_pass])
    shift_y = PADDING_Y - min_y
    view_h = round((max_y - min_y) + PADDING_Y * 2, 3)

    paths = []
    x = PADDING_X
    for name in glyph_names:
        transform = (scale, 0, 0, -scale, x, shift_y)
        paths.append(glyph_path(glyph_set, name, transform))
        x += hmtx[name][0] * scale + letter_spacing

    path_data = " ".join(paths)
    word_escaped = escape(word)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w} {view_h}" role="img" aria-labelledby="title desc">
  <title id="title">{word_escaped} wordmark</title>
  <desc id="desc">Transparent outlined {word_escaped} team wordmark using the event stencil lettering and team color.</desc>
  <defs>
    <filter id="teamShadow" x="-25%" y="-60%" width="150%" height="220%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#000000" flood-opacity="0.85"/>
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.95"/>
      <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#000000" flood-opacity="0.80"/>
    </filter>
  </defs>
  <path d="{path_data}" fill="{color}" stroke="#000000" stroke-opacity="0.55" stroke-width="0.4" paint-order="stroke fill" filter="url(#teamShadow)"/>
</svg>
'''


def main():
    font = TTFont(FONT_PATH)
    glyph_set = font.getGlyphSet()
    cmap = cmap_for(font)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for slug, word, color in TEAMS:
        svg = render_word(font, glyph_set, cmap, word, color)
        (OUT_DIR / f"{slug}.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
