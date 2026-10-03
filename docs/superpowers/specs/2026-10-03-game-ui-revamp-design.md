# Game UI Revamp ("Chunky cards" + full gamification) — Design

Branch: `feature/game-ui-revamp` (main stays untouched until the user merges).
Approved mockups: `.superpowers/brainstorm/*/content/hub-cards-v2.html`, `all-screens.html`, `gamify-v3.html`.

## Goal
Make the player app look and feel like a trendy casual mobile game (Brawl Stars / Subway Surfers / Clash Royale family): bright, chunky, animated, rewarding. Keep the 3D characters as they are. Keep the faith purpose visible ("هدفنا مش النقط", verse cards, calmer spiritual screens).

## Decisions (user said "do it as you see fit")
| Topic | Decision |
|---|---|
| Direction | B "Chunky cards": keep the scrolling hub order, restyle everything as bold outlined game cards, plus v3 gamification |
| Themes | Two looks only: **day** (bright sky) and **night** (navy + moon). Old themes (dark/light/orthodox/ocean) map to `auto`. Settings offers auto / day / night; auto = night between 18:30 and 05:30 local time |
| Icons | Hero items = Weave-generated 3D PNG icons; small glyphs stay Font Awesome (already loaded) |
| Holy figures | Christ never drawn as a cartoon; backgrounds use symbols (light, cross, boat, scenery) |
| Bottom tab bar | Added on the hub (الرئيسية / مغامرات / منافسات / اسأل / فريقي) |
| Character stats | No invented stats. Character select shows tier + weapon only |
| Motion | transform/opacity only; everything disabled under `prefers-reduced-motion` |
| Scope | Player app only (`index.html`, `style.css`, `level1.css`, JS render code). `admin.html` and `tournament*.html` untouched |

## Architecture
No build step, no framework (project rule). Two new files loaded **after** existing ones:

- `game-ui.css` — the skin: design tokens (day/night), fonts (Lalezar headings, Baloo Bhaijaan 2 body), kit components (`.gx-btn`, `.gx-ribbon`, `.gx-card`, `.gx-pill`, `.gx-shine`, `.gx-badge`, `.gx-topbar`, `.gx-nav`), ambient layers (clouds, sparkles, stars), and overrides that restyle existing screen classes. Because it loads last, it can be removed to roll back instantly.
- `game-ui.js` — globals in the existing style (`GameUI` object): theme auto/day/night, star-fly + counter pop, gold toast, bottom nav, daily reward popup, season track, reward moments (chest, tier up), quiz juice helpers. Called from existing hooks with `typeof GameUI !== 'undefined'` guards so game.js keeps working if the file is absent.

Existing game.js logic is only touched at hook points (hub render, daily login, results, quiz answer, boss hit, achievement popup, wheel). No bulk refactor.

## New mechanics (data)
| Mechanic | Data | Notes |
|---|---|---|
| Daily attendance reward (7-day cycle) | `dailyRewardDate` (last claimed date) | Replaces the silent +5 gems in `checkDailyLoginXP()`; day N = `((loginStreak-1) % 7) + 1`; table in `game-ui.js` |
| Season track "طريق البطل" | `seasonId`, `seasonStartStars`, `seasonClaimed[]`, `seasonStations` | 8-week seasons from a fixed epoch; progress = stars earned this season; heroes row unlocks after 4 stations finished this season |

Both fields are added to `saveToCloud()` and the login load path. Firestore rules unchanged.

## Weave asset list (generated after the Figma account is linked to Weave)
Style reference = existing station maps (`images/l2-bible-map.jpg`): bright, saturated, 3D-cartoon, warm light. All art text-free except the logo.
- Backgrounds (~10): hub day, hub night, login, spiritual, compete arena, quiz, boss arena, shop, leaderboard, Q&A
- Card art (~8): L1, L2, 4 subject worlds, compete, fun zone
- Bosses (4): جليات, أريوس + 2 more
- Logo (1–3 tries): "مين البطل" gold 3D
- Icons (~40): currencies, chest open/closed, gift, wheel, trophy, crown, medal, shield, lamp, book, candle, dove, exercise, power-ups ×5, heart, lock, map, team, frames ×4, tier emblems ×3
Output saved as compressed WebP under `images/ui/` (target < 150 KB each); added to `sw.js` cache list.

## Phases (each = one commit, previewable)
1. Foundation: `game-ui.css` / `game-ui.js`, fonts, tokens, day/night, ambient layer, character cut-outs in `images/chars/`
2. Hub v3: top bar, quick-action row, boss banner, daily strip, season strip, quests, world cards, bottom nav
3. Shared kit applied to all screens: top bars, buttons, cards, modals, toasts
4. Gameplay: quiz HUD + juice, results/victory, boss battle, mini-game shells
5. Reward moments: daily popup, wheel, chest, tier up, achievements toast/wall
6. Journey: subject pickers, station maps, lessons
7. Compete, leaderboard, shop, spiritual, Q&A, social, settings, night polish
8. Weave art swap-in + `sw.js` cache bump

## Testing
Manual in the browser preview at phone size (375×812), day and night, RTL, reduced-motion on. Check console for errors on each touched screen. Real login uses Firestore, so verification uses an existing test player or a fresh registration on the local server.
