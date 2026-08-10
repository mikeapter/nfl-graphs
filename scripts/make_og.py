#!/usr/bin/env python3
"""Generate the static Open Graph card (public/og.png) for link previews.
Run locally (uses system fonts); the PNG is committed so CI doesn't regenerate it."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (11, 15, 23)
PANEL = (19, 26, 38)
ACCENT = (77, 163, 255)
MUTED = (147, 161, 184)
TEXT = (232, 237, 246)
BARS = ["#E31837", "#4DA3FF", "#34D399", "#FFB612", "#004C54", "#A5ACAF",
        "#0085CA", "#5A1414", "#0B162A", "#69BE28", "#AA0000", "#FB4F14"]


def font(sz, bold=True):
    for p in ([r"C:\Windows\Fonts\arialbd.ttf"] if bold else [r"C:\Windows\Fonts\arial.ttf"]) + \
             ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            continue
    return ImageFont.load_default()


def rrect(d, xy, r, fill):
    d.rounded_rectangle(xy, radius=r, fill=fill)


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# subtle top glow band
for i in range(160):
    a = int(22 * (1 - i / 160))
    d.line([(0, i), (W, i)], fill=(BG[0] + a // 3, BG[1] + a // 3, BG[2] + a))

# accent side bar
d.rectangle([0, 0, 10, H], fill=ACCENT)

# title
d.text((70, 70), "NFL Graphs", font=font(104), fill=TEXT)
d.text((74, 196), "Interactive NFL & college football stats", font=font(38, False), fill=MUTED)

# feature chips
chips = ["Team EPA", "Player explorers", "Tendencies", "Field maps", "College", "Red zone"]
x = 74
for c in chips:
    f = font(26, True)
    w = d.textbbox((0, 0), c, font=f)[2]
    rrect(d, [x, 262, x + w + 34, 306], 22, PANEL)
    d.text((x + 17, 270), c, font=f, fill=(200, 214, 230))
    x += w + 50
    if x > W - 160:
        break

# bar-chart motif
base = 560
bw = 78
gap = 14
heights = [120, 200, 90, 250, 160, 210, 140, 190, 100, 230, 175, 145]
x = 74
for i, h in enumerate(heights):
    col = tuple(int(BARS[i][j:j + 2], 16) for j in (1, 3, 5))
    rrect(d, [x, base - h, x + bw, base], 8, col)
    x += bw + gap

# footer
d.text((74, 584), "mikeapter.github.io/nfl-graphs", font=font(26, False), fill=MUTED)
foot = "@mikeapter  ·  nflverse data"
fw = d.textbbox((0, 0), foot, font=font(26, False))[2]
d.text((W - 70 - fw, 584), foot, font=font(26, False), fill=MUTED)

out = Path(__file__).resolve().parents[1] / "public" / "og.png"
img.save(out, "PNG")
print("wrote", out, img.size)
