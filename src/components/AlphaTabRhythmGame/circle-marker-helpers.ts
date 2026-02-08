/**
 * Circle Marker Helpers for Rhythm Game Success Feedback
 */

import * as alphaTab from "@coderline/alphatab";

/**
 * Get the actual MIDI note number for a note.
 *
 * For percussion, `note.realValue` returns the `percussionArticulation` index
 * (e.g. 5), NOT the MIDI note (e.g. 38). The real MIDI number is stored on
 * `track.percussionArticulations[index].outputMidiNumber`.
 *
 * For regular instruments (guitar, piano), `note.realValue` already IS the
 * correct MIDI note number.
 */
export function getMidiNoteNumber(note: alphaTab.model.Note): number {
  if (note.isPercussion) {
    const track = note.beat.voice.bar.staff.track;
    const articulation =
      track.percussionArticulations[note.percussionArticulation];
    if (articulation) {
      return articulation.outputMidiNumber;
    }
  }
  return note.realValue;
}

/**
 * Derive the correct staffLineIndex for a note from its rendered noteHeadBounds.
 * This is needed for percussion where note.string is -1 (not a guitar string).
 * Reverses the formula: y = staffTopY + staffLineIndex * lineSpacing + lineSpacing / 2
 */
function getStaffLineIndex(
  note: alphaTab.model.Note,
  beatBounds: alphaTab.rendering.BeatBounds,
  scale: number,
): number {
  // Try to derive from noteHeadBounds (works for all instrument types)
  if (beatBounds.notes && beatBounds.notes.length > 0) {
    const noteBounds = beatBounds.notes.find((nb) => nb.note === note);
    if (noteBounds && noteBounds.noteHeadBounds) {
      const lineSpacing = 8 * scale;
      const staffTopY = beatBounds.barBounds.visualBounds.y;
      const noteY =
        noteBounds.noteHeadBounds.y + noteBounds.noteHeadBounds.h / 2;
      return Math.round(
        (noteY - staffTopY - lineSpacing / 2) / lineSpacing,
      );
    }
  }

  // Fallback for non-percussion (guitar/piano)
  return Math.max(0, note.string - 1);
}

/**
 * Compute the staffLineIndex for an arbitrary MIDI note that may not be in the
 * current score (used for wrong-input cross markers).
 *
 * For percussion: looks up the InstrumentArticulation by outputMidiNumber and
 * uses its staffLine property. If there is a rendered note on the same beat we
 * calibrate against it for pixel-perfect accuracy; otherwise we use the
 * approximation staffLineIndex ≈ (staffLine + 1) / 2.
 *
 * Returns the staffLineIndex AND the correct beatBounds/timing for the
 * matching track (so the cross is drawn on the right staff in multi-track
 * scores).
 */
export function getWrongNotePosition(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  midiNote: number,
): {
  beatBounds: alphaTab.rendering.BeatBounds;
  staffLineIndex: number;
  startTick: number;
  timingOffset: number;
  nextBeatBounds?: alphaTab.rendering.BeatBounds;
} | null {
  if (!api.tickCache || !api.boundsLookup) return null;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return null;

  const scale = api.settings.display.scale;
  const lineSpacing = 8 * scale;

  for (const track of tracks) {
    const isPercussion = track.staves.some((s) => s.isPercussion);

    if (isPercussion) {
      // Find the articulation whose outputMidiNumber matches the player's MIDI input
      const articulation = track.percussionArticulations.find(
        (a) => a.outputMidiNumber === midiNote,
      );
      if (!articulation) continue;

      // Get beat bounds for THIS track at the current tick
      const beatResult = api.tickCache.findBeat(
        new Set([track.index]),
        currentTick,
      );
      if (!beatResult) continue;

      const beatBounds = api.boundsLookup.findBeat(beatResult.beat);
      if (!beatBounds) continue;

      const startTick = beatResult.start;
      const beatDuration = beatResult.end - startTick;
      const timingOffset =
        beatDuration > 0 ? (currentTick - startTick) / beatDuration : 0;

      let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
      if (beatResult.nextBeat) {
        nextBeatBounds =
          api.boundsLookup.findBeat(beatResult.nextBeat.beat) ?? undefined;
      }

      // Compute staffLineIndex for the wrong note.
      // Try to calibrate using any existing rendered note on the same beat.
      const wrongStaffLine = articulation.staffLine;
      let staffLineIndex: number | null = null;

      if (beatBounds.notes && beatBounds.notes.length > 0) {
        for (const nb of beatBounds.notes) {
          if (nb.noteHeadBounds && nb.note.isPercussion) {
            const refArt =
              track.percussionArticulations[nb.note.percussionArticulation];
            if (refArt) {
              // We know refArt.staffLine → refStaffLineIndex from rendered coords
              const staffTopY = beatBounds.barBounds.visualBounds.y;
              const refNoteY =
                nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2;
              const refStaffLineIndex =
                (refNoteY - staffTopY - lineSpacing / 2) / lineSpacing;

              // Offset from the reference note
              staffLineIndex =
                refStaffLineIndex +
                (wrongStaffLine - refArt.staffLine) / 2;
              break;
            }
          }
        }
      }

      // Fallback: approximate formula
      if (staffLineIndex === null) {
        staffLineIndex = (wrongStaffLine + 1) / 2;
      }

      return {
        beatBounds,
        staffLineIndex: Math.round(staffLineIndex * 2) / 2, // snap to half-lines
        startTick,
        timingOffset,
        nextBeatBounds,
      };
    }
    // Non-percussion: for now use middle of staff; can be refined for piano later
  }

  return null;
}

