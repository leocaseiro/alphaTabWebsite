# MIDI Rhythm Game Features

This document detailed the features in the MIDI rhythm game.

## Implemented

## Must Implement

- [x] test MusicXML
- rename to alphatabhero
- add beta
  [x] deploy to GH Pages
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
- configuration for latency (Especially noticeable on Android tablets)
- support select loop on mobile (touchscreen is not very easy to select in the UI atm)
- support count-in for Media Sync (might be worth to fix in alphatab https://github.com/CoderLine/alphaTab/issues/2397)
- documentation to use chrome with (GPU, and memory saver)
- test on Android (tablet) - partially working, with some latency audio + UI (need to detect if issue is within our Midi or alphatab on its own)
  [x] test on iPad (webmidi): working fine actually / some minor latency
- test on old mac Intel
- test on old macmini (maybe need another browser): Couldn't get to work at all =/
- save settings (localstorage or indexedDB)
- memory (draw blank on top of the score, and only display the notation on errors): improve performance
- preload drawing positions (already vibe-coded, needs review)
- pre check missing map midis (analyse song)
- select what track to match (save last one, try to always go to drum)
- warning when multiple midi devices are connected
- detect repeats, and warning
- test on Windows
- test piano features

## Nice to have Implement

- add analytics
- improve game with media sync (audio/youtube). Control synth or BackingTrack
- cursor style
- repeat from settings (start - finish): mobile friendly
  [x] separate early from late on good
- improve early / late / missed detection
  [x] ignore error drawings (e.g. pedal hihat)
  [x] ignore error score (e.g. pedal hihat), or learning song by pad
- custom set colors for perfect, good, error
- custom set colors for early, late
- display gray for missed
- chrome warning for latency, power mode, etc
- save uploaded songs (for next time usage, similar midiano and/sightread)
  - folder uploads are great, but won't work in iOS Webmidi SHIM
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
- ghost notes
  - detect ghost notes
  - custom set threshold for dynamic as ghost
  - toggle option to influence dynamics in score
- display dynamics chart (simialar to Roland DT-1 Drum Tutor)
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
  [x] dark mode
- UI with drum hihglighted on guide notes, and feedback play (a drumkit in SVG)
