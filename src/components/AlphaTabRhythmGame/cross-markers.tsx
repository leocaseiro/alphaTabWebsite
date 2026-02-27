"use client";

import * as alphaTab from "@coderline/alphatab";
import { useEffect, useRef, useCallback } from "react";
import type { HitResult } from "./useRhythmGameScore";

export interface CrossMarker {
  id: string;
  type: "cross" | "circle";
  beatBounds: alphaTab.rendering.BeatBounds;
  staffLineIndex: number;
  timingOffset?: number;
  nextBeatBounds?: alphaTab.rendering.BeatBounds;
  note?: alphaTab.model.Note;
  beatId?: string;
  hitResult?: HitResult;
}

/**
 * Imperative drawing interface exposed by CrossMarkersManager so that
 * useCrossMarkers can draw/clear SVG markers without triggering React
 * re-renders.
 */
export interface MarkerDrawer {
  drawMarker: (marker: CrossMarker) => void;
  clearAll: () => void;
}

export interface CrossMarkersManagerProps {
  api: alphaTab.AlphaTabApi | null;
  element: React.RefObject<HTMLDivElement | null>;
  markersRef: React.MutableRefObject<CrossMarker[]>;
  drawerRef: React.MutableRefObject<MarkerDrawer | null>;
}

/**
 * Manages an independent overlay SVG for rendering hit/error markers.
 *
 * PERFORMANCE: This component never re-renders during gameplay. All marker
 * drawing is driven imperatively via `drawerRef` (set by this component,
 * consumed by `useCrossMarkers`). The only React effect dependency is `api`.
 */
export const CrossMarkersManager: React.FC<CrossMarkersManagerProps> = ({
  api,
  element,
  markersRef,
  drawerRef,
}) => {
  const overlaySvgRef = useRef<SVGSVGElement | null>(null);
  const markersGroupRef = useRef<SVGGElement | null>(null);
  const renderedMarkersRef = useRef<Set<string>>(new Set());
  // Cache the container DOM element in a stable ref.  `useAlphaTab` returns
  // React.createRef() which changes identity every render — the old ref's
  // .current gets nulled by React, breaking closures that captured it.
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Ensure the overlay SVG exists and is attached to the container.
   * When `syncDimensions` is true, reads layout properties to size the
   * overlay — only pass true on creation and `renderFinished`.
   */
  const ensureOverlay = (syncDimensions: boolean): SVGGElement | null => {
    const container = containerRef.current ?? element.current;
    if (!container) return null;
    containerRef.current = container;

    if (!overlaySvgRef.current) {
      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      svg.setAttribute("overflow", "visible");
      svg.style.position = "absolute";
      svg.style.left = "0";
      svg.style.top = "0";
      svg.style.pointerEvents = "none";
      svg.style.zIndex = "10";

      const g = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
      );
      g.setAttribute("class", "cross-markers");
      svg.appendChild(g);

      overlaySvgRef.current = svg;
      markersGroupRef.current = g;
      syncDimensions = true;

      if (process.env.NODE_ENV === "development") {
        console.log("[CrossMarkers] Created overlay SVG");
      }
    }

    if (syncDimensions) {
      const surface =
        (container.querySelector(".at-surface") as HTMLElement) ?? null;
      const sizeSource = surface ?? container;
      const w = sizeSource.offsetWidth || sizeSource.scrollWidth || 5000;
      const h = sizeSource.offsetHeight || sizeSource.scrollHeight || 500;
      overlaySvgRef.current.setAttribute("width", String(w));
      overlaySvgRef.current.setAttribute("height", String(h));
    }

    if (!container.style.position) {
      container.style.position = "relative";
    }

    if (!container.contains(overlaySvgRef.current)) {
      container.appendChild(overlaySvgRef.current);
      if (process.env.NODE_ENV === "development") {
        console.log("[CrossMarkers] Attached overlay to container");
      }
    }

    return markersGroupRef.current;
  };

  // Register imperative drawer + listen to renderFinished
  useEffect(() => {
    if (!api) return;

    ensureOverlay(true);

    drawerRef.current = {
      drawMarker: (marker: CrossMarker) => {
        const group = ensureOverlay(false);
        if (!group) return;
        if (renderedMarkersRef.current.has(marker.id)) return;

        if (marker.type === "cross") {
          drawCrossMarker(group, marker, api);
        } else {
          drawCircleMarker(group, marker, api);
        }
        renderedMarkersRef.current.add(marker.id);
      },
      clearAll: () => {
        const group = markersGroupRef.current;
        if (group) {
          while (group.firstChild) group.removeChild(group.firstChild);
        }
        renderedMarkersRef.current.clear();
      },
    };

    const onRenderFinished = () => {
      const group = ensureOverlay(true);
      if (!group) return;

      while (group.firstChild) group.removeChild(group.firstChild);
      renderedMarkersRef.current.clear();

      const markers = markersRef.current;
      if (process.env.NODE_ENV === "development") {
        console.log(
          `Redrawing ${markers.length} markers after re-render`,
        );
      }

      for (const marker of markers) {
        let drawMarker = marker;
        if (api.boundsLookup) {
          const freshBounds = api.boundsLookup.findBeat(
            marker.beatBounds.beat,
          );
          if (freshBounds) {
            drawMarker = { ...marker, beatBounds: freshBounds };
            if (marker.nextBeatBounds) {
              const freshNext = api.boundsLookup.findBeat(
                marker.nextBeatBounds.beat,
              );
              if (freshNext) {
                drawMarker = { ...drawMarker, nextBeatBounds: freshNext };
              }
            }
          } else {
            continue;
          }
        }
        if (drawMarker.type === "cross") {
          drawCrossMarker(group, drawMarker, api);
        } else {
          drawCircleMarker(group, drawMarker, api);
        }
        renderedMarkersRef.current.add(marker.id);
      }
    };

    api.renderFinished.on(onRenderFinished);

    return () => {
      api.renderFinished.off(onRenderFinished);
      drawerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    return () => {
      overlaySvgRef.current?.remove();
      overlaySvgRef.current = null;
      markersGroupRef.current = null;
      renderedMarkersRef.current.clear();
      containerRef.current = null;
    };
  }, []);

  return null;
};

