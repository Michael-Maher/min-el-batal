// Notification send service: stores one doc per notification in `notifications` (the in-game bell
// reads it by audience) and sends data-only FCM messages to every device token of that audience.
'use strict';
var L = require('./notify-logic');

var DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
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
