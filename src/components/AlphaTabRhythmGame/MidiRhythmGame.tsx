import React, { useCallback, useRef, useEffect } from "react";
import * as alphaTab from "@coderline/alphatab";
import { useMidiInput, MidiInputEvent } from "./useMidiInput";
import { TIMING_WINDOWS, type HitResult, type RhythmGameScore } from "./useRhythmGameScore";
import {
  addSuccessMarkersForMatchedNotes,
  getMidiNoteNumber,
  getWrongNotePosition,
} from "./circle-marker-helpers";
import { calculateTimingFeedback } from "./rhythm-game-helpers";
import { useMidiMapping } from "./midi-mapping-context";

interface MidiRhythmGameProps {
  api: alphaTab.AlphaTabApi | null;
  isPlaying: boolean;
  currentTick: number;
  onAddCircleMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
    startTick?: number,
  ) => void;
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
    startTick?: number,
  ) => void;
  onClearMarkers: () => void;
  recordHit: (result: HitResult) => void;
  resetScore: () => void;
  getScore: () => RhythmGameScore;
}

/**
 * MIDI Rhythm Game Integration
 * PERFORMANCE OPTIMIZED for minimal latency
 *
 * Listens to MIDI inputs and processes them for rhythm game scoring
 * - Detects timing accuracy (Perfect: ±50ms, Good: ±300ms)
 * - Adds visual markers (circles for hits, crosses for misses)
 * - Tracks score statistics
 *
 * Performance optimizations:
 * - Uses refs for frequently changing values (currentTick, isPlaying)
 * - Stable MIDI callback with no dependency changes
 * - Minimal console logging (dev only)
 * - No state updates in hot path
 */
