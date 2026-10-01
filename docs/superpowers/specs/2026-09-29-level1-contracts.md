# Level 1 — code contracts (mini spec)

Companion to `2026-09-29-level1-bible-design.md`. Three files, all plain global scripts
(no modules, no build), loaded in this order after `game.js`:

1. `level1-bible-data.js` — defines `var L1_BIBLE = {...}` (content only, no logic)
2. `level1-arcade.js` — defines `var L1_ARCADE = {...}` (6 canvas games)
3. `level1.js` — engine (map, lesson shell, DOM game types, scoring). Owns `LEVEL1_SUBJECTS = { l1_bible: L1_BIBLE }`.

All user-facing text is Egyptian-colloquial Arabic, warm/encouraging, faith-themed, matching the doc.
No emojis in code comments. Emojis are fine inside user-facing strings.

## A. `L1_BIBLE` data schema

```js
var L1_BIBLE = {
  key: 'l1_bible', name: 'الكتاب المقدس', icon: '📖', color: '#d4a24c',
  mapImage: 'images/l1-bible-map.jpg', mapTiny: 'images/l1-bible-map-tiny.jpg',
  stations: [ /* exactly 6, index 0..5 */ {
    title: 'عصر الخليقة',            // short era/station name
    subtitle: 'من الخليقة لإبراهيم',   // one line
    refs: 'تكوين ١ – ١١',             // '' for station 0
    topics: ['خلق العالم','الإنسان','السقوط','الوعد'],  // 4 short words (map signposts)
    verse: { text: '...', ref: '(مز ٨: ٥-٦)' },          // era verse from doc ("نبذة عن العصر")
    cards: [ Card, ... ],   // 8..14 learn cards, with a 'check' card every 3-4 cards (3-4 checks total)
    games: [ Game, Game, Game, Game ]  // exactly 4: games[0] is the arcade signature (max 50), games[1..3] max 30
  } ]
};
```

### Card
```js
{ type:'text',    title:'...', body:'...' }                   // body: plain text, may contain <b>..</b> and '\n'
{ type:'verse',   text:'...', ref:'(تك ١: ١)' }
{ type:'image',   src:'images/l1/bible/ark.jpg', title:'...', caption:'...' }
{ type:'diagram', title:'...', kind:'steps',   items:[{t:'اليوم الأول', d:'النور'}] }        // numbered steps
{ type:'diagram', title:'...', kind:'chain',   items:['سام','أرفكشاد', '...'] }             // arrow chain
{ type:'diagram', title:'...', kind:'columns', cols:[{title:'شاول', color:'#e74c3c', items:['...']}] }  // 2-3 cols
{ type:'diagram', title:'...', kind:'pairs',   left:'الضربة', right:'ضد', rows:[['ماء النهر دماً','الإله أوزوريس']] }
{ type:'diagram', title:'...', kind:'tree',    root:{ label:'تارح', children:[{label:'إبراهيم', note:'زوج سارة', children:[]}] } }
{ type:'diagram', title:'...', kind:'cycle',   items:['خطية','ذل','صراخ','مخلص','راحة'] }
{ type:'check',   q:'...', options:['a','b','c','d'], correct:1, explain:'...' }   // options 3-4, correct = index
```

Images available in `images/l1/bible/`: creation, adam-eve, ark, abraham-journey, abraham-lot,
joseph-brothers, joseph-purity, moses-basket, golden-calf, balaam, ruth-naomi, samuel-anoints,
david-shepherd, elijah-chariot, tobit-angel, judith (all `.jpg`).

### Game (common fields)
```js
{ id:'s1_ark', type:'<type>', title:'فُلك نوح', desc:'one line how to play', icon:'🚢', max:50|30, data:{...} }
```
`id` unique across the subject, snake-case, prefixed with `s<station>_`.

