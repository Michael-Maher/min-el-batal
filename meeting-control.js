/* Meeting game: control window (the host's laptop, Arabic RTL).
   Setup, items, awards, surprises and the end of the night. The projector only ever gets
   mtAudienceView(night) and fx messages over BroadcastChannel. Awards sync to Firestore through
   mcFlush, and only after the season doc has loaded. Depends on meeting-core.js, meeting-cloud.js,
   meeting-bank.js, compete-bank.js and window.db (set up by meeting.html). */

var MC_CHANNEL = 'meb-meeting';
var MC_SESSION_KEY = 'minElBatal_adminSession';
var MC_CACHE_KEY = 'meb_meeting_cache';
var MC_RETRY_MS = 20000;
var MC_LOAD_STUCK_MS = 30000;
var MC_DOUBLE_TAP_MS = 1200;  /* same kid or team again: ignored this long */
var MC_TAP_LOCK_MS = 400;     /* any award tap: the next one is ignored this long (layout may have shifted) */
var MC_DEFAULT_TITLE = 'مسابقة الاجتماع';
var MC_SCREEN_URL = 'meeting.html?view=screen';
var MC_SCREEN_NAME = 'meb-screen';
var MC_SCREEN_FEATURES = 'popup,width=1280,height=720';
var MC_SCREEN_NOTE = 'دوس ‹ملء الشاشة› في شاشة الولاد عشان الصوت والشاشة الكاملة';
var MC_BIBLE = { 1: 'l1_bible', 2: 'l2_bible' };
var MC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
var MC_PICK_NAMES = 8;
var MC_WHEEL = [
    { id: 'double', label: 'النقط دبل في السؤال الجاي' },
    { id: 'gift', label: '٥ نجوم هدية لحد عشوائي من الحاضرين' },
    { id: 'steal', label: 'فريق ياخد ٥ من فريق' },
    { id: 'rescue', label: 'سؤال إنقاذ لآخر فريق' }
];
var MC_WHEEL_LAND_MS = 3600;  /* the screen wheel shows its result after ~3.4 s */
var MC_WHEEL_GIFT_MS = 6500;  /* the gift award pop waits until the result has been read */

var _mc = {
    wired: false, session: null, ch: null,
    players: null, playersErr: '', playersAt: 0, gameTeams: null, teamsErr: '', teamsAt: 0, history: {},
    season: null, seasonOk: false, seasonErr: '', seasonAt: 0,
    night: null, saved: null, pool: [], phase: '', lessons: {},
    muted: false, sync: { busy: false, lastError: null },
    lastGive: { key: '', at: 0 }, tapAt: 0, undoArmed: 0, wheelTimers: [], dragPh: null,
    ui: null
};

function _mcFreshUi() {
    return {
        target: { level: 1, mode: 'individual', teamId: null }, kind: null,
        sq: '', sqLevel: 'all', neg: false, choose: null, pick: null, bet: null, wheelMsg: '',
        editor: false, editKid: null, ciQ: '', sel: {}, splitG: 'boys', msg: '', clearAsk: false, lastMsg: '',
        renTeam: null, renVal: '', newName: {}, iconTeam: null
    };
}

/* ---------- helpers ---------- */

function _mcEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _mcNum(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); });
    return (n < 0 ? '−' : '') + s;
}

function _mcPts(n) { n = Number(n) || 0; return (n < 0 ? '−' : '+') + _mcNum(Math.abs(n)); }
function _mcEl(id) { return document.getElementById(id); }
function _mcLvl(l) { return l === 1 ? 'م١' : l === 2 ? 'م٢' : 'الكل'; }
function _mcTeamLvl(t) { return t && (t.level === 1 || t.level === 2) ? ' <small class="lv">' + _mcLvl(t.level) + '</small>' : ''; }

function _mcToday() {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) { return new Date().toISOString().slice(0, 10); }
}

function _mcTeam(id) {
    var ts = _mc.night ? _mc.night.teams : [];
    for (var i = 0; i < ts.length; i++) if (ts[i].id === id) return ts[i];
    return null;
}

function _mcErrText(e) {
    if (!e) return 'خطأ';
    return ((e.code ? e.code + ': ' : '') + (e.message || String(e))).slice(0, 160);
}

/* Replace a region's HTML only when it changed, and keep the focused input (and its caret) inside it. */
function _mcPaint(id, html) {
    var el = _mcEl(id);
    if (!el || el._h === html) return;
    var a = document.activeElement, fid = a && a.id && el.contains(a) ? a.id : '', s0 = null, s1 = null;
    if (fid) { try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) { /* not a text input */ } }
    el.innerHTML = html;
    el._h = html;
    if (fid) {
        var b = _mcEl(fid);
        if (b) { b.focus(); try { if (s0 !== null) b.setSelectionRange(s0, s1); } catch (e) { /* not a text input */ } }
    }
}

function _mcToast(msg, ms) {
    var el = _mcEl('mc-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'on';
    clearTimeout(_mcToast.t);
    _mcToast.t = setTimeout(function () { el.className = ''; }, ms || 2600);
}

/* Stable order for name lists: never depends on stars, so a chip stays where the host saw it. */
function _mcByName(a, b) {
    var x = mtNormalize(a.name), y = mtNormalize(b.name);
    return x < y ? -1 : x > y ? 1 : (String(a.phone) < String(b.phone) ? -1 : String(a.phone) > String(b.phone) ? 1 : 0);
}

function _mcKidTeamName(kid) {
    var t = kid && kid.teamId ? _mcTeam(kid.teamId) : null;
    return t ? t.name : '';
}

/* ---------- session + boot ---------- */

function _mcReadSession() {
    var s;
    try { s = JSON.parse(localStorage.getItem(MC_SESSION_KEY) || 'null'); } catch (e) { return null; }
    if (!s || typeof s !== 'object' || !(Number(s.expires) > Date.now())) return null;
    if (s.role === 'superadmin' || s.perms === null || (s.perms && s.perms.meeting === true)) return s;
    return null;
}

function mcBoot() {
    var root = _mcEl('mc-root');
    _mc.session = _mcReadSession();
    if (!_mc.session) {
        root.innerHTML = '<div class="mc-center"><div class="mc-card mc-gate"><div class="mc-big-ico">🔒</div>' +
            '<h2>لازم تدخل من لوحة الأدمن الأول</h2><a class="mc-btn pri" href="/admin.html">افتح لوحة الأدمن</a></div></div>';
        return;
    }
    if (!_mc.wired) { _mcWire(); _mc.wired = true; }
    _mc.ui = _mcFreshUi();
    _mc.players = null; _mc.gameTeams = null; _mc.history = {};
    _mc.seasonOk = false; _mc.season = null; _mc.seasonErr = ''; _mc.seasonAt = 0;
    _mc.sync = { busy: false, lastError: null };
    _mc.lessons = {};
    _mcLoadAll();
    var saved = null;
    try { saved = mtRestore(localStorage.getItem(MT_STORAGE_KEY)); } catch (e) { saved = null; }
    if (saved) {
        /* Pending awards of the saved night keep syncing while the host decides. */
        _mc.night = saved;
        _mc.saved = saved;
        _mcPhase('resume');
        _mcSync();
    } else {
        _mcNewSetup();
    }
}

function _mcWire() {
    var root = _mcEl('mc-root');
    root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-a]');
        if (!b || b.disabled || !root.contains(b)) return;
        var fn = _MC_A[b.getAttribute('data-a')];
        if (fn) { if (b.tagName === 'A') e.preventDefault(); fn(b.dataset, b); }
    });
    root.addEventListener('input', _mcOnInput);
    root.addEventListener('dragstart', function (e) {
        var c = e.target.closest && e.target.closest('[data-drag]');
        if (!c) return;
        _mc.dragPh = c.getAttribute('data-drag');
        try { e.dataTransfer.setData('text/plain', _mc.dragPh); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* old browser */ }
    });
    root.addEventListener('dragover', function (e) {
        var z = e.target.closest && e.target.closest('[data-drop]');
        if (!_mcDropOk(z)) return;
        e.preventDefault();
        if (!z.classList.contains('mc-over')) { _mcDragClear(); z.classList.add('mc-over'); }
    });
    root.addEventListener('drop', function (e) {
        var z = e.target.closest && e.target.closest('[data-drop]');
        if (!_mcDropOk(z)) return;
        e.preventDefault();
        var ph = _mc.dragPh;
        _mc.dragPh = null;
        _mcDragClear();
        if (mtSetTeam(_mc.night, ph, z.getAttribute('data-drop') || null)) { delete _mc.ui.sel[ph]; _mc.ui.editKid = null; _mcCommit(); }
    });
    root.addEventListener('dragend', function () { _mc.dragPh = null; _mcDragClear(); });
    root.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.id === 'mc-sq') {
            var r = _mcAwardResults();
            if (r.length === 1) { e.preventDefault(); if (_mcTapOk()) _mcTapKid(r[0].phone); }
        } else if (e.key === 'Enter' && e.target.id.indexOf('mc-nt-') === 0) {
            e.preventDefault();
            _MC_A.newteam({ l: e.target.id.slice(6) });
        } else if (e.key === 'Enter' && e.target.id === 'mc-ci') {
            /* one match not checked in yet: Enter checks them in */
            var cr = _mcCheckInResults().filter(function (p) { return !_mc.night.roster[p.phone]; });
            if (cr.length === 1) { e.preventDefault(); _MC_A.checkin({ p: cr[0].phone }); }
        } else if (e.target.id && e.target.id.indexOf('mc-tn-') === 0 && (e.key === 'Enter' || e.key === 'Escape')) {
            e.preventDefault();
            if (e.key === 'Enter') _MC_A.renok({ t: e.target.id.slice(6) });
            else { _mc.ui.renTeam = null; _mcRefresh(); }
        } else if (e.key === 'Escape' && _mc.ui && _mc.ui.editor) {
            _mc.ui.editor = false; _mcRefresh();
        }
    });
    if (typeof BroadcastChannel !== 'undefined') {
        _mc.ch = new BroadcastChannel(MC_CHANNEL);
        _mc.ch.onmessage = function (e) {
            var m = e.data;
            if (m && m.t === 'hello' && _mc.night && _mc.phase !== 'resume') {
                _mcView();
                if (_mc.muted) _mcFx({ type: 'sound', on: false });
            }
        };
    }
    window.addEventListener('online', function () { _mcRetry(); });
    window.addEventListener('beforeunload', function (e) {
        if (_mc.night && mtPendingSyncs(_mc.night).length) { e.preventDefault(); e.returnValue = ''; return ''; }
    });
    setInterval(_mcRetry, MC_RETRY_MS);
    setInterval(_mcTick, 250);
}

/* ---------- loading (players, teams, history, season) ---------- */

function _mcLoadAll() {
    _mcLoadPlayers();
    _mcLoadTeams();
    mcLoadHistory(window.db).then(function (h) { _mc.history = h || {}; }, function (e) {
        try { console.warn('meeting history not loaded:', _mcErrText(e)); } catch (x) { /* no console */ }
    });
    _mcLoadSeason();
}

function _mcCache(patch) {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(MC_CACHE_KEY) || '{}') || {}; } catch (e) { c = {}; }
    if (!patch) return c;
    Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
    try { localStorage.setItem(MC_CACHE_KEY, JSON.stringify(c)); } catch (e) { /* full: the cache is only a fallback */ }
    return c;
}

function _mcLoadPlayers() {
    if (_mc.playersAt && Date.now() - _mc.playersAt < MC_LOAD_STUCK_MS) return;
    _mc.playersAt = Date.now();
    /* A read that never settles counts as an error, so _mcRetry asks again. */
    mcTimeout(mcLoadPlayers(window.db), MC_LOAD_STUCK_MS).then(function (ps) {
        _mc.playersAt = 0; _mc.players = ps; _mc.playersErr = '';
        _mcCache({ players: ps });
        _mcRefresh();
    }, function (e) {
        _mc.playersAt = 0; _mc.playersErr = _mcErrText(e);
        if (!_mc.players) { var c = _mcCache(); if (c.players) _mc.players = c.players; }
        _mcRefresh();
    });
}

function _mcLoadTeams() {
    if (_mc.teamsAt && Date.now() - _mc.teamsAt < MC_LOAD_STUCK_MS) return;
    _mc.teamsAt = Date.now();
    mcTimeout(mcLoadTeams(window.db), MC_LOAD_STUCK_MS).then(function (ts) {
        _mc.teamsAt = 0; _mc.gameTeams = ts.filter(function (t) { return t.name; }); _mc.teamsErr = '';
        _mcCache({ teams: _mc.gameTeams });
        _mcRefresh();
    }, function (e) {
        _mc.teamsAt = 0; _mc.teamsErr = _mcErrText(e);
        if (!_mc.gameTeams) { var c = _mcCache(); if (c.teams) _mc.gameTeams = c.teams; }
        _mcRefresh();
    });
}

/* Stars never sync before this resolves: the season decides how an old-season kid's award is applied. */
function _mcLoadSeason() {
    if (_mc.seasonOk || (_mc.seasonAt && Date.now() - _mc.seasonAt < MC_LOAD_STUCK_MS)) return;
    _mc.seasonAt = Date.now();
    mcLoadSeason(window.db).then(function (s) {
        _mc.seasonAt = 0; _mc.season = s; _mc.seasonOk = true; _mc.seasonErr = '';
        _mcSync();
    }, function (e) {
        _mc.seasonAt = 0; _mc.seasonErr = _mcErrText(e);
        _mcSyncPaint();
    });
}

function _mcRetry() {
    if (!_mc.session) return;
    if (!_mc.seasonOk) _mcLoadSeason();
    if (_mc.playersErr) _mcLoadPlayers();
    if (_mc.teamsErr) _mcLoadTeams();
    _mcSync();
}

/* ---------- sync ---------- */

