/**
 * Examples showing how to use cross markers on specific tracks, strings, and positions
 */

import * as alphaTab from "@coderline/alphatab";

/**
 * Example 1: Add marker to a specific track by name
 * This will only add markers when playing beats from the specified track
 */
export function addMarkerToSpecificTrack(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  trackName: string,
  staffLine: number,
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
  ) => void,
) {
  if (!api.tickCache || !api.boundsLookup) return;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return;

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) return;

  const beat = beatResult.beat;
  const currentTrackName = beat.voice.bar.staff.track.name;

  // Only add marker if we're on the specified track
  if (currentTrackName === trackName) {
    const beatBounds = api.boundsLookup.findBeat(beat);
    if (beatBounds) {
      onAddCrossMarker(beatBounds, staffLine);
    }
  }
}

/**
 * Example 2: Add marker to a specific track by index
 * Track index is 0-based (0 = first track, 1 = second track, etc.)
 */
export function addMarkerToTrackByIndex(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  trackIndex: number,
  staffLine: number,
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
  ) => void,
) {
  if (!api.tickCache || !api.boundsLookup) return;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return;

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) return;

  const beat = beatResult.beat;
  const currentTrackIndex = beat.voice.bar.staff.track.index;

  // Only add marker if we're on the specified track
  if (currentTrackIndex === trackIndex) {
    const beatBounds = api.boundsLookup.findBeat(beat);
    if (beatBounds) {
      onAddCrossMarker(beatBounds, staffLine);
    }
  }
}

/**
 * Example 3: Add marker on specific guitar string
 * For guitar tabs: string 1 = high E, string 6 = low E
 * This maps the guitar string to the appropriate staff line
 */
export function addMarkerOnGuitarString(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  targetString: number, // 1-6 for standard guitar
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
  ) => void,
) {
  if (!api.tickCache || !api.boundsLookup) return;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return;

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) return;

  const beat = beatResult.beat;
  const beatBounds = api.boundsLookup.findBeat(beat);

  if (!beatBounds) return;

  // For guitar tabs, the staff line corresponds to the string
  // String 1 (high E) = line 0 (top)
  // String 6 (low E) = line 5 (bottom)
  const staffLine = targetString - 1;
  onAddCrossMarker(beatBounds, staffLine);
}

/**
 * Example 4: Add marker only when a specific note is played
 * This checks if any note in the current beat matches the target note
 */
export function addMarkerOnSpecificNote(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  targetFret: number,
  targetString: number,
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
  ) => void,
) {
  if (!api.tickCache || !api.boundsLookup) return;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return;

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) return;

  const beat = beatResult.beat;

  // Check if any note matches our target
  const hasTargetNote = beat.notes.some(
    (note) => note.fret === targetFret && note.string === targetString,
  );

  if (hasTargetNote) {
    const beatBounds = api.boundsLookup.findBeat(beat);
    if (beatBounds) {
      // Place marker on the string where the note is played
      const staffLine = targetString - 1;
      onAddCrossMarker(beatBounds, staffLine);
    }
  }
}

/**
 * Example 5: Add markers to all notes in the current beat
 * This places a cross on each string that has a note being played
 */
export function addMarkersToAllNotesInBeat(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
  ) => void,
) {
  if (!api.tickCache || !api.boundsLookup) return;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return;

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) return;

  const beat = beatResult.beat;
  const beatBounds = api.boundsLookup.findBeat(beat);

  if (!beatBounds) return;

  // Add a marker for each note in the beat
  beat.notes.forEach((note) => {
    // For guitar tabs, map string to staff line
    const staffLine = note.string - 1;
    onAddCrossMarker(beatBounds, staffLine);
  });
}

/**
 * Example 6: SIMPLE - Always mark the 3rd string (G string on guitar)
 * This is the simplest example - just marks a specific position every time
 */
export function alwaysMarkThirdString(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
  ) => void,
) {
  if (!api.tickCache || !api.boundsLookup) return;

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) return;

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) return;

  const beat = beatResult.beat;
  const beatBounds = api.boundsLookup.findBeat(beat);

  if (!beatBounds) return;

  // Always mark the 3rd string (index 2)
  // For 6-string guitar: 0=high E, 1=B, 2=G, 3=D, 4=A, 5=low E
  onAddCrossMarker(beatBounds, 2);
}

/**
 * Helper: Get staff line index for standard notation based on MIDI note value
 * This converts MIDI notes to staff positions for standard notation
 */
export function midiNoteToStaffLine(midiValue: number): number {
  // Middle C (MIDI 60) is typically on line 5 (just below the staff in treble clef)
  // Each staff line/space represents one note step
  // This is a simplified version - actual mapping depends on clef
  const middleC = 60;
  const stepsFromMiddleC = midiValue - middleC;
  // Divide by 2 because staff lines are whole steps apart in C major
  const staffLine = 9 - Math.floor(stepsFromMiddleC / 2);
  return Math.max(0, Math.min(20, staffLine)); // Clamp to reasonable range
}
