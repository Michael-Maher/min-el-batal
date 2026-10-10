# Bible games expansion — الترم الأول والترم التاني (design)

Goal: more interactive, fun games on every lesson of the two Bible subjects, so kids replay lessons and
cover the whole lesson through play.

- الترم الأول = Level 1 Bible `L1_BIBLE` (`level1-bible-data.js`, key `l1_bible`, 6 stations).
- الترم التاني = Level 2 Bible `L2_BIBLE` (`level2-bible-data.js`, key `l2_bible`, 8 stations).

Today every station has 4 games: 1 canvas arcade (`max 50`) + 3 DOM mini-games (`max 30` each) = 140 = the games bucket cap.
After this work every station has **7 games**: the 4 existing + 1 new arcade + 2 new DOM mini-games.

Same engine, contracts and quality bar as `2026-09-29-level1-contracts.md`, `2026-09-29-level1-bible-design.md`
and `2026-10-02-level2-bible-design.md`. Service and life-skills subjects are not changed.

## Phases (each ships and is tested on its own)

| Phase | Content |
|---|---|
| 1 | Per-subject score caps + 3 new DOM game types + their content on all 14 stations |
| 2 | 6 new arcade games for الترم الأول |
| 3 | 8 new arcade games for الترم التاني |

Phase 1 alone raises the Bible games cap to 250 while each station only offers 140 + 60 = 200 game points.
The extra 50 per station becomes reachable when phases 2 and 3 land. Stars use the station's reachable max
(what its current games can add up to), so a 200 player keeps 2 stars and 3 stars need the new games. Phase 1 is still releasable; this is the accepted
in-between state.

## 1. Scoring (per-subject caps)

`level1.js` today uses globals `L1_BUCKET_MAX = { learnRead:20, learnChecks:20, summary:20, games:140 }`, `L1_MAX = 200`,
`L1_PASS = 140`, and a hard-coded `170` for 2 stars. The engine is shared by all four subjects, so caps become per subject:

- Subject data may declare `scoring: { games: 250, max: 310 }`. Missing fields fall back to the current globals.
- New helpers in `level1.js`: `l1BucketMax(field)` and `l1MaxTotal()` read `l1Subject().scoring` then the globals.
  Every current use of `L1_BUCKET_MAX[...]` / `L1_MAX` in `level1.js` goes through them (lines ~181, 194, 196, 205, 557,
  618, 638, 675, 796-800, 839, 987).
