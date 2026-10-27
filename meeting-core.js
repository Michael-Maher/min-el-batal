/* Meeting night core: state, teams, awards, audience projection.
   Pure logic: no DOM, no Firestore. Shared by the control window and the projector window. */
var MT_POINTS = 5;          /* a question's worth unless the host sets night.points */
var MT_GOLDEN_FACTOR = 3;    /* the golden question is worth three questions */
var MT_STORAGE_KEY = 'meb_meeting_night';

/* Random teams are named after saints: boys' teams after saints, girls' teams after women saints. */
var MT_TEAM_PRESETS = {
    boys: [
        { id: 'george', name: 'فريق مارجرجس' },
        { id: 'mina', name: 'فريق مارمينا' },
        { id: 'mercurius', name: 'فريق أبو سيفين' },
        { id: 'antony', name: 'فريق الأنبا أنطونيوس' },
        { id: 'kyrillos', name: 'فريق البابا كيرلس' },
        { id: 'mark', name: 'فريق مارمرقس' },
        { id: 'bishoy', name: 'فريق الأنبا بيشوي' },
        { id: 'athanasius', name: 'فريق البابا أثناسيوس' },
        { id: 'moses', name: 'فريق الأنبا موسى القوي' },
        { id: 'paula', name: 'فريق الأنبا بولا' },
        { id: 'abanoub', name: 'فريق القديس أبانوب' },
        { id: 'victor', name: 'فريق مار بقطر' }
    ],
    girls: [
        { id: 'demiana', name: 'فريق القديسة دميانة' },
        { id: 'marina', name: 'فريق القديسة مارينا' },
        { id: 'rebecca', name: 'فريق القديسة رفقة' },
        { id: 'verena', name: 'فريق القديسة فيرينا' },
        { id: 'barbara', name: 'فريق القديسة بربارة' },
        { id: 'justina', name: 'فريق القديسة يوستينا' },
        { id: 'catherine', name: 'فريق القديسة كاترين' },
        { id: 'maryegypt', name: 'فريق القديسة مريم المصرية' },
        { id: 'thecla', name: 'فريق القديسة تكلا' },
        { id: 'sophia', name: 'فريق القديسة صوفيا' },
        { id: 'anastasia', name: 'فريق القديسة أنسطاسيا' },
        { id: 'theodora', name: 'فريق القديسة ثيؤدورا' }
    ]
};
/* The game's team logos and colors: must equal TEAM_LOGOS and TEAM_COLORS in game.js (asserted by
   tools/check-meeting.js). The host picks from them; a new team gets the first one no team has yet. */
var MT_TEAM_LOGOS = ['⚔️', '🛡️', '🔥', '⭐', '🏆', '💎', '✝️', '🕊️', '⚡', '🦁', '🐉', '👑', '🎯', '💪', '🌟', '🗡️'];
var MT_TEAM_COLORS = ['#6C5CE7', '#00CEC9', '#E17055', '#00B894', '#FDCB6E', '#E84393', '#0984E3', '#D63031', '#6AB04C', '#F9CA24', '#30336B', '#22A6B3'];
var MT_GUEST_PREFIX = 'guest_';

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
        excluded: [],
        turnMode: 'auto',
        points: MT_POINTS
    };
}

function _mtTeam(night, id) {
    for (var i = 0; i < night.teams.length; i++) if (night.teams[i].id === id) return night.teams[i];
    return null;
}

/* Adds `count` (at least 1) saint-named teams; no limit on teams in all. Once the saints of that
   gender are all used, the next teams are numbered. A team is one level only: level = 1 | 2. */
