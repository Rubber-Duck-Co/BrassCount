import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import type { CalibrationSound } from '@/types/calibration';
import { useCalibration } from '@hooks/useCalibration';
import {
  CalibrationCaptureAbortError,
  CalibrationCaptureError,
  CalibrationCaptureService,
} from '@services/calibrationCapture';
import { isAudibleSample } from '@utils/calibration';

/** What a capture is for: setting a threshold, or checking a sound against it. */
export type CalibrationCaptureMode = 'recalibrate' | 'test';

/** The capture in progress. There is one microphone, so at most one. */
export type ActiveCalibrationCapture = {
  sound: CalibrationSound;
  mode: CalibrationCaptureMode;
};

/** Why a capture ended without a result. */
export type CalibrationCaptureNoticeKind =
  /** Recalibrate heard nothing loud enough to set a threshold from. */
  | 'no-sound'
  | 'permission-denied'
  | 'permission-blocked'
  | 'interrupted'
  | 'failed';

/**
 * Shortest time between two redraws of the live meter. The microphone
 * reports a level about every 23 ms; redrawing at that rate costs renders
 * no eye can follow, so the meter shows at most one level per interval:
 * the loudest heard since the last redraw, so a shot's brief peak is not
 * skipped.
 */
export const LIVE_LEVEL_INTERVAL_MS = 50;

export type CalibrationCaptureNotice = {
  sound: CalibrationSound;
  kind: CalibrationCaptureNoticeKind;
};

export type UseCalibrationCaptureResult = {
  active: ActiveCalibrationCapture | null;
  /** How the most recent capture fell short, until another one starts. */
  notice: CalibrationCaptureNotice | null;
  /**
   * The level the running capture last heard, in dBFS, for the live meter.
   * `null` when nothing is listening or nothing has been heard yet. Kept
   * here, never in the calibration store: it changes many times a second.
   */
  liveLevelDbfs: number | null;
  /** Capture a sample of the sound and set its threshold from it. */
  recalibrate: (sound: CalibrationSound) => void;
  /** Capture the sound and record its level as the sound's last test. */
  test: (sound: CalibrationSound) => void;
  /** Stop the capture in progress, leaving the store as it was. */
  cancel: () => void;
};

const noticeKindFor = (err: unknown): CalibrationCaptureNoticeKind => {
  if (!(err instanceof CalibrationCaptureError)) {
    return 'failed';
  }
  switch (err.code) {
    case 'PERMISSION_DENIED':
      return 'permission-denied';
    case 'PERMISSION_BLOCKED':
      return 'permission-blocked';
    case 'INTERRUPTED':
      return 'interrupted';
    case 'CAPTURE_FAILED':
      return 'failed';
  }
};

/**
 * Runs the Calibration screen's Recalibrate and Test captures and writes
 * their results to the calibration store.
 *
 * Only what the store does not hold lives here: which capture is running,
 * the level it is hearing, and why the last one fell short. A test's pass
 * or fail is not state — it follows from the stored threshold and last
 * test (`testOutcome`).
 *
 * A capture is cancelled when the screen loses focus or unmounts, so the
 * microphone is never left listening behind another tab.
 */
export const useCalibrationCapture = (): UseCalibrationCaptureResult => {
  const { setSample, recordTestReading } = useCalibration();
  const [active, setActive] = useState<ActiveCalibrationCapture | null>(null);
  const [notice, setNotice] = useState<CalibrationCaptureNotice | null>(null);
  const [liveLevelDbfs, setLiveLevelDbfs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped by every capture and every cancel, so a capture that has been
  // superseded never writes its result.
  const runIdRef = useRef(0);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setActive(null);
    setLiveLevelDbfs(null);
  }, []);

  const run = useCallback(
    async (sound: CalibrationSound, mode: CalibrationCaptureMode) => {
      const runId = ++runIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setNotice(null);
      setActive({ sound, mode });
      setLiveLevelDbfs(null);

      let lastShownAt = -Infinity;
      let loudestSinceShown = -Infinity;
      const onLevel = (dbfs: number): void => {
        if (runIdRef.current !== runId) {
          return;
        }
        loudestSinceShown = Math.max(loudestSinceShown, dbfs);
        const now = Date.now();
        if (now - lastShownAt < LIVE_LEVEL_INTERVAL_MS) {
          return;
        }
        lastShownAt = now;
        setLiveLevelDbfs(loudestSinceShown);
        loudestSinceShown = -Infinity;
      };

      try {
        const { peakDbfs } = await CalibrationCaptureService.capture({
          signal: controller.signal,
          onLevel,
        });
        if (runIdRef.current !== runId) {
          return;
        }
        if (mode === 'test') {
          recordTestReading(sound, peakDbfs);
        } else if (isAudibleSample(peakDbfs)) {
          setSample(sound, peakDbfs);
        } else {
          setNotice({ sound, kind: 'no-sound' });
        }
      } catch (err) {
        if (runIdRef.current !== runId) {
          return;
        }
        if (!(err instanceof CalibrationCaptureAbortError)) {
          setNotice({ sound, kind: noticeKindFor(err) });
        }
      }

      abortRef.current = null;
      setActive(null);
      setLiveLevelDbfs(null);
    },
    [recordTestReading, setSample],
  );

  const recalibrate = useCallback(
    (sound: CalibrationSound) => {
      // `run` settles every failure into state, so it never rejects.
      run(sound, 'recalibrate').catch(() => {});
    },
    [run],
  );

  const test = useCallback(
    (sound: CalibrationSound) => {
      run(sound, 'test').catch(() => {});
    },
    [run],
  );

  // Returning `cancel` as the cleanup runs it on blur and on unmount.
  useFocusEffect(useCallback(() => cancel, [cancel]));

  return { active, notice, liveLevelDbfs, recalibrate, test, cancel };
};
