# Trade Journal Platform

Full-stack Trade Journal monorepo:

- **Frontend** — Next.js 15 (App Router, TypeScript, Tailwind CSS, shadcn-style UI, TanStack Query), installable **PWA** via Serwist with **Web Push** notifications and **Background Sync**.
- **Backend** — NestJS 11 (Mongoose, Passport-JWT, bcrypt, class-validator, web-push).
- **Database** — MongoDB.
- **Auth** — JWT access + refresh tokens (rotated & revocable), bcrypt-hashed passwords, role-based guards.

```
user-management/
├─ apps/
│  ├─ api/                 # NestJS backend (port 4000)
│  │  └─ src/
│  │     ├─ auth/          # login, register, refresh rotation, JWT strategy
│  │     ├─ users/         # user schema, CRUD + protection rules
│  │     ├─ push/          # web-push (VAPID), subscriptions, broadcast
│  │     ├─ common/        # @Roles/@CurrentUser, guards, enums, filter
│  │     ├─ config/        # env config
│  │     └─ seed/          # protected superadmin seeder + re-seed script
│  └─ web/                 # Next.js frontend (port 3000)
│     ├─ app/              # login, register, /admin/users, /profile, ~offline
│     │  ├─ manifest.ts    # web app manifest
│     │  └─ sw.ts          # Serwist service worker (push, bg-sync, offline)
│     ├─ components/       # UI kit, users table, dialogs, InstallPrompt
│     ├─ lib/              # api client (auto-refresh), auth context, push hook
│     ├─ middleware.ts     # route protection
│     └─ public/icons/     # PWA icons (placeholders — see below)
├─ package.json            # npm workspaces + concurrently
└─ README.md
```

## Deploy to a VPS (one command)

On any Linux VPS with Docker installed:

```bash
git clone https://github.com/Nuad106404/trading.git
cd trading
./deploy.sh
```

That's it. On the first run the script generates `.env` (random JWT secrets, VAPID
push keys via a one-off node container, and a superadmin password that it prints —
save it), then builds and starts three containers with Docker Compose: **MongoDB**
(persistent volume, not exposed to the host), the **API** on `:4000`, and the **web
app** on `:3000` (Next.js standalone build). The protected superadmin is seeded on
first boot as usual.

- Custom domain/URLs: `API_URL=https://api.example.com WEB_URL=https://example.com ./deploy.sh`
  (first run), or edit `.env` and re-run. `NEXT_PUBLIC_API_URL` must be the URL
  **browsers** use to reach the API — it's baked into the web bundle at build time,
  so changing it requires a rebuild (`./deploy.sh` does that).
- **Update to the latest code:** `git pull && ./deploy.sh` — rebuilds only what changed.
- Logs: `docker compose logs -f` · stop: `docker compose down` (data survives in the
  `mongo-data` volume).

### HTTPS with certbot (Let's Encrypt)

PWA install and web push require HTTPS. After `./deploy.sh` works, point two DNS A
records (e.g. `trading.example.com` and `api.trading.example.com`) at the server, then:

```bash
./setup-ssl.sh trading.example.com api.trading.example.com you@example.com
```

The script installs nginx + certbot, sets up the reverse proxy (web → :3000,
api → :4000), obtains and auto-renews certificates (`certbot.timer`), rewrites `.env`
to the `https://` URLs, binds the app ports to `127.0.0.1` (public traffic flows only
through nginx), and rebuilds the web container so the new API URL is baked in.
Debian/Ubuntu only; on other distros replicate the nginx blocks it writes.

## Requirements (local development)

- Node.js ≥ 20
- MongoDB running locally (or a connection string), e.g. `mongod` or Docker:
  `docker run -d -p 27017:27017 --name mongo mongo:7`

## Setup

