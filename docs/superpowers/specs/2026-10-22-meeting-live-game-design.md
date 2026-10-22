# Monday meeting live game ("مسابقة الاجتماع") — design

Status: draft for approval, 2026-10-22. Builder check done; the host answered its open questions (below).

## Intent

Every Monday meeting the servant runs about **one hour** of group competition for about **60 kids** from
both levels, in one hall. He holds the laptop. The laptop drives a projector. Kids answer **out loud, with
raised hands**; nobody needs a phone. The servant decides who answered, gives points, and the points go to
the kid's **real game account** (stars). After each question the right answer shows so he can explain it.

It must feel like a game show, not a quiz sheet: varied puzzles, physical challenges, surprises,
celebration on every award. Content is Coptic Orthodox, taken from the lessons the kids study, written in
Egyptian colloquial Arabic.

Prior art in the repo: «كاس مين البطل» (`tournament-live.html` projector view driven from `admin.html`).
Its look and feel (sounds, confetti, mystery box, score pops) is the bar to match. Its structure
(bracket, team-vs-team matches) does not fit here.

## Goals

- Presenter mode: a **control window** on the laptop and an **audience window** on the projector, like
  PowerPoint presenter view. The answer is visible only on the control window until revealed.
- Before the hour: choose levels (L1 only / L2 only / both), subjects and lessons, which segment types are
  on, and teams.
- Per question, the host chooses the target: **level** (L1 / L2 / all), and **who answers**:
  individual, speed question for everyone, or a specific team.
- Award points to an individual (search by name) or to a team; the audience screen celebrates it with the
  kid's name/avatar and the points.
- Points go to real accounts immediately (with offline queueing).
- Random pick of a kid from a level to answer.
- Teams for the night: random teams created for this night only, and/or the game's existing teams.
  Kids can join a team mid-game.
- 18 segment types (below), all in v1.
- End-of-night podium (top 3 kids and winning team) with confetti.
- First content: **Bible, both levels** (`l1_bible`, `l2_bible`).

## Non-goals

- No player-side participation (no phones, no buzzers).
- No registration step at the start of the night (the host explicitly dropped it).
- No changes to `tournament.html` / `tournament-live.html` / the existing tournament admin.
- Subjects other than Bible get no new content in v1. Their existing bank questions may still be
  selectable if it costs nothing (builder's call), but new puzzle content is Bible-only.
- No Firestore rules changes, no new collections that need rules, no Cloud Functions.

## Anti-goals (failure even if it works)

- The audience screen ever showing the answer, the host's notes, or a secret word before the host reveals it.
- A kid's stars lost or doubled (e.g. the kid's phone saving later and overwriting the award, or a double
  tap giving points twice without the host seeing it).
- The projector freezing because the church Wi-Fi is slow.
- Content that is doctrinally wrong or not Orthodox, or written in formal Arabic rather than the
  game's warm colloquial tone.
- Host fumbling: anything during play that takes more than ~2 taps or makes the room wait.

## Constraints (from the project)

- Vanilla JS, no build step, no npm deps for the browser app, Firebase compat SDK, RTL Arabic UI.
- Don't modify `firestore.rules`. Existing open collections usable: `players`, `leaderboard`,
  `playerEvents`, `gameContent`, `teams`.
- Don't refactor `game.js`. The player app is not changed at all by this feature (my expectation; see
  "Stars to real accounts" for why no player-side change is needed).
- Deploy is done by the user (`firebase deploy --only hosting`).

## Decided by the host (user)

1. One host, laptop + projector, about 60 kids, both levels mixed in the hall, about an hour every Monday.
2. Answers are spoken; the host awards points.
3. The host can restrict the night to L1, L2, or both, and picks subjects and lessons.
4. Per question: L1 / L2 / everyone (speed), individual or team question.
5. Points count in the kid's real account (stars). Team points go to every kid in that team too.
6. Kids are found from the game's player list by name (no attendance or phone needed). No sign-in step.
7. Random pick of someone to answer from a level.
8. Teams: random teams for this night only, and the game's own teams can be added too. People can be
   added to teams mid-game.
9. Presenter mode: separate control screen and audience screen.
10. All 18 segment types below are wanted.
11. Content starts with Bible for both levels, from the lesson material in the repo.
12. **Team rosters (answer to builder check):** when forming teams at the start, the host adds each team's
    kids quickly by name search (first letters, one tap per kid), and can add latecomers to any team at any
    time. Team stars go to the kids on the team roster.