/**
 * Add circle markers for notes that match player input (drums/piano rhythm game)
 * Uses MIDI note numbers for matching (works for both drums and piano)
 */
export function addSuccessMarkersForMatchedNotes(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  playerInputs: Array<{ midiNote: number }>, // What the player actually played (MIDI note numbers)
  onAddCircleMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
    startTick?: number,
  ) => void,
): {
  matchedNotes: alphaTab.model.Note[];
  missedNotes: alphaTab.model.Note[];
  wrongInputs: Array<{ midiNote: number }>;
} {
  const result = {
    matchedNotes: [] as alphaTab.model.Note[],
    missedNotes: [] as alphaTab.model.Note[],
    wrongInputs: [] as Array<{ midiNote: number }>,
  };

  if (!api.tickCache || !api.boundsLookup) {
    return result;
  }

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) {
    return result;
  }

  const scale = api.settings.display.scale;

  // Collect all notes from all tracks at the current tick.
  // findBeat only returns the FIRST visible beat, so for multi-track scores
  // (e.g. guitar + drums) we must search each track individually to find
  // notes from ALL tracks at this position.
  const allExpectedNotes: Array<{
    note: alphaTab.model.Note;
    beatBounds: alphaTab.rendering.BeatBounds;
    timingOffset: number;
    nextBeatBounds?: alphaTab.rendering.BeatBounds;
    beatStartTick: number;
  }> = [];

  for (const track of tracks) {
    const beatResult = api.tickCache.findBeat(
      new Set([track.index]),
      currentTick,
    );
    if (!beatResult) continue;

    const beat = beatResult.beat;
    const beatBounds = api.boundsLookup.findBeat(beat);
    if (!beatBounds) continue;

    const beatStartTick = beatResult.start;
    const beatEndTick = beatResult.end;
    const beatDuration = beatEndTick - beatStartTick;
    const timingOffset =
      beatDuration > 0 ? (currentTick - beatStartTick) / beatDuration : 0;

    let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
    if (beatResult.nextBeat) {
      const nextBeat = beatResult.nextBeat.beat;
      nextBeatBounds = api.boundsLookup.findBeat(nextBeat) ?? undefined;
    }

    for (const note of beat.notes) {
      allExpectedNotes.push({
        note,
        beatBounds,
        timingOffset,
        nextBeatBounds,
        beatStartTick,
      });
    }
  }

  // Check each expected note against player inputs
  allExpectedNotes.forEach(
    ({ note: expectedNote, beatBounds, timingOffset, nextBeatBounds, beatStartTick }) => {
      const expectedMidi = getMidiNoteNumber(expectedNote);
      const matched = playerInputs.some(
        (input) => input.midiNote === expectedMidi,
      );

      const staffLine = getStaffLineIndex(expectedNote, beatBounds, scale);

      if (matched) {
        result.matchedNotes.push(expectedNote);
        onAddCircleMarker(
          beatBounds,
          staffLine,
          timingOffset,
          nextBeatBounds,
          expectedNote,
          beatStartTick,
        );
      } else {
        result.missedNotes.push(expectedNote);
        // Don't draw crosses for missed notes — crosses are only for wrong hits.
        // The caller (MidiRhythmGame) adds crosses for wrong inputs separately.
      }
    },
  );

  // Check for wrong inputs (player hit MIDI notes that weren't expected)
  playerInputs.forEach((input) => {
    const isExpected = allExpectedNotes.some(
      ({ note }) => input.midiNote === getMidiNoteNumber(note),
    );

    if (!isExpected) {
      result.wrongInputs.push(input);
    }
  });

  return result;
}

