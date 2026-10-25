import { useMemo, useState, type ReactNode } from 'react';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useCalibration } from '../src/hooks/useCalibration';
import {
  CalibrationProvider,
  type CalibrationContextValue,
} from '../src/store/CalibrationContext';
import { CalibrationError } from '../src/store/calibrationReducer';
import {
  PreferencesContext,
  type PreferencesContextValue,
} from '../src/store/PreferencesContext';
import { DBFS_MIN } from '../src/types/calibration';
import {
  DEFAULT_PROFILE,
  type DetectionSensitivity,
} from '../src/types/profile';

/** Renders nothing; hands the hook's current value to the test. */
const Probe = ({
  onValue,
}: {
  onValue: (value: CalibrationContextValue) => void;
}) => {
  onValue(useCalibration());
  return null;
};

/**
 * Stands in for `PreferencesProvider` with the sensitivity held in plain
 * state, so a test can switch it the way Settings does without storage.
 */
const SensitivityHolder = ({
  onSetter,
  children,
}: {
  onSetter: (set: (sensitivity: DetectionSensitivity) => void) => void;
  children: ReactNode;
}) => {
  const [sensitivity, setSensitivity] = useState<DetectionSensitivity>(
    DEFAULT_PROFILE.sensitivity,
  );
  onSetter(setSensitivity);
  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences: {
        appearance: DEFAULT_PROFILE.appearance,
        levelUnit: DEFAULT_PROFILE.levelUnit,
        startDelay: DEFAULT_PROFILE.startDelay,
        beepVolume: DEFAULT_PROFILE.beepVolume,
        sensitivity,
      },
      setPreference: async () => {},
    }),
    [sensitivity],
  );
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

type Harness = {
  tree: ReactTestRenderer;
  current: () => CalibrationContextValue;
  setProbeMounted: (mounted: boolean) => void;
  setSensitivity: (sensitivity: DetectionSensitivity) => void;
};

const renderWithProvider = (): Harness => {
  let latest: CalibrationContextValue | undefined;
  let changeSensitivity: (sensitivity: DetectionSensitivity) => void = () => {};
  const onValue = (value: CalibrationContextValue) => {
    latest = value;
  };
  const element = (mounted: boolean) => (
    <SensitivityHolder
      onSetter={set => {
        changeSensitivity = set;
      }}
    >
      <CalibrationProvider>
        {mounted ? <Probe onValue={onValue} /> : null}
      </CalibrationProvider>
    </SensitivityHolder>
  );

  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element(true));
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  const rendered = tree;

  return {
    tree: rendered,
    current: () => {
      if (latest === undefined) {
        throw new Error('probe has not rendered');
      }
      return latest;
    },
    setProbeMounted: mounted => {
      act(() => {
        rendered.update(element(mounted));
      });
    },
    setSensitivity: sensitivity => {
      act(() => {
        changeSensitivity(sensitivity);
      });
    },
  };
};