function _mcSync() {
    _mcSyncPaint();
    var n = _mc.night;
    if (!n || !_mc.seasonOk || _mc.sync.busy || !mtPendingSyncs(n).length) return;
    _mc.sync.busy = true;
    _mcSyncPaint();
    var flushing;
    try { flushing = mcFlush(window.db, n, { save: _mcSave, onChange: _mcSyncChanged }); }
    catch (e) { flushing = Promise.resolve({ lastError: { code: '', message: _mcErrText(e) } }); }
    flushing.then(function (r) {
        _mc.sync.busy = false;
        _mc.sync.lastError = r.lastError || null;
        _mcSyncChanged();
        /* An award added after mcFlush's last pass: push it now rather than in 20 s. */
        if (!r.lastError && _mc.night === n && mtPendingSyncs(n).length) setTimeout(_mcSync, 500);
    });
}

function _mcSyncChanged() {
    _mcSyncPaint();
    if (_mc.phase === 'play') _mcPaint('mc-failed', _mcFailedHtml());
}

function _mcPendingStars() {
    var p = _mc.night ? mtPendingSyncs(_mc.night) : [], s = 0;
    p.forEach(function (x) { s += Math.abs(x.points); });
    return { n: p.length, stars: s };
}

function _mcSyncHtml() {
    var p = _mcPendingStars(), h = '';
    if (!p.n) h = '<span class="mc-sync ok">✅ كل النجوم اتبعتت</span>';
    else {
        h = '<span class="mc-sync wait' + (_mc.sync.busy ? ' busy' : '') + '">⏳ لسه ' + _mcNum(p.stars) + ' نجمة مستنية النت</span>';
        if (!_mc.seasonOk) h += '<span class="mc-sync-note">' + (_mc.seasonErr ? 'مش قادرين نقرا بيانات الموسم، هنحاول تاني كل ٢٠ ثانية' : 'بنقرا بيانات الموسم…') + '</span>';
    }
    if (_mc.sync.lastError && p.n) {
        var le = _mc.sync.lastError;
        h += '<span class="mc-sync err">⚠️ النجوم مش بتتبعت: ' + _mcEsc((le.code ? le.code + ' ' : '') + (le.message || '')) + '</span>';
    }
    if (p.n) h += '<button class="mc-btn sm" data-a="syncnow">🔄 ابعت دلوقتي</button>';
    return h;
}

function _mcSyncPaint() { _mcPaint('mc-sync', _mcSyncHtml()); }

function _mcFailedHtml() {
    var n = _mc.night, rows = [];
    if (!n) return '';
    n.awards.forEach(function (a) {
        (a.failed || []).forEach(function (ph) {
            var k = n.roster[ph] || _mcPlayer(ph) || { name: ph };
            rows.push('<li>' + _mcEsc(k.name) + ' <small>(' + _mcPts(a.points) + ')</small></li>');
        });
    });
    if (!rows.length) return '';
    return '<div class="mc-failed"><b>⚠️ مالقيناش حساب في اللعبة للأسامي دي، فالنجوم ماتسجلتش:</b><ul>' + rows.join('') + '</ul></div>';
}

/* ---------- night state: save, screen messages ---------- */

function _mcSave() {
    if (!_mc.night) return;
    try { localStorage.setItem(MT_STORAGE_KEY, mtSerialize(_mc.night)); }
    catch (e) { _mcToast('⚠️ مش قادر أحفظ السهرة على الجهاز'); }
}

function _mcPost(msg) {
    if (!_mc.ch) return;
    try { _mc.ch.postMessage(msg); } catch (e) { /* channel closed */ }
}

function _mcView() { if (_mc.night) _mcPost({ t: 'view', view: mtAudienceView(_mc.night) }); }
function _mcFx(fx) { _mcPost({ t: 'fx', fx: fx }); }

/* Every state change: persist, tell the projector, repaint. */
function _mcCommit() { _mcSave(); _mcView(); _mcRefresh(); }

function _mcFreshNight() {
    var lessons = {}, subjects = [];
    [1, 2].forEach(function (l) {
        var key = MC_BIBLE[l], ls = _mcLessonsOf(key);
        if (ls.length) { subjects.push(key); lessons[key] = ls.map(function (x) { return x.idx; }); }
    });
    return mtNewNight({
        date: _mcToday(), title: MC_DEFAULT_TITLE, levels: [1, 2],
        filter: { subjects: subjects, lessons: lessons },
        kinds: Object.keys(MT_KINDS)
    });
}

function _mcNewSetup() {
    _mc.night = _mcFreshNight();
    _mc.saved = null;
    _mc.ui = _mcFreshUi();
    _mc.sync.lastError = null;
    _mcRebuildPool();
    _mcSave();
    _mcPhase('setup');
    _mcView();
}

function _mcRebuildPool() {
    _mc.pool = _mc.night ? mtBuildPool(_mc.night.filter, _mc.night.levels) : [];
}

function _mcLessonsOf(key) {
    if (!_mc.lessons[key]) _mc.lessons[key] = typeof competeLessonsOf === 'function' ? competeLessonsOf(key) : [];
    return _mc.lessons[key];
}

function _mcPlayer(phone) {
    var ps = _mc.players || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].phone === phone) return ps[i];
    return null;
}

/* ---------- phases ---------- */

function _mcPhase(p) {
    _mc.phase = p;
    _mcMount();
    _mcRefresh();
}

function _mcHeadHtml(sub) {
    return '<header class="mc-bar"><div class="mc-brand"><span class="ico">🏆</span><div><b id="mc-h-title"></b><small>' + _mcEsc(sub) + '</small></div></div>' +
        '<div id="mc-sync" class="mc-syncbox"></div><div id="mc-h-btns" class="mc-bar-btns"></div></header>';
}

function _mcMount() {
    var root = _mcEl('mc-root'), n = _mc.night, h = '';
    if (_mc.phase === 'resume') {
        h = '<div class="mc-center"><div id="mc-resume" class="mc-card mc-gate"></div></div>';
    } else if (_mc.phase === 'setup') {
        h = _mcHeadHtml('تجهيز السهرة') +
            '<main class="mc-setup">' +
            '<section class="mc-card"><h3>📝 السهرة</h3><div class="mc-form">' +
            '<label>العنوان<input id="mc-title" type="text" maxlength="60" value="' + _mcEsc(n.title) + '"></label>' +
            '<label>التاريخ<input id="mc-date" type="date" value="' + _mcEsc(n.date) + '"></label></div></section>' +
            '<section class="mc-card"><h3>🎚️ المستويات</h3><div id="mc-levels" class="mc-chips"></div></section>' +
            '<section class="mc-card wide"><h3>📚 المواد والدروس</h3><div id="mc-subjects"></div></section>' +
            '<section class="mc-card wide"><h3>🧩 الفقرات</h3><div id="mc-kinds" class="mc-chips"></div></section>' +
            '<section class="mc-card wide"><h3>👥 الفرق والحضور</h3><div id="mc-teamed"></div></section>' +
            '</main>' +
            '<footer class="mc-foot"><div id="mc-startmsg" class="mc-msg"></div><div id="mc-screennote" class="mc-note"></div>' +
            '<button class="mc-btn" data-a="screen">📺 افتح شاشة الولاد</button>' +
            '<button class="mc-btn go" data-a="start">▶ ابدأ</button></footer>';
    } else if (_mc.phase === 'play') {
        h = _mcHeadHtml('') +
            '<div id="mc-strip" class="mc-strip"></div>' +
            '<main class="mc-play">' +
            '<section class="mc-qcol"><div id="mc-item"></div><div id="mc-extra"></div><div id="mc-target" class="mc-card"></div></section>' +
            '<aside class="mc-aw mc-card">' +
            '<div id="mc-aw-top"></div><div id="mc-pick"></div>' +
            '<div class="mc-search"><input id="mc-sq" type="search" autocomplete="off" placeholder="🔎 اكتب أول حرفين من الاسم…">' +
            '<div id="mc-sqlv" class="mc-chips sm"></div></div>' +
            '<div id="mc-res"></div><div id="mc-tbtn"></div><div id="mc-roster"></div><div id="mc-failed"></div>' +
            '</aside></main>' +
            '<div id="mc-modal" class="mc-modal"><div class="mc-modal-box"><div class="mc-modal-head"><h3>👥 الفرق والحضور</h3>' +
            '<button class="mc-btn" data-a="editor">✓ خلاص</button></div><div id="mc-teamed"></div></div></div>';
    } else if (_mc.phase === 'end') {
        h = _mcHeadHtml('آخر السهرة') + '<main class="mc-endwrap"><div id="mc-end" class="mc-card"></div></main>';
    }
    h += '<div id="mc-toast"></div>';
    root.innerHTML = h;
}

function _mcRefresh() {
    if (!_mc.ui || !_mc.night) return;
    var ph = _mc.phase, n = _mc.night;
    if (ph === 'resume') { _mcPaint('mc-resume', _mcResumeHtml()); _mcSyncPaint(); return; }
    var t = _mcEl('mc-h-title');
    if (t) t.textContent = (n.title || MC_DEFAULT_TITLE) + ' · ' + n.date;
    _mcSyncPaint();
    if (ph === 'setup') {
        _mcPaint('mc-h-btns', '');
        _mcPaint('mc-levels', _mcLevelsHtml());
        _mcPaint('mc-subjects', _mcSubjectsHtml());
        _mcPaint('mc-kinds', _mcKindsHtml());
        _mcPaint('mc-teamed', _mcTeamEdHtml());
        _mcPaint('mc-startmsg', _mc.ui.msg ? _mcEsc(_mc.ui.msg) : '');
    } else if (ph === 'play') {
        _mcPaint('mc-h-btns', _mcPlayBtnsHtml());
        _mcPaint('mc-strip', _mcStripHtml());
        _mcPaint('mc-target', _mcTargetHtml());
        _mcPaint('mc-extra', _mcExtraHtml());
        _mcPaint('mc-item', _mcItemHtml());
        _mcPaint('mc-aw-top', _mcAwTopHtml());
        _mcPaint('mc-pick', _mcPickHtml());
        _mcPaint('mc-sqlv', _mcSqLevelHtml());
        _mcPaint('mc-res', _mcResultsHtml());
        _mcPaint('mc-tbtn', _mcTeamBtnsHtml());
        _mcPaint('mc-roster', _mcRosterHtml());
        _mcPaint('mc-failed', _mcFailedHtml());
        var m = _mcEl('mc-modal');
        if (m) m.classList.toggle('on', !!_mc.ui.editor);
        if (_mc.ui.editor) _mcPaint('mc-teamed', _mcTeamEdHtml());
    } else if (ph === 'end') {
        _mcPaint('mc-h-btns', '');
        _mcPaint('mc-end', _mcEndHtml());
    }
}

/* ---------- resume ---------- */

function _mcResumeHtml() {
    var n = _mc.night, p = _mcPendingStars();
    var kids = Object.keys(n.roster).length, items = n.usedTonight.length;
    var h = '<div class="mc-big-ico">🌙</div><h2>تكمّل السهرة اللي فاتت؟</h2>' +
        '<p class="mc-sub">' + _mcEsc(n.title || MC_DEFAULT_TITLE) + ' · ' + _mcEsc(n.date) + ' · ' + _mcNum(kids) + ' ولد · ' +
        _mcNum(n.teams.length) + ' فريق · ' + _mcNum(items) + ' سؤال</p>' +
        '<div id="mc-sync" class="mc-syncbox center"></div>' +
        '<div class="mc-row center"><button class="mc-btn go" data-a="resume">▶ كمّل</button>' +
        '<button class="mc-btn" data-a="fresh">✨ سهرة جديدة</button></div>';
    if (_mc.ui.clearAsk) h += _mcClearAskHtml(p);
    return h;
}

function _mcClearAskHtml(p) {
    return '<div class="mc-warn">⚠️ فيه ' + _mcNum(p.stars) + ' نجمة لسه ماتبعتتش لحسابات الولاد. لو مسحت السهرة دلوقتي هتضيع.' +
        '<div class="mc-row center"><button class="mc-btn" data-a="clearno">استنى لما تتبعت</button>' +
        '<button class="mc-btn danger" data-a="clearyes">🗑️ امسح برضه</button></div></div>';
}

/* ---------- setup ---------- */

function _mcLevelsHtml() {
    var n = _mc.night;
    return [1, 2].map(function (l) {
        var on = n.levels.indexOf(l) >= 0;
        return '<button class="mc-chip' + (on ? ' on' : '') + '" data-a="lvl" data-v="' + l + '">' + (l === 1 ? 'المستوى الأول (م١)' : 'المستوى التاني (م٢)') + '</button>';
    }).join('');
}

function _mcSubjectsHtml() {
    var n = _mc.night, h = '';
    COMPETE_SUBJECTS.forEach(function (s) {
        if (n.levels.indexOf(s.level) < 0) return;
        var ls = _mcLessonsOf(s.key);
        if (!ls.length) return;
        var on = n.filter.subjects.indexOf(s.key) >= 0, want = n.filter.lessons[s.key] || [];
        h += '<div class="mc-subj' + (on ? ' on' : '') + '"><button class="mc-chk' + (on ? ' on' : '') + '" data-a="subj" data-k="' + _mcEsc(s.key) + '">' +
            '<span class="box">' + (on ? '✓' : '') + '</span>' + _mcEsc(s.label) + ' <small>' + _mcLvl(s.level) + '</small></button>';
        if (on) {
            h += '<div class="mc-chips sm">' + ls.map(function (l) {
                var lon = want.indexOf(l.idx) >= 0;
                return '<button class="mc-chip' + (lon ? ' on' : '') + '" data-a="lesson" data-k="' + _mcEsc(s.key) + '" data-i="' + l.idx + '">' + _mcEsc(l.name) + '</button>';
            }).join('') + '</div>';
        }
        h += '</div>';
    });
    return h || '<p class="mc-muted">مفيش مواد للمستوى ده.</p>';
}

