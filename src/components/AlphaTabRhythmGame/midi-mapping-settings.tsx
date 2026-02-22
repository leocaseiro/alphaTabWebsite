"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { useMidiInput, MidiInputEvent } from "./useMidiInput";
import { useMidiMapping } from "./midi-mapping-context";
import {
  BUILTIN_PRESETS,
  getPresetById,
  getMappingDescription,
  clonePresetMapping,
  getMidiNoteName,
} from "./midi-mapping-presets";
import { settingsSyncEmitter } from "./settings-sync";
import styles from "./styles.module.scss";

// ============================================================================
// Types
// ============================================================================

interface MidiMappingSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type ListenMode = "inactive" | "listening" | "received";

// ============================================================================
// Component
// ============================================================================

/**
 * MIDI Mapping Settings Panel
 * Allows users to configure MIDI note mappings for multi-zone instruments
 */
export const MidiMappingSettings: React.FC<MidiMappingSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    getMapping,
    setMapping,
    getMappedNotes,
    addMapping,
    removeMapping,
    saveCustomPreset,
    deleteCustomPreset,
    getCustomPresets,
    getIgnoredMidiNotes,
    setIgnoredMidiNotes,
    addIgnoredMidiNote,
    removeIgnoredMidiNote,
    getSkippedNotationNotes,
    addSkippedNotationNote,
    removeSkippedNotationNote,
  } = useMidiMapping();

  // State management
  const [selectedPresetId, setSelectedPresetId] =
    useState<string>("no-mapping");
  const [listenMode, setListenMode] = useState<ListenMode>("inactive");
  const [receivedMidiNote, setReceivedMidiNote] = useState<number | null>(null);
  const [selectedTargetNote, setSelectedTargetNote] = useState<number | null>(
    null,
  );
  const [manualMidiInput, setManualMidiInput] = useState<string>("");
  const [customPresets, setCustomPresets] = useState(getCustomPresets());
  const [presetName, setPresetName] = useState<string>("");
  const [ignoredMidiNotes, setIgnoredMidiNotesState] = useState(
    getIgnoredMidiNotes(),
  );
  const [skippedNotationNotes, setSkippedNotationNotesState] = useState(
    getSkippedNotationNotes(),
  );
  const customPresetsRef = useRef(customPresets);

  // Update custom presets ref when they change
  useEffect(() => {
    customPresetsRef.current = getCustomPresets();
    setCustomPresets(customPresetsRef.current);
  }, [getCustomPresets]);

  // MIDI input handler for listen mode
  const handleMidiMessage = useCallback(
    (event: MidiInputEvent) => {
      if (event.type === "noteOn" && listenMode === "listening") {
        setReceivedMidiNote(event.midiNote);
        setListenMode("received");

        if (process.env.NODE_ENV === "development") {
          console.log("MIDI Mapping: Received MIDI note", event.midiNote);
        }
      }
    },
    [listenMode],
  );

  // Initialize MIDI input hook
  const { isSupported, isConnected } = useMidiInput(
    handleMidiMessage,
    listenMode === "listening",
  );

  // Handle preset selection
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = getPresetById(presetId);
    if (preset) {
      const mapping = preset.mapping.entries.length > 0 ? preset.mapping : null;
      setMapping(mapping);
    }
  };

  // Handle adding mapping from listen or manual input
  const handleAddMapping = () => {
    let midiNote: number | null = null;

    if (listenMode === "received" && receivedMidiNote !== null) {
      midiNote = receivedMidiNote;
    } else if (manualMidiInput !== "") {
      const parsed = parseInt(manualMidiInput, 10);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 127) {
        midiNote = parsed;
      }
    }

    if (midiNote === null || selectedTargetNote === null) {
      return;
    }

    addMapping(selectedTargetNote, midiNote);

    // Reset UI
    setReceivedMidiNote(null);
    setListenMode("inactive");
    setManualMidiInput("");
    setSelectedTargetNote(null);

    settingsSyncEmitter.notify("midi-mapping-settings");
  };

  // Handle starting listen mode
  const handleStartListening = () => {
    if (isConnected) {
      setListenMode("listening");
      setReceivedMidiNote(null);
    }
  };

  // Handle saving as custom preset
  const handleSaveCustomPreset = () => {
    if (!presetName.trim()) {
      return;
    }

    const mapping = getMapping();
    if (!mapping || mapping.entries.length === 0) {
      return;
    }

    const customPreset = {
      id: `custom_${Date.now()}`,
      name: presetName.trim(),
      description: getMappingDescription(mapping),
      mapping,
      createdAt: Date.now(),
    };

    saveCustomPreset(customPreset);
    setPresetName("");
    setCustomPresets(getCustomPresets());
    settingsSyncEmitter.notify("midi-mapping-settings");
  };

  // Handle loading custom preset
  const handleLoadCustomPreset = (presetId: string) => {
    const preset = customPresetsRef.current.find((p) => p.id === presetId);
    if (preset) {
      setMapping(preset.mapping);
      setSelectedPresetId(presetId);
    }
  };

  // Handle deleting custom preset
  const handleDeleteCustomPreset = (presetId: string) => {
    deleteCustomPreset(presetId);
    setCustomPresets(getCustomPresets());
    settingsSyncEmitter.notify("midi-mapping-settings");
  };

  // Current mapping for display
  const currentMapping = getMapping();

  // Listen mode status message
  const getListenStatusMessage = () => {
    if (!isSupported) {
      return "Web MIDI API not supported";
    }
    if (!isConnected) {
      return "No MIDI devices connected";
    }
    if (listenMode === "listening") {
      return "Listening for MIDI input... Hit your drum";
    }
    if (listenMode === "received") {
      return `Received MIDI note: ${receivedMidiNote}`;
    }
    return "Click Listen to capture MIDI input";
  };

  const mappingDescription = getMappingDescription(currentMapping);

  return (
    <div
      className={`${styles["at-settings"]} ${styles["at-midi-mapping-settings"]} shadow--tl ${isOpen ? styles.open : ""}`}
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={() => onClose()}
        className={`button button--sm button--primary button--outline ${styles["at-settings-close"]}`}
        title="Close MIDI Mapping Settings"
      >
        <FontAwesomeIcon icon={solid.faClose} />
      </button>

      {/* Header */}
      <div className={styles["at-settings-header"]}>
        <h3>
          <FontAwesomeIcon icon={solid.faMusic} /> MIDI Mapping
        </h3>
        <p>Map multiple MIDI inputs to notation notes</p>
        <p className={styles["mapping-status"]}>{mappingDescription}</p>
      </div>

      {/* Preset Selection */}
      <div className={styles["at-settings-group"]}>
        <h4>Preset Selection</h4>

        <div className={styles["preset-selector"]}>
          <label htmlFor="preset-dropdown">Preset:</label>
          <select
            id="preset-dropdown"
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className={styles.select}
          >
            {BUILTIN_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            {customPresets.length > 0 && (
              <optgroup label="Custom Presets">
                {customPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {selectedPresetId !== "no-mapping" && (
          <p className={styles["preset-description"]}>
            {getPresetById(selectedPresetId)?.description || ""}
          </p>
        )}
      </div>

      {/* Current Mappings */}
      {currentMapping && currentMapping.entries.length > 0 && (
        <div className={styles["at-settings-group"]}>
          <h4>Current Mappings</h4>

          <div className={styles["mappings-list"]}>
            {currentMapping.entries.map((entry) => (
              <div key={entry.targetNote} className={styles["mapping-entry"]}>
                <div className={styles["mapping-target"]}>
                  <strong>
                    {entry.targetNote} - {getMidiNoteName(entry.targetNote)}
                  </strong>
                </div>

                <div className={styles["mapping-inputs"]}>
                  {entry.mappedNotes.map((midiNote) => (
                    <span
                      key={midiNote}
                      className={styles["midi-note"]}
                      title={getMidiNoteName(midiNote)}
                    >
                      {midiNote}
                      <button
                        type="button"
                        onClick={() =>
                          removeMapping(entry.targetNote, midiNote)
                        }
                        className={styles["remove-note"]}
                        title={`Remove MIDI ${midiNote} - ${getMidiNoteName(midiNote)}`}
                      >
                        <FontAwesomeIcon icon={solid.faTimes} />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedTargetNote(entry.targetNote)}
                    className={styles["add-to-mapping"]}
                    title={`Add more MIDI inputs to ${getMidiNoteName(entry.targetNote)}`}
                  >
                    <FontAwesomeIcon icon={solid.faPlus} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add MIDI Mapping */}
      <div className={styles["at-settings-group"]}>
        <h4>Add MIDI Mapping</h4>

        <div className={styles["add-mapping-form"]}>
          {/* Target Note Selector */}
          <div className={styles["form-group"]}>
            <label htmlFor="target-note-select">
              Target Note (in notation):
            </label>
            <select
              id="target-note-select"
              value={selectedTargetNote ?? ""}
              onChange={(e) =>
                setSelectedTargetNote(
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              className={styles.select}
            >
              <option value="">Select target note...</option>
              {Array.from({ length: 128 }, (_, i) => {
                const name = getMidiNoteName(i);
                return (
                  <option key={i} value={i}>
                    {i} - {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Listen Mode */}
          <div className={styles["form-group"]}>
            <label>MIDI Input Mode:</label>
            <div className={styles["mode-selector"]}>
              <label className={styles["radio-label"]}>
                <input
                  type="radio"
                  name="midi-mode"
                  value="listen"
                  checked={listenMode !== "inactive"}
                  onChange={() => {
                    if (isConnected) {
                      handleStartListening();
                    }
                  }}
                  disabled={!isConnected}
                />
                Listen Mode
              </label>

              <label className={styles["radio-label"]}>
                <input
                  type="radio"
                  name="midi-mode"
                  value="manual"
                  checked={listenMode === "inactive"}
                  onChange={() => setListenMode("inactive")}
                />
                Manual Input
              </label>
            </div>
          </div>

          {/* Listen Status / Manual Input */}
          {listenMode !== "inactive" ? (
            <div className={styles["listen-status"]}>
              <div
                className={styles["status-indicator"]}
                data-status={listenMode}
              >
                {listenMode === "listening" && (
                  <span className={styles.pulse} />
                )}
              </div>
              <span className={styles["status-message"]}>
                {getListenStatusMessage()}
                {listenMode === "received" && receivedMidiNote !== null && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.9em",
                      marginTop: "0.3rem",
                    }}
                  >
                    {receivedMidiNote} - {getMidiNoteName(receivedMidiNote)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setListenMode("inactive");
                  setReceivedMidiNote(null);
                }}
                className="button button--sm button--outline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className={styles["form-group"]}>
              <label htmlFor="manual-midi-input">
                MIDI Note Number or Name:
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "flex-end",
                }}
              >
                <div style={{ flex: 1 }}>
                  <input
                    id="manual-midi-input"
                    type="number"
                    min="0"
                    max="127"
                    value={manualMidiInput}
                    onChange={(e) => setManualMidiInput(e.target.value)}
                    placeholder="0-127"
                    className={styles["text-input"]}
                  />
                </div>
                {manualMidiInput &&
                  !Number.isNaN(parseInt(manualMidiInput, 10)) && (
                    <span
                      style={{
                        fontSize: "0.85rem",
                        opacity: 0.7,
                        whiteSpace: "nowrap",
                        paddingBottom: "0.25rem",
                      }}
                    >
                      {getMidiNoteName(parseInt(manualMidiInput, 10))}
                    </span>
                  )}
              </div>
            </div>
          )}

          {/* Add Button */}
          <button
            type="button"
            onClick={handleAddMapping}
            disabled={
              !selectedTargetNote ||
              (listenMode !== "received" && !manualMidiInput)
            }
            className="button button--sm button--primary"
          >
            <FontAwesomeIcon icon={solid.faPlus} /> Add Mapping
          </button>
        </div>
      </div>

      {/* Save Custom Preset */}
      {currentMapping && currentMapping.entries.length > 0 && (
        <div className={styles["at-settings-group"]}>
          <h4>Save as Custom Preset</h4>

          <div className={styles["form-group"]}>
            <label htmlFor="preset-name-input">Preset Name:</label>
            <input
              id="preset-name-input"
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., My E-Drum Setup"
              className={styles["text-input"]}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveCustomPreset}
            disabled={!presetName.trim()}
            className="button button--sm button--primary"
          >
            <FontAwesomeIcon icon={solid.faSave} /> Save Preset
          </button>
        </div>
      )}

      {/* Custom Presets List */}
      {customPresets.length > 0 && (
        <div className={styles["at-settings-group"]}>
          <h4>Custom Presets</h4>

          <div className={styles["presets-list"]}>
            {customPresets.map((preset) => (
              <div key={preset.id} className={styles["preset-item"]}>
                <div className={styles["preset-info"]}>
                  <strong>{preset.name}</strong>
                  <small>{preset.description}</small>
                </div>

                <div className={styles["preset-actions"]}>
                  <button
                    type="button"
                    onClick={() => handleLoadCustomPreset(preset.id)}
                    className="button button--sm button--outline"
                    title="Load this preset"
                  >
                    Load
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCustomPreset(preset.id)}
                    className="button button--sm button--outline button--danger"
                    title="Delete this preset"
                  >
                    <FontAwesomeIcon icon={solid.faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MIDI Device Status */}
      <div className={styles["at-settings-group"]}>
        <h4>MIDI Device Status</h4>

        <div className={styles["device-status"]}>
          {!isSupported ? (
            <p className={styles["status-error"]}>
              <FontAwesomeIcon icon={solid.faExclamationTriangle} /> Web MIDI
              API not supported in this browser
            </p>
          ) : isConnected ? (
            <p className={styles["status-success"]}>
              <FontAwesomeIcon icon={solid.faCheckCircle} /> MIDI device
              connected and ready
            </p>
          ) : (
            <p className={styles["status-warning"]}>
              <FontAwesomeIcon icon={solid.faInfoCircle} /> No MIDI devices
              detected. Connect an e-drum kit to use listen mode
            </p>
          )}
        </div>
      </div>

      {/* Ignore Errors */}
      <div className={styles["at-settings-group"]}>
        <h4>Ignore Errors</h4>
        <p className={styles["ignore-description"]}>
          Select MIDI inputs to ignore errors from (e.g., accidental pedal hits
          won't mark as wrong)
        </p>

        <div className={styles["ignored-notes-list"]}>
          {ignoredMidiNotes.length > 0 ? (
            ignoredMidiNotes.map((midiNote) => (
              <div key={midiNote} className={styles["ignored-note-badge"]}>
                <span>
                  {midiNote} - {getMidiNoteName(midiNote)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    removeIgnoredMidiNote(midiNote);
                    setIgnoredMidiNotesState(
                      ignoredMidiNotes.filter((note) => note !== midiNote),
                    );
                  }}
                  className={styles["remove-ignored-note"]}
                  title={`Stop ignoring errors from MIDI ${midiNote}`}
                >
                  <FontAwesomeIcon icon={solid.faTimes} />
                </button>
              </div>
            ))
          ) : (
            <p className={styles["no-ignored"]}>No MIDI notes being ignored</p>
          )}
        </div>

        <label htmlFor="ignore-midi-select" className={styles["ignore-label"]}>
          Add MIDI note to ignore:
        </label>
        <select
          id="ignore-midi-select"
          onChange={(e) => {
            const midiNote = parseInt(e.target.value, 10);
            if (!Number.isNaN(midiNote)) {
              addIgnoredMidiNote(midiNote);
              setIgnoredMidiNotesState(
                [...ignoredMidiNotes, midiNote].sort((a, b) => a - b),
              );
              e.target.value = "";
            }
          }}
          defaultValue=""
          className={styles.select}
        >
          <option value="">Select note to ignore...</option>
          {Array.from({ length: 128 }, (_, i) => {
            const name = getMidiNoteName(i);
            const isAlreadyIgnored = ignoredMidiNotes.includes(i);
            return (
              <option key={i} value={i} disabled={isAlreadyIgnored}>
                {i} - {name}
                {isAlreadyIgnored ? " (already ignored)" : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* Skip Notation Notes (Practice Focus) */}
      <div className={styles["at-settings-group"]}>
        <h4>Skip Notation Notes</h4>
        <p className={styles["ignore-description"]}>
          Select notation notes to skip during practice. Hits on skipped notes
          won't be scored and missing them won't count as an error — useful for
          focusing on specific parts (e.g., hi-hat only).
        </p>

        <div className={styles["ignored-notes-list"]}>
          {skippedNotationNotes.length > 0 ? (
            skippedNotationNotes.map((midiNote) => (
              <div
                key={midiNote}
                className={`${styles["ignored-note-badge"]} ${styles["skipped-note-badge"]}`}
              >
                <span>
                  {midiNote} - {getMidiNoteName(midiNote)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    removeSkippedNotationNote(midiNote);
                    setSkippedNotationNotesState(
                      skippedNotationNotes.filter((note) => note !== midiNote),
                    );
                    settingsSyncEmitter.notify("midi-mapping-settings");
                  }}
                  className={styles["remove-ignored-note"]}
                  title={`Stop skipping notation note ${midiNote}`}
                >
                  <FontAwesomeIcon icon={solid.faTimes} />
                </button>
              </div>
            ))
          ) : (
            <p className={styles["no-ignored"]}>
              No notation notes being skipped
            </p>
          )}
        </div>

        <label
          htmlFor="skip-notation-select"
          className={styles["ignore-label"]}
        >
          Add notation note to skip:
        </label>
        <select
          id="skip-notation-select"
          onChange={(e) => {
            const midiNote = parseInt(e.target.value, 10);
            if (!Number.isNaN(midiNote)) {
              addSkippedNotationNote(midiNote);
              setSkippedNotationNotesState(
                [...skippedNotationNotes, midiNote].sort((a, b) => a - b),
              );
              settingsSyncEmitter.notify("midi-mapping-settings");
              e.target.value = "";
            }
          }}
          defaultValue=""
          className={styles.select}
        >
          <option value="">Select notation note to skip...</option>
          {Array.from({ length: 128 }, (_, i) => {
            const name = getMidiNoteName(i);
            const isAlreadySkipped = skippedNotationNotes.includes(i);
            return (
              <option key={i} value={i} disabled={isAlreadySkipped}>
                {i} - {name}
                {isAlreadySkipped ? " (already skipped)" : ""}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
};
