#!/usr/bin/env node
/* Dev-only checks for meeting-core.js (presenter-mode live quiz core; not shipped).
   Run: node tools/check-meeting.js */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
var src = fs.readFileSync(path.join(__dirname, '..', 'meeting-core.js'), 'utf8');

function load() {
    var ctx = { console: console, Math: Math, Date: Date, JSON: JSON };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return ctx;
}
function plain(x) { return JSON.parse(JSON.stringify(x)); }

var failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); } }

function freshNight(ctx) {
    var n = ctx.mtNewNight({ date: '2026-10-26', title: 'ليلة', levels: [1, 2], filter: { subjects: [], lessons: {} }, kinds: ['mcq'] });
    ctx.mtMakeRandomTeams(n, 4);
    return n;
}
function kid(ctx, n, phone, team) {
    return ctx.mtAddToRoster(n, { phone: phone, name: 'k' + phone, level: 1, team: '' }, team);
}

test('teams: 4 random teams use the first 4 presets', function () {
    var c = load(), n = c.mtNewNight({ date: 'd', title: 't', levels: [1], filter: { subjects: [], lessons: {} }, kinds: [] });
    c.mtMakeRandomTeams(n, 4);
    assert.deepStrictEqual(plain(n.teams.map(function (t) { return t.id; })), ['david', 'moses', 'joseph', 'daniel']);
    c.mtMakeRandomTeams(n, 1);
    assert.strictEqual(n.teams[4].id, 'esther');
    assert.strictEqual(n.teams.length, 5);
    c.mtMakeRandomTeams(n, 9);
    assert.strictEqual(n.teams.length, 6);
    assert.strictEqual(n.teams[5].id, 'paul');
    assert.strictEqual(n.teams[0].name, 'فريق داود');
    assert.strictEqual(n.teams[0].color, '#e74c3c');
    assert.strictEqual(n.teams[0].source, 'random');
});

test('teams: first call clamps to at least 2', function () {
    var c = load(), n = c.mtNewNight({ date: 'd', title: 't', levels: [1], filter: { subjects: [], lessons: {} }, kinds: [] });
    c.mtMakeRandomTeams(n, 0);
    assert.strictEqual(n.teams.length, 2);
});

test('roster: game-team kid auto-placed', function () {
    var c = load(), n = freshNight(c);
    var t = c.mtAddGameTeam(n, { name: 'مارمرقس', color: '#111', logo: '⚔️' });
    assert.strictEqual(t.source, 'game');
    assert.strictEqual(t.gameTeam, 'مارمرقس');
    var k = c.mtAddToRoster(n, { phone: '01', name: 'مينا', level: 1, team: 'مارمرقس' });
    assert.strictEqual(k.teamId, t.id);
    assert.strictEqual(n.roster['01'].teamId, t.id);
});

test('award individual', function () {
    var c = load(), n = freshNight(c);
    kid(c, n, '01', 'david');
    var a = c.mtAward(n, { phone: '01' }, 5, 'x');
    assert.strictEqual(n.roster['01'].stars, 5);
    assert.strictEqual(n.teams[0].score, 5);
    assert.deepStrictEqual(plain(a.phones), ['01']);
    assert.strictEqual(a.kind, 'individual');
});

function teamAwardNight(c) {
    var n = freshNight(c);
    kid(c, n, '01', 'david'); kid(c, n, '02', 'david'); kid(c, n, '03', 'moses');
    c.mtAward(n, { teamId: 'david' }, 5, 'y');
    return n;
}

test('award team goes to roster members only', function () {
    var c = load(), n = teamAwardNight(c);
    assert.strictEqual(n.roster['01'].stars, 5);
    assert.strictEqual(n.roster['02'].stars, 5);
    assert.strictEqual(n.roster['03'].stars, 0);
    assert.strictEqual(n.teams[0].score, 5);
});

test('multiplier', function () {
    var c = load(), n = freshNight(c);
    kid(c, n, '01', 'david');
    n.current = { golden: false };
    n.multiplier = 2;
    assert.strictEqual(c.mtPointsForCurrent(n), 10);
    c.mtAward(n, { phone: '01' }, 10, 'x');
    assert.strictEqual(n.multiplier, 1);
    assert.strictEqual(c.mtPointsForCurrent(n), 5);
    n.current.golden = true;
    assert.strictEqual(c.mtPointsForCurrent(n), 15);
});

