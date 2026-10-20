# Club Lorenzo — Pickleball club

A single-organization Club Lorenzo site for promoting the club and managing
pickleball events, open play, player registrations, and live tournament
operations. The public home page introduces Club Lorenzo, founded by San Lorenzo Ruiz
School alumni and grown into a wider, welcoming pickleball community. It also
features the school's namesake Saint Lorenzo Ruiz, previous open-play posters,
club gear, and upcoming events, using the supplied blue-and-white branding.

- **Club staff** (event publishing, Registration, Court Control, Tournament
  Setup, Bracket): sign in at `/login` and use `/manage` to organize the club's
  tournaments. Staff accounts are assigned by the club administrator; public
  registrations are always player accounts.
- **Account roles**: one `SUPERADMIN` manages platform-level access and the
  club's single `ADMIN` account. The club admin can create/revoke `STAFF`
  accounts. Staff run club events, tournaments, registration, and court play.
  `PLAYER` accounts can follow events and their own standings but cannot edit
  club operations or game results. Public sign-up always creates a player.
- **Player side**: anyone can browse the club home page, event listings, and
  tournament boards. Players need an account to
  request a place, upload payment proof, or manage their registrations.

## What it does
- Club landing page with its supplied logo, member photos, Saint Lorenzo Ruiz portrait, past open-play posters, club-shirt promotion, social links, and featured events
- Route-based loading for a smaller initial page download, plus a branded not-found page with links back to the club and games
- API requests have a finite timeout; public pages remain available when account or event services cannot be reached, with retry options for featured events
- Public event discovery with search, schedule, location, capacity, and payment instructions
- Self-service player accounts and staff-managed club events
- In-app registration requests, payment-proof uploads, organizer review, and pending-request withdrawal
- Event hosts can offer QR/e-wallet, pay-in-person, or online checkout; uploaded event QR codes are shown to all attendees
- Capacity limits reserve places for pending and confirmed requests
- Publishing an event creates and links an open-play or bracket tournament for court operations
- Player registration with skill levels (Beginner / Average / Advance)
- Standalone open-play registration pages let players request entry and follow approval status; linked community events use the event page for applications and payment. Organizers can search player accounts, review payments, approve or reject eligible requests, and manage the roster from the live board
- Each tournament has a focused home page linking to the appropriate registration flow, live board, standings, and tournament-specific tools
- The live board keeps active games and matchmaking prominent, with registration and organizer roster/payment review in a separate collapsible section
- Random-pairing matchmaking that enforces balanced doubles skill matchups
- Approved open-play players can view their live queue spot or upcoming lineup and leave/rejoin the waiting pool from the event page
- Staff can run the open-play Bunot-bunot draw from the live board's waiting queue; matchups are created by the server and revealed with a spin animation
- Staff can generate a complete bracket from approved, active tournament registrations; single elimination is the default, with double elimination and round robin also available. Elimination brackets include byes as needed and automatically advance recorded winners to their next match.
- Per-court enable/disable, supports 2+ courts
- Staff court control: manual Start / Pause / Resume / Finish + editable game timer
- Public live kiosk display (all active courts, upcoming lineups, and ordered open-play waiting queue) via Socket.IO — staff can also draw matchups and jump to court controls from this board
- Every published event linked to a tournament includes a prominent public Live kiosk link on its event page and event listings
- Tournament and open-play pages use a focused event navigation bar; the landing page's "Happening now" link opens the first event with a ready or active court
- Leaderboard ranked by wins, loss-game points, total points, and point differential, with games-played count and live updates
- Open-play tournament finalization with shared placements for exact ties and arrival-aware matchmaking
- Congratulatory final-results page with PNG and JPEG downloads for everyone
- Editable rosters/brackets for substitutions (player leaves, emergency, etc.)

## Stack
PostgreSQL · Node.js/Express/TypeScript · Prisma · Socket.IO · React/Vite/TypeScript · Tailwind CSS · Docker Compose

## Quick start (local, no Docker)

### 1. Database
Install PostgreSQL locally, or just run:
```bash
docker run --name pickleball-db -e POSTGRES_USER=pickleball -e POSTGRES_PASSWORD=pickleball -e POSTGRES_DB=pickleball -p 5432:5432 -d postgres:16-alpine
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev                          # http://localhost:4000
```

If you want stable local sessions across backend restarts, set `JWT_SECRET` in
`backend\.env` to a unique random value generated with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
Without one, development uses a temporary process-only key; production
requires an explicitly configured strong key.

