/* Meeting night core: state, teams, awards, audience projection.
   Pure logic: no DOM, no Firestore. Shared by the control window and the projector window. */
var MT_POINTS = 5;
var MT_GOLDEN_POINTS = 15;
var MT_STORAGE_KEY = 'meb_meeting_night';

var MT_TEAM_PRESETS = [
    { id: 'david', name: 'فريق داود', color: '#e74c3c', icon: '🦁' },
    { id: 'moses', name: 'فريق موسى', color: '#3498db', icon: '🌊' },
    { id: 'joseph', name: 'فريق يوسف', color: '#1f9d55', icon: '🌾' },
    { id: 'daniel', name: 'فريق دانيال', color: '#e0a800', icon: '🔥' },
    { id: 'esther', name: 'فريق أستير', color: '#9b59b6', icon: '👑' },
    { id: 'paul', name: 'فريق بولس', color: '#e67e22', icon: '⚓' }
];

function mtNewNight(opts) {
    opts = opts || {};
    var f = opts.filter || {};
    return {
        v: 1,
        id: (opts.date || '') + '_' + Math.random().toString(36).slice(2, 10).padEnd(8, '0') + Date.now().toString(36).slice(-3),
        date: opts.date || '',
        title: opts.title || '',
        levels: (opts.levels || [1, 2]).slice(),
        filter: { subjects: (f.subjects || []).slice(), lessons: JSON.parse(JSON.stringify(f.lessons || {})) },
        kinds: (opts.kinds || []).slice(),
        teams: [],
        roster: {},
        current: null,
        awards: [],
        usedTonight: [],
        skipped: [],
        multiplier: 1,
        lastKind: null,
        excluded: []
    };
}

function _mtTeam(night, id) {
    for (var i = 0; i < night.teams.length; i++) if (night.teams[i].id === id) return night.teams[i];
    return null;
}

/* count = how many teams to add; first call yields at least 2, total never exceeds 6. */
function mtMakeRandomTeams(night, count) {
    var n = Math.floor(Number(count)) || 0;
    var min = night.teams.length ? 1 : 2;
    n = Math.max(min, Math.min(6, n));
    var added = [];
    for (var i = 0; i < MT_TEAM_PRESETS.length && added.length < n && night.teams.length < 6; i++) {
        var p = MT_TEAM_PRESETS[i];
        if (_mtTeam(night, p.id)) continue;
        var t = { id: p.id, name: p.name, color: p.color, icon: p.icon, source: 'random', gameTeam: '', score: 0 };
        night.teams.push(t);
        added.push(t);
    }
    return added;
}

function mtAddGameTeam(night, o) {
    var k = 1;
    while (_mtTeam(night, 'game' + k)) k++;
    var t = { id: 'game' + k, name: o.name, color: o.color || '#555555', icon: o.logo || '🛡️', source: 'game', gameTeam: o.name, score: 0 };
    night.teams.push(t);
    return t;
}

function mtAddToRoster(night, p, teamId) {
    var kid = night.roster[p.phone];
    if (!kid) {
        kid = night.roster[p.phone] = { phone: p.phone, name: p.name || '', level: p.level === 2 ? 2 : 1, teamId: null, stars: 0 };
    }
    if (teamId) {
        kid.teamId = _mtTeam(night, teamId) ? teamId : null;
    } else if (!kid.teamId && p.team) {
        for (var i = 0; i < night.teams.length; i++) {
            if (night.teams[i].source === 'game' && night.teams[i].gameTeam === p.team) { kid.teamId = night.teams[i].id; break; }
        }
    }
    return kid;
}

function mtSetTeam(night, phone, teamId) {
    var kid = night.roster[phone];
    if (!kid) return;
    kid.teamId = teamId && _mtTeam(night, teamId) ? teamId : null;
}

function mtRemoveFromRoster(night, phone) {
    delete night.roster[phone];
}