test('undo reverses team award', function () {
    var c = load(), n = teamAwardNight(c);
    var u = c.mtUndoLast(n);
    assert.strictEqual(n.roster['01'].stars, 0);
    assert.strictEqual(n.roster['02'].stars, 0);
    assert.strictEqual(n.teams[0].score, 0);
    var last = n.awards[n.awards.length - 1];
    assert.strictEqual(last.kind, 'undo');
    assert.strictEqual(last.points, -5);
    assert.strictEqual(u, last);
    assert.strictEqual(c.mtUndoLast(n), null);
});

test('second undo skips the undo and the undone award', function () {
    var c = load(), n = freshNight(c);
    kid(c, n, '01', 'david');
    c.mtAward(n, { phone: '01' }, 5, 'a');
    c.mtAward(n, { phone: '01' }, 5, 'b');
    c.mtUndoLast(n);
    assert.strictEqual(n.roster['01'].stars, 5);
    c.mtUndoLast(n);
    assert.strictEqual(n.roster['01'].stars, 0);
    assert.strictEqual(n.teams[0].score, 0);
    assert.strictEqual(c.mtUndoLast(n), null);
});

test('screen score never touches stars', function () {
    var c = load(), n = teamAwardNight(c);
    c.mtScreenScore(n, 'david', -5);
    assert.strictEqual(n.teams[0].score, 0);
    c.mtScreenScore(n, 'david', -5);
    assert.strictEqual(n.teams[0].score, -5);
    assert.strictEqual(n.roster['01'].stars, 5);
    assert.strictEqual(n.roster['03'].stars, 0);
});

test('standings and top kids', function () {
    var c = load(), n = freshNight(c);
    kid(c, n, '01', 'david'); kid(c, n, '02', 'moses');
    c.mtAward(n, { phone: '02' }, 5, 'a'); c.mtAward(n, { phone: '02' }, 5, 'b'); c.mtAward(n, { phone: '01' }, 5, 'c');
    assert.strictEqual(c.mtStandings(n)[0].id, 'moses');
    assert.deepStrictEqual(plain(c.mtTopKids(n, 1).map(function (k) { return k.phone; })), ['02']);
});

test('pending syncs', function () {
    var c = load(), n = freshNight(c);
    kid(c, n, '01', 'david'); kid(c, n, '02', 'david');
    var a1 = c.mtAward(n, { phone: '01' }, 5, 'a');
    a1.synced['01'] = true;
    var a2 = c.mtAward(n, { teamId: 'david' }, 5, 'b');
    var p = plain(c.mtPendingSyncs(n));
    assert.deepStrictEqual(p, [
        { awardId: a2.id, phone: '01', points: 5 },
        { awardId: a2.id, phone: '02', points: 5 }
    ]);
    var a0 = n.awards[0];
    a0.synced = {};
    assert.strictEqual(c.mtPendingSyncs(n)[0].awardId, a0.id);
});

test('restore round-trip', function () {
    var c = load(), n = teamAwardNight(c);
    c.mtUndoLast(n);
    var r = c.mtRestore(c.mtSerialize(n));
    assert.deepStrictEqual(plain(r), plain(n));
    assert.strictEqual(c.mtRestore('{"v":2}'), null);
    assert.strictEqual(c.mtRestore('nope'), null);
    assert.strictEqual(c.mtRestore('null'), null);
});

