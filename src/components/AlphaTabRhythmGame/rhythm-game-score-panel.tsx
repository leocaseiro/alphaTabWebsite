"use client";

import type React from "react";
import { useState, useEffect } from "react";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { type RhythmGameScore, getAccuracyTier } from "./useRhythmGameScore";

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

  const hits = score.perfect + score.earlyGood + score.lateGood;
  const hasPlayed = score.totalNotes > 0 || score.errors > 0;
  const tier = hasPlayed ? getAccuracyTier(score.accuracy) : undefined;

  return (
    <div className={styles["score-panel"]}>
      <div className={styles["score-panel-header"]}>
        <span className={styles["score-panel-header-title"]}>
          <FontAwesomeIcon icon={solid.faMusic} />
          Score Mode
        </span>
        <span className={styles["score-panel-header-notes"]}>
          {hits} / {score.totalNotes}
        </span>
      </div>

      <div className={styles["score-panel-main"]}>
        <div className={styles["score-panel-stat"]}>
          <span className={styles["score-panel-label"]}>Score</span>
          <span className={styles["score-panel-value"]} data-tier={tier}>{score.perfect * 100 + score.earlyGood * 50 + score.lateGood * 50}</span>
        </div>
        <div className={styles["score-panel-stat"]}>
          <span className={styles["score-panel-label"]}>Accuracy</span>
          <span className={styles["score-panel-value"]} data-tier={tier}>{score.accuracy}%</span>
        </div>
        <div className={styles["score-panel-stat"]}>
          <span className={styles["score-panel-label"]}>Streak</span>
          <span className={styles["score-panel-value"]} data-tier={tier}>{score.streak}</span>
        </div>
        <div className={styles["score-panel-stat"]}>
          <span className={styles["score-panel-label"]}>Max Streak</span>
          <span className={styles["score-panel-value"]}>{score.maxStreak}</span>
        </div>
      </div>

      <div className={styles["score-panel-details"]}>
        <div className={styles["score-panel-detail"]}>
          <span className={styles["score-panel-detail-label"]}>Perfect</span>
          <span className={styles["score-panel-detail-value"]} data-type="perfect">{score.perfect}</span>
        </div>
        <div className={styles["score-panel-detail"]}>
          <span className={styles["score-panel-detail-label"]}>Good</span>
          <span className={styles["score-panel-detail-value"]} data-type="good">{score.good}</span>
        </div>
        <div className={styles["score-panel-detail"]}>
          <span className={styles["score-panel-detail-label"]}>Early</span>
          <span className={styles["score-panel-detail-value"]} data-type="early">{score.earlyGood}</span>
        </div>
        <div className={styles["score-panel-detail"]}>
          <span className={styles["score-panel-detail-label"]}>Late</span>
          <span className={styles["score-panel-detail-value"]} data-type="late">{score.lateGood}</span>
        </div>
        <div className={styles["score-panel-detail"]}>
          <span className={styles["score-panel-detail-label"]}>Miss</span>
          <span className={styles["score-panel-detail-value"]} data-type="miss">{score.missed}</span>
        </div>
        <div className={styles["score-panel-detail"]}>
          <span className={styles["score-panel-detail-label"]}>Errors</span>
          <span className={styles["score-panel-detail-value"]} data-type="error">{score.errors}</span>
        </div>
      </div>
    </div>
  );
};
