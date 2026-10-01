# Level 1 — Arcade v2 + content audit (mini spec)

Feedback (user, 2026-09-29): arcade games are too basic; every fact and question shown to the
child must be verified; everything must feel Coptic / Egyptian Orthodox.

## A. Arcade v2 (`level1-arcade.js`, rewrite)

Interface is unchanged (see `2026-09-29-level1-contracts.md` section B). Engine (`level1.js`) is not edited by the arcade work.

### Quality bar for every game
- **Story frame**: intro panel (title, Bible reference, 1-2 line setup, how-to with an animated demo gesture), and an outro panel (verse + what we learned). All narrative text comes from the game's `data` (see C), never hard-coded Bible facts in code.
- **Real art, not bare emoji**: canvas-drawn scenes with parallax layers, gradients, lighting, animated characters (walk/idle/hit frames drawn with shapes; emoji only as small accents). Coptic visual language: Coptic cross ornaments, icon-style halos (gold disc + outline) on saints/prophets, Coptic geometric border patterns on panels, Coptic letters (ⲁ ⲃ ⲅ ...) as decorative glyphs, warm Egyptian palette (sand, Nile blue, gold, deep red).
- **Game feel**: easing on every motion, screen shake on hits, hit-stop, particle bursts, floating score popups, combo meter with tiers, streak fire, satisfying sounds (procedural WebAudio: soft pads, bells like a church "naqus/triangle" feel; low volume; mute button in HUD).
- **Progression inside a play**: 3 phases/waves with rising difficulty and one twist per game (power-up, boss, or special event). Clear win/lose states; 60-120 s.
- **Learning inside the game**: the 2+ `api.ask` checkpoints stay; each correct answer triggers a visible in-game reward; wrong answers show `explain` inside the game before resuming. Short "هل تعلم؟" fact banners from `data.facts` appear at calm moments.
- **Touch-first**: big targets, one-thumb play in landscape, works with mouse/keyboard, respects `prefers-reduced-motion` (no shake).
- **Performance**: steady on a mid Android phone: cap DPR 2, pre-render static layers to offscreen canvases, no per-frame allocations in hot loops, pause on hidden.

### Per game (concept upgrades)
| Game | v2 direction |
|---|---|
| langLibrary (st 0) | Alexandria library (Septuagint): scrolls roll along a moving shelf; route to 3 illuminated gates; wave 3 = "the 70 elders" rush with a slow-time power-up (hourglass). |
| ark (st 1) | Rain storm, rising water, animals arrive two-by-two from both sides; guide the ark ramp; lightning hazards; dove + olive leaf + rainbow finale with the covenant verse. |
| joseph (st 2) | 6 illustrated chapters (pit, caravan to Egypt, Potiphar, prison, Pharaoh's dreams, forgiveness); runner segments change scenery per chapter; choices are timed moral decisions; ends in the palace embrace scene. |
| redSea (st 3) | Moses' staff: hold to part the sea (faith meter), guide the people, pillar of fire/cloud holds back chariots; finale: the sea closes and the song of Moses appears (الهوس الأول — "فلنسبح الرب لأنه بالمجد قد تمجد"). |
| gideon (st 4) | Night camp, 300 torches; rhythm lanes jar / trumpet / torch; the Midianite camp panics as the beat builds; perfect streaks light the hillside. |
| sling (st 5) | Valley of Elah; David with five smooth stones; lion/bear warm-ups, then Goliath boss with armor that breaks on correct answers; verse «أنت تأتي إليّ بسيف ... وأنا آتي إليك باسم رب الجنود» (١ صم ١٧: ٤٥). |

## B. Content audit (`level1-bible-data.js`)
- Every card, check, game item, clue, swipe fact, decode verse and arcade question is checked against: (1) the servant's doc, (2) the Arabic Van Dyke text used in Coptic churches, (3) Coptic Orthodox teaching.
- Coptic Orthodox framing: Old Testament includes the deuterocanonical books (the Coptic canon; Tobit and Judith are part of the lessons); never state a Protestant 39-book OT count; use church vocabulary (السيد المسيح، القديس، الكتاب المقدس كلمة الله الموحى بها); where the church uses the story, add a short "في كنيستنا" note (e.g. الهوس الأول in the تسبحة, Jonah fast is out of scope, etc.). No content from outside the doc unless it is uncontroversial Scripture needed for options.
- Every `explain` cites a reference where possible (e.g. "(تك ٦: ١٤)").
- Output: corrected data file + an audit log at `docs/superpowers/specs/2026-09-29-level1-content-audit-log.md` listing each change (old -> new, reason).

## C. Arcade data fields (additions to games[0].data)
```js
intro: { ref:'تكوين ٦ – ٩', text:'...' },     // setup shown before play
outro: { verse:'...', ref:'(تك ٩: ١٣)', lesson:'...' },
facts: ['...', '...']                          // 3-5 short "هل تعلم؟" lines, doc-sourced
```
Existing fields (`questions`, `stages`, `items`, `gates`, `lanes`, `animals`, `hazards`) keep their shape.

## D. Engine fixes (level1.js / level1.css)
- Arcade frame is mounted on `document.body` (not inside `.screen`, which has `z-index:1` and an entry transform that traps `position:fixed` children).
- `.l1-lesson` gets `width:100%` (`.screen.active` centers children, shrinking the column).
- Coptic ornament pass on Level 1 UI (cross dividers, border pattern on cards and sheets).

## Ownership (parallel work)
- Arcade agent: `level1-arcade.js`; in `level1-bible-data.js` only the non-`questions` fields of each station's `games[0].data` (+ the new `intro/outro/facts`). Uses Edit only, never full-file Write, on the data file.
- Content agent: everything else in `level1-bible-data.js`, including all `questions` arrays. Uses Edit only.
- Engine: level1.js / level1.css / index.html (lead).
