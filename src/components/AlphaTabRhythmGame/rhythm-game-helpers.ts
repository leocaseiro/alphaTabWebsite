/**
 * Rhythm Game Helpers
 * Functions for detecting precise timing and providing feedback for rhythm games
 */

import * as alphaTab from "@coderline/alphatab";

export interface TimingFeedback {
  timing: "Perfect" | "Good" | "Early" | "Late" | "Miss";
  timingOffset: number; // 0.0 = perfect, -0.5 = very early, 0.5 = very late
  isOnBeat: boolean;
  beat: alphaTab.model.Beat;
  beatBounds: alphaTab.rendering.BeatBounds;
  nextBeatBounds?: alphaTab.rendering.BeatBounds;
}

export interface TimingWindow {
  perfect: number; // e.g., 0.1 = within 10% of beat duration
  good: number; // e.g., 0.25 = within 25% of beat duration
  acceptable: number; // e.g., 0.4 = within 40% of beat duration
}

/**
 * Default timing windows for rhythm game
 * Adjust these values based on your game difficulty
 */
export const DEFAULT_TIMING_WINDOWS: TimingWindow = {
  perfect: 0.1, // Within 10% of beat
  good: 0.25, // Within 25% of beat
  acceptable: 0.4, // Within 40% of beat
};

/**
 * Calculate precise timing feedback for a button press in a rhythm game
 * Returns detailed timing information and evaluation
 */
export function calculateTimingFeedback(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  timingWindows: TimingWindow = DEFAULT_TIMING_WINDOWS,
): TimingFeedback | null {
  if (!api.tickCache || !api.boundsLookup) {
    return null;
  }

  const tracks = api.tracks;
  if (!tracks || tracks.length === 0) {
    return null;
  }

  const trackIndexes = new Set(tracks.map((t) => t.index));
  const beatResult = api.tickCache.findBeat(trackIndexes, currentTick);

  if (!beatResult) {
    return null;
  }

  const beat = beatResult.beat;
  const beatBounds = api.boundsLookup.findBeat(beat);

  if (!beatBounds) {
    return null;
  }

  // Calculate timing offset
  const beatStartTick = beatResult.start;
  const beatEndTick = beatResult.end;
  const beatDuration = beatEndTick - beatStartTick;

  // Normalized offset: 0.0 = beat start, 0.5 = middle, 1.0 = beat end
  const normalizedOffset =
    beatDuration > 0 ? (currentTick - beatStartTick) / beatDuration : 0;

  // Convert to centered offset: 0.0 = perfect, negative = early, positive = late
  const centeredOffset = normalizedOffset - 0.0; // Changed from 0.5 to 0.0 for beat-start timing

  // Determine timing quality
  const absOffset = Math.abs(centeredOffset);
  let timing: "Perfect" | "Good" | "Early" | "Late" | "Miss";

  if (absOffset <= timingWindows.perfect) {
    timing = "Perfect";
  } else if (absOffset <= timingWindows.good) {
    timing = "Good";
  } else if (absOffset <= timingWindows.acceptable) {
    timing = centeredOffset < 0 ? "Early" : "Late";
  } else {
    timing = "Miss";
  }

  // Get next beat for interpolation
  let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
  if (beatResult.nextBeat) {
    const nextBeat = beatResult.nextBeat.beat;
    nextBeatBounds = api.boundsLookup.findBeat(nextBeat) ?? undefined;
  }

  return {
    timing,
    timingOffset: normalizedOffset,
    isOnBeat: absOffset <= timingWindows.perfect,
    beat,
    beatBounds,
    nextBeatBounds,
  };
}

/**
 * Add a marker with color based on timing accuracy
 * Perfect = Green, Good = Yellow, Early/Late = Orange, Miss = Red
 */
export function addTimingFeedbackMarker(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  staffLineIndex: number,
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
  ) => void,
  timingWindows?: TimingWindow,
): TimingFeedback | null {
  const feedback = calculateTimingFeedback(api, currentTick, timingWindows);

  if (!feedback) {
    return null;
  }

  // Add marker with timing offset for precise positioning
  onAddCrossMarker(
    feedback.beatBounds,
    staffLineIndex,
    feedback.timingOffset,
    feedback.nextBeatBounds,
  );

  return feedback;
}

/**
 * Check if a specific note is being played at the current tick
 * Useful for verifying if the player pressed the correct note
 */
export function isNotePlayingAtTick(
  beat: alphaTab.model.Beat,
  targetString: number,
  targetFret?: number, // Optional: also check fret
): boolean {
  return beat.notes.some((note) => {
    const stringMatches = note.string === targetString;
    const fretMatches = targetFret === undefined || note.fret === targetFret;
    return stringMatches && fretMatches;
  });
}

/**
 * Calculate score based on timing accuracy
 * Returns points (0-1000) based on timing quality
 */
export function calculateScore(timingFeedback: TimingFeedback): number {
  const scoring = {
    Perfect: 1000,
    Good: 750,
    Early: 500,
    Late: 500,
    Miss: 0,
  };

  return scoring[timingFeedback.timing];
}

/**
 * Comprehensive rhythm game input handler
 * Checks timing, correct note, and returns full feedback
 */
export interface RhythmGameInput {
  expectedString: number;
  expectedFret?: number;
}

export interface RhythmGameFeedback extends TimingFeedback {
  correctNote: boolean;
  score: number;
  message: string;
}

export function processRhythmGameInput(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  input: RhythmGameInput,
  timingWindows?: TimingWindow,
): RhythmGameFeedback | null {
  const feedback = calculateTimingFeedback(api, currentTick, timingWindows);

  if (!feedback) {
    return null;
  }

  // Check if correct note is being played
  const correctNote = isNotePlayingAtTick(
    feedback.beat,
    input.expectedString,
    input.expectedFret,
  );

  const score = correctNote ? calculateScore(feedback) : 0;

  let message: string;
  if (!correctNote) {
    message = "Wrong Note!";
  } else if (feedback.timing === "Perfect") {
    message = "Perfect! 🎯";
  } else if (feedback.timing === "Good") {
    message = "Good! ✓";
  } else if (feedback.timing === "Early") {
    message = "Too Early";
  } else if (feedback.timing === "Late") {
    message = "Too Late";
  } else {
    message = "Miss";
  }

  return {
    ...feedback,
    correctNote,
    score,
    message,
  };
}

/**
 * Get all notes that should be played at the current tick
 * Useful for detecting which notes the player should press
 */
export function getExpectedNotesAtTick(
  api: alphaTab.AlphaTabApi,
  currentTick: number,
  timingWindow: number = 0.1, // Within 10% of beat
): alphaTab.model.Note[] | null {
  const feedback = calculateTimingFeedback(api, currentTick, {
    perfect: timingWindow,
    good: timingWindow * 2,
    acceptable: timingWindow * 4,
  });

  if (!feedback || !feedback.isOnBeat) {
    return null;
  }

  return feedback.beat.notes;
}
