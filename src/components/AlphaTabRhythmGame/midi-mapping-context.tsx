"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { settingsSyncEmitter } from "./settings-sync";

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single MIDI mapping entry
 * Maps multiple MIDI input notes to a single target note in the notation
 */
export interface MidiMappingEntry {
  /** The target MIDI note in the notation */
  targetNote: number;
  /** Array of MIDI notes that should map to this target */
  mappedNotes: number[];
}

/**
 * Complete MIDI mapping configuration
 * Contains all mapping entries for the current session
 */
export interface MidiMapping {
  /** Mapping entries */
  entries: MidiMappingEntry[];
  /** Human-readable name for the mapping */
  name?: string;
  /** Creation timestamp */
  createdAt?: number;
  /** Last modified timestamp */
  updatedAt?: number;
}

/**
 * Custom preset for MIDI mapping
 * Pre-configured templates for common drum kits
 */
export interface MidiMappingPreset {
  /** Unique identifier for the preset */
  id: string;
  /** Preset name (e.g., "Yamaha DTX", "Roland TD-50") */
  name: string;
  /** Description of the preset */
  description: string;
  /** The mapping configuration */
  mapping: MidiMapping;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Storage schema for MIDI mappings in LocalStorage
 */
interface MidiMappingStorage {
  /** Active mapping configuration */
  activeMapping: MidiMapping | null;
  /** User-created custom presets */
  customPresets: MidiMappingPreset[];
  /** MIDI notes to ignore errors from (e.g., pedal hits) */
  ignoredMidiNotes: number[];
  /**
   * Notation (target) notes to skip entirely from scoring.
   * When a notation note is in this list, missing it is not penalised.
   * Useful for practice focus (e.g., only practice hi-hat, skip kick drum expectations).
   */
  skippedNotationNotes: number[];
  /** Version for migration purposes */
  version: number;
}

/**
 * Context value type
 */
interface MidiMappingContextValue {
  /** Get the current active mapping */
  getMapping: () => MidiMapping | null;
  /** Set the active mapping */
  setMapping: (mapping: MidiMapping | null) => void;
  /** Get all MIDI notes that map to a target note */
  getMappedNotes: (targetNote: number) => number[];
  /** Add a new mapping entry */
  addMapping: (targetNote: number, midiNote: number) => void;
  /** Remove a MIDI note from a mapping entry */
  removeMapping: (targetNote: number, midiNote: number) => void;
  /** Add or update a custom preset */
  saveCustomPreset: (preset: MidiMappingPreset) => void;
  /** Delete a custom preset */
  deleteCustomPreset: (presetId: string) => void;
  /** Get all custom presets */
  getCustomPresets: () => MidiMappingPreset[];
  /** Load a preset as the active mapping */
  loadPreset: (preset: MidiMapping) => void;
  /** Get all MIDI notes to ignore errors from */
  getIgnoredMidiNotes: () => number[];
  /** Set MIDI notes to ignore errors from */
  setIgnoredMidiNotes: (midiNotes: number[]) => void;
  /** Add a MIDI note to the ignore list */
  addIgnoredMidiNote: (midiNote: number) => void;
  /** Remove a MIDI note from the ignore list */
  removeIgnoredMidiNote: (midiNote: number) => void;
  /** Check if a MIDI note should have errors ignored */
  isErrorIgnored: (midiNote: number) => boolean;
  /** Get all notation (target) notes that are skipped from scoring */
  getSkippedNotationNotes: () => number[];
  /** Add a notation note to the skip list */
  addSkippedNotationNote: (midiNote: number) => void;
  /** Remove a notation note from the skip list */
  removeSkippedNotationNote: (midiNote: number) => void;
  /** Check if a notation note is skipped from scoring */
  isNotationNoteSkipped: (midiNote: number) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "alphaTab_midi_mapping";
const CURRENT_VERSION = 1;

// Default ignore list: 44 (Pedal Hi-Hat)
const DEFAULT_IGNORED_MIDI_NOTES = [44];

const defaultStorage: MidiMappingStorage = {
  activeMapping: null,
  customPresets: [],
  ignoredMidiNotes: DEFAULT_IGNORED_MIDI_NOTES,
  skippedNotationNotes: [],
  version: CURRENT_VERSION,
};

// ============================================================================
// Context
// ============================================================================

const MidiMappingContext = createContext<MidiMappingContextValue | null>(null);

// ============================================================================
// Utilities
// ============================================================================

/**
 * Load MIDI mapping configuration from LocalStorage
 */
function loadFromStorage(): MidiMappingStorage {
  if (typeof window === "undefined") {
    return defaultStorage;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultStorage;
    }

    const parsed = JSON.parse(stored) as MidiMappingStorage;

    // Version check for future migrations
    if (parsed.version !== CURRENT_VERSION) {
      console.warn(
        `MIDI mapping storage version mismatch: ${parsed.version} vs ${CURRENT_VERSION}`,
      );
      return defaultStorage;
    }

    // Backfill fields added after initial version
    if (!Array.isArray(parsed.ignoredMidiNotes)) {
      parsed.ignoredMidiNotes = DEFAULT_IGNORED_MIDI_NOTES;
    }
    if (!Array.isArray(parsed.skippedNotationNotes)) {
      parsed.skippedNotationNotes = [];
    }

    return parsed;
  } catch (error) {
    console.error("Error loading MIDI mapping from storage:", error);
    return defaultStorage;
  }
}

/**
 * Save MIDI mapping configuration to LocalStorage
 */
function saveToStorage(storage: MidiMappingStorage): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error("Error saving MIDI mapping to storage:", error);
  }
}

