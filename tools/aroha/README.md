# Aroha for GitHub Pages

Publish this folder at `tools/aroha/` using the existing GitHub Pages workflow.
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
take several minutes, especially on slower devices. Progress appears in a modal above the dimmed
workspace; Reset cancels the import and terminates its worker. Review detected notes
before practicing. Repeats are practiced as printed rather than unfolded; grace
notes are omitted. Drum notation and tablature are unsupported.

Only the browser PDF reader is included; no local launcher or server is needed.

## Verification and release gate

**Recognition accuracy still needs review.** Four user PDFs were imported in
the live browser, and the review found staff merging, missing meter changes and
octave-clef errors. The corrections below have conversion-level checks; corrected
PDF recognition must be rechecked in the browser after deployment.

Before publishing, verify a corrected PDF import in the browser against its
original score. Local conversion checks do not establish end-to-end recognition
accuracy. Runtime and model downloads were exercised in the earlier live imports.

## Instrument sound and score layout

Your instrument now chooses the sound for both Hear this part and Automatic
playback after a mistake. Piano, nylon guitar, violin and flute use their corresponding FluidR3 GM samples. Playback stays at concert pitch, including for
transposing instruments. Metronome clicks keep their separate simple tone.

All four FluidR3 GM instrument sets are bundled in vendor/soundfonts/FluidR3_GM/:
352 MP3s, covering A0–C8 for each instrument, totaling 7,722,872 bytes (7.4 MiB).
The player loads only the notes needed for the selected passage, from this site's
own URL. It makes no requests to an external instrument-sample host and executes
no downloaded JavaScript. Keep vendor/soundfonts/ in the GitHub Pages publish.

Four notes load concurrently and decoded samples stay cached for the session.
Only the four bundled instruments are supported; synthesized backup instruments
and remote sample-host retries have been removed. Missing samples show a loading
error instead of substituting another sound. Practice without Automatic playback
does not load instrument audio. Out-of-bank pitches reuse A0 or C8 with the
playback rate adjusted. Cancellation aborts in-flight loading. Long held notes
may decay when their recorded sample ends.

Source, license and attribution are recorded in vendor/soundfonts/NOTICE.md.
Samples are FluidR3 GM by Frank Wen, rendered for MIDI.js by Benjamin Gleitzman,
licensed under CC BY 3.0. These are actual recorded soundfont samples; they are
production assets, not demo scores or test fixtures.

The ABCJS score now wraps measures into systems using the available panel width,
with Standard, Comfortable and Large note sizes, measure numbers and additional
spacing. Irregular durations use conventional tied note values; rests and beams
follow beats, and repeated accidentals are suppressed within a measure. All tied
fragments retain the original note ID for feedback. These are improvements to
Aroha's existing renderer, not an embedded MuseScore engine. MIDI still lacks
original spelling, articulation and page layout; rhythm remains quantized to
sixteenths for display. Original performance timing is unchanged for grading.

Actual audio quality and visual layout at desktop/mobile widths still need
browser verification after changes.

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

Aroha opens without a selected song. Choose a library piece or import a PDF
or MIDI to enable preview and practice. No simulated take is included.

The Song position slider works in both views. Dragging during preview stops the
old scheduled notes and continues from the chosen time on release. During live
practice it pauses the microphone and starts a fresh take at the chosen note;
Resume practice continues from there. Skipped notes are not marked missed.
The slider is limited to Start measure / Practice measures.

Open violin strings highlight the string itself and show no zero or finger dot.
Sheet music uses the ABCJS renderer's fill and stroke attributes with separate
dark paper and ink colors; the icon styles do not apply to notation SVGs.

## Song chooser

Select song opens a searchable library filtered to the current instrument. The
14 locally bundled MIDI choices are selected Mutopia editions for piano, violin,
guitar and flute. Selecting a piece also selects its instrument. Nothing loads
automatically on startup. The chooser links to the full Mutopia instrument
catalog in a new tab; this is not an embedded live catalog or external API.
Download additional scores there and use Import from files for PDF or MIDI.
Edition credits and licenses are visible in the chooser and library/NOTICE.md.
Keep song-library.js and library/midi/ in the GitHub Pages publish.

PDF rasterization supplies PDF.js decoder, color-profile, CMap and font asset URLs
and uses pixel decoding for scanned images. Rendering errors are not ignored;
all-white rendered pages are filtered before loading the recognition models.
Only a specific no-staff detection result is skipped by the recognition pipeline;
other page failures retain their page number and original cause in Technical details.

PDF recognition reports staff-reading activity within each page. An indeterminate
bar is used while the remaining work is unknown, rather than a misleading 0% for
a one-page score. The modal shows elapsed time; its timer stops on completion,
cancellation, reset or error. Downloads and completed-page counts use measured
percentages. These indicators do not estimate time remaining.

## Accuracy corrections

PDF staves are exported to separate MIDI tracks so that the upper/pupil line can
be selected independently of accompaniment. Their voices, chords, ties, leading
rests and complete measure timelines are preserved. Generic PDF instrument tags
are omitted from the part label; source instrument classification is not inferred
from the recognizer's generic Piano/Voice labels.

The recognizer encodes only the denominator of a time signature. Cleanup now
keeps repeated-denominator signatures after music or at a new system, allowing
the writer to infer each printed segment independently, including 4/4 to 3/4.

Octave-clef correction now checks for 8 above as well as below. Corrected notes
carry per-note pitch mode derived from MIDI text markers so selecting guitar does not shift an already
corrected sounding pitch down a second octave. Plain clef changes reset the marker.
The exact 103 KiB homr source archive is bundled to pin the patched interfaces;
recognition models remain external.

Checks use the deployed parser source, the 77-note pupil transcription, mixed
4/4 and 3/4 passages, and the actual octave-above glyph rendered from Ave Maria.
These checks establish conversion behavior, not perfect model recognition of
every printed pitch or rhythm. Reimport PDFs after deploying these changes.

## Production review

Local checks cover JavaScript/Python syntax, referenced assets and element IDs,
all bundled library MIDI files, instrument sample coverage, and inference tensor
cleanup. Recognition releases temporary input/output tensors after every run and
releases decoder caches when replaced. Worker termination frees the engine on
completion, cancellation or failure. No test, demo, log or backup files are
required in the published Aroha folder. Keep the bundled source archive, MIDI
library, instrument samples and their license notices.

## Contact delivery

The contact form opens the visitor's email application using a mailto link.
The recipient and subject Aroha are filled in automatically, along with the
message, question/feedback category and optional name. The visitor reviews the
draft and sends it from their email app. No external form service is used.
The recipient address is public in the page and browser code. The message
stays in the form if no email handler is configured or the visitor cancels.
