# Browser recognition components

`ort.js`, `py/ort_shim.py` and `py/pipeline.py` are adapted from
[Sheetscan](https://github.com/dsalex1/sheetscan), commit
`e6c82d8819f8ce475f7efdd5211fc44e9e58b6bc`, under AGPL-3.0.
The full license is included in LICENSE. Cadence's worker adapter and MIDI
converter in this directory are also supplied under AGPL-3.0.

Changes: serve plain modules without Vite; run ONNX with one thread for GitHub
Pages; tolerate unavailable browser caches; convert written-pitch MusicXML
to MIDI using Python's standard library; terminate workers on cancellation.
The shared-memory fallback is not included: browsers must support WebAssembly JSPI.

Runtime downloads use pinned jsDelivr versions of Pyodide 314.0.7 (MPL-2.0),
ONNX Runtime Web 1.31.1 (MIT), and PDF.js 6.5.438 (Apache-2.0).
Their upstream licenses and those of Pyodide's image packages apply.

The homr source archive is bundled as homr.zip, unchanged from Sheetscan
commit 0cbcbc43e7f4cfab17be7c486a571c881079bd1c:
https://github.com/dsalex1/sheetscan/blob/0cbcbc43e7f4cfab17be7c486a571c881079bd1c/homr.zip
This pins the parser interfaces used by the corrections. The three ONNX models
still load from `https://dsalex1.github.io/sheetscan/`; their availability and
updates remain an external dependency. homr and its weights use AGPL-3.0; see upstream's
[license FAQ](https://github.com/liebharc/homr/blob/main/LICENSE_FAQ.md)
for training-data terms. PDF and rendered page bytes are processed locally;
only runtime/model downloads make external requests.

No test PDFs or reference MIDI fixtures are bundled. Page processing errors
are preserved instead of being reported as missing music.

Cadence corrections preserve staves as separate selectable MIDI tracks, retain
printed time-signature changes across systems, detect octave-above clefs, and
mark octave-corrected MIDI notes to prevent a second playback transposition.
Temporary inference tensors and replaced decoder caches are released explicitly.
