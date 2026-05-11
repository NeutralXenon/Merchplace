from __future__ import annotations

import math
import os
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs" / "submissions" / "legends-assets"
OUT_DIR = ROOT / "docs" / "submissions" / "video"
OUT_DIR.mkdir(parents=True, exist_ok=True)

W, H = 1280, 720
FPS = 12
DURATION = 180
TOTAL_FRAMES = FPS * DURATION

BG = (17, 16, 14)
PANEL = (23, 22, 19)
TEXT = (242, 237, 228)
MUTED = (184, 173, 159)
DIM = (127, 117, 105)
PURPLE = (124, 92, 255)
MINT = (143, 235, 195)

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
BOLD = str(FONT_DIR / "Arial Black.ttf")
REG = str(FONT_DIR / "Arial.ttf")
MONO = "/System/Library/Fonts/Menlo.ttc"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


F = {
    "hero": font(BOLD, 86),
    "big": font(BOLD, 64),
    "headline": font(BOLD, 52),
    "sub": font(REG, 28),
    "body": font(REG, 24),
    "small": font(REG, 19),
    "mono": font(MONO, 18),
    "mono_big": font(MONO, 38),
    "mono_small": font(MONO, 15),
}


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fnt, fill=TEXT, anchor=None, spacing=4):
    draw.multiline_text(xy, value, font=fnt, fill=fill, anchor=anchor, spacing=spacing)


def wrap(value: str, fnt, max_width: int) -> str:
    words = value.split()
    lines: list[str] = []
    line = ""
    scratch = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    for word in words:
        trial = f"{line} {word}".strip()
        if scratch.textbbox((0, 0), trial, font=fnt)[2] <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return "\n".join(lines)