function mtMakeRandomTeams(night, count, gender, level) {
    var n = Math.max(1, Math.floor(Number(count)) || 0);
    var presets = MT_TEAM_PRESETS[gender] || MT_TEAM_PRESETS.boys;
    var added = [];
    while (added.length < n) {
        var p = null;
        for (var i = 0; i < presets.length && !p; i++) if (!_mtTeam(night, presets[i].id)) p = presets[i];
        if (!p) { var k = 1; while (_mtTeam(night, 'team' + k)) k++; p = { id: 'team' + k, name: _mtNumberedName(night) }; }
        var t = { id: p.id, name: p.name, color: _mtFree(night, 'color', MT_TEAM_COLORS), icon: _mtFree(night, 'icon', MT_TEAM_LOGOS), source: 'random', gameTeam: '', gender: gender === 'girls' ? 'girls' : 'boys', level: _mtLevel(level), score: 0 };
        night.teams.push(t);
        added.push(t);
    }
    return added;
}

/* «فريق ١», «فريق ٢», …: the first number no team is named with. */
function _mtNumberedName(night) {
    for (var k = 1; ; k++) {
        var name = 'فريق ' + String(k).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); });
        if (!night.teams.some(function (t) { return t.name === name; })) return name;
    }
}

/* Splits `phones` (shuffled) evenly into `count` new saint-named teams of `level`. Kids of another
   level stay where they are. Returns the new teams. */
function mtSplitIntoTeams(night, phones, count, gender, level, rng) {
    var kids = _mtShuffle(phones.filter(function (ph) { var k = night.roster[ph]; return k && k.level === level; }), rng);
    if (!kids.length) return [];
    var teams = mtMakeRandomTeams(night, Math.min(Math.max(1, Math.floor(Number(count)) || 1), kids.length), gender, level);
    kids.forEach(function (ph, i) { night.roster[ph].teamId = teams[i % teams.length].id; });
    return teams;
}

/* First of `list` no team has in `field`; once all are taken, they repeat in order. */
function _mtFree(night, field, list) {
    for (var i = 0; i < list.length; i++) {
        var v = list[i].toLowerCase();
        if (!night.teams.some(function (t) { return String(t[field]).toLowerCase() === v; })) return list[i];
    }
    return list[night.teams.length % list.length];
}

/* A team named by the host, with the next free game color and logo. */
function mtAddCustomTeam(night, o) {
    var k = 1;
    while (_mtTeam(night, 'custom' + k)) k++;
    var t = { id: 'custom' + k, name: String(o.name || '').trim() || _mtNumberedName(night), color: _mtFree(night, 'color', MT_TEAM_COLORS), icon: _mtFree(night, 'icon', MT_TEAM_LOGOS),
        source: 'custom', gameTeam: '', gender: '', level: _mtLevel(o.level), score: 0 };
    night.teams.push(t);
    return t;
}

function _mtLevel(l) { l = Number(l); return l === 1 || l === 2 ? l : 0; }

function mtAddGameTeam(night, o) {
    var k = 1;
    while (_mtTeam(night, 'game' + k)) k++;
    /* the team's own color and logo from the game; a missing or odd one gets the next free default */
    var color = /^#[0-9a-f]{3,8}$/i.test(o.color || '') ? o.color : _mtFree(night, 'color', MT_TEAM_COLORS);
    var icon = o.logo && String(o.logo).length <= 8 ? o.logo : _mtFree(night, 'icon', MT_TEAM_LOGOS);
    var t = { id: 'game' + k, name: o.name, color: color, icon: icon, source: 'game', gameTeam: o.name, gender: '', level: _mtLevel(o.level), score: 0 };
    night.teams.push(t);
    return t;
}

function mtIsGuest(phone) { return String(phone).indexOf(MT_GUEST_PREFIX) === 0; }

/* A kid with no game account: on tonight's roster under a made-up id, stars for tonight only. */
function mtAddGuest(night, name, level, teamId) {
    var k = 1;
    while (night.roster[MT_GUEST_PREFIX + k]) k++;
    var kid = mtAddToRoster(night, { phone: MT_GUEST_PREFIX + k, name: String(name).trim(), level: level }, teamId || null);
    kid.guest = true;
    return kid;
}

/* A team never mixes levels: a kid joins only a team of their level (or one whose level is not set yet). */
function mtFits(kid, team) {
    return !!(kid && team && (!team.level || team.level === kid.level));
}