function _mcKindCounts(level) {
    var n = _mc.night, used = {}, c = {};
    n.usedTonight.concat(n.skipped).forEach(function (id) { used[id] = true; });
    _mc.pool.forEach(function (it) {
        if (level ? it.level !== level : n.levels.indexOf(it.level) < 0) return;
        if (used[it.id]) return;
        c[it.kind] = (c[it.kind] || 0) + 1;
    });
    return c;
}

function _mcKindsHtml() {
    var n = _mc.night, c = _mcKindCounts(null), h = '';
    Object.keys(MT_KINDS).forEach(function (k) {
        if (!c[k]) return;
        var on = n.kinds.indexOf(k) >= 0;
        h += '<button class="mc-chip' + (on ? ' on' : '') + '" data-a="kind" data-k="' + k + '">' + _mcEsc(MT_KINDS[k].label) + ' <small>' + _mcNum(c[k]) + '</small></button>';
    });
    return h || '<p class="mc-muted">مفيش أسئلة للمواد والدروس دي.</p>';
}

/* ---------- teams + rosters editor (setup, and a modal during play) ---------- */

function _mcTeamEdHtml() {
    var n = _mc.night, ui = _mc.ui, h = '';
    h += '<div class="mc-ci"><input id="mc-ci" type="search" autocomplete="off" placeholder="✍️ سجّل اللي جه: اكتب اسمه…" value="' + _mcEsc(ui.ciQ) + '">' +
        '<div id="mc-ci-res" class="mc-tres">' + _mcCheckInResultsHtml() + '</div></div>';
    var gts = _mc.gameTeams;
    h += '<div class="mc-ted-sec"><span class="mc-lbl">🎮 فرق اللعبة:</span>';
    if (!gts) h += _mc.teamsErr ? '<span class="mc-muted">مقدرناش نجيب الفرق</span> <button class="mc-btn sm" data-a="reloadteams">حاول تاني</button>' : '<span class="mc-muted">⏳ بنحمّل…</span>';
    else if (!gts.length) h += '<span class="mc-muted">مفيش فرق في اللعبة</span>';
    else {
        h += '<span class="mc-muted">بتظهر لوحدها لما حد منها يتسجل، أو ضيفها من هنا:</span>';
        gts.forEach(function (g, i) {
            var used = n.teams.some(function (t) { return t.source === 'game' && t.gameTeam === g.name; });
            h += '<button class="mc-chip' + (used ? ' on' : '') + '" data-a="gteam" data-i="' + i + '"' + (used ? ' disabled' : '') + '>' +
                '<span class="dot" style="--tc:' + _mcEsc(g.color || '#555') + '"></span>' + _mcEsc(g.logo || '') + ' ' + _mcEsc(g.name) + (g.level ? ' <small>' + _mcLvl(g.level) + '</small>' : '') + (used ? ' ✓' : '') + '</button>';
        });
    }
    h += '</div>';
    var unset = n.teams.filter(function (t) { return !t.level; });
    if (unset.length) {
        h += '<section class="mc-lvsec"><div class="mc-lvsec-h"><b>❔ فرق لسه من غير مستوى</b><small>اختار مستوى كل فريق، أو حط فيه ولد ويبقى على مستواه</small></div><div class="mc-tcards">' +
            unset.map(function (t) { return _mcTeamCardHtml(t); }).join('') + '</div></section>';
    }
    _mcEdLevels().forEach(function (l) { h += _mcLevelSecHtml(l); });
    return h;
}

/* Levels the editor shows: tonight's, plus any level a kid or a team here has. */
function _mcEdLevels() {
    var n = _mc.night, on = {};
    n.levels.forEach(function (l) { on[l] = true; });
    Object.keys(n.roster).forEach(function (ph) { on[n.roster[ph].level] = true; });
    n.teams.forEach(function (t) { if (t.level) on[t.level] = true; });
    return [1, 2].filter(function (l) { return on[l]; });
}

function _mcLevelKids(l, teamId) {
    var n = _mc.night;
    return Object.keys(n.roster).map(function (ph) { return n.roster[ph]; })
        .filter(function (k) { return k.level === l && (k.teamId || null) === teamId; })
        .sort(_mcByName);
}

/* One level: its kids with no team (pick some, move them or make random teams of them), then its teams. */
function _mcLevelSecHtml(l) {
    var n = _mc.night, ui = _mc.ui;
    var teams = n.teams.filter(function (t) { return t.level === l; });
    var pool = _mcLevelKids(l, null);
    var all = Object.keys(n.roster).filter(function (ph) { return n.roster[ph].level === l; }).length;
    var sel = pool.filter(function (k) { return ui.sel[k.phone]; });
    var h = '<section class="mc-lvsec lv' + l + '"><div class="mc-lvsec-h"><b>' + (l === 1 ? '🌟 المستوى الأول' : '⚡ المستوى التاني') + '</b>' +
        '<small>' + _mcNum(all) + ' حاضر · ' + _mcNum(teams.length) + ' فريق</small></div>';
    h += '<div class="mc-pool" data-drop="" data-l="' + l + '"><div class="mc-pool-h"><b>🙋 من غير فريق (' + _mcNum(pool.length) + ')</b>';
    if (pool.length) h += sel.length === pool.length ? '<button class="mc-btn sm" data-a="selnone" data-l="' + l + '">الغي الاختيار</button>' : '<button class="mc-btn sm" data-a="selall" data-l="' + l + '">اختار الكل</button>';
    h += '</div><div class="mc-kids">';
    h += pool.length ? pool.map(function (k) {
        var on = !!ui.sel[k.phone];
        return '<button class="mc-pchip' + (on ? ' on' : '') + '" draggable="true" data-drag="' + _mcEsc(k.phone) + '" data-a="selkid" data-p="' + _mcEsc(k.phone) + '">' +
            '<span class="box">' + (on ? '✓' : '') + '</span>' + _mcEsc(k.name) + (k.guest ? ' <small>اسم بس</small>' : '') + '</button>';
    }).join('') : '<span class="mc-muted">' + (all ? 'كل اللي جم في فرق' : 'لسه محدش اتسجل من المستوى ده') + '</span>';
    h += '</div>';
    if (sel.length) {
        var maxT = Math.min(8, sel.length);
        h += '<div class="mc-selbar"><b>اخترت ' + _mcNum(sel.length) + '</b>';
        if (teams.length) h += '<span class="mc-lbl">انقلهم لـ:</span>' + teams.map(function (t) {
            return '<button class="mc-chip team" style="--tc:' + _mcEsc(t.color) + '" data-a="selmove" data-t="' + _mcEsc(t.id) + '" data-l="' + l + '">' + _mcEsc(t.icon) + ' ' + _mcEsc(t.name.replace(/^فريق\s+/, '')) + '</button>';
        }).join('');
        h += '<span class="mc-sep"></span><span class="mc-lbl">أو اعمل منهم فرق عشوائية:</span>' +
            '<button class="mc-chip' + (ui.splitG === 'boys' ? ' on' : '') + '" data-a="splitg" data-v="boys">👦 قديسين</button>' +
            '<button class="mc-chip' + (ui.splitG === 'girls' ? ' on' : '') + '" data-a="splitg" data-v="girls">👧 قديسات</button>';
        for (var c = 1; c <= maxT; c++) h += '<button class="mc-chip" data-a="selsplit" data-v="' + c + '" data-l="' + l + '">' + (c === 1 ? 'فريق واحد' : _mcNum(c) + ' فرق') + '</button>';
        h += '<button class="mc-btn sm danger" data-a="selrm" data-l="' + l + '">شيلهم من الحضور</button></div>';
    }
    h += '</div><div class="mc-tcards">' + teams.map(function (t) { return _mcTeamCardHtml(t); }).join('') + _mcNewTeamCardHtml(l) + '</div></section>';
    return h;
}

function _mcNewTeamCardHtml(l) {
    var v = _mc.ui.newName[l] || '';
    return '<div class="mc-tcard new"><b>＋ فريق جديد ' + _mcLvl(l) + '</b><div class="mc-chips">' +
        '<button class="mc-chip" data-a="rteams" data-g="boys" data-l="' + l + '">👦 ولاد (اسم قديس)</button>' +
        '<button class="mc-chip" data-a="rteams" data-g="girls" data-l="' + l + '">👧 بنات (اسم قديسة)</button></div>' +
        '<div class="mc-row"><input id="mc-nt-' + l + '" class="mc-newteam" type="text" maxlength="30" autocomplete="off" placeholder="✍️ أو اكتب الاسم اللي عايزه…" value="' + _mcEsc(v) + '">' +
        '<button class="mc-btn sm pri" data-a="newteam" data-l="' + l + '">ضيفه</button></div></div>';
}

function _mcTeamCardHtml(t) {
    var n = _mc.night, ui = _mc.ui;
    var kids = _mcLevelKids(t.level || 0, t.id);
    if (!t.level) kids = Object.keys(n.roster).map(function (ph) { return n.roster[ph]; }).filter(function (k) { return k.teamId === t.id; });
    var awarded = n.awards.some(function (a) { return a.teamId === t.id; });
    var name = '<button class="mc-tname" data-a="ren" data-t="' + _mcEsc(t.id) + '" title="غيّر الاسم">' + _mcEsc(t.name) + ' <i>✏️</i></button>';
    if (ui.renTeam === t.id) {
        name = '<input id="mc-tn-' + _mcEsc(t.id) + '" class="mc-tname-in" type="text" maxlength="30" value="' + _mcEsc(ui.renVal) + '">' +
            '<button class="mc-btn sm" data-a="renok" data-t="' + _mcEsc(t.id) + '">✓</button>';
    }
    var ico = '<button class="mc-ticon' + (ui.iconTeam === t.id ? ' on' : '') + '" data-a="icon" data-t="' + _mcEsc(t.id) + '" title="غيّر اللوجو واللون">' + _mcEsc(t.icon) + '<i>🎨</i></button>';
    var h = '<div class="mc-tcard" style="--tc:' + _mcEsc(t.color) + '"' + (t.level ? ' data-drop="' + _mcEsc(t.id) + '" data-l="' + t.level + '"' : '') + '><div class="mc-tcard-h">' + ico + name +
        '<small>' + _mcNum(kids.length) + ' ولد</small>' +
        (!awarded ? '<button class="mc-x" data-a="delteam" data-t="' + _mcEsc(t.id) + '" title="شيل الفريق">✕</button>' : '') + '</div>';
    if (!t.level) {
        h += '<div class="mc-row"><span class="mc-lbl">المستوى:</span><button class="mc-chip" data-a="teamlvl" data-t="' + _mcEsc(t.id) + '" data-v="1">م١</button>' +
            '<button class="mc-chip" data-a="teamlvl" data-t="' + _mcEsc(t.id) + '" data-v="2">م٢</button></div>';
    }
    if (ui.iconTeam === t.id) {
        h += '<div class="mc-icons"><span class="mc-lbl">اللوجو:</span>' + MT_TEAM_LOGOS.map(function (ic) {
            return '<button class="' + (ic === t.icon ? 'on' : '') + '" data-a="seticon" data-t="' + _mcEsc(t.id) + '" data-v="' + _mcEsc(ic) + '">' + ic + '</button>';
        }).join('') + '</div><div class="mc-icons"><span class="mc-lbl">اللون:</span>' + MT_TEAM_COLORS.map(function (c) {
            return '<button class="sw' + (c.toLowerCase() === String(t.color).toLowerCase() ? ' on' : '') + '" style="--sw:' + c + '" data-a="setcolor" data-t="' + _mcEsc(t.id) + '" data-v="' + c + '"></button>';
        }).join('') + '</div>';
    }
    h += '<div class="mc-kids">';
    kids.forEach(function (k) {
        var open = ui.editKid === k.phone;
        h += '<span class="mc-kchip' + (open ? ' open' : '') + '"><button draggable="true" data-drag="' + _mcEsc(k.phone) + '" data-a="editkid" data-p="' + _mcEsc(k.phone) + '">' + _mcEsc(k.name) +
            (k.guest ? ' <small>اسم بس</small>' : '') + '</button></span>';
        if (open) {
            h += '<span class="mc-move">نقله لـ: ' + n.teams.filter(function (x) { return x.id !== k.teamId && x.level === k.level; }).map(function (x) {
                return '<button class="mc-tdot" style="--tc:' + _mcEsc(x.color) + '" data-a="movekid" data-p="' + _mcEsc(k.phone) + '" data-t="' + _mcEsc(x.id) + '">' + _mcEsc(x.icon) + ' ' + _mcEsc(x.name.replace(/^فريق\s+/, '')) + '</button>';
            }).join('') +
                '<button class="mc-tdot" data-a="movekid" data-p="' + _mcEsc(k.phone) + '" data-t="">من غير فريق</button>' +
                '<button class="mc-tdot danger" data-a="rmkid" data-p="' + _mcEsc(k.phone) + '">شيل من الحضور</button></span>';
        }
    });
    if (!kids.length) h += '<span class="mc-muted">لسه مفيش ولاد. اسحب ولد هنا.</span>';
    h += '</div>';
    if (t.source === 'game') h += _mcGameChecklistHtml(t);
    return h + '</div>';
}

/* The game team's registered players: tick who came (they are checked in like from the search). */
function _mcGameChecklistHtml(t) {
    var n = _mc.night;
    if (!_mc.players) return '';
    var ps = _mc.players.filter(function (p) { return p.team === t.gameTeam; })
        .sort(_mcByName);
    if (!ps.length) return '<p class="mc-muted">مفيش لاعيبة متسجلين في الفريق ده</p>';
    return '<div class="mc-check"><span class="mc-lbl">علّم على اللي حاضر:</span>' + ps.map(function (p) {
        var on = !!n.roster[p.phone];
        return '<button class="mc-chk' + (on ? ' on' : '') + '" data-a="gcheck" data-p="' + _mcEsc(p.phone) + '">' +
            '<span class="box">' + (on ? '✓' : '') + '</span>' + _mcEsc(p.name) + ' <small>' + _mcLvl(p.level) + '</small></button>';
    }).join('') + '</div>';
}

