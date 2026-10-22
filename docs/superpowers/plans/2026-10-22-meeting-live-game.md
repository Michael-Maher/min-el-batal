# Monday Meeting Live Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A presenter-mode live game for the Monday meeting: the host runs it from a control window on the laptop, the kids watch an audience window on the projector, and every point the host gives is added as stars to the kid's real account.

**Architecture:** `meeting.html` is one page with two views. The default view is control; `?view=screen` is the audience. The control window owns all state. That state is a plain "night" object in `localStorage`, changed only through pure functions in `meeting-core.js`. The control sends an audience-safe projection of it to the screen window over `BroadcastChannel`, so the screen window never touches Firestore. Firestore work (loading the roster, season-safe idempotent star awards, no-repeat history, audit log) lives in `meeting-cloud.js`. New content lives in the data file `meeting-bank.js`.

**Tech Stack:** Vanilla JS (ES5 style like the rest of the repo, globals, no modules), Firebase compat SDK 10.8.0 (Firestore only), Web Audio, BroadcastChannel. Node `vm` checks in `tools/`.

**Spec:** `docs/superpowers/specs/2026-10-22-meeting-live-game-design.md`

## Global Constraints

- No build step, no npm dependencies for browser code, no frameworks. Arabic RTL UI (`<html lang="ar" dir="rtl">`).
- Do not change `firestore.rules`, `game.js`, `tournament.html`, `tournament-live.html`, `sw.js`, `firebase.json`.
- Collections touched: read `leaderboard`, `teams`, `gameContent/season`; read/write `players`, `leaderboard`, `gameContent/meetingHistory`; add-only `playerEvents`.
- Every item is worth 5 points = 5 stars (`MT_POINTS = 5`). Golden question 15. Wheel «دبل» makes the next award 10.
- Wheel steal and bets change the on-screen night score only. Real stars change only through a host award, «−٥», or «تراجع».
- Team stars go to every kid on that team's roster tonight. They never go to absent members of a game team.
- Content: Egyptian colloquial Arabic, Coptic Orthodox, from the lesson files. Every item has `explain` with a Bible reference where there is one. Deuterocanonical books are never called "apocrypha".
- Before the host presses «اعرض», the audience view never contains an answer, `explain`, `correct`, a secret word, or a forbidden word.
- No emojis in code comments or commits. Emojis in UI copy and content are fine; the game uses them.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Old-season kid.** A kid who hasn't opened the game since the last season reset gets an award. Expected: the stars survive. Otherwise their next login zeroes them (`_ensurePointsSeason`, `game.js:573`). Pinned in Task 3.
2. **Lost transaction ack.** The network drops mid-night, or a transaction commits but the ack is lost, then the queue retries. Expected: the award applies exactly once. Pinned in Task 3 (idempotency key).
3. **Screen window opened late or reloaded.** Expected: it shows the current state and never the answer. Pinned in Task 1 (`mtAudienceView` per stage) and Tasks 7-8 (hello/reply).
4. **Control page refreshed mid-night.** Expected: everything comes back, including awards not yet synced, which still sync. Pinned in Task 1 (restore) and Task 3 (flush after restore).
5. **Same or variant names.** Two kids named «مينا», or spelling variants (أ/ا, ة/ه, ى/ي, tashkeel). Expected: search finds all of them, and each result shows level and team so the host can tell them apart. Pinned in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `meeting-core.js` (new) | Pure logic: night state, teams/roster, awards/undo, audience projection, item pool + picker, search, random pick, kinds catalog. No DOM, no Firestore. |
| `meeting-cloud.js` (new) | Firestore: roster load, season-safe idempotent award transaction, pending queue flush, history, audit log. |
| `meeting-bank.js` (new) | `MEETING_BANK` data array only. |
| `meeting.html` (new) | Markup + CSS for both views, script tags, Firebase init, view switch. |
| `meeting-screen.js` (new) | Audience renderer: renders a view, plays fx (award pop, reveal, wheel, podium), sounds, confetti. |
| `meeting-control.js` (new) | Control UI: auth gate, setup, roster/teams, play flow, award panel, surprises, end night, sync status. |
| `admin.html` (modify) | Launcher page + `meeting` perm, `meeting_award` audit label, «نجوم الاجتماع» in the activity tab. |
| `tools/check-meeting.js` (new) | vm checks for `meeting-core.js` and `meeting-cloud.js` (stub db). |
| `tools/check-meeting-bank.js` (new) | Schema and count checks for `meeting-bank.js`. |
| `tools/seed-meeting-emu.js` (new) | Seeds the Firestore emulator with test players/teams/season for manual runs. |

Script order in `meeting.html`: firebase-app-compat, firebase-firestore-compat, `level1-bible-data.js`, `level1-service-data.js`, `level2-life-data.js`, `level2-bible-data.js`, `level1.js`, `compete-bank.js`, `meeting-bank.js`, `meeting-core.js`, `meeting-cloud.js`, then `meeting-screen.js` + `meeting-control.js`. `level1.js` has two top-level side effects, both harmless here: a `resize` listener and the `l2BuildShims` IIFE. Task 2 verifies they don't throw without `game.js`; if one does, stub the missing global in `meeting.html` before the script. `compete-bank.js` calls `GameState` only inside `competePickQuestions`, which this feature does not call.

---

### Task 1: Night state, teams, awards, audience projection (`meeting-core.js`)

**Files:**
- Create: `meeting-core.js`
- Test: `tools/check-meeting.js`

