// ============================================================
// مين البطل — Game UI layer (game-ui.css companion)
// Loaded last. Everything here is additive: game.js keeps working
// if this file is removed (callers guard with typeof GameUI).
// ============================================================

var GameUI = (function () {
    'use strict';

    var LOOK_KEY = 'minElBatal_look';

    // ---------- Day / night ----------
    function lookPref() {
        try { return localStorage.getItem(LOOK_KEY) || 'auto'; } catch (e) { return 'auto'; }
    }
    function resolveLook(pref) {
        if (pref === 'day' || pref === 'night') return pref;
        var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
        return (h >= 18.5 || h < 5.5) ? 'night' : 'day';
    }
    function applyLook() {
        document.documentElement.setAttribute('data-look', resolveLook(lookPref()));
    }
    function setLook(pref) {
        try { localStorage.setItem(LOOK_KEY, pref); } catch (e) {}
        applyLook();
        markLook();
    }
    function markLook() {
        var p = lookPref();
        document.querySelectorAll('.gx-look').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-look') === p); });
    }

    // ---------- Ambient sky ----------
    function buildSky() {
        if (document.getElementById('gx-sky')) return;
        var sky = document.createElement('div');
        sky.id = 'gx-sky';
        var h = '<div class="gx-moon"></div>';
        var clouds = [[90, 26, 14, 38, 0], [64, 19, 34, 30, -12], [120, 32, 58, 46, -30], [80, 22, 78, 34, -20]];
        clouds.forEach(function (c) {
            h += '<div class="gx-cloud" style="width:' + c[0] + 'px;height:' + c[1] + 'px;top:' + c[2] + '%;animation-duration:' + c[3] + 's;animation-delay:' + c[4] + 's"></div>';
        });
        for (var i = 0; i < 8; i++) {
            h += '<div class="gx-spark" style="left:' + (8 + i * 12) + '%;animation-duration:' + (5 + (i % 3)) + 's;animation-delay:-' + (i * 0.8) + 's"></div>';
        }
        for (var j = 0; j < 22; j++) {
            h += '<div class="gx-star" style="left:' + ((j * 37) % 100) + '%;top:' + ((j * 53) % 90) + '%;animation-delay:-' + ((j % 7) * 0.4) + 's"></div>';
        }
        sky.innerHTML = h;
        document.body.insertBefore(sky, document.body.firstChild);
    }

    // ---------- Small helpers ----------
    function $(id) { return document.getElementById(id); }
    function today() {
        return (typeof getTodayKey === 'function') ? getTodayKey() : new Date().toISOString().split('T')[0];
    }
    function fmt(n) { return (n || 0).toLocaleString('en-US'); }
    function save() {
        try { if (typeof saveToLocalStorage === 'function') saveToLocalStorage(); } catch (e) {}
        try { if (typeof saveToCloud === 'function') saveToCloud(); } catch (e) {}
    }
    function sfx(name) { try { if (typeof playSound === 'function') playSound(name); } catch (e) {} }

    // ---------- Rewards ----------
    // reward: { stars, gems, powerUps: { freeze: 1, ... } }
    function grant(reward, fromEl) {
        if (!reward) return;
        if (reward.stars) GameState.stars = (GameState.stars || 0) + reward.stars;
        if (reward.gems) GameState.gems = (GameState.gems || 0) + reward.gems;
        if (reward.powerUps) {
            if (!GameState.powerUps) GameState.powerUps = {};
            Object.keys(reward.powerUps).forEach(function (k) {
                GameState.powerUps[k] = (GameState.powerUps[k] || 0) + reward.powerUps[k];
            });
        }
        save();
        if (reward.stars) fly(img('star'), fromEl, $('gx-pill-stars'), Math.min(8, 3 + Math.floor(reward.stars / 50)));
        if (reward.gems) fly(img('gem'), fromEl, $('gx-pill-gems'), Math.min(8, 3 + Math.floor(reward.gems / 5)));
        setTimeout(refreshCounters, 900);
    }
    // 3D icon from images/ui (Weave art)
    function img(name) { return '<img class="gx-i" src="images/ui/ic-' + name + '.webp" alt="">'; }
    function rewardIcon(r) {
        if (r.chest) return img('chest');
        if (r.gems && !r.stars) return img('gem');
        if (r.powerUps) return img(POWER_ICON[Object.keys(r.powerUps)[0]] || 'gift');
        return img('star');
    }
    function rewardLabel(r) {
        var p = [];
        if (r.stars) p.push(r.stars + ' ⭐');
        if (r.gems) p.push(r.gems + ' 💎');
        if (r.powerUps) Object.keys(r.powerUps).forEach(function (k) { p.push(r.powerUps[k] + ' ' + (POWER_NAME[k] || k)); });
        return p.join(' · ');
    }
    var POWER_ICON = { fiftyFifty: 'scissors', skip: 'skip', doublePoints: 'stars2', freeze: 'freeze', hint: 'hint' };
    var POWER_NAME = { fiftyFifty: '50:50', skip: 'تخطي', doublePoints: 'نقط مضاعفة', freeze: 'تجميد', hint: 'تلميح' };

    // ---------- Counters + flying icons ----------
    function refreshCounters() {
        countTo($('hub-stars'), GameState.stars || 0);
        countTo($('hub-gems'), GameState.gems || 0);
    }
    // Slot-machine style count from the shown number to the new one
    function countTo(el, to) {
        if (!el) return;
        var from = parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
        if (from === to) { el.textContent = fmt(to); return; }
        var t0 = performance.now(), dur = Math.min(1200, 400 + Math.abs(to - from) * 2);
        (function step(now) {
            var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
            el.textContent = fmt(Math.round(from + (to - from) * e));
            if (k < 1) requestAnimationFrame(step); else pop(el);
        })(t0);
    }
    function pop(el) {
        if (!el) return;
        el.classList.remove('gx-pop'); void el.offsetWidth; el.classList.add('gx-pop');
    }
    function centerOf(el) {
        if (!el || !el.getBoundingClientRect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        var r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function fly(icon, fromEl, toEl, count) {
        if (!toEl || !toEl.offsetParent) return;
        var a = centerOf(fromEl), b = centerOf(toEl);
        for (var i = 0; i < (count || 4); i++) {
            (function (i) {
                var f = document.createElement('div');
                f.className = 'gx-flyer';
                f.innerHTML = icon;
                var jx = (Math.random() - 0.5) * 60, jy = (Math.random() - 0.5) * 40;
                f.style.left = (a.x + jx - 11) + 'px';
                f.style.top = (a.y + jy - 11) + 'px';
                document.body.appendChild(f);
                setTimeout(function () {
                    f.style.transform = 'translate(' + (b.x - a.x - jx) + 'px,' + (b.y - a.y - jy) + 'px) scale(.6)';
                    f.style.opacity = '0';
                }, 30 + i * 70);
                setTimeout(function () { f.remove(); pop(toEl); }, 950 + i * 70);
            })(i);
        }
    }
    function burst(icons, at) {
        var c = centerOf(at);
        icons.forEach(function (ic, i) {
            var b = document.createElement('div');
            b.className = 'gx-burst';
            b.innerHTML = ic;
            var ang = (i / icons.length) * Math.PI * 2, dist = 90 + Math.random() * 70;
            b.style.left = (c.x - 11) + 'px';
            b.style.top = (c.y - 11) + 'px';
            b.style.setProperty('--x', Math.cos(ang) * dist + 'px');
            b.style.setProperty('--y', Math.sin(ang) * dist - 40 + 'px');
            document.body.appendChild(b);
            setTimeout(function () { b.remove(); }, 1500);
        });
    }

    // ---------- Gold toast ----------
    var toastTimer = null;
    function toast(icon, title, sub, onTap) {
        var t = $('gx-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'gx-toast';
            t.className = 'gx-toast';
            document.body.appendChild(t);
        }
        t.innerHTML = '<span class="gx-toast-ic">' + icon + '</span><div style="flex:1"><div class="gx-toast-t">' + title + '</div>' + (sub ? '<div class="gx-toast-s">' + sub + '</div>' : '') + '</div>';
        t.onclick = function () { t.classList.remove('show'); if (onTap) onTap(); };
        clearTimeout(toastTimer);
        requestAnimationFrame(function () { t.classList.add('show'); });
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3800);
    }

    // ---------- Modal frame ----------
    // Other popups (e.g. the verse wheel) wait until our modal closes instead of stacking.
    var queue = [];
    function whenFree(fn) {
        if (document.querySelector('.gx-ov') || pendingDaily) queue.push(fn); else fn();
    }
    function flushQueue() {
        if (document.querySelector('.gx-ov')) return;
        var q = queue; queue = [];
        q.forEach(function (fn) { setTimeout(function () { whenFree(fn); }, 450); });
    }
    var pendingDaily = false;
    function modal(ribbonHtml, bodyHtml, opts) {
        opts = opts || {};
        var ov = document.createElement('div');
        ov.className = 'gx-ov';
        ov.innerHTML = '<div class="gx-rays"></div><div class="gx-modal">' + ribbonHtml +
            (opts.closable === false ? '' : '<button class="gx-close" aria-label="إغلاق">✕</button>') + bodyHtml + '</div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('show'); });
        function close() {
            ov.classList.remove('show');
            setTimeout(function () { ov.remove(); flushQueue(); }, 260);
        }
        var x = ov.querySelector('.gx-close');
        if (x) x.onclick = close;
        ov.addEventListener('click', function (e) { if (e.target === ov && opts.closable !== false) close(); });
        return { el: ov, close: close };
    }

    // ============================================================
    // Daily attendance reward (7-day cycle on top of loginStreak)
    // ============================================================
    var DAILY = [
        { stars: 50 },
        { gems: 5 },
        { stars: 100 },
        { powerUps: { freeze: 1 } },
        { gems: 10 },
        { stars: 200 },
        { stars: 300, gems: 15, powerUps: { hint: 2 }, chest: true }
    ];
    function dailyIndex() { return (((GameState.loginStreak || 1) - 1) % 7 + 7) % 7; }
    function dailyClaimable() { return (GameState.loginStreak || 0) > 0 && GameState.dailyRewardDate !== today(); }

    function dayCell(i, cur, claimable, big) {
        var r = DAILY[i];
        var cls = 'gx-day' + (r.chest ? ' gx-day--chest' : '');
        var label = big ? ('يوم ' + (i + 1)) : (i + 1);
        if (i < cur || (i === cur && !claimable)) cls += ' gx-day--got';
        else if (i === cur && claimable) { cls += ' gx-day--now'; label = 'النهارده'; }
        var inner = big && r.chest ? '<b>' + img('chest') + '</b> يوم ٧: صندوق البطل الكبير' : label + '<b>' + rewardIcon(r) + '</b>' + (big ? rewardLabel(r).split(' · ')[0] : '');
        return '<div class="' + cls + '" data-day="' + i + '">' + inner + '</div>';
    }

    function renderDaily() {
        var box = $('gx-daily');
        if (!box) return;
        var cur = dailyIndex(), claimable = dailyClaimable(), h = '';
        for (var i = 0; i < 7; i++) h += dayCell(i, cur, claimable, false);
        box.innerHTML = h;
        var now = box.querySelector('.gx-day--now');
        if (now) now.onclick = openDaily;
        var sub = $('gx-daily-sub');
        if (sub) sub.textContent = '🔥 ' + (GameState.loginStreak || 0) + ' يوم ورا بعض';
    }

    function openDaily() {
        if (!dailyClaimable() || document.querySelector('.gx-ov')) return;
        var cur = dailyIndex(), grid = '';
        for (var i = 0; i < 7; i++) grid += dayCell(i, cur, true, true);
        var m = modal('<span class="gx-ribbon gx-ribbon--gold">مكافأة الحضور</span>',
            '<div class="gx-modal-sub">ادخل كل يوم واكسب أكتر! 🔥 اليوم ' + (cur + 1) + ' من 7</div>' +
            '<div class="gx-dgrid">' + grid + '</div>' +
            '<button class="gx-btn gx-btn--green gx-throb" id="gx-daily-claim">استلم ' + rewardIcon(DAILY[cur]) + '<span class="gx-shine"></span></button>');
        $('gx-daily-claim').onclick = function () { claimDaily(this, m); };
    }

    function claimDaily(btn, m) {
        if (!dailyClaimable()) { if (m) m.close(); return; }
        var r = DAILY[dailyIndex()];
        GameState.dailyRewardDate = today();
        sfx('correct');
        if (r.chest) {
            if (m) m.close();
            setTimeout(function () { chest(r, 'صندوق البطل الكبير'); }, 280);
        } else {
            burst([rewardIcon(r), '✨', rewardIcon(r), '✨', rewardIcon(r)], btn);
            if (m) m.close();
            setTimeout(function () { grant(r, btn); toast(rewardIcon(r), 'استلمت مكافأة النهارده!', rewardLabel(r)); }, 280);
        }
        renderDaily();
    }

    // Called by checkDailyLoginXP() on the first open of a new day (replaces the silent +5 gems).
    function onNewDay() {
        pendingDaily = true;
        setTimeout(function () {
            pendingDaily = false;
            var hub = $('home-hub-screen');
            if (hub && hub.classList.contains('active') && dailyClaimable()) openDaily();
            else flushQueue();
        }, 700);
    }

    // ============================================================
    // Season track "طريق البطل"
    // ============================================================
    var SEASON_EPOCH = Date.UTC(2026, 8, 7); // Monday 7 Sep 2026
    var SEASON_DAYS = 56;
    var SEASON_HERO_STATIONS = 4;
    var SEASON_TIERS = [
        { need: 100,  free: { stars: 50 },              hero: { gems: 10 } },
        { need: 250,  free: { powerUps: { freeze: 1 } }, hero: { gems: 15 } },
        { need: 450,  free: { gems: 10 },               hero: { powerUps: { doublePoints: 1 } } },
        { need: 700,  free: { stars: 150 },             hero: { gems: 25 } },
        { need: 1000, free: { powerUps: { hint: 2 } },  hero: { stars: 300 } },
        { need: 1400, free: { gems: 20 },               hero: { powerUps: { fiftyFifty: 2, skip: 1 } } },
        { need: 1900, free: { stars: 300 },             hero: { gems: 40 } },
        { need: 2500, free: { gems: 30 },               hero: { stars: 500, gems: 50, chest: true } }
    ];
    function seasonNow() {
        var n = Math.floor((Date.now() - SEASON_EPOCH) / (SEASON_DAYS * 86400000));
        var end = SEASON_EPOCH + (n + 1) * SEASON_DAYS * 86400000;
        return { id: 'S' + (n + 1), num: n + 1, daysLeft: Math.max(1, Math.ceil((end - Date.now()) / 86400000)) };
    }
    function stationsDone() {
        try { return (typeof _countCompletedLessons === 'function') ? _countCompletedLessons() : 0; } catch (e) { return 0; }
    }
    function season() {
        var now = seasonNow();
        var s = GameState.season;
        if (!s || s.id !== now.id) {
            s = { id: now.id, startStars: GameState.stars || 0, startStations: stationsDone(), claimed: [], heroClaimed: [] };
            GameState.season = s;
            save();
        }
        var pts = Math.max(0, (GameState.stars || 0) - (s.startStars || 0));
        var stations = Math.max(0, stationsDone() - (s.startStations || 0));
        var reached = 0;
        SEASON_TIERS.forEach(function (t, i) { if (pts >= t.need) reached = i + 1; });
        var heroOpen = stations >= SEASON_HERO_STATIONS;
        var claimable = 0;
        for (var i = 0; i < reached; i++) {
            if ((s.claimed || []).indexOf(i) < 0) claimable++;
            if (heroOpen && (s.heroClaimed || []).indexOf(i) < 0) claimable++;
        }
        return { s: s, now: now, pts: pts, stations: stations, reached: reached, heroOpen: heroOpen, claimable: claimable };
    }

    function renderSeason() {
        var box = $('gx-season');
        if (!box) return;
        var z = season();
        var start = Math.max(0, Math.min(z.reached - 2, SEASON_TIERS.length - 5)), h = '';
        for (var i = start; i < start + 5; i++) {
            var t = SEASON_TIERS[i];
            var got = (z.s.claimed || []).indexOf(i) >= 0;
            var cls = 'gx-snode', inner = rewardIcon(t.free);
            if (i < z.reached && !got) { cls += ' gx-snode--claim'; inner += '<span class="gx-badge">!</span>'; }
            else if (i < z.reached) cls += ' gx-snode--ok';
            if (i > start) h += '<div class="gx-slink' + (i <= z.reached ? ' gx-slink--ok' : '') + '"></div>';
            h += '<div class="' + cls + '">' + inner + '</div>';
        }
        var next = SEASON_TIERS[Math.min(z.reached, SEASON_TIERS.length - 1)];
        var pct = Math.min(100, Math.round(z.pts / next.need * 100));
        box.innerHTML = '<div class="gx-season-h"><b>طريق البطل · الموسم ' + z.now.num + '</b><span>باقي ' + z.now.daysLeft + ' يوم</span></div>' +
            '<div class="gx-strack">' + h + '</div>' +
            '<div class="gx-season-bar"><i style="width:' + pct + '%"></i></div>' +
            '<div class="gx-season-foot">⭐ ' + fmt(z.pts) + ' / ' + fmt(next.need) + ' في الموسم' +
            (z.claimable ? ' · عندك ' + z.claimable + ' هدية مستنياك 🎁' : '') + '</div><span class="gx-shine"></span>';
    }

    function openSeason() {
        var z = season(), rows = '';
        SEASON_TIERS.forEach(function (t, i) {
            var reached = i < z.reached;
            var fGot = (z.s.claimed || []).indexOf(i) >= 0, hGot = (z.s.heroClaimed || []).indexOf(i) >= 0;
            rows += '<div class="gx-srow">' +
                '<div class="gx-stier' + (reached ? ' ok' : (i === z.reached ? ' now' : '')) + '">' + (i + 1) + '</div>' +
                rewardCell(t.free, reached, fGot, i, 'free') +
                rewardCell(t.hero, reached && z.heroOpen, hGot, i, 'hero', !z.heroOpen) +
                '</div>';
        });
        var m = modal('<span class="gx-ribbon gx-ribbon--purple">طريق البطل · الموسم ' + z.now.num + '</span>',
            '<div class="gx-modal-sub">⭐ ' + fmt(z.pts) + ' نجمة في الموسم · باقي ' + z.now.daysLeft + ' يوم</div>' +
            '<div class="gx-shead"><span></span><span>🆓 للكل</span><span class="hero">⚔️ مسار الأبطال</span></div>' +
            '<div class="gx-snote">' + (z.heroOpen ? 'مسار الأبطال مفتوح ليك! 🎉' : 'مسار الأبطال بيتفتح لما تخلّص ' + SEASON_HERO_STATIONS + ' محطات في الموسم (' + z.stations + '/' + SEASON_HERO_STATIONS + ')') + '</div>' +
            '<div class="gx-srows">' + rows + '</div>');
        m.el.querySelectorAll('[data-claim]').forEach(function (b) {
            b.onclick = function () {
                var p = this.getAttribute('data-claim').split(':');
                claimSeason(parseInt(p[0], 10), p[1], this, m);
            };
        });
    }
    function rewardCell(r, open, got, i, track, locked) {
        var cls = 'gx-srew gx-srew--' + track + (got ? ' got' : '') + (locked ? ' lock' : '') + (open && !got ? ' claim' : '');
        var attr = open && !got ? ' data-claim="' + i + ':' + track + '"' : '';
        return '<button class="' + cls + '"' + attr + '><span>' + rewardIcon(r) + '</span><small>' + (open && !got ? 'استلم!' : rewardLabel(r)) + '</small></button>';
    }
    function claimSeason(i, track, btn, m) {
        var z = season();
        if (i >= z.reached) return;
        var list = track === 'hero' ? (z.s.heroClaimed = z.s.heroClaimed || []) : (z.s.claimed = z.s.claimed || []);
        if (list.indexOf(i) >= 0 || (track === 'hero' && !z.heroOpen)) return;
        list.push(i);
        var r = SEASON_TIERS[i][track];
        sfx('correct');
        if (r.chest) {
            m.close();
            setTimeout(function () { chest(r, 'جايزة بطل الموسم'); }, 280);
        } else {
            burst([rewardIcon(r), '✨', rewardIcon(r)], btn);
            grant(r, btn);
            btn.className = btn.className.replace(' claim', '') + ' got';
            btn.removeAttribute('data-claim');
            btn.querySelector('small').textContent = rewardLabel(r);
        }
        renderSeason();
    }

    // ============================================================
    // Reward moments
    // ============================================================
    // opts.granted = reward was already added by the caller (visual only)
    function chest(reward, title, opts) {
        opts = opts || {};
        var loot = [];
        if (reward.stars) loot.push(img('star'));
        if (reward.gems) loot.push(img('gem'));
        if (reward.powerUps) loot.push(img(POWER_ICON[Object.keys(reward.powerUps)[0]] || 'gift'));
        var lootHtml = loot.map(function (ic, i) { return '<div class="gx-loot" data-i="' + i + '">' + ic + '</div>'; }).join('');
        var m = modal('<span class="gx-ribbon gx-ribbon--purple">' + (title || 'صندوق المفاجآت') + '</span>',
            '<div class="gx-modal-sub" id="gx-chest-hint">دوس على الصندوق علشان تفتحه!</div>' +
            '<div class="gx-chest-stage" id="gx-chest-stage"><div class="gx-chest-beam"></div>' +
            '<div class="gx-chest" id="gx-chest"><div class="base"><div class="band" style="left:22px"></div><div class="band" style="right:22px"></div></div>' +
            '<div class="lid"><div class="band" style="left:20px"></div><div class="band" style="right:20px"></div></div><div class="lock"></div></div>' + lootHtml + '</div>' +
            '<div class="gx-modal-sub" id="gx-chest-got" style="visibility:hidden">' + rewardLabel(reward) + '</div>' +
            '<button class="gx-btn gx-btn--green" id="gx-chest-btn" style="visibility:hidden">استلم الكل</button>', { closable: false });
        var c = $('gx-chest'), opened = false;
        function open() {
            if (opened) return;
            opened = true;
            c.classList.add('shake');
            sfx('click');
            setTimeout(function () {
                c.classList.add('open');
                $('gx-chest-stage').classList.add('open');
                var n = loot.length;
                m.el.querySelectorAll('.gx-loot').forEach(function (l, i) {
                    var x = (i - (n - 1) / 2) * 90;
                    setTimeout(function () { l.style.transform = 'translate(' + x + 'px,-120px) scale(1.2)'; }, 60 * i);
                });
                $('gx-chest-hint').style.visibility = 'hidden';
                $('gx-chest-got').style.visibility = 'visible';
                $('gx-chest-btn').style.visibility = 'visible';
                sfx('correct');
                try { if (typeof launchConfetti === 'function') launchConfetti(1800); } catch (e) {}
            }, 900);
        }
        c.onclick = open;
        setTimeout(open, 2200);
        $('gx-chest-btn').onclick = function () { if (opts.granted) { refreshCounters(); } else { grant(reward, this); } m.close(); };
    }

    function tierUp(charKey, tier, title) {
        var ch = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[charKey] : null;
        var names = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي 👑' };
        var m = modal('<span class="gx-ribbon gx-ribbon--gold">ترقية!</span>',
            '<div class="gx-emb ' + tier + ' pop"><div class="sh"></div><div class="sh2"><img src="' + charImage(charKey) + '" alt=""></div><img class="gx-emb-badge" src="images/ui/ic-tier-' + tier + '.webp" alt=""></div>' +
            '<div class="gx-modal-title">' + (ch ? ch.name : '') + ' · ' + (names[tier] || tier) + '</div>' +
            (title ? '<div class="gx-pill" style="background:linear-gradient(#FFE766,#FFB300);color:#5A2E00;border-color:#fff">لقب جديد: ' + title + '</div>' : '') +
            '<br><button class="gx-btn gx-btn--green gx-throb">يا سلام!</button>');
        m.el.querySelector('.gx-btn').onclick = m.close;
        sfx('correct');
        try { if (typeof launchConfetti === 'function') launchConfetti(2200); } catch (e) {}
    }

    // Transparent cut-out when we have one, else the character's normal image.
    var CUTOUTS = { david: 1, paul: 1, george: 1, philomena: 1, verina: 1, esther: 1 };
    function charImage(key) {
        if (CUTOUTS[key]) return 'images/chars/' + key + '.png';
        var ch = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[key] : null;
        return ch ? ch.image : 'images/chars/david.png';
    }

    // ============================================================
    // Answer juice: praise word + combo on every correct answer
    // ============================================================
    var combo = 0, comboAt = 0;
    var PRAISE = ['صح! ✓', 'برافو! 👏', 'رائع! 🔥', 'ممتاز! 🔥🔥'];
    function praise() {
        combo = (Date.now() - comboAt < 25000) ? combo + 1 : 1;
        comboAt = Date.now();
        var word = combo <= PRAISE.length ? PRAISE[combo - 1] : 'بطل! 👑';
        var el = document.createElement('div');
        el.className = 'gx-praise';
        el.innerHTML = word + (combo >= 3 ? '<small>كومبو x' + combo + '</small>' : '');
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 1100);
    }
    function breakCombo() { combo = 0; }

    // ============================================================
    // Hub
    // ============================================================
    // ---------- "كمّل رحلتك": the subject the player is in the middle of ----------
    var CONTINUE_ART = { l1_bible: 'card-l1', l1_service: 'card-faith', l2_life: 'card-life', l2_bible: 'card-james' };
    var CONTINUE_HERO = { l1_bible: 'david', l1_service: 'verina', l2_life: 'philomena', l2_bible: 'paul' };
    var continueKey = null;
    function pickSubject() {
        if (typeof LEVEL1_SUBJECTS === 'undefined' || typeof l1SubjectProgress !== 'function') return null;
        var best = null;
        Object.keys(LEVEL1_SUBJECTS).forEach(function (key) {
            if (typeof isContentLocked === 'function' && isContentLocked('subject_' + key)) return;
            var p = l1SubjectProgress(key);
            if (p.passed >= p.total) return;
            if (!best || p.pts > best.p.pts) best = { key: key, p: p };
        });
        return best;
    }
    function renderContinue() {
        var box = $('gx-continue');
        if (!box) return;
        var pick = pickSubject();
        if (!pick) { box.style.display = 'none'; return; }
        box.style.display = '';
        continueKey = pick.key;
        var sub = LEVEL1_SUBJECTS[pick.key], st = sub.stations[pick.p.passed] || {};
        $('gx-continue-title').textContent = sub.name;
        $('gx-continue-sub').textContent = (sub.level === 2 ? 'المستوى الثاني' : 'المستوى الأول') + ' · المحطة ' + (pick.p.passed + 1) + ' من ' + pick.p.total + (st.title ? ': ' + st.title : '');
        $('gx-continue-bar').style.width = Math.round(pick.p.passed / pick.p.total * 100) + '%';
        $('gx-continue-art').style.backgroundImage = "url('images/ui/" + (CONTINUE_ART[pick.key] || 'card-l2') + ".webp')";
        $('gx-continue-hero').src = charImage(CONTINUE_HERO[pick.key] || 'david');
    }
    function continueJourney() {
        if (continueKey && typeof l1OpenSubject === 'function') l1OpenSubject(continueKey);
    }

    function renderTopbar() {
        try {
            var lv = (typeof getPlayerLevel === 'function') ? getPlayerLevel() : 1;
            var info = (typeof getXpForNextLevel === 'function') ? getXpForNextLevel() : { progress: 0 };
            if ($('gx-level')) $('gx-level').textContent = lv;
            if ($('gx-xp-fill')) $('gx-xp-fill').style.width = (info.progress || 0) + '%';
        } catch (e) {}
        countTo($('hub-stars'), GameState.stars || 0);
        countTo($('hub-gems'), GameState.gems || 0);
        var img = $('hub-avatar-img');
        if (img && GameState.character) img.src = charImage(GameState.character);
        var wb = $('gx-wheel-badge');
        if (wb) wb.style.display = GameState.dailySpinDate !== today() ? '' : 'none';
    }

    function renderProgress() {
        var el = $('gx-prog-l1');
        if (!el || typeof L1_SUBJECT_LIST === 'undefined' || typeof l1SubjectProgress !== 'function') return;
        var passed = 0, total = 0;
        L1_SUBJECT_LIST.forEach(function (it) {
            if (typeof LEVEL1_SUBJECTS !== 'undefined' && !LEVEL1_SUBJECTS[it.key]) return;
            var p = l1SubjectProgress(it.key);
            passed += p.passed; total += p.total;
        });
        if (!total) return;
        el.innerHTML = 'محطة ' + passed + ' من ' + total + '<div class="bar"><i style="width:' + Math.round(passed / total * 100) + '%"></i></div>';
        el.style.display = '';
    }

    function renderHub() {
        renderTopbar();
        renderDaily();
        renderSeason();
        renderContinue();
        renderProgress();
    }

    function scrollHubTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

    // Screens that show the bottom tab bar (lobby-style screens)
    var NAV_SCREENS = { 'home-hub-screen': 1, 'shop-screen': 1, 'compete-screen': 1, 'leaderboard-screen': 1, 'teams-screen': 1, 'rewards-shop-screen': 1, 'progress-dashboard-screen': 1, 'museum-screen': 1 };
    function nav(id) {
        var cur = document.querySelector('.screen.active');
        if (cur && cur.id === id) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        showScreen(id);
    }
    function onScreen(id) {
        var el = $(id);
        if (!el || !el.classList.contains('active')) return;
        document.body.setAttribute('data-screen', id); // picks the fixed backdrop art (game-ui.css)
        var showNav = !!NAV_SCREENS[id];
        document.body.classList.toggle('gx-nav-on', showNav);
        if (showNav) {
            document.querySelectorAll('#gx-nav [data-nav]').forEach(function (b) {
                b.classList.toggle('on', b.getAttribute('data-nav') === id);
            });
        }
        if (id === 'home-hub-screen') renderHub();
        if (id === 'settings-screen') markLook();
        renderHero(id);
        scheduleScan();
    }

    // ============================================================
    // Motion layer: tap sparkles + cards that pop in as they scroll into view
    // ============================================================
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var TAPPABLE = 'button, .btn, [onclick], .gx-qbtn, .l1-subject-card, .l1-game-card, .compete-mode-card';
    function tapSpark(e) {
        if (reduceMotion || !document.documentElement.hasAttribute('data-look')) return;
        if (!e.target.closest || !e.target.closest(TAPPABLE)) return;
        var r = document.createElement('div');
        r.className = 'gx-tap';
        r.style.left = e.clientX + 'px';
        r.style.top = e.clientY + 'px';
        for (var i = 0; i < 6; i++) {
            var d = document.createElement('i');
            d.style.setProperty('--a', (i * 60) + 'deg');
            r.appendChild(d);
        }
        document.body.appendChild(r);
        setTimeout(function () { r.remove(); }, 600);
    }
    var REVEAL = '.gx-ribbon, .hub-card, .gx-season, .gx-continue, .spiritual-card, .l2-subject-card, .shop-item-card, .reward-card, ' +
        '.compete-mode-card, .lb-item-modern, .achievement-card, .l1-game-card, .l1-subject-card, .settings-section, .museum-card, ' +
        '.pd-stat-card, .exercise-item, .lamp-mission-card, .qa-thread-row, .social-post, .info-way-card, .bible-ch-item, .category-card';
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            io.unobserve(el);
            // stagger siblings that enter together
            var idx = Array.prototype.indexOf.call(el.parentNode ? el.parentNode.children : [], el);
            el.style.setProperty('--gx-d', (Math.min(Math.max(idx, 0), 8) * 0.06) + 's');
            el.classList.add('gx-reveal');
            el.addEventListener('animationend', function done(ev) {
                if (ev.animationName !== 'gxReveal') return;
                el.classList.remove('gx-reveal');
                el.removeEventListener('animationend', done);
            });
        });
    }, { threshold: 0.12 }) : null;
    function scanReveal() {
        if (!io || reduceMotion) return;
        document.querySelectorAll('.screen.active ' + REVEAL.split(', ').join(', .screen.active ')).forEach(function (el) {
            if (el._gxSeen) return;
            el._gxSeen = true;
            io.observe(el);
        });
    }
    // ============================================================
    // Screen heroes: art banner + 3D icon + title on content screens
    // ============================================================
    var HEROES = {
        'teams-screen': { icon: 'friends', art: 'card-compete', tint: '200,20,110', title: 'فريقي', sub: function () { return GameState.team ? 'فريق «' + GameState.team + '» · العبوا ونافسوا سوا' : 'كوّن فريقك أو انضم لأصحابك'; } },
        'settings-screen': { icon: 'gear', art: 'bg-hub-day', tint: '25,90,200', title: 'الإعدادات', sub: 'خصّص شكل لعبتك وإشعاراتك' },
        'museum-screen': { icon: 'museum', art: 'card-faith', tint: '106,53,217', title: 'متحف الكنوز', sub: 'كل كنز بتجمعه من دروسك بيتعرض هنا' },
        'info-screen': { icon: 'compass', art: 'card-l2', tint: '25,90,200', title: 'دليل اللعبة', sub: 'إزاي تلعب وتكسب نجوم وجواهر' },
        'rewards-shop-screen': { icon: 'gift', art: 'bg-shop', tint: '190,90,10', title: 'متجر الهدايا', sub: 'استبدل نجومك وجواهرك بهدايا حقيقية' },
        'bible-reading-screen': { icon: 'bible', art: 'card-james', tint: '90,50,200', title: 'إنجيل مار مرقس', sub: 'أصحاح كل يوم يقرّبك أكتر' },
        'devotion-screen': { icon: 'candle', art: 'bg-spiritual', tint: '90,50,200', title: 'خلوتي الشخصية', sub: 'وقتك الخاص مع ربنا الصبح وبليل' },
        'exercises-screen': { icon: 'dumbbell', art: 'bg-spiritual', tint: '90,50,200', title: 'التداريب الروحية', sub: 'تمرين صغير كل يوم بيعمل فرق كبير' },
        'shop-screen': { icon: 'sword', art: 'bg-shop', tint: '150,70,10', title: 'متجر سلاح الله', sub: 'البس سلاح الله الكامل واكسب قوى جديدة' },
        'lamp-screen': { icon: 'lamp', art: 'bg-spiritual', tint: '120,60,10', title: 'سراجك', sub: 'كل مهمة بتعملها بتنوّر سراجك أكتر ✨' }
    };
    function renderHero(id) {
        var cfg = HEROES[id], screen = $(id);
        if (!cfg || !screen) return;
        var inner = screen.querySelector('.screen-inner') || screen;
        var hero = inner.querySelector(':scope > .gx-hero');
        if (!hero) {
            hero = document.createElement('div');
            hero.className = 'gx-hero';
            hero.style.setProperty('--tint', cfg.tint);
            hero.innerHTML = '<div class="gx-hero-art" style="background-image:url(\'images/ui/' + cfg.art + '.webp\')"></div>' +
                '<div class="gx-rays gx-hero-rays"></div><img class="gx-hero-ic" src="images/ui/ic-' + cfg.icon + '.webp" alt="">' +
                '<div class="gx-hero-txt"><div class="gx-hero-title">' + cfg.title + '</div><div class="gx-hero-sub"></div></div><span class="gx-shine"></span>';
            var bar = inner.querySelector(':scope > .top-bar, :scope > .lamp-top-bar');
            if (bar) bar.insertAdjacentElement('afterend', hero); else inner.insertBefore(hero, inner.firstChild);
            screen.classList.add('gx-heroed');
        }
        hero.querySelector('.gx-hero-sub').textContent = typeof cfg.sub === 'function' ? cfg.sub() : cfg.sub;
    }

    // ============================================================
    // تقدّمي: player profile page (replaces the plain dashboard markup)
    // ============================================================
    var JOURNEY_ART = { l1_bible: 'card-l1', l1_service: 'card-faith', l2_life: 'card-life', l2_bible: 'card-james', faith: 'card-faith', ritual: 'card-faith' };
    function renderProfile() {
        var box = $('progress-dashboard-body');
        if (!box) return;
        var ch = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[GameState.character] : null;
        var lv = 1, xp = { progress: 0, xpInLevel: 0, xpNeeded: 0 }, phase = { name: '', color: '#FFB300' }, rank = { title: '', emoji: '' }, tier = 'bronze';
        try { lv = getPlayerLevel(); xp = getXpForNextLevel(); phase = getLevelPhase(); } catch (e) {}
        try { rank = getRank(); } catch (e) {}
        try { tier = getCharacterTier(GameState.character) || 'bronze'; } catch (e) {}
        var title = (GameState.equippedTitle && typeof PLAYER_TITLES !== 'undefined' && PLAYER_TITLES[GameState.equippedTitle]) ? PLAYER_TITLES[GameState.equippedTitle].name : (rank.emoji + ' ' + rank.title);
        var h = '';
        // hero card
        h += '<div class="gx-profile">' +
            '<div class="gx-rays gx-profile-rays"></div>' +
            '<img class="gx-profile-char" src="' + charImage(GameState.character || 'david') + '" alt="">' +
            '<img class="gx-profile-tier" src="images/ui/ic-tier-' + tier + '.webp" alt="">' +
            '<div class="gx-profile-txt"><div class="gx-profile-name">' + (GameState.playerName || 'بطل') + '</div>' +
            '<div class="gx-profile-title">' + title + '</div>' +
            (ch ? '<div class="gx-profile-char-name">' + ch.name + '</div>' : '') + '</div>' +
            '<div class="gx-profile-level"><div class="gx-lring" style="--p:' + (xp.progress || 0) + '"><b>' + lv + '</b><small>مستوى</small></div>' +
            '<div class="gx-profile-xp"><div class="gx-profile-xpbar"><i style="width:' + (xp.progress || 0) + '%"></i></div><span>' + (xp.xpInLevel || 0) + ' / ' + (xp.xpNeeded || 0) + ' XP · ' + phase.name + '</span></div></div>' +
            '</div>';
        // stats
        var stats = [['star', GameState.stars, 'نجوم'], ['gem', GameState.gems, 'جواهر'], ['flame', GameState.loginStreak, 'يوم ورا بعض'], ['church', GameState.faithPoints, 'نقاط إيمان']];
        h += '<div class="gx-pstats">' + stats.map(function (s) {
            return '<div class="gx-pstat"><img class="gx-i" src="images/ui/ic-' + s[0] + '.webp" alt=""><b data-count="' + (s[1] || 0) + '">0</b><small>' + s[2] + '</small></div>';
        }).join('') + '</div>';
        // journeys
        var journeys = [];
        if (typeof LEVEL1_SUBJECTS !== 'undefined' && typeof l1SubjectProgress === 'function') {
            Object.keys(LEVEL1_SUBJECTS).forEach(function (k) {
                var p = l1SubjectProgress(k), sub = LEVEL1_SUBJECTS[k];
                journeys.push({ key: k, name: sub.name, level: sub.level === 2 ? 'المستوى الثاني' : 'المستوى الأول', done: p.passed, total: p.total, open: "l1OpenSubject('" + k + "')" });
            });
        }
        if (typeof LEVEL2_SUBJECTS !== 'undefined' && typeof getLessonMasteryTier === 'function') {
            ['faith', 'ritual'].forEach(function (k) {
                var sd = LEVEL2_SUBJECTS[k];
                if (!sd) return;
                var n = sd.lessons ? sd.lessons.length : 6, d = 0;
                for (var i = 0; i < n; i++) if (getLessonMasteryTier(k, i)) d++;
                journeys.push({ key: k, name: sd.name, level: 'المستوى الثاني', done: d, total: n, open: "showScreen('level2-subjects-screen')" });
            });
        }
        h += '<div class="gx-psec"><span class="gx-ribbon gx-ribbon--blue">رحلاتي</span></div><div class="gx-journeys">';
        journeys.forEach(function (j) {
            var pct = j.total ? Math.round(j.done / j.total * 100) : 0;
            h += '<div class="gx-journey gx-press" onclick="' + j.open + '">' +
                '<div class="gx-journey-art" style="background-image:url(\'images/ui/' + (JOURNEY_ART[j.key] || 'card-l2') + '.webp\')"></div>' +
                '<div class="gx-journey-txt"><small>' + j.level + '</small><b>' + j.name + '</b>' +
                '<div class="gx-journey-bar"><i style="width:' + pct + '%"></i></div><span>' + j.done + ' / ' + j.total + ' محطات' + (pct === 100 ? ' · خلصتها 🏆' : '') + '</span></div>' +
                (pct === 100 ? '<img class="gx-journey-badge" src="images/ui/ic-trophy.webp" alt="">' : '<span class="gx-journey-go">◀</span>') + '</div>';
        });
        h += '</div>';
        // mastery badges
        var badges = [], gold = 0;
        if (typeof LEVEL2_SUBJECTS !== 'undefined' && typeof getLessonMasteryTier === 'function') {
            ['faith', 'bible', 'life', 'ritual'].forEach(function (k) {
                var sd = LEVEL2_SUBJECTS[k];
                if (!sd) return;
                (sd.lessons || []).forEach(function (ls, i) {
                    var t = getLessonMasteryTier(k, i);
                    if (!t) return;
                    if (t === 'gold') gold++;
                    badges.push({ t: t, name: ls.name || ('درس ' + (i + 1)) });
                });
            });
        }
        h += '<div class="gx-psec"><span class="gx-ribbon gx-ribbon--gold">شارات الإتقان</span></div>';
        h += badges.length ? '<div class="gx-pbadges">' + badges.map(function (b) {
            return '<div class="gx-pbadge gx-pbadge--' + b.t + '"><img src="images/ui/ic-tier-' + b.t + '.webp" alt=""><span>' + b.name + '</span></div>';
        }).join('') + '</div><div class="gx-psum">' + badges.length + ' شارة · ' + gold + ' دهبي</div>'
            : '<div class="gx-pempty"><img src="images/ui/ic-medal.webp" alt=""><span>لسه ما جمعتش شارات — خلّص درس وخد أول شارة!</span></div>';
        // treasures
        var tot = 0, got = 0;
        try {
            ['faith', 'bible', 'life', 'ritual'].forEach(function (k) {
                (LESSON_COLLECTIBLES[k] || []).forEach(function (c) { tot++; if (GameState.collectibles && GameState.collectibles[c.id]) got++; });
            });
        } catch (e) {}
        h += '<div class="gx-ptreasure gx-press" onclick="showScreen(\'museum-screen\')"><img src="images/ui/ic-chest-open.webp" alt=""><div><b>كنوز الإيمان</b><div class="gx-journey-bar"><i style="width:' + (tot ? Math.round(got / tot * 100) : 0) + '%"></i></div><span>' + got + ' / ' + tot + ' كنز · افتح المتحف ◀</span></div></div>';
        // commitment road
        var streak = GameState.loginStreak || 0, claimed = GameState.claimedStreakRewards || [];
        h += '<div class="gx-psec"><span class="gx-ribbon gx-ribbon--orange">طريق الالتزام</span></div><div class="gx-road">';
        (typeof ENHANCED_STREAK_MILESTONES !== 'undefined' ? ENHANCED_STREAK_MILESTONES : []).forEach(function (m, i) {
            var st = claimed.indexOf('streak' + m.days) >= 0 ? 'got' : (streak >= m.days ? 'ready' : 'lock');
            h += (i ? '<i class="gx-road-link' + (streak >= m.days ? ' on' : '') + '"></i>' : '') +
                '<div class="gx-road-step gx-road-step--' + st + '"><div class="gx-road-node"><img src="images/ui/ic-' + (st === 'lock' ? 'lock' : 'flame') + '.webp" alt=""><b>' + m.days + '</b></div><span>' + m.desc + '</span></div>';
        });
        h += '</div>';
        box.innerHTML = h;
        box.querySelectorAll('[data-count]').forEach(function (el) { countTo(el, parseInt(el.getAttribute('data-count'), 10) || 0); });
    }

    // ============================================================
    // الخلوة: devotion as a game page (same data + same completeDevotionTask action)
    // ============================================================
    var WEEK_DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
    function localKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function renderDevotionGame() {
        var body = $('devotion-body');
        if (!body) return;
        var tipEl = body.querySelector('.devotion-tip-card p'), tip = tipEl ? tipEl.textContent : '';
        var log = GameState.devotionLog || {}, today = log[localKey(new Date())] || {};
        var streak = 0;
        try { streak = calculateDevotionStreak(); } catch (e) {}
        var doneToday = (today.morning ? 1 : 0) + (today.night ? 1 : 0);
        var week = '';
        for (var i = 6; i >= 0; i--) {
            var d = new Date(); d.setDate(d.getDate() - i);
            var l = log[localKey(d)] || {}, n = (l.morning ? 1 : 0) + (l.night ? 1 : 0);
            week += '<div class="gx-wday' + (n === 2 ? ' full' : n === 1 ? ' half' : '') + (i === 0 ? ' today' : '') + '"><small>' + (i === 0 ? 'النهارده' : WEEK_DAYS[d.getDay()]) + '</small><span>' +
                (n ? img(n === 2 ? 'flame' : 'candle') : '·') + '</span></div>';
        }
        function card(type, title, sub) {
            var done = !!today[type];
            return '<div class="gx-dv-card gx-dv-' + type + (done ? ' done' : '') + '">' +
                '<div class="gx-dv-sky"><i class="gx-dv-orb"></i>' + (type === 'night' ? '<i class="gx-dv-st" style="left:20%;top:22%"></i><i class="gx-dv-st" style="left:62%;top:14%"></i><i class="gx-dv-st" style="left:44%;top:40%"></i>' : '') + '</div>' +
                '<img class="gx-dv-ic" src="images/ui/ic-' + (type === 'night' ? 'lamp' : 'candle') + '.webp" alt="">' +
                '<div class="gx-dv-txt"><b>' + title + '</b><span>' + sub + '</span><em>+5 ' + img('star') + '</em></div>' +
                (done ? '<div class="gx-dv-stamp">✓ تمّت</div>'
                    : '<button class="gx-btn gx-btn--green gx-throb gx-dv-go" onclick="completeDevotionTask(\'' + type + '\')">سجّل صلاتي</button>') +
                '</div>';
        }
        body.innerHTML =
            '<div class="gx-dv-hero">' +
                '<div class="gx-dv-flame"><img src="images/ui/ic-flame.webp" alt=""><b>' + streak + '</b></div>' +
                '<div class="gx-dv-htxt"><b>' + (streak ? streak + ' يوم ورا بعض في الصلاة' : 'ابدأ سلسلة صلاتك النهارده') + '</b><span>' + (doneToday === 2 ? 'خلّصت صلوات النهارده كلها! ربنا يفرّح قلبك 🙏' : 'صلّي الصبح وبليل عشان الشعلة تفضل منوّرة') + '</span></div>' +
                '<div class="gx-lring" style="--p:' + (doneToday * 50) + '"><b>' + doneToday + '/2</b><small>النهارده</small></div>' +
            '</div>' +
            '<div class="gx-week">' + week + '</div>' +
            card('morning', 'صلاة باكر', 'ابدأ يومك مع ربنا') +
            card('night', 'صلاة النوم', 'اختم يومك بالشكر') +
            (tip ? '<div class="gx-dv-tip"><img src="images/ui/ic-dove.webp" alt=""><div><b>نصيحة اليوم</b><p>' + tip + '</p></div></div>' : '');
    }

    // ============================================================
    // الإنجيل: chapter road + mission board (keeps every original control)
    // ============================================================
    function enhanceBible() {
        var body = $('bible-reading-body');
        if (!body) return;
        var grid = body.querySelector('.bible-chapters-grid');
        if (grid) {
            var done = grid.querySelectorAll('.bible-ch-item.done').length, total = grid.children.length;
            var wrap = document.createElement('div');
            wrap.className = 'gx-chroad-wrap';
            wrap.innerHTML = '<div class="gx-chroad-head"><b>رحلة إنجيل مرقس</b><span>' + img('bible') + ' ' + done + ' / ' + total + ' أصحاح</span></div>';
            grid.classList.add('gx-chroad');
            wrap.appendChild(grid);
            body.insertBefore(wrap, body.firstChild);
            var t = body.querySelector('.bible-chapters-title'); if (t) t.remove();
            var p = body.querySelector('.bible-progress-section'); if (p) p.remove();
            var cur = grid.querySelector('.current');
            if (cur) setTimeout(function () { grid.scrollLeft = cur.offsetLeft - grid.clientWidth / 2 + cur.offsetWidth / 2; }, 60);
        }
        var cc = body.querySelector('.bible-chapter-card');
        if (cc && !cc.querySelector('.gx-mission-tag')) {
            var tag = document.createElement('div');
            tag.className = 'gx-mission-tag';
            tag.innerHTML = img('pin') + ' مهمة النهارده';
            cc.insertBefore(tag, cc.firstChild);
        }
    }

    // ---------- Card enhancer: emoji / glyph → 3D icon showcase, info chips ----------
    var EMOJI_IC = {
        '⛑': 'helmet', '🛡': 'shield', '🔰': 'shield', '🗡': 'sword', '⚔': 'sword', '🎁': 'gift', '🔥': 'flame', '🏆': 'trophy',
        '⛪': 'church', '📖': 'bible', '🙏': 'pray', '⭐': 'star', '🌟': 'star', '🕊': 'dove', '📜': 'map', '💎': 'gem', '👑': 'crown',
        '🏅': 'medal', '🥇': 'medal', '❤': 'heart', '🔒': 'lock', '💡': 'hint', '❄': 'freeze', '✂': 'scissors', '🕯': 'candle',
        '💪': 'dumbbell', '🗺': 'map', '⏳': 'hourglass', '📢': 'megaphone', '👥': 'friends', '🔔': 'bell', '📷': 'camera', '📸': 'camera',
        '💬': 'chat', '⚙': 'gear', '🧭': 'compass', '🏛': 'museum', '📈': 'chart', '📊': 'chart', '🎡': 'wheel', '🧰': 'chest',
        '🪔': 'lamp', '🚩': 'flag', '📍': 'pin', '🛍': 'bag', '🛒': 'bag', '🤲': 'pray', '✝': 'church', '🎯': 'pin'
    };
    var MODE_IC = { sparkle: 'stars2', speed: 'hourglass', classic: 'trophy', team: 'friends', clues: 'crown', verse: 'bible', scenario: 'chat', startBlitz: 'flame', openDuelHub: 'sword' };
    var ICON_BOX = '.shop-item-icon, .reward-icon, .streak-reward-icon, .compete-mode-icon, .ach-icon, .museum-trophy-icon, ' +
        '.pd-stat-icon, .info-way-icon, .l1-game-icon, .exercise-icon, .lamp-mission-icon, .cat-icon, .mg-card-icon, .ssc-icon, .l1-subject-icon, .l2-subject-icon, ' +
        '.selfie-hero-emoji, .selfie-noteam-ico, .selfie-soon-ico, .fqs-hero-icon, .social-hero-icon, .qa-empty-icon, .devotion-icon';
    function iconFor(box) {
        if (box.classList.contains('museum-trophy-icon')) return 'trophy';
        var card = box.closest('.compete-mode-card');
        if (card) {
            var m = (card.getAttribute('onclick') || '').match(/selectCompeteMode\('(\w+)'\)|(startBlitz)|(openDuelHub)/);
            if (m) return MODE_IC[m[1] || m[2] || m[3]];
        }
        var t = (box.textContent || '').replace(/\uFE0F/g, '').trim();
        if (!t || Array.from(t).length > 2) return null;
        return EMOJI_IC[Array.from(t)[0]] || null;
    }
    function enhance() {
        document.querySelectorAll('.screen.active ' + ICON_BOX.split(', ').join(', .screen.active ')).forEach(function (box) {
            if (box._gx) return;
            box._gx = true;
            box.classList.add('gx-show');
            var name = iconFor(box), t = (box.textContent || '').trim();
            if (name) box.innerHTML = img(name);
            else if (t && !box.children.length && Array.from(t).length <= 3) box.innerHTML = '<span class="gx-emo">' + t + '</span>';
        });
        // فريقي: team colour on the banner
        var th = document.querySelector('.screen.active .my-team-header');
        if (th && GameState.teamColor) th.style.setProperty('--team', GameState.teamColor);
        // فريقي: show the squad as 6 slots
        document.querySelectorAll('.screen.active .my-team-members-list').forEach(function (list) {
            if (list._gx) return;
            list._gx = true;
            var n = list.querySelectorAll('.my-team-member').length;
            for (var i = n; i < 6; i++) {
                var d = document.createElement('div');
                d.className = 'my-team-member gx-slot-empty';
                d.innerHTML = '<span class="member-num">' + (i + 1) + '</span><span>مكان فاضي</span>';
                list.appendChild(d);
            }
        });
        document.querySelectorAll('.screen.active .compete-mode-badge').forEach(function (b) {
            if (b._gx) return;
            b._gx = true;
            var parts = b.textContent.split('·').map(function (x) { return x.trim(); }).filter(Boolean);
            if (parts.length) b.innerHTML = parts.map(function (x) { return '<span>' + x + '</span>'; }).join('');
            b.classList.add('gx-chips');
        });
    }
    var scanTimer = null;
    function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(function () { enhance(); scanReveal(); }, 100); }
    function bootMotion() {
        document.addEventListener('pointerdown', tapSpark, { passive: true });
        if (window.MutationObserver) new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
        scheduleScan();
    }

    // ---------- Boot ----------
    applyLook();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMotion);
    else bootMotion();
    setInterval(function () { if (lookPref() === 'auto') applyLook(); }, 5 * 60000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSky);
    else buildSky();

    return {
        setLook: setLook, lookPref: lookPref, applyLook: applyLook,
        continueJourney: continueJourney, renderProfile: renderProfile, renderDevotionGame: renderDevotionGame, enhanceBible: enhanceBible, onScreen: onScreen, renderHub: renderHub, scrollHubTop: scrollHubTop, nav: nav,
        onNewDay: onNewDay, openDaily: openDaily, openSeason: openSeason,
        img: img, whenFree: whenFree, grant: grant, fly: fly, burst: burst, toast: toast, chest: chest, tierUp: tierUp, praise: praise, breakCombo: breakCombo,
        charImage: charImage, refreshCounters: refreshCounters, modal: modal
    };
})();

