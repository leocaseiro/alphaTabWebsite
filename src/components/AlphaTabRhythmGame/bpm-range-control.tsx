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

export interface BpmRangeControlPanelProps {
  api: alphaTab.AlphaTabApi;
  onSpeedChange: (speed: number) => void;
}

const BPM_DEFAULT_ORIGINAL = 120; // Fallback if score BPM unavailable
const BPM_STEP_CHANGE = 5; // Change BPM by 5

export const BpmRangeControlPanel: React.FC<BpmRangeControlPanelProps> = ({
  api,
  onSpeedChange,
}) => {
  const [originalBpm, setOriginalBpm] = useState(
    api.score?.tempo ?? BPM_DEFAULT_ORIGINAL,
  );
  const [currentBpm, setCurrentBpm] = useState(
    Math.round((api.score?.tempo ?? BPM_DEFAULT_ORIGINAL) * api.playbackSpeed),
  );

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

          <div className={styles["bpm-panel-value"]}>
            <strong>{currentBpm}</strong> BPM
          </div>
        </div>
      </div>
    </div>
  );
};
