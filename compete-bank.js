// ============================================================
// COMPETE BANK — one question bank for group games, built from every subject.
// Loaded after level1.js. Sources:
//   - faith: LEVEL2_SUBJECTS.faith lessons (old Level 2 engine, schedule-gated)
//   - l2_bible, l2_life, l1_bible, l1_service: subject engine data (LEVEL1_SUBJECTS)
//     check cards, arcade questions, and lesson games turned into questions:
//     swipe -> "يخص مين؟", clues -> "مين أنا؟", scenario -> "موقف", fillVerse -> "كمّل الآية",
//     memory / connect pairs -> "إيه اللي مع ...؟", timeline -> "أنهي جه الأول؟"
// Question shape: { q, options[], correct, explain?, kind, subject, lesson, clues?[] }
//   kind: 'mcq' | 'tf' | 'clues' | 'scenario' | 'verse'
// ============================================================

var COMPETE_SUBJECTS = [
    { key: 'faith',      label: '✝️ عقيدة ولاهوت',        short: 'عقيدة',         color: '#e74c3c', level: 2 },
    { key: 'l2_bible',   label: '📖 كتاب مقدس (م٢)',       short: 'كتاب مقدس م٢',  color: '#3498db', level: 2 },
    { key: 'l2_life',    label: '🌟 مهارات الحياة والقيادة', short: 'مهارات الحياة', color: '#f39c12', level: 2 },
    { key: 'l1_bible',   label: '📜 كتاب مقدس (م١)',       short: 'كتاب مقدس م١',  color: '#d4a24c', level: 1 },
    { key: 'l1_service', label: '🤲 الخدمة (م١)',          short: 'الخدمة',        color: '#2f9e8f', level: 1 }
];

// Question kinds each room mode draws from
var COMPETE_MODE_KINDS = {
    classic:  ['mcq', 'tf', 'clues', 'scenario', 'verse'],
    speed:    ['mcq', 'tf'],
    sparkle:  ['mcq', 'tf', 'verse'],
    team:     ['mcq', 'tf', 'clues', 'scenario', 'verse'],
    clues:    ['clues'],
    verse:    ['verse'],
    scenario: ['scenario']
};

function competeSubjectMeta(key) {
    for (var i = 0; i < COMPETE_SUBJECTS.length; i++) if (COMPETE_SUBJECTS[i].key === key) return COMPETE_SUBJECTS[i];
    return null;
}

// Lessons (stations) of a subject: [{ idx, name }]
function competeLessonsOf(key) {
    if (key === 'faith') {
        var f = (typeof LEVEL2_SUBJECTS !== 'undefined' && LEVEL2_SUBJECTS.faith) || { lessons: [] };
        return f.lessons.map(function(l, i) { return { idx: i, name: l.name }; })
            .filter(function(l) { return typeof isLessonScheduled !== 'function' || isLessonScheduled(l.idx); });
    }
    var sub = (typeof LEVEL1_SUBJECTS !== 'undefined') ? LEVEL1_SUBJECTS[key] : null;
    if (!sub) return [];
    return sub.stations.map(function(st, i) { return { idx: i, name: st.title }; });
}

function _cbShuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
}
function _cbPlain(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }
function _cbValid(q) {
    return q && q.q && q.options && q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length &&
        q.options.every(function(o) { return o != null && String(o).length; });
}

// Pick `n` distinct items from `pool` other than `except`
function _cbOthers(pool, except, n) {
    var seen = {}; seen[except] = true;
    var out = [];
    _cbShuffle(pool.slice()).forEach(function(x) { if (out.length < n && !seen[x]) { seen[x] = true; out.push(x); } });
    return out;
}

