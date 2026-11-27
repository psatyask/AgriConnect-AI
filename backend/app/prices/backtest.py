"""Run the forecast test over every stored price line and print the evidence.

    python -m app.prices.backtest [DAYS]      (default: all stored history up to 365 days)

The numbers printed here are the ones to quote: they come from the real stored prices, scored on dates the model had
not seen. Skill = 1 - (model's average error / "same as the latest report" average error); 0 means no better.
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from statistics import median

from sqlalchemy import func, select

from ..db import SessionLocal
from ..forecast import MIN_SKILL, evaluate
from ..models import PriceObservation as P


def load_series(db, days: int = 365, country: str = "US") -> dict[tuple, list[tuple[date, float]]]:
    value = func.coalesce(P.modal_price, (P.min_price + P.max_price) / 2, P.min_price, P.max_price)
    since = date.today() - timedelta(days=days)
    rows = db.execute(select(P.market, P.commodity, P.variety, P.unit, P.obs_date, func.avg(value))
                      .where(P.country == country, P.obs_date >= since, P.commodity.is_not(None), value.is_not(None))
                      .group_by(P.market, P.commodity, P.variety, P.unit, P.obs_date).order_by(P.obs_date)).all()
    out: dict[tuple, list] = defaultdict(list)
    for market, crop, variety, unit, d, v in rows:
        out[(market, crop, variety, unit)].append((d, float(v)))
    return out


def main() -> None:
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 365
    with SessionLocal() as db:
        all_series = load_series(db, days)
    results = {k: evaluate(v, today=date.today()) for k, v in all_series.items()}
    why = Counter(r.get("reason", "ok") for r in results.values())
    tested = [r for r in results.values() if r.get("holdout_skill") is not None]
    served = [r for r in results.values() if r["status"] == "ok"]
    reports = [len(v) for v in all_series.values()]
    print(f"{len(all_series)} price lines with history in the last {days} days (median {median(reports) if reports else 0} reports each).")
    print("Outcome per line:", ", ".join(f"{n} {k}" for k, n in why.most_common()))
    if tested:
        print(f"Tested on dates the model had not seen: {len(tested)} lines, median skill vs 'same as latest report' = "
              f"{median(r['holdout_skill'] for r in tested):+.1%} (all tested lines, winners and losers).")
    if served:
        print(f"Forecast offered for {len(served)} lines ({len(served) / len(all_series):.0%} of all lines). Gate: at least {MIN_SKILL:.0%} better "
              f"on the gate dates, and not worse on the holdout dates. Their holdout skill: median {median(r['holdout_skill'] for r in served):+.1%}, "
              f"best {max(r['holdout_skill'] for r in served):+.1%}.")
        print("Models chosen:", ", ".join(f"{n} {k}" for k, n in Counter(r['model'] for r in served).most_common()))
    else:
        print("No line passed the evidence check, so the app offers no forecasts yet.")
    print("Note: with under a year of history a seasonal baseline cannot be tested; load more history (ingest ams 365) to extend this.")


if __name__ == "__main__":
    main()
