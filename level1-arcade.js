/*
 * level1-arcade.js  (v2)
 * Level 1 (Bible) signature canvas arcade games.
 * Defines the global L1_ARCADE = { langLibrary, ark, joseph, redSea, gideon, sling }.
 * Interface: docs/superpowers/specs/2026-09-29-level1-contracts.md (section B).
 *   L1_ARCADE.<name>(host, data, api) -> { destroy: function () {}, partial: function () {} }
 *   api: ask(q, cb), end(raw, rawMax), sfx(name), fx(x, y), hud(text)
 * v2 spec: docs/superpowers/specs/2026-09-29-level1-arcade-v2-and-content-audit.md (A, C).
 *
 * All narrative text (intro, outro verse, facts, phase names, stages, items) comes from
 * the game's data object. Only generic UI strings live in this file.
 * Plain global script, ES5 style, no dependencies, no image files: every scene is drawn
 * with canvas shapes and gradients; emoji are used only as small accents (and for the
 * data-driven ark animals).
 */
var L1_ARCADE = (function () {
    'use strict';

    var FONT = "'Cairo', sans-serif";
    var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Cairo",sans-serif';
    var COPTIC_FONT = "'Noto Sans Coptic','Antinoou','Segoe UI Historic','New Athena Unicode',serif";
    var TAU = Math.PI * 2;

    /* Warm Egyptian / Coptic palette */
    var C = {
        sand: '#e9c98f', sandD: '#c49a5a', sandL: '#f6e2b5',
        nile: '#1f6fa3', nileD: '#0f3d63', nileL: '#5fb3d9',
        gold: '#e2b34d', goldL: '#ffe7a3', goldD: '#9a6b1c',
        red: '#8e1f1f', redD: '#561010', redL: '#b83a2a',
        ink: '#2b170b', cream: '#fbf1d8', night: '#0d1433',
        olive: '#6f8a3a', oliveD: '#4b6326', skin: '#c98d5f', skinD: '#9c6538',
        linen: '#f3ead6', stone: '#8c7a63'
    };

    /* ================================================================ utils */
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function eo(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
    function eio(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function eob(t) { t = clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function eel(t) { t = clamp(t, 0, 1); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; }
    function shuffle(arr) {
        var a = (arr || []).slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }
    function seeded(seed) {
        var s = (seed || 1) % 2147483647;
        if (s <= 0) s += 2147483646;
        return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    }
    var AR_DIG = '٠١٢٣٤٥٦٧٨٩';
    function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR_DIG.charAt(+d); }); }
    function plain(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }
    function font(size, weight) { return (weight || 700) + ' ' + Math.max(8, Math.round(size)) + 'px ' + FONT; }
    function validQuestions(list) {
        return (list || []).filter(function (q) {
            return q && q.q && q.options && q.options.length >= 2 && typeof q.correct === 'number' &&
                q.correct >= 0 && q.correct < q.options.length;
        });
    }
    function strList(list) { return (list || []).filter(function (s) { return typeof s === 'string' && s; }); }
    function prefersReduced() {
        try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }

    /* ------------------------------------------------------------ drawing */
    function rr(ctx, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function circ(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }
    function ell(ctx, x, y, rx, ry) { ctx.moveTo(x + rx, y); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
    function txt(ctx, s, x, y, f, color, align, stroke, strokeColor) {
        ctx.font = f;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        if (stroke) {
            ctx.lineJoin = 'round'; ctx.lineWidth = stroke; ctx.strokeStyle = strokeColor || 'rgba(20,8,0,0.6)';
            ctx.strokeText(s, x, y);
        }
        ctx.fillStyle = color || '#fff';
        ctx.fillText(s, x, y);
    }
    function emo(ctx, e, x, y, size) {
        ctx.font = Math.max(8, Math.round(size)) + 'px ' + EMOJI_FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
        ctx.fillText(e, x, y);
    }
    function wrap(ctx, text, maxW) {
        var out = [];
        String(text).split('\n').forEach(function (para) {
            var words = para.split(/\s+/), line = '';
            for (var i = 0; i < words.length; i++) {
                if (!words[i]) continue;
                var test = line ? line + ' ' + words[i] : words[i];
                if (line && ctx.measureText(test).width > maxW) { out.push(line); line = words[i]; }
                else line = test;
            }
            out.push(line);
        });
        return out;
    }
    var blockCache = {}, blockCacheN = 0;
    // Wrapped, centered text block; shrinks the font until it fits maxH / maxLines.
    function block(ctx, text, cx, cy, maxW, maxH, size, weight, color, maxLines, align) {
        text = plain(text);
        var key = text + '|' + Math.round(maxW) + '|' + Math.round(maxH) + '|' + Math.round(size) + '|' + weight + '|' + maxLines;
        var c = blockCache[key];
        if (!c) {
            var s = size, lines, lh;
            for (;;) {
                ctx.font = font(s, weight);
                lines = wrap(ctx, text, maxW);
                lh = s * 1.42;
                if ((lines.length <= (maxLines || 99) && lines.length * lh <= maxH) || s <= 10) break;
                s -= 1;
            }
            if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
            c = { s: s, lines: lines, lh: lh };
            if (blockCacheN > 400) { blockCache = {}; blockCacheN = 0; }
            blockCache[key] = c; blockCacheN++;
        }
        ctx.font = font(c.s, weight);
        ctx.fillStyle = color; ctx.textBaseline = 'middle';
        ctx.textAlign = align || 'center';
        var x = align === 'right' ? cx + maxW / 2 : (align === 'left' ? cx - maxW / 2 : cx);
        var y0 = cy - (c.lines.length - 1) * c.lh / 2;
        for (var i = 0; i < c.lines.length; i++) ctx.fillText(c.lines[i], x, y0 + i * c.lh);
        return c.lines.length * c.lh;
    }
    function inRect(p, r, pad) {
        pad = pad || 0;
        return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
    }
    function vgrad(ctx, y0, y1, stops) {
        var g = ctx.createLinearGradient(0, y0, 0, y1);
        for (var i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
        return g;
    }

    /* --------------------------------------------------- offscreen layers */
    function mkCanvas(w, h, dpr) {
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        var x = c.getContext('2d');
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        c._w = w; c._h = h;
        return c;
    }
    function layer(w, h, dpr, fn) {
        var c = mkCanvas(w, h, dpr), x = c.getContext('2d');
        x.direction = 'rtl';
        fn(x, w, h);
        return c;
    }
    function blit(ctx, c, x, y, w, h) { if (c) ctx.drawImage(c, x, y, w || c._w, h || c._h); }
    // Horizontally tiled layer (layer width == tile width), scrolled by off.
    function blitTiled(ctx, c, off, y, W) {
        if (!c) return;
        var w = c._w, x = -(((off % w) + w) % w);
        for (; x < W; x += w) ctx.drawImage(c, x, y, w, c._h);
    }
    // Periodic ridge line (period = w) for seamless parallax hills.
    function ridge(ctx, w, base, amp, seed, harmonics, bottom) {
        var r = seeded(seed), hs = [];
        for (var i = 0; i < (harmonics || 3); i++) hs.push({ n: 1 + Math.floor(r() * 4) + i, a: amp * (0.6 - i * 0.15) * (0.6 + r() * 0.6), p: r() * TAU });
        ctx.beginPath();
        ctx.moveTo(0, bottom);
        for (var x = 0; x <= w + 1; x += 6) {
            var y = base;
            for (var j = 0; j < hs.length; j++) y -= hs[j].a * (0.5 + 0.5 * Math.sin(TAU * hs[j].n * x / w + hs[j].p));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, bottom);
        ctx.closePath();
    }

    /* ======================================================= Coptic art kit */
    var COPTIC = 'ⲀⲂⲄⲆⲈⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰϢϤϦϨϪϬϮ';
    var GREEK = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
    var glyphSet = null, glyphFont = 'serif';
    // Coptic letters when the device has a Coptic font, Greek uncials (their ancestor) otherwise.
    function glyphs() {
        if (glyphSet) return glyphSet;
        glyphSet = GREEK; glyphFont = 'serif';
        try {
            var c = document.createElement('canvas'); c.width = 24; c.height = 24;
            var x = c.getContext('2d');
            var sig = function (ch) {
                x.clearRect(0, 0, 24, 24);
                x.font = '20px ' + COPTIC_FONT; x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
                x.fillText(ch, 12, 12);
                var d = x.getImageData(0, 0, 24, 24).data, s = 7;
                for (var i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) % 1000003;
                return s;
            };
            var a = sig('Ⲁ'), b = sig('Ⲃ'), none = sig('￿');
            if (a !== b && a !== none && b !== none) { glyphSet = COPTIC; glyphFont = COPTIC_FONT; }
        } catch (e) { /* keep Greek */ }
        return glyphSet;
    }
    function glyphAt(i) { var g = glyphs(); return g.charAt(((i % g.length) + g.length) % g.length); }

    // Coptic cross: four flared arms, each ending in three knobs, with a centre boss.
    function crossPath(ctx, x, y, s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        for (var i = 0; i < 4; i++) {
            ctx.moveTo(-s * 0.1, -s * 0.1);
            ctx.lineTo(-s * 0.16, -s * 0.6);
            ctx.lineTo(s * 0.16, -s * 0.6);
            ctx.lineTo(s * 0.1, -s * 0.1);
            ctx.closePath();
            circ(ctx, 0, -s * 0.76, s * 0.11);
            circ(ctx, -s * 0.17, -s * 0.64, s * 0.09);
            circ(ctx, s * 0.17, -s * 0.64, s * 0.09);
            ctx.rotate(Math.PI / 2);
        }
        circ(ctx, 0, 0, s * 0.2);
        ctx.restore();
    }
    function copticCross(ctx, x, y, s, fill, stroke, lw) {
        crossPath(ctx, x, y, s);
        if (stroke) { ctx.lineWidth = lw || Math.max(1, s * 0.12); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
        ctx.fillStyle = fill || C.gold;
        ctx.fill();
    }
    var spriteCache = {};
    function cached(key, w, h, dpr, fn) {
        key = key + '@' + dpr;
        var c = spriteCache[key];
        if (!c) { c = layer(w, h, dpr, fn); spriteCache[key] = c; }
        return c;
    }
    function crossSprite(s, fill, dpr) {
        s = Math.max(6, Math.round(s));
        return cached('x' + s + fill, s * 2 + 4, s * 2 + 4, dpr, function (x) {
            copticCross(x, s + 2, s + 2, s, fill, 'rgba(40,20,0,0.55)', Math.max(1, s * 0.1));
        });
    }
    function drawCross(ctx, x, y, s, fill, dpr) {
        var c = crossSprite(s, fill || C.gold, dpr || 1);
        ctx.drawImage(c, x - c._w / 2, y - c._h / 2, c._w, c._h);
    }
    // Icon-style halo: gold disc, dotted rim, dark outline, soft glow.
    function haloSprite(r, dpr) {
        r = Math.max(4, Math.round(r));
        var R = Math.ceil(r * 1.45);
        return cached('h' + r, R * 2, R * 2, dpr, function (x) {
            var g = x.createRadialGradient(R, R, r * 0.9, R, R, R);
            g.addColorStop(0, 'rgba(255,220,120,0.35)'); g.addColorStop(1, 'rgba(255,220,120,0)');
            x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2);
            g = x.createRadialGradient(R - r * 0.25, R - r * 0.3, r * 0.1, R, R, r);
            g.addColorStop(0, '#fff6cf'); g.addColorStop(0.55, '#f1c962'); g.addColorStop(0.88, '#d49f35'); g.addColorStop(1, '#a8741f');
            x.beginPath(); circ(x, R, R, r); x.fillStyle = g; x.fill();
            x.lineWidth = Math.max(1, r * 0.08); x.strokeStyle = '#6a4510'; x.stroke();
            x.beginPath(); circ(x, R, R, r * 0.8); x.lineWidth = 1; x.strokeStyle = 'rgba(110,70,15,0.55)'; x.stroke();
            x.fillStyle = '#fff1bd';
            for (var i = 0; i < 22; i++) {
                var a = i / 22 * TAU;
                x.beginPath(); circ(x, R + Math.cos(a) * r * 0.9, R + Math.sin(a) * r * 0.9, Math.max(0.6, r * 0.045)); x.fill();
            }
        });
    }
    function halo(ctx, x, y, r, dpr) {
        var c = haloSprite(r, dpr || 1);
        ctx.drawImage(c, x - c._w / 2, y - c._h / 2, c._w, c._h);
    }
    // Coptic panel: deep red frame, gold braided band, parchment centre, cross corners.
    function panelArt(x, w, h, dpr) {
        var R = Math.min(20, h * 0.1), bw = clamp(Math.min(w, h) * 0.05, 9, 15);
        x.save();
        x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 16; x.shadowOffsetY = 6;
        rr(x, 4, 4, w - 8, h - 10, R);
        x.fillStyle = vgrad(x, 4, h, ['#8a1c1c', '#5c1010', '#3d0a0a']);
        x.fill();
        x.restore();
        rr(x, 4 + bw * 0.35, 4 + bw * 0.35, w - 8 - bw * 0.7, h - 10 - bw * 0.7, R * 0.85);
        x.lineWidth = 1.6; x.strokeStyle = C.gold; x.stroke();
        // braided band: diamonds with dots along the frame
        var inset = 4 + bw * 0.5 + 1, step = bw * 1.25, d = bw * 0.28;
        x.fillStyle = C.gold;
        function dia(cx, cy) {
            x.beginPath(); x.moveTo(cx, cy - d); x.lineTo(cx + d, cy); x.lineTo(cx, cy + d); x.lineTo(cx - d, cy); x.closePath(); x.fill();
        }
        var i, n;
        n = Math.floor((w - 8 - R * 2.4) / step);
        for (i = 0; i <= n; i++) {
            var px = 4 + R * 1.2 + i * (w - 8 - R * 2.4) / Math.max(1, n);
            dia(px, inset); dia(px, h - 6 - inset + 4);
        }
        n = Math.floor((h - 10 - R * 2.4) / step);
        for (i = 0; i <= n; i++) {
            var py = 4 + R * 1.2 + i * (h - 10 - R * 2.4) / Math.max(1, n);
            dia(inset, py); dia(w - inset, py);
        }
        // parchment
        var ix = 4 + bw + 2, iy = 4 + bw + 2, iw = w - 8 - (bw + 2) * 2, ih = h - 10 - (bw + 2) * 2;
        rr(x, ix, iy, iw, ih, R * 0.55);
        var g = x.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
        g.addColorStop(0, '#fff8e4'); g.addColorStop(0.7, '#f3e0b4'); g.addColorStop(1, '#dcbf85');
        x.fillStyle = g; x.fill();
        x.save(); x.clip();
        var r = seeded(Math.round(w * 7 + h)), k2;
        x.fillStyle = 'rgba(120,80,30,0.06)';
        for (k2 = 0; k2 < w * h / 900; k2++) { x.beginPath(); circ(x, ix + r() * iw, iy + r() * ih, 0.5 + r() * 1.6); x.fill(); }
        x.restore();
        rr(x, ix + 3, iy + 3, iw - 6, ih - 6, R * 0.45);
        x.lineWidth = 1; x.strokeStyle = 'rgba(142,31,31,0.45)'; x.stroke();
        // corner crosses + top medallion
        var cs = clamp(bw * 1.05, 9, 15);
        copticCross(x, ix + 2, iy + 2, cs, C.gold, C.redD, 1.2);
        copticCross(x, ix + iw - 2, iy + 2, cs, C.gold, C.redD, 1.2);
        copticCross(x, ix + 2, iy + ih - 2, cs, C.gold, C.redD, 1.2);
        copticCross(x, ix + iw - 2, iy + ih - 2, cs, C.gold, C.redD, 1.2);
    }
    function panelSprite(w, h, dpr) {
        w = Math.round(w); h = Math.round(h);
        return cached('p' + w + 'x' + h, w, h, dpr, function (x) { panelArt(x, w, h, dpr); });
    }
    // Horizontal Coptic frieze strip (repeating crosses and diamonds), tileable.
    function friezeSprite(h, dpr, fg, bg) {
        h = Math.max(8, Math.round(h));
        var w = h * 2;
        return cached('f' + h + fg + bg, w, h, dpr, function (x) {
            x.fillStyle = bg; x.fillRect(0, 0, w, h);
            x.fillStyle = fg;
            x.fillRect(0, 1, w, Math.max(1, h * 0.08)); x.fillRect(0, h - 1 - Math.max(1, h * 0.08), w, Math.max(1, h * 0.08));
            copticCross(x, h * 0.5, h / 2, h * 0.34, fg);
            x.beginPath(); x.moveTo(h * 1.5, h * 0.22); x.lineTo(h * 1.78, h / 2); x.lineTo(h * 1.5, h * 0.78); x.lineTo(h * 1.22, h / 2); x.closePath(); x.fill();
            x.beginPath(); circ(x, h, h / 2, h * 0.07); circ(x, 0, h / 2, h * 0.07); circ(x, w, h / 2, h * 0.07); x.fill();
        });
    }
    // 8-point star (Joseph's stars, sky).
    function starPath(ctx, x, y, r, inner) {
        ctx.beginPath();
        for (var i = 0; i < 16; i++) {
            var a = i / 16 * TAU - Math.PI / 2, rad = i % 2 ? r * (inner || 0.45) : r;
            if (i) ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
            else ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        ctx.closePath();
    }
    function heartPath(ctx, x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.35);
        ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.85, x, y - s * 0.35);
        ctx.bezierCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
        ctx.closePath();
    }

    /* -------------------------------------------------- characters (icon style)
     * figure(ctx, f): standing / walking person drawn in a Coptic icon manner.
     * f: x, y (feet), h (height px), dir (1 faces right, -1 faces left), robe, mantle,
     *    skin, hair, beard (0..1), beardColor, halo (bool), walk (phase, <0 = idle),
     *    arm (angle of the front arm, 0 = down, PI/2 = forward, PI = up), arm2 (back arm),
     *    prop ('staff'|'torch'|'trumpet'|'sling'|null), stripes (array of robe colours),
     *    collar (gold), crown, t (time), dpr, jump (0..1 tuck).
     */
    function figure(ctx, f) {
        var s = f.h / 100, dir = f.dir < 0 ? -1 : 1;
        var walk = f.walk != null && f.walk >= 0, sw = walk ? Math.sin(f.walk) : 0;
        var bob = walk ? -Math.abs(Math.cos(f.walk)) * 2.2 : Math.sin((f.t || 0) * 2) * 0.6;
        ctx.save();
        ctx.translate(f.x, f.y);
        if (!f.noShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath(); ell(ctx, 0, 0, 18 * s, 3.6 * s); ctx.fill();
        }
        ctx.scale(dir * s, s);
        ctx.translate(0, bob - (f.lift || 0));
        var skin = f.skin || C.skin, robe = f.robe || '#e9e1cf';
        // halo behind the head
        if (f.halo) halo(ctx, 1, -83, 15, Math.max(0.5, Math.round((f.dpr || 1) * s * 4) / 4));
        // back arm
        var shX = -2, shY = -66, L = 25;
        var a2 = f.arm2 != null ? f.arm2 : (walk ? 0.35 - sw * 0.5 : 0.18);
        ctx.lineCap = 'round';
        ctx.strokeStyle = shade(f.mantle || robe); ctx.lineWidth = 7.5;
        ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(shX + Math.sin(a2) * L, shY + Math.cos(a2) * L); ctx.stroke();
        // legs + sandals
        var t1 = f.jump ? -6 : 0;
        ctx.strokeStyle = skin; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-4, -16); ctx.lineTo(-4 + sw * 9, -3 + t1 * (sw > 0 ? 1 : 0.4));
        ctx.moveTo(4, -16); ctx.lineTo(4 - sw * 9, -3 + t1 * (sw > 0 ? 0.4 : 1));
        ctx.stroke();
        ctx.fillStyle = '#5a3517';
        ctx.beginPath();
        ell(ctx, -2 + sw * 9, -1.5 + t1 * (sw > 0 ? 1 : 0.4), 5.5, 2.2);
        ell(ctx, 6 - sw * 9, -1.5 + t1 * (sw > 0 ? 0.4 : 1), 5.5, 2.2);
        ctx.fill();
        // robe
        var flare = walk ? sw * 2.5 : 0;
        ctx.beginPath();
        ctx.moveTo(-11, -70);
        ctx.quadraticCurveTo(-15, -40, -19 - flare, -12);
        ctx.quadraticCurveTo(0, -8, 19 + flare, -12);
        ctx.quadraticCurveTo(15, -40, 12, -70);
        ctx.quadraticCurveTo(0, -76, -11, -70);
        ctx.closePath();
        if (f.stripes && f.stripes.length) {
            ctx.save(); ctx.clip();
            for (var i = 0; i < 9; i++) { ctx.fillStyle = f.stripes[i % f.stripes.length]; ctx.fillRect(-22, -76 + i * 8, 44, 8); }
            ctx.restore();
        } else { ctx.fillStyle = robe; ctx.fill(); }
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(30,15,5,0.55)'; ctx.stroke();
        ctx.strokeStyle = 'rgba(30,15,5,0.22)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-3, -60); ctx.quadraticCurveTo(-6, -36, -8, -13); ctx.moveTo(5, -58); ctx.quadraticCurveTo(7, -34, 9, -13); ctx.stroke();
        // mantle (himation) across the body
        if (f.mantle) {
            ctx.beginPath();
            ctx.moveTo(12, -70); ctx.quadraticCurveTo(4, -48, -15, -34);
            ctx.lineTo(-13, -27); ctx.quadraticCurveTo(8, -40, 15, -58); ctx.closePath();
            ctx.fillStyle = f.mantle; ctx.fill();
            ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(30,15,5,0.45)'; ctx.stroke();
        }
        // belt / clavi band
        ctx.fillStyle = f.belt || 'rgba(90,50,20,0.75)';
        ctx.fillRect(-13, -44, 26, 3.2);
        if (f.collar) {
            ctx.fillStyle = C.gold; ctx.beginPath(); ctx.ellipse(1, -69, 10, 4.5, 0, 0, Math.PI); ctx.fill();
            ctx.strokeStyle = C.goldD; ctx.lineWidth = 1; ctx.stroke();
        }
        // neck + head
        ctx.fillStyle = skin; ctx.fillRect(-2.5, -74, 6, 6);
        ctx.beginPath(); ell(ctx, 1.5, -83, 9, 10); ctx.fill();
        ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(40,20,5,0.55)'; ctx.stroke();
        // hair
        ctx.fillStyle = f.hair || '#3a2414';
        ctx.beginPath(); ctx.moveTo(-8, -82); ctx.quadraticCurveTo(-7, -95, 3, -94); ctx.quadraticCurveTo(10, -94, 10.5, -86);
        ctx.quadraticCurveTo(4, -90, -2, -88); ctx.quadraticCurveTo(-5, -84, -4, -76); ctx.quadraticCurveTo(-9, -78, -8, -82); ctx.fill();
        if (f.headband) { ctx.strokeStyle = f.headband; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-8, -87); ctx.quadraticCurveTo(2, -92, 10, -88); ctx.stroke(); }
        if (f.crown) {
            ctx.fillStyle = C.gold;
            ctx.beginPath(); ctx.moveTo(-7, -91); ctx.lineTo(-6, -99); ctx.lineTo(-2, -94); ctx.lineTo(2, -100); ctx.lineTo(5, -94); ctx.lineTo(9, -99); ctx.lineTo(9, -90); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = C.goldD; ctx.lineWidth = 1; ctx.stroke();
        }
        if (f.beard) {
            ctx.fillStyle = f.beardColor || f.hair || '#3a2414';
            ctx.beginPath(); ctx.moveTo(-3, -81); ctx.quadraticCurveTo(-4, -70 + (1 - f.beard) * 6, 4, -68 + (1 - f.beard) * 8);
            ctx.quadraticCurveTo(11, -72, 10, -80); ctx.quadraticCurveTo(5, -76, -3, -81); ctx.fill();
        }
        // icon eye (large almond) + brow + nose
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(6, -84, 2.6, 1.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b0f07'; ctx.beginPath(); circ(ctx, 6.6, -84, 1.2); ctx.fill();
        ctx.strokeStyle = '#1b0f07'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(3, -87.4); ctx.quadraticCurveTo(6, -89, 9, -87.2); ctx.moveTo(10, -84); ctx.lineTo(11, -80); ctx.lineTo(9.5, -79.5); ctx.stroke();
        // front arm + prop
        var a = f.arm != null ? f.arm : (walk ? 0.35 + sw * 0.5 : 0.25);
        var hx = shX + 4 + Math.sin(a) * L, hy = shY + Math.cos(a) * L;
        ctx.strokeStyle = f.mantle || robe; ctx.lineWidth = 7.5;
        ctx.beginPath(); ctx.moveTo(shX + 4, shY); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = 'rgba(30,15,5,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        drawProp(ctx, f.prop, hx, hy, f.t || 0, a);
        ctx.fillStyle = skin; ctx.beginPath(); circ(ctx, hx, hy, 3.6); ctx.fill();
        ctx.restore();
        f.hand = { x: f.x + dir * s * hx, y: f.y + s * (hy + bob - (f.lift || 0)) };
        return f.hand;
    }
    function shade(col) {
        if (col.charAt(0) !== '#' || col.length !== 7) return col;
        var r = parseInt(col.substr(1, 2), 16) * 0.72, g = parseInt(col.substr(3, 2), 16) * 0.72, b = parseInt(col.substr(5, 2), 16) * 0.72;
        return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
    }
    function drawProp(ctx, prop, hx, hy, t, a) {
        if (!prop) return;
        if (prop === 'staff') {
            ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(hx, hy + 30); ctx.lineTo(hx, hy - 42);
            ctx.quadraticCurveTo(hx, hy - 52, hx + 7, hy - 51); ctx.quadraticCurveTo(hx + 12, hy - 49, hx + 10, hy - 43); ctx.stroke();
        } else if (prop === 'rod') {
            ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
            var dx = Math.sin(a) * 40, dy = Math.cos(a) * 40;
            ctx.beginPath(); ctx.moveTo(hx - dx * 0.3, hy - dy * 0.3); ctx.lineTo(hx + dx, hy + dy); ctx.stroke();
        } else if (prop === 'torch') {
            ctx.strokeStyle = '#5a3517'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(hx, hy + 6); ctx.lineTo(hx, hy - 14); ctx.stroke();
            flame(ctx, hx, hy - 16, 7, t);
        } else if (prop === 'trumpet') {
            ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(hx - 2, hy); ctx.quadraticCurveTo(hx + 10, hy - 4, hx + 16, hy - 14); ctx.stroke();
            ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(hx + 15, hy - 12); ctx.lineTo(hx + 18, hy - 17); ctx.stroke();
        } else if (prop === 'jar') {
            ctx.fillStyle = '#b8683a'; ctx.beginPath(); ell(ctx, hx, hy - 4, 7, 8); ctx.fill();
            ctx.fillStyle = '#8a4a24'; ctx.fillRect(hx - 4, hy - 13, 8, 3);
        }
    }
    function flame(ctx, x, y, r, t) {
        var f1 = Math.sin(t * 17 + x) * 0.15, f2 = Math.cos(t * 13 + y) * 0.12;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, 'rgba(255,200,90,0.55)'); g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); circ(ctx, x, y, r * 3); ctx.fill();
        ctx.fillStyle = '#ff8a2a';
        ctx.beginPath(); ctx.moveTo(x - r * 0.8, y + r * 0.4);
        ctx.quadraticCurveTo(x - r * (0.9 + f1), y - r * 0.8, x + r * f2, y - r * (1.9 + f1));
        ctx.quadraticCurveTo(x + r * (0.9 - f2), y - r * 0.6, x + r * 0.8, y + r * 0.4);
        ctx.quadraticCurveTo(x, y + r * 0.9, x - r * 0.8, y + r * 0.4); ctx.fill();
        ctx.fillStyle = '#ffe28a';
        ctx.beginPath(); ctx.moveTo(x - r * 0.4, y + r * 0.3);
        ctx.quadraticCurveTo(x - r * 0.4, y - r * 0.5, x + r * f2 * 0.5, y - r * 1.1);
        ctx.quadraticCurveTo(x + r * 0.45, y - r * 0.4, x + r * 0.4, y + r * 0.3); ctx.closePath(); ctx.fill();
    }
    // Small crowd figure (used for groups of people).
    function tinyPerson(ctx, x, y, h, robe, head, phase, dir) {
        var s = h / 30, sw = phase >= 0 ? Math.sin(phase) : 0;
        ctx.fillStyle = robe;
        ctx.beginPath();
        ctx.moveTo(x - 4 * s, y - 20 * s); ctx.lineTo(x - 6.5 * s - sw * s, y - 2 * s); ctx.lineTo(x + 6.5 * s + sw * s, y - 2 * s); ctx.lineTo(x + 4 * s, y - 20 * s); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a2c14';
        ctx.fillRect(x - 3 * s + sw * 2.5 * s, y - 2.5 * s, 2.4 * s, 2.5 * s);
        ctx.fillRect(x + 0.8 * s - sw * 2.5 * s, y - 2.5 * s, 2.4 * s, 2.5 * s);
        ctx.fillStyle = C.skin; ctx.beginPath(); circ(ctx, x + (dir || 0) * 0.6 * s, y - 24 * s, 4 * s); ctx.fill();
        ctx.fillStyle = head; ctx.beginPath(); ctx.arc(x, y - 24.5 * s, 4.4 * s, Math.PI, TAU); ctx.fill();
    }
    function sheep(ctx, x, y, s, dir, t) {
        ctx.save(); ctx.translate(x, y); ctx.scale((dir || 1) * s, s);
        var bob = Math.sin(t * 3 + x) * 0.6;
        ctx.fillStyle = '#3b2c22';
        ctx.fillRect(-7, -6, 2.4, 6); ctx.fillRect(5, -6, 2.4, 6);
        ctx.fillStyle = '#f4efe4';
        ctx.beginPath(); circ(ctx, -5, -11 + bob, 6); circ(ctx, 2, -13 + bob, 7); circ(ctx, 7, -10 + bob, 5.5); circ(ctx, -1, -8 + bob, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#3b2c22'; ctx.beginPath(); ell(ctx, 12, -13 + bob, 3.8, 3); ctx.fill();
        ctx.restore();
    }

    /* ============================================================ audio kit
     * Procedural, low-volume WebAudio: soft bells (a church triangle / naqus feel),
     * plucks, drums, filtered noise (wind, water, thunder) and an ambient pad.
     */
    var MUTE_KEY = 'l1ArcadeMuted';
    function makeAudio() {
        var A = { ac: null, out: null, muted: false, noiseBuf: null, pad: null };
        try { A.muted = !!(window.localStorage && window.localStorage.getItem(MUTE_KEY) === '1'); } catch (e) { A.muted = false; }
        A.ensure = function () {
            try {
                if (!A.ac) {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    if (!AC) return;
                    A.ac = new AC();
                    A.out = A.ac.createGain();
                    A.out.gain.value = A.muted ? 0 : 0.55;
                    A.out.connect(A.ac.destination);
                }
                if (A.ac.state === 'suspended' && A.ac.resume) A.ac.resume();
            } catch (e) { A.ac = null; }
        };
        A.live = function () { return !!(A.ac && A.ac.state === 'running' && !A.muted); };
        A.setMuted = function (m) {
            A.muted = !!m;
            try { if (window.localStorage) window.localStorage.setItem(MUTE_KEY, A.muted ? '1' : '0'); } catch (e) { /* ignore */ }
            try { if (A.out) A.out.gain.setTargetAtTime(A.muted ? 0 : 0.55, A.ac.currentTime, 0.03); } catch (e) { /* ignore */ }
        };
        function now(d) { return A.ac.currentTime + (d || 0); }
        A.tone = function (f, dur, type, vol, f2, delay) {
            if (!A.live()) return;
            try {
                var t0 = now(delay), o = A.ac.createOscillator(), g = A.ac.createGain();
                o.type = type || 'sine';
                o.frequency.setValueAtTime(f, t0);
                if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.008);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                o.connect(g); g.connect(A.out);
                o.start(t0); o.stop(t0 + dur + 0.05);
            } catch (e) { /* ignore */ }
        };
        // Inharmonic partials give a small liturgical bell / triangle timbre.
        A.bell = function (f, vol, delay) {
            var p = [1, 2.76, 5.4, 8.93], d = [1.4, 0.8, 0.45, 0.25], v = [1, 0.45, 0.2, 0.08];
            for (var i = 0; i < p.length; i++) A.tone(f * p[i], d[i], 'sine', (vol || 0.08) * v[i], 0, delay);
        };
        A.noise = function (dur, vol, f1, f2, q, delay, kind) {
            if (!A.live()) return;
            try {
                if (!A.noiseBuf) {
                    var n = A.ac.sampleRate, buf = A.ac.createBuffer(1, n, n), ch = buf.getChannelData(0);
                    for (var i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
                    A.noiseBuf = buf;
                }
                var t0 = now(delay), src = A.ac.createBufferSource(), fl = A.ac.createBiquadFilter(), g = A.ac.createGain();
                src.buffer = A.noiseBuf; src.loop = true;
                fl.type = kind || 'bandpass'; fl.Q.value = q || 1;
                fl.frequency.setValueAtTime(f1, t0);
                if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + Math.min(0.05, dur * 0.3));
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                src.connect(fl); fl.connect(g); g.connect(A.out);
                src.start(t0); src.stop(t0 + dur + 0.05);
            } catch (e) { /* ignore */ }
        };
        A.padStart = function (freqs) {
            if (A.pad || !A.ac) return;
            try {
                var g = A.ac.createGain(), fl = A.ac.createBiquadFilter(), oscs = [];
                fl.type = 'lowpass'; fl.frequency.value = 700;
                g.gain.setValueAtTime(0.0001, A.ac.currentTime);
                g.gain.exponentialRampToValueAtTime(0.03, A.ac.currentTime + 2.5);
                (freqs || [146.8, 220]).forEach(function (fr, i) {
                    var o = A.ac.createOscillator();
                    o.type = i % 2 ? 'triangle' : 'sine';
                    o.frequency.value = fr; o.detune.value = (i % 2 ? 6 : -5);
                    o.connect(fl); o.start(); oscs.push(o);
                });
                fl.connect(g); g.connect(A.out);
                A.pad = { g: g, oscs: oscs };
            } catch (e) { A.pad = null; }
        };
        A.padStop = function () {
            if (!A.pad || !A.ac) return;
            var p = A.pad; A.pad = null;
            try {
                p.g.gain.setTargetAtTime(0.0001, A.ac.currentTime, 0.4);
                p.oscs.forEach(function (o) { o.stop(A.ac.currentTime + 1.6); });
            } catch (e) { /* ignore */ }
        };
        A.suspend = function () { try { if (A.ac && A.ac.suspend) A.ac.suspend(); } catch (e) { /* ignore */ } };
        A.close = function () {
            A.padStop();
            try { if (A.ac && A.ac.close) A.ac.close(); } catch (e) { /* ignore */ }
            A.ac = null;
        };
        // Named sounds shared by all games.
        A.play = function (name, x) {
            switch (name) {
                case 'good': A.bell(880 + (x || 0) * 55, 0.07); break;
                case 'combo': A.bell(988, 0.06); A.bell(1319, 0.05, 0.08); break;
                case 'tier': A.bell(784, 0.06); A.bell(988, 0.05, 0.09); A.bell(1175, 0.05, 0.18); break;
                case 'bad': A.tone(190, 0.28, 'triangle', 0.13, 95); A.noise(0.18, 0.04, 300, 120, 1, 0, 'lowpass'); break;
                case 'tick': A.tone(1250, 0.05, 'square', 0.025); break;
                case 'tap': A.tone(620, 0.07, 'triangle', 0.05, 520); break;
                case 'whoosh': A.noise(0.35, 0.06, 500, 2400, 0.8); break;
                case 'splash': A.noise(0.6, 0.09, 1600, 300, 0.7); break;
                case 'thunder': A.noise(1.3, 0.14, 180, 60, 0.6, 0, 'lowpass'); A.tone(55, 0.9, 'sine', 0.08, 38); break;
                case 'thud': A.tone(120, 0.18, 'sine', 0.16, 60); break;
                case 'jump': A.tone(420, 0.16, 'sine', 0.06, 760); break;
                case 'coin': A.bell(1568, 0.04); break;
                case 'jar': A.noise(0.22, 0.12, 2600, 900, 0.9); A.tone(160, 0.12, 'triangle', 0.12, 80); break;
                case 'horn': A.tone(233, 0.34, 'sawtooth', 0.045, 311); A.tone(466, 0.3, 'triangle', 0.03, 622); break;
                case 'fire': A.noise(0.3, 0.07, 800, 3000, 0.6); break;
                case 'drum': A.tone(95, 0.16, 'sine', 0.12, 55); break;
                case 'win':
                    [523, 659, 784, 1047].forEach(function (f, i) { A.bell(f, 0.06, i * 0.13); });
                    break;
                case 'lose': A.tone(392, 0.3, 'triangle', 0.06, 349); A.tone(330, 0.5, 'triangle', 0.06, 294, 0.28); break;
                case 'power': [659, 880, 1109, 1319].forEach(function (f, i) { A.tone(f, 0.22, 'triangle', 0.05, 0, i * 0.06); }); break;
                case 'page': A.noise(0.18, 0.05, 3000, 5000, 1.2); break;
            }
        };
        return A;
    }

    /* =================================================================== core
     * Shared shell for all six games: canvas + DPR (cap 2) + resize, rAF loop,
     * pause on hidden, pointer + keyboard input, story intro panel with an animated
     * demo gesture, 3-2-1 count, phase cards, "did you know" fact banners, api.ask
     * checkpoints (reward on correct, explain panel on wrong), lives, combo tiers,
     * particles, popups, shake, hit-stop, slow-motion, finale + outro panel, and the
     * single api.end call.
     * opt: title, icon, howto {kind, text}, lives (0 = none), askBonus, comboStep, maxMult,
     *      pad (freqs), init, layout, start, update, draw, down, move, up, key,
     *      reward (-> label), finale (dt), rawMax, destroy
     */
    function createCore(host, data, api, opt) {
        api = api || {};
        opt = opt || {};
        data = data || {};
        var intro = data.intro || {}, outro = data.outro || {};
        var k = {
            data: data, api: api, opt: opt,
            W: 0, H: 0, u: 0, dpr: 1, t: 0, rt: 0,
            score: 0, shownScore: 0, scoreBump: 0,
            lives: opt.lives === 0 ? null : (opt.lives || 3), maxLives: opt.lives === 0 ? 0 : (opt.lives || 3),
            combo: 0, bestCombo: 0, tierBump: 0,
            state: 'intro', stateT: 0, started: false, ended: false, destroyed: false,
            shakeT: 0, shakeMag: 0, flashT: 0, flashRGB: '255,70,70', freezeT: 0, slow: 1,
            pdown: false, px: -1, py: -1,
            askBonus: opt.askBonus || 15, askCount: 0, askCorrect: 0,
            reduced: prefersReduced(), phase: 0,
            info: null, timers: [], audio: makeAudio()
        };
        var canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', plain(opt.title || ''));
        canvas.setAttribute('tabindex', '0');
        canvas.style.cssText = 'display:block;width:100%;height:0px;touch-action:none;-ms-touch-action:none;' +
            'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;outline:none;';
        host.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        k.canvas = canvas; k.ctx = ctx;

        var raf = 0, last = 0, hidden = !!document.hidden, lastHud = '', ro = null, inited = false, countN = 3;
        var resumeCb = null, resumeOk = false, learnQ = null;

        /* ---- particles (pooled) and popups (pooled) */
        var PMAX = 260, parts = [], pops = [];
        for (var pi = 0; pi < PMAX; pi++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 2, c: '#fff', g: 0, kind: 0, ch: '' });
        for (var qi2 = 0; qi2 < 22; qi2++) pops.push({ on: false, x: 0, y: 0, s: '', c: '#fff', z: 18, life: 0 });
        var pIdx = 0;
        k.emit = function (x, y, n, o) {
            o = o || {};
            if (k.reduced) n = Math.ceil(n / 2);
            var cols = o.colors || [C.goldL, '#ffffff', C.gold, '#ffb347'];
            for (var i = 0; i < n; i++) {
                var p = parts[pIdx]; pIdx = (pIdx + 1) % PMAX;
                var a = o.dir != null ? o.dir + rand(-1, 1) * (o.spread || 0.6) : Math.random() * TAU;
                var v = rand(o.vmin || 60, o.vmax || 240);
                p.on = true; p.x = x + rand(-1, 1) * (o.jitter || 0); p.y = y + rand(-1, 1) * (o.jitter || 0);
                p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - (o.up || 40);
                p.max = p.life = rand(o.lmin || 0.45, o.lmax || 0.95);
                p.r = rand(o.rmin || 1.6, o.rmax || 4.2); p.c = cols[i % cols.length];
                p.g = o.grav != null ? o.grav : 360; p.kind = o.kind || 0;
                p.ch = p.kind === 2 ? glyphAt(Math.floor(Math.random() * 40)) : '';
            }
        };
        k.glyphBurst = function (x, y, n) { k.emit(x, y, n || 6, { kind: 2, colors: [C.goldL, C.gold, '#fff3cf'], grav: -40, up: 30, vmin: 20, vmax: 70, lmin: 0.9, lmax: 1.6, rmin: 11, rmax: 17 }); };
        k.pop = function (x, y, s, color, size) {
            var best = pops[0];
            for (var i = 0; i < pops.length; i++) { if (!pops[i].on) { best = pops[i]; break; } if (pops[i].life < best.life) best = pops[i]; }
            best.on = true; best.x = x; best.y = y; best.s = s; best.c = color || '#fff'; best.z = size || 20; best.life = 1;
        };
        k.fx = function (x, y, n, colors) {
            try { if (typeof api.fx === 'function' && !k.reduced) api.fx(x, y); } catch (e) { /* ignore */ }
            k.emit(x, y, n || 16, { colors: colors });
        };
        k.shake = function (mag, dur) { if (k.reduced) return; k.shakeMag = Math.max(k.shakeMag, mag); k.shakeT = Math.max(k.shakeT, dur || 0.25); };
        k.flash = function (rgb, dur) { k.flashRGB = rgb || '255,70,70'; k.flashT = (dur || 0.35) * (k.reduced ? 0.5 : 1); };
        k.freeze = function (sec) { k.freezeT = Math.max(k.freezeT, sec || 0.06); };
        k.after = function (sec, fn) { k.timers.push({ t: sec, fn: fn }); };
        k.vibrate = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
        k.sfx = function (name, x) {
            if (k.audio.ac) { k.audio.play(name, x); return; }
            if (k.audio.muted) return;
            var map = { good: 'good', coin: 'good', combo: 'combo', tier: 'combo', bad: 'bad', lose: 'bad', win: 'win', tick: 'tick' };
            try { if (map[name] && typeof api.sfx === 'function') api.sfx(map[name]); } catch (e) { /* ignore */ }
        };

        /* ---- scoring, combo tiers, lives */
        var TIER = ['', 'حلو!', 'نار! 🔥', 'بطل! ⭐', 'أسطورة! 👑'];
        k.mult = function () { return Math.min(opt.maxMult || 4, 1 + Math.floor(k.combo / (opt.comboStep || 4))); };
        k.hudText = function () {
            var s = '⭐ ' + Math.round(k.score);
            if (k.lives != null) s += '  ' + (k.lives > 0 ? new Array(k.lives + 1).join('❤️') : '💔');
            if (k.mult() > 1) s += '  🔥×' + k.mult();
            return s;
        };
        k.hud = function () {
            var s = k.hudText();
            if (s !== lastHud) {
                lastHud = s;
                try { if (typeof api.hud === 'function') api.hud(s); } catch (e) { /* ignore */ }
            }
        };
        k.addScore = function (n, x, y, label, color, size) {
            k.score = Math.max(0, k.score + n);
            k.scoreBump = 1;
            if (x != null) k.pop(x, y, (label || '') + (n >= 0 ? '+' : '') + ar(n), color || C.goldL, size);
            k.hud();
        };
        k.hit = function (base, x, y, o) {
            o = o || {};
            var before = k.mult();
            k.combo++;
            if (k.combo > k.bestCombo) k.bestCombo = k.combo;
            var m = k.mult(), gained = Math.round(base * m);
            k.score += gained; k.scoreBump = 1;
            if (x != null) k.pop(x, y, (o.text || '') + '+' + ar(gained), o.color || C.goldL, o.size);
            if (m > before) {
                k.tierBump = 1;
                k.sfx('tier');
                if (x != null) k.pop(x, y - 30, (TIER[Math.min(m, 4)] || '') + ' ×' + ar(m), '#ffb347', 20);
                k.glyphBurst(x != null ? x : k.W / 2, y != null ? y : k.H / 2, 5);
            } else if (!o.silent) k.sfx('good', o.pitch);
            k.hud();
            return gained;
        };
        k.breakCombo = function () { if (k.combo >= 4) k.pop(80, 52, 'الكومبو وقع', '#ffb0a0', 14); k.combo = 0; k.hud(); };
        k.perfectRaw = function (n, base) {
            var s = 0, c = 0;
            for (var i = 0; i < n; i++) { c++; s += base * Math.min(opt.maxMult || 4, 1 + Math.floor(c / (opt.comboStep || 4))); }
            return s;
        };
        k.loseLife = function (x, y, label) {
            if (k.lives == null) { k.breakCombo(); return 1; }
            k.lives = Math.max(0, k.lives - 1);
            k.combo = 0;
            k.flash('255,70,70', 0.4);
            k.shake(8, 0.32);
            k.freeze(0.09);
            k.sfx('bad');
            k.vibrate(70);
            if (label && x != null) k.pop(x, y, label, '#ffb0a0', 18);
            k.hud();
            return k.lives;
        };

        /* ---- phase cards and "did you know" facts */
        var phaseNames = strList(data.phases), facts = strList(data.facts), factI = 0;
        k.card = null; k.factB = null;
        k.phaseCard = function (n, name) {
            k.phase = n;
            var nm = name || phaseNames[n - 1] || '';
            k.card = { n: n, name: nm, t: 0, dur: 2.4 };
            k.sfx('page');
        };
        k.hasFacts = function () { return facts.length > 0; };
        k.fact = function (dur) {
            if (!facts.length) return false;
            k.factB = { s: facts[factI % facts.length], i: factI, t: 0, dur: dur || 6 };
            factI++;
            k.sfx('coin');
            return true;
        };

        /* ---- questions (mid-game checkpoints) */
        var srcQ = validQuestions(data.questions), qPool = [], qp = 0;
        k.qCount = srcQ.length;
        k.setAskPool = function (list) { srcQ = validQuestions(list); qPool = []; qp = 0; };
        k.nextQ = function () {
            if (!srcQ.length) return null;
            if (qp >= qPool.length) { qPool = shuffle(srcQ); qp = 0; }
            return qPool[qp++];
        };
        // Pause, ask, reward or explain, 3-2-1 resume, then cb(correct).
        k.checkpoint = function (cb) {
            var q = k.nextQ();
            if (!q || typeof api.ask !== 'function' || k.destroyed || k.state === 'finale' || k.state === 'outro') { if (cb) cb(false); return; }
            var done = false;
            setState('ask');
            k.pdown = false;
            k.askCount++;
            if (k.audio.pad) k.audio.padStop();
            var back = function (correct) {
                if (done || k.destroyed) return;
                done = true; last = 0;
                resumeCb = cb || null; resumeOk = !!correct;
                if (correct) {
                    k.askCorrect++;
                    k.addScore(k.askBonus);
                    var label = opt.reward ? opt.reward(k) : '';
                    k.pop(k.W / 2, k.H * 0.44, 'إجابة صح! +' + ar(k.askBonus), '#9dffb0', 26);
                    if (label) k.pop(k.W / 2, k.H * 0.44 + 32, label, C.goldL, 20);
                    k.emit(k.W / 2, k.H * 0.45, 30, { colors: [C.goldL, '#9dffb0', '#fff'] });
                    k.glyphBurst(k.W / 2, k.H * 0.45, 8);
                    k.sfx('power');
                    setState('resume');
                } else {
                    learnQ = q;
                    setState('learn');
                }
                schedule();
            };
            try { api.ask(q, back); } catch (e) { back(false); }
        };

        /* ---- end: finale animation, then outro panel, then api.end */
        k.finish = function (info) {
            if (k.state === 'finale' || k.state === 'outro' || k.ended || k.destroyed) return;
            k.info = info || {};
            k.info.win = !k.info.lose;
            setState('finale');
            k.pdown = false;
            k.audio.padStop();
            k.hud();
        };
        k.rawMax = function () { return Math.max(1, Math.round(opt.rawMax ? opt.rawMax(k) : Math.max(1, k.score))); };
        k.ratio = function () { return clamp(k.score / k.rawMax(), 0, 1); };
        function finalize() {
            if (k.ended || k.destroyed) return;
            k.ended = true;
            var mx = k.rawMax(), raw = clamp(Math.round(k.score), 0, mx);
            try { if (typeof api.end === 'function') api.end(raw, mx); } catch (e) { /* ignore */ }
        }

        function setState(s) { k.state = s; k.stateT = 0; }

        /* ---- sizing */
        function measure() {
            var w = host.clientWidth || Math.round(host.getBoundingClientRect().width) || window.innerWidth;
            var h = host.clientHeight;
            if (!h || h < 160) {
                var top = host.getBoundingClientRect().top;
                h = Math.max(260, Math.min(window.innerHeight - Math.max(0, top) - 8, 1100));
            }
            return { w: Math.max(240, Math.floor(w)), h: Math.max(220, Math.floor(h)) };
        }
        function resize() {
            if (k.destroyed) return;
            var prevH = canvas.style.height;
            canvas.style.height = '0px';
            var m = measure();
            canvas.style.height = m.h + 'px';
            var dpr = Math.min(2, window.devicePixelRatio || 1);
            if (m.w === k.W && m.h === k.H && dpr === k.dpr && canvas.width) { if (prevH !== canvas.style.height) draw(); return; }
            k.W = m.w; k.H = m.h; k.dpr = dpr; k.u = Math.min(m.w, m.h); k.land = m.w >= m.h;
            canvas.width = Math.round(m.w * dpr);
            canvas.height = Math.round(m.h * dpr);
            if (inited && opt.layout) opt.layout(k);
            if (inited) draw();
        }

        /* ---- loop */
        function tickTimers(dt) {
            if (!k.timers.length) return;
            var due = [], keep = [];
            for (var i = 0; i < k.timers.length; i++) {
                k.timers[i].t -= dt;
                (k.timers[i].t <= 0 ? due : keep).push(k.timers[i]);
            }
            k.timers = keep;
            for (var j = 0; j < due.length; j++) due[j].fn();
        }
        function step(rdt) {
            k.rt += rdt;
            k.stateT += rdt;
            var dt = rdt;
            if (k.freezeT > 0) { k.freezeT -= rdt; dt = 0; }
            if (k.state === 'intro') {
                if (opt.idle) opt.idle(k, rdt);
            } else if (k.state === 'count') {
                var n = 3 - Math.floor(k.stateT / 0.55);
                if (n !== countN && n >= 1) { countN = n; k.sfx('tick'); }
                if (opt.idle) opt.idle(k, rdt);
                if (k.stateT >= 2.1) {
                    setState('play');
                    k.audio.padStart(opt.pad);
                    if (!k.started) { k.started = true; if (opt.start) opt.start(k); }
                    k.hud();
                }
            } else if (k.state === 'resume') {
                if (k.stateT >= 1.2) {
                    setState('play');
                    k.audio.padStart(opt.pad);
                    if (resumeCb) { var f = resumeCb; resumeCb = null; f(resumeOk); }
                }
            } else if (k.state === 'learn') {
                if (k.stateT >= 6) setState('resume');
            } else if (k.state === 'play') {
                var gdt = dt * k.slow;
                k.t += gdt;
                tickTimers(gdt);
                if (opt.update) opt.update(k, gdt, dt);
            } else if (k.state === 'finale') {
                k.t += dt;
                tickTimers(dt);
                if (opt.finale) opt.finale(k, dt);
                if (k.stateT >= (k.info.finaleT != null ? k.info.finaleT : 1.2)) {
                    setState('outro');
                    k.sfx(k.info.win ? 'win' : 'lose');
                }
            } else if (k.state === 'outro') {
                k.t += dt;
                if (opt.finale) opt.finale(k, dt);
                if (k.stateT >= 20) finalize();
            }
            // effects run on real time so they keep moving during hit-stop
            for (var i = 0; i < PMAX; i++) {
                var p = parts[i];
                if (!p.on) continue;
                p.life -= rdt;
                if (p.life <= 0) { p.on = false; continue; }
                p.vy += p.g * rdt; p.x += p.vx * rdt; p.y += p.vy * rdt;
                p.vx *= 0.985;
            }
            for (var j = 0; j < pops.length; j++) {
                var q = pops[j];
                if (!q.on) continue;
                q.life -= rdt * 0.95; q.y -= 36 * rdt;
                if (q.life <= 0) q.on = false;
            }
            if (k.shakeT > 0) { k.shakeT -= rdt; if (k.shakeT <= 0) k.shakeMag = 0; }
            if (k.flashT > 0) k.flashT -= rdt;
            if (k.scoreBump > 0) k.scoreBump = Math.max(0, k.scoreBump - rdt * 3);
            if (k.tierBump > 0) k.tierBump = Math.max(0, k.tierBump - rdt * 2);
            k.shownScore += (k.score - k.shownScore) * Math.min(1, rdt * 10);
            if (Math.abs(k.score - k.shownScore) < 0.5) k.shownScore = k.score;
            if (k.card) { k.card.t += rdt; if (k.card.t >= k.card.dur) k.card = null; }
            if (k.factB && k.state === 'play') { k.factB.t += rdt; if (k.factB.t >= k.factB.dur) k.factB = null; }
        }
        function draw() {
            if (k.destroyed || !k.W) return;
            var W = k.W, H = k.H;
            ctx.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
            ctx.direction = 'rtl';
            ctx.globalAlpha = 1;
            ctx.save();
            if (k.shakeT > 0 && k.shakeMag > 0) {
                var m = k.shakeMag * clamp(k.shakeT / 0.3, 0.2, 1);
                ctx.translate(rand(-1, 1) * m, rand(-1, 1) * m);
            }
            if (opt.draw) opt.draw(k, ctx, W, H);
            drawParts(ctx);
            ctx.restore();
            ctx.save();
            ctx.direction = 'rtl';
            if (k.flashT > 0) {
                ctx.fillStyle = 'rgba(' + k.flashRGB + ',' + clamp(k.flashT, 0, 0.42) + ')';
                ctx.fillRect(0, 0, W, H);
            }
            if (k.state !== 'intro' && k.state !== 'outro') drawHud(ctx, W, H);
            drawMute(ctx);
            if (k.card) drawPhaseCard(ctx, W, H);
            if (k.factB && k.state !== 'outro' && k.state !== 'intro') drawFact(ctx, W, H);
            drawOverlay(ctx, W, H);
            ctx.restore();
        }
        function drawParts(ctx) {
            for (var i = 0; i < PMAX; i++) {
                var p = parts[i];
                if (!p.on) continue;
                var a = clamp(p.life / p.max * 1.6, 0, 1);
                ctx.globalAlpha = a;
                if (p.kind === 2) {
                    ctx.font = Math.round(p.r) + 'px ' + glyphFont;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = p.c; ctx.fillText(p.ch, p.x, p.y);
                } else if (p.kind === 1) {
                    ctx.strokeStyle = p.c; ctx.lineWidth = p.r * 0.6; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
                } else {
                    ctx.fillStyle = p.c;
                    ctx.beginPath(); circ(ctx, p.x, p.y, p.r * (0.5 + 0.5 * a)); ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
            for (var j = 0; j < pops.length; j++) {
                var q = pops[j];
                if (!q.on) continue;
                var sc = q.life > 0.85 ? eob((1 - q.life) / 0.15) : 1;
                ctx.globalAlpha = clamp(q.life * 1.6, 0, 1);
                ctx.save(); ctx.translate(q.x, q.y); ctx.scale(sc, sc);
                txt(ctx, q.s, 0, 0, font(q.z, 900), q.c, 'center', 4.5);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        }
        function muteRect() { return { x: 6, y: 6, w: 36, h: 36 }; }
        function drawMute(ctx) {
            var r = muteRect(), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
            ctx.fillStyle = 'rgba(20,10,4,0.5)';
            ctx.beginPath(); circ(ctx, cx, cy, 15); ctx.fill();
            ctx.strokeStyle = 'rgba(226,179,77,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = C.goldL;
            ctx.beginPath(); ctx.moveTo(cx - 7, cy - 3); ctx.lineTo(cx - 3, cy - 3); ctx.lineTo(cx + 2, cy - 7); ctx.lineTo(cx + 2, cy + 7); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx - 7, cy + 3); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = C.goldL; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
            ctx.beginPath();
            if (k.audio.muted) { ctx.moveTo(cx + 5, cy - 4); ctx.lineTo(cx + 10, cy + 4); ctx.moveTo(cx + 10, cy - 4); ctx.lineTo(cx + 5, cy + 4); }
            else { ctx.arc(cx + 3, cy, 5, -0.8, 0.8); ctx.moveTo(cx + 5.5, cy - 6.5); ctx.arc(cx + 3, cy, 9, -0.8, 0.8); }
            ctx.stroke();
        }
        function drawHud(ctx, W, H) {
            // score plate (top right)
            var sb = 1 + 0.18 * eo(k.scoreBump), sx = W - 12, sy = 24;
            ctx.save();
            ctx.translate(sx - 50, sy); ctx.scale(sb, sb);
            ctx.fillStyle = 'rgba(40,14,6,0.62)'; rr(ctx, -46, -15, 96, 30, 15); ctx.fill();
            ctx.strokeStyle = 'rgba(226,179,77,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
            drawCross(ctx, 34, 0, 8, C.gold, k.dpr);
            txt(ctx, ar(Math.round(k.shownScore)), -6, 1, font(17, 900), '#fff5d6');
            ctx.restore();
            // lives (drawn hearts)
            if (k.lives != null) {
                for (var i = 0; i < k.maxLives; i++) {
                    var hx = W - 124 - i * 22;
                    heartPath(ctx, hx, sy, 9);
                    ctx.fillStyle = i < k.lives ? '#e0443a' : 'rgba(255,255,255,0.18)'; ctx.fill();
                    ctx.strokeStyle = 'rgba(40,10,5,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
                }
            }
            // combo meter (top left, next to mute)
            var m = k.mult();
            if (k.combo > 0) {
                var cx = 66, cy = 24, step = opt.comboStep || 4, prog = m >= (opt.maxMult || 4) ? 1 : (k.combo % step) / step;
                var tb = 1 + 0.35 * eo(k.tierBump);
                ctx.save(); ctx.translate(cx, cy); ctx.scale(tb, tb);
                if (m >= 3) {
                    for (var f = 0; f < 5; f++) {
                        var fa = -Math.PI / 2 + (f - 2) * 0.45;
                        flame(ctx, Math.cos(fa) * 15, Math.sin(fa) * 15 + 2, 4 + (m - 2), k.rt + f);
                    }
                }
                ctx.fillStyle = 'rgba(40,14,6,0.7)'; ctx.beginPath(); circ(ctx, 0, 0, 15); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke();
                ctx.strokeStyle = m >= 3 ? '#ff9f43' : C.gold; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, prog)); ctx.stroke();
                txt(ctx, '×' + ar(m), 0, 1, font(13, 900), '#fff');
                ctx.restore();
                txt(ctx, ar(k.combo), cx + 26, cy, font(12, 800), 'rgba(255,240,200,0.85)', 'left', 3);
            }
        }
        function drawPhaseCard(ctx, W, H) {
            var c = k.card, a = c.t < 0.35 ? eob(c.t / 0.35) : (c.t > c.dur - 0.4 ? clamp((c.dur - c.t) / 0.4, 0, 1) : 1);
            var w = Math.min(W * 0.72, 460), h = clamp(H * 0.2, 56, 84), y = H * 0.3;
            ctx.save();
            ctx.globalAlpha = clamp(a, 0, 1);
            ctx.translate(W / 2, y); ctx.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
            ctx.fillStyle = 'rgba(70,12,12,0.92)';
            ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2 - 16, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(-w / 2 + 16, 0); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
            var fr = friezeSprite(10, k.dpr, C.gold, 'rgba(0,0,0,0)');
            ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 18, -h / 2 + 3, w - 36, 10); ctx.clip(); blitTiled(ctx, fr, 0, -h / 2 + 3, w); ctx.restore();
            drawCross(ctx, -w / 2 + 34, 4, 12, C.gold, k.dpr);
            drawCross(ctx, w / 2 - 34, 4, 12, C.gold, k.dpr);
            txt(ctx, 'المرحلة ' + ar(c.n) + ' من ٣', 0, -h * 0.1, font(clamp(h * 0.2, 12, 15), 700), '#f5d99a');
            if (c.name) txt(ctx, c.name, 0, h * 0.24, font(clamp(h * 0.3, 16, 24), 900), '#fff', 'center', 3);
            ctx.restore();
        }
        function drawFact(ctx, W, H) {
            var f = k.factB, a = f.t < 0.4 ? eo(f.t / 0.4) : (f.t > f.dur - 0.5 ? clamp((f.dur - f.t) / 0.5, 0, 1) : 1);
            var w = Math.min(W * 0.66, 520), h = clamp(H * 0.17, 50, 70);
            var y = (opt.factY != null ? opt.factY * H : 46) + (1 - a) * -30;
            var x = (W - w) / 2;
            ctx.save();
            ctx.globalAlpha = clamp(a, 0, 1) * 0.97;
            ctx.fillStyle = 'rgba(251,241,216,0.96)';
            rr(ctx, x, y, w, h, 12); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = C.red; ctx.stroke();
            rr(ctx, x + 3, y + 3, w - 6, h - 6, 10); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(154,107,28,0.6)'; ctx.stroke();
            ctx.fillStyle = C.red; rr(ctx, x + w - 64, y - 9, 58, 20, 10); ctx.fill();
            txt(ctx, 'هل تعلم؟', x + w - 35, y + 1, font(11.5, 900), '#ffe9b8');
            drawCross(ctx, x + w - 18, y + h / 2 + 4, 10, C.red, k.dpr);
            block(ctx, f.s, x + (w - 36) / 2 + 4, y + h / 2 + 3, w - 50, h - 14, clamp(h * 0.26, 12, 16), 700, C.ink, 2);
            // progress hairline
            ctx.fillStyle = 'rgba(142,31,31,0.5)';
            ctx.fillRect(x + 10, y + h - 4, (w - 20) * clamp(1 - f.t / f.dur, 0, 1), 2);
            ctx.restore();
        }
        function button(ctx, label, cx, cy, w, h, c1, c2) {
            var g = vgrad(ctx, cy - h / 2, cy + h / 2, [c1, c2]);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, cx - w / 2, cy - h / 2 + 3, w, h, h / 2); ctx.fill();
            ctx.fillStyle = g; rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
            txt(ctx, label, cx, cy + 1, font(h * 0.42, 900), '#fff', 'center', 3, 'rgba(90,20,5,0.55)');
        }
        function panelBox(W, H, wf, hf) {
            var pw = Math.min(W - 20, W * (wf || 0.86), 660), ph = Math.min(H - 14, H * (hf || 0.92), 380);
            return { x: Math.round((W - pw) / 2), y: Math.round((H - ph) / 2), w: Math.round(pw), h: Math.round(ph) };
        }
        k.panel = function (ctx, b) { blit(ctx, panelSprite(b.w, b.h, k.dpr), b.x, b.y); };
        k.button = button;
        function drawDemo(ctx, cx, cy, w, h, kind, t) {
            ctx.save();
            ctx.fillStyle = 'rgba(43,23,11,0.1)'; rr(ctx, cx - w / 2, cy - h / 2, w, h, 12); ctx.fill();
            ctx.strokeStyle = 'rgba(142,31,31,0.35)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.beginPath(); ctx.rect(cx - w / 2, cy - h / 2, w, h); ctx.clip();
            var px = cx, py = cy, press = 0, ph = t % 2;
            if (kind === 'hold') {
                press = ph < 1.4 ? 1 : 0;
                ctx.strokeStyle = C.nile; ctx.lineWidth = 4; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(cx, cy, h * 0.3, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ph / 1.4, 0, 1) * press); ctx.stroke();
            } else if (kind === 'drag') {
                var dp = clamp(ph / 1.2, 0, 1);
                px = cx + w * 0.18 + eio(dp) * w * 0.16; py = cy - h * 0.05 + eio(dp) * h * 0.2;
                press = ph < 1.2 ? 1 : 0;
                ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(cx + w * 0.18, cy - h * 0.05); ctx.lineTo(px, py); ctx.stroke();
                if (ph > 1.2) {
                    var fp = (ph - 1.2) / 0.8;
                    ctx.fillStyle = '#7d7466'; ctx.beginPath(); circ(ctx, lerp(cx + w * 0.18, cx - w * 0.38, fp), cy - h * 0.05 - Math.sin(fp * Math.PI) * h * 0.3, 4); ctx.fill();
                }
            } else if (kind === 'lanes') {
                var li = Math.floor(t * 2) % 3; px = cx + (1 - li) * w * 0.28; py = cy + h * 0.12;
                for (var i = 0; i < 3; i++) {
                    ctx.fillStyle = i === li && (t * 2 % 1) < 0.5 ? C.gold : 'rgba(142,31,31,0.35)';
                    rr(ctx, cx + (1 - i) * w * 0.28 - w * 0.12, cy + h * 0.02, w * 0.24, h * 0.22, 6); ctx.fill();
                }
                press = (t * 2 % 1) < 0.5 ? 1 : 0;
            } else if (kind === 'jump') {
                press = ph < 0.25 ? 1 : 0;
                var jy = ph < 0.9 ? Math.sin(ph / 0.9 * Math.PI) : 0;
                ctx.fillStyle = C.red; ctx.beginPath(); circ(ctx, cx + w * 0.2, cy + h * 0.2 - jy * h * 0.35, 6); ctx.fill();
                ctx.fillStyle = C.stone; ctx.fillRect(cx - w * 0.25 + ((t * 40) % (w * 0.5)), cy + h * 0.2, 8, 8);
                px = cx - w * 0.2; py = cy;
            } else {
                press = ph < 0.3 ? 1 : 0;
                px = cx + Math.sin(Math.floor(t / 2) * 2.1) * w * 0.2;
            }
            // ripple + fingertip
            if (press) {
                ctx.strokeStyle = 'rgba(142,31,31,' + (0.5 - (ph % 1) * 0.4) + ')'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(px, py, 10 + (ph % 1) * 16, 0, TAU); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); circ(ctx, px + 3, py + 4, 11 - press * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); circ(ctx, px, py, 11 - press * 2); ctx.fill();
            ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        }
        function drawOverlay(ctx, W, H) {
            var cy = H / 2, b, a;
            if (k.state === 'intro') {
                a = eo(k.stateT / 0.5);
                ctx.fillStyle = 'rgba(12,6,2,' + (0.5 * a) + ')'; ctx.fillRect(0, 0, W, H);
                b = panelBox(W, H);
                ctx.save();
                ctx.globalAlpha = a;
                ctx.translate(0, (1 - eob(k.stateT / 0.5)) * 30);
                k.panel(ctx, b);
                var ix = b.x + b.w / 2, top = b.y + b.h * 0.14, pad = Math.min(b.w, b.h) * 0.1;
                var title = plain(intro.title || opt.title || '');
                if (opt.icon) emo(ctx, opt.icon, ix + Math.min(b.w * 0.3, 190), top + 2, clamp(b.h * 0.08, 18, 28));
                txt(ctx, title, ix, top, font(clamp(b.h * 0.085, 18, 30), 900), C.red, 'center');
                var ry = top + clamp(b.h * 0.1, 22, 34);
                if (intro.ref) {
                    ctx.font = font(12.5, 800);
                    var rw = ctx.measureText(plain(intro.ref)).width + 26;
                    ctx.fillStyle = C.red; rr(ctx, ix - rw / 2, ry - 11, rw, 22, 11); ctx.fill();
                    txt(ctx, plain(intro.ref), ix, ry + 1, font(12.5, 800), '#ffe9b8');
                }
                var textTop = ry + 16, demoH = clamp(b.h * 0.24, 54, 86), btnH = clamp(b.h * 0.13, 38, 50);
                var textBot = b.y + b.h - pad * 0.7 - btnH - demoH - 14;
                if (intro.text) block(ctx, intro.text, ix, (textTop + textBot) / 2, b.w - pad * 2.4, Math.max(20, textBot - textTop), clamp(b.h * 0.052, 12, 17), 700, C.ink, 4);
                var dy = textBot + 6 + demoH / 2, dw = Math.min(150, b.w * 0.26);
                drawDemo(ctx, b.x + pad * 1.2 + dw / 2, dy, dw, demoH, (opt.howto && opt.howto.kind) || 'tap', k.rt);
                if (opt.howto && opt.howto.text) block(ctx, opt.howto.text, b.x + pad * 1.2 + dw + 10 + (b.w - pad * 2.4 - dw - 10) / 2, dy, b.w - pad * 2.4 - dw - 14, demoH, clamp(b.h * 0.047, 12, 15), 700, '#5b3212', 3, 'right');
                var pulse = 1 + Math.sin(k.rt * 4.5) * 0.04;
                ctx.save(); ctx.translate(ix, b.y + b.h - pad * 0.7 - btnH / 2); ctx.scale(pulse, pulse);
                button(ctx, 'يلا نبدأ', 0, 0, clamp(b.w * 0.34, 150, 230), btnH, '#d9453a', '#8e1f1f');
                ctx.restore();
                ctx.restore();
            } else if (k.state === 'count') {
                var n = 3 - Math.floor(k.stateT / 0.55), fr = (k.stateT % 0.55) / 0.55;
                ctx.fillStyle = 'rgba(12,6,2,' + Math.max(0, 0.35 - k.stateT * 0.15) + ')'; ctx.fillRect(0, 0, W, H);
                var label = n >= 1 ? ar(n) : 'يلا!';
                var sz = k.u * (n >= 1 ? 0.3 : 0.16) * (1.35 - 0.35 * eob(Math.min(1, fr * 1.6)));
                ctx.globalAlpha = 1 - fr * 0.3;
                if (n >= 1) drawCross(ctx, W / 2, cy, sz * 0.9, 'rgba(226,179,77,0.35)', k.dpr);
                txt(ctx, label, W / 2, cy, font(sz, 900), '#fff5d6', 'center', 7);
                ctx.globalAlpha = 1;
            } else if (k.state === 'resume') {
                ctx.fillStyle = 'rgba(12,6,2,0.3)'; ctx.fillRect(0, 0, W, H);
                txt(ctx, 'استعد…', W / 2, cy - 12, font(clamp(k.u * 0.09, 22, 36), 900), '#fff', 'center', 5);
                ctx.strokeStyle = C.goldL; ctx.lineWidth = 5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(W / 2, cy + k.u * 0.12, 15, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k.stateT / 1.2)); ctx.stroke();
            } else if (k.state === 'learn' && learnQ) {
                a = eo(k.stateT / 0.35);
                ctx.fillStyle = 'rgba(12,6,2,' + 0.45 * a + ')'; ctx.fillRect(0, 0, W, H);
                b = panelBox(W, H, 0.7, 0.66);
                ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 20);
                k.panel(ctx, b);
                var lx = b.x + b.w / 2, pd = Math.min(b.w, b.h) * 0.12;
                txt(ctx, 'ولا يهمك… خلينا نتعلمها 💡', lx, b.y + b.h * 0.2, font(clamp(b.h * 0.075, 14, 20), 900), C.red);
                block(ctx, 'الإجابة الصح: ' + plain(learnQ.options[learnQ.correct]), lx, b.y + b.h * 0.38, b.w - pd * 2, b.h * 0.16, clamp(b.h * 0.07, 13, 18), 900, '#1d5a2c', 2);
                if (learnQ.explain) block(ctx, learnQ.explain, lx, b.y + b.h * 0.62, b.w - pd * 2, b.h * 0.28, clamp(b.h * 0.06, 12, 16), 700, C.ink, 3);
                txt(ctx, k.stateT > 0.8 ? 'اضغط عشان تكمّل' : '', lx, b.y + b.h * 0.85, font(12, 700), '#7a4a1c');
                ctx.fillStyle = 'rgba(142,31,31,0.5)';
                ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.9, b.w * 0.6 * clamp(1 - k.stateT / 6, 0, 1), 3);
                ctx.restore();
            } else if (k.state === 'outro') {
                a = eo(k.stateT / 0.5);
                ctx.fillStyle = 'rgba(12,6,2,' + 0.5 * a + ')'; ctx.fillRect(0, 0, W, H);
                b = panelBox(W, H);
                ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - eob(k.stateT / 0.5)) * 30);
                k.panel(ctx, b);
                var ox = b.x + b.w / 2, op = Math.min(b.w, b.h) * 0.1, info = k.info || {};
                var otop = b.y + b.h * 0.14;
                txt(ctx, info.title || (info.win ? 'برافو عليك!' : 'ولا يهمك… جرّب تاني'), ox, otop, font(clamp(b.h * 0.08, 17, 28), 900), C.red);
                // stars (same thresholds as the engine's result screen)
                var r = k.ratio(), stars = r >= 0.95 ? 3 : r >= 0.75 ? 2 : r >= 0.5 ? 1 : 0;
                var sy = otop + clamp(b.h * 0.11, 24, 38), ss = clamp(b.h * 0.05, 11, 17);
                for (var si = 0; si < 3; si++) {
                    var sp = clamp((k.stateT - 0.4 - si * 0.25) / 0.35, 0, 1), sc = si < stars ? eob(sp) : 1;
                    var sxx = ox + (1 - si) * ss * 2.6;
                    ctx.save(); ctx.translate(sxx, sy); ctx.scale(sc, sc);
                    starPath(ctx, 0, 0, ss, 0.5);
                    ctx.fillStyle = si < stars && sp > 0 ? C.gold : 'rgba(120,80,30,0.25)'; ctx.fill();
                    ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.2; ctx.stroke();
                    ctx.restore();
                }
                txt(ctx, '⭐ ' + ar(Math.round(k.score)), ox + ss * 7.5, sy, font(clamp(b.h * 0.055, 13, 18), 900), '#5b3212');
                var btnH2 = clamp(b.h * 0.12, 36, 48), vTop = sy + ss + 10, vBot = b.y + b.h - op * 0.7 - btnH2 - 8;
                var hasLesson = !!outro.lesson, vH = (vBot - vTop) * (hasLesson ? 0.7 : 1);
                if (outro.verse) {
                    ctx.fillStyle = 'rgba(142,31,31,0.07)'; rr(ctx, b.x + op, vTop, b.w - op * 2, vH, 10); ctx.fill();
                    block(ctx, '«' + plain(outro.verse) + '»', ox, vTop + vH * 0.42, b.w - op * 2.8, vH * 0.66, clamp(b.h * 0.056, 12, 18), 800, '#3c1a08', 3);
                    if (outro.ref) txt(ctx, plain(outro.ref), ox, vTop + vH * 0.86, font(12, 800), C.red);
                }
                if (hasLesson) block(ctx, '💛 ' + plain(outro.lesson), ox, vTop + vH + (vBot - vTop - vH) / 2 + 2, b.w - op * 2.4, vBot - vTop - vH, clamp(b.h * 0.048, 11, 15), 700, '#1d5a2c', 2);
                if (k.stateT > 1) {
                    ctx.save(); ctx.translate(ox, b.y + b.h - op * 0.7 - btnH2 / 2);
                    var p2 = 1 + Math.sin(k.rt * 4) * 0.035; ctx.scale(p2, p2);
                    button(ctx, 'كمّل', 0, 0, clamp(b.w * 0.3, 140, 210), btnH2, '#d9453a', '#8e1f1f');
                    ctx.restore();
                }
                ctx.restore();
            }
        }
        function frame(now) {
            raf = 0;
            if (k.destroyed) return;
            var dt = last ? (now - last) / 1000 : 0;
            last = now;
            if (dt > 0.05) dt = 0.05;
            if (dt < 0) dt = 0;
            step(dt);
            draw();
            if (!k.ended) schedule();
        }
        function schedule() { if (!raf && !k.destroyed && !hidden && !k.ended && k.state !== 'ask') raf = requestAnimationFrame(frame); }

        /* ---- input */
        function pos(e) {
            var r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
        }
        function advance() {
            if (k.state === 'intro' && k.stateT > 0.35) { setState('count'); countN = 3; k.sfx('tick'); return true; }
            if (k.state === 'learn' && k.stateT > 0.8) { setState('resume'); return true; }
            if (k.state === 'outro' && k.stateT > 1) { finalize(); return true; }
            return false;
        }
        function onDown(e) {
            if (k.destroyed) return;
            if (e.cancelable) e.preventDefault();
            try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
            try { if (canvas.focus) canvas.focus(); } catch (x2) { /* ignore */ }
            k.audio.ensure();
            var p = pos(e);
            k.px = p.x; k.py = p.y;
            if (inRect(p, muteRect(), 4)) {
                k.audio.setMuted(!k.audio.muted);
                if (!k.audio.muted) k.sfx('tap');
                return;
            }
            if (advance()) return;
            if (k.state === 'play') { k.pdown = true; if (opt.down) opt.down(k, p); }
        }
        function onMove(e) {
            if (k.destroyed) return;
            var p = pos(e);
            k.px = p.x; k.py = p.y;
            if (k.state === 'play' && opt.move) opt.move(k, p);
        }
        function onUp(e) {
            if (k.destroyed || !k.pdown) return;
            k.pdown = false;
            var p = pos(e);
            if (k.state === 'play' && opt.up) opt.up(k, p, e.type === 'pointercancel');
        }
        function onKey(e) {
            if (k.destroyed || e.repeat) return;
            var key = e.key;
            if ((key === ' ' || key === 'Enter') && advance()) { if (e.preventDefault) e.preventDefault(); return; }
            if (key === 'm' || key === 'M') { k.audio.setMuted(!k.audio.muted); return; }
            if (k.state === 'play' && opt.key) { if (opt.key(k, key, true) && e.preventDefault) e.preventDefault(); }
        }
        function onKeyUp(e) {
            if (k.destroyed) return;
            if (k.state === 'play' && opt.key) opt.key(k, e.key, false);
        }
        function onCtx(e) { e.preventDefault(); }
        function onVis() {
            if (k.destroyed) return;
            if (document.hidden) {
                hidden = true;
                if (raf) cancelAnimationFrame(raf);
                raf = 0;
                k.pdown = false;
                k.audio.padStop();
                k.audio.suspend();
            } else {
                hidden = false;
                last = 0;
                if (k.state === 'play') setState('resume');
                schedule();
            }
        }
        function onWinResize() { resize(); }

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('contextmenu', onCtx);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKeyUp);
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('resize', onWinResize);
        window.addEventListener('orientationchange', onWinResize);
        if (typeof ResizeObserver === 'function') {
            try { ro = new ResizeObserver(function () { resize(); }); ro.observe(host); } catch (e) { ro = null; }
        }

        k.destroy = function () {
            if (k.destroyed) return;
            k.destroyed = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            k.timers = [];
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            canvas.removeEventListener('contextmenu', onCtx);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('resize', onWinResize);
            window.removeEventListener('orientationchange', onWinResize);
            if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
            try { if (opt.destroy) opt.destroy(k); } catch (e) { /* ignore */ }
            k.audio.close();
            spriteCache = {};
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        };
        k.partial = function () { return [clamp(Math.round(k.score), 0, k.rawMax()), k.rawMax()]; };
        k.api2 = function () { return { destroy: k.destroy, partial: k.partial, _core: k }; };

        resize();
        glyphs();
        if (opt.init) opt.init(k);
        inited = true;
        if (opt.layout) opt.layout(k);
        k.hud();
        draw();
        schedule();
        return k;
    }

    /* ======================================================================
     * 1. langLibrary -- the library of Alexandria (Septuagint)
     * Scrolls roll along a moving shelf; tap the illuminated gate of the right
     * language before the front scroll falls off the end.
     * Phase 1: one scroll at a time. Phase 2: two on the shelf, faster.
     * Phase 3 (twist): the rush -- many scrolls, and an hourglass power-up that
     * slows time. Data: gates, items, questions, intro, outro, facts, phases.
     * ==================================================================== */
    function langLibrary(host, data, api) {
        data = data || {};
        var gates = (data.gates && data.gates.length >= 2) ? data.gates.slice(0, 4) : ['عبري', 'آرامي', 'يوناني'];
        var pool = (data.items || []).filter(function (it) {
            return it && it.t != null && typeof it.gate === 'number' && it.gate >= 0 && it.gate < gates.length;
        });
        var PH = [{ n: 6, T: 7.2, gap: 99, max: 1 }, { n: 6, T: 5.6, gap: 2.7, max: 2 }, { n: 8, T: 4.5, gap: 1.75, max: 3 }];
        var TOTAL = PH[0].n + PH[1].n + PH[2].n;
        var queue = [];
        if (pool.length) { while (queue.length < TOTAL) queue = queue.concat(shuffle(pool)); queue = queue.slice(0, TOTAL); }
        var GC = [['#f4c65a', '#a8741f'], ['#58c9b9', '#1e6e68'], ['#b99cf0', '#5d3fa6'], ['#f08a7a', '#9c2f22']];
        var S = {
            ph: -1, spawned: 0, resolved: 0, phSpawned: 0, phResolved: 0, spawnT: 0, active: false,
            scrolls: [], gates: [], glass: null, slowT: 0, glassUsed: 0, correct: 0,
            sway: 0, layers: null, motes: []
        };

        function L(k) {
            var W = k.W, H = k.H, n = gates.length;
            var land = W >= H * 1.2;
            var shelfY = Math.round(H * (land ? 0.53 : 0.5));
            var cardH = clamp(H * 0.19, 50, 88), cardW = clamp(W * (land ? 0.3 : 0.62), 170, 330);
            var gTop = Math.round(shelfY + clamp(H * 0.07, 16, 34)), gBot = H - 6;
            var side = land ? W * 0.085 : 6, gap = clamp(W * 0.018, 6, 16);
            var gw = (W - side * 2 - gap * (n - 1)) / n;
            return { W: W, H: H, land: land, shelfY: shelfY, cardH: cardH, cardW: cardW, gTop: gTop, gBot: gBot, side: side, gap: gap, gw: gw, topZone: shelfY - cardH - 10 };
        }
        function layout(k) {
            var g = L(k), old = S.gates;
            S.g = g;
            S.gates = [];
            for (var i = 0; i < gates.length; i++) {
                // RTL: gate 0 sits at the right
                var x = g.W - g.side - (i + 1) * g.gw - i * g.gap;
                S.gates.push({ x: x, y: g.gTop, w: g.gw, h: g.gBot - g.gTop, glow: old[i] ? old[i].glow : 0, bad: old[i] ? old[i].bad : 0, press: 0, lit: old[i] ? old[i].lit : 0 });
            }
            buildLayers(k, g);
            if (!S.motes.length) {
                for (var m = 0; m < 26; m++) S.motes.push({ x: Math.random(), y: Math.random(), v: rand(0.004, 0.012), ph: rand(0, TAU), gl: m % 3 === 0 ? glyphAt(m * 7) : '' });
            }
        }
        function buildLayers(k, g) {
            var W = g.W, H = g.H, dpr = k.dpr, pad = 24, winTop = 10, winBot = g.topZone - 6;
            var wins = g.land ? [0.2, 0.5, 0.8] : [0.28, 0.72];
            var ww = clamp(W * (g.land ? 0.15 : 0.3), 60, 180);
            // far: dusk sky, Mediterranean, Pharos lighthouse (seen through the arches)
            var far = layer(W + pad * 2, H, dpr, function (x) {
                x.fillStyle = vgrad(x, 0, winBot, ['#f7c77e', '#f2a36b', '#8fb8d8']); x.fillRect(0, 0, W + pad * 2, winBot + 4);
                x.fillStyle = 'rgba(255,240,200,0.8)'; x.beginPath(); circ(x, (W + pad * 2) * 0.62, winBot * 0.5, 16); x.fill();
                var sea = winBot - Math.max(10, (winBot - winTop) * 0.3);
                x.fillStyle = vgrad(x, sea, winBot + 4, ['#2f7fb3', '#154a78']); x.fillRect(0, sea, W + pad * 2, winBot - sea + 4);
                x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1;
                for (var i = 0; i < 30; i++) { var sx = (i * 53) % (W + pad * 2), sy = sea + 3 + (i * 7) % Math.max(4, winBot - sea - 2); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 10, sy); x.stroke(); }
                // Pharos: three stacked tiers
                var px = pad + W * 0.5, pb = sea + 2, ph = Math.max(20, (sea - winTop) * 0.9);
                x.fillStyle = '#d9c7a1';
                x.fillRect(px - ph * 0.14, pb - ph * 0.5, ph * 0.28, ph * 0.5);
                x.fillRect(px - ph * 0.09, pb - ph * 0.8, ph * 0.18, ph * 0.3);
                x.fillRect(px - ph * 0.05, pb - ph * 0.98, ph * 0.1, ph * 0.18);
                x.fillStyle = 'rgba(120,90,50,0.35)'; x.fillRect(px - ph * 0.14, pb - ph * 0.5, ph * 0.07, ph * 0.5);
                S.pharos = { x: px - pad, y: pb - ph * 1.0 };
            });
            // wall with arch openings, frieze and scroll cubbies
            var wall = layer(W + pad * 2, H, dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#c9a06a', '#a47b48', '#7a5630']); x.fillRect(0, 0, W + pad * 2, H);
                var r = seeded(11);
                x.strokeStyle = 'rgba(70,45,20,0.18)'; x.lineWidth = 1;
                for (var by = 0; by < H; by += 22) {
                    x.beginPath(); x.moveTo(0, by); x.lineTo(W + pad * 2, by); x.stroke();
                    for (var bx = (by / 22) % 2 ? 0 : 30; bx < W + pad * 2; bx += 60) { x.beginPath(); x.moveTo(bx, by); x.lineTo(bx, by + 22); x.stroke(); }
                }
                x.fillStyle = 'rgba(60,35,10,0.08)';
                for (var i = 0; i < 160; i++) { x.beginPath(); circ(x, r() * (W + pad * 2), r() * H, 1 + r() * 3); x.fill(); }
                // arches
                x.save(); x.globalCompositeOperation = 'destination-out';
                wins.forEach(function (f) {
                    var cx = pad + W * f;
                    x.beginPath(); x.moveTo(cx - ww / 2, winBot); x.lineTo(cx - ww / 2, winTop + ww / 2); x.arc(cx, winTop + ww / 2, ww / 2, Math.PI, TAU); x.lineTo(cx + ww / 2, winBot); x.closePath(); x.fill();
                });
                x.restore();
                wins.forEach(function (f) {
                    var cx = pad + W * f;
                    x.beginPath(); x.moveTo(cx - ww / 2, winBot); x.lineTo(cx - ww / 2, winTop + ww / 2); x.arc(cx, winTop + ww / 2, ww / 2, Math.PI, TAU); x.lineTo(cx + ww / 2, winBot);
                    x.lineWidth = 7; x.strokeStyle = '#e7cf9f'; x.stroke(); x.lineWidth = 1.5; x.strokeStyle = '#6b4a22'; x.stroke();
                    x.fillStyle = '#6b4a22'; x.fillRect(cx - ww / 2 - 6, winBot - 2, ww + 12, 6);
                    copticCross(x, cx, winTop + 2, 9, C.gold, C.redD, 1);
                });
                // Coptic frieze
                var fy = g.topZone - 2, fh = 12;
                var fr = friezeSprite(fh, dpr, C.gold, C.redD);
                blitTiled(x, fr, 0, fy, W + pad * 2);
                // scroll cubbies behind the shelf
                var cy0 = fy + fh + 2, cy1 = g.shelfY;
                x.fillStyle = '#3d2412'; x.fillRect(0, cy0, W + pad * 2, cy1 - cy0);
                var cw = 34, chh = Math.max(14, (cy1 - cy0) / 3);
                for (var yy = cy0 + 2; yy < cy1 - 4; yy += chh) {
                    for (var xx = 2; xx < W + pad * 2; xx += cw) {
                        x.fillStyle = '#24140a'; x.fillRect(xx, yy, cw - 3, chh - 3);
                        for (var s2 = 0; s2 < 3; s2++) {
                            x.fillStyle = ['#e8d3a4', '#d9bd86', '#f1e2bd'][(xx + s2) % 3];
                            x.beginPath(); circ(x, xx + 7 + s2 * 9, yy + chh * 0.55, Math.min(4.2, chh * 0.3)); x.fill();
                            x.strokeStyle = 'rgba(90,60,20,0.6)'; x.lineWidth = 0.8; x.stroke();
                        }
                    }
                }
                // lower wall darker for the gates
                x.fillStyle = 'rgba(40,20,5,0.25)'; x.fillRect(0, g.shelfY, W + pad * 2, H - g.shelfY);
            });
            S.layers = { far: far, wall: wall, pad: pad, wins: wins, ww: ww, winTop: winTop, winBot: winBot };
        }
        function cardPos(c, g) {
            var sx = g.W + g.cardW / 2 + 6, ex = g.cardW / 2 + 4;
            return { x: lerp(sx, ex, c.p), y: g.shelfY - g.cardH / 2 - 5 };
        }
        function activeScroll() {
            var best = null;
            for (var i = 0; i < S.scrolls.length; i++) { var c = S.scrolls[i]; if (c.state === 'move' && (!best || c.p > best.p)) best = c; }
            return best;
        }
        function spawn(k) {
            var P = PH[S.ph];
            S.scrolls.push({ item: queue[S.spawned % queue.length], p: 0, T: P.T, state: 'move', t: 0, x: 0, y: 0, g: 0, ok: false, rot: 0, id: S.spawned });
            S.spawned++; S.phSpawned++;
            S.spawnT = P.gap;
            k.sfx('page');
            if (S.ph === 2 && (S.phSpawned === 3 || S.phSpawned === 6) && !S.glass) {
                S.glass = { x: rand(0.3, 0.7) * k.W, y: S.g.topZone * 0.55 + 20, t: 0, life: 6.5 };
            }
        }
        function startPhase(k, n) {
            S.ph = n; S.phSpawned = 0; S.phResolved = 0; S.active = false;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(3.2, function () { S.active = true; S.spawnT = 0; });
        }
        function flyTo(c, gi, ok, g) {
            var p = cardPos(c, g);
            c.state = 'fly'; c.t = 0; c.fx = p.x; c.fy = p.y; c.g = gi; c.ok = ok;
        }
        function tapGate(k, gi) {
            var gt = S.gates[gi];
            gt.press = 1;
            var c = activeScroll();
            if (!c) { k.sfx('tap'); return; }
            var right = c.item.gate;
            if (gi === right) {
                S.correct++;
                gt.glow = 1;
                k.hit(10, gt.x + gt.w / 2, gt.y - 10, { pitch: gi * 3 });
                flyTo(c, gi, true, S.g);
            } else {
                gt.bad = 1;
                S.gates[right].glow = 0.7;
                k.loseLife(gt.x + gt.w / 2, gt.y - 10, 'مكانها: ' + gates[right]);
                flyTo(c, right, false, S.g);
            }
        }
        function resolveOne(k) {
            S.resolved++; S.phResolved++;
            if (k.lives != null && k.lives <= 0) {
                k.finish({ lose: true, title: 'المكتبة محتاجاك تاني!', finaleT: 1 });
                return;
            }
        }
        function checkPhaseEnd(k) {
            if (S.ph < 0 || !S.active) return;
            var P = PH[S.ph];
            if (S.phSpawned >= P.n && S.phResolved >= P.n && !S.scrolls.length) {
                S.active = false;
                if (S.ph >= 2) { k.finish({ title: 'المكتبة اترتبت! برافو 📚', finaleT: 1.8 }); return; }
                var next = S.ph + 1;
                k.after(0.5, function () { k.checkpoint(function () { startPhase(k, next); }); });
            }
        }

        function drawGate(k, ctx, gt, i) {
            var col = GC[i % GC.length], sh = gt.bad > 0 ? Math.sin(k.rt * 60) * 5 * gt.bad : 0;
            var sc = 1 - 0.05 * gt.press;
            var x = gt.x + sh, y = gt.y, w = gt.w, h = gt.h, cx = x + w / 2;
            ctx.save();
            ctx.translate(cx, y + h); ctx.scale(sc, sc); ctx.translate(-cx, -(y + h));
            var ar2 = Math.min(w / 2, h * 0.45);
            // stone frame
            ctx.beginPath();
            ctx.moveTo(x, y + h); ctx.lineTo(x, y + ar2); ctx.arc(cx, y + ar2, w / 2, Math.PI, TAU); ctx.lineTo(x + w, y + h); ctx.closePath();
            ctx.fillStyle = vgrad(ctx, y, y + h, ['#efdcb3', '#cfae74', '#a57f47']); ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = '#5e3d18'; ctx.stroke();
            // inner doorway with its light
            var ix = x + w * 0.12, iw = w * 0.76, ir = iw / 2, iy = y + h * 0.1;
            ctx.beginPath();
            ctx.moveTo(ix, y + h); ctx.lineTo(ix, iy + ir); ctx.arc(ix + ir, iy + ir, ir, Math.PI, TAU); ctx.lineTo(ix + iw, y + h); ctx.closePath();
            var lit = clamp(0.25 + gt.lit * 0.1 + gt.glow * 0.6, 0, 1.2);
            var gg = ctx.createLinearGradient(0, iy, 0, y + h);
            gg.addColorStop(0, mixA(col[0], 0.35 + 0.5 * Math.min(1, lit))); gg.addColorStop(1, mixA(col[1], 0.85));
            ctx.fillStyle = '#20120a'; ctx.fill();
            ctx.fillStyle = gg; ctx.fill();
            if (gt.glow > 0) { ctx.save(); ctx.globalAlpha = gt.glow * 0.6; ctx.fillStyle = '#fff6d0'; ctx.fill(); ctx.restore(); }
            if (gt.bad > 0) { ctx.save(); ctx.globalAlpha = gt.bad * 0.5; ctx.fillStyle = '#ff3b30'; ctx.fill(); ctx.restore(); }
            // illumination dots around the arch (one per correct scroll, up to 9)
            var nd = Math.min(9, gt.lit);
            for (var d = 0; d < nd; d++) {
                var a = Math.PI + (d + 0.5) / 9 * Math.PI;
                ctx.fillStyle = d % 2 ? col[0] : C.goldL;
                ctx.beginPath(); circ(ctx, cx + Math.cos(a) * (w / 2 - 5), y + ar2 + Math.sin(a) * (w / 2 - 5), 2.6); ctx.fill();
            }
            drawCross(ctx, cx, y + 4, clamp(w * 0.07, 8, 13), C.gold, k.dpr);
            // plaque
            var ph = clamp(h * 0.3, 26, 46), py = y + h - ph - clamp(h * 0.08, 6, 14), pw = w * 0.82;
            ctx.fillStyle = 'rgba(30,14,6,0.78)'; rr(ctx, cx - pw / 2, py, pw, ph, 8); ctx.fill();
            ctx.strokeStyle = col[0]; ctx.lineWidth = 1.5; ctx.stroke();
            txt(ctx, gates[i], cx, py + ph / 2 + 1, font(clamp(ph * 0.52, 14, 24), 900), '#fff8e0', 'center', 3);
            ctx.restore();
        }
        function mixA(hex, a) {
            var h = hex.replace('#', '');
            return 'rgba(' + parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16) + ',' + clamp(a, 0, 1) + ')';
        }
        function drawScroll(k, ctx, c, x, y, g, alpha, scale, rot, active) {
            var w = g.cardW, h = g.cardH;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(scale, scale);
            if (active) {
                ctx.shadowColor = 'rgba(255,215,120,0.95)'; ctx.shadowBlur = 16;
            } else { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; }
            ctx.fillStyle = vgrad(ctx, -h / 2, h / 2, ['#fff4d6', '#f0dba8', '#e2c386']);
            rr(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            var danger = c.state === 'move' ? clamp((c.p - 0.72) / 0.28, 0, 1) : 0;
            ctx.lineWidth = danger > 0 ? 2 + danger * 2.5 : 1.3;
            ctx.strokeStyle = danger > 0 ? 'rgba(200,40,30,' + (0.5 + 0.5 * Math.sin(k.rt * 14)) + ')' : '#9a6b1c';
            ctx.stroke();
            // rods
            ctx.fillStyle = vgrad(ctx, -h / 2, h / 2, ['#b77b3c', '#7a4a1e']);
            rr(ctx, -w / 2 - 8, -h / 2 - 6, 14, h + 12, 7); ctx.fill();
            rr(ctx, w / 2 - 6, -h / 2 - 6, 14, h + 12, 7); ctx.fill();
            ctx.fillStyle = C.gold;
            ctx.beginPath(); circ(ctx, -w / 2 - 1, -h / 2 - 6, 4); circ(ctx, -w / 2 - 1, h / 2 + 6, 4); circ(ctx, w / 2 + 1, -h / 2 - 6, 4); circ(ctx, w / 2 + 1, h / 2 + 6, 4); ctx.fill();
            // ruled lines + text
            ctx.strokeStyle = 'rgba(154,107,28,0.18)'; ctx.lineWidth = 1;
            for (var ly = -h / 2 + 10; ly < h / 2 - 6; ly += 9) { ctx.beginPath(); ctx.moveTo(-w / 2 + 12, ly); ctx.lineTo(w / 2 - 12, ly); ctx.stroke(); }
            drawCross(ctx, w / 2 - 20, -h / 2 + 12, 7, C.red, k.dpr);
            block(ctx, c.item.t, -4, 2, w - 44, h - 14, clamp(h * 0.24, 13, 20), 800, '#3b2412', 2);
            ctx.restore();
        }
        function drawShelf(k, ctx, g) {
            var y = g.shelfY, W = g.W;
            ctx.fillStyle = vgrad(ctx, y - 4, y + 16, ['#9c6a35', '#6e4521', '#4a2c12']);
            ctx.fillRect(0, y - 4, W, 18);
            ctx.fillStyle = 'rgba(255,230,180,0.35)'; ctx.fillRect(0, y - 4, W, 2);
            // rollers turning with the conveyor
            var spin = k.t * 4;
            for (var x = 18; x < W; x += 46) {
                ctx.fillStyle = '#3a2210'; ctx.beginPath(); circ(ctx, x, y + 9, 5); ctx.fill();
                ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.moveTo(x + Math.cos(spin) * 4, y + 9 + Math.sin(spin) * 4); ctx.lineTo(x - Math.cos(spin) * 4, y + 9 - Math.sin(spin) * 4); ctx.stroke();
            }
            // drop-off basket at the left end
            ctx.fillStyle = 'rgba(20,10,4,0.55)';
            ctx.beginPath(); ctx.moveTo(0, y + 14); ctx.lineTo(24, y + 14); ctx.lineTo(18, y + 34); ctx.lineTo(0, y + 34); ctx.closePath(); ctx.fill();
        }
        function drawScribes(k, ctx, g) {
            if (!g.land || g.side < 40) return;
            var hgt = clamp((g.gBot - g.gTop) * 0.8, 60, 120);
            var arm = 1.25 + Math.sin(k.rt * 6) * 0.12;
            [0, 1].forEach(function (s2) {
                var x = s2 ? g.W - g.side / 2 : g.side / 2, dir = s2 ? -1 : 1;
                ctx.fillStyle = '#5e3a1a';
                ctx.fillRect(x + dir * hgt * 0.14 - 8, g.gBot - hgt * 0.5, 16, hgt * 0.5);
                ctx.fillStyle = '#e9d7ad'; ctx.save(); ctx.translate(x + dir * hgt * 0.14, g.gBot - hgt * 0.52); ctx.rotate(dir * -0.3); ctx.fillRect(-12, -3, 24, 6); ctx.restore();
                figure(ctx, { x: x - dir * 4, y: g.gBot, h: hgt, dir: dir, robe: s2 ? '#dfe7ef' : '#efe4cc', mantle: s2 ? '#3b5f86' : '#7c3a28', hair: '#d9d4cc', beard: 1, beardColor: '#eeeae2', arm: arm + (s2 ? 0.1 : 0), t: k.rt + s2, dpr: k.dpr });
            });
        }

        var k = createCore(host, data, api, {
            title: 'مكتبة اللغات', icon: '📜',
            howto: { kind: 'tap', text: 'المخطوطات ماشية على الرف… اضغط على بوابة اللغة الصح قبل ما المخطوطة توقع!' },
            comboStep: 4, maxMult: 3, pad: [130.8, 196],
            rawMax: function (k) { return k.perfectRaw(queue.length || 1, 10) + 30; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) {
                if (!queue.length) { k.finish({ title: 'مفيش مخطوطات النهارده', finaleT: 0.5 }); return; }
                startPhase(k, 0);
            },
            reward: function (k) {
                if (k.lives != null && k.lives < k.maxLives) { k.lives++; k.hud(); return '❤️ قلب زيادة'; }
                S.slowT = 5; return '⏳ الوقت هيبطّأ شوية';
            },
            update: function (k, dt, rdt) {
                var g = S.g;
                S.sway = Math.sin(k.rt * 0.35) * 8;
                if (S.slowT > 0) { S.slowT -= rdt; k.slow = 0.5; if (S.slowT <= 0) { k.slow = 1; k.pop(k.W / 2, g.topZone * 0.6, 'رجعنا للسرعة العادية', '#fff', 15); } }
                for (var gi = 0; gi < S.gates.length; gi++) {
                    var gt = S.gates[gi];
                    gt.glow = Math.max(0, gt.glow - rdt * 1.6); gt.bad = Math.max(0, gt.bad - rdt * 2.2); gt.press = Math.max(0, gt.press - rdt * 6);
                }
                if (S.active && S.ph >= 0) {
                    var P = PH[S.ph], onShelf = 0;
                    for (var i = 0; i < S.scrolls.length; i++) if (S.scrolls[i].state === 'move') onShelf++;
                    S.spawnT -= dt;
                    var canSpawn = S.phSpawned < P.n && onShelf < P.max && (P.max === 1 ? onShelf === 0 && S.scrolls.length === 0 : S.spawnT <= 0);
                    if (canSpawn) spawn(k);
                }
                for (var j = S.scrolls.length - 1; j >= 0; j--) {
                    var c = S.scrolls[j];
                    c.t += dt;
                    if (c.state === 'move') {
                        c.p += dt / c.T;
                        if (c.p >= 1) {
                            c.state = 'fall'; c.t = 0; var cp = cardPos(c, g); c.fx = cp.x; c.fy = cp.y;
                            S.gates[c.item.gate].glow = 0.8;
                            k.loseLife(60, g.shelfY - g.cardH - 10, 'وقعت! مكانها: ' + gates[c.item.gate]);
                        }
                    } else if (c.state === 'fly') {
                        var dur = c.ok ? 0.45 : 0.75;
                        if (c.t >= dur) {
                            var gt2 = S.gates[c.g];
                            if (c.ok) {
                                gt2.lit++;
                                k.emit(gt2.x + gt2.w / 2, gt2.y + gt2.h * 0.4, 18, { colors: [GC[c.g % 4][0], C.goldL, '#fff'] });
                                k.glyphBurst(gt2.x + gt2.w / 2, gt2.y + gt2.h * 0.3, 4);
                            }
                            S.scrolls.splice(j, 1);
                            resolveOne(k);
                        }
                    } else if (c.state === 'fall') {
                        if (c.t >= 0.8) { S.scrolls.splice(j, 1); resolveOne(k); }
                    }
                }
                if (S.glass) {
                    S.glass.t += rdt;
                    if (S.glass.t >= S.glass.life) S.glass = null;
                }
                checkPhaseEnd(k);
            },
            idle: function (k, dt) { S.sway = Math.sin(k.rt * 0.35) * 8; },
            finale: function (k, dt) {
                if (k.info && k.info.win && Math.random() < dt * 6) {
                    var gt = pick(S.gates);
                    k.glyphBurst(gt.x + gt.w / 2, gt.y + gt.h * 0.35, 2);
                    gt.glow = Math.max(gt.glow, 0.6);
                }
                for (var gi = 0; gi < S.gates.length; gi++) S.gates[gi].glow = Math.max(0, S.gates[gi].glow - dt);
            },
            down: function (k, p) {
                if (S.glass && Math.abs(p.x - S.glass.x) < 34 && Math.abs(p.y - S.glass.y) < 34) {
                    S.slowT = 6; S.glassUsed++;
                    k.sfx('power');
                    k.pop(S.glass.x, S.glass.y - 20, '⏳ الوقت أبطأ!', '#bfe8ff', 20);
                    k.emit(S.glass.x, S.glass.y, 20, { colors: ['#f6e2b5', '#bfe8ff', '#fff'] });
                    S.glass = null;
                    return;
                }
                for (var i = 0; i < S.gates.length; i++) {
                    if (inRect(p, S.gates[i], 4)) { tapGate(k, i); return; }
                }
            },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                var map = { '1': 0, '2': 1, '3': 2, '4': 3, ArrowRight: 0, ArrowDown: 1, ArrowUp: 1, ArrowLeft: 2 };
                if (map[key] != null && map[key] < gates.length) { tapGate(k, map[key]); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, Ly = S.layers;
                if (Ly) {
                    blit(ctx, Ly.far, -Ly.pad + S.sway * 0.9, 0);
                    // Pharos beacon
                    if (S.pharos) {
                        var bx = S.pharos.x + S.sway * 0.9, by = S.pharos.y, fl = 0.7 + 0.3 * Math.sin(k.rt * 3);
                        var gr = ctx.createRadialGradient(bx, by, 0, bx, by, 18);
                        gr.addColorStop(0, 'rgba(255,230,150,' + fl + ')'); gr.addColorStop(1, 'rgba(255,200,100,0)');
                        ctx.fillStyle = gr; ctx.beginPath(); circ(ctx, bx, by, 18); ctx.fill();
                    }
                    blit(ctx, Ly.wall, -Ly.pad + S.sway * 0.3, 0);
                }
                // hanging lamps
                var lampXs = g.land ? [0.35, 0.65] : [0.5];
                for (var li = 0; li < lampXs.length; li++) {
                    var lx = W * lampXs[li] + S.sway * 0.3, ly = Math.min(g.topZone * 0.55, 60) + Math.sin(k.rt * 1.3 + li) * 2;
                    ctx.strokeStyle = 'rgba(60,35,10,0.8)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 6); ctx.stroke();
                    ctx.fillStyle = C.goldD; ctx.beginPath(); ctx.ellipse(lx, ly, 10, 4.5, 0, 0, Math.PI); ctx.fill();
                    flame(ctx, lx + 7, ly - 2, 3.4, k.rt + li * 3);
                }
                // dust motes and floating letters
                for (var m = 0; m < S.motes.length; m++) {
                    var mo = S.motes[m];
                    var mx = ((mo.x + Math.sin(k.rt * 0.3 + mo.ph) * 0.02) % 1) * W, my = ((mo.y - k.rt * mo.v) % 1 + 1) % 1 * g.shelfY;
                    if (mo.gl) {
                        ctx.globalAlpha = 0.22; ctx.font = '13px ' + glyphFont; ctx.fillStyle = C.goldL; ctx.textAlign = 'center'; ctx.fillText(mo.gl, mx, my);
                    } else {
                        ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff3cf'; ctx.beginPath(); circ(ctx, mx, my, 1.2); ctx.fill();
                    }
                }
                ctx.globalAlpha = 1;
                drawShelf(k, ctx, g);
                drawScribes(k, ctx, g);
                for (var gi = 0; gi < S.gates.length; gi++) drawGate(k, ctx, S.gates[gi], gi);
                // scrolls
                var act = activeScroll();
                for (var i = 0; i < S.scrolls.length; i++) {
                    var c = S.scrolls[i];
                    if (c.state === 'move') {
                        var p = cardPos(c, g), wob = Math.sin(c.p * 30) * 1.5;
                        drawScroll(k, ctx, c, p.x, p.y + wob, g, 1, 1, 0, c === act);
                        if (c === act) {
                            var ay = p.y - g.cardH / 2 - 14 + Math.sin(k.rt * 8) * 3;
                            ctx.fillStyle = C.goldL;
                            ctx.beginPath(); ctx.moveTo(p.x - 8, ay - 6); ctx.lineTo(p.x + 8, ay - 6); ctx.lineTo(p.x, ay + 4); ctx.closePath(); ctx.fill();
                        }
                    } else if (c.state === 'fly') {
                        var gt = S.gates[c.g], dur = c.ok ? 0.45 : 0.75, f = eio(c.t / dur);
                        var tx = gt.x + gt.w / 2, ty = gt.y + gt.h * 0.42;
                        var fx = lerp(c.fx, tx, f), fy = lerp(c.fy, ty, f) - Math.sin(f * Math.PI) * 40;
                        drawScroll(k, ctx, c, fx, fy, g, 1 - f * 0.6, 1 - f * 0.65, f * (c.ok ? 1.2 : -0.6), false);
                    } else if (c.state === 'fall') {
                        var ft = clamp(c.t / 0.8, 0, 1);
                        drawScroll(k, ctx, c, c.fx - ft * 20, c.fy + ft * ft * 160, g, 1 - ft, 1, -ft * 1.4, false);
                    }
                }
                // hourglass power-up
                if (S.glass) {
                    var hg = S.glass, pulse = 1 + Math.sin(k.rt * 6) * 0.08, fade = clamp((hg.life - hg.t) / 0.8, 0, 1);
                    ctx.save(); ctx.globalAlpha = fade; ctx.translate(hg.x, hg.y + Math.sin(k.rt * 2) * 4); ctx.scale(pulse, pulse);
                    var gr2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
                    gr2.addColorStop(0, 'rgba(190,232,255,0.7)'); gr2.addColorStop(1, 'rgba(190,232,255,0)');
                    ctx.fillStyle = gr2; ctx.beginPath(); circ(ctx, 0, 0, 34); ctx.fill();
                    ctx.fillStyle = C.goldD; ctx.fillRect(-12, -18, 24, 4); ctx.fillRect(-12, 14, 24, 4);
                    ctx.fillStyle = 'rgba(230,245,255,0.85)';
                    ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(9, -14); ctx.lineTo(1.5, 0); ctx.lineTo(9, 14); ctx.lineTo(-9, 14); ctx.lineTo(-1.5, 0); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = C.sand; ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(6, 13); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
                    ctx.restore();
                }
                if (S.slowT > 0) {
                    ctx.fillStyle = 'rgba(120,190,255,' + (0.1 + 0.04 * Math.sin(k.rt * 5)) + ')'; ctx.fillRect(0, 0, W, H);
                }
            }
        });
        S.g = S.g || L(k);
        return k.api2();
    }

    /* ======================================================================
     * 2. ark -- Noah's ark
     * Phase 1: animals arrive two by two from both sides; tap one, then its twin
     *          from the other side, and they climb the ramp together.
     * Phase 2: the storm -- faster arrivals, rolling rocks (do not tap) and
     *          lightning that freezes the animals. Ends with the door closing.
     * Phase 3 (twist): the flood -- the ark floats; drag to steer away from
     *          lightning. Finale: dove with an olive leaf and the rainbow.
     * Data: animals, hazards, questions, intro, outro, facts, phases.
     * ==================================================================== */
    function emojiSprite(e, size, dpr) {
        size = Math.round(size);
        return cached('e' + e + size, size * 1.5, size * 1.5, dpr, function (x, w, h) {
            x.shadowColor = 'rgba(255,248,225,0.95)'; x.shadowBlur = Math.max(2, size * 0.14);
            emo(x, e, w / 2, h / 2 + size * 0.05, size);
            x.shadowBlur = 0;
            emo(x, e, w / 2, h / 2 + size * 0.05, size);
        });
    }
    function ark(host, data, api) {
        data = data || {};
        var kinds = strList(data.animals);
        if (kinds.length < 2) kinds = ['🦁', '🐘', '🦒', '🐑', '🐄', '🐪', '🐎', '🦓'];
        var hz = strList(data.hazards);
        var rockE = hz[0] || '🪨', boltE = hz[1] || '⚡';
        var PH = [{ pairs: Math.min(5, kinds.length), gap: 3.4, walk: 5.6 }, { pairs: Math.min(7, kinds.length), gap: 2.5, walk: 4.3 }];
        var PAIRS = PH[0].pairs + PH[1].pairs;
        var STRIKES = 14;
        var S = {
            ph: -1, animals: [], pairs: [], sel: null, spawnList: [], clock: 0, done: 0, need: 0,
            rocks: [], bolts: [], boltT: 0, rain: [], storm: 0, water: 0, waterTarget: 0,
            door: 0, doorTarget: 0, float: 0, arkX: 0, arkTX: 0, strikes: [], strikeI: 0, dodged: 0,
            phase3T: 0, dove: null, rainbow: 0, calm: 0, wind: 0, cloudOff: 0, cloudOff2: 0, paired: 0
        };
        for (var ri = 0; ri < 150; ri++) S.rain.push({ x: Math.random(), y: Math.random(), v: rand(0.8, 1.3), l: rand(8, 16) });

        function G(k) {
            var W = k.W, H = k.H, land = W >= H * 1.2;
            var groundY = Math.round(H * (land ? 0.74 : 0.7)), pathY = Math.round(Math.min(H - 20, groundY + H * 0.12));
            var aw = clamp(W * (land ? 0.34 : 0.62), 200, 400), ah = aw * 0.46;
            var asz = clamp(H * 0.12, 30, 50);
            return { W: W, H: H, land: land, groundY: groundY, pathY: pathY, aw: aw, ah: ah, asz: asz, cx: W / 2 };
        }
        function layout(k) {
            var g = G(k), dpr = k.dpr, W = g.W, H = g.H;
            S.g = g;
            if (S.waterY == null) S.waterY = H + 10;
            if (!S.arkX) { S.arkX = g.cx; S.arkTX = g.cx; }
            S.skyCalm = layer(W, H, dpr, function (x) { x.fillStyle = vgrad(x, 0, H, ['#8cc8ef', '#cfe9f7', '#f3e6c6']); x.fillRect(0, 0, W, H); });
            S.skyStorm = layer(W, H, dpr, function (x) { x.fillStyle = vgrad(x, 0, H, ['#1d2433', '#3c4658', '#5f6a78']); x.fillRect(0, 0, W, H); });
            var cloud = function (seed, col, hh) {
                return layer(W, hh, dpr, function (x) {
                    var r = seeded(seed);
                    x.fillStyle = col;
                    for (var i = 0; i < 26; i++) {
                        var cx = r() * W, cy = hh * (0.3 + r() * 0.4), cr = hh * (0.25 + r() * 0.35);
                        for (var j = -1; j <= 1; j++) { x.beginPath(); circ(x, cx + j * W, cy, cr); x.fill(); }
                    }
                    x.fillRect(0, 0, W, hh * 0.3);
                });
            };
            S.cloudA = cloud(5, 'rgba(70,78,92,0.9)', Math.round(H * 0.34));
            S.cloudB = cloud(9, 'rgba(110,118,132,0.75)', Math.round(H * 0.26));
            S.hillsFar = layer(W, H, dpr, function (x) {
                ridge(x, W, g.groundY - H * 0.1, H * 0.16, 21, 3, H); x.fillStyle = '#8fa6b8'; x.fill();
            });
            S.hillsNear = layer(W, H, dpr, function (x) {
                ridge(x, W, g.groundY - H * 0.02, H * 0.08, 33, 3, H); x.fillStyle = '#7f9a4a'; x.fill();
                x.fillStyle = vgrad(x, g.groundY, H, ['#c9b27a', '#a88d57']); x.fillRect(0, g.groundY, W, H - g.groundY);
                x.fillStyle = 'rgba(90,70,40,0.25)'; x.fillRect(0, g.pathY + g.asz * 0.35, W, 3);
                var r = seeded(4);
                for (var i = 0; i < 40; i++) { x.fillStyle = 'rgba(80,110,40,0.5)'; x.fillRect(r() * W, g.groundY + r() * 8, 2, 5); }
            });
            S.arkSprite = layer(g.aw, g.ah, dpr, function (x, w, h) { drawArkArt(x, w, h); });
        }
        function drawArkArt(x, w, h) {
            // roof
            x.fillStyle = vgrad(x, 0, h * 0.24, ['#7a4a22', '#5a3517']);
            x.beginPath(); x.moveTo(w * 0.13, h * 0.24); x.lineTo(w * 0.3, h * 0.02); x.lineTo(w * 0.7, h * 0.02); x.lineTo(w * 0.87, h * 0.24); x.closePath(); x.fill();
            x.strokeStyle = 'rgba(30,15,5,0.6)'; x.lineWidth = 1.2; x.stroke();
            // cabin
            x.fillStyle = vgrad(x, h * 0.22, h * 0.58, ['#b07a43', '#8a5a2b']);
            x.fillRect(w * 0.17, h * 0.22, w * 0.66, h * 0.36);
            x.strokeStyle = 'rgba(40,20,5,0.35)'; x.lineWidth = 1;
            for (var yy = h * 0.28; yy < h * 0.58; yy += h * 0.07) { x.beginPath(); x.moveTo(w * 0.17, yy); x.lineTo(w * 0.83, yy); x.stroke(); }
            // row of windows under the roof
            x.fillStyle = '#2a170a';
            for (var i = 0; i < 7; i++) { var wx = w * 0.22 + i * w * 0.085; if (Math.abs(wx + w * 0.02 - w * 0.5) < w * 0.07) continue; x.fillRect(wx, h * 0.27, w * 0.04, h * 0.06); }
            // hull
            x.beginPath();
            x.moveTo(0, h * 0.52); x.lineTo(w, h * 0.52);
            x.quadraticCurveTo(w * 0.97, h, w * 0.84, h); x.lineTo(w * 0.16, h); x.quadraticCurveTo(w * 0.03, h, 0, h * 0.52); x.closePath();
            x.fillStyle = vgrad(x, h * 0.52, h, ['#9a6634', '#6e4522', '#3a220f']); x.fill();
            x.strokeStyle = 'rgba(30,15,5,0.7)'; x.lineWidth = 1.5; x.stroke();
            x.save(); x.clip();
            x.strokeStyle = 'rgba(30,15,5,0.35)'; x.lineWidth = 1;
            for (var py = h * 0.6; py < h; py += h * 0.08) { x.beginPath(); x.moveTo(0, py); x.lineTo(w, py); x.stroke(); }
            x.fillStyle = 'rgba(20,10,5,0.55)'; x.fillRect(0, h * 0.86, w, h * 0.14);   // pitch line
            x.restore();
            x.fillStyle = '#c28a4d'; x.fillRect(0, h * 0.5, w, h * 0.04);
            copticCross(x, w * 0.5, h * 0.12, Math.max(6, h * 0.07), C.goldL, '#4a2a10', 1);
        }
        function doorRect(g, ax, ay, sc) {
            return { x: ax - g.aw * 0.06 * sc, y: ay + g.ah * 0.3 * sc, w: g.aw * 0.12 * sc, h: g.ah * 0.25 * sc };
        }
        function arkPos(k) {
            var g = S.g, sc = 1 - 0.38 * S.float, ay;
            if (S.float > 0) ay = lerp(g.groundY - g.ah + 6, S.waterY - g.ah * sc * 0.72, S.float) + Math.sin(k.t * 1.6) * 4 * S.float;
            else ay = g.groundY - g.ah + 6;
            return { x: S.arkX, y: ay, sc: sc, rot: S.float * Math.sin(k.t * 1.2) * 0.04 };
        }

        /* ---- phase 1 & 2: pairs */
        function planPhase(n) {
            var P = PH[n], ks = shuffle(kinds), list = [];
            S.pairs = []; S.clock = 0; S.done = 0; S.need = P.pairs;
            for (var i = 0; i < P.pairs; i++) {
                var kind = ks[i % ks.length], t0 = 0.6 + i * P.gap, pr = { kind: kind, state: 0, a: null, b: null };
                S.pairs.push(pr);
                list.push({ t: t0 + rand(0, P.gap * 0.9), side: -1, pair: pr });
                list.push({ t: t0 + rand(0, P.gap * 0.9), side: 1, pair: pr });
            }
            list.sort(function (a, b) { return a.t - b.t; });
            S.spawnList = list;
            if (n === 1) { S.rocksAt = [3, 7, 11, 15]; S.boltT = 4; } else { S.rocksAt = []; S.boltT = 999; }
        }
        function spawnAnimal(k, sp) {
            var g = S.g, P = PH[S.ph];
            var an = { pair: sp.pair, e: sp.pair.kind, side: sp.side, x: sp.side < 0 ? -g.asz : g.W + g.asz, y: g.pathY,
                state: 'walk', t: 0, ph: rand(0, TAU), speed: (g.W / 2 - g.asz * 1.2) / P.walk, wait: 0, freeze: 0, sel: 0, shake: 0, climb: 0 };
            if (sp.side < 0) sp.pair.a = an; else sp.pair.b = an;
            S.animals.push(an);
        }
        function stopX(an) { var g = S.g; return g.cx + an.side * (g.aw * 0.18 + g.asz * 0.4); }
        function animalAt(p) {
            var g = S.g, best = null, bd = 1e9;
            for (var i = 0; i < S.animals.length; i++) {
                var an = S.animals[i];
                if (an.state !== 'walk' && an.state !== 'wait') continue;
                var dx = p.x - an.x, dy = p.y - (an.y - g.asz * 0.35), d = dx * dx + dy * dy;
                if (d < bd && Math.abs(dx) < g.asz * 0.85 && Math.abs(dy) < g.asz * 0.95) { bd = d; best = an; }
            }
            return best;
        }
        function tapAnimal(k, an) {
            var g = S.g;
            if (S.sel === an) { an.sel = 0; S.sel = null; k.sfx('tap'); return; }
            if (!S.sel) { S.sel = an; an.sel = 1; an.hop = 1; k.sfx('tap'); return; }
            var a = S.sel;
            if (a.e === an.e && a.side !== an.side) {
                a.state = an.state = 'pair'; a.t = an.t = 0; a.sel = an.sel = 0;
                a.pair.state = 1; S.sel = null; S.paired++;
                k.hit(10, g.cx, g.pathY - g.asz * 1.5, { text: '💞 ' });
                k.emit(g.cx, g.pathY - g.asz, 14, { colors: ['#ff8fb1', '#ffd1dc', C.goldL] });
                S.done++;
            } else {
                a.sel = 0; a.shake = an.shake = 1; S.sel = null;
                k.breakCombo(); k.sfx('bad');
                k.pop(an.x, an.y - g.asz * 1.3, 'مش نفس النوع!', '#ffd0c0', 16);
            }
        }
        function missPair(k, pr) {
            if (pr.state !== 0) return;
            pr.state = -1; S.done++;
            [pr.a, pr.b].forEach(function (an) { if (an && (an.state === 'walk' || an.state === 'wait')) { an.state = 'leave'; an.sel = 0; if (S.sel === an) S.sel = null; } });
            k.loseLife(S.g.cx, S.g.pathY - S.g.asz * 1.6, 'الزوج ده ضاع… 😢');
        }
        function strikeLightning(k, x, big) {
            var g = S.g, pts = [], y = 0, xx = x, bottom = S.float > 0 ? S.waterY : g.pathY;
            while (y < bottom) { pts.push(xx, y); y += rand(14, 30); xx += rand(-14, 14); }
            pts.push(x, bottom);
            S.bolts.push({ pts: pts, t: 0, x: x });
            k.flash('235,240,255', 0.3); k.shake(big ? 8 : 5, 0.3); k.sfx('thunder');
            k.emit(x, bottom, 14, { colors: ['#fffbd0', '#bfe3ff', '#fff'], grav: 200 });
        }

        /* ---- phase 3: flood */
        function planStrikes() {
            S.strikes = []; var t = 2.2;
            for (var i = 0; i < STRIKES; i++) {
                var dbl = i >= 6 && i % 3 === 0;
                S.strikes.push({ t: t, dbl: dbl, warn: 1.05 - Math.min(0.35, i * 0.03), x: 0, x2: 0, state: 0 });
                t += Math.max(1.05, 1.9 - i * 0.07);
            }
            S.phase3End = t + 1.2;
        }

        function startPhase(k, n) {
            S.ph = n;
            k.phaseCard(n + 1);
            k.after(1.1, function () { k.fact(5.5); });
            if (n < 2) {
                planPhase(n);
                S.doorTarget = 1;
            } else {
                planStrikes(); S.phase3T = 0; S.waterTarget = 1;
            }
        }
        function endPairsPhase(k) {
            var n = S.ph;
            S.ph = n + 0.5;
            if (n === 1) {
                S.doorTarget = 0;
                k.after(1.4, function () { k.fact(5); });
                k.after(2.6, function () { k.checkpoint(function () { startPhase(k, 2); }); });
            } else {
                k.after(0.8, function () { k.checkpoint(function () { startPhase(k, 1); }); });
            }
        }
        function drawAnimal(k, ctx, an, g) {
            var spr = emojiSprite(an.e, g.asz, k.dpr), sw = spr._w, sh = spr._h;
            var bob = 0, tilt = 0, sc = 1, x = an.x, y = an.y;
            if (an.state === 'walk' || an.state === 'leave' || an.state === 'pair') { bob = -Math.abs(Math.sin(an.ph)) * g.asz * 0.12; tilt = Math.sin(an.ph) * 0.07; }
            if (an.state === 'wait') { tilt = Math.sin(k.rt * 5) * 0.12; }
            if (an.freeze > 0) { x += Math.sin(k.rt * 50) * 1.5; }
            if (an.hop > 0) bob -= Math.sin(an.hop * Math.PI) * g.asz * 0.35;
            if (an.shake > 0) x += Math.sin(k.rt * 60) * 4 * an.shake;
            if (an.state === 'climb') { sc = 1 - 0.35 * an.climb; }
            // shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ell(ctx, x, y + 2, g.asz * 0.38 * sc, g.asz * 0.08 * sc); ctx.fill();
            if (an.sel) {
                ctx.strokeStyle = 'rgba(255,215,90,' + (0.7 + 0.3 * Math.sin(k.rt * 8)) + ')'; ctx.lineWidth = 3;
                ctx.beginPath(); ell(ctx, x, y + 2, g.asz * 0.55, g.asz * 0.16); ctx.stroke();
                halo(ctx, x, y - g.asz * 1.1 + bob, g.asz * 0.2, k.dpr);
            }
            ctx.save();
            ctx.translate(x, y + bob); ctx.rotate(tilt);
            var face = an.state === 'leave' ? -an.side : an.side;   // emoji face left by default
            ctx.scale(face < 0 ? sc : -sc, sc);
            ctx.drawImage(spr, -sw / 2, -sh * 0.86, sw, sh);
            ctx.restore();
        }

        var k = createCore(host, data, api, {
            title: 'فُلك نوح', icon: '🕊️',
            howto: { kind: 'tap', text: 'الحيوانات جاية اتنين اتنين من الناحيتين: اضغط على حيوان وبعدين على توأمه اللي جاي من الناحية التانية.' },
            comboStep: 4, maxMult: 3, pad: [110, 164.8],
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); if (S.ph < 2) { S.arkX = S.g.cx; S.arkTX = S.g.cx; } },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) {
                if (k.lives != null && k.lives < k.maxLives) { k.lives++; k.hud(); return '❤️ قلب زيادة'; }
                k.addScore(10); return '🌟 +١٠ هدية';
            },
            rawMax: function (k) { return k.perfectRaw(PAIRS, 10) + STRIKES * 4 * 2 + 30; },
            update: function (k, dt, rdt) {
                var g = S.g;
                S.clock += dt;
                S.wind += dt;
                var stormT = S.ph >= 2 ? 1 : (S.ph >= 1 ? 0.8 : (S.ph >= 0.5 ? 0.45 : 0.25));
                S.storm += (stormT - S.storm) * Math.min(1, dt * 0.6);
                S.cloudOff += dt * (12 + S.storm * 30); S.cloudOff2 += dt * (6 + S.storm * 16);
                S.door += (S.doorTarget - S.door) * Math.min(1, dt * 3);
                S.water += (S.waterTarget - S.water) * Math.min(1, dt * 0.55);
                S.waterY = lerp(g.H + 10, g.H * 0.42, eio(S.water));
                S.float = clamp((S.water - 0.55) / 0.35, 0, 1);
                // spawns
                while (S.spawnList.length && S.spawnList[0].t <= S.clock && S.ph >= 0 && S.ph < 2 && S.ph === Math.floor(S.ph)) spawnAnimal(k, S.spawnList.shift());
                // rocks
                if (S.ph === 1 && S.rocksAt.length && S.clock >= S.rocksAt[0]) {
                    S.rocksAt.shift();
                    var side = Math.random() < 0.5 ? -1 : 1;
                    S.rocks.push({ x: side < 0 ? -30 : g.W + 30, side: side, rot: 0, v: g.W / 4.2 });
                }
                for (var r = S.rocks.length - 1; r >= 0; r--) {
                    var ro = S.rocks[r];
                    ro.x += -ro.side * ro.v * dt; ro.rot += -ro.side * dt * 6;
                    if (ro.x < -60 || ro.x > g.W + 60) S.rocks.splice(r, 1);
                }
                // lightning in the storm phase
                if (S.ph === 1) {
                    S.boltT -= dt;
                    if (S.boltT <= 0) {
                        S.boltT = rand(3.5, 5.5);
                        var bx = rand(0.1, 0.9) * g.W;
                        if (Math.abs(bx - g.cx) < g.aw * 0.35) bx = g.cx + (bx < g.cx ? -1 : 1) * g.aw * 0.4;
                        S.warn = { x: bx, t: 0, dur: 1 };
                    }
                    if (S.warn) {
                        S.warn.t += dt;
                        if (S.warn.t >= S.warn.dur) {
                            strikeLightning(k, S.warn.x, false);
                            for (var ai = 0; ai < S.animals.length; ai++) if (Math.abs(S.animals[ai].x - S.warn.x) < g.W * 0.12 && S.animals[ai].state === 'walk') S.animals[ai].freeze = 1.3;
                            S.warn = null;
                        }
                    }
                }
                // animals
                for (var i = S.animals.length - 1; i >= 0; i--) {
                    var an = S.animals[i];
                    an.t += dt;
                    if (an.hop > 0) an.hop = Math.max(0, an.hop - dt * 3);
                    if (an.shake > 0) an.shake = Math.max(0, an.shake - dt * 3);
                    if (an.freeze > 0) { an.freeze -= dt; continue; }
                    if (an.state === 'walk') {
                        an.ph += dt * 9;
                        var sx = stopX(an);
                        an.x += an.side < 0 ? an.speed * dt : -an.speed * dt;
                        if ((an.side < 0 && an.x >= sx) || (an.side > 0 && an.x <= sx)) { an.x = sx; an.state = 'wait'; an.wait = 0; }
                    } else if (an.state === 'wait') {
                        an.wait += dt;
                        if (an.wait > 2.6) missPair(k, an.pair);
                    } else if (an.state === 'leave') {
                        an.ph += dt * 11;
                        an.x += an.side < 0 ? -an.speed * 1.6 * dt : an.speed * 1.6 * dt;
                        if (an.x < -g.asz * 2 || an.x > g.W + g.asz * 2) S.animals.splice(i, 1);
                    } else if (an.state === 'pair') {
                        an.ph += dt * 12;
                        var tx = g.cx + an.side * g.asz * 0.32;
                        an.x += (tx - an.x) * Math.min(1, dt * 5);
                        if (Math.abs(tx - an.x) < 3) { an.state = 'climb'; an.climb = 0; an.x0 = an.x; }
                    } else if (an.state === 'climb') {
                        an.ph += dt * 12;
                        an.climb = Math.min(1, an.climb + dt * 1.5);
                        var ap = arkPos(k), dr = doorRect(g, ap.x, ap.y, ap.sc);
                        an.y = lerp(g.pathY, dr.y + dr.h, eio(an.climb));
                        an.x = lerp(an.x0, g.cx + an.side * g.asz * 0.15, an.climb);
                        if (an.climb >= 1) { k.emit(an.x, an.y - g.asz * 0.4, 6, { colors: ['#ff8fb1', C.goldL] }); S.animals.splice(i, 1); }
                    }
                }
                // pair missed if an animal is gone before pairing (e.g. frozen too long)
                if ((S.ph === 0 || S.ph === 1) && S.done >= S.need && !S.animals.length && !S.spawnList.length) endPairsPhase(k);
                if (k.lives != null && k.lives <= 0) { k.finish({ lose: true, title: 'الطوفان كان صعب… جرّب تاني', finaleT: 1.2 }); return; }
                // phase 3
                if (S.ph === 2) {
                    S.phase3T += dt;
                    S.arkX += (S.arkTX - S.arkX) * Math.min(1, dt * 6);
                    for (var si = 0; si < S.strikes.length; si++) {
                        var st = S.strikes[si];
                        if (st.state === 0 && S.phase3T >= st.t - st.warn) {
                            st.state = 1;
                            st.x = clamp(S.arkX + rand(-0.12, 0.12) * g.W, g.W * 0.12, g.W * 0.88);
                            if (st.dbl) st.x2 = clamp(st.x + (st.x > g.cx ? -1 : 1) * g.W * rand(0.28, 0.38), g.W * 0.1, g.W * 0.9);
                        } else if (st.state === 1 && S.phase3T >= st.t) {
                            st.state = 2;
                            var ap2 = arkPos(k), half = g.aw * ap2.sc * 0.42;
                            var hitA = Math.abs(ap2.x - st.x) < half || (st.dbl && Math.abs(ap2.x - st.x2) < half);
                            strikeLightning(k, st.x, true);
                            if (st.dbl) strikeLightning(k, st.x2, true);
                            if (hitA) k.loseLife(ap2.x, ap2.y - 10, 'حاسب! ⚡');
                            else { S.dodged++; k.hit(4, ap2.x, ap2.y - 14, { text: '🛶 ' }); }
                        }
                    }
                    if (S.phase3T >= S.phase3End && k.lives > 0) {
                        S.ph = 3; S.waterTarget = 0.55;
                        k.finish({ title: 'نوح وعيلته نجوا! 🌈', finaleT: 6.2 });
                    }
                }
                for (var b = S.bolts.length - 1; b >= 0; b--) { S.bolts[b].t += rdt; if (S.bolts[b].t > 0.35) S.bolts.splice(b, 1); }
            },
            idle: function (k, dt) { S.cloudOff += dt * 10; S.door += (1 - S.door) * Math.min(1, dt * 2); S.waterY = S.g.H + 10; },
            finale: function (k, dt) {
                var g = S.g;
                S.cloudOff += dt * 8;
                for (var b = S.bolts.length - 1; b >= 0; b--) { S.bolts[b].t += dt; if (S.bolts[b].t > 0.35) S.bolts.splice(b, 1); }
                if (!k.info.win) return;
                S.calm = Math.min(1, S.calm + dt * 0.5);
                S.storm = Math.max(0, S.storm - dt * 0.4);
                S.water += (0.55 - S.water) * Math.min(1, dt * 0.35);
                S.waterY = lerp(g.H + 10, g.H * 0.42, eio(S.water));
                S.arkX += (g.cx - S.arkX) * Math.min(1, dt * 1.5);
                var ap = arkPos(k);
                if (!S.dove && k.stateT > 0.8) S.dove = { t: 0, x: ap.x, y: ap.y };
                if (S.dove) {
                    S.dove.t += dt;
                    var dt2 = S.dove.t, cx = ap.x, cy = ap.y;
                    if (dt2 < 1.6) { var f = dt2 / 1.6; S.dove.x = cx - Math.sin(f * Math.PI) * g.W * 0.32; S.dove.y = cy - f * g.H * 0.35; }
                    else if (dt2 < 3.2) { var f2 = (dt2 - 1.6) / 1.6; S.dove.x = cx - Math.sin((1 - f2) * Math.PI * 0.5) * g.W * 0.08; S.dove.y = lerp(cy - g.H * 0.35, cy - g.ah * 0.35, eio(f2)); S.dove.leaf = true; }
                    if (dt2 > 2.4) S.rainbow = Math.min(1, S.rainbow + dt * 0.55);
                    if (dt2 > 3.2 && !S.dove.burst) { S.dove.burst = true; k.emit(S.dove.x, S.dove.y, 20, { colors: ['#9be37a', C.goldL, '#fff'] }); k.glyphBurst(S.dove.x, S.dove.y, 6); k.sfx('win'); }
                }
            },
            down: function (k, p) {
                if (S.ph === 2) { S.arkTX = clamp(p.x, S.g.W * 0.12, S.g.W * 0.88); return; }
                for (var r = 0; r < S.rocks.length; r++) {
                    if (Math.abs(p.x - S.rocks[r].x) < S.g.asz * 0.6 && Math.abs(p.y - (S.g.pathY - S.g.asz * 0.3)) < S.g.asz * 0.7) {
                        k.loseLife(S.rocks[r].x, S.g.pathY - S.g.asz * 1.2, 'ده حجر مش حيوان!');
                        return;
                    }
                }
                var an = animalAt(p);
                if (an) tapAnimal(k, an);
            },
            move: function (k, p) { if (S.ph === 2 && k.pdown) S.arkTX = clamp(p.x, S.g.W * 0.12, S.g.W * 0.88); },
            key: function (k, key, isDown) {
                if (S.ph !== 2 || !isDown) return false;
                if (key === 'ArrowLeft') { S.arkTX = clamp(S.arkTX - S.g.W * 0.18, S.g.W * 0.12, S.g.W * 0.88); return true; }
                if (key === 'ArrowRight') { S.arkTX = clamp(S.arkTX + S.g.W * 0.18, S.g.W * 0.12, S.g.W * 0.88); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, st = S.storm;
                blit(ctx, S.skyCalm, 0, 0);
                if (st > 0.01) { ctx.globalAlpha = clamp(st, 0, 1); blit(ctx, S.skyStorm, 0, 0); ctx.globalAlpha = 1; }
                // rainbow (finale)
                if (S.rainbow > 0) {
                    var rcx = W / 2, rcy = g.groundY + H * 0.05, rR = Math.min(W * 0.46, H * 0.9), cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#5e35b1'];
                    ctx.save(); ctx.globalAlpha = 0.75 * S.rainbow; ctx.lineWidth = Math.max(4, H * 0.018);
                    for (var ci = 0; ci < cols.length; ci++) {
                        ctx.strokeStyle = cols[ci];
                        ctx.beginPath(); ctx.arc(rcx, rcy, rR - ci * ctx.lineWidth, Math.PI, Math.PI + Math.PI * eio(S.rainbow)); ctx.stroke();
                    }
                    ctx.restore();
                }
                // clouds
                ctx.globalAlpha = clamp(0.25 + st * 0.75 - S.calm * 0.6, 0, 1);
                blitTiled(ctx, S.cloudB, S.cloudOff2, 0, W);
                blitTiled(ctx, S.cloudA, S.cloudOff, -H * 0.04, W);
                ctx.globalAlpha = 1;
                if (S.warn) {
                    var wa = 0.25 + 0.35 * Math.abs(Math.sin(k.rt * 18));
                    ctx.fillStyle = 'rgba(255,245,180,' + wa * 0.5 + ')'; ctx.beginPath(); ell(ctx, S.warn.x, g.pathY, g.W * 0.1, 10); ctx.fill();
                    emo(ctx, boltE, S.warn.x, H * 0.16, 22);
                }
                blit(ctx, S.hillsFar, 0, 0);
                blit(ctx, S.hillsNear, 0, 0);
                // back water
                if (S.waterY < H) {
                    ctx.fillStyle = 'rgba(40,85,120,0.85)';
                    ctx.beginPath(); ctx.moveTo(0, H);
                    for (var x = 0; x <= W + 10; x += 16) ctx.lineTo(x, S.waterY - 6 + Math.sin(x * 0.02 + k.t * 1.8) * 5 * (0.4 + st));
                    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
                }
                // ark + ramp + Noah
                var ap = arkPos(k), aw = g.aw * ap.sc, ah = g.ah * ap.sc;
                ctx.save();
                ctx.translate(ap.x, ap.y + ah / 2); ctx.rotate(ap.rot); ctx.translate(-ap.x, -(ap.y + ah / 2));
                blit(ctx, S.arkSprite, ap.x - aw / 2, ap.y, aw, ah);
                var dr = doorRect(g, ap.x, ap.y, ap.sc);
                ctx.fillStyle = '#1c0f06'; ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
                ctx.fillStyle = 'rgba(255,210,120,' + (0.25 * S.door) + ')'; ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
                ctx.fillStyle = '#8a5a2b'; ctx.fillRect(dr.x, dr.y + dr.h * S.door, dr.w, dr.h * (1 - S.door));
                ctx.strokeStyle = '#3a220f'; ctx.lineWidth = 1.2; ctx.strokeRect(dr.x, dr.y, dr.w, dr.h);
                if (S.float < 0.05 && S.door > 0.05) {
                    ctx.fillStyle = vgrad(ctx, dr.y + dr.h, g.pathY, ['#a7753f', '#7a4f26']);
                    ctx.beginPath(); ctx.moveTo(dr.x, dr.y + dr.h); ctx.lineTo(dr.x + dr.w, dr.y + dr.h); ctx.lineTo(g.cx + g.asz * 0.9, g.pathY + 4); ctx.lineTo(g.cx - g.asz * 0.9, g.pathY + 4); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = 'rgba(40,20,5,0.5)'; ctx.lineWidth = 1;
                    for (var rs = 1; rs < 5; rs++) { var ry = lerp(dr.y + dr.h, g.pathY, rs / 5); ctx.beginPath(); ctx.moveTo(g.cx - lerp(dr.w / 2, g.asz * 0.9, rs / 5), ry); ctx.lineTo(g.cx + lerp(dr.w / 2, g.asz * 0.9, rs / 5), ry); ctx.stroke(); }
                }
                if (S.float < 0.5) {
                    var wave = S.ph < 2 ? 1.4 + Math.sin(k.rt * 3) * 0.5 : 0.3;
                    figure(ctx, { x: dr.x - aw * 0.1, y: dr.y + dr.h, h: ah * 0.62, dir: 1, robe: '#e8dcc0', mantle: '#8e3b2a', hair: '#e8e4dc', beard: 1, beardColor: '#f1ede6', halo: true, arm: wave, t: k.rt, dpr: k.dpr });
                }
                ctx.restore();
                // front water
                if (S.waterY < H) {
                    ctx.fillStyle = vgrad(ctx, S.waterY - 10, H, ['rgba(70,140,185,0.92)', 'rgba(20,60,100,0.97)']);
                    ctx.beginPath(); ctx.moveTo(0, H);
                    for (var x2 = 0; x2 <= W + 10; x2 += 14) ctx.lineTo(x2, S.waterY + 6 + Math.sin(x2 * 0.028 - k.t * 2.4) * 6 * (0.4 + st) + Math.sin(x2 * 0.07 + k.t) * 2);
                    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
                }
                // rocks, animals
                for (var r = 0; r < S.rocks.length; r++) {
                    var ro = S.rocks[r];
                    ctx.save(); ctx.translate(ro.x, g.pathY - g.asz * 0.28); ctx.rotate(ro.rot);
                    ctx.fillStyle = '#7d7466'; ctx.beginPath(); ell(ctx, 0, 0, g.asz * 0.36, g.asz * 0.3); ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ell(ctx, -g.asz * 0.1, -g.asz * 0.1, g.asz * 0.12, g.asz * 0.08); ctx.fill();
                    ctx.restore();
                    emo(ctx, rockE, ro.x, g.pathY - g.asz * 0.95, g.asz * 0.34);
                }
                for (var i = 0; i < S.animals.length; i++) drawAnimal(k, ctx, S.animals[i], g);
                // phase 3 strike warnings
                if (S.ph === 2) {
                    for (var si = 0; si < S.strikes.length; si++) {
                        var sk = S.strikes[si];
                        if (sk.state !== 1) continue;
                        var pr = clamp((S.phase3T - (sk.t - sk.warn)) / sk.warn, 0, 1);
                        var xs = sk.dbl ? [sk.x, sk.x2] : [sk.x];
                        for (var xi = 0; xi < xs.length; xi++) {
                            ctx.fillStyle = 'rgba(255,240,160,' + (0.08 + 0.22 * pr) + ')';
                            ctx.fillRect(xs[xi] - g.aw * 0.2, 0, g.aw * 0.4, S.waterY);
                            ctx.strokeStyle = 'rgba(255,245,190,' + (0.4 + 0.5 * Math.abs(Math.sin(k.rt * 16))) + ')'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
                            ctx.beginPath(); ctx.moveTo(xs[xi], 40); ctx.lineTo(xs[xi], S.waterY); ctx.stroke(); ctx.setLineDash([]);
                            emo(ctx, boltE, xs[xi], 58, 20);
                        }
                    }
                }
                // bolts
                for (var b = 0; b < S.bolts.length; b++) {
                    var bo = S.bolts[b], pts = bo.pts;
                    ctx.globalAlpha = 1 - bo.t / 0.35;
                    ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
                    ctx.shadowColor = '#bfe3ff'; ctx.shadowBlur = 14;
                    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
                    for (var pi2 = 2; pi2 < pts.length; pi2 += 2) ctx.lineTo(pts[pi2], pts[pi2 + 1]);
                    ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                }
                // dove
                if (S.dove) {
                    var dv = S.dove, flap = Math.sin(k.rt * 18) * 0.7;
                    ctx.save(); ctx.translate(dv.x, dv.y);
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ell(ctx, 0, 0, 11, 6); ctx.fill();
                    ctx.beginPath(); circ(ctx, -10, -3, 4.5); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(4, -16 * flap - 4, 12, -10 * flap - 6); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(17, -3); ctx.lineTo(17, 4); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#f0a040'; ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-18, -2); ctx.lineTo(-14, -1); ctx.fill();
                    if (dv.leaf) { ctx.fillStyle = '#5da33a'; ctx.beginPath(); ctx.ellipse(-20, 1, 6, 2.6, 0.5, 0, TAU); ctx.fill(); }
                    ctx.restore();
                }
                // rain
                var nDrops = Math.floor((k.reduced ? 50 : 150) * clamp(st - S.calm, 0, 1));
                if (nDrops > 0) {
                    ctx.strokeStyle = 'rgba(200,220,240,0.55)'; ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    for (var d = 0; d < nDrops; d++) {
                        var rd = S.rain[d], ry2 = ((rd.y + k.rt * rd.v * 1.4) % 1) * H, rx = ((rd.x + ry2 / H * 0.05) % 1) * W;
                        ctx.moveTo(rx, ry2); ctx.lineTo(rx - 3, ry2 + rd.l);
                    }
                    ctx.stroke();
                }
                if (S.ph === 2 && S.phase3T < 3.5) {
                    ctx.globalAlpha = clamp(3.5 - S.phase3T, 0, 1);
                    txt(ctx, 'اسحب الفلك يمين وشمال ← →', W / 2, H * 0.24, font(18, 900), '#fff', 'center', 4);
                    ctx.globalAlpha = 1;
                }
            }
        });
        return k.api2();
    }

    /* ======================================================================
     * 3. joseph -- from the pit to the palace
     * Six illustrated chapters (stage.scene: canaan, desert, house, prison,
     * dream, palace). Each chapter: a runner segment (tap to jump, collect the
     * stars of Joseph's dream), then a timed moral decision from data, then the
     * stage fact. Twist: the prison chapter is dark (only a lamp around Joseph).
     * Finale: the embrace in the palace. Data: stages, questions, intro, outro,
     * facts, phases.
     * ==================================================================== */
    function joseph(host, data, api) {
        data = data || {};
        var stages = (data.stages || []).filter(function (s) { return s && s.text && s.options && s.options.length >= 2; }).slice(0, 6);
        var SCENES = ['canaan', 'desert', 'house', 'prison', 'dream', 'palace'];
        var RUN = 8.5, STARS = 8, CHOICE_T = 9;
        var S = { ch: -1, mode: 'idle', runT: 0, objs: [], course: [], ci: 0, jy: 0, vy: 0, jumps: 0, onGround: true,
            walk: 0, inv: 0, shield: false, hitInCh: false, choice: null, choiceT: 0, res: null, resT: 0,
            scroll: 0, scenes: {}, banner: null, goodN: 0, embrace: 0 };

        function G(k) {
            var W = k.W, H = k.H, land = W >= H * 1.2;
            var gy = Math.round(H * 0.84), jh = clamp(H * 0.2, 70, 150);
            var grav = 2 * jh / (0.36 * 0.36);
            return { W: W, H: H, land: land, gy: gy, jx: W * (land ? 0.74 : 0.7), jh: jh, grav: grav, jv: Math.sqrt(2 * grav * jh * 1.15),
                speed: Math.max(220, W * 0.44), os: clamp(H * 0.1, 26, 44) };
        }
        function sceneOf(i) { var s = stages[i] && stages[i].scene; return SCENES.indexOf(s) >= 0 ? s : SCENES[Math.min(i, 5)]; }
        function buildScene(k, key) {
            var g = S.g, W = g.W, H = g.H, dpr = k.dpr, gy = g.gy;
            var sky, far, near, ground;
            var cfg = {
                canaan: { sky: ['#8fcaf0', '#d6eef8', '#fbeed0'], far: '#9db98c', near: '#79a257', ground: ['#b89a62', '#8e7243'] },
                desert: { sky: ['#f2c58a', '#f8dfb0', '#fcefd2'], far: '#e2b574', near: '#d09a55', ground: ['#e3c088', '#c49a5a'] },
                house: { sky: ['#f1d6a1', '#f8e7c2', '#fbf1d8'], far: '#e9d3a2', near: '#6f8a3a', ground: ['#d8bd88', '#a88d57'] },
                prison: { sky: ['#1b1712', '#2b241d', '#3a3128'], far: '#4a4038', near: '#2e2721', ground: ['#3d342c', '#231d18'] },
                dream: { sky: ['#15123d', '#2d2566', '#5b3f7e'], far: '#2a2350', near: '#1f4b3a', ground: ['#4a3f33', '#2e271f'] },
                palace: { sky: ['#f7cf6c', '#fbe3a1', '#fff4d6'], far: '#e8c77a', near: '#b88a3c', ground: ['#dcb66e', '#b08a45'] }
            }[key];
            sky = layer(W, H, dpr, function (x) {
                x.fillStyle = vgrad(x, 0, gy, cfg.sky); x.fillRect(0, 0, W, H);
                if (key === 'dream') {
                    var r = seeded(3);
                    for (var i = 0; i < 90; i++) { x.fillStyle = 'rgba(255,250,220,' + (0.3 + r() * 0.7) + ')'; x.beginPath(); circ(x, r() * W, r() * gy * 0.8, 0.6 + r() * 1.4); x.fill(); }
                    x.fillStyle = '#fff6d0'; x.beginPath(); circ(x, W * 0.22, H * 0.2, 16); x.fill();
                    x.fillStyle = cfg.sky[0]; x.beginPath(); circ(x, W * 0.22 + 7, H * 0.2 - 4, 14); x.fill();
                } else if (key !== 'prison') {
                    x.fillStyle = 'rgba(255,248,220,0.85)'; x.beginPath(); circ(x, W * 0.2, H * 0.2, 20); x.fill();
                }
            });
            far = layer(W, H, dpr, function (x) {
                if (key === 'canaan' || key === 'desert') {
                    ridge(x, W, gy - H * 0.2, H * 0.14, key === 'canaan' ? 41 : 42, 3, gy + 2); x.fillStyle = cfg.far; x.fill();
                    if (key === 'desert') {
                        // Ishmaelite caravan silhouettes (camels)
                        x.fillStyle = 'rgba(120,80,40,0.55)';
                        for (var c = 0; c < 5; c++) camel(x, W * 0.1 + c * W * 0.08, gy - H * 0.2, H * 0.07);
                    }
                } else if (key === 'house' || key === 'palace') {
                    x.fillStyle = cfg.far; x.fillRect(0, gy - H * 0.52, W, H * 0.52);
                    var fr = friezeSprite(Math.round(H * 0.035), dpr, key === 'palace' ? '#a8741f' : '#3f6fa0', key === 'palace' ? '#fbe3a1' : '#efe0bb');
                    blitTiled(x, fr, 0, gy - H * 0.5, W);
                    for (var cx = 30; cx < W; cx += 120) {
                        x.fillStyle = key === 'palace' ? '#d9ac52' : '#dcc18a';
                        x.fillRect(cx - 9, gy - H * 0.45, 18, H * 0.45);
                        x.fillStyle = key === 'palace' ? '#b8862b' : '#6f8a3a';
                        x.beginPath(); x.moveTo(cx - 17, gy - H * 0.45); x.quadraticCurveTo(cx, gy - H * 0.53, cx + 17, gy - H * 0.45); x.closePath(); x.fill();
                    }
                    if (key === 'palace') {
                        x.fillStyle = '#e3c98f';
                        for (var gi = 0; gi < 3; gi++) { var gx = W * (0.2 + gi * 0.3); x.beginPath(); x.moveTo(gx - 26, gy); x.lineTo(gx - 26, gy - 30); x.quadraticCurveTo(gx, gy - 70, gx + 26, gy - 30); x.lineTo(gx + 26, gy); x.fill(); }
                    }
                } else if (key === 'prison') {
                    x.fillStyle = cfg.far; x.fillRect(0, 0, W, gy);
                    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1;
                    for (var by = 0; by < gy; by += 24) { x.beginPath(); x.moveTo(0, by); x.lineTo(W, by); x.stroke(); for (var bx = (by / 24) % 2 ? 0 : 26; bx < W; bx += 52) { x.beginPath(); x.moveTo(bx, by); x.lineTo(bx, by + 24); x.stroke(); } }
                    for (var wx = 90; wx < W; wx += W / 2) {
                        x.fillStyle = '#9fb6d8'; x.fillRect(wx, gy * 0.25, 44, 36);
                        x.fillStyle = '#1b1712'; for (var b = 0; b < 4; b++) x.fillRect(wx + 5 + b * 11, gy * 0.25, 3, 36);
                    }
                } else if (key === 'dream') {
                    x.fillStyle = cfg.far;
                    for (var p = 0; p < 3; p++) { var px = W * (0.15 + p * 0.3); x.beginPath(); x.moveTo(px - H * 0.18, gy - H * 0.08); x.lineTo(px, gy - H * 0.34); x.lineTo(px + H * 0.18, gy - H * 0.08); x.closePath(); x.fill(); }
                    x.fillStyle = 'rgba(80,120,190,0.55)'; x.fillRect(0, gy - H * 0.09, W, H * 0.05);
                }
            });
            near = layer(W, H, dpr, function (x) {
                var r = seeded(key.length * 13);
                if (key === 'canaan') {
                    ridge(x, W, gy - H * 0.06, H * 0.07, 51, 2, gy + 2); x.fillStyle = cfg.near; x.fill();
                    for (var i = 0; i < 4; i++) { var tx = (i + 0.3) * W / 4; x.fillStyle = '#5a3a1e'; x.fillRect(tx - 3, gy - H * 0.16, 6, H * 0.12); x.fillStyle = '#56722e'; x.beginPath(); circ(x, tx, gy - H * 0.18, H * 0.06); circ(x, tx - 12, gy - H * 0.15, H * 0.045); circ(x, tx + 12, gy - H * 0.15, H * 0.045); x.fill(); }
                    for (var s2 = 0; s2 < 5; s2++) sheep(x, r() * W, gy - 2, H * 0.004 + 0.8, r() < 0.5 ? 1 : -1, s2);
                } else if (key === 'desert') {
                    ridge(x, W, gy - H * 0.04, H * 0.05, 52, 2, gy + 2); x.fillStyle = cfg.near; x.fill();
                } else if (key === 'house' || key === 'dream') {
                    for (var pp = 0; pp < 3; pp++) palm(x, (pp + 0.5) * W / 3, gy, H * 0.34, key === 'dream' ? '#1f3a30' : '#4b6326');
                    if (key === 'dream') { x.fillStyle = '#23553f'; for (var rd = 0; rd < W; rd += 9) x.fillRect(rd, gy - 10 - (rd * 7) % 12, 2, 12 + (rd * 7) % 12); }
                } else if (key === 'palace') {
                    for (var bn = 0; bn < 4; bn++) { var bx2 = (bn + 0.5) * W / 4; x.fillStyle = '#8e1f1f'; x.fillRect(bx2 - 12, gy - H * 0.36, 24, H * 0.18); copticCross(x, bx2, gy - H * 0.29, 7, C.gold); x.fillStyle = '#6b4220'; x.fillRect(bx2 - 1, gy - H * 0.4, 2, H * 0.4); }
                }
            });
            ground = layer(W, H - gy + 2, dpr, function (x, w, h) {
                x.fillStyle = vgrad(x, 0, h, cfg.ground); x.fillRect(0, 0, w, h);
                x.fillStyle = 'rgba(0,0,0,0.12)'; for (var i = 0; i < w; i += 40) x.fillRect(i, 0, 20, 2);
                x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 0, w, 2);
            });
            return { sky: sky, far: far, near: near, ground: ground, dark: key === 'prison' || key === 'dream' };
        }
        function camel(x, cx, cy, s) {
            x.beginPath(); ell(x, cx, cy, s * 0.6, s * 0.3); x.fill();
            x.beginPath(); circ(x, cx - s * 0.1, cy - s * 0.3, s * 0.22); x.fill();
            x.fillRect(cx - s * 0.5, cy, s * 0.08, s * 0.6); x.fillRect(cx + s * 0.4, cy, s * 0.08, s * 0.6);
            x.beginPath(); x.moveTo(cx - s * 0.55, cy - s * 0.1); x.quadraticCurveTo(cx - s * 0.85, cy - s * 0.3, cx - s * 0.8, cy - s * 0.6); x.lineTo(cx - s * 0.66, cy - s * 0.6); x.quadraticCurveTo(cx - s * 0.7, cy - s * 0.2, cx - s * 0.45, cy); x.fill();
        }
        function palm(x, px, gy, h, col) {
            x.strokeStyle = '#6b4a22'; x.lineWidth = 5;
            x.beginPath(); x.moveTo(px, gy); x.quadraticCurveTo(px + 8, gy - h * 0.5, px + 2, gy - h); x.stroke();
            x.fillStyle = col;
            for (var i = 0; i < 6; i++) {
                var a = -Math.PI / 2 + (i - 2.5) * 0.55;
                x.beginPath(); x.moveTo(px + 2, gy - h);
                x.quadraticCurveTo(px + 2 + Math.cos(a) * h * 0.3, gy - h + Math.sin(a) * h * 0.2 - 8, px + 2 + Math.cos(a) * h * 0.4, gy - h + Math.sin(a) * h * 0.1 + 14);
                x.quadraticCurveTo(px + 2 + Math.cos(a) * h * 0.2, gy - h + Math.sin(a) * h * 0.1, px + 2, gy - h); x.fill();
            }
        }
        function layout(k) { S.g = G(k); S.scenes = {}; }
        function scene(k) {
            var key = sceneOf(Math.max(0, S.ch));
            if (!S.scenes[key]) S.scenes[key] = buildScene(k, key);
            return S.scenes[key];
        }
        function plan(i) {
            var list = [], t = 1.1, n = 0, stepT = Math.max(1.25, 1.85 - i * 0.08);
            while (t < RUN - 0.6) { list.push({ t: t, kind: 'ob' }); t += stepT + rand(-0.15, 0.25); n++; }
            for (var s = 0; s < STARS; s++) list.push({ t: 0.8 + (RUN - 1.4) * (s + 0.5) / STARS, kind: 'star', hi: s % 2 === 0 });
            list.sort(function (a, b) { return a.t - b.t; });
            return list;
        }
        function startChapter(k, i) {
            S.ch = i; S.mode = 'run'; S.runT = 0; S.course = plan(i); S.objs = []; S.hitInCh = false;
            var st = stages[i];
            if (i % 2 === 0) k.phaseCard(i / 2 + 1);
            S.banner = { s: (st.emoji ? st.emoji + ' ' : '') + plain(st.title || ''), t: i % 2 === 0 ? -2.2 : 0 };
            if (i % 2 === 0) k.after(2.6, function () { k.fact(5.5); });
            k.sfx('page');
        }
        function toChoice(k) {
            var st = stages[S.ch];
            S.mode = 'choice'; S.choiceT = 0; S.objs = [];
            var opts = st.options.slice(0, 3).map(function (o, i) { return { t: plain(o.t), good: !!o.good, i: i }; });
            S.choice = { opts: shuffle(opts), picked: -1 };
            k.sfx('page');
        }
        function choose(k, idx) {
            if (S.mode !== 'choice' || S.choice.picked >= 0) return;
            var st = stages[S.ch], o = idx >= 0 ? S.choice.opts[idx] : null;
            S.choice.picked = idx;
            var good = !!(o && o.good);
            if (good) {
                S.goodN++;
                var bonus = 15 + Math.round(5 * clamp(1 - S.choiceT / CHOICE_T, 0, 1));
                k.addScore(bonus, S.g.W / 2, S.g.H * 0.3, '💛 ', '#9dffb0', 22);
                k.sfx('tier'); k.glyphBurst(S.g.jx, S.g.gy - S.g.os * 3, 6);
            } else {
                k.breakCombo(); k.sfx('bad');
            }
            if (!S.hitInCh) k.addScore(5);
            S.res = { good: good, timeout: idx < 0, fact: plain(st.fact || ''), right: (st.options.filter(function (x) { return x.good; })[0] || {}).t || '' };
            S.mode = 'result'; S.resT = 0;
        }
        function afterResult(k) {
            var i = S.ch;
            if (i >= stages.length - 1) { S.mode = 'end'; k.finish({ title: 'من البير للقصر! 👑', finaleT: 3.4 }); return; }
            S.mode = 'wait';
            if (i === 1 || i === 3) k.checkpoint(function () { startChapter(k, i + 1); });
            else startChapter(k, i + 1);
        }
        function jump(k) {
            if (S.mode !== 'run') return;
            if (S.onGround || S.jumps < 2) {
                S.vy = -S.g.jv * (S.onGround ? 1 : 0.8); S.onGround = false; S.jumps++;
                k.sfx('jump');
                k.emit(S.g.jx, S.g.gy, 5, { colors: ['rgba(255,255,255,0.7)', '#e9c98f'], grav: 100, vmin: 20, vmax: 70 });
            }
        }
        function outfit(key) {
            if (key === 'canaan') return { stripes: ['#c0392b', '#f1c40f', '#2e86c1', '#27ae60', '#8e44ad'] };
            if (key === 'desert') return { robe: '#cdb89a' };
            if (key === 'palace') return { robe: '#fbf7ec', mantle: '#8e1f1f', collar: true };
            return { robe: '#f3ead6' };
        }
        function drawObstacle(ctx, o, g, key) {
            var s = g.os, x = o.x, y = g.gy;
            if (key === 'house') {
                ctx.fillStyle = '#b8683a'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, y - s); ctx.quadraticCurveTo(x - s * 0.55, y - s * 0.5, x - s * 0.18, y); ctx.lineTo(x + s * 0.18, y); ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.5, x + s * 0.2, y - s); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#8a4a24'; ctx.fillRect(x - s * 0.24, y - s * 1.08, s * 0.48, s * 0.12);
                ctx.strokeStyle = '#f3dcb0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - s * 0.36, y - s * 0.55); ctx.lineTo(x + s * 0.36, y - s * 0.55); ctx.stroke();
            } else if (key === 'prison') {
                ctx.strokeStyle = '#8a8378'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(x + s * 0.6, y - 2); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.3, x, y - s * 0.3); ctx.stroke();
                ctx.fillStyle = '#5f5a52'; ctx.beginPath(); circ(ctx, x - s * 0.1, y - s * 0.42, s * 0.42); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); circ(ctx, x - s * 0.22, y - s * 0.55, s * 0.12); ctx.fill();
            } else if (key === 'palace') {
                ctx.fillStyle = '#c9a56a'; rr(ctx, x - s * 0.45, y - s * 0.8, s * 0.9, s * 0.8, s * 0.2); ctx.fill();
                ctx.fillStyle = '#9a7a44'; ctx.fillRect(x - s * 0.2, y - s * 0.95, s * 0.4, s * 0.18);
                ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ell(ctx, x, y - s * 0.95, s * 0.2, s * 0.08); ctx.fill();
            } else if (key === 'canaan' || key === 'dream') {
                ctx.fillStyle = key === 'dream' ? '#2f5a3e' : '#5f6f2e';
                for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.5 + i * s * 0.25, y); ctx.lineTo(x - s * 0.4 + i * s * 0.22, y - s * (0.6 + (i % 2) * 0.3)); ctx.lineTo(x - s * 0.3 + i * s * 0.22, y); ctx.fill(); }
                ctx.fillStyle = '#7d7466'; ctx.beginPath(); ell(ctx, x + s * 0.1, y - s * 0.2, s * 0.35, s * 0.22); ctx.fill();
            } else {
                ctx.fillStyle = '#9a8468'; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x - s * 0.35, y - s * 0.7); ctx.lineTo(x + s * 0.1, y - s * 0.9); ctx.lineTo(x + s * 0.5, y - s * 0.4); ctx.lineTo(x + s * 0.55, y); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.6); ctx.lineTo(x + s * 0.05, y - s * 0.8); ctx.lineTo(x, y - s * 0.5); ctx.closePath(); ctx.fill();
            }
        }
        function choiceLayout(g) {
            var pw = Math.min(g.W - 24, 620), ph = Math.min(g.H - 20, 300);
            var b = { x: (g.W - pw) / 2, y: (g.H - ph) / 2, w: pw, h: ph };
            var n = S.choice ? S.choice.opts.length : 2, bh = clamp(ph * 0.22, 44, 64), gap = 12;
            var bw = g.land ? (pw * 0.84 - gap * (n - 1)) / n : pw * 0.8;
            var btns = [];
            for (var i = 0; i < n; i++) {
                if (g.land) btns.push({ x: b.x + pw / 2 + (pw * 0.84) / 2 - (i + 1) * bw - i * gap, y: b.y + ph - bh - ph * 0.12, w: bw, h: bh });
                else btns.push({ x: b.x + (pw - bw) / 2, y: b.y + ph - (n - i) * (bh + 8) - ph * 0.08, w: bw, h: bh });
            }
            return { b: b, btns: btns };
        }

        var k = createCore(host, data, api, {
            title: 'يوسف من البير للقصر', icon: '⭐',
            howto: { kind: 'jump', text: 'اضغط عشان يوسف ينط (ودوسة تانية في الهوا = نطة زيادة). لمّ النجوم، وفي آخر كل فصل اختار الاختيار الأمين.' },
            comboStep: 5, maxMult: 3, pad: [146.8, 220],
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) {
                if (!stages.length) { k.finish({ title: 'القصة مش جاهزة لسه', finaleT: 0.5 }); return; }
                startChapter(k, 0);
            },
            reward: function (k) { S.shield = true; return '🛡️ درع يحميك من خبطة'; },
            rawMax: function (k) { return k.perfectRaw(STARS * stages.length, 2) + stages.length * 25 + 30; },
            update: function (k, dt) {
                var g = S.g;
                if (S.banner) S.banner.t += dt;
                if (S.inv > 0) S.inv -= dt;
                // physics
                if (!S.onGround) {
                    S.vy += g.grav * dt; S.jy += S.vy * dt;
                    if (S.jy >= 0) { S.jy = 0; S.vy = 0; S.onGround = true; S.jumps = 0; }
                }
                if (S.mode === 'run') {
                    S.runT += dt; S.walk += dt * 13; S.scroll += g.speed * (1 + S.ch * 0.06) * dt;
                    var v = g.speed * (1 + S.ch * 0.06);
                    while (S.course.length && S.course[0].t <= S.runT) {
                        var c = S.course.shift();
                        S.objs.push({ kind: c.kind, x: -g.os, hi: c.hi, got: false, ph: rand(0, TAU) });
                    }
                    for (var i = S.objs.length - 1; i >= 0; i--) {
                        var o = S.objs[i];
                        o.x += v * dt;
                        if (o.x > g.W + g.os * 2) { S.objs.splice(i, 1); continue; }
                        var jyTop = g.gy + S.jy - g.jh * 0.75, jyBot = g.gy + S.jy;
                        if (o.kind === 'ob' && !o.got && Math.abs(o.x - g.jx) < g.os * 0.5 && jyBot > g.gy - g.os * 0.75) {
                            o.got = true;
                            if (S.inv > 0) continue;
                            if (S.shield) { S.shield = false; S.inv = 0.8; k.pop(g.jx, jyTop - 10, '🛡️ الدرع حماك!', '#bfe8ff', 18); k.sfx('power'); continue; }
                            S.hitInCh = true; S.inv = 1.3;
                            k.loseLife(g.jx, jyTop - 10, 'آه!');
                            if (k.lives <= 0) { S.mode = 'end'; k.finish({ lose: true, title: 'متزعلش… يوسف ما استسلمش، جرّب تاني!', finaleT: 1.2 }); return; }
                        } else if (o.kind === 'star' && !o.got) {
                            var sy = o.hi ? g.gy - g.jh * 0.95 : g.gy - g.os * 0.6;
                            if (Math.abs(o.x - g.jx) < g.os * 0.6 && sy > jyTop - g.os * 0.4 && sy < jyBot) {
                                o.got = true;
                                k.hit(2, o.x, sy - 16, { silent: true }); k.sfx('coin');
                                k.emit(o.x, sy, 8, { colors: [C.goldL, '#fff'] });
                                S.objs.splice(i, 1);
                            }
                        }
                    }
                    if (S.runT >= RUN && !S.course.length) { var anyOb = false; for (var j = 0; j < S.objs.length; j++) if (S.objs[j].x < g.jx) anyOb = true; if (!anyOb) toChoice(k); }
                } else if (S.mode === 'choice') {
                    S.choiceT += dt; S.walk = 0;
                    if (S.choiceT >= CHOICE_T) choose(k, -1);
                } else if (S.mode === 'result') {
                    S.resT += dt;
                    if (S.resT >= (S.res.fact ? 4.2 : 2)) afterResult(k);
                }
            },
            finale: function (k, dt) {
                S.embrace = Math.min(1, S.embrace + dt * 0.8);
                if (k.info.win && Math.random() < dt * 5) k.emit(S.g.W / 2 + rand(-40, 40), S.g.gy - S.g.jh, 2, { colors: ['#ff8fb1', '#ffd1dc'], grav: -30, up: 20, vmin: 10, vmax: 40, lmin: 1, lmax: 1.8 });
            },
            down: function (k, p) {
                if (S.mode === 'run') { jump(k); return; }
                if (S.mode === 'choice') {
                    var L = choiceLayout(S.g);
                    for (var i = 0; i < L.btns.length; i++) if (inRect(p, L.btns[i], 4)) { choose(k, i); return; }
                }
                if (S.mode === 'result' && S.resT > 1) afterResult(k);
            },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                if (key === ' ' || key === 'ArrowUp') { jump(k); return true; }
                if (S.mode === 'choice' && (key === '1' || key === '2' || key === '3')) { var n = +key - 1; if (n < S.choice.opts.length) choose(k, n); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, key = sceneOf(Math.max(0, S.ch)), sc = scene(k);
                var fin = (k.state === 'finale' || k.state === 'outro') && k.info && k.info.win;
                if (fin) { key = 'palace'; sc = S.scenes.palace || (S.scenes.palace = buildScene(k, 'palace')); }
                blit(ctx, sc.sky, 0, 0);
                blitTiled(ctx, sc.far, -S.scroll * 0.15, 0, W);
                blitTiled(ctx, sc.near, -S.scroll * 0.45, 0, W);
                blitTiled(ctx, sc.ground, -S.scroll, g.gy, W);
                var fit = outfit(key);
                // objects
                for (var i = 0; i < S.objs.length; i++) {
                    var o = S.objs[i];
                    if (o.kind === 'ob') drawObstacle(ctx, o, g, key);
                    else {
                        var sy = o.hi ? g.gy - g.jh * 0.95 : g.gy - g.os * 0.6, r = g.os * 0.32;
                        ctx.save(); ctx.translate(o.x, sy + Math.sin(k.rt * 4 + o.ph) * 3); ctx.rotate(k.rt * 1.5);
                        var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2); gr.addColorStop(0, 'rgba(255,230,140,0.6)'); gr.addColorStop(1, 'rgba(255,230,140,0)');
                        ctx.fillStyle = gr; ctx.beginPath(); circ(ctx, 0, 0, r * 2.2); ctx.fill();
                        starPath(ctx, 0, 0, r, 0.45); ctx.fillStyle = C.goldL; ctx.fill(); ctx.strokeStyle = C.goldD; ctx.lineWidth = 1; ctx.stroke();
                        ctx.restore();
                    }
                }
                if (fin) {
                    // palace embrace: Joseph and his father Jacob, brothers around
                    var e = eo(S.embrace), cx = W / 2, fh = clamp(H * 0.42, 90, 190);
                    for (var b = 0; b < 6; b++) tinyPerson(ctx, cx + (b < 3 ? -1 : 1) * (fh * 0.7 + (b % 3) * fh * 0.22), g.gy, fh * 0.55, ['#8a5a2b', '#3b5f86', '#7c3a28', '#5b6e2e', '#6b4a7a', '#a0522d'][b], '#3a2414', -1, b < 3 ? 1 : -1);
                    figure(ctx, { x: cx - lerp(fh * 0.6, fh * 0.18, e), y: g.gy, h: fh, dir: 1, robe: '#fbf7ec', mantle: '#8e1f1f', collar: true, hair: '#3a2414', halo: true, arm: lerp(0.3, 1.9, e), arm2: lerp(0.2, 1.6, e), t: k.rt, dpr: k.dpr });
                    figure(ctx, { x: cx + lerp(fh * 0.6, fh * 0.18, e), y: g.gy, h: fh * 0.96, dir: -1, robe: '#d9cbb0', mantle: '#4b6326', hair: '#e8e4dc', beard: 1, beardColor: '#f1ede6', arm: lerp(0.3, 1.9, e), arm2: lerp(0.2, 1.5, e), prop: e < 0.5 ? 'staff' : null, t: k.rt + 1, dpr: k.dpr });
                    if (e > 0.6) { heartPath(ctx, cx, g.gy - fh * 1.15 - Math.sin(k.rt * 3) * 4, 14); ctx.fillStyle = '#e0443a'; ctx.fill(); }
                } else {
                    var jyy = g.gy + S.jy, blink = S.inv > 0 && Math.floor(k.rt * 14) % 2 === 0;
                    if (!blink) {
                        figure(ctx, { x: g.jx, y: jyy, h: g.jh * 0.8, dir: -1, robe: fit.robe, stripes: fit.stripes, mantle: fit.mantle, collar: fit.collar, hair: '#3a2414',
                            halo: true, walk: S.mode === 'run' && S.onGround ? S.walk : -1, jump: S.onGround ? 0 : 1, arm: S.onGround ? null : 2.2, t: k.rt, dpr: k.dpr, noShadow: !S.onGround });
                    }
                    if (S.shield) {
                        ctx.strokeStyle = 'rgba(190,232,255,' + (0.5 + 0.3 * Math.sin(k.rt * 6)) + ')'; ctx.lineWidth = 3;
                        ctx.beginPath(); ell(ctx, g.jx, jyy - g.jh * 0.42, g.jh * 0.34, g.jh * 0.5); ctx.stroke();
                    }
                }
                // twist: the prison is dark, a lamp of faith around Joseph
                if (key === 'prison' && !fin) {
                    var lx = g.jx, ly = g.gy + S.jy - g.jh * 0.4;
                    var dg = ctx.createRadialGradient(lx, ly, g.jh * 0.5, lx, ly, g.jh * 1.9);
                    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,0.9)');
                    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
                    ctx.fillStyle = 'rgba(255,190,90,0.07)'; ctx.beginPath(); circ(ctx, lx, ly, g.jh * 0.9); ctx.fill();
                }
                // chapter banner
                if (S.banner && S.banner.t > 0 && S.banner.t < 2.4 && !fin) {
                    var bt = S.banner.t, ba = bt < 0.3 ? eob(bt / 0.3) : clamp((2.4 - bt) / 0.4, 0, 1);
                    ctx.save(); ctx.globalAlpha = clamp(ba, 0, 1);
                    ctx.translate(W / 2, H * 0.3); ctx.scale(0.8 + 0.2 * ba, 0.8 + 0.2 * ba);
                    txt(ctx, S.banner.s, 0, 0, font(clamp(H * 0.08, 20, 34), 900), '#fff5d6', 'center', 6);
                    ctx.restore();
                }
                // choice card
                if (S.mode === 'choice' || S.mode === 'result') {
                    var L = choiceLayout(g), bx = L.b, st = stages[S.ch];
                    ctx.fillStyle = 'rgba(12,6,2,0.45)'; ctx.fillRect(0, 0, W, H);
                    k.panel(ctx, bx);
                    var pad = Math.min(bx.w, bx.h) * 0.12, mx = bx.x + bx.w / 2;
                    txt(ctx, (st.emoji ? st.emoji + ' ' : '') + plain(st.title || ''), mx, bx.y + bx.h * 0.16, font(clamp(bx.h * 0.075, 15, 22), 900), C.red);
                    if (S.mode === 'choice') {
                        block(ctx, st.text, mx, bx.y + bx.h * 0.36, bx.w - pad * 2.2, bx.h * 0.26, clamp(bx.h * 0.062, 13, 18), 800, C.ink, 3);
                        var hot = clamp(1 - S.choiceT / CHOICE_T, 0, 1);
                        ctx.fillStyle = 'rgba(142,31,31,0.2)'; rr(ctx, bx.x + bx.w * 0.15, bx.y + bx.h * 0.54, bx.w * 0.7, 6, 3); ctx.fill();
                        ctx.fillStyle = hot < 0.3 ? '#d9453a' : C.gold; rr(ctx, bx.x + bx.w * 0.15, bx.y + bx.h * 0.54, bx.w * 0.7 * hot, 6, 3); ctx.fill();
                        for (var bi = 0; bi < L.btns.length; bi++) {
                            var bb = L.btns[bi];
                            ctx.fillStyle = vgrad(ctx, bb.y, bb.y + bb.h, ['#fff9ea', '#efd9a6']); rr(ctx, bb.x, bb.y, bb.w, bb.h, 14); ctx.fill();
                            ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.6; ctx.stroke();
                            block(ctx, S.choice.opts[bi].t, bb.x + bb.w / 2, bb.y + bb.h / 2 + 1, bb.w - 18, bb.h - 8, clamp(bb.h * 0.28, 12, 17), 800, '#3b2412', 2);
                        }
                    } else if (S.res) {
                        var ok = S.res.good;
                        txt(ctx, ok ? 'اختيار أمين! 💛' : (S.res.timeout ? 'الوقت خلص…' : 'فكّر تاني… يوسف اختار غير كده'), mx, bx.y + bx.h * 0.33, font(clamp(bx.h * 0.07, 14, 20), 900), ok ? '#1d5a2c' : '#8e1f1f');
                        if (!ok && S.res.right) block(ctx, 'الاختيار الأمين: ' + plain(S.res.right), mx, bx.y + bx.h * 0.47, bx.w - pad * 2, bx.h * 0.14, clamp(bx.h * 0.055, 12, 16), 800, '#1d5a2c', 2);
                        if (S.res.fact) block(ctx, S.res.fact, mx, bx.y + bx.h * 0.7, bx.w - pad * 2.2, bx.h * 0.26, clamp(bx.h * 0.058, 12, 17), 700, C.ink, 3);
                        drawCross(ctx, mx, bx.y + bx.h * 0.88, 9, C.red, k.dpr);
                    }
                }
            }
        });
        return k.api2();
    }

    /* ======================================================================
     * 4. redSea -- crossing the Red Sea
     * Phase 1: hold to stretch the staff; the sea parts while the faith meter
     *          lasts (release to pray again). Families cross on dry ground.
     * Phase 2: night; the sea stays open. Drag up/down to move the pillar of
     *          fire between Pharaoh's chariots and the people (wheels come off).
     * Phase 3: both together -- hold to keep the sea open, the finger height
     *          moves the pillar. Finale (twist): the sea returns over the
     *          chariots and the song of Moses appears. Data: questions, intro,
     *          outro, facts, phases.
     * ==================================================================== */
    function redSea(host, data, api) {
        data = data || {};
        var PH = [{ groups: 6, chariots: 0, limit: 40 }, { groups: 8, chariots: 10, gap: 2.3, v: 0.24 }, { groups: 6, chariots: 12, gap: 1.9, v: 0.3 }];
        var TOTAL_G = 20, TOTAL_C = 22;
        var ROBES = ['#b5543a', '#3b5f86', '#7c8a3a', '#8a5a2b', '#6b4a7a', '#c49a5a', '#2e7d6b'];
        var S = { ph: -1, open: 0, hold: false, faith: 1, groups: [], crossed: [], chariots: [], cplan: [], clock: 0,
            py: 0, pillarY: 0, need: 0, crossedN: 0, blocked: 0, night: 0, song: 0, closing: 0, gid: 0, fishes: [] };

        function G(k) {
            var W = k.W, H = k.H;
            var seaL = W * 0.14, seaR = W * 0.62, cy = H * 0.6, mh = H * 0.15;
            return { W: W, H: H, seaL: seaL, seaR: seaR, cy: cy, mh: mh, lanes: [H * 0.38, H * 0.6, H * 0.82], pX: W * 0.8, ph: clamp(H * 0.26, 60, 130),
                qx: seaR + 14, gs: clamp(H * 0.09, 20, 36), cs: clamp(H * 0.11, 26, 46) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H, dpr = k.dpr;
            S.g = g;
            if (!S.pillarY) { S.pillarY = g.cy; S.py = g.cy; }
            S.bg = layer(W, H, dpr, function (x) {
                // sea
                x.fillStyle = vgrad(x, 0, H, ['#1d6a9e', '#155586', '#0f3d63']); x.fillRect(0, 0, W, H);
                // Sinai shore (left) with mountains
                x.fillStyle = vgrad(x, 0, H, ['#d8b27a', '#c49a5a']);
                x.beginPath(); x.moveTo(0, 0); x.lineTo(g.seaL + 6, 0);
                for (var y = 0; y <= H; y += 12) x.lineTo(g.seaL + Math.sin(y * 0.05) * 6, y);
                x.lineTo(0, H); x.closePath(); x.fill();
                x.fillStyle = '#9c7446';
                x.beginPath(); x.moveTo(0, H * 0.3); x.lineTo(g.seaL * 0.3, H * 0.08); x.lineTo(g.seaL * 0.65, H * 0.22); x.lineTo(g.seaL * 0.9, H * 0.05); x.lineTo(g.seaL, H * 0.25); x.lineTo(g.seaL, H * 0.32); x.lineTo(0, H * 0.34); x.closePath(); x.fill();
                // Egypt shore (right) with palms
                x.fillStyle = vgrad(x, 0, H, ['#efd29a', '#dcb676']);
                x.beginPath(); x.moveTo(W, 0); x.lineTo(g.seaR - 6, 0);
                for (var y2 = 0; y2 <= H; y2 += 12) x.lineTo(g.seaR + Math.sin(y2 * 0.045 + 1) * 6, y2);
                x.lineTo(W, H); x.closePath(); x.fill();
                x.strokeStyle = 'rgba(255,255,255,0.3)'; x.lineWidth = 2;
                x.beginPath(); for (var y3 = 0; y3 <= H; y3 += 12) x.lineTo(g.seaR + Math.sin(y3 * 0.045 + 1) * 6 - 3, y3); x.stroke();
                x.beginPath(); for (var y4 = 0; y4 <= H; y4 += 12) x.lineTo(g.seaL + Math.sin(y4 * 0.05) * 6 + 3, y4); x.stroke();
                // wave marks
                var r = seeded(8);
                x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1.2;
                for (var i = 0; i < 60; i++) { var wx = g.seaL + r() * (g.seaR - g.seaL), wy = r() * H; x.beginPath(); x.arc(wx, wy, 6, 1.1 * Math.PI, 1.9 * Math.PI); x.stroke(); }
            });
            if (!S.fishes.length) for (var f = 0; f < 10; f++) S.fishes.push({ u: Math.random(), side: f % 2 ? 1 : -1, v: rand(0.02, 0.05), d: rand(0.2, 0.9) });
        }
        function addGroups(n) {
            for (var i = 0; i < n; i++) {
                var mem = [], m = 3 + (S.gid % 3);
                for (var j = 0; j < m; j++) mem.push({ dx: rand(-0.6, 0.6), dy: rand(-0.35, 0.35), c: ROBES[(S.gid * 3 + j) % ROBES.length], h: rand(0.85, 1.1), ph: rand(0, TAU) });
                S.groups.push({ id: S.gid++, x: 0, state: 'queue', mem: mem, sheep: S.gid % 2 === 0, t: 0 });
            }
        }
        function queueX(i) { var g = S.g; return g.qx + g.gs * 0.9 + i * g.gs * 1.5; }
        function startPhase(k, n) {
            S.ph = n; S.clock = 0; S.need = PH[n].groups; S.phCrossed = 0; S.moved = false;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            addGroups(PH[n].groups);
            S.cplan = [];
            for (var i = 0; i < PH[n].chariots; i++) S.cplan.push({ t: 3 + i * PH[n].gap + rand(-0.3, 0.3), lane: Math.floor(Math.random() * 3) });
        }
        function spawnChariot(c) {
            var g = S.g;
            S.chariots.push({ x: g.W + g.cs * 1.4, y: g.lanes[c.lane], state: 'run', t: 0, spin: 0, v: g.W * PH[S.ph].v, warn: 0 });
        }
        function sinaiSpot(n) { var g = S.g, r = seeded(n * 17 + 3); return { x: g.seaL * (0.25 + r() * 0.6), y: g.H * (0.42 + r() * 0.5) }; }
        function phaseDone() {
            var qLeft = 0;
            for (var i = 0; i < S.groups.length; i++) if (S.groups[i].state !== 'done') qLeft++;
            return qLeft === 0 && !S.cplan.length && !S.chariots.length;
        }
        function nextAfter(k) {
            var n = S.ph;
            S.ph = n + 0.5;
            if (n >= 2) { k.finish({ title: 'الرب خلّص شعبه! 🌊', finaleT: 5.5 }); return; }
            k.after(0.6, function () { k.checkpoint(function () { startPhase(k, n + 1); }); });
        }
        function drawChariot(ctx, c, g, t) {
            var s = g.cs, x = c.x, y = c.y, dir = c.state === 'back' ? -1 : 1;
            ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
            ctx.globalAlpha = c.state === 'back' ? clamp(1 - c.t / 1.2, 0, 1) : 1;
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ell(ctx, s * 0.2, s * 0.05, s * 0.9, s * 0.12); ctx.fill();
            // horse
            var gal = Math.sin(t * 16) * s * 0.06;
            ctx.fillStyle = '#6b3f22';
            ctx.beginPath(); ell(ctx, -s * 0.45, -s * 0.38, s * 0.34, s * 0.16); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.45); ctx.lineTo(-s * 0.92, -s * 0.78); ctx.lineTo(-s * 1.08, -s * 0.72); ctx.lineTo(-s * 0.84, -s * 0.36); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-s * 0.68, -s * 0.28); ctx.lineTo(-s * 0.78 - gal, 0); ctx.moveTo(-s * 0.25, -s * 0.28); ctx.lineTo(-s * 0.15 + gal, 0); ctx.stroke();
            // chariot box + driver
            ctx.fillStyle = '#b8862b'; rr(ctx, s * 0.0, -s * 0.62, s * 0.5, s * 0.42, 4); ctx.fill();
            ctx.strokeStyle = '#6a4510'; ctx.lineWidth = 1.5; ctx.stroke();
            tinyPerson(ctx, s * 0.28, -s * 0.5, s * 0.6, '#c0392b', '#1b1b1b', -1, -1);
            // wheel
            var wr = s * 0.26;
            if (!c.noWheel) {
                ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = s * 0.06;
                ctx.beginPath(); ctx.arc(s * 0.25, -wr, wr, 0, TAU); ctx.stroke();
                ctx.lineWidth = s * 0.03;
                for (var i = 0; i < 3; i++) { var a = c.spin + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(s * 0.25 + Math.cos(a) * wr, -wr + Math.sin(a) * wr); ctx.lineTo(s * 0.25 - Math.cos(a) * wr, -wr - Math.sin(a) * wr); ctx.stroke(); }
            }
            ctx.restore();
        }
        function drawPillar(ctx, g, t, night) {
            var x = g.pX, y = S.pillarY, h = g.ph, w = h * 0.34;
            ctx.save();
            if (night) {
                var gr = ctx.createRadialGradient(x, y, 0, x, y, h * 1.1);
                gr.addColorStop(0, 'rgba(255,190,80,0.45)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
                ctx.fillStyle = gr; ctx.beginPath(); circ(ctx, x, y, h * 1.1); ctx.fill();
            }
            for (var i = 0; i < 9; i++) {
                var f = i / 8, yy = y + h / 2 - f * h, ww = w * (0.8 + 0.3 * Math.sin(t * 2 + i));
                var xx = x + Math.sin(t * 1.7 + i * 0.9) * w * 0.18;
                if (night) {
                    ctx.fillStyle = i % 2 ? 'rgba(255,140,40,0.85)' : 'rgba(255,200,90,0.85)';
                } else ctx.fillStyle = i % 2 ? 'rgba(236,240,245,0.92)' : 'rgba(210,218,228,0.92)';
                ctx.beginPath(); circ(ctx, xx, yy, ww * 0.55); ctx.fill();
            }
            if (night) flame(ctx, x, y - h / 2, w * 0.4, t);
            ctx.restore();
        }

        var k = createCore(host, data, api, {
            title: 'عبور البحر', icon: '🌊',
            howto: { kind: 'hold', text: 'دوس مطوّل عشان موسى يمد عصاه والبحر ينشق، وسيب شوية عشان الإيمان يتملي. بعدين حرّك عمود النار لفوق وتحت قدام المركبات.' },
            comboStep: 4, maxMult: 3, pad: [110, 146.8, 220],
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.faith = 1; S.bigPillar = 6; return '💙 الإيمان اتملى + العمود أكبر'; },
            // Night-phase crossings are automatic (flat points, no combo), so they sit outside the combo chain.
            rawMax: function (k) { return k.perfectRaw(TOTAL_G - PH[1].groups + TOTAL_C, 7) + PH[1].groups * 3 + 30; },
            update: function (k, dt, rdt) {
                var g = S.g, ph = S.ph;
                S.clock += dt;
                S.night += ((ph >= 1 ? 1 : 0) - S.night) * Math.min(1, dt * 0.8);
                if (S.bigPillar > 0) S.bigPillar -= dt;
                // sea control
                var target;
                if (ph === 1 || ph === 1.5) target = 1;
                else {
                    var holding = S.hold && S.faith > 0.01;
                    if (S.hold) S.faith = Math.max(0, S.faith - dt * (ph >= 2 ? 0.07 : 0.085));
                    else S.faith = Math.min(1, S.faith + dt * 0.2);
                    if (S.hold && S.faith <= 0.01 && !S.emptyWarn) { S.emptyWarn = true; k.pop(g.W / 2, 70, 'سيب شوية وصلّي… 🙏', '#bfe8ff', 17); }
                    if (!S.hold) S.emptyWarn = false;
                    target = holding ? 1 : 0;
                }
                if (ph >= 0) S.open += (target - S.open) * Math.min(1, dt * (target > S.open ? 2.2 : 1.4));
                // pillar
                if (ph >= 1) S.pillarY += (clamp(S.py, g.lanes[0], g.lanes[2]) - S.pillarY) * Math.min(1, dt * 10);
                // groups
                var qi = 0, sea = g.seaR - g.seaL, vc = sea / 3.1;
                for (var i = 0; i < S.groups.length; i++) {
                    var gr = S.groups[i];
                    gr.t += dt;
                    if (gr.state === 'queue') {
                        var tx = queueX(qi++);
                        if (!gr.x) gr.x = g.W + 30;
                        gr.x += (tx - gr.x) * Math.min(1, dt * 2.5);
                        if (qi === 1 && S.open > 0.75 && Math.abs(gr.x - tx) < 8 && ph >= 0 && ph === Math.floor(ph)) {
                            gr.state = 'cross';
                            if (S.lastGo && S.clock - S.lastGo < 0.7) { gr.state = 'queue'; }
                            else S.lastGo = S.clock;
                        }
                    } else if (gr.state === 'cross') {
                        gr.x -= vc * dt;
                        var prog = (g.seaR - gr.x) / sea;
                        if (S.open < 0.45 && prog > 0 && prog < 0.7) { gr.state = 'back'; k.breakCombo(); k.pop(gr.x, g.cy - g.gs * 1.4, 'ارجعوا!', '#ffd0c0', 15); }
                        if (gr.x <= g.seaL - g.gs) {
                            gr.state = 'done'; S.crossedN++; S.phCrossed++;
                            var sp = sinaiSpot(S.crossedN);
                            gr.sx = sp.x; gr.sy = sp.y;
                            // In the night phase the sea stays open by itself: crossing is not a player action,
                            // so it earns a small flat amount and does not feed the combo (idle play must not out-score active play).
                            if (ph === 1) k.addScore(3, g.seaL, g.cy - g.gs * 1.6, '🙌 ');
                            else k.hit(8, g.seaL, g.cy - g.gs * 1.6, { text: '🙌 ' });
                            k.emit(g.seaL, g.cy, 10, { colors: [C.goldL, '#9dffb0', '#fff'] });
                        }
                    } else if (gr.state === 'back') {
                        gr.x += vc * 1.2 * dt;
                        if (gr.x >= g.qx + g.gs) gr.state = 'queue';
                    }
                }
                // chariots
                while (S.cplan.length && S.cplan[0].t <= S.clock) spawnChariot(S.cplan.shift());
                var reach = g.ph * (S.bigPillar > 0 ? 0.7 : 0.5);
                for (var c = S.chariots.length - 1; c >= 0; c--) {
                    var ch = S.chariots[c];
                    ch.t += dt; ch.spin -= dt * 12;
                    if (ch.state === 'run') {
                        ch.x -= ch.v * dt;
                        // the pillar only burns once the player has moved it this phase (an untouched pillar scores nothing)
                        if (S.moved && ch.x <= g.pX + g.cs * 0.4 && ch.x > g.pX - g.cs && Math.abs(ch.y - S.pillarY) < reach) {
                            ch.state = 'back'; ch.t = 0; ch.noWheel = true; S.blocked++;
                            k.hit(6, ch.x, ch.y - g.cs, { text: '🔥 ' });
                            k.freeze(0.05); k.shake(4, 0.2); k.sfx('fire');
                            k.emit(ch.x, ch.y - g.cs * 0.3, 12, { colors: ['#ffb347', '#ff7a2a', '#4a2c14'], grav: 500 });
                        } else if (ch.x <= g.qx + g.gs * 3) {
                            ch.state = 'back'; ch.t = 0;
                            k.loseLife(ch.x, ch.y - g.cs, 'المركبة قرّبت!');
                            if (k.lives <= 0) { S.ph = 9; k.finish({ lose: true, title: 'متخافش… الرب بيحارب عنكم. جرّب تاني', finaleT: 1.2 }); return; }
                        }
                    } else {
                        ch.x += ch.v * 0.7 * dt;
                        if (ch.t > 1.2) S.chariots.splice(c, 1);
                    }
                }
                if (ph >= 0 && ph === Math.floor(ph)) {
                    if (ph === 0 && S.clock > PH[0].limit && S.phCrossed < S.need) { S.cplan = []; nextAfter(k); return; }
                    if (ph === 2 && S.clock > 55 && !S.cplan.length && !S.chariots.length) { nextAfter(k); return; }
                    if (S.phCrossed >= S.need || phaseDone()) {
                        if (phaseDone() || (ph === 0 && S.phCrossed >= S.need)) nextAfter(k);
                    }
                }
            },
            idle: function (k, dt) { S.open = 0.35 + 0.1 * Math.sin(k.rt); },
            finale: function (k, dt) {
                var g = S.g;
                if (!k.info.win) return;
                var ft = k.stateT + (k.state === 'outro' ? 5.5 : 0);
                if (ft < 1.6) {
                    S.open += (1 - S.open) * Math.min(1, dt * 3);
                    if (!S.fin) {
                        S.fin = true;
                        for (var i = 0; i < 3; i++) S.chariots.push({ x: g.seaR + g.cs * (1 + i * 1.6), y: g.cy + (i - 1) * g.mh * 0.4, state: 'run', t: 0, spin: 0, v: g.W * 0.2, sea: true });
                    }
                } else {
                    if (!S.closed) { S.closed = true; k.sfx('splash'); k.shake(6, 0.6); }
                    S.open = Math.max(0, S.open - dt * 1.2);
                    S.song = Math.min(1, S.song + dt * 0.6);
                }
                for (var c = S.chariots.length - 1; c >= 0; c--) {
                    var ch = S.chariots[c];
                    ch.spin -= dt * 12;
                    if (ch.sea) {
                        ch.x -= ch.v * dt;
                        if (S.open < 0.3) { k.emit(ch.x, ch.y, 14, { colors: ['#e6f6ff', '#9fd0f0', '#fff'], grav: 300 }); S.chariots.splice(c, 1); }
                    } else { ch.t += dt; ch.x += ch.v * 0.7 * dt; if (ch.t > 1.2) S.chariots.splice(c, 1); }
                }
            },
            down: function (k, p) { S.hold = true; S.py = p.y; S.moved = true; },
            move: function (k, p) { if (k.pdown) { S.py = p.y; S.moved = true; } },
            up: function (k) { S.hold = false; },
            key: function (k, key, isDown) {
                if (key === ' ') { S.hold = isDown; return true; }
                if (!isDown) return false;
                var g = S.g, li = 0, bd = 1e9;
                for (var i = 0; i < 3; i++) if (Math.abs(g.lanes[i] - S.py) < bd) { bd = Math.abs(g.lanes[i] - S.py); li = i; }
                if (key === 'ArrowUp') { S.py = g.lanes[Math.max(0, li - 1)]; S.moved = true; return true; }
                if (key === 'ArrowDown') { S.py = g.lanes[Math.min(2, li + 1)]; S.moved = true; return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, half = S.open * g.mh, t = k.rt;
                blit(ctx, S.bg, 0, 0);
                // moving wave highlights
                ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
                for (var wv = 0; wv < 8; wv++) {
                    var wy = ((wv / 8 + t * 0.02) % 1) * H, wx = g.seaL + ((wv * 97) % (g.seaR - g.seaL));
                    ctx.beginPath(); ctx.arc(wx, wy, 10, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
                }
                // dry corridor with water walls
                if (half > 1) {
                    var top = g.cy - half, bot = g.cy + half, wl = g.seaL - 4, wr = g.seaR + 4;
                    ctx.fillStyle = vgrad(ctx, top, bot, ['#b08a55', '#c9a36a', '#b08a55']); ctx.fillRect(wl, top, wr - wl, bot - top);
                    ctx.fillStyle = 'rgba(90,60,30,0.25)'; for (var sx = wl; sx < wr; sx += 26) ctx.fillRect(sx, g.cy - 1, 12, 2);
                    var wall = Math.min(18, half * 0.35);
                    ctx.fillStyle = vgrad(ctx, top - wall, top, ['#2b86c2', '#6cc0ea']); ctx.fillRect(wl, top - wall, wr - wl, wall);
                    ctx.fillStyle = vgrad(ctx, bot, bot + wall, ['#6cc0ea', '#1d6a9e']); ctx.fillRect(wl, bot, wr - wl, wall);
                    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (var fx = wl; fx <= wr; fx += 10) ctx.lineTo(fx, top - wall + Math.sin(fx * 0.08 + t * 5) * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    for (var fx2 = wl; fx2 <= wr; fx2 += 10) ctx.lineTo(fx2, bot + wall + Math.sin(fx2 * 0.08 - t * 5) * 2);
                    ctx.stroke();
                    // fish in the walls
                    ctx.fillStyle = 'rgba(20,50,80,0.45)';
                    for (var fi = 0; fi < S.fishes.length; fi++) {
                        var fh = S.fishes[fi], fxx = g.seaL + ((fh.u + t * fh.v) % 1) * (g.seaR - g.seaL), fyy = fh.side < 0 ? top - wall * fh.d : bot + wall * fh.d;
                        ctx.beginPath(); ell(ctx, fxx, fyy, 6, 2.5); ctx.moveTo(fxx + 5, fyy); ctx.lineTo(fxx + 10, fyy - 3); ctx.lineTo(fxx + 10, fyy + 3); ctx.fill();
                    }
                }
                // people crossed on Sinai (Miriam's tambourines in the finale)
                var dance = (k.state === 'finale' || k.state === 'outro') && k.info && k.info.win;
                for (var d = 0; d < S.groups.length; d++) {
                    var gd = S.groups[d];
                    if (gd.state !== 'done') continue;
                    for (var m = 0; m < gd.mem.length; m++) {
                        var mm = gd.mem[m], jump = dance ? Math.abs(Math.sin(t * 5 + mm.ph)) * 5 : 0;
                        tinyPerson(ctx, gd.sx + mm.dx * g.gs, gd.sy + mm.dy * g.gs - jump, g.gs * 0.9 * mm.h, mm.c, '#3a2414', -1, -1);
                        if (dance && m === 0) { ctx.fillStyle = C.gold; ctx.beginPath(); circ(ctx, gd.sx + mm.dx * g.gs + 6, gd.sy + mm.dy * g.gs - g.gs * 0.9 - jump, 3.5); ctx.fill(); }
                    }
                }
                // groups in queue / crossing
                for (var i = 0; i < S.groups.length; i++) {
                    var gr = S.groups[i];
                    if (gr.state === 'done' || !gr.x) continue;
                    var moving = gr.state !== 'queue' || Math.abs(gr.x - queueX(0)) > 8;
                    for (var j = 0; j < gr.mem.length; j++) {
                        var me = gr.mem[j];
                        tinyPerson(ctx, gr.x + me.dx * g.gs, g.cy + me.dy * g.gs * 1.2 + g.gs * 0.3, g.gs * 0.9 * me.h, me.c, '#3a2414', moving ? t * 10 + me.ph : -1, gr.state === 'back' ? 1 : -1);
                    }
                    if (gr.sheep) sheep(ctx, gr.x + g.gs * 0.9, g.cy + g.gs * 0.5, g.gs / 30, gr.state === 'back' ? 1 : -1, t);
                }
                // Moses on the Egyptian shore, staff stretched over the sea
                var stretch = S.ph === 1 || S.ph === 1.5 ? 0.6 : S.open;
                figure(ctx, { x: g.seaR + g.gs * 0.9, y: g.cy - g.mh - g.gs * 0.9, h: clamp(H * 0.26, 60, 120), dir: -1, robe: '#e9dcc0', mantle: '#8e1f1f', hair: '#6b5a48', beard: 1, beardColor: '#d8d2c8', halo: true, arm: lerp(0.4, 2.1, stretch), prop: 'rod', t: t, dpr: k.dpr });
                // night tint
                if (S.night > 0.02) { ctx.fillStyle = 'rgba(8,12,40,' + (0.45 * S.night) + ')'; ctx.fillRect(0, 0, W, H); }
                // chariots and pillar
                for (var c = 0; c < S.chariots.length; c++) drawChariot(ctx, S.chariots[c], g, t);
                if (S.ph >= 1 && S.ph < 9) drawPillar(ctx, g, t, S.night > 0.5);
                if (S.ph >= 1 && S.ph < 9 && S.clock < 4 && S.ph === Math.floor(S.ph)) {
                    ctx.globalAlpha = clamp(4 - S.clock, 0, 1);
                    txt(ctx, S.ph === 1 ? 'حرّك العمود لفوق وتحت ↕' : 'دوس مطوّل + حرّك لفوق وتحت', W * 0.8, g.lanes[0] - 34, font(15, 900), '#fff', 'center', 4);
                    ctx.globalAlpha = 1;
                }
                // faith meter
                if (S.ph === 0 || S.ph === 2) {
                    var bw = Math.min(W * 0.3, 220), bx = (W - bw) / 2, by = 16;
                    ctx.fillStyle = 'rgba(20,10,4,0.55)'; rr(ctx, bx - 4, by - 4, bw + 8, 18, 9); ctx.fill();
                    ctx.fillStyle = S.faith < 0.25 ? '#e0443a' : '#5fb3d9'; rr(ctx, bx, by, bw * S.faith, 10, 5); ctx.fill();
                    txt(ctx, 'الإيمان', bx + bw + 30, by + 5, font(12, 900), '#fff', 'center', 3);
                    drawCross(ctx, bx - 14, by + 5, 8, C.gold, k.dpr);
                }
                // the song of Moses (finale)
                if (S.song > 0 && data.outro && data.outro.verse) {
                    var sa = eo(S.song), sw = Math.min(W * 0.8, 600), sh = clamp(H * 0.22, 60, 90);
                    ctx.save(); ctx.globalAlpha = sa;
                    ctx.fillStyle = 'rgba(251,241,216,0.95)'; rr(ctx, (W - sw) / 2, H * 0.08, sw, sh, 14); ctx.fill();
                    ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
                    drawCross(ctx, (W - sw) / 2 + 20, H * 0.08 + sh / 2, 11, C.red, k.dpr);
                    drawCross(ctx, (W + sw) / 2 - 20, H * 0.08 + sh / 2, 11, C.red, k.dpr);
                    block(ctx, '«' + plain(data.outro.verse) + '»', W / 2, H * 0.08 + sh / 2, sw - 70, sh - 12, clamp(sh * 0.22, 13, 19), 900, '#3c1a08', 2);
                    ctx.restore();
                }
            }
        });
        return k.api2();
    }

    /* ======================================================================
     * 5. gideon -- the 300 torches
     * Rhythm lanes (jar / trumpet / torch) over a night scene: the Midianite
     * camp in the valley, Gideon's men on the hills. Every good hit lights more
     * torches on the hillside; streaks light a whole hill and the camp panics.
     * Three sections with rising tempo; section 3 adds chords and ends with the
     * all-lanes shout (twist). No lives. Data: lanes, questions, intro, outro,
     * facts, phases.
     * ==================================================================== */
    function gideon(host, data, api) {
        data = data || {};
        var lanes = (data.lanes && data.lanes.length >= 3) ? data.lanes.slice(0, 3) : ['🏺 الجرة', '📯 البوق', '🔥 المصباح'];
        var laneIcon = lanes.map(function (l) { return String(l).split(' ')[0]; });
        var laneWord = lanes.map(function (l) { var p = String(l).split(' '); return p.length > 1 ? p.slice(1).join(' ') : p[0]; });
        var LC = [['#e8a15c', '#9c5a1c'], ['#ffd43b', '#b8860b'], ['#ff6b3d', '#b8341d']];
        var SND = ['jar', 'horn', 'fire'];
        var SEC = [{ bpm: 84, beats: 22, travel: 1.7, eighth: 0, chord: 0 }, { bpm: 96, beats: 28, travel: 1.5, eighth: 0.25, chord: 0 }, { bpm: 108, beats: 32, travel: 1.35, eighth: 0.3, chord: 0.22 }];
        var PERFECT = 0.075, GOOD = 0.15, WINDOW = 0.22;
        var charts = SEC.map(buildChart);
        var NOTES = charts.reduce(function (a, c) { return a + c.length; }, 0);
        var S = { sec: -1, song: 0, notes: [], beatN: -1, lit: 0, press: [0, 0, 0], flashL: [0, 0, 0], perfect: 0, good: 0, miss: 0,
            golden: 0, streak: 0, panic: 0, playing: false, torches: [], hill: 0, shout: 0 };

        function buildChart(sec, si) {
            var out = [], beat = 60 / sec.bpm, t = 1.2, last = -1;
            for (var b = 0; b < sec.beats; b++) {
                var final = si === 2 && b >= sec.beats - 4;
                if (final) { for (var l = 0; l < 3; l++) out.push({ t: t, lane: l, done: false, chord: true }); t += beat; continue; }
                var on = si === 0 ? (b % 2 === 0 || b > 14) : true;
                if (on) {
                    var ln = Math.floor(Math.random() * 3);
                    if (ln === last && Math.random() < 0.6) ln = (ln + 1) % 3;
                    last = ln;
                    out.push({ t: t, lane: ln, done: false });
                    if (sec.chord && Math.random() < sec.chord) out.push({ t: t, lane: (ln + 1 + Math.floor(Math.random() * 2)) % 3, done: false, chord: true });
                    else if (sec.eighth && Math.random() < sec.eighth) out.push({ t: t + beat / 2, lane: (ln + 2) % 3, done: false });
                }
                t += beat;
            }
            out.sort(function (a, b2) { return a.t - b2.t; });
            return out;
        }
        function G(k) {
            var W = k.W, H = k.H, land = W >= H * 1.2;
            var LW = land ? Math.min(W * 0.46, 440) : W * 0.94, x0 = (W - LW) / 2, lw = LW / 3;
            var btnH = clamp(H * 0.2, 54, 92), hitY = H - btnH - 12, topY = 44;
            return { W: W, H: H, land: land, LW: LW, x0: x0, lw: lw, btnH: btnH, hitY: hitY, topY: topY, nr: Math.min(lw * 0.28, 28) };
        }
        function laneX(g, i) { return g.x0 + g.LW - (i + 0.5) * g.lw; }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H, dpr = k.dpr;
            S.g = g;
            S.bg = layer(W, H, dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#070a24', '#141a45', '#2a2358']); x.fillRect(0, 0, W, H);
                var r = seeded(77);
                for (var i = 0; i < 120; i++) { x.fillStyle = 'rgba(255,250,225,' + (0.25 + r() * 0.75) + ')'; x.beginPath(); circ(x, r() * W, r() * H * 0.55, 0.5 + r() * 1.3); x.fill(); }
                x.fillStyle = '#fbf3d0'; x.beginPath(); circ(x, W * 0.86, H * 0.16, 13); x.fill();
                x.fillStyle = '#141a45'; x.beginPath(); circ(x, W * 0.86 + 6, H * 0.16 - 3, 11); x.fill();
                ridge(x, W, H * 0.55, H * 0.16, 91, 3, H); x.fillStyle = '#1a1838'; x.fill();
                // valley floor and the Midianite camp
                x.fillStyle = '#110f26'; x.fillRect(0, H * 0.7, W, H * 0.3);
            });
            S.hills = layer(W, H, dpr, function (x) {
                x.fillStyle = '#0b0a1c';
                x.beginPath(); x.moveTo(0, H * 0.42); x.quadraticCurveTo(W * 0.18, H * 0.34, W * 0.3, H * 0.62); x.lineTo(W * 0.3, H); x.lineTo(0, H); x.closePath(); x.fill();
                x.beginPath(); x.moveTo(W, H * 0.4); x.quadraticCurveTo(W * 0.82, H * 0.33, W * 0.7, H * 0.62); x.lineTo(W * 0.7, H); x.lineTo(W, H); x.closePath(); x.fill();
            });
            // 300 torch spots on the two hills (seeded)
            S.torches = [];
            var r2 = seeded(300);
            for (var t = 0; t < 300; t++) {
                var left = t % 2 === 0, u = r2(), v = r2();
                var tx = left ? u * W * 0.28 : W - u * W * 0.28;
                var crest = left ? lerp(H * 0.42, H * 0.6, u) : lerp(H * 0.4, H * 0.6, u);
                S.torches.push({ x: tx, y: crest + 6 + v * (H - crest - 10), f: r2() * TAU });
            }
            S.glow = cached('tg', 16, 16, dpr, function (x) {
                var gr = x.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, 'rgba(255,230,150,1)'); gr.addColorStop(0.35, 'rgba(255,150,50,0.8)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
                x.fillStyle = gr; x.fillRect(0, 0, 16, 16);
            });
        }
        function light(k, n) {
            var before = S.lit;
            S.lit = Math.min(300, S.lit + n);
            if (before < 300 && S.lit >= 300) { k.pop(k.W / 2, k.H * 0.3, '٣٠٠ مصباح منوّرين! +٢٠', C.goldL, 22); k.addScore(20); k.sfx('win'); }
        }
        function startSec(k, i) {
            S.sec = i; S.song = -1.2; S.notes = charts[i]; S.beatN = -1; S.playing = true;
            k.phaseCard(i + 1);
            k.after(0.8, function () { k.fact(5); });
        }
        function endSec(k) {
            S.playing = false;
            var i = S.sec;
            if (i >= 2) { k.finish({ title: 'الرب أعطى النصرة! 🔥', finaleT: 3.6 }); return; }
            k.after(0.8, function () { k.checkpoint(function () { startSec(k, i + 1); }); });
        }
        function judge(k, lane) {
            var g = S.g;
            S.press[lane] = 1;
            if (!S.playing) return;
            var best = null, bd = 1e9;
            for (var i = 0; i < S.notes.length; i++) {
                var n = S.notes[i];
                if (n.done || n.lane !== lane) continue;
                var d = Math.abs(n.t - S.song);
                if (d < bd) { bd = d; best = n; }
                if (n.t > S.song + WINDOW) break;
            }
            var x = laneX(g, lane), y = g.hitY - 40;
            if (!best || bd > WINDOW) { k.sfx('tap'); return; }
            best.done = true;
            var gold = S.golden > 0 ? 2 : 1;
            if (S.golden > 0) S.golden--;
            if (bd <= PERFECT) {
                S.perfect++; S.streak++;
                k.hit(10 * gold, x, y, { text: 'ممتاز! ', color: C.goldL, silent: true, size: 18 });
                k.sfx(SND[lane]); light(k, 4);
                k.emit(x, g.hitY, 12, { colors: [LC[lane][0], '#fff', C.goldL] });
                S.flashL[lane] = 1;
                if (S.streak > 0 && S.streak % 8 === 0) {
                    light(k, 18); S.hill = 1;
                    k.pop(k.W / 2, k.H * 0.2, 'التل كله نوّر! 🔥', '#ffb347', 20);
                    k.glyphBurst(lane === 0 ? k.W * 0.85 : k.W * 0.15, k.H * 0.55, 6);
                }
            } else if (bd <= GOOD) {
                S.good++; S.streak = 0;
                k.hit(6 * gold, x, y, { text: 'حلو! ', color: '#9dffb0', silent: true, size: 17 });
                k.sfx(SND[lane]); light(k, 2);
                k.emit(x, g.hitY, 6, { colors: [LC[lane][0], '#fff'] });
            } else {
                S.miss++; S.streak = 0;
                k.breakCombo();
                k.pop(x, y, best.t > S.song ? 'بدري!' : 'متأخر!', '#ffb0a0', 16);
            }
        }
        function laneAt(p) {
            var g = S.g;
            if (p.x < g.x0 - 20 || p.x > g.x0 + g.LW + 20 || p.y < g.topY) return -1;
            var i = Math.floor((g.x0 + g.LW - p.x) / g.lw);
            return clamp(i, 0, 2);
        }

        var k = createCore(host, data, api, {
            title: 'مصابيح جدعون', icon: '🔥',
            howto: { kind: 'lanes', text: 'لما العلامة توصل للخط اضغط على زرارها: اكسر الجرة، انفخ البوق، ارفع المصباح. كل ضربة في وقتها بتنوّر مصابيح على التل.' },
            lives: 0, comboStep: 6, maxMult: 4, pad: [98, 146.8],
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startSec(k, 0); },
            reward: function (k) { S.golden = 8; return '📯 البوق الذهبي: ٨ ضربات بالضعف'; },
            rawMax: function (k) { return NOTES * 10 * 2 + 50; },
            update: function (k, dt, rdt) {
                var g = S.g;
                for (var l = 0; l < 3; l++) { S.press[l] = Math.max(0, S.press[l] - rdt * 6); S.flashL[l] = Math.max(0, S.flashL[l] - rdt * 3); }
                if (S.hill > 0) S.hill = Math.max(0, S.hill - rdt * 0.8);
                S.panic += (clamp(S.lit / 300 + k.mult() * 0.05, 0, 1) - S.panic) * Math.min(1, dt);
                if (!S.playing) return;
                var sec = SEC[S.sec], beat = 60 / sec.bpm;
                S.song += dt;
                var bn = Math.floor(S.song / beat);
                if (bn !== S.beatN && S.song >= 0) { S.beatN = bn; k.sfx('drum'); }
                var allDone = true;
                for (var i = 0; i < S.notes.length; i++) {
                    var n = S.notes[i];
                    if (n.done) continue;
                    allDone = false;
                    if (S.song - n.t > WINDOW) {
                        n.done = true; S.miss++; S.streak = 0;
                        k.breakCombo();
                        k.pop(laneX(g, n.lane), g.hitY - 30, 'فاتت', 'rgba(255,190,170,0.9)', 14);
                    }
                }
                if (allDone && S.song > (S.notes.length ? S.notes[S.notes.length - 1].t : 0) + 0.8) endSec(k);
            },
            finale: function (k, dt) {
                if (!k.info.win) return;
                S.shout = Math.min(1, S.shout + dt * 0.8);
                S.lit = Math.min(300, S.lit + dt * 140);
                S.panic = Math.min(1, S.panic + dt);
            },
            down: function (k, p) { var l = laneAt(p); if (l >= 0) judge(k, l); },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                var map = { '1': 0, '2': 1, '3': 2, ArrowRight: 0, ArrowUp: 1, ArrowDown: 1, ' ': 1, ArrowLeft: 2 };
                if (map[key] != null) { judge(k, map[key]); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt;
                blit(ctx, S.bg, 0, 0);
                // camp tents in the valley, shaking with panic
                var pan = S.panic;
                for (var ti = 0; ti < 9; ti++) {
                    var tx = W * (0.12 + ti * 0.095), ty = H * 0.72 + (ti % 2) * 8, wob = Math.sin(t * 20 + ti) * pan * 3;
                    ctx.fillStyle = '#2a2140';
                    ctx.beginPath(); ctx.moveTo(tx - 16 + wob, ty); ctx.lineTo(tx + wob * 1.5, ty - 20); ctx.lineTo(tx + 16 + wob, ty); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = 'rgba(255,140,50,' + (0.3 + 0.2 * Math.sin(t * 7 + ti)) + ')'; ctx.beginPath(); circ(ctx, tx + 20, ty - 2, 2.2); ctx.fill();
                }
                if (pan > 0.3) {
                    for (var rn = 0; rn < 6; rn++) {
                        var px = ((t * 60 * (0.6 + rn * 0.1) + rn * 140) % (W * 1.2)) - W * 0.1;
                        tinyPerson(ctx, px, H * 0.8 + (rn % 3) * 6, 16, '#1a1628', '#0a0a12', t * 14 + rn, 1);
                    }
                }
                blit(ctx, S.hills, 0, 0);
                // torches
                var n = Math.floor(S.lit), gs = S.glow;
                for (var i = 0; i < n; i++) {
                    var to = S.torches[i], fl = 0.65 + 0.35 * Math.sin(t * 9 + to.f);
                    var sz = 6 + fl * 5 + S.hill * 4;
                    ctx.globalAlpha = fl;
                    ctx.drawImage(gs, to.x - sz / 2, to.y - sz / 2, sz, sz);
                }
                ctx.globalAlpha = 1;
                // Gideon on the right hill
                if (g.land) {
                    var gh = clamp(H * 0.36, 80, 150), act = Math.max(S.press[0], S.press[1], S.press[2]);
                    figure(ctx, { x: W - (W - g.LW) / 4, y: H - 8, h: gh, dir: -1, robe: '#cdb89a', mantle: '#7c3a28', hair: '#3a2414', beard: 0.8, arm: 2.3 + act * 0.4, arm2: 1.2, prop: 'torch', t: t, dpr: k.dpr });
                    txt(ctx, ar(Math.floor(S.lit)) + ' / ٣٠٠', (W - g.LW) / 4, H - 20, font(15, 900), C.goldL, 'center', 4);
                    drawCross(ctx, (W - g.LW) / 4, H - 44, 10, C.gold, k.dpr);
                }
                // lanes
                for (var l = 0; l < 3; l++) {
                    var lx = laneX(g, l);
                    ctx.fillStyle = 'rgba(20,12,40,' + (0.45 + S.flashL[l] * 0.2) + ')';
                    ctx.fillRect(lx - g.lw / 2 + 2, g.topY, g.lw - 4, g.hitY - g.topY + g.btnH);
                    if (S.flashL[l] > 0) { ctx.fillStyle = 'rgba(255,200,90,' + S.flashL[l] * 0.25 + ')'; ctx.fillRect(lx - g.lw / 2 + 2, g.topY, g.lw - 4, g.hitY - g.topY); }
                }
                // hit line with Coptic frieze
                var fr = friezeSprite(10, k.dpr, C.gold, 'rgba(80,20,10,0.8)');
                ctx.save(); ctx.beginPath(); ctx.rect(g.x0, g.hitY - 5, g.LW, 10); ctx.clip(); blitTiled(ctx, fr, 0, g.hitY - 5, W); ctx.restore();
                // notes
                if (S.playing || S.sec >= 0) {
                    var travel = SEC[Math.max(0, S.sec)].travel;
                    for (var ni = 0; ni < S.notes.length; ni++) {
                        var no = S.notes[ni];
                        if (no.done) continue;
                        var f = 1 - (no.t - S.song) / travel;
                        if (f < 0) break;
                        var nx = laneX(g, no.lane), ny = lerp(g.topY, g.hitY, f), r = g.nr * (0.8 + 0.2 * f);
                        var gold = S.golden > 0;
                        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); circ(ctx, nx + 2, ny + 3, r); ctx.fill();
                        ctx.fillStyle = vgrad(ctx, ny - r, ny + r, gold ? ['#fff3b0', '#e2b34d'] : [LC[no.lane][0], LC[no.lane][1]]);
                        ctx.beginPath(); circ(ctx, nx, ny, r); ctx.fill();
                        ctx.strokeStyle = no.chord ? '#fff' : 'rgba(255,240,200,0.7)'; ctx.lineWidth = no.chord ? 3 : 1.5; ctx.stroke();
                        emo(ctx, laneIcon[no.lane], nx, ny + 1, r * 1.1);
                    }
                }
                // buttons
                for (var b = 0; b < 3; b++) {
                    var bx = laneX(g, b), bw = g.lw - 10, by = g.hitY + 8, pr = S.press[b];
                    ctx.save(); ctx.translate(bx, by + g.btnH / 2 - 4); ctx.scale(1 - pr * 0.06, 1 - pr * 0.06);
                    ctx.fillStyle = vgrad(ctx, -g.btnH / 2, g.btnH / 2, pr > 0 ? ['#fff3c4', LC[b][0]] : [LC[b][0], LC[b][1]]);
                    rr(ctx, -bw / 2, -g.btnH / 2 + 4, bw, g.btnH - 8, 14); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
                    emo(ctx, laneIcon[b], 0, -g.btnH * 0.1, g.btnH * 0.32);
                    txt(ctx, laneWord[b], 0, g.btnH * 0.26, font(clamp(g.btnH * 0.18, 11, 15), 900), '#fff', 'center', 3);
                    ctx.restore();
                }
                if (S.golden > 0) txt(ctx, '📯 ذهبي ×٢  (' + ar(S.golden) + ')', W / 2, g.topY + 12, font(13, 900), C.goldL, 'center', 3);
                // the shout (finale)
                if (S.shout > 0 && data.outro && data.outro.verse) {
                    var sa = eob(Math.min(1, S.shout * 1.4));
                    ctx.save(); ctx.globalAlpha = clamp(S.shout * 2, 0, 1);
                    ctx.translate(W / 2, H * 0.3); ctx.scale(sa, sa);
                    block(ctx, '«' + plain(data.outro.verse) + '»', 0, 0, W * 0.8, H * 0.2, clamp(H * 0.09, 20, 38), 900, '#ffe7a3', 2);
                    ctx.restore();
                }
            }
        });
        return k.api2();
    }

    /* ======================================================================
     * 6. sling -- David in the valley of Elah
     * Pull back anywhere and release to sling a smooth stone (five per round).
     * Phase 1: warm-up -- a lion and a bear go for the flock; hit them so they run.
     * Phase 2: answer targets -- the options of a question become moving targets.
     * Phase 3 (boss): Goliath; each correct answer breaks a piece of his armour
     *          (helmet, then his shield bearer runs), then hit his forehead.
     * Data: questions, intro, outro, facts, phases.
     * ==================================================================== */
    function sling(host, data, api) {
        data = data || {};
        var all = shuffle(validQuestions(data.questions));
        var tq = all.slice(0, Math.min(4, Math.max(0, all.length - 2)));
        if (!tq.length && all.length) tq = all.slice(0, 1);
        var askQ = all.slice(tq.length);
        if (askQ.length < 2) askQ = askQ.concat(tq).slice(0, Math.max(2, askQ.length));
        var nBoss = tq.length >= 2 ? Math.min(2, tq.length - 1) : 0;
        var normalQ = tq.slice(0, tq.length - nBoss), bossQ = tq.slice(tq.length - nBoss);
        var BEASTS = 5, STONES = 5, QTIME = 20;
        var S = { ph: -1, mode: 'idle', stones: STONES, stone: null, aim: null, beasts: [], bSpawn: 0, bLeft: 0,
            q: null, targets: [], qT: 0, res: null, resT: 0, qi: 0, guide: false, extra: 0,
            gol: null, fall: 0, clouds: 0, correct: 0 };

        function G(k) {
            var W = k.W, H = k.H, u = Math.min(W, H), land = W >= H * 1.2;
            var ground = H * 0.9, ds = clamp(H * 0.26, 64, 130);
            var dx = W * (land ? 0.87 : 0.82);
            var grav = u * 2.6, vmax = Math.sqrt(Math.max(1.9 * H, 1.05 * W) * grav), maxPull = clamp(u * 0.3, 70, 150);
            var qh = clamp(H * 0.16, 42, 64);
            return { W: W, H: H, u: u, land: land, ground: ground, ds: ds, dx: dx, ancX: dx - ds * 0.12, ancY: ground - ds * 0.78,
                grav: grav, K: vmax / maxPull, maxPull: maxPull, sr: clamp(u * 0.018, 5, 9), qh: qh, qTop: 46,
                tTop: 46 + qh + 10, tBot: ground - 10, tw: land ? clamp(W * 0.26, 140, 250) : clamp(W * 0.44, 120, 200), tx0: W * 0.05, flockX: W * 0.58 };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H, dpr = k.dpr;
            S.g = g;
            S.bg = layer(W, H, dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#7fc2ee', '#cfe9f7', '#f6e7c4']); x.fillRect(0, 0, W, H);
                // Philistine hill (left) and Israel's hill (right), the valley between
                x.fillStyle = '#b99a62';
                x.beginPath(); x.moveTo(0, H * 0.42); x.quadraticCurveTo(W * 0.22, H * 0.36, W * 0.42, H * 0.7); x.lineTo(0, H * 0.7); x.closePath(); x.fill();
                x.fillStyle = '#a8b770';
                x.beginPath(); x.moveTo(W, H * 0.44); x.quadraticCurveTo(W * 0.8, H * 0.38, W * 0.58, H * 0.7); x.lineTo(W, H * 0.7); x.closePath(); x.fill();
                for (var i = 0; i < 5; i++) {
                    var lx = W * (0.04 + i * 0.05), ly = H * (0.44 + i * 0.02);
                    x.fillStyle = '#8e2b1f'; x.beginPath(); x.moveTo(lx - 10, ly); x.lineTo(lx, ly - 13); x.lineTo(lx + 10, ly); x.fill();
                    var rx = W * (0.96 - i * 0.05), ry = H * (0.46 + i * 0.02);
                    x.fillStyle = '#eef1f5'; x.beginPath(); x.moveTo(rx - 10, ry); x.lineTo(rx, ry - 13); x.lineTo(rx + 10, ry); x.fill();
                    x.strokeStyle = '#3b5f86'; x.lineWidth = 1; x.stroke();
                }
                x.fillStyle = vgrad(x, H * 0.66, H, ['#9fb36a', '#86994f', '#6f8a3a']); x.fillRect(0, H * 0.66, W, H * 0.34);
                // the brook with smooth stones
                x.fillStyle = 'rgba(80,150,200,0.75)';
                x.beginPath(); x.moveTo(W * 0.6, H); x.quadraticCurveTo(W * 0.66, H * 0.8, W * 0.74, H * 0.7); x.lineTo(W * 0.77, H * 0.7); x.quadraticCurveTo(W * 0.7, H * 0.82, W * 0.68, H); x.closePath(); x.fill();
                var r = seeded(5);
                for (var s = 0; s < 14; s++) { x.fillStyle = ['#d6d0c4', '#bdb5a6', '#e6e0d4'][s % 3]; x.beginPath(); ell(x, W * (0.62 + r() * 0.12), H * (0.8 + r() * 0.18), 4 + r() * 3, 2.5 + r() * 2); x.fill(); }
            });
            S.cloud = layer(W, Math.round(H * 0.3), dpr, function (x, w, h) {
                var r = seeded(12);
                x.fillStyle = 'rgba(255,255,255,0.8)';
                for (var i = 0; i < 8; i++) { var cx = r() * w, cy = h * (0.3 + r() * 0.4); for (var j = -1; j <= 1; j++) { x.beginPath(); circ(x, cx + j * w, cy, 14 + r() * 12); circ(x, cx + j * w + 18, cy + 4, 12 + r() * 8); x.fill(); } }
            });
        }
        function startPhase(k, n) {
            S.ph = n;
            k.phaseCard(n + 1);
            if (n === 0) {
                k.after(1.2, function () { k.fact(5.5); });
                S.mode = 'beasts'; S.bLeft = BEASTS; S.bSpawn = 3; S.stones = STONES;
            } else if (n === 1) {
                S.qi = 0; k.after(2.2, function () { nextQ(k); });
                S.mode = 'wait';
            } else {
                S.mode = 'bossIntro'; S.gol = { x: -0.25, tx: 0.1, helmet: true, bearer: true, hit: 0, bx: 0 }; S.qi = 0; S.fall = 0;
                k.after(1.4, function () { k.fact(5); }); k.sfx('thud'); k.shake(5, 0.5);
                k.after(6.6, function () { nextQ(k); });
            }
        }
        function nextQ(k) {
            var list = S.ph === 1 ? normalQ : bossQ;
            S.stone = null; S.aim = null;
            if (S.qi >= list.length) {
                if (S.ph === 1) { S.mode = 'wait'; k.after(0.4, function () { k.checkpoint(function () { startPhase(k, 2); }); }); }
                else { S.mode = 'forehead'; S.stones = STONES + S.extra; S.qT = 0; k.pop(k.W / 2, S.g.tTop + 20, 'اضرب جبهته! 🎯', C.goldL, 24); k.sfx('tier'); }
                return;
            }
            S.q = list[S.qi++];
            S.mode = 'q'; S.qT = 0; S.stones = STONES + (S.ph === 2 ? S.extra : 0);
            S.targets = S.q.options.slice(0, 4).map(function (o, i) { return { text: plain(o), i: i, ph: rand(0, TAU), spd: rand(1, 1.6), state: 0 }; });
        }
        function targetRect(k, t, n) {
            var g = S.g, slot = (g.tBot - g.tTop) / n, th = Math.min(slot * 0.8, 58);
            var boss = S.ph === 2 ? 1.5 : 1;
            var cy = g.tTop + slot * (t.i + 0.5) + Math.sin(k.t * t.spd * boss + t.ph) * (slot - th) * 0.45;
            var x = g.tx0 + (g.land ? (t.i % 2) * g.W * 0.06 : 0) + (S.ph === 2 ? g.W * 0.12 + Math.sin(k.t * 1.2 + t.ph) * g.W * 0.03 : 0);
            return { x: x, y: cy - th / 2, w: g.tw, h: th };
        }
        function showResult(k, ok, why) {
            var q = S.q;
            S.mode = 'result'; S.resT = 0;
            S.res = { ok: ok, why: why, answer: plain(q.options[q.correct]), explain: plain(q.explain || '') };
            if (!ok && S.ph === 2 && S.gol) S.gol.tx = Math.min(0.34, S.gol.tx + 0.08);
        }
        function hitTarget(k, t, r) {
            var q = S.q, g = S.g;
            if (t.i === q.correct) {
                S.correct++;
                t.state = 1;
                var pts = (S.ph === 2 ? 25 : 20) + Math.round(8 * clamp(1 - S.qT / QTIME, 0, 1));
                k.addScore(pts, r.x + r.w / 2, r.y - 8, '🎯 ');
                k.combo++; k.hud();
                k.sfx('tier'); k.fx(r.x + r.w / 2, r.y + r.h / 2, 20);
                if (S.ph === 2 && S.gol) {
                    k.shake(9, 0.4); k.freeze(0.1);
                    if (S.gol.helmet) { S.gol.helmet = false; S.gol.helmetFly = 0; k.pop(k.W * 0.3, g.ground - g.H * 0.6, 'الخوذة وقعت!', C.goldL, 20); }
                    else if (S.gol.bearer) { S.gol.bearer = false; S.gol.bearerRun = 0; k.pop(k.W * 0.3, g.ground - g.H * 0.3, 'حامل الترس هرب!', C.goldL, 20); }
                    k.emit(k.W * 0.3, g.ground - g.H * 0.5, 22, { colors: ['#c9a05a', '#8a6a3a', '#fff'], grav: 500 });
                }
                showResult(k, true);
            } else {
                t.state = -1;
                k.loseLife(r.x + r.w / 2, r.y - 8, 'مش دي!');
                showResult(k, false, 'wrong');
            }
        }
        function golHead(k) {
            var g = S.g, gh = clamp(g.H * 0.62, 150, 320), gx = g.W * (0.08 + S.gol.x * 1.0) + g.W * 0.1;
            return { x: gx + gh * 0.03, y: g.ground - gh * 0.86, r: gh * 0.06, gh: gh, gx: gx };
        }
        function launch(k, a) {
            var g = S.g;
            var dx = a.x - a.sx, dy = a.y - a.sy, len = Math.sqrt(dx * dx + dy * dy);
            if (len > g.maxPull) { dx *= g.maxPull / len; dy *= g.maxPull / len; len = g.maxPull; }
            return { vx: -dx * g.K, vy: -dy * g.K, len: len, px: g.ancX + dx, py: g.ancY + dy };
        }
        function canShoot() { return !S.stone && S.stones > 0 && (S.mode === 'beasts' || S.mode === 'q' || S.mode === 'forehead'); }
        function outOfStones(k) {
            if (S.mode === 'q') showResult(k, false, 'stones');
            else if (S.mode === 'forehead') { S.gol.tx = Math.min(0.4, S.gol.tx + 0.1); S.stones = STONES; k.pop(k.W * 0.8, S.g.ancY - 40, 'حجارة جديدة من الوادي', '#fff', 15); }
            else S.stones = STONES;
        }
        function updateStone(k, dt) {
            var s = S.stone, g = S.g;
            if (!s) return;
            s.vy += g.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 14;
            if (S.mode === 'q') {
                for (var i = 0; i < S.targets.length; i++) {
                    var t = S.targets[i];
                    if (t.state) continue;
                    var r = targetRect(k, t, S.targets.length);
                    if (s.x > r.x - g.sr && s.x < r.x + r.w + g.sr && s.y > r.y - g.sr && s.y < r.y + r.h + g.sr) { S.stone = null; hitTarget(k, t, r); return; }
                }
            } else if (S.mode === 'beasts') {
                for (var b = 0; b < S.beasts.length; b++) {
                    var be = S.beasts[b];
                    if (be.state !== 'come') continue;
                    if (Math.abs(s.x - be.x) < be.s * 0.6 && Math.abs(s.y - (be.y - be.s * 0.4)) < be.s * 0.5) {
                        be.state = 'flee'; S.stone = null;
                        k.hit(6, be.x, be.y - be.s, { text: '🐑 ' });
                        k.emit(be.x, be.y - be.s * 0.4, 14, { colors: ['#e9c98f', '#fff', '#8a6a3a'] });
                        k.freeze(0.05);
                        if (!S.stones) S.stones = STONES;
                        return;
                    }
                }
            } else if (S.mode === 'forehead' && S.gol) {
                var hd = golHead(k);
                if ((s.x - hd.x) * (s.x - hd.x) + (s.y - hd.y) * (s.y - hd.y) < (hd.r + g.sr) * (hd.r + g.sr)) {
                    S.stone = null; S.mode = 'down'; S.fall = 0;
                    k.addScore(30, hd.x, hd.y - 20, '🎯 ');
                    k.freeze(0.18); k.shake(12, 0.6); k.flash('255,240,200', 0.3); k.sfx('thud');
                    k.emit(hd.x, hd.y, 30, { colors: [C.goldL, '#fff', '#c9a05a'] });
                    k.glyphBurst(hd.x, hd.y, 8);
                    return;
                }
            }
            if (s.x < -30 || s.x > g.W + 30 || s.y > g.H + 30) { S.stone = null; if (!S.stones) outOfStones(k); }
        }
        function drawBeast(ctx, be, t) {
            var s = be.s, x = be.x, y = be.y, dir = be.state === 'flee' ? -1 : 1, leg = Math.sin(t * 14 + be.ph) * s * 0.08;
            ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ell(ctx, 0, 0, s * 0.6, s * 0.1); ctx.fill();
            var body = be.kind ? '#6b4a2e' : '#d4a052', dark = be.kind ? '#4a3220' : '#9c6a2a';
            ctx.strokeStyle = dark; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2); ctx.lineTo(-s * 0.32 - leg, 0); ctx.moveTo(s * 0.3, -s * 0.2); ctx.lineTo(s * 0.32 + leg, 0); ctx.stroke();
            ctx.fillStyle = body; ctx.beginPath(); ell(ctx, 0, -s * 0.35, s * 0.5, s * 0.24); ctx.fill();
            if (!be.kind) { ctx.fillStyle = '#8a5424'; ctx.beginPath(); circ(ctx, s * 0.45, -s * 0.5, s * 0.26); ctx.fill(); ctx.strokeStyle = body; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(-s * 0.48, -s * 0.4); ctx.quadraticCurveTo(-s * 0.7, -s * 0.6, -s * 0.62, -s * 0.2); ctx.stroke(); }
            ctx.fillStyle = body; ctx.beginPath(); circ(ctx, s * 0.5, -s * 0.5, s * (be.kind ? 0.2 : 0.17)); ctx.fill();
            if (be.kind) { ctx.beginPath(); circ(ctx, s * 0.42, -s * 0.68, s * 0.06); circ(ctx, s * 0.58, -s * 0.68, s * 0.06); ctx.fill(); }
            ctx.fillStyle = '#1b0f07'; ctx.beginPath(); circ(ctx, s * 0.56, -s * 0.54, s * 0.03); ctx.fill();
            ctx.restore();
        }
        function drawGoliath(k, ctx) {
            var g = S.g, hd = golHead(k), gh = hd.gh, gx = hd.gx, t = k.rt, G2 = S.gol;
            ctx.save();
            if (S.mode === 'down' || (k.info && k.info.win)) { ctx.translate(gx, g.ground); ctx.rotate(eo(S.fall) * 1.45); ctx.translate(-gx, -g.ground); }
            var hit = G2.hit > 0 ? Math.sin(t * 50) * 4 * G2.hit : 0;
            ctx.translate(hit, 0);
            // spear like a weaver's beam
            ctx.strokeStyle = '#6b4220'; ctx.lineWidth = gh * 0.03; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(gx - gh * 0.12, g.ground - gh * 0.05); ctx.lineTo(gx - gh * 0.18, g.ground - gh * 1.1); ctx.stroke();
            ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.moveTo(gx - gh * 0.18, g.ground - gh * 1.1); ctx.lineTo(gx - gh * 0.2, g.ground - gh * 1.2); ctx.lineTo(gx - gh * 0.16, g.ground - gh * 1.1); ctx.fill();
            // body with scale armour
            figure(ctx, { x: gx, y: g.ground, h: gh, dir: 1, robe: '#7a6a4a', mantle: null, skin: '#b07a50', hair: '#1b1209', beard: 1, beardColor: '#1b1209', arm: 0.6, arm2: 0.9, t: t, dpr: k.dpr, walk: S.mode === 'bossIntro' && G2.x < G2.tx - 0.01 ? t * 5 : -1 });
            ctx.save();
            ctx.beginPath(); ctx.rect(gx - gh * 0.14, g.ground - gh * 0.7, gh * 0.28, gh * 0.4); ctx.clip();
            ctx.fillStyle = '#a8864a';
            for (var yy = 0; yy < 8; yy++) for (var xx = 0; xx < 7; xx++) { ctx.beginPath(); ctx.arc(gx - gh * 0.14 + xx * gh * 0.045 + (yy % 2) * gh * 0.022, g.ground - gh * 0.7 + yy * gh * 0.05, gh * 0.024, 0, Math.PI); ctx.fill(); }
            ctx.restore();
            // bronze greaves
            ctx.fillStyle = '#b8862b'; ctx.fillRect(gx - gh * 0.06, g.ground - gh * 0.14, gh * 0.04, gh * 0.12); ctx.fillRect(gx + gh * 0.02, g.ground - gh * 0.14, gh * 0.04, gh * 0.12);
            // helmet
            if (G2.helmet) {
                ctx.fillStyle = '#b8862b';
                ctx.beginPath(); ctx.arc(hd.x - gh * 0.01, hd.y - gh * 0.02, gh * 0.1, Math.PI, TAU); ctx.fill();
                ctx.fillStyle = '#8e1f1f'; ctx.fillRect(hd.x - gh * 0.02, hd.y - gh * 0.16, gh * 0.03, gh * 0.06);
            } else if (G2.helmetFly != null && G2.helmetFly < 1.2) {
                ctx.fillStyle = '#b8862b';
                ctx.beginPath(); ctx.arc(hd.x - G2.helmetFly * gh * 0.4, hd.y - gh * 0.02 + G2.helmetFly * G2.helmetFly * gh * 0.6, gh * 0.1, Math.PI, TAU); ctx.fill();
            }
            // forehead target
            if (S.mode === 'forehead') {
                ctx.strokeStyle = 'rgba(255,60,40,' + (0.6 + 0.4 * Math.sin(t * 10)) + ')'; ctx.lineWidth = 2.5;
                ctx.beginPath(); circ(ctx, hd.x, hd.y, hd.r * 1.3); ctx.stroke();
                ctx.beginPath(); circ(ctx, hd.x, hd.y, hd.r * 0.4); ctx.stroke();
            }
            ctx.restore();
            // shield bearer walking before him
            if (G2.bearer || (G2.bearerRun != null && G2.bearerRun < 2)) {
                var bx = gx + gh * 0.32 - (G2.bearer ? 0 : G2.bearerRun * g.W * 0.3), by = g.ground;
                tinyPerson(ctx, bx, by, gh * 0.42, '#6b3f22', '#1b1209', S.mode === 'bossIntro' || !G2.bearer ? t * 10 : -1, G2.bearer ? 1 : -1);
                ctx.fillStyle = '#b8862b'; ctx.beginPath(); ell(ctx, bx + gh * 0.07, by - gh * 0.2, gh * 0.08, gh * 0.14); ctx.fill();
                ctx.strokeStyle = '#6a4510'; ctx.lineWidth = 2; ctx.stroke();
            }
        }

        var k = createCore(host, data, api, {
            title: 'مقلاع داود', icon: '🪨',
            howto: { kind: 'drag', text: 'اسحب لورا وسيب عشان ترمي الحجر بالمقلاع. معاك ٥ حجارة ملس في كل جولة. نشّن على الإجابة الصح!' },
            comboStep: 3, maxMult: 3, pad: [130.8, 196],
            init: function (k) { layout(k); k.setAskPool(askQ); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) {
                if (S.ph <= 0) { S.guide = true; return '👁️ خط التنشين ظاهر'; }
                S.extra = 2; return '🪨 حجرين زيادة في كل جولة';
            },
            rawMax: function (k) { return k.perfectRaw(BEASTS, 6) + normalQ.length * 28 + bossQ.length * 33 + 30 + 30; },
            update: function (k, dt) {
                var g = S.g;
                S.clouds += dt * 8;
                updateStone(k, dt);
                if (S.mode === 'beasts') {
                    S.bSpawn -= dt;
                    if (S.bLeft > 0 && S.bSpawn <= 0) {
                        S.bLeft--; S.bSpawn = rand(3.2, 4.4);
                        S.beasts.push({ kind: (BEASTS - S.bLeft) % 2 === 0 ? 1 : 0, x: -40, y: g.ground - rand(0, g.H * 0.08), s: clamp(g.H * 0.16, 40, 70), v: g.W * rand(0.07, 0.1), state: 'come', ph: rand(0, 5) });
                    }
                    for (var b = S.beasts.length - 1; b >= 0; b--) {
                        var be = S.beasts[b];
                        if (be.state === 'come') {
                            be.x += be.v * dt;
                            if (be.x >= g.flockX - g.W * 0.08) { be.state = 'flee'; k.loseLife(be.x, be.y - be.s, 'الخروف اتخض! 🐑'); }
                        } else { be.x -= be.v * 2.6 * dt; if (be.x < -80) S.beasts.splice(b, 1); }
                    }
                    if (S.bLeft <= 0 && !S.beasts.length) { S.mode = 'wait'; k.after(0.5, function () { k.checkpoint(function () { startPhase(k, 1); }); }); }
                } else if (S.mode === 'q') {
                    S.qT += dt;
                    if (S.qT >= QTIME) { k.loseLife(k.W / 2, g.tTop + 30, 'الوقت خلص'); showResult(k, false, 'time'); }
                } else if (S.mode === 'result') {
                    S.resT += dt;
                    if (S.resT >= (S.res.ok ? 2 : 3.6)) nextQ(k);
                } else if (S.mode === 'forehead') {
                    S.qT += dt;
                    S.gol.tx = Math.min(0.42, S.gol.tx + dt * 0.006);
                }
                if (S.gol) {
                    S.gol.x += (S.gol.tx - S.gol.x) * Math.min(1, dt * 0.6);
                    if (S.gol.hit > 0) S.gol.hit -= dt * 2;
                    if (S.gol.helmetFly != null) S.gol.helmetFly += dt;
                    if (S.gol.bearerRun != null) S.gol.bearerRun += dt;
                    if (S.mode === 'down') {
                        S.fall = Math.min(1, S.fall + dt * 1.4);
                        if (S.fall >= 1) { S.mode = 'end'; k.emit(g.W * 0.4, g.ground, 24, { colors: ['#c9b27a', '#a88d57', '#fff'], grav: 200 }); k.finish({ title: 'داود غلب جليات! 🎉', finaleT: 2.2 }); return; }
                    }
                    if (S.gol.x >= 0.41 && S.mode === 'forehead') { S.mode = 'end'; k.finish({ lose: true, title: 'جليات لسه واقف… جرّب تاني بإيمان', finaleT: 1.2 }); return; }
                }
                if (k.lives != null && k.lives <= 0 && S.mode !== 'end') { S.mode = 'end'; k.finish({ lose: true, title: 'شجاعة يا بطل! جرّب تاني', finaleT: 1.2 }); }
            },
            finale: function (k, dt) { S.clouds += dt * 8; if (S.gol && k.info.win) S.fall = 1; },
            down: function (k, p) {
                if (!canShoot()) return;
                S.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y };
            },
            move: function (k, p) { if (S.aim) { S.aim.x = p.x; S.aim.y = p.y; } },
            up: function (k, p, cancel) {
                var a = S.aim; S.aim = null;
                if (!a || cancel || !canShoot()) return;
                var v = launch(k, a);
                if (v.len < 14) return;
                S.stones--;
                S.stone = { x: S.g.ancX, y: S.g.ancY, vx: v.vx, vy: v.vy, rot: 0 };
                k.sfx('whoosh');
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt;
                blit(ctx, S.bg, 0, 0);
                ctx.globalAlpha = 0.85; blitTiled(ctx, S.cloud, S.clouds, 8, W); ctx.globalAlpha = 1;
                // flock
                if (S.ph <= 0) for (var sh = 0; sh < 6; sh++) sheep(ctx, g.flockX + (sh % 3) * 26 - 20, g.ground - (sh > 2 ? 14 : 0), 1.3, -1, t + sh);
                for (var b = 0; b < S.beasts.length; b++) drawBeast(ctx, S.beasts[b], t);
                if (S.gol) drawGoliath(k, ctx);
                // targets
                if (S.mode === 'q' || S.mode === 'result') {
                    for (var i = 0; i < S.targets.length; i++) {
                        var tg = S.targets[i], r = targetRect(k, tg, S.targets.length);
                        if (S.mode === 'result' && tg.i !== S.q.correct && tg.state === 0) ctx.globalAlpha = 0.35;
                        ctx.fillStyle = '#6b4220'; ctx.fillRect(r.x + r.w / 2 - 3, r.y + r.h, 6, Math.max(0, g.ground - r.y - r.h));
                        var right = S.mode === 'result' && tg.i === S.q.correct;
                        ctx.fillStyle = vgrad(ctx, r.y, r.y + r.h, tg.state === -1 ? ['#f3b0a0', '#c0503a'] : (right || tg.state === 1 ? ['#c8f5c0', '#5aa34a'] : ['#fff6dc', '#e5c98c']));
                        rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
                        ctx.strokeStyle = S.ph === 2 ? '#8e1f1f' : C.goldD; ctx.lineWidth = 2; ctx.stroke();
                        block(ctx, tg.text, r.x + r.w / 2, r.y + r.h / 2 + 1, r.w - 16, r.h - 8, clamp(r.h * 0.34, 12, 18), 800, '#3b2412', 2);
                        ctx.globalAlpha = 1;
                    }
                    // question banner
                    var qw = Math.min(W * 0.9, 680);
                    ctx.fillStyle = 'rgba(251,241,216,0.96)'; rr(ctx, (W - qw) / 2, g.qTop, qw, g.qh, 12); ctx.fill();
                    ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
                    drawCross(ctx, (W + qw) / 2 - 18, g.qTop + g.qh / 2, 9, C.red, k.dpr);
                    block(ctx, S.q.q, W / 2, g.qTop + g.qh / 2 + 1, qw - 70, g.qh - 8, clamp(g.qh * 0.32, 13, 19), 900, C.ink, 2);
                    if (S.mode === 'q') {
                        var hot = clamp(1 - S.qT / QTIME, 0, 1);
                        ctx.fillStyle = hot < 0.3 ? '#d9453a' : C.gold; ctx.fillRect((W - qw) / 2 + 14, g.qTop + g.qh - 5, (qw - 28) * hot, 3);
                    }
                }
                // David with his sling
                var aiming = !!S.aim;
                var hand = figure(ctx, { x: g.dx, y: g.ground, h: g.ds, dir: -1, robe: '#e9dcc0', mantle: '#b5543a', hair: '#8a4a24', halo: true, arm: aiming ? 2.6 : 0.5, arm2: aiming ? 1.3 : 0.2, t: t, dpr: k.dpr });
                // pouch of stones
                for (var st = 0; st < S.stones; st++) { ctx.fillStyle = '#d6d0c4'; ctx.beginPath(); ell(ctx, g.dx + g.ds * 0.25 + (st % 4) * 9, g.ground - 6 - Math.floor(st / 4) * 7, 4, 3); ctx.fill(); ctx.strokeStyle = '#7d7466'; ctx.lineWidth = 0.8; ctx.stroke(); }
                if (S.aim) {
                    var v = launch(k, S.aim);
                    ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(v.px, v.py); ctx.stroke();
                    ctx.fillStyle = '#d6d0c4'; ctx.beginPath(); circ(ctx, v.px, v.py, g.sr); ctx.fill();
                    var dots = S.guide ? 16 : 5;
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    for (var d = 1; d <= dots; d++) {
                        var tt = d * 0.06, px = g.ancX + v.vx * tt, py = g.ancY + v.vy * tt + 0.5 * g.grav * tt * tt;
                        ctx.globalAlpha = 1 - d / (dots + 2); ctx.beginPath(); circ(ctx, px, py, 3); ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                } else if (!S.stone && canShoot()) {
                    var swing = t * 9;
                    ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.6;
                    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hand.x + Math.cos(swing) * 10, hand.y + 14 + Math.sin(swing) * 4); ctx.stroke();
                }
                if (S.stone) {
                    ctx.save(); ctx.translate(S.stone.x, S.stone.y); ctx.rotate(S.stone.rot);
                    ctx.fillStyle = '#d6d0c4'; ctx.beginPath(); ell(ctx, 0, 0, g.sr, g.sr * 0.8); ctx.fill();
                    ctx.strokeStyle = '#7d7466'; ctx.lineWidth = 1; ctx.stroke();
                    ctx.restore();
                }
                // result card
                if (S.mode === 'result' && S.res) {
                    var rw = Math.min(W * 0.6, 460), rh = clamp(H * 0.3, 80, 130), rx = (W - rw) / 2, ry = H * 0.42;
                    ctx.fillStyle = 'rgba(251,241,216,0.97)'; rr(ctx, rx, ry, rw, rh, 14); ctx.fill();
                    ctx.strokeStyle = S.res.ok ? '#2e7d32' : C.red; ctx.lineWidth = 2.5; ctx.stroke();
                    txt(ctx, S.res.ok ? 'إصابة! 🎯' : (S.res.why === 'time' ? 'الوقت خلص…' : (S.res.why === 'stones' ? 'الحجارة خلصت…' : 'مش دي…')), W / 2, ry + rh * 0.2, font(clamp(rh * 0.16, 14, 20), 900), S.res.ok ? '#1d5a2c' : C.red);
                    block(ctx, 'الإجابة: ' + S.res.answer, W / 2, ry + rh * 0.45, rw - 30, rh * 0.22, clamp(rh * 0.13, 12, 16), 900, '#1d5a2c', 1);
                    if (S.res.explain) block(ctx, S.res.explain, W / 2, ry + rh * 0.75, rw - 30, rh * 0.36, clamp(rh * 0.12, 11, 15), 700, C.ink, 2);
                }
                if (S.ph === 0 && S.mode === 'beasts' && k.t < 6) {
                    ctx.globalAlpha = clamp(6 - k.t, 0, 1);
                    txt(ctx, 'احمي الغنم! اسحب لورا وسيب', W * 0.45, H * 0.26, font(17, 900), '#fff', 'center', 4);
                    ctx.globalAlpha = 1;
                }
            }
        });
        return k.api2();
    }

    var games = {
        langLibrary: langLibrary,
        ark: ark,
        joseph: joseph,
        redSea: redSea,
        gideon: gideon,
        sling: sling
    };
    // Shared kit for other arcade files (e.g. level1-arcade-service.js): the core shell and art helpers.
    games._kit = {
        C: C, FONT: FONT, EMOJI_FONT: EMOJI_FONT, TAU: TAU,
        clamp: clamp, lerp: lerp, rand: rand, pick: pick, eo: eo, eio: eio, eob: eob, eel: eel,
        shuffle: shuffle, seeded: seeded, ar: ar, plain: plain, font: font,
        validQuestions: validQuestions, strList: strList, prefersReduced: prefersReduced,
        rr: rr, circ: circ, ell: ell, txt: txt, emo: emo, wrap: wrap, block: block, inRect: inRect, vgrad: vgrad,
        mkCanvas: mkCanvas, layer: layer, blit: blit, blitTiled: blitTiled, ridge: ridge,
        glyphs: glyphs, glyphAt: glyphAt, glyphFont: function () { glyphs(); return glyphFont; },
        crossPath: crossPath, copticCross: copticCross, cached: cached, drawCross: drawCross, halo: halo,
        panelSprite: panelSprite, friezeSprite: friezeSprite, starPath: starPath, heartPath: heartPath,
        figure: figure, shade: shade, drawProp: drawProp, flame: flame, tinyPerson: tinyPerson, sheep: sheep,
        emojiSprite: emojiSprite, makeAudio: makeAudio, createCore: createCore
    };
    return games;
})();
