#!/usr/bin/env python3
"""Rasterise public/favicon.svg's artwork into the PNG sizes the manifest wants.

Deliberately dependency-free: the icon is three shapes, and a handful of lines of
zlib is a better trade than pulling a native image library into the toolchain
just to redraw a wedge of cheese. Run it if the artwork changes:

    python3 scripts/make-icons.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

BG = (0x12, 0x10, 0x0E)
CHEESE = (0xF4, 0xC0, 0x4A)

# Traced from favicon.svg, in its 64x64 viewBox.
VIEWBOX = 64.0
WEDGE = [(10, 40), (32, 18), (54, 26), (54, 47), (10, 47)]
HOLES = [(22, 38, 4), (36, 33, 3), (45, 40, 2.5)]
CORNER = 12.0
SS = 4  # supersampling factor, for edges that do not look chewed


def inside_polygon(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > y) != (y1 > y):
            t = (y - y0) / (y1 - y0)
            if x < x0 + t * (x1 - x0):
                inside = not inside
    return inside


def inside_rounded_rect(x: float, y: float, size: float, radius: float) -> bool:
    if x < 0 or y < 0 or x > size or y > size:
        return False
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2


def sample(x: float, y: float) -> tuple[int, int, int, int]:
    """Colour of the artwork at a point in viewBox coordinates."""
    if not inside_rounded_rect(x, y, VIEWBOX, CORNER):
        return (0, 0, 0, 0)
    for hx, hy, r in HOLES:
        if (x - hx) ** 2 + (y - hy) ** 2 <= r**2:
            return (*BG, 255)
    if inside_polygon(x, y, WEDGE):
        return (*CHEESE, 255)
    return (*BG, 255)


def render(size: int) -> bytes:
    scale = VIEWBOX / (size * SS)
    rows = bytearray()
    for py in range(size):
        rows.append(0)  # PNG filter type 0
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = ((px * SS) + sx + 0.5) * scale
                    y = ((py * SS) + sy + 0.5) * scale
                    sr, sg, sb, sa = sample(x, y)
                    r += sr * sa
                    g += sg * sa
                    b += sb * sa
                    a += sa
            if a == 0:
                rows.extend((0, 0, 0, 0))
            else:
                n = SS * SS
                rows.extend((r // a, g // a, b // a, a // n))
    return bytes(rows)


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, size: int) -> None:
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(render(size), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    print(f"{path} ({size}x{size}, {len(png)} bytes)")


if __name__ == "__main__":
    public = Path(__file__).resolve().parent.parent / "public"
    for size in (192, 512):
        write_png(public / f"icon-{size}.png", size)