```bash
# 1. install root tooling, then both apps
npm install
npm run setup

# 2. configure the API
cp apps/api/.env.example apps/api/.env
# → set real JWT secrets and the superadmin credentials

# 3. generate VAPID keys for Web Push and paste them into both .env files
npx web-push generate-vapid-keys

# 4. configure the web app
cp apps/web/.env.example apps/web/.env
# → NEXT_PUBLIC_API_URL + NEXT_PUBLIC_VAPID_PUBLIC_KEY

# 5. run API (:4000) + web (:3000) together
npm run dev
```

> **Why not npm/pnpm workspaces?** This repo lives on an **exFAT** drive, which cannot
> hold the symlinks/junctions workspace hoisting requires (`npm install` fails with
> `EISDIR: illegal operation on a directory, symlink`). Each app therefore keeps its own
> `node_modules` and the root `package.json` only orchestrates (`setup`, `dev`, `build`).
> Related: `apps/web/scripts/exfat-readlink-fix.cjs` remaps exFAT's bogus `EISDIR`
> readlink errors to `EINVAL` so `next build`'s file tracing works; it's a no-op on
> NTFS/ext4/APFS. On such filesystems you can freely convert the root back to real
> workspaces if you prefer.

On first API boot the **protected superadmin** is seeded automatically from
`SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_EMAIL` (idempotent —
an existing account is never overwritten). The plaintext password lives **only**
in `apps/api/.env` (git-ignored) and is bcrypt-hashed at seed time.

## Roles

| Role         | Capabilities |
|--------------|--------------|
| `superadmin` | Full access. Manage all users (create/edit/delete/role/status/reset password). |
| `admin`      | Admin dashboard. Manage `user` accounts only — acting on `admin`/`superadmin` targets returns 403. |
| `user`       | Own profile only. No dashboard. |

Additional rules enforced in the service layer (regardless of caller):

- The seeded superadmin has `isProtected: true` → **any** edit/delete/status/role/password
  change through the API returns `403 Forbidden`. The UI hides its actions and shows a
  **Protected** badge.
- Nobody can delete their own account or change their own role/status.
- Only a superadmin can change roles; admins can only create `user` accounts.
- Suspended accounts cannot log in; `passwordHash` is `select: false` **and** stripped in
  the JSON transform, so it never appears in responses.

## Rotating the protected superadmin's credentials

The protected account is immutable through the app by design. To rotate its password
(or email):

1. Edit `SUPERADMIN_PASSWORD` (and/or `SUPERADMIN_EMAIL`) in `apps/api/.env`.
2. Run the dedicated re-seed script:

```bash
# local development — after editing apps/api/.env
npm run seed:superadmin                                        # create-if-missing
npm --prefix apps/api run seed:superadmin -- --force-reset     # rotate credentials

# Docker/VPS deploy — after editing SUPERADMIN_* in the root .env
./deploy.sh --reset-superadmin
```

## API overview

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| POST | `/auth/register` | public (rate-limited) | creates `user` role, returns user + tokens |
| POST | `/auth/login` | public (rate-limited) | generic error message, rejects suspended, updates `lastLoginAt` |
| POST | `/auth/refresh` | public | rotates the refresh token (old one is revoked) |
| POST | `/auth/logout` | public | revokes the refresh token |
| GET | `/auth/me` | JWT | current user |
| PATCH | `/auth/change-password` | JWT | own password (blocked for protected account) |
| GET | `/users` | admin+ | `page, limit, search, role, status, sortBy, sortOrder` |
| GET | `/users/stats` | admin+ | totals for the stat cards |
| GET/POST | `/users`, `/users/:id` | admin+ | protection rules apply |
| PATCH | `/users/:id`, `/users/:id/status` | admin+ | protection rules apply |
| POST | `/users/:id/reset-password` | superadmin | not for the protected account |
| DELETE | `/users/:id` | admin+ | protection + self-delete rules |
| GET | `/push/vapid-public-key` | JWT | public VAPID key for subscribing |
| POST/DELETE | `/push/subscribe` | JWT | upsert / remove a browser subscription |
| POST | `/push/test` | JWT | test notification to your own devices |
| POST | `/push/broadcast` | admin+ | `{ title, body, url?, target: 'all' \| 'admins' \| userId }` |

