# Game UI — Weave asset list

Generate in Figma Weave once the Figma account is linked (https://app.weavy.ai/settings?section=profile).
Output → compress to WebP (< 150 KB backgrounds, < 40 KB icons) → `images/ui/` → swap into `game-ui.css` / `index.html` → add to `sw.js` cache list.

## Shared style prompt (prefix for every image)
> Bright, saturated 3D cartoon mobile-game art in the style of Brawl Stars / Clash Royale, soft warm sunlight, glossy rounded shapes, clean edges, cheerful and faith-friendly, Middle-Eastern biblical setting (Galilee, Jerusalem, desert, Coptic church), no text, no letters, no watermark.

Reference image for every run: `images/l2-bible-map.jpg` (matches the target look).
Rules: never draw Christ as a cartoon (use light rays, a cross, a boat, scenery instead). Keep the existing 3D characters as they are.

## Backgrounds (portrait 1080×1920 unless noted)
| File | Used on | Prompt (after prefix) |
|---|---|---|
| `bg-hub-day.webp` | home hub, lobby screens (day) | Wide sunny sky over the Sea of Galilee, fishing boats, green hills, distant Jerusalem walls, soft clouds, open space in the middle for UI |
| `bg-hub-night.webp` | same (night) | Same scene at night, deep navy sky, big glowing crescent moon, stars, warm lantern lights in the village |
| `bg-login.webp` | splash / login | Golden sunrise behind a hill with a glowing cross on top, rays of light, path leading up, empty foreground for a title |
| `bg-spiritual.webp` | Bible / devotion / exercises | Calm Coptic church interior, candles, soft purple and rose light through arched windows, peaceful |
| `bg-arena.webp` | compete / VS | Colorful sports-arena style amphitheatre with red and blue team banners, spotlights, confetti |
| `bg-quiz.webp` | quiz / mini-games | Abstract purple game background with soft light rays and floating sparkles, center kept clear |
| `bg-boss.webp` | boss battle | Dramatic dark purple battlefield valley at dusk, red glowing sky, rocks, embers (no gore) |
| `bg-shop.webp` | shop | Treasure hall with gold coins, armor stands, shields and scrolls on wooden shelves, warm light |
| `bg-leaderboard.webp` | leaderboard | Royal hall with a three-step golden podium, crowns, red carpet, spotlights |

## Card art (landscape 1200×600, subject on the left, right side calm for text)
| File | Card | Prompt |
|---|---|---|
| `card-l1.webp` | المستوى الأول | Ancient scroll library and tents in the desert, sheep, golden light |
| `card-l2.webp` | المستوى الثاني | Disciples' path along the Galilee shore toward the sunrise, boats, light rays |
| `card-faith.webp` | إيماننا الأرثوذكسي | Coptic church dome with crosses, glowing icons on the walls |
| `card-james.webp` | روح وحياة (يعقوب) | Open Bible on a stone table, quill, olive branches, warm light |
| `card-life.webp` | جيل يصنع التغيير | Young people building a wall together (Nehemiah), tools, teamwork, sunrise |
| `card-compete.webp` | المنافسات | Two team flags (red, blue) crossing over a trophy, confetti |

## Bosses (transparent PNG 800×1000, full body, facing left)
| File | Prompt |
|---|---|
| `boss-goliath.webp` | Giant Philistine warrior Goliath, bronze helmet and armor, huge spear, intimidating but cartoon-friendly for kids |
| `boss-arius.webp` | Stylized dark-robed heretic figure Arius holding a dark scroll, shadowy purple aura, cartoon villain (not scary for kids) |

## Logo
| File | Prompt |
|---|---|
| `logo-min-el-batal.webp` | Chunky 3D golden game logo reading «مين البطل؟» in bold Arabic, small crown on top, thick dark-brown outline, glossy (try 2–3 runs; Arabic text from AI is unreliable — keep the CSS logo if no run is correct) |

## Icons (square 512×512, transparent, single object, glossy 3D, centered)
star, gem, flame (streak), chest closed, chest open, gift box, prize wheel, shop cart, trophy, crown, medal, shield, sword, helmet, oil lamp (lit), open Bible, candle, dove, praying hands, dumbbell (exercises), scissors 50:50, skip arrow, snowflake (freeze), light bulb (hint), x2 badge, heart, padlock, map scroll, team flag, gear, compass, museum building, chart arrow, bell, camera (selfie), speech bubble (ask), friends group, megaphone (posts), bronze/silver/gold shield emblems.

≈ 9 backgrounds + 6 cards + 2 bosses + up to 3 logo tries + 42 icons ≈ **62 generations**, ≈ 120 with retries.
