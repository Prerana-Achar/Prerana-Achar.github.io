# Bundled instrument samples

These production audio assets are extracted from the FluidR3 GM MP3 bundles
in Benjamin Gleitzman's midi-js-soundfonts repository:

https://github.com/gleitz/midi-js-soundfonts/tree/gh-pages/FluidR3_GM

Original soundfont: **FluidR3 GM**, by **Frank Wen**.
MP3 rendering and distribution: **Benjamin Gleitzman** and contributors.

License: **Creative Commons Attribution 3.0 Unported (CC BY 3.0)**.

- License: https://creativecommons.org/licenses/by/3.0/
- Legal text: https://creativecommons.org/licenses/by/3.0/legalcode
- Upstream licensing statement: https://gleitz.github.io/midi-js-soundfonts/

You may copy and redistribute these samples and create adaptations under that
license, with appropriate attribution, a link to the license and an indication
of changes. No endorsement by the original authors is implied.

Aroha changes: individual MP3 byte streams were extracted from the four
JavaScript/base64 bundles. Audio bytes were not edited or re-encoded. The
JavaScript wrappers, demonstration pages and tests are not included.

Included sets (88 chromatic notes, A0 through C8, in each):

| Folder in FluidR3_GM | Instrument | Audio bytes |
| --- | --- | ---: |
| acoustic_grand_piano-mp3 | Acoustic grand piano | 1,971,564 |
| acoustic_guitar_nylon-mp3 | Nylon-string acoustic guitar | 1,375,722 |
| violin-mp3 | Violin | 2,150,808 |
| flute-mp3 | Flute | 2,224,778 |

All paths and filenames must be preserved when publishing on GitHub Pages.
The player fetches these files from the same origin as Aroha.
