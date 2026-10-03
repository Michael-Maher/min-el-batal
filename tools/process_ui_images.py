#!/usr/bin/env python3
"""Turn raw Weave renders into game-ready WebP files in images/ui/.

Usage:
  python3 tools/process_ui_images.py bg    images/ui/raw/x.png bg-hub-day
  python3 tools/process_ui_images.py card  images/ui/raw/x.png card-l1
  python3 tools/process_ui_images.py cut   images/ui/raw/x.png boss-goliath      # magenta key -> transparent
  python3 tools/process_ui_images.py icons images/ui/raw/x.png star gem flame ...  # 3x3 sheet, 9 names in reading order (left->right, top->bottom)
"""
import os
import sys
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'ui')


def save(img, name, quality=80):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.webp')
    img.save(path, 'WEBP', quality=quality, method=6)
    print('%s  %dx%d  %d KB' % (os.path.relpath(path), img.width, img.height, os.path.getsize(path) // 1024))


def fit_width(img, w):
    if img.width <= w:
        return img
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


def crop_ratio(img, rw, rh):
    """Center-crop to rw:rh."""
    target = rw / rh
    if img.width / img.height > target:
        nw = round(img.height * target)
        x = (img.width - nw) // 2
        return img.crop((x, 0, x + nw, img.height))
    nh = round(img.width / target)
    y = (img.height - nh) // 2
    return img.crop((0, y, img.width, y + nh))


def key_magenta(img):
    """Magenta (#FF00FF-ish) background -> alpha, with soft edges and de-spill."""
    img = img.convert('RGBA')
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            # how "magenta" the pixel is: high red+blue, low green
            m = min(r, b) - g
            if m > 120:
                px[x, y] = (r, g, b, 0)
            elif m > 50:
                k = (m - 50) / 70.0
                # pull the pink fringe toward neutral before fading it
                px[x, y] = (int(r - (r - g) * k * 0.6), g, int(b - (b - g) * k * 0.6), int(a * (1 - k)))
    return img


def trim(img, pad=8):
    box = img.getbbox()
    if not box:
        return img
    l, t, r, b = box
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    kind, src = sys.argv[1], sys.argv[2]
    names = sys.argv[3:]
    img = Image.open(src)
    if kind == 'bg':
        save(fit_width(crop_ratio(img.convert('RGB'), 9, 16), 1080), names[0], 78)
    elif kind == 'card':
        save(fit_width(crop_ratio(img.convert('RGB'), 2, 1), 1200), names[0], 80)
    elif kind == 'cut':
        save(fit_width(trim(key_magenta(img)), 900), names[0], 85)
    elif kind == 'icons':
        if len(names) != 9:
            sys.exit('icons needs exactly 9 names')
        keyed = key_magenta(img)
        cw, ch = keyed.width / 3, keyed.height / 3
        for i, n in enumerate(names):
            cx, cy = i % 3, i // 3
            cell = keyed.crop((round(cx * cw), round(cy * ch), round((cx + 1) * cw), round((cy + 1) * ch)))
            save(fit_width(trim(cell, 4), 256), 'ic-' + n, 85)
    else:
        sys.exit('unknown kind: ' + kind)


if __name__ == '__main__':
    main()
