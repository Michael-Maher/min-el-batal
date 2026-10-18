// ============================================================
// مين البطل؟ - Cloud Functions (Smart Notifications)
// ============================================================
// Notification philosophy: encouraging, warm, not annoying
// - Max 1 push per day per user
// - Evening time only (8 PM Cairo)
// - Rotating messages so they don't feel repetitive
// - Prioritized: competition > inactivity > exercises
// ============================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();
const L = require('./notify-logic');
const { makeNotifier } = require('./notify');
const notifier = makeNotifier({ db, messaging, FieldValue: admin.firestore.FieldValue });

// ============================================================
// Message Pools (warm, encouraging Arabic messages)
// ============================================================

var WEEKLY_MESSAGES = [
    { title: 'تداريب الأسبوع 📊', body: 'لسه عندك تداريب أسبوعية، كمّلها قبل ما الأسبوع يخلص!' },
    { title: 'فاضل تداريب أسبوعية! ⏰', body: 'متضيعش نجومك، خلّص تداريبك الأسبوعية' },
    { title: 'القداس والاجتماع! ⛪', body: 'الأسبوع قرّب يخلص، خلّصت تداريبك الأسبوعية؟' },
];

// ============================================================
// Helper: pick random message from pool
// ============================================================
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// Helper: get current week key (same format as game.js)
// ============================================================
function getWeekKey() {
    var d = new Date(L.cairoDate() + 'T00:00:00Z');
    var day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1));
    return d.toISOString().split('T')[0];
}

// ============================================================
// 2b. ADMIN ANNOUNCEMENT → Fan-out push to all users
//     Triggered when admin creates a doc in `announcements`.
//     Respects announcement.sendPush (defaults to true).
//     Respects player.notifPrefs.reminders.
//     Writes delivery stats back onto the announcement doc.
// ============================================================
exports.onAnnouncementCreated = functions
    .region('europe-west1')
    .firestore.document('announcements/{announcementId}')
    .onCreate(async (snap, context) => {
        var ann = snap.data() || {};
        // Skip push if admin explicitly opted out (in-app only)
        if (ann.sendPush === false) {
            console.log('[Notif] Announcement', context.params.announcementId, 'is in-app only');
            await snap.ref.update({
                pushStatus: 'skipped_in_app_only',
                pushSentCount: 0,
                pushAttempted: 0,
                pushProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
            }).catch(function() {});
            return null;
        }

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
    });

// ============================================================
// 2c. ADMIN REPLIED TO A QUESTION → push the author
//     Triggers when a new message is added to questions/{qid}/messages
//     and the authorType is 'admin'. Notifies the player who owns the thread.
// ============================================================
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

// ============================================================
// ADMIN ALERTS — every admin device gets every alert
// ============================================================
function adminAlert(type, vars, link, uniq) {
    var m = L.message(type, vars);
    return { type: type, title: m.title, body: m.body, link: link, tag: type + '_' + uniq };
}
exports.onQuestionCreated = functions.region('europe-west1')
    .firestore.document('questions/{qid}').onCreate(async (snap, context) => {
        var q = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_question', { name: q.userName, title: q.title },
            { page: 'questions', id: context.params.qid }, context.params.qid), { id: context.eventId });
    });
exports.onPlayerReportCreated = functions.region('europe-west1')
    .firestore.document('playerReports/{rid}').onCreate(async (snap, context) => {
        var r = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_report',
            { reporter: r.reporterName, reported: r.reportedName, reason: r.reason }, { page: 'reports' }, context.params.rid), { id: context.eventId });
    });
exports.onRewardRequestCreated = functions.region('europe-west1')
    .firestore.document('reward_requests/{rid}').onCreate(async (snap, context) => {
        var r = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_reward', { name: r.playerName, reward: r.rewardName },
            { page: 'rewards' }, context.params.rid), { id: context.eventId });
    });
exports.onAdminRequestCreated = functions.region('europe-west1')
    .firestore.document('admin_requests/{rid}').onCreate(async (snap, context) => {
        var r = snap.data() || {};
        await notifier.notify('admins', adminAlert('admin_request', { name: r.name }, { page: 'admins' }, context.params.rid), { id: context.eventId });
    });

