/* Meeting game: audience (projector) window.
   A dumb renderer: draws the View the control window sends over BroadcastChannel and plays fx
   (award pop, team flash, reveal, wheel, name pick, bet, golden intro, podium) with Web Audio and
   canvas confetti. Never touches Firestore. Uses MT_KINDS (meeting-core.js) for segment labels. */

var MS_CHANNEL = 'meb-meeting';
var MS_HELLO_MS = 3000;
var MS_FIXED_TEXT = 'واحد من الفريق ييجي يشوف الكلمة على اللابتوب 👀';
var MS_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
var MS_SEGMENT_ICON = { act: '🎭', draw: '🎨', taboo: '🤐' };
var MS_RING_C = 282.74; /* 2 * PI * 45, the ring circle in meeting.html */

var _ms = {
    ch: null, gotView: false, helloTimer: 0,
    view: null, itemSig: '', stage: null, stageKey: '',
    nOpts: 0, nClues: 0, count: 0, scores: {},
    lastTick: -1, timeoutFor: 0,
    muted: false, sfxAt: {},
    fxGen: 0, fxTimers: [], fxActive: false, fxFull: '', fxFullView: '',
    boardKey: '', boardOn: false, lastAwardId: undefined
};
var MS_BOARD_HOLD_MS = 6000;   /* after an award the panel stays on the recipients this long */
var MS_BOARD_PAUSE_MS = 3500;  /* auto-scroll pause at the top and at the bottom */
var MS_BOARD_ROWS_PER_S = 0.7; /* auto-scroll speed */

/* ---------- helpers ---------- */

function _msEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Arabic-Indic digits; negative numbers get a real minus sign. */
function _msNum(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); });
    return (n < 0 ? '−' : '') + s;
}

function _msPts(n) {
    n = Number(n) || 0;
    return (n < 0 ? '−' : '+') + _msNum(Math.abs(n));
}

function _msEl(id) { return document.getElementById(id); }

function _msTeamByName(name) {
    var teams = (_ms.view && _ms.view.teams) || [];
    for (var i = 0; i < teams.length; i++) if (teams[i].name === name) return teams[i];
    return null;
}

function _msLevelLabel(level) {
    if (level === 1) return 'مستوى أول';
    if (level === 2) return 'مستوى تاني';
    if (level === 'all') return 'الكل';
    return '';
}

/* Identifies an item across views so the screen can tell "same item, next step" from "new item". */
function _msItemSig(it) {
    if (!it) return '';
    return it.kind + '|' + (it.prompt || it.firstLine || it.scrambled || (it.items || []).join('،') || (it.clues || [])[0] || '');
}

/* ---------- boot + channel ---------- */

