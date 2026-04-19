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

// ============================================================
// Message Pools (warm, encouraging Arabic messages)
// ============================================================

var COMPETITION_MSG = {
    title: 'مسابقة جديدة! ⚡',
    // body is dynamic (includes host name)
};

var INACTIVITY_MESSAGES = [
    { title: 'وحشتنا يا بطل! 🌟', body: 'تعال كمل مغامرتك في مدرسة أتبعني' },
    { title: 'فين يا بطل؟ 😊', body: 'ربنا مستنيك تكمل رحلتك النهارده' },
    { title: 'رجعتلك وحشة! 💙', body: 'تعال شوف إيه الجديد في مين البطل' },
    { title: 'يلا نكمل سوا! 🚀', body: 'مغامرتك مستنياك، ادخل كمّل' },
    { title: 'افتكرناك! 🙏', body: 'تعال صلّي وكمّل تداريبك الروحية' },
];

var EXERCISE_MESSAGES = [
    { title: 'فاضلك تداريب يا بطل 📖', body: 'كمّل تداريبك اليومية وخد نجوم!' },
    { title: 'وقت الخلوة! 🕯️', body: 'دقايق مع ربنا هتفرق في يومك' },
    { title: 'متنساش تداريبك 💪', body: 'لسه عندك تداريب مستنياك النهارده' },
    { title: 'خلّص تداريبك! ⭐', body: 'كل تدريب بيقرّبك أكتر لربنا' },
    { title: 'يلا نصلّي! 🙏', body: 'صلاتك أهم حاجة في يومك' },
];

var WEEKLY_MESSAGES = [
    { title: 'تداريب الأسبوع 📊', body: 'لسه عندك تداريب أسبوعية، كمّلها قبل ما الأسبوع يخلص!' },
    { title: 'فاضل تداريب أسبوعية! ⏰', body: 'متضيعش نجومك، خلّص تداريبك الأسبوعية' },
    { title: 'القداس والاجتماع! ⛪', body: 'الأسبوع قرّب يخلص، خلّصت تداريبك الأسبوعية؟' },
];

var NEW_LESSON_MESSAGES = [
    { title: 'درس جديد نزل! 📚', body: 'في محتوى جديد مستنيك في مدرسة أتبعني' },
    { title: 'حاجة جديدة! 🎓', body: 'ادخل شوف الدرس الجديد واكسب نجوم' },
];

// ============================================================
// Helper: pick random message from pool
// ============================================================
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// Helper: get today's date string in Cairo timezone
// ============================================================
function getCairoDateStr() {
    var now = new Date();
    // Cairo is UTC+2 (or UTC+3 in summer, but EET is standard)
    var cairoTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    return cairoTime.toISOString().split('T')[0];
}