**Interfaces:**
- Produces (globals):
  - `MT_POINTS = 5`, `MT_GOLDEN_POINTS = 15`, `MT_STORAGE_KEY = 'meb_meeting_night'`
  - `MT_TEAM_PRESETS`: 6 entries `{id, name, color, icon}`, in this order: `david` «فريق داود» #e74c3c 🦁, `moses` «فريق موسى» #3498db 🌊, `joseph` «فريق يوسف» #1f9d55 🌾, `daniel` «فريق دانيال» #e0a800 🔥, `esther` «فريق أستير» #9b59b6 👑, `paul` «فريق بولس» #e67e22 ⚓
  - `mtNewNight(opts) -> Night`. `opts = {date:'YYYY-MM-DD', title, levels:[1]|[2]|[1,2], filter:{subjects:[], lessons:{key:[idx]}}, kinds:[kindId]}`
  - Night shape: `{v:1, date, title, levels, filter, kinds, teams:[Team], roster:{phone:Kid}, current:null|Current, awards:[Award], usedTonight:[itemId], skipped:[itemId], multiplier:1, lastKind:null, excluded:[phone]}`
  - `Team = {id, name, color, icon, source:'random'|'game', gameTeam:''|name, score:0}`
  - `Kid = {phone, name, level:1|2, teamId:null|id, stars:0}`
  - `Award = {id, ts, kind:'individual'|'team'|'undo', phones:[...], teamId:null|id, points, itemId:null|id, refId:null|id, synced:{phone:true}}`
  - `Current = {item, target:{level:1|2|'all', mode:'individual'|'speed'|'team', teamId:null|id}, stage:'preview'|'shown'|'revealed', clueIdx:0, optionsShown:0, timerEndsAt:0, timerSec, golden:false, count:0}`
  - `mtMakeRandomTeams(night, count)` (count is clamped to 2..6, and the teams are appended from the presets not already used), `mtAddGameTeam(night, {name, color, logo}) -> Team`
  - `mtAddToRoster(night, {phone, name, level, team}, teamId?) -> Kid`. A kid with no `teamId` given whose `team` matches a game team's `gameTeam` is placed on it.
  - `mtSetTeam(night, phone, teamId|null)`, `mtRemoveFromRoster(night, phone)`
  - `mtPointsForCurrent(night) -> number`: 15 if `current.golden`, else `MT_POINTS * night.multiplier`
  - `mtAward(night, {phone}|{teamId}, points, itemId) -> Award`. Individual: `kid.stars += points`, and the kid's team score `+= points` if the kid has a team. Team: `team.score += points`, and every roster kid with that `teamId` gets `stars += points`. Resets `night.multiplier` to 1 after a positive award.
  - `mtUndoLast(night) -> Award|null`: reverses the last non-undo award not already undone. It appends a `kind:'undo'` award with negated points, the same phones, and `refId`. Team scores are reversed the same way.
  - `mtScreenScore(night, teamId, delta)`: team score only (wheel steal, bets).
  - `mtStandings(night) -> [Team]` sorted by score desc; `mtTopKids(night, n) -> [Kid]` sorted by stars desc.
  - `mtPendingSyncs(night) -> [{awardId, phone, points}]`: every award phone not in `synced`, oldest first.
  - `mtAudienceView(night) -> View`. The plain JSON the screen renders: `{title, teams:[{id,name,color,icon,score}], leaderId, item:null|ItemView, stage, target, timerEndsAt, timerSec, golden}`.
  - `mtSerialize(night) -> string`, `mtRestore(str) -> Night|null` (null on bad JSON or `v !== 1`)

- [ ] **Step 1: Write failing tests in `tools/check-meeting.js`**

Use the `test(name, fn)` / pass-fail counter style of `tools/check-season-reset.js`. Load `meeting-core.js` into a `vm` context with `{console, Math, Date, JSON}`. Tests:
- `teams: 4 random teams use the first 4 presets`: `mtMakeRandomTeams(n,4)` gives ids `['david','moses','joseph','daniel']`. A later `mtMakeRandomTeams(n,1)` adds one more, `esther`. `count 9` is clamped so the total never exceeds 6.
- `roster: game-team kid auto-placed`: with `mtAddGameTeam(n,{name:'مارمرقس',color:'#111',logo:'⚔️'})`, calling `mtAddToRoster(n,{phone:'01',name:'مينا',level:1,team:'مارمرقس'})` puts the kid on that team.
- `award individual`: on a kid on team `david`, `mtAward(n,{phone:'01'},5,'x')` → kid.stars 5, david.score 5, award.phones `['01']`.
- `award team goes to roster members only`: david has kids 01, 02, and 03 is on moses. `mtAward(n,{teamId:'david'},5)` → 01 and 02 have stars 5, 03 has 0, david.score 5.
- `multiplier`: `n.multiplier=2` → `mtPointsForCurrent` 10. After a positive award, multiplier is 1. With `current.golden` true, `mtPointsForCurrent` is 15.
- `undo reverses team award`: after the team award above, `mtUndoLast` → 01 and 02 have stars 0, david.score 0, the last award has kind `undo` and points -5. A second `mtUndoLast` undoes the award before it, not the undo.
- `screen score never touches stars`: `mtScreenScore(n,'david',-5)` → david.score -5, all kid stars unchanged.
- `pending syncs`: two awards, the first with `synced['01']=true` → `mtPendingSyncs` lists only the unsynced phones, oldest first.
- `restore round-trip`: `mtRestore(mtSerialize(n))` deep-equals n. `mtRestore('{"v":2}')` is null, and `mtRestore('nope')` is null.
- `audience view hides answers`: for each fixture item of kinds `mcq, tf, clues, verse, scenario, order, emoji, anagram, odd, deep, sixty, act, draw, taboo, hymn` (fixtures defined in the test with distinctive answer strings such as `'ANS_mcq'`), at stage `preview`: `mtAudienceView(n).item === null`. At stage `shown`: `JSON.stringify(view)` contains none of the item's `answer`, `explain`, `secret`, or `forbidden` strings, nor any `correct` key. At stage `revealed`: the view contains `answer`.
- `audience view clues`: stage `shown`, `clueIdx 1` → the view shows clues[0..1] only.
- `audience view options`: `optionsShown 2` → the view has the first 2 options only.

