# AgriConnect AI

Growing Locally. Connecting Globally.

An agricultural marketplace with regional market intelligence, price forecasting and AI decision support. Supports India and the United States, built so more countries can be added as modular country packs.

**Status: Phase 1 (frontend foundation). All market data, news, listings and forecasts are clearly labeled DEMO content.** No backend yet.

## Run it

Requires Node.js 20+ and Python 3.

    python app.py

This installs dependencies, builds the frontend, serves it at http://127.0.0.1:8000 and opens your browser. For development with hot reload: `cd frontend && npm install && npm run dev`.

## Test

    cd frontend && npm test && npm run build

## What works in Phase 1
- Country selector (India, US) driven by a registry of country packs (`frontend/src/regions/`)
- Searchable language selector (20 languages listed; English, Hindi, Telugu, Spanish translated, others fall back to English with a notice; RTL handled)
- Country and language are independent; switching country clears data from the previous region
- Commodity-specific unit conversion (never a universal bushel factor)
- Light/dark theme, mobile drawer, persisted preferences
- Pages: Home, Marketplace, Market Intelligence, Price Forecasting, AI Assistant, Knowledge Explorer, demo login, farmer dashboard

See `docs/` for architecture, plan and status.
