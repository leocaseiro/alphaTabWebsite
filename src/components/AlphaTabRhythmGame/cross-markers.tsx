"use client";

import * as alphaTab from "@coderline/alphatab";
import { useEffect, useRef, useState, useCallback } from "react";
import type { HitResult } from "./useRhythmGameScore";

export interface CrossMarker {
  id: string;
  type: "cross" | "circle";
  beatBounds: alphaTab.rendering.BeatBounds;
  staffLineIndex: number; // Which staff line to draw on (0-4 for standard notation)
  timingOffset?: number; // Optional: offset from beat start (0.0 = on beat, 0.5 = halfway to next beat)
  nextBeatBounds?: alphaTab.rendering.BeatBounds; // Optional: for interpolating position between beats
  note?: alphaTab.model.Note; // Optional: specific note to highlight (for circles)
  beatId?: string; // Unique identifier for the beat (bar index + beat index)
  hitResult?: HitResult; // Timing classification for circle color
}

export interface CrossMarkersManagerProps {
  api: alphaTab.AlphaTabApi | null;
  element: React.RefObject<HTMLDivElement | null>;
  markers: CrossMarker[];
}

/**
 * Component that manages rendering red "X" marks and green circle markers
 * on the AlphaTab canvas at specific beat positions.
 *
 * IMPORTANT: alphaTab renders bars in "partials" — each partial is a separate
 * <div> + <svg> positioned absolutely inside the "at-surface" container.
 * With lazy loading enabled (default), partials scrolled out of view have their
 * SVG content detached from the DOM.
 *
 * To avoid markers being drawn in the wrong partial SVG (which causes stale
 * markers from earlier bars to appear on later bars), we create our own
 * independent overlay <svg> inside the at-surface container.  The bounds
 * coordinates from boundsLookup (after scaling) are absolute pixel positions
 * relative to the canvas element, so they work directly in the overlay.
 */
export const CrossMarkersManager: React.FC<CrossMarkersManagerProps> = ({
  api,
  element,
  markers,
}) => {
  const overlaySvgRef = useRef<SVGSVGElement | null>(null);
  const markersGroupRef = useRef<SVGGElement | null>(null);
  const renderedMarkersRef = useRef<Set<string>>(new Set());
  // Cache the surface element in a stable ref so we don't depend on the
  // unstable `element` prop (useAlphaTab uses React.createRef which changes
  // identity every render).
  const surfaceRef = useRef<HTMLElement | null>(null);

  /**
   * Ensure the overlay SVG exists and is attached.
   * We attach directly to element.current (the alphaTab container div),
   * NOT inside the at-surface, because at-surface has overflow:hidden and
   * font-size:0 which can clip/collapse our SVG.
   * Returns the markers <g> element or null.
   */
  const ensureOverlay = (): SVGGElement | null => {
    const container = element.current;
    if (!container) return null;

    // Find the at-surface to read its dimensions for our overlay
    const surface =
      (container.querySelector(".at-surface") as HTMLElement) ?? null;

    // Create overlay SVG once
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

      console.log("[CrossMarkers] Created overlay SVG");
    }

    // Sync overlay dimensions with the at-surface (or container)
    const sizeSource = surface ?? container;
    const w = sizeSource.offsetWidth || sizeSource.scrollWidth || 5000;
    const h = sizeSource.offsetHeight || sizeSource.scrollHeight || 500;
    overlaySvgRef.current.setAttribute("width", String(w));
    overlaySvgRef.current.setAttribute("height", String(h));

    // Make sure the container is a positioning context
    if (!container.style.position) {
      container.style.position = "relative";
    }

    // (Re-)attach to the container if needed
    if (!container.contains(overlaySvgRef.current)) {
      container.appendChild(overlaySvgRef.current);
      console.log("[CrossMarkers] Attached overlay to container", {
        containerTag: container.tagName,
        overlaySize: `${w}x${h}`,
        overlayInDOM: overlaySvgRef.current.isConnected,
      });
    }

    return markersGroupRef.current;
  };

  // ── Effect 1: attach overlay + listen to alphaTab re-renders ────────
  // Depends only on `api` (stable identity).  We read `element.current`
  // imperatively inside the effect — no dependency on `element` avoids
  // constant teardown/setup caused by React.createRef() instability.
  useEffect(() => {
    if (!api) return;

    // Initial attachment (at-surface should already exist by this point)
    ensureOverlay();

    const onRenderFinished = () => {
      // Surface element may have been recreated — invalidate cache
      surfaceRef.current = null;
      const group = ensureOverlay();
      if (!group) return;

      // Clear and redraw all markers with fresh bounds
      while (group.firstChild) {
        group.removeChild(group.firstChild);
      }
      renderedMarkersRef.current.clear();

      if (process.env.NODE_ENV === "development") {
        console.log(
          `🎨 Redrawing ${markers.length} markers after re-render`,
        );
      }

      markers.forEach((marker) => {
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
            return; // beat no longer visible
          }
        }
        if (drawMarker.type === "cross") {
          drawCrossMarker(group, drawMarker, api);
        } else if (drawMarker.type === "circle") {
          drawCircleMarker(group, drawMarker, api);
        }
        renderedMarkersRef.current.add(marker.id);
      });
    };

    api.renderFinished.on(onRenderFinished);

    return () => {
      api.renderFinished.off(onRenderFinished);
    };
    // `markers` is intentionally read via closure so we always have the
    // latest array when renderFinished fires, without re-subscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // ── Effect 2: incrementally add/remove markers ─────────────────────
  useEffect(() => {
    if (!api) return;

    const group = ensureOverlay();
    if (!group) {
      console.warn("[CrossMarkers] ensureOverlay returned null, can't draw", {
        markers: markers.length,
      });
      return;
    }

    // Draw only new markers
    markers.forEach((marker) => {
      if (!renderedMarkersRef.current.has(marker.id)) {
        const bounds = marker.beatBounds;
        console.log("[CrossMarkers] Drawing marker:", {
          id: marker.id.slice(-10),
          type: marker.type,
          onNotesX: bounds.onNotesX,
          barVisualY: bounds.barBounds?.visualBounds?.y,
          staffLine: marker.staffLineIndex,
          groupChildren: group.children.length,
          overlayInDOM: overlaySvgRef.current?.isConnected,
          overlayParent: overlaySvgRef.current?.parentElement?.className,
        });
        if (marker.type === "cross") {
          drawCrossMarker(group, marker, api);
        } else if (marker.type === "circle") {
          drawCircleMarker(group, marker, api);
        }
        renderedMarkersRef.current.add(marker.id);
      }
    });

    // Remove markers that were deleted from state
    const currentIds = new Set(markers.map((m) => m.id));
    renderedMarkersRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        group.querySelector(`[data-marker-id="${id}"]`)?.remove();
        renderedMarkersRef.current.delete(id);
      }
    });
  }, [api, markers]);

  // ── Effect 3: cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      overlaySvgRef.current?.remove();
      overlaySvgRef.current = null;
      markersGroupRef.current = null;
      renderedMarkersRef.current.clear();
      surfaceRef.current = null;
    };
  }, []);

  return null;
};

