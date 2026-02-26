import { useState, useCallback, useRef } from "react";
import type * as alphaTab from "@coderline/alphatab";
import {
  type AccuracyTier,
  type RhythmGameScore,
  ACCURACY_TIERS,
  getAccuracyTier,
} from "./useRhythmGameScore";
import { settingsSyncEmitter } from "./settings-sync";

const AUTO_BPM_TIERS = ACCURACY_TIERS.filter(
  (t) => t.tier !== "fair" && t.tier !== "poor",
);

export { AUTO_BPM_TIERS };

export interface AutoBpmSettings {
  enabled: boolean;
  minLoopsPerCycle: number;
  accuracyGoalTier: AccuracyTier;
  bpmIncrement: number;
  bpmGoal: number;
}

export interface UseAutoBpmReturn {
  settings: AutoBpmSettings;
  setEnabled: (enabled: boolean) => void;
  setMinLoopsPerCycle: (loops: number) => void;
  setAccuracyGoalTier: (tier: AccuracyTier) => void;
  setBpmIncrement: (increment: number) => void;
  setBpmGoal: (goal: number) => void;
  setTrackBpm: (bpm: number) => void;
  onLoopCycleComplete: (score: RhythmGameScore) => void;
}

function meetsAccuracyGoal(
  accuracy: number,
  goalTier: AccuracyTier,
): boolean {
  const actualTierIndex = ACCURACY_TIERS.findIndex(
    (t) => t.tier === getAccuracyTier(accuracy),
  );
  const goalTierIndex = ACCURACY_TIERS.findIndex((t) => t.tier === goalTier);
  if (actualTierIndex === -1 || goalTierIndex === -1) return false;
  // Lower index = better tier (excellent is 0)
  return actualTierIndex <= goalTierIndex;
}

export function useAutoBpm(
  api: alphaTab.AlphaTabApi | null,
  onToast: (message: string) => void,
): UseAutoBpmReturn {
  const defaultBpm = api?.score?.tempo ?? 120;

  const [settings, setSettings] = useState<AutoBpmSettings>({
    enabled: false,
    minLoopsPerCycle: 1,
    accuracyGoalTier: "excellent",
    bpmIncrement: 5,
    bpmGoal: defaultBpm,
  });

  // Ref-based tracking for zero-latency during gameplay
  const completedLoopsRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const apiRef = useRef(api);
  apiRef.current = api;

  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
    if (!enabled) {
      completedLoopsRef.current = 0;
    }
  }, []);

  const setMinLoopsPerCycle = useCallback((minLoopsPerCycle: number) => {
    setSettings((prev) => ({
      ...prev,
      minLoopsPerCycle: Math.max(1, minLoopsPerCycle),
    }));
  }, []);

  const setAccuracyGoalTier = useCallback((accuracyGoalTier: AccuracyTier) => {
    setSettings((prev) => ({ ...prev, accuracyGoalTier }));
  }, []);

  const setBpmIncrement = useCallback((bpmIncrement: number) => {
    setSettings((prev) => ({
      ...prev,
      bpmIncrement: Math.max(1, bpmIncrement),
    }));
  }, []);

  const setBpmGoal = useCallback((bpmGoal: number) => {
    setSettings((prev) => ({
      ...prev,
      bpmGoal: Math.max(1, bpmGoal),
    }));
  }, []);

  const setTrackBpm = useCallback((bpm: number) => {
    setSettings((prev) => ({ ...prev, bpmGoal: bpm }));
  }, []);

  const onLoopCycleComplete = useCallback((score: RhythmGameScore) => {
    const s = settingsRef.current;
    const currentApi = apiRef.current;
    if (!s.enabled || !currentApi) return;

    const originalBpm = currentApi.score?.tempo ?? 120;
    const currentBpm = Math.round(originalBpm * currentApi.playbackSpeed);

    if (meetsAccuracyGoal(score.accuracy, s.accuracyGoalTier)) {
      completedLoopsRef.current += 1;

      if (completedLoopsRef.current >= s.minLoopsPerCycle) {
        completedLoopsRef.current = 0;

        if (currentBpm < s.bpmGoal) {
          const newBpm = Math.min(currentBpm + s.bpmIncrement, s.bpmGoal);
          const newSpeed = newBpm / originalBpm;
          currentApi.playbackSpeed = newSpeed;
          currentApi.updateSettings();
          settingsSyncEmitter.notify("auto-bpm");

          if (newBpm >= s.bpmGoal) {
            onToastRef.current(`Goal reached: ${newBpm} BPM`);
          } else {
            onToastRef.current(`BPM increased to ${newBpm}`);
          }
        }
      }
    } else {
      completedLoopsRef.current = 0;
    }
  }, []);

  return {
    settings,
    setEnabled,
    setMinLoopsPerCycle,
    setAccuracyGoalTier,
    setBpmIncrement,
    setBpmGoal,
    setTrackBpm,
    onLoopCycleComplete,
  };
}
