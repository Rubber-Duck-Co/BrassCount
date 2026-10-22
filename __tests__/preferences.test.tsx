import { Text, useColorScheme } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  useAppearance,
  type AppearanceValue,
} from '../src/hooks/useAppearance';
import { useLevelUnit, type LevelUnitValue } from '../src/hooks/useLevelUnit';
import { useTheme } from '../src/hooks/useTheme';
import { mirrorAppearance } from '../src/services/appearanceMirror';
import {
  PreferencesProvider,
  type PreferencesProviderProps,
} from '../src/store/PreferencesContext';
import { resolveThemeMode } from '../src/theme/theme';
import { DEFAULT_PROFILE, type Profile } from '../src/types/profile';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

jest.mock('../src/services/appearanceMirror', () => ({
  mirrorAppearance: jest.fn(),
}));

const mockedColorScheme = jest.mocked(useColorScheme);
const mockedMirror = jest.mocked(mirrorAppearance);

type Storage = NonNullable<PreferencesProviderProps['storage']>;

const profileWith = (
  appearance: Profile['appearance'],
  levelUnit: Profile['levelUnit'] = DEFAULT_PROFILE.levelUnit,
): Profile => ({
  ...DEFAULT_PROFILE,
  appearance,
  levelUnit,
});

/** A promise and the functions that settle it, for ordering saves by hand. */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let appearance: AppearanceValue | undefined;
let levelUnit: LevelUnitValue | undefined;

/** Shows the theme in use and keeps a handle on the hooks for the test. */
const Probe = () => {
  appearance = useAppearance();
  levelUnit = useLevelUnit();
  return <Text testID="text-theme-mode">{useTheme().mode}</Text>;
};

const mounted: ReactTestRenderer[] = [];

const render = (storage: Storage): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <PreferencesProvider storage={storage}>
        <Probe />
      </PreferencesProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);
  return tree;
};

const modeShown = (tree: ReactTestRenderer): string | null => {
  const nodes = tree.root.findAllByProps({ testID: 'text-theme-mode' });
  return nodes.length === 0 ? null : nodes[0].props.children;
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  });
};

/**
 * Pick a preference and return its save, wrapped so awaiting this does not
 * also wait for the save to settle.
 */
const choose = async (
  preference: Profile['appearance'],
): Promise<{ saved: Promise<void> }> => {
  let saved: Promise<void> = Promise.resolve();
  await act(async () => {
    saved = appearance!.setPreference(preference);
    // A rejection is asserted by the caller; keep it from going unhandled.
    saved.catch(() => {});
  });
  return { saved };
};

describe('resolveThemeMode', () => {
  it.each([
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
    ['system', 'dark', 'dark'],
    ['system', 'light', 'light'],
    ['system', null, 'light'],
    ['system', 'unspecified', 'light'],
  ] as const)(
    'resolves %s on a %s device to %s',
    (preference, scheme, expected) => {
      expect(resolveThemeMode(preference, scheme)).toBe(expected);
    },
  );
});

describe('useTheme', () => {
  afterEach(() => {
    mockedColorScheme.mockReturnValue('light');
  });

  it('follows the device when there is no PreferencesProvider', () => {
    mockedColorScheme.mockReturnValue('dark');
    const ThemeOnly = () => <Text testID="mode">{useTheme().mode}</Text>;
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<ThemeOnly />);
    });

    expect(tree!.root.findByProps({ testID: 'mode' }).props.children).toBe(
      'dark',
    );
    act(() => tree!.unmount());
  });
});

