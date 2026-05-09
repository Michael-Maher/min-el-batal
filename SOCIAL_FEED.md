# Social Feed — Spec & Implementation Status

Branch: `feature/social-feed`

## Decided defaults (Phase 1 MVP)

- **Authors:** admin posts + auto-celebration system posts only. **No player-authored posts in Phase 1.**
- **Expiry:** 7 days, via Firestore native TTL on `expiresAt` field.
- **Hard cap:** feed query is `limit(50)` — bounded even if TTL fails.
- **Reactions:** ❤️ 🙏 ✝️ 🔥 ⭐ (5 wholesome emojis, one-per-player).
- **Comments:** players can comment on admin posts in v1, max 200 chars.
- **Hub card:** new "📢 المنشورات" card on home hub, lockable via admin (`card_social`).
- **Images:** Firebase **Storage** for uploads (NOT base64 in Firestore).

## Why these defaults
See chat history. Briefly: TTL 7d is friendlier than 24h for weekly players; admin-only posts mean zero moderation burden in v1; storage for images keeps Firestore docs ~1 KB; auto-celebrations drive most of the engagement at zero cost.

## Data model

### `posts/{postId}`
```
authorId         string                            // admin uid or 'system'
authorName       string                            // denormalized
authorAvatar     string                            // URL
authorRole       'admin' | 'system'
type             'announcement' | 'devotional' | 'celebration' | 'verse'
text             string  (≤ 500 chars)
imageUrl         string | null                     // Firebase Storage URL
reactions        map     { phone: emoji }          // one per player
reactionCounts   map     { '❤️': 5, '🙏': 3, ... } // denormalized
commentCount     number
pinned           bool
status           'approved' | 'flagged'            // 'pending'/'rejected' reserved for v2
reportCount      number
createdAt        timestamp                          // serverTimestamp
expiresAt        timestamp                          // null if pinned. TTL field.
```

### `posts/{postId}/comments/{commentId}`
```
authorId, authorName, authorAvatar
text          string  (≤ 200 chars)
createdAt     timestamp
expiresAt     timestamp
reportCount   number
```

## Firestore TTL setup (one-time, manual)

In Firebase Console → Firestore → TTL:
1. Add policy on `posts` collection, field `expiresAt`.
2. Add policy on collection group `comments`, field `expiresAt`.

Once added, Google deletes documents whose `expiresAt` has passed within ~24h. Free.

## Firebase Storage layout

```
gs://min-el-batal/social/posts/{postId}.jpg
```

Compress client-side to max 1280px wide / 200 KB before upload. Use existing image compression helper if there is one, else implement inline.

## Firestore rules additions

Append to `firestore.rules`:
```
match /posts/{postId} {
  allow read, write: if true;
  match /comments/{commentId} {
    allow read, write: if true;
  }
}
```

(Open like everything else for now.)

## Lock integration

Add `card_social` to:
1. `applyDashboardLockUI()` map in `game.js` — visual badge.
2. `_LOCK_GATE` map at top of `showScreen()` — block `social-screen` and `social-post-screen`.
3. Admin `LOCK_KEYS` array (~line 3910 in admin.html) — admin UI to toggle.

## Auto-celebration triggers

System auto-posts on these events (no UI prompt to player):

| Event | Hook location | Sample text |
|---|---|---|
| Subject completion (all 6 stations done) | `updateStationScore()` after total threshold | "🎉 {name} خلّص مادة {subject}!" |
| 7-day login streak | `checkDailyLoginXP()` when streak hits 7 | "🔥 {name} مكمّل ٧ أيام متواصلة!" |
| 30-day login streak | same | "👑 {name} مكمّل ٣٠ يوم متواصل!" |
| 1000 stars | `awardStars()` on threshold cross | "⭐ {name} وصل لـ ١٠٠٠ نجمة!" |
| Compete tournament win | `competeRoom` end logic | "🏆 {name} كسب بطولة!" |

Implementation: `postCelebration(type, vars)` helper in game.js, fire-and-forget.

Dedupe: store `lastCelebrationKey` on player doc per event type so we don't double-post (e.g., if `awardStars` is called many times after crossing 1000).

## UI screens to add

### Player side (`index.html`)
1. **Hub card** — added to `.hub-cards-grid` near other cards.
2. **`#social-screen`** — feed list, pull-to-refresh, "open post" tap.
3. **`#social-post-screen`** — single post detail with reactions + comments.
4. CSS for both in `style.css` (RTL, matches existing aesthetic).

