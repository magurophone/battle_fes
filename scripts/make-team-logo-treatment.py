from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "public" / "assets" / "logos" / "logo-B-trim.png"
LOGO_OUT_DIR = ROOT / "public" / "assets" / "logos" / "team-glow"
TEAM_OUT_DIR = ROOT / "public" / "assets" / "teams"

TEAMS = {
    "crimson": {
        "rgb": (255, 45, 120),
        "bg": ROOT / "public" / "assets" / "teams" / "crimson.png",
    },
    "nova": {
        "rgb": (140, 90, 255),
        "bg": ROOT / "public" / "assets" / "teams" / "nova.png",
    },
    "golden": {
        "rgb": (255, 215, 0),
        "bg": ROOT / "public" / "assets" / "teams" / "golden.png",
    },
}


def layer_from_alpha(alpha: Image.Image, rgb: tuple[int, int, int], opacity: float) -> Image.Image:
    alpha = alpha.point(lambda value: int(value * opacity))
    color = Image.new("RGBA", alpha.size, (*rgb, 0))
    color.putalpha(alpha)
    return color


def radial_atmosphere(
    size: tuple[int, int],
    center: tuple[float, float],
    radius: tuple[float, float],
) -> Image.Image:
    width, height = size
    center_x, center_y = center
    radius_x, radius_y = radius

    pixels = bytearray(width * height * 4)
    index = 0
    for y in range(height):
        dy = (y - center_y) / radius_y
        for x in range(width):
            dx = (x - center_x) / radius_x
            distance = (dx * dx + dy * dy) ** 0.5
            if distance >= 1:
                alpha = 0
            else:
                alpha = int(255 * 0.18 * (1 - distance) ** 1.7)
                if alpha < 2:
                    alpha = 0
            pixels[index:index + 4] = bytes((255, 150, 60, alpha))
            index += 4

    return Image.frombytes("RGBA", size, bytes(pixels))


def make_treatment(
    logo: Image.Image,
    team_rgb: tuple[int, int, int],
    scale: float = 1.0,
    include_atmosphere: bool = False,
) -> Image.Image:
    width, height = logo.size
    margin_left = int(width * 0.56)
    margin_right = int(width * 0.42)
    margin_top = int(height * 0.46)
    margin_bottom = int(height * 0.62)
    canvas_size = (width + margin_left + margin_right, height + margin_top + margin_bottom)
    logo_pos = (margin_left, margin_top)

    alpha = Image.new("L", canvas_size, 0)
    alpha.paste(logo.getchannel("A"), logo_pos)

    if include_atmosphere:
        result = radial_atmosphere(
            canvas_size,
            center=(
                logo_pos[0] + logo.width * 0.30,
                logo_pos[1] + logo.height * 0.35,
            ),
            radius=(logo.width * 0.78, logo.height * 0.76),
        )
    else:
        result = Image.new("RGBA", canvas_size, (0, 0, 0, 0))

    shadow_alpha = Image.new("L", canvas_size, 0)
    shadow_alpha.paste(
        logo.getchannel("A"),
        (logo_pos[0], logo_pos[1] + max(1, round(4 * scale))),
    )
    shadow_alpha = shadow_alpha.filter(ImageFilter.GaussianBlur(max(1, 12 * scale)))
    result.alpha_composite(layer_from_alpha(shadow_alpha, (0, 0, 0), 0.60))

    glow_alpha = alpha.filter(ImageFilter.GaussianBlur(max(1, 18 * scale)))
    result.alpha_composite(layer_from_alpha(glow_alpha, team_rgb, 0.55))

    result.alpha_composite(logo, logo_pos)
    return result


def resize_logo_for_background(logo: Image.Image, bg_size: tuple[int, int]) -> tuple[Image.Image, float]:
    target_width = int(bg_size[0] * 0.74)
    scale = target_width / logo.width
    target_height = round(logo.height * scale)
    resized = logo.resize((target_width, target_height), Image.Resampling.LANCZOS)
    return resized, scale


def composite_on_team_bg(team: str, treatment: Image.Image) -> Image.Image:
    background = Image.open(TEAMS[team]["bg"]).convert("RGBA")
    x = (background.width - treatment.width) // 2
    y = (background.height - treatment.height) // 2
    background.alpha_composite(treatment, (x, y))
    return background


def build(team: str, make_composite: bool = False) -> list[Path]:
    config = TEAMS[team]
    logo = Image.open(LOGO_PATH).convert("RGBA")

    LOGO_OUT_DIR.mkdir(parents=True, exist_ok=True)
    transparent_treatment = make_treatment(logo, config["rgb"], include_atmosphere=True)
    transparent_path = LOGO_OUT_DIR / f"logo-B-{team}-glow.png"
    transparent_treatment.save(transparent_path)

    if not make_composite:
        return [transparent_path]

    bg = Image.open(config["bg"]).convert("RGBA")
    resized_logo, scale = resize_logo_for_background(logo, bg.size)
    bg_treatment = make_treatment(resized_logo, config["rgb"], scale, include_atmosphere=True)
    composite_path = TEAM_OUT_DIR / f"{team}-logo-bg.png"
    composite_on_team_bg(team, bg_treatment).save(composite_path)

    return [transparent_path, composite_path]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("team", choices=sorted(TEAMS), nargs="?", default="nova")
    parser.add_argument("--composite", action="store_true")
    args = parser.parse_args()

    for path in build(args.team, make_composite=args.composite):
        print(path.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
