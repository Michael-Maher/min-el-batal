#!/usr/bin/env node
/* Dev-only checks for saveToCloud() in game.js (not shipped): a stale device must never
   overwrite newer progress another device saved. Pulls the save/merge functions out by name
   and runs them against a stub GameState, localStorage and Firestore.
   Run: node tools/check-cloud-save.js */
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

var code = [
    'var _cloudSync = { phone: \'\', id: null }; var _cloudSaveRunning = null, _cloudSaveQueued = null;',
    grab('mergeStationScoreEntry'), grab('mergeLevel1Data'), grab('saveToCloud'), grab('_writeToCloud'),
    grab('_cloudSaveData'), grab('mergeCloudIntoGameState'), grab('loadFromCloud')
].join('\n');

function player(over) {
    var gs = {
        playerName: 'ريتا', playerPhone: '0155', stars: 0, gems: 0, xp: 0, totalCorrect: 0, totalAnswered: 0,
        bestStreak: 0, gamesPlayed: 0, scoreSeasonId: 's1', progressResetId: 's1',
        bibleReadingLog: {}, bibleChapter: 1, stationScores: {}, miniGameScores: {}, dailyVerseLog: {},
        devotionLog: {}, exerciseLog: {}, lessonSummaries: {}, watchedVideos: {}, questionHistory: {},
        level1Data: {}, level2Data: {}, lampData: {}, powerUps: {}, armor: [], team: ''
    };
    return Object.assign(gs, over || {});
}

function makeCtx(gs, cloudDoc) {
    var store = { doc: cloudDoc ? JSON.parse(JSON.stringify(cloudDoc)) : null }, writes = [], reads = 0, local = {};
    var docRef = {
        get: function () { reads++; var d = store.doc; return Promise.resolve({ exists: !!d, data: function () { return JSON.parse(JSON.stringify(d)); } }); },
        set: function (data) {
            writes.push(data);
            var next = Object.assign({}, store.doc || {});
            Object.keys(data).forEach(function (k) { next[k] = data[k]; });
            store.doc = JSON.parse(JSON.stringify(next));
            return Promise.resolve();
        }
    };
    var ctx = {
        GameState: gs, console: { log: function () {}, warn: function () {}, error: console.error },
        firebaseDb: { collection: function () { return { doc: function () { return docRef; } }; } },
        firebase: { firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; } } } },
        localStorage: { getItem: function (k) { return local[k] || null; }, setItem: function (k, v) { local[k] = v; } },
        saveToLocalStorage: function () { local.minElBatal_gameState = JSON.stringify(gs); },
        ensureScoreSeason: function () { return false; }, onScoreSeasonReset: function () {},
        Blob: Blob, JSON: JSON, Math: Math, Date: Date, Promise: Promise, Object: Object
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    ctx.saveToLocalStorage();
    ctx._store = store; ctx._writes = writes; ctx._reads = function () { return reads; };
    return ctx;
}

var tests = [];
function test(name, fn) { tests.push([name, fn]); }

var CLOUD_RITA = player({ stars: 8000, xp: 900, bibleChapter: 12, syncId: 'phoneB',
    bibleReadingLog: { '2026-10-15': { chapter: 11, done: true }, '2026-10-16': { chapter: 12, done: true } },
    stationScores: { l1_bible_0: { quiz: 300, total: 300 } } });

test('stale device (never synced this session) keeps the newer cloud progress', function () {
    var ctx = makeCtx(player({ stars: 200 }), CLOUD_RITA);
    return ctx.saveToCloud().then(function () {
        var w = ctx._writes[0];
        assert.strictEqual(w.stars, 8000);
        assert.strictEqual(Object.keys(w.bibleReadingLog).length, 2);
        assert.strictEqual(w.bibleChapter, 12);
        assert.strictEqual(w.stationScores.l1_bible_0.total, 300);
        assert.strictEqual(ctx.GameState.stars, 8000, 'screen shows the merged stars');
    });
});

test('stale device whose last save was days ago merges when another device saved since', function () {
    var ctx = makeCtx(player({ stars: 200 }), CLOUD_RITA);
    vm.runInContext('_cloudSync = { phone: "0155", id: "phoneA-old" };', ctx);
    return ctx.saveToCloud().then(function () {
        assert.strictEqual(ctx._writes[0].stars, 8000);
        assert.strictEqual(Object.keys(ctx._writes[0].bibleReadingLog).length, 2);
    });
});

