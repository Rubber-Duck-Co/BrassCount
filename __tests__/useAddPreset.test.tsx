import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  useAddPreset,
  type UseAddPresetResult,
} from '../src/hooks/useAddPreset';
import {
  DrillStorageError,
  DrillStorageService,
  loadDrills,
} from '../src/services/drillStorage';
import type { Drill, PresetDrill } from '../src/types/drill';

/**
 * Adding a preset to the shooter's drills: what is saved, and how a save
 * in flight, done or failed is reported per preset. The screen's rows are
 * covered by `PresetLibraryScreen.test`.
 */

const BILL: PresetDrill = {
  id: 'bill',
  description: 'Six shots on one target.',
  drill: {
    name: 'Bill Drill',
    steps: [
      { type: 'draw', par: 1.2 },
      { type: 'shot', par: 1.2 },
      { type: 'shot', par: 0.12 },
    ],
  },
};

const FTS: PresetDrill = {
  id: 'fts',
  description: 'Two to the body, one to the head.',
  drill: {
    name: 'Failure to Stop',
    steps: [
      { type: 'draw', par: 1 },
      { type: 'shot', par: 1 },
    ],
  },
};

type ProbeProps = { onValue: (value: UseAddPresetResult) => void };

/** Renders nothing; hands the hook's current value to the test. */
const Probe = ({ onValue }: ProbeProps) => {
  onValue(useAddPreset());
  return null;
};

/** Let pending storage calls and the state updates they cause land. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  });
};

const mounted: ReactTestRenderer[] = [];

const renderHook = () => {
  let value: UseAddPresetResult | undefined;
  let renders = 0;
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <Probe
        onValue={next => {
          value = next;
          renders += 1;
        }}
      />,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  const rendered = tree;
  mounted.push(rendered);
  return {
    current: (): UseAddPresetResult => {
      if (value === undefined) {
        throw new Error('the hook has not rendered');
      }
      return value;
    },
    /** How many times the hook has rendered. */
    renders: () => renders,
    unmount: () => {
      act(() => rendered.unmount());
      mounted.splice(mounted.indexOf(rendered), 1);
    },
  };
};

/** A save that waits for the test to let it finish. */
const holdSave = () => {
  let release: () => void = () => {};
  const realSave = DrillStorageService.save;
  const spy = jest
    .spyOn(DrillStorageService, 'save')
    .mockImplementation(async input => {
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return realSave(input);
    });
  return { spy, release: () => release() };
};

describe('useAddPreset', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  it('starts with every preset ready to add', () => {
    const hook = renderHook();

    expect(hook.current().statusOf(BILL.id)).toBe('idle');
    expect(hook.current().statusOf(FTS.id)).toBe('idle');
  });

  it('saves the preset’s name and steps as a new drill', async () => {
    const hook = renderHook();

    let outcome: unknown;
    await act(async () => {
      outcome = await hook.current().add(BILL);
    });

    expect(outcome).toBe('added');
    const drills = await loadDrills();
    expect(drills).toHaveLength(1);
    expect(drills[0].name).toBe('Bill Drill');
    expect(drills[0].steps.map(({ type, par }) => ({ type, par }))).toEqual(
      BILL.drill.steps,
    );
    expect(hook.current().statusOf(BILL.id)).toBe('added');
    expect(hook.current().statusOf(FTS.id)).toBe('idle');
  });

  it('gives the saved drill and its steps ids of their own', async () => {
    const hook = renderHook();

    await act(async () => {
      await hook.current().add(BILL);
    });

    const [drill] = await loadDrills();
    expect(drill.id).not.toBe(BILL.id);
    drill.steps.forEach(step => expect(step.id).toEqual(expect.any(String)));
  });

  it('reports a preset as adding while its save is under way', async () => {
    const { release } = holdSave();
    const hook = renderHook();

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = hook.current().add(BILL);
    });

    expect(hook.current().statusOf(BILL.id)).toBe('adding');

    await act(async () => {
      release();
      await pending;
    });
    expect(hook.current().statusOf(BILL.id)).toBe('added');
  });

  it('saves one drill for a double tap', async () => {
    const { spy, release } = holdSave();
    const hook = renderHook();

    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      // Both taps land before the first has rendered.
      const { add } = hook.current();
      first = add(BILL);
      second = await add(BILL);
    });
    await act(async () => {
      release();
      await first;
    });

    expect(second).toBe('ignored');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await loadDrills()).toHaveLength(1);
  });

  it('ignores another tap once the preset has been added', async () => {
    const hook = renderHook();
    await act(async () => {
      await hook.current().add(BILL);
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await hook.current().add(BILL);
    });

    expect(outcome).toBe('ignored');
    expect(await loadDrills()).toHaveLength(1);
  });

  it('adds two different presets side by side', async () => {
    const hook = renderHook();

    await act(async () => {
      const { add } = hook.current();
      await Promise.all([add(BILL), add(FTS)]);
    });

    expect((await loadDrills()).map(drill => drill.name).sort()).toEqual([
      'Bill Drill',
      'Failure to Stop',
    ]);
    expect(hook.current().statusOf(BILL.id)).toBe('added');
    expect(hook.current().statusOf(FTS.id)).toBe('added');
  });

  describe('when the drill cannot be saved', () => {
    const failSave = () =>
      jest
        .spyOn(DrillStorageService, 'save')
        .mockRejectedValueOnce(
          new DrillStorageError('Failed to save drill', 'STORAGE_FAILURE'),
        );

    it('reports the preset as failed, without rejecting', async () => {
      failSave();
      const hook = renderHook();

      let outcome: unknown;
      await act(async () => {
        outcome = await hook.current().add(BILL);
      });

      expect(outcome).toBe('failed');
      expect(hook.current().statusOf(BILL.id)).toBe('failed');
      expect(await loadDrills()).toEqual([]);
    });

    it('saves it on another try', async () => {
      failSave();
      const hook = renderHook();
      await act(async () => {
        await hook.current().add(BILL);
      });

      await act(async () => {
        await hook.current().add(BILL);
      });

      expect(hook.current().statusOf(BILL.id)).toBe('added');
      expect(await loadDrills()).toHaveLength(1);
    });
  });

  it('sets no state when a save finishes after the screen has gone', async () => {
    const { release } = holdSave();
    const errors = jest.spyOn(console, 'error');
    const hook = renderHook();
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = hook.current().add(BILL);
    });

    hook.unmount();
    const rendersAtUnmount = hook.renders();
    let stored: Drill[] = [];
    await act(async () => {
      release();
      await pending;
      stored = await loadDrills();
    });
    await settle();

    // The drill is saved: the shooter asked for it.
    expect(stored).toHaveLength(1);
    expect(hook.renders()).toBe(rendersAtUnmount);
    expect(errors).not.toHaveBeenCalled();
  });
});
