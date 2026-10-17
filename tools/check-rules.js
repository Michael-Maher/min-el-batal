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