### Admin side (`admin.html`)
1. **New top-level tab** "📢 المنشورات" (`showAdminTab('posts')`).
2. **Create form**: type, text, image upload, pinned checkbox, expiry override.
3. **List view**: table of all posts with edit/delete/pin/unpin.
4. **Comments view**: collapsible per-post, with delete and ban-author actions.

## Cost guard

- Listener on feed only opens when `social-screen` becomes active; close on leave.
- Feed query: `where('status','==','approved').orderBy('createdAt','desc').limit(20)`.
- Don't auto-load comments — load on tap into post detail.
- Image lazy-loaded.

## Phase 1 implementation checklist

- [x] `firestore.rules` updated with `posts` + `comments` rules
- [x] `CLAUDE.md` + `SOCIAL_FEED.md` (this file) committed
- [x] `game.js`: helpers `subscribeFeed`, `unsubscribeFeed`, `toggleReaction`, `submitComment`, `postCelebration`, `formatRelativeTime`, `escapeAttr`, `linkifyText`
- [x] `game.js`: `_LOCK_GATE` updated for `social-screen` and `social-post-screen`
- [x] `game.js`: `applyDashboardLockUI()` map updated for `card_social`
- [x] `game.js`: auto-celebration hook for **subject_complete** wired in `updateStationScore()`
- [x] `game.js`: **streak_7 / streak_30** wired in `checkDailyLoginXP()`
- [x] `game.js`: **stars_milestone** (1000 / 5000) wired in `renderHomeHub()` (dedupe inside postCelebration prevents double-post)
- [x] `game.js`: **tournament_win** wired in compete winner block
- [x] `game.js`: `updateSocialUnreadBadge()` (1 throttled read/minute, dot indicator on hub card)
- [x] `index.html`: hub card on home screen
- [x] `index.html`: `#social-screen` with feed list container
- [x] `index.html`: `#social-post-screen` with detail layout
- [x] `style.css`: feed styling appended at end
- [x] `admin.html`: `LOCK_CARDS` includes `card_social`
- [x] `admin.html`: PAGES + sidebar nav + `page-posts` HTML container
- [x] `admin.html`: `renderPosts`, `openCreatePostModal`, `savePost`, `togglePinPost`, `deletePost`, image compress+upload
- [x] `admin.html`: Firebase Storage SDK (compat) script tag added
- [ ] **Manual TTL setup in Firebase Console** — see deploy notes below
- [ ] **Firebase Storage rules** — see deploy notes below
- [ ] Test end-to-end after deploy
- [ ] Merge `feature/social-feed` → `main`

## Manual setup needed before merging to main

### 1. Enable Firestore TTL (one-time, free)
1. Open https://console.firebase.google.com/project/min-el-batal/firestore/ttl
2. Add policy on collection `posts`, field `expiresAt`.
3. Add policy on collection-group `comments`, field `expiresAt`.

Pinned posts have `expiresAt = null`, so they never get deleted.

### 2. Enable Firebase Storage (if not already)
1. Open https://console.firebase.google.com/project/min-el-batal/storage
2. Click "Get Started" if first time, accept default bucket.
3. Set storage rules to match Firestore (open for now):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /social/posts/{postId} {
      allow read, write: if true;
    }
    match /{allPaths=**} {
      allow read: if true;
    }
  }
}
```

### 3. Optional — orphan image cleanup
Without a Cloud Function, post images in storage stay even after their Firestore doc is TTL-deleted. Two options:
- (Easier) Add a manual cleanup chore once a month via the Storage console.
- (Better) Add a Cloud Function in `functions/index.js` that triggers on `posts/{postId}` delete and deletes `social/posts/{postId}.jpg`. Defer to Phase 2.

## Deferred / nice-to-have
- Pull-to-refresh on feed (skipped — onSnapshot already gives live updates)
- Cloud Function for orphan storage image cleanup (Phase 2)
- Player-authored posts with moderation queue (Phase 2)

## Phase 2 (later, do not start yet)
- Player text posts with admin moderation queue
- Player image uploads
- Report system + flagged content tab
- Push notifications when someone replies to your comment

## Decisions log
- 2026-05-08: Defaults locked in. Admin + system posts only for v1; comments allowed; 7d TTL; ❤️ 🙏 ✝️ 🔥 ⭐ reactions.
