// ============================================================
// ATTENDANCE — scan the meeting QR (printed by admin) → record attendance once + reward stars
// Firestore:
//   attendanceSessions/{sid}  { date:'YYYY-MM-DD', title, code:'123456', active, points, createdAt, createdBy }
//                             admin «QR جديد» deactivates every older session → old printouts stop working
//   attendance/{sid}__{phone} { sessionId, sessionDate, sessionTitle, phone, name, character, team, teamLevel,
//                               playerLevel, points, atMs, at }
//                             create-only in firestore.rules → each player is recorded once per meeting
// QR content: https://<host>/?att=<sid>.<code>   (phone camera opens the game; in-app scanner reads it too)
// A QR is valid only while its session is active AND on its own date.
// ============================================================

var ATT_POINTS_DEFAULT = 50;
var ATT_PENDING_KEY = 'minElBatal_pendingAtt';
var attState = { sessions: [], records: [], sel: '', q: '', lvl: 0, team: '', busy: false, scan: null, loadedSel: null };

// ---------- payload ----------
function attParse(text) {
    text = String(text || '').trim();
    var m = text.match(/[?&]att=([A-Za-z0-9_-]+)\.(\d{6})/) || text.match(/^MEB-ATT:([A-Za-z0-9_-]+):(\d{6})$/);
    return m ? { sid: m[1], code: m[2] } : null;
}

