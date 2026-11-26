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

## Known gaps
- Login has no rate limiting or email verification for password accounts yet.
- Real Google sign-in is untested end to end until a client ID is configured on a machine with internet access.
- Hindi/Telugu/Spanish text is unreviewed machine-written text; needs native review
- Homepage "how it works", benefits and FAQ text and some page labels are English only
- Hero and crop graphics are original SVG illustrations, not photographs (licensed photos still to be supplied); no Playwright tests yet; no real data, auth or backend
- No buyer dashboard content beyond a placeholder