Push triggers (service layer): creating / suspending / activating / deleting an account
notifies all admins + superadmins; a suspended user is notified directly. Stale
subscriptions (HTTP 404/410) are deleted automatically; other send errors are logged and
swallowed (`Promise.allSettled`), so one bad endpoint never breaks a broadcast.

## Trading Journal

Every logged-in user gets a personal trading journal under `/trading` (dashboard,
trades log, cash flow, CSV import). All data is scoped to the JWT's `userId` —
regular users can only ever see and modify their own trades; guessing someone
else's id returns 404. Superadmin/admin get an overview of all users at
`/admin/trading-overview` (per-user aggregates + equity curve) and can **edit or
delete** entries in a selected user's journal. The same role rule as user
management applies: an `admin` may only manage `user`-role journals (403 on
admin/superadmin targets); `superadmin` can manage all. Owners receive a push
notification when an admin changes their journal.

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/trading/trades` | list: `page, limit, symbol, side, result(win\|loss), from, to, search, sortBy, sortOrder` |
| GET/PATCH/DELETE | `/trading/trades/:id` | owner only (404 otherwise) |
| POST | `/trading/trades/bulk-import` | `{ trades: [...], transactions: [...] }` from the client-side CSV parser |
| GET/POST | `/trading/cash` | deposits/withdrawals; PATCH/DELETE by id |
| GET | `/trading/stats/summary` | balance, net P&L, winrate, profit factor, streaks, expectancy… |
| GET | `/trading/stats/equity-curve` | trade + cash events merged (`$unionWith`) with running balance |
| GET | `/trading/stats/monthly` · `/by-symbol` · `/max-drawdown` | Mongoose aggregations |
| GET | `/trading/admin/overview` | superadmin/admin — per-user totals |
| GET | `/trading/admin/users/:id/summary` · `/equity-curve` | superadmin/admin — per-user stats |
| GET | `/trading/admin/users/:id/trades` · `/cash` | superadmin/admin — list a user's entries |
| PATCH/DELETE | `/trading/admin/users/:id/trades/:tradeId` · `/cash/:txId` | superadmin/admin — admin role limited to user-role targets; owner gets a push |

Details:

- **Profit auto-derivation** — when `profit` is omitted but prices are present:
  `profit = direction × (close − open) × lots × 100` (`100` = $/point/lot, fits XAUUSD;
  single source of truth in `apps/api/src/trading/trading.util.ts` and
  `apps/web/lib/trading.ts`). `netProfit = profit + commission + swap` is a Mongoose
  virtual, never stored.
- **Import** — `/trading/import` accepts two formats, both parsed client-side with a
  preview before anything is saved (then posts JSON to `bulk-import`):
  - **MT5 report `.xlsx`** (History → right-click → Report → *Open XML (Excel)*, the
    only export MT5 offers): the *Positions* section becomes trades (open/close time
    & price, volume, SL/TP, commission, swap, profit) and `balance` rows in the
    *Deals* section become deposits/withdrawals (`D-…`/`W-…` comments set direction).
    Parsed with SheetJS in `apps/web/lib/mt5-report.ts`.
  - **CSV** with case-insensitive header matching (PapaParse); `balance/deposit/withdraw`
    rows become cash transactions. A template CSV is downloadable on the page.
- **Push triggers** — a single trade losing more than `TRADING_LOSS_ALERT_THRESHOLD`
  (default $100, `0` disables) pushes a warning to the owner; a daily summary push
  goes out at 23:00 Asia/Bangkok (`@nestjs/schedule` cron) to everyone who closed
  trades that day.
- **Offline entry** — trade/cash mutations are covered by the same Background Sync
  queue as the rest of the app (`/trading*` in `app/sw.ts`): entries made offline are
  queued and replayed on reconnect, then the UI revalidates.

## UI / Mobile

- **Language toggle (TH/EN)** — button in the header (and on the login screen) switches
  the whole UI between English and Thai. Implemented as a lightweight dictionary in
  `apps/web/lib/i18n.tsx` (no route changes); the choice persists in `localStorage`.
- **Mobile app experience** — on phones the sidebar is replaced by a native-style
  bottom tab bar (`components/mobile-nav.tsx`, role-aware tabs), the header is sticky
  with safe-area insets for notched devices, dialogs are scrollable and sized to the
  viewport, numeric inputs open the numeric keypad (`inputMode`), and the trading
  dashboard has one-tap **Deposit / Withdraw** buttons (`cash-quick-dialog.tsx`).
  Tables scroll horizontally inside their cards; stat grids collapse to two columns.

## PWA

- **Manifest** at `/manifest.webmanifest` (from `app/manifest.ts`), standalone display,
  `#0b0d10` theme, 192/512/maskable icons + apple-touch icon.
