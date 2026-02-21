# MIDI Mapping Feature - Implementation Summary

## Overview

A comprehensive plan has been created to implement MIDI mapping functionality in the AlphaTab Rhythm Game. This feature enables mapping multiple MIDI inputs from e-drums to single notation notes, solving the multi-zone drum problem.

## Plan Documents

### 📋 [`MIDI_MAPPING_PLAN.md`](./MIDI_MAPPING_PLAN.md)
**Comprehensive implementation guide** (500+ lines)

Contains:
- Full architecture diagrams (mermaid)
- Data flow sequences (mermaid)
- Type definitions and interfaces
- State management design
- UI component specifications
- Preset examples
- Implementation phases with dependencies
- Detailed task breakdowns with checklists
- Testing strategy

### 📖 [`MIDI_MAPPING_QUICK_REF.md`](./MIDI_MAPPING_QUICK_REF.md)
**Quick reference guide** (180+ lines)

Contains:
- Problem statement
- Architecture overview
- Component descriptions
- Data structure examples
- Implementation phases summary
- Flow diagrams
- Key design decisions
- Future enhancements

## What Gets Built

### New Files (3)

1. **`midi-mapping-context.tsx`**
   - React Context for MIDI mapping state management
   - Type definitions (MidiMapping, MidiMappingEntry)
   - LocalStorage integration (key: `alphaTab_midi_mapping`)
   - Settings sync emitter integration
   - Custom hook: `useMidiMapping()`
   - Methods: getMapping(), setMapping(), getMappedNotes(), addMapping(), removeMapping()

2. **`midi-mapping-settings.tsx`**
   - Settings panel UI (similar to `practice-mode-settings.tsx`)
   - Preset selection dropdown
   - Current mappings display
   - MIDI note picker with listen mode
   - Add/remove mapping controls
   - Custom preset management
   - Styled components with animations

3. **`midi-mapping-presets.tsx`**
   - Preset definitions (Yamaha DTX, Roland TD-50, etc.)
   - Common drum kit configurations
   - Preset utility functions
   - Expandable for future drum kits

### Modified Files (2)

1. **`MidiRhythmGame.tsx`**
   - Import and use `useMidiMapping()` hook
   - In MIDI handler, resolve incoming MIDI note through mapping
   - Pass mapped target notes to matching logic
   - ~10-15 lines of code changes

2. **`practice-mode-settings.tsx`**
   - Add state for MIDI mapping panel visibility
   - Add button to open/close mapping settings
   - Pass necessary props to MIDI mapping settings component
   - ~20-30 lines of code changes

### Style Updates

- **`styles.module.scss`** - Add styles for:
  - MIDI mapping settings panel
  - Mapping entries display
  - MIDI note picker controls
  - Preset selection components
  - Animation effects

## How It Works

### User Journey

1. User opens **Practice Mode Settings** → clicks "MIDI Mapping" button
2. **MIDI Mapping Settings** panel opens
3. User selects preset (e.g., "Yamaha DTX") OR creates custom mapping:
   - Click "Add Mapping"
   - Select target note from notation
   - Click "Listen" and hit drum zone, or manually enter MIDI number
   - System adds entry: `{ targetNote: 51, mappedNotes: [52] }`
4. Mapping is saved to LocalStorage
5. During gameplay:
   - User hits drum zone sending MIDI 52
   - MIDI handler checks: "52 maps to target 51"
   - Scoring engine matches against notation note 51
   - Green circle appears, score updates

### Scoring Integration

```typescript
// MIDI handler receives event with midiNote: 52
const mapping = getMapping(); // Get active mapping config

// Resolve mapped notes
const notesToMatch = mapping
  ? mapping.entries
      .filter(entry => entry.mappedNotes.includes(52))
      .map(entry => entry.targetNote) // Result: [51]
  : [52];

// Match against notation
addSuccessMarkersForMatchedNotes(api, currentTick, notesToMatch);
```

## Implementation Roadmap

### Phase 1: Core Infrastructure ✓ (Planned)
- [ ] Create `midi-mapping-context.tsx`
- [ ] Create `midi-mapping-presets.tsx`
- [ ] Create `midi-mapping-settings.tsx`
- [ ] Add SCSS styles

**Duration**: ~4-5 hours  
**Dependencies**: None

