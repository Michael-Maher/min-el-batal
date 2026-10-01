// ============================================================
// LEVEL 1 ENGINE — map, station shell (learn / summary / games), DOM game types, scoring
// Content: level1-bible-data.js (L1_BIBLE). Arcade games: level1-arcade.js (L1_ARCADE).
// Storage contract: docs/superpowers/specs/2026-09-29-level1-contracts.md (section C)
// ============================================================

var LEVEL1_SUBJECTS = {
    l1_bible: (typeof L1_BIBLE !== 'undefined') ? L1_BIBLE : null,
    l1_service: (typeof L1_SERVICE !== 'undefined') ? L1_SERVICE : null,
    // Level 2 subject on this engine (fresh key; the old Level 2 `life` lessons were removed)
    l2_life: (typeof L2_LIFE !== 'undefined') ? L2_LIFE : null
};

// Subjects screen order; entries without data yet are shown as "قريباً"
var L1_SUBJECT_LIST = [
    { key: 'l1_bible', name: 'الكتاب المقدس', icon: '📖', color: '#d4a24c' },
    { key: 'l1_service', name: 'الخدمة', icon: '🤲', color: '#2f9e8f' },
    { key: 'l1_behavior', name: 'سلوكيات', icon: '🌱', color: '#7a9e3a' },
    { key: 'l1_history', name: 'تاريخ كنيسة', icon: '⛪', color: '#8e1f1f' }
];

var L1_PASS = 140;
var L1_MAX = 200;
var L1_BUCKET_MAX = { learnRead: 20, learnChecks: 20, summary: 20, games: 140 };
var L1_SUMMARY_MIN_CHARS = 40;

// Station badge positions (% of map image). Station 0 = the wooden bridge.
var L1_MAP_POSITIONS = {
    l1_bible: [
        { left: 51.0, top: 90.5 },
        { left: 16.6, top: 46.0 },
        { left: 50.2, top: 49.0 },
        { left: 83.9, top: 49.0 },
        { left: 33.8, top: 77.8 },
        { left: 72.7, top: 78.6 }
    ],
    // Map numbers 1..6 = station index 0..5
    l1_service: [
        { left: 40.2, top: 17.1 },
        { left: 64.6, top: 26.6 },
        { left: 79.3, top: 52.1 },
        { left: 51.1, top: 65.1 },
        { left: 22.7, top: 60.0 },
        { left: 7.4, top: 35.2 }
    ],
    l2_life: [
        { left: 14.0, top: 32.6 },
        { left: 37.5, top: 41.4 },
        { left: 59.4, top: 27.7 },
        { left: 82.4, top: 36.5 },
        { left: 35.0, top: 58.6 },
        { left: 60.7, top: 60.2 }
    ]
};

// Road waypoints (% of map image) for the walk from station i to station i+1.
var L1_ROUTES = {
    l1_bible: [
        [[51.0, 90.5], [50.5, 84.5], [51.4, 62.0], [32.3, 49.7], [16.6, 46.0]],
        [[16.6, 46.0], [32.3, 49.7], [50.2, 49.0]],
        [[50.2, 49.0], [67.3, 51.1], [83.9, 49.0]],
        [[83.9, 49.0], [67.3, 51.1], [51.4, 62.0], [33.8, 77.8]],
        [[33.8, 77.8], [50.5, 84.5], [72.7, 78.6]]
    ],
    l1_service: [
        [[40.2, 17.1], [52.0, 36.0], [58.6, 36.4], [64.6, 26.6]],
        [[64.6, 26.6], [66.0, 45.0], [68.6, 55.7], [79.3, 52.1]],
        [[79.3, 52.1], [76.0, 72.0], [66.0, 80.0], [51.1, 65.1]],
        [[51.1, 65.1], [44.0, 79.0], [32.0, 78.0], [22.7, 60.0]],
        [[22.7, 60.0], [15.5, 60.0], [11.0, 48.0], [7.4, 35.2]]
    ],
    l2_life: [
        [[14.0, 32.6], [26.4, 44.5], [37.5, 41.4]],
        [[37.5, 41.4], [48.9, 45.6], [59.4, 27.7]],
        [[59.4, 27.7], [70.7, 46.9], [82.4, 36.5]],
        [[82.4, 36.5], [91.4, 61.0], [74.3, 78.8], [48.6, 77.5], [35.0, 58.6]],
        [[35.0, 58.6], [48.6, 77.5], [60.7, 60.2]]
    ]
};

var l1State = {
    subject: 'l1_bible',
    station: 0,
    tab: 'learn',
    cardIdx: 0,
    checks: {},          // cardIdx -> true/false (first attempt, this session)
    gameIdx: -1,
    gameInst: null,
    walking: false,
    summaryImage: null,
    summaryAudio: null,
    recorder: null
};

// ---------- helpers ----------
function l1Esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Content strings may contain <b>..</b> and \n only
function l1Rich(s) {
    return l1Esc(s).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>').replace(/\n/g, '<br>');
}
function l1Shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}
function l1Pick(arr, n) { return l1Shuffle(arr).slice(0, Math.min(n || arr.length, arr.length)); }
// Pick n items keeping their original order
function l1PickOrdered(arr, n) {
    if (!n || n >= arr.length) return arr.slice();
    var idx = l1Shuffle(arr.map(function(_, i) { return i; })).slice(0, n).sort(function(a, b) { return a - b; });
    return idx.map(function(i) { return arr[i]; });
}
function l1Subject() { return LEVEL1_SUBJECTS[l1State.subject]; }
// Displayed station number (Bible map starts at 0, other maps at 1)
function l1LevelName() { return l1Subject() && l1Subject().level === 2 ? 'المستوى الثاني' : 'المستوى الأول'; }
function l1Num(n) { var b = l1Subject() && l1Subject().numberBase; return n + (typeof b === 'number' ? b : 0); }
function l1Key(n) { return l1State.subject + '_' + n; }
function l1Station(n) { return l1Subject().stations[n]; }

function l1Data() {
    if (!GameState.level1Data) GameState.level1Data = {};
    var d = GameState.level1Data[l1State.subject];
    if (!d) d = GameState.level1Data[l1State.subject] = {};
    if (!d.seenUnlock) d.seenUnlock = {};
    if (!d.savedVerses) d.savedVerses = [];
    return d;
}

function l1Sfx(name) {
    try {
        if (name === 'good') playCorrectSound();
        else if (name === 'bad') playWrongSound();
        else if (name === 'combo') playComboSound(3);
        else if (name === 'win') playVictorySound();
        else if (name === 'tick') playTickSound();
        else if (name === 'unlock') playStationUnlockSound();
        else if (name === 'nav') playNavigateSound();
    } catch (e) {}
    if (navigator.vibrate && (name === 'bad' || name === 'good')) {
        try { navigator.vibrate(name === 'bad' ? [40, 30, 40] : 15); } catch (e) {}
    }
}

// ---------- scoring ----------
function l1GetScore(n) {
    if (!GameState.stationScores) GameState.stationScores = {};
    var s = GameState.stationScores[l1Key(n)];
    return s || { learnRead: 0, learnChecks: 0, summary: 0, games: 0, total: 0 };
}

function l1GamesTotal(n) {
    var st = l1Station(n);
    var sum = 0;
    (st.games || []).forEach(function(g) { sum += Math.min(l1GameBest(n, g), g.max); });
    return Math.min(sum, L1_BUCKET_MAX.games);
}
function l1GameBest(n, g) {
    return (GameState.miniGameScores && GameState.miniGameScores[l1Key(n) + '_mg_' + g.id]) || 0;
}

// Best-of update for one bucket; recomputes total and handles the pass event.
// localOnly skips the cloud write (used for frequent card-read progress).
function l1SetBucket(n, field, value, localOnly) {
    if (!GameState.stationScores) GameState.stationScores = {};
    var key = l1Key(n);
    var cur = GameState.stationScores[key] || { learnRead: 0, learnChecks: 0, summary: 0, games: 0, total: 0 };
    var prevTotal = cur.total || 0;
    var v = Math.max(0, Math.min(Math.round(value), L1_BUCKET_MAX[field]));
    if (v > (cur[field] || 0)) cur[field] = v;
    cur.total = Math.min((cur.learnRead || 0) + (cur.learnChecks || 0) + (cur.summary || 0) + (cur.games || 0), L1_MAX);
    GameState.stationScores[key] = cur;
    var passed = prevTotal < L1_PASS && cur.total >= L1_PASS;
    if (passed) l1OnStationPassed(n);
    saveToLocalStorage(localOnly && !passed);
    return cur;
}

function l1IsOpen(n) { return n === 0 || l1GetScore(n - 1).total >= L1_PASS; }
function l1Stars(total) { return total >= L1_MAX ? 3 : total >= 170 ? 2 : total >= L1_PASS ? 1 : 0; }
function l1StarsHtml(k, of) {
    var h = '';
    for (var i = 0; i < (of || 3); i++) h += '<i class="fas fa-star' + (i < k ? ' on' : '') + '"></i>';
    return '<span class="l1-stars">' + h + '</span>';
}
function l1SubjectPoints() {
    var t = 0;
    for (var i = 0; i < l1Subject().stations.length; i++) t += l1GetScore(i).total || 0;
    return t;
}
function l1PassedCount() {
    var c = 0;
    for (var i = 0; i < l1Subject().stations.length; i++) if (l1GetScore(i).total >= L1_PASS) c++;
    return c;
}

function l1OnStationPassed(n) {
    var st = l1Station(n);
    GameState.gems = (GameState.gems || 0) + 30;
    setTimeout(function() {
        try { showCelebration('🏆', n < 5 ? 'عديت المحطة! المحطة الجاية اتفتحت' : 'خلصت رحلة ' + l1Subject().name + '!', '#d4a24c'); } catch (e) {}
        try { launchConfetti(3000); } catch (e) {}
        try { showFloatingReward('+30 💎'); } catch (e) {}
    }, 400);
    try {
        if (typeof postCelebration === 'function') {
            postCelebration('lesson_complete', { lessonKey: l1Key(n), lessonName: st.title, subjectName: l1Subject().name + ' — ' + l1LevelName() });
        }
    } catch (e) {}
    try { logPlayerEvent('l1_station_pass', { subject: l1State.subject, station: n }); } catch (e) {}
}

// ============================================================
// ENTRY
// ============================================================
function openLevel1() {
    if (typeof isContentLocked === 'function' && isContentLocked('card_level1')) {
        showLockedPopup('المستوى الأول', lockedMessage('card_level1'));
        return;
    }
    initAudio();
    showScreen('l1-subjects-screen');
}

function l1OpenSubject(key) {
    var sub = LEVEL1_SUBJECTS[key];
    if (!sub) { showToast('المادة دي بتتجهز... قريباً 🙏', 'warning'); return; }
    // The map/lesson screens are shared by levels, so the level card lock is checked here
    var card = sub.level === 2 ? ['card_level2', 'المستوى الثاني'] : ['card_level1', 'المستوى الأول'];
    if (typeof isContentLocked === 'function' && isContentLocked(card[0])) { showLockedPopup(card[1], lockedMessage(card[0])); return; }
    if (checkLockOrPopup('subject_' + key, sub.name)) return;
    if (key === 'l2_life') l2PurgeOldLife();
    l1State.subject = key;
    showScreen('l1-map-screen');
    enterMapLandscape();
    try { logPlayerEvent('subject_open', { subject: key }); } catch (e) {}
}

