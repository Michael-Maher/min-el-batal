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

## Manual setup before merging to main

### 1. Enable Firestore TTL (one-time, free)
1. Open https://console.firebase.google.com/project/min-el-batal/firestore/ttl
2. Add policy on collection `posts`, field `expiresAt`.
3. Add policy on collection-group `comments`, field `expiresAt`.

Pinned posts have `expiresAt = null`, so they never get deleted.

### 2. Enable Firebase Storage (one-time)
1. Open https://console.firebase.google.com/project/min-el-batal/storage
2. Click "Get Started", accept default bucket location.
3. After the bucket exists, deploy storage rules from CLI:
   ```bash
   firebase deploy --only storage
   ```
   (Rules now live in `storage.rules`, wired in `firebase.json`. 6 MB cap + image-mimetype check enforced server-side.)

### 3. Deploy the new Cloud Functions
```bash
firebase deploy --only functions
```
This pushes `onPostCommentCreated` (push to post author on new comment),
`onPostCreated` (push to all players on new admin post), and `onPostDeleted`
(auto-cleanup of storage image + orphan comments when a post is deleted —
fires on both manual delete and TTL-driven delete).

## Deferred / nice-to-have
- Pull-to-refresh on feed (skipped — onSnapshot already gives live updates)
- Cloud Function for orphan storage image cleanup (Phase 2)
- Player-authored posts with moderation queue (Phase 2)

## Phase 2 — DONE

- [x] **Report system** — `reportPost(postId)` and `reportComment(postId, commentId)` in game.js. Each player can only report once (tracked in `reports` map). Status auto-flips to `flagged` at 3 reports, hiding the content from the player feed but keeping it visible to admins for review.
- [x] **Flag/Approve workflow** — Admin moderation tab (built into the posts page) shows pending + flagged with quick approve/reject buttons. `setPostStatus()` and `setCommentStatus()` reset reports on dismissal.
- [x] **Per-comment moderation** — `openPostComments(postId)` modal in admin shows all comments with delete + un-flag actions.
- [x] **Comment notification** — `onPostCommentCreated` Cloud Function (functions/index.js): when a player comments on someone's post, the post author gets a push (skips self-comments, skips system posts, respects notifPrefs.social).
- [x] **New post notification** — `onPostCreated` Cloud Function: when an approved admin post is created, all players with FCM tokens get a push (respects notifPrefs.social).

## Phase 3 — DONE

- [x] **Player composer** — FAB on the social screen opens `social-composer-modal`. Text up to 500 chars + optional image (5 MB max, compressed client-side to 1280px).
- [x] **Pending workflow** — All player posts default to `status: 'pending'`. Hidden from the player feed (which filters `status === 'approved'`). Show up in admin's "المراجعة" tab with approve/reject buttons.
- [x] **Rate limit** — `PLAYER_POSTS_PER_DAY = 3`. Tracked in localStorage per day (`minElBatal_playerPostsRate`). Composer shows used/total. Server-side enforcement is via Firestore rules (left open for now).
- [x] **Hashtag detection** — `extractHashtags(text)` pulls up to 6 `#tags` (Arabic + Latin). Stored as `tags: []` on the post. Same logic in admin's `savePost()`.
- [x] **Tag filter chips** — Top of feed shows the 8 most-used tags as chips. Click a tag → filter feed to posts containing it. Tags also clickable inside post cards.
- [x] **Storage SDK in player app** — `firebase-storage-compat.js` added to index.html.

## Cost & noise mitigations applied
- Feed query filters `status === 'approved'` client-side, so flagged/pending/rejected never reach players.
- New-post notification only fires for `authorRole === 'admin'` and `status === 'approved'` to avoid celebration spam and pending-post leaks.
- Tag filter is purely client-side over the cached feed — no extra queries.
- Rate limit on player posts is per-device (localStorage). Good enough to prevent accidental spam; not a hard server-side guarantee.
- Storage rules cap uploads at 6 MB and reject non-image MIME types — defends against the bucket being used for arbitrary files.

## Final extras (completed this session)
- [x] **`storage.rules`** — declarative storage rules; deployed via `firebase deploy --only storage`.
- [x] **`firebase.json`** — `storage` section wired so `firebase deploy` picks up the rules and they're excluded from hosting.
- [x] **`onPostDeleted` Cloud Function** — best-effort delete of `social/posts/{postId}.jpg` + cascade-delete of `comments` subcollection on Firestore post delete (both manual delete and TTL-driven delete).
- [x] **Social notification preference toggle** — added to existing `showNotificationSettings()` UI as `social` key, alongside competitions/lessons/reminders/streakReminder. Already respected by both `onPostCommentCreated` and `onPostCreated`.
- [x] **"منشوراتي" (My Posts) screen** — players can see all their posts with status badges (pending/approved/flagged/rejected) and counters. Pending/rejected posts can be deleted by the player. Lock-gated under `card_social`.

## Decisions log
- 2026-05-08: Defaults locked in. Admin + system posts only for v1; comments allowed; 7d TTL; ❤️ 🙏 ✝️ 🔥 ⭐ reactions.
