# Cadence for GitHub Pages

## Copy to your website

Copy this entire **cadence** folder into the publishing root of your
**prerana-achar.github.io** repository, beside your existing homepage.
The important file location is **cadence/index.html**; do not add a dist folder
or another cadence folder around it. Commit those files using your normal
GitHub workflow. The page will be at:

https://prerana-achar.github.io/cadence/

No npm, build command, server, API key, hosting manifest, Jekyll configuration
change or repository-wide workflow change is required for the practice website.
Keep your existing homepage and website settings. Use HTTPS so microphone
permission is available. Opening index.html directly as a local file is not a
supported microphone setup.

All app scripts, styles and notation rendering assets use relative paths.
The optional font request uses Google Fonts over HTTPS. Files and microphone
audio are not sent to a remote recognition service.

## PDF scores: start the local reader

GitHub Pages serves static files; it cannot run the Python recognition engine.
Each computer using PDF import must run its own reader. MIDI practice needs no
reader, Python installation or local server.

### Windows

1. Keep a local copy of this cadence folder.
2. Install Python 3.12 with its Python launcher if it is not already installed.
3. Double-click **Start PDF Reader.cmd**. It creates a private environment in
   this folder and installs the pinned packages on first use.
4. Leave that window open while uploading PDFs from your website. Models
   download on first recognition. Close the window to stop the reader.

If you already have a Python executable but no launcher, use PowerShell:

    .\run-practice.ps1 -Setup -PythonPath 'C:\full\path\to\python.exe'

After setup, .\run-practice.ps1 starts the reader without reinstalling it.
The reader also serves this same practice app at http://127.0.0.1:18765/.
Use that local page if your browser blocks a GitHub page from reaching the
reader. Allow local-network access if the browser requests it.

### macOS / Linux

From this folder, with Python 3.12 installed:

    python3.12 -m venv .omr-venv
    .omr-venv/bin/python -m pip install -r recognizer/requirements.txt
    .omr-venv/bin/python recognizer/server.py

### Troubleshooting PDFs

- Read the detailed error below the score, or open pdf-reader.html.
- A stopped reader, old reader, missing installation and engine recognition
  errors are reported separately. Restart an old reader using the new launcher.
- Use an unlocked, clearly printed PDF, at most 12 pages and 20 MB. If one page
  cannot be recognized, try it alone. Do not rely on OMR as a perfect copy of
  the original; review the detected pitches and rhythm.
- For an engine error, .omr-cache/last-error.log contains the latest local
  diagnostics. It is not included in this package or uploaded to GitHub.
- Never commit .omr-venv, .omr-cache, private PDFs or generated outputs. The
  included .gitignore excludes reader environments, caches and logs.
- The default allowed web origin is https://prerana-achar.github.io. For a
  future custom domain, start the Python service with --allow-origin followed
  by that exact HTTPS origin, without a /cadence path.

## Included features

MIDI/PDF import, instrument and part selection, measure ranges, notes-only
waiting until correct, first-note timed start, automatic tempo learning with
manual override, expected-note playback, and standard beam/accidental notation.

## Checks

The source project's automated tests cover MIDI parsing, notation bindings,
pitch detection, timing, automatic/manual tempo and PDF import failures.
This export is checked for /cadence/ asset paths and exact copied file hashes.
The local reader has also been tested through real HTTP PDF recognition.
Physical microphone accuracy and browser local-network permission prompts
depend on the device and still need an on-device check.

## Third-party components

- abcjs 6.7.3 (MIT), bundled locally in vendor/. Its license is included as
  vendor/ABCJS-LICENSE.md.
- homr 0.7.1 (AGPL-3.0): https://github.com/liebharc/homr
- music21 10.5.2: https://github.com/cuthbertLab/music21
- pypdfium2 5.15.2: https://github.com/pypdfium2-team/pypdfium2

The PDF dependencies and model weights are installed separately; they are not
redistributed in this website folder. Their upstream licenses apply.
