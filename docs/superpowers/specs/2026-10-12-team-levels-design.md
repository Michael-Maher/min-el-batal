# Team levels + teams reset (mini spec)

User decisions (2026-10-12): teams are reset; every team belongs to المستوى الأول or الثاني and has its own
competitions. A player whose level changes **stays** in their team; only new joins are level-restricted.
Reset is run once now and is also available as an admin button.

## Data
- `teams/{id}.level` = 1 | 2 (required for new teams; admin-created teams now use the same name-based doc id as the game).
- `players.teamLevel` / `GameState.teamLevel` = level of the player's team (0 = none).
- `gameContent/season.teamsResetId` + `teamsResetAt`; `players.teamsResetId` = last reset applied.

## Behaviour
| Surface | Rule |
|---|---|
| Create team (game) | Level picker, defaults to `playerLevelOf(GameState)` |
| Browse / join (game) | Only teams of the player's level are listed; join by id / name refuses other levels |
| Team ranking (game) | Always per level (defaults to the player's team level; no mixed "all") |
| Compete team rooms | `room.level` = host's level (`teamLevel` or player level); team rooms refuse other levels; solo rooms unchanged |
| Selfie challenge | `selfieChallenges.level` 0/1/2; players see challenges for their level; each level sees only its own teams' submissions (`teamLevel` on the submission) |
| Tournaments (admin) | `tournaments.level`; team picker shows only that level's teams |
| Admin teams | Level picker on create/edit (cascades `teamLevel` to members), level filter, assign warns on level mismatch |

## Reset («تصفير الفرق», superadmin; also run once by script)
1. Backup to `seasonArchives/teams-<resetId>` (`teams`, `players` team fields) — script also writes a local JSON backup.
2. Clear players (`team, teamLogo, teamColor, teamLevel, pendingTeam*`, `teamLastAction = resetAt`, `teamsResetId`), `leaderboard.team`, delete all teams.
3. `gameContent/season` merge `{teamsResetId, teamsResetAt}` → open games run `ensureTeamsReset()` and leave their local team
   (kept only if `teamLastAction > teamsResetAt`). «بدء موسم جديد» carries the marker over.
Order: deploy the game first, then reset (old clients would re-save their local team).
