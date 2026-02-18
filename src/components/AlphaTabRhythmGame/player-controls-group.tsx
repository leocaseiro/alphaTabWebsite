import * as alphaTab from "@coderline/alphatab";
import type React from "react";
import { useEffect, useState } from "react";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { useAlphaTabEvent } from "@site/src/hooks";
import { openFile, openInputFile } from "@site/src/utils";
import { PlayerProgressIndicator } from "../AlphaTabFull/player-progress-indicator";
import { addTimingFeedbackMarker } from "./rhythm-game-helpers";
import {
  addSuccessMarkersForAllNotes,
  addSuccessMarkersForMatchedNotes,
} from "./circle-marker-helpers";

export interface PlayerControlsGroupProps {
  sidePanel: SidePanel;
  onSidePanelChange: (sidePanel: SidePanel) => void;
  bottomPanel: BottomPanel;
  onBottomPanelChange: (sidePanel: BottomPanel) => void;
  api: alphaTab.AlphaTabApi;
  onAddCrossMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
  ) => void;
  onAddCircleMarker: (
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    note?: alphaTab.model.Note,
  ) => void;
  onClearMarkers: () => void;
}

export enum SidePanel {
  None = 0,
  Settings = 1,
  TrackSelector = 2,
}

export enum BottomPanel {
  None = 0,
  MediaSyncEditor = 1,
}

