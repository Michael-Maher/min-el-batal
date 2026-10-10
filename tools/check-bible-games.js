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
test('l1GamesTotal clamping: Bible 250, Service 140', function () {
    // l1GamesTotal(n) sums individual game scores (capped at each game.max) then clamps to l1BucketMax('games').
    // This test feeds in sums that exceed both caps to verify the per-subject clamping works.
    // Bible real games sum to 140; add 3 synthetic games (60 each) to reach 320 total.
    // Service real games sum to 140; add similar to exceed its 140 cap.
    // Also verify a middle case: Bible with only 200 total returns 200 (not 140, proving cap is not hardcoded).
    try {
        withSubject('l1_bible', function () {
            ctx.GameState.miniGameScores = {};
            var st = ctx.LEVEL1_SUBJECTS.l1_bible.stations[0];
            var originalLength = st.games.length;
            // Add synthetic games
            st.games.push({ id: 's0_t1', max: 60 });
            st.games.push({ id: 's0_t2', max: 60 });
            st.games.push({ id: 's0_t3', max: 60 });
            // Seed all games to max (real: 140, synthetic: 180, total: 320)
            (st.games || []).forEach(function(g) {
                ctx.GameState.miniGameScores[ctx.l1Key(0) + '_mg_' + g.id] = g.max;
            });
            var total = ctx.l1GamesTotal(0);
            assert.strictEqual(total, 250, 'bible sum 320 capped at 250');
            // Restore and test middle case: only synthetic games summing to 200
            st.games.length = originalLength;
            ctx.GameState.miniGameScores = {};
            st.games.push({ id: 's0_mid', max: 200 });
            ctx.GameState.miniGameScores[ctx.l1Key(0) + '_mg_s0_mid'] = 200;
            var mid = ctx.l1GamesTotal(0);
            assert.strictEqual(mid, 200, 'bible 200 sum returns 200 (not hardcoded 140)');
            st.games.length = originalLength;
        });
        withSubject('l1_service', function () {
            ctx.GameState.miniGameScores = {};
            var st = ctx.LEVEL1_SUBJECTS.l1_service.stations[0];
            var originalLength = st.games.length;
            // Add synthetic games to exceed service cap of 140
            st.games.push({ id: 's0_syn1', max: 100 });
            st.games.push({ id: 's0_syn2', max: 100 });
            (st.games || []).forEach(function(g) {
                ctx.GameState.miniGameScores[ctx.l1Key(0) + '_mg_' + g.id] = g.max;
            });
            var total = ctx.l1GamesTotal(0);
            assert.strictEqual(total, 140, 'service sum exceeds 140 but caps at 140');
            st.games.length = originalLength;
        });
    } finally {
        // Clean up: reset scores
        ctx.GameState.miniGameScores = {};
    }
});

/* ---------------- verseOrder ---------------- */
test('l1VoTiles splits into chunks of 2 words, last shorter', function () {
    assert.deepStrictEqual(Array.from(ctx.l1VoTiles('في البدء خلق الله السماوات والأرض', 2)),
        ['في البدء', 'خلق الله', 'السماوات والأرض']);
    assert.deepStrictEqual(Array.from(ctx.l1VoTiles('سراج لرجلي كلامك ونور لسبيلي', 2)),
        ['سراج لرجلي', 'كلامك ونور', 'لسبيلي']);
});
test('l1VoTiles trims and collapses spaces, chunk defaults to 2', function () {
    assert.deepStrictEqual(Array.from(ctx.l1VoTiles('  الله   محبة  ')), ['الله محبة']);
    assert.deepStrictEqual(Array.from(ctx.l1VoTiles('أ ب ج', 1)), ['أ', 'ب', 'ج']);
});
test('l1VoTiles keeps duplicate tiles', function () {
    assert.deepStrictEqual(Array.from(ctx.l1VoTiles('الله محبة الله محبة', 2)), ['الله محبة', 'الله محبة']);
});
test('verseOrder type is registered', function () {
    assert.strictEqual(typeof ctx.L1_GAME_TYPES.verseOrder, 'function');
});

/* -------- wordSearch -------- */
test('l1WsCells strips tashkeel, tatweel and spaces, keeps hamza forms', function () {
    assert.deepStrictEqual(Array.from(ctx.l1WsCells('إِبْرَاهِيم')), ['إ', 'ب', 'ر', 'ا', 'ه', 'ي', 'م']);
    assert.deepStrictEqual(Array.from(ctx.l1WsCells('آدم وحواء')), ['آ', 'د', 'م', 'و', 'ح', 'و', 'ا', 'ء']);
    assert.deepStrictEqual(Array.from(ctx.l1WsCells('مـوسى')), ['م', 'و', 'س', 'ى']);
});
test('l1WsBuild places every fitting word and fills the grid', function () {
    var words = [{ w: 'نوح', clue: 'a' }, { w: 'إبراهيم', clue: 'b' }, { w: 'يعقوب', clue: 'c' },
                 { w: 'يوسف', clue: 'd' }, { w: 'موسى', clue: 'e' }, { w: 'داود', clue: 'f' }];
    for (var s = 1; s <= 200; s++) {
        var b = ctx.l1WsBuild(words, 8, rng(s));
        assert.strictEqual(b.grid.length, 8);
        b.grid.forEach(function (row) {
            assert.strictEqual(row.length, 8);
            row.forEach(function (ch) { assert.ok(ch && ch.length === 1, 'empty cell seed ' + s); });
        });
        assert.strictEqual(b.placed.length, 6, 'seed ' + s);
        b.placed.forEach(function (p) {
            var spelled = p.cells.map(function (rc) { return b.grid[rc[0]][rc[1]]; }).join('');
            assert.strictEqual(spelled, ctx.l1WsCells(p.w).join(''), 'seed ' + s + ' ' + p.w);
            assert.ok(ctx.l1WsLine(p.cells[0], p.cells[p.cells.length - 1]), 'straight ' + p.w);
        });
    }
});
test('l1WsBuild drops words longer than the grid', function () {
    var b = ctx.l1WsBuild([{ w: 'الإسكندرية', clue: '' }, { w: 'نوح', clue: '' }], 8, rng(7));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b.placed.map(function (p) { return p.w; }))), ['نوح']);
});
test('l1WsLine accepts straight lines only', function () {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.l1WsLine([2, 1], [2, 4]))), [[2, 1], [2, 2], [2, 3], [2, 4]]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.l1WsLine([4, 4], [1, 1]))), [[4, 4], [3, 3], [2, 2], [1, 1]]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.l1WsLine([3, 3], [3, 3]))), [[3, 3]]);
    assert.strictEqual(ctx.l1WsLine([0, 0], [1, 3]), null);
});
test('l1WsMatch finds a word from either end', function () {
    var placed = [{ w: 'نوح', cells: [[0, 0], [0, 1], [0, 2]] }, { w: 'سام', cells: [[1, 0], [2, 0], [3, 0]] }];
    assert.strictEqual(ctx.l1WsMatch(placed, [0, 0], [0, 2]), 0);
    assert.strictEqual(ctx.l1WsMatch(placed, [3, 0], [1, 0]), 1);
    assert.strictEqual(ctx.l1WsMatch(placed, [0, 0], [0, 1]), -1);
});
test('wordSearch type is registered', function () {
    assert.strictEqual(typeof ctx.L1_GAME_TYPES.wordSearch, 'function');
});

/* ---------------- report ---------------- */
// (later tasks insert more test blocks above this line)
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
