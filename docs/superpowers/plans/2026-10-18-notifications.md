# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins get push + live in-panel alerts for questions, replies, reports, gift and admin requests; players get push + an in-game bell for unlocked lessons, selfie challenges, tournaments, teammate invites, a servant's answer, and 2-day inactivity / Bible reminders.

**Architecture:** One send service in Cloud Functions (`functions/notify.js`) stores each notification once in `notifications` (keyed by audience) and sends **data-only** FCM messages to device tokens kept in `pushTokens`. Service workers (`sw.js` for the game, new `admin-sw.js` for the panel) display them and route taps; the game reads `notifications` for its bell. Pure decision logic (texts, levels, reminders, Cairo dates) lives in `functions/notify-logic.js` and is unit tested.

**Tech Stack:** Vanilla JS, Firebase compat SDK 10.8.0 (Firestore, Messaging), Cloud Functions v1 API on firebase-functions 5.1.1 / firebase-admin 12.7.0, Node 22, `node:test`, Firestore emulator (Java 17 present) for rules.

**Spec:** `docs/superpowers/specs/2026-10-18-notifications-design.md`

## Global Constraints
- No build step, no new npm dependencies (functions or game). Tests use `node:test` / `assert` and the vm-stub style of `tools/check-season-reset.js`.
- Functions use the v1 API like `functions/index.js`: `functions.region('europe-west1')`.
- All user-facing text Arabic, warm, youth-friendly, one emoji per title; RTL.
- FCM messages are **data-only** (`data: {type, title, body, link, tag}`); service workers display them. No top-level `notification` payload anywhere (it causes double display).
- Dates for reminders are Cairo calendar dates `YYYY-MM-DD` computed with `Intl` + `Africa/Cairo`.
- Firestore rules: only the four collections in the spec change; everything else stays `if true`.
- Bump `sw.js` `CACHE_NAME` (currently `min-el-batal-v44`) once per stage that touches game files.
- Do not deploy; the user runs `firebase deploy`. Commit per task.
- Link shapes: game `{screen, id?, code?}` with `screen` ∈ `home | question | subject | selfie | duel | room | bible | post | tournament | rewards`; admin `{page, id?}` with `page` ∈ `questions | reports | rewards | admins`.

## Review Focus
1. Player logs out on a shared phone, another logs in → the old owner's pushes must stop and the new owner's start (token doc `owner` overwritten on login, deleted on logout) — Task 4 test.
2. Tap a notification while the game is closed / logged out → after (auto-)login the target opens once, not on every reload — Task 4 test (`?n=` → sessionStorage → consumed).
3. Player with `notifPrefs.lessons === false` or `blocked` status must get no lesson push but a servant's answer still arrives — Task 1 + Task 2 tests.
4. Reminders around Egypt's summer-time switch and at 00:30 Cairo must use the Cairo date, not UTC — Task 1 test.
5. Same lock unlocked twice in a row (admin double-click) or the queue doc retried → exactly one push — guarded by `notifySent/{key}_{setAt}.create()` in Task 10; checked in Manual acceptance step 3 (tick the box, save twice quickly → one push).

---

## Stage 1 — Foundation

### Task 1: Pure notification logic

**Files:**
- Create: `functions/notify-logic.js`
- Create: `functions/test/notify-logic.test.js`
- Modify: `functions/package.json` (add `"scripts": {"test": "node --test test/"}`)

**Interfaces:**
- Produces (all exported from `notify-logic.js`):
  - `cairoDate(date?: Date): string` → `'YYYY-MM-DD'` in Africa/Cairo
  - `daysBetween(a: string, b: string): number` → whole days from `a` to `b` (both `YYYY-MM-DD`)
  - `playerLevelOf(p): 1|2` (same rule as `game.js:621`)
  - `matchesLevel(p, n: number, levelBy: 'content'|'compete'): boolean`
  - `categoryOf(type: string): 'lessons'|'competitions'|'reminders'|'social'|null`
  - `prefAllows(prefs, type): boolean`
  - `message(type: string, v: object): {title, body}`
  - `reminderFor(p, today: string): null|'remind_inactive'|'remind_bible'`
  - `parseLockKey(key): null|{kind:'lesson'|'subject'|'level', subject?, index?, n?}`
  - `stripHtml(html): string`, `firstName(name): string`, `playerMatchesSegments(p, seg)` (moved from index.js)

- [ ] **Step 1: Write the failing tests**

```js
// functions/test/notify-logic.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../notify-logic');

test('cairoDate uses Cairo calendar day (summer +3, winter +2)', () => {
    assert.strictEqual(L.cairoDate(new Date('2026-07-01T21:30:00Z')), '2026-07-02'); // 00:30 Cairo summer
    assert.strictEqual(L.cairoDate(new Date('2026-12-01T21:30:00Z')), '2026-12-01'); // 23:30 Cairo winter
    assert.strictEqual(L.cairoDate(new Date('2026-12-01T22:30:00Z')), '2026-12-02');
});

test('daysBetween counts calendar days', () => {
    assert.strictEqual(L.daysBetween('2026-10-16', '2026-10-18'), 2);
    assert.strictEqual(L.daysBetween('2026-10-18', '2026-10-18'), 0);
    assert.strictEqual(L.daysBetween('2026-02-27', '2026-03-01'), 2);
});

test('playerLevelOf matches game rule', () => {
    assert.strictEqual(L.playerLevelOf({ playerLevel: 2 }), 2);
    assert.strictEqual(L.playerLevelOf({ stationScores: { faith_0: { total: 5 } } }), 2);
    assert.strictEqual(L.playerLevelOf({ stationScores: { l1_bible_0: { total: 5 } } }), 1);
    assert.strictEqual(L.playerLevelOf({ stationScores: { l2_life_1: { total: 0 } } }), 1);
});

test('matchesLevel: content uses player level, compete prefers team level', () => {
    const p = { playerLevel: 1, teamLevel: 2 };
    assert.strictEqual(L.matchesLevel(p, 1, 'content'), true);
    assert.strictEqual(L.matchesLevel(p, 2, 'compete'), true);
    assert.strictEqual(L.matchesLevel(p, 1, 'compete'), false);
});

test('prefs: category off blocks, answers always allowed', () => {
    assert.strictEqual(L.prefAllows({ lessons: false }, 'lesson_unlock'), false);
    assert.strictEqual(L.prefAllows({ lessons: false }, 'question_answer'), true);
    assert.strictEqual(L.prefAllows({}, 'selfie'), true);
    assert.strictEqual(L.prefAllows({ competitions: false }, 'invite_duel'), false);
    assert.strictEqual(L.prefAllows({ reminders: false }, 'remind_bible'), false);
    assert.strictEqual(L.prefAllows(undefined, 'post'), true);
});

test('message builds every type with no undefined text', () => {
    const v = { name: 'ريتا هاني', title: 'عصر الخليقة', reporter: 'أ', reported: 'ب', reason: 'شتيمة',
        reward: 'كتاب', n: 2, stars: 50, day: 'الجمعة', team: 'النسور', text: 'شكرا', seed: 3 };
    ['admin_question', 'admin_reply', 'admin_report', 'admin_reward', 'admin_request', 'question_answer',
     'lesson_unlock', 'subject_unlock', 'level_unlock', 'selfie', 'tournament', 'invite_duel', 'invite_room',
     'remind_inactive', 'remind_bible'].forEach((t) => {
        const m = L.message(t, v);
        assert.ok(m.title && m.body, t);
        assert.ok(!/undefined|null/.test(m.title + m.body), t + ': ' + m.title + ' / ' + m.body);
    });
    assert.match(L.message('admin_question', v).title, /ريتا/);
    assert.match(L.message('remind_inactive', v).title, /ريتا/);
    assert.doesNotMatch(L.message('remind_inactive', v).title, /هاني/);
});

test('reminderFor: decision table', () => {
    const today = '2026-10-18';
    const base = { createdAt: '2026-09-01T10:00:00Z', lastActiveDate: '2026-10-18', lastBibleDate: '2026-10-18' };
    assert.strictEqual(L.reminderFor(base, today), null);
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-16' }, today), 'remind_inactive');
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-17' }, today), null);
    assert.strictEqual(L.reminderFor({ ...base, lastBibleDate: '2026-10-16' }, today), 'remind_bible');
    assert.strictEqual(L.reminderFor({ ...base, lastBibleDate: '' }, today), 'remind_bible');
    // inactive wins over Bible (never both)
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-10', lastBibleDate: '' }, today), 'remind_inactive');
    // every 2 days while away
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-01', lastRemindDate: '2026-10-17' }, today), null);
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-01', lastRemindDate: '2026-10-16' }, today), 'remind_inactive');
    // new account, prefs off, blocked
    assert.strictEqual(L.reminderFor({ ...base, createdAt: '2026-10-17T08:00:00Z', lastActiveDate: '' }, today), null);
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-01', notifPrefs: { reminders: false } }, today), null);
    assert.strictEqual(L.reminderFor({ ...base, lastActiveDate: '2026-10-01', status: 'blocked' }, today), null);
    // no dates at all → inactive
    assert.strictEqual(L.reminderFor({}, today), 'remind_inactive');
});

test('parseLockKey', () => {
    assert.deepStrictEqual(L.parseLockKey('lesson_l1_bible_3'), { kind: 'lesson', subject: 'l1_bible', index: 3 });
    assert.deepStrictEqual(L.parseLockKey('lesson_faith_0'), { kind: 'lesson', subject: 'faith', index: 0 });
    assert.deepStrictEqual(L.parseLockKey('subject_l2_life'), { kind: 'subject', subject: 'l2_life' });
    assert.deepStrictEqual(L.parseLockKey('level_2'), { kind: 'level', n: 2 });
    assert.strictEqual(L.parseLockKey('card_compete'), null);
    assert.strictEqual(L.parseLockKey('lesson_x'), null);
});

test('stripHtml and firstName', () => {
    assert.strictEqual(L.stripHtml('<p>سلام&nbsp;<b>ليك</b></p>'), 'سلام ليك');
    assert.strictEqual(L.firstName('  ريتا هاني '), 'ريتا');
    assert.strictEqual(L.firstName(''), 'يا بطل');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test test/`
Expected: FAIL — `Cannot find module '../notify-logic'`

- [ ] **Step 3: Implement `functions/notify-logic.js`**