// ============================================================
// 4. WEEKLY REMINDER (Thursday 8 PM Cairo - before Friday)
//    Reminds about incomplete weekly exercises
// ============================================================
exports.weeklyReminder = functions
    .region('europe-west1')
    .runWith({ timeoutSeconds: 300 })
    .pubsub.schedule('0 19 * * 4')       // Thursday 7 PM (an hour before the daily reminders)
    .timeZone('Africa/Cairo')
    .onRun(async (context) => {
        var weekKey = getWeekKey();
        var today = L.cairoDate();
        var tokens = await notifier.playerTokenMap();
        var playersSnap = await db.collection('players').select('exerciseLog', 'notifPrefs', 'status', 'fcmToken', 'lastRemindDate').get();
        var sent = 0;
        for (const doc of playersSnap.docs) {
            var player = doc.data();
            var list = (tokens[doc.id] || []).concat(player.fcmToken ? [player.fcmToken] : []);
            if (!list.length || !L.prefAllows(player.notifPrefs, 'weekly_reminder')) continue;
            if (player.status === 'blocked' || player.status === 'suspended') continue;

            var exerciseLog = player.exerciseLog || {};
            var weekLog = exerciseLog[weekKey] || {};
            var weeklyDone = 0;
            if (typeof weekLog.weekly === 'string') {
                weeklyDone = weekLog.weekly.split(',').filter(Boolean).length;
            } else if (Array.isArray(weekLog.weekly)) {
                weeklyDone = weekLog.weekly.length;
            }

            var totalWeekly = 5;
            if (weeklyDone < totalWeekly) {
                var msg = pickRandom(WEEKLY_MESSAGES);
                if (weeklyDone === 0) {
                    msg = { title: 'فاكر تداريبك الأسبوعية؟ ⛪', body: 'لسه متعملش أي تدريب أسبوعي، كمّل قبل ما الأسبوع يخلص' };
                } else {
                    msg = { title: 'فاضلك ' + (totalWeekly - weeklyDone) + ' تداريب أسبوعية! 📊', body: 'كمّل تداريبك الأسبوعية وخد نجوم إضافية' };
                }
                var r = await notifier.sendToTokens(list, { type: 'weekly_reminder', title: msg.title, body: msg.body, link: { screen: 'home' } });
                if (r.sent) { sent++; await doc.ref.update({ lastRemindDate: today }); }
            }
        }
        console.log('[Notif] Weekly reminder: sent', sent, ', total', playersSnap.size);
    });

// ============================================================
// DAILY REMINDERS (8 PM Cairo): 2+ days away -> inactive reminder; else 2+ days without Bible -> verse.
// Repeats every 2 days while it still applies; at most one per player per day; not stored in the bell.
// Also deletes notifications older than 30 days and invites older than a day.
// ============================================================
exports.dailyReminders = functions.region('europe-west1')
    .runWith({ timeoutSeconds: 300 })
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
            var list = (tokens[d.id] || []).slice();
            if (p.fcmToken && list.indexOf(p.fcmToken) === -1) list.push(p.fcmToken);
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
        return null;
    });

// ============================================================
// 7. NEW COMMENT ON POST → Notify post author
// ============================================================
exports.onPostCommentCreated = functions
    .region('europe-west1')
    .firestore.document('posts/{postId}/comments/{commentId}')
    .onCreate(async (snap, context) => {
        var comment = snap.data();
        var postId = context.params.postId;

        try {
            var postSnap = await db.collection('posts').doc(postId).get();
            if (!postSnap.exists) return;
            var post = postSnap.data();

            // Don't notify on self-comment
            if (post.authorId === comment.authorId) return;
            // Only notify if the post author is a real player (not 'system' / 'admin' generic)
            if (!post.authorId || post.authorId === 'system' || post.authorId === 'admin') return;

            var preview = (comment.text || '').substring(0, 80);
            await notifier.notify(post.authorId, { type: 'post_comment', title: 'تعليق جديد على منشورك 💬',
                body: (comment.authorName || 'حد') + ': ' + preview, link: { screen: 'post', id: postId } },
                { id: context.eventId });
        } catch (err) {
            console.error('[onPostCommentCreated] error:', err);
        }
    });

