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
    grab('_resetCloudSync'), grab('mergeStationScoreEntry'), grab('mergeLevel1Data'), grab('saveToCloud'), grab('saveToCloudIfChanged'),
    grab('_cloudSig'), grab('_cloudGet'), grab('_syncFieldKind'), grab('_syncBaseOf'), grab('_syncThreeWay'),
    grab('_writeToCloud'), grab('_cloudSaveData'), grab('mergeCloudIntoGameState'), grab('loadFromCloud')
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
        Blob: Blob, JSON: JSON, Math: Math, Date: Date, Promise: Promise, Object: Object,
        setTimeout: setTimeout, clearTimeout: clearTimeout
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
        ctx._resetCloudSync(); ctx.GameState.playerPhone = ''; ctx.GameState.stars = 0;   // what logout() does
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
    ctx._resetCloudSync(); ctx.GameState.playerPhone = '';
    return p.then(function () { assert.strictEqual(ctx._writes.length, 0); });
});

test('read failure (offline) skips the cloud write instead of writing blind', function () {
    var ctx = makeCtx(player({ stars: 200 }), CLOUD_RITA);
    vm.runInContext('firebaseDb = { collection: function () { return { doc: function () { return { get: function () { return Promise.reject(new Error("offline")); }, set: function () { throw new Error("must not write"); } }; } }; } };', ctx);
    var origErr = console.error; ctx.console.error = function () {};
    return ctx.saveToCloud().then(function () { console.error = origErr; assert.strictEqual(ctx._writes.length, 0); },
        function (e) { console.error = origErr; throw e; });
});

// --- 3-way merge: a device that already loaded or wrote this session has a baseline ---
// Saves once (fresh doc: no merge) so the device has a baseline, then lets "device B" change the cloud.
function synced(gs) {
    var ctx = makeCtx(player(gs), null);
    return ctx.saveToCloud().then(function () { return ctx; });
}
function otherDeviceSaves(ctx, changes) {
    Object.assign(ctx._store.doc, changes, { syncId: 'phoneB-' + Math.random() });
}
function lastWrite(ctx) { return ctx._writes[ctx._writes.length - 1]; }

test('3-way: a spend after another device saved stays spent (1000 -500, cloud 1010 -> 510)', function () {
    return synced({ stars: 1000 }).then(function (ctx) {
        otherDeviceSaves(ctx, { stars: 1010 });
        ctx.GameState.stars = 500;
        return ctx.saveToCloud().then(function () {
            assert.strictEqual(lastWrite(ctx).stars, 510);
            assert.strictEqual(ctx.GameState.stars, 510);
        });
    });
});

test('3-way: this device\'s own change (bibleChapter 4 -> 5) survives a cloud that moved for other reasons', function () {
    return synced({ bibleChapter: 4, stars: 100 }).then(function (ctx) {
        otherDeviceSaves(ctx, { stars: 120 });
        ctx.GameState.bibleChapter = 5;
        return ctx.saveToCloud().then(function () {
            assert.strictEqual(lastWrite(ctx).bibleChapter, 5);
            assert.strictEqual(ctx.GameState.bibleChapter, 5);
            assert.strictEqual(lastWrite(ctx).stars, 120);
        });
    });
});

test('3-way: a field only the other device changed (character) is adopted', function () {
    return synced({ character: 'david' }).then(function (ctx) {
        otherDeviceSaves(ctx, { character: 'paul' });
        return ctx.saveToCloud().then(function () {
            assert.strictEqual(lastWrite(ctx).character, 'paul');
            assert.strictEqual(ctx.GameState.character, 'paul');
        });
    });
});

test('3-way: both devices gained xp -> the gains add up', function () {
    return synced({ xp: 100 }).then(function (ctx) {
        otherDeviceSaves(ctx, { xp: 130 });
        ctx.GameState.xp = 150;
        return ctx.saveToCloud().then(function () { assert.strictEqual(lastWrite(ctx).xp, 180); });
    });
});

test('3-way: gems never go below zero', function () {
    return synced({ gems: 50 }).then(function (ctx) {
        otherDeviceSaves(ctx, { gems: 10 });
        ctx.GameState.gems = 0;
        return ctx.saveToCloud().then(function () { assert.strictEqual(lastWrite(ctx).gems, 0); });
    });
});

