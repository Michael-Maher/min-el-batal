# Level 1 — الكتاب المقدس (Design Spec)

Date: 2026-09-29
Source requirements: `~/Desktop/الكتاب المقدس المستوى ١.rtfd` (text + 119 embedded images)
Map art: `~/Documents/holy book.png` (3616×2415)

## 1. Goal

Open **المستوى الأول** for every player and ship its first subject, **الكتاب المقدس**: an
animated 6-station map, and per station a learn → summary → games flow with new, varied,
content-driven games that make players study the lesson to score.

### In scope
- Level 1 hub card becomes active (still admin-lockable via `card_level1`).
- Subject `l1_bible`: map with stations 0–5, lesson shell, 6 new game types, 6 signature arcade games.
- Admin panel recognises `l1_bible` (player modal tabs, locks).

### Non-goals (explicitly deferred)
- Level 2 gate for new players (turned on only after all 4 Level 1 subjects exist).
- Subjects سلوكيات / تاريخ كنيسة / خدمة.
- Doc lectures 7 (عصر الأمم) and 8 (بانوراما العهد الجديد).
- Level 1 exams, leaderboards, weekly challenges.
- "ألبوم الأبطال" hero-card collection (possible follow-up).
- Any Firestore rules change or new collection.

## 2. Stations and content

