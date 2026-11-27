"""Run the forecast test over every stored price line and print the evidence.

    python -m app.prices.backtest [DAYS]      (default: all stored history, up to 1100 days)

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
from ..forecast import MIN_HOLDOUT_SKILL, MIN_SKILL, MIN_WIN_RATE, evaluate, null_pass_rate
from ..models import PriceObservation as P


def load_series(db, days: int = 1100, country: str = "US") -> dict[tuple, list[tuple[date, float]]]:
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
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 1100
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
    per_method: dict[str, list[float]] = defaultdict(list)
    for r in tested:
        for k, v in r["candidate_skills"].items():
            if v is not None:
                per_method[k].append(v)
    if per_method:
        names = {"ma5": "5-report average", "ses": "exponential smoothing", "trend": "damped trend", "seas": "same week last year", "seas_adj": "today + last year's change"}
        print("Each method on its own, median skill vs 'same as latest report' on the holdout dates (lines tested):")
        for k, v in sorted(per_method.items(), key=lambda kv: -median(kv[1])):
            print(f"  {names.get(k, k)}: {median(v):+.1%} ({len(v)} lines, better than the baseline on {sum(x > 0 for x in v) / len(v):.0%} of them)")
    if served:
        print(f"Forecast offered for {len(served)} lines ({len(served) / len(tested):.1%} of the {len(tested)} lines that could be tested). Gate: at least "
              f"{MIN_SKILL:.0%} better on the gate dates, {MIN_HOLDOUT_SKILL:.0%} on the holdout dates, and closer on {MIN_WIN_RATE:.0%} of tests. "
              f"Their holdout skill: median {median(r['holdout_skill'] for r in served):+.1%}, best {max(r['holdout_skill'] for r in served):+.1%}.")
        n_typ = round(median(r["history_reports"] for r in tested))
        luck, _ = null_pass_rate(n_typ)
        print(f"For comparison, {luck:.1%} of simulated random walks of {n_typ} reports (nothing to predict) pass the same check by luck alone. "
              "Only a pass rate clearly above that is evidence of real skill.")
        print("Models chosen:", ", ".join(f"{n} {k}" for k, n in Counter(r['model'] for r in served).most_common()))
        by_crop = Counter(k[1] for k, r in results.items() if r["status"] == "ok")
        tested_crop = Counter(k[1] for k, r in results.items() if r.get("holdout_skill") is not None)
        print("Forecast offered by crop (passed / tested):", ", ".join(f"{c} {n}/{tested_crop[c]}" for c, n in by_crop.most_common(15)))
    else:
        print("No line passed the evidence check, so the app offers no forecasts yet.")
    seasonal = sum(1 for r in results.values() if r.get("history_reports", 0) >= 400)
    print(f"{seasonal} lines have over a year of reports, so last year's pattern could be tested on them; load older data with "
          "'ingest ams-range YYYY-MM-DD YYYY-MM-DD' to extend this.")


if __name__ == "__main__":
    main()