function attDateLabel(d) {
    try { return new Date(d + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return d; }
}
function attTimeLabel(ms) {
    try { return new Date(ms).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
}
function attEsc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

// ---------- record ----------
function attRecord(sid, code) {
    if (attState.busy) return;
    if (!GameState.playerPhone) { showToast('سجّل دخول الأول وبعدين امسح الكود 🙏', 'warning'); return; }
    if (!firebaseDb) { showToast('مفيش اتصال بالنت — جرّب تاني', 'error'); return; }
    if (GameState.attendanceLog && GameState.attendanceLog[sid]) { attAlready(sid); return; }
    attState.busy = true;
    var sRef = firebaseDb.collection('attendanceSessions').doc(sid);
    var rRef = firebaseDb.collection('attendance').doc(sid + '__' + GameState.playerPhone);
    var session = null;
    sRef.get().then(function (snap) {
        if (!snap.exists) throw { msg: 'الكود ده مش صالح ❌' };
        session = snap.data();
        if (String(session.code) !== String(code)) throw { msg: 'الكود ده مش صالح ❌' };
        if (!session.active) throw { msg: 'الكود ده قديم — امسح كود اجتماع النهارده 📅' };
        if (session.date !== getTodayKey()) throw { msg: 'الكود ده لاجتماع ' + attDateLabel(session.date) + ' — مش النهارده 📅' };
        return rRef.get();
    }).then(function (rec) {
        if (!rec) return null;
        if (rec.exists) { attMarkLocal(sid, session, rec.data().points || 0); throw { already: true }; }
        var points = session.points || ATT_POINTS_DEFAULT;
        var now = Date.now();
        return rRef.set({
            sessionId: sid,
            sessionDate: session.date,
            sessionTitle: session.title || '',
            phone: GameState.playerPhone,
            name: GameState.playerName || '',
            character: GameState.character || '',
            team: GameState.team || '',
            teamLevel: GameState.teamLevel || 0,
            playerLevel: (typeof playerLevelOf === 'function') ? playerLevelOf(GameState) : 0,
            points: points,
            atMs: now,
            at: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () { return points; });
    }).then(function (points) {
        if (points == null) return;
        attState.busy = false;
        GameState.stars = (GameState.stars || 0) + points;
        attMarkLocal(sid, session, points);
        try { syncLeaderboard(); } catch (e) {}
        try { logPlayerEvent('attendance', { session: sid, date: session.date }); } catch (e) {}
        attCelebrate(points, session);
        attState.sel = sid;
        attState.loadedSel = null;
        if (attOnScreen()) renderAttendanceScreen();
    }).catch(function (e) {
        attState.busy = false;
        if (e && e.already) { attAlready(sid); return; }
        // create-only rule: a second write for the same player/meeting is refused by the server
        if (e && e.code === 'permission-denied') { attAlready(sid); return; }
        showToast((e && e.msg) || 'حصلت مشكلة في تسجيل الحضور — جرّب تاني', 'error');
        if (!(e && e.msg)) console.warn('[attendance]', e);
    });
}

function attMarkLocal(sid, session, points) {
    if (!GameState.attendanceLog) GameState.attendanceLog = {};
    GameState.attendanceLog[sid] = { date: session ? session.date : getTodayKey(), points: points || 0, at: Date.now() };
    saveToLocalStorage();   // also saves to the cloud
}

function attAlready(sid) {
    showToast('حضورك متسجل في الاجتماع ده قبل كده ✅', 'info');
    attState.sel = sid;
    attState.loadedSel = null;
    if (attOnScreen()) renderAttendanceScreen(); else showScreen('attendance-screen');
}

function attCelebrate(points, session) {
    try { if (typeof playVictorySound === 'function') playVictorySound(); } catch (e) {}
    if (typeof GameUI !== 'undefined' && GameUI.chest) {
        GameUI.chest({ stars: points }, 'حضورك اتسجّل! 🎉', { granted: true });
    } else {
        try { showCelebration('⛪', 'حضورك اتسجّل! +' + points + ' ⭐', '#00B894'); } catch (e) {}
        try { launchConfetti(3000); } catch (e) {}
    }
    try { if (typeof GameUI !== 'undefined') GameUI.refreshCounters(); } catch (e) {}
    showToast('⛪ ربنا يباركك! حضورك في ' + (session.title || 'الاجتماع') + ' اتسجّل · +' + points + ' ⭐', 'success');
}

// Typed 6-digit code (camera not working): match today's active session
function attSubmitCode() {
    var inp = document.getElementById('att-code-input');
    var code = inp ? inp.value.replace(/\D/g, '') : '';
    if (code.length !== 6) { showToast('اكتب الكود المكتوب تحت الـ QR (٦ أرقام)', 'warning'); return; }
    if (!firebaseDb) { showToast('مفيش اتصال بالنت', 'error'); return; }
    firebaseDb.collection('attendanceSessions').where('active', '==', true).get().then(function (snap) {
        var hit = null;
        snap.forEach(function (d) { if (String(d.data().code) === code) hit = d.id; });
        if (!hit) { showToast('الكود ده مش صالح أو قديم ❌', 'error'); return; }
        attRecord(hit, code);
    }).catch(function () { showToast('حصلت مشكلة — جرّب تاني', 'error'); });
}

// ---------- deep link (?att=...) ----------
(function attCaptureLink() {
    try {
        var p = attParse(window.location.href);
        if (!p) return;
        sessionStorage.setItem(ATT_PENDING_KEY, p.sid + '.' + p.code);
        var u = new URL(window.location.href);
        u.searchParams.delete('att');
        window.history.replaceState({}, '', u.pathname + (u.search || ''));
    } catch (e) {}
})();

// Called after login (next to checkPendingRoomJoin)
function attCheckPending() {
    var v = null;
    try { v = sessionStorage.getItem(ATT_PENDING_KEY); } catch (e) {}
    if (!v || !GameState.playerPhone) return;
    try { sessionStorage.removeItem(ATT_PENDING_KEY); } catch (e) {}
    var parts = v.split('.');
    setTimeout(function () {
        showScreen('attendance-screen');
        attRecord(parts[0], parts[1]);
    }, 1200);
}

// ---------- scanner ----------
function attOpenScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('الكاميرا مش متاحة هنا — اكتب الكود اللي تحت الـ QR', 'warning');
        var i = document.getElementById('att-code-input'); if (i) i.focus();
        return;
    }
    attCloseScanner();
    var ov = document.createElement('div');
    ov.className = 'att-scan';
    ov.id = 'att-scan';
    ov.innerHTML = '<div class="att-scan-top"><b>وجّه الكاميرا على الـ QR</b><button class="att-scan-x" onclick="attCloseScanner()" aria-label="إغلاق">✕</button></div>' +
        '<div class="att-scan-view"><video id="att-video" playsinline muted autoplay></video><div class="att-scan-frame"><i></i><i></i><i></i><i></i><span class="att-scan-line"></span></div></div>' +
        '<p class="att-scan-hint" id="att-scan-hint">بنجهّز الكاميرا…</p>';
    document.body.appendChild(ov);
    var video = document.getElementById('att-video');
    var st = attState.scan = { stream: null, raf: 0, done: false, detector: null, canvas: null };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (stream) {
        if (st.done) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        st.stream = stream;
        video.srcObject = stream;
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        var hint = document.getElementById('att-scan-hint');
        if (hint) hint.textContent = 'الكود هيتقري لوحده أول ما يبان كويس 👀';
        attPickDecoder(function (decode) {
            if (st.done) return;
            var tick = function () {
                if (st.done) return;
                decode(video).then(function (txt) {
                    if (st.done) return;
                    var p2 = txt && attParse(txt);
                    if (p2) {
                        st.done = true;
                        try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
                        attCloseScanner();
                        attRecord(p2.sid, p2.code);
                        return;
                    }
                    if (txt) { var h = document.getElementById('att-scan-hint'); if (h) h.textContent = 'ده مش كود حضور مين البطل 🤔'; }
                    st.raf = setTimeout(tick, 220);
                }).catch(function () { st.raf = setTimeout(tick, 400); });
            };
            tick();
        });
    }).catch(function () {
        attCloseScanner();
        showToast('محتاجين إذن الكاميرا — أو اكتب الكود اللي تحت الـ QR', 'warning');
    });
}