function _mcCheckInResults() {
    if (mtNormalize(_mc.ui.ciQ).length < 2) return [];
    return mtSearch(_mcSearchSource('all'), _mc.ui.ciQ, 8);
}

function _mcCheckInResultsHtml() {
    var n = _mc.night, q = _mc.ui.ciQ;
    if (mtNormalize(q).length < 2) return '';
    var guest = _mcGuestBtnsHtml(q, 0, 'ci');
    if (!_mc.players && !Object.keys(n.roster).length) return _mcPlayersStateHtml() + guest;
    var res = _mcCheckInResults();
    if (!res.length) return '<p class="mc-muted">مفيش حد بالاسم ده في اللعبة</p>' + guest;
    return res.map(function (p) {
        var k = n.roster[p.phone], tn = k ? _mcKidTeamName(k) : '';
        return '<button class="mc-res sm" data-a="checkin" data-p="' + _mcEsc(p.phone) + '"' + (k ? ' disabled' : '') + '>' +
            '<b>' + _mcEsc(p.name) + '</b><small class="lv">' + _mcLvl(p.level) + '</small>' +
            (p.team ? '<small>' + _mcEsc(p.team) + '</small>' : '') +
            (k ? '<small>✓ حاضر' + (tn ? ' في ' + _mcEsc(tn) : '') + '</small>' : '') + '</button>';
    }).join('') + guest;
}

/* Check a kid in: a game player joins their game team (added to the night if it is not here yet) when
   it is of their level; anyone else waits with no team, in their level. */
function _mcCheckIn(p) {
    var n = _mc.night, kid = n.roster[p.phone];
    if (kid) return kid;
    var lvl = p.level === 2 ? 2 : 1, teamId = null;
    if (p.team) {
        var t = null;
        n.teams.forEach(function (x) { if (!t && x.source === 'game' && x.gameTeam === p.team) t = x; });
        if (!t) {
            var g = null;
            (_mc.gameTeams || []).forEach(function (x) { if (!g && x.name === p.team) g = x; });
            if (g && (!g.level || g.level === lvl)) t = mtAddGameTeam(n, { name: g.name, color: g.color, logo: g.logo, level: g.level || lvl });
        }
        if (t && mtFits({ level: lvl }, t)) teamId = t.id;
    }
    return mtAddToRoster(n, p, teamId);
}

/* Add the typed name as a kid with no game account (stars count for tonight only).
   level 0 = ask: one button per night level. Hidden once a guest with that name is here. */
function _mcGuestBtnsHtml(q, level, where) {
    var n = _mc.night, name = String(q || '').trim().replace(/\s+/g, ' ');
    if (mtNormalize(name).length < 2) return '';
    var dup = Object.keys(n.roster).some(function (ph) { return n.roster[ph].guest && mtNormalize(n.roster[ph].name) === mtNormalize(name); });
    if (dup) return '';
    var lvls = level ? [level] : n.levels.slice().sort();
    return '<div class="mc-guest"><span class="mc-muted">مش لاقيه؟ ضيفه اسم بس (من غير أكونت، نجومه للسهرة بس):</span>' + lvls.map(function (l) {
        return '<button class="mc-btn sm" data-a="guest" data-l="' + l + '" data-t="' + _mcEsc(where) + '">➕ ' + _mcEsc(name) + ' <small>' + _mcLvl(l) + '</small></button>';
    }).join('') + '</div>';
}

/* Everyone the host can find: game players plus anyone on tonight's roster the player list lacks. */
function _mcSearchSource(level) {
    var n = _mc.night, seen = {}, out = [];
    (_mc.players || []).forEach(function (p) { seen[p.phone] = true; out.push(p); });
    Object.keys(n.roster).forEach(function (ph) {
        if (seen[ph]) return;
        var k = n.roster[ph];
        out.push({ phone: k.phone, name: k.name, level: k.level, team: '' });
    });
    if (level === 'all') return out;
    return out.filter(function (p) { return (p.level === 2 ? 2 : 1) === level; });
}

function _mcPlayersStateHtml() {
    if (_mc.playersErr) return '<p class="mc-warn sm">⚠️ مقدرناش نجيب أسامي اللاعيبة (' + _mcEsc(_mc.playersErr) + ') <button class="mc-btn sm" data-a="reloadplayers">حاول تاني</button></p>';
    return '<p class="mc-muted">⏳ بنحمّل أسامي اللاعيبة…</p>';
}

/* ---------- play: header, strip, target ---------- */

function _mcPlayBtnsHtml() {
    return '<button class="mc-btn" data-a="mute">' + (_mc.muted ? '🔇 الصوت مقفول' : '🔊 الصوت شغال') + '</button>' +
        '<button class="mc-btn" data-a="screen">📺 افتح شاشة الولاد تاني</button>' +
        '<button class="mc-btn" data-a="editor">👥 الفرق والحضور</button>' +
        '<button class="mc-btn danger" data-a="end">🏁 خلّص السهرة</button>';
}

function _mcStripHtml() {
    var n = _mc.night;
    if (!n.teams.length) return '';
    var lead = mtAudienceView(n).leaderId, turn = _mcTurnTeamId();
    return mtStandings(n).map(function (t) {
        var kids = Object.keys(n.roster).filter(function (ph) { return n.roster[ph].teamId === t.id; }).length;
        return '<div class="mc-steam' + (t.id === lead ? ' lead' : '') + (t.id === turn ? ' turn' : '') + '" style="--tc:' + _mcEsc(t.color) + '"><span class="ico">' + _mcEsc(t.icon) + '</span>' +
            '<span class="nm">' + (t.id === turn ? '🎯 ' : '') + _mcEsc(t.name) + (t.id === lead ? ' 👑' : '') + _mcTeamLvl(t) + '</span><b>' + _mcNum(t.score) + '</b><small>' + _mcNum(kids) + ' ولد</small></div>';
    }).join('');
}

/* The team whose turn it is: the current question's, else the one picked for the next question. */
function _mcTurnTeamId() {
    var cur = _mc.night.current, t = cur ? cur.target : _mc.ui.target;
    return t && t.mode === 'team' ? t.teamId : null;
}

/* Give the turn to a team; its level (when it has one tonight) becomes the question level. */
function _mcTurnTo(id) {
    var t = _mc.ui.target, tm = _mcTeam(id);
    t.teamId = tm ? id : null;
    if (tm && tm.level && _mc.night.levels.indexOf(tm.level) >= 0) t.level = tm.level;
}

function _mcTargetLevels() {
    var lv = _mc.night.levels.slice().sort();
    return lv.length > 1 ? lv.concat(['all']) : lv;
}

function _mcPickLevel(level) {
    if (level === 'all') return _mc.night.levels.indexOf(1) >= 0 ? 1 : 2;
    return level;
}

function _mcTargetHtml() {
    var n = _mc.night, ui = _mc.ui, t = ui.target, h = '';
    h += '<div class="mc-trow"><span class="mc-lbl">المستوى</span><div class="mc-chips">' + _mcTargetLevels().map(function (l) {
        return '<button class="mc-chip' + (t.level === l ? ' on' : '') + '" data-a="tlevel" data-v="' + l + '">' + _mcLvl(l) + '</button>';
    }).join('') + '</div></div>';
    var modes = [['individual', '🙋 فردي'], ['speed', '⚡ سرعة'], ['team', '👥 فريق']];
    h += '<div class="mc-trow"><span class="mc-lbl">مين يجاوب</span><div class="mc-chips">' + modes.map(function (m) {
        var dis = m[0] === 'team' && !n.teams.length;
        return '<button class="mc-chip' + (t.mode === m[0] ? ' on' : '') + '" data-a="tmode" data-v="' + m[0] + '"' + (dis ? ' disabled' : '') + '>' + m[1] + '</button>';
    }).join('');
    if (t.mode === 'team') {
        h += '<span class="mc-sep"></span>' + n.teams.map(function (x) {
            return '<button class="mc-chip team' + (t.teamId === x.id ? ' on' : '') + '" style="--tc:' + _mcEsc(x.color) + '" data-a="tteam" data-t="' + _mcEsc(x.id) + '">' + _mcEsc(x.icon) + ' ' + _mcEsc(x.name.replace(/^فريق\s+/, '')) + _mcTeamLvl(x) + '</button>';
        }).join('');
    }
    h += '</div></div>';
    var counts = _mcKindCounts(_mcPickLevel(t.level)), kinds = mtAvailableKinds(_mc.pool, n);
    if (ui.kind && !counts[ui.kind]) ui.kind = null;
    h += '<div class="mc-trow"><span class="mc-lbl">الفقرة</span><div class="mc-chips sm"><button class="mc-chip' + (!ui.kind ? ' on' : '') + '" data-a="tkind" data-k="">🎲 عشوائي</button>' +
        kinds.map(function (k) {
            var c = counts[k] || 0;
            return '<button class="mc-chip' + (ui.kind === k ? ' on' : '') + '" data-a="tkind" data-k="' + k + '"' + (c ? '' : ' disabled') + '>' + _mcEsc(MT_KINDS[k].label) + ' <small>' + _mcNum(c) + '</small></button>';
        }).join('') + '</div></div>';
    h += '<div class="mc-row mc-next"><button class="mc-btn go big" data-a="next">⏭ السؤال الجاي</button>' +
        '<button class="mc-btn gold" data-a="golden">🏅 السؤال الدهبي</button></div>';
    h += '<div class="mc-row mc-surp"><button class="mc-btn" data-a="wheel">🎡 عجلة الحظ</button>' +
        '<button class="mc-btn" data-a="bet">🎰 الرهان</button>' +
        '<button class="mc-btn" data-a="board">🏆 اعرض الترتيب</button>' +
        (n.multiplier > 1 ? '<span class="mc-badge gold">✖٢ النقط دبل في السؤال الجاي</span>' : '') + '</div>';
    return h;
}

/* ---------- play: current item ---------- */

function _mcAnswerText(it) {
    if (it.kind === 'order') return (it.steps || []).map(function (s, i) { return _mcNum(i + 1) + '. ' + s; }).join('  ←  ');
    if (it.answer !== undefined) return String(it.answer);
    if (it.options && typeof it.correct === 'number') return it.options[it.correct];
    return '';
}

function _mcItemHtml() {
    var n = _mc.night, cur = n.current;
    if (!cur) return '<div class="mc-card mc-empty"><div class="mc-big-ico">🎯</div><p>اختار المستوى ومين يجاوب تحت، ودوس «السؤال الجاي».</p>' +
        '<div class="mc-row center"><button class="mc-btn go big" data-a="next">⏭ السؤال الجاي</button></div></div>';
    var it = cur.item, k = it.kind, st = cur.stage, h = '';
    var stage = { preview: ['prev', '👀 معاينة: الولاد مش شايفينه'], shown: ['shown', '📺 ظاهر على الشاشة'], revealed: ['rev', '✅ الإجابة ظاهرة'] }[st];
    var t = cur.target || {}, team = t.teamId ? _mcTeam(t.teamId) : null;
    h += '<div class="mc-card mc-itemcard ' + stage[0] + (cur.golden ? ' golden' : '') + '"><div class="mc-ihead">' +
        '<span class="mc-badge">' + _mcEsc(MT_KINDS[k] ? MT_KINDS[k].label : k) + ' · ' + _mcLvl(t.level) + '</span>' +
        (t.mode === 'speed' ? '<span class="mc-badge">⚡ سرعة</span>' : '') +
        (team ? '<span class="mc-badge" style="--tc:' + _mcEsc(team.color) + '">دور ' + _mcEsc(team.name) + '</span>' : '') +
        (cur.golden ? '<span class="mc-badge gold">🏅 السؤال الدهبي · ١٥ نجمة</span>' : '') +
        '<span class="mc-stage ' + stage[0] + '">' + stage[1] + '</span><span id="mc-timer" class="mc-timer"></span></div>';
    h += '<div class="mc-ibody">' + _mcItemBodyHtml(it, cur) + '</div>';
    var ans = _mcAnswerText(it);
    if (ans && k !== 'order' && k !== 'act' && k !== 'draw' && k !== 'taboo') h += '<div class="mc-ans"><span>✔ الإجابة</span>' + _mcEsc(ans) + '</div>';
    if (it.explain) h += '<div class="mc-explain"><span>💡 للشرح</span>' + _mcEsc(it.explain) + '</div>';
    h += '<div class="mc-iacts">' + _mcItemActsHtml(it, cur) + '</div>';
    h += '<div class="mc-imeta">' + _mcEsc(it.id || '') + (it.difficulty ? ' · صعوبة ' + _mcNum(it.difficulty) : '') + '</div></div>';
    return h;
}

