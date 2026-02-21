"use client";

import type { MidiMapping, MidiMappingPreset } from "./midi-mapping-context";
import { drumsMidi } from "./drum-midi-map";

// ============================================================================
// MIDI Name Map
// ============================================================================

/**
 * Get human-readable name for a MIDI note
 */
export function getMidiNoteName(midiNote: number): string {
  return drumsMidi[midiNote as keyof typeof drumsMidi] || "Unknown";
}

// ============================================================================
// Helper to create preset with grouped MIDI notes
// ============================================================================

/**
 * Get all MIDI notes that map to the same instrument group
 */
function getMidiGroupForNote(targetNote: number): number[] {
  const groupMap: Record<number, number[]> = {
    // Ride group
    51: [51, 53, 59, 93],
    // Crash 1 group
    55: [55, 57],
    // Crash 2 group
    49: [49, 52],
    // Hi-Hat closed group
    42: [42, 22],
    // Hi-Hat pedal group (separate from closed)
    44: [44],
    // Open Hi-Hat group
    46: [46, 26],
    // Toms group - very high
    50: [50],
    // Toms group - high
    48: [48],
    // Toms group - middle
    45: [45],
    // Toms group - floor mid
    47: [47],
    // Toms group - floor low
    43: [43],
    // Snare group
    38: [38, 37, 91],
    // Bass drum group
    36: [36, 35],
    // Cowbell group
    102: [102, 56, 99],
  };

  return groupMap[targetNote] || [targetNote];
}

// ============================================================================
// Preset Definitions
// ============================================================================

/**
 * No mapping preset - identity mapping
 * Each MIDI note maps only to itself
 */
export const NoMappingPreset: MidiMappingPreset = {
  id: "no-mapping",
  name: "No Mapping",
  description: "No MIDI mapping - each note maps to itself",
  mapping: {
    entries: [],
  },
  createdAt: Date.now(),
};

/**
 * Full Drum Kit Mapping
 * Maps all common drum MIDI notes to their instrument groups
 */
export const FullDrumKitPreset: MidiMappingPreset = {
  id: "full-drum-kit",
  name: "Full Drum Kit (All Zones)",
  description: "Map all drum zones - Ride, Crashes, Hi-Hats, Toms, Snare, Bass",
  mapping: {
    name: "Full Drum Kit",
    entries: [
      // Ride group
      { targetNote: 51, mappedNotes: [51, 53, 59, 93] },
      // Crash 1 group
      { targetNote: 55, mappedNotes: [55, 57] },
      // Crash 2 group
      { targetNote: 49, mappedNotes: [49, 52] },
      // Hi-Hat closed group
      { targetNote: 42, mappedNotes: [42, 22] },
      // Hi-Hat pedal (separate)
      { targetNote: 44, mappedNotes: [44] },
      // Hi-Hat open group
      { targetNote: 46, mappedNotes: [46, 26] },
      // Toms
      { targetNote: 50, mappedNotes: [50] },
      { targetNote: 48, mappedNotes: [48] },
      { targetNote: 45, mappedNotes: [45] },
      { targetNote: 47, mappedNotes: [47] },
      { targetNote: 43, mappedNotes: [43] },
      // Snare group
      { targetNote: 38, mappedNotes: [38, 37, 91] },
      // Bass drum group
      { targetNote: 36, mappedNotes: [36, 35] },
      // Cowbell group
      { targetNote: 102, mappedNotes: [102, 56, 99] },
    ],
  },
  createdAt: Date.now(),
};

/**
 * Yamaha DTX Multi-zone preset
 * Supports multi-zone cymbals with separate inputs for edge, bow, and bell zones
 */
export const YamahaDTXPreset: MidiMappingPreset = {
  id: "yamaha-dtx",
  name: "Yamaha DTX (Multi-zone)",
  description:
    "Multi-zone mapping for Yamaha DTX drums with edge/bow/bell zones",
  mapping: {
    name: "Yamaha DTX",
    entries: [
      {
        targetNote: 51, // Ride cymbal
        mappedNotes: [51, 53, 59, 93], // Ride + all zones
      },
      {
        targetNote: 55, // Crash 1
        mappedNotes: [55, 57], // Crash 1 + edge
      },
      {
        targetNote: 49, // Crash 2
        mappedNotes: [49, 52], // Crash 2 + edge
      },
      {
        targetNote: 42, // Hi-Hat closed
        mappedNotes: [42, 22], // Hi-hat closed + edge
      },
      {
        targetNote: 44, // Hi-Hat pedal (separate)
        mappedNotes: [44],
      },
      {
        targetNote: 46, // Hi-Hat open
        mappedNotes: [46, 26], // Hi-hat open + edge
      },
    ],
  },
  createdAt: Date.now(),
};

/**
 * Roland TD-50 Multi-zone preset
 * Supports the Roland TD-50 drum kit with multi-zone cymbals
 */