describe('PreferencesProvider', () => {
  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    appearance = undefined;
    levelUnit = undefined;
    mockedColorScheme.mockReturnValue('light');
    mockedMirror.mockClear();
  });

  describe('mirroring the preference for the next launch', () => {
    it('mirrors the stored preference once it is read', async () => {
      render({ load: async () => profileWith('dark'), update: jest.fn() });
      await flush();

      expect(mockedMirror).toHaveBeenCalledTimes(1);
      expect(mockedMirror).toHaveBeenCalledWith('dark');
    });

    it('mirrors nothing when the stored preference cannot be read', async () => {
      render({
        load: () => Promise.reject(new Error('unreadable')),
        update: jest.fn(),
      });
      await flush();

      expect(mockedMirror).not.toHaveBeenCalled();
    });

    it('mirrors a choice once it has been saved, not before', async () => {
      const save = deferred<Profile>();
      render({
        load: async () => profileWith('light'),
        update: () => save.promise,
      });
      await flush();
      mockedMirror.mockClear();

      await choose('dark');
      expect(mockedMirror).not.toHaveBeenCalled();

      await act(async () => {
        save.resolve(profileWith('dark'));
      });
      expect(mockedMirror).toHaveBeenCalledWith('dark');
    });

    it('does not mirror a choice that failed to save', async () => {
      render({
        load: async () => profileWith('light'),
        update: () => Promise.reject(new Error('disk full')),
      });
      await flush();
      mockedMirror.mockClear();

      const { saved } = await choose('dark');
      await saved.catch(() => {});

      expect(mockedMirror).not.toHaveBeenCalled();
    });
  });

  it('renders nothing until the stored preference is read', async () => {
    const read = deferred<Profile>();
    const tree = render({ load: () => read.promise, update: jest.fn() });

    expect(modeShown(tree)).toBeNull();

    await act(async () => {
      read.resolve(profileWith('dark'));
    });

    expect(modeShown(tree)).toBe('dark');
  });

  it('follows the device while the preference is system', async () => {
    mockedColorScheme.mockReturnValue('dark');
    const tree = render({
      load: async () => profileWith('system'),
      update: jest.fn(),
    });
    await flush();

    expect(modeShown(tree)).toBe('dark');
  });

  it('pins the theme regardless of the device', async () => {
    mockedColorScheme.mockReturnValue('dark');
    const tree = render({
      load: async () => profileWith('light'),
      update: jest.fn(),
    });
    await flush();

    expect(modeShown(tree)).toBe('light');
  });

  it('applies a choice before the save finishes, and stores it', async () => {
    const save = deferred<Profile>();
    const update = jest.fn(() => save.promise);
    const tree = render({ load: async () => DEFAULT_PROFILE, update });
    await flush();

    await choose('dark');

    expect(modeShown(tree)).toBe('dark');
    expect(update).toHaveBeenCalledWith({ appearance: 'dark' });

    await act(async () => {
      save.resolve(profileWith('dark'));
    });
    expect(modeShown(tree)).toBe('dark');
  });

  it('goes back to the saved choice and rejects when the save fails', async () => {
    const failure = new Error('disk full');
    const tree = render({
      load: async () => profileWith('light'),
      update: () => Promise.reject(failure),
    });
    await flush();

    const { saved } = await choose('dark');

    await expect(saved).rejects.toBe(failure);
    expect(modeShown(tree)).toBe('light');
  });

  it('keeps a later choice, without an error, when an earlier save fails', async () => {
    const first = deferred<Profile>();
    const second = deferred<Profile>();
    const update = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const tree = render({ load: async () => profileWith('light'), update });
    await flush();

    const { saved: firstSaved } = await choose('dark');
    await choose('system');
    await act(async () => {
      first.reject(new Error('disk full'));
    });

    // The newer choice owns the outcome, so the stale failure is not raised.
    await expect(firstSaved).resolves.toBeUndefined();
    // Still on the later choice: a system preference on a light device.
    expect(appearance!.preference).toBe('system');
    expect(modeShown(tree)).toBe('light');

    await act(async () => {
      second.resolve(profileWith('system'));
    });
    expect(appearance!.preference).toBe('system');
  });

  it('rolls a failed latest choice back to the last one that saved', async () => {
    const first = deferred<Profile>();
    const second = deferred<Profile>();
    const update = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render({ load: async () => profileWith('light'), update });
    await flush();

    await choose('dark');
    const { saved: secondSaved } = await choose('system');
    await act(async () => {
      first.resolve(profileWith('dark'));
    });
    await act(async () => {
      second.reject(new Error('disk full'));
    });

    await expect(secondSaved).rejects.toThrow('disk full');
    expect(appearance!.preference).toBe('dark');
  });

  it('starts on the device setting when the stored choice cannot be read', async () => {
    mockedColorScheme.mockReturnValue('dark');
    const tree = render({
      load: () => Promise.reject(new Error('unreadable')),
      update: jest.fn(),
    });
    await flush();

    expect(appearance!.preference).toBe('system');
    expect(modeShown(tree)).toBe('dark');
  });

  it('throws when useAppearance is used outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const Orphan = () => {
      useAppearance();
      return null;
    };

    expect(() => {
      act(() => {
        create(<Orphan />);
      });
    }).toThrow(/PreferencesProvider/);
  });

  it('throws when useLevelUnit is used outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const Orphan = () => {
      useLevelUnit();
      return null;
    };

    expect(() => {
      act(() => {
        create(<Orphan />);
      });
    }).toThrow(/PreferencesProvider/);
  });

  describe('level units', () => {
    /** Pick a unit and return its save, as `choose` does for Appearance. */
    const chooseUnit = async (
      unit: Profile['levelUnit'],
    ): Promise<{ saved: Promise<void> }> => {
      let saved: Promise<void> = Promise.resolve();
      await act(async () => {
        saved = levelUnit!.setLevelUnit(unit);
        saved.catch(() => {});
      });
      return { saved };
    };

    it('starts on the level scale when nothing is stored', async () => {
      render({ load: async () => DEFAULT_PROFILE, update: jest.fn() });
      await flush();

      expect(levelUnit!.levelUnit).toBe('level');
    });

    it('reads the stored unit', async () => {
      render({
        load: async () => profileWith('light', 'dbfs'),
        update: jest.fn(),
      });
      await flush();

      expect(levelUnit!.levelUnit).toBe('dbfs');
    });

    it('starts on the level scale when the stored unit cannot be read', async () => {
      render({
        load: () => Promise.reject(new Error('unreadable')),
        update: jest.fn(),
      });
      await flush();

      expect(levelUnit!.levelUnit).toBe('level');
    });

    it('applies a unit before the save finishes, and stores only that field', async () => {
      const save = deferred<Profile>();
      const update = jest.fn(() => save.promise);
      render({ load: async () => DEFAULT_PROFILE, update });
      await flush();

      await chooseUnit('dbfs');

      expect(levelUnit!.levelUnit).toBe('dbfs');
      expect(update).toHaveBeenCalledWith({ levelUnit: 'dbfs' });

      await act(async () => {
        save.resolve(profileWith('system', 'dbfs'));
      });
      expect(levelUnit!.levelUnit).toBe('dbfs');
    });

    it('does not mirror anything for a unit change', async () => {
      render({
        load: async () => DEFAULT_PROFILE,
        update: async () => profileWith('system', 'dbfs'),
      });
      await flush();
      mockedMirror.mockClear();

      const { saved } = await chooseUnit('dbfs');
      await saved;

      expect(mockedMirror).not.toHaveBeenCalled();
    });

    it('goes back to the saved unit and rejects when the save fails', async () => {
      const failure = new Error('disk full');
      render({
        load: async () => profileWith('system', 'level'),
        update: () => Promise.reject(failure),
      });
      await flush();

      const { saved } = await chooseUnit('dbfs');

      await expect(saved).rejects.toBe(failure);
      expect(levelUnit!.levelUnit).toBe('level');
    });

    it('keeps a later unit, without an error, when an earlier save fails', async () => {
      const first = deferred<Profile>();
      const second = deferred<Profile>();
      const update = jest
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      render({ load: async () => DEFAULT_PROFILE, update });
      await flush();

      const { saved: firstSaved } = await chooseUnit('dbfs');
      await chooseUnit('level');
      await act(async () => {
        first.reject(new Error('disk full'));
      });

      await expect(firstSaved).resolves.toBeUndefined();
      expect(levelUnit!.levelUnit).toBe('level');
    });

    it('does not undo an appearance choice when a unit save fails', async () => {
      const appearanceSave = deferred<Profile>();
      const unitSave = deferred<Profile>();
      const update = jest
        .fn()
        .mockReturnValueOnce(appearanceSave.promise)
        .mockReturnValueOnce(unitSave.promise);
      const tree = render({ load: async () => profileWith('light'), update });
      await flush();

      await choose('dark');
      const { saved } = await chooseUnit('dbfs');
      await act(async () => {
        unitSave.reject(new Error('disk full'));
      });

      await expect(saved).rejects.toThrow('disk full');
      expect(levelUnit!.levelUnit).toBe('level');
      expect(modeShown(tree)).toBe('dark');

      await act(async () => {
        appearanceSave.resolve(profileWith('dark'));
      });
      expect(modeShown(tree)).toBe('dark');
    });

    it('does not undo a unit choice when an appearance save fails', async () => {
      const appearanceSave = deferred<Profile>();
      const unitSave = deferred<Profile>();
      const update = jest
        .fn()
        .mockReturnValueOnce(unitSave.promise)
        .mockReturnValueOnce(appearanceSave.promise);
      const tree = render({ load: async () => profileWith('light'), update });
      await flush();

      await chooseUnit('dbfs');
      const { saved } = await choose('dark');
      await act(async () => {
        appearanceSave.reject(new Error('disk full'));
      });

      await expect(saved).rejects.toThrow('disk full');
      expect(modeShown(tree)).toBe('light');
      expect(levelUnit!.levelUnit).toBe('dbfs');
    });
  });
});