function _mcItemBodyHtml(it, cur) {
    var k = it.kind, st = cur.stage, h = '';
    var live = st !== 'preview';
    if (it.prompt && k !== 'emoji') h += '<div class="mc-prompt">' + _mcEsc(it.prompt) + '</div>';
    switch (k) {
        case 'mcq': case 'scenario': case 'verse': case 'tf':
            h += '<ol class="mc-opts">' + (it.options || []).map(function (o, i) {
                var shown = k === 'tf' || st === 'revealed' || (live && i < (cur.optionsShown || 0));
                return '<li class="' + (i === it.correct ? 'ok' : '') + (shown && live ? ' on' : '') + '"><span class="l">' + MC_LETTERS[i] + '</span>' + _mcEsc(o) +
                    (i === it.correct ? ' <b>✔</b>' : '') + '</li>';
            }).join('') + '</ol>';
            if (k !== 'tf' && st === 'shown') h += '<p class="mc-muted">ظاهر على الشاشة: ' + _mcNum(cur.optionsShown || 0) + ' من ' + _mcNum(it.options.length) + '</p>';
            break;
        case 'clues':
            h += '<ol class="mc-clues">' + (it.clues || []).map(function (c, i) {
                return '<li class="' + (live && i <= (cur.clueIdx || 0) ? 'on' : '') + '">' + _mcEsc(c) + '</li>';
            }).join('') + '</ol>';
            break;
        case 'order':
            h += '<div class="mc-two"><div><span class="mc-lbl">على الشاشة (متلخبطة)</span><ol class="mc-steps">' + (it.shuffled || []).map(function (s) { return '<li>' + _mcEsc(s) + '</li>'; }).join('') + '</ol></div>' +
                '<div><span class="mc-lbl ok">✔ الترتيب الصح</span><ol class="mc-steps ok">' + (it.steps || []).map(function (s) { return '<li>' + _mcEsc(s) + '</li>'; }).join('') + '</ol></div></div>';
            break;
        case 'emoji':
            h += '<div class="mc-emoji">' + _mcEsc(it.prompt) + '</div>';
            break;
        case 'anagram':
            h += '<div class="mc-scr">' + _mcEsc(String(it.scrambled || '').split('').join(' ')) + '</div>' + (it.hint ? '<p class="mc-muted">تلميح على الشاشة: ' + _mcEsc(it.hint) + '</p>' : '');
            break;
        case 'odd':
            h += '<div class="mc-chips">' + (it.items || []).map(function (x, i) { return '<span class="mc-chip' + (i === it.odd ? ' bad' : '') + '">' + _mcEsc(x) + (i === it.odd ? ' 🚫' : '') + '</span>'; }).join('') + '</div>';
            break;
        case 'sixty':
            h += '<div class="mc-chips sm">' + (it.list || []).map(function (x) { return '<span class="mc-chip">' + _mcEsc(x) + '</span>'; }).join('') + '</div>';
            break;
        case 'act': case 'draw': case 'taboo':
            h += '<p class="mc-muted">' + (k === 'act' ? '🎭 واحد ييجي يقرا ويمثّلها من غير كلام' : k === 'draw' ? '🎨 واحد ييجي يقرا ويرسمها من غير حروف' : '🤐 واحد ييجي يقرا ويشرحها من غير الكلمات الممنوعة') + '</p>' +
                '<div class="mc-secret">' + _mcEsc(it.secret) + '</div>';
            if (it.forbidden) h += '<div class="mc-chips"><span class="mc-lbl">ممنوع يقول:</span>' + it.forbidden.map(function (f) { return '<span class="mc-chip bad">🚫 ' + _mcEsc(f) + '</span>'; }).join('') + '</div>';
            break;
        case 'hymn':
            h += '<div class="mc-prompt">🎵 ' + _mcEsc(it.firstLine) + '</div>';
            break;
    }
    return h;
}

function _mcItemActsHtml(it, cur) {
    var k = it.kind, h = '';
    if (cur.stage === 'preview') {
        return '<button class="mc-btn go big" data-a="show">👁 اعرض</button><button class="mc-btn" data-a="skip">🔄 سؤال تاني</button>';
    }
    if (cur.stage === 'shown') {
        if (k === 'mcq' || k === 'scenario' || k === 'verse') {
            var all = (cur.optionsShown || 0) >= it.options.length;
            h += '<button class="mc-btn pri" data-a="opt"' + (all ? ' disabled' : '') + '>اظهر الاختيار الجاي (' + _mcNum(cur.optionsShown || 0) + '/' + _mcNum(it.options.length) + ')</button>' +
                '<button class="mc-btn" data-a="optall"' + (all ? ' disabled' : '') + '>كل الاختيارات</button>';
        } else if (k === 'clues') {
            var last = (cur.clueIdx || 0) >= it.clues.length - 1;
            h += '<button class="mc-btn pri" data-a="clue"' + (last ? ' disabled' : '') + '>التلميح الجاي (' + _mcNum((cur.clueIdx || 0) + 1) + '/' + _mcNum(it.clues.length) + ')</button>';
        } else if (k === 'sixty') {
            h += '<span class="mc-counter"><button class="mc-btn" data-a="cnt" data-v="-1">−١</button><b>' + _mcNum(cur.count || 0) + '</b>' +
                '<button class="mc-btn pri big" data-a="cnt" data-v="1">+١</button></span>';
        }
        var paused = !cur.timerEndsAt;
        h += '<span class="mc-tctl"><button class="mc-btn" data-a="tpause">' + (paused ? '▶ كمّل الوقت' : '⏸ وقّف الوقت') + '</button>' +
            '<button class="mc-btn" data-a="tplus">+١٥ ث</button></span>';
        h += '<button class="mc-btn go big" data-a="reveal">✅ اظهر الإجابة</button>';
    }
    if (cur.stage === 'revealed') h += '<button class="mc-btn go big" data-a="next">⏭ السؤال الجاي</button>';
    h += '<button class="mc-btn ghost" data-a="clear">🧹 فضّي الشاشة</button>';
    return h;
}

function _mcTick() {
    var el = _mcEl('mc-timer'), cur = _mc.night && _mc.night.current;
    if (!el) return;
    var txt = '', cls = 'mc-timer';
    if (cur && cur.stage === 'shown') {
        if (cur.timerEndsAt) {
            var left = Math.max(0, cur.timerEndsAt - Date.now()), s = Math.ceil(left / 1000);
            txt = left > 0 ? '⏱ ' + _mcNum(s) + ' ث' : '⏰ الوقت خلص';
            if (left <= 5000) cls += ' urgent';
        } else if (cur.timerLeft !== null && cur.timerLeft !== undefined) {
            txt = '⏸ ' + _mcNum(Math.ceil(cur.timerLeft / 1000)) + ' ث';
        }
    }
    if (el.textContent !== txt) el.textContent = txt;
    if (el.className !== cls) el.className = cls;
}

/* ---------- play: extra cards (bet, wheel result) ---------- */

function _mcExtraHtml() {
    var ui = _mc.ui, n = _mc.night, h = '';
    if (ui.wheelMsg) h += '<div class="mc-card mc-note-card">🎡 ' + _mcEsc(ui.wheelMsg) + ' <button class="mc-x" data-a="wheelok">✕</button></div>';
    var b = ui.bet;
    if (b) {
        h += '<div class="mc-card mc-bet"><div class="mc-ihead"><b>🎰 الرهان</b><button class="mc-x" data-a="betx">✕</button></div>';
        if (!b.teamId) {
            h += '<p class="mc-muted">اختار الفريق اللي هيراهن (على جزء من نقطه على الشاشة):</p><div class="mc-chips">' + n.teams.map(function (t) {
                return '<button class="mc-chip team" style="--tc:' + _mcEsc(t.color) + '" data-a="betteam" data-t="' + _mcEsc(t.id) + '"' + (t.score > 0 ? '' : ' disabled') + '>' +
                    _mcEsc(t.icon) + ' ' + _mcEsc(t.name) + ' <small>' + _mcNum(t.score) + '</small></button>';
            }).join('') + '</div>';
        } else {
            var t = _mcTeam(b.teamId);
            h += '<div class="mc-row"><span>' + _mcEsc(t ? t.name : '') + ' راهن بـ</span><span class="mc-counter"><button class="mc-btn" data-a="betamt" data-v="-5">−٥</button><b>' + _mcNum(b.amount) +
                '</b><button class="mc-btn" data-a="betamt" data-v="5">+٥</button></span></div>' +
                '<div class="mc-row"><button class="mc-btn go" data-a="betres" data-v="1">💰 كسب (' + _mcPts(b.amount) + ')</button>' +
                '<button class="mc-btn danger" data-a="betres" data-v="-1">😬 خسر (' + _mcPts(-b.amount) + ')</button></div>';
        }
        h += '</div>';
    }
    return h;
}

/* ---------- play: award panel ---------- */

function _mcPointsNow() {
    return _mc.ui.neg ? -MT_POINTS : mtPointsForCurrent(_mc.night);
}

function _mcAwTopHtml() {
    var n = _mc.night, ui = _mc.ui, pts = _mcPointsNow();
    var note = ui.neg ? 'تصحيح: الضغطة الجاية بتشيل ٥' : (n.current && n.current.golden ? 'السؤال الدهبي' : n.multiplier > 1 ? 'دبل!' : '');
    var last = null;
    for (var i = n.awards.length - 1; i >= 0 && !last; i--) last = n.awards[i];
    var undoTxt = '↩ تراجع آخر نقطة';
    var target = _mcUndoTarget();
    if (_mc.undoArmed && Date.now() - _mc.undoArmed < 4000 && target) undoTxt = 'متأكد؟ تراجع عن ' + _mcPts(target.points) + ' ' + _mcAwardWho(target);
    return '<div class="mc-pts' + (pts < 0 ? ' neg' : '') + '"><span>كل ضغطة على اسم</span><b>⭐ ' + _mcPts(pts) + '</b>' + (note ? '<small>' + _mcEsc(note) + '</small>' : '') + '</div>' +
        '<div class="mc-row"><button class="mc-btn' + (ui.neg ? ' danger on' : '') + '" data-a="neg">' + (ui.neg ? '✕ إلغاء التصحيح' : '−٥ تصحيح') + '</button>' +
        '<button class="mc-btn' + (_mc.undoArmed ? ' danger' : '') + '" data-a="undo"' + (target ? '' : ' disabled') + '>' + _mcEsc(undoTxt) + '</button></div>' +
        /* always one line, so the panel below never shifts after the first award */
        '<div class="mc-last">آخر نقطة: ' + (last ? _mcEsc(_mcPts(last.points) + ' ' + _mcAwardWho(last)) + (last.kind === 'undo' ? ' (تراجع)' : '') : '—') + '</div>';
}

function _mcUndoTarget() {
    var n = _mc.night, undone = {};
    n.awards.forEach(function (a) { if (a.kind === 'undo') undone[a.refId] = true; });
    for (var i = n.awards.length - 1; i >= 0; i--) {
        var a = n.awards[i];
        if (a.kind !== 'undo' && !undone[a.id]) return a;
    }
    return null;
}

function _mcAwardWho(a) {
    var n = _mc.night;
    if (a.kind === 'team' || (a.kind === 'undo' && a.phones.length !== 1)) { var t = _mcTeam(a.teamId); return t ? t.name : ''; }
    var k = n.roster[a.phones[0]];
    return k ? k.name : '';
}

function _mcPickHtml() {
    var n = _mc.night, ui = _mc.ui, lvl = ui.target.level, h = '';
    h += '<button class="mc-btn pri wide" data-a="pick">🎲 اختار حد عشوائي (' + _mcLvl(lvl) + ')</button>';
    var p = ui.pick;
    if (p && !p.here) {
        h += '<div class="mc-pickcard"><b>' + _mcEsc(p.name) + '</b> <small>' + _mcLvl(p.level) + '</small>' + (p.teamName ? ' <small>' + _mcEsc(p.teamName) + '</small>' : '') +
            '<div class="mc-row"><button class="mc-btn go" data-a="pickyes">✓ موجود</button><button class="mc-btn danger" data-a="pickno">✕ مش موجود (لف تاني)</button></div></div>';
    }
    var ph = ui.choose || (p && p.here ? p.phone : null);
    if (ph) {
        var kid = n.roster[ph], pl = kid || _mcPlayer(ph) || { name: ph, level: 1 };
        var pts = _mcPointsNow();
        h += '<div class="mc-pickcard"><div class="mc-ihead"><b>' + _mcEsc(pl.name) + '</b><small>' + _mcLvl(pl.level) + '</small>' +
            '<button class="mc-x" data-a="choosex">✕</button></div>';
        if (kid && kid.teamId) {
            h += '<button class="mc-btn go big wide" data-a="kid" data-p="' + _mcEsc(ph) + '">⭐ ' + _mcPts(pts) + ' لـ ' + _mcEsc(pl.name) + '</button>';
        } else if (n.teams.some(function (t) { return mtFits({ level: pl.level === 2 ? 2 : 1 }, t); })) {
            h += '<p class="mc-muted">لسه مش في فريق: اختار فريقه وياخد ' + _mcPts(pts) + '</p><div class="mc-chips">' + n.teams.filter(function (t) { return mtFits({ level: pl.level === 2 ? 2 : 1 }, t); }).map(function (t) {
                return '<button class="mc-chip team" style="--tc:' + _mcEsc(t.color) + '" data-a="kidteam" data-p="' + _mcEsc(ph) + '" data-t="' + _mcEsc(t.id) + '">' + _mcEsc(t.icon) + ' ' + _mcEsc(t.name.replace(/^فريق\s+/, '')) + '</button>';
            }).join('') + '<button class="mc-chip" data-a="kidteam" data-p="' + _mcEsc(ph) + '" data-t="">من غير فريق</button></div>';
        } else {
            h += '<button class="mc-btn go big wide" data-a="kidteam" data-p="' + _mcEsc(ph) + '" data-t="">⭐ ' + _mcPts(pts) + ' لـ ' + _mcEsc(pl.name) + '</button>';
        }
        h += '</div>';
    }
    return h;
}

function _mcSqLevelHtml() {
    var ui = _mc.ui;
    return [1, 2, 'all'].map(function (l) {
        return '<button class="mc-chip' + (ui.sqLevel === l ? ' on' : '') + '" data-a="sqlv" data-v="' + l + '">' + _mcLvl(l) + '</button>';
    }).join('');
}

function _mcAwardResults() {
    if (mtNormalize(_mc.ui.sq).length < 2) return [];
    return mtSearch(_mcSearchSource(_mc.ui.sqLevel), _mc.ui.sq, 8);
}