function drawCrossMarker(
  parent: SVGGElement,
  marker: CrossMarker,
  api: alphaTab.AlphaTabApi,
) {
  const bounds = marker.beatBounds;
  const scale = api.settings.display.scale;

  const lineSpacing = 8 * scale;
  const crossSize = lineSpacing * 1.2;

  const staffTopY = bounds.barBounds.visualBounds.y;
  const staffLineY =
    staffTopY + marker.staffLineIndex * lineSpacing + lineSpacing / 2;

  let x = bounds.onNotesX;

  if (marker.timingOffset !== undefined && marker.nextBeatBounds) {
    const startX = bounds.onNotesX;
    const endX = marker.nextBeatBounds.onNotesX;
    x = startX + (endX - startX) * marker.timingOffset;
  }

  const y = staffLineY;

  const markerGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  markerGroup.setAttribute("class", "cross-marker");
  markerGroup.setAttribute("data-marker-id", marker.id);
  if (marker.beatId) {
    markerGroup.setAttribute("data-beat-id", marker.beatId);
  }

  const halfSize = crossSize / 2;

  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", (x - halfSize).toString());
  line1.setAttribute("y1", (y - halfSize).toString());
  line1.setAttribute("x2", (x + halfSize).toString());
  line1.setAttribute("y2", (y + halfSize).toString());
  line1.setAttribute("stroke", "red");
  line1.setAttribute("stroke-width", (3 * scale).toString());
  line1.setAttribute("stroke-linecap", "round");

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", (x - halfSize).toString());
  line2.setAttribute("y1", (y + halfSize).toString());
  line2.setAttribute("x2", (x + halfSize).toString());
  line2.setAttribute("y2", (y - halfSize).toString());
  line2.setAttribute("stroke", "red");
  line2.setAttribute("stroke-width", (3 * scale).toString());
  line2.setAttribute("stroke-linecap", "round");

  markerGroup.appendChild(line1);
  markerGroup.appendChild(line2);
  parent.appendChild(markerGroup);
}