function mtPointsForCurrent(night) {
    if (night.current && night.current.golden) return MT_GOLDEN_POINTS;
    return MT_POINTS * (night.multiplier || 1);
}

function _mtTeamPhones(night, teamId) {
    var out = [];
    Object.keys(night.roster).forEach(function (ph) { if (night.roster[ph].teamId === teamId) out.push(ph); });
    return out;
}

/* Apply a signed delta to the stars of `phones` and to the score of `teamId`. */
function _mtApply(night, phones, teamId, delta) {
    phones.forEach(function (ph) { if (night.roster[ph]) night.roster[ph].stars += delta; });
    var t = teamId ? _mtTeam(night, teamId) : null;
    if (t) t.score += delta;
}

function _mtNextAwardId(night) {
    return 'aw' + (night.awards.length + 1);
}

/* target = {phone} or {teamId}. Returns the Award, or null if the target is unknown. */
function mtAward(night, target, points, itemId) {
    var award;
    if (target.teamId) {
        if (!_mtTeam(night, target.teamId)) return null;
        award = { kind: 'team', phones: _mtTeamPhones(night, target.teamId), teamId: target.teamId };
    } else {
        var kid = night.roster[target.phone];
        if (!kid) return null;
        award = { kind: 'individual', phones: [target.phone], teamId: kid.teamId };
    }
    award.id = _mtNextAwardId(night);
    award.ts = Date.now();
    award.points = points;
    award.itemId = itemId || null;
    award.refId = null;
    award.synced = {};
    _mtApply(night, award.phones, award.teamId, points);
    night.awards.push(award);
    if (points > 0) night.multiplier = 1;
    return award;
}

function mtUndoLast(night) {
    var undone = {};
    night.awards.forEach(function (a) { if (a.kind === 'undo') undone[a.refId] = true; });
    for (var i = night.awards.length - 1; i >= 0; i--) {
        var a = night.awards[i];
        if (a.kind === 'undo' || undone[a.id]) continue;
        _mtApply(night, a.phones, a.teamId, -a.points);
        var u = { id: _mtNextAwardId(night), ts: Date.now(), kind: 'undo', phones: a.phones.slice(), teamId: a.teamId, points: -a.points, itemId: a.itemId, refId: a.id, synced: {} };
        night.awards.push(u);
        return u;
    }
    return null;
}

function mtScreenScore(night, teamId, delta) {
    var t = _mtTeam(night, teamId);
    if (t) t.score += delta;
}

function mtStandings(night) {
    return night.teams.map(function (t, i) { return { t: t, i: i }; })
        .sort(function (a, b) { return (b.t.score - a.t.score) || (a.i - b.i); })
        .map(function (x) { return x.t; });
}

function mtTopKids(night, n) {
    return Object.keys(night.roster).map(function (ph, i) { return { k: night.roster[ph], i: i }; })
        .sort(function (a, b) { return (b.k.stars - a.k.stars) || (a.i - b.i); })
        .slice(0, n)
        .map(function (x) { return x.k; });
}

function mtPendingSyncs(night) {
    var out = [];
    night.awards.forEach(function (a) {
        a.phones.forEach(function (ph) {
            if (!a.synced[ph]) out.push({ awardId: a.id, phone: ph, points: a.points });
        });
    });
    return out;
}

/* ---- audience projection: what the projector may see ---- */

