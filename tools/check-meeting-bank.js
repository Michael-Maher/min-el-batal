#!/usr/bin/env node
/* Dev-only schema and coverage check for meeting-bank.js (not shipped).
   Run: node tools/check-meeting-bank.js [--level 1|2]
   Without --level it checks the station and gen (fallback) minimums of every level that has items. */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path');

function readSrc(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); }

var ctx = { console: console, Math: Math, Date: Date, JSON: JSON };
vm.createContext(ctx);
vm.runInContext(readSrc('meeting-core.js'), ctx, { filename: 'meeting-core.js' });
vm.runInContext(readSrc('meeting-bank.js'), ctx, { filename: 'meeting-bank.js' });
var KINDS = ctx.MT_KINDS, BANK = ctx.MEETING_BANK;

var ID_RE = /^mb_(l1b|l2b)_(s\d|gen)_([a-z]+)_\d{2}$/;
var EMOJI_RE = /\p{Extended_Pictographic}/u;
var LEVELS = {
    1: { code: 'l1b', subject: 'l1_bible', stations: 6 },
    2: { code: 'l2b', subject: 'l2_bible', stations: 8 }
};
/* Per-station minimums by kind. */
var STATION_MIN = {
    1: { verse: 2, scenario: 2, order: 2, emoji: 2, anagram: 2, odd: 2, deep: 3, sixty: 2, act: 2, draw: 2, taboo: 2 },
    2: { mcq: 3, tf: 2, clues: 2, verse: 2, scenario: 2, odd: 2, anagram: 2, deep: 4, sixty: 2, taboo: 2 }
};
var STATION_TOTAL_MIN = 23;
/* Per-level minimums for the fallback pool (station null, id segment gen). */
var GEN_MIN = { emoji: 6, act: 6, draw: 6, taboo: 6, order: 4, anagram: 6, hymn: 6 };
var PROMPT_MAX = 120, SCENARIO_PROMPT_MAX = 220, ODD_ITEM_MAX = 25, ANAGRAM_MAX = 14, HINT_MAX = 20;

var errors = [];
function err(id, msg) { errors.push((id || '(no id)') + ': ' + msg); }

function str(v) { return typeof v === 'string' && v.trim().length > 0; }
function strList(v, min, max) {
    return Array.isArray(v) && v.length >= min && v.length <= max && v.every(str);
}
function distinct(list) {
    var seen = {};
    return list.every(function (x) { if (seen[x]) return false; seen[x] = true; return true; });
}

function checkPrompt(it) {
    if (!str(it.prompt)) { err(it.id, 'prompt missing'); return; }
    var max = it.kind === 'scenario' ? SCENARIO_PROMPT_MAX : PROMPT_MAX;
    if (it.prompt.length > max) err(it.id, 'prompt longer than ' + max + ' chars (' + it.prompt.length + ')');
}

