"use client";

import * as alphaTab from "@coderline/alphatab";
import type React from "react";
import { useState, useEffect } from "react";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";

export interface BpmSpeedControlProps {
  api: alphaTab.AlphaTabApi;
  onSpeedChange: (speed: number) => void;
  inputId: string;
}

const BPM_DEFAULT_ORIGINAL = 120; // Fallback if score BPM unavailable
const BPM_MIN_PERCENTAGE = 0.01; // 1%
const BPM_MAX_PERCENTAGE = 2.0; // 200%
const BPM_STEP = 0.01; // 1% increments for smoother control
const SNAP_THRESHOLD = 0.05; // Snap to 100% when within 5% (0.95-1.05)

export const BpmSpeedControl: React.FC<BpmSpeedControlProps> = ({
  api,
  onSpeedChange,
  inputId,
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useState(api.playbackSpeed);

  // Extract original BPM from score
  const getOriginalBpm = (): number => {
    if (api.score?.tempo) {
      return api.score.tempo;
    }
    // Fallback to default BPM
    return BPM_DEFAULT_ORIGINAL;
  };

  const originalBpm = getOriginalBpm();

  // Calculate current BPM based on playback speed
  const currentBpm = Math.round(originalBpm * playbackSpeed);

  // Calculate percentage display
  const percentageDisplay = Math.round(playbackSpeed * 100);

  // Handle slider change with snap-to-100% functionality
  const handleSpeedChange = (newSpeed: number) => {
    // Snap to exactly 1.0 when close to 100%
    if (Math.abs(newSpeed - 1.0) < SNAP_THRESHOLD) {
      newSpeed = 1.0;
    }

    setPlaybackSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  // Update local state when API changes externally
  useEffect(() => {
    setPlaybackSpeed(api.playbackSpeed);
  }, [api.playbackSpeed]);

  // Tooltip shows percentage
  const tooltipContent = `${currentBpm} BPM (${percentageDisplay}%)`;

  return (
    <div className={styles["bpm-speed-control"]}>
      <div className={styles["bpm-slider-container"]}>
        <div className={styles["bpm-slider-wrapper"]}>
          <div
            className={styles.slider}
            data-tooltip-id="tooltip-playground"
            data-tooltip-place="left"
            data-tooltip-content={tooltipContent}
          >
            <input
              type="range"
              id={inputId}
              min={BPM_MIN_PERCENTAGE}
              max={BPM_MAX_PERCENTAGE}
              step={BPM_STEP}
              value={playbackSpeed}
              onInput={(e) => {
                const speed = (e.target as HTMLInputElement).valueAsNumber;
                handleSpeedChange(speed);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          </div>
          <div className={styles["bpm-marker-100"]} title="100% Original BPM" />
        </div>
      </div>
    </div>
  );
};