def base_frame(frame: int) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # Soft brand light.
    for cx, cy, color, alpha, rad in [
        (210, 120, PURPLE, 56, 360),
        (880, 620, MINT, 36, 420),
    ]:
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=(*color, alpha))
        overlay.alpha_composite(glow.filter(ImageFilter.GaussianBlur(rad // 2)))

    # Grid.
    for x in range(0, W + 1, 64):
        od.line((x, 0, x, H), fill=(245, 236, 220, 15))
    for y in range(0, H + 1, 64):
        od.line((0, y, W, y), fill=(245, 236, 220, 17))

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    return img


def paste_logo(img: Image.Image, x: int, y: int, size: int, alpha: float = 1.0):
    logo = Image.open(ASSET_DIR / "merchplace-logo-240.png").convert("RGBA")
    logo = logo.resize((size, size), Image.LANCZOS)
    if alpha < 1:
        logo.putalpha(logo.getchannel("A").point(lambda p: int(p * alpha)))
    img.paste(logo, (x, y), logo)


def screenshot_card(img: Image.Image, path: str, box, label: str):
    d = ImageDraw.Draw(img)
    x, y, w, h = box
    rounded(d, (x, y, x + w, y + h), 18, (20, 19, 17), (58, 54, 49), 2)
    shot = Image.open(ASSET_DIR / path).convert("RGB")
    shot.thumbnail((w - 34, h - 62), Image.LANCZOS)
    sx = x + (w - shot.width) // 2
    sy = y + 44
    img.paste(shot, (sx, sy))
    text(d, (x + 22, y + 22), label.upper(), F["mono_small"], MINT)


def escrow_card(img: Image.Image, x: int, y: int, scale: float = 1.0):
    d = ImageDraw.Draw(img)
    w, h = int(360 * scale), int(176 * scale)
    pad = int(38 * scale)
    rounded(d, (x, y, x + w, y + h), int(18 * scale), PANEL, (62, 58, 52), 2)
    text(d, (x + pad, y + int(49 * scale)), "ESCROW TERMS", font(MONO, int(17 * scale)), MUTED, anchor="lm")
    text(d, (x + w - pad, y + int(48 * scale)), "5%", font(MONO, int(39 * scale)), TEXT, anchor="rm")
    d.line((x + pad, y + int(75 * scale), x + w - pad, y + int(75 * scale)), fill=(245, 236, 220, 38), width=max(1, int(1.2 * scale)))
    label_font = font(MONO, int(12 * scale))
    value_font = font(BOLD, int(14 * scale))
    text(d, (x + pad, y + int(108 * scale)), "BUYER PAYS", label_font, DIM, anchor="lm")
    text(d, (x + pad + int(142 * scale), y + int(108 * scale)), "Item + shipping + protection", value_font, TEXT, anchor="lm")
    text(d, (x + pad, y + int(141 * scale)), "RELEASE", label_font, DIM, anchor="lm")
    text(d, (x + pad + int(142 * scale), y + int(141 * scale)), "After receipt confirmation", value_font, TEXT, anchor="lm")


def scene_for_time(t: float):
    scenes = [
        (0, 20, "hook"),
        (20, 40, "overview"),
        (40, 80, "seller"),
        (80, 120, "buyer"),
        (120, 145, "fulfillment"),
        (145, 170, "technical"),
        (170, 180, "close"),
    ]
    for start, end, name in scenes:
        if start <= t < end:
            return start, end, name
    return scenes[-1]


def draw_scene(frame: int) -> Image.Image:
    t = frame / FPS
    start, end, name = scene_for_time(t)
    local = (t - start) / (end - start)
    e = ease(local)
    img = base_frame(frame)
    d = ImageDraw.Draw(img)

    if name == "hook":
        paste_logo(img, 76, 76, 120)
        text(d, (226, 120), "Merchplace", F["hero"], TEXT)
        text(d, (232, 224), "EVENT MERCH, VERIFIED ONCHAIN", F["mono"], MINT)
        text(d, (76, 345), wrap("Solana event merch still trades through DMs and trust.", F["headline"], 780), F["headline"], TEXT)
        text(d, (80, 530), wrap("Merchplace makes those trades escrowed, trackable, and event-specific.", F["body"], 720), F["body"], MUTED)
        escrow_card(img, 838, 418, 1.0)

    elif name == "overview":
        text(d, (74, 70), "The marketplace flow", F["big"], TEXT)
        steps = [
            ("1", "Seller lists event merch"),
            ("2", "Buyer deposits USDC escrow"),
            ("3", "Tracking gets added"),
            ("4", "Buyer releases funds"),
        ]
        for i, (num, val) in enumerate(steps):
            x = 82 + i * 292
            rounded(d, (x, 210, x + 240, 390), 22, PANEL, (58, 54, 49), 2)
            rounded(d, (x + 22, 232, x + 70, 280), 24, PURPLE if i < 2 else MINT, None)
            text(d, (x + 46, 257), num, F["body"], (255, 255, 255), anchor="mm")
            text(d, (x + 22, 315), wrap(val, F["body"], 190), F["body"], TEXT)
        screenshot_card(img, "homepage-video.png", (742, 430, 460, 245), "live product")

    elif name == "seller":
        text(d, (74, 58), "Seller flow", F["big"], TEXT)
        text(d, (78, 132), "Create a listing with event context, photos, price, and carrier shipping.", F["body"], MUTED)
        screenshot_card(img, "sell-video.png", (70, 188, 690, 450), "sell page")
        rounded(d, (812, 232, 1176, 420), 22, PANEL, (58, 54, 49), 2)
        text(d, (846, 284), "Backend verifies chain state", F["headline"], TEXT)
        text(d, (850, 356), wrap("Metadata only goes live after the on-chain listing is confirmed.", F["body"], 280), F["body"], MUTED)

    elif name == "buyer":
        text(d, (74, 58), "Buyer flow", F["big"], TEXT)
        text(d, (78, 132), "The checkout explains the full USDC total before wallet approval.", F["body"], MUTED)
        screenshot_card(img, "listing-video.png", (70, 188, 710, 450), "listing detail")
        escrow_card(img, 846, 236, 1.0)
        text(d, (850, 470), "Status moves to", F["body"], MUTED)
        text(d, (850, 522), "IN ESCROW", F["mono_big"], MINT)

    elif name == "fulfillment":
        text(d, (74, 70), "Fulfillment is explicit", F["big"], TEXT)
        cards = [
            ("SELLER", "Adds carrier tracking during escrow"),
            ("BUYER", "Reviews delivery context"),
            ("RECEIPT", "Confirms arrival and releases funds"),
        ]
        for i, (title, body) in enumerate(cards):
            x = 90 + i * 385
            rounded(d, (x, 238, x + 320, 456), 24, PANEL, (58, 54, 49), 2)
            text(d, (x + 28, 292), title, F["mono"], MINT)
            text(d, (x + 28, 350), wrap(body, F["body"], 250), F["body"], TEXT)
        text(d, (92, 560), "Seller proceeds + treasury fee release only after receipt confirmation.", F["body"], MUTED)

    elif name == "technical":
        text(d, (74, 58), "Technical proof", F["big"], TEXT)
        code = [
            "create_listing()",
            "buy_item()",
            "confirm_receipt()",
            "cancel_purchase()",
            "cancel_listing()",
        ]
        rounded(d, (76, 160, 570, 560), 24, (11, 11, 10), (58, 54, 49), 2)
        for i, line in enumerate(code):
            text(d, (120, 225 + i * 58), line, F["mono_big"], MINT if i == int(local * 5) % 5 else TEXT)
        rounded(d, (650, 190, 1138, 515), 24, PANEL, (58, 54, 49), 2)
        text(d, (690, 252), "Localnet smoke tests pass", F["headline"], TEXT)
        text(d, (694, 330), wrap("Create, buy, confirm receipt, buyer cancellation, and seller cancellation are covered by generated-wallet lifecycle tests.", F["body"], 370), F["body"], MUTED)

    else:
        paste_logo(img, 500, 96, 150)
        text(d, (640, 304), "Merchplace", F["hero"], TEXT, anchor="mm")
        text(d, (640, 382), "STARTING WITH BREAKPOINT + COLOSSEUM DROPS", F["mono"], MINT, anchor="mm")
        text(d, (640, 520), "Try the demo. Upvote on Legends.", F["headline"], TEXT, anchor="mm")

    return img


def jpeg_bytes(img: Image.Image, quality: int = 88) -> bytes:
    from io import BytesIO

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=False)
    return buf.getvalue()


def pad_even(data: bytes) -> bytes:
    return data + (b"\0" if len(data) % 2 else b"")


def write_mjpeg_avi(path: Path):
    frames = [jpeg_bytes(draw_scene(i)) for i in range(TOTAL_FRAMES)]
    movi_chunks = []
    idx_entries = []
    offset = 4
    for data in frames:
        chunk = b"00dc" + struct.pack("<I", len(data)) + pad_even(data)
        movi_chunks.append(chunk)
        idx_entries.append((b"00dc", 0x10, offset, len(data)))
        offset += len(chunk)
    movi_data = b"".join(movi_chunks)

    microsec_per_frame = int(1_000_000 / FPS)
    max_bytes = max(len(f) for f in frames)
    avi_header = struct.pack(
        "<IIIIIIIIII4I",
        microsec_per_frame,
        max_bytes * FPS,
        0,
        0x10,
        TOTAL_FRAMES,
        0,
        1,
        max_bytes,
        W,
        H,
        0,
        0,
        0,
        0,
    )
    strh = struct.pack(
        "<4s4sIHHIIIIIIIIhhhh",
        b"vids",
        b"MJPG",
        0,
        0,
        0,
        0,
        1,
        FPS,
        0,
        TOTAL_FRAMES,
        max_bytes,
        0xFFFFFFFF,
        0,
        0,
        0,
        W,
        H,
    )
    strf = struct.pack(
        "<IiiHH4sIiiII",
        40,
        W,
        H,
        1,
        24,
        b"MJPG",
        W * H * 3,
        0,
        0,
        0,
        0,
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        return tag + struct.pack("<I", len(data)) + pad_even(data)

    def list_chunk(kind: bytes, data: bytes) -> bytes:
        return b"LIST" + struct.pack("<I", len(data) + 4) + kind + data

    hdrl = list_chunk(
        b"hdrl",
        chunk(b"avih", avi_header)
        + list_chunk(b"strl", chunk(b"strh", strh) + chunk(b"strf", strf)),
    )
    movi = list_chunk(b"movi", movi_data)
    idx_data = b"".join(struct.pack("<4sIII", *entry) for entry in idx_entries)
    idx = chunk(b"idx1", idx_data)
    riff_data = hdrl + movi + idx
    path.write_bytes(b"RIFF" + struct.pack("<I", len(riff_data) + 4) + b"AVI " + riff_data)


if __name__ == "__main__":
    avi_path = OUT_DIR / "merchplace-demo-draft.avi"
    write_mjpeg_avi(avi_path)
    print(avi_path)