// Progress for any subject (does not change l1State.subject)
function l1SubjectProgress(key) {
    var sub = LEVEL1_SUBJECTS[key], passed = 0, pts = 0;
    if (!sub) return { passed: 0, pts: 0, total: 6 };
    var ss = GameState.stationScores || {};
    sub.stations.forEach(function(_, i) {
        var t = (ss[key + '_' + i] || {}).total || 0;
        pts += t;
        if (t >= L1_PASS) passed++;
    });
    return { passed: passed, pts: pts, total: sub.stations.length };
}

function renderL1Subjects() {
    var screen = document.getElementById('l1-subjects-screen');
    if (!screen) return;
    var h = '<div class="l1-lesson l1-subjects">';
    h += '<div class="l1-lesson-top"><button class="l1-icon-btn" onclick="showScreen(\'home-hub-screen\')" aria-label="رجوع"><i class="fas fa-arrow-right"></i></button>';
    h += '<div class="l1-lesson-title"><small>مدرسة اتبعني للتلمذة</small><b>المستوى الأول</b></div></div>';
    h += '<p class="l1-subjects-intro">اختار المادة وابدأ رحلتك — كل مادة ٦ محطات فيها تعلّم وتلخيص وألعاب ✨</p>';
    h += '<div class="l1-subjects-grid">';
    L1_SUBJECT_LIST.forEach(function(it) {
        var sub = LEVEL1_SUBJECTS[it.key];
        var locked = !sub || (typeof isContentLocked === 'function' && isContentLocked('subject_' + it.key));
        var pr = l1SubjectProgress(it.key);
        h += '<button class="l1-subject-card' + (sub ? '' : ' soon') + (locked ? ' locked' : '') + '" style="--c:' + it.color + '" onclick="l1OpenSubject(\'' + it.key + '\')">';
        h += '<span class="l1-subject-icon">' + it.icon + '</span><span class="l1-subject-name">' + l1Esc(it.name) + '</span>';
        if (sub) {
            h += '<span class="l1-bar"><i style="width:' + Math.round(pr.passed / pr.total * 100) + '%"></i></span>';
            h += '<span class="l1-subject-meta">' + pr.passed + '/' + pr.total + ' محطات · <i class="fas fa-bolt"></i> ' + pr.pts + '</span>';
        } else {
            h += '<span class="l1-subject-meta">قريباً 🔒</span>';
        }
        h += '</button>';
    });
    h += '</div></div>';
    screen.innerHTML = h;
}

function l1ExitToHub() {
    exitMapLandscape();
    showScreen((l1Subject() && l1Subject().backScreen) || 'l1-subjects-screen');
}

// ---------- Level 2 مهارات الحياة: fresh subject ----------
// Remove any data saved by the old Level 2 `life` lessons (user decision 2026-09-30: fresh subject).
function l2PurgeOldLife() {
    if (!GameState.level1Data) GameState.level1Data = {};
    var flags = GameState.level1Data.l2_life || (GameState.level1Data.l2_life = {});
    if (flags.purgedOldLife) return;   // once only: new weekly exams reuse the subjectExam_life_ prefix
    flags.purgedOldLife = true;
    var changed = true;
    ['stationScores', 'miniGameScores', 'lessonSummaries', 'watchedVideos', 'questionHistory'].forEach(function(field) {
        var obj = GameState[field];
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(function(k) {
            if (k.indexOf('life_') === 0) delete obj[k];
        });
    });
    var l2 = GameState.level2Data;
    if (l2 && typeof l2 === 'object') {
        Object.keys(l2).forEach(function(k) {
            if (k === 'life' || k.indexOf('subjectExam_life_') === 0) delete l2[k];
        });
    }
    if (changed) saveToLocalStorage();
}

// Shared Level 2 features (compete rooms, weekly exam) read LEVEL2_SUBJECTS.life.lessons:
// fill it from the new subject so they only use the new content.
(function l2BuildLifeShim() {
    if (typeof LEVEL2_SUBJECTS === 'undefined' || !LEVEL2_SUBJECTS.life || typeof L2_LIFE === 'undefined') return;
    LEVEL2_SUBJECTS.life.lessons = L2_LIFE.stations.map(function(st) {
        var qs = [];
        st.cards.forEach(function(c) {
            if (c.type === 'check') qs.push({ q: c.q, options: c.options, correct: c.correct, explanation: c.explain });
        });
        ((st.games[0] && st.games[0].data && st.games[0].data.questions) || []).forEach(function(q) {
            qs.push({ q: q.q, options: q.options, correct: q.correct, explanation: q.explain });
        });
        return { name: st.title, desc: st.subtitle || '', verse: st.verse ? st.verse.text + ' ' + st.verse.ref : '', content: '', questions: qs };
    });
})();

// ============================================================
// MAP
// ============================================================
function l1CurrentStation() {
    // Furthest open station
    var n = 0;
    for (var i = 1; i < l1Subject().stations.length; i++) if (l1IsOpen(i)) n = i;
    return n;
}

function renderL1Map() {
    var screen = document.getElementById('l1-map-screen');
    if (!screen) return;
    var sub = l1Subject();
    var pos = L1_MAP_POSITIONS[l1State.subject];
    var data = l1Data();
    var cur = l1CurrentStation();
    // Pending walk: the newest open station whose unlock the player hasn't watched yet
    var walkTo = (cur > 0 && !data.seenUnlock[cur]) ? cur : -1;
    var avatarAt = walkTo > 0 ? walkTo - 1 : cur;

    var h = '';
    h += '<div class="l1-map-top">';
    h += '<button class="l1-icon-btn" onclick="l1ExitToHub()" aria-label="رجوع"><i class="fas fa-arrow-right"></i></button>';
    h += '<div class="l1-map-title"><span>' + sub.icon + '</span> ' + l1Esc(sub.name) + ' <small>· ' + l1LevelName() + '</small></div>';
    var passed = l1PassedCount();
    var pct = Math.round(passed / sub.stations.length * 100);
    h += '<div class="l1-map-ring" style="--p:' + pct + '"><b>' + passed + '/' + sub.stations.length + '</b></div>';
    h += '<div class="l1-map-points"><i class="fas fa-bolt"></i> ' + l1SubjectPoints() + '</div>';
    h += '<button class="l1-icon-btn" onclick="toggleMapFullscreen()" aria-label="ملء الشاشة"><i class="fas fa-expand"></i></button>';
    h += '</div>';

    h += '<div class="l1-map-scroll" id="l1-map-scroll">';
    h += '<div class="l1-map-world l1-loading" id="l1-map-world" style="background-image:url(' + sub.mapTiny + ');aspect-ratio:' + (sub.mapRatio || 3616 / 2415) + '">';
    h += '<img class="l1-map-img" id="l1-map-img" alt="خريطة ' + l1Esc(sub.name) + '" src="' + sub.mapImage + '">';
    h += '<svg class="l1-map-route" id="l1-map-route" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
    for (var i = 0; i < sub.stations.length; i++) {
        var st = sub.stations[i];
        var sc = l1GetScore(i);
        var open = l1IsOpen(i) && !(i === walkTo);
        var cls = 'l1-node' + (open ? '' : ' locked') + (sc.total >= L1_PASS ? ' done' : '') + (i === cur && walkTo < 0 ? ' current' : '');
        h += '<button class="' + cls + '" id="l1-node-' + i + '" style="left:' + pos[i].left + '%;top:' + pos[i].top + '%" onclick="l1OpenSheet(' + i + ')" aria-label="المحطة ' + l1Num(i) + ' ' + l1Esc(st.title) + '">';
        if (i === 0 && sub.zeroBadge) h += '<span class="l1-node-zero">0</span>';
        h += '<span class="l1-node-fog"><i class="fas fa-lock"></i></span>';
        h += '<span class="l1-node-ring"></span>';
        if (sc.total >= L1_PASS) h += '<span class="l1-node-badge">' + l1StarsHtml(l1Stars(sc.total)) + '</span>';
        h += '</button>';
    }
    var ch = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[GameState.character] : null;
    h += '<div class="l1-avatar" id="l1-avatar" style="left:' + pos[avatarAt].left + '%;top:' + pos[avatarAt].top + '%">';
    h += ch && ch.image ? '<img src="' + ch.image + '" alt="">' : '<span>🧒</span>';
    h += '<i class="l1-avatar-here">هنا</i></div>';
    h += '</div></div>';

    h += '<div class="l1-sheet-backdrop" id="l1-sheet-backdrop" onclick="l1CloseSheet()"></div>';
    h += '<div class="l1-sheet" id="l1-sheet"></div>';
    h += '<div class="l1-finale" id="l1-finale"></div>';
    screen.innerHTML = h;

    var img = document.getElementById('l1-map-img');
    var world = document.getElementById('l1-map-world');
    var afterLoad = function() {
        world.classList.remove('l1-loading');
        l1CenterOn(avatarAt, false);
        if (walkTo > 0) setTimeout(function() { l1PlayWalk(walkTo - 1, walkTo); }, 500);
        else if (l1PassedCount() === sub.stations.length && !data.seenUnlock.finale) setTimeout(l1ShowFinale, 600);
    };
    if (img.complete && img.naturalWidth) afterLoad();
    else {
        img.onload = afterLoad;
        img.onerror = function() {
            world.classList.remove('l1-loading');
            showToast('خطأ في تحميل الخريطة - تأكد من الاتصال بالإنترنت', 'error');
            l1RenderMapFallbackList();
        };
    }
}

// Fullscreen / rotation changes the map size after render: keep the avatar in view
window.addEventListener('resize', function() {
    var scr = document.getElementById('l1-map-screen');
    if (!scr || !scr.classList.contains('active') || l1State.walking || !l1Subject()) return;
    clearTimeout(l1State._rz);
    l1State._rz = setTimeout(function() { l1CenterOn(l1CurrentStation(), false); }, 150);
});

function l1RenderMapFallbackList() {
    var world = document.getElementById('l1-map-world');
    if (!world) return;
    var h = '<div class="l1-map-fallback">';
    l1Subject().stations.forEach(function(st, i) {
        h += '<button class="l1-fallback-item' + (l1IsOpen(i) ? '' : ' locked') + '" onclick="l1OpenSheet(' + i + ')">' + l1Num(i) + ' · ' + l1Esc(st.title) + '</button>';
    });
    world.innerHTML = h + '</div>';
}