```js
// Pure notification logic: no Firebase imports, unit tested in test/notify-logic.test.js
'use strict';

var CAIRO_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
function cairoDate(date) { return CAIRO_FMT.format(date || new Date()); }

function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

var L2_PROGRESS_PREFIXES = ['faith_', 'ritual_', 'l2_bible_', 'l2_life_'];
function playerLevelOf(p) {
    if (p && (p.playerLevel === 1 || p.playerLevel === 2)) return p.playerLevel;
    var ss = (p && p.stationScores) || {};
    return Object.keys(ss).some(function(k) {
        return (ss[k] && ss[k].total > 0) && L2_PROGRESS_PREFIXES.some(function(pre) { return k.indexOf(pre) === 0; });
    }) ? 2 : 1;
}
function matchesLevel(p, n, levelBy) {
    var lv = levelBy === 'compete' ? ((p && p.teamLevel) || playerLevelOf(p)) : playerLevelOf(p);
    return lv === n;
}

var CATEGORY = {
    lesson_unlock: 'lessons', subject_unlock: 'lessons', level_unlock: 'lessons',
    selfie: 'competitions', tournament: 'competitions', invite_duel: 'competitions', invite_room: 'competitions',
    remind_inactive: 'reminders', remind_bible: 'reminders', weekly_reminder: 'reminders', announcement: 'reminders',
    post: 'social', post_comment: 'social'
};
function categoryOf(type) { return CATEGORY[type] || null; }
function prefAllows(prefs, type) {
    var c = categoryOf(type);
    return !c || !prefs || prefs[c] !== false;
}

function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'يا بطل'; }
function stripHtml(html) {
    if (!html) return '';
    var text = String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
}
function pick(arr, seed) { return arr[Math.abs(seed || 0) % arr.length]; }

var INACTIVE = [
    'فريقك محتاجك… ادخل كمّل رحلتك 🚀',
    'نجومك مستنياك، خطوة صغيرة النهارده تفرق',
    'في جديد مستنيك في مين البطل، تعالى شوف',
    'رحلتك مع ربنا مستمرة… يلا نكمّل سوا'
];
var VERSES = [
    '«سراج لرجلي كلامك ونور لسبيلي» — اقرا أصحاح النهارده',
    '«كلامك حلو لحلقي أحلى من العسل» — خمس دقايق مع الإنجيل',
    '«طوبى للذي يقرأ» — كمّل قراءتك وخد نجومك',
    '«كلمة الله حية وفعالة» — أصحاح النهارده مستنيك'
];

function message(type, v) {
    v = v || {};
    var name = v.name || 'حد';
    switch (type) {
        case 'admin_question':  return { title: 'سؤال جديد من ' + name + ' 💬', body: '«' + (v.title || 'سؤال') + '»' };
        case 'admin_reply':     return { title: name + ' رد على سؤاله ↩️', body: v.text || 'في رد جديد مستني' };
        case 'admin_report':    return { title: 'بلاغ جديد ⚠️', body: (v.reporter || 'لاعب') + ' بلّغ عن ' + (v.reported || 'لاعب') + ': ' + (v.reason || 'بدون سبب') };
        case 'admin_reward':    return { title: 'طلب هدية 🎁', body: name + ' عايز «' + (v.reward || 'هدية') + '»' };
        case 'admin_request':   return { title: 'طلب انضمام للخدمة 🙋', body: name + ' عايز يبقى أدمن' };
        case 'question_answer': return { title: 'الخادم رد على سؤالك ✉️', body: v.text || 'ادخل شوف الرد' };
        case 'lesson_unlock':   return { title: 'درس جديد اتفتح! 📖', body: '«' + (v.title || 'درس جديد') + '» مستنيك… ادخل اكسب نجومك ⭐' };
        case 'subject_unlock':  return { title: 'مادة جديدة اتفتحت 🔓', body: '«' + (v.title || 'مادة جديدة') + '» جاهزة ليك، يلا نبدأ!' };
        case 'level_unlock':    return { title: 'المستوى ' + (v.n || '') + ' اتفتح 🚀', body: 'مغامرة جديدة جاهزة ليك، يلا نبدأ!' };
        case 'selfie':          return { title: 'تحدي سيلفي جديد 📸', body: '«' + (v.title || 'التحدي') + '»: صوّر واكسب ' + (v.stars || 0) + ' نجمة قبل ' + (v.day || 'ما يخلص') };
        case 'tournament':      return { title: 'فريقك في كاس مين البطل! 🏆', body: '«' + (v.title || 'البطولة') + '» بدأت دلوقتي، شجّع ' + (v.team || 'فريقك') + ' لايف' };
        case 'invite_duel':     return { title: firstName(name) + ' بيتحداك! ⚔️', body: 'مبارزة 1 ضد 1… تقبل التحدي؟' };
        case 'invite_room':     return { title: firstName(name) + ' بيناديك للمنافسة 🎮', body: 'الأوضة مستنياك، ادخل قبل ما تبدأ' };
        case 'remind_inactive': return { title: 'وحشتنا يا ' + firstName(v.name) + '! 💛', body: pick(INACTIVE, v.seed) };
        case 'remind_bible':    return { title: 'كلمة ربنا مستنياك 📖', body: pick(VERSES, v.seed) };
        default:                return { title: v.title || 'مين البطل؟', body: v.text || 'عندك إشعار جديد' };
    }
}

function reminderFor(p, today) {
    if (!p || p.status === 'blocked' || p.status === 'suspended') return null;
    if (!prefAllows(p.notifPrefs, 'remind_inactive')) return null;
    var created = typeof p.createdAt === 'string' ? p.createdAt.slice(0, 10) : '';
    if (created && daysBetween(created, today) < 2) return null;
    if (p.lastRemindDate && daysBetween(p.lastRemindDate, today) < 2) return null;
    var active = p.lastActiveDate || created;
    if (!active || daysBetween(active, today) >= 2) return 'remind_inactive';
    if (!p.lastBibleDate || daysBetween(p.lastBibleDate, today) >= 2) return 'remind_bible';
    return null;
}

function parseLockKey(key) {
    var m = /^lesson_([a-z0-9_]+)_(\d+)$/.exec(key || '');
    if (m) return { kind: 'lesson', subject: m[1], index: Number(m[2]) };
    m = /^subject_([a-z0-9_]+)$/.exec(key || '');
    if (m) return { kind: 'subject', subject: m[1] };
    m = /^level_(\d+)$/.exec(key || '');
    if (m) return { kind: 'level', n: Number(m[1]) };
    return null;
}

function daysSinceStr(dateStr) {
    if (!dateStr) return 99999;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return 99999;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
}
// Moved verbatim from index.js (matches admin.html playerMatchesSegments)
function playerMatchesSegments(p, seg) {
    if (!seg) return true;
    if (seg.gender && seg.gender !== 'all' && p.gender !== seg.gender) return false;
    var hasTeam = !!(p.team && String(p.team).trim());
    if (seg.team === 'has' && !hasTeam) return false;
    if (seg.team === 'none' && hasTeam) return false;
    if (seg.year && seg.year !== 'all' && p.academicYear !== seg.year) return false;
    var last = (p.lampData && p.lampData.lastActiveDate) || p.lastActiveDate || '';
    var days = daysSinceStr(last);
    if (seg.activity === 'inactive3' && !(days >= 3)) return false;
    if (seg.activity === 'inactive7' && !(days >= 7)) return false;
    if (seg.activity === 'inactive30' && !(days >= 30)) return false;
    if (seg.activity === 'active' && !(days <= 3)) return false;
    var st = +p.stars || 0;
    if (seg.stars === 'lt100' && !(st < 100)) return false;
    if (seg.stars === 'lt500' && !(st < 500)) return false;
    if (seg.stars === 'lt1000' && !(st < 1000)) return false;
    if (seg.stars === 'gte1000' && !(st >= 1000)) return false;
    return true;
}

module.exports = { cairoDate, daysBetween, playerLevelOf, matchesLevel, categoryOf, prefAllows, message,
    reminderFor, parseLockKey, stripHtml, firstName, playerMatchesSegments };
```

Note on the `'lesson_x'` case: `/^lesson_([a-z0-9_]+)_(\d+)$/` does not match `lesson_x` (no trailing index) → `null`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test test/`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add functions/notify-logic.js functions/test/notify-logic.test.js functions/package.json
git commit -m "Notifications: pure logic for texts, levels, prefs, reminders and Cairo dates"
```

### Task 2: Send service `notify()`

**Files:**
- Create: `functions/notify.js`
- Create: `functions/test/notify.test.js`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `makeNotifier({db, messaging, FieldValue}) → { notify, sendToTokens, playerTokenMap }`
  - `notify(audience: string, msg: {type, title, body, link}, opts?: {id?, store?=true, levelBy?='content', segments?}) → Promise<{sent:number, attempted:number}>`
    - `audience`: phone | `'all'` | `'level_1'` | `'level_2'` | `'admins'`
    - stores `notifications/{opts.id||auto}` = `{audience, type, title, body, link, levelBy, createdAt: serverTimestamp}` when `store`
  - `sendToTokens(tokens: string[], msg) → Promise<{sent, attempted}>` (dedupes, batches of 500, deletes dead `pushTokens` docs and legacy `players.fcmToken`)
  - `playerTokenMap() → Promise<Object<phone, string[]>>` (all `pushTokens` with role `player`)
  - Legacy: a player's `fcmToken` field is included for player audiences and tagged so that a dead legacy token deletes `players/{phone}.fcmToken`.

- [ ] **Step 1: Write the failing tests** (in-memory fakes, no emulator)

```js
// functions/test/notify.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeNotifier } = require('../notify');

function fakeDb(data) {
    const writes = [], deletes = [], updates = [];
    function snap(col, id, d) { return { id, exists: !!d, data: () => d, ref: ref(col, id) }; }
    function ref(col, id) {
        return {
            id,
            get: async () => snap(col, id, (data[col] || {})[id]),
            set: async (d) => { writes.push({ col, id, d }); },
            delete: async () => { deletes.push({ col, id }); },
            update: async (d) => { updates.push({ col, id, d }); }
        };
    }
    function query(col, filters) {
        return {
            where: (f, op, v) => query(col, filters.concat([[f, op, v]])),
            select: () => query(col, filters),
            get: async () => {
                const docs = Object.entries(data[col] || {}).filter(([, d]) =>
                    filters.every(([f, op, v]) => op === '==' ? d[f] === v : op === 'in' ? v.includes(d[f]) : true))
                    .map(([id, d]) => snap(col, id, d));
                return { docs, size: docs.length, forEach: (fn) => docs.forEach(fn) };
            }
        };
    }
    let auto = 0;
    return {
        writes, deletes, updates,
        collection: (col) => Object.assign(query(col, []), { doc: (id) => ref(col, id || 'auto' + (++auto)) })
    };
}
function fakeMessaging(dead) {
    const sent = [];
    return { sent, sendEach: async (msgs) => {
        sent.push(...msgs);
        return { responses: msgs.map((m) => dead.includes(m.token)
            ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
            : { success: true }) };
    } };
}
const FieldValue = { serverTimestamp: () => 'TS', delete: () => 'DEL' };
const MSG = { type: 'lesson_unlock', title: 't', body: 'b', link: { screen: 'subject', id: 'l1_bible' } };

function world() {
    return fakeDb({
        players: {
            '0101': { playerLevel: 1 },
            '0102': { playerLevel: 2 },
            '0103': { playerLevel: 1, notifPrefs: { lessons: false } },
            '0104': { playerLevel: 1, status: 'blocked' },
            '0105': { playerLevel: 1, fcmToken: 'legacy5' }
        },
        pushTokens: {
            t1: { owner: '0101', role: 'player' }, t1b: { owner: '0101', role: 'player' },
            t2: { owner: '0102', role: 'player' }, t3: { owner: '0103', role: 'player' },
            t4: { owner: '0104', role: 'player' }, ta: { owner: 'admin:x', role: 'admin' }
        }
    });
}

test('level audience: right level, prefs and status respected, legacy token included, stored once', async () => {
    const db = world(), m = fakeMessaging([]);
    const n = makeNotifier({ db, messaging: m, FieldValue });
    const r = await n.notify('level_1', MSG, { id: 'ev1' });
    assert.deepStrictEqual(m.sent.map((x) => x.token).sort(), ['legacy5', 't1', 't1b']);
    assert.strictEqual(r.sent, 3);
    const stored = db.writes.filter((w) => w.col === 'notifications');
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].id, 'ev1');
    assert.strictEqual(stored[0].d.audience, 'level_1');
});

test('messages are data-only with string values', async () => {
    const db = world(), m = fakeMessaging([]);
    await makeNotifier({ db, messaging: m, FieldValue }).notify('0102', MSG);
    const msg = m.sent[0];
    assert.strictEqual(msg.notification, undefined);
    assert.strictEqual(msg.data.title, 't');
    assert.strictEqual(JSON.parse(msg.data.link).screen, 'subject');
    Object.values(msg.data).forEach((v) => assert.strictEqual(typeof v, 'string'));
});

test('single player: pref off blocks lessons but answers still go', async () => {
    const db = world(), m = fakeMessaging([]);
    const n = makeNotifier({ db, messaging: m, FieldValue });
    await n.notify('0103', MSG);
    assert.strictEqual(m.sent.length, 0);
    await n.notify('0103', { type: 'question_answer', title: 'a', body: 'b', link: { screen: 'question', id: 'q' } });
    assert.strictEqual(m.sent.length, 1);
});

test('admins audience', async () => {
    const db = world(), m = fakeMessaging([]);
    await makeNotifier({ db, messaging: m, FieldValue }).notify('admins', { type: 'admin_question', title: 'x', body: 'y', link: { page: 'questions' } });
    assert.deepStrictEqual(m.sent.map((x) => x.token), ['ta']);
});

test('dead tokens are deleted (token doc and legacy field)', async () => {
    const db = world(), m = fakeMessaging(['t1', 'legacy5']);
    await makeNotifier({ db, messaging: m, FieldValue }).notify('level_1', MSG);
    assert.deepStrictEqual(db.deletes.filter((d) => d.col === 'pushTokens').map((d) => d.id), ['t1']);
    assert.ok(db.updates.some((u) => u.col === 'players' && u.id === '0105' && u.d.fcmToken === 'DEL'));
});

test('store:false writes nothing; duplicates send once', async () => {
    const db = world(), m = fakeMessaging([]);
    const n = makeNotifier({ db, messaging: m, FieldValue });
    await n.sendToTokens(['a', 'a', 'b', '', null], MSG);
    assert.deepStrictEqual(m.sent.map((x) => x.token), ['a', 'b']);
    await n.notify('0101', MSG, { store: false });
    assert.strictEqual(db.writes.filter((w) => w.col === 'notifications').length, 0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd functions && node --test test/`
Expected: FAIL — `Cannot find module '../notify'`

- [ ] **Step 3: Implement `functions/notify.js`**