- [ ] **Step 2: Run, expect failure**

Run: `node tools/check-meeting.js`
Expected: FAIL (file `meeting-core.js` missing / functions undefined), exit 1.

- [ ] **Step 3: Implement the Task 1 interfaces in `meeting-core.js`**

ItemView by kind (only what is on screen):
- `mcq/scenario/verse`: `{kind, prompt, options:first optionsShown}`
- `tf`: `{kind, prompt}`
- `clues`: `{kind, clues:clues.slice(0, clueIdx+1)}`
- `order`: `{kind, prompt, steps: item.shuffled}` (the shuffled order is stored on the item when picked)
- `emoji`: `{kind, prompt}`
- `anagram`: `{kind, scrambled}`
- `odd`: `{kind, items}`
- `deep`: `{kind, prompt}`
- `sixty`: `{kind, prompt, count}`
- `hymn`: `{kind, firstLine}`
- `act/draw/taboo`: `{kind}` only; the screen shows the fixed segment text.

At `revealed`, add `answer`, `explain`, and the kind's solution (`correct` index, `odd` index, ordered `steps`, `list`).

- [ ] **Step 4: Run, expect pass**

Run: `node tools/check-meeting.js`
Expected: all tests pass, exit 0.

- [ ] **Step 5: Commit**

```bash
git add meeting-core.js tools/check-meeting.js
git commit -m "Meeting game: night state, awards and audience projection"
```

---

### Task 2: Item pool, picker, search, random pick (`meeting-core.js`)

**Files:**
- Modify: `meeting-core.js`
- Test: `tools/check-meeting.js`

**Interfaces:**
- Consumes: Task 1 night shape. From `compete-bank.js`: `competeBankFor(filter)`, `COMPETE_SUBJECTS[].level`. From `meeting-bank.js`: `MEETING_BANK` (shape in Task 4).
- Produces:
  - `MT_KINDS`: the kind catalog `{id: {label, timer, bank:true|false}}` with exactly these ids, labels and default timers (seconds):
    `mcq` «سؤال اختيار» 30, `tf` «قوم ولا اقعد» 15, `clues` «مين أنا؟» 45, `verse` «كمّل الآية» 30, `scenario` «موقف… تعمل إيه؟» 45, `order` «رتّب الأحداث» 45, `emoji` «القصة بالإيموجي» 30, `anagram` «الحروف المتلخبطة» 30, `odd` «مين الغريب؟» 30, `deep` «سؤال عميق» 90, `sixty` «٦٠ ثانية» 60, `act` «مثّلها من غير كلام» 45, `draw` «ارسمها» 60, `taboo` «الكلمة الممنوعة» 60, `hymn` «كمّل اللحن / الترنيمة» 30
  - `mtTimerFor(kind, mode) -> sec`: the default; for mode `speed`, `max(10, round(default/2))`.
  - `mtBuildPool(filter, levels) -> [Item]`. It combines the compete-bank items for the filter, mapped to `{id:'cb_'+mtHash(subject+'|'+lesson+'|'+q), level, subject, station:lesson, kind, prompt:q, options, correct, clues?, answer:options[correct] (clues: answer), explain}`, with the `MEETING_BANK` items whose `level` is in `levels` and that either have `station === null` or whose `subject` and `station` are in the filter. An empty `filter.lessons[key]` means all stations of that subject.
  - `mtHash(str) -> 8-char hex` (FNV-1a 32-bit).
  - `mtScramble(word, rng) -> string`: letters shuffled with spaces removed; never equal to the input when the word has 2+ distinct letters.
  - `mtAvailableKinds(pool, night) -> [kindId]`: the kinds in `night.kinds` that have at least one item at a level in `night.levels`.
  - `mtPickNext(pool, night, {level, kind}, history, rng) -> Item|null`. `history = {itemId:'YYYY-MM-DD'}`. Level: `1` or `2` match `item.level`. `'all'` means level-1 items if the night includes level 1, else level 2. `kind` null means a random kind from `mtAvailableKinds`, other than `night.lastKind` when another kind is possible. Exclude `usedTonight` and `skipped`. Order of preference: (a) station items never in history, (b) fallback items (`station===null`) never in history, (c) any item, oldest history date first. A random choice within the tier. It prepares per-kind fields: shuffled `options` keeping `correct`, `order.shuffled`, `anagram.scrambled`.
  - `mtNormalize(s) -> string`: trim, lower; أ إ آ ٱ → ا; ة → ه; ى → ي; ؤ → و; ئ → ي; remove tashkeel `[ً-ْـ]`; collapse spaces.
  - `mtSearch(players, query, limit=8) -> [player]`: requires 2+ normalized chars. A match is a name word starting with the query, or a phone containing it. Name-start matches come first; a stable order otherwise.
  - `mtRandomPick(night, players, level, rng) -> player|null`: candidates are roster kids at `level` (or any level for `'all'`) not in `night.excluded`. If there are fewer than 3, use all `players` at that level not excluded. Returns null if none.

