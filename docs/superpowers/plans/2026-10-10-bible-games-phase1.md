# Bible Games Expansion — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the Bible subjects' game score cap to 250 (station max 310) and add three new DOM game types (`treasure`, `wordSearch`, `verseOrder`) with content on all 14 Bible stations.

**Architecture:** Everything stays in the existing Level 1 engine (`level1.js`), which already runs all four subjects. Scoring caps become per-subject through two small helpers that read an optional `scoring` field on the subject data. Each new game type is one function in `L1_GAME_TYPES`, with its pure logic (word placement, tiles, question deck) in separate helper functions that a dev-only Node script tests. Content is appended to `level1-bible-data.js` and `level2-bible-data.js`.

**Tech Stack:** Vanilla ES5-style browser JS (global functions, no modules, no build), plain CSS, Node (built-in `vm` + `assert` only) for the dev check script.

**Spec:** `docs/superpowers/specs/2026-10-10-bible-games-expansion-design.md` (sections 1 and 2 = this phase).

## Global Constraints

- No build step, no npm dependencies for the player app. The check script uses only Node built-ins.
- All user-facing strings Arabic, RTL, matching the warm faith-themed tone. No emojis in code comments or commits.
- `L1_PASS` stays 140 for every subject. Service (`l1_service`) and Life (`l2_life`) keep games cap 140 and max 200.
- Bible subjects: `scoring: { games: 250, max: 310 }`. Stars: 3 = max, 2 = `L1_PASS + (max - L1_PASS) / 2`, 1 = pass.
- New game ids appended **after** existing games of each station: `s<n>_treasure`, `s<n>_words`, `s<n>_order`. All `max: 30`.
- Every data string rendered through `l1Esc`.
- Verses: Van Dyke text, no tashkeel (matches existing data). Deuterocanonical: Coptic church Arabic text. Coptic Orthodox accuracy.
- Mobile-first: works at 360px width, touch (pointer events), RTL.
- Do not deploy. Do not touch Firestore rules, tournament files, `game.js.bak`.

## Review Focus

1. **Word search drag on a real phone** — a finger drag across cells must select a straight line and not scroll the page; expected: `touch-action: none` on the grid and selection via `elementFromPoint`. Test: manual phone-width check in Task 7 step "word search drag".
2. **Treasure timer while answer feedback shows** — the countdown must not fire a second "wrong" during the 1.3-2.2 s feedback delay or after the game ends. Test: `l1TreasureTick` unit test in Task 4.
3. **Leaving a game mid-play** — back button (`l1AbortGame`) must stop all intervals/timeouts so no `api.end` fires later. Test: each type returns `destroy` that clears timers; manual check in Task 7.
4. **Repeated words / tiles** — a verse with two identical tiles (e.g. "الله ... الله") must accept either button. Test: `l1VoTiles` duplicate case in Task 2, comparison by text in the game.
5. **Arabic letter handling** — words with hamza forms (أ إ آ ؤ ئ), taa marbuta and alef maqsura must place and match exactly, tashkeel never stored. Test: `l1WsCells` and data check in Tasks 3 and 5.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `level1.js` | Modify | `l1BucketMax`, `l1MaxTotal`, `l1Stars`; new helpers `l1VoTiles`, `l1WsCells`, `l1WsBuild`, `l1WsLine`, `l1WsMatch`, `l1TreasureDeck`, `l1TreasureFifty`, `l1TreasureTick`; new `L1_GAME_TYPES.verseOrder`, `.wordSearch`, `.treasure` |
| `level1.css` | Modify (append) | `.l1-vo*`, `.l1-ws*`, `.l1-tr*` styles |
| `level1-bible-data.js` | Modify | `scoring` field; 2 new games per station (6 stations) |
| `level2-bible-data.js` | Modify | `scoring` field; 2 new games per station (8 stations) |
| `tools/check-bible-games.js` | Create | Dev-only Node check: engine helper tests + Bible data validation |
| `docs/superpowers/specs/2026-10-10-bible-games-content-log.md` | Create | Per-station sources for the new content, for servant review |
| `docs/superpowers/specs/2026-09-29-level1-contracts.md` | Modify | Document the 3 new DOM types and the `scoring` field |
| `sw.js` | Modify | `CACHE_NAME` bump `v34` → `v35` |

Run the check script with: `node tools/check-bible-games.js` (exit 0 = all pass).

---

### Task 1: Check script harness + per-subject scoring

**Files:**
- Create: `tools/check-bible-games.js`
- Modify: `level1.js:22-25` (constants area), `level1.js:177-205` (scoring), every `L1_BUCKET_MAX` / `L1_MAX` use in `level1.js`
- Modify: `level1-bible-data.js:6`, `level2-bible-data.js:9`

**Interfaces:**
- Produces: `l1BucketMax(field: string) -> number`, `l1MaxTotal() -> number`, `l1Stars(total: number) -> 0|1|2|3` (all read `l1Subject()` = `LEVEL1_SUBJECTS[l1State.subject]`).
- Produces: `tools/check-bible-games.js` exporting nothing; later tasks add `test(...)` blocks to it. Inside it: `ctx` (the vm context holding all game globals), `test(name, fn)`, `rng(seed) -> function` (seeded random).

- [ ] **Step 1: Write the check script with the failing scoring tests**

Create `tools/check-bible-games.js`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tools/check-bible-games.js`
Expected: FAIL lines for every test (`ctx.l1BucketMax is not a function`), last line `0 passed, 5 failed`, exit code 1.

- [ ] **Step 3: Route every cap use through helper calls (before the helpers exist)**

Run these in-place replacements (macOS `sed`), then restore the one declaration they break:

```bash
cd /Users/mmichaelmaher/Documents/min-el-batal
sed -i '' -E 's/L1_BUCKET_MAX\.([a-zA-Z]+)/l1BucketMax('"'"'\1'"'"')/g; s/L1_BUCKET_MAX\[field\]/l1BucketMax(field)/g' level1.js
sed -i '' -E 's/([^_A-Za-z])L1_MAX([^_A-Za-z])/\1l1MaxTotal()\2/g' level1.js
```

The second command also turns the declaration into `var l1MaxTotal() = 200;`. Change that line back to exactly:

```js
var L1_MAX = 200;
```

Every former use (lines ~181, 194, 196, 205, 557, 618, 638, 675, 796-800, 839, 987) now calls `l1BucketMax(...)` or `l1MaxTotal()`.

- [ ] **Step 4: Add the helpers and rewrite `l1Stars`**

In `level1.js`, directly after the line `var L1_SUMMARY_MIN_CHARS = 40;` (line ~26) add:

```js
// Per-subject caps: a subject may set `scoring: { games, max }` (Bible subjects do). Pass mark and the
// other buckets are shared by every subject.
function l1BucketMax(field) {
    var s = l1Subject() && l1Subject().scoring;
    return (field === 'games' && s && s.games) || L1_BUCKET_MAX[field];
}
function l1MaxTotal() {
    var s = l1Subject() && l1Subject().scoring;
    return (s && s.max) || L1_MAX;
}
```

Replace the `l1Stars` line (~205), which after Step 3 reads:

```js
function l1Stars(total) { return total >= l1MaxTotal() ? 3 : total >= 170 ? 2 : total >= L1_PASS ? 1 : 0; }
```

with:

```js
function l1Stars(total) {
    var max = l1MaxTotal();
    return total >= max ? 3 : total >= L1_PASS + (max - L1_PASS) / 2 ? 2 : total >= L1_PASS ? 1 : 0;
}
```

Confirm: `grep -n "L1_BUCKET_MAX\|L1_MAX\b" level1.js` shows `L1_BUCKET_MAX` only on its declaration and inside `l1BucketMax`, and `L1_MAX` only on its declaration and inside `l1MaxTotal`.

- [ ] **Step 5: Add `scoring` to both Bible subjects**

`level1-bible-data.js` line 6 becomes:

```js
  key: 'l1_bible', name: 'الكتاب المقدس', icon: '📖', color: '#d4a24c',
  scoring: { games: 250, max: 310 },