function l1CenterOn(n, smooth) {
    var scroll = document.getElementById('l1-map-scroll');
    var world = document.getElementById('l1-map-world');
    if (!scroll || !world) return;
    var p = L1_MAP_POSITIONS[l1State.subject][n];
    var x = world.offsetWidth * p.left / 100 - scroll.clientWidth / 2;
    try { scroll.scrollTo({ left: x, behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { scroll.scrollLeft = x; }
}

// Walk the avatar along the road from station a to station b.
function l1PlayWalk(a, b) {
    var world = document.getElementById('l1-map-world');
    var avatar = document.getElementById('l1-avatar');
    var svg = document.getElementById('l1-map-route');
    var scroll = document.getElementById('l1-map-scroll');
    if (!world || !avatar) return;
    var route = L1_ROUTES[l1State.subject][a];
    var data = l1Data();
    var finish = function() {
        l1State.walking = false;
        var p = route[route.length - 1];
        avatar.style.left = p[0] + '%';
        avatar.style.top = p[1] + '%';
        avatar.style.transform = '';
        var node = document.getElementById('l1-node-' + b);
        if (node) { node.classList.remove('locked'); node.classList.add('current', 'l1-node-reveal'); }
        document.querySelectorAll('.l1-node.current').forEach(function(nd) { if (nd.id !== 'l1-node-' + b) nd.classList.remove('current'); });
        data.seenUnlock[b] = true;
        saveToLocalStorage();
        l1Sfx('unlock');
        try { launchConfetti(2000); } catch (e) {}
        world.removeEventListener('pointerdown', skip);
    };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { finish(); return; }

    // Route line (drawn progressively)
    var d = route.map(function(p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
    svg.innerHTML = '<path class="l1-route-glow" d="' + d + '"/><path class="l1-route-line" id="l1-route-line" pathLength="100" d="' + d + '"/>';

    // Polyline in pixel space for even speed
    var W = world.offsetWidth, H = world.offsetHeight;
    var pts = route.map(function(p) { return [p[0] * W / 100, p[1] * H / 100]; });
    var lens = [0], total = 0;
    for (var i = 1; i < pts.length; i++) {
        total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        lens.push(total);
    }
    var duration = Math.max(1800, Math.min(4200, total * 4.5));
    var start = null, skipped = false, lastStep = -1;
    var line = document.getElementById('l1-route-line');
    var skip = function() { skipped = true; };
    world.addEventListener('pointerdown', skip);
    avatar.classList.add('walking');
    l1State.walking = true;

    function frame(ts) {
        if (!start) start = ts;
        var t = skipped ? 1 : Math.min(1, (ts - start) / duration);
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        var dist = e * total, k = 1;
        while (k < lens.length - 1 && lens[k] < dist) k++;
        var seg = (lens[k] - lens[k - 1]) || 1, f = (dist - lens[k - 1]) / seg;
        var x = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f;
        var y = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f;
        avatar.style.left = (x / W * 100) + '%';
        avatar.style.top = (y / H * 100) + '%';
        var step = Math.floor(dist / 38);
        avatar.style.transform = 'translate(-50%, -100%) translateY(' + (-Math.abs(Math.sin(dist / 38 * Math.PI)) * 12) + 'px)';
        if (step !== lastStep) {
            lastStep = step;
            if (typeof CanvasFX !== 'undefined' && step % 2 === 0) {
                var r = avatar.getBoundingClientRect();
                try { CanvasFX.burst(r.left + r.width / 2, r.bottom, { count: 6, speed: 2.5, colors: ['#e8d3a3', '#c9a86a', '#fff4d6'] }); } catch (err) {}
            }
        }
        if (line) line.style.strokeDashoffset = String(100 - e * 100);
        if (scroll) scroll.scrollLeft = x - scroll.clientWidth / 2;
        if (t < 1) requestAnimationFrame(frame);
        else { avatar.classList.remove('walking'); finish(); }
    }
    requestAnimationFrame(frame);
}

function l1OpenSheet(n) {
    if (l1State.walking) return;
    var st = l1Station(n);
    if (!l1IsOpen(n)) {
        showToast('خلّص المحطة اللي قبلها الأول 🔒', 'warning');
        var node = document.getElementById('l1-node-' + n);
        if (node) { node.classList.remove('l1-shake'); void node.offsetWidth; node.classList.add('l1-shake'); }
        return;
    }
    var sc = l1GetScore(n);
    var h = '<div class="l1-sheet-grip"></div>';
    h += '<div class="l1-sheet-head"><span class="l1-sheet-num">' + l1Num(n) + '</span><div><h3>' + l1Esc(st.title) + '</h3>';
    h += '<p>' + l1Esc(st.subtitle || '') + (st.refs ? ' · <b>' + l1Esc(st.refs) + '</b>' : '') + '</p></div>';
    h += l1StarsHtml(l1Stars(sc.total)) + '</div>';
    h += '<div class="l1-chips">' + (st.topics || []).map(function(t) { return '<span>' + l1Esc(t) + '</span>'; }).join('') + '</div>';
    if (st.verse) h += '<blockquote class="l1-sheet-verse">' + l1Esc(st.verse.text) + ' <cite>' + l1Esc(st.verse.ref) + '</cite></blockquote>';
    h += '<div class="l1-sheet-parts">';
    h += l1PartBar('📖 تعلّم', (sc.learnRead || 0) + (sc.learnChecks || 0), 40);
    h += l1PartBar('✍️ لخّص', sc.summary || 0, 20);
    h += l1PartBar('🎮 العب', sc.games || 0, 140);
    h += '</div>';
    h += '<div class="l1-sheet-total">' + (sc.total || 0) + ' / ' + L1_MAX + ' <small>(تعدّي المحطة من ' + L1_PASS + ')</small></div>';
    h += '<button class="l1-cta" onclick="l1StartStation(' + n + ')">ادخل المحطة <i class="fas fa-arrow-left"></i></button>';
    document.getElementById('l1-sheet').innerHTML = h;
    document.getElementById('l1-sheet').classList.add('open');
    document.getElementById('l1-sheet-backdrop').classList.add('open');
    l1Sfx('nav');
}
function l1PartBar(label, v, max) {
    return '<div class="l1-part"><span>' + label + '</span><div class="l1-bar"><i style="width:' + Math.round(v / max * 100) + '%"></i></div><b>' + v + '/' + max + '</b></div>';
}
function l1CloseSheet() {
    var s = document.getElementById('l1-sheet'), b = document.getElementById('l1-sheet-backdrop');
    if (s) s.classList.remove('open');
    if (b) b.classList.remove('open');
}

function l1ShowFinale() {
    var el = document.getElementById('l1-finale');
    if (!el) return;
    var world = document.getElementById('l1-map-world');
    if (world) world.classList.add('l1-finale-glow');
    var fin = l1Subject().finale || {};
    el.innerHTML = '<div class="l1-finale-card"><div class="l1-finale-icon">🏅</div><h2>' + l1Esc(fin.title || ('بطل ' + l1Subject().name)) + '</h2>' +
        '<p>' + l1Esc(fin.text || 'عديت الست محطات! ربنا يبارك تعبك ✨') + '</p>' +
        '<div class="l1-finale-points"><i class="fas fa-bolt"></i> ' + l1SubjectPoints() + ' نقطة</div>' +
        '<button class="l1-cta" onclick="l1CloseFinale()">كمّل يا بطل</button></div>';
    el.classList.add('open');
    l1Sfx('win');
    try { if (typeof CanvasFX !== 'undefined') CanvasFX.fireworks(6); else launchConfetti(4000); } catch (e) {}
    l1Data().seenUnlock.finale = true;
    saveToLocalStorage();
}
function l1CloseFinale() {
    var el = document.getElementById('l1-finale');
    if (el) el.classList.remove('open');
}

// ============================================================
// STATION SHELL
// ============================================================
function l1StartStation(n) {
    if (!l1IsOpen(n)) return;
    if (checkLockOrPopup('subject_' + l1State.subject, l1Subject().name)) return;
    if (checkLockOrPopup('lesson_' + l1State.subject + '_' + n, 'المحطة ' + l1Num(n) + ' — ' + l1Station(n).title)) return;
    l1CloseSheet();
    l1State.station = n;
    l1State.tab = 'learn';
    l1State.cardIdx = 0;
    l1State.checks = {};
    l1State.gameIdx = -1;
    exitMapLandscape();
    showScreen('l1-lesson-screen');
    try { logPlayerEvent('lesson_start', { subject: l1State.subject, lesson: n }); } catch (e) {}
}

function l1BackToMap() {
    l1StopGame();
    showScreen('l1-map-screen');
    enterMapLandscape();
}

function l1GamesUnlocked() { return (l1GetScore(l1State.station).learnRead || 0) >= L1_BUCKET_MAX.learnRead; }

function l1SetTab(tab) {
    if (tab === 'games' && !l1GamesUnlocked()) {
        showToast('خلّص كروت التعلّم الأول وبعدين العب 📖', 'warning');
        return;
    }
    l1StopGame();
    l1State.tab = tab;
    renderL1Lesson();
}

function renderL1Lesson() {
    var screen = document.getElementById('l1-lesson-screen');
    if (!screen) return;
    var n = l1State.station, st = l1Station(n), sc = l1GetScore(n);
    var h = '<div class="l1-lesson">';
    h += '<div class="l1-lesson-top">';
    h += '<button class="l1-icon-btn" onclick="l1LessonBack()" aria-label="رجوع"><i class="fas fa-arrow-right"></i></button>';
    h += '<div class="l1-lesson-title"><small>' + l1Esc(l1Subject().name) + ' · المحطة ' + l1Num(n) + '</small><b>' + l1Esc(st.title) + '</b></div>';
    h += '<div class="l1-lesson-score" id="l1-lesson-score">' + (sc.total || 0) + '<small>/' + L1_MAX + '</small></div>';
    h += '</div>';

    var learnDone = (sc.learnRead || 0) >= 20;
    var sumDone = (sc.summary || 0) >= 20;
    var tabs = [
        { id: 'learn', icon: '📖', label: 'تعلّم', done: learnDone, pts: (sc.learnRead || 0) + (sc.learnChecks || 0) + '/40' },
        { id: 'summary', icon: '✍️', label: 'لخّص', done: sumDone, pts: (sc.summary || 0) + '/20' },
        { id: 'games', icon: '🎮', label: 'العب', done: (sc.games || 0) >= 140, locked: !learnDone, pts: (sc.games || 0) + '/140' }
    ];
    h += '<nav class="l1-journey">';
    tabs.forEach(function(t, i) {
        if (i) h += '<span class="l1-journey-link' + (tabs[i - 1].done ? ' lit' : '') + '"></span>';
        h += '<button class="l1-journey-step' + (l1State.tab === t.id ? ' active' : '') + (t.done ? ' done' : '') + (t.locked ? ' locked' : '') + '" onclick="l1SetTab(\'' + t.id + '\')">';
        h += '<span class="l1-js-icon">' + (t.locked ? '🔒' : t.icon) + '</span><span class="l1-js-label">' + t.label + '</span><span class="l1-js-pts">' + t.pts + '</span></button>';
    });
    h += '</nav>';
    h += '<div class="l1-lesson-body" id="l1-lesson-body"></div></div>';
    screen.innerHTML = h;

    var body = document.getElementById('l1-lesson-body');
    if (l1State.tab === 'learn') l1RenderLearn(body);
    else if (l1State.tab === 'summary') l1RenderSummary(body);
    else if (l1State.gameIdx >= 0) l1RenderGameFrame(body);
    else l1RenderGamesList(body);
}

function l1LessonBack() {
    if (l1State.tab === 'games' && l1State.gameIdx >= 0) {
        l1AbortGame();
        return;
    }
    l1BackToMap();
}

function l1RefreshScoreChip() {
    var el = document.getElementById('l1-lesson-score');
    if (el) el.innerHTML = (l1GetScore(l1State.station).total || 0) + '<small>/' + L1_MAX + '</small>';
}

// ============================================================
// LEARN — story cards
// ============================================================
function l1RenderLearn(body) {
    var st = l1Station(l1State.station);
    var cards = st.cards;
    var i = l1State.cardIdx;
    var h = '<div class="l1-cards">';
    h += '<div class="l1-segs">';
    cards.forEach(function(c, k) { h += '<i class="' + (k < i ? 'seen' : k === i ? 'now' : '') + (c.type === 'check' ? ' q' : '') + '"></i>'; });
    h += '</div>';
    h += '<div class="l1-card-stage" id="l1-card-stage">' + l1CardHtml(cards[i], i) + '</div>';
    var isCheck = cards[i].type === 'check';
    var answered = !isCheck || l1State.checks.hasOwnProperty(i);
    h += '<div class="l1-card-nav">';
    h += '<button class="l1-nav-btn" onclick="l1CardGo(-1)"' + (i === 0 ? ' disabled' : '') + '><i class="fas fa-arrow-right"></i></button>';
    h += '<span class="l1-card-count">' + (i + 1) + ' / ' + cards.length + '</span>';
    if (i < cards.length - 1) {
        h += '<button class="l1-nav-btn primary" id="l1-next-btn" onclick="l1CardGo(1)"' + (answered ? '' : ' disabled') + '><i class="fas fa-arrow-left"></i></button>';
    } else {
        h += '<button class="l1-cta small" id="l1-next-btn" onclick="l1FinishLearn()"' + (answered ? '' : ' disabled') + '>خلصت! 🎉</button>';
    }
    h += '</div></div>';
    h += '<div class="l1-learn-extra" id="l1-learn-extra"></div>';
    body.innerHTML = h;
    l1MarkSeen(i);
    l1BindSwipe(document.getElementById('l1-card-stage'), function(dir) { l1CardGo(dir); });

    // Optional admin-configured videos / extra content
    if (typeof loadLearnTabConfig === 'function') {
        loadLearnTabConfig(l1Key(l1State.station), function(cfg) {
            var box = document.getElementById('l1-learn-extra');
            if (!box || !cfg) return;
            var x = '';
            (cfg.videos || []).forEach(function(v) {
                if (!v.videoId) return;
                x += '<div class="l1-video"><div class="l1-video-label"><i class="fas fa-play-circle"></i> ' + l1Esc(v.title || 'فيديو') + '</div>';
                x += '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(v.videoId) + '?rel=0&modestbranding=1" frameborder="0" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div>';
            });
            if (cfg.content && typeof renderLearnContentBlocks === 'function') x += '<div class="lc-blocks">' + renderLearnContentBlocks(cfg.content) + '</div>';
            if (x) box.innerHTML = '<h4 class="l1-extra-title">✨ إضافات من الخدام</h4>' + x;
        });
    }
}

function l1CardHtml(c, i) {
    var h = '<article class="l1-card l1-card-' + c.type + '">';
    if (c.type === 'text') {
        h += '<h3>' + l1Esc(c.title) + '</h3><p>' + l1Rich(c.body) + '</p>';
    } else if (c.type === 'verse') {
        var saved = l1Data().savedVerses.some(function(v) { return v.text === c.text; });
        h += '<div class="l1-verse-mark">❝</div><p class="l1-verse-text">' + l1Esc(c.text) + '</p><cite>' + l1Esc(c.ref) + '</cite>';
        h += '<button class="l1-save-verse' + (saved ? ' saved' : '') + '" onclick="l1SaveVerse(' + i + ')">' + (saved ? '<i class="fas fa-bookmark"></i> محفوظة' : '<i class="far fa-bookmark"></i> احفظها') + '</button>';
    } else if (c.type === 'image') {
        h += '<div class="l1-card-img"><img src="' + c.src + '" alt="' + l1Esc(c.title || '') + '" loading="lazy"></div>';
        if (c.title) h += '<h3>' + l1Esc(c.title) + '</h3>';
        if (c.caption) h += '<p>' + l1Rich(c.caption) + '</p>';
    } else if (c.type === 'diagram') {
        if (c.title) h += '<h3>' + l1Esc(c.title) + '</h3>';
        h += l1DiagramHtml(c);
    } else if (c.type === 'check') {
        var ans = l1State.checks.hasOwnProperty(i) ? l1State.checks[i] : null;
        h += '<div class="l1-check-tag">⚡ اختبر نفسك</div><h3>' + l1Esc(c.q) + '</h3><div class="l1-check-opts">';
        c.options.forEach(function(o, k) {
            var cls = '';
            if (ans !== null) cls = k === c.correct ? ' right' : (l1State.checks['_' + i] === k ? ' wrong' : ' dim');
            h += '<button class="l1-opt' + cls + '"' + (ans !== null ? ' disabled' : '') + ' onclick="l1AnswerCheck(' + i + ',' + k + ')">' + l1Esc(o) + '</button>';
        });
        h += '</div>';
        if (ans !== null && c.explain) h += '<p class="l1-check-explain">' + (ans ? '👏 ' : '💡 ') + l1Esc(c.explain) + '</p>';
    }
    return h + '</article>';
}

function l1DiagramHtml(c) {
    var h = '';
    if (c.kind === 'steps') {
        h += '<ol class="l1-dg-steps">' + c.items.map(function(it, k) {
            return '<li><span>' + (k + 1) + '</span><div><b>' + l1Esc(it.t) + '</b>' + (it.d ? '<small>' + l1Esc(it.d) + '</small>' : '') + '</div></li>';
        }).join('') + '</ol>';
    } else if (c.kind === 'chain') {
        h += '<div class="l1-dg-chain">' + c.items.map(function(it) { return '<span>' + l1Esc(it) + '</span>'; }).join('<i class="fas fa-arrow-left"></i>') + '</div>';
    } else if (c.kind === 'columns') {
        h += '<div class="l1-dg-cols">' + c.cols.map(function(col) {
            return '<div style="--c:' + (col.color || '#d4a24c') + '"><h4>' + l1Esc(col.title) + '</h4><ul>' + col.items.map(function(x) { return '<li>' + l1Esc(x) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div>';
    } else if (c.kind === 'pairs') {
        h += '<table class="l1-dg-pairs"><thead><tr><th>' + l1Esc(c.left || '') + '</th><th>' + l1Esc(c.right || '') + '</th></tr></thead><tbody>' +
            c.rows.map(function(r) { return '<tr><td>' + l1Esc(r[0]) + '</td><td>' + l1Esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
    } else if (c.kind === 'tree') {
        h += '<div class="l1-tree-wrap"><div class="l1-tree"><ul>' + l1TreeNodeHtml(c.root, null) + '</ul></div></div>';
    } else if (c.kind === 'cycle') {
        h += l1CycleHtml(c.items.map(function(x) { return '<span>' + l1Esc(x) + '</span>'; }));
    }
    return h;
}

// slotFn(node) -> html for the label (used by the tree game to render blanks)
function l1TreeNodeHtml(node, slotFn) {
    var label = slotFn ? slotFn(node) : '<span class="l1-tree-label">' + l1Esc(node.label) + (node.note ? '<small>' + l1Esc(node.note) + '</small>' : '') + '</span>';
    var h = '<li>' + label;
    if (node.children && node.children.length) {
        h += '<ul>' + node.children.map(function(ch) { return l1TreeNodeHtml(ch, slotFn); }).join('') + '</ul>';
    }
    return h + '</li>';
}

function l1CycleHtml(itemsHtml) {
    var n = itemsHtml.length, h = '<div class="l1-cycle"><div class="l1-cycle-arrow">↻</div>';
    itemsHtml.forEach(function(x, k) {
        var a = -Math.PI / 2 + k * 2 * Math.PI / n;
        h += '<div class="l1-cycle-item" style="left:' + (50 + 38 * Math.cos(a)).toFixed(1) + '%;top:' + (50 + 38 * Math.sin(a)).toFixed(1) + '%">' + x + '</div>';
    });
    return h + '</div>';
}

function l1MarkSeen(i) {
    var cards = l1Station(l1State.station).cards;
    var seen = Math.round(L1_BUCKET_MAX.learnRead * (i + 1) / cards.length);
    var before = l1GetScore(l1State.station).learnRead || 0;
    if (seen > before) {
        l1SetBucket(l1State.station, 'learnRead', seen, seen < L1_BUCKET_MAX.learnRead);
        if (seen >= L1_BUCKET_MAX.learnRead && before < L1_BUCKET_MAX.learnRead) {
            showToast('🎮 الألعاب اتفتحت!', 'success');
            renderL1LessonKeepCard();
        }
    }
}
// Re-render shell (journey bar state) without resetting card position
function renderL1LessonKeepCard() { setTimeout(renderL1Lesson, 0); }

function l1CardGo(dir) {
    var cards = l1Station(l1State.station).cards;
    var i = l1State.cardIdx;
    if (dir > 0 && cards[i].type === 'check' && !l1State.checks.hasOwnProperty(i)) {
        showToast('جاوب الأول 😉', 'warning');
        return;
    }
    var j = i + dir;
    if (j < 0 || j >= cards.length) return;
    l1State.cardIdx = j;
    var body = document.getElementById('l1-lesson-body');
    l1RenderLearn(body);
    var stage = document.getElementById('l1-card-stage');
    if (stage) stage.classList.add(dir > 0 ? 'in-next' : 'in-prev');
}

function l1AnswerCheck(i, k) {
    if (l1State.checks.hasOwnProperty(i)) return;
    var st = l1Station(l1State.station);
    var c = st.cards[i];
    var ok = k === c.correct;
    l1State.checks[i] = ok;
    l1State.checks['_' + i] = k;
    l1Sfx(ok ? 'good' : 'bad');
    if (ok && typeof CanvasFX !== 'undefined') {
        var btn = document.querySelectorAll('.l1-check-opts .l1-opt')[k];
        if (btn) { var r = btn.getBoundingClientRect(); try { CanvasFX.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 24 }); } catch (e) {} }
    }
    var checks = st.cards.map(function(cc, idx) { return cc.type === 'check' ? idx : -1; }).filter(function(x) { return x >= 0; });
    var correct = checks.filter(function(idx) { return l1State.checks[idx] === true; }).length;
    l1SetBucket(l1State.station, 'learnChecks', L1_BUCKET_MAX.learnChecks * correct / checks.length);
    l1RenderLearn(document.getElementById('l1-lesson-body'));
    l1RefreshScoreChip();
}

function l1SaveVerse(i) {
    var c = l1Station(l1State.station).cards[i];
    var d = l1Data();
    if (!d.savedVerses.some(function(v) { return v.text === c.text; })) {
        d.savedVerses.push({ text: c.text, ref: c.ref, station: l1State.station });
        saveToLocalStorage();
        showToast('الآية اتحفظت في آياتك 📌', 'success');
    }
    l1RenderLearn(document.getElementById('l1-lesson-body'));
}

function l1FinishLearn() {
    l1MarkSeen(l1Station(l1State.station).cards.length - 1);
    var sc = l1GetScore(l1State.station);
    l1State.tab = (sc.summary || 0) >= 20 ? 'games' : 'summary';
    renderL1Lesson();
}

// Horizontal swipe on an element; RTL: swipe right-to-left = next
function l1BindSwipe(el, cb) {
    if (!el) return;
    var x0 = null, y0 = null;
    el.addEventListener('pointerdown', function(e) { if (e.target.closest('button')) return; x0 = e.clientX; y0 = e.clientY; });
    el.addEventListener('pointerup', function(e) {
        if (x0 === null) return;
        var dx = e.clientX - x0, dy = e.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) cb(dx < 0 ? 1 : -1);
    });
}

// ============================================================
// SUMMARY — guided
// ============================================================
var L1_SUMMARY_PROMPTS = [
    { id: 'learned', label: '٣ حاجات اتعلمتها', ph: '١- ...\n٢- ...\n٣- ...' },
    { id: 'verse', label: 'آية لمستني', ph: 'اكتب الآية وشاهدها...' },
    { id: 'live', label: 'هعيشها إزاي النهارده', ph: 'حاجة عملية هعملها...' }
];

function l1RenderSummary(body) {
    var key = l1Key(l1State.station);
    var prev = (GameState.lessonSummaries && GameState.lessonSummaries[key]) || null;
    var parts = (prev && prev.parts) || {};
    l1State.summaryImage = prev ? prev.image || null : null;
    l1State.summaryAudio = prev ? prev.audio || null : null;
    var h = '<div class="l1-summary">';
    h += '<div class="l1-summary-head"><h3>✍️ لخّص المحطة بإيدك</h3><p>التلخيص بيثبّت اللي اتعلمته — والخدام بيقروه 💛</p>';
    if (prev) h += '<span class="l1-badge-done"><i class="fas fa-check"></i> اتسلّم ' + l1Esc(prev.date || '') + '</span>';
    h += '</div>';
    L1_SUMMARY_PROMPTS.forEach(function(p) {
        h += '<label class="l1-field"><span>' + p.label + '</span><textarea id="l1-sum-' + p.id + '" rows="3" placeholder="' + l1Esc(p.ph) + '" oninput="l1SummaryCount()">' + l1Esc(parts[p.id] || '') + '</textarea></label>';
    });
    h += '<div class="l1-sum-count" id="l1-sum-count"></div>';
    h += '<div class="l1-sum-media">';
    h += '<label class="l1-media-btn"><i class="fas fa-camera"></i> صورة الكشكول<input type="file" accept="image/*" onchange="l1SummaryImage(this)" hidden></label>';
    h += '<button class="l1-media-btn" id="l1-rec-btn" onclick="l1ToggleRecord()"><i class="fas fa-microphone"></i> سجّل صوتك</button>';
    h += '</div>';
    h += '<div id="l1-sum-img-preview" class="l1-sum-preview">' + (l1State.summaryImage ? l1SumImgHtml(l1State.summaryImage) : '') + '</div>';
    h += '<div id="l1-sum-audio-preview" class="l1-sum-preview">' + (l1State.summaryAudio ? l1SumAudioHtml(l1State.summaryAudio) : '') + '</div>';
    h += '<button class="l1-cta" onclick="l1SubmitSummary()"><i class="fas fa-paper-plane"></i> ' + (prev ? 'حدّث التلخيص' : 'سلّم التلخيص (+20)') + '</button>';
    h += '</div>';
    body.innerHTML = h;
    l1SummaryCount();
}
function l1SumImgHtml(src) { return '<img src="' + src + '" alt=""><button onclick="l1State.summaryImage=null;this.parentElement.innerHTML=\'\'">✕</button>'; }
function l1SumAudioHtml(src) { return '<audio controls src="' + src + '"></audio><button onclick="l1State.summaryAudio=null;this.parentElement.innerHTML=\'\'">✕</button>'; }

function l1SummaryText() {
    return L1_SUMMARY_PROMPTS.map(function(p) {
        var el = document.getElementById('l1-sum-' + p.id);
        return el ? el.value.trim() : '';
    });
}
function l1SummaryCount() {
    var len = l1SummaryText().join('').length;
    var el = document.getElementById('l1-sum-count');
    if (el) el.innerHTML = len >= L1_SUMMARY_MIN_CHARS ? '<i class="fas fa-check-circle"></i> تمام كده' : 'فاضل ' + (L1_SUMMARY_MIN_CHARS - len) + ' حرف على الأقل';
}
function l1SummaryImage(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    compressImageToBase64(f, 900, 900, 0.7).then(function(data) {
        l1State.summaryImage = data;
        document.getElementById('l1-sum-img-preview').innerHTML = l1SumImgHtml(data);
    }).catch(function() { showToast('مش قادر أقرا الصورة', 'error'); });
}
function l1ToggleRecord() {
    var btn = document.getElementById('l1-rec-btn');
    if (l1State.recorder) { try { l1State.recorder.stop(); } catch (e) {} return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        showToast('التسجيل الصوتي مش متاح على المتصفح ده', 'error');
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        var mime = '';
        ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].some(function(m) {
            try { if (MediaRecorder.isTypeSupported(m)) { mime = m; return true; } } catch (e) {}
            return false;
        });
        var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        var chunks = [];
        rec.ondataavailable = function(e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function() {
            stream.getTracks().forEach(function(t) { t.stop(); });
            l1State.recorder = null;
            var reader = new FileReader();
            reader.onload = function() {
                l1State.summaryAudio = reader.result;
                var pv = document.getElementById('l1-sum-audio-preview');
                if (pv) pv.innerHTML = l1SumAudioHtml(reader.result);
            };
            reader.readAsDataURL(new Blob(chunks, { type: mime || 'audio/webm' }));
            var b = document.getElementById('l1-rec-btn');
            if (b) { b.classList.remove('rec'); b.innerHTML = '<i class="fas fa-microphone"></i> سجّل صوتك'; }
        };
        rec.start();
        l1State.recorder = rec;
        if (btn) { btn.classList.add('rec'); btn.innerHTML = '<i class="fas fa-stop"></i> وقّف التسجيل'; }
        // Hard cap: 2 minutes keeps the base64 payload small enough for the player doc
        setTimeout(function() { if (l1State.recorder === rec) { try { rec.stop(); } catch (e) {} } }, 120000);
    }).catch(function() { showToast('مش قادر أفتح الميكروفون', 'error'); });
}

function l1SubmitSummary() {
    var vals = l1SummaryText();
    if (vals.join('').length < L1_SUMMARY_MIN_CHARS) {
        showToast('اكتب شوية كمان (' + L1_SUMMARY_MIN_CHARS + ' حرف على الأقل) ✍️', 'warning');
        return;
    }
    var parts = {};
    var text = L1_SUMMARY_PROMPTS.map(function(p, k) {
        parts[p.id] = vals[k];
        return vals[k] ? p.label + ':\n' + vals[k] : '';
    }).filter(Boolean).join('\n\n');
    if (!GameState.lessonSummaries) GameState.lessonSummaries = {};
    GameState.lessonSummaries[l1Key(l1State.station)] = {
        text: text, parts: parts,
        image: l1State.summaryImage || null,
        audio: l1State.summaryAudio || null,
        date: getTodayKey(),
        level: 1
    };
    l1SetBucket(l1State.station, 'summary', L1_BUCKET_MAX.summary);
    showToast('التلخيص اتسلّم! 👏', 'success');
    try { logPlayerEvent('lesson_summary', { subject: l1State.subject, lesson: l1State.station }); } catch (e) {}
    l1State.tab = l1GamesUnlocked() ? 'games' : 'learn';
    renderL1Lesson();
}

// ============================================================
// GAMES — list, frame, results
// ============================================================
function l1RenderGamesList(body) {
    var n = l1State.station, st = l1Station(n);
    var h = '<div class="l1-games">';
    h += '<div class="l1-games-head"><h3>🎮 ألعاب المحطة</h3><p>كل لعبة بتحسب أحسن نتيجة ليك — العب تاني وكسّر رقمك!</p></div>';
    h += '<div class="l1-games-grid">';
    st.games.forEach(function(g, i) {
        var best = Math.min(l1GameBest(n, g), g.max);
        var pct = Math.round(best / g.max * 100);
        h += '<button class="l1-game-card' + (i === 0 ? ' signature' : '') + '" onclick="l1StartGame(' + i + ')">';
        if (i === 0) h += '<span class="l1-game-sig">⭐ اللعبة الكبيرة</span>';
        h += '<span class="l1-game-icon">' + (g.icon || '🎯') + '</span>';
        h += '<span class="l1-game-title">' + l1Esc(g.title) + '</span>';
        h += '<span class="l1-game-desc">' + l1Esc(g.desc || '') + '</span>';
        h += '<span class="l1-bar"><i style="width:' + pct + '%"></i></span>';
        h += '<span class="l1-game-best">' + best + ' / ' + g.max + '</span>';
        h += '</button>';
    });
    h += '</div></div>';
    body.innerHTML = h;
}

function l1StartGame(i) {
    l1State.gameIdx = i;
    initAudio();
    renderL1Lesson();
}

function l1FrameHtml(g, isArcade, inner) {
    var h = '<div class="l1-game-frame' + (isArcade ? ' arcade' : '') + '" id="l1-game-frame">';
    h += '<div class="l1-game-bar"><button class="l1-icon-btn" onclick="l1AbortGame()" aria-label="خروج"><i class="fas fa-times"></i></button>';
    h += '<b>' + (g.icon || '') + ' ' + l1Esc(g.title) + '</b><span class="l1-hud" id="l1-hud"></span></div>';
    if (!inner && g.data && g.data.prompt) h += '<p class="l1-game-prompt">' + l1Esc(g.data.prompt) + '</p>';
    h += '<div class="l1-game-host" id="l1-game-host">' + (inner || '') + '</div>';
    h += '<div class="l1-ask" id="l1-ask"></div>';
    return h + '</div>';
}

// Arcade games run in a layer attached to <body>: .screen has z-index:1 and an entry
// transform, which would trap a position:fixed child under other page layers.
function l1RemoveArcadeLayer() {
    var layer = document.getElementById('l1-arcade-layer');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
}

function l1RenderGameFrame(body) {
    var n = l1State.station, g = l1Station(n).games[l1State.gameIdx];
    var isArcade = g.type === 'arcade';
    l1RemoveArcadeLayer();
    if (isArcade) {
        body.innerHTML = '<p class="l1-empty">🎮 اللعبة شغالة...</p>';
        var layer = document.createElement('div');
        layer.id = 'l1-arcade-layer';
        layer.innerHTML = l1FrameHtml(g, true);
        document.body.appendChild(layer);
    } else {
        body.innerHTML = l1FrameHtml(g, false);
    }
    var host = document.getElementById('l1-game-host');
    var api = l1GameApi(g);
    try {
        if (isArcade) {
            if (typeof L1_ARCADE === 'undefined' || !L1_ARCADE[g.arcade]) throw new Error('arcade missing: ' + g.arcade);
            enterMapLandscape();
            l1State.gameInst = L1_ARCADE[g.arcade](host, g.data, api);
        } else {
            var fn = L1_GAME_TYPES[g.type];
            if (!fn) throw new Error('game type missing: ' + g.type);
            l1State.gameInst = fn(host, g.data, api);
        }
    } catch (e) {
        console.error('[L1] game start failed', e);
        host.innerHTML = '<p class="l1-empty">اللعبة دي مش جاهزة لسه 🙏</p>';
    }
}

function l1GameApi(g) {
    var ended = false;
    return {
        ask: l1Ask,
        end: function(raw, rawMax) {
            if (ended) return;
            ended = true;
            l1FinishGame(g, raw, rawMax);
        },
        sfx: l1Sfx,
        fx: function(x, y) {
            var host = document.getElementById('l1-game-host');
            if (!host || typeof CanvasFX === 'undefined') return;
            var r = host.getBoundingClientRect();
            try { CanvasFX.burst(r.left + x, r.top + y, { count: 22 }); } catch (e) {}
        },
        hud: function(text) {
            var el = document.getElementById('l1-hud');
            if (el) el.textContent = text;
        }
    };
}

// Modal MCQ checkpoint used by arcade games and DOM games
function l1Ask(q, cb) {
    var el = document.getElementById('l1-ask');
    if (!el || !q) { cb(false); return; }
    var h = '<div class="l1-ask-card"><div class="l1-check-tag">⚡ سؤال سريع</div><h3>' + l1Esc(q.q) + '</h3><div class="l1-check-opts">';
    q.options.forEach(function(o, k) { h += '<button class="l1-opt" data-k="' + k + '">' + l1Esc(o) + '</button>'; });
    h += '</div><p class="l1-check-explain" id="l1-ask-explain"></p></div>';
    el.innerHTML = h;
    el.classList.add('open');
    var done = false;
    el.querySelectorAll('.l1-opt').forEach(function(btn) {
        btn.onclick = function() {
            if (done) return;
            done = true;
            var k = +btn.getAttribute('data-k'), ok = k === q.correct;
            el.querySelectorAll('.l1-opt').forEach(function(b, bi) {
                b.disabled = true;
                b.classList.add(bi === q.correct ? 'right' : (bi === k ? 'wrong' : 'dim'));
            });
            l1Sfx(ok ? 'good' : 'bad');
            var ex = document.getElementById('l1-ask-explain');
            if (ex && q.explain) ex.textContent = (ok ? '👏 ' : '💡 ') + q.explain;
            setTimeout(function() {
                el.classList.remove('open');
                el.innerHTML = '';
                cb(ok);
            }, q.explain ? 1800 : 900);
        };
    });
}

function l1StopGame() {
    if (l1State.gameInst && l1State.gameInst.destroy) {
        try { l1State.gameInst.destroy(); } catch (e) {}
    }
    var wasArcade = l1State.gameIdx >= 0 && l1Station(l1State.station).games[l1State.gameIdx] &&
        l1Station(l1State.station).games[l1State.gameIdx].type === 'arcade';
    l1State.gameInst = null;
    l1State.gameIdx = -1;
    l1RemoveArcadeLayer();
    if (wasArcade) exitMapLandscape();
}

// Back during a game: keep partial progress for DOM games that report it
function l1AbortGame() {
    var n = l1State.station, g = l1Station(n).games[l1State.gameIdx];
    var inst = l1State.gameInst;
    if (g && inst && inst.partial) {
        var p = inst.partial();
        if (p && p[0] > 0) {
            var saved = l1SaveGameScore(g, p[0], p[1]);
            if (saved.improved) showToast('تم حفظ ' + saved.score + ' نقطة 💾', 'success');
        }
    }
    l1StopGame();
    l1State.tab = 'games';
    renderL1Lesson();
}

function l1SaveGameScore(g, raw, rawMax) {
    var n = l1State.station;
    var score = Math.round(g.max * Math.max(0, Math.min(1, rawMax ? raw / rawMax : 0)));
    var key = l1Key(n) + '_mg_' + g.id;
    if (!GameState.miniGameScores) GameState.miniGameScores = {};
    var prev = GameState.miniGameScores[key] || 0;
    var improved = score > prev;
    if (improved) {
        GameState.miniGameScores[key] = score;
        var gems = Math.floor((score - prev) / 2);
        if (gems > 0) {
            GameState.gems = (GameState.gems || 0) + gems;
            try { showFloatingReward('+' + gems + ' 💎'); } catch (e) {}
        }
        l1SetBucket(n, 'games', l1GamesTotal(n));
    }
    return { score: score, prev: prev, improved: improved };
}

function l1FinishGame(g, raw, rawMax) {
    var res = l1SaveGameScore(g, raw, rawMax);
    try { logPlayerEvent('l1_game', { subject: l1State.subject, station: l1State.station, game: g.id, score: res.score }); } catch (e) {}
    var inst = l1State.gameInst;
    if (inst && inst.destroy) { try { inst.destroy(); } catch (e) {} }
    l1State.gameInst = null;
    if (g.type === 'arcade') { l1RemoveArcadeLayer(); exitMapLandscape(); }
    var pct = res.score / g.max;
    var stars = pct >= 0.95 ? 3 : pct >= 0.75 ? 2 : pct >= 0.5 ? 1 : 0;
    var body = document.getElementById('l1-lesson-body');
    if (!body) return;
    var msg = stars === 3 ? 'إيه الجمال ده! 🔥' : stars === 2 ? 'برافو عليك! 👏' : stars === 1 ? 'حلو! تقدر أحسن 💪' : 'ولا يهمك، جرّب تاني 🙏';
    var h = '<div class="l1-result">';
    h += '<div class="l1-result-stars">' + l1StarsHtml(stars) + '</div>';
    h += '<h3>' + msg + '</h3>';
    h += '<div class="l1-result-score"><b>' + res.score + '</b> / ' + g.max + '</div>';
    h += res.improved ? '<p class="l1-result-best">🏅 رقم قياسي جديد!</p>' : '<p class="l1-result-best">أحسن نتيجة ليك: ' + res.prev + '</p>';
    h += '<div class="l1-result-btns"><button class="l1-cta" onclick="l1StartGame(' + l1State.gameIdx + ')"><i class="fas fa-redo"></i> العب تاني</button>';
    h += '<button class="l1-cta ghost" onclick="l1StopGame();l1State.tab=\'games\';renderL1Lesson()">الألعاب</button></div>';
    h += '</div>';
    body.innerHTML = l1FrameHtml(g, false, h);
    l1RefreshScoreChip();
    if (stars >= 2) { l1Sfx('win'); try { launchConfetti(1800); } catch (e) {} }
}

// ============================================================
// DOM GAME TYPES
// Each: function(host, data, api) -> { destroy, partial }  and calls api.end(raw, rawMax)
// ============================================================
var L1_GAME_TYPES = {};

// Shared mistake/combo HUD helper
function l1Tracker(api, total) {
    var t = { ok: 0, bad: 0, combo: 0, total: total };
    t.hit = function() { t.ok++; t.combo++; api.sfx(t.combo >= 3 ? 'combo' : 'good'); t.show(); };
    t.miss = function() { t.bad++; t.combo = 0; api.sfx('bad'); t.show(); };
    t.show = function() { api.hud('✅ ' + t.ok + '/' + t.total + (t.combo >= 2 ? '  🔥x' + t.combo : '') + (t.bad ? '  ❌ ' + t.bad : '')); };
    t.show();
    return t;
}
function l1Shake(el) { if (!el) return; el.classList.remove('l1-shake'); void el.offsetWidth; el.classList.add('l1-shake'); }
function l1FxAt(api, el, host) {
    if (!el) return;
    var r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
    api.fx(r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2);
}

// ---- timeline: tap the items in the correct order ----
L1_GAME_TYPES.timeline = function(host, data, api) {
    var items = data.slotLabels ? data.items.slice() : l1PickOrdered(data.items, data.pick || 6);
    var next = 0;
    var tr = l1Tracker(api, items.length);
    var cycle = data.layout === 'cycle';
    var slotHtml = items.map(function(_, k) {
        return '<div class="l1-tl-slot" id="l1-tl-slot-' + k + '"><em>' + l1Esc(data.slotLabels ? data.slotLabels[k] : String(k + 1)) + '</em><b></b></div>';
    });
    var h = '<div class="l1-tl' + (cycle ? ' cycle' : '') + '">';
    h += cycle ? l1CycleHtml(slotHtml) : '<div class="l1-tl-road">' + slotHtml.join('') + '</div>';
    h += '<p class="l1-hint">دوس على الكروت بالترتيب الصح 👇</p><div class="l1-tray">';
    l1Shuffle(items.map(function(t, k) { return { t: t, k: k }; })).forEach(function(it) {
        h += '<button class="l1-chip" data-k="' + it.k + '">' + l1Esc(it.t) + '</button>';
    });
    h += '</div></div>';
    host.innerHTML = h;
    host.querySelectorAll('.l1-chip').forEach(function(btn) {
        btn.onclick = function() {
            var k = +btn.getAttribute('data-k');
            if (k === next) {
                var slot = document.getElementById('l1-tl-slot-' + k);
                slot.querySelector('b').textContent = items[k];
                slot.classList.add('filled');
                btn.classList.add('used');
                btn.disabled = true;
                l1FxAt(api, slot, host);
                next++;
                tr.hit();
                if (next === items.length) setTimeout(function() { api.end(Math.max(0, items.length * 2 - tr.bad), items.length * 2); }, 700);
            } else {
                tr.miss();
                l1Shake(btn);
            }
        };
    });
    return { destroy: function() {}, partial: function() { return [Math.max(0, next * 2 - tr.bad), items.length * 2]; } };
};

// ---- tree: place hidden names into the family tree ----
L1_GAME_TYPES.tree = function(host, data, api) {
    var all = [];
    (function walk(node, depth) { if (depth > 0) all.push(node); (node.children || []).forEach(function(c) { walk(c, depth + 1); }); })(data.root, 0);
    var hidden = l1Pick(all, data.hide || 5);
    var hiddenSet = hidden.map(function(n) { return n; });
    var ids = new Map();
    hidden.forEach(function(n, k) { ids.set(n, k); });
    var placed = 0, selected = null;
    var tr = l1Tracker(api, hidden.length);
    var treeHtml = l1TreeNodeHtml(data.root, function(node) {
        if (ids.has(node)) return '<button class="l1-tree-label slot" data-k="' + ids.get(node) + '">؟</button>';
        return '<span class="l1-tree-label">' + l1Esc(node.label) + (node.note ? '<small>' + l1Esc(node.note) + '</small>' : '') + '</span>';
    });
    var h = '<div class="l1-tree-game"><div class="l1-tree-wrap"><div class="l1-tree"><ul>' + treeHtml + '</ul></div></div>';
    h += '<p class="l1-hint">اختار اسم من تحت وبعدين دوس على مكانه في الشجرة 🌳</p><div class="l1-tray">';
    l1Shuffle(hidden.map(function(n, k) { return { t: n.label, k: k }; })).forEach(function(it) {
        h += '<button class="l1-chip" data-k="' + it.k + '">' + l1Esc(it.t) + '</button>';
    });
    h += '</div></div>';
    host.innerHTML = h;
    var chips = host.querySelectorAll('.l1-chip');
    chips.forEach(function(btn) {
        btn.onclick = function() {
            chips.forEach(function(b) { b.classList.remove('sel'); });
            selected = btn;
            btn.classList.add('sel');
        };
    });
    host.querySelectorAll('.l1-tree-label.slot').forEach(function(slot) {
        slot.onclick = function() {
            if (!selected || slot.classList.contains('filled')) {
                if (!selected) showToast('اختار اسم الأول 👇', 'warning');
                return;
            }
            var want = +slot.getAttribute('data-k'), got = +selected.getAttribute('data-k');
            // Same label may appear twice in a tree; accept by label text
            if (want === got || hiddenSet[want].label === hiddenSet[got].label) {
                slot.textContent = hiddenSet[want].label;
                slot.classList.add('filled');
                slot.disabled = true;
                selected.classList.add('used');
                selected.disabled = true;
                selected = null;
                l1FxAt(api, slot, host);
                placed++;
                tr.hit();
                if (placed === hidden.length) setTimeout(function() { api.end(Math.max(0, hidden.length * 2 - tr.bad), hidden.length * 2); }, 700);
            } else {
                tr.miss();
                l1Shake(slot);
            }
        };
    });
    return { destroy: function() {}, partial: function() { return [Math.max(0, placed * 2 - tr.bad), hidden.length * 2]; } };
};

// ---- connect: draw a line from an item to its pair ----
L1_GAME_TYPES.connect = function(host, data, api) {
    var pairs = l1Pick(data.pairs, data.pick || 5);
    var right = l1Shuffle(pairs.map(function(p, k) { return { t: p[1], k: k }; }));
    var done = 0, from = null, drag = null;
    var tr = l1Tracker(api, pairs.length);
    var h = '<div class="l1-connect"><svg class="l1-connect-svg" id="l1-connect-svg"></svg>';
    h += '<div class="l1-connect-col a"><h4>' + l1Esc(data.left || '') + '</h4>' + pairs.map(function(p, k) { return '<button class="l1-cn-item" data-side="a" data-k="' + k + '">' + l1Esc(p[0]) + '</button>'; }).join('') + '</div>';
    h += '<div class="l1-connect-col b"><h4>' + l1Esc(data.right || '') + '</h4>' + right.map(function(r) { return '<button class="l1-cn-item" data-side="b" data-k="' + r.k + '">' + l1Esc(r.t) + '</button>'; }).join('') + '</div>';
    h += '</div><p class="l1-hint">اسحب خط من الناحية دي للناحية التانية (أو دوس على الاتنين) ✍️</p>';
    host.innerHTML = h;
    var box = host.querySelector('.l1-connect');
    var svg = document.getElementById('l1-connect-svg');
    function center(el, side) {
        var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        // Column a sits on the right in RTL: anchor on its inner (left) edge; b anchors on its right edge
        return { x: (side === 'a' ? r.left : r.right) - b.left, y: r.top + r.height / 2 - b.top };
    }
    function line(p, q, cls) {
        var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', p.x); l.setAttribute('y1', p.y); l.setAttribute('x2', q.x); l.setAttribute('y2', q.y);
        l.setAttribute('class', cls);
        svg.appendChild(l);
        return l;
    }
    function tryPair(a, b) {
        if (!a || !b || a.classList.contains('done') || b.classList.contains('done')) return;
        var ok = a.getAttribute('data-k') === b.getAttribute('data-k');
        var l = line(center(a, 'a'), center(b, 'b'), ok ? 'ok' : 'bad');
        if (ok) {
            a.classList.add('done'); b.classList.add('done');
            a.disabled = b.disabled = true;
            l1FxAt(api, b, host);
            done++;
            tr.hit();
            if (done === pairs.length) setTimeout(function() { api.end(Math.max(0, pairs.length * 2 - tr.bad), pairs.length * 2); }, 700);
        } else {
            tr.miss();
            l1Shake(b);
            setTimeout(function() { if (l.parentNode) l.parentNode.removeChild(l); }, 600);
        }
    }
    function clearSel() { host.querySelectorAll('.l1-cn-item.sel').forEach(function(x) { x.classList.remove('sel'); }); }
    box.addEventListener('pointerdown', function(e) {
        var it = e.target.closest('.l1-cn-item');
        if (!it || it.classList.contains('done')) return;
        if (from && it.getAttribute('data-side') !== from.getAttribute('data-side')) {
            var a = from.getAttribute('data-side') === 'a' ? from : it, b = a === from ? it : from;
            clearSel(); from = null;
            tryPair(a, b);
            return;
        }
        clearSel();
        from = it;
        it.classList.add('sel');
        var p = center(it, it.getAttribute('data-side'));
        drag = line(p, p, 'drag');
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
    });
    box.addEventListener('pointermove', function(e) {
        if (!drag) return;
        var b = box.getBoundingClientRect();
        drag.setAttribute('x2', e.clientX - b.left);
        drag.setAttribute('y2', e.clientY - b.top);
    });
    box.addEventListener('pointerup', function(e) {
        if (!drag) return;
        if (drag.parentNode) drag.parentNode.removeChild(drag);
        drag = null;
        var target = document.elementFromPoint(e.clientX, e.clientY);
        var it = target && target.closest ? target.closest('.l1-cn-item') : null;
        if (it && from && it !== from && it.getAttribute('data-side') !== from.getAttribute('data-side')) {
            var a = from.getAttribute('data-side') === 'a' ? from : it, bb = a === from ? it : from;
            clearSel(); from = null;
            tryPair(a, bb);
        }
    });
    return { destroy: function() {}, partial: function() { return [Math.max(0, done * 2 - tr.bad), pairs.length * 2]; } };
};

// ---- swipe: sort cards into 2-3 bins against the clock ----
L1_GAME_TYPES.swipe = function(host, data, api) {
    var items = l1Pick(data.items, data.pick || 12);
    var bins = data.bins;
    var idx = 0, left = data.time || 60, combo = 0, bonus = 0, ok = 0;
    var tr = l1Tracker(api, items.length);
    var two = bins.length === 2;
    var h = '<div class="l1-swipe' + (two ? ' two' : ' three') + '">';
    h += '<div class="l1-swipe-timer"><i id="l1-swipe-bar"></i></div>';
    h += '<div class="l1-swipe-deck" id="l1-swipe-deck"></div>';
    h += '<div class="l1-swipe-bins">' + bins.map(function(b, k) { return '<button class="l1-bin" data-b="' + k + '">' + l1Esc(b) + '</button>'; }).join('') + '</div>';
    if (two) h += '<p class="l1-hint">اسحب الكارت يمين أو شمال — أو دوس على الاختيار</p>';
    h += '</div>';
    host.innerHTML = h;
    var deck = document.getElementById('l1-swipe-deck');
    var bar = document.getElementById('l1-swipe-bar');
    var finished = false;
    function end() {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        api.end(ok + Math.min(bonus, Math.ceil(items.length / 4)), items.length + Math.ceil(items.length / 4));
    }
    function showCard() {
        if (idx >= items.length) { end(); return; }
        deck.innerHTML = '<div class="l1-swipe-card" id="l1-swipe-card">' + l1Esc(items[idx].t) + '<small>' + (idx + 1) + '/' + items.length + '</small></div>';
        if (two) bindDrag(document.getElementById('l1-swipe-card'));
    }
    function answer(b) {
        if (finished || idx >= items.length) return;
        var card = document.getElementById('l1-swipe-card');
        var right = b === items[idx].bin;
        if (right) { ok++; combo++; if (combo >= 3) bonus++; tr.hit(); } else { combo = 0; tr.miss(); }
        if (card) {
            card.classList.add(right ? 'good' : 'bad');
            // bins[0] sits on the right in RTL
            card.style.transform = 'translateX(' + (two ? (b === 0 ? 140 : -140) : 0) + '%) rotate(' + (two ? (b === 0 ? 14 : -14) : 0) + 'deg)';
            card.style.opacity = '0';
        }
        if (!right) {
            var binBtn = host.querySelector('.l1-bin[data-b="' + items[idx].bin + '"]');
            if (binBtn) { binBtn.classList.add('hint'); setTimeout(function() { binBtn.classList.remove('hint'); }, 700); }
        }
        idx++;
        setTimeout(showCard, 260);
    }
    function bindDrag(card) {
        var x0 = null;
        card.addEventListener('pointerdown', function(e) { x0 = e.clientX; try { card.setPointerCapture(e.pointerId); } catch (err) {} });
        card.addEventListener('pointermove', function(e) {
            if (x0 === null) return;
            var dx = e.clientX - x0;
            card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 14) + 'deg)';
        });
        card.addEventListener('pointerup', function(e) {
            if (x0 === null) return;
            var dx = e.clientX - x0;
            x0 = null;
            if (Math.abs(dx) > 70) answer(dx > 0 ? 0 : 1);
            else card.style.transform = '';
        });
    }
    host.querySelectorAll('.l1-bin').forEach(function(btn) { btn.onclick = function() { answer(+btn.getAttribute('data-b')); }; });
    var total = left;
    var timer = setInterval(function() {
        if (document.hidden) return;
        left--;
        if (bar) bar.style.width = (left / total * 100) + '%';
        if (left <= 10 && left > 0) api.sfx('tick');
        if (left <= 0) end();
    }, 1000);
    showCard();
    return {
        destroy: function() { finished = true; clearInterval(timer); },
        partial: function() { return [ok, items.length + Math.ceil(items.length / 4)]; }
    };
};

// ---- clues: guess who with as few clues as possible ----
L1_GAME_TYPES.clues = function(host, data, api) {
    var rounds = l1Pick(data.rounds, data.pick || 4);
    var r = 0, shown = 1, raw = 0, locked = false;
    var tr = l1Tracker(api, rounds.length);
    function render() {
        var R = rounds[r];
        var h = '<div class="l1-clues"><div class="l1-clues-round">سؤال ' + (r + 1) + ' من ' + rounds.length + ' · ' + (4 - shown) + ' نقط</div>';
        h += '<div class="l1-clues-list">' + R.clues.slice(0, shown).map(function(c, k) { return '<div class="l1-clue" style="animation-delay:' + (k === shown - 1 ? 0 : 0) + 's"><span>' + (k + 1) + '</span>' + l1Esc(c) + '</div>'; }).join('') + '</div>';
        h += '<div class="l1-check-opts">' + R.options.map(function(o, k) { return '<button class="l1-opt" data-k="' + k + '">' + l1Esc(o) + '</button>'; }).join('') + '</div>';
        if (shown < R.clues.length) h += '<button class="l1-cta ghost small" id="l1-more-clue">💡 عايز كلو كمان</button>';
        h += '</div>';
        host.innerHTML = h;
        locked = false;
        host.querySelectorAll('.l1-opt').forEach(function(btn) {
            btn.onclick = function() {
                if (locked) return;
                var pick = R.options[+btn.getAttribute('data-k')];
                if (pick === R.answer) {
                    locked = true;
                    raw += 4 - shown;
                    btn.classList.add('right');
                    tr.hit();
                    l1FxAt(api, btn, host);
                    setTimeout(nextRound, 900);
                } else {
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    tr.miss();
                    if (shown < R.clues.length) { shown++; setTimeout(render, 500); }
                    else {
                        locked = true;
                        host.querySelectorAll('.l1-opt').forEach(function(b) { if (R.options[+b.getAttribute('data-k')] === R.answer) b.classList.add('right'); });
                        setTimeout(nextRound, 1300);
                    }
                }
            };
        });
        var more = document.getElementById('l1-more-clue');
        if (more) more.onclick = function() { shown++; render(); };
    }
    function nextRound() {
        r++;
        shown = 1;
        if (r >= rounds.length) api.end(raw, rounds.length * 3);
        else render();
    }
    render();
    return { destroy: function() {}, partial: function() { return [raw, rounds.length * 3]; } };
};

// ---- decode: split a verse written with no spaces into its words ----
L1_GAME_TYPES.decode = function(host, data, api) {
    var verses = l1Pick(data.verses, data.pick || 2);
    var v = 0, raw = 0, rawMax = 0;
    verses.forEach(function(x) { rawMax += x.text.trim().split(/\s+/).length - 1; });
    var tr = l1Tracker(api, rawMax);
    var found, bounds, mistakes;
    function render() {
        var words = verses[v].text.trim().split(/\s+/);
        var letters = [];
        bounds = {};
        found = {};
        mistakes = 0;
        words.forEach(function(w, wi) {
            Array.from(w).forEach(function(ch) { letters.push(ch); });
            if (wi < words.length - 1) bounds[letters.length - 1] = true;
        });
        var h = '<div class="l1-decode"><p class="l1-decode-note">📜 زمان الكتاب كان مكتوب من غير مسافات بين الكلمات! دوس على <b>آخر حرف</b> في كل كلمة عشان تفصلها.</p>';
        h += '<div class="l1-decode-text" id="l1-decode-text">' + letters.map(function(ch, k) { return '<span data-k="' + k + '">' + l1Esc(ch) + '</span>'; }).join('') + '</div>';
        h += '<div class="l1-decode-ref">' + l1Esc(verses[v].ref || '') + '</div>';
        h += '<div class="l1-decode-progress">آية ' + (v + 1) + ' من ' + verses.length + '</div></div>';
        host.innerHTML = h;
        var total = Object.keys(bounds).length;
        document.getElementById('l1-decode-text').addEventListener('click', function(e) {
            var sp = e.target.closest('span[data-k]');
            if (!sp) return;
            var k = +sp.getAttribute('data-k');
            if (found[k]) return;
            if (bounds[k]) {
                found[k] = true;
                sp.classList.add('split');
                tr.hit();
                l1FxAt(api, sp, host);
                if (Object.keys(found).length === total) {
                    raw += Math.max(0, total - mistakes);
                    document.getElementById('l1-decode-text').classList.add('solved');
                    setTimeout(function() {
                        v++;
                        if (v >= verses.length) api.end(raw, rawMax);
                        else render();
                    }, 1300);
                }
            } else {
                mistakes++;
                tr.miss();
                sp.classList.add('nope');
                setTimeout(function() { sp.classList.remove('nope'); }, 450);
            }
        });
    }
    render();
    return { destroy: function() {}, partial: function() { return [raw, rawMax]; } };
};

// ---- scenario: chat-style situation, pick the servant-like response ----
L1_GAME_TYPES.scenario = function(host, data, api) {
    var rounds = l1Pick(data.rounds, data.pick || 5);
    var r = 0, raw = 0, locked = false;
    var tr = l1Tracker(api, rounds.length);
    function render() {
        var R = rounds[r];
        var opts = l1Shuffle(R.options);
        var h = '<div class="l1-scn"><div class="l1-scn-round">موقف ' + (r + 1) + ' من ' + rounds.length + '</div>';
        h += '<div class="l1-scn-chat"><div class="l1-scn-bubble them"><span class="l1-scn-av">' + l1Esc(R.emoji || '🧒') + '</span><p>' + l1Rich(R.situation) + '</p></div>';
        h += '<div class="l1-scn-typing" id="l1-scn-typing"><i></i><i></i><i></i></div></div>';
        h += '<p class="l1-hint">لو إنت خادم حقيقي… هترد إزاي؟ 🤔</p><div class="l1-check-opts">';
        opts.forEach(function(o, k) { h += '<button class="l1-opt" data-k="' + k + '">' + l1Esc(o.t) + '</button>'; });
        h += '</div></div>';
        host.innerHTML = h;
        locked = false;
        host.querySelectorAll('.l1-opt').forEach(function(btn) {
            btn.onclick = function() {
                if (locked) return;
                locked = true;
                var o = opts[+btn.getAttribute('data-k')];
                host.querySelectorAll('.l1-opt').forEach(function(b, bi) {
                    b.disabled = true;
                    b.classList.add(opts[bi].good ? 'right' : (b === btn ? 'wrong' : 'dim'));
                });
                if (o.good) { raw++; tr.hit(); l1FxAt(api, btn, host); } else tr.miss();
                var good = opts.filter(function(x) { return x.good; })[0] || o;
                var chat = host.querySelector('.l1-scn-chat');
                var typing = document.getElementById('l1-scn-typing');
                if (typing) typing.remove();
                chat.insertAdjacentHTML('beforeend', '<div class="l1-scn-bubble me' + (o.good ? ' good' : ' bad') + '"><p>' + l1Esc(o.t) + '</p></div>');
                var why = o.why || good.why;
                if (why) chat.insertAdjacentHTML('beforeend', '<div class="l1-scn-why">' + (o.good ? '👏 ' : '💡 ') + l1Rich(why) + '</div>');
                var next = document.createElement('button');
                next.className = 'l1-cta small';
                next.textContent = r + 1 < rounds.length ? 'الموقف اللي بعده ←' : 'النتيجة 🎉';
                next.onclick = function() { r++; if (r >= rounds.length) api.end(raw, rounds.length); else render(); };
                host.querySelector('.l1-scn').appendChild(next);
            };
        });
    }
    render();
    return { destroy: function() {}, partial: function() { return [raw, rounds.length]; } };
};

// ---- memory: flip cards and match each pair ----
L1_GAME_TYPES.memory = function(host, data, api) {
    var pairs = l1Pick(data.pairs, data.pick || 6);
    var cards = [];
    pairs.forEach(function(p, k) { cards.push({ t: p[0], k: k, side: 'a' }, { t: p[1], k: k, side: 'b' }); });
    cards = l1Shuffle(cards);
    var open = [], matched = 0, busy = false, flips = 0;
    var tr = l1Tracker(api, pairs.length);
    var h = '<div class="l1-mem" style="--cols:' + (cards.length > 12 ? 4 : 3) + '">';
    cards.forEach(function(c, i) {
        h += '<button class="l1-mem-card side-' + c.side + '" data-i="' + i + '"><span class="l1-mem-back"></span><span class="l1-mem-face">' + l1Esc(c.t) + '</span></button>';
    });
    h += '</div><p class="l1-hint">اقلب كارتين… لو هما مع بعض هيفضلوا مفتوحين 🃏</p>';
    host.innerHTML = h;
    function score() { return Math.max(0, pairs.length * 2 - Math.max(0, tr.bad - Math.floor(pairs.length / 2))); }
    host.querySelectorAll('.l1-mem-card').forEach(function(btn) {
        btn.onclick = function() {
            if (busy || btn.classList.contains('open') || btn.classList.contains('done')) return;
            btn.classList.add('open');
            open.push(btn);
            if (open.length < 2) { api.sfx('tick'); return; }
            flips++;
            var a = cards[+open[0].getAttribute('data-i')], b = cards[+open[1].getAttribute('data-i')];
            if (a.k === b.k && a.side !== b.side) {
                open.forEach(function(x) { x.classList.add('done'); });
                l1FxAt(api, btn, host);
                open = [];
                matched++;
                tr.hit();
                if (matched === pairs.length) setTimeout(function() { api.end(score(), pairs.length * 2); }, 700);
            } else {
                busy = true;
                tr.miss();
                var pair = open;
                open = [];
                setTimeout(function() { pair.forEach(function(x) { x.classList.remove('open'); }); busy = false; }, 900);
            }
        };
    });
    return { destroy: function() {}, partial: function() { return [matched * 2, pairs.length * 2]; } };
};

// ---- fillVerse: complete the verse from a word bank ----
L1_GAME_TYPES.fillVerse = function(host, data, api) {
    var verses = l1Pick(data.verses, data.pick || 3);
    var v = 0, raw = 0, rawMax = 0;
    verses.forEach(function(x) { rawMax += (x.missing || []).length; });
    var tr = l1Tracker(api, rawMax);
    function render() {
        var V = verses[v];
        var words = V.text.trim().split(/\s+/);
        var blanks = [];
        var used = {};
        (V.missing || []).forEach(function(m) {
            for (var i = 0; i < words.length; i++) {
                if (!used[i] && words[i].replace(/[«»"“”،.:؛!؟()]/g, '') === m) { used[i] = true; blanks.push(i); return; }
            }
        });
        blanks.sort(function(a, b) { return a - b; });
        var next = 0, mistakes = 0;
        var h = '<div class="l1-fv"><div class="l1-fv-text">';
        words.forEach(function(w, i) {
            var bi = blanks.indexOf(i);
            h += bi >= 0 ? '<span class="l1-fv-blank" id="l1-fv-b' + bi + '">____</span> ' : l1Esc(w) + ' ';
        });
        h += '</div><div class="l1-decode-ref">' + l1Esc(V.ref || '') + '</div>';
        h += '<div class="l1-decode-progress">آية ' + (v + 1) + ' من ' + verses.length + '</div><div class="l1-tray">';
        var bank = blanks.map(function(i) { return words[i].replace(/[«»"“”،.:؛!؟()]/g, ''); }).concat(V.distractors || []);
        l1Shuffle(bank).forEach(function(w) { h += '<button class="l1-chip">' + l1Esc(w) + '</button>'; });
        h += '</div></div>';
        host.innerHTML = h;
        var el0 = document.getElementById('l1-fv-b0');
        if (el0) el0.classList.add('now');
        host.querySelectorAll('.l1-chip').forEach(function(btn) {
            btn.onclick = function() {
                if (next >= blanks.length) return;
                var want = words[blanks[next]].replace(/[«»"“”،.:؛!؟()]/g, '');
                if (btn.textContent === want) {
                    var slot = document.getElementById('l1-fv-b' + next);
                    slot.textContent = words[blanks[next]];
                    slot.classList.remove('now');
                    slot.classList.add('filled');
                    btn.classList.add('used');
                    btn.disabled = true;
                    l1FxAt(api, slot, host);
                    tr.hit();
                    next++;
                    var nx = document.getElementById('l1-fv-b' + next);
                    if (nx) nx.classList.add('now');
                    if (next >= blanks.length) {
                        raw += Math.max(0, blanks.length - mistakes);
                        host.querySelector('.l1-fv-text').classList.add('solved');
                        setTimeout(function() { v++; if (v >= verses.length) api.end(raw, rawMax); else render(); }, 1300);
                    }
                } else {
                    mistakes++;
                    tr.miss();
                    l1Shake(btn);
                }
            };
        });
    }
    render();
    return { destroy: function() {}, partial: function() { return [raw, rawMax]; } };
};