| Station | Title | Bible refs | Doc content (source of truth for cards + game data) |
|---|---|---|---|
| 0 | مقدمة: الكتاب المقدس | — | Definition (أسفار إلهية، أناس الله القديسون مسوقين من الروح القدس); ~40 writers; languages (عبري = العهد القديم، آرامي، يوناني = العهد الجديد); Septuagint (≈70 elders, Alexandria, 250 ق.م, 1660+ languages today); chapters/verses added (Cardinal Hugo 1240 م, text was continuous); meaning of عهد; Old vs New Testament panel; the 6 OT eras in order |
| 1 | عصر الخليقة | تكوين ١–١١ | Ps 8:5-6; 7 days; man in God's image + the command (تك ٢: ١٦-١٧); fall; promise (تك ٣: ١٥); Cain & Abel; Seth's line (أنوش … نوح, أخنوخ, متوشالح); flood (8 souls, clean/unclean, 40 days, 150 days, أراراط, rainbow); Noah's sons → nations; line Shem → Abraham; Babel |
| 2 | عصر الآباء البطاركة | تكوين ١٢–٥٠ | Ps 105:8-11; call & promises to Abraham; Hagar/Ishmael; Terah's family (إبراهيم، ناحور، هاران → لوط); Abram & Lot quarrel (تك ١٣: ٨); Sodom (just + merciful); sacrifice of Isaac; Isaac & Rebekah → Esau/Edom, Jacob/Israel; Isaac the peacemaker; Jacob's wives → 12 tribes + Dinah; Joseph (sold, Potiphar, prison, dreams, second in Egypt, forgiveness; faithfulness + purity) |
| 3 | عصر الخروج | خروج، لاويين، عدد، تثنية | Ps 78:52-54; slavery in Goshen; Moses' life (basket, palace 40y, Midian 40y, Zipporah, burning bush); 10 plagues vs Egyptian gods (doc image #35); exodus (~600k men), Red Sea, song (الهوس الأول); Sinai (40 days, tablets, tabernacle, priests, law); golden calf; 40 years wandering; wilderness events (Amalek, rock, Korah, manna & quail, bronze serpent, Balaam's donkey, Sihon & Og); Moses re-reads law, hands over to Joshua, dies on Nebo (Num 20:11-12) |
| 4 | عصر القضاة | يشوع، القضاة، راعوث، ١ صم ١–٧ | Neh 9:27-28; Joshua enters, divides land by lot; the sin cycle; the 14 judges with deeds (عثنيئيل … صموئيل); Ruth (شعبك شعبي وإلهك إلهي, Boaz, Obed → David → Christ) |
| 5 | عصر المملكة | ١-٢ صم، ١-٢ مل، ١-٢ أخ، يهوديت، طوبيا، إرميا | 1 Sam 12:12-13; people ask for a king; Saul / David / Solomon fact lists; united vs divided kingdom (doc image #55); North: 10 tribes, Jeroboam, Samaria, 19 kings, Assyria 727 ق.م; Elijah (miracles, Carmel, chariot); Elisha (miracles list); Tobit; South: Judah + Benjamin, Jerusalem, 19 kings, Babylon 586 ق.م, 70-year exile; Judith |

Content text is copied from the doc verbatim where possible (Egyptian-Arabic tone kept).
Infographic images from the doc are rebuilt as HTML diagrams; scene illustrations are
compressed into `images/l1/bible/` (≤ 1000px wide, jpg/webp).

## 3. Architecture

### Files
| File | Change |
|---|---|
| `level1.js` (new) | All Level 1 code: `LEVEL1_SUBJECTS` registry + content data, `l1State`, map renderer + walk animation, lesson shell, game types, arcade games. Global functions (project style). Loaded after `game.js`. |
| `level1.css` (new) | Level 1 visuals, all selectors prefixed `l1-`. |
| `index.html` | Activate Level 1 hub card (`onclick="openLevel1()"`, keeps `.hub-card-locked`-independent selector); add `#l1-map-screen`, `#l1-lesson-screen`; add `<link>` + `<script>` tags. |
| `game.js` | Minimal hooks: `showScreen` render cases for the two screens; `_LOCK_GATE` entries for both screens → `card_level1`; `applyDashboardLockUI` entry for the new card selector (no longer "never truly opens"). |
| `admin.html` | Add `l1_bible` to `SUBJECTS` (name `كتاب مقدس — م١`, 6 lesson names) and to the `subKeys` arrays / colour maps used by player-modal tabs and locks. |
| `sw.js` | Add `/level1.js`, `/level1.css`, map image to precache; bump `CACHE_NAME`. |
| `images/l1-bible-map.jpg` | Compressed map (~2000px wide, target ≤ 300KB) + tiny blurred placeholder. |

### Data contract (existing GameState fields, no new Firestore docs)
- Station key: `l1_bible_<n>` (n = 0..5). Future levels follow `l<level>_<subject>_<n>`.
- `GameState.stationScores['l1_bible_n'] = { learnRead, learnChecks, summary, games, total }` (Level 1 owns its own bucket names; Level 2 entries untouched).
- `GameState.miniGameScores['l1_bible_n_mg_<gameId>']` = best score per game.
- `GameState.lessonSummaries['l1_bible_n'] = { text, image, audio, date }` — same shape as today, so admin tab 7 shows it. `text` is the three guided answers joined with headings.
- `GameState.level1Data.l1_bible = { seenUnlock: {n: true}, savedVerses: [...] }` — new field, added to GameState defaults and to the cloud-save whitelist next to `level2Data`.
- Saving: `saveToLocalStorage()` (which triggers `saveToCloud()`), as Level 2 does.

### Locks
- `card_level1` gates the hub card and both screens.
- `subject_l1_bible` and `lesson_l1_bible_<n>` checked with `checkLockOrPopup` on subject open / station enter.

## 4. Map screen (`#l1-map-screen`)

- **Landscape**, same as other maps: `enterMapLandscape()` on open, `exitMapLandscape()` on leave.
- Map image fills the landscape viewport; blurred placeholder while loading; toast on load error.
- Top bar: back · "الكتاب المقدس · المستوى الأول" · progress ring (stations passed / 6) · total points.
- Station hotspots positioned in % over the painted numbers (`L1_BIBLE_MAP_POSITIONS`, measured from the art). Station 0 = wooden bridge at bottom centre, with an added CSS "0" badge matching the painted badges.
- States: **locked** (fog + chain, tap → "خلّص المحطة اللي قبلها الأول"), **current** (pulsing gold ring + bouncing "هنا"), **passed** (★ count + check).
- Tap station → bottom sheet: title, Bible refs, the 4 signpost topics, per-part score, "ادخل المحطة".
- **Walk animation**: hidden SVG path through the painted road's blue stepping-stones. On first return to the map after a station crosses its threshold: segment lights up dot by dot → player's character walks it (`getPointAtLength` + `requestAnimationFrame`, hop per step, dust via `CanvasFX`) → fog clears on next station → confetti. Stored in `level1Data.l1_bible.seenUnlock[n]`; tap to skip. Respects `prefers-reduced-motion` (jump directly).
- Subject complete (station 5 passed): zoom-out finale, all stations glow, "بطل الكتاب المقدس" badge.

## 5. Station screen (`#l1-lesson-screen`)

Journey bar: `📖 تعلّم → ✍️ لخّص → 🎮 العب`. Games tab locked until all learn cards are read.
Back from a running game saves partial score (best-of), returns to games tab.

### Learn — story cards
- 8–14 cards per station, swipe/tap navigation, segmented progress bar.
- Card types: `text` (heading + short body), `verse` (large text + ref + "احفظها" → `savedVerses`), `image` (scene art + caption), `diagram` (HTML rebuild: 7 days, Noah's sons tree, Terah family, Jacob wives → tribes, plagues ↔ gods, kingdom tree, sin cycle).
- Quick check card every 3–4 cards: one MCQ; correct = points + flash; wrong = reveal + explanation, continue.
- Optional video/extra block from `loadLearnTabConfig('l1_bible_n')` (existing admin learn-tab config) rendered at the top if present.

### Summary — guided
- Prompts: "٣ حاجات اتعلمتها" · "آية لمستني" · "هعيشها إزاي النهارده"; optional notebook photo + voice note (reuse the existing image/audio capture helpers).
- Minimum 40 characters across prompts before submit. Resubmit allowed; points awarded once.

## 6. Games

### Reusable game types (DOM, data-driven)
| id | Name | Mechanic |
|---|---|---|
| `timeline` | خط الزمن | drag cards onto an ordered road; wrong drop bounces back |
| `tree` | شجرة العيلة | drop names into an empty family tree; branches grow when filled |
| `connect` | وصّل | finger-draw lines between left/right items; correct line glows |
| `swipe` | فرز بالسوايب | swipe card left/right into 2 bins, timer + combo |
| `clues` | مين أنا؟ | clues revealed one by one; fewer clues = more points |
| `decode` | فك الشفرة | verse shown with no spaces; tap between letters to split into words |

### Signature arcade games (canvas, `requestAnimationFrame`, `CanvasFX` for effects)
| Station | Game | Mechanic |
|---|---|---|
| 0 | مكتبة اللغات | scrolls fly in; route each to عبري / آرامي / يوناني (or OT/NT) gates |
| 1 | فُلك نوح | catch falling animals in pairs into the ark before water rises; rainbow finale |
| 2 | يوسف من البير للقصر | 6-stage run (pit, Potiphar, prison, dreams, palace, forgiveness); pick the faithful choice before time runs out |
| 3 | عبور البحر | hold to keep the sea split while people cross; release on time to close it on the chariots |
| 4 | مصابيح جدعون | rhythm: break jars / blow trumpets on the beat to reveal 300 torches |
| 5 | مقلاع داود | aim + release sling at the target showing the correct answer |

### Per-station line-up
| St | Signature (50) | Games (30 each) |
|---|---|---|
| 0 | مكتبة اللغات | decode (continuous-text fact) · timeline (6 eras) · clues (intro facts) |
| 1 | فُلك نوح | "ابني العالم" (timeline variant: creations → days, world fills) · tree (Noah's sons → nations) · timeline (Seth's line) |
| 2 | يوسف من البير للقصر | tree (Terah family) · tree (Jacob wives → tribes) · clues (patriarchs) |
| 3 | عبور البحر | connect (plagues ↔ gods) · timeline (Moses' life) · swipe (wilderness true/false) |
| 4 | مصابيح جدعون | "دايرة القضاة" (tree variant: cycle wheel) · clues (judges) · decode (Ruth 1:16) |
| 5 | مقلاع داود | swipe (Saul/David/Solomon, 3-bin variant) · swipe (North/South) · swipe (Elijah/Elisha miracles) |

Shared: combo meter, 3 hearts (arcade), sounds via existing `initAudio`, `navigator.vibrate` where supported, results screen (stars + best), random subset from a larger pool per play.

## 7. Scoring

Per station max 200:

| Bucket | Max |
|---|---|
| learnRead (all cards viewed) | 20 |
| learnChecks (quick checks correct) | 20 |
| summary | 20 |
| games (signature 50 + 3 × 30) | 140 |

- Next station unlocks at **140** (70%). Stars: ★ ≥ 70%, ★★ ≥ 85%, ★★★ = 100%.
- Every bucket and game keeps its best; replays never reduce.
- Each game's raw score is normalised to its max (e.g. `round(max × correct/total)` plus capped bonuses) before storing.
- Existing global rewards (XP/gems) granted on first station pass, matching Level 2's order of magnitude.

## 8. Error handling / edge cases
- Map/image load failure → toast + list fallback of stations so play is still possible.
- Firestore offline → local save proceeds; cloud save retries through existing `saveToCloud` path.
- Locked lesson/subject → `checkLockOrPopup` popup, no navigation.
- Rotating back to portrait mid-map → existing landscape hint behaviour.
- Game interrupted (back / app hidden) → partial score saved, timers cleared (`visibilitychange`).
- Summary images/audio → reuse existing size limits/compression.

## 9. Verification
No test harness exists in the repo; verification is manual in a browser (mobile viewport, landscape):
1. Fresh player: hub Level 1 card opens map; only station 0 open.
2. Station 0: read cards → games tab unlocks; score to ≥ 140 → back to map → walk animation plays once, station 1 opens.
3. Reload → state persists (local + Firestore doc shows `l1_bible_0` keys).
4. Admin: player modal tab 7 shows the Level 1 summary; locking `card_level1` / `lesson_l1_bible_1` blocks navigation.
5. Level 2 flows and scores unchanged for an existing player.
6. Each of the 6 game types and 6 arcade games playable on a ~390×844 phone in landscape, no console errors.

## 10. Build order
1. Skeleton: files, hub card, screens, locks, admin/sw wiring, map with hotspots + states.
2. Station 0 end-to-end (cards, summary, its 4 games) — proves the whole loop.
3. Walk animation + unlock flow.
4. Stations 1–5 content + remaining game types and arcade games.
5. Finale, polish, asset compression, manual verification pass.
