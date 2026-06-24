# Drum Tablature — Implementation Notes & MusicXML Plan

_Last updated: 2026-06-24 · branch `rhythm-game`_

Status:
- ✅ **Guitar Pro (`.gp`) drum tablature works** in the Rhythm Game (and Playground engine).
- ⏸️ **MusicXML drum tablature does NOT work** — root-caused below, fix planned but paused.

---

## TL;DR

The alphatab npm package (`@coderline/alphatab@1.8.1`) hides tablature on percussion
tracks. We enabled it by applying CoderLine/alphaTab **PR #2591** as a `patch-package`
patch, plus removing a website-side `disabled` guard on the notation toggles.

Drum tabs render **only when the score provides per-note string/fret + a staff tuning**.
`.gp` files carry that data; **Guitar Pro's MusicXML export does not**, and MusicXML
uses a *different* alphatab importer that PR #2591 never touched — so MusicXML drum
files show no tabs.

---

## What shipped (commits on `rhythm-game`)

| Commit | What |
|--------|------|
| `63b1ad43` | `feat(drums): patch alphatab to enable percussion tablature` — `patches/@coderline+alphatab+1.8.1.patch` + `patch-package` devDep + `postinstall` hook |
| `f1636cd7` | `feat(rhythm-game): enable notation toggles for percussion staves` — removed `disabled={staff.isPercussion}` from the 4 notation buttons in `AlphaTabRhythmGame/track-item.tsx` |

Both are on `origin/rhythm-game` (fork `leocaseiro/alphaTabWebsite`). Not deployed to
GH Pages (Pages builds from `develop`/`main`, last built 2026-03-03).

---

## The alphatab patch — how it was made

- Source: **CoderLine/alphaTab PR #2591** — <https://github.com/CoderLine/alphaTab/pull/2591>
  (branch `allow-tabs-for-drums`; local checkout at `/Users/leocaseiro/Sites/alphaTab`).
- The PR's source change is tiny: ~22 lines across **5 files** (`GpifParser.ts`,
  `PartConfiguration.ts`, `Note.ts`, `Staff.ts`, `TabBarRendererFactory.ts`); the rest of
  the PR is tests + `.gp` test data.
- The website runs **alphatab `1.8.1`**; the PR branch is `1.9.0`-based. Verified the 5
  source files are **byte-identical at the `v1.8.1` tag**, so the change grafts cleanly
  onto 1.8.1 → a minimal, version-matched patch (no 1.9.0 upgrade).
- Applied directly to the built bundle **`node_modules/@coderline/alphatab/dist/alphaTab.core.mjs`**
  — the single file the entire runtime imports: the main thread (via `alphaTab.mjs`),
  the render worker (`alphaTab.worker.mjs`), and the audio worklet (`alphaTab.worklet.mjs`)
  all `import './alphaTab.core.mjs'`. Minified (`*.min.*`) and CJS (`alphaTab.js`) variants
  are **not** patched because this Docusaurus site never loads them.
- Captured with `npx patch-package @coderline/alphatab` → `patches/@coderline+alphatab+1.8.1.patch`
  (6 hunks, 1 file, ~3.9 KB). Auto-reapplies via `"postinstall": "patch-package"`.

### The 6 hunks (what the change does)

| File (class) | Change |
|--------------|--------|
| `TabBarRendererFactory` ctor | Drop `hideOnPercussionTrack = true` → tab bars allowed on percussion |
| `Staff.finish()` | Stop force-wiping `showTablature=false` + `stringTuning.tunings=[]` for percussion |
| `PartConfiguration` | Apply `showTablature` from track config unconditionally (was gated behind `!isPercussion`) |
| `GpifParser` (tuning) | Set `showTablature = true` unconditionally (was gated behind `!isPercussion`) |
| `GpifParser` (notes) | Keep drum note `string`/`fret` (clamp `string > 5 → 5`) instead of resetting to `-1` |
| `Note.isPercussion` | Simplify getter to `percussionArticulation >= 0` |

---

## UI toggle changes

`src/components/AlphaTabRhythmGame/track-item.tsx` — removed `disabled={staff.isPercussion}`
from **all four** notation toggle buttons (Standard, Tablature, Slash, Numbered) so drum
staves can switch notation views.

- `AlphaTabPlayground/track-item.tsx` was **intentionally left unchanged** (drums-locked there).
- Why this was needed *in addition to* the library patch: the patch enables tab *rendering*;
  this attribute is what greys out the *button*. Both are required.

---

## ⚠️ webpack cache gotcha (cost us a debugging round-trip)

`patch-package` edits files **inside `node_modules`**. webpack treats `node_modules` as
immutable (`snapshot.managedPaths`, keyed by package **version**), so an in-place patch to
`1.8.1` can be **masked by a stale webpack persistent cache** (`node_modules/.cache/webpack`).
The Docusaurus dev server then serves the **un-patched** bundle even though the file on disk
is patched.

- **Fix:** after `npm install` or re-patching → `npm run clear` (Docusaurus `clear` removes
  `node_modules/.cache` + `.docusaurus` + `build`), restart the dev server, hard-refresh (⌘⇧R).
- **Telltale:** for drums, **Slash renders but Tablature doesn't** — Slash needs only the
  website-side `disabled` removal (in `src/`, always recompiled), while Tab needs the library
  patch (in `node_modules`, cache-masked). A fresh build is ~20s vs ~11s cached.

(Also saved as project memory: `webpack-cache-masks-patched-alphatab`.)

---

