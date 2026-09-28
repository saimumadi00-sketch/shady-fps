"""Launch Crosscurrent in a browser from PyCharm; no Python packages required.

The game itself is a static JavaScript/WebGL application. This optional helper
serves dist/ when available, or the source directory during development.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import threading
import webbrowser


# Parse launch options, select static assets, and own the HTTP server lifecycle.
def main():
    # Bind locally by default; LAN access is an explicit host option.
    parser = argparse.ArgumentParser(description="Launch the Crosscurrent browser FPS")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="127.0.0.1", help="Use 0.0.0.0 for LAN phone testing")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    # Resolve relative to this file so PyCharm working-directory changes do not break assets.
    root = Path(__file__).resolve().parent
    # Prefer built assets; source is a fallback when no production entry page exists.
    directory = root / "dist" if (root / "dist" / "index.html").exists() else root
    # Set the served directory without changing the process working directory.
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    # Report occupied ports or bind failures with an actionable alternative.
    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as error:
        raise SystemExit(f"Cannot start preview: {error}. Try --port 8081.") from error
    url = f"http://localhost:{args.port}"
    print(f"Crosscurrent: {url}\nServing {directory}\nPress Ctrl+C to stop.")
    # Give the listening server a short head start before opening the system browser.
    if not args.no_browser:
        threading.Timer(0.3, webbrowser.open, args=(url,)).start()
    # Keep serving until Ctrl+C and always release the listening socket afterward.
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


# Importing this module is safe: only direct execution starts a server.
if __name__ == "__main__":
    main()
