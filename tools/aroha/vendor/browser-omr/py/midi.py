"""Convert homr MusicXML to MIDI, without a native dependency.

Preserves voices/chords, rests, divisions, pickups, meter, tempo, ties and parts.
Each printed staff becomes its own selectable track, with all its voices intact.
Repeats are practiced as printed, without unfolding repeat navigation.
"""
from fractions import Fraction
import math
import struct
import xml.etree.ElementTree as ET

PPQ = 480


def vlq(value):
    value = max(0, int(value))
    result = [value & 127]
    while value >> 7:
        value >>= 7
        result.insert(0, (value & 127) | 128)
    return bytes(result)


def meta(kind, payload):
    return bytes([255, kind]) + vlq(len(payload)) + payload


def track(events, end_tick=None):
    events.sort(key=lambda event: (event[0], event[1]))
    data, previous = bytearray(), 0
    for tick, _, event in events:
        tick = round(tick)
        data.extend(vlq(tick - previous) + event)
        previous = tick
    end_tick = max(previous, round(end_tick)) if end_tick is not None else previous
    data.extend(vlq(end_tick - previous) + b'\xff\x2f\x00')
    return b'MTrk' + struct.pack('>I', len(data)) + data


def convert(xml):
    root = ET.fromstring(xml)
    # Support both ordinary and namespace-qualified MusicXML.
    for node in root.iter():
        node.tag = node.tag.rsplit('}', 1)[-1]
    if root.tag != 'score-partwise':
        raise ValueError('Recognition did not produce a partwise score.')
    names = {p.get('id'): p.findtext('part-name', 'PDF part') for p in root.findall('./part-list/score-part')}
    parts = root.findall('part')
    if len(parts) > 15:
        raise ValueError('This score has too many parts. Import a smaller set of parts.')
    conductor = [(0, 0, meta(81, (600000).to_bytes(3, 'big'))),
                 (0, 0, meta(88, bytes([4, 2, 24, 8])))]
    tracks, total, stream_count = [], 0, 0
    for index, part in enumerate(parts):
        staff_ids = sorted({note.findtext('staff', '1') for note in part.iter('note')
                            if note.find('pitch') is not None and note.find('grace') is None},
                           key=lambda staff: (not staff.isdigit(), int(staff) if staff.isdigit() else staff))
        if stream_count + len(staff_ids) > 15:
            raise ValueError('This score has too many playable staves. Import fewer parts.')
        staff_events, channels = {}, {}
        for staff in staff_ids:
            channel = stream_count if stream_count < 9 else stream_count + 1
            stream_count += 1
            channels[staff] = channel
            label = names.get(part.get('id'), 'PDF part')
            if len(staff_ids) > 1:
                location = ('Upper staff' if staff == staff_ids[0] else 'Lower staff') if len(staff_ids) == 2 else 'Staff ' + staff
                label = location if label in {'Piano', 'Voice', 'PDF part'} else label + ' · ' + location.lower()
            staff_events[staff] = [(0, -2, meta(3, label.encode('utf-8'))),
                                   (0, -1, bytes([192 | channel, 0])),
                                   (0, -1, meta(1, b'Aroha:pdf-pitch=written'))]
        divisions, numerator, denominator = 1, 4, 4
        start, ties = Fraction(0), {}
        for measure in part.findall('measure'):
            cursor, extent, previous_note = Fraction(0), Fraction(0), Fraction(0)
            for item in measure:
                if item.tag == 'attributes':
                    divisions = int(item.findtext('divisions', str(divisions)))
                    if divisions <= 0:
                        raise ValueError('The recognized score contains invalid note durations.')
                    for clef in item.findall('clef'):
                        staff = clef.get('number', '1')
                        if staff in staff_events:
                            mode = 'concert' if int(clef.findtext('clef-octave-change', '0')) else 'written'
                            staff_events[staff].append((start + cursor, 0, meta(1, ('Aroha:pdf-pitch=' + mode).encode())))
                    time = item.find('time')
                    if time is not None:
                        numerator = sum(int(n) for n in time.findtext('beats', '4').split('+'))
                        denominator = int(time.findtext('beat-type', '4'))
                        if numerator < 1 or numerator > 32 or denominator not in (1, 2, 4, 8, 16, 32):
                            raise ValueError('The recognized score has an unsupported meter.')
                        if index == 0:
                            conductor.append((start, 1, meta(88, bytes([numerator, int(math.log2(denominator)), 24, 8]))))
                elif item.tag in ('backup', 'forward'):
                    shift = Fraction(int(item.findtext('duration', '0')) * PPQ, divisions)
                    cursor += shift * (-1 if item.tag == 'backup' else 1)
                    if cursor < 0:
                        raise ValueError('The recognized voices have inconsistent timing.')
                    extent = max(extent, cursor)
                elif item.tag == 'direction' and index == 0:
                    sound = item.find('sound')
                    tempo = sound.get('tempo') if sound is not None else None
                    if tempo:
                        bpm = float(tempo)
                        if not math.isfinite(bpm) or not 4 <= bpm <= 1000:
                            raise ValueError('The recognized tempo is outside the supported range.')
                        offset = Fraction(int(item.findtext('offset', '0')) * PPQ, divisions)
                        conductor.append((max(0, start + cursor + offset), 1, meta(81, round(60000000 / bpm).to_bytes(3, 'big'))))
                elif item.tag == 'note':
                    if item.find('grace') is not None:
                        continue
                    duration = Fraction(int(item.findtext('duration', '0')) * PPQ, divisions)
                    if duration <= 0:
                        raise ValueError('A recognized note has no duration. Try a clearer score.')
                    chord = item.find('chord') is not None
                    onset = previous_note if chord else cursor
                    pitch = item.find('pitch')
                    if pitch is not None:
                        staff = item.findtext('staff', '1')
                        channel, events = channels[staff], staff_events[staff]
                        step = pitch.findtext('step')
                        if step is None or len(step) != 1 or step not in 'CDEFGAB':
                            raise ValueError('Recognition produced an invalid pitch.')
                        midi = 12 * (int(pitch.findtext('octave')) + 1) + dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11)[step] + int(pitch.findtext('alter', '0'))
                        if not 0 <= midi <= 127:
                            raise ValueError('A recognized pitch is outside the MIDI range.')
                        key = (item.findtext('voice', '1'), item.findtext('staff', '1'), midi)
                        kinds = {tie.get('type') for tie in item.findall('tie')}
                        begin, end = start + onset, start + onset + duration
                        if 'stop' in kinds and key in ties and ties[key][1] == begin:
                            begin = ties.pop(key)[0]
                        elif key in ties:
                            a, b = ties.pop(key)
                            events.extend([(a, 3, bytes([144 | channel, midi, 80])), (b, 2, bytes([128 | channel, midi, 0]))])
                        if 'start' in kinds:
                            ties[key] = (begin, end)
                        else:
                            events.extend([(begin, 3, bytes([144 | channel, midi, 80])), (end, 2, bytes([128 | channel, midi, 0]))])
                        total += 1
                    if not chord:
                        previous_note = cursor
                        cursor += duration
                    extent = max(extent, onset + duration, cursor)
            length = Fraction(PPQ * numerator * 4, denominator)
            start += extent if measure.get('implicit') == 'yes' else max(extent, length)
        for (_, staff, midi), (a, b) in ties.items():
            channel, events = channels[staff], staff_events[staff]
            events.extend([(a, 3, bytes([144 | channel, midi, 80])), (b, 2, bytes([128 | channel, midi, 0]))])
        tracks.extend(track(events, start) for events in staff_events.values())
    if not total:
        raise ValueError('No pitched notes were found. Try a clear printed music score.')
    return b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks) + 1, PPQ) + track(conductor) + b''.join(tracks)
