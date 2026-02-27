/**
 * Circle Marker Helpers for Rhythm Game Success Feedback
 */

import * as alphaTab from "@coderline/alphatab";

// ---------------------------------------------------------------------------
// Caches — shared across the rhythm game to avoid redundant lookups
// ---------------------------------------------------------------------------

/**
 * Holds pre-built lookup structures that are expensive to recreate on every
 * tick or MIDI hit.  Create once with `buildGameCaches` and invalidate parts
 * as needed (e.g. clear `staffLineIndex` on `renderFinished`).
 */
export interface GameCaches {
  /** midiNote → staffLineIndex (percussion: constant per MIDI note) */
  staffLineIndex: Map<number, number>;
  /** trackIndex → (outputMidiNumber → InstrumentArticulation) */
  articulationMaps: Map<
    number,
    Map<number, alphaTab.model.InstrumentArticulation>
  >;
  /** trackIndex → Set<number> (avoids allocating a new Set on every findBeat call) */
  trackIndexSets: Map<number, Set<number>>;
  /** Cached set of all visible track indexes (rebuilt by rebuildArticulationMaps) */
  allTrackIndexes: Set<number> | null;
}

/** Create an empty `GameCaches` instance. */
export function createGameCaches(): GameCaches {
  return {
    staffLineIndex: new Map(),
    articulationMaps: new Map(),
    trackIndexSets: new Map(),
    allTrackIndexes: null,
  };
}

/** (Re-)build the articulation lookup maps and allTrackIndexes for the current tracks. */
export function rebuildArticulationMaps(
  caches: GameCaches,
  tracks: alphaTab.model.Track[],
): void {
  caches.articulationMaps.clear();
  caches.allTrackIndexes = new Set(tracks.map((t) => t.index));
  for (const track of tracks) {
    if (!track.staves.some((s) => s.isPercussion)) continue;
    const map = new Map<number, alphaTab.model.InstrumentArticulation>();
    for (const art of track.percussionArticulations) {
      map.set(art.outputMidiNumber, art);
    }
    caches.articulationMaps.set(track.index, map);
  }
}

/** Return a cached `Set<number>` for a single track index. */
export function getTrackIndexSet(
  caches: GameCaches,
  trackIndex: number,
): Set<number> {
  let set = caches.trackIndexSets.get(trackIndex);
  if (!set) {
    set = new Set([trackIndex]);
    caches.trackIndexSets.set(trackIndex, set);
  }
  return set;
}

// ---------------------------------------------------------------------------
// MIDI note helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Staff-line position helpers
// ---------------------------------------------------------------------------

/**
 * Derive the correct staffLineIndex for a note from its rendered noteHeadBounds.
 * Results are cached per MIDI note in `caches.staffLineIndex` when provided;
 * for percussion the staff line is constant so the cache is always valid until
 * the score is re-rendered.
 */
export function getStaffLineIndex(
  note: alphaTab.model.Note,
  beatBounds: alphaTab.rendering.BeatBounds,
  scale: number,
  caches?: GameCaches,
): number {
  const midiNote = getMidiNoteNumber(note);

  if (caches) {
    const cached = caches.staffLineIndex.get(midiNote);
    if (cached !== undefined) return cached;
  }

  let result: number;

  if (beatBounds.notes && beatBounds.notes.length > 0) {
    const noteBounds = beatBounds.notes.find((nb) => nb.note === note);
    if (noteBounds && noteBounds.noteHeadBounds) {
      const lineSpacing = 8 * scale;
      const staffTopY = beatBounds.barBounds.visualBounds.y;
      const noteY =
        noteBounds.noteHeadBounds.y + noteBounds.noteHeadBounds.h / 2;
      result = Math.round(
        (noteY - staffTopY - lineSpacing / 2) / lineSpacing,
      );
    } else {
      result = Math.max(0, note.string - 1);
    }
  } else {
    result = Math.max(0, note.string - 1);
  }

  if (caches) {
    caches.staffLineIndex.set(midiNote, result);
  }

  return result;
}

/**
 * Compute the staffLineIndex for an arbitrary MIDI note that may not be in the
 * current score (used for wrong-input cross markers).
 *
 * For percussion: uses the cached articulation map (O(1) lookup) and cached
 * staff-line index when available.
 */
export function getWrongNotePosition(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  midiNote: number,
  caches?: GameCaches,
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
      // O(1) articulation lookup via cache, falling back to linear scan
      let articulation: alphaTab.model.InstrumentArticulation | undefined;
      const artMap = caches?.articulationMaps.get(track.index);
      if (artMap) {
        articulation = artMap.get(midiNote);
      } else {
        articulation = track.percussionArticulations.find(
          (a) => a.outputMidiNumber === midiNote,
        );
      }
      if (!articulation) continue;

      const trackSet = caches
        ? getTrackIndexSet(caches, track.index)
        : new Set([track.index]);
      const beatResult = api.tickCache.findBeat(trackSet, currentTick);
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

      // Check the staff-line cache first
      if (caches) {
        const cached = caches.staffLineIndex.get(midiNote);
        if (cached !== undefined) {
          return {
            beatBounds,
            staffLineIndex: cached,
            startTick,
            timingOffset,
            nextBeatBounds,
          };
        }
      }

      // Compute staffLineIndex — calibrate against a rendered reference note
      const wrongStaffLine = articulation.staffLine;
      let staffLineIndex: number | null = null;

      if (beatBounds.notes && beatBounds.notes.length > 0) {
        for (const nb of beatBounds.notes) {
          if (nb.noteHeadBounds && nb.note.isPercussion) {
            const refArt =
              track.percussionArticulations[nb.note.percussionArticulation];
            if (refArt) {
              const staffTopY = beatBounds.barBounds.visualBounds.y;
              const refNoteY =
                nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2;
              const refStaffLineIndex =
                (refNoteY - staffTopY - lineSpacing / 2) / lineSpacing;

              staffLineIndex =
                refStaffLineIndex +
                (wrongStaffLine - refArt.staffLine) / 2;
              break;
            }
          }
        }
      }

      if (staffLineIndex === null) {
        staffLineIndex = (wrongStaffLine + 1) / 2;
      }

      const snapped = Math.round(staffLineIndex * 2) / 2;

      if (caches) {
        caches.staffLineIndex.set(midiNote, snapped);
      }

      return {
        beatBounds,
        staffLineIndex: snapped,
        startTick,
        timingOffset,
        nextBeatBounds,
      };
    }
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