// ============================================================
// Helper: get current week key (same format as game.js)
// ============================================================
function getWeekKey() {
    var now = new Date();
    var d = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

// ============================================================
// Helper: send notification safely (handles expired tokens)
// ============================================================
async function safeSend(token, notification, data, playerId) {
    try {
        await messaging.send({
            token: token,
            notification: {
                title: notification.title,
                body: notification.body,
            },
            data: data || {},
            android: {
                priority: 'normal',
                notification: {
                    channelId: 'min-el-batal-reminders',
                    icon: 'ic_notification',
                    color: '#6C5CE7',
                },
            },
            webpush: {
                headers: { Urgency: 'normal', TTL: '86400' },
                notification: {
                    icon: '/images/Logo-192.png',
                    badge: '/images/Logo-192.png',
                    dir: 'rtl',
                    lang: 'ar',
                    vibrate: [100, 50, 100],
                },
                fcmOptions: { link: 'https://min-el-batal.web.app' },
            },
        });
        return true;
    } catch (err) {
        // Clean up invalid tokens
        if (
            err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token'
        ) {
            console.log('Removing invalid token for player:', playerId);
            await db.collection('players').doc(playerId).update({
                fcmToken: admin.firestore.FieldValue.delete(),
            });
        }
        return false;
    }
}

// ============================================================
// 1. COMPETITION CREATED → Notify subscribed users
// ============================================================
exports.onCompetitionCreated = functions
    .region('europe-west1')
    .firestore.document('compete_rooms/{roomId}')
    .onCreate(async (snap, context) => {
        var room = snap.data();
        var hostName = room.hostName || 'حد من الخدمة';
        var roomCode = room.code || '';
        var hostPhone = room.hostPhone || '';

        // Get all players with FCM tokens (except the host)
        var playersSnap = await db.collection('players')
            .where('fcmToken', '!=', null)
            .get();

        var sent = 0;
        var promises = [];

        playersSnap.forEach(function(doc) {
            // Don't notify the host who created it
            if (doc.id === hostPhone) return;

            var player = doc.data();
            if (!player.fcmToken) return;

            // Check notification preferences
            if (player.notifPrefs && player.notifPrefs.competitions === false) return;

            promises.push(
                safeSend(
                    player.fcmToken,
                    {
                        title: COMPETITION_MSG.title,
                        body: hostName + ' عمل مسابقة جديدة - يلا نافس! 🏆',
                    },
                    {
                        type: 'compete_invite',
                        roomCode: roomCode,
                        roomId: context.params.roomId,
                    },
                    doc.id
                ).then(function(ok) { if (ok) sent++; })
            );
        });

        await Promise.all(promises);
        console.log('[Notif] Competition created by', hostName, '- notified', sent, 'players');
    });

// ============================================================
// 2. NEW LESSON / CONTENT → Notify all users
// ============================================================
exports.onNewLesson = functions
    .region('europe-west1')
    .firestore.document('lessons/{lessonId}')
    .onCreate(async (snap, context) => {
        var lesson = snap.data();

        var playersSnap = await db.collection('players')
            .where('fcmToken', '!=', null)
            .get();

        var msg = pickRandom(NEW_LESSON_MESSAGES);
        // Override body if lesson has a title
        if (lesson.title) {
            msg = { title: 'درس جديد: ' + lesson.title + ' 📚', body: 'ادخل مدرسة أتبعني وشوف الدرس الجديد' };
        }

        var sent = 0;
        var promises = [];

        playersSnap.forEach(function(doc) {
            var player = doc.data();
            if (!player.fcmToken) return;
            if (player.notifPrefs && player.notifPrefs.lessons === false) return;

            promises.push(
                safeSend(player.fcmToken, msg, { type: 'new_lesson', lessonId: context.params.lessonId }, doc.id)
                    .then(function(ok) { if (ok) sent++; })
            );
        });

        await Promise.all(promises);
        console.log('[Notif] New lesson - notified', sent, 'players');
    });

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
        var body = ann.body || '';
        var icon = ann.icon || '📢';

        var playersSnap = await db.collection('players')
            .where('fcmToken', '!=', null)
            .get();

        var sent = 0;
        var attempted = 0;
        var promises = [];

        playersSnap.forEach(function(doc) {
            var player = doc.data();
            if (!player.fcmToken) return;
            // Respect preferences — treat announcements as "reminders" category
            if (player.notifPrefs && player.notifPrefs.reminders === false) return;

            attempted++;
            promises.push(
                safeSend(
                    player.fcmToken,
                    { title: title, body: body },
                    {
                        type: 'announcement',
                        announcementId: context.params.announcementId,
                        icon: icon,
                    },
                    doc.id
                ).then(function(ok) { if (ok) sent++; })
            );
        });

        await Promise.all(promises);
        console.log('[Notif] Announcement', context.params.announcementId, '- sent', sent, '/', attempted);

        // Write delivery stats back to the announcement doc for admin visibility
        await snap.ref.update({
            pushStatus: 'sent',
            pushSentCount: sent,
            pushAttempted: attempted,
            pushProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(function() {});

        return null;
    });

// ============================================================
// 3. DAILY EVENING REMINDER (8 PM Cairo)
//    Priority: inactivity > incomplete exercises
//    Only sends 1 notification per user (the highest priority one)
// ============================================================
exports.dailyEveningReminder = functions
    .region('europe-west1')
    .pubsub.schedule('0 20 * * *')       // 8:00 PM
    .timeZone('Africa/Cairo')
    .onRun(async (context) => {
        var todayStr = getCairoDateStr();
        var yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        var yesterdayStr = new Date(yesterdayDate.getTime() + (2 * 60 * 60 * 1000)).toISOString().split('T')[0];

        var playersSnap = await db.collection('players').get();
        var sent = 0;
        var skipped = 0;
        var promises = [];

        playersSnap.forEach(function(doc) {
            var player = doc.data();
            if (!player.fcmToken) return;

            // Respect notification preferences
            if (player.notifPrefs && player.notifPrefs.reminders === false) {
                skipped++;
                return;
            }

            // Check if already sent today (avoid duplicates)
            if (player.lastNotifDate === todayStr) {
                skipped++;
                return;
            }

            var notification = null;
            var dataType = '';

            // --- Priority 1: Inactive (didn't open app today) ---
            var lastActive = '';
            if (player.lampData && player.lampData.lastActiveDate) {
                lastActive = player.lampData.lastActiveDate;
            }
            // Also check the top-level lastActiveDate we'll add
            if (player.lastActiveDate && player.lastActiveDate > lastActive) {
                lastActive = player.lastActiveDate;
            }

            if (lastActive && lastActive < todayStr) {
                notification = pickRandom(INACTIVITY_MESSAGES);
                dataType = 'inactivity_reminder';
            }
            // --- Priority 2: Exercises not completed today ---
            else {
                var exerciseLog = player.exerciseLog || {};
                var todayLog = exerciseLog[todayStr] || {};
                var dailyDone = (todayLog.daily || []).length;
                var totalDaily = 6;

                if (dailyDone < totalDaily) {
                    notification = pickRandom(EXERCISE_MESSAGES);
                    dataType = 'exercise_reminder';

                    // Customize message based on what's missing
                    if (dailyDone === 0) {
                        notification = { title: 'يلا نبدأ! 🌟', body: 'متبدأش يومك من غير ما تعمل تداريبك الروحية' };
                    } else if (dailyDone >= 4) {
                        notification = { title: 'فاضلك شوية! 💪', body: 'فاضلك ' + (totalDaily - dailyDone) + ' تداريب بس وتخلّص يومك' };
                    }
                }
            }

            if (notification) {
                promises.push(
                    safeSend(player.fcmToken, notification, { type: dataType }, doc.id)
                        .then(function(ok) {
                            if (ok) {
                                sent++;
                                // Mark that we sent a notification today
                                return db.collection('players').doc(doc.id).update({
                                    lastNotifDate: todayStr,
                                });
                            }
                        })
                );
            }
        });

        await Promise.all(promises);
        console.log('[Notif] Daily reminder: sent', sent, ', skipped', skipped, ', total', playersSnap.size);
    });

// ============================================================
// 4. WEEKLY REMINDER (Thursday 8 PM Cairo - before Friday)
//    Reminds about incomplete weekly exercises
// ============================================================
exports.weeklyReminder = functions
    .region('europe-west1')
    .pubsub.schedule('0 20 * * 4')       // Thursday 8 PM
    .timeZone('Africa/Cairo')
    .onRun(async (context) => {
        var weekKey = getWeekKey();
        var todayStr = getCairoDateStr();

        var playersSnap = await db.collection('players').get();
        var sent = 0;
        var promises = [];

        playersSnap.forEach(function(doc) {
            var player = doc.data();
            if (!player.fcmToken) return;
            if (player.notifPrefs && player.notifPrefs.reminders === false) return;
            // Don't double-send if daily already sent
            if (player.lastNotifDate === todayStr) return;

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
                promises.push(
                    safeSend(player.fcmToken, msg, { type: 'weekly_reminder' }, doc.id)
                        .then(function(ok) {
                            if (ok) {
                                sent++;
                                return db.collection('players').doc(doc.id).update({ lastNotifDate: todayStr });
                            }
                        })
                );
            }
        });

        await Promise.all(promises);
        console.log('[Notif] Weekly reminder: sent', sent, ', total', playersSnap.size);
    });

