# Notifications (admins + players)

User decisions (2026-10-18): admins get **push + in-panel alerts**, **every admin gets everything**. Players get push +
an in-game **bell inbox**. Lesson pushes are opt-in per unlock (checkbox **off** by default). Reminders after 2 days
without opening the game / reading the Bible, **repeating every 2 days** while the player stays away. Tournament push
goes to the members of its teams. Duel / room invites via a new **invite-a-teammate** button. All texts warm, youth
friendly, and every tap lands on the exact place the notification is about. Approach: one `notify()` service in Cloud
Functions writing a shared `notifications` store (approach 1).

## Data
| Doc | Shape | Writer |
|---|---|---|
| `notifications/{id}` | `{audience, type, title, body, link:{screen, id?, code?}, createdAt}`; `audience` = `<phone>` \| `all` \| `level_1` \| `level_2` \| `admins` | Cloud Functions only |
| `pushTokens/{token}` | `{owner, role:'player'\|'admin', updatedAt}`; `owner` = phone or `admin:<adminDocId>` (`admin:super`) | game / admin panel |
| `notifyQueue/{id}` | `{type:'lesson_unlock', key, title, level:0\|1\|2, createdAt}` | admin panel (checkbox ticked) |
| `invites/{id}` | `{kind:'duel'\|'room', from, fromName, to, code, createdAt}` | game |
| `players` new fields | `notifSeenAt` (ms), `lastBibleDate` (`YYYY-MM-DD`), `lastRemindDate` (`YYYY-MM-DD`) | game / functions |
| `selfieChallenges` new field | `notifiedAt` (ms) | functions |

Index (new `firestore.indexes.json`, wired in `firebase.json`): `notifications` (`audience` ASC, `createdAt` DESC).
Retention: the daily job deletes `notifications` older than 30 days and `invites` older than 1 day.

## Rules (narrow; everything else stays `if true`)
There is no Firebase Auth, so rules cannot tell an admin from a player. What they can do:
- `notifications`: read `true`, write `false` (functions bypass rules) → nobody can forge a notification.
- `pushTokens`: create/update when keys are exactly `owner, role, updatedAt` and `role` ∈ {player, admin}; delete
  `true`; read `false` (token list is not exposed).
- `notifyQueue`: create only, exact keys, `type == 'lesson_unlock'`, `title` string ≤ 80, `level` ∈ {0,1,2}, and
  `get(gameContent/locks).data[key].locked == false`. No read/update/delete.
- `invites`: create only, exact keys, `kind` ∈ {duel, room}, `to != from`. No read/update/delete.

Known limits (accepted, not fixed here): `announcements` and `gameContent/locks` stay writable by anyone, so a
determined client can still push arbitrary text through announcements. Closing that needs real admin auth.

## Cloud Functions (`functions/notify.js`, required from `index.js`; v1 API like the rest, `europe-west1`)
- `notify(audience, msg, opts)`: writes the `notifications` doc (id = trigger event id → retry-safe), resolves tokens,
  sends with `messaging.sendEach` in batches of 500 (data-only; the service workers display them), deletes tokens
  answering `registration-token-not-registered` / `invalid-registration-token`. Never throws into the trigger; logs.
  - Token resolution: `pushTokens where owner == …` / `where role == 'admin'`; for player audiences also the legacy
    `players.fcmToken` (players who never reopen the app — exactly the ones reminders target — still have only that).
    Level audiences read `players.select('playerLevel','stationScores'…)` and apply the same `playerLevelOf` rule as
    the game. Deduped by token. Player prefs (`notifPrefs`) filtered per category: `lessons` (lesson/subject/level
    unlock), `competitions` (selfie, tournament, invites), `reminders` (both reminders); a servant's answer always sends.
  - Pure logic (texts, audience → level match, reminder decision, Cairo date) lives in `functions/notify-logic.js`.

