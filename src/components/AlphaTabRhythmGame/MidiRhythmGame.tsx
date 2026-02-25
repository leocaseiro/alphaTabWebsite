import React, { useCallback, useRef, useEffect } from "react";
import * as alphaTab from "@coderline/alphatab";
import { useMidiInput, MidiInputEvent } from "./useMidiInput";
import {
  TIMING_WINDOWS,
  type HitResult,
  type RhythmGameScore,
} from "./useRhythmGameScore";
import {
  getMidiNoteNumber,
  getStaffLineIndex,
  getWrongNotePosition,
} from "./circle-marker-helpers";
import { useMidiMapping } from "./midi-mapping-context";

const ALPHATAB_PPQ = 960;

/**
 * Info stored for a note that has passed its expected time but may still
 * be hit within the GOOD timing window (sightread "lateNotes" concept).
 */
interface LateNoteInfo {
  note: alphaTab.model.Note;
  midiNote: number;
  beatBounds: alphaTab.rendering.BeatBounds;
  nextBeatBounds?: alphaTab.rendering.BeatBounds;
  startTick: number;
  bpm: number;
  trackIndex: number;
  hitKey: string;
}

/**
 * Convert a tick difference to wall-clock milliseconds, using the local
 * BPM and the current playback speed.
 */
function tickDiffToWallMs(
  tickDiff: number,
  bpm: number,
  playbackSpeed: number,
): number {
  return ((tickDiff / ALPHATAB_PPQ) * (60000 / bpm)) / playbackSpeed;
}