function mtAddToRoster(night, p, teamId) {
    var kid = night.roster[p.phone];
    if (!kid) {
        kid = night.roster[p.phone] = { phone: p.phone, name: p.name || '', level: p.level === 2 ? 2 : 1, teamId: null, stars: 0 };
    }
    if (teamId) {
        kid.teamId = mtFits(kid, _mtTeam(night, teamId)) ? teamId : null;
    } else if (!kid.teamId && p.team) {
        for (var i = 0; i < night.teams.length; i++) {
            var t = night.teams[i];
            if (t.source === 'game' && t.gameTeam === p.team && mtFits(kid, t)) { kid.teamId = t.id; break; }
        }
    }
    _mtTakeLevel(night, kid);
    return kid;
}

/* A team with no level yet takes the level of its first kid, so it can never get mixed. */
function _mtTakeLevel(night, kid) {
    var t = kid.teamId ? _mtTeam(night, kid.teamId) : null;
    if (t && !t.level) t.level = kid.level;
}

/* teamId null = no team. Returns false (and leaves the kid where they are) for a team of another level. */
function mtSetTeam(night, phone, teamId) {
    var kid = night.roster[phone];
    if (!kid) return false;
    var t = teamId ? _mtTeam(night, teamId) : null;
    if (teamId && !mtFits(kid, t)) return false;
    kid.teamId = t ? teamId : null;
    _mtTakeLevel(night, kid);
    return true;
}

function mtRemoveFromRoster(night, phone) {
    delete night.roster[phone];
}

/* Team turns go round in the order the teams were added. turnMode 'auto' (or unset, for nights saved
   before turns existed) moves the turn on after each team question; 'manual' leaves it to the host. */
function mtTurnAuto(night) { return night.turnMode !== 'manual'; }

function mtNextTeamId(night, teamId) {
    var ts = night.teams;
    if (!ts.length) return null;
    for (var i = 0; i < ts.length; i++) if (ts[i].id === teamId) return ts[(i + 1) % ts.length].id;
    return ts[0].id;
}

/* The team up after the current team question: the one the host picked for next, else (turns going
   round) the next in order. Null when no team question is up. */
function mtTurnNext(night) {
    var cur = night.current, t = cur && cur.target;
    if (!t || t.mode !== 'team' || !t.teamId) return null;
    if (cur.nextTeamId && _mtTeam(night, cur.nextTeamId)) return cur.nextTeamId;
    return mtTurnAuto(night) && night.teams.length > 1 ? mtNextTeamId(night, t.teamId) : null;
}

/* What the host set a question to be worth (MT_POINTS on nights saved before it could be set). */
function mtBasePoints(night) {
    var p = Math.floor(Number(night.points));
    return p > 0 ? p : MT_POINTS;
}