| Trigger | Audience | Title / body (Arabic, one emoji) | Opens |
|---|---|---|---|
| `questions` onCreate | admins | سؤال جديد من {name} 💬 / «{title}» | panel: question thread |
| `questions/*/messages` onCreate, `authorType=='user'` and not the first message | admins | {name} رد على سؤاله ↩️ / first line | panel: question thread |
| same, `authorType=='admin'` (replaces `onQuestionMessageCreated`) | asker | الخادم رد على سؤالك ✉️ / first line | game: the thread |
| `playerReports` onCreate | admins | بلاغ جديد ⚠️ / {reporter} بلّغ عن {reported}: {reason} | panel: reports |
| `reward_requests` onCreate | admins | طلب هدية 🎁 / {name} عايز «{reward}» | panel: rewards |
| `admin_requests` onCreate | admins | طلب انضمام للخدمة 🙋 / {name} عايز يبقى أدمن | panel: admins |
| `notifyQueue` onCreate (one send per `key`+`locks[key].setAt`, guard doc `notifySent/{key}_{setAt}` via `create()`) | `level_N` or `all` | lesson: درس جديد اتفتح! 📖 / «{title}» مستنيك… ادخل اكسب نجومك ⭐; subject: مادة جديدة اتفتحت 🔓; level: المستوى {n} اتفتح 🚀 | game: lesson / subject map / level |
| hourly: `selfieChallenges` with `enabled`, `startAt ≤ now < endAt`, no `notifiedAt` | `level_N` or `all` | تحدي سيلفي جديد 📸 / «{title}»: صوّر واكسب {n} نجمة قبل {day} | game: the challenge |
| `tournaments` onUpdate, `status` → `active` (first time) | members of `rounds[].teams` (via `teams.members`) | فريقك في كاس مين البطل! 🏆 / «{name}» بدأت دلوقتي، شجّع {team} لايف | `tournament-live.html?id=` |
| `invites` onCreate; `from` and `to` must share a team; max 1 per from→to per 10 min | `to` | duel: {name} بيتحداك! ⚔️ / مبارزة 1 ضد 1… تقبل التحدي؟; room: {name} بيناديك للمنافسة 🎮 / الأوضة مستنياك، ادخل قبل ما تبدأ | game: joins duel / room by code |
| daily 20:00 `Africa/Cairo` (replaces `dailyEveningReminder` + `streakRecovery`) | each player | see Reminders | home / Bible reading |
| `announcements` onCreate (kept, moved onto `notify`) | as today (segments) | admin text | as today |
| social posts / comments (kept, moved onto `notify`) | as today | as today | the post |

Removed: `onNewLesson` (nothing writes `lessons`), `updateNotifPrefs` (never called), the commented
`onCompetitionCreated`. `dailyEveningReminder`'s daily push to *active* players is dropped (daily noise);
`weeklyReminder` stays as is.

### Reminders (daily job)
Dates are Cairo calendar dates (`Intl` with `Africa/Cairo`, so summer time is right). For each player with tokens and
`notifPrefs.reminders !== false`, account older than 2 days, and `lastRemindDate` ≤ today−2 (or empty):
1. `lastActiveDate` ≤ today−2 → «وحشتنا يا {first name}! 💛» (4 rotating bodies, e.g. فريقك محتاجك… ادخل كمّل رحلتك) → home.
2. else `lastBibleDate` ≤ today−2 or empty → «كلمة ربنا مستنياك 📖» + rotating short verse → Bible reading screen.
3. else nothing. On send, write `lastRemindDate = today`. At most one reminder per player per day; never both.
Reads use `players.select(...)` on the small fields only (docs hold base64 media).

## Game (`game.js`, `index.html`, `sw.js`, `style.css`)
- Tokens: `initPushNotifications` writes `pushTokens/{token}` (owner = phone) and deletes legacy `players.fcmToken`;
  `logout()` deletes the device's token doc. Fix: token save no longer rebuilds `notifPrefs` (it dropped `social`).
- Single display: messages are data-only (no `webpush.notification`); the service workers display them. `sw.js` and
  `admin-sw.js` `onBackgroundMessage` are the only callers of `showNotification`, so each push shows once. `notificationclick` opens/focuses the app with `?n=<base64 link>`; the open app
  receives a `postMessage` instead. `openNotifLink(link)` routes `screen` → existing openers (`openQuestionThread`,
  `l1OpenSubject`/`l1StartStation`, `openLevel2Subject`/`startLevel2Lesson`, `openSelfieChallenge`, duel join by
  code, `autoJoinRoom`, Bible reading screen, `tournament-live.html`), respecting the `showScreen` lock gate.
