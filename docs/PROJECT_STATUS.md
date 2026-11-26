# Project status

## Done (Phase 1)
- Vite/React/TS/Tailwind app, design tokens, light/dark themes
- Country registry (IN, US), language catalog, i18n (en, hi, te, es)
- Navbar, selectors, mobile drawer, news ticker (demo), homepage, page shells, demo login, farmer dashboard
- Original SVG illustrations: regional hero scenes (from the country pack), crop icons, step and dashboard icons
- 13 Vitest tests passing; production build succeeds

## Done (Phase 2, part 1)
- Docker Postgres (pgvector image), FastAPI backend, Alembic migration for users and sessions.
- Google sign-in verified server-side, email/password fallback (argon2), server-side sessions (hashed tokens, httpOnly cookie), server-enforced roles, Origin check against CSRF.
- React login page, role-protected dashboards, 15 backend and 17 frontend tests.

## Done (Phase 2, part 2: marketplace)
- Listings and inquiries (Alembic 0002): farmers publish, close or mark sold; buyers browse (public, filterable) and send inquiries.
- Farmers see buyer name and message only; buyer email/phone stay private (consent feature comes later). Other farmers' listings return 404.
- Marketplace and dashboards use real data; demo listings appear only when no real ones exist and are labeled DEMO.
- Two-tier navbar. 29 backend and 21 frontend tests; browser end-to-end run (farmer publishes, buyer inquires, farmer sees it) passed.

## Done (Phase 2, part 3: market prices, India)
- `price_observations` table (Alembic 0003), Agmarknet adapter (parser tolerant of field spelling; drops zero/inconsistent rows; strict crop mapping, e.g. Green Chilli is not Dry Chillies), idempotent upsert, `python -m app.prices.ingest probe|run`.
- API: `/api/prices/locations` (only places with data), `/api/prices` (latest per market/variety), `/api/prices/history`.
- Market Intelligence page: crop, state, district, market pickers, table with date and source, history chart. Nothing is estimated; empty states are explicit and demo data is labeled.
- 37 backend and 24 frontend tests.

## Done (Phase 2, part 4: market prices, US)
- USDA NASS Quick Stats adapter: monthly prices received by farmers per state (corn, soybeans, wheat, $/bushel). Skips suppressed values, other units, organic series, national and annual rows. Prices carry a `period` (daily/monthly).
- India CSV import added because the data.gov.in API refused connections from the US; India is parked for now.
- 44 backend and 25 frontend tests.

## Not verified yet
- The Agmarknet adapter has never run against the real API (the build environment cannot reach it). Run `python -m app.prices.ingest probe` with a `DATA_GOV_IN_API_KEY` and fix the parser if the real field names differ. Test fixtures are invented format samples, not market data.
- The NASS adapter has not run against the real API either (build environment cannot reach it): run `probe-nass` with a key first. USDA AMS Market News (terminal/grain markets) is not built.

## Known gaps
- Login has no rate limiting or email verification for password accounts yet.
- Real Google sign-in is untested end to end until a client ID is configured on a machine with internet access.
- Hindi/Telugu/Spanish text is unreviewed machine-written text; needs native review
- Homepage "how it works", benefits and FAQ text and some page labels are English only
- Hero and crop graphics are original SVG illustrations, not photographs (licensed photos still to be supplied); no Playwright tests yet; no real data, auth or backend
- No buyer dashboard content beyond a placeholder