function _mcResultsHtml() {
    var n = _mc.night, ui = _mc.ui;
    if (mtNormalize(ui.sq).length < 2) return '';
    var guest = _mcGuestBtnsHtml(ui.sq, ui.sqLevel === 'all' ? 0 : ui.sqLevel, 'play');
    if (!_mc.players && !Object.keys(n.roster).length) return _mcPlayersStateHtml() + guest;
    var res = _mcAwardResults(), pts = _mcPointsNow();
    var h = _mc.playersErr ? _mcPlayersStateHtml() : '';
    if (!res.length) return h + '<p class="mc-muted">مفيش حد بالاسم ده في ' + (ui.sqLevel === 'all' ? 'المستويين' : _mcLvl(ui.sqLevel)) + '</p>' + guest;
    return h + res.map(function (p) {
        var k = n.roster[p.phone], t = k && k.teamId ? _mcTeam(k.teamId) : null;
        return '<button class="mc-res" data-a="kid" data-p="' + _mcEsc(p.phone) + '"><b>' + _mcEsc(p.name) + '</b><small class="lv">' + _mcLvl(p.level) + '</small>' +
            (t ? '<span class="mc-tag" style="--tc:' + _mcEsc(t.color) + '">' + _mcEsc(t.name) + '</span>' : (p.team ? '<small>' + _mcEsc(p.team) + '</small>' : '')) +
            (k ? '<small>⭐ ' + _mcNum(k.stars) + '</small>' : '<small>مش في الحضور</small>') +
            '<span class="pts' + (pts < 0 ? ' neg' : '') + '">' + _mcPts(pts) + '</span></button>';
    }).join('') + guest;
}

function _mcTeamBtnsHtml() {
    var n = _mc.night, pts = _mcPointsNow();
    if (!n.teams.length) return '';
    return '<div class="mc-lbl">للفريق كله (كل الحاضرين فيه):</div><div class="mc-tbtns">' + n.teams.map(function (t) {
        return '<button class="mc-tbtn" style="--tc:' + _mcEsc(t.color) + '" data-a="team" data-t="' + _mcEsc(t.id) + '">' + _mcEsc(t.icon) + ' ' +
            _mcEsc(t.name.replace(/^فريق\s+/, '')) + ' <b>' + _mcPts(pts) + '</b></button>';
    }).join('') + '</div>';
}

function _mcRosterHtml() {
    var n = _mc.night, groups = {};
    Object.keys(n.roster).forEach(function (ph) {
        var k = n.roster[ph], l = k.level === 2 ? 2 : 1;
        (groups[l] = groups[l] || []).push(k);
    });
    var lv = n.levels.slice();
    [1, 2].forEach(function (l) { if (groups[l] && lv.indexOf(l) < 0) lv.push(l); });
    lv.sort();
    return lv.map(function (l) {
        var ks = (groups[l] || []).sort(_mcByName);
        return '<div class="mc-rgroup"><div class="mc-lbl">' + (l === 1 ? 'حاضرين م١' : 'حاضرين م٢') + ' (' + _mcNum(ks.length) + ')</div><div class="mc-kidgrid">' +
            (ks.length ? ks.map(function (k) {
                var t = k.teamId ? _mcTeam(k.teamId) : null;
                return '<button class="mc-kid" data-a="kid" data-p="' + _mcEsc(k.phone) + '"' + (t ? ' style="--tc:' + _mcEsc(t.color) + '"' : '') + '>' +
                    '<span class="dot"></span><span class="nm">' + _mcEsc(k.name) + '</span><b>' + _mcNum(k.stars) + '</b></button>';
            }).join('') : '<span class="mc-muted">لسه مفيش حد. دوّر بالاسم فوق.</span>') + '</div></div>';
    }).join('');
}

/* ---------- end ---------- */

function _mcEndHtml() {
    var n = _mc.night, p = _mcPendingStars(), kids = mtTopKids(n, 3).filter(function (k) { return k.stars > 0; });
    var h = '<div class="mc-big-ico">🏆</div><h2>أبطال الليلة</h2>';
    h += kids.length ? '<ol class="mc-podium">' + kids.map(function (k, i) {
        return '<li>' + ['🥇', '🥈', '🥉'][i] + ' ' + _mcEsc(k.name) + ' <b>⭐ ' + _mcNum(k.stars) + '</b></li>';
    }).join('') + '</ol>' : '<p class="mc-muted">محدش خد نقط النهارده.</p>';
    if (n.teams.length) h += '<div class="mc-strip end">' + _mcStripHtml() + '</div>';
    h += '<div class="mc-row center"><button class="mc-btn" data-a="back">↩ ارجع للعب</button>' +
        '<button class="mc-btn gold" data-a="podium">🏆 اعرض المنصة تاني</button>' +
        '<button class="mc-btn danger" data-a="clearnight">🗑️ امسح السهرة وابدأ جديدة</button></div>';
    if (_mc.ui.clearAsk && p.n) h += _mcClearAskHtml(p);
    return h;
}

/* ---------- actions: items ---------- */

function _mcMarkUsed(it) {
    var n = _mc.night;
    if (!it || n.usedTonight.indexOf(it.id) >= 0) return;
    n.usedTonight.push(it.id);
    _mc.history[it.id] = n.date;
    mcRecordUsed(window.db, it.id, n.date).then(function () {}, function (e) {
        try { console.warn('meeting history not saved:', _mcErrText(e)); } catch (x) { /* no console */ }
    });
}

/* Leaving the current item: a shown item counts as used; a previewed one as skipped. */
function _mcLeaveCurrent() {
    var n = _mc.night, cur = n.current;
    if (!cur) return;
    if (cur.stage === 'preview') { if (n.skipped.indexOf(cur.item.id) < 0) n.skipped.push(cur.item.id); }
    else _mcMarkUsed(cur.item);
}

function _mcPickItem(golden) {
    var n = _mc.night, t = _mc.ui.target;
    var opts = { level: t.level, kind: _mc.ui.kind || null };
    if (golden) {
        opts.difficulty = 3;
        /* mtPickNext only falls back within one kind, so a random golden first picks a kind that has hard items */
        if (!opts.kind) {
            var lvl = _mcPickLevel(t.level), on = mtAvailableKinds(_mc.pool, n), seen = {};
            _mc.pool.forEach(function (x) {
                if (x.level === lvl && x.difficulty === 3 && on.indexOf(x.kind) >= 0 && n.usedTonight.indexOf(x.id) < 0 && n.skipped.indexOf(x.id) < 0) seen[x.kind] = true;
            });
            var hard = Object.keys(seen), fresh = hard.filter(function (k) { return k !== n.lastKind; });
            if (fresh.length) hard = fresh;
            if (hard.length) opts.kind = hard[Math.floor(Math.random() * hard.length)];
        }
    }
    var it = mtPickNext(_mc.pool, n, opts, _mc.history, Math.random);
    if (!it && opts.kind) { opts.kind = null; it = mtPickNext(_mc.pool, n, opts, _mc.history, Math.random); }
    return it;
}

function _mcSetCurrent(it, golden) {
    var n = _mc.night, t = _mc.ui.target;
    n.current = {
        item: it, target: { level: t.level, mode: t.mode, teamId: t.mode === 'team' ? t.teamId : null },
        stage: 'preview', clueIdx: 0, optionsShown: 0, timerEndsAt: 0, timerLeft: null,
        timerSec: mtTimerFor(it.kind, t.mode), golden: !!golden, count: 0
    };
}

function _mcNext(golden) {
    var n = _mc.night, keepGolden = golden;
    _mcLeaveCurrent();
    var it = _mcPickItem(keepGolden);
    if (!it) {
        n.current = null;
        _mcCommit();
        _mcToast('خلصت الأسئلة اللي تنفع للاختيار ده. غيّر المستوى أو الفقرة.', 4000);
        return;
    }
    _mcSetCurrent(it, keepGolden);
    _mc.ui.choose = null;
    _mcCommit();
    if (keepGolden) _mcFx({ type: 'golden' });
}

var _MC_A = {};

_MC_A.next = function () { _mcNext(false); };
_MC_A.golden = function () { _mcNext(true); };

_MC_A.skip = function () {
    var n = _mc.night, cur = n.current;
    if (!cur) return;
    var golden = cur.golden;
    if (n.skipped.indexOf(cur.item.id) < 0) n.skipped.push(cur.item.id);
    /* same target as the skipped item */
    var saveT = _mc.ui.target;
    _mc.ui.target = { level: cur.target.level, mode: cur.target.mode, teamId: cur.target.teamId };
    var it = _mcPickItem(golden);
    _mc.ui.target = saveT;
    if (!it) { n.current = null; _mcCommit(); _mcToast('مفيش سؤال تاني من النوع ده.', 3000); return; }
    var target = cur.target;
    _mcSetCurrent(it, golden);
    n.current.target = target;
    n.current.timerSec = mtTimerFor(it.kind, target.mode);
    _mcCommit();
};

_MC_A.show = function () {
    var n = _mc.night, cur = n.current;
    if (!cur || cur.stage !== 'preview') return;
    cur.stage = 'shown';
    cur.optionsShown = 0;
    cur.clueIdx = 0;
    cur.timerLeft = null;
    cur.timerEndsAt = Date.now() + cur.timerSec * 1000;
    n.lastKind = cur.item.kind;
    _mcCommit();
};

_MC_A.opt = function () {
    var cur = _mc.night.current;
    if (!cur || cur.stage !== 'shown') return;
    cur.optionsShown = Math.min(cur.item.options.length, (cur.optionsShown || 0) + 1);
    _mcCommit();
};
_MC_A.optall = function () {
    var cur = _mc.night.current;
    if (!cur || cur.stage !== 'shown') return;
    cur.optionsShown = cur.item.options.length;
    _mcCommit();
};
_MC_A.clue = function () {
    var cur = _mc.night.current;
    if (!cur || cur.stage !== 'shown') return;
    cur.clueIdx = Math.min(cur.item.clues.length - 1, (cur.clueIdx || 0) + 1);
    _mcCommit();
};
_MC_A.cnt = function (d) {
    var cur = _mc.night.current;
    if (!cur || cur.stage !== 'shown') return;
    cur.count = Math.max(0, (cur.count || 0) + Number(d.v));
    _mcCommit();
};
_MC_A.tpause = function () {
    var cur = _mc.night.current;
    if (!cur || cur.stage !== 'shown') return;
    if (cur.timerEndsAt) { cur.timerLeft = Math.max(0, cur.timerEndsAt - Date.now()); cur.timerEndsAt = 0; }
    else { cur.timerEndsAt = Date.now() + Math.max(1000, cur.timerLeft || 0); cur.timerLeft = null; }
    _mcCommit();
};
_MC_A.tplus = function () {
    var cur = _mc.night.current;
    if (!cur || cur.stage !== 'shown') return;
    if (cur.timerEndsAt) cur.timerEndsAt = Math.max(cur.timerEndsAt, Date.now()) + 15000;
    else cur.timerLeft = (cur.timerLeft || 0) + 15000;
    cur.timerSec += 15;
    _mcCommit();
};
_MC_A.reveal = function () {
    var n = _mc.night, cur = n.current;
    if (!cur || cur.stage === 'revealed') return;
    if (cur.stage === 'preview') n.lastKind = cur.item.kind;
    cur.stage = 'revealed';
    cur.timerEndsAt = 0;
    cur.timerLeft = null;
    if (cur.item.options) cur.optionsShown = cur.item.options.length;
    _mcMarkUsed(cur.item);
    _mcCommit();
    _mcFx({ type: 'reveal' });
    var s = _mcEl('mc-sq');
    if (s) { s.focus(); try { s.select(); } catch (e) { /* ignore */ } }
};
_MC_A.clear = function () {
    _mcLeaveCurrent();
    _mc.night.current = null;
    _mcCommit();
};

/* ---------- actions: target ---------- */

_MC_A.tlevel = function (d) { _mc.ui.target.level = d.v === 'all' ? 'all' : Number(d.v); _mcRefresh(); };
_MC_A.tmode = function (d) {
    var t = _mc.ui.target;
    t.mode = d.v;
    if (t.mode === 'team') _mcTurnTo(_mcTeam(t.teamId) ? t.teamId : _mc.night.teams.length ? _mc.night.teams[0].id : null);
    _mcRefresh();
};
_MC_A.tteam = function (d) { _mcTurnTo(d.t); _mcRefresh(); };
_MC_A.tkind = function (d) { _mc.ui.kind = d.k || null; _mcRefresh(); };

/* ---------- actions: awards ---------- */

/* quiet: apply, save and sync now, but leave the projector (view + fx) to the caller. */
function _mcGive(target, points, segment, quiet) {
    var n = _mc.night;
    /* keyed on the target only: points change after the first tap (−٥ and دبل reset), so the second
       tap of a double tap would otherwise get through with different points */
    var key = target.phone || 'T' + target.teamId;
    if (_mc.lastGive.key === key && Date.now() - _mc.lastGive.at < MC_DOUBLE_TAP_MS) return null;
    var cur = n.current;
    var itemId = cur && cur.stage !== 'preview' ? cur.item.id : null;
    var a = mtAward(n, target, points, itemId);
    if (!a) return null;
    _mc.lastGive = { key: key, at: Date.now() };
    _mc.ui.neg = false;
    _mc.undoArmed = 0;
    if (quiet) { _mcSave(); _mcRefresh(); }
    else { _mcCommit(); _mcAwardFx(a); }
    var t = a.teamId ? _mcTeam(a.teamId) : null;
    var kid = a.kind === 'individual' ? n.roster[a.phones[0]] : null;
    mcLogAward(window.db, a, {
        adminName: _mc.session.name || _mc.session.phone || '',
        kidName: kid ? kid.name : '', teamName: t ? t.name : '',
        segment: segment || (cur && cur.stage !== 'preview' && MT_KINDS[cur.item.kind] ? MT_KINDS[cur.item.kind].label : ''),
        date: n.date
    });
    _mcSync();
    _mcToast('⭐ ' + _mcPts(points) + ' ' + _mcAwardWho(a));
    return a;
}

