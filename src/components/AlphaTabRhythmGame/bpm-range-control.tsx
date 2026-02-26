"use client";

import * as alphaTab from "@coderline/alphatab";
import type React from "react";
import { useState, useEffect } from "react";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { BpmSpeedControl } from "./bpm-speed-control";
import { useAlphaTabEvent } from "@site/src/hooks";
import { settingsSyncEmitter } from "./settings-sync";
import type { AccuracyTier } from "./useRhythmGameScore";
import type { AutoBpmSettings } from "./useAutoBpm";
import { AUTO_BPM_TIERS } from "./useAutoBpm";

export interface BpmRangeControlPanelProps {
  api: alphaTab.AlphaTabApi;
  onSpeedChange: (speed: number) => void;
  autoBpmSettings: AutoBpmSettings;
  onAutoBpmEnabledChange: (enabled: boolean) => void;
  onAutoBpmMinLoopsChange: (loops: number) => void;
  onAutoBpmAccuracyGoalChange: (tier: AccuracyTier) => void;
  onAutoBpmIncrementChange: (increment: number) => void;
  onAutoBpmGoalChange: (goal: number) => void;
}

const BPM_DEFAULT_ORIGINAL = 120;
const BPM_STEP_CHANGE = 5;

export const BpmRangeControlPanel: React.FC<BpmRangeControlPanelProps> = ({
  api,
  onSpeedChange,
  autoBpmSettings,
  onAutoBpmEnabledChange,
  onAutoBpmMinLoopsChange,
  onAutoBpmAccuracyGoalChange,
  onAutoBpmIncrementChange,
  onAutoBpmGoalChange,
}) => {
  const [originalBpm, setOriginalBpm] = useState(
    api.score?.tempo ?? BPM_DEFAULT_ORIGINAL,
  );
  const [currentBpm, setCurrentBpm] = useState(
    Math.round((api.score?.tempo ?? BPM_DEFAULT_ORIGINAL) * api.playbackSpeed),
  );

  const percentageDisplay = Math.round(api.playbackSpeed * 100);

  const minBpm = Math.round(originalBpm * 0.01); // 1% of original
  const maxBpm = Math.round(originalBpm * 2.0); // 200% of original

  // Listen for score changes to update the original BPM
  useAlphaTabEvent(api, "scoreLoaded", (score) => {
    const newOriginalBpm = score.tempo ?? BPM_DEFAULT_ORIGINAL;
    setOriginalBpm(newOriginalBpm);
    setCurrentBpm(Math.round(newOriginalBpm * api.playbackSpeed));
  });

  // Listen for settings changes from other components (practice-mode-settings, playground-settings, etc.)
  useEffect(() => {
    const unsubscribe = settingsSyncEmitter.subscribe((source) => {
      // Update BPM when settings change from other sources
      if (source !== "bpm-control-panel") {
        const newBpm = Math.round(originalBpm * api.playbackSpeed);
        setCurrentBpm(newBpm);
      }
    });

    return unsubscribe;
  }, [api, originalBpm]);

  const handleBpmChange = (newBpm: number) => {
    const clampedBpm = Math.max(minBpm, Math.min(maxBpm, newBpm));
    setCurrentBpm(clampedBpm);
    const newSpeed = clampedBpm / originalBpm;
    onSpeedChange(newSpeed);
    // Notify other components about the change
    settingsSyncEmitter.notify("bpm-control-panel");
  };

  const decreaseBpm = () => {
    handleBpmChange(currentBpm - BPM_STEP_CHANGE);
  };

  const increaseBpm = () => {
    handleBpmChange(currentBpm + BPM_STEP_CHANGE);
  };

  // For the slider, convert BPM to speed and vice versa
  const handleSpeedChange = (newSpeed: number) => {
    const newBpm = Math.round(originalBpm * newSpeed);
    handleBpmChange(newBpm);
  };

  return (
    <div className={styles["bpm-control-panel"]}>
      <div className={styles["bpm-panel-content"]}>
        <div className={styles["bpm-panel-label"]}>
          <FontAwesomeIcon icon={solid.faMusic} />
          <span>BPM Control</span>
        </div>

        <div className={styles["bpm-panel-controls"]}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              decreaseBpm();
            }}
            className={styles["bpm-adjust-button"]}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Decrease BPM by 5"
          >
            <FontAwesomeIcon icon={solid.faMinus} />
          </button>

          <div className={styles["bpm-panel-slider"]}>
            <BpmSpeedControl
              api={api}
              onSpeedChange={handleSpeedChange}
              inputId="bpm-range-slider"
            />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              increaseBpm();
            }}
            className={styles["bpm-adjust-button"]}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Increase BPM by 5"
          >
            <FontAwesomeIcon icon={solid.faPlus} />
          </button>

          <div
            className={`${styles["bpm-panel-value"]} ${autoBpmSettings.enabled ? styles["bpm-panel-value-active"] : ""}`}
          >
            <strong>{currentBpm}</strong> BPM ({percentageDisplay}%)
          </div>
        </div>
      </div>

      <div className={styles["auto-bpm-section"]}>
        <div className={styles["auto-bpm-header"]}>
          <button
            type="button"
            className={styles["auto-bpm-toggle"]}
            data-active={autoBpmSettings.enabled || undefined}
            onClick={() => onAutoBpmEnabledChange(!autoBpmSettings.enabled)}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Automatically increase BPM when accuracy goal is met"
          >
            <FontAwesomeIcon icon={solid.faRobot} />
            Auto BPM {autoBpmSettings.enabled ? "ON" : "OFF"}
          </button>
        </div>

        {autoBpmSettings.enabled && (
          <div className={styles["auto-bpm-settings"]}>
            <div className={styles["auto-bpm-field"]}>
              <span className={styles["auto-bpm-field-label"]}>Loops/Cycle</span>
              <input
                type="number"
                className={styles["auto-bpm-field-input"]}
                min={1}
                max={20}
                value={autoBpmSettings.minLoopsPerCycle}
                onChange={(e) =>
                  onAutoBpmMinLoopsChange(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className={styles["auto-bpm-field"]}>
              <span className={styles["auto-bpm-field-label"]}>
                Accuracy Goal
              </span>
              <select
                className={styles["auto-bpm-field-select"]}
                value={autoBpmSettings.accuracyGoalTier}
                onChange={(e) =>
                  onAutoBpmAccuracyGoalChange(e.target.value as AccuracyTier)
                }
                onClick={(e) => e.stopPropagation()}
              >
                {AUTO_BPM_TIERS.map((t) => (
                  <option key={t.tier} value={t.tier}>
                    {t.tier} ({t.minAccuracy}%+)
                  </option>
                ))}
              </select>
            </div>

            <div className={styles["auto-bpm-field"]}>
              <span className={styles["auto-bpm-field-label"]}>
                BPM Increment
              </span>
              <input
                type="number"
                className={styles["auto-bpm-field-input"]}
                min={1}
                max={50}
                value={autoBpmSettings.bpmIncrement}
                onChange={(e) =>
                  onAutoBpmIncrementChange(
                    Math.max(1, parseInt(e.target.value, 10) || 5),
                  )
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className={styles["auto-bpm-field"]}>
              <span className={styles["auto-bpm-field-label"]}>
                BPM Goal
              </span>
              <input
                type="number"
                className={styles["auto-bpm-field-input"]}
                min={1}
                max={999}
                value={autoBpmSettings.bpmGoal}
                onChange={(e) =>
                  onAutoBpmGoalChange(
                    Math.max(1, parseInt(e.target.value, 10) || 120),
                  )
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
