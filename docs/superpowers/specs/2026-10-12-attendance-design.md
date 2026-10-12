# Meeting attendance by QR (mini spec)

User request (2026-10-12): admin generates a dated, printable QR per meeting (e.g. every Monday); players scan it at
church; each player is recorded **once** per meeting and gets **+50 ⭐ immediately with a celebration**; a new QR makes
every older one invalid; a new bottom tab shows my attendance and every player's attendance with search + filters.

## Data
- `attendanceSessions/{sid}` `{date:'YYYY-MM-DD', title, code:'6 digits', points:50, active, createdAt, createdBy, closedAt?}`
- `attendance/{sid}__{phone}` `{sessionId, sessionDate, sessionTitle, phone, name, character, team, teamLevel, playerLevel, points, atMs, at}`
- `players.attendanceLog` / `GameState.attendanceLog` `{sid: {date, points, at}}`
- Rules: `attendance` is **create-only** (no update) → a second record for the same player+meeting is refused by the server.

## Validity
QR content = `https://<host>/?att=<sid>.<code>` (phone camera opens the game; in-app scanner also reads it).
Valid only if the session exists, code matches, `active`, and `date === today` on the device. Admin «اعمل QR جديد»
deactivates every active session. Fallback: typing the 6-digit code (matches today's active session).

## UI
- Game: tab «حضوري» (`attendance-screen`, 6th bottom-nav button): scan button (BarcodeDetector, else jsQR from jsDelivr,
  loaded on demand), code input, my count/points, roster per meeting with name search, level chips, team filter.
  Success → stars added, `GameUI.chest` celebration + confetti. Deep link `?att=` is captured before login and processed after.
- Admin: page «الحضور» (perm key `attendance`): create session (date, title, points) → opens an A4 poster
  (logo, date, big QR via qrcode-generator, code, 3 steps, +50 badge) and prints; sessions list with status and count;
  roster with search, CSV export, delete a wrong record (stars already given are not removed).

## Known limits
Firestore rules are open app-wide, so a technical user could write a record under someone else's phone; one record per
player per meeting is still enforced. Non-superadmin admins need the new «الحضور» permission granted.