// ---- audience view ----
var KINDS = ['mcq', 'tf', 'clues', 'verse', 'scenario', 'order', 'emoji', 'anagram', 'odd', 'deep', 'sixty', 'act', 'draw', 'taboo', 'hymn'];
function fixture(k) {
    var it = { id: 'id_' + k, level: 1, subject: 'bible', station: 0, kind: k, difficulty: 1 };
    it.explain = 'EXP_' + k;
    switch (k) {
        case 'mcq': case 'verse': case 'scenario':
            it.prompt = 'P_' + k; it.options = ['O1_' + k, 'O2_' + k, 'O3_' + k, 'O4_' + k]; it.correct = 1; it.answer = 'ANS_' + k; break;
        case 'tf':
            it.prompt = 'P_tf'; it.options = ['صح', 'غلط']; it.correct = 0; it.answer = 'ANS_tf'; break;
        case 'clues':
            it.clues = ['C1', 'C2', 'C3', 'C4']; it.answer = 'ANS_clues'; break;
        case 'order':
            it.prompt = 'P_order'; it.steps = ['ST1', 'ST2', 'ST3']; it.shuffled = ['ST3', 'ST1', 'ST2']; it.answer = 'ANS_order'; break;
        case 'emoji':
            it.prompt = 'P_emoji'; it.answer = 'ANS_emoji'; break;
        case 'anagram':
            it.scrambled = 'SCR_anagram'; it.answer = 'ANS_anagram'; break;
        case 'odd':
            it.items = ['I1', 'I2', 'I3', 'I4']; it.odd = 2; it.answer = 'ANS_odd'; break;
        case 'deep':
            it.prompt = 'P_deep'; it.answer = 'ANS_deep'; break;
        case 'sixty':
            it.prompt = 'P_sixty'; it.list = ['LST1', 'LST2', 'LST3']; it.answer = 'ANS_sixty'; break;
        case 'act': case 'draw':
            it.secret = 'SEC_' + k; it.answer = 'SEC_' + k; break;
        case 'taboo':
            it.secret = 'SEC_taboo'; it.forbidden = ['FORB1', 'FORB2', 'FORB3']; it.answer = 'SEC_taboo'; break;
        case 'hymn':
            it.firstLine = 'FIRST_hymn'; it.answer = 'ANS_hymn'; break;
    }
    return it;
}
function viewNight(c, item, stage, extra) {
    var n = freshNight(c);
    n.current = { item: item, target: { level: 'all', mode: 'individual', teamId: null }, stage: stage, clueIdx: 0, optionsShown: 0, timerEndsAt: 0, timerSec: 30, golden: false, count: 7 };
    if (extra) Object.keys(extra).forEach(function (key) { n.current[key] = extra[key]; });
    return n;
}

test('audience view hides answers', function () {
    KINDS.forEach(function (k) {
        var c = load(), it = fixture(k);
        var n = viewNight(c, it, 'preview');
        assert.strictEqual(c.mtAudienceView(n).item, null, k + ' preview item');
        n.current.stage = 'shown'; n.current.clueIdx = 0; n.current.optionsShown = 4;
        var s = JSON.stringify(c.mtAudienceView(n));
        ['answer', 'explain', 'secret'].forEach(function (f) {
            if (it[f]) assert.ok(s.indexOf(it[f]) < 0, k + ' leaks ' + f);
        });
        (it.forbidden || []).forEach(function (f) { assert.ok(s.indexOf(f) < 0, k + ' leaks forbidden'); });
        assert.ok(!/"correct":/.test(s), k + ' leaks correct key');
        assert.ok(!/"odd":/.test(s), k + ' leaks odd key');
        (it.list || []).forEach(function (f) { assert.ok(s.indexOf(f) < 0, k + ' leaks list'); });
        n.current.stage = 'revealed';
        var r = JSON.stringify(c.mtAudienceView(n));
        assert.ok(r.indexOf(it.answer) >= 0, k + ' reveal lacks answer');
        assert.ok(r.indexOf(it.explain) >= 0, k + ' reveal lacks explain');
    });
});

test('audience view reveal carries solutions', function () {
    var c = load(), v;
    v = c.mtAudienceView(viewNight(c, fixture('mcq'), 'revealed'));
    assert.strictEqual(v.item.correct, 1); assert.strictEqual(v.item.options.length, 4);
    v = c.mtAudienceView(viewNight(c, fixture('odd'), 'revealed'));
    assert.strictEqual(v.item.odd, 2);
    v = c.mtAudienceView(viewNight(c, fixture('order'), 'revealed'));
    assert.deepStrictEqual(plain(v.item.steps), ['ST1', 'ST2', 'ST3']);
    v = c.mtAudienceView(viewNight(c, fixture('sixty'), 'revealed'));
    assert.deepStrictEqual(plain(v.item.list), ['LST1', 'LST2', 'LST3']);
});