/**
 * Draws a red "X" marker on the SVG at the specified beat position
 */
function drawCrossMarker(
  parent: SVGGElement,
  marker: CrossMarker,
  api: alphaTab.AlphaTabApi,
) {
  const bounds = marker.beatBounds;
  const scale = api.settings.display.scale;

  // Calculate the size of the cross (similar to a cross notehead)
  // Standard notehead is about 1.5 line spaces in height
  const lineSpacing = 8 * scale; // AlphaTab default line spacing
  const crossSize = lineSpacing * 1.2; // Slightly smaller than a full note head

  // Calculate Y position based on staff line index
  // staffLineIndex controls which line the cross is drawn on
  const staffTopY = bounds.barBounds.visualBounds.y;
  const staffLineY =
    staffTopY + marker.staffLineIndex * lineSpacing + lineSpacing / 2;

  // X position: onNotesX is the absolute X coordinate where the cursor is displayed
  // This is where the note heads are positioned (not an offset!)
  let x = bounds.onNotesX;

  // If timingOffset is provided, interpolate position between beats
  if (marker.timingOffset !== undefined && marker.nextBeatBounds) {
    const startX = bounds.onNotesX;
    const endX = marker.nextBeatBounds.onNotesX;
    // Interpolate: offset of 0.0 = at beat, 0.5 = halfway, 1.0 = next beat
    x = startX + (endX - startX) * marker.timingOffset;
  }

  const y = staffLineY;

  // Create a group for this marker
  const markerGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  markerGroup.setAttribute("class", "cross-marker");
  markerGroup.setAttribute("data-marker-id", marker.id);
  if (marker.beatId) {
    markerGroup.setAttribute("data-beat-id", marker.beatId);
  }

  // Create the X shape using two lines
  const halfSize = crossSize / 2;

  // First diagonal line (\)
  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", (x - halfSize).toString());
  line1.setAttribute("y1", (y - halfSize).toString());
  line1.setAttribute("x2", (x + halfSize).toString());
  line1.setAttribute("y2", (y + halfSize).toString());
  line1.setAttribute("stroke", "red");
  line1.setAttribute("stroke-width", (3 * scale).toString());
  line1.setAttribute("stroke-linecap", "round");

  // Second diagonal line (/)
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

/**
 * Draws a green circle marker around the notehead for successful hits
 */
function drawCircleMarker(
  parent: SVGGElement,
  marker: CrossMarker,
  api: alphaTab.AlphaTabApi,
) {
  const bounds = marker.beatBounds;
  const scale = api.settings.display.scale;

  // Calculate the size of the circle (larger than notehead with padding)
  const lineSpacing = 8 * scale; // AlphaTab default line spacing
  const circleRadius = (lineSpacing * 2.2) / 2; // Larger with padding around notehead

  let x = bounds.onNotesX;
  let y: number;

  // If timingOffset is provided, interpolate X position between beats
  if (marker.timingOffset !== undefined && marker.nextBeatBounds) {
    const startX = bounds.onNotesX;
    const endX = marker.nextBeatBounds.onNotesX;
    x = startX + (endX - startX) * marker.timingOffset;
  }

  // If a specific note is provided, use its exact bounds
  if (marker.note && bounds.notes && bounds.notes.length > 0) {
    const noteBounds = bounds.notes.find((nb) => nb.note === marker.note);
    if (noteBounds && noteBounds.noteHeadBounds) {
      // Use the center of the note head bounds
      const noteHeadBounds = noteBounds.noteHeadBounds;
      x = noteHeadBounds.x + noteHeadBounds.w / 2;
      y = noteHeadBounds.y + noteHeadBounds.h / 2;
    } else {
      // Fallback to staff line calculation
      const staffTopY = bounds.barBounds.visualBounds.y;
      y = staffTopY + marker.staffLineIndex * lineSpacing + lineSpacing / 2;
    }
  } else {
    // Fallback to staff line calculation
    const staffTopY = bounds.barBounds.visualBounds.y;
    y = staffTopY + marker.staffLineIndex * lineSpacing + lineSpacing / 2;
  }

  // Create a group for this marker
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
 * Hook to manage cross markers state
 * PERFORMANCE OPTIMIZED: Stable callbacks that don't cause unnecessary re-renders
 * Prevents duplicate markers on the same beat
 */
export function useCrossMarkers() {
  const [markers, setMarkers] = useState<CrossMarker[]>([]);
  const markersRef = useRef<CrossMarker[]>([]);
  const markedBeatsRef = useRef<Set<string>>(new Set()); // Track which beats have markers

  // Sync ref with state
  useEffect(() => {
    markersRef.current = markers;
    // Update marked beats set
    markedBeatsRef.current = new Set(
      markers.map((m) => m.beatId).filter((id): id is string => !!id),
    );
  }, [markers]);

  // Generate unique beat ID from beat bounds
  const generateBeatId = useCallback(
    (
      beatBounds: alphaTab.rendering.BeatBounds,
      staffLineIndex: number,
      note?: alphaTab.model.Note,
      startTick?: number,
    ): string => {
      // Use bar index + beat index + staff line + optional note info for unique ID
      const beat = beatBounds.beat;
      const barIndex = beat.voice.bar.index;
      const beatIndex = beat.index;
      const trackIndex = beat.voice.bar.staff.track.index;

      let id = `beat-${trackIndex}-${barIndex}-${beatIndex}-${staffLineIndex}`;

      // Include note info if provided for more granular markers
      if (note) {
        id += `-note-${note.string}-${note.fret}`;
      }

      // Include start tick to distinguish repeat passes
      // (same bar played in different repeat iterations has different ticks)
      if (startTick !== undefined) {
        id += `-t${startTick}`;
      }

      return id;
    },
    [],
  );

  // Stable callbacks using useCallback
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

      // Deduplicate circles and "missed note" crosses (which have a specific note).
      // Wrong-input crosses (no note) are never deduped — each wrong hit is a
      // separate event and should produce its own marker.
      const shouldDedup = type === "circle" || (type === "cross" && note != null);
      if (shouldDedup) {
        const existingMarker = markersRef.current.find(
          (m) => m.beatId === beatId && m.type === type,
        );

        if (existingMarker) {
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
      setMarkers((prev) => [...prev, newMarker]);
    },
    [generateBeatId],
  );

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
    markedBeatsRef.current.clear();
  }, []);

  return {
    markers,
    addMarker,
    removeMarker,
    clearMarkers,
  };
}
