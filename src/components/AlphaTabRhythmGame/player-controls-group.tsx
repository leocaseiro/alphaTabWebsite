import * as alphaTab from "@coderline/alphatab";
import type React from "react";
import { useEffect, useRef, useState } from "react";
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
import { settingsSyncEmitter } from "./settings-sync";

const BPM_DEFAULT = 120; // Fallback if score BPM unavailable

export interface PlayerControlsGroupProps {
  sidePanel: SidePanel;
  onSidePanelChange: (sidePanel: SidePanel) => void;
  bottomPanel: BottomPanel;
  onBottomPanelChange: (sidePanel: BottomPanel) => void;
  api: alphaTab.AlphaTabApi;
  viewPortRef?: React.RefObject<HTMLDivElement | null>;
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
  Practice = 2,
  TrackSelector = 3,
  MidiMapping = 4,
}

export enum BottomPanel {
  None = 0,
  MediaSyncEditor = 1,
  BpmControl = 2,
  RhythmGameScore = 3,
}

export const PlayerControlsGroup: React.FC<PlayerControlsGroupProps> = ({
  api,
  viewPortRef,
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
  const [isLooping, setIsLooping] = useState(api.isLooping);
  const [isMetronome, setIsMetronome] = useState(api.metronomeVolume);
  const [layout, setLayout] = useState(api.settings.display.layoutMode);
  const [countInVolume, setCountInVolume] = useState(api.countInVolume);
  const [currentTime, setCurrentTime] = useState(0);
  const [endTime, setEndTime] = useState(1);
  const [currentTick, setCurrentTick] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(api.playbackSpeed);
  const layoutChangeRef = useRef(false);

  // Listen for settings changes from the UI (but not from PlayerControls changes)
  useEffect(() => {
    const unsubscribe = settingsSyncEmitter.subscribe((source) => {
      if (source !== "playerControls") {
        setCountInVolume(api.countInVolume);
        setIsMetronome(api.metronomeVolume);
        setLayout(api.settings.display.layoutMode);
        setIsLooping(api.isLooping);
      }
    });

    return unsubscribe;
  }, [api]);

  useEffect(() => {
    api.isLooping = isLooping;
    api.updateSettings();
    settingsSyncEmitter.notify("playerControls");
  }, [api, isLooping]);

  useEffect(() => {
    api.countInVolume = countInVolume;
    api.updateSettings();
    settingsSyncEmitter.notify("playerControls");
  }, [api, countInVolume]);

  useEffect(() => {
    api.metronomeVolume = isMetronome;
    api.updateSettings();
    settingsSyncEmitter.notify("playerControls");
  }, [api, isMetronome]);

  useEffect(() => {
    api.playbackSpeed = playbackSpeed;
    api.updateSettings();
    settingsSyncEmitter.notify("playerControls");
  }, [api, playbackSpeed]);

  useEffect(() => {
    api.settings.display.layoutMode = layout;
    if (layout === alphaTab.LayoutMode.Horizontal) {
      api.settings.player.scrollMode = alphaTab.ScrollMode.Smooth;
    } else {
      api.settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
      // Reset scroll position when switching to vertical layout
      layoutChangeRef.current = true;
      // Immediately reset scroll positions
      if (viewPortRef?.current) {
        viewPortRef.current.scrollLeft = 0;
      }
      if (api.container) {
        api.container.scrollLeft = 0;
      }
      // Also reset after a short delay to ensure DOM has updated
      setTimeout(() => {
        if (viewPortRef?.current) {
          viewPortRef.current.scrollLeft = 0;
        }
        if (api.container) {
          api.container.scrollLeft = 0;
        }
        window.scrollTo(0, window.scrollY);
      }, 100);
    }
    api.updateSettings();
    api.render();
    settingsSyncEmitter.notify("playerControls");
  }, [api, layout]);

  useAlphaTabEvent(api, "renderFinished", () => {
    console.log("finished render");
    if (layoutChangeRef.current) {
      // Reset scroll position for both the alphaTab container and the viewport
      api.container.scrollLeft = 0;
      if (viewPortRef?.current) {
        viewPortRef.current.scrollLeft = 0;
      }
      // Also try scrolling the window if needed
      window.scrollTo(0, window.scrollY);
      layoutChangeRef.current = false;
    }
  });

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
              if (bottomPanel === BottomPanel.BpmControl) {
                onBottomPanelChange(BottomPanel.None);
              } else {
                onBottomPanelChange(BottomPanel.BpmControl);
              }
            }}
            data-tooltip-id="tooltip-bpm-control"
            data-tooltip-content="BPM Control"
            className={
              bottomPanel === BottomPanel.BpmControl ? styles.active : ""
            }
          >
            <FontAwesomeIcon icon={solid.faMusic} />{" "}
            {Math.round((api.score?.tempo ?? BPM_DEFAULT) * api.playbackSpeed)}{" "}
            BPM
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

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (bottomPanel === BottomPanel.RhythmGameScore) {
                onBottomPanelChange(BottomPanel.None);
              } else {
                onBottomPanelChange(BottomPanel.RhythmGameScore);
              }
            }}
            data-tooltip-id="tooltip-rhythm-game-score"
            data-tooltip-content="Rhythm Game Score"
            className={
              bottomPanel === BottomPanel.RhythmGameScore ? styles.active : ""
            }
          >
            <FontAwesomeIcon icon={solid.faGamepad} /> Rhythm Game Score
          </button>

          <PlayerProgressIndicator percentage={soundFontLoadPercentage} />

          {api.score && (
            <div className={styles["at-song-details"]}>
              {/* <span className={styles["at-song-title"]}>{api.score.title}</span> */}
              <span className={styles["at-song-title"]}>Some Song here</span>
              <span> - </span>
              <span className={styles["at-song-artist"]}>
                {/* {api.score.artist} */}
                {/* {api.score.artist} */}
                Some Artist here
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
              if (sidePanel === SidePanel.Practice) {
                onSidePanelChange(SidePanel.None);
              } else {
                onSidePanelChange(SidePanel.Practice);
              }
            }}
            className={sidePanel === SidePanel.Practice ? styles.active : ""}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="Practice Mode Settings"
          >
            <FontAwesomeIcon icon={solid.faHeadphones} /> Practice
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (sidePanel === SidePanel.MidiMapping) {
                onSidePanelChange(SidePanel.None);
              } else {
                onSidePanelChange(SidePanel.MidiMapping);
              }
            }}
            className={sidePanel === SidePanel.MidiMapping ? styles.active : ""}
            data-tooltip-id="tooltip-playground"
            data-tooltip-content="MIDI Mapping Settings"
          >
            <FontAwesomeIcon icon={solid.faMusic} /> MIDI
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
