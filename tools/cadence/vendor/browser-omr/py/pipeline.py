"""Sheet-music pages -> MusicXML. Runs unchanged natively (bench) and in Pyodide (browser).

Recognition is homr (staff detection + transformer); this module drives it page by
page and adds what homr lacks: octave clefs.
"""
import itertools
import json
import os
import sys
import tempfile
import types
import xml.etree.ElementTree as ET

import cv2
import numpy as np

# homr imports these at module level but only uses them for downloads, PDF
# rendering and title OCR, none of which this pipeline calls.
for _name, _attrs in (("requests", {}), ("pypdfium2", {}), ("rapidocr", {"RapidOCR": None})):
    try:
        __import__(_name)
    except ImportError:
        _mod = types.ModuleType(_name)
        _mod.__dict__.update(_attrs)
        sys.modules[_name] = _mod

from homr import main as homr_main  # noqa: E402
from homr import music_xml_generator, staff_parsing  # noqa: E402
from homr.main import ProcessingConfig, detect_staffs_in_image  # noqa: E402
from homr.model import MultiStaff  # noqa: E402
from homr.music_xml_generator import XmlGeneratorArguments  # noqa: E402
from homr.relieur import process_concat  # noqa: E402
from homr.system_repair import repair_systems  # noqa: E402
from homr.transformer import vocabulary  # noqa: E402
from homr.transformer.configs import Config  # noqa: E402
from homr.triplet_restoration import _as_triplet  # noqa: E402

_CONFIG = ProcessingConfig(
    enable_debug=False, enable_cache=False, write_staff_positions=False,
    read_staff_positions=False, selected_staff=-1, transformer_use_gpu=False,
    segnet_use_gpu=False, coreml_encoder=False, title_detection=False,
)
_TRANSFORMER = Config()
_TRANSFORMER.use_gpu_inference = False
_TRANSFORMER.use_coreml_encoder = False


def _ink(region):
    """Mask (0/255) of what is printed in a piece of the page. The cut is nearer to the
    paper than to the darkest ink, so that thin strokes a scanner turned grey still count."""
    if region.size == 0:
        return np.zeros((1, 1), np.uint8)
    paper, darkest = float(np.median(region)), float(region.min())
    if paper - darkest < 40:  # nothing printed here
        return np.zeros(region.shape, np.uint8)
    return (region < paper - 0.3 * (paper - darkest)).astype(np.uint8) * 255