13. **Every question is worth 5 points = 5 stars.**
14. **Content order:** deep, varied items tied to each lesson come first, for every segment type. Only when a
    segment's lesson items are used up does it fall back to well-known Bible stories suitable for the age.
15. **No review gate:** new items do not need approval before use. The host can replace an item on the
    control window before it is shown on the audience screen.

## Decided by me (assistant) — open to the host's veto

- **Where it lives:** a new standalone page `meeting.html` (control) that opens
  `meeting.html?view=screen` (audience) with `window.open`. Launched from a new admin page
  «مسابقة الاجتماع» in `admin.html` (new permission key `meeting`, superadmin has it automatically), and
  `meeting.html` itself refuses to run without a valid admin session (`minElBatal_adminSession` in
  localStorage, same origin, same check `tournament-live.html`/admin use).
- **Window sync:** control → audience over `BroadcastChannel` (same browser, no network). The audience
  window is a dumb renderer of the state the control window sends; on load it asks the control window for
  the current state. If the audience window is closed, the control can reopen it.
- **Night state survives refresh:** the whole night (teams, who is present, scores, question history,
  pending awards) is kept in `localStorage` and restored on reload. "Start a new night" clears it.
- **"Present tonight" list:** everyone added to a team roster, plus anyone who got points or was picked and
  confirmed. There is no separate registration step; the team rosters are the main source.
- **Random pick:** spins over kids present tonight at the chosen level first; if fewer than ~3 are
  present at that level, it spins over all players of that level (`playerLevelOf` logic: explicit
  `playerLevel`, else derived). After the spin the host taps «موجود» (marks present) or «مش موجود»
  (spins again, excluding that kid for the night).
- **Teams for the night:**
  - Random teams: the host picks a count (2-6); the app makes them with names and colors (Biblical/
    church-flavored names, e.g. «فريق داود», «فريق موسى»…). Kids split themselves in the hall
    (count off), and the host adds each team's kids by name search (host decision 12). A kid awarded
    individually who is on no team yet gets the team colors as a one-tap choice in the award sheet. The
    host can move a kid between teams.
  - Game teams: the host picks one or more teams from `teams`; the app lists that team's players
    (`players.team`) as a checklist and the host ticks who is here. Others can be added by search.
  - Both can be mixed in one night.
  - Kids can be added to a team at any time.
- **Team awards:** points go to the team's on-screen score and, as stars, to every kid on that team's
  roster tonight (not absent members of a game team). Shown on screen as one team celebration, not 15 pops.
- **Individual award also counts for the kid's team score** on screen when the kid is on a team tonight.
- **Points (host decision 13):** every item is worth **5** (= 5 stars). The award sheet has one main
  button «+٥» and a «−٥» correction. Golden question = 15. Wheel "double next question" = 10. Clue
  questions («مين أنا؟») stay at 5 regardless of the clue count (the clue count shows on screen as
  bragging rights only). ٦٠ ثانية: the team with the higher count gets 5 (on-screen count is the show).
  A last-award «تراجع» undoes the last award (screen and account) within the night.
- **No per-night cap:** with 5 per item, 30-40 items a night cannot inflate stars past a normal range.
- **Speed question:** same as individual (first hand wins); the timer is shorter.
- **Preview before showing (host decision 15):** «السؤال الجاي» loads the item on the control window
  only. The host reads it and either presses «اعرض» (audience sees it) or «سؤال تاني» (swap; the
  skipped item does not count as used).
- **No repeats across weeks:** questions/items used are recorded in `gameContent/meetingHistory`
  (`{ used: { <itemId>: 'YYYY-MM-DD' } }`); the picker prefers unused items and only reuses when a
  pool runs out (oldest first). The host can also skip an item («سؤال تاني») without it counting as used.
- **Audit:** each award (one per individual or team award, not one per kid) is logged to `playerEvents`
  with `type: 'meeting_award'`, `data: { points, reason: 'individual'|'team'|'undo', recipients: [phones],
  segment, itemId, teamName, admin, nightDate }`, with a label in the admin Reports audit list.
- **Per-kid meeting history:** the award also does `players/{phone}.update({ 'meetingLog.<YYYY-MM-DD>':
  increment(n) })` in the same write as the stars. `meetingLog` is not a `GameState` field, so the player
  app's `set(merge)` saves never touch it. The admin player modal's activity tab (`renderActivityTab`)
  gets a small «نجوم الاجتماع» section listing night → stars. This is the only `admin.html` change besides
  the launcher page.
- **Content source:** new items are written from the lesson content in `level1-bible-data.js` /
  `level2-bible-data.js` into a new data file `meeting-bank.js`, every item tagged with level, subject,
  station, segment type, and a short `explain` for the host. No approval gate (host decision 15).