/**
 * TESTING HELPER: Add circle markers for all notes being played at the current tick
 * This marks ALL notes with circles (for testing - doesn't check player input)
 */
export function addSuccessMarkersForAllNotes(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  onAddCircleMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
    startTick?: number,
  ) => void,
): boolean {
  if (!api.tickCache || !api.boundsLookup) {
    return false;
  }

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) {
    return false;
  }

  const scale = api.settings.display.scale;
  let addedAny = false;

  // Search each track individually to cover all tracks
  for (const track of tracks) {
    const beatResult = api.tickCache.findBeat(
      new Set([track.index]),
      currentTick,
    );
    if (!beatResult) continue;

    const beat = beatResult.beat;
    const beatBounds = api.boundsLookup.findBeat(beat);
    if (!beatBounds) continue;
    if (beat.notes.length === 0) continue;

    const beatStartTick = beatResult.start;
    const beatEndTick = beatResult.end;
    const beatDuration = beatEndTick - beatStartTick;
    const timingOffset =
      beatDuration > 0 ? (currentTick - beatStartTick) / beatDuration : 0;

    let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
    if (beatResult.nextBeat) {
      const nextBeat = beatResult.nextBeat.beat;
      nextBeatBounds = api.boundsLookup.findBeat(nextBeat) ?? undefined;
    }

    beat.notes.forEach((note) => {
      const staffLine = getStaffLineIndex(note, beatBounds, scale);
      onAddCircleMarker(
        beatBounds,
        staffLine,
        timingOffset,
        nextBeatBounds,
        note,
        beatStartTick,
      );
    });
    addedAny = true;
  }

  return addedAny;
}

/**
 * Check if player hit the correct note by MIDI number
 * Returns true if the player's MIDI input matches any note being played
 */
export function checkNoteMatch(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  playerInput: {
    midiNote: number; // MIDI note number (e.g., 42 for closed hi-hat, 60 for middle C)
  },
): {
  isMatch: boolean;
  beat?: alphaTab.model.Beat;
  matchedNote?: alphaTab.model.Note;
} {
  if (!api.tickCache) {
    return { isMatch: false };
  }

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) {
    return { isMatch: false };
  }

  // Search each track individually (findBeat only returns the first visible beat)
  for (const track of tracks) {
    const beatResult = api.tickCache.findBeat(
      new Set([track.index]),
      currentTick,
    );
    if (!beatResult) continue;

    const beat = beatResult.beat;
    const matchedNote = beat.notes.find(
      (note) => getMidiNoteNumber(note) === playerInput.midiNote,
    );

    if (matchedNote) {
      return { isMatch: true, beat, matchedNote };
    }
  }

  return { isMatch: false };
}

/**
 * Add circle marker for a specific MIDI note if it matches the current beat
 * Used when player presses a key (piano) or drum pad
 */
export function addSuccessMarkerForNote(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  playerInput: {
    midiNote: number; // MIDI note number
  },
  onAddCircleMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
    startTick?: number,
  ) => void,
): boolean {
  if (!api.boundsLookup || !api.tickCache) {
    return false;
  }

  const matchResult = checkNoteMatch(api, currentTick, playerInput);

  if (!matchResult.isMatch || !matchResult.beat || !matchResult.matchedNote) {
    return false;
  }

  const beatBounds = api.boundsLookup.findBeat(matchResult.beat);
  if (!beatBounds) {
    return false;
  }

  // Find the beat result for the matched note's track to get accurate timing
  const trackIndex = matchResult.beat.voice.bar.staff.track.index;
  const beatResult = api.tickCache.findBeat(
    new Set([trackIndex]),
    currentTick,
  );

  if (!beatResult) {
    return false;
  }

  const beatStartTick = beatResult.start;
  const beatEndTick = beatResult.end;
  const beatDuration = beatEndTick - beatStartTick;
  const timingOffset =
    beatDuration > 0 ? (currentTick - beatStartTick) / beatDuration : 0;

  // Get next beat for interpolation
  let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
  if (beatResult.nextBeat) {
    const nextBeat = beatResult.nextBeat.beat;
    nextBeatBounds = api.boundsLookup.findBeat(nextBeat) ?? undefined;
  }

  // Add circle at the matched note's position
  const scale = api.settings.display.scale;
  const staffLine = getStaffLineIndex(matchResult.matchedNote, beatBounds, scale);
  onAddCircleMarker(
    beatBounds,
    staffLine,
    timingOffset,
    nextBeatBounds,
    matchResult.matchedNote,
    beatStartTick,
  );

  return true;
}
