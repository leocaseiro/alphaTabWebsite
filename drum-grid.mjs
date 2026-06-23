// drum-grid.mjs — extract drum grooves + fills from a Guitar Pro file's percussion track.
// REQUIRES @coderline/alphatab. Run from a dir where it resolves (e.g. copy into ~/Sites/alphaTabWebsite/):
//   node drum-grid.mjs "<file1.gp>" ["<file2.gp>" ...]
// Emits JSON only. Each percussion bar is rendered as GrooveScribe-style H/S/K(/T) rows (the SAME
// notation the existing pat_* seed uses), then:
//   - identical bars are grouped  -> recurring groove = a "beat"
//   - tom-active / one-off bars are flagged -> candidate "fill"
//   - identical bar signatures shared across files -> cross-song reuse
// Objective extraction only: positions + drum pieces from the file. No invented names/levels.
import * as at from '@coderline/alphatab';
import fs from 'fs';

const QUARTER = 960;            // AlphaTab ticks per quarter note
const SIXTEENTH = QUARTER / 4;  // 240 ticks = one 16th-note grid slot

// General-MIDI percussion number -> lane. H = hats+cymbals, S = snare, K = kick, T = toms.
function lane(m) {
  if (m === 35 || m === 36) return 'K';
  if (m === 37 || m === 38 || m === 40) return 'S';
  if (m === 42 || m === 44 || m === 46) return 'H';                 // hats
  if ([49, 51, 52, 53, 55, 57, 59].includes(m)) return 'H';        // ride/crash -> hat lane
  if ([41, 43, 45, 47, 48, 50].includes(m)) return 'T';            // toms
  return 'H';
}
const isCymbal = m => [49, 51, 52, 53, 55, 57, 59].includes(m);

function midiOf(note, track) {
  const pa = note.percussionArticulation;
  if (pa != null && pa >= 0 && track.percussionArticulations?.[pa]) {
    const out = track.percussionArticulations[pa].outputMidiNumber;
    if (out != null && out >= 0) return out;
  }
  return note.value;
}

function extract(path) {
  const bytes = new Uint8Array(fs.readFileSync(path));
  const score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, new at.Settings());
  const perc = score.tracks.find(t => t.staves?.some(s => s.isPercussion));
  if (!perc) return { file: path.split('/').pop(), error: 'no percussion track' };
  const staff = perc.staves.find(s => s.isPercussion);
  const mb = score.masterBars;

  const sections = [];
  mb.forEach((b, i) => { if (b.isSectionStart && b.section) sections.push({ label: b.section.text || '', startBar: i + 1 }); });
  const sectionStarts = new Set(sections.map(s => s.startBar));

  const bars = [];
  staff.bars.forEach((bar, bi) => {
    const master = mb[bi];
    const num = master?.timeSignatureNumerator ?? 4;
    const den = master?.timeSignatureDenominator ?? 4;
    const slots = Math.max(1, Math.round((num * (3840 / den)) / SIXTEENTH));
    const H = Array(slots).fill('-'), S = Array(slots).fill('-'), K = Array(slots).fill('-'), T = Array(slots).fill('-');
    let tomHits = 0, hasCrash = false, totalHits = 0, maxPlaybackDur = 0;
    bar.voices?.forEach(v => {
      let pos = 0;
      v.beats?.forEach(bt => {
        const d = bt.playbackDuration ?? 0;
        if (d > maxPlaybackDur) maxPlaybackDur = d;
        if (!bt.isRest) {
          const slot = Math.min(slots - 1, Math.round(pos / SIXTEENTH));
          bt.notes?.forEach(n => {
            const m = midiOf(n, perc);
            const L = lane(m);
            totalHits++;
            if (isCymbal(m) && [49, 52, 55, 57].includes(m)) hasCrash = true;
            if (L === 'T') tomHits++;
            const row = L === 'K' ? K : L === 'S' ? S : L === 'T' ? T : H;
            row[slot] = L === 'H' ? (m === 46 ? 'o' : 'x') : 'o';
          });
        }
        pos += d;
      });
    });
    const sig = `H:${H.join('')} S:${S.join('')} K:${K.join('')}${T.includes('o') ? ` T:${T.join('')}` : ''}`;
    bars.push({ bar: bi + 1, slots, sig, tomHits, hasCrash, totalHits, empty: totalHits === 0, maxPlaybackDur });
  });

  const groups = {};
  bars.forEach(b => { (groups[b.sig] ??= []).push(b.bar); });
  const grooves = Object.entries(groups)
    .map(([sig, barList]) => ({ sig, count: barList.length, bars: barList, hasTom: sig.includes('T:') }))
    .sort((a, b) => b.count - a.count);

  const fills = bars
    .filter(b => !b.empty && (b.tomHits > 0 || groups[b.sig].length === 1))
    .map(b => ({ bar: b.bar, sig: b.sig, tomHits: b.tomHits, preSection: sectionStarts.has(b.bar + 1) }));

  return {
    file: path.split('/').pop(), artist: score.artist, title: score.title,
    percTrack: perc.name, tempo: score.tempo, bars: mb.length,
    playbackDurOk: bars.some(b => b.maxPlaybackDur > 0),
    distinctBars: grooves.length, grooves: grooves.slice(0, 12),
    fillCount: fills.length, fills: fills.slice(0, 30),
    sectionCount: sections.length, sections,
  };
}

const out = process.argv.slice(2).map(extract);
const bySig = {};
out.forEach(o => o.grooves?.forEach(g => { (bySig[g.sig] ??= []).push({ file: o.file, count: g.count }); }));
const crossSongReuse = Object.entries(bySig)
  .filter(([, v]) => new Set(v.map(x => x.file)).size > 1)
  .map(([sig, v]) => ({ sig, songs: v }));
console.log(JSON.stringify({ songs: out, crossSongReuse }, null, 2));
