'use client';

import * as alphaTab from '@coderline/alphatab';
import React, { useCallback, useEffect, useState } from 'react';
import { useAlphaTab, useAlphaTabEvent } from '@site/src/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as solid from '@fortawesome/free-solid-svg-icons';
import styles from './styles.module.scss';

const DEFAULT_START = 40;
const DEFAULT_END = 51;

function clampBar(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function applyDisplayRange(api: alphaTab.AlphaTabApi, startBar: number, endBar: number): void {
    api.settings.display.startBar = startBar;
    api.settings.display.barCount = endBar - startBar + 1;
    api.render();
}

function applyPlaybackRange(
    api: alphaTab.AlphaTabApi,
    startBar: number,
    endBar: number,
    enabled: boolean
): void {
    if (!enabled) {
        api.playbackRange = null;
        return;
    }

    const score = api.score;
    const lookup = api.tickCache;
    if (!score || !lookup) {
        return;
    }

    const startIndex = startBar - 1;
    const endIndex = endBar - 1;
    const startMasterBar = score.masterBars[startIndex];
    const endMasterBar = score.masterBars[endIndex];
    if (!startMasterBar || !endMasterBar) {
        return;
    }

    const range = new alphaTab.synth.PlaybackRange();
    range.startTick = lookup.getMasterBarStart(startMasterBar);
    range.endTick = lookup.getMasterBar(endMasterBar).end;
    api.playbackRange = range;
}

export const BarRangeDemo: React.FC = () => {
    const viewportRef = React.createRef<HTMLDivElement>();
    const [totalBars, setTotalBars] = useState<number | null>(null);
    const [startBar, setStartBar] = useState(DEFAULT_START);
    const [endBar, setEndBar] = useState(DEFAULT_END);
    const [limitPlayback, setLimitPlayback] = useState(true);
    const [isPlaying, setPlaying] = useState(false);
    const [status, setStatus] = useState('Loading…');

    const [api, element] = useAlphaTab(s => {
        s.core.engine = 'svg';
        s.core.file = '/files/canon-full.gp';
        s.core.tracks = [0, 1];
        s.display.startBar = DEFAULT_START;
        s.display.barCount = DEFAULT_END - DEFAULT_START + 1;
        s.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
        s.player.scrollMode = alphaTab.ScrollMode.Continuous;
        s.player.scrollOffsetY = -10;
    });

    useAlphaTabEvent(api, 'scoreLoaded', score => {
        const count = score.masterBars.length;
        const start = clampBar(DEFAULT_START, 1, count);
        const end = clampBar(DEFAULT_END, start, count);
        setTotalBars(count);
        setStartBar(start);
        setEndBar(end);
        setStatus(`Loaded ${count} bars — showing ${start}–${end}`);
        applyPlaybackRange(api!, start, end, true);
    });

    useAlphaTabEvent(api, 'renderFinished', () => {
        if (!api) {
            return;
        }
        const start = api.settings.display.startBar;
        const count = api.settings.display.barCount;
        setStatus(`Showing bars ${start}–${start + count - 1}`);
    });

    useAlphaTabEvent(
        api,
        'playerStateChanged',
        (args: alphaTab.synth.PlayerStateChangedEventArgs) => {
            setPlaying(args.state === alphaTab.synth.PlayerState.Playing);
        }
    );

    useEffect(() => {
        if (!api || !viewportRef.current) {
            return;
        }
        api.settings.player.scrollElement = viewportRef.current;
    }, [api]);

    useEffect(() => {
        if (!api || totalBars === null) {
            return;
        }
        if (!limitPlayback) {
            api.playbackRange = null;
            return;
        }
        const start = api.settings.display.startBar;
        const count = api.settings.display.barCount;
        applyPlaybackRange(api, start, start + count - 1, true);
    }, [api, totalBars, limitPlayback]);

    const applyRange = useCallback(() => {
        if (!api || totalBars === null) {
            return;
        }

        const start = clampBar(Math.min(startBar, endBar), 1, totalBars);
        const end = clampBar(Math.max(startBar, endBar), start, totalBars);
        setStartBar(start);
        setEndBar(end);

        applyDisplayRange(api, start, end);
        if (limitPlayback) {
            applyPlaybackRange(api, start, end, true);
        }
    }, [api, totalBars, startBar, endBar, limitPlayback]);

    const showAll = useCallback(() => {
        if (!api || totalBars === null) {
            return;
        }
        setStartBar(1);
        setEndBar(totalBars);
        applyDisplayRange(api, 1, totalBars);
        applyPlaybackRange(api, 1, totalBars, false);
    }, [api, totalBars]);

    return (
        <div className={styles.wrapper}>
            <div className={styles.controls}>
                <label className={styles.field}>
                    <span>From bar</span>
                    <input
                        type="number"
                        min={1}
                        max={totalBars ?? undefined}
                        value={startBar}
                        onChange={e => setStartBar(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    <span>To bar</span>
                    <input
                        type="number"
                        min={1}
                        max={totalBars ?? undefined}
                        value={endBar}
                        onChange={e => setEndBar(Number(e.target.value))}
                    />
                </label>
                <button type="button" className="button button--primary" onClick={applyRange} disabled={!api}>
                    Re-render range
                </button>
                <button type="button" className="button button--secondary" onClick={showAll} disabled={!api}>
                    Show all
                </button>
                <button type="button" className="button button--secondary" onClick={() => api?.playPause()} disabled={!api}>
                    <FontAwesomeIcon icon={isPlaying ? solid.faPause : solid.faPlay} />
                </button>
                <label className={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={limitPlayback}
                        onChange={e => setLimitPlayback(e.target.checked)}
                    />
                    Limit playback to selected bars
                </label>
                <span className={styles.status}>{status}</span>
            </div>

            <div className={styles.viewport} ref={viewportRef}>
                <div ref={element} />
            </div>
        </div>
    );
};
