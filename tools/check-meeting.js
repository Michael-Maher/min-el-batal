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

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