```js
// Notification send service: stores one doc per notification in `notifications` (the in-game bell
// reads it by audience) and sends data-only FCM messages to every device token of that audience.
'use strict';
var L = require('./notify-logic');

var DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];
var PLAYER_FIELDS = ['playerLevel', 'teamLevel', 'stationScores', 'notifPrefs', 'status', 'fcmToken',
    'gender', 'team', 'academicYear', 'lastActiveDate', 'lampData', 'stars'];

function makeNotifier(deps) {
    var db = deps.db, messaging = deps.messaging, FieldValue = deps.FieldValue;

    async function playerTokenMap() {
        var snap = await db.collection('pushTokens').where('role', '==', 'player').get();
        var map = {};
        snap.forEach(function(d) { var o = d.data().owner; (map[o] = map[o] || []).push(d.id); });
        return map;
    }

    // Returns [{token, legacyOwner?}]
    async function targetsFor(audience, msg, opts) {
        if (audience === 'admins') {
            var a = await db.collection('pushTokens').where('role', '==', 'admin').get();
            return a.docs.map(function(d) { return { token: d.id }; });
        }
        var players = [];
        if (audience === 'all' || /^level_\d$/.test(audience)) {
            var ps = await db.collection('players').select(...PLAYER_FIELDS).get();
            players = ps.docs.map(function(d) { return { id: d.id, p: d.data() || {} }; });
        } else {
            var one = await db.collection('players').doc(audience).get();
            if (one.exists) players = [{ id: audience, p: one.data() || {} }];
        }
        var level = /^level_(\d)$/.exec(audience);
        players = players.filter(function(x) {
            if (x.p.status === 'blocked' || x.p.status === 'suspended') return false;
            if (!L.prefAllows(x.p.notifPrefs, msg.type)) return false;
            if (level && !L.matchesLevel(x.p, Number(level[1]), opts.levelBy || 'content')) return false;
            if (opts.segments && !L.playerMatchesSegments(x.p, opts.segments)) return false;
            return true;
        });
        if (!players.length) return [];
        var map = await playerTokenMap();
        var out = [];
        players.forEach(function(x) {
            (map[x.id] || []).forEach(function(t) { out.push({ token: t }); });
            if (x.p.fcmToken) out.push({ token: x.p.fcmToken, legacyOwner: x.id });
        });
        return out;
    }

    function fcmMessage(token, msg) {
        return {
            token: token,
            data: {
                type: String(msg.type || ''),
                title: String(msg.title || ''),
                body: String(msg.body || ''),
                link: JSON.stringify(msg.link || {}),
                tag: String(msg.tag || msg.type || '')
            },
            webpush: { headers: { Urgency: 'high', TTL: '86400' } }
        };
    }

    async function sendTargets(targets, msg) {
        var seen = {}, list = [];
        targets.forEach(function(t) { if (t && t.token && !seen[t.token]) { seen[t.token] = 1; list.push(t); } });
        var sent = 0;
        for (var i = 0; i < list.length; i += 500) {
            var chunk = list.slice(i, i + 500);
            var res = await messaging.sendEach(chunk.map(function(t) { return fcmMessage(t.token, msg); }));
            var cleanup = [];
            res.responses.forEach(function(r, j) {
                if (r.success) { sent++; return; }
                var code = r.error && r.error.code;
                if (DEAD.indexOf(code) < 0) { console.warn('[notify] send failed', code); return; }
                var t = chunk[j];
                cleanup.push(t.legacyOwner
                    ? db.collection('players').doc(t.legacyOwner).update({ fcmToken: FieldValue.delete() }).catch(function() {})
                    : db.collection('pushTokens').doc(t.token).delete().catch(function() {}));
            });
            await Promise.all(cleanup);
        }
        return { sent: sent, attempted: list.length };
    }

    function sendToTokens(tokens, msg) {
        return sendTargets((tokens || []).map(function(t) { return { token: t }; }), msg);
    }

    async function notify(audience, msg, opts) {
        opts = opts || {};
        try {
            if (opts.store !== false) {
                var col = db.collection('notifications');
                await (opts.id ? col.doc(opts.id) : col.doc()).set({
                    audience: audience, type: msg.type, title: msg.title, body: msg.body,
                    link: msg.link || {}, levelBy: opts.levelBy || 'content', createdAt: FieldValue.serverTimestamp()
                });
            }
            var r = await sendTargets(await targetsFor(audience, msg, opts), msg);
            console.log('[notify]', msg.type, '→', audience, r.sent + '/' + r.attempted);
            return r;
        } catch (e) {
            console.error('[notify] failed', msg && msg.type, audience, e);
            return { sent: 0, attempted: 0 };
        }
    }

    return { notify: notify, sendToTokens: sendToTokens, playerTokenMap: playerTokenMap };
}

module.exports = { makeNotifier: makeNotifier };
```

- [ ] **Step 4: Run tests**

Run: `cd functions && node --test test/`
Expected: all pass (Task 1 + Task 2).

- [ ] **Step 5: Commit**

```bash
git add functions/notify.js functions/test/notify.test.js
git commit -m "Notifications: send service storing one doc per audience and data-only FCM with dead-token cleanup"
```

### Task 3: Rules, index, and rules test

**Files:**
- Modify: `firestore.rules` (add four matches before the final closing braces)
- Create: `firestore.indexes.json`
- Modify: `firebase.json` (`"firestore": {"rules": "firestore.rules", "indexes": "firestore.indexes.json"}`)
- Create: `tools/check-rules.js`

**Interfaces:**
- Produces: collection contracts used by Tasks 4, 7, 10, 12.

- [ ] **Step 1: Write the rules test** (talks to the emulator REST API with `fetch`, no deps)

```js
#!/usr/bin/env node
/* Firestore rules checks for the notification collections. Run:
   firebase emulators:exec --only firestore "node tools/check-rules.js" */
'use strict';
var BASE = 'http://' + (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080') +
    '/v1/projects/min-el-batal/databases/(default)/documents/';
function fields(o) {
    var f = {};
    Object.keys(o).forEach(function(k) {
        var v = o[k];
        f[k] = typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v };
    });
    return { fields: f };
}
async function req(method, path, body, admin) {
    var r = await fetch(BASE + path, { method: method, headers: Object.assign({ 'Content-Type': 'application/json' },
        admin ? { Authorization: 'Bearer owner' } : {}), body: body ? JSON.stringify(body) : undefined });
    return r.status;
}
var failed = 0, passed = 0;
async function expect(name, p, ok) {
    var s = await p, good = ok ? s === 200 : s === 403;
    if (good) passed++; else { failed++; console.log('FAIL ' + name + ' → ' + s); }
}
(async function() {
    // seed locks as the owner (bypasses rules)
    await req('PATCH', 'gameContent/locks', { fields: {
        lesson_l1_bible_2: { mapValue: { fields: { locked: { booleanValue: false } } } },
        lesson_l1_bible_3: { mapValue: { fields: { locked: { booleanValue: true } } } } } }, true);
    var now = Date.now();
    await expect('notifications: client create denied', req('PATCH', 'notifications/x', fields({ audience: 'all', title: 'hi' })), false);
    var rs = await req('GET', 'notifications/x');   // allowed read of a missing doc → 404, never 403
    if (rs === 403) { failed++; console.log('FAIL notifications: read allowed → 403'); } else passed++;
    await expect('pushTokens: valid create', req('PATCH', 'pushTokens/tok1', fields({ owner: '0101', role: 'player', updatedAt: now })), true);
    await expect('pushTokens: extra field denied', req('PATCH', 'pushTokens/tok2', fields({ owner: '0101', role: 'player', updatedAt: now, x: 'y' })), false);
    await expect('pushTokens: bad role denied', req('PATCH', 'pushTokens/tok3', fields({ owner: '0101', role: 'god', updatedAt: now })), false);
    await expect('pushTokens: read denied', req('GET', 'pushTokens/tok1'), false);
    await expect('pushTokens: delete allowed', req('DELETE', 'pushTokens/tok1'), true);
    var q = { type: 'lesson_unlock', key: 'lesson_l1_bible_2', title: 'عصر الآباء', level: 1, createdAt: now };
    await expect('notifyQueue: unlocked key allowed', req('POST', 'notifyQueue', fields(q)), true);
    await expect('notifyQueue: locked key denied', req('POST', 'notifyQueue', fields(Object.assign({}, q, { key: 'lesson_l1_bible_3' }))), false);
    await expect('notifyQueue: bad level denied', req('POST', 'notifyQueue', fields(Object.assign({}, q, { level: 7 }))), false);
    await expect('notifyQueue: long title denied', req('POST', 'notifyQueue', fields(Object.assign({}, q, { title: 'x'.repeat(81) }))), false);
    await expect('notifyQueue: card key denied', req('POST', 'notifyQueue', fields(Object.assign({}, q, { key: 'card_compete' }))), false);
    var inv = { kind: 'duel', from: '0101', fromName: 'ريتا', to: '0102', code: 'ABC123', createdAt: now };
    await expect('invites: valid create', req('POST', 'invites', fields(inv)), true);
    await expect('invites: self invite denied', req('POST', 'invites', fields(Object.assign({}, inv, { to: '0101' }))), false);
    await expect('invites: bad kind denied', req('POST', 'invites', fields(Object.assign({}, inv, { kind: 'spam' }))), false);
    await expect('notifySent: client denied', req('PATCH', 'notifySent/a', fields({ at: now })), false);
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
```

- [ ] **Step 2: Run to verify fail**

Run: `firebase emulators:exec --only firestore --project min-el-batal "node tools/check-rules.js"`
Expected: FAIL lines for the denied cases (rules are still open) and `pushTokens: read denied`.

- [ ] **Step 3: Add the rules** (inside `match /databases/{database}/documents { ... }`, after the last existing match)

```
    // ── Notifications ── no Firebase Auth: rules only bound the shape of what clients may write.
    // Written by Cloud Functions only (Admin SDK bypasses rules).
    match /notifications/{id} {
      allow read: if true;
      allow write: if false;
    }
    match /notifySent/{id} {
      allow read, write: if false;
    }
    match /inviteGuard/{id} {
      allow read, write: if false;
    }
    match /pushTokens/{token} {
      allow read: if false;
      allow delete: if true;
      allow create, update: if request.resource.data.keys().hasOnly(['owner', 'role', 'updatedAt'])
        && request.resource.data.keys().hasAll(['owner', 'role', 'updatedAt'])
        && request.resource.data.owner is string && request.resource.data.owner.size() <= 64
        && request.resource.data.role in ['player', 'admin']
        && request.resource.data.updatedAt is int;
    }
    match /notifyQueue/{id} {
      allow read, update, delete: if false;
      allow create: if request.resource.data.keys().hasOnly(['type', 'key', 'title', 'level', 'createdAt'])
        && request.resource.data.keys().hasAll(['type', 'key', 'title', 'level', 'createdAt'])
        && request.resource.data.type == 'lesson_unlock'
        && request.resource.data.key is string
        && request.resource.data.key.matches('^(lesson|subject|level)_[a-z0-9_]+$')
        && request.resource.data.title is string && request.resource.data.title.size() <= 80
        && request.resource.data.level in [0, 1, 2]
        && get(/databases/$(database)/documents/gameContent/locks).data[request.resource.data.key].locked == false;
    }
    match /invites/{id} {
      allow read, update, delete: if false;
      allow create: if request.resource.data.keys().hasOnly(['kind', 'from', 'fromName', 'to', 'code', 'createdAt'])
        && request.resource.data.keys().hasAll(['kind', 'from', 'fromName', 'to', 'code', 'createdAt'])
        && request.resource.data.kind in ['duel', 'room']
        && request.resource.data.from is string && request.resource.data.to is string
        && request.resource.data.from != request.resource.data.to
        && request.resource.data.fromName is string && request.resource.data.fromName.size() <= 60
        && request.resource.data.code is string && request.resource.data.code.size() <= 12;
    }
```

`firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "audience", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 4: Run rules test**

Run: `firebase emulators:exec --only firestore --project min-el-batal "node tools/check-rules.js"`
Expected: `16 passed, 0 failed`. (`allow write` on the existing `.../{document=**}` matches must not exist; if a catch-all `match /{document=**}` is found, it would OR-allow writes — none exists today.)

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.indexes.json firebase.json tools/check-rules.js
git commit -m "Notifications: rules for notifications, pushTokens, notifyQueue, invites; bell index"
```

### Task 4: Game tokens, single display, tap routing

**Files:**
- Modify: `game.js` — `initPushNotifications` (~18112), `logout` (~5895), `requestNotificationsAfterLogin` (~18226), auto-login success (~17999), window `load` handler (~19268), `joinDuel` (~17523)
- Modify: `sw.js` — `onBackgroundMessage` + `notificationclick` (lines 90-125), `CACHE_NAME` → `v45`
- Create: `tools/check-notifications.js`

**Interfaces:**
- Consumes: `pushTokens` contract (Task 3); link shapes (Global Constraints).
- Produces (game.js globals): `registerPushToken(token)`, `unregisterPushToken() → Promise`, `openNotifLink(link: object|string)`, `checkPendingNotif()`, `joinDuelByCode(code)`, `cairoDateKey() → 'YYYY-MM-DD'`.

- [ ] **Step 1: Write the failing check** (`tools/check-notifications.js`, same vm/grab approach as `tools/check-cloud-save.js`)