/**
 * Clone a MIDI mapping to avoid mutations
 */
function cloneMapping(mapping: MidiMapping | null): MidiMapping | null {
  if (!mapping) return null;
  return {
    entries: mapping.entries.map((entry) => ({
      targetNote: entry.targetNote,
      mappedNotes: [...entry.mappedNotes],
    })),
    name: mapping.name,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  };
}

/**
 * Validate a mapping entry
 * Ensures targetNote and mappedNotes are valid
 */
function validateMappingEntry(entry: MidiMappingEntry): boolean {
  if (
    !Number.isInteger(entry.targetNote) ||
    entry.targetNote < 0 ||
    entry.targetNote > 127
  ) {
    return false;
  }
  if (!Array.isArray(entry.mappedNotes)) {
    return false;
  }
  return entry.mappedNotes.every(
    (note) => Number.isInteger(note) && note >= 0 && note <= 127,
  );
}

// ============================================================================
// Provider Component
// ============================================================================

export interface MidiMappingProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for MIDI mapping context
 * Manages state and persistence of MIDI mappings
 */
export const MidiMappingProvider: React.FC<MidiMappingProviderProps> = ({
  children,
}) => {
  const [storage, setStorage] = useState<MidiMappingStorage>(() =>
    loadFromStorage(),
  );

  // Handle external updates (cross-tab sync, other sources)
  const updateStorage = useCallback((newStorage: MidiMappingStorage) => {
    setStorage(newStorage);
    saveToStorage(newStorage);
    settingsSyncEmitter.notify("midi-mapping-context");
  }, []);

  // Sync when settings change in other components
  useEffect(() => {
    const unsubscribe = settingsSyncEmitter.subscribe((source) => {
      if (source !== "midi-mapping-context") {
        // Reload from storage if updated elsewhere
        const reloaded = loadFromStorage();
        setStorage(reloaded);
      }
    });

    return unsubscribe;
  }, []);

  const contextValue: MidiMappingContextValue = {
    getMapping: () => cloneMapping(storage.activeMapping),

    setMapping: (mapping: MidiMapping | null) => {
      const newMapping = mapping
        ? {
            ...cloneMapping(mapping),
            updatedAt: Date.now(),
          }
        : null;

      const newStorage: MidiMappingStorage = {
        ...storage,
        activeMapping: newMapping,
      };

      updateStorage(newStorage);
    },

    getMappedNotes: (targetNote: number) => {
      const mapping = storage.activeMapping;
      if (!mapping) return [];

      const entry = mapping.entries.find((e) => e.targetNote === targetNote);
      return entry ? [...entry.mappedNotes] : [];
    },

    addMapping: (targetNote: number, midiNote: number) => {
      if (!Number.isInteger(targetNote) || !Number.isInteger(midiNote)) {
        console.error("Invalid MIDI notes for mapping");
        return;
      }

      let newMapping = cloneMapping(storage.activeMapping);
      if (!newMapping) {
        newMapping = { entries: [] };
      }

      // Find or create entry for target note
      let entry = newMapping.entries.find((e) => e.targetNote === targetNote);
      if (!entry) {
        entry = { targetNote, mappedNotes: [] };
        newMapping.entries.push(entry);
      }

      // Add MIDI note if not already present
      if (!entry.mappedNotes.includes(midiNote)) {
        entry.mappedNotes.push(midiNote);
        entry.mappedNotes.sort((a, b) => a - b);
      }

      newMapping.updatedAt = Date.now();
      const newStorage: MidiMappingStorage = {
        ...storage,
        activeMapping: newMapping,
      };
      updateStorage(newStorage);
    },

    removeMapping: (targetNote: number, midiNote: number) => {
      let newMapping = cloneMapping(storage.activeMapping);
      if (!newMapping) return;

      const entry = newMapping.entries.find((e) => e.targetNote === targetNote);
      if (!entry) return;

      entry.mappedNotes = entry.mappedNotes.filter((note) => note !== midiNote);

      // Remove entry if no MIDI notes left
      if (entry.mappedNotes.length === 0) {
        newMapping.entries = newMapping.entries.filter(
          (e) => e.targetNote !== targetNote,
        );
      }

      // If no entries left, clear the mapping
      if (newMapping.entries.length === 0) {
        newMapping = null;
      } else {
        newMapping.updatedAt = Date.now();
      }

      const newStorage: MidiMappingStorage = {
        ...storage,
        activeMapping: newMapping,
      };
      updateStorage(newStorage);
    },

    saveCustomPreset: (preset: MidiMappingPreset) => {
      // Validate preset
      if (!preset.name || !preset.mapping) {
        console.error("Invalid preset for saving");
        return;
      }

      // Validate all mapping entries
      if (!preset.mapping.entries.every(validateMappingEntry)) {
        console.error("Invalid mapping entries in preset");
        return;
      }

      const newPresets = storage.customPresets.filter(
        (p) => p.id !== preset.id,
      );
      newPresets.push(preset);

      const newStorage: MidiMappingStorage = {
        ...storage,
        customPresets: newPresets,
      };

      updateStorage(newStorage);
    },

    deleteCustomPreset: (presetId: string) => {
      const newPresets = storage.customPresets.filter((p) => p.id !== presetId);
      const newStorage: MidiMappingStorage = {
        ...storage,
        customPresets: newPresets,
      };
      updateStorage(newStorage);
    },

    getCustomPresets: () => {
      return storage.customPresets.map((p) => ({
        ...p,
        mapping: cloneMapping(p.mapping),
      }));
    },

    loadPreset: (preset: MidiMapping) => {
      const newMapping: MidiMapping = {
        ...cloneMapping(preset),
        createdAt: storage.activeMapping?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };

      const newStorage: MidiMappingStorage = {
        ...storage,
        activeMapping: newMapping,
      };

      updateStorage(newStorage);
    },

    getIgnoredMidiNotes: () => [...storage.ignoredMidiNotes],

    setIgnoredMidiNotes: (midiNotes: number[]) => {
      const newStorage: MidiMappingStorage = {
        ...storage,
        ignoredMidiNotes: midiNotes.filter(
          (note) => Number.isInteger(note) && note >= 0 && note <= 127,
        ),
      };
      updateStorage(newStorage);
    },

    addIgnoredMidiNote: (midiNote: number) => {
      if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
        console.error("Invalid MIDI note for ignore list");
        return;
      }

      if (!storage.ignoredMidiNotes.includes(midiNote)) {
        const newStorage: MidiMappingStorage = {
          ...storage,
          ignoredMidiNotes: [...storage.ignoredMidiNotes, midiNote].sort(
            (a, b) => a - b,
          ),
        };
        updateStorage(newStorage);
      }
    },

    removeIgnoredMidiNote: (midiNote: number) => {
      const newStorage: MidiMappingStorage = {
        ...storage,
        ignoredMidiNotes: storage.ignoredMidiNotes.filter(
          (note) => note !== midiNote,
        ),
      };
      updateStorage(newStorage);
    },

    isErrorIgnored: (midiNote: number) => {
      return storage.ignoredMidiNotes.includes(midiNote);
    },

    getSkippedNotationNotes: () => [...storage.skippedNotationNotes],

    addSkippedNotationNote: (midiNote: number) => {
      if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
        console.error("Invalid MIDI note for skip list");
        return;
      }

      if (!storage.skippedNotationNotes.includes(midiNote)) {
        const newStorage: MidiMappingStorage = {
          ...storage,
          skippedNotationNotes: [
            ...storage.skippedNotationNotes,
            midiNote,
          ].sort((a, b) => a - b),
        };
        updateStorage(newStorage);
      }
    },

    removeSkippedNotationNote: (midiNote: number) => {
      const newStorage: MidiMappingStorage = {
        ...storage,
        skippedNotationNotes: storage.skippedNotationNotes.filter(
          (note) => note !== midiNote,
        ),
      };
      updateStorage(newStorage);
    },

    isNotationNoteSkipped: (midiNote: number) => {
      return storage.skippedNotationNotes.includes(midiNote);
    },
  };

  return (
    <MidiMappingContext.Provider value={contextValue}>
      {children}
    </MidiMappingContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to use MIDI mapping context
 * @throws Error if used outside of MidiMappingProvider
 */
export function useMidiMapping(): MidiMappingContextValue {
  const context = useContext(MidiMappingContext);
  if (!context) {
    throw new Error("useMidiMapping must be used within a MidiMappingProvider");
  }
  return context;
}
