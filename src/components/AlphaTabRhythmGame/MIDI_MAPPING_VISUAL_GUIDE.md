# MIDI Mapping Feature - Visual Guide

## User Interface Layout

### Main Rhythm Game View (No Changes)
```
┌────────────────────────────────────────────────────────┐
│                   AlphaTab Rhythm Game                  │
├────────────────────────────────────────────────────────┤
│                                                         │
│                    [Music Notation]                     │
│                                                         │
│              ◯ Perfect! +50 pts                        │
│                                                         │
│  Score: 450/500  |  Accuracy: 90%  |  Streak: 5      │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Practice Mode Settings Panel (NEW BUTTON ADDED)
```
┌──────────────────────────────────────────┐
│  ✕  Practice Mode Settings               │
├──────────────────────────────────────────┤
│  Quick access to essential settings      │
│                                          │
│  ▸ Display Control                       │
│    Scale: [========◯========] 1.0x      │
│                                          │
│  ▸ Player Control                        │
│    Volume: [====◯===============]        │
│    Metronome: [===◯==============]       │
│    BPM: [100 ↕ ↑ ↓]                    │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ [🎛️ MIDI MAPPING SETTINGS]  ← NEW   ││
│  │ Configure multi-zone drums           ││
│  └──────────────────────────────────────┘│
│                                          │
│  ▸ Visual Display                        │
│    ☑ Show Cursors                        │
│    ☑ Highlight Notes                    │
│                                          │
└──────────────────────────────────────────┘
```

### MIDI Mapping Settings Panel (NEW PANEL)
```
┌─────────────────────────────────────────────────────────┐
│  ✕  MIDI Mapping Settings                               │
├─────────────────────────────────────────────────────────┤
│  Configure mappings for multi-zone instruments          │
│                                                         │
│  ╔═══ Preset Selection ═════════════════════════════╗  │
│  ║  Preset: [▼ Yamaha DTX (Multi-zone)]            ║  │
│  ║  [Load] [Save as Custom]                        ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
│  ╔═══ Current Mappings ══════════════════════════════╗  │
│  ║  Ride (51)         → [51] [52] [53]  [+] [✕]   ║  │
│  ║  Crash 1 (55)      → [55] [56] [57]  [+] [✕]   ║  │
│  ║  Hi-Hat (42)       → [42] [44]       [+] [✕]   ║  │
│  ║                                                  ║  │
│  ║  [+ Add New Mapping]                            ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
│  ╔═══ Add MIDI Mapping ══════════════════════════════╗  │
│  ║  Target Note: [▼ Select target note...]         ║  │
│  ║                                                  ║  │
│  ║  MIDI Input Mode:                               ║  │
│  ║  ◉ Listen Mode    ○ Manual Input                ║  │
│  ║                                                  ║  │
│  ║  Status: Waiting for MIDI input... ⏳           ║  │
│  ║  (Hit your drum to capture MIDI note)           ║  │
│  ║                                                  ║  │
│  ║  Or enter manually: [Input field]               ║  │
│  ║                                                  ║  │
│  ║  [Add Mapping] [Cancel]                         ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
│  ╔═══ Custom Presets ════════════════════════════════╗  │
│  ║  My E-Drum Setup         [Load] [Delete]        ║  │
│  ║  Backup Configuration    [Load] [Delete]        ║  │
│  ║  Tournament Settings     [Load] [Delete]        ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## User Workflows

### Workflow 1: Load a Preset
```
User clicks "MIDI Mapping Settings"
         ↓
MIDI Mapping panel opens
         ↓
User selects "Yamaha DTX (Multi-zone)" from preset dropdown
         ↓
Mapping loads:
  - Ride: 51, 52, 53 → 51
  - Crash: 55, 56, 57 → 55
  - Hi-Hat: 42, 44 → 42
         ↓
"Current Mappings" section updates to show loaded config
         ↓
User clicks "Load" to apply mapping
         ↓
Practice settings close, mapping is active
         ↓
During gameplay:
  Hit ride edge (sends MIDI 52)
         ↓
  MIDI handler checks: 52 → 51
         ↓
  Score against notation note 51 ✓
```