```js
#!/usr/bin/env node
/* Dev-only checks for the game's notification plumbing (not shipped). Run: node tools/check-notifications.js */
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
var FNS = ['registerPushToken', 'unregisterPushToken', 'openNotifLink', 'checkPendingNotif', 'cairoDateKey'];
var code = 'var _myPushToken = null;\n' + FNS.map(grab).join('\n');

function makeCtx(gs) {
    var calls = [], docs = {}, session = {};
    function ref(col, id) { return {
        set: function(d) { docs[col + '/' + id] = d; calls.push(['set', col, id]); return Promise.resolve(); },
        update: function(d) { calls.push(['update', col, id, d]); return Promise.resolve(); },
        delete: function() { delete docs[col + '/' + id]; calls.push(['delete', col, id]); return Promise.resolve(); }
    }; }
    var ctx = {
        GameState: gs, console: { log: function() {}, warn: function() {} }, calls: calls, docs: docs, Intl: Intl, Date: Date, JSON: JSON,
        firebaseDb: { collection: function(c) { return { doc: function(id) { return ref(c, id); } }; } },
        firebase: { firestore: { FieldValue: { delete: function() { return 'DEL'; } } } },
        sessionStorage: { getItem: function(k) { return session[k] || null; }, setItem: function(k, v) { session[k] = v; }, removeItem: function(k) { delete session[k]; } },
        window: { open: function(u) { calls.push(['open', u]); } },
        setTimeout: function(fn) { fn(); }
    };
    ['showScreen', 'openQuestionsScreen', 'openQuestionThread', 'l1OpenSubject', 'openLevel2Subject', 'openSelfieChallenge',
     'joinDuelByCode', 'autoJoinRoom', 'openSocialPost'].forEach(function(f) {
        ctx[f] = function(a) { calls.push([f, a]); };
    });
    ctx.LEVEL1_SUBJECTS = { l1_bible: {}, l2_bible: {} };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    return ctx;
}
var tests = [];
function test(n, f) { tests.push([n, f]); }
function last(ctx, name) { return ctx.calls.filter(function(c) { return c[0] === name; }).pop(); }

test('register writes owner and drops legacy field; unregister deletes', function() {
    var ctx = makeCtx({ playerPhone: '0101' });
    ctx.registerPushToken('tokA');
    assert.deepStrictEqual(Object.keys(ctx.docs), ['pushTokens/tokA']);
    assert.strictEqual(ctx.docs['pushTokens/tokA'].owner, '0101');
    assert.strictEqual(ctx.docs['pushTokens/tokA'].role, 'player');
    return Promise.resolve().then(function() {
        var u = last(ctx, 'update');
        assert.strictEqual(u[3].fcmToken, 'DEL');
        return ctx.unregisterPushToken();
    }).then(function() { assert.deepStrictEqual(Object.keys(ctx.docs), []); });
});

test('shared phone: next owner takes the same token doc', function() {
    var ctx = makeCtx({ playerPhone: '0101' });
    ctx.registerPushToken('tokA');
    ctx.GameState.playerPhone = '0102';
    ctx.registerPushToken('tokA');
    assert.strictEqual(ctx.docs['pushTokens/tokA'].owner, '0102');
});

test('routing per screen', function() {
    var ctx = makeCtx({ playerPhone: '0101' });
    ctx.openNotifLink({ screen: 'question', id: 'q1' });
    assert.ok(last(ctx, 'openQuestionsScreen')); assert.strictEqual(last(ctx, 'openQuestionThread')[1], 'q1');
    ctx.openNotifLink({ screen: 'subject', id: 'l1_bible' }); assert.strictEqual(last(ctx, 'l1OpenSubject')[1], 'l1_bible');
    ctx.openNotifLink({ screen: 'subject', id: 'faith' }); assert.strictEqual(last(ctx, 'openLevel2Subject')[1], 'faith');
    ctx.openNotifLink({ screen: 'duel', code: 'AB12CD' }); assert.strictEqual(last(ctx, 'joinDuelByCode')[1], 'AB12CD');
    ctx.openNotifLink({ screen: 'room', code: 'ZZ99ZZ' }); assert.strictEqual(last(ctx, 'autoJoinRoom')[1], 'ZZ99ZZ');
    ctx.openNotifLink({ screen: 'bible' }); assert.strictEqual(last(ctx, 'showScreen')[1], 'bible-reading-screen');
    ctx.openNotifLink({ screen: 'post', id: 'p1' }); assert.strictEqual(last(ctx, 'openSocialPost')[1], 'p1');
    ctx.openNotifLink({ screen: 'tournament', id: 't 1' }); assert.strictEqual(last(ctx, 'open')[1], 'tournament-live.html?id=t%201');
    ctx.openNotifLink('{"screen":"selfie"}'); assert.ok(last(ctx, 'openSelfieChallenge'));
    ctx.openNotifLink('garbage'); assert.strictEqual(last(ctx, 'showScreen')[1], 'home-hub-screen');
});

test('logged out: link waits for login and opens once', function() {
    var ctx = makeCtx({ playerPhone: '' });
    ctx.openNotifLink({ screen: 'bible' });
    assert.strictEqual(last(ctx, 'showScreen'), undefined);
    ctx.GameState.playerPhone = '0101';
    ctx.checkPendingNotif();
    assert.strictEqual(last(ctx, 'showScreen')[1], 'bible-reading-screen');
    var n = ctx.calls.length;
    ctx.checkPendingNotif();
    assert.strictEqual(ctx.calls.length, n, 'consumed');
});

test('cairoDateKey is a Cairo YYYY-MM-DD', function() {
    var ctx = makeCtx({});
    assert.match(ctx.cairoDateKey(), /^\d{4}-\d{2}-\d{2}$/);
});

(async function() {
    var failed = 0;
    for (var t of tests) { try { await t[1](); } catch (e) { failed++; console.log('FAIL ' + t[0] + '\n     ' + e.message); } }
    console.log((tests.length - failed) + '/' + tests.length + ' passed');
    process.exit(failed ? 1 : 0);
})();
```

- [ ] **Step 2: Run to verify fail**

Run: `node tools/check-notifications.js`
Expected: FAIL — `missing function registerPushToken`

- [ ] **Step 3: Implement in `game.js`**

3a. Add right after `function initPushNotifications() {...}` ends (before `function showCompeteInvite`):

```js
// ---- Push tokens: one doc per device in pushTokens (owner = phone); removed on logout ----
var _myPushToken = null;
function registerPushToken(token) {
    if (!firebaseDb || !GameState.playerPhone || !token) return;
    _myPushToken = token;
    firebaseDb.collection('pushTokens').doc(token).set({ owner: GameState.playerPhone, role: 'player', updatedAt: Date.now() })
        .catch(function(e) { console.warn('[FCM] token save failed', e); });
    // the old single-token field would keep pushing to this device after logout
    firebaseDb.collection('players').doc(GameState.playerPhone).update({
        fcmToken: firebase.firestore.FieldValue.delete(), lastTokenUpdate: new Date().toISOString()
    }).catch(function() {});
}
function unregisterPushToken() {
    if (!firebaseDb || !_myPushToken) return Promise.resolve();
    var t = _myPushToken; _myPushToken = null;
    return firebaseDb.collection('pushTokens').doc(t).delete().catch(function() {});
}

// Cairo calendar date (server reminders compare against the same calendar)
function cairoDateKey() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// ---- Notification taps: link = {screen, id?, code?} ----
function openNotifLink(link) {
    if (typeof link === 'string') { try { link = JSON.parse(link); } catch (e) { link = null; } }
    if (link && !GameState.playerPhone) {
        try { sessionStorage.setItem('minElBatal_pendingNotif', JSON.stringify(link)); } catch (e) {}
        return;
    }
    var s = link && link.screen;
    if (s === 'question') { openQuestionsScreen(); if (link.id) setTimeout(function() { openQuestionThread(link.id); }, 400); }
    else if (s === 'subject') { if (typeof LEVEL1_SUBJECTS !== 'undefined' && LEVEL1_SUBJECTS[link.id]) l1OpenSubject(link.id); else openLevel2Subject(link.id); }
    else if (s === 'selfie') openSelfieChallenge();
    else if (s === 'duel') joinDuelByCode(link.code);
    else if (s === 'room') autoJoinRoom(link.code);
    else if (s === 'bible') showScreen('bible-reading-screen');
    else if (s === 'post') openSocialPost(link.id);
    else if (s === 'rewards') showScreen('rewards-shop-screen');
    else if (s === 'tournament') window.open('tournament-live.html?id=' + encodeURIComponent(link.id || ''), '_blank');
    else showScreen('home-hub-screen');
}
function checkPendingNotif() {
    var raw = null;
    try { raw = sessionStorage.getItem('minElBatal_pendingNotif'); sessionStorage.removeItem('minElBatal_pendingNotif'); } catch (e) {}
    if (raw) setTimeout(function() { openNotifLink(raw); }, 800);
}
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'notif-open') openNotifLink(e.data.link);
    });
}
```

Note: `openNotifLink(raw)` with a string re-parses; `checkPendingNotif` runs after `GameState.playerPhone` is set, so it routes instead of re-storing.

3b. In `initPushNotifications`, replace the whole `.then(function(token) {...})` body that reads the player doc and writes `fcmToken/notifPrefs/lastActiveDate` with:

```js
    }).then(function(token) {
        if (!token) return;
        fcmToken = token;
        registerPushToken(token);
    }).catch(function(err) {
```

(This also fixes the bug where every login rebuilt `notifPrefs` without `social`.)

3c. Replace the body of `messaging.onMessage(function(payload) {...})` with:

```js
    messaging.onMessage(function(payload) {
        var d = payload.data || {};
        var title = d.title || (payload.notification && payload.notification.title) || 'مين البطل؟';
        var body = d.body || (payload.notification && payload.notification.body) || '';
        showToast(title + (body ? ' — ' + body : ''), 'info');
        if (typeof refreshNotifBadgeSoon === 'function') refreshNotifBadgeSoon();
    });
```

Delete `function showCompeteInvite(data) {...}` (nothing else calls it — verify with `grep -n showCompeteInvite game.js` → only the definition remains).

3d. `requestNotificationsAfterLogin`: honour the 7-day dismissal and wire the inbox + pending link. Replace the function with:

```js
function requestNotificationsAfterLogin() {
    checkPendingNotif();
    if (typeof subscribeNotifInbox === 'function') subscribeNotifInbox();
    setTimeout(function() {
        if (!GameState.playerPhone || !('Notification' in window)) return;
        if (Notification.permission === 'granted') { initPushNotifications(); return; }
        if (Notification.permission !== 'default') return;
        var dismissed = 0;
        try { dismissed = +localStorage.getItem('minElBatal_notifDismissed') || 0; } catch (e) {}
        if (Date.now() - dismissed > 7 * 86400000) showNotificationPrompt();
    }, 5000);
}
```

3e. Auto-login success path (inside `loadFromCloud(rememberedPhone).then(... if (data && data.playerName) {`), after `syncLeaderboard();` add:

```js
                requestNotificationsAfterLogin();
```

3f. `logout()`: first line of the function body, before `stopGlobalPresence`:

```js
    unregisterPushToken();
    if (typeof unsubscribeNotifInbox === 'function') unsubscribeNotifInbox();
```

3g. Window `load` handler (`// Auto-join room from shared link`): after the `?room=` block add:

```js
    var notifParam = urlParams.get('n');
    if (notifParam) {
        try { sessionStorage.setItem('minElBatal_pendingNotif', notifParam); } catch (e) {}
        window.history.replaceState({}, '', window.location.pathname);
        if (GameState.playerPhone) checkPendingNotif();
    }
```

3h. Split `joinDuel()` so taps can join by code. Replace the start of `joinDuel` up to the `firebaseDb.collection('duels').doc(code).get()` line with:

```js
function joinDuel() {
    var code = (document.getElementById('duel-code-input').value || '').trim().toUpperCase();
    joinDuelByCode(code);
}

function joinDuelByCode(code) {
    if (!GameState.playerPhone) { showToast('لازم تسجل دخول الأول', 'error'); return; }
    if (!firebaseDb) { showToast('تحتاج إنترنت للمبارزة', 'error'); return; }
    code = String(code || '').trim().toUpperCase();
    if (!code || code.length !== 6) { showToast('أدخل كود صحيح من 6 خانات', 'error'); return; }
    firebaseDb.collection('duels').doc(code).get().then(function(doc) {
```

(rest of the old body unchanged; it already guards `if (overlay) overlay.remove();`).

3i. iPhone in Safari (not installed) has no `Notification`: say so instead of skipping silently. In `renderNotifSettings`, right after the `<h3>` line:

```js
    if (!('Notification' in window)) {
        html += '<p style="background:rgba(255,196,0,.12);border-radius:10px;padding:10px;font-size:12.5px;color:var(--text-primary);margin:0 0 12px;line-height:1.6">' +
            '📲 ثبّت التطبيق على الشاشة الرئيسية عشان توصلك الإشعارات (من زرار المشاركة ← «إضافة إلى الشاشة الرئيسية»)</p>';
    }
```

- [ ] **Step 4: Implement `sw.js`**

Replace `messaging.onBackgroundMessage(...)` and the `notificationclick` listener with:

```js
// --- Background Push Handler: messages are data-only, so this is the only display ---
messaging.onBackgroundMessage(function(payload) {
    if (payload.notification) return;   // FCM already displayed it
    var d = payload.data || {};
    return self.registration.showNotification(d.title || 'مين البطل؟', {
        body: d.body || 'عندك إشعار جديد!',
        icon: '/images/icon/app-192.png',
        badge: '/images/Logo-192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: d.tag || undefined,
        vibrate: [200, 100, 200],
        data: { link: d.link || '' }
    });
});

// --- Notification Click: open the place the notification is about ---
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var raw = (event.notification.data && event.notification.data.link) || '';
    var link = null;
    try { link = raw ? JSON.parse(raw) : null; } catch (e) {}
    if (link && link.screen === 'tournament') {
        event.waitUntil(clients.openWindow('/tournament-live.html?id=' + encodeURIComponent(link.id || '')));
        return;
    }
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
            for (var i = 0; i < list.length; i++) {
                var c = list[i], u = new URL(c.url);
                if (u.origin === self.location.origin && u.pathname.indexOf('admin') < 0 && u.pathname.indexOf('tournament') < 0 && 'focus' in c) {
                    if (raw) c.postMessage({ type: 'notif-open', link: raw });
                    return c.focus();
                }
            }
            return clients.openWindow(raw ? '/?n=' + encodeURIComponent(raw) : '/');
        })
    );
});
```

Set `var CACHE_NAME = 'min-el-batal-v45';`.

- [ ] **Step 5: Run checks**

Run: `node --check game.js && node --check sw.js && node tools/check-notifications.js && node tools/check-cloud-save.js && node tools/check-season-reset.js`
Expected: `5/5 passed`, `10/10 passed`, `6 passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add game.js sw.js tools/check-notifications.js
git commit -m "Notifications: per-device push tokens removed on logout, single display, taps open their target"
```

### Task 5: Bell inbox in the game

**Files:**
- Modify: `index.html` — `.gx-quick` block (~line 210): add the bell button after «العجلة»
- Modify: `game.js` — add inbox functions after `checkPendingNotif`; add `notifSeenAt: 0` to `GameState` (~line 22 object)
- Modify: `game-ui.css` — inbox list styles
- Modify: `tools/check-notifications.js` — badge test

