// Pure notification logic: no Firebase imports, unit tested in test/notify-logic.test.js
'use strict';

var CAIRO_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
function cairoDate(date) { return CAIRO_FMT.format(date || new Date()); }

function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

var L2_PROGRESS_PREFIXES = ['faith_', 'ritual_', 'l2_bible_', 'l2_life_'];
function playerLevelOf(p) {
    if (p && (p.playerLevel === 1 || p.playerLevel === 2)) return p.playerLevel;
    var ss = (p && p.stationScores) || {};
    return Object.keys(ss).some(function(k) {
        return (ss[k] && ss[k].total > 0) && L2_PROGRESS_PREFIXES.some(function(pre) { return k.indexOf(pre) === 0; });
    }) ? 2 : 1;
}
function matchesLevel(p, n, levelBy) {
    var lv = levelBy === 'compete' ? ((p && p.teamLevel) || playerLevelOf(p)) : playerLevelOf(p);
    return lv === n;
}

var CATEGORY = {
    lesson_unlock: 'lessons', subject_unlock: 'lessons', level_unlock: 'lessons',
    selfie: 'competitions', tournament: 'competitions', invite_duel: 'competitions', invite_room: 'competitions',
    remind_inactive: 'reminders', remind_bible: 'reminders', weekly_reminder: 'reminders', announcement: 'reminders',
    post: 'social', post_comment: 'social'
};
function categoryOf(type) { return CATEGORY[type] || null; }
function prefAllows(prefs, type) {
    var c = categoryOf(type);
    return !c || !prefs || prefs[c] !== false;
}

function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'يا بطل'; }
function stripHtml(html) {
    if (!html) return '';
    var text = String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
}
function pick(arr, seed) { return arr[Math.abs(seed || 0) % arr.length]; }

var INACTIVE = [
    'فريقك محتاجك… ادخل كمّل رحلتك 🚀',
    'نجومك مستنياك، خطوة صغيرة النهارده تفرق',
    'في جديد مستنيك في مين البطل، تعالى شوف',
    'رحلتك مع ربنا مستمرة… يلا نكمّل سوا'
];
var VERSES = [
    '«سراج لرجلي كلامك ونور لسبيلي» — اقرا أصحاح النهارده',
    '«كلامك حلو لحلقي أحلى من العسل» — خمس دقايق مع الإنجيل',
    '«طوبى للذي يقرأ» — كمّل قراءتك وخد نجومك',
    '«كلمة الله حية وفعالة» — أصحاح النهارده مستنيك'
];

function message(type, v) {
    v = v || {};
    var name = v.name || 'حد';
    switch (type) {
        case 'admin_question':  return { title: 'سؤال جديد من ' + name + ' 💬', body: '«' + (v.title || 'سؤال') + '»' };
        case 'admin_reply':     return { title: name + ' رد على سؤاله ↩️', body: v.text || 'في رد جديد مستني' };
        case 'admin_report':    return { title: 'بلاغ جديد ⚠️', body: (v.reporter || 'لاعب') + ' بلّغ عن ' + (v.reported || 'لاعب') + ': ' + (v.reason || 'بدون سبب') };
        case 'admin_reward':    return { title: 'طلب هدية 🎁', body: name + ' عايز «' + (v.reward || 'هدية') + '»' };
        case 'admin_request':   return { title: 'طلب انضمام للخدمة 🙋', body: name + ' عايز يبقى أدمن' };
        case 'question_answer': return { title: 'الخادم رد على سؤالك ✉️', body: v.text || 'ادخل شوف الرد' };
        case 'lesson_unlock':   return { title: 'درس جديد اتفتح! 📖', body: '«' + (v.title || 'درس جديد') + '» مستنيك… ادخل اكسب نجومك ⭐' };
        case 'subject_unlock':  return { title: 'مادة جديدة اتفتحت 🔓', body: '«' + (v.title || 'مادة جديدة') + '» جاهزة ليك، يلا نبدأ!' };
        case 'level_unlock':    return { title: 'المستوى ' + (v.n || '') + ' اتفتح 🚀', body: 'مغامرة جديدة جاهزة ليك، يلا نبدأ!' };
        case 'selfie':          return { title: 'تحدي سيلفي جديد 📸', body: '«' + (v.title || 'التحدي') + '»: صوّر واكسب ' + (v.stars || 0) + ' نجمة قبل ' + (v.day || 'ما يخلص') };
        case 'tournament':      return { title: 'فريقك في كاس مين البطل! 🏆', body: '«' + (v.title || 'البطولة') + '» بدأت دلوقتي، شجّع ' + (v.team || 'فريقك') + ' لايف' };
        case 'invite_duel':     return { title: firstName(name) + ' بيتحداك! ⚔️', body: 'مبارزة 1 ضد 1… تقبل التحدي؟' };
        case 'invite_room':     return { title: firstName(name) + ' بيناديك للمنافسة 🎮', body: 'الأوضة مستنياك، ادخل قبل ما تبدأ' };
        case 'remind_inactive': return { title: 'وحشتنا يا ' + firstName(v.name) + '! 💛', body: pick(INACTIVE, v.seed) };
        case 'remind_bible':    return { title: 'كلمة ربنا مستنياك 📖', body: pick(VERSES, v.seed) };
        default:                return { title: v.title || 'مين البطل؟', body: v.text || 'عندك إشعار جديد' };
    }
}