### Workflow 2: Create Custom Mapping
```
User clicks "Add New Mapping"
         ↓
"Add MIDI Mapping" section expands
         ↓
User selects "Ride (51)" as target note
         ↓
User switches to "Listen Mode"
         ↓
Status shows: "Waiting for MIDI input..."
         ↓
User hits ride bell on e-drum (sends MIDI 51)
         ↓
System captures: midiNote = 51
         ↓
User hits ride edge (sends MIDI 52)
         ↓
System captures: midiNote = 52
         ↓
User hits ride bow (sends MIDI 53)
         ↓
System captures: midiNote = 53
         ↓
User clicks "Add Mapping"
         ↓
New entry created: { targetNote: 51, mappedNotes: [51, 52, 53] }
         ↓
"Current Mappings" displays:
  Ride (51) → [51] [52] [53]
         ↓
User clicks "Save as Custom"
         ↓
Dialog prompts for preset name
         ↓
Saves to LocalStorage under "My Custom Preset"
         ↓
Appears in "Custom Presets" section
```

### Workflow 3: Manual Entry
```
User selects "Ride (51)" as target
         ↓
User switches to "Manual Input"
         ↓
Manual input field appears with placeholder "51"
         ↓
User types "52" and hits enter (or presses + button)
         ↓
MIDI note 52 is added to mapping
         ↓
User repeats for MIDI 53
         ↓
Current mapping shows:
  Ride (51) → [51] [52] [53]
```

## State Flow During Gameplay

```
┌─────────────────────────────────────────────────────────┐
│                  MIDI Input Event Received              │
│                    midiNote: 52                          │
│                    velocity: 100                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              MidiRhythmGame MIDI Handler                │
│                                                         │
│  1. Get active mapping from context                    │
│     mapping = {                                         │
│       entries: [                                        │
│         { targetNote: 51, mappedNotes: [51,52,53] }   │
│       ]                                                 │
│     }                                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Resolve MIDI Note Through Mapping          │
│                                                         │
│  2. Check if MIDI 52 is in any entry's mappedNotes    │
│     Found: targetNote = 51                             │
│                                                         │
│  notesToMatch = [51]                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           Match Against Notation (EXISTING CODE)        │
│                                                         │
│  3. Find all notation notes matching MIDI 51           │
│     Found: Beat with note MIDI 51                      │
│                                                         │
│  4. Calculate timing accuracy                          │
│     Timing offset: -45ms → "Perfect"                  │
│                                                         │
│  5. Add success marker (green circle)                  │
│                                                         │
│  6. Update score                                        │
│     Previous: 450/500                                  │
│     Add: +50 (perfect hit)                             │
│     New: 500/500 ✓                                    │
└─────────────────────────────────────────────────────────┘
```

## Component Integration Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        App Component                          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                MidiMappingContext.Provider                    │
│        (Wraps entire rhythm game for state access)           │
└──────────────────────────────────────────────────────────────┘
                          ↓
            ┌─────────────┬─────────────┐
            ↓             ↓             ↓
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Practice     │ │ MIDI Mapping │ │ Rhythm Game  │
    │ Settings    │ │ Settings     │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘
           ↓                ↓                 ↓
           │ Button Opens   │ useContext      │ useContext
           │ Panel          │ getMappedNotes  │ getMapping
           └────────────────┴─────────────────┘
                          ↓
                Context.getMapping()
                          ↓
            localStorage (alphaTab_midi_mapping)
```

## Data Flow: Configuration to Scoring

```
    USER UI
    ┌─────────────────────────┐
    │ MidiMappingSettings     │
    │                         │
    │ Select "Yamaha DTX"     │
    │ Set Ride: 51,52,53→51   │
    │ Save Preset             │
    └────────────┬────────────┘
                 ↓ setMapping()
    ┌─────────────────────────────────┐
    │ MidiMappingContext              │
    │ activeMapping = {               │
    │   entries: [                    │
    │     {                           │
    │       targetNote: 51,           │
    │       mappedNotes: [51,52,53]   │
    │     }                           │
    │   ]                             │
    │ }                               │
    └────────────┬────────────────────┘
                 ↓ localStorage.setItem()
    ┌─────────────────────────────────┐
    │ Browser LocalStorage             │
    │ alphaTab_midi_mapping:          │
    │ { activeMapping: {...}, ... }   │
    └─────────────────────────────────┘


    GAMEPLAY
    ┌──────────────┐
    │ Hit Ride     │
    │ Bow Zone     │
    │ MIDI: 52     │
    └──────┬───────┘
           ↓
    ┌─────────────────────────────────┐
    │ MidiRhythmGame.handleMidiMessage │
    │                                  │
    │ const mapping = getMapping()     │
    │ // Get from context              │
    │                                  │
    │ const notesToMatch =             │
    │   mapping.entries                │
    │     .filter(e =>                 │
    │       e.mappedNotes.includes(52) │
    │     )                            │
    │     .map(e => e.targetNote)      │
    │   // Result: [51]                │
    └──────┬───────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │ addSuccessMarkersForMatchedNotes │
    │ Match MIDI 51 against notation   │
    │                                  │
    │ Found matching beat ✓            │
    │                                  │
    │ Add green circle                 │
    │ Update score +50                 │
    └─────────────────────────────────┘