**Interfaces:**
- Consumes: `notifications` docs `{audience, type, title, body, link, levelBy, createdAt}`; `openNotifLink`.
- Produces: `subscribeNotifInbox()`, `unsubscribeNotifInbox()`, `openNotifInbox()`, `refreshNotifBadgeSoon()`, `notifUnreadCount(items, seenAt) → number`, `notifVisibleForMe(n) → boolean`.

- [ ] **Step 1: Add failing tests** to `tools/check-notifications.js` (extend `FNS` with `'notifMs', 'notifUnreadCount', 'notifVisibleForMe', 'notifAudiences'` and stub `playerLevelOf`/`competeMyLevel`):

```js
// in makeCtx: ctx.playerLevelOf = function(g) { return g.playerLevel || 1; };
//             ctx.competeMyLevel = function() { return ctx.GameState.teamLevel || ctx.GameState.playerLevel || 1; };
test('unread = newer than notifSeenAt', function() {
    var ctx = makeCtx({ playerPhone: '0101' });
    var ts = function(ms) { return { toMillis: function() { return ms; } }; };
    assert.strictEqual(ctx.notifUnreadCount([{ createdAt: ts(5) }, { createdAt: ts(10) }, { createdAt: null }], 6), 1);
});
test('level items follow levelBy', function() {
    var ctx = makeCtx({ playerPhone: '0101', playerLevel: 1, teamLevel: 2 });
    assert.strictEqual(ctx.notifVisibleForMe({ audience: 'level_1', levelBy: 'content' }), true);
    assert.strictEqual(ctx.notifVisibleForMe({ audience: 'level_2', levelBy: 'content' }), false);
    assert.strictEqual(ctx.notifVisibleForMe({ audience: 'level_2', levelBy: 'compete' }), true);
    assert.strictEqual(ctx.notifVisibleForMe({ audience: '0101' }), true);
    assert.deepStrictEqual(Array.from(ctx.notifAudiences()).sort(), ['0101', 'all', 'level_1', 'level_2']);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node tools/check-notifications.js`
Expected: FAIL — `missing function notifUnreadCount`

- [ ] **Step 3: Implement**

`index.html`, inside `<div class="gx-quick">` right after the «العجلة» button:

```html
                <div class="gx-qbtn gx-qbtn--gold" onclick="openNotifInbox()"><span class="gx-wig"><img class="gx-i" src="images/ui/ic-bell.webp" alt=""></span><span class="gx-badge" id="gx-notif-badge" style="display:none">0</span><small>الإشعارات</small></div>
```

`game.js` `GameState` object: add `notifSeenAt: 0,` next to `lessonSummaries`. (Not added to `_cloudSaveData`; it is written directly, so loads assign it from the cloud.)

`game.js`, after `checkPendingNotif`:

```js
// ---- Bell inbox: notifications for me, my level(s) and everyone ----
var _notifItems = [], _notifUnsub = null;
function notifAudiences() {
    var a = [GameState.playerPhone, 'all'];
    ['level_' + playerLevelOf(GameState), 'level_' + competeMyLevel()].forEach(function(x) { if (a.indexOf(x) < 0) a.push(x); });
    return a;
}
function notifVisibleForMe(n) {
    if (!/^level_/.test(n.audience || '')) return true;
    var lv = n.levelBy === 'compete' ? competeMyLevel() : playerLevelOf(GameState);
    return n.audience === 'level_' + lv;
}
function notifMs(n) { return n && n.createdAt && n.createdAt.toMillis ? n.createdAt.toMillis() : 0; }
function notifUnreadCount(items, seenAt) {
    return items.filter(function(n) { return notifMs(n) > (seenAt || 0); }).length;
}
function subscribeNotifInbox() {
    if (!firebaseDb || !GameState.playerPhone) return;
    unsubscribeNotifInbox();
    _notifUnsub = firebaseDb.collection('notifications').where('audience', 'in', notifAudiences())
        .orderBy('createdAt', 'desc').limit(30)
        .onSnapshot(function(snap) {
            _notifItems = [];
            snap.forEach(function(d) { var n = d.data(); n.id = d.id; if (notifVisibleForMe(n)) _notifItems.push(n); });
            updateNotifBadge();
        }, function(err) { console.warn('[inbox]', err); });
}
function unsubscribeNotifInbox() {
    if (_notifUnsub) { try { _notifUnsub(); } catch (e) {} _notifUnsub = null; }
    _notifItems = [];
    updateNotifBadge();
}
function refreshNotifBadgeSoon() { updateNotifBadge(); }   // the onSnapshot listener delivers the item itself
function updateNotifBadge() {
    var el = document.getElementById('gx-notif-badge');
    if (!el) return;
    var c = notifUnreadCount(_notifItems, GameState.notifSeenAt);
    el.textContent = c > 9 ? '9+' : String(c);
    el.style.display = c ? '' : 'none';
}
function notifAgo(ms) {
    var m = Math.floor((Date.now() - ms) / 60000);
    if (m < 1) return 'دلوقتي';
    if (m < 60) return 'من ' + m + ' دقيقة';
    var h = Math.floor(m / 60);
    if (h < 24) return 'من ' + h + ' ساعة';
    return 'من ' + Math.floor(h / 24) + ' يوم';
}
function openNotifInbox() {
    var seen = GameState.notifSeenAt || 0;
    var html = '<div class="modal-card notif-inbox" style="max-width:380px;direction:rtl">' +
        '<h3 class="notif-inbox-h">🔔 الإشعارات</h3><div class="notif-inbox-list">';
    if (!_notifItems.length) html += '<p class="notif-empty">مفيش إشعارات لسه… أول ما يحصل جديد هتلاقيه هنا ✨</p>';
    _notifItems.forEach(function(n, i) {
        html += '<div class="notif-item' + (notifMs(n) > seen ? ' notif-item--new' : '') + '" onclick="openNotifItem(' + i + ')">' +
            '<b>' + escapeHtml(n.title || '') + '</b><span>' + escapeHtml(n.body || '') + '</span>' +
            '<small>' + notifAgo(notifMs(n)) + '</small></div>';
    });
    html += '</div><button class="btn btn-secondary" style="width:100%;margin-top:12px" onclick="closeNotifInbox()"><span>إغلاق</span></button></div>';
    var ov = document.createElement('div');
    ov.className = 'modal-overlay'; ov.id = 'notif-inbox-overlay'; ov.innerHTML = html;
    document.body.appendChild(ov);
    setTimeout(function() { ov.classList.add('active'); }, 10);
    GameState.notifSeenAt = Date.now();
    updateNotifBadge();
    if (firebaseDb && GameState.playerPhone) {
        firebaseDb.collection('players').doc(GameState.playerPhone).update({ notifSeenAt: GameState.notifSeenAt }).catch(function() {});
    }
}
function closeNotifInbox() {
    var ov = document.getElementById('notif-inbox-overlay');
    if (ov) { ov.classList.remove('active'); setTimeout(function() { ov.remove(); }, 300); }
}
function openNotifItem(i) {
    var n = _notifItems[i];
    closeNotifInbox();
    if (n) openNotifLink(n.link);
}
```

`escapeHtml` already exists at `game.js:18536`.

`game-ui.css` (append):

```css
/* ---- Bell inbox ---- */
.notif-inbox-h { text-align: center; margin: 0 0 12px; color: var(--text-primary); }
.notif-inbox-list { max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.notif-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.05); cursor: pointer; text-align: right; }
.notif-item b { font-size: 14px; color: var(--text-primary); }
.notif-item span { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
.notif-item small { font-size: 10.5px; color: var(--text-muted, #999); }
.notif-item--new { background: rgba(255, 196, 0, .12); border-inline-start: 3px solid var(--gold, #f5b700); }
.notif-empty { text-align: center; color: var(--text-secondary); font-size: 13px; padding: 18px 0; }
```

- [ ] **Step 4: Run checks**

Run: `node --check game.js && node tools/check-notifications.js`
Expected: `7/7 passed`.

- [ ] **Step 5: Commit**

```bash
git add index.html game.js game-ui.css tools/check-notifications.js
git commit -m "Notifications: bell inbox on the home hub with unread badge"
```

### Task 6: Move existing functions onto `notify`

**Files:**
- Modify: `functions/index.js` — top imports; `onAnnouncementCreated`, `onQuestionMessageCreated`, `onPostCommentCreated`, `onPostCreated`, `weeklyReminder`; delete `onNewLesson`, `updateNotifPrefs`, `safeSend`, `stripHtml`, `daysSinceStr`, `playerMatchesSegments`, the commented `onCompetitionCreated`, `NEW_LESSON_MESSAGES`, `COMPETITION_MSG`.

**Interfaces:**
- Consumes: `makeNotifier`, `L.*`.
- Produces: `const notifier` and `const L` at the top of `index.js` for later tasks.

- [ ] **Step 1: Write the failing check** — a load test that the module exports exactly the expected triggers (catches syntax errors and leftover references):

```js
// functions/test/index-exports.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
test('index.js loads and exports the expected functions', () => {
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'min-el-batal';
    const fns = require('../index.js');
    const names = Object.keys(fns).sort();
    assert.ok(!names.includes('onNewLesson'));
    assert.ok(!names.includes('updateNotifPrefs'));
    ['onAnnouncementCreated', 'onQuestionMessageCreated', 'onPostCommentCreated', 'onPostCreated',
     'onPostDeleted', 'weeklyReminder'].forEach((n) => assert.ok(names.includes(n), n));
});
```

Later tasks append names to this list.

- [ ] **Step 2: Run to verify fail**

Run: `cd functions && node --test test/`
Expected: FAIL on `!names.includes('onNewLesson')`.

- [ ] **Step 3: Rewrite the affected parts of `functions/index.js`**

Top of file, after `const messaging = admin.messaging();`:

```js
const L = require('./notify-logic');
const { makeNotifier } = require('./notify');
const notifier = makeNotifier({ db, messaging, FieldValue: admin.firestore.FieldValue });
```

`onAnnouncementCreated` — keep the in-app-only branch; replace the fan-out block (from `var title = ...` to the stats update) with:

```js
        var title = ann.title || 'مين البطل؟';
        var body = L.stripHtml(ann.body || '');
        var segments = ann.segments || null;
        var r = await notifier.notify('all', { type: 'announcement', title: title, body: body, link: { screen: 'home' } },
            { id: context.eventId, store: !segments, segments: segments });
        await snap.ref.update({
            pushStatus: 'sent', pushSentCount: r.sent, pushAttempted: r.attempted,
            pushProcessedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(function() {});
        return null;
```

`onQuestionMessageCreated` — admin replies go to the asker; player follow-ups go to admins (the first message of a thread is covered by `onQuestionCreated` in Task 8):

```js
exports.onQuestionMessageCreated = functions
    .region('europe-west1')
    .firestore.document('questions/{qid}/messages/{mid}')
    .onCreate(async (snap, context) => {
        var msg = snap.data() || {};
        var qid = context.params.qid;
        var threadSnap = await db.collection('questions').doc(qid).get();
        if (!threadSnap.exists) return null;
        var thread = threadSnap.data() || {};
        var text = L.stripHtml(msg.contentHtml || '');
        if (msg.authorType === 'admin') {
            if (!thread.userId) return null;
            var m = L.message('question_answer', { text: text });
            await notifier.notify(thread.userId, { type: 'question_answer', title: m.title, body: m.body,
                link: { screen: 'question', id: qid } }, { id: context.eventId });
            return null;
        }
        // player follow-up: skip the thread's first message (onQuestionCreated already told the admins)
        var firstTwo = await db.collection('questions').doc(qid).collection('messages').limit(2).get();
        if (firstTwo.size < 2) return null;
        var a = L.message('admin_reply', { name: thread.userName || msg.authorName, text: text });
        await notifier.notify('admins', { type: 'admin_reply', title: a.title, body: a.body,
            link: { page: 'questions', id: qid } }, { id: context.eventId });
        return null;
    });
```

`onPostCommentCreated` — replace the token lookup + `safeSend` with:

```js
            var preview = (comment.text || '').substring(0, 80);
            await notifier.notify(post.authorId, { type: 'post_comment', title: 'تعليق جديد على منشورك 💬',
                body: (comment.authorName || 'حد') + ': ' + preview, link: { screen: 'post', id: postId } },
                { id: context.eventId });
```

(remove the `authorDoc` / `fcmToken` / `notifPrefs.social` lines; `notify` applies prefs via `categoryOf('post_comment') = 'social'`).

`onPostCreated` — replace the players loop with:

```js
            var preview = (post.text || '').substring(0, 100);
            await notifier.notify('all', { type: 'post', title: 'منشور جديد من الخدّام 📢',
                body: preview || 'ادخل شوف المنشور الجديد', link: { screen: 'post', id: context.params.postId } },
                { id: context.eventId });
```

`weeklyReminder` — keep the message logic; replace token handling. Change the schedule to `'0 19 * * 4'` (an hour before the daily reminders) and the loop to:

```js
        var today = L.cairoDate();
        var tokens = await notifier.playerTokenMap();
        var playersSnap = await db.collection('players').select('exerciseLog', 'notifPrefs', 'status', 'fcmToken', 'lastRemindDate').get();
        var sent = 0;
        for (const doc of playersSnap.docs) {
            var player = doc.data();
            var list = (tokens[doc.id] || []).concat(player.fcmToken ? [player.fcmToken] : []);
            if (!list.length || !L.prefAllows(player.notifPrefs, 'weekly_reminder')) continue;
            if (player.status === 'blocked' || player.status === 'suspended') continue;
            // ... existing weeklyDone / msg computation unchanged ...
            if (weeklyDone < totalWeekly) {
                var r = await notifier.sendToTokens(list, { type: 'weekly_reminder', title: msg.title, body: msg.body, link: { screen: 'home' } });
                if (r.sent) { sent++; await doc.ref.update({ lastRemindDate: today }); }
            }
        }
        console.log('[Notif] Weekly reminder: sent', sent, ', total', playersSnap.size);
```