- [ ] **Step 1: Write failing tests** (add to `tools/check-meeting.js`; load `meeting-core.js` with a stub `competeBankFor`, a stub `COMPETE_SUBJECTS`, and a small `MEETING_BANK` fixture; `rng` is a seeded LCG defined in the test)
- `pool filters by level and station`: the fixture has L1 s0, L1 s2, L1 null, and L2 s0 items. With filter `{subjects:['l1_bible'], lessons:{l1_bible:[0]}}` and levels `[1]`, the pool has L1 s0 and L1 null, and not s2 or L2.
- `pick prefers lesson, then fallback, then oldest`: with an unused station item available, it is picked. After it is in history, the fallback is picked. After both are in history (station `2026-10-01`, fallback `2026-09-01`), the fallback is picked as the oldest.
- `pick skips usedTonight and skipped`.
- `pick 'all' uses level 1 when night has level 1`.
- `kind null avoids lastKind`: when 2 kinds are available, 20 picks with `lastKind` set never return that kind.
- `available kinds hides empty`: `mtAvailableKinds` omits `hymn` when no `hymn` item is at the night's levels.
- `scramble differs`: `mtScramble('أثناسيوس', rng) !== 'أثناسيوس'`, and the sorted letters are equal.
- `options shuffle keeps answer`: for a picked mcq, `options[correct] === answer`.
- `normalize variants`: `mtNormalize('أحمد') === mtNormalize('احمد')`, `mtNormalize('مريمة') === mtNormalize('مريمه')`, `mtNormalize('مُنى') === mtNormalize('مني')`.
- `search finds same-name kids`: players `مينا عادل`, `مينا سمير`, `أمير مينا` → query `مين` returns both «مينا…» first, then «أمير مينا». A 1-char query returns `[]`.
- `random pick uses roster first, then all, never excluded`.
- `bank deps load standalone`: in a fresh vm context with `window`/`document` stubs (`addEventListener` no-op), run `level1-bible-data.js`, `level1-service-data.js`, `level2-life-data.js`, `level2-bible-data.js`, `level1.js`, `compete-bank.js`, `meeting-core.js` in order. Assert no throw, and that `mtBuildPool({subjects:['l1_bible','l2_bible'],lessons:{}},[1,2]).length > 50`.

- [ ] **Step 2: Run, expect the new tests to fail** — `node tools/check-meeting.js`, exit 1.
- [ ] **Step 3: Implement the Task 2 interfaces in `meeting-core.js`.** If `bank deps load standalone` throws on a missing global, add the smallest stub for it to `meeting.html`'s inline script (Task 7) and mirror it in the test context. Do not edit `level1.js`.
- [ ] **Step 4: Run, expect pass** — `node tools/check-meeting.js`, exit 0.
- [ ] **Step 5: Commit** — `git add meeting-core.js tools/check-meeting.js && git commit -m "Meeting game: item pool, picker, search and random pick"`

---

### Task 3: Firestore layer (`meeting-cloud.js`)

**Files:**
- Create: `meeting-cloud.js`
- Test: `tools/check-meeting.js`

**Interfaces:**
- Consumes: Task 1 `Award`, `mtPendingSyncs`; `firebase.firestore.FieldValue` (stubbed in tests).
- Produces:
  - `MC_SEASON_FIELDS`: must equal `game.js` `SCORE_SEASON_FIELDS` (asserted by a test that reads `game.js` source).
  - `mcLoadPlayers(db) -> Promise<[{phone, name, level, team, character}]>`: reads the whole `leaderboard` collection (not `players`, whose docs are heavy). `level = playerLevel === 2 ? 2 : 1`, `name = playerName`, `phone = doc id`. Skips docs with no name.
  - `mcLoadTeams(db) -> Promise<[{name, color, logo, level}]>` from `teams`.
  - `mcLoadSeason(db) -> Promise<season|null>` from `gameContent/season`.
  - `mcApplyAward(db, {key, phone, points, date, season}) -> Promise<'applied'|'duplicate'>`. One `db.runTransaction`:
    - Read `players/{phone}` and `leaderboard/{phone}`. A missing player rejects with `Error('no-player')`.
    - Idempotency: if `(doc.meetingAwardKeys || []).indexOf(key) >= 0`, return `'duplicate'`, no write.
    - Stale season: `season && season.id && doc.scoreSeasonId !== season.id` and the joined time (`createdAt`, parsed like `game.js` `_seasonMs`) is before the season's `startedAt`. In that case the write also sets every `MC_SEASON_FIELDS` field to 0, `scoreSeasonId: season.id`, and `'season.startStars': 0` when `doc.season` exists, and the base stars become 0.
    - `newStars = max(0, base + points)`.
    - Player update: `{stars:newStars, ['meetingLog.'+date]: (log[date]||0)+points, meetingAwardKeys: last 40 keys incl. key, syncId:<random base36>, lastUpdated:new Date().toISOString()}` (+ the stale-season fields).
    - If the leaderboard doc exists, update it with `{stars:newStars}`, plus the zeroed season fields that exist on it when stale. Don't create it.
    - Award key = `award.id + '_' + phone`.
  - `mcFlush(db, night, ctx) -> Promise<{applied, failed}>`. `ctx = {season, save(), onChange()}`. Runs `mtPendingSyncs` one at a time through `mcApplyAward`. On `'applied'` or `'duplicate'`, it sets `award.synced[phone]=true`, then calls `save()` and `onChange()`. On `no-player`, it also marks synced and records `award.failed=[phones]`; the control shows these. On any other error, it stops, leaves the rest pending and resolves. Only one flush runs at a time (a module-level promise guard).
  - `mcLoadHistory(db) -> Promise<{itemId:date}>` from `gameContent/meetingHistory.used` (`{}` if missing).
  - `mcRecordUsed(db, itemId, date) -> Promise`: `set({used:{[itemId]:date}}, {merge:true})`.
  - `mcLogAward(db, award, {adminPhone, adminName, teamName, kidName, segment, date}) -> Promise`: `playerEvents.add({playerPhone: individual ? phone : '', playerName: individual ? kidName : teamName, team: teamName||'', type:'meeting_award', data:{points, reason: award.kind, recipients: award.phones, segment, itemId, teamName, admin: adminName, nightDate: date}, ts: Date.now(), timestamp: serverTimestamp()})`. Errors are swallowed.

