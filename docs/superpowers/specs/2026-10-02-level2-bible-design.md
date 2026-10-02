# Level 2 — الكتاب المقدس «روح وحياة» / رسالة يعقوب (mini spec)

Source: `~/Documents/Michael/التلمذة/ترم ثاني/كتب ومطبوعات/روح وحياه - كتاب مقدس ٢.docx`
(text: scratchpad `bible2-clean.txt`; lectures start ~lines 3, 88, 162, 197, 284, 326, 396, 453).
Map: `~/Documents/الكتاب المقدس ٢.png` → `images/l2-bible-map.jpg` (4510×2539). 8 stations (map 1–8 → index 0–7).
Same engine / contracts / quality bar as the other subjects; same "fresh subject" rule as `l2_life`.

## Fresh subject
- Key `l2_bible`, station keys `l2_bible_0..7`, all scores start at 0.
- Old Level 2 `bible` lessons are deleted from `game.js`; `LEVEL2_SUBJECTS.bible` stays as a shim whose `lessons` are built
  from `L2_BIBLE` (compete rooms, weekly exam use new content only).
- Old player data purged once: keys starting `bible_` in stationScores / miniGameScores / lessonSummaries / watchedVideos /
  questionHistory, and `level2Data.bible` / `level2Data['subjectExam_bible_*']`. (`bibleReadingLog` etc. are unrelated fields — untouched.)
- The Level 2 card «كتاب مقدس» opens the new map; back → Level 2 subjects screen.

## Stations
| idx | Lecture | Arcade (`arcade`) | Idea |
|---|---|---|---|
| 0 | بانوراما الأسفار القانونية الثانية ومقدمة عنها | `scrollPuzzle` | rebuild torn scrolls: match each deuterocanonical book to its story/fact and join the pieces |
| 1 | طرق دراسة الكتاب المقدس والتأمل فيه | `studyLamp` | «سراج لرجلي كلامك» (مز ١١٩: ١٠٥): light the path through a dark maze by doing the study/meditation steps in order |
| 2 | مقدمة عن رسائل الجامعة (الكاثوليكون) + مقدمة الرسالة | `catholiconMail` | carry the 7 catholic epistles to their readers: route each letter (writer / recipients / theme) |
| 3 | الإصحاح الأول (يع ١) | `seaOfDoubt` | trials → patience; ask wisdom in faith «لا يرتاب البتة» (يع ١: ٦): keep steady on the waves; hearer vs doer |
| 4 | الإصحاح الثاني (يع ٢) | `noPartiality` | seat everyone in church without favoritism (يع ٢: ١-٤), then faith shown by works (Abraham, Rahab) |
| 5 | الإصحاح الثالث (يع ٣) | `tameTongue` | the bit, the rudder, the small fire (يع ٣: ٣-٦): steer the ship and put out sparks of bad words |
| 6 | الإصحاح الرابع (يع ٤) | `resistFlee` | «قاوموا إبليس فيهرب منكم. اقتربوا إلى الله فيقترب إليكم» (يع ٤: ٧-٨): resist temptations, draw near |
| 7 | الإصحاح الخامس (يع ٥) | `rainPrayer` | the patient farmer, Elijah's prayer and the rain (يع ٥: ٧، ١٧-١٨), the prayer of faith / سر مسحة المرضى (يع ٥: ١٤-١٥) |

Subject object (`level2-bible-data.js`, `var L2_BIBLE`): as `L2_LIFE` with `key:'l2_bible', name:'الكتاب المقدس', icon:'📖',
color:'#3b82f6', level:2, mapImage:'images/l2-bible-map.jpg', mapTiny:'images/l2-bible-map-tiny.jpg', mapRatio:4510/2539,
numberBase:1, backScreen:'level2-subjects-screen', finale:{title,text}`, `stations` = 8.
Images: `images/l1/bible2/` (see folder). games[0] arcade max 50 + 3 DOM max 30; ≥1 of scenario / memory / fillVerse per station.

## Accuracy (Coptic Orthodox)
- The deuterocanonical books are canonical in our church (طوبيا، يهوديت، تتمة أستير، الحكمة، يشوع بن سيراخ، باروخ، تتمة دانيال،
  المكابيين ١ و٢، المزمور ١٥١ …) — present them as the doc does; never as "apocrypha".
- James: Coptic Orthodox reading (faith and works together, mystery of unction from يع ٥: ١٤-١٥, the Catholicon read in the
  Liturgy after the Pauline epistle). Writer per the doc. Van Dyke wording, verified references; log fixes + items to confirm.