`dailyEveningReminder` and `streakRecovery` stay untouched until Task 14 (they still use `player.fcmToken`, which keeps working for players who have not reopened the app; for migrated players they will send nothing until Task 14 replaces them). Keep `safeSend` until Task 14 for that reason; delete only `onNewLesson`, `updateNotifPrefs`, the commented `onCompetitionCreated`, `NEW_LESSON_MESSAGES`, `COMPETITION_MSG`, and the helpers moved into `notify-logic.js` (`stripHtml`, `daysSinceStr`, `playerMatchesSegments`) — update their remaining callers to `L.`.

- [ ] **Step 4: Run tests**

Run: `cd functions && node --test test/`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/test/index-exports.test.js
git commit -m "Notifications: announcements, answers, social and weekly pushes go through notify(); dead functions removed"
```

**Stage 1 deploy order (user):** `firebase deploy --only firestore:rules,firestore:indexes` → wait for the index to finish building (console shows "Enabled") → `firebase deploy --only functions,hosting`. Functions first is not safe: the game must write `pushTokens` before legacy `fcmToken` is cleared — `registerPushToken` does both, and functions read both, so either order works for sending; the index must exist before the bell query runs or the bell logs a "requires an index" warning and stays empty.

---

## Stage 2 — Admins

### Task 7: Admin push registration and tap routing

**Files:**
- Create: `admin-sw.js`
- Modify: `admin.html` — add messaging script tag after line 2190; topbar button (~line 1503); `enterApp` (~2741); `doLogout` (~2765); new functions near `enterApp`.

**Interfaces:**
- Consumes: `pushTokens` contract; admin link `{page, id?}`; globals `me`, `goPage`, `qaOpenThread`, `rptTab`.
- Produces: `enableAdminPush(silent?: boolean)`, `disableAdminPush()`, `openAdminLink(link)`.

- [ ] **Step 1: Create `admin-sw.js`**

```js
// Admin panel service worker: displays data-only pushes and opens the right admin page on tap.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');
firebase.initializeApp({
    apiKey: "AIzaSyDZXv7nmtJ5tqSLmvrxQ1F4WuoHmBxttuY",
    authDomain: "min-el-batal.firebaseapp.com",
    projectId: "min-el-batal",
    storageBucket: "min-el-batal.firebasestorage.app",
    messagingSenderId: "743794480493",
    appId: "1:743794480493:web:74c8ef6a444e29f7a4b664"
});
var messaging = firebase.messaging();
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });

messaging.onBackgroundMessage(function(payload) {
    if (payload.notification) return;
    var d = payload.data || {};
    return self.registration.showNotification(d.title || 'لوحة مين البطل', {
        body: d.body || '', icon: '/images/icon/app-192.png', badge: '/images/Logo-192.png',
        dir: 'rtl', lang: 'ar', tag: d.tag || undefined, data: { link: d.link || '' }
    });
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var raw = (event.notification.data && event.notification.data.link) || '';
    var link = {};
    try { link = raw ? JSON.parse(raw) : {}; } catch (e) {}
    var hash = link.page ? '#' + link.page + (link.id ? '/' + link.id : '') : '';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].url.indexOf('/admin.html') >= 0 && 'focus' in list[i]) {
                list[i].postMessage({ type: 'admin-notif-open', link: link });
                return list[i].focus();
            }
        }
        return clients.openWindow('/admin.html' + hash);
    }));
});
```

Also add `"admin-sw.js"` nowhere to the hosting ignore list (it must be served).

- [ ] **Step 2: admin.html changes**

After the firestore script tag (line ~2190):

```html
<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js"></script>
```

Topbar, inside `<div class="topbar-right">` before the refresh button:

```html
      <button class="btn-ref" id="btn-notif" onclick="enableAdminPush()" style="display:none"><i class="fas fa-bell"></i> <span>فعّل الإشعارات</span></button>
```

New functions (place right after `doLogout`):

```js
// ════════════════════════════════
//  ADMIN PUSH (every admin gets every alert)
// ════════════════════════════════
const ADMIN_VAPID = 'BCK-Gml28B9WpWb_umCHAwmVqNP6FFptoLLLxWpfQwGkNc7zC_ixVRNYQL5t2Ls4lG3v_pa42WCZ9jQeCNtN3tk';
let _adminPushToken = null;
function adminPushSupported(){ return 'serviceWorker' in navigator && 'Notification' in window && firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported(); }
function setNotifBtn(on){
  const b=document.getElementById('btn-notif'); if(!b) return;
  b.style.display = adminPushSupported() ? '' : 'none';
  b.querySelector('span').textContent = on ? 'الإشعارات مفعّلة ✓' : 'فعّل الإشعارات';
  b.disabled = !!on;
}
async function enableAdminPush(silent){
  if(!adminPushSupported() || !me){ if(!silent) toast('المتصفح ده مش بيدعم الإشعارات — على الآيفون ضيف اللوحة للشاشة الرئيسية الأول','err'); return; }
  try{
    const perm = await Notification.requestPermission();
    if(perm!=='granted'){ if(!silent) toast('لازم تسمح بالإشعارات من إعدادات المتصفح','err'); setNotifBtn(false); return; }
    const reg = await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin.html' });
    const token = await firebase.messaging().getToken({ vapidKey: ADMIN_VAPID, serviceWorkerRegistration: reg });
    if(!token) return;
    _adminPushToken = token;
    await db.collection('pushTokens').doc(token).set({ owner: 'admin:'+(me._id||'super'), role: 'admin', updatedAt: Date.now() });
    setNotifBtn(true);
    if(!silent) toast('🔔 هيوصلك إشعار مع كل سؤال أو طلب جديد','ok');
  }catch(e){ console.warn('[admin push]',e); if(!silent) toast('تعذّر تفعيل الإشعارات','err'); }
}
function disableAdminPush(){
  if(!_adminPushToken) return;
  db.collection('pushTokens').doc(_adminPushToken).delete().catch(()=>{});
  _adminPushToken=null;
}
function openAdminLink(link){
  if(!link || !link.page) return;
  goPage(link.page);
  if(link.page==='questions' && link.id) setTimeout(()=>qaOpenThread(link.id), 800);
  if(link.page==='reports' && typeof rptTab==='function') rptTab('reports');
}
function openAdminHash(){
  const h = location.hash.slice(1);
  if(!h) return;
  const parts = h.split('/');
  history.replaceState(null,'',location.pathname);
  openAdminLink({ page: parts[0], id: parts[1] });
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', e=>{ if(e.data && e.data.type==='admin-notif-open') openAdminLink(e.data.link); });
}
```

`enterApp()`: after `loadAll();` add:

```js
  setNotifBtn(false);
  if('Notification' in window && Notification.permission==='granted') enableAdminPush(true);
  setTimeout(openAdminHash, 1200);
```

`doLogout()`: first line `disableAdminPush();`.

Page keys used by links exist: `page-questions`, `page-reports` (`admin.html:1643`, sub-tab via `rptTab`), `page-rewards`, `page-admins`.

- [ ] **Step 3: Verify**

Run: `node --check admin-sw.js && node -e "const h=require('fs').readFileSync('admin.html','utf8');const s=h.split('<script>').slice(1).map(x=>x.split('</script>')[0]);s.forEach((c,i)=>{try{new Function(c)}catch(e){console.log('script',i,e.message);process.exitCode=1}})"`
Expected: no output (all inline scripts parse).

Manual (after deploy, on a phone and a laptop): log in to admin → «فعّل الإشعارات» → allow → `pushTokens` gains a doc with `role: admin`. Log out → that doc is gone.

- [ ] **Step 4: Commit**

```bash
git add admin-sw.js admin.html
git commit -m "Admin panel: push registration per admin device and taps open the right page"
```

### Task 8: Admin triggers

**Files:**
- Modify: `functions/index.js` — add four triggers after `onQuestionMessageCreated`
- Modify: `functions/test/index-exports.test.js` — add names

**Interfaces:**
- Consumes: `notifier.notify('admins', ...)`, `L.message`.
- Produces: exports `onQuestionCreated`, `onPlayerReportCreated`, `onRewardRequestCreated`, `onAdminRequestCreated`.

- [ ] **Step 1: Extend the export test** — add `'onQuestionCreated', 'onPlayerReportCreated', 'onRewardRequestCreated', 'onAdminRequestCreated'` to the list. Run `cd functions && node --test test/` → FAIL on the first missing name.

- [ ] **Step 2: Implement**

```js
// ============================================================
// ADMIN ALERTS — every admin device gets every alert
// ============================================================
function adminAlert(type, vars, link) {
    var m = L.message(type, vars);
    return { type: type, title: m.title, body: m.body, link: link, tag: type + '_' + (link.id || '') };
}
exports.onQuestionCreated = functions.region('europe-west1')
    .firestore.document('questions/{qid}').onCreate(async (snap, context) => {
        var q = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_question', { name: q.userName, title: q.title },
            { page: 'questions', id: context.params.qid }), { id: context.eventId });
    });
exports.onPlayerReportCreated = functions.region('europe-west1')
    .firestore.document('playerReports/{rid}').onCreate(async (snap, context) => {
        var r = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_report',
            { reporter: r.reporterName, reported: r.reportedName, reason: r.reason }, { page: 'reports' }), { id: context.eventId });
    });
exports.onRewardRequestCreated = functions.region('europe-west1')
    .firestore.document('reward_requests/{rid}').onCreate(async (snap, context) => {
        var r = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_reward', { name: r.playerName, reward: r.rewardName },
            { page: 'rewards' }), { id: context.eventId });
    });
exports.onAdminRequestCreated = functions.region('europe-west1')
    .firestore.document('admin_requests/{rid}').onCreate(async (snap, context) => {
        var r = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_request', { name: r.name }, { page: 'admins' }), { id: context.eventId });
    });
```

Add `tag` to the `notify()` stored doc? No — `tag` is only in the FCM data (Task 2's `fcmMessage` reads `msg.tag`). Admin notifications are stored with `audience: 'admins'`; nothing reads them yet, the daily cleanup (Task 14) removes them after 30 days.

- [ ] **Step 3: Run tests** → `cd functions && node --test test/` all pass.

- [ ] **Step 4: Commit**

```bash
git add functions/index.js functions/test/index-exports.test.js
git commit -m "Admin alerts: new question, player follow-up, report, gift request, admin request"
```

### Task 9: Live counters, tab title and sound in the admin panel

**Files:**
- Modify: `admin.html` — `updateBadges` (~3190), `qaUpdateNavBadge` (~6637), `enterApp`, `doLogout`; new functions after Task 7's block.

**Interfaces:**
- Consumes: `rewards`, `adminReqs`, `playerReports`, `QA.threads`, `loadAll`.
- Produces: `startLiveCounters()`, `stopLiveCounters()`, `adminPing()`, `updateTitleCount()`.

- [ ] **Step 1: Implement**

```js
// ════════════════════════════════
//  LIVE COUNTERS (badges + tab title + sound)
// ════════════════════════════════
const _liveCounts = {}; let _liveUnsubs = [], _reloadTimer = null;
const BASE_TITLE = document.title;
function startLiveCounters(){
  stopLiveCounters();
  [['rewards', db.collection('reward_requests').where('fulfilled','==',false)],
   ['adminReqs', db.collection('admin_requests').where('status','==','pending')],
   ['reports', db.collection('playerReports').where('status','==','pending')]].forEach(([k,q])=>{
    _liveUnsubs.push(q.onSnapshot(s=>{
      const prev=_liveCounts[k]; _liveCounts[k]=s.size;
      if(prev!==undefined && s.size>prev){ adminPing(); clearTimeout(_reloadTimer); _reloadTimer=setTimeout(loadAll,3000); }
      updateBadges(); updateTitleCount();
    }, e=>console.warn('[live]',k,e)));
  });
}
function stopLiveCounters(){ _liveUnsubs.forEach(u=>{try{u();}catch(e){}}); _liveUnsubs=[]; Object.keys(_liveCounts).forEach(k=>delete _liveCounts[k]); }
function updateTitleCount(){
  const q=(QA.threads||[]).filter(t=>t.unreadForAdmin).length;
  const n=q+(_liveCounts.rewards||0)+(_liveCounts.adminReqs||0)+(_liveCounts.reports||0);
  document.title = n ? '('+n+') '+BASE_TITLE : BASE_TITLE;
}
function adminPing(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    [880,1175].forEach((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain();
      o.frequency.value=f; g.gain.setValueAtTime(.12,ctx.currentTime+i*.14); g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.14+.18);
      o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime+i*.14); o.stop(ctx.currentTime+i*.14+.2); });
  }catch(e){}
}
```

`updateBadges`: use live counts when present —

```js
  const pend = _liveCounts.rewards ?? rewards.filter(r=>!r.fulfilled).length;
  ...
  const arpend = _liveCounts.adminReqs ?? adminReqs.filter(r=>r.status==='pending').length;
  ...
  const rpend = _liveCounts.reports ?? (playerReports||[]).filter(r=>r.status==='pending'||!r.status).length;