- **Service worker** (`app/sw.ts`, built by `@serwist/next` to `public/sw.js`):
  - `defaultCache` for static assets, offline fallback at `/~offline` for navigations.
  - **API responses are never cached** — everything under `NEXT_PUBLIC_API_URL`
    (including `/auth/*` and `/users/*`) is `NetworkOnly`. Tokens are never stored in the SW.
  - **Background Sync**: `POST/PATCH/PUT/DELETE` to `/users*` / `/profile*` that fail
    offline are queued (`user-mutations-queue`, 24h retention) and replayed on reconnect.
    Replays that return 401/403 (expired access token) are dropped gracefully. On replay
    the SW `postMessage`s the app, which invalidates TanStack Query caches and toasts.
  - **Periodic Background Sync** (Chromium, installed PWA only): `refresh-dashboard`
    revalidates admin data ~12h; feature-detected, fails silently elsewhere.
  - The SW is **disabled in development** (`NODE_ENV === "development"`) — build + start
    to test PWA behaviour:

    ```bash
    npm --prefix apps/web run build
    npm --prefix apps/web run start
    ```

- **Install**: custom "Install app" button (`beforeinstallprompt`) in the dashboard
  header; on iOS Safari a "Share → Add to Home Screen" hint is shown instead. On iOS,
  Web Push requires the installed PWA (iOS 16.4+) — the enable button is gated accordingly.
- **Icons**: the NUAD brand mark lives in `apps/web/public/icons/logo.svg` (gold "N"
  with a rising arrow; `maskable.svg` and `wordmark.svg` variants alongside). The SVG is
  used directly as the favicon; the committed PNGs (192/512/maskable/apple-touch) are
  rendered from it — to regenerate after a logo change:
  `npm i -D sharp && node apps/web/scripts/gen-icons.mjs && npm rm sharp` (in `apps/web`).

## Security notes

- `helmet`, CORS restricted to `WEB_ORIGIN`, global `ValidationPipe({ whitelist: true,
  forbidNonWhitelisted: true })`, consistent JSON error shape.
- `/auth/login` and `/auth/register` are rate-limited (10/min per IP; global 100/min).
- Refresh tokens are stored **hashed** (SHA-256) in a TTL-indexed `authsessions`
  collection; refresh rotates and revokes, logout revokes, password change revokes all.
- Access tokens (15m) + refresh tokens (7d) are signed with **separate secrets**.
- Middleware cookies (`um_auth`, `um_role`) only steer client routing — every API call is
  re-authorized server-side by JWT + role guards.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run setup` | install dependencies of both apps |
| `npm run dev` | API + web concurrently (dev mode) |
| `npm run build` | build both apps |
| `npm run start` | run both apps in production mode |
| `npm run seed:superadmin` | create protected superadmin if missing |
| `npm --prefix apps/api run seed:superadmin -- --force-reset` | rotate its credentials from `.env` |
| `npm run icons` | regenerate placeholder PWA icons |
