# Architecture (Phase 1)

Frontend only: React + TypeScript + Vite + Tailwind. State is centralized in three contexts (Region, Language, Theme) persisted to localStorage.

- `regions/`: one country pack per country (currency, units, hierarchy, commodities). `registry.ts` is the only place that lists countries; shared code never branches on a country code.
- `config/languages.ts`: extensible language catalog (BCP 47 codes, native names, direction, UI coverage).
- `locales/`: static UI strings (en, hi, te, es). Others fall back to English.
- `data/demo.ts`: demonstration data per country. Regions without demo data show an empty state, never another country's data.
- Query cache keys must start with the country code; switching country purges other regions' data.

Planned (later phases): FastAPI + Postgres/pgvector, Google sign-in, market adapters, forecasting, OKF + Neo4j GraphRAG, LangGraph agents.