interface MidiRhythmGameProps {
  api: alphaTab.AlphaTabApi | null;
  isPlaying: boolean;
  currentTick: number;
  currentTimeMs: number;
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
 * MIDI Rhythm Game — sightread-style two-direction scoring algorithm.
 *
 * When a MIDI input arrives:
 *   1. Check late notes (past beats, still within GOOD window)
 *   2. Check current beat notes (on-time or slightly late)
 *   3. Check next beat notes (early hit)
 *   4. No match -> error
 *
 * Timing classification:
 *   - Perfect:    within ±50 ms of the note
 *   - Late Good:  50–300 ms after the note
 *   - Early Good: 50–300 ms before the note
 *   - Missed:     note expired (>300 ms with no input)
 *   - Error:      wrong note / no matching note
 */
export const MidiRhythmGame = React.memo(function MidiRhythmGame({
  api,
  isPlaying,
  currentTick,
  currentTimeMs,
  onAddCircleMarker,
  onAddCrossMarker,
  onClearMarkers,
  recordHit,
  resetScore,
  getScore,
}: MidiRhythmGameProps) {
  const { getMapping, isErrorIgnored, isNotationNoteSkipped } =
    useMidiMapping();

  const apiRef = useRef(api);
  const isPlayingRef = useRef(isPlaying);
  const currentTickRef = useRef(currentTick);
  const currentTimeMsRef = useRef(currentTimeMs);
  const onAddCircleMarkerRef = useRef(onAddCircleMarker);
  const onAddCrossMarkerRef = useRef(onAddCrossMarker);
  const prevTickRef = useRef(currentTick);
  const getMappingRef = useRef(getMapping);
  const isErrorIgnoredRef = useRef(isErrorIgnored);
  const isNotationNoteSkippedRef = useRef(isNotationNoteSkipped);

  const hitNotesRef = useRef<Set<string>>(new Set());
  const lateNotesRef = useRef<Map<number, LateNoteInfo>>(new Map());
  const lastBeatTickPerTrackRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    currentTickRef.current = currentTick;
  }, [currentTick]);
  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs]);
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

  // Loop detection: tick jumps backward while looping
  useEffect(() => {
    const prevTick = prevTickRef.current;
    prevTickRef.current = currentTick;

    if (
      isPlaying &&
      apiRef.current?.isLooping &&
      currentTick < prevTick - 960
    ) {
      if (process.env.NODE_ENV === "development") {
        console.log("Loop detected — clearing markers, keeping score", {
          prevTick,
          currentTick,
          score: getScore(),
        });
      }
      onClearMarkers();
      hitNotesRef.current.clear();
      lateNotesRef.current.clear();
      lastBeatTickPerTrackRef.current.clear();
    }
  }, [currentTick, isPlaying, onClearMarkers, getScore]);

  /**
   * Remove late notes that have exceeded GOOD_RANGE — they are truly missed.
   */
  const clearExpiredLateNotes = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;

    const tick = currentTickRef.current;
    const playbackSpeed = api.playbackSpeed;
    const toRemove: number[] = [];

    for (const [midiNote, info] of lateNotesRef.current) {
      const diffTicks = tick - info.startTick;
      const diffMs = tickDiffToWallMs(diffTicks, info.bpm, playbackSpeed);

      if (diffMs > TIMING_WINDOWS.GOOD) {
        toRemove.push(midiNote);
        recordHit("missed");
      }
    }

    for (const key of toRemove) {
      lateNotesRef.current.delete(key);
    }
  }, [recordHit]);

  // Beat-change detection: when playback passes a beat boundary, move
  // unhit notes from the old beat into lateNotes instead of immediately
  // marking them as missed.
  useEffect(() => {
    if (!isPlaying || !api?.tickCache || !api?.boundsLookup) return;

    const tracks = api.tracks;
    if (!tracks || tracks.length === 0) return;

    for (const track of tracks) {
      const beatResult = api.tickCache.findBeat(
        new Set([track.index]),
        currentTick,
      );
      if (!beatResult) continue;

      const currentBeatStart = beatResult.start;
      const lastBeatTick = lastBeatTickPerTrackRef.current.get(track.index);
      lastBeatTickPerTrackRef.current.set(track.index, currentBeatStart);

      if (lastBeatTick === undefined || lastBeatTick === currentBeatStart)
        continue;

      // Beat changed — look up the old beat
      const oldBeatResult = api.tickCache.findBeat(
        new Set([track.index]),
        lastBeatTick,
      );
      if (!oldBeatResult) continue;

      const oldBeatBounds = api.boundsLookup.findBeat(oldBeatResult.beat);
      if (!oldBeatBounds) continue;

      let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
      if (oldBeatResult.nextBeat) {
        nextBeatBounds =
          api.boundsLookup.findBeat(oldBeatResult.nextBeat.beat) ?? undefined;
      }

      for (const note of oldBeatResult.beat.notes) {
        const midiNote = getMidiNoteNumber(note);
        if (isNotationNoteSkippedRef.current(midiNote)) continue;

        const hitKey = `${track.index}:${oldBeatResult.start}:${midiNote}`;
        if (hitNotesRef.current.has(hitKey)) continue;

        // If an older late note for this MIDI note exists, it's now missed
        const existing = lateNotesRef.current.get(midiNote);
        if (existing) {
          recordHit("missed");
        }

        lateNotesRef.current.set(midiNote, {
          note,
          midiNote,
          beatBounds: oldBeatBounds,
          nextBeatBounds,
          startTick: oldBeatResult.start,
          bpm: api.score?.tempo ?? 120,
          trackIndex: track.index,
          hitKey,
        });
      }
    }

    clearExpiredLateNotes();
  }, [currentTick, isPlaying, api, recordHit, clearExpiredLateNotes]);

  // --- MIDI handler (sightread two-direction algorithm) ---
  const handleMidiMessage = useCallback(
    (event: MidiInputEvent) => {
      if (event.type !== "noteOn") return;

      const api = apiRef.current;
      const tick = currentTickRef.current;

      if (process.env.NODE_ENV === "development") {
        console.log("MIDI Input:", {
          note: event.midiNote,
          velocity: event.velocity,
          portName: event.portName,
        });
      }

      // Resolve MIDI mapping
      const mapping = getMappingRef.current();
      let targetMidiNotes: number[];

      if (mapping && mapping.entries.length > 0) {
        const mapped = mapping.entries
          .filter((entry) => entry.mappedNotes.includes(event.midiNote))
          .map((entry) => entry.targetNote);

        if (process.env.NODE_ENV === "development" && mapped.length > 0) {
          console.log("MIDI Mapping applied:", {
            inputNote: event.midiNote,
            targetNotes: mapped,
          });
        }

        targetMidiNotes = mapped.length > 0 ? mapped : [event.midiNote];
      } else {
        targetMidiNotes = [event.midiNote];
      }

      clearExpiredLateNotes();

      if (!api?.tickCache || !api?.boundsLookup) {
        recordHit("error");
        return;
      }

      const tracks = api.tracks;
      if (!tracks || tracks.length === 0) {
        recordHit("error");
        return;
      }

      const playbackSpeed = api.playbackSpeed;
      const scale = api.settings.display.scale;

      // --- Step 1: Check late notes (already passed their beat) ---
      for (const targetNote of targetMidiNotes) {
        const lateNote = lateNotesRef.current.get(targetNote);
        if (!lateNote) continue;

        const diffTicks = tick - lateNote.startTick;
        const diffMs = tickDiffToWallMs(diffTicks, lateNote.bpm, playbackSpeed);

        if (diffMs <= TIMING_WINDOWS.GOOD) {
          const result: HitResult =
            diffMs <= TIMING_WINDOWS.PERFECT ? "perfect" : "lateGood";

          recordHit(result);
          hitNotesRef.current.add(lateNote.hitKey);
          lateNotesRef.current.delete(targetNote);

          const staffLine = getStaffLineIndex(
            lateNote.note,
            lateNote.beatBounds,
            scale,
          );
          onAddCircleMarkerRef.current(
            lateNote.beatBounds,
            staffLine,
            0,
            lateNote.nextBeatBounds,
            lateNote.note,
            lateNote.startTick,
          );

          if (process.env.NODE_ENV === "development") {
            console.log("Late hit!", {
              timing: result,
              diffMs: diffMs.toFixed(1),
              midiNote: targetNote,
            });
          }
          return;
        }
      }

      // --- Step 2: Check current beat notes (on-time / slightly late) ---
      for (const track of tracks) {
        const beatResult = api.tickCache.findBeat(
          new Set([track.index]),
          tick,
        );
        if (!beatResult) continue;

        const beat = beatResult.beat;
        const beatStartTick = beatResult.start;
        const diffTicks = tick - beatStartTick;
        const scoreBpm = api.score?.tempo ?? 120;
        const diffMs = tickDiffToWallMs(diffTicks, scoreBpm, playbackSpeed);

        if (diffMs > TIMING_WINDOWS.GOOD) continue;

        for (const note of beat.notes) {
          const noteMidi = getMidiNoteNumber(note);
          if (isNotationNoteSkippedRef.current(noteMidi)) continue;

          const hitKey = `${track.index}:${beatStartTick}:${noteMidi}`;
          if (hitNotesRef.current.has(hitKey)) continue;
          if (!targetMidiNotes.includes(noteMidi)) continue;

          const result: HitResult =
            diffMs <= TIMING_WINDOWS.PERFECT ? "perfect" : "lateGood";

          recordHit(result);
          hitNotesRef.current.add(hitKey);
          lateNotesRef.current.delete(noteMidi);

          const beatBounds = api.boundsLookup.findBeat(beat);
          if (beatBounds) {
            let nextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
            if (beatResult.nextBeat) {
              nextBeatBounds =
                api.boundsLookup.findBeat(beatResult.nextBeat.beat) ??
                undefined;
            }

            const beatDuration = beatResult.end - beatStartTick;
            const timingOffset =
              beatDuration > 0 ? diffTicks / beatDuration : 0;
            const staffLine = getStaffLineIndex(note, beatBounds, scale);
            onAddCircleMarkerRef.current(
              beatBounds,
              staffLine,
              timingOffset,
              nextBeatBounds,
              note,
              beatStartTick,
            );
          }

          if (process.env.NODE_ENV === "development") {
            console.log("Current beat hit!", {
              timing: result,
              diffMs: diffMs.toFixed(1),
              midiNote: noteMidi,
            });
          }
          return;
        }
      }

      // --- Step 3: Check next beat notes (early hit) ---
      for (const track of tracks) {
        const beatResult = api.tickCache.findBeat(
          new Set([track.index]),
          tick,
        );
        if (!beatResult?.nextBeat) continue;

        const nextBeat = beatResult.nextBeat.beat;
        const nextBeatStartTick = beatResult.end;
        const diffTicks = nextBeatStartTick - tick;
        const scoreBpm = api.score?.tempo ?? 120;
        const diffMs = tickDiffToWallMs(diffTicks, scoreBpm, playbackSpeed);

        if (diffMs > TIMING_WINDOWS.GOOD) continue;

        for (const note of nextBeat.notes) {
          const noteMidi = getMidiNoteNumber(note);
          if (isNotationNoteSkippedRef.current(noteMidi)) continue;

          const hitKey = `${track.index}:${nextBeatStartTick}:${noteMidi}`;
          if (hitNotesRef.current.has(hitKey)) continue;
          if (!targetMidiNotes.includes(noteMidi)) continue;

          const result: HitResult =
            diffMs <= TIMING_WINDOWS.PERFECT ? "perfect" : "earlyGood";

          recordHit(result);
          hitNotesRef.current.add(hitKey);

          const nextBeatBounds = api.boundsLookup.findBeat(nextBeat);
          if (nextBeatBounds) {
            const staffLine = getStaffLineIndex(note, nextBeatBounds, scale);
            onAddCircleMarkerRef.current(
              nextBeatBounds,
              staffLine,
              0,
              undefined,
              note,
              nextBeatStartTick,
            );
          }

          if (process.env.NODE_ENV === "development") {
            console.log("Early hit!", {
              timing: result,
              diffMs: diffMs.toFixed(1),
              midiNote: noteMidi,
            });
          }
          return;
        }
      }

      // --- Step 4: No match — error ---
      const shouldIgnoreError = isErrorIgnoredRef.current(event.midiNote);

      let allExpectedNotesSkipped = false;
      for (const track of tracks) {
        const beatResult = api.tickCache.findBeat(
          new Set([track.index]),
          tick,
        );
        if (!beatResult) continue;
        if (
          beatResult.beat.notes.length > 0 &&
          beatResult.beat.notes.every((n) =>
            isNotationNoteSkippedRef.current(getMidiNoteNumber(n)),
          )
        ) {
          allExpectedNotesSkipped = true;
          break;
        }
      }

      if (!shouldIgnoreError && !allExpectedNotesSkipped) {
        const wrongPos = getWrongNotePosition(api, tick, event.midiNote);

        let fallbackBeatBounds: alphaTab.rendering.BeatBounds | null = null;
        let fallbackTimingOffset = 0;
        let fallbackNextBeatBounds: alphaTab.rendering.BeatBounds | undefined;
        let fallbackStartTick = tick;

        if (!wrongPos) {
          const trackIndexes = new Set(tracks.map((t) => t.index));
          const beatResult = api.tickCache.findBeat(trackIndexes, tick);
          if (beatResult) {
            fallbackBeatBounds = api.boundsLookup.findBeat(beatResult.beat);
            const beatDuration = beatResult.end - beatResult.start;
            fallbackTimingOffset =
              beatDuration > 0
                ? (tick - beatResult.start) / beatDuration
                : 0;
            fallbackStartTick = beatResult.start;
            if (beatResult.nextBeat) {
              fallbackNextBeatBounds =
                api.boundsLookup.findBeat(beatResult.nextBeat.beat) ??
                undefined;
            }
          }
        }

        const markerBounds = wrongPos?.beatBounds ?? fallbackBeatBounds;
        if (markerBounds) {
          onAddCrossMarkerRef.current(
            markerBounds,
            wrongPos?.staffLineIndex ?? 2,
            wrongPos?.timingOffset ?? fallbackTimingOffset,
            wrongPos?.nextBeatBounds ?? fallbackNextBeatBounds,
            undefined,
            wrongPos?.startTick ?? fallbackStartTick,
          );
        }

        recordHit("error");
        if (process.env.NODE_ENV === "development") {
          console.log("Wrong note!", { inputNote: event.midiNote });
        }
      } else if (process.env.NODE_ENV === "development") {
        console.log(
          allExpectedNotesSkipped
            ? "Beat skipped (practice focus mode)"
            : "Error ignored for MIDI note",
          { inputNote: event.midiNote },
        );
      }
    },
    [recordHit, clearExpiredLateNotes],
  );

  const { isSupported, isConnected, inputs, error } = useMidiInput(
    handleMidiMessage,
    true,
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("MIDI Rhythm Game Status:", {
        supported: isSupported,
        connected: isConnected,
        devices: inputs.length,
        inputs: inputs.map((i) => i.name),
      });
    }
  }, [isSupported, isConnected, inputs]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const score = getScore();
      if (score.totalNotes > 0 || score.errors > 0) {
        if (process.env.NODE_ENV === "development") {
          console.log("Current Score:", {
            accuracy: `${score.accuracy}%`,
            perfect: score.perfect,
            earlyGood: score.earlyGood,
            lateGood: score.lateGood,
            good: score.good,
            missed: score.missed,
            errors: score.errors,
            streak: score.streak,
            maxStreak: score.maxStreak,
            total: score.totalNotes,
          });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying, getScore]);

  useEffect(() => {
    if (isPlaying) {
      resetScore();
      hitNotesRef.current.clear();
      lateNotesRef.current.clear();
      lastBeatTickPerTrackRef.current.clear();
    } else {
      const score = getScore();
      if (score.totalNotes > 0) {
        if (process.env.NODE_ENV === "development") {
          console.log("Final Score:", {
            accuracy: `${score.accuracy}%`,
            perfect: score.perfect,
            earlyGood: score.earlyGood,
            lateGood: score.lateGood,
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

  if (!isSupported && process.env.NODE_ENV === "development") {
    console.warn("Web MIDI API not supported in this browser");
  }

  if (error && process.env.NODE_ENV === "development") {
    console.error("MIDI Error:", error);
  }

  return null;
});