test('audience view shows kind payloads', function () {
    var c = load(), v;
    v = c.mtAudienceView(viewNight(c, fixture('order'), 'shown'));
    assert.deepStrictEqual(plain(v.item.steps), ['ST3', 'ST1', 'ST2']);
    v = c.mtAudienceView(viewNight(c, fixture('anagram'), 'shown'));
    assert.strictEqual(v.item.scrambled, 'SCR_anagram');
    v = c.mtAudienceView(viewNight(c, fixture('odd'), 'shown'));
    assert.deepStrictEqual(plain(v.item.items), ['I1', 'I2', 'I3', 'I4']);
    v = c.mtAudienceView(viewNight(c, fixture('sixty'), 'shown'));
    assert.strictEqual(v.item.count, 7);
    v = c.mtAudienceView(viewNight(c, fixture('hymn'), 'shown'));
    assert.strictEqual(v.item.firstLine, 'FIRST_hymn');
    v = c.mtAudienceView(viewNight(c, fixture('taboo'), 'shown'));
    assert.deepStrictEqual(plain(v.item), { kind: 'taboo' });
});

test('audience view clues', function () {
    var c = load();
    var v = c.mtAudienceView(viewNight(c, fixture('clues'), 'shown', { clueIdx: 1 }));
    assert.deepStrictEqual(plain(v.item.clues), ['C1', 'C2']);
});

test('audience view options', function () {
    var c = load();
    var v = c.mtAudienceView(viewNight(c, fixture('mcq'), 'shown', { optionsShown: 2 }));
    assert.deepStrictEqual(plain(v.item.options), ['O1_mcq', 'O2_mcq']);
});

test('audience view header: teams, leader, timer', function () {
    var c = load(), n = freshNight(c);
    kid(c, n, '01', 'moses');
    var v = c.mtAudienceView(n);
    assert.strictEqual(v.item, null); assert.strictEqual(v.stage, null); assert.strictEqual(v.leaderId, null);
    assert.strictEqual(v.title, 'ليلة');
    c.mtAward(n, { phone: '01' }, 5, 'a');
    n.current = { item: fixture('deep'), target: { level: 1, mode: 'speed', teamId: null }, stage: 'shown', clueIdx: 0, optionsShown: 0, timerEndsAt: 123, timerSec: 20, golden: true, count: 0 };
    v = c.mtAudienceView(n);
    assert.strictEqual(v.leaderId, 'moses');
    assert.strictEqual(v.timerEndsAt, 123); assert.strictEqual(v.timerSec, 20); assert.strictEqual(v.golden, true);
    assert.strictEqual(v.target.mode, 'speed');
    assert.deepStrictEqual(Object.keys(v.teams[0]).sort(), ['color', 'icon', 'id', 'name', 'score']);
});


