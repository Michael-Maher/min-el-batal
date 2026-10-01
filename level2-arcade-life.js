/*
 * level2-arcade-life.js
 * Level 2 (مهارات الحياة والقيادة / جيل يصنع التغيير) signature canvas arcade games. Adds six
 * games to the global L1_ARCADE using the shared kit exposed by level1-arcade.js (L1_ARCADE._kit):
 *   personalityMatch, mirror, nehemiahWall, dayPlanner, carryResponsibility, decisionPath
 * Interface: docs/superpowers/specs/2026-09-29-level1-contracts.md (section B).
 * Spec: docs/superpowers/specs/2026-09-30-level2-life-design.md (arcade table).
 * All lesson / Bible text (intro, outro, facts, phases, clues, lies, tasks, steps, voices)
 * comes from the game's data; only generic UI strings live here. Plain global script, ES5,
 * no image files. Must load after level1-arcade.js.
 */
(function (K) {
    'use strict';
    if (!K || typeof L1_ARCADE === 'undefined') return;

    var C = K.C, TAU = K.TAU, clamp = K.clamp, lerp = K.lerp, rand = K.rand;
    var eo = K.eo, eob = K.eob, shuffle = K.shuffle, seeded = K.seeded, ar = K.ar, plain = K.plain;
    var font = K.font, strList = K.strList, rr = K.rr, circ = K.circ, ell = K.ell, txt = K.txt;
    var block = K.block, inRect = K.inRect, vgrad = K.vgrad, layer = K.layer, blit = K.blit;
    var blitTiled = K.blitTiled, ridge = K.ridge, copticCross = K.copticCross, drawCross = K.drawCross;
    var halo = K.halo, friezeSprite = K.friezeSprite, starPath = K.starPath;
    var figure = K.figure, flame = K.flame, tinyPerson = K.tinyPerson, createCore = K.createCore;

    /* ============================================================ shared helpers */
    // Upper bound for a sequence of combo hits: ascending order puts the big values on the big multipliers.
    function perfectSeq(k, list) {
        var st = k.opt.comboStep || 4, mx = k.opt.maxMult || 4, s = 0, l = list.slice().sort(function (a, b) { return a - b; });
        for (var i = 0; i < l.length; i++) s += l[i] * Math.min(mx, 1 + Math.floor((i + 1) / st));
        return s;
    }
    function rep(n, v, out) { out = out || []; for (var i = 0; i < n; i++) out.push(v); return out; }
    function lines2(d) { return d && typeof d === 'object' ? d : {}; }
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
    function cloud(ctx, x, y, s, a) {
        ctx.fillStyle = 'rgba(255,248,235,' + a + ')';
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
    function sayList(S, dt) { for (var i = S.say.length - 1; i >= 0; i--) { S.say[i].t += dt; if (S.say[i].t > S.say[i].dur) S.say.splice(i, 1); } }
    function drawSay(ctx, S, W, H) {
        for (var s = 0; s < S.say.length; s++) {
            var sb = S.say[s], sa = sb.t < 0.3 ? sb.t / 0.3 : clamp((sb.dur - sb.t) / 0.4, 0, 1);
            speech(ctx, sb.s, sb.x, sb.y, Math.min(W * 0.42, 300), clamp(H * 0.045, 12, 16), W, sa, sb.who);
        }
    }
    function addSay(S, s, x, y, dur, who) { if (plain(s)) S.say.push({ s: s, x: x, y: y, t: 0, dur: dur || 3.6, who: who }); }
    function youth(ctx, k, x, y, h, dir, walk, robe, extra) {
        var f = { x: x, y: y, h: h, dir: dir, robe: robe || '#f3ead6', mantle: '#8e1f1f', hair: '#2b1a0e', belt: C.gold, walk: walk, t: k.rt, dpr: k.dpr };
        if (extra) for (var e in extra) f[e] = extra[e];
        return figure(ctx, f);
    }

    /* ======================================================================
     * 1. personalityMatch -- أنواع الشخصيات (DISC)
     * A DISC wheel (D I S C quadrants) stands in the church yard. People walk in
     * from both sides, each with a clue bubble. Tap the left / right half (or the
     * arrow keys) to turn the wheel so the matching quadrant faces the person
     * before they reach it. Phase 1: their traits. Phase 2: people from the Bible
     * (doc examples), from both sides at once. Phase 3 (twist): the bubble is
     * the way you should talk to them -- who needs that? Data: types [{key, name,
     * color, traits[], examples[], approach}], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.personalityMatch = function (host, data, api) {
        data = data || {};
        var DEF = [['D', '#c0392b'], ['I', '#e6a817'], ['S', '#27ae60'], ['C', '#2e86c1']];
        var src = (data.types || []).filter(function (t) { return t && t.key; }).slice(0, 4);
        var TY = [];
        for (var d0 = 0; d0 < 4; d0++) {
            var t0 = src[d0] || { key: DEF[d0][0] };
            TY.push({ key: plain(t0.key), name: plain(t0.name || t0.key), color: t0.color || DEF[d0][1],
                src: [strList(t0.traits), strList(t0.examples), strList(t0.approach ? [t0.approach] : [])] });
        }
        var PH = [{ n: 6, sp: 0.095, gap: 0.8, both: false }, { n: 8, sp: 0.1, gap: 1.5, both: true }, { n: 8, sp: 0.11, gap: 1.3, both: true }];
        var TOTAL = 22, ROBES = ['#e9e1cf', '#d9c7a1', '#cfd8e3', '#e8d5c4', '#d8e0c8'], MANT = ['#7c3a28', '#3b5f86', '#6b4a7a', '#5b6a2a', '#8a5a2b'];
        var S = { ph: -1, rot: 0, vis: 0, ppl: [], plan: [], planT: 0, active: false, got: [0, 0, 0, 0], slowT: 0, id: 0, cc: [0, 0, 0, 0], flash: [0, 0, 0, 0] };
        function mod4(n) { return ((n % 4) + 4) % 4; }
        function faceIdx(side) { return side > 0 ? mod4(-S.rot) : mod4(2 - S.rot); }
        function clueOf(t, p) {
            var L = TY[t].src[p];
            if (!L.length) L = TY[t].src[0];
            if (!L.length) return TY[t].name;
            return L[(S.cc[t]++) % L.length];
        }
        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.88), R = clamp(Math.min(H * 0.27, W * 0.15), 48, 130);
            return { W: W, H: H, gy: gy, cx: W / 2, cy: gy - R - 8, R: R, ph: clamp(H * 0.3, 70, 150), stopL: W / 2 - R - 30, stopR: W / 2 + R + 30 };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                sky(x, W, g.gy, ['#2f4f86', '#6f8fc0', '#f2c38a', '#f8dfb0'], [W * 0.82, g.gy - H * 0.42, H * 0.04]);
                x.fillStyle = 'rgba(150,110,90,0.5)'; ridge(x, W, g.gy - H * 0.2, H * 0.06, 4, 3, g.gy); x.fill();
                church(x, W * 0.17, g.gy - H * 0.03, H * 0.42, '#b58a66');
                // arcade of the church yard
                x.fillStyle = '#c9a27a';
                x.fillRect(W * 0.62, g.gy - H * 0.3, W * 0.36, H * 0.3);
                x.fillStyle = 'rgba(70,40,20,0.55)';
                for (var a = 0; a < 5; a++) { var ax = W * 0.645 + a * W * 0.068; x.beginPath(); x.arc(ax + W * 0.022, g.gy - H * 0.19, W * 0.022, Math.PI, 0); x.lineTo(ax + W * 0.044, g.gy - H * 0.03); x.lineTo(ax, g.gy - H * 0.03); x.closePath(); x.fill(); }
                x.fillStyle = '#9c7446'; x.fillRect(W * 0.62, g.gy - H * 0.31, W * 0.36, H * 0.025);
                sand(x, W, H, g.gy - H * 0.03, 7);
                palm(x, W * 0.36, g.gy - H * 0.03, H * 0.34, 0.2);
                palm(x, W * 0.99, g.gy - H * 0.02, H * 0.4, -0.3);
            });
        }
        function mkPlan(n, p) {
            var ty = [], i;
            for (i = 0; i < n; i++) ty.push(i % 4);
            ty = shuffle(ty);
            return ty.map(function (t, j) { return { ty: t, side: p === 0 ? (j % 2 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1) }; });
        }
        function busy(side) {
            for (var i = 0; i < S.ppl.length; i++) if (S.ppl[i].st === 'walk' && (side === 0 || S.ppl[i].side === side)) return true;
            return false;
        }
        function spawn(k, it) {
            var g = S.g;
            S.ppl.push({ id: S.id, ty: it.ty, side: it.side, x: it.side > 0 ? g.W + 40 : -40, st: 'walk', t: 0, walk: 0,
                clue: clueOf(it.ty, S.ph), robe: ROBES[S.id % ROBES.length], mant: MANT[(S.id * 3) % MANT.length], hair: S.id % 3 ? '#2b1a0e' : '#5a3a1e', veil: S.id % 2 === 1 });
            S.id++;
        }
        function startPhase(k, n) {
            S.ph = n; S.active = false; S.plan = mkPlan(PH[n].n, n); S.planT = 0.3;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.5, function () { S.active = true; });
        }
        function turn(k, d) {
            S.rot += d;
            k.sfx('tick');
            k.emit(S.g.cx + (d > 0 ? 1 : -1) * S.g.R, S.g.cy - S.g.R * 0.8, 4, { colors: [C.goldL, '#fff'], grav: 100, vmin: 20, vmax: 60 });
        }
        function judge(k, p) {
            var g = S.g, hx = p.side > 0 ? g.stopR : g.stopL;
            if (faceIdx(p.side) === p.ty) {
                p.st = 'ok'; p.t = 0;
                S.got[p.ty]++; S.flash[p.ty] = 1;
                k.hit(10, hx, g.gy - g.ph - 20, { text: TY[p.ty].key + ' ' });
                k.emit(hx, g.gy - g.ph * 0.6, 18, { colors: [TY[p.ty].color, C.goldL, '#fff'], up: 80 });
                k.glyphBurst(hx, g.gy - g.ph, 3);
            } else {
                p.st = 'bad'; p.t = 0;
                k.pop(hx, g.gy - g.ph - 44, TY[p.ty].key + ' — ' + TY[p.ty].name, TY[p.ty].color, 17);
                if (k.loseLife(hx, g.gy - g.ph - 14, 'مش دي مجموعته') <= 0) k.finish({ lose: true, title: 'ولا يهمك… اقرا الشخصية كويس وجرّب تاني', finaleT: 1.2 });
            }
        }
        function drawWheel(k, ctx, g) {
            var R = g.R, cx = g.cx, cy = g.cy, i, a;
            ctx.fillStyle = '#6b4220'; rr(ctx, cx - R * 0.1, cy, R * 0.2, g.gy - cy, 4); ctx.fill();
            ctx.fillStyle = '#4a2c14'; rr(ctx, cx - R * 0.4, g.gy - 8, R * 0.8, 10, 4); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); circ(ctx, cx + 4, cy + 6, R + 7); ctx.fill();
            ctx.fillStyle = C.goldD; ctx.beginPath(); circ(ctx, cx, cy, R + 7); ctx.fill();
            var fL = faceIdx(-1), fR = faceIdx(1);
            for (i = 0; i < 4; i++) {
                a = i * Math.PI / 2 + S.vis;
                var gr = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
                gr.addColorStop(0, mixA(TY[i].color, 0.75)); gr.addColorStop(1, TY[i].color);
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a - Math.PI / 4, a + Math.PI / 4); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = C.goldL; ctx.lineWidth = 2; ctx.stroke();
                var fc = i === fL || i === fR;
                if (fc || S.flash[i] > 0) {
                    ctx.strokeStyle = S.flash[i] > 0 ? 'rgba(255,255,255,' + S.flash[i] + ')' : 'rgba(255,240,190,' + (0.45 + 0.35 * Math.sin(k.rt * 6)) + ')';
                    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R - 3, a - Math.PI / 4 + 0.05, a + Math.PI / 4 - 0.05); ctx.stroke();
                }
            }
            ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.stroke();
            ctx.fillStyle = C.goldL;
            for (i = 0; i < 24; i++) { a = i / 24 * TAU + S.vis; ctx.beginPath(); circ(ctx, cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4), 1.6); ctx.fill(); }
            for (i = 0; i < 4; i++) {
                a = i * Math.PI / 2 + S.vis;
                var lx = cx + Math.cos(a) * R * 0.6, ly = cy + Math.sin(a) * R * 0.6;
                txt(ctx, TY[i].key, lx, ly - R * 0.08, font(R * 0.32, 900), '#fff', 'center', 3, 'rgba(40,10,0,0.55)');
                txt(ctx, TY[i].name, lx, ly + R * 0.17, font(clamp(R * 0.13, 9, 14), 900), '#fff8e6', 'center', 2.5, 'rgba(40,10,0,0.55)');
            }
            ctx.fillStyle = C.cream; ctx.beginPath(); circ(ctx, cx, cy, R * 0.25); ctx.fill();
            ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
            drawCross(ctx, cx, cy, R * 0.16, C.red, k.dpr);
            // turn hints
            var hy = cy - R - 16;
            txt(ctx, '↻', cx + R * 0.75, hy, font(20, 900), C.goldL, 'center', 3);
            txt(ctx, '↺', cx - R * 0.75, hy, font(20, 900), C.goldL, 'center', 3);
            // group counters under the wheel
            for (i = 0; i < 4; i++) if (S.got[i]) chip(ctx, TY[i].key + ' ×' + ar(S.got[i]), cx + (i - 1.5) * R * 0.5, g.gy + (g.H - g.gy) * 0.55, 10, mixA(TY[i].color, 0.85), '#fff');
        }

        var k = createCore(host, data, api, {
            title: 'اعرف الشخصية', icon: '🧩',
            howto: { kind: 'tap', text: 'اضغط يمين أو شمال عشان تلف العجلة، وخلي لون الشخصية الصح يبص ناحية كل واحد جاي قبل ما يوصل.' },
            comboStep: 4, maxMult: 3, pad: [146.8, 220], lives: 3, factY: 0.17,
            rawMax: function (k) { return perfectSeq(k, rep(TOTAL, 10)) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 8; return '🕊️ الناس ماشيين بهدوء'; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)];
                S.vis += (S.rot * Math.PI / 2 - S.vis) * Math.min(1, dt * (k.reduced ? 30 : 14));
                S.slowT = Math.max(0, S.slowT - dt);
                for (var f = 0; f < 4; f++) S.flash[f] = Math.max(0, S.flash[f] - dt * 1.5);
                if (S.active && S.plan.length) {
                    S.planT -= dt;
                    var nx = S.plan[0];
                    if (S.planT <= 0 && !busy(P.both ? nx.side : 0)) { S.plan.shift(); spawn(k, nx); S.planT = P.gap; }
                }
                var sp = g.W * P.sp * (S.slowT > 0 ? 0.55 : 1);
                for (var i = S.ppl.length - 1; i >= 0; i--) {
                    var p = S.ppl[i], tx = p.side > 0 ? g.stopR : g.stopL;
                    p.t += dt;
                    if (p.st === 'walk') {
                        p.walk += dt * 7;
                        p.x += -p.side * sp * dt;
                        if ((p.side > 0 && p.x <= tx) || (p.side < 0 && p.x >= tx)) { p.x = tx; judge(k, p); if (k.state !== 'play') return; }
                    } else if (p.st === 'ok') {
                        if (p.t > 0.9) S.ppl.splice(i, 1);
                    } else {
                        p.walk += dt * 7; p.x += p.side * sp * 1.4 * dt;
                        if (p.x < -60 || p.x > g.W + 60) S.ppl.splice(i, 1);
                    }
                }
                if (S.active && !S.plan.length && !S.ppl.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'عرفت تتعامل مع الكل! 🧩', finaleT: 2.2 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.7, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 6) k.emit(rand(0, k.W), k.H * 0.35, 3, { colors: [TY[Math.floor(rand(0, 4))].color, C.goldL], grav: 60, up: 40 });
            },
            down: function (k, p) { turn(k, p.x >= k.W / 2 ? 1 : -1); },
            key: function (k, key, isDown) {
                if (!isDown) return false;
                if (key === 'ArrowRight' || key === 'd') { turn(k, 1); return true; }
                if (key === 'ArrowLeft' || key === 'a') { turn(k, -1); return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i;
                blit(ctx, S.bg, 0, 0);
                for (var c = 0; c < 3; c++) cloud(ctx, ((c * 0.41 + t * 0.005) % 1.2 - 0.1) * W, H * (0.1 + c * 0.06), W * 0.05, 0.3);
                frieze(ctx, k, 0, g.gy - 2, W, 9, 'rgba(142,31,31,0.55)');
                drawWheel(k, ctx, g);
                for (i = 0; i < S.ppl.length; i++) {
                    var p = S.ppl[i], sc = p.st === 'ok' ? 1 - eo(p.t / 0.9) * 0.6 : 1, al = p.st === 'ok' ? 1 - clamp((p.t - 0.3) / 0.6, 0, 1) : 1;
                    var px = p.st === 'ok' ? lerp(p.x, g.cx, eo(p.t / 0.9)) : p.x;
                    var dir = p.st === 'bad' ? p.side : -p.side;
                    ctx.save(); ctx.globalAlpha = al;
                    if (p.st === 'ok') { ctx.fillStyle = mixA(TY[p.ty].color, 0.35); ctx.beginPath(); circ(ctx, px, g.gy - g.ph * 0.5 * sc, g.ph * 0.45 * sc); ctx.fill(); }
                    var fp = { x: px, y: g.gy - 2, h: g.ph * sc, dir: dir, robe: p.robe, mantle: p.mant, hair: p.hair, beard: p.veil ? 0 : (p.id % 4 === 0 ? 0.8 : 0), walk: p.st === 'ok' ? -1 : p.walk, arm: p.st === 'ok' ? 2.6 : null, t: t + p.id, dpr: k.dpr };
                    figure(ctx, fp);
                    if (p.veil) {
                        var s = fp.h / 100;
                        ctx.save(); ctx.translate(fp.x, fp.y); ctx.scale((dir < 0 ? -1 : 1) * s, s);
                        ctx.fillStyle = '#e9dcc0';
                        ctx.beginPath(); ctx.moveTo(9, -91); ctx.quadraticCurveTo(0, -101, -9, -92); ctx.quadraticCurveTo(-15, -80, -17, -58);
                        ctx.lineTo(-8, -60); ctx.quadraticCurveTo(-5, -78, -3, -86); ctx.quadraticCurveTo(3, -90, 9, -87); ctx.closePath(); ctx.fill();
                        ctx.restore();
                    }
                    ctx.restore();
                    if (p.st === 'walk') speech(ctx, p.clue, px, g.gy - g.ph - 4, Math.min(W * 0.28, 250), clamp(H * 0.044, 11, 15), W, clamp(p.t * 3, 0, 1));
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 2. mirror -- اقبل نفسك (مز ١٣٩: ١٤ ، إر ١: ٧)
     * A tall gilded mirror shows lies about you as dark cracks that keep growing.
     * Hold your finger on the mirror to shine the church lamp's light there; keep
     * the light on a lie until it shatters and God's truth appears. A lie that
     * grows to full cracks the mirror (a life). Phase 1: one lie at a time.
     * Phase 2: two lies drifting. Phase 3 (twist): the lamp has limited oil --
     * light the golden words of who you really are to refill it.
     * Data: lies[], truths[{t, ref}], identity[], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.mirror = function (host, data, api) {
        data = data || {};
        var lies = strList(data.lies);
        if (!lies.length) lies = ['…'];
        var truths = (data.truths || []).map(function (t) { return typeof t === 'string' ? { t: t, ref: '' } : (t && t.t ? { t: plain(t.t), ref: plain(t.ref || '') } : null); }).filter(Boolean);
        var ids = strList(data.identity);
        var PH = [{ n: 5, grow: 8, max: 1, gap: 1.0, drift: 0, burn: 0.75 }, { n: 7, grow: 7, max: 2, gap: 1.5, drift: 0.09, burn: 0.75 }, { n: 7, grow: 6.5, max: 2, gap: 1.3, drift: 0.11, burn: 0.7, oil: true, gold: ids.length ? 4 : 0 }];
        var NL = 19, NG = PH[2].gold;
        var S = { ph: -1, lies: [], golds: [], plan: 0, gplan: 0, planT: 0, gT: 0, active: false, li: 0, ti: 0, gi: 0, id: 0, oil: 1, oilWarn: 0, truth: null, spot: null, cracks: 0, glowT: 0 };
        function G(k) {
            var W = k.W, H = k.H, ry = H * 0.37, rx = Math.min(W * 0.3, ry * 1.95);
            return { W: W, H: H, cx: W / 2, cy: H * 0.5, rx: rx, ry: ry, lx: W / 2, ly: H * 0.95, br: clamp(H * 0.11, 26, 54) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#2a1630', '#4a2436', '#6a3a2e']); x.fillRect(0, 0, W, H);
                // icon-screen arches behind the mirror (a church sanctuary feel)
                for (var a = 0; a < 6; a++) {
                    var ax = W * (0.04 + a * 0.18), aw = W * 0.12;
                    x.fillStyle = 'rgba(226,179,77,0.08)'; x.beginPath(); x.arc(ax + aw / 2, H * 0.3, aw / 2, Math.PI, 0); x.lineTo(ax + aw, H * 0.86); x.lineTo(ax, H * 0.86); x.closePath(); x.fill();
                    copticCross(x, ax + aw / 2, H * 0.3, clamp(H * 0.03, 6, 12), 'rgba(226,179,77,0.25)');
                }
                x.fillStyle = vgrad(x, H * 0.86, H, ['#5a3322', '#3b2016']); x.fillRect(0, H * 0.86, W, H * 0.14);
                // frame
                x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); ell(x, g.cx + 5, g.cy + 7, g.rx + 16, g.ry + 16); x.fill();
                var fg = x.createLinearGradient(0, g.cy - g.ry, 0, g.cy + g.ry);
                fg.addColorStop(0, '#ffe7a3'); fg.addColorStop(0.5, '#c9912e'); fg.addColorStop(1, '#8a5a18');
                x.fillStyle = fg; x.beginPath(); ell(x, g.cx, g.cy, g.rx + 14, g.ry + 14); x.fill();
                x.fillStyle = C.redD; x.beginPath(); ell(x, g.cx, g.cy, g.rx + 6, g.ry + 6); x.fill();
                x.fillStyle = C.goldL;
                for (var i = 0; i < 40; i++) { var an = i / 40 * TAU; x.beginPath(); circ(x, g.cx + Math.cos(an) * (g.rx + 10), g.cy + Math.sin(an) * (g.ry + 10), 1.8); x.fill(); }
                copticCross(x, g.cx, g.cy - g.ry - 16, clamp(H * 0.05, 10, 20), C.gold, C.goldD, 1.5);
                // glass
                var gg = x.createRadialGradient(g.cx - g.rx * 0.3, g.cy - g.ry * 0.4, 5, g.cx, g.cy, g.rx * 1.1);
                gg.addColorStop(0, '#f4f7fb'); gg.addColorStop(0.5, '#b9c6d6'); gg.addColorStop(1, '#6d7f96');
                x.fillStyle = gg; x.beginPath(); ell(x, g.cx, g.cy, g.rx, g.ry); x.fill();
                x.save(); x.beginPath(); ell(x, g.cx, g.cy, g.rx, g.ry); x.clip();
                x.fillStyle = 'rgba(255,255,255,0.18)';
                x.beginPath(); x.moveTo(g.cx - g.rx * 0.8, g.cy + g.ry); x.lineTo(g.cx - g.rx * 0.45, g.cy + g.ry); x.lineTo(g.cx + g.rx * 0.2, g.cy - g.ry); x.lineTo(g.cx - g.rx * 0.15, g.cy - g.ry); x.closePath(); x.fill();
                x.restore();
            });
        }
        function uv(p) { return { u: (p.x - S.g.cx) / S.g.rx, v: (p.y - S.g.cy) / S.g.ry }; }
        function place() {
            for (var tries = 0; tries < 20; tries++) {
                var u = rand(-0.62, 0.62), v = rand(-0.55, 0.45), ok = u * u + v * v < 0.42;
                for (var i = 0; i < S.lies.length && ok; i++) if (Math.abs(S.lies[i].u - u) < 0.45 && Math.abs(S.lies[i].v - v) < 0.4) ok = false;
                for (var j = 0; j < S.golds.length && ok; j++) if (Math.abs(S.golds[j].u - u) < 0.4 && Math.abs(S.golds[j].v - v) < 0.35) ok = false;
                if (ok) return { u: u, v: v };
            }
            return { u: rand(-0.5, 0.5), v: rand(-0.4, 0.3) };
        }
        function spawnLie(k) {
            var P = PH[S.ph], p = place(), a = rand(0, TAU);
            S.lies.push({ id: S.id++, s: lies[S.li++ % lies.length], u: p.u, v: p.v, vx: Math.cos(a) * P.drift, vy: Math.sin(a) * P.drift * 0.7, g: 0, burn: 0, st: 'on', t: 0 });
            k.sfx('thud');
        }
        function spawnGold(k) {
            var p = place();
            S.golds.push({ id: S.id++, s: ids[S.gi++ % ids.length], u: p.u, v: p.v, lit: 0, st: 'on', t: 0 });
            k.sfx('coin');
        }
        function startPhase(k, n) {
            var P = PH[n];
            S.ph = n; S.active = false; S.plan = P.n; S.gplan = P.gold || 0; S.planT = 0.3; S.gT = 3; S.oil = 1;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.5, function () { S.active = true; });
        }
        function onLie(L) {
            var sp = S.spot;
            if (!sp) return false;
            var x = S.g.cx + L.u * S.g.rx, y = S.g.cy + L.v * S.g.ry, dx = sp.x - x, dy = sp.y - y;
            return dx * dx + dy * dy < S.g.br * S.g.br;
        }
        function shatter(k, L) {
            var g = S.g, x = g.cx + L.u * g.rx, y = g.cy + L.v * g.ry;
            L.st = 'break'; L.t = 0;
            k.hit(10, x, y - 26, { text: '💥 ' });
            k.emit(x, y, 22, { kind: 1, colors: ['#e8f1ff', '#b9c6d6', '#ffffff', C.goldL], grav: 380, vmin: 90, vmax: 260, rmin: 2, rmax: 4 });
            k.glyphBurst(x, y, 4);
            k.shake(3, 0.15); k.sfx('jar');
            if (truths.length) S.truth = { s: truths[S.ti % truths.length], t: 0 };
            S.ti++;
        }
        function crackOut(k, L) {
            var g = S.g, x = g.cx + L.u * g.rx, y = g.cy + L.v * g.ry;
            L.st = 'gone'; L.t = 0; S.cracks = 1;
            if (k.loseLife(x, y - 20, 'الكذبة كبرت!') <= 0) k.finish({ lose: true, title: 'ولا يهمك… صدّق كلام ربنا عنك وجرّب تاني', finaleT: 1.2 });
        }
        function lieXY(L) { return { x: S.g.cx + L.u * S.g.rx, y: S.g.cy + L.v * S.g.ry }; }
        function drawLie(k, ctx, L) {
            var g = S.g, p = lieXY(L), gr = L.st === 'on' ? L.g : 1, rnd = seeded(L.id * 7 + 3), i;
            var a = L.st === 'on' ? 1 : 1 - clamp(L.t / 0.5, 0, 1);
            if (a <= 0) return;
            ctx.save(); ctx.globalAlpha = a;
            var R = g.br * (0.7 + gr * 0.9);
            var sg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, R);
            sg.addColorStop(0, 'rgba(20,10,25,' + (0.55 + gr * 0.35) + ')'); sg.addColorStop(1, 'rgba(20,10,25,0)');
            ctx.fillStyle = sg; ctx.beginPath(); circ(ctx, p.x, p.y, R); ctx.fill();
            ctx.strokeStyle = 'rgba(30,20,40,0.85)'; ctx.lineWidth = 1.4;
            for (i = 0; i < 7; i++) {
                var an = rnd() * TAU, len = (0.35 + rnd() * 0.65) * g.rx * 0.32 * (0.25 + gr), cx = p.x, cy = p.y;
                ctx.beginPath(); ctx.moveTo(cx, cy);
                for (var s = 1; s <= 4; s++) { cx = p.x + Math.cos(an + (rnd() - 0.5) * 0.5) * len * s / 4; cy = p.y + Math.sin(an + (rnd() - 0.5) * 0.5) * len * s / 4; ctx.lineTo(cx, cy); }
                ctx.stroke();
            }
            chip(ctx, L.s, p.x, p.y, clamp(g.H * 0.045, 11, 15), 'rgba(30,12,30,0.88)', '#ffd9d9', 'rgba(255,120,120,0.6)');
            if (L.st === 'on' && L.burn > 0.02) ring(ctx, p.x, p.y, g.br * 0.62, L.burn, C.goldL, 4);
            ctx.restore();
        }

        var k = createCore(host, data, api, {
            title: 'مراية الحقيقة', icon: '🪞',
            howto: { kind: 'hold', text: 'دوس مطوّل على الكذبة اللي في المراية عشان نور القنديل يوصلها، وخليه عليها لحد ما تتكسر وتظهر الحقيقة.' },
            comboStep: 4, maxMult: 3, pad: [138.6, 207.7], lives: 3, factY: 0.82,
            rawMax: function (k) { return perfectSeq(k, rep(NL, 10).concat(rep(NG, 6))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) {
                for (var i = 0; i < S.lies.length; i++) S.lies[i].g = Math.max(0, S.lies[i].g - 0.45);
                S.oil = 1; S.glowT = 1;
                return '🕯️ النور زاد والكذب صغر';
            },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i;
                S.cracks = Math.max(0, S.cracks - dt * 1.5);
                S.glowT = Math.max(0, S.glowT - dt);
                S.oilWarn = Math.max(0, S.oilWarn - dt);
                S.spot = null;
                if (k.pdown && k.px >= 0) {
                    var q = uv({ x: k.px, y: k.py });
                    if (q.u * q.u + q.v * q.v < 1.15 && (!P.oil || S.oil > 0)) S.spot = { x: k.px, y: k.py };
                    if (P.oil && S.spot) { S.oil = Math.max(0, S.oil - dt * 0.1); if (S.oil <= 0 && !S.oilWarn) { S.oilWarn = 4; k.pop(g.lx, g.ly - 40, 'الزيت خلص… نوّر كلمة دهبية', C.goldL, 15); } }
                }
                if (S.active) {
                    var on = 0;
                    for (i = 0; i < S.lies.length; i++) if (S.lies[i].st === 'on') on++;
                    S.planT -= dt;
                    if (S.plan > 0 && on < P.max && S.planT <= 0) { spawnLie(k); S.plan--; S.planT = P.gap; }
                    if (S.gplan > 0) { S.gT -= dt; if (S.gT <= 0) { spawnGold(k); S.gplan--; S.gT = 4.5; } }
                }
                for (i = S.lies.length - 1; i >= 0; i--) {
                    var L = S.lies[i];
                    L.t += dt;
                    if (L.st === 'on') {
                        var hot = onLie(L);
                        L.burn = hot ? L.burn + dt / P.burn : Math.max(0, L.burn - dt * 0.5);
                        L.g += dt / P.grow * (hot ? 0.25 : 1);
                        L.u += L.vx * dt; L.v += L.vy * dt;
                        if (Math.abs(L.u) > 0.62) { L.vx = -L.vx; L.u = clamp(L.u, -0.62, 0.62); }
                        if (L.v < -0.55 || L.v > 0.45) { L.vy = -L.vy; L.v = clamp(L.v, -0.55, 0.45); }
                        if (hot && Math.random() < dt * 25) { var lp = lieXY(L); k.emit(lp.x + rand(-10, 10), lp.y + rand(-8, 8), 1, { colors: [C.goldL, '#fff'], grav: -60, vmin: 5, vmax: 30, rmin: 1.2, rmax: 2.6 }); }
                        if (L.burn >= 1) shatter(k, L);
                        else if (L.g >= 1) { crackOut(k, L); if (k.state !== 'play') return; }
                    } else if (L.t > 0.6) S.lies.splice(i, 1);
                }
                for (i = S.golds.length - 1; i >= 0; i--) {
                    var Gd = S.golds[i];
                    Gd.t += dt;
                    if (Gd.st === 'on') {
                        if (onLie(Gd)) {
                            Gd.lit += dt / 0.55;
                            if (Gd.lit >= 1) {
                                var gp = lieXY(Gd);
                                Gd.st = 'done'; Gd.t = 0; S.oil = Math.min(1, S.oil + 0.45);
                                k.hit(6, gp.x, gp.y - 24, { text: '✨ ' });
                                k.emit(gp.x, gp.y, 16, { colors: [C.goldL, C.gold, '#fff'], up: 60 });
                            }
                        } else Gd.lit = Math.max(0, Gd.lit - dt * 0.4);
                        if (Gd.t > 7.5) { Gd.st = 'fade'; Gd.t = 0; }
                    } else if (Gd.t > 0.8) S.golds.splice(i, 1);
                }
                if (S.truth) { S.truth.t += dt; if (S.truth.t > 3.4) S.truth = null; }
                if (S.active && S.plan <= 0 && S.gplan <= 0 && !S.lies.length && !S.golds.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'المراية بقت بتوريك الحقيقة 🪞✨', finaleT: 2.4 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.9, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 6) k.emit(S.g.cx + rand(-S.g.rx, S.g.rx) * 0.8, S.g.cy + rand(-S.g.ry, S.g.ry) * 0.8, 2, { colors: [C.goldL, '#fff'], grav: -30, up: 20, vmin: 10, vmax: 40 });
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, P = PH[clamp(S.ph, 0, 2)];
                blit(ctx, S.bg, 0, 0);
                ctx.save(); ctx.beginPath(); ell(ctx, g.cx, g.cy, g.rx, g.ry); ctx.clip();
                // the child's reflection: faint at first, clearer as lies break
                var clear = clamp((S.ti + (k.info && k.info.win ? 6 : 0)) / NL, 0, 1);
                ctx.globalAlpha = 0.18 + clear * 0.5;
                youth(ctx, k, g.cx, g.cy + g.ry * 0.95, g.ry * 1.25, 1, -1, '#f3ead6', { halo: clear > 0.6, arm: 0.3 });
                ctx.globalAlpha = 1;
                if (S.cracks > 0) { ctx.fillStyle = 'rgba(120,20,30,' + S.cracks * 0.25 + ')'; ctx.fillRect(g.cx - g.rx, g.cy - g.ry, g.rx * 2, g.ry * 2); }
                if (S.glowT > 0) { ctx.fillStyle = 'rgba(255,236,170,' + S.glowT * 0.35 + ')'; ctx.fillRect(g.cx - g.rx, g.cy - g.ry, g.rx * 2, g.ry * 2); }
                for (i = 0; i < S.golds.length; i++) {
                    var Gd = S.golds[i], gp = lieXY(Gd), ga = Gd.st === 'on' ? clamp(Gd.t * 3, 0, 1) * (Gd.t > 6.5 ? 0.5 + 0.5 * Math.sin(t * 14) : 1) : 1 - clamp(Gd.t / 0.8, 0, 1);
                    ctx.save(); ctx.globalAlpha = clamp(ga, 0, 1);
                    var sc = Gd.st === 'done' ? 1 + eo(Gd.t / 0.8) * 0.5 : 1;
                    ctx.translate(gp.x, gp.y); ctx.scale(sc, sc);
                    starPath(ctx, 0, 0, g.br * 0.55, 0.55); ctx.fillStyle = 'rgba(255,231,163,0.35)'; ctx.fill();
                    chip(ctx, Gd.s, 0, 0, clamp(H * 0.05, 12, 17), C.gold, C.redD, '#fff3cf');
                    if (Gd.st === 'on' && Gd.lit > 0.02) ring(ctx, 0, 0, g.br * 0.62, Gd.lit, '#fff', 3);
                    ctx.restore();
                }
                for (i = 0; i < S.lies.length; i++) drawLie(k, ctx, S.lies[i]);
                ctx.restore();
                // truth banner
                if (S.truth) {
                    var tr = S.truth, ta = tr.t < 0.35 ? eob(tr.t / 0.35) : clamp((3.4 - tr.t) / 0.5, 0, 1);
                    var bw = Math.min(g.rx * 1.8, 460), bh = clamp(H * 0.16, 44, 64), by = g.cy + g.ry * 0.5 - bh / 2;
                    ctx.save(); ctx.globalAlpha = clamp(ta, 0, 1); ctx.translate(g.cx, by + bh / 2); ctx.scale(0.9 + 0.1 * clamp(ta, 0, 1), 0.9 + 0.1 * clamp(ta, 0, 1));
                    ctx.fillStyle = 'rgba(251,241,216,0.97)'; rr(ctx, -bw / 2, -bh / 2, bw, bh, 12); ctx.fill();
                    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
                    drawCross(ctx, bw / 2 - 16, 0, 9, C.red, k.dpr);
                    block(ctx, '«' + tr.s.t + '»', -4, tr.s.ref ? -bh * 0.12 : 0, bw - 50, bh * 0.6, clamp(H * 0.05, 12, 16), 900, '#3c1a08', 2);
                    if (tr.s.ref) txt(ctx, tr.s.ref, -4, bh * 0.3, font(11.5, 800), C.red);
                    ctx.restore();
                }
                // beam from the lamp
                if (S.spot) {
                    var sp = S.spot;
                    ctx.save(); ctx.globalCompositeOperation = 'lighter';
                    var bgd = ctx.createLinearGradient(g.lx, g.ly, sp.x, sp.y);
                    bgd.addColorStop(0, 'rgba(255,220,140,0.55)'); bgd.addColorStop(1, 'rgba(255,240,190,0.12)');
                    var ang = Math.atan2(sp.y - g.ly, sp.x - g.lx) + Math.PI / 2, bwd = g.br * 0.9;
                    ctx.fillStyle = bgd; ctx.beginPath(); ctx.moveTo(g.lx - 4, g.ly - 14); ctx.lineTo(g.lx + 4, g.ly - 14);
                    ctx.lineTo(sp.x + Math.cos(ang) * bwd, sp.y + Math.sin(ang) * bwd); ctx.lineTo(sp.x - Math.cos(ang) * bwd, sp.y - Math.sin(ang) * bwd); ctx.closePath(); ctx.fill();
                    var sg2 = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, g.br * 1.1);
                    sg2.addColorStop(0, 'rgba(255,245,200,0.75)'); sg2.addColorStop(1, 'rgba(255,220,140,0)');
                    ctx.fillStyle = sg2; ctx.beginPath(); circ(ctx, sp.x, sp.y, g.br * 1.1); ctx.fill();
                    ctx.restore();
                }
                // hanging oil lamp (qandil)
                var lx = g.lx, ly = g.ly;
                ctx.fillStyle = '#9a6b1c'; ctx.beginPath(); ctx.moveTo(lx - 18, ly - 10); ctx.quadraticCurveTo(lx, ly + 14, lx + 18, ly - 10); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = C.goldL; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = C.gold; ctx.fillRect(lx - 20, ly - 12, 40, 3);
                flame(ctx, lx, ly - 16, S.spot ? 7 : 5, t);
                if (P.oil && S.ph >= 2) {
                    var ox = lx + 34, oh = clamp(H * 0.14, 30, 50);
                    ctx.fillStyle = 'rgba(20,10,4,0.6)'; rr(ctx, ox, ly - oh, 10, oh, 5); ctx.fill();
                    ctx.fillStyle = S.oil > 0.25 ? C.gold : '#e0443a'; rr(ctx, ox + 2, ly - 2 - (oh - 4) * S.oil, 6, (oh - 4) * S.oil, 3); ctx.fill();
                    txt(ctx, '🫙', ox + 5, ly - oh - 10, font(12, 700), '#fff');
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 3. nehemiahWall -- نحميا يبني السور (نح ٢ - ٦)
     * A stone swings under the builders' crane above each breach in the wall;
     * tap to drop it so it lands straight on the course (3 stones per breach,
     * each breach given to a family, Neh 3). Phase 1: the mockery (don't answer,
     * keep building). Phase 2: enemies come to tear the wall down -- tap them with
     * the sword (Neh 4:17: one hand works, the other holds the weapon). Phase 3
     * (twist): night work and letters of rumour flying by -- tapping a letter
     * means you «came down» and the work stops (Neh 6:3). Data: families[], taunt,
     * prayLine, letters[], letterReply, enemies[], days, questions, intro, outro,
     * facts, phases.
     * ==================================================================== */
    L1_ARCADE.nehemiahWall = function (host, data, api) {
        data = data || {};
        var fams = strList(data.families), letters = strList(data.letters), enemies = strList(data.enemies);
        var DAYS = Math.round(+data.days || 0);
        var PH = [{ b: 2, w: 1.9, en: 0, let: 0 }, { b: 3, w: 2.3, en: 3, let: 0 }, { b: 3, w: 2.6, en: 3, let: 3 }];
        var NB = 8, ROWS = 3, NS = NB * ROWS, NE = 6;
        var S = { ph: -1, cur: 0, B: [], st: 'wait', sw: 0, swT: 0, sx: 0, sy: 0, vy: 0, slide: 1, from: 0, en: [], eplan: 0, eT: 0, lets: [], lplan: 0, lT: 0,
            distract: 0, slowT: 0, placed: 0, drops: 0, say: [], active: false, night: 0, tumble: [], id: 0, bEnd: 0 };
        for (var b0 = 0; b0 < NB; b0++) S.B.push({ st: [], drops: 0 });
        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.9), x0 = W * 0.05, x1 = W * 0.8, cw = (x1 - x0) / NB;
            var bx = [];
            for (var i = 0; i < NB; i++) bx.push(x1 - (i + 0.5) * cw);
            var sh = clamp(H * 0.075, 14, 30);
            return { W: W, H: H, gy: gy, x0: x0, x1: x1, cw: cw, bx: bx, gw: Math.min(cw * 0.62, 66), sh: sh, top: gy - ROWS * sh, py: H * 0.2, hy: H * 0.43, nx: W * 0.9, ph: clamp(H * 0.3, 70, 140) };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                sky(x, W, g.gy, ['#27305e', '#7a5a8a', '#e59a6a', '#f6cf96'], [W * 0.3, g.gy - H * 0.5, H * 0.045]);
                x.fillStyle = 'rgba(120,80,90,0.55)'; ridge(x, W, g.gy - H * 0.3, H * 0.08, 11, 3, g.gy); x.fill();
                // houses of Jerusalem behind the wall
                var r = seeded(17);
                for (var i = 0; i < 16; i++) {
                    var hx = W * 0.02 + i * W * 0.052, hh = H * (0.08 + r() * 0.1), hw = W * 0.05;
                    x.fillStyle = i % 2 ? '#b7926a' : '#a88460'; x.fillRect(hx, g.top - hh + 4, hw, hh);
                    x.fillStyle = r() > 0.6 ? '#ffd27a' : '#4a2c1a'; x.fillRect(hx + hw * 0.4, g.top - hh * 0.65, hw * 0.2, hh * 0.25);
                }
                x.fillStyle = '#9c7a58'; x.beginPath(); x.arc(W * 0.42, g.top - H * 0.16, H * 0.07, Math.PI, 0); x.fill();
                x.fillRect(W * 0.42 - H * 0.07, g.top - H * 0.16, H * 0.14, H * 0.18);
                sand(x, W, H, g.gy - 2, 13);
                // the ruined wall: whole sections between the breaches
                for (var s = 0; s <= NB; s++) {
                    var l = s === NB ? g.x0 - 30 : g.bx[s] + g.gw / 2, rgt = s === 0 ? g.x1 + 10 : g.bx[s - 1] - g.gw / 2;
                    if (rgt <= l) continue;
                    x.fillStyle = vgrad(x, g.top, g.gy, ['#cdb48c', '#a88c66']); x.fillRect(l, g.top, rgt - l, g.gy - g.top);
                    x.strokeStyle = 'rgba(70,45,20,0.35)'; x.lineWidth = 1;
                    for (var ro = 0; ro < ROWS; ro++) {
                        var yy = g.top + ro * g.sh; x.beginPath(); x.moveTo(l, yy); x.lineTo(rgt, yy); x.stroke();
                        for (var bx = l + (ro % 2) * g.gw * 0.3; bx < rgt; bx += g.gw * 0.6) { x.beginPath(); x.moveTo(bx, yy); x.lineTo(bx, yy + g.sh); x.stroke(); }
                    }
                    x.fillStyle = '#b9a07a';
                    for (var cr = l + 4; cr < rgt - 6; cr += 14) x.fillRect(cr, g.top - 6, 8, 6);
                }
                // rubble in the breaches
                for (var b = 0; b < NB; b++) {
                    x.fillStyle = '#7d6a55';
                    for (var q = 0; q < 5; q++) { x.beginPath(); ell(x, g.bx[b] + (q - 2) * g.gw * 0.2, g.gy - 3 - (q % 2) * 3, g.gw * 0.14, 4); x.fill(); }
                }
            });
        }
        function startPhase(k, n) {
            var P = PH[n];
            S.ph = n; S.active = false; S.bEnd = S.cur + P.b; if (S.cur > 0) S.slide = 0; S.eplan = P.en; S.eT = 3.5; S.lplan = P.let; S.lT = 2.5;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; if (S.st === 'wait') { S.st = 'swing'; S.swT = 0; } });
            if (n === 0 && data.taunt) k.after(4, function () { addSay(S, data.taunt, S.g.W * 0.06 + 30, S.g.top - 30, 4.2, enemies[1] || ''); });
            if (n === 1 && data.prayLine) k.after(2.8, function () { addSay(S, data.prayLine, S.g.nx, S.g.gy - S.g.ph - 4, 4); });
        }
        function stonePos() {
            var g = S.g, P = PH[clamp(S.ph, 0, 2)], cx = lerp(g.bx[S.from], g.bx[Math.min(S.cur, NB - 1)], eo(S.slide));
            return { cx: cx, x: cx + Math.sin(S.sw) * g.gw * 1.3, A: P };
        }
        function drop(k) {
            if (S.st !== 'swing' || S.distract > 0 || S.slide < 1 || !S.active) return;
            var p = stonePos();
            S.st = 'fall'; S.sx = p.x; S.sy = S.g.hy; S.vy = 0;
            k.sfx('whoosh');
        }
        function land(k) {
            var g = S.g, br = S.B[S.cur], off = S.sx - g.bx[S.cur], a = Math.abs(off);
            br.drops++; S.drops++;
            if (a <= g.gw * 0.16 || a <= g.gw * 0.42) {
                var perfect = a <= g.gw * 0.16;
                br.st.push(perfect ? 0 : off * 0.3); S.placed++;
                k.hit(perfect ? 10 : 6, g.bx[S.cur], g.top - 20, { text: perfect ? 'مظبوط! ' : '' });
                k.emit(S.sx, S.sy + g.sh / 2, 10, { colors: ['#cdb48c', '#8c7a63', '#fff'], grav: 300, vmin: 30, vmax: 120 });
                k.sfx('thud'); k.shake(2, 0.12);
            } else {
                k.breakCombo(); k.sfx('bad');
                S.tumble.push({ x: S.sx, y: S.sy, vx: off > 0 ? 90 : -90, vy: -60, r: 0, t: 0 });
                k.pop(S.sx, g.top - 16, 'الحجر وقع', '#ffd0c0', 15);
            }
            if (br.drops >= ROWS) {
                if (br.st.length >= ROWS) { k.pop(g.bx[S.cur], g.top - 48, 'القطعة كملت! 🧱', C.goldL, 16); k.glyphBurst(g.bx[S.cur], g.top - 20, 4); }
                S.from = S.cur; S.cur++; S.slide = S.cur < S.bEnd ? 0 : 1;
            }
            S.st = S.cur < S.bEnd ? 'swing' : 'wait'; S.swT = 0;
        }
        function spawnEnemy(k) {
            var g = S.g;
            S.en.push({ id: S.id++, x: g.W + 30, st: 'walk', t: 0, walk: 0, label: enemies.length ? enemies[S.id % enemies.length] : '' });
            k.sfx('horn');
        }
        function spawnLetter(k) {
            S.lets.push({ id: S.id++, x: -60, y: S.g.H * rand(0.25, 0.4), st: 'fly', t: 0, s: letters.length ? letters[S.id % letters.length] : '' });
            k.sfx('page');
        }
        function hitEnemy(p) {
            var g = S.g;
            for (var i = 0; i < S.en.length; i++) { var e = S.en[i]; if (e.st === 'walk' && Math.abs(p.x - e.x) < 34 && p.y > g.gy - g.ph * 0.95 - 20 && p.y < g.gy + 10) return e; }
            return null;
        }
        function hitLetter(p) {
            for (var i = 0; i < S.lets.length; i++) { var l = S.lets[i]; if (l.st === 'fly' && Math.abs(p.x - l.x) < 34 && Math.abs(p.y - l.y) < 26) return l; }
            return null;
        }
        function tap(k, p) {
            var e = hitEnemy(p);
            if (e) {
                e.st = 'run'; e.t = 0;
                k.hit(6, e.x, S.g.gy - S.g.ph - 10, { text: '⚔️ ' });
                k.emit(e.x, S.g.gy - S.g.ph * 0.6, 12, { colors: ['#fff', '#cfd8e3', C.goldL] });
                k.sfx('thud'); k.shake(3, 0.15);
                return;
            }
            var l = hitLetter(p);
            if (l) {
                l.st = 'open'; l.t = 0; S.distract = 1.8;
                k.breakCombo(); k.sfx('bad'); k.flash('255,200,120', 0.3);
                k.pop(l.x, l.y + 30, 'اتشتت… الشغل وقف!', '#ffd0c0', 16);
                return;
            }
            drop(k);
        }
        function stone(ctx, x, y, w, h, tone) {
            ctx.fillStyle = tone || '#d8c29a'; rr(ctx, x - w / 2, y - h / 2, w, h, 3); ctx.fill();
            ctx.strokeStyle = 'rgba(70,45,20,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, 2);
        }

        var k = createCore(host, data, api, {
            title: 'سور نحميا', icon: '🧱',
            howto: { kind: 'tap', text: 'الحجر بيتمرجح فوق الفتحة: اضغط عشان تنزّله مظبوط. لو جه عدو اضغط عليه بالسيف، وأوعى تضغط على الجوابات!' },
            comboStep: 4, maxMult: 3, pad: [130.8, 196], lives: 3, factY: 0.17,
            rawMax: function (k) { return perfectSeq(k, rep(NS, 10).concat(rep(NE, 6))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 9; return '💪 «شدّد يديّ»: الحجر بقى أهدى'; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i;
                S.night += ((S.ph >= 2 ? 0.45 : S.ph >= 1 ? 0.12 : 0) - S.night) * Math.min(1, dt * 0.5);
                S.slowT = Math.max(0, S.slowT - dt);
                S.distract = Math.max(0, S.distract - dt);
                if (S.slide < 1) S.slide = Math.min(1, S.slide + dt * 1.4);
                if (S.st === 'swing' && S.distract <= 0 && S.active) {
                    S.sw += dt * P.w * (S.slowT > 0 ? 0.65 : 1);
                    if (S.slide >= 1) S.swT += dt;
                    if (S.swT > 5.5) { k.pop(g.bx[S.cur], g.hy - 30, 'اتأخرت!', '#ffd0c0', 14); drop(k); }
                } else if (S.st === 'fall') {
                    S.vy += 1400 * dt; S.sy += S.vy * dt;
                    var landY = g.gy - (S.B[S.cur].st.length + 0.5) * g.sh;
                    if (S.sy >= landY) { S.sy = landY; land(k); }
                }
                for (i = S.tumble.length - 1; i >= 0; i--) {
                    var tb = S.tumble[i]; tb.t += dt; tb.vy += 900 * dt; tb.x += tb.vx * dt; tb.y += tb.vy * dt; tb.r += tb.vx * dt * 0.03;
                    if (tb.y > g.gy - g.sh * 0.3) { tb.y = g.gy - g.sh * 0.3; tb.vy = 0; tb.vx *= 0.9; }
                    if (tb.t > 1.4) S.tumble.splice(i, 1);
                }
                if (S.active) {
                    if (S.eplan > 0) { S.eT -= dt; if (S.eT <= 0) { spawnEnemy(k); S.eplan--; S.eT = rand(5, 6.5); } }
                    if (S.lplan > 0) { S.lT -= dt; if (S.lT <= 0) { spawnLetter(k); S.lplan--; S.lT = rand(5, 7); } }
                }
                var target = g.bx[Math.min(S.cur, NB - 1)];
                for (i = S.en.length - 1; i >= 0; i--) {
                    var e = S.en[i];
                    e.t += dt;
                    if (e.st === 'walk') {
                        e.walk += dt * 8; e.x -= g.W * 0.075 * dt;
                        if (e.x <= target + g.gw * 0.7) {
                            e.st = 'run'; e.t = 0;
                            var bb = S.B[Math.min(S.cur, NB - 1)];
                            if (bb.st.length && S.st !== 'fall') { bb.st.pop(); S.placed--; S.tumble.push({ x: target, y: g.gy - (bb.st.length + 0.5) * g.sh, vx: 80, vy: -120, r: 0, t: 0 }); }
                            if (k.loseLife(e.x, g.gy - g.ph, 'هدموا في السور!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… «إله السماء يعطينا النجاح»، جرّب تاني', finaleT: 1.2 }); return; }
                        }
                    } else { e.walk += dt * 10; e.x += g.W * 0.16 * dt; if (e.x > g.W + 60) S.en.splice(i, 1); }
                }
                for (i = S.lets.length - 1; i >= 0; i--) {
                    var l = S.lets[i];
                    l.t += dt;
                    if (l.st === 'fly') {
                        l.x += g.W * 0.085 * dt; l.y += Math.sin(l.t * 2.4) * 18 * dt;
                        if (l.x > g.W + 60) { l.st = 'gone'; if (data.letterReply) addSay(S, data.letterReply, g.nx, g.gy - g.ph - 4, 3.6); }
                    } else if (l.t > 0.8 || l.st === 'gone') S.lets.splice(i, 1);
                }
                sayList(S, dt);
                if (S.active && S.st === 'wait' && S.eplan <= 0 && S.lplan <= 0 && !S.en.length && !S.lets.length) {
                    S.active = false;
                    if (S.ph >= 2) { k.finish({ title: 'السور كمل! 🧱🎉', finaleT: 2.6 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.8, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) { var x = rand(k.W * 0.1, k.W * 0.9); k.emit(x, rand(k.H * 0.15, k.H * 0.4), 10, { colors: [C.goldL, '#ff8fa3', '#fff'], grav: 120 }); }
            },
            down: function (k, p) { tap(k, p); },
            key: function (k, key, isDown) { if (isDown && (key === ' ' || key === 'ArrowDown')) { drop(k); return true; } return false; },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, r;
                blit(ctx, S.bg, 0, 0);
                for (var c = 0; c < 3; c++) cloud(ctx, ((c * 0.37 + t * 0.006) % 1.2 - 0.1) * W, H * (0.1 + c * 0.05), W * 0.05, 0.3);
                // placed stones and family labels
                for (i = 0; i < NB; i++) {
                    var B = S.B[i];
                    for (r = 0; r < B.st.length; r++) stone(ctx, g.bx[i] + B.st[r], g.gy - (r + 0.5) * g.sh, g.gw * 0.92, g.sh - 2, r % 2 ? '#cdb48c' : '#d8c29a');
                    if (B.drops >= ROWS && B.st.length < ROWS) { ctx.fillStyle = '#7d6a55'; ctx.beginPath(); ell(ctx, g.bx[i], g.gy - (B.st.length + 0.2) * g.sh, g.gw * 0.35, 4); ctx.fill(); }
                    if (fams.length && (i === S.cur || B.drops)) chip(ctx, fams[i % fams.length], g.bx[i], g.gy + (H - g.gy) * 0.5, clamp(H * 0.03, 8, 11), i === S.cur ? 'rgba(142,31,31,0.9)' : 'rgba(40,20,5,0.55)', '#ffe9b8');
                }
                if (S.cur < NB && S.st !== 'wait') {
                    ctx.strokeStyle = 'rgba(255,231,163,' + (0.35 + 0.3 * Math.sin(t * 6)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
                    rr(ctx, g.bx[S.cur] - g.gw / 2, g.gy - ROWS * g.sh, g.gw, ROWS * g.sh, 3); ctx.stroke(); ctx.setLineDash([]);
                }
                for (i = 0; i < S.tumble.length; i++) { var tb = S.tumble[i]; ctx.save(); ctx.globalAlpha = 1 - clamp((tb.t - 1) / 0.4, 0, 1); ctx.translate(tb.x, tb.y); ctx.rotate(tb.r); stone(ctx, 0, 0, g.gw * 0.9, g.sh - 2, '#bfa77f'); ctx.restore(); }
                // crane (A-frame) + rope + stone
                if (S.cur < NB || S.st === 'fall') {
                    var sp = stonePos(), cx = sp.cx;
                    ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(cx - g.gw * 1.6, g.top - 4); ctx.lineTo(cx, g.py); ctx.lineTo(cx + g.gw * 1.6, g.top - 4); ctx.stroke();
                    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); circ(ctx, cx, g.py, 5); ctx.fill();
                    if (S.st === 'swing') {
                        ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, g.py); ctx.lineTo(sp.x, g.hy - g.sh / 2); ctx.stroke();
                        stone(ctx, sp.x, g.hy, g.gw * 0.92, g.sh - 2);
                        if (S.distract > 0) txt(ctx, '…', sp.x, g.hy - g.sh, font(18, 900), '#fff', 'center', 3);
                        else if (S.ph === 0 && k.t < 9) txt(ctx, '👆', sp.x, g.hy + g.sh * 1.2, font(18, 700), '#fff');
                    } else if (S.st === 'fall') stone(ctx, S.sx, S.sy, g.gw * 0.92, g.sh - 2);
                }
                // Nehemiah: trowel in one hand, sword in the other (Neh 4:17)
                var nh = youth(ctx, k, g.nx, g.gy - 2, g.ph, -1, -1, '#e9e1cf', { mantle: '#3b5f86', beard: 0.8, hair: '#3a2414', arm: S.en.length ? 2.2 : 0.6, headband: C.gold });
                ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(nh.x, nh.y); ctx.lineTo(nh.x - (S.en.length ? 26 : 6), nh.y - (S.en.length ? 14 : 30)); ctx.stroke();
                ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nh.x - 5, nh.y + 3); ctx.lineTo(nh.x + 5, nh.y - 3); ctx.stroke();
                // enemies
                for (i = 0; i < S.en.length; i++) {
                    var e = S.en[i];
                    figure(ctx, { x: e.x, y: g.gy - 2, h: g.ph * 0.95, dir: e.st === 'walk' ? -1 : 1, robe: '#5a4a3a', mantle: '#2a2a2a', hair: '#1a1a1a', beard: 1, prop: 'rod', walk: e.walk, arm: e.st === 'walk' ? 1.3 : 0.3, t: t, dpr: k.dpr });
                    if (e.label && e.st === 'walk') chip(ctx, e.label, e.x, g.gy - g.ph - 12, 11, 'rgba(40,10,10,0.8)', '#ffd0c0');
                }
                // night overlay + torches
                if (S.night > 0.01) {
                    ctx.fillStyle = 'rgba(10,12,40,' + S.night + ')'; ctx.fillRect(0, 0, W, H);
                    for (i = 0; i < 4; i++) { var fx = g.x0 + (i + 0.5) * (g.x1 - g.x0) / 4; ctx.fillStyle = '#5a3517'; ctx.fillRect(fx - 1.5, g.top - 26, 3, 22); flame(ctx, fx, g.top - 28, 5, t + i); }
                }
                // letters of rumour
                for (i = 0; i < S.lets.length; i++) {
                    var l = S.lets[i], la = l.st === 'fly' ? 1 : 1 - clamp(l.t / 0.8, 0, 1);
                    ctx.save(); ctx.globalAlpha = la; ctx.translate(l.x, l.y); ctx.rotate(Math.sin(l.t * 3) * 0.15);
                    ctx.fillStyle = '#f3e3bf'; rr(ctx, -24, -14, 48, 28, 4); ctx.fill();
                    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.2; ctx.stroke();
                    ctx.fillStyle = '#b83a2a'; ctx.beginPath(); circ(ctx, 0, 6, 5); ctx.fill();
                    ctx.restore();
                    if (l.s && l.st === 'fly') speech(ctx, l.s, l.x, l.y - 16, Math.min(W * 0.3, 240), 11, W, 0.9);
                }
                if (DAYS) {
                    var day = Math.max(1, Math.round(DAYS * S.placed / NS));
                    chip(ctx, 'اليوم ' + ar(day) + ' من ' + ar(DAYS), W * 0.5, 62, 12, 'rgba(40,14,6,0.7)', '#ffe9b8', 'rgba(226,179,77,0.8)');
                }
                drawSay(ctx, S, W, H);
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 4. dayPlanner -- تنظيم الوقت (مصفوفة أيزنهاور، اف ٥: ١٥-١٦)
     * The afternoon is a timeline (right = now, left = night) and the sun walks
     * across it. Task cards arrive in the tray, tagged by the doc's matrix:
     * 🔥 important + urgent (place it before its deadline), 🌱 important not urgent
     * (give it a time), 📞 urgent not important (drop in the "delegate / excuse"
     * box), 📱 time-waster (drop in the bin). Drag a card onto a free slot; it is
     * done when the sun passes it. The last slot is prayer. Phase 2 (twist):
     * time-wasters sneak onto your timeline -- tap them to say "no". Phase 3:
     * a big task too long for any gap -- tap it to split it («فصّص»).
     * Data: tasks[{t, q, len}], wasters[], bigTask {t, parts[]}, bins[2], prayer,
     * questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.dayPlanner = function (host, data, api) {
        data = data || {};
        var byQ = [[], [], [], [], []];
        (data.tasks || []).forEach(function (t) {
            if (t && t.t && t.q >= 1 && t.q <= 4) byQ[t.q | 0].push({ t: plain(t.t), q: t.q | 0, len: clamp((t.len | 0) || 1, 1, 2) });
        });
        for (var q0 = 1; q0 <= 4; q0++) if (!byQ[q0].length) byQ[q0].push({ t: '…', q: q0, len: 1 });
        var wasters = strList(data.wasters);
        if (!wasters.length) wasters = byQ[4].map(function (t) { return t.t; });
        var big = lines2(data.bigTask), bigParts = strList(big.parts).slice(0, 2), hasBig = !!(big.t && bigParts.length === 2);
        var bins = strList(data.bins), prayer = plain(data.prayer || '');
        var QC = ['', '#d9453a', '#2e8b57', '#e6a817', '#7f8c8d'], QI = ['', '🔥', '🌱', '📞', '📱'];
        var NSL = 9, START = 14;
        var PLAN = [[1, 2, 1, 2, 3, 4], [1, 3, 2, 4, 1, 2, 3], [hasBig ? 0 : 2, 1, 3, 2, 4]];
        var PH = [{ day: 34, sneak: 0 }, { day: 36, sneak: 3 }, { day: 36, sneak: 3 }];
        var cntMain = 0, cntSide = 0, qi = [0, 0, 0, 0, 0];
        PLAN.forEach(function (p) { p.forEach(function (q) { if (q === 0) cntMain += 2; else if (q <= 2) cntMain++; else cntSide++; }); });
        var S = { ph: -1, h: 0, occ: [], tray: [], plan: [], planT: 0, blocks: [], drag: null, active: false, sneak: 0, sneakT: 0, id: 0, dayDone: false, slowT: 0, glow: 0 };
        function G(k) {
            var W = k.W, H = k.H, x0 = W * 0.04, x1 = W * 0.96, th = clamp(H * 0.17, 40, 70), ty = H * 0.26;
            var cw = Math.min(W * 0.19, 170), ch = clamp(H * 0.21, 50, 80), try_ = H * 0.8;
            return { W: W, H: H, x0: x0, x1: x1, sw: (x1 - x0) / NSL, ty: ty, th: th, tryY: try_, cw: cw, ch: ch,
                cx: [W * 0.85, W * 0.645, W * 0.44], b3: { x: W * 0.215, y: try_, w: W * 0.13, h: ch }, b4: { x: W * 0.075, y: try_, w: W * 0.12, h: ch } };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                x.fillStyle = vgrad(x, 0, H, ['#f6e2b5', '#efd29a', '#d9b27a']); x.fillRect(0, 0, W, H);
                // a desk: study table with a Coptic border
                x.fillStyle = vgrad(x, H * 0.6, H, ['#8a5a2b', '#6b4220']); x.fillRect(0, H * 0.62, W, H * 0.38);
                x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, H * 0.62, W, 3);
                x.strokeStyle = 'rgba(40,20,5,0.25)'; x.lineWidth = 1;
                for (var i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, H * (0.68 + i * 0.055)); x.bezierCurveTo(W * 0.3, H * (0.66 + i * 0.055), W * 0.7, H * (0.7 + i * 0.055), W, H * (0.67 + i * 0.055)); x.stroke(); }
                // window with the sun path and a small church far away
                x.fillStyle = 'rgba(142,31,31,0.12)'; rr(x, g.x0 - 8, g.ty - 30, g.x1 - g.x0 + 16, g.th + 50, 14); x.fill();
            });
        }
        function slotX(i) { return S.g.x1 - (i + 1) * S.g.sw; }
        function slotAt(px) { return Math.floor((S.g.x1 - px) / S.g.sw); }
        function nextTask(q) { var L = byQ[q]; return L[(qi[q]++) % L.length]; }
        function mkCard(q) {
            if (q === 0) return { id: S.id++, t: plain(big.t), q: 2, len: 4, big: true, st: 'tray' };
            var t = nextTask(q);
            return { id: S.id++, t: t.t, q: q, len: t.len, st: 'tray' };
        }
        function startPhase(k, n) {
            S.ph = n; S.h = 0; S.active = false; S.dayDone = false; S.occ = []; S.blocks = []; S.tray = []; S.drag = null;
            for (var i = 0; i < NSL; i++) S.occ.push(null);
            S.occ[NSL - 1] = 'P';
            S.plan = PLAN[n].slice(); S.planT = 0.2; S.sneak = PH[n].sneak; S.sneakT = 7;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5); });
            k.after(2.4, function () { S.active = true; });
        }
        function trayPos(c) { var i = S.tray.indexOf(c); return { x: S.g.cx[Math.max(0, i)], y: S.g.tryY }; }
        function firstFree() { var s = Math.ceil(S.h + 0.001); return s; }
        function canPlace(c, s) {
            if (s < firstFree() || s < 0 || s + c.len > NSL - 1) return false;
            for (var i = s; i < s + c.len; i++) if (S.occ[i] !== null) return false;
            return true;
        }
        function fromTray(c) { var i = S.tray.indexOf(c); if (i >= 0) S.tray.splice(i, 1); }
        function place(k, c, s) {
            fromTray(c);
            c.st = 'placed'; c.slot = s;
            for (var i = s; i < s + c.len; i++) S.occ[i] = c.id;
            S.blocks.push(c);
            k.sfx('tap');
            k.emit(slotX(s) + S.g.sw * (1 - c.len / 2), S.g.ty + S.g.th / 2, 8, { colors: [QC[c.q], C.goldL, '#fff'], grav: 200, vmin: 30, vmax: 100 });
        }
        function binOf(p) {
            var g = S.g;
            if (inRect(p, { x: g.b3.x - g.b3.w / 2, y: g.b3.y - g.b3.h / 2, w: g.b3.w, h: g.b3.h }, 6)) return 3;
            if (inRect(p, { x: g.b4.x - g.b4.w / 2, y: g.b4.y - g.b4.h / 2, w: g.b4.w, h: g.b4.h }, 6)) return 4;
            return 0;
        }
        function dropCard(k, c, p) {
            var g = S.g, b = binOf(p);
            if (b) {
                if (c.q === b) {
                    fromTray(c); c.st = 'gone';
                    k.hit(6, p.x, p.y - 40, { text: QI[b] + ' ' });
                    k.emit(p.x, p.y, 12, { colors: [QC[b], '#fff'] });
                    k.sfx(b === 4 ? 'whoosh' : 'coin');
                } else { k.pop(p.x, p.y - 40, c.q <= 2 ? 'دي مهمة!' : 'مش المكان ده', '#ffd0c0', 15); k.sfx('tap'); }
                return;
            }
            if (p.y > g.ty - 30 && p.y < g.ty + g.th + 30) {
                if (c.big) { k.pop(p.x, g.ty - 12, 'كبيرة أوي… فصّصها ✂️', '#ffd0c0', 15); k.sfx('tap'); return; }
                var s = slotAt(p.x + g.sw * (c.len - 1) / 2);
                if (c.q === 1 && c.dl != null && s >= c.dl) { k.pop(p.x, g.ty - 12, 'متأخر! 🔥', '#ffd0c0', 15); k.sfx('tap'); return; }
                if (canPlace(c, s)) place(k, c, s);
                else { k.pop(p.x, g.ty - 12, 'المكان ده مش فاضي', '#ffd0c0', 14); k.sfx('tap'); }
            }
        }
        function split(k, c) {
            var i = S.tray.indexOf(c);
            if (i < 0) return;
            var a = { id: S.id++, t: bigParts[0], q: 2, len: 2, st: 'tray' }, b = { id: S.id++, t: bigParts[1], q: 2, len: 2, st: 'tray' };
            S.tray.splice(i, 1, a);
            if (S.tray.length < 3) S.tray.push(b); else S.plan.unshift(b);
            var tp = trayPos(a);
            k.hit(4, tp.x, tp.y - S.g.ch * 0.7, { text: '✂️ ' });
            k.glyphBurst(tp.x, tp.y - 10, 4);
        }
        function sneakIn(k) {
            var free = [];
            for (var s = Math.ceil(S.h + 1.2); s < NSL - 1; s++) if (S.occ[s] === null) free.push(s);
            if (!free.length) return false;
            var sl = free[Math.floor(Math.random() * free.length)];
            var w = { id: S.id++, t: wasters[S.id % wasters.length], q: 4, len: 1, st: 'placed', slot: sl, waster: true, t0: 0 };
            S.occ[sl] = w.id; S.blocks.push(w);
            k.sfx('bad'); k.shake(2, 0.15);
            return true;
        }
        function endDay(k) {
            S.active = false; S.dayDone = true;
            var lost = 0;
            for (var i = 0; i < S.tray.length; i++) if (S.tray[i].q === 1) lost++;
            if (S.drag && S.drag.c.q === 1) lost++;
            S.drag = null;
            for (var j = 0; j < lost; j++) if (k.loseLife(k.W / 2, S.g.tryY - 50, 'مهمة عاجلة ما اتعملتش!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… رتّب أولوياتك وجرّب تاني', finaleT: 1.2 }); return; }
            if (S.ph >= 2) { k.finish({ title: 'يومك اتنظّم! ⏰✨', finaleT: 2.2 }); return; }
            var n2 = S.ph + 1;
            k.after(0.9, function () { k.checkpoint(function () { startPhase(k, n2); }); });
        }
        function drawCard(k, ctx, c, x, y) {
            var g = S.g, w = g.cw, h = g.ch;
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, x - w / 2 + 2, y - h / 2 + 4, w, h, 10); ctx.fill();
            ctx.fillStyle = '#fbf1d8'; rr(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fill();
            ctx.strokeStyle = QC[c.q]; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.fillStyle = QC[c.q]; rr(ctx, x + w / 2 - 22, y - h / 2, 22, h, 10); ctx.fill();
            ctx.fillStyle = '#fbf1d8'; ctx.fillRect(x + w / 2 - 24, y - h / 2 + 1, 4, h - 2);
            txt(ctx, c.big ? '✂️' : QI[c.q], x + w / 2 - 11, y - h * 0.18, font(13, 700), '#fff');
            for (var d = 0; d < Math.min(c.len, 4); d++) { ctx.fillStyle = '#fff'; ctx.beginPath(); circ(ctx, x + w / 2 - 11, y + h * 0.12 + d * 6, 2); ctx.fill(); }
            block(ctx, c.t, x - 10, y, w - 34, h - 12, clamp(h * 0.2, 11, 15), 800, C.ink, 3);
            if (c.q === 1 && c.dl != null && c.st === 'tray') {
                var left = clamp((c.dl - S.h) / 3, 0, 1);
                ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x - w / 2 + 8, y + h / 2 - 7, w - 38, 4);
                ctx.fillStyle = left > 0.35 ? '#e6a817' : '#e0443a'; ctx.fillRect(x - w / 2 + 8, y + h / 2 - 7, (w - 38) * left, 4);
            }
        }

        var k = createCore(host, data, api, {
            title: 'نظّم يومك', icon: '⏰',
            howto: { kind: 'drag', text: 'اسحب كل مهمة لمكان فاضي في اليوم قبل ما الشمس توصله: 🔥 الأول، و🌱 حدد لها ميعاد. 📞 للصندوق و📱 للسلة. ولو حاجة دخلت يومك من غير إذن اضغط عليها!' },
            comboStep: 4, maxMult: 3, pad: [164.8, 247], lives: 3, factY: 0.5,
            rawMax: function (k) { return perfectSeq(k, rep(cntMain, 10).concat(rep(cntSide, 6), rep(6, 6), hasBig ? [4] : [])) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) {
                S.slowT = 7;
                for (var i = 0; i < S.tray.length; i++) if (S.tray[i].dl != null) S.tray[i].dl = Math.min(NSL - 1, S.tray[i].dl + 1);
                return '⏳ الوقت بقى أهدى شوية';
            },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i;
                S.slowT = Math.max(0, S.slowT - dt);
                S.glow = Math.max(0, S.glow - dt);
                if (!S.active) return;
                var prevH = S.h;
                S.h = Math.min(NSL, S.h + dt * NSL / P.day * (S.slowT > 0 ? 0.6 : 1));
                // arrivals
                S.planT -= dt;
                if (S.plan.length && S.tray.length < 3 && S.planT <= 0) {
                    var q = S.plan.shift(), c = typeof q === 'object' ? q : mkCard(q);
                    if (c.q === 1) c.dl = Math.min(NSL - 1, Math.ceil(S.h) + 3);
                    S.tray.push(c); S.planT = 2.3; k.sfx('page');
                }
                // urgent deadlines
                for (i = S.tray.length - 1; i >= 0; i--) {
                    var tc = S.tray[i];
                    if (tc.q === 1 && tc.dl != null && S.h >= tc.dl && !(S.drag && S.drag.c === tc)) {
                        var tp = trayPos(tc);
                        S.tray.splice(i, 1);
                        k.emit(tp.x, tp.y, 14, { colors: ['#ff8a2a', '#e0443a', '#ffe28a'], up: 60 });
                        if (k.loseLife(tp.x, tp.y - 40, 'الحقني… اتأخرت!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… ابدأ بالمهم والعاجل وجرّب تاني', finaleT: 1.2 }); return; }
                    }
                }
                // sneaking time-wasters
                if (S.sneak > 0) { S.sneakT -= dt; if (S.sneakT <= 0) { if (sneakIn(k)) S.sneak--; S.sneakT = rand(5, 7); } }
                // the sun passes blocks
                for (i = S.blocks.length - 1; i >= 0; i--) {
                    var b = S.blocks[i];
                    if (b.st !== 'placed') continue;
                    var bx = slotX(b.slot) + g.sw * (1 - b.len / 2);
                    if (b.waster) {
                        if (S.h >= b.slot) {
                            b.st = 'stole';
                            if (k.loseLife(bx, g.ty - 14, 'الوقت اتسرق!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… قول «لأ» للي بيسرق وقتك وجرّب تاني', finaleT: 1.2 }); return; }
                        }
                    } else if (S.h >= b.slot + b.len) {
                        b.st = 'done';
                        if (b.q <= 2) { k.hit(10, bx, g.ty - 14, { text: '✔ ' }); k.emit(bx, g.ty + g.th / 2, 14, { colors: [QC[b.q], C.goldL, '#fff'] }); }
                        else { k.breakCombo(); k.pop(bx, g.ty - 14, b.q === 3 ? 'ضاع وقت في حاجة مش مهمة' : 'ضيعت وقتك', '#ffd0c0', 14); }
                    }
                }
                if (prevH < NSL - 1 && S.h >= NSL - 1) { S.glow = 2.5; k.sfx('good'); k.glyphBurst(slotX(NSL - 1) + g.sw / 2, g.ty + g.th / 2, 5); }
                if (S.h >= NSL) endDay(k);
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 6) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: [C.goldL, '#9dffb0', '#fff'], grav: 60, up: 40 });
            },
            down: function (k, p) {
                var g = S.g, i;
                if (p.y > g.ty - 6 && p.y < g.ty + g.th + 6) {
                    var s = slotAt(p.x);
                    for (i = 0; i < S.blocks.length; i++) {
                        var b = S.blocks[i];
                        if (b.waster && b.st === 'placed' && b.slot === s) {
                            b.st = 'gone'; S.occ[s] = null;
                            var bx = slotX(s) + g.sw / 2;
                            k.hit(6, bx, g.ty - 14, { text: '✋ ' });
                            k.emit(bx, g.ty + g.th / 2, 14, { colors: ['#7f8c8d', '#fff', C.goldL] });
                            return;
                        }
                    }
                }
                for (i = 0; i < S.tray.length; i++) {
                    var c = S.tray[i], tp = trayPos(c);
                    if (Math.abs(p.x - tp.x) < g.cw / 2 + 4 && Math.abs(p.y - tp.y) < g.ch / 2 + 6) { S.drag = { c: c, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false }; k.sfx('tick'); return; }
                }
            },
            move: function (k, p) {
                if (!S.drag) return;
                S.drag.x = p.x; S.drag.y = p.y;
                if (Math.abs(p.x - S.drag.sx) + Math.abs(p.y - S.drag.sy) > 10) S.drag.moved = true;
            },
            up: function (k, p) {
                var d = S.drag;
                if (!d) return;
                S.drag = null;
                if (S.tray.indexOf(d.c) < 0) return;
                if (!d.moved) { if (d.c.big) split(k, d.c); return; }
                dropCard(k, d.c, p);
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, dusk = clamp(S.h / NSL, 0, 1);
                blit(ctx, S.bg, 0, 0);
                // sky strip through the window: day to night
                var sg = ctx.createLinearGradient(g.x1, 0, g.x0, 0);
                sg.addColorStop(0, '#8fc3e8'); sg.addColorStop(0.55, '#f2a66a'); sg.addColorStop(0.85, '#5a3f7a'); sg.addColorStop(1, '#1d1f4a');
                ctx.fillStyle = sg; rr(ctx, g.x0, g.ty - 24, g.x1 - g.x0, g.th + 24, 8); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,' + dusk * 0.25 + ')'; rr(ctx, g.x0, g.ty - 24, g.x1 - g.x0, g.th + 24, 8); ctx.fill();
                // slots
                for (i = 0; i < NSL; i++) {
                    var sx = slotX(i), past = S.h >= i + 1;
                    ctx.fillStyle = past ? 'rgba(20,10,4,0.35)' : 'rgba(251,241,216,0.28)';
                    rr(ctx, sx + 2, g.ty, g.sw - 4, g.th, 6); ctx.fill();
                    var hr = START + i, lab = hr > 12 ? hr - 12 : hr;
                    txt(ctx, ar(lab), sx + g.sw - 8, g.ty - 12, font(11, 800), '#fff', 'center', 2.5);
                }
                // prayer (fixed)
                var px = slotX(NSL - 1);
                ctx.fillStyle = vgrad(ctx, g.ty, g.ty + g.th, [C.goldL, C.gold]); rr(ctx, px + 2, g.ty, g.sw - 4, g.th, 6); ctx.fill();
                if (S.glow > 0) { ctx.strokeStyle = 'rgba(255,255,255,' + clamp(S.glow, 0, 1) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
                drawCross(ctx, px + g.sw / 2, g.ty + g.th * 0.32, clamp(g.th * 0.16, 6, 11), C.red, k.dpr);
                if (prayer) block(ctx, prayer, px + g.sw / 2, g.ty + g.th * 0.72, g.sw - 8, g.th * 0.4, 10, 900, C.redD, 2);
                // placed blocks
                for (i = 0; i < S.blocks.length; i++) {
                    var b = S.blocks[i];
                    if (b.st === 'gone') continue;
                    var bx0 = slotX(b.slot + b.len - 1) + 2, bw = g.sw * b.len - 4;
                    var sh = b.waster && b.st === 'placed' ? Math.sin(t * 20) * 1.5 : 0;
                    ctx.globalAlpha = b.st === 'done' || b.st === 'stole' ? 0.55 : 1;
                    ctx.fillStyle = b.waster ? '#4a4f56' : QC[b.q]; rr(ctx, bx0 + sh, g.ty + 3, bw, g.th - 6, 6); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
                    block(ctx, (b.waster ? '📱 ' : '') + b.t, bx0 + bw / 2 + sh, g.ty + g.th / 2, bw - 8, g.th - 10, 11, 800, '#fff', 3);
                    if (b.st === 'done' && b.q <= 2) txt(ctx, '✔', bx0 + bw - 8, g.ty + 12, font(12, 900), '#fff', 'center', 2);
                    ctx.globalAlpha = 1;
                }
                // the sun (clock hand)
                var hx = g.x1 - S.h * g.sw;
                ctx.strokeStyle = 'rgba(255,240,190,0.9)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(hx, g.ty - 4); ctx.lineTo(hx, g.ty + g.th + 4); ctx.stroke();
                if (dusk < 0.8) { var sgr = ctx.createRadialGradient(hx, g.ty - 6, 1, hx, g.ty - 6, 16); sgr.addColorStop(0, '#fff3c4'); sgr.addColorStop(0.5, '#ffc94d'); sgr.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = sgr; ctx.beginPath(); circ(ctx, hx, g.ty - 6, 16); ctx.fill(); }
                else { ctx.fillStyle = '#f3ead6'; ctx.beginPath(); circ(ctx, hx, g.ty - 6, 7); ctx.fill(); ctx.fillStyle = '#1d1f4a'; ctx.beginPath(); circ(ctx, hx + 3, g.ty - 8, 6); ctx.fill(); }
                frieze(ctx, k, g.x0, g.ty + g.th + 6, g.x1, 8, 'rgba(142,31,31,0.6)');
                // bins
                var BB = [[g.b3, 3], [g.b4, 4]];
                for (i = 0; i < 2; i++) {
                    var bn = BB[i][0], q = BB[i][1], hot = S.drag && S.drag.moved && binOf({ x: S.drag.x, y: S.drag.y }) === q;
                    ctx.fillStyle = hot ? mixA(QC[q], 0.9) : 'rgba(40,20,5,0.45)'; rr(ctx, bn.x - bn.w / 2, bn.y - bn.h / 2, bn.w, bn.h, 12); ctx.fill();
                    ctx.strokeStyle = QC[q]; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
                    txt(ctx, q === 3 ? '🤝' : '🗑️', bn.x, bn.y - bn.h * 0.16, font(bn.h * 0.3, 700), '#fff');
                    if (bins[i]) block(ctx, bins[i], bn.x, bn.y + bn.h * 0.24, bn.w - 8, bn.h * 0.38, 11, 900, '#fff', 2);
                }
                // tray
                for (i = 0; i < S.tray.length; i++) {
                    var c = S.tray[i];
                    if (S.drag && S.drag.c === c && S.drag.moved) continue;
                    var tp = trayPos(c), bob = c.q === 1 ? Math.sin(t * 8) * 1.2 : 0;
                    drawCard(k, ctx, c, tp.x, tp.y + bob);
                }
                if (S.drag && S.drag.moved) {
                    var dc = S.drag.c;
                    if (S.drag.y < g.ty + g.th + 40 && !dc.big) {
                        var s0 = slotAt(S.drag.x + g.sw * (dc.len - 1) / 2), okP = canPlace(dc, s0) && !(dc.q === 1 && dc.dl != null && s0 >= dc.dl);
                        if (s0 >= 0 && s0 < NSL) { ctx.strokeStyle = okP ? '#9dffb0' : '#ff8a7a'; ctx.lineWidth = 3; rr(ctx, slotX(Math.min(NSL - 1, s0 + dc.len - 1)) + 2, g.ty, g.sw * dc.len - 4, g.th, 6); ctx.stroke(); }
                    }
                    ctx.save(); ctx.translate(S.drag.x, S.drag.y); ctx.scale(0.9, 0.9); ctx.rotate(-0.04);
                    drawCard(k, ctx, dc, 0, 0); ctx.restore();
                }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 5. carryResponsibility -- تحمل المسؤولية
     * The young servant walks on his own carrying a load that keeps tipping.
     * Hold the right or left half of the screen to lean it back; pass each
     * milestone upright for the best score. Blame and complaint voices fly at
     * you and knock the load -- tap a voice to refuse it. If the load falls you
     * lose a heart. Phase 1: your own load. Phase 2: a heavier load for the
     * people around you (group responsibility). Phase 3 (twist): the road up,
     * carrying the cross like Simon of Cyrene -- steeper and windier.
     * Data: voices[], loads[3], questions, intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.carryResponsibility = function (host, data, api) {
        data = data || {};
        var voices = strList(data.voices), loads = strList(data.loads);
        if (!voices.length) voices = ['…'];
        var PH = [{ m: 6, inst: 1.5, cp: 4.4, wind: 0.22, v: 5, load: 'stone' }, { m: 7, inst: 1.9, cp: 4.6, wind: 0.36, v: 7, load: 'basket' }, { m: 7, inst: 2.3, cp: 5, wind: 0.5, v: 8, load: 'cross' }];
        var NM = 20, NV = 20;
        var S = { ph: -1, dist: 0, th: 0, om: 0, ctrl: 0, keyC: 0, drop: 0, fallA: 0, marks: [], vc: [], vplan: 0, vT: 0, active: false, walk: 0, id: 0, slowT: 0, vi: 0, hill: 0, endX: 0 };
        function G(k) {
            var W = k.W, H = k.H, gy = Math.round(H * 0.86);
            return { W: W, H: H, gy: gy, cx: W * 0.6, ph: clamp(H * 0.32, 72, 150), sp: W * 0.13, gap: W * 0.34 };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.far = layer(W, H, k.dpr, function (x) {
                x.fillStyle = 'rgba(160,110,90,0.55)'; ridge(x, W, g.gy - H * 0.2, H * 0.08, 21, 3, g.gy); x.fill();
                church(x, W * 0.3, g.gy - H * 0.12, H * 0.2, 'rgba(150,100,80,0.8)');
            });
            S.mid = layer(W, H, k.dpr, function (x) {
                x.fillStyle = '#c99a62'; ridge(x, W, g.gy - H * 0.04, H * 0.04, 29, 3, H); x.fill();
                palm(x, W * 0.15, g.gy - H * 0.04, H * 0.3, 0.2); palm(x, W * 0.62, g.gy - H * 0.05, H * 0.24, -0.3); palm(x, W * 0.86, g.gy - H * 0.04, H * 0.34, 0.1);
            });
            S.road = layer(W, H - g.gy + 4, k.dpr, function (x, w, h) {
                x.fillStyle = vgrad(x, 0, h, ['#d8b27a', '#c9a36a', '#a8844f']); x.fillRect(0, 0, w, h);
                var r = seeded(31); x.fillStyle = 'rgba(90,60,30,0.28)';
                for (var i = 0; i < 50; i++) { x.beginPath(); ell(x, r() * w, r() * h, 1 + r() * 3, 0.7 + r() * 1.2); x.fill(); }
            });
        }
        function startPhase(k, n) {
            var P = PH[n], g = S.g;
            S.ph = n; S.active = false; S.th = 0; S.om = (Math.random() < 0.5 ? -1 : 1) * 0.15; S.drop = 0;
            S.marks = [];
            for (var i = 0; i < P.m; i++) S.marks.push({ wx: S.dist + g.W * 0.55 + i * g.gap, st: 'on' });
            S.endX = S.dist + g.W * 0.55 + (P.m - 1) * g.gap + g.W * 0.15;
            S.vplan = P.v; S.vT = 2.5;
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.4, function () { S.active = true; });
        }
        function mx(m) { return S.g.cx - (m.wx - S.dist); }
        function pivot() { var g = S.g; return { x: g.cx, y: g.gy - g.ph * 1.02 }; }
        function spawnVoice(k) {
            var g = S.g, side = Math.random() < 0.5 ? -1 : 1, pv = pivot();
            S.vc.push({ id: S.id++, s: voices[S.vi++ % voices.length], x: side < 0 ? -50 : g.W + 50, y: pv.y - g.ph * rand(0.1, 0.5), side: side, st: 'fly', t: 0 });
            k.sfx('whoosh');
        }
        function voiceAt(p) {
            for (var i = 0; i < S.vc.length; i++) { var v = S.vc[i]; if (v.st === 'fly' && Math.abs(p.x - v.x) < 48 && Math.abs(p.y - v.y) < 26) return v; }
            return null;
        }
        function judge(k, m) {
            var g = S.g, pv = pivot(), a = Math.abs(S.th);
            m.st = 'past';
            if (S.drop > 0) { k.pop(g.cx, pv.y - 50, 'فاتتك العلامة', '#ffd0c0', 14); return; }
            if (a < 0.3) { k.hit(10, g.cx, pv.y - 50, { text: 'متزن! ' }); k.glyphBurst(g.cx, pv.y - 30, 3); }
            else if (a < 0.62) k.hit(6, g.cx, pv.y - 50);
            else k.hit(2, g.cx, pv.y - 50, { text: 'بالعافية ' });
        }
        function drawLoad(ctx, kind, x, y, a, u, lab) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(a);
            if (kind === 'cross') {
                ctx.fillStyle = '#7a4a1e'; rr(ctx, -52 * u, -8 * u, 104 * u, 13 * u, 3); ctx.fill();
                rr(ctx, 14 * u, -70 * u, 13 * u, 110 * u, 3); ctx.fill();
                ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 1.2; ctx.stroke();
            } else if (kind === 'basket') {
                ctx.fillStyle = '#b8864a'; ctx.beginPath(); ctx.moveTo(-40 * u, -26 * u); ctx.lineTo(40 * u, -26 * u); ctx.lineTo(30 * u, 4 * u); ctx.lineTo(-30 * u, 4 * u); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.2;
                for (var i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 10 * u, -26 * u); ctx.lineTo(i * 7.5 * u, 4 * u); ctx.stroke(); }
                ctx.fillStyle = '#e0443a'; ctx.beginPath(); circ(ctx, -14 * u, -30 * u, 8 * u); circ(ctx, 6 * u, -33 * u, 9 * u); ctx.fill();
                ctx.fillStyle = '#f1c40f'; ctx.beginPath(); circ(ctx, 22 * u, -30 * u, 7 * u); ctx.fill();
            } else {
                ctx.fillStyle = '#b8a58a'; rr(ctx, -36 * u, -34 * u, 72 * u, 34 * u, 5); ctx.fill();
                ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-36 * u, -17 * u); ctx.lineTo(36 * u, -17 * u); ctx.moveTo(0, -34 * u); ctx.lineTo(0, -17 * u); ctx.moveTo(-18 * u, -17 * u); ctx.lineTo(-18 * u, 0); ctx.moveTo(18 * u, -17 * u); ctx.lineTo(18 * u, 0); ctx.stroke();
            }
            if (lab) chip(ctx, lab, 0, kind === 'cross' ? -2 * u : -14 * u, clamp(10 * u, 9, 13), 'rgba(142,31,31,0.85)', '#ffe9b8');
            ctx.restore();
        }

        var k = createCore(host, data, api, {
            title: 'شيل مسؤوليتك', icon: '🧱',
            howto: { kind: 'hold', text: 'الحِمل بيميل: دوس مطوّل يمين أو شمال عشان ترجّعه في النص. عدّي كل علامة وانت متزن، واضغط على كلام اللوم والشكوى عشان ترفضه!' },
            comboStep: 4, maxMult: 3, pad: [146.8, 196], lives: 3, factY: 0.17,
            rawMax: function (k) { return perfectSeq(k, rep(NM, 10).concat(rep(NV, 5))) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.slowT = 7; S.th *= 0.3; S.om = 0; return '🙏 «شدّد يديّ»: الحمل بقى أخف'; },
            update: function (k, dt) {
                var g = S.g, P = PH[clamp(S.ph, 0, 2)], i, pv = pivot();
                S.slowT = Math.max(0, S.slowT - dt);
                S.hill += ((S.ph >= 2 ? 1 : 0) - S.hill) * Math.min(1, dt * 0.5);
                if (!S.active) return;
                if (!k.pdown) S.ctrl = 0;
                var ctrl = S.keyC || S.ctrl;
                if (S.drop > 0) {
                    S.drop -= dt; S.fallA += dt * 3;
                    if (S.drop <= 0) { S.th = 0; S.om = (Math.random() < 0.5 ? -1 : 1) * 0.1; }
                } else {
                    var wind = P.wind * (Math.sin(k.t * 0.9 + S.ph) + 0.6 * Math.sin(k.t * 2.3 + 1));
                    var acc = P.inst * (S.slowT > 0 ? 0.5 : 1) * S.th + wind + ctrl * P.cp;
                    S.om += acc * dt; S.om *= Math.exp(-1.8 * dt); S.th += S.om * dt;
                    if (Math.abs(S.th) >= 1) {
                        S.drop = 1.3; S.fallA = S.th > 0 ? 1 : -1;
                        k.sfx('thud'); k.emit(g.cx + S.fallA * 40, g.gy - 10, 16, { colors: ['#b8a58a', '#8c7a63', '#fff'], grav: 300 });
                        if (k.loseLife(g.cx, pv.y - 40, 'الحمل وقع!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… قوم تاني وشيل مسؤوليتك', finaleT: 1.2 }); return; }
                    }
                    S.dist += g.sp * dt; S.walk += dt * 7;
                }
                for (i = 0; i < S.marks.length; i++) if (S.marks[i].st === 'on' && mx(S.marks[i]) >= g.cx) judge(k, S.marks[i]);
                if (S.vplan > 0 && S.dist < S.endX - g.W * 0.4) { S.vT -= dt; if (S.vT <= 0) { spawnVoice(k); S.vplan--; S.vT = rand(1.6, 2.6); } }
                for (i = S.vc.length - 1; i >= 0; i--) {
                    var v = S.vc[i];
                    v.t += dt;
                    if (v.st === 'fly') {
                        var dx = pv.x - v.x, dy = pv.y - v.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = g.W * 0.2;
                        v.x += dx / d * sp * dt; v.y += dy / d * sp * dt;
                        if (d < 26) {
                            v.st = 'hit'; v.t = 0;
                            if (S.drop <= 0) { S.om += (v.side < 0 ? 1 : -1) * 1.5; k.sfx('bad'); k.shake(3, 0.2); k.breakCombo(); }
                        }
                    } else if (v.t > 0.6) S.vc.splice(i, 1);
                }
                if (S.dist >= S.endX && S.drop <= 0 && !S.vc.length && S.vplan <= 0) {
                    S.active = false; S.ctrl = 0;
                    if (S.ph >= 2) { k.finish({ title: 'شلت المسؤولية للآخر! 💪', finaleT: 2.4 }); return; }
                    var n2 = S.ph + 1;
                    k.after(0.6, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                }
                if (S.dist >= S.endX) S.vplan = 0;
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.35, 3, { colors: [C.goldL, '#fff'], grav: 60, up: 40 });
            },
            down: function (k, p) {
                var v = voiceAt(p);
                if (v) {
                    v.st = 'pop'; v.t = 0;
                    k.hit(5, v.x, v.y - 20, { text: '🚫 ' });
                    k.emit(v.x, v.y, 12, { colors: ['#6a5a7a', '#fff', C.goldL] });
                    S.ctrl = 0; return;
                }
                S.ctrl = p.x >= k.W / 2 ? 1 : -1;
            },
            move: function (k, p) { if (S.ctrl) S.ctrl = p.x >= k.W / 2 ? 1 : -1; },
            up: function (k) { S.ctrl = 0; },
            key: function (k, key, isDown) {
                if (key === 'ArrowRight' || key === 'ArrowLeft') { S.keyC = isDown ? (key === 'ArrowRight' ? 1 : -1) : 0; return true; }
                return false;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, P = PH[clamp(S.ph, 0, 2)], pv = pivot();
                ctx.fillStyle = vgrad(ctx, 0, g.gy, S.ph >= 2 ? ['#3b2f5e', '#a0607a', '#f0a070'] : ['#4f86c0', '#9cc7e6', '#f6dfb0']);
                ctx.fillRect(0, 0, W, g.gy);
                for (var c = 0; c < 3; c++) cloud(ctx, ((c * 0.41 + S.dist * 0.00012 + t * 0.004) % 1.2 - 0.1) * W, H * (0.1 + c * 0.06), W * 0.05, 0.35);
                blitTiled(ctx, S.far, -S.dist * 0.15, 0, W);
                blitTiled(ctx, S.mid, -S.dist * 0.45, 0, W);
                blitTiled(ctx, S.road, -S.dist, g.gy - 2, W);
                frieze(ctx, k, 0, g.gy - 4, W, 8, 'rgba(142,31,31,0.5)');
                // milestones
                for (i = 0; i < S.marks.length; i++) {
                    var m = S.marks[i], x = mx(m);
                    if (x < -30 || x > W + 30) continue;
                    ctx.fillStyle = m.st === 'on' ? '#b8a58a' : '#9c8a6e'; rr(ctx, x - 9, g.gy - 34, 18, 34, 5); ctx.fill();
                    ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 1; ctx.stroke();
                    drawCross(ctx, x, g.gy - 22, 6, m.st === 'on' ? C.gold : '#8c7a63', k.dpr);
                }
                // balance gauge
                var gr = clamp(g.ph * 0.5, 34, 60), gyy = pv.y - g.ph * 0.62;
                ctx.lineWidth = 6; ctx.lineCap = 'round';
                ctx.strokeStyle = 'rgba(224,68,58,0.7)'; ctx.beginPath(); ctx.arc(pv.x, gyy + gr, gr, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.stroke();
                ctx.strokeStyle = 'rgba(241,196,15,0.85)'; ctx.beginPath(); ctx.arc(pv.x, gyy + gr, gr, -Math.PI / 2 - 0.56, -Math.PI / 2 + 0.56); ctx.stroke();
                ctx.strokeStyle = 'rgba(111,208,140,0.95)'; ctx.beginPath(); ctx.arc(pv.x, gyy + gr, gr, -Math.PI / 2 - 0.27, -Math.PI / 2 + 0.27); ctx.stroke();
                var na = -Math.PI / 2 + clamp(S.th, -1, 1) * 0.9;
                ctx.fillStyle = '#fff'; ctx.beginPath(); circ(ctx, pv.x + Math.cos(na) * gr, gyy + gr + Math.sin(na) * gr, 5); ctx.fill();
                ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
                // carrier + load
                var u = g.ph / 110, lab = loads[clamp(S.ph, 0, 2)] || '';
                youth(ctx, k, g.cx, g.gy - 2, g.ph, -1, S.drop > 0 || !S.active ? -1 : S.walk, '#f3ead6', { arm: 2.8, arm2: 2.8, mantle: '#8e1f1f' });
                if (S.drop > 0) {
                    var fa = clamp(S.fallA, -1, 1), ft = clamp(1.3 - S.drop, 0, 0.5) / 0.5;
                    drawLoad(ctx, P.load, pv.x + fa * ft * 60, lerp(pv.y, g.gy - 12, eo(ft)), fa * (0.9 + ft * 0.7), u, '');
                } else drawLoad(ctx, P.load, pv.x + S.th * 6, pv.y, S.th * 0.9, u, lab);
                if (S.ctrl || S.keyC) txt(ctx, (S.ctrl || S.keyC) > 0 ? '⟶' : '⟵', pv.x + (S.ctrl || S.keyC) * 70, pv.y + 10, font(22, 900), C.goldL, 'center', 3);
                // voices of blame and complaint
                for (i = 0; i < S.vc.length; i++) {
                    var vv = S.vc[i], va = vv.st === 'fly' ? 1 : 1 - clamp(vv.t / 0.6, 0, 1), sc = vv.st === 'pop' ? 1 + vv.t : 1;
                    ctx.save(); ctx.globalAlpha = va; ctx.translate(vv.x, vv.y); ctx.scale(sc, sc);
                    ctx.fillStyle = 'rgba(40,25,50,0.35)'; ctx.beginPath(); ell(ctx, 0, 0, 44, 20); ctx.fill();
                    chip(ctx, vv.s, 0, 0, clamp(H * 0.042, 11, 14), 'rgba(40,25,50,0.9)', '#f0d9ff', 'rgba(200,160,255,0.6)');
                    ctx.restore();
                }
                if (S.ph === 0 && k.t < 8 && S.active) { txt(ctx, '👇', W * 0.85, H * 0.6, font(20, 700), '#fff'); txt(ctx, '👇', W * 0.15, H * 0.6, font(20, 700), '#fff'); }
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };

    /* ======================================================================
     * 6. decisionPath -- حل المشكلات واتخاذ القرارات
     * Cross the river on stepping stones: each hop is one step of the doc's way
     * to solve a problem. Three stones float in front of you -- tap the one that
     * is the NEXT step (the others are a later step or a wrong way: violence,
     * orders, running away, ignoring). Stones sink with time; the right one
     * glows as a hint halfway. Phase 1: the faith steps (pray first). Phase 2:
     * the scientific steps, with a current. Phase 3 (twist): Nehemiah's crisis
     * management -- each «war» comes with its answer. Data: faithSteps[],
     * solveSteps[], wrongWays[], wars[{war, quote, right, wrong[]}], questions,
     * intro, outro, facts, phases.
     * ==================================================================== */
    L1_ARCADE.decisionPath = function (host, data, api) {
        data = data || {};
        var s1 = strList(data.faithSteps).slice(0, 8), s2 = strList(data.solveSteps).slice(0, 7), wrongs = strList(data.wrongWays);
        var wars = (data.wars || []).filter(function (w) { return w && w.war && w.right; }).slice(0, 4).map(function (w) { return { war: plain(w.war), quote: plain(w.quote || ''), right: plain(w.right), wrong: strList(w.wrong) }; });
        if (!s1.length) s1 = ['…'];
        if (!s2.length) s2 = s1.slice();
        var PH = [{ T: 7.5, amp: 0 }, { T: 7, amp: 0.035 }, { T: 7, amp: 0.05 }];
        var NCOL = s1.length + s2.length + (wars.length || 1);
        var S = { ph: -1, cols: [], ci: 0, col: null, hop: 0, scroll: 0, active: false, id: 0, py: 0, fromY: 0, toY: 0, bank: 0, bonusT: 0, sunk: [], flow: 0 };
        function G(k) {
            var W = k.W, H = k.H;
            return { W: W, H: H, top: H * 0.3, bot: H * 0.95, px: W * 0.76, nx: W * 0.46, cw: W * 0.3, sw: Math.min(W * 0.24, 200), sh: clamp(H * 0.12, 30, 50), ph: clamp(H * 0.26, 60, 120), ys: [H * 0.42, H * 0.62, H * 0.82] };
        }
        function layout(k) {
            var g = G(k), W = g.W, H = g.H;
            S.g = g;
            S.bg = layer(W, H, k.dpr, function (x) {
                sky(x, W, g.top, ['#3f6fa8', '#8fc3e8', '#f6dfb0'], [W * 0.15, g.top * 0.45, H * 0.035]);
                x.fillStyle = '#7c8a3a'; ridge(x, W, g.top - H * 0.02, H * 0.04, 41, 3, g.top + 6); x.fill();
                church(x, W * 0.1, g.top - H * 0.01, H * 0.16, '#a88460');
                for (var i = 0; i < 5; i++) palm(x, W * (0.3 + i * 0.16), g.top + 2, H * (0.12 + (i % 2) * 0.04), (i % 2) * 0.3);
                x.fillStyle = vgrad(x, g.top, H, ['#3a88b8', '#1f6fa3', '#0f3d63']); x.fillRect(0, g.top, W, H - g.top);
                x.fillStyle = 'rgba(95,160,90,0.8)';
                for (var r = 0; r < 14; r++) { var rx = (r * 97) % W; x.beginPath(); x.moveTo(rx, g.top + 4); x.lineTo(rx + 3, g.top - 12 - (r % 3) * 4); x.lineTo(rx + 6, g.top + 4); x.fill(); }
            });
        }
        function mkCols(n) {
            var out = [], i;
            if (n < 2) {
                var seq = n === 0 ? s1 : s2;
                for (i = 0; i < seq.length; i++) {
                    var dec = [], fut = seq.slice(i + 1), pool = fut.length ? fut : seq.slice(0, i);
                    if (pool.length) dec.push(pool[Math.floor(Math.random() * Math.min(pool.length, 3))]);
                    var wl = wrongs.filter(function (w) { return dec.indexOf(w) < 0 && w !== seq[i]; });
                    while (dec.length < 2 && wl.length) dec.push(wl.splice(Math.floor(Math.random() * wl.length), 1)[0]);
                    var other = seq.filter(function (s) { return s !== seq[i] && dec.indexOf(s) < 0; });
                    while (dec.length < 2 && other.length) dec.push(other.shift());
                    out.push({ head: 'step', i: i, n: seq.length, right: seq[i], dec: dec });
                }
            } else {
                var L = wars.length ? wars : [{ war: '', quote: '', right: s1[0], wrong: [] }];
                for (i = 0; i < L.length; i++) {
                    var dw = L[i].wrong.slice(0, 2), wl2 = wrongs.slice();
                    while (dw.length < 2 && wl2.length) dw.push(wl2.shift());
                    out.push({ head: 'war', war: L[i].war, quote: L[i].quote, right: L[i].right, dec: dw });
                }
            }
            return out;
        }
        function openCol(k) {
            var c = S.cols[S.ci], g = S.g, opts = [c.right].concat(c.dec), ord = shuffle([0, 1, 2]).slice(0, opts.length);
            S.col = { c: c, t: 0, st: 'open', stones: opts.map(function (s, j) { return { s: s, ok: j === 0, lane: ord[j], st: 'on', t: 0, ph: rand(0, TAU) }; }), T: PH[S.ph].T + (S.bonusT > 0 ? 3 : 0), hinted: false };
            S.bonusT = 0;
            k.sfx('splash');
        }
        function stoneY(st) { var g = S.g, P = PH[clamp(S.ph, 0, 2)]; return g.ys[st.lane] + Math.sin(k.rt * 1.3 + st.ph) * g.H * P.amp; }
        function startPhase(k, n) {
            S.ph = n; S.active = false; S.cols = mkCols(n); S.ci = 0; S.col = null; S.bank = 0; S.py = S.g.ys[1];
            k.phaseCard(n + 1);
            k.after(1.2, function () { k.fact(5.5); });
            k.after(2.5, function () { S.active = true; openCol(k); });
        }
        function hopTo(k, st, ok) {
            var col = S.col;
            col.st = 'hop'; S.hop = 0; S.fromY = S.py; S.toY = stoneY(st); col.pick = st;
            k.sfx('jump');
            if (ok) {
                var fast = col.t < col.T * 0.5;
                k.hit(fast ? 10 : 6, S.g.nx, S.toY - S.g.ph - 10, { text: fast ? 'برافو! ' : '' });
                k.emit(S.g.nx, S.toY, 12, { colors: ['#bfe8ff', '#fff', C.goldL], grav: 280 });
            }
        }
        function choose(k, st) {
            var col = S.col;
            if (!col || col.st !== 'open' || st.st !== 'on') return;
            if (st.ok) { hopTo(k, st, true); return; }
            st.st = 'sunk'; st.t = 0; col.hinted = true;
            k.emit(S.g.nx, stoneY(st), 16, { colors: ['#bfe8ff', '#5fb3d9', '#fff'], grav: 300 });
            k.sfx('splash');
            if (k.loseLife(S.g.nx, stoneY(st) - 30, 'مش دي الخطوة') <= 0) k.finish({ lose: true, title: 'ولا يهمك… صلّي وفكّر خطوة خطوة وجرّب تاني', finaleT: 1.2 });
        }
        function nextCol(k) {
            S.ci++;
            S.scroll = 1;
            if (S.ci >= S.cols.length) {
                S.col = null; S.bank = 1; S.active = false;
                k.glyphBurst(S.g.px, S.py - S.g.ph, 5);
                if (S.ph >= 2) { k.finish({ title: 'وصلت للقرار الصح! 🧭', finaleT: 2.4 }); return; }
                var n2 = S.ph + 1;
                k.after(1, function () { k.checkpoint(function () { startPhase(k, n2); }); });
                return;
            }
            openCol(k);
        }
        function stoneAt(p) {
            var col = S.col, g = S.g;
            if (!col) return null;
            for (var i = 0; i < col.stones.length; i++) { var st = col.stones[i]; if (st.st === 'on' && Math.abs(p.x - lerp(g.nx - g.cw, g.nx, eo(1 - S.scroll))) < g.sw / 2 + 6 && Math.abs(p.y - stoneY(st)) < g.sh / 2 + 10) return st; }
            return null;
        }

        var k = createCore(host, data, api, {
            title: 'طريق القرار', icon: '🧭',
            howto: { kind: 'tap', text: 'قدامك ٣ حجارة في النهر: اضغط على الحجر اللي عليه الخطوة الجاية الصح عشان تنط عليه، قبل ما الحجارة تغطس!' },
            comboStep: 4, maxMult: 3, pad: [146.8, 220], lives: 3, factY: 0.12,
            rawMax: function (k) { return perfectSeq(k, rep(NCOL, 10)) + 2 * k.askBonus; },
            init: function (k) { layout(k); },
            layout: function (k) { layout(k); },
            start: function (k) { startPhase(k, 0); },
            reward: function (k) { S.bonusT = 1; return '⏳ وقت أكتر تفكر فيه'; },
            update: function (k, dt) {
                var g = S.g, col = S.col, i;
                S.flow += dt;
                if (S.scroll > 0) S.scroll = Math.max(0, S.scroll - dt * 2.2);
                for (i = S.sunk.length - 1; i >= 0; i--) { S.sunk[i].t += dt; if (S.sunk[i].t > 1.2) S.sunk.splice(i, 1); }
                if (!col) return;
                for (i = 0; i < col.stones.length; i++) col.stones[i].t += dt;
                if (col.st === 'open') {
                    col.t += dt;
                    if (col.t > col.T * 0.5) col.hinted = true;
                    if (col.t >= col.T) {
                        col.st = 'sunk'; col.t2 = 0;
                        k.sfx('splash');
                        for (i = 0; i < col.stones.length; i++) if (col.stones[i].st === 'on' && !col.stones[i].ok) { col.stones[i].st = 'sunk'; col.stones[i].t = 0; }
                        k.pop(g.nx, g.H * 0.3, plain(col.c.right), C.goldL, 16);
                        if (k.loseLife(g.px, S.py - g.ph, 'الحجارة غطست!') <= 0) { k.finish({ lose: true, title: 'ولا يهمك… صلّي وفكّر خطوة خطوة وجرّب تاني', finaleT: 1.2 }); return; }
                    }
                } else if (col.st === 'sunk') {
                    col.t2 += dt;
                    if (col.t2 > 0.9) { var rs = null; for (i = 0; i < col.stones.length; i++) if (col.stones[i].ok) rs = col.stones[i]; hopTo(k, rs, false); }
                } else if (col.st === 'hop') {
                    S.hop += dt / 0.45;
                    if (S.hop >= 1) { S.py = S.toY; S.sunk.push({ y: S.toY, t: 0 }); nextCol(k); }
                }
            },
            finale: function (k, dt) {
                if (k.info.win && Math.random() < dt * 5) k.emit(rand(0, k.W), k.H * 0.3, 3, { colors: [C.goldL, '#bfe8ff', '#fff'], grav: 60, up: 40 });
            },
            down: function (k, p) { var st = stoneAt(p); if (st) choose(k, st); else k.sfx('tap'); },
            key: function (k, key, isDown) {
                if (!isDown || !S.col) return false;
                var n = '123'.indexOf(key);
                if (n < 0) return false;
                for (var i = 0; i < S.col.stones.length; i++) if (S.col.stones[i].lane === n) choose(k, S.col.stones[i]);
                return true;
            },
            draw: function (k, ctx, W, H) {
                var g = S.g, t = k.rt, i, col = S.col, off = eo(S.scroll) * g.cw;
                blit(ctx, S.bg, 0, 0);
                // current lines
                ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
                for (i = 0; i < 12; i++) {
                    var ly = g.top + 12 + (i * 37) % (g.bot - g.top), lx = ((i * 131 + S.flow * (30 + (i % 3) * 12)) % (W + 120)) - 60;
                    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + 20, ly - 4, lx + 40, ly); ctx.stroke();
                }
                // camera: after each hop the world glides right so the next stones come in from the left
                var e = eo(1 - S.scroll), px = lerp(g.nx, g.px, e), sxC = lerp(g.nx - g.cw, g.nx, e), atStart = S.ci === 0 && !(col && col.st === 'hop');
                if (atStart) { ctx.fillStyle = '#d3a066'; ctx.beginPath(); ell(ctx, W + 20, S.py + 12, W * 0.26, g.sh * 1.7); ctx.fill(); }
                if (S.bank) { ctx.fillStyle = '#d3a066'; ctx.beginPath(); ell(ctx, px, S.py + 12, W * 0.12, g.sh * 1.3); ctx.fill(); drawCross(ctx, px - W * 0.07, S.py - 6, 9, C.gold, k.dpr); }
                else if (!atStart) {
                    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ell(ctx, px, S.py + g.sh * 0.35, g.sw * 0.5, g.sh * 0.26); ctx.fill();
                    ctx.fillStyle = vgrad(ctx, S.py - g.sh / 2, S.py + g.sh / 2, ['#b8a58a', '#7d6a55']); ctx.beginPath(); ell(ctx, px, S.py + 6, g.sw * 0.42, g.sh * 0.4); ctx.fill();
                }
                // choice stones
                if (col) {
                    for (i = 0; i < col.stones.length; i++) {
                        var st = col.stones[i], y = stoneY(st), sink = st.st === 'sunk' ? clamp(st.t / 0.6, 0, 1) : clamp(col.t / col.T, 0, 1) * 0.6;
                        if (col.st === 'hop' && st !== col.pick) sink = Math.max(sink, clamp(S.hop, 0, 1));
                        if (sink >= 1 || (col.st === 'hop' && st === col.pick && S.hop > 0.95)) continue;
                        var sx = sxC;
                        ctx.save(); ctx.globalAlpha = 1 - sink * 0.6;
                        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ell(ctx, sx, y + g.sh * 0.35, g.sw * 0.55 + Math.sin(t * 3 + i) * 3, g.sh * 0.28); ctx.fill();
                        ctx.fillStyle = vgrad(ctx, y - g.sh / 2, y + g.sh / 2, ['#c8b597', '#8c7a63']);
                        ctx.beginPath(); ell(ctx, sx, y + sink * g.sh * 0.3, g.sw / 2, g.sh / 2 * (1 - sink * 0.5)); ctx.fill();
                        if (st.ok && col.hinted && col.st === 'open') { ctx.strokeStyle = 'rgba(255,231,163,' + (0.55 + 0.45 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
                        else { ctx.strokeStyle = 'rgba(60,40,20,0.45)'; ctx.lineWidth = 1.2; ctx.stroke(); }
                        block(ctx, st.s, sx, y + sink * g.sh * 0.3, g.sw - 24, g.sh - 6, clamp(g.sh * 0.32, 11, 15), 900, C.ink, 2);
                        ctx.restore();
                    }
                    // header: step counter or the war
                    var c = col.c;
                    if (c.head === 'step') chip(ctx, 'الخطوة ' + ar(c.i + 1) + ' من ' + ar(c.n), W / 2, 66, 13, 'rgba(142,31,31,0.88)', '#ffe9b8', C.gold);
                    else {
                        if (c.war) chip(ctx, c.war, W / 2, 62, 14, 'rgba(70,12,12,0.92)', '#fff', C.gold);
                        if (c.quote) block(ctx, '«' + c.quote + '»', W / 2, 94, Math.min(W * 0.6, 460), 34, 12, 800, '#fff8e6', 2);
                    }
                    if (col.st === 'open') ring(ctx, sxC + g.sw / 2 + 22, g.ys[0] - g.sh * 0.2, 11, 1 - col.t / col.T, col.t > col.T * 0.7 ? '#e0443a' : C.goldL, 3.5);
                }
                // the young servant hopping
                var hy = S.py, hx = px, lift = 0;
                if (col && col.st === 'hop') { var hp = clamp(S.hop, 0, 1); hx = lerp(g.px, g.nx, eo(hp)); hy = lerp(S.fromY, S.toY, hp); lift = Math.sin(hp * Math.PI) * g.ph * 0.35; }
                youth(ctx, k, hx, hy + 4, g.ph, -1, -1, '#f3ead6', { lift: lift, arm: lift > 2 ? 2.4 : 0.4, jump: lift > 2 ? 1 : 0 });
            }
        });
        S.g = S.g || G(k);
        return k.api2();
    };
})(typeof L1_ARCADE !== 'undefined' ? L1_ARCADE._kit : null);