export const RolandTD50Preset: MidiMappingPreset = {
  id: "roland-td50",
  name: "Roland TD-50 (Multi-zone)",
  description: "Multi-zone mapping for Roland TD-50 drums",
  mapping: {
    name: "Roland TD-50",
    entries: [
      {
        targetNote: 51, // Ride cymbal
        mappedNotes: [51, 59, 53, 93], // Ride + all zones
      },
      {
        targetNote: 55, // Crash 1
        mappedNotes: [55, 57], // Crash 1 + edge
      },
      {
        targetNote: 49, // Crash 2
        mappedNotes: [49, 52], // Crash 2 + edge
      },
      {
        targetNote: 42, // Hi-Hat closed
        mappedNotes: [42, 22], // Hi-hat closed + edge
      },
      {
        targetNote: 44, // Hi-Hat pedal (separate)
        mappedNotes: [44],
      },
      {
        targetNote: 46, // Hi-Hat open
        mappedNotes: [46, 26], // Hi-hat open + edge
      },
      {
        targetNote: 36, // Bass drum
        mappedNotes: [36, 35], // Bass drum + alt
      },
    ],
  },
  createdAt: Date.now(),
};

/**
 * Alesis Nitro Max Multi-zone preset
 * Supports Alesis electronic drum kit with multi-zone cymbals
 */
export const AlesiNitroMaxPreset: MidiMappingPreset = {
  id: "alesis-nitro-max",
  name: "Alesis Nitro Max (Multi-zone)",
  description: "Multi-zone mapping for Alesis Nitro Max electronic drums",
  mapping: {
    name: "Alesis Nitro Max",
    entries: [
      {
        targetNote: 51, // Ride cymbal
        mappedNotes: [51, 53, 59], // Ride + zones
      },
      {
        targetNote: 55, // Crash 1
        mappedNotes: [55, 57], // Crash + edge
      },
      {
        targetNote: 49, // Crash 2
        mappedNotes: [49, 52], // Crash 2 + edge
      },
      {
        targetNote: 42, // Hi-Hat closed
        mappedNotes: [42, 22], // Hi-hat closed + edge
      },
      {
        targetNote: 44, // Hi-Hat pedal (separate)
        mappedNotes: [44],
      },
      {
        targetNote: 46, // Hi-Hat open
        mappedNotes: [46, 26], // Hi-hat open + edge
      },
    ],
  },
  createdAt: Date.now(),
};

// ============================================================================
// Built-in Presets
// ============================================================================

/**
 * All built-in MIDI mapping presets
 * Ordered by popularity/common use
 */
export const BUILTIN_PRESETS: MidiMappingPreset[] = [
  NoMappingPreset,
  FullDrumKitPreset,
  YamahaDTXPreset,
  RolandTD50Preset,
  AlesiNitroMaxPreset,
];

// ============================================================================
// Preset Utilities
// ============================================================================

/**
 * Get a preset by ID
 * @param presetId - The ID of the preset to retrieve
 * @returns The preset, or undefined if not found
 */
export function getPresetById(presetId: string): MidiMappingPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.id === presetId);
}

/**
 * Get all available preset names
 * Useful for building dropdown menus
 * @returns Array of preset names
 */
export function getPresetNames(): string[] {
  return BUILTIN_PRESETS.map((p) => p.name);
}

/**
 * Get a mapping from a preset name
 * @param presetName - The name of the preset
 * @returns The mapping, or undefined if not found
 */
export function getMappingByPresetName(
  presetName: string,
): MidiMapping | undefined {
  const preset = BUILTIN_PRESETS.find((p) => p.name === presetName);
  return preset?.mapping;
}

/**
 * Check if a MIDI note mapping exists in a preset
 * Useful for validating if a preset has a specific mapping
 * @param presetId - The ID of the preset
 * @param targetNote - The target note to check
 * @returns True if the target note has mappings in the preset
 */
export function presetHasMapping(
  presetId: string,
  targetNote: number,
): boolean {
  const preset = getPresetById(presetId);
  if (!preset) return false;
  return preset.mapping.entries.some(
    (entry) => entry.targetNote === targetNote,
  );
}

/**
 * Create a copy of a mapping for customization
 * @param preset - The preset to clone from
 * @param customName - Optional custom name for the cloned mapping
 * @returns A new mapping based on the preset
 */
export function clonePresetMapping(
  preset: MidiMappingPreset,
  customName?: string,
): MidiMapping {
  return {
    name: customName || `${preset.name} (Copy)`,
    entries: preset.mapping.entries.map((entry) => ({
      targetNote: entry.targetNote,
      mappedNotes: [...entry.mappedNotes],
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Get human-readable description of a mapping
 * Useful for displaying mapping summaries
 * @param mapping - The mapping to describe
 * @returns A formatted string describing the mapping
 */
export function getMappingDescription(mapping: MidiMapping | null): string {
  if (!mapping || mapping.entries.length === 0) {
    return "No mapping configured";
  }

  if (mapping.entries.length === 1) {
    const entry = mapping.entries[0];
    return `${entry.mappedNotes.length} MIDI input(s) mapped`;
  }

  const totalMappings = mapping.entries.reduce(
    (sum, entry) => sum + entry.mappedNotes.length,
    0,
  );
  return `${mapping.entries.length} instrument(s), ${totalMappings} MIDI input(s) mapped`;
}
