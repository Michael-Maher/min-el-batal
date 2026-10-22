#!/usr/bin/env node
/* Dev-only: seeds the Firestore EMULATOR with a small cast for trying the meeting game.
   Never touches production: it only ever talks to localhost.
   Run: firebase emulators:start --only firestore   (needs JDK 21)
        node tools/seed-meeting-emu.js [PORT]        (default 8080)
   Then open /meeting.html?emu=PORT with an admin session. */
'use strict';
var path = require('path');

var PORT = Number(process.argv[2] || 8080);
var PROJECT = 'min-el-batal';
var HOST = 'localhost:' + PORT;

var TEAMS = [
    { id: 'team_marmarcos', name: 'مارمرقس', color: '#c0392b', logo: '🦁', level: 1 },
    { id: 'team_margirgis', name: 'مارجرجس', color: '#2980b9', logo: '🐎', level: 2 }
];
// [phone, name, level, team, stars]
var KIDS = [
    ['01000000001', 'مينا عادل', 1, 'مارمرقس', 120],
    ['01000000002', 'مينا سمير', 2, 'مارجرجس', 340],
    ['01000000003', 'أحمد', 1, '', 15],
    ['01000000004', 'احمد رامي', 2, 'مارجرجس', 80],
    ['01000000005', 'مريم جرجس', 1, 'مارمرقس', 210],
    ['01000000006', 'مارك عادل', 1, '', 60],
    ['01000000007', 'كيرلس ناجي', 2, '', 400],
    ['01000000008', 'ماريا عماد', 2, 'مارجرجس', 95],
    ['01000000009', 'بيشوي رامز', 1, 'مارمرقس', 30],
    ['01000000010', 'عبد المسيح فادي', 2, '', 5],
    ['01000000011', 'ساندرا مجدي', 1, '', 0],
    ['01000000012', 'أبانوب صموئيل', 1, '', 900]   // old season: scoreSeasonId 'old', joined 2026-01-01
];
var SEASON = { id: 's2', startedAt: '2026-10-11' };

function docs() {
    var out = [];
    KIDS.forEach(function (k) {
        var old = k[0] === '01000000012';
        out.push(['players/' + k[0], {
            playerName: k[1], playerPhone: k[0], currentLevel: k[2], playerLevel: k[2], team: k[3], stars: k[4],
            scoreSeasonId: old ? 'old' : SEASON.id, createdAt: old ? '2026-01-01' : '2026-10-12',
            syncId: 'seed'
        }]);
        out.push(['leaderboard/' + k[0], { playerName: k[1], playerLevel: k[2], team: k[3], stars: k[4] }]);
    });
    TEAMS.forEach(function (t) { out.push(['teams/' + t.id, { name: t.name, color: t.color, logo: t.logo, level: t.level, members: [], admins: [] }]); });
    out.push(['gameContent/season', SEASON]);
    return out;
}

function adminPath() {
    try { return require.resolve('firebase-admin', { paths: [path.join(__dirname, '..', 'functions')] }); } catch (e) { return null; }
}

function seedWithAdmin(modPath) {
    process.env.FIRESTORE_EMULATOR_HOST = HOST;
    var admin = require(modPath);
    admin.initializeApp({ projectId: PROJECT });
    var db = admin.firestore();
    return Promise.all(docs().map(function (d) { return db.doc(d[0]).set(d[1]); }));
}

/* Firestore REST value encoding (strings, numbers, booleans, arrays, maps). */
function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    var f = {};
    Object.keys(v).forEach(function (k) { f[k] = enc(v[k]); });
    return { mapValue: { fields: f } };
}

function seedWithRest() {
    var base = 'http://' + HOST + '/v1/projects/' + PROJECT + '/databases/(default)/documents/';
    return Promise.all(docs().map(function (d) {
        return fetch(base + d[0], {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
            body: JSON.stringify({ fields: enc(d[1]).mapValue.fields })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(d[0] + ': ' + r.status + ' ' + t); }); });
    }));
}

var mod = adminPath();
/* fail fast when nothing listens on the port (firebase-admin would retry for minutes) */
fetch('http://' + HOST + '/').catch(function () { throw new Error('no emulator answering'); }).then(function () {
    return mod ? seedWithAdmin(mod) : seedWithRest();
}).then(function () {
    console.log('Seeded ' + KIDS.length + ' players, ' + TEAMS.length + ' teams and gameContent/season into the emulator at ' + HOST + (mod ? ' (firebase-admin)' : ' (REST)'));
    process.exit(0);
}, function (e) {
    console.error('Seed failed (is the emulator running on ' + HOST + '?): ' + e.message);
    process.exit(1);
});