```

`qaUpdateNavBadge`: at its top, ping on rise and refresh the title —

```js
  const unreadNow=QA.threads.filter(t=>t.unreadForAdmin).length;
  if(QA._lastUnread!==undefined && unreadNow>QA._lastUnread) adminPing();
  QA._lastUnread=unreadNow;
  updateTitleCount();
```

`enterApp()`: after `loadAll();` add `startLiveCounters();`. `doLogout()`: add `stopLiveCounters(); document.title=BASE_TITLE;`.

`_liveCounts` must be declared before `updateBadges` first runs (`loadAll` calls it): put the block above `function updateBadges`.

- [ ] **Step 2: Verify** — same inline-script parse command as Task 7 Step 3 → no output. Manual: two browser windows; in the game submit a gift request → the admin tab title shows `(1)`, a two-tone ping plays, the rewards badge increments without pressing «تحديث».

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "Admin panel: live pending counters, unread count in the tab title, ping on new items"
```

---

## Stage 3 — Player events

### Task 10: Opt-in lesson / subject / level unlock push

**Files:**
- Modify: `admin.html` — `openLockModal` (~4863), `saveLock` (~4885), `toggleLockQuick` (~4896); new helpers after `toggleLockQuick`
- Modify: `functions/index.js` — `onNotifyQueueCreated`
- Modify: `functions/test/notify-logic.test.js` — `unlockMessage` tests
- Modify: `functions/notify-logic.js` — `unlockMessage(q, lockSetAt)`

**Interfaces:**
- Produces (logic): `unlockMessage(q: {key, title, level}) → null | {type, title, body, link, audience, guardId(setAt) }` — concretely returns `{type, title, body, link, audience}`; guard id is `key + '_' + setAt` built in the trigger.
- Produces (admin): `lockNotifyInfo(key) → null | {title, level}`, `queueUnlockNotify(key)`.

- [ ] **Step 1: Failing logic test** (append to `notify-logic.test.js`)

```js
test('unlockMessage per key kind', () => {
    const a = L.unlockMessage({ key: 'lesson_l1_bible_2', title: 'عصر الآباء البطاركة', level: 1 });
    assert.strictEqual(a.type, 'lesson_unlock');
    assert.strictEqual(a.audience, 'level_1');
    assert.deepStrictEqual(a.link, { screen: 'subject', id: 'l1_bible' });
    assert.match(a.body, /عصر الآباء/);
    const s = L.unlockMessage({ key: 'subject_faith', title: 'عقيدة ولاهوت', level: 2 });
    assert.strictEqual(s.type, 'subject_unlock'); assert.strictEqual(s.audience, 'level_2');
    const v = L.unlockMessage({ key: 'level_3', title: 'المستوى 3', level: 0 });
    assert.strictEqual(v.type, 'level_unlock'); assert.strictEqual(v.audience, 'all');
    assert.deepStrictEqual(v.link, { screen: 'home' });
    assert.strictEqual(L.unlockMessage({ key: 'card_compete', title: 'x', level: 0 }), null);
});
```

Run `cd functions && node --test test/` → FAIL `L.unlockMessage is not a function`.

- [ ] **Step 2: Implement `unlockMessage`** in `notify-logic.js` (and export it):

```js
function unlockMessage(q) {
    var k = parseLockKey(q && q.key);
    if (!k) return null;
    var type = k.kind === 'lesson' ? 'lesson_unlock' : k.kind === 'subject' ? 'subject_unlock' : 'level_unlock';
    var m = message(type, { title: q.title, n: k.n });
    return {
        type: type, title: m.title, body: m.body,
        link: k.subject ? { screen: 'subject', id: k.subject } : { screen: 'home' },
        audience: q.level === 1 || q.level === 2 ? 'level_' + q.level : 'all'
    };
}
```

- [ ] **Step 3: Trigger** in `functions/index.js`:

```js
// Admin ticked «إشعار اللاعبين» when unlocking: one push per unlock (key + setAt)
exports.onNotifyQueueCreated = functions.region('europe-west1')
    .firestore.document('notifyQueue/{id}').onCreate(async (snap, context) => {
        var q = snap.data() || {};
        var msg = L.unlockMessage(q);
        if (!msg) return null;
        var locks = (await db.collection('gameContent').doc('locks').get()).data() || {};
        var lock = locks[q.key];
        if (!lock || lock.locked) return null;
        try {
            await db.collection('notifySent').doc(q.key + '_' + (lock.setAt || 0)).create({ at: Date.now() });
        } catch (e) { console.log('[unlock] already sent', q.key); return null; }
        await notifier.notify(msg.audience, msg, { id: context.eventId });
        await snap.ref.delete().catch(function() {});
        return null;
    });
```

Add `'onNotifyQueueCreated'` to `index-exports.test.js`.

- [ ] **Step 4: Admin UI**

Helpers after `toggleLockQuick`:

```js
// Which unlocks can notify players, with the title and level the push uses
function lockNotifyInfo(key){
  let m=/^lesson_([a-z0-9_]+)_(\d+)$/.exec(key);
  if(m){ const s=SUBJECTS[m[1]]; if(!s) return null; return { title:(s.lessons||[])[+m[2]]||s.name, level:s.level||2 }; }
  m=/^subject_([a-z0-9_]+)$/.exec(key);
  if(m){ const s=SUBJECTS[m[1]]; if(!s) return null; return { title:s.name, level:s.level||2 }; }
  m=/^level_(\d+)$/.exec(key);
  if(m) return { title:'المستوى '+m[1], level:0 };
  return null;
}
async function queueUnlockNotify(key){
  const info=lockNotifyInfo(key); if(!info) return;
  try{
    await db.collection('notifyQueue').add({ type:'lesson_unlock', key, title:info.title.slice(0,80), level:info.level, createdAt:Date.now() });
    toast('📣 الإشعار في الطريق للاعبين','ok');
  }catch(e){ console.error(e); toast('تعذّر إرسال الإشعار','err'); }
}
function askUnlockNotify(key){
  const info=lockNotifyInfo(key); if(!info) return;
  const ov=document.createElement('div');
  ov.className='modal-ov'; ov.style.display='flex'; ov.id='modal-unlock-notify';
  ov.innerHTML=`<div class="modal" style="max-width:360px"><div class="mbody" style="text-align:center">
    <p style="font-size:15px;font-weight:700;margin:6px 0 4px">«${esc(info.title)}» اتفتح ✅</p>
    <p style="color:var(--muted);font-size:13px;margin:0 0 14px">تبعت إشعار للاعبين؟</p>
    <div style="display:flex;gap:9px;justify-content:center">
      <button class="btn bp" onclick="document.getElementById('modal-unlock-notify').remove();queueUnlockNotify('${key}')">📣 ابعت إشعار</button>
      <button class="btn bg" onclick="document.getElementById('modal-unlock-notify').remove()">لا</button>
    </div></div></div>`;
  document.body.appendChild(ov);
}
```

The wrapper classes match `#modal-lock` (`admin.html:2133`: `.modal-ov` > `.modal` > `.mbody`).

`openLockModal`: after the status `<select>` row, add (only when `lockNotifyInfo(key)`):

```js
      ${lockNotifyInfo(key) ? `<label class="erow" style="gap:8px;align-items:center"><input type="checkbox" id="lk-notify"> 📣 إشعار اللاعبين لما يتفتح</label>` : ''}
```

`saveLock` becomes:

```js
async function saveLock(key, name){
  const locked = document.getElementById('lk-locked').value === 'true';
  const message = document.getElementById('lk-msg').value.trim();
  const notifyBox = document.getElementById('lk-notify');
  const sendNotify = !locked && lockState(key).locked && notifyBox && notifyBox.checked;
  try{
    const upd = {}; upd[key] = { locked, message, setBy: me.phone||'', setAt: Date.now() };
    await db.collection('gameContent').doc('locks').set(upd, { merge: true });
    contentLocks[key] = upd[key];
    closeM('modal-lock'); renderLocks(); toast('✅ تم الحفظ','ok');
    if(sendNotify) queueUnlockNotify(key);
  }catch(e){console.error(e);toast('خطأ','err');}
}
```

`toggleLockQuick`: after the success toast, `if(!next) askUnlockNotify(key);`.

Default is **off**: the modal checkbox is unchecked and the quick toggle asks with «لا» as an equal choice; nothing is sent without a click.

- [ ] **Step 5: Run** `cd functions && node --test test/` (all pass), the admin inline-script parse command (no output), and the rules test from Task 3 (still 16 passed).

- [ ] **Step 6: Commit**

```bash
git add admin.html functions/index.js functions/notify-logic.js functions/test/notify-logic.test.js functions/test/index-exports.test.js
git commit -m "Lesson, subject and level unlocks can notify players (opt-in per unlock, sent once)"
```

### Task 11: Selfie challenge and tournament pushes

**Files:**
- Modify: `functions/index.js` — `selfieChallengeStarts` (hourly), `onTournamentStarted`
- Modify: `functions/notify-logic.js` + test — `selfieDue(c, nowMs) → boolean`, `arabicDay(ms) → string`, `tournamentTeamIds(t) → string[]`

- [ ] **Step 1: Failing tests**

```js
test('selfieDue only inside the window and once', () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const c = { enabled: true, startAt: now - 1000, endAt: now + 86400000 };
    assert.strictEqual(L.selfieDue(c, now), true);
    assert.strictEqual(L.selfieDue({ ...c, notifiedAt: now - 10 }, now), false);
    assert.strictEqual(L.selfieDue({ ...c, enabled: false }, now), false);
    assert.strictEqual(L.selfieDue({ ...c, startAt: now + 1000 }, now), false);
    assert.strictEqual(L.selfieDue({ ...c, endAt: now - 1 }, now), false);
});
test('arabicDay names the Cairo weekday', () => {
    assert.match(L.arabicDay(Date.parse('2026-10-23T10:00:00Z')), /الجمعة/);
});
test('tournamentTeamIds flattens unique team ids', () => {
    assert.deepStrictEqual(L.tournamentTeamIds({ rounds: [{ teams: ['a', 'b'] }, { teams: ['b', 'c'] }, {}] }), ['a', 'b', 'c']);
    assert.deepStrictEqual(L.tournamentTeamIds({}), []);
});
```

Run → FAIL.

- [ ] **Step 2: Implement** (export all three):

```js
function selfieDue(c, nowMs) {
    return !!(c && c.enabled && !c.notifiedAt && (+c.startAt || 0) <= nowMs && nowMs < (+c.endAt || 0));
}
function arabicDay(ms) {
    return new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(new Date(ms));
}
function tournamentTeamIds(t) {
    var out = [];
    ((t && t.rounds) || []).forEach(function(r) { ((r && r.teams) || []).forEach(function(id) { if (id && out.indexOf(id) < 0) out.push(id); }); });
    return out;
}
```

- [ ] **Step 3: Triggers**

```js
// Selfie challenges have no publish step: push once when the window opens (checked hourly)
exports.selfieChallengeStarts = functions.region('europe-west1')
    .pubsub.schedule('5 * * * *').timeZone('Africa/Cairo').onRun(async () => {
        var now = Date.now();
        var snap = await db.collection('selfieChallenges').where('enabled', '==', true).get();
        for (const d of snap.docs) {
            var c = d.data();
            if (!L.selfieDue(c, now)) continue;
            await d.ref.update({ notifiedAt: now });
            var m = L.message('selfie', { title: c.title, stars: c.rewardStars || 0, day: L.arabicDay(+c.endAt) });
            await notifier.notify(c.level ? 'level_' + c.level : 'all',
                { type: 'selfie', title: m.title, body: m.body, link: { screen: 'selfie' } },
                { id: 'selfie_' + d.id, levelBy: 'compete' });
        }
    });

// Tournament goes live → its teams' members
exports.onTournamentStarted = functions.region('europe-west1')
    .firestore.document('tournaments/{tid}').onUpdate(async (change, context) => {
        var before = change.before.data() || {}, after = change.after.data() || {};
        if (before.status === 'active' || after.status !== 'active' || after.notifiedAt) return null;
        await change.after.ref.update({ notifiedAt: Date.now() });
        for (const teamId of L.tournamentTeamIds(after)) {
            var t = await db.collection('teams').doc(teamId).get();
            if (!t.exists) continue;
            var team = t.data() || {};
            var m = L.message('tournament', { title: after.name, team: team.name || teamId });
            for (const phone of (team.members || [])) {
                await notifier.notify(phone, { type: 'tournament', title: m.title, body: m.body,
                    link: { screen: 'tournament', id: context.params.tid } }, { id: context.eventId + '_' + phone });
            }
        }
        return null;
    });
```

`notifiedAt` on the tournament doc is written by the function. The admin editor saves with `update(payload)` (`admin.html:7414` area), which keeps `notifiedAt`, so pause → resume does not resend.

Add `'selfieChallengeStarts', 'onTournamentStarted'` to the export test.

- [ ] **Step 4: Run** `cd functions && node --test test/` → all pass.

- [ ] **Step 5: Commit**

```bash
git add functions/
git commit -m "Pushes for selfie challenges when they open and for tournament teams when the cup starts"
```

---

## Stage 4 — Invites

### Task 12: Invite a teammate to a duel or a room

**Files:**
- Modify: `game.js` — `showDuelWaiting` (~17562), compete lobby render (~15186, next to `shareRoomLink` button); new functions after `joinDuelByCode`
- Modify: `functions/index.js` — `onInviteCreated`
- Modify: `functions/notify-logic.js` + test — `inviteAllowed(lastAtMs, nowMs) → boolean`
- Modify: `sw.js` `CACHE_NAME` → `v46`