export const PlayerControlsGroup: React.FC<PlayerControlsGroupProps> = ({
  api,
  sidePanel,
  onSidePanelChange,
  bottomPanel,
  onBottomPanelChange,
  onAddCrossMarker,
  onAddCircleMarker,
  onClearMarkers,
}) => {
  const [soundFontLoadPercentage, setSoundFontLoadPercentage] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isMetronome, setIsMetronome] = useState(0);
  const [layout, setLayout] = useState(alphaTab.LayoutMode.Horizontal);
  const [countInVolume, setCountInVolume] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [endTime, setEndTime] = useState(1);
  const [currentTick, setCurrentTick] = useState(0);

  useEffect(() => {
    api.isLooping = isLooping;
    api.updateSettings();
  }, [api, isLooping]);

  useEffect(() => {
    api.countInVolume = countInVolume;
    api.updateSettings();
  }, [api, countInVolume]);

  useEffect(() => {
    api.metronomeVolume = isMetronome;
    api.updateSettings();
  }, [api, isMetronome]);

  useEffect(() => {
    api.settings.display.layoutMode = layout;
    if (layout === alphaTab.LayoutMode.Horizontal) {
      api.settings.player.scrollMode = alphaTab.ScrollMode.Smooth;
    } else {
      api.settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
    }
    api.updateSettings();
    api.render();
  }, [api, layout]);

  useAlphaTabEvent(api, "soundFontLoad", (e) => {
    setSoundFontLoadPercentage(e.loaded / e.total);
  });

  useAlphaTabEvent(api, "soundFontLoaded", () => {
    setSoundFontLoadPercentage(1);
  });
  useAlphaTabEvent(api, "playerStateChanged", (e) => {
    setPlaying(e.state === alphaTab.synth.PlayerState.Playing);
  });
  useAlphaTabEvent(api, "playerPositionChanged", (e) => {
    // reduce number of UI updates to second changes.
    const previousCurrentSeconds = (currentTime / 1000) | 0;
    const newCurrentSeconds = (e.currentTime / 1000) | 0;

    if (
      e.endTime === endTime &&
      (previousCurrentSeconds === newCurrentSeconds || newCurrentSeconds === 0)
    ) {
      return;
    }

    setEndTime(e.endTime);
    setCurrentTime(e.currentTime);
    setCurrentTick(e.currentTick);
  });

  const formatDuration = (milliseconds: number) => {
    let seconds = milliseconds / 1000;
    const minutes = (seconds / 60) | 0;
    seconds = (seconds - minutes * 60) | 0;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <>
      <div className={styles["at-time-slider"]}>
        <div
          className={styles["at-time-slider-value"]}
          style={{
            width: `${((currentTime / endTime) * 100).toFixed(2)}%`,
          }}
        />
      </div>
      <div className={styles["at-player"]}>
        <div className={styles["at-player-left"]}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              openInputFile(api);
            }}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Open File"
          >
            <FontAwesomeIcon icon={solid.faFolderOpen} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              api.stop();
              onClearMarkers(); // Clear markers when stopping
            }}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Stop"
          >
            <FontAwesomeIcon icon={solid.faStop} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              // If currently stopped, clear markers before playing
              if (!isPlaying) {
                onClearMarkers();
              }
              api.playPause();
            }}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Play/Pause"
            className={`${api.isReadyForPlayback ? "" : " disabled"}`}
          >
            <FontAwesomeIcon icon={isPlaying ? solid.faPause : solid.faPlay} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsLooping(!isLooping);
            }}
            data-tooltip-id="tooltip-looping"
            data-tooltip-content={`${isLooping ? "Disable" : "Enable"} looping`}
          >
            <FontAwesomeIcon
              className={!isLooping ? styles["fa-disabled"] : ""}
              icon={solid.faRepeat}
            />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setCountInVolume(countInVolume === 1 ? 0 : 1);
            }}
            data-tooltip-id="tooltip-count-in"
            data-tooltip-content={`${countInVolume === 1 ? "Disable" : "Enable"} count in`}
          >
            <FontAwesomeIcon
              className={countInVolume === 0 ? styles["fa-disabled"] : ""}
              icon={solid.faStopwatch}
            />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsMetronome(isMetronome === 1 ? 0 : 1);
            }}
            data-tooltip-id="tooltip-metronome"
            data-tooltip-content={`${isMetronome === 1 ? "Disable" : "Enable"} metronome`}
          >
            <FontAwesomeIcon
              className={isMetronome === 0 ? styles["fa-disabled"] : ""}
              icon={solid.faTachometer}
            />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setLayout(
                layout === alphaTab.LayoutMode.Horizontal
                  ? alphaTab.LayoutMode.Page
                  : alphaTab.LayoutMode.Horizontal,
              );
            }}
            data-tooltip-id="tooltip-count-in-volume"
            data-tooltip-content={`Set layout to ${layout === alphaTab.LayoutMode.Horizontal ? "vertical" : "horizontal"}`}
          >
            <FontAwesomeIcon
              icon={
                solid[
                  layout === alphaTab.LayoutMode.Horizontal
                    ? "faEllipsis"
                    : "faEllipsisVertical"
                ]
              }
            />
          </button>

          {/* <button
            type="button"
            disabled={!isPlaying}
            onClick={(e) => {
              e.preventDefault();

              // Rhythm game: Add marker with precise timing
              const feedback = addTimingFeedbackMarker(
                api,
                currentTick,
                -1, // Mark on 1st string
                onAddCrossMarker,
              );

              if (feedback) {
                console.log("Rhythm Game Feedback:", {
                  timing: feedback.timing,
                  timingOffset: feedback.timingOffset.toFixed(3),
                  isOnBeat: feedback.isOnBeat,
                  trackName: feedback.beat.voice.bar.staff.track.name,
                  barIndex: feedback.beat.voice.bar.index,
                  beatIndex: feedback.beat.index,
                  notes: feedback.beat.notes.map((n) => ({
                    string: n.string,
                    fret: n.fret,
                  })),
                });
              }
            }}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Add Cross (Rhythm Game)"
          >
            <FontAwesomeIcon icon={solid.faX} />
          </button> */}

          {/* <button
            type="button"
            disabled={!isPlaying}
            onClick={(e) => {
              e.preventDefault();

              // EXAMPLE 2: Simulate player input (for rhythm game)
              // Replace this with actual player input from MIDI/keyboard
              const playerInputs = [
                { midiNote: 42 }, // Player hit MIDI note 42 (closed hi-hat)
                { midiNote: 38 }, // Player hit MIDI note 42 (closed hi-hat)
              ];

              const result = addSuccessMarkersForMatchedNotes(
                api,
                currentTick,
                playerInputs,
                onAddCircleMarker,
                // No cross marker callback - circles only for correct hits
              );

              console.log("Rhythm Game Result:", {
                matched: result.matchedNotes.map((n) => ({
                  string: n.string,
                  fret: n.fret,
                })),
                missed: result.missedNotes.map((n) => ({
                  string: n.string,
                  fret: n.fret,
                })),
                wrong: result.wrongInputs,
                score: `${result.matchedNotes.length}/${result.matchedNotes.length + result.missedNotes.length}`,
              });
            }}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Add Circle (Success)"
          >
            <FontAwesomeIcon icon={solid.faCircle} />
          </button> */}

          <PlayerProgressIndicator percentage={soundFontLoadPercentage} />

          {api.score && (
            <div className={styles["at-song-details"]}>
              <span className={styles["at-song-title"]}>{api.score.title}</span>
              <span> - </span>
              <span className={styles["at-song-artist"]}>
                {api.score.artist}
              </span>
            </div>
          )}

          <div className={styles["at-time-position"]}>
            {formatDuration(currentTime)} / {formatDuration(endTime)}
          </div>
        </div>

        <div className={styles["at-player-right"]}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (bottomPanel === BottomPanel.MediaSyncEditor) {
                onBottomPanelChange(BottomPanel.None);
              } else {
                onBottomPanelChange(BottomPanel.MediaSyncEditor);
              }
            }}
            className={
              bottomPanel === BottomPanel.MediaSyncEditor ? styles.active : ""
            }
          >
            <FontAwesomeIcon icon={solid.faTimeline} /> Media Sync
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (sidePanel === SidePanel.TrackSelector) {
                onSidePanelChange(SidePanel.None);
              } else {
                onSidePanelChange(SidePanel.TrackSelector);
              }
            }}
            className={
              sidePanel === SidePanel.TrackSelector ? styles.active : ""
            }
          >
            <FontAwesomeIcon icon={solid.faListCheck} /> Tracks
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (sidePanel === SidePanel.Settings) {
                onSidePanelChange(SidePanel.None);
              } else {
                onSidePanelChange(SidePanel.Settings);
              }
            }}
            className={sidePanel === SidePanel.Settings ? styles.active : ""}
          >
            <FontAwesomeIcon icon={solid.faGear} /> Settings
          </button>
        </div>
      </div>
    </>
  );
};
