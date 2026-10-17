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
var FNS = ['registerPushToken', 'unregisterPushToken', 'openNotifLink', 'checkPendingNotif', 'cairoDateKey',
    'notifMs', 'notifUnreadCount', 'notifVisibleForMe', 'notifAudiences'];
function grabVar(name) {
    var m = src.match(new RegExp('var ' + name + ' = [^;]+;'));
    if (!m) throw new Error('missing var ' + name);
    return m[0];
}
var code = 'var _myPushToken = null;\n' + grabVar('FCM_VAPID_KEY') + '\n' + FNS.map(grab).join('\n');

function makeCtx(gs, perm, fetched) {
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
        window: { open: function(u) { calls.push(['open', u]); }, Notification: {} },
        setTimeout: function(fn) { fn(); },
        Notification: { permission: perm || 'default' },
        navigator: { serviceWorker: { ready: Promise.resolve({}) } }
    };
    ctx.firebase.messaging = function() { return { getToken: function(o) { calls.push(['getToken', o.vapidKey]); return Promise.resolve(fetched); } }; };
    ['showScreen', 'openQuestionsScreen', 'openQuestionThread', 'l1OpenSubject', 'openLevel2Subject', 'openSelfieChallenge',
     'joinDuelByCode', 'autoJoinRoom', 'openSocialPost'].forEach(function(f) {
        ctx[f] = function(a) { calls.push([f, a]); };
    });
    ctx.playerLevelOf = function(g) { return g.playerLevel || 1; };
    ctx.competeMyLevel = function() { return ctx.GameState.teamLevel || ctx.GameState.playerLevel || 1; };
    ctx.LEVEL1_SUBJECTS = { l1_bible: {}, l2_bible: {} };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    return ctx;
}
var tests = [];
function test(n, f) { tests.push([n, f]); }
function last(ctx, name) { return ctx.calls.filter(function(c) { return c[0] === name; }).pop(); }

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

test('unregister without a known token looks it up when permission is granted', function() {
    var ctx = makeCtx({ playerPhone: '0101' }, 'granted', 'tokZ');
    ctx.docs['pushTokens/tokZ'] = { owner: '0101' };
    return ctx.unregisterPushToken().then(function() {
        assert.deepStrictEqual(Object.keys(ctx.docs), []);
        assert.ok(last(ctx, 'getToken')[1].length > 20);
        var c2 = makeCtx({ playerPhone: '0101' }, 'default', 'tokZ');
        return c2.unregisterPushToken().then(function() { assert.strictEqual(last(c2, 'getToken'), undefined); });
    });
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