- [ ] **Step 1: Failing logic test**

```js
test('invite rate limit 10 minutes per pair', () => {
    const now = 1_000_000_000;
    assert.strictEqual(L.inviteAllowed(0, now), true);
    assert.strictEqual(L.inviteAllowed(now - 9 * 60000, now), false);
    assert.strictEqual(L.inviteAllowed(now - 10 * 60000, now), true);
});
```

Implement and export:

```js
function inviteAllowed(lastAtMs, nowMs) { return !lastAtMs || nowMs - lastAtMs >= 10 * 60000; }
```

- [ ] **Step 2: Trigger**

```js
// Teammate invites: sender and receiver must share a team; one push per pair per 10 minutes
exports.onInviteCreated = functions.region('europe-west1')
    .firestore.document('invites/{id}').onCreate(async (snap, context) => {
        var inv = snap.data() || {};
        var teams = await db.collection('teams').where('members', 'array-contains', inv.from).get();
        var shared = teams.docs.some(function(t) { return ((t.data() || {}).members || []).indexOf(inv.to) >= 0; });
        if (!shared) { console.log('[invite] not teammates', inv.from, inv.to); return null; }
        var guard = db.collection('inviteGuard').doc(inv.from + '_' + inv.to);
        var ok = await db.runTransaction(async function(tx) {
            var g = await tx.get(guard), now = Date.now();
            if (!L.inviteAllowed(g.exists ? g.data().lastAt : 0, now)) return false;
            tx.set(guard, { lastAt: now });
            return true;
        });
        if (!ok) return null;
        var type = inv.kind === 'room' ? 'invite_room' : 'invite_duel';
        var m = L.message(type, { name: inv.fromName });
        await notifier.notify(inv.to, { type: type, title: m.title, body: m.body,
            link: { screen: inv.kind === 'room' ? 'room' : 'duel', code: inv.code } }, { id: context.eventId });
        return null;
    });
```

Add `'onInviteCreated'` to the export test. Run `cd functions && node --test test/` → pass.

- [ ] **Step 3: Game UI** (after `joinDuelByCode`)

```js
// ---- Invite a teammate (duel or compete room) ----
function openTeamInvite(kind, code) {
    if (!firebaseDb || !GameState.playerPhone) return;
    if (!GameState.team) { showToast('انضم لفريق الأول عشان تدعي صحابك 👥', 'info'); return; }
    var docId = GameState.team.replace(/[\/\\\.#\[\]\*]/g, '_');
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        var t = doc.exists ? doc.data() : {};
        var members = t.members || [], names = t.memberNames || [];
        var html = '<div class="modal-card" style="max-width:340px;direction:rtl"><h3 style="text-align:center;margin:0 0 12px">👥 ادعي حد من فريقك</h3>';
        var any = false;
        members.forEach(function(ph, i) {
            if (!ph || ph === GameState.playerPhone) return;
            any = true;
            html += '<button class="btn btn-secondary" style="width:100%;margin-bottom:8px" onclick="sendTeamInvite(\'' + kind + '\',\'' + code + '\',\'' + ph + '\',this)"><span>' + escapeHtml(names[i] || ph) + '</span></button>';
        });
        if (!any) html += '<p style="text-align:center;color:var(--text-secondary)">فريقك لسه مفيهوش حد غيرك</p>';
        html += '<button class="btn btn-primary" style="width:100%;margin-top:6px" onclick="this.closest(\'.modal-overlay\').remove()"><span>تمام</span></button></div>';
        var ov = document.createElement('div');
        ov.className = 'modal-overlay'; ov.innerHTML = html; document.body.appendChild(ov);
        setTimeout(function() { ov.classList.add('active'); }, 10);
    }).catch(function() { showToast('حصل مشكلة، حاول تاني', 'error'); });
}
function sendTeamInvite(kind, code, to, btn) {
    if (btn) btn.disabled = true;
    firebaseDb.collection('invites').add({
        kind: kind, from: GameState.playerPhone, fromName: (GameState.playerName || '').slice(0, 60), to: to, code: code, createdAt: Date.now()
    }).then(function() {
        if (btn) btn.innerHTML = '<span>اتبعتت ✓</span>';
    }).catch(function() {
        if (btn) btn.disabled = false;
        showToast('الدعوة ما اتبعتتش، حاول تاني', 'error');
    });
}
```

`showDuelWaiting`: before the «إلغاء» button add

```js
        '<button class="btn btn-primary" onclick="openTeamInvite(\'duel\',\'' + code + '\')" style="margin-top:12px;width:100%"><span>👥 ادعي حد من فريقك</span></button>' +
```

Compete lobby (line with `lobby-share-btn`): append after it

```js
    html += '<button class="btn btn-secondary lobby-share-btn" onclick="openTeamInvite(\'room\',\'' + room.code + '\')"><span>👥 ادعي حد من فريقك</span></button>';
```

Set `sw.js` `CACHE_NAME = 'min-el-batal-v46'`.

- [ ] **Step 4: Verify**: `node --check game.js && node tools/check-notifications.js && node tools/check-rules.js` (the rules test covers `invites` shape; run it under the emulator as in Task 3). Manual: two phones on the same team; A creates a duel → «ادعي حد من فريقك» → B gets «A بيتحداك! ⚔️» → tap joins the duel. Tapping again within 10 minutes sends nothing.

- [ ] **Step 5: Commit**

```bash
git add game.js sw.js functions/
git commit -m "Invite a teammate to a duel or compete room; push joins them straight in"
```

---

## Stage 5 — Reminders

### Task 13: Game writes `lastBibleDate` and Cairo `lastActiveDate`

**Files:**
- Modify: `game.js` — `GameState` (+`lastBibleDate: ''`), `completeBibleReading` (~16530), `trackLastActiveDate` (~19287), `requestNotificationsAfterLogin` (backfill)
- Modify: `tools/check-notifications.js` — backfill test

**Interfaces:**
- Produces: `markBibleRead()`, `backfillLastBibleDate()`.

- [ ] **Step 1: Failing test** (extend `FNS` with `'backfillLastBibleDate'`)

```js
test('backfill picks the newest reading day once', function() {
    var ctx = makeCtx({ playerPhone: '0101', lastBibleDate: '', bibleReadingLog: { '2026-10-10': {}, '2026-10-15': {}, '2026-09-01': {} } });
    ctx.backfillLastBibleDate();
    assert.strictEqual(ctx.GameState.lastBibleDate, '2026-10-15');
    var u = last(ctx, 'update'); assert.strictEqual(u[3].lastBibleDate, '2026-10-15');
    var n = ctx.calls.length; ctx.backfillLastBibleDate(); assert.strictEqual(ctx.calls.length, n);
});
```

Run → FAIL.

- [ ] **Step 2: Implement**

```js
// lastBibleDate / lastActiveDate drive the server's 2-day reminders (Cairo calendar days).
// Written directly, not via saveToCloud, so an old device can't move them back.
function markBibleRead() {
    GameState.lastBibleDate = cairoDateKey();
    if (firebaseDb && GameState.playerPhone) {
        firebaseDb.collection('players').doc(GameState.playerPhone).update({ lastBibleDate: GameState.lastBibleDate }).catch(function() {});
    }
}
function backfillLastBibleDate() {
    if (GameState.lastBibleDate || !GameState.playerPhone) return;
    var keys = Object.keys(GameState.bibleReadingLog || {}).filter(function(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort();
    if (!keys.length) return;
    GameState.lastBibleDate = keys[keys.length - 1];
    if (firebaseDb) firebaseDb.collection('players').doc(GameState.playerPhone).update({ lastBibleDate: GameState.lastBibleDate }).catch(function() {});
}
```

- `GameState`: add `lastBibleDate: '',`.
- `completeBibleReading`: right after the `GameState.bibleReadingLog[todayKey] = {...};` statement add `markBibleRead();`.
- `trackLastActiveDate`: replace `var todayStr = new Date().toISOString().split('T')[0];` with `var todayStr = cairoDateKey();`.
- `requestNotificationsAfterLogin`: first line `backfillLastBibleDate();`.

- [ ] **Step 3: Run** `node --check game.js && node tools/check-notifications.js && node tools/check-cloud-save.js` → all pass. Bump `sw.js` to `v47`.

- [ ] **Step 4: Commit**

```bash
git add game.js sw.js tools/check-notifications.js
git commit -m "Track last Bible reading day and Cairo last-active day for reminders"
```

### Task 14: Daily reminders and cleanup

**Files:**
- Modify: `functions/index.js` — add `dailyReminders`; delete `dailyEveningReminder`, `streakRecovery`, `safeSend`, `getCairoDateStr`, `INACTIVITY_MESSAGES`, `EXERCISE_MESSAGES`; update `getWeekKey` to use `L.cairoDate`
- Modify: `functions/test/index-exports.test.js`

- [ ] **Step 1: Export test** — assert `dailyReminders` present and `dailyEveningReminder`, `streakRecovery` absent. Run → FAIL.

- [ ] **Step 2: Implement**

```js
// ============================================================
// DAILY REMINDERS (8 PM Cairo): 2+ days away → «وحشتنا»; else 2+ days without Bible → verse.
// Repeats every 2 days while it still applies; at most one per player per day; not stored in the bell.
// Also deletes notifications older than 30 days and invites older than a day.
// ============================================================
exports.dailyReminders = functions.region('europe-west1')
    .pubsub.schedule('0 20 * * *').timeZone('Africa/Cairo').onRun(async () => {
        var today = L.cairoDate();
        var dayNo = Math.floor(Date.now() / 86400000);
        var tokens = await notifier.playerTokenMap();
        var snap = await db.collection('players').select('playerName', 'createdAt', 'lastActiveDate', 'lastBibleDate',
            'lastRemindDate', 'notifPrefs', 'status', 'fcmToken').get();
        var sent = { remind_inactive: 0, remind_bible: 0 };
        for (const d of snap.docs) {
            var p = d.data() || {};
            var kind = L.reminderFor(p, today);
            if (!kind) continue;
            var list = (tokens[d.id] || []).concat(p.fcmToken ? [p.fcmToken] : []);
            if (!list.length) continue;
            var seed = dayNo + d.id.split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0);
            var m = L.message(kind, { name: p.playerName, seed: seed });
            var r = await notifier.sendToTokens(list, { type: kind, title: m.title, body: m.body,
                link: { screen: kind === 'remind_bible' ? 'bible' : 'home' } });
            if (r.sent) { sent[kind]++; await d.ref.update({ lastRemindDate: today }); }
        }
        console.log('[reminders]', today, JSON.stringify(sent), 'players', snap.size);

        var cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 86400000);
        var old = await db.collection('notifications').where('createdAt', '<', cutoff).limit(450).get();
        var inv = await db.collection('invites').where('createdAt', '<', Date.now() - 86400000).limit(450).get();
        if (!old.empty || !inv.empty) {
            var b = db.batch();
            old.forEach(function(x) { b.delete(x.ref); });
            inv.forEach(function(x) { b.delete(x.ref); });
            await b.commit();
        }
    });
```

Note: `sendToTokens` with a legacy `fcmToken` in `list` deletes a dead token's `pushTokens` doc (no-op) but not the legacy field. Acceptable: `registerPushToken` removes the legacy field when the player next opens the app; a dead legacy token just fails each run. If that is noisy in logs, pass targets via an exported `sendTargets` instead — not required.

- [ ] **Step 3: Run** `cd functions && node --test test/` → all pass.

- [ ] **Step 4: Commit**

```bash
git add functions/
git commit -m "Daily 8 PM reminders: 2 days away or without the Bible, every 2 days; 30-day cleanup; old reminder jobs removed"
```

### Task 15: Docs

**Files:**
- Modify: `CLAUDE.md` — add `notifications`, `pushTokens`, `notifyQueue`, `invites`, `notifySent`, `inviteGuard` to the collections table; a "Notifications" bullet under "Recent work" pointing at the spec; `admin-sw.js` in the file map; the `firestore:indexes` deploy line.
- Modify: `docs/superpowers/specs/2026-10-18-notifications-design.md` — "Single display" bullet: messages are data-only and the service workers display them (replaces the `webpush.notification` wording); unlock keys are `lesson_*`, `subject_*`, `level_*` only (`card_*` excluded).

- [ ] **Step 1: Edit both files** as listed.
- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-18-notifications-design.md
git commit -m "Docs: notification system collections, files and deploy steps"
```

---

## Manual acceptance (after the user deploys each stage)
Android Chrome (installed PWA) and iPhone (Home Screen app, iOS 16.4+):
1. Stage 1: admin answers a question → asker gets «الخادم رد على سؤالك ✉️», tap opens that thread; bell shows it; one system notification only (no duplicate). Logout → no more pushes on that phone.
2. Stage 2: player sends a question / follow-up / report / gift request; someone requests admin access → every admin device gets the alert; tap lands on the page; panel badge, tab title and ping update without refresh.
3. Stage 3: unlock a lesson with the box unchecked → nothing; with it ticked → level players get «درس جديد اتفتح! 📖», tap opens the subject map; enable a selfie challenge starting now → push within the hour; start a tournament → its teams' members get the cup push, tap opens the live view.
4. Stage 4: duel / room teammate invite arrives and joins on tap; second invite within 10 minutes is silent.
5. Stage 5: set a test player's `lastActiveDate` to 3 days ago and `lastRemindDate` empty → at 20:00 Cairo gets «وحشتنا»; next day nothing; the day after again.