def _has_eight_below(image, x0, x1, lines, limit, bass):
    """Is there a small "8" under a clef (an octave clef)? lines are the staff's five
    line positions there. An 8 is the only glyph with two small holes, one above the
    other. It may touch the clef or the bottom line, so look for the holes, not the
    glyph. Under a bass clef the 8 straddles the bottom line; a treble clef has loops
    of its own there, and its 8 hangs below the tail."""
    unit, bottom = (lines[4] - lines[0]) / 4, lines[4]
    y0, y1 = int(bottom - (1.2 if bass else 0.3) * unit), int(min(bottom + 5 * unit, limit))
    ink = _ink(image[y0:y1, max(int(x0), 0) : int(x1)])
    contours, hierarchy = cv2.findContours(ink, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return False
    holes = [cv2.boundingRect(c) for c, h in zip(contours, hierarchy[0]) if h[3] != -1]
    holes = [
        (bx + w / 2, by + h / 2)
        for bx, by, w, h in holes  # wider holes are half notes cut by a ledger line
        if 0.15 * unit <= w <= 0.65 * unit and 0.15 * unit <= h <= 0.65 * unit
    ]
    return any(
        abs(ax - bx) < 0.25 * unit and 0.2 * unit < by - ay < 1.1 * unit
        for ax, ay in holes
        for bx, by in holes
    )


def _has_eight_above(image, x0, x1, lines):
    """Recognise the two enclosed holes of an 8 above a clef, at staff scale."""
    unit = (lines[4] - lines[0]) / 4
    if unit <= 0:
        return False
    region = image[max(0, int(lines[0] - 5 * unit)):max(0, int(lines[0] - .8 * unit)),
                   max(0, int(x0)):int(x1)]
    if region.size == 0:
        return False
    paper = _ink(region) == 0
    height, width = paper.shape
    seen = np.zeros(paper.shape, dtype=bool)
    holes = []
    for y, x in zip(*np.where(paper)):
        if seen[y, x]:
            continue
        stack, boundary = [(int(y), int(x))], False
        seen[y, x] = True
        left = right = int(x)
        top = bottom = int(y)
        while stack:
            cy, cx = stack.pop()
            left, right = min(left, cx), max(right, cx)
            top, bottom = min(top, cy), max(bottom, cy)
            boundary |= cy == 0 or cx == 0 or cy == height - 1 or cx == width - 1
            for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
                if 0 <= ny < height and 0 <= nx < width and paper[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        w, h = right - left + 1, bottom - top + 1
        if not boundary and .15 * unit <= w <= .65 * unit and .15 * unit <= h <= .65 * unit:
            holes.append(((left + right) / 2, (top + bottom) / 2))
    return any(abs(ax-bx) < .25 * unit and .2 * unit < by-ay < 1.1 * unit
               for ax, ay in holes for bx, by in holes)


def _has_pitch(symbol):
    """A note the transformer gave a pitch like "C4" (now and then it gives none)."""
    return symbol.rhythm.startswith("note") and symbol.pitch[:1] in tuple("CDEFGAB") and symbol.pitch[1:].isdigit()


def _staff_name(symbol):
    return "lower" if symbol.position.startswith("lower") else "upper"


def _mark_octave_clefs(image, staff, symbols, carried):
    """Keep octave-clef sounding pitches, including 8va above and 8vb below.
    State is {staff name: (octave shift, clef sign)} and carries across systems.
    """
    state, started = dict(carried), set()
    for symbol in symbols:
        name = _staff_name(symbol)
        if symbol.rhythm.startswith(("note", "rest")):
            started.add(name)
            shift = state.get(name, (0,))[0]
            if shift and _has_pitch(symbol):
                symbol.pitch = symbol.pitch[0] + str(int(symbol.pitch[1:]) + shift)
        elif symbol.rhythm.startswith("clef"):
            sign = symbol.rhythm.split("_")[1][0]
            change = name in started and symbol.image_coordinates
            point = staff.get_at(symbol.image_coordinates[0]) if change else staff.grid[0]
            k = 5 if name == "lower" else 0
            if point is None or len(point.y) < k + 5:
                continue
            lines = point.y[k:k+5]
            unit = (lines[4] - lines[0]) / 4
            x = symbol.image_coordinates[0] if change else point.x + 1.5 * unit
            limit = point.y[5] - unit if k == 0 and len(point.y) > 5 else image.shape[0]
            below = _has_eight_below(image, x-2.5*unit, x+2.5*unit, lines, limit, sign == "F")
            above = _has_eight_above(image, x-2.5*unit, x+2.5*unit, lines)
            shift = -1 if below else 1 if above else 0
            if not shift and name not in started and carried.get(name, (0, None))[1] == sign:
                shift = carried[name][0]
            state[name] = (shift, sign)
            if shift:
                symbol.rhythm += "_8va" if shift > 0 else "_8vb"
    return state


_parse_staff_image = staff_parsing.parse_staff_image
_build_clef = music_xml_generator.build_clef
_line_above = None  # (top of the staff, how its octave clefs ended) of the last staff read
_activity = lambda text: None
_staffs_read = 0


def _parse_staff_image_with_octave_clefs(debug, index, staff, image, *args, **kwargs):
    # (Placing notes far from the staff by their notehead blob instead of the transformer's
    # count of ledger lines was tried here: no gain, chord heads run together.)
    global _line_above, _staffs_read
    _activity(f"Reading staff {_staffs_read + 1} on page {_page + 1}…")
    symbols = _parse_staff_image(debug, index, staff, image, *args, **kwargs)
    _staffs_read += 1
    _activity(f"Finished staff {_staffs_read} on page {_page + 1}…")
    # homr reads a part line by line down the page, then starts the next part at the top.
    carried = _line_above[1] if _line_above and _line_above[0] < staff.min_y else {}
    _line_above = (staff.min_y, _mark_octave_clefs(image, staff, symbols, carried))
    return symbols


def _build_clef_with_octave(model_clef, attributes):
    _build_clef(model_clef, attributes)
    if model_clef.rhythm.endswith(("_8vb", "_8va")):
        ET.SubElement(attributes.findall("clef")[-1], "clef-octave-change").text = "1" if model_clef.rhythm.endswith("_8va") else "-1"


def _preserve_system_time_signatures(chords):
    """The model encodes the denominator only (e.g. timeSignature-/4).
    A printed 3/4 after 4/4 therefore has the same token. Keep each printed change
    after music or at a new system so homr can estimate its own numerator.
    Duplicate signatures before the same notes are still collapsed.
    """
    clefs, key, time, time_pending = {}, "", "", False
    result_chords = []
    for chord in chords:
        result = []
        for symbol in chord:
            rhythm = symbol.rhythm
            if rhythm == "newline":
                time_pending = False
                result.append(symbol)
            elif rhythm.startswith("clef"):
                name = _staff_name(symbol)
                if clefs.get(name) != rhythm:
                    clefs[name] = rhythm
                    result.append(symbol)
            elif rhythm.startswith("keySignature"):
                if key != rhythm:
                    key = rhythm
                    result.append(symbol)
            elif rhythm.startswith("timeSignature"):
                if time != rhythm or not time_pending:
                    result.append(symbol)
                time, time_pending = rhythm, True
            else:
                if rhythm.startswith(("note", "rest")):
                    time_pending = False
                result.append(symbol)
        result_chords.append(result)
    return result_chords


vocabulary._remove_redudant_clefs_keys_and_time_signatures = _preserve_system_time_signatures


def _step(chord):
    """The notes and rests which decide how long a chord lasts (its shortest), and that length."""
    timed = [s for s in chord if s.rhythm.startswith(("note", "rest")) and s.get_duration().fraction > 0]
    if not timed:
        return [], 0
    shortest = min(s.get_duration().fraction for s in timed)
    return [s for s in timed if s.get_duration().fraction == shortest], shortest


def _fit_measure(measure, typical):
    """Bring a measure to the usual length by the fewest changes between plain and tuplet
    note values; if no such change fits exactly, it is left as read.
    Too long: a plain value next to tuplets is part of the tuplet (a quarter under a
    triplet bracket). Too short: tuplets which are none.
    (Also demanding that tuplet groups fill whole beats was tried and read worse.)"""
    total = vocabulary._get_duration_of_measure(measure)
    if not typical or total == typical:
        return measure
    steps = [shortest for shortest, length in map(_step, measure) if length]
    tuplets = [n for n, shortest in enumerate(steps) if any(s.is_tuplet() for s in shortest)]
    if total > typical:
        change = _as_triplet
        candidates = [
            n for n, shortest in enumerate(steps)
            if n not in tuplets and any(abs(n - t) <= 2 for t in tuplets)
            and all(change(s) is not s for s in shortest)
        ]
    else:
        change = lambda s: s.remove_tuplet()  # noqa: E731
        candidates = tuplets
    for size in range(1, min(len(candidates), 6) + 1):
        for chosen in itertools.combinations(candidates[:12], size):
            swap = {id(s): change(s) for n in chosen for s in steps[n]}
            trial = [[swap.get(id(s), s) for s in chord] for chord in measure]
            if vocabulary._get_duration_of_measure(trial) == typical:
                return trial
    return measure


def _repair_tuplets(chords):
    """Stands in for homr's _fix_over_eager_tuplets, which strips every tuplet from any
    measure shorter than the usual one - ruinous for music that is full of them."""
    measures = vocabulary._group_into_measures(chords)
    typical = vocabulary._get_typical_duration_of_measures(measures)
    return vocabulary._flatten_measures([_fit_measure(m, typical) for m in measures])


vocabulary._fix_over_eager_tuplets = _repair_tuplets

_page = 0  # index of the page being read, for note ids
_notes = 0


def _build_note_id(note, symbol):
    """Gives every note an id which says where it was seen: n<count>-p<page>-<x>-<y>,
    in pixels of the page image. The editor uses it to show a note's place on the scan."""
    global _notes
    _notes += 1
    at = symbol.image_coordinates
    where = f"-p{_page}-{max(round(at[0]), 0)}-{max(round(at[1]), 0)}" if at else ""
    note.set("id", f"n{_notes}{where}")


# homr segments a page eight tiles at a time; two at a time need far less memory at once
# (which phones lack) and are as fast on a CPU.
_extract = homr_main.extract
homr_main.extract = lambda *args, **kwargs: _extract(*args, batch_size=2, **kwargs)

# homr has no hooks; its functions look these up as module globals on every call.
staff_parsing.parse_staff_image = _parse_staff_image_with_octave_clefs
music_xml_generator.build_clef = _build_clef_with_octave
music_xml_generator.build_image_position = _build_note_id


def _are_joined(image, upper, lower):
    """Do two staves belong to one system? Then a line joins them at their left end."""
    a, b = upper.grid[0], lower.grid[0]
    unit = (a.y[4] - a.y[0]) / 4
    x = int(max(a.x, b.x))
    gap = image[int(a.y[-1] + unit / 2) : int(b.y[0] - unit / 2), max(int(x - 1.5 * unit), 0) : int(x + 1.5 * unit)]
    return gap.size > 0 and _ink(gap).any(axis=1).mean() > 0.95


def _split_unjoined_systems(image, rows):
    """homr guesses which staves form a system from the layout of the page, and e.g.
    takes a piano system followed by a single-staff line for a system of two parts
    sounding together. Keep only what the system line confirms."""
    result = []
    for row in rows:
        group = [row.staffs[0]]
        for staff in row.staffs[1:]:
            if _are_joined(image, group[-1], staff):
                group.append(staff)
            else:
                result.append(MultiStaff(group, []))
                group = [staff]
        result.append(row if len(group) == len(row.staffs) else MultiStaff(group, []))
    return result


def _staff_boxes(rows, to_input):
    """Where the staves are, for placing text found on the page: one
    [left, top line, right, bottom line, system index] per staff, in page-image pixels."""
    boxes = []
    for system, row in enumerate(rows):
        for staff in row.staffs:
            first, last = staff.grid[0], staff.grid[-1]
            for k in range(0, len(first.y) - 4, 5):
                left, top = to_input((first.x, first.y[k]))
                right, bottom = to_input((last.x, first.y[k + 4]))
                boxes.append([round(left), round(top), round(right), round(bottom), system])
    return boxes


def _read_page(path):
    """One page image -> (MusicXML <score-partwise> element, staff boxes)."""
    global _line_above, _staffs_read
    _line_above = None
    _staffs_read = 0
    _activity(f"Finding staves and symbols on page {_page + 1}…")
    rows, image, debug, _, _, to_input = detect_staffs_in_image(path, _CONFIG)
    try:
        rows = _split_unjoined_systems(image, repair_systems(debug, rows))
        voices = staff_parsing.parse_staffs(debug, rows, image, config=_TRANSFORMER)
    finally:
        debug.clean_debug_files_from_previous_runs()
    for symbol in (s for voice in voices for s in voice):
        if symbol.image_coordinates:  # so far in the resized page homr works on
            symbol.image_coordinates = to_input(symbol.image_coordinates)
    xml = music_xml_generator.generate_xml(XmlGeneratorArguments(False, None, None), voices, "")
    return xml, _staff_boxes(rows, to_input)


# The MusicXML schema fixes the order of children; homr writes some out of it (voice
# after type, alter after octave, clef before key). Most programs don't mind, Finale
# refuses the file. Normalize child order before MIDI conversion.
_CHILD_ORDER = {
    "note": "grace cue chord pitch unpitched rest duration tie instrument footnote level voice type dot "
            "accidental time-modification stem notehead notehead-text staff beam notations lyric play listen",
    "pitch": "step alter octave",
    "attributes": "footnote level divisions key time staves part-symbol instruments clef staff-details "
                  "transpose for-part directive measure-style",
}


def _order_children(score):
    for tag, order in _CHILD_ORDER.items():
        rank = {name: i for i, name in enumerate(order.split())}
        for element in score.iter(tag):
            element[:] = sorted(element, key=lambda child: rank.get(child.tag, len(rank)))  # stable


def _give_every_staff_a_clef(score):
    """A staff that is silent at first (a piece opening on single-staff lines before the
    piano enters) gets its first clef only where it starts: put that clef at the beginning."""
    for part in score.findall("part"):
        first = part.find("measure/attributes")
        if first is None:
            continue
        have = {clef.get("number", "1") for clef in first.findall("clef")}
        for clef in part.iter("clef"):
            number = clef.get("number", "1")
            if number not in have:
                have.add(number)
                copy = ET.fromstring(ET.tostring(clef))
                last = first.findall("clef")
                first.insert(list(first).index(last[-1]) + 1 if last else len(first), copy)


def scan(paths, progress=lambda done, total: None, activity=lambda text: None):
    """Recognise each page image; pages without music are skipped. Returns MusicXML text.
    The staff boxes of every page ride along as the miscellaneous field "staff-layout"."""
    global _page, _activity
    _activity = activity
    with tempfile.TemporaryDirectory() as tmp:
        xmls, layout = [], [[] for _ in paths]
        skipped = []
        for _page, path in enumerate(paths):
            progress(_page, len(paths))
            try:
                xml, layout[_page] = _read_page(path)
            except Exception as e:
                # Only a genuine no-staff result can be skipped as a title page.
                # Model, runtime and parsing failures must retain their cause.
                detail = f"Page {_page + 1}: {type(e).__name__}: {e}"
                if str(e).strip().lower() in {
                    "no staffs found", "no staffs found.", "no staves found", "no staves found.",
                    "no noteheads or clefs found", "no noteheads or clefs found."
                }:
                    skipped.append(detail)
                    continue
                raise RuntimeError(f"Recognition engine failed. {detail}") from e
            xmls.append(os.path.join(tmp, f"{_page}.musicxml"))
            ET.ElementTree(xml).write(xmls[-1], encoding="unicode", xml_declaration=True)
        progress(len(paths), len(paths))
        if not xmls:
            raise ValueError("No music found on any page. " + "; ".join(skipped))
        merged = process_concat(xmls)[0] if len(xmls) > 1 else ET.parse(xmls[0]).getroot()
        _give_every_staff_a_clef(merged)
        _order_children(merged)
        field = ET.SubElement(ET.SubElement(merged.find("identification"), "miscellaneous"), "miscellaneous-field")
        field.set("name", "staff-layout")
        field.text = json.dumps(layout)
        return ET.tostring(merged, encoding="unicode", xml_declaration=True)
