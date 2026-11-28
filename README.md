# AgriConnect AI

*Growing Locally. Connecting Globally.*

AgriConnect AI is an agricultural marketplace with regional market intelligence, honest price forecasting and (in later phases) AI decision support. It supports India and the United States today, and is built so more countries can be added as self-contained "country packs".

The idea is simple: a farmer or buyer should be able to see what a crop is actually selling for, where, and which way the price is likely to move, and should always be told how much to trust that.

## Where things stand

| Area | State |
|---|---|
| **US market prices** | **Real.** About 3.77 million USDA reports (Nov 2023 to Nov 2026), 66 products, 11 terminal markets, refreshed automatically |
| **US forecasting** | **Real, and honest.** 7-day price forecasts are tested and, on this data, none pass, so the app says "No forecast" and why |
| **Direction signal** | **Real.** An offline gradient-boosting model that tells you which way a price is likelier to go *if* it moves; shown for the 33 of 66 products where it proved itself on unseen dates |
| India market prices | Loader built and tested; live data is parked for now, so India pages show clearly labelled demo content |
| Marketplace listings, news ticker, AI assistant preview, knowledge graph | Demo content, labelled **DEMO** (later phases) |

Rule we hold ourselves to: **no invented data in the app.** Anything not backed by a real source is labelled demo. Test fixtures are the only made-up numbers, and the app never loads them.

---

## Table of contents