function drawCircleMarker(
  parent: SVGGElement,
  marker: CrossMarker,
  api: alphaTab.AlphaTabApi,
) {
  const bounds = marker.beatBounds;
  const scale = api.settings.display.scale;

  const lineSpacing = 8 * scale;
  const circleRadius = (lineSpacing * 2.2) / 2;

  let x = bounds.onNotesX;
  let y: number;

  if (marker.timingOffset !== undefined && marker.nextBeatBounds) {
    const startX = bounds.onNotesX;
    const endX = marker.nextBeatBounds.onNotesX;
    x = startX + (endX - startX) * marker.timingOffset;
  }

  if (marker.note && bounds.notes && bounds.notes.length > 0) {
    const noteBounds = bounds.notes.find((nb) => nb.note === marker.note);
    if (noteBounds && noteBounds.noteHeadBounds) {
      const noteHeadBounds = noteBounds.noteHeadBounds;
      x = noteHeadBounds.x + noteHeadBounds.w / 2;
      y = noteHeadBounds.y + noteHeadBounds.h / 2;
    } else {
      const staffTopY = bounds.barBounds.visualBounds.y;
      y = staffTopY + marker.staffLineIndex * lineSpacing + lineSpacing / 2;
    }
  } else {
    const staffTopY = bounds.barBounds.visualBounds.y;
    y = staffTopY + marker.staffLineIndex * lineSpacing + lineSpacing / 2;
  }

  const markerGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  markerGroup.setAttribute("class", "circle-marker");
  markerGroup.setAttribute("data-marker-id", marker.id);
  if (marker.beatId) {
    markerGroup.setAttribute("data-beat-id", marker.beatId);
  }

  const circleColor =
    marker.hitResult === "earlyGood"
      ? "orange"
      : marker.hitResult === "lateGood"
        ? "purple"
        : "green";

  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", x.toString());
  circle.setAttribute("cy", y.toString());
  circle.setAttribute("r", circleRadius.toString());
  circle.setAttribute("stroke", circleColor);
  circle.setAttribute("stroke-width", (3 * scale).toString());
  circle.setAttribute("fill", "none");

  markerGroup.appendChild(circle);
  parent.appendChild(markerGroup);
}

/**
 * Hook to manage cross markers via refs (no React state).
 * Drawing is performed imperatively by `CrossMarkersManager` through
 * the `drawerRef` — zero re-renders from marker changes.
 */
export function useCrossMarkers() {
  const markersRef = useRef<CrossMarker[]>([]);
  const drawerRef = useRef<MarkerDrawer | null>(null);

  const generateBeatId = useCallback(
    (
      beatBounds: alphaTab.rendering.BeatBounds,
      staffLineIndex: number,
      note?: alphaTab.model.Note,
      startTick?: number,
    ): string => {
      const beat = beatBounds.beat;
      const barIndex = beat.voice.bar.index;
      const beatIndex = beat.index;
      const trackIndex = beat.voice.bar.staff.track.index;

      let id = `beat-${trackIndex}-${barIndex}-${beatIndex}-${staffLineIndex}`;
      if (note) {
        id += `-note-${note.string}-${note.fret}`;
      }
      if (startTick !== undefined) {
        id += `-t${startTick}`;
      }
      return id;
    },
    [],
  );

  const addMarker = useCallback(
    (
      beatBounds: alphaTab.rendering.BeatBounds,
      staffLineIndex: number = 2,
      timingOffset?: number,
      nextBeatBounds?: alphaTab.rendering.BeatBounds,
      type: "cross" | "circle" = "cross",
      note?: alphaTab.model.Note,
      startTick?: number,
      hitResult?: HitResult,
    ) => {
      const beatId = generateBeatId(beatBounds, staffLineIndex, note, startTick);

      const shouldDedup = type === "circle" || (type === "cross" && note != null);
      if (shouldDedup) {
        const existing = markersRef.current.find(
          (m) => m.beatId === beatId && m.type === type,
        );
        if (existing) {
          if (process.env.NODE_ENV === "development") {
            console.log(`Skipping duplicate ${type} marker for beat:`, beatId);
          }
          return;
        }
      }

      const newMarker: CrossMarker = {
        id: `marker-${Date.now()}-${Math.random()}`,
        type,
        beatBounds,
        staffLineIndex,
        timingOffset,
        nextBeatBounds,
        note,
        beatId,
        hitResult,
      };
      markersRef.current.push(newMarker);
      drawerRef.current?.drawMarker(newMarker);
    },
    [generateBeatId],
  );

  const clearMarkers = useCallback(() => {
    markersRef.current = [];
    drawerRef.current?.clearAll();
  }, []);

  return {
    markersRef,
    drawerRef,
    addMarker,
    clearMarkers,
  };
}
