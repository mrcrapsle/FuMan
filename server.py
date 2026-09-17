#!/usr/bin/env python3
"""
Lokaler Entwicklungs-Server für Anstoß Mobile Pro - FM13.

Warum das nützlich ist (und nicht nur Bequemlichkeit):
Über file:// blockieren manche Android-WebViews den Zugriff auf localStorage komplett -
genau daran scheiterte das Speichern in der Dateivorschau (siehe safeLocalSet() in
index.html). Über http:// gibt es dieses Problem nicht. Der Server zeigt deshalb auch die
Adresse im lokalen Netz an, damit sich das Spiel direkt auf dem Handy im Browser öffnen
lässt, statt die HTML-Datei jedes Mal hin und her zu kopieren.

Nutzung:
    python3 server.py              # baut dist/ neu und startet auf Port 8000
    python3 server.py --port 5000  # anderer Port
    python3 server.py --no-build   # ohne Neubau starten

Erreichbar sind dann:
    /                  die modulare Fassung (index.html + css/ + js/) - zum Entwickeln,
                       Änderungen sind nach einem Reload sofort sichtbar
    /spiel             die gebaute Standalone-Datei - wird automatisch neu gebaut,
                       sobald eine Quelldatei neuer ist als das Build-Ergebnis
"""
import argparse
import functools
import http.server
import os
import socket
import socketserver
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_SCRIPT = os.path.join(ROOT, "build.py")
DIST_FILE = os.path.join(ROOT, "dist", "anstoss-fm13-standalone.html")
DIST_URL_PATH = "/dist/anstoss-fm13-standalone.html"


def source_files():
    """Alle Dateien, aus denen build.py die Standalone-Datei zusammensetzt."""
    files = [os.path.join(ROOT, "index.html"), os.path.join(ROOT, "css", "styles.css"), BUILD_SCRIPT]
    js_dir = os.path.join(ROOT, "js")
    if os.path.isdir(js_dir):
        files += [os.path.join(js_dir, f) for f in os.listdir(js_dir) if f.endswith(".js")]
    return [f for f in files if os.path.exists(f)]


def build_is_stale():
    if not os.path.exists(DIST_FILE):
        return True
    built_at = os.path.getmtime(DIST_FILE)
    return any(os.path.getmtime(f) > built_at for f in source_files())


def run_build():
    result = subprocess.run([sys.executable, BUILD_SCRIPT], cwd=ROOT,
                            capture_output=True, text=True)
    if result.returncode != 0:
        print("  ✗ Build fehlgeschlagen:\n" + (result.stderr or result.stdout))
        return False
    print("  ✓ " + (result.stdout.strip().splitlines() or ["dist neu gebaut"])[-1])
    return True


def get_lan_ip():
    """Ermittelt die eigene Adresse im lokalen Netz (ohne tatsächlich Daten zu senden)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Kurz-URL auf die gebaute Datei.
        if self.path.rstrip("/") == "/spiel":
            self.send_response(302)
            self.send_header("Location", DIST_URL_PATH)
            self.end_headers()
            return
        # Vor dem Ausliefern der Standalone-Datei neu bauen, falls eine Quelldatei neuer ist -
        # sonst bekommt man beim Entwickeln lautlos einen veralteten Stand serviert.
        if self.path.split("?")[0] == DIST_URL_PATH and build_is_stale():
            print("  ⟳ Quelldateien haben sich geändert - baue neu ...")
            run_build()
        return super().do_GET()

    def end_headers(self):
        # Ohne das liefert der Browser beim Entwickeln hartnäckig alte Stände aus dem Cache.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Nur Fehler melden - sonst rauscht jede einzelne Datei durch die Konsole.
        if args and str(args[0]).startswith(("GET", "HEAD")) and str(args[1]).startswith("2"):
            return
        super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser(description="Lokaler Entwicklungs-Server für Anstoß FM13")
    parser.add_argument("--port", type=int, default=8000, help="Port (Standard: 8000)")
    parser.add_argument("--no-build", action="store_true", help="dist/ nicht vor dem Start neu bauen")
    args = parser.parse_args()

    if not args.no_build:
        print("Baue dist/ ...")
        run_build()

    handler = functools.partial(Handler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        server = socketserver.TCPServer(("0.0.0.0", args.port), handler)
    except OSError as e:
        print(f"\n✗ Port {args.port} lässt sich nicht belegen ({e}).")
        print(f"  Läuft dort schon ein Server? Dann: python3 server.py --port {args.port + 1}")
        sys.exit(1)

    lan_ip = get_lan_ip()
    print("\n" + "=" * 58)
    print("  Anstoß FM13 - lokaler Server läuft")
    print("=" * 58)
    print(f"  Am Rechner:   http://localhost:{args.port}/")
    if lan_ip:
        print(f"  Im WLAN:      http://{lan_ip}:{args.port}/     ← für das Handy")
    print(f"  Gebaute Datei: http://localhost:{args.port}/spiel")
    print("\n  Über http:// funktioniert das Speichern auch dort, wo es")
    print("  als lokale Datei (file://) vom Browser blockiert wird.")
    print("\n  Beenden mit Strg+C")
    print("=" * 58 + "\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
        server.server_close()


if __name__ == "__main__":
    main()
