# Feature: AUTO BPM

The feature for auto bpm should help the player/user to learn a track or part of a track.

1. When enabling auto-bpm, we should always set a enable api.isLooping
2. The score, streak and so on, during auto-bpm should reset on each cycle (default to 1)
3. We should increase the bpm based on every cycle that the user has reached at least the accuracy goal
4. We should introduce configurable settings for auto bpm, such as:
   a. the minimal of loops per cycle (default to 1);
   b. the minimal of the accuracy goal per check where the options should be based on getAccuracyTier() - default is excellent
   c. the number of beats to increase for each cycle (default to 5 bpm)
   d. the bpm goal to reach (default should be the same as the current track, change on track change)
