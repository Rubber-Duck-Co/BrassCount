import { useCallback, useEffect, useRef, useState } from 'react';

import type { PresetDrill } from '@/types/drill';
import { DrillStorageService } from '@services/drillStorage';

/**
 * Where adding one preset is. `idle`: Add is on offer. `adding`: its save
 * is under way. `added`: a copy is in the shooter's drills, final while
 * the screen is open. `failed`: the last save failed, and Add is on offer
 * again.
 */
export type PresetAddStatus = 'idle' | 'adding' | 'added' | 'failed';

/**
 * What a call to `add` did. `ignored`: nothing, since that preset was
 * already being added or had been.
 */
export type PresetAddOutcome = 'added' | 'failed' | 'ignored';

export type UseAddPresetResult = {
  statusOf: (presetId: string) => PresetAddStatus;
  /**
   * Save the preset as a new drill of the shooter's own. Never rejects:
   * a failure resolves to `failed`, with the preset free to be added again.
   */
  add: (preset: PresetDrill) => Promise<PresetAddOutcome>;
};

/**
 * Adds presets to the shooter's drills, for the Presets screen. Each add
 * saves a copy through `DrillStorageService.save` with the preset's name
 * and steps, so the drill and its steps get ids of their own like any new
 * drill, and the preset list itself never changes.
 *
 * What has been added is only remembered while the screen is open: the
 * same preset added on a later visit is a second copy.
 */
export const useAddPreset = (): UseAddPresetResult => {
  const [statuses, setStatuses] = useState<
    Readonly<Record<string, PresetAddStatus>>
  >({});
  // Presets being added or added. Read by `add` before any state has
  // rendered, so two taps in one frame save one drill.
  const claimedRef = useRef<ReadonlySet<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setStatus = useCallback((id: string, status: PresetAddStatus) => {
    if (mountedRef.current) {
      setStatuses(previous => ({ ...previous, [id]: status }));
    }
  }, []);

  const add = useCallback(
    async (preset: PresetDrill): Promise<PresetAddOutcome> => {
      const { id, drill } = preset;
      if (claimedRef.current.has(id)) {
        return 'ignored';
      }
      claimedRef.current = new Set(claimedRef.current).add(id);
      setStatus(id, 'adding');

      try {
        await DrillStorageService.save({
          name: drill.name,
          steps: drill.steps,
        });
        setStatus(id, 'added');
        return 'added';
      } catch {
        // Nothing was stored. The screen says so in its own words, and the
        // preset can be tried again.
        const released = new Set(claimedRef.current);
        released.delete(id);
        claimedRef.current = released;
        setStatus(id, 'failed');
        return 'failed';
      }
    },
    [setStatus],
  );

  const statusOf = useCallback(
    (presetId: string): PresetAddStatus => statuses[presetId] ?? 'idle',
    [statuses],
  );

  return { statusOf, add };
};
