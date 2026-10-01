# Level 2 — مهارات الحياة والقيادة «جيل يصنع التغيير» (mini spec)

Source: `~/Documents/Michael/التلمذة/ترم ثاني/كتب ومطبوعات/قائد ناجح - مهارات الحياة والقيادة .docx`
(text: scratchpad `life-clean.txt`; lectures start at lines ~9, 78, 146, 227, 311, 363). Map: `~/Documents/القيادة.png`
→ `images/l2-life-map.jpg` (4959×2722). Same engine / contracts / quality bar as the Level 1 subjects.

## Fresh subject (user decision 2026-09-30)
- New key `l2_life`; station keys `l2_life_0..5`. All scores start at 0.
- The old Level 2 `life` lessons (اعرف نفسك، قوة الكلمة…) are deleted from `game.js`. `LEVEL2_SUBJECTS.life` stays only as a
  shim whose `lessons` are generated from `L2_LIFE` (name, verse, questions = check cards + arcade questions), so compete
  rooms, the weekly exam and other shared features draw from the new content only.
- Old player data for `life` is purged on the client: `stationScores/miniGameScores/lessonSummaries` keys starting `life_`,
  and `level2Data.life` / `level2Data['subjectExam_life_*']`.
- The Level 2 card «جيل يصنع التغيير» opens the new map; back goes to the Level 2 subjects screen.

## Stations (map numbers 1–6 → index 0–5), titles match the Word file
| idx | Lecture | Arcade (`arcade`) | Idea |
|---|---|---|---|
| 0 | أنواع الشخصيات | `personalityMatch` | meet people, read their type (D/I/S/C from the doc), send them to the right group, then talk to each type the right way |
| 1 | اقبل نفسك وشخصيتك | `mirror` | the mirror shows lies ("مش هتقدر"، "إنت ولد") — shatter lies with God's truth («لا تقل إني ولد» إر ١: ٧، مز ١٣٩: ١٤) |
| 2 | التخطيط والرؤية والأهداف | `nehemiahWall` | Nehemiah rebuilds the wall in 52 days: plan, gather stones, assign families, trowel in one hand and sword in the other (نح ٤) |
| 3 | تنظيم الوقت | `dayPlanner` | fit tasks into a day by priority (important/urgent matrix from the doc), avoid time-wasters, keep time for prayer |
| 4 | تحمل المسؤولية | `carryResponsibility` | carry the stone without dropping it; refuse blame/complaint traps (doc: اللوم والشكوى) |
| 5 | حل المشكلات واتخاذ القرارات | `decisionPath` | walk the doc's problem-solving / decision steps through a branching path; pray, gather info, choose, act |

Subject object (`level2-life-data.js`, `var L2_LIFE`): schema of `L1_SERVICE` with
`key:'l2_life', name:'مهارات الحياة والقيادة', icon:'🌟', color:'#f39c12', level:2, mapImage:'images/l2-life-map.jpg',
mapTiny:'images/l2-life-map-tiny.jpg', mapRatio:4959/2722, numberBase:1, backScreen:'level2-subjects-screen', finale:{title,text}`.
Images in `images/l1/life/`: personality-types, disc, disc-grid, field-women, two-men, self-worth, mirror, christ-children,
jeremiah-dont-say, nehemiah-build, nehemiah-walk, nehemiah-plan, wall-building, christ-embrace, planning-stages, smart,
priorities, time-wasters, helping-hand, paralytic-roof, problem-steps, decision-steps, elder-writing (.jpg).
Games: games[0] arcade (max 50) + 3 DOM (max 30); every station uses ≥1 of scenario / memory / fillVerse.

## Accuracy
Life-skills content framed in Coptic Orthodox faith (prayer, the Bible, the church, spiritual father / أب الاعتراف where the
doc has it). Verses in Van Dyke with verified references. Personality models (DISC, SMART, time matrices) are tools, not
doctrine — present them as the doc does. Log reference fixes and "items to confirm with the servant".
