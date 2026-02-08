"use client";

import * as alphaTab from "@coderline/alphatab";
import { useEffect, useRef, useState, useCallback } from "react";

export interface CrossMarker {
  id: string;
  type: "cross" | "circle";
  beatBounds: alphaTab.rendering.BeatBounds;
  staffLineIndex: number; // Which staff line to draw on (0-4 for standard notation)
  timingOffset?: number; // Optional: offset from beat start (0.0 = on beat, 0.5 = halfway to next beat)
  nextBeatBounds?: alphaTab.rendering.BeatBounds; // Optional: for interpolating position between beats
  note?: alphaTab.model.Note; // Optional: specific note to highlight (for circles)
}

export interface CrossMarkersManagerProps {
  api: alphaTab.AlphaTabApi | null;
  element: React.RefObject<HTMLDivElement | null>;
  markers: CrossMarker[];
}

/**
 * Component that manages rendering red "X" marks on the AlphaTab SVG canvas
 * at specific beat positions. The markers scroll with the notation.
 * PERFORMANCE OPTIMIZED: Incremental rendering + persist markers across AlphaTab renders
 */
export const CrossMarkersManager: React.FC<CrossMarkersManagerProps> = ({
  api,
  element,
  markers,
}) => {
  const markersGroupRef = useRef<SVGGElement | null>(null);
  const renderedMarkersRef = useRef<Set<string>>(new Set());
  const svgRef = useRef<SVGElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Function to ensure markers group exists and is attached
  const ensureMarkersGroup = useCallback(() => {
    if (!element.current) return;

    const svg = element.current.querySelector("svg");
    if (!svg) return;

    svgRef.current = svg as SVGElement;

    // Create markers group if it doesn't exist
    if (!markersGroupRef.current) {
      const markersGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
      );
      markersGroup.setAttribute("id", "cross-markers-group");
      markersGroup.setAttribute("class", "cross-markers");
      markersGroupRef.current = markersGroup;
    }

    // Attach to SVG if not already attached
    if (!svg.contains(markersGroupRef.current)) {
      svg.appendChild(markersGroupRef.current);
      
      // Redraw all markers after reattachment
      if (api) {
        const markersGroup = markersGroupRef.current;
        markers.forEach((marker) => {
          if (marker.type === "cross") {
            drawCrossMarker(markersGroup, marker, api);
          } else if (marker.type === "circle") {
            drawCircleMarker(markersGroup, marker, api);
          }
        });
      }
    }
  }, [element, api, markers]);

  // Watch for DOM changes (AlphaTab replacing SVG)
  useEffect(() => {
    if (!element.current) return;

    // Initial setup
    ensureMarkersGroup();

    // Create mutation observer to detect when AlphaTab replaces the SVG
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Check if SVG was added/replaced
          mutation.addedNodes.forEach((node) => {
            if (node.nodeName === "svg" || (node as Element).querySelector?.("svg")) {
              // SVG was replaced, reattach markers
              ensureMarkersGroup();
            }
          });
        }
      }
    });

    // Observe the container for changes
    observerRef.current.observe(element.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [element, ensureMarkersGroup]);

  // Listen for AlphaTab render events
  useEffect(() => {
    if (!api) return;

    const onRenderFinished = () => {
      // Ensure markers are still attached after render
      ensureMarkersGroup();
    };

    api.renderFinished.on(onRenderFinished);

    return () => {
      api.renderFinished.off(onRenderFinished);
    };
  }, [api, ensureMarkersGroup]);

  // Incrementally add new markers
  useEffect(() => {
    if (!api || !markersGroupRef.current) return;

    const markersGroup = markersGroupRef.current;

    // Only draw markers that haven't been rendered yet
    markers.forEach((marker) => {
      if (!renderedMarkersRef.current.has(marker.id)) {
        if (marker.type === "cross") {
          drawCrossMarker(markersGroup, marker, api);
        } else if (marker.type === "circle") {
          drawCircleMarker(markersGroup, marker, api);
        }
        renderedMarkersRef.current.add(marker.id);
      }
    });

    // Clean up markers that were removed from state
    const currentMarkerIds = new Set(markers.map((m) => m.id));
    renderedMarkersRef.current.forEach((id) => {
      if (!currentMarkerIds.has(id)) {
        const markerElement = markersGroup.querySelector(
          `[data-marker-id="${id}"]`,
        );
        if (markerElement) {
          markerElement.remove();
        }
        renderedMarkersRef.current.delete(id);
      }
    });
  }, [api, markers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markersGroupRef.current) {
        markersGroupRef.current.remove();
        markersGroupRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      renderedMarkersRef.current.clear();
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
  // For guitar tabs, notes are positioned in the spaces between lines, not on the lines
  // Staff lines are at indices 0, 1, 2, 3, 4, 5 for a 6-string guitar
  const staffTopY = bounds.barBounds.visualBounds.y;

  // Position in the center of the string space (between lines)
  // Add half a line spacing to move from the line to the center of the space
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

  // Create the circle
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", x.toString());
  circle.setAttribute("cy", y.toString());
  circle.setAttribute("r", circleRadius.toString());
  circle.setAttribute("stroke", "green");
  circle.setAttribute("stroke-width", (3 * scale).toString());
  circle.setAttribute("fill", "none");

  markerGroup.appendChild(circle);
  parent.appendChild(markerGroup);
}

/**
 * Hook to manage cross markers state
 * PERFORMANCE OPTIMIZED: Stable callbacks that don't cause unnecessary re-renders
 */
export function useCrossMarkers() {
  const [markers, setMarkers] = useState<CrossMarker[]>([]);
  const markersRef = useRef<CrossMarker[]>([]);

  // Sync ref with state
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Stable callbacks using useCallback
  const addMarker = useCallback((
    beatBounds: alphaTab.rendering.BeatBounds,
    staffLineIndex: number = 2,
    timingOffset?: number,
    nextBeatBounds?: alphaTab.rendering.BeatBounds,
    type: "cross" | "circle" = "cross",
    note?: alphaTab.model.Note,
  ) => {
    const newMarker: CrossMarker = {
      id: `marker-${Date.now()}-${Math.random()}`,
      type,
      beatBounds,
      staffLineIndex,
      timingOffset,
      nextBeatBounds,
      note,
    };
    setMarkers((prev) => [...prev, newMarker]);
  }, []);

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
  }, []);

  return {
    markers,
    addMarker,
    removeMarker,
    clearMarkers,
  };
}