function checkKind(it) {
    switch (it.kind) {
        case 'mcq': case 'scenario': case 'verse':
            checkPrompt(it);
            if (!strList(it.options, 2, 4)) err(it.id, 'options must be 2-4 non-empty strings');
            else {
                if (!distinct(it.options)) err(it.id, 'options repeat');
                if (!(Number.isInteger(it.correct) && it.correct >= 0 && it.correct < it.options.length)) err(it.id, 'correct is not a valid index');
            }
            break;
        case 'tf':
            checkPrompt(it);
            if (it.answer !== 'صح' && it.answer !== 'غلط') err(it.id, "answer must be 'صح' or 'غلط'");
            break;
        case 'clues':
            if (!strList(it.clues, 3, 5)) err(it.id, 'clues must be 3-5 non-empty strings');
            if (!str(it.answer)) err(it.id, 'answer missing');
            break;
        case 'order':
            checkPrompt(it);
            if (!strList(it.steps, 4, 4)) err(it.id, 'steps must be exactly 4 non-empty strings');
            else if (!distinct(it.steps)) err(it.id, 'steps repeat');
            break;
        case 'emoji':
            checkPrompt(it);
            if (str(it.prompt) && !EMOJI_RE.test(it.prompt)) err(it.id, 'prompt has no emoji');
            if (!str(it.answer)) err(it.id, 'answer missing');
            break;
        case 'anagram':
            if (!str(it.answer)) { err(it.id, 'answer missing'); break; }
            var letters = it.answer.replace(/\s+/g, '').split('');
            var set = {};
            letters.forEach(function (c) { set[c] = true; });
            if (Object.keys(set).length < 2) err(it.id, 'answer needs 2+ distinct letters');
            if (letters.length > ANAGRAM_MAX) err(it.id, 'answer longer than ' + ANAGRAM_MAX + ' letters');
            if (it.answer.trim().split(/\s+/).length > 2) err(it.id, 'answer must be one or two words');
            if (it.hint !== undefined) {
                if (!str(it.hint)) err(it.id, 'hint must be a non-empty string when present');
                else if (it.hint.length > HINT_MAX) err(it.id, 'hint longer than ' + HINT_MAX + ' chars');
            }
            break;
        case 'odd':
            if (!strList(it.items, 4, 4)) { err(it.id, 'items must be exactly 4 non-empty strings'); break; }
            if (!distinct(it.items)) err(it.id, 'items repeat');
            it.items.forEach(function (x) { if (x.length > ODD_ITEM_MAX) err(it.id, 'odd item longer than ' + ODD_ITEM_MAX + ' chars: ' + x); });
            if (!(Number.isInteger(it.odd) && it.odd >= 0 && it.odd <= 3)) err(it.id, 'odd must be an index 0-3');
            else if (it.answer !== it.items[it.odd]) err(it.id, 'answer must equal items[odd]');
            break;
        case 'deep':
            checkPrompt(it);
            if (!str(it.answer)) err(it.id, 'answer missing');
            break;
        case 'sixty':
            checkPrompt(it);
            if (!Array.isArray(it.list) || it.list.length < 6 || !it.list.every(str)) err(it.id, 'list must have 6+ non-empty strings');
            else if (!distinct(it.list)) err(it.id, 'list repeats');
            if (!str(it.answer)) err(it.id, 'answer (summary line) missing');
            break;
        case 'act': case 'draw':
            if (!str(it.secret)) err(it.id, 'secret missing');
            break;
        case 'taboo':
            if (!str(it.secret)) err(it.id, 'secret missing');
            if (!strList(it.forbidden, 3, 3)) err(it.id, 'forbidden must be exactly 3 non-empty strings');
            else if (!distinct(it.forbidden.concat([it.secret]))) err(it.id, 'forbidden words repeat or equal the secret');
            break;
        case 'hymn':
            if (!str(it.firstLine)) err(it.id, 'firstLine missing');
            if (!str(it.answer)) err(it.id, 'answer missing');
            break;
    }
}

function checkItem(it, ids) {
    if (!it || typeof it !== 'object') { err(null, 'item is not an object'); return; }
    var m = typeof it.id === 'string' ? ID_RE.exec(it.id) : null;
    if (!m) { err(it.id, 'id does not match ' + ID_RE); return; }
    if (ids[it.id]) err(it.id, 'duplicate id');
    ids[it.id] = true;

    var lv = Number.isInteger(it.level) ? LEVELS[it.level] : null;
    if (!lv) err(it.id, 'level must be the number 1 or 2');
    else {
        if (m[1] !== lv.code) err(it.id, 'id level code ' + m[1] + ' does not match level ' + it.level);
        if (it.subject !== lv.subject) err(it.id, 'subject must be ' + lv.subject);
    }
    if (m[2] === 'gen') {
        if (it.station !== null) err(it.id, 'gen item must have station null');
    } else {
        var st = Number(m[2].slice(1));
        if (it.station !== st) err(it.id, 'station must be ' + st + ' to match the id');
        if (lv && (st < 0 || st >= lv.stations)) err(it.id, 'station ' + st + ' out of range for level ' + it.level);
    }
    if (!Object.prototype.hasOwnProperty.call(KINDS, it.kind)) err(it.id, 'unknown kind ' + it.kind);
    else if (m[3] !== it.kind) err(it.id, 'id kind segment ' + m[3] + ' does not match kind ' + it.kind);
    if (!str(it.explain)) err(it.id, 'explain missing');
    if ([1, 2, 3].indexOf(it.difficulty) < 0) err(it.id, 'difficulty must be 1, 2 or 3');
    checkKind(it);
}