- `L1_PASS` stays **140** for every subject: no player loses an opened station.
- Stars: 3 = `l1MaxTotal()`, 2 = `L1_PASS + (l1MaxTotal() - L1_PASS) / 2` (keeps today's 170 for 200; gives 225 for 310), 1 = pass.
- `L1_BIBLE.scoring = L2_BIBLE.scoring = { games: 250, max: 310 }`.
- New game ids are appended after the existing games of each station, so existing `miniGameScores` keys keep working.

Known effects (accepted):
- Stars use the station's reachable max: a player who had 200 keeps 2 stars on a Bible station, and 3 stars need the new games.
- Station totals can now reach 310, so Bible lessons are worth more on the leaderboard. A new score season was just started,
  so this does not distort an old season.
- `game.js` `_countCompletedLessons()` uses its own threshold (60), not the max, so it is unaffected. No other hard-coded
  200 for L1-engine stations was found in `game.js`, `game-ui.js` or `admin.html`; re-check during implementation.

## 2. New DOM game types (Phase 1)

Each is one function in `L1_GAME_TYPES` in `level1.js`: `(host, data, api) -> { destroy, partial }`, calls `api.end(raw, rawMax)`
exactly once, uses `l1Tracker` for the HUD, `l1FxAt` / `l1Shake` for feedback, `l1Pick` / `l1Shuffle` for randomness,
`l1Esc` for every data string. CSS goes in `level1.css` with the `l1-` prefix, RTL, touch-first, fits a 360px-wide phone.
All new games `max: 30`.

### `treasure` — 💎 مين يكسب الكنز
```js
treasure: { prompt, questions:[{ q, options:[4 strings], correct, explain, hint, level:1|2|3 }], pick:10, time:20 }
```
- Engine picks `pick` questions, ordered by `level` (easy first), and shows a 10-step ladder on the side.
- 20 s per question (`time`), visible countdown; timeout counts as wrong.
- 3 hearts. A wrong answer costs a heart and shows `explain`; 0 hearts ends the game.
- 3 lifelines, each once per game: **50:50** (removes two wrong options), **اسأل الخادم** (shows `hint`), **وقت زيادة** (+15 s).
- `raw` = sum of `level` of correctly answered questions; `rawMax` = sum of `level` of the picked questions.

### `wordSearch` — 🔎 دوّر على الكلمة
```js
wordSearch: { prompt, words:[{ w:'إبراهيم', clue:'أبو المؤمنين' }], pick:6, size:8, time:120 }
```
- Engine picks `pick` words and places them in a `size`×`size` grid of single Arabic letters (shown unjoined), directions:
  right-to-left, top-to-bottom, diagonal down-left. Fill empty cells with random letters drawn from the placed words.
- Placement is generated per play; if a word cannot be placed after N tries it is dropped and the next word is used.
- Select by dragging a finger (pointer events) from first to last letter in a straight line; a found word gets a highlight,
  its `clue` appears under the grid, `tr.hit()`. Wrong selection: `tr.miss()`.
- Words are stored without tashkeel and with spaces removed; hamza forms are compared exactly as written (no normalising).
  Max word length = `size`.
- Ends when all words are found or `time` runs out. `raw` = words found, `rawMax` = words placed.

### `verseOrder` — 🧩 رتّب الآية
```js
verseOrder: { prompt, verses:[{ text, ref }], pick:3, chunk:2 }
```
- Engine splits each verse on spaces into tiles of `chunk` words (last tile may be shorter), shuffles them, and the player
  taps tiles in reading order to build the verse in an RTL line above. Wrong tile: shake + `tr.miss()`.
- Per verse score = tiles − mistakes (min 0); `rawMax` = total tiles. On solving, the full verse + `ref` glow, then the next verse.

### Placement on stations

Every station gets `treasure`. The second new game avoids repeating a verse mechanic the station already has:
stations that already have `fillVerse` or `decode` get `wordSearch`; the rest get `verseOrder`.

| Subject | Station | 2nd new game |
|---|---|---|
| L1 | 0 مقدمة (has decode) | wordSearch |
| L1 | 1 الخليقة | verseOrder |
| L1 | 2 الآباء | verseOrder |
| L1 | 3 الخروج | verseOrder |
| L1 | 4 القضاة (has decode) | wordSearch |
| L1 | 5 المملكة | verseOrder |
| L2 | 0 بانوراما | verseOrder |
| L2 | 1 طرق الدراسة (fillVerse) | wordSearch |
| L2 | 2 الكاثوليكون | verseOrder |
| L2 | 3 يع ١ (fillVerse) | wordSearch |
| L2 | 4 يع ٢ (decode) | wordSearch |
| L2 | 5 يع ٣ | verseOrder |
| L2 | 6 يع ٤ (decode) | wordSearch |
| L2 | 7 يع ٥ (fillVerse) | wordSearch |

Ids: `s<n>_treasure`, `s<n>_words`, `s<n>_order`.

### Content per station
- `treasure`: 12-15 questions (mix of levels 1/2/3, at least 4 per level), each with `explain` and `hint`.
- `wordSearch`: 8 words (names, places, key terms of the lesson), each with a one-line `clue`.
- `verseOrder`: 4 verses from the lesson.
- All facts come from that station's cards. Verses: Van Dyke; deuterocanonical books: the Coptic church Arabic text.
  Coptic Orthodox accuracy rules of the two subject specs apply.
- Content is logged in `docs/superpowers/specs/2026-10-10-bible-games-content-log.md` (one section per station, sources)
  for review by the user or a servant before release.

## 3. New arcade games (Phases 2, 3)

Contract: section B of `2026-09-29-level1-contracts.md`, using the shared kit `L1_ARCADE._kit` like `level2-arcade-bible.js`.
Canvas shapes + emoji only, no image files; 60-120 s; at least 2 `api.ask` checkpoints with a visible in-game bonus;
`max: 50`; landscape; pause on `document.hidden`; `destroy()` stops the loop and removes listeners.
All story text, verses, facts and items come from the game's `data`; only generic UI strings in the JS.
Every arcade `data` has `questions` (4-6) as in the contract. Id `s<n>_<name>`.

Each mechanic differs from the arcade already on that station.

**Phase 2 — `level1-arcade-bible-extra.js` (الترم الأول)**

| St | Game | `arcade` | Mechanic |
|---|---|---|---|
| 0 | 🚂 قطار الأسفار | `bookTrain` | Snake: collect book names in canonical order; wrong book costs a wagon. `data.books` = ordered list. |
| 1 | 🕊️ حمامة نوح | `noahDove` | Flappy-style flight over the flood searching for the olive leaf (تك ٨). |
| 2 | 🪜 سلّم يعقوب | `jacobLadder` | Vertical jumper on ladder rungs; angels lift, promises are collected (تك ٢٨). |
| 3 | 🍞 المن في البرية | `manna` | Catch manna with the rule: one omer a day, extra spoils, double on day 6, none on the Sabbath (خر ١٦). |
| 4 | 📯 أسوار أريحا | `jericho` | Rhythm: tap with the trumpet beats while circling; on the 7th lap the walls fall (يش ٦). |
| 5 | 🏛️ بناء الهيكل | `templeBuild` | Stacker: drop dressed stones precisely, built in silence (١ مل ٦: ٧). |

**Phase 3 — `level2-arcade-bible-extra.js` (الترم التاني)**

| St | Game | `arcade` | Mechanic |
|---|---|---|---|
| 0 | 🕎 منارة التجديد | `dedicationLamps` | Keep all lamps lit by refilling oil before they go out (١ مك ٤: ٥٩، يو ١٠: ٢٢). |
| 1 | ⛏️ كنز في الحقل | `fieldTreasure` | Minesweeper-lite dig grid with اقرا / اسأل / صلّي tools; each treasure reveals a fact. |
| 2 | 💠 جواهر الرسائل | `epistleGems` | Match-3; each gem is an epistle symbol, matches show its key idea. |
| 3 | 👂 مسرع في الاستماع | `swiftToHear` | Keep 3 meters balanced (استماع high, كلام and غضب low) as situations hit (يع ١: ١٩). |
| 4 | ⚖️ ميزان الإيمان | `faithScale` | Drop "works" onto a scale to balance faith; Abraham and Rahab bonuses (يع ٢). |
| 5 | ⛵ دفة السفينة | `shipRudder` | Steer a big ship with a small rudder between rocks and wind (يع ٣: ٤). |
| 6 | 🤍 نقّي القلب | `cleanHeart` | Swipe stains before they spread; humility power-up gives grace (يع ٤: ٦، ٨). |
| 7 | 🌱 صبر الفلاح | `farmerPatience` | Plant and wait for the early and late rain; harvesting early loses (يع ٥: ٧). |

Exact `data` fields per arcade are fixed in the implementation plan of each phase and appended to the contracts doc
(section A, arcade list), following the existing format.

Verses not yet in the subject data (Gen 8 olive leaf, Ex 16 manna, 1 Kgs 6:7) are added to the
game `data` in Van Dyke text and logged in the content log.

## Loading

- Phases 2 and 3 add `level1-arcade-bible-extra.js` and `level2-arcade-bible-extra.js` after `level2-arcade-bible.js`
  in `index.html`, and to the precache list in `sw.js` with a `CACHE_NAME` bump.
- Each phase bumps `CACHE_NAME` so installed PWAs pick up the new files.

## Error handling

- Existing engine behaviour covers missing types / arcades: `l1RenderGameFrame` shows «اللعبة دي مش جاهزة لسه 🙏».
- `wordSearch` drops words that cannot be placed and never renders an empty grid (ends early with what was placed;
  data validation keeps this from happening).
- `treasure` with fewer questions than `pick` uses all of them.

## Verification

- A Node check script `tools/check-bible-games.js` (dev only, not shipped): loads both data files and asserts
  unique game ids per subject, 7 games per station once phases 2/3 are done, sum of `max` = 250 per station,
  every `treasure` has >= 12 questions with valid `correct` / `level` / `hint`, every `wordSearch` word fits `size`,
  every `arcade` name exists in `L1_ARCADE` (loaded with a stub `document`), `wordSearch` words have no tashkeel or spaces.
- Manual play of each new game in the browser at phone width (360px, RTL), portrait for DOM types and landscape for
  arcades: start, win, lose, back mid-game (no leaked loop), score saved and station total updated.
- Phase 1 also checks a Service and a Life station still show `/200` and the old stars.

## Out of scope

- No changes to Service / Life subjects, compete rooms, exams, or Firestore rules.
- No new images or Weave assets (canvas + emoji only).
- No admin panel changes (new games appear through the existing station data).