// Native BarcodeDetector when available (Android Chrome), else jsQR loaded on demand (iPhone / others)
function attPickDecoder(cb) {
    var st = attState.scan;
    if ('BarcodeDetector' in window) {
        try {
            var det = new window.BarcodeDetector({ formats: ['qr_code'] });
            cb(function (video) {
                return det.detect(video).then(function (codes) { return codes && codes[0] ? codes[0].rawValue : ''; });
            });
            return;
        } catch (e) {}
    }
    attLoadJsQR(function (ok) {
        if (!ok) { showToast('مش قادر أشغّل قارئ الـ QR — اكتب الكود', 'error'); attCloseScanner(); return; }
        st.canvas = document.createElement('canvas');
        var ctx = st.canvas.getContext('2d', { willReadFrequently: true });
        cb(function (video) {
            var w = video.videoWidth, h = video.videoHeight;
            if (!w || !h) return Promise.resolve('');
            var s = Math.min(1, 640 / Math.max(w, h));
            st.canvas.width = Math.round(w * s); st.canvas.height = Math.round(h * s);
            ctx.drawImage(video, 0, 0, st.canvas.width, st.canvas.height);
            var img = ctx.getImageData(0, 0, st.canvas.width, st.canvas.height);
            var r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            return Promise.resolve(r ? r.data : '');
        });
    });
}

function attLoadJsQR(cb) {
    if (window.jsQR) { cb(true); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = function () { cb(!!window.jsQR); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
}

function attCloseScanner() {
    var st = attState.scan;
    if (st) {
        st.done = true;
        clearTimeout(st.raf);
        if (st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); });
        attState.scan = null;
    }
    var ov = document.getElementById('att-scan');
    if (ov) ov.remove();
}

// ---------- screen ----------
function attOnScreen() { var s = document.getElementById('attendance-screen'); return !!(s && s.classList.contains('active')); }

function renderAttendanceScreen() {
    var body = document.getElementById('attendance-body');
    if (!body) return;
    var log = GameState.attendanceLog || {};
    var mine = Object.keys(log), myPts = mine.reduce(function (s, k) { return s + (log[k].points || 0); }, 0);
    var todayDone = mine.some(function (k) { return log[k].date === getTodayKey(); });

    var h = '<div class="att-wrap">';
    h += '<div class="att-hero' + (todayDone ? ' done' : '') + '">';
    h += '<div class="att-hero-ic">' + (todayDone ? '✅' : '⛪') + '</div>';
    h += '<h2>' + (todayDone ? 'حضورك النهارده متسجل!' : 'سجّل حضورك في الاجتماع') + '</h2>';
    h += '<p>' + (todayDone ? 'ربنا يباركك — شوف مين كمان حضر تحت 👇' : 'امسح الـ QR المتعلق في الكنيسة وخد <b>+' + ATT_POINTS_DEFAULT + ' ⭐</b> فوراً') + '</p>';
    if (!todayDone) {
        h += '<button class="att-scan-btn" onclick="attOpenScanner()"><span class="att-scan-ic">📷</span> امسح الـ QR</button>';
        h += '<div class="att-code"><input id="att-code-input" inputmode="numeric" maxlength="6" placeholder="أو اكتب الكود (٦ أرقام)"><button onclick="attSubmitCode()">تأكيد</button></div>';
    }
    h += '</div>';

    h += '<div class="att-stats"><div><b>' + mine.length + '</b><small>اجتماع حضرته</small></div><div><b>' + myPts + ' ⭐</b><small>نقط الحضور</small></div></div>';

    h += '<div class="att-list-card">';
    h += '<div class="att-list-head"><h3>📋 كشف الحضور</h3><span class="att-count" id="att-count"></span></div>';
    h += '<div class="att-filters">';
    h += '<select id="att-sel" onchange="attSetSession(this.value)"><option value="">… بنحمّل الاجتماعات</option></select>';
    h += '<input id="att-q" type="search" placeholder="🔍 دوّر باسم" value="' + attEsc(attState.q) + '" oninput="attState.q=this.value;attRenderList()">';
    h += '<div class="att-chips">' + [[0, 'الكل'], [1, 'المستوى الأول'], [2, 'المستوى الثاني']].map(function (o) {
        return '<button class="' + (attState.lvl === o[0] ? 'on' : '') + '" onclick="attState.lvl=' + o[0] + ';attRenderList();this.parentNode.querySelectorAll(\'button\').forEach(function(b){b.classList.remove(\'on\')});this.classList.add(\'on\')">' + o[1] + '</button>';
    }).join('') + '</div>';
    h += '<select id="att-team" onchange="attState.team=this.value;attRenderList()"><option value="">كل الفرق</option></select>';
    h += '</div>';
    h += '<div class="att-list" id="att-list"><div class="att-empty">⏳ بنحمّل…</div></div>';
    h += '</div></div>';
    body.innerHTML = h;
    attLoadSessions();
}

