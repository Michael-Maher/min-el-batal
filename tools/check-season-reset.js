#!/usr/bin/env node
/* Dev-only checks for the score-season / lesson-progress reset in game.js (not shipped).
   game.js is too DOM-heavy to load whole, so this pulls the season functions out by name
   and runs them against a stub GameState and a recording Firestore stub.
   Run: node tools/check-season-reset.js */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
var src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

function grab(name) {
    var start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('missing function ' + name);
    var i = src.indexOf('{', start), depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error('unbalanced ' + name);
}
function grabVar(name) {
    var m = src.match(new RegExp('var ' + name + ' = [^;]+;'));
    if (!m) throw new Error('missing var ' + name);
    return m[0];
}

var code = [grabVar('SCORE_SEASON_FIELDS'), grabVar('SCORE_SEASON_PROGRESS_FIELDS'),
    grab('_seasonMs'), grab('ensureTeamsReset'), grab('ensureScoreSeason'), grab('_ensurePointsSeason'), grab('ensureProgressReset')].join('\n');

function makeCtx(gs, season) {
    var writes = [];
    var db = { collection: function (c) { return { doc: function (d) { return {
        update: function (data) { writes.push({ c: c, d: d, data: data }); return Promise.resolve(); } }; } }; } };
    var ctx = { GameState: gs, _scoreSeason: season, firebaseDb: db, console: console, Date: Date };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    ctx._writes = writes;
    return ctx;
}
function oldPlayer() {
    return {
        playerPhone: '0100', createdAt: '2026-01-01T00:00:00Z', scoreSeasonId: '', progressResetId: '',
        stars: 900, gems: 50, xp: 300, currentLevel: 4,
        stationScores: { l1_bible_0: { total: 200 } }, miniGameScores: { l1_bible_0_mg_s0_langs: 50 },
        lessonSummaries: { l1_bible_0: { text: 'x' } }, watchedVideos: { v: true }, questionHistory: { a: ['q'] },
        level2Data: { faith: { done: 1 } }, levelsData: { 1: { stars: 3 } },
        level1Data: { l1_bible: { savedVerses: ['v'] } }, devotionLog: { d: 1 }, team: 'T',
        season: { id: 'x', startStars: 100, startStations: 5 }
    };
}
var SEASON = { id: 's1', startedAt: Date.parse('2026-10-11T00:00:00Z'), progressResetId: 's1' };

var failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); } }

test('no season: nothing changes', function () {
    var gs = oldPlayer(), ctx = makeCtx(gs, null);
    assert.strictEqual(ctx.ensureScoreSeason(), false);
    assert.strictEqual(gs.stars, 900);
    assert.strictEqual(Object.keys(gs.stationScores).length, 1);
    assert.strictEqual(ctx._writes.length, 0);
});

test('progress reset clears lessons and points, keeps the rest, replaces cloud maps', function () {
    var gs = oldPlayer(), ctx = makeCtx(gs, SEASON);
    assert.strictEqual(ctx.ensureScoreSeason(), true);
    ['stationScores', 'miniGameScores', 'lessonSummaries', 'watchedVideos', 'questionHistory', 'level2Data', 'levelsData'].forEach(function (k) {
        assert.deepStrictEqual(Object.keys(gs[k]), [], k + ' cleared');
    });
    assert.strictEqual(gs.stars, 0); assert.strictEqual(gs.gems, 0); assert.strictEqual(gs.xp, 0);
    assert.strictEqual(gs.currentLevel, 1);
    assert.strictEqual(gs.season.startStars, 0); assert.strictEqual(gs.season.startStations, 0);
    assert.strictEqual(gs.progressResetId, 's1'); assert.strictEqual(gs.scoreSeasonId, 's1');
    assert.deepStrictEqual(gs.level1Data, { l1_bible: { savedVerses: ['v'] } }, 'saved verses kept');
    assert.strictEqual(gs.team, 'T'); assert.deepStrictEqual(gs.devotionLog, { d: 1 });
    var pw = ctx._writes.filter(function (w) { return w.c === 'players'; })[0];
    var lw = ctx._writes.filter(function (w) { return w.c === 'leaderboard'; })[0];
    assert.ok(pw && pw.d === '0100', 'players doc replaced');
    assert.deepStrictEqual(Object.keys(pw.data.stationScores), []);
    assert.strictEqual(pw.data.progressResetId, 's1');
    assert.ok(lw && Object.keys(lw.data.stationScores).length === 0, 'leaderboard stationScores replaced');
});

test('second call is a no-op', function () {
    var gs = oldPlayer(), ctx = makeCtx(gs, SEASON);
    ctx.ensureScoreSeason();
    gs.stationScores = { l1_bible_0: { total: 30 } };   // new progress earned after the reset
    gs.stars = 12;
    var n = ctx._writes.length;
    assert.strictEqual(ctx.ensureScoreSeason(), false);
    assert.strictEqual(gs.stationScores.l1_bible_0.total, 30);
    assert.strictEqual(gs.stars, 12);
    assert.strictEqual(ctx._writes.length, n);
});

test('player who joined after the reset keeps everything', function () {
    var gs = oldPlayer(); gs.createdAt = '2026-10-12T00:00:00Z';
    var ctx = makeCtx(gs, SEASON);
    assert.strictEqual(ctx.ensureScoreSeason(), false);
    assert.strictEqual(gs.stars, 900);
    assert.strictEqual(Object.keys(gs.stationScores).length, 1);
    assert.strictEqual(gs.progressResetId, 's1');
});

test('points-only season leaves lessons alone', function () {
    var gs = oldPlayer(), ctx = makeCtx(gs, { id: 's2', startedAt: SEASON.startedAt });
    assert.strictEqual(ctx.ensureScoreSeason(), true);
    assert.strictEqual(gs.stars, 0);
    assert.strictEqual(Object.keys(gs.stationScores).length, 1);
    assert.strictEqual(ctx._writes.length, 0);
});

test('player who already took this season\'s points reset still gets the later progress reset', function () {
    var gs = oldPlayer(); gs.scoreSeasonId = 's1';
    var ctx = makeCtx(gs, SEASON);
    assert.strictEqual(ctx.ensureScoreSeason(), true);
    assert.strictEqual(Object.keys(gs.stationScores).length, 0);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