describe('useCalibration', () => {
  it('starts with nothing calibrated', () => {
    const { current } = renderWithProvider();

    expect(current().state.shot).toEqual({
      thresholdDbfs: null,
      status: 'uncalibrated',
      lastTestDbfs: null,
    });
  });

  it('sets a threshold the normal margin below a sample peak', () => {
    const { current } = renderWithProvider();

    act(() => {
      current().setSample('reload', -18);
    });

    expect(current().state.reload).toEqual({
      thresholdDbfs: -24,
      status: 'calibrated',
      lastTestDbfs: null,
    });
  });

  it('moves every calibrated threshold when the sensitivity changes', () => {
    const { current, setSensitivity } = renderWithProvider();
    act(() => {
      current().setSample('shot', -12);
      current().setSample('rack', -40);
    });

    setSensitivity('high');
    expect(current().state.shot.thresholdDbfs).toBe(-22);
    expect(current().state.rack.thresholdDbfs).toBe(-50);

    setSensitivity('low');
    expect(current().state.shot.thresholdDbfs).toBe(-15);
    expect(current().state.rack.thresholdDbfs).toBe(-43);

    setSensitivity('normal');
    expect(current().state.shot.thresholdDbfs).toBe(-18);
  });

  it('keeps a sound uncalibrated when the sensitivity changes', () => {
    const { current, setSensitivity } = renderWithProvider();

    setSensitivity('high');

    expect(current().state.shot.status).toBe('uncalibrated');
    expect(current().state.shot.thresholdDbfs).toBeNull();
  });

  it('records a test reading against a calibrated sound', () => {
    const { current } = renderWithProvider();

    act(() => {
      current().setSample('shot', -12);
    });
    act(() => {
      current().recordTestReading('shot', -8);
    });

    expect(current().state.shot.lastTestDbfs).toBe(-8);
  });

  it('judges a test reading against the threshold the sensitivity gives', () => {
    const { current, setSensitivity } = renderWithProvider();
    act(() => {
      current().setSample('shot', -12);
    });
    act(() => {
      current().recordTestReading('shot', -20);
    });

    // Normal puts the threshold at -18, so -20 would miss; high at -22 hears it.
    expect(current().state.shot.thresholdDbfs).toBe(-18);
    setSensitivity('high');
    expect(current().state.shot.thresholdDbfs).toBe(-22);
    expect(current().state.shot.lastTestDbfs).toBe(-20);
  });

  it('resets one sound or all of them', () => {
    const { current } = renderWithProvider();
    act(() => {
      current().setSample('shot', -12);
      current().setSample('rack', -40);
    });

    act(() => {
      current().resetSound('shot');
    });
    expect(current().state.shot.status).toBe('uncalibrated');
    expect(current().state.rack.status).toBe('calibrated');

    act(() => {
      current().resetAll();
    });
    expect(current().state.rack.status).toBe('uncalibrated');
  });

  it('keeps calibration while a consumer unmounts and remounts', () => {
    const { current, setProbeMounted } = renderWithProvider();
    act(() => {
      current().setSample('shot', -12);
    });

    setProbeMounted(false);
    setProbeMounted(true);

    expect(current().state.shot.thresholdDbfs).toBe(-18);
  });

  it('starts empty again under a new provider', () => {
    const first = renderWithProvider();
    act(() => {
      first.current().setSample('shot', -12);
    });
    act(() => {
      first.tree.unmount();
    });

    const second = renderWithProvider();

    expect(second.current().state.shot.thresholdDbfs).toBeNull();
  });

  it('rejects an invalid level and leaves the state unchanged', () => {
    const { current } = renderWithProvider();
    const before = current().state;

    expect(() => current().setSample('shot', 96)).toThrow(CalibrationError);
    expect(() => current().recordTestReading('shot', NaN)).toThrow(
      CalibrationError,
    );

    expect(current().state).toBe(before);
  });

  it('stores a reading at digital silence as the dBFS floor', () => {
    const { current } = renderWithProvider();

    act(() => {
      current().setSample('rack', -Infinity);
    });
    act(() => {
      current().recordTestReading('rack', -Infinity);
    });

    expect(current().state.rack).toEqual({
      thresholdDbfs: DBFS_MIN,
      status: 'calibrated',
      lastTestDbfs: DBFS_MIN,
    });
  });

  it('keeps the same action functions across state changes', () => {
    const { current } = renderWithProvider();
    const { setSample, resetAll } = current();

    act(() => {
      current().setSample('shot', -12);
    });

    expect(current().setSample).toBe(setSample);
    expect(current().resetAll).toBe(resetAll);
  });

  it('throws CalibrationError outside a provider', () => {
    // React logs the render error before rethrowing it.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      expect(() => {
        act(() => {
          create(<Probe onValue={() => {}} />);
        });
      }).toThrow(CalibrationError);
    } finally {
      consoleError.mockRestore();
    }
  });
});