// ============================================================
// 5. STREAK LOST RECOVERY (for users who had 3+ day streaks)
//    Runs at 9 AM Cairo - gentle morning nudge
//    Only targets users who HAD a streak and are about to lose it
// ============================================================
exports.streakRecovery = functions
    .region('europe-west1')
    .pubsub.schedule('0 9 * * *')        // 9 AM Cairo
    .timeZone('Africa/Cairo')
    .onRun(async (context) => {
        var todayStr = getCairoDateStr();

        var playersSnap = await db.collection('players').get();
        var sent = 0;
        var promises = [];

        playersSnap.forEach(function(doc) {
            var player = doc.data();
            if (!player.fcmToken) return;
            if (player.notifPrefs && player.notifPrefs.streakReminder === false) return;

            var lampData = player.lampData || {};
            var streak = lampData.streakDays || 0;
            var lastActive = lampData.lastActiveDate || player.lastActiveDate || '';

            // Only nudge users with 3+ day streaks who didn't open yesterday
            if (streak >= 3 && lastActive && lastActive < todayStr) {
                var msg = {
                    title: '🔥 ' + streak + ' أيام متواصلة!',
                    body: 'متضيعش السلسلة بتاعتك! ادخل النهارده وكمّل',
                };
                promises.push(
                    safeSend(player.fcmToken, msg, { type: 'streak_recovery' }, doc.id)
                        .then(function(ok) { if (ok) sent++; })
                );
            }
        });

        await Promise.all(promises);
        console.log('[Notif] Streak recovery: sent', sent);
    });

// ============================================================
// 6. UPDATE NOTIFICATION PREFERENCES (callable function)
// ============================================================
exports.updateNotifPrefs = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        var phone = data.phone;
        var prefs = data.prefs;
        if (!phone || !prefs) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing phone or prefs');
        }
        await db.collection('players').doc(phone).update({
            notifPrefs: prefs,
        });
        return { success: true };
    });
