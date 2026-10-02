/*
 * level2-arcade-bible.js
 * Level 2 (الكتاب المقدس: الأسفار القانونية الثانية، طرق الدراسة، الكاثوليكون، رسالة يعقوب) signature
 * canvas arcade games. Adds eight games to the global L1_ARCADE using the shared kit exposed by
 * level1-arcade.js (L1_ARCADE._kit):
 *   scrollPuzzle, studyLamp, catholiconMail, seaOfDoubt, noPartiality, tameTongue, resistFlee, rainPrayer
 * Interface: docs/superpowers/specs/2026-09-29-level1-contracts.md (section B).
 * Spec: docs/superpowers/specs/2026-10-02-level2-bible-design.md (arcade table).
 * All lesson / Bible text (intro, outro, facts, phases, books, methods, letters, words, needs)
 * comes from the game's data; only generic UI strings live here. Plain global script, ES5,
 * no image files. Must load after level1-arcade.js.
 */
(function (K) {
    'use strict';
    if (!K || typeof L1_ARCADE === 'undefined') return;

    var C = K.C, TAU = K.TAU, clamp = K.clamp, lerp = K.lerp, rand = K.rand;
    var eo = K.eo, eob = K.eob, shuffle = K.shuffle, seeded = K.seeded, ar = K.ar, plain = K.plain;
    var font = K.font, strList = K.strList, rr = K.rr, circ = K.circ, ell = K.ell, txt = K.txt;
    var block = K.block, vgrad = K.vgrad, layer = K.layer, blit = K.blit, mkCanvas = K.mkCanvas;
    var blitTiled = K.blitTiled, ridge = K.ridge, copticCross = K.copticCross, drawCross = K.drawCross;
    var halo = K.halo, friezeSprite = K.friezeSprite, starPath = K.starPath;
    var figure = K.figure, flame = K.flame, createCore = K.createCore;

    /* ============================================================ shared helpers */
    // Upper bound for a sequence of combo hits: ascending order puts the big values on the big multipliers.
    function perfectSeq(k, list) {
        var st = k.opt.comboStep || 4, mx = k.opt.maxMult || 4, s = 0, l = list.slice().sort(function (a, b) { return a - b; });
        for (var i = 0; i < l.length; i++) s += l[i] * Math.min(mx, 1 + Math.floor((i + 1) / st));
        return s;
    }
    function rep(n, v, out) { out = out || []; for (var i = 0; i < n; i++) out.push(v); return out; }
    function modn(a, n) { return ((a % n) + n) % n; }
    function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
    function mixA(hex, a) {
        var h = String(hex).replace('#', '');
        if (h.length !== 6) return hex;
        return 'rgba(' + parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16) + ',' + clamp(a, 0, 1) + ')';
    }
    function chip(ctx, s, x, y, size, bg, fg, border) {
        s = plain(s);
        ctx.font = font(size, 800);
        var w = ctx.measureText(s).width + size * 1.3, h = size * 1.75;
        ctx.fillStyle = bg; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
        if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.3; ctx.stroke(); }
        txt(ctx, s, x, y + 1, font(size, 800), fg || '#fff');
        return w;
    }
    // Parchment speech bubble whose tail points at (x, y).
    function speech(ctx, s, x, y, maxW, size, W, a, who) {
        s = plain(s);
        if (!s) return;
        ctx.save();
        ctx.globalAlpha = a == null ? 1 : clamp(a, 0, 1);
        ctx.font = font(size, 800);
        var lines = K.wrap(ctx, s, maxW), w = 0, i;
        if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] += '…'; }
        for (i = 0; i < lines.length; i++) w = Math.max(w, ctx.measureText(lines[i]).width);
        var lh = size * 1.4, bw = w + size * 1.6, bh = lines.length * lh + size * (who ? 1.9 : 0.9);
        var bx = clamp(x - bw / 2, 6, W - bw - 6), by = y - 12 - bh;
        if (by < 4) by = 4;
        var tx = clamp(x, bx + 14, bx + bw - 14);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, bx + 2, by + 3, bw, bh, 12); ctx.fill();
        ctx.fillStyle = '#fbf1d8'; rr(ctx, bx, by, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx - 7, by + bh - 1); ctx.lineTo(x, Math.max(y, by + bh + 4)); ctx.lineTo(tx + 7, by + bh - 1); ctx.closePath();
        ctx.fillStyle = '#fbf1d8'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fbf1d8'; ctx.fillRect(tx - 6, by + bh - 3, 12, 3);
        var ty = by + size * 0.45 + lh / 2;
        if (who) { txt(ctx, plain(who), bx + bw / 2, by + size * 0.85, font(size * 0.8, 900), C.red); ty += size; }
        for (i = 0; i < lines.length; i++) txt(ctx, lines[i], bx + bw / 2, ty + i * lh, font(size, 800), C.ink);
        ctx.restore();
    }
    function ring(ctx, x, y, r, frac, col, lw) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = lw || 3.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0.001, 1)); ctx.stroke();
    }
    function palm(ctx, x, y, h, sway) {
        ctx.save(); ctx.translate(x, y);
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2, h * 0.05); ctx.lineCap = 'round';
        var tx = h * 0.12 + sway * h * 0.04, ty = -h;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(h * 0.02, -h * 0.55, tx, ty); ctx.stroke();
        ctx.strokeStyle = '#3f6a2a'; ctx.lineWidth = Math.max(1.5, h * 0.035);
        for (var i = 0; i < 7; i++) {
            var a = -Math.PI / 2 + (i - 3) * 0.48 + sway * 0.06, L = h * (0.42 + (i % 2) * 0.08);
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.7 - L * 0.1, tx + Math.cos(a) * L, ty + Math.sin(a) * L * 0.6 + L * 0.35); ctx.stroke();
        }
        ctx.restore();
    }
    function cloud(ctx, x, y, s, a, col) {
        ctx.fillStyle = col || 'rgba(255,248,235,' + a + ')';
        ctx.beginPath(); ell(ctx, x, y, s, s * 0.32); ell(ctx, x - s * 0.4, y + 2, s * 0.5, s * 0.25); ell(ctx, x + s * 0.45, y + 3, s * 0.45, s * 0.22); ell(ctx, x + s * 0.1, y - s * 0.18, s * 0.45, s * 0.28); ctx.fill();
    }
    // Coptic church silhouette: nave, central dome, two bell towers, gold crosses.
    function church(x, cx, gy, s, col, win) {
        x.fillStyle = col;
        x.fillRect(cx - s * 0.45, gy - s * 0.55, s * 0.9, s * 0.55);
        x.beginPath(); x.arc(cx, gy - s * 0.55, s * 0.3, Math.PI, 0); x.fill();
        x.fillRect(cx - s * 0.64, gy - s * 0.82, s * 0.17, s * 0.82); x.fillRect(cx + s * 0.47, gy - s * 0.82, s * 0.17, s * 0.82);
        x.beginPath(); x.arc(cx - s * 0.555, gy - s * 0.82, s * 0.085, Math.PI, 0); x.arc(cx + s * 0.555, gy - s * 0.82, s * 0.085, Math.PI, 0); x.fill();
        copticCross(x, cx, gy - s * 0.97, s * 0.08, C.gold, 'rgba(40,20,0,0.5)', 1);
        copticCross(x, cx - s * 0.555, gy - s * 0.97, s * 0.05, C.gold);
        copticCross(x, cx + s * 0.555, gy - s * 0.97, s * 0.05, C.gold);
        x.fillStyle = win || 'rgba(255,214,130,0.75)';
        x.beginPath(); x.arc(cx, gy - s * 0.18, s * 0.1, Math.PI, 0); x.lineTo(cx + s * 0.1, gy); x.lineTo(cx - s * 0.1, gy); x.closePath(); x.fill();
        for (var i = -1; i <= 1; i += 2) { x.beginPath(); x.arc(cx + i * s * 0.27, gy - s * 0.36, s * 0.045, Math.PI, 0); x.lineTo(cx + i * s * 0.27 + s * 0.045, gy - s * 0.26); x.lineTo(cx + i * s * 0.27 - s * 0.045, gy - s * 0.26); x.closePath(); x.fill(); }
    }
    function sky(x, W, h, stops, sun) {
        x.fillStyle = vgrad(x, 0, h, stops); x.fillRect(0, 0, W, h);
        if (sun) {
            var g = x.createRadialGradient(sun[0], sun[1], 2, sun[0], sun[1], sun[2] * 6);
            g.addColorStop(0, 'rgba(255,236,170,0.85)'); g.addColorStop(1, 'rgba(255,200,120,0)');
            x.fillStyle = g; x.fillRect(0, 0, W, h);
            x.fillStyle = '#ffe9a8'; x.beginPath(); circ(x, sun[0], sun[1], sun[2]); x.fill();
        }
    }
    function sand(x, W, H, y0, seed) {
        x.fillStyle = vgrad(x, y0, H, ['#e6bf82', '#d3a066', '#b9844c']); x.fillRect(0, y0, W, H - y0);
        var r = seeded(seed || 3);
        x.fillStyle = 'rgba(110,70,30,0.22)';
        for (var p = 0; p < 40; p++) { x.beginPath(); ell(x, r() * W, y0 + 4 + r() * (H - y0), 1 + r() * 3, 0.8 + r() * 1.4); x.fill(); }
    }
    function frieze(ctx, k, x0, y, x1, h, fg) {
        var fr = friezeSprite(h, k.dpr, fg || C.goldD, 'rgba(0,0,0,0)');
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y, x1 - x0, h); ctx.clip(); blitTiled(ctx, fr, 0, y, x1); ctx.restore();
    }
    function youth(ctx, k, x, y, h, dir, walk, robe, extra) {
        var f = { x: x, y: y, h: h, dir: dir, robe: robe || '#f3ead6', mantle: '#8e1f1f', hair: '#2b1a0e', belt: C.gold, walk: walk, t: k.rt, dpr: k.dpr };
        if (extra) for (var e in extra) f[e] = extra[e];
        return figure(ctx, f);
    }
    function veil(ctx, f, col) {
        var s = f.h / 100, dir = f.dir < 0 ? -1 : 1;
        ctx.save(); ctx.translate(f.x, f.y); ctx.scale(dir * s, s);
        ctx.fillStyle = col || '#e9dcc0';
        ctx.beginPath(); ctx.moveTo(9, -91); ctx.quadraticCurveTo(0, -101, -9, -92); ctx.quadraticCurveTo(-15, -80, -17, -58);
        ctx.lineTo(-8, -60); ctx.quadraticCurveTo(-5, -78, -3, -86); ctx.quadraticCurveTo(3, -90, 9, -87); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    // Soft round light hole for a darkness layer (destination-out).
    function hole(x, cx, cy, r) {
        if (r <= 1) return;
        var gr = x.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    function glow(ctx, x, y, r, col) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); circ(ctx, x, y, r); ctx.fill();
    }

    /* ======================================================================
     * 1. scrollPuzzle -- بانوراما الأسفار القانونية الثانية
     * A monastery library desk. Each scroll is torn in two: the right half (the
     * book name) lies still; the left halves sit on a vertical reel. Swipe the
     * reel up / down (or the arrow keys) until the right half's partner lines up
     * with the tear, then tap to join and seal it with wax before the candle
     * burns down. Phase 1: the book's story (the torn edges also match, as a
     * hint). Phase 2: where the book sits in the Bible (no edge hint). Phase 3
     * (twist): the objections and the church's replies, and a wind keeps
     * spinning the reel. Data: books[{name, ch, info, place}], objections[{arg,
     * reply}], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.scrollPuzzle = function (host, data, api) {
        data = data || {};
        var books = (data.books || []).filter(function (b) { return b && b.name; }).map(function (b) {
            return { name: plain(b.name), ch: plain(b.ch || ''), info: plain(b.info || ''), place: plain(b.place || '') };
        });
        var objs = (data.objections || []).filter(function (o) { return o && o.arg && o.reply; }).map(function (o) { return { arg: plain(o.arg), reply: plain(o.reply) }; });
        if (!books.length) books = [{ name: '…', ch: '', info: '…', place: '…' }];
        var PT = [16, 14, 16];
        function opts4(right, pool) {
            var w = shuffle(pool), uniq = [], i;
            for (i = 0; i < w.length && uniq.length < 3; i++) if (w[i] && w[i] !== right && uniq.indexOf(w[i]) < 0) uniq.push(w[i]);
            return shuffle([right].concat(uniq)).map(function (s) { return { s: s, ok: s === right }; });
        }
        function mkRounds() {
            var sb = shuffle(books), infos = books.map(function (b) { return b.info; }), places = books.map(function (b) { return b.place; });
            var a = sb.filter(function (b) { return b.info; }).slice(0, 5);
            var bp = sb.filter(function (b) { return a.indexOf(b) < 0 && b.place; }).concat(sb.filter(function (b) { return a.indexOf(b) >= 0 && b.place; })).slice(0, 5);
            var R0 = a.map(function (b) { return { top: b.name, sub: b.ch, o: opts4(b.info, infos) }; });
            var R1 = bp.map(function (b) { return { top: b.name, sub: b.ch, o: opts4(b.place, places) }; });
            var R2;
            if (objs.length >= 2) {
                var reps = objs.map(function (o) { return o.reply; });
                R2 = shuffle(objs).slice(0, 4).map(function (o) { return { top: o.arg, sub: '', obj: true, o: opts4(o.reply, reps) }; });
            } else R2 = shuffle(books).filter(function (b) { return b.info; }).slice(0, 3).map(function (b) { return { top: b.name, sub: b.ch, o: opts4(b.info, infos) }; });
            return [R0, R1, R2];
        }
        var RR = mkRounds(), NR = RR[0].length + RR[1].length + RR[2].length;
        function mkPat() { var p = [0]; for (var i = 1; i < 8; i++) p.push(rand(-1, 1)); p.push(0); return p; }
        var S = { ph: -1, ri: 0, cur: null, ro: 0, vel: 0, drag: null, st: 'idle', t: 0, T: 15, jt: 0, mt: 0, wrongT: 0, driftT: 1.5, gust: 0, bonus: 0, burn: 0, done: [] };
        function G(k) {
            var W = k.W, H = k.H, ph = clamp(H * 0.34, 78, 170), cy = Math.round(H * 0.56), seam = Math.round(W * 0.52);
            var pw = Math.min(W * 0.33, 330), rw = Math.min(W * 0.38, 360);
            return { W: W, H: H, cy: cy, ph: ph, seam: seam, x1: seam + pw, x0: seam - rw, ih: ph * 1.1, amp: clamp(W * 0.011, 5, 11), top: 50, desk: Math.min(H - 16, cy + ph * 0.66) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#2a1810', '#45291a', '#5a3822']); x.fillRect(0, 0, W, H);
                var n = Math.max(3, Math.round(W / 190)), aw = W / n;
                for (var a = 0; a < n; a++) {
                    var ax = a * aw + aw * 0.12, w2 = aw * 0.76, top = H * 0.1, bot = g.desk;
                    x.fillStyle = 'rgba(15,8,4,0.55)';
                    x.beginPath(); x.moveTo(ax, bot); x.lineTo(ax, top + w2 / 2); x.arc(ax + w2 / 2, top + w2 / 2, w2 / 2, Math.PI, 0); x.lineTo(ax + w2, bot); x.closePath(); x.fill();
                    x.strokeStyle = 'rgba(226,179,77,0.32)'; x.lineWidth = 2; x.stroke();
                    var r = seeded(11 + a);
                    for (var sy = top + w2 * 0.72; sy < bot - 12; sy += 22) {
                        x.fillStyle = 'rgba(90,55,25,0.8)'; x.fillRect(ax + 4, sy + 9, w2 - 8, 3);
                        for (var sx = ax + 11; sx < ax + w2 - 9; sx += 13) {
                            x.fillStyle = r() < 0.5 ? '#d9c08a' : '#c8a96a';
                            x.beginPath(); circ(x, sx, sy + 2, 5.5); x.fill();
                            x.fillStyle = 'rgba(80,50,20,0.6)'; x.beginPath(); circ(x, sx, sy + 2, 2); x.fill();
                        }
                    }
                    copticCross(x, ax + w2 / 2, top + w2 * 0.3, clamp(w2 * 0.1, 6, 12), 'rgba(226,179,77,0.5)');
                }
                x.fillStyle = vgrad(x, g.desk, H, ['#7a4a26', '#5a3418', '#3c220f']); x.fillRect(0, g.desk, W, H - g.desk);
                x.fillStyle = 'rgba(255,220,150,0.16)'; x.fillRect(0, g.desk, W, 3);
            });
        }
        function idxOf(c) { for (var i = 0; i < c.o.length; i++) if (c.o[i].ok) return i; return 0; }
        function curIdx() { return modn(Math.round(S.ro), S.cur.o.length); }
        function openRound(k) {
            var list = RR[clamp(S.ph, 0, 2)];
            if (S.ri >= list.length) { endPhase(k); return; }
            var r = list[S.ri], pat = mkPat(), i;
            r.pat = pat;
            for (i = 0; i < r.o.length; i++) r.o[i].pat = (S.ph === 0 && !r.o[i].ok) ? mkPat() : pat;
            S.cur = r; S.st = 'open'; S.t = 0; S.T = PT[S.ph] + (S.bonus ? 5 : 0); S.bonus = 0; S.burn = 0; S.wrongT = 0;
            var n = r.o.length, ci = idxOf(r);
            S.ro = n > 1 ? modn(ci + 1 + Math.floor(Math.random() * (n - 1)), n) : 0; S.vel = 0; S.drag = null;
            k.sfx('page');
        }
        function endPhase(k) {
            S.st = 'idle'; S.cur = null;
            if (S.ph >= 2) { k.finish({ title: 'الدروج رجعت كاملة! 📜', finaleT: 2.2 }); return; }
            var n2 = S.ph + 1;
            k.after(0.8, function () { k.checkpoint(function () { startPhase(k, n2); }); });
        }
        function startPhase(k, n) {
            S.ph = n; S.ri = 0; S.cur = null; S.st = 'idle'; S.done = [];
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { openRound(k); });
        }
        function nextRound(k) { S.done.push(S.st === 'join'); S.ri++; openRound(k); }
        function seal(k) {
            if (S.st !== 'open' || !S.cur) return;
            var g = S.g;
            if (Math.abs(S.ro - Math.round(S.ro)) > 0.3 || Math.abs(S.vel) > 3.5) { k.pop(g.seam, g.cy - g.ph * 0.72, 'ثبّت البكرة الأول', '#ffe9b8', 14); return; }
            var o = S.cur.o[curIdx()];
            if (o.ok) {
                var fast = S.t < S.T * 0.5;
                S.st = 'join'; S.jt = 0; S.ro = Math.round(S.ro); S.vel = 0;
                k.hit(fast ? 10 : 6, g.seam, g.cy - g.ph * 0.75, { text: fast ? 'بسرعة! ' : '' });
                k.emit(g.seam, g.cy, 22, { colors: [C.goldL, '#fff3cf', C.gold], up: 60 });
                k.glyphBurst(g.seam, g.cy - 10, 5);
                k.sfx('page');
            } else {
                S.wrongT = 0.5; S.burn = Math.min(1, S.burn + 0.34);
                k.emit(g.seam - 20, g.cy, 12, { colors: ['#5a3a1e', '#2b170b', '#ff9f43'], grav: -60, up: 20 });
                if (k.loseLife(g.seam, g.cy - g.ph * 0.75, 'مش دي الحتة') <= 0) k.finish({ lose: true, title: 'ولا يهمك… اقرا الأسفار تاني وجرّب', finaleT: 1.2 });
            }
        }
        function timeout(k) {
            var n = S.cur.o.length, base = Math.round(S.ro), d = modn(idxOf(S.cur) - base, n);
            if (d > n / 2) d -= n;
            S.st = 'miss'; S.jt = 0; S.drag = null; S.mt = base + d; S.vel = 0;
            k.sfx('fire');
            if (k.loseLife(S.g.seam, S.g.cy - S.g.ph * 0.75, 'الشمعة خلصت') <= 0) k.finish({ lose: true, title: 'ولا يهمك… اقرا الأسفار تاني وجرّب', finaleT: 1.4 });
        }
        // Torn parchment piece; side 'r' = torn right edge (reel half), 'l' = torn left edge (fixed half).
        function piece(ctx, k, g, x0, y0, x1, y1, side, pat, s1, s2, grey, wrong, burn) {
            var m = pat.length - 1, h = y1 - y0, i, amp = g.amp;
            ctx.beginPath();
            if (side === 'r') {
                ctx.moveTo(x0, y0);
                for (i = 0; i <= m; i++) ctx.lineTo(x1 + pat[i] * amp, y0 + h * i / m);
                ctx.lineTo(x0, y1);
            } else {
                ctx.moveTo(x1, y0); ctx.lineTo(x1, y1);
                for (i = m; i >= 0; i--) ctx.lineTo(x0 + pat[i] * amp, y0 + h * i / m);
            }
            ctx.closePath();
            ctx.fillStyle = grey ? vgrad(ctx, y0, y1, ['#d9cdb4', '#bfb196']) : vgrad(ctx, y0, y1, ['#f8eac6', '#ecd5a0', '#dcbd80']);
            ctx.fill();
            ctx.strokeStyle = wrong ? '#c0392b' : 'rgba(110,70,30,0.75)'; ctx.lineWidth = wrong ? 2.5 : 1.4; ctx.stroke();
            if (burn > 0) {
                ctx.save(); ctx.clip();
                var bx = side === 'r' ? x1 : x0, bg = ctx.createLinearGradient(bx, 0, bx + (side === 'r' ? -1 : 1) * 40, 0);
                bg.addColorStop(0, 'rgba(60,30,10,' + (0.7 * burn) + ')'); bg.addColorStop(1, 'rgba(60,30,10,0)');
                ctx.fillStyle = bg; ctx.fillRect(Math.min(x0, x1) - 20, y0, Math.abs(x1 - x0) + 40, h);
                ctx.restore();
            }
            // red ruling lines (manuscript) and a roller at the outer end
            ctx.strokeStyle = 'rgba(142,31,31,0.28)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(Math.min(x0, x1) + 14, y0 + 9); ctx.lineTo(Math.max(x0, x1) - 14, y0 + 9); ctx.moveTo(Math.min(x0, x1) + 14, y1 - 9); ctx.lineTo(Math.max(x0, x1) - 14, y1 - 9); ctx.stroke();
            var rx = side === 'r' ? x0 : x1;
            ctx.fillStyle = vgrad(ctx, y0 - 8, y1 + 8, ['#8a5a2a', '#5a3517']); rr(ctx, rx - 6, y0 - 7, 12, h + 14, 5); ctx.fill();
            ctx.fillStyle = C.gold; ctx.beginPath(); circ(ctx, rx, y0 - 9, 5); circ(ctx, rx, y1 + 9, 5); ctx.fill();
            var tx0 = side === 'r' ? x0 + 12 : x0 + amp + 8, tx1 = side === 'r' ? x1 - amp - 8 : x1 - 12, cw = tx1 - tx0, cx = (tx0 + tx1) / 2;
            if (s2 != null) {
                block(ctx, s1, cx, y0 + h * (s2 ? 0.4 : 0.5), cw - 10, h * 0.42, clamp(h * 0.2, 16, 28), 900, C.red, 2);
                if (s2) block(ctx, s2, cx, y0 + h * 0.74, cw - 10, h * 0.2, clamp(h * 0.1, 11, 14), 800, '#6b4220', 1);
                drawCross(ctx, cx, y0 + 14, 6, C.red, k.dpr);
            } else block(ctx, s1, cx, y0 + h / 2, cw - 8, h - 22, clamp(h * 0.12, 12, 16), 800, grey ? '#6b5a40' : C.ink, 4);
        }
        function drawCandle(ctx, k, x, y, h, frac, t) {
            var ch = Math.max(4, h * 0.8 * frac), top = y + h * 0.4 - ch;
            ctx.fillStyle = '#6b4220'; rr(ctx, x - 16, y + h * 0.4, 32, 8, 3); ctx.fill();
            ctx.fillStyle = vgrad(ctx, top, y + h * 0.4, ['#fff6dc', '#ead9b0']); rr(ctx, x - 7, top, 14, ch, 3); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - 4, top + 2, 2, ch - 4);
            flame(ctx, x, top - 4, frac < 0.3 ? 4 + Math.sin(t * 20) : 5, t);
        }

        var k = createCore(host, data, api, {
            title: 'ركّب الدروج', icon: '📜',
            howto: { kind: 'drag', text: 'اسحب البكرة لفوق ولتحت لحد ما الحتة الصح تقف قدام نص الدرج، واضغط عشان تلزقه وتختمه قبل ما الشمعة تخلص.' },
            comboStep: 4, maxMult: 3, pad: [130.8, 196], lives: 3, factY: 0.12,
            rawMax: function (k) { return perfectSeq(k, rep(NR, 10)) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.bonus = 1; return '🕯️ شمعة أطول للدرج الجاي'; },
            update: function (k, dt) {
                var c = S.cur;
                S.wrongT = Math.max(0, S.wrongT - dt); S.gust = Math.max(0, S.gust - dt * 1.5);
                if (!c) return;
                if (!S.drag) {
                    if (S.st === 'miss') S.ro += (S.mt - S.ro) * Math.min(1, dt * 6);
                    else {
                        S.ro += S.vel * dt;
                        S.vel *= Math.exp(-2.4 * dt);
                        if (Math.abs(S.vel) < 1.3) { S.vel *= Math.exp(-6 * dt); S.ro += (Math.round(S.ro) - S.ro) * Math.min(1, dt * 9); }
                    }
                }
                if (S.st === 'open') {
                    S.t += dt;
                    if (S.ph === 2 && !S.drag) {
                        S.driftT -= dt;
                        if (S.driftT <= 0) { S.driftT = rand(1.5, 2.3); S.vel += (Math.random() < 0.5 ? -1 : 1) * rand(1.8, 2.8); S.gust = 1; k.sfx('whoosh'); }
                    }
                    if (S.t >= S.T) timeout(k);
                } else if (S.st === 'join') {
                    S.jt += dt;
                    if (S.jt > 1.15) nextRound(k);
                } else if (S.st === 'miss') {
                    S.jt += dt;
                    if (S.jt > 1.9) nextRound(k);
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.glyphBurst(rand(0, k.W), k.H * 0.4, 2);
            },
            down: function (k, p) {
                var g = S.g;
                if (S.st === 'open' && p.x < g.seam + 6) { S.drag = { y: p.y, ro: S.ro, moved: 0, ly: p.y, lt: k.rt }; S.vel = 0; return; }
                seal(k);
            },
            move: function (k, p) {
                var d = S.drag;
                if (!d || S.st !== 'open') return;
                var dy = p.y - d.y, g = S.g;
                S.ro = d.ro - dy / g.ih;
                d.moved = Math.max(d.moved, Math.abs(dy));
                var dtt = Math.max(0.016, k.rt - d.lt);
                S.vel = lerp(S.vel, -(p.y - d.ly) / g.ih / dtt, 0.5);
                d.ly = p.y; d.lt = k.rt;
                if (Math.abs(Math.round(S.ro) - (S.lastTick || 0)) >= 1) { S.lastTick = Math.round(S.ro); k.sfx('tick'); }
            },
            up: function (k) {
                var d = S.drag;
                if (!d) return;
                S.drag = null;
                if (d.moved < 8) { S.vel = 0; seal(k); }
                else S.vel = clamp(S.vel, -12, 12);
            },
            key: function (k, key, isDown) {
                if (!isDown || S.st !== 'open') return false;
                if (key === 'ArrowUp' || key === 'ArrowDown') { S.ro = Math.round(S.ro) + (key === 'ArrowUp' ? 1 : -1); S.vel = 0; k.sfx('tick'); return true; }
                if (key === ' ' || key === 'Enter') { seal(k); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, c = S.cur, i;
                blit(ctx, S.bg, 0, 0);
                glow(ctx, W * 0.5, g.top + 6, H * 0.5, 'rgba(255,214,140,0.14)');
                if (c) {
                    var gap = g.amp * 2.4 + 8, jp = S.st === 'join' ? eo(S.jt / 0.45) : (S.st === 'miss' ? eo(clamp((S.jt - 0.7) / 0.5, 0, 1)) : 0);
                    var n = c.o.length, base = Math.round(S.ro);
                    // reel of left halves
                    ctx.save(); ctx.beginPath(); ctx.rect(0, g.top, g.seam + g.amp + 2, g.desk - g.top + 14); ctx.clip();
                    for (var j = -2; j <= 2; j++) {
                        var ii = base + j, y = g.cy + (ii - S.ro) * g.ih, o = c.o[modn(ii, n)], d = Math.abs(ii - S.ro), center = d < 0.5;
                        if (y < g.top - g.ph || y > H + g.ph) continue;
                        ctx.globalAlpha = clamp(1 - d * 0.6, 0.12, 1);
                        var xr = g.seam - (center ? gap * (1 - jp) : gap), xs = S.gust > 0 && !center ? Math.sin(t * 30 + j) * 2 * S.gust : 0;
                        piece(ctx, k, g, g.x0 + xs, y - g.ph / 2, xr + xs, y + g.ph / 2, 'r', o.pat, o.s, null, S.st === 'miss' && center, center && S.wrongT > 0, center ? S.burn : 0);
                    }
                    ctx.restore(); ctx.globalAlpha = 1;
                    // reel arrows
                    if (S.st === 'open') {
                        txt(ctx, '▲', g.x0 + (g.seam - g.x0) / 2, Math.max(g.top + 8, g.cy - g.ph * 0.5 - 12), font(14, 900), 'rgba(255,231,163,' + (0.5 + 0.3 * Math.sin(t * 5)) + ')');
                        txt(ctx, '▼', g.x0 + (g.seam - g.x0) / 2, Math.min(g.desk + 6, g.cy + g.ph * 0.5 + 12), font(14, 900), 'rgba(255,231,163,' + (0.5 + 0.3 * Math.sin(t * 5)) + ')');
                    }
                    // fixed right half (book name / objection)
                    piece(ctx, k, g, g.seam, g.cy - g.ph / 2, g.x1, g.cy + g.ph / 2, 'l', c.pat, c.top, c.obj ? 'اعتراض' : (c.sub || ''), false, false, 0);
                    // seam glow + wax seal on join
                    if (S.st === 'join') {
                        var sp = eob(clamp((S.jt - 0.35) / 0.35, 0, 1));
                        glow(ctx, g.seam, g.cy, g.ph * (0.6 + sp * 0.4), 'rgba(255,231,163,' + (0.5 * (1 - S.jt / 1.15)) + ')');
                        if (sp > 0) {
                            ctx.save(); ctx.translate(g.seam, g.cy + g.ph * 0.5 - 4); ctx.scale(sp, sp);
                            ctx.fillStyle = '#a3241c'; ctx.beginPath(); circ(ctx, 0, 0, 15); ctx.fill();
                            ctx.strokeStyle = '#6e120c'; ctx.lineWidth = 2; ctx.stroke();
                            drawCross(ctx, 0, 0, 8, C.goldL, k.dpr);
                            ctx.restore();
                        }
                    }
                    // candle timer
                    if (W - g.x1 > 44) drawCandle(ctx, k, (g.x1 + W) / 2 + 4, g.cy, g.ph, S.st === 'open' ? clamp(1 - S.t / S.T, 0, 1) : (S.st === 'miss' ? 0 : clamp(1 - S.t / S.T, 0, 1)), t);
                    else ring(ctx, g.x1 - 18, g.cy - g.ph / 2 - 14, 10, 1 - S.t / S.T, S.t > S.T * 0.7 ? '#e0443a' : C.goldL, 3);
                    if (S.ph === 0 && S.ri === 0 && S.st === 'open' && S.t < 6) {
                        ctx.globalAlpha = clamp(6 - S.t, 0, 1);
                        txt(ctx, '⇅ لف البكرة… وبص على شكل القطع', (g.x0 + g.seam) / 2, g.top + 4, font(13, 900), '#fff', 'center', 4);
                        ctx.globalAlpha = 1;
                    }
                }
                // progress of this phase (scroll seals on the desk)
                var L = RR[clamp(S.ph, 0, 2)].length;
                if (S.ph >= 0) for (i = 0; i < L; i++) {
                    var px = W / 2 + (i - (L - 1) / 2) * 24, py = H - 10, dn = i < S.done.length;
                    ctx.fillStyle = dn ? (S.done[i] ? C.gold : '#7a6a55') : 'rgba(255,240,200,0.18)';
                    ctx.beginPath(); circ(ctx, px, py, 7); ctx.fill();
                    if (dn && S.done[i]) drawCross(ctx, px, py, 5, '#7a1f1f', k.dpr);
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 2. studyLamp -- طرق دراسة الكتاب المقدس («سراج لرجلي كلامك» مز ١١٩: ١٠٥)
     * A dark catacomb maze; only your oil lamp lights a small circle around you.
     * Hold and drag like a joystick (or hold toward where you want to go, or the
     * arrow keys) to walk the corridors. Unlit lamp stands glow faintly, each
     * named after a way to study the Bible. The clue on top is a method's motto
     * (with the doc's example): find and light the matching stand, in order;
     * every lit stand lights the maze a bit more. Phase 1: methods 1-5. Phase 2:
     * methods 6-10, and shadows of evil thoughts wander the corridors. Phase 3
     * (twist): analyse Matthew 6 -- is this line a commandment, a promise, a
     * fact or a parable-image? Data: methods[{name, slogan, ex}],
     * analysis[{kind, t}], shadows[], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.studyLamp = function (host, data, api) {
        data = data || {};
        var meth = (data.methods || []).filter(function (m) { return m && m.name && m.slogan; }).map(function (m) { return { name: plain(m.name), slogan: plain(m.slogan), ex: plain(m.ex || '') }; });
        var ana = (data.analysis || []).filter(function (a) { return a && a.kind && a.t; }).map(function (a) { return { kind: plain(a.kind), t: plain(a.t) }; });
        var shL = strList(data.shadows);
        if (!shL.length) shL = ['…'];
        if (!meth.length) meth = [{ name: '…', slogan: '…', ex: '' }];
        var m1 = meth.slice(0, 5), m2 = meth.slice(5, 10);
        if (!m2.length) m2 = m1.slice();
        var kinds = [];
        ana.forEach(function (a) { if (kinds.indexOf(a.kind) < 0) kinds.push(a.kind); });
        function mphase(list) { return { stands: list.map(function (m) { return m.name; }), tg: list.map(function (m, i) { return { s: m.slogan, ex: m.ex, st: i }; }) }; }
        var PH = [mphase(m1), mphase(m2), kinds.length >= 2 ? { stands: kinds, tg: shuffle(ana).map(function (a) { return { s: a.t, ex: '', st: kinds.indexOf(a.kind) }; }) } : mphase(m1)];
        PH[0].T = 26; PH[1].T = 24; PH[2].T = 24;
        PH[0].sh = 0; PH[1].sh = 2; PH[2].sh = 3;
        PH[0].ss = 0; PH[1].ss = 1.35; PH[2].ss = 1.7;
        var NT = PH[0].tg.length + PH[1].tg.length + PH[2].tg.length;
        var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], SPD = 4.6, C0 = 0, R0 = 0;
        var S = { ph: -1, open: null, cells: [], stands: [], pc: 0, pr: 0, px: 0, py: 0, mv: null, face: -1, anc: null, kd: -1, keys: [false, false, false, false],
            tgs: [], tg: null, ti: 0, tt: 0, T: 26, sh: [], inv: 0, boostT: 0, bonus: 0, active: false, walk: 0, litN: 0 };
        function G(k) {
            var W = k.W, H = k.H, top = 60;
            if (!C0) { var land = W >= H; C0 = land ? 15 : 8; R0 = land ? 6 : 11; }
            var cs = Math.floor(Math.min((W - 16) / C0, (H - top - 6) / R0));
            return { W: W, H: H, cs: cs, ox: Math.round((W - cs * C0) / 2), oy: Math.round(top + (H - top - 6 - cs * R0) / 2), top: top };
        }
        function genMaze() {
            var N = C0 * R0, open = [], seen = [], st = [], i;
            for (i = 0; i < N; i++) { open.push(0); seen.push(false); }
            var s0 = Math.floor(Math.random() * N); seen[s0] = true; st.push(s0);
            while (st.length) {
                var c = st[st.length - 1], cx = c % C0, cy = (c - cx) / C0, nb = [];
                for (var d = 0; d < 4; d++) { var nx = cx + DX[d], ny = cy + DY[d]; if (nx >= 0 && ny >= 0 && nx < C0 && ny < R0 && !seen[nx + ny * C0]) nb.push(d); }
                if (!nb.length) { st.pop(); continue; }
                var dd = nb[Math.floor(Math.random() * nb.length)], ni = cx + DX[dd] + (cy + DY[dd]) * C0;
                open[c] |= 1 << dd; open[ni] |= 1 << ((dd + 2) % 4); seen[ni] = true; st.push(ni);
            }
            var extra = Math.round(N * 0.16);
            for (i = 0; i < extra; i++) {
                var cc = Math.floor(Math.random() * N), x2 = cc % C0, y2 = (cc - x2) / C0, d2 = Math.floor(Math.random() * 4), x3 = x2 + DX[d2], y3 = y2 + DY[d2];
                if (x3 < 0 || y3 < 0 || x3 >= C0 || y3 >= R0) continue;
                open[cc] |= 1 << d2; open[x3 + y3 * C0] |= 1 << ((d2 + 2) % 4);
            }
            return open;
        }
        function can(cx, cy, d) { return !!(S.open[cx + cy * C0] & (1 << d)); }
        function bfs(from) {
            var N = C0 * R0, dist = [], q = [from], h = 0, i;
            for (i = 0; i < N; i++) dist.push(-1);
            dist[from] = 0;
            while (h < q.length) {
                var c = q[h++], cx = c % C0, cy = (c - cx) / C0;
                for (var d = 0; d < 4; d++) if (S.open[c] & (1 << d)) { var ni = cx + DX[d] + (cy + DY[d]) * C0; if (dist[ni] < 0) { dist[ni] = dist[c] + 1; q.push(ni); } }
            }
            return dist;
        }
        function placeStands(K2) {
            var start = S.pc + S.pr * C0, dist = bfs(start), N = C0 * R0, picks = [], i;
            for (var s = 0; s < K2; s++) {
                var best = -1, bv = -1;
                for (i = 0; i < N; i++) {
                    if (i === start || picks.indexOf(i) >= 0 || dist[i] < 3) continue;
                    var md = 99, ix = i % C0, iy = (i - ix) / C0;
                    for (var j = 0; j < picks.length; j++) { var qx = picks[j] % C0, qy = (picks[j] - qx) / C0; md = Math.min(md, Math.abs(qx - ix) + Math.abs(qy - iy)); }
                    var deg = 0;
                    for (var d = 0; d < 4; d++) if (S.open[i] & (1 << d)) deg++;
                    var v = Math.min(md, 6) * 3 + Math.min(dist[i], 12) * 0.5 + (deg === 1 ? 2 : 0) + Math.random();
                    if (v > bv) { bv = v; best = i; }
                }
                if (best < 0) best = modn(start + 1 + s, N);
                picks.push(best);
            }
            return shuffle(picks);
        }
        function farCell() {
            var dist = bfs(S.pc + S.pr * C0), best = 0, bv = -1;
            for (var i = 0; i < dist.length; i++) { var v = dist[i] + Math.random() * 3; if (S.cells.indexOf(i) < 0 && v > bv) { bv = v; best = i; } }
            return best;
        }
        function buildMaze(k) {
            var g = S.g, W = g.W, H = g.H, cs = g.cs;
            S.mz = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#1d1424', '#251a2c', '#160f1a']); x.fillRect(0, 0, W, H);
                if (!S.open) return;
                var r = seeded(5), cx, cy;
                for (cy = 0; cy < R0; cy++) for (cx = 0; cx < C0; cx++) {
                    var X = g.ox + cx * cs, Y = g.oy + cy * cs;
                    x.fillStyle = (cx + cy) % 2 ? '#43363f' : '#3c3039'; x.fillRect(X, Y, cs, cs);
                    x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(X + cs * 0.15 + r() * cs * 0.6, Y + cs * 0.15 + r() * cs * 0.6, 3, 2);
                    if (r() < 0.06) { x.font = font(cs * 0.3, 700); x.fillStyle = 'rgba(226,179,77,0.18)'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(K.glyphAt(Math.floor(r() * 30)), X + cs / 2, Y + cs / 2); }
                }
                var wl = Math.max(3, cs * 0.17);
                x.lineCap = 'round';
                x.beginPath();
                for (cy = 0; cy < R0; cy++) for (cx = 0; cx < C0; cx++) {
                    var o = S.open[cx + cy * C0], X2 = g.ox + cx * cs, Y2 = g.oy + cy * cs;
                    if (!(o & 1)) { x.moveTo(X2, Y2); x.lineTo(X2 + cs, Y2); }
                    if (!(o & 8)) { x.moveTo(X2, Y2); x.lineTo(X2, Y2 + cs); }
                    if (cx === C0 - 1 && !(o & 2)) { x.moveTo(X2 + cs, Y2); x.lineTo(X2 + cs, Y2 + cs); }
                    if (cy === R0 - 1 && !(o & 4)) { x.moveTo(X2, Y2 + cs); x.lineTo(X2 + cs, Y2 + cs); }
                }
                x.strokeStyle = '#5a3a1e'; x.lineWidth = wl + 2; x.stroke();
                x.strokeStyle = '#c9a66b'; x.lineWidth = wl; x.stroke();
                x.strokeStyle = 'rgba(255,236,190,0.35)'; x.lineWidth = Math.max(1, wl * 0.25); x.stroke();
            });
        }
        function layout(k) {
            var g = G(k);
            S.g = g;
            if (!S.open) { S.open = genMaze(); setupStands(PH[0]); }
            buildMaze(k);
            S.dk = mkCanvas(g.W, g.H, k.dpr);
        }
        function setupStands(P) {
            S.pc = C0 - 1; S.pr = Math.floor(R0 / 2); S.px = S.pc; S.py = S.pr; S.mv = null;
            S.cells = placeStands(P.stands.length);
            S.stands = P.stands.map(function (l, i) { return { label: l, lit: false, litT: 0, wrongFor: -1, c: S.cells[i] }; });
        }
        function startPhase(k, n) {
            S.ph = n; S.active = false;
            var P = PH[n];
            if (n > 0) { S.open = genMaze(); setupStands(P); buildMaze(k); }
            S.sh = [];
            S.tgs = P.tg; S.ti = -1; S.tg = null;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () {
                S.active = true;
                for (var i = 0; i < P.sh; i++) { var c = farCell(); S.sh.push({ c: c % C0, r: (c - c % C0) / C0, x: c % C0, y: (c - c % C0) / C0, mv: null, d: Math.floor(Math.random() * 4), lab: shL[i % shL.length] }); }
                nextTarget(k);
            });
        }
        function nextTarget(k) {
            S.ti++;
            if (S.ti >= S.tgs.length) {
                S.active = false; S.tg = null;
                if (S.ph >= 2) { k.finish({ title: 'السرداب كله نوّر! 🪔', finaleT: 2.2 }); return; }
                var n2 = S.ph + 1;
                k.after(0.9, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                return;
            }
            S.tg = S.tgs[S.ti]; S.tt = 0; S.T = PH[S.ph].T + (S.bonus ? 6 : 0); S.bonus = 0;
            k.sfx('page');
        }
        function cellXY(c, r) { var g = S.g; return [g.ox + (c + 0.5) * g.cs, g.oy + (r + 0.5) * g.cs]; }
        function arrive(k) {
            var ci = S.pc + S.pr * C0, si = S.cells.indexOf(ci), g = S.g;
            if (si < 0 || !S.tg) return;
            var st = S.stands[si], P = cellXY(S.pc, S.pr);
            if (si === S.tg.st) {
                var fast = S.tt < S.T * 0.45;
                if (!st.lit) S.litN++;
                st.lit = true; st.litT = 0;
                k.hit(fast ? 10 : 6, P[0], P[1] - g.cs * 0.7, { text: '🪔 ' });
                k.emit(P[0], P[1], 20, { colors: [C.goldL, '#fff3cf', '#ffb347'], up: 60 });
                k.glyphBurst(P[0], P[1] - 10, 4);
                nextTarget(k);
            } else if (!st.lit && st.wrongFor !== S.ti) {
                st.wrongFor = S.ti;
                k.pop(P[0], P[1] - g.cs * 0.9, st.label, '#ffe9b8', 13);
                if (k.loseLife(P[0], P[1] - g.cs * 0.45, 'مش دي الطريقة') <= 0) k.finish({ lose: true, title: 'ولا يهمك… السراج لسه منوّر، جرّب تاني', finaleT: 1.2 });
            }
        }
        function wantDirs(k) {
            if (S.kd >= 0 && S.keys[S.kd]) return [S.kd];
            if (!k.pdown || !S.anc) return [];
            var g = S.g, vx = k.px - S.anc.x, vy = k.py - S.anc.y;
            if (vx * vx + vy * vy < 256) {
                var P = cellXY(S.px, S.py);
                vx = k.px - P[0]; vy = k.py - P[1];
                if (vx * vx + vy * vy < g.cs * g.cs * 0.12) return [];
            }
            var hx = vx > 0 ? 1 : 3, hy = vy > 0 ? 2 : 0;
            return Math.abs(vx) >= Math.abs(vy) ? [hx, hy] : [hy, hx];
        }
        function stepPlayer(k, dt) {
            var ds = wantDirs(k), i;
            if (S.mv) {
                if (ds.length && ds[0] === (S.mv.d + 2) % 4) S.mv = { d: ds[0], fc: S.mv.tc, fr: S.mv.tr, tc: S.mv.fc, tr: S.mv.fr, t: 1 - S.mv.t };
                S.mv.t += dt * SPD;
                S.walk += dt * 9;
                if (S.mv.t < 1) { S.px = lerp(S.mv.fc, S.mv.tc, S.mv.t); S.py = lerp(S.mv.fr, S.mv.tr, S.mv.t); return; }
                S.pc = S.mv.tc; S.pr = S.mv.tr; S.mv = null;
                S.px = S.pc; S.py = S.pr;
                arrive(k);
                if (k.state !== 'play' || !S.active) return;
                ds = wantDirs(k);
            }
            S.px = S.pc; S.py = S.pr;
            for (i = 0; i < ds.length; i++) if (can(S.pc, S.pr, ds[i])) {
                S.mv = { d: ds[i], fc: S.pc, fr: S.pr, tc: S.pc + DX[ds[i]], tr: S.pr + DY[ds[i]], t: 0 };
                if (ds[i] === 1) S.face = 1; else if (ds[i] === 3) S.face = -1;
                break;
            }
        }
        function stepShadow(s, dt, sp) {
            if (!s.mv) {
                var opts = [], d, j;
                for (d = 0; d < 4; d++) if (can(s.c, s.r, d) && d !== (s.d + 2) % 4) opts.push(d);
                if (!opts.length) opts.push((s.d + 2) % 4);
                var pick = opts[Math.floor(Math.random() * opts.length)];
                if (Math.random() < 0.3) {
                    var bv = 1e9;
                    for (j = 0; j < opts.length; j++) { var v = Math.abs(s.c + DX[opts[j]] - S.px) + Math.abs(s.r + DY[opts[j]] - S.py); if (v < bv) { bv = v; pick = opts[j]; } }
                }
                s.d = pick; s.mv = { fc: s.c, fr: s.r, tc: s.c + DX[pick], tr: s.r + DY[pick], t: 0 };
            }
            s.mv.t += dt * sp;
            if (s.mv.t >= 1) { s.c = s.mv.tc; s.r = s.mv.tr; s.mv = null; s.x = s.c; s.y = s.r; }
            else { s.x = lerp(s.mv.fc, s.mv.tc, s.mv.t); s.y = lerp(s.mv.fr, s.mv.tr, s.mv.t); }
        }
        function shoo(k, s) {
            var P = cellXY(s.x, s.y);
            k.emit(P[0], P[1], 14, { colors: ['#6a4a8a', '#2a1a3a', '#fff'], grav: -40 });
            var c = farCell();
            s.c = c % C0; s.r = (c - s.c) / C0; s.x = s.c; s.y = s.r; s.mv = null;
        }
        function lightR() { return S.g.cs * (1.55 + 0.2 * S.litN + (S.boostT > 0 ? 1.1 : 0)); }
        function drawStand(ctx, k, X, Y, cs, lit, t) {
            var s = cs / 46;
            ctx.fillStyle = '#6b4a2a'; rr(ctx, X - 3.5 * s, Y - 4 * s, 7 * s, 16 * s, 2); ctx.fill();
            ctx.fillStyle = '#4a2c14'; rr(ctx, X - 10 * s, Y + 11 * s, 20 * s, 5 * s, 2); ctx.fill();
            ctx.fillStyle = lit ? C.gold : '#9a7a4a';
            ctx.beginPath(); ctx.ellipse(X, Y - 7 * s, 10 * s, 5 * s, 0, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.moveTo(X - 8 * s, Y - 9 * s); ctx.lineTo(X - 16 * s, Y - 12 * s); ctx.lineTo(X - 9 * s, Y - 4 * s); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 1; ctx.stroke();
            if (lit) flame(ctx, X - 15 * s, Y - 15 * s, 4.5 * s, t);
            else { ctx.fillStyle = 'rgba(255,140,60,' + (0.4 + 0.25 * Math.sin(t * 3 + X)) + ')'; ctx.beginPath(); circ(ctx, X - 15 * s, Y - 13 * s, 2.2 * s); ctx.fill(); }
        }

        var k = createCore(host, data, api, {
            title: 'سراج لرجلي', icon: '🪔',
            howto: { kind: 'drag', text: 'دوس واسحب ناحية الاتجاه اللي عايز تمشي فيه (أو استخدم الأسهم). دوّر في الضلمة على السراج اللي اسمه طريقة الدراسة المكتوبة فوق.' },
            comboStep: 4, maxMult: 3, pad: [110, 164.8], lives: 3, factY: 0.2,
            rawMax: function (k) { return perfectSeq(k, rep(NT, 10)) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.boostT = 12; S.bonus = 1; return '✨ كلمتك نوّرت الطريق أكتر'; },
            update: function (k, dt) {
                var i, P = PH[clamp(S.ph, 0, 2)];
                S.boostT = Math.max(0, S.boostT - dt); S.inv = Math.max(0, S.inv - dt);
                for (i = 0; i < S.stands.length; i++) if (S.stands[i].lit) S.stands[i].litT += dt;
                if (!S.active || !S.tg) return;
                stepPlayer(k, dt);
                if (k.state !== 'play' || !S.active || !S.tg) return;
                S.tt += dt;
                if (S.tt >= S.T) {
                    var st = S.stands[S.tg.st];
                    if (st) { if (!st.lit) S.litN++; st.lit = true; var Q = cellXY(st.c % C0, (st.c - st.c % C0) / C0); k.pop(Q[0], Q[1] - S.g.cs * 0.8, st.label, C.goldL, 14); }
                    if (k.loseLife(S.g.W / 2, S.g.top + 30, 'الوقت خلص') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… السراج لسه منوّر، جرّب تاني', finaleT: 1.2 }); return; }
                    nextTarget(k);
                    return;
                }
                for (i = 0; i < S.sh.length; i++) {
                    var s = S.sh[i];
                    stepShadow(s, dt, P.ss);
                    if (!s.mv && S.cells.indexOf(s.c + s.r * C0) >= 0 && S.stands[S.cells.indexOf(s.c + s.r * C0)].lit) { shoo(k, s); continue; }
                    if (S.inv <= 0 && Math.abs(s.x - S.px) + Math.abs(s.y - S.py) < 0.6) {
                        S.inv = 1.8;
                        var PP = cellXY(S.px, S.py);
                        shoo(k, s);
                        if (k.loseLife(PP[0], PP[1] - S.g.cs * 0.6, s.lab + '!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… كلمة ربنا أقوى، جرّب تاني', finaleT: 1.2 }); return; }
                    }
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 6) k.emit(rand(0, k.W), k.H * 0.4, 3, { colors: [C.goldL, '#fff3cf'], grav: 50, up: 40 });
            },
            down: function (k, p) { S.anc = { x: p.x, y: p.y }; },
            up: function (k) { S.anc = null; },
            key: function (k, key, isDown) {
                var m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[key];
                if (m == null) return false;
                S.keys[m] = isDown;
                if (isDown) S.kd = m;
                else if (S.kd === m) { S.kd = -1; for (var i = 0; i < 4; i++) if (S.keys[i]) S.kd = i; }
                return true;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, cs = g.cs, i, P;
                blit(ctx, S.mz, 0, 0);
                // lamp stands
                for (i = 0; i < S.stands.length; i++) { var st = S.stands[i]; P = cellXY(st.c % C0, (st.c - st.c % C0) / C0); drawStand(ctx, k, P[0], P[1], cs, st.lit, t); }
                // shadows of evil thoughts
                for (i = 0; i < S.sh.length; i++) {
                    var sh = S.sh[i]; P = cellXY(sh.x, sh.y);
                    var wob = Math.sin(t * 4 + i) * cs * 0.05;
                    ctx.fillStyle = 'rgba(20,8,30,0.85)';
                    ctx.beginPath(); ell(ctx, P[0], P[1] + wob, cs * 0.32, cs * 0.36); ell(ctx, P[0] - cs * 0.18, P[1] + cs * 0.22, cs * 0.12, cs * 0.12); ell(ctx, P[0] + cs * 0.18, P[1] + cs * 0.24, cs * 0.12, cs * 0.1); ctx.fill();
                    ctx.fillStyle = '#c86bff'; ctx.beginPath(); circ(ctx, P[0] - cs * 0.1, P[1] - cs * 0.06 + wob, cs * 0.05); circ(ctx, P[0] + cs * 0.1, P[1] - cs * 0.06 + wob, cs * 0.05); ctx.fill();
                }
                // the reader with the lamp
                P = cellXY(S.px, S.py);
                var blink = S.inv > 0 && Math.floor(t * 10) % 2 === 0;
                if (!blink) youth(ctx, k, P[0], P[1] + cs * 0.42, cs * 0.95, S.face, S.mv ? S.walk : -1, '#f3ead6', { prop: 'torch', arm: 2.3 });
                // darkness with light holes
                if (S.dk) {
                    var x = S.dk.getContext('2d');
                    x.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
                    x.globalCompositeOperation = 'source-over';
                    x.clearRect(0, 0, W, H);
                    x.fillStyle = 'rgba(6,3,12,' + (S.ph < 0 ? 0.6 : 0.93) + ')'; x.fillRect(0, 0, W, H);
                    x.globalCompositeOperation = 'destination-out';
                    hole(x, P[0], P[1], lightR() * (1 + Math.sin(t * 6) * 0.03));
                    for (i = 0; i < S.stands.length; i++) if (S.stands[i].lit) { var Q = cellXY(S.stands[i].c % C0, (S.stands[i].c - S.stands[i].c % C0) / C0); hole(x, Q[0], Q[1], cs * 1.3 * clamp(S.stands[i].litT * 2, 0.2, 1)); }
                    if (S.tg && S.tt > S.T * 0.45) { var tq = S.stands[S.tg.st]; if (tq) { var Q2 = cellXY(tq.c % C0, (tq.c - tq.c % C0) / C0); hole(x, Q2[0], Q2[1], cs * (0.7 + 0.25 * Math.sin(t * 5))); } }
                    x.globalCompositeOperation = 'source-over';
                    ctx.drawImage(S.dk, 0, 0, W, H);
                }
                // faint embers of unlit stands + labels where there is light
                var LR = lightR();
                for (i = 0; i < S.stands.length; i++) {
                    var s2 = S.stands[i], Q3 = cellXY(s2.c % C0, (s2.c - s2.c % C0) / C0);
                    var near = dist2(Q3[0], Q3[1], P[0], P[1]) < LR * LR * 0.8, hint = S.tg && S.tg.st === i && S.tt > S.T * 0.45;
                    if (!s2.lit) { ctx.fillStyle = 'rgba(255,170,80,' + (0.35 + 0.2 * Math.sin(t * 3 + i)) + ')'; ctx.beginPath(); circ(ctx, Q3[0] - cs * 0.32, Q3[1] - cs * 0.28, 2.5); ctx.fill(); }
                    if (s2.lit || near || hint || S.ph < 0) chip(ctx, s2.label, Q3[0], Q3[1] - cs * 0.62, clamp(cs * 0.24, 9, 13), s2.lit ? 'rgba(142,31,31,0.9)' : 'rgba(40,25,50,0.85)', s2.lit ? '#ffe9b8' : '#f0e0ff', hint ? C.goldL : null);
                }
                // the clue
                if (S.tg) {
                    var cw = Math.min(W - 250, 560);
                    ctx.fillStyle = 'rgba(70,12,12,0.9)'; rr(ctx, W / 2 - cw / 2, 8, cw, S.tg.ex ? 46 : 34, 12); ctx.fill();
                    ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5; ctx.stroke();
                    block(ctx, S.tg.s, W / 2, 24, cw - 40, 24, 15, 900, '#fff5d6', 1);
                    if (S.tg.ex) block(ctx, S.tg.ex, W / 2, 44, cw - 30, 14, 11, 700, '#f5d99a', 1);
                    ring(ctx, W / 2 + cw / 2 - 16, 24, 9, 1 - S.tt / S.T, S.tt > S.T * 0.7 ? '#e0443a' : C.goldL, 3);
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 3. catholiconMail -- رسائل الكاثوليكون (الجامعة)
     * You are the messenger leaving Jerusalem. Roads fork twice before the four
     * houses of the writers (James, Peter, John, Jude). Tap the three junction
     * signs to switch them so each messenger walks to the right house; the
     * messenger reads the sign as he reaches it. Phase 1: the letter's name.
     * Phase 2: its main idea, two messengers on the road. Phase 3 (twist): a
     * verse from the letter, faster, and the houses swap places.
     * Data: writers[{name}] x4, letters[{name, w, theme}], verses[{t, w}],
     * questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.catholiconMail = function (host, data, api) {
        data = data || {};
        var WR = (data.writers || []).map(function (w) { return plain(w && w.name ? w.name : w); }).filter(function (s) { return s && s !== 'undefined'; }).slice(0, 4);
        while (WR.length < 4) WR.push('…');
        var LET = (data.letters || []).filter(function (l) { return l && l.name && typeof l.w === 'number' && l.w >= 0 && l.w < 4; });
        var VER = (data.verses || []).filter(function (v) { return v && v.t && typeof v.w === 'number' && v.w >= 0 && v.w < 4; });
        var P1 = shuffle(LET.map(function (l) { return { s: plain(l.name), w: l.w }; }));
        var P2 = shuffle(LET.filter(function (l) { return l.theme; }).map(function (l) { return { s: plain(l.theme), w: l.w }; }));
        var P3 = shuffle(VER.map(function (v) { return { s: plain(v.t), w: v.w }; })).slice(0, 6);
        if (!P1.length) P1 = [{ s: '…', w: 1 }];
        if (!P2.length) P2 = P1.slice();
        if (!P3.length) P3 = P2.slice();
        for (var f0 = 1; f0 < P1.length && P1[0].w === 0; f0++) { var tmp = P1[0]; P1[0] = P1[f0]; P1[f0] = tmp; }
        var PLAN = [P1, P2, P3], NL = P1.length + P2.length + P3.length;
        var PH = [{ sp: 0.115, gap: 99 }, { sp: 0.13, gap: 3.6 }, { sp: 0.14, gap: 2.8 }];
        var COL = ['#8e1f1f', '#1f6fa3', '#6f8a3a', '#7a4a8a'], ROBES = ['#e9e1cf', '#d9c7a1', '#cfd8e3', '#e8d5c4'];
        var NN = { S: [0.98, 0.56], J1: [0.76, 0.56], J2: [0.52, 0.355], J3: [0.52, 0.765] }, DYS = [0.25, 0.46, 0.66, 0.87];
        var S = { ph: -1, sw: [0, 0, 0], swT: [0, 0, 0], doors: [0, 1, 2, 3], dpos: [0, 1, 2, 3], plan: [], planT: 0, ms: [], active: false, id: 0, flash: [0, 0, 0, 0], shuffleT: 0 };
        function bez(a, b, n) {
            var pts = [], mx = (a[0] + b[0]) / 2;
            for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; pts.push([u * u * u * a[0] + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * b[1]]); }
            return pts;
        }
        function mkPath(pts) {
            var cum = [0];
            for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.sqrt(dist2(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1])));
            return { p: pts, cum: cum, L: cum[cum.length - 1] || 1 };
        }
        function pAt(path, f) {
            var d = clamp(f, 0, 1) * path.L, c = path.cum, i = 1;
            while (i < c.length - 1 && c[i] < d) i++;
            var a = path.p[i - 1], b = path.p[i], t = (d - c[i - 1]) / Math.max(0.001, c[i] - c[i - 1]);
            return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), b[0] - a[0]];
        }
        function G(k) {
            var W = k.W, H = k.H, g = { W: W, H: H, rj: clamp(H * 0.1, 24, 44), ph: clamp(H * 0.15, 40, 84) };
            function P(a) { return [a[0] * W, a[1] * H]; }
            g.S = P(NN.S); g.J1 = P(NN.J1); g.J2 = P(NN.J2); g.J3 = P(NN.J3);
            g.D = DYS.map(function (y) { return [W * 0.2, H * y]; });
            g.E = { s: mkPath(bez(g.S, g.J1, 6)), a: mkPath(bez(g.J1, g.J2, 14)), b: mkPath(bez(g.J1, g.J3, 14)),
                d: [mkPath(bez(g.J2, g.D[0], 14)), mkPath(bez(g.J2, g.D[1], 14)), mkPath(bez(g.J3, g.D[2], 14)), mkPath(bez(g.J3, g.D[3], 14))] };
            g.hx = W * 0.085; g.hw = clamp(W * 0.1, 50, 110); g.hh = clamp(H * 0.15, 36, 80);
            return g;
        }
        function pathOf(m) { var E = S.g.E; return m.seg === 0 ? E.s : (m.seg === 1 ? (m.br ? E.b : E.a) : E.d[m.door]); }
        function roadLayer(k) {
            var g = S.g, W = g.W, H = g.H;
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#e9d29c', '#dcbc80', '#c9a066']); x.fillRect(0, 0, W, H);
                var r = seeded(17), i;
                for (i = 0; i < 60; i++) { x.fillStyle = r() < 0.5 ? 'rgba(110,70,30,0.15)' : 'rgba(90,120,50,0.18)'; x.beginPath(); ell(x, r() * W, r() * H, 2 + r() * 8, 1 + r() * 3); x.fill(); }
                for (i = 0; i < 6; i++) palm(x, W * (0.3 + r() * 0.36), H * (0.18 + (i % 2) * 0.72 + r() * 0.05), H * 0.13, r() - 0.5);
                function road(p) {
                    x.beginPath(); x.moveTo(p.p[0][0], p.p[0][1]);
                    for (var j = 1; j < p.p.length; j++) x.lineTo(p.p[j][0], p.p[j][1]);
                    x.lineCap = 'round'; x.lineJoin = 'round';
                    x.strokeStyle = '#a77d4a'; x.lineWidth = clamp(H * 0.075, 18, 34); x.stroke();
                    x.strokeStyle = '#f0dcae'; x.lineWidth = clamp(H * 0.055, 13, 26); x.stroke();
                }
                road(g.E.s); road(g.E.a); road(g.E.b); for (i = 0; i < 4; i++) road(g.E.d[i]);
                // Jerusalem gate (start)
                var gx = W * 0.955, gy = g.S[1], gs = clamp(H * 0.3, 70, 150);
                x.fillStyle = '#c9a77a'; x.fillRect(gx - gs * 0.3, gy - gs * 0.62, gs * 0.6, gs * 0.62 + 6);
                x.beginPath(); x.arc(gx, gy - gs * 0.62, gs * 0.2, Math.PI, 0); x.fill();
                x.fillStyle = 'rgba(60,35,15,0.7)'; x.beginPath(); x.arc(gx, gy - gs * 0.2, gs * 0.12, Math.PI, 0); x.lineTo(gx + gs * 0.12, gy + 6); x.lineTo(gx - gs * 0.12, gy + 6); x.closePath(); x.fill();
                copticCross(x, gx, gy - gs * 0.9, gs * 0.07, C.gold, 'rgba(40,20,0,0.5)', 1);
                for (i = -1; i <= 1; i += 2) { x.fillStyle = '#b8926a'; x.fillRect(gx + i * gs * 0.3 - gs * 0.06, gy - gs * 0.78, gs * 0.12, gs * 0.78 + 6); }
            });
        }
        function layout(k) { S.g = G(k); roadLayer(k); }
        function startPhase(k, n) {
            S.ph = n; S.active = false; S.plan = PLAN[n].slice(); S.planT = 0.5;
            if (n === 2) {
                var nd;
                do { nd = shuffle([0, 1, 2, 3]); } while (nd[0] === S.doors[0] && nd[1] === S.doors[1] && nd[2] === S.doors[2]);
                S.doorsOld = S.doors.slice(); S.doors = nd; S.shuffleT = 1.4; k.sfx('whoosh');
            }
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.6, function () { S.active = true; });
        }
        function walking(seg0) { for (var i = 0; i < S.ms.length; i++) if (S.ms[i].st === 'walk' && (!seg0 || S.ms[i].seg === 0)) return true; return false; }
        function spawn(k, it) { S.ms.push({ id: S.id++, it: it, seg: 0, f: 0, br: 0, door: -1, st: 'walk', t: 0, walk: 0 }); k.sfx('page'); }
        function toggle(k, j) {
            S.sw[j] ^= 1; S.swT[j] = 1; k.sfx('tick');
            var J = [S.g.J1, S.g.J2, S.g.J3][j];
            k.emit(J[0], J[1], 6, { colors: [C.goldL, '#fff'], grav: 120, vmin: 30, vmax: 90 });
        }
        function arriveDoor(k, m) {
            var g = S.g, D = g.D[m.door], ok = S.doors[m.door] === m.it.w;
            m.st = ok ? 'ok' : 'bad'; m.t = 0;
            if (ok) {
                S.flash[m.door] = 1;
                k.hit(10, D[0], D[1] - g.ph, { text: '✉️ ' });
                k.emit(D[0] - g.hw * 0.4, D[1], 18, { colors: [COL[S.doors[m.door]], C.goldL, '#fff'], up: 70 });
                k.glyphBurst(D[0] - g.hw * 0.4, D[1] - g.ph * 0.5, 3);
            } else {
                k.pop(D[0] + 20, D[1] - g.ph - 26, '← ' + WR[m.it.w], '#ffe9b8', 15);
                if (k.loseLife(D[0], D[1] - g.ph, 'مش ده كاتبها') <= 0) k.finish({ lose: true, title: 'ولا يهمك… راجع مين كتب كل رسالة وجرّب تاني', finaleT: 1.2 });
            }
        }
        function drawHouse(ctx, k, x, y, w, h, wi, fl, t) {
            var col = COL[wi];
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ell(ctx, x, y + 4, w * 0.6, h * 0.1); ctx.fill();
            ctx.fillStyle = '#e9dcc0'; ctx.fillRect(x - w / 2, y - h * 0.75, w, h * 0.75);
            ctx.beginPath(); ctx.arc(x, y - h * 0.75, w * 0.3, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(x - w / 2, y - h * 0.75, w, h * 0.75);
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - h * 0.3, w * 0.16, Math.PI, 0); ctx.lineTo(x + w * 0.16, y); ctx.lineTo(x - w * 0.16, y); ctx.closePath(); ctx.fill();
            copticCross(ctx, x, y - h * 0.75 - w * 0.36, clamp(w * 0.09, 5, 9), C.gold);
            if (fl > 0) glow(ctx, x, y - h * 0.4, w * 0.9, 'rgba(255,231,163,' + (0.6 * fl) + ')');
            chip(ctx, WR[wi], x, y - h * 0.58, clamp(h * 0.17, 10, 14), col, '#fff', C.goldL);
        }

        var k = createCore(host, data, api, {
            title: 'مرسال الكاثوليكون', icon: '✉️',
            howto: { kind: 'tap', text: 'اضغط على علامة التحويلة عشان تغيّر اتجاهها، وخلّي الطريق يوصّل المرسال لبيت الرسول اللي كتب الرسالة.' },
            comboStep: 4, maxMult: 3, pad: [146.8, 220], lives: 3, factY: 0.12,
            rawMax: function (k) { return perfectSeq(k, rep(NL, 10)) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 8; return '🕊️ المراسيل ماشيين بهدوء'; },
            update: function (k, dt) {
                var P = PH[clamp(S.ph, 0, 2)], g = S.g, i;
                S.slowT = Math.max(0, (S.slowT || 0) - dt); S.shuffleT = Math.max(0, S.shuffleT - dt);
                for (i = 0; i < 3; i++) S.swT[i] = Math.max(0, S.swT[i] - dt * 3);
                for (i = 0; i < 4; i++) S.flash[i] = Math.max(0, S.flash[i] - dt * 1.2);
                if (S.active && S.plan.length) {
                    S.planT -= dt;
                    var ready = P.gap > 50 ? !walking(false) : !walking(true);
                    if (S.planT <= 0 && ready) { spawn(k, S.plan.shift()); S.planT = P.gap > 50 ? 0.6 : P.gap; }
                }
                var sp = g.W * P.sp * (S.slowT > 0 ? 0.6 : 1);
                for (i = S.ms.length - 1; i >= 0; i--) {
                    var m = S.ms[i];
                    m.t += dt;
                    if (m.st === 'walk') {
                        m.walk += dt * 7;
                        var path = pathOf(m);
                        m.f += sp * dt / path.L;
                        if (m.f >= 1) {
                            var over = (m.f - 1) * path.L;
                            if (m.seg === 0) { m.seg = 1; m.br = S.sw[0]; m.f = over / pathOf(m).L; k.sfx('tick'); }
                            else if (m.seg === 1) { m.seg = 2; m.door = m.br * 2 + S.sw[1 + m.br]; m.f = over / pathOf(m).L; k.sfx('tick'); }
                            else { m.f = 1; arriveDoor(k, m); if (k.state !== 'play') return; }
                        }
                    } else if (m.t > (m.st === 'ok' ? 0.8 : 1.1)) S.ms.splice(i, 1);
                }
                if (S.active && !S.plan.length && !S.ms.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'كل الرسائل وصلت! ✉️', finaleT: 2.2 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.7, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 6) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: [COL[Math.floor(rand(0, 4))], C.goldL], grav: 60, up: 40 });
            },
            down: function (k, p) {
                var g = S.g, J = [g.J1, g.J2, g.J3], best = -1, bd = g.rj * g.rj * 2.2;
                for (var j = 0; j < 3; j++) { var d = dist2(p.x, p.y, J[j][0], J[j][1]); if (d < bd) { bd = d; best = j; } }
                if (best >= 0) toggle(k, best); else k.sfx('tap');
            },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                var j = '123'.indexOf(key);
                if (j < 0) return false;
                toggle(k, j); return true;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, E = g.E;
                blit(ctx, S.bg, 0, 0);
                // the chosen branches glow in gold
                function lit(p, a) {
                    ctx.beginPath(); ctx.moveTo(p.p[0][0], p.p[0][1]);
                    for (var j = 1; j < p.p.length; j++) ctx.lineTo(p.p[j][0], p.p[j][1]);
                    ctx.strokeStyle = 'rgba(226,179,77,' + a + ')'; ctx.lineWidth = clamp(H * 0.018, 4, 8); ctx.lineCap = 'round'; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]);
                }
                lit(S.sw[0] ? E.b : E.a, 0.85); lit(E.d[S.sw[1]], S.sw[0] ? 0.4 : 0.85); lit(E.d[2 + S.sw[2]], S.sw[0] ? 0.85 : 0.4);
                // houses of the writers
                for (i = 0; i < 4; i++) {
                    var hy = g.D[i][1] + g.hh * 0.35, sh = S.shuffleT > 0 && S.doorsOld ? 1 - eo(1 - S.shuffleT / 1.4) : 0;
                    var wi = S.doors[i];
                    if (sh > 0) { var oi = S.doorsOld.indexOf(wi); hy = lerp(g.D[i][1], g.D[oi][1], sh) + g.hh * 0.35; }
                    drawHouse(ctx, k, g.hx, hy, g.hw, g.hh, wi, S.flash[i], t);
                    figure(ctx, { x: g.hx + g.hw * 0.62, y: hy, h: g.hh * 0.95, dir: 1, robe: ROBES[wi], mantle: COL[wi], hair: '#3a2414', beard: wi === 2 ? 0.4 : 1, halo: true, t: t + wi, dpr: k.dpr });
                }
                // junction signs
                var J = [g.J1, g.J2, g.J3];
                for (i = 0; i < 3; i++) {
                    var jx = J[i][0], jy = J[i][1], up = S.sw[i] === 0, sc = 1 + 0.25 * eob(1 - S.swT[i]) * (S.swT[i] > 0 ? 1 : 0);
                    var need = false;
                    for (var m2 = 0; m2 < S.ms.length; m2++) { var mm = S.ms[m2]; if (mm.st === 'walk' && ((i === 0 && mm.seg === 0) || (i > 0 && mm.seg === 1 && mm.br === i - 1))) need = true; }
                    ctx.fillStyle = need ? 'rgba(255,231,163,' + (0.35 + 0.25 * Math.sin(t * 7)) + ')' : 'rgba(255,240,200,0.22)';
                    ctx.beginPath(); circ(ctx, jx, jy, g.rj); ctx.fill();
                    ctx.strokeStyle = need ? C.goldL : 'rgba(110,70,30,0.6)'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.save(); ctx.translate(jx, jy); ctx.scale(sc, sc);
                    ctx.fillStyle = '#6b4220'; ctx.fillRect(-2.5, -g.rj * 0.15, 5, g.rj * 0.75);
                    ctx.rotate(up ? -0.55 : 0.55);
                    ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.moveTo(g.rj * 0.55, -g.rj * 0.2); ctx.lineTo(-g.rj * 0.35, -g.rj * 0.2); ctx.lineTo(-g.rj * 0.65, 0); ctx.lineTo(-g.rj * 0.35, g.rj * 0.2); ctx.lineTo(g.rj * 0.55, g.rj * 0.2); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = C.goldL; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.restore();
                    txt(ctx, ar(i + 1), jx + g.rj * 0.7, jy + g.rj * 0.75, font(11, 900), '#5b3212');
                }
                // messengers
                for (i = 0; i < S.ms.length; i++) {
                    var ms = S.ms[i], pp = pAt(pathOf(ms), ms.f), al = ms.st === 'walk' ? 1 : 1 - clamp(ms.t / 0.9, 0, 1);
                    ctx.save(); ctx.globalAlpha = al;
                    var hand = figure(ctx, { x: pp[0], y: pp[1] + g.ph * 0.35, h: g.ph, dir: -1, robe: '#f3ead6', mantle: COL[ms.id % 4], hair: '#2b1a0e', walk: ms.st === 'walk' ? ms.walk : -1, arm: 2.5, t: t, dpr: k.dpr });
                    ctx.fillStyle = '#f2e2b8'; rr(ctx, hand.x - 9, hand.y - 6, 18, 9, 4); ctx.fill();
                    ctx.fillStyle = '#a3241c'; ctx.beginPath(); circ(ctx, hand.x, hand.y - 1.5, 3); ctx.fill();
                    ctx.restore();
                    if (ms.st === 'walk') chip(ctx, ms.it.s, clamp(pp[0], 80, W - 80), pp[1] - g.ph * 0.78, clamp(H * 0.036, 10, 13), 'rgba(70,12,12,0.9)', '#fff5d6', C.gold);
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 4. seaOfDoubt -- يعقوب ١ («ليطلب بإيمان غير مرتاب البتة» يع ١: ٦)
     * A little boat rides a stormy sea of trials. Hold while sliding down a wave
     * to gain speed (and land smoothly), release while climbing to fly off the
     * crest and catch the blessings floating in the air. Phase 1: the blessings
     * of trials. Phase 2: winds of doubt -- dark clouds that whisper the devil's
     * lies (a life each), lightning. Phase 3 (twist): hearer or doer? catch only
     * the deeds of a doer of the word, dodge the hearer's excuses. Each phase
     * ends at a lighthouse church. Data: blessings[], doubts[], doers[],
     * hearers[], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.seaOfDoubt = function (host, data, api) {
        data = data || {};
        var bl = strList(data.blessings), db = strList(data.doubts), dr = strList(data.doers), hr = strList(data.hearers);
        if (!bl.length) bl = ['…'];
        if (!dr.length) dr = bl.slice();
        if (!db.length) db = ['…'];
        if (!hr.length) hr = db.slice();
        var PH = [{ good: rep(10, 0).map(function (v, i) { return bl[i % bl.length]; }), bad: [], D: 7, A: 0.11 },
            { good: rep(7, 0).map(function (v, i) { return bl[(i + 3) % bl.length]; }), bad: rep(6, 0).map(function (v, i) { return db[i % db.length]; }), D: 7.5, A: 0.14 },
            { good: rep(8, 0).map(function (v, i) { return dr[i % dr.length]; }), bad: rep(6, 0).map(function (v, i) { return hr[i % hr.length]; }), D: 8, A: 0.16 }];
        var NG = PH[0].good.length + PH[1].good.length + PH[2].good.length, LCAP = 8;
        var S = { ph: -1, u: 0, vx: 0, y: 0, vy: 0, ground: true, A: 0.1, p1: 0.7, p2: 2.1, items: [], uEnd: 0, active: false, keyHold: false, inv: 0, lands: 0, ang: 0, ltT: 3, slowT: 0, splash: 0, flyT: 0 };
        function G(k) {
            var W = k.W, H = k.H;
            return { W: W, H: H, bx: W * 0.64, by: H * 0.66, f1: TAU / (W * 0.55), f2: TAU / (W * 0.31), G: H * 2.3, vmin: W * 0.2, vmax: W * 0.8, L: clamp(W * 0.1, 56, 110) };
        }
        function h(u) { var g = S.g, A = S.A * g.H; return g.by + A * (0.62 * Math.sin(u * g.f1 + S.p1) + 0.38 * Math.sin(u * g.f2 + S.p2)); }
        function dh(u) { var g = S.g, A = S.A * g.H; return A * (0.62 * g.f1 * Math.cos(u * g.f1 + S.p1) + 0.38 * g.f2 * Math.cos(u * g.f2 + S.p2)); }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            if (S.g && S.g.W && S.g.W !== W) { var sc = W / S.g.W; S.u *= sc; S.uEnd *= sc; S.vx *= sc; for (var i = 0; i < S.items.length; i++) S.items[i].u *= sc; }
            S.g = g;
            if (!S.vx) { S.vx = g.vmin; S.y = h(S.u); }
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H * 0.75, ['#25385e', '#4a6a96', '#d9a77a']); x.fillRect(0, 0, W, H);
                x.fillStyle = 'rgba(40,50,80,0.45)'; ridge(x, W, H * 0.5, H * 0.07, 9, 3, H); x.fill();
            });
        }
        function mkItems(n) {
            var P = PH[n], g = S.g, list = [], i, seq = [];
            S.A = P.A;
            for (i = 0; i < P.good.length; i++) seq.push(1);
            for (i = 0; i < P.bad.length; i++) seq.push(0);
            seq = shuffle(seq);
            var gi = 0, bi = 0, u0 = S.u + g.W * 1.0, span = P.D * g.W - g.W * 1.4, step = span / Math.max(1, seq.length), A = P.A * g.H;
            for (i = 0; i < seq.length; i++) {
                var u = u0 + step * (i + rand(0.2, 0.8)), good = seq[i] === 1, air = good || Math.random() < 0.35;
                var y = 0;
                if (air) {
                    // just past a crest, where a good jump peaks
                    var uc = u, top = 1e9;
                    for (var q = -30; q <= 30; q++) { var hq = h(u + q * g.W * 0.01); if (hq < top) { top = hq; uc = u + q * g.W * 0.01; } }
                    u = uc + g.W * rand(0.06, 0.18); y = top - g.H * rand(0.16, 0.26);
                }
                list.push({ u: u, good: good, s: good ? P.good[gi++] : P.bad[bi++], air: air, y: Math.max(g.H * 0.16, y), st: 'on', t: 0 });
            }
            return list;
        }
        function startPhase(k, n) {
            S.ph = n; S.active = false; S.lands = 0;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.2, function () {
                S.items = mkItems(n); S.uEnd = S.u + PH[n].D * S.g.W; S.active = true;
            });
        }
        function itemY(it) { return it.air ? it.y : h(it.u) - S.g.H * 0.06; }
        function land(k, s) {
            var g = S.g, slopeV = S.vy / Math.max(1, S.vx), hold = k.pdown || S.keyHold;
            if (S.flyT < 0.25) return;
            if (hold && s > 0.06) {
                S.vx = Math.min(g.vmax, S.vx * 1.1);
                if (S.active && S.lands < LCAP) { S.lands++; k.addScore(2, g.bx, S.y - g.L * 0.7, 'نزلة ناعمة ', '#bfe8ff', 14); }
                k.emit(g.bx, S.y, 8, { colors: ['#e6f7ff', '#bfe8ff'], grav: 300, up: 60 });
            } else if (slopeV - s > 0.9) {
                S.vx *= 0.72; S.splash = 1;
                k.sfx('splash'); k.shake(3, 0.2);
                k.emit(g.bx, S.y, 16, { colors: ['#e6f7ff', '#5fb3d9', '#fff'], grav: 380, up: 120 });
            } else k.emit(g.bx, S.y, 5, { colors: ['#e6f7ff'], grav: 300, up: 40 });
        }

        var k = createCore(host, data, api, {
            title: 'موج التجارب', icon: '🌊',
            howto: { kind: 'hold', text: 'دوس مطوّل وانت نازل من على الموجة عشان تسرّع، وسيب وانت طالع عشان تطير فوق الموج وتلمّ البركات… وابعد عن سحاب الشك.' },
            comboStep: 4, maxMult: 3, pad: [116.5, 174.6], lives: 3, factY: 0.12,
            rawMax: function (k) { return perfectSeq(k, rep(NG, 10)) + 3 * LCAP * 2 + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.inv = 6; S.slowT = 6; return '🙏 «فليطلب من الله»: حماية من الشك'; },
            idle: function (k, dt) { S.p1 += dt * 0.2; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], hold = k.pdown || S.keyHold, i;
                S.A += (P.A - S.A) * Math.min(1, dt * 0.6);
                S.inv = Math.max(0, S.inv - dt); S.slowT = Math.max(0, S.slowT - dt); S.splash = Math.max(0, S.splash - dt * 2);
                var s = dh(S.u);
                if (S.ground) {
                    S.vx += s * g.G * (hold ? 0.95 : 0.28) * dt;
                    if (hold && s < 0) S.vx += s * g.G * 0.22 * dt;
                    S.vx -= hold ? S.vx * 0.04 * dt : (S.vx - g.vmin) * 0.6 * dt;
                }
                S.vx = clamp(S.vx, g.vmin * (S.slowT > 0 ? 0.8 : 1), g.vmax);
                S.u += S.vx * dt;
                S.vy += g.G * (hold ? 2.5 : 1) * dt;
                S.y += S.vy * dt;
                var gy = h(S.u), s3 = dh(S.u);
                if (S.ground) {
                    if (s3 < 0) S.upV = Math.min(S.upV || 0, s3 * S.vx);
                    else if (s > 0 && S.prevS <= 0) S.upV = 0;
                    if (S.prevS < 0 && s3 >= 0 && !hold && (S.upV || 0) < -g.H * 0.45) {
                        S.vy = S.upV * 1.15; S.y = gy - 2; S.ground = false; S.flyT = 0; S.upV = 0;
                        k.sfx('jump'); k.emit(g.bx, gy, 8, { colors: ['#e6f7ff', '#fff'], grav: 300, up: 80 });
                    }
                }
                S.prevS = s3;
                if (S.y >= gy && (S.ground || S.vy >= 0)) {
                    var s2 = dh(S.u);
                    if (!S.ground) land(k, s2);
                    S.y = gy; S.vy = s2 * S.vx; S.ground = true; S.flyT = 0;
                } else if (S.y < gy - 1) { S.ground = false; S.flyT += dt; }
                var tgt = S.ground ? -Math.atan(s) : -Math.atan(S.vy / Math.max(1, S.vx));
                S.ang += (tgt - S.ang) * Math.min(1, dt * 10);
                if (S.ph === 1 && S.active && !k.reduced) { S.ltT -= dt; if (S.ltT <= 0) { S.ltT = rand(3.5, 6); k.flash('220,225,255', 0.18); k.sfx('thunder'); } }
                if (!S.active) return;
                var bx = g.bx, byy = S.y - g.L * 0.2, rb = S.ground || S.inv > 0 ? g.L * 0.28 + g.H * 0.035 : g.L * 0.5 + g.H * 0.05;
                for (i = 0; i < S.items.length; i++) {
                    var it = S.items[i];
                    if (it.st !== 'on') { it.t += dt; continue; }
                    var ix = bx - (it.u - S.u), iy = itemY(it);
                    if (ix > g.W + 80) { it.st = 'gone'; if (it.good) k.breakCombo(); continue; }
                    if (dist2(ix, iy, bx, byy) < rb * rb) {
                        if (it.good) {
                            it.st = 'got'; it.t = 0;
                            k.hit(10, ix, iy - 24, { text: '✨ ' });
                            k.emit(ix, iy, 16, { colors: [C.goldL, '#fff3cf', C.gold], up: 60 });
                        } else if (S.inv <= 0) {
                            it.st = 'hit'; it.t = 0; S.inv = 1.4;
                            S.vy = -g.H * 0.7; S.vx *= 0.8; S.ground = false;
                            k.emit(ix, iy, 18, { colors: ['#3a2a4a', '#6a5a7a', '#fff'], grav: 100 });
                            if (k.loseLife(ix, iy - 20, plain(it.s)) <= 0) { k.finish({ lose: true, title: 'ولا يهمك… اطلب بإيمان وجرّب تاني', finaleT: 1.2 }); return; }
                        }
                    }
                }
                if (S.u >= S.uEnd) {
                    S.active = false;
                    for (i = 0; i < S.items.length; i++) if (S.items[i].st === 'on') S.items[i].st = 'gone';
                    k.glyphBurst(bx, S.y - g.L, 6);
                    if (S.ph >= 2) { k.finish({ title: 'عدّيت الموج بإيمان! ⚓', finaleT: 2.2 }); return; }
                    var n2 = S.ph + 1;
                    k.after(1.2, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: [C.goldL, '#fff'], grav: 60, up: 40 });
            },
            key: function (k, key, isDown) {
                if (key === ' ' || key === 'ArrowDown') { S.keyHold = isDown; return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, x, u;
                blit(ctx, S.bg, 0, 0);
                if (S.ph === 1) { ctx.fillStyle = 'rgba(20,20,45,0.35)'; ctx.fillRect(0, 0, W, H); }
                for (var c = 0; c < 4; c++) cloud(ctx, modn(c * W * 0.31 + S.u * 0.05 + t * 6, W * 1.3) - W * 0.15, H * (0.1 + (c % 2) * 0.08), W * 0.07, S.ph === 1 ? 0.25 : 0.45, S.ph === 1 ? 'rgba(90,95,120,0.6)' : null);
                // lighthouse church at the end of the phase
                if (S.uEnd) {
                    var lx = g.bx - (S.uEnd - S.u);
                    if (lx > -120 && lx < W + 140) {
                        var ly = g.by + H * 0.02;
                        ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ell(ctx, lx, ly, W * 0.08, H * 0.08); ctx.fill();
                        ctx.fillStyle = '#e9dcc0'; ctx.fillRect(lx - 10, ly - H * 0.32, 20, H * 0.3);
                        ctx.fillStyle = '#8e1f1f'; ctx.beginPath(); ctx.arc(lx, ly - H * 0.32, 13, Math.PI, 0); ctx.fill();
                        copticCross(ctx, lx, ly - H * 0.32 - 22, 8, C.gold, 'rgba(40,20,0,0.5)', 1);
                        glow(ctx, lx, ly - H * 0.28, H * 0.25, 'rgba(255,231,163,0.55)');
                    }
                }
                // far waves
                ctx.fillStyle = 'rgba(25,70,115,0.75)';
                ctx.beginPath(); ctx.moveTo(0, H);
                for (x = 0; x <= W + 8; x += 8) { u = S.u * 0.55 + g.bx - x; ctx.lineTo(x, g.by - H * 0.06 + S.A * H * 0.5 * Math.sin(u * g.f2 * 1.3 + 1 + t * 0.6)); }
                ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
                // items (behind the main wave so low ones sit in the water)
                for (i = 0; i < S.items.length; i++) {
                    var it = S.items[i];
                    if (it.st === 'gone' || (it.st !== 'on' && it.t > 0.7)) continue;
                    var ix = g.bx - (it.u - S.u), iy = it.st === 'on' ? itemY(it) : itemY(it) - it.t * 60;
                    if (ix < -100 || ix > W + 100) continue;
                    ctx.save(); ctx.globalAlpha = it.st === 'on' ? 1 : 1 - it.t / 0.7;
                    if (it.good) {
                        glow(ctx, ix, iy, H * 0.07, 'rgba(255,231,163,0.6)');
                        ctx.save(); ctx.translate(ix, iy); ctx.rotate(Math.sin(t * 2 + i) * 0.15);
                        starPath(ctx, 0, 0, H * 0.035, 0.5); ctx.fillStyle = C.gold; ctx.fill(); ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.2; ctx.stroke();
                        ctx.restore();
                        chip(ctx, it.s, ix, iy + H * 0.065, clamp(H * 0.035, 10, 13), 'rgba(142,31,31,0.85)', '#ffe9b8');
                    } else {
                        cloud(ctx, ix, iy, H * 0.085, 1, 'rgba(45,35,60,0.9)');
                        ctx.fillStyle = '#c86bff'; ctx.beginPath(); circ(ctx, ix - 6, iy - 2, 2.2); circ(ctx, ix + 6, iy - 2, 2.2); ctx.fill();
                        chip(ctx, it.s, ix, iy + H * 0.06, clamp(H * 0.035, 10, 13), 'rgba(40,25,50,0.92)', '#f0d9ff');
                    }
                    ctx.restore();
                }
                // main sea
                ctx.beginPath(); ctx.moveTo(0, H);
                for (x = 0; x <= W + 6; x += 6) ctx.lineTo(x, h(S.u + g.bx - x));
                ctx.lineTo(W, H); ctx.closePath();
                ctx.fillStyle = vgrad(ctx, g.by - S.A * H, H, ['#2f86bf', '#1f6fa3', '#0f3d63']); ctx.fill();
                ctx.beginPath();
                for (x = 0; x <= W + 6; x += 6) { var yy = h(S.u + g.bx - x); if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
                ctx.strokeStyle = 'rgba(235,250,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
                // the boat
                var L = g.L, blink = S.inv > 0 && S.inv < 1.4 && Math.floor(t * 10) % 2 === 0;
                if (!blink) {
                    ctx.save(); ctx.translate(g.bx, S.y); ctx.rotate(S.ang);
                    youth(ctx, k, L * 0.06, -L * 0.1, L * 0.62, -1, -1, '#f3ead6', { arm: (k.pdown || S.keyHold) ? 2.6 : 0.5, noShadow: true });
                    ctx.strokeStyle = '#5a3517'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(L * 0.2, -L * 0.1); ctx.lineTo(L * 0.2, -L * 0.85); ctx.stroke();
                    ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.moveTo(L * 0.22, -L * 0.82); ctx.quadraticCurveTo(L * 0.52, -L * 0.5, L * 0.24, -L * 0.18); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 1; ctx.stroke();
                    copticCross(ctx, L * 0.31, -L * 0.48, L * 0.07, C.red);
                    ctx.fillStyle = vgrad(ctx, -L * 0.16, L * 0.14, ['#a8642e', '#6b3a18']);
                    ctx.beginPath(); ctx.moveTo(-L * 0.58, -L * 0.2); ctx.quadraticCurveTo(-L * 0.38, L * 0.14, 0, L * 0.14); ctx.quadraticCurveTo(L * 0.4, L * 0.14, L * 0.52, -L * 0.16); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = '#4a2810'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-L * 0.5, -L * 0.1); ctx.quadraticCurveTo(0, L * 0.02, L * 0.46, -L * 0.08); ctx.stroke();
                    ctx.restore();
                }
                if (S.inv > 1.4) { ctx.strokeStyle = 'rgba(255,231,163,' + (0.4 + 0.3 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(g.bx, S.y - L * 0.3, L * 0.7, 0, TAU); ctx.stroke(); }
                // speed / faith meter
                var sf = clamp((S.vx - g.vmin) / (g.vmax - g.vmin), 0, 1);
                ctx.fillStyle = 'rgba(20,10,4,0.5)'; rr(ctx, W / 2 - 70, H - 18, 140, 9, 4.5); ctx.fill();
                ctx.fillStyle = sf > 0.6 ? C.goldL : '#bfe8ff'; rr(ctx, W / 2 - 70, H - 18, 140 * sf, 9, 4.5); ctx.fill();
                if (S.ph === 0 && S.active && k.t < 9) {
                    ctx.globalAlpha = clamp(9 - k.t, 0, 1);
                    txt(ctx, (dh(S.u) > 0 ? 'نازل… دوس مطوّل 👇' : 'طالع… سيب ✋'), W * 0.5, H * 0.28, font(16, 900), '#fff', 'center', 4);
                    ctx.globalAlpha = 1;
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 5. noPartiality -- يعقوب ٢ («لا يكن لكم إيمان ربنا يسوع المسيح... في المحاباة» يع ٢: ١)
     * You are the church usher. People walk in through the door one by one,
     * each with a number for a moment: rich in fine clothes with a gold ring,
     * poor in shabby clothes, an elder, a mother, a child... Then the numbers
     * vanish; tap them in the order they came so each gets a seat in the front
     * pew -- the voice of favoritism tempts you to seat the rich man first.
     * Phase 1: 3 people. Phase 2: 4 people who also swap places (the crowd).
     * Phase 3 (twist): faith with works -- after seating, a brother in need:
     * give what he needs, not only words (يع ٢: ١٥-١٦).
     * Data: favorLine, scornLine, needs[{need, right}], deadWords, questions,
     * intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.noPartiality = function (host, data, api) {
        data = data || {};
        var favor = plain(data.favorLine || ''), scorn = plain(data.scornLine || ''), dead = plain(data.deadWords || '');
        var needs = (data.needs || []).filter(function (n) { return n && n.need && n.right; }).map(function (n) { return { need: plain(n.need), right: plain(n.right) }; });
        var PH = [{ rounds: 3, n: 3, gap: 1.0, badge: 1.5, mix: 0, T: 11 }, { rounds: 3, n: 4, gap: 0.8, badge: 1.0, mix: 2, T: 12 }, { rounds: 2, n: 4, gap: 0.75, badge: 0.9, mix: 2, T: 12, need: needs.length > 0 }];
        var NE = 9 + 12 + 8 + (needs.length ? 2 : 0);
        var TY = [
            { robe: '#f2e2a8', mantle: '#7a1f5a', hair: '#2b1a0e', beard: 0.8, collar: true, rich: true },
            { robe: '#8f7f66', mantle: '#6b5a44', hair: '#3a2a1a', beard: 0.6, poor: true },
            { robe: '#d9cfc0', mantle: '#4a5a6a', hair: '#e8e4dc', beard: 1, beardColor: '#f2efe8', prop: 'staff' },
            { robe: '#cfd8e3', mantle: '#3b5f86', hair: '#2b1a0e', veil: true },
            { robe: '#e8d5c4', mantle: '#8a5a2b', hair: '#3a2414', small: true },
            { robe: '#d8e0c8', mantle: '#5b6a2a', hair: '#2b1a0e' }
        ];
        var S = { ph: -1, rd: 0, rs: 'idle', ppl: [], plan: [], planT: 0, next: 0, t: 0, T: 11, need: null, needI: 0, opts: [], say: [], active: false, id: 0, wait: 0, hintT: 0, bonus: 0, slowT: 0 };
        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.9);
            return { W: W, H: H, gy: gy, ph: clamp(H * 0.32, 70, 150), door: W * 0.93, sx0: W * 0.5, sx1: W * 0.84, seat0: W * 0.2, seatW: W * 0.065 };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, g.gy, ['#5a3a2a', '#8a5f3e', '#b98a5e']); x.fillRect(0, 0, W, g.gy);
                // arches along the nave
                for (var a = 0; a < 5; a++) {
                    var ax = W * (0.3 + a * 0.14), aw = W * 0.09;
                    x.fillStyle = 'rgba(40,20,10,0.25)'; x.beginPath(); x.arc(ax, H * 0.3, aw / 2, Math.PI, 0); x.lineTo(ax + aw / 2, g.gy - g.ph * 1.1); x.lineTo(ax - aw / 2, g.gy - g.ph * 1.1); x.closePath(); x.fill();
                }
                // iconostasis (the front of the church, left)
                var iw = W * 0.19, top = H * 0.16;
                x.fillStyle = '#5a3517'; x.fillRect(0, top, iw, g.gy - top);
                for (var i = 0; i < 3; i++) {
                    var cx = iw * (0.2 + i * 0.3), w2 = iw * 0.22, y0 = top + H * 0.08;
                    x.fillStyle = '#e2b34d'; x.beginPath(); x.arc(cx, y0 + w2 / 2, w2 / 2, Math.PI, 0); x.lineTo(cx + w2 / 2, y0 + w2 * 2.1); x.lineTo(cx - w2 / 2, y0 + w2 * 2.1); x.closePath(); x.fill();
                    x.fillStyle = 'rgba(255,240,180,0.9)'; x.beginPath(); circ(x, cx, y0 + w2 * 0.6, w2 * 0.3); x.fill();
                    x.fillStyle = i === 1 ? '#8e1f1f' : '#1f6fa3'; x.beginPath(); circ(x, cx, y0 + w2 * 0.62, w2 * 0.17); x.fill();
                    x.fillRect(cx - w2 * 0.25, y0 + w2 * 0.85, w2 * 0.5, w2 * 1.1);
                    copticCross(x, cx, top - 6, clamp(w2 * 0.2, 5, 10), C.gold, 'rgba(40,20,0,0.5)', 1);
                }
                x.fillStyle = '#3c220f'; x.fillRect(iw * 0.42, g.gy - g.ph * 0.95, iw * 0.16, g.ph * 0.95);
                // door (right)
                var dw = W * 0.09, dh = g.ph * 1.25;
                x.fillStyle = '#4a2c14'; x.beginPath(); x.arc(g.door, g.gy - dh + dw / 2, dw / 2 + 6, Math.PI, 0); x.lineTo(g.door + dw / 2 + 6, g.gy); x.lineTo(g.door - dw / 2 - 6, g.gy); x.closePath(); x.fill();
                x.fillStyle = 'rgba(255,230,160,0.85)'; x.beginPath(); x.arc(g.door, g.gy - dh + dw / 2, dw / 2, Math.PI, 0); x.lineTo(g.door + dw / 2, g.gy); x.lineTo(g.door - dw / 2, g.gy); x.closePath(); x.fill();
                // floor
                x.fillStyle = vgrad(x, g.gy, H, ['#8c6a48', '#6b4e33']); x.fillRect(0, g.gy, W, H - g.gy);
                x.strokeStyle = 'rgba(40,20,10,0.25)'; x.lineWidth = 1;
                for (var fx = 0; fx < W; fx += 34) { x.beginPath(); x.moveTo(fx, g.gy); x.lineTo(fx - 12, H); x.stroke(); }
            });
        }
        function startPhase(k, n) {
            S.ph = n; S.rd = 0; S.active = false; S.rs = 'idle';
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; startRound(k); });
        }
        function startRound(k) {
            var P = PH[S.ph], g = S.g, i, types = [0, 1], pool = shuffle([2, 3, 4, 5]);
            while (types.length < P.n) types.push(pool.shift());
            types = shuffle(types);
            if (S.ph === 0 && types.indexOf(1) > types.indexOf(0)) { var a = types.indexOf(1), b = types.indexOf(0); types[a] = 0; types[b] = 1; }
            var slots = shuffle(rep(P.n, 0).map(function (v, j) { return j; }));
            S.ppl = []; S.plan = [];
            for (i = 0; i < P.n; i++) S.plan.push({ ty: types[i], ord: i, slot: slots[i] });
            S.planT = 0.2; S.rs = 'enter'; S.next = 0; S.t = 0; S.need = null; S.opts = [];
        }
        function slotX(i, n) { var g = S.g; return n > 1 ? lerp(g.sx0, g.sx1, i / (n - 1)) : (g.sx0 + g.sx1) / 2; }
        function seatX(i) { var g = S.g; return g.seat0 + i * g.seatW; }
        function personAt(p) {
            var g = S.g, best = null, bd = 1e9;
            for (var i = 0; i < S.ppl.length; i++) {
                var q = S.ppl[i], h2 = g.ph * (TY[q.ty].small ? 0.7 : 1);
                if (q.st !== 'stand') continue;
                if (Math.abs(p.x - q.x) < g.ph * 0.3 && p.y > g.gy - h2 - 10 && p.y < g.gy + 10) { var d = Math.abs(p.x - q.x); if (d < bd) { bd = d; best = q; } }
            }
            return best;
        }
        function seatPerson(q) { q.st = 'seat'; q.tx = seatX(q.ord); q.t = 0; }
        function roundDone(k) {
            var P = PH[S.ph];
            if (P.need && S.rd < 2 && needs.length) {
                var nd = needs[S.needI++ % needs.length], other = needs.filter(function (x) { return x.right !== nd.right; });
                var poor = null;
                for (var i = 0; i < S.ppl.length; i++) if (TY[S.ppl[i].ty].poor) poor = S.ppl[i];
                S.need = { n: nd, who: poor || S.ppl[0] };
                var o = [nd.right, dead || '…'];
                if (other.length) o.push(other[Math.floor(Math.random() * other.length)].right);
                S.opts = shuffle(o).map(function (s) { return { s: s, ok: s === nd.right }; });
                S.rs = 'need'; S.t = 0; S.T = 9;
                k.sfx('page');
                return;
            }
            S.rs = 'done'; S.wait = 1.0;
        }
        function pick(k, q) {
            var g = S.g, hy = g.gy - g.ph * 1.05;
            if (q.ord === S.next) {
                S.next++; seatPerson(q);
                k.hit(10, q.x, hy, { text: '⛪ ' });
                k.emit(q.x, g.gy - g.ph * 0.6, 12, { colors: [C.goldL, '#fff', C.gold], up: 60 });
                if (S.next >= S.ppl.length) roundDone(k);
            } else {
                q.shake = 0.4; S.hintT = 1.2;
                if (k.loseLife(q.x, hy, TY[q.ty].rich ? 'محاباة!' : 'مش ده دوره') <= 0) k.finish({ lose: true, title: 'ولا يهمك… كلنا كرامة واحدة، جرّب تاني', finaleT: 1.2 });
            }
        }
        function optRects() {
            var g = S.g, n = S.opts.length, w = Math.min(g.W * 0.27, 230), h = clamp(g.H * 0.14, 40, 60), gap = 10, x0 = g.W / 2 - (n * w + (n - 1) * gap) / 2;
            return S.opts.map(function (o, i) { return { x: x0 + i * (w + gap), y: g.H * 0.2, w: w, h: h }; });
        }
        function choose(k, i) {
            if (S.rs !== 'need') return;
            var o = S.opts[i], q = S.need.who, g = S.g;
            if (o.ok) {
                k.hit(10, q.x, g.gy - g.ph * 1.1, { text: '💛 ' });
                k.glyphBurst(q.x, g.gy - g.ph * 0.8, 5);
                k.emit(q.x, g.gy - g.ph * 0.6, 20, { colors: [C.goldL, '#9dffb0', '#fff'], up: 70 });
                k.sfx('power');
            } else if (k.loseLife(q.x, g.gy - g.ph * 1.1, o.s === dead ? 'إيمان من غير أعمال!' : 'مش ده اللي محتاجه') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… الإيمان بيبان بالأعمال، جرّب تاني', finaleT: 1.2 }); return; }
            S.rs = 'done'; S.wait = 1.1; S.need = null; S.opts = [];
        }

        var k = createCore(host, data, api, {
            title: 'من غير محاباة', icon: '⛪',
            howto: { kind: 'tap', text: 'خلي بالك من الأرقام وهما داخلين، وبعدين اضغط عليهم بنفس ترتيب دخولهم عشان كل واحد يقعد… من غير ما تفرّق بين غني وفقير.' },
            comboStep: 4, maxMult: 3, pad: [130.8, 196], lives: 3, factY: 0.03,
            rawMax: function (k) { return perfectSeq(k, rep(NE, 10)) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.bonus = 1; return '👀 الأرقام هتفضل ظاهرة وقت أطول'; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i, q;
                S.hintT = Math.max(0, S.hintT - dt);
                for (i = S.say.length - 1; i >= 0; i--) { S.say[i].t += dt; if (S.say[i].t > S.say[i].dur) S.say.splice(i, 1); }
                for (i = 0; i < S.ppl.length; i++) {
                    q = S.ppl[i]; q.t += dt; q.shake = Math.max(0, (q.shake || 0) - dt);
                    var sp = g.W * 0.32;
                    if (q.st === 'enter' || q.st === 'mix' || q.st === 'seat') {
                        var d = q.tx - q.x;
                        if (Math.abs(d) < sp * dt) { q.x = q.tx; q.walk = -1; if (q.st === 'enter') { q.st = 'stand'; q.badge = P.badge + (S.bonus ? 1.2 : 0); } else if (q.st === 'mix') q.st = 'stand'; else q.st = 'sat'; }
                        else { q.x += (d > 0 ? 1 : -1) * sp * dt; q.walk += dt * 8; q.dir = d > 0 ? 1 : -1; }
                    }
                    if (q.badge > 0 && (q.st === 'stand' || q.st === 'sat')) q.badge -= dt;
                    if (q.st === 'gone') q.fade = Math.min(1, (q.fade || 0) + dt * 2);
                }
                if (!S.active) return;
                if (S.rs === 'enter') {
                    if (S.plan.length) {
                        S.planT -= dt;
                        if (S.planT <= 0) {
                            var it = S.plan.shift();
                            S.ppl.push({ id: S.id++, ty: it.ty, ord: it.ord, slot: it.slot, x: g.door, tx: slotX(it.slot, P.n), st: 'enter', t: 0, walk: 0, dir: -1, badge: 99 });
                            S.planT = P.gap; k.sfx('tick');
                        }
                    } else {
                        var ready = true;
                        for (i = 0; i < S.ppl.length; i++) if (S.ppl[i].st !== 'stand' || S.ppl[i].badge > 0) ready = false;
                        if (ready) {
                            if (P.mix) {
                                var ids = shuffle(S.ppl.slice());
                                for (i = 0; i + 1 < ids.length && i < P.mix * 2; i += 2) { var s1 = ids[i].slot; ids[i].slot = ids[i + 1].slot; ids[i + 1].slot = s1; }
                                for (i = 0; i < S.ppl.length; i++) { q = S.ppl[i]; q.tx = slotX(q.slot, P.n); if (q.tx !== q.x) q.st = 'mix'; q.badge = 0; }
                                S.rs = 'mix'; k.sfx('whoosh');
                            } else { S.rs = 'pick'; S.t = 0; S.T = P.T; }
                            if (S.rs === 'pick') S.pickStart = true;
                        }
                    }
                } else if (S.rs === 'mix') {
                    var still = false;
                    for (i = 0; i < S.ppl.length; i++) if (S.ppl[i].st === 'mix') still = true;
                    if (!still) { S.rs = 'pick'; S.t = 0; S.T = P.T; S.pickStart = true; }
                } else if (S.rs === 'pick') {
                    if (S.pickStart) {
                        S.pickStart = false; S.bonus = 0;
                        for (i = 0; i < S.ppl.length; i++) if (TY[S.ppl[i].ty].rich && favor) S.say.push({ s: '«' + favor + '»', x: S.ppl[i].x, y: g.gy - g.ph * 1.1, t: 0, dur: 2.6, who: 'صوت المحاباة ❌' });
                        if (S.ph === 0 && S.rd === 0 && scorn) for (i = 0; i < S.ppl.length; i++) if (TY[S.ppl[i].ty].poor) S.say.push({ s: '«' + scorn + '»', x: S.ppl[i].x, y: g.gy - g.ph * 1.1, t: -1.2, dur: 2.6, who: 'متقولش كده ❌' });
                    }
                    S.t += dt;
                    if (S.t >= S.T) {
                        for (i = 0; i < S.ppl.length; i++) { q = S.ppl[i]; if (q.st === 'stand') { q.badge = 1.5; seatPerson(q); } }
                        S.next = S.ppl.length;
                        if (k.loseLife(g.W / 2, g.H * 0.3, 'الوقت خلص') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… كلنا كرامة واحدة، جرّب تاني', finaleT: 1.2 }); return; }
                        roundDone(k);
                    }
                } else if (S.rs === 'need') {
                    S.t += dt;
                    if (S.t >= S.T) {
                        if (k.loseLife(g.W / 2, g.H * 0.3, 'الوقت خلص') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… الإيمان بيبان بالأعمال، جرّب تاني', finaleT: 1.2 }); return; }
                        S.rs = 'done'; S.wait = 0.8; S.need = null; S.opts = [];
                    }
                } else if (S.rs === 'done') {
                    var sat = true;
                    for (i = 0; i < S.ppl.length; i++) if (S.ppl[i].st === 'seat') sat = false;
                    if (sat) S.wait -= dt;
                    if (S.wait <= 0) {
                        S.rd++; S.rs = 'idle';
                        for (i = 0; i < S.ppl.length; i++) S.ppl[i].st = 'gone';
                        if (S.rd >= P.rounds) {
                            S.active = false;
                            k.after(0.6, function () {
                                S.ppl = [];
                                if (S.ph >= 2) { k.finish({ title: 'كل واحد خد مكانه بمحبة! ⛪', finaleT: 2.2 }); return; }
                                var n2 = S.ph + 1;
                                k.checkpoint(function () { startPhase(k, n2); });
                            });
                        } else k.after(0.6, function () { startRound(k); });
                    }
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: [C.goldL, '#fff'], grav: 60, up: 40 });
            },
            down: function (k, p) {
                if (S.rs === 'need') {
                    var R = optRects();
                    for (var i = 0; i < R.length; i++) if (p.x >= R[i].x && p.x <= R[i].x + R[i].w && p.y >= R[i].y && p.y <= R[i].y + R[i].h) { choose(k, i); return; }
                    return;
                }
                if (S.rs !== 'pick') { k.sfx('tap'); return; }
                var q = personAt(p);
                if (q) pick(k, q);
            },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                var n = '123456'.indexOf(key);
                if (n < 0) return false;
                if (S.rs === 'need') { if (n < S.opts.length) choose(k, n); return true; }
                if (S.rs === 'pick') {
                    var st = S.ppl.filter(function (q) { return q.st === 'stand'; }).sort(function (a, b) { return b.x - a.x; });
                    if (st[n]) pick(k, st[n]);
                    return true;
                }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, q;
                blit(ctx, S.bg, 0, 0);
                // hanging church lamps (qanadil)
                for (i = 0; i < 4; i++) {
                    var lx = W * (0.28 + i * 0.16), ly = H * 0.12 + Math.sin(t * 1.2 + i) * 2;
                    ctx.strokeStyle = 'rgba(60,35,15,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 6); ctx.stroke();
                    ctx.fillStyle = C.gold; ctx.beginPath(); ell(ctx, lx, ly, 7, 5); ctx.fill();
                    glow(ctx, lx, ly + 2, 22, 'rgba(255,214,130,0.45)');
                    flame(ctx, lx, ly - 4, 2.5, t + i);
                }
                // seated people first, then the pew in front of them
                for (var pass = 0; pass < 2; pass++) for (i = 0; i < S.ppl.length; i++) {
                    q = S.ppl[i];
                    var seated = q.st === 'sat' || (q.st === 'gone' && q.tx <= seatX(5));
                    if ((pass === 0) !== seated) continue;
                    var ty = TY[q.ty], hh = g.ph * (ty.small ? 0.7 : 1) * (seated ? 0.92 : 1), al = q.st === 'gone' ? 1 - (q.fade || 0) : 1;
                    if (al <= 0) continue;
                    var sx = q.x + (q.shake > 0 ? Math.sin(t * 60) * 4 : 0);
                    ctx.save(); ctx.globalAlpha = al;
                    var f = { x: sx, y: g.gy - (seated ? g.ph * 0.06 : 2), h: hh, dir: q.walk >= 0 && q.st !== 'stand' ? q.dir : -1, robe: ty.robe, mantle: ty.mantle, hair: ty.hair, beard: ty.beard || 0, beardColor: ty.beardColor, collar: ty.collar, belt: ty.rich ? C.gold : null, prop: ty.prop, walk: q.st === 'stand' || seated ? -1 : q.walk, t: t + q.id, dpr: k.dpr };
                    var hand = figure(ctx, f);
                    if (ty.veil) veil(ctx, f);
                    if (ty.rich) { ctx.fillStyle = C.goldL; ctx.beginPath(); circ(ctx, hand.x, hand.y, 2.6); ctx.fill(); if (Math.sin(t * 5 + q.id) > 0.6) txt(ctx, '✦', hand.x + 5, hand.y - 6, font(10, 900), '#fff'); }
                    if (ty.poor) { var s = hh / 100; ctx.fillStyle = 'rgba(70,55,35,0.75)'; ctx.fillRect(sx - 6 * s, g.gy - 40 * s, 6 * s, 5 * s); ctx.fillRect(sx + 3 * s, g.gy - 24 * s, 5 * s, 4 * s); }
                    ctx.restore();
                    var showB = q.badge > 0 && q.st !== 'gone', hint = S.hintT > 0 && q.ord === S.next && q.st === 'stand';
                    if (showB || hint) {
                        var by = g.gy - hh - 14;
                        ctx.fillStyle = hint ? '#2e8b57' : C.gold; ctx.beginPath(); circ(ctx, sx, by, 12); ctx.fill();
                        ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.5; ctx.stroke();
                        txt(ctx, ar(q.ord + 1), sx, by + 1, font(13, 900), hint ? '#fff' : C.ink);
                    }
                }
                // the front pew
                var pw0 = seatX(0) - g.seatW * 0.7, pw1 = seatX(4) - g.seatW * 0.3;
                ctx.fillStyle = '#6b4220'; rr(ctx, pw0, g.gy - g.ph * 0.42, pw1 - pw0, g.ph * 0.1, 3); ctx.fill();
                ctx.fillStyle = '#5a3517'; rr(ctx, pw0, g.gy - g.ph * 0.3, pw1 - pw0, g.ph * 0.3, 3); ctx.fill();
                ctx.strokeStyle = 'rgba(255,220,150,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(pw0 + 3, g.gy - g.ph * 0.27, pw1 - pw0 - 6, g.ph * 0.24);
                drawCross(ctx, (pw0 + pw1) / 2, g.gy - g.ph * 0.15, 7, C.gold, k.dpr);
                // speech bubbles
                for (i = 0; i < S.say.length; i++) {
                    var sb = S.say[i];
                    if (sb.t < 0) continue;
                    var sa = sb.t < 0.3 ? sb.t / 0.3 : clamp((sb.dur - sb.t) / 0.4, 0, 1);
                    speech(ctx, sb.s, sb.x, sb.y, Math.min(W * 0.36, 260), clamp(H * 0.042, 11, 15), W, sa, sb.who);
                }
                // timer and status
                if (S.rs === 'pick') {
                    chip(ctx, 'اضغط رقم ' + ar(S.next + 1), W * 0.6, g.gy - g.ph * 1.45, 13, 'rgba(142,31,31,0.9)', '#ffe9b8', C.gold);
                    ring(ctx, W * 0.6 + 70, g.gy - g.ph * 1.45, 10, 1 - S.t / S.T, S.t > S.T * 0.7 ? '#e0443a' : C.goldL, 3);
                } else if (S.rs === 'enter' && S.active) chip(ctx, 'افتكر الترتيب 👀', W * 0.6, g.gy - g.ph * 1.45, 13, 'rgba(40,25,10,0.8)', '#fff5d6');
                // the need and the gifts (phase 3)
                if (S.rs === 'need' && S.need) {
                    var w = S.need.who;
                    speech(ctx, S.need.n.need, w.x, g.gy - g.ph * 1.0, Math.min(W * 0.3, 220), clamp(H * 0.045, 12, 16), W, 1, 'محتاج 🙏');
                    var R = optRects();
                    for (i = 0; i < R.length; i++) {
                        var r = R[i];
                        ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, r.x, r.y + 3, r.w, r.h, 12); ctx.fill();
                        ctx.fillStyle = vgrad(ctx, r.y, r.y + r.h, ['#fbf1d8', '#ecd5a0']); rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
                        ctx.strokeStyle = C.red; ctx.lineWidth = 1.6; ctx.stroke();
                        block(ctx, S.opts[i].s, r.x + r.w / 2, r.y + r.h / 2, r.w - 16, r.h - 8, 14, 800, C.ink, 2);
                    }
                    ring(ctx, W / 2, R[0].y + R[0].h + 20, 9, 1 - S.t / S.T, S.t > S.T * 0.7 ? '#e0443a' : C.goldL, 3);
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 6. tameTongue -- يعقوب ٣ (اللجام، الدفة، النار الصغيرة ٣: ٣-٦)
     * A ship sails on a sea of words. Turn the helm wheel (drag around it, or
     * slide up / down anywhere, or the arrow keys): the small rudder steers the
     * whole ship. Sail through the good words, steer clear of the rocks of bad
     * words (a life each). Phase 1: the bit and the rudder. Phase 2: one mouth
     * -- blessing and cursing come mixed and a storm wind pushes the ship.
     * Phase 3 (twist): the small fire -- sparks of bad words land on the deck;
     * tap each one to put it out before it grows into a fire.
     * Data: good[], bad[], sparks[], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.tameTongue = function (host, data, api) {
        data = data || {};
        var GW = strList(data.good), BW = strList(data.bad), SPK = strList(data.sparks);
        if (!GW.length) GW = ['…'];
        if (!BW.length) BW = ['…'];
        if (!SPK.length) SPK = BW.slice();
        var PH = [{ ng: 8, nb: 6, V: 0.2, gap: 1.45, wind: 0, sparks: 0 }, { ng: 9, nb: 7, V: 0.23, gap: 1.3, wind: 1, sparks: 0 }, { ng: 5, nb: 5, V: 0.21, gap: 1.9, wind: 0.4, sparks: 8 }];
        var NG = PH[0].ng + PH[1].ng + PH[2].ng, NSP = PH[2].sparks;
        var S = { ph: -1, sy: 0, vy: 0, wa: 0, grab: null, slide: null, kd: 0, objs: [], plan: [], planT: 0, sparks: [], splan: 0, spT: 0, dist: 0, active: false, gi: 0, bi: 0, si: 0, slowT: 0, wake: [] };
        function G(k) {
            var W = k.W, H = k.H, hr = clamp(H * 0.15, 36, 62);
            return { W: W, H: H, top: Math.round(H * 0.2), sx: W * 0.64, L: clamp(W * 0.13, 70, 124), hx: W - hr - 18, hy: H - hr - 14, hr: hr, ymin: H * 0.3, ymax: H * 0.9 };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            if (S.g && S.g.H && S.g.H !== H) S.sy = S.sy / S.g.H * H;
            S.g = g;
            if (!S.sy) S.sy = H * 0.6;
            S.coast = layer(W, g.top + 10, k.dpr, function (x, w, h) {
                x.fillStyle = vgrad(x, 0, h, ['#86b6dc', '#cfe3ee']); x.fillRect(0, 0, w, h * 0.5);
                x.fillStyle = '#7a9a4a'; ridge(x, w, h * 0.55, h * 0.18, 13, 3, h); x.fill();
                sand(x, w, h, h * 0.72, 8);
                church(x, w * 0.2, h * 0.75, h * 0.6, '#b58a66');
                for (var i = 0; i < 6; i++) palm(x, w * (0.35 + i * 0.12), h * 0.78, h * 0.55, (i % 2) - 0.5);
            });
            S.water = layer(W, H - g.top, k.dpr, function (x, w, h) {
                x.fillStyle = vgrad(x, 0, h, ['#3a92c4', '#1f6fa3', '#124a78']); x.fillRect(0, 0, w, h);
                var r = seeded(23);
                x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 1.6;
                for (var i = 0; i < 46; i++) { var wx = r() * w, wy = r() * h, ws = 6 + r() * 10; x.beginPath(); x.arc(wx, wy, ws, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
            });
        }
        function startPhase(k, n) {
            var P = PH[n], i, plan = [];
            S.ph = n; S.active = false;
            for (i = 0; i < P.ng; i++) plan.push(1);
            for (i = 0; i < P.nb; i++) plan.push(0);
            S.plan = shuffle(plan); S.planT = 0.5; S.splan = P.sparks; S.spT = 3;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; });
        }
        function spawn(k, good) {
            var g = S.g, y = rand(g.ymin + 8, g.ymax - 8), off = g.H * rand(0.16, 0.3);
            if (good) y = S.sy + (S.sy + off > g.ymax - 8 || (S.sy - off > g.ymin + 8 && Math.random() < 0.5) ? -off : off);
            else if (Math.random() < 0.5) y = S.sy + rand(-1, 1) * g.H * 0.04;
            y = clamp(y, g.ymin + 8, g.ymax - 8);
            S.objs.push({ good: good, s: good ? GW[S.gi++ % GW.length] : BW[S.bi++ % BW.length], x: -70, y: y, st: 'on', t: 0, rot: rand(0, TAU) });
        }
        function quench(k, sp) {
            var g = S.g;
            sp.st = 'out'; sp.t = 0;
            k.hit(5, g.sx + sp.ox, S.sy + sp.oy - 20, { text: '💧 ' });
            k.emit(g.sx + sp.ox, S.sy + sp.oy, 14, { colors: ['#e6f7ff', '#bfe8ff', '#fff'], grav: -80, up: 40 });
            k.sfx('splash');
        }
        function sparkAt(p) {
            var g = S.g;
            for (var i = 0; i < S.sparks.length; i++) { var sp = S.sparks[i]; if (sp.st === 'on' && dist2(p.x, p.y, g.sx + sp.ox, S.sy + sp.oy) < Math.pow(Math.max(26, 16 + sp.g * 18), 2)) return sp; }
            return null;
        }
        function drawWheel(ctx, g, a) {
            var R = g.hr;
            ctx.save(); ctx.translate(g.hx, g.hy);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); circ(ctx, 3, 4, R + 8); ctx.fill();
            ctx.rotate(a);
            ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 5; ctx.lineCap = 'round';
            for (var i = 0; i < 8; i++) {
                var an = i * Math.PI / 4;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * (R + 9), Math.sin(an) * (R + 9)); ctx.stroke();
            }
            ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
            ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R + 3.5, 0, TAU); ctx.arc(0, 0, R - 3.5, 0, TAU); ctx.stroke();
            ctx.fillStyle = C.gold;
            for (i = 0; i < 8; i++) { var an2 = i * Math.PI / 4; ctx.beginPath(); circ(ctx, Math.cos(an2) * (R + 10), Math.sin(an2) * (R + 10), 3.5); ctx.fill(); }
            ctx.fillStyle = C.goldD; ctx.beginPath(); circ(ctx, 0, 0, R * 0.3); ctx.fill();
            ctx.restore();
            drawCross(ctx, g.hx, g.hy, R * 0.22, C.goldL, 1);
        }

        var k = createCore(host, data, api, {
            title: 'لجّم لسانك', icon: '⛵',
            howto: { kind: 'drag', text: 'لف الدفة بصباعك (أو اسحب لفوق ولتحت) عشان توجّه المركب: عدّي على الكلام الحلو، وابعد عن صخور الكلام الوحش.' },
            comboStep: 4, maxMult: 3, pad: [123.5, 185], lives: 3, factY: 0.03,
            rawMax: function (k) { return perfectSeq(k, rep(NG, 10).concat(rep(NSP, 5))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 7; return '🙏 «اجعل يا رب حارسًا لفمي»: البحر هدي'; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i;
                S.slowT = Math.max(0, S.slowT - dt);
                if (S.kd) S.wa = clamp(S.wa + S.kd * 2.8 * dt, -2.4, 2.4);
                else if (!S.grab && !S.slide) S.wa *= Math.exp(-1.3 * dt);
                var r = S.wa / 2.4, wind = S.active ? P.wind * g.H * 0.17 * (Math.sin(k.t * 0.8) + 0.5 * Math.sin(k.t * 2.1 + 1)) * (S.slowT > 0 ? 0.3 : 1) : 0;
                var tv = r * g.H * 0.62 + wind;
                S.vy += (tv - S.vy) * Math.min(1, dt * 3.2);
                S.sy += S.vy * dt;
                if (S.sy < g.ymin) { S.sy = g.ymin; S.vy = Math.max(0, S.vy); }
                if (S.sy > g.ymax) { S.sy = g.ymax; S.vy = Math.min(0, S.vy); }
                var V = g.W * P.V * (S.slowT > 0 ? 0.65 : 1);
                S.dist += V * dt;
                if (Math.random() < dt * 14) S.wake.push({ x: g.sx + g.L * 0.48, y: S.sy + rand(-4, 4), t: 0 });
                for (i = S.wake.length - 1; i >= 0; i--) { S.wake[i].t += dt; S.wake[i].x += V * dt; if (S.wake[i].t > 1.4) S.wake.splice(i, 1); }
                if (!S.active) return;
                if (S.plan.length) { S.planT -= dt; if (S.planT <= 0) { spawn(k, S.plan.shift() === 1); S.planT = P.gap * rand(0.8, 1.2) * (S.slowT > 0 ? 1.3 : 1); } }
                var hl = g.L * 0.5, hw = g.L * 0.2 + g.H * 0.04;
                for (i = S.objs.length - 1; i >= 0; i--) {
                    var o = S.objs[i];
                    o.t += dt;
                    if (o.st === 'on') {
                        o.x += V * dt;
                        if (Math.abs(o.x - g.sx) < hl && Math.abs(o.y - S.sy) < hw) {
                            if (o.good) {
                                o.st = 'got'; o.t = 0;
                                k.hit(10, o.x, o.y - 26, { text: '💬 ' });
                                k.emit(o.x, o.y, 16, { colors: [C.goldL, '#fff3cf', '#9dffb0'], up: 60 });
                            } else {
                                o.st = 'hit'; o.t = 0;
                                S.vy = (o.y > S.sy ? -1 : 1) * g.H * 0.5;
                                k.emit(o.x, o.y, 20, { colors: ['#5a4a3a', '#8c7a63', '#fff'], grav: 200 });
                                if (k.loseLife(o.x, o.y - 26, plain(o.s)) <= 0) { k.finish({ lose: true, title: 'ولا يهمك… لجّم لسانك وجرّب تاني', finaleT: 1.2 }); return; }
                            }
                        } else if (o.x > g.W + 80) { if (o.good) k.breakCombo(); S.objs.splice(i, 1); }
                    } else { o.x += V * dt; if (o.t > 0.7) S.objs.splice(i, 1); }
                }
                if (S.splan > 0) {
                    S.spT -= dt;
                    if (S.spT <= 0) {
                        S.splan--; S.spT = rand(2.8, 3.8);
                        S.sparks.push({ ox: rand(-g.L * 0.34, g.L * 0.3), oy: rand(-g.L * 0.12, g.L * 0.12), g: 0, s: SPK[S.si++ % SPK.length], st: 'on', t: 0 });
                        k.sfx('fire');
                    }
                }
                for (i = S.sparks.length - 1; i >= 0; i--) {
                    var sp = S.sparks[i];
                    sp.t += dt;
                    if (sp.st === 'on') {
                        sp.g += dt / (S.slowT > 0 ? 6 : 4.4);
                        if (sp.g >= 1) {
                            sp.st = 'burn'; sp.t = 0;
                            k.emit(g.sx + sp.ox, S.sy + sp.oy, 22, { colors: ['#ff8a2a', '#ffe28a', '#5a3a1e'], grav: -120, up: 60 });
                            if (k.loseLife(g.sx + sp.ox, S.sy + sp.oy - 30, 'النار كبرت!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… شوية مية تطفي نار كبيرة، جرّب تاني', finaleT: 1.2 }); return; }
                        }
                    } else if (sp.t > 0.6) S.sparks.splice(i, 1);
                }
                if (!S.plan.length && !S.objs.length && S.splan <= 0 && !S.sparks.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'لسانك بقى دفة للخير! ⛵', finaleT: 2.2 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.8, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.35, 3, { colors: [C.goldL, '#bfe8ff', '#fff'], grav: 60, up: 40 });
            },
            down: function (k, p) {
                var g = S.g, sp = sparkAt(p);
                if (sp) { quench(k, sp); return; }
                if (dist2(p.x, p.y, g.hx, g.hy) < Math.pow(g.hr * 1.7, 2)) { S.grab = { a: Math.atan2(p.y - g.hy, p.x - g.hx) }; k.sfx('tick'); return; }
                S.slide = { y: p.y, wa: S.wa };
            },
            move: function (k, p) {
                var g = S.g;
                if (S.grab) {
                    var a = Math.atan2(p.y - g.hy, p.x - g.hx), da = a - S.grab.a;
                    if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
                    if (dist2(p.x, p.y, g.hx, g.hy) > 64) S.wa = clamp(S.wa + da, -2.4, 2.4);
                    S.grab.a = a;
                } else if (S.slide) S.wa = clamp(S.slide.wa + (p.y - S.slide.y) / 42, -2.4, 2.4);
            },
            up: function (k) { S.grab = null; S.slide = null; },
            key: function (k, key, isDown) {
                if (key === 'ArrowUp' || key === 'ArrowDown') { S.kd = isDown ? (key === 'ArrowUp' ? -1 : 1) : 0; return true; }
                if (isDown && key === ' ') { for (var i = 0; i < S.sparks.length; i++) if (S.sparks[i].st === 'on') { quench(k, S.sparks[i]); break; } return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, L = g.L;
                blitTiled(ctx, S.water, -S.dist, g.top, W);
                if (S.ph === 1) { ctx.fillStyle = 'rgba(20,30,60,0.22)'; ctx.fillRect(0, g.top, W, H - g.top); }
                blit(ctx, S.coast, 0, 0);
                if (S.ph === 2) for (i = 0; i < 3; i++) { var fx = W * (0.45 + i * 0.15), fy = g.top * 0.75; flame(ctx, fx, fy, 4 + i, t + i); ctx.fillStyle = 'rgba(80,70,70,0.25)'; ctx.beginPath(); circ(ctx, fx + Math.sin(t + i) * 6, fy - 16 - (t * 12 + i * 9) % 20, 7); ctx.fill(); }
                frieze(ctx, k, 0, g.top + 4, W, 7, 'rgba(142,31,31,0.45)');
                // wake
                for (i = 0; i < S.wake.length; i++) { var wk = S.wake[i]; ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - wk.t / 1.4)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wk.x, wk.y, 4 + wk.t * 14, -0.9, 0.9); ctx.stroke(); }
                // word buoys and rocks
                for (i = 0; i < S.objs.length; i++) {
                    var o = S.objs[i], al = o.st === 'on' ? 1 : 1 - o.t / 0.7, sz = clamp(H * 0.045, 13, 22);
                    ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
                    if (o.good) {
                        glow(ctx, o.x, o.y, sz * 2.2, 'rgba(255,231,163,0.45)');
                        ctx.fillStyle = C.gold; ctx.beginPath(); circ(ctx, o.x, o.y, sz * 0.7); ctx.fill();
                        ctx.strokeStyle = '#fff3cf'; ctx.lineWidth = 2; ctx.stroke();
                        drawCross(ctx, o.x, o.y, sz * 0.4, '#8e1f1f', k.dpr);
                        chip(ctx, o.s, o.x, o.y - sz * 1.45, clamp(H * 0.036, 10, 13), 'rgba(29,90,44,0.88)', '#eaffea');
                    } else {
                        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ell(ctx, o.x, o.y + sz * 0.5, sz * 1.3, sz * 0.35); ctx.fill();
                        ctx.fillStyle = vgrad(ctx, o.y - sz, o.y + sz * 0.6, ['#6a5d50', '#3e352c']);
                        ctx.beginPath(); ctx.moveTo(o.x - sz * 1.1, o.y + sz * 0.5); ctx.lineTo(o.x - sz * 0.6, o.y - sz * 0.6); ctx.lineTo(o.x + sz * 0.1, o.y - sz * 0.9); ctx.lineTo(o.x + sz * 0.9, o.y - sz * 0.3); ctx.lineTo(o.x + sz * 1.1, o.y + sz * 0.5); ctx.closePath(); ctx.fill();
                        chip(ctx, o.s, o.x, o.y - sz * 1.45, clamp(H * 0.036, 10, 13), 'rgba(90,20,15,0.9)', '#ffd8d0');
                    }
                    ctx.restore();
                }
                // the ship (top view, bow to the left)
                var tilt = clamp(S.vy / (g.H * 0.62), -1, 1) * 0.45;
                ctx.save(); ctx.translate(g.sx, S.sy); ctx.rotate(-tilt);
                ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ell(ctx, 4, 6, L * 0.52, L * 0.2); ctx.fill();
                ctx.fillStyle = vgrad(ctx, -L * 0.2, L * 0.2, ['#b0703a', '#7a4520']);
                ctx.beginPath(); ctx.moveTo(-L * 0.55, 0); ctx.quadraticCurveTo(-L * 0.25, -L * 0.21, L * 0.1, -L * 0.2); ctx.lineTo(L * 0.48, -L * 0.15); ctx.lineTo(L * 0.48, L * 0.15); ctx.lineTo(L * 0.1, L * 0.2); ctx.quadraticCurveTo(-L * 0.25, L * 0.21, -L * 0.55, 0); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#4a2810'; ctx.lineWidth = 2; ctx.stroke();
                ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 1;
                for (i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-L * 0.3, i * L * 0.06); ctx.lineTo(L * 0.44, i * L * 0.055); ctx.stroke(); }
                // rudder at the stern follows the wheel
                ctx.save(); ctx.translate(L * 0.5, 0); ctx.rotate(-S.wa / 2.4 * 0.6); ctx.fillStyle = '#5a3517'; rr(ctx, 0, -3, L * 0.13, 6, 2); ctx.fill(); ctx.restore();
                // sail with a Coptic cross
                ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.moveTo(-L * 0.02, -L * 0.3); ctx.quadraticCurveTo(-L * 0.17, 0, -L * 0.02, L * 0.3); ctx.lineTo(L * 0.06, L * 0.28); ctx.lineTo(L * 0.06, -L * 0.28); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 1; ctx.stroke();
                copticCross(ctx, -L * 0.04, 0, L * 0.09, C.red);
                ctx.fillStyle = '#5a3517'; ctx.beginPath(); circ(ctx, L * 0.06, 0, 3.5); ctx.fill();
                ctx.restore();
                // sparks on the deck
                for (i = 0; i < S.sparks.length; i++) {
                    var spk = S.sparks[i], px = g.sx + spk.ox, py = S.sy + spk.oy;
                    if (spk.st === 'on') {
                        var rr2 = 5 + spk.g * 12;
                        flame(ctx, px, py, rr2 * 0.6, t * 1.5 + i);
                        ctx.strokeStyle = 'rgba(255,90,40,' + (0.4 + 0.4 * Math.sin(t * 9)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, rr2 + 8, -Math.PI / 2, -Math.PI / 2 + TAU * spk.g); ctx.stroke();
                        chip(ctx, spk.s, px, py - rr2 - 16, 10, 'rgba(90,20,15,0.85)', '#ffd8d0');
                    } else if (spk.st === 'burn') flame(ctx, px, py, 12 * (1 - spk.t / 0.6) + 2, t);
                }
                drawWheel(ctx, g, S.wa);
                txt(ctx, 'الدفة', g.hx, g.hy + g.hr + 4, font(11, 900), '#fff5d6', 'center', 3);
                if (S.ph === 0 && S.active && k.t < 9) {
                    ctx.globalAlpha = clamp(9 - k.t, 0, 1);
                    txt(ctx, '↻ لف الدفة', g.hx - g.hr - 40, g.hy - g.hr * 0.4, font(14, 900), '#fff', 'center', 4);
                    ctx.globalAlpha = 1;
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 7. resistFlee -- يعقوب ٤ («قاوموا إبليس فيهرب منكم. اقتربوا إلى الله فيقترب إليكم» ٤: ٧-٨)
     * A young man walks toward the church at dusk. Hold to draw near (the church
     * also comes toward you: «فيقترب إليكم»). Temptations of lust come at him
     * as shadows wrapped in a shrinking golden ring: tap one right when the
     * ring closes on it to resist -- it runs away. Too early does nothing; if
     * it reaches you, a life. Phase 1: the three lusts, from ahead. Phase 2:
     * from both sides, faster. Phase 3 (twist): humble yourselves and do not
     * judge -- brothers who fell walk by too: do NOT strike them; let them pass
     * and you pray for them. Data: temptations[], brothers[], questions, intro,
     * outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.resistFlee = function (host, data, api) {
        data = data || {};
        var TL = strList(data.temptations), BL = strList(data.brothers);
        if (!TL.length) TL = ['…'];
        var PH = [{ nt: 6, nb: 0, gap: 3.4, sp: 0.11, both: false }, { nt: 8, nb: 0, gap: 2.7, sp: 0.135, both: true }, { nt: 7, nb: BL.length ? 4 : 0, gap: 2.5, sp: 0.14, both: true }];
        var NT = PH[0].nt + PH[1].nt + PH[2].nt, NB = PH[2].nb;
        var S = { ph: -1, prog: 0, walk: false, keyWalk: false, scroll: 0, ents: [], plan: [], planT: 0, active: false, ti: 0, bi: 0, id: 0, resistT: 0, slowT: 0, wstep: 0 };
        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.86), ph = clamp(H * 0.3, 70, 140);
            return { W: W, H: H, gy: gy, ph: ph, yx: W * 0.68, ty: gy - ph * 0.55, rB: ph * 0.24, Ds: W * 0.13 };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                sky(x, W, g.gy, ['#1e1a3e', '#4a3a6a', '#c27a5a', '#f2b27a']);
                var r = seeded(4);
                x.fillStyle = 'rgba(255,250,230,0.8)';
                for (var i = 0; i < 40; i++) { x.beginPath(); circ(x, r() * W, r() * g.gy * 0.45, 0.6 + r() * 1.2); x.fill(); }
                x.fillStyle = 'rgba(60,40,70,0.7)'; ridge(x, W, g.gy - H * 0.14, H * 0.07, 6, 3, g.gy); x.fill();
            });
            S.ground = layer(W, H - g.gy + 4, k.dpr, function (x, w, h) {
                x.fillStyle = vgrad(x, 0, h, ['#a98256', '#8a6640', '#6b4c2e']); x.fillRect(0, 0, w, h);
                var r = seeded(9); x.fillStyle = 'rgba(60,35,15,0.3)';
                for (var i = 0; i < 40; i++) { x.beginPath(); ell(x, r() * w, r() * h, 1 + r() * 3, 0.7 + r()); x.fill(); }
            });
        }
        function startPhase(k, n) {
            var P = PH[n], i, plan = [];
            S.ph = n; S.active = false; S.prog = 0;
            for (i = 0; i < P.nt; i++) plan.push('t');
            for (i = 0; i < P.nb; i++) plan.push('b');
            plan = shuffle(plan);
            if (plan[0] === 'b') { var j = plan.indexOf('t'); plan[0] = 't'; plan[j] = 'b'; }
            S.plan = plan; S.planT = 1;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; });
        }
        function spawn(k, kind) {
            var g = S.g, P = PH[S.ph], side = kind === 'b' ? -1 : (P.both && Math.random() < 0.45 ? 1 : -1);
            S.ents.push({ id: S.id++, kind: kind, side: side, x: side < 0 ? -60 : g.W + 60, s: kind === 'b' ? BL[S.bi++ % BL.length] : TL[S.ti++ % TL.length], st: 'come', t: 0, passed: false, walk: 0 });
            if (kind === 't') k.sfx('whoosh');
        }
        function entAt(p) {
            var g = S.g, best = null, bd = 1e9;
            for (var i = 0; i < S.ents.length; i++) {
                var e = S.ents[i];
                if (e.st !== 'come') continue;
                var ey = e.kind === 'b' ? g.gy - g.ph * 0.5 : g.ty, d = dist2(p.x, p.y, e.x, ey), r = (e.kind === 'b' ? g.ph * 0.45 : g.rB * 2);
                if (d < r * r && d < bd) { bd = d; best = e; }
            }
            return best;
        }
        function resist(k, e) {
            var g = S.g, dd = Math.abs(e.x - g.yx) - g.Ds;
            if (dd > g.W * 0.075) { k.pop(e.x, g.ty - g.rB * 2, 'استنى لما الدايرة تقفل', '#ffe9b8', 13); k.breakCombo(); return; }
            var base = Math.abs(dd) < g.W * 0.03 ? 10 : (dd > -g.W * 0.075 ? 6 : 4);
            e.st = 'flee'; e.t = 0; S.resistT = 0.6;
            k.hit(base, e.x, g.ty - g.rB * 2, { text: base === 10 ? 'قاوم! ' : '' });
            k.emit(e.x, g.ty, 20, { colors: ['#2a1a3a', '#6a4a8a', C.goldL], grav: -40 });
            k.glyphBurst(g.yx - 20, g.ty - g.ph * 0.4, 3);
            k.sfx('power');
        }
        function judge(k, e) {
            var g = S.g;
            e.st = 'judged'; e.t = 0;
            if (k.loseLife(e.x, g.gy - g.ph * 1.15, 'متدينش!') <= 0) k.finish({ lose: true, title: 'ولا يهمك… قاوم إبليس واتضع قدام ربنا، جرّب تاني', finaleT: 1.2 });
        }
        function nearest() {
            var g = S.g, best = null, bd = 1e9;
            for (var i = 0; i < S.ents.length; i++) { var e = S.ents[i]; if (e.kind === 't' && e.st === 'come') { var d = Math.abs(e.x - g.yx); if (d < bd) { bd = d; best = e; } } }
            return best;
        }

        var k = createCore(host, data, api, {
            title: 'قاوم واقترب', icon: '🛡️',
            howto: { kind: 'hold', text: 'دوس مطوّل عشان تمشي ناحية الكنيسة. لما تجربة تقرّب، اضغط عليها لما الدايرة الدهبي تقفل عليها… فتهرب منك!' },
            comboStep: 4, maxMult: 3, pad: [110, 164.8], lives: 3, factY: 0.12,
            rawMax: function (k) { return perfectSeq(k, rep(NT, 10).concat(rep(NB, 5))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 7; return '🙏 «يعطي نعمة أعظم»: التجارب أبطأ'; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i;
                S.resistT = Math.max(0, S.resistT - dt); S.slowT = Math.max(0, S.slowT - dt);
                var walking = S.active && ((k.pdown && S.walk) || S.keyWalk);
                if (S.active) S.prog = Math.min(1, S.prog + dt * (walking ? 1 / 15 : 1 / 45));
                if (walking) { S.scroll += g.W * 0.12 * dt; S.wstep += dt * 7; }
                if (!S.active) return;
                if (S.plan.length) { S.planT -= dt; if (S.planT <= 0) { spawn(k, S.plan.shift()); S.planT = P.gap * rand(0.85, 1.15) * (S.slowT > 0 ? 1.3 : 1); } }
                var sp = g.W * P.sp * (S.slowT > 0 ? 0.6 : 1);
                for (i = S.ents.length - 1; i >= 0; i--) {
                    var e = S.ents[i];
                    e.t += dt;
                    if (e.st === 'come') {
                        e.walk += dt * 7;
                        if (e.kind === 'b') {
                            e.x += g.W * 0.1 * dt;
                            if (!e.passed && e.x > g.yx + g.W * 0.07) { e.passed = true; k.hit(5, g.yx, g.gy - g.ph * 1.2, { text: '🙏 صلّيت له ' }); }
                            if (e.x > g.W + 70) S.ents.splice(i, 1);
                        } else {
                            e.x += -e.side * sp * dt;
                            if (Math.abs(e.x - g.yx) < g.W * 0.045) {
                                e.st = 'hit'; e.t = 0;
                                k.emit(g.yx, g.ty, 16, { colors: ['#2a1a3a', '#e0443a', '#fff'], grav: 100 });
                                if (k.loseLife(g.yx, g.gy - g.ph * 1.15, plain(e.s)) <= 0) { k.finish({ lose: true, title: 'ولا يهمك… قاوم إبليس فيهرب منك، جرّب تاني', finaleT: 1.2 }); return; }
                            }
                        }
                    } else if (e.st === 'flee') { e.x += e.side * g.W * 0.9 * dt; if (e.t > 0.8) S.ents.splice(i, 1); }
                    else if (e.t > 0.7) S.ents.splice(i, 1);
                }
                if (!S.plan.length && !S.ents.length && S.prog >= 1) {
                    S.active = false;
                    k.glyphBurst(g.yx - 40, g.gy - g.ph, 6);
                    if (S.ph >= 2) { k.finish({ title: 'قربت من ربنا… وهو قرب منك! ⛪', finaleT: 2.4 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.8, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: [C.goldL, '#fff'], grav: 60, up: 40 });
            },
            down: function (k, p) {
                var e = entAt(p);
                S.walk = false;
                if (e) { if (e.kind === 'b') judge(k, e); else resist(k, e); return; }
                S.walk = true;
            },
            up: function (k) { S.walk = false; },
            key: function (k, key, isDown) {
                if (key === 'ArrowLeft') { S.keyWalk = isDown; return true; }
                if (isDown && key === ' ') { var e = nearest(); if (e) resist(k, e); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i;
                blit(ctx, S.bg, 0, 0);
                // the church draws near
                var cp = eo(S.prog), cx = lerp(W * 0.05, g.yx - W * 0.26, cp), cs = H * lerp(0.36, 0.62, cp);
                glow(ctx, cx, g.gy - cs * 0.45, cs * (1.1 + 0.3 * cp), 'rgba(255,220,140,' + (0.3 + 0.35 * cp) + ')');
                church(ctx, cx, g.gy, cs, '#d8b088', 'rgba(255,236,170,0.95)');
                if (cp > 0.3) {
                    ctx.save(); ctx.globalAlpha = (cp - 0.3) * 0.5;
                    ctx.fillStyle = 'rgba(255,236,170,0.35)';
                    ctx.beginPath(); ctx.moveTo(cx + cs * 0.1, g.gy - cs * 0.2); ctx.lineTo(g.yx, g.gy - g.ph * 1.1); ctx.lineTo(g.yx, g.gy); ctx.lineTo(cx + cs * 0.1, g.gy); ctx.closePath(); ctx.fill();
                    ctx.restore();
                }
                blitTiled(ctx, S.ground, -S.scroll, g.gy - 2, W);
                frieze(ctx, k, 0, g.gy - 3, W, 7, 'rgba(142,31,31,0.5)');
                // entities
                for (i = 0; i < S.ents.length; i++) {
                    var e = S.ents[i];
                    if (e.kind === 'b') {
                        var ba = e.st === 'come' ? 1 : 1 - clamp(e.t / 0.7, 0, 1);
                        ctx.save(); ctx.globalAlpha = ba;
                        figure(ctx, { x: e.x, y: g.gy - 2, h: g.ph * 0.95, dir: 1, robe: '#cfd8e3', mantle: '#3b5f86', hair: '#2b1a0e', walk: e.walk, t: t + e.id, dpr: k.dpr });
                        ctx.restore();
                        if (e.st === 'come') chip(ctx, e.s, e.x, g.gy - g.ph * 1.15, clamp(H * 0.036, 10, 13), 'rgba(31,80,130,0.9)', '#e6f3ff');
                        continue;
                    }
                    var a = e.st === 'come' ? 1 : 1 - clamp(e.t / 0.8, 0, 1), ex = e.x, ey = g.ty + Math.sin(t * 3 + e.id) * 4, rb = g.rB;
                    ctx.save(); ctx.globalAlpha = a;
                    ctx.fillStyle = 'rgba(25,10,35,0.88)';
                    ctx.beginPath(); ell(ctx, ex, ey, rb, rb * 1.1);
                    for (var w = -2; w <= 2; w++) ell(ctx, ex + w * rb * 0.35, ey + rb * 0.9 + Math.sin(t * 6 + w) * 3, rb * 0.22, rb * 0.3);
                    ctx.fill();
                    ctx.fillStyle = '#ff4b3a'; ctx.beginPath(); circ(ctx, ex - rb * 0.32 * e.side * -1, ey - rb * 0.15, rb * 0.12); circ(ctx, ex + rb * 0.05 * e.side, ey - rb * 0.15, rb * 0.12); ctx.fill();
                    ctx.restore();
                    if (e.st === 'come') {
                        var dd = Math.abs(e.x - g.yx) - g.Ds, rr3 = rb * clamp(1.15 + Math.max(0, dd) / (g.W * 0.09), 1.15, 3.6), inW = Math.abs(dd) < g.W * 0.075;
                        ctx.strokeStyle = inW ? 'rgba(255,248,210,' + (0.7 + 0.3 * Math.sin(t * 14)) + ')' : 'rgba(226,179,77,0.75)'; ctx.lineWidth = inW ? 4 : 2.5;
                        ctx.beginPath(); ctx.arc(ex, ey, rr3, 0, TAU); ctx.stroke();
                        chip(ctx, e.s, ex, ey - rb * 1.6 - 8, clamp(H * 0.036, 10, 13), 'rgba(90,15,15,0.92)', '#ffd8d0');
                    }
                }
                // the young man
                var hand = youth(ctx, k, g.yx, g.gy - 2, g.ph, -1, ((k.pdown && S.walk) || S.keyWalk) && S.active ? S.wstep : -1, '#f3ead6', { arm: S.resistT > 0 ? 2.7 : null });
                if (S.resistT > 0) { glow(ctx, hand.x, hand.y - 8, 30, 'rgba(255,231,163,0.7)'); drawCross(ctx, hand.x, hand.y - 10, 10, C.gold, k.dpr); }
                // distance to the church
                ctx.fillStyle = 'rgba(20,10,4,0.5)'; rr(ctx, W / 2 - 80, H - 14, 160, 8, 4); ctx.fill();
                ctx.fillStyle = C.goldL; rr(ctx, W / 2 - 80, H - 14, 160 * S.prog, 8, 4); ctx.fill();
                drawCross(ctx, W / 2 - 92, H - 10, 6, C.gold, k.dpr);
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 8. rainPrayer -- يعقوب ٥ (الفلاح الصبور ٥: ٧، صلاة إيليا ٥: ١٧-١٨، صلاة الإيمان ٥: ١٣-١٦)
     * Small clouds drift in the sky. Drag a cloud onto another to merge them
     * into a bigger one; drag a cloud down over the land and let go to make it
     * rain there. Phase 1: the patient farmer -- each field needs the early rain
     * (a cloud of 2) after sowing and the latter rain (a cloud of 3) before the
     * harvest; rain too early and it is wasted («تأنّوا»). Phase 2: Elijah on
     * Carmel -- tiny clouds «like a man's hand» rise from the sea, the sun dries
     * them; gather big clouds (3, 4, 5) for the dry land. Phase 3 (twist): the
     * prayer of faith -- clouds carry what to do (pray, sing, call the priests,
     * bring him back...); drop each on the house whose need it answers.
     * Data: handCloud, needs[{who, ans}], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.rainPrayer = function (host, data, api) {
        data = data || {};
        var needs = (data.needs || []).filter(function (n) { return n && n.who && n.ans; }).map(function (n) { return { who: plain(n.who), ans: plain(n.ans) }; });
        var hand = plain(data.handCloud || '');
        var NP3 = Math.min(5, needs.length), NE = 4 + 3 + NP3;
        var S = { ph: -1, clouds: [], fields: [], regs: [], ri: 0, houses: [], q: [], openT: 0, drag: null, active: false, spawnT: 0, id: 0, rains: [], slowT: 0, bonus: 0, sun: 0 };
        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.74);
            return { W: W, H: H, gy: gy, sk0: H * 0.15, rainY: gy - H * 0.3, cs: clamp(H * 0.048, 15, 28) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bgs = [0, 1, 2].map(function (n) {
                return layer(W, H, k.dpr, function (x) {
                    sky(x, W, g.gy, n === 1 ? ['#c8743a', '#e8a85a', '#f6d79a'] : ['#4f86c0', '#9cc7e6', '#f6dfb0'], n === 1 ? [W * 0.72, H * 0.14, H * 0.07] : [W * 0.84, H * 0.12, H * 0.04]);
                    x.fillStyle = n === 1 ? 'rgba(140,80,50,0.55)' : 'rgba(120,140,90,0.6)'; ridge(x, W, g.gy - H * 0.06, H * 0.05, 31 + n, 3, g.gy + 4); x.fill();
                    if (n === 1) {
                        x.fillStyle = '#1f6fa3'; x.fillRect(0, g.gy - H * 0.02, W * 0.12, H);
                        x.fillStyle = '#8a6a4a'; x.beginPath(); x.moveTo(W * 0.06, g.gy); x.quadraticCurveTo(W * 0.14, g.gy - H * 0.2, W * 0.24, g.gy); x.closePath(); x.fill();
                    }
                    x.fillStyle = vgrad(x, g.gy, H, n === 1 ? ['#b98a5a', '#9a6e44'] : ['#8a6a3e', '#6b4c2e']); x.fillRect(n === 1 ? W * 0.12 : 0, g.gy, W, H - g.gy);
                    if (n === 1) {
                        x.strokeStyle = 'rgba(70,40,20,0.45)'; x.lineWidth = 1.2; var r = seeded(3);
                        for (var i = 0; i < 26; i++) { var cx = W * (0.25 + r() * 0.72), cy = g.gy + 6 + r() * (H - g.gy - 10); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 8 + r() * 10, cy + r() * 6 - 3); x.lineTo(cx + 14 + r() * 8, cy + r() * 8 - 4); x.stroke(); }
                    }
                    if (n === 0) church(x, W * 0.08, g.gy, H * 0.22, '#b58a66');
                });
            });
        }
        function rad(c) { return S.g.cs * (0.9 + 0.28 * (Math.min(8, c.n) - 1)); }
        function startPhase(k, n) {
            var g = S.g, i;
            S.ph = n; S.active = false; S.clouds = []; S.spawnT = 0.5;
            if (n === 0) S.fields = [0.34, 0.62].map(function (x) { return { x: g.W * x, w: g.W * 0.22, st: 0, t: 0, d: rand(2.5, 4.5), T: 15 }; });
            if (n === 1) { S.regs = [0.38, 0.6, 0.82].map(function (x, j) { return { x: g.W * x, w: g.W * 0.2, need: 3 + j, st: 'dry', t: 0 }; }); S.ri = 0; }
            if (n === 2) { S.houses = [0.2, 0.42, 0.64, 0.86].map(function (x) { return { x: g.W * x, need: null, t: 0, T: 17, glow: 0 }; }); S.q = shuffle(needs).slice(0, NP3); S.openT = 1.5; }
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; if (n === 2 && !S.q.length) phaseDone(k); });
        }
        function phaseDone(k) {
            S.active = false; S.drag = null;
            if (S.ph >= 2) { k.finish({ title: 'السما ادّت مطر! 🌧️', finaleT: 2.4 }); return; }
            var n2 = S.ph + 1;
            k.after(1, function () { k.checkpoint(function () { startPhase(k, n2); }); });
        }
        function spawnCloud(k) {
            var g = S.g, c = { id: S.id++, n: 1, st: 'float', t: 0, age: 0, bob: rand(0, TAU), ans: null };
            if (S.ph === 1) { c.x = g.W * 0.05; c.y = g.rainY - g.cs; c.vx = g.W * rand(0.025, 0.04); c.rise = 1; c.ty = rand(g.sk0 + g.cs * 2, g.rainY - g.cs * 2.5); }
            else { c.x = g.W + 40; c.y = rand(g.sk0 + g.cs * 1.5, g.rainY - g.cs * 2); c.vx = -g.W * rand(0.02, 0.035); }
            if (S.ph === 2) {
                var open = S.houses.filter(function (h) { return h.need; }), pool = open.length && Math.random() < 0.7 ? open.map(function (h) { return h.need.ans; }) : needs.map(function (n) { return n.ans; });
                c.ans = pool[Math.floor(Math.random() * pool.length)];
            }
            S.clouds.push(c);
        }
        function cloudAt(p) {
            for (var i = S.clouds.length - 1; i >= 0; i--) { var c = S.clouds[i]; if (c.st === 'float' && dist2(p.x, p.y, c.x, c.y) < Math.pow(rad(c) * 1.25 + 6, 2)) return c; }
            return null;
        }
        function rain(k, c, x) {
            c.st = 'rain'; c.t = 0;
            S.rains.push({ c: c, t: 0 });
            k.sfx('splash');
        }
        function bounce(c, msg, k) { c.y = Math.min(c.y, S.g.rainY - rad(c) * 1.4); k.pop(c.x, c.y - rad(c) - 10, msg, '#ffe9b8', 14); }
        function drop(k, c) {
            var g = S.g, i;
            // merge with another cloud
            if (S.ph < 2) for (i = 0; i < S.clouds.length; i++) {
                var o = S.clouds[i];
                if (o === c || o.st !== 'float') continue;
                if (dist2(o.x, o.y, c.x, c.y) < Math.pow((rad(o) + rad(c)) * 0.75, 2)) {
                    o.n = Math.min(8, o.n + c.n); o.age = 0; c.st = 'gone';
                    k.pop(o.x, o.y - rad(o) - 8, '☁️ ' + ar(o.n), '#e6f7ff', 16);
                    k.emit(o.x, o.y, 10, { colors: ['#ffffff', '#e6f7ff'], grav: 40 });
                    k.sfx('whoosh');
                    return;
                }
            }
            if (c.y < g.rainY) return;
            if (S.ph === 0) {
                for (i = 0; i < S.fields.length; i++) {
                    var f = S.fields[i];
                    if (Math.abs(c.x - f.x) > f.w / 2 + rad(c) * 0.3) continue;
                    if (f.st === 1 || f.st === 3) {
                        var need = f.st === 1 ? 2 : 3;
                        if (c.n < need) { bounce(c, 'محتاج سحابة أكبر (' + ar(need) + ')', k); return; }
                        rain(k, c); f.st++; f.t = 0; f.d = rand(4, 6);
                        k.hit(10, f.x, g.gy - g.H * 0.12, { text: f.st === 2 ? 'المطر المبكر ' : 'المطر المتأخر ' });
                    } else { rain(k, c); k.breakCombo(); k.pop(f.x, g.gy - g.H * 0.14, 'تأنّى… لسه مش وقته', '#ffe9b8', 15); }
                    return;
                }
                bounce(c, '', k);
            } else if (S.ph === 1) {
                var R = S.regs[S.ri];
                if (!R || Math.abs(c.x - R.x) > R.w / 2 + rad(c) * 0.4) { bounce(c, R ? 'على الأرض اللي منوّرة' : '', k); return; }
                if (c.n < R.need) { bounce(c, 'محتاج سحابة أكبر (' + ar(R.need) + ')', k); return; }
                rain(k, c); R.st = 'green'; R.t = 0;
                k.hit(10, R.x, g.gy - g.H * 0.12, { text: '🌧️ ' });
                k.glyphBurst(R.x, g.gy - g.H * 0.2, 5);
                S.ri++;
                if (S.ri >= S.regs.length) k.after(1.6, function () { phaseDone(k); });
            } else {
                for (i = 0; i < S.houses.length; i++) {
                    var h = S.houses[i];
                    if (Math.abs(c.x - h.x) > g.W * 0.1) continue;
                    if (!h.need) { bounce(c, '', k); return; }
                    if (c.ans === h.need.ans) {
                        rain(k, c); h.need = null; h.glow = 1;
                        k.hit(10, h.x, g.gy - g.H * 0.22, { text: '🙏 ' });
                        k.emit(h.x, g.gy - g.H * 0.1, 18, { colors: [C.goldL, '#e6f7ff', '#fff'], up: 60 });
                    } else {
                        c.st = 'gone';
                        k.emit(c.x, c.y, 10, { colors: ['#9aa', '#fff'], grav: 60 });
                        if (k.loseLife(h.x, g.gy - g.H * 0.22, 'مش ده اللي محتاجه') <= 0) k.finish({ lose: true, title: 'ولا يهمك… صلّوا بعضكم لأجل بعض، جرّب تاني', finaleT: 1.2 });
                    }
                    return;
                }
                bounce(c, '', k);
            }
        }
        function drawField(ctx, f, g, t) {
            var x0 = f.x - f.w / 2, y = g.gy + 6, hgt = g.H - g.gy - 12;
            ctx.fillStyle = f.st === 1 || f.st === 3 ? '#9a7048' : '#6b4a2a'; rr(ctx, x0, y, f.w, hgt, 6); ctx.fill();
            ctx.strokeStyle = 'rgba(40,20,5,0.35)'; ctx.lineWidth = 1.2;
            for (var r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(x0 + 4, y + hgt * r / 4); ctx.lineTo(x0 + f.w - 4, y + hgt * r / 4); ctx.stroke(); }
            var gh = f.st <= 1 ? 3 : (f.st <= 3 ? 10 : 18);
            for (var i = 0; i < 9; i++) {
                var px = x0 + f.w * (0.08 + i * 0.105), py = g.gy + 6 + hgt * 0.7;
                ctx.strokeStyle = f.st >= 4 ? '#e2b34d' : (f.st === 1 || f.st === 3 ? '#9a9a4a' : '#5e9a3a'); ctx.lineWidth = 2.2;
                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(t * 2 + i) * 1.5, py - gh); ctx.stroke();
                if (f.st >= 4) { ctx.fillStyle = '#e2b34d'; ctx.beginPath(); ell(ctx, px + Math.sin(t * 2 + i) * 1.5, py - gh - 3, 2.2, 4.5); ctx.fill(); }
            }
            if (f.st === 1 || f.st === 3) {
                chip(ctx, '💧 ' + ar(f.st === 1 ? 2 : 3), f.x, g.gy - 14, 12, 'rgba(31,80,130,0.9)', '#e6f3ff', '#bfe8ff');
                ring(ctx, f.x + 34, g.gy - 14, 8, 1 - f.t / f.T, f.t > f.T * 0.7 ? '#e0443a' : '#bfe8ff', 2.5);
            }
        }

        var k = createCore(host, data, api, {
            title: 'صلاة ومطر', icon: '🌧️',
            howto: { kind: 'drag', text: 'اسحب سحابة على سحابة عشان يكبروا، واسحبها لتحت فوق الأرض العطشانة وسيبها عشان تمطّر… بس استنى لما الأرض تطلب.' },
            comboStep: 4, maxMult: 3, pad: [130.8, 196], lives: 3, factY: 0.12,
            rawMax: function (k) { return perfectSeq(k, rep(NE, 10).concat(rep(2, 5))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 10; S.bonus = 1; return '🙏 «صلّى أيضًا»: سحاب أكتر ووقت أطول'; },
            update: function (k, dt) {
                var g = S.g, i, c;
                S.slowT = Math.max(0, S.slowT - dt);
                for (i = S.rains.length - 1; i >= 0; i--) {
                    var rn = S.rains[i]; rn.t += dt;
                    if (Math.random() < dt * 40) k.emit(rn.c.x + rand(-1, 1) * rad(rn.c) * 0.8, rn.c.y + rad(rn.c) * 0.3, 1, { kind: 1, dir: Math.PI / 2, spread: 0.05, vmin: 380, vmax: 460, grav: 300, up: 0, lmin: 0.25, lmax: 0.45, rmin: 2, rmax: 3, colors: ['#bfe8ff', '#e6f7ff'] });
                    if (rn.t > 1.4) { rn.c.st = 'gone'; S.rains.splice(i, 1); }
                }
                for (i = S.clouds.length - 1; i >= 0; i--) {
                    c = S.clouds[i];
                    c.t += dt; c.bob += dt;
                    if (c.st === 'gone') { S.clouds.splice(i, 1); continue; }
                    if (c.st !== 'float') continue;
                    c.age += dt;
                    c.x += c.vx * dt * (S.slowT > 0 ? 0.6 : 1);
                    if (c.rise) { c.y += (c.ty - c.y) * Math.min(1, dt * 0.8); if (Math.abs(c.ty - c.y) < 2) c.rise = 0; }
                    else if (c.y > g.rainY - rad(c) * 1.2) c.y -= g.H * 0.15 * dt;
                    if (c.x < g.W * 0.06) c.vx = Math.abs(c.vx);
                    if (c.x > g.W * 0.94 && c.vx > 0) c.vx = -Math.abs(c.vx);
                    if (S.ph === 1 && c.age > (S.slowT > 0 ? 11 : 7.5)) { c.age = 0; c.n--; k.pop(c.x, c.y - rad(c), '☀️', '#ffe9b8', 14); if (c.n <= 0) c.st = 'gone'; }
                }
                if (!S.active) return;
                S.spawnT -= dt;
                var maxC = S.ph === 1 ? 7 : (S.ph === 2 ? 5 : 6), cnt = 0;
                for (i = 0; i < S.clouds.length; i++) if (S.clouds[i].st !== 'gone') cnt++;
                if (S.spawnT <= 0 && cnt < maxC) { spawnCloud(k); S.spawnT = (S.ph === 1 ? 1.25 : 1.6) * (S.bonus ? 0.7 : 1); }
                if (S.ph === 0) {
                    var done = true;
                    for (i = 0; i < S.fields.length; i++) {
                        var f = S.fields[i];
                        f.t += dt;
                        if (f.st === 0 || f.st === 2) { if (f.t >= f.d) { f.st++; f.t = 0; f.T = 15 + (S.bonus ? 4 : 0); k.sfx('tick'); } }
                        else if (f.st === 1 || f.st === 3) {
                            if (f.t >= f.T) {
                                f.st++; f.t = 0; f.d = rand(4, 6);
                                if (k.loseLife(f.x, g.gy - g.H * 0.14, 'الأرض عطشت') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… تأنّى وصلّي وجرّب تاني', finaleT: 1.2 }); return; }
                            }
                        } else if (f.st === 4) { if (f.t > 1.4) { f.st = 5; k.hit(5, f.x, g.gy - g.H * 0.12, { text: 'الحصاد 🌾 ' }); k.glyphBurst(f.x, g.gy - g.H * 0.1, 3); } }
                        if (f.st < 5) done = false;
                    }
                    if (done) phaseDone(k);
                } else if (S.ph === 1) {
                    var R = S.regs[S.ri];
                    if (R) {
                        R.t += dt;
                        if (R.t >= 24 + (S.bonus ? 6 : 0)) {
                            R.st = 'dried'; S.ri++;
                            if (k.loseLife(R.x, g.gy - g.H * 0.14, 'الأرض لسه ناشفة') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… صلّي تاني زي إيليا', finaleT: 1.2 }); return; }
                            if (S.ri >= S.regs.length) phaseDone(k);
                        }
                    }
                } else {
                    var openN = 0, free = [];
                    for (i = 0; i < S.houses.length; i++) {
                        var h = S.houses[i];
                        h.glow = Math.max(0, h.glow - dt);
                        if (h.need) {
                            openN++; h.t += dt;
                            if (h.t >= h.T) {
                                h.need = null;
                                if (k.loseLife(h.x, g.gy - g.H * 0.22, 'الوقت خلص') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… صلّوا بعضكم لأجل بعض، جرّب تاني', finaleT: 1.2 }); return; }
                                openN--;
                            }
                        } else if (h.glow <= 0) free.push(h);
                    }
                    S.openT -= dt;
                    if (S.q.length && openN < 2 && free.length && S.openT <= 0) { var hh = free[Math.floor(Math.random() * free.length)]; hh.need = S.q.shift(); hh.t = 0; hh.T = 17 + (S.bonus ? 5 : 0); S.openT = 2.2; k.sfx('page'); }
                    if (!S.q.length && openN === 0 && !S.rains.length) phaseDone(k);
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 20) k.emit(rand(0, k.W), k.H * 0.2, 1, { kind: 1, dir: Math.PI / 2, spread: 0.05, vmin: 380, vmax: 460, grav: 300, up: 0, lmin: 0.3, lmax: 0.6, colors: ['#bfe8ff', '#e6f7ff'] });
            },
            down: function (k, p) {
                var c = cloudAt(p);
                if (!c) { k.sfx('tap'); return; }
                c.st = 'drag'; c.age = 0; c.rise = 0;
                S.drag = { c: c, dx: c.x - p.x, dy: c.y - p.y };
            },
            move: function (k, p) {
                var d = S.drag;
                if (!d || d.c.st !== 'drag') return;
                var g = S.g;
                d.c.x = clamp(p.x + d.dx, 20, g.W - 20); d.c.y = clamp(p.y + d.dy, g.sk0, g.gy - rad(d.c) * 0.5);
            },
            up: function (k) {
                var d = S.drag;
                S.drag = null;
                if (!d || d.c.st !== 'drag') return;
                d.c.st = 'float';
                if (S.active) drop(k, d.c);
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, ph = clamp(S.ph, 0, 2);
                blit(ctx, S.bgs[ph], 0, 0);
                // rain line
                if (S.drag) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]);
                    ctx.beginPath(); ctx.moveTo(0, g.rainY); ctx.lineTo(W, g.rainY); ctx.stroke(); ctx.setLineDash([]);
                    txt(ctx, 'سيبها تحت الخط عشان تمطّر', W * 0.5, g.rainY - 10, font(12, 800), '#fff', 'center', 3);
                }
                if (ph === 0) {
                    for (i = 0; i < S.fields.length; i++) drawField(ctx, S.fields[i], g, t);
                    figure(ctx, { x: W * 0.86, y: g.gy + (H - g.gy) * 0.5, h: clamp(H * 0.26, 60, 120), dir: -1, robe: '#e9e1cf', mantle: '#6b4a2a', hair: '#3a2414', beard: 1, prop: 'staff', t: t, dpr: k.dpr });
                } else if (ph === 1) {
                    for (i = 0; i < S.regs.length; i++) {
                        var R = S.regs[i], x0 = R.x - R.w / 2;
                        if (R.st === 'green') { ctx.fillStyle = 'rgba(95,154,58,' + clamp(R.t * 1.5, 0, 0.85) + ')'; rr(ctx, x0, g.gy + 4, R.w, H - g.gy - 8, 8); ctx.fill(); }
                        if (i === S.ri && S.active) {
                            ctx.strokeStyle = 'rgba(255,231,163,' + (0.5 + 0.4 * Math.sin(t * 5)) + ')'; ctx.lineWidth = 2.5; rr(ctx, x0, g.gy + 4, R.w, H - g.gy - 8, 8); ctx.stroke();
                            chip(ctx, '☁️ ' + ar(R.need), R.x, g.gy - 14, 12, 'rgba(31,80,130,0.9)', '#e6f3ff', '#bfe8ff');
                            ring(ctx, R.x + 36, g.gy - 14, 8, 1 - R.t / (24 + (S.bonus ? 6 : 0)), '#bfe8ff', 2.5);
                        }
                    }
                    figure(ctx, { x: W * 0.15, y: g.gy - H * 0.11, h: clamp(H * 0.2, 48, 96), dir: -1, robe: '#e8d9b8', mantle: '#7a4a1e', hair: '#5a4a3a', beard: 1, halo: true, arm: 2.7, arm2: 2.5, t: t, dpr: k.dpr });
                    if (hand && S.active && k.t < 30) chip(ctx, hand, W * 0.15, g.gy - H * 0.36, 11, 'rgba(70,12,12,0.85)', '#fff5d6');
                } else {
                    for (i = 0; i < S.houses.length; i++) {
                        var hs = S.houses[i], hw = clamp(W * 0.11, 50, 110), hh2 = clamp(H * 0.17, 40, 80), hx = hs.x, hy = g.gy + (H - g.gy) * 0.55;
                        if (hs.glow > 0) glow(ctx, hx, hy - hh2 * 0.5, hw, 'rgba(255,231,163,' + hs.glow * 0.7 + ')');
                        ctx.fillStyle = '#e9dcc0'; ctx.fillRect(hx - hw / 2, hy - hh2, hw, hh2);
                        ctx.beginPath(); ctx.arc(hx, hy - hh2, hw * 0.28, Math.PI, 0); ctx.fill();
                        ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 1.2; ctx.strokeRect(hx - hw / 2, hy - hh2, hw, hh2);
                        ctx.fillStyle = '#5a3517'; ctx.beginPath(); ctx.arc(hx, hy - hh2 * 0.35, hw * 0.13, Math.PI, 0); ctx.lineTo(hx + hw * 0.13, hy); ctx.lineTo(hx - hw * 0.13, hy); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = 'rgba(255,214,130,0.85)'; ctx.fillRect(hx - hw * 0.36, hy - hh2 * 0.75, hw * 0.14, hh2 * 0.2); ctx.fillRect(hx + hw * 0.22, hy - hh2 * 0.75, hw * 0.14, hh2 * 0.2);
                        copticCross(ctx, hx, hy - hh2 - hw * 0.34, 5, C.gold);
                        if (hs.need) {
                            speech(ctx, hs.need.who, hx, hy - hh2 - hw * 0.4, Math.min(W * 0.2, 170), clamp(H * 0.04, 11, 14), W, 1);
                            ring(ctx, hx + hw * 0.42, hy - hh2 * 0.5, 8, 1 - hs.t / hs.T, hs.t > hs.T * 0.7 ? '#e0443a' : C.goldL, 2.5);
                        }
                    }
                }
                // clouds
                for (i = 0; i < S.clouds.length; i++) {
                    var c = S.clouds[i];
                    if (c.st === 'gone') continue;
                    var r = rad(c), cy = c.y + (c.st === 'float' ? Math.sin(c.bob * 1.4) * 2 : 0), dark = c.st === 'rain' || c.n >= 3;
                    ctx.save();
                    if (c.st === 'rain') ctx.globalAlpha = 1 - clamp((c.t - 0.8) / 0.6, 0, 1);
                    if (c.st === 'drag') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ell(ctx, c.x, g.gy + 4, r * 1.1, r * 0.2); ctx.fill(); }
                    cloud(ctx, c.x, cy, r * 1.25, 1, dark ? '#cfd6e2' : '#fbfbff');
                    ctx.strokeStyle = 'rgba(120,130,150,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ell(ctx, c.x, cy + r * 0.12, r * 1.2, r * 0.34); ctx.stroke();
                    ctx.restore();
                    if (S.ph < 2 && c.st !== 'rain') txt(ctx, ar(c.n), c.x, cy + 1, font(clamp(r * 0.6, 11, 20), 900), '#3a5a7a');
                    if (c.ans && c.st !== 'rain') chip(ctx, c.ans, c.x, cy + r * 0.85, clamp(H * 0.034, 10, 12), 'rgba(31,80,130,0.92)', '#e6f3ff');
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };
})(typeof L1_ARCADE !== 'undefined' ? L1_ARCADE._kit : null);
