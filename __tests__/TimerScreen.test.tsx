import {
  AccessibilityInfo,
  DeviceEventEmitter,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationContainerRefWithCurrent,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { useCalibration } from '../src/hooks/useCalibration';
import { TimerScreen } from '../src/screens/TimerScreen';
import {
  AUDIO_AMPLITUDE_EVENT,
  AUDIO_CAPTURE_ERROR_EVENT,
} from '../src/services/audioCapture';
import {
  deleteDrillById,
  loadDrillById,
  saveDrill,
  updateDrill,
} from '../src/services/drillStorage';
import { updateProfile } from '../src/services/profileStorage';
import { loadSessions } from '../src/services/sessionStorage';
import {
  StartSequenceAbortError,
  StartSequenceError,
  StartSequenceService,
  type StartSequenceOptions,
  type StartSequenceResult,
} from '../src/services/startSequence';
import NativeAudioCapture from '../src/specs/NativeAudioCapture';
import {
  CalibrationProvider,
  type CalibrationContextValue,
} from '../src/store/CalibrationContext';
import {
  PreferencesContext,
  PreferencesProvider,
  type PreferencesContextValue,
} from '../src/store/PreferencesContext';
import type { DrillInput } from '../src/types/drill';
import type {
  DrillsStackParamList,
  LogStackParamList,
  SetupStackParamList,
} from '../src/types/navigation';
import { DEFAULT_PROFILE } from '../src/types/profile';
import { formatElapsed } from '../src/utils/format';

jest.mock('../src/services/startSequence', () => {
  const actual = jest.requireActual('../src/services/startSequence');
  return {
    ...actual,
    StartSequenceService: {
      ...actual.StartSequenceService,
      prepare: jest.fn(async () => {}),
      release: jest.fn(async () => {}),
      start: jest.fn(),
    },
  };
});

const startMock = jest.mocked(StartSequenceService.start);
const prepareMock = jest.mocked(StartSequenceService.prepare);
// The native module itself is mocked globally in jest.setup.js.
const mockedNativeAudioCapture = jest.mocked(NativeAudioCapture);

type TestTabParamList = {
  /** A Load from the Drills tab names the drill to put on the timer. */
  Timer: { drillId?: string } | undefined;
  Elsewhere: undefined;
  /** The tab whose editor the empty library sends the shooter to. */
  Drills: NavigatorScreenParams<DrillsStackParamList> | undefined;
  /** The tab whose Calibration a refusal to start sends the shooter to. */
  Setup: NavigatorScreenParams<SetupStackParamList> | undefined;
  /** The tab a saved run is viewed in. */
  Log: NavigatorScreenParams<LogStackParamList> | undefined;
};

/** The drills the tests run, oldest first: the last is on the timer first. */
const LIBRARY: DrillInput[] = [
  {
    name: 'Dot Torture',
    steps: [
      { type: 'draw', par: 1.5 },
      { type: 'shot' },
      { type: 'shot' },
      { type: 'reload', par: 2 },
      { type: 'shot' },
      { type: 'shot' },
      { type: 'rack' },
      { type: 'shot' },
      { type: 'holster' },
    ],
  },
  {
    name: 'Mozambique',
    steps: [
      { type: 'draw', par: 1.5 },
      { type: 'shot', par: 0.25 },
      { type: 'shot', par: 0.25 },
      { type: 'shot', par: 0.5 },
      { type: 'holster' },
    ],
  },
  {
    name: 'Failure to Stop',
    steps: [
      { type: 'draw', par: 1.5 },
      { type: 'shot', par: 0.25 },
      { type: 'shot', par: 0.25 },
      { type: 'shot', par: 0.5 },
    ],
  },
  {
    name: 'Bill Drill',
    steps: [
      { type: 'draw', par: 1.5 },
      { type: 'shot', par: 0.25 },
      { type: 'shot', par: 0.2 },
      { type: 'shot', par: 0.2 },
      { type: 'shot', par: 0.2 },
      { type: 'shot', par: 0.2 },
      { type: 'shot', par: 0.2 },
    ],
  },
];

/** Stored drill ids by name, filled in by `seedLibrary`. */
let drillIds: Record<string, string> = {};

/** Store the library, a minute apart, so the newest is Bill Drill. */
const seedLibrary = async (): Promise<void> => {
  drillIds = {};
  for (const [index, input] of LIBRARY.entries()) {
    const at = new Date(Date.UTC(2026, 9, 1, 8, index)).toISOString();
    const drill = await saveDrill(input, { getTimestamp: () => at });
    drillIds[drill.name] = drill.id;
  }
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type TestNavigationRef = NavigationContainerRefWithCurrent<TestTabParamList>;

const Tab = createBottomTabNavigator<TestTabParamList>();
const DrillsStack = createNativeStackNavigator<DrillsStackParamList>();
const SetupStack = createNativeStackNavigator<SetupStackParamList>();
const LogStack = createNativeStackNavigator<LogStackParamList>();

/** Stands in for the other tabs and the screens inside them. */
const Blank = () => null;

/** The Drills tab's stack with blank screens: only its routes matter here. */
const StubDrills = () => (
  <DrillsStack.Navigator screenOptions={{ headerShown: false }}>
    <DrillsStack.Screen name="DrillList" component={Blank} />
    <DrillsStack.Screen name="SequenceEditor" component={Blank} />
  </DrillsStack.Navigator>
);

/** The Setup tab's stack with blank screens. */
const StubSetup = () => (
  <SetupStack.Navigator screenOptions={{ headerShown: false }}>
    <SetupStack.Screen name="SetupHome" component={Blank} />
    <SetupStack.Screen name="Calibration" component={Blank} />
    <SetupStack.Screen name="Settings" component={Blank} />
  </SetupStack.Navigator>
);

/** The Log tab's stack with blank screens. */
const StubLog = () => (
  <LogStack.Navigator screenOptions={{ headerShown: false }}>
    <LogStack.Screen name="HistoryList" component={Blank} />
    <LogStack.Screen name="HistoryDetail" component={Blank} />
    <LogStack.Screen name="RunComparison" component={Blank} />
  </LogStack.Navigator>
);

/** Sits beside the screen so a test can calibrate the sounds it listens for. */
const StoreHandle = ({
  onValue,
}: {
  onValue: (value: CalibrationContextValue) => void;
}) => {
  onValue(useCalibration());
  return null;
};

const ROOM_DB = -70;
/** What the capture clock reads when the beep is requested. */
const REQUESTED_AT = 50_000;
/** When the microphone hears the beep begin. */
const ZERO = REQUESTED_AT + 84;

/** The start sequence the screen is waiting on, once it has asked for one. */
type PendingStart = {
  options: StartSequenceOptions;
  resolve: (result: StartSequenceResult) => void;
  reject: (error: unknown) => void;
};

let pendingStart: PendingStart | undefined;
/** What the capture clock reads now. */
let captureNow = REQUESTED_AT - 3000;

const mounted: ReactTestRenderer[] = [];

/**
 * What the calibration store reads its sensitivity from. It is mounted above
 * the real `PreferencesProvider`, which renders nothing until the stored
 * settings are read, so the store is available at once.
 */
const CALIBRATION_PREFERENCES: PreferencesContextValue = {
  preferences: {
    appearance: DEFAULT_PROFILE.appearance,
    levelUnit: DEFAULT_PROFILE.levelUnit,
    startDelay: DEFAULT_PROFILE.startDelay,
    beepVolume: DEFAULT_PROFILE.beepVolume,
    sensitivity: DEFAULT_PROFILE.sensitivity,
  },
  setPreference: async () => {},
};

/**
 * Mount the screen as a tab, the way the app does: it stops a run when its
 * tab loses focus, so it needs a navigator to tell it.
 */
const renderScreen = async ({
  calibrate = true,
}: { calibrate?: boolean } = {}) => {
  const navigationRef = createNavigationContainerRef<TestTabParamList>();
  let store: CalibrationContextValue | undefined;
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PreferencesContext.Provider value={CALIBRATION_PREFERENCES}>
          <CalibrationProvider>
            <StoreHandle
              onValue={value => {
                store = value;
              }}
            />
            {/* Renders the navigator once the stored timer settings are read. */}
            <PreferencesProvider>
              <NavigationContainer ref={navigationRef}>
                <Tab.Navigator screenOptions={{ headerShown: false }}>
                  <Tab.Screen name="Timer" component={TimerScreen} />
                  <Tab.Screen name="Elsewhere" component={Blank} />
                  <Tab.Screen name="Drills" component={StubDrills} />
                  <Tab.Screen name="Setup" component={StubSetup} />
                  <Tab.Screen name="Log" component={StubLog} />
                </Tab.Navigator>
              </NavigationContainer>
            </PreferencesProvider>
          </CalibrationProvider>
        </PreferencesContext.Provider>
      </SafeAreaProvider>,
      // Host elements get a stand-in, so the screen has a ref to focus.
      { createNodeMock: () => ({}) },
    );
  });
  if (tree === undefined || store === undefined) {
    throw new Error('render failed');
  }
  mounted.push(tree);
  const { setSample } = store;
  if (calibrate) {
    act(() => {
      setSample('shot', -4);
      setSample('reload', -24);
      setSample('rack', -19);
    });
  }
  // The drills are read from storage before there is anything to time.
  await settle();
  return {
    tree,
    navigationRef,
    /** The routes stacked in one tab, bottom first. */
    stackIn: (tab: keyof TestTabParamList): string[] | undefined =>
      navigationRef
        .getRootState()
        ?.routes.find(route => route.name === tab)
        ?.state?.routes.map(route => route.name),
    setSample: (...args: Parameters<typeof setSample>): void => {
      act(() => setSample(...args));
    },
    /** Switch to another tab, or back to the Timer. */
    goTo: async (tab: 'Timer' | 'Elsewhere'): Promise<void> => {
      await act(async () => {
        navigationRef.navigate(tab);
        await jest.advanceTimersByTimeAsync(0);
      });
    },
  };
};