function attLoadSessions() {
    if (!firebaseDb) { attRenderList(); return; }
    firebaseDb.collection('attendanceSessions').orderBy('date', 'desc').limit(30).get().then(function (snap) {
        var arr = [];
        snap.forEach(function (d) { var v = d.data(); v._id = d.id; arr.push(v); });
        attState.sessions = arr;
        if (!attState.sel || !arr.some(function (s) { return s._id === attState.sel; })) attState.sel = arr.length ? arr[0]._id : '';
        var sel = document.getElementById('att-sel');
        if (sel) {
            sel.innerHTML = arr.length ? arr.map(function (s) {
                return '<option value="' + s._id + '"' + (s._id === attState.sel ? ' selected' : '') + '>' + attDateLabel(s.date) + ' — ' + attEsc(s.title || 'اجتماع') + (s.active ? ' 🟢' : '') + '</option>';
            }).join('') : '<option value="">لسه مفيش اجتماعات</option>';
        }
        attLoadRecords();
    }).catch(function (e) { console.warn('[attendance] sessions', e); attRenderList(); });
}

function attSetSession(sid) { attState.sel = sid; attState.team = ''; attLoadRecords(); }

function attLoadRecords() {
    if (!attState.sel || !firebaseDb) { attState.records = []; attRenderList(); return; }
    var sid = attState.sel;
    firebaseDb.collection('attendance').where('sessionId', '==', sid).get().then(function (snap) {
        if (sid !== attState.sel) return;
        var arr = [];
        snap.forEach(function (d) { arr.push(d.data()); });
        arr.sort(function (a, b) { return (a.atMs || 0) - (b.atMs || 0); });
        attState.records = arr;
        var teams = {};
        arr.forEach(function (r) { if (r.team) teams[r.team] = 1; });
        var ts = document.getElementById('att-team');
        if (ts) ts.innerHTML = '<option value="">كل الفرق</option>' + Object.keys(teams).sort().map(function (t) {
            return '<option' + (t === attState.team ? ' selected' : '') + '>' + attEsc(t) + '</option>';
        }).join('');
        attRenderList();
    }).catch(function (e) { console.warn('[attendance] records', e); attRenderList(); });
}

function attRenderList() {
    var el = document.getElementById('att-list');
    if (!el) return;
    var q = (attState.q || '').trim().toLowerCase();
    var rows = attState.records.filter(function (r) {
        var lvl = r.teamLevel || r.playerLevel || 0;
        return (!q || String(r.name || '').toLowerCase().indexOf(q) >= 0) &&
            (!attState.lvl || lvl === attState.lvl) &&
            (!attState.team || r.team === attState.team);
    });
    var cnt = document.getElementById('att-count');
    if (cnt) cnt.textContent = attState.records.length ? ('حضر ' + attState.records.length + (rows.length !== attState.records.length ? ' · ظاهر ' + rows.length : '')) : '';
    if (!attState.sessions.length) { el.innerHTML = '<div class="att-empty">لسه مفيش اجتماعات متسجلة</div>'; return; }
    if (!rows.length) { el.innerHTML = '<div class="att-empty">' + (attState.records.length ? 'مفيش نتايج للبحث ده' : 'لسه محدش سجّل في الاجتماع ده — كن الأول! 🏃') + '</div>'; return; }
    el.innerHTML = rows.map(function (r, i) {
        var ch = (typeof CHARACTERS !== 'undefined' && CHARACTERS[r.character]) || null;
        var me = r.phone === GameState.playerPhone;
        var lvl = r.teamLevel || r.playerLevel || 0;
        return '<div class="att-row' + (me ? ' me' : '') + '">' +
            '<span class="att-n">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1)) + '</span>' +
            (ch ? '<img class="att-av" src="' + ch.image + '" alt="">' : '<span class="att-av">👤</span>') +
            '<div class="att-who"><b>' + attEsc(r.name || 'لاعب') + (me ? ' (إنت)' : '') + '</b><small>' + (r.team ? attEsc(r.team) + ' · ' : '') + (lvl ? (lvl === 1 ? 'المستوى الأول' : 'المستوى الثاني') : '') + '</small></div>' +
            '<span class="att-t">' + attTimeLabel(r.atMs) + '</span></div>';
    }).join('');
}
