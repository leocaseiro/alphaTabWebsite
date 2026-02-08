import { useRef, useCallback } from "react";

/**
 * Timing windows in milliseconds
 * Based on the reference from sightread project
 */
export const TIMING_WINDOWS = {
  PERFECT: 50, // ±50ms for perfect
  GOOD: 300, // ±300ms for good
} as const;

/**
 * Score statistics
 */
export interface RhythmGameScore {
  perfect: number;
  good: number;
  missed: number;
  errors: number;
  streak: number;
  maxStreak: number;
  totalNotes: number;
  accuracy: number; // percentage 0-100
}

/**
 * Hit result for a single note
 */
export type HitResult = "perfect" | "good" | "missed" | "error";

/**
 * Hook return type
 */
export interface UseRhythmGameScoreReturn {
  scoreRef: React.MutableRefObject<RhythmGameScore>;
  recordHit: (result: HitResult) => void;
  resetScore: () => void;
  getScore: () => RhythmGameScore;
}

/**
 * Hook to manage rhythm game scoring and statistics
 * PERFORMANCE OPTIMIZED: Uses refs to avoid state updates during gameplay
 * Score updates don't trigger re-renders for minimal latency
 *
 * Tracks:
 * - Perfect hits (within ±50ms)
 * - Good hits (within ±300ms)
 * - Missed notes (didn't hit in time)
 * - Errors (extra hits, wrong notes)
 * - Streak (consecutive correct hits without error)
 * - Accuracy percentage
 */
export function useRhythmGameScore(): UseRhythmGameScoreReturn {
  // Use ref instead of state to avoid re-renders during gameplay
  // This provides zero-latency score updates
  const scoreRef = useRef<RhythmGameScore>({
    perfect: 0,
    good: 0,
    missed: 0,
    errors: 0,
    streak: 0,
    maxStreak: 0,
    totalNotes: 0,
    accuracy: 100,
  });

  const recordHit = useCallback((result: HitResult) => {
    const score = scoreRef.current;

    switch (result) {
      case "perfect":
        score.perfect += 1;
        score.streak += 1;
        score.totalNotes += 1;
        break;

      case "good":
        score.good += 1;
        score.streak += 1;
        score.totalNotes += 1;
        break;

      case "missed":
        score.missed += 1;
        score.streak = 0; // Break streak on miss
        score.totalNotes += 1;
        break;

      case "error":
        score.errors += 1;
        score.streak = 0; // Break streak on error
        break;
    }

    // Update max streak
    if (score.streak > score.maxStreak) {
      score.maxStreak = score.streak;
    }

    // Calculate accuracy: (hits / total attempts) * 100
    // Total attempts = totalNotes + errors
    const totalHits = score.perfect + score.good;
    const totalAttempts = score.totalNotes + score.errors;

    score.accuracy =
      totalAttempts === 0 ? 100 : Math.round((totalHits / totalAttempts) * 100);
  }, []);

  const resetScore = useCallback(() => {
    scoreRef.current = {
      perfect: 0,
      good: 0,
      missed: 0,
      errors: 0,
      streak: 0,
      maxStreak: 0,
      totalNotes: 0,
      accuracy: 100,
    };
  }, []);

  const getScore = useCallback(() => {
    // Return a copy to prevent external mutations
    return { ...scoreRef.current };
  }, []);

  return {
    scoreRef,
    recordHit,
    resetScore,
    getScore,
  };
}