const first = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID })[0];

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  tree.root.findAllByProps({ testID }).length > 0;

const textsUnder = (node: ReactTestInstance): string[] =>
  node.children.flatMap(child =>
    typeof child === 'string' ? [child] : textsUnder(child),
  );

/** Every string under the element with this `testID`, in order. */
const textsOf = (tree: ReactTestRenderer, testID: string): string[] =>
  textsUnder(first(tree, testID));

/** Put the drill with this name on the timer: open the drill box, pick it. */
const pick = async (tree: ReactTestRenderer, name: string): Promise<void> => {
  await press(tree, 'btn-drill-box');
  await press(tree, `select-drill-option-${drillIds[name]}`);
};

const pickerLocked = (tree: ReactTestRenderer): boolean => {
  const box = first(tree, 'btn-drill-box');
  return (
    box.props.disabled === true &&
    box.props.accessibilityState?.disabled === true
  );
};

/** What the Start button says; `null` while Save and Discard stand in for it. */
const buttonLabel = (tree: ReactTestRenderer): string | null =>
  has(tree, 'btn-start')
    ? first(tree, 'btn-start').props.accessibilityLabel
    : null;

/** A finished run is on offer: Save and Discard are the main action. */
const offersSave = (tree: ReactTestRenderer): boolean =>
  has(tree, 'btn-save-run') && !has(tree, 'btn-start');

const subtitle = (tree: ReactTestRenderer): string =>
  first(tree, 'screen-timer').props.subtitle;

const elapsedText = (tree: ReactTestRenderer): string =>
  first(tree, 'text-elapsed').props.children;

const clockCaption = (tree: ReactTestRenderer): string =>
  first(tree, 'text-elapsed-caption').props.children;

const clockMeta = (tree: ReactTestRenderer): string =>
  first(tree, 'text-clock-meta').props.children;

/** The theme colour the clock's figure is drawn in. */
const clockColor = (tree: ReactTestRenderer): string =>
  first(tree, 'text-elapsed').props.color;

/**
 * The main action is pinned under the scrolling content, so it is in the
 * same place whatever the run is doing.
 */
const mainActionPinned = (tree: ReactTestRenderer): boolean => {
  const action = has(tree, 'btn-start') ? 'btn-start' : 'btn-save-run';
  return (
    has(tree, action) &&
    first(tree, 'scroll-timer-content').findAll(
      node => node.props.testID === action,
    ).length === 0
  );
};

/** One row of the splits table, as the shooter sees and hears it. */
const split = (tree: ReactTestRenderer, index: number) => {
  const id = `row-split-${index}`;
  const cell = (part: string) => first(tree, `${id}-${part}`).props;
  return {
    label: cell('label').children,
    par: cell('par').children,
    time: cell('time').children,
    delta: cell('delta').children,
    deltaColor: cell('delta').color,
    accessibilityLabel: first(tree, id).props.accessibilityLabel,
  };
};

/** The true minus sign the table puts in front of a time under par. */
const MINUS = '\u2212';

const timingNote = (tree: ReactTestRenderer): string | null => {
  const notes = tree.root.findAllByProps({ testID: 'text-run-timing' });
  return notes.length === 0 ? null : notes[0].props.children;
};

/** Let whatever a press started run until it next has to wait. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
  });
};

const press = async (tree: ReactTestRenderer, testID: string) => {
  await act(async () => {
    first(tree, testID).props.onPress();
  });
  await settle();
};

/** Deliver a reading whose sound peaked (and began) at `at`. */
const hear = (at: number, peakDb: number, overrides: object = {}): void => {
  act(() => {
    DeviceEventEmitter.emit(AUDIO_AMPLITUDE_EVENT, {
      amplitude: 0.1,
      db: peakDb - 3,
      peak: 0.2,
      peakDb,
      timestamp: at + 5,
      peakTimestamp: at,
      onsetTimestamp: at,
      frameTimed: true,
      ...overrides,
    });
  });
};

/** The start sequence reaches its beep: the request is stamped, then it resolves. */
const beep = async (): Promise<void> => {
  const pending = pendingStart;
  if (pending === undefined) {
    throw new Error('the screen has not asked for a start sequence');
  }
  await act(async () => {
    captureNow = REQUESTED_AT;
    pending.options.onTrigger?.();
    pending.resolve({ startedAt: 0, delayMs: 2000 });
    await jest.advanceTimersByTimeAsync(0);
  });
};

/** Let the clock on screen redraw with the capture clock reading `now`. */
const tickAt = async (now: number): Promise<void> => {
  await act(async () => {
    captureNow = now;
    await jest.advanceTimersByTimeAsync(50);
  });
};

/** Press Start, sound the beep, and let the microphone hear it and the quiet after. */
const startRun = async (tree: ReactTestRenderer): Promise<void> => {
  await press(tree, 'btn-start');
  hear(REQUESTED_AT - 40, ROOM_DB);
  await beep();
  hear(ZERO, -20);
  hear(ZERO + 400, ROOM_DB);
};

/** A shot, and the quiet after it that lets the next one count. */
const shoot = (at: number): void => {
  hear(at, -4);
  hear(at + 23, ROOM_DB);
};

/** A rejection shaped like the one React Native builds from `promise.reject(code, message)`. */
const nativeRejection = (code: string, message: string): Error =>
  Object.assign(new Error(message), { code });