function reminderFor(p, today) {
    if (!p || p.status === 'blocked' || p.status === 'suspended') return null;
    if (!prefAllows(p.notifPrefs, 'remind_inactive')) return null;
    var created = typeof p.createdAt === 'string' ? p.createdAt.slice(0, 10) : '';
    if (created && daysBetween(created, today) < 2) return null;
    if (p.lastRemindDate && daysBetween(p.lastRemindDate, today) < 2) return null;
    var active = p.lastActiveDate || created;
    if (!active || daysBetween(active, today) >= 2) return 'remind_inactive';
    if (!p.lastBibleDate || daysBetween(p.lastBibleDate, today) >= 2) return 'remind_bible';
    return null;
}

function parseLockKey(key) {
    var m = /^lesson_([a-z0-9_]+)_(\d+)$/.exec(key || '');
    if (m) return { kind: 'lesson', subject: m[1], index: Number(m[2]) };
    m = /^subject_([a-z0-9_]+)$/.exec(key || '');
    if (m) return { kind: 'subject', subject: m[1] };
    m = /^level_(\d+)$/.exec(key || '');
    if (m) return { kind: 'level', n: Number(m[1]) };
    return null;
}

function unlockMessage(q) {
    var k = parseLockKey(q && q.key);
    if (!k) return null;
    var type = k.kind === 'lesson' ? 'lesson_unlock' : k.kind === 'subject' ? 'subject_unlock' : 'level_unlock';
    var m = message(type, { title: q.title, n: k.n });
    return {
        type: type, title: m.title, body: m.body,
        link: k.subject ? { screen: 'subject', id: k.subject } : { screen: 'home' },
        audience: q.level === 1 || q.level === 2 ? 'level_' + q.level : 'all'
    };
}

function daysSinceStr(dateStr) {
    if (!dateStr) return 99999;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return 99999;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
}
// Moved verbatim from index.js (matches admin.html playerMatchesSegments)
function playerMatchesSegments(p, seg) {
    if (!seg) return true;
    if (seg.gender && seg.gender !== 'all' && p.gender !== seg.gender) return false;
    var hasTeam = !!(p.team && String(p.team).trim());
    if (seg.team === 'has' && !hasTeam) return false;
    if (seg.team === 'none' && hasTeam) return false;
    if (seg.year && seg.year !== 'all' && p.academicYear !== seg.year) return false;
    var last = (p.lampData && p.lampData.lastActiveDate) || p.lastActiveDate || '';
    var days = daysSinceStr(last);
    if (seg.activity === 'inactive3' && !(days >= 3)) return false;
    if (seg.activity === 'inactive7' && !(days >= 7)) return false;
    if (seg.activity === 'inactive30' && !(days >= 30)) return false;
    if (seg.activity === 'active' && !(days <= 3)) return false;
    var st = +p.stars || 0;
    if (seg.stars === 'lt100' && !(st < 100)) return false;
    if (seg.stars === 'lt500' && !(st < 500)) return false;
    if (seg.stars === 'lt1000' && !(st < 1000)) return false;
    if (seg.stars === 'gte1000' && !(st >= 1000)) return false;
    return true;
}

// Selfie challenge is due once: enabled, inside [startAt, endAt), and not yet notified
function selfieDue(c, nowMs) {
    return !!(c && c.enabled && !c.notifiedAt && (+c.startAt || 0) <= nowMs && nowMs < (+c.endAt || 0));
}
function arabicDay(ms) {
    return new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(new Date(ms));
}
// Unique team doc ids across all rounds of a tournament
function tournamentTeamIds(t) {
    var out = [];
    ((t && t.rounds) || []).forEach(function(r) {
        ((r && r.teams) || []).forEach(function(id) { if (id && out.indexOf(id) < 0) out.push(id); });
    });
    return out;
}

module.exports = { cairoDate, daysBetween, playerLevelOf, matchesLevel, categoryOf, prefAllows, message,
    reminderFor, parseLockKey, unlockMessage, stripHtml, firstName, playerMatchesSegments,
    selfieDue, arabicDay, tournamentTeamIds };
