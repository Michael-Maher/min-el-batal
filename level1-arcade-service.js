/*
 * level1-arcade-service.js
 * Level 1 (Service / الخدمة) signature canvas arcade games. Adds six games to the
 * existing global L1_ARCADE using the shared kit exposed by level1-arcade.js (L1_ARCADE._kit):
 *   rebekahWell, goodSamaritan, washFeet, widowGift, everywhere, harvest
 * Interface: docs/superpowers/specs/2026-09-29-level1-contracts.md (section B).
 * Spec: docs/superpowers/specs/2026-09-30-level1-service-design.md (arcade table).
 * All Bible / story text (intro, outro, facts, phases, speech lines, labels) comes from the
 * game's data; only generic UI strings live here. Plain global script, ES5, no image files.
 * Must load after level1-arcade.js.
 */
(function (K) {
    'use strict';
    if (!K || typeof L1_ARCADE === 'undefined') return;

    var C = K.C, TAU = K.TAU, clamp = K.clamp, lerp = K.lerp, rand = K.rand, pick = K.pick;
    var eo = K.eo, eio = K.eio, eob = K.eob, shuffle = K.shuffle, seeded = K.seeded, ar = K.ar, plain = K.plain;
    var font = K.font, strList = K.strList, rr = K.rr, circ = K.circ, ell = K.ell, txt = K.txt, emo = K.emo;
    var block = K.block, inRect = K.inRect, vgrad = K.vgrad, layer = K.layer, mkCanvas = K.mkCanvas, blit = K.blit;
    var blitTiled = K.blitTiled, ridge = K.ridge, copticCross = K.copticCross, drawCross = K.drawCross;
    var halo = K.halo, friezeSprite = K.friezeSprite, starPath = K.starPath, heartPath = K.heartPath;
    var figure = K.figure, flame = K.flame, tinyPerson = K.tinyPerson, createCore = K.createCore;

    /* ============================================================ shared helpers */
    // Best possible score for a sequence of combo hits (same combo rule as k.hit).
    function perfectSeq(k, list) {
        var st = k.opt.comboStep || 4, mx = k.opt.maxMult || 4, s = 0;
        for (var i = 0; i < list.length; i++) s += list[i] * Math.min(mx, 1 + Math.floor((i + 1) / st));
        return s;
    }
    function rep(n, v, out) { out = out || []; for (var i = 0; i < n; i++) out.push(v); return out; }
    function mixA(hex, a) {
        var h = String(hex).replace('#', '');
        if (h.length !== 6) return hex;
        return 'rgba(' + parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16) + ',' + clamp(a, 0, 1) + ')';
    }
    // Rounded label pill; returns its width.
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
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, bx + 2, by + 3, bw, bh, 12); ctx.fill();
        ctx.fillStyle = '#fbf1d8'; rr(ctx, bx, by, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(clamp(x, bx + 14, bx + bw - 14) - 7, by + bh - 1); ctx.lineTo(x, y); ctx.lineTo(clamp(x, bx + 14, bx + bw - 14) + 7, by + bh - 1); ctx.closePath();
        ctx.fillStyle = '#fbf1d8'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fbf1d8'; ctx.fillRect(clamp(x, bx + 14, bx + bw - 14) - 6, by + bh - 3, 12, 3);
        var ty = by + size * 0.45 + lh / 2;
        if (who) { txt(ctx, plain(who), bx + bw / 2, by + size * 0.85, font(size * 0.8, 900), C.red); ty += size; }
        for (i = 0; i < lines.length; i++) txt(ctx, lines[i], bx + bw / 2, ty + i * lh, font(size, 800), C.ink);
        ctx.restore();
    }
    function ring(ctx, x, y, r, frac, col, lw) {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = lw || 3.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0.001, 1)); ctx.stroke();
    }
    function palm(ctx, x, y, h, sway) {
        ctx.save(); ctx.translate(x, y);
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2, h * 0.05); ctx.lineCap = 'round';
        var tx = h * 0.12 + sway * h * 0.04, ty = -h;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(h * 0.02, -h * 0.55, tx, ty); ctx.stroke();
        ctx.strokeStyle = 'rgba(40,25,10,0.4)'; ctx.lineWidth = 1;
        for (var s = 0.1; s < 0.95; s += 0.1) { var sx = tx * s * s, sy = ty * s; ctx.beginPath(); ctx.moveTo(sx - h * 0.025, sy); ctx.lineTo(sx + h * 0.025, sy - 2); ctx.stroke(); }
        ctx.strokeStyle = '#3f6a2a'; ctx.lineWidth = Math.max(1.5, h * 0.035);
        for (var i = 0; i < 7; i++) {
            var a = -Math.PI / 2 + (i - 3) * 0.48 + sway * 0.06, L = h * (0.42 + (i % 2) * 0.08);
            var ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + L * 0.35;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.7 - L * 0.1, ex, ey); ctx.stroke();
        }
        ctx.fillStyle = '#7a4a1e'; ctx.beginPath(); circ(ctx, tx - 2, ty + 4, h * 0.03); circ(ctx, tx + 3, ty + 5, h * 0.03); ctx.fill();
        ctx.restore();
    }
    function cloud(ctx, x, y, s, a) {
        ctx.fillStyle = 'rgba(255,248,235,' + a + ')';
        ctx.beginPath(); ell(ctx, x, y, s, s * 0.32); ell(ctx, x - s * 0.4, y + 2, s * 0.5, s * 0.25); ell(ctx, x + s * 0.45, y + 3, s * 0.45, s * 0.22); ell(ctx, x + s * 0.1, y - s * 0.18, s * 0.45, s * 0.28); ctx.fill();
    }
    // Head veil for women figures (drawn over figure(); same transform maths).
    function veil(ctx, f, col) {
        var s = f.h / 100, dir = f.dir < 0 ? -1 : 1;
        ctx.save(); ctx.translate(f.x, f.y); ctx.scale(dir * s, s);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(9, -91); ctx.quadraticCurveTo(0, -101, -9, -92); ctx.quadraticCurveTo(-15, -80, -17, -58);
        ctx.lineTo(-8, -60); ctx.quadraticCurveTo(-5, -78, -3, -86); ctx.quadraticCurveTo(3, -90, 9, -87); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(30,15,5,0.4)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }
    function coin(ctx, x, y, r, col, rim) {
        ctx.fillStyle = col; ctx.beginPath(); circ(ctx, x, y, r); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, r * 0.18); ctx.stroke();
        ctx.beginPath(); circ(ctx, x, y, r * 0.55); ctx.lineWidth = 1; ctx.stroke();
    }
    function segHit(x1, y1, x2, y2, cx, cy, r) {
        var dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
        var t = L2 ? clamp(((cx - x1) * dx + (cy - y1) * dy) / L2, 0, 1) : 0;
        var px = x1 + dx * t - cx, py = y1 + dy * t - cy;
        return px * px + py * py <= r * r;
    }
    function lines2(d) { return d && typeof d === 'object' ? d : {}; }

    /* ======================================================================
     * 1. rebekahWell -- Rebekah at the well (Gen 24)
     * Hold on the well to lower the bucket, release once it is full (before it
     * hits the bottom) to fill Rebekah's jar (3 pours). Tap a camel / guest at
     * the trough to pour. Each guest has a thirst meter; camels drink until done.
     * Phase 1: the thirsty servant + 3 camels. Phase 2: faster, a child with a cup.
     * Phase 3 (twist): the rest of the ten camels and little ones asking for a cup
     * of cold water (short patience). Data: camels, lines, questions, intro, outro,
     * facts, phases.
     * ==================================================================== */
    L1_ARCADE.rebekahWell = function (host, data, api) {
        data = data || {};
        var lines = lines2(data.lines);
        var NC = clamp(Math.round(+data.camels || 10), 7, 12);
        var p3 = [];
        for (var i3 = 0; i3 < NC - 6; i3++) { p3.push('camel'); if (i3 % 2 === 0) p3.push('kid'); }
        var PH = [
            { plan: ['man', 'camel', 'camel', 'camel'], gap: 3.4, T: 30, speed: 0.42, surf: [0.44, 0.56], fillR: 1.8 },
            { plan: ['camel', 'kid', 'camel', 'camel'], gap: 2.8, T: 25, speed: 0.55, surf: [0.52, 0.66], fillR: 2.0 },
            { plan: p3, gap: 2.2, T: 21, speed: 0.66, surf: [0.6, 0.76], fillR: 2.2 }
        ];
        var NEED = { camel: 3, man: 1, kid: 1 }, PATF = { camel: 1, man: 0.9, kid: 0.36 };
        var ROBES = ['#b5543a', '#3b5f86', '#7c8a3a', '#6b4a7a', '#2e7d6b'];
        var BLANK = [['#8e1f1f', '#e2b34d'], ['#1f6fa3', '#f3ead6'], ['#6f8a3a', '#e2b34d'], ['#5d3fa6', '#f08a7a']];
        var ALL = PH[0].plan.concat(PH[1].plan, PH[2].plan);
        var totPours = 0;
        ALL.forEach(function (kd) { totPours += NEED[kd]; });
        var S = { ph: -1, clock: 0, active: false, plan: [], planT: 0, tg: [], jar: 0, jarBump: 0,
            b: { st: 'top', d: 0, fill: 0, fullAt: -1, surf: 0.5 }, pour: null, say: [], pulley: 0, id: 0, dusk: 0, saidCamels: false };

        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.86);
            var wr = clamp(H * 0.11, 26, 56), sw = clamp(W * 0.045, 22, 38);
            var shX = W - sw - 10, wx = shX - 16 - wr * 1.2;
            var rx = wx - wr * 1.25 - clamp(W * 0.05, 22, 50);
            var ns = W >= H * 1.3 ? 4 : 3, t0 = W * 0.03, t1 = rx - clamp(W * 0.05, 20, 44);
            var slots = [];
            for (var i = 0; i < ns; i++) slots.push(t1 - (i + 0.5) * (t1 - t0) / ns); // slot 0 nearest Rebekah
            return { W: W, H: H, gy: gy, wr: wr, wx: wx, wy: gy - wr * 0.35, shX: shX, shW: sw, shTop: H * 0.2, shBot: gy - 8,
                rx: rx, rh: clamp(H * 0.34, 80, 150), t0: t0, t1: t1, ns: ns, slots: slots, sw2: (t1 - t0) / ns,
                u: clamp(H / 330, 0.5, 1.5), ty: gy - clamp(H * 0.045, 12, 22) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, g.gy, ['#3b3f7a', '#b9678a', '#f2a66a', '#f8d59a']); x.fillRect(0, 0, W, g.gy);
                var sx = W * 0.3, sy = g.gy - H * 0.2;
                var gr = x.createRadialGradient(sx, sy, 2, sx, sy, H * 0.35);
                gr.addColorStop(0, 'rgba(255,236,170,0.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
                x.fillStyle = gr; x.fillRect(0, 0, W, g.gy);
                x.fillStyle = '#ffe9a8'; x.beginPath(); circ(x, sx, sy, H * 0.05); x.fill();
                x.fillStyle = 'rgba(150,95,85,0.6)'; ridge(x, W, g.gy - H * 0.18, H * 0.07, 5, 3, g.gy); x.fill();
                var r = seeded(21);
                for (var i = 0; i < 10; i++) {
                    var bx = W * 0.04 + i * W * 0.042, bh = H * (0.05 + r() * 0.07), bw = W * 0.04;
                    x.fillStyle = i % 2 ? '#9c6b4a' : '#a8775a'; x.fillRect(bx, g.gy - H * 0.12 - bh, bw, bh + H * 0.02);
                    x.fillStyle = r() > 0.5 ? '#ffd27a' : '#4a2c1a'; x.fillRect(bx + bw * 0.35, g.gy - H * 0.12 - bh * 0.6, bw * 0.22, bh * 0.25);
                }
                x.fillStyle = '#d9a86a'; ridge(x, W, g.gy - H * 0.08, H * 0.05, 9, 3, g.gy); x.fill();
                x.fillStyle = vgrad(x, g.gy - H * 0.06, H, ['#e6bf82', '#d3a066', '#b9844c']); x.fillRect(0, g.gy - H * 0.05, W, H);
                x.fillStyle = 'rgba(110,70,30,0.25)';
                for (var p = 0; p < 50; p++) { x.beginPath(); ell(x, r() * W, g.gy - H * 0.03 + r() * H * 0.16, 1 + r() * 3, 0.8 + r() * 1.5); x.fill(); }
                palm(x, W * 0.47, g.gy - H * 0.07, H * 0.36, 0);
                palm(x, W * 0.14, g.gy - H * 0.1, H * 0.26, 0.5);
            });
        }
        function freeSlot() {
            for (var s = 0; s < S.g.ns; s++) {
                var used = false;
                for (var i = 0; i < S.tg.length; i++) if (S.tg[i].slot === s && (S.tg[i].st === 'walk' || S.tg[i].st === 'wait')) used = true;
                if (!used) return s;
            }
            return -1;
        }
        function spawn(k, kind, slot) {
            var P = PH[S.ph];
            S.tg.push({ id: S.id++, kind: kind, slot: slot, x: -70, tx: S.g.slots[slot], st: 'walk', got: 0, need: NEED[kind],
                pat: 1, T: P.T * PATF[kind], drink: 0, t: 0, walk: 0, bl: BLANK[S.id % BLANK.length], robe: ROBES[S.id % ROBES.length], hop: 0 });
            if (kind === 'camel') k.sfx('thud');
        }
        function say(s, x, y, dur) { if (plain(s)) S.say.push({ s: s, x: x, y: y, t: 0, dur: dur || 3.4 }); }
        function startPhase(k, n) {
            S.ph = n; S.clock = 0; S.active = false; S.plan = PH[n].plan.slice(); S.planT = 0.6;
            S.b.surf = rand(PH[n].surf[0], PH[n].surf[1]);
            k.phaseCard(n + 1);
            k.after(1.3, function () { k.fact(5.5); });
            k.after(2.6, function () { S.active = true; });
        }
        function checkEnd(k) {
            if (!S.active || S.plan.length || S.tg.length) return;
            S.active = false;
            if (S.ph >= 2) { k.finish({ title: 'كله شرب! برافو يا كريم 🐪', finaleT: 2.4 }); return; }
            var nx = S.ph + 1;
            k.after(0.8, function () { k.checkpoint(function () { startPhase(k, nx); }); });
        }
        function targetAt(px) {
            var best = null, bd = 1e9;
            for (var i = 0; i < S.tg.length; i++) {
                var t = S.tg[i];
                if (t.st !== 'wait') continue;
                var d = Math.abs(S.g.slots[t.slot] - px);
                if (d < bd) { bd = d; best = t; }
            }
            return bd <= S.g.sw2 * 0.8 ? best : null;
        }
        function pourTo(k, t) {
            var g = S.g, x = g.slots[t.slot];
            if (S.jar <= 0) {
                S.jarBump = 1; k.sfx('tap'); k.breakCombo();
                k.pop(g.rx, g.gy - g.rh - 26, 'الجرة فاضية… اسحب مية', '#bfe8ff', 15);
                return;
            }
            S.jar--; t.got++; t.drink = 1; t.pat = Math.min(1, t.pat + 0.4);
            S.pour = { t: 0, x1: x + (t.kind === 'camel' ? 18 * g.u : 0), y1: g.ty };
            k.sfx('splash');
            k.emit(x, g.ty, 8, { colors: ['#bfe8ff', '#5fb3d9', '#ffffff'], grav: 300, vmin: 40, vmax: 120 });
            k.hit(3, x, g.ty - 30, { silent: true });
            if (t.got >= t.need) {
                t.st = 'done'; t.t = 0; t.hop = 1;
                k.hit(t.kind === 'camel' ? 10 : 8, x, g.gy - g.rh * (t.kind === 'kid' ? 0.7 : 1.15), { text: t.kind === 'camel' ? '🐪 ' : '💧 ' });
                k.emit(x, g.gy - g.rh * 0.8, 16, { colors: ['#ff8fa3', C.goldL, '#fff'], up: 80 });
                k.glyphBurst(x, g.gy - g.rh * 0.9, 3);
                if (t.kind === 'man' && lines.rebekah) say(lines.rebekah, g.rx, g.gy - g.rh - 8, 3.6);
            }
        }
        function bucketDown(k) {
            var b = S.b;
            if (b.st !== 'top') return;
            if (S.jar >= 3) { S.jarBump = 1; k.pop(S.g.rx, S.g.gy - S.g.rh - 26, 'الجرة مليانة… اسقي!', '#bfe8ff', 15); k.sfx('tap'); return; }
            b.st = 'down'; b.fill = 0; b.fullAt = -1; k.sfx('whoosh');
        }
        function bucketUp(k) {
            var b = S.b, g = S.g;
            if (b.st !== 'down') return;
            b.st = 'up';
            if (b.fill >= 1) {
                var perfect = k.t - b.fullAt < 0.5;
                k.hit(perfect ? 6 : 4, g.shX + g.shW / 2 - 30, g.shTop - 10, { text: perfect ? 'مظبوط! ' : '' });
            } else if (b.fill < 0.3) { k.pop(g.shX - 20, g.shTop - 10, 'لسه ما وصلتش للمية', '#fff', 14); }
        }
        function camel(ctx, x, y, u, dir, t, walk, drink, bl) {
            ctx.save(); ctx.translate(x, y); ctx.scale(dir * u, u);
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ell(ctx, 0, 0, 44, 5); ctx.fill();
            var sw = walk >= 0 ? Math.sin(walk) : 0, bob = walk >= 0 ? -Math.abs(Math.cos(walk)) * 1.6 : Math.sin(t * 1.6) * 0.5;
            var col = '#c8935a', dk = '#9e6d3c';
            ctx.lineCap = 'round'; ctx.lineWidth = 6;
            function leg(hx, s, c) {
                ctx.strokeStyle = c;
                ctx.beginPath(); ctx.moveTo(hx, -46 + bob); ctx.lineTo(hx + s * 6, -24); ctx.lineTo(hx + s * 9, -2); ctx.stroke();
            }
            leg(-20, -sw, dk); leg(24, sw, dk);
            ctx.translate(0, bob);
            ctx.fillStyle = '#b07a44';
            ctx.beginPath(); ctx.moveTo(-34, -60); ctx.quadraticCurveTo(-44, -52, -40, -42); ctx.lineWidth = 3; ctx.strokeStyle = dk; ctx.stroke();
            ctx.fillStyle = col; ctx.beginPath(); ell(ctx, 0, -58, 35, 16); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-24, -64); ctx.bezierCurveTo(-18, -98, 12, -98, 20, -66); ctx.closePath(); ctx.fill();
            // saddle blanket
            ctx.save(); ctx.beginPath(); ctx.moveTo(-20, -66); ctx.bezierCurveTo(-15, -90, 10, -90, 16, -66); ctx.lineTo(18, -52); ctx.lineTo(-22, -52); ctx.closePath(); ctx.clip();
            for (var i = 0; i < 6; i++) { ctx.fillStyle = bl[i % 2]; ctx.fillRect(-24, -92 + i * 7, 46, 7); }
            ctx.restore();
            ctx.fillStyle = C.gold; for (var j = 0; j < 5; j++) { ctx.beginPath(); circ(ctx, -20 + j * 9, -51, 1.8); ctx.fill(); }
            ctx.translate(0, -bob);
            leg(-24, sw, col); leg(20, -sw, col);
            ctx.translate(0, bob);
            // neck + head (drinking lowers it into the trough)
            var hx = lerp(50, 56, drink), hy = lerp(-92, -30, drink) + (drink > 0.5 ? Math.sin(t * 9) * 1.5 : 0);
            ctx.strokeStyle = col; ctx.lineWidth = 11;
            ctx.beginPath(); ctx.moveTo(26, -64); ctx.quadraticCurveTo(46, lerp(-62, -58, drink), hx - 4, hy + 4); ctx.stroke();
            ctx.save(); ctx.translate(hx, hy); ctx.rotate(lerp(0.2, 1.1, drink));
            ctx.fillStyle = col; ctx.beginPath(); ell(ctx, 4, 0, 12, 7); ctx.fill();
            ctx.fillStyle = dk; ctx.beginPath(); ell(ctx, -4, -7, 2.5, 4); ctx.fill();
            ctx.fillStyle = '#1b0f07'; ctx.beginPath(); circ(ctx, 3, -2, 1.5); ctx.fill();
            ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(13, 2); ctx.lineTo(9, 4); ctx.stroke();
            ctx.restore();
            ctx.restore();
        }
        function drawWell(k, ctx, g) {
            var x = g.wx, y = g.wy, r = g.wr, b = S.b;
            ctx.fillStyle = '#6b4220';
            ctx.fillRect(x - r * 1.08, y - r * 2.5, r * 0.15, r * 2.5); ctx.fillRect(x + r * 0.93, y - r * 2.5, r * 0.15, r * 2.5);
            ctx.fillRect(x - r * 1.2, y - r * 2.6, r * 2.4, r * 0.17);
            var py = y - r * 2.34;
            ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); circ(ctx, x, py, r * 0.22); ctx.fill();
            ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 1.5; ctx.stroke();
            for (var s = 0; s < 3; s++) { var a = S.pulley + s * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.2, py + Math.sin(a) * r * 0.2); ctx.lineTo(x - Math.cos(a) * r * 0.2, py - Math.sin(a) * r * 0.2); ctx.stroke(); }
            // back rim + dark opening
            ctx.fillStyle = '#7d6a55'; ctx.beginPath(); ell(ctx, x, y - r * 0.3, r, r * 0.3); ctx.fill();
            ctx.fillStyle = '#1a120b'; ctx.beginPath(); ell(ctx, x, y - r * 0.3, r * 0.82, r * 0.22); ctx.fill();
            // rope + bucket
            var by = b.st === 'top' ? y - r * 1.25 : (b.d < 0.12 ? lerp(y - r * 1.25, y - r * 0.3, b.d / 0.12) : y - r * 0.2);
            ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + r * 0.2, py); ctx.lineTo(x + r * 0.2, by); ctx.stroke();
            if (by < y - r * 0.45) {
                ctx.fillStyle = '#7a4a1e'; rr(ctx, x + r * 0.2 - r * 0.2, by, r * 0.4, r * 0.34, 3); ctx.fill();
                ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 1.2; ctx.stroke();
                if (b.st === 'up' && b.fill > 0.3) { ctx.fillStyle = '#5fb3d9'; ctx.fillRect(x + r * 0.03, by + 2, r * 0.34, 3); }
            }
            // front body with stone courses
            ctx.fillStyle = vgrad(ctx, y - r * 0.3, y + r * 0.7, ['#b8a58a', '#8c7a63']);
            ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.3); ctx.lineTo(x - r, y + r * 0.55); ctx.ellipse(x, y + r * 0.55, r, r * 0.28, 0, Math.PI, 0, true); ctx.lineTo(x + r, y - r * 0.3); ctx.ellipse(x, y - r * 0.3, r, r * 0.3, 0, 0, Math.PI, false); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 1;
            for (var ly = 0; ly < 3; ly++) {
                var yy = y - r * 0.05 + ly * r * 0.24;
                ctx.beginPath(); ctx.ellipse(x, yy, r, r * 0.28, 0, 0, Math.PI); ctx.stroke();
                for (var bx = -2; bx <= 2; bx++) { var xx = x + (bx + (ly % 2) * 0.5) * r * 0.4; ctx.beginPath(); ctx.moveTo(xx, yy + r * 0.2); ctx.lineTo(xx, yy + r * 0.42); ctx.stroke(); }
            }
            drawCross(ctx, x, y + r * 0.25, clamp(r * 0.22, 7, 12), C.goldD, k.dpr);
        }
        function drawShaft(k, ctx, g) {
            var b = S.b, x = g.shX, w = g.shW, t0 = g.shTop, t1 = g.shBot, H = t1 - t0;
            ctx.fillStyle = 'rgba(20,10,4,0.55)'; rr(ctx, x - 3, t0 - 3, w + 6, H + 6, w / 2 + 3); ctx.fill();
            ctx.save(); rr(ctx, x, t0, w, H, w / 2); ctx.clip();
            ctx.fillStyle = vgrad(ctx, t0, t1, ['#5e4a38', '#2e2218']); ctx.fillRect(x, t0, w, H);
            var ws = t0 + H * b.surf;
            ctx.fillStyle = vgrad(ctx, ws, t1, ['#5fb3d9', '#1f6fa3', '#0f3d63']); ctx.fillRect(x, ws, w, t1 - ws);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath();
            for (var wx = 0; wx <= w; wx += 3) ctx.lineTo(x + wx, ws + Math.sin(wx * 0.5 + k.rt * 5) * 1.4);
            ctx.stroke();
            ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x, t1 - H * 0.06, w, H * 0.06);
            ctx.fillStyle = '#6b5a48'; for (var p = 0; p < 4; p++) { ctx.beginPath(); circ(ctx, x + w * (0.2 + p * 0.2), t1 - H * 0.04, 2.4); ctx.fill(); }
            if (b.st !== 'top') {
                var by = t0 + H * clamp(b.d, 0, 1), bw = w * 0.62;
                ctx.fillStyle = b.d > 0.88 ? '#e0443a' : '#c9884a'; rr(ctx, x + (w - bw) / 2, by - bw * 0.35, bw, bw * 0.7, 3); ctx.fill();
                ctx.fillStyle = '#5fb3d9'; ctx.fillRect(x + (w - bw) / 2 + 1, by + bw * 0.35 - bw * 0.7 * clamp(b.fill, 0, 1), bw - 2, bw * 0.7 * clamp(b.fill, 0, 1));
                ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + w / 2, t0); ctx.lineTo(x + w / 2, by - bw * 0.35); ctx.stroke();
            }
            ctx.restore();
            var full = b.st === 'down' && b.fill >= 1;
            ctx.strokeStyle = full ? 'rgba(157,255,176,' + (0.6 + 0.4 * Math.sin(k.rt * 16)) + ')' : 'rgba(226,179,77,0.8)';
            ctx.lineWidth = full ? 3 : 1.5; rr(ctx, x, t0, w, H, w / 2); ctx.stroke();
            if (full) txt(ctx, 'سيب! ⬆', x + w / 2 - 6, t0 - 14, font(15, 900), '#9dffb0', 'center', 4);
            else if (b.st === 'top' && S.ph >= 0 && S.ph < 1 && k.t < 12) txt(ctx, 'دوس مطوّل', x + w / 2 - 14, t0 - 14, font(12, 900), '#fff', 'center', 3);
        }

        var k = createCore(host, data, api, {
            title: 'بير رفقة', icon: '🐪',
            howto: { kind: 'hold', text: 'دوس مطوّل على البير عشان الدلو ينزل، وسيبه لما يتملي قبل ما يخبط في القاع. بعدين اضغط على الجمل عشان تسقيه.' },
            comboStep: 5, maxMult: 3, pad: [146.8, 220], lives: 3, factY: 0.2,
            rawMax: function (k) {
                var list = rep(Math.ceil(totPours / 3), 6);
                rep(totPours, 3, list);
                ALL.forEach(function (kd) { list.push(kd === 'camel' ? 10 : 8); });
                return perfectSeq(k, list) + 2 * k.askBonus;
            },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) {
                S.jar = 3; S.jarBump = 1;
                for (var i = 0; i < S.tg.length; i++) S.tg[i].pat = Math.min(1, S.tg[i].pat + 0.5);
                return '✨ الجرة اتملت والكل استنى بصبر';
            },
            update: function (k, dt) {
                var g = S.g, b = S.b, P = PH[Math.max(0, Math.floor(S.ph))];
                S.clock += dt;
                S.dusk += (clamp(S.ph, 0, 2) * 0.14 - S.dusk) * Math.min(1, dt);
                S.jarBump = Math.max(0, S.jarBump - dt * 3);
                // bucket
                if (b.st === 'down') {
                    b.d += dt * P.speed; S.pulley += dt * 8;
                    if (b.d > b.surf) {
                        b.fill = Math.min(1, b.fill + dt * P.fillR);
                        if (b.fill >= 1 && b.fullAt < 0) { b.fullAt = k.t; k.sfx('coin'); }
                    }
                    if (b.d >= 1) {
                        b.d = 1; b.st = 'up'; b.fill *= 0.4;
                        k.shake(4, 0.25); k.sfx('thud'); k.breakCombo();
                        k.pop(g.shX - 20, g.shTop - 10, 'الدلو خبط في القاع!', '#ffd0c0', 15);
                    }
                } else if (b.st === 'up') {
                    b.d -= dt * 1.5; S.pulley -= dt * 10;
                    if (b.d <= 0) {
                        b.d = 0; b.st = 'top';
                        var units = b.fill >= 0.99 ? 3 : b.fill >= 0.6 ? 2 : b.fill >= 0.3 ? 1 : 0;
                        if (units) { S.jar = Math.min(3, S.jar + units); S.jarBump = 1; k.sfx('splash'); k.emit(g.wx, g.wy - g.wr, 10, { colors: ['#bfe8ff', '#5fb3d9', '#fff'], grav: 260 }); }
                        b.fill = 0; b.surf = rand(P.surf[0], P.surf[1]);
                    }
                }
                if (S.pour) { S.pour.t += dt; if (S.pour.t > 0.5) S.pour = null; }
                // arrivals
                if (S.active && S.plan.length) {
                    S.planT -= dt;
                    var fs = freeSlot();
                    if (S.planT <= 0 && fs >= 0) {
                        var kind = S.plan.shift();
                        spawn(k, kind, fs); S.planT = P.gap;
                        if (kind === 'camel' && !S.saidCamels && lines.camels && S.ph >= 0) { S.saidCamels = true; k.after(2.2, function () { say(lines.camels, S.g.rx, S.g.gy - S.g.rh - 8, 3.6); }); }
                    }
                }
                // guests
                var sp = g.W * 0.2;
                for (var i = S.tg.length - 1; i >= 0; i--) {
                    var t = S.tg[i];
                    t.t += dt; t.hop = Math.max(0, t.hop - dt * 1.5);
                    t.drink = Math.max(0, t.drink - dt * 0.7);
                    if (t.st === 'walk') {
                        t.walk += dt * 7;
                        if (t.x + sp * dt >= t.tx) {
                            t.x = t.tx; t.st = 'wait'; t.t = 0;
                            if (t.kind === 'man' && lines.servant) say(lines.servant, t.x + 10, g.gy - g.rh * 1.05, 3.6);
                        } else t.x += sp * dt;
                    } else if (t.st === 'wait') {
                        t.pat -= dt / t.T;
                        if (t.pat <= 0) {
                            t.st = 'sad'; t.t = 0;
                            if (t.kind === 'kid') { k.breakCombo(); k.pop(t.x, g.gy - g.rh * 0.7, 'مشي عطشان…', '#ffd0c0', 14); }
                            else if (k.loseLife(t.x, g.gy - g.rh * 1.1, 'مشي عطشان…') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… جرّب تاني وخلي بالك من العطشانين', finaleT: 1.2 }); return; }
                        }
                    } else if (t.t > 1.1) {
                        t.walk += dt * 7; t.x -= sp * dt;
                        if (t.x < -90) S.tg.splice(i, 1);
                    }
                }
                for (var s2 = S.say.length - 1; s2 >= 0; s2--) { S.say[s2].t += dt; if (S.say[s2].t > S.say[s2].dur) S.say.splice(s2, 1); }
                checkEnd(k);
            },
            finale: function (k, dt) {
                if (!k.info.win) return;
                if (Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.4, 3, { colors: ['#ff8fa3', C.goldL], grav: 60, up: 40 });
            },
            down: function (k, p) {
                var g = S.g;
                if (p.x >= g.wx - g.wr * 1.5) { bucketDown(k); return; }
                var t = targetAt(p.x);
                if (t) pourTo(k, t); else k.sfx('tap');
            },
            up: function (k) { bucketUp(k); },
            key: function (k, key, isDown) {
                if (key === ' ') { if (isDown) bucketDown(k); else bucketUp(k); return true; }
                if (!isDown) return false;
                var n = '1234'.indexOf(key);
                if (n >= 0) {
                    for (var i = 0; i < S.tg.length; i++) if (S.tg[i].slot === n && S.tg[i].st === 'wait') { pourTo(k, S.tg[i]); return true; }
                    return true;
                }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt;
                blit(ctx, S.bg, 0, 0);
                for (var c = 0; c < 3; c++) cloud(ctx, ((c * 0.37 + t * 0.006) % 1.2 - 0.1) * W, H * (0.12 + c * 0.07), W * 0.06, 0.35);
                if (S.dusk > 0.01) { ctx.fillStyle = 'rgba(40,20,70,' + S.dusk + ')'; ctx.fillRect(0, 0, W, g.gy); }
                if (S.dusk > 0.2) {
                    ctx.fillStyle = 'rgba(255,245,210,' + (S.dusk - 0.2) * 3 + ')';
                    for (var st = 0; st < 14; st++) { var sx = (st * 97) % W, sy = (st * 53) % (g.gy * 0.4); ctx.beginPath(); circ(ctx, sx, sy + 6, 1 + (st % 3) * 0.4); ctx.fill(); }
                }
                // guests behind the trough
                for (var i = 0; i < S.tg.length; i++) {
                    var tg = S.tg[i], leaving = (tg.st === 'done' || tg.st === 'sad') && tg.t > 1.1, wk = tg.st === 'walk' || leaving ? tg.walk : -1;
                    var dir = leaving ? -1 : 1, hop = eo(tg.hop) * 8;
                    if (tg.kind === 'camel') camel(ctx, tg.x - (leaving ? -22 : 22) * g.u, g.gy - 6 - hop, g.u, dir, t + tg.id, wk, tg.drink, tg.bl);
                    else if (tg.kind === 'man') figure(ctx, { x: tg.x, y: g.gy - 4 - hop, h: g.rh * 0.95, dir: dir, robe: '#d9c7a1', mantle: '#7c3a28', hair: '#d9d4cc', beard: 1, beardColor: '#eeeae2', prop: 'staff', walk: wk, arm: tg.drink > 0.3 ? 2.5 : null, t: t, dpr: k.dpr });
                    else {
                        tinyPerson(ctx, tg.x, g.gy - 4 - hop, g.rh * 0.5, tg.robe, '#3a2414', wk >= 0 ? wk : -1, dir);
                        ctx.fillStyle = '#bfe8ff'; rr(ctx, tg.x + 5, g.gy - g.rh * 0.36 - hop, 7, 9, 2); ctx.fill();
                        ctx.strokeStyle = '#1f6fa3'; ctx.lineWidth = 1; ctx.stroke();
                    }
                    if (tg.st === 'wait') {
                        var mx = g.slots[tg.slot], my = g.gy - (tg.kind === 'camel' ? g.rh * 1.2 : tg.kind === 'man' ? g.rh * 1.12 : g.rh * 0.72);
                        var pc = tg.pat > 0.5 ? '#6fd08c' : tg.pat > 0.25 ? '#f1c40f' : '#e0443a';
                        ctx.fillStyle = 'rgba(20,10,4,0.6)'; rr(ctx, mx - 26, my - 5, 52, 10, 5); ctx.fill();
                        ctx.fillStyle = pc; rr(ctx, mx - 24, my - 3, 48 * clamp(tg.pat, 0, 1), 6, 3); ctx.fill();
                        for (var d = 0; d < tg.need; d++) {
                            ctx.fillStyle = d < tg.got ? '#5fb3d9' : 'rgba(255,255,255,0.35)';
                            var dx = mx + (d - (tg.need - 1) / 2) * 12, dy = my - 13;
                            ctx.beginPath(); ctx.moveTo(dx, dy - 6); ctx.quadraticCurveTo(dx + 5, dy, dx, dy + 3); ctx.quadraticCurveTo(dx - 5, dy, dx, dy - 6); ctx.fill();
                        }
                        if (tg.pat < 0.25) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 12); txt(ctx, '!', mx + 34, my, font(16, 900), '#ff6b5a', 'center', 3); ctx.globalAlpha = 1; }
                    }
                }
                // stone trough
                ctx.fillStyle = vgrad(ctx, g.ty - 4, g.gy + 8, ['#a89478', '#7d6a55']);
                rr(ctx, g.t0, g.ty - 2, g.t1 - g.t0, g.gy + 8 - g.ty, 5); ctx.fill();
                ctx.fillStyle = '#5fb3d9'; ctx.fillRect(g.t0 + 5, g.ty, g.t1 - g.t0 - 10, 4);
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(g.t0 + 5, g.ty, g.t1 - g.t0 - 10, 1);
                var fr = friezeSprite(8, k.dpr, C.goldD, 'rgba(0,0,0,0)');
                ctx.save(); ctx.beginPath(); ctx.rect(g.t0 + 6, g.ty + 8, g.t1 - g.t0 - 12, 8); ctx.clip(); blitTiled(ctx, fr, 0, g.ty + 8, g.t1); ctx.restore();
                drawWell(k, ctx, g);
                // Rebekah
                var pouring = !!S.pour;
                var rf = { x: g.rx, y: g.gy - 2, h: g.rh, dir: -1, robe: '#3b5f86', mantle: '#b83a2a', hair: '#2b1a0e', belt: C.gold, prop: pouring ? null : 'jar', arm: pouring ? 2.2 : 0.35, t: t, dpr: k.dpr };
                var hand = figure(ctx, rf);
                veil(ctx, rf, '#e9dcc0');
                if (pouring) {
                    var pt = clamp(S.pour.t / 0.5, 0, 1);
                    ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(-1.2);
                    ctx.fillStyle = '#b8683a'; ctx.beginPath(); ell(ctx, 0, 0, 8 * g.u + 3, 10 * g.u + 3); ctx.fill(); ctx.restore();
                    ctx.strokeStyle = 'rgba(95,179,217,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(hand.x - 6, hand.y);
                    ctx.quadraticCurveTo(lerp(hand.x, S.pour.x1, 0.5), hand.y - 30, lerp(hand.x, S.pour.x1, eo(pt * 1.6)), lerp(hand.y, S.pour.y1, eo(pt * 1.6)));
                    ctx.stroke();
                }
                // jar meter
                var jy = g.gy - g.rh - 16 - eo(S.jarBump) * 4;
                ctx.fillStyle = 'rgba(20,10,4,0.55)'; rr(ctx, g.rx - 30, jy - 11, 60, 22, 11); ctx.fill();
                for (var j = 0; j < 3; j++) {
                    var jx = g.rx - 16 + j * 16;
                    ctx.fillStyle = j < S.jar ? '#5fb3d9' : 'rgba(255,255,255,0.25)';
                    ctx.beginPath(); ctx.moveTo(jx, jy - 7); ctx.quadraticCurveTo(jx + 6, jy + 1, jx, jy + 5); ctx.quadraticCurveTo(jx - 6, jy + 1, jx, jy - 7); ctx.fill();
                }
                drawShaft(k, ctx, g);
                palm(ctx, W * 0.985, g.gy + 4, H * 0.5, Math.sin(t * 0.8));
                for (var s = 0; s < S.say.length; s++) {
                    var sb = S.say[s], sa = sb.t < 0.3 ? sb.t / 0.3 : clamp((sb.dur - sb.t) / 0.4, 0, 1);
                    speech(ctx, sb.s, sb.x, sb.y, Math.min(W * 0.4, 280), clamp(H * 0.045, 12, 16), W, sa);
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 2. goodSamaritan -- the good Samaritan on the Jericho road (Luke 10)
     * The Samaritan and his donkey walk on their own; hold anywhere to brake and
     * stop inside the glowing spot next to the wounded man. Then care for him:
     * hold on each wound (oil and wine), then circle around it (bandage).
     * Phase 1: the priest and the Levite pass by first. Phase 2: faster, and the
     * wounded are people you would not choose (love without favoritism).
     * Phase 3 (twist): dusk, a heavier donkey (longer braking), and the inn at the
     * end: stop at its door to hand them over. Data: passersBy, passNote, wounded,
     * careSteps, inn, questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.goodSamaritan = function (host, data, api) {
        data = data || {};
        var passers = strList(data.passersBy).slice(0, 2), wlabels = strList(data.wounded);
        var steps = strList(data.careSteps);
        if (steps.length < 2) steps = ['نضّف الجرح', 'اربط الجرح'];
        var inn = lines2(data.inn);
        var PH = [
            { n: 2, wounds: 1, vmax: 0.16, brake: 1.5, zone: 0.07 },
            { n: 3, wounds: 1, vmax: 0.2, brake: 1.3, zone: 0.055 },
            { n: 2, wounds: 2, vmax: 0.22, brake: 1.0, zone: 0.05 }
        ];
        var TOTAL_N = 7, TOTAL_W = 2 + 3 + 4;
        var S = { ph: -1, dist: 0, v: 0, hold: false, items: [], mode: 'road', care: null, followers: 0, walk: 0, dusk: 0, active: false, hint: 0, pass: [] };

        function G(k) {
            var W = k.W, H = k.H;
            return { W: W, H: H, sx: W * 0.64, roadT: H * 0.64, roadB: H * 0.9, u: clamp(H / 330, 0.5, 1.5), ph: clamp(H * 0.3, 70, 140) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.far = layer(W, H * 0.7, k.dpr, function (x) {
                x.fillStyle = 'rgba(200,140,110,0.75)'; ridge(x, W, H * 0.45, H * 0.12, 3, 3, H * 0.7); x.fill();
                x.fillStyle = 'rgba(170,110,80,0.85)'; ridge(x, W, H * 0.55, H * 0.1, 7, 3, H * 0.7); x.fill();
            });
            S.mid = layer(W, H, k.dpr, function (x) {
                x.fillStyle = '#c99a62'; ridge(x, W, g.roadT - 4, H * 0.06, 13, 4, H); x.fill();
                var r = seeded(5);
                for (var i = 0; i < 9; i++) {
                    var rx = r() * W, ry = g.roadT - 6 - r() * H * 0.05, rs = 6 + r() * 14;
                    x.fillStyle = r() > 0.5 ? '#9c7446' : '#b08a55'; x.beginPath(); ell(x, rx, ry, rs, rs * 0.6); x.fill();
                    if (i % 3 === 0) { x.strokeStyle = '#6f8a3a'; x.lineWidth = 2; for (var b = 0; b < 5; b++) { x.beginPath(); x.moveTo(rx + rs, ry); x.lineTo(rx + rs + (b - 2) * 3, ry - 8 - (b % 2) * 4); x.stroke(); } }
                }
            });
            S.road = layer(W, H - g.roadT + 2, k.dpr, function (x, w, h) {
                x.fillStyle = vgrad(x, 0, h, ['#d8b27a', '#c9a36a', '#b08a55']); x.fillRect(0, 0, w, h);
                var r = seeded(9);
                x.fillStyle = 'rgba(90,60,30,0.3)';
                for (var i = 0; i < 70; i++) { x.beginPath(); ell(x, r() * w, r() * h, 1 + r() * 3, 0.7 + r() * 1.4); x.fill(); }
                x.strokeStyle = 'rgba(120,85,45,0.35)'; x.lineWidth = 2;
                x.beginPath(); x.moveTo(0, h * 0.5); for (var xx = 0; xx <= w; xx += 12) x.lineTo(xx, h * 0.5 + Math.sin(xx / w * TAU * 3) * 3); x.stroke();
            });
        }
        function sxOf(it) { return S.g.sx - (it.wx - S.dist); }
        function startPhase(k, n) {
            var P = PH[n], g = S.g;
            S.ph = n; S.active = false;
            k.phaseCard(n + 1);
            k.after(1.3, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; });
            var wx = S.dist + g.W * 1.05;
            for (var i = 0; i < P.n; i++) {
                var wn = [];
                for (var w = 0; w < P.wounds; w++) wn.push({ f: P.wounds === 1 ? 0.55 : [0.34, 0.72][w], oil: 0, wrap: 0, done: false });
                S.items.push({ kind: 'hurt', wx: wx, st: 'lie', wounds: wn, label: n === 1 && wlabels.length ? wlabels[i % wlabels.length] : '', robe: ['#b5543a', '#7c8a3a', '#6b4a7a', '#8a5a2b'][i % 4], up: 0 });
                if (n === 0 && i === 0) {
                    for (var p = 0; p < passers.length; p++) S.pass.push({ label: passers[p], wx: wx - g.W * (0.25 + p * 0.45), x: -40 - p * 200, done: false });
                }
                wx += g.W * rand(1.05, 1.3);
            }
            if (n === 2) S.items.push({ kind: 'inn', wx: wx + g.W * 0.1, st: 'wait' });
        }
        function pending() {
            for (var i = 0; i < S.items.length; i++) if (S.items[i].st === 'lie' || S.items[i].st === 'wait') return true;
            return false;
        }
        function phaseEnd(k) {
            S.active = false;
            if (S.ph >= 2) { k.finish({ title: S.innOk ? 'وصلتهم للفندق بالسلامة! 🏨' : 'اتعلمت تحب من غير تمييز ❤️', finaleT: 2.2 }); return; }
            var nx = S.ph + 1;
            S.ph += 0.5;
            k.after(0.6, function () { k.checkpoint(function () { startPhase(k, nx); }); });
        }
        function openCare(k, it, dx) {
            var P = PH[Math.floor(S.ph)], zone = S.g.W * P.zone;
            S.mode = 'care'; S.v = 0; S.hold = false; k.pdown = false;
            it.st = 'care';
            S.care = { it: it, wi: 0, t: 0, ang: null, acc: 0, open: 0, close: 0, touch: false, px: 0, py: 0 };
            var good = Math.abs(dx) < zone * 0.35;
            k.hit(good ? 12 : 7, S.g.sx, S.g.roadT - S.g.ph * 0.9, { text: good ? 'وقفة مظبوطة! ' : '' });
            k.sfx('thud');
        }
        function careBox(k) {
            var W = k.W, H = k.H, w = Math.min(W * 0.8, 620), h = Math.min(H * 0.66, 300);
            return { x: (W - w) / 2, y: H * 0.07, w: w, h: h };
        }
        function woundPos(k, it, wi) {
            var b = careBox(k), L = b.w * 0.62, x0 = b.x + (b.w - L) / 2;
            return { x: x0 + it.wounds[wi].f * L, y: b.y + b.h * 0.58, r: clamp(b.h * 0.09, 16, 28), L: L, x0: x0 };
        }
        function closeCare(k, auto) {
            var c = S.care;
            if (!c || c.close) return;
            c.close = 0.001;
            c.it.st = 'healed'; c.it.up = 0;
            if (!auto) {
                k.hit(10, k.W / 2, careBox(k).y + 30, { text: 'قام بالسلامة! ' });
                k.emit(k.W / 2, k.H * 0.4, 26, { colors: ['#ff8fa3', C.goldL, '#9dffb0', '#fff'] });
                k.glyphBurst(k.W / 2, k.H * 0.35, 6);
            } else k.pop(k.W / 2, careBox(k).y + 30, 'يلا نكمّل الطريق', '#fff', 16);
            S.followers++;
        }
        function careInput(k, p, isMove) {
            var c = S.care;
            if (!c || c.close || c.open < 1) return;
            var it = c.it, w = it.wounds[c.wi];
            if (!w) return;
            var wp = woundPos(k, it, c.wi), dx = p.x - wp.x, dy = p.y - wp.y, d = Math.sqrt(dx * dx + dy * dy);
            c.px = p.x; c.py = p.y;
            if (w.oil < 1) { c.touch = d < wp.r * 2.4; return; }
            if (!isMove) { c.ang = null; return; }
            if (d > wp.r * 0.4 && d < wp.r * 5) {
                var a = Math.atan2(dy, dx);
                if (c.ang != null) {
                    var da = a - c.ang;
                    while (da > Math.PI) da -= TAU;
                    while (da < -Math.PI) da += TAU;
                    if (Math.abs(da) < 1.3) { w.wrap = Math.min(1, w.wrap + Math.abs(da) / (TAU * 1.5)); if (Math.random() < 0.3) k.sfx('tick'); }
                }
                c.ang = a;
            } else c.ang = null;
        }
        function careUpdate(k, dt) {
            var c = S.care, it = c.it;
            if (c.close) { c.close += dt * 2.2; if (c.close >= 1) { S.care = null; S.mode = 'road'; } return; }
            c.open = Math.min(1, c.open + dt * 3);
            c.t += dt;
            var w = it.wounds[c.wi];
            if (w && w.oil < 1 && (c.touch && k.pdown || S.keyHold)) {
                w.oil = Math.min(1, w.oil + dt / 0.85);
                if (Math.random() < dt * 20) { var wp = woundPos(k, it, c.wi); k.emit(wp.x + rand(-6, 6), wp.y - wp.r, 1, { colors: ['#e2b34d', '#8e1f1f'], grav: 300, vmin: 5, vmax: 30, rmin: 1.5, rmax: 3 }); }
                if (w.oil >= 1) { var wq = woundPos(k, it, c.wi); k.hit(4, wq.x, wq.y - wq.r * 2, { text: '🫙 ' }); c.ang = null; }
            } else if (w && w.oil >= 1 && S.keyHold) w.wrap = Math.min(1, w.wrap + dt / 2.4);
            if (w && w.wrap >= 1 && !w.done) {
                w.done = true;
                var wr = woundPos(k, it, c.wi);
                k.hit(6, wr.x, wr.y - wr.r * 2, { text: '🩹 ' });
                k.emit(wr.x, wr.y, 12, { colors: ['#fff', '#f3ead6', C.goldL] });
                c.wi++; c.ang = null; c.touch = false;
                if (c.wi >= it.wounds.length) closeCare(k, false);
            }
            if (c.t > 16 && !c.close) closeCare(k, true);
        }
        function donkey(ctx, x, y, u, t, walk, brake, load) {
            ctx.save(); ctx.translate(x, y); ctx.scale(-u, u); // faces left (the way forward)
            var sw = walk >= 0 ? Math.sin(walk) : 0, bob = walk >= 0 ? -Math.abs(Math.cos(walk)) * 1.2 : 0;
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ell(ctx, 0, 0, 34, 4); ctx.fill();
            ctx.lineCap = 'round'; ctx.lineWidth = 4.5;
            function leg(hx, s, c) { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(hx, -30 + bob); ctx.lineTo(hx + s * 5, -14); ctx.lineTo(hx + s * 6, -1); ctx.stroke(); }
            leg(-18, -sw, '#6e6a66'); leg(16, sw, '#6e6a66');
            ctx.save(); ctx.translate(0, bob); ctx.rotate(-brake * 0.08);
            ctx.fillStyle = '#8f8a84'; ctx.beginPath(); ell(ctx, 0, -38, 27, 12); ctx.fill();
            ctx.fillStyle = '#8e1f1f'; rr(ctx, -12, -50, 22, 14, 3); ctx.fill();
            ctx.fillStyle = C.gold; ctx.fillRect(-12, -40, 22, 2);
            if (load) { ctx.fillStyle = '#f3ead6'; ctx.beginPath(); ell(ctx, -2, -54, 12, 6); ctx.fill(); ctx.fillStyle = C.skin; ctx.beginPath(); circ(ctx, 11, -56, 4.5); ctx.fill(); }
            ctx.strokeStyle = '#8f8a84'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(20, -42); ctx.lineTo(30, -56); ctx.stroke();
            ctx.fillStyle = '#8f8a84'; ctx.beginPath(); ell(ctx, 36, -56, 9, 6); ctx.fill();
            ctx.fillStyle = '#5a5652'; ctx.beginPath(); ell(ctx, 43, -54, 3.5, 4); ctx.fill();
            ctx.strokeStyle = '#8f8a84'; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(30, -62); ctx.lineTo(27 + Math.sin(t * 3) * 1.5, -76); ctx.moveTo(33, -62); ctx.lineTo(34, -77); ctx.stroke();
            ctx.fillStyle = '#1b0f07'; ctx.beginPath(); circ(ctx, 36, -58, 1.3); ctx.fill();
            ctx.strokeStyle = '#5a5652'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, -40); ctx.lineTo(-32, -28); ctx.stroke();
            ctx.restore();
            leg(-14, sw, '#8f8a84'); leg(20, -sw, '#8f8a84');
            ctx.restore();
        }
        function lying(ctx, x0, y, L, robe, t, rise) {
            ctx.save(); ctx.translate(x0, y); ctx.rotate(Math.PI / 2 - rise * Math.PI / 2 * 0.5);
            figure(ctx, { x: 0, y: 0, h: L, dir: 1, robe: robe, hair: '#3a2414', beard: 0.6, arm: 0.1, arm2: 0.1, t: t, noShadow: true });
            ctx.restore();
        }
        function drawCare(k, ctx, W, H) {
            var c = S.care, it = c.it, a = c.close ? 1 - eo(c.close) : eo(c.open);
            ctx.save();
            ctx.fillStyle = 'rgba(12,6,2,' + 0.45 * a + ')'; ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = a;
            var b = careBox(k);
            ctx.translate(0, (1 - a) * 30);
            k.panel(ctx, { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });
            var wp0 = woundPos(k, it, 0);
            ctx.fillStyle = 'rgba(120,85,45,0.18)'; rr(ctx, wp0.x0 - 10, wp0.y - 8, wp0.L + 20, 24, 10); ctx.fill();
            lying(ctx, wp0.x0, wp0.y + 4, wp0.L * 0.98, it.robe, k.rt, c.close ? eo(c.close) : 0);
            for (var i = 0; i < it.wounds.length; i++) {
                var w = it.wounds[i], wp = woundPos(k, it, i), cur = i === c.wi && !c.close;
                if (w.wrap < 1) {
                    ctx.strokeStyle = w.oil >= 1 ? '#c0392b' : '#8e1f1f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(wp.x - 7, wp.y - 5); ctx.lineTo(wp.x + 6, wp.y + 4); ctx.moveTo(wp.x - 3, wp.y + 6); ctx.lineTo(wp.x + 7, wp.y - 3); ctx.stroke();
                    if (w.oil > 0) { ctx.fillStyle = 'rgba(226,179,77,' + 0.5 * w.oil + ')'; ctx.beginPath(); circ(ctx, wp.x, wp.y, wp.r * 0.8); ctx.fill(); }
                }
                if (w.wrap > 0) {
                    ctx.strokeStyle = '#fbf7ec'; ctx.lineWidth = 7;
                    ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r * 0.7, -Math.PI / 2, -Math.PI / 2 + TAU * w.wrap); ctx.stroke();
                    ctx.strokeStyle = 'rgba(160,140,110,0.6)'; ctx.lineWidth = 1; ctx.stroke();
                }
                if (cur) {
                    var pulse = 1 + Math.sin(k.rt * 6) * 0.1;
                    ctx.strokeStyle = 'rgba(142,31,31,0.5)'; ctx.lineWidth = 2; ctx.setLineDash && ctx.setLineDash([5, 5]);
                    ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r * 1.6 * pulse, 0, TAU); ctx.stroke();
                    ctx.setLineDash && ctx.setLineDash([]);
                    if (w.oil < 1) {
                        ring(ctx, wp.x, wp.y, wp.r * 1.15, w.oil, C.gold, 4);
                        // jar tilting over the wound
                        ctx.save(); ctx.translate(wp.x + wp.r * 1.2, wp.y - wp.r * 2); ctx.rotate(c.touch && k.pdown ? -0.9 : -0.2);
                        ctx.fillStyle = '#b8683a'; ctx.beginPath(); ell(ctx, 0, 0, 8, 10); ctx.fill(); ctx.fillStyle = '#8a4a24'; ctx.fillRect(-4, -12, 8, 3); ctx.restore();
                    } else {
                        var sp = k.rt * 3;
                        ctx.fillStyle = '#fbf7ec'; ctx.beginPath(); circ(ctx, wp.x + Math.cos(sp) * wp.r * 1.6, wp.y + Math.sin(sp) * wp.r * 1.6, 5); ctx.fill();
                        ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; ctx.stroke();
                    }
                }
            }
            var w2 = it.wounds[c.wi];
            if (w2 && !c.close) txt(ctx, (w2.oil < 1 ? '👆 ' : '🔄 ') + plain(w2.oil < 1 ? steps[0] : steps[1]), b.x + b.w / 2, b.y + b.h * 0.2, font(clamp(b.h * 0.07, 14, 20), 900), C.red);
            if (it.label) chip(ctx, it.label, b.x + b.w / 2, b.y + b.h * 0.86, clamp(b.h * 0.045, 11, 14), 'rgba(142,31,31,0.85)', '#ffe9b8');
            ctx.restore();
        }

        var k = createCore(host, data, api, {
            title: 'السامري الصالح', icon: '🐴',
            howto: { kind: 'hold', text: 'دوس مطوّل عشان توقف الحمار جنب المجروح بالظبط. بعدين دوس على الجرح وبعدها لف حواليه عشان تربطه.' },
            comboStep: 4, maxMult: 3, pad: [130.8, 196], lives: 3, factY: 0.2,
            rawMax: function (k) { return perfectSeq(k, rep(TOTAL_N, 12).concat(rep(TOTAL_W, 10), rep(TOTAL_N, 10))) + 30 + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.bigZone = 8; return '🛣️ مكان الوقوف بقى أوسع'; },
            update: function (k, dt) {
                var g = S.g, P = PH[Math.floor(clamp(S.ph, 0, 2))];
                S.dusk += ((S.ph >= 2 ? 0.35 : S.ph >= 1 ? 0.1 : 0) - S.dusk) * Math.min(1, dt * 0.6);
                if (S.bigZone > 0) S.bigZone -= dt;
                if (S.mode === 'care') { careUpdate(k, dt); return; }
                var vmax = g.W * P.vmax, zone0 = g.W * P.zone * (S.bigZone > 0 ? 1.6 : 1), near = false;
                for (var n0 = 0; n0 < S.items.length; n0++) {
                    var i0 = S.items[n0], x0 = sxOf(i0);
                    if ((i0.st === 'lie' || i0.st === 'wait') && x0 > g.sx - g.W * 0.42 && x0 < g.sx + zone0 * 2 + 30) near = true;
                }
                // braking only matters near someone in need; on an empty road the donkey keeps a slow walk
                S.empty = S.hold && !near;
                var target = !S.active ? 0 : !S.hold ? vmax : near ? 0 : vmax * 0.55;
                if (S.v < target) S.v = Math.min(target, S.v + vmax * 2.2 * dt);
                else S.v = Math.max(target, S.v - vmax * P.brake * dt);
                S.dist += S.v * dt;
                S.walk += S.v * dt * 0.09;
                S.hint = Math.max(0, S.hint - dt);
                var zone = g.W * P.zone * (S.bigZone > 0 ? 1.6 : 1);
                for (var i = 0; i < S.items.length; i++) {
                    var it = S.items[i], x = sxOf(it);
                    if (it.st === 'healed') it.up = Math.min(1, it.up + dt);
                    if (it.kind === 'hurt' && it.st === 'lie') {
                        if (S.v < 6 && Math.abs(x - g.sx) < zone) { openCare(k, it, x - g.sx); return; }
                        if (x > g.sx + zone + 30) {
                            it.st = 'missed';
                            if (k.loseLife(g.sx, g.roadT - g.ph, 'فاتك المجروح!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… المرة الجاية وقّف للمحتاج', finaleT: 1.2 }); return; }
                        }
                    } else if (it.kind === 'inn' && it.st === 'wait') {
                        if (S.v < 6 && Math.abs(x - g.sx) < zone * 1.4) {
                            it.st = 'done'; S.innOk = true;
                            for (var f = 0; f < S.followers; f++) k.hit(10, g.sx - 40 + f * 18, g.roadT - g.ph - f * 16, { text: '🏨 ' });
                            if (inn.pay) k.pop(g.sx, g.roadT - g.ph * 1.5, plain(inn.pay), C.goldL, 22);
                            k.emit(x, g.roadT - g.ph * 0.5, 30, { colors: [C.goldL, C.gold, '#fff'] });
                            k.sfx('coin'); phaseEnd(k); return;
                        }
                        if (x > g.sx + zone * 2 + 40) { it.st = 'passed'; phaseEnd(k); return; }
                    }
                }
                for (var p = 0; p < S.pass.length; p++) {
                    var pp = S.pass[p];
                    pp.x += (g.W * 0.12 + S.v) * dt * (S.dist > pp.wx - g.W * 1.1 ? 1 : 0);
                    if (pp.x > g.W + 60) pp.done = true;
                }
                if (S.active && S.ph === Math.floor(S.ph) && !pending() && S.ph < 2) phaseEnd(k);
            },
            finale: function (k, dt) { if (k.info.win && Math.random() < dt * 4) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: ['#ff8fa3', C.goldL], grav: 60 }); },
            down: function (k, p) {
                if (S.mode === 'care') { careInput(k, p, false); return; }
                S.hold = true; S.hint = 0.4;
            },
            move: function (k, p) { if (S.mode === 'care' && k.pdown) careInput(k, p, true); },
            up: function (k) { S.hold = false; if (S.care) { S.care.touch = false; S.care.ang = null; } },
            key: function (k, key, isDown) {
                if (key === ' ') { S.keyHold = isDown; if (S.mode !== 'care') S.hold = isDown; return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt;
                ctx.fillStyle = vgrad(ctx, 0, g.roadT, ['#6fa8d8', '#bcd9ea', '#f3dcb0']); ctx.fillRect(0, 0, W, g.roadT);
                ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); circ(ctx, W * 0.2, H * (0.16 + S.dusk * 0.5), H * 0.05); ctx.fill();
                for (var c = 0; c < 3; c++) cloud(ctx, (((c * 0.41) - S.dist * 0.00006 * (c + 1) + t * 0.004) % 1.2 + 1.2) % 1.2 * W - W * 0.1, H * (0.1 + c * 0.06), W * 0.07, 0.5);
                blitTiled(ctx, S.far, -S.dist * 0.12, 0, W);
                blitTiled(ctx, S.mid, -S.dist * 0.45, 0, W);
                blitTiled(ctx, S.road, -S.dist, g.roadT - 2, W);
                var P = PH[Math.floor(clamp(S.ph, 0, 2))], zone = g.W * P.zone * (S.bigZone > 0 ? 1.6 : 1);
                // passers-by on the far side of the road
                for (var p = 0; p < S.pass.length; p++) {
                    var pp = S.pass[p];
                    if (pp.done || pp.x < -30) continue;
                    figure(ctx, { x: pp.x, y: g.roadT + 4, h: g.ph * 0.7, dir: 1, robe: p ? '#e9e1cf' : '#fbf7ec', mantle: p ? '#3b5f86' : '#9a6b1c', hair: '#3a2414', beard: 1, walk: t * 8, t: t, dpr: k.dpr });
                    chip(ctx, pp.label, pp.x, g.roadT - g.ph * 0.8, 12, 'rgba(40,14,6,0.7)', '#ffe9b8');
                    if (data.passNote) chip(ctx, data.passNote, pp.x, g.roadT - g.ph * 0.8 - 22, 11, 'rgba(251,241,216,0.92)', C.red);
                }
                // items on the road
                for (var i = 0; i < S.items.length; i++) {
                    var it = S.items[i], x = sxOf(it);
                    if (x < -120 || x > W + 140) continue;
                    if (it.kind === 'inn') {
                        var ih = g.ph * 1.25, iw = ih * 1.1, iy = g.roadT + 6;
                        ctx.fillStyle = '#d9c7a1'; ctx.fillRect(x - iw / 2, iy - ih, iw, ih);
                        ctx.fillStyle = '#b8a07a'; ctx.fillRect(x - iw / 2 - 6, iy - ih - 8, iw + 12, 10);
                        ctx.fillStyle = '#5a3517'; ctx.beginPath(); ctx.moveTo(x - iw * 0.16, iy); ctx.lineTo(x - iw * 0.16, iy - ih * 0.45); ctx.arc(x, iy - ih * 0.45, iw * 0.16, Math.PI, TAU); ctx.lineTo(x + iw * 0.16, iy); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#ffd27a'; ctx.fillRect(x - iw * 0.4, iy - ih * 0.8, iw * 0.14, ih * 0.14); ctx.fillRect(x + iw * 0.26, iy - ih * 0.8, iw * 0.14, ih * 0.14);
                        flame(ctx, x + iw * 0.3, iy - ih * 0.5, 4, t);
                        if (inn.name) chip(ctx, inn.name, x, iy - ih - 22, 13, 'rgba(142,31,31,0.9)', '#ffe9b8');
                        if (it.st === 'wait') { ctx.fillStyle = 'rgba(255,215,120,' + (0.25 + 0.15 * Math.sin(t * 6)) + ')'; ctx.beginPath(); ell(ctx, x, g.roadT + (g.roadB - g.roadT) * 0.45, zone * 1.4, 10); ctx.fill(); }
                        continue;
                    }
                    var ly = g.roadT + (g.roadB - g.roadT) * 0.25;
                    if (it.st === 'lie' || it.st === 'missed') {
                        if (it.st === 'lie') {
                            var near = Math.abs(x - g.sx) < zone;
                            ctx.fillStyle = near ? 'rgba(157,255,176,' + (0.35 + 0.2 * Math.sin(t * 8)) + ')' : 'rgba(255,215,120,' + (0.25 + 0.15 * Math.sin(t * 5)) + ')';
                            ctx.beginPath(); ell(ctx, x, g.roadT + (g.roadB - g.roadT) * 0.45, zone, 9); ctx.fill();
                            ctx.strokeStyle = near ? '#2e9e5b' : 'rgba(154,107,28,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
                        }
                        lying(ctx, x - g.ph * 0.4, ly, g.ph * 0.8, it.robe, t, 0);
                        ctx.strokeStyle = '#8e1f1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, ly - 4); ctx.lineTo(x + 4, ly + 2); ctx.stroke();
                        if (it.st === 'lie') {
                            if (it.label) chip(ctx, it.label, x, ly - g.ph * 0.5, 12, 'rgba(142,31,31,0.85)', '#ffe9b8');
                            else txt(ctx, '🆘', x, ly - g.ph * 0.4 + Math.sin(t * 4) * 3, font(16, 900), '#fff');
                        }
                    }
                }
                // followers (the healed walk behind)
                for (var f = 0; f < Math.min(3, S.followers); f++) {
                    tinyPerson(ctx, g.sx + 34 * g.u + f * 20 * g.u, g.roadT + (g.roadB - g.roadT) * 0.55, g.ph * 0.45, ['#b5543a', '#7c8a3a', '#6b4a7a'][f], '#3a2414', S.v > 5 ? S.walk * 1.4 + f : -1, -1);
                }
                var wk = S.v > 5 ? S.walk * 1.4 : -1, gy = g.roadT + (g.roadB - g.roadT) * 0.62;
                donkey(ctx, g.sx - 46 * g.u, gy + 2, g.u * 1.1, t, wk, S.hold || (S.v < g.W * P.vmax * 0.6 && S.v > 3) ? 1 : 0, false);
                figure(ctx, { x: g.sx, y: gy, h: g.ph, dir: -1, robe: '#e0d2b0', mantle: '#2e7d6b', hair: '#3a2414', headband: '#f3ead6', beard: 1, walk: wk, arm: 1.1, t: t, dpr: k.dpr });
                if (S.ph === 0 && S.active && S.dist < g.W * 0.6) txt(ctx, 'دوس مطوّل عشان تقف ✋', W / 2, H * 0.3, font(16, 900), '#fff', 'center', 4);
                if (S.hold && S.mode === 'road') txt(ctx, S.empty ? 'مفيش حد هنا… كمّل 👣' : '✋', g.sx, gy - g.ph * 1.15, font(S.empty ? 13 : 20, 900), '#fff', 'center', 3);
                if (S.dusk > 0.02) { ctx.fillStyle = 'rgba(70,30,60,' + S.dusk + ')'; ctx.fillRect(0, 0, W, H); }
                if (S.care) drawCare(k, ctx, W, H);
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 3. washFeet -- the washing of the feet (John 13) and Maundy Thursday
     * Rub each disciple's feet gently (too fast only splashes), then drag the
     * towel across to dry them. Pride bubbles rise from below: tap to pop them
     * before they reach the top (a life each). A candle measures each turn.
     * Phase 1: the upper room. Phase 2: Peter first refuses (data dialogue).
     * Phase 3 (twist): خميس العهد in church -- virtue bubbles (gold) rise too and
     * must NOT be popped; let them reach the top. Data: disciples, people, peter,
     * pride, virtues, questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.washFeet = function (host, data, api) {
        data = data || {};
        var pride = strList(data.pride), virtues = strList(data.virtues), names = strList(data.disciples), people = strList(data.people);
        if (!pride.length) pride = ['أنا', 'أنا الأول'];
        if (!virtues.length) virtues = ['وداعة', 'اتضاع'];
        var peter = (data.peter || []).filter(function (l) { return l && l.t; });
        var PH = [
            { n: 3, spots: 3, T: 16, bub: 3, vir: 0, rise: 7.5 },
            { n: 3, spots: 4, T: 14, bub: 4, vir: 0, rise: 6.5 },
            { n: 3, spots: 4, T: 12, bub: 5, vir: 2, rise: 6.0 }
        ];
        var SPOTS = [[-4, -9], [5, -2], [-3, 6], [4, 11]];
        var ROBES = [['#e9dcc0', '#8e1f1f'], ['#dfe7ef', '#3b5f86'], ['#efe4cc', '#7c8a3a'], ['#f3ead6', '#6b4a7a'], ['#e9e1cf', '#9a6b1c'], ['#e0d2b0', '#2e7d6b']];
        var S = { ph: -1, active: false, queue: [], cur: null, bubs: [], haze: 0, lamps: 0, spd: 0, lastT: 0, lx: 0, ly: 0, fastT: 0, di: 0, keyHold: false };
        var totSpots = 0, totPride = 0, totVir = 0;
        PH.forEach(function (P) { totSpots += P.n * P.spots * 2; totPride += P.n * (P.bub - P.vir); totVir += P.n * P.vir; });

        function G(k) {
            var W = k.W, H = k.H, by = H * 0.86, sc = H * 0.0039;
            return { W: W, H: H, cx: W * 0.5, by: by, sc: sc, fs: sc * 1.55, br: clamp(H * 0.075, 22, 36) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.room = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#4a2e1c', '#6b4428', '#3d2616']); x.fillRect(0, 0, W, H);
                x.strokeStyle = 'rgba(20,10,4,0.25)'; x.lineWidth = 1;
                for (var yy = 0; yy < H * 0.8; yy += 26) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); for (var xx = (yy / 26) % 2 ? 0 : 40; xx < W; xx += 80) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + 26); x.stroke(); } }
                var ax = W * 0.84, aw = clamp(W * 0.1, 50, 90), at = H * 0.08, ab = H * 0.42;
                x.fillStyle = vgrad(x, at, ab, ['#0d1433', '#27336b']);
                x.beginPath(); x.moveTo(ax - aw / 2, ab); x.lineTo(ax - aw / 2, at + aw / 2); x.arc(ax, at + aw / 2, aw / 2, Math.PI, TAU); x.lineTo(ax + aw / 2, ab); x.closePath(); x.fill();
                x.lineWidth = 5; x.strokeStyle = '#c9a06a'; x.stroke();
                x.fillStyle = '#fff6d0'; x.beginPath(); circ(x, ax + aw * 0.1, at + aw * 0.55, aw * 0.16); x.fill();
                for (var s = 0; s < 6; s++) { x.beginPath(); circ(x, ax - aw * 0.35 + (s * 37) % aw * 0.7, at + aw * 0.3 + (s * 23) % (ab - at - aw * 0.4), 1); x.fill(); }
                // supper table behind
                var ty = H * 0.5;
                for (var p = 0; p < 7; p++) tinyPerson(x, W * (0.08 + p * 0.1), ty + 4, H * 0.14, ['#6b4a2a', '#5a3a22', '#4e3320'][p % 3], '#2a1a0e', -1, 0);
                x.fillStyle = '#7a4a1e'; x.fillRect(W * 0.03, ty, W * 0.72, H * 0.035);
                x.fillStyle = '#e8c98a'; for (var b = 0; b < 4; b++) { x.beginPath(); ell(x, W * (0.12 + b * 0.17), ty - 3, 9, 4); x.fill(); }
                x.fillStyle = C.gold; x.fillRect(W * 0.38, ty - 12, 6, 10); x.beginPath(); ell(x, W * 0.38 + 3, ty - 12, 6, 3); x.fill();
                x.fillStyle = vgrad(x, H * 0.62, H, ['#5a3a22', '#3a2414']); x.fillRect(0, H * 0.62, W, H * 0.38);
            });
            S.church = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#3a1c14', '#5c2a18', '#2a140c']); x.fillRect(0, 0, W, H);
                var it = H * 0.06, ib = H * 0.6;
                x.fillStyle = vgrad(x, it, ib, ['#8a5a2b', '#6b4220']); x.fillRect(W * 0.04, it, W * 0.92, ib - it);
                var fr = friezeSprite(12, k.dpr, C.gold, C.redD); blitTiled(x, fr, 0, it, W);
                var n = 7;
                for (var i = 0; i < n; i++) {
                    var cx = W * 0.04 + (i + 0.5) * W * 0.92 / n, iw = W * 0.92 / n * 0.72, ih = (ib - it) * 0.62, iy = it + 22;
                    if (i === 3) { x.fillStyle = '#8e1f1f'; x.beginPath(); x.moveTo(cx - iw / 2, ib); x.lineTo(cx - iw / 2, iy + iw / 2); x.arc(cx, iy + iw / 2, iw / 2, Math.PI, TAU); x.lineTo(cx + iw / 2, ib); x.closePath(); x.fill(); copticCross(x, cx, iy + ih * 0.5, iw * 0.25, C.gold, C.goldD, 1); continue; }
                    x.fillStyle = '#e9c98f'; rr(x, cx - iw / 2, iy, iw, ih, 6); x.fill(); x.strokeStyle = C.gold; x.lineWidth = 2; x.stroke();
                    halo(x, cx, iy + ih * 0.3, iw * 0.2, k.dpr);
                    x.fillStyle = ['#8e1f1f', '#1f6fa3', '#6f8a3a'][i % 3]; x.beginPath(); x.moveTo(cx - iw * 0.3, iy + ih - 4); x.lineTo(cx - iw * 0.2, iy + ih * 0.45); x.lineTo(cx + iw * 0.2, iy + ih * 0.45); x.lineTo(cx + iw * 0.3, iy + ih - 4); x.closePath(); x.fill();
                    x.fillStyle = C.skin; x.beginPath(); circ(x, cx, iy + ih * 0.3, iw * 0.12); x.fill();
                }
                x.fillStyle = vgrad(x, ib, H, ['#d9cdb8', '#a89478']); x.fillRect(0, ib, W, H - ib);
                x.strokeStyle = 'rgba(80,60,40,0.25)';
                for (var t = 0; t < 12; t++) { x.beginPath(); x.moveTo(W * t / 12, ib); x.lineTo(W * (t / 12 - 0.5) * 2.2 + W / 2, H); x.stroke(); }
            });
        }
        function footPos(g, f) { return { x: g.cx + (f ? 16 : -16) * g.fs, y: g.by - 11 * g.fs }; }
        function spotPos(g, s) { var fp = footPos(g, s.f); return { x: fp.x + s.ox * g.fs, y: fp.y + s.oy * g.fs - (S.cur && S.cur.st === 'peter' ? 14 * g.fs : 0) }; }
        function startPhase(k, n) {
            var P = PH[n];
            S.ph = n; S.active = false; S.queue = [];
            for (var i = 0; i < P.n; i++) {
                var nm = n < 2 ? (names[n * 3 + i] || '') : (people[i] || '');
                S.queue.push({ name: nm, peter: n === 1 && i === 0 && peter.length > 0, church: n === 2, rb: ROBES[(n * 3 + i) % ROBES.length] });
            }
            k.phaseCard(n + 1);
            k.after(1.3, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; nextDisciple(k); });
        }
        function nextDisciple(k) {
            var P = PH[S.ph], q = S.queue.shift();
            if (!q) { S.cur = null; return; }
            var spots = [];
            for (var f = 0; f < 2; f++) for (var s = 0; s < P.spots; s++) spots.push({ f: f, ox: SPOTS[s][0] * (f ? -1 : 1), oy: SPOTS[s][1], dirt: 1 });
            var plan = [], vir = shuffle(rep(P.vir, 1).concat(rep(P.bub - P.vir, 0)));
            for (var b = 0; b < P.bub; b++) plan.push({ at: P.T * (b + 0.4) / P.bub, v: !!vir[b] });
            S.cur = { q: q, spots: spots, t: 0, T: P.T, st: q.peter ? 'peter' : 'wash', enter: 0, tmin: 0, tmax: 0, pi: 0, pt: 0, plan: plan, bt: 0 };
            S.di++;
        }
        function finishDisciple(k, ok) {
            var c = S.cur, g = S.g;
            c.st = 'out'; c.enter = 1;
            if (ok) {
                var frac = clamp(1 - c.t / c.T, 0, 1);
                k.hit(10 + Math.round(frac * 6), g.cx, g.by - 120 * g.sc, { text: '🤍 ' });
                k.emit(g.cx, g.by - 20 * g.fs, 24, { colors: ['#bfe8ff', C.goldL, '#fff'] });
                k.glyphBurst(g.cx, g.by - 170 * g.sc, 5);
            } else { k.breakCombo(); k.pop(g.cx, g.by - 120 * g.sc, 'الوقت خلص… نكمّل', '#ffd0c0', 15); }
        }
        function spawnBub(k, v) {
            var g = S.g, P = PH[S.ph];
            var list = v ? virtues : pride;
            S.bubs.push({ x: rand(g.W * 0.08, g.W * 0.92), y: g.H + g.br, v: v, label: list[Math.floor(Math.random() * list.length)], vy: g.H / P.rise, ph: rand(0, TAU), pop: 0 });
        }
        function rubAt(k, p, dtm) {
            var c = S.cur, g = S.g;
            if (!c || c.st !== 'wash') return;
            var FAST = k.u * 3.4, gentle = S.spd > 20 && S.spd < FAST;
            if (S.spd >= FAST) {
                S.fastT += dtm;
                if (Math.random() < 0.5) k.emit(p.x, p.y, 2, { colors: ['#bfe8ff', '#5fb3d9'], grav: 500, vmin: 80, vmax: 220 });
                if (S.fastT > 0.5) { S.fastT = -0.8; k.breakCombo(); k.pop(p.x, p.y - 30, 'بالراحة… بوداعة 🤍', '#bfe8ff', 16); k.sfx('splash'); }
                return;
            }
            if (S.fastT > 0) S.fastT = Math.max(0, S.fastT - dtm);
            if (!gentle && !S.keyHold) return;
            var R = 9 * g.fs + 12;
            for (var i = 0; i < c.spots.length; i++) {
                var s = c.spots[i];
                if (s.dirt <= 0) continue;
                var sp = spotPos(g, s), dx = sp.x - p.x, dy = sp.y - p.y;
                if (dx * dx + dy * dy < R * R) {
                    s.dirt -= dtm * 2.4;
                    if (Math.random() < 0.25) k.emit(sp.x, sp.y, 1, { colors: ['#bfe8ff', '#ffffff'], grav: 200, vmin: 10, vmax: 50, rmin: 1.4, rmax: 2.8 });
                    if (s.dirt <= 0) { s.dirt = 0; k.hit(3, sp.x, sp.y - 16, { silent: false, pitch: i }); }
                }
            }
            var all = true;
            for (var j = 0; j < c.spots.length; j++) if (c.spots[j].dirt > 0) all = false;
            if (all) { c.st = 'towel'; c.tmin = 1e9; c.tmax = -1e9; k.sfx('coin'); }
        }
        function towelAt(k, p) {
            var c = S.cur, g = S.g;
            if (!c || c.st !== 'towel') return;
            var fy = g.by - 11 * g.fs;
            if (Math.abs(p.y - fy) > 40 * g.fs) return;
            c.tmin = Math.min(c.tmin, p.x); c.tmax = Math.max(c.tmax, p.x);
            if (c.tmax - c.tmin > 52 * g.fs) finishDisciple(k, true);
        }
        function seated(k, ctx, g, c, t) {
            var q = c.q, sc = g.sc, off = (c.st === 'out' ? eio(1 - c.enter) : -eio(1 - c.enter)) * g.W * 0.7;
            ctx.save(); ctx.translate(g.cx + off, g.by); ctx.scale(sc, sc);
            ctx.fillStyle = '#6b4220'; ctx.fillRect(-80, -104, 160, 14); ctx.fillRect(-74, -90, 10, 60); ctx.fillRect(64, -90, 10, 60);
            ctx.fillStyle = C.skin; ctx.fillRect(-22, -52, 12, 44); ctx.fillRect(10, -52, 12, 44);
            var robe = q.rb[0], mantle = q.rb[1];
            ctx.fillStyle = robe;
            ctx.beginPath(); ctx.moveTo(-26, -150); ctx.lineTo(-36, -102); ctx.lineTo(-42, -50); ctx.quadraticCurveTo(0, -42, 42, -50); ctx.lineTo(36, -102); ctx.lineTo(26, -150); ctx.quadraticCurveTo(0, -160, -26, -150); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(30,15,5,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = mantle; ctx.beginPath(); ctx.moveTo(24, -150); ctx.quadraticCurveTo(10, -120, -34, -96); ctx.lineTo(-38, -84); ctx.quadraticCurveTo(14, -104, 32, -130); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = K.shade(robe); ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-24, -142); ctx.lineTo(-30, -96); ctx.lineTo(-20, -70); ctx.moveTo(24, -142); ctx.lineTo(30, -96); ctx.lineTo(20, -70); ctx.stroke();
            ctx.fillStyle = C.skin; ctx.beginPath(); circ(ctx, -20, -68, 5); circ(ctx, 20, -68, 5); ctx.fill();
            if (!q.church) halo(ctx, 0, -172, 19, Math.max(0.5, k.dpr * sc));
            ctx.fillStyle = C.skin; ctx.fillRect(-4, -160, 8, 8);
            ctx.beginPath(); ell(ctx, 0, -171, 11, 13); ctx.fill();
            ctx.fillStyle = q.church ? '#2a1a0e' : '#5a3a22';
            ctx.beginPath(); ctx.arc(0, -173, 12, Math.PI * 1.05, TAU * 0.995); ctx.lineTo(10, -168); ctx.quadraticCurveTo(0, -180, -10, -168); ctx.closePath(); ctx.fill();
            if (!q.church || q.name) { ctx.beginPath(); ctx.moveTo(-9, -168); ctx.quadraticCurveTo(-8, -154, 0, -151); ctx.quadraticCurveTo(8, -154, 9, -168); ctx.quadraticCurveTo(0, -160, -9, -168); ctx.fill(); }
            var happy = c.st === 'out' && c.enter > 0.5;
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-4.5, -172, 2.6, 1.6, 0, 0, TAU); ctx.ellipse(4.5, -172, 2.6, 1.6, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#1b0f07'; ctx.beginPath(); circ(ctx, -4.5, -172, 1.2); circ(ctx, 4.5, -172, 1.2); ctx.fill();
            ctx.strokeStyle = '#1b0f07'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-7.5, -175.5); ctx.quadraticCurveTo(-4.5, -177, -1.5, -175.5); ctx.moveTo(1.5, -175.5); ctx.quadraticCurveTo(4.5, -177, 7.5, -175.5); ctx.moveTo(0, -171); ctx.lineTo(-1, -165); ctx.lineTo(1, -165); ctx.stroke();
            ctx.beginPath(); if (happy) ctx.arc(0, -162, 3, 0.2, Math.PI - 0.2); else { ctx.moveTo(-2.5, -161); ctx.lineTo(2.5, -161); } ctx.stroke();
            ctx.restore();
            return off;
        }
        function feet(k, ctx, g, c, off) {
            var fs = g.fs, lift = c.st === 'peter' ? 14 * fs : 0;
            ctx.save(); ctx.translate(off, -lift);
            for (var f = 0; f < 2; f++) {
                var fp = footPos(g, f), x = fp.x, y = fp.y;
                ctx.fillStyle = C.skin;
                ctx.beginPath(); ctx.moveTo(x - 6 * fs, y - 16 * fs); ctx.quadraticCurveTo(x - 12 * fs, y, x - 11 * fs, y + 11 * fs); ctx.quadraticCurveTo(x, y + 16 * fs, x + 11 * fs, y + 11 * fs); ctx.quadraticCurveTo(x + 12 * fs, y, x + 6 * fs, y - 16 * fs); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = C.skinD; ctx.lineWidth = 1.2; ctx.stroke();
                for (var t = 0; t < 5; t++) { var tx = x + (t - 2) * 4.4 * fs * (f ? -1 : 1), ty = y + 12.5 * fs - Math.abs(t - 2) * 1.2 * fs; ctx.beginPath(); circ(ctx, tx, ty, (t === (f ? 4 : 0) ? 2.6 : 2) * fs); ctx.fillStyle = C.skin; ctx.fill(); ctx.stroke(); }
            }
            for (var i = 0; i < c.spots.length; i++) {
                var s = c.spots[i], sp = spotPos(g, s);
                if (s.dirt > 0) { ctx.fillStyle = 'rgba(110,75,40,' + (0.85 * s.dirt) + ')'; ctx.beginPath(); ell(ctx, sp.x, sp.y + lift, 4.6 * fs, 3.4 * fs); ctx.fill(); }
                else { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); circ(ctx, sp.x + 2, sp.y + lift - 2, 1.4 * fs); ctx.fill(); }
            }
            ctx.restore();
        }
        function basin(ctx, g, back, t) {
            var x = g.cx, y = g.by - 2 * g.fs, rx = 44 * g.fs, ry = 11 * g.fs;
            if (back) {
                ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ell(ctx, x, y, rx, ry); ctx.fill();
                ctx.fillStyle = '#3a6f8f'; ctx.beginPath(); ell(ctx, x, y + 1, rx * 0.9, ry * 0.75); ctx.fill();
                return;
            }
            ctx.fillStyle = 'rgba(95,179,217,0.55)'; ctx.beginPath(); ell(ctx, x, y + ry * 0.1, rx * 0.9, ry * 0.7); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.ellipse(x + Math.sin(t) * 6, y, rx * 0.5, ry * 0.3, 0, 0, TAU); ctx.stroke();
            ctx.fillStyle = vgrad(ctx, y, y + ry * 2.4, ['#c98d4a', '#8a5a2b']);
            ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(x + rx * 0.8, y + ry * 2.2); ctx.quadraticCurveTo(x, y + ry * 2.9, x - rx * 0.8, y + ry * 2.2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#5a3517'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.strokeStyle = C.goldL; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI); ctx.stroke();
            drawCross(ctx, x, y + ry * 1.5, clamp(ry * 0.9, 7, 14), C.goldL, 1);
        }

        var k = createCore(host, data, api, {
            title: 'غسل الأرجل', icon: '🦶',
            howto: { kind: 'drag', text: 'امسح على الرجلين بالراحة لحد ما يتنضفوا، وبعدين اسحب الفوطة. فرقع فقاعات الكبرياء قبل ما توصل لفوق!' },
            comboStep: 5, maxMult: 3, pad: [110, 164.8, 220], lives: 3, factY: 0.02,
            rawMax: function (k) {
                var n = PH[0].n + PH[1].n + PH[2].n;
                // a quick washer finishes turns early and meets only part of the planned bubbles: count half of them
                return perfectSeq(k, rep(totSpots, 3).concat(rep(n, 16), rep(Math.round(totPride / 2), 4), rep(Math.round(totVir / 2), 5))) + 2 * k.askBonus;
            },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { for (var i = 0; i < S.bubs.length; i++) if (!S.bubs[i].v) S.bubs[i].pop = 0.001; if (S.cur) S.cur.t = Math.max(0, S.cur.t - 4); return '🕊️ الكبرياء اتفرقع كله + وقت زيادة'; },
            update: function (k, dt) {
                var g = S.g, c = S.cur;
                S.haze = Math.max(0, S.haze - dt * 0.05);
                if (c) {
                    if (c.st === 'out') {
                        c.enter -= dt * 1.6;
                        if (c.enter <= 0) { nextDisciple(k); c = S.cur; }
                    } else {
                        c.enter = Math.min(1, c.enter + dt * 1.8);
                        if (c.st === 'peter') {
                            c.pt += dt;
                            if (c.pt > 2.8) { c.pt = 0; c.pi++; if (c.pi >= peter.length) c.st = 'wash'; }
                        } else if (c.enter >= 1) {
                            c.t += dt; c.bt += dt;
                            while (c.plan.length && c.plan[0].at <= c.bt) spawnBub(k, c.plan.shift().v);
                            if (S.keyHold) {
                                if (c.st === 'wash') { S.spd = 100; for (var i = 0; i < c.spots.length; i++) if (c.spots[i].dirt > 0) { rubAt(k, spotPos(g, c.spots[i]), dt); break; } }
                                else if (c.st === 'towel') { c.tmax += dt * 60 * g.fs; if (c.tmin > 1e8) c.tmin = 0; if (c.tmax - c.tmin > 52 * g.fs) finishDisciple(k, true); }
                            }
                            if (c && c.st !== 'out' && c.t >= c.T) finishDisciple(k, false);
                        }
                    }
                }
                for (var b = S.bubs.length - 1; b >= 0; b--) {
                    var bb = S.bubs[b];
                    if (bb.pop) { bb.pop += dt * 3; if (bb.pop >= 1) S.bubs.splice(b, 1); continue; }
                    bb.y -= bb.vy * dt; bb.ph += dt * 2;
                    bb.x += Math.sin(bb.ph) * 12 * dt;
                    if (bb.y < g.H * 0.1) {
                        S.bubs.splice(b, 1);
                        if (bb.v) { S.lamps++; k.hit(5, bb.x, g.H * 0.14, { text: '✨ ' }); k.emit(bb.x, g.H * 0.1, 14, { colors: [C.goldL, '#fff'] }); }
                        else {
                            S.haze = Math.min(1, S.haze + 0.4);
                            if (k.loseLife(bb.x, g.H * 0.16, plain(bb.label)) <= 0) { k.finish({ lose: true, title: 'ولا يهمك… الاتضاع بيتعلّم بالتدريب', finaleT: 1.2 }); return; }
                        }
                    }
                }
                if (S.active && !S.cur && !S.queue.length && !S.bubs.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'خدمت الكل باتضاع! 🤍', finaleT: 2.2 }); return; }
                    var nx = S.ph + 1;
                    k.after(0.6, function () { k.checkpoint(function () { startPhase(k, nx); }); });
                }
            },
            finale: function (k, dt) { if (k.info.win && Math.random() < dt * 5) k.glyphBurst(rand(0, k.W), rand(k.H * 0.2, k.H * 0.5), 1); },
            down: function (k, p) {
                var g = S.g;
                for (var i = S.bubs.length - 1; i >= 0; i--) {
                    var b = S.bubs[i];
                    if (b.pop) continue;
                    var dx = p.x - b.x, dy = p.y - b.y;
                    if (dx * dx + dy * dy < (g.br + 10) * (g.br + 10)) {
                        b.pop = 0.001;
                        if (b.v) { k.breakCombo(); k.shake(3, 0.2); k.sfx('bad'); k.pop(b.x, b.y - 30, 'دي فضيلة! سيبها تطلع', '#ffe9b8', 15); }
                        else { k.hit(4, b.x, b.y - 26); k.emit(b.x, b.y, 14, { colors: ['#d8d0e8', '#9a8fb5', '#fff'], grav: 120 }); k.sfx('jar'); }
                        k.pdown = false;
                        return;
                    }
                }
                S.lastT = k.rt; S.lx = p.x; S.ly = p.y; S.spd = 0;
                if (S.cur && S.cur.st === 'towel') { S.cur.tmin = p.x; S.cur.tmax = p.x; }
            },
            move: function (k, p) {
                if (!k.pdown) return;
                var dtm = clamp(k.rt - S.lastT, 1 / 240, 0.1), dx = p.x - S.lx, dy = p.y - S.ly;
                S.spd = S.spd * 0.6 + Math.sqrt(dx * dx + dy * dy) / dtm * 0.4;
                S.lastT = k.rt; S.lx = p.x; S.ly = p.y;
                rubAt(k, p, dtm); towelAt(k, p);
            },
            key: function (k, key, isDown) { if (key === ' ') { S.keyHold = isDown; return true; } return false; },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, c = S.cur;
                blit(ctx, S.ph >= 2 ? S.church : S.room, 0, 0);
                var lampX = S.ph >= 2 ? [0.2, 0.5, 0.8] : [0.3, 0.62];
                for (var l = 0; l < lampX.length; l++) {
                    var lx = W * lampX[l], ly = H * 0.1 + Math.sin(t * 1.2 + l) * 2;
                    ctx.strokeStyle = 'rgba(30,15,5,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 6); ctx.stroke();
                    ctx.fillStyle = C.goldD; ctx.beginPath(); ctx.ellipse(lx, ly, 10, 4.5, 0, 0, Math.PI); ctx.fill();
                    flame(ctx, lx, ly - 3, 3.6 + (l < S.lamps ? 1.5 : 0), t + l * 2);
                }
                if (S.ph >= 2) figure(ctx, { x: W * 0.12, y: H * 0.62, h: H * 0.34, dir: 1, robe: '#fbf7ec', mantle: '#8e1f1f', hair: '#111', beard: 1, beardColor: '#444', arm: 1.6, prop: 'staff', t: t, dpr: k.dpr });
                if (S.haze > 0.01) {
                    var hg = ctx.createLinearGradient(0, 0, 0, H * 0.35);
                    hg.addColorStop(0, 'rgba(40,30,50,' + 0.7 * S.haze + ')'); hg.addColorStop(1, 'rgba(40,30,50,0)');
                    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H * 0.35);
                }
                if (c) {
                    var off = seated(k, ctx, g, c, t);
                    ctx.save(); ctx.translate(off, 0); basin(ctx, g, true, t); ctx.restore();
                    feet(k, ctx, g, c, off);
                    ctx.save(); ctx.translate(off, 0); basin(ctx, g, false, t); ctx.restore();
                    if (c.q.name) chip(ctx, c.q.name, g.cx + off, g.by - 200 * g.sc, clamp(H * 0.04, 11, 15), 'rgba(40,14,6,0.75)', '#ffe9b8', C.gold);
                    if (c.st === 'peter' && peter[c.pi]) {
                        var pl = peter[c.pi], pa = clamp(c.pt / 0.3, 0, 1) * clamp((2.8 - c.pt) / 0.3, 0, 1);
                        speech(ctx, pl.t, g.cx + (c.pi % 2 ? -g.W * 0.18 : 0), c.pi % 2 ? H * 0.5 : g.by - 190 * g.sc, Math.min(W * 0.46, 330), clamp(H * 0.045, 12, 16), W, pa, pl.who);
                    }
                    if (c.st === 'wash' || c.st === 'towel') {
                        var cx = W * 0.07, ch = H * 0.28 * clamp(1 - c.t / c.T, 0, 1), cb = H * 0.62;
                        ctx.fillStyle = '#6b4220'; ctx.fillRect(cx - 10, cb, 20, 6);
                        ctx.fillStyle = '#f6ecd0'; ctx.fillRect(cx - 5, cb - ch, 10, ch);
                        flame(ctx, cx, cb - ch - 4, 4.5, t);
                    }
                    if (c.st === 'towel') {
                        var tw = g.cx + Math.sin(t * 3) * 30 * g.fs, tyy = g.by - 30 * g.fs;
                        ctx.fillStyle = '#fbf7ec'; rr(ctx, tw - 18, tyy - 8, 36, 16, 3); ctx.fill(); ctx.strokeStyle = C.red; ctx.lineWidth = 1; ctx.stroke();
                        ctx.fillStyle = C.red; ctx.fillRect(tw - 18, tyy + 3, 36, 2);
                        txt(ctx, 'اسحب الفوطة ↔', g.cx, g.by - 48 * g.fs, font(15, 900), '#fff', 'center', 4);
                    } else if (c.st === 'wash' && S.ph === 0 && S.di === 1 && c.t < 5) txt(ctx, 'امسح بالراحة 👆', g.cx, g.by - 48 * g.fs, font(15, 900), '#fff', 'center', 4);
                }
                for (var b = 0; b < S.bubs.length; b++) {
                    var bb = S.bubs[b], r = g.br * (1 + (bb.pop ? eo(bb.pop) * 0.5 : 0)), a = bb.pop ? 1 - bb.pop : 1;
                    ctx.save(); ctx.globalAlpha = a;
                    var gr = ctx.createRadialGradient(bb.x - r * 0.3, bb.y - r * 0.3, r * 0.1, bb.x, bb.y, r);
                    if (bb.v) { gr.addColorStop(0, 'rgba(255,248,210,0.95)'); gr.addColorStop(1, 'rgba(226,179,77,0.75)'); }
                    else { gr.addColorStop(0, 'rgba(230,225,245,0.85)'); gr.addColorStop(1, 'rgba(110,95,140,0.7)'); }
                    ctx.fillStyle = gr; ctx.beginPath(); circ(ctx, bb.x, bb.y, r); ctx.fill();
                    ctx.strokeStyle = bb.v ? C.goldD : 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ell(ctx, bb.x - r * 0.35, bb.y - r * 0.4, r * 0.22, r * 0.12); ctx.fill();
                    if (bb.v) drawCross(ctx, bb.x, bb.y - r * 0.45, 6, C.red, k.dpr);
                    block(ctx, bb.label, bb.x, bb.y + 2, r * 1.8, r * 1.2, clamp(r * 0.36, 10, 14), 900, bb.v ? '#5b3212' : '#2a1a3a', 2);
                    ctx.restore();
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 4. widowGift -- the widow's two mites (Mark 12) / the widow of Zarephath
     * Drag the treasury chest left and right. Catch gifts given from the heart
     * (gold hearts); dodge the show-off gifts that come with a trumpet (a life each).
     * Phase 1: the temple treasury; the widow drops two mites (big bonus).
     * Phase 2: Zarephath -- the jar of flour and cruse of oil widens the chest.
     * Phase 3 (twist): from all the heart -- wind gusts, faster, mites again.
     * Data: heart, showoff, mites {label, note}, jar, questions, intro, outro,
     * facts, phases.
     * ==================================================================== */
    L1_ARCADE.widowGift = function (host, data, api) {
        data = data || {};
        var heart = strList(data.heart), show = strList(data.showoff), mites = lines2(data.mites);
        if (!heart.length) heart = ['❤️'];
        if (!show.length) show = ['📯'];
        var PH = [
            { n: 14, good: 9, gap: 1.5, fall: 3.3, wind: 0, sp: 'mites' },
            { n: 16, good: 10, gap: 1.25, fall: 2.8, wind: 0, sp: 'jar' },
            { n: 20, good: 13, gap: 1.05, fall: 2.5, wind: 1, sp: 'mites' }
        ];
        var S = { ph: -1, active: false, plan: [], planT: 0, items: [], bx: 0, btx: 0, wide: 0, kdir: 0, throwers: [], love: 0, mitesGot: 0 };

        function G(k) {
            var W = k.W, H = k.H;
            return { W: W, H: H, boxY: H * 0.82, bw0: clamp(W * 0.14, 70, 130), bh: clamp(H * 0.12, 30, 50), gal: H * 0.2, r: clamp(H * 0.05, 14, 24) };
        }
        function bw() { return S.g.bw0 * (S.wide > 0 ? 1.6 : 1); }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            if (!S.bx) { S.bx = W / 2; S.btx = W / 2; }
            S.temple = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#8fc3e6', '#f3e6c4']); x.fillRect(0, 0, W, H);
                x.fillStyle = '#e9d9b0'; x.fillRect(W * 0.3, H * 0.02, W * 0.4, g.gal);
                x.fillStyle = C.gold; x.fillRect(W * 0.44, H * 0.06, W * 0.12, g.gal - H * 0.04);
                x.strokeStyle = C.goldD; x.lineWidth = 2; x.strokeRect(W * 0.44, H * 0.06, W * 0.12, g.gal - H * 0.04);
                x.fillStyle = '#d8c79c';
                for (var c = 0; c < 9; c++) { var cx = W * (0.05 + c * 0.1125); x.fillRect(cx - 7, g.gal, 14, H * 0.62); x.fillRect(cx - 11, g.gal, 22, 6); x.fillRect(cx - 11, g.gal + H * 0.6, 22, 8); }
                x.fillStyle = '#c9b487'; x.fillRect(0, g.gal - 6, W, 10);
                var fr = friezeSprite(10, k.dpr, C.goldD, 'rgba(0,0,0,0)'); blitTiled(x, fr, 0, g.gal + 5, W);
                x.fillStyle = vgrad(x, H * 0.8, H, ['#d8c79c', '#b8a07a']); x.fillRect(0, H * 0.8, W, H * 0.2);
                x.strokeStyle = 'rgba(90,70,40,0.25)'; x.lineWidth = 1;
                for (var t = 0; t < W; t += 40) { x.beginPath(); x.moveTo(t, H * 0.8); x.lineTo(t - 30, H); x.stroke(); }
            });
            S.zare = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#e0b27a', '#f1d7a8']); x.fillRect(0, 0, W, H);
                x.fillStyle = '#c49a5a'; ridge(x, W, H * 0.55, H * 0.1, 17, 3, H); x.fill();
                x.fillStyle = '#b8855a'; x.fillRect(W * 0.66, H * 0.34, W * 0.2, H * 0.3);
                x.fillStyle = '#9c6b4a'; x.fillRect(W * 0.64, H * 0.32, W * 0.24, H * 0.04);
                x.fillStyle = '#4a2c1a'; x.fillRect(W * 0.73, H * 0.46, W * 0.05, H * 0.18);
                x.strokeStyle = '#6b4a2a'; x.lineWidth = 4; x.lineCap = 'round';
                x.beginPath(); x.moveTo(W * 0.2, H * 0.66); x.lineTo(W * 0.21, H * 0.4); x.moveTo(W * 0.21, H * 0.5); x.lineTo(W * 0.15, H * 0.42); x.moveTo(W * 0.21, H * 0.46); x.lineTo(W * 0.27, H * 0.38); x.stroke();
                x.fillStyle = vgrad(x, H * 0.64, H, ['#d9b27a', '#b88a52']); x.fillRect(0, H * 0.64, W, H * 0.36);
                x.strokeStyle = 'rgba(90,60,30,0.3)'; x.lineWidth = 1;
                for (var cr = 0; cr < 14; cr++) { var a = (cr * 131) % W, b = H * 0.7 + (cr * 37) % (H * 0.25); x.beginPath(); x.moveTo(a, b); x.lineTo(a + 14, b + 5); x.lineTo(a + 22, b + 1); x.stroke(); }
            });
        }
        function startPhase(k, n) {
            var P = PH[n];
            S.ph = n; S.active = false;
            var plan = shuffle(rep(P.good, 'g').concat(rep(P.n - P.good, 'b')));
            plan.splice(Math.floor(plan.length * 0.6), 0, P.sp);
            S.plan = plan; S.planT = 0.4;
            k.phaseCard(n + 1);
            k.after(1.3, function () { k.fact(5.5); });
            k.after(2.6, function () { S.active = true; });
        }
        function spawn(k, type) {
            var g = S.g, P = PH[S.ph], W = g.W, m = g.r * 2 + 6, x, tries = 0;
            if (type === 'b') x = Math.random() < 0.55 ? clamp(S.bx + rand(-bw() * 0.4, bw() * 0.4), m, W - m) : rand(m, W - m);
            else { do { x = rand(m, W - m); tries++; } while (Math.abs(x - S.bx) < W * 0.22 && tries < 20); }
            var vy = (g.boxY - g.gal) / P.fall;
            if (type === 'mites') {
                for (var i = 0; i < 2; i++) S.items.push({ type: 'mite', x: clamp(x + (i ? 16 : -16), m, W - m), y: g.gal + 4, vy: vy * 0.62, r: g.r * 0.5, t: 0, st: 'fall' });
                S.throwers.push({ x: x, t: 0, robe: '#2b2238', widow: true });
                k.sfx('coin');
                return;
            }
            var label = type === 'g' ? pick(heart) : type === 'b' ? pick(show) : plain(data.jar || '');
            S.items.push({ type: type, x: x, y: g.gal + 4, vy: vy * (type === 'jar' ? 0.8 : 1), r: g.r, t: 0, st: 'fall', label: label, rot: rand(-0.3, 0.3) });
            S.throwers.push({ x: x, t: 0, robe: type === 'b' ? '#8e1f1f' : '#3b5f86', rich: type === 'b' });
            if (type === 'b') k.sfx('horn');
        }
        function catchIt(k, it) {
            var g = S.g;
            it.st = 'caught'; it.t = 0;
            if (it.type === 'g') {
                S.love++;
                k.hit(6, it.x, g.boxY - 30, { text: '❤️ ' });
                k.emit(it.x, g.boxY, 12, { colors: ['#ff8fa3', C.goldL, '#fff'], up: 60 });
            } else if (it.type === 'mite') {
                S.mitesGot++; S.love += 2;
                k.hit(12, it.x, g.boxY - 36, { text: '🪙 ' });
                k.glyphBurst(it.x, g.boxY - 20, 5);
                if (S.mitesGot % 2 === 0) {
                    k.freeze(0.12); k.flash('255,230,150', 0.35); k.sfx('power');
                    if (mites.note) k.pop(g.W / 2, g.H * 0.42, plain(mites.note), C.goldL, 20);
                }
            } else if (it.type === 'jar') {
                S.wide = 8;
                k.hit(5, it.x, g.boxY - 30, { text: '🫙 ' }); k.sfx('power');
                k.pop(g.W / 2, g.H * 0.42, 'الصندوق كبر!', '#bfe8ff', 18);
            } else {
                k.emit(it.x, g.boxY, 12, { colors: ['#8a7a6a', '#5a4a3a'], grav: 400 });
                if (k.loseLife(it.x, g.boxY - 40, 'مش ده العطاء!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… ادّي من قلبك المرة الجاية', finaleT: 1.2 }); return; }
            }
        }
        function drawItem(k, ctx, it, t) {
            var a = it.st === 'caught' ? 1 - clamp(it.t / 0.3, 0, 1) : it.st === 'miss' ? 1 - clamp(it.t / 0.6, 0, 1) : 1;
            if (a <= 0) return;
            ctx.save(); ctx.globalAlpha = a;
            var x = it.x, y = it.y, r = it.r;
            if (it.type === 'g') {
                ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + x) * 0.15);
                var gr = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.8); gr.addColorStop(0, 'rgba(255,220,140,0.6)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
                ctx.fillStyle = gr; ctx.beginPath(); circ(ctx, 0, 0, r * 1.8); ctx.fill();
                heartPath(ctx, 0, 0, r * 1.05); ctx.fillStyle = '#e0443a'; ctx.fill(); ctx.strokeStyle = C.goldL; ctx.lineWidth = 2; ctx.stroke();
                ctx.restore();
                chip(ctx, it.label, x, y + r * 1.25, 11, 'rgba(251,241,216,0.95)', '#1d5a2c', C.gold);
            } else if (it.type === 'b') {
                ctx.save(); ctx.translate(x, y); ctx.rotate(it.rot);
                ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.7); ctx.quadraticCurveTo(-r, -r * 0.2, -r * 0.35, -r * 0.55); ctx.lineTo(r * 0.35, -r * 0.55); ctx.quadraticCurveTo(r, -r * 0.2, r * 0.8, r * 0.7); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = '#c9a36a'; ctx.fillRect(-r * 0.4, -r * 0.7, r * 0.8, r * 0.2);
                ctx.restore();
                emo(ctx, '📯', x + r * 0.9, y - r * 0.7, r * 0.9);
                chip(ctx, it.label, x, y + r * 1.2, 11, 'rgba(90,20,10,0.88)', '#ffd0c0');
            } else if (it.type === 'mite') {
                var gl = ctx.createRadialGradient(x, y, 1, x, y, r * 3); gl.addColorStop(0, 'rgba(255,230,160,0.8)'); gl.addColorStop(1, 'rgba(255,230,160,0)');
                ctx.fillStyle = gl; ctx.beginPath(); circ(ctx, x, y, r * 3); ctx.fill();
                coin(ctx, x, y, r, '#c07a3a', '#7a4a1e');
                if (mites.label) txt(ctx, plain(mites.label), x, y - r * 2.4, font(11, 900), C.goldL, 'center', 3);
            } else {
                ctx.fillStyle = '#b8683a'; ctx.beginPath(); ell(ctx, x, y, r * 0.8, r); ctx.fill();
                ctx.fillStyle = '#8a4a24'; ctx.fillRect(x - r * 0.4, y - r * 1.15, r * 0.8, r * 0.3);
                ctx.fillStyle = '#f1d27a'; ctx.beginPath(); ctx.moveTo(x + r, y - r); ctx.quadraticCurveTo(x + r * 1.4, y - r * 0.4, x + r, y - r * 0.2); ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.4, x + r, y - r); ctx.fill();
                if (it.label) chip(ctx, it.label, x, y + r * 1.4, 11, 'rgba(251,241,216,0.95)', '#1d5a2c', C.gold);
            }
            ctx.restore();
        }

        var total = { g: 0, m: 0 };
        PH.forEach(function (P) { total.g += P.good; if (P.sp === 'mites') total.m += 2; });
        var k = createCore(host, data, api, {
            title: 'فلسين الأرملة', icon: '🪙',
            howto: { kind: 'drag', text: 'حرّك صندوق الخزانة يمين وشمال. امسك العطايا اللي من القلب ❤️ وابعد عن العطايا اللي بالبوق 📯 علشان الناس تشوف.' },
            comboStep: 4, maxMult: 3, pad: [146.8, 196, 246.9], lives: 3, factY: 0.24,
            rawMax: function (k) { return perfectSeq(k, rep(total.g, 6).concat(rep(total.m, 12), [5])) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); S.bx = clamp(S.bx, 0, k.W); S.btx = clamp(S.btx, 0, k.W); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.wide = Math.max(S.wide, 7); return '📦 الصندوق كبر شوية'; },
            update: function (k, dt) {
                var g = S.g, P = PH[Math.floor(clamp(S.ph, 0, 2))], W = g.W;
                if (S.wide > 0) S.wide -= dt;
                if (S.kdir) S.btx = clamp(S.btx + S.kdir * W * 0.9 * dt, bw() / 2, W - bw() / 2);
                S.bx += (S.btx - S.bx) * Math.min(1, dt * 14);
                if (S.active && S.plan.length) {
                    S.planT -= dt;
                    if (S.planT <= 0) { spawn(k, S.plan.shift()); S.planT = P.gap * rand(0.85, 1.15); }
                }
                var wind = P.wind ? Math.sin(k.t * 0.8) * W * 0.07 : 0, top = g.boxY - g.bh * 0.5;
                for (var i = S.items.length - 1; i >= 0; i--) {
                    var it = S.items[i];
                    it.t += dt;
                    if (it.st === 'fall') {
                        it.y += it.vy * dt; it.x = clamp(it.x + wind * dt, it.r, W - it.r);
                        if (it.y + it.r * 0.6 >= top && it.y < top + g.bh * 0.6 && Math.abs(it.x - S.bx) < bw() / 2 + it.r * (it.type === 'b' ? 0.2 : 0.7)) { catchIt(k, it); if (k.state !== 'play') return; }
                        else if (it.y > g.H + it.r) {
                            it.st = 'miss'; it.t = 0;
                            if (it.type === 'g' || it.type === 'mite') k.breakCombo();
                        }
                    } else if (it.t > 0.6) S.items.splice(i, 1);
                }
                for (var t2 = S.throwers.length - 1; t2 >= 0; t2--) { S.throwers[t2].t += dt; if (S.throwers[t2].t > 1.2) S.throwers.splice(t2, 1); }
                if (S.active && !S.plan.length && !S.items.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'الخزانة اتملت محبة! ❤️', finaleT: 2.2 }); return; }
                    var nx = S.ph + 1;
                    k.after(0.6, function () { k.checkpoint(function () { startPhase(k, nx); }); });
                }
            },
            finale: function (k, dt) { if (k.info.win && Math.random() < dt * 8) k.emit(S.bx + rand(-30, 30), S.g.boxY - 20, 2, { colors: ['#ff8fa3', C.goldL], grav: -40, up: 60 }); },
            down: function (k, p) { S.btx = clamp(p.x, bw() / 2, k.W - bw() / 2); },
            move: function (k, p) { if (k.pdown) S.btx = clamp(p.x, bw() / 2, k.W - bw() / 2); },
            key: function (k, key, isDown) {
                if (key === 'ArrowLeft') { S.kdir = isDown ? -1 : (S.kdir === -1 ? 0 : S.kdir); return true; }
                if (key === 'ArrowRight') { S.kdir = isDown ? 1 : (S.kdir === 1 ? 0 : S.kdir); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, zar = S.ph >= 1 && S.ph < 2;
                blit(ctx, zar ? S.zare : S.temple, 0, 0);
                if (zar) {
                    figure(ctx, { x: W * 0.9, y: H * 0.66, h: H * 0.3, dir: -1, robe: '#e9dcc0', mantle: '#6b4220', hair: '#5a4a38', beard: 1, halo: true, prop: 'staff', t: t, dpr: k.dpr });
                    var wf = { x: W * 0.6, y: H * 0.66, h: H * 0.26, dir: 1, robe: '#2b2238', mantle: '#4a3a5a', hair: '#2b1a0e', arm: 1 + Math.sin(t) * 0.2, t: t, dpr: k.dpr };
                    figure(ctx, wf); veil(ctx, wf, '#3a2e48');
                } else {
                    ctx.fillStyle = 'rgba(255,240,200,' + (0.1 + 0.05 * Math.sin(t)) + ')'; ctx.fillRect(W * 0.44, H * 0.06, W * 0.12, g.gal - H * 0.04);
                }
                for (var th = 0; th < S.throwers.length; th++) {
                    var tr = S.throwers[th], ta = clamp(tr.t < 0.2 ? tr.t / 0.2 : (1.2 - tr.t) / 0.4, 0, 1);
                    ctx.save(); ctx.globalAlpha = ta;
                    tinyPerson(ctx, tr.x, g.gal - 2, H * 0.12, tr.robe, tr.widow ? '#3a2e48' : '#2a1a0e', -1, 0);
                    if (tr.rich) { ctx.fillStyle = C.gold; ctx.fillRect(tr.x - 6, g.gal - H * 0.07, 12, 2); }
                    ctx.restore();
                }
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, g.gal - 2, W, 3);
                for (var i = 0; i < S.items.length; i++) drawItem(k, ctx, S.items[i], t);
                // treasury chest
                var w = bw(), x = S.bx, y = g.boxY, h = g.bh;
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ell(ctx, x, y + h * 0.62, w * 0.55, 6); ctx.fill();
                var glow = clamp(S.love / 20, 0, 1);
                if (glow > 0) { var gg = ctx.createRadialGradient(x, y - h * 0.4, 4, x, y - h * 0.4, w * 0.8); gg.addColorStop(0, 'rgba(255,220,140,' + 0.5 * glow + ')'); gg.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = gg; ctx.beginPath(); circ(ctx, x, y - h * 0.4, w * 0.8); ctx.fill(); }
                ctx.fillStyle = vgrad(ctx, y - h / 2, y + h / 2, ['#9c6a35', '#6e4521']);
                ctx.beginPath(); ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x + w / 2, y - h / 2); ctx.lineTo(x + w * 0.44, y + h / 2); ctx.lineTo(x - w * 0.44, y + h / 2); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = '#1a0e06'; rr(ctx, x - w * 0.42, y - h / 2 - 3, w * 0.84, 7, 3); ctx.fill();
                ctx.fillStyle = C.gold; ctx.fillRect(x - w / 2, y - h * 0.18, w, 3); ctx.fillRect(x - w * 0.46, y + h * 0.22, w * 0.92, 3);
                drawCross(ctx, x, y + 2, clamp(h * 0.26, 7, 13), C.goldL, k.dpr);
                for (var hh = 0; hh < Math.min(8, S.love); hh++) { heartPath(ctx, x - w * 0.35 + (hh % 4) * w * 0.23, y - h / 2 - 6 - Math.floor(hh / 4) * 8 + Math.sin(t * 3 + hh) * 1.5, 5); ctx.fillStyle = '#ff6b7a'; ctx.fill(); }
                if (S.wide > 0) { ctx.strokeStyle = 'rgba(191,232,255,' + (0.5 + 0.5 * Math.sin(t * 10)) + ')'; ctx.lineWidth = 2; rr(ctx, x - w / 2 - 4, y - h / 2 - 6, w + 8, h + 10, 8); ctx.stroke(); }
                if (S.ph === 0 && S.active && k.t < 9) txt(ctx, '👈 اسحب الصندوق 👉', W / 2, H * 0.62, font(15, 900), '#fff', 'center', 4);
                if (PH[Math.floor(clamp(S.ph, 0, 2))].wind && S.active) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
                    var wdir = Math.sin(k.t * 0.8);
                    for (var wl = 0; wl < 6; wl++) { var wx = ((wl * 0.19 + t * 0.3 * wdir) % 1 + 1) % 1 * W, wy = H * (0.3 + wl * 0.08); ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 26 * wdir, wy); ctx.stroke(); }
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 5. everywhere -- «جال يصنع خيرًا» (Acts 10:38)
     * Draw a path with your finger (or tap a spot); the young servant walks it.
     * People with a need appear around each place (home, school, church, club,
     * street) with a timer; reach them in time to do good (missing one costs a
     * heart). Phase 1: morning (2 places). Phase 2: afternoon (2 places).
     * Phase 3 (twist): the street at night -- only the servant's lamp lights the
     * way («فليضئ نوركم»). Data: places [{name, art, needs:[{t, e}]}], questions,
     * intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.everywhere = function (host, data, api) {
        data = data || {};
        var places = (data.places || []).filter(function (p) { return p && p.name; });
        if (!places.length) places = [{ name: '', art: 'home', needs: [] }];
        var ARTS = ['home', 'school', 'church', 'club', 'street'];
        var PHP = [[0, 1], [2, 3], [4]];
        var PH = [{ L: 9, max: 2, gap: 2.0, n: 6 }, { L: 8, max: 3, gap: 1.7, n: 7 }, { L: 8.5, max: 3, gap: 1.5, n: 11 }];
        var ROBES = ['#b5543a', '#3b5f86', '#7c8a3a', '#6b4a7a', '#8a5a2b', '#2e7d6b', '#c0392b'];
        var S = { ph: -1, pi: 0, place: null, plist: [], need: [], left: 0, spawnT: 0, sx: 0, sy: 0, path: [], walk: 0, dir: -1, active: false, art: {}, banner: null, lamp: 1, dark: null, id: 0 };
        var TOT = PH[0].n * 2 + PH[1].n * 2 + PH[2].n;

        function G(k) { var W = k.W, H = k.H; return { W: W, H: H, top: H * 0.5, bot: H * 0.94, u: clamp(H / 330, 0.5, 1.5), fh: clamp(H * 0.2, 50, 90), V: clamp(W * 0.3, 150, 330) }; }
        function placeAt(i) { var p = places[i % places.length]; return { name: p.name, art: ARTS.indexOf(p.art) >= 0 ? p.art : ARTS[i % 5], needs: (p.needs || []).filter(function (n) { return n && n.t; }) }; }
        function art(k, key) {
            if (S.art[key]) return S.art[key];
            var g = S.g, W = g.W, H = g.H;
            var c = layer(W, H, k.dpr, function (x) {
                var r = seeded(key.length * 7 + 3), i;
                if (key === 'home') {
                    x.fillStyle = vgrad(x, 0, g.top, ['#f3e2c0', '#e6cfa4']); x.fillRect(0, 0, W, g.top);
                    x.fillStyle = '#9fd0f0'; rr(x, W * 0.62, H * 0.08, W * 0.2, H * 0.26, 6); x.fill(); x.strokeStyle = '#8a5a2b'; x.lineWidth = 5; x.stroke();
                    x.beginPath(); x.moveTo(W * 0.72, H * 0.08); x.lineTo(W * 0.72, H * 0.34); x.moveTo(W * 0.62, H * 0.21); x.lineTo(W * 0.82, H * 0.21); x.lineWidth = 3; x.stroke();
                    x.fillStyle = '#e9c98f'; rr(x, W * 0.2, H * 0.1, W * 0.1, H * 0.14, 3); x.fill(); x.strokeStyle = C.gold; x.lineWidth = 3; x.stroke();
                    halo(x, W * 0.25, H * 0.15, H * 0.03, k.dpr); x.fillStyle = '#8e1f1f'; x.fillRect(W * 0.235, H * 0.18, W * 0.03, H * 0.05);
                    x.fillStyle = '#7a4a1e'; rr(x, W * 0.05, g.top - H * 0.1, W * 0.26, H * 0.12, 8); x.fill();
                    x.fillStyle = '#a0522d'; rr(x, W * 0.06, g.top - H * 0.16, W * 0.24, H * 0.08, 8); x.fill();
                    x.fillStyle = vgrad(x, g.top, H, ['#c9a36a', '#a47b48']); x.fillRect(0, g.top, W, H - g.top);
                    x.fillStyle = 'rgba(142,31,31,0.35)'; rr(x, W * 0.3, g.top + H * 0.12, W * 0.4, H * 0.22, 8); x.fill();
                    var fr = friezeSprite(10, k.dpr, C.gold, 'rgba(0,0,0,0)'); x.save(); x.beginPath(); x.rect(W * 0.31, g.top + H * 0.13, W * 0.38, 10); x.clip(); blitTiled(x, fr, 0, g.top + H * 0.13, W); x.restore();
                } else if (key === 'school') {
                    x.fillStyle = vgrad(x, 0, g.top, ['#e8efe0', '#d5e0c8']); x.fillRect(0, 0, W, g.top);
                    x.fillStyle = '#2e4a3a'; rr(x, W * 0.25, H * 0.08, W * 0.5, H * 0.26, 4); x.fill(); x.strokeStyle = '#8a5a2b'; x.lineWidth = 6; x.stroke();
                    x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 2;
                    for (i = 0; i < 4; i++) { x.beginPath(); x.moveTo(W * 0.3, H * (0.14 + i * 0.05)); x.lineTo(W * (0.45 + r() * 0.25), H * (0.14 + i * 0.05)); x.stroke(); }
                    x.fillStyle = vgrad(x, g.top, H, ['#d9cdb8', '#bfb09a']); x.fillRect(0, g.top, W, H - g.top);
                    for (i = 0; i < 4; i++) { x.fillStyle = '#8a5a2b'; x.fillRect(W * (0.08 + i * 0.24), g.top - H * 0.06, W * 0.14, H * 0.05); x.fillRect(W * (0.08 + i * 0.24) + 4, g.top - H * 0.01, 4, H * 0.04); }
                } else if (key === 'church') {
                    x.fillStyle = vgrad(x, 0, g.top, ['#5c2a18', '#7a3a20']); x.fillRect(0, 0, W, g.top);
                    for (i = 0; i < 5; i++) {
                        var cx = W * (0.14 + i * 0.18), aw = W * 0.08;
                        x.fillStyle = ['#1f6fa3', '#b83a2a', '#e2b34d', '#6f8a3a', '#5d3fa6'][i];
                        x.beginPath(); x.moveTo(cx - aw / 2, H * 0.36); x.lineTo(cx - aw / 2, H * 0.12); x.arc(cx, H * 0.12, aw / 2, Math.PI, TAU); x.lineTo(cx + aw / 2, H * 0.36); x.closePath(); x.fill();
                        x.strokeStyle = C.gold; x.lineWidth = 3; x.stroke();
                        copticCross(x, cx, H * 0.18, aw * 0.25, C.goldL, C.goldD, 1);
                    }
                    x.fillStyle = vgrad(x, g.top, H, ['#d9cdb8', '#a89478']); x.fillRect(0, g.top, W, H - g.top);
                    for (i = 0; i < 3; i++) { x.fillStyle = '#6b4220'; x.fillRect(W * 0.05, g.top + H * (0.06 + i * 0.12), W * 0.2, 7); x.fillRect(W * 0.75, g.top + H * (0.06 + i * 0.12), W * 0.2, 7); }
                } else if (key === 'club') {
                    x.fillStyle = vgrad(x, 0, g.top, ['#8fc3e6', '#d8ecf5']); x.fillRect(0, 0, W, g.top);
                    for (i = 0; i < 6; i++) { x.fillStyle = '#3f6a2a'; x.beginPath(); circ(x, W * (0.06 + i * 0.18), g.top - H * 0.1, H * 0.09); x.fill(); x.fillStyle = '#6b4a2a'; x.fillRect(W * (0.06 + i * 0.18) - 3, g.top - H * 0.05, 6, H * 0.05); }
                    x.strokeStyle = 'rgba(80,80,80,0.5)'; x.lineWidth = 1; for (i = 0; i < W; i += 12) { x.beginPath(); x.moveTo(i, g.top - H * 0.06); x.lineTo(i, g.top); x.stroke(); }
                    x.fillStyle = vgrad(x, g.top, H, ['#5fa84a', '#3f8a32']); x.fillRect(0, g.top, W, H - g.top);
                    x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 2; x.strokeRect(W * 0.05, g.top + 6, W * 0.9, H - g.top - 14);
                    x.beginPath(); x.moveTo(W / 2, g.top + 6); x.lineTo(W / 2, H - 8); x.stroke(); x.beginPath(); x.arc(W / 2, (g.top + H) / 2, H * 0.08, 0, TAU); x.stroke();
                } else {
                    x.fillStyle = vgrad(x, 0, g.top, ['#0d1433', '#27336b']); x.fillRect(0, 0, W, g.top);
                    for (i = 0; i < 7; i++) {
                        var bx = W * i / 7, bw = W / 7 - 6, bh = H * (0.25 + r() * 0.2);
                        x.fillStyle = ['#3a2e48', '#2e2a40', '#443650'][i % 3]; x.fillRect(bx, g.top - bh, bw, bh);
                        for (var wy = g.top - bh + 10; wy < g.top - 14; wy += 22) for (var wx = bx + 6; wx < bx + bw - 10; wx += 18) { x.fillStyle = r() > 0.45 ? '#ffd27a' : '#1a1428'; x.fillRect(wx, wy, 9, 11); }
                        if (i === 3) copticCross(x, bx + bw / 2, g.top - bh - 10, 9, C.goldL, C.goldD, 1);
                    }
                    x.fillStyle = vgrad(x, g.top, H, ['#6b6570', '#4a4550']); x.fillRect(0, g.top, W, H - g.top);
                    x.fillStyle = '#8a8490'; x.fillRect(0, g.top, W, H * 0.05);
                    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 3; x.setLineDash && x.setLineDash([20, 18]);
                    x.beginPath(); x.moveTo(0, g.top + (H - g.top) * 0.6); x.lineTo(W, g.top + (H - g.top) * 0.6); x.stroke(); x.setLineDash && x.setLineDash([]);
                    for (i = 0; i < 3; i++) { x.fillStyle = '#2a2530'; x.fillRect(W * (0.18 + i * 0.32), g.top - H * 0.2, 4, H * 0.22); }
                }
            });
            S.art[key] = c;
            return c;
        }
        function startPlace(k) {
            var idx = S.plist.shift();
            S.place = placeAt(idx); S.left = PH[S.ph].n; S.spawnT = 1.2;
            S.banner = { name: S.place.name, t: 0 };
            k.sfx('page');
        }
        function startPhase(k, n) {
            S.ph = n; S.active = false; S.plist = PHP[n].slice();
            k.phaseCard(n + 1);
            k.after(1.3, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; startPlace(k); });
        }
        function spawnNeed(k) {
            var g = S.g, P = PH[S.ph], x, y, ok, tries = 0;
            do {
                x = rand(g.W * 0.07, g.W * 0.93); y = rand(g.top + g.fh * 0.7, g.bot - 4); ok = true;
                if (Math.abs(x - S.sx) < 90 && Math.abs(y - S.sy) < 60) ok = false;
                for (var i = 0; i < S.need.length; i++) if (Math.abs(S.need[i].x - x) < 90 && Math.abs(S.need[i].y - y) < 50) ok = false;
                tries++;
            } while (!ok && tries < 25);
            var nl = S.place.needs, nd = nl.length ? nl[Math.floor(Math.random() * nl.length)] : { t: '', e: '🙂' };
            S.need.push({ id: S.id++, x: x, y: y, t: 0, L: P.L, st: 'wait', label: nd.t, e: nd.e || '🙂', robe: ROBES[S.id % ROBES.length], d: 0 });
            S.left--;
            k.sfx('tick');
        }
        function setPath(p, fresh) {
            var g = S.g, x = clamp(p.x, 12, g.W - 12), y = clamp(p.y, g.top + 6, g.bot);
            if (fresh) S.path = [];
            var lp = S.path.length ? S.path[S.path.length - 1] : { x: S.sx, y: S.sy };
            if (!fresh && Math.abs(lp.x - x) + Math.abs(lp.y - y) < 10) return;
            if (S.path.length > 120) S.path.shift();
            S.path.push({ x: x, y: y });
        }

        var k = createCore(host, data, api, {
            title: 'يجول يصنع خيرًا', icon: '👣',
            howto: { kind: 'drag', text: 'ارسم طريق بصباعك (أو اضغط على مكان) والخادم الصغير هيمشي فيه. وصل لكل واحد محتاج قبل ما وقته يخلص!' },
            comboStep: 4, maxMult: 3, pad: [130.8, 164.8, 196], lives: 4, factY: 0.02,
            rawMax: function (k) { return perfectSeq(k, rep(TOT, 10)) + 2 * k.askBonus; },
            init: function (k) { S.g = G(k); S.sx = k.W * 0.5; S.sy = k.H * 0.75; },
            layout: function (k) { S.g = G(k); S.art = {}; S.dark = null; S.sx = clamp(S.sx, 10, k.W - 10); S.sy = clamp(S.sy, S.g.top, S.g.bot); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.lamp = 1.6; for (var i = 0; i < S.need.length; i++) S.need[i].t = Math.max(0, S.need[i].t - 3); return '💡 نورك زاد + وقت زيادة للمحتاجين'; },
            update: function (k, dt) {
                var g = S.g, P = PH[Math.floor(clamp(S.ph, 0, 2))];
                if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.4) S.banner = null; }
                // walk the path
                if (S.path.length) {
                    var pt = S.path[0], dx = pt.x - S.sx, dy = pt.y - S.sy, d = Math.sqrt(dx * dx + dy * dy), st = g.V * dt;
                    if (d <= st) { S.sx = pt.x; S.sy = pt.y; S.path.shift(); }
                    else { S.sx += dx / d * st; S.sy += dy / d * st; if (Math.abs(dx) > 2) S.dir = dx > 0 ? 1 : -1; }
                    S.walk += dt * 10;
                }
                if (S.place && S.active) {
                    var open = 0;
                    for (var i = 0; i < S.need.length; i++) if (S.need[i].st === 'wait') open++;
                    S.spawnT -= dt;
                    if (S.left > 0 && S.spawnT <= 0 && open < P.max) { spawnNeed(k); S.spawnT = P.gap * rand(0.8, 1.2); }
                }
                var rs = clamp(g.fh * 0.45, 22, 40);
                for (var j = S.need.length - 1; j >= 0; j--) {
                    var n = S.need[j];
                    n.t += dt;
                    if (n.st === 'wait') {
                        var ex = n.x - S.sx, ey = n.y - S.sy;
                        if (ex * ex + ey * ey < rs * rs) {
                            n.st = 'done'; n.d = 0;
                            var frac = clamp(1 - n.t / n.L, 0, 1);
                            k.hit(6 + Math.round(4 * frac), n.x, n.y - g.fh * 1.1, { text: frac > 0.6 ? 'بسرعة! ' : '' });
                            k.emit(n.x, n.y - g.fh * 0.6, 16, { colors: ['#ff8fa3', C.goldL, '#9dffb0', '#fff'], up: 70 });
                        } else if (n.t >= n.L) {
                            n.st = 'gone'; n.d = 0;
                            if (k.loseLife(n.x, n.y - g.fh, 'محدش لحقه…') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… الخير محتاج عين صاحية', finaleT: 1.2 }); return; }
                        }
                    } else { n.d += dt; if (n.d > 1) S.need.splice(j, 1); }
                }
                if (S.place && S.active && S.left <= 0 && !S.need.length) {
                    if (S.plist.length) startPlace(k);
                    else {
                        S.active = false; S.place = S.place;
                        if (S.ph >= 2) { k.finish({ title: 'عملت خير في كل مكان! 🌟', finaleT: 2.2 }); return; }
                        var nx = S.ph + 1;
                        k.after(0.6, function () { k.checkpoint(function () { startPhase(k, nx); }); });
                    }
                }
            },
            finale: function (k, dt) { if (k.info.win && Math.random() < dt * 6) k.emit(S.sx + rand(-30, 30), S.sy - S.g.fh, 2, { colors: [C.goldL, '#fff'], grav: -30, up: 40 }); },
            down: function (k, p) { setPath(p, true); },
            move: function (k, p) { if (k.pdown) setPath(p, false); },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
                if (!d) return false;
                setPath({ x: S.sx + d[0] * k.W * 0.12, y: S.sy + d[1] * k.H * 0.12 }, true);
                return true;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, pl = S.place || placeAt(PHP[Math.max(0, Math.floor(S.ph))][0]);
                blit(ctx, art(k, pl.art), 0, 0);
                if (pl.art === 'street') for (var sl = 0; sl < 3; sl++) { var lx = W * (0.18 + sl * 0.32) + 2; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); circ(ctx, lx, g.top - H * 0.2, 6); ctx.fill(); }
                // path
                if (S.path.length) {
                    ctx.strokeStyle = 'rgba(255,240,190,0.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.setLineDash && ctx.setLineDash([8, 8]);
                    ctx.beginPath(); ctx.moveTo(S.sx, S.sy);
                    for (var i = 0; i < S.path.length; i++) ctx.lineTo(S.path[i].x, S.path[i].y);
                    ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
                    var end = S.path[S.path.length - 1]; drawCross(ctx, end.x, end.y, 8, C.gold, k.dpr);
                }
                // needs + servant sorted by y for depth
                var list = S.need.slice().sort(function (a, b) { return a.y - b.y; }), drawn = false;
                for (var j = 0; j <= list.length; j++) {
                    var n = list[j];
                    if (!drawn && (!n || n.y > S.sy)) {
                        drawn = true;
                        figure(ctx, { x: S.sx, y: S.sy, h: g.fh, dir: S.dir, robe: '#f3ead6', mantle: '#1f6fa3', hair: '#2b1a0e', walk: S.path.length ? S.walk : -1, arm: S.path.length ? null : 0.9, t: t, dpr: k.dpr });
                    }
                    if (!n) continue;
                    var a = n.st === 'wait' ? 1 : 1 - clamp(n.d, 0, 1), hop = n.st === 'done' ? Math.sin(clamp(n.d, 0, 1) * Math.PI) * 10 : 0;
                    ctx.save(); ctx.globalAlpha = a;
                    tinyPerson(ctx, n.x, n.y - hop, g.fh * 0.8, n.robe, '#2a1a0e', -1, 0);
                    var by = n.y - g.fh * 1.05, br = clamp(g.fh * 0.22, 12, 20);
                    ctx.fillStyle = 'rgba(251,241,216,0.95)'; ctx.beginPath(); circ(ctx, n.x, by, br); ctx.fill();
                    if (n.st === 'wait') ring(ctx, n.x, by, br + 2, 1 - n.t / n.L, n.t / n.L > 0.7 ? '#e0443a' : '#2e9e5b', 3);
                    emo(ctx, n.st === 'done' ? '💛' : n.e, n.x, by + 1, br * 1.1);
                    if (n.label && n.st === 'wait') chip(ctx, n.label, n.x, by - br - 12, 11, 'rgba(40,14,6,0.78)', '#ffe9b8');
                    ctx.restore();
                }
                // night: only the lamp lights the street
                if (S.ph >= 2 && pl.art === 'street') {
                    if (!S.dark) S.dark = mkCanvas(W, H, k.dpr);
                    var dc = S.dark.getContext('2d');
                    dc.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
                    dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, W, H);
                    dc.fillStyle = 'rgba(4,6,22,0.88)'; dc.fillRect(0, 0, W, H);
                    dc.globalCompositeOperation = 'destination-out';
                    var R = clamp(H * 0.36, 90, 170) * S.lamp;
                    var gr = dc.createRadialGradient(S.sx, S.sy - g.fh * 0.5, R * 0.3, S.sx, S.sy - g.fh * 0.5, R);
                    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
                    dc.fillStyle = gr; dc.beginPath(); circ(dc, S.sx, S.sy - g.fh * 0.5, R); dc.fill();
                    for (var s2 = 0; s2 < 3; s2++) { var lx2 = W * (0.18 + s2 * 0.32), ly2 = g.top - H * 0.2; var g2 = dc.createRadialGradient(lx2, ly2, 2, lx2, ly2, H * 0.12); g2.addColorStop(0, 'rgba(0,0,0,0.9)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g2; dc.beginPath(); circ(dc, lx2, ly2, H * 0.12); dc.fill(); }
                    dc.globalCompositeOperation = 'source-over';
                    ctx.drawImage(S.dark, 0, 0, W, H);
                    for (var q = 0; q < S.need.length; q++) {
                        var nn = S.need[q];
                        if (nn.st !== 'wait') continue;
                        var ddx = nn.x - S.sx, ddy = nn.y - S.sy;
                        if (ddx * ddx + ddy * ddy > R * R * 0.5) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + q); starPath(ctx, nn.x, nn.y - g.fh * 1.05, 7, 0.45); ctx.fillStyle = '#ffe9a8'; ctx.fill(); ctx.globalAlpha = 1; }
                    }
                    flame(ctx, S.sx + S.dir * g.fh * 0.2, S.sy - g.fh * 0.62, 4, t);
                }
                if (S.banner && S.banner.name) {
                    var ba = clamp(S.banner.t / 0.3, 0, 1) * clamp((2.4 - S.banner.t) / 0.4, 0, 1);
                    ctx.save(); ctx.globalAlpha = ba;
                    chip(ctx, '📍 ' + plain(S.banner.name), W / 2, H * 0.44, clamp(H * 0.06, 16, 24), 'rgba(142,31,31,0.92)', '#ffe9b8', C.gold);
                    ctx.restore();
                }
                if (S.ph === 0 && S.active && k.t < 8 && !S.path.length) txt(ctx, 'ارسم طريق بصباعك ✍️', W / 2, H * 0.36, font(16, 900), '#fff', 'center', 4);
            }
        });
        return k.api2();
    };

    /* ======================================================================
     * 6. harvest -- the blessings of true service (John 12:26)
     * Swipe to slash: cut the thorns creeping toward the tree before they reach
     * the trunk (a life each), and harvest the blessing fruits when ripe (glowing)
     * -- or catch them in the air as they fall. Unripe buds must be left alone.
     * Phase 1: the planting. Phase 2: fruit + birds that steal (shoo them).
     * Phase 3 (twist): golden fruit build a ladder to heaven; the finale crown
     * descends («إلى المجد»). Data: blessings, thorns, crown {verse, ref},
     * questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.harvest = function (host, data, api) {
        data = data || {};
        var bless = strList(data.blessings), thornL = strList(data.thorns), crown = lines2(data.crown);
        if (!bless.length) bless = ['🍎'];
        if (!thornL.length) thornL = [''];
        var PH = [
            { th: 8, fr: 6, bi: 0, thGap: 3.0, frGap: 2.8, v: 0.075, gold: false, scale: 0.8 },
            { th: 10, fr: 8, bi: 4, thGap: 2.5, frGap: 2.3, v: 0.09, gold: false, scale: 1 },
            { th: 11, fr: 10, bi: 4, thGap: 2.2, frGap: 1.9, v: 0.1, gold: true, scale: 1 }
        ];
        var S = { ph: -1, active: false, th: [], fr: [], bi: [], left: { th: 0, fr: 0, bi: 0 }, tT: 0, fT: 0, bT: 0, trail: [], lx: 0, ly: 0,
            rungs: 0, basket: 0, crownT: 0, slots: [], scale: 0.8, sway: 0 };

        function G(k) {
            var W = k.W, H = k.H, gy = H * 0.88;
            return { W: W, H: H, gy: gy, tx: W / 2, cy: H * 0.42, R: clamp(H * 0.27, 70, 150), r: clamp(H * 0.055, 16, 26) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.slots = [];
            var rnd = seeded(77);
            for (var i = 0; i < 9; i++) { var a = -Math.PI * 0.95 + i / 8 * Math.PI * 0.9 + (rnd() - 0.5) * 0.15, rr2 = 0.45 + rnd() * 0.45; S.slots.push({ ax: Math.cos(a) * rr2 * 1.35, ay: Math.sin(a) * rr2 * 0.95 + 0.2, busy: false }); }
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, g.gy, ['#7fb8e3', '#cfe6f2', '#fbeccb']); x.fillRect(0, 0, W, g.gy);
                x.fillStyle = 'rgba(120,150,110,0.55)'; ridge(x, W, g.gy - H * 0.14, H * 0.08, 4, 3, g.gy); x.fill();
                // distant monastery: walls, domes, crosses
                var mx = W * 0.82, my = g.gy - H * 0.16;
                x.fillStyle = '#e6dcc4'; x.fillRect(mx - W * 0.08, my - H * 0.06, W * 0.16, H * 0.07);
                for (var d = 0; d < 3; d++) { var dx = mx - W * 0.05 + d * W * 0.05; x.beginPath(); x.arc(dx, my - H * 0.06, H * 0.028, Math.PI, TAU); x.fill(); copticCross(x, dx, my - H * 0.1, 5, C.goldD); }
                x.fillStyle = '#6f9a4a'; ridge(x, W, g.gy - H * 0.05, H * 0.04, 12, 3, g.gy + 2); x.fill();
                x.fillStyle = vgrad(x, g.gy - 4, H, ['#6fae4a', '#4f8a32']); x.fillRect(0, g.gy - 4, W, H);
                var r = seeded(3);
                for (var f = 0; f < 40; f++) { x.fillStyle = ['#fff3cf', '#f7b2c0', '#ffe28a'][f % 3]; x.beginPath(); circ(x, r() * W, g.gy + r() * (H - g.gy), 1.6 + r() * 1.4); x.fill(); }
            });
        }
        function trunkW() { return S.g.R * 0.16 * S.scale; }
        function slotPos(s) { var g = S.g, R = g.R * S.scale; return { x: g.tx + s.ax * R, y: g.cy + (1 - S.scale) * g.R * 0.6 + s.ay * R }; }
        function startPhase(k, n) {
            var P = PH[n];
            S.ph = n; S.active = false;
            S.left = { th: P.th, fr: P.fr, bi: P.bi }; S.tT = 1; S.fT = 0.5; S.bT = 3;
            k.phaseCard(n + 1);
            k.after(1.3, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; });
        }
        function spawnThorn() {
            var g = S.g, side = Math.random() < 0.5 ? -1 : 1, P = PH[S.ph];
            S.th.push({ x0: side < 0 ? -10 : g.W + 10, x: side < 0 ? -10 : g.W + 10, side: side, y: g.gy - rand(2, g.H * 0.05), v: g.W * P.v * rand(0.85, 1.15), label: pick(thornL), st: 'grow', t: 0, ph: rand(0, TAU) });
        }
        function spawnFruit() {
            var free = [];
            for (var i = 0; i < S.slots.length; i++) if (!S.slots[i].busy) free.push(i);
            if (!free.length) return false;
            var si = pick(free);
            S.slots[si].busy = true;
            S.fr.push({ si: si, st: 'bud', g: 0, t: 0, x: 0, y: 0, vy: 0, label: pick(bless), gold: PH[S.ph].gold });
            return true;
        }
        function spawnBird() {
            var g = S.g, side = Math.random() < 0.5 ? -1 : 1;
            S.bi.push({ x: side < 0 ? -30 : g.W + 30, y: g.cy - g.R * rand(0.4, 0.9), side: side, st: 'fly', t: 0, target: null, vx: 0, vy: 0 });
        }
        function releaseSlot(f) { if (S.slots[f.si]) S.slots[f.si].busy = false; }
        function slash(k, x1, y1, x2, y2) {
            var g = S.g, r = g.r, i;
            for (i = 0; i < S.th.length; i++) {
                var th = S.th[i];
                if (th.st === 'grow' && segHit(x1, y1, x2, y2, th.x, th.y - r * 0.5, r * 1.3)) {
                    th.st = 'cut'; th.t = 0;
                    k.hit(4, th.x, th.y - r * 2.2, { text: '✂️ ' });
                    k.emit(th.x, th.y - r * 0.5, 12, { colors: ['#4b6326', '#6f8a3a', '#2e3a1a'], grav: 400 });
                    k.sfx('whoosh');
                }
            }
            for (i = 0; i < S.fr.length; i++) {
                var f = S.fr[i];
                if (f.st !== 'bud' && f.st !== 'ripe' && f.st !== 'fall') continue;
                var p = f.st === 'fall' ? { x: f.x, y: f.y } : slotPos(S.slots[f.si]);
                if (!segHit(x1, y1, x2, y2, p.x, p.y, r * 1.1)) continue;
                if (f.st === 'bud') {
                    if (f.hurt > 0) continue;
                    f.hurt = 0.7; k.breakCombo(); k.pop(p.x, p.y - r * 1.6, 'لسه ما استوتش', '#ffd0c0', 14); k.sfx('tap');
                    continue;
                }
                var air = f.st === 'fall';
                if (f.st === 'ripe') releaseSlot(f);
                f.st = 'picked'; f.t = 0; f.x = p.x; f.y = p.y;
                S.basket++;
                if (f.gold) S.rungs++;
                k.hit((air ? 8 : 6) + (f.gold ? 2 : 0), p.x, p.y - r * 1.8, { text: air ? 'في الهوا! ' : '' });
                k.emit(p.x, p.y, 14, { colors: f.gold ? [C.goldL, C.gold, '#fff'] : ['#ff8fa3', '#e0443a', C.goldL] });
                if (f.gold) k.glyphBurst(p.x, p.y, 3);
            }
            for (i = 0; i < S.bi.length; i++) {
                var b = S.bi[i];
                if ((b.st === 'fly' || b.st === 'eat') && segHit(x1, y1, x2, y2, b.x, b.y, r * 1.2)) {
                    b.st = 'shoo'; b.t = 0; if (b.target) b.target.bird = null;
                    k.hit(3, b.x, b.y - r * 1.5, { text: '🕊️ ' }); k.sfx('whoosh');
                }
            }
        }
        function drawTree(k, ctx, g, t) {
            var sc = S.scale, R = g.R * sc, tw = trunkW(), cy = g.cy + (1 - sc) * g.R * 0.6, sway = Math.sin(t * 0.9) * 2;
            ctx.fillStyle = vgrad(ctx, cy, g.gy, ['#7a4a1e', '#5a3517']);
            ctx.beginPath(); ctx.moveTo(g.tx - tw, g.gy + 2); ctx.quadraticCurveTo(g.tx - tw * 0.6, cy + R * 0.3, g.tx - tw * 0.5, cy); ctx.lineTo(g.tx + tw * 0.5, cy); ctx.quadraticCurveTo(g.tx + tw * 0.6, cy + R * 0.3, g.tx + tw, g.gy + 2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#5a3517'; ctx.lineWidth = tw * 0.35; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(g.tx, cy + R * 0.3); ctx.lineTo(g.tx - R * 0.55, cy - R * 0.2); ctx.moveTo(g.tx, cy + R * 0.2); ctx.lineTo(g.tx + R * 0.6, cy - R * 0.25); ctx.stroke();
            var cols = S.ph >= 2 ? ['#4f8a32', '#6fae4a', '#9cc95a'] : ['#3f6a2a', '#4f8a32', '#6fae4a'];
            var blobs = [[0, -0.35, 0.62], [-0.6, -0.1, 0.5], [0.62, -0.12, 0.5], [-0.3, -0.7, 0.45], [0.35, -0.72, 0.45], [0, 0.1, 0.5], [-0.85, 0.18, 0.35], [0.88, 0.16, 0.35]];
            for (var i = 0; i < blobs.length; i++) {
                var b = blobs[i];
                ctx.fillStyle = cols[i % 3];
                ctx.beginPath(); circ(ctx, g.tx + b[0] * R + sway * (0.5 + b[1]), cy + b[1] * R, b[2] * R); ctx.fill();
            }
            if (S.ph >= 2) { ctx.fillStyle = 'rgba(255,230,150,' + (0.12 + 0.06 * Math.sin(t * 2)) + ')'; ctx.beginPath(); circ(ctx, g.tx, cy - R * 0.2, R * 1.25); ctx.fill(); }
        }
        function fruitArt(ctx, x, y, r, gold, glow, label, t) {
            if (glow) { var gr = ctx.createRadialGradient(x, y, 2, x, y, r * 2); gr.addColorStop(0, gold ? 'rgba(255,230,140,0.8)' : 'rgba(255,200,200,0.6)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); ctx.fillStyle = gr; ctx.beginPath(); circ(ctx, x, y, r * 2); ctx.fill(); }
            var fg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
            fg.addColorStop(0, gold ? '#fff3b0' : '#ff9a8a'); fg.addColorStop(1, gold ? '#d49f35' : '#b8262a');
            ctx.fillStyle = fg; ctx.beginPath(); circ(ctx, x, y, r); ctx.fill();
            ctx.strokeStyle = '#4b6326'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + 2, y - r * 1.35); ctx.stroke();
            ctx.fillStyle = '#6f8a3a'; ctx.beginPath(); ell(ctx, x + r * 0.35, y - r * 1.15, r * 0.3, r * 0.14); ctx.fill();
            if (label) chip(ctx, label, x, y + r * 1.55, 10.5, 'rgba(251,241,216,0.95)', gold ? '#7a4a0a' : '#8e1f1f', gold ? C.gold : null);
        }

        var tot = { th: 0, fr: 0, frG: 0, bi: 0 };
        PH.forEach(function (P) { tot.th += P.th; tot.bi += P.bi; if (P.gold) tot.frG += P.fr; else tot.fr += P.fr; });
        var k = createCore(host, data, api, {
            title: 'حصاد البركات', icon: '🌳',
            howto: { kind: 'drag', text: 'اسحب صباعك بسرعة زي السيف: اقطع الشوك قبل ما يوصل للشجرة، واقطف الثمرة لما تنوّر (أو وهي بتقع). سيب الثمرة اللي لسه صغيرة!' },
            comboStep: 4, maxMult: 3, pad: [164.8, 220, 261.6], lives: 3, factY: 0.02,
            rawMax: function (k) { return perfectSeq(k, rep(tot.th, 4).concat(rep(tot.fr, 7), rep(tot.frG, 9), rep(tot.bi, 3))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { for (var i = 0; i < S.th.length; i++) if (S.th[i].st === 'grow') { S.th[i].st = 'cut'; S.th[i].t = 0; } return '🔥 الشوك اتقطع كله'; },
            update: function (k, dt) {
                var g = S.g, P = PH[Math.floor(clamp(S.ph, 0, 2))], i;
                S.scale += (P.scale - S.scale) * Math.min(1, dt * 1.5);
                if (S.active) {
                    S.tT -= dt; S.fT -= dt; S.bT -= dt;
                    if (S.left.th > 0 && S.tT <= 0) { spawnThorn(); S.left.th--; S.tT = P.thGap * rand(0.8, 1.2); }
                    if (S.left.fr > 0 && S.fT <= 0) { if (spawnFruit()) S.left.fr--; S.fT = P.frGap * rand(0.8, 1.2); }
                    if (S.left.bi > 0 && S.bT <= 0) { spawnBird(); S.left.bi--; S.bT = 4.5 * rand(0.8, 1.2); }
                }
                var tw = trunkW();
                for (i = S.th.length - 1; i >= 0; i--) {
                    var th = S.th[i];
                    th.t += dt;
                    if (th.st === 'grow') {
                        th.x += -th.side * th.v * dt;
                        if (Math.abs(th.x - g.tx) < tw * 1.2) {
                            th.st = 'hit'; th.t = 0;
                            k.shake(5, 0.3);
                            if (k.loseLife(g.tx, g.gy - g.R * 0.4, plain(th.label) || '!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… الشجرة محتاجة تخدمها كل يوم', finaleT: 1.2 }); return; }
                        }
                    } else if (th.t > 0.7) S.th.splice(i, 1);
                }
                for (i = S.fr.length - 1; i >= 0; i--) {
                    var f = S.fr[i];
                    f.t += dt; if (f.hurt > 0) f.hurt -= dt;
                    if (f.st === 'bud') { if (!(f.hurt > 0)) f.g += dt / 2.6; if (f.g >= 1) { f.st = 'ripe'; f.t = 0; k.sfx('coin'); } }
                    else if (f.st === 'ripe') {
                        if (f.t > 3.6) { var sp = slotPos(S.slots[f.si]); f.st = 'fall'; f.x = sp.x; f.y = sp.y; f.vy = 0; releaseSlot(f); }
                    } else if (f.st === 'fall') {
                        f.vy += g.H * 1.4 * dt; f.y += f.vy * dt;
                        if (f.y >= g.gy - 4) { f.st = 'lost'; f.t = 0; k.breakCombo(); k.pop(f.x, f.y - 20, 'وقعت!', '#ffd0c0', 13); }
                    } else if (f.st === 'stolen') { if (f.t > 0.1) { releaseSlot(f); S.fr.splice(i, 1); } }
                    else if (f.t > 0.6) S.fr.splice(i, 1);
                }
                for (i = S.bi.length - 1; i >= 0; i--) {
                    var b = S.bi[i];
                    b.t += dt;
                    if (b.st === 'fly') {
                        if (!b.target || (b.target.st !== 'ripe' && b.target.st !== 'bud')) {
                            b.target = null;
                            for (var j = 0; j < S.fr.length; j++) if ((S.fr[j].st === 'ripe' || S.fr[j].st === 'bud') && !S.fr[j].bird) { b.target = S.fr[j]; S.fr[j].bird = b; break; }
                        }
                        var tp = b.target ? slotPos(S.slots[b.target.si]) : { x: b.side < 0 ? g.W + 140 : -140, y: b.y };
                        var dx = tp.x - b.x, dy = tp.y - b.y, d = Math.sqrt(dx * dx + dy * dy), vv = g.W * 0.13;
                        if (d < 8 && b.target) { b.st = 'eat'; b.t = 0; }
                        else if (d > 1) { b.x += dx / d * vv * dt; b.y += dy / d * vv * dt; }
                        if (!b.target && (b.x < -80 || b.x > g.W + 80)) S.bi.splice(i, 1);
                    } else if (b.st === 'eat') {
                        if (b.t > 1.2) {
                            if (b.target && (b.target.st === 'ripe' || b.target.st === 'bud')) { b.target.st = 'stolen'; b.target.t = 0; k.breakCombo(); k.pop(b.x, b.y - 24, 'العصفورة خدتها!', '#ffd0c0', 14); }
                            b.st = 'shoo'; b.t = 0;
                        }
                    } else { b.y -= g.H * 0.6 * dt; b.x += (b.side < 0 ? -1 : 1) * g.W * 0.2 * dt; if (b.t > 2) S.bi.splice(i, 1); }
                }
                for (i = S.trail.length - 1; i >= 0; i--) if (k.rt - S.trail[i].t > 0.22) S.trail.splice(i, 1);
                if (S.active && !S.left.th && !S.left.fr && !S.left.bi && !S.th.length && !S.fr.length && !S.bi.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'إلى المجد! 👑', finaleT: 4.2 }); return; }
                    var nx = S.ph + 1;
                    k.after(0.6, function () { k.checkpoint(function () { startPhase(k, nx); }); });
                }
            },
            finale: function (k, dt) {
                if (!k.info.win) return;
                S.crownT += dt;
                if (Math.random() < dt * 8) k.glyphBurst(rand(0, k.W), rand(0, k.H * 0.5), 1);
            },
            down: function (k, p) { S.lx = p.x; S.ly = p.y; S.trail.length = 0; S.trail.push({ x: p.x, y: p.y, t: k.rt }); },
            move: function (k, p) {
                if (!k.pdown) return;
                var dx = p.x - S.lx, dy = p.y - S.ly;
                if (dx * dx + dy * dy < 16) return;
                slash(k, S.lx, S.ly, p.x, p.y);
                S.lx = p.x; S.ly = p.y;
                S.trail.push({ x: p.x, y: p.y, t: k.rt });
                if (S.trail.length > 14) S.trail.shift();
            },
            key: function (k, key, isDown) {
                if (key !== ' ' || !isDown) return false;
                var g = S.g, best = null, bd = 1e9, i;
                for (i = 0; i < S.th.length; i++) if (S.th[i].st === 'grow') { var d = Math.abs(S.th[i].x - g.tx); if (d < bd) { bd = d; best = { x: S.th[i].x, y: S.th[i].y - g.r * 0.5 }; } }
                if (!best) for (i = 0; i < S.fr.length; i++) if (S.fr[i].st === 'ripe') { best = slotPos(S.slots[S.fr[i].si]); break; }
                if (best) slash(k, best.x - 20, best.y - 20, best.x + 20, best.y + 20);
                return true;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i;
                blit(ctx, S.bg, 0, 0);
                ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff6d0';
                for (i = 0; i < 6; i++) { var a = t * 0.05 + i * TAU / 6; ctx.beginPath(); ctx.moveTo(W * 0.15, H * 0.1); ctx.lineTo(W * 0.15 + Math.cos(a) * W, H * 0.1 + Math.sin(a) * W); ctx.lineTo(W * 0.15 + Math.cos(a + 0.12) * W, H * 0.1 + Math.sin(a + 0.12) * W); ctx.closePath(); ctx.fill(); }
                ctx.restore();
                ctx.fillStyle = '#fff3c0'; ctx.beginPath(); circ(ctx, W * 0.15, H * 0.1, H * 0.05); ctx.fill();
                for (var c = 0; c < 3; c++) cloud(ctx, ((c * 0.33 + t * 0.008) % 1.2 - 0.1) * W, H * (0.1 + c * 0.05), W * 0.06, 0.6);
                // ladder to heaven (phase 3 + finale)
                if (S.rungs > 0 || (k.info && k.info.win && S.ph >= 2)) {
                    var top = g.cy - g.R, n = Math.max(S.rungs, 0), step = clamp(H * 0.035, 9, 14), lh = Math.min(top + 10, n * step + (k.state === 'finale' || k.state === 'outro' ? S.crownT * H * 0.25 : 0));
                    ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(g.tx - 10, top); ctx.lineTo(g.tx - 10, top - lh); ctx.moveTo(g.tx + 10, top); ctx.lineTo(g.tx + 10, top - lh); ctx.stroke();
                    for (var rg = 0; rg * step < lh; rg++) { ctx.beginPath(); ctx.moveTo(g.tx - 10, top - rg * step); ctx.lineTo(g.tx + 10, top - rg * step); ctx.stroke(); }
                }
                drawTree(k, ctx, g, t);
                for (i = 0; i < S.fr.length; i++) {
                    var f = S.fr[i], sp = f.st === 'fall' || f.st === 'picked' || f.st === 'lost' ? { x: f.x, y: f.y } : slotPos(S.slots[f.si]);
                    if (f.st === 'bud') {
                        var br = g.r * (0.3 + 0.55 * f.g);
                        ctx.fillStyle = f.hurt > 0 ? '#b9a07a' : '#8fbf5a'; ctx.beginPath(); circ(ctx, sp.x, sp.y, br); ctx.fill();
                        ring(ctx, sp.x, sp.y, g.r * 0.95, f.g, 'rgba(255,255,255,0.7)', 2);
                    } else if (f.st === 'ripe' || f.st === 'fall') {
                        var pulse = 1 + Math.sin(t * 8) * 0.05;
                        fruitArt(ctx, sp.x, sp.y, g.r * 0.9 * pulse, f.gold, true, f.label, t);
                        if (f.st === 'ripe' && f.t > 2.6) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 14); txt(ctx, '!', sp.x + g.r, sp.y - g.r, font(16, 900), '#ff6b5a', 'center', 3); ctx.globalAlpha = 1; }
                    } else if (f.st === 'picked') {
                        var pt = clamp(f.t / 0.6, 0, 1), bx = W * 0.08, by = g.gy - 10;
                        ctx.globalAlpha = 1 - pt * 0.5;
                        fruitArt(ctx, lerp(f.x, bx, eio(pt)), lerp(f.y, by, eio(pt)) - Math.sin(pt * Math.PI) * 40, g.r * 0.9 * (1 - pt * 0.5), f.gold, false, '', t);
                        ctx.globalAlpha = 1;
                    } else if (f.st === 'lost') {
                        ctx.globalAlpha = 1 - clamp(f.t / 0.6, 0, 1);
                        fruitArt(ctx, f.x, f.y, g.r * 0.8, f.gold, false, '', t); ctx.globalAlpha = 1;
                    }
                }
                // thorns creeping along the ground
                for (i = 0; i < S.th.length; i++) {
                    var th = S.th[i], a2 = th.st === 'grow' ? 1 : 1 - clamp(th.t / 0.7, 0, 1);
                    ctx.save(); ctx.globalAlpha = a2;
                    ctx.strokeStyle = th.st === 'cut' ? '#8a7a4a' : '#2e3a1a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(th.x0, th.y);
                    var len = th.x - th.x0, steps = Math.max(2, Math.ceil(Math.abs(len) / 14));
                    for (var s = 1; s <= steps; s++) { var xx = th.x0 + len * s / steps; ctx.lineTo(xx, th.y - Math.abs(Math.sin(s * 0.9 + th.ph)) * 8); }
                    ctx.stroke();
                    ctx.fillStyle = '#2e3a1a';
                    for (var s3 = 1; s3 <= steps; s3 += 2) { var x3 = th.x0 + len * s3 / steps, y3 = th.y - Math.abs(Math.sin(s3 * 0.9 + th.ph)) * 8; ctx.beginPath(); ctx.moveTo(x3 - 3, y3); ctx.lineTo(x3, y3 - 9); ctx.lineTo(x3 + 3, y3); ctx.fill(); }
                    if (th.st === 'grow') {
                        ctx.fillStyle = '#3f4a22'; ctx.beginPath(); circ(ctx, th.x, th.y - g.r * 0.5, g.r * 0.7); ctx.fill();
                        ctx.fillStyle = '#2e3a1a';
                        for (var sp2 = 0; sp2 < 6; sp2++) { var aa = sp2 / 6 * TAU + t; ctx.beginPath(); ctx.moveTo(th.x + Math.cos(aa) * g.r * 0.55, th.y - g.r * 0.5 + Math.sin(aa) * g.r * 0.55); ctx.lineTo(th.x + Math.cos(aa + 0.25) * g.r * 1.05, th.y - g.r * 0.5 + Math.sin(aa + 0.25) * g.r * 1.05); ctx.lineTo(th.x + Math.cos(aa + 0.5) * g.r * 0.55, th.y - g.r * 0.5 + Math.sin(aa + 0.5) * g.r * 0.55); ctx.fill(); }
                        if (th.label) chip(ctx, th.label, th.x, th.y - g.r * 1.75, 11, 'rgba(40,30,15,0.85)', '#e8e0c0');
                    }
                    ctx.restore();
                }
                // birds
                for (i = 0; i < S.bi.length; i++) {
                    var b = S.bi[i], flap = Math.sin(t * 18 + i) * 0.6, dir = b.st === 'shoo' ? (b.side < 0 ? -1 : 1) : (b.target ? (slotPos(S.slots[b.target.si]).x > b.x ? 1 : -1) : -b.side);
                    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(dir, 1);
                    ctx.fillStyle = '#4a4550'; ctx.beginPath(); ell(ctx, 0, 0, g.r * 0.6, g.r * 0.35); ctx.fill();
                    ctx.beginPath(); circ(ctx, g.r * 0.5, -g.r * 0.2, g.r * 0.25); ctx.fill();
                    ctx.fillStyle = '#e2b34d'; ctx.beginPath(); ctx.moveTo(g.r * 0.72, -g.r * 0.22); ctx.lineTo(g.r * 0.95, -g.r * 0.15); ctx.lineTo(g.r * 0.72, -g.r * 0.08); ctx.fill();
                    ctx.fillStyle = '#35303a'; ctx.beginPath(); ctx.moveTo(-g.r * 0.1, -g.r * 0.1); ctx.lineTo(-g.r * 0.5, -g.r * (0.1 + flap)); ctx.lineTo(g.r * 0.25, -g.r * 0.1); ctx.fill();
                    ctx.restore();
                }
                // basket
                var bx2 = W * 0.08, by2 = g.gy - 6;
                ctx.fillStyle = '#9c6a35'; ctx.beginPath(); ctx.moveTo(bx2 - 26, by2 - 16); ctx.lineTo(bx2 + 26, by2 - 16); ctx.lineTo(bx2 + 20, by2 + 6); ctx.lineTo(bx2 - 20, by2 + 6); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#5a3517'; ctx.lineWidth = 1.5; ctx.stroke();
                for (i = 0; i < Math.min(6, S.basket); i++) { ctx.fillStyle = i % 2 ? '#e0443a' : C.gold; ctx.beginPath(); circ(ctx, bx2 - 15 + (i % 3) * 15, by2 - 18 - Math.floor(i / 3) * 8, 6); ctx.fill(); }
                txt(ctx, ar(S.basket), bx2, by2 - 3, font(12, 900), '#fff', 'center', 3);
                // slash trail
                if (S.trail.length > 1) {
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    for (i = 1; i < S.trail.length; i++) {
                        var aT = clamp(1 - (k.rt - S.trail[i].t) / 0.22, 0, 1);
                        ctx.strokeStyle = 'rgba(255,240,190,' + aT + ')'; ctx.lineWidth = 2 + aT * 5;
                        ctx.beginPath(); ctx.moveTo(S.trail[i - 1].x, S.trail[i - 1].y); ctx.lineTo(S.trail[i].x, S.trail[i].y); ctx.stroke();
                    }
                }
                if (S.ph === 0 && S.active && k.t < 8) txt(ctx, 'اسحب بسرعة زي السيف ⚔️', W / 2, H * 0.62, font(16, 900), '#fff', 'center', 4);
                // finale: the crown descends
                if ((k.state === 'finale' || k.state === 'outro') && k.info && k.info.win) {
                    var ct = clamp(S.crownT / 2.2, 0, 1), cx = g.tx, cyy = lerp(-40, g.cy - g.R - H * 0.08, eo(ct)), cs = clamp(H * 0.08, 22, 40);
                    var cg = ctx.createRadialGradient(cx, cyy, 2, cx, cyy, cs * 2.2); cg.addColorStop(0, 'rgba(255,236,170,0.8)'); cg.addColorStop(1, 'rgba(255,236,170,0)');
                    ctx.fillStyle = cg; ctx.beginPath(); circ(ctx, cx, cyy, cs * 2.2); ctx.fill();
                    ctx.fillStyle = C.gold;
                    ctx.beginPath(); ctx.moveTo(cx - cs, cyy + cs * 0.4); ctx.lineTo(cx - cs, cyy - cs * 0.3); ctx.lineTo(cx - cs * 0.5, cyy + cs * 0.05); ctx.lineTo(cx, cyy - cs * 0.55); ctx.lineTo(cx + cs * 0.5, cyy + cs * 0.05); ctx.lineTo(cx + cs, cyy - cs * 0.3); ctx.lineTo(cx + cs, cyy + cs * 0.4); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.fillStyle = '#c0392b'; ctx.beginPath(); circ(ctx, cx, cyy + cs * 0.1, cs * 0.12); ctx.fill();
                    ctx.fillStyle = '#1f6fa3'; ctx.beginPath(); circ(ctx, cx - cs * 0.55, cyy + cs * 0.2, cs * 0.09); circ(ctx, cx + cs * 0.55, cyy + cs * 0.2, cs * 0.09); ctx.fill();
                    drawCross(ctx, cx, cyy - cs * 0.75, clamp(cs * 0.3, 7, 12), C.goldL, k.dpr);
                    if (crown.verse && k.state === 'finale' && ct >= 1) {
                        var sw = Math.min(W * 0.8, 560), sh = clamp(H * 0.2, 56, 84), sy = H * 0.62;
                        ctx.fillStyle = 'rgba(251,241,216,0.95)'; rr(ctx, (W - sw) / 2, sy, sw, sh, 14); ctx.fill();
                        ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
                        block(ctx, '«' + plain(crown.verse) + '» ' + plain(crown.ref || ''), W / 2, sy + sh / 2, sw - 40, sh - 12, clamp(sh * 0.24, 13, 18), 900, '#3c1a08', 2);
                    }
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };
})(typeof L1_ARCADE !== 'undefined' ? L1_ARCADE._kit : null);
