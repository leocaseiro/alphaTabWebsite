"use client";

import type React from "react";
import { useState, useEffect } from "react";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import type { RhythmGameScore } from "./useRhythmGameScore";

interface RhythmGameScorePanelProps {
  getScore: () => RhythmGameScore;
}

const POLL_INTERVAL_MS = 200;

export const RhythmGameScorePanel: React.FC<RhythmGameScorePanelProps> = ({
  getScore,
}) => {
  const [score, setScore] = useState<RhythmGameScore>(() => getScore());

  useEffect(() => {
    const id = setInterval(() => {
      setScore(getScore());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [getScore]);

  return (
    <div className={styles["rhythm-game-score-panel"]}>
      <div className={styles["rhythm-game-score-panel-content"]}>
        <div className={styles["rhythm-game-score-panel-label"]}>
          <FontAwesomeIcon icon={solid.faMusic} />
          <span>Rhythm Game Score</span>
        </div>

        <div className={styles["rhythm-game-score-panel-value"]}>
          <strong>{score.accuracy}%</strong> Accuracy
          <strong>{score.perfect}</strong> Perfect
          <strong>{score.good}</strong> Good
          (<strong>{score.earlyGood}</strong> Early
          / <strong>{score.lateGood}</strong> Late)
          <strong>{score.missed}</strong> Missed
          <strong>{score.errors}</strong> Errors
          <strong>{score.streak}</strong> Streak
          <strong>{score.maxStreak}</strong> Max Streak
          <strong>{score.totalNotes}</strong> Total Notes
        </div>
      </div>
    </div>
  );
};