- **Content volume:** lesson items first (host decision 14): for **every station and every segment type
  that can fit the lesson**, write deep and varied items. Target per station: at least 2 items for each
  fitting new segment type, plus new items for segment types 1-6 where the existing bank is thin
  (L1 Bible has no verse or scenario items; write them). Roughly 25+ new items per station
  (6 L1 + 8 L2 stations ≈ 350 items). A one-hour night uses roughly 30-40 items.
- **Fallback pool:** a separate `station: null` set per level of items from well-known Bible stories
  suitable for the age (emoji, acting, drawing, taboo, order, scrambled letters, hymn lines from well-known
  church hymns/alhan). The picker uses it for a segment only after that segment's items for the selected
  lessons are all used. A segment with no items at all for the selected level is hidden from the chips.

## Stars to real accounts (how, and why it is safe)


The player app protects against stale devices with a `syncId` 3-way merge in `_writeToCloud()`
(`game.js` ~1085-1225): if the cloud `syncId` differs from the one the device last saw, the device merges
the cloud copy first, and counters (`stars`) become `cloud + (local - base)`. So an award written as:

```
players/{phone}.update({ stars: FieldValue.increment(n), 'meetingLog.<date>': FieldValue.increment(n),
                         syncId: <new random id>, lastUpdated: now })
leaderboard/{phone}.update({ stars: FieldValue.increment(n) })   // ignore if the doc is missing
```

is kept when the kid's phone saves later. Changing `syncId` is what forces that merge; without it the
phone overwrites the award. No change to `game.js` needed.

Offline: Firestore compat with persistence (or a local pending queue in the night state) holds awards
until the network is back; the control screen shows a small "pending sync" count, and it must reach zero
before the host closes the night (warn on close if not).

Any other fields the game expects on a stars change (season fields, e.g. `SEASON_FIELDS` in admin,
`scoreSeasonId`) should be checked by the builder; `stars` is the only counter this feature touches.

## Screens

Mockup shown to and accepted by the host: `.superpowers/brainstorm/*/content/screens-and-games.html`.

### Setup (control window, before play)

- Night title/date (default today).
- Levels: L1 / L2 / both.
- Subjects and lessons (stations) per level, checkboxes, Bible preselected.
- Segment types on/off (all on by default).
- Teams: random (count) and/or game teams (multi-select), then fill rosters: name search per random
  team, checklist per game team. Can be edited at any time during play.
- «افتح شاشة الولاد» opens the audience window (host drags it to the projector and presses F11 / a
  fullscreen button on it).
- «ابدأ».

### Play (control window)

- Top bar: next-question target: level chips (م١ / م٢ / الكل), mode chips (فردي / سرعة / فريق + which
  team), segment chip (or «عشوائي» to let the app vary it). «السؤال الجاي».
- Current item card with everything the host needs: the item, the answer, the `explain` note, the secret
  word list for acting/taboo/drawing, and the step controls for that segment (next clue, show options,
  start timer, reveal answer).
- Item flow: «السؤال الجاي» → preview on control only → «اعرض» or «سؤال تاني».
- Award panel: name search (Arabic-normalized: أ/إ/آ→ا, ة→ه, ى→ي; first 2+ letters), random pick button,
  the found kid with level and team chip, point buttons, team-assign chips, «تراجع».
- Teams strip with scores; «+ فريق», add kid to team.
- Surprise buttons (wheel, bet, golden question) available between items.
- «خلّص السهرة» → podium.

### Audience window

- Big item, segment tag (e.g. «مين أنا؟ · مستوى أول»), timer ring, team scores along the bottom with a
  crown on the leader.
- Award pop: kid name (and avatar/character if available) + «⭐ +20», team flash for team awards.
- **Individual leaderboard (host request, 2026-10-22):** a side panel «أوائل مسابقة النهارده» always on screen,
  one section per level, listing every kid tonight (name, team color, stars tonight) ranked within the level.
  When a kid gets points the row flashes and slides to its new rank with an animation; long lists auto-scroll
  and jump to the awarded kid. The host can also show the whole ranking full-screen («اعرض الترتيب»).
- Reveal animation for the answer.
- Wheel spin, bet screen, golden-question intro, podium with confetti.
- Sounds (Web Audio, like `tournament-live.html`), on by default with a mute toggle on control.
- Designed for a projector: very large type, high contrast, readable from the back of a hall.
- Never receives the answer/notes/secret before reveal (the control sends only what is on screen).

## Segment types (all 18 in v1)

