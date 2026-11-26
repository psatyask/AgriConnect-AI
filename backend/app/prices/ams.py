"""USDA AMS Market News (MARS API) - discovery helpers only, until the real response format is confirmed.

Auth is HTTP Basic with the API key as the username and an empty password. The key is never printed.
"""
import requests

from ..config import settings

BASE = "https://marsapi.ams.usda.gov/services/v1.2"


def _get(path: str, params: dict | None = None):
    if not settings.mars_api_key:
        raise RuntimeError("MARS_API_KEY is not set in .env")
    try:
        r = requests.get(f"{BASE}/{path}", params=params, auth=(settings.mars_api_key, ""), timeout=60)
    except requests.RequestException as e:
        raise RuntimeError(f"Could not reach the MARS API ({type(e).__name__})") from None
    if r.status_code != 200:
        raise RuntimeError(f"MARS API returned HTTP {r.status_code} for {path}")
    return r.json()


def list_reports(keyword: str = "") -> list[dict]:
    data = _get("reports")
    items = data if isinstance(data, list) else data.get("results", [])
    k = keyword.lower()
    return [i for i in items if not k or all(w in str(i.get('report_title', '')).lower() for w in k.split())]


def sample_report(slug_id: str, limit: int = 3):
    data = _get(f"reports/{slug_id}", {"allSections": "true"})
    return data


def report_rows(slug_id: str, begin: str):
    """Rows for a report from a date (MM/DD/YYYY), as in USDA's examples: reports/<id>?q=report_begin_date=<date>."""
    return _get(f"reports/{slug_id}", {"q": f"report_begin_date={begin}"})
