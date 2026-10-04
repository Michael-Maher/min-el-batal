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
            # Key only true magenta: red ≈ blue, both bright, green low.
            # (A purple aura has blue well above red, so it survives.)
            if abs(r - b) > 70:
                continue
            m = min(r, b) - g
            if min(r, b) > 170 and m > 120:
                px[x, y] = (r, g, b, 0)
            elif min(r, b) > 110 and m > 60:
                k = min(1.0, (m - 60) / 60.0)
                # pull the pink fringe toward neutral before fading it
                px[x, y] = (int(r - (r - g) * k * 0.6), g, int(b - (b - g) * k * 0.6), int(a * (1 - k)))
    return img


def split_sheet(img, count=9):
    """Split a keyed icon sheet into `count` icons. Every opaque blob is found;
    the `count` largest are the icons, smaller blobs (sparkles, light rays) join
    the nearest icon. Returns icon crops in reading order (rows top to bottom,
    left to right inside a row)."""
    w, h = img.size
    ap = img.getchannel('A').load()
    label = [0] * (w * h)
    blobs = []  # [size, minx, miny, maxx, maxy]
    for sy in range(h):
        for sx in range(w):
            if ap[sx, sy] <= 40 or label[sy * w + sx]:
                continue
            n = len(blobs) + 1
            box = [0, sx, sy, sx, sy]
            stack = [(sx, sy)]
            label[sy * w + sx] = n
            while stack:
                x, y = stack.pop()
                box[0] += 1
                if x < box[1]: box[1] = x
                if y < box[2]: box[2] = y
                if x > box[3]: box[3] = x
                if y > box[4]: box[4] = y
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not label[ny * w + nx] and ap[nx, ny] > 40:
                        label[ny * w + nx] = n
                        stack.append((nx, ny))
            blobs.append(box)
    blobs.sort(key=lambda b: -b[0])
    icons = [list(b[1:]) for b in blobs[:count]]
    for b in blobs[count:]:
        if b[0] < 30:
            continue
        cx, cy = (b[1] + b[3]) / 2, (b[2] + b[4]) / 2
        best = min(icons, key=lambda r: (max(r[0] - cx, 0, cx - r[2])) ** 2 + (max(r[1] - cy, 0, cy - r[3])) ** 2)
        if (max(best[0] - cx, 0, cx - best[2])) ** 2 + (max(best[1] - cy, 0, cy - best[3])) ** 2 < 60 ** 2:
            best[0] = min(best[0], b[1]); best[1] = min(best[1], b[2])
            best[2] = max(best[2], b[3]); best[3] = max(best[3], b[4])
    # reading order: group into rows by vertical centre, then left to right
    icons.sort(key=lambda r: (r[1] + r[3]) / 2)
    rows, per = [], max(1, round(count ** 0.5))
    for i in range(0, len(icons), per):
        rows.append(sorted(icons[i:i + per], key=lambda r: r[0]))
    pad = 6
    return [img.crop((max(0, r[0] - pad), max(0, r[1] - pad), min(w, r[2] + pad + 1), min(h, r[3] + pad + 1)))
            for row in rows for r in row]


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
        for n, icon in zip(names, split_sheet(key_magenta(img))):
            save(fit_width(icon, 256), 'ic-' + n, 85)
    else:
        sys.exit('unknown kind: ' + kind)


if __name__ == '__main__':
    main()
