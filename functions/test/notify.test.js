// functions/test/notify.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeNotifier } = require('../notify');

function fakeDb(data) {
    const writes = [], deletes = [], updates = [], queries = [];
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
                queries.push({ col, filters });
                const docs = Object.entries(data[col] || {}).filter(([, d]) =>
                    filters.every(([f, op, v]) => op === '==' ? d[f] === v : op === 'in' ? v.includes(d[f]) : true))
                    .map(([id, d]) => snap(col, id, d));
                return { docs, size: docs.length, forEach: (fn) => docs.forEach(fn) };
            }
        };
    }
    let auto = 0;
    return {
        writes, deletes, updates, queries,
        collection: (col) => Object.assign(query(col, []), { doc: (id) => ref(col, id || 'auto' + (++auto)) })
    };
}
function fakeMessaging(dead, code = 'messaging/registration-token-not-registered') {
    const sent = [];
    return { sent, sendEach: async (msgs) => {
        sent.push(...msgs);
        return { responses: msgs.map((m) => dead.includes(m.token)
            ? { success: false, error: { code } }
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

test('invalid-argument (payload error) deletes no token docs and no legacy fields', async () => {
    const db = world(), m = fakeMessaging(['t1', 't1b', 'legacy5'], 'messaging/invalid-argument');
    await makeNotifier({ db, messaging: m, FieldValue }).notify('level_1', MSG);
    assert.deepStrictEqual(db.deletes, []);
    assert.deepStrictEqual(db.updates, []);
});

test('store:false writes nothing; duplicates send once', async () => {
    const db = world(), m = fakeMessaging([]);
    const n = makeNotifier({ db, messaging: m, FieldValue });
    await n.sendToTokens(['a', 'a', 'b', '', null], MSG);
    assert.deepStrictEqual(m.sent.map((x) => x.token), ['a', 'b']);
    await n.notify('0101', MSG, { store: false });
    assert.strictEqual(db.writes.filter((w) => w.col === 'notifications').length, 0);
});

test('single player reads only that player\'s token docs', async () => {
    const db = world(), m = fakeMessaging([]);
    await makeNotifier({ db, messaging: m, FieldValue }).notify('0101', MSG);
    assert.deepStrictEqual(m.sent.map((x) => x.token).sort(), ['t1', 't1b']);
    const tokenQueries = db.queries.filter((q) => q.col === 'pushTokens');
    assert.strictEqual(tokenQueries.length, 1);
    assert.deepStrictEqual(tokenQueries[0].filters, [['owner', '==', '0101']]);
});

test('single player: legacy token kept, but not when it is now another account\'s token doc', async () => {
    const db = world(), m = fakeMessaging([]);
    const n = makeNotifier({ db, messaging: m, FieldValue });
    await n.notify('0105', MSG);
    assert.deepStrictEqual(m.sent.map((x) => x.token), ['legacy5']);
    const db2 = fakeDb({ players: { '0105': { playerLevel: 1, fcmToken: 't2' } }, pushTokens: { t2: { owner: '0102', role: 'player' } } });
    const m2 = fakeMessaging([]);
    await makeNotifier({ db: db2, messaging: m2, FieldValue }).notify('0105', MSG);
    assert.strictEqual(m2.sent.length, 0);
});

test('level audience: a legacy token that is another player\'s token doc is skipped', async () => {
    const db = fakeDb({
        players: { '0102': { playerLevel: 2 }, '0105': { playerLevel: 1, fcmToken: 't2' } },
        pushTokens: { t2: { owner: '0102', role: 'player' } }
    });
    const m = fakeMessaging([]);
    await makeNotifier({ db, messaging: m, FieldValue }).notify('level_1', MSG);
    assert.strictEqual(m.sent.length, 0, 'the level-2 player\'s device gets no level-1 push');
});