From the existing bank (`compete-bank.js` → `competePickQuestions` / `competeBankFor`, filtered by level,
subject, station), topped up with new lesson items in `meeting-bank.js` where the bank is thin:

1. **سؤال اختيار** — options appear one by one, timer.
2. **قوم ولا اقعد** — true/false for the whole hall; stand = true, sit = false; then reveal. Usually no
   individual points (or the host awards a few).
3. **مين أنا؟** — clues one at a time; 5 points whatever the clue count.
4. **كمّل الآية** — verse with missing word(s).
5. **موقف… تعمل إيه؟** — scenario with choices; can open discussion.
6. **رتّب الأحداث** — 4 story events shuffled; the team says the order; reveal shows the right order.
   (Existing timeline data can feed this; new items too.)

New content in `meeting-bank.js`:

7. **القصة بالإيموجي** — emoji string → story/person/miracle.
8. **الحروف المتلخبطة** — scrambled letters of a name/book/feast; reveal unscrambles.
9. **مين الغريب؟** — 4 items, one doesn't belong; reveal shows which and why.
10. **سؤال عميق** — open question, no single answer; host gives points to the best answer; reveal shows the
    church's answer to explain.
11. **٦٠ ثانية** — "name as many X as you can"; the host taps a counter as answers come; reveal shows the
    full list. Points by count.
12. **مثّلها من غير كلام** — secret story/person shown **only on the control window**; one kid comes to the
    laptop to read it, acts it; team guesses in 45 s.
13. **ارسمها** — same secret flow; drawing on the board, no letters.
14. **الكلمة الممنوعة** — secret word + 3 forbidden words, on the control window only.
15. **كمّل اللحن / الترنيمة** — host shows the first line; the team continues. Text only, no audio.

Surprises (between items, host-triggered):

16. **عجلة الحظ** — outcomes: double points on next question (10), 5 gift stars to a random present kid, a
    team takes N points from another (screen score only, not account stars), rescue question, etc.
17. **الرهان** — a team bets part of its night score before seeing the question; win doubles the bet,
    lose loses it. Screen score only.
18. **السؤال الدهبي** — a hard question, 15 points (×3). Kept for the end of the night.

Rule for surprises: anything that **takes away** points affects the on-screen night score only; real
account stars are only ever added (or corrected by the host's undo/−10). Taking real stars from kids as a
game mechanic would feel unfair and is easy to get wrong.

### `meeting-bank.js` item shape (builder may refine)

```
{ id: 'mb_l1b_s2_emoji_03', level: 1, subject: 'l1_bible', station: 2, kind: 'emoji',
  prompt: '🔥🌳👞', answer: 'موسى والعليقة', explain: '...(خر ٣)', difficulty: 1|2|3,
  // kind-specific: clues[], options[]+correct, items[]+odd, order[], list[], forbidden[], firstLine }
```

Every item has an `explain` with the Bible reference where there is one. Fallback items use
`station: null`.

## Content rules

- Source: the lesson cards/text in `level1-bible-data.js` (6 stations: intro, creation, patriarchs,
  exodus, judges, kingdom) and `level2-bible-data.js` (8 stations: deuterocanonical books, Bible study
  methods, catholic epistles intro, James 1-5).
- Orthodox teaching as the lessons present it (e.g. deuterocanonical books are canonical, never "apocrypha").
- Egyptian colloquial Arabic, warm and encouraging, matching the game's tone; Bible verses quoted in the
  Van Dyck text as the lessons do.
- Mix of difficulty: medium and deep questions, not only recall.
- Age fit: L1 items should be answerable by L1 kids; "everyone" speed questions should be fair to L1.

## Left to the builder

- File split between `meeting.html` and any `meeting.js`; how to load `compete-bank.js` and its
  dependencies (`level1.js`, the subject data files, `LEVEL2_SUBJECTS` from `game.js` is not needed for
  Bible) without pulling in `game.js`.
- Exact visual design within the accepted mockup and the tournament-live look.
- Timer defaults per segment, point defaults per segment, wheel outcomes and their odds.
- Name search details and how many players to load (one `players` read at night start, cached; fields
  needed: name, phone, level, team, character/avatar).
- Whether to also add the night's awards to the leaderboard's weekly fields if any exist.

## Checks

- A vm-stub check in `tools/` (like `tools/check-cloud-save.js`) for the pure parts: picker filtering by
  level/subject/station/kind, no-repeat selection, award math (individual, team to present members,
  undo), night-state restore.
- A check that every `meeting-bank.js` item has the required fields for its kind and a valid level/
  station.
- Manual run on the laptop with two windows before the first Monday.
