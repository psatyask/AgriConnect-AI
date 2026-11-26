from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .auth import router as auth_router
from .listings import router as listings_router
from .price_api import router as prices_router
from .config import ROOT, settings

app = FastAPI(title="AgriConnect AI API", version="0.2.0")
app.add_middleware(
    CORSMiddleware, allow_origins=settings.origins, allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type"],
)


@app.middleware("http")
async def reject_foreign_origins(request: Request, call_next):
    """CSRF defence for cookie sessions: unsafe requests must come from an allowed origin (or carry none, as curl does)."""
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin not in settings.origins:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    return await call_next(request)


app.include_router(auth_router)
app.include_router(listings_router)
app.include_router(prices_router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# Serve the built React app (python app.py builds it). Unknown non-API paths fall back to index.html.
DIST = ROOT / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (DIST / path).resolve()
        if path and candidate.is_file() and DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-store"})