test('local progress newer than the cloud is kept', function () {
    var ctx = makeCtx(player({ stars: 8050, bibleReadingLog: { '2026-10-17': { chapter: 13, done: true } } }), CLOUD_RITA);
    return ctx.saveToCloud().then(function () {
        assert.strictEqual(ctx._writes[0].stars, 8050);
        assert.strictEqual(Object.keys(ctx._writes[0].bibleReadingLog).length, 3);
    });
});

test('own last save: no merge, local value written as-is (spending stars sticks)', function () {
    var ctx = makeCtx(player({ stars: 100 }), null);
    return ctx.saveToCloud().then(function () {
        ctx.GameState.stars = 40;   // bought something
        return ctx.saveToCloud();
    }).then(function () {
        assert.strictEqual(ctx._writes.length, 2);
        assert.strictEqual(ctx._writes[1].stars, 40);
    });
});

test('every write carries a fresh syncId and the device remembers it', function () {
    var ctx = makeCtx(player({ stars: 1 }), null);
    return ctx.saveToCloud().then(function () { return ctx.saveToCloud(); }).then(function () {
        var a = ctx._writes[0].syncId, b = ctx._writes[1].syncId;
        assert.ok(a && b && a !== b);
        assert.strictEqual(vm.runInContext('_cloudSync.id', ctx), b);
    });
});

test('bursts of saves coalesce and never overlap', function () {
    var ctx = makeCtx(player({ stars: 5 }), null);
    var ps = [ctx.saveToCloud(), ctx.saveToCloud(), ctx.saveToCloud(), ctx.saveToCloud()];
    return Promise.all(ps).then(function () {
        assert.strictEqual(ctx._writes.length, 2, 'one running + one queued');
        assert.strictEqual(ctx._reads(), 2);
    });
});

test('loadFromCloud remembers the syncId so the follow-up save does not re-merge', function () {
    var ctx = makeCtx(player({ stars: 0 }), CLOUD_RITA);
    return ctx.loadFromCloud('0155').then(function () { return new Promise(function (r) { setTimeout(r, 0); }); }).then(function () {
        assert.strictEqual(ctx.GameState.stars, 8000);
        assert.strictEqual(ctx._writes.length, 1);
        assert.strictEqual(ctx._writes[0].stars, 8000);
    });
});

test('logout while the doc is being read still saves the progress made before it', function () {
    var ctx = makeCtx(player({ stars: 70 }), null);
    return ctx.saveToCloud().then(function () {
        ctx.GameState.stars = 95;
        var p = ctx.saveToCloud();
        ctx.GameState.playerPhone = ''; ctx.GameState.stars = 0;   // logout()
        return p;
    }).then(function () {
        assert.strictEqual(ctx._writes.length, 2);
        assert.strictEqual(ctx._writes[1].stars, 95);
        assert.strictEqual(ctx._writes[1].playerPhone, '0155');
    });
});

test('logout during the read skips the write when another device saved since', function () {
    var ctx = makeCtx(player({ stars: 200 }), CLOUD_RITA);
    vm.runInContext('_cloudSync = { phone: "0155", id: "phoneA-old" };', ctx);
    var p = ctx.saveToCloud();
    ctx.GameState.playerPhone = '';
    return p.then(function () { assert.strictEqual(ctx._writes.length, 0); });
});

test('read failure (offline) skips the cloud write instead of writing blind', function () {
    var ctx = makeCtx(player({ stars: 200 }), CLOUD_RITA);
    vm.runInContext('firebaseDb = { collection: function () { return { doc: function () { return { get: function () { return Promise.reject(new Error("offline")); }, set: function () { throw new Error("must not write"); } }; } }; } };', ctx);
    var origErr = console.error; ctx.console.error = function () {};
    return ctx.saveToCloud().then(function () { console.error = origErr; assert.strictEqual(ctx._writes.length, 0); },
        function (e) { console.error = origErr; throw e; });
});

(async function () {
    var failed = 0;
    for (var t of tests) {
        try { await t[1](); } catch (e) { failed++; console.log('FAIL ' + t[0] + '\n     ' + e.message); }
    }
    console.log((tests.length - failed) + '/' + tests.length + ' passed');
    process.exit(failed ? 1 : 0);
})();