```

`level2-bible-data.js` line 9 becomes:

```js
  key: 'l2_bible', name: 'الكتاب المقدس', icon: '📖', color: '#3b82f6', level: 2,
  scoring: { games: 250, max: 310 },
```

- [ ] **Step 6: Run the check to verify it passes**

Run: `node tools/check-bible-games.js`
Expected: `5 passed, 0 failed`, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add tools/check-bible-games.js level1.js level1-bible-data.js level2-bible-data.js
git commit -m "Per-subject score caps: Bible stations go to 310 (games 250)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `verseOrder` game type (🧩 رتّب الآية)

**Files:**
- Modify: `level1.js` (append after `L1_GAME_TYPES.fillVerse`, i.e. after the line `return { destroy: function() {}, partial: function() { return [raw, rawMax]; } };\n};` that closes fillVerse, ~line 1720)
- Modify: `level1.css` (append)
- Modify: `tools/check-bible-games.js` (insert tests before the `/* ---------------- report` block)

**Interfaces:**
- Consumes: `l1Pick`, `l1Shuffle`, `l1Esc`, `l1Tracker`, `l1FxAt`, `l1Shake` (existing in `level1.js`).
- Produces: `l1VoTiles(text: string, chunk: number) -> string[]`; `L1_GAME_TYPES.verseOrder(host, data, api)` with `data = { prompt, verses:[{text, ref}], pick:3, chunk:2 }`.

- [ ] **Step 1: Write the failing tests**

Insert into `tools/check-bible-games.js` above the report block:

```js
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
```

(`Array.from` converts arrays created inside the vm so `deepStrictEqual` compares prototypes from the same realm.)

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/check-bible-games.js`
Expected: 4 new FAIL lines (`ctx.l1VoTiles is not a function`, `verseOrder type is registered`), exit 1.

- [ ] **Step 3: Implement**

Append to `level1.js` after the fillVerse function:

```js
// ---- verseOrder: tap the verse tiles in reading order ----
// Split a verse into tiles of `chunk` words; the last tile may be shorter.
function l1VoTiles(text, chunk) {
    var words = String(text || '').trim().split(/\s+/), out = [], n = Math.max(1, chunk || 2);
    if (!words[0]) return out;
    for (var i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(' '));
    return out;
}
L1_GAME_TYPES.verseOrder = function(host, data, api) {
    var verses = l1Pick(data.verses, data.pick || 3);
    var sets = verses.map(function(x) { return l1VoTiles(x.text, data.chunk || 2); });
    var rawMax = sets.reduce(function(a, t) { return a + t.length; }, 0) || 1;
    var v = 0, raw = 0, done = false, wait = null;
    var tr = l1Tracker(api, rawMax);
    function render() {
        var tiles = sets[v], next = 0, mistakes = 0;
        var order = l1Shuffle(tiles.map(function(_, i) { return i; }));
        if (tiles.length > 1 && order.every(function(x, i) { return x === i; })) order.reverse();
        var h = '<div class="l1-vo"><div class="l1-vo-line" id="l1-vo-line"></div>';
        h += '<div class="l1-decode-ref">' + l1Esc(verses[v].ref || '') + '</div>';
        h += '<div class="l1-decode-progress">آية ' + (v + 1) + ' من ' + verses.length + '</div><div class="l1-tray">';
        order.forEach(function(i) { h += '<button class="l1-chip">' + l1Esc(tiles[i]) + '</button>'; });
        h += '</div></div>';
        host.innerHTML = h;
        var line = document.getElementById('l1-vo-line');
        host.querySelectorAll('.l1-chip').forEach(function(btn) {
            btn.onclick = function() {
                if (done || next >= tiles.length) return;
                // Compare by text so duplicate tiles are interchangeable
                if (btn.textContent === tiles[next]) {
                    var s = document.createElement('span');
                    s.className = 'l1-vo-word';
                    s.textContent = tiles[next];
                    line.appendChild(s);
                    btn.classList.add('used');
                    btn.disabled = true;
                    l1FxAt(api, s, host);
                    tr.hit();
                    next++;
                    if (next >= tiles.length) {
                        raw += Math.max(0, tiles.length - mistakes);
                        line.classList.add('solved');
                        wait = setTimeout(function() {
                            v++;
                            if (v >= verses.length) { done = true; api.end(raw, rawMax); } else render();
                        }, 1300);
                    }
                } else {
                    mistakes++;
                    tr.miss();
                    l1Shake(btn);
                }
            };
        });
    }
    if (!sets.length) { host.innerHTML = '<p class="l1-empty">اللعبة دي مش جاهزة لسه 🙏</p>'; return { destroy: function() {}, partial: function() { return [0, 1]; } }; }
    render();
    return {
        destroy: function() { done = true; clearTimeout(wait); },
        partial: function() { return [raw, rawMax]; }
    };
};
```

Append to `level1.css`:

```css
/* ---- verseOrder ---- */
.l1-vo { text-align: center; }
.l1-vo-line {
    min-height: 64px; padding: 12px; margin-bottom: 8px; border-radius: 14px;
    background: var(--l1-parch); color: var(--l1-ink); font: 700 18px/1.9 'Cairo', sans-serif;
    display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; direction: rtl;
}
.l1-vo-word { animation: l1-pop .35s; }
.l1-vo-line.solved { box-shadow: 0 0 0 4px #2fbf8a; }
```

- [ ] **Step 4: Run to verify they pass**

Run: `node tools/check-bible-games.js`
Expected: `9 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add level1.js level1.css tools/check-bible-games.js
git commit -m "Add verseOrder game type (rearrange the verse tiles)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `wordSearch` game type (🔎 دوّر على الكلمة)

**Files:**
- Modify: `level1.js` (append after `L1_GAME_TYPES.verseOrder`)
- Modify: `level1.css` (append)
- Modify: `tools/check-bible-games.js` (insert tests before the report block)

**Interfaces:**
- Consumes: `l1Pick`, `l1Esc`, `l1Tracker`, `l1FxAt`, `l1Shake`.
- Produces:
  - `l1WsCells(w: string) -> string[]` (letters, tashkeel/tatweel/spaces removed)
  - `l1WsBuild(words: [{w, clue}], size: number, rnd?: () => number) -> { grid: string[][], placed: [{w, clue, cells: [[r, c], ...]}] }`
  - `l1WsLine(a: [r, c], b: [r, c]) -> [[r, c], ...] | null` (straight horizontal / vertical / 45° line, else null)
  - `l1WsMatch(placed, a, b) -> index | -1`
  - `L1_GAME_TYPES.wordSearch(host, data, api)` with `data = { prompt, words:[{w, clue}], pick:6, size:8, time:120 }`
- Grid space: `grid[r][c]`, rendered with `direction: rtl`, so `c = 0` is the right-most column and `c+1` reads right-to-left on screen. Placement directions `[dr, dc]`: `[0,1]` (reading), `[1,0]` (down), `[1,1]` (diagonal down, reading direction).

- [ ] **Step 1: Write the failing tests**

Insert into `tools/check-bible-games.js` above the report block:

```js
/* ---------------- wordSearch ---------------- */
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
    assert.deepStrictEqual(b.placed.map(function (p) { return p.w; }), ['نوح']);
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/check-bible-games.js`
Expected: 6 new FAIL lines, exit 1.

- [ ] **Step 3: Implement**

Append to `level1.js` after the verseOrder function:

```js
// ---- wordSearch: drag across the grid to find the lesson words ----
// Grid space grid[r][c]; the grid renders RTL so c+1 reads right-to-left on screen.
var L1_WS_DIRS = [[0, 1], [1, 0], [1, 1]];
function l1WsCells(w) {
    return String(w || '').replace(/[ً-ْٰـ\s]/g, '').split('');
}
function l1WsBuild(words, size, rnd) {
    rnd = rnd || Math.random;
    var grid = [], placed = [], r, c;
    for (r = 0; r < size; r++) { grid.push([]); for (c = 0; c < size; c++) grid[r].push(''); }
    words.forEach(function(item) {
        var cells = l1WsCells(item.w);
        if (!cells.length || cells.length > size) return;
        for (var tries = 0; tries < 200; tries++) {
            var d = L1_WS_DIRS[Math.floor(rnd() * L1_WS_DIRS.length)];
            var r0 = Math.floor(rnd() * (size - d[0] * (cells.length - 1)));
            var c0 = Math.floor(rnd() * (size - d[1] * (cells.length - 1)));
            var pos = [], ok = true;
            for (var k = 0; k < cells.length; k++) {
                var rr = r0 + d[0] * k, cc = c0 + d[1] * k;
                if (grid[rr][cc] && grid[rr][cc] !== cells[k]) { ok = false; break; }
                pos.push([rr, cc]);
            }
            if (!ok) continue;
            pos.forEach(function(p, k) { grid[p[0]][p[1]] = cells[k]; });
            placed.push({ w: item.w, clue: item.clue || '', cells: pos });
            return;
        }
    });
    var pool = [];
    placed.forEach(function(p) { pool = pool.concat(l1WsCells(p.w)); });
    if (!pool.length) pool = ['ا', 'ب', 'ت'];
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = pool[Math.floor(rnd() * pool.length)];
    return { grid: grid, placed: placed };
}
function l1WsLine(a, b) {
    var dr = b[0] - a[0], dc = b[1] - a[1];
    if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return null;
    var n = Math.max(Math.abs(dr), Math.abs(dc)), sr = (dr > 0) - (dr < 0), sc = (dc > 0) - (dc < 0), out = [];
    for (var k = 0; k <= n; k++) out.push([a[0] + sr * k, a[1] + sc * k]);
    return out;
}
function l1WsMatch(placed, a, b) {
    function same(p, q) { return p[0] === q[0] && p[1] === q[1]; }
    for (var i = 0; i < placed.length; i++) {
        var cs = placed[i].cells, s = cs[0], e = cs[cs.length - 1];
        if ((same(s, a) && same(e, b)) || (same(s, b) && same(e, a))) return i;
    }
    return -1;
}
L1_GAME_TYPES.wordSearch = function(host, data, api) {
    var size = data.size || 8;
    var build = l1WsBuild(l1Pick(data.words, data.pick || 6), size);
    var placed = build.placed, found = {}, nFound = 0, left = data.time || 120, total = left, finished = false, wait = null;
    var tr = l1Tracker(api, placed.length);
    var h = '<div class="l1-ws"><div class="l1-swipe-timer"><i id="l1-ws-bar"></i></div>';
    h += '<div class="l1-ws-grid" id="l1-ws-grid" style="--n:' + size + '">';
    build.grid.forEach(function(row, r) {
        row.forEach(function(ch, c) { h += '<span class="l1-ws-cell" data-r="' + r + '" data-c="' + c + '">' + l1Esc(ch) + '</span>'; });
    });
    h += '</div><div class="l1-ws-list">';
    placed.forEach(function(p, i) { h += '<span class="l1-ws-word" id="l1-ws-w' + i + '">' + l1Esc(p.w) + '</span>'; });
    h += '</div><p class="l1-ws-clue" id="l1-ws-clue">اسحب صباعك على الكلمة من أولها لآخرها</p></div>';
    host.innerHTML = h;
    var grid = document.getElementById('l1-ws-grid');
    var bar = document.getElementById('l1-ws-bar');
    var clue = document.getElementById('l1-ws-clue');
    function cellAt(x, y) {
        var el = document.elementFromPoint(x, y);
        el = el && el.closest ? el.closest('.l1-ws-cell') : null;
        return el ? [+el.getAttribute('data-r'), +el.getAttribute('data-c')] : null;
    }
    function cellEl(p) { return grid.querySelector('.l1-ws-cell[data-r="' + p[0] + '"][data-c="' + p[1] + '"]'); }
    function paint(cells, cls, on) { (cells || []).forEach(function(p) { var el = cellEl(p); if (el) el.classList.toggle(cls, on); }); }
    var start = null, sel = null;
    function reset() { paint(sel, 'sel', false); start = null; sel = null; }
    grid.addEventListener('pointerdown', function(e) {
        if (finished) return;
        start = cellAt(e.clientX, e.clientY);
        if (!start) return;
        try { grid.setPointerCapture(e.pointerId); } catch (err) {}
        sel = [start];
        paint(sel, 'sel', true);
    });
    grid.addEventListener('pointermove', function(e) {
        if (!start) return;
        var p = cellAt(e.clientX, e.clientY), line = p && l1WsLine(start, p);
        if (!line) return;
        paint(sel, 'sel', false);
        sel = line;
        paint(sel, 'sel', true);
    });
    grid.addEventListener('pointercancel', reset);
    grid.addEventListener('pointerup', function() {
        if (!start) return;
        var s = sel;
        reset();
        if (finished || s.length < 2) return;           // a tap is not a guess
        var i = l1WsMatch(placed, s[0], s[s.length - 1]);
        if (i < 0) { tr.miss(); l1Shake(grid); return; }
        if (found[i]) return;
        found[i] = true;
        nFound++;
        paint(placed[i].cells, 'found', true);
        document.getElementById('l1-ws-w' + i).classList.add('done');
        clue.textContent = '✨ ' + placed[i].w + (placed[i].clue ? ': ' + placed[i].clue : '');
        l1FxAt(api, cellEl(placed[i].cells[0]), host);
        tr.hit();
        if (nFound >= placed.length) wait = setTimeout(end, 900);
    });
    function end() {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        api.end(nFound, placed.length || 1);
    }
    var timer = setInterval(function() {
        if (document.hidden || finished) return;
        left--;
        if (bar) bar.style.width = (left / total * 100) + '%';
        if (left <= 10 && left > 0) api.sfx('tick');
        if (left <= 0) end();
    }, 1000);
    if (!placed.length) end();
    return {
        destroy: function() { finished = true; clearInterval(timer); clearTimeout(wait); },
        partial: function() { return [nFound, placed.length || 1]; }
    };
};
```

Append to `level1.css`:

```css
/* ---- wordSearch ---- */
.l1-ws { display: grid; gap: 10px; }
.l1-ws-grid {
    direction: rtl; display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 3px;
    width: 100%; max-width: 360px; margin: 0 auto;
    touch-action: none; user-select: none; -webkit-user-select: none;
}
.l1-ws-cell {
    aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px;
    background: var(--l1-parch); color: var(--l1-ink); font: 800 18px 'Cairo', sans-serif;
    transition: background .15s, transform .15s;
}
.l1-ws-cell.sel { background: var(--l1-gold-2); transform: scale(1.06); }
.l1-ws-cell.found { background: #2fbf8a; color: #fff; }
.l1-ws-list { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.l1-ws-word { padding: 4px 10px; border-radius: 999px; background: rgba(255, 255, 255, .12); font-weight: 700; font-size: 13px; }
.l1-ws-word.done { background: #2fbf8a; color: #fff; text-decoration: line-through; }
.l1-ws-clue { text-align: center; min-height: 2.6em; font-size: 14px; line-height: 1.6; margin: 0; }
```

- [ ] **Step 4: Run to verify they pass**

Run: `node tools/check-bible-games.js`
Expected: `15 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add level1.js level1.css tools/check-bible-games.js
git commit -m "Add wordSearch game type (drag to find the lesson words)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `treasure` game type (💎 مين يكسب الكنز)

**Files:**
- Modify: `level1.js` (append after `L1_GAME_TYPES.wordSearch`)
- Modify: `level1.css` (append)
- Modify: `tools/check-bible-games.js` (insert tests before the report block)

**Interfaces:**
- Consumes: `l1Pick`, `l1Shuffle`, `l1Esc`, `l1Tracker`, `l1FxAt`.
- Produces:
  - `l1TreasureDeck(questions, pick) -> question[]` (random `pick`, sorted by `level` ascending)
  - `l1TreasureFifty(q) -> number[]` (option indexes to hide: `options.length - 2` wrong ones)
  - `l1TreasureTick(st) -> 'idle' | 'tick' | 'timeout' | 'count'` — pure countdown step on `st = { left, locked, finished, hidden }`; decrements `st.left` only when it returns `'count'`, `'tick'` or `'timeout'`.
  - `L1_GAME_TYPES.treasure(host, data, api)` with `data = { prompt, questions:[{q, options:[4], correct, explain, hint, level}], pick:10, time:20 }`.

- [ ] **Step 1: Write the failing tests**

Insert into `tools/check-bible-games.js` above the report block:

```js
/* ---------------- treasure ---------------- */
function tq(level, i) { return { q: 'q' + i, options: ['a', 'b', 'c', 'd'], correct: i % 4, explain: 'e', hint: 'h', level: level }; }
test('l1TreasureDeck picks n and orders by level', function () {
    var qs = [];
    for (var i = 0; i < 15; i++) qs.push(tq((i % 3) + 1, i));
    var d = ctx.l1TreasureDeck(qs, 10);
    assert.strictEqual(d.length, 10);
    for (var k = 1; k < d.length; k++) assert.ok(d[k - 1].level <= d[k].level, 'sorted');
    assert.strictEqual(ctx.l1TreasureDeck(qs.slice(0, 4), 10).length, 4, 'uses all when fewer than pick');
});
test('l1TreasureFifty hides two wrong options, never the right one', function () {
    for (var c = 0; c < 4; c++) {
        for (var n = 0; n < 30; n++) {
            var hide = Array.from(ctx.l1TreasureFifty({ options: ['a', 'b', 'c', 'd'], correct: c }));
            assert.strictEqual(hide.length, 2);
            assert.ok(hide.indexOf(c) < 0);
            assert.notStrictEqual(hide[0], hide[1]);
        }
    }
});
test('l1TreasureTick does nothing while locked, hidden or finished', function () {
    ['locked', 'hidden', 'finished'].forEach(function (f) {
        var st = { left: 5, locked: false, finished: false, hidden: false };
        st[f] = true;
        assert.strictEqual(ctx.l1TreasureTick(st), 'idle', f);
        assert.strictEqual(st.left, 5, f);
    });
});
test('l1TreasureTick counts down, ticks near the end, times out once', function () {
    var st = { left: 7, locked: false, finished: false, hidden: false };
    assert.strictEqual(ctx.l1TreasureTick(st), 'count'); assert.strictEqual(st.left, 6);
    assert.strictEqual(ctx.l1TreasureTick(st), 'tick');  assert.strictEqual(st.left, 5);
    st.left = 1;
    assert.strictEqual(ctx.l1TreasureTick(st), 'timeout'); assert.strictEqual(st.left, 0);
    st.locked = true; // the game locks on timeout
    assert.strictEqual(ctx.l1TreasureTick(st), 'idle'); assert.strictEqual(st.left, 0);
});
test('treasure type is registered', function () {
    assert.strictEqual(typeof ctx.L1_GAME_TYPES.treasure, 'function');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/check-bible-games.js`
Expected: 5 new FAIL lines, exit 1.

- [ ] **Step 3: Implement**

Append to `level1.js` after the wordSearch function:

```js
// ---- treasure: 10-step question ladder with 3 hearts and 3 one-time lifelines ----
function l1TreasureDeck(questions, pick) {
    return l1Pick(questions, pick || 10).sort(function(a, b) { return (a.level || 1) - (b.level || 1); });
}
function l1TreasureFifty(q) {
    var wrong = [];
    q.options.forEach(function(_, k) { if (k !== q.correct) wrong.push(k); });
    return l1Shuffle(wrong).slice(0, Math.max(0, q.options.length - 2));
}
// One second of the per-question countdown. Pure: only touches st.left.
function l1TreasureTick(st) {
    if (st.finished || st.locked || st.hidden) return 'idle';
    st.left--;
    if (st.left <= 0) return 'timeout';
    return st.left <= 5 ? 'tick' : 'count';
}
L1_GAME_TYPES.treasure = function(host, data, api) {
    var deck = l1TreasureDeck(data.questions, data.pick || 10);
    var per = data.time || 20;
    var rawMax = deck.reduce(function(a, q) { return a + (q.level || 1); }, 0) || 1;
    var i = 0, raw = 0, hearts = 3, wait = null;
    var st = { left: per, locked: false, finished: false, hidden: false };
    var used = { fifty: false, hint: false, time: false };
    var tr = l1Tracker(api, deck.length);
    function ladder() {
        var h = '<ol class="l1-tr-ladder">';
        for (var k = deck.length - 1; k >= 0; k--) h += '<li class="' + (k < i ? 'won' : k === i ? 'now' : '') + '">' + (k + 1) + '</li>';
        return h + '</ol>';
    }
    function heartsHtml() { var h = ''; for (var k = 0; k < 3; k++) h += k < hearts ? '❤️' : '🤍'; return h; }
    function showTime() {
        var t = document.getElementById('l1-tr-time'), bar = document.getElementById('l1-tr-bar');
        if (t) t.textContent = '⏱️ ' + Math.max(0, st.left);
        if (bar) bar.style.width = Math.min(100, st.left / per * 100) + '%';
    }
    function render() {
        var q = deck[i];
        st.left = per;
        st.locked = false;
        var h = '<div class="l1-tr">' + ladder() + '<div class="l1-tr-main">';
        h += '<div class="l1-tr-top"><span>' + heartsHtml() + '</span><span id="l1-tr-time"></span></div>';
        h += '<div class="l1-swipe-timer"><i id="l1-tr-bar"></i></div>';
        h += '<h3 class="l1-tr-q">' + l1Esc(q.q) + '</h3><div class="l1-check-opts">';
        q.options.forEach(function(o, k) { h += '<button class="l1-opt" data-k="' + k + '">' + l1Esc(o) + '</button>'; });
        h += '</div><p class="l1-check-explain" id="l1-tr-explain"></p><div class="l1-tr-life">';
        h += '<button data-l="fifty"' + (used.fifty ? ' disabled' : '') + '>50:50</button>';
        h += '<button data-l="hint"' + (used.hint ? ' disabled' : '') + '>🙋 اسأل الخادم</button>';
        h += '<button data-l="time"' + (used.time ? ' disabled' : '') + '>⏱️ وقت زيادة</button>';
        h += '</div></div></div>';
        host.innerHTML = h;
        showTime();
        host.querySelectorAll('.l1-opt').forEach(function(btn) {
            btn.onclick = function() { answer(+btn.getAttribute('data-k')); };
        });
        host.querySelectorAll('.l1-tr-life button').forEach(function(btn) {
            btn.onclick = function() { lifeline(btn.getAttribute('data-l'), btn); };
        });
    }
    function lifeline(kind, btn) {
        if (used[kind] || st.locked || st.finished) return;
        used[kind] = true;
        btn.disabled = true;
        var q = deck[i];
        if (kind === 'fifty') {
            var opts = host.querySelectorAll('.l1-opt');
            l1TreasureFifty(q).forEach(function(k) { if (opts[k]) { opts[k].disabled = true; opts[k].classList.add('dim'); } });
        } else if (kind === 'hint') {
            var ex = document.getElementById('l1-tr-explain');
            if (ex) ex.textContent = '🙋 ' + (q.hint || q.explain || '');
        } else {
            st.left += 15;
            showTime();
        }
        api.sfx('good');
    }
    function answer(k) {
        if (st.locked || st.finished) return;
        st.locked = true;
        var q = deck[i], ok = k === q.correct;
        host.querySelectorAll('.l1-opt').forEach(function(b, bi) {
            b.disabled = true;
            b.classList.add(bi === q.correct ? 'right' : (bi === k ? 'wrong' : 'dim'));
        });
        if (ok) { raw += (q.level || 1); tr.hit(); l1FxAt(api, host.querySelector('.l1-opt.right'), host); }
        else { hearts--; tr.miss(); }
        var ex = document.getElementById('l1-tr-explain');
        if (ex) ex.textContent = (ok ? '👏 ' : (k < 0 ? '⏰ الوقت خلص! ' : '💡 ')) + (q.explain || '');
        wait = setTimeout(function() {
            i++;
            if (hearts <= 0 || i >= deck.length) end(); else render();
        }, ok ? 1300 : 2200);
    }
    function end() {
        if (st.finished) return;
        st.finished = true;
        clearInterval(timer);
        clearTimeout(wait);
        api.end(raw, rawMax);
    }
    var timer = setInterval(function() {
        st.hidden = document.hidden;
        var r = l1TreasureTick(st);
        if (r === 'idle') return;
        showTime();
        if (r === 'tick') api.sfx('tick');
        if (r === 'timeout') answer(-1);
    }, 1000);
    if (!deck.length) { end(); return { destroy: function() {}, partial: function() { return [0, 1]; } }; }
    render();
    return {
        destroy: function() { st.finished = true; clearInterval(timer); clearTimeout(wait); },
        partial: function() { return [raw, rawMax]; }
    };
};
```

Append to `level1.css`:

```css
/* ---- treasure ---- */
.l1-tr { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: start; }
.l1-tr-ladder { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
.l1-tr-ladder li {
    text-align: center; font: 800 12px 'Cairo', sans-serif; border-radius: 6px; padding: 2px 0;
    background: rgba(255, 255, 255, .08); color: var(--l1-muted);
}
.l1-tr-ladder li.won { background: var(--l1-gold-2); color: var(--l1-ink); }
.l1-tr-ladder li.now { background: var(--l1-teal); color: #fff; box-shadow: 0 0 0 2px var(--l1-gold-2); }
.l1-tr-main { min-width: 0; }
.l1-tr-top { display: flex; justify-content: space-between; align-items: center; font-weight: 800; margin-bottom: 6px; }
.l1-tr-q { font-size: 17px; line-height: 1.6; margin: 10px 0; }
.l1-tr-life { display: flex; gap: 6px; margin-top: 10px; }
.l1-tr-life button {
    flex: 1; padding: 8px 4px; border-radius: 12px; border: 0; cursor: pointer;
    font: 800 12px 'Cairo', sans-serif; background: var(--l1-gold-2); color: var(--l1-ink);
}
.l1-tr-life button:disabled { opacity: .35; cursor: default; }
```

- [ ] **Step 4: Run to verify they pass**

Run: `node tools/check-bible-games.js`
Expected: `20 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add level1.js level1.css tools/check-bible-games.js
git commit -m "Add treasure game type (question ladder with hearts and lifelines)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Data validation + الترم الأول content (6 stations)

**Files:**
- Modify: `tools/check-bible-games.js` (insert data checks before the report block)
- Modify: `level1-bible-data.js` (append 2 games to the `games` array of stations 0-5)
- Create: `docs/superpowers/specs/2026-10-10-bible-games-content-log.md`

**Interfaces:**
- Consumes: `l1WsCells`, `l1WsBuild`, `l1VoTiles` (Tasks 2-3), `rng`, `test`, `ctx`.
- Produces: `checkBibleSubject(key)` in the check script, reused by Task 6 for `l2_bible`.

**Placement rule** (from the spec): every station gets `s<n>_treasure`. A station whose existing games include type `fillVerse` or `decode` gets `s<n>_words` (wordSearch); otherwise `s<n>_order` (verseOrder). For الترم الأول: stations 0 and 4 → wordSearch; 1, 2, 3, 5 → verseOrder.

**Content rules:**
- Read the station's `cards`, existing `games` content and `verse` first; every fact must come from them. New verses (not already in the station) must be Van Dyke text, no tashkeel, with the exact reference.
- `treasure`: 12-15 questions; at least 4 of each `level` 1 / 2 / 3 (1 = straight recall from a card, 2 = connect two facts, 3 = detail or meaning); exactly 4 `options`; `correct` 0-3 with the correct answer spread across positions; `explain` cites the card fact and a reference where the card has one; `hint` nudges without giving the answer.
- `wordSearch`: 8 words (names, places, key terms), stored without tashkeel and without spaces, 3-8 letters, each with a short `clue` in Egyptian Arabic.
- `verseOrder`: 4 verses, each at least 6 words.
- Egyptian Arabic for prompts / desc / explain / hint, matching the existing games' tone.

- [ ] **Step 1: Write the failing data checks**

Insert into `tools/check-bible-games.js` above the report block:

```js
/* ---------------- Bible data ---------------- */
var TASHKEEL = /[ً-ْٰـ]/;
function checkBibleSubject(key) {
    var sub = ctx.LEVEL1_SUBJECTS[key];
    var ids = {};
    sub.stations.forEach(function (st, n) {
        var where = key + ' station ' + n;
        test(where + ': unique ids, caps', function () {
            st.games.forEach(function (g) {
                assert.ok(!ids[g.id], 'duplicate id ' + g.id);
                ids[g.id] = true;
                assert.ok(g.id.indexOf('s' + n + '_') === 0, 'id prefix ' + g.id);
            });
            var sum = st.games.reduce(function (a, g) { return a + g.max; }, 0);
            assert.ok(sum <= sub.scoring.games, 'max sum ' + sum + ' > ' + sub.scoring.games);
            assert.ok(st.games.length === 6 || st.games.length === 7, 'game count ' + st.games.length);
        });
        test(where + ': treasure', function () {
            var g = st.games.filter(function (x) { return x.id === 's' + n + '_treasure'; })[0];
            assert.ok(g, 'missing s' + n + '_treasure');
            assert.strictEqual(g.type, 'treasure');
            assert.strictEqual(g.max, 30);
            assert.ok(g.title && g.desc && g.icon && g.data.prompt, 'title/desc/icon/prompt');
            var qs = g.data.questions;
            assert.ok(qs.length >= 12 && qs.length <= 15, 'questions ' + qs.length);
            var per = { 1: 0, 2: 0, 3: 0 };
            qs.forEach(function (q, i) {
                assert.ok(q.q && q.explain && q.hint, 'q/explain/hint #' + i);
                assert.strictEqual(q.options.length, 4, 'options #' + i);
                assert.ok(q.correct >= 0 && q.correct <= 3, 'correct #' + i);
                assert.ok(per.hasOwnProperty(q.level), 'level #' + i);
                per[q.level]++;
                assert.strictEqual(new Set(q.options).size, 4, 'duplicate options #' + i);
            });
            assert.ok(per[1] >= 4 && per[2] >= 4 && per[3] >= 4, 'levels ' + JSON.stringify(per));
        });
        var hasVerseGame = st.games.some(function (x) { return x.type === 'fillVerse' || x.type === 'decode'; });
        if (hasVerseGame) {
            test(where + ': wordSearch', function () {
                var g = st.games.filter(function (x) { return x.id === 's' + n + '_words'; })[0];
                assert.ok(g, 'missing s' + n + '_words');
                assert.strictEqual(g.type, 'wordSearch');
                assert.strictEqual(g.max, 30);
                assert.ok(g.title && g.desc && g.icon && g.data.prompt, 'title/desc/icon/prompt');
                var size = g.data.size || 8, pick = g.data.pick || 6;
                assert.ok(g.data.words.length >= 8, 'words ' + g.data.words.length);
                g.data.words.forEach(function (w) {
                    assert.ok(!TASHKEEL.test(w.w) && !/\s/.test(w.w), 'clean word ' + w.w);
                    var len = ctx.l1WsCells(w.w).length;
                    assert.ok(len >= 3 && len <= size, 'length ' + w.w);
                    assert.ok(w.clue, 'clue ' + w.w);
                });
                for (var s = 1; s <= 100; s++) {
                    var sub = [];
                    for (var k = 0; k < pick; k++) sub.push(g.data.words[(s + k) % g.data.words.length]);
                    var b = ctx.l1WsBuild(sub, size, rng(s));
                    assert.strictEqual(b.placed.length, pick, 'placement seed ' + s);
                }
            });
        } else {
            test(where + ': verseOrder', function () {
                var g = st.games.filter(function (x) { return x.id === 's' + n + '_order'; })[0];
                assert.ok(g, 'missing s' + n + '_order');
                assert.strictEqual(g.type, 'verseOrder');
                assert.strictEqual(g.max, 30);
                assert.ok(g.title && g.desc && g.icon && g.data.prompt, 'title/desc/icon/prompt');
                assert.ok(g.data.verses.length >= 4, 'verses ' + g.data.verses.length);
                g.data.verses.forEach(function (v) {
                    assert.ok(v.ref, 'ref ' + v.text);
                    assert.ok(v.text.trim().split(/\s+/).length >= 6, 'verse too short: ' + v.text);
                    assert.ok(!TASHKEEL.test(v.text), 'tashkeel in ' + v.ref);
                });
            });
        }
    });
}
checkBibleSubject('l1_bible');
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/check-bible-games.js`
Expected: FAIL `l1_bible station 0..5: unique ids, caps` (game count 4), `treasure` (missing), and `wordSearch` / `verseOrder` (missing) — 18 new FAILs, exit 1.

- [ ] **Step 3: Write the content**

For each station 0-5 of `level1-bible-data.js`, append two game objects at the end of its `games` array (after the last existing game, before `]`). Follow the content rules above. The exact shape, with a complete worked station (station 1, عصر الخليقة) to copy the style from:

```js
        { id: 's1_treasure', type: 'treasure', title: 'مين يكسب الكنز', desc: '١٠ أسئلة بتصعب واحدة ورا التانية، ومعاك ٣ وسائل مساعدة', icon: '💎', max: 30, data: {
          prompt: 'اطلع سلّم الكنز سؤال سؤال! معاك ٣ قلوب و٣ وسائل مساعدة',
          questions: [
            { q: 'ربنا خلق النور في اليوم...', options: ['الأول', 'الرابع', 'السادس', 'السابع'], correct: 0, level: 1, explain: 'النور في اليوم الأول (تك ١: ٣)، والشمس والقمر في الرابع.', hint: 'من أول أيام الخليقة' },
            { q: 'في اليوم السادس ربنا خلق...', options: ['الطيور', 'الشمس والقمر', 'البهائم والوحوش والإنسان', 'اليابسة'], correct: 2, level: 1, explain: 'اليوم السادس: البهائم والوحوش والإنسان.', hint: 'آخر يوم شغل قبل الراحة' },
            { q: 'الفلك استقر على جبل...', options: ['سيناء', 'أراراط', 'الكرمل', 'صهيون'], correct: 1, level: 1, explain: 'الفلك استقر على جبل أراراط.', hint: 'اسمه بيبدأ بحرف الألف' },
            { q: 'علامة عهد ربنا مع نوح بعد الطوفان كانت...', options: ['النجوم', 'الحمامة', 'غصن الزيتون', 'قوس قزح في السحاب'], correct: 3, level: 1, explain: '«وضعت قوسي في السحاب فتكون علامة ميثاق» (تك ٩: ١٣).', hint: 'بتظهر في السما بعد المطر' },
            { q: 'مين اللي ربنا قبل تقدمته؟', options: ['قايين', 'هابيل', 'لامك', 'شيث'], correct: 1, level: 1, explain: 'ربنا قبل تقدمة هابيل ورفض تقدمة قايين (تك ٤: ٤-٥).', hint: 'الأخ الصغير' },
            { q: 'وعد «نسل المرأة يسحق رأس الحية» كان إشارة لـ...', options: ['الطوفان', 'برج بابل', 'مجيء السيد المسيح المخلّص', 'نوح'], correct: 2, level: 2, explain: 'أول وعد بالخلاص، إشارة لمجيء السيد المسيح (تك ٣: ١٥).', hint: 'أول وعد بالخلاص' },
            { q: 'نسل شيث كان اسمهم إيه؟', options: ['أولاد الله', 'أولاد قايين', 'الجبابرة', 'أهل بابل'], correct: 0, level: 2, explain: 'بعد قايين وهابيل جه نسل شيث اللي اتسموا «أولاد الله»، ومنهم أخنوخ ونوح.', hint: 'اسم بيبيّن إنهم قريبين من ربنا' },
            { q: 'الطوفان جه بعد ما...', options: ['أولاد الله اختلطوا بالأشرار والشر انتشر', 'آدم أكل من الشجرة', 'قايين قتل هابيل', 'الناس بنوا برج بابل'], correct: 0, level: 2, explain: 'أولاد الله اختلطوا بالأشرار والشر انتشر، فاختار ربنا نوح البار يبني الفلك.', hint: 'الخلطة اللي بوّظت الناس' },
            { q: 'اللغات اتعددت في الأرض بسبب...', options: ['الطوفان', 'برج بابل لما ربنا بلبل ألسنتهم', 'سقوط آدم', 'نسل حام'], correct: 1, level: 2, explain: 'قلبهم ارتفع بالكبرياء وعايزين برج راسه في السما، فربنا بلبل ألسنتهم وفرّقهم.', hint: 'برج عالي قوي' },
            { q: 'متوشالح مشهور بإيه؟', options: ['ربنا أخده حي', 'بنى الفلك', 'أطول عمر: ٩٦٩ سنة', 'أول راعي غنم'], correct: 2, level: 3, explain: 'متوشالح صاحب أطول عمر، ٩٦٩ سنة (تك ٥: ٢٧).', hint: 'رقم كبير قوي في السنين' },
            { q: 'مين اللي «سار مع الله ولم يوجد لأن الله أخذه»؟', options: ['أخنوخ', 'متوشالح', 'نوح', 'شيث'], correct: 0, level: 3, explain: 'أخنوخ (تك ٥: ٢٤؛ عب ١١: ٥).', hint: 'من نسل شيث، قبل متوشالح' },
            { q: 'كام نفس دخلت الفلك؟', options: ['٤', '٧', '٨', '١٢'], correct: 2, level: 3, explain: 'دخل الفلك ٨ أنفس: نوح ومراته وولاده التلاتة ومراتاتهم.', hint: 'نوح وعيلته كلها' },
            { q: 'من نسل مين من أولاد نوح جه إبراهيم والمسيح بالجسد؟', options: ['حام', 'يافث', 'كنعان', 'سام'], correct: 3, level: 3, explain: 'من نسل سام جه إبراهيم، ومنه جه المسيح بالجسد.', hint: 'من نسله العبريين والآراميين' }
          ],
          pick: 10, time: 20
        } },
        { id: 's1_order', type: 'verseOrder', title: 'رتّب الآية', desc: 'رتّب قطع الآية بالترتيب الصح', icon: '🧩', max: 30, data: {
          prompt: 'دوس على قطع الآية بالترتيب عشان تكمّلها',
          verses: [
            { text: 'في البدء خلق الله السماوات والأرض', ref: '(تك ١: ١)' },
            { text: 'فخلق الله الإنسان على صورته على صورة الله خلقه ذكرا وأنثى خلقهم', ref: '(تك ١: ٢٧)' },
            { text: 'وأضع عداوة بينك وبين المرأة وبين نسلك ونسلها هو يسحق رأسك وأنت تسحقين عقبه', ref: '(تك ٣: ١٥)' },
            { text: 'وسار أخنوخ مع الله ولم يوجد لأن الله أخذه', ref: '(تك ٥: ٢٤)' },
            { text: 'وضعت قوسي في السحاب فتكون علامة ميثاق بيني وبين الأرض', ref: '(تك ٩: ١٣)' }
          ],
          pick: 3, chunk: 2
        } }
```

Shape for the wordSearch stations (0 and 4) — example words for station 0, all drawn from its existing games/verse:

```js
        { id: 's0_words', type: 'wordSearch', title: 'دوّر على الكلمة', desc: 'لاقي كلمات الدرس المستخبية في الحروف', icon: '🔎', max: 30, data: {
          prompt: 'اسحب صباعك على كل كلمة من كلمات الدرس لما تلاقيها',
          words: [
            { w: 'عبرية', clue: 'لغة العهد القديم' },
            { w: 'يونانية', clue: 'لغة العهد الجديد' },
            { w: 'آرامية', clue: 'الرب يسوع كان بيكلم الناس بيها' },
            { w: 'إسكندرية', clue: 'المدينة اللي اتعملت فيها الترجمة السبعينية' },
            { w: 'هوجو', clue: 'قسّم الأسفار لإصحاحات وآيات سنة ١٢٤٠ م' },
            { w: 'العهد', clue: 'علاقة بين الله وشعبه بتلزم الطرفين' },
            { w: 'موحى', clue: '«كل الكتاب هو ... به من الله»' },
            { w: 'أسفار', clue: 'كتب الكتاب المقدس' }
          ],
          pick: 6, size: 8, time: 120
        } }
```

Write stations 0, 2, 3, 4, 5 the same way (station 0 also gets its `s0_treasure`; station 1 gets the two above). Station themes and allowed sources:
- 0 مقدمة: languages, Septuagint, Hugo, covenant, OT/NT (station 0 games data).
- 2 الآباء: Abraham, Isaac, Jacob and the tribes, Joseph (cards + `s2_*` games).
- 3 الخروج: Moses, plagues, Red Sea, commandments, wilderness (cards + `s3_*` games). Verse examples: خر ٢٠: ٢، خر ١٤: ١٤ — copy Van Dyke text exactly.
- 4 القضاة: Joshua, the judges cycle, Gideon, Deborah, Samson, Ruth (cards + `s4_*` games). wordSearch words e.g. جدعون، دبورة، شمشون، راعوث، نعمي، بوعز، صموئيل، يشوع.
- 5 المملكة: Saul, David, Solomon, the divided kingdom, Elijah/Elisha, Judith, Tobit (cards + `s5_*` games).

- [ ] **Step 4: Write the content log**

Create `docs/superpowers/specs/2026-10-10-bible-games-content-log.md`:

```markdown
# Bible games expansion — content log

Sources for every new question, word and verse added in phase 1 (and later phases). Review by the user or a servant
before release. Format per station: game id → source card titles / existing game ids, and every new verse with its reference.

## الترم الأول (l1_bible)

### Station 1 — عصر الخليقة
- `s1_treasure`: cards «عصر الخليقة»، diagram «أيام الخليقة»، «السقوط... والوعد»، «قايين وهابيل»، diagram «نسل شيث»، «فُلك نوح»، «الطوفان وقوس قزح»، tree «أولاد نوح والأمم»، «برج بابل».
- `s1_order`: تك ١: ١ (card)، تك ١: ٢٧ (new, Van Dyke)، تك ٣: ١٥ (card)، تك ٥: ٢٤ (check explain)، تك ٩: ١٣ (new, Van Dyke).
```

Add one section per station (0, 2, 3, 4, 5) in the same format. List every verse that is not already in that station's data as `(new, Van Dyke)`.

- [ ] **Step 5: Run the checks**

Run: `node tools/check-bible-games.js`
Expected: all `l1_bible` checks pass; final line `38 passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add tools/check-bible-games.js level1-bible-data.js docs/superpowers/specs/2026-10-10-bible-games-content-log.md
git commit -m "Level 1 Bible: treasure + word search / verse order games on all 6 stations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: الترم التاني content (8 stations)

**Files:**
- Modify: `tools/check-bible-games.js` (one line)
- Modify: `level2-bible-data.js` (append 2 games to the `games` array of stations 0-7)
- Modify: `docs/superpowers/specs/2026-10-10-bible-games-content-log.md` (append a section)

**Interfaces:**
- Consumes: `checkBibleSubject(key)` from Task 5; the content rules and object shapes from Task 5 (repeated here).

**Placement for الترم التاني:** stations 1, 3, 4, 6, 7 (have `fillVerse` / `decode`) → `s<n>_words` wordSearch; stations 0, 2, 5 → `s<n>_order` verseOrder. Every station → `s<n>_treasure`.

**Content rules** (same as Task 5): facts only from the station's `cards`, `games` and `verse`; `treasure` 12-15 questions, ≥4 per level 1/2/3, 4 options, `explain` + `hint`; `wordSearch` 8 words, no tashkeel / spaces, 3-8 letters, `clue` each; `verseOrder` 4 verses ≥6 words. Verses Van Dyke, deuterocanonical books in the Coptic church Arabic text (as the existing `L2_BIBLE` data already uses), no tashkeel. Accuracy rules in `docs/superpowers/specs/2026-10-02-level2-bible-design.md` section «Accuracy (Coptic Orthodox)» apply.

Game object shapes (copy, then fill from the station):

```js
        { id: 's<n>_treasure', type: 'treasure', title: 'مين يكسب الكنز', desc: '١٠ أسئلة بتصعب واحدة ورا التانية، ومعاك ٣ وسائل مساعدة', icon: '💎', max: 30, data: {
          prompt: 'اطلع سلّم الكنز سؤال سؤال! معاك ٣ قلوب و٣ وسائل مساعدة',
          questions: [ { q: '...', options: ['...', '...', '...', '...'], correct: 0, level: 1, explain: '...', hint: '...' } /* 12-15 */ ],
          pick: 10, time: 20
        } },
        { id: 's<n>_words', type: 'wordSearch', title: 'دوّر على الكلمة', desc: 'لاقي كلمات الدرس المستخبية في الحروف', icon: '🔎', max: 30, data: {
          prompt: 'اسحب صباعك على كل كلمة من كلمات الدرس لما تلاقيها',
          words: [ { w: 'يعقوب', clue: '...' } /* 8 */ ],
          pick: 6, size: 8, time: 120
        } },
        { id: 's<n>_order', type: 'verseOrder', title: 'رتّب الآية', desc: 'رتّب قطع الآية بالترتيب الصح', icon: '🧩', max: 30, data: {
          prompt: 'دوس على قطع الآية بالترتيب عشان تكمّلها',
          verses: [ { text: '...', ref: '(...)' } /* 4+ */ ],
          pick: 3, chunk: 2
        } }
```

Station themes: 0 الأسفار القانونية الثانية (what canonical means, why "second", objections, each book); 1 طرق الدراسة (read & understand, ask & imagine, pray the text, live it); 2 الكاثوليكون (James, Peter, John, Jude); 3-7 = James chapters 1-5 (topics in each station's `topics`).

- [ ] **Step 1: Add the failing check**

In `tools/check-bible-games.js`, change `checkBibleSubject('l1_bible');` to:

```js
checkBibleSubject('l1_bible');
checkBibleSubject('l2_bible');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/check-bible-games.js`
Expected: 24 new FAILs for `l2_bible station 0..7`, exit 1.

- [ ] **Step 3: Write the content** for stations 0-7 of `level2-bible-data.js` following the placement, rules and shapes above.

- [ ] **Step 4: Append the content log** section `## الترم التاني (l2_bible)` with one `### Station n — <title>` per station, same format as Task 5.

- [ ] **Step 5: Run the checks**

Run: `node tools/check-bible-games.js`
Expected: `62 passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add tools/check-bible-games.js level2-bible-data.js docs/superpowers/specs/2026-10-10-bible-games-content-log.md
git commit -m "Level 2 Bible: treasure + word search / verse order games on all 8 stations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Contracts doc, cache bump, browser verification

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-level1-contracts.md` (section A, after the `decode:` line in the "Game `data` per type" code block, ~line 63)
- Modify: `sw.js:9`

**Interfaces:**
- Consumes: everything from Tasks 1-6.

- [ ] **Step 1: Document the new types and `scoring`**

In the contracts doc, inside the "Game `data` per type" code block, after the `decode:` line add:

```js
treasure:   { prompt, questions:[{ q, options:[4], correct, explain, hint, level:1|2|3 }], pick:10, time:20 }  // ladder ordered by level, 3 hearts, lifelines 50:50 / hint / +15s; raw = sum of levels answered right
wordSearch: { prompt, words:[{ w:'نوح', clue:'...' }], pick:6, size:8, time:120 }   // w: no tashkeel, no spaces, 3..size letters; grid renders RTL
verseOrder: { prompt, verses:[{ text, ref }], pick:3, chunk:2 }                   // tap tiles of `chunk` words in reading order
```

And right after the `### Game (common fields)` code block add:

```markdown
Subject-level `scoring: { games, max }` (optional) overrides the games bucket cap (default 140) and the station max
(default 200) for that subject only. Pass mark stays `L1_PASS` (140). Bible subjects use `{ games: 250, max: 310 }`.
```

- [ ] **Step 2: Bump the service worker cache**

`sw.js` line 9: `var CACHE_NAME = 'min-el-batal-v34';` → `var CACHE_NAME = 'min-el-batal-v35';`

- [ ] **Step 3: Run the check script once more**

Run: `node tools/check-bible-games.js`
Expected: `62 passed, 0 failed`.

- [ ] **Step 4: Browser verification (phone width)**

Serve the folder: `python3 -m http.server 5173` (from the repo root), open `http://localhost:5173` in Chrome, DevTools device toolbar at 360×740, log in with a **test** player account (not a real kid's account — the steps below write scores). Then in the console:

```js
l1State.subject = 'l1_bible';
[0,1,2,3,4,5].forEach(function(n){ l1SetBucket(n, 'learnRead', 20, true); });
l1StartStation(1); l1State.tab = 'games'; renderL1Lesson();
```

For each new game on L1 station 1 (`s1_treasure`, `s1_order`) and station 0 (`s0_words`), then one L2 station of each kind (`l1State.subject = 'l2_bible'` and repeat), check and note the result:
- **treasure:** answer right / wrong / let the timer run out (shows «⏰ الوقت خلص!» once, then moves on); each lifeline works once and is greyed after; losing 3 hearts ends the game; result screen shows score out of 30.
- **word search drag:** drag across a word horizontally, vertically and diagonally — the page does not scroll, the selection follows the finger in a straight line, found words turn green and their clue appears; a wrong drag shakes the grid; a single tap does nothing.
- **verse order:** wrong tile shakes, right tiles build the verse right-to-left; a verse with a repeated tile accepts either copy.
- **exit mid-game:** press ✕ during each game; wait 25 s on the games tab; nothing pops up later (no late result screen, no console errors).
- **scores:** station total chip shows `/310` on Bible stations; open a Service station (`l1State.subject='l1_service'`) and confirm it still shows `/200`; same for a Life station (`l1State.subject='l2_life'`).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-29-level1-contracts.md sw.js
git commit -m "Document new L1 game types and per-subject scoring; bump SW cache

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
