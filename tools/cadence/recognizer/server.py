"""Local PDF -> homr MusicXML -> music21 MIDI bridge for Cadence.

Recognition runs on this computer, never in the static hosting worker.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from importlib.util import find_spec
from pathlib import Path
import argparse
import json
import os
import subprocess
import sys
import tempfile
import threading
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
MAX_PDF_BYTES = 20 * 1024 * 1024
SITE_ORIGIN = "https://prerana-achar.github.io"
GITHUB_ORIGIN = "https://prerana-achar.github.io"
BUSY = threading.Lock()


def engine_ready():
    return all(find_spec(name) is not None for name in ("homr", "music21", "pypdfium2"))


def public_directory():
    return ROOT / "dist" if (ROOT / "dist" / "index.html").is_file() else ROOT


def recognition_error(result):
    detail = (result.stderr + b"\n" + result.stdout).decode(errors="replace")
    folder = ROOT / ".omr-cache"
    folder.mkdir(exist_ok=True)
    (folder / "last-error.log").write_text(detail[-16000:], encoding="utf-8")
    lower = detail.lower()
    if any(word in lower for word in ("timed out", "connectionerror", "sslerror", "certificate verify")):
        return "The recognition models could not be downloaded. Check the connection and restart the reader."
    if any(word in lower for word in ("no staff", "no staves", "no music", "not enough staff", "no noteheads or clefs")):
        return "No readable music staves were found on one of these pages. Try a single, clearly printed score page."
    if "memory" in lower and any(word in lower for word in ("failed", "alloc", "out of")):
        return "The reader ran out of memory. Try a smaller PDF or fewer pages."
    if "no module named" in lower or "dll load failed" in lower:
        return "A reader dependency failed to load. Run Start PDF Reader.cmd --setup to repair it."
    return "The reader could not interpret one of these pages. Try a single clear page. Details are in .omr-cache/last-error.log."


def export_written_midi(score, output):
    # PDF notes represent the printed staff. The browser applies the selected
    # instrument's written-to-concert transposition, just once, at practice time.
    for item in score.recurse().getElementsByClass("Instrument"):
        item.transposition = None
    score.write("midi", fp=str(output), addEndDelay=False)


def recognize_pdf(data):
    """Real engine invocation; no synthetic notes or fallback transcription."""
    if not engine_ready():
        raise RuntimeError("The PDF reader is not installed. Run run-practice.ps1 -Setup first.")
    import pypdfium2 as pdfium
    from music21 import converter

    with tempfile.TemporaryDirectory(prefix="cadence-score-") as temp:
        folder = Path(temp)
        source = folder / "score.pdf"
        source.write_bytes(data)
        # Serialize the entire job: PDFium is not thread-safe.
        try:
            document = pdfium.PdfDocument(str(source))
        except pdfium.PdfiumError as error:
            message = str(error).lower()
            if "password" in message or "security" in message:
                raise ValueError("This PDF is password-protected. Export an unlocked copy first.") from error
            raise ValueError("The PDF is damaged or cannot be opened. Export it again as a standard PDF.") from error
        try:
            if not 1 <= len(document) <= 12:
                raise ValueError("Choose a PDF with 1–12 pages, or split a longer score first.")
            images = []
            for index in range(len(document)):
                page = document[index]
                width, height = page.get_size()
                if min(width, height) <= 0 or width * height * 9 > 24_000_000:
                    raise ValueError("This PDF page is too large. Export it at a standard page size.")
                image_path = folder / f"page-{index + 1:03}.png"
                bitmap = page.render(scale=3)
                image = bitmap.to_pil()
                try:
                    image.save(image_path)
                finally:
                    image.close()
                    bitmap.close()
                    page.close()
                images.append(str(image_path))
        finally:
            document.close()
        # Invoke homr's documented entry point with all pages, so it can merge them.
        result = subprocess.run(
            [sys.executable, "-c", "from homr.main import main; main()", "--no-title", *images],
            cwd=folder, capture_output=True, timeout=540, check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        if result.returncode:
            raise RuntimeError(recognition_error(result))
        outputs = sorted(folder.glob("*.musicxml"))
        merged = [p for p in outputs if p.name.startswith("merged_")]
        if merged:
            outputs = merged
        if len(outputs) != 1:
            raise RuntimeError("Recognition did not produce one complete score. Try a single page first.")
        score = converter.parse(str(outputs[0]), forceSource=True)
        if not list(score.recurse().notes):
            raise RuntimeError("No pitched notes were detected. Try a clearer printed sheet.")
        output = folder / "recognized.mid"
        export_written_midi(score, output)
        midi = output.read_bytes()
        if not midi.startswith(b"MThd") or len(midi) > 5 * 1024 * 1024:
            raise RuntimeError("The recognized score could not be converted to a supported MIDI file.")
        return midi


class PracticeServer(ThreadingHTTPServer):
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Do not log score names or document contents.

    def allowed(self):
        # Restrict browser access and DNS-rebinding attempts to this app/loopback.
        hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        origins = {SITE_ORIGIN, GITHUB_ORIGIN, *getattr(self.server, "extra_origins", []), *(f"http://{host}" for host in hosts)}
        return self.headers.get("Host") in hosts and self.headers.get("Origin") in origins | {None}

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin and self.allowed():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def reply(self, status, body, mime="application/json"):
        if not isinstance(body, bytes):
            body = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if not self.allowed():
            self.reply(403, {"error": "This origin is not allowed."})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.allowed():
            self.reply(403, {"error": "This origin is not allowed."})
        elif self.path == "/api/health":
            self.reply(200, {"engine": "homr", "apiVersion": 1, "installed": engine_ready()})
        elif self.path.startswith("/api/"):
            self.reply(404, {"error": "Unknown endpoint."})
        else:
            pieces = unquote(urlsplit(self.path).path).split("/")
            if any(p.startswith(".") for p in pieces if p) or any(p in {"recognizer", "tests", "scripts"} for p in pieces):
                self.reply(404, {"error": "Not a public website file."})
            else:
                super().do_GET()

    def do_POST(self):
        if not self.allowed():
            self.reply(403, {"error": "This origin is not allowed."})
            return
        if self.path != "/api/recognize":
            self.reply(404, {"error": "Unknown endpoint."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            size = 0
        if not 0 < size <= MAX_PDF_BYTES:
            self.reply(413, {"error": "Choose a PDF smaller than 20 MB."})
            return
        if self.headers.get_content_type() != "application/pdf":
            self.reply(415, {"error": "Upload a PDF sheet-music file."})
            return
        if not BUSY.acquire(blocking=False):
            self.reply(409, {"error": "The PDF reader is busy. Try again after the current score finishes."})
            return
        try:
            self.connection.settimeout(20)
            data = self.rfile.read(size)
            if len(data) != size or not data.startswith(b"%PDF-"):
                self.reply(400, {"error": "This is not a valid PDF file."})
                return
            # One isolated worker bounds both PDF parsing and engine runtime.
            with tempfile.TemporaryDirectory(prefix="cadence-job-") as temp:
                source = Path(temp) / "input.pdf"
                output = Path(temp) / "output.mid"
                source.write_bytes(data)
                job = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), "--convert", str(source), str(output)],
                    capture_output=True, timeout=570, check=False,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
                if job.returncode:
                    message = job.stderr.decode(errors="replace").strip().splitlines()
                    self.reply(422, {"error": message[-1][:250] if message else "Recognition failed."})
                else:
                    self.reply(200, output.read_bytes(), "audio/midi")
        except subprocess.TimeoutExpired:
            self.reply(504, {"error": "Recognition took too long. Try fewer pages."})
        except (OSError, ValueError):
            self.reply(422, {"error": "This PDF could not be read. Try exporting it again."})
        finally:
            BUSY.release()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18765)
    parser.add_argument("--convert", nargs=2, metavar=("INPUT", "OUTPUT"))
    parser.add_argument("--allow-origin", action="append", default=[])
    parser.add_argument("--web-root", type=Path)
    args = parser.parse_args()
    if args.convert:
        try:
            Path(args.convert[1]).write_bytes(recognize_pdf(Path(args.convert[0]).read_bytes()))
        except Exception as error:
            print(str(error), file=sys.stderr)
            sys.exit(1)
        return
    os.environ.setdefault("XDG_CACHE_HOME", str(ROOT / ".omr-cache"))
    for origin in args.allow_origin:
        parsed = urlsplit(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"} or parsed.username or parsed.query or parsed.fragment:
            parser.error("--allow-origin must be an HTTP(S) origin without a path")
    handler = partial(Handler, directory=str(args.web_root or public_directory()))
    with PracticeServer(("127.0.0.1", args.port), handler) as server:
        server.extra_origins = [origin.rstrip("/") for origin in args.allow_origin]
        print(f"Cadence: http://127.0.0.1:{args.port} · PDF reader {'installed' if engine_ready() else 'not installed'}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