// ============================================================
// 8. NEW ADMIN POST → Notify subscribed players (throttled)
// ============================================================
exports.onPostCreated = functions
    .region('europe-west1')
    .firestore.document('posts/{postId}')
    .onCreate(async (snap, context) => {
        var post = snap.data();
        // Only notify on approved admin posts (skip system/celebrations to avoid noise,
        // and skip pending player posts which need approval first)
        if (post.authorRole !== 'admin') return;
        if (post.status && post.status !== 'approved') return;

        try {
            var preview = (post.text || '').substring(0, 100);
            await notifier.notify('all', { type: 'post', title: 'منشور جديد من الخدّام 📢',
                body: preview || 'ادخل شوف المنشور الجديد', link: { screen: 'post', id: context.params.postId } },
                { id: context.eventId });
        } catch (err) {
            console.error('[onPostCreated] error:', err);
        }
    });

// ============================================================
// 9. POST DELETED → cleanup storage image + orphan comments
//    Triggers on manual delete AND on TTL auto-deletion.
// ============================================================
exports.onPostDeleted = functions
    .region('europe-west1')
    .firestore.document('posts/{postId}')
    .onDelete(async (snap, context) => {
        var postId = context.params.postId;
        var post = snap.data() || {};
        var ops = [];

        // 1) Delete storage image (best-effort — file may not exist)
        try {
            var bucket = admin.storage().bucket();
            ops.push(
                bucket.file('social/posts/' + postId + '.jpg').delete().catch(function(e) {
                    if (e && e.code !== 404) console.warn('[onPostDeleted] storage delete error:', e.message);
                })
            );
        } catch (e) {
            console.warn('[onPostDeleted] storage cleanup setup failed:', e);
        }

        // 2) Delete orphan comments subcollection (TTL on comments handles most,
        //    but on manual delete we want immediate cleanup)
        try {
            var cs = await db.collection('posts').doc(postId).collection('comments').get();
            if (!cs.empty) {
                var batches = [];
                var batch = db.batch();
                var count = 0;
                cs.forEach(function(d) {
                    batch.delete(d.ref);
                    count++;
                    if (count % 450 === 0) { batches.push(batch.commit()); batch = db.batch(); }
                });
                batches.push(batch.commit());
                ops.push(Promise.all(batches));
            }
        } catch (e) {
            console.warn('[onPostDeleted] comments cleanup error:', e);
        }

        await Promise.all(ops);
        console.log('[onPostDeleted] cleaned up', postId);
    });

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

// ============================================================
// SELFIE CHALLENGE OPENS → push once (checked hourly, Cairo time)
// ============================================================
exports.selfieChallengeStarts = functions.region('europe-west1')
    .runWith({ timeoutSeconds: 300 })
    .pubsub.schedule('5 * * * *').timeZone('Africa/Cairo').onRun(async () => {
        var now = Date.now();
        var snap = await db.collection('selfieChallenges').where('enabled', '==', true).get();
        for (const d of snap.docs) {
            try {
                var c = d.data() || {};
                if (!L.selfieDue(c, now)) continue;
                await d.ref.update({ notifiedAt: now, notifiedStartAt: c.startAt });
                var m = L.message('selfie', { title: c.title, stars: c.rewardStars || 0, day: L.arabicDay(+c.endAt) });
                await notifier.notify(c.level ? 'level_' + c.level : 'all',
                    { type: 'selfie', title: m.title, body: m.body, link: { screen: 'selfie' } },
                    { id: 'selfie_' + d.id, levelBy: 'compete' });
            } catch (err) {
                console.error('[selfieChallengeStarts] doc ' + d.id + ' failed:', err);
            }
        }
        return null;
    });

// ============================================================
// TOURNAMENT GOES ACTIVE → push each team's members (once)
// ============================================================
exports.onTournamentStarted = functions.region('europe-west1')
    .runWith({ timeoutSeconds: 300 })
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
                    link: { screen: 'tournament', id: context.params.tid } },
                    { id: context.eventId + '_' + phone });
            }
        }
        return null;
    });

// ============================================================
// Teammate invites: sender and receiver must share a team; one push per pair per 10 minutes
// ============================================================
exports.onInviteCreated = functions.region('europe-west1')
    .firestore.document('invites/{id}').onCreate(async (snap, context) => {
        var inv = snap.data() || {};
        if (!inv.from || !inv.to || !inv.code) return null;
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