1. [Run it](#run-it)
2. [The challenge](#the-challenge)
3. [Our approach](#our-approach)
4. [Why XGBoost and LightGBM](#why-xgboost-and-lightgbm)
5. [Metrics and results](#metrics-and-results)
6. [How to read the app's forecast and signal](#how-to-read-the-apps-forecast-and-signal)
7. [Data sources and commands](#data-sources-and-commands)
8. [Architecture](#architecture)
9. [Testing](#testing)
10. [Known gaps and roadmap](#known-gaps-and-roadmap)

---

## Run it

Requires Node.js 20+, Python 3.11+ and Docker Desktop.

1. Copy `.env.example` to `.env` and set `GOOGLE_OAUTH_CLIENT_ID` (see [Google sign-in](#google-sign-in)). Never commit `.env`.
2. Start the database: `docker compose up -d db`
3. Install backend packages once: `pip install -r backend/requirements.txt`
4. Run: `python app.py`

This builds the frontend when sources changed, applies database migrations, and serves the site and API at http://localhost:8000. Use `python app.py --rebuild` to force a frontend rebuild (needed after adding images). `python app.py --frontend-only` serves just the static site (no login). For hot reload run `python app.py` in one terminal and `cd frontend && npm run dev` in another (Vite proxies `/api`).

### Google sign-in

Google Cloud Console > Google Auth Platform: create an External app, then Clients > Web application with Authorized JavaScript origins `http://localhost:8000` and `http://localhost:5173`; add test users while in Testing mode. The browser gets a Google ID token; the backend verifies it with Google's library, keys the account on Google's `sub`, and issues its own httpOnly session cookie. Roles (farmer/buyer) are stored in the database and enforced on the server; `admin` can only be granted directly in the database. Email/password (argon2) is the fallback.

---

## The challenge

Wholesale produce prices look easy to forecast and are not. These are the problems we ran into, in the order they hurt.

**1. The data is messy in ways that silently corrupt results.**
- USDA reports prices per *package* ("25 lb cartons", "1 1/9 bushel"), as a low-high range, with no modal price. Averaging across packages or varieties would produce numbers that mean nothing, so the app never converts or averages across packages and asks you to pick one.
- One market can report several lines for the same product, package and grade that differ *only* in price (different origins or notes). A naive unique key overwrote all but one. We now keep each as its own "price line i of n" and found the reporter's comment field is what separates look-alikes.
- Names are not clean. A product is mapped only by its exact USDA name, so green onions are never merged into onions.

**2. The source is unreliable at scale.** The USDA MARS API returns HTTP 500 on large date windows. Loading three years in one go failed for some markets, so the loader retries, splits failing windows in halves down to 7 days, records any window it truly could not fetch, and prints the exact command to re-run.

**3. Most prices do not move.** About 73% of 7-day changes are *exactly zero*. Wholesale quotes are sticky and reported in steps. That makes "the price stays the same as the last report" a very hard baseline to beat, and it breaks the usual intuition that a model only has to be roughly right.

**4. It is easy to fool yourself.** With 7,000+ price lines and many candidate methods, some will look good by luck. An early version of our own gate let 6-10% of pure random walks pass as "forecastable". Any model score on this data needs a luck check beside it.

**5. Time-series leakage.** A model that sees even one future value scores brilliantly and is worthless. Features, splits and neighbouring days all have to be built so nothing from after the prediction date can reach the model.

**6. Honesty is a product requirement.** Showing a confident price forecast that is no better than "same as today" would be easy and wrong. We wanted the app to say "no forecast" when that is the truth.

---

## Our approach

### 1. Real data first
- **Adapters** turn each source into one shape (`PriceRecord`), then an **idempotent upsert** writes `price_observations`. Re-running an import never duplicates rows.
- **Sources:** USDA AMS MARS (daily terminal-market prices, the main source), USDA NASS (monthly farm prices by state), Agmarknet/data.gov.in for India (parked).
- **Refresh:** a background job re-fetches each source with an API key every 6 hours (configurable), under a database lock so two processes never fight. The page shows when prices were last checked and warns if they are stale.
- **Coverage:** 66 US products (46 added in one pass, each mapped by exact name, with a test that fails if the backend crop list and the frontend crop list ever drift apart).

### 2. A plain forecasting framework with a hard gate
Before any machine learning, we built simple methods and a strict test (`backend/app/forecast.py`, no ML libraries):

- **Baseline:** "next price = latest report". Everything must beat it.
- **Candidates:** 5-report average, exponential smoothing, damped recent trend, and (with a year of history) last year's price for the same week.
- **Test:** rolling origin, using only data that existed at each past date. Dates split in time order 50% / 25% / 25%: the first part picks the best method, the second is a gate (at least 15% lower error than baseline), the last is a holdout (at least 10%), and the method must win on 65% of those tests.
- **Calibrated against luck:** the bars were set by simulation. An earlier 5% / 0% gate passed 6-10% of random walks; the final gate passes about 0-3%, and a test enforces it stays under 4%.
- A forecast is shown only if it passes. Otherwise the app shows the reason (too little history, stale, or not better than the baseline).

### 3. Then machine learning, tested the same strict way
The offline experiment (`backend/ml/`) pools every price line into one table and asks whether gradient boosting can beat "same as today". It is held to the same rules, plus extra checks that exist specifically to catch self-deception (see [Metrics and results](#metrics-and-results)).

### 4. Turn what is proven into a product feature, and only that
The experiment found one real thing: a **direction signal**. We built it into the app as an offline job that writes results to two tables. The web app has no ML libraries and only reads those tables. A product shows a signal only if its own held-out evidence passes a gate.

---

## Why XGBoost and LightGBM

We used three models on purpose, each for a reason.

| Model | Role | Why it is here |
|---|---|---|
| **LightGBM** | Main model | Fast on millions of rows, handles categorical columns (product, market, package) natively, copes with missing values, and learns interactions between features without us writing them by hand. It is what powers the app's direction signal |
| **XGBoost** | Second opinion | A different gradient-boosting implementation with different regularisation and tree building. If both agree, the finding is not an artefact of one library. They did agree (direction AUC 0.708 vs 0.706) |
| **Ridge / logistic regression** | Linear control | If a plain linear model does nearly as well, boosting is adding nothing. It scored lower (direction AUC 0.691), which shows the non-linear model does add value |

Why gradient boosting rather than something else for this problem:
- The data is **tabular**: a few dozen numeric features plus three categorical columns, millions of rows. That is where boosted trees are strongest and where deep learning usually has no edge.
- **Pooling matters.** A single price line has only a few hundred daily points, too few to learn from. One pooled model shares what it learns across thousands of lines, and can use what *other markets* did, which per-line time-series methods (exponential smoothing, ARIMA-style) cannot.
- **It is checkable.** Trees give us honest ablations (drop a feature group and re-test) and well-behaved probabilities we can check for calibration.

We did not try deep sequence models or hosted forecasting libraries; the first result we could defend came from boosted trees, and the harder question was always proving it, not adding complexity.

---

## Metrics and results

All figures are from real stored USDA prices, on dates the model never trained on. "Skill" means improvement over the baseline "same as today"; 0% means no better, negative means worse. Confidence intervals resample whole weeks, because neighbouring days share information.

### Setup
- **Target:** `y = log(price in 7 days / price today)`, only where a real report exists on *both* dates. Nothing is filled in.
- **Features (known on the prediction date only):** price changes over 1/3/7/14/28 days, volatility, share of unchanged days, level vs the 90-day average and vs a year ago, calendar, and what the same product did in other markets and in other lines of the same market; plus product, market and package identity.
- **Walk-forward windows:** 4 test windows of 56 days in time order, each trained on the past only, with a 7-day gap before validation and again before test (targets look 7 days ahead). Hyper-parameters come from a small fixed grid chosen **on validation dates only**; test dates are scored once.

### Result 1: simple methods cannot forecast these prices
Across 7,252 price lines, **none** passed the forecast gate. Median skill was **-25.5%** (all lines, winners and losers included). Per method, median skill: damped trend -26%, 5-report average -30%, exponential smoothing -30.3%, seasonal-adjusted -35.3%, raw seasonal -302%.

**So the app shows "No forecast".** This is the feature working as designed, not a failure of the product.

### Result 2: gradient boosting does not forecast the price either
Average error (MAE) skill vs "same as today": LightGBM **+0.1%** (95% interval -0.0 to +0.3), XGBoost -0.2%, Ridge -18.4%. That is zero within noise.

Squared-error (RMSE) skill is better, because it rewards getting large moves right: Ridge +4.7%, LightGBM **+5.1%** [+4.3, +5.9], XGBoost +5.1%. Without the cross-market features it falls to +0.5% [-0.0, +0.9], so the gain comes from knowing what the same product does elsewhere. The model helps on the big moves and not on the typical one.

### Result 3: "will it move?" looks good but is not real
Predicting whether a price moves 2% or more scored AUC 0.803 against a rule of 0.66. But the **null run** (outcomes shuffled inside each line, which keeps each line's habits but destroys timing) scored 0.81. So the model was only learning that some lines are always volatile, not *when* they will move. We do not ship this.

### Result 4: direction is real
Among price lines that did move 2% or more, can the model tell **up from down**?

| Method | AUC (50% = guessing) |
|---|---|
| **LightGBM** | **0.708** [0.695, 0.724] |
| XGBoost | 0.706 |
| Ridge (logistic) | 0.691 |
| Rule: other markets' 7-day change | 0.664 |
| Rule: all lines of the product, 7-day change | 0.665 |
| Rule: same market, other lines | 0.593 |
| Rule: momentum (continue last week) | 0.522 |
| Rule: reversion (reverse last week) | 0.478 |

Checks that this is not an artefact:
- **Stable across time:** per window 0.741, 0.692, 0.683, 0.709.
- **Calibrated:** when the model said "21% up", the price went up 20% of the time; when it said "77% up", 81%.
- **Null run:** shuffled outcomes score 0.575 (the floor from line persistence alone). Our per-product gate sits above that.
- **Ablation:** with the cross-market features removed, AUC falls to **0.580** [0.567, 0.593] and the probabilities lose calibration (said 30%, happened 40%). The signal comes from *what the same product is doing in other markets*, not from a quirk of one line.

What this does and does not say: the signal tells you the likely direction **if** a 2%+ move happens. It does not say whether the price will move, or how far.

### Result 5: it works for some products and not others
The job tests each product separately and shows a signal only if it has at least 300 tested moves, the low end of its 95% interval is at least AUC 0.60, and its worst test window is at least 0.55. **33 of 66 products pass.**

| Product | AUC | 95% interval | Worst window | Moves tested |
|---|---|---|---|---|
| Lettuce | 0.827 | 0.763 - 0.869 | 0.587 | 4,421 |
| Honeydew | 0.823 | 0.748 - 0.898 | 0.613 | 998 |
| Asparagus | 0.798 | 0.726 - 0.848 | 0.691 | 1,510 |
| Papaya | 0.785 | 0.708 - 0.843 | 0.635 | 1,538 |
| Broccoli | 0.783 | 0.727 - 0.832 | 0.734 | 2,474 |
| Lime | 0.782 | 0.680 - 0.862 | 0.677 | 4,836 |
| Onion | 0.691 | 0.627 - 0.750 | 0.574 | 4,297 |
| Apple | 0.659 | 0.623 - 0.690 | 0.598 | 6,094 |

Some strong-looking products stay hidden on purpose: tomato (AUC 0.749) and lemon (0.786) have a worst window below 0.55, and peach (0.804) falls to 0.09 in one window. A product that is great in three windows and bad in one is not something to tell a user to rely on.

With 66 products tested, a few of the 33 that pass may have passed by luck. The worst-window rule screens out most of that. Raising the gate is a one-line change in `ml/predict.py`.

### Why we can trust the process
`tests/test_ml_*.py` check that features cannot see the future, that a planted pattern is found, that random walks and shuffled targets show **no** skill, and that a market first seen in the test period does not crash the model (a real bug we hit with XGBoost categories).

---

## How to read the app's forecast and signal

**Market Intelligence** (pick a crop, state, market):
- **Next-week forecast box:** a price with a likely range, only if a method beat the baseline on past dates. Otherwise it says why there is none.
- **Direction signal box:** a gauge showing the chance of up or down *if the price moves 2%+*, what the same product did in other markets over the last 7 days, and the model's past accuracy for this product. It goes quiet if the newest read is over 7 days old.

**Price Forecasting page:** a card per product with a plain verdict ("Mostly leaning down", "Mixed"), how many listings lean each way, and the past accuracy. A "listing" is one market, package and grade. Colours are blue (up) and orange (down), and every bar also carries arrows and numbers.

**Home page:** real counts from the database, and the six clearest leans today.

Endpoints:
- `GET /api/prices/forecast?country=US&commodity=tomato&unit=...&variety=...`
- `GET /api/prices/signal?country=US&commodity=lettuce&market=...` returns `status: none` with a reason (`not_evaluated`, `no_evidence`, `needs_market`, `no_read`, `stale`) instead of a guess
- `GET /api/prices/signals?country=US` lists every product with a proven signal
- `GET /api/prices/summary?country=US` real counts (cached for 10 minutes)

---

## Data sources and commands

### United States, daily terminal markets
USDA AMS Market News publishes daily wholesale prices. Register free at https://mymarketnews.ams.usda.gov, copy the key from My Profile into `.env` as `MARS_API_KEY`, then:

    cd backend
    python -m app.prices.ingest probe-ams                 # check the real response format once
    python -m app.prices.ingest ams 365                   # last 365 days
    python -m app.prices.ingest ams-range 2024-11-27 2025-11-26      # any window (load more history for seasonal tests)
    python -m app.prices.ingest ams-range 2025-01-01 2025-03-31 Philadelphia   # re-run one failed market
    python -m app.prices.ingest stats                     # what is stored

If a window could not be fetched the import prints **INCOMPLETE** with the exact command to re-run it.

### United States, monthly farm prices
USDA publishes farm prices per state monthly, so the picker is crop > state. Free key at https://quickstats.nass.usda.gov/api, in `.env` as `NASS_API_KEY`:

    python -m app.prices.ingest probe-nass
    python -m app.prices.ingest nass                      # corn, soybeans, wheat

### India (parked)
Get a free key at https://data.gov.in (`DATA_GOV_IN_API_KEY`), then `python -m app.prices.ingest probe` and `python -m app.prices.ingest run`. If data.gov.in refuses connections from outside India, download a CSV and load it with `python -m app.prices.ingest csv path\to\file.csv` (columns: State, District, Market, Commodity, Variety, Grade, Arrival_Date, Min_Price, Max_Price, Modal_Price).

### Keeping prices current
While the app runs, it re-fetches each source that has an API key whenever its data is older than `PRICE_REFRESH_HOURS` (default 6; 0 turns it off), checking every 30 minutes, never hitting a source more than once an hour, and one failing source does not stop the others. To refresh by hand or from a scheduler (Task Scheduler, cron): `python -m app.prices.ingest refresh`. "Current" means as fresh as USDA's own releases.

### Running the forecasting experiments
```
cd backend
pip install -r requirements-ml.txt
python -m app.prices.backtest                         # simple-method evidence (lines tested, share passing vs by-luck rate)
python -m ml.evaluate --models lgbm --windows 2 --max-train-rows 300000   # quick first run
python -m ml.evaluate                                 # all models, 4 test windows
python -m ml.evaluate --task rmse                     # squared error
python -m ml.evaluate --task move                     # will it move 2%+?
python -m ml.evaluate --task direction                # up or down, given it moved 2%+
python -m ml.evaluate --null                          # shuffled outcomes: must show no skill
python -m ml.evaluate --ablate cross                  # also: flat | ids | samemkt | othermkt
python -m ml.predict                                  # per-product evidence + current reads, saved for the site (run after loading prices)
```
If `ml.predict` says a table does not exist, run `alembic upgrade head` (or start `python app.py` once) first.

---

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind v4, TanStack Query, i18next (English, Hindi, Telugu, Spanish translated; 20 languages listed), Recharts |
| Backend | FastAPI, SQLAlchemy 2.x, Alembic migrations, psycopg v3, PostgreSQL 16 |
| ML (offline only) | pandas, NumPy, scikit-learn, LightGBM, XGBoost |
| Auth | Google ID token verified server-side, httpOnly session cookie, argon2 fallback, server-enforced roles |

```
frontend/src/regions/   country packs (India, US): crops, units, hero pictures, currency
frontend/src/pages/     Home, Marketplace, Market Intelligence, Price Forecasting, ...
backend/app/            API, auth, forecast.py (simple methods + gate), prices/ (adapters, ingest, backtest)
backend/ml/             dataset.py, evaluate.py, predict.py (offline)
backend/alembic/        migrations (latest: 0006 price_signals + signal_evidence)
docs/                   ARCHITECTURE.md, DEVELOPMENT_PLAN.md, PROJECT_STATUS.md
```

Design choices worth knowing:
- **Country packs** keep each country's crops, units, currency and hero pictures in one place, so adding a country does not touch pages. Switching country clears the previous region's data, and country and language are independent.
- **Units are commodity-specific.** There is no universal bushel factor.
- **The ML never runs in the web app.** A batch job writes tables; the API reads them. That keeps the site light and the model auditable.
- **Hero pictures** on the home page are illustrations (they look AI-generated), described as such for screen readers. Optimised `.webp` files are served from `frontend/public/images/hero/`; full-size originals live in `frontend/hero-src/`.
- Accessibility: keyboard-focusable controls, text labels on every chart graphic, colour-blind-safe up/down colours, reduced-motion respected, RTL languages handled.

---

## Testing

    cd frontend && npm test && npm run build
    cd backend && python -m pytest        # needs the Docker database; wipes its tables, so use a test database

Backend tests cover price parsing and ingest (including look-alike lines and API retry/splitting), the forecast gate and its false-positive rate, the API endpoints, and the ML pipeline (no future leakage, planted-pattern recovery, null runs). Frontend tests cover the pages, regional switching, charts, forecast and signal cards, and the hero carousel.

---

## Known gaps and roadmap

Honest list of what is not done:
- **India live prices** are parked; India pages use labelled demo content.
- **Direction signal limits:** it is conditional on a 2%+ move, covers US terminal-market products only, and needs `python -m ml.predict` re-run after new data (signals go quiet after 7 days).
- **Multiple testing:** 66 products are tested, so a few passes may be luck; the gate can be tightened.
- **Account security:** no rate limiting or email verification for password accounts yet.
- **Farmer tools:** farmers cannot yet edit a listing's price or quantity in the UI.
- **Translations:** Hindi, Telugu and Spanish are machine-written and not yet reviewed by native speakers.
- **Google sign-in** has not been tested end to end with a live Google client.
- **Unmapped products:** a few USDA products (for example nectarines, cherries, leeks) are not mapped yet; the import lists everything it skips.
- **USDA AMS grain "nearest market"** is not built.

Next phases: agentic AI assistant, GraphRAG over a knowledge graph, an open knowledge format, and MCP tools, all built on the real price data above.

See `docs/` for architecture, plan and status.
