'use strict';
const test = require('node:test');
const assert = require('node:assert');
test('index.js loads and exports the expected functions', () => {
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'min-el-batal';
    const fns = require('../index.js');
    const names = Object.keys(fns).sort();
    assert.ok(!names.includes('onNewLesson'));
    assert.ok(!names.includes('updateNotifPrefs'));
    ['selfieChallengeStarts', 'onTournamentStarted', 'onAnnouncementCreated','onQuestionMessageCreated', 'onPostCommentCreated', 'onPostCreated',
     'onPostDeleted', 'weeklyReminder', 'onQuestionCreated', 'onPlayerReportCreated',
     'onRewardRequestCreated', 'onAdminRequestCreated', 'onNotifyQueueCreated'].forEach((n) => assert.ok(names.includes(n), n));
});
