# MIDI Mapping Feature - Quick Reference Guide

## What Problem Does This Solve?

E-drums have multiple zones that send different MIDI notes:
- **Ride cymbal**: bell, edge, bow → Different MIDI notes (e.g., 51, 52, 53)
- **Crash cymbals**: edge, bow → Different MIDI notes
- **Multi-zone pads**: multiple strike zones → Different MIDI notes

But most drum notations use a **single MIDI note** per instrument. This feature maps multiple MIDI inputs to one notation note, so all zones count as valid hits.

**Example**: 
```
E-drum sends: MIDI 51, 52, or 53 when hitting ride cymbal
Notation expects: MIDI 51
Result: All three MIDI inputs (51, 52, 53) count as valid score
```

## Architecture at a Glance

```
User UI (MidiMappingSettings)
           ↓
    Context (MidiMappingContext)
     ↙              ↘
LocalStorage      MidiRhythmGame
                      ↓
                 Scoring Engine
                      ↓
                  Score/Markers
```

## Key Components

### 1. **MidiMappingContext** (`midi-mapping-context.tsx`)
- **What it does**: Manages MIDI mapping state and persistence
- **Key methods**:
  - `getMapping()` - Get current mapping
  - `setMapping(mapping)` - Update mapping
  - `getMappedNotes(targetNote)` - Get all MIDI notes that map to a target
- **Storage**: LocalStorage key `alphaTab_midi_mapping`

### 2. **MidiMappingSettings** (`midi-mapping-settings.tsx`)
- **What it does**: UI panel for configuring MIDI mappings
- **Features**:
  - Preset dropdown (Yamaha DTX, Roland TD-50, etc.)
  - View current mappings
  - Add/remove mappings
  - Listen mode for MIDI input
  - Save custom presets

### 3. **Presets** (`midi-mapping-presets.tsx`)
- **What it does**: Stores pre-configured mapping templates
- **Includes**: Yamaha DTX, Roland TD-50, and other common drum kits

### 4. **MidiRhythmGame** (MODIFIED)
- **What changes**: Apply mapping to incoming MIDI notes
- **When**: In the MIDI handler, check if incoming note maps to any target notes
- **How**: Before matching against notation, resolve mapped MIDI notes

## Data Structure

```typescript
// One mapping entry
{
  targetNote: 51,           // The note in the notation
  mappedNotes: [51, 52, 53] // MIDI inputs that map to it
}

// Complete mapping
{
  entries: [
    { targetNote: 51, mappedNotes: [51, 52, 53] }, // Ride
    { targetNote: 55, mappedNotes: [55, 58] },     // Crash 1
    { targetNote: 42, mappedNotes: [42, 44] },     // Hihat
  ],
  name: "My E-Drum Setup",
  createdAt: 1708396800000,
  updatedAt: 1708396800000,
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (3 files)
Create the context, presets, and settings UI in isolation.
- `midi-mapping-context.tsx` - State management
- `midi-mapping-presets.tsx` - Preset templates
- `midi-mapping-settings.tsx` - Settings UI panel

### Phase 2: Scoring Integration (1 modification)
Hook context into the scoring logic.
- Modify `MidiRhythmGame.tsx` - Apply mapping in MIDI handler

### Phase 3: UI Integration (1 modification)
Connect to practice settings.
- Modify `practice-mode-settings.tsx` - Add open button

## How MIDI Mapping Works (Flow)

```
1. User configures: "Map MIDI 51, 52, 53 to target 51"
                    ↓
2. User hits drum (sends MIDI 52)
                    ↓
3. MIDI handler receives event with midiNote: 52
                    ↓
4. Check mapping: "Does MIDI 52 appear in any entry?"
                    ↓
5. Find: Entry with targetNote: 51 has 52 in mappedNotes
                    ↓
6. Resolve to target: 52 → 51
                    ↓
7. Match against notation note 51
                    ↓
8. Matching succeeds → Green circle + score
```

## Key Design Decisions

1. **Pattern Reuse**: UI structure matches `practice-mode-settings.tsx` for consistency
2. **Settings Sync**: Uses existing `settingsSyncEmitter` for cross-tab sync
3. **LocalStorage**: Mappings persist without backend
4. **No Breaking Changes**: Feature is optional and defaults to "no mapping"
5. **Performance**: Mapping lookup is O(n) where n is number of entries (typically 5-10)

## File Locations

```
src/components/AlphaTabRhythmGame/
├── midi-mapping-context.tsx          ← NEW
├── midi-mapping-settings.tsx         ← NEW
├── midi-mapping-presets.tsx          ← NEW
├── MidiRhythmGame.tsx                ← MODIFY
├── practice-mode-settings.tsx        ← MODIFY
└── styles.module.scss                ← ADD styles
```

## Testing Strategy

**Unit Tests**:
- Context getMapping/setMapping
- Mapping resolution logic
- Preset loading

**Integration Tests**:
- MIDI handler receives event → resolves to target → matches note
- Presets apply correctly
- LocalStorage persists

**E2E Tests**:
- Configure mapping in UI
- Hit drums → verify score updates
- Switch presets → verify mapping changes
- Refresh page → verify mapping persists

## Edge Cases to Handle

1. **No mapping configured**: Fall back to original MIDI note
2. **Unmapped MIDI note**: Treat as-is (no mapping applies)
3. **MIDI note maps to multiple targets**: Not valid (prevent in UI)
4. **Duplicate entries**: Validate and prevent
5. **Large mapping lists**: Performance should remain acceptable

## Benefits

✅ Support multi-zone e-drums  
✅ Users can customize for their kit  
✅ Pre-configured presets for common drums  
✅ Persistent across sessions  
✅ Similar UI to existing practice settings  
✅ No breaking changes  

## Future Enhancements

- Import/export mappings as JSON
- Auto-detect multi-zone zones
- Per-song mapping profiles
- Visual drum kit diagram
- Velocity-based mappings
