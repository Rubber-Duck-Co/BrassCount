import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import { SessionStorageService } from '@services/sessionStorage';

/**
 * How many runs are stored. `unknown` when they could not be counted:
 * clearing is still offered then, it just cannot say how many go.
 */
export type RunCountState =
  | { status: 'loading' }
  | { status: 'unknown' }
  | { status: 'ready'; runCount: number };

export type UseRunHistoryClearResult = {
  runCount: RunCountState;
  /**
   * Delete every saved run, keeping drills and the profile. Resolves to
   * whether it worked; a failure is settled here, never thrown. After a
   * failure the runs are counted again, since they are still stored.
   */
  clearRuns: () => Promise<boolean>;
};

/**
 * The Settings screen's Data section: counts the stored runs each time the
 * screen gains focus, and clears them.
 *
 * The count is one per stored key, the same keys `clearSessions` removes,
 * so the number the confirmation names is the number deleted, including
 * any entry History skips because it is unreadable.
 */
export const useRunHistoryClear = (): UseRunHistoryClearResult => {
  const [runCount, setRunCount] = useState<RunCountState>({
    status: 'loading',
  });
  // Bumped by every count and clear, and when the screen loses focus, so a
  // count that has been superseded never lands.
  const loadIdRef = useRef(0);

  const count = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    try {
      const total = await SessionStorageService.count();
      if (loadIdRef.current === loadId) {
        setRunCount({ status: 'ready', runCount: total });
      }
    } catch {
      if (loadIdRef.current === loadId) {
        setRunCount({ status: 'unknown' });
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // `count` settles every failure into state, so it never rejects.
      count().catch(() => {});

      return () => {
        loadIdRef.current += 1;
      };
    }, [count]),
  );

  const clearRuns = useCallback(async (): Promise<boolean> => {
    // A count still in flight would report the runs this is deleting.
    loadIdRef.current += 1;
    try {
      await SessionStorageService.clear();
    } catch {
      // The runs are still there, or some of them are: count what is left
      // rather than trust the number shown before.
      count().catch(() => {});
      return false;
    }
    setRunCount({ status: 'ready', runCount: 0 });
    return true;
  }, [count]);

  return { runCount, clearRuns };
};
