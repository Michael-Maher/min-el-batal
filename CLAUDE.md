# Min El Batal — Project Map for Claude

This file is the orientation doc. Read it first; it should let you skip re-exploring the repo for most tasks.

## What this is
**مين البطل (Min El Batal)** — a Coptic Orthodox Christian education game for Arabic-speaking kids/youth. Mobile-first PWA, hosted on Firebase. Single-language Arabic UI, RTL throughout.

Live: https://min-el-batal.web.app

## Stack
- Vanilla JS — no framework, no build step
- Firebase Hosting + Firestore + Cloud Functions (Node 22, region `europe-west1`)
- Service worker for PWA (`sw.js`)
- Compat-mode Firebase SDK (`firebase.firestore()` style, not modular)

## File map

| File | Purpose | Size |
|---|---|---|
| `index.html` | Player app shell — every screen lives here as `<div class="screen">`, hidden via CSS class `.active`. ~1.6k lines |
| `game.js` | All player game logic. Massive (~22k lines). One global `GameState` object holds all state. |
| `style.css` | All player CSS. Single file, ~14k lines |
| `admin.html` | Single-file admin panel — HTML + CSS + JS. ~7.4k lines. Separate auth from the game (admin accounts in `admins` collection) |
| `tournament.html` / `tournament-live.html` | Tournament admin views ("كاس مين البطل") |
| `firebase.json` | Hosting + Firestore + Functions config. Hosting `public: '.'`. Rewrites all routes to `index.html`, except `/admin.html` |
| `firestore.rules` | All collections currently `allow read, write: if true` — there's no security yet, app trusts the client |
| `functions/index.js` | Cloud Functions (notifications, leaderboard hooks) |
| `manifest.json` / `admin-manifest.json` | PWA manifests |
| `seed_questions.js` / `new_questions.json` / `tournament_questions_seed.json` | One-shot seed scripts/data |

`game.js.bak` is an old backup; ignore.

## Key Firestore collections

| Collection | Purpose |
|---|---|
| `players` | One doc per player, keyed by phone number. Holds **everything** about the player (name, scores, levelsData, lessonSummaries, powerUps, equipped cosmetics, logs, etc.) |
| `leaderboard` | Denormalized rank/score for fast leaderboard queries |
| `blitzLeaderboard` | Weekly Blitz rankings |
| `compete_rooms` | Active multiplayer rooms |
| `compete_rankings` | Weekly competition rankings |
| `duels` | 1v1 duel state |
| `bossBattle` | Shared world boss state |
| `teams` | Team docs with members[], admins[], color, logo |
| `tournaments` + `tournament_questions` | Admin-created tournaments |
| `lessons` | New-lesson notifications (admin pushes) |
| `announcements` | In-app + push announcements |
| `admins` + `admin_requests` | Admin accounts and pending requests |
| `questions` (+ `messages` subcollection) | Player-to-clergy Q&A |
| `gameContent/locks` | **Single doc** holding admin content locks: `{ card_level1: {locked, message}, card_level2: {...}, ... }` |
| `playerEvents` | Audit log (login, lesson_start, etc.) — write-from-game, read-from-admin |
| `playerReports` | Player-on-player reports |
| `reward_requests` | Gift redemption requests |

## GameState (player-side global)
Lives at the top of `game.js`. Loaded from Firestore on login (key = phone), saved back via `saveToCloud()`. Critical fields:
- `playerName`, `playerPhone` (Firestore doc id), `username`, `email`
- `stars`, `gems`, `xp`, `currentLevel`, `bestStreak`, `loginStreak`
- `stationScores` (L2 station progress), `levelsData` (L1), `lessonSummaries` (text/image/audio per lesson)
- `team`, `teamColor`, `teamLogo`, `equippedFrame`, `equippedTitle`, `character`
- `bibleReadingLog`, `devotionLog`, `dailyVerseLog`, `exerciseLog`, `lampData`, `paulJourneyData`
- `powerUps`, `armor`, `ownedFrames`, `ownedTitles`
- `status` ('active'|'suspended'|'blocked'), `statusMessage`, `statusReason`
- `contentLocks` — pulled from `gameContent/locks` via real-time `onSnapshot` set up in `subscribeContentLocks()` (called from `initFirebase()`, NOT from login flows — see fix history)

## Conventions