test('3-way: loadFromCloud sets the baseline from the cloud doc', function () {
    var ctx = makeCtx(player({ stars: 0 }), player({ stars: 1000, syncId: 'phoneB' }));
    return ctx.loadFromCloud('0155').then(function () { return new Promise(function (r) { setTimeout(r, 0); }); }).then(function () {
        otherDeviceSaves(ctx, { stars: 1010 });
        ctx.GameState.stars = 500;
        return ctx.saveToCloud();
    }).then(function () { assert.strictEqual(lastWrite(ctx).stars, 510); });
});

test('3-way falls back to the plain merge when the cloud moved to a new score season', function () {
    return synced({ stars: 1000, scoreSeasonId: 's1' }).then(function (ctx) {
        otherDeviceSaves(ctx, { stars: 30, scoreSeasonId: 's2' });   // new season: B earned 30 since the reset
        ctx.GameState.stars = 1200;                                   // old-season points must not come back
        return ctx.saveToCloud().then(function () {
            assert.strictEqual(lastWrite(ctx).stars, 30);
            assert.strictEqual(lastWrite(ctx).scoreSeasonId, 's2');
        });
    });
});

test('lastBibleDate is not in the save payload (written only by targeted updates)', function () {
    var ctx = makeCtx(player({ lastBibleDate: '2026-10-17', lastActiveDate: '2026-10-17' }), null);
    return ctx.saveToCloud().then(function () {
        assert.ok(!('lastBibleDate' in ctx._writes[0]));
        assert.ok(!('lastActiveDate' in ctx._writes[0]));
    });
});

test('timer save skips an unchanged payload and still writes a real change', function () {
    var ctx = makeCtx(player({ stars: 10 }), null);
    return ctx.saveToCloud().then(function () { return ctx.saveToCloudIfChanged(); }).then(function () {
        assert.strictEqual(ctx._writes.length, 1);
        assert.strictEqual(ctx._reads(), 1);
        ctx.GameState.stars = 11;
        return ctx.saveToCloudIfChanged();
    }).then(function () {
        assert.strictEqual(ctx._writes.length, 2);
        assert.strictEqual(ctx._writes[1].stars, 11);
    });
});

test('timer save never skips before the first successful write', function () {
    var ctx = makeCtx(player({ stars: 10 }), null);
    return ctx.saveToCloudIfChanged().then(function () { assert.strictEqual(ctx._writes.length, 1); });
});

test('a read that never settles times out, writes nothing and does not block later saves', function () {
    var ctx = makeCtx(player({ stars: 10 }), null);
    vm.runInContext('var _realDb = firebaseDb; firebaseDb = { collection: function () { return { doc: function () { return { get: function () { return new Promise(function () {}); } }; } }; } };', ctx);
    var asked = [];
    ctx.setTimeout = function (fn, ms) { asked.push(ms); return setTimeout(fn, 0); };   // the read timer fires at once
    ctx.console.error = function () {};
    return ctx.saveToCloud().then(function () {
        assert.strictEqual(ctx._writes.length, 0);
        assert.deepStrictEqual(asked, [30000]);
        vm.runInContext('firebaseDb = _realDb;', ctx);
        return ctx.saveToCloud();
    }).then(function () { assert.strictEqual(ctx._writes.length, 1); });
});

test('loadFromCloud keeps the newer local notifSeenAt', function () {
    var ctx = makeCtx(player({ notifSeenAt: 5000 }), player({ notifSeenAt: 3000, syncId: 'phoneB' }));
    return ctx.loadFromCloud('0155').then(function () { assert.strictEqual(ctx.GameState.notifSeenAt, 5000); });
});

// --- follow-up re-review cases ---
test('N1: a merge-save whose write fails does not count the other device twice on the retry', function () {
    return synced({ stars: 200 }).then(function (ctx) {
        otherDeviceSaves(ctx, { stars: 8000 });
        ctx.GameState.stars = 250;   // +50 here since the baseline
        var fails = 1;
        var docRef0 = ctx.firebaseDb.collection().doc();
        ctx.firebaseDb = { collection: function () { return { doc: function () { return {
            get: docRef0.get,
            set: function (d) { if (fails-- > 0) return Promise.reject(new Error('doc too big')); return docRef0.set(d); }
        }; } }; } };
        ctx.console.error = function () {};
        return ctx.saveToCloud().then(function () {
            assert.strictEqual(ctx._writes.length, 1, 'the failed write is not recorded');
            assert.strictEqual(ctx.GameState.stars, 8050);
            return ctx.saveToCloud();
        }).then(function () {
            assert.strictEqual(lastWrite(ctx).stars, 8050, 'cloud + local delta exactly once');
            return ctx.saveToCloud();
        }).then(function () { assert.strictEqual(lastWrite(ctx).stars, 8050); });
    });
});

