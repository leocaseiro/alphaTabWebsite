# MIDI Rhythm Game Features

This document detailed the features in the MIDI rhythm game.

## Implemented

## Must Implement

- [x] test MusicXML
- rename to alphatabhero
- add beta
- deploy to GH Pages
- [x] add buttons for
  - [x] loop
  - [x] count in,
  - [x] metronome
- [x] add bpm button
- add buttons for UI
  - [x] page/horizontal
  - [x] scale
  - [x] stretch
- volume control (backing track, metronome, guide notes)
  [x] display streak, and score on UI
  [x] **MIDI MAPPING FEATURE (NEW)** - Map multiple MIDI inputs to single notation
  [x] map midi simple, advanced (double kick, edge, bow, bell, etc)
  [x] auto bpm (reset score on each loop), Select minimal score, select bpm to increase by, number of attempts,
- map auto
  [x] good notes display in blue, early (orange) and purple (late)
- shortcuts (play, pause, restart, etc)
- configuration for GOOD (ms), PERFECT (ms)
- documentation to use chrome with (GPU, and memory saver)
- test on Android (tablet)
- test on iPad (webmidi)
- test on old mac Intel
- test on old macmini (maybe need another browser)
- save settings (localstorage or indexedDB)
- memory (draw blank on top of the score, and only display the notation on errors)
- preload drawing positions
- pre check missing map midis (analyse song)
- select what track to match
- warning when multiple midi devices are connected
- detect repeats, and warning
- test on Windows
- test piano features

## Nice to have Implement

- add analytics
- improve game with media sync (audio/youtube). Control synth or BackingTrack
- cursor style
- repeat from settings (start - finish)
- separate early from late on good
- improve early / late / missed detection
- ignore error drawings (e.g. pedal hihat)
- ignore error score (e.g. pedal hihat), or learning song by pad
- set colors for perfect, good, error
- set colors for early, late
- display gray for missed
- chrome warning for latency, power mode, etc
- save uploaded songs
- save score
  - whole song in detail
  - whole song score
  - only last score
  - highest score
- share results (PDF, CSV?)
- daily streak (one of Melodics fans)
- piano roll (vertical, horizontal) aka falling notes or falling blocks
- piano map (lowest note, highest note)
- integrate sync to Google Drive, Dropbox? (avoid paid)
- import from groovescribe
- import from drum \*.midi
- ghost notes (detect)
- display dynamics chart
- use electron, tauri or similar
- iOS app (webmidi https://github.com/mizuhiki/WebMIDIAPIShimForiOS)
- errors analyse (tooltip why missed, error, and display on hover)
- auto detect needs practice mode (if too many errors, suggest practice in slower tempo)
- colorblind feedback (will circle and cross be enough, or maybe we need to instead remove correct notes, like instaDrum) -\[ \] post on social media. Old posts from reddit, youtube, etc, asking for alternatives to:
  - Melodics
  - InstaDrum
  - Beatlii (aka freedrum)
  - Rhythm Master (律动达人 iOS id1516996442) or (安卓手机或者平板通过下面这个网址下载) https://www.yinlv.vip/sy
  - Roland DT-1 | V-Drums Tutor
  - Roland DT-HD-1 Drum Tutor
  - Roland V31 (coach mode with Phrase Trainer, Stroke Monitor)
  - Drumeo
  - Soundslice
  - Drumthesia
  - playonlinedrums
  - Guitar Hero drums
  - Rockband drums
  - Clone Hero drums
  - YARG drums
  - Phase Shifter
  - Drummania
  - DTXmania / Stepmania
  - Synthesia
  - VR games (Paradiddle, Beat Smith, Smash Drums, Drums Rock, DrumBeats, VR Drums Ultimate Streamer, Air Drums)
  - drums rhythm games (gitadora, beatmania)
- publish on alternate.to and similars
- create a discord
- dark mode
- UI with drum hihglighted on guide notes, and feedback play