- **Arabic + RTL.** All user-facing strings are Arabic. Match the existing tone (warm, encouraging, faith-themed).
- **No emojis in code/commits** unless user asks.
- **No build step.** Edit files in place, deploy with `firebase deploy --only hosting`.
- **Firestore rules are open.** Don't rely on rules for anything; treat rules as low priority for now.
- **Mobile-first.** Most users on phones, RTL, often slow networks.
- **One global object.** `GameState`, `level2State`, `competeState` etc. — patterns are global, no modules.
- **Inline event handlers everywhere.** `<div onclick="...">` is normal. Don't refactor unless asked.
- **Function order doesn't matter.** Function declarations are hoisted across the whole file.
- **Screens.** `showScreen(id)` is the navigation primitive — it toggles `.active` on the screen div and runs per-screen render functions in a switch-like block (see ~line 2620).

## Hub cards (home screen)
The home hub (`#home-hub-screen`) has 5 main "hub-card" entries:
1. `card_level1` — "المستوى الأول" (always locked, doesn't exist yet, shows toast on click)
2. `card_level2` — "المستوى الثاني" (the main lessons)
3. `card_compete` — "المنافسات الجماعية"
4. `card_myQuestions` — "اسأل الخدّام" (ask servants)
5. `card_friendsQuestions` — "أسئلة أصحابك" (friends' questions)

Each can be locked by admin via `gameContent/locks`. Lock visuals applied by `applyDashboardLockUI()`. Navigation blocked by a gate at the top of `showScreen()`. **Don't bypass the gate** when adding new screens that should respect locks.

## Admin panel structure (`admin.html`)

- Top-level tabs (suspend/teams/players/locks/announcements/etc.) — managed by `showAdminTab()`.
- **Player modal** has its own sub-tabs handled by `pmTab(n)`:
  - 0 ✏️ تعديل (`renderEditTab`)
  - 1 📚 الدروس (`renderLessonsTab`)
  - 2 ⭐ النقاط (`renderPointsTab`)
  - 3 🙏 الروحية (`renderSpiritualTab`)
  - 4 🎒 المخزن (`renderInventoryTab`)
  - 5 📅 النشاط (`renderActivityTab`)
  - 6 📊 تلخيص (`renderSummaryTab` — analytics)
  - 7 ✍️ ملخصات (`renderLessonSummariesTab` — full text/image/audio summaries)
- Helpers: `_sec(title, icon, html)`, `_dgi(label, value, color?)`, `esc(str)`.
- Locks UI: `renderLocks()` near line 3900, save via `saveLock()` and `toggleLockQuick()`.
- Auth: admin email/phone in `admins` collection. Approval flow uses `admin_requests`.

## Recent work / things to know

- **Content lock system** (`gameContent/locks`): admin can lock hub cards. Game subscribes once at Firebase init (not at login) so all login paths receive locks. See `subscribeContentLocks()` and `applyDashboardLockUI()`. Navigation gated in `showScreen()`.
- **Lesson summaries**: players can submit text + image + audio per lesson. Stored as base64 data URLs in `players/{phone}.lessonSummaries[subject_lessonIdx]`. Admin sees them in tab 7 of player modal.
- **Suspend / block**: `status` field on player doc. Game shows blocking overlay via `showSuspendedScreen()`.
- **Per-team-per-player rule** is enforced in `admin.html` team management.
- **Tournaments** are a separate admin surface (`tournament.html`).

## How to deploy

```bash
firebase deploy --only hosting       # most common — game/admin updates
firebase deploy --only firestore:rules
firebase deploy --only functions
```

The user generally runs deploys themselves. Don't deploy without being asked.

## How to find things fast

- "Where is X feature?" — `grep -n "function rename\|onclick.*X\|showScreen.*X" game.js`
- "Where is data stored?" — check Firestore collections list above + GameState fields
- "What does the home hub render?" — `renderHomeHub()` ~line 9482
- "How do I add a new screen?" — add `<div id="X-screen" class="screen">` to index.html, add a render function, add a case in `showScreen()`'s switch block. If it should be lockable, add to `_LOCK_GATE` map at top of `showScreen()`.

## What NOT to do without asking

- Don't bulk-refactor anything in `game.js`. It's working production code.
- Don't introduce a build step / framework / TypeScript / npm dependencies for the player app.
- Don't change Firestore rules (they're intentionally open for now).
- Don't delete or move `game.js.bak` etc. without asking.
- Don't touch tournament files unless explicitly working on tournaments.

## Active feature branches

- `feature/social-feed` — mini social media feed (admin posts + auto-celebrations + reactions + comments). See `SOCIAL_FEED.md` for the live spec/checklist.