test('N2: the real logout reset during the read still writes the progress made before it', function () {
    return synced({ stars: 70 }).then(function (ctx) {
        ctx.GameState.stars = 95;
        var p = ctx.saveToCloud();
        ctx._resetCloudSync();   // logout()
        ctx.GameState.playerPhone = ''; ctx.GameState.stars = 0;
        return p.then(function () {
            assert.strictEqual(lastWrite(ctx).stars, 95);
            assert.strictEqual(lastWrite(ctx).playerPhone, '0155');
            assert.strictEqual(vm.runInContext('_cloudSync.phone', ctx), '', 'logged-out save leaves the reset in place');
        });
    });
});

test('N2: a login reload during the read drops the old baseline (no double count)', function () {
    return synced({ stars: 100 }).then(function (ctx) {
        otherDeviceSaves(ctx, { stars: 300 });
        var p = ctx.saveToCloud();
        ctx._resetCloudSync(); ctx.GameState.stars = 300;   // password login: GameState reloaded from the cloud
        return p.then(function () { assert.strictEqual(lastWrite(ctx).stars, 300); });
    });
});

test('N3: plain-object fields merge per key (the other device\'s paid paul:2 survives)', function () {
    return synced({ characterTiers: { david: 1 }, levelsData: { 1: { stars: 3 } } }).then(function (ctx) {
        otherDeviceSaves(ctx, { characterTiers: { david: 1, paul: 2 }, levelsData: { 1: { stars: 3 }, 2: { stars: 1 } } });
        ctx.GameState.characterTiers = { david: 2 };
        ctx.GameState.levelsData = { 1: { stars: 3 }, 3: { stars: 2 } };
        return ctx.saveToCloud().then(function () {
            assert.deepStrictEqual(JSON.parse(JSON.stringify(lastWrite(ctx).characterTiers)), { david: 2, paul: 2 });
            assert.deepStrictEqual(Object.keys(lastWrite(ctx).levelsData).sort(), ['1', '2', '3']);
        });
    });
});

test('N3: a key removed on the changing side stays removed; a key only the cloud changed is adopted', function () {
    return synced({ equippedArmor: { head: 'h1', body: 'b1' } }).then(function (ctx) {
        otherDeviceSaves(ctx, { equippedArmor: { head: 'h1', body: 'b2' } });
        ctx.GameState.equippedArmor = { body: 'b1' };   // took the helmet off here
        return ctx.saveToCloud().then(function () {
            assert.deepStrictEqual(JSON.parse(JSON.stringify(lastWrite(ctx).equippedArmor)), { body: 'b2' });
        });
    });
});

test('N6: blitzWeeklyScore keeps the best of the same week, the new week otherwise', function () {
    return synced({ blitzWeeklyKey: 'w42', blitzWeeklyScore: 100 }).then(function (ctx) {
        otherDeviceSaves(ctx, { blitzWeeklyScore: 180 });
        ctx.GameState.blitzWeeklyScore = 150;
        return ctx.saveToCloud().then(function () {
            assert.strictEqual(lastWrite(ctx).blitzWeeklyScore, 180);
            otherDeviceSaves(ctx, { blitzWeeklyScore: 200 });
            ctx.GameState.blitzWeeklyKey = 'w43'; ctx.GameState.blitzWeeklyScore = 40;   // new week here
            return ctx.saveToCloud();
        }).then(function () {
            assert.strictEqual(lastWrite(ctx).blitzWeeklyKey, 'w43');
            assert.strictEqual(lastWrite(ctx).blitzWeeklyScore, 40);
        });
    });
});

(async function () {
    var failed = 0;
    for (var t of tests) {
        try { await t[1](); } catch (e) { failed++; console.log('FAIL ' + t[0] + '\n     ' + e.message); }
    }
    console.log((tests.length - failed) + '/' + tests.length + ' passed');
    process.exit(failed ? 1 : 0);
})();