export const MidiRhythmGame = React.memo(function MidiRhythmGame({
  api,
  isPlaying,
  currentTick,
  onAddCircleMarker,
  onAddCrossMarker,
  onClearMarkers,
  recordHit,
  resetScore,
  getScore,
}: MidiRhythmGameProps) {
  const { getMapping, isErrorIgnored, isNotationNoteSkipped } =
    useMidiMapping();

  // Use refs for values that change frequently to avoid recreating callbacks
  const apiRef = useRef(api);
  const isPlayingRef = useRef(isPlaying);
  const currentTickRef = useRef(currentTick);
  const onAddCircleMarkerRef = useRef(onAddCircleMarker);
  const onAddCrossMarkerRef = useRef(onAddCrossMarker);
  const prevTickRef = useRef(currentTick);
  const getMappingRef = useRef(getMapping);
  const isErrorIgnoredRef = useRef(isErrorIgnored);
  const isNotationNoteSkippedRef = useRef(isNotationNoteSkipped);

  // Update refs when props change (no re-render of MIDI handler)
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Detect loop reset: tick jumps backward while isLooping is enabled
  useEffect(() => {
    const prevTick = prevTickRef.current;
    prevTickRef.current = currentTick;

    // A significant backward tick jump during playback + looping = loop reset
    // Threshold of 960 ticks (one quarter note) avoids false positives from jitter
    if (
      isPlaying &&
      apiRef.current?.isLooping &&
      currentTick < prevTick - 960
    ) {
      if (process.env.NODE_ENV === "development") {
        console.log("🔄 Loop detected — clearing markers, keeping score", {
          prevTick,
          currentTick,
          score: getScore(),
        });
      }
      onClearMarkers();
    }
  }, [currentTick, isPlaying, onClearMarkers, getScore]);

  useEffect(() => {
    currentTickRef.current = currentTick;
  }, [currentTick]);

  useEffect(() => {
    onAddCircleMarkerRef.current = onAddCircleMarker;
  }, [onAddCircleMarker]);

  useEffect(() => {
    onAddCrossMarkerRef.current = onAddCrossMarker;
  }, [onAddCrossMarker]);

  useEffect(() => {
    getMappingRef.current = getMapping;
  }, [getMapping]);

  useEffect(() => {
    isErrorIgnoredRef.current = isErrorIgnored;
  }, [isErrorIgnored]);

  useEffect(() => {
    isNotationNoteSkippedRef.current = isNotationNoteSkipped;
  }, [isNotationNoteSkipped]);

  // Stable MIDI handler with ZERO dependencies - critical for performance
  const handleMidiMessage = useCallback(
    (event: MidiInputEvent) => {
      // console.log("midimessage", event);
      // Only process note-on events during playback
      if (event.type !== "noteOn") {
        // if (event.type !== "noteOn" || !isPlayingRef.current || !apiRef.current) {
        return;
      }

      const api = apiRef.current;
      const currentTick = currentTickRef.current;

      if (process.env.NODE_ENV === "development") {
        console.log("🎹 MIDI Input received:", {
          note: event.midiNote,
          velocity: event.velocity,
          portName: event.portName,
        });
      }

      // Apply MIDI mapping: resolve mapped notes to target notes
      const mapping = getMappingRef.current();
      let notesToMatch: Array<{ midiNote: number }>;

      if (mapping && mapping.entries.length > 0) {
        // Find all target notes that this MIDI note maps to
        const targetNotes = mapping.entries
          .filter((entry) => entry.mappedNotes.includes(event.midiNote))
          .map((entry) => entry.targetNote);

        if (process.env.NODE_ENV === "development" && targetNotes.length > 0) {
          console.log("🔀 MIDI Mapping applied:", {
            inputNote: event.midiNote,
            targetNotes,
          });
        }

        // Use target notes if mapping found, otherwise fall back to original note
        notesToMatch =
          targetNotes.length > 0
            ? targetNotes.map((n) => ({ midiNote: n }))
            : [{ midiNote: event.midiNote }];
      } else {
        // No mapping configured, use original MIDI note
        notesToMatch = [{ midiNote: event.midiNote }];
      }

      // Calculate timing feedback
      const feedback = calculateTimingFeedback(api, currentTick);

      if (!feedback) {
        if (process.env.NODE_ENV === "development") {
          console.log("❌ No beat found at current position");
        }
        recordHit("error");
        return;
      }

      // Check timing window - use absolute value for speed
      const timingOffsetMs = Math.abs(feedback.timingOffset * 1000);

      let timingResult: "perfect" | "good" | "missed";
      if (timingOffsetMs <= TIMING_WINDOWS.PERFECT) {
        timingResult = "perfect";
      } else if (timingOffsetMs <= TIMING_WINDOWS.GOOD) {
        timingResult = "good";
      } else {
        timingResult = "missed";
      }

      // Use the existing helper to match notes (circles only — crosses handled below)
      const result = addSuccessMarkersForMatchedNotes(
        api,
        currentTick,
        notesToMatch,
        onAddCircleMarkerRef.current,
      );

      // Check if the note was matched
      if (result.matchedNotes.length > 0) {
        // Correct note hit
        recordHit(timingResult);

        if (process.env.NODE_ENV === "development") {
          console.log("✅ Correct hit!", {
            timing: timingResult,
            timingOffset: `${timingOffsetMs.toFixed(1)}ms`,
            note: event.midiNote,
            matched: result.matchedNotes.map((n) => ({
              string: n.string,
              fret: n.fret,
              midiNote: getMidiNoteNumber(n),
            })),
          });
        }
      } else if (result.wrongInputs.length > 0) {
        // Check if errors should be ignored for this MIDI note (extra hit ignore)
        const shouldIgnoreError = isErrorIgnoredRef.current(event.midiNote);

        // Check if ALL expected notes in this beat are in the skip list.
        // If so, this beat is being practiced selectively and wrong inputs here
        // should not be penalised (the player is focusing on other parts).
        const allExpectedNotesSkipped =
          feedback.beat.notes.length > 0 &&
          feedback.beat.notes.every((n) =>
            isNotationNoteSkippedRef.current(getMidiNoteNumber(n)),
          );

        if (!shouldIgnoreError && !allExpectedNotesSkipped) {
          // Wrong note — add a cross marker for EACH wrong input.
          // Resolve the correct staff line and beat bounds for the MIDI note hit.
          const wrongPos = getWrongNotePosition(
            api,
            currentTick,
            event.midiNote,
          );

          result.wrongInputs.forEach(() => {
            onAddCrossMarkerRef.current(
              wrongPos?.beatBounds ?? feedback.beatBounds,
              wrongPos?.staffLineIndex ?? 2,
              wrongPos?.timingOffset ?? feedback.timingOffset,
              wrongPos?.nextBeatBounds ?? feedback.nextBeatBounds,
              undefined, // no specific note → cross won't be deduped
              wrongPos?.startTick ?? feedback.startTick,
            );
          });
          recordHit("error");
          if (process.env.NODE_ENV === "development") {
            console.log("❌ Wrong note!", {
              inputNote: event.midiNote,
              staffLineIndex: wrongPos?.staffLineIndex ?? 2,
              expectedNotes: feedback.beat.notes.map((n) =>
                getMidiNoteNumber(n),
              ),
            });
          }
        } else {
          // Error ignored: either extra-hit ignore or notation-skip practice mode
          if (process.env.NODE_ENV === "development") {
            console.log(
              allExpectedNotesSkipped
                ? "⏭️ Beat skipped (practice focus mode)"
                : "⏸️ Error ignored for MIDI note",
              { inputNote: event.midiNote },
            );
          }
        }
      }
    },
    [recordHit],
  ); // Only recordHit dependency - stable function

  // Initialize MIDI input hook
  const { isSupported, isConnected, inputs, error } = useMidiInput(
    handleMidiMessage,
    true, // Always enabled
  );

  // Log MIDI status (once on mount/change)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("🎮 MIDI Rhythm Game Status:", {
        supported: isSupported,
        connected: isConnected,
        devices: inputs.length,
        inputs: inputs.map((i) => i.name),
      });
    }
  }, [isSupported, isConnected, inputs]);

  // Log score changes periodically (throttled to avoid spam)
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      const score = getScore();
      if (score.totalNotes > 0 || score.errors > 0) {
        if (process.env.NODE_ENV === "development") {
          console.log("📊 Current Score:", {
            accuracy: `${score.accuracy}%`,
            perfect: score.perfect,
            good: score.good,
            missed: score.missed,
            errors: score.errors,
            streak: score.streak,
            maxStreak: score.maxStreak,
            total: score.totalNotes,
          });
        }
      }
    }, 2000); // Log every 2 seconds instead of on every hit

    return () => clearInterval(interval);
  }, [isPlaying, getScore]);

  // Log final score when playback stops, reset score when playback starts
  useEffect(() => {
    if (isPlaying) {
      // Reset score at the start of each playback session
      resetScore();
    } else {
      const score = getScore();
      if (score.totalNotes > 0) {
        if (process.env.NODE_ENV === "development") {
          console.log("🏁 Final Score:", {
            accuracy: `${score.accuracy}%`,
            perfect: score.perfect,
            good: score.good,
            missed: score.missed,
            errors: score.errors,
            maxStreak: score.maxStreak,
            total: score.totalNotes,
          });
        }
      }
    }
  }, [isPlaying, getScore, resetScore]);

  // Display MIDI status (for debugging)
  if (!isSupported && process.env.NODE_ENV === "development") {
    console.warn("⚠️ Web MIDI API not supported in this browser");
  }

  if (error && process.env.NODE_ENV === "development") {
    console.error("❌ MIDI Error:", error);
  }

  // This component doesn't render anything - it's just for logic
  return null;
});
