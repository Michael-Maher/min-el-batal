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
