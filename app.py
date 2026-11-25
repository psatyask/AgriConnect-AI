#!/usr/bin/env python3
"""Run AgriConnect AI Phase 1 locally:  python app.py

Builds the React frontend if needed (requires Node.js 20+ and npm), then serves it
at http://127.0.0.1:8000 and opens your browser. Python standard library only.

Options:  --port 9000   --rebuild   --no-browser
This is a development convenience for Phase 1 (frontend only). The FastAPI
backend arrives in Phase 2.
"""
import argparse
import functools
import http.server
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
DIST = FRONTEND / "dist"


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=FRONTEND, check=True, shell=(sys.platform == "win32"))


def build(force: bool) -> None:
    if DIST.exists() and not force:
        return
    if shutil.which("npm") is None:
        sys.exit("npm was not found. Install Node.js 20+ from https://nodejs.org and run again.")
    if not (FRONTEND / "node_modules").exists():
        run(["npm", "install"])
    run(["npm", "run", "build"])


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    """Serves built files; unknown paths without a file extension fall back to index.html (client-side routing)."""

    def do_GET(self):
        path = self.translate_path(self.path)
        if not Path(path).exists() and "." not in Path(self.path.split("?")[0]).name:
            self.path = "/index.html"
        return super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the AgriConnect AI frontend.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--rebuild", action="store_true", help="force a fresh frontend build")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    build(args.rebuild)
    handler = functools.partial(SpaHandler, directory=str(DIST))
    url = f"http://127.0.0.1:{args.port}"
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"AgriConnect AI (Phase 1, demo data) running at {url}  (Ctrl+C to stop)")
        if not args.no_browser:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
