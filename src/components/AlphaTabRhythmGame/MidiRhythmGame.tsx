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
  createGameCaches,
  rebuildArticulationMaps,
  getTrackIndexSet,
  type GameCaches,
} from "./circle-marker-helpers";
import { useMidiMapping } from "./midi-mapping-context";

const ALPHATAB_PPQ = 960;

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
  onAddCircleMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
    startTick?: number,
    hitResult?: HitResult,
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
  autoBpmEnabled: boolean;
  onLoopCycleComplete: ((score: RhythmGameScore) => void) | null;
}

/**
 * MIDI Rhythm Game — sightread-style two-direction scoring algorithm.
 *
 * PERFORMANCE: All tick-driven logic (beat-change detection, loop detection)
 * runs inside the `playerPositionChanged` event callback — NOT in React
 * effects triggered by state.  This eliminates ~60 React re-renders/second
 * that the old `currentTick` state approach caused.
 */
export const MidiRhythmGame = React.memo(function MidiRhythmGame({
  api,
  isPlaying,
  onAddCircleMarker,
  onAddCrossMarker,
  onClearMarkers,
  recordHit,
  resetScore,
  getScore,
  autoBpmEnabled,
  onLoopCycleComplete,
}: MidiRhythmGameProps) {
  const { getMapping, isErrorIgnored, isNotationNoteSkipped } =
    useMidiMapping();

  // --- Refs: keep latest prop/context values accessible in callbacks ------
  const apiRef = useRef(api);
  const isPlayingRef = useRef(isPlaying);
  const currentTickRef = useRef(0);
  const currentTimeMsRef = useRef(0);
  const prevTickRef = useRef(0);
  const onAddCircleMarkerRef = useRef(onAddCircleMarker);
  const onAddCrossMarkerRef = useRef(onAddCrossMarker);
  const onClearMarkersRef = useRef(onClearMarkers);
  const recordHitRef = useRef(recordHit);
  const resetScoreRef = useRef(resetScore);
  const getScoreRef = useRef(getScore);
  const getMappingRef = useRef(getMapping);
  const isErrorIgnoredRef = useRef(isErrorIgnored);
  const isNotationNoteSkippedRef = useRef(isNotationNoteSkipped);
  const autoBpmEnabledRef = useRef(autoBpmEnabled);
  const onLoopCycleCompleteRef = useRef(onLoopCycleComplete);

  // Sync refs — idempotent assignments, safe during render
  apiRef.current = api;
  isPlayingRef.current = isPlaying;
  onAddCircleMarkerRef.current = onAddCircleMarker;
  onAddCrossMarkerRef.current = onAddCrossMarker;
  onClearMarkersRef.current = onClearMarkers;
  recordHitRef.current = recordHit;
  resetScoreRef.current = resetScore;
  getScoreRef.current = getScore;
  getMappingRef.current = getMapping;
  isErrorIgnoredRef.current = isErrorIgnored;
  isNotationNoteSkippedRef.current = isNotationNoteSkipped;
  autoBpmEnabledRef.current = autoBpmEnabled;
  onLoopCycleCompleteRef.current = onLoopCycleComplete;

  // --- Game state (ref-based, zero React re-renders) ----------------------
  const hitNotesRef = useRef<Set<string>>(new Set());
  const lateNotesRef = useRef<Map<number, LateNoteInfo>>(new Map());
  const lastBeatTickPerTrackRef = useRef<Map<number, number>>(new Map());

  // --- Caches -------------------------------------------------------------
  const cachesRef = useRef<GameCaches>(createGameCaches());

  // Rebuild articulation maps when API / tracks change
  useEffect(() => {
    if (!api) return;
    rebuildArticulationMaps(cachesRef.current, api.tracks);
  }, [api]);

  // Clear staff-line cache when the score re-renders (layout may change)
  useEffect(() => {
    if (!api) return;
    const handler = () => {
      cachesRef.current.staffLineIndex.clear();
    };
    api.renderFinished.on(handler);
    return () => api.renderFinished.off(handler);
  }, [api]);

  // --- clearExpiredLateNotes (reads refs only) ----------------------------
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
        recordHitRef.current("missed");
      }
    }

    for (const key of toRemove) {
      lateNotesRef.current.delete(key);
    }
  }, []);

  // --- playerPositionChanged: all tick-driven logic runs here -------------
  useEffect(() => {
    if (!api) return;

    const handler = (e: alphaTab.synth.PositionChangedEventArgs) => {
      const prevTick = currentTickRef.current;
      currentTickRef.current = e.currentTick;
      currentTimeMsRef.current = e.currentTime;

      if (!isPlayingRef.current) return;
      if (!api.tickCache || !api.boundsLookup) return;

      // Loop detection: tick jumps backward while looping
      if (api.isLooping && e.currentTick < prevTick - ALPHATAB_PPQ) {
        if (autoBpmEnabledRef.current && onLoopCycleCompleteRef.current) {
          const cycleScore = getScoreRef.current();
          onLoopCycleCompleteRef.current(cycleScore);
          resetScoreRef.current();
          if (process.env.NODE_ENV === "development") {
            console.log("Auto-BPM loop cycle complete", {
              accuracy: cycleScore.accuracy,
              prevTick,
              currentTick: e.currentTick,
            });
          }
        } else if (process.env.NODE_ENV === "development") {
          console.log("Loop detected — clearing markers, keeping score", {
            prevTick,
            currentTick: e.currentTick,
            score: getScoreRef.current(),
          });
        }
        onClearMarkersRef.current();
        hitNotesRef.current.clear();
        lateNotesRef.current.clear();
        lastBeatTickPerTrackRef.current.clear();
        return;
      }

      // Beat-change detection
      const tracks = api.tracks;
      if (!tracks || tracks.length === 0) return;

      const caches = cachesRef.current;

      for (const track of tracks) {
        const trackSet = getTrackIndexSet(caches, track.index);
        const beatResult = api.tickCache.findBeat(trackSet, e.currentTick);
        if (!beatResult) continue;

        const currentBeatStart = beatResult.start;
        const lastBeatTick = lastBeatTickPerTrackRef.current.get(track.index);
        lastBeatTickPerTrackRef.current.set(track.index, currentBeatStart);

        if (lastBeatTick === undefined || lastBeatTick === currentBeatStart)
          continue;

        // Beat changed — look up the old beat
        const oldBeatResult = api.tickCache.findBeat(trackSet, lastBeatTick);
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

          const existing = lateNotesRef.current.get(midiNote);
          if (existing) {
            recordHitRef.current("missed");
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
    };

    api.playerPositionChanged.on(handler);
    return () => api.playerPositionChanged.off(handler);
  }, [api, clearExpiredLateNotes]);

  // --- MIDI handler (sightread two-direction algorithm) -------------------
  const handleMidiMessage = useCallback(
    (event: MidiInputEvent) => {
      if (event.type !== "noteOn") return;
      if (!isPlayingRef.current) return;

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
        recordHitRef.current("error");
        return;
      }

      const tracks = api.tracks;
      if (!tracks || tracks.length === 0) {
        recordHitRef.current("error");
        return;
      }

      const playbackSpeed = api.playbackSpeed;
      const scale = api.settings.display.scale;
      const caches = cachesRef.current;

      // --- Step 1: Check late notes (already passed their beat) ---
      for (const targetNote of targetMidiNotes) {
        const lateNote = lateNotesRef.current.get(targetNote);
        if (!lateNote) continue;

        const diffTicks = tick - lateNote.startTick;
        const diffMs = tickDiffToWallMs(diffTicks, lateNote.bpm, playbackSpeed);

        if (diffMs <= TIMING_WINDOWS.GOOD) {
          const result: HitResult =
            diffMs <= TIMING_WINDOWS.PERFECT ? "perfect" : "lateGood";

          recordHitRef.current(result);
          hitNotesRef.current.add(lateNote.hitKey);
          lateNotesRef.current.delete(targetNote);

          const staffLine = getStaffLineIndex(
            lateNote.note,
            lateNote.beatBounds,
            scale,
            caches,
          );
          onAddCircleMarkerRef.current(
            lateNote.beatBounds,
            staffLine,
            0,
            lateNote.nextBeatBounds,
            lateNote.note,
            lateNote.startTick,
            result,
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
        const trackSet = getTrackIndexSet(caches, track.index);
        const beatResult = api.tickCache.findBeat(trackSet, tick);
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

          recordHitRef.current(result);
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
            const staffLine = getStaffLineIndex(note, beatBounds, scale, caches);
            onAddCircleMarkerRef.current(
              beatBounds,
              staffLine,
              timingOffset,
              nextBeatBounds,
              note,
              beatStartTick,
              result,
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
        const trackSet = getTrackIndexSet(caches, track.index);
        const beatResult = api.tickCache.findBeat(trackSet, tick);
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

          recordHitRef.current(result);
          hitNotesRef.current.add(hitKey);

          const nextBeatBounds = api.boundsLookup.findBeat(nextBeat);
          if (nextBeatBounds) {
            const staffLine = getStaffLineIndex(
              note,
              nextBeatBounds,
              scale,
              caches,
            );
            onAddCircleMarkerRef.current(
              nextBeatBounds,
              staffLine,
              0,
              undefined,
              note,
              nextBeatStartTick,
              result,
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
        const trackSet = getTrackIndexSet(caches, track.index);
        const beatResult = api.tickCache.findBeat(trackSet, tick);
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
        const wrongPos = getWrongNotePosition(api, tick, event.midiNote, caches);

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

        recordHitRef.current("error");
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
    [clearExpiredLateNotes],
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