- [ ] **Step 1: Write failing tests** with an in-memory stub db. `collection(c).doc(id)` returns refs. `runTransaction(fn)` runs `fn(tx)`, where `tx.get(ref)` returns `{exists, data()}` and `tx.update(ref, data)` applies dotted paths. The stub has a switch for "commit applies but the promise rejects" to simulate a lost ack. Tests:
- `season fields match game.js`.
- `award increments stars and log`: stars 100 → `points 5` → 105, `meetingLog['2026-10-26']` 5, `syncId` changed, `meetingAwardKeys` contains the key, leaderboard stars 105.
- `negative never below zero`: stars 3, points -5 → 0.
- `missing leaderboard not created`.
- `old-season kid keeps the award`: `scoreSeasonId 'old'`, `createdAt 2026-01-01`, season `{id:'s2', startedAt:'2026-10-11'}`, stars 900, gems 40 → stars 5, gems 0, `scoreSeasonId 's2'`.
- `joined after season start: plain increment`: `scoreSeasonId ''` and `createdAt` after `startedAt` → stars `base + 5`, season fields untouched.
- `same key twice applies once`: the second call returns `'duplicate'` and stars are unchanged.
- `lost ack then retry applies once`: the first `mcFlush` hits a commit that applied but rejected → the award stays pending. A second `mcFlush` → `'duplicate'`, marks it synced, and stars went up exactly 5 overall.
- `flush stops on network error and resumes`: the stub throws `unavailable` for the 2nd phone → the 1st is synced and the 2nd and 3rd are pending. With the stub healthy, flush syncs both.
- `flush after restore`: `mtRestore(mtSerialize(night))` with pending awards → `mcFlush` syncs them.
- `no-player marked failed, not retried forever`.
- `meetingAwardKeys capped at 40`.

- [ ] **Step 2: Run, expect failure** — `node tools/check-meeting.js`, exit 1.
- [ ] **Step 3: Implement the Task 3 interfaces in `meeting-cloud.js`.**
- [ ] **Step 4: Run, expect pass** — `node tools/check-meeting.js`, exit 0.
- [ ] **Step 5: Commit** — `git add meeting-cloud.js tools/check-meeting.js && git commit -m "Meeting game: season-safe idempotent star awards and history"`

---

### Task 4: Content schema check + Level 1 Bible content (`meeting-bank.js`)

**Files:**
- Create: `meeting-bank.js`, `tools/check-meeting-bank.js`

**Interfaces:**
- Produces: `var MEETING_BANK = [Item, ...]`. Item fields:
  - Common: `id` (regex `^mb_(l1b|l2b)_(s\d|gen)_[a-z]+_\d{2}$`, unique), `level` 1|2, `subject` `'l1_bible'|'l2_bible'`, `station` int|null (null iff the id has `gen`), `kind` (a key of `MT_KINDS`), `explain` (non-empty), `difficulty` 1|2|3.
  - Per kind:
    - `mcq/scenario/verse`: `prompt`, `options` (2–4 non-empty), `correct` (a valid index)
    - `tf`: `prompt`, `answer` `'صح'|'غلط'`
    - `clues`: `clues` (3–5), `answer`
    - `order`: `prompt`, `steps` (exactly 4, in correct order)
    - `emoji`: `prompt` (contains an emoji), `answer`
    - `anagram`: `answer` (2+ distinct letters, at most 14 letters)
    - `odd`: `items` (exactly 4), `odd` (index 0–3), `answer` (the odd one, equal to `items[odd]`)
    - `deep`: `prompt`, `answer`
    - `sixty`: `prompt`, `list` (6+), `answer` (summary line)
    - `act/draw`: `secret`
    - `taboo`: `secret`, `forbidden` (exactly 3)
    - `hymn`: `firstLine`, `answer`
  - For `tf` items, `mtBuildPool` (Task 2) maps them to `options:['صح','غلط']` with `correct` from `answer`, and for `act/draw/taboo` to `answer = secret`. Add that mapping in `meeting-core.js` in this task if Task 2 did not, and add a test for it.

Content rules for this task (L1 Bible, stations 0–5 of `level1-bible-data.js`: intro, creation, patriarchs, exodus, judges, kingdom):
- Read each station's `cards` and `games` first. Write from what the lesson teaches. Don't copy existing `check`/arcade questions; those already come in through the compete bank.
- Per station, at least: 2 `verse` (L1 has none in the bank), 2 `scenario` (L1 has none), 2 `order`, 2 `emoji`, 2 `anagram`, 2 `odd`, 3 `deep`, 2 `sixty`, 2 `act`, 2 `draw`, 2 `taboo`, plus `hymn` only where a well-known church hymn or alhan line truly fits the station (0 is fine). That is at least 23 per station.
- `deep` items are "why/what does it mean for me" questions, with the church's answer in `answer` and a reference in `explain`.
- Difficulty mix per station: at least one item at each of 1, 2 and 3.
- L1 age: kids in primary/prep stage. Use short sentences and well-known names.

