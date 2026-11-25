# Cadence for GitHub Pages

Publish this folder at `tools/cadence/` using the existing GitHub Pages workflow.
There is no build step. MIDI import and practice run in the browser.

## PDF recognition without a launcher

PDF import now renders pages with PDF.js and runs homr in a dedicated browser
worker using Pyodide and ONNX Runtime Web. It does not contact a local service,
start a program, or require Python on the visitor's computer.

Use an up-to-date browser that supports WebAssembly JSPI (current Chrome or Edge
is recommended). The importer checks support before loading the engine. Browsers
without this capability can still use MIDI import. The site must be served over
HTTPS (or HTTP localhost for development); opening index.html as a file is not a
supported setup.

The first PDF import downloads roughly 150 MB of recognition models plus the
runtime and image libraries. An internet connection is required. Models are
cached when browser storage allows it. PDF bytes, page images and microphone
audio stay on the device. See vendor/browser-omr/NOTICE.md for dependencies,
licenses and the external upstream model-host dependency.

Choose a clear, unlocked printed PDF with 1–12 pages, up to 20 MB. Recognition can
take several minutes, especially on slower devices. Progress appears below the
score; Reset cancels the import and terminates its worker. Review detected notes
before practicing. Repeats are practiced as printed rather than unfolded; grace
notes are omitted. Drum notation and tablature are unsupported.

The old Windows launcher and recognizer/server.py are retained as legacy tools;
the website no longer uses them.

## Verification and release gate

**Not approved for production: full browser PDF recognition has not been verified
in this environment.** No deployment or push was performed.

Browser PDF recognition, runtime/model downloads and recognition accuracy still
need browser verification before production use. Review representative PDFs
against their original scores before pushing.

## Instrument sound and score layout

Your instrument now chooses the sound for both Hear this part and Automatic
playback after a mistake. Piano, nylon guitar, violin, cello, flute, clarinet,
trumpet, alto saxophone and finger bass use the corresponding FluidR3 GM samples;
Voice / other uses choir aahs. Playback stays at concert pitch, including for
transposing instruments. Metronome clicks keep their separate simple tone.

Instrument banks download on demand from
https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/ and are cached in memory
for this page session. Only the required pitches are decoded. This needs an
internet connection on first use; downloads time out after 15 seconds. If a bank
or note cannot load, an instrument-specific synthesized fallback is used and
identified beside Your instrument. Reset cancels a pending start, and stopping
playback cancels scheduled sample sources as well as synthesized notes.
Long held notes may decay to silence when their recorded sample ends.

Samples: FluidR3 GM by Frank Wen, rendered for MIDI.js by Benjamin Gleitzman,
CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). The downloaded
JavaScript wrapper is parsed as JSON data and is never executed.

The ABCJS score now wraps measures into systems using the available panel width,
with Standard, Comfortable and Large note sizes, measure numbers and additional
spacing. Irregular durations use conventional tied note values; rests and beams
follow beats, and repeated accidentals are suppressed within a measure. All tied
fragments retain the original note ID for feedback. These are improvements to
Cadence's existing renderer, not an embedded MuseScore engine. MIDI still lacks
original spelling, articulation and page layout; rhythm remains quantized to
sixteenths for display. Original performance timing is unchanged for grading.

Real audio quality, remote sample loading and visual layout at desktop/mobile
widths still need browser verification. Local HTTP hosting and file previews
were blocked in this environment; outbound sample downloads could not resolve.
No push or deployment was performed.