function _mtItemView(item, cur) {
    var revealed = cur.stage === 'revealed';
    if (!item || (cur.stage !== 'shown' && !revealed)) return null;
    var k = item.kind, v = { kind: k };
    switch (k) {
        case 'mcq': case 'scenario': case 'verse':
            v.prompt = item.prompt;
            v.options = revealed ? item.options.slice() : item.options.slice(0, cur.optionsShown || 0);
            if (revealed) v.correct = item.correct;
            break;
        case 'tf':
            v.prompt = item.prompt;
            if (revealed) v.correct = item.correct;
            break;
        case 'clues':
            v.clues = item.clues.slice(0, (cur.clueIdx || 0) + 1);
            break;
        case 'order':
            v.prompt = item.prompt;
            v.steps = revealed ? item.steps.slice() : (item.shuffled || []).slice();
            break;
        case 'emoji': case 'deep':
            v.prompt = item.prompt;
            break;
        case 'anagram':
            v.scrambled = item.scrambled;
            break;
        case 'odd':
            v.items = item.items.slice();
            if (revealed) v.odd = item.odd;
            break;
        case 'sixty':
            v.prompt = item.prompt;
            v.count = cur.count || 0;
            if (revealed) v.list = item.list.slice();
            break;
        case 'hymn':
            v.firstLine = item.firstLine;
            break;
        default:
            break; /* act / draw / taboo: the screen shows fixed segment text only */
    }
    if (revealed) {
        var ans = item.answer;
        if (ans === undefined && item.options && typeof item.correct === 'number') ans = item.options[item.correct];
        if (ans !== undefined) v.answer = ans;
        if (item.explain !== undefined) v.explain = item.explain;
    }
    return v;
}

/* leaderId = the strictly top-scoring team with score > 0, else null. */
function mtAudienceView(night) {
    var cur = night.current;
    var st = mtStandings(night);
    var leaderId = st.length && st[0].score > 0 && (st.length < 2 || st[1].score < st[0].score) ? st[0].id : null;
    return {
        title: night.title,
        teams: night.teams.map(function (t) { return { id: t.id, name: t.name, color: t.color, icon: t.icon, score: t.score }; }),
        leaderId: leaderId,
        item: cur ? _mtItemView(cur.item, cur) : null,
        stage: cur ? cur.stage : null,
        target: cur ? cur.target : null,
        timerEndsAt: cur ? cur.timerEndsAt : 0,
        timerSec: cur ? cur.timerSec : 0,
        golden: cur ? !!cur.golden : false
    };
}

function mtSerialize(night) {
    return JSON.stringify(night);
}

