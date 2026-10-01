# Level 1 — مادة الخدمة (mini spec)

Source: `~/Documents/Michael/التلمذة/ترم اول/كتب ومطبوعات/كتاب انا خَدّام المسيح – مبادئ الخدمة الحقيقية.docx`
(text extract: scratchpad `service-clean.txt`). Map: `~/Documents/الخدمه.png` → `images/l1-service-map.jpg`.
Same engine, contracts and quality bar as the Bible subject (`2026-09-29-level1-*.md`).

## Stations (map numbers 1–6 → station index 0–5)
| idx | Map | Lecture |
|---|---|---|
| 0 | 1 | يعني إيه خدمة؟ |
| 1 | 2 | الخدمة محبة لربنا وللناس |
| 2 | 3 | الخدمة اتضاع ووداعة |
| 3 | 4 | الخدمة بذل وعطاء |
| 4 | 5 | الخدمة ملهاش مكان ولا وقت محدد |
| 5 | 6 | بركات الخدمة الحقيقية |

Each doc lecture has: أهداف، آية، شرح بسيط، أسئلة (س١..س٤)، سؤال لذيذ، تطبيق عملي، تأمل، شواهد وقصص. Cards map to these
(the "تطبيق عملي" and "تأمل" become a closing `text` card and a `verse`-style prayer card).

## Subject object (`level1-service-data.js`, `var L1_SERVICE`)
Same schema as `L1_BIBLE` plus:
```js
key:'l1_service', name:'الخدمة', icon:'🤲', color:'#2f9e8f',
mapImage:'images/l1-service-map.jpg', mapTiny:'images/l1-service-map-tiny.jpg', mapRatio:4253/2837,
numberBase:1,                       // station index 0 is shown as "1"
finale:{ title:'خادم أمين', text:'...' },   // shown after the 6th station
```
(`L1_BIBLE` gets `numberBase:0`, `zeroBadge:true`, `finale:{title:'بطل الكتاب المقدس', text:...}` — engine defaults.)

Images available in `images/l1/service/`: feet-washing, good-samaritan, good-samaritan-2, christ-children, baptism-icon,
saint-water, habib-girgis, candle, st-mark, widow-mites, bishoy-kamel, father-embrace, heaven-stairs, serving-crowd (.jpg).

## New DOM game types (engine, `level1.js`)
```js
scenario:  { prompt, rounds:[{ emoji:'🧒', situation:'...', options:[{t:'...', good:true, why:'...'}, {t:'...', good:false, why:'...'}] }], pick:5 }
           // chat-style "موقف": pick the servant-like response; exactly one good option per round (2-3 options); `why` shown after the tap
memory:    { prompt, pairs:[['المحبة تتأنى','١ كو ١٣: ٤'], ...], pick:6 }        // flip-card pairs; match a with b
fillVerse: { prompt, verses:[{ text:'...', ref:'(...)', missing:['word','word'], distractors:['w','w'] }], pick:3 }
           // `missing` words appear verbatim (space-separated) in `text`; engine blanks them in order; tap bank chips to fill
```
All earlier types (timeline, tree, connect, swipe, clues, decode) remain available.

## Games per station (games[0] arcade max 50, games[1..3] DOM max 30; every station uses ≥1 new type)
| idx | Arcade (`arcade` name) | Idea (doc source) |
|---|---|---|
| 0 | `rebekahWell` | رفقة وسقي الجمال (تك ٢٤): draw water, serve the camels generously (cup of cold water, مت ١٠: ٤٢) |
| 1 | `goodSamaritan` | السامري الصالح (لو ١٠): on the Jericho road, stop for the wounded, bandage, carry to the inn — love without favoritism |
| 2 | `washFeet` | غسل الأرجل (يو ١٣) + خميس العهد: gentle timed washing of each disciple's feet; pop pride bubbles (كرامتي، أنا الأول) |
| 3 | `widowGift` | الأرملة والفلسين (مر ١٢) / أرملة صرفة: give from the heart — choose true giving vs showing-off, fill the treasury with love |
| 4 | `everywhere` | «يجول يصنع خيرًا» (أع ١٠: ٣٨): run through home / school / church / club / street across day and night, doing good anywhere |
| 5 | `harvest` | بركات الخدمة: serve and watch the tree bear fruit, blessings fall; finale "إلى المجد" with the crown |

Arcade `data` shape: `{ intro, outro, facts, phases, questions, ...game-specific fields chosen by the arcade author }`.
`questions` are written by the content author; everything else in `games[0].data` by the arcade author.

## Coptic Orthodox accuracy rules
- Verses in Van Dyke wording with correct references; fix doc reference typos (e.g. "٢كو ٢٠: ١٨" is ٢ كو ٥: ٢٠, "عب ١٤: ١" is عب ١: ١٤) and log them.
- Saints/examples used in games: Coptic Orthodox or undivided-church saints (أبونا بيشوي كامل، أبونا ميخائيل إبراهيم، الأرشيدياكون حبيب جرجس، المعلم إبراهيم الجوهري، القديسة مونيكا، القديس أوغسطينوس، الشهيد إسطفانوس، د. مجدي يعقوب).
  The doc also lists الأم تريزا (Catholic; doc dates 1910–1970 are wrong: she died 1997) — do not use her in cards or games; flag it for the servant.
- Church context where the doc has it: طقس خميس العهد (لقان وغسل الأرجل)، التناول، الاعتراف، وسائط النعمة.

## Engine changes
- Level 1 subjects screen (`#l1-subjects-screen`): the hub card opens it; lists الكتاب المقدس، الخدمة (open) and سلوكيات، تاريخ كنيسة (قريباً), with progress per subject. Map back → subjects.
- Per-subject: `numberBase`, `zeroBadge`, `finale`, `mapRatio`; map positions and routes for `l1_service`.
- Admin: `l1_service` in SUBJECTS / summaries; sw.js precache.
