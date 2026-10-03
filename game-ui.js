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
        if (reward.stars) fly('⭐', fromEl, $('gx-pill-stars'), Math.min(8, 3 + Math.floor(reward.stars / 50)));
        if (reward.gems) fly('💎', fromEl, $('gx-pill-gems'), Math.min(8, 3 + Math.floor(reward.gems / 5)));
        setTimeout(refreshCounters, 900);
    }
    function rewardIcon(r) {
        if (r.chest) return '🧰';
        if (r.gems && !r.stars) return '💎';
        if (r.powerUps) return POWER_ICON[Object.keys(r.powerUps)[0]] || '🎁';
        return '⭐';
    }
    function rewardLabel(r) {
        var p = [];
        if (r.stars) p.push(r.stars + ' ⭐');
        if (r.gems) p.push(r.gems + ' 💎');
        if (r.powerUps) Object.keys(r.powerUps).forEach(function (k) { p.push(r.powerUps[k] + ' ' + (POWER_NAME[k] || k)); });
        return p.join(' · ');
    }
    var POWER_ICON = { fiftyFifty: '✂️', skip: '⏭️', doublePoints: '✖️2', freeze: '❄️', hint: '💡' };
    var POWER_NAME = { fiftyFifty: '50:50', skip: 'تخطي', doublePoints: 'نقط مضاعفة', freeze: 'تجميد', hint: 'تلميح' };

    // ---------- Counters + flying icons ----------
    function refreshCounters() {
        var s = $('hub-stars'), g = $('hub-gems');
        if (s && s.textContent !== fmt(GameState.stars)) { s.textContent = fmt(GameState.stars); pop(s); }
        if (g && g.textContent !== fmt(GameState.gems)) { g.textContent = fmt(GameState.gems); pop(g); }
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
                f.textContent = icon;
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
            b.textContent = ic;
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
    function modal(ribbonHtml, bodyHtml, opts) {
        opts = opts || {};
        var ov = document.createElement('div');
        ov.className = 'gx-ov';
        ov.innerHTML = '<div class="gx-rays"></div><div class="gx-modal">' + ribbonHtml +
            (opts.closable === false ? '' : '<button class="gx-close" aria-label="إغلاق">✕</button>') + bodyHtml + '</div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('show'); });
        function close() { ov.classList.remove('show'); setTimeout(function () { ov.remove(); }, 260); }
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
        var inner = big && r.chest ? '<b>🧰</b> يوم ٧: صندوق البطل الكبير' : label + '<b>' + rewardIcon(r) + '</b>' + (big ? rewardLabel(r).split(' · ')[0] : '');
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
        setTimeout(function () {
            var hub = $('home-hub-screen');
            if (hub && hub.classList.contains('active')) openDaily();
        }, 900);
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
    function chest(reward, title) {
        var loot = [];
        if (reward.stars) loot.push('⭐');
        if (reward.gems) loot.push('💎');
        if (reward.powerUps) loot.push(POWER_ICON[Object.keys(reward.powerUps)[0]] || '🎁');
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
        $('gx-chest-btn').onclick = function () { grant(reward, this); m.close(); };
    }

    function tierUp(charKey, tier, title) {
        var ch = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[charKey] : null;
        var names = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي 👑' };
        var m = modal('<span class="gx-ribbon gx-ribbon--gold">ترقية!</span>',
            '<div class="gx-emb ' + tier + ' pop"><div class="sh"></div><div class="sh2"><img src="' + charImage(charKey) + '" alt=""></div></div>' +
            '<div class="gx-boss-name">' + (ch ? ch.name : '') + ' · ' + (names[tier] || tier) + '</div>' +
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
    // Hub
    // ============================================================
    var bossCache = null, bossAt = 0;
    function renderBoss() {
        var nameEl = $('gx-boss-name'), hpEl = $('gx-boss-hp'), meta = $('gx-boss-meta');
        if (!nameEl) return;
        function paint(b) {
            var hp = b.bossHP || 500, dmg = Math.min(b.totalDamage || 0, hp);
            nameEl.textContent = b.bossName || 'الوحش';
            hpEl.style.width = Math.max(0, 100 - dmg / hp * 100) + '%';
            var fought = GameState.bossFoughtDate === today();
            var defeated = b.status === 'defeated' || dmg >= hp;
            meta.textContent = defeated ? '🎉 الأبطال هزموه الأسبوع ده!' :
                (fought ? '✅ قاتلت النهارده · ارجع بكره' : 'الأبطال ضربوه ' + Math.round(dmg / hp * 100) + '% · هاجم معاهم!');
        }
        if (bossCache) paint(bossCache);
        if (typeof firebaseDb === 'undefined' || !firebaseDb || Date.now() - bossAt < 60000) return;
        bossAt = Date.now();
        firebaseDb.collection('bossBattle').doc('current').get().then(function (doc) {
            if (!doc.exists) return;
            var b = doc.data();
            if (typeof getWeekKey === 'function' && b.weekKey !== getWeekKey()) { b.totalDamage = 0; b.status = 'active'; }
            bossCache = b;
            paint(b);
        }).catch(function () {});
    }

    function renderTopbar() {
        try {
            var lv = (typeof getPlayerLevel === 'function') ? getPlayerLevel() : 1;
            var info = (typeof getXpForNextLevel === 'function') ? getXpForNextLevel() : { progress: 0 };
            if ($('gx-level')) $('gx-level').textContent = lv;
            if ($('gx-xp-fill')) $('gx-xp-fill').style.width = (info.progress || 0) + '%';
        } catch (e) {}
        var s = $('hub-stars'), g = $('hub-gems');
        if (s) s.textContent = fmt(GameState.stars);
        if (g) g.textContent = fmt(GameState.gems);
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
        renderBoss();
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
        var showNav = !!NAV_SCREENS[id];
        document.body.classList.toggle('gx-nav-on', showNav);
        if (showNav) {
            document.querySelectorAll('#gx-nav [data-nav]').forEach(function (b) {
                b.classList.toggle('on', b.getAttribute('data-nav') === id);
            });
        }
        if (id === 'home-hub-screen') renderHub();
        if (id === 'settings-screen') markLook();
    }

    // ---------- Boot ----------
    applyLook();
    setInterval(function () { if (lookPref() === 'auto') applyLook(); }, 5 * 60000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSky);
    else buildSky();

    return {
        setLook: setLook, lookPref: lookPref, applyLook: applyLook,
        onScreen: onScreen, renderHub: renderHub, scrollHubTop: scrollHubTop, nav: nav,
        onNewDay: onNewDay, openDaily: openDaily, openSeason: openSeason,
        grant: grant, fly: fly, burst: burst, toast: toast, chest: chest, tierUp: tierUp,
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