function _mcAwardFx(a) {
    var t = a.teamId ? _mcTeam(a.teamId) : null;
    if (a.kind === 'team' || (a.kind === 'undo' && a.phones.length !== 1 && t)) {
        _mcFx({ type: 'teamAward', teamName: t ? t.name : '', teamColor: t ? t.color : '', points: a.points });
    } else {
        var k = _mc.night.roster[a.phones[0]];
        _mcFx({ type: 'award', name: k ? k.name : '', points: a.points, teamName: t ? t.name : '', teamColor: t ? t.color : '', level: k ? k.level : null });
    }
}

/* One tap on a kid anywhere in the award panel. A kid with no team tonight first gets the team chips. */
function _mcTapKid(phone) {
    var n = _mc.night, ui = _mc.ui, kid = n.roster[phone];
    var p = kid || _mcPlayer(phone);
    if (!p) return;
    if (!kid && ui.neg) { _mcToast('التصحيح بس للي خدوا نقط النهارده'); return; }
    if (!kid) kid = _mcCheckIn(p);
    var fit = n.teams.some(function (t) { return mtFits(kid, t); });
    if (!kid.teamId && fit && !ui.neg) {
        ui.choose = phone;
        _mcCommit(); /* the tap checked the kid in */
        return;
    }
    ui.choose = null;
    if (ui.pick && ui.pick.phone === phone) ui.pick = null;
    _mcGive({ phone: phone }, _mcPointsNow());
}

/* Award taps (kid, team-chip, team, Enter): a second tap within MC_TAP_LOCK_MS is dropped, wherever it lands. */
function _mcTapOk() {
    var now = Date.now();
    if (now - _mc.tapAt < MC_TAP_LOCK_MS) return false;
    _mc.tapAt = now;
    return true;
}

_MC_A.kid = function (d) { if (_mcTapOk()) _mcTapKid(d.p); };

_MC_A.kidteam = function (d) {
    if (!_mcTapOk()) return;
    var n = _mc.night, ph = d.p, p = n.roster[ph] || _mcPlayer(ph);
    if (!p) return;
    _mcCheckIn(p);
    if (d.t) mtSetTeam(n, ph, d.t);
    _mc.ui.choose = null;
    if (_mc.ui.pick && _mc.ui.pick.phone === ph) _mc.ui.pick = null;
    _mcGive({ phone: ph }, _mcPointsNow());
};
_MC_A.choosex = function () { _mc.ui.choose = null; _mc.ui.pick = null; _mcRefresh(); };

_MC_A.team = function (d) { if (_mcTapOk()) _mcGive({ teamId: d.t }, _mcPointsNow()); };

_MC_A.neg = function () { _mc.ui.neg = !_mc.ui.neg; _mcRefresh(); };

_MC_A.undo = function () {
    if (!_mc.undoArmed || Date.now() - _mc.undoArmed > 4000) {
        _mc.undoArmed = Date.now();
        _mcRefresh();
        setTimeout(function () { if (_mc.undoArmed && Date.now() - _mc.undoArmed >= 4000) { _mc.undoArmed = 0; _mcRefresh(); } }, 4100);
        return;
    }
    _mc.undoArmed = 0;
    var n = _mc.night, u = mtUndoLast(n);
    if (!u) { _mcRefresh(); return; }
    _mcCommit();
    _mcAwardFx(u);
    var t = u.teamId ? _mcTeam(u.teamId) : null;
    var kid = u.phones.length === 1 ? n.roster[u.phones[0]] : null;
    mcLogAward(window.db, u, { adminName: _mc.session.name || '', kidName: kid ? kid.name : '', teamName: t ? t.name : '', segment: 'تراجع', date: n.date });
    _mcSync();
    _mcToast('↩ اتلغت: ' + _mcPts(-u.points) + ' ' + _mcAwardWho(u));
};

_MC_A.sqlv = function (d) {
    _mc.ui.sqLevel = d.v === 'all' ? 'all' : Number(d.v);
    _mcRefresh();
    var s = _mcEl('mc-sq'); if (s) s.focus();
};

/* ---------- actions: random pick ---------- */

function _mcPickPool(level) {
    var n = _mc.night;
    var ok = function (p) { return (level === 'all' || (p.level === 2 ? 2 : 1) === level) && n.excluded.indexOf(p.phone) < 0; };
    var pool = Object.keys(n.roster).map(function (ph) { return n.roster[ph]; }).filter(ok);
    if (pool.length < 3) pool = (_mc.players || []).filter(ok);
    return pool;
}

_MC_A.pick = function () {
    var n = _mc.night, level = _mc.ui.target.level;
    var kid = mtRandomPick(n, _mc.players || [], level, Math.random);
    if (!kid) { _mcToast('مفيش حد في المستوى ده نختار منه.'); return; }
    var others = _mcPickPool(level).filter(function (p) { return p.phone !== kid.phone; });
    var names = [];
    while (others.length && names.length < MC_PICK_NAMES - 1) names.push(others.splice(Math.floor(Math.random() * others.length), 1)[0].name);
    var index = Math.floor(Math.random() * (names.length + 1));
    names.splice(index, 0, kid.name);
    var rk = n.roster[kid.phone];
    _mc.ui.pick = { phone: kid.phone, name: kid.name, level: kid.level === 2 ? 2 : 1, teamName: rk ? _mcKidTeamName(rk) : (kid.team || ''), here: false };
    _mc.ui.choose = null;
    _mcRefresh();
    _mcFx({ type: 'pick', names: names, index: index });
};
_MC_A.pickyes = function () {
    var n = _mc.night, p = _mc.ui.pick;
    if (!p) return;
    if (!n.roster[p.phone]) _mcCheckIn(_mcPlayer(p.phone) || { phone: p.phone, name: p.name, level: p.level, team: '' });
    p.here = true;
    _mcCommit();
};
_MC_A.pickno = function () {
    var n = _mc.night, p = _mc.ui.pick;
    if (p && n.excluded.indexOf(p.phone) < 0) n.excluded.push(p.phone);
    _mc.ui.pick = null;
    _mcSave();
    _MC_A.pick();
};

/* ---------- actions: surprises ---------- */

_MC_A.wheel = function () {
    var n = _mc.night, st = mtStandings(n), roster = Object.keys(n.roster);
    var lead = st[0], last = st[st.length - 1];
    var can = {
        double: true,
        gift: roster.length > 0,
        steal: st.length > 1 && lead.score > 0,
        rescue: st.length > 1
    };
    var ok = MC_WHEEL.filter(function (o) { return can[o.id]; });
    var o = ok[Math.floor(Math.random() * ok.length)];
    var index = MC_WHEEL.indexOf(o), msg = '', gift = null;
    _mc.wheelTimers.forEach(clearTimeout);
    _mc.wheelTimers = [];
    var mult = n.multiplier;
    if (o.id === 'double') {
        n.multiplier = 2;
        msg = 'النقط دبل في السؤال الجاي (' + _mcPts(MT_POINTS * 2) + ')';
    } else if (o.id === 'gift') {
        var ph = roster[Math.floor(Math.random() * roster.length)];
        msg = '٥ نجوم هدية لـ ' + n.roster[ph].name;
        /* a real award, applied now so a refresh cannot lose it; the screen shows it after the wheel lands */
        _mc.lastGive = { key: '', at: 0 };
        gift = _mcGive({ phone: ph }, MT_POINTS, 'عجلة الحظ', true);
        /* a gift is not "the next question": keep a pending double */
        n.multiplier = mult;
    } else if (o.id === 'steal') {
        var amt = Math.min(MT_POINTS, lead.score);
        mtScreenScore(n, last.id, amt);
        mtScreenScore(n, lead.id, -amt);
        msg = last.name + ' خد ' + _mcNum(amt) + ' من ' + lead.name + ' (على الشاشة بس)';
    } else if (o.id === 'rescue') {
        _mc.ui.target.mode = 'team';
        _mcTurnTo(last.id);
        msg = 'السؤال الجاي إنقاذ لـ ' + last.name + ' (اتظبط في «مين يجاوب»)';
    }
    _mc.ui.wheelMsg = msg;
    _mcSave();
    _mcRefresh();
    _mcFx({ type: 'wheel', outcomes: MC_WHEEL.map(function (x) { return x.label; }), index: index });
    /* the projector shows the effect once the wheel has landed */
    _mc.wheelTimers.push(setTimeout(_mcView, MC_WHEEL_LAND_MS));
    if (gift) {
        _mc.wheelTimers.push(setTimeout(function () {
            if (_mc.night !== n) return;
            _mcView();
            _mcAwardFx(gift);
        }, MC_WHEEL_GIFT_MS));
    }
};
_MC_A.wheelok = function () { _mc.ui.wheelMsg = ''; _mcRefresh(); };

_MC_A.bet = function () {
    if (_mc.night.teams.length < 1) { _mcToast('الرهان محتاج فرق.'); return; }
    _mc.ui.bet = { teamId: null, amount: 0 };
    _mcRefresh();
};
_MC_A.betx = function () { _mc.ui.bet = null; _mcRefresh(); };
_MC_A.betteam = function (d) {
    var t = _mcTeam(d.t);
    if (!t || t.score <= 0) return;
    var amt = Math.max(Math.min(MT_POINTS, t.score), Math.floor(t.score / 2 / MT_POINTS) * MT_POINTS);
    _mc.ui.bet = { teamId: t.id, amount: amt };
    _mcRefresh();
    _mcFx({ type: 'bet', teamName: t.name, amount: amt });
};
_MC_A.betamt = function (d) {
    var b = _mc.ui.bet, t = b && _mcTeam(b.teamId);
    if (!t) return;
    b.amount = Math.max(1, Math.min(Math.max(1, t.score), b.amount + Number(d.v)));
    _mcRefresh();
    _mcFx({ type: 'bet', teamName: t.name, amount: b.amount });
};
_MC_A.betres = function (d) {
    var b = _mc.ui.bet, t = b && _mcTeam(b.teamId);
    if (!t) return;
    var delta = Number(d.v) > 0 ? b.amount : -b.amount;
    mtScreenScore(_mc.night, t.id, delta);
    _mc.ui.bet = null;
    _mcCommit();
    _mcToast('🎰 ' + t.name + ' ' + _mcPts(delta) + ' (على الشاشة بس)');
};

_MC_A.board = function () { _mcView(); _mcFx({ type: 'board' }); };

/* ---------- actions: header ---------- */

_MC_A.mute = function () {
    _mc.muted = !_mc.muted;
    _mcFx({ type: 'sound', on: !_mc.muted });
    _mcRefresh();
};

/* A popup window (not a tab) so the host can drag it to the projector. Opening by name first with no
   URL returns an already-open screen untouched: reloading it would drop fullscreen and the sound unlock. */
_MC_A.screen = function () {
    var w = null, ours = false;
    try { w = window.open('', MC_SCREEN_NAME, MC_SCREEN_FEATURES); } catch (e) { w = null; }
    if (!w) { _mcToast('المتصفح منع فتح الشاشة: اسمح بالـ popups للصفحة دي', 5000); return; }
    try { ours = /\/meeting(\.html)?$/.test(w.location.pathname) && /[?&]view=screen(&|$)/.test(w.location.search); } catch (e) { ours = false; }
    if (!ours) { try { w.location.href = MC_SCREEN_URL; } catch (e) { /* navigation refused: the screen stays as it is */ } }
    try { w.focus(); } catch (e) { /* focus may be refused */ }
    var note = _mcEl('mc-screennote');
    if (note) note.textContent = '📺 ' + MC_SCREEN_NOTE;
    _mcToast('📺 ' + MC_SCREEN_NOTE, 7000);
    setTimeout(_mcView, 800);
};

_MC_A.editor = function () { _mc.ui.editor = !_mc.ui.editor; _mc.ui.editKid = null; _mcRefresh(); };
_MC_A.syncnow = function () { _mcRetry(); };
_MC_A.reloadplayers = function () { _mc.playersAt = 0; _mcLoadPlayers(); };
_MC_A.reloadteams = function () { _mc.teamsAt = 0; _mcLoadTeams(); };

/* ---------- actions: setup ---------- */

_MC_A.lvl = function (d) {
    var n = _mc.night, l = Number(d.v), i = n.levels.indexOf(l);
    if (i >= 0) {
        if (n.levels.length === 1) return;
        n.levels.splice(i, 1);
        n.filter.subjects = n.filter.subjects.filter(function (k) { return _mcSubjectLevel(k) !== l; });
        Object.keys(n.filter.lessons).forEach(function (k) { if (_mcSubjectLevel(k) === l) delete n.filter.lessons[k]; });
    } else {
        n.levels.push(l);
        n.levels.sort();
        var key = MC_BIBLE[l], ls = _mcLessonsOf(key);
        if (ls.length && n.filter.subjects.indexOf(key) < 0) { n.filter.subjects.push(key); n.filter.lessons[key] = ls.map(function (x) { return x.idx; }); }
    }
    _mcRebuildPool();
    _mc.ui.msg = '';
    _mcCommit();
};

function _mcSubjectLevel(key) {
    for (var i = 0; i < COMPETE_SUBJECTS.length; i++) if (COMPETE_SUBJECTS[i].key === key) return COMPETE_SUBJECTS[i].level;
    return 0;
}

_MC_A.subj = function (d) {
    var n = _mc.night, k = d.k, i = n.filter.subjects.indexOf(k);
    if (i >= 0) { n.filter.subjects.splice(i, 1); delete n.filter.lessons[k]; }
    else { n.filter.subjects.push(k); n.filter.lessons[k] = _mcLessonsOf(k).map(function (x) { return x.idx; }); }
    _mcRebuildPool();
    _mc.ui.msg = '';
    _mcCommit();
};