### Game `data` per type (DOM types, implemented in level1.js)
```js
timeline: { prompt, items:['first','second',...], pick:6, slotLabels?:['اليوم ١',...] }
          // items in correct order; engine picks `pick` random items keeping order; slotLabels optional per-position labels (then pick is ignored, all items used)
          // layout:'cycle' optional -> slots drawn on a circle
tree:     { prompt, root:{label, children:[...]}, hide:5 }   // engine hides `hide` random non-root labels for the player to place
connect:  { prompt, left:'title', right:'title', pairs:[['a','b'],...], pick:5 }
swipe:    { prompt, bins:['شاول','داود','سليمان'], items:[{t:'من سبط بنيامين', bin:0}], pick:12, time:60 }  // 2 or 3 bins
clues:    { prompt, rounds:[{ answer:'نوح', clues:['clue1 (hard)','clue2','clue3 (easy)'], options:['نوح','إبراهيم','شيث','لامك'] }], pick:4 }
decode:   { prompt, verses:[{ text:'في البدء خلق الله السماوات والأرض', ref:'(تك ١: ١)' }], pick:2 }  // no tashkeel in decode text
```

### Arcade game `data` (type:'arcade', field `arcade` names the game in L1_ARCADE)
Every arcade `data` has `questions: [{q, options:[3-4], correct, explain}]` (4-6) used as mid-game checkpoints.
```js
{ type:'arcade', arcade:'langLibrary', data:{ gates:['عبري','آرامي','يوناني'], items:[{t:'لغة العهد القديم', gate:0}, ...], questions:[...] } }
{ type:'arcade', arcade:'ark',         data:{ animals:['🦁','🐘','🦒','🐑','🐄','🐪','🐎','🦓','🐇','🐓','🕊️','🐢'], hazards:['🪨','⚡'], questions:[...] } }
{ type:'arcade', arcade:'joseph',      data:{ stages:[{ title:'البير', emoji:'🕳️', text:'situation', options:[{t:'...', good:true},{t:'...', good:false}], fact:'short fact shown after' }], questions:[...] } }  // 6 stages
{ type:'arcade', arcade:'redSea',      data:{ questions:[...] } }
{ type:'arcade', arcade:'gideon',      data:{ lanes:['🏺 الجرة','📯 البوق','🔥 المصباح'], questions:[...] } }
{ type:'arcade', arcade:'sling',       data:{ questions:[...] } }   // questions are the targets: options become moving targets
```

## B. `L1_ARCADE` interface

```js
var L1_ARCADE = {
  ark: function (host, data, api) { ...; return { destroy: function(){} }; },
  ...
};
```
- `host`: an empty `<div>` the game fills (full width, height ~ available viewport; landscape or portrait). Game creates its own `<canvas>` sized to host with devicePixelRatio (cap 2) and handles `resize`.
- `api` (provided by level1.js):
  - `api.ask(question, cb)` — shows a modal MCQ over the game (game must pause its loop while waiting); `cb(correct:boolean)`.
  - `api.end(rawScore, rawMax)` — call exactly once when the game ends; engine normalises to the game's `max`.
  - `api.sfx(name)` — `'good' | 'bad' | 'combo' | 'win' | 'tick'` (engine maps to existing `playCorrectSound` etc).
  - `api.fx(x, y)` — particle burst at host-relative coords (wraps `CanvasFX.burst`).
  - `api.hud(text)` — sets the engine's HUD line above the host (score / lives / timer).
- Game length target: 60-120 seconds. Touch-first (pointer events), works with mouse. 3 lives where it makes sense.
- Must stop its `requestAnimationFrame` loop and remove listeners in `destroy()` (engine calls it on back/exit) and pause on `document.hidden`.
- Draw with emoji + canvas shapes/gradients only (no external images). RTL text via `ctx.direction='rtl'`, font `'Cairo', sans-serif`.
- Include at least 2 `api.ask` checkpoints per play; correct answer gives a visible in-game bonus.

## C. Storage (engine only)
Station key `l1_bible_<n>`; `GameState.stationScores[key] = {learnRead, learnChecks, summary, games, total}`;
`GameState.miniGameScores[key + '_mg_' + game.id]` = best normalised score; `GameState.lessonSummaries[key]`;
`GameState.level1Data.l1_bible = { seenUnlock:{}, savedVerses:[] }`. Pass = total ≥ 140 of 200.