/* ---- run ---- */
var argLevel = null, li = process.argv.indexOf('--level');
if (li >= 0) {
    argLevel = Number(process.argv[li + 1]);
    if (!LEVELS[argLevel]) { console.log('usage: node tools/check-meeting-bank.js [--level 1|2]'); process.exit(2); }
}

if (!Array.isArray(BANK)) { console.log('FAIL MEETING_BANK is not an array'); process.exit(1); }
var ids = {};
BANK.forEach(function (it) { checkItem(it, ids); });

var levels = argLevel ? [argLevel] : Object.keys(LEVELS).map(Number).filter(function (l) {
    return BANK.some(function (it) { return it.level === l; });
});
if (!levels.length) err(null, 'MEETING_BANK is empty');

var kindKeys = Object.keys(KINDS);
levels.forEach(function (l) {
    var lv = LEVELS[l], mins = STATION_MIN[l];
    console.log('\nLevel ' + l + ' (' + lv.subject + ')');
    console.log(['st'].concat(kindKeys, ['total', 'd1/d2/d3']).join('\t'));
    for (var s = 0; s < lv.stations; s++) {
        var items = BANK.filter(function (it) { return it.level === l && it.station === s; });
        var by = {}, diff = { 1: 0, 2: 0, 3: 0 };
        items.forEach(function (it) { by[it.kind] = (by[it.kind] || 0) + 1; if (diff[it.difficulty] !== undefined) diff[it.difficulty]++; });
        console.log(['s' + s].concat(kindKeys.map(function (k) { return by[k] || 0; }), [items.length, diff[1] + '/' + diff[2] + '/' + diff[3]]).join('\t'));
        var where = 'level ' + l + ' station ' + s;
        Object.keys(mins).forEach(function (k) {
            if ((by[k] || 0) < mins[k]) err(where, k + ' has ' + (by[k] || 0) + ', needs ' + mins[k]);
        });
        if (items.length < STATION_TOTAL_MIN) err(where, items.length + ' items, needs ' + STATION_TOTAL_MIN);
        [1, 2, 3].forEach(function (d) { if (!diff[d]) err(where, 'no difficulty ' + d + ' item'); });
    }
    var gen = BANK.filter(function (it) { return it.level === l && it.station === null; });
    var gby = {}, gdiff = { 1: 0, 2: 0, 3: 0 };
    gen.forEach(function (it) { gby[it.kind] = (gby[it.kind] || 0) + 1; if (gdiff[it.difficulty] !== undefined) gdiff[it.difficulty]++; });
    console.log(['gen'].concat(kindKeys.map(function (k) { return gby[k] || 0; }), [gen.length, gdiff[1] + '/' + gdiff[2] + '/' + gdiff[3]]).join('\t'));
    Object.keys(GEN_MIN).forEach(function (k) {
        if ((gby[k] || 0) < GEN_MIN[k]) err('level ' + l + ' gen', k + ' has ' + (gby[k] || 0) + ', needs ' + GEN_MIN[k]);
    });
});

console.log('');
if (errors.length) {
    errors.forEach(function (e) { console.log('FAIL ' + e); });
    console.log('\n' + errors.length + ' problem(s), ' + BANK.length + ' items');
    process.exit(1);
}
console.log('OK ' + BANK.length + ' items');