_MC_A.lesson = function (d) {
    var n = _mc.night, k = d.k, idx = Number(d.i), ls = n.filter.lessons[k] || [];
    var i = ls.indexOf(idx);
    if (i >= 0) ls.splice(i, 1); else { ls.push(idx); ls.sort(function (a, b) { return a - b; }); }
    if (!ls.length) { n.filter.subjects = n.filter.subjects.filter(function (s) { return s !== k; }); delete n.filter.lessons[k]; }
    else n.filter.lessons[k] = ls;
    _mcRebuildPool();
    _mcCommit();
};

_MC_A.kind = function (d) {
    var n = _mc.night, i = n.kinds.indexOf(d.k);
    if (i >= 0) n.kinds.splice(i, 1); else n.kinds.push(d.k);
    _mc.ui.msg = '';
    _mcCommit();
};

_MC_A.rteams = function (d) {
    mtMakeRandomTeams(_mc.night, 1, d.g, Number(d.l));
    _mcCommit();
};

_MC_A.newteam = function (d) {
    var l = Number(d.l), name = String(_mc.ui.newName[l] || '').trim().replace(/\s+/g, ' ');
    if (!name) { _mcToast('اكتب اسم الفريق الأول'); var e = _mcEl('mc-nt-' + l); if (e) e.focus(); return; }
    mtAddCustomTeam(_mc.night, { name: name, level: l });
    _mc.ui.newName[l] = '';
    _mcCommit();
};

_MC_A.icon = function (d) { _mc.ui.iconTeam = _mc.ui.iconTeam === d.t ? null : d.t; _mcRefresh(); };
_MC_A.seticon = function (d) {
    var t = _mcTeam(d.t);
    if (t && MT_TEAM_LOGOS.indexOf(d.v) >= 0) t.icon = d.v;
    _mcCommit();
};
_MC_A.setcolor = function (d) {
    var t = _mcTeam(d.t);
    if (t && MT_TEAM_COLORS.indexOf(d.v) >= 0) t.color = d.v;
    _mcCommit();
};

/* Only for a team with no level and no kids yet: a team's level never changes under its kids. */
_MC_A.teamlvl = function (d) {
    var t = _mcTeam(d.t), n = _mc.night;
    if (!t || t.level || Object.keys(n.roster).some(function (ph) { return n.roster[ph].teamId === t.id; })) return;
    t.level = Number(d.v) === 2 ? 2 : 1;
    _mcCommit();
};

_MC_A.ren = function (d) {
    var t = _mcTeam(d.t);
    if (!t) return;
    _mc.ui.renTeam = t.id;
    _mc.ui.renVal = t.name;
    _mcRefresh();
    var inp = _mcEl('mc-tn-' + t.id);
    if (inp) { inp.focus(); try { inp.select(); } catch (e) { /* ignore */ } }
};
_MC_A.renok = function (d) {
    var t = _mcTeam(d.t), name = String(_mc.ui.renVal || '').trim().replace(/\s+/g, ' ');
    _mc.ui.renTeam = null;
    if (t && name) t.name = name;
    _mcCommit();
};

/* data-t: 'ci' (check-in: the kid waits with no team) or 'play' (the award search: then award as a tap). */
_MC_A.guest = function (d) {
    var n = _mc.night, play = d.t === 'play', name = play ? _mc.ui.sq : _mc.ui.ciQ;
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (mtNormalize(name).length < 2) return;
    if (play && _mc.ui.neg) { _mcToast('التصحيح بس للي خدوا نقط النهارده'); return; }
    if (play && !_mcTapOk()) return;
    var kid = mtAddGuest(n, name, Number(d.l) === 2 ? 2 : 1, null);
    if (play) { _mcSave(); _mcView(); _mcTapKid(kid.phone); return; }
    _mcCheckedIn(kid);
};

_MC_A.checkin = function (d) {
    var p = _mc.night.roster[d.p] || _mcPlayer(d.p);
    if (!p || _mc.night.roster[d.p]) return;
    _mcCheckedIn(_mcCheckIn(p));
};

/* After a check-in: say where the kid went, clear the box for the next one. */
function _mcCheckedIn(kid) {
    var t = kid.teamId ? _mcTeam(kid.teamId) : null;
    _mc.ui.ciQ = '';
    _mcCommit();
    _mcToast('✓ ' + kid.name + (t ? ' في ' + t.name : ' (' + _mcLvl(kid.level) + '، من غير فريق)'));
    var inp = _mcEl('mc-ci');
    if (inp) { inp.value = ''; inp.focus(); }
}

/* ---- picking kids with no team: move them, or make random teams of them ---- */

function _mcSelIn(l) {
    var n = _mc.night;
    return Object.keys(_mc.ui.sel).filter(function (ph) { var k = n.roster[ph]; return k && !k.teamId && k.level === l; });
}
_MC_A.selkid = function (d) {
    if (_mc.ui.sel[d.p]) delete _mc.ui.sel[d.p]; else _mc.ui.sel[d.p] = true;
    _mcRefresh();
};
_MC_A.selall = function (d) {
    _mcLevelKids(Number(d.l), null).forEach(function (k) { _mc.ui.sel[k.phone] = true; });
    _mcRefresh();
};
_MC_A.selnone = function (d) {
    _mcSelIn(Number(d.l)).forEach(function (ph) { delete _mc.ui.sel[ph]; });
    _mcRefresh();
};
_MC_A.splitg = function (d) { _mc.ui.splitG = d.v === 'girls' ? 'girls' : 'boys'; _mcRefresh(); };
_MC_A.selmove = function (d) {
    var n = _mc.night;
    _mcSelIn(Number(d.l)).forEach(function (ph) { if (mtSetTeam(n, ph, d.t)) delete _mc.ui.sel[ph]; });
    _mcCommit();
};
_MC_A.selsplit = function (d) {
    var n = _mc.night, l = Number(d.l), phs = _mcSelIn(l);
    var ts = mtSplitIntoTeams(n, phs, Number(d.v), _mc.ui.splitG, l, Math.random);
    phs.forEach(function (ph) { delete _mc.ui.sel[ph]; });
    _mcCommit();
    if (ts.length) _mcToast('✓ ' + _mcNum(ts.length) + ' فرق جديدة من ' + _mcNum(phs.length) + ' ولد');
};
_MC_A.selrm = function (d) {
    var n = _mc.night, phs = _mcSelIn(Number(d.l));
    var stars = phs.filter(function (ph) { return n.roster[ph].stars; });
    if (stars.length && !confirm('فيه ' + _mcNum(stars.length) + ' منهم خدوا نجوم النهارده. تشيلهم من الحضور؟')) return;
    phs.forEach(function (ph) { mtRemoveFromRoster(n, ph); delete _mc.ui.sel[ph]; });
    _mcCommit();
};

/* Drag a kid onto a team card or their level's «من غير فريق» box; other levels refuse the drop. */
function _mcDropOk(z) {
    var k = _mc.dragPh && _mc.night ? _mc.night.roster[_mc.dragPh] : null;
    return !!(z && k && Number(z.getAttribute('data-l')) === k.level);
}
function _mcDragClear() {
    Array.prototype.forEach.call(document.querySelectorAll('.mc-over'), function (x) { x.classList.remove('mc-over'); });
}

_MC_A.gteam = function (d) {
    var n = _mc.night, g = (_mc.gameTeams || [])[Number(d.i)];
    if (!g) return;
    if (n.teams.some(function (t) { return t.source === 'game' && t.gameTeam === g.name; })) return;
    mtAddGameTeam(n, { name: g.name, color: g.color, logo: g.logo, level: g.level });
    /* game-team kids already here move over only when the host ticks them */
    _mcCommit();
};

_MC_A.delteam = function (d) {
    var n = _mc.night, id = d.t;
    if (n.awards.some(function (a) { return a.teamId === id; })) return;
    var t = _mcTeam(id);
    if (!t || !confirm('تشيل ' + t.name + '؟ الولاد اللي فيه هيفضلوا حاضرين من غير فريق.')) return;
    n.teams = n.teams.filter(function (x) { return x.id !== id; });
    Object.keys(n.roster).forEach(function (ph) { if (n.roster[ph].teamId === id) n.roster[ph].teamId = null; });
    if (_mc.ui.target.teamId === id) _mc.ui.target.teamId = null;
    _mcCommit();
};

_MC_A.gcheck = function (d) {
    var n = _mc.night, k = n.roster[d.p];
    if (k) {
        if (k.stars && !confirm(k.name + ' معاه ' + _mcNum(k.stars) + ' نجمة النهارده. تشيله من الحضور؟')) return;
        mtRemoveFromRoster(n, d.p);
        delete _mc.ui.sel[d.p];
    } else {
        var p = _mcPlayer(d.p);
        if (!p) return;
        _mcCheckIn(p);
    }
    _mcCommit();
};

_MC_A.editkid = function (d) { _mc.ui.editKid = _mc.ui.editKid === d.p ? null : d.p; _mcRefresh(); };
_MC_A.movekid = function (d) {
    if (!mtSetTeam(_mc.night, d.p, d.t || null)) _mcToast('الفريق ده من مستوى تاني');
    delete _mc.ui.sel[d.p];
    _mc.ui.editKid = null;
    _mcCommit();
};
_MC_A.rmkid = function (d) {
    var n = _mc.night, k = n.roster[d.p];
    if (!k) return;
    if (k.stars && !confirm(k.name + ' معاه ' + _mcNum(k.stars) + ' نجمة النهارده. تشيله من الحضور؟')) return;
    mtRemoveFromRoster(n, d.p);
    _mc.ui.editKid = null;
    _mcCommit();
};

_MC_A.start = function () {
    var n = _mc.night;
    var title = _mcEl('mc-title'), date = _mcEl('mc-date');
    if (title) n.title = title.value.trim() || MC_DEFAULT_TITLE;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date.value)) n.date = date.value;
    if (!n.filter.subjects.length) { _mc.ui.msg = 'اختار مادة واحدة على الأقل.'; _mcRefresh(); return; }
    if (!mtAvailableKinds(_mc.pool, n).length) { _mc.ui.msg = 'شغّل فقرة واحدة على الأقل فيها أسئلة.'; _mcRefresh(); return; }
    n.started = true;
    _mc.ui.msg = '';
    _mc.ui.target = { level: n.levels[0], mode: 'individual', teamId: null };
    _mcSave();
    _mcPhase('play');
    _mcView();
};

/* ---------- actions: resume / end ---------- */

_MC_A.resume = function () {
    var n = _mc.night;
    _mc.saved = null;
    _mc.ui = _mcFreshUi();
    _mc.ui.target.level = n.levels[0];
    if (n.current && n.current.target) _mc.ui.target = { level: n.current.target.level, mode: n.current.target.mode, teamId: n.current.target.teamId };
    _mcRebuildPool();
    _mcPhase(n.ended ? 'end' : n.started ? 'play' : 'setup');
    _mcView();
    _mcSync();
};

_MC_A.fresh = function () {
    if (mtPendingSyncs(_mc.night).length) { _mc.ui.clearAsk = true; _mcRefresh(); return; }
    _mcClearNight();
};

_MC_A.clearnight = _MC_A.fresh;
_MC_A.clearno = function () { _mc.ui.clearAsk = false; _mcRefresh(); _mcRetry(); };
_MC_A.clearyes = function () {
    var p = _mcPendingStars();
    if (p.n && !confirm('فيه ' + _mcNum(p.stars) + ' نجمة لسه ماتبعتتش. لو مسحت السهرة مش هتوصل لحسابات الولاد. متأكد؟')) return;
    _mcClearNight();
};

function _mcClearNight() {
    try { localStorage.removeItem(MT_STORAGE_KEY); } catch (e) { /* storage blocked */ }
    _mc.wheelTimers.forEach(clearTimeout);
    _mc.wheelTimers = [];
    _mcNewSetup();
}

_MC_A.end = function () {
    var n = _mc.night;
    _mcLeaveCurrent();
    n.current = null;
    n.ended = true;
    _mc.ui.clearAsk = false;
    _mcSave();
    _mcPhase('end');
    _mcView();
    _mcPodium();
};
_MC_A.podium = function () { _mcPodium(); };
_MC_A.back = function () {
    _mc.night.ended = false;
    _mc.ui.clearAsk = false;
    _mcSave();
    _mcPhase('play');
    _mcView();
};

function _mcPodium() {
    var n = _mc.night, top = mtStandings(n)[0];
    _mcFx({
        type: 'podium',
        kids: mtTopKids(n, 3).filter(function (k) { return k.stars > 0; }).map(function (k) { return { name: k.name, stars: k.stars }; }),
        team: top && top.score > 0 ? { name: top.name, color: top.color, score: top.score } : null
    });
}

/* ---------- inputs ---------- */

function _mcOnInput(e) {
    var el = e.target, id = el.id || '', n = _mc.night;
    if (!n) return;
    if (id === 'mc-sq') {
        _mc.ui.sq = el.value;
        _mcPaint('mc-res', _mcResultsHtml());
    } else if (id === 'mc-ci') {
        _mc.ui.ciQ = el.value;
        _mcPaint('mc-ci-res', _mcCheckInResultsHtml());
    } else if (id.indexOf('mc-nt-') === 0) {
        _mc.ui.newName[id.slice(6)] = el.value;
    } else if (id.indexOf('mc-tn-') === 0) {
        _mc.ui.renVal = el.value;
    } else if (id === 'mc-title') {
        n.title = el.value.trim() || MC_DEFAULT_TITLE;
        _mcSave(); _mcView();
        var t = _mcEl('mc-h-title'); if (t) t.textContent = n.title + ' · ' + n.date;
    } else if (id === 'mc-date') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { n.date = el.value; _mcSave(); }
    }
}