```

## Component Relationships

```
MidiMappingContext
├── State
│   ├── activeMapping: MidiMapping
│   ├── customPresets: MidiMappingPreset[]
│   └── version: number
│
├── Methods
│   ├── getMapping()
│   ├── setMapping(mapping)
│   ├── getMappedNotes(targetNote)
│   ├── addMapping(targetNote, midiNote)
│   └── removeMapping(targetNote, midiNote)
│
└── Consumers
    ├── MidiMappingSettings (UI to edit)
    │   └── Uses: setMapping, addMapping, removeMapping
    │
    └── MidiRhythmGame (Scoring logic)
        └── Uses: getMapping, getMappedNotes


MidiMappingSettings
├── Props
│   ├── isOpen: boolean
│   └── onClose: () => void
│
├── Uses
│   ├── MidiMappingContext (get/set mappings)
│   ├── useMidiInput (listen for MIDI)
│   └── settingsSyncEmitter (sync with other components)
│
└── Emits
    └── settingsSyncEmitter.notify("midi-mapping-settings")


MidiRhythmGame
├── Props (unchanged)
│   └── api, isPlaying, currentTick, onAdd*, onClear*
│
├── Uses
│   ├── MidiMappingContext (resolve MIDI notes)
│   └── useMidiInput (existing MIDI input hook)
│
└── Changes
    ├── In handleMidiMessage:
    │   ├── Get mapping from context
    │   ├── Resolve mapped MIDI notes
    │   └── Pass target notes to matching logic
    └── Dependencies: [...existing, getMapping]
```

## Storage Schema

```
Browser LocalStorage
│
└── alphaTab_midi_mapping
    │
    ├── activeMapping
    │   ├── entries
    │   │   ├── [0]
    │   │   │   ├── targetNote: 51
    │   │   │   └── mappedNotes: [51, 52, 53]
    │   │   ├── [1]
    │   │   │   ├── targetNote: 55
    │   │   │   └── mappedNotes: [55, 56, 57]
    │   │   └── [...]
    │   ├── name: "Yamaha DTX"
    │   ├── createdAt: 1708396800000
    │   └── updatedAt: 1708396800000
    │
    ├── customPresets
    │   ├── [0]
    │   │   ├── id: "custom_1"
    │   │   ├── name: "My E-Drum Setup"
    │   │   ├── mapping: { entries: [...] }
    │   │   └── createdAt: 1708396800000
    │   └── [...]
    │
    └── version: 1
```

## Error Handling & Edge Cases

```
┌────────────────────────────────────┐
│ User Action                         │
└────────────────────────────────────┘
           ↓

       1. Mapping exists?
         ├─ NO → Use original MIDI note
         └─ YES → Continue

       2. MIDI note in any entry?
         ├─ NO → Treat as unmapped
         └─ YES → Continue

       3. Multiple targets for same input?
         ├─ YES → ERROR (prevent in UI)
         └─ NO → Continue

       4. Target note in notation?
         ├─ NO → No match found
         └─ YES → Success!

           ↓
┌────────────────────────────────────┐
│ Result: Score Updated or Error     │
└────────────────────────────────────┘
```

## Performance Characteristics

```
Operation          | Complexity | Time (typical)
───────────────────┼────────────┼──────────────────
Load context       | O(1)       | <1ms
Get mapping        | O(1)       | <1ms
Resolve MIDI note  | O(n)       | ~1-5ms (n=5-10)
Add mapping        | O(1)       | <1ms
Save to storage    | O(1)       | ~5-10ms
Load from storage  | O(1)       | ~5-10ms
```

n = number of mapping entries (typically 5-10)  
Operations in MIDI handler: ~2ms total overhead per MIDI event

## Performance Impact Assessment

- **Before**: MIDI event → handler → matching → score (existing flow)
- **After**: MIDI event → handler → **mapping resolution** → matching → score

**Added overhead**: 1-5ms per MIDI event (negligible, well below audio latency)
**No impact on rendering or state updates**
**LocalStorage access only on mount/settings change (not in hot path)**