`tools/check-meeting-bank.js`: load `meeting-bank.js` and `meeting-core.js` (for `MT_KINDS`) in vm and validate every rule above (schema per kind, id regex/uniqueness, station/id consistency, odd answer matches). Check the counts per station: each L1 station has 23+ items and at least the per-kind minimums. Print a count table and exit 1 on any failure.

- [ ] **Step 1: Write `tools/check-meeting-bank.js`** with the rules and the L1 count minimums (and L2 and `gen` minimums from Tasks 5–6 behind a `--level` flag that defaults to checking everything present).
- [ ] **Step 2: Run on an empty `MEETING_BANK = []`** — `node tools/check-meeting-bank.js --level 1`. Expected: FAIL listing the missing L1 counts.
- [ ] **Step 3: Write the L1 items into `meeting-bank.js`.**
- [ ] **Step 4: Run** — `node tools/check-meeting-bank.js --level 1` exit 0, and `node tools/check-meeting.js` exit 0.
- [ ] **Step 5: Commit** — `git add meeting-bank.js meeting-core.js tools/check-meeting-bank.js tools/check-meeting.js && git commit -m "Meeting game: Level 1 Bible content"`

---

### Task 5: Level 2 Bible content (`meeting-bank.js`)

**Files:**
- Modify: `meeting-bank.js`, `tools/check-meeting-bank.js` (L2 minimums)

**Interfaces:** Consumes the Task 4 schema.

Stations 0–7 of `level2-bible-data.js`: deuterocanonical books, study methods, catholic epistles intro, James 1–5. These are mostly teaching, not stories, so the minimums differ:
- Per station, at least: 3 `mcq`, 2 `tf`, 2 `clues`, 2 `verse`, 2 `scenario`, 2 `odd`, 2 `anagram`, 4 `deep`, 2 `sixty`, 2 `taboo`. `order`/`emoji`/`act`/`draw` go in only where the station has events or images that fit (e.g. Tobit, Judith, Maccabees in station 0; the James chapters' images: the mirror, the bridle, the ship's rudder, the fire). That is at least 23 per station.
- `deep` items lean on application (James is practical faith).
- Deuterocanonical: "القانونية الثانية", never "أبوكريفا" except when explaining why the church rejects that label, as the lesson does.

- [ ] **Step 1: Add the L2 minimums to the check; run** `node tools/check-meeting-bank.js --level 2`. Expected: FAIL.
- [ ] **Step 2: Write the L2 items.**
- [ ] **Step 3: Run** — `node tools/check-meeting-bank.js --level 2` exit 0.
- [ ] **Step 4: Commit** — `git add meeting-bank.js tools/check-meeting-bank.js && git commit -m "Meeting game: Level 2 Bible content"`

---

### Task 6: Fallback pools (`meeting-bank.js`)

**Files:**
- Modify: `meeting-bank.js`, `tools/check-meeting-bank.js` (`gen` minimums)

