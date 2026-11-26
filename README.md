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

    python -m app.prices.ingest ams            # last 14 days (or: ams 30)

Prices are quoted per package (for example "25 lb cartons") as a low-high range. The app keeps the package as the unit and never converts or averages across packages, and it shows no modal price because USDA does not report one. Only products the app maps (tomatoes, dry onions) are stored; the import prints the others it skipped so the mapping can be extended.

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