After the database migrations are applied, create the programmer's
superadmin account once from an interactive terminal:
```bash
npm run create:superadmin
```
Enter a unique username and a private password of at least 12 characters
when prompted. The command refuses to create a second superadmin. Sign in at
`/login`, then use **Manage roles** to create the one club admin and staff
accounts. The database enforces at most one account in each `SUPERADMIN` and
`ADMIN` role; transferring admin access demotes the previous admin to staff.
From **Manage roles**, admins can block or restore player and staff access;
only the superadmin can block or restore the club admin account. Blocking
prevents sign-in and keeps the account's event and tournament history intact.

If you forget the superadmin password, run `npm run reset:superadmin-password`
from `backend` in an interactive PowerShell terminal. Enter the existing
superadmin username, then enter and confirm a new password of at least 12
characters. The password is not echoed or logged; this command only changes
the password of an account already holding the `SUPERADMIN` role.

For an existing installation, back up the database and apply the new Prisma
migrations before starting the updated backend:
```bash
npx prisma migrate deploy
npm run prisma:generate
```
If legacy data has multiple admin accounts, the migration retains the oldest
as the club admin and converts the others to staff so their operations access
is preserved.

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
```

Open `http://localhost:5173` to view the Club Lorenzo home page. Players can
browse `/community` for events and `/tournaments` for open play and tournament
boards, then create a player account to request a place. Club staff can sign in
at `/login`, publish events, and open the linked court dashboard to run live
play. Superadmins and the club admin can also open `/manage-site` to edit the
public landing page copy, branding images, archive/community photos, club gear,
contact/social links, and image accessibility descriptions. Save changes as a
draft, preview them on the home page, and publish only when ready. The 20 most
recent replaced live versions can be restored as drafts. Event posts and tournament
details remain managed in their existing screens. Image uploads are limited to
8 MB and saved under `backend/uploads/site`; persist that directory in
production deployments.

For an existing installation, run `npx prisma migrate deploy` from `backend`
before restarting the app to add pending site-content storage and revision
tables.

The first account created against a fresh database receives staff access.
Set the club's public location, email, phone, and social URLs in
`frontend/.env` (`VITE_CLUB_LOCATION`, optional secure `VITE_CLUB_MAP_URL`,
`VITE_CLUB_EMAIL`, `VITE_CLUB_PHONE`, `VITE_CLUB_INSTAGRAM_URL`,
`VITE_CLUB_FACEBOOK_URL`, and `VITE_CLUB_X_URL`).
These public values are baked into the frontend at build time; do not put
secrets in `VITE_*` variables. Rebuild/redeploy the frontend after changing
them. Until official details are supplied, the location and social/contact
links remain neutral or hidden rather than guessed.
The supplied logo, member photo, event posters, and shirt promotion are in
`frontend/public/brand`; replace them with newer club artwork as it becomes
available. The site uses Anton/Barlow Condensed display typography with the
club's deep-blue and white palette.

### Backend validation
```bash
cd backend
npm test
npm run build
```

`GET /health` checks that the server process is running. `GET /health/ready`
also verifies that PostgreSQL is reachable and returns HTTP 503 when the
database is unavailable.

Administrators can use the recovery endpoint to repair orphaned queued-player
states after an interruption. Emergency pause/resume endpoints preserve each
active game's remaining time and create audit records.

## Docker Compose
```bash
docker compose up --build
```
Backend on :4000, frontend on :5173, Postgres on :5432.

## Deploy on Railway

The root `Dockerfile` deploys the backend and the built frontend as one Railway
service. Add a PostgreSQL service to the same Railway project, then deploy this
repository as a Dockerfile service using the root directory.

