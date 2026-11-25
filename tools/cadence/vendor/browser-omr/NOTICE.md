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

The homr source archive and three ONNX models are loaded from
`https://dsalex1.github.io/sheetscan/`, the upstream browser deployment.
They are not copied into this repository; this is an external availability
and update dependency. homr and its weights use AGPL-3.0; see upstream's
[license FAQ](https://github.com/liebharc/homr/blob/main/LICENSE_FAQ.md)
for training-data terms. PDF and rendered page bytes are processed locally;
only runtime/model downloads make external requests.

The test PDF is a lossless PDF rendering of Sheetscan's public Bach BWV 66.6
sample PNG at 200 dpi. The reference MIDI is converted from its ground-truth
MusicXML. These fixtures share the source repository's AGPL-3.0 license.