function mtPointsForCurrent(night) {
    var base = mtBasePoints(night);
    if (night.current && night.current.golden) return base * MT_GOLDEN_FACTOR;
    return base * (night.multiplier || 1);
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

/* Guests have no game account: their stars never sync. */
function mtPendingSyncs(night) {
    var out = [];
    night.awards.forEach(function (a) {
        a.phones.forEach(function (ph) {
            if (!a.synced[ph] && !mtIsGuest(ph)) out.push({ awardId: a.id, phone: ph, points: a.points });
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
            if (item.hint) v.hint = item.hint;
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

/* Every roster kid of each night level, by stars desc, then earliest first award, then name.
   Rows carry a hashed key, never the phone. */
function _mtBoard(night) {
    /* an award that was undone does not count as the kid's first award */
    var undone = {}, firstAward = {};
    night.awards.forEach(function (a) { if (a.kind === 'undo') undone[a.refId] = true; });
    night.awards.forEach(function (a, i) {
        if (a.kind === 'undo' || undone[a.id]) return;
        a.phones.forEach(function (ph) { if (!(ph in firstAward)) firstAward[ph] = i; });
    });
    var out = {};
    night.levels.forEach(function (lvl) {
        out[lvl] = Object.keys(night.roster).map(function (ph) { return night.roster[ph]; })
            .filter(function (k) { return (k.level === 2 ? 2 : 1) === lvl; })
            .sort(function (a, b) {
                var fa = a.phone in firstAward ? firstAward[a.phone] : Infinity;
                var fb = b.phone in firstAward ? firstAward[b.phone] : Infinity;
                return (b.stars - a.stars) || (fa - fb) || String(a.name).localeCompare(String(b.name), 'ar');
            })
            .map(function (k) {
                var t = k.teamId ? _mtTeam(night, k.teamId) : null;
                return { key: mtHash(k.phone), name: k.name, teamColor: t ? t.color : null, stars: k.stars };
            });
    });
    return out;
}

function _mtLastAward(night) {
    var a = night.awards[night.awards.length - 1];
    return a ? { id: a.id, keys: a.phones.map(function (ph) { return mtHash(ph); }) } : null;
}

/* leaderId = the strictly top-scoring team with score > 0, else null. */
function mtAudienceView(night) {
    var cur = night.current;
    var st = mtStandings(night);
    var leaderId = st.length && st[0].score > 0 && (st.length < 2 || st[1].score < st[0].score) ? st[0].id : null;
    return {
        title: night.title,
        teams: night.teams.map(function (t) { return { id: t.id, name: t.name, color: t.color, icon: t.icon, level: t.level || 0, score: t.score }; }),
        leaderId: leaderId,
        item: cur ? _mtItemView(cur.item, cur) : null,
        stage: cur ? cur.stage : null,
        target: cur ? cur.target : null,
        nextTeamId: mtTurnNext(night),
        timerEndsAt: cur ? cur.timerEndsAt : 0,
        timerSec: cur ? cur.timerSec : 0,
        golden: cur ? !!cur.golden : false,
        points: cur ? mtPointsForCurrent(night) : 0,
        kids: _mtBoard(night),
        lastAward: _mtLastAward(night)
    };
}

function mtSerialize(night) {
    return JSON.stringify(night);
}

function mtRestore(str) {
    var o;
    try { o = JSON.parse(str); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    if (!Array.isArray(o.teams) || !Array.isArray(o.awards)) return null;
    if (!o.roster || typeof o.roster !== 'object' || Array.isArray(o.roster)) return null;
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

/* Arabic-Indic (and Persian) digits to Latin, for phone matching. */
function _mtLatinDigits(s) {
    return String(s).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (d) {
        var c = d.charCodeAt(0);
        return String(c - (c >= 0x06F0 ? 0x06F0 : 0x0660));
    });
}

/* Every query word prefix-matches a name word, in order. Returns the index of the word the first
   query word matched, or -1. */
function _mtWordsMatch(words, qWords) {
    for (var start = 0; start < words.length; start++) {
        if (words[start].indexOf(qWords[0]) !== 0) continue;
        var w = start + 1, ok = true;
        for (var i = 1; i < qWords.length && ok; i++) {
            while (w < words.length && words[w].indexOf(qWords[i]) !== 0) w++;
            if (w >= words.length) ok = false; else w++;
        }
        if (ok) return start;
    }
    return -1;
}

function mtSearch(players, query, limit) {
    var q = mtNormalize(query);
    if (q.length < 2) return [];
    var qWords = q.split(' ');
    var raw = _mtLatinDigits(String(query == null ? '' : query).trim());
    var max = limit === undefined ? 8 : limit;
    var first = [], later = [], byPhone = [];
    (players || []).forEach(function (p) {
        var full = mtNormalize(p.name);
        var at = full.indexOf(q) === 0 ? 0 : _mtWordsMatch(full.split(' '), qWords);
        if (at === 0) first.push(p);
        else if (at > 0) later.push(p);
        else if (!mtIsGuest(p.phone) && String(p.phone || '').indexOf(raw) >= 0) byPhone.push(p);
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
