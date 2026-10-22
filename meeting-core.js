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