- Bell on the home hub: unread badge = items with `createdAt > notifSeenAt`; panel lists the last 30 for
  `audience in [phone, 'all', 'level_<playerLevelOf>']`; opening it sets `notifSeenAt`; tapping an item → `openNotifLink`.
  Foreground `onMessage` shows a toast and bumps the badge.
- `lastBibleDate`: set when a `bibleReadingLog` entry is saved; backfilled from the newest log key on load.
- Invite a teammate: in the duel waiting screen and the compete room lobby, «ادعي حد من فريقك» lists team members
  (`teams.members`, excluding self) → writes `invites`. Existing `compete_invite` handler is replaced by the generic route.
- iPhone in Safari (not installed): notification settings show «ثبّت التطبيق على الشاشة الرئيسية عشان توصلك
  الإشعارات» instead of silently skipping. The soft prompt honours `minElBatal_notifDismissed` (7 days).

## Admin panel (`admin.html`, new `admin-sw.js`)
- `admin-sw.js` (scope `/admin.html`) with firebase-messaging compat; «🔔 فعّل الإشعارات» button in the header
  registers `pushTokens/{token}` (role admin, owner `admin:<me._id>`); logout deletes it. Click opens
  `admin.html#<page>/<id>` → `goPage` (+ `qaOpenThread`).
- Realtime counters: replace the one-time loads with `onSnapshot` for pending `reward_requests` (`fulfilled==false`),
  `admin_requests` (`status=='pending'`), `playerReports` (`status=='pending'`); questions already live. Total unread
  goes in `document.title` (`(3) لوحة التحكم`); a short sound plays when a count rises after the first snapshot.
- Unlock flow (`saveLock` / `toggleLockQuick`): when a `lesson_*`, `subject_*` or `level_*` key goes to unlocked,
  a «📣 إشعار اللاعبين» checkbox (default **off**) appears; when ticked, writes `notifyQueue` with the title from
  `SUBJECTS` and the subject's level (`l1_*` → 1; `l2_*`, `faith`, `ritual` → 2; `level_*` → 0 = all; `card_*` never pushes).

## Error handling
- Functions: per-send failures logged; dead tokens deleted; a failing `notify` never fails the source write. Guard docs
  (`notifySent`, `selfieChallenges.notifiedAt`, tournament `notifiedAt`) make every one-shot push send at most once.
- Client: permission denied / unsupported → bell still works; token write failure logged, retried next login.

## Testing
- `functions/test/notify-logic.test.js` (`node --test`, no new deps): texts per type, level matching (= game's
  `playerLevelOf`), reminder decision table (inactive / Bible gap / both / reminded yesterday / every-2-days cadence /
  new account / prefs off), Cairo date across DST, invite rate limit, token dedupe.
- `tools/check-notifications.js` (vm stubs like the existing checks): `openNotifLink` routing per screen, bell unread
  count, token register/unregister on login/logout.
- Rules: `firebase emulators:exec` script for the four rules (allowed / denied cases) if the emulator runs locally;
  otherwise manual cases listed in the plan.
- Manual after deploy: Android Chrome + iPhone installed PWA — one of each notification type, tap lands on target,
  no duplicate display, logout stops pushes on that device.

## Stages (each deployable alone, in order)
1. Foundation: `notify()`, `notifications` + index + rules, `pushTokens` (+ legacy fallback), logout cleanup, SW
   single display + deep links, bell inbox; announcements, social and the servant-answer push moved onto `notify`.
2. Admins: `admin-sw.js`, admin token button, five admin triggers, realtime counters + title + sound.
3. Player events: lesson/subject/level unlock checkbox + `notifyQueue`, hourly selfie job, tournament trigger.
4. Invites: invite-a-teammate UI, `invites` trigger with team check + rate limit, deep join.
5. Reminders: `lastBibleDate`, daily job replacing the old two, 30-day cleanup.

Deploys (user runs them): `firebase deploy --only firestore:rules,firestore:indexes,functions,hosting`; bump `sw.js`
cache each stage that touches game files.

## Non-goals
Per-admin routing, admin roles for notifications, email/SMS, FCM topics, real Firebase Auth, closing the
`announcements` hole.
