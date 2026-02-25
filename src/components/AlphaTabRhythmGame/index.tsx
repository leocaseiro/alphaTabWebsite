"use client";

import * as alphaTab from "@coderline/alphatab";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAlphaTab, useAlphaTabEvent } from "@site/src/hooks";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { openFile } from "@site/src/utils";
import {
  BottomPanel,
  PlayerControlsGroup,
  SidePanel,
} from "./player-controls-group";
import { PlaygroundSettings } from "./playground-settings";
import { PracticeModeSettings } from "./practice-mode-settings";
import { MidiMappingSettings } from "./midi-mapping-settings";
import { Tooltip } from "react-tooltip";
import { PlaygroundTrackSelector } from "./track-selector";
import { MediaSyncEditor } from "./media-sync-editor";
import { BpmRangeControlPanel } from "./bpm-range-control";
import {
  type HTMLMediaElementLike,
  MediaType,
  type MediaTypeState,
} from "./helpers";
import { YouTubePlayer } from "./youtube-player";
import { CrossMarkersManager, useCrossMarkers } from "./cross-markers";
import { MidiRhythmGame } from "./MidiRhythmGame";
import { MidiMappingProvider } from "./midi-mapping-context";
import { RhythmGameScorePanel } from "./rhythm-game-score-panel";
import { useRhythmGameScore, type HitResult } from "./useRhythmGameScore";