function mtRestore(str) {
    var o;
    try { o = JSON.parse(str); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    return o;
}

/* ---- kind catalog, item pool, picker, search ---- */

var MT_KINDS = {
    mcq:     { label: 'سؤال اختيار', timer: 30, bank: false },
    tf:      { label: 'قوم ولا اقعد', timer: 15, bank: false },
    clues:   { label: 'مين أنا؟', timer: 45, bank: false },
    verse:   { label: 'كمّل الآية', timer: 30, bank: false },
    scenario: { label: 'موقف… تعمل إيه؟', timer: 45, bank: false },
    order:   { label: 'رتّب الأحداث', timer: 45, bank: true },
    emoji:   { label: 'القصة بالإيموجي', timer: 30, bank: true },
    anagram: { label: 'الحروف المتلخبطة', timer: 30, bank: true },
    odd:     { label: 'مين الغريب؟', timer: 30, bank: true },
    deep:    { label: 'سؤال عميق', timer: 90, bank: true },
    sixty:   { label: '٦٠ ثانية', timer: 60, bank: true },
    act:     { label: 'مثّلها من غير كلام', timer: 45, bank: true },
    draw:    { label: 'ارسمها', timer: 60, bank: true },
    taboo:   { label: 'الكلمة الممنوعة', timer: 60, bank: true },
    hymn:    { label: 'كمّل اللحن / الترنيمة', timer: 30, bank: true }
};

function mtTimerFor(kind, mode) {
    var d = MT_KINDS[kind] ? MT_KINDS[kind].timer : 30;
    return mode === 'speed' ? Math.max(10, Math.round(d / 2)) : d;
}

/* FNV-1a 32-bit, 8 hex chars. */
function mtHash(str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    var s = h.toString(16);
    while (s.length < 8) s = '0' + s;
    return s;
}

function _mtRng(rng) { return typeof rng === 'function' ? rng : Math.random; }

function _mtShuffle(arr, rng) {
    var a = arr.slice(), r = _mtRng(rng);
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

function _mtPick(arr, rng) {
    return arr[Math.floor(_mtRng(rng)() * arr.length) % arr.length];
}

/* Letters shuffled, spaces removed; differs from the input whenever 2+ distinct letters exist. */
function mtScramble(word, rng) {
    var letters = String(word).replace(/\s+/g, '').split('');
    var plainWord = letters.join('');
    var distinct = {};
    letters.forEach(function (ch) { distinct[ch] = true; });
    if (Object.keys(distinct).length < 2) return plainWord;
    for (var tries = 0; tries < 30; tries++) {
        var s = _mtShuffle(letters, rng).join('');
        if (s !== plainWord) return s;
    }
    var a = letters.slice();
    for (var i = 0; i < a.length - 1; i++) {
        if (a[i] !== a[i + 1]) { var t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; break; }
    }
    return a.join('');
}

function mtNormalize(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
        .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
        .replace(/[ً-ْـ]/g, '')
        .replace(/\s+/g, ' ');
}

function _mtSubjectLevel(subject) {
    if (typeof COMPETE_SUBJECTS !== 'undefined') {
        for (var i = 0; i < COMPETE_SUBJECTS.length; i++) if (COMPETE_SUBJECTS[i].key === subject) return COMPETE_SUBJECTS[i].level;
    }
    return 2;
}

function _mtInList(list, v) { return list.indexOf(v) >= 0; }

/* Pool = compete-bank items for the filter + MEETING_BANK items at the given levels. */
function mtBuildPool(filter, levels) {
    filter = filter || {};
    var subjects = filter.subjects || [], lessons = filter.lessons || {};
    var pool = [];
    var cb = typeof competeBankFor === 'function' ? competeBankFor({ subjects: subjects, lessons: lessons }) : [];
    cb.forEach(function (q) {
        var level = _mtSubjectLevel(q.subject);
        if (!_mtInList(levels, level)) return;
        var it = {
            id: 'cb_' + mtHash(q.subject + '|' + q.lesson + '|' + q.q),
            level: level, subject: q.subject, station: q.lesson, kind: q.kind,
            prompt: q.q, options: q.options.slice(), correct: q.correct,
            answer: q.options[q.correct], explain: q.explain
        };
        if (q.kind === 'clues') {
            it.clues = [q.q].concat(q.clues || []);
            it.answer = q.options[q.correct];
        }
        pool.push(it);
    });
    var bank = typeof MEETING_BANK !== 'undefined' ? MEETING_BANK : [];
    bank.forEach(function (b) {
        if (!_mtInList(levels, b.level)) return;
        if (b.station !== null && b.station !== undefined) {
            if (subjects.length && !_mtInList(subjects, b.subject)) return;
            var want = lessons[b.subject];
            if (want && want.length && !_mtInList(want, b.station)) return;
        }
        var it = JSON.parse(JSON.stringify(b));
        if (it.kind === 'tf') {
            it.options = ['صح', 'غلط'];
            it.correct = it.answer === 'غلط' ? 1 : 0;
        } else if (it.kind === 'act' || it.kind === 'draw' || it.kind === 'taboo') {
            it.answer = it.secret;
        } else if (it.answer === undefined && it.options && typeof it.correct === 'number') {
            it.answer = it.options[it.correct];
        }
        pool.push(it);
    });
    return pool;
}

function mtAvailableKinds(pool, night) {
    var have = {};
    pool.forEach(function (it) { if (_mtInList(night.levels, it.level)) have[it.kind] = true; });
    return night.kinds.filter(function (k) { return have[k]; });
}

function _mtPrepare(item, rng) {
    var it = JSON.parse(JSON.stringify(item));
    var k = it.kind;
    if ((k === 'mcq' || k === 'scenario' || k === 'verse') && it.options) {
        var right = it.options[it.correct];
        it.options = _mtShuffle(it.options, rng);
        it.correct = it.options.indexOf(right);
    } else if (k === 'order' && it.steps) {
        var sh = _mtShuffle(it.steps, rng), same = true, tries = 0;
        while (tries++ < 20) {
            same = sh.every(function (s, i) { return s === it.steps[i]; });
            if (!same || it.steps.length < 2) break;
            sh = _mtShuffle(it.steps, rng);
        }
        if (same && it.steps.length > 1) sh = it.steps.slice(1).concat(it.steps[0]);
        it.shuffled = sh;
    } else if (k === 'anagram') {
        it.scrambled = mtScramble(it.answer, rng);
    }
    return it;
}

/* Tiered choice from a candidate list: unseen station items, unseen fallback items, then oldest seen. */
function _mtChoose(cands, history, rng) {
    var tier = cands.filter(function (it) { return it.station !== null && it.station !== undefined && !history[it.id]; });
    if (!tier.length) tier = cands.filter(function (it) { return (it.station === null || it.station === undefined) && !history[it.id]; });
    if (!tier.length) {
        var oldest = null;
        cands.forEach(function (it) { var d = history[it.id]; if (d && (oldest === null || d < oldest)) oldest = d; });
        tier = cands.filter(function (it) { return history[it.id] === oldest; });
    }
    return tier.length ? _mtPick(tier, rng) : null;
}

function _mtPickOnce(pool, night, level, kind, difficulty, history, rng) {
    var cands = pool.filter(function (it) {
        return it.level === level && it.kind === kind &&
            !_mtInList(night.usedTonight, it.id) && !_mtInList(night.skipped, it.id);
    });
    if (difficulty) {
        var d = cands.filter(function (it) { return it.difficulty === difficulty; });
        if (d.length) cands = d;
    }
    return cands.length ? _mtChoose(cands, history, rng) : null;
}

function mtPickNext(pool, night, opts, history, rng) {
    opts = opts || {}; history = history || {};
    var level = opts.level;
    if (level === 'all') level = _mtInList(night.levels, 1) ? 1 : 2;
    var kinds;
    if (opts.kind) {
        kinds = [opts.kind];
    } else {
        var avail = mtAvailableKinds(pool, night);
        var rest = avail.filter(function (k) { return k !== night.lastKind; });
        kinds = _mtShuffle(rest, rng).concat(_mtInList(avail, night.lastKind) ? [night.lastKind] : []);
    }
    for (var i = 0; i < kinds.length; i++) {
        var it = _mtPickOnce(pool, night, level, kinds[i], opts.difficulty, history, rng);
        if (it) return _mtPrepare(it, rng);
    }
    return null;
}

function mtSearch(players, query, limit) {
    var q = mtNormalize(query);
    if (q.length < 2) return [];
    var raw = String(query == null ? '' : query).trim();
    var max = limit === undefined ? 8 : limit;
    var first = [], later = [], byPhone = [];
    (players || []).forEach(function (p) {
        var words = mtNormalize(p.name).split(' ');
        if (words[0].indexOf(q) === 0) first.push(p);
        else if (words.some(function (w) { return w.indexOf(q) === 0; })) later.push(p);
        else if (String(p.phone || '').indexOf(raw) >= 0) byPhone.push(p);
    });
    return first.concat(later, byPhone).slice(0, max);
}

function mtRandomPick(night, players, level, rng) {
    var ok = function (p) {
        return (level === 'all' || (p.level === 2 ? 2 : 1) === level) && !_mtInList(night.excluded, p.phone);
    };
    var pool = Object.keys(night.roster).map(function (ph) { return night.roster[ph]; }).filter(ok);
    if (pool.length < 3) pool = (players || []).filter(ok);
    return pool.length ? _mtPick(pool, rng) : null;
}
