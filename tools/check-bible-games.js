#!/usr/bin/env node
/* Dev-only checks for the Level 1 engine Bible games (not shipped, not in sw.js).
   Loads the subject data files + level1.js into a Node vm with tiny DOM stubs,
   then tests pure helpers and validates the Bible game data.
   Run: node tools/check-bible-games.js */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
var ROOT = path.join(__dirname, '..');

var ctx = {
    console: console, Math: Math, JSON: JSON, Date: Date,
    GameState: { stationScores: {}, miniGameScores: {} },
    window: { addEventListener: function () {} },
    document: { hidden: false, getElementById: function () { return null; }, addEventListener: function () {}, querySelectorAll: function () { return []; } },
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    saveToLocalStorage: function () {}
};
vm.createContext(ctx);
['level1-bible-data.js', 'level1-service-data.js', 'level2-life-data.js', 'level2-bible-data.js', 'level1.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});

var failed = 0, passed = 0;
function test(name, fn) {
    try { fn(); passed++; }
    catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}
// Deterministic random for placement tests (mulberry32)
function rng(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function withSubject(key, fn) {
    var prev = ctx.l1State.subject;
    ctx.l1State.subject = key;
    try { fn(); } finally { ctx.l1State.subject = prev; }
}

/* ---------------- scoring ---------------- */
test('service keeps the old caps', function () {
    withSubject('l1_service', function () {
        assert.strictEqual(ctx.l1BucketMax('games'), 140);
        assert.strictEqual(ctx.l1MaxTotal(), 200);
        assert.strictEqual(ctx.l1Stars(200), 3);
        assert.strictEqual(ctx.l1Stars(170), 2);
        assert.strictEqual(ctx.l1Stars(169), 1);
        assert.strictEqual(ctx.l1Stars(139), 0);
    });
});
test('life keeps the old caps', function () {
    withSubject('l2_life', function () {
        assert.strictEqual(ctx.l1BucketMax('games'), 140);
        assert.strictEqual(ctx.l1MaxTotal(), 200);
    });
});
test('bible subjects use 250 / 310', function () {
    ['l1_bible', 'l2_bible'].forEach(function (k) {
        withSubject(k, function () {
            assert.strictEqual(ctx.l1BucketMax('games'), 250, k);
            assert.strictEqual(ctx.l1BucketMax('learnRead'), 20, k);
            assert.strictEqual(ctx.l1MaxTotal(), 310, k);
            assert.strictEqual(ctx.l1Stars(310), 3, k);
            assert.strictEqual(ctx.l1Stars(225), 2, k);
            assert.strictEqual(ctx.l1Stars(224), 1, k);
            assert.strictEqual(ctx.l1Stars(140), 1, k);
            assert.strictEqual(ctx.l1Stars(139), 0, k);
        });
    });
});
test('bible station total can reach 310 and games clamp at 250', function () {
    withSubject('l1_bible', function () {
        ctx.GameState.stationScores = {};
        ctx.l1SetBucket(0, 'learnRead', 20, true);
        ctx.l1SetBucket(0, 'learnChecks', 20, true);
        ctx.l1SetBucket(0, 'summary', 20, true);
        var cur = ctx.l1SetBucket(0, 'games', 999, true);
        assert.strictEqual(cur.games, 250);
        assert.strictEqual(cur.total, 310);
    });
    ctx.GameState.stationScores = {};
});
test('service games still clamp at 140', function () {
    withSubject('l1_service', function () {
        ctx.GameState.stationScores = {};
        var cur = ctx.l1SetBucket(0, 'games', 999, true);
        assert.strictEqual(cur.games, 140);
    });
    ctx.GameState.stationScores = {};
});

/* ---------------- report ---------------- */
// (later tasks insert more test blocks above this line)
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