/* ---- Task 2: pool, picker, search ---- */
function lcg(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function bankItem(id, o) {
    var it = { id: id, level: 1, subject: 'l1_bible', station: 0, kind: 'mcq', difficulty: 1, explain: 'E', prompt: 'P ' + id,
        options: ['a', 'b', 'c', 'd'], correct: 2 };
    Object.keys(o || {}).forEach(function (k) { it[k] = o[k]; });
    return it;
}
function loadPool(bank, cbItems) {
    var ctx = { console: console, Math: Math, Date: Date, JSON: JSON };
    vm.createContext(ctx);
    vm.runInContext('var COMPETE_SUBJECTS=[{key:"l1_bible",level:1},{key:"l2_bible",level:2}];' +
        'var __cb=' + JSON.stringify(cbItems || []) + ';function competeBankFor(f){return __cb.slice();}' +
        'var MEETING_BANK=' + JSON.stringify(bank || []) + ';', ctx);
    vm.runInContext(src, ctx);
    return ctx;
}
function poolNight(c, o) {
    o = o || {};
    return c.mtNewNight({ date: 'd', title: 't', levels: o.levels || [1], filter: { subjects: [], lessons: {} }, kinds: o.kinds || ['mcq'] });
}
function ids(a) { return plain(a.map(function (x) { return x.id; })); }

test('pool filters by level and station', function () {
    var c = loadPool([
        bankItem('s0', { station: 0 }), bankItem('s2', { station: 2 }), bankItem('gen', { station: null }),
        bankItem('l2', { level: 2, subject: 'l2_bible', station: 0 })
    ]);
    var pool = c.mtBuildPool({ subjects: ['l1_bible'], lessons: { l1_bible: [0] } }, [1]);
    assert.deepStrictEqual(ids(pool).sort(), ['gen', 's0']);
    var all = c.mtBuildPool({ subjects: ['l1_bible'], lessons: { l1_bible: [] } }, [1]);
    assert.deepStrictEqual(ids(all).sort(), ['gen', 's0', 's2']);
});

test('pool maps compete items', function () {
    var c = loadPool([], [
        { q: 'Q1', options: ['x', 'y'], correct: 1, explain: 'ex', kind: 'mcq', subject: 'l1_bible', lesson: 3 },
        { q: 'first', clues: ['second', 'third'], options: ['n1', 'n2'], correct: 0, kind: 'clues', subject: 'l1_bible', lesson: 1 },
        { q: 'Q2', options: ['x', 'y'], correct: 0, kind: 'mcq', subject: 'l2_bible', lesson: 0 }
    ]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1]);
    assert.strictEqual(pool.length, 2);
    assert.strictEqual(pool[0].id, 'cb_' + c.mtHash('l1_bible|3|Q1'));
    assert.strictEqual(pool[0].answer, 'y'); assert.strictEqual(pool[0].station, 3); assert.strictEqual(pool[0].level, 1);
    assert.deepStrictEqual(plain(pool[1].clues), ['first', 'second', 'third']);
    assert.strictEqual(pool[1].answer, 'n1');
});

test('pool maps tf and secret kinds', function () {
    var c = loadPool([
        bankItem('t1', { kind: 'tf', answer: 'صح', options: undefined, correct: undefined }),
        bankItem('t2', { kind: 'tf', answer: 'غلط', options: undefined, correct: undefined }),
        bankItem('a1', { kind: 'act', secret: 'موسى', options: undefined, correct: undefined }),
        bankItem('d1', { kind: 'draw', secret: 'سفينة', options: undefined, correct: undefined }),
        bankItem('k1', { kind: 'taboo', secret: 'نوح', forbidden: ['1', '2', '3'], options: undefined, correct: undefined })
    ]);
    var by = {};
    c.mtBuildPool({ subjects: [], lessons: {} }, [1]).forEach(function (it) { by[it.id] = it; });
    assert.deepStrictEqual(plain(by.t1.options), ['صح', 'غلط']); assert.strictEqual(by.t1.correct, 0);
    assert.strictEqual(by.t2.correct, 1);
    assert.strictEqual(by.a1.answer, 'موسى'); assert.strictEqual(by.d1.answer, 'سفينة'); assert.strictEqual(by.k1.answer, 'نوح');
});

test('pick prefers lesson, then fallback, then oldest', function () {
    var c = loadPool([bankItem('st', { station: 0 }), bankItem('fb', { station: null })]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1]), n = poolNight(c), r = lcg(1);
    assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq' }, {}, r).id, 'st');
    assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq' }, { st: '2026-10-01' }, r).id, 'fb');
    assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq' }, { st: '2026-10-01', fb: '2026-09-01' }, r).id, 'fb');
});

test('pick skips usedTonight and skipped', function () {
    var c = loadPool([bankItem('a'), bankItem('b'), bankItem('c')]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1]), n = poolNight(c), r = lcg(2);
    n.usedTonight.push('a'); n.skipped.push('b');
    for (var i = 0; i < 10; i++) assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq' }, {}, r).id, 'c');
    n.usedTonight.push('c');
    assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq' }, {}, r), null);
});

