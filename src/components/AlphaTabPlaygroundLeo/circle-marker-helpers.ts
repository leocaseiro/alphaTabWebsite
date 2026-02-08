/**
 * Circle Marker Helpers for Rhythm Game Success Feedback
 */

import * as alphaTab from "@coderline/alphatab";

/**
 * Add circle markers only for the notes that the player hit correctly
 * Compares player input against expected notes in the current beat
 */
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
  ) => void,
  onAddCrossMarker?: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
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

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) {
    return result;
  }

  const beat = beatResult.beat;
  const beatBounds = api.boundsLookup.findBeat(beat);

  if (!beatBounds) {
    return result;
  }

  // Calculate timing offset
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

  // Check each expected note in the beat
  beat.notes.forEach((expectedNote) => {
    // Match by MIDI note number (realValue) - works for drums and piano
    const matched = playerInputs.some(
      (input) => input.midiNote === expectedNote.realValue,
    );

    if (matched) {
      // Player hit this note correctly - add circle
      result.matchedNotes.push(expectedNote);
      const staffLine = expectedNote.string - 1;
      onAddCircleMarker(
        beatBounds,
        staffLine,
        timingOffset,
        nextBeatBounds,
        expectedNote,
      );
    } else {
      // Player missed this note - add cross if handler provided
      result.missedNotes.push(expectedNote);
      if (onAddCrossMarker) {
        const staffLine = expectedNote.string - 1;
        onAddCrossMarker(beatBounds, staffLine, timingOffset, nextBeatBounds);
      }
    }
  });

  // Check for wrong inputs (player hit MIDI notes that weren't expected)
  playerInputs.forEach((input) => {
    const isExpected = beat.notes.some(
      (note) => input.midiNote === note.realValue,
    );

    if (!isExpected) {
      result.wrongInputs.push(input);
      // For wrong inputs, we could optionally add crosses, but we'd need to know
      // which staff line to draw on. For now, just track the wrong input.
      // TODO: Map MIDI note to staff line for visual feedback
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
  ) => void,
): boolean {
  if (!api.tickCache || !api.boundsLookup) {
    return false;
  }

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) {
    return false;
  }

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) {
    return false;
  }

  const beat = beatResult.beat;
  const beatBounds = api.boundsLookup.findBeat(beat);

  if (!beatBounds) {
    return false;
  }

  // Calculate timing offset
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

  // Check if any notes exist
  if (beat.notes.length === 0) {
    return false;
  }

  // Add circle for each note being played
  beat.notes.forEach((note) => {
    const staffLine = note.string - 1; // String to staff line index
    onAddCircleMarker(
      beatBounds,
      staffLine,
      timingOffset,
      nextBeatBounds,
      note,
    );
  });

  return true;
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

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) {
    return { isMatch: false };
  }

  const beat = beatResult.beat;

  // Check if any note matches the player's MIDI input
  const matchedNote = beat.notes.find(
    (note) => note.realValue === playerInput.midiNote,
  );

  return {
    isMatch: !!matchedNote,
    beat,
    matchedNote,
  };
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
  ) => void,
): boolean {
  if (!api.boundsLookup) {
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

  // Calculate timing offset
  const beatResult = api.tickCache!.findBeat(
    new Set(api.tracks.map((t) => t.index)),
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
  const staffLine = matchResult.matchedNote.string - 1;
  onAddCircleMarker(
    beatBounds,
    staffLine,
    timingOffset,
    nextBeatBounds,
    matchResult.matchedNote,
  );

  return true;
}