Set these variables on the app service:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
CORS_ORIGIN=https://<your-app-domain>
JWT_SECRET=<unique-random-secret-at-least-32-characters>
```

In Railway, add this under the app service's **Variables** settings (not just
the PostgreSQL service). Replace `Postgres` with the exact name of your
PostgreSQL service. The app container will stop with an actionable error if
`DATABASE_URL` is missing; it cannot run migrations or serve database-backed
features without a configured PostgreSQL connection.

Generate a strong secret locally with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
and enter the output directly in Railway's variable settings. Do not commit it,
put it in a `VITE_*` variable, or share it. Production startup fails if
`JWT_SECRET` is missing or weak, or if `CORS_ORIGIN` is not an HTTPS origin.
You may provide multiple exact HTTPS origins as a comma-separated list. The
server trusts one reverse proxy hop for Railway client-IP rate limits. Login
is limited to 10 attempts per 15 minutes and registration to 5 per hour per
client IP. Rate-limit counters are in process memory, so horizontally scaled
deployments should use a shared rate-limit store.

Railway runs `prisma migrate deploy` before starting the server. The health
check is `GET /health`.

Create a Railway volume mounted at `/app/backend/uploads` to persist uploaded
avatars, tournament photos, payment QR codes, and payment receipts across
redeploys. Without that volume, disk-stored uploads are ephemeral. New event
photos are also stored in PostgreSQL; the volume preserves other uploads and
supports photos created before database-backed storage was added.

### Database and media backups

Enable Railway PostgreSQL automated backups and retention in the database
service settings. Keep a separate copy outside the Railway project and practice
restoring it to a **separate, empty test database** before relying on it. A
database backup does not include uploaded files: separately copy the
`/app/backend/uploads` volume (including `site`, `avatars`, `tournaments`,
`payments`, and `payment-qrs`) to durable storage.

On Windows, install PostgreSQL command-line tools (`pg_dump` and `pg_restore`).
The scripts read `DATABASE_URL` from the process environment or `backend\.env`
without printing the password. From the project root:

```powershell
.\scripts\backup-database.ps1
```

Backups are written to the ignored `backups\` directory in PostgreSQL custom
format. For a restore drill, first create a separate empty database on the same
PostgreSQL server, then restore into that database (never use the live database
for a drill):

```powershell
.\scripts\restore-database.ps1 -BackupFile .\backups\pickleball-YYYYMMDD-HHMMSSfff.dump -TargetDatabase pickleball_restore_test
```

The restore script checks the backup, warns that target objects will be
replaced, and requires typing the exact target database name before proceeding.
After a restore, point a staging app at the test database and verify
`/health/ready`, sign-in, events, uploaded media, and a read/write workflow.
Store backups securely because they contain application data. Take an extra
backup before and after major events or schema upgrades.

After deployment, open the generated app domain and confirm `/health` returns
`{"ok":true}`. The frontend, API, cookies, and Socket.IO updates all use that
same domain.

## Who sees what
| Screen | Who it's for | Needs login? |
|---|---|---|
| Club home / Events & event details | Everyone | No |
| Tournament boards, brackets, leaderboard, and kiosk | Everyone | No |
| Publish and manage club events | Club staff | Yes |
| Tournament Setup / Registration | Club staff | Yes |
| Court Control | Admin/staff | Yes |

Event listings and tournament information are public. Player registration and
court operations require an account with the appropriate role.

## How the skill-pairing rule works
Implemented in `backend/src/lib/matchmaking.ts` (`isEligibleTeamMatchup`). The
draw only creates these balanced doubles matchups:
- Beginner + Beginner ↔ Beginner + Beginner
- Advance + Beginner ↔ Advance + Beginner
- Advance + Beginner ↔ Average + Average
- Average + Average ↔ Average + Average
- Average + Beginner ↔ Average + Beginner
- Advance + Average ↔ Advance + Average

Beginner + Beginner cannot face Beginner + Advance or Beginner + Average.
Average + Beginner cannot face Average + Average or Average + Advance.

The draw (`drawEligiblePairs` / `buildDoublesGame`) shuffles the waiting pool
(Fisher-Yates) and builds only valid doubles games. Anyone who cannot be
validly matched this round stays in the queue for the next draw.

## Where things live
- `backend/prisma/schema.prisma` — data model (players, courts, games, queue, brackets)
- `backend/src/lib/matchmaking.ts` — skill rule + bunot-bunot shuffle
- `backend/src/lib/queue.ts` — fills the "next 4-6 games" preview, seats free courts
- `backend/src/lib/bracket.ts` — single-elimination bracket generation + winner advancement
- `backend/src/lib/leaderboard.ts` — wins/losses/games-played standings
- `backend/src/lib/playerLeaderboard.ts` — career and calendar-year podium points, player stats, tiers, badges, and match history
- `backend/src/routes/users.ts` — public player profiles and unique profile-visitor history
- `backend/src/index.ts` — server-side 1-second timer tick, broadcasts to all clients
- `frontend/src/pages/CourtControl.tsx` — staff screen (start/pause/finish, timers, draw button)
- `frontend/src/pages/Kiosk.tsx` — public read-only live board
- `frontend/src/pages/Leaderboard.tsx` — public read-only leaderboard
- `frontend/src/pages/community/CommunityLeaderboard.tsx` — global open-play, tournament, and overall rankings
- `frontend/src/pages/community/CreatePost.tsx` — event setup, venue pin, payment methods, and QR upload
- `frontend/src/pages/community/PostDetail.tsx` — attendee registration, player-name search, and event payment details
- `frontend/src/pages/community/Profile.tsx` — player stats, recent matches, badges, and profile visitors
- `frontend/src/components/SpinWheel.tsx` — the reveal animation

The global player leaderboard awards 5 points for 1st place, 3 for 2nd, and
1 for 3rd in both open-play and fixed-bracket tournaments. Career and
calendar-year rankings use the same scoring; finalized event standings are
recalculated using these points.

Global leaderboard seasons use calendar years based on each event's finalization
date. Viewing player profiles and recording profile visits require a signed-in
account; logged-out profile requests are redirected to community sign-in.
Historical visits that were recorded anonymously before this restriction remain
displayed without identifying information. Deploy pending Prisma migrations
before releasing profile visitor changes.

## Production notes
- Keep strong `JWT_SECRET`, `DATABASE_URL`, and exact HTTPS `CORS_ORIGIN` values
  configured in the deployment environment. Do not use the sample Docker Compose
  database password publicly. Changing `JWT_SECRET` invalidates all existing
  sessions, so rotate it deliberately.
- Back up PostgreSQL and test restoring a backup before running a major event.
- Scheduled finalization waits until queued and active games are finished or
  cancelled, so late scores are not omitted from official standings.
- The finalizer detects podium ties and supports either a tiebreak game or manual
  ordering. Tiebreak games split the selected players into teams as evenly as possible.
- Uploaded files need a persistent Railway volume or external object storage.
- Test a database restore before the event, and take a backup immediately
  before and after the tournament. Database-backed queue locks prevent
  concurrent draws from duplicating players, but they do not replace backups.
- Configure your hosting provider's PostgreSQL automated backups and retention,
  then perform a real restore drill before the event. Keep application logs and
  database backups in separate systems; the server emits JSON request/error
  logs suitable for Railway or another log collector.
- Paid event registrations can use PayMongo-hosted checkout. The default
  platform commission is 5% and is deducted from the organizer's online event
  balance. Organizers may also offer QR or in-person payments; QR payments
  require uploaded proof and an explicit organizer verification, while
  in-person payments require explicit verification but no upload. Offline
  amounts go directly to the organizer, so their commission is reported as an
  accrued receivable and is not automatically collected by the club's configured payment provider.
- Superadmin-approved organizer renewals are also recorded in the finance
  ledger using the monthly price snapshot captured when proof was submitted.
- After results are finalized and pending registrations are resolved, a
  superadmin can request one PayMongo bank transfer for the event's available
  balance from **Platform Console → Event finance**. PayMongo must confirm the
  transfer through the configured callback before it is recorded as paid.
- Configure the following backend environment variables before enabling
  payments: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`,
  `PUBLIC_APP_URL`, `PAYMONGO_SOURCE_ACCOUNT_NUMBER`,
  `PAYMONGO_SOURCE_ACCOUNT_NAME`, `PAYMONGO_SOURCE_ACCOUNT_BIC`,
  `PAYMONGO_PAYOUT_CALLBACK_URL`, `PAYMONGO_PAYOUT_CALLBACK_TOKEN`, and
  `PAYOUT_ENCRYPTION_KEY`. Keep provider credentials and encryption keys out
  of source control. Generate the encryption key with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  and use a separate long random callback token. Preserve both keys across
  deployments; rotating the encryption key requires a planned re-encryption of
  saved organizer bank details.
- Register the public `/api/webhooks/paymongo` URL in PayMongo and enable
  checkout payment events. Set `PAYMONGO_PAYOUT_CALLBACK_URL` to the HTTPS
  base path `/api/webhooks/paymongo/payout`; the server appends the secret
  callback token. Confirm the PayMongo account has checkout and wallet-transfer
  capabilities, and configure its source wallet account exactly as PayMongo
  reports it. Test with PayMongo test credentials before switching to live
  credentials. Do not use production credentials or issue a real transfer
  during development.
- Organizer subscription renewals are still manually submitted and approved;
  online subscription checkout and automatic recurring billing are not
  implemented. PayMongo must enable a supported hosted recurring flow before
  this can be automated safely. Refund automation and a formal accounting or
  tax export are also not included.
- Apply the pending Prisma migrations before deploying these payment changes.