test("pick 'all' uses level 1 when night has level 1", function () {
    var c = loadPool([bankItem('one'), bankItem('two', { level: 2, subject: 'l2_bible' })]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1, 2]), r = lcg(3);
    assert.strictEqual(c.mtPickNext(pool, poolNight(c, { levels: [1, 2] }), { level: 'all', kind: 'mcq' }, {}, r).id, 'one');
    assert.strictEqual(c.mtPickNext(pool, poolNight(c, { levels: [2] }), { level: 'all', kind: 'mcq' }, {}, r).id, 'two');
});

test('kind null avoids lastKind', function () {
    var c = loadPool([bankItem('m1'), bankItem('m2'), bankItem('e1', { kind: 'emoji', options: undefined, correct: undefined, answer: 'x' }),
        bankItem('e2', { kind: 'emoji', options: undefined, correct: undefined, answer: 'y' })]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1]), n = poolNight(c, { kinds: ['mcq', 'emoji'] }), r = lcg(4);
    ['mcq', 'emoji'].forEach(function (lk) {
        n.lastKind = lk;
        for (var i = 0; i < 20; i++) assert.notStrictEqual(c.mtPickNext(pool, n, { level: 1, kind: null }, {}, r).kind, lk);
    });
});

test('difficulty filter with fallback', function () {
    var c = loadPool([bankItem('d1', { difficulty: 1 }), bankItem('d3', { difficulty: 3 })]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1]), n = poolNight(c), r = lcg(5);
    for (var i = 0; i < 10; i++) assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq', difficulty: 3 }, {}, r).id, 'd3');
    n.usedTonight.push('d3');
    assert.strictEqual(c.mtPickNext(pool, n, { level: 1, kind: 'mcq', difficulty: 3 }, {}, r).id, 'd1');
});

test('available kinds hides empty', function () {
    var c = loadPool([bankItem('m1'), bankItem('h2', { kind: 'hymn', level: 2, subject: 'l2_bible', firstLine: 'f', answer: 'a', options: undefined, correct: undefined })]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1, 2]);
    assert.deepStrictEqual(plain(c.mtAvailableKinds(pool, poolNight(c, { levels: [1], kinds: ['mcq', 'hymn'] }))), ['mcq']);
    assert.deepStrictEqual(plain(c.mtAvailableKinds(pool, poolNight(c, { levels: [1, 2], kinds: ['mcq', 'hymn'] }))), ['mcq', 'hymn']);
});

test('scramble differs', function () {
    var c = loadPool([]), r = lcg(6);
    for (var i = 0; i < 30; i++) {
        var s = c.mtScramble('أثناسيوس', r);
        assert.notStrictEqual(s, 'أثناسيوس');
        assert.strictEqual(s.split('').sort().join(''), 'أثناسيوس'.split('').sort().join(''));
    }
    assert.strictEqual(c.mtScramble('بيت لحم', r).indexOf(' '), -1);
    assert.strictEqual(c.mtScramble('ااا', r), 'ااا');
});

test('picked item is prepared copy: options shuffle keeps answer', function () {
    var c = loadPool([bankItem('m1'), bankItem('o1', { kind: 'order', steps: ['s1', 's2', 's3', 's4'], options: undefined, correct: undefined, answer: 'x' }),
        bankItem('g1', { kind: 'anagram', answer: 'أثناسيوس', options: undefined, correct: undefined })]);
    var pool = c.mtBuildPool({ subjects: [], lessons: {} }, [1]), n = poolNight(c, { kinds: ['mcq', 'order', 'anagram'] });
    var before = JSON.stringify(pool);
    for (var i = 0; i < 20; i++) {
        var r = lcg(10 + i);
        var m = c.mtPickNext(pool, n, { level: 1, kind: 'mcq' }, {}, r);
        assert.strictEqual(m.options[m.correct], 'c'); assert.strictEqual(m.answer, 'c');
        var o = c.mtPickNext(pool, n, { level: 1, kind: 'order' }, {}, r);
        assert.deepStrictEqual(plain(o.shuffled.slice().sort()), ['s1', 's2', 's3', 's4']);
        assert.notDeepStrictEqual(plain(o.shuffled), ['s1', 's2', 's3', 's4']);
        assert.deepStrictEqual(plain(o.steps), ['s1', 's2', 's3', 's4']);
        var g = c.mtPickNext(pool, n, { level: 1, kind: 'anagram' }, {}, r);
        assert.notStrictEqual(g.scrambled, 'أثناسيوس');
    }
    assert.strictEqual(JSON.stringify(pool), before);
});