describe('TimerScreen', () => {
  const originalPlatformOS = Platform.OS;
  let announce: jest.SpiedFunction<
    typeof AccessibilityInfo.announceForAccessibility
  >;
  let requestPermission: jest.SpiedFunction<typeof PermissionsAndroid.request>;
  let checkPermission: jest.SpiedFunction<typeof PermissionsAndroid.check>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    pendingStart = undefined;
    captureNow = REQUESTED_AT - 3000;
    startMock.mockReset();
    startMock.mockImplementation(
      (options = {}) =>
        new Promise<StartSequenceResult>((resolve, reject) => {
          pendingStart = { options, resolve, reject };
          options.signal?.addEventListener('abort', () =>
            reject(new StartSequenceAbortError()),
          );
        }),
    );
    prepareMock.mockReset();
    prepareMock.mockResolvedValue(undefined);

    mockedNativeAudioCapture.start.mockReset();
    mockedNativeAudioCapture.start.mockResolvedValue(undefined);
    mockedNativeAudioCapture.stop.mockReset();
    mockedNativeAudioCapture.stop.mockResolvedValue(undefined);
    mockedNativeAudioCapture.now.mockReset();
    mockedNativeAudioCapture.now.mockImplementation(() => captureNow);

    checkPermission = jest
      .spyOn(PermissionsAndroid, 'check')
      .mockResolvedValue(true);
    requestPermission = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    // A spy on the same function carries the calls of the test before it.
    announce.mockClear();

    await AsyncStorage.clear();
    await seedLibrary();
  });

  afterEach(() => {
    // Unmount, or the navigator's pending work outlives the test.
    act(() => {
      mounted.splice(0).forEach(tree => tree.unmount());
    });
    jest.restoreAllMocks();
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  describe('before a run', () => {
    it('is ready to start', async () => {
      const { tree } = await renderScreen();

      expect(buttonLabel(tree)).toBe('Start timer');
      expect(subtitle(tree)).toBe('Ready when you are');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
      expect(timingNote(tree)).toBeNull();
    });

    it('shows the TIMER header with Reset as its action', async () => {
      const { tree } = await renderScreen();

      expect(first(tree, 'screen-timer').props.title).toBe('Timer');
      expect(textsOf(tree, 'btn-reset')).toEqual(['RESET']);
      expect(first(tree, 'btn-reset').props.accessibilityLabel).toBe('Reset');
    });

    it('shows the drill in the drill box, ready to be changed', async () => {
      const { tree } = await renderScreen();

      expect(textsOf(tree, 'btn-drill-box')).toEqual(['DRILL', 'Bill Drill']);
      expect(first(tree, 'btn-drill-box').props).toMatchObject({
        accessibilityRole: 'button',
        accessibilityLabel: 'Drill: Bill Drill. Change drill',
      });
    });

    it('shows the shots and par of the drill on the clock', async () => {
      const { tree } = await renderScreen();

      // Bill Drill: six shots, 1.50 + 0.25 + 0.20 × 5.
      expect(clockMeta(tree)).toBe('6 SHOTS · PAR 2.75');
      expect(clockCaption(tree)).toBe('SECONDS');
    });

    it('shows a silent step as counting towards the step after it', async () => {
      const { tree } = await renderScreen();

      expect(split(tree, 0)).toMatchObject({
        label: 'Draw',
        par: '1.50',
        time: '—',
        delta: 'with next',
        accessibilityLabel:
          'Draw, not timed. Its par of 1.5 seconds counts towards the next step',
      });
    });

    it('shows a heard step with the par it will be judged against', async () => {
      const { tree } = await renderScreen();

      // Its own 0.25 s plus the draw's 1.50 s.
      expect(split(tree, 1)).toMatchObject({
        label: 'Shot 1',
        par: '1.75',
        time: '—',
        delta: '',
        accessibilityLabel: 'Shot 1, par 1.75 seconds, not heard yet',
      });
    });

    it('shows a silent step with nothing heard after it as not timed', async () => {
      const { tree } = await renderScreen();

      // Mozambique ends on a holster.
      await pick(tree, 'Mozambique');

      expect(split(tree, 4)).toMatchObject({
        label: 'Holster',
        delta: 'not timed',
        deltaColor: 'textSecondary',
        accessibilityLabel: 'Holster, not timed',
      });
    });

    it('shows no par on a step that has none', async () => {
      const { tree } = await renderScreen();

      // Dot Torture: a rack with no par, straight after a shot with none.
      await pick(tree, 'Dot Torture');

      expect(split(tree, 6)).toMatchObject({
        label: 'Rack',
        par: '—',
        accessibilityLabel: 'Rack, no par, not heard yet',
      });
    });

    it('says so when the audio output could not be set up', async () => {
      prepareMock.mockRejectedValue(new Error('no audio'));

      const { tree } = await renderScreen();
      await settle();

      expect(subtitle(tree)).toBe('Audio unavailable');
    });
  });

  describe('starting', () => {
    it('opens the microphone before it starts the delay', async () => {
      const order: string[] = [];
      mockedNativeAudioCapture.start.mockImplementation(async () => {
        order.push('microphone');
      });
      startMock.mockImplementation(() => {
        order.push('delay');
        return new Promise(() => {});
      });
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      expect(order).toEqual(['microphone', 'delay']);
      expect(buttonLabel(tree)).toBe('Cancel start');
      expect(subtitle(tree)).toBe('Stand by…');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
    });

    it('starts with the delay range and beep volume stored in Settings', async () => {
      // Stored before the screen mounts, as after an app restart.
      await updateProfile({
        startDelay: { minMs: 2000, maxMs: 3500 },
        beepVolume: 'quiet',
      });
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(pendingStart?.options).toMatchObject({
        minDelayMs: 2000,
        maxDelayMs: 3500,
        beep: { volume: 0.25 },
      });
    });

    it('labels the main action Start, Cancel and Stop as the run moves on', async () => {
      const mainAction = (tree: ReactTestRenderer) => {
        const { label, variant, size, accessibilityLabel } = first(
          tree,
          'btn-start',
        ).props;
        return { label, variant, size, accessibilityLabel };
      };
      const { tree } = await renderScreen();
      expect(mainAction(tree)).toEqual({
        label: 'Start',
        variant: 'primary',
        size: 'main',
        accessibilityLabel: 'Start timer',
      });

      await press(tree, 'btn-start');
      expect(mainAction(tree)).toEqual({
        label: 'Cancel',
        variant: 'secondary',
        size: 'main',
        accessibilityLabel: 'Cancel start',
      });

      hear(REQUESTED_AT - 40, ROOM_DB);
      await beep();
      expect(mainAction(tree)).toEqual({
        label: 'Stop',
        variant: 'stop',
        size: 'main',
        accessibilityLabel: 'Stop timer',
      });
      expect(
        first(tree, 'btn-start').findAll(
          node => node.props.accessibilityRole === 'button',
        ),
      ).not.toHaveLength(0);
    });

    it('says how long the wait for the beep can be', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      const { minMs, maxMs } = DEFAULT_PROFILE.startDelay;
      expect(clockCaption(tree)).toBe(
        `WAIT FOR THE BEEP · ${minMs / 1000}–${maxMs / 1000} S`,
      );
    });

    it('names the sounds that still need calibrating and opens nothing', async () => {
      const { tree } = await renderScreen({ calibrate: false });

      await press(tree, 'btn-start');

      expect(subtitle(tree)).toBe('Calibrate Shot first');
      expect(buttonLabel(tree)).toBe('Start timer');
      expect(mockedNativeAudioCapture.start).not.toHaveBeenCalled();
      expect(startMock).not.toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith('Calibrate Shot first');
    });

    it('names every sound a drill needs that is not calibrated', async () => {
      const { tree, setSample } = await renderScreen({ calibrate: false });
      setSample('reload', -24);

      // Dot Torture uses shots, a reload and a rack.
      await pick(tree, 'Dot Torture');
      await press(tree, 'btn-start');

      expect(subtitle(tree)).toBe('Calibrate Shot and Rack first');
    });

    it('sends the shooter to Calibration in Setup from a refusal to start', async () => {
      const { tree, navigationRef, stackIn } = await renderScreen({
        calibrate: false,
      });
      expect(has(tree, 'btn-go-calibration')).toBe(false);
      await press(tree, 'btn-start');

      await act(async () => {
        first(tree, 'btn-go-calibration').props.onPress();
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(navigationRef.getCurrentRoute()?.name).toBe('Calibration');
      // Setup's own screen sits underneath, so back lands on Setup.
      expect(stackIn('Setup')).toEqual(['SetupHome', 'Calibration']);
    });

    it('stops asking for calibration once the sounds it named are calibrated', async () => {
      const { tree, setSample, goTo } = await renderScreen({
        calibrate: false,
      });
      await press(tree, 'btn-start');
      await goTo('Elsewhere');

      setSample('shot', -4);
      await goTo('Timer');

      expect(subtitle(tree)).toBe('Ready when you are');
      expect(has(tree, 'btn-go-calibration')).toBe(false);
    });

    it('starts once the missing sound has been calibrated', async () => {
      const { tree, setSample } = await renderScreen({ calibrate: false });
      await press(tree, 'btn-start');

      setSample('shot', -4);
      await press(tree, 'btn-start');

      expect(buttonLabel(tree)).toBe('Cancel start');
      expect(subtitle(tree)).toBe('Stand by…');
    });

    it('asks for the microphone when it has not been granted', async () => {
      checkPermission.mockResolvedValue(false);
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(buttonLabel(tree)).toBe('Cancel start');
    });

    it.each([
      [
        PermissionsAndroid.RESULTS.DENIED,
        'Microphone access is needed to time a run',
      ],
      [
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        'Microphone access is turned off. Allow it in Settings.',
      ],
    ])(
      'says what to do when the microphone is refused (%s)',
      async (answer, message) => {
        checkPermission.mockResolvedValue(false);
        requestPermission.mockResolvedValue(answer);
        const { tree } = await renderScreen();

        await press(tree, 'btn-start');

        expect(subtitle(tree)).toBe(message);
        expect(buttonLabel(tree)).toBe('Start timer');
        expect(mockedNativeAudioCapture.start).not.toHaveBeenCalled();
        expect(startMock).not.toHaveBeenCalled();
      },
    );

    it('offers the settings when the microphone is turned off', async () => {
      const openSettings = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValue(undefined);
      checkPermission.mockResolvedValue(false);
      requestPermission.mockResolvedValue(
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );
      const { tree } = await renderScreen();
      await press(tree, 'btn-start');

      await press(tree, 'btn-open-settings');

      expect(openSettings).toHaveBeenCalledTimes(1);
    });

    it('does not offer the settings when the microphone can still be asked for', async () => {
      checkPermission.mockResolvedValue(false);
      requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      expect(has(tree, 'btn-open-settings')).toBe(false);
    });

    it('says so when the microphone cannot be opened', async () => {
      mockedNativeAudioCapture.start.mockRejectedValue(
        nativeRejection('INIT_FAILED', 'AudioRecord failed to initialize'),
      );
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      expect(subtitle(tree)).toBe('The microphone could not be used');
      expect(buttonLabel(tree)).toBe('Start timer');
      expect(startMock).not.toHaveBeenCalled();
    });

    it('cancels the start and closes the microphone when pressed during the wait', async () => {
      const { tree } = await renderScreen();
      await press(tree, 'btn-start');

      await press(tree, 'btn-start');

      expect(buttonLabel(tree)).toBe('Start timer');
      expect(subtitle(tree)).toBe('Ready when you are');
      expect(pendingStart?.options.signal?.aborted).toBe(true);
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalled();
    });

    it('closes the microphone and says so when the beep cannot be played', async () => {
      startMock.mockRejectedValue(new StartSequenceError('no audio'));
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      expect(subtitle(tree)).toBe('Could not play the start beep');
      expect(buttonLabel(tree)).toBe('Start timer');
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalled();
    });

    it('goes back to ready when the app is left during the wait', async () => {
      const { tree } = await renderScreen();
      await press(tree, 'btn-start');

      act(() => {
        DeviceEventEmitter.emit(AUDIO_CAPTURE_ERROR_EVENT, {
          code: 'INTERRUPTED',
          message: 'left the app',
        });
      });
      await settle();

      expect(subtitle(tree)).toBe('The run stopped because the app was left');
      expect(buttonLabel(tree)).toBe('Start timer');
      // The beep must not sound for a run that is not listening.
      expect(pendingStart?.options.signal?.aborted).toBe(true);
    });
  });

  describe('during a run', () => {
    it('listens once the beep is requested', async () => {
      const { tree } = await renderScreen();
      await press(tree, 'btn-start');

      await beep();

      expect(buttonLabel(tree)).toBe('Stop timer');
      expect(subtitle(tree)).toBe('Listening…');
    });

    it('holds the clock at zero until the beep is heard', async () => {
      const { tree } = await renderScreen();
      await press(tree, 'btn-start');
      await beep();

      await tickAt(REQUESTED_AT + 60);

      expect(elapsedText(tree)).toBe(formatElapsed(0));
    });

    it('runs the clock from when the beep was heard, not when it was requested', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);

      await tickAt(ZERO + 1000);

      expect(elapsedText(tree)).toBe(formatElapsed(1));
    });

    it('fills in a step with its time and how it did against par when it is heard', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);

      shoot(ZERO + 1400);

      expect(split(tree, 1)).toEqual({
        label: 'Shot 1',
        par: '1.75',
        time: '1.40',
        delta: `${MINUS}0.35`,
        deltaColor: 'textPrimary',
        accessibilityLabel:
          'Shot 1, par 1.75 seconds, took 1.4 seconds, 0.35 seconds under par',
      });
      expect(split(tree, 2)).toMatchObject({ time: '—', delta: 'listening' });
    });

    it('words a step that ran over its par as over, not by colour alone', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);

      shoot(ZERO + 1400);
      shoot(ZERO + 1700);

      expect(split(tree, 2)).toEqual({
        label: 'Shot 2',
        par: '0.20',
        time: '0.30',
        delta: '+0.10',
        // Signal, the warning token, as well as the plus sign.
        deltaColor: 'warning',
        accessibilityLabel:
          'Shot 2, par 0.2 seconds, took 0.3 seconds, 0.1 seconds over par',
      });
    });

    it('words a step that landed on its par as on par', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);

      shoot(ZERO + 1750);

      expect(split(tree, 1)).toMatchObject({
        time: '1.75',
        delta: '0.00',
        deltaColor: 'textPrimary',
        accessibilityLabel:
          'Shot 1, par 1.75 seconds, took 1.75 seconds, on par',
      });
    });

    it('shows the time of a step that has no par', async () => {
      const { tree } = await renderScreen();
      // Dot Torture: its shots have no par, so the first is judged against
      // the draw's 1.50 s alone and the second against nothing.
      await pick(tree, 'Dot Torture');
      await startRun(tree);

      shoot(ZERO + 1400);
      shoot(ZERO + 1900);

      expect(split(tree, 2)).toEqual({
        label: 'Shot 2',
        par: '—',
        time: '0.50',
        delta: '',
        deltaColor: 'textSecondary',
        accessibilityLabel: 'Shot 2, no par, took 0.5 seconds',
      });
    });

    it('turns the clock to OVER PAR once the drill par has passed', async () => {
      const { tree } = await renderScreen();
      // Failure to Stop: 1.50 + 0.25 + 0.25 + 0.50 = 2.50 s.
      await pick(tree, 'Failure to Stop');
      await startRun(tree);

      await tickAt(ZERO + 2400);
      expect(clockCaption(tree)).toBe('SECONDS');
      expect(clockColor(tree)).toBe('textPrimary');

      await tickAt(ZERO + 2600);
      expect(clockCaption(tree)).toBe('OVER PAR');
      // Signal, the warning token, and nothing else.
      expect(clockColor(tree)).toBe('warning');
      expect(first(tree, 'text-elapsed-caption').props.color).toBe('warning');
    });

    it('shows which step it is listening for', async () => {
      const { tree } = await renderScreen();
      await pick(tree, 'Failure to Stop');
      await startRun(tree);
      expect(clockMeta(tree)).toBe('SHOT 1 OF 3');

      shoot(ZERO + 1400);

      expect(clockMeta(tree)).toBe('SHOT 2 OF 3');
    });
  });

  describe('when the run completes', () => {
    /** Failure to Stop: a draw and three shots. */
    const completeRun = async (tree: ReactTestRenderer): Promise<void> => {
      await pick(tree, 'Failure to Stop');
      await startRun(tree);
      shoot(ZERO + 1400);
      shoot(ZERO + 1700);
      shoot(ZERO + 2200);
      await settle();
    };

    it('stops on the last step and shows the run time', async () => {
      const { tree } = await renderScreen();

      await completeRun(tree);

      expect(offersSave(tree)).toBe(true);
      expect(subtitle(tree)).toBe('Run complete');
      expect(elapsedText(tree)).toBe(formatElapsed(2.2));
      expect(clockMeta(tree)).toBe('0.30 UNDER PAR');
      expect([1, 2, 3].map(index => split(tree, index).time)).toEqual([
        '1.40',
        '0.30',
        '0.50',
      ]);
    });

    it('holds the run time however long the screen stays open', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);

      await tickAt(ZERO + 60_000);

      expect(elapsedText(tree)).toBe(formatElapsed(2.2));
    });

    it('closes the microphone', async () => {
      const { tree } = await renderScreen();

      await completeRun(tree);

      expect(mockedNativeAudioCapture.stop).toHaveBeenCalledTimes(1);
    });

    it('says how the run was timed', async () => {
      const { tree } = await renderScreen();

      await completeRun(tree);

      expect(timingNote(tree)).toBe(
        "Timed from the start beep as it was heard, 84 ms after it was requested. Steps timed by the microphone hardware's own clock.",
      );
    });

    it('announces the run time, once', async () => {
      const { tree } = await renderScreen();

      await completeRun(tree);
      await tickAt(ZERO + 5000);

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        'Run complete, 2.2 seconds. Save it or discard it',
      );
    });

    it('does not call a run over par when its time reads the same as the par', async () => {
      const { tree } = await renderScreen();
      // Failure to Stop has a par of 2.50 s.
      await pick(tree, 'Failure to Stop');
      await startRun(tree);

      shoot(ZERO + 1400);
      shoot(ZERO + 1700);
      shoot(ZERO + 2504);
      await settle();

      expect(elapsedText(tree)).toBe(formatElapsed(2.5));
      expect(clockCaption(tree)).toBe('SECONDS');
      expect(clockMeta(tree)).toBe('ON PAR');
    });

    it('calls a run over par once its time reads a hundredth over', async () => {
      const { tree } = await renderScreen();
      await pick(tree, 'Failure to Stop');
      await startRun(tree);

      shoot(ZERO + 1400);
      shoot(ZERO + 1700);
      shoot(ZERO + 2506);
      await settle();

      expect(elapsedText(tree)).toBe(formatElapsed(2.51));
      expect(clockCaption(tree)).toBe('OVER PAR');
      expect(clockColor(tree)).toBe('warning');
      expect(clockMeta(tree)).toBe('0.01 OVER PAR');
    });

    it('starts the next run on the clock at zero, not where the last one stopped', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      await press(tree, 'btn-save-run');

      await press(tree, 'btn-start');
      hear(REQUESTED_AT - 40, ROOM_DB);
      await beep();

      // Running, and the clock has not ticked yet.
      expect(buttonLabel(tree)).toBe('Stop timer');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
    });

    it('starts a fresh run once the finished one is discarded', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      await press(tree, 'btn-discard-run');

      await press(tree, 'btn-start');

      expect(buttonLabel(tree)).toBe('Cancel start');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
      expect(split(tree, 1).time).toBe('—');
      expect(timingNote(tree)).toBeNull();
    });

    it('says so when the beep was not heard', async () => {
      const { tree } = await renderScreen();
      await pick(tree, 'Failure to Stop');
      await press(tree, 'btn-start');
      await beep();

      // Nothing but the room for the 600 ms the beep is given.
      hear(REQUESTED_AT + 150, ROOM_DB);
      hear(REQUESTED_AT + 620, ROOM_DB);
      shoot(REQUESTED_AT + 1400);
      shoot(REQUESTED_AT + 1700);
      shoot(REQUESTED_AT + 2200);
      await settle();

      expect(timingNote(tree)).toBe(
        "The start beep was not heard, so the run is timed from when it was requested and its first step may read long. Steps timed by the microphone hardware's own clock.",
      );
    });

    it('says so when the device has no exact microphone clock', async () => {
      const { tree } = await renderScreen();
      await pick(tree, 'Failure to Stop');
      await startRun(tree);

      hear(ZERO + 1400, -4, { frameTimed: false });
      hear(ZERO + 1423, ROOM_DB);
      shoot(ZERO + 1700);
      shoot(ZERO + 2200);
      await settle();

      expect(timingNote(tree)).toBe(
        'Timed from the start beep as it was heard, 84 ms after it was requested. This device gives no hardware microphone clock, so a step may be up to 20 ms off.',
      );
    });
  });

  describe('stopping a run', () => {
    it('keeps the steps that were heard when stopped early', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);

      await press(tree, 'btn-start');

      expect(offersSave(tree)).toBe(true);
      expect(subtitle(tree)).toBe('Run stopped early');
      expect(elapsedText(tree)).toBe(formatElapsed(1.4));
      expect(clockCaption(tree)).toBe('SECONDS · STOPPED EARLY');
      expect(clockMeta(tree)).toBe('1 OF 6 HEARD');
      expect(split(tree, 1).time).toBe('1.40');
      expect(split(tree, 2)).toMatchObject({ time: '—', delta: 'not heard' });
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        'Run stopped early, 1 step heard. Save it or discard it',
      );
    });

    it('hears nothing after it is stopped', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      await press(tree, 'btn-start');

      shoot(ZERO + 1400);

      expect(split(tree, 1).time).toBe('—');
    });

    it('clears the run on Reset', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');

      await press(tree, 'btn-reset');

      expect(buttonLabel(tree)).toBe('Start timer');
      expect(subtitle(tree)).toBe('Ready when you are');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
      expect(split(tree, 1).time).toBe('—');
      expect(timingNote(tree)).toBeNull();
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalled();
    });

    it('does not let a drill be picked while a run is on', async () => {
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');
      // Waiting for the beep, then running: a stray touch must not end it.
      expect(pickerLocked(tree)).toBe(true);

      hear(REQUESTED_AT - 40, ROOM_DB);
      await beep();
      expect(pickerLocked(tree)).toBe(true);

      await press(tree, 'btn-start');
      expect(pickerLocked(tree)).toBe(false);
    });

    it('labels the drill box as locked during a run', async () => {
      const { tree } = await renderScreen();

      await startRun(tree);

      expect(textsOf(tree, 'btn-drill-box')).toEqual([
        'DRILL · LOCKED DURING A RUN',
        'Bill Drill',
      ]);
      expect(first(tree, 'btn-drill-box').props.accessibilityLabel).toBe(
        'Drill: Bill Drill, locked during a run',
      );
    });

    it('keeps the main action in the same place in every state', async () => {
      const { tree, setSample } = await renderScreen({ calibrate: false });
      const states: boolean[] = [];

      // Blocked: a sound still to calibrate.
      await press(tree, 'btn-start');
      expect(subtitle(tree)).toBe('Calibrate Shot first');
      states.push(mainActionPinned(tree));

      setSample('shot', -4);
      await press(tree, 'btn-reset');
      // Ready, then standing by, then running.
      states.push(mainActionPinned(tree));
      await press(tree, 'btn-start');
      states.push(mainActionPinned(tree));
      hear(REQUESTED_AT - 40, ROOM_DB);
      await beep();
      hear(ZERO, -20);
      hear(ZERO + 400, ROOM_DB);
      states.push(mainActionPinned(tree));

      // Stopped early.
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');
      expect(subtitle(tree)).toBe('Run stopped early');
      states.push(mainActionPinned(tree));

      expect(states).toEqual([true, true, true, true, true]);
    });

    it('clears the finished run when another drill is picked', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');

      await pick(tree, 'Failure to Stop');

      expect(subtitle(tree)).toBe('Ready when you are');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
      expect(split(tree, 1).time).toBe('—');
      expect(timingNote(tree)).toBeNull();
    });

    it('keeps the finished run when the drill already picked is pressed again', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');

      await pick(tree, 'Bill Drill');

      expect(subtitle(tree)).toBe('Run stopped early');
      expect(split(tree, 1).time).toBe('1.40');
    });

    it('finishes the run once when Stop is pressed twice', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);

      await act(async () => {
        first(tree, 'btn-start').props.onPress();
        first(tree, 'btn-start').props.onPress();
      });
      await settle();

      expect(subtitle(tree)).toBe('Run stopped early');
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    it('keeps Reset off while a run is on, so a stray touch cannot throw it away', async () => {
      const resetOff = (tree: ReactTestRenderer): boolean => {
        const reset = first(tree, 'btn-reset');
        return (
          reset.props.disabled === true &&
          reset.props.accessibilityState?.disabled === true
        );
      };
      const { tree } = await renderScreen();
      expect(resetOff(tree)).toBe(false);

      await press(tree, 'btn-start');
      expect(resetOff(tree)).toBe(true);

      hear(REQUESTED_AT - 40, ROOM_DB);
      await beep();
      expect(resetOff(tree)).toBe(true);

      await press(tree, 'btn-start');
      expect(resetOff(tree)).toBe(false);
    });

    it('ends the run with what was heard when the app is left', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);

      act(() => {
        DeviceEventEmitter.emit(AUDIO_CAPTURE_ERROR_EVENT, {
          code: 'INTERRUPTED',
          message: 'left the app',
        });
      });
      await settle();

      expect(subtitle(tree)).toBe('The run stopped because the app was left');
      expect(offersSave(tree)).toBe(true);
      expect(split(tree, 1).time).toBe('1.40');
      expect(elapsedText(tree)).toBe(formatElapsed(1.4));
    });

    it('ends the run when the Timer tab is left, and still shows it on return', async () => {
      const { tree, goTo } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);

      await goTo('Elsewhere');
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalledTimes(1);
      // Nothing is said over the tab the shooter went to.
      expect(announce).not.toHaveBeenCalled();

      await goTo('Timer');
      expect(subtitle(tree)).toBe('Run stopped early');
      expect(split(tree, 1).time).toBe('1.40');
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        'Run stopped early, 1 step heard. Save it or discard it',
      );
    });

    it('says why and what was heard in one announcement when the app is left mid-run', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);

      act(() => {
        DeviceEventEmitter.emit(AUDIO_CAPTURE_ERROR_EVENT, {
          code: 'INTERRUPTED',
          message: 'left the app',
        });
      });
      await settle();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        'The run stopped because the app was left. Run stopped early, 1 step heard. Save it or discard it',
      );
    });

    it('cancels a start that is still waiting when the Timer tab is left', async () => {
      const { tree, goTo } = await renderScreen();
      await press(tree, 'btn-start');

      await goTo('Elsewhere');
      await goTo('Timer');

      expect(pendingStart?.options.signal?.aborted).toBe(true);
      expect(buttonLabel(tree)).toBe('Start timer');
      expect(subtitle(tree)).toBe('Ready when you are');
    });

    it('closes the microphone when the screen goes away mid-run', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);

      await act(async () => {
        mounted.splice(0).forEach(rendered => rendered.unmount());
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(tree.toJSON()).toBeNull();
      expect(mockedNativeAudioCapture.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('the drill library', () => {
    it('puts the drill changed most recently on the timer', async () => {
      const { tree } = await renderScreen();

      expect(first(tree, 'select-drill').props.value).toBe(
        drillIds['Bill Drill'],
      );
      expect(textsOf(tree, 'btn-drill-box')).toContain('Bill Drill');
      expect(split(tree, 6).label).toBe('Shot 6');
    });

    it('offers every stored drill, with its shots and par', async () => {
      const { tree } = await renderScreen();

      const options = first(tree, 'select-drill').props.options;
      expect(options).toHaveLength(LIBRARY.length);
      expect(options[0]).toEqual({
        value: drillIds['Bill Drill'],
        label: 'Bill Drill',
        description: '6 shots · Par 2.75s',
      });
    });

    it('says it is reading the drills until storage answers', async () => {
      const getAll = jest
        .spyOn(AsyncStorage, 'getAllKeys')
        .mockImplementation(() => new Promise(() => {}));

      const { tree } = await renderScreen();

      expect(has(tree, 'text-timer-drills-loading')).toBe(true);
      expect(has(tree, 'btn-start')).toBe(false);
      getAll.mockRestore();
    });

    it('sends the shooter to create a drill in Drills when there is none', async () => {
      await AsyncStorage.clear();
      const { tree, navigationRef, stackIn } = await renderScreen();

      expect(has(tree, 'state-timer-drills-empty')).toBe(true);
      expect(has(tree, 'btn-start')).toBe(false);
      expect(subtitle(tree)).toBe('Create a drill to start');

      await act(async () => {
        first(tree, 'state-timer-drills-empty')
          .findAllByProps({ accessibilityRole: 'button' })[0]
          .props.onPress();
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(navigationRef.getCurrentRoute()).toMatchObject({
        name: 'SequenceEditor',
        params: {},
      });
      // The drill list sits underneath, so back lands on Drills.
      expect(stackIn('Drills')).toEqual(['DrillList', 'SequenceEditor']);
    });

    it('offers to read the drills again when they cannot be read', async () => {
      jest
        .spyOn(AsyncStorage, 'getAllKeys')
        .mockRejectedValueOnce(new Error('disk'));

      const { tree } = await renderScreen();
      expect(has(tree, 'state-timer-drills-error')).toBe(true);

      await act(async () => {
        first(tree, 'state-timer-drills-error')
          .findAllByProps({ accessibilityRole: 'button' })[0]
          .props.onPress();
      });
      await settle();

      expect(has(tree, 'state-timer-drills-error')).toBe(false);
      expect(has(tree, 'btn-start')).toBe(true);
    });

    it('shows a drill created on another tab when it comes back', async () => {
      const { tree, goTo } = await renderScreen();
      await goTo('Elsewhere');

      const made = await saveDrill(
        { name: 'Box Drill', steps: [{ type: 'shot', par: 2 }] },
        { getTimestamp: () => '2026-10-02T08:00:00.000Z' },
      );
      await goTo('Timer');
      await settle();

      expect(first(tree, 'select-drill').props.value).toBe(made.id);
    });

    it('runs the drill that was picked', async () => {
      const { tree } = await renderScreen();
      await pick(tree, 'Failure to Stop');

      await startRun(tree);
      shoot(ZERO + 1400);
      shoot(ZERO + 1700);
      shoot(ZERO + 2200);
      await settle();

      expect(subtitle(tree)).toBe('Run complete');
    });
  });

  describe('loading a drill from the Drills tab', () => {
    /** What Load on a Drills row does: switch to the Timer, naming the drill. */
    const load = async (
      navigationRef: TestNavigationRef,
      drillId: string,
    ): Promise<void> => {
      await act(async () => {
        navigationRef.navigate('Timer', { drillId });
        await jest.advanceTimersByTimeAsync(0);
      });
      await settle();
    };

    const timerParams = (navigationRef: TestNavigationRef) =>
      navigationRef.getRootState()?.routes.find(route => route.name === 'Timer')
        ?.params;

    it('puts the drill a Load names on the timer', async () => {
      const { tree, navigationRef, goTo } = await renderScreen();
      await goTo('Elsewhere');

      await load(navigationRef, drillIds.Mozambique);

      expect(navigationRef.getCurrentRoute()?.name).toBe('Timer');
      expect(first(tree, 'select-drill').props.value).toBe(drillIds.Mozambique);
      expect(textsOf(tree, 'btn-drill-box')).toContain('Mozambique');
    });

    it('clears the Load once it is used', async () => {
      const { navigationRef, goTo } = await renderScreen();
      await goTo('Elsewhere');

      await load(navigationRef, drillIds.Mozambique);

      expect(timerParams(navigationRef)).toEqual({ drillId: undefined });
    });

    it('keeps a drill picked after a Load when the tab is revisited', async () => {
      const { tree, navigationRef, goTo } = await renderScreen();
      await goTo('Elsewhere');
      await load(navigationRef, drillIds.Mozambique);

      await pick(tree, 'Dot Torture');
      await goTo('Elsewhere');
      await goTo('Timer');
      await settle();

      expect(first(tree, 'select-drill').props.value).toBe(
        drillIds['Dot Torture'],
      );
    });

    it('keeps the loaded drill on the timer after a newer drill is made', async () => {
      const { tree, navigationRef, goTo } = await renderScreen();
      await goTo('Elsewhere');
      // Already on show, as the drill changed most recently.
      await load(navigationRef, drillIds['Bill Drill']);
      await goTo('Elsewhere');

      await saveDrill(
        { name: 'Box Drill', steps: [{ type: 'shot', par: 2 }] },
        { getTimestamp: () => '2026-10-02T08:00:00.000Z' },
      );
      await goTo('Timer');
      await settle();

      expect(first(tree, 'select-drill').props.value).toBe(
        drillIds['Bill Drill'],
      );
    });

    it('loads the same drill again after another was picked', async () => {
      const { tree, navigationRef, goTo } = await renderScreen();
      await load(navigationRef, drillIds.Mozambique);
      await pick(tree, 'Dot Torture');
      await goTo('Elsewhere');

      await load(navigationRef, drillIds.Mozambique);

      expect(first(tree, 'select-drill').props.value).toBe(drillIds.Mozambique);
    });

    it('falls back to the newest drill when the loaded one no longer exists', async () => {
      const { tree, navigationRef, goTo } = await renderScreen();
      await goTo('Elsewhere');
      const gone = drillIds.Mozambique;
      await deleteDrillById(gone);

      await load(navigationRef, gone);

      expect(first(tree, 'select-drill').props.value).toBe(
        drillIds['Bill Drill'],
      );
      expect(has(tree, 'btn-start')).toBe(true);
    });

    it('ignores a Load while a run is on, the drill being locked', async () => {
      const { tree, navigationRef } = await renderScreen();
      await startRun(tree);

      await load(navigationRef, drillIds.Mozambique);

      expect(first(tree, 'select-drill').props.value).toBe(
        drillIds['Bill Drill'],
      );
      expect(buttonLabel(tree)).toBe('Stop timer');
      expect(timerParams(navigationRef)).toEqual({ drillId: undefined });
    });
  });

  describe('saving a run', () => {
    /** Failure to Stop, start to finish: 2.20 s over three shots. */
    const completeRun = async (tree: ReactTestRenderer): Promise<void> => {
      await pick(tree, 'Failure to Stop');
      await startRun(tree);
      shoot(ZERO + 1400);
      shoot(ZERO + 1700);
      shoot(ZERO + 2200);
      await settle();
    };

    /** Failure to Stop, stopped after its first shot. */
    const stoppedRun = async (tree: ReactTestRenderer): Promise<void> => {
      await pick(tree, 'Failure to Stop');
      await startRun(tree);
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');
    };

    it('offers to save a run when it completes, and stores nothing until asked', async () => {
      const { tree } = await renderScreen();

      await completeRun(tree);

      expect(textsOf(tree, 'card-save-run')).toEqual(['Discard', 'Save run']);
      expect(offersSave(tree)).toBe(true);
      expect(await loadSessions()).toEqual([]);
    });

    it('offers nothing before a run has finished', async () => {
      const { tree } = await renderScreen();
      expect(has(tree, 'card-save-run')).toBe(false);

      await startRun(tree);
      shoot(ZERO + 1400);

      expect(has(tree, 'card-save-run')).toBe(false);
    });

    it('stores the run against its drill, each step named and judged as it was shown', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);

      await press(tree, 'btn-save-run');

      const [session] = await loadSessions();
      expect(session).toMatchObject({
        drillId: drillIds['Failure to Stop'],
        totalTime: 2.2,
        completed: true,
        splits: [
          { label: 'Shot 1', par: 1.75, actual: 1.4, delta: -0.35 },
          { label: 'Shot 2', par: 0.25, actual: 0.3, delta: 0.05 },
          { label: 'Shot 3', par: 0.5, actual: 0.5, delta: 0 },
        ],
      });
    });

    it('says the run is saved, and announces it', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      announce.mockClear();

      await press(tree, 'btn-save-run');

      expect(textsOf(tree, 'text-run-saved')).toEqual(['Saved to History']);
      expect(announce).toHaveBeenCalledWith('Run saved to History');
      // The run stays on show, and Start is back under the saved line.
      expect(elapsedText(tree)).toBe(formatElapsed(2.2));
      expect(buttonLabel(tree)).toBe('Start timer');
      expect(has(tree, 'btn-save-run')).toBe(false);
    });

    it('saves a run once however often Save is pressed', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);

      await act(async () => {
        first(tree, 'btn-save-run').props.onPress();
        first(tree, 'btn-save-run').props.onPress();
      });
      await settle();

      expect(await loadSessions()).toHaveLength(1);
    });

    it('offers to save a run stopped early as incomplete', async () => {
      const { tree } = await renderScreen();

      await stoppedRun(tree);

      expect(first(tree, 'btn-save-run').props.accessibilityLabel).toBe(
        'Save run as incomplete',
      );
      expect(textsOf(tree, 'text-save-run-note')).toEqual([
        'Saves as incomplete, left out of your best and average.',
      ]);
    });

    it('stores a run stopped early marked as incomplete', async () => {
      const { tree } = await renderScreen();
      await stoppedRun(tree);
      announce.mockClear();

      await press(tree, 'btn-save-run');

      const [session] = await loadSessions();
      expect(session).toMatchObject({
        totalTime: 1.4,
        completed: false,
        splits: [{ label: 'Shot 1', actual: 1.4 }],
      });
      expect(textsOf(tree, 'text-run-saved')).toEqual([
        'Saved to History as incomplete',
      ]);
      expect(announce).toHaveBeenCalledWith(
        'Run saved to History as incomplete',
      );
    });

    it('offers to save a run ended by leaving the tab, once back', async () => {
      const { tree, goTo } = await renderScreen();
      await pick(tree, 'Failure to Stop');
      await startRun(tree);
      shoot(ZERO + 1400);

      await goTo('Elsewhere');
      await goTo('Timer');
      await press(tree, 'btn-save-run');

      expect(await loadSessions()).toEqual([
        expect.objectContaining({ completed: false, totalTime: 1.4 }),
      ]);
    });

    it('has nothing to save when nothing was heard', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);

      await press(tree, 'btn-start');

      expect(has(tree, 'card-save-run')).toBe(false);
      expect(has(tree, 'text-nothing-to-save')).toBe(true);
      expect(announce).toHaveBeenCalledWith('Run stopped early, nothing heard');
    });

    it('drops the run on Discard and stores nothing', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      announce.mockClear();

      await press(tree, 'btn-discard-run');

      expect(await loadSessions()).toEqual([]);
      expect(has(tree, 'card-save-run')).toBe(false);
      expect(subtitle(tree)).toBe('Ready when you are');
      expect(elapsedText(tree)).toBe(formatElapsed(0));
      expect(announce).toHaveBeenCalledWith('Run discarded');
    });

    it('holds Start back until a finished run is saved or discarded', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);

      expect(has(tree, 'btn-start')).toBe(false);
      expect(mainActionPinned(tree)).toBe(true);

      await press(tree, 'btn-discard-run');
      await startRun(tree);
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');

      expect(await loadSessions()).toEqual([]);
      expect(first(tree, 'btn-save-run').props.accessibilityLabel).toBe(
        'Save run as incomplete',
      );
    });

    it('offers the next run for saving after one was saved', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      await press(tree, 'btn-save-run');

      await startRun(tree);
      shoot(ZERO + 1400);
      await press(tree, 'btn-start');

      expect(offersSave(tree)).toBe(true);
      await press(tree, 'btn-save-run');
      expect(await loadSessions()).toHaveLength(2);
    });

    it('keeps the run and says so when it cannot be saved, then saves on a retry', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockRejectedValueOnce(new Error('disk full'));

      await press(tree, 'btn-save-run');

      expect(textsOf(tree, 'text-save-run-error')).toEqual([
        'Could not save this run. Try again.',
      ]);
      expect(first(tree, 'btn-save-run').props.disabled).toBe(false);
      expect(await loadSessions()).toEqual([]);

      await press(tree, 'btn-save-run');

      expect(await loadSessions()).toHaveLength(1);
      expect(has(tree, 'text-save-run-error')).toBe(false);
    });

    it('holds the run still while it is being saved', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => new Promise(() => {}));

      await press(tree, 'btn-save-run');

      expect(first(tree, 'btn-save-run').props).toMatchObject({
        label: 'Saving…',
        disabled: true,
      });
      expect(first(tree, 'btn-discard-run').props.disabled).toBe(true);
      expect(has(tree, 'btn-start')).toBe(false);
      expect(first(tree, 'btn-reset').props.disabled).toBe(true);
      expect(pickerLocked(tree)).toBe(true);
    });

    it('drops a Load from the Drills tab while the run is being saved', async () => {
      const { tree, navigationRef, goTo } = await renderScreen();
      await completeRun(tree);
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => new Promise(() => {}));
      await press(tree, 'btn-save-run');
      await goTo('Elsewhere');

      await act(async () => {
        navigationRef.navigate('Timer', { drillId: drillIds.Mozambique });
        await jest.advanceTimersByTimeAsync(0);
      });
      await settle();

      expect(first(tree, 'select-drill').props.value).toBe(
        drillIds['Failure to Stop'],
      );
      expect(first(tree, 'btn-save-run').props.label).toBe('Saving…');
      // Dropped, not held: nothing changes the drill once the save is done.
      expect(
        navigationRef.getRootState()?.routes.find(r => r.name === 'Timer')
          ?.params,
      ).toEqual({ drillId: undefined });
    });

    it('drops an unsaved run when another drill is picked', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);

      await pick(tree, 'Mozambique');

      expect(has(tree, 'card-save-run')).toBe(false);
      expect(await loadSessions()).toEqual([]);
    });

    it('drops an unsaved run whose drill was deleted on another tab', async () => {
      const { tree, goTo } = await renderScreen();
      await completeRun(tree);

      await goTo('Elsewhere');
      await deleteDrillById(drillIds['Failure to Stop']);
      await goTo('Timer');
      await settle();

      expect(has(tree, 'card-save-run')).toBe(false);
      expect(subtitle(tree)).toBe('Ready when you are');
      expect(announce).toHaveBeenCalledWith(
        'Run discarded: its drill was deleted',
      );
    });

    it('keeps a saved run on show when its drill is deleted afterwards', async () => {
      const { tree, goTo } = await renderScreen();
      await completeRun(tree);
      await press(tree, 'btn-save-run');

      await goTo('Elsewhere');
      await deleteDrillById(drillIds['Failure to Stop']);
      await goTo('Timer');
      await settle();

      expect(textsOf(tree, 'text-run-saved')).toEqual(['Saved to History']);
      expect(elapsedText(tree)).toBe(formatElapsed(2.2));
    });

    it('puts a screen reader on the Start button once the run is saved or discarded', async () => {
      const focus = jest
        .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
        .mockImplementation(() => {});
      // A spy on the same function carries the calls of the tests before.
      focus.mockClear();
      const { tree } = await renderScreen();
      await completeRun(tree);

      await press(tree, 'btn-save-run');
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenLastCalledWith(expect.anything(), 'focus');

      await completeRun(tree);
      await press(tree, 'btn-discard-run');
      expect(focus).toHaveBeenCalledTimes(2);
    });

    it('saves the run as it was shown when its drill was edited meanwhile', async () => {
      const { tree, goTo } = await renderScreen();
      await completeRun(tree);

      await goTo('Elsewhere');
      // The first shot is made a reload, which would rename every shot.
      const id = drillIds['Failure to Stop'];
      const drill = await loadDrillById(id);
      await updateDrill(id, {
        steps: (drill?.steps ?? []).map((step, index) =>
          index === 1 ? { ...step, type: 'reload' } : step,
        ),
      });
      await goTo('Timer');
      await settle();

      expect(split(tree, 1).label).toBe('Shot 1');
      await press(tree, 'btn-save-run');

      const [session] = await loadSessions();
      expect(session.splits.map(item => item.label)).toEqual([
        'Shot 1',
        'Shot 2',
        'Shot 3',
      ]);
    });
  });

  describe('the Range Card layout', () => {
    /** Failure to Stop, start to finish: 2.20 s over three shots. */
    const completeRun = async (tree: ReactTestRenderer): Promise<void> => {
      await pick(tree, 'Failure to Stop');
      await startRun(tree);
      shoot(ZERO + 1400);
      shoot(ZERO + 1700);
      shoot(ZERO + 2200);
      await settle();
    };

    it('scrolls a long splits list above the pinned main action', async () => {
      const made = await saveDrill(
        {
          name: 'ZZ Twelve',
          steps: Array.from({ length: 12 }, () => ({
            type: 'shot' as const,
            par: 0.3,
          })),
        },
        { getTimestamp: () => '2026-10-02T08:00:00.000Z' },
      );
      const { tree } = await renderScreen();
      expect(first(tree, 'select-drill').props.value).toBe(made.id);

      const scroll = first(tree, 'scroll-timer-content');
      expect(
        scroll.findAll(node => node.props.testID === 'table-splits').length,
      ).toBeGreaterThan(0);
      expect(split(tree, 11).label).toBe('Shot 12');
      expect(mainActionPinned(tree)).toBe(true);
    });

    it('opens the drill sheet titled Drill, its shots and par set as figures', async () => {
      const { tree } = await renderScreen();

      expect(first(tree, 'select-drill').props).toMatchObject({
        title: 'Drill',
        figureDescriptions: true,
      });
    });

    it('shows why a run cannot start in a notice, with the way out in it', async () => {
      const { tree } = await renderScreen({ calibrate: false });
      expect(has(tree, 'notice-timer-failure')).toBe(false);

      await press(tree, 'btn-start');

      const notice = first(tree, 'notice-timer-failure');
      expect(notice.props.message).toBe('Calibrate Shot first');
      expect(
        notice.findAll(node => node.props.testID === 'btn-go-calibration')
          .length,
      ).toBeGreaterThan(0);
    });

    it('offers the settings inside the notice when the microphone is turned off', async () => {
      checkPermission.mockResolvedValue(false);
      requestPermission.mockResolvedValue(
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );
      const { tree } = await renderScreen();

      await press(tree, 'btn-start');

      const notice = first(tree, 'notice-timer-failure');
      expect(notice.props.message).toBe(
        'Microphone access is turned off. Allow it in Settings.',
      );
      expect(
        notice.findAll(node => node.props.testID === 'btn-open-settings')
          .length,
      ).toBeGreaterThan(0);
    });

    it('says the app was left in a notice with no action, the run still offered', async () => {
      const { tree } = await renderScreen();
      await startRun(tree);
      shoot(ZERO + 1400);

      act(() => {
        DeviceEventEmitter.emit(AUDIO_CAPTURE_ERROR_EVENT, {
          code: 'INTERRUPTED',
          message: 'left the app',
        });
      });
      await settle();

      const notice = first(tree, 'notice-timer-failure');
      expect(notice.props).toMatchObject({
        message: 'The run stopped because the app was left',
        action: undefined,
      });
      expect(offersSave(tree)).toBe(true);
      expect(await loadSessions()).toEqual([]);
    });

    it('says the run is discarded when Reset drops one still on offer', async () => {
      const { tree } = await renderScreen();
      await completeRun(tree);
      announce.mockClear();

      await press(tree, 'btn-reset');

      expect(announce).toHaveBeenCalledWith('Run discarded');
      expect(buttonLabel(tree)).toBe('Start timer');
      expect(await loadSessions()).toEqual([]);
    });

    it('opens the saved run’s drill in Log from the saved line', async () => {
      const { tree, navigationRef, stackIn } = await renderScreen();
      await completeRun(tree);
      await press(tree, 'btn-save-run');

      await act(async () => {
        first(tree, 'btn-view-run').props.onPress();
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(navigationRef.getCurrentRoute()).toMatchObject({
        name: 'HistoryDetail',
        params: {
          drillId: drillIds['Failure to Stop'],
          drillName: 'Failure to Stop',
        },
      });
      // The Log list sits underneath, so back lands on it.
      expect(stackIn('Log')).toEqual(['HistoryList', 'HistoryDetail']);
    });
  });
});