Items with `station: null` and an id containing `_gen_`, per level (`subject` = that level's Bible key), from well-known Bible stories suitable for the age, not tied to a lesson. Per level, at least: 6 `emoji`, 6 `act`, 6 `draw`, 6 `taboo`, 4 `order`, 6 `anagram`, 6 `hymn` (well-known church hymns/alhan first lines everyone knows, e.g. from the Midnight Praise or common Sunday-school hymns). Keep L1 fallback stories simpler than L2.

- [ ] **Step 1: Add the `gen` minimums; run** `node tools/check-meeting-bank.js`. Expected: FAIL on `gen`.
- [ ] **Step 2: Write the items.**
- [ ] **Step 3: Run** — `node tools/check-meeting-bank.js` exit 0, `node tools/check-meeting.js` exit 0.
- [ ] **Step 4: Commit** — `git add meeting-bank.js tools/check-meeting-bank.js && git commit -m "Meeting game: fallback story pools"`

---

### Task 7: Page shell + audience screen (`meeting.html`, `meeting-screen.js`)

**Files:**
- Create: `meeting.html`, `meeting-screen.js`

**Interfaces:**
- Consumes: Task 1 `View` and ItemView; `MT_KINDS` labels.
- Produces:
  - Channel name `'meb-meeting'`. Messages: control→screen `{t:'view', view}` and `{t:'fx', fx}`; screen→control `{t:'hello'}`, sent on load and every 3 s until the first `view` arrives.
  - `fx` types: `{type:'award', name, teamName, teamColor, points}`; `{type:'teamAward', teamName, teamColor, points}`; `{type:'reveal'}`; `{type:'wheel', outcomes:[label], index}`; `{type:'bet', teamName, amount}`; `{type:'golden'}`; `{type:'podium', kids:[{name, stars}], team:{name, color, score}}`; `{type:'sound', on:bool}`.
  - `msRender(view)` and `msFx(fx)` in `meeting-screen.js`. Only one shows at a time; a new view or fx replaces the current animation without a pile-up.
- `meeting.html`:
  - RTL, Cairo/Tajawal font like the game, projector-sized type (the item text is at least 5vw, readable from the back of a hall), high contrast, dark stage background in the style of `tournament-live.html`.
  - It reads `?view=screen`. If set, it runs only the screen: no Firebase, no admin check.
  - Otherwise it runs the control with Firebase (config copied from `admin.html`). `?emu=PORT` calls `db.useEmulator('localhost', PORT)`, for manual testing.
- Screen layout:
  - Segment tag (kind label + «مستوى أول/تاني/الكل», «🏅 السؤال الدهبي» when golden)
  - Timer ring computed from `timerEndsAt`
  - Item area per ItemView kind:
    - clues stack
    - options appearing
    - big emoji
    - scrambled letter tiles
    - 4 odd cards
    - shuffled order cards
    - sixty counter
    - hymn first line
    - act/draw/taboo fixed text («واحد من الفريق ييجي يشوف الكلمة على اللابتوب 👀»)
  - Reveal animation highlights the answer and shows `explain`
  - Team strip along the bottom, with a crown on `leaderId`
  - Idle screen (no item) with the night title and team strip
- fx:
  - The award pop is big: the name, «⭐ +٥», and the team color. It lasts about 2.5 s, with a short sound.
  - Team award: a full-width flash in the team color.
  - Wheel: a spin that lands on `index`.
  - Podium: 3 steps with confetti (canvas, like `tournament-live.html` `fireConfetti`).
  - Sounds: Web Audio tones (correct, reveal, tick in the last 5 s, wheel, fanfare), muted by `{type:'sound',on:false}`.
  - A «ملء الشاشة» button that hides itself after it's used.

- [ ] **Step 1: Build `meeting.html` (both shells) and `meeting-screen.js`.**
- [ ] **Step 2: Check it manually.** Start `game-server` from `.claude/launch.json` with `preview_start`. Open `/meeting.html?view=screen`. From the browser console, post fixture views/fx on `new BroadcastChannel('meb-meeting')` for every kind at stages `shown` and `revealed`, plus each fx type. Screenshot each. Check the console has no errors, and that the page sends `hello`.
- [ ] **Step 3: Commit** — `git add meeting.html meeting-screen.js && git commit -m "Meeting game: page shell and audience screen"`

---

### Task 8: Control window (`meeting-control.js`)

**Files:**
- Create: `meeting-control.js`
- Modify: `meeting.html` (control markup/CSS)

**Interfaces:**
- Consumes: everything from Tasks 1–3 and 7.
- Behavior (all strings Arabic):
  - **Auth gate.** Read `localStorage['minElBatal_adminSession']`. It is valid if `expires > Date.now()` and (`role === 'superadmin'` or `perms === null` or `perms.meeting === true`). Otherwise show «لازم تدخل من لوحة الأدمن الأول» with a link to `/admin.html`, and nothing else.
  - **Boot.** In parallel: `mcLoadPlayers`, `mcLoadTeams`, `mcLoadSeason`, `mcLoadHistory`. If `localStorage[MT_STORAGE_KEY]` restores, ask «تكمّل السهرة اللي فاتت؟» (كمّل / سهرة جديدة).
  - **Setup.**
    - Title (default «مسابقة الاجتماع»), date (today, Cairo).
    - Level chips. Subject + lesson checkboxes from `COMPETE_SUBJECTS` filtered by the chosen levels, with Bible preselected, using `competeLessonsOf`.
    - Kind toggles from `mtAvailableKinds` (all on).
    - Teams: random count (2–6) and/or game teams (multi-select from `mcLoadTeams`).
    - Rosters: search per random team (`mtSearch`, one tap adds); a checklist of `players` whose `team` matches, per game team. Add-anyone search too.
    - «افتح شاشة الولاد» → `window.open('meeting.html?view=screen', 'meb-screen')`. «ابدأ».
  - **Play.**
    - Target chips: level (م١/م٢/الكل, limited to the night's levels); mode (فردي/سرعة/فريق, where فريق shows the team chips); kind chip or «عشوائي».
    - «السؤال الجاي» → `mtPickNext` → stage `preview`. The control shows the full item: answer, explain, secret, forbidden, list, order. Buttons: «اعرض» (→ `shown`, timer starts) / «سؤال تاني» (adds the item to `skipped`).
    - Per-kind steps while shown: «التلميح الجاي» (clues), «اظهر الاختيار الجاي» (options), «+١» / «−١» counter (sixty), timer start/pause/+15.
    - «اظهر الإجابة» → `revealed`, then `mcRecordUsed` + `usedTonight`.
  - **Award panel.**
    - Search box (autofocus after reveal) and «🎲 اختار حد عشوائي». The random pick shows a spin on the screen, then «موجود» (adds to roster) / «مش موجود» (adds to `excluded`, spins again).
    - The result list shows name, level and team.
    - Tapping a kid gives «+٥» (`mtPointsForCurrent`). A kid with no team tonight gets the team color chips inline, one tap to set.
    - Team buttons give the points to the team.
    - «−٥» correction and «تراجع آخر نقطة» (`mtUndoLast`).
    - Every award: `mtAward` → save → send view + award fx → `mcLogAward` → `mcFlush`.
  - **Surprises.**
    - Wheel (outcomes: «النقط دبل في السؤال الجاي» → `multiplier=2`; «٥ نجوم هدية لحد عشوائي من الحاضرين» → a real award of 5 to a random roster kid; «فريق ياخد ٥ من فريق» → `mtScreenScore` ±5 on the leader/last; «سؤال إنقاذ لآخر فريق» → sets the next target to team mode for the last-place team). Equal odds.
    - Bet: pick a team and an amount up to its score. The result buttons «كسب»/«خسر» call `mtScreenScore(±amount)`.
    - Golden: the next item is a `difficulty === 3` item with `golden:true` (15 points).
  - **Status.**
    - Sync badge «⏳ لسه N نجمة مستنية النت», driven by `mtPendingSyncs`. Retry every 20 s and on `online`.
    - Failed recipients (no-player) are listed.
    - Mute toggle. «افتح شاشة الولاد تاني».
    - A `beforeunload` warning when pending > 0.
  - **End.** «خلّص السهرة» → podium fx (`mtTopKids(3)`, top of `mtStandings`). If pending > 0, block clearing the night until it syncs (offer «امسح برضه» with a confirm). Then clear `MT_STORAGE_KEY`.
  - **Two-tap rule.** Every in-play action is at most 2 taps from the play screen.
- Persist with `localStorage[MT_STORAGE_KEY] = mtSerialize(night)` after every change.
- On a screen `hello`, reply with `{t:'view', view: mtAudienceView(night)}`.

- [ ] **Step 1: Write `tools/seed-meeting-emu.js`.** It connects with firebase-admin if present in `functions/node_modules`; otherwise it uses the REST emulator endpoint with `fetch` on `http://localhost:PORT/v1/projects/min-el-batal/databases/(default)/documents/...`. It seeds 12 `players` + `leaderboard` docs: names that include «مينا عادل», «مينا سمير», «أحمد», «احمد رامي», both levels, two `teams` («مارمرقس», «مارجرجس»), and `gameContent/season {id:'s2', startedAt:'2026-10-11'}`, plus one kid with `scoreSeasonId:'old'` and `createdAt:'2026-01-01'`.
- [ ] **Step 2: Build `meeting-control.js` and the control markup.**
- [ ] **Step 3: Run the checks** — `node tools/check-meeting.js` and `node tools/check-meeting-bank.js` both exit 0.
- [ ] **Step 4: Commit** — `git add meeting.html meeting-control.js tools/seed-meeting-emu.js && git commit -m "Meeting game: control window"`

---

### Task 9: Admin launcher, permission, audit label, activity history (`admin.html`)

**Files:**
- Modify: `admin.html`. Edit points:
  - `PAGES` ~line 2217
  - the nav buttons ~1476
  - the pages ~1603
  - `PTITLES/PSUBS` ~3260
  - the `goPage` hooks ~3287
  - `EV_LBL`/`evIcon`/the audit detail ~4689–4742
  - `renderActivityTab` ~4085

**Interfaces:** Consumes the `playerEvents` shape from Task 3 and `players.meetingLog`.

- [ ] **Step 1: Make the edits.**
  - `PAGES` gets `{ key:'meeting', label:'مسابقة الاجتماع', icon:'fa-tv' }`.
  - A nav button `goPage('meeting')` next to «الحضور».
  - `page-meeting`:
    - A short explanation: «شغّل المسابقة على البروجيكتور: شاشة تحكم ليك وشاشة للولاد. النقط بتتضاف نجوم في حساب كل ولد.»
    - Steps: open the control, press «افتح شاشة الولاد», drag that window to the projector, then fullscreen.
    - A big button `window.open('/meeting.html','_blank')`.
  - `PTITLES.meeting = 'مسابقة الاجتماع'`, `PSUBS.meeting = 'شاشة عرض للاجتماع ونقط حقيقية'`.
  - `EV_LBL.meeting_award = 'نجوم الاجتماع'`, icon `'🎉'`, detail `(data.points>0?'+':'')+data.points+' ⭐ · '+(data.teamName||'فردي')+(data.reason==='undo'?' (تراجع)':'')`.
  - `renderActivityTab` appends `_sec('نجوم الاجتماع','🎉', …)`: rows of `meetingLog` date → stars, newest first, plus a total. If the log is empty: «لسه مخدش نجوم من الاجتماع».
- [ ] **Step 2: Verify in the browser.** Open `admin.html` with `game-server`, log in as superadmin, open «مسابقة الاجتماع». Check the button opens `/meeting.html` and the control passes the auth gate. With a non-superadmin session lacking `perms.meeting`, check the gate message shows. Console has no errors.
- [ ] **Step 3: Commit** — `git add admin.html && git commit -m "Admin: meeting game launcher, award audit label and meeting stars history"`

---

### Task 10: End-to-end run on the emulator

- [ ] **Step 1: Start the emulator and seed it.** In the background: `firebase emulators:start --only firestore` (needs JDK 21). Then `node tools/seed-meeting-emu.js`.
- [ ] **Step 2: Open the control.** Start `game-server` with `preview_start` and open `/meeting.html?emu=8080` (with a superadmin session in localStorage). Then open the screen window from the control.
- [ ] **Step 3: Run a mini night:**
  - L1+L2, Bible
  - 3 random teams plus the «مارمرقس» game team, with rosters filled
  - one item of every kind: preview → swap once → show → steps → reveal
  - an individual award, a team award, undo, the wheel (all 4 outcomes forced via the console `rng`), a bet, and a golden question
  - an award to the old-season kid
  - reload the control mid-night and reload the screen mid-item
  - end the night
- [ ] **Step 4: Check the emulator data.** Read the docs back with the seed script's REST helper or the emulator UI:
  - Each awarded kid's `stars`, `meetingLog`, `syncId` and `leaderboard.stars` match the night.
  - The old-season kid has stars = awards only and `scoreSeasonId 's2'`.
  - Team stars reached only roster members.
  - `gameContent/meetingHistory.used` has the revealed items and not the skipped one.
  - `playerEvents` has one `meeting_award` per award.
- [ ] **Step 5: Check offline.** In the browser, set the network offline, give 2 awards and confirm the pending badge shows 2. Go back online and confirm it reaches 0 and the stars are right (exactly once).
- [ ] **Step 6: Screenshot** the control and the screen at preview, shown, revealed and podium. Then run `node tools/check-meeting.js`, `node tools/check-meeting-bank.js`, `node tools/check-cloud-save.js`, and report the results.