### Phase 2: Scoring Integration ✓ (Planned)
- [ ] Modify `MidiRhythmGame.tsx`
- [ ] Update helper functions if needed
- [ ] Integration testing

**Duration**: ~1-2 hours  
**Dependencies**: Phase 1 complete

### Phase 3: UI Integration ✓ (Planned)
- [ ] Modify `practice-mode-settings.tsx`
- [ ] E2E testing
- [ ] Documentation

**Duration**: ~1-2 hours  
**Dependencies**: Phase 1 & 2 complete

**Total Estimated Time**: 6-9 hours

## Key Features

✅ **Multi-zone Support** - Map multiple MIDI inputs to single notation note  
✅ **Presets** - Pre-configured templates for common drum kits  
✅ **Custom Mappings** - Users can create and save custom configurations  
✅ **Persistent** - Mappings saved to LocalStorage  
✅ **Consistent UI** - Matches existing practice settings design  
✅ **No Breaking Changes** - Feature is optional, defaults to no mapping  
✅ **Real-time Sync** - Uses existing settingsSyncEmitter for multi-tab sync  

## Technical Highlights

### Type Safety
- Full TypeScript interfaces for all data structures
- Type-safe context with custom hook
- No `any` types in mapping logic

### Performance
- O(n) mapping lookup (n = typically 5-10 entries)
- Minimal overhead in hot path (MIDI handler)
- No unnecessary re-renders

### Reliability
- LocalStorage schema versioning for migration
- Fallback to no mapping if config corrupted
- Validation on mapping creation

### Extensibility
- Easy to add new presets
- Support for future drum kits
- Foundation for velocity-based mappings

## Data Structures

### MidiMapping
```typescript
interface MidiMapping {
  entries: MidiMappingEntry[];
  name?: string;
  createdAt?: number;
  updatedAt?: number;
}
```

### MidiMappingEntry
```typescript
interface MidiMappingEntry {
  targetNote: number;      // Note in notation
  mappedNotes: number[];   // MIDI inputs that map to it
}
```

### LocalStorage Format
```json
{
  "activeMapping": {
    "entries": [
      { "targetNote": 51, "mappedNotes": [51, 52, 53] }
    ]
  },
  "customPresets": [],
  "version": 1
}
```

## Preset Examples

### Yamaha DTX (Multi-zone)
- Ride: MIDI 51, 52, 53 → target 51
- Crash 1: MIDI 55, 56, 57 → target 55
- Crash 2: MIDI 49, 50 → target 49

### Roland TD-50
- Ride: MIDI 51, 59 → target 51
- Crash 1: MIDI 55, 58 → target 55

## Testing Coverage

- **Unit**: Context methods, mapping resolution
- **Integration**: MIDI event → mapping → scoring
- **E2E**: UI interaction → persist → refresh
- **Edge cases**: Empty mapping, unmapped notes, duplicates

## Deliverables

1. **MIDI_MAPPING_PLAN.md** - Comprehensive technical documentation
2. **MIDI_MAPPING_QUICK_REF.md** - Quick reference guide
3. **Three new components** - Context, presets, settings UI
4. **Two modified components** - MidiRhythmGame, practice settings
5. **Complete implementation** - Fully functional feature with tests
6. **Documentation** - Inline comments and JSDoc

## Next Steps

Ready to proceed with implementation:

1. **Review Plan**: Examine MIDI_MAPPING_PLAN.md for detailed specs
2. **Start Phase 1**: Create the three core files
3. **Test in Isolation**: Verify context and UI work independently
4. **Integrate Scoring**: Hook into MidiRhythmGame
5. **Connect UI**: Add button to practice settings
6. **Test End-to-End**: Verify complete workflow
7. **Deploy**: Merge to develop branch

## Questions & Clarifications

Before starting implementation, confirm:

1. Should we support multiple mapping profiles per song? (Currently: single global)
2. Should presets be expandable by users? (Currently: fixed presets + custom)
3. Should we include import/export functionality? (Currently: no)
4. Do you want a visual drum kit diagram? (Currently: no)
5. Should mappings sync to cloud? (Currently: LocalStorage only)

## Success Criteria

✅ Feature complete when:
- All three components created and tested
- Integration with MidiRhythmGame working
- MIDI 51, 52, 53 all score for notation note 51
- Presets load and apply correctly
- Custom mappings persist after refresh
- No performance degradation
- All tests passing
- Documentation complete
