# AgriConnect AI

Growing Locally. Connecting Globally.

An agricultural marketplace with regional market intelligence, price forecasting and AI decision support. Supports India and the United States, built so more countries can be added as modular country packs.

**Status: Phase 2 started (backend + sign-in). All market data, news, listings and forecasts are still clearly labeled DEMO content.**

## Run it

Requires Node.js 20+, Python 3.11+ and Docker Desktop.

1. Copy `.env.example` to `.env` and set `GOOGLE_OAUTH_CLIENT_ID` (see "Google sign-in" below). Never commit `.env`.
2. Start the database: `docker compose up -d db`
3. Install backend packages once: `pip install -r backend/requirements.txt`
4. Run: `python app.py`

This builds the frontend when sources changed, applies database migrations, and serves the site and API at http://localhost:8000. `python app.py --frontend-only` serves just the static site (no login). For frontend hot reload run `python app.py` in one terminal and `cd frontend && npm run dev` in another (Vite proxies `/api`).

## Google sign-in

Google Cloud Console > Google Auth Platform: create an External app, then Clients > Web application with Authorized JavaScript origins `http://localhost:8000` and `http://localhost:5173`; add test users while in Testing mode. The browser gets a Google ID token; the backend verifies it with Google's library, keys the account on Google's `sub`, and issues its own httpOnly session cookie. Roles (farmer/buyer) are stored in the database and enforced on the server; `admin` can only be granted directly in the database. Email/password (argon2) is the fallback.

## Market prices (India)

1. Get a free API key at https://data.gov.in and put it in `.env` as `DATA_GOV_IN_API_KEY`.
2. Check the real response format once: `cd backend && python -m app.prices.ingest probe`
3. Load prices (re-run daily): `python -m app.prices.ingest run`

If the connection to data.gov.in fails (it may refuse connections from outside India), download a price CSV from data.gov.in or Agmarknet in your browser and load it instead: `cd backend && python -m app.prices.ingest csv path\to\file.csv`. Expected columns: State, District, Market, Commodity, Variety, Grade, Arrival_Date, Min_Price, Max_Price, Modal_Price.

The Market Intelligence page then shows reported mandi prices by state, district and market. Until data is loaded it says so and shows labeled demo data.

## Market prices (United States)

USDA publishes farm prices per state (monthly), not per county or city, so the US picker is crop > state. Get a free key at https://quickstats.nass.usda.gov/api, put it in `.env` as `NASS_API_KEY`, then:

    cd backend
    python -m app.prices.ingest probe-nass     # check the real response format once
    python -m app.prices.ingest nass           # load monthly state prices (corn, soybeans, wheat)

### Daily terminal market prices (tomatoes, onions)

USDA AMS Market News publishes daily wholesale prices at terminal markets (for example Asheville, NC). Register free at https://mymarketnews.ams.usda.gov, copy the key from My Profile into `.env` as `MARS_API_KEY`, then:

    python -m app.prices.ingest ams            # last 14 days (or: ams 30, ams 90)

Prices are quoted per package (for example "25 lb cartons") as a low-high range. The app keeps the package as the unit and never converts or averages across packages, and it shows no modal price because USDA does not report one. Only products the app maps are stored (tomatoes, dry onions, potatoes, sweet potatoes, mushrooms, bell peppers, carrots, cucumbers, garlic, cabbage, eggplant, broccoli); the import lists every other product it skipped, so the mapping can be extended. A product is mapped only by its exact USDA name, so look-alikes (green onions, hot peppers) are never merged in. After adding a product, run the import again, since skipped products are not stored.

## Keeping prices current

While the app is running (`python app.py`), it re-fetches each price source that has its API key in `.env` whenever that source's data is older than `PRICE_REFRESH_HOURS` (default 6; 0 turns it off). It checks every 30 minutes, never hits a source more than once an hour, and one failing source does not stop the others. The Market Intelligence page shows when prices were last checked and warns if they are more than two days old. The refresh only runs while the app is running; to refresh by hand, or from a scheduler such as Windows Task Scheduler or cron, run `python -m app.prices.ingest refresh` from `backend`. USDA publishes terminal market prices daily and farm prices monthly, so "current" means as fresh as USDA's own releases.

## Test

    cd frontend && npm test && npm run build
    cd backend && python -m pytest        # needs the Docker database; wipes its tables, use a test database

## What works in Phase 1
- Country selector (India, US) driven by a registry of country packs (`frontend/src/regions/`)
- Searchable language selector (20 languages listed; English, Hindi, Telugu, Spanish translated, others fall back to English with a notice; RTL handled)
- Country and language are independent; switching country clears data from the previous region
- Commodity-specific unit conversion (never a universal bushel factor)
- Light/dark theme, mobile drawer, persisted preferences
- Pages: Home, Marketplace, Market Intelligence, Price Forecasting, AI Assistant, Knowledge Explorer, demo login, farmer dashboard

See `docs/` for architecture, plan and status.

## Price forecasting

Market Intelligence shows a 7-day-ahead price for a single price line (one market, product, package and variety) **only when
it has beaten a plain baseline on past dates**. Otherwise it says why there is no forecast and shows no number.

- **Baseline:** "the next price equals the latest report". Everything else must beat it.
- **Candidates:** 5-report average, exponential smoothing, damped recent trend and, once a year or more of earlier history is
  stored, last year's price for the same week and today's price plus last year's change over that week
  (`backend/app/forecast.py`, no ML dependencies). Load older data with
  `python -m app.prices.ingest ams-range 2024-11-27 2025-11-26` (any window, run it once per year).
- **Test:** rolling origin, using only data that existed at each past date. Dates are split in time order 50% / 25% / 25%:
  the first part picks the best candidate, the second is the gate (at least 15% lower average error than the baseline), the
  last is a holdout (at least 10%), and the method must be closer than the baseline on 65% of those tests. The skill shown to
  users comes from the holdout. The bars were set by simulation: an earlier, weaker gate (5% / 0%) let 6-10% of pure random
  walks through, which is no better than luck; this one lets through about 1-3%, and a test enforces it.
- **Range:** the 10th-90th percentile of that candidate's own past errors, widened if needed to contain the forecast.
- **Not forecast:** too little history, stale data (latest report over 7 days old), monthly sources, or no method beating the baseline.

Evidence across everything stored (these are the numbers to quote, from real stored prices):

```
cd backend
python -m app.prices.backtest        # lines tested, share that pass vs the by-luck rate, median skill (all lines, winners and losers)
```

API: `GET /api/prices/forecast?country=US&commodity=tomato&unit=...&variety=...` (same series rules as `/api/prices/history`).
