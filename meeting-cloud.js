/* Meeting game: Firestore layer. Season-safe, idempotent star awards plus roster/history I/O.
   Plain globals, no modules. Depends on meeting-core.js (mtPendingSyncs) and firebase (compat). */

// Must equal SCORE_SEASON_FIELDS in game.js (asserted by tools/check-meeting.js).
var MC_SEASON_FIELDS = ['stars', 'gems', 'xp', 'streak', 'bestStreak', 'totalCorrect', 'totalAnswered', 'gamesPlayed', 'perfectLevels', 'blitzWeeklyScore'];
var MC_KEYS_KEPT = 40;
var _mcFlushing = null;

// Same parsing as game.js _seasonMs.
function _mcMs(v) {
    if (!v) return 0;
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v === 'string') return Date.parse(v) || 0;
    if (v.seconds) return v.seconds * 1000;
    return +v || 0;
}

function mcLoadPlayers(db) {
    return db.collection('leaderboard').get().then(function (snap) {
        var out = [];
        snap.forEach(function (d) {
            var x = d.data() || {};
            if (!x.playerName) return;
            out.push({ phone: d.id, name: x.playerName, level: x.playerLevel === 2 ? 2 : 1, team: x.team || '', character: x.character || '' });
        });
        return out;
    });
}

function mcLoadTeams(db) {
    return db.collection('teams').get().then(function (snap) {
        var out = [];
        snap.forEach(function (d) {
            var x = d.data() || {};
            out.push({ name: x.name || '', color: x.color || '', logo: x.logo || '', level: x.level || 0 });
        });
        return out;
    });
}

function mcLoadSeason(db) {
    return db.collection('gameContent').doc('season').get().then(function (d) {
        return d.exists ? d.data() : null;
    });
}

/* One transaction per kid per award. key makes retries (including after a lost ack) no-ops. */
function mcApplyAward(db, o) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) return Promise.reject(new Error('bad-date'));
    var pRef = db.collection('players').doc(o.phone);
    var lRef = db.collection('leaderboard').doc(o.phone);
    return db.runTransaction(function (tx) {
        return tx.get(pRef).then(function (pSnap) {
            return tx.get(lRef).then(function (lSnap) {
                if (!pSnap.exists) throw new Error('no-player');
                var doc = pSnap.data() || {};
                var keys = doc.meetingAwardKeys || [];
                if (keys.indexOf(o.key) >= 0) return 'duplicate';

                var season = o.season;
                var stale = !!(season && season.id && doc.scoreSeasonId !== season.id);
                if (stale) {
                    var joined = _mcMs(doc.createdAt);
                    if (joined && joined >= _mcMs(season.startedAt)) stale = false;
                }
                var base = stale ? 0 : (doc.stars || 0);
                var newStars = Math.max(0, base + o.points);
                var log = doc.meetingLog || {};
                var nextKeys = keys.concat([o.key]).slice(-MC_KEYS_KEPT);

                var upd = {
                    stars: newStars,
                    meetingAwardKeys: nextKeys,
                    syncId: Math.random().toString(36).slice(2) + Date.now().toString(36),
                    lastUpdated: new Date().toISOString()
                };
                upd['meetingLog.' + o.date] = (log[o.date] || 0) + o.points;
                var lUpd = { stars: newStars };
                if (stale) {
                    var lDoc = lSnap.exists ? (lSnap.data() || {}) : {};
                    MC_SEASON_FIELDS.forEach(function (k) {
                        upd[k] = 0;
                        if (lSnap.exists && k !== 'stars' && lDoc[k] !== undefined) lUpd[k] = 0;
                    });
                    upd.stars = newStars;
                    upd.scoreSeasonId = season.id;
                    if (doc.season) upd['season.startStars'] = 0;
                }
                tx.update(pRef, upd);
                if (lSnap.exists) tx.update(lRef, lUpd);
                return 'applied';
            });
        });
    });
}

/* Pushes every unsynced (award, kid) pair, oldest first, one at a time. Never throws.
   Loops until nothing is pending (awards added mid-flush are included) or an error stops it.
   Resolves {applied, failed, lastError?}; lastError means sync is stuck. */
function mcFlush(db, night, ctx) {
    if (_mcFlushing) return _mcFlushing;
    var applied = 0, failed = 0, lastError = null;
    var nightKey = night.id || night.date;
    function byId(id) {
        for (var i = 0; i < night.awards.length; i++) if (night.awards[i].id === id) return night.awards[i];
        return null;
    }
    function mark(award, phone, isFail) {
        award.synced[phone] = true;
        if (isFail) { award.failed = award.failed || []; if (award.failed.indexOf(phone) < 0) award.failed.push(phone); }
        try { if (ctx.save) ctx.save(); } catch (e) {}
        try { if (ctx.onChange) ctx.onChange(); } catch (e) {}
    }
    // Resolves true when the pass made progress and nothing stopped it.
    function step(list, i, progressed) {
        if (i >= list.length) return Promise.resolve(progressed);
        var s = list[i], award = byId(s.awardId);
        if (!award) return step(list, i + 1, progressed);
        return mcApplyAward(db, { key: nightKey + '_' + s.awardId + '_' + s.phone, phone: s.phone, points: s.points, date: night.date, season: ctx.season })
            .then(function (r) {
                if (r === 'applied') applied++;
                mark(award, s.phone, false);
                return step(list, i + 1, true);
            }, function (err) {
                if (err && err.message === 'no-player') {
                    failed++;
                    mark(award, s.phone, true);
                    return step(list, i + 1, true);
                }
                lastError = { code: (err && err.code) || '', message: (err && err.message) || String(err) };
                try { console.warn('meeting sync stopped:', lastError.code, lastError.message); } catch (e) {}
                return false;
            });
    }
    function pass() {
        var list = mtPendingSyncs(night);
        if (!list.length) return Promise.resolve();
        return step(list, 0, false).then(function (more) { if (more) return pass(); });
    }
    function done() {
        _mcFlushing = null;
        var r = { applied: applied, failed: failed };
        if (lastError) r.lastError = lastError;
        return r;
    }
    _mcFlushing = pass().then(done, function (e) {
        lastError = { code: '', message: (e && e.message) || String(e) };
        return done();
    });
    return _mcFlushing;
}

function mcLoadHistory(db) {
    return db.collection('gameContent').doc('meetingHistory').get().then(function (d) {
        return (d.exists && d.data() && d.data().used) || {};
    });
}

function mcRecordUsed(db, itemId, date) {
    var u = {}; u[itemId] = date;
    return db.collection('gameContent').doc('meetingHistory').set({ used: u }, { merge: true });
}

function mcLogAward(db, award, o) {
    try {
        var ind = award.kind === 'individual';
        return db.collection('playerEvents').add({
            playerPhone: ind ? award.phones[0] : '',
            playerName: (ind ? o.kidName : o.teamName) || '',
            team: o.teamName || '',
            type: 'meeting_award',
            data: { points: award.points, reason: award.kind, recipients: award.phones, segment: o.segment || '', itemId: award.itemId || '', teamName: o.teamName || '', admin: o.adminName || '', nightDate: o.date || '' },
            ts: Date.now(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {}, function () {});
    } catch (e) { return Promise.resolve(); }
}