## How drum-tab rendering is gated

In the (patched) bundle:

```
TabBarRendererFactory.canCreate(track, staff):
    return staff.showTablature && staff.tuning.length > 0 && super.canCreate(track, staff)

BarRendererFactory.canCreate (base):
    return !this.hideOnPercussionTrack || !staff.isPercussion   // patch makes this true for drums
```

So a tab staff is created **only if** `showTablature` is on **and** `staff.tuning.length > 0`.
Slash/Numbered have **no** tuning requirement (`super.canCreate && staff.showSlash`), which is
why they render for drums without any tab data.

---

## MusicXML gap — root cause

**Symptom:** MusicXML files exported from Guitar Pro show no drum tabs (Standard notation
still renders). Example: `/Users/leocaseiro/Sites/notation-hero-resources/_files-mid-gp-xml/guitar-pro-converted/1-beat.xml`

**Two compounding reasons:**

1. **Different importer.** PR #2591 patched the Guitar Pro importer (`GpifParser`). MusicXML
   flows through alphatab's separate **`MusicXmlImporter`**, which has none of the
   percussion-tab logic.
2. **The GP→MusicXML export is lossy for tab.** In `1-beat.xml`: notes carry `<fret>` (×36)
   but **zero `<string>`** elements, and `<staff-details>` is an empty `<?GP?>` stub with
   **no `<staff-tuning>`**. The data a tab needs — *which line each drum sits on* — isn't in
   the file.

**Evidence — alphatab model after loading each file (via Node + patched `core.mjs`):**

| | `.gp` (`guitar-pro-rock-beat-repeat.gp`) ✅ | MusicXML (`1-beat.xml`) ❌ |
|---|---|---|
| Importer | `GpifParser` (patched) | `MusicXmlImporter` (untouched) |
| `staff.isPercussion` | true | true |
| `staff.showTablature` | false (default; togglable) | false |
| `staff.tuning.length` | **6** `[0,0,0,0,0,0]` | **0** `[]` |
| note `string`/`fret` | `string=5 fret=42`, `string=1 fret=36`, … | **`string=-1 fret=-1`** (all notes) |
| TAB gate (`showTab && tuning>0`) | passes when toggled | **fails** |

Net: the MusicXML drum staff has no tuning and no per-note string, so the tab renderer can't
create a staff — and even if forced, there are no string positions to draw.

---

## Plan for MusicXML drum tabs (PAUSED)

User intent: **(2) prove it works locally, then (3) contribute upstream — keep MPL/copyleft.**

### Option 2 — website-side shim (prove it)
After loading a MusicXML score, for each percussion staff:
- inject a drum tuning (e.g. 6 lines, like the GP `[0,0,0,0,0,0]`) so `staff.tuning.length > 0`;
- set `staff.showTablature` (or leave it to the toggle);
- map each note's `percussionArticulation` → a `string` (staff line) + `fret` (display number),
  reusing GP's drum→line mapping.
- Likely lives near `useAlphaTab` / the score-loaded handler in `AlphaTabRhythmGame/index.tsx`.

### Option 3 — upstream alphatab `MusicXmlImporter` (community, MPL)
Port the same logic into alphatab's `MusicXmlImporter` natively + tests; open an MPL-licensed
PR to CoderLine/alphaTab (sibling to #2591). Most work, but the real fix.

### Key design unknown
The **drum MIDI/articulation → tab string + fret** mapping. alphatab already exposes
`track.percussionArticulations[note.percussionArticulation]` (with `outputMidiNumber` and a
staff-line; see `circle-marker-helpers.ts`), which is the likely source of truth for the
line each drum sits on. Resolve this first when work resumes (a brainstorm was started, then
paused).

---

## How to reproduce / verify (Node inspection technique)

No browser needed — load a score with the patched bundle and inspect the model:

```js
// node inspect.mjs
import * as alphaTab from '<repo>/node_modules/@coderline/alphatab/dist/alphaTab.core.mjs';
import { readFileSync } from 'fs';
const bytes = new Uint8Array(readFileSync('<path-to-.gp-or-.xml>'));
const settings = new alphaTab.Settings();
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
for (const track of score.tracks)
  for (const staff of track.staves) {
    staff.finish(settings, null);
    console.log(track.name, staff.index, {
      isPercussion: staff.isPercussion,
      showTablature: staff.showTablature,
      tuningLen: staff.tuning.length,         // 0 on MusicXML, 6 on .gp
    });
  }
// iterate bars→voices→beats→notes to see note.string / note.fret / note.percussionArticulation
```

Confirm the patch is live (not cache-masked):
```bash
grep -c "hideOnPercussionTrack = true" node_modules/@coderline/alphatab/dist/alphaTab.core.mjs  # 0 = patched
```

---

## References & paths

- alphatab PR: <https://github.com/CoderLine/alphaTab/pull/2591> (branch `allow-tabs-for-drums`)
- Local alphatab repo: `/Users/leocaseiro/Sites/alphaTab` (drum work on `origin/allow-tabs-for-drums`)
- Patch file: `patches/@coderline+alphatab+1.8.1.patch`
- Rhythm Game score source: `static/files/guitar-pro-rock-beat-repeat.gp` (loaded in `AlphaTabRhythmGame/index.tsx`)
- MusicXML sample that fails: `/Users/leocaseiro/Sites/notation-hero-resources/_files-mid-gp-xml/guitar-pro-converted/1-beat.xml`
- License: alphatab is **MPL 2.0** (copyleft); any upstream PR stays MPL.