// The old 4 themes are retired: pin the legacy attribute to the neutral base so
// theme-specific rules in style.css (e.g. 47 [data-theme="light"] rules) never apply.
(function () {
    function pin() {
        document.documentElement.setAttribute('data-theme', 'ocean');
        if (document.body) document.body.setAttribute('data-theme', 'ocean');
    }
    pin();
    document.addEventListener('DOMContentLoaded', pin);
    if (typeof setTheme === 'function') {
        setTheme = function (theme) {
            GameUI.setLook(theme === 'light' ? 'day' : (theme === 'dark' ? 'night' : 'auto'));
            pin();
        };
    }
})();

// Game moments hooked onto existing game.js functions (wrappers keep the original behaviour).
(function () {
    function wrap(name, after, before) {
        var orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
            var ctx = before ? before.apply(this, arguments) : null;
            var r = orig.apply(this, arguments);
            try { after.call(this, arguments, ctx); } catch (e) { console.warn('GameUI hook ' + name, e); }
            return r;
        };
    }
    // Every correct / wrong answer sound → praise + combo
    wrap('playCorrectSound', function () { GameUI.praise(); });
    wrap('playWrongSound', function () { GameUI.breakCombo(); });
    // Verse wheel auto-opens on the first hub visit of the day: let the attendance popup go first
    (function () {
        var orig = window.openVerseWheel;
        if (typeof orig !== 'function') return;
        window.openVerseWheel = function () {
            var self = this, args = arguments;
            GameUI.whenFree(function () { orig.apply(self, args); });
        };
    })();
    // الخلوة / الإنجيل: game layouts on top of the original renders
    wrap('renderDevotion', function () { GameUI.renderDevotionGame(); });
    wrap('renderBibleReading', function () { GameUI.enhanceBible(); });
    // تقدّمي: the profile page replaces the plain dashboard every time it renders
    wrap('renderProgressDashboard', function () { GameUI.renderProfile(); });
    // Quiz power-ups: Font Awesome glyphs → 3D icons
    wrap('renderPowerUps', function () {
        var names = ['scissors', 'skip', 'stars2', 'freeze', 'hint'];
        document.querySelectorAll('#power-ups .power-up-btn').forEach(function (b, i) {
            var g = b.querySelector('i.fas');
            if (g && names[i]) g.outerHTML = GameUI.img(names[i]);
        });
    });
    // Boss fight: correct answer = sword slash + damage number + boss recoil
    wrap('answerBoss', function (args) {
        if (args[0] !== args[1]) return;
        var boss = document.querySelector('.boss-fight-emoji');
        if (!boss) return;
        var r = boss.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        boss.classList.remove('gx-hit'); void boss.offsetWidth; boss.classList.add('gx-hit');
        var s = document.createElement('div'); s.className = 'gx-slash'; s.style.left = (cx - 100) + 'px'; s.style.top = cy + 'px';
        var d = document.createElement('div'); d.className = 'gx-dmg'; d.textContent = '-10!'; d.style.left = (cx + 10) + 'px'; d.style.top = (cy - 40) + 'px';
        document.body.appendChild(s); document.body.appendChild(d);
        setTimeout(function () { s.remove(); d.remove(); }, 1100);
    });
    // Character tier upgrade → full-screen tier-up moment
    wrap('upgradeCharacterTier', function (args, before) {
        var key = args[0], now = getCharacterTier(key);
        if (now !== before) {
            var title = (now === 'gold' && typeof CHARACTER_GOLD_TITLES !== 'undefined') ? CHARACTER_GOLD_TITLES[key] : '';
            // the tier-up moment replaces the stacked achievement popup + toast
            var ap = document.querySelector('.achievement-popup'); if (ap) ap.remove();
            var tt = document.getElementById('toast'); if (tt) tt.className = 'toast';
            GameUI.tierUp(key, now, title);
        }
    }, function (key) { return getCharacterTier(key); });
    // Spin wheel prize → burst + counter pop; mystery box → chest moment (already granted)
    wrap('onSpinComplete', function (args, before) {
        var canvas = document.getElementById('spin-canvas');
        var prize = (typeof SPIN_PRIZES !== 'undefined') ? SPIN_PRIZES[args[0]] : null;
        GameUI.burst([GameUI.img('star'), GameUI.img('gem'), '✨', GameUI.img('star'), '✨', GameUI.img('gem')], canvas);
        GameUI.refreshCounters();
        if (prize && prize.type === 'mystery') {
            var gotStars = (GameState.stars || 0) - before.stars, gotGems = (GameState.gems || 0) - before.gems;
            setTimeout(function () { GameUI.chest({ stars: gotStars > 0 ? gotStars : 0, gems: gotGems > 0 ? gotGems : 0 }, 'صندوق المفاجآت', { granted: true }); }, 900);
        }
    }, function () { return { stars: GameState.stars || 0, gems: GameState.gems || 0 }; });
})();

// Run the hub/nav hook after every navigation (showScreen is a global in game.js).
(function () {
    if (typeof showScreen !== 'function') return;
    var _show = showScreen;
    showScreen = function (id) {
        var r = _show.apply(this, arguments);
        try { GameUI.onScreen(id); } catch (e) { console.warn('GameUI.onScreen', e); }
        return r;
    };
})();