test('normalize variants', function () {
    var c = loadPool([]);
    assert.strictEqual(c.mtNormalize('أحمد'), c.mtNormalize('احمد'));
    assert.strictEqual(c.mtNormalize('مريمة'), c.mtNormalize('مريمه'));
    assert.strictEqual(c.mtNormalize('مُنى'), c.mtNormalize('مني'));
    assert.strictEqual(c.mtNormalize('  Mina   X '), 'mina x');
});

test('search finds same-name kids', function () {
    var c = loadPool([]);
    var ps = [{ name: 'أمير مينا', phone: '03' }, { name: 'مينا عادل', phone: '01' }, { name: 'مينا سمير', phone: '02' }];
    assert.deepStrictEqual(plain(c.mtSearch(ps, 'مين').map(function (p) { return p.phone; })), ['01', '02', '03']);
    assert.deepStrictEqual(plain(c.mtSearch(ps, 'م')), []);
    assert.deepStrictEqual(plain(c.mtSearch(ps, '0')), []);
    assert.deepStrictEqual(plain(c.mtSearch(ps, '02').map(function (p) { return p.phone; })), ['02']);
    assert.strictEqual(c.mtSearch(ps, 'مين', 2).length, 2);
});

test('random pick uses roster first, then all, never excluded', function () {
    var c = loadPool([]), n = poolNight(c, { levels: [1, 2] }), r = lcg(7);
    var players = [];
    for (var i = 1; i <= 7; i++) players.push({ phone: 'p' + i, name: 'n' + i, level: (i === 5 || i === 6) ? 2 : 1 });
    for (i = 1; i <= 4; i++) c.mtAddToRoster(n, players[i - 1], null);
    n.excluded.push('p1');
    for (i = 0; i < 40; i++) { var k = c.mtRandomPick(n, players, 1, r); assert.ok(['p2', 'p3', 'p4'].indexOf(k.phone) >= 0, 'roster only: ' + k.phone); }
    n.excluded.push('p2');
    var seen = {};
    for (i = 0; i < 80; i++) { var q = c.mtRandomPick(n, players, 1, r); assert.ok(['p3', 'p4', 'p7'].indexOf(q.phone) >= 0, 'fallback: ' + q.phone); seen[q.phone] = 1; }
    assert.ok(seen.p7, 'falls back to all players');
    assert.strictEqual(c.mtRandomPick(n, players, 'all', r) !== null, true);
    n.excluded = players.map(function (p) { return p.phone; });
    assert.strictEqual(c.mtRandomPick(n, players, 1, r), null);
});

test('timers and hash', function () {
    var c = loadPool([]);
    assert.strictEqual(c.mtTimerFor('mcq', 'individual'), 30);
    assert.strictEqual(c.mtTimerFor('tf', 'speed'), 10);
    assert.strictEqual(c.mtTimerFor('deep', 'speed'), 45);
    assert.strictEqual(Object.keys(c.MT_KINDS).length, 15);
    assert.ok(/^[0-9a-f]{8}$/.test(c.mtHash('abc')));
    assert.strictEqual(c.mtHash('a'), 'e40c292c');
});

test('bank deps load standalone', function () {
    var ctx = { console: console, Math: Math, Date: Date, JSON: JSON, setTimeout: setTimeout };
    ctx.window = { addEventListener: function () {} };
    ctx.document = { addEventListener: function () {}, getElementById: function () { return null; } };
    vm.createContext(ctx);
    ['level1-bible-data.js', 'level1-service-data.js', 'level2-life-data.js', 'level2-bible-data.js', 'level1.js', 'compete-bank.js', 'meeting-core.js'].forEach(function (f) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
    });
    var pool = ctx.mtBuildPool({ subjects: ['l1_bible', 'l2_bible'], lessons: {} }, [1, 2]);
    assert.ok(pool.length > 50, 'pool size ' + pool.length);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