// All questions of one station of a subject-engine subject
function _cbStationQuestions(key, idx, st) {
    var out = [];
    function add(q, kind) {
        q.kind = kind; q.subject = key; q.lesson = idx;
        q.q = _cbPlain(q.q);
        q.options = q.options.map(_cbPlain);
        if (_cbValid(q)) out.push(q);
    }
    (st.cards || []).forEach(function(c) {
        if (c.type === 'check') add({ q: c.q, options: c.options.slice(), correct: c.correct, explain: c.explain }, 'mcq');
    });
    (st.games || []).forEach(function(g) {
        var d = g.data || {};
        if (g.type === 'arcade') {
            (d.questions || []).forEach(function(q) { add({ q: q.q, options: q.options.slice(), correct: q.correct, explain: q.explain }, 'mcq'); });
        } else if (g.type === 'swipe' && d.bins && d.items) {
            d.items.forEach(function(it) {
                if (d.bins.length === 2 && /صح|غلط/.test(d.bins.join(''))) {
                    var trueIdx = d.bins[0].indexOf('صح') >= 0 ? 0 : 1;
                    add({ q: it.t, options: ['صح ✓', 'غلط ✗'], correct: it.bin === trueIdx ? 0 : 1, type: 'truefalse' }, 'tf');
                } else {
                    add({ q: '«' + it.t + '» — يخص مين؟', options: d.bins.slice(), correct: it.bin }, 'mcq');
                }
            });
        } else if (g.type === 'clues' && d.rounds) {
            d.rounds.forEach(function(r) {
                var ci = r.options.indexOf(r.answer);
                if (ci < 0) return;
                // First clue is the question text (unique per round); the rest are revealed during the timer
                add({ q: r.clues[0], clues: r.clues.slice(1), options: r.options.slice(), correct: ci }, 'clues');
            });
        } else if (g.type === 'scenario' && d.rounds) {
            d.rounds.forEach(function(r) {
                var good = r.options.filter(function(o) { return o.good; });
                if (good.length !== 1) return;
                var opts = r.options.map(function(o) { return o.t; });
                add({ q: (r.emoji ? r.emoji + ' ' : '') + r.situation, options: opts, correct: opts.indexOf(good[0].t), explain: good[0].why }, 'scenario');
            });
        } else if (g.type === 'fillVerse' && d.verses) {
            d.verses.forEach(function(v) {
                var m = (v.missing || [])[0];
                if (!m) return;
                var words = v.text.split(/\s+/), hit = -1;
                for (var i = 0; i < words.length; i++) {
                    if (words[i].replace(/[«»"“”،.:؛!؟()]/g, '') === m) { hit = i; break; }
                }
                if (hit < 0) return;
                words[hit] = '______';
                var wrong = (v.distractors || []).concat((v.missing || []).slice(1)).filter(function(w) { return w !== m; });
                var opts = _cbShuffle([m].concat(wrong.slice(0, 3)));
                if (opts.length < 2) return;
                add({ q: '📜 كمّل الآية: ' + words.join(' ') + (v.ref ? ' ' + v.ref : ''), options: opts, correct: opts.indexOf(m) }, 'verse');
            });
        } else if ((g.type === 'memory' || g.type === 'connect') && d.pairs) {
            var rights = d.pairs.map(function(p) { return p[1]; });
            d.pairs.forEach(function(p) {
                var opts = _cbShuffle([p[1]].concat(_cbOthers(rights, p[1], 3)));
                if (opts.length < 3) return;
                add({ q: '🔗 إيه اللي يتوصل بـ «' + p[0] + '»؟', options: opts, correct: opts.indexOf(p[1]) }, 'mcq');
            });
        } else if (g.type === 'timeline' && d.items && d.items.length >= 3 && !d.slotLabels && d.layout !== 'cycle') {
            for (var k = 0; k < Math.min(3, d.items.length - 2); k++) {
                var idxs = _cbShuffle(d.items.map(function(_, i) { return i; })).slice(0, 3).sort(function(a, b) { return a - b; });
                var first = d.items[idxs[0]];
                var opts = _cbShuffle(idxs.map(function(i) { return d.items[i]; }));
                add({ q: '⏳ أنهي واحدة فيهم جت الأول؟', options: opts, correct: opts.indexOf(first), explain: 'الترتيب: ' + idxs.map(function(i) { return d.items[i]; }).join(' ← ') }, 'mcq');
            }
        }
    });
    return out;
}

// Questions for subject `key`, optional lesson list (empty = all lessons)
function competeQuestionsFor(key, lessons) {
    var want = lessons && lessons.length ? lessons : null;
    var out = [];
    if (key === 'faith') {
        competeLessonsOf('faith').forEach(function(l) {
            if (want && want.indexOf(l.idx) < 0) return;
            var lesson = LEVEL2_SUBJECTS.faith.lessons[l.idx];
            (lesson.questions || []).forEach(function(q) {
                var item = { q: q.q, options: q.options.slice(), correct: q.correct, explain: q.explanation, kind: 'mcq', subject: 'faith', lesson: l.idx };
                if (_cbValid(item)) out.push(item);
            });
        });
        return out;
    }
    var sub = (typeof LEVEL1_SUBJECTS !== 'undefined') ? LEVEL1_SUBJECTS[key] : null;
    if (!sub) return out;
    sub.stations.forEach(function(st, i) {
        if (want && want.indexOf(i) < 0) return;
        out = out.concat(_cbStationQuestions(key, i, st));
    });
    return out;
}

// Whole bank for a filter { subjects:[], lessons:{key:[idx]} }; empty subjects = everything
function competeBankFor(filter) {
    filter = filter || { subjects: [], lessons: {} };
    var keys = filter.subjects && filter.subjects.length ? filter.subjects : COMPETE_SUBJECTS.map(function(s) { return s.key; });
    var all = [];
    keys.forEach(function(k) { all = all.concat(competeQuestionsFor(k, (filter.lessons || {})[k])); });
    return all;
}

// Shuffle options while keeping the answer; carries the extra fields
function competePrepare(q) {
    if (q.type === 'truefalse' || q.kind === 'tf') {
        return { q: q.q, options: q.options.slice(), correct: q.correct, type: 'truefalse', kind: 'tf', explain: q.explain || '', subject: q.subject };
    }
    var answer = q.options[q.correct];
    var opts = _cbShuffle(q.options.slice());
    var out = { q: q.q, options: opts, correct: opts.indexOf(answer), kind: q.kind || 'mcq', explain: q.explain || '', subject: q.subject };
    if (q.clues) out.clues = q.clues.slice();
    return out;
}

// Pick `count` questions for a room: kinds per mode, unseen first (questionHistory), balanced across subjects
function competePickQuestions(mode, filter, count) {
    var kinds = COMPETE_MODE_KINDS[mode] || COMPETE_MODE_KINDS.classic;
    var bank = competeBankFor(filter).filter(function(q) { return kinds.indexOf(q.kind) >= 0; });
    var histKey = 'compete_' + mode;
    var hist = (GameState.questionHistory && GameState.questionHistory[histKey]) || [];
    // Round-robin over subjects so one big subject doesn't swamp the room
    var bySub = {};
    bank.forEach(function(q) {
        var seen = hist.indexOf(q.q) >= 0 ? 1 : 0;
        (bySub[q.subject] = bySub[q.subject] || [[], []])[seen].push(q);
    });
    var queues = Object.keys(bySub).map(function(k) { return _cbShuffle(bySub[k][0]).concat(_cbShuffle(bySub[k][1])); });
    _cbShuffle(queues);
    var picked = [], used = {};
    while (picked.length < count && queues.some(function(qq) { return qq.length; })) {
        queues.forEach(function(qq) {
            while (qq.length && picked.length < count) {
                var q = qq.shift();
                if (used[q.q]) continue;
                used[q.q] = true;
                picked.push(competePrepare(q));
                break;
            }
        });
    }
    _cbShuffle(picked);
    if (typeof recordQuestionHistory === 'function' && picked.length) recordQuestionHistory(histKey, picked);
    return picked;
}

// Human-readable label for a filter
function competeFilterLabel(filter) {
    if (!filter || !filter.subjects || !filter.subjects.length) return '🎲 عشوائي من كل المواد';
    return filter.subjects.map(function(k) {
        var m = competeSubjectMeta(k);
        var part = m ? m.label : k;
        var sel = (filter.lessons || {})[k] || [];
        if (sel.length) {
            var names = competeLessonsOf(k);
            part += ' (' + sel.map(function(i) {
                var l = names.filter(function(x) { return x.idx === i; })[0];
                return l ? l.name : 'درس ' + (i + 1);
            }).join('، ') + ')';
        }
        return part;
    }).join(' + ');
}

// ---------- Teams ----------
var COMPETE_QUICK_TEAMS = [
    { id: 'red', name: 'الفريق الأحمر', color: '#e74c3c', icon: '🔴' },
    { id: 'blue', name: 'الفريق الأزرق', color: '#3498db', icon: '🔵' }
];

// Team a joining player gets: church team name, or the smaller quick team
function competeTeamFor(room) {
    if (!room || room.playStyle !== 'team') return null;
    if (room.teamSource === 'church') {
        return { id: 'c_' + (GameState.team || 'guests'), name: GameState.team || 'فريق الضيوف', color: GameState.teamColor || '#8e8e8e', icon: GameState.teamLogo || '⚔️' };
    }
    var counts = { red: 0, blue: 0 };
    Object.keys(room.players || {}).forEach(function(ph) { var t = room.players[ph].team; if (t && counts.hasOwnProperty(t.id)) counts[t.id]++; });
    return Object.assign({}, counts.red <= counts.blue ? COMPETE_QUICK_TEAMS[0] : COMPETE_QUICK_TEAMS[1]);
}

// Team standings: average score per member (fair for uneven team sizes)
function competeTeamStandings(room) {
    var teams = {};
    Object.keys(room.players || {}).forEach(function(ph) {
        var p = room.players[ph], t = p.team;
        if (!t) return;
        var e = teams[t.id] || (teams[t.id] = { id: t.id, name: t.name, color: t.color, icon: t.icon, total: 0, members: [], correct: 0 });
        e.total += p.score || 0;
        e.correct += (p.answers || []).filter(function(a) { return a.correct; }).length;
        e.members.push(ph);
    });
    return Object.keys(teams).map(function(k) {
        var e = teams[k];
        e.avg = e.members.length ? Math.round(e.total / e.members.length) : 0;
        return e;
    }).sort(function(a, b) { return b.avg - a.avg; });
}
