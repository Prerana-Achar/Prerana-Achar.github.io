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

Only the browser PDF reader is included; no local launcher or server is needed.

## Verification and release gate

**Not approved for production: full browser PDF recognition has not been verified
in this environment.** No deployment or push was performed.

Browser PDF recognition, runtime/model downloads and recognition accuracy still
need browser verification before production use. Review representative PDFs
against their original scores before pushing.

## Instrument sound and score layout

Your instrument now chooses the sound for both Hear this part and Automatic
playback after a mistake. Piano, nylon guitar, violin and flute use their corresponding FluidR3 GM samples. Playback stays at concert pitch, including for
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

## Practice views

Instrument is the default view. The header toggle switches between Instrument
and Music sheet without changing the session, audio, timing or selected range.
Instrument follows one target note at a time during preview and live practice;
Previous/Next can browse individual notes when stopped or paused. Measures per
page and Follow the score apply only to Music sheet and keep their saved values
when switching views. Start measure and Practice measures apply to both views.

Only Violin, Piano, Guitar and Flute are offered. All four drawings are original,
horizontal SVGs with a fixed layout; only highlights and finger numbers change.
No external visualization library or hosted iframe is loaded.

Violin uses four first-position guides (1, high 2, 3 and 4). Low/high finger
adjustments are labeled. Open strings are preferred where available; notes above
the first-position range explicitly need a shift instead of a guessed marker.
Guitar uses standard tuning and a numbered suggested finger in a four-fret hand
position. Its fixed 12- or 24-fret display is chosen for the selected passage.
Piano has a Left/Right hand selector. Suggested finger numbers are calculated
across the passage using a small movement-cost search; they are practice aids,
not editorial fingerings from the score. Flute shows primary Boehm C-foot
fingerings for C4–C7, including thumb, G-sharp, foot and high-note trill keys.
Alternate fingerings and other flute types are not represented.

Design references (no source code or artwork copied):
- Notae: https://memoriainfinita.github.io/notae/
- Piano Chart: https://github.com/ailon/piano-chart
- SVGuitar: https://github.com/omnibrain/svguitar
- Fingering Components: https://github.com/pepperhorn/fingering-components

Fingering references:
- Yamaha violin: https://www.yamaha.com/en/musical_instrument_guide/violin/play/play003.html
- Yamaha piano: https://hub.yamaha.com/keyboards/k-how-to/the-basics-of-piano-keyboard-fingering/
- Guitar position reference: https://musescore.com/articles/materials/guitar/guitar-notes
- Flute primary fingerings: https://www.wfg.woodwind.org/flute/fl_bas_1.html
  (plus fl_bas_2.html and fl_bas_3.html for the upper octaves).

Cadence opens without a sample score. Upload a PDF or MIDI to enable preview
and practice. No demo download, simulated take or bundled demo MIDI is included.