const AlphaTabRhythmGameContent: React.FC = () => {
  const viewPortRef = React.createRef<HTMLDivElement>();
  const [isLoading, setLoading] = useState(true);
  const [sidePanel, setSidePanel] = useState(SidePanel.None);
  const [bottomPanel, setBottomPanel] = useState(BottomPanel.None);
  const [mediaType, setMediaType] = useState<MediaTypeState>({
    type: MediaType.Synth,
  });
  const youtubePlayer = useRef<HTMLMediaElementLike | null>(null);
  const { markers, addMarker, clearMarkers } = useCrossMarkers();
  const { scoreRef, recordHit, resetScore, getScore } = useRhythmGameScore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // Suppress ResizeObserver errors in development mode
  // These errors don't block functionality but can be noisy during development
  useEffect(() => {
    const originalError = console.error;
    const handleError = (message: string | Error, ...args: unknown[]) => {
      if (
        typeof message === "string" &&
        message.includes(
          "ResizeObserver loop completed with undelivered notifications",
        )
      ) {
        return; // Suppress this specific error
      }
      if (
        message instanceof Error &&
        message.message?.includes(
          "ResizeObserver loop completed with undelivered notifications",
        )
      ) {
        return; // Suppress this specific error
      }
      originalError(message, ...args);
    };

    console.error = handleError;

    return () => {
      console.error = originalError;
    };
  }, []);

  // Memoize marker callbacks for MIDI game to avoid recreating on every render
  const handleAddCircleMarker = useCallback(
    (
      beatBounds: alphaTab.rendering.BeatBounds,
      staffLineIndex: number,
      timingOffset?: number,
      nextBeatBounds?: alphaTab.rendering.BeatBounds,
      note?: alphaTab.model.Note,
      startTick?: number,
      hitResult?: HitResult,
    ) => {
      addMarker(
        beatBounds,
        staffLineIndex,
        timingOffset,
        nextBeatBounds,
        "circle",
        note,
        startTick,
        hitResult,
      );
    },
    [addMarker],
  );

  const handleAddCrossMarker = useCallback(
    (
      beatBounds: alphaTab.rendering.BeatBounds,
      staffLineIndex: number,
      timingOffset?: number,
      nextBeatBounds?: alphaTab.rendering.BeatBounds,
      note?: alphaTab.model.Note,
      startTick?: number,
    ) => {
      addMarker(
        beatBounds,
        staffLineIndex,
        timingOffset,
        nextBeatBounds,
        "cross",
        note,
        startTick,
      );
    },
    [addMarker],
  );

  const [api, element] = useAlphaTab((s) => {
    s.core.engine = "svg";
    s.core.file = "/files/guitar-pro-rock-beat-repeat.gp";
    // Don't specify tracks here - let it load all tracks first
    // s.core.tracks = [0, 1];
    s.core.includeNoteBounds = true; // Enable note bounds for precise positioning
    s.player.scrollElement = viewPortRef.current!;
    s.player.scrollMode = alphaTab.ScrollMode.Smooth;
    s.player.scrollOffsetY = -10;
    s.player.scrollOffsetX = -300;
    s.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
    s.display.layoutMode = alphaTab.LayoutMode.Horizontal;
    s.player.playTripletFeel = false; // disable Play Swing
  });

  useAlphaTabEvent(api, "renderFinished", () => {
    setLoading(false);
  });

  // Add error handler
  useAlphaTabEvent(api, "error", (error) => {
    console.error("AlphaTab Error:", error);
    setLoading(false);
  });

  useAlphaTabEvent(api, "scoreLoaded", (score) => {
    // Log track information for debugging
    console.log("Score loaded:", {
      title: score.title,
      artist: score.artist,
      trackCount: score.tracks.length,
      tracks: score.tracks.map((t, i) => ({
        index: i,
        name: t.name,
        staves: t.staves.length,
      })),
    });

    if (score.backingTrack?.rawAudioFile) {
      setMediaType({
        type: MediaType.Audio,
        audioFile: score.backingTrack!.rawAudioFile,
      });
    } else {
      setMediaType({
        type: MediaType.Synth,
      });
    }
  });

  // Track playback state
  useAlphaTabEvent(api, "playerStateChanged", (e) => {
    setIsPlaying(e.state === alphaTab.synth.PlayerState.Playing);
  });

  // Track current tick and time for rhythm game
  useAlphaTabEvent(api, "playerPositionChanged", (e) => {
    setCurrentTick(e.currentTick);
    setCurrentTimeMs(e.currentTime);
  });

  const onDragOver = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "link";
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.dataTransfer) {
      const files = e.dataTransfer.files;
      if (files.length === 1) {
        openFile(api!, files[0]);
      }
    }
  };

  const youtubePlayerUnsubscribe = useRef<() => void>(null);
  const setYoutubePlayer = useCallback(
    (newPlayer: HTMLMediaElementLike) => {
      if (youtubePlayerUnsubscribe.current) {
        youtubePlayerUnsubscribe.current();
        youtubePlayerUnsubscribe.current = null;
      }

      if (newPlayer && api) {
        youtubePlayer.current = newPlayer;

        const onLoadedMetadata = () => {
          setMediaType((t) => ({
            ...t,
            youtubeVideoDuration: newPlayer.duration * 1000,
          }));
        };
        const onTimeUpdate = () => {
          if (
            api!.actualPlayerMode === alphaTab.PlayerMode.EnabledExternalMedia
          ) {
            (
              api!.player!.output as alphaTab.synth.IExternalMediaSynthOutput
            ).updatePosition(newPlayer.currentTime * 1000);
          }
        };

        const onPlay = () => {
          api.play();
        };
        const onPause = () => {
          api.pause();
        };

        const onEnded = () => {
          api.pause();
        };

        const onVolumeChange = () => {
          api.masterVolume = newPlayer.volume;
        };

        const onRateChange = () => {
          api.playbackSpeed = newPlayer.playbackRate;
        };

        newPlayer.addEventListener("loadedmetadata", onLoadedMetadata);
        newPlayer.addEventListener("timeupdate", onTimeUpdate);
        newPlayer.addEventListener("seeked", onTimeUpdate);
        newPlayer.addEventListener("play", onPlay);
        newPlayer.addEventListener("pause", onPause);
        newPlayer.addEventListener("ended", onEnded);
        newPlayer.addEventListener("volumechange", onVolumeChange);
        newPlayer.addEventListener("ratechange", onRateChange);

        youtubePlayerUnsubscribe.current = () => {
          newPlayer.removeEventListener("loadedmetadata", onLoadedMetadata);
          newPlayer.removeEventListener("timeupdate", onTimeUpdate);
          newPlayer.removeEventListener("seeked", onTimeUpdate);
          newPlayer.removeEventListener("play", onPlay);
          newPlayer.removeEventListener("pause", onPause);
          newPlayer.removeEventListener("ended", onEnded);
          newPlayer.removeEventListener("volumechange", onVolumeChange);
          newPlayer.removeEventListener("ratechange", onRateChange);
        };
      }
    },
    [api],
  );

  useEffect(() => {
    if (!api) {
      return;
    }
    api.pause();
    switch (mediaType.type) {
      case MediaType.Synth:
        api.settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
        api.updateSettings();
        break;

      case MediaType.Audio:
        api.settings.player.playerMode =
          alphaTab.PlayerMode.EnabledBackingTrack;
        api.updateSettings();

        break;

      case MediaType.YouTube:
        api.settings.player.playerMode =
          alphaTab.PlayerMode.EnabledExternalMedia;
        api.updateSettings();

        const handler: alphaTab.synth.IExternalMediaHandler = {
          get backingTrackDuration() {
            const duration = youtubePlayer.current?.duration ?? 0;
            return Number.isFinite(duration) ? duration * 1000 : 0;
          },
          get playbackRate() {
            return youtubePlayer.current?.duration ?? 1;
          },
          set playbackRate(value) {
            if (youtubePlayer.current) {
              youtubePlayer.current.playbackRate = value;
            }
          },
          get masterVolume() {
            return youtubePlayer.current?.volume ?? 1;
          },
          set masterVolume(value) {
            if (youtubePlayer.current) {
              youtubePlayer.current.volume = value;
            }
          },
          seekTo(time) {
            if (youtubePlayer.current) {
              youtubePlayer.current.currentTime = time / 1000;
            }
          },
          play() {
            if (youtubePlayer.current) {
              youtubePlayer.current.play();
            }
          },
          pause() {
            if (youtubePlayer.current) {
              youtubePlayer.current.pause();
            }
          },
        };

        (
          api.player!.output as alphaTab.synth.IExternalMediaSynthOutput
        ).handler = handler;

        break;
    }
  }, [api, mediaType.type]);

  return (
    <>
      <div
        className={styles["at-wrap"]}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {isLoading && (
          <div className={styles["at-overlay"]}>
            <div className={styles["at-overlay-content"]}>
              <FontAwesomeIcon icon={solid.faSpinner} size="2x" spin={true} />
            </div>
          </div>
        )}

        {api && api?.score && (
          <PlaygroundSettings
            api={api}
            onClose={() => setSidePanel(SidePanel.None)}
            isOpen={sidePanel === SidePanel.Settings}
          />
        )}

        {api && api?.score && (
          <PracticeModeSettings
            api={api}
            onClose={() => setSidePanel(SidePanel.None)}
            isOpen={sidePanel === SidePanel.Practice}
          />
        )}

        {api && api?.score && (
          <MidiMappingSettings
            isOpen={sidePanel === SidePanel.MidiMapping}
            onClose={() => setSidePanel(SidePanel.None)}
          />
        )}

        {api && api?.score && (
          <PlaygroundTrackSelector
            api={api}
            onClose={() => setSidePanel(SidePanel.None)}
            isOpen={sidePanel === SidePanel.TrackSelector}
          />
        )}

        <div className={styles["at-content"]}>
          <div className={styles["at-viewport"]} ref={viewPortRef}>
            <div ref={element} />
          </div>

          {mediaType.type === MediaType.YouTube && (
            <div className={styles.video}>
              <YouTubePlayer
                ref={setYoutubePlayer}
                src={mediaType.youtubeUrl!}
              />
            </div>
          )}
        </div>

        <CrossMarkersManager
          api={api ?? null}
          element={element}
          markers={markers}
        />

        {/* MIDI Rhythm Game Integration */}
        <MidiRhythmGame
          api={api ?? null}
          isPlaying={isPlaying}
          currentTick={currentTick}
          currentTimeMs={currentTimeMs}
          onAddCircleMarker={handleAddCircleMarker}
          onAddCrossMarker={handleAddCrossMarker}
          onClearMarkers={clearMarkers}
          recordHit={recordHit}
          resetScore={resetScore}
          getScore={getScore}
        />

        <div className={styles["at-footer"]}>
          {api && api?.score && bottomPanel === BottomPanel.MediaSyncEditor && (
            <MediaSyncEditor
              api={api}
              score={api!.score}
              mediaType={mediaType}
              onMediaTypeChange={(t) => setMediaType(t)}
              youtubePlayer={youtubePlayer.current ?? undefined}
            />
          )}
          {api && api?.score && bottomPanel === BottomPanel.BpmControl && (
            <BpmRangeControlPanel
              api={api}
              onSpeedChange={(newSpeed) => {
                api.playbackSpeed = newSpeed;
                api.updateSettings();
              }}
            />
          )}
          {api && api?.score && bottomPanel === BottomPanel.RhythmGameScore && (
            <RhythmGameScorePanel getScore={getScore} />
          )}
          {api && (
            <PlayerControlsGroup
              api={api}
              viewPortRef={viewPortRef}
              sidePanel={sidePanel}
              onSidePanelChange={setSidePanel}
              bottomPanel={bottomPanel}
              onBottomPanelChange={setBottomPanel}
              onAddCrossMarker={(
                beatBounds,
                staffLineIndex,
                timingOffset,
                nextBeatBounds,
              ) =>
                addMarker(
                  beatBounds,
                  staffLineIndex,
                  timingOffset,
                  nextBeatBounds,
                  "cross",
                )
              }
              onAddCircleMarker={(
                beatBounds,
                staffLineIndex,
                timingOffset,
                nextBeatBounds,
                note,
              ) =>
                addMarker(
                  beatBounds,
                  staffLineIndex,
                  timingOffset,
                  nextBeatBounds,
                  "circle",
                  note,
                )
              }
              onClearMarkers={clearMarkers}
            />
          )}
        </div>
      </div>
      <Tooltip
        anchorSelect="[data-tooltip-content]"
        id="tooltip-playground"
        style={{ zIndex: 1200 }}
      />
    </>
  );
};

export const AlphaTabRhythmGame: React.FC = () => {
  return (
    <MidiMappingProvider>
      <AlphaTabRhythmGameContent />
    </MidiMappingProvider>
  );
};