function msBoot() {
    _msRenderIdle(null);
    _msInitFullscreen();
    _msInitCursor();
    setInterval(_msTimerTick, 200);
    setInterval(_msBoardScrollTick, 40);
    window.addEventListener('resize', _msFit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(_msFit);
    if (typeof BroadcastChannel === 'undefined') {
        _msRenderIdle(null, 'المتصفح ده مش بيدعم ربط الشاشتين، افتحها من Chrome');
        return;
    }
    _ms.ch = new BroadcastChannel(MS_CHANNEL);
    _ms.ch.onmessage = function (e) {
        var m = e.data;
        if (!m || typeof m !== 'object') return;
        if (m.t === 'view') {
            if (!_ms.gotView) { _ms.gotView = true; clearInterval(_ms.helloTimer); }
            msRender(m.view);
        } else if (m.t === 'fx') {
            msFx(m.fx);
        }
    };
    _msHello();
    _ms.helloTimer = setInterval(function () {
        if (_ms.gotView) clearInterval(_ms.helloTimer);
        else _msHello();
    }, MS_HELLO_MS);
}

function _msHello() {
    try { _ms.ch.postMessage({ t: 'hello' }); } catch (e) { /* channel closed */ }
}

/* ---------- view rendering ---------- */

function msRender(view) {
    view = view || {};
    var it = view.item || null;
    var stage = it ? view.stage : null;
    var sig = _msItemSig(it);
    var revealed = stage === 'revealed';
    var isNew = !!it && (sig !== _ms.itemSig || (stage === 'shown' && _ms.stage !== 'shown'));
    var justRevealed = !!it && revealed && !isNew && _ms.stage !== 'revealed';
    var prev = { opts: _ms.nOpts, clues: _ms.nClues, count: _ms.count };
    if (isNew || !it) prev = { opts: 0, clues: 0, count: 0 };

    /* The host moved to another item (or back to idle): drop whatever fx is still playing.
       The full-screen board stays only until the next view that changes anything. */
    if (_ms.fxActive && (sig !== _ms.itemSig || (_ms.fxFull === 'board' && JSON.stringify(view) !== _ms.fxFullView))) _msFxClear();

    _ms.view = view;
    _msRenderTags(view, it);
    _msRenderTeams(view);
    var boardToggled = _msRenderBoard(view);

    var stageKey = JSON.stringify([it, it ? stage : view.stage, !!view.golden, it ? '' : (view.title || '')]);
    if (stageKey !== _ms.stageKey) {
        _ms.stageKey = stageKey;
        var box = _msEl('ms-stage');
        box.classList.toggle('golden', !!(it && view.golden));
        if (!it) {
            _msRenderIdle(view);
        } else {
            _msEl('ms-item').innerHTML = _msItemHtml(it, revealed, { isNew: isNew, prev: prev });
            if (isNew || justRevealed) { box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
        }
        _msFit();
    } else if (boardToggled) {
        _msFit(); /* the stage got narrower or wider */
    }

    var nOpts = it && it.options ? it.options.length : 0;
    var nClues = it && it.clues ? it.clues.length : 0;
    var count = it && typeof it.count === 'number' ? it.count : 0;
    if (isNew) _msSfx(view.golden ? 'golden' : 'appear');
    else if (justRevealed) _msSfx('reveal');
    else if (it && !revealed && nOpts > prev.opts) _msSfx('pop');
    else if (it && !revealed && nClues > prev.clues) _msSfx('clue');
    else if (it && count > prev.count) _msSfx('count');

    _ms.itemSig = sig;
    _ms.stage = stage;
    _ms.nOpts = nOpts;
    _ms.nClues = nClues;
    _ms.count = count;
    _msTimerTick();
}

function _msRenderIdle(view, note) {
    var title = (view && view.title) || 'مسابقة الاجتماع';
    var sub;
    if (note) sub = '<p>' + _msEsc(note) + '</p>';
    else if (!view) sub = '<p>مستنيين شاشة التحكم…</p>';
    else if (view.stage === 'preview') sub = '<p class="ready">⏳ استعدوا… السؤال جاي!</p>';
    else sub = '<p>⭐ كل نقطة بتتحسب نجوم في حسابك ⭐</p>';
    _msEl('ms-item').innerHTML = '<div class="ms-idle"><div class="ico">🏆</div><h1>' + _msEsc(title) + '</h1>' + sub + '</div>';
}

function _msRenderTags(view, it) {
    var h = '';
    if (it) {
        var kind = (typeof MT_KINDS !== 'undefined' && MT_KINDS[it.kind]) ? MT_KINDS[it.kind].label : '';
        var t = view.target || {};
        var lvl = _msLevelLabel(t.level);
        h += '<span class="ms-tag">' + _msEsc(kind) + (lvl ? ' · <span class="lvl">' + _msEsc(lvl) + '</span>' : '') + '</span>';
        if (view.golden) h += '<span class="ms-tag gold">🏅 السؤال الدهبي · ×٣</span>';
        if (t.mode === 'speed') h += '<span class="ms-tag mode">⚡ سؤال سرعة</span>';
        if (t.mode === 'team' && t.teamId) {
            var teams = view.teams || [];
            for (var i = 0; i < teams.length; i++) {
                if (teams[i].id !== t.teamId) continue;
                h += '<span class="ms-tag mode" style="--tc:' + _msEsc(teams[i].color) + '"><span class="dot"></span>دور ' + _msEsc(teams[i].name) + '</span>';
            }
        }
    }
    var el = _msEl('ms-tags');
    if (el.innerHTML !== h) el.innerHTML = h;
}

function _msRenderTeams(view) {
    var teams = view.teams || [];
    var h = '', deltas = [];
    teams.forEach(function (t) {
        var old = _ms.scores[t.id];
        var d = old === undefined ? 0 : t.score - old;
        if (d) deltas.push(t.id);
        h += '<div class="ms-team' + (t.id === view.leaderId ? ' lead' : '') + '" style="--tc:' + _msEsc(t.color) + '">' +
            (t.id === view.leaderId ? '<div class="crown">👑</div>' : '') +
            (d ? '<div class="delta' + (d < 0 ? ' neg' : '') + '">' + _msPts(d) + '</div>' : '') +
            '<div class="ico">' + _msEsc(t.icon || '🛡️') + '</div>' +
            '<div class="tx"><div class="nm">' + _msEsc(String(t.name || '').replace(/^فريق\s+/, '')) + '</div>' +
            '<div class="sc' + (d ? ' bump' : '') + '">' + _msNum(t.score) + '</div></div></div>';
    });
    var el = _msEl('ms-teams');
    /* Rebuild only on change so the crown and bump animations do not restart on timer-only views. */
    var key = JSON.stringify([teams, view.leaderId]);
    if (el.getAttribute('data-k') !== key) {
        el.setAttribute('data-k', key);
        el.innerHTML = h;
    }
    _ms.scores = {};
    teams.forEach(function (t) { _ms.scores[t.id] = t.score; });
}

function _msItemHtml(it, rev, a) {
    var k = it.kind, h = '';
    var inCls = a.isNew ? ' in' : '';
    switch (k) {
        case 'mcq': case 'scenario': case 'verse':
            h += '<div class="ms-prompt' + inCls + '">' + _msEsc(it.prompt) + '</div>';
            h += _msOptionsHtml(it, rev, a);
            break;
        case 'tf':
            h += '<div class="ms-prompt' + inCls + '">' + _msEsc(it.prompt) + '</div>';
            if (!rev) {
                h += '<div class="ms-tf">قوم لو صح 🧍 · اقعد لو غلط 🪑</div>';
            } else {
                var yes = /^صح/.test(String(it.answer || ''));
                h += '<div class="ms-tf-res ' + (yes ? 'yes' : 'no') + '">' + (yes ? '✅ صح' : '❌ غلط') +
                    '<small>' + (yes ? 'اللي قاموا كسبوا 🧍' : 'اللي قعدوا كسبوا 🪑') + '</small></div>';
            }
            break;
        case 'clues':
            h += '<div class="ms-clues">';
            (it.clues || []).forEach(function (c, i, arr) {
                var last = i === arr.length - 1;
                h += '<div class="ms-clue' + (last ? ' last' : '') + (i >= a.prev.clues ? ' in' : '') + '">' +
                    '<span class="ms-clue-n">' + _msNum(i + 1) + '</span><span class="t">' + _msEsc(c) + '</span></div>';
            });
            h += '</div>';
            if (!rev) h += '<div class="ms-hint">🤔 مين أنا؟ ارفع إيدك لو عرفت!</div>';
            break;
        case 'order':
            h += '<div class="ms-prompt' + inCls + '">' + _msEsc(it.prompt) + '</div>';
            h += '<div class="ms-cards">';
            (it.steps || []).forEach(function (s, i) {
                var lbl = rev ? _msNum(i + 1) : (MS_LETTERS[i] || _msNum(i + 1));
                h += '<div class="ms-card' + (rev ? ' ord in' : inCls) + '" style="animation-delay:' + (i * (rev ? 220 : 90)) + 'ms">' +
                    '<span class="ms-letter">' + lbl + '</span><span class="t">' + _msEsc(s) + '</span></div>';
            });
            h += '</div>';
            break;
        case 'emoji':
            h += '<div class="ms-prompt ms-emoji' + inCls + '">' + _msEsc(it.prompt) + '</div>';
            if (!rev) h += '<div class="ms-hint big">🤔 القصة دي إيه؟</div>';
            break;
        case 'deep':
            h += '<div class="ms-prompt' + inCls + '">' + _msEsc(it.prompt) + '</div>';
            if (!rev) h += '<div class="ms-hint">💭 مفيش إجابة واحدة… فكّر وقول رأيك</div>';
            break;
        case 'anagram':
            h += _msTilesHtml(rev && it.answer ? String(it.answer) : String(it.scrambled || ''), rev, a.isNew);
            if (it.hint) h += '<div class="ms-hint big">💡 ' + _msEsc(it.hint) + '</div>';
            break;
        case 'odd':
            h += '<div class="ms-cards ms-odd">';
            (it.items || []).forEach(function (x, i) {
                var cls = rev ? (i === it.odd ? ' odd' : ' dim') : inCls;
                h += '<div class="ms-card' + cls + '" style="animation-delay:' + (i * 90) + 'ms"><span class="t">' + _msEsc(x) + '</span></div>';
            });
            h += '</div>';
            if (!rev) h += '<div class="ms-hint">🔍 مين فيهم مالوش مكان هنا؟</div>';
            break;
        case 'sixty':
            var counter = '<div class="ms-counter' + ((it.count || 0) > a.prev.count ? ' bump' : '') + '"><b>' + _msNum(it.count || 0) + '</b><span>إجابة صح</span></div>';
            var prompt = '<div class="ms-prompt' + inCls + '">' + _msEsc(it.prompt) + '</div>';
            /* after the reveal the list needs the room: counter and question share one row */
            h += rev ? '<div class="ms-row">' + counter + prompt + '</div>' : prompt + counter;
            if (rev && it.list && it.list.length) {
                h += '<div class="ms-list">';
                it.list.forEach(function (x, i) { h += '<span class="ms-chip" style="animation-delay:' + (i * 40) + 'ms">' + _msEsc(x) + '</span>'; });
                h += '</div>';
            }
            break;
        case 'hymn':
            h += '<div class="ms-hymn ms-prompt' + inCls + '"><span class="note">🎶</span> ' + _msEsc(it.firstLine) + ' …</div>';
            if (!rev) h += '<div class="ms-hint big">🎤 كمّلوا!</div>';
            break;
        default: /* act / draw / taboo: fixed segment text, the secret stays on the laptop */
            h += '<div class="ms-big-ico">' + (MS_SEGMENT_ICON[k] || '🎲') + '</div>';
            h += '<div class="ms-seg-name">' + _msEsc(MT_KINDS[k] ? MT_KINDS[k].label : '') + '</div>';
            if (!rev) h += '<div class="ms-hint big">' + _msEsc(MS_FIXED_TEXT) + '</div>';
            break;
    }
    if (rev) h += _msAnswerHtml(it);
    return h;
}

function _msOptionsHtml(it, rev, a) {
    var opts = it.options || [];
    if (!opts.length) return '';
    var h = '<div class="ms-opts">';
    opts.forEach(function (o, i) {
        var cls = '';
        if (rev) cls = i === it.correct ? ' right' : ' dim';
        else if (i >= a.prev.opts) cls = ' in';
        h += '<div class="ms-opt' + cls + '"><span class="ms-letter">' + (MS_LETTERS[i] || _msNum(i + 1)) + '</span>' +
            '<span class="t">' + _msEsc(o) + '</span>' + (rev && i === it.correct ? '<span>✅</span>' : '') + '</div>';
    });
    return h + '</div>';
}

function _msTilesHtml(word, rev, animate) {
    var letters = word.split('');
    var n = letters.length || 1;
    var tw = Math.min(8, 86 / n); /* tile width in vw: big, but the whole word fits on one line */
    var h = '<div class="ms-tiles" style="--tw:' + tw.toFixed(2) + 'vw">';
    letters.forEach(function (ch, i) {
        if (/\s/.test(ch)) { h += '<span class="ms-tile gap"></span>'; return; }
        var cls = rev ? ' ok' : (animate ? ' in' : '');
        h += '<span class="ms-tile' + cls + '" style="animation-delay:' + (i * 70) + 'ms">' + _msEsc(ch) + '</span>';
    });
    return h + '</div>';
}

/* Kinds whose solution is already highlighted in place do not need a separate answer box. */
function _msAnswerHtml(it) {
    var k = it.kind, h = '';
    var inPlace = { mcq: 1, scenario: 1, verse: 1, tf: 1, order: 1, odd: 1, anagram: 1 };
    var skipAnswer = inPlace[k] || (k === 'sixty' && it.list && it.list.length);
    if (!skipAnswer && it.answer !== undefined && it.answer !== '') {
        var lbl = (k === 'act' || k === 'draw' || k === 'taboo') ? '🎯 الكلمة كانت' : (k === 'hymn' ? '🎶 التكملة' : '✨ الإجابة');
        h += '<div class="ms-answer"><div class="lbl">' + lbl + '</div><div class="t">' + _msEsc(it.answer) + '</div></div>';
    }
    if (it.explain) h += '<div class="ms-explain">📖 ' + _msEsc(it.explain) + '</div>';
    return h;
}

/* Shrink the item until it fits the stage (--pk scales the main text, --ok the options/answer/explain).
   While the question is up, the main text keeps at least 5vw (--pk 0.79 of 6.4vw) and goes below that
   only if the item still does not fit, so nothing is ever clipped. After the reveal the answer matters
   most, so the question shrinks first and the answer and explain keep their size longer. */
function _msFit() {
    var box = _msEl('ms-stage'), inner = _msEl('ms-item');
    if (!box || !inner) return;
    var cs = getComputedStyle(box);
    var avail = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var rev = _ms.view && _ms.view.stage === 'revealed';
    var floor1 = rev ? { pk: 0.6, ok: 1 } : { pk: 0.79, ok: 0.6 };
    var pk = 1, ok = 1, guard = 0;
    box.classList.remove('tight');
    box.style.setProperty('--pk', pk);
    box.style.setProperty('--ok', ok);
    /* offsetHeight, not scrollHeight: entrance animations translate children and would inflate it */
    while (inner.offsetHeight > avail && guard++ < 80) {
        if (pk > floor1.pk || ok > floor1.ok) { pk = Math.max(floor1.pk, pk - 0.03); ok = Math.max(floor1.ok, ok - 0.04); }
        else if (pk > 0.45 || ok > 0.5) { pk = Math.max(0.45, pk - 0.03); ok = Math.max(0.5, ok - 0.03); }
        else { box.classList.add('tight'); break; } /* still too tall: keep the top visible */
        box.style.setProperty('--pk', pk.toFixed(3));
        box.style.setProperty('--ok', ok.toFixed(3));
    }
}

/* ---------- timer ring ---------- */

function _msTimerTick() {
    var ring = _msEl('ms-ring');
    if (!ring) return;
    var v = _ms.view;
    var on = !!(v && v.item && v.stage === 'shown' && v.timerEndsAt > 0);
    ring.classList.toggle('on', on);
    if (!on) { ring.classList.remove('urgent', 'done'); _ms.lastTick = -1; return; }
    var left = Math.max(0, v.timerEndsAt - Date.now());
    var total = Math.max(1000, (v.timerSec || 0) * 1000, left);
    var sec = Math.ceil(left / 1000);
    ring.querySelector('.fg').setAttribute('stroke-dashoffset', (MS_RING_C * (1 - left / total)).toFixed(2));
    var num = ring.querySelector('.num');
    var done = left <= 0;
    var txt = done ? '⏰' : _msNum(sec);
    if (num.textContent !== txt) num.textContent = txt;
    ring.classList.toggle('urgent', !done && sec <= 5);
    ring.classList.toggle('done', done);
    if (!done && sec <= 5 && sec !== _ms.lastTick) {
        _ms.lastTick = sec;
        _msSfx(sec <= 3 ? 'tickUrgent' : 'tick');
    }
    if (done && _ms.timeoutFor !== v.timerEndsAt) {
        _ms.timeoutFor = v.timerEndsAt;
        _msSfx('timeout');
    }
}

/* ---------- fx ---------- */

function msFx(fx) {
    if (!fx || !fx.type) return;
    if (fx.type === 'sound') { _ms.muted = fx.on === false; return; }
    var fn = _MS_FX[fx.type];
    if (!fn) return;
    _msFxClear();
    _ms.fxActive = true;
    var el = _msEl('ms-fx');
    el.className = 'on';
    fn(fx, el);
}

function _msFxClear() {
    _ms.fxGen++;
    _ms.fxTimers.forEach(clearTimeout);
    _ms.fxTimers = [];
    _ms.fxActive = false;
    _ms.fxFull = '';
    _msEl('ms-root').classList.remove('fxfull');
    var el = _msEl('ms-fx');
    el.className = '';
    el.innerHTML = '';
    el.removeAttribute('style');
    _msConfettiStop();
}

/* setTimeout that dies with the fx it belongs to. */
function _msLater(fn, ms) {
    var g = _ms.fxGen;
    _ms.fxTimers.push(setTimeout(function () { if (g === _ms.fxGen) fn(); }, ms));
}

function _msFxEndAfter(ms) {
    _msLater(function () {
        _msEl('ms-fx').classList.add('out');
        _msLater(_msFxClear, 400);
    }, ms);
}

var _MS_FX = {
    award: function (fx, el) {
        var neg = (Number(fx.points) || 0) < 0;
        var tc = fx.teamColor || '#6C5CE7';
        el.style.setProperty('--tc', tc);
        el.innerHTML = '<div class="fx-dim"></div><div class="fx-burst"></div>' +
            '<div class="fx-card"><div class="fx-name">' + _msEsc(fx.name) + '</div>' +
            '<div class="fx-pts' + (neg ? ' neg' : '') + '">⭐ ' + _msPts(fx.points) + '</div>' +
            (fx.teamName ? '<div class="fx-team-chip">' + _msEsc(fx.teamName) + '</div>' : '') + '</div>';
        if (neg) { _msSfx('wrong'); }
        else {
            _msSfx('correct');
            /* from both sides, so the name and the points in the middle stay clear */
            _msConfetti(60, 1600, [tc, '#FFD700', '#ffffff'], innerWidth * 0.1);
            _msConfetti(60, 1600, [tc, '#FFD700', '#ffffff'], innerWidth * 0.9);
        }
        _msFxEndAfter(2100);
    },
    teamAward: function (fx, el) {
        var tc = fx.teamColor || '#6C5CE7';
        var t = _msTeamByName(fx.teamName);
        el.style.setProperty('--tc', tc);
        el.innerHTML = '<div class="fx-band"></div><div class="fx-col">' +
            '<div class="fx-team-ico">' + _msEsc((t && t.icon) || '🛡️') + '</div>' +
            '<div class="fx-team-name">' + _msEsc(fx.teamName) + '</div>' +
            '<div class="fx-pts' + ((Number(fx.points) || 0) < 0 ? ' neg' : '') + '">⭐ ' + _msPts(fx.points) + '</div>' +
            '<div class="fx-sub">لكل الفريق! 🎉</div></div>';
        if ((Number(fx.points) || 0) < 0) _msSfx('wrong');
        else { _msSfx('team'); _msConfetti(160, 1800, [tc, '#FFD700', '#ffffff']); }
        _msFxEndAfter(2300);
    },
    reveal: function (fx, el) {
        el.innerHTML = '<div class="fx-flash"></div>';
        _msSfx('reveal');
        _msLater(_msFxClear, 950);
    },
    wheel: function (fx, el) {
        var outs = fx.outcomes || [];
        if (!outs.length) { _msFxClear(); return; }
        var idx = Math.max(0, Math.min(outs.length - 1, Math.floor(Number(fx.index) || 0)));
        el.innerHTML = '<div class="fx-dim"></div><div class="fx-col">' +
            _msTitle('🎡', 'عجلة الحظ') +
            '<div class="fx-wheel-row">' + _msWheelHtml(outs) + '</div></div>';
        _msSfx('whoosh');
        _msSpin(el.querySelector('.fx-wheel'), outs.length, idx, 3400, function () {
            var row = el.querySelector('.fx-wheel-row');
            row.insertAdjacentHTML('beforeend', '<div class="fx-result-wrap"><div class="fx-result">' + _msEsc(outs[idx]) + '</div></div>');
            _msSfx('fanfare');
            _msConfetti(140, 1500);
            _msFxEndAfter(3600);
        });
    },
    pick: function (fx, el) {
        var names = (fx.names || []).filter(function (x) { return x; });
        if (!names.length) { _msFxClear(); return; }
        var idx = Math.max(0, Math.min(names.length - 1, Math.floor(Number(fx.index) || 0)));
        el.innerHTML = '<div class="fx-dim"></div><div class="fx-col">' +
            _msTitle('🎲', 'مين هيجاوب؟') +
            '<div class="fx-reel"><div class="fx-reel-name"></div></div></div>';
        var reel = el.querySelector('.fx-reel'), nameEl = el.querySelector('.fx-reel-name');
        var steps = 26, t = 0, last = -1;
        for (var i = 0; i < steps; i++) {
            var final = i === steps - 1;
            var pickI = final ? idx : Math.floor(Math.random() * names.length);
            if (!final && names.length > 1 && pickI === last) pickI = (pickI + 1) % names.length;
            last = pickI;
            t += 50 + 300 * Math.pow(i / steps, 3);
            (function (name, isFinal, at) {
                _msLater(function () {
                    nameEl.textContent = name;
                    nameEl.classList.remove('roll'); void nameEl.offsetWidth;
                    if (isFinal) {
                        reel.classList.add('landed');
                        _msSfx('fanfare');
                        _msConfetti(120, 1500);
                    } else {
                        nameEl.classList.add('roll');
                        _msSfx('wheelTick');
                    }
                }, at);
            })(names[pickI], final, t);
        }
        _msFxEndAfter(t + 5000);
    },
    bet: function (fx, el) {
        var t = _msTeamByName(fx.teamName);
        var amt = Number(fx.amount) || 0;
        el.style.setProperty('--tc', (t && t.color) || '#6C5CE7');
        el.innerHTML = '<div class="fx-dim"></div><div class="fx-col">' +
            _msTitle('🎰', 'الرهان!') +
            '<div class="fx-team-chip">' + _msEsc((t && t.icon) || '🛡️') + ' ' + _msEsc(fx.teamName) + '</div>' +
            '<div class="fx-sub">راهنوا بـ</div><div class="fx-bet-amt">' + _msNum(amt) + '</div>' +
            '<div class="fx-rules"><span class="w">صح: ' + _msPts(amt) + ' 💰</span><span class="l">غلط: ' + _msPts(-amt) + ' 😬</span></div></div>';
        _msSfx('suspense');
        _msFxEndAfter(4200);
    },
    golden: function (fx, el) {
        el.innerHTML = '<div class="fx-dim"></div><div class="fx-rays"></div><div class="fx-col">' +
            '<div class="fx-medal">🏅</div>' + _msTitle('', 'السؤال الدهبي') +
            '<div class="fx-sub">⭐ ١٥ نجمة بدل ٥!</div></div>';
        _msSfx('golden');
        _msConfetti(150, 2000, ['#FFD700', '#FFE875', '#D4A017', '#ffffff']);
        _msFxEndAfter(3400);
    },
    board: function (fx, el) {
        _msFxFull('board');
        var kids = (_ms.view && _ms.view.kids) || {};
        var h = '<div class="fx-dim solid"></div><div class="fx-board"><div class="fxb-title"><span>🏅</span><span class="g">أوائل مسابقة النهارده</span></div><div class="fxb-levels">';
        Object.keys(kids).forEach(function (lvl) {
            h += '<div class="fxb-lvl"><div class="fxb-h">' + _msEsc(_msLevelLabel(+lvl)) + '</div>';
            if (!kids[lvl].length) h += '<div class="fxb-empty">لسه مفيش ولاد</div>';
            else h += '<div class="fxb-list">' + kids[lvl].map(function (k, i) { return _msBoardRowHtml(k, i, i * 25); }).join('') + '</div>';
            h += '</div>';
        });
        el.innerHTML = h + '</div></div>';
        _msBoardFxLayout(el);
        _msSfx('reveal');
        /* stays until the next view that changes something, or the next fx */
    },
    podium: function (fx, el) {
        _msFxFull('podium');
        var kids = (fx.kids || []).slice(0, 3);
        var order = [1, 0, 2]; /* RTL: 2nd on the right, 1st in the middle, 3rd on the left */
        var medals = ['🥇', '🥈', '🥉'];
        var h = '<div class="fx-dim"></div><div class="fx-rays"></div><div class="fx-col">' +
            _msTitle('🏆', 'أبطال الليلة') + '<div class="fx-podium">';
        order.forEach(function (r) {
            var k = kids[r];
            if (!k) return;
            h += '<div class="fx-step s' + (r + 1) + '"><div class="md">' + medals[r] + '</div>' +
                '<div class="nm">' + _msEsc(k.name) + '</div><div class="st">⭐ ' + _msNum(k.stars) + '</div>' +
                '<div class="base">' + _msNum(r + 1) + '</div></div>';
        });
        h += '</div>';
        if (fx.team && fx.team.name) {
            var t = _msTeamByName(fx.team.name);
            h += '<div class="fx-win-team" style="--tc:' + _msEsc(fx.team.color || (t && t.color) || '#6C5CE7') + '">👑 ' +
                _msEsc((t && t.icon) || '') + ' ' + _msEsc(fx.team.name) + ' · ' + _msNum(fx.team.score) + ' نقطة</div>';
        }
        el.innerHTML = h + '</div>';
        _msSfx('fanfare');
        _msConfetti(220, 3000);
        _msLater(function () { _msConfetti(180, 2500, null, innerWidth * 0.25); }, 1200);
        _msLater(function () { _msConfetti(180, 2500, null, innerWidth * 0.75); _msSfx('fanfare'); }, 2400);
        /* The podium stays until the next fx or a new item. */
    }
};

/* Podium and the full-screen board cover everything: the side panel hides behind them. */
function _msFxFull(kind) {
    _ms.fxFull = kind;
    _ms.fxFullView = JSON.stringify(_ms.view);
    _msEl('ms-root').classList.add('fxfull');
}

/* Lay the full-screen board out in columns: as many rows per column as fit the height, each level
   as wide as its column count. Shrinks the rows (--bk) while a column would be too narrow for a name
   (under 17vw), so fewer, wider columns hold the whole list. */
function _msBoardFxLayout(el) {
    var board = el.querySelector('.fx-board');
    var lvls = el.querySelectorAll('.fxb-lvl');
    for (var scale = 1; scale >= 0.5; scale -= 0.07) {
        board.style.setProperty('--bk', scale.toFixed(2));
        var ok = true;
        for (var i = 0; i < lvls.length; i++) {
            var list = lvls[i].querySelector('.fxb-list');
            if (!list) { lvls[i].style.flexGrow = 1; continue; }
            var rows = list.children, gap = parseFloat(getComputedStyle(list).rowGap) || 0;
            var rowH = rows[0].offsetHeight;
            var perCol = Math.max(1, Math.floor((list.clientHeight + gap) / (rowH + gap)));
            var cols = Math.ceil(rows.length / perCol);
            list.style.gridTemplateRows = 'repeat(' + perCol + ', ' + rowH + 'px)';
            lvls[i].style.flexGrow = cols;
        }
        for (i = 0; i < lvls.length; i++) {
            var l = lvls[i].querySelector('.fxb-list');
            if (l && l.clientWidth / (parseFloat(lvls[i].style.flexGrow) || 1) < innerWidth * 0.17) ok = false;
        }
        if (ok) return;
    }
}

/* ---------- individual board (side panel) ---------- */

function _msRankHtml(k, i) {
    if (k.stars > 0 && i < 3) return ['🥇', '🥈', '🥉'][i];
    return _msNum(i + 1);
}

function _msBoardRowHtml(k, i, delay) {
    var cls = 'mb-row' + (k.stars > 0 && i < 3 ? ' r' + (i + 1) : '') + (k.stars > 0 ? '' : ' zero');
    return '<div class="' + cls + '"' + (delay !== undefined ? ' style="animation-delay:' + delay + 'ms"' : '') + '>' + _msRowInner(k, i) + '</div>';
}

function _msRowInner(k, i) {
    return '<span class="mb-rk">' + _msRankHtml(k, i) + '</span>' +
        '<span class="mb-dot"' + (k.teamColor ? ' style="--tc:' + _msEsc(k.teamColor) + '"' : '') + '></span>' +
        '<span class="mb-nm">' + _msEsc(k.name) + '</span>' +
        '<span class="mb-st">' + _msNum(k.stars) + ' ⭐</span>';
}

/* Returns true when the panel was shown or hidden (the stage width changed). */
function _msRenderBoard(view) {
    var kids = view.kids || {};
    var levels = Object.keys(kids);
    var total = 0;
    levels.forEach(function (l) { total += kids[l].length; });
    var on = total > 0;
    var toggled = on !== _ms.boardOn;
    _ms.boardOn = on;
    _msEl('ms').classList.toggle('board', on);

    var la = view.lastAward || null;
    var newAward = !!la && _ms.lastAwardId !== undefined && la.id !== _ms.lastAwardId;
    _ms.lastAwardId = la ? la.id : null;
    var key = JSON.stringify(kids);
    if (key === _ms.boardKey && !newAward) return toggled;
    _ms.boardKey = key;

    var secs = _msEl('mb-secs');
    if (secs.getAttribute('data-l') !== levels.join(',')) {
        secs.setAttribute('data-l', levels.join(','));
        secs.innerHTML = levels.map(function (l) {
            return '<section class="mb-sec" data-l="' + l + '"><div class="mb-h">' + _msEsc(_msLevelLabel(+l)) +
                '</div><div class="mb-vp"><div class="mb-list"></div></div></section>';
        }).join('');
    }
    var hits = {};
    if (newAward) la.keys.forEach(function (k) { hits[k] = true; });
    levels.forEach(function (l) {
        _msBoardSection(secs.querySelector('.mb-sec[data-l="' + l + '"]'), kids[l], hits, newAward);
    });
    return toggled;
}

/* Update one level's rows in place, keyed by kid key, with a FLIP slide to the new order. */
function _msBoardSection(sec, kids, hits, newAward) {
    var vp = sec.querySelector('.mb-vp'), list = sec.querySelector('.mb-list');
    var old = {}, firstTop = {};
    Array.prototype.forEach.call(list.querySelectorAll('.mb-row[data-k]'), function (r) {
        old[r.getAttribute('data-k')] = r;
        firstTop[r.getAttribute('data-k')] = r.getBoundingClientRect().top;
    });
    var seen = {}, hitRows = [];
    kids.forEach(function (k, i) {
        var row = old[k.key];
        var isNew = !row;
        if (isNew) {
            row = document.createElement('div');
            row.setAttribute('data-k', k.key);
        }
        var prevStars = row.getAttribute('data-s');
        row.className = 'mb-row' + (k.stars > 0 && i < 3 ? ' r' + (i + 1) : '') + (k.stars > 0 ? '' : ' zero') + (isNew && _ms.boardOn && list.children.length ? ' enter' : '');
        row.innerHTML = _msRowInner(k, i);
        if (prevStars !== null && +prevStars !== k.stars) row.querySelector('.mb-st').classList.add('bump');
        row.setAttribute('data-s', k.stars);
        list.appendChild(row); /* appending in order is the reorder */
        seen[k.key] = true;
        if (hits[k.key]) hitRows.push(row);
    });
    /* rows of kids no longer listed fade out where they were */
    var listTop = list.getBoundingClientRect().top;
    Object.keys(old).forEach(function (key) {
        if (seen[key]) return;
        var r = old[key];
        r.removeAttribute('data-k');
        r.className += ' gone';
        r.style.top = (firstTop[key] - listTop) + 'px';
        setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 600);
    });
    /* on an award, bring the highest recipient into view and hold there */
    var st = vp._as || (vp._as = { mode: 'pauseTop', until: Date.now() + MS_BOARD_PAUSE_MS, pos: 0 });
    if (newAward && hitRows.length) {
        var target = hitRows[0].offsetTop - (vp.clientHeight - hitRows[0].offsetHeight) / 2;
        st.pos = Math.max(0, Math.min(vp.scrollHeight - vp.clientHeight, target));
        vp.scrollTop = st.pos;
        st.mode = 'hold';
        st.until = Date.now() + MS_BOARD_HOLD_MS;
    }
    /* FLIP: rows that moved start at their old place and slide to the new one */
    Object.keys(firstTop).forEach(function (key) {
        if (!seen[key]) return;
        var r = old[key];
        var dy = firstTop[key] - r.getBoundingClientRect().top;
        if (!dy) return;
        r.style.transition = 'none';
        r.style.transform = 'translateY(' + dy + 'px)';
        void r.offsetWidth;
        r.style.transition = 'transform .8s cubic-bezier(.2,.8,.2,1)';
        r.style.transform = '';
    });
    hitRows.forEach(function (r) { r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit'); });
}

/* Slow auto-scroll for levels with more kids than fit: pause at the top, glide down, pause, glide back. */
function _msBoardScrollTick() {
    if (!_ms.boardOn) return;
    var now = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll('#mb-secs .mb-vp'), function (vp) {
        var st = vp._as || (vp._as = { mode: 'pauseTop', until: now + MS_BOARD_PAUSE_MS, pos: 0 });
        var max = vp.scrollHeight - vp.clientHeight;
        if (max <= 1) { if (vp.scrollTop) vp.scrollTop = 0; st.pos = 0; return; }
        var row = vp.querySelector('.mb-row');
        var step = (row ? row.offsetHeight * 1.12 : 40) * MS_BOARD_ROWS_PER_S * 0.04;
        if (st.mode === 'hold' || st.mode === 'pauseTop' || st.mode === 'pauseBottom') {
            if (now < st.until) return;
            st.mode = st.mode === 'pauseBottom' ? 'up' : (st.pos >= max - 1 ? 'pauseBottom' : 'down');
            if (st.mode === 'pauseBottom') st.until = now + MS_BOARD_PAUSE_MS;
            return;
        }
        if (st.mode === 'down') {
            st.pos = Math.min(max, st.pos + step);
            if (st.pos >= max) { st.mode = 'pauseBottom'; st.until = now + MS_BOARD_PAUSE_MS; }
        } else {
            st.pos = Math.max(0, st.pos - step * 4);
            if (st.pos <= 0) { st.mode = 'pauseTop'; st.until = now + MS_BOARD_PAUSE_MS; }
        }
        vp.scrollTop = st.pos;
    });
}

/* Gold gradient title; the emoji sits outside the gradient so it keeps its colors. */
function _msTitle(emoji, text) {
    return '<div class="fx-title">' + (emoji ? '<span>' + emoji + '</span>' : '') + '<span class="g">' + _msEsc(text) + '</span></div>';
}

function _msWheelHtml(outs) {
    var n = outs.length, seg = 360 / n;
    var colors = ['#e74c3c', '#3498db', '#1f9d55', '#e0a800', '#9b59b6', '#e67e22', '#00a8a8', '#d63384'];
    var stops = [];
    for (var i = 0; i < n; i++) {
        var c = colors[i % colors.length];
        if (i === n - 1 && n > 1 && c === colors[0]) c = colors[1]; /* first and last wedges touch */
        stops.push(c + ' ' + (i * seg).toFixed(2) + 'deg ' + ((i + 1) * seg).toFixed(2) + 'deg');
    }
    /* label width = the wedge chord at 60% of the radius, as a share of the wheel diameter */
    var w = Math.min(70, 60 * Math.sin(Math.min(seg, 120) / 2 * Math.PI / 180) + 4);
    var labels = '';
    outs.forEach(function (o, i) {
        labels += '<div class="fx-wl" style="width:' + w.toFixed(1) + '%;margin-left:-' + (w / 2).toFixed(1) + '%;transform:rotate(' + (i * seg + seg / 2).toFixed(2) + 'deg)"><span>' + _msEsc(o) + '</span></div>';
    });
    return '<div class="fx-wheel-wrap"><div class="fx-wheel-ptr"></div>' +
        '<div class="fx-wheel" style="background:conic-gradient(' + stops.join(',') + ')">' + labels + '</div>' +
        '<div class="fx-wheel-hub">⭐</div></div>';
}

/* Spin `wheel` so wedge `idx` ends under the top pointer; ticks as each wedge edge passes. */
function _msSpin(wheel, n, idx, dur, done) {
    var g = _ms.fxGen, seg = 360 / n;
    var jitter = (Math.random() - 0.5) * seg * 0.5;
    var target = 360 * 6 + (360 - (idx * seg + seg / 2)) + jitter;
    var t0 = 0, lastEdge = 0;
    function frame(ts) {
        if (g !== _ms.fxGen) return;
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var a = target * (1 - Math.pow(1 - p, 4));
        wheel.style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
        var edge = Math.floor(a / seg);
        if (edge !== lastEdge) { lastEdge = edge; _msSfx('wheelTick'); }
        if (p < 1) requestAnimationFrame(frame);
        else done();
    }
    requestAnimationFrame(frame);
}

/* ---------- sound (Web Audio, synthesized) ---------- */

var _msAudio = null;

function _msCtx() {
    if (!_msAudio) {
        try { _msAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (_msAudio.state === 'suspended') {
        var p = _msAudio.resume();
        if (p && p.catch) p.catch(function () {});
    }
    return _msAudio;
}

function _msTone(freq, dur, type, vol, delay) {
    var ctx = _msCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type || 'sine';
    osc.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function _msSfx(type) {
    if (_ms.muted) return;
    var now = Date.now();
    if (now - (_ms.sfxAt[type] || 0) < 120) return; /* a view and an fx for the same moment play once */
    _ms.sfxAt[type] = now;
    var ctx = _msCtx();
    /* Until a click unlocks audio the context is suspended; skip instead of queueing a burst for later. */
    if (!ctx || ctx.state !== 'running') return;
    var T = _msTone;
    switch (type) {
        case 'appear': T(523.25, 0.1, 'triangle', 0.14); T(783.99, 0.12, 'triangle', 0.14, 0.07); T(1046.5, 0.18, 'triangle', 0.12, 0.14); break;
        case 'pop': T(880, 0.09, 'triangle', 0.14); T(1318.5, 0.12, 'triangle', 0.1, 0.05); break;
        case 'clue': T(659.25, 0.12, 'sine', 0.16); T(987.77, 0.2, 'sine', 0.14, 0.08); break;
        case 'count': T(1046.5, 0.07, 'square', 0.08); T(1568, 0.09, 'triangle', 0.1, 0.04); break;
        case 'reveal': T(180, 0.25, 'sawtooth', 0.1); T(523.25, 0.18, 'triangle', 0.16, 0.1); T(783.99, 0.3, 'triangle', 0.14, 0.18); T(1046.5, 0.4, 'triangle', 0.12, 0.3); break;
        case 'correct': [659.25, 783.99, 987.77, 1318.5].forEach(function (f, i) { T(f, 0.22, 'triangle', 0.18, i * 0.08); }); T(1318.5, 0.5, 'sine', 0.08, 0.32); break;
        case 'wrong': T(220, 0.18, 'sawtooth', 0.18); T(196, 0.3, 'sawtooth', 0.16, 0.1); break;
        case 'team': [261.63, 329.63, 392, 523.25].forEach(function (f, i) { T(f, 0.4, 'triangle', 0.2, i * 0.11); }); T(523.25, 0.9, 'sine', 0.1, 0.48); T(659.25, 0.9, 'sine', 0.08, 0.48); T(783.99, 0.9, 'sine', 0.07, 0.48); break;
        case 'tick': T(880, 0.08, 'square', 0.1); break;
        case 'tickUrgent': T(1320, 0.07, 'square', 0.14); T(660, 0.06, 'square', 0.08, 0.04); break;
        case 'timeout': T(330, 0.14, 'square', 0.15); T(330, 0.14, 'square', 0.15, 0.18); T(220, 0.4, 'sawtooth', 0.2, 0.36); break;
        case 'wheelTick': T(1500, 0.03, 'square', 0.07); break;
        case 'whoosh': T(120, 0.25, 'sawtooth', 0.07); T(240, 0.3, 'triangle', 0.06, 0.08); break;
        case 'suspense': [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440].forEach(function (f, i) { T(f, 0.16, 'square', 0.07, i * 0.13); }); T(523.25, 0.7, 'triangle', 0.16, 1.05); break;
        case 'golden':
            [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { T(f, 0.3, 'triangle', 0.2, i * 0.09); });
            for (var s = 0; s < 6; s++) T(1568 + s * 120, 0.12, 'sine', 0.09, 0.4 + s * 0.08);
            break;
        case 'fanfare':
            [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { T(f, 0.4, 'triangle', 0.2, i * 0.09); });
            [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { T(f, 1.4, 'sine', 0.07, 0.75); });
            break;
    }
}

/* ---------- confetti (canvas) ---------- */

var _msConf = { canvas: null, ctx: null, parts: [], raf: 0, until: 0 };

function _msConfetti(count, durMs, colors, originX) {
    var c = _msConf.canvas;
    if (!c) {
        c = _msConf.canvas = _msEl('ms-confetti');
        _msConf.ctx = c.getContext('2d');
        var resize = function () { c.width = innerWidth; c.height = innerHeight; };
        resize();
        window.addEventListener('resize', resize);
    }
    c.classList.add('on');
    _msConf.until = Math.max(_msConf.until, performance.now() + durMs);
    colors = colors || ['#ffd700', '#d4a017', '#7c6af7', '#22c55e', '#ec4899', '#06b6d4', '#f59e0b', '#ef4444'];
    var ox = originX !== undefined ? originX : c.width / 2;
    for (var i = 0; i < count; i++) {
        _msConf.parts.push({
            x: ox + (Math.random() - 0.5) * c.width * 0.5, y: -10 - Math.random() * 40,
            vx: (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 5, g: 0.12 + Math.random() * 0.08,
            w: 8 + Math.random() * 8, h: 12 + Math.random() * 9,
            rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.32,
            color: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.4
        });
    }
    if (!_msConf.raf) _msConf.raf = requestAnimationFrame(_msConfettiTick);
}

function _msConfettiTick() {
    var c = _msConf.canvas, ctx = _msConf.ctx, ps = _msConf.parts;
    ctx.clearRect(0, 0, c.width, c.height);
    for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
        if (p.y > c.height + 20) { ps.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
    }
    if (performance.now() < _msConf.until || ps.length) {
        _msConf.raf = requestAnimationFrame(_msConfettiTick);
    } else {
        _msConf.raf = 0;
        c.classList.remove('on');
    }
}

function _msConfettiStop() {
    if (!_msConf.canvas) return;
    _msConf.parts = [];
    _msConf.until = 0;
}

/* ---------- fullscreen button + cursor ---------- */

function _msInitFullscreen() {
    var btn = _msEl('ms-fs');
    var isFs = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); };
    btn.onclick = function () {
        _msCtx(); /* the click also unlocks Web Audio for this window */
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
            var p = req.call(el);
            if (p && p.catch) p.catch(function () {});
        }
        btn.classList.add('hide');
    };
    var sync = function () { btn.classList.toggle('hide', isFs()); setTimeout(_msFit, 50); };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    /* Browsers start audio only after a gesture in this window: any click or key unlocks it. */
    document.addEventListener('pointerdown', function () { _msCtx(); });
    document.addEventListener('keydown', function () { _msCtx(); });
}

function _msInitCursor() {
    var t = 0;
    document.addEventListener('mousemove', function () {
        document.body.classList.remove('nocursor');
        clearTimeout(t);
        t = setTimeout(function () { document.body.classList.add('nocursor'); }, 3000);
    });
}
